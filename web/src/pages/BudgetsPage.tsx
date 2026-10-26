import { useState, type FormEvent } from 'react';

import { ApiError } from '@/api/client';
import type { Budget, BudgetStatus } from '@/api/types';
import { BudgetProgress } from '@/components/BudgetProgress';
import { AmountInput } from '@/components/ui/AmountInput';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, ErrorBlock, LoadingBlock } from '@/components/ui/QueryState';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/context/AuthContext';
import { useActivities } from '@/hooks/useActivities';
import { useBudgetsStatus, useCreateBudget, useDeleteBudget, useUpdateBudget } from '@/hooks/useBudgets';
import { useCategories } from '@/hooks/useTransactions';
import { todayISO } from '@/lib/dates';
import { useCurrencies } from '@/lib/money';

const PERIOD_OPTIONS = [
  { value: 'week', label: 'Par semaine' },
  { value: 'month', label: 'Par mois' },
  { value: 'year', label: 'Par année' },
];

export function BudgetsPage() {
  const budgets = useBudgetsStatus();
  const deleteBudget = useDeleteBudget();
  const [editing, setEditing] = useState<BudgetStatus | 'new' | null>(null);

  const rows = budgets.data ?? [];
  const over = rows.filter((b) => b.status === 'over').length;

  return (
    <>
      <PageHeader title="Budgets" actions={<Button onClick={() => setEditing('new')}>+ Nouveau budget</Button>} />
      <div className="content">
        <span className="field-hint">
          Fixe un plafond de dépenses par catégorie (loyer, transport…) ou pour toute une activité. Seules les
          charges comptent : un réapprovisionnement est du stock, pas une dépense.
        </span>
        {over > 0 ? (
          <span className="error-text">
            {over} budget{over > 1 ? 's' : ''} dépassé{over > 1 ? 's' : ''} sur la période en cours.
          </span>
        ) : null}
        <Card>
          {budgets.isLoading ? (
            <LoadingBlock />
          ) : budgets.isError ? (
            <ErrorBlock message="Impossible de charger les budgets." onRetry={() => budgets.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState
              title="Aucun budget"
              description="Crée ton premier budget pour être alerté avant de trop dépenser."
              actionLabel="+ Nouveau budget"
              onAction={() => setEditing('new')}
            />
          ) : (
            rows.map((b) => (
              <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 16, borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: 1 }}>
                  <BudgetProgress budget={b} />
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Button variant="secondary" onClick={() => setEditing(b)}>
                    Modifier
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      if (confirm('Supprimer ce budget ? Les opérations ne sont pas touchées.')) deleteBudget.mutate(b.id);
                    }}>
                    Supprimer
                  </Button>
                </div>
              </div>
            ))
          )}
        </Card>
      </div>
      {editing ? <BudgetModal budget={editing === 'new' ? null : editing} onClose={() => setEditing(null)} /> : null}
    </>
  );
}

function BudgetModal({ budget, onClose }: { budget: BudgetStatus | null; onClose: () => void }) {
  const { user } = useAuth();
  const activities = useActivities();
  const categories = useCategories('out');
  const currencies = useCurrencies();
  const create = useCreateBudget();
  const update = useUpdateBudget();

  const [activityId, setActivityId] = useState(budget?.activity ? String(budget.activity) : '');
  const [categoryId, setCategoryId] = useState(budget?.category ? String(budget.category) : '');
  const [period, setPeriod] = useState<Budget['period']>(budget?.period ?? 'month');
  const [amount, setAmount] = useState(budget ? String(Number(budget.planned)) : '');
  const activity = (activities.data ?? []).find((a) => String(a.id) === activityId);
  const [currency, setCurrency] = useState(budget?.currency ?? '');
  const effectiveCurrency = currency || activity?.currency || user?.base_currency || 'GNF';
  const [error, setError] = useState<string | null>(null);

  // Catégories proposées : les globales + celles de l'activité choisie.
  const categoryOptions = (categories.data ?? []).filter((c) => c.activity === null || String(c.activity) === activityId);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const value = Number(amount.replace(',', '.'));
    if (!value || value <= 0) {
      setError('Indique le montant prévu.');
      return;
    }
    setError(null);
    const input = {
      activity: activityId ? Number(activityId) : null,
      category: categoryId ? Number(categoryId) : null,
      period,
      amount: String(value),
      currency: effectiveCurrency,
      starts_on: todayISO(),
    };
    try {
      if (budget) {
        const { starts_on: _ignored, ...patch } = input;
        await update.mutateAsync({ id: budget.id, patch });
      } else {
        await create.mutateAsync(input);
      }
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'enregistrer ce budget.");
    }
  };

  return (
    <Modal title={budget ? 'Modifier le budget' : 'Nouveau budget'} onClose={onClose}>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Activité">
          <Select
            options={[{ value: '', label: 'Toutes les activités' }, ...(activities.data ?? []).map((a) => ({ value: String(a.id), label: a.name }))]}
            value={activityId}
            onChange={(v) => {
              setActivityId(v);
              setCategoryId('');
            }}
          />
        </Field>
        <Field label="Catégorie de dépense">
          <Select
            options={[{ value: '', label: 'Toutes les dépenses' }, ...categoryOptions.map((c) => ({ value: String(c.id), label: c.name }))]}
            value={categoryId}
            onChange={setCategoryId}
          />
        </Field>
        <Field label="Période">
          <Select options={PERIOD_OPTIONS} value={period} onChange={(v) => setPeriod(v as Budget['period'])} />
        </Field>
        <Field label="Montant prévu">
          <AmountInput value={amount} onChange={setAmount} placeholder="0" />
        </Field>
        <Field label="Devise">
          <Select
            options={(currencies.data ?? []).map((c) => ({ value: c.code, label: c.code }))}
            value={effectiveCurrency}
            onChange={setCurrency}
          />
        </Field>
        {error ? <span className="error-text">{error}</span> : null}
        <div className="form-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" loading={create.isPending || update.isPending}>
            Enregistrer
          </Button>
        </div>
      </form>
    </Modal>
  );
}
