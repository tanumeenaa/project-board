import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import api from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = async () => {
    const token = localStorage.getItem('project-board-token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const response = await api.get('/auth/me');
      setUser(response.data.user);
    } catch (error) {
      localStorage.removeItem('project-board-token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  const signup = async (payload) => {
    const response = await api.post('/auth/signup', payload);
    localStorage.setItem('project-board-token', response.data.token);
    setUser(response.data.user);
    return response.data;
  };

  const login = async (payload) => {
    const response = await api.post('/auth/login', payload);
    localStorage.setItem('project-board-token', response.data.token);
    setUser(response.data.user);
    return response.data;
  };

  const logout = () => {
    localStorage.removeItem('project-board-token');
    setUser(null);
  };

  const value = useMemo(
    () => ({ user, loading, signup, login, logout, loadUser }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('Auth context is missing');
  }

  return context;
}
