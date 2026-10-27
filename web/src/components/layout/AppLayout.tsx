import {
  Boxes,
  FileChartColumn,
  LayoutDashboard,
  PiggyBank,
  Receipt,
  Repeat,
  Settings,
  Store,
  Users,
  Wallet,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import { useSyncExternalStore } from 'react';
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
  { to: '/recurring', label: 'Dépenses fixes', icon: Repeat },
  { to: '/reports', label: 'Rapports', icon: FileChartColumn },
  { to: '/settings', label: 'Paramètres', icon: Settings },
];

function subscribeOnline(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

export function AppLayout() {
  const { user } = useAuth();
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);

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
        {!online ? (
          <div className="offline-banner" role="status">
            <WifiOff size={16} />
            Pas de connexion internet : l'app web a besoin du réseau. Pour travailler sans réseau, utilise l'application
            sur ton téléphone — tout s'enverra au retour de la connexion.
          </div>
        ) : null}
        <Outlet />
      </div>
    </div>
  );
}
