import { ArrowLeft, CircleAlert, CircleCheck, KeyRound, MailCheck, User } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { confirmPasswordReset, requestPasswordReset } from '@/api/auth';
import { ApiError } from '@/api/client';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Field';
import { IconInput } from '@/components/ui/IconInput';
import { PasswordInput, PasswordStrength } from '@/components/ui/PasswordInput';

type Step = 'request' | 'confirm' | 'done';

const TITLES: Record<Step, { title: string; subtitle: string }> = {
  request: {
    title: 'Mot de passe oublié',
    subtitle: "Indique ton nom d'utilisateur ou ton e-mail : on t'envoie un code à 6 chiffres.",
  },
  confirm: {
    title: 'Vérifie tes e-mails',
    subtitle: 'Saisis le code reçu et choisis un nouveau mot de passe.',
  },
  done: { title: 'C’est fait !', subtitle: 'Ton mot de passe a été changé.' },
};

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('request');
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
      setCode('');
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

  const stepIndex = step === 'request' ? 1 : step === 'confirm' ? 2 : 3;

  return (
    <AuthLayout title={TITLES[step].title} subtitle={TITLES[step].subtitle}>
      <div className="steps" aria-label={`Étape ${stepIndex} sur 3`}>
        {[1, 2, 3].map((i) => (
          <span key={i} className={i <= stepIndex ? 'done' : undefined} />
        ))}
      </div>

      {step === 'request' ? (
        <form className="auth-form" onSubmit={onRequest} noValidate>
          <Field label="Nom d'utilisateur ou e-mail">
            <IconInput icon={<User size={16} />} value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" autoFocus />
          </Field>
          {error ? (
            <div className="alert error" role="alert">
              <CircleAlert size={16} />
              {error}
            </div>
          ) : null}
          <Button type="submit" block loading={loading} className="btn-lg">
            Envoyer le code
          </Button>
        </form>
      ) : null}

      {step === 'confirm' ? (
        <form className="auth-form" onSubmit={onConfirm} noValidate>
          {info ? (
            <div className="alert info">
              <MailCheck size={16} />
              <span>
                {info} Il est valable 15 minutes. Pense à regarder dans les spams.
              </span>
            </div>
          ) : null}
          <Field label="Code à 6 chiffres">
            <TextInput
              className="input code-input"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="••••••"
              aria-label="Code à 6 chiffres"
              autoFocus
            />
          </Field>
          <Field label="Nouveau mot de passe">
            <PasswordInput value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
          </Field>
          <PasswordStrength password={newPassword} />
          <Field
            label="Confirmer le nouveau mot de passe"
            error={confirmNewPassword && newPassword !== confirmNewPassword ? 'Les deux mots de passe ne correspondent pas.' : undefined}>
            <PasswordInput value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} autoComplete="new-password" />
          </Field>
          {error ? (
            <div className="alert error" role="alert">
              <CircleAlert size={16} />
              {error}
            </div>
          ) : null}
          <Button type="submit" block loading={loading} className="btn-lg">
            <KeyRound size={16} />
            Changer mon mot de passe
          </Button>
          <Button type="button" variant="ghost" block onClick={() => { setError(null); setStep('request'); }}>
            Je n'ai rien reçu — renvoyer un code
          </Button>
          <span className="field-hint" style={{ textAlign: 'center' }}>
            Pour ta sécurité : 5 essais maximum par code, et toutes tes sessions seront déconnectées.
          </span>
        </form>
      ) : null}

      {step === 'done' ? (
        <div className="auth-form">
          <div className="alert success">
            <CircleCheck size={16} />
            <span>
              Ton mot de passe a été mis à jour et toutes tes sessions ont été déconnectées. Un e-mail de confirmation
              t'a été envoyé.
            </span>
          </div>
          <Button block className="btn-lg" onClick={() => navigate('/login', { replace: true })}>
            Se connecter
          </Button>
        </div>
      ) : null}

      <div className="auth-footer">
        <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <ArrowLeft size={15} /> Retour à la connexion
        </Link>
      </div>
    </AuthLayout>
  );
}
