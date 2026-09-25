import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { PartyPicker } from '@/components/PartyPicker';
import { SettleForm } from '@/components/SettleForm';
import { AmountText } from '@/components/ui/AmountText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PickerField } from '@/components/ui/PickerField';
import { ErrorView, LoadingView } from '@/components/ui/QueryState';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { TopBar } from '@/components/ui/TopBar';
import { useActivity } from '@/hooks/useActivities';
import { useSaleLines } from '@/hooks/useProducts';
import {
  useCategories,
  usePaymentMethods,
  useTransaction,
  useUpdateTransaction,
  useVoidTransaction,
} from '@/hooks/useTransactions';
import { formatLongDate } from '@/lib/dates';
import { formatAmount } from '@/lib/money';
import { colors, fontSize, spacing } from '@/theme';

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const txnId = Number(id);

  const txn = useTransaction(txnId);
  const activity = useActivity(txn.data?.activity);
  const categories = useCategories(undefined, txn.data?.direction);
  const paymentMethods = usePaymentMethods();
  const saleLines = useSaleLines(txnId, txn.data?.kind === 'sale');
  const updateTxn = useUpdateTransaction();
  const voidTxn = useVoidTransaction();

  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [partyId, setPartyId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [showVoidForm, setShowVoidForm] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [showSettleForm, setShowSettleForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (txn.data) {
      setCategoryId(txn.data.category ? String(txn.data.category) : null);
      setPaymentMethodId(txn.data.payment_method ? String(txn.data.payment_method) : null);
      setPartyId(txn.data.party ? String(txn.data.party) : null);
      setNote(txn.data.note);
    }
  }, [txn.data]);

  if (txn.isLoading || activity.isLoading) return <LoadingView label="chargement de l'opération" />;
  if (txn.isError || !txn.data) return <ErrorView message="Opération introuvable." onRetry={() => txn.refetch()} />;

  const t = txn.data;
  const act = activity.data;
  const currency = act?.currency ?? t.currency;
  const locked = t.is_voided;

  const onSave = async () => {
    setError(null);
    try {
      await updateTxn.mutateAsync({
        id: t.id,
        patch: {
          category: categoryId ? Number(categoryId) : null,
          payment_method: paymentMethodId ? Number(paymentMethodId) : null,
          party: partyId ? Number(partyId) : null,
          note,
        },
      });
      Alert.alert('Enregistré', 'Les modifications ont été enregistrées.');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Impossible d’enregistrer.');
    }
  };

  const onConfirmVoid = async () => {
    setError(null);
    try {
      await voidTxn.mutateAsync({ id: t.id, reason: voidReason.trim() });
      setShowVoidForm(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Impossible d'annuler cette opération.");
    }
  };

  return (
    <Screen scroll edges={['top']}>
      <TopBar title={t.kind_display} back onBack={() => router.back()} />
      <View style={styles.content}>
        <Card tone="muted" style={styles.amountCard}>
          <AmountText amount={t.amount_activity} currency={currency} size={26} sign={t.direction === 'in' ? 'positive' : 'negative'} />
          <Text style={styles.dateText}>{formatLongDate(t.occurred_on)}</Text>
          {t.is_credit ? <Text style={styles.creditBadge}>{creditStatusLabel(t)}</Text> : null}
          {t.is_voided ? (
            <Text style={styles.voidedBadge}>
              Annulée{t.voided_reason ? ` — ${t.voided_reason}` : ''}
            </Text>
          ) : null}
        </Card>

        {t.kind === 'sale' ? (
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Détail de la vente</Text>
            {saleLines.isLoading ? (
              <Text style={styles.dateText}>Chargement…</Text>
            ) : (saleLines.data ?? []).length === 0 ? (
              <Text style={styles.dateText}>Aucun détail disponible.</Text>
            ) : (
              (saleLines.data ?? []).map((line) => (
                <View key={line.id} style={styles.saleLineRow}>
                  <View style={styles.saleLineInfo}>
                    <Text style={styles.saleLineName}>{line.product_name}</Text>
                    <Text style={styles.saleLineMeta}>
                      {line.quantity} × {formatAmount(line.unit_price, currency)}
                      {Number(line.discount) > 0 ? ` − ${formatAmount(line.discount, currency)} de remise` : ''}
                    </Text>
                  </View>
                  <Text style={styles.saleLineTotal}>{formatAmount(line.line_total, currency)}</Text>
                </View>
              ))
            )}
          </Card>
        ) : null}

        {!locked && t.is_credit && !t.is_settled ? (
          showSettleForm ? (
            <Card style={styles.card}>
              <Text style={styles.sectionTitle}>Enregistrer un règlement</Text>
              <SettleForm txn={t} onDone={() => setShowSettleForm(false)} onCancel={() => setShowSettleForm(false)} />
            </Card>
          ) : (
            <Button label="Marquer comme réglé" onPress={() => setShowSettleForm(true)} />
          )
        ) : null}

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Détails</Text>
          <PickerField
            label="Catégorie"
            value={categoryId}
            placeholder="Aucune"
            options={(categories.data ?? []).map((c) => ({ value: String(c.id), label: c.name }))}
            onChange={setCategoryId}
            disabled={locked}
          />
          <PickerField
            label="Moyen de paiement"
            value={paymentMethodId}
            placeholder="Aucun"
            options={(paymentMethods.data ?? []).map((p) => ({ value: String(p.id), label: p.name }))}
            onChange={setPaymentMethodId}
            disabled={locked}
          />
          {act?.has_debts ? (
            <PartyPicker
              label={t.direction === 'in' ? 'Client' : 'Fournisseur'}
              kind={t.direction === 'in' ? 'client' : 'supplier'}
              value={partyId}
              onChange={setPartyId}
            />
          ) : null}
          <TextField label="Note" value={note} onChangeText={setNote} multiline editable={!locked} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {!locked ? <Button label="Enregistrer" variant="secondary" onPress={onSave} loading={updateTxn.isPending} /> : null}
        </Card>

        <Text style={styles.immutableHint}>
          Le montant, la devise, le sens et la date ne peuvent plus changer une fois l'opération créée — annule et
          ressaisis si besoin.
        </Text>

        {!locked ? (
          showVoidForm ? (
            <Card style={styles.card}>
              <Text style={styles.sectionTitle}>Annuler cette opération</Text>
              <TextField label="Motif (facultatif)" value={voidReason} onChangeText={setVoidReason} placeholder="ex. erreur de saisie" />
              <View style={styles.voidActions}>
                <Button label="Retour" variant="secondary" fullWidth={false} style={styles.voidActionButton} onPress={() => setShowVoidForm(false)} />
                <Button
                  label="Confirmer l'annulation"
                  variant="danger"
                  fullWidth={false}
                  style={styles.voidActionButton}
                  onPress={onConfirmVoid}
                  loading={voidTxn.isPending}
                />
              </View>
            </Card>
          ) : (
            <Button label="Annuler cette opération" variant="danger" onPress={() => setShowVoidForm(true)} />
          )
        ) : null}
      </View>
    </Screen>
  );
}

function creditStatusLabel(t: { is_settled: boolean; settled_amount: string; remaining_amount: string; currency: string }) {
  if (t.is_settled) return 'À crédit · réglée';
  if (Number(t.settled_amount) > 0) {
    return `À crédit · réglée partiellement · reste ${formatAmount(t.remaining_amount, t.currency)}`;
  }
  return 'À crédit · non réglée';
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  amountCard: { alignItems: 'center', gap: 4 },
  saleLineRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingVertical: 6 },
  saleLineInfo: { flex: 1, gap: 2 },
  saleLineName: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textPrimary },
  saleLineMeta: { fontSize: 11.5, color: colors.textTertiary },
  saleLineTotal: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textPrimary },
  dateText: { fontSize: fontSize.sm, color: colors.textSecondary },
  creditBadge: { fontSize: fontSize.xs, color: colors.warning, fontWeight: '600', marginTop: 4 },
  voidedBadge: { fontSize: fontSize.xs, color: colors.negative, fontWeight: '600', marginTop: 4, textAlign: 'center' },
  card: { gap: spacing.md },
  sectionTitle: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.4 },
  error: { fontSize: fontSize.sm, color: colors.negative },
  immutableHint: { fontSize: 11.5, color: colors.textTertiary, lineHeight: 16 },
  voidActions: { flexDirection: 'row', gap: spacing.sm },
  voidActionButton: { flex: 1 },
});
