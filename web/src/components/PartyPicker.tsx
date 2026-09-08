import { useState } from 'react';

import { ApiError } from '@/api/client';
import type { PartyKind } from '@/api/types';
import { useCreateParty, useParties } from '@/hooks/useParties';
import { isValidGuineaPhone } from '@/lib/phone';
import { Field, Select, TextInput } from './ui/Field';
import { PhoneInput } from './ui/PhoneInput';
import { Button } from './ui/Button';

interface PartyPickerProps {
  label: string;
  kind: PartyKind;
  value: string | null;
  onChange: (value: string) => void;
}

export function PartyPicker({ label, kind, value, onChange }: PartyPickerProps) {
  const parties = useParties(kind);
  const createParty = useCreateParty();
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  const options = (parties.data ?? []).map((p) => ({ value: String(p.id), label: p.name }));

  const onCreate = async () => {
    if (!newName.trim()) return;
    if (newPhone && !isValidGuineaPhone(newPhone)) {
      setAddError('Numéro invalide : 9 chiffres, en commençant par 61, 62, 65 ou 66.');
      return;
    }
    setAddError(null);
    try {
      const party = await createParty.mutateAsync({ name: newName.trim(), phone: newPhone, kind });
      setNewName('');
      setNewPhone('');
      onChange(String(party.id));
    } catch (e) {
      setAddError(e instanceof ApiError ? e.message : "Impossible d'ajouter ce tiers.");
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Field label={label}>
        <Select options={options} value={value ?? ''} onChange={onChange} placeholder="Choisir…" />
      </Field>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Ajouter un nouveau tiers (facultatif : nom et numéro)
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <TextInput value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nom" />
          <PhoneInput value={newPhone} onChange={setNewPhone} placeholder="Numéro (ex. 622123456)" />
          <Button type="button" variant="secondary" onClick={onCreate} disabled={!newName.trim() || createParty.isPending}>
            Ajouter
          </Button>
        </div>
        {addError ? <span className="error-text">{addError}</span> : null}
      </div>
    </div>
  );
}
