import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Product } from '@/api/types';
import { AmountText } from '@/components/ui/AmountText';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorView, LoadingView } from '@/components/ui/QueryState';
import { Screen } from '@/components/ui/Screen';
import { TopBar } from '@/components/ui/TopBar';
import { RestockSheet } from '@/components/RestockSheet';
import { PersonalUseSheet } from '@/components/PersonalUseSheet';
import { useActivity } from '@/hooks/useActivities';
import { useProducts, useUpdateProductInList } from '@/hooks/useProducts';
import { formatAmount } from '@/lib/money';
import { colors, fontSize, spacing } from '@/theme';

type Filter = 'all' | 'low' | 'out' | 'archived';

export default function ProductsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const activityId = Number(id);

  const activity = useActivity(activityId);
  const [filter, setFilter] = useState<Filter>('all');
  const showArchived = filter === 'archived';
  const products = useProducts(activityId, { archived: showArchived });
  const updateProduct = useUpdateProductInList(activityId);
  const [restockTarget, setRestockTarget] = useState<Product | null>(null);
  const [personalUseTarget, setPersonalUseTarget] = useState<Product | null>(null);

  const openActions = (product: Product) => {
    if (showArchived) {
      Alert.alert(product.name, 'Réactiver ce produit ?', [
        { text: 'Réactiver', onPress: () => updateProduct.mutate({ id: product.id, patch: { is_archived: false } }) },
        { text: 'Annuler', style: 'cancel' },
      ]);
      return;
    }
    Alert.alert(product.name, 'Que veux-tu faire ?', [
      { text: 'Réapprovisionner', onPress: () => setRestockTarget(product) },
      { text: 'Gardé pour moi', onPress: () => setPersonalUseTarget(product) },
      {
        text: 'Modifier',
        onPress: () => router.push({ pathname: '/activity/[id]/products/[productId]', params: { id, productId: String(product.id) } }),
      },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  const list = products.data ?? [];
  const filtered = useMemo(() => {
    if (filter === 'low') return list.filter((p) => p.is_low_stock && Number(p.stock_quantity) > 0);
    if (filter === 'out') return list.filter((p) => Number(p.stock_quantity) <= 0);
    return list;
  }, [list, filter]);

  const lowCount = list.filter((p) => p.is_low_stock && Number(p.stock_quantity) > 0).length;
  const outCount = list.filter((p) => Number(p.stock_quantity) <= 0).length;
  const totalStockValue = list.reduce((sum, p) => sum + Number(p.stock_value), 0);

  if (activity.isLoading || products.isLoading) return <LoadingView label="Chargement des produits…" />;
  if (activity.isError || !activity.data) return <ErrorView message="Activité introuvable." onRetry={() => activity.refetch()} />;
  const act = activity.data;

  return (
    <Screen edges={['top']} onRefresh={() => products.refetch()} refreshing={products.isRefetching}>
      <TopBar title="Produits & stock" back />
      <View style={styles.content}>
        <View style={styles.summaryRow}>
          <Card style={styles.summaryTile}>
            <Text style={styles.summaryLabel}>Valeur du stock</Text>
            <Text style={styles.summaryValue}>{formatAmount(totalStockValue, act.currency)}</Text>
          </Card>
          <Card style={styles.summaryTile}>
            <Text style={styles.summaryLabel}>Références</Text>
            <Text style={styles.summaryValue}>{list.length}</Text>
          </Card>
        </View>

        <View style={styles.chipRow}>
          <Chip label="Tous" selected={filter === 'all'} onPress={() => setFilter('all')} />
          <Chip label={`Stock faible · ${lowCount}`} tone="warning" selected={filter === 'low'} onPress={() => setFilter('low')} />
          <Chip label={`Rupture · ${outCount}`} tone="negative" selected={filter === 'out'} onPress={() => setFilter('out')} />
          <Chip label="Archivés" selected={filter === 'archived'} onPress={() => setFilter('archived')} />
        </View>

        {filtered.length === 0 ? (
          <EmptyState
            icon="cube-outline"
            title={list.length === 0 ? (showArchived ? 'Aucun produit archivé' : 'Aucun produit') : 'Rien à afficher pour ce filtre'}
            actionLabel={!showArchived && list.length === 0 ? 'Ajouter un produit' : undefined}
            onAction={!showArchived && list.length === 0 ? () => router.push({ pathname: '/activity/[id]/products/new', params: { id } }) : undefined}
          />
        ) : (
          <View>
            {filtered.map((product) => (
              <ProductRow key={product.id} product={product} currency={act.currency} onPress={() => openActions(product)} />
            ))}
          </View>
        )}

        <Pressable
          onPress={() => router.push({ pathname: '/activity/[id]/products/new', params: { id } })}
          style={styles.addButton}>
          <Text style={styles.addButtonLabel}>+ Nouveau produit</Text>
        </Pressable>
      </View>

      <RestockSheet
        product={restockTarget}
        activityId={activityId}
        currency={act.currency}
        hasDebts={act.has_debts}
        onClose={() => setRestockTarget(null)}
      />
      <PersonalUseSheet
        product={personalUseTarget}
        activityId={activityId}
        currency={act.currency}
        onClose={() => setPersonalUseTarget(null)}
      />
    </Screen>
  );
}

function ProductRow({ product, currency, onPress }: { product: Product; currency: string; onPress: () => void }) {
  const stock = Number(product.stock_quantity);
  const stockLabel = stock <= 0 ? `${product.stock_quantity} · rupture` : product.is_low_stock ? `${product.stock_quantity} · faible` : `${product.stock_quantity} en stock`;
  const stockColor = stock <= 0 ? colors.negative : product.is_low_stock ? colors.warning : colors.textPrimary;

  return (
    <Pressable onPress={onPress} style={styles.productRow}>
      <View style={styles.productThumb} />
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={1}>
          {product.name}
        </Text>
        <Text style={styles.productMeta}>
          Achat {formatAmount(product.purchase_price, currency)} · Vente {formatAmount(product.sale_price, currency)}
        </Text>
      </View>
      <View style={styles.productStockCol}>
        <Text style={[styles.productStock, { color: stockColor }]}>{stockLabel}</Text>
        <AmountText amount={product.margin} currency={currency} size={11} sign="positive" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  summaryRow: { flexDirection: 'row', gap: spacing.sm },
  summaryTile: { flex: 1, gap: 3 },
  summaryLabel: { fontSize: 11.5, color: colors.textSecondary },
  summaryValue: { fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  productThumb: { width: 40, height: 40, borderRadius: 8, backgroundColor: colors.placeholder, flexShrink: 0 },
  productInfo: { flex: 1, gap: 2 },
  productName: { fontSize: 13.5, fontWeight: '600', color: colors.textPrimary },
  productMeta: { fontSize: 11.5, color: colors.textTertiary },
  productStockCol: { alignItems: 'flex-end', gap: 2 },
  productStock: { fontSize: 13, fontWeight: '600' },
  addButton: {
    minHeight: 44,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.accent },
});
