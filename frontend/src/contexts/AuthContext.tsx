/**
 * AuthContext — Atlased
 *
 * Manages authentication state: user object, login/signup/logout,
 * loading/error states. Loads user on mount via GET /api/auth/me.
 *
 * Usage:
 *   const { user, loading, login } = useAuth();
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { User, AuthContextType, ApiError } from '../types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within <AuthProvider>');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const parseJsonSafe = async <T,>(res: Response): Promise<T | null> => {
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return null;
    }

    try {
      return (await res.json()) as T;
    } catch {
      return null;
    }
  };

  // Load user on mount (check if already authenticated)
  useEffect(() => {
    const loadUser = async () => {
      try {
        // Add a 5-second timeout to prevent hanging if backend is not running
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const res = await fetch('/api/auth/me', {
          credentials: 'include', // Include httpOnly cookies
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await parseJsonSafe<{ user: User }>(res);
          setUser(data?.user ?? null);
        } else if (res.status === 401) {
          // Not authenticated — normal state
          setUser(null);
        } else {
          // Unexpected error
          console.error('Failed to load user:', res.status);
          setUser(null);
        }
      } catch (err) {
        console.error('Error loading user:', err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await parseJsonSafe<ApiError>(res);
        throw new Error(data?.error || `Login failed (${res.status})`);
      }

      const data = await parseJsonSafe<{ user: User }>(res);
      if (!data?.user) {
        throw new Error('Login failed: invalid server response');
      }

      setUser(data.user);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      throw err;
    }
  };

  const signup = async (email: string, password: string): Promise<void> => {
    setError(null);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await parseJsonSafe<ApiError>(res);
        throw new Error(data?.error || `Signup failed (${res.status})`);
      }

      const data = await parseJsonSafe<{ user: User }>(res);
      if (!data?.user) {
        throw new Error('Signup failed: invalid server response');
      }

      setUser(data.user);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Signup failed';
      setError(message);
      throw err;
    }
  };

  const logout = async (): Promise<void> => {
    setError(null);
    try {
      const res = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        console.warn('Logout failed with status:', res.status);
      }

      // Clear local state regardless of response
      setUser(null);
    } catch (err) {
      console.error('Logout error:', err);
      setUser(null);
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    error,
    login,
    signup,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
