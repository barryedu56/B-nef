import { CircleAlert, ShieldCheck, User } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import { AuthLayout } from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { IconInput } from '@/components/ui/IconInput';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { useAuth } from '@/context/AuthContext';
import { fieldErrors } from '@/lib/formErrors';

type Errors = Partial<Record<'username' | 'password' | 'general', string>>;

export function LoginPage() {
  const { status, signIn } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);

  if (status === 'signedIn') return <Navigate to="/" replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const missing: Errors = {};
    if (!username.trim()) missing.username = "Indique ton nom d'utilisateur.";
    if (!password) missing.password = 'Indique ton mot de passe.';
    setErrors(missing);
    if (Object.keys(missing).length) return;
    setLoading(true);
    try {
      await signIn(username.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      setErrors(fieldErrors(err, ['username', 'password'] as const));
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Bon retour 👋" subtitle="Connecte-toi pour retrouver tes activités et tes chiffres.">
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        {errors.general ? (
          <div className="alert error" role="alert">
            <CircleAlert size={16} />
            {errors.general}
          </div>
        ) : null}
        <Field label="Nom d'utilisateur" error={errors.username}>
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
        <Field label="Mot de passe" error={errors.password} labelAction={<Link to="/forgot-password">Oublié ?</Link>}>
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="Ton mot de passe"
            aria-invalid={errors.password ? true : undefined}
          />
        </Field>
        <Button type="submit" block loading={loading} loadingText="Connexion…" className="btn-lg">
          Se connecter
        </Button>
      </form>
      <div className="auth-footer">
        <span>Pas encore de compte ?</span>
        <Link to="/register">Créer un compte gratuit</Link>
      </div>
      <div className="auth-trust">
        <ShieldCheck size={14} />
        Connexion chiffrée · <Link to="/confidentialite">Confidentialité</Link>
      </div>
    </AuthLayout>
  );
}
