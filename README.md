# Manufacturing Dashboard - Frontend

제조 공정 대시보드 프론트엔드 (Next.js)

## 구조

- `app/` - Next.js App Router 페이지 및 API 라우트
- `components/` - React 컴포넌트
- `contexts/` - React Context (인증, 언어, 대시보드 새로고침)
- `lib/` - 유틸리티 함수 (DB 연결, API 클라이언트 등)
- `public/` - 정적 파일
- `scripts/` - 빌드/배포 스크립트

## 설치 및 실행

```bash
npm install
npm run dev
```

프론트엔드는 `http://localhost:3000`에서 실행됩니다.

## 환경 변수

`.env.local` 파일을 생성하고 다음 변수들을 설정하세요:

- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` - 데이터베이스 연결 정보
- `JWT_SECRET` - JWT 토큰 서명용 비밀키
- `GOOGLE_GENERATIVE_AI_API_KEY` - Gemini API 키 (챗봇용)
- `NEXT_PUBLIC_API_BASE_URL` - 별도 백엔드 서버 사용 시 (선택사항)

## 백엔드 연동

- **Next.js API 라우트 사용** (기본): `.env.local`에 `NEXT_PUBLIC_API_BASE_URL`을 설정하지 않으면 `/api` 경로로 요청이 가며, Next.js API 라우트가 처리합니다.
- **별도 백엔드 서버 사용**: `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000` 설정 시 해당 백엔드로 요청이 전달됩니다.

## 배포

Vercel에 배포할 수 있습니다. Vercel 환경 변수에 위 환경 변수들을 설정하세요.
