import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fontSize, radius, spacing } from '@/theme';

export interface PickerOption {
  value: string;
  label: string;
  description?: string;
}

interface PickerFieldProps {
  label: string;
  placeholder?: string;
  value: string | null;
  options: PickerOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function PickerField({ label, placeholder = 'Choisir…', value, options, onChange, disabled }: PickerFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <>
      <Pressable
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[styles.field, disabled && styles.fieldDisabled]}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.valueRow}>
          <Text style={[styles.value, !selected && styles.placeholder]} numberOfLines={1}>
            {selected ? selected.label : placeholder}
          </Text>
          {!disabled ? <Ionicons name="chevron-down" size={16} color={colors.textTertiary} /> : null}
        </View>
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <SafeAreaView edges={['bottom']} style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{label}</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              style={styles.list}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              ListEmptyComponent={<Text style={styles.empty}>Aucune option disponible.</Text>}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.option}
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}>
                  <View style={styles.optionText}>
                    <Text style={styles.optionLabel}>{item.label}</Text>
                    {item.description ? <Text style={styles.optionDescription}>{item.description}</Text> : null}
                  </View>
                  {item.value === value ? <Ionicons name="checkmark" size={18} color={colors.accent} /> : null}
                </Pressable>
              )}
            />
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    backgroundColor: colors.card,
    gap: 2,
  },
  fieldDisabled: { opacity: 0.6 },
  label: { fontSize: fontSize.xs, color: colors.textSecondary },
  valueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  value: { fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary, flexShrink: 1 },
  placeholder: { color: colors.textTertiary, fontWeight: '400' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: '75%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textPrimary },
  list: { paddingHorizontal: spacing.lg },
  separator: { height: 1, backgroundColor: colors.border },
  empty: { padding: spacing.lg, color: colors.textTertiary, textAlign: 'center' },
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md, gap: spacing.sm },
  optionText: { flex: 1 },
  optionLabel: { fontSize: fontSize.md, color: colors.textPrimary },
  optionDescription: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: 2 },
});
