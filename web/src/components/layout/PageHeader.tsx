import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  actions?: ReactNode;
}

export function PageHeader({ title, actions }: PageHeaderProps) {
  return (
    <div className="topbar">
      <span className="topbar-title">{title}</span>
      {actions}
    </div>
  );
}
