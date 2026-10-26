import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { View } from 'react-native';

import type { PaymentMethod } from '@/api/types';
import { colors, radius } from '@/theme';

/** Icône d'une caisse d'après son type : espèces, mobile money, banque. */
export function accountIconName(account: Pick<PaymentMethod, 'name' | 'is_cash'>): ComponentProps<typeof Ionicons>['name'] {
  if (account.is_cash) return 'cash-outline';
  if (/banque|bank|compte/i.test(account.name)) return 'business-outline';
  if (/money|wave|momo|mobile|orange|mtn|free/i.test(account.name)) return 'phone-portrait-outline';
  return 'wallet-outline';
}

export function AccountIcon({ account, size = 42 }: { account: Pick<PaymentMethod, 'name' | 'is_cash'>; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.md,
        backgroundColor: colors.accentSoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Ionicons name={accountIconName(account)} size={size * 0.48} color={colors.accent} />
    </View>
  );
}
