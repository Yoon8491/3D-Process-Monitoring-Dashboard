# 3D 설비 센서 데이터 실시간 연동 가이드

## 1. 설정 파일 위치 (Grafana / InfluxDB)

| # | 파일 경로 | 용도 |
|---|-----------|------|
| 1 | **`frontend/.env.local`** | **3D 설비 팝업 센서 데이터** — Grafana/InfluxDB 설정 (실제 사용) |
| 2 | `frontend/.env.example` | 프론트엔드 설정 예시 템플릿 |
| 3 | `backend/backend/.env` | 백엔드 Node (lot-status 등) |
| 4 | `backend/backend_fastapi/.env` | FastAPI (Grafana 웹훅 등) |
| 5 | `minseo/.env.example` | minseo 스택 (InfluxDB 등) 예시 |

---

## 2. 설비 ID ↔ 센서 ID 매핑 (influxdb-sensors.ts)

| 설비(3D 모델) | MACHINE_ID | 센서 ID (Grafana/InfluxDB) | 라벨 |
|---------------|------------|----------------------------|------|
| 원재료 투입 | raw-input-1 | TEMP-001, HUMID-001 | 주변온도, 주변습도 |
| 혼합 | mixer-1 | VIB-002, TEMP-003 | 샤프트 진동, 샤프트 온도 |
| 충전 | filler-1 | PRESS-001, PRESS-002 | 필터 압력, 에어 압력 |
| **소성(RHK)** | **kiln-3** | **FLOW-001, PRESS-004, TEMP-005, TEMP-006** | **가스 유량, 배기 압력, 냉각수 온도, 냉각수 배출** |
| 조분쇄(CSM) | coarse-mill-1 | VIB-001, TEMP-002 | 모터 진동, 모터 온도 |
| 미분쇄(클밀) | fine-mill-1 | VIB-003, TEMP-004, GAP-001 | 모터 진동, 모터 온도, 롤 간격 |
| 체거름 | sieve-1 | (없음) | - |
| 전자석 탈철 | magnet-1 | (없음) | - |
| 포장 | packer-1 | PRESS-003 | 충전부 압력 |

InfluxDB/Grafana에 `sensor_id` 태그로 위 ID(예: FLOW-001, PRESS-004)가 저장되어야 툴팁·Raw Data에 값이 표시됩니다.

---

## 3. frontend/.env.local 입력 형식

### 방법 A: Grafana API 사용 (권장 — 이미 Grafana URL/토큰이 있을 때)

```env
# Grafana API
GRAFANA_URL=https://your-grafana-host
GRAFANA_TOKEN=glsa_xxxx

# 3D 설비 클릭 시 Grafana로 센서 조회
NEXT_PUBLIC_USE_GRAFANA_SENSORS=true

# Grafana InfluxDB 데이터소스가 사용하는 org/bucket (동일하게 맞춤)
INFLUXDB_ORG=ktca
INFLUXDB_BUCKET=fdc

# (선택) InfluxDB 데이터소스 UID — 미설정 시 Grafana가 자동 검색
# GRAFANA_DATASOURCE_UID=your-datasource-uid
```

### 방법 B: InfluxDB 직접 연결

```env
INFLUXDB_URL=http://localhost:8086
INFLUXDB_TOKEN=your_influxdb_admin_token
INFLUXDB_ORG=ktca
INFLUXDB_BUCKET=fdc

# Grafana 미사용
# NEXT_PUBLIC_USE_GRAFANA_SENSORS=false (또는 생략)
```

---

## 4. 실행 명령어 및 추가 서버

### 3D 설비 센서 데이터만 사용할 때

- **프론트엔드만** 실행하면 됩니다. Next.js API(`/api/influxdb/sensors`, `/api/grafana/sensors`)가 서버에서 InfluxDB/Grafana를 호출합니다.
- 별도 백엔드(Node/FastAPI)를 띄우지 않아도 됩니다.

```powershell
cd frontend
npm run dev:only
```

또는 백엔드와 함께 실행:

```powershell
cd frontend
npm run dev
```

### 실시간 데이터 소스

| 데이터 | 필요한 서비스 | 설명 |
|--------|---------------|------|
| 3D 센서 값 | Grafana 또는 InfluxDB | `frontend/.env.local` 설정만 필요 |
| LOT 상태 | MariaDB + 백엔드 | lot-status API |
| 알람 | Grafana Webhook + FastAPI | 별도 설정 |

---

## 5. 디버깅 (브라우저 콘솔)

설비를 클릭하면 다음이 콘솔에 출력됩니다:

1. **`[3D 설비 클릭]`** — 클릭한 설비 정보, 현재 센서값
2. **`[3D 설비 클릭] Grafana/InfluxDB API Response`** — API 응답(sensors, lastUpdated, error 등)
3. **`[3D 설비 센서 API] Response`** — 2초마다 폴링 응답

F12 → Console에서 위 로그를 확인하여 데이터 수신 여부를 확인할 수 있습니다.
