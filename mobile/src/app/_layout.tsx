import 'react-native-gesture-handler';

import Ionicons from '@expo/vector-icons/Ionicons';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { WebFrame } from '@/components/WebFrame';
import { AuthProvider } from '@/context/AuthContext';
import { OFFLINE_CACHE_MAX_AGE, persister, queryClient } from '@/offline/queryClient';
import { startOutboxSync } from '@/offline/sync';

// Garde le splash affiché tant que les polices d'icônes ne sont pas prêtes —
// sur Android via Expo Go, elles se chargent après le premier rendu, ce qui
// faisait apparaître des icônes invisibles pendant un instant (voire pas du
// tout sur certains appareils).
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontsError] = useFonts({ ...Ionicons.font });

  // Envoie les opérations saisies hors-ligne dès que le réseau revient.
  useEffect(() => startOutboxSync(), []);

  const ready = fontsLoaded || !!fontsError;

  const onLayout = useCallback(async () => {
    if (ready) await SplashScreen.hideAsync();
  }, [ready]);

  useEffect(() => {
    onLayout();
  }, [onLayout]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {/* Les données consultées sont gardées sur le téléphone : l'app
            s'ouvre et s'affiche même sans réseau. */}
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{ persister, maxAge: OFFLINE_CACHE_MAX_AGE, buster: 'v1' }}>
          <AuthProvider>
            <StatusBar style="dark" />
            <WebFrame>
              <Stack screenOptions={{ headerShown: false }} />
            </WebFrame>
          </AuthProvider>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
