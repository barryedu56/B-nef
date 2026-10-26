import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing } from '@/theme';

/** Feuille qui monte du bas de l'écran (sélecteurs, réappro…).
 *
 * - Le clavier la pousse vers le haut au lieu de cacher les champs (Android
 *   s'affiche bord à bord depuis le SDK 53 : il ne réduit plus la fenêtre
 *   tout seul, d'où `behavior="padding"` sur les deux plateformes).
 * - Sa marge du bas vient de la vraie hauteur de la barre de navigation du
 *   téléphone : les boutons ne passent jamais dessous.
 * - Toucher le fond sombre la ferme. */
export function SheetModal({
  visible = true,
  onClose,
  style,
  children,
}: {
  visible?: boolean;
  onClose: () => void;
  style?: ViewStyle;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'web' ? undefined : 'padding'}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fermer" />
        <View style={[style, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>{children}</View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(22,24,39,0.45)', justifyContent: 'flex-end' },
});
