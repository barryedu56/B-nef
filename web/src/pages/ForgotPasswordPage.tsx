import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { confirmPasswordReset, requestPasswordReset } from '@/api/auth';
import { ApiError } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Field';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'request' | 'confirm' | 'done'>('request');
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onRequest = async (e: FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setError("Indique ton nom d'utilisateur ou ton e-mail.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await requestPasswordReset(identifier.trim());
      setInfo(res.detail);
      setStep('confirm');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'envoyer le code.");
    } finally {
      setLoading(false);
    }
  };

  const onConfirm = async (e: FormEvent) => {
    e.preventDefault();
    if (code.trim().length !== 6) {
      setError('Le code fait 6 chiffres.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Le mot de passe doit faire au moins 8 caractères.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await confirmPasswordReset(identifier.trim(), code.trim(), newPassword);
      setStep('done');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Code invalide ou expiré.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div>
          <h1 className="auth-title">Mot de passe oublié</h1>
          {step === 'request' ? (
            <p className="auth-subtitle">
              Indique ton nom d'utilisateur ou ton e-mail : on t'envoie un code à 6 chiffres pour choisir un
              nouveau mot de passe.
            </p>
          ) : null}
        </div>

        {step === 'request' ? (
          <form className="auth-form" onSubmit={onRequest}>
            <Field label="Nom d'utilisateur ou e-mail">
              <TextInput value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" />
            </Field>
            {error ? <span className="error-text">{error}</span> : null}
            <Button type="submit" block loading={loading}>
              Envoyer le code
            </Button>
          </form>
        ) : null}

        {step === 'confirm' ? (
          <form className="auth-form" onSubmit={onConfirm}>
            {info ? <span style={{ fontSize: 13, color: 'var(--positive)' }}>{info}</span> : null}
            <Field label="Code reçu (6 chiffres)">
              <TextInput value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" placeholder="000000" />
            </Field>
            <Field label="Nouveau mot de passe">
              <TextInput type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
            </Field>
            <Field label="Confirmer le nouveau mot de passe">
              <TextInput
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </Field>
            {error ? <span className="error-text">{error}</span> : null}
            <Button type="submit" block loading={loading}>
              Réinitialiser le mot de passe
            </Button>
            <Button type="button" variant="ghost" block onClick={() => setStep('request')}>
              Recevoir un nouveau code
            </Button>
          </form>
        ) : null}

        {step === 'done' ? (
          <div className="auth-form">
            <span style={{ fontSize: 13.5 }}>Ton mot de passe a été mis à jour. Tu peux te reconnecter.</span>
            <Button block onClick={() => navigate('/login', { replace: true })}>
              Retour à la connexion
            </Button>
          </div>
        ) : null}

        <div className="auth-footer">
          <Link to="/login">Retour à la connexion</Link>
        </div>
      </div>
    </div>
  );
}
