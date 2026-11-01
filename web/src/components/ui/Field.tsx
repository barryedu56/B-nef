import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  /** Lien ou bouton à droite du libellé (ex. « Oublié ? »). */
  labelAction?: ReactNode;
  children: ReactNode;
}

export function Field({ label, hint, error, labelAction, children }: FieldProps) {
  return (
    <div className={['field', error ? 'has-error' : ''].filter(Boolean).join(' ')}>
      {labelAction ? (
        <span className="field-label-row">
          <span className="field-label">{label}</span>
          {labelAction}
        </span>
      ) : (
        <span className="field-label">{label}</span>
      )}
      {children}
      {hint && !error ? <span className="field-hint">{hint}</span> : null}
      {error ? <span className="error-text">{error}</span> : null}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" {...props} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="input" {...props} />;
}

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  options: SelectOption[];
  placeholder?: string;
  onChange: (value: string) => void;
}

export function Select({ options, placeholder, onChange, value, ...rest }: SelectProps) {
  return (
    <select className="select" value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest}>
      <option value="" disabled>
        {placeholder ?? 'Choisir…'}
      </option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
