import { normalizeGuineaPhone } from '@/lib/phone';
import { TextField } from './TextField';

interface PhoneFieldProps {
  label?: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string;
}

/** Numéro de téléphone guinéen : ne garde que les chiffres pendant la
 * saisie, plafonné à 9 (61/62/65/66 + 7 chiffres). Le format exact
 * (préfixe valide) reste vérifié côté serveur, avec un message clair. */
export function PhoneField({ label = 'Téléphone (facultatif)', value, onChangeText, error }: PhoneFieldProps) {
  return (
    <TextField
      label={label}
      value={value}
      onChangeText={(text) => onChangeText(normalizeGuineaPhone(text).slice(0, 9))}
      keyboardType="phone-pad"
      placeholder="ex. 622123456"
      error={error}
    />
  );
}
