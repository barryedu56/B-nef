import { StyleSheet, Text, TextInput, View } from 'react-native';

import { groupThousands } from '@/lib/money';
import { colors, fontSize, radius, spacing } from '@/theme';

interface AmountFieldProps {
  label?: string;
  /** Valeur "brute" — chiffres, séparateur décimal `,` ou `.` éventuel, sans
   * espaces de regroupement. C'est ce que reçoit `onChangeText`, exactement
   * comme un `TextField` numérique classique (même convention qu'ailleurs
   * dans l'app : `amount.replace(',', '.')` avant `Number(...)`). */
  value: string;
  onChangeText: (raw: string) => void;
  placeholder?: string;
  suffix?: string;
  error?: string;
  editable?: boolean;
}

/** Champ de saisie de montant qui affiche les chiffres regroupés par
 * milliers pendant la frappe ("1000" -> "1 000") pour mieux les lire, tout
 * en exposant au parent la même valeur "brute" qu'un champ numérique
 * classique. */
export function AmountField({ label, value, onChangeText, placeholder, suffix, error, editable = true }: AmountFieldProps) {
  const display = formatDisplay(value);

  const handleChange = (text: string) => {
    onChangeText(cleanRaw(text));
  };

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputRow, !!error && styles.inputError, !editable && styles.inputDisabled]}>
        <TextInput
          value={display}
          onChangeText={handleChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          keyboardType="numeric"
          editable={editable}
          style={styles.input}
        />
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function cleanRaw(text: string): string {
  const stripped = text.replace(/[^\d.,-]/g, '');
  const negative = stripped.startsWith('-');
  let result = '';
  let sawSeparator = false;
  for (const ch of stripped) {
    if (ch === '-') continue;
    if (ch === '.' || ch === ',') {
      if (sawSeparator) continue;
      sawSeparator = true;
    }
    result += ch;
  }
  return (negative ? '-' : '') + result;
}

function formatDisplay(raw: string): string {
  if (!raw) return '';
  const negative = raw.startsWith('-');
  const body = negative ? raw.slice(1) : raw;
  const sepMatch = body.match(/[.,]/);
  let intPart = body;
  let decPart = '';
  let sep = '';
  if (sepMatch) {
    sep = sepMatch[0];
    const idx = body.indexOf(sep);
    intPart = body.slice(0, idx);
    decPart = body.slice(idx + 1);
  }
  const grouped = groupThousands(intPart.replace(/\D/g, ''));
  return (negative ? '-' : '') + grouped + (sep ? sep + decPart.replace(/\D/g, '') : '');
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: '500' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card,
    gap: spacing.sm,
  },
  input: { flex: 1, paddingVertical: 10, fontSize: fontSize.md, color: colors.textPrimary },
  suffix: { fontSize: fontSize.sm, color: colors.textTertiary },
  inputError: { borderColor: colors.negative },
  inputDisabled: { backgroundColor: colors.bg },
  error: { fontSize: fontSize.xs, color: colors.negative },
});
