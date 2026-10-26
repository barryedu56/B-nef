import {
  Boxes,
  FileChartColumn,
  LayoutDashboard,
  PiggyBank,
  Receipt,
  Settings,
  Store,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';

import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/context/AuthContext';

const NAV_ITEMS: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: '/', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
  { to: '/money', label: 'Mon argent', icon: Wallet },
  { to: '/activities', label: 'Activités', icon: Store },
  { to: '/transactions', label: 'Transactions', icon: Receipt },
  { to: '/inventory', label: 'Inventaire', icon: Boxes },
  { to: '/parties', label: 'Tiers & dettes', icon: Users },
  { to: '/budgets', label: 'Budgets', icon: PiggyBank },
  { to: '/reports', label: 'Rapports', icon: FileChartColumn },
  { to: '/settings', label: 'Paramètres', icon: Settings },
];

export function AppLayout() {
  const { user } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src="/logo.png" alt="" />
          Bénef
        </div>
        <nav className="sidebar-nav" aria-label="Navigation principale">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => ['sidebar-link', isActive ? 'active' : ''].filter(Boolean).join(' ')}>
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <Avatar url={user?.avatar} name={user?.username} size={32} />
          <div className="sidebar-user">
            <span>{user?.username}</span>
            {user?.email ? <small>{user.email}</small> : null}
          </div>
        </div>
      </aside>
      <div className="main">
        <Outlet />
      </div>
    </div>
  );
}
