import { useQueryClient } from '@tanstack/react-query';
import { CircleCheck, Download, FileSpreadsheet, Plus, Trash2 } from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { downloadProductTemplate, parseProductFile, submitOnboarding } from '@/api/activities';
import { ApiError } from '@/api/client';
import { isValidGuineaPhone } from '@/lib/phone';
import type { OnboardingInput, OnboardingResult, ProductImport } from '@/api/types';
import { UnitSelect } from '@/components/UnitSelect';
import { AmountInput } from '@/components/ui/AmountInput';
import { AmountText } from '@/components/ui/AmountText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, TextInput } from '@/components/ui/Field';
import { ErrorBlock, LoadingBlock } from '@/components/ui/QueryState';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { PageHeader } from '@/components/layout/PageHeader';
import { useActivity } from '@/hooks/useActivities';
import { useAccountsOverview } from '@/hooks/useAccounts';

type Step = 0 | 1 | 2 | 3;
const STEPS = ['Mon argent', 'Ma marchandise', 'Dettes et créances', 'Récapitulatif'];

interface ProductRow {
  key: number;
  name: string;
  unit: string;
  quantity: string;
  unitCost: string;
  salePrice: string;
  fees: string;
  threshold: string;
}

interface PartyRow {
  key: number;
  name: string;
  phone: string;
  direction: 'in' | 'out';
  amount: string;
}

const num = (v: string) => Number((v || '0').replace(/\s/g, '').replace(',', '.')) || 0;
let nextKey = 1;
const emptyProduct = (): ProductRow => ({ key: nextKey++, name: '', unit: 'pièce', quantity: '', unitCost: '', salePrice: '', fees: '', threshold: '' });
const emptyParty = (direction: 'in' | 'out' = 'in'): PartyRow => ({ key: nextKey++, name: '', phone: '', direction, amount: '' });

/** Assistant « Je démarre avec Bénef » : pour un commerce qui existait avant
 * l'application — argent par caisse, marchandise déjà en stock (saisie ou
 * importée d'Excel), dettes et créances — enregistré en une fois à la fin. */
export function OnboardingPage() {
  const { id } = useParams<{ id: string }>();
  const activityId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const activity = useActivity(activityId);
  const overview = useAccountsOverview();

  const [step, setStep] = useState<Step>(0);
  const [cash, setCash] = useState<Record<number, string>>({});
  const [products, setProducts] = useState<ProductRow[]>([emptyProduct()]);
  const [parties, setParties] = useState<PartyRow[]>([emptyParty()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OnboardingResult | null>(null);

  if (activity.isLoading || overview.isLoading) return <LoadingBlock label="préparation de l'assistant" />;
  if (activity.isError || !activity.data) return <ErrorBlock message="Activité introuvable." onRetry={() => activity.refetch()} />;
  const act = activity.data;
  const currency = act.currency;
  const accounts = overview.data?.accounts ?? [];
  const goToActivity = () => navigate(`/activities/${act.id}`);

  const filledProducts = products.filter((p) => p.name.trim());
  const filledParties = parties.filter((p) => p.name.trim());
  const cashTotal = Object.values(cash).reduce((s, v) => s + num(v), 0);
  // Valeur au coût de revient : prix d'achat + frais du lot (transport…).
  const stockTotal = filledProducts.reduce((s, p) => s + lineValue(p), 0);
  const receivable = filledParties.filter((p) => p.direction === 'in').reduce((s, p) => s + num(p.amount), 0);
  const payable = filledParties.filter((p) => p.direction === 'out').reduce((s, p) => s + num(p.amount), 0);

  const goTo = (target: Step) => {
    setError(null);
    setStep(target);
    window.scrollTo({ top: 0 });
  };

  const validateStep = (): string | null => {
    if (step === 1) {
      const names = new Set<string>();
      for (const p of filledProducts) {
        const key = p.name.trim().toLowerCase();
        if (names.has(key)) return `« ${p.name} » apparaît deux fois.`;
        names.add(key);
        if (num(p.quantity) > 0 && num(p.unitCost) <= 0) return `« ${p.name} » : indique combien t'a coûté chaque unité.`;
      }
    }
    if (step === 2) {
      const bad = filledParties.find((p) => num(p.amount) <= 0);
      if (bad) return `« ${bad.name} » : indique le montant.`;
      const badPhone = filledParties.find((p) => p.phone.trim() && !isValidGuineaPhone(p.phone));
      if (badPhone) return `« ${badPhone.name} » : numéro invalide — 9 chiffres commençant par 61, 62, 65 ou 66 (ex. 622 12 34 56), ou laisse vide.`;
    }
    return null;
  };

  const next = () => {
    const problem = validateStep();
    if (problem) setError(problem);
    else goTo((step + 1) as Step);
  };

  const onSubmit = async () => {
    const input: OnboardingInput = {
      cash: accounts.filter((a) => num(cash[a.id] ?? '') > 0).map((a) => ({ account: a.id, amount: String(num(cash[a.id])) })),
      products: filledProducts.map((p) => ({
        name: p.name.trim(),
        unit: p.unit || 'pièce',
        quantity: String(num(p.quantity)),
        unit_cost: String(num(p.unitCost)),
        sale_price: String(num(p.salePrice)),
        extra_fees: String(num(p.fees)),
        low_stock_threshold: p.threshold.trim() ? String(num(p.threshold)) : null,
      })),
      parties: filledParties.map((p) => ({ name: p.name.trim(), phone: p.phone.trim(), direction: p.direction, amount: String(num(p.amount)) })),
    };
    setSaving(true);
    setError(null);
    try {
      setResult(await submitOnboarding(activityId, input));
      await queryClient.invalidateQueries();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setSaving(false);
    }
  };

  if (result) {
    return (
      <>
        <PageHeader title="C'est prêt !" subtitle={act.name} />
        <div className="content" style={{ maxWidth: 640 }}>
          <div className="alert success">
            <CircleCheck size={18} />
            <span>
              {act.name} démarre avec tout ce que tu avais déjà : {result.products} produit{result.products > 1 ? 's' : ''},{' '}
              {result.parties} personne{result.parties > 1 ? 's' : ''}. Tu peux maintenant enregistrer tes ventes et dépenses au jour le jour.
            </span>
          </div>
          <Summary currency={currency} cash={result.cash_total} stock={result.stock_value} receivable={result.receivable} payable={result.payable} />
          <div>
            <Button onClick={goToActivity}>Aller à mon activité</Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Je démarre avec Bénef" subtitle={`${act.name} · ce que tu avais avant l'application`} />
      <div className="content" style={{ maxWidth: step === 1 ? 1100 : 720 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {STEPS.map((label, i) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ height: 4, borderRadius: 999, background: i <= step ? 'var(--accent)' : 'var(--border)' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: i === step ? 'var(--accent)' : 'var(--text-tertiary)' }}>
                {i + 1}. {label}
              </span>
            </div>
          ))}
        </div>

        {step === 0 ? (
          <Card>
            <span className="card-title">Combien as-tu aujourd'hui dans chaque caisse ?</span>
            <p className="field-hint" style={{ marginTop: -6, marginBottom: 14 }}>
              Compte l'argent du tiroir, regarde le solde de ton compte et de ton mobile money. Cet argent compte dans tes caisses, pas
              dans ton bénéfice.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              {accounts.map((a) => (
                <Field key={a.id} label={`${a.name} (${a.effective_currency})`}>
                  <AmountInput value={cash[a.id] ?? ''} onChange={(v) => setCash((c) => ({ ...c, [a.id]: v }))} placeholder="0" />
                </Field>
              ))}
            </div>
          </Card>
        ) : null}

        {step === 1 ? (
          <ProductsStep products={products} setProducts={setProducts} currency={currency} stockTotal={stockTotal} onError={setError} />
        ) : null}

        {step === 2 ? (
          <Card>
            <span className="card-title">Qui te doit de l'argent, à qui en dois-tu ?</span>
            <p className="field-hint" style={{ marginTop: -6, marginBottom: 14 }}>
              Les clients qui ont pris à crédit et les fournisseurs pas encore payés, aujourd'hui.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {parties.map((p) => (
                <div key={p.key} style={{ display: 'grid', gridTemplateColumns: 'auto minmax(140px, 1.4fr) minmax(120px, 1fr) minmax(120px, 1fr) auto', gap: 10, alignItems: 'center' }} className="onboarding-party-row">
                  <SegmentedControl
                    options={[
                      { value: 'in', label: 'Me doit' },
                      { value: 'out', label: 'Je lui dois' },
                    ]}
                    value={p.direction}
                    onChange={(v) => updateRow(setParties, p.key, { direction: v })}
                  />
                  <TextInput value={p.name} onChange={(e) => updateRow(setParties, p.key, { name: e.target.value })} placeholder={p.direction === 'in' ? 'Nom du client' : 'Nom du fournisseur'} aria-label="Nom" />
                  <AmountInput value={p.amount} onChange={(v) => updateRow(setParties, p.key, { amount: v })} placeholder={`Montant (${currency})`} aria-label="Montant" />
                  <PhoneInput value={p.phone} onChange={(v) => updateRow(setParties, p.key, { phone: v })} placeholder="Téléphone (facultatif)" aria-label="Téléphone" />
                  <button className="icon-btn" onClick={() => setParties((rows) => (rows.length > 1 ? rows.filter((r) => r.key !== p.key) : [emptyParty()]))} aria-label="Retirer">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14 }}>
              <Button variant="secondary" onClick={() => setParties((rows) => [...rows, emptyParty()])}>
                <Plus size={16} /> Ajouter une personne
              </Button>
            </div>
          </Card>
        ) : null}

        {step === 3 ? (
          <>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Voici ce avec quoi tu démarres. Vérifie, puis valide : tout est enregistré d'un coup.</p>
            <Summary currency={currency} cash={String(cashTotal)} stock={String(stockTotal)} receivable={String(receivable)} payable={String(payable)} />
            <span className="field-hint">
              {filledProducts.length} produit{filledProducts.length > 1 ? 's' : ''} · {filledParties.length} personne
              {filledParties.length > 1 ? 's' : ''}. Rien de tout ça ne compte dans ton bénéfice : ce sont tes affaires d'avant Bénef.
            </span>
          </>
        ) : null}

        {error ? <div className="alert error">{error}</div> : null}

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {step > 0 ? (
            <Button variant="secondary" onClick={() => goTo((step - 1) as Step)}>
              Retour
            </Button>
          ) : null}
          {step < 3 ? (
            <Button onClick={next}>Suivant</Button>
          ) : (
            <Button onClick={onSubmit} loading={saving}>
              <CircleCheck size={16} /> Valider le démarrage
            </Button>
          )}
          <span style={{ flex: 1 }} />
          {step < 3 ? (
            <button onClick={() => goTo((step + 1) as Step)} style={linkStyle}>
              Passer cette étape
            </button>
          ) : (
            <Link to={`/activities/${act.id}`} style={linkStyle}>
              Plus tard — je démarre de zéro
            </Link>
          )}
        </div>
      </div>
    </>
  );
}

const linkStyle = { background: 'none', border: 0, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' } as const;

function ProductsStep({
  products,
  setProducts,
  currency,
  stockTotal,
  onError,
}: {
  products: ProductRow[];
  setProducts: (fn: (rows: ProductRow[]) => ProductRow[]) => void;
  currency: string;
  stockTotal: number;
  onError: (message: string | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState<ProductImport | null>(null);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImporting(true);
    onError(null);
    setReport(null);
    try {
      const parsed = await parseProductFile(file);
      setReport(parsed);
      const imported = parsed.products.map((p) => ({
        key: nextKey++,
        name: p.name,
        unit: p.unit || 'pièce',
        quantity: p.quantity === '0' ? '' : p.quantity,
        unitCost: p.unit_cost === '0' ? '' : p.unit_cost,
        salePrice: p.sale_price === '0' ? '' : p.sale_price,
        fees: !p.extra_fees || Number(p.extra_fees) === 0 ? '' : p.extra_fees,
        threshold: p.low_stock_threshold ?? '',
      }));
      // Les lignes déjà saisies sont gardées ; les lignes vides sont remplacées.
      setProducts((rows) => [...rows.filter((r) => r.name.trim()), ...imported]);
    } catch (err) {
      onError(err instanceof ApiError ? describeError(err) : 'Lecture du fichier impossible.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <span className="card-title">Ta marchandise déjà en stock</span>
          <p className="field-hint" style={{ marginTop: -6 }}>
            Pour chaque produit : la quantité, ce qu'il t'a coûté (le dernier prix d'achat), les frais payés pour tout le lot
            (transport, douane…) et ton prix de vente. Les frais sont répartis sur chaque unité, comme au réapprovisionnement.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={() => downloadProductTemplate().catch(() => onError('Téléchargement du modèle impossible.'))}>
            <Download size={16} /> Modèle Excel
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()} loading={importing}>
            <FileSpreadsheet size={16} /> Importer un fichier
          </Button>
          <input ref={fileRef} type="file" accept=".xlsx,.xlsm,.csv,.txt" onChange={onFile} hidden />
        </div>
      </div>

      {report ? (
        <div className={`alert ${report.errors.length ? 'info' : 'success'}`} style={{ margin: '12px 0', flexDirection: 'column', gap: 4 }}>
          <strong>
            {report.products.length} produit{report.products.length > 1 ? 's' : ''} importé{report.products.length > 1 ? 's' : ''} — relis le tableau avant de continuer.
          </strong>
          {report.errors.length ? (
            <>
              <span>Lignes ignorées, à corriger dans le fichier ou à saisir à la main :</span>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {report.errors.slice(0, 8).map((e) => (
                  <li key={e.line}>
                    Ligne {e.line} ({e.name}) : {e.message}
                  </li>
                ))}
                {report.errors.length > 8 ? <li>… et {report.errors.length - 8} autre(s)</li> : null}
              </ul>
            </>
          ) : null}
          {report.truncated ? <span>Seules les {report.max_rows} premières lignes ont été lues.</span> : null}
        </div>
      ) : null}

      <div className="table-wrap" style={{ marginTop: 10 }}>
        <table className="table onboarding-table">
          <thead>
            <tr>
              <th style={{ minWidth: 180 }}>Produit</th>
              <th style={{ minWidth: 150 }}>Unité</th>
              <th style={{ minWidth: 90 }}>Quantité</th>
              <th style={{ minWidth: 120 }}>Coût unitaire</th>
              <th style={{ minWidth: 110 }} title="Transport, douane… pour tout ce stock">Frais du lot</th>
              <th style={{ minWidth: 120 }}>Prix de vente</th>
              <th style={{ minWidth: 80 }}>Alerte</th>
              <th style={{ textAlign: 'right', minWidth: 110 }}>Valeur</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.key}>
                <td><TextInput value={p.name} onChange={(e) => updateRow(setProducts, p.key, { name: e.target.value })} placeholder="ex. Sac de riz 25 kg" aria-label="Produit" /></td>
                <td><UnitSelect compact value={p.unit} onChange={(v) => updateRow(setProducts, p.key, { unit: v })} /></td>
                <td><TextInput value={p.quantity} onChange={(e) => updateRow(setProducts, p.key, { quantity: e.target.value })} inputMode="decimal" placeholder="0" aria-label="Quantité" /></td>
                <td><AmountInput value={p.unitCost} onChange={(v) => updateRow(setProducts, p.key, { unitCost: v })} placeholder="0" aria-label="Coût unitaire" /></td>
                <td><AmountInput value={p.fees} onChange={(v) => updateRow(setProducts, p.key, { fees: v })} placeholder="0" aria-label="Frais du lot" /></td>
                <td><AmountInput value={p.salePrice} onChange={(v) => updateRow(setProducts, p.key, { salePrice: v })} placeholder="0" aria-label="Prix de vente" /></td>
                <td><TextInput value={p.threshold} onChange={(e) => updateRow(setProducts, p.key, { threshold: e.target.value })} inputMode="decimal" placeholder="—" aria-label="Seuil d'alerte" /></td>
                <td style={{ textAlign: 'right' }}>
                  <AmountText amount={lineValue(p)} currency={currency} size={12.5} sign="neutral" />
                </td>
                <td>
                  <button className="icon-btn" onClick={() => setProducts((rows) => (rows.length > 1 ? rows.filter((r) => r.key !== p.key) : [emptyProduct()]))} aria-label="Retirer ce produit">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, gap: 12, flexWrap: 'wrap' }}>
        <Button variant="secondary" onClick={() => setProducts((rows) => [...rows, emptyProduct()])}>
          <Plus size={16} /> Ajouter un produit
        </Button>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Valeur du stock : <AmountText amount={stockTotal} currency={currency} size={14} sign="neutral" />
        </span>
      </div>
    </Card>
  );
}

const lineValue = (p: ProductRow) => (num(p.quantity) > 0 ? num(p.quantity) * num(p.unitCost) + num(p.fees) : 0);

function updateRow<T extends { key: number }>(setter: (fn: (rows: T[]) => T[]) => void, key: number, patch: Partial<T>) {
  setter((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
}

/** Message lisible à partir des erreurs par ligne renvoyées par l'API. */
function describeError(e: unknown): string {
  if (!(e instanceof ApiError)) return 'Enregistrement impossible.';
  const body = e.body as Record<string, unknown> | null;
  const labels: Record<string, string> = { cash: 'Argent', products: 'Produit', parties: 'Personne' };
  if (body && typeof body === 'object') {
    for (const [field, value] of Object.entries(body)) {
      if (typeof value === 'string') return value;
      if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
      // Erreurs par ligne : une liste ([{}, {phone: [...]}]) ou un objet
      // indexé ({"1": {phone: [...]}}) selon la version de l'API.
      if (value && typeof value === 'object') {
        const rows = Array.isArray(value) ? value.map((v, i) => [String(i), v] as const) : Object.entries(value);
        for (const [index, row] of rows) {
          if (row && typeof row === 'object' && Object.keys(row as object).length > 0) {
            const first = Object.values(row as Record<string, unknown>)[0];
            return `${labels[field] ?? field} ${Number(index) + 1} : ${Array.isArray(first) ? first[0] : String(first)}`;
          }
        }
      }
    }
  }
  return e.message;
}

function Summary({ currency, cash, stock, receivable, payable }: { currency: string; cash: string; stock: string; receivable: string; payable: string }) {
  const total = Number(cash) + Number(stock) + Number(receivable) - Number(payable);
  const line = (label: string, value: string) => (
    <div className="switch-row">
      <span style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>{label}</span>
      <AmountText amount={value} currency={currency} size={15} sign="neutral" />
    </div>
  );
  return (
    <Card>
      {line('Argent dans tes caisses', cash)}
      {line('Marchandise (à son coût)', stock)}
      {line('On te doit', receivable)}
      {line('Tu dois', payable)}
      <div className="switch-row" style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 14 }}>
        <span style={{ fontWeight: 800 }}>Ce que vaut ton affaire</span>
        <AmountText amount={total} currency={currency} size={20} sign="neutral" />
      </div>
    </Card>
  );
}
