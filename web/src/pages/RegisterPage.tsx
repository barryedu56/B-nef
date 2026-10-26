import { CircleAlert, Mail, ShieldCheck, User } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import { ApiError } from '@/api/client';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Field, Select } from '@/components/ui/Field';
import { IconInput } from '@/components/ui/IconInput';
import { PasswordInput, PasswordStrength } from '@/components/ui/PasswordInput';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { useAuth } from '@/context/AuthContext';
import { isValidGuineaPhone } from '@/lib/phone';

const CURRENCY_OPTIONS = [
  { value: 'GNF', label: 'Franc guinéen (GNF)' },
  { value: 'XOF', label: 'Franc CFA — BCEAO (XOF)' },
  { value: 'USD', label: 'Dollar américain (USD)' },
  { value: 'EUR', label: 'Euro (EUR)' },
];

export function RegisterPage() {
  const { status, signUp } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [baseCurrency, setBaseCurrency] = useState('GNF');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (status === 'signedIn') return <Navigate to="/" replace />;

  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError("Choisis un nom d'utilisateur.");
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError("Indique une adresse e-mail valide — c'est ce qui te permettra de récupérer ton compte.");
      return;
    }
    if (password.length < 8) {
      setError('Le mot de passe doit faire au moins 8 caractères.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    if (phone && !isValidGuineaPhone(phone)) {
      setError('Numéro invalide : 9 chiffres, en commençant par 61, 62, 65 ou 66.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await signUp({
        username: username.trim(),
        password,
        email: email.trim(),
        phone: phone.trim(),
        base_currency: baseCurrency,
      });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de créer le compte.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Créer ton compte" subtitle="Gratuit, en moins d'une minute. Tu pourras tout modifier plus tard.">
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <Field label="Nom d'utilisateur">
          <IconInput icon={<User size={16} />} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" placeholder="ex. amadou" autoFocus />
        </Field>
        <Field label="E-mail" hint="Indispensable pour récupérer ton compte si tu oublies ton mot de passe.">
          <IconInput icon={<Mail size={16} />} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="toi@exemple.com" />
        </Field>
        <Field label="Mot de passe">
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder="8 caractères minimum" />
        </Field>
        <PasswordStrength password={password} />
        <Field label="Confirmer le mot de passe" error={mismatch ? 'Les deux mots de passe ne correspondent pas.' : undefined}>
          <PasswordInput value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
        </Field>
        <div className="form-grid" style={{ gap: 14 }}>
          <Field label="Téléphone (facultatif)">
            <PhoneInput value={phone} onChange={setPhone} />
          </Field>
          <Field label="Devise principale">
            <Select options={CURRENCY_OPTIONS} value={baseCurrency} onChange={setBaseCurrency} />
          </Field>
        </div>
        {error ? (
          <div className="alert error" role="alert">
            <CircleAlert size={16} />
            {error}
          </div>
        ) : null}
        <Button type="submit" block loading={loading} className="btn-lg">
          Créer mon compte
        </Button>
      </form>
      <div className="auth-footer">
        <span>Déjà un compte ?</span>
        <Link to="/login">Se connecter</Link>
      </div>
      <div className="auth-trust">
        <ShieldCheck size={14} />
        En créant un compte, tu acceptes la <Link to="/confidentialite">politique de confidentialité</Link>.
      </div>
    </AuthLayout>
  );
}
