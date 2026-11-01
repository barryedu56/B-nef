import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { shouldSuggestIosInstall } from '@/lib/pwa';
import { colors, fontSize, radius, spacing } from '@/theme';

const KEY = 'benef.installHintClosed';

function closedBefore() {
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** Sur iPhone, dans Safari : comment installer Bénef sur l'écran d'accueil. */
export function InstallHint() {
  const [visible, setVisible] = useState(() => shouldSuggestIosInstall() && !closedBefore());
  if (!visible) return null;
  const close = () => {
    try {
      window.localStorage.setItem(KEY, '1');
    } catch {
      // pas grave : l'aide réapparaîtra
    }
    setVisible(false);
  };
  return (
    <View style={styles.box}>
      <Ionicons name="phone-portrait-outline" size={22} color={colors.accent} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.title}>Installe Bénef sur ton iPhone</Text>
        <Text style={styles.text}>
          Touche <Ionicons name="share-outline" size={13} color={colors.textSecondary} /> Partager en bas de Safari, puis
          « Sur l'écran d'accueil ». Bénef s'ouvrira comme une app, même sans internet.
        </Text>
      </View>
      <Pressable onPress={close} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fermer">
        <Ionicons name="close" size={18} color={colors.textTertiary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.accentSoft,
  },
  title: { fontSize: fontSize.sm, fontWeight: '800', color: colors.textPrimary },
  text: { fontSize: fontSize.xs, color: colors.textSecondary, lineHeight: 17 },
});
