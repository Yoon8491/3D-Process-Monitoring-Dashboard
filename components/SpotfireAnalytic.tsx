'use client';

import { useEffect, useRef, useState } from 'react';
import SpotfireMockChart from './SpotfireMockChart';

declare global {
  interface Window {
    spotfire?: {
      webPlayer?: {
        createApplication: (
          webPlayerServerRootUrl: string,
          customizationInfo: object,
          analysisPath: string,
          parameters: string,
          reloadInstances: boolean,
          version: string,
          onReadyCallback: (status: string, application: { openDocument: (elementId: string, initialPage?: number | string, customizationInfo?: object) => unknown }) => void,
          onCreateLoginElement?: (createLoginElement: () => HTMLElement) => void
        ) => void;
      };
    };
  }
}

export interface SpotfireAnalyticProps {
  /** Spotfire 라이브러리 내 분석 문서 경로 (미설정 시 env NEXT_PUBLIC_SPOTFIRE_ANALYSIS_PATH 사용) */
  analysisPath?: string;
  /** 초기 페이지 (0부터 시작하는 인덱스 또는 페이지 제목) */
  initialPage?: number | string;
  /** 컨테이너 최소 높이 (px) */
  height?: number;
  className?: string;
}

const ELEMENT_ID = 'spotfire-analytic-container';

/** 환경 변수 전달 여부 점검용 로그 (개발 환경에서만) */
function logSpotfireEnv(serverUrl: string, analysisPath: string, useProxy: boolean, scriptUrl: string) {
  if (process.env.NODE_ENV !== 'development' || typeof window === 'undefined') return;
  const raw = process.env.NEXT_PUBLIC_SPOTFIRE_SERVER_URL;
  console.log('[Spotfire] 환경 변수 점검:', {
    'NEXT_PUBLIC_SPOTFIRE_SERVER_URL (raw)': raw ?? '(미설정)',
    'NEXT_PUBLIC_SPOTFIRE_ANALYSIS_PATH': process.env.NEXT_PUBLIC_SPOTFIRE_ANALYSIS_PATH ?? '(미설정)',
    '컴포넌트에 전달된 serverUrl': serverUrl || '(비어 있음)',
    '컴포넌트에 전달된 analysisPath': analysisPath || '(비어 있음)',
    'NEXT_PUBLIC_SPOTFIRE_USE_PROXY': useProxy,
    'layout 스크립트 URL (빌드 시 주입)': scriptUrl || '(스크립트 미로드)',
  });
}

export default function SpotfireAnalytic({
  analysisPath: analysisPathProp,
  initialPage = 0,
  height = 420,
  className = '',
}: SpotfireAnalyticProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const envLoggedRef = useRef(false);

  const serverUrl = typeof process.env.NEXT_PUBLIC_SPOTFIRE_SERVER_URL === 'string'
    ? process.env.NEXT_PUBLIC_SPOTFIRE_SERVER_URL.replace(/\/$/, '')
    : '';
  const analysisPath = analysisPathProp ?? process.env.NEXT_PUBLIC_SPOTFIRE_ANALYSIS_PATH ?? '';
  const useProxy = process.env.NEXT_PUBLIC_SPOTFIRE_USE_PROXY === 'true';
  const scriptUrl = serverUrl ? `${serverUrl.replace(/\/$/, '')}/spotfire/js-api/loader.js` : '';

  const effectiveServerUrl =
    typeof window !== 'undefined' && useProxy && serverUrl
      ? `${window.location.origin}/api/spotfire-proxy`
      : serverUrl;

  useEffect(() => {
    if (!envLoggedRef.current) {
      envLoggedRef.current = true;
      logSpotfireEnv(serverUrl, analysisPath, useProxy, scriptUrl);
    }
  }, [serverUrl, analysisPath, useProxy, scriptUrl]);

  useEffect(() => {
    if (!effectiveServerUrl || !analysisPath) {
      setStatus('idle');
      if (!serverUrl) setErrorMessage('NEXT_PUBLIC_SPOTFIRE_SERVER_URL이 설정되지 않았습니다.');
      else if (!analysisPath) setErrorMessage('분석 경로(analysisPath) 또는 NEXT_PUBLIC_SPOTFIRE_ANALYSIS_PATH가 필요합니다.');
      return;
    }

    setStatus('loading');
    setErrorMessage(null);

    const webPlayer = typeof window !== 'undefined' ? window.spotfire?.webPlayer : undefined;

    function runEmbed() {
      const wp = typeof window !== 'undefined' ? window.spotfire?.webPlayer : undefined;
      if (!wp?.createApplication) return false;

      const rootUrl = `${effectiveServerUrl.replace(/\/$/, '')}/spotfire/wp/`;
      if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
        console.log('[Spotfire] createApplication 호출 → 실제 Spotfire 차트 로드:', { rootUrl, analysisPath });
      }
      try {
        wp.createApplication(
          rootUrl,
          {},
          analysisPath,
          '',
          false,
          '14.4',
          (statusCode: string, application: { openDocument: (elementId: string, initialPage?: number | string, customizationInfo?: object) => unknown }) => {
            if (statusCode !== 'OK') {
              setStatus('error');
              setErrorMessage(statusCode || '앱 로드 실패');
              if (process.env.NODE_ENV === 'development') {
                console.warn('[Spotfire] onReady 상태:', statusCode);
              }
              return;
            }
            const openInElement = () => {
              const el = document.getElementById(ELEMENT_ID);
              if (!el) {
                requestAnimationFrame(openInElement);
                return;
              }
              try {
                application.openDocument(ELEMENT_ID, initialPage, {});
                setStatus('ready');
              } catch (e) {
                setStatus('error');
                setErrorMessage(e instanceof Error ? e.message : String(e));
                if (process.env.NODE_ENV === 'development') {
                  console.warn('[Spotfire] openDocument 오류:', e);
                }
              }
            };
            openInElement();
          },
          (createLoginElement: () => HTMLElement) => {
            const el = createLoginElement();
            if (containerRef.current) {
              containerRef.current.appendChild(el);
            }
            return el;
          }
        );
      } catch (e) {
        setStatus('error');
        setErrorMessage(e instanceof Error ? e.message : String(e));
        if (process.env.NODE_ENV === 'development') {
          console.warn('[Spotfire] createApplication 오류:', e);
        }
      }
      return true;
    }

    if (webPlayer?.createApplication) {
      runEmbed();
      return;
    }

    let cancelled = false;
    const timeout = setTimeout(() => {
      if (cancelled) return;
      setStatus('error');
      setErrorMessage('Spotfire 스크립트 로드 시간 초과. 서버 URL과 네트워크를 확인하세요.');
    }, 15000);

    const check = setInterval(() => {
      if (cancelled) return;
      if (runEmbed()) {
        clearInterval(check);
        clearTimeout(timeout);
      }
    }, 100);

    return () => {
      cancelled = true;
      clearInterval(check);
      clearTimeout(timeout);
    };
  }, [effectiveServerUrl, analysisPath, initialPage, serverUrl]);

  if (!serverUrl || !analysisPath) {
    return (
      <SpotfireMockChart
        height={height}
        message="Spotfire 서버 URL 또는 분석 경로가 설정되지 않았습니다. 로컬 테스트용 Mock 차트를 표시합니다."
        className={className}
      />
    );
  }

  if (status === 'error') {
    return (
      <div className={className}>
        <SpotfireMockChart
          height={height}
          message="Spotfire 연동 중 오류가 발생해 Mock 차트를 표시합니다."
          className="mb-2"
        />
        {errorMessage && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
            <strong>Spotfire 오류:</strong> {errorMessage}
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={className}>
      <div
        id={ELEMENT_ID}
        style={{ minHeight: height, width: '100%' }}
        className="rounded-lg border border-slate-200 bg-white overflow-hidden"
      />
      {status === 'loading' && (
        <div
          className="flex items-center justify-center text-slate-500 text-sm rounded-b-lg border border-t-0 border-slate-200 bg-slate-50"
          style={{ minHeight: 48 }}
        >
          Spotfire 분석 불러오는 중…
        </div>
      )}
    </div>
  );
}
