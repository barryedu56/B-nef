import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Product } from '@/api/types';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorView, LoadingView } from '@/components/ui/QueryState';
import { Screen } from '@/components/ui/Screen';
import { TopBar } from '@/components/ui/TopBar';
import { ProductActionSheet, type ProductAction } from '@/components/ProductActionSheet';
import { ProductCard } from '@/components/ProductCard';
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

  const [actionTarget, setActionTarget] = useState<Product | null>(null);

  const actionsFor = (product: Product): ProductAction[] => {
    if (showArchived) {
      return [
        {
          key: 'restore',
          icon: 'refresh-outline',
          title: 'Réactiver',
          description: 'Le produit revient dans la liste et dans les ventes.',
          onPress: () => updateProduct.mutate({ id: product.id, patch: { is_archived: false } }),
        },
      ];
    }
    return [
      {
        key: 'restock',
        icon: 'add-circle-outline',
        title: 'Réapprovisionner',
        description: 'Enregistrer un achat : le stock et le coût moyen se mettent à jour.',
        onPress: () => setRestockTarget(product),
      },
      {
        key: 'personal',
        icon: 'restaurant-outline',
        title: 'Gardé pour moi',
        description: 'Retirer du stock sans vente (consommation personnelle).',
        tone: 'warning',
        onPress: () => setPersonalUseTarget(product),
      },
      // Produit créé hors-ligne (numéro provisoire < 0) : pas encore de fiche
      // sur le serveur à modifier.
      ...(product.id > 0
        ? [
            {
              key: 'edit',
              icon: 'create-outline' as const,
              title: 'Modifier la fiche',
              description: 'Nom, prix de vente, seuil d’alerte, catégorie…',
              tone: 'neutral' as const,
              onPress: () =>
                router.push({ pathname: '/activity/[id]/products/[productId]', params: { id, productId: String(product.id) } }),
            },
          ]
        : []),
    ];
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
  const maxStock = Math.max(0, ...list.map((p) => Number(p.stock_quantity)));

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
          <View style={styles.list}>
            {filtered.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                currency={act.currency}
                maxStock={maxStock}
                onPress={() => setActionTarget(product)}
              />
            ))}
          </View>
        )}

        <Pressable
          onPress={() => router.push({ pathname: '/activity/[id]/products/new', params: { id } })}
          style={styles.addButton}>
          <Text style={styles.addButtonLabel}>+ Nouveau produit</Text>
        </Pressable>
      </View>

      <ProductActionSheet
        product={actionTarget}
        currency={act.currency}
        actions={actionTarget ? actionsFor(actionTarget) : []}
        onClose={() => setActionTarget(null)}
      />
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

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  list: { gap: spacing.sm + 2 },
  summaryRow: { flexDirection: 'row', gap: spacing.sm },
  summaryTile: { flex: 1, gap: 3 },
  summaryLabel: { fontSize: 11.5, color: colors.textSecondary },
  summaryValue: { fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  addButton: {
    minHeight: 52,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#c7cbf3',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonLabel: { fontSize: fontSize.md, fontWeight: '700', color: colors.accent },
});
