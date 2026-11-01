import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { consoleApi } from '@/api/console';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Select, TextInput } from '@/components/ui/Field';
import { ErrorBlock, LoadingBlock } from '@/components/ui/QueryState';
import { useCurrencies } from '@/lib/money';
import { dateTime } from './format';

export function ConsoleRatesPage() {
  const rates = useQuery({ queryKey: ['console', 'rates'], queryFn: consoleApi.rates });
  const health = useQuery({ queryKey: ['console', 'health'], queryFn: consoleApi.health });
  const fresh = health.data?.rates;

  return (
    <>
      <PageHeader title="Taux de change" subtitle="Récupérés automatiquement chaque jour" />
      <div className="content">
        {fresh ? (
          <div className={`alert ${fresh.stale ? 'error' : 'info'}`}>
            {fresh.has_rates
              ? `Dernière mise à jour automatique : ${dateTime(fresh.last_fetched_at)} (taux du ${fresh.last_as_of}).`
              : 'Aucun taux pour le moment.'}
            {fresh.stale ? ' Les taux sont anciens : vérifie le service « scheduler » sur le serveur, ou ajoute un taux à la main.' : ''}
          </div>
        ) : null}
        <AddRate />
        <Card>
          <div className="card-title">Taux utilisés (le plus récent de chaque paire)</div>
          {rates.isPending ? (
            <LoadingBlock />
          ) : rates.isError ? (
            <ErrorBlock message={rates.error.message} />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Paire</th>
                    <th style={{ textAlign: 'right' }}>Taux</th>
                    <th>Date</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {rates.data.map((r) => (
                    <tr key={`${r.base}-${r.quote}`}>
                      <td><strong>1 {r.base}</strong> = … {r.quote}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{Number(r.rate).toLocaleString('fr-FR', { maximumFractionDigits: 6 })}</td>
                      <td className="mono">{r.as_of}</td>
                      <td>{r.source === 'manuel' ? <span className="badge warning">manuel</span> : r.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

function AddRate() {
  const qc = useQueryClient();
  const { data: currencies } = useCurrencies();
  const options = (currencies ?? []).map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` }));
  const [base, setBase] = useState('USD');
  const [quote, setQuote] = useState('GNF');
  const [rate, setRate] = useState('');
  const mutation = useMutation({
    mutationFn: () => consoleApi.addRate({ base, quote, rate: rate.replace(/\s/g, '').replace(',', '.') }),
    onSuccess: () => {
      setRate('');
      qc.invalidateQueries({ queryKey: ['console', 'rates'] });
    },
  });
  return (
    <Card>
      <div className="card-title">Corriger un taux à la main</div>
      <p className="muted">
        Pour aujourd'hui seulement : les nouvelles opérations l'utiliseront. Les opérations déjà saisies gardent leur taux.
      </p>
      <div className="console-filters">
        <Field label="1 unité de"><Select options={options} value={base} onChange={setBase} /></Field>
        <Field label="vaut (en)"><Select options={options} value={quote} onChange={setQuote} /></Field>
        <Field label="Taux"><TextInput inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="ex. 8650" /></Field>
        <Button disabled={!rate.trim()} loading={mutation.isPending} onClick={() => mutation.mutate()}>Enregistrer</Button>
      </div>
      {mutation.isError ? <div className="error-text">{mutation.error.message}</div> : null}
      {mutation.isSuccess ? <div className="muted">Taux enregistré.</div> : null}
    </Card>
  );
}
