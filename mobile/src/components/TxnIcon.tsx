import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Direction, TransactionKind } from '@/api/types';
import { colors } from '@/theme';

const ICONS: Partial<Record<TransactionKind, ComponentProps<typeof Ionicons>['name']>> = {
  sale: 'bag-handle-outline',
  purchase: 'cube-outline',
  settlement: 'cash-outline',
  adjustment: 'scale-outline',
  opening_balance: 'return-down-back-outline',
  personal_use: 'restaurant-outline',
};

/** Pastille d'opération : verte pour une entrée, rouge pour une sortie. */
export function TxnIcon({ kind, direction, muted }: { kind: TransactionKind; direction: Direction; muted?: boolean }) {
  const name = ICONS[kind] ?? (direction === 'in' ? 'arrow-down-outline' : 'arrow-up-outline');
  const fg = muted ? colors.textTertiary : direction === 'in' ? colors.positive : colors.negative;
  const bg = muted ? colors.placeholder : direction === 'in' ? colors.positiveSoft : colors.negativeSoft;
  return (
    <View style={[styles.wrap, { backgroundColor: bg }]}>
      <Ionicons name={name} size={17} color={fg} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});
