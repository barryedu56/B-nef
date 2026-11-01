import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { consoleApi, type ConsoleOperation } from '@/api/console';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useFormatMoney } from '@/lib/money';
import { dateTime } from './format';

/** Liste d'opérations de la console, avec annulation sur demande du client. */
export function OperationsTable({ rows, showUser = true }: { rows: ConsoleOperation[]; showUser?: boolean }) {
  const formatMoney = useFormatMoney();
  const [voiding, setVoiding] = useState<ConsoleOperation | null>(null);
  if (!rows.length) return <div className="state-block">Aucune opération.</div>;
  return (
    <>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Saisie le</th>
              {showUser ? <th>Utilisateur</th> : null}
              <th>Activité</th>
              <th>Type</th>
              <th>Note</th>
              <th style={{ textAlign: 'right' }}>Montant</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} style={t.voided ? { opacity: 0.55 } : undefined}>
                <td className="mono">
                  {dateTime(t.created_at)}
                  <div className="muted">pour le {new Date(`${t.occurred_on}T12:00:00`).toLocaleDateString('fr-FR')}</div>
                </td>
                {showUser ? (
                  <td>
                    <Link to={`/console/users/${t.user_id}`}>{t.username}</Link>
                  </td>
                ) : null}
                <td>{t.activity}</td>
                <td>
                  {t.kind_display}
                  {t.is_credit ? <span className="badge warning" style={{ marginLeft: 6 }}>à crédit</span> : null}
                  {t.voided ? (
                    <span className="badge" style={{ marginLeft: 6 }} title={t.voided_reason}>annulée</span>
                  ) : null}
                </td>
                <td className="muted">{t.note || (t.payment_method ?? '')}</td>
                <td className={`mono ${t.direction === 'in' ? 'positive' : 'negative'}`} style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {t.direction === 'in' ? '+' : '−'}
                  {formatMoney(t.amount, t.currency)}
                </td>
                <td>
                  {!t.voided ? (
                    <button type="button" className="btn btn-ghost" onClick={() => setVoiding(t)}>
                      Annuler
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {voiding ? <VoidModal txn={voiding} onClose={() => setVoiding(null)} /> : null}
    </>
  );
}

function VoidModal({ txn, onClose }: { txn: ConsoleOperation; onClose: () => void }) {
  const qc = useQueryClient();
  const formatMoney = useFormatMoney();
  const [reason, setReason] = useState('');
  const mutation = useMutation({
    mutationFn: () => consoleApi.voidOperation(txn.id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['console'] });
      onClose();
    },
  });
  return (
    <Modal title="Annuler l'opération" onClose={onClose}>
      <p>
        {txn.kind_display} de <strong>{formatMoney(txn.amount, txn.currency)}</strong> chez <strong>{txn.username}</strong> ({txn.activity}).
      </p>
      <p className="muted">
        L'opération reste visible, barrée, comme quand l'utilisateur l'annule lui-même : le stock, les crédits et les caisses sont
        remis comme avant. À faire seulement si l'utilisateur te l'a demandé.
      </p>
      <Field label="Pourquoi ?" hint="Ex. « demande de Fatou par téléphone, saisie en double »">
        <TextInput value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
      </Field>
      {mutation.isError ? <div className="error-text">{mutation.error.message}</div> : null}
      <div className="form-actions">
        <Button variant="secondary" onClick={onClose}>Fermer</Button>
        <Button variant="danger" disabled={!reason.trim()} loading={mutation.isPending} onClick={() => mutation.mutate()}>
          Annuler l'opération
        </Button>
      </div>
    </Modal>
  );
}
