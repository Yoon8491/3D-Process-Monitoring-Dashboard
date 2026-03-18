/**
 * 백엔드 서버 URL을 가져오는 공통 함수
 * 
 * 우선순위:
 * 1. 환경 변수 (BACKEND_API_URL 또는 NEXT_PUBLIC_API_BASE_URL)
 * 2. NODE_ENV에 따른 기본값
 *    - development: 로컬 개발 서버 (http://3.34.166.82:4000)
 *    - production: Lightsail 백엔드 서버 (http://3.34.166.82:4000)
 * 
 * 주의: Vercel API 라우트에서는 절대 자기 자신(https://azas-project.vercel.app)을 호출하지 않도록 해야 합니다.
 * Vercel은 프론트엔드만 배포하고, 백엔드는 별도 서버(Lightsail)에서 실행됩니다.
 */
export function getBackendUrl(): string {
  // 환경 변수가 있으면 그것을 최우선으로 사용합니다.
  let backendUrl = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL;

  // 환경 변수가 없을 때만 기본값을 사용하는데, 접속 환경에 따라 주소를 분기합니다.
  if (!backendUrl) {
    if (process.env.NODE_ENV === 'development') {
      // 로컬 개발 환경 (npm run dev)
      backendUrl = 'http://3.34.166.82:4000';
    } else {
      // Vercel 배포 환경에서도 백엔드는 Lightsail 서버에 있음
      // Vercel API 라우트는 프록시 역할만 하므로 실제 백엔드 서버 주소를 사용
      backendUrl = 'http://3.34.166.82:4000';
    }
  }

  // 순환 참조 방지: 자기 자신을 호출하지 않도록 체크
  // Vercel API 라우트에서 실행 중일 때는 절대 자기 자신을 호출하면 안 됨
  if (typeof process !== 'undefined' && process.env.VERCEL) {
    // Vercel 환경에서는 환경 변수가 없으면 Lightsail 백엔드 사용
    if (!backendUrl || backendUrl.includes('vercel.app')) {
      backendUrl = 'http://3.34.166.82:4000';
    }
  }

  return backendUrl;
}
