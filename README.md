# Smart Booking System

미슐랭 파인다이닝 레스토랑을 위한 풀스택 예약 플랫폼입니다.

**Live →** [smart-booking-system-lime.vercel.app](https://smart-booking-system-lime.vercel.app)

---

## 주요 기능

### 예약 플로우
| 단계 | 설명 |
|------|------|
| 이메일 인증 | 예약 전 6자리 코드 인증 (10분 유효) |
| 날짜 · 시간 선택 | 오늘부터 7일 롤링 윈도우, 지난 시간 자동 비활성화 |
| 코스 자동 지정 | 12:00 · 13:00 → 런치, 18:00 이후 → 디너 |
| 인원 선택 | 최대 6명 |
| 테이블 배정 | 최적 테이블 조합 알고리즘 (단일 우선, 최대 3테이블 조합) |
| 결제 | 인당 보증금 모의 결제 (10분 유효) |
| 예약 확정 | 이메일 확인 및 예약 완료 화면 |

### 만석 시 자동 대기 등록
- 슬롯이 꽉 찬 경우 별도 이동 없이 **즉시 대기 등록 흐름**으로 전환
- 대기 순서가 되면 클레임 링크를 이메일로 발송 (3분 유효)
- 클레임 수락 → 결제 완료 → 예약 확정

### 내 예약 조회
- 이메일로 본인 예약 및 대기 상태를 언제든지 확인 가능

### 슬롯 자동 롤링
- 매일 자정 하루치 슬롯을 자동 추가해 항상 7일치 예약 가능
- Vercel 서버리스 환경에서는 슬롯 조회 첫 요청 시 자동 처리

### 어드민 대시보드 (`/admin`)
| 기능 | 설명 |
|------|------|
| 레스토랑 관리 | 생성 · 삭제 (관련 슬롯 · 예약 · 대기열 cascade 삭제) |
| 테이블 · 슬롯 추가 | 레스토랑별 테이블 및 날짜/시간 슬롯 생성 |
| 슬롯별 예약 현황 | 오늘 이후 슬롯만 표시, 예약별 취소/삭제 버튼 |
| 전체 삭제 | 예약 + 대기 요청 + 클레임 + 오픈 슬롯 + 로그 일괄 삭제 |
| 대기 요청 관리 | 개별 삭제 시 연관 클레임 · 오픈 슬롯 자동 정리 |
| 대기열 강제 발송 | 기존 오퍼가 있어도 재발송 가능 |
| 만료 검사 | 클레임 · 결제 TTL 수동 실행 |
| 홈으로 버튼 | 관리자 페이지에서 예약 홈으로 바로 이동 |

---

## 예약 상태 머신

```
이메일 인증 → 날짜 / 시간 / 코스 / 인원 선택 → 예약 요청
  ├─ 잔여석 있음 → 결제 대기(10분) → 확정
  └─ 만석 → 대기 등록 → 오퍼 발송(3분) → 수락 → 결제 → 확정
```

---

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| Backend | FastAPI 0.115 · Python 3.12 |
| ORM | SQLAlchemy 2.0 |
| DB | Neon PostgreSQL (Vercel) · SQLite (로컬) |
| Frontend | React 18 · Vite 5 (SPA) |
| 배포 | Vercel (서버리스 Python) |
| 스케줄러 | APScheduler 3.10 (로컬) · lazy daily tick (Vercel) |
| 이메일 | SMTP / 콘솔 fallback |

---

## 로컬 실행

```bash
# Backend
uv sync
uv run uvicorn app.main:app --reload
# → http://127.0.0.1:8000

# Frontend (개발 서버)
cd frontend
npm install
npm run dev
# → http://127.0.0.1:5173
```

**환경 변수 (`.env` 또는 Vercel 대시보드)**

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `DATABASE_URL` | SQLite | Neon PostgreSQL 연결 문자열 |
| `ADMIN_TOKEN` | `admin123` | 관리자 인증 토큰 |
| `APP_BASE_URL` | `http://127.0.0.1:8000` | 클레임 이메일 링크 base URL |
| `DEPOSIT_PER_PERSON` | `100000` | 인당 보증금 (원) |
| `CLAIM_TTL_SECONDS` | `180` | 대기 오퍼 유효 시간 (초) |
| `PAYMENT_TTL_SECONDS` | `600` | 결제 유효 시간 (초) |
| `MAX_RESERVATIONS_PER_SLOT` | `3` | 슬롯당 최대 예약 수 |
| `SMTP_HOST` / `SMTP_*` | — | SMTP 설정 (생략 시 콘솔 출력) |

---

## 프로젝트 구조

```
app/
  main.py              # FastAPI 라우터 · 시드 데이터 · 슬롯 롤링
  engine.py            # 대기열 디스패치 · TTL 만료 · force 재발송
  table_assignment.py  # 테이블 조합 알고리즘
  models.py            # SQLAlchemy ORM 모델
  schemas.py           # Pydantic 스키마
  db.py                # DB 엔진 (NullPool for PostgreSQL)
  config.py            # 환경 변수
  emailer.py           # SMTP 발송
frontend/src/
  App.jsx              # React SPA (전체 뷰 단일 파일)
  styles.css           # Cormorant Garamond 럭셔리 디자인 시스템
frontend/public/
  og-image.png         # Open Graph 링크 미리보기 이미지 (1200×630)
```
