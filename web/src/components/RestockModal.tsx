import { useState, type FormEvent } from 'react';

import { ApiError } from '@/api/client';
import type { Product } from '@/api/types';
import { PartyPicker } from './PartyPicker';
import { AmountInput } from './ui/AmountInput';
import { Button } from './ui/Button';
import { Field, Select, TextInput } from './ui/Field';
import { Modal } from './ui/Modal';
import { Switch } from './ui/Switch';
import { useCreatePurchase } from '@/hooks/useProducts';
import { usePaymentMethods } from '@/hooks/useTransactions';
import { formatAmount } from '@/lib/money';

interface RestockModalProps {
  product: Product;
  currency: string;
  hasDebts: boolean;
  onClose: () => void;
}

const DEFAULT_MARGIN = '30';

function defaultMargin(product: Product): string {
  const cost = Number(product.purchase_price);
  const price = Number(product.sale_price);
  if (cost > 0 && price > 0) return String(Math.round(((price - cost) / cost) * 100));
  return DEFAULT_MARGIN;
}

export function RestockModal({ product, currency, hasDebts, onClose }: RestockModalProps) {
  const paymentMethods = usePaymentMethods();
  const createPurchase = useCreatePurchase(product.activity);

  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [extraFees, setExtraFees] = useState('');
  const [marginPct, setMarginPct] = useState(() => defaultMargin(product));
  const [manualPrice, setManualPrice] = useState<string | null>(null);
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [isCredit, setIsCredit] = useState(false);
  const [partyId, setPartyId] = useState<string | null>(null);
  const [amountPaidNow, setAmountPaidNow] = useState('');
  const [error, setError] = useState<string | null>(null);

  const qty = Number(quantity.replace(',', '.')) || 0;
  const cost = Number(unitCost.replace(',', '.')) || 0;
  const fees = extraFees ? Number(extraFees.replace(',', '.')) || 0 : 0;
  const landedUnitCost = qty > 0 ? cost + fees / qty : cost;
  const total = qty > 0 && cost >= 0 ? qty * cost + fees : 0;
  const paidNowValue = amountPaidNow ? Number(amountPaidNow.replace(',', '.')) : 0;

  const margin = Number(marginPct.replace(',', '.'));
  const derivedPrice = landedUnitCost > 0 && !Number.isNaN(margin) ? Math.round(landedUnitCost * (1 + margin / 100)) : 0;
  const salePrice = manualPrice !== null ? manualPrice : derivedPrice > 0 ? String(derivedPrice) : '';

  const onMarginChange = (v: string) => {
    setMarginPct(v);
    setManualPrice(null);
  };
  const onPriceChange = (v: string) => {
    setManualPrice(v);
    const p = Number(v.replace(',', '.'));
    if (landedUnitCost > 0 && !Number.isNaN(p) && p >= 0) {
      setMarginPct((((p - landedUnitCost) / landedUnitCost) * 100).toFixed(1));
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!qty || qty <= 0 || !cost || cost < 0) {
      setError('Indique une quantité et un coût valides.');
      return;
    }
    if (isCredit && amountPaidNow && paidNowValue > total) {
      setError("Le montant payé maintenant dépasse le total de l'achat.");
      return;
    }
    setError(null);
    const salePriceValue = Number(salePrice.replace(',', '.'));
    try {
      await createPurchase.mutateAsync({
        product: product.id,
        quantity: String(qty),
        unit_cost: String(cost),
        extra_fees: fees > 0 ? String(fees) : undefined,
        cost_currency: currency,
        payment_method: paymentMethodId ? Number(paymentMethodId) : null,
        party: isCredit && partyId ? Number(partyId) : null,
        is_credit: isCredit,
        amount_paid_now: isCredit && paidNowValue > 0 ? String(paidNowValue) : undefined,
        sale_price: salePriceValue > 0 ? String(salePriceValue) : undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'enregistrer le réapprovisionnement.");
    }
  };

  return (
    <Modal title={`Réapprovisionner — ${product.name}`} onClose={onClose}>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <span className="field-hint">
          Stock actuel : {product.stock_quantity} · coût moyen actuel : {product.purchase_price} {currency}
        </span>
        <Field label={`Quantité (${product.unit})`}>
          <TextInput value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="numeric" autoFocus />
        </Field>
        <Field label={`Coût d'achat unitaire (${currency})`}>
          <AmountInput value={unitCost} onChange={setUnitCost} />
        </Field>
        <Field
          label="Frais annexes (facultatif)"
          hint="Transport, douane… pour tout le lot (pas par unité) — réparti automatiquement sur la quantité.">
          <AmountInput value={extraFees} onChange={setExtraFees} placeholder="0" />
        </Field>

        {landedUnitCost > 0 ? (
          <div className="card card-muted" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Prix de vente proposé</span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Coût de revient : {formatAmount(landedUnitCost, currency)} / {product.unit}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Marge souhaitée</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  className="input"
                  style={{ width: 64, textAlign: 'right' }}
                  value={marginPct}
                  onChange={(e) => onMarginChange(e.target.value)}
                  inputMode="numeric"
                />
                <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>%</span>
              </div>
            </div>
            <Field label="Prix de vente">
              <AmountInput value={salePrice} onChange={onPriceChange} />
            </Field>
            <span className="field-hint">
              Calculé à partir du coût de revient et de la marge — modifie l'un ou l'autre si ça ne te convient pas.
            </span>
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

        {hasDebts ? <Switch checked={isCredit} onChange={setIsCredit} label="Achat à crédit" /> : null}
        {hasDebts && isCredit ? (
          <>
            <PartyPicker label="Fournisseur" kind="supplier" value={partyId} onChange={setPartyId} />
            <Field
              label="Montant payé maintenant (facultatif)"
              hint="Laisse à 0 si rien n'est payé tout de suite. Sinon, le reste devient ta dette envers ce fournisseur.">
              <AmountInput value={amountPaidNow} onChange={setAmountPaidNow} placeholder="0" />
            </Field>
          </>
        ) : null}

        {error ? <span className="error-text">{error}</span> : null}
        <div className="form-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" loading={createPurchase.isPending}>
            Enregistrer le réapprovisionnement
          </Button>
        </div>
      </form>
    </Modal>
  );
}
