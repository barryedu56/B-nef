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
import { useProduct, useUpdateProduct } from '@/hooks/useProducts';
import { colors, fontSize, spacing } from '@/theme';

export default function EditProductScreen() {
  const { productId } = useLocalSearchParams<{ id: string; productId: string }>();
  const id = Number(productId);

  const product = useProduct(id);
  const updateProduct = useUpdateProduct(id);

  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (product.data) {
      setName(product.data.name);
      setUnit(product.data.unit);
      setSalePrice(product.data.sale_price);
      setLowStockThreshold(product.data.low_stock_threshold ?? '');
    }
  }, [product.data]);

  if (product.isLoading) return <LoadingView label="Chargement du produit…" />;
  if (product.isError || !product.data) return <ErrorView message="Produit introuvable." onRetry={() => product.refetch()} />;

  const onSave = async () => {
    if (!name.trim()) {
      setError('Donne un nom à ce produit.');
      return;
    }
    setError(null);
    try {
      await updateProduct.mutateAsync({
        name: name.trim(),
        unit: unit.trim() || 'pièce',
        sale_price: salePrice || '0',
        low_stock_threshold: lowStockThreshold || null,
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
        <TextField label="Unité" value={unit} onChangeText={setUnit} placeholder="pièce, kg, sac, carton…" />
        <AmountField label="Prix de vente" value={salePrice} onChangeText={setSalePrice} placeholder="0" />
        <TextField
          label="Seuil d'alerte de stock (facultatif)"
          value={lowStockThreshold}
          onChangeText={setLowStockThreshold}
          keyboardType="numeric"
        />
        <Text style={styles.hint}>
          Le prix d'achat (coût moyen) et le stock ne se modifient pas ici — ils se mettent à jour tout seuls avec
          les réapprovisionnements et les ventes.
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button label="Enregistrer" onPress={onSave} loading={updateProduct.isPending} />

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
  archiveBlock: { gap: spacing.sm, marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
  archiveHint: { fontSize: 11.5, color: colors.textTertiary, lineHeight: 16 },
});
