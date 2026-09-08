import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import { ApiError } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Field';
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
    <div className="auth-shell">
      <div className="auth-card">
        <div>
          <h1 className="auth-title">Bénef</h1>
          <p className="auth-subtitle">Poste d'analyse — connecte-toi pour continuer.</p>
        </div>
        <form className="auth-form" onSubmit={onSubmit}>
          <Field label="Nom d'utilisateur">
            <TextInput value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
          </Field>
          <Field label="Mot de passe">
            <TextInput
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </Field>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Link to="/forgot-password" style={{ fontSize: 12.5 }}>
              Mot de passe oublié ?
            </Link>
          </div>
          {error ? <span className="error-text">{error}</span> : null}
          <Button type="submit" block loading={loading}>
            Se connecter
          </Button>
        </form>
        <div className="auth-footer">
          <span>Pas encore de compte ?</span>
          <Link to="/register">Créer un compte</Link>
        </div>
      </div>
    </div>
  );
}
