import { useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';

import { ApiError } from '@/api/client';
import type { Product } from '@/api/types';
import { AmountInput } from '@/components/ui/AmountInput';
import { AmountText } from '@/components/ui/AmountText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Field, Select, TextInput } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, ErrorBlock, LoadingBlock } from '@/components/ui/QueryState';
import { Switch } from '@/components/ui/Switch';
import { PageHeader } from '@/components/layout/PageHeader';
import { PersonalUseModal } from '@/components/PersonalUseModal';
import { RestockModal } from '@/components/RestockModal';
import { useActivities } from '@/hooks/useActivities';
import { useAdjustStock, useCreateProduct, useProducts, useUpdateProduct } from '@/hooks/useProducts';
import { formatAmount } from '@/lib/money';
import { ExtraFeesField, feesTotal, type FeesMode } from '@/components/ExtraFeesField';
import { formatStock, UnitSelect } from '@/components/UnitSelect';

type Filter = 'all' | 'low' | 'out' | 'archived';

export function InventoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activities = useActivities();
  const inventoryActivities = useMemo(() => (activities.data ?? []).filter((a) => a.has_inventory), [activities.data]);

  const activityParam = searchParams.get('activity');
  const activityId = activityParam ? Number(activityParam) : inventoryActivities[0]?.id;
  const activity = inventoryActivities.find((a) => a.id === activityId);

  const [filter, setFilter] = useState<Filter>('all');
  const showArchived = filter === 'archived';
  const products = useProducts(activityId, { archived: showArchived });
  const updateProduct = useUpdateProduct(activityId ?? 0);
  const [restockTarget, setRestockTarget] = useState<Product | null>(null);
  const [personalUseTarget, setPersonalUseTarget] = useState<Product | null>(null);
  const [editTarget, setEditTarget] = useState<Product | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const list = products.data ?? [];
  const filtered = list.filter((p) => {
    if (filter === 'low') return p.is_low_stock && Number(p.stock_quantity) > 0;
    if (filter === 'out') return Number(p.stock_quantity) <= 0;
    return true;
  });
  const lowCount = list.filter((p) => p.is_low_stock && Number(p.stock_quantity) > 0).length;
  const outCount = list.filter((p) => Number(p.stock_quantity) <= 0).length;
  const totalStockValue = list.reduce((sum, p) => sum + Number(p.stock_value), 0);

  if (activities.isLoading) return <LoadingBlock label="chargement" />;
  if (inventoryActivities.length === 0) {
    return (
      <>
        <PageHeader title="Inventaire" />
        <div className="content">
          <EmptyState
            title="Aucune activité avec inventaire"
            description="Active le module « Inventaire » sur une activité pour suivre ses produits et son stock."
          />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Inventaire"
        actions={
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ minWidth: 220 }}>
              <Select
                options={inventoryActivities.map((a) => ({ value: String(a.id), label: a.name }))}
                value={activityId ? String(activityId) : ''}
                onChange={(v) => setSearchParams({ activity: v })}
              />
            </div>
            <Button onClick={() => setShowCreate(true)} disabled={!activity}>
              + Nouveau produit
            </Button>
          </div>
        }
      />

      <div className="content">
        {!activity ? (
          <LoadingBlock />
        ) : (
          <>
            <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 220px))' }}>
              <div className="kpi-tile">
                <span className="kpi-label">Valeur du stock</span>
                <span className="kpi-value mono">{formatAmount(totalStockValue, activity.currency)}</span>
              </div>
              <div className="kpi-tile">
                <span className="kpi-label">Références</span>
                <span className="kpi-value mono">{list.length}</span>
              </div>
            </div>

            <div className="chip-row">
              <Chip label="Tous" selected={filter === 'all'} onClick={() => setFilter('all')} />
              <Chip label={`Stock faible · ${lowCount}`} tone="warning" selected={filter === 'low'} onClick={() => setFilter('low')} />
              <Chip label={`Rupture · ${outCount}`} tone="negative" selected={filter === 'out'} onClick={() => setFilter('out')} />
              <Chip label="Archivés" selected={filter === 'archived'} onClick={() => setFilter('archived')} />
            </div>

            <Card>
              {products.isLoading ? (
                <LoadingBlock />
              ) : products.isError ? (
                <ErrorBlock message="Impossible de charger les produits." onRetry={() => products.refetch()} />
              ) : filtered.length === 0 ? (
                <EmptyState
                  title={list.length === 0 ? (showArchived ? 'Aucun produit archivé' : 'Aucun produit') : 'Rien pour ce filtre'}
                  actionLabel={!showArchived && list.length === 0 ? '+ Nouveau produit' : undefined}
                  onAction={!showArchived && list.length === 0 ? () => setShowCreate(true) : undefined}
                />
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Produit</th>
                        <th style={{ textAlign: 'right' }}>Achat</th>
                        <th style={{ textAlign: 'right' }}>Vente</th>
                        <th style={{ textAlign: 'right' }}>Marge</th>
                        <th style={{ textAlign: 'right' }}>Stock</th>
                        <th style={{ textAlign: 'right' }}>Valeur</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((product) => {
                        const stock = Number(product.stock_quantity);
                        return (
                          <tr key={product.id}>
                            <td style={{ fontWeight: 600 }}>{product.name}</td>
                            <td style={{ textAlign: 'right' }} className="mono">
                              {formatAmount(product.purchase_price, activity.currency)}
                            </td>
                            <td style={{ textAlign: 'right' }} className="mono">
                              {formatAmount(product.sale_price, activity.currency)}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <AmountText amount={product.margin} currency={activity.currency} size={12.5} sign="positive" />
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <span
                                className="mono"
                                style={{
                                  color: stock <= 0 ? 'var(--negative)' : product.is_low_stock ? 'var(--warning)' : 'var(--text-primary)',
                                }}>
                                {formatStock(product.stock_quantity, product.unit)}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }} className="mono">
                              {formatAmount(product.stock_value, activity.currency)}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                {showArchived ? (
                                  <Button
                                    variant="secondary"
                                    onClick={() => updateProduct.mutate({ id: product.id, patch: { is_archived: false } })}
                                    loading={updateProduct.isPending}>
                                    Réactiver
                                  </Button>
                                ) : (
                                  <>
                                    <Button variant="secondary" onClick={() => setEditTarget(product)}>
                                      Modifier
                                    </Button>
                                    <Button variant="secondary" onClick={() => setPersonalUseTarget(product)}>
                                      Gardé pour moi
                                    </Button>
                                    <Button variant="secondary" onClick={() => setRestockTarget(product)}>
                                      Réapprovisionner
                                    </Button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        )}
      </div>

      {restockTarget && activity ? (
        <RestockModal
          product={restockTarget}
          currency={activity.currency}
          hasDebts={activity.has_debts}
          onClose={() => setRestockTarget(null)}
        />
      ) : null}
      {personalUseTarget && activity ? (
        <PersonalUseModal product={personalUseTarget} currency={activity.currency} onClose={() => setPersonalUseTarget(null)} />
      ) : null}
      {editTarget && activity ? (
        <EditProductModal product={editTarget} activityId={activity.id} currency={activity.currency} onClose={() => setEditTarget(null)} />
      ) : null}
      {showCreate && activity ? <CreateProductModal activityId={activity.id} currency={activity.currency} onClose={() => setShowCreate(false)} /> : null}
    </>
  );
}

function CreateProductModal({ activityId, currency, onClose }: { activityId: number; currency: string; onClose: () => void }) {
  const createProduct = useCreateProduct();
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('pièce');
  const [lowStockThreshold, setLowStockThreshold] = useState('');
  const [hasStock, setHasStock] = useState(false);
  const [initialQty, setInitialQty] = useState('');
  const [initialCost, setInitialCost] = useState('');
  const [initialFees, setInitialFees] = useState('');
  const [feesMode, setFeesMode] = useState<FeesMode>('unit');
  const [salePrice, setSalePrice] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Donne un nom à ce produit.');
      return;
    }
    const qty = hasStock ? Number(initialQty.replace(',', '.')) : 0;
    const cost = hasStock ? Number(initialCost.replace(',', '.')) : 0;
    if (hasStock && (!qty || qty <= 0 || !cost || cost <= 0)) {
      setError("Indique la quantité que tu as déjà et combien t'a coûté chaque unité.");
      return;
    }
    setError(null);
    try {
      await createProduct.mutateAsync({
        activity: activityId,
        name: name.trim(),
        unit: unit.trim() || 'pièce',
        low_stock_threshold: lowStockThreshold || null,
        ...(hasStock
          ? {
              initial_quantity: String(qty),
              initial_unit_cost: String(cost),
              ...(feesTotal(feesMode, initialFees, qty) > 0 ? { initial_extra_fees: String(feesTotal(feesMode, initialFees, qty)) } : {}),
              ...(salePrice ? { sale_price: salePrice.replace(',', '.') } : {}),
            }
          : {}),
      });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de créer le produit.');
    }
  };

  return (
    <Modal title="Nouveau produit" onClose={onClose}>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Nom">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. Sac de riz 25 kg" autoFocus />
        </Field>
        <UnitSelect value={unit} onChange={setUnit} />
        <Field label="Seuil d'alerte de stock (facultatif)">
          <TextInput value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} inputMode="numeric" />
        </Field>
        <Switch
          checked={hasStock}
          onChange={setHasStock}
          label="J'ai déjà ce produit en stock"
          description="Marchandise achetée avant d'utiliser Bénef"
        />
        {hasStock ? (
          <>
            <div className="form-grid" style={{ gap: 12 }}>
              <Field label={`Quantité en stock (${unit || 'pièce'})`}>
                <TextInput value={initialQty} onChange={(e) => setInitialQty(e.target.value)} inputMode="decimal" />
              </Field>
              <Field label="Coût d'achat de chaque unité">
                <AmountInput value={initialCost} onChange={setInitialCost} placeholder="0" />
              </Field>
            </div>
            <ExtraFeesField
              value={initialFees}
              onChange={setInitialFees}
              mode={feesMode}
              onModeChange={setFeesMode}
              quantity={Number(initialQty.replace(',', '.')) || 0}
              currency={currency}
              unit={unit || 'pièce'}
            />
            <Field label="Prix de vente">
              <AmountInput value={salePrice} onChange={setSalePrice} placeholder="0" />
            </Field>
            <span className="field-hint">
              Ce stock est compté à son coût (pour un bénéfice juste à la vente) sans toucher ta caisse : il a été payé
              avant Bénef.
            </span>
          </>
        ) : (
          <span className="field-hint">
            Sinon, le coût d'achat et le prix de vente se règlent au premier réapprovisionnement — l'appli te
            proposera un prix de vente à partir d'une marge.
          </span>
        )}
        {error ? <span className="error-text">{error}</span> : null}
        <div className="form-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" loading={createProduct.isPending}>
            Créer le produit
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function EditProductModal({
  product,
  activityId,
  currency,
  onClose,
}: {
  product: Product;
  activityId: number;
  currency: string;
  onClose: () => void;
}) {
  const updateProduct = useUpdateProduct(activityId);
  const adjust = useAdjustStock(activityId);
  // Stock de départ (corrigeable tant qu'il n'y a ni vente ni réappro).
  const [stockQty, setStockQty] = useState(String(Number(product.stock_quantity)));
  const [stockCost, setStockCost] = useState(String(Number(product.purchase_price)));
  const [stockFees, setStockFees] = useState('');
  const [feesMode, setFeesMode] = useState<FeesMode>('unit');
  const [stockDirty, setStockDirty] = useState(false);
  // Inventaire (ensuite) : quantité réellement comptée.
  const [counted, setCounted] = useState('');
  const [countDone, setCountDone] = useState<string | null>(null);
  const markStock = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setStockDirty(true);
  };
  const [name, setName] = useState(product.name);
  const [unit, setUnit] = useState(product.unit);
  const [salePrice, setSalePrice] = useState(product.sale_price);
  const [lowStockThreshold, setLowStockThreshold] = useState(product.low_stock_threshold ?? '');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Donne un nom à ce produit.');
      return;
    }
    const qty = Number(stockQty.replace(',', '.')) || 0;
    const cost = Number(stockCost.replace(',', '.')) || 0;
    const correctStock = !!product.can_edit_initial_stock && stockDirty;
    if (correctStock && qty > 0 && cost <= 0) {
      setError("Indique combien t'a coûté chaque unité de ce stock.");
      return;
    }
    setError(null);
    try {
      await updateProduct.mutateAsync({
        id: product.id,
        patch: {
          name: name.trim(),
          unit: unit.trim() || 'pièce',
          sale_price: salePrice || '0',
          low_stock_threshold: lowStockThreshold || null,
          ...(correctStock
            ? {
                initial_quantity: String(qty),
                initial_unit_cost: String(cost),
                initial_extra_fees: String(feesTotal(feesMode, stockFees, qty)),
              }
            : {}),
        },
      });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'enregistrer.");
    }
  };

  const onArchive = async () => {
    if (!confirm("Archiver ce produit ? Il disparaîtra des listes actives, mais tout son historique (ventes, réappros) reste intact.")) return;
    try {
      await updateProduct.mutateAsync({ id: product.id, patch: { is_archived: true } });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'archiver ce produit.");
    }
  };

  return (
    <Modal title={`Modifier — ${product.name}`} onClose={onClose}>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Nom">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <UnitSelect value={unit} onChange={setUnit} />
        <Field label="Prix de vente">
          <AmountInput value={salePrice} onChange={setSalePrice} placeholder="0" />
        </Field>
        <Field label="Seuil d'alerte de stock (facultatif)">
          <TextInput value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} inputMode="numeric" />
        </Field>
        {product.can_edit_initial_stock ? (
          <div className="card card-muted" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <strong style={{ fontSize: 13.5 }}>Stock de départ</strong>
            <span className="field-hint">
              Tu t'es trompé en le saisissant ? Corrige-le tant que le produit n'a ni vente ni réapprovisionnement : ni ta
              caisse ni ton bénéfice ne bougent.
            </span>
            <div className="form-grid" style={{ gap: 12 }}>
              <Field label={`Quantité en stock (${unit || 'pièce'})`}>
                <TextInput value={stockQty} onChange={(e) => markStock(setStockQty)(e.target.value)} inputMode="decimal" />
              </Field>
              <Field label="Coût d'achat de chaque unité">
                <AmountInput value={stockCost} onChange={markStock(setStockCost)} placeholder="0" />
              </Field>
            </div>
            <ExtraFeesField
              value={stockFees}
              onChange={markStock(setStockFees)}
              mode={feesMode}
              onModeChange={setFeesMode}
              quantity={Number(stockQty.replace(',', '.')) || 0}
              currency={currency}
              unit={unit || 'pièce'}
            />
          </div>
        ) : (
          <span className="field-hint">
            Le coût d'achat moyen se met à jour tout seul avec les réapprovisionnements. Pour corriger la quantité, fais
            un inventaire ci-dessous.
          </span>
        )}
        {!product.can_edit_initial_stock ? (
          <div className="card card-muted" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <strong style={{ fontSize: 13.5 }}>Inventaire</strong>
            <span className="field-hint">
              Compte ce que tu as vraiment. Selon Bénef : {formatStock(product.stock_quantity, product.unit)}. L'écart
              (casse, vol, erreur) est enregistré comme une perte ou un surplus, au coût moyen (
              {formatAmount(product.purchase_price, currency)}).
            </span>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <Field label={`Quantité comptée (${product.unit})`}>
                  <TextInput value={counted} onChange={(e) => setCounted(e.target.value)} inputMode="decimal" placeholder="0" />
                </Field>
              </div>
              <Button
                type="button"
                variant="secondary"
                loading={adjust.isPending}
                onClick={async () => {
                  const value = Number(counted.replace(',', '.'));
                  if (counted === '' || Number.isNaN(value) || value < 0) {
                    setError('Indique la quantité que tu as comptée.');
                    return;
                  }
                  setError(null);
                  try {
                    await adjust.mutateAsync({ product: product.id, new_quantity: String(value) });
                    setCountDone(`Stock mis à ${formatStock(value, product.unit)}.`);
                    setCounted('');
                  } catch (err) {
                    setError(err instanceof ApiError ? err.message : "Impossible d'enregistrer l'inventaire.");
                  }
                }}>
                Enregistrer l'inventaire
              </Button>
            </div>
            {counted !== '' && !Number.isNaN(Number(counted.replace(',', '.'))) ? (
              <strong style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {(() => {
                  const delta = Number(counted.replace(',', '.')) - Number(product.stock_quantity);
                  if (delta === 0) return '✓ Le stock est juste';
                  return `${delta < 0 ? 'Perte' : 'Surplus'} de ${formatStock(Math.abs(delta), product.unit)} · ${formatAmount(
                    Math.abs(delta) * Number(product.purchase_price),
                    currency
                  )}`;
                })()}
              </strong>
            ) : null}
            {countDone ? <div className="alert success">{countDone}</div> : null}
          </div>
        ) : null}
        {error ? <span className="error-text">{error}</span> : null}
        <div className="form-actions" style={{ justifyContent: 'space-between' }}>
          <Button type="button" variant="danger" onClick={onArchive}>
            Archiver ce produit
          </Button>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button type="button" variant="secondary" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" loading={updateProduct.isPending}>
              Enregistrer
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
