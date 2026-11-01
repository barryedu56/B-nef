import { Check, CircleAlert, Mail, User } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import { AuthLayout } from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Field, Select } from '@/components/ui/Field';
import { IconInput } from '@/components/ui/IconInput';
import { PasswordInput, PasswordStrength } from '@/components/ui/PasswordInput';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { useAuth } from '@/context/AuthContext';
import { fieldErrors } from '@/lib/formErrors';
import { isValidGuineaPhone } from '@/lib/phone';

const CURRENCY_OPTIONS = [
  { value: 'GNF', label: 'Franc guinéen (GNF)' },
  { value: 'XOF', label: 'Franc CFA — BCEAO (XOF)' },
  { value: 'USD', label: 'Dollar américain (USD)' },
  { value: 'EUR', label: 'Euro (EUR)' },
];

const PERKS = ['Gratuit', 'Marche sans internet sur téléphone', 'Données privées'];

// Comme le serveur : lettres, chiffres et . @ + - _ (pas d'espace).
const USERNAME_RE = /^[\p{L}\p{N}_.@+-]+$/u;

const FIELDS = ['username', 'email', 'password', 'confirm', 'phone', 'consent'] as const;
type Errors = Partial<Record<(typeof FIELDS)[number] | 'general', string>>;

export function RegisterPage() {
  const { status, signUp } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [baseCurrency, setBaseCurrency] = useState('GNF');
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);

  if (status === 'signedIn') return <Navigate to="/" replace />;

  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const validate = (): Errors => {
    const e: Errors = {};
    const name = username.trim();
    if (!name) e.username = "Choisis un nom d'utilisateur.";
    else if (!USERNAME_RE.test(name)) e.username = 'Lettres, chiffres et . @ + - _ seulement, sans espace.';
    else if (name.length > 150) e.username = '150 caractères maximum.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'Adresse e-mail invalide.';
    if (password.length < 8) e.password = 'Au moins 8 caractères.';
    if (password !== confirmPassword) e.confirm = 'Les deux mots de passe ne correspondent pas.';
    if (phone && !isValidGuineaPhone(phone)) e.phone = '9 chiffres, en commençant par 61, 62, 65 ou 66.';
    if (!consent) e.consent = 'Coche la case pour accepter la politique de confidentialité.';
    return e;
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return;
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
      setErrors(fieldErrors(err, FIELDS));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Créer ton compte" subtitle="Gratuit · moins d'une minute. Tu pourras tout modifier plus tard.">
      <ul className="auth-perks">
        {PERKS.map((perk) => (
          <li key={perk}>
            <span>
              <Check size={10} strokeWidth={3} />
            </span>
            {perk}
          </li>
        ))}
      </ul>
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        {errors.general ? (
          <div className="alert error" role="alert">
            <CircleAlert size={16} />
            {errors.general}
          </div>
        ) : null}
        <Field
          label="Nom d'utilisateur"
          error={errors.username}
          hint="Sert à te connecter. Lettres, chiffres et . @ + - _ (sans espace).">
          <IconInput
            icon={<User size={16} />}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="ex. amadou"
            aria-invalid={errors.username ? true : undefined}
            autoFocus
          />
        </Field>
        <Field label="E-mail" error={errors.email} hint="Indispensable pour récupérer ton compte si tu oublies ton mot de passe.">
          <IconInput
            icon={<Mail size={16} />}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            autoCapitalize="none"
            placeholder="toi@exemple.com"
            aria-invalid={errors.email ? true : undefined}
          />
        </Field>
        <Field label="Mot de passe" error={errors.password}>
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="8 caractères minimum"
            aria-invalid={errors.password ? true : undefined}
          />
        </Field>
        <PasswordStrength password={password} />
        <Field
          label="Confirmer le mot de passe"
          error={errors.confirm ?? (mismatch ? 'Les deux mots de passe ne correspondent pas.' : undefined)}>
          <PasswordInput
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            aria-invalid={errors.confirm || mismatch ? true : undefined}
          />
        </Field>
        <div className="form-grid" style={{ gap: 14 }}>
          <Field label="Téléphone (facultatif)" error={errors.phone}>
            <PhoneInput value={phone} onChange={setPhone} />
          </Field>
          <Field label="Devise principale">
            <Select options={CURRENCY_OPTIONS} value={baseCurrency} onChange={setBaseCurrency} />
          </Field>
        </div>
        <div className="field">
          <label className="auth-consent">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => {
                setConsent(e.target.checked);
                setErrors((x) => ({ ...x, consent: undefined }));
              }}
              aria-invalid={errors.consent ? true : undefined}
            />
            <span>
              J'accepte la{' '}
              <Link to="/confidentialite" target="_blank">
                politique de confidentialité
              </Link>{' '}
              de Bénef.
            </span>
          </label>
          {errors.consent ? <span className="error-text">{errors.consent}</span> : null}
        </div>
        <Button type="submit" block loading={loading} loadingText="Création du compte…" className="btn-lg">
          Créer mon compte
        </Button>
      </form>
      <div className="auth-footer">
        <span>Déjà un compte ?</span>
        <Link to="/login">Se connecter</Link>
      </div>
    </AuthLayout>
  );
}
