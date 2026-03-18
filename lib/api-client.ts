export const TOKEN_STORAGE_KEY = 'auth_token';

/** HTTPS 페이지에서 HTTP 백엔드 호출 시 Mixed Content 차단되므로, 미설정 시 같은 도메인(Vercel API) 사용 */
const FALLBACK_API_BASE_URL = '';

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  FALLBACK_API_BASE_URL
).replace(/\/$/, '');

export function apiUrl(path: string) {
  if (!path.startsWith('/')) path = `/${path}`;
  return API_BASE_URL ? `${API_BASE_URL}${path}` : path;
}

/** 로그인/세션/회원가입 등 인증 API는 항상 같은 도메인으로 요청 (배포 시 Mixed Content·CORS 방지) */
export function authApiUrl(path: string) {
  if (!path.startsWith('/')) path = `/${path}`;
  return path;
}

/** 공정 현황/대시보드 API - NEXT_PUBLIC_API_BASE_URL 설정 시 백엔드 호출, 미설정 시 같은 도메인 */
export function dashboardApiUrl(path: string) {
  if (!path.startsWith('/')) path = `/${path}`;
  return API_BASE_URL ? `${API_BASE_URL}${path}` : path;
}

/** Grafana 알림 API - 항상 같은 도메인(Next 프록시)으로 요청해 404/CORS 방지 */
export function grafanaApiUrl(path: string) {
  if (!path.startsWith('/')) path = `/${path}`;
  return path;
}

/** Export API - DB 직접 조회하므로 항상 Next.js API 사용 */
export function exportApiUrl(path: string) {
  if (!path.startsWith('/')) path = `/${path}`;
  return path;
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function authHeader(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

