# Smart Booking System

식당이 직접 사용하는 자체 예약 시스템 데모입니다.  
캐치테이블처럼 `예약 -> 만석 -> 대기 등록 -> 취소 발생 -> 순차 알림 -> 클레임 -> 보증금 결제 -> 예약 확정` 흐름을 한 앱 안에서 구현했습니다.

## 구현된 기능

- 테이블 단위 배정
  - 단일 테이블 우선
  - 부족하면 최대 3개 테이블 조합
  - 남는 좌석 수가 가장 적은 조합 우선
- 손님용 예약 화면
  - 슬롯 선택
  - 휴대폰 번호 입력
  - 이메일 인증코드 확인
  - 보증금 결제(Mock)
  - 결제 완료 시 예약 확정
- 중복 체크
  - 같은 이메일로 같은 슬롯 예약 중복 방지
  - 같은 이메일 또는 휴대폰 번호로 같은 슬롯 예약 중복 방지
  - 같은 이메일 또는 휴대폰 번호로 같은 시간대 대기 신청 중복 방지
- 대기열 엔진
  - 원하는 날짜, 시간 범위, 인원으로 대기 등록
  - 취소나 결제 만료로 좌석이 다시 열리면 조건 매칭
  - 대기자 1명씩 순차적으로 이메일 오퍼 발송
- 클레임 + TTL
  - 알림 링크를 누르면 클레임 수락
  - 일정 시간 안에 결제를 끝내야 예약 확정
  - 만료되면 다음 대기자에게 기회 이동
- 관리자 대시보드
  - 식당, 테이블, 슬롯 생성
  - 예약 취소
  - 오픈 슬롯 생성
  - 수동 디스패치
  - 대기열과 알림 로그 확인

## 구조

```text
smart-booking-system/
├─ app/
│  ├─ main.py              # FastAPI 앱 + API 라우트 + SPA 서빙
│  ├─ engine.py            # 예약/대기/클레임/결제 엔진
│  ├─ table_assignment.py  # 테이블 조합 알고리즘
│  ├─ models.py            # SQLAlchemy 모델
│  ├─ schemas.py           # Pydantic 스키마
│  ├─ emailer.py           # SMTP 또는 콘솔 이메일 발송
│  └─ static/
│     ├─ index.html        # fallback SPA 엔트리
│     ├─ app.js            # fallback UI
│     └─ styles.css        # fallback 스타일
├─ frontend/
│  ├─ src/
│  │  ├─ App.jsx           # React 화면 로직
│  │  ├─ main.jsx          # React 진입점
│  │  └─ styles.css        # React 스타일
│  ├─ package.json         # Vite 스크립트와 의존성
│  └─ vite.config.js       # Vite 설정과 API 프록시
├─ pyproject.toml
├─ uv.lock
└─ README.md
```

## 실행 방법

Python 3.12와 [uv](https://docs.astral.sh/uv/)가 필요합니다.

```bash
uv sync
uv run uvicorn app.main:app --reload
```

브라우저에서 엽니다.

- 손님 화면: [http://127.0.0.1:8000/](http://127.0.0.1:8000/)
- 관리자 화면: [http://127.0.0.1:8000/admin](http://127.0.0.1:8000/admin)

## React + Vite 프런트

프런트 소스는 [frontend/](frontend/) 아래에 있습니다.

프로덕션 빌드:

```bash
cd frontend
npm install
npm run build
```

빌드가 끝나면 FastAPI가 `frontend/dist/index.html`과 `frontend/dist/assets/*`를 자동으로 서빙합니다.

개발 모드:

```bash
# 터미널 1
uv run uvicorn app.main:app --reload --port 8000

# 터미널 2
cd frontend
npm install
npm run dev
```

Vite 개발 서버는 기본적으로 [http://127.0.0.1:5173](http://127.0.0.1:5173) 에서 열리고, `/api` 요청은 백엔드 `8000` 포트로 프록시됩니다.

기본 관리자 토큰:

```text
admin123
```

## 환경 변수

```bash
export ADMIN_TOKEN=admin123
export APP_BASE_URL=http://127.0.0.1:8000
export CLAIM_TTL_SECONDS=180
export PAYMENT_TTL_SECONDS=600
export DEPOSIT_PER_PERSON=5000
export EMAIL_VERIFICATION_CODE_TTL_SECONDS=600
export EMAIL_VERIFICATION_SESSION_TTL_SECONDS=1800
```

이메일을 실제로 보내려면 SMTP를 설정합니다.

```bash
export SMTP_HOST=smtp.sendgrid.net
export SMTP_PORT=587
export SMTP_USERNAME=apikey
export SMTP_PASSWORD=YOUR_SENDGRID_API_KEY
export SMTP_FROM=no-reply@yourdomain.com
```

SMTP가 없으면 이메일 내용은 서버 콘솔에 출력됩니다.

## 빠른 스모크 테스트

서버를 직접 띄우지 않아도 내부 API 흐름을 한 번에 점검할 수 있습니다.

```bash
uv run python scripts/smoke_test.py
```

## 화면 설명

### 손님 화면

- 식당과 슬롯 선택
- 휴대폰 번호 입력
- 이메일 인증코드 발송 및 확인
- 예약 요청
- 만석이면 대기 등록
- 이메일 링크를 통한 오퍼 수락
- 보증금 결제

### 관리자 화면

- 식당 생성
- 테이블 생성
- 슬롯 생성
- 예약 취소
- 오픈 슬롯 생성 및 대기 알림 발송
- 대기 요청, 알림 로그 확인

## 알고리즘 설명

### 1. 테이블 배정 알고리즘

입력:

- 식당
- 특정 슬롯
- 손님 인원 수

동작:

1. 해당 슬롯에 이미 잡혀 있는 테이블을 제외합니다.
2. 남은 테이블 중 단일 테이블부터 조합을 검사합니다.
3. 최대 3개까지 조합합니다.
4. 수용 가능 조합 중 남는 좌석 수가 최소인 조합을 선택합니다.
5. 남는 좌석 수가 같으면 더 적은 테이블 수를 선택합니다.

### 2. 대기열 매칭 알고리즘

오픈 슬롯이 생기면 아래 조건을 만족하는 대기 요청을 찾습니다.

- 같은 식당
- 같은 날짜
- 희망 시간 범위 안에 슬롯 시간이 포함됨
- 희망 인원 수가 오픈 슬롯 수용 인원 이하
- 상태가 `active`

그 후 가장 먼저 등록한 대기자부터 순서대로 오퍼를 보냅니다.

### 3. 클레임 + TTL

알림을 받은 대기자는 일정 시간 안에 링크를 눌러 오퍼를 수락해야 합니다.

- `active`: 현재 수락 가능한 오퍼
- `accepted`: 오퍼 수락 완료
- `expired`: 만료

만료되면 다음 대기자에게 자동으로 넘어갑니다.

### 4. 결제 + 확정

오퍼를 수락하면 임시 예약과 보증금 결제가 생성됩니다.

- 결제 완료: 예약 `confirmed`
- 결제 만료: 예약 `cancelled`, 슬롯 재오픈, 다음 대기자 디스패치

## API 개념 설명

`API는 화면과 서버가 대화하는 규칙`입니다.

예를 들면:

- 손님 화면이 "예약 만들어줘"라고 요청
- 서버가 테이블 배정 알고리즘을 실행
- 가능하면 결제 토큰을 만들어서 응답
- 화면은 그 응답을 받아 결제 화면으로 이동

여기서 실제 요청 주소가 API입니다.

예시:

- `GET /api/public/restaurants`
- `POST /api/public/email-verifications/request`
- `POST /api/public/email-verifications/confirm`
- `POST /api/public/restaurants/{id}/reservations`
- `POST /api/public/restaurants/{id}/waitlist`
- `POST /api/public/claims/{token}/accept`
- `POST /api/public/payments/{token}/complete`
- `GET /api/admin/dashboard`
- `POST /api/admin/reservations/{id}/cancel`

즉:

- 화면은 사용자에게 보이는 부분
- FastAPI는 데이터를 처리하는 서버 부분
- API는 둘 사이의 약속

## 검증한 흐름

1. 예약 생성
2. 이메일 인증코드 발송/확인
3. 결제 완료
4. 대기 등록
5. 관리자 취소
6. 개발 모드 이메일 오퍼 발송
7. 클레임 수락
8. 대기자 예약 확정

## 다음에 확장하기 좋은 기능

- 좌석 구역 구분
- 노쇼 정책
- 실제 PG 연동
- 관리자 계정/권한
- 다중 채널 알림
- 반복 슬롯 생성
