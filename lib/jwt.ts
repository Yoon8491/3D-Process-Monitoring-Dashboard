import { SignJWT, jwtVerify } from 'jose';

const AUTH_COOKIE = 'auth_token';
const DEFAULT_EXPIRY = '7d'; // 7일

const getSecret = () =>
  new TextEncoder().encode(process.env.JWT_SECRET || 'manufacturing-dashboard-secret-change-in-production');

export type JwtPayload = {
  employeeNumber: string;
  name: string;
  role: 'admin' | 'user';
};

export async function signToken(payload: JwtPayload, expiresIn = DEFAULT_EXPIRY): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      employeeNumber: payload.employeeNumber as string,
      name: payload.name as string,
      role: payload.role as 'admin' | 'user',
    };
  } catch {
    return null;
  }
}

export { AUTH_COOKIE };
