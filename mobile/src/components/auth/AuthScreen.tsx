import type { ReactNode } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fontSize, radius, spacing } from '@/theme';

/** Écrans d'accès : bandeau indigo avec le logo, puis une feuille blanche
 * arrondie qui contient le formulaire. */
export function AuthScreen({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    // Android bord à bord (SDK 53+) : `padding` aussi, sinon le clavier cache les champs.
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'web' ? undefined : 'padding'}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        bounces={false}>
        <View style={[styles.hero, { paddingTop: insets.top + spacing.xxl }]}>
          <View style={[styles.bubble, styles.bubbleTop]} />
          <View style={[styles.bubble, styles.bubbleBottom]} />
          <View style={styles.brand}>
            <Image source={require('../../../assets/images/icon.png')} style={styles.logo} accessibilityIgnoresInvertColors />
            <Text style={styles.brandName}>Bénef</Text>
          </View>
          <Text style={styles.tagline}>Ton bénéfice réel, chaque jour.</Text>
        </View>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xxl }]}>
          <View style={styles.titles}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.accent },
  scroll: { flexGrow: 1 },
  hero: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xxl,
    paddingBottom: 56,
    overflow: 'hidden',
    gap: spacing.sm,
  },
  bubble: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.09)' },
  bubbleTop: { width: 260, height: 260, right: -90, top: -70 },
  bubbleBottom: { width: 160, height: 160, left: -60, bottom: -70, backgroundColor: 'rgba(109,40,217,0.45)' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  logo: { width: 48, height: 48, borderRadius: 14, borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)' },
  brandName: { fontSize: 26, fontWeight: '800', color: colors.white, letterSpacing: -0.5 },
  tagline: { fontSize: fontSize.md, color: 'rgba(255,255,255,0.85)' },
  sheet: {
    flexGrow: 1,
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl + 6,
    borderTopRightRadius: radius.xl + 6,
    marginTop: -28,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxl + 4,
    gap: spacing.xl,
  },
  titles: { gap: 6 },
  title: { fontSize: fontSize.xxl + 2, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: fontSize.md, color: colors.textSecondary, lineHeight: 21 },
});
