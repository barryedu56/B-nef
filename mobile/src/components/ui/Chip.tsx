import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, radius, spacing } from '@/theme';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  tone?: 'default' | 'warning' | 'negative';
}

export function Chip({ label, selected, onPress, tone = 'default' }: ChipProps) {
  const content = (
    <View style={[styles.chip, selected ? styles.selected : toneStyle(tone)]}>
      <Text style={[styles.label, selected ? styles.selectedLabel : toneLabel(tone)]}>{label}</Text>
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} hitSlop={4}>
      {content}
    </Pressable>
  );
}

function toneStyle(tone: ChipProps['tone']) {
  if (tone === 'warning') return { borderColor: colors.warning };
  if (tone === 'negative') return { borderColor: colors.negative };
  return { borderColor: colors.borderStrong };
}

function toneLabel(tone: ChipProps['tone']) {
  if (tone === 'warning') return { color: colors.warning };
  if (tone === 'negative') return { color: colors.negative };
  return { color: colors.textPrimary };
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: 7,
    paddingHorizontal: spacing.md,
  },
  selected: { backgroundColor: colors.accent, borderColor: colors.accent },
  label: { fontSize: fontSize.sm, fontWeight: '500' },
  selectedLabel: { color: colors.white, fontWeight: '600' },
});
