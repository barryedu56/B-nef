import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { submitOnboarding } from '@/api/activities';
import { ApiError } from '@/api/client';
import type { OnboardingInput, OnboardingResult } from '@/api/types';
import { UnitField } from '@/components/UnitField';
import { Alert } from '@/components/ui/Alert';
import { AmountField } from '@/components/ui/AmountField';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LoadingView } from '@/components/ui/QueryState';
import { Screen } from '@/components/ui/Screen';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { TextField } from '@/components/ui/TextField';
import { TopBar } from '@/components/ui/TopBar';
import { useActivity } from '@/hooks/useActivities';
import { useAccountsOverview } from '@/hooks/useAccounts';
import { formatAmount } from '@/lib/money';
import { colors, fontSize, spacing } from '@/theme';

type Step = 0 | 1 | 2 | 3;
const STEPS = ['Mon argent', 'Ma marchandise', 'Dettes', 'Récapitulatif'];

interface ProductRow {
  key: number;
  name: string;
  unit: string;
  quantity: string;
  unitCost: string;
  salePrice: string;
}

interface PartyRow {
  key: number;
  name: string;
  phone: string;
  direction: 'in' | 'out';
  amount: string;
}

const num = (v: string) => Number((v || '0').replace(/\s/g, '').replace(',', '.')) || 0;
let nextKey = 1;
const emptyProduct = (): ProductRow => ({ key: nextKey++, name: '', unit: 'pièce', quantity: '', unitCost: '', salePrice: '' });
const emptyParty = (direction: 'in' | 'out' = 'in'): PartyRow => ({ key: nextKey++, name: '', phone: '', direction, amount: '' });

/** Assistant « Je démarre avec Bénef » : pour un commerce qui existait avant
 * l'application — argent par caisse, marchandise déjà en stock, dettes et
 * créances — enregistré en une fois à la fin. Chaque étape peut être passée. */
export default function OnboardingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const activityId = Number(id);
  const activity = useActivity(activityId);
  const overview = useAccountsOverview();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>(0);
  const [cash, setCash] = useState<Record<number, string>>({});
  const [products, setProducts] = useState<ProductRow[]>([emptyProduct()]);
  const [parties, setParties] = useState<PartyRow[]>([emptyParty()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OnboardingResult | null>(null);

  if (activity.isLoading || overview.isLoading || !activity.data) return <LoadingView />;
  const act = activity.data;
  const currency = act.currency;
  const accounts = overview.data?.accounts ?? [];

  const filledProducts = products.filter((p) => p.name.trim());
  const filledParties = parties.filter((p) => p.name.trim());
  const cashTotal = Object.values(cash).reduce((s, v) => s + num(v), 0);
  const stockTotal = filledProducts.reduce((s, p) => s + num(p.quantity) * num(p.unitCost), 0);
  const receivable = filledParties.filter((p) => p.direction === 'in').reduce((s, p) => s + num(p.amount), 0);
  const payable = filledParties.filter((p) => p.direction === 'out').reduce((s, p) => s + num(p.amount), 0);

  const goTo = (target: Step) => {
    setError(null);
    setStep(target);
  };

  const validateStep = (): string | null => {
    if (step === 1) {
      const bad = filledProducts.find((p) => num(p.quantity) > 0 && num(p.unitCost) <= 0);
      if (bad) return `« ${bad.name} » : indique combien t'a coûté chaque unité.`;
    }
    if (step === 2) {
      const bad = filledParties.find((p) => num(p.amount) <= 0);
      if (bad) return `« ${bad.name} » : indique le montant.`;
    }
    return null;
  };

  const next = () => {
    const problem = validateStep();
    if (problem) {
      setError(problem);
      return;
    }
    goTo((step + 1) as Step);
  };

  const onSubmit = async () => {
    const input: OnboardingInput = {
      cash: accounts.filter((a) => num(cash[a.id] ?? '') > 0).map((a) => ({ account: a.id, amount: String(num(cash[a.id])) })),
      products: filledProducts.map((p) => ({
        name: p.name.trim(),
        unit: p.unit || 'pièce',
        quantity: String(num(p.quantity)),
        unit_cost: String(num(p.unitCost)),
        sale_price: String(num(p.salePrice)),
      })),
      parties: filledParties.map((p) => ({ name: p.name.trim(), phone: p.phone.trim(), direction: p.direction, amount: String(num(p.amount)) })),
    };
    setSaving(true);
    setError(null);
    try {
      setResult(await submitOnboarding(activityId, input));
      await queryClient.invalidateQueries();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setSaving(false);
    }
  };

  if (result) {
    return (
      <Screen edges={['top']}>
        <TopBar title="C'est prêt !" />
        <View style={styles.content}>
          <Alert tone="success" message={`${act.name} démarre avec tout ce que tu avais déjà. Tu peux maintenant enregistrer tes ventes et dépenses au jour le jour.`} />
          <Summary currency={currency} cash={result.cash_total} stock={result.stock_value} receivable={result.receivable} payable={result.payable} />
          <Button label="Aller à mon activité" onPress={() => router.replace({ pathname: '/activity/[id]', params: { id } })} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <TopBar title="Je démarre avec Bénef" subtitle={act.name} back />
      <View style={styles.content}>
        <View style={styles.steps}>
          {STEPS.map((label, i) => (
            <View key={label} style={styles.stepItem}>
              <View style={[styles.stepBar, i <= step && styles.stepBarDone]} />
              <Text style={[styles.stepLabel, i === step && styles.stepLabelActive]}>{label}</Text>
            </View>
          ))}
        </View>

        {step === 0 ? (
          <>
            <Text style={styles.lead}>Combien as-tu aujourd'hui dans chaque caisse pour cette activité ? Compte l'argent du tiroir, regarde tes soldes.</Text>
            <Card style={styles.card}>
              {accounts.map((a) => (
                <AmountField
                  key={a.id}
                  label={a.name}
                  value={cash[a.id] ?? ''}
                  onChangeText={(v) => setCash((c) => ({ ...c, [a.id]: v }))}
                  placeholder="0"
                  suffix={a.effective_currency}
                />
              ))}
            </Card>
            <Text style={styles.hint}>Cet argent compte dans tes caisses, pas dans ton bénéfice.</Text>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Text style={styles.lead}>
              Fais le tour de ta marchandise et note chaque produit : la quantité, ce qu'il t'a coûté (le dernier prix d'achat), et ton
              prix de vente.
            </Text>
            {products.map((p, i) => (
              <Card key={p.key} style={styles.card}>
                <View style={styles.rowHead}>
                  <Text style={styles.rowTitle}>Produit {i + 1}</Text>
                  {products.length > 1 ? (
                    <Pressable hitSlop={10} onPress={() => setProducts((rows) => rows.filter((r) => r.key !== p.key))} accessibilityLabel="Retirer ce produit">
                      <Ionicons name="trash-outline" size={18} color={colors.negative} />
                    </Pressable>
                  ) : null}
                </View>
                <TextField label="Nom" value={p.name} onChangeText={(v) => updateRow(setProducts, p.key, { name: v })} placeholder="ex. Sac de riz 25 kg" />
                <UnitField value={p.unit} onChange={(v) => updateRow(setProducts, p.key, { unit: v })} />
                <View style={styles.twoCols}>
                  <View style={styles.col}>
                    <TextField label="Quantité" value={p.quantity} onChangeText={(v) => updateRow(setProducts, p.key, { quantity: v })} keyboardType="numeric" placeholder="0" />
                  </View>
                  <View style={styles.col}>
                    <AmountField label="Coût unitaire" value={p.unitCost} onChangeText={(v) => updateRow(setProducts, p.key, { unitCost: v })} placeholder="0" />
                  </View>
                </View>
                <AmountField label="Prix de vente" value={p.salePrice} onChangeText={(v) => updateRow(setProducts, p.key, { salePrice: v })} placeholder="0" suffix={currency} />
              </Card>
            ))}
            <Button label="+ Ajouter un produit" variant="secondary" onPress={() => setProducts((rows) => [...rows, emptyProduct()])} />
            <Text style={styles.hint}>
              Beaucoup de produits ? Sur l'ordinateur (app web), tu peux les importer d'un fichier Excel. Valeur du stock saisie :{' '}
              {formatAmount(stockTotal, currency)}.
            </Text>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Text style={styles.lead}>Les clients qui te doivent de l'argent et les fournisseurs à qui tu dois de l'argent, aujourd'hui.</Text>
            {parties.map((p, i) => (
              <Card key={p.key} style={styles.card}>
                <View style={styles.rowHead}>
                  <Text style={styles.rowTitle}>Personne {i + 1}</Text>
                  {parties.length > 1 ? (
                    <Pressable hitSlop={10} onPress={() => setParties((rows) => rows.filter((r) => r.key !== p.key))} accessibilityLabel="Retirer cette personne">
                      <Ionicons name="trash-outline" size={18} color={colors.negative} />
                    </Pressable>
                  ) : null}
                </View>
                <SegmentedControl
                  options={[
                    { value: 'in', label: 'Il/elle me doit' },
                    { value: 'out', label: 'Je lui dois' },
                  ]}
                  value={p.direction}
                  onChange={(v) => updateRow(setParties, p.key, { direction: v })}
                />
                <TextField label="Nom" value={p.name} onChangeText={(v) => updateRow(setParties, p.key, { name: v })} placeholder={p.direction === 'in' ? 'ex. Mariama' : 'ex. Grossiste Kaloum'} />
                <AmountField label="Montant" value={p.amount} onChangeText={(v) => updateRow(setParties, p.key, { amount: v })} placeholder="0" suffix={currency} />
                <TextField label="Téléphone (facultatif)" value={p.phone} onChangeText={(v) => updateRow(setParties, p.key, { phone: v })} keyboardType="phone-pad" placeholder="ex. 622123456" />
              </Card>
            ))}
            <Button label="+ Ajouter une personne" variant="secondary" onPress={() => setParties((rows) => [...rows, emptyParty()])} />
          </>
        ) : null}

        {step === 3 ? (
          <>
            <Text style={styles.lead}>Voici ce avec quoi tu démarres. Vérifie, puis valide : tout est enregistré d'un coup.</Text>
            <Summary currency={currency} cash={String(cashTotal)} stock={String(stockTotal)} receivable={String(receivable)} payable={String(payable)} />
            <Text style={styles.hint}>
              {filledProducts.length} produit{filledProducts.length > 1 ? 's' : ''} · {filledParties.length} personne
              {filledParties.length > 1 ? 's' : ''}. Rien de tout ça ne compte dans ton bénéfice : ce sont tes affaires d'avant Bénef.
            </Text>
          </>
        ) : null}

        {error ? <Alert message={error} /> : null}

        <View style={styles.nav}>
          {step > 0 ? <Button label="Retour" variant="secondary" onPress={() => goTo((step - 1) as Step)} style={styles.navButton} /> : null}
          {step < 3 ? (
            <Button label="Suivant" onPress={next} style={styles.navButton} />
          ) : (
            <Button label="Valider le démarrage" icon="checkmark-circle-outline" onPress={onSubmit} loading={saving} style={styles.navButton} />
          )}
        </View>
        {step < 3 ? (
          <Pressable onPress={() => goTo((step + 1) as Step)} style={styles.skip} accessibilityRole="button">
            <Text style={styles.skipText}>Passer cette étape</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => router.replace({ pathname: '/activity/[id]', params: { id } })} style={styles.skip} accessibilityRole="button">
            <Text style={styles.skipText}>Plus tard — je démarre de zéro</Text>
          </Pressable>
        )}
      </View>
    </Screen>
  );
}

function updateRow<T extends { key: number }>(setter: (fn: (rows: T[]) => T[]) => void, key: number, patch: Partial<T>) {
  setter((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
}

/** Message lisible à partir des erreurs par ligne renvoyées par l'API. */
function describeError(e: unknown): string {
  if (!(e instanceof ApiError)) return 'Enregistrement impossible.';
  const body = e.body as Record<string, unknown> | null;
  const labels: Record<string, string> = { cash: 'Argent', products: 'Produit', parties: 'Personne' };
  if (body && typeof body === 'object') {
    for (const [field, value] of Object.entries(body)) {
      if (Array.isArray(value)) {
        const index = value.findIndex((v) => v && typeof v === 'object' && Object.keys(v as object).length > 0);
        if (index >= 0) {
          const first = Object.values(value[index] as Record<string, string[]>)[0];
          return `${labels[field] ?? field} ${index + 1} : ${Array.isArray(first) ? first[0] : String(first)}`;
        }
        if (typeof value[0] === 'string') return value[0];
      }
    }
  }
  return e.message;
}

function Summary({ currency, cash, stock, receivable, payable }: { currency: string; cash: string; stock: string; receivable: string; payable: string }) {
  const total = Number(cash) + Number(stock) + Number(receivable) - Number(payable);
  const line = (label: string, value: string, color?: string) => (
    <View style={styles.sumRow}>
      <Text style={styles.sumLabel}>{label}</Text>
      <Text style={[styles.sumValue, color ? { color } : null]}>{formatAmount(value, currency)}</Text>
    </View>
  );
  return (
    <Card style={styles.card}>
      {line('Argent dans tes caisses', cash)}
      {line('Marchandise (à son coût)', stock)}
      {line('On te doit', receivable, colors.positive)}
      {line('Tu dois', payable, colors.negative)}
      <View style={[styles.sumRow, styles.sumTotal]}>
        <Text style={[styles.sumLabel, { fontWeight: '800', color: colors.textPrimary }]}>Ce que vaut ton affaire</Text>
        <Text style={[styles.sumValue, { fontSize: fontSize.lg }]}>{formatAmount(total, currency)}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  steps: { flexDirection: 'row', gap: spacing.sm },
  stepItem: { flex: 1, gap: 4 },
  stepBar: { height: 4, borderRadius: 999, backgroundColor: colors.placeholder },
  stepBarDone: { backgroundColor: colors.accent },
  stepLabel: { fontSize: 10.5, color: colors.textTertiary, fontWeight: '600' },
  stepLabelActive: { color: colors.accent },
  lead: { fontSize: fontSize.md, color: colors.textSecondary, lineHeight: 21 },
  card: { gap: spacing.md },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowTitle: { fontSize: fontSize.sm, fontWeight: '800', color: colors.accent },
  twoCols: { flexDirection: 'row', gap: spacing.sm },
  col: { flex: 1 },
  hint: { fontSize: fontSize.xs, color: colors.textTertiary, lineHeight: 17 },
  nav: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  navButton: { flex: 1 },
  skip: { alignItems: 'center', paddingVertical: spacing.sm },
  skipText: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textSecondary },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sumLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  sumValue: { fontSize: fontSize.md, fontWeight: '700', color: colors.textPrimary },
  sumTotal: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
});
