import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { FREQUENCY_LABELS, type DueOperation, type Frequency, type RecurringOperation } from '@/api/recurring';
import { AmountField } from '@/components/ui/AmountField';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { PickerField } from '@/components/ui/PickerField';
import { LoadingView } from '@/components/ui/QueryState';
import { Screen } from '@/components/ui/Screen';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { TextField } from '@/components/ui/TextField';
import { TopBar } from '@/components/ui/TopBar';
import { useActivities } from '@/hooks/useActivities';
import { useAnswerDue, useDeleteRecurring, useDueOperations, useRecurring, useSaveRecurring } from '@/hooks/useRecurring';
import { useCategories, usePaymentMethods } from '@/hooks/useTransactions';
import { formatLongDate, formatRelativeDate, todayISO } from '@/lib/dates';
import { formatAmount } from '@/lib/money';
import { syncReminders } from '@/lib/reminders';
import { colors, fontSize, radius, spacing } from '@/theme';

const FREQUENCY_OPTIONS = (Object.keys(FREQUENCY_LABELS) as Frequency[]).map((value) => ({ value, label: FREQUENCY_LABELS[value] }));

/** Dépenses fixes (loyer, salaire, abonnement…) : à chaque échéance,
 * l'opération est préparée et attend ta confirmation — rien ne sort de la
 * caisse avant que tu confirmes. */
export default function RecurringScreen() {
  const list = useRecurring();
  const due = useDueOperations();
  const [editing, setEditing] = useState<RecurringOperation | 'new' | null>(null);

  // Rappels sur le téléphone, à jour de la liste.
  useEffect(() => {
    if (list.data) void syncReminders(list.data);
  }, [list.data]);

  if (list.isLoading) return <LoadingView label="Chargement des dépenses fixes…" />;
  const rows = list.data ?? [];
  const dueRows = due.data ?? [];

  return (
    <Screen edges={['top']} onRefresh={() => { list.refetch(); due.refetch(); }} refreshing={list.isRefetching}>
      <TopBar title="Dépenses fixes" back />
      <View style={styles.content}>
        {dueRows.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>À confirmer ({dueRows.length})</Text>
            {dueRows.map((d) => (
              <DueCard
                key={`${d.recurring.id}-${d.due_date}`}
                due={d}
                waitFor={dueRows.find((o) => o.recurring.id === d.recurring.id && o.due_date < d.due_date)?.due_date}
              />
            ))}
          </>
        ) : null}

        {editing ? (
          <RecurringForm item={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />
        ) : (
          <>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Mes dépenses fixes</Text>
              <Pressable onPress={() => setEditing('new')} hitSlop={8} accessibilityRole="button">
                <Text style={styles.link}>+ Ajouter</Text>
              </Pressable>
            </View>
            {rows.length === 0 ? (
              <EmptyState
                icon="repeat-outline"
                title="Aucune dépense fixe"
                description="Loyer, salaire d'un employé, abonnement… Bénef te rappelle chaque échéance et l'enregistre quand tu confirmes."
                actionLabel="Ajouter une dépense fixe"
                onAction={() => setEditing('new')}
              />
            ) : (
              rows.map((r) => (
                <Pressable key={r.id} onPress={() => setEditing(r)}>
                  {({ pressed }) => (
                    <Card style={{ ...styles.row, opacity: !r.is_active ? 0.55 : pressed ? 0.88 : 1 }}>
                      <View style={styles.rowIcon}>
                        <Ionicons name="repeat-outline" size={18} color={colors.accent} />
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.rowTitle}>{r.label}</Text>
                        <Text style={styles.meta}>
                          {FREQUENCY_LABELS[r.frequency]} · {r.activity_name}
                          {r.is_active ? ` · prochaine : ${formatRelativeDate(r.next_due).toLowerCase()}` : ' · en pause'}
                        </Text>
                      </View>
                      <Text style={[styles.amount, { color: r.direction === 'out' ? colors.negative : colors.positive }]}>
                        {formatAmount(r.amount, r.currency)}
                      </Text>
                    </Card>
                  )}
                </Pressable>
              ))
            )}
            <Text style={styles.help}>
              Le jour venu, tu reçois un rappel sur ton téléphone et l'opération apparaît ici et sur l'accueil. Tu confirmes
              (en changeant le montant ou la caisse si besoin) ou tu passes : rien n'est enregistré sans toi.
            </Text>
          </>
        )}
      </View>
    </Screen>
  );
}

function DueCard({ due, waitFor }: { due: DueOperation; waitFor?: string }) {
  const r = due.recurring;
  const answer = useAnswerDue();
  const paymentMethods = usePaymentMethods();
  const [amount, setAmount] = useState(String(Number(r.amount)));
  const [methodId, setMethodId] = useState(r.payment_method ? String(r.payment_method) : '');
  const [fee, setFee] = useState('');
  const [error, setError] = useState<string | null>(null);
  const method = (paymentMethods.data ?? []).find((m) => String(m.id) === methodId);
  const showFee = !!method && !method.is_cash;

  const run = async (action: 'confirm' | 'skip') => {
    const value = Number(amount.replace(',', '.'));
    if (action === 'confirm' && (!value || value <= 0)) {
      setError('Indique le montant.');
      return;
    }
    setError(null);
    try {
      await answer.mutateAsync({
        due,
        action,
        input:
          action === 'confirm'
            ? {
                amount: String(value),
                payment_method: methodId ? Number(methodId) : null,
                ...(showFee && Number(fee.replace(',', '.')) > 0 ? { fee: String(Number(fee.replace(',', '.'))) } : {}),
              }
            : {},
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Impossible pour le moment.');
    }
  };

  return (
    <Card style={styles.dueCard}>
      <View style={styles.dueHead}>
        <Ionicons name="alarm-outline" size={20} color={colors.warning} />
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{r.label}</Text>
          <Text style={styles.meta}>
            {r.activity_name} · échéance du {formatLongDate(due.due_date).toLowerCase()}
          </Text>
        </View>
      </View>
      <AmountField label="Montant" value={amount} onChangeText={setAmount} suffix={r.currency} />
      <PickerField
        label={r.direction === 'out' ? 'Payé avec' : 'Reçu sur'}
        value={methodId || null}
        placeholder="Espèces"
        options={(paymentMethods.data ?? []).map((m) => ({ value: String(m.id), label: m.name }))}
        onChange={setMethodId}
      />
      {showFee ? (
        <AmountField
          label="Frais de transfert (facultatif)"
          value={fee}
          onChangeText={setFee}
          placeholder="0"
          suffix={r.currency}
          hint={`Ce que ${method?.name ?? "l'opérateur"} prend en plus. Compté comme une dépense.`}
        />
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {waitFor ? <Text style={styles.meta}>Réponds d'abord à l'échéance du {formatLongDate(waitFor).toLowerCase()}.</Text> : null}
      <View style={styles.dueActions}>
        <Button label="Pas cette fois" variant="secondary" fullWidth={false} style={{ flex: 1 }} onPress={() => run('skip')} disabled={!!waitFor} />
        <Button
          label="Confirmer"
          icon="checkmark-circle-outline"
          fullWidth={false}
          style={{ flex: 1 }}
          onPress={() => run('confirm')}
          loading={answer.isPending}
          disabled={!!waitFor}
        />
      </View>
    </Card>
  );
}

function firstOfNextMonth() {
  const d = new Date();
  const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`;
}

function RecurringForm({ item, onDone }: { item: RecurringOperation | null; onDone: () => void }) {
  const activities = useActivities();
  const paymentMethods = usePaymentMethods();
  const save = useSaveRecurring();
  const remove = useDeleteRecurring();
  const acts = activities.data ?? [];

  const [activityId, setActivityId] = useState(item ? String(item.activity) : acts[0] ? String(acts[0].id) : '');
  const [label, setLabel] = useState(item?.label ?? '');
  const [direction, setDirection] = useState<'in' | 'out'>(item?.direction ?? 'out');
  const [amount, setAmount] = useState(item ? String(Number(item.amount)) : '');
  const [categoryId, setCategoryId] = useState(item?.category ? String(item.category) : '');
  const [methodId, setMethodId] = useState(item?.payment_method ? String(item.payment_method) : '');
  const [frequency, setFrequency] = useState<Frequency>(item?.frequency ?? 'monthly');
  const [start, setStart] = useState(item?.next_due ?? todayISO());
  const [active, setActive] = useState(item?.is_active ?? true);
  const [error, setError] = useState<string | null>(null);
  const categories = useCategories(undefined, direction);
  const activity = activityId || (acts[0] ? String(acts[0].id) : '');
  const currency = acts.find((a) => String(a.id) === activity)?.currency ?? '';

  const onSave = async () => {
    const value = Number(amount.replace(',', '.'));
    if (!label.trim()) return setError('Donne un nom, ex. « Loyer boutique ».');
    if (!value || value <= 0) return setError('Indique le montant habituel.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return setError('Date au format AAAA-MM-JJ.');
    setError(null);
    try {
      await save.mutateAsync({
        id: item?.id,
        input: {
          activity: Number(activity),
          label: label.trim(),
          direction,
          amount: String(value),
          category: categoryId ? Number(categoryId) : null,
          payment_method: methodId ? Number(methodId) : null,
          frequency,
          ...(!item || start !== item.next_due ? { start_date: start } : {}),
          is_active: active,
        },
      });
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Impossible d'enregistrer.");
    }
  };

  const onDelete = () =>
    item &&
    Alert.alert('Supprimer cette dépense fixe ?', 'Les opérations déjà enregistrées restent.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => remove.mutate(item.id, { onSuccess: onDone }) },
    ]);

  return (
    <Card style={styles.form}>
      <Text style={styles.sectionTitle}>{item ? 'Modifier la dépense fixe' : 'Nouvelle dépense fixe'}</Text>
      <SegmentedControl
        options={[
          { value: 'out', label: 'Dépense' },
          { value: 'in', label: 'Entrée' },
        ]}
        value={direction}
        onChange={(v) => {
          setDirection(v);
          setCategoryId('');
        }}
      />
      <TextField label="Nom" value={label} onChangeText={setLabel} placeholder={direction === 'out' ? 'ex. Loyer boutique' : 'ex. Loyer reçu'} />
      {acts.length > 1 ? (
        <PickerField label="Activité" value={activity} options={acts.map((a) => ({ value: String(a.id), label: a.name }))} onChange={setActivityId} />
      ) : null}
      <AmountField label="Montant habituel" value={amount} onChangeText={setAmount} placeholder="0" suffix={currency} />
      <PickerField label="Fréquence" value={frequency} options={FREQUENCY_OPTIONS} onChange={(v) => setFrequency(v as Frequency)} />
      <View style={{ gap: 6 }}>
        <TextField label={item ? 'Prochaine échéance' : 'Première échéance'} value={start} onChangeText={setStart} placeholder="AAAA-MM-JJ" />
        <View style={styles.chips}>
          <Chip label="Aujourd'hui" selected={start === todayISO()} onPress={() => setStart(todayISO())} />
          <Chip label="1er du mois prochain" selected={start === firstOfNextMonth()} onPress={() => setStart(firstOfNextMonth())} />
        </View>
      </View>
      <PickerField
        label="Catégorie (facultatif)"
        value={categoryId || null}
        options={(categories.data ?? []).map((c) => ({ value: String(c.id), label: c.name }))}
        onChange={setCategoryId}
      />
      <PickerField
        label={direction === 'out' ? 'Payé habituellement avec' : 'Reçu habituellement sur'}
        value={methodId || null}
        placeholder="Espèces"
        options={(paymentMethods.data ?? []).map((m) => ({ value: String(m.id), label: m.name }))}
        onChange={setMethodId}
      />
      {item ? (
        <View style={styles.switchRow}>
          <Text style={styles.rowTitle}>Active</Text>
          <Switch value={active} onValueChange={setActive} trackColor={{ true: colors.accent, false: colors.borderStrong }} />
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.dueActions}>
        <Button label="Annuler" variant="secondary" fullWidth={false} style={{ flex: 1 }} onPress={onDone} />
        <Button label="Enregistrer" fullWidth={false} style={{ flex: 1 }} onPress={onSave} loading={save.isPending} />
      </View>
      {item ? <Button label="Supprimer" variant="danger" onPress={onDelete} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textPrimary },
  link: { fontSize: fontSize.sm, fontWeight: '700', color: colors.accent },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowIcon: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.textPrimary },
  meta: { fontSize: fontSize.xs, color: colors.textTertiary },
  amount: { fontSize: fontSize.md, fontWeight: '700' },
  help: { fontSize: fontSize.xs, color: colors.textTertiary, lineHeight: 17 },
  dueCard: { gap: spacing.md, borderColor: colors.warning },
  dueHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dueActions: { flexDirection: 'row', gap: spacing.sm },
  form: { gap: spacing.md },
  chips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  error: { fontSize: fontSize.sm, color: colors.negative },
});
