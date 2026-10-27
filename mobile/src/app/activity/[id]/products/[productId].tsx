import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { AmountField } from '@/components/ui/AmountField';
import { Button } from '@/components/ui/Button';
import { ErrorView, LoadingView } from '@/components/ui/QueryState';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { TopBar } from '@/components/ui/TopBar';
import { useActivity } from '@/hooks/useActivities';
import { useAdjustStock, useProduct, useUpdateProduct } from '@/hooks/useProducts';
import { ExtraFeesField, feesTotal, type FeesMode } from '@/components/ExtraFeesField';
import { Card } from '@/components/ui/Card';
import { formatAmount } from '@/lib/money';
import { colors, fontSize, spacing } from '@/theme';
import { UnitField } from '@/components/UnitField';

export default function EditProductScreen() {
  const { id: activityParam, productId } = useLocalSearchParams<{ id: string; productId: string }>();
  const id = Number(productId);
  const adjust = useAdjustStock(Number(activityParam));
  const activity = useActivity(Number(activityParam));
  const currency = activity.data?.currency ?? '';

  const product = useProduct(id);
  const updateProduct = useUpdateProduct(id);

  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Stock de départ (corrigeable tant qu'il n'y a ni vente ni réappro).
  const [stockQty, setStockQty] = useState('');
  const [stockCost, setStockCost] = useState('');
  const [stockFees, setStockFees] = useState('');
  const [feesMode, setFeesMode] = useState<FeesMode>('unit');
  const [stockDirty, setStockDirty] = useState(false);
  // Inventaire (ensuite) : quantité réellement comptée.
  const [counted, setCounted] = useState('');
  const [countDone, setCountDone] = useState<string | null>(null);

  useEffect(() => {
    if (product.data) {
      setName(product.data.name);
      setUnit(product.data.unit);
      setSalePrice(product.data.sale_price);
      setLowStockThreshold(product.data.low_stock_threshold ?? '');
      setStockQty(String(Number(product.data.stock_quantity)));
      setStockCost(String(Number(product.data.purchase_price)));
    }
  }, [product.data]);

  if (product.isLoading) return <LoadingView label="Chargement du produit…" />;
  if (product.isError || !product.data) return <ErrorView message="Produit introuvable." onRetry={() => product.refetch()} />;

  const onSave = async () => {
    if (!name.trim()) {
      setError('Donne un nom à ce produit.');
      return;
    }
    const qty = Number(stockQty.replace(',', '.')) || 0;
    const cost = Number(stockCost.replace(',', '.')) || 0;
    const correctStock = !!product.data?.can_edit_initial_stock && stockDirty;
    if (correctStock && qty > 0 && cost <= 0) {
      setError("Indique combien t'a coûté chaque unité de ce stock.");
      return;
    }
    setError(null);
    try {
      await updateProduct.mutateAsync({
        name: name.trim(),
        unit: unit.trim() || 'pièce',
        sale_price: salePrice || '0',
        low_stock_threshold: lowStockThreshold || null,
        ...(correctStock
          ? {
              initial_quantity: String(qty),
              initial_unit_cost: String(cost),
              initial_extra_fees: String(feesTotal(feesMode, stockFees, qty)),
            }
          : {}),
      });
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Impossible d'enregistrer.");
    }
  };

  const onArchive = () => {
    Alert.alert(
      'Archiver ce produit ?',
      "Il disparaîtra des listes actives, mais tout son historique (ventes, réappros) reste intact et consultable.",
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Archiver',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateProduct.mutateAsync({ is_archived: true });
              router.back();
            } catch (e) {
              setError(e instanceof ApiError ? e.message : "Impossible d'archiver ce produit.");
            }
          },
        },
      ]
    );
  };

  const p = product.data;

  return (
    <Screen scroll edges={['top']}>
      <TopBar title="Modifier le produit" back />
      <View style={styles.content}>
        <TextField label="Nom" value={name} onChangeText={setName} placeholder="ex. Sac de riz 25 kg" />
        <UnitField value={unit} onChange={setUnit} />
        <AmountField label="Prix de vente" value={salePrice} onChangeText={setSalePrice} placeholder="0" />
        <TextField
          label="Seuil d'alerte de stock (facultatif)"
          value={lowStockThreshold}
          onChangeText={setLowStockThreshold}
          keyboardType="numeric"
        />
        {p.can_edit_initial_stock ? (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Stock de départ</Text>
            <Text style={styles.hint}>
              Tu t'es trompé en le saisissant ? Corrige-le tant que le produit n'a ni vente ni réapprovisionnement : ni
              ta caisse ni ton bénéfice ne bougent.
            </Text>
            <TextField
              label={`Quantité en stock (${unit || 'pièce'})`}
              value={stockQty}
              onChangeText={(v) => {
                setStockQty(v);
                setStockDirty(true);
              }}
              keyboardType="numeric"
            />
            <AmountField
              label="Coût d'achat de chaque unité"
              value={stockCost}
              onChangeText={(v) => {
                setStockCost(v);
                setStockDirty(true);
              }}
              placeholder="0"
            />
            <ExtraFeesField
              value={stockFees}
              onChange={(v) => {
                setStockFees(v);
                setStockDirty(true);
              }}
              mode={feesMode}
              onModeChange={setFeesMode}
              quantity={Number(stockQty.replace(',', '.')) || 0}
              currency={currency}
              unit={unit || 'pièce'}
            />
          </Card>
        ) : (
          <Text style={styles.hint}>
            Le coût d'achat moyen se met à jour tout seul avec les réapprovisionnements. Pour corriger la quantité,
            fais un inventaire plus bas.
          </Text>
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button label="Enregistrer" onPress={onSave} loading={updateProduct.isPending} />

        {!p.can_edit_initial_stock ? (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Inventaire</Text>
            <Text style={styles.hint}>
              Compte ce que tu as vraiment. Selon Bénef : {Number(p.stock_quantity)} {p.unit}. L'écart (casse, vol,
              erreur) est enregistré comme une perte ou un surplus, au coût moyen ({formatAmount(p.purchase_price, currency)}).
            </Text>
            <TextField label={`Quantité comptée (${p.unit})`} value={counted} onChangeText={setCounted} keyboardType="numeric" placeholder="0" />
            {counted !== '' && !Number.isNaN(Number(counted.replace(',', '.'))) ? (
              <Text style={styles.diff}>
                {(() => {
                  const delta = Number(counted.replace(',', '.')) - Number(p.stock_quantity);
                  if (delta === 0) return '✓ Le stock est juste';
                  const value = Math.abs(delta) * Number(p.purchase_price);
                  return `${delta < 0 ? 'Perte' : 'Surplus'} de ${Math.abs(delta)} ${p.unit} · ${formatAmount(value, currency)}`;
                })()}
              </Text>
            ) : null}
            {countDone ? <Text style={styles.done}>{countDone}</Text> : null}
            <Button
              label="Enregistrer l'inventaire"
              variant="secondary"
              loading={adjust.isPending}
              onPress={async () => {
                const value = Number(counted.replace(',', '.'));
                if (counted === '' || Number.isNaN(value) || value < 0) {
                  setError('Indique la quantité que tu as comptée.');
                  return;
                }
                setError(null);
                try {
                  await adjust.mutateAsync({ product: id, new_quantity: String(value) });
                  setCountDone(`Stock mis à ${value} ${p.unit}.`);
                  setCounted('');
                } catch (e) {
                  setError(e instanceof ApiError ? e.message : "Impossible d'enregistrer l'inventaire.");
                }
              }}
            />
          </Card>
        ) : null}

        <View style={styles.archiveBlock}>
          <Text style={styles.archiveHint}>
            Ce produit ne se supprime pas (son historique de stock et de ventes doit rester consultable) — tu peux
            l'archiver à la place.
          </Text>
          <Button
            label={p.is_archived ? 'Réactiver ce produit' : 'Archiver ce produit'}
            variant={p.is_archived ? 'secondary' : 'danger'}
            onPress={
              p.is_archived
                ? () => updateProduct.mutate({ is_archived: false })
                : onArchive
            }
            loading={updateProduct.isPending}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  hint: { fontSize: fontSize.xs, color: colors.textTertiary },
  error: { fontSize: fontSize.sm, color: colors.negative },
  card: { gap: spacing.md },
  cardTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.textPrimary },
  diff: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textSecondary },
  done: { fontSize: fontSize.sm, fontWeight: '700', color: colors.positive },
  archiveBlock: { gap: spacing.sm, marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
  archiveHint: { fontSize: 11.5, color: colors.textTertiary, lineHeight: 16 },
});
