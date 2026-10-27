import { AmountInput } from '@/components/ui/AmountInput';
import { Field } from '@/components/ui/Field';
import { formatStock } from '@/components/UnitSelect';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { formatAmount } from '@/lib/money';

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
        ? `Transport, douane… soit ${formatAmount(amount * quantity, currency)} pour les ${formatStock(quantity, unit)}.`
        : `Transport, douane… soit ${formatAmount(amount / quantity, currency)} par ${unit}.`
      : 'Transport, douane… ajoutés au coût de chaque unité.';
  return (
    <Field label={label} hint={hint}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <SegmentedControl
          options={[
            { value: 'unit', label: `Par ${unit}` },
            { value: 'lot', label: 'Pour tout le lot' },
          ]}
          value={mode}
          onChange={onModeChange}
        />
        <div style={{ flex: 1, minWidth: 140 }}>
          <AmountInput value={value} onChange={onChange} placeholder="0" aria-label={label} />
        </div>
      </div>
    </Field>
  );
}
