'use client';

import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { grafanaApiUrl, authHeader } from '@/lib/api-client';

type GrafanaAlert = {
  id: string;
  status: 'firing' | 'resolved';
  alertname: string;
  grafana_folder?: string;
  host?: string;
  title: string;
  description?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  values?: Record<string, any>;
  timestamp: string;
  received_at: string;
};

type GrafanaAlertContextType = {
  alerts: GrafanaAlert[];
  latestTimestamp: string | null;
  isEnabled: boolean;
  setIsEnabled: (enabled: boolean) => void;
};

const GRAFANA_ALERT_ENABLED_KEY = 'grafana_alert_popup_enabled';

function getInitialEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const stored = localStorage.getItem(GRAFANA_ALERT_ENABLED_KEY);
    if (stored !== null) return stored === 'true';
  } catch {}
  return true; // 새로고침 시 기본값: 항상 켜짐
}

const GrafanaAlertContext = createContext<GrafanaAlertContextType>({
  alerts: [],
  latestTimestamp: null,
  isEnabled: true,
  setIsEnabled: () => {},
});

export function GrafanaAlertProvider({ children }: { children: React.ReactNode }) {
  const [alerts, setAlerts] = useState<GrafanaAlert[]>([]);
  const [latestTimestamp, setLatestTimestamp] = useState<string | null>(null);
  const [isEnabled, setIsEnabledState] = useState(getInitialEnabled);

  const setIsEnabled = useCallback((enabled: boolean) => {
    setIsEnabledState(enabled);
    try {
      localStorage.setItem(GRAFANA_ALERT_ENABLED_KEY, String(enabled));
    } catch {}
  }, []);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastTimestampRef = useRef<string | null>(null);

  const checkForNewAlerts = useCallback(async () => {
    if (!isEnabled) return;

    try {
      const since = lastTimestampRef.current;
      const url = grafanaApiUrl(`/api/grafana/alerts${since ? '/latest' : ''}`);
      const params = new URLSearchParams();
      if (since) {
        params.set('since', since);
      } else {
        params.set('limit', '20');
      }

      const response = await fetch(`${url}?${params.toString()}`, {
        headers: {
          ...authHeader(),
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        console.error('[GrafanaAlert] Failed to fetch alerts:', response.status, response.statusText, url);
        return;
      }

      const data = await response.json();
      if (data.success && Array.isArray(data.alerts)) {
        const newAlerts = data.alerts as GrafanaAlert[];
        
        // 새로운 firing 알림만 필터링 (이미 표시한 알림 제외)
        const existingIds = new Set(alerts.map(a => a.id));
        const trulyNewAlerts = newAlerts.filter(
          a => a.status === 'firing' && !existingIds.has(a.id)
        );

        if (trulyNewAlerts.length > 0) {
          // 브라우저 알림 표시
          if ('Notification' in window && Notification.permission === 'granted') {
            trulyNewAlerts.forEach(alert => {
              const notification = new Notification(alert.title || alert.alertname, {
                body: alert.description || `${alert.alertname} - ${alert.host || ''}`,
                icon: '/favicon.ico',
                tag: alert.id, // 같은 알림은 중복 표시 방지
                requireInteraction: false,
                silent: false,
              });

              // 알림 클릭 시 포커스
              notification.onclick = () => {
                window.focus();
                notification.close();
              };
            });
          }

          // 알림 목록 업데이트
          setAlerts(prev => {
            const updated = [...prev, ...trulyNewAlerts];
            // 최근 50개만 유지
            return updated.slice(-50);
          });
        }

        // 타임스탬프 업데이트
        if (data.latest_timestamp) {
          setLatestTimestamp(data.latest_timestamp);
          lastTimestampRef.current = data.latest_timestamp;
        } else if (newAlerts.length > 0) {
          const latest = newAlerts[0].timestamp;
          setLatestTimestamp(latest);
          lastTimestampRef.current = latest;
        }
      }
    } catch (error) {
      console.error('[GrafanaAlert] Error checking alerts:', error);
    }
  }, [isEnabled, alerts]);

  useEffect(() => {
    if (!isEnabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // 권한 요청은 별도로, 폴링은 항상 수행 (알람 내역 사이드바에 표시되도록)
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(() => {});
    }

    // 마운트 시 즉시 1회 + 5초마다 알림 조회
    checkForNewAlerts();
    intervalRef.current = setInterval(() => {
      checkForNewAlerts();
    }, 5000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isEnabled, checkForNewAlerts]);

  return (
    <GrafanaAlertContext.Provider
      value={{
        alerts,
        latestTimestamp,
        isEnabled,
        setIsEnabled,
      }}
    >
      {children}
    </GrafanaAlertContext.Provider>
  );
}

export function useGrafanaAlerts() {
  return useContext(GrafanaAlertContext);
}
