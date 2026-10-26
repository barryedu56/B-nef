import {
  ArrowDownLeft,
  ArrowUpRight,
  HandCoins,
  PackagePlus,
  Scale,
  ShoppingBag,
  Undo2,
  Utensils,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';

import type { Direction, TransactionKind } from '@/api/types';

export function kindLabel(kind: TransactionKind | string, direction: Direction) {
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
    default:
      return direction === 'in' ? 'Entrée' : 'Dépense';
  }
}

const ICONS: Partial<Record<TransactionKind, LucideIcon>> = {
  sale: ShoppingBag,
  purchase: PackagePlus,
  settlement: HandCoins,
  adjustment: Scale,
  opening_balance: Undo2,
  personal_use: Utensils,
};

/** Icône (verte pour une entrée, rouge pour une sortie) + libellé du type. */
export function TxnType({ kind, direction, extra }: { kind: TransactionKind; direction: Direction; extra?: ReactNode }) {
  const Icon = ICONS[kind] ?? (direction === 'in' ? ArrowDownLeft : ArrowUpRight);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <span className={`row-icon ${direction}`} style={{ width: 30, height: 30, borderRadius: 9 }}>
        <Icon size={15} />
      </span>
      <span>
        {kindLabel(kind, direction)}
        {extra}
      </span>
    </span>
  );
}
