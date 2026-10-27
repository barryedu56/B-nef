import { StyleSheet, Text, View } from 'react-native';

import { unitLabel } from '@/components/ProductCard';
import { AmountField } from '@/components/ui/AmountField';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { formatAmount } from '@/lib/money';
import { colors, fontSize } from '@/theme';

export type FeesMode = 'unit' | 'lot';

const num = (v: string) => Number((v || '0').replace(/\s/g, '').replace(',', '.')) || 0;

/** Frais du lot à envoyer au serveur (il les attend toujours pour tout le
 * lot, puis les répartit sur la quantité). */
export function feesTotal(mode: FeesMode, value: string, quantity: number): number {
  return mode === 'unit' ? num(value) * quantity : num(value);
}

/** Frais annexes (transport, douane…) saisis par unité ou pour tout le
 * lot, au choix ; l'équivalent dans l'autre sens s'affiche dessous. */
export function ExtraFeesField({
  value,
  onChange,
  mode,
  onModeChange,
  quantity,
  currency,
  unit = 'unité',
  label = 'Frais annexes (facultatif)',
}: {
  value: string;
  onChange: (value: string) => void;
  mode: FeesMode;
  onModeChange: (mode: FeesMode) => void;
  quantity: number;
  currency: string;
  unit?: string;
  label?: string;
}) {
  const amount = num(value);
  const hint =
    amount > 0 && quantity > 0
      ? mode === 'unit'
        ? `Transport, douane… soit ${formatAmount(amount * quantity, currency)} pour les ${quantity} ${unitLabel(quantity, unit)}.`
        : `Transport, douane… soit ${formatAmount(amount / quantity, currency)} par ${unit}.`
      : 'Transport, douane… ajoutés au coût de chaque unité.';
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <SegmentedControl
        options={[
          { value: 'unit', label: `Par ${unit}` },
          { value: 'lot', label: 'Pour tout le lot' },
        ]}
        value={mode}
        onChange={onModeChange}
      />
      <AmountField value={value} onChangeText={onChange} placeholder="0" suffix={currency} hint={hint} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: '600' },
});
