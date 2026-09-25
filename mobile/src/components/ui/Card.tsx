import { type ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { colors, radius, spacing } from '@/theme';

interface CardProps {
  children: ReactNode;
  style?: ViewStyle;
  tone?: 'default' | 'muted' | 'dashed';
  padding?: number;
}

export function Card({ children, style, tone = 'default', padding = spacing.lg }: CardProps) {
  return <View style={[styles.base, toneStyle(tone), { padding }, style]}>{children}</View>;
}

function toneStyle(tone: CardProps['tone']): ViewStyle {
  if (tone === 'muted') return { backgroundColor: colors.bg, borderWidth: 0 };
  if (tone === 'dashed') return { borderStyle: 'dashed', borderColor: colors.borderStrong };
  return { backgroundColor: colors.card, borderColor: colors.border };
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    borderWidth: 1,
  },
});
