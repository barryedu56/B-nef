import { useState, type FormEvent } from 'react';

import { ApiError } from '@/api/client';
import type { Product } from '@/api/types';
import { Button } from './ui/Button';
import { Field, TextInput } from './ui/Field';
import { Modal } from './ui/Modal';
import { useCreatePersonalUse } from '@/hooks/useProducts';
import { formatAmount } from '@/lib/money';

interface PersonalUseModalProps {
  product: Product;
  currency: string;
  onClose: () => void;
}

/** Retire du stock une quantité gardée pour soi (pas vendue). Valorisée au
 * coût moyen actuel — pas de prix ni de moyen de paiement à saisir, ce n'est
 * pas une vente. */
export function PersonalUseModal({ product, currency, onClose }: PersonalUseModalProps) {
  const consume = useCreatePersonalUse(product.activity);
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const qty = Number(quantity.replace(',', '.'));
  const stock = Number(product.stock_quantity);
  const estimatedCost = qty > 0 ? qty * Number(product.purchase_price) : 0;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!qty || qty <= 0) {
      setError('Indique une quantité valide.');
      return;
    }
    if (qty > stock) {
      setError(`Il ne reste que ${product.stock_quantity} ${product.unit} en stock.`);
      return;
    }
    setError(null);
    try {
      await consume.mutateAsync({ product: product.id, quantity: String(qty), note: note.trim() });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'enregistrer.");
    }
  };

  return (
    <Modal title={`Gardé pour moi — ${product.name}`} onClose={onClose}>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <span className="field-hint">Stock actuel : {product.stock_quantity}</span>
        <Field label={`Quantité (${product.unit})`}>
          <TextInput value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="numeric" autoFocus />
        </Field>
        {qty > 0 ? (
          <span className="field-hint">Valeur retirée du stock (au coût) : {formatAmount(estimatedCost, currency)}</span>
        ) : null}
        <Field label="Note (facultatif)">
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="ex. pour la maison" />
        </Field>
        <span className="field-hint">
          Ça ne compte ni comme une vente, ni comme une charge — juste une ligne d'info séparée dans le rapport
          (« Consommé personnellement »). Le stock et sa valeur diminuent, ton Bénéfice net non.
        </span>
        {error ? <span className="error-text">{error}</span> : null}
        <div className="form-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" loading={consume.isPending}>
            Confirmer
          </Button>
        </div>
      </form>
    </Modal>
  );
}
