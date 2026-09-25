import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { ApiError } from '@/api/client';
import type { Product } from '@/api/types';
import { AmountField } from '@/components/ui/AmountField';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingView } from '@/components/ui/QueryState';
import { PartyPicker } from '@/components/PartyPicker';
import { Screen } from '@/components/ui/Screen';
import { Stepper } from '@/components/ui/Stepper';
import { TopBar } from '@/components/ui/TopBar';
import { useActivity } from '@/hooks/useActivities';
import { useCreateSale, useProducts } from '@/hooks/useProducts';
import { usePaymentMethods } from '@/hooks/useTransactions';
import { formatAmount } from '@/lib/money';
import { colors, fontSize, radius, spacing } from '@/theme';

export default function NewSaleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const activityId = Number(id);

  const activity = useActivity(activityId);
  const products = useProducts(activityId);
  const paymentMethods = usePaymentMethods();
  const createSale = useCreateSale(activityId);

  const [search, setSearch] = useState('');
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [isCredit, setIsCredit] = useState(false);
  const [partyId, setPartyId] = useState<string | null>(null);
  const [amountPaidNow, setAmountPaidNow] = useState('');
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const list = products.data ?? [];
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter((p) => p.name.toLowerCase().includes(q));
  }, [products.data, search]);

  const cartLines = useMemo(() => {
    const list = products.data ?? [];
    return list
      .filter((p) => (quantities[p.id] ?? 0) > 0)
      .map((p) => ({ product: p, quantity: quantities[p.id] }));
  }, [products.data, quantities]);

  const total = cartLines.reduce((sum, line) => sum + line.quantity * Number(line.product.sale_price), 0);

  if (activity.isLoading || !activity.data) return <LoadingView />;
  const act = activity.data;

  const setQuantity = (productId: number, quantity: number) => {
    setQuantities((prev) => ({ ...prev, [productId]: Math.max(0, quantity) }));
  };

  const paidNowValue = amountPaidNow ? Number(amountPaidNow.replace(',', '.')) : 0;

  const onSubmit = async () => {
    if (cartLines.length === 0) {
      setError('Ajoute au moins un produit.');
      return;
    }
    if (isCredit && amountPaidNow && paidNowValue > total) {
      setError('Le montant payé maintenant dépasse le total de la vente.');
      return;
    }
    setError(null);
    try {
      await createSale.mutateAsync({
        activity: activityId,
        lines: cartLines.map((line) => ({ product: line.product.id, quantity: String(line.quantity) })),
        payment_method: paymentMethodId ? Number(paymentMethodId) : null,
        party: isCredit && partyId ? Number(partyId) : null,
        is_credit: isCredit,
        amount_paid_now: isCredit && paidNowValue > 0 ? String(paidNowValue) : undefined,
        sale_currency: act.currency,
      });
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Impossible d'enregistrer la vente.");
    }
  };

  return (
    <Screen scroll edges={['top']}>
      <TopBar title="Nouvelle vente" subtitle={act.name} back />
      <View style={styles.content}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={colors.textTertiary} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Rechercher un produit"
            placeholderTextColor={colors.textTertiary}
            style={styles.searchInput}
          />
        </View>

        {products.data && products.data.length === 0 ? (
          <EmptyState
            icon="cube-outline"
            title="Aucun produit"
            description="Ajoute d'abord des produits dans Produits & stock."
            actionLabel="Ajouter un produit"
            onAction={() => router.push({ pathname: '/activity/[id]/products/new', params: { id } })}
          />
        ) : (
          <View>
            {filtered.map((product) => (
              <ProductLine
                key={product.id}
                product={product}
                currency={act.currency}
                quantity={quantities[product.id] ?? 0}
                onChange={(qty) => setQuantity(product.id, qty)}
              />
            ))}
          </View>
        )}

        {cartLines.length > 0 ? (
          <Card tone="muted" style={styles.cartCard}>
            <View style={styles.cartRow}>
              <Text style={styles.cartLabel}>Sous-total · {cartLines.length} ligne{cartLines.length > 1 ? 's' : ''}</Text>
            </View>
            <View style={styles.cartTotalRow}>
              <Text style={styles.cartTotalLabel}>Total</Text>
              <Text style={styles.cartTotalValue}>{formatAmount(total, act.currency)}</Text>
            </View>
          </Card>
        ) : null}

        <Card style={styles.paymentCard}>
          <Text style={styles.sectionLabel}>Paiement</Text>
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

          {act.has_debts ? (
            <View style={styles.creditRow}>
              <Text style={styles.sectionLabel}>Vente à crédit</Text>
              <Switch value={isCredit} onValueChange={setIsCredit} trackColor={{ true: colors.accent, false: colors.borderStrong }} />
            </View>
          ) : null}
          {act.has_debts && isCredit ? (
            <>
              <PartyPicker label="Client" kind="client" value={partyId} onChange={setPartyId} />
              <AmountField
                label="Montant payé maintenant (facultatif)"
                value={amountPaidNow}
                onChangeText={setAmountPaidNow}
                placeholder="0"
                suffix={act.currency}
              />
              <Text style={styles.hint}>
                Laisse à 0 si rien n'est payé tout de suite. Sinon, le reste devient la créance du client.
              </Text>
            </>
          ) : null}
        </Card>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          label={cartLines.length > 0 ? `Valider la vente · ${formatAmount(total, act.currency)}` : 'Valider la vente'}
          onPress={onSubmit}
          loading={createSale.isPending}
          disabled={cartLines.length === 0}
        />
        <Text style={styles.note}>Le stock des produits vendus sera mis à jour automatiquement.</Text>
      </View>
    </Screen>
  );
}

function ProductLine({
  product,
  currency,
  quantity,
  onChange,
}: {
  product: Product;
  currency: string;
  quantity: number;
  onChange: (qty: number) => void;
}) {
  const stock = Number(product.stock_quantity);
  return (
    <View style={styles.productRow}>
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={1}>
          {product.name}
        </Text>
        <Text style={[styles.productMeta, stock <= 0 && styles.productMetaWarning]}>
          Stock {product.stock_quantity} · {formatAmount(product.sale_price, currency)} l’unité
        </Text>
      </View>
      <Stepper value={quantity} onChange={onChange} min={0} max={Math.max(stock, quantity)} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card,
  },
  searchInput: { flex: 1, minHeight: 44, fontSize: fontSize.md, color: colors.textPrimary },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  productInfo: { flex: 1, gap: 2 },
  productName: { fontSize: 13.5, fontWeight: '600', color: colors.textPrimary },
  productMeta: { fontSize: 11.5, color: colors.textTertiary },
  productMetaWarning: { color: colors.warning },
  cartCard: { gap: spacing.sm },
  cartRow: { flexDirection: 'row', justifyContent: 'space-between' },
  cartLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  cartTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    borderTopWidth: 1,
    borderTopColor: colors.borderStrong,
    paddingTop: spacing.sm,
  },
  cartTotalLabel: { fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary },
  cartTotalValue: { fontSize: fontSize.xl, fontWeight: '700', color: colors.textPrimary },
  paymentCard: { gap: spacing.md },
  sectionLabel: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: '500' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  creditRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  error: { fontSize: fontSize.sm, color: colors.negative },
  note: { fontSize: 11.5, color: colors.textTertiary, textAlign: 'center' },
  hint: { fontSize: 11.5, color: colors.textTertiary },
});
