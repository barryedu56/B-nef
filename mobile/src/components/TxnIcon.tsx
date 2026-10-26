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
  contribution: 'add-circle-outline',
  withdrawal: 'remove-circle-outline',
  transfer: 'swap-horizontal-outline',
  cash_adjustment: 'calculator-outline',
};

export function kindLabel(kind: TransactionKind, direction: Direction, categoryName?: string) {
  switch (kind) {
    case 'sale':
      return 'Vente';
    case 'purchase':
      return 'Réapprovisionnement';
    case 'settlement':
      return 'Règlement';
    case 'adjustment':
      return 'Ajustement de stock';
    case 'opening_balance':
      return 'Solde initial';
    case 'personal_use':
      return 'Consommation personnelle';
    case 'contribution':
      return 'Apport personnel';
    case 'withdrawal':
      return 'Retrait personnel';
    case 'transfer':
      return direction === 'in' ? 'Transfert reçu' : 'Transfert envoyé';
    case 'cash_adjustment':
      return direction === 'in' ? 'Écart de caisse (surplus)' : 'Écart de caisse (manque)';
    default:
      return categoryName ?? (direction === 'in' ? 'Entrée' : 'Dépense');
  }
}

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
