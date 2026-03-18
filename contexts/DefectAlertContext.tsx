'use client';

import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { dashboardApiUrl, authHeader } from '@/lib/api-client';

export type DefectAlertItem = {
  id: string;
  type: 'defect';
  lot_id: string;
  timestamp: string;
};

type DefectAlertContextType = {
  defectAlerts: DefectAlertItem[];
  isEnabled: boolean;
  setIsEnabled: (enabled: boolean) => void;
};

const DefectAlertContext = createContext<DefectAlertContextType>({
  defectAlerts: [],
  isEnabled: true,
  setIsEnabled: () => {},
});

export function DefectAlertProvider({ children }: { children: React.ReactNode }) {
  const [defectAlerts, setDefectAlerts] = useState<DefectAlertItem[]>([]);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchDefectAlerts = useCallback(async () => {
    try {
      const response = await fetch(
        dashboardApiUrl('/api/dashboard/defect-alerts?limit=50'),
        {
          headers: { ...authHeader(), 'Content-Type': 'application/json' },
          cache: 'no-store',
        }
      );
      if (!response.ok) return;
      const data = await response.json();
      if (!data.success || !Array.isArray(data.alerts)) return;

      const list = data.alerts as DefectAlertItem[];
      setDefectAlerts(list);

      // 새로 추가된 알림만 팝업 (설비 알림 팝업이 켜져 있을 때와 동일 설정은 DefectAlert은 항상 팝업할지 여부 - 여기서는 항상 새 것만 팝업)
      const seen = seenIdsRef.current;
      list.forEach((alert) => {
        if (seen.has(alert.id)) return;
        seen.add(alert.id);
        if ('Notification' in window && Notification.permission === 'granted') {
          const timeStr = alert.timestamp.replace('T', ' ').slice(0, 19);
          const notification = new Notification('🚨 불량 발생 알림 🚨', {
            body: `LOT ID: ${alert.lot_id}\n발생 시각: ${timeStr}`,
            icon: '/favicon.ico',
            tag: alert.id,
            requireInteraction: false,
          });
          notification.onclick = () => {
            window.focus();
            notification.close();
          };
        }
      });
    } catch (error) {
      console.error('[DefectAlert] fetch error:', error);
    }
  }, []);

  useEffect(() => {
    fetchDefectAlerts();
    intervalRef.current = setInterval(fetchDefectAlerts, 30000); // 30초마다
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchDefectAlerts]);

  return (
    <DefectAlertContext.Provider
      value={{
        defectAlerts,
        isEnabled: true,
        setIsEnabled: () => {},
      }}
    >
      {children}
    </DefectAlertContext.Provider>
  );
}

export function useDefectAlerts() {
  return useContext(DefectAlertContext);
}
