# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend (FastAPI)
```bash
# Install dependencies (uses Python 3.11 venv)
.venv311/bin/pip install -r requirements.txt

# Run backend (hot-reload)
.venv311/bin/uvicorn app.main:app --reload
# → http://127.0.0.1:8000  (serves built frontend SPA)
# → Admin UI: http://127.0.0.1:8000/admin  (token: admin123)
```

### Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev      # Dev server at http://127.0.0.1:5173 (proxies /api → :8000)
npm run build    # Production build → frontend/dist/ (served by FastAPI)
```

### Testing
```bash
# Integration smoke test (requires running backend on :8000)
.venv311/bin/python scripts/smoke_test.py
```

## Architecture

This is a restaurant reservation system (Catch Table-style) with a **FastAPI backend** and **React + Vite frontend**.

```
app/
  main.py            # FastAPI app, all route handlers, startup seed data
  engine.py          # Core business logic: waitlist dispatch, claim/payment TTL expiry
  table_assignment.py  # Table-combination matching algorithm
  models.py          # SQLAlchemy ORM models
  schemas.py         # Pydantic request/response schemas
  db.py              # SQLAlchemy engine + session factory (SQLite)
  config.py          # Environment variables with defaults
  emailer.py         # SMTP sender (falls back to console in dev)
  static/            # Fallback SPA files (overridden by frontend/dist at runtime)
frontend/src/
  App.jsx            # ~1400-line single-file React app (all views/components inline)
  main.jsx           # Vite entry point
scripts/
  smoke_test.py      # End-to-end integration test via HTTP
restaurant_booking.db  # SQLite database (auto-seeded on first run)
```

### Frontend serving
In production, `frontend/dist/` is built and FastAPI serves it as a StaticFiles mount. The SPA handles four client-side routes (`/`, `/admin`, `/claim/:token`, `/pay/:token`); all unknown paths fall back to `index.html`.

In dev, Vite proxies `/api/*` to port 8000 and serves the React app on port 5173.

### Reservation lifecycle
1. Guest requests email verification code → confirms code → creates reservation
2. Backend runs `table_assignment.py` to find best table combo (prefer single table; allow up to 3 combinable tables; minimize waste)
3. Duplicate guard: same email+slot blocked; same email/phone within overlapping time window blocked

### Waitlist + TTL state machine
- **Slot opens** (cancellation or payment expiry) → `engine.py` dispatches oldest matching `WaitlistRequest`
- **Offer dispatched** → email sent with claim link; `Claim` created with TTL (`CLAIM_TTL_SECONDS`, default 180 s)
- **Guest accepts claim** → `Payment` created with TTL (`PAYMENT_TTL_SECONDS`, default 600 s)
- **Payment completed** → reservation confirmed
- **Claim or payment expires** → slot reopened, next waitlister notified

**APScheduler** calls `engine_tick()` every 20 seconds to process expiries.

### Key environment variables (`app/config.py`)
| Variable | Default | Purpose |
|---|---|---|
| `ADMIN_TOKEN` | `admin123` | Admin API auth header `X-Admin-Token` |
| `CLAIM_TTL_SECONDS` | `180` | Seconds to accept a waitlist offer |
| `PAYMENT_TTL_SECONDS` | `600` | Seconds to complete payment |
| `DEPOSIT_PER_PERSON` | `5000` | Mock deposit amount (KRW) |
| `SMTP_*` | — | SMTP config; omit for console email output |

### Admin API
All admin endpoints require the header `X-Admin-Token: <ADMIN_TOKEN>`. Key endpoints:
- `GET /api/admin/dashboard` — full snapshot (restaurants, tables, slots, waitlist, logs)
- `POST /api/admin/open-slots/{id}/dispatch` — manually trigger next waitlister
- `POST /api/admin/engine/run` — manually run expiry checks
