import { StyleSheet, Text, View, type ViewProps } from 'react-native';

import { Colors, Radii, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type BadgeProps = ViewProps & {
  tone?: 'neutral' | 'success' | 'warning' | 'info';
  label: string;
};

export function Badge({ tone = 'neutral', label, style, ...rest }: BadgeProps) {
  const scheme = useColorScheme();
  const c = Colors[scheme];

  const bg =
    tone === 'success'
      ? 'rgba(22, 163, 74, 0.14)'
      : tone === 'warning'
        ? 'rgba(249, 115, 22, 0.14)'
        : tone === 'info'
          ? 'rgba(14, 165, 233, 0.14)'
          : 'rgba(2, 6, 23, 0.06)';

  const fg = tone === 'success' ? c.success : tone === 'warning' ? c.warning : tone === 'info' ? c.info : c.text;

  return (
    <View style={[styles.base, { backgroundColor: bg }, style]} {...rest}>
      <Text style={[styles.text, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.pill,
  },
  text: {
    ...Typography.caption,
    fontWeight: '900',
  },
});

