# SmartBookingSystem

A restaurant reservation system with waitlist management, offer claims, and deposit payment TTL — built with FastAPI and React.

## Project structure

- `smart-booking-system/`: FastAPI backend + React frontend

## Quick start

```bash
cd smart-booking-system

# Backend
.venv311/bin/uvicorn app.main:app --reload
# → http://127.0.0.1:8000  (Guest UI)
# → http://127.0.0.1:8000/admin  (Admin UI, token: admin123)

# Frontend (dev mode)
cd frontend && npm install && npm run dev
# → http://127.0.0.1:5173
```

See `smart-booking-system/CLAUDE.md` for full architecture and development guide.
