import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import { ApiError } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Field, Select, TextInput } from '@/components/ui/Field';
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
    <div className="auth-shell">
      <div className="auth-card">
        <div>
          <h1 className="auth-title">Créer un compte</h1>
          <p className="auth-subtitle">Choisis ta devise principale — tu pourras en changer plus tard.</p>
        </div>
        <form className="auth-form" onSubmit={onSubmit}>
          <Field label="Nom d'utilisateur">
            <TextInput value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
          </Field>
          <Field label="E-mail" hint="Obligatoire : c'est le seul moyen de récupérer ton compte si tu oublies ton mot de passe.">
            <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </Field>
          <Field label="Mot de passe (8 caractères min.)">
            <TextInput
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
          <Field label="Confirmer le mot de passe">
            <TextInput
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
          <Field label="Téléphone (facultatif)">
            <PhoneInput value={phone} onChange={setPhone} />
          </Field>
          <Field label="Devise principale">
            <Select options={CURRENCY_OPTIONS} value={baseCurrency} onChange={setBaseCurrency} />
          </Field>
          {error ? <span className="error-text">{error}</span> : null}
          <Button type="submit" block loading={loading}>
            Créer mon compte
          </Button>
        </form>
        <div className="auth-footer">
          <span>Déjà un compte ?</span>
          <Link to="/login">Se connecter</Link>
        </div>
      </div>
    </div>
  );
}
