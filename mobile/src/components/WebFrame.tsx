import type { ReactNode } from 'react';
import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { colors, fontSize, spacing } from '@/theme';

const PHONE_WIDTH = 440;

/** Dans un navigateur d'ordinateur, l'app téléphone s'affiche dans une colonne
 * centrée de la taille d'un téléphone (étirée sur 1 920 px, les champs et
 * boutons devenaient immenses). Sur téléphone et en natif : rien ne change.
 * Pour travailler sur ordinateur, l'app web (dossier web/) est faite pour. */
export function WebFrame({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  if (Platform.OS !== 'web' || width < PHONE_WIDTH + 80) return <>{children}</>;
  return (
    <View style={styles.backdrop}>
      <View style={styles.phone}>{children}</View>
      {width >= PHONE_WIDTH + 640 ? (
        <Text style={styles.note}>
          Version téléphone de Bénef.{'\n'}Sur ordinateur, l'app web offre des tableaux et des écrans plus larges.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e9e8fb',
    paddingVertical: spacing.lg,
  },
  phone: {
    flex: 1,
    width: PHONE_WIDTH,
    maxHeight: 940,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: colors.bg,
    boxShadow: '0 24px 60px rgba(49, 46, 129, 0.25)',
  },
  note: {
    position: 'absolute',
    left: spacing.xl,
    bottom: spacing.xl,
    maxWidth: 260,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    lineHeight: 17,
  },
});
