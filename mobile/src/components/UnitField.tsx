import { useState } from 'react';
import { View } from 'react-native';

import { PickerField } from '@/components/ui/PickerField';
import { TextField } from '@/components/ui/TextField';

/** Unités proposées à la création d'un produit (valeur enregistrée, au
 * singulier — le pluriel est fait à l'affichage). */
export const UNIT_OPTIONS = [
  { value: 'pièce', label: 'Pièce', description: 'Article vendu à l’unité' },
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
 * une absente de la liste. */
export function UnitField({ value, onChange }: { value: string; onChange: (unit: string) => void }) {
  const known = UNIT_OPTIONS.some((o) => o.value === value);
  const [chooseOther, setChooseOther] = useState(false);
  // Une unité hors liste (fiche existante, chargée après l'affichage) ouvre
  // d'elle-même le champ libre.
  const custom = chooseOther || (!known && value !== '');

  return (
    <View style={{ gap: 10 }}>
      <PickerField
        label="Unité"
        value={custom ? OTHER : value}
        options={[...UNIT_OPTIONS, { value: OTHER, label: 'Autre unité…', description: 'La saisir soi-même' }]}
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
      {custom ? (
        <TextField
          label="Nom de l'unité"
          value={value}
          onChangeText={onChange}
          placeholder="ex. régime, seau, rouleau"
          autoCapitalize="none"
          maxLength={20}
        />
      ) : null}
    </View>
  );
}
