import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AuthLoading from '../AuthLoading/AuthLoading';

export default function GuestRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <AuthLoading />;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
}
