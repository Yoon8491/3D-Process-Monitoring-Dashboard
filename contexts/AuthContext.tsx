'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { authApiUrl, TOKEN_STORAGE_KEY } from '@/lib/api-client';

interface User {
  employeeNumber: string;
  name: string;
  role: 'admin' | 'user';
}

interface AuthContextType {
  user: User | null;
  login: (employeeNumber: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateUser: (userData: User) => void;
  isAdmin: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // 페이지 로드 시 세션 확인 (타임아웃으로 오래 걸리지 않게 함)
  const SESSION_CHECK_TIMEOUT_MS = 3000;

  useEffect(() => {
    // 최대 로딩 시간 안전장치 (무한 로딩 방지)
    const maxLoadingId = setTimeout(() => {
      setIsLoading(false);
    }, 8000);

    const checkSession = async () => {
      const token =
        typeof window !== 'undefined' ? window.localStorage.getItem(TOKEN_STORAGE_KEY) : null;
      if (!token) {
        setUser(null);
        setIsLoading(false);
        return;
      }
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), SESSION_CHECK_TIMEOUT_MS);
      try {
        const response = await fetch(authApiUrl('/api/auth/session'), {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        let data: { user?: unknown } = {};
        try {
          data = await response.json();
        } catch {
          data = {};
        }
        if (response.ok && data.user) {
          setUser(data.user as User);
        } else {
          setUser(null);
          if (typeof window !== 'undefined') {
            window.localStorage.removeItem(TOKEN_STORAGE_KEY);
          }
        }
      } catch (error) {
        clearTimeout(timeoutId);
        if ((error as Error)?.name === 'AbortError') {
          console.warn('Session check timed out');
        } else {
          console.error('Session check error:', error);
        }
        setUser(null);
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(TOKEN_STORAGE_KEY);
        }
      } finally {
        setIsLoading(false);
      }
    };
    checkSession();
    return () => clearTimeout(maxLoadingId);
  }, []);


  const login = async (employeeNumber: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(authApiUrl('/api/auth/login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ employeeNumber, password }),
      });

      let data: { success?: boolean; user?: unknown; token?: string; error?: string };
      try {
        data = await response.json();
      } catch {
        return {
          success: false,
          error: response.status === 502 || response.status === 503
            ? '서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.'
            : '서버 응답 오류가 발생했습니다.',
        };
      }

      if (response.ok && data.success) {
        setUser(data.user as any);
        if (data.token && typeof window !== 'undefined') {
          window.localStorage.setItem(TOKEN_STORAGE_KEY, String(data.token));
        }
        router.push('/factory');
        return { success: true };
      }
      return { success: false, error: data.error || '로그인에 실패했습니다.' };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: '네트워크 오류가 발생했습니다. 연결을 확인한 뒤 다시 시도해 주세요.',
      };
    }
  };

  const logout = async () => {
    try {
      const token =
        typeof window !== 'undefined' ? window.localStorage.getItem(TOKEN_STORAGE_KEY) : null;
      await fetch(authApiUrl('/api/auth/logout'), {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
      router.replace('/login');
    }
  };

  const updateUser = (userData: User) => {
    setUser(userData);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, isAdmin: user?.role === 'admin', isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
