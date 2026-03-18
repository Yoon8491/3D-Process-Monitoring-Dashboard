# 3D 설비 센서 데이터 - 환경 설정 파일 목록

## Grafana / InfluxDB 관련 설정 파일

| # | 파일 경로 | 용도 |
|---|-----------|------|
| 1 | **`frontend/.env.local`** | **3D 설비 팝업 센서 데이터** (Grafana/InfluxDB) — 실제 사용 |
| 2 | `frontend/.env.example` | 프론트엔드 설정 예시 템플릿 |
| 3 | `backend/backend/.env` | 백엔드 Node (lot-status 등) |
| 4 | `backend/backend/.env.example` | 백엔드 설정 예시 |
| 5 | `backend/backend_fastapi/.env` | FastAPI (Grafana 웹훅 등) |
| 6 | `backend/backend_fastapi/.env.example` | FastAPI 설정 예시 |
| 7 | `minseo/.env.example` | minseo 스택 (InfluxDB 등) 예시 |

## 3D 설비 클릭 시 데이터 소스

**센서 데이터(가스 유량, 배기 압력 등)는 `frontend/.env.local`만 사용합니다.**

Next.js API 라우트(`/api/influxdb/sensors`, `/api/grafana/sensors`)가 서버에서 이 env를 읽습니다.

> 상세 설정·실행 가이드는 `docs/SENSOR_SETUP_GUIDE.md`를 참고하세요.
