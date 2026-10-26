import { useState, type FormEvent } from 'react';

import { ApiError } from '@/api/client';
import type { Direction } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TextInput } from '@/components/ui/Field';
import { LoadingBlock } from '@/components/ui/QueryState';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useCategoryMutations, usePaymentMethodMutations } from '@/hooks/useSettingsLists';
import { useCategories, usePaymentMethods } from '@/hooks/useTransactions';

interface Item {
  id: number;
  name: string;
  hint?: string;
}

/** Liste modifiable : ajouter, renommer, supprimer (le serveur refuse la
 * suppression d'un élément déjà utilisé, avec un message expliquant de le
 * renommer à la place). */
function EditableList({
  items,
  loading,
  addPlaceholder,
  onAdd,
  onRename,
  onDelete,
}: {
  items: Item[];
  loading: boolean;
  addPlaceholder: string;
  onAdd: (name: string) => Promise<unknown>;
  onRename: (id: number, name: string) => Promise<unknown>;
  onDelete: (id: number) => Promise<unknown>;
}) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
      return true;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action impossible.');
      return false;
    }
  };

  const onSubmitNew = async (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    if (await run(() => onAdd(newName.trim()))) setNewName('');
  };

  if (loading) return <LoadingBlock />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((item) =>
        editingId === item.id ? (
          <form
            key={item.id}
            style={{ display: 'flex', gap: 8 }}
            onSubmit={async (e) => {
              e.preventDefault();
              if (editName.trim() && (await run(() => onRename(item.id, editName.trim())))) setEditingId(null);
            }}>
            <TextInput value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus aria-label="Nouveau nom" />
            <Button type="submit">OK</Button>
            <Button type="button" variant="ghost" onClick={() => setEditingId(null)}>
              Annuler
            </Button>
          </form>
        ) : (
          <div key={item.id} className="switch-row" style={{ padding: '4px 0' }}>
            <span style={{ fontSize: 13 }}>
              {item.name}
              {item.hint ? <span style={{ color: 'var(--text-tertiary)' }}> · {item.hint}</span> : null}
            </span>
            <span style={{ display: 'flex', gap: 4 }}>
              <Button
                variant="ghost"
                onClick={() => {
                  setEditingId(item.id);
                  setEditName(item.name);
                }}>
                Renommer
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  if (confirm(`Supprimer « ${item.name} » ?`)) void run(() => onDelete(item.id));
                }}>
                Supprimer
              </Button>
            </span>
          </div>
        )
      )}
      <form onSubmit={onSubmitNew} style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <TextInput value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={addPlaceholder} aria-label={addPlaceholder} />
        <Button type="submit" variant="secondary">
          Ajouter
        </Button>
      </form>
      {error ? <span className="error-text">{error}</span> : null}
    </div>
  );
}

export function CategoriesCard() {
  const [direction, setDirection] = useState<Direction>('out');
  const categories = useCategories(direction);
  const { create, rename, remove } = useCategoryMutations();
  return (
    <Card style={{ marginTop: 16 }}>
      <span className="card-title">Catégories</span>
      <div style={{ marginBottom: 12 }}>
        <SegmentedControl
          options={[
            { value: 'out', label: 'Dépenses' },
            { value: 'in', label: 'Entrées' },
          ]}
          value={direction}
          onChange={setDirection}
        />
      </div>
      <EditableList
        items={(categories.data ?? []).map((c) => ({ id: c.id, name: c.name }))}
        loading={categories.isLoading}
        addPlaceholder={direction === 'out' ? 'Nouvelle catégorie de dépense' : "Nouvelle catégorie d'entrée"}
        onAdd={(name) => create.mutateAsync({ name, direction })}
        onRename={(id, name) => rename.mutateAsync({ id, name })}
        onDelete={(id) => remove.mutateAsync(id)}
      />
    </Card>
  );
}

export function PaymentMethodsCard() {
  const methods = usePaymentMethods();
  const { create, rename, remove } = usePaymentMethodMutations();
  return (
    <Card style={{ marginTop: 16 }}>
      <span className="card-title">Moyens de paiement</span>
      <EditableList
        items={(methods.data ?? []).map((m) => ({ id: m.id, name: m.name, hint: m.is_cash ? 'espèces' : undefined }))}
        loading={methods.isLoading}
        addPlaceholder="Nouveau moyen (ex. MTN Money)"
        onAdd={(name) => create.mutateAsync({ name })}
        onRename={(id, name) => rename.mutateAsync({ id, name })}
        onDelete={(id) => remove.mutateAsync(id)}
      />
    </Card>
  );
}
