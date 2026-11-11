import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Redirect, Tabs } from 'expo-router';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LoadingView } from '@/components/ui/QueryState';
import { useAuth } from '@/context/AuthContext';
import { colors, shadow } from '@/theme';

const TAB_BAR_CONTENT_HEIGHT = 68;

/** Icône d'onglet : couleur du thème selon l'onglet actif (mêmes valeurs
 * que tabBarActiveTintColor / tabBarInactiveTintColor). */
function tabIcon(name: ComponentProps<typeof Ionicons>['name']) {
  return ({ focused }: { focused: boolean; size: number }) => (
    <View
      style={{
        width: 52,
        height: 30,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: focused ? colors.accentSoft : 'transparent',
      }}>
      <Ionicons name={name} size={22} color={focused ? colors.accent : colors.textSecondary} />
    </View>
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
        // Pendant la saisie, la barre d'onglets se cache au lieu de flotter
        // au-dessus du clavier et de manger la place des champs.
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          borderTopWidth: 0,
          backgroundColor: colors.card,
          height: TAB_BAR_CONTENT_HEIGHT + bottomInset,
          paddingTop: 8,
          paddingBottom: bottomInset,
          ...shadow.md,
        },
        tabBarItemStyle: { paddingTop: 2 },
        tabBarIconStyle: { marginBottom: -2 },
        // React Navigation impose sa propre police aux libellés (Roboto sur
        // Android, plus large : « Vue glob… ») : on remet celle de l'app.
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '800',
          marginTop: 4,
          ...(Platform.OS === 'web' ? { fontFamily: 'Nunito, system-ui, sans-serif' } : null),
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Activités',
          tabBarIcon: tabIcon('home-outline'),
        }}
      />
      <Tabs.Screen
        name="money"
        options={{
          title: 'Argent',
          tabBarIcon: tabIcon('wallet-outline'),
        }}
      />
      <Tabs.Screen
        name="global"
        options={{
          title: 'Bilan',
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
