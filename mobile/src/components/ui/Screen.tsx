import { type ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';

import { colors } from '@/theme';

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  contentStyle?: ViewStyle;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export function Screen({ children, scroll = true, edges = ['top', 'bottom'], contentStyle, onRefresh, refreshing }: ScreenProps) {
  // Beaucoup d'écrans passent `edges={['top']}` (pas de bas) pour ne pas
  // doubler l'espace déjà réservé ailleurs — mais le contenu défilant, lui,
  // doit TOUJOURS pouvoir dépasser la barre de navigation/gestes Android en
  // bas de l'écran, sinon son dernier élément (souvent le bouton principal)
  // se retrouve masqué ou intouchable dessous. On ajoute donc l'inset bas
  // au padding du ScrollView quand `edges` ne le réserve pas déjà lui-même.
  const insets = useSafeAreaInsets();
  const extraBottomPadding = edges.includes('bottom') ? 0 : insets.bottom;

  if (!scroll) {
    return (
      <SafeAreaView style={styles.flex} edges={edges}>
        <View style={[styles.flex, contentStyle]}>{children}</View>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={styles.flex} edges={edges}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 32 + extraBottomPadding }, contentStyle]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.accent} /> : undefined
        }>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { flexGrow: 1, paddingBottom: 32 },
});
