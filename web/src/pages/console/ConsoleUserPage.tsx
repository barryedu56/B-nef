import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { consoleApi, LIVE_INTERVAL, type ConsoleUserDetail, type UserAction } from '@/api/console';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { ErrorBlock, LoadingBlock } from '@/components/ui/QueryState';
import { useAuth } from '@/context/AuthContext';
import { useFormatMoney } from '@/lib/money';
import { ago, dateTime } from './format';
import { OperationsTable } from './OperationsTable';
import { LiveDot, Stat } from './shared';

export function ConsoleUserPage() {
  const id = Number(useParams().id);
  const user = useQuery({ queryKey: ['console', 'user', id], queryFn: () => consoleApi.user(id), refetchInterval: LIVE_INTERVAL });

  return (
    <>
      <PageHeader
        title={user.data?.username ?? 'Utilisateur'}
        subtitle={user.data ? `inscrit le ${dateTime(user.data.date_joined)}` : undefined}
        actions={<LiveDot fetching={user.isFetching} />}
      />
      <div className="content">
        <Link to="/console/users" className="console-back">
          <ArrowLeft size={16} /> Tous les utilisateurs
        </Link>
        {user.isPending ? (
          <LoadingBlock />
        ) : user.isError ? (
          <ErrorBlock message={user.error.message} onRetry={() => user.refetch()} />
        ) : (
          <Detail u={user.data} />
        )}
      </div>
    </>
  );
}

function Detail({ u }: { u: ConsoleUserDetail }) {
  const formatMoney = useFormatMoney();
  return (
    <>
      <div className="kpi-grid">
        <Stat label="Statut" value={u.is_active ? 'Actif' : 'Désactivé'} tone={u.is_active ? undefined : 'warning'} hint={u.is_staff ? 'administrateur' : undefined} />
        <Stat label="Dernière connexion" value={ago(u.last_login)} />
        <Stat label="Dernière opération" value={ago(u.last_operation)} hint={`${u.operations} opération(s) au total`} />
        <Stat label="Activités" value={u.activities} hint={u.parties != null ? `${u.parties} client(s)/fournisseur(s)` : undefined} />
      </div>
      <Card>
        <div className="card-title">Coordonnées</div>
        <div className="console-kv">
          <span>E-mail</span><strong>{u.email || '—'}</strong>
          <span>Téléphone</span><strong>{u.phone || '—'}</strong>
          <span>Devise principale</span><strong>{u.base_currency}</strong>
        </div>
      </Card>
      <Actions u={u} />
      <div className="console-two">
        <Card>
          <div className="card-title">Activités</div>
          {u.activities_list.length ? (
            <table className="table">
              <tbody>
                {u.activities_list.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <strong>{a.name}</strong>
                      {a.is_archived ? <span className="badge" style={{ marginLeft: 6 }}>archivée</span> : null}
                      <div className="muted">{a.type} · {a.currency}</div>
                    </td>
                    <td className="mono" style={{ textAlign: 'right' }}>{a.operations} op.</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="state-block">Aucune activité créée.</div>
          )}
        </Card>
        <Card>
          <div className="card-title">Caisses</div>
          {u.cash.length ? (
            <table className="table">
              <tbody>
                {u.cash.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td className="mono" style={{ textAlign: 'right' }}>{formatMoney(c.balance, c.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="state-block">Aucune caisse.</div>
          )}
        </Card>
      </div>
      <Card>
        <div className="card-title">20 dernières opérations</div>
        <OperationsTable rows={u.recent_operations} showUser={false} />
        <Link to={`/console/operations?user=${u.id}`} className="console-back">Voir toutes ses opérations →</Link>
      </Card>
      {u.admin_actions.length ? (
        <Card>
          <div className="card-title">Actions des administrateurs sur ce compte</div>
          <ul className="console-feed">
            {u.admin_actions.map((a, i) => (
              <li key={i}>
                <span className="feed-text"><strong>{a.admin ?? '—'}</strong> : {a.action}</span>
                <small>{dateTime(a.at)}</small>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}

const ACTIONS: Record<UserAction, { label: string; confirm: string; variant: 'secondary' | 'danger' }> = {
  logout: {
    label: 'Déconnecter partout',
    confirm: "Ses téléphones et navigateurs devront se reconnecter. Ses données ne changent pas. Utile s'il a perdu son téléphone.",
    variant: 'secondary',
  },
  'temp-password': {
    label: 'Mot de passe temporaire',
    confirm: "Un nouveau mot de passe est créé et affiché une seule fois : donne-le lui (téléphone, WhatsApp). Il sera déconnecté partout et pourra le changer dans Paramètres.",
    variant: 'secondary',
  },
  deactivate: {
    label: 'Désactiver le compte',
    confirm: 'Il ne pourra plus se connecter. Rien n\'est supprimé : tu peux le réactiver à tout moment.',
    variant: 'danger',
  },
  reactivate: { label: 'Réactiver le compte', confirm: 'Il pourra de nouveau se connecter avec son mot de passe.', variant: 'secondary' },
};

function Actions({ u }: { u: ConsoleUserDetail }) {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const [pending, setPending] = useState<UserAction | null>(null);
  const [result, setResult] = useState<{ detail: string; password?: string } | null>(null);
  const mutation = useMutation({
    mutationFn: (action: UserAction) => consoleApi.userAction(u.id, action),
    onSuccess: (data) => {
      setPending(null);
      setResult(data);
      qc.invalidateQueries({ queryKey: ['console'] });
    },
  });

  if (me?.id === u.id) {
    return <Card muted>C'est ton compte : gère-le depuis Paramètres dans l'app.</Card>;
  }
  const available: UserAction[] = u.is_active
    ? u.is_staff
      ? ['logout']
      : ['logout', 'temp-password', 'deactivate']
    : ['reactivate'];

  return (
    <Card>
      <div className="card-title">Aider cet utilisateur</div>
      <div className="console-actions">
        {available.map((a) => (
          <Button key={a} variant={ACTIONS[a].variant} onClick={() => { mutation.reset(); setPending(a); }}>
            {ACTIONS[a].label}
          </Button>
        ))}
      </div>
      {pending ? (
        <Modal title={ACTIONS[pending].label} onClose={() => setPending(null)}>
          <p>{ACTIONS[pending].confirm}</p>
          {mutation.isError ? <div className="error-text">{mutation.error.message}</div> : null}
          <div className="form-actions">
            <Button variant="secondary" onClick={() => setPending(null)}>Fermer</Button>
            <Button variant={ACTIONS[pending].variant} loading={mutation.isPending} onClick={() => mutation.mutate(pending)}>
              Confirmer
            </Button>
          </div>
        </Modal>
      ) : null}
      {result ? (
        <Modal title="C'est fait" onClose={() => setResult(null)}>
          <p>{result.detail}</p>
          {result.password ? <div className="console-secret mono">{result.password}</div> : null}
          <div className="form-actions">
            <Button onClick={() => setResult(null)}>OK</Button>
          </div>
        </Modal>
      ) : null}
    </Card>
  );
}
