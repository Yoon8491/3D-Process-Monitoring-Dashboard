# 불량 원인 분석 배포 이슈 진단 가이드

서버에 배포했을 때 불량 원인 분석(`/analytics`) 페이지가 데이터를 표시하지 않는 경우의 원인과 대응 방법입니다.

---

## API 호출 흐름

1. **프론트엔드** `analytics/page.tsx`에서 `fetch(dashboardApiUrl('/api/dashboard/analytics'), { headers: authHeader() })` 호출
2. **dashboardApiUrl** (`lib/api-client.ts`):
   - `NEXT_PUBLIC_API_BASE_URL` **설정됨** → `http(s)://<백엔드주소>/api/dashboard/analytics` (백엔드로 직접 요청)
   - `NEXT_PUBLIC_API_BASE_URL` **미설정** → `/api/dashboard/analytics` (같은 도메인 = Vercel Next.js API 라우트)

---

## 가능한 원인별 진단

### 1. Mixed Content (가장 흔함) ⚠️

**증상**: 브라우저 콘솔에 `Mixed Content` 또는 `blocked:mixed-content` 메시지  
**원인**: Vercel 프론트엔드는 `https://...`, 백엔드는 `http://3.34.166.82:4000` → HTTPS 페이지에서 HTTP 요청이 차단됨  

**확인**:
- Vercel 환경 변수 `NEXT_PUBLIC_API_BASE_URL`이 `http://...`인지 확인
- 브라우저 개발자 도구 > Network 탭에서 analytics 요청이 `(blocked)` 또는 실패로 표시되는지 확인

**해결**:
- 백엔드에 **HTTPS 적용** 후 `NEXT_PUBLIC_API_BASE_URL`을 `https://...`로 변경
- 예: Let's Encrypt + Nginx 리버스 프록시, 또는 Cloudflare 터널 사용  
- Backend README 참고: `https://<backend-https-url>` 사용 권장

---

### 2. 401 Unauthorized

**증상**: Network 탭에서 `/api/dashboard/analytics` 응답이 401  
**원인**: 백엔드 analytics는 `requireAuth`로 JWT 검증. 토큰이 없거나 유효하지 않음  

**확인**:
- Network 탭에서 analytics 요청 헤더에 `Authorization: Bearer <token>` 포함 여부
- 백엔드와 프론트엔드(JWT 검증용)의 `JWT_SECRET`이 동일한지
- 로그인 상태 유지 여부 (토큰 만료 등)

**해결**:
- Vercel에 `JWT_SECRET` 설정 (백엔드와 동일한 값)
- 로그인 후 analytics 페이지 접근
- 쿠키/로컬스토리지 도메인 이슈 시, 같은 도메인에서 로그인·조회되도록 확인

---

### 3. CORS

**증상**: 콘솔에 `Access-Control-Allow-Origin` 관련 CORS 에러  
**원인**: 백엔드 `CORS_ORIGIN`에 Vercel 배포 URL이 포함되지 않음  

**확인**:
- `backend/backend/src/config.ts`: `corsOrigin` 기본값 `https://azas-project.vercel.app`
- 실제 배포 URL이 다르면(예: `https://xxx.vercel.app`) 해당 URL을 `CORS_ORIGIN`에 추가

**해결**:
- 백엔드 `.env` 또는 환경 변수:  
  `CORS_ORIGIN=https://azas-project.vercel.app,https://실제배포도메인.vercel.app`
- 변경 후 백엔드 재시작

---

### 4. NEXT_PUBLIC_API_BASE_URL 미설정

**증상**: 요청이 Vercel의 `/api/dashboard/analytics`로 전달됨  
**원인**: Vercel 환경 변수에 `NEXT_PUBLIC_API_BASE_URL`이 없음  

**동작**:
- Next.js API 라우트 `app/api/dashboard/analytics/route.ts`가 실행
- `getConnection()` 사용 → DB 연결 필요
- Vercel Serverless에서 `DB_HOST=localhost`는 **동작하지 않음** (Vercel 서버에 DB 없음)
- DB 연결 실패 → 500 에러 → `success: false` → 화면에 "로딩 중..." 또는 에러 메시지

**해결**:
- Vercel에 `NEXT_PUBLIC_API_BASE_URL=http://3.34.166.82:4000` 또는 HTTPS 백엔드 URL 설정
- 또는 Vercel에서 접근 가능한 **원격 DB**로 `DB_HOST`, `DB_PORT` 등 설정 후 Next.js 라우트 사용

---

### 5. MINSEO_API_URL (선택적)

**증상**: importance 데이터는 나오지만 minseo 기반 상관계수는 안 나옴  
**원인**: `MINSEO_API_URL`이 `localhost:8000` 등 배포 서버에서 접근 불가한 주소로 설정됨  

**해결**:
- 백엔드와 같은 네트워크에서 minseo FastAPI 접근 가능한 URL 사용
- 실패 시 fallback(DB probability 상관)으로 동작하므로, importance는 표시될 수 있음

---

### 6. DB 연결 실패

**증상**: 500 에러, `error` 필드에 DB 관련 메시지  
**원인**: 백엔드 또는 Next.js API의 DB 연결 실패  

**확인**:
- 백엔드 로그에서 `[dashboard/analytics] DB error` 메시지
- `simulation_results` 테이블 및 스키마 존재 여부

---

## 권장 확인 순서

1. **브라우저 개발자 도구**  
   - Network 탭: analytics 요청 URL, 상태 코드, 응답 본문  
   - Console 탭: CORS, Mixed Content 등 에러 메시지  

2. **Vercel 환경 변수**  
   - `NEXT_PUBLIC_API_BASE_URL`: 백엔드 주소 (가능하면 HTTPS)  
   - `JWT_SECRET`: 백엔드와 동일  

3. **백엔드 서버**  
   - 실행 여부  
   - `CORS_ORIGIN`에 배포 도메인 포함 여부  
   - HTTPS 사용 시 `NEXT_PUBLIC_API_BASE_URL`도 HTTPS로 설정  

---

## 빠른 체크리스트

| 항목 | 확인 |
|------|------|
| Vercel에 `NEXT_PUBLIC_API_BASE_URL` 설정됨 | ☐ |
| 해당 URL이 HTTPS (프론트가 HTTPS인 경우) | ☐ |
| 백엔드 CORS에 Vercel 배포 URL 포함 | ☐ |
| JWT_SECRET 프론트/백엔드 동일 | ☐ |
| 로그인 후 analytics 접근 | ☐ |
| 환경 변수 변경 후 Redeploy 수행 | ☐ |
