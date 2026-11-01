import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { consoleApi, LIVE_INTERVAL } from '@/api/console';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Field';
import { ErrorBlock, LoadingBlock } from '@/components/ui/QueryState';
import { ago, dateTime } from './format';
import { LiveDot, Pager } from './shared';

const STATUS = [
  { value: 'all', label: 'Tous les comptes' },
  { value: 'active', label: 'Actifs' },
  { value: 'inactive', label: 'Désactivés' },
  { value: 'staff', label: 'Administrateurs' },
];

const ORDERING = [
  { value: 'recent', label: 'Inscrits récemment' },
  { value: 'active', label: 'Dernière opération' },
  { value: 'login', label: 'Dernière connexion' },
  { value: 'operations', label: "Le plus d'opérations" },
  { value: 'name', label: 'Nom (A → Z)' },
];

export function ConsoleUsersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [ordering, setOrdering] = useState('recent');
  const [page, setPage] = useState(1);
  const params = { search, status: status === 'all' ? undefined : status, ordering, page };
  const users = useQuery({
    queryKey: ['console', 'users', params],
    queryFn: () => consoleApi.users(params),
    refetchInterval: LIVE_INTERVAL,
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader title="Utilisateurs" subtitle={users.data ? `${users.data.count} compte(s)` : undefined} actions={<LiveDot fetching={users.isFetching} />} />
      <div className="content">
        <Card>
          <div className="console-filters">
            <div className="input-group">
              <span className="input-icon"><Search size={16} /></span>
              <input
                className="input"
                placeholder="Nom, e-mail ou téléphone"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <Select options={STATUS} value={status} onChange={(v) => { setStatus(v); setPage(1); }} />
            <Select options={ORDERING} value={ordering} onChange={(v) => { setOrdering(v); setPage(1); }} />
          </div>
          {users.isPending ? (
            <LoadingBlock />
          ) : users.isError ? (
            <ErrorBlock message={users.error.message} onRetry={() => users.refetch()} />
          ) : (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Utilisateur</th>
                      <th>Contact</th>
                      <th>Inscrit le</th>
                      <th>Dernière connexion</th>
                      <th>Activités</th>
                      <th>Opérations</th>
                      <th>Dernière opération</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.data.results.map((u) => (
                      <tr key={u.id} className="clickable" onClick={() => navigate(`/console/users/${u.id}`)}>
                        <td>
                          <strong>{u.username}</strong>
                          {!u.is_active ? <span className="badge negative" style={{ marginLeft: 6 }}>désactivé</span> : null}
                          {u.is_staff ? <span className="badge accent" style={{ marginLeft: 6 }}>admin</span> : null}
                        </td>
                        <td>
                          {u.email || '—'}
                          {u.phone ? <div className="muted">{u.phone}</div> : null}
                        </td>
                        <td className="mono">{dateTime(u.date_joined)}</td>
                        <td>{ago(u.last_login)}</td>
                        <td className="mono">{u.activities}</td>
                        <td className="mono">{u.operations}</td>
                        <td>{ago(u.last_operation)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pager page={page} count={users.data.count} onChange={setPage} />
            </>
          )}
        </Card>
      </div>
    </>
  );
}
