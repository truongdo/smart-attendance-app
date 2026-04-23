import type { Theme } from '@react-navigation/native';

import { Colors } from '@/constants/theme';

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
    regular: { fontFamily: 'Inter_400Regular', fontWeight: 'normal' },
    medium: { fontFamily: 'Inter_600SemiBold', fontWeight: 'normal' },
    bold: { fontFamily: 'Inter_700Bold', fontWeight: 'normal' },
    heavy: { fontFamily: 'Inter_900Black', fontWeight: 'normal' },
  },
};

