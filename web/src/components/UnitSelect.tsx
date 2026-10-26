import { List } from 'lucide-react';
import { useState } from 'react';

import { Field, Select, TextInput } from '@/components/ui/Field';

/** Unités proposées (valeur enregistrée au singulier). Même liste que l'app
 * mobile (mobile/src/components/UnitField.tsx). */
export const UNIT_OPTIONS = [
  { value: 'pièce', label: 'Pièce' },
  { value: 'kg', label: 'Kilogramme (kg)' },
  { value: 'g', label: 'Gramme (g)' },
  { value: 'litre', label: 'Litre' },
  { value: 'ml', label: 'Millilitre (ml)' },
  { value: 'sac', label: 'Sac' },
  { value: 'carton', label: 'Carton' },
  { value: 'paquet', label: 'Paquet' },
  { value: 'boîte', label: 'Boîte' },
  { value: 'bouteille', label: 'Bouteille' },
  { value: 'bidon', label: 'Bidon' },
  { value: 'douzaine', label: 'Douzaine' },
  { value: 'mètre', label: 'Mètre' },
  { value: 'tas', label: 'Tas' },
];

const OTHER = '__autre__';

/** Choix de l'unité dans une liste, avec « Autre unité… » pour en saisir
 * une absente de la liste. `compact` : sans libellé, pour une cellule de
 * tableau (le champ libre remplace alors la liste, avec un retour à la liste). */
export function UnitSelect({ value, onChange, compact }: { value: string; onChange: (unit: string) => void; compact?: boolean }) {
  const known = UNIT_OPTIONS.some((o) => o.value === value);
  const [chooseOther, setChooseOther] = useState(false);
  const custom = chooseOther || (!known && value !== '');

  const select = (
    <Select
      options={[...UNIT_OPTIONS, { value: OTHER, label: 'Autre unité…' }]}
      value={custom ? OTHER : value}
      aria-label="Unité"
      onChange={(v) => {
        if (v === OTHER) {
          setChooseOther(true);
          onChange(known ? '' : value);
        } else {
          setChooseOther(false);
          onChange(v);
        }
      }}
    />
  );

  if (compact) {
    if (!custom) return select;
    return (
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <TextInput value={value} onChange={(e) => onChange(e.target.value)} placeholder="ex. seau" maxLength={20} aria-label="Nom de l'unité" autoFocus={chooseOther} />
        <button
          type="button"
          className="icon-btn"
          title="Revenir à la liste"
          aria-label="Revenir à la liste des unités"
          onClick={() => {
            setChooseOther(false);
            onChange('pièce');
          }}>
          <List size={16} />
        </button>
      </div>
    );
  }

  return (
    <>
      <Field label="Unité">{select}</Field>
      {custom ? (
        <Field label="Nom de l'unité">
          <TextInput value={value} onChange={(e) => onChange(e.target.value)} placeholder="ex. régime, seau, rouleau" maxLength={20} autoFocus />
        </Field>
      ) : null}
    </>
  );
}

/** « 30.000 » + « pièce » → « 30 pièces » (abréviations kg, L, ml… et
 * unités déjà au pluriel inchangées). */
export function formatStock(quantity: string | number, unit: string) {
  const n = Number(quantity);
  const plural = Math.abs(n) >= 2 && unit.length > 2 && !/[sx]$/i.test(unit);
  return `${n.toLocaleString('fr-FR', { maximumFractionDigits: 3 })} ${plural ? `${unit}s` : unit}`;
}
