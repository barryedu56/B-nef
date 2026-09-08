import { Button } from './Button';

export function LoadingBlock({ label }: { label?: string }) {
  return (
    <div className="state-block">
      <span>Chargement{label ? ` — ${label}` : '…'}</span>
    </div>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state-block">
      <span className="error-text">{message}</span>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          Réessayer
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="state-block">
      <span className="state-title">{title}</span>
      {description ? <span>{description}</span> : null}
      {actionLabel && onAction ? (
        <Button variant="secondary" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
