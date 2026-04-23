import { Platform } from 'react-native';

/**
 * App design tokens.
 *
 * This project currently targets a modern light UI. Keep tokens semantic so screens/components
 * can stay consistent and easy to refactor later.
 */

const blue600 = '#2563EB';
const slate950 = '#0B1220';
const slate700 = '#475569';

export const Colors = {
  light: {
    // Core
    bg: '#F7F9FC',
    // Backwards-compatible alias for older components
    background: '#F7F9FC',
    surface: '#FFFFFF',
    surface2: '#F1F5F9',
    text: slate950,
    textMuted: slate700,
    border: 'rgba(2, 6, 23, 0.08)',

    // Brand
    primary: blue600,
    primaryText: '#FFFFFF',

    // Semantic
    success: '#16A34A',
    warning: '#F97316',
    danger: '#DC2626',
    info: '#0EA5E9',

    // Tab bar (kept for existing usage)
    tint: blue600,
    icon: slate700,
    tabIconDefault: slate700,
    tabIconSelected: blue600,

    // Shadows
    shadowColor: '#000000',
  },
  // Light-only: keep dark keys to avoid refactors in template components.
  dark: {
    bg: '#F7F9FC',
    background: '#F7F9FC',
    surface: '#FFFFFF',
    surface2: '#F1F5F9',
    text: slate950,
    textMuted: slate700,
    border: 'rgba(2, 6, 23, 0.08)',
    primary: blue600,
    primaryText: '#FFFFFF',
    success: '#16A34A',
    warning: '#F97316',
    danger: '#DC2626',
    info: '#0EA5E9',
    tint: blue600,
    icon: slate700,
    tabIconDefault: slate700,
    tabIconSelected: blue600,
    shadowColor: '#000000',
  },
} as const;

export const Radii = {
  sm: 10,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const Space = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
} as const;

export const Typography = {
  title: { fontSize: 26, letterSpacing: -0.4, fontFamily: 'Inter_900Black' as const },
  h2: { fontSize: 18, letterSpacing: -0.2, fontFamily: 'Inter_800ExtraBold' as const },
  label: { fontSize: 12, letterSpacing: 0.1, fontFamily: 'Inter_700Bold' as const },
  body: { fontSize: 14, fontFamily: 'Inter_600SemiBold' as const },
  caption: { fontSize: 12, fontFamily: 'Inter_600SemiBold' as const },
} as const;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
