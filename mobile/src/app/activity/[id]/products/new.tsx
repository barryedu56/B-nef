import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { ExtraFeesField, feesTotal, type FeesMode } from '@/components/ExtraFeesField';
import { UnitField } from '@/components/UnitField';
import { AmountField } from '@/components/ui/AmountField';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { TopBar } from '@/components/ui/TopBar';
import { useActivity } from '@/hooks/useActivities';
import { useCreateProduct } from '@/hooks/useProducts';
import { colors, fontSize, spacing } from '@/theme';

export default function NewProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const activityId = Number(id);
  const createProduct = useCreateProduct();

  const [name, setName] = useState('');
  const [unit, setUnit] = useState('pièce');
  const [lowStockThreshold, setLowStockThreshold] = useState('');
  const [hasStock, setHasStock] = useState(false);
  const [initialQty, setInitialQty] = useState('');
  const [initialCost, setInitialCost] = useState('');
  const [initialFees, setInitialFees] = useState('');
  const [feesMode, setFeesMode] = useState<FeesMode>('unit');
  const [salePrice, setSalePrice] = useState('');
  const activity = useActivity(activityId);
  const currency = activity.data?.currency ?? '';
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!name.trim()) {
      setError('Donne un nom à ce produit.');
      return;
    }
    const qty = hasStock ? Number(initialQty.replace(',', '.')) : 0;
    const cost = hasStock ? Number(initialCost.replace(',', '.')) : 0;
    if (hasStock && (!qty || qty <= 0 || !cost || cost <= 0)) {
      setError("Indique la quantité que tu as déjà et combien t'a coûté chaque unité.");
      return;
    }
    setError(null);
    try {
      await createProduct.mutateAsync({
        activity: activityId,
        name: name.trim(),
        unit: unit.trim() || 'pièce',
        low_stock_threshold: lowStockThreshold || null,
        ...(hasStock
          ? {
              initial_quantity: String(qty),
              initial_unit_cost: String(cost),
              ...(feesTotal(feesMode, initialFees, qty) > 0 ? { initial_extra_fees: String(feesTotal(feesMode, initialFees, qty)) } : {}),
              ...(salePrice ? { sale_price: salePrice.replace(',', '.') } : {}),
            }
          : {}),
      });
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Impossible de créer le produit.');
    }
  };

  return (
    <Screen scroll edges={['top']}>
      <TopBar title="Nouveau produit" back />
      <View style={styles.content}>
        <TextField label="Nom" value={name} onChangeText={setName} placeholder="ex. Sac de riz 25 kg" />
        <UnitField value={unit} onChange={setUnit} />
        <TextField
          label="Seuil d'alerte de stock (facultatif)"
          value={lowStockThreshold}
          onChangeText={setLowStockThreshold}
          keyboardType="numeric"
        />
        <Card style={styles.stockCard}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.switchLabel}>J'ai déjà ce produit en stock</Text>
              <Text style={styles.switchHint}>Marchandise achetée avant d'utiliser Bénef</Text>
            </View>
            <Switch value={hasStock} onValueChange={setHasStock} trackColor={{ true: colors.accent, false: colors.borderStrong }} />
          </View>
          {hasStock ? (
            <>
              <TextField label={`Quantité en stock (${unit || 'pièce'})`} value={initialQty} onChangeText={setInitialQty} keyboardType="numeric" placeholder="0" />
              <AmountField label="Coût d'achat de chaque unité" value={initialCost} onChangeText={setInitialCost} placeholder="0" suffix={currency} />
              <ExtraFeesField
                value={initialFees}
                onChange={setInitialFees}
                mode={feesMode}
                onModeChange={setFeesMode}
                quantity={Number(initialQty.replace(',', '.')) || 0}
                currency={currency}
                unit={unit || 'pièce'}
              />
              <AmountField label="Prix de vente" value={salePrice} onChangeText={setSalePrice} placeholder="0" suffix={currency} />
              <Text style={styles.hint}>
                Ce stock est compté à son coût (pour un bénéfice juste à la vente) sans toucher ta caisse : il a été payé
                avant Bénef.
              </Text>
            </>
          ) : (
            <Text style={styles.hint}>
              Sinon, le coût d'achat et le prix de vente se règlent au premier réapprovisionnement — l'appli te
              proposera un prix de vente à partir d'une marge.
            </Text>
          )}
        </Card>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button label="Créer le produit" onPress={onSubmit} loading={createProduct.isPending} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stockCard: { gap: spacing.md },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  switchLabel: { fontSize: fontSize.md, fontWeight: '700', color: colors.textPrimary },
  switchHint: { fontSize: fontSize.xs, color: colors.textTertiary },
  content: { padding: spacing.lg, gap: spacing.md },
  hint: { fontSize: fontSize.xs, color: colors.textTertiary },
  error: { fontSize: fontSize.sm, color: colors.negative },
});
