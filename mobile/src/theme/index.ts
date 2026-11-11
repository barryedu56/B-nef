import { Platform, type ViewStyle } from 'react-native';

// Identité « marché chaleureux » : fond crème, orange terre, vert pour
// l'argent qui entre, rouge pour celui qui sort. Contrastes ≥ 4.5:1 sur
// crème et blanc pour les textes.
export const colors = {
  bg: '#fbf6ee',
  card: '#ffffff',
  border: '#efe3d3',
  borderStrong: '#e2d2bd',
  placeholder: '#f6ead9',
  textPrimary: '#2b1d12',
  textSecondary: '#6b5442',
  textTertiary: '#7d6754',
  accent: '#c2410c',
  accentDark: '#8a3008',
  accentSoft: '#fde4d2',
  accentInk: '#2b1d12',
  violet: '#9a3412',
  positive: '#166534',
  positiveSoft: '#e3f4e8',
  negative: '#b91c1c',
  negativeSoft: '#fbe6e3',
  warning: '#a16207',
  warningSoft: '#fdecd3',
  info: '#1d4ed8',
  infoSoft: '#e5edfd',
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
  sm: 10,
  md: 14,
  lg: 20,
  xl: 26,
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
    web: { boxShadow: '0 1px 2px rgba(120,72,30,0.07)' } as ViewStyle,
    default: { shadowColor: '#78481e', shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  })!,
  md: Platform.select({
    web: { boxShadow: '0 4px 14px rgba(120,72,30,0.10)' } as ViewStyle,
    default: { shadowColor: '#78481e', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  })!,
  accent: Platform.select({
    web: { boxShadow: '0 8px 22px rgba(194,65,12,0.28)' } as ViewStyle,
    default: { shadowColor: '#c2410c', shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  })!,
};
