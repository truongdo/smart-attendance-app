import { makeRedirectUri } from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Colors, Typography } from '@/constants/theme';
import { auth } from '@/lib/firebase';
import { useAuthStore } from '@/stores/authStore';
import { useColorScheme } from '@/hooks/use-color-scheme';

WebBrowser.maybeCompleteAuthSession();

type Extra = {
  googleAuth?: {
    expoClientId?: string;
    iosClientId?: string;
    androidClientId?: string;
    webClientId?: string;
  };
};

function getExtra(): Extra {
  const extra = (Constants.expoConfig?.extra ?? {}) as any;
  return extra as Extra;
}

function getGoogleIosRedirectScheme(iosClientId?: string) {
  if (!iosClientId) return undefined;
  const suffix = '.apps.googleusercontent.com';
  if (!iosClientId.endsWith(suffix)) return undefined;
  const prefix = iosClientId.slice(0, -suffix.length);
  return `com.googleusercontent.apps.${prefix}`;
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { user, loading } = useAuthStore();
  const extra = useMemo(() => getExtra(), []);
  const [signingIn, setSigningIn] = useState(false);
  const scheme = useColorScheme();
  const c = Colors[scheme];

  const googleClientId = useMemo(() => {
    if (Platform.OS === 'ios') return extra.googleAuth?.iosClientId;
    if (Platform.OS === 'android') return extra.googleAuth?.androidClientId;
    return extra.googleAuth?.webClientId ?? extra.googleAuth?.expoClientId;
  }, [extra.googleAuth?.androidClientId, extra.googleAuth?.expoClientId, extra.googleAuth?.iosClientId, extra.googleAuth?.webClientId]);

  const redirectUri = useMemo(() => {
    const iosScheme = getGoogleIosRedirectScheme(extra.googleAuth?.iosClientId);
    const scheme = Platform.OS === 'ios' && iosScheme ? iosScheme : 'smartattendance';
    return makeRedirectUri({ scheme });
  }, [extra.googleAuth?.iosClientId]);

  const [, response, promptAsync] = Google.useAuthRequest({
    clientId: googleClientId,
    redirectUri,
  });

  useEffect(() => {
    const run = async () => {
      if (response?.type !== 'success') return;
      setSigningIn(true);
      try {
        const idToken = response.authentication?.idToken;
        if (!idToken) throw new Error('Missing Google idToken. Check your OAuth client IDs in app.json extra.googleAuth.*');
        const credential = GoogleAuthProvider.credential(idToken);
        await signInWithCredential(auth, credential);
      } finally {
        setSigningIn(false);
      }
    };
    void run();
  }, [response]);

  const disabled = loading || signingIn || !!user;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: c.bg }]} edges={['top', 'bottom', 'left', 'right']}>
      <View style={[styles.container, { paddingBottom: Math.max(20, insets.bottom + 12), backgroundColor: c.bg }]}>
        <Card>
          <Text style={[styles.title, { color: c.text }]}>SmartAttendance</Text>
          <Text style={[styles.subtitle, { color: c.textMuted }]}>Đăng nhập để chấm công</Text>

          <Button title={signingIn ? 'Đang đăng nhập...' : 'Đăng nhập với Google'} onPress={() => promptAsync()} disabled={disabled} />

          {/* <Text style={styles.hint}>
            Cần cấu hình OAuth Client IDs trong <Text style={styles.mono}>app.json</Text> →{' '}
            <Text style={styles.mono}>expo.extra.googleAuth</Text>.
          </Text> */}
        </Card>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  title: {
    ...Typography.title,
    fontSize: 30,
    letterSpacing: -0.6,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 16,
  },
  hint: {
    marginTop: 12,
    fontSize: 12,
    color: '#475569',
    lineHeight: 16,
  },
});

