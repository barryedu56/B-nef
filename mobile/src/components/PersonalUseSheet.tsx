import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import type { Product } from '@/api/types';
import { Button } from './ui/Button';
import { TextField } from './ui/TextField';
import { useCreatePersonalUse } from '@/hooks/useProducts';
import { formatAmount } from '@/lib/money';
import { colors, fontSize, radius, spacing } from '@/theme';

interface PersonalUseSheetProps {
  product: Product | null;
  activityId: number;
  currency: string;
  onClose: () => void;
}

/** Retire du stock une quantité gardée pour soi (pas vendue). Valorisée au
 * coût moyen actuel — pas de prix ni de moyen de paiement à saisir, ce n'est
 * pas une vente. Voir GUIDE-UTILISATEUR.md et la note de
 * `apps/inventory/services.py::consume_for_personal_use`. */
export function PersonalUseSheet({ product, activityId, currency, onClose }: PersonalUseSheetProps) {
  const consume = useCreatePersonalUse(activityId);
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!product) return null;

  const qty = Number(quantity.replace(',', '.'));
  const stock = Number(product.stock_quantity);
  const estimatedCost = qty > 0 ? qty * Number(product.purchase_price) : 0;

  const onSubmit = async () => {
    if (!qty || qty <= 0) {
      setError('Indique une quantité valide.');
      return;
    }
    if (qty > stock) {
      setError(`Il ne reste que ${product.stock_quantity} ${product.unit} en stock.`);
      return;
    }
    setError(null);
    try {
      await consume.mutateAsync({ product: product.id, quantity: String(qty), note: note.trim() });
      setQuantity('');
      setNote('');
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Impossible d'enregistrer.");
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Gardé pour moi</Text>
              <Text style={styles.subtitle}>{product.name}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.body}>
            <Text style={styles.currentStock}>Stock actuel : {product.stock_quantity}</Text>
            <TextField label={`Quantité (${product.unit})`} value={quantity} onChangeText={setQuantity} keyboardType="numeric" />
            {qty > 0 ? (
              <Text style={styles.estimate}>
                Valeur retirée du stock (au coût) : {formatAmount(estimatedCost, currency)}
              </Text>
            ) : null}
            <TextField label="Note (facultatif)" value={note} onChangeText={setNote} placeholder="ex. pour la maison" />

            <Text style={styles.hint}>
              Ça ne compte ni comme une vente, ni comme une charge — juste une ligne d'info séparée dans le
              rapport (« Consommé personnellement »). Le stock et sa valeur diminuent, ton Bénéfice net non.
            </Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Button label="Confirmer" onPress={onSubmit} loading={consume.isPending} />
          </View>
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
  estimate: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: '600' },
  hint: { fontSize: 11.5, color: colors.textTertiary, lineHeight: 16 },
  error: { fontSize: fontSize.sm, color: colors.negative },
});
