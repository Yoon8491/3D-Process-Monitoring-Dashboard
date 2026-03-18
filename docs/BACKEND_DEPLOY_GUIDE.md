# 백엔드 서버 수동 배포 가이드

LOT별 공정현황(불량영향도 색), 불량원인분석 계산값 등 **백엔드 변경사항**이 배포된 사이트에 반영되지 않을 때 참고하세요.

---

## 왜 배포된 사이트에 안 보이나?

- **Vercel** (프론트엔드): Git push 시 자동 재배포됨 ✅
- **백엔드** (3.34.166.82:4000): 별도 서버 → **수동 배포 필요** ❌

`NEXT_PUBLIC_API_BASE_URL`로 백엔드를 직접 호출하므로, lot-status, analytics 등은 **백엔드 서버의 코드**가 사용됩니다.

---

## 백엔드 배포 절차

### 1. Lightsail 서버에 SSH 접속

```bash
ssh -i <키파일> ubuntu@3.34.166.82
# 또는 사용 중인 계정/키로 접속
```

### 2. 프로젝트 폴더로 이동 후 최신 코드 받기

```bash
cd /path/to/azas_project-pink   # 실제 프로젝트 경로
git pull origin main
```

### 3. 의존성 설치 (필요 시)

```bash
cd backend/backend
npm install
```

### 4. 백엔드 재시작

**PM2 사용 시:**
```bash
pm2 restart all
# 또는 특정 앱만
pm2 restart backend
```

**systemd 사용 시:**
```bash
sudo systemctl restart azas-backend
```

**직접 실행 중이었다면:**
- 기존 프로세스 종료 (Ctrl+C 또는 `kill`)
- `npm run dev` 또는 `node dist/index.js` 등으로 재실행

---

## 배포 후 확인

1. 브라우저: `http://3.34.166.82:4000/health` → `{"ok":true}`
2. 배포 사이트 로그인 → LOT별 공정현황 날짜 범위 선택
3. 불량영향도가 가장 큰 항목에 연한 빨간색(또는 적용한 색) 표시되는지 확인
4. 불량원인분석 페이지에서 계산값이 최신 로직으로 나오는지 확인

---

## 체크리스트

| 단계 | 확인 |
|------|------|
| Git에 최신 코드 push 완료 | ☐ |
| 백엔드 서버 SSH 접속 | ☐ |
| `git pull` 실행 | ☐ |
| `npm install` (package.json 변경 시) | ☐ |
| 백엔드 프로세스 재시작 | ☐ |
| /health 응답 확인 | ☐ |
| 배포 사이트에서 동작 확인 | ☐ |
