import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, PermissionsAndroid, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, where } from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { useAuthStore } from '@/stores/authStore';
import type { Project } from '@/types';
import { formatDateYmd, needsExplanation } from '@/lib/attendance';
import { uploadImageFromUri } from '@/lib/storage/upload';
import { connectAndDiscover, requestDeviceMac, scanAndConnectFirst } from '@/lib/ble/attendanceDevice';

type NextType = 'in' | 'out';

export default function AttendanceScreen() {
  const { profile } = useAuthStore();
  const managerRef = useRef<any>(null);

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
        err ? reject(err) : resolve();
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
    const photo = await cam.takePictureAsync({ quality: 0.95, exif: false, skipProcessing: true });
    setPhotoUri(photo.uri);
  };

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
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1) Ảnh xác thực</Text>
        <View style={styles.cameraWrap}>
          {photoUri ? (
            <View style={styles.photoTaken}>
              <Text style={styles.photoTakenText}>Đã chụp ảnh</Text>
              <Pressable style={styles.smallButton} onPress={() => setPhotoUri(null)} disabled={submitting}>
                <Text style={styles.smallButtonText}>Chụp lại</Text>
              </Pressable>
            </View>
          ) : cameraPerm?.granted ? (
            <CameraView ref={cameraRef as any} style={styles.camera} facing="front" />
          ) : (
            <View style={styles.cameraBlocked}>
              <Text style={styles.cameraBlockedTitle}>Cần quyền Camera</Text>
              <Text style={styles.cameraBlockedSub}>Bấm “Cấp quyền” để bật camera.</Text>
              <Pressable
                style={styles.smallButton}
                onPress={async () => {
                  await requestCameraPerm();
                }}
                disabled={submitting}
              >
                <Text style={styles.smallButtonText}>Cấp quyền</Text>
              </Pressable>
            </View>
          )}
        </View>
        {!photoUri && cameraPerm?.granted ? (
          <Pressable style={styles.primaryButton} onPress={capture} disabled={submitting}>
            <Text style={styles.primaryButtonText}>Chụp ảnh</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>2) Thiết bị chấm công</Text>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Trạng thái</Text>
          <Text style={styles.value}>{btConnectedName ? `Đã kết nối: ${btConnectedName}` : 'Chưa kết nối'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>MAC</Text>
          <Text style={styles.valueMono}>{deviceMac || '—'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Dự án</Text>
          <Text style={styles.value}>{projectLoading ? 'Đang tải...' : project?.name || '—'}</Text>
        </View>

        <View style={styles.row}>
          <Pressable style={styles.primaryButton} onPress={connectBtAndLoadProject} disabled={btConnecting || submitting}>
            <Text style={styles.primaryButtonText}>{btConnecting ? 'Đang kết nối...' : 'Kết nối Bluetooth'}</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={resetBt} disabled={btConnecting || submitting}>
            <Text style={styles.secondaryButtonText}>Ngắt</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>3) Chấm công</Text>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Hôm nay</Text>
          <Text style={styles.value}>{todayCountsLoading ? 'Đang tải...' : `Vào: ${todayInCount} • Ra: ${todayOutCount}`}</Text>
        </View>
        <Pressable
          style={[styles.primaryButton, !(photoUri && projectId) ? styles.buttonDisabled : null]}
          onPress={() => startSubmit(nextActionType)}
          disabled={submitting || todayCountsLoading || !(photoUri && projectId)}
        >
          {submitting ? <ActivityIndicator color="white" /> : <Text style={styles.primaryButtonText}>{nextActionType === 'in' ? 'Chấm vào' : 'Chấm ra'}</Text>}
        </Pressable>
      </View>

      <Modal transparent visible={explainOpen} animationType="fade" onRequestClose={() => setExplainOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Yêu cầu giải trình</Text>
            <Text style={styles.modalSubtitle}>Vui lòng nhập lý do.</Text>
            <TextInput
              style={styles.textArea}
              multiline
              placeholder="Nhập lý do..."
              value={explanation}
              onChangeText={setExplanation}
              editable={!submitting}
            />
            <View style={styles.row}>
              <Pressable style={styles.secondaryButton} onPress={() => setExplainOpen(false)} disabled={submitting}>
                <Text style={styles.secondaryButtonText}>Hủy</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryButton, !explanation.trim() ? styles.buttonDisabled : null]}
                disabled={submitting || !explanation.trim()}
                onPress={() => finalizeSubmit(pendingType, explanation)}
              >
                {submitting ? <ActivityIndicator color="white" /> : <Text style={styles.primaryButtonText}>Gửi</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#F4F4F5', gap: 12 },
  section: { backgroundColor: 'white', borderRadius: 16, padding: 14, gap: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  cameraWrap: { height: 260, borderRadius: 14, overflow: 'hidden', backgroundColor: '#111827' },
  camera: { flex: 1 },
  cameraBlocked: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 16 },
  cameraBlockedTitle: { color: 'white', fontSize: 16, fontWeight: '900', textAlign: 'center' },
  cameraBlockedSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  photoTaken: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  photoTakenText: { color: 'white', fontSize: 16, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  label: { color: '#6B7280', fontSize: 12, fontWeight: '700' },
  value: { color: '#111827', fontSize: 12, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  valueMono: { color: '#111827', fontSize: 12, fontWeight: '700', fontFamily: 'Courier', flexShrink: 1, textAlign: 'right' },
  primaryButton: { flex: 1, height: 48, borderRadius: 12, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: 'white', fontSize: 16, fontWeight: '800' },
  secondaryButton: { height: 48, paddingHorizontal: 16, borderRadius: 12, backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: '#111827', fontSize: 14, fontWeight: '800' },
  smallButton: { height: 40, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  smallButtonText: { color: '#111827', fontSize: 14, fontWeight: '800' },
  buttonDisabled: { opacity: 0.5 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: 'white', borderRadius: 16, padding: 16, gap: 10 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#111827' },
  modalSubtitle: { fontSize: 12, color: '#6B7280' },
  textArea: { minHeight: 100, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', padding: 10, fontSize: 14, color: '#111827' },
});

