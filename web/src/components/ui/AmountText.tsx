import { formatAmount } from '@/lib/money';

interface AmountTextProps {
  amount: string | number;
  currency: string;
  size?: number;
  sign?: 'positive' | 'negative' | 'neutral' | 'auto';
  decimals?: number;
  symbol?: string;
}

export function AmountText({ amount, currency, size = 15, sign = 'auto', decimals, symbol }: AmountTextProps) {
  const n = typeof amount === 'string' ? Number(amount) : amount;
  const resolvedSign = sign === 'auto' ? (n < 0 ? 'negative' : n > 0 ? 'positive' : 'neutral') : sign;
  const text = formatAmount(amount, currency, decimals, symbol);
  const prefixed = resolvedSign === 'positive' && n > 0 ? `+${text}` : text;
  const cls = ['amount', resolvedSign !== 'neutral' ? resolvedSign : ''].filter(Boolean).join(' ');
  return (
    <span className={cls} style={{ fontSize: size }}>
      {prefixed}
    </span>
  );
}
