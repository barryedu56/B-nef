import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type FormEvent } from 'react';

import { changePassword, deleteAccount, deleteAvatar, updateMe, uploadAvatar } from '@/api/auth';
import { ApiError } from '@/api/client';
import { Avatar } from '@/components/ui/Avatar';
import { CategoriesCard, PaymentMethodsCard } from '@/components/SettingsLists';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Select } from '@/components/ui/Field';
import { PasswordInput, PasswordStrength } from '@/components/ui/PasswordInput';
import { EmptyState, ErrorBlock, LoadingBlock } from '@/components/ui/QueryState';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/context/AuthContext';
import { useArchivedActivities, useUpdateActivity } from '@/hooks/useActivities';
import type { Activity } from '@/api/types';

const MAX_AVATAR_SIZE = 5 * 1024 * 1024;

const CURRENCY_OPTIONS = [
  { value: 'GNF', label: 'Franc guinéen (GNF)' },
  { value: 'XOF', label: 'Franc CFA — BCEAO (XOF)' },
  { value: 'USD', label: 'Dollar américain (USD)' },
  { value: 'EUR', label: 'Euro (EUR)' },
];

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { user, signOut, refreshUser } = useAuth();
  const [saving, setSaving] = useState<'base' | 'display' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  const onPickAvatar = () => fileInputRef.current?.click();

  const onAvatarSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setAvatarError('Choisis une image (JPEG, PNG…).');
      return;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      setAvatarError('L’image ne doit pas dépasser 5 Mo.');
      return;
    }
    setAvatarError(null);
    setAvatarBusy(true);
    try {
      await uploadAvatar(file);
      await refreshUser();
    } catch (err) {
      setAvatarError(err instanceof ApiError ? err.message : "Impossible d'envoyer cette photo.");
    } finally {
      setAvatarBusy(false);
    }
  };

  const onRemoveAvatar = async () => {
    setAvatarError(null);
    setAvatarBusy(true);
    try {
      await deleteAvatar();
      await refreshUser();
    } catch (err) {
      setAvatarError(err instanceof ApiError ? err.message : 'Impossible de retirer cette photo.');
    } finally {
      setAvatarBusy(false);
    }
  };

  const onChange = (field: 'base_currency' | 'display_currency', kind: 'base' | 'display') => async (value: string) => {
    setSaving(kind);
    setError(null);
    try {
      await updateMe({ [field]: value });
      await refreshUser();
      // Tous les montants déjà affichés sont recalculés dans la nouvelle devise.
      await queryClient.invalidateQueries();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Échec de la mise à jour.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <>
      <PageHeader title="Paramètres" />
      <div className="content" style={{ maxWidth: 480 }}>
        <Card>
          <span className="card-title">Compte</span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 0' }}>
            <Avatar url={user.avatar} name={user.username} size={56} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button type="button" variant="secondary" onClick={onPickAvatar} loading={avatarBusy}>
                  {user.avatar ? 'Changer la photo' : 'Ajouter une photo'}
                </Button>
                {user.avatar ? (
                  <Button type="button" variant="secondary" onClick={onRemoveAvatar} loading={avatarBusy}>
                    Retirer
                  </Button>
                ) : null}
              </div>
              {avatarError ? <span className="error-text">{avatarError}</span> : null}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={onAvatarSelected} />
          </div>

          <div className="switch-row">
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Nom d'utilisateur</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{user.username}</span>
          </div>
          {user.email ? (
            <div className="switch-row">
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>E-mail</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{user.email}</span>
            </div>
          ) : null}
          {user.phone ? (
            <div className="switch-row">
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Téléphone</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{user.phone}</span>
            </div>
          ) : null}
        </Card>

        <ChangePasswordCard />
        <CategoriesCard />
        <PaymentMethodsCard />

        <Card style={{ marginTop: 16 }}>
          <span className="card-title">Activités archivées</span>
          <ArchivedActivitiesList />
        </Card>

        <Card style={{ marginTop: 16 }}>
          <span className="card-title">Devises</span>
          <p className="field-hint" style={{ marginBottom: 12 }}>
            La devise principale sert de référence pour la vue globale et le tableau de bord. La devise
            d'affichage reconvertit automatiquement les montants consolidés, sans rien saisir.
          </p>
          <div className="field" style={{ marginBottom: 12 }}>
            <span className="field-label">Devise principale</span>
            <Select
              options={CURRENCY_OPTIONS}
              value={user.base_currency}
              onChange={onChange('base_currency', 'base')}
              disabled={saving === 'base'}
            />
          </div>
          <div className="field">
            <span className="field-label">Devise d'affichage</span>
            <Select
              options={CURRENCY_OPTIONS}
              value={user.effective_display_currency}
              onChange={onChange('display_currency', 'display')}
              disabled={saving === 'display'}
            />
          </div>
        </Card>

        {error ? <span className="error-text">{error}</span> : null}

        <Button variant="danger" onClick={signOut} style={{ marginTop: 16 }}>
          Se déconnecter
        </Button>

        <DeleteAccountCard onDeleted={signOut} />
      </div>
    </>
  );
}

function ArchivedActivitiesList() {
  const archived = useArchivedActivities();

  if (archived.isLoading) return <LoadingBlock />;
  if (archived.isError) return <ErrorBlock message="Impossible de charger les activités archivées." onRetry={() => archived.refetch()} />;
  if (!archived.data || archived.data.length === 0) {
    return <EmptyState title="Aucune activité archivée" description="Les activités que tu archives apparaissent ici." />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {archived.data.map((activity) => (
        <ArchivedRow key={activity.id} activity={activity} />
      ))}
    </div>
  );
}

function ArchivedRow({ activity }: { activity: Activity }) {
  const update = useUpdateActivity(activity.id);

  return (
    <div className="switch-row">
      <span style={{ fontSize: 13 }}>{activity.name}</span>
      <Button variant="secondary" onClick={() => update.mutate({ is_archived: false })} loading={update.isPending}>
        Réactiver
      </Button>
    </div>
  );
}

/** Suppression définitive du compte (exigence du Play Store). */
function DeleteAccountCard({ onDeleted }: { onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onConfirm = async () => {
    if (!confirm('Supprimer définitivement ton compte et TOUTES tes données ? Cette action est irréversible.')) return;
    setError(null);
    setBusy(true);
    try {
      await deleteAccount(password);
      onDeleted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Suppression impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={{ marginTop: 32, borderColor: 'var(--negative)' }}>
      <span className="card-title" style={{ color: 'var(--negative)' }}>
        Supprimer mon compte
      </span>
      <p className="field-hint" style={{ marginBottom: 12 }}>
        Efface définitivement ton compte et toutes ses données : activités, opérations, stock, clients et
        fournisseurs, budgets. Exporte tes chiffres avant si tu veux les garder (Rapports → Export).
      </p>
      {open ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360 }}>
          <Field label="Confirme avec ton mot de passe">
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </Field>
          {error ? <span className="error-text">{error}</span> : null}
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="danger" onClick={onConfirm} loading={busy} disabled={!password}>
              Supprimer définitivement
            </Button>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Annuler
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Supprimer mon compte…
        </Button>
      )}
    </Card>
  );
}

function ChangePasswordCard() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmNext, setConfirmNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setDone(false);
    if (next.length < 8) {
      setError('Le nouveau mot de passe doit faire au moins 8 caractères.');
      return;
    }
    if (next !== confirmNext) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await changePassword(current, next);
      setCurrent('');
      setNext('');
      setConfirmNext('');
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Changement impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={{ marginTop: 16 }}>
      <span className="card-title">Mot de passe</span>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 420 }}>
        <Field label="Mot de passe actuel">
          <PasswordInput value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
        </Field>
        <Field label="Nouveau mot de passe">
          <PasswordInput value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
        </Field>
        <PasswordStrength password={next} />
        <Field label="Confirmer le nouveau mot de passe">
          <PasswordInput value={confirmNext} onChange={(e) => setConfirmNext(e.target.value)} autoComplete="new-password" />
        </Field>
        {error ? <div className="alert error">{error}</div> : null}
        {done ? (
          <div className="alert success">Mot de passe changé. Tes autres appareils ont été déconnectés.</div>
        ) : null}
        <div>
          <Button type="submit" loading={busy} disabled={!current || !next}>
            Changer le mot de passe
          </Button>
        </div>
      </form>
    </Card>
  );
}
