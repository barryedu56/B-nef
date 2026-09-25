import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import type { Product } from '@/api/types';
import { PartyPicker } from './PartyPicker';
import { AmountField } from './ui/AmountField';
import { Button } from './ui/Button';
import { Chip } from './ui/Chip';
import { TextField } from './ui/TextField';
import { useCreatePurchase } from '@/hooks/useProducts';
import { usePaymentMethods } from '@/hooks/useTransactions';
import { formatAmount } from '@/lib/money';
import { colors, fontSize, radius, spacing } from '@/theme';

interface RestockSheetProps {
  product: Product | null;
  activityId: number;
  currency: string;
  hasDebts: boolean;
  onClose: () => void;
}

const DEFAULT_MARGIN = '30';

function defaultMargin(product: Product | null): string {
  if (!product) return DEFAULT_MARGIN;
  const cost = Number(product.purchase_price);
  const price = Number(product.sale_price);
  if (cost > 0 && price > 0) return String(Math.round(((price - cost) / cost) * 100));
  return DEFAULT_MARGIN;
}

export function RestockSheet({ product, activityId, currency, hasDebts, onClose }: RestockSheetProps) {
  const paymentMethods = usePaymentMethods();
  const createPurchase = useCreatePurchase(activityId);
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [extraFees, setExtraFees] = useState('');
  const [marginPct, setMarginPct] = useState(() => defaultMargin(product));
  const [manualPrice, setManualPrice] = useState<string | null>(null);
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [isCredit, setIsCredit] = useState(false);
  const [partyId, setPartyId] = useState<string | null>(null);
  const [amountPaidNow, setAmountPaidNow] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!product) return null;

  const qty = Number(quantity.replace(',', '.')) || 0;
  const cost = Number(unitCost.replace(',', '.')) || 0;
  const fees = extraFees ? Number(extraFees.replace(',', '.')) || 0 : 0;
  const landedUnitCost = qty > 0 ? cost + fees / qty : cost;
  const total = qty > 0 && cost >= 0 ? qty * cost + fees : 0;
  const paidNowValue = amountPaidNow ? Number(amountPaidNow.replace(',', '.')) : 0;

  const margin = Number(marginPct.replace(',', '.'));
  const derivedPrice = landedUnitCost > 0 && !Number.isNaN(margin) ? Math.round(landedUnitCost * (1 + margin / 100)) : 0;
  const salePrice = manualPrice !== null ? manualPrice : derivedPrice > 0 ? String(derivedPrice) : '';

  const onMarginChange = (v: string) => {
    setMarginPct(v);
    setManualPrice(null);
  };
  const onPriceChange = (v: string) => {
    setManualPrice(v);
    const p = Number(v.replace(',', '.'));
    if (landedUnitCost > 0 && !Number.isNaN(p) && p >= 0) {
      setMarginPct((((p - landedUnitCost) / landedUnitCost) * 100).toFixed(1));
    }
  };

  const onSubmit = async () => {
    if (!qty || qty <= 0 || !cost || cost < 0) {
      setError('Indique une quantité et un coût valides.');
      return;
    }
    if (isCredit && amountPaidNow && paidNowValue > total) {
      setError('Le montant payé maintenant dépasse le total de l’achat.');
      return;
    }
    setError(null);
    const salePriceValue = Number(salePrice.replace(',', '.'));
    try {
      await createPurchase.mutateAsync({
        product: product.id,
        quantity: String(qty),
        unit_cost: String(cost),
        extra_fees: fees > 0 ? String(fees) : undefined,
        cost_currency: currency,
        payment_method: paymentMethodId ? Number(paymentMethodId) : null,
        party: isCredit && partyId ? Number(partyId) : null,
        is_credit: isCredit,
        amount_paid_now: isCredit && paidNowValue > 0 ? String(paidNowValue) : undefined,
        sale_price: salePriceValue > 0 ? String(salePriceValue) : undefined,
      });
      setQuantity('');
      setUnitCost('');
      setExtraFees('');
      setManualPrice(null);
      setMarginPct(DEFAULT_MARGIN);
      setIsCredit(false);
      setPartyId(null);
      setAmountPaidNow('');
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Impossible d'enregistrer le réapprovisionnement.");
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Réapprovisionner</Text>
              <Text style={styles.subtitle}>{product.name}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={styles.currentStock}>
              Stock actuel : {product.stock_quantity} · coût moyen actuel : {product.purchase_price} {currency}
            </Text>
            <TextField label={`Quantité (${product.unit})`} value={quantity} onChangeText={setQuantity} keyboardType="numeric" />
            <AmountField label="Coût d'achat unitaire" value={unitCost} onChangeText={setUnitCost} suffix={currency} />
            <AmountField
              label="Frais annexes (facultatif)"
              value={extraFees}
              onChangeText={setExtraFees}
              placeholder="0"
              suffix={currency}
            />
            <Text style={styles.hint}>
              Transport, douane… pour tout le lot (pas par unité) — réparti automatiquement sur la quantité.
            </Text>

            {landedUnitCost > 0 ? (
              <View style={styles.priceBlock}>
                <Text style={styles.priceBlockTitle}>Prix de vente proposé</Text>
                <Text style={styles.landedCost}>
                  Coût de revient : {formatAmount(landedUnitCost, currency)} / {product.unit}
                </Text>
                <View style={styles.marginRow}>
                  <Text style={styles.label}>Marge souhaitée</Text>
                  <View style={styles.marginInputWrap}>
                    <TextInput
                      value={marginPct}
                      onChangeText={onMarginChange}
                      keyboardType="numeric"
                      style={styles.marginInput}
                    />
                    <Text style={styles.marginSuffix}>%</Text>
                  </View>
                </View>
                <AmountField label="Prix de vente" value={salePrice} onChangeText={onPriceChange} suffix={currency} />
                <Text style={styles.hint}>
                  Calculé à partir du coût de revient et de la marge — modifie l'un ou l'autre si ça ne te convient pas.
                </Text>
              </View>
            ) : null}

            <View style={{ gap: spacing.sm }}>
              <Text style={styles.label}>Moyen de paiement</Text>
              <View style={styles.chipRow}>
                {(paymentMethods.data ?? []).map((method) => (
                  <Chip
                    key={method.id}
                    label={method.name}
                    selected={paymentMethodId === String(method.id)}
                    onPress={() => setPaymentMethodId(String(method.id))}
                  />
                ))}
              </View>
            </View>

            {hasDebts ? (
              <View style={styles.creditRow}>
                <Text style={styles.label}>Achat à crédit</Text>
                <Switch value={isCredit} onValueChange={setIsCredit} trackColor={{ true: colors.accent, false: colors.borderStrong }} />
              </View>
            ) : null}
            {hasDebts && isCredit ? (
              <>
                <PartyPicker label="Fournisseur" kind="supplier" value={partyId} onChange={setPartyId} />
                <AmountField
                  label="Montant payé maintenant (facultatif)"
                  value={amountPaidNow}
                  onChangeText={setAmountPaidNow}
                  placeholder="0"
                  suffix={currency}
                />
                <Text style={styles.hint}>
                  Laisse à 0 si rien n'est payé tout de suite. Sinon, le reste devient ta dette envers ce fournisseur.
                </Text>
              </>
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Button label="Enregistrer le réapprovisionnement" onPress={onSubmit} loading={createPurchase.isPending} />
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, maxHeight: '85%' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textPrimary },
  subtitle: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  body: { padding: spacing.lg, gap: spacing.md },
  currentStock: { fontSize: fontSize.xs, color: colors.textTertiary },
  label: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: '500' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  creditRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  hint: { fontSize: 11.5, color: colors.textTertiary },
  error: { fontSize: fontSize.sm, color: colors.negative },
  priceBlock: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  priceBlockTitle: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textPrimary },
  landedCost: { fontSize: fontSize.xs, color: colors.textSecondary },
  marginRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  marginInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card,
    gap: 4,
    minWidth: 76,
  },
  marginInput: { flex: 1, minHeight: 40, fontSize: fontSize.md, color: colors.textPrimary, textAlign: 'right' },
  marginSuffix: { fontSize: fontSize.sm, color: colors.textTertiary },
});
