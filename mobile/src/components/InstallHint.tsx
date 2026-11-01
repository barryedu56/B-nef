import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { canPromptInstall, onInstallAvailabilityChange, promptInstall, shouldSuggestIosInstall } from '@/lib/pwa';
import { colors, fontSize, radius, spacing } from '@/theme';

const KEY = 'benef.installHintClosed';

/** Chrome sur iPhone (« CriOS ») : le bouton Partager est en haut à droite. */
const IN_IOS_CHROME = typeof navigator !== 'undefined' && /CriOS/.test(navigator.userAgent ?? '');

function closedBefore() {
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** Installer Bénef sur l'écran d'accueil depuis le navigateur : sur Android,
 * un vrai bouton (Chrome) ; sur iPhone, la marche à suivre dans Safari. */
export function InstallHint() {
  const [closed, setClosed] = useState(closedBefore);
  const [android, setAndroid] = useState(canPromptInstall);
  useEffect(() => onInstallAvailabilityChange(() => setAndroid(canPromptInstall())), []);

  const close = () => {
    try {
      window.localStorage.setItem(KEY, '1');
    } catch {
      // pas grave : l'aide réapparaîtra
    }
    setClosed(true);
  };

  if (closed) return null;
  if (android) {
    return (
      <View style={styles.box}>
        <Ionicons name="download-outline" size={22} color={colors.accent} />
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={styles.title}>Installe Bénef sur ton téléphone</Text>
          <Text style={styles.text}>Une icône sur l'écran d'accueil, et l'app s'ouvre même sans internet.</Text>
          <Pressable onPress={() => void promptInstall()} style={styles.button} accessibilityRole="button">
            <Text style={styles.buttonText}>Installer</Text>
          </Pressable>
        </View>
        <Pressable onPress={close} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fermer">
          <Ionicons name="close" size={18} color={colors.textTertiary} />
        </Pressable>
      </View>
    );
  }
  if (!shouldSuggestIosInstall()) return null;
  return (
    <View style={styles.box}>
      <Ionicons name="phone-portrait-outline" size={22} color={colors.accent} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.title}>Installe Bénef sur ton iPhone</Text>
        <Text style={styles.text}>
          Touche <Ionicons name="share-outline" size={13} color={colors.textSecondary} /> Partager{' '}
          {IN_IOS_CHROME ? 'en haut à droite de Chrome' : 'en bas de Safari'}, puis « Sur l'écran d'accueil ». Bénef s'ouvrira
          comme une app, même sans internet.
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
  button: { alignSelf: 'flex-start', backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 8 },
  buttonText: { color: colors.white, fontWeight: '700', fontSize: fontSize.sm },
});
