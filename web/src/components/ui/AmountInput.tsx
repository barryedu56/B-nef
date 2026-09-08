import type { InputHTMLAttributes } from 'react'

import { groupThousands } from '@/lib/money'

interface AmountInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  /** Valeur "brute" — chiffres, séparateur décimal `,` ou `.` éventuel, sans
   * espaces de regroupement. Même convention qu'un champ numérique classique
   * (ex. `amount.replace(',', '.')` avant `Number(...)` côté appelant). */
  value: string
  onChange: (raw: string) => void
}

/** Champ de saisie de montant qui affiche les chiffres regroupés par
 * milliers pendant la frappe ("1000" -> "1 000") pour mieux les lire, tout
 * en exposant au parent la même valeur "brute" qu'un champ numérique
 * classique. */
export function AmountInput({ value, onChange, ...rest }: AmountInputProps) {
  const display = formatDisplay(value)
  return (
    <input
      className="input"
      inputMode="decimal"
      value={display}
      onChange={(e) => onChange(cleanRaw(e.target.value))}
      {...rest}
    />
  )
}

function cleanRaw(text: string): string {
  const stripped = text.replace(/[^\d.,-]/g, '')
  const negative = stripped.startsWith('-')
  let result = ''
  let sawSeparator = false
  for (const ch of stripped) {
    if (ch === '-') continue
    if (ch === '.' || ch === ',') {
      if (sawSeparator) continue
      sawSeparator = true
    }
    result += ch
  }
  return (negative ? '-' : '') + result
}

function formatDisplay(raw: string): string {
  if (!raw) return ''
  const negative = raw.startsWith('-')
  const body = negative ? raw.slice(1) : raw
  const sepMatch = body.match(/[.,]/)
  let intPart = body
  let decPart = ''
  let sep = ''
  if (sepMatch) {
    sep = sepMatch[0]
    const idx = body.indexOf(sep)
    intPart = body.slice(0, idx)
    decPart = body.slice(idx + 1)
  }
  const grouped = groupThousands(intPart.replace(/\D/g, ''))
  return (negative ? '-' : '') + grouped + (sep ? sep + decPart.replace(/\D/g, '') : '')
}
