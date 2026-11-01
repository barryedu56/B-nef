import { ArrowLeft, BookText, Gauge, HeartPulse, Receipt, Repeat2, Users, type LucideIcon } from 'lucide-react';
import { Navigate, NavLink, Outlet } from 'react-router-dom';

import { useAuth } from '@/context/AuthContext';

const NAV_ITEMS: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: '/console', label: 'En direct', icon: Gauge, end: true },
  { to: '/console/users', label: 'Utilisateurs', icon: Users },
  { to: '/console/operations', label: 'Opérations', icon: Receipt },
  { to: '/console/rates', label: 'Taux de change', icon: Repeat2 },
  { to: '/console/health', label: 'Santé du serveur', icon: HeartPulse },
  { to: '/console/journal', label: 'Journal admin', icon: BookText },
];

/** Console d'administration : séparée de l'app, visible des seuls administrateurs. */
export function ConsoleLayout() {
  const { user } = useAuth();
  if (!user?.is_staff) return <Navigate to="/" replace />;

  return (
    <div className="app-shell console-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src="/logo.png" alt="" />
          Bénef <span className="badge accent">Admin</span>
        </div>
        <nav className="sidebar-nav" aria-label="Navigation de la console">
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
          <NavLink to="/" className="sidebar-link">
            <ArrowLeft size={18} />
            Retour à l'app
          </NavLink>
        </div>
      </aside>
      <div className="main">
        <Outlet />
      </div>
    </div>
  );
}
