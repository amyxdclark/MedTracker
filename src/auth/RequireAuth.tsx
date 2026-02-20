import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';

export function RequireAuth() {
  const { currentUser, currentService } = useAuth();
  if (!currentUser) return <Navigate to="/login" replace />;
  if (!currentService) return <Navigate to="/select-service" replace />;
  return <Outlet />;
}
