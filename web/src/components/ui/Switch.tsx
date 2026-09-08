interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
}

export function Switch({ checked, onChange, label, description }: SwitchProps) {
  const toggle = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={['switch', checked ? 'on' : ''].filter(Boolean).join(' ')}
      onClick={() => onChange(!checked)}
    />
  );

  if (!label) return toggle;

  return (
    <div className="switch-row">
      <div className="switch-text">
        <span className="switch-label">{label}</span>
        {description ? <span className="switch-description">{description}</span> : null}
      </div>
      {toggle}
    </div>
  );
}
