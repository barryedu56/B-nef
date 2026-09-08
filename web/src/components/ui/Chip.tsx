interface ChipProps {
  label: string;
  selected?: boolean;
  onClick?: () => void;
  tone?: 'default' | 'warning' | 'negative';
}

export function Chip({ label, selected, onClick, tone = 'default' }: ChipProps) {
  const classes = ['chip', selected ? 'selected' : '', !selected && tone !== 'default' ? tone : '']
    .filter(Boolean)
    .join(' ');
  return (
    <button type="button" className={classes} onClick={onClick}>
      {label}
    </button>
  );
}
