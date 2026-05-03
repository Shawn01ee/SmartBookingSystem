from __future__ import annotations

import os
from pathlib import Path


APP_NAME = "Smart Booking System"
BASE_DIR = Path(__file__).resolve().parent.parent
IS_VERCEL = bool(os.getenv("VERCEL"))
DB_PATH = Path("/tmp/restaurant_booking.db") if IS_VERCEL else BASE_DIR / "restaurant_booking.db"
DATABASE_URL = f"sqlite:///{DB_PATH}"

ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "admin123")
APP_BASE_URL = os.getenv("APP_BASE_URL", "http://127.0.0.1:8000")

CLAIM_TTL_SECONDS = int(os.getenv("CLAIM_TTL_SECONDS", "180"))
PAYMENT_TTL_SECONDS = int(os.getenv("PAYMENT_TTL_SECONDS", "600"))
DEPOSIT_PER_PERSON = int(os.getenv("DEPOSIT_PER_PERSON", "100000"))
EMAIL_VERIFICATION_CODE_TTL_SECONDS = int(os.getenv("EMAIL_VERIFICATION_CODE_TTL_SECONDS", "600"))
EMAIL_VERIFICATION_SESSION_TTL_SECONDS = int(os.getenv("EMAIL_VERIFICATION_SESSION_TTL_SECONDS", "1800"))

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", "")

DEV_FALLBACK_ADMIN_TOKEN = os.getenv("DEV_FALLBACK_ADMIN_TOKEN", "admin123")
