const MONTHS_SHORT = [
  'janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc',
];
const MONTHS_LONG = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

export function todayISO(): string {
  return toISODate(new Date());
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** "2026-09-07" -> "aujourd'hui" / "hier" / "7 sept" / "7 sept 2025" */
export function formatRelativeDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffDays = Math.round((todayMidnight.getTime() - date.getTime()) / 86_400_000);

  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return 'Hier';
  const label = `${d} ${MONTHS_SHORT[m - 1]}`;
  return y === today.getFullYear() ? label : `${label} ${y}`;
}

export function formatLongDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS_LONG[m - 1]} ${y}`;
}

export function formatPeriodLabel(period: 'day' | 'week' | 'month' | 'year', anchorISO: string): string {
  const [y, m, d] = anchorISO.split('-').map(Number);
  if (period === 'year') return String(y);
  if (period === 'month') return `${MONTHS_LONG[m - 1]} ${y}`;
  if (period === 'day') return formatLongDate(anchorISO);
  return `Semaine du ${d} ${MONTHS_SHORT[m - 1]}`;
}

export function shiftAnchor(period: 'day' | 'week' | 'month' | 'year', anchorISO: string, delta: number): string {
  const [y, m, d] = anchorISO.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (period === 'day') date.setDate(date.getDate() + delta);
  else if (period === 'week') date.setDate(date.getDate() + delta * 7);
  else if (period === 'month') date.setMonth(date.getMonth() + delta);
  else date.setFullYear(date.getFullYear() + delta);
  return toISODate(date);
}
