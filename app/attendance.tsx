import { CameraView, useCameraPermissions } from 'expo-camera';
import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, where } from 'firebase/firestore';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    PermissionsAndroid,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/input';
import { Colors, Radii, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatDateYmd, needsExplanation } from '@/lib/attendance';
import { connectAndDiscover, requestDeviceMac, scanAndConnectFirst } from '@/lib/ble/attendanceDevice';
import { db } from '@/lib/firebase';
import { uploadImageFromUri } from '@/lib/storage/upload';
import { useAuthStore } from '@/stores/authStore';
import type { Project } from '@/types';

type NextType = 'in' | 'out';

export default function AttendanceScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuthStore();
  const scheme = useColorScheme();
  const c = Colors[scheme];
  const managerRef = useRef<any>(null);
  const cameraFacing: 'front' | 'back' = 'front';

  const getBleManager = () => {
    if (managerRef.current) return managerRef.current;
    try {
      // Lazy-load to avoid hard-crashing in environments without the native module (e.g. Expo Go).
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { BleManager } = require('react-native-ble-plx');
      managerRef.current = new BleManager();
      return managerRef.current;
    } catch {
      return null;
    }
  };

  const [cameraPerm, requestCameraPerm] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);

  const [btConnecting, setBtConnecting] = useState(false);
  const [btConnectedName, setBtConnectedName] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [deviceMac, setDeviceMac] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [projectLoading, setProjectLoading] = useState(false);

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [todayCountsLoading, setTodayCountsLoading] = useState(false);
  const [todayInCount, setTodayInCount] = useState(0);
  const [todayOutCount, setTodayOutCount] = useState(0);

  const [explainOpen, setExplainOpen] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [pendingType, setPendingType] = useState<NextType>('in');

  const ensureAndroidBlePermissions = async () => {
    if (Platform.OS !== 'android') return;

    // Android 12+ runtime permissions are required for BLE scan/connect.
    // We request both; if the OS is older, these constants may not exist (and request() will throw), so we guard.
    const toRequest: string[] = [];
    const anyPermissionsAndroid: any = PermissionsAndroid as any;
    const permScan = anyPermissionsAndroid?.PERMISSIONS?.BLUETOOTH_SCAN;
    const permConnect = anyPermissionsAndroid?.PERMISSIONS?.BLUETOOTH_CONNECT;

    if (permScan) toRequest.push(String(permScan));
    if (permConnect) toRequest.push(String(permConnect));

    // Older Android versions often require location permission for BLE scanning.
    toRequest.push(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);

    const results = await PermissionsAndroid.requestMultiple(toRequest as any);
    const denied = Object.entries(results).filter(([, v]) => v !== PermissionsAndroid.RESULTS.GRANTED);
    if (denied.length > 0) {
      throw new Error('Vui lòng cấp quyền Bluetooth/Location để kết nối thiết bị.');
    }
  };

  const waitForBlePoweredOn = async (manager: any, timeoutMs = 8000) => {
    // BleManager can be in "Unknown" briefly on startup; wait for a concrete state.
    return await new Promise<void>(async (resolve, reject) => {
      let done = false;
      let sub: any | null = null;
      const finish = (err?: Error) => {
        if (done) return;
        done = true;
        try {
          if (sub) sub.remove();
        } catch {
          // ignore
        }
        if (err) reject(err);
        else resolve();
      };

      const timer = setTimeout(() => finish(new Error('BluetoothLE đang khởi tạo. Vui lòng bật Bluetooth và thử lại.')), timeoutMs);

      try {
        const initial = await manager.state();
        if (initial === 'PoweredOn') {
          clearTimeout(timer);
          finish();
          return;
        }
      } catch {
        // ignore and rely on listener below
      }

      try {
        sub = manager.onStateChange((state: string) => {
          if (state === 'PoweredOn') {
            clearTimeout(timer);
            finish();
          } else if (state === 'Unauthorized') {
            clearTimeout(timer);
            finish(new Error('Bluetooth bị từ chối quyền. Vui lòng cấp quyền Bluetooth trong Cài đặt.'));
          } else if (state === 'Unsupported') {
            clearTimeout(timer);
            finish(new Error('Thiết bị không hỗ trợ Bluetooth LE.'));
          }
        }, true);
      } catch {
        // If onStateChange isn't available for some reason, let the timeout fire.
      }
    });
  };

  useEffect(() => {
    return () => {
      try {
        if (managerRef.current) managerRef.current.destroy();
      } catch {
        // ignore
      }
    };
  }, []);

  const resetBt = async () => {
    try {
      const manager = getBleManager();
      if (manager && deviceId) await manager.cancelDeviceConnection(deviceId);
    } catch {
      // ignore
    }
    setBtConnectedName(null);
    setDeviceId(null);
    setDeviceMac(null);
    setProjectId(null);
    setProject(null);
    setProjectLoading(false);
    setTodayInCount(0);
    setTodayOutCount(0);
  };

  const loadTodayCounts = async (userId: string, pId: string) => {
    const today = formatDateYmd(new Date());
    setTodayCountsLoading(true);
    try {
      const q = query(
        collection(db, 'attendance'),
        where('userId', '==', userId),
        where('projectId', '==', pId),
        where('date', '==', today),
      );
      const snap = await getDocs(q);
      let inCount = 0;
      let outCount = 0;
      snap.forEach((d) => {
        const data = d.data() as any;
        if (data?.type === 'in') inCount += 1;
        if (data?.type === 'out') outCount += 1;
      });
      setTodayInCount(inCount);
      setTodayOutCount(outCount);
    } catch {
      setTodayInCount(0);
      setTodayOutCount(0);
    } finally {
      setTodayCountsLoading(false);
    }
  };

  const nextActionType: NextType = useMemo(() => {
    if (todayInCount <= 0) return 'in';
    if (todayInCount === todayOutCount) return 'in';
    return 'out';
  }, [todayInCount, todayOutCount]);

  const connectBtAndLoadProject = async () => {
    setBtConnecting(true);
    try {
      await resetBt();
      const manager = getBleManager();
      if (!manager) {
        Alert.alert(
          'Bluetooth',
          'Bluetooth module chưa sẵn sàng. Nếu bạn đang chạy bằng Expo Go, hãy dùng Dev Build (expo-dev-client) rồi chạy lại.',
        );
        return;
      }

      await ensureAndroidBlePermissions();
      await waitForBlePoweredOn(manager);

      const device = await scanAndConnectFirst({ manager });
      const discovered = await connectAndDiscover(manager, device);
      setBtConnectedName(discovered.name || 'Thiết bị chấm công');
      setDeviceId(discovered.id);

      const mac = (await requestDeviceMac(manager, discovered)).trim();
      if (!mac) throw new Error('Không đọc được MAC từ thiết bị.');
      setDeviceMac(mac);

      setProjectLoading(true);
      const mapSnap = await getDoc(doc(db, 'devices', mac));
      if (!mapSnap.exists()) throw new Error(`Thiết bị ${mac} chưa được đăng ký cho dự án nào.`);
      const pId = (mapSnap.data() as any).projectId as string | undefined;
      if (!pId) throw new Error('Mapping thiết bị không hợp lệ (thiếu projectId).');
      setProjectId(pId);

      const projectSnap = await getDoc(doc(db, 'projects', pId));
      if (!projectSnap.exists()) throw new Error(`Không tìm thấy dự án với mã: ${pId}`);
      const p = { id: projectSnap.id, ...(projectSnap.data() as any) } as Project;
      setProject(p);

      if (profile?.uid) await loadTodayCounts(profile.uid, pId);
    } catch (e: any) {
      Alert.alert('Bluetooth', e?.message ?? String(e));
      await resetBt();
    } finally {
      setProjectLoading(false);
      setBtConnecting(false);
    }
  };

  const capture = async () => {
    if (!cameraPerm?.granted) {
      const r = await requestCameraPerm();
      if (!r.granted) return;
    }
    const cam: any = cameraRef.current as any;
    if (!cam?.takePictureAsync) return;
    const photo = await cam.takePictureAsync({
      quality: 0.95,
      exif: false,
      skipProcessing: true,
      // For front camera, prefer a non-mirrored capture.
      mirror: false,
    });
    setPhotoUri(photo.uri);
  };

  useEffect(() => {
    // Proactively ask permission so the user sees live camera + capture button immediately.
    if (cameraPerm && !cameraPerm.granted && cameraPerm.canAskAgain) {
      requestCameraPerm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraPerm?.granted]);

  const startSubmit = async (type: NextType) => {
    const now = new Date();
    if (needsExplanation(type, now)) {
      setPendingType(type);
      setExplainOpen(true);
      return;
    }
    await finalizeSubmit(type, '');
  };

  const finalizeSubmit = async (type: NextType, finalExplanation: string) => {
    if (!profile?.uid) return Alert.alert('Lỗi', 'Chưa tải được thông tin người dùng.');
    if (!projectId || !project) return Alert.alert('Lỗi', 'Vui lòng kết nối thiết bị để xác định dự án.');
    if (!deviceMac) return Alert.alert('Lỗi', 'Không đọc được MAC thiết bị.');
    if (!photoUri) return Alert.alert('Lỗi', 'Vui lòng chụp ảnh xác thực.');

    setSubmitting(true);
    try {
      const imagePath = `attendance/${profile.uid}/${Date.now()}.jpg`;
      const imageUrl = await uploadImageFromUri({ uri: photoUri, path: imagePath, contentType: 'image/jpeg' });

      const now = new Date();
      await addDoc(collection(db, 'attendance'), {
        userId: profile.uid,
        employeeCode: profile.employeeCode || '',
        type,
        timestamp: serverTimestamp(),
        date: formatDateYmd(now),
        projectId,
        projectName: project.name || projectId,
        deviceMac,
        deviceName: btConnectedName || '',
        deviceProjectId: projectId,
        deviceProjectName: project.name || projectId,
        imageUrl,
        explanation: finalExplanation || '',
        createdAt: serverTimestamp(),
      });

      Alert.alert('Thành công', 'Chấm công thành công!');
      setExplainOpen(false);
      setExplanation('');
      setPhotoUri(null);
      await resetBt();
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message ?? String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: c.bg }]} edges={['top', 'left', 'right']}>
      <View style={[styles.container, { backgroundColor: c.bg }]}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
        >
        <View style={styles.header}>
          <Text style={[styles.title, { color: c.text }]}>Chấm công</Text>
          <Text style={[styles.subtitle, { color: c.textMuted }]} numberOfLines={2}>
            {project?.name ? `Dự án: ${project.name}` : 'Kết nối thiết bị để xác định dự án'}
          </Text>
        </View>

        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: c.text }]}>Ảnh xác thực</Text>
            <Text style={[styles.cardHint, { color: c.textMuted }]}>Chụp ảnh khuôn mặt trước khi chấm.</Text>
          </View>

          <View style={[styles.cameraWrap, { backgroundColor: c.text }]}>
            {photoUri ? (
              <View style={styles.photoPreview}>
                <Image source={{ uri: photoUri }} style={[styles.photo, cameraFacing === 'front' && styles.photoFrontFix]} />
                <View style={styles.photoOverlay}>
                  <Text style={styles.photoOverlayText}>Ảnh đã chụp</Text>
                  <Button title="Chụp lại" variant="ghost" onPress={() => setPhotoUri(null)} disabled={submitting} style={styles.ghostButton} textStyle={styles.ghostButtonText as any} />
                </View>
              </View>
            ) : cameraPerm?.granted ? (
              <>
                <CameraView ref={cameraRef as any} style={styles.camera} facing={cameraFacing} />
                <View style={styles.cameraControls}>
                  <Pressable style={styles.captureButton} onPress={capture} disabled={submitting}>
                    {submitting ? <ActivityIndicator color={c.text} /> : <Text style={[styles.captureButtonText, { color: c.text }]}>Chụp ảnh</Text>}
                  </Pressable>
                </View>
              </>
            ) : (
              <View style={styles.cameraBlocked}>
                <Text style={styles.cameraBlockedTitle}>Cần quyền Camera</Text>
                <Text style={styles.cameraBlockedSub}>Bấm “Cấp quyền” để bật camera và chụp ảnh.</Text>
                <Pressable style={styles.captureButton} onPress={async () => await requestCameraPerm()} disabled={submitting}>
                  <Text style={[styles.captureButtonText, { color: c.text }]}>Cấp quyền</Text>
                </Pressable>
              </View>
            )}
          </View>
        </Card>

        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: c.text }]}>Thiết bị chấm công</Text>
            <Text style={[styles.cardHint, { color: c.textMuted }]}>Kết nối thiết bị để lấy dự án.</Text>
          </View>
          <View style={styles.kv}>
            <Text style={[styles.k, { color: c.textMuted }]}>Dự án</Text>
            <Text style={[styles.v, { color: c.text }]}>{projectLoading ? 'Đang tải...' : project?.name || projectId || '—'}</Text>
          </View>

          <View style={styles.row}>
            <Button
              title={btConnecting ? 'Đang kết nối...' : 'Kết nối thiết bị '}
              onPress={connectBtAndLoadProject}
              loading={btConnecting}
              disabled={submitting}
              style={styles.flex1 as any}
            />
            <Button title="Ngắt" variant="secondary" onPress={resetBt} disabled={btConnecting || submitting} />
          </View>
        </Card>

        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: c.text }]}>Chấm công</Text>
            <Text style={[styles.cardHint, { color: c.textMuted }]}>Kiểm tra ảnh + thiết bị trước khi bấm.</Text>
          </View>

          <View style={styles.kv}>
            <Text style={[styles.k, { color: c.textMuted }]}>Hôm nay</Text>
            <Text style={[styles.v, { color: c.text }]}>{todayCountsLoading ? 'Đang tải...' : `Vào: ${todayInCount} • Ra: ${todayOutCount}`}</Text>
          </View>

          <Button
            title={nextActionType === 'in' ? 'Chấm vào' : 'Chấm ra'}
            onPress={() => startSubmit(nextActionType)}
            loading={submitting}
            disabled={todayCountsLoading || !(photoUri && projectId)}
          />
          {!photoUri || !projectId ? (
            <Text style={[styles.helperText, { color: c.textMuted }]}>
              {!photoUri ? '• Cần chụp ảnh xác thực.' : ''} {!projectId ? '• Cần kết nối Bluetooth để xác định dự án.' : ''}
            </Text>
          ) : null}
        </Card>
        </ScrollView>

      <Modal transparent visible={explainOpen} animationType="fade" onRequestClose={() => setExplainOpen(false)}>
        <View style={[styles.modalBackdrop, { paddingBottom: Math.max(20, insets.bottom + 12), paddingTop: Math.max(20, insets.top + 12) }]}>
          <View style={[styles.modalCard, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[styles.modalTitle, { color: c.text }]}>Yêu cầu giải trình</Text>
            <Text style={[styles.modalSubtitle, { color: c.textMuted }]}>Vui lòng nhập lý do.</Text>
            <Input
              style={styles.textArea}
              multiline
              placeholder="Nhập lý do..."
              value={explanation}
              onChangeText={setExplanation}
              editable={!submitting}
              variant="multiline"
            />
            <View style={styles.row}>
              <Button title="Hủy" variant="secondary" onPress={() => setExplainOpen(false)} disabled={submitting} />
              <Button title="Gửi" onPress={() => finalizeSubmit(pendingType, explanation)} disabled={!explanation.trim()} loading={submitting} style={styles.flex1 as any} />
            </View>
          </View>
        </View>
      </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  header: { gap: 6, paddingHorizontal: 2, paddingBottom: 4 },
  title: { ...Typography.title, fontSize: 24, letterSpacing: -0.3 },
  subtitle: { fontSize: 13, fontWeight: '700' },

  card: {
    padding: 14,
    gap: 12,
  },
  cardHeader: { gap: 2 },
  cardTitle: { ...Typography.h2 },
  cardHint: { ...Typography.caption },

  cameraWrap: { height: 320, borderRadius: Radii.lg, overflow: 'hidden' },
  camera: { flex: 1 },
  cameraBlocked: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 16 },
  cameraBlockedTitle: { color: 'white', fontSize: 16, fontWeight: '900', textAlign: 'center' },
  cameraBlockedSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '700', textAlign: 'center' },

  cameraControls: { position: 'absolute', left: 12, right: 12, bottom: 12 },
  captureButton: { height: 48, borderRadius: Radii.md, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  captureButtonText: { fontSize: 16, fontWeight: '900' },

  photoPreview: { flex: 1 },
  photo: { width: '100%', height: '100%' },
  photoFrontFix: { transform: [{ scaleX: -1 }] },
  photoOverlay: { position: 'absolute', left: 12, right: 12, bottom: 12, gap: 8 },
  photoOverlayText: { color: 'white', fontSize: 14, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  ghostButton: { height: 44, borderRadius: Radii.md, backgroundColor: 'rgba(2, 6, 23, 0.65)', borderWidth: 0 },
  ghostButtonText: { color: 'white', fontSize: 14, fontWeight: '900' },

  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  kv: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'center' },
  k: { ...Typography.label },
  v: { fontSize: 12, fontWeight: '800', flexShrink: 1, textAlign: 'right' },
  vMono: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    flexShrink: 1,
    textAlign: 'right',
  },

  flex1: { flex: 1 },
  helperText: { marginTop: 6, ...Typography.caption },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', paddingHorizontal: 20 },
  modalCard: { borderRadius: Radii.lg, padding: 16, gap: 10, elevation: 4, borderWidth: StyleSheet.hairlineWidth },
  modalTitle: { ...Typography.h2 },
  modalSubtitle: { ...Typography.caption, fontWeight: '700' },
  textArea: {},
});

