import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { limit, onSnapshot, orderBy, query, collection, where } from 'firebase/firestore';
import { useRouter } from 'expo-router';

import { db } from '@/lib/firebase';
import { useAuthStore } from '@/stores/authStore';
import type { AttendanceRecord } from '@/types';

export default function DashboardScreen() {
  const { profile, user } = useAuthStore();
  const router = useRouter();
  const [recent, setRecent] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.hi}>Xin chào</Text>
        <Text style={styles.name}>{profile?.fullName || user?.displayName || user?.email || 'Người dùng'}</Text>
        <View style={styles.badges}>
          <View style={[styles.badge, !profile?.isActive ? styles.badgePending : styles.badgeActive]}>
            <Text style={[styles.badgeText, !profile?.isActive ? styles.badgeTextPending : styles.badgeTextActive]}>
              {statusLabel}
            </Text>
          </View>
          {profile?.employeeCode ? (
            <View style={[styles.badge, styles.badgeNeutral]}>
              <Text style={[styles.badgeText, styles.badgeTextNeutral]}>{profile.employeeCode}</Text>
            </View>
          ) : null}
        </View>

        <Pressable style={styles.primaryButton} onPress={() => router.push('/attendance' as any)}>
          <Text style={styles.primaryButtonText}>Chấm công ngay</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Lịch sử gần đây</Text>
        {loading ? (
          <View style={styles.centerPad}>
            <ActivityIndicator />
          </View>
        ) : recent.length === 0 ? (
          <Text style={styles.empty}>Chưa có dữ liệu chấm công</Text>
        ) : (
          <View style={styles.list}>
            {recent.map((r) => (
              <View key={r.id} style={styles.row}>
                <View style={[styles.pill, r.type === 'in' ? styles.pillIn : styles.pillOut]}>
                  <Text style={styles.pillText}>{r.type === 'in' ? 'VÀO' : 'RA'}</Text>
                </View>
                <View style={styles.rowMain}>
                  <Text style={styles.projectName} numberOfLines={1}>
                    {r.projectName || r.projectId || '—'}
                  </Text>
                  <Text style={styles.sub} numberOfLines={1}>
                    {r.deviceMac || '—'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F4F5' },
  content: { padding: 16, gap: 12 },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  hi: { fontSize: 12, color: '#6B7280', fontWeight: '800' },
  name: { fontSize: 22, color: '#111827', fontWeight: '900', letterSpacing: -0.4 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '900' },
  badgeActive: { backgroundColor: '#DCFCE7' },
  badgeTextActive: { color: '#166534' },
  badgePending: { backgroundColor: '#E5E7EB' },
  badgeTextPending: { color: '#374151' },
  badgeNeutral: { backgroundColor: '#EFF6FF' },
  badgeTextNeutral: { color: '#1D4ED8' },
  primaryButton: { marginTop: 6, height: 48, borderRadius: 12, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: 'white', fontSize: 16, fontWeight: '900' },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: '#111827' },
  centerPad: { paddingVertical: 14, alignItems: 'center' },
  empty: { color: '#6B7280', fontSize: 12, fontWeight: '700' },
  list: { gap: 10 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  pill: { width: 44, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pillIn: { backgroundColor: '#16A34A' },
  pillOut: { backgroundColor: '#F97316' },
  pillText: { color: 'white', fontSize: 11, fontWeight: '900' },
  rowMain: { flex: 1, gap: 2 },
  projectName: { color: '#111827', fontSize: 13, fontWeight: '900' },
  sub: { color: '#6B7280', fontSize: 11, fontWeight: '700', fontFamily: 'Courier' },
});
