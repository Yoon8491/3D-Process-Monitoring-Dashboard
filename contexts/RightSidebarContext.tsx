'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

const STORAGE_KEY_OPEN = 'rightSidebarOpen';
const STORAGE_KEY_WIDTH = 'rightSidebarWidth';

export const RIGHT_SIDEBAR_WIDTH_MIN = 240;
export const RIGHT_SIDEBAR_WIDTH_MAX = 560;
export const RIGHT_SIDEBAR_WIDTH_DEFAULT = 320;

type RightSidebarContextType = {
  rightSidebarOpen: boolean;
  rightSidebarWidth: number;
  alertsPanelOpen: boolean;
  alertsSidebarWidth: number;
  setRightSidebarOpen: (open: boolean) => void;
  setRightSidebarWidth: (width: number) => void;
  setAlertsSidebarWidth: (width: number) => void;
  toggleRightSidebar: () => void;
  setAlertsPanelOpen: (open: boolean) => void;
};

const RightSidebarContext = createContext<RightSidebarContextType | null>(null);

function clampWidth(w: number): number {
  return Math.max(RIGHT_SIDEBAR_WIDTH_MIN, Math.min(RIGHT_SIDEBAR_WIDTH_MAX, w));
}

export function RightSidebarProvider({ children }: { children: ReactNode }) {
  const [rightSidebarOpen, setRightSidebarOpenState] = useState(true);
  const [rightSidebarWidth, setRightSidebarWidthState] = useState(RIGHT_SIDEBAR_WIDTH_DEFAULT);
  const [alertsPanelOpen, setAlertsPanelOpenState] = useState(false);
  const [alertsSidebarWidth, setAlertsSidebarWidthState] = useState(RIGHT_SIDEBAR_WIDTH_DEFAULT);

  // 마운트 후 localStorage에서 저장된 열림 상태·너비 복원
  useEffect(() => {
    try {
      const savedOpen = localStorage.getItem(STORAGE_KEY_OPEN);
      if (savedOpen !== null) setRightSidebarOpenState(savedOpen === 'true');
      const savedWidth = localStorage.getItem(STORAGE_KEY_WIDTH);
      if (savedWidth !== null) {
        const w = parseInt(savedWidth, 10);
        if (!Number.isNaN(w)) setRightSidebarWidthState(clampWidth(w));
      }
    } catch {
      // ignore
    }
  }, []);

  const setRightSidebarOpen = useCallback((open: boolean) => {
    setRightSidebarOpenState(open);
    try {
      localStorage.setItem(STORAGE_KEY_OPEN, String(open));
    } catch {
      // ignore
    }
  }, []);

  const setRightSidebarWidth = useCallback((width: number) => {
    const w = clampWidth(width);
    setRightSidebarWidthState(w);
    try {
      localStorage.setItem(STORAGE_KEY_WIDTH, String(w));
    } catch {
      // ignore
    }
  }, []);

  const toggleRightSidebar = useCallback(() => {
    setRightSidebarOpenState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY_OPEN, String(next));
      } catch {
        // ignore
      }
      return next;
    });
    // 기존 사이드바 토글 시 알람 패널은 유지 (닫지 않음)
  }, []);

  const setAlertsPanelOpen = useCallback((open: boolean) => {
    setAlertsPanelOpenState(open);
    // 알람 패널 열 때 기존 사이드바는 유지 (닫지 않음)
    // 알람 패널 열 때 초기 너비를 기존 사이드바 너비로 설정
    if (open) {
      setAlertsSidebarWidthState(rightSidebarWidth);
    }
  }, [rightSidebarWidth]);

  const setAlertsSidebarWidth = useCallback((width: number) => {
    const w = clampWidth(width);
    setAlertsSidebarWidthState(w);
  }, []);

  return (
    <RightSidebarContext.Provider
      value={{
        rightSidebarOpen,
        rightSidebarWidth,
        alertsPanelOpen,
        alertsSidebarWidth,
        setRightSidebarOpen,
        setRightSidebarWidth,
        setAlertsSidebarWidth,
        toggleRightSidebar,
        setAlertsPanelOpen,
      }}
    >
      {children}
    </RightSidebarContext.Provider>
  );
}

export function useRightSidebar() {
  const ctx = useContext(RightSidebarContext);
  if (!ctx) {
    return {
      rightSidebarOpen: true,
      rightSidebarWidth: RIGHT_SIDEBAR_WIDTH_DEFAULT,
      alertsPanelOpen: false,
      alertsSidebarWidth: RIGHT_SIDEBAR_WIDTH_DEFAULT,
      setRightSidebarOpen: () => {},
      setRightSidebarWidth: () => {},
      setAlertsSidebarWidth: () => {},
      toggleRightSidebar: () => {},
      setAlertsPanelOpen: () => {},
    };
  }
  return ctx;
}
