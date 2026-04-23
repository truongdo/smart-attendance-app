import { makeRedirectUri } from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { auth } from '@/lib/firebase';
import { useAuthStore } from '@/stores/authStore';

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
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <View style={[styles.container, { paddingBottom: Math.max(20, insets.bottom + 12) }]}>
        <View style={styles.card}>
          <Text style={styles.title}>SmartAttendance</Text>
          <Text style={styles.subtitle}>Đăng nhập để chấm công</Text>

          <Button
            className={disabled ? 'opacity-55' : 'active:opacity-95'}
            style={styles.button}
            onPress={() => promptAsync()}
            disabled={disabled}
          >
            <Text style={styles.buttonText}>{signingIn ? 'Đang đăng nhập...' : 'Đăng nhập với Google'}</Text>
          </Button>

          {/* <Text style={styles.hint}>
            Cần cấu hình OAuth Client IDs trong <Text style={styles.mono}>app.json</Text> →{' '}
            <Text style={styles.mono}>expo.extra.googleAuth</Text>.
          </Text> */}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F6F7FB' },
  container: { flex: 1, padding: 20, justifyContent: 'center', backgroundColor: '#F6F7FB' },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15, 23, 42, 0.06)',
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.6,
    color: '#0F172A',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 16,
  },
  button: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '800',
  },
  hint: {
    marginTop: 12,
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
  mono: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
});

