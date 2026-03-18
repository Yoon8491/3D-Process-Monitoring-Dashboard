'use client';

import { createContext, useContext, useState, useRef, useCallback, ReactNode } from 'react';

type DashboardRefreshContextType = {
  lastUpdate: Date;
  setLastUpdate: (d: Date) => void;
  autoRefresh: boolean;
  setAutoRefresh: (v: boolean) => void;
  notificationEnabled: boolean;
  setNotificationEnabled: (v: boolean) => void;
  registerRefresh: (fn: (() => void) | null) => void;
  triggerRefresh: () => void;
};

const DashboardRefreshContext = createContext<DashboardRefreshContextType | null>(null);

export function DashboardRefreshProvider({ children }: { children: ReactNode }) {
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const refreshFnRef = useRef<(() => void) | null>(null);

  const registerRefresh = useCallback((fn: (() => void) | null) => {
    refreshFnRef.current = fn;
  }, []);

  const triggerRefresh = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }, []);

  return (
    <DashboardRefreshContext.Provider
      value={{
        lastUpdate,
        setLastUpdate,
        autoRefresh,
        setAutoRefresh,
        notificationEnabled,
        setNotificationEnabled,
        registerRefresh,
        triggerRefresh,
      }}
    >
      {children}
    </DashboardRefreshContext.Provider>
  );
}

export function useDashboardRefresh() {
  const ctx = useContext(DashboardRefreshContext);
  if (!ctx) {
    return {
      lastUpdate: new Date(),
      setLastUpdate: () => {},
      autoRefresh: false,
      setAutoRefresh: () => {},
      notificationEnabled: false,
      setNotificationEnabled: () => {},
      registerRefresh: () => {},
      triggerRefresh: () => {},
    };
  }
  return ctx;
}
