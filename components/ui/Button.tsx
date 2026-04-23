import { ActivityIndicator, Pressable, StyleSheet, Text, View, type PressableProps, type TextStyle, type ViewStyle } from 'react-native';

import { Colors, Radii, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type ButtonProps = PressableProps & {
  variant?: 'primary' | 'secondary' | 'ghost';
  title: string;
  loading?: boolean;
  left?: React.ReactNode;
  textStyle?: TextStyle;
};

export function Button({ variant = 'primary', title, loading, disabled, style, textStyle, left, ...rest }: ButtonProps) {
  const scheme = useColorScheme();
  const c = Colors[scheme];
  const isDisabled = disabled || loading;

  const bg: ViewStyle['backgroundColor'] =
    variant === 'primary' ? c.primary : variant === 'secondary' ? c.surface2 : 'transparent';
  const borderColor: ViewStyle['borderColor'] = variant === 'ghost' ? 'transparent' : c.border;
  const textColor: TextStyle['color'] = variant === 'primary' ? c.primaryText : c.text;

  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: bg, borderColor },
        pressed && !isDisabled ? styles.pressed : null,
        isDisabled ? styles.disabled : null,
        style as any,
      ]}
      disabled={isDisabled}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? c.primaryText : c.text} />
      ) : (
        <>
          {left ? <View style={styles.left}>{left}</View> : null}
          <Text style={[styles.text, { color: textColor }, textStyle]} numberOfLines={1}>
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 48,
    borderRadius: Radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
  },
  text: {
    ...Typography.body,
    fontWeight: '800',
  },
  left: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    transform: [{ scale: 0.99 }],
    opacity: 0.96,
  },
  disabled: {
    opacity: 0.55,
  },
});

