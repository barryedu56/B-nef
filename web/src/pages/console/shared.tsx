import type { ReactNode } from 'react';

/** Chiffre clé de la console (un nombre, pas un montant). */
export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: 'warning' }) {
  return (
    <div className="kpi-tile">
      <span className="kpi-label">{label}</span>
      <span className="kpi-value" style={tone === 'warning' ? { color: 'var(--warning)' } : undefined}>
        {value}
      </span>
      {hint ? <span className="kpi-delta">{hint}</span> : null}
    </div>
  );
}

/** Pastille « en direct » : la page se rafraîchit toute seule. */
export function LiveDot({ fetching }: { fetching: boolean }) {
  return (
    <span className="live-dot" title="Actualisé automatiquement toutes les 10 secondes">
      <span className={fetching ? 'pulse' : ''} />
      En direct
    </span>
  );
}

export function Pager({ page, count, pageSize = 25, onChange }: { page: number; count: number; pageSize?: number; onChange: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="console-pager">
      <button type="button" className="btn btn-secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Précédent
      </button>
      <span>
        Page {page} / {pages} · {count} résultats
      </span>
      <button type="button" className="btn btn-secondary" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        Suivant
      </button>
    </div>
  );
}
