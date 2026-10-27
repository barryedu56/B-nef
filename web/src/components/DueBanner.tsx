import { AlarmClock, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useDueOperations } from '@/hooks/useRecurring';

/** Tableau de bord : « 2 dépenses fixes à confirmer ». */
export function DueBanner() {
  const due = useDueOperations();
  const count = due.data?.length ?? 0;
  if (count === 0) return null;
  const first = due.data?.[0]?.recurring.label;
  return (
    <Link to="/recurring" className="due-banner">
      <AlarmClock size={20} />
      <span style={{ flex: 1 }}>
        <strong>
          {count} dépense{count > 1 ? 's' : ''} fixe{count > 1 ? 's' : ''} à confirmer
        </strong>{' '}
        · {first}
        {count > 1 ? ` et ${count - 1} autre${count > 2 ? 's' : ''}` : ''} — rien n'est enregistré sans toi
      </span>
      <ChevronRight size={18} />
    </Link>
  );
}
