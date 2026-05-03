# Smart Booking System

미슐랭 스타일 파인다이닝 레스토랑 예약 시스템입니다.  
이메일만 있으면 누구나 바로 사용할 수 있습니다.

## 바로 사용하기

**👉 [https://smart-booking-system-lime.vercel.app](https://smart-booking-system-lime.vercel.app)**

- 예약: 날짜 · 시간 · 인원 · 코스 선택 → 이메일 인증 → 보증금 결제
- 관리자: [/admin](https://smart-booking-system-lime.vercel.app/admin) (토큰: `admin123`)

---

## 구현된 기능

- **코스 선택** — Lunch / Dinner Tasting Course 선택 후 예약
- **테이블 단위 배정** — 단일 테이블 우선, 최대 3개 조합
- **이메일 인증** — 예약 시 이메일 인증코드 확인
- **보증금 결제(Mock)** — 결제 완료 시 예약 확정
- **대기열 엔진** — 취소 발생 시 대기자 순차 알림 → 클레임 → 결제 → 확정
- **관리자 대시보드** — 식당/테이블/슬롯 생성, 예약 취소, 대기열 관리

---

## 로컬 실행 방법

Python 3.12와 [uv](https://docs.astral.sh/uv/) 필요.

```bash
# 백엔드 (http://127.0.0.1:8000)
uv sync
uv run uvicorn app.main:app --reload
```

프런트 개발 모드:

```bash
# 터미널 2 (http://127.0.0.1:5173)
cd frontend
npm install
npm run dev
```

프런트 빌드 후 배포:

```bash
cd frontend && npm run build
# → frontend/dist/ 생성, FastAPI가 자동 서빙
```

---

## 구조

```
app/
  main.py              # FastAPI 앱 + 라우트
  engine.py            # 대기/클레임/결제 엔진
  table_assignment.py  # 테이블 조합 알고리즘
  models.py / schemas.py / db.py / config.py / emailer.py
frontend/
  src/App.jsx          # React 전체 UI
  src/styles.css       # 럭셔리 디자인 시스템
  dist/                # 빌드 결과물 (Vercel 서빙용)
```

---

## 환경 변수

| 변수 | 기본값 | 설명 |
|---|---|---|
| `ADMIN_TOKEN` | `admin123` | 관리자 인증 |
| `DEPOSIT_PER_PERSON` | `100000` | 인당 보증금 (KRW) |
| `CLAIM_TTL_SECONDS` | `180` | 클레임 수락 제한 시간 |
| `PAYMENT_TTL_SECONDS` | `600` | 결제 제한 시간 |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USERNAME` / `SMTP_PASSWORD` | — | 이메일 발송 설정 (미설정 시 콘솔 출력) |
