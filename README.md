# Smart Booking System

**미슐랭 가이드 레스토랑을 위한 파인다이닝 예약 플랫폼.**  
이메일 하나면 누구나 바로 예약할 수 있습니다.

**👉 [smart-booking-system-lime.vercel.app](https://smart-booking-system-lime.vercel.app)**

---

## 주요 기능

| 기능 | 설명 |
|---|---|
| **코스 자동 배정** | 런치 슬롯(12:00·13:00) → Lunch Course, 디너 슬롯(18:00·19:00·20:00) → Dinner Course 자동 선택 |
| **테이블 배정** | 인원에 맞는 테이블 자동 조합 (단일 우선, 최대 3개 조합) |
| **이메일 인증** | 예약 전 6자리 코드로 본인 인증 |
| **보증금 결제** | 인당 100,000원 보증금 결제 후 예약 확정 |
| **예약 확인 이메일** | 결제 완료 시 예약 정보 이메일 자동 발송 |
| **중복 예약 차단** | 인증 후 이미 예약된 날짜·시간 슬롯 자동 비활성화 |
| **즉시 대기 등록** | 만석 시 별도 폼 없이 현재 입력한 정보로 바로 대기열 등록 |
| **대기열 엔진** | 취소 발생 시 대기자에게 순차 알림 → 클레임 → 결제 → 확정 |
| **예약 가능 기간** | 오늘부터 7일치, 지난 시간대는 자동으로 숨김 |
| **관리자 대시보드** | 식당·테이블·슬롯 관리, 예약 취소, 대기열 수동 발송 |

---

## 예약 플로우

```
날짜·시간 선택  →  코스·인원 선택  →  이메일 인증  →  보증금 결제  →  예약 확정
                                                              ↓ (만석인 경우)
                                                       만석 안내 화면 자동 전환
                                                              ↓
                                               [다른 시간 선택] 또는 [대기열 등록]
                                                              ↓
                                                       대기 등록 완료 (대기 번호 발급)
```

- 런치 슬롯 선택 시 → Lunch Tasting Course (320,000원/인) 자동 배정, 디너 선택 불가
- 디너 슬롯 선택 시 → Dinner Tasting Course (420,000원/인) 자동 배정, 런치 선택 불가
- 최대 6명까지 예약 가능
- 이메일 인증 후 이미 예약된 날짜는 "예약됨" 표시와 함께 선택 불가

---

## 대기열 플로우

```
예약 만석 → 대기 등록 (이름·이메일·인원 자동 입력)
         → 예약 취소 발생
         → 대기자에게 오퍼 이메일 발송 (클레임 링크 포함)
         → /claim/{token} 에서 수락
         → /pay/{token} 에서 보증금 결제
         → 예약 확정
```

---

## 관리자

**URL** → [`/admin`](https://smart-booking-system-lime.vercel.app/admin) · **토큰** → `admin123`

- 식당·테이블·슬롯 생성
- 예약 취소 및 대기열 수동 발송
- 알림 로그 조회

---

## 로컬 실행

Python 3.12와 [uv](https://docs.astral.sh/uv/) 필요.

```bash
# 의존성 설치 및 백엔드 실행 (http://127.0.0.1:8000)
uv sync
uv run uvicorn app.main:app --reload
```

> 이메일 인증 코드는 SMTP 미설정 시 터미널에 출력됩니다.

프론트엔드 개발 모드 (선택 사항):

```bash
cd frontend
npm install
npm run dev      # http://127.0.0.1:5173 — /api 요청은 :8000으로 프록시
```

프론트엔드 빌드:

```bash
cd frontend && npm run build
# → frontend/dist/ 생성, FastAPI가 자동 서빙
```

---

## 프로젝트 구조

```
app/
  main.py              # FastAPI 앱, 라우트, 시드 데이터 (7일치 슬롯 자동 생성)
  engine.py            # 대기/클레임/결제 TTL 엔진, 중복 예약 처리
  table_assignment.py  # 테이블 조합 알고리즘
  emailer.py           # SMTP 발송 (미설정 시 콘솔 출력)
  models.py / schemas.py / db.py / config.py
frontend/src/
  App.jsx              # React 전체 UI (단일 파일)
  styles.css           # 럭셔리 디자인 시스템 (Cormorant Garamond)
  dist/                # 빌드 결과물 — Git에 커밋되어 Vercel이 별도 빌드 없이 서빙
```

---

## 환경 변수

| 변수 | 기본값 | 설명 |
|---|---|---|
| `ADMIN_TOKEN` | `admin123` | 관리자 인증 토큰 |
| `DEPOSIT_PER_PERSON` | `100000` | 인당 예약 보증금 (KRW) |
| `CLAIM_TTL_SECONDS` | `180` | 대기 오퍼 수락 제한 시간 |
| `PAYMENT_TTL_SECONDS` | `600` | 결제 제한 시간 |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USERNAME` / `SMTP_PASSWORD` | — | 이메일 발송 설정 |

---

## 기술 스택

- **Backend** — Python 3.12 · FastAPI · SQLAlchemy · SQLite · APScheduler
- **Frontend** — React 18 · Vite · Cormorant Garamond (럭셔리 타이포그래피)
- **Infra** — Vercel Serverless (Python runtime)
