import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import type { Budget, BudgetStatus } from '@/api/types';
import { BudgetProgress } from '@/components/BudgetProgress';
import { AmountField } from '@/components/ui/AmountField';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { PickerField } from '@/components/ui/PickerField';
import { ErrorView, LoadingView } from '@/components/ui/QueryState';
import { Screen } from '@/components/ui/Screen';
import { TopBar } from '@/components/ui/TopBar';
import { useAuth } from '@/context/AuthContext';
import { useActivities } from '@/hooks/useActivities';
import { useBudgetsStatus, useCreateBudget, useDeleteBudget, useUpdateBudget } from '@/hooks/useBudgets';
import { useCategories } from '@/hooks/useTransactions';
import { todayISO } from '@/lib/dates';
import { useCurrencies } from '@/lib/money';
import { colors, fontSize, spacing } from '@/theme';

const PERIOD_OPTIONS = [
  { value: 'week', label: 'Par semaine' },
  { value: 'month', label: 'Par mois' },
  { value: 'year', label: 'Par année' },
];

/** Budgets : plafonds de dépenses par catégorie ou par activité, avec le
 * dépensé / prévu de la période en cours. `?activity=` pré-filtre. */
export default function BudgetsScreen() {
  const params = useLocalSearchParams<{ activity?: string }>();
  const activityFilter = params.activity ? Number(params.activity) : undefined;
  const budgets = useBudgetsStatus(activityFilter);
  const deleteBudget = useDeleteBudget();
  const [editing, setEditing] = useState<BudgetStatus | 'new' | null>(null);

  const confirmDelete = (b: BudgetStatus) =>
    Alert.alert('Supprimer ce budget ?', 'Les opérations ne sont pas touchées.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => deleteBudget.mutate(b.id) },
    ]);

  const rows = budgets.data ?? [];

  return (
    <Screen edges={['top']} onRefresh={() => budgets.refetch()} refreshing={budgets.isRefetching}>
      <TopBar title="Budgets" back />
      <View style={styles.content}>
        <Text style={styles.help}>
          Fixe un plafond de dépenses par catégorie (loyer, transport…) ou pour toute une activité. Seules les charges
          comptent : un réapprovisionnement est du stock, pas une dépense.
        </Text>

        {editing ? (
          <BudgetForm
            budget={editing === 'new' ? null : editing}
            defaultActivity={activityFilter}
            onDone={() => setEditing(null)}
          />
        ) : (
          <Button label="+ Nouveau budget" onPress={() => setEditing('new')} />
        )}

        {budgets.isLoading ? (
          <LoadingView />
        ) : budgets.isError ? (
          <ErrorView message="Impossible de charger les budgets." onRetry={() => budgets.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState icon="pie-chart-outline" title="Aucun budget" description="Crée ton premier budget pour être alerté avant de trop dépenser." />
        ) : (
          rows.map((b) => (
            <Card key={b.id} style={styles.card}>
              <BudgetProgress budget={b} />
              <View style={styles.rowActions}>
                <Pressable onPress={() => setEditing(b)} hitSlop={8}>
                  <Text style={styles.link}>Modifier</Text>
                </Pressable>
                <Pressable onPress={() => confirmDelete(b)} hitSlop={8}>
                  <Text style={[styles.link, { color: colors.negative }]}>Supprimer</Text>
                </Pressable>
              </View>
            </Card>
          ))
        )}
      </View>
    </Screen>
  );
}

function BudgetForm({
  budget,
  defaultActivity,
  onDone,
}: {
  budget: BudgetStatus | null;
  defaultActivity?: number;
  onDone: () => void;
}) {
  const { user } = useAuth();
  const activities = useActivities();
  const categories = useCategories(undefined, 'out');
  const currencies = useCurrencies();
  const create = useCreateBudget();
  const update = useUpdateBudget();

  const initialActivity = budget ? budget.activity : (defaultActivity ?? null);
  const [activityId, setActivityId] = useState(initialActivity ? String(initialActivity) : '');
  const [categoryId, setCategoryId] = useState(budget?.category ? String(budget.category) : '');
  const [period, setPeriod] = useState<Budget['period']>(budget?.period ?? 'month');
  const [amount, setAmount] = useState(budget ? String(Number(budget.planned)) : '');
  const [currency, setCurrency] = useState(budget?.currency ?? '');
  const [error, setError] = useState<string | null>(null);

  const activity = (activities.data ?? []).find((a) => String(a.id) === activityId);
  const effectiveCurrency = currency || activity?.currency || user?.base_currency || 'GNF';
  const categoryOptions = (categories.data ?? []).filter((c) => c.activity === null || String(c.activity) === activityId);

  const onSave = async () => {
    const value = Number(amount.replace(',', '.'));
    if (!value || value <= 0) {
      setError('Indique le montant prévu.');
      return;
    }
    setError(null);
    const input = {
      activity: activityId ? Number(activityId) : null,
      category: categoryId ? Number(categoryId) : null,
      period,
      amount: String(value),
      currency: effectiveCurrency,
      starts_on: todayISO(),
    };
    try {
      if (budget) {
        const { starts_on: _ignored, ...patch } = input;
        await update.mutateAsync({ id: budget.id, patch });
      } else {
        await create.mutateAsync(input);
      }
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Impossible d'enregistrer ce budget.");
    }
  };

  return (
    <Card style={styles.form}>
      <Text style={styles.formTitle}>{budget ? 'Modifier le budget' : 'Nouveau budget'}</Text>
      <PickerField
        label="Activité"
        value={activityId}
        options={[{ value: '', label: 'Toutes les activités' }, ...(activities.data ?? []).map((a) => ({ value: String(a.id), label: a.name }))]}
        onChange={(v) => {
          setActivityId(v);
          setCategoryId('');
        }}
      />
      <PickerField
        label="Catégorie de dépense"
        value={categoryId}
        options={[{ value: '', label: 'Toutes les dépenses' }, ...categoryOptions.map((c) => ({ value: String(c.id), label: c.name }))]}
        onChange={setCategoryId}
      />
      <PickerField label="Période" value={period} options={PERIOD_OPTIONS} onChange={(v) => setPeriod(v as Budget['period'])} />
      <AmountField label="Montant prévu" value={amount} onChangeText={setAmount} placeholder="0" suffix={effectiveCurrency} />
      <PickerField
        label="Devise"
        value={effectiveCurrency}
        options={(currencies.data ?? []).map((c) => ({ value: c.code, label: c.code }))}
        onChange={setCurrency}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.formActions}>
        <Button label="Annuler" variant="secondary" onPress={onDone} style={styles.formButton} />
        <Button label="Enregistrer" onPress={onSave} loading={create.isPending || update.isPending} style={styles.formButton} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  help: { fontSize: fontSize.xs, color: colors.textSecondary },
  card: { gap: 4 },
  rowActions: { flexDirection: 'row', gap: spacing.lg, justifyContent: 'flex-end' },
  link: { fontSize: fontSize.sm, fontWeight: '600', color: colors.accent },
  form: { gap: spacing.md },
  formTitle: { fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary },
  error: { fontSize: fontSize.sm, color: colors.negative },
  formActions: { flexDirection: 'row', gap: spacing.sm },
  formButton: { flex: 1 },
});
