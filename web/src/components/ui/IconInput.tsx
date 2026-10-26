import type { InputHTMLAttributes, ReactNode } from 'react';

/** Champ texte précédé d'une icône (e-mail, utilisateur…). */
export function IconInput({ icon, ...props }: InputHTMLAttributes<HTMLInputElement> & { icon: ReactNode }) {
  return (
    <div className="input-group">
      <span className="input-icon">{icon}</span>
      <input className="input" {...props} />
    </div>
  );
}
