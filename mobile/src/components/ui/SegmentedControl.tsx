import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, radius } from '@/theme';

interface Option<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({ options, value, onChange }: SegmentedControlProps<T>) {
  return (
    <View style={styles.track}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable key={opt.value} style={[styles.segment, active && styles.segmentActive]} onPress={() => onChange(opt.value)}>
            <Text style={[styles.label, active && styles.labelActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', backgroundColor: '#f0f0ee', borderRadius: radius.md, padding: 3 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: radius.sm },
  segmentActive: {
    backgroundColor: colors.card,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  label: { fontSize: fontSize.sm, color: colors.textSecondary },
  labelActive: { color: colors.textPrimary, fontWeight: '600' },
});
