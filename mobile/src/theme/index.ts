import { Platform, type ViewStyle } from 'react-native';

// Même identité que l'app web : indigo du logo, surfaces claires, ombres douces.
export const colors = {
  bg: '#f5f6fb',
  card: '#ffffff',
  border: '#e7e8f0',
  borderStrong: '#d6d8e4',
  placeholder: '#eceef6',
  textPrimary: '#161827',
  textSecondary: '#5c6078',
  textTertiary: '#9195ab',
  accent: '#4f46e5',
  accentDark: '#3730a3',
  accentSoft: '#eef0ff',
  accentInk: '#1e1b4b',
  violet: '#6d28d9',
  positive: '#0f8a4a',
  positiveSoft: '#e7f7ee',
  negative: '#c42727',
  negativeSoft: '#fdecec',
  warning: '#b45309',
  warningSoft: '#fdf3e2',
  info: '#1d5fd1',
  infoSoft: '#e8f1fe',
  white: '#ffffff',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
};

export const fontSize = {
  xs: 11.5,
  sm: 13,
  md: 14.5,
  lg: 16,
  xl: 19,
  xxl: 24,
  xxxl: 28,
};

export const touchable = {
  minHeight: 48,
};

/** Ombres douces (iOS : shadow*, Android : elevation, web : boxShadow). */
export const shadow: Record<'sm' | 'md' | 'accent', ViewStyle> = {
  sm: Platform.select({
    web: { boxShadow: '0 1px 2px rgba(22,24,39,0.06)' } as ViewStyle,
    default: { shadowColor: '#161827', shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  })!,
  md: Platform.select({
    web: { boxShadow: '0 4px 14px rgba(22,24,39,0.08)' } as ViewStyle,
    default: { shadowColor: '#161827', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  })!,
  accent: Platform.select({
    web: { boxShadow: '0 8px 22px rgba(79,70,229,0.32)' } as ViewStyle,
    default: { shadowColor: '#4f46e5', shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  })!,
};
