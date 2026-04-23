import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Colors, Radii, Typography } from '@/constants/theme';
import { auth, db } from '@/lib/firebase';
import { useAuthStore } from '@/stores/authStore';
import type { AttendanceRecord } from '@/types';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { profile, user } = useAuthStore();
  const router = useRouter();
  const scheme = useColorScheme();
  const c = Colors[scheme];
  const [recent, setRecent] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  const statusLabel = useMemo(() => {
    if (!profile) return '—';
    if (!profile.isActive) return 'Chờ duyệt';
    return profile.isAdmin ? 'Admin' : 'Đã kích hoạt';
  }, [profile]);

  useEffect(() => {
    if (!profile?.uid) return;
    const q = query(
      collection(db, 'attendance'),
      where('userId', '==', profile.uid),
      orderBy('timestamp', 'desc'),
      limit(5),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setRecent(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as AttendanceRecord)));
        setLoading(false);
      },
      () => setLoading(false),
    );

    return () => unsub();
  }, [profile?.uid]);

  const doLogout = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut(auth);
      // RootLayout will redirect to /login via auth state listener.
    } finally {
      setSigningOut(false);
    }
  };

  const confirmLogout = () => {
    if (signingOut) return;
    Alert.alert('Đăng xuất', 'Bạn có chắc muốn đăng xuất khỏi ứng dụng?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Đăng xuất', style: 'destructive', onPress: () => void doLogout() },
    ]);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: c.bg }]} edges={['top', 'left', 'right']}>
      <ScrollView
        style={[styles.container, { backgroundColor: c.bg }]}
        contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <Card>
          <View style={styles.cardBody}>
            <View style={styles.headerRow}>
              <Text style={[styles.hi, { color: c.textMuted }]}>Xin chào</Text>
              <Pressable style={styles.logoutButton} onPress={confirmLogout} disabled={signingOut}>
                <Text style={[styles.logoutText, { color: c.text }, signingOut ? styles.logoutTextDisabled : null]}>
                  {signingOut ? 'Đang thoát...' : 'Đăng xuất'}
                </Text>
              </Pressable>
            </View>
            <Text style={[styles.name, { color: c.text }]} numberOfLines={2}>
              {profile?.fullName || user?.displayName || user?.email || 'Người dùng'}
            </Text>
            <View style={styles.badges}>
              <Badge tone={!profile?.isActive ? 'neutral' : 'success'} label={statusLabel} />
              {profile?.employeeCode ? <Badge tone="info" label={profile.employeeCode} /> : null}
            </View>

            <Button title="Chấm công ngay" onPress={() => router.push('/attendance' as any)} />
          </View>
        </Card>

        <Card>
          <View style={styles.cardBody}>
            <Text style={[styles.sectionTitle, { color: c.text }]}>Lịch sử gần đây</Text>
            {loading ? (
              <View style={styles.centerPad}>
                <ActivityIndicator />
              </View>
            ) : recent.length === 0 ? (
              <Text style={[styles.empty, { color: c.textMuted }]}>Chưa có dữ liệu chấm công</Text>
            ) : (
              <View style={styles.list}>
                {recent.map((r) => (
                  <View key={r.id} style={styles.row}>
                    <View
                      style={[
                        styles.pill,
                        {
                          backgroundColor:
                            r.type === 'in' ? 'rgba(22, 163, 74, 0.14)' : 'rgba(249, 115, 22, 0.14)',
                          borderColor: c.border,
                        },
                      ]}
                    >
                      <Text style={[styles.pillText, { color: r.type === 'in' ? c.success : c.warning }]}>
                        {r.type === 'in' ? 'VÀO' : 'RA'}
                      </Text>
                    </View>
                    <View style={styles.rowMain}>
                      <Text style={[styles.projectName, { color: c.text }]} numberOfLines={1}>
                        {r.projectName || r.projectId || '—'}
                      </Text>
                      <Text style={[styles.sub, { color: c.textMuted }]} numberOfLines={1}>
                        {r.deviceMac || '—'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  // Cards handled by <Card />
  cardBody: { gap: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  hi: { ...Typography.label },
  logoutButton: { paddingVertical: 6, paddingHorizontal: 8, marginRight: -8 },
  logoutText: { ...Typography.label, fontWeight: '900' },
  logoutTextDisabled: { opacity: 0.6 },
  name: { ...Typography.title, fontSize: 24 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sectionTitle: { ...Typography.h2 },
  centerPad: { paddingVertical: 14, alignItems: 'center' },
  empty: { ...Typography.caption },
  list: { gap: 12 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  pill: {
    width: 52,
    height: 38,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  pillText: { fontSize: 11, fontWeight: '900' },
  rowMain: { flex: 1, gap: 4 },
  projectName: { fontSize: 13, fontWeight: '900' },
  sub: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
});

