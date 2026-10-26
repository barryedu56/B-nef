import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Product } from '@/api/types';
import { formatQty, marginPercent, STOCK_STYLE, stockLevel, unitLabel } from '@/components/ProductCard';
import { SheetModal } from '@/components/ui/SheetModal';
import { formatAmount } from '@/lib/money';
import { colors, fontSize, radius, spacing } from '@/theme';

export interface ProductAction {
  key: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  description: string;
  tone?: 'accent' | 'warning' | 'neutral';
  onPress: () => void;
}

const TONES = {
  accent: { fg: colors.accent, bg: colors.accentSoft },
  warning: { fg: colors.warning, bg: colors.warningSoft },
  neutral: { fg: colors.textSecondary, bg: colors.placeholder },
};

/** Actions sur un produit, dans une feuille qui monte du bas. Se ferme en
 * touchant le fond, avec le bouton retour du téléphone ou « Fermer » — sans
 * obliger à choisir une action. */
export function ProductActionSheet({
  product,
  currency,
  actions,
  onClose,
}: {
  product: Product | null;
  currency: string;
  actions: ProductAction[];
  onClose: () => void;
}) {
  if (!product) return null;
  const st = STOCK_STYLE[stockLevel(product)];
  const pct = marginPercent(product);

  const run = (action: ProductAction) => {
    onClose();
    // Laisse la feuille finir de se fermer avant d'en ouvrir une autre
    // (réappro…) : deux fenêtres modales animées en même temps se
    // bloquent, surtout sur iPhone.
    setTimeout(action.onPress, 320);
  };

  return (
    <SheetModal onClose={onClose} style={styles.sheet}>
      <View style={styles.handle} />
      <View style={styles.header}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.title} numberOfLines={2}>
            {product.name}
          </Text>
          <View style={[styles.badge, { backgroundColor: st.bg }]}>
            <Text style={[styles.badgeText, { color: st.fg }]}>
              {st.label} · {formatQty(product.stock_quantity)} {unitLabel(product.stock_quantity, product.unit)}
            </Text>
          </View>
        </View>
        <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Fermer" style={styles.close}>
          <Ionicons name="close" size={20} color={colors.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.figures}>
        <Figure label="Achat (coût moyen)" value={formatAmount(product.purchase_price, currency)} />
        <Figure label="Vente" value={formatAmount(product.sale_price, currency)} />
        <Figure label="Marge" value={pct !== null ? `${pct} %` : '—'} />
      </View>

      <View style={styles.actions}>
        {actions.map((action) => {
          const t = TONES[action.tone ?? 'accent'];
          return (
            <Pressable
              key={action.key}
              onPress={() => run(action)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}>
              <View style={[styles.actionIcon, { backgroundColor: t.bg }]}>
                <Ionicons name={action.icon} size={20} color={t.fg} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.actionTitle}>{action.title}</Text>
                <Text style={styles.actionDesc}>{action.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </Pressable>
          );
        })}
      </View>

      <Pressable onPress={onClose} style={styles.cancel} accessibilityRole="button">
        <Text style={styles.cancelText}>Fermer</Text>
      </Pressable>
    </SheetModal>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.figure}>
      <Text style={styles.figureLabel}>{label}</Text>
      <Text style={styles.figureValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.lg,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 999, backgroundColor: colors.borderStrong },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  title: { fontSize: fontSize.xl, fontWeight: '800', color: colors.textPrimary },
  badge: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11.5, fontWeight: '700' },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.placeholder, alignItems: 'center', justifyContent: 'center' },
  figures: { flexDirection: 'row', gap: spacing.sm },
  figure: { flex: 1, backgroundColor: colors.bg, borderRadius: radius.md, padding: spacing.md, gap: 3 },
  figureLabel: { fontSize: 11, color: colors.textTertiary },
  figureValue: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textPrimary },
  actions: { gap: spacing.sm },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  actionPressed: { backgroundColor: colors.bg },
  actionIcon: { width: 42, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  actionTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.textPrimary },
  actionDesc: { fontSize: fontSize.xs, color: colors.textSecondary },
  cancel: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: fontSize.md, fontWeight: '700', color: colors.textSecondary },
});
