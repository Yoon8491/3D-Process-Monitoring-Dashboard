'use client';

import { useEffect, useState, useRef } from 'react';
import { Bell, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRightSidebar, RIGHT_SIDEBAR_WIDTH_MIN, RIGHT_SIDEBAR_WIDTH_MAX } from '@/contexts/RightSidebarContext';
import { useDefectAlerts } from '@/contexts/DefectAlertContext';
import { useAuth } from '@/contexts/AuthContext';
import { grafanaApiUrl, authHeader } from '@/lib/api-client';
import ScrollbarOnScrollArea from './ScrollbarOnScrollArea';

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

/** Grafana API (/api/alerts) 응답 형식 - firing만 */
type GrafanaApiAlert = {
  id: string;
  title: string;
  timestamp: string;
  labels: Record<string, string>;
  annotations?: Record<string, string>;
  host?: string;
  grafana_folder?: string;
};

/** Webhook → Pusher로 전달되는 new-alert 페이로드 */
type WebhookAlertPayload = {
  id: string;
  alertname: string;
  message: string;
  state: string;
  timestamp: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  host?: string;
  grafana_folder?: string;
};

const CONFIRMED_BY_KEY = 'alerts-sidebar-confirmed-by';

export default function AlertsSidebar() {
  const { language } = useLanguage();
  const { alertsPanelOpen, setAlertsPanelOpen, alertsSidebarWidth, setAlertsSidebarWidth } = useRightSidebar();
  const { defectAlerts } = useDefectAlerts();
  const { user } = useAuth();
  const STORAGE_KEY = 'alerts-sidebar-confirmed';
  const loadConfirmedIds = (): Set<string> => {
    if (typeof window === 'undefined') return new Set();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return new Set();
      const arr = JSON.parse(raw) as string[];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set();
    }
  };
  const loadConfirmedBy = (): Record<string, string> => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem(CONFIRMED_BY_KEY);
      if (!raw) return {};
      const obj = JSON.parse(raw) as Record<string, string>;
      return obj && typeof obj === 'object' ? obj : {};
    } catch {
      return {};
    }
  };
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(loadConfirmedIds);
  const [confirmedBy, setConfirmedBy] = useState<Record<string, string>>(loadConfirmedBy);
  const persistConfirmed = (nextIds: Set<string>, nextBy: Record<string, string>) => {
    setConfirmedIds(nextIds);
    setConfirmedBy(nextBy);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...nextIds]));
      localStorage.setItem(CONFIRMED_BY_KEY, JSON.stringify(nextBy));
    } catch {}
  };
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const currentUserName = user?.name || user?.employeeNumber || (language === 'ko' ? '알 수 없음' : 'Unknown');

  const [alertView, setAlertView] = useState<'defect' | 'grafana'>('grafana');
  const [alerts, setAlerts] = useState<GrafanaAlert[]>([]);
  const [grafanaApiAlerts, setGrafanaApiAlerts] = useState<GrafanaApiAlert[]>([]);
  const [realtimeAlerts, setRealtimeAlerts] = useState<GrafanaAlert[]>([]);
  const [flashingIds, setFlashingIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);
  const switchTouchStartX = useRef(0);
  const pusherRef = useRef<any>(null);

  /** 알람음 재생 (비상 알람) */
  const playAlertSound = useRef(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } catch {}
  });

  // 초기 로드 (알람 패널 열릴 때 1회)
  useEffect(() => {
    if (!alertsPanelOpen) return;

    const loadAlerts = async () => {
      setLoading(true);
      try {
        const [dbRes, grafanaApiRes] = await Promise.all([
          fetch(grafanaApiUrl('/api/grafana/alerts?limit=100'), {
            headers: { ...authHeader(), 'Content-Type': 'application/json' },
            cache: 'no-store',
          }),
          fetch(grafanaApiUrl('/api/alerts'), {
            headers: { ...authHeader(), 'Content-Type': 'application/json' },
            cache: 'no-store',
          }),
        ]);

        if (dbRes.ok) {
          const data = await dbRes.json();
          if (data.success && Array.isArray(data.alerts)) {
            setAlerts(data.alerts);
          }
        }

        if (grafanaApiRes.ok) {
          const data = await grafanaApiRes.json();
          if (data.success && Array.isArray(data.alerts)) {
            setGrafanaApiAlerts(data.alerts);
          }
        }
      } catch (error) {
        console.error('알람 로드 오류:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAlerts();
  }, [alertsPanelOpen]);

  // Pusher 실시간 구독 (alerts-channel, new-alert)
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? 'ap3';
    if (!key) return;

    let cancelled = false;
    void import('pusher-js').then(({ default: Pusher }) => {
      if (cancelled) return;
      const pusherClient = new Pusher(key, { cluster });
      pusherRef.current = pusherClient;
      const channel = pusherClient.subscribe('alerts-channel');

      channel.bind('new-alert', (payload: { data: WebhookAlertPayload }) => {
        const d = payload?.data;
        if (!d?.id) return;

        // 공정 불량 알림은 설비 탭에 쌓이지 않도록 realtimeAlerts에 넣지 않음 (공정 탭은 DefectAlertContext 사용)
        const name = (d.alertname ?? '').toLowerCase();
        if (
          name.includes('공정 불량') ||
          name.includes('process defect') ||
          name.includes('process failure') ||
          (d.labels && (d.labels['alert_type'] === 'defect' || d.labels['source'] === 'lot_defect'))
        )
          return;

        const mapped: GrafanaAlert = {
          id: d.id,
          status: 'firing',
          alertname: d.alertname ?? '알람',
          title: d.alertname ?? '알람',
          description: d.message,
          timestamp: d.timestamp,
          received_at: d.timestamp,
          host: d.host,
          grafana_folder: d.grafana_folder,
          labels: d.labels ?? {},
          annotations: d.annotations,
        };

        setRealtimeAlerts((prev) => [mapped, ...prev].slice(0, 100));
        setFlashingIds((s) => new Set([...s, d.id]));
        playAlertSound.current();

        setTimeout(() => {
          setFlashingIds((s) => {
            const next = new Set(s);
            next.delete(d.id);
            return next;
          });
        }, 3000);
      });
    });

    return () => {
      cancelled = true;
      const client = pusherRef.current;
      if (client) {
        try {
          client.unsubscribe('alerts-channel');
        } catch {}
        pusherRef.current = null;
      }
    };
  }, []);


  // 리사이즈 핸들러 (알람 사이드바 전용 너비 사용)
  useEffect(() => {
    if (!isResizing) return;
    const clamp = (w: number) => Math.max(RIGHT_SIDEBAR_WIDTH_MIN, Math.min(RIGHT_SIDEBAR_WIDTH_MAX, w));
    const onMove = (e: MouseEvent) => {
      const deltaX = resizeStartX.current - e.clientX;
      const next = clamp(resizeStartWidth.current + deltaX);
      setAlertsSidebarWidth(next);
    };
    const onUp = () => setIsResizing(false);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return language === 'ko' ? '방금 전' : 'Just now';
      if (diffMins < 60) return `${diffMins}${language === 'ko' ? '분 전' : 'm ago'}`;
      if (diffHours < 24) return `${diffHours}${language === 'ko' ? '시간 전' : 'h ago'}`;
      if (diffDays < 7) return `${diffDays}${language === 'ko' ? '일 전' : 'd ago'}`;
      
      return date.toLocaleString(language === 'ko' ? 'ko-KR' : 'en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return timestamp;
    }
  };

  /** 공정 불량(process defect) 알림 여부 - 설비 불량 탭 활성 시 공정 불량 알림이 절대 노출되지 않도록 구분 */
  const isProcessDefectAlert = (a: {
    title?: string;
    alertname?: string;
    description?: string;
    labels?: Record<string, string>;
  }) => {
    const title = (a.title ?? '').toLowerCase();
    const name = (a.alertname ?? '').toLowerCase();
    const desc = (a.description ?? '').toLowerCase();
    const text = `${title} ${name} ${desc}`;
    return (
      text.includes('공정 불량') ||
      text.includes('공정불량') ||
      text.includes('불량 발생 알림') ||
      text.includes('process defect') ||
      text.includes('process failure') ||
      (a.labels && (a.labels['alert_type'] === 'defect' || a.labels['source'] === 'lot_defect'))
    );
  };

  const dbFiring = alerts.filter((a) => a.status === 'firing');
  const allResolvedAlerts = alerts.filter((a) => a.status === 'resolved');
  const resolvedAlerts = allResolvedAlerts.filter((a) => !isProcessDefectAlert(a));

  const grafanaApiAsAlerts: GrafanaAlert[] = grafanaApiAlerts.map((a) => ({
    id: `grafana-${a.id}`,
    status: 'firing' as const,
    alertname: a.title,
    title: a.title,
    timestamp: a.timestamp,
    received_at: a.timestamp,
    host: a.host,
    grafana_folder: a.grafana_folder,
    labels: a.labels ?? {},
    annotations: a.annotations,
    description: a.annotations?.summary ?? a.annotations?.description,
  }));

  // DB + API + Webhook 실시간 알람 합침 (실시간이 맨 앞)
  const allFiringAlerts = [...realtimeAlerts, ...dbFiring, ...grafanaApiAsAlerts];
  // 설비 탭에는 공정 불량 알림이 쌓이지 않도록 설비( Grafana ) 알림만 표시
  const firingAlerts = allFiringAlerts.filter((a) => !isProcessDefectAlert(a));

  /** 확인하지 않은 알람 수 (미확인 = 배경 붉은색) */
  const unconfirmedDefectCount = defectAlerts.filter((a) => !confirmedIds.has(a.id)).length;
  const unconfirmedGrafanaCount = firingAlerts.filter((a) => !confirmedIds.has(a.id)).length;
  const totalUnconfirmedCount = unconfirmedDefectCount + unconfirmedGrafanaCount;

  /** 불량 알람 발생 시각: DB에 저장된 그대로 20XX-XX-XX XX:XX:XX 표시 (타임존 변환 없음) */
  const formatDefectTime = (timestamp: string) => {
    const s = String(timestamp ?? '').trim();
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) return s;
    try {
      const t = s.replace('T', ' ').slice(0, 19);
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(t)) return t;
    } catch {}
    return s || timestamp;
  };

  return (
    <div
      className={`fixed top-16 h-[calc(100vh-4rem)] bg-white border-l border-slate-200 flex flex-col overflow-hidden z-50 will-change-transform transition-all duration-200 ease-out shadow-xl ${
        alertsPanelOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
      style={{ 
        width: alertsPanelOpen ? alertsSidebarWidth : 0,
        right: 0,
      }}
      role="complementary"
      aria-label={language === 'ko' ? '알람 내역' : 'Alert History'}
    >
      {/* 리사이즈 핸들 */}
      {alertsPanelOpen && (
        <div
          role="separator"
          aria-label={language === 'ko' ? '사이드바 너비 조절' : 'Resize sidebar'}
          onMouseDown={(e) => {
            e.preventDefault();
            resizeStartX.current = e.clientX;
            resizeStartWidth.current = alertsSidebarWidth;
            setIsResizing(true);
          }}
          className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-[60] shrink-0"
          title={language === 'ko' ? '경계선을 드래그하여 너비 조절' : 'Drag to resize'}
        />
      )}

      {/* 헤더 */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-red-600" />
          <h2 className="text-lg font-semibold text-slate-900">
            {language === 'ko' ? '알람 내역' : 'Alert History'}
          </h2>
          {totalUnconfirmedCount > 0 && (
            <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">
              {totalUnconfirmedCount}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setAlertsPanelOpen(false)}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
          aria-label={language === 'ko' ? '닫기' : 'Close'}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 공정 불량 발생 / 설비 불량 발생 스위치 - 슬라이딩 + 스와이프 */}
      <div
        className="relative border-b border-slate-200 bg-slate-100 p-1 rounded-none shrink-0 select-none"
        onTouchStart={(e) => {
          switchTouchStartX.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          const endX = e.changedTouches[0].clientX;
          const delta = endX - switchTouchStartX.current;
          const threshold = 40;
          if (delta > threshold) {
            setAlertView('defect');
          } else if (delta < -threshold) {
            setAlertView('grafana');
          }
        }}
      >
        <div
          className="absolute top-1 bottom-1 rounded-lg bg-white shadow-sm border border-slate-200 transition-[transform] duration-200 ease-out pointer-events-none"
          style={{
            width: 'calc(50% - 6px)',
            left: 4,
            transform: alertView === 'grafana' ? 'translateX(calc(100% + 6px))' : 'translateX(0)',
          }}
          aria-hidden
        />
        <div className="relative z-10 grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => setAlertView('defect')}
            className={`w-full min-w-0 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
              alertView === 'defect' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <span className="truncate">{language === 'ko' ? '공정 불량 발생' : 'Process Defect'}</span>
            {unconfirmedDefectCount > 0 && (
              <span className="shrink-0 px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">
                {unconfirmedDefectCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setAlertView('grafana')}
            className={`w-full min-w-0 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
              alertView === 'grafana' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <span className="truncate">{language === 'ko' ? '설비 불량 발생' : 'Equipment Defect'}</span>
            {unconfirmedGrafanaCount > 0 && (
              <span className="shrink-0 px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">
                {unconfirmedGrafanaCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 알람 목록 - 스크롤 가능, 배경 흰색 */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-white relative">
        {loading ? (
          <div className="flex items-center justify-center h-full bg-white">
            <div className="text-slate-500 text-sm">
              {language === 'ko' ? '알람을 불러오는 중...' : 'Loading alerts...'}
            </div>
          </div>
        ) : alertView === 'defect' ? (
          defectAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 bg-white">
              <Bell className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm">
                {language === 'ko' ? '공정 불량 발생 알람이 없습니다.' : 'No process defect alerts.'}
              </p>
            </div>
          ) : (
            <ScrollbarOnScrollArea className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-white">
              <div className="p-4 space-y-3 bg-white">
                {defectAlerts.map((alert) => {
                  const isConfirmed = confirmedIds.has(alert.id);
                  const isSelected = selectedAlertId === alert.id;
                  return (
                    <div
                      key={alert.id}
                      className={`rounded-lg border transition-all overflow-hidden ${
                        isConfirmed
                          ? 'bg-white border-slate-200'
                          : 'bg-red-50 border-red-200'
                      }`}
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedAlertId(isSelected ? null : alert.id)}
                        onKeyDown={(e) => e.key === 'Enter' && setSelectedAlertId(isSelected ? null : alert.id)}
                        className={`p-3 cursor-pointer ${isConfirmed ? 'hover:bg-slate-50' : 'hover:bg-red-100'}`}
                      >
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-slate-900 text-sm mb-1">
                              🚨 {language === 'ko' ? '공정 불량 발생 알림' : 'Process Defect'} 🚨
                            </h3>
                            <p className="text-xs text-slate-700 mb-0.5">
                              ✅ LOT ID: {alert.lot_id}
                            </p>
                            <p className={`text-xs ${isConfirmed ? 'text-slate-600' : 'text-red-700'}`}>
                              ⏰ {language === 'ko' ? '발생 시각' : 'Occurrence time'}: {formatDefectTime(alert.timestamp)}
                            </p>
                          </div>
                          <span className={`text-xs shrink-0 whitespace-nowrap ${isConfirmed ? 'text-slate-500' : 'text-red-600'}`}>
                            {formatTime(alert.timestamp)}
                          </span>
                        </div>
                        {isConfirmed && confirmedBy[alert.id] && (
                          <p className="text-xs text-slate-500 mt-1.5 text-right w-full">
                            {language === 'ko' ? '확인: ' : 'Confirmed by: '}{confirmedBy[alert.id]}
                          </p>
                        )}
                      </div>
                      {isSelected && (
                        <div className={`flex gap-2 p-3 pt-2 border-t ${isConfirmed ? 'border-slate-100 bg-slate-50/50' : 'border-red-100 bg-red-50/80'}`}>
                          <button
                            type="button"
                            onClick={() => {
                              persistConfirmed(
                                new Set([...confirmedIds, alert.id]),
                                { ...confirmedBy, [alert.id]: currentUserName }
                              );
                              setSelectedAlertId(null);
                            }}
                            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
                          >
                            {language === 'ko' ? '확인' : 'Confirm'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const nextBy = { ...confirmedBy };
                              delete nextBy[alert.id];
                              persistConfirmed(
                                new Set([...confirmedIds].filter((id) => id !== alert.id)),
                                nextBy
                              );
                              setSelectedAlertId(null);
                            }}
                            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
                          >
                            {language === 'ko' ? '미확인' : 'Unconfirm'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollbarOnScrollArea>
          )
        ) : firingAlerts.length === 0 && resolvedAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 bg-white">
            <Bell className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm">
              {language === 'ko' ? '설비 불량 발생 알람이 없습니다.' : 'No equipment defect alerts.'}
            </p>
          </div>
        ) : (
          <ScrollbarOnScrollArea className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-white">
            <div className="p-4 space-y-3 bg-white">
              {/* Firing 알람 - 설비 탭에서는 공정 불량 알림은 절대 미표시 */}
              {firingAlerts.length > 0 && (
                <>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    {language === 'ko' ? '활성 알람' : 'Active Alerts'}
                  </div>
                  {firingAlerts.map((alert) => {
                    if (isProcessDefectAlert(alert)) return null;
                    const isConfirmed = confirmedIds.has(alert.id);
                    const isSelected = selectedAlertId === alert.id;
                    return (
                      <div
                        key={alert.id}
                        className={`rounded-lg border transition-all overflow-hidden ${
                          flashingIds.has(alert.id)
                            ? 'border-red-500 shadow-lg shadow-red-200'
                            : isConfirmed
                              ? 'bg-white border-slate-200'
                              : 'bg-red-50 border-red-200'
                        } ${flashingIds.has(alert.id) ? 'animate-pulse' : ''}`}
                      >
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedAlertId(isSelected ? null : alert.id)}
                          onKeyDown={(e) => e.key === 'Enter' && setSelectedAlertId(isSelected ? null : alert.id)}
                          className={`p-3 cursor-pointer ${isConfirmed ? 'hover:bg-slate-50' : 'hover:bg-red-100'}`}
                        >
                          <div className="flex items-start gap-2">
                            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <h3 className={`font-semibold text-sm line-clamp-2 ${isConfirmed ? 'text-slate-900' : 'text-red-900'}`}>
                                  {alert.title || alert.alertname}
                                </h3>
                                <span className={`text-xs shrink-0 whitespace-nowrap ${isConfirmed ? 'text-slate-500' : 'text-red-600'}`}>
                                  {formatTime(alert.timestamp)}
                                </span>
                              </div>
                              {alert.description && (
                                <p className={`text-xs line-clamp-2 mb-1 ${isConfirmed ? 'text-slate-600' : 'text-red-700'}`}>
                                  {alert.description}
                                </p>
                              )}
                              {(alert.labels && Object.keys(alert.labels).length > 0) && (
                                <div className="space-y-0.5 mt-1.5">
                                  {Object.entries(alert.labels)
                                    .filter(([k]) => !['alertname', '__name__'].includes(k))
                                    .map(([k, v]) => (
                                      <p key={k} className={`text-xs ${isConfirmed ? 'text-slate-600' : 'text-red-700'}`}>
                                        {k}: {String(v)}
                                      </p>
                                    ))}
                                </div>
                              )}
                              <div className="flex flex-wrap gap-1 mt-2">
                                {alert.host && (
                                  <span className={`px-2 py-0.5 rounded text-xs ${isConfirmed ? 'bg-slate-100 text-slate-700' : 'bg-red-100 text-red-700'}`}>
                                    {alert.host}
                                  </span>
                                )}
                                {alert.grafana_folder && (
                                  <span className={`px-2 py-0.5 rounded text-xs ${isConfirmed ? 'bg-slate-100 text-slate-700' : 'bg-red-100 text-red-700'}`}>
                                    {alert.grafana_folder}
                                  </span>
                                )}
                              </div>
                              {isConfirmed && confirmedBy[alert.id] && (
                                <p className="text-xs text-slate-500 mt-1.5 text-right">
                                  {language === 'ko' ? '확인: ' : 'Confirmed by: '}{confirmedBy[alert.id]}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                        {isSelected && (
                          <div className={`flex gap-2 p-3 pt-2 border-t ${isConfirmed ? 'border-slate-100 bg-slate-50/50' : 'border-red-100 bg-red-50/80'}`}>
                            <button
                              type="button"
                              onClick={() => {
                                persistConfirmed(
                                  new Set([...confirmedIds, alert.id]),
                                  { ...confirmedBy, [alert.id]: currentUserName }
                                );
                                setSelectedAlertId(null);
                              }}
                              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
                            >
                              {language === 'ko' ? '확인' : 'Confirm'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const nextBy = { ...confirmedBy };
                                delete nextBy[alert.id];
                                persistConfirmed(
                                  new Set([...confirmedIds].filter((id) => id !== alert.id)),
                                  nextBy
                                );
                                setSelectedAlertId(null);
                              }}
                              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
                            >
                              {language === 'ko' ? '미확인' : 'Unconfirm'}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}

              {/* Resolved 알람 - 설비 탭에서는 공정 불량 알림은 절대 미표시 */}
              {resolvedAlerts.length > 0 && (
                <>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 mt-4">
                    {language === 'ko' ? '해결된 알람' : 'Resolved Alerts'}
                  </div>
                  {resolvedAlerts.slice(0, 20).map((alert) =>
                    isProcessDefectAlert(alert) ? null : (
                    <div
                      key={alert.id}
                      className="bg-slate-50 border border-slate-200 rounded-lg p-3 hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h3 className="font-medium text-slate-700 text-sm line-clamp-2">
                              {alert.title || alert.alertname}
                            </h3>
                            <span className="text-xs text-slate-500 shrink-0 whitespace-nowrap">
                              {formatTime(alert.timestamp)}
                            </span>
                          </div>
                          {alert.description && (
                            <p className="text-xs text-slate-600 line-clamp-2 mb-1">
                              {alert.description}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-1 mt-2">
                            {alert.host && (
                              <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-xs">
                                {alert.host}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                  )}
                </>
              )}
            </div>
          </ScrollbarOnScrollArea>
        )}

      </div>
    </div>
  );
}
