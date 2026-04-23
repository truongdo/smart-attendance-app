import { makeRedirectUri } from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>SmartAttendance</Text>
        <Text style={styles.subtitle}>Đăng nhập để chấm công</Text>

        <Pressable
          style={({ pressed }) => [styles.button, pressed && !disabled ? styles.buttonPressed : null, disabled ? styles.buttonDisabled : null]}
          onPress={() => promptAsync()}
          disabled={disabled}
        >
          <Text style={styles.buttonText}>{signingIn ? 'Đang đăng nhập...' : 'Đăng nhập với Google'}</Text>
        </Pressable>

        <Text style={styles.hint}>
          Cần cấu hình OAuth Client IDs trong <Text style={styles.mono}>app.json</Text> → <Text style={styles.mono}>expo.extra.googleAuth</Text>.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#F4F4F5',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: '#111827',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  button: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonPressed: {
    transform: [{ scale: 0.99 }],
    opacity: 0.95,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  hint: {
    marginTop: 12,
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 16,
  },
  mono: {
    fontFamily: 'Courier',
  },
});

