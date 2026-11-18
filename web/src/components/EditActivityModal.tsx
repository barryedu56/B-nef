import { useState, type FormEvent } from 'react';

import { ACTIVITY_TYPE_OPTIONS } from '@/api/activities';
import { ApiError } from '@/api/client';
import type { Activity } from '@/api/types';
import { Button } from './ui/Button';
import { Field, Select, TextInput } from './ui/Field';
import { Modal } from './ui/Modal';
import { useUpdateActivity } from '@/hooks/useActivities';

/** Nom et type d'une activité. La devise ne change pas : les montants déjà
 * saisis sont dans cette devise. */
export function EditActivityModal({ activity, onClose }: { activity: Activity; onClose: () => void }) {
  const update = useUpdateActivity(activity.id);
  const [name, setName] = useState(activity.name);
  const [type, setType] = useState<string>(activity.type);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Donne un nom à ton activité.');
      return;
    }
    setError(null);
    try {
      await update.mutateAsync({ name: name.trim(), type: type as Activity['type'] });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'enregistrer.");
    }
  };

  return (
    <Modal title="Modifier l'activité" onClose={onClose}>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Nom">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label="Type">
          <Select options={ACTIVITY_TYPE_OPTIONS} value={type} onChange={setType} />
        </Field>
        <Field label="Devise">
          <TextInput value={activity.currency} disabled />
        </Field>
        {error ? <span className="error-text">{error}</span> : null}
        <div className="form-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" loading={update.isPending}>
            Enregistrer
          </Button>
        </div>
      </form>
    </Modal>
  );
}
