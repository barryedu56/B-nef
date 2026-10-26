import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ApiError } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LoadingView } from '@/components/ui/QueryState';
import { Screen } from '@/components/ui/Screen';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { TopBar } from '@/components/ui/TopBar';
import { useCategoryMutations, usePaymentMethodMutations } from '@/hooks/useSettingsLists';
import { useCategories, usePaymentMethods } from '@/hooks/useTransactions';
import { colors, fontSize, radius, spacing } from '@/theme';

type Tab = 'out' | 'in' | 'payment';

interface Item {
  id: number;
  name: string;
}

/** Catégories (dépenses / entrées) et moyens de paiement : ajouter,
 * renommer, supprimer. Le serveur refuse de supprimer un élément déjà
 * utilisé (l'historique perdrait son libellé) et explique de le renommer. */
export default function CategoriesScreen() {
  const [tab, setTab] = useState<Tab>('out');
  const categories = useCategories(undefined, tab === 'payment' ? undefined : tab);
  const methods = usePaymentMethods();
  const categoryOps = useCategoryMutations();
  const methodOps = usePaymentMethodMutations();

  const isPayment = tab === 'payment';
  const query = isPayment ? methods : categories;
  const items: Item[] = (query.data ?? []).map((x) => ({ id: x.id, name: x.name }));

  const actions = {
    add: (name: string) =>
      isPayment ? methodOps.create.mutateAsync({ name }) : categoryOps.create.mutateAsync({ name, direction: tab as 'in' | 'out' }),
    rename: (id: number, name: string) =>
      isPayment ? methodOps.rename.mutateAsync({ id, name }) : categoryOps.rename.mutateAsync({ id, name }),
    remove: (id: number) => (isPayment ? methodOps.remove.mutateAsync(id) : categoryOps.remove.mutateAsync(id)),
  };

  return (
    <Screen edges={['top']}>
      <TopBar title="Catégories & paiements" back />
      <View style={styles.content}>
        <SegmentedControl
          options={[
            { value: 'out', label: 'Dépenses' },
            { value: 'in', label: 'Entrées' },
            { value: 'payment', label: 'Paiement' },
          ]}
          value={tab}
          onChange={setTab}
        />
        {query.isLoading ? (
          <LoadingView />
        ) : (
          <EditableList
            key={tab}
            items={items}
            placeholder={isPayment ? 'Nouveau moyen (ex. MTN Money)' : tab === 'out' ? 'Nouvelle catégorie de dépense' : "Nouvelle catégorie d'entrée"}
            {...actions}
          />
        )}
      </View>
    </Screen>
  );
}

function EditableList({
  items,
  placeholder,
  add,
  rename,
  remove,
}: {
  items: Item[];
  placeholder: string;
  add: (name: string) => Promise<unknown>;
  rename: (id: number, name: string) => Promise<unknown>;
  remove: (id: number) => Promise<unknown>;
}) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    setBusy(true);
    try {
      await action();
      return true;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Action impossible.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = (item: Item) =>
    Alert.alert(`Supprimer « ${item.name} » ?`, undefined, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => void run(() => remove(item.id)) },
    ]);

  return (
    <View style={styles.list}>
      <Card style={styles.addCard}>
        <TextInput
          value={newName}
          onChangeText={setNewName}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          style={styles.input}
          accessibilityLabel={placeholder}
        />
        <Button
          label="Ajouter"
          fullWidth={false}
          loading={busy && editingId === null}
          onPress={async () => {
            if (newName.trim() && (await run(() => add(newName.trim())))) setNewName('');
          }}
        />
      </Card>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Card padding={0}>
        {items.map((item, i) => (
          <View key={item.id} style={[styles.row, i > 0 && styles.rowBorder]}>
            {editingId === item.id ? (
              <>
                <TextInput value={editName} onChangeText={setEditName} autoFocus style={[styles.input, styles.flex]} />
                <Pressable
                  hitSlop={8}
                  onPress={async () => {
                    if (editName.trim() && (await run(() => rename(item.id, editName.trim())))) setEditingId(null);
                  }}>
                  <Text style={styles.link}>OK</Text>
                </Pressable>
                <Pressable hitSlop={8} onPress={() => setEditingId(null)}>
                  <Text style={[styles.link, styles.muted]}>Annuler</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={[styles.name, styles.flex]}>{item.name}</Text>
                <Pressable
                  hitSlop={8}
                  onPress={() => {
                    setEditingId(item.id);
                    setEditName(item.name);
                  }}>
                  <Text style={styles.link}>Renommer</Text>
                </Pressable>
                <Pressable hitSlop={8} onPress={() => confirmDelete(item)}>
                  <Text style={[styles.link, { color: colors.negative }]}>Supprimer</Text>
                </Pressable>
              </>
            )}
          </View>
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  list: { gap: spacing.md },
  addCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  input: {
    flex: 1,
    minHeight: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    backgroundColor: colors.card,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  flex: { flex: 1 },
  name: { fontSize: fontSize.sm, color: colors.textPrimary },
  link: { fontSize: fontSize.sm, fontWeight: '600', color: colors.accent },
  muted: { color: colors.textSecondary },
  error: { fontSize: fontSize.sm, color: colors.negative },
});
