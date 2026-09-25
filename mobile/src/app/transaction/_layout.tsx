import { Redirect, Stack } from 'expo-router';
import { View } from 'react-native';

import { LoadingView } from '@/components/ui/QueryState';
import { useAuth } from '@/context/AuthContext';
import { colors } from '@/theme';

export default function TransactionStackLayout() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <LoadingView />
      </View>
    );
  }
  if (status === 'signedOut') return <Redirect href="/login" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
