import { useMemo, useState, type FormEvent } from 'react';

import { ApiError } from '@/api/client';
import type { Activity, Product } from '@/api/types';
import { PartyPicker } from './PartyPicker';
import { AmountInput } from './ui/AmountInput';
import { Button } from './ui/Button';
import { Field, Select, TextInput } from './ui/Field';
import { Modal } from './ui/Modal';
import { Switch } from './ui/Switch';
import { useCreateSale, useProducts } from '@/hooks/useProducts';
import { usePaymentMethods } from '@/hooks/useTransactions';
import { formatAmount } from '@/lib/money';

interface NewSaleModalProps {
  activity: Activity;
  onClose: () => void;
}

export function NewSaleModal({ activity, onClose }: NewSaleModalProps) {
  const products = useProducts(activity.id);
  const paymentMethods = usePaymentMethods();
  const createSale = useCreateSale(activity.id);

  const [search, setSearch] = useState('');
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [isCredit, setIsCredit] = useState(false);
  const [partyId, setPartyId] = useState<string | null>(null);
  const [amountPaidNow, setAmountPaidNow] = useState('');
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const list = products.data ?? [];
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter((p) => p.name.toLowerCase().includes(q));
  }, [products.data, search]);

  const cartLines = useMemo(() => {
    const list = products.data ?? [];
    return list
      .map((p) => ({ product: p, quantity: Number(quantities[p.id] || 0) }))
      .filter((line) => line.quantity > 0);
  }, [products.data, quantities]);

  const total = cartLines.reduce((sum, line) => sum + line.quantity * Number(line.product.sale_price), 0);

  const setQty = (productId: number, raw: string) => {
    setQuantities((prev) => ({ ...prev, [productId]: raw }));
  };

  const paidNowValue = amountPaidNow ? Number(amountPaidNow.replace(',', '.')) : 0;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (cartLines.length === 0) {
      setError('Ajoute au moins un produit.');
      return;
    }
    if (isCredit && amountPaidNow && paidNowValue > total) {
      setError('Le montant payé maintenant dépasse le total de la vente.');
      return;
    }
    setError(null);
    try {
      await createSale.mutateAsync({
        activity: activity.id,
        lines: cartLines.map((line) => ({ product: line.product.id, quantity: String(line.quantity) })),
        payment_method: paymentMethodId ? Number(paymentMethodId) : null,
        party: isCredit && partyId ? Number(partyId) : null,
        is_credit: isCredit,
        amount_paid_now: isCredit && paidNowValue > 0 ? String(paidNowValue) : undefined,
        sale_currency: activity.currency,
      });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'enregistrer la vente.");
    }
  };

  return (
    <Modal title={`Nouvelle vente — ${activity.name}`} onClose={onClose}>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un produit" />

        {products.data && products.data.length === 0 ? (
          <span className="field-hint">Aucun produit dans cette activité — ajoute-en depuis Inventaire.</span>
        ) : (
          <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {filtered.map((product) => (
              <ProductLine
                key={product.id}
                product={product}
                currency={activity.currency}
                value={quantities[product.id] ?? ''}
                onChange={(v) => setQty(product.id, v)}
              />
            ))}
          </div>
        )}

        {cartLines.length > 0 ? (
          <div className="card card-muted" style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600 }}>
              <span>Total · {cartLines.length} ligne{cartLines.length > 1 ? 's' : ''}</span>
              <span className="mono">{formatAmount(total, activity.currency)}</span>
            </div>
          </div>
        ) : null}

        <Field label="Moyen de paiement">
          <Select
            options={(paymentMethods.data ?? []).map((p) => ({ value: String(p.id), label: p.name }))}
            value={paymentMethodId ?? ''}
            onChange={setPaymentMethodId}
            placeholder="Choisir un moyen de paiement"
          />
        </Field>

        {activity.has_debts ? (
          <Switch checked={isCredit} onChange={setIsCredit} label="Vente à crédit" />
        ) : null}
        {activity.has_debts && isCredit ? (
          <>
            <PartyPicker label="Client" kind="client" value={partyId} onChange={setPartyId} />
            <Field label="Montant payé maintenant (facultatif)" hint="Laisse à 0 si rien n'est payé tout de suite. Sinon, le reste devient la créance du client.">
              <AmountInput value={amountPaidNow} onChange={setAmountPaidNow} placeholder="0" />
            </Field>
          </>
        ) : null}

        {error ? <span className="error-text">{error}</span> : null}
        <div className="form-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" loading={createSale.isPending} disabled={cartLines.length === 0}>
            Valider la vente{cartLines.length > 0 ? ` · ${formatAmount(total, activity.currency)}` : ''}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ProductLine({
  product,
  currency,
  value,
  onChange,
}: {
  product: Product;
  currency: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--border)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {product.name}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
          Stock {product.stock_quantity} · {formatAmount(product.sale_price, currency)} l'unité
        </div>
      </div>
      <input
        className="input"
        style={{ width: 72, textAlign: 'right' }}
        type="number"
        min={0}
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
      />
    </div>
  );
}
