import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { consoleApi, LIVE_INTERVAL } from '@/api/console';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { ErrorBlock, LoadingBlock } from '@/components/ui/QueryState';
import { dateTime } from './format';
import { Pager } from './shared';

export function ConsoleJournalPage() {
  const [page, setPage] = useState(1);
  const journal = useQuery({
    queryKey: ['console', 'journal', page],
    queryFn: () => consoleApi.journal(page),
    refetchInterval: LIVE_INTERVAL,
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader title="Journal admin" subtitle="Tout ce que les administrateurs ont fait depuis la console" />
      <div className="content">
        <Card>
          {journal.isPending ? (
            <LoadingBlock />
          ) : journal.isError ? (
            <ErrorBlock message={journal.error.message} />
          ) : !journal.data.results.length ? (
            <div className="state-block">Aucune action pour le moment.</div>
          ) : (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Quand</th>
                      <th>Admin</th>
                      <th>Action</th>
                      <th>Sur</th>
                      <th>Détails</th>
                    </tr>
                  </thead>
                  <tbody>
                    {journal.data.results.map((a) => (
                      <tr key={a.id}>
                        <td className="mono">{dateTime(a.at)}</td>
                        <td>{a.admin ?? '—'}</td>
                        <td>{a.action}</td>
                        <td>{a.target_user_id ? <Link to={`/console/users/${a.target_user_id}`}>{a.target}</Link> : a.target}</td>
                        <td className="muted">
                          {Object.entries(a.details).map(([k, v]) => `${k} : ${String(v)}`).join(' · ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pager page={page} count={journal.data.count} onChange={setPage} />
            </>
          )}
        </Card>
      </div>
    </>
  );
}
