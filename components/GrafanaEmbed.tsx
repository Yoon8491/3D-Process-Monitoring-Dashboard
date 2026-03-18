'use client';

import { useState, useEffect, useRef } from 'react';

const GRAFANA_LOAD_TIMEOUT_MS = 15000;

type GrafanaEmbedProps = {
  src: string;
  title: string;
  className?: string;
  style?: React.CSSProperties;
  height?: number | string;
};

/**
 * Grafana iframe 임베드. 로드 타임아웃 시 안내 + 다시 로드 버튼으로 끊김 복구 유도.
 */
export default function GrafanaEmbed({
  src,
  title,
  className = '',
  style,
  height = 420,
}: GrafanaEmbedProps) {
  const [loaded, setLoaded] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showRetry = timedOut || (!loaded && refreshKey > 0);

  useEffect(() => {
    if (!src) return;
    setLoaded(false);
    setTimedOut(false);
    timeoutRef.current = setTimeout(() => {
      setTimedOut((prev) => {
        if (!prev) return true;
        return prev;
      });
    }, GRAFANA_LOAD_TIMEOUT_MS);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    };
  }, [src, refreshKey]);

  const handleLoad = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setLoaded(true);
    setTimedOut(false);
  };

  const handleRetry = () => {
    setRefreshKey((k) => k + 1);
  };

  if (!src) return null;

  return (
    <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm" style={{ height: typeof height === 'number' ? `${height}px` : height, ...style }}>
      <iframe
        key={`${src}-${refreshKey}`}
        src={src}
        className={`w-full h-full ${className}`}
        style={{ border: 0 }}
        title={title}
        loading="lazy"
        onLoad={handleLoad}
      />
      {!loaded && !timedOut && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50/90">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-slate-600">Grafana 연결 중...</span>
          </div>
        </div>
      )}
      {timedOut && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-50 p-4">
          <p className="text-sm text-slate-700 text-center">
            Grafana에 연결할 수 없습니다.
            <br />
            네트워크와 Grafana 서버를 확인한 뒤 다시 시도해 주세요.
          </p>
          <button
            type="button"
            onClick={handleRetry}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            다시 로드
          </button>
        </div>
      )}
    </div>
  );
}
