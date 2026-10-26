import { Briefcase, Building2, ChevronRight, House, Shapes, Sprout, Store, Wallet, type LucideIcon } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { ACTIVITY_TYPE_OPTIONS } from '@/api/activities';
import { ApiError } from '@/api/client';
import type { Activity } from '@/api/types';
import { AmountInput } from '@/components/ui/AmountInput';
import { AmountText } from '@/components/ui/AmountText';
import { Button } from '@/components/ui/Button';
import { Field, Select, TextInput } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, ErrorBlock, LoadingBlock } from '@/components/ui/QueryState';
import { Switch } from '@/components/ui/Switch';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/context/AuthContext';
import { useActivities, useCreateActivity } from '@/hooks/useActivities';
import { useGlobalSummary } from '@/hooks/useReports';

const TYPE_ICONS: Partial<Record<Activity['type'], LucideIcon>> = {
  commerce: Store,
  service: Briefcase,
  salary: Wallet,
  rental: Building2,
  farming: Sprout,
  household: House,
};

const CURRENCY_OPTIONS = [
  { value: 'GNF', label: 'Franc guinéen (GNF)' },
  { value: 'XOF', label: 'Franc CFA — BCEAO (XOF)' },
  { value: 'USD', label: 'Dollar américain (USD)' },
  { value: 'EUR', label: 'Euro (EUR)' },
];

export function ActivitiesPage() {
  const activities = useActivities();
  const summary = useGlobalSummary('month');
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();

  const netByActivity = new Map((summary.data?.by_activity ?? []).map((row) => [row.activity_id, row]));

  if (activities.isLoading) return <LoadingBlock label="chargement des activités" />;
  if (activities.isError) return <ErrorBlock message="Impossible de charger les activités." onRetry={() => activities.refetch()} />;

  return (
    <>
      <PageHeader
        title="Activités"
        actions={
          <Button onClick={() => setShowCreate(true)}>+ Nouvelle activité</Button>
        }
      />
      <div className="content">
        {activities.data && activities.data.length === 0 ? (
          <EmptyState
            title="Aucune activité pour l’instant"
            description="Une activité peut être une boutique, un salaire, un taxi, un champ, ou les dépenses de la maison."
            actionLabel="Créer ma première activité"
            onAction={() => setShowCreate(true)}
          />
        ) : (
          <div className="activity-grid">
            {activities.data?.map((activity) => {
              const row = netByActivity.get(activity.id);
              const Icon = TYPE_ICONS[activity.type] ?? Shapes;
              return (
                <button key={activity.id} className="activity-card" onClick={() => navigate(`/activities/${activity.id}`)}>
                  <div className="activity-card-head">
                    <span className="row-icon" style={{ width: 42, height: 42, borderRadius: 12 }}>
                      <Icon size={20} />
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="activity-card-name">{activity.name}</div>
                      <div className="activity-card-type">
                        {ACTIVITY_TYPE_OPTIONS.find((o) => o.value === activity.type)?.label ?? activity.type_display} ·{' '}
                        {activity.currency}
                      </div>
                    </div>
                    <ChevronRight size={18} color="var(--text-tertiary)" />
                  </div>
                  <div>
                    <div className="kpi-label">Bénéfice net ce mois</div>
                    {row ? (
                      <AmountText amount={row.net_profit} currency={row.currency} size={22} />
                    ) : (
                      <AmountText amount="0" currency={activity.currency} size={22} sign="neutral" />
                    )}
                  </div>
                  <div className="chip-row" style={{ gap: 6 }}>
                    {activity.has_inventory ? <span className="badge accent">Inventaire</span> : null}
                    {activity.has_debts ? <span className="badge accent">Crédits & dettes</span> : null}
                    {activity.has_budget ? <span className="badge accent">Budget</span> : null}
                    {!activity.has_inventory && !activity.has_debts && !activity.has_budget ? (
                      <span className="badge">Entrées / sorties</span>
                    ) : null}
                  </div>
                </button>
              );
            })}
            <button className="activity-card activity-card-add" onClick={() => setShowCreate(true)}>
              <span className="state-icon">+</span>
              <span className="state-title">Nouvelle activité</span>
              <span className="field-hint">Une boutique, un salaire, un champ, un taxi…</span>
            </button>
          </div>
        )}
      </div>

      {showCreate ? <CreateActivityModal onClose={() => setShowCreate(false)} /> : null}
    </>
  );
}

function CreateActivityModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const create = useCreateActivity();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [type, setType] = useState<Activity['type']>('commerce');
  const [currency, setCurrency] = useState(user?.base_currency ?? 'GNF');
  const [hasInventory, setHasInventory] = useState(false);
  const [hasDebts, setHasDebts] = useState(false);
  const [hasBudget, setHasBudget] = useState(false);
  const [openingBalance, setOpeningBalance] = useState('0');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Donne un nom à cette activité.');
      return;
    }
    setError(null);
    try {
      const activity = await create.mutateAsync({
        name: name.trim(),
        type,
        currency,
        has_inventory: hasInventory,
        has_debts: hasDebts,
        has_budget: hasBudget,
        opening_balance: openingBalance || '0',
      });
      onClose();
      navigate(`/activities/${activity.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de créer l’activité.');
    }
  };

  return (
    <Modal title="Nouvelle activité" onClose={onClose}>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Nom">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. Boutique du marché" autoFocus />
        </Field>
        <Field label="Type">
          <Select options={ACTIVITY_TYPE_OPTIONS} value={type} onChange={(v) => setType(v as Activity['type'])} />
        </Field>
        <Field label="Devise">
          <Select options={CURRENCY_OPTIONS} value={currency} onChange={setCurrency} />
        </Field>
        <Field label="Solde de caisse initial (facultatif)">
          <AmountInput value={openingBalance} onChange={setOpeningBalance} />
        </Field>

        <Switch label="Inventaire" description="Produits, stock, coût moyen pondéré" checked={hasInventory} onChange={setHasInventory} />
        <Switch label="Crédits & dettes" description="Clients qui doivent, fournisseurs à payer" checked={hasDebts} onChange={setHasDebts} />
        <Switch label="Budget & prévision" description="Fixer un budget et comparer au réalisé" checked={hasBudget} onChange={setHasBudget} />

        {error ? <span className="error-text">{error}</span> : null}
        <div className="form-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" loading={create.isPending}>
            Créer l’activité
          </Button>
        </div>
      </form>
    </Modal>
  );
}
