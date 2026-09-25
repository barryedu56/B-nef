import 'react-native-gesture-handler';

import Ionicons from '@expo/vector-icons/Ionicons';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/context/AuthContext';
import { ApiError } from '@/api/client';

// Garde le splash affiché tant que les polices d'icônes ne sont pas prêtes —
// sur Android via Expo Go, elles se chargent après le premier rendu, ce qui
// faisait apparaître des icônes invisibles pendant un instant (voire pas du
// tout sur certains appareils).
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontsError] = useFonts({ ...Ionicons.font });

  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: (failureCount, error) => {
              if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
              return failureCount < 2;
            },
            staleTime: 30_000,
          },
        },
      }),
    []
  );

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
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false }} />
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
