import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  /** Texte affiché à côté du chargement (ex. « Connexion… »). */
  loadingText?: string;
  block?: boolean;
}

export function Button({ variant = 'primary', loading, loadingText, block, disabled, className, children, ...rest }: ButtonProps) {
  const classes = ['btn', `btn-${variant}`, block ? 'btn-block' : '', className].filter(Boolean).join(' ');
  return (
    <button className={classes} disabled={disabled || loading} {...rest}>
      {loading ? (
        <>
          <span className="spinner" aria-label={loadingText ? undefined : 'Chargement'} />
          {loadingText}
        </>
      ) : (
        children
      )}
    </button>
  );
}
