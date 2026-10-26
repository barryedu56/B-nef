import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Product } from '@/api/types';
import { Card } from '@/components/ui/Card';
import { formatAmount } from '@/lib/money';
import { colors, fontSize, radius, spacing } from '@/theme';

export type StockLevel = 'ok' | 'low' | 'out';

export function stockLevel(product: Product): StockLevel {
  if (Number(product.stock_quantity) <= 0) return 'out';
  return product.is_low_stock ? 'low' : 'ok';
}

export const STOCK_STYLE: Record<StockLevel, { label: string; fg: string; bg: string }> = {
  ok: { label: 'En stock', fg: colors.positive, bg: colors.positiveSoft },
  low: { label: 'Stock faible', fg: colors.warning, bg: colors.warningSoft },
  out: { label: 'Rupture', fg: colors.negative, bg: colors.negativeSoft },
};

/** « 10.000 » (3 décimales venant de l'API) → « 10 », « 2,5 ». */
export function formatQty(value: string | number) {
  return Number(value).toLocaleString('fr-FR', { maximumFractionDigits: 3 });
}

/** « 30 pièce » → « 30 pièces ». Les abréviations (kg, L, ml…) et les
 * unités déjà au pluriel restent telles quelles. */
export function unitLabel(quantity: string | number, unit: string) {
  const plural = Math.abs(Number(quantity)) >= 2 && unit.length > 2 && !/[sx]$/i.test(unit);
  return plural ? `${unit}s` : unit;
}

export function marginPercent(product: Product) {
  const sale = Number(product.sale_price);
  return sale > 0 ? Math.round((Number(product.margin) / sale) * 100) : null;
}

/** Carte produit : état du stock, prix, marge, et une jauge du stock (par
 * rapport au produit le mieux fourni de la liste). */
export function ProductCard({
  product,
  currency,
  maxStock,
  onPress,
}: {
  product: Product;
  currency: string;
  maxStock: number;
  onPress: () => void;
}) {
  const level = stockLevel(product);
  const st = STOCK_STYLE[level];
  const stock = Number(product.stock_quantity);
  const pct = marginPercent(product);
  const fill = maxStock > 0 ? Math.max(0, Math.min(1, stock / maxStock)) : 0;

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${product.name}, ${st.label}. Voir les actions`}>
      {({ pressed }) => (
        <Card style={pressed ? styles.pressed : styles.card}>
          <View style={styles.top}>
            <View style={[styles.initial, { backgroundColor: st.bg }]}>
              <Text style={[styles.initialText, { color: st.fg }]}>{product.name.trim().charAt(0).toUpperCase() || '?'}</Text>
            </View>
            <View style={styles.titleBlock}>
              <Text style={styles.name} numberOfLines={1}>
                {product.name}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {[product.category, product.sku].filter(Boolean).join(' · ') || `Unité : ${product.unit}`}
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: st.bg }]}>
              <Text style={[styles.badgeText, { color: st.fg }]}>{st.label}</Text>
            </View>
          </View>

          <View style={styles.stats}>
            <Stat label="Prix de vente" value={formatAmount(product.sale_price, currency)} />
            <Stat
              label="Marge"
              value={`${formatAmount(product.margin, currency)}${pct !== null ? ` · ${pct} %` : ''}`}
              color={Number(product.margin) < 0 ? colors.negative : colors.positive}
            />
            <Stat label="Stock" value={`${formatQty(stock)} ${unitLabel(stock, product.unit)}`} color={st.fg} align="right" />
          </View>

          <View style={styles.track}>
            <View style={[styles.fill, { width: `${fill * 100}%`, backgroundColor: st.fg }]} />
          </View>
          <View style={styles.footer}>
            <Text style={styles.footerText}>Valeur du stock : {formatAmount(product.stock_value, currency)}</Text>
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.textTertiary} />
          </View>
        </Card>
      )}
    </Pressable>
  );
}

function Stat({ label, value, color, align }: { label: string; value: string; color?: string; align?: 'right' }) {
  return (
    <View style={[styles.stat, align === 'right' && { alignItems: 'flex-end' }]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, color ? { color } : null]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  pressed: { gap: spacing.md, opacity: 0.88 },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  initial: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  initialText: { fontSize: 19, fontWeight: '800' },
  titleBlock: { flex: 1, gap: 2 },
  name: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textPrimary },
  meta: { fontSize: fontSize.xs, color: colors.textTertiary },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, gap: 2 },
  statLabel: { fontSize: 11, color: colors.textTertiary },
  statValue: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textPrimary },
  track: { height: 5, borderRadius: 999, backgroundColor: colors.placeholder, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerText: { fontSize: fontSize.xs, color: colors.textSecondary },
});
