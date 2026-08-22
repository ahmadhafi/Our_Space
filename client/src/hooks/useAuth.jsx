import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiPost, apiGet } from './useApi';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check auth status on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const data = await apiGet('/api/auth/me');
      setUser(data.user);
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = useCallback(async (username, password) => {
    const data = await apiPost('/api/auth/login', { username, password });
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiPost('/api/auth/logout', {});
    } catch (err) {
      // Continue with logout even if request fails
    }
    setUser(null);
  }, []);

  const updateUser = useCallback((updates) => {
    setUser(prev => prev ? { ...prev, ...updates } : null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
