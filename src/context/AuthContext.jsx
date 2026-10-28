import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import {
  isPasswordConfigured,
  isSessionActive,
  setupPassword as setupPasswordService,
  loginWithPassword,
  clearSession,
  changePassword as changePasswordService,
} from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    setIsConfigured(isPasswordConfigured());
    setIsAuthenticated(isSessionActive());
    setLoading(false);
  }, []);

  const setupPassword = useCallback(async (password, confirmPassword) => {
    if (password.length < 4) {
      return { error: 'A senha deve ter pelo menos 4 caracteres.' };
    }

    if (password !== confirmPassword) {
      return { error: 'As senhas não coincidem.' };
    }

    try {
      await setupPasswordService(password);
      setIsConfigured(true);
      setIsAuthenticated(true);
      return { error: null };
    } catch (error) {
      console.error('[Auth] Erro ao definir senha:', error);
      return { error: 'Não foi possível definir a senha.' };
    }
  }, []);

  const login = useCallback(async (password) => {
    try {
      const { error } = await loginWithPassword(password);

      if (error) {
        return { error };
      }

      setIsAuthenticated(true);
      return { error: null };
    } catch (error) {
      console.error('[Auth] Erro no login:', error);
      return { error: 'Não foi possível iniciar sessão.' };
    }
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setIsAuthenticated(false);
    return { error: null };
  }, []);

  const changePassword = useCallback(async (currentPassword, newPassword, confirmPassword) => {
    if (newPassword.length < 4) {
      return { error: 'A nova senha deve ter pelo menos 4 caracteres.' };
    }

    if (newPassword !== confirmPassword) {
      return { error: 'As novas senhas não coincidem.' };
    }

    try {
      const { error } = await changePasswordService(currentPassword, newPassword);

      if (error) {
        return { error };
      }

      return { error: null };
    } catch (error) {
      console.error('[Auth] Erro ao alterar senha:', error);
      return { error: 'Não foi possível alterar a senha.' };
    }
  }, []);

  const value = useMemo(
    () => ({
      loading,
      isConfigured,
      isAuthenticated,
      setupPassword,
      login,
      logout,
      changePassword,
    }),
    [loading, isConfigured, isAuthenticated, setupPassword, login, logout, changePassword]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return context;
}
