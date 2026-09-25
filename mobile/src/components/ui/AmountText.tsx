import { StyleSheet, Text, type TextStyle } from 'react-native';

import { colors } from '@/theme';
import { formatAmount } from '@/lib/money';

interface AmountTextProps {
  amount: string | number;
  currency: string;
  size?: number;
  weight?: TextStyle['fontWeight'];
  sign?: 'positive' | 'negative' | 'neutral' | 'auto';
  decimals?: number;
  symbol?: string;
  style?: TextStyle;
}

export function AmountText({ amount, currency, size = 15, weight = '600', sign = 'auto', decimals, symbol, style }: AmountTextProps) {
  const n = typeof amount === 'string' ? Number(amount) : amount;
  const resolvedSign = sign === 'auto' ? (n < 0 ? 'negative' : n > 0 ? 'positive' : 'neutral') : sign;
  const text = formatAmount(amount, currency, decimals, symbol);
  const prefixed = resolvedSign === 'positive' && n > 0 ? `+${text}` : text;
  return (
    <Text style={[styles.base, { fontSize: size, fontWeight: weight, color: colorFor(resolvedSign) }, style]}>
      {prefixed}
    </Text>
  );
}

function colorFor(sign: 'positive' | 'negative' | 'neutral') {
  if (sign === 'positive') return colors.positive;
  if (sign === 'negative') return colors.negative;
  return colors.textPrimary;
}

const styles = StyleSheet.create({
  base: { fontVariant: ['tabular-nums'] },
});
