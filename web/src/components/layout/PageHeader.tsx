import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="topbar">
      <h1 className="topbar-title" style={{ margin: 0 }}>
        {title}
        {subtitle ? <span className="topbar-subtitle">{subtitle}</span> : null}
      </h1>
      {actions}
    </div>
  );
}
