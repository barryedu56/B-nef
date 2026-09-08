import { NavLink, Outlet } from 'react-router-dom';

import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/context/AuthContext';

const NAV_ITEMS = [
  { to: '/', label: 'Tableau de bord', end: true },
  { to: '/activities', label: 'Activités' },
  { to: '/transactions', label: 'Transactions' },
  { to: '/inventory', label: 'Inventaire' },
  { to: '/parties', label: 'Tiers & dettes' },
  { to: '/reports', label: 'Rapports' },
  { to: '/settings', label: 'Paramètres' },
];

export function AppLayout() {
  const { user } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">Bénef</div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => ['sidebar-link', isActive ? 'active' : ''].filter(Boolean).join(' ')}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <Avatar url={user?.avatar} name={user?.username} size={28} />
          <span className="sidebar-user">{user?.username}</span>
        </div>
      </aside>
      <div className="main">
        <Outlet />
      </div>
    </div>
  );
}
