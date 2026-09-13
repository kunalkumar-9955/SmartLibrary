import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { authService } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: { email: string; password: string }) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isAdmin: boolean;
  isStudent: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('smart_library_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem('smart_library_token')
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const initAuth = async () => {
      const savedToken = localStorage.getItem('smart_library_token');
      if (savedToken) {
        try {
          const res = await authService.getMe();
          if (res.data?.success) {
            const userData = res.data.data.user || res.data.data;
            setUser(userData);
            localStorage.setItem('smart_library_user', JSON.stringify(userData));
          }
        } catch (error: any) {
          // Only clear session if token is truly rejected by the backend (401 Unauthorized / 403 Forbidden)
          if (error?.response && (error.response.status === 401 || error.response.status === 403)) {
            console.warn('[AuthContext] Session expired or invalid on backend');
            await logout();
          } else {
            console.warn('[AuthContext] Backend unreachable during init, keeping existing offline session');
          }
        }
      }
      setIsLoading(false);
    };
    initAuth();
  }, []);

  const login = async (credentials: { email: string; password: string }): Promise<User> => {
    setIsLoading(true);
    try {
      const res = await authService.login(credentials);
      const { token: receivedToken, user: receivedUser } = res.data.data;

      setToken(receivedToken);
      setUser(receivedUser);

      localStorage.setItem('smart_library_token', receivedToken);
      localStorage.setItem('smart_library_user', JSON.stringify(receivedUser));

      return receivedUser;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      if (token) {
        await authService.logout().catch(() => {});
      }
    } finally {
      setUser(null);
      setToken(null);
      localStorage.removeItem('smart_library_token');
      localStorage.removeItem('smart_library_user');
    }
  };

  const refreshUser = async () => {
    if (!token) return;
    try {
      const res = await authService.getMe();
      if (res.data.success) {
        const userData = res.data.data.user || res.data.data;
        setUser(userData);
        localStorage.setItem('smart_library_user', JSON.stringify(userData));
      }
    } catch (err) {
      console.error('Failed to refresh user', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        logout,
        refreshUser,
        isAdmin: user?.role === 'ADMIN',
        isStudent: user?.role === 'STUDENT',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
