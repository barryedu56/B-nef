import { useQuery } from '@tanstack/react-query';

import { fetchCurrencies } from '@/api/currencies';
import type { Currency } from '@/api/types';

// Repli utilisé tant que /currencies/ n'a pas encore répondu (mêmes devises
// que celles semées côté serveur : GNF, XOF, USD, EUR).
const FALLBACK_DECIMALS: Record<string, number> = { GNF: 0, XOF: 0, USD: 2, EUR: 2 };
const FALLBACK_SYMBOLS: Record<string, string> = { GNF: 'FG', XOF: 'FCFA', USD: '$', EUR: '€' };

/** Regroupe des chiffres par milliers avec un espace : "1000000" -> "1 000 000". */
export function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function formatAmount(amount: string | number, code: string, decimals?: number, symbol?: string): string {
  const d = decimals ?? FALLBACK_DECIMALS[code] ?? 2;
  const n = typeof amount === 'string' ? Number(amount) : amount;
  if (Number.isNaN(n)) return `— ${code}`;
  const fixed = Math.abs(n).toFixed(d);
  const [intPart, decPart] = fixed.split('.');
  const withSeparators = groupThousands(intPart);
  const sign = n < 0 ? '-' : '';
  const s = symbol ?? FALLBACK_SYMBOLS[code] ?? code;
  const value = decPart ? `${withSeparators},${decPart}` : withSeparators;
  return `${sign}${value} ${s}`;
}

export function useCurrencies() {
  return useQuery({
    queryKey: ['currencies'],
    queryFn: fetchCurrencies,
    staleTime: 60 * 60 * 1000,
  });
}

export function useFormatMoney() {
  const { data } = useCurrencies();
  const byCode = new Map<string, Currency>((data ?? []).map((c) => [c.code, c]));
  return (amount: string | number, code: string) => {
    const currency = byCode.get(code);
    return formatAmount(amount, code, currency?.decimal_places, currency?.symbol);
  };
}
