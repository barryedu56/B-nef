import { useMemo, useState } from 'react';

import { ApiError } from '@/api/client';
import { downloadReportPdf } from '@/api/reports';
import type { Period } from '@/api/types';
import { AmountText } from '@/components/ui/AmountText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Field';
import { ErrorBlock, LoadingBlock } from '@/components/ui/QueryState';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { PageHeader } from '@/components/layout/PageHeader';
import { useActivities } from '@/hooks/useActivities';
import { useActivitySummary, useGlobalSummary } from '@/hooks/useReports';
import { formatPeriodLabel, todayISO } from '@/lib/dates';
import { formatAmount } from '@/lib/money';

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'week', label: 'Semaine' },
  { value: 'month', label: 'Mois' },
  { value: 'year', label: 'Année' },
];

const ALL_ACTIVITIES = 'all';

export function ReportsPage() {
  const activities = useActivities();
  const [activityId, setActivityId] = useState<string>(ALL_ACTIVITIES);
  const [period, setPeriod] = useState<Period>('month');
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const anchor = todayISO();

  const numericActivityId = activityId === ALL_ACTIVITIES ? undefined : Number(activityId);
  const globalSummary = useGlobalSummary(period, undefined, anchor);
  const activitySummary = useActivitySummary(numericActivityId, period, undefined, anchor);

  const summaryQuery = numericActivityId !== undefined ? activitySummary : globalSummary;
  const activityOptions = useMemo(
    () => [{ value: ALL_ACTIVITIES, label: 'Toutes les activités (consolidé)' }, ...(activities.data ?? []).map((a) => ({ value: String(a.id), label: a.name }))],
    [activities.data]
  );
  const activityName =
    numericActivityId !== undefined ? activities.data?.find((a) => a.id === numericActivityId)?.name : 'Toutes les activités';

  if (summaryQuery.isLoading) return <LoadingBlock label="calcul du rapport" />;
  if (summaryQuery.isError || !summaryQuery.data) {
    return <ErrorBlock message="Impossible de calculer le rapport." onRetry={() => summaryQuery.refetch()} />;
  }

  const data = summaryQuery.data;
  const currency = data.currency;
  const netMarginPct = Number(data.revenue) !== 0 ? (Number(data.net_profit) / Number(data.revenue)) * 100 : 0;

  const onDownloadPdf = async () => {
    setDownloadError(null);
    setDownloading(true);
    try {
      await downloadReportPdf({ activity: numericActivityId, period, date: anchor });
    } catch (err) {
      setDownloadError(err instanceof ApiError ? err.message : 'Impossible de générer le PDF.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Rapports"
        actions={
          <div className="no-print" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ minWidth: 220 }}>
              <Select
                options={activityOptions}
                value={activityId}
                onChange={setActivityId}
                aria-label="Activité"
              />
            </div>
            <SegmentedControl options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
            <Button variant="primary" onClick={onDownloadPdf} loading={downloading}>
              Télécharger en PDF
            </Button>
          </div>
        }
      />
      {downloadError ? (
        <div className="content" style={{ paddingBottom: 0 }}>
          <span className="error-text">{downloadError}</span>
        </div>
      ) : null}

      <div className="content" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 760px) minmax(200px, 1fr)', gap: 24, alignItems: 'flex-start' }}>
        <Card className="printable" style={{ padding: '36px 40px' }}>
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 17, fontWeight: 700 }}>Compte de résultat</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
              {activityName} · {formatPeriodLabel(period, anchor)} · {currency}
            </div>
          </div>

          <ReportRow label="Chiffre d'affaires" value={data.revenue} currency={currency} bold />
          <ReportRow label="Coût des marchandises vendues" value={negate(data.cogs)} currency={currency} muted />
          <ReportRow label="Marge brute" value={data.gross_margin} currency={currency} bold topRule />
          <ReportRow label="Charges d'exploitation" value={negate(data.expenses)} currency={currency} muted spacedTop />
          <ReportRow label="Bénéfice net" value={data.net_profit} currency={currency} bold big doubleRule positive />

          <div style={{ display: 'flex', gap: 24, marginTop: 22, fontSize: 12.5, color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
            <span>
              Marge nette : <strong style={{ color: 'var(--text-primary)' }}>{netMarginPct.toFixed(0)} %</strong>
            </span>
          </div>
        </Card>

        <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card>
            <span className="card-title">Indicateurs</span>
            <IndicatorRow label="Trésorerie" value={data.cash_balance} currency={currency} />
            <IndicatorRow label="Valeur du stock" value={data.stock_value} currency={currency} />
            <IndicatorRow label="Créances en cours" value={data.receivable} currency={currency} />
            <IndicatorRow label="Dettes en cours" value={data.payable} currency={currency} />
            {Number(data.personal_use) > 0 ? (
              <IndicatorRow label="Consommé personnellement" value={data.personal_use} currency={currency} />
            ) : null}
          </Card>
          <Card muted>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
              Choisis une activité ou « Toutes les activités » pour un rapport consolidé, une période, puis
              télécharge le vrai fichier PDF (pas une impression de navigateur).
            </span>
          </Card>
        </div>
      </div>
    </>
  );
}

function negate(value: string) {
  const n = Number(value);
  return String(n === 0 ? 0 : -Math.abs(n));
}

function ReportRow({
  label,
  value,
  currency,
  bold,
  big,
  muted,
  topRule,
  doubleRule,
  spacedTop,
  positive,
}: {
  label: string;
  value: string;
  currency: string;
  bold?: boolean;
  big?: boolean;
  muted?: boolean;
  topRule?: boolean;
  doubleRule?: boolean;
  spacedTop?: boolean;
  positive?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        padding: '7px 0',
        marginTop: spacedTop ? 10 : 0,
        borderTop: topRule || doubleRule ? '2px solid var(--text-primary)' : 'none',
        borderBottom: doubleRule ? '5px double var(--text-primary)' : 'none',
        color: muted ? 'var(--text-secondary)' : 'var(--text-primary)',
      }}>
      <span style={{ fontWeight: bold ? 600 : 400, fontSize: big ? 15 : 13.5 }}>{label}</span>
      <span className="mono" style={{ fontWeight: bold ? 700 : 500, fontSize: big ? 17 : 13.5, color: positive ? 'var(--positive)' : undefined }}>
        {formatAmount(value, currency)}
      </span>
    </div>
  );
}

function IndicatorRow({ label, value, currency }: { label: string; value: string; currency: string }) {
  return (
    <div className="switch-row" style={{ padding: '7px 0' }}>
      <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{label}</span>
      <AmountText amount={value} currency={currency} size={12.5} sign="neutral" />
    </div>
  );
}
