import type { Theme } from '@react-navigation/native';
import { Platform } from 'react-native';

import { Colors } from '@/constants/theme';

const systemFont = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' });

export const NavigationThemeLight: Theme = {
  dark: false,
  colors: {
    primary: Colors.light.primary,
    background: Colors.light.bg,
    card: Colors.light.surface,
    text: Colors.light.text,
    border: Colors.light.border,
    notification: Colors.light.primary,
  },
  fonts: {
    regular: { fontFamily: systemFont, fontWeight: '400' },
    medium: { fontFamily: systemFont, fontWeight: '500' },
    bold: { fontFamily: systemFont, fontWeight: '700' },
    heavy: { fontFamily: systemFont, fontWeight: '800' },
  },
};

