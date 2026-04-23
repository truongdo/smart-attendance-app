import { StyleSheet, View, type ViewProps } from 'react-native';

import { Colors, Radii } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type CardProps = ViewProps & {
  variant?: 'default' | 'flat';
};

export function Card({ style, variant = 'default', ...rest }: CardProps) {
  const scheme = useColorScheme();
  const c = Colors[scheme];

  return <View style={[styles.base, { backgroundColor: c.surface, borderColor: c.border }, variant === 'default' ? styles.raised : null, style]} {...rest} />;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  raised: {
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
});

