import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import type { PartyKind } from '@/api/types';
import { PhoneField } from '@/components/ui/PhoneField';
import { PickerField } from '@/components/ui/PickerField';
import { SettleForm } from '@/components/SettleForm';
import { AmountText } from '@/components/ui/AmountText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorView, LoadingView } from '@/components/ui/QueryState';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { TopBar } from '@/components/ui/TopBar';
import { useAuth } from '@/context/AuthContext';
import { useActivities } from '@/hooks/useActivities';
import { useParty, useUpdateParty } from '@/hooks/useParties';
import { usePartyTransactions } from '@/hooks/useTransactions';
import { formatRelativeDate } from '@/lib/dates';
import { formatAmount } from '@/lib/money';
import { isValidGuineaPhone } from '@/lib/phone';
import { colors, fontSize, spacing } from '@/theme';

const KIND_OPTIONS: { value: PartyKind; label: string }[] = [
  { value: 'client', label: 'Client' },
  { value: 'supplier', label: 'Fournisseur' },
  { value: 'both', label: 'Client et fournisseur' },
];

export default function PartyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const partyId = Number(id);
  const { user } = useAuth();

  const party = useParty(partyId);
  const transactions = usePartyTransactions(partyId);
  const activities = useActivities();
  const updateParty = useUpdateParty(partyId);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [kind, setKind] = useState<PartyKind>('client');
  const [note, setNote] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [settlingId, setSettlingId] = useState<number | null>(null);

  if (party.isLoading) return <LoadingView label="chargement du tiers" />;
  if (party.isError || !party.data) return <ErrorView message="Tiers introuvable." onRetry={() => party.refetch()} />;

  const p = party.data;
  const activityById = new Map((activities.data ?? []).map((a) => [a.id, a]));
  const rows = transactions.data?.results ?? [];
  const outstanding = rows.filter((t) => t.is_credit && !t.is_settled && !t.is_voided);
  const history = rows.filter((t) => !outstanding.includes(t));

  const startEditing = () => {
    setName(p.name);
    setPhone(p.phone);
    setKind(p.kind);
    setNote(p.note);
    setEditError(null);
    setEditing(true);
  };

  const onSaveEdit = async () => {
    if (!name.trim()) {
      setEditError('Donne un nom à ce tiers.');
      return;
    }
    if (phone && !isValidGuineaPhone(phone)) {
      setEditError('Numéro invalide : 9 chiffres, en commençant par 61, 62, 65 ou 66.');
      return;
    }
    setEditError(null);
    try {
      await updateParty.mutateAsync({ name: name.trim(), phone: phone.trim(), kind, note: note.trim() });
      setEditing(false);
    } catch (e) {
      setEditError(e instanceof ApiError ? e.message : 'Impossible d’enregistrer.');
    }
  };

  return (
    <Screen edges={['top']} onRefresh={() => { party.refetch(); transactions.refetch(); }} refreshing={transactions.isRefetching}>
      <TopBar title={p.name} back />
      <View style={styles.content}>
        <Card>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Informations</Text>
            {!editing ? (
              <Button label="Modifier" variant="secondary" fullWidth={false} onPress={startEditing} />
            ) : null}
          </View>

          {editing ? (
            <View style={{ gap: spacing.md }}>
              <TextField label="Nom" value={name} onChangeText={setName} placeholder="ex. Fatou Ndiaye" />
              <PhoneField value={phone} onChangeText={setPhone} />
              <PickerField label="Type" value={kind} options={KIND_OPTIONS} onChange={(v) => setKind(v as PartyKind)} />
              <TextField label="Note (facultatif)" value={note} onChangeText={setNote} multiline />
              {editError ? <Text style={styles.error}>{editError}</Text> : null}
              <View style={styles.actions}>
                <Button label="Annuler" variant="secondary" fullWidth={false} style={styles.actionButton} onPress={() => setEditing(false)} />
                <Button label="Enregistrer" fullWidth={false} style={styles.actionButton} onPress={onSaveEdit} loading={updateParty.isPending} />
              </View>
            </View>
          ) : (
            <>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Téléphone</Text>
                <Text style={styles.infoValue}>{p.phone || '—'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Type</Text>
                <Text style={styles.infoValue}>{kindLabel(p.kind)}</Text>
              </View>
              {p.note ? (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Note</Text>
                  <Text style={styles.infoValue}>{p.note}</Text>
                </View>
              ) : null}
            </>
          )}
        </Card>

        <Card tone="muted" style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>{Number(p.balance) >= 0 ? 'Il/elle me doit' : 'Je lui dois'}</Text>
          <AmountText
            amount={Math.abs(Number(p.balance))}
            currency={user?.base_currency ?? 'GNF'}
            size={26}
            sign="neutral"
          />
        </Card>

        <View>
          <Text style={styles.sectionTitle}>Opérations à régler</Text>
          {transactions.isLoading ? (
            <LoadingView />
          ) : outstanding.length === 0 ? (
            <EmptyState icon="checkmark-circle-outline" title="Rien en attente" description="Toutes les opérations à crédit sont réglées." />
          ) : (
            <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
              {outstanding.map((txn) => {
                const activity = activityById.get(txn.activity);
                const currency = activity?.currency ?? txn.currency;
                return (
                  <Card key={txn.id} style={{ gap: spacing.sm }}>
                    <View style={styles.txnCard}>
                      <View style={styles.txnInfo}>
                        <Text style={styles.txnLabel}>
                          {activity?.name ?? 'Activité'} · {formatRelativeDate(txn.occurred_on)}
                        </Text>
                        {Number(txn.settled_amount) > 0 ? (
                          <Text style={styles.partialHint}>
                            Réglé {formatAmount(txn.settled_amount, currency)} sur {formatAmount(txn.amount_activity, currency)}
                          </Text>
                        ) : null}
                        <AmountText
                          amount={Number(txn.settled_amount) > 0 ? txn.remaining_amount : txn.amount_activity}
                          currency={currency}
                          size={15}
                          sign={txn.direction === 'in' ? 'positive' : 'negative'}
                        />
                      </View>
                      {settlingId !== txn.id ? (
                        <Button
                          label="Marquer réglé"
                          variant="secondary"
                          fullWidth={false}
                          onPress={() => setSettlingId(txn.id)}
                        />
                      ) : null}
                    </View>
                    {settlingId === txn.id ? (
                      <SettleForm txn={txn} onDone={() => setSettlingId(null)} onCancel={() => setSettlingId(null)} />
                    ) : null}
                  </Card>
                );
              })}
            </View>
          )}
        </View>

        {history.length > 0 ? (
          <View>
            <Text style={styles.sectionTitle}>Historique</Text>
            <View style={{ marginTop: spacing.sm }}>
              {history.map((txn) => {
                const activity = activityById.get(txn.activity);
                return (
                  <View key={txn.id} style={styles.historyRow}>
                    <View style={styles.txnInfo}>
                      <Text style={[styles.txnLabel, txn.is_voided && styles.voidedText]}>
                        {activity?.name ?? 'Activité'} · {formatRelativeDate(txn.occurred_on)}
                        {txn.is_voided ? ' · annulée' : txn.is_settled ? ' · réglée' : ''}
                      </Text>
                    </View>
                    {txn.is_voided ? (
                      <Ionicons name="close-circle-outline" size={16} color={colors.textTertiary} />
                    ) : (
                      <AmountText
                        amount={txn.amount_activity}
                        currency={activity?.currency ?? 'GNF'}
                        size={13}
                        sign={txn.direction === 'in' ? 'positive' : 'negative'}
                      />
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

function kindLabel(kind: string) {
  if (kind === 'client') return 'Client';
  if (kind === 'supplier') return 'Fournisseur';
  return 'Client et fournisseur';
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  sectionTitle: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: spacing.sm },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  infoLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  infoValue: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textPrimary },
  balanceCard: { gap: 4, alignItems: 'flex-start' },
  balanceLabel: { fontSize: fontSize.xs, color: colors.textSecondary },
  txnCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  txnInfo: { flex: 1, gap: 3 },
  txnLabel: { fontSize: 13, color: colors.textPrimary },
  partialHint: { fontSize: 11.5, color: colors.warning, fontWeight: '600' },
  voidedText: { color: colors.textTertiary, textDecorationLine: 'line-through' },
  actions: { flexDirection: 'row', gap: spacing.sm },
  actionButton: { flex: 1 },
  error: { fontSize: fontSize.sm, color: colors.negative },
  historyRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm,
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border,
  },
});
