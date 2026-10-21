import { useMemo } from 'react';
import { useColorScheme } from 'react-native';

export const lightColors = {
  clay: '#E8552D',
  clayDark: '#B8401C',
  ink: '#141414',
  paper: '#F6F4F0',
  line: '#E2DDD3',
  muted: '#6F6A63',
  soft: '#FFFFFF',
  elevated: '#FFFDF9',
  onAccent: '#FFFFFF',
  accentFill: '#B8401C',
  error: '#A32D22',
  tint: '#FFF1E8',
  tintLine: '#E9BCAB',
  success: '#2E6E32',
  successSurface: '#F3F8EF',
  successLine: '#CFE3C6',
  errorSurface: '#FFF1F1',
  errorLine: '#E7B4B4',
  overlay: 'rgba(20,20,20,0.38)',
  edge: '#FFFFFF'
};
export type ThemeColors = typeof lightColors;

export const darkColors: ThemeColors = {
  clay: '#F07851',
  clayDark: '#FF9C7D',
  ink: '#F6F4F0',
  paper: '#101010',
  line: '#34322F',
  muted: '#B1ABA3',
  soft: '#1B1A19',
  elevated: '#22201E',
  onAccent: '#FFFFFF',
  accentFill: '#B8401C',
  error: '#FFAAA1',
  tint: '#2F211B',
  tintLine: '#734737',
  success: '#A0D6A2',
  successSurface: '#1D2A1E',
  successLine: '#3D5A3D',
  errorSurface: '#331D1D',
  errorLine: '#74433F',
  overlay: 'rgba(0,0,0,0.65)',
  edge: '#4B4540'
};

export function useTheme() {
  const isDark = useColorScheme() === 'dark';
  return { colors: isDark ? darkColors : lightColors, isDark };
}

/** Rebuild a component's styles only when the system appearance changes. */
export function useThemedStyles<T>(factory: (colors: ThemeColors) => T): T {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [colors, factory]);
}
