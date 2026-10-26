import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Redirect, Tabs } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LoadingView } from '@/components/ui/QueryState';
import { useAuth } from '@/context/AuthContext';
import { colors } from '@/theme';

const TAB_BAR_CONTENT_HEIGHT = 62;

/** Icône d'onglet : couleur du thème selon l'onglet actif (mêmes valeurs
 * que tabBarActiveTintColor / tabBarInactiveTintColor). */
function tabIcon(name: ComponentProps<typeof Ionicons>['name']) {
  return ({ focused, size }: { focused: boolean; size: number }) => (
    <Ionicons name={name} size={size} color={focused ? colors.accent : colors.textTertiary} />
  );
}

export default function TabsLayout() {
  const { status } = useAuth();
  // La barre par défaut de React Navigation laisse souvent un grand bandeau
  // blanc sous les icônes sur Android (elle sur-estime la zone de sécurité).
  // On calcule sa hauteur nous-mêmes à partir de l'encoche réelle du téléphone.
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 8);

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <LoadingView />
      </View>
    );
  }
  if (status === 'signedOut') return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          borderTopColor: colors.border,
          backgroundColor: colors.card,
          height: TAB_BAR_CONTENT_HEIGHT + bottomInset,
          paddingTop: 8,
          paddingBottom: bottomInset,
        },
        tabBarItemStyle: { paddingTop: 2 },
        tabBarIconStyle: { marginBottom: -2 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', marginTop: 2 },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Activités',
          tabBarIcon: tabIcon('home-outline'),
        }}
      />
      <Tabs.Screen
        name="global"
        options={{
          title: 'Vue globale',
          tabBarIcon: tabIcon('globe-outline'),
        }}
      />
      <Tabs.Screen
        name="parties"
        options={{
          title: 'Tiers',
          tabBarIcon: tabIcon('people-outline'),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Réglages',
          tabBarIcon: tabIcon('settings-outline'),
        }}
      />
    </Tabs>
  );
}
