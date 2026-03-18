import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, AUTH_COOKIE } from '@/lib/jwt';

/** 서버 사이드에서 요청의 인증 토큰을 확인하고 사용자 정보를 반환 */
export async function getAuthUser(request: NextRequest) {
  let token: string | undefined;
  
  // 쿠키에서 토큰 확인
  const cookieStore = await cookies();
  token = cookieStore.get(AUTH_COOKIE)?.value;
  
  // 쿠키에 없으면 Authorization 헤더에서 확인
  if (!token) {
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    }
  }

  if (!token) {
    return null;
  }

  const user = await verifyToken(token);
  return user;
}
