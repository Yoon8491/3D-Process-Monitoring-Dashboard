# InfluxDB 배포 체크리스트 (SSH 서버)

로컬에서 코드 개발 후 SSH 서버에 올리면 **환경 변수만 설정**하면 InfluxDB Raw Data가 바로 동작합니다.  
코드 수정 없이 배포 가능합니다.

## 1. 필요한 환경 변수 (프론트엔드)

SSH 서버에서 Next.js 앱 실행 시 아래 값을 설정하세요.

| 변수 | 설명 | 예시 |
|------|------|------|
| `INFLUXDB_URL` | InfluxDB API 주소 | `http://localhost:8086` (같은 서버) 또는 `http://192.168.x.x:8086` |
| `INFLUXDB_TOKEN` | InfluxDB API 토큰 (읽기 권한 이상) | InfluxDB UI → Load Data → API Tokens |
| `INFLUXDB_ORG` | Organization 이름 | `ktca` |
| `INFLUXDB_BUCKET` | Bucket 이름 (센서 데이터 저장소) | `fdc` 또는 `sensors` |

## 2. SSH 서버에서 설정 방법

### 방법 A: `.env.local` 사용 (권장)

```bash
# frontend 폴더에서
cp .env.example .env.local
# .env.local 편집 후 INFLUXDB_* 4개 값 채우기
```

### 방법 B: 실행 시 환경 변수로 주입

```bash
INFLUXDB_URL=http://localhost:8086 \
INFLUXDB_TOKEN=xxx \
INFLUXDB_ORG=ktca \
INFLUXDB_BUCKET=fdc \
npm run start
```

### 방법 C: PM2 / systemd / Docker

해당 실행 환경의 env 설정에 위 4개 변수를 추가하면 됩니다.

## 3. 로컬 vs SSH 서버

| 환경 | 동작 |
|------|------|
| **로컬** (INFLUXDB_* 미설정) | "데이터 수신 대기 중", "바인딩된 센서가 없습니다" → **정상** (에러 아님) |
| **SSH 서버** (INFLUXDB_* 설정) | InfluxDB에서 센서 데이터 조회 → Raw Data 팝업에 표시 |

## 4. 연결 확인

- InfluxDB가 SSH 서버 **같은 머신**에서 돌아가면: `INFLUXDB_URL=http://localhost:8086`
- **다른 머신**에서 돌아가면: `INFLUXDB_URL=http://<InfluxDB_IP>:8086`
- 방화벽/보안 그룹에서 `8086` 포트 허용 여부 확인

## 5. 참고

- `.env.example`에 InfluxDB 항목이 추가되어 있습니다.
- `frontend/app/api/influxdb/sensors/route.ts`에서 위 env를 사용합니다.
