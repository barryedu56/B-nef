import { CircleAlert, ShieldCheck, User } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import { ApiError } from '@/api/client';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { IconInput } from '@/components/ui/IconInput';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { useAuth } from '@/context/AuthContext';

export function LoginPage() {
  const { status, signIn } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (status === 'signedIn') return <Navigate to="/" replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError("Renseigne ton nom d'utilisateur et ton mot de passe.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await signIn(username.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de se connecter.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Bon retour 👋" subtitle="Connecte-toi pour retrouver tes activités et tes chiffres.">
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <Field label="Nom d'utilisateur">
          <IconInput
            icon={<User size={16} />}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            placeholder="ex. amadou"
            autoFocus
          />
        </Field>
        <Field label="Mot de passe">
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </Field>
        <div className="auth-row">
          <span />
          <Link to="/forgot-password">Mot de passe oublié ?</Link>
        </div>
        {error ? (
          <div className="alert error" role="alert">
            <CircleAlert size={16} />
            {error}
          </div>
        ) : null}
        <Button type="submit" block loading={loading} className="btn-lg">
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
