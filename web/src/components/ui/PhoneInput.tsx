import type { InputHTMLAttributes } from 'react'

import { normalizeGuineaPhone } from '@/lib/phone'

interface PhoneInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: string
  onChange: (raw: string) => void
}

/** Numéro de téléphone guinéen : ne garde que les chiffres pendant la
 * saisie, plafonné à 9 (61/62/65/66 + 7 chiffres). Le format exact
 * (préfixe valide) reste vérifié côté serveur, avec un message clair. */
export function PhoneInput({ value, onChange, placeholder, ...rest }: PhoneInputProps) {
  return (
    <input
      className="input"
      inputMode="numeric"
      value={value}
      onChange={(e) => onChange(normalizeGuineaPhone(e.target.value).slice(0, 9))}
      placeholder={placeholder ?? 'ex. 622123456'}
      {...rest}
    />
  )
}
