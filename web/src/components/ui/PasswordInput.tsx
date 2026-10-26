import { Eye, EyeOff, Lock } from 'lucide-react';
import { useState, type InputHTMLAttributes } from 'react';

/** Champ mot de passe avec bouton afficher / masquer. */
export function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="input-group">
      <span className="input-icon">
        <Lock size={16} />
      </span>
      <input className="input has-action" type={visible ? 'text' : 'password'} {...props} />
      <button
        type="button"
        className="input-action"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

const LEVELS = [
  { label: 'Trop faible', color: 'var(--negative)' },
  { label: 'Faible', color: 'var(--warning)' },
  { label: 'Correct', color: '#ca8a04' },
  { label: 'Solide', color: 'var(--positive)' },
  { label: 'Très solide', color: 'var(--positive)' },
];

/** 0 à 4 : longueur, mélange de lettres / chiffres / symboles. Indicatif —
 * le serveur reste juge (8 caractères min., pas trop courant, pas trop
 * proche du nom d'utilisateur). */
export function passwordScore(password: string): number {
  if (password.length < 8) return 0;
  let score = 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;
  else if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) score += 0.5;
  return Math.min(4, Math.floor(score));
}

export function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const score = passwordScore(password);
  const level = LEVELS[score];
  return (
    <div className="strength" aria-live="polite">
      <div className="strength-bars">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} style={{ background: i < Math.max(1, score) ? level.color : undefined }} />
        ))}
      </div>
      <span className="strength-label">
        Robustesse : <strong style={{ color: level.color }}>{level.label}</strong>
        {score < 2 ? ' · 12 caractères, majuscules, chiffres et symboles aident beaucoup' : ''}
      </span>
    </div>
  );
}
