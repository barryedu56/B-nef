import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { consoleApi, LIVE_INTERVAL } from '@/api/console';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Field';
import { ErrorBlock, LoadingBlock } from '@/components/ui/QueryState';
import { OperationsTable } from './OperationsTable';
import { LiveDot, Pager } from './shared';

const DIRECTIONS = [
  { value: 'all', label: 'Entrées et sorties' },
  { value: 'in', label: 'Entrées' },
  { value: 'out', label: 'Sorties' },
];

export function ConsoleOperationsPage() {
  const [query, setQuery] = useSearchParams();
  const userId = query.get('user') ?? undefined;
  const [search, setSearch] = useState('');
  const [direction, setDirection] = useState('all');
  const [voided, setVoided] = useState(false);
  const [page, setPage] = useState(1);
  const params = {
    user: userId,
    search,
    direction: direction === 'all' ? undefined : direction,
    voided: voided ? '1' : undefined,
    page,
  };
  const ops = useQuery({
    queryKey: ['console', 'operations', params],
    queryFn: () => consoleApi.operations(params),
    refetchInterval: LIVE_INTERVAL,
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader title="Opérations" subtitle="Toutes les saisies, les plus récentes d'abord" actions={<LiveDot fetching={ops.isFetching} />} />
      <div className="content">
        <Card>
          <div className="console-filters">
            <div className="input-group">
              <span className="input-icon"><Search size={16} /></span>
              <input
                className="input"
                placeholder="Utilisateur, activité ou note"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <Select options={DIRECTIONS} value={direction} onChange={(v) => { setDirection(v); setPage(1); }} />
            <label className="console-check">
              <input type="checkbox" checked={voided} onChange={(e) => { setVoided(e.target.checked); setPage(1); }} />
              Annulées seulement
            </label>
            {userId ? (
              <button type="button" className="chip active" onClick={() => setQuery({})}>
                Un seul utilisateur ✕
              </button>
            ) : null}
          </div>
          {ops.isPending ? (
            <LoadingBlock />
          ) : ops.isError ? (
            <ErrorBlock message={ops.error.message} onRetry={() => ops.refetch()} />
          ) : (
            <>
              <OperationsTable rows={ops.data.results} />
              <Pager page={page} count={ops.data.count} onChange={setPage} />
            </>
          )}
        </Card>
      </div>
    </>
  );
}
