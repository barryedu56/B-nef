import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import type { PartyKind } from '@/api/types';
import { Button } from './ui/Button';
import { useCreateParty, useParties } from '@/hooks/useParties';
import { isValidGuineaPhone, normalizeGuineaPhone } from '@/lib/phone';
import { colors, fontSize, radius, spacing } from '@/theme';

interface PartyPickerProps {
  label: string;
  kind: PartyKind;
  value: string | null;
  onChange: (value: string) => void;
}

export function PartyPicker({ label, kind, value, onChange }: PartyPickerProps) {
  const parties = useParties(kind);
  const createParty = useCreateParty();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  const selected = (parties.data ?? []).find((p) => String(p.id) === value);

  const onCreate = async () => {
    if (!newName.trim()) return;
    if (newPhone && !isValidGuineaPhone(newPhone)) {
      setAddError('Numéro invalide : 9 chiffres, en commençant par 61, 62, 65 ou 66.');
      return;
    }
    setAddError(null);
    try {
      const party = await createParty.mutateAsync({ name: newName.trim(), phone: newPhone, kind });
      setNewName('');
      setNewPhone('');
      onChange(String(party.id));
      setOpen(false);
    } catch (e) {
      setAddError(e instanceof ApiError ? e.message : "Impossible d'ajouter ce tiers.");
    }
  };

  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={styles.field}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.valueRow}>
          <Text style={[styles.value, !selected && styles.placeholder]} numberOfLines={1}>
            {selected ? selected.name : 'Choisir…'}
          </Text>
          <Ionicons name="chevron-down" size={16} color={colors.textTertiary} />
        </View>
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <SafeAreaView edges={['bottom']} style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{label}</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.addBlock}>
              <Text style={styles.addLabel}>Ajouter un nouveau tiers (facultatif : nom et numéro)</Text>
              <View style={styles.addRow}>
                <TextInput
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="Nom"
                  placeholderTextColor={colors.textTertiary}
                  style={[styles.addInput, { flex: 1 }]}
                />
                <TextInput
                  value={newPhone}
                  onChangeText={(text) => setNewPhone(normalizeGuineaPhone(text).slice(0, 9))}
                  placeholder="Numéro (ex. 622123456)"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="phone-pad"
                  style={[styles.addInput, { flex: 1 }]}
                />
              </View>
              {addError ? <Text style={styles.addError}>{addError}</Text> : null}
              <Button
                label="Ajouter ce tiers"
                variant="secondary"
                onPress={onCreate}
                disabled={!newName.trim()}
                loading={createParty.isPending}
              />
            </View>

            <FlatList
              data={parties.data ?? []}
              keyExtractor={(item) => String(item.id)}
              style={styles.list}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              ListEmptyComponent={<Text style={styles.empty}>Aucun tiers pour l’instant — ajoute-en un ci-dessus.</Text>}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.option}
                  onPress={() => {
                    onChange(String(item.id));
                    setOpen(false);
                  }}>
                  <Text style={styles.optionLabel}>{item.name}</Text>
                  {String(item.id) === value ? <Ionicons name="checkmark" size={18} color={colors.accent} /> : null}
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
  label: { fontSize: fontSize.xs, color: colors.textSecondary },
  valueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  value: { fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary, flexShrink: 1 },
  placeholder: { color: colors.textTertiary, fontWeight: '400' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, maxHeight: '75%' },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textPrimary },
  addBlock: {
    padding: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  addLabel: { fontSize: fontSize.xs, color: colors.textSecondary },
  addError: { fontSize: fontSize.xs, color: colors.negative },
  addRow: { flexDirection: 'row', gap: spacing.sm },
  addInput: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },
  list: { paddingHorizontal: spacing.lg },
  separator: { height: 1, backgroundColor: colors.border },
  empty: { padding: spacing.lg, color: colors.textTertiary, textAlign: 'center' },
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md },
  optionLabel: { fontSize: fontSize.md, color: colors.textPrimary },
});
