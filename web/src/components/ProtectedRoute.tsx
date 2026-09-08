import { Navigate, Outlet } from 'react-router-dom';

import { useAuth } from '@/context/AuthContext';
import { LoadingBlock } from './ui/QueryState';

export function ProtectedRoute() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingBlock />
      </div>
    );
  }
  if (status === 'signedOut') return <Navigate to="/login" replace />;

  return <Outlet />;
}
