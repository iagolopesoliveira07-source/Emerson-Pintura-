import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import AuthLoading from '../AuthLoading/AuthLoading';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const app = useApp();
  const location = useLocation();

  if (loading) {
    return <AuthLoading message="A verificar sessão..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (app.loading) {
    return <AuthLoading message="A carregar dados..." />;
  }

  if (app.loadError) {
    return <AuthLoading message={app.loadError} />;
  }

  return children;
}
