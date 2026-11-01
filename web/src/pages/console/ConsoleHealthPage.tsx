import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

import { consoleApi, LIVE_INTERVAL } from '@/api/console';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { ErrorBlock, LoadingBlock } from '@/components/ui/QueryState';
import { ago, bytes, dateTime } from './format';
import { LiveDot } from './shared';

export function ConsoleHealthPage() {
  const health = useQuery({ queryKey: ['console', 'health'], queryFn: consoleApi.health, refetchInterval: LIVE_INTERVAL });

  return (
    <>
      <PageHeader title="Santé du serveur" actions={<LiveDot fetching={health.isFetching} />} />
      <div className="content">
        {health.isPending ? (
          <LoadingBlock />
        ) : health.isError ? (
          <ErrorBlock message={health.error.message} onRetry={() => health.refetch()} />
        ) : (
          (() => {
            const h = health.data;
            const diskPct = Math.round((h.disk.used / h.disk.total) * 100);
            const backupAge = h.backup?.at ? (Date.now() - new Date(h.backup.at).getTime()) / 3600_000 : null;
            return (
              <Card>
                <Check ok={diskPct < 85} title="Espace disque" detail={`${diskPct} % utilisé · ${bytes(h.disk.free)} libres sur ${bytes(h.disk.total)}`}>
                  <div className="bar-track"><div className="bar-fill" style={{ width: `${diskPct}%` }} /></div>
                </Check>
                <Check
                  ok={backupAge != null && backupAge < 30}
                  title="Sauvegarde de la base"
                  detail={
                    !h.backup
                      ? "Dossier des sauvegardes non visible par l'API (normal en local)."
                      : h.backup.at
                        ? `Dernière : ${dateTime(h.backup.at)} (${ago(h.backup.at)}) · ${bytes(h.backup.size)} · ${h.backup.count} gardée(s) sur le serveur`
                        : 'Aucune sauvegarde pour le moment.'
                  }
                />
                <Check ok={h.database_size != null} title="Taille de la base" detail={h.database_size != null ? bytes(h.database_size) : 'Inconnue (base locale SQLite).'} />
                <Check
                  ok={h.rates.has_rates && !h.rates.stale}
                  title="Taux de change"
                  detail={h.rates.has_rates ? `Mis à jour ${ago(h.rates.last_fetched_at)} (taux du ${h.rates.last_as_of})` : 'Aucun taux.'}
                />
                <Check
                  ok={h.email_configured}
                  title="Envoi d'e-mails"
                  detail={h.email_configured ? 'Configuré.' : 'Pas configuré : les codes « mot de passe oublié » ne partent pas. Utilise « Mot de passe temporaire » sur la fiche utilisateur.'}
                />
                <Check ok={!h.debug} title="Mode production" detail={h.debug ? 'DEBUG est activé : à couper en production.' : 'DEBUG désactivé.'} />
                <p className="muted">Heure du serveur : {dateTime(h.server_time)}</p>
              </Card>
            );
          })()
        )}
      </div>
    </>
  );
}

function Check({ ok, title, detail, children }: { ok: boolean; title: string; detail: string; children?: ReactNode }) {
  return (
    <div className="console-check-row">
      {ok ? <CheckCircle2 size={20} color="var(--positive)" /> : <TriangleAlert size={20} color="var(--warning)" />}
      <div style={{ flex: 1 }}>
        <strong>{title}</strong>
        <div className="muted">{detail}</div>
        {children}
      </div>
    </div>
  );
}
