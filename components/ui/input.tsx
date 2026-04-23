import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { Colors, Radii, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type InputProps = TextInputProps & {
  variant?: 'default' | 'multiline';
};

export function Input({ style, variant = 'default', ...rest }: InputProps) {
  const scheme = useColorScheme();
  const c = Colors[scheme];

  return (
    <TextInput
      placeholderTextColor={c.textMuted}
      style={[
        styles.base,
        { borderColor: c.border, color: c.text, backgroundColor: c.surface },
        variant === 'multiline' ? styles.multiline : null,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    ...Typography.body,
    borderWidth: 1,
    borderRadius: Radii.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  multiline: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
});

