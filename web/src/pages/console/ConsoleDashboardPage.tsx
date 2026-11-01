import { useQuery } from '@tanstack/react-query';
import { LogIn, Receipt, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';

import { consoleApi, LIVE_INTERVAL, type ConsoleOverview, type FeedEvent } from '@/api/console';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { ErrorBlock, LoadingBlock } from '@/components/ui/QueryState';
import { useFormatMoney } from '@/lib/money';
import { ago } from './format';
import { LiveDot, Stat } from './shared';

export function ConsoleDashboardPage() {
  const overview = useQuery({ queryKey: ['console', 'overview'], queryFn: consoleApi.overview, refetchInterval: LIVE_INTERVAL });
  const feed = useQuery({ queryKey: ['console', 'feed'], queryFn: consoleApi.feed, refetchInterval: LIVE_INTERVAL });

  return (
    <>
      <PageHeader title="Console admin" subtitle="Ce qui se passe sur Bénef" actions={<LiveDot fetching={overview.isFetching || feed.isFetching} />} />
      <div className="content">
        {overview.isPending ? (
          <LoadingBlock />
        ) : overview.isError ? (
          <ErrorBlock message={overview.error.message} onRetry={() => overview.refetch()} />
        ) : (
          <Overview data={overview.data} />
        )}
        <Card>
          <div className="card-title">Activité en direct</div>
          {feed.isPending ? <LoadingBlock /> : feed.isError ? <ErrorBlock message={feed.error.message} /> : <Feed events={feed.data} />}
        </Card>
      </div>
    </>
  );
}

function Overview({ data }: { data: ConsoleOverview }) {
  const { users, operations } = data;
  return (
    <>
      <div className="kpi-grid">
        <Stat label="Utilisateurs" value={users.total} hint={users.inactive ? `${users.inactive} désactivé(s)` : 'tous actifs'} />
        <Stat label="Inscrits aujourd'hui" value={users.new_today} hint={`${users.new_7d} sur 7 jours · ${users.new_30d} sur 30 jours`} />
        <Stat label="Actifs aujourd'hui" value={users.active_today} hint={`${users.active_7d} sur 7 jours (ont saisi une opération)`} />
        <Stat label="Opérations aujourd'hui" value={operations.today} hint={`${operations['7d']} sur 7 jours · ${operations.total} au total`} />
        <Stat label="Activités" value={data.activities} hint={`${data.products} produits en vente`} />
      </div>
      <Card>
        <div className="card-title">30 derniers jours</div>
        <DailyChart series={data.series} />
      </Card>
    </>
  );
}

function DailyChart({ series }: { series: ConsoleOverview['series'] }) {
  const max = Math.max(1, ...series.map((d) => d.operations));
  const maxSignups = Math.max(1, ...series.map((d) => d.signups));
  return (
    <div>
      <div className="console-legend">
        <span><i className="sw ops" /> Opérations saisies</span>
        <span><i className="sw signups" /> Inscriptions</span>
      </div>
      <div className="chart-columns" role="img" aria-label="Opérations et inscriptions par jour">
        {series.map((d) => (
          <div key={d.day} className="chart-column console-day" title={`${dayLabel(d.day)} · ${d.operations} opération(s) · ${d.signups} inscription(s)`}>
            <div className="chart-bar" style={{ height: `${Math.max(2, (d.operations / max) * 100)}%` }} />
            {d.signups ? <span className="signup-dot" style={{ bottom: `${(d.signups / maxSignups) * 90}%` }} /> : null}
          </div>
        ))}
      </div>
      <div className="chart-labels">
        {series.filter((_, i) => i % 5 === 0 || i === series.length - 1).map((d) => (
          <span key={d.day}>{dayLabel(d.day)}</span>
        ))}
      </div>
    </div>
  );
}

function dayLabel(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

const FEED_ICON = { signup: UserPlus, login: LogIn, operation: Receipt };

function Feed({ events }: { events: FeedEvent[] }) {
  const formatMoney = useFormatMoney();
  if (!events.length) return <div className="state-block">Rien pour l'instant : les inscriptions et opérations apparaîtront ici.</div>;
  return (
    <ul className="console-feed">
      {events.map((e, i) => {
        const Icon = FEED_ICON[e.type];
        return (
          <li key={`${e.type}-${e.at}-${i}`}>
            <span className={`row-icon feed-${e.type}`}><Icon size={16} /></span>
            <span className="feed-text">
              <Link to={`/console/users/${e.user_id}`}>{e.username}</Link> {e.text}
              {e.amount ? (
                <strong className={e.direction === 'in' ? 'positive' : 'negative'} style={e.voided ? { textDecoration: 'line-through' } : undefined}>
                  {' '}
                  {e.direction === 'in' ? '+' : '−'}
                  {formatMoney(e.amount, e.currency ?? '')}
                </strong>
              ) : null}
            </span>
            <small>{ago(e.at)}</small>
          </li>
        );
      })}
    </ul>
  );
}
