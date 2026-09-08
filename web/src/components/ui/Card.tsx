import type { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  muted?: boolean;
}

export function Card({ muted, className, children, ...rest }: CardProps) {
  const classes = ['card', muted ? 'card-muted' : '', className].filter(Boolean).join(' ');
  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}
