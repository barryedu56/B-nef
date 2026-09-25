import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { TopBar } from '@/components/ui/TopBar';
import { useCreateProduct } from '@/hooks/useProducts';
import { colors, fontSize, spacing } from '@/theme';

export default function NewProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const activityId = Number(id);
  const createProduct = useCreateProduct();

  const [name, setName] = useState('');
  const [unit, setUnit] = useState('pièce');
  const [lowStockThreshold, setLowStockThreshold] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!name.trim()) {
      setError('Donne un nom à ce produit.');
      return;
    }
    setError(null);
    try {
      await createProduct.mutateAsync({
        activity: activityId,
        name: name.trim(),
        unit: unit.trim() || 'pièce',
        low_stock_threshold: lowStockThreshold || null,
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
        <TextField label="Unité" value={unit} onChangeText={setUnit} placeholder="pièce, kg, sac, carton…" />
        <TextField
          label="Seuil d'alerte de stock (facultatif)"
          value={lowStockThreshold}
          onChangeText={setLowStockThreshold}
          keyboardType="numeric"
        />
        <Text style={styles.hint}>
          Pas de prix ici : le coût d'achat et le prix de vente se règlent au premier réapprovisionnement, une fois
          que tu connais vraiment ton coût — l'appli te proposera un prix de vente à partir d'une marge.
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button label="Créer le produit" onPress={onSubmit} loading={createProduct.isPending} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  hint: { fontSize: fontSize.xs, color: colors.textTertiary },
  error: { fontSize: fontSize.sm, color: colors.negative },
});
