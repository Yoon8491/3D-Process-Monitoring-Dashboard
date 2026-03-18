'use client';

import { createContext, useCallback, useContext, useState } from 'react';

type ToastType = 'error' | 'success' | 'info';

interface ToastState {
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (type: ToastType, message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_DURATION_MS = 4000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((type: ToastType, message: string) => {
    setToast({ message, type });
    const t = setTimeout(() => {
      setToast(null);
    }, TOAST_DURATION_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div
          role="alert"
          className="fixed bottom-6 right-6 z-[9999] max-w-sm rounded-lg px-4 py-3 shadow-lg border"
          style={{
            backgroundColor:
              toast.type === 'error'
                ? '#fef2f2'
                : toast.type === 'success'
                  ? '#f0fdf4'
                  : '#f8fafc',
            borderColor:
              toast.type === 'error'
                ? '#fecaca'
                : toast.type === 'success'
                  ? '#bbf7d0'
                  : '#e2e8f0',
            color:
              toast.type === 'error'
                ? '#b91c1c'
                : toast.type === 'success'
                  ? '#15803d'
                  : '#334155',
          }}
        >
          {toast.message}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      showToast: (_type: ToastType, message: string) => {
        if (typeof window !== 'undefined') console.error('Toast:', message);
      },
    };
  }
  return ctx;
}
