from __future__ import annotations

from datetime import date, timedelta
from pprint import pprint
from pathlib import Path
import sys
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fastapi.testclient import TestClient

from app.db import SessionLocal
from app.main import app
from app.models import Claim, EmailVerification


def main() -> None:
    client = TestClient(app)
    admin_headers = {"X-Admin-Token": "admin123"}
    unique = uuid4().hex[:8]
    reservation_email = f"reservation-{unique}@example.com"
    waitlist_email = f"waitlist-{unique}@example.com"
    reservation_phone = f"01011{unique[:6]}"
    waitlist_phone = f"01022{unique[:6]}"
    slot_day = (date.today() + timedelta(days=30)).isoformat()
    slot_time = f"18:{int(unique[:2], 16) % 60:02d}:{int(unique[2:4], 16) % 60:02d}"

    slot = client.post(
        "/api/admin/restaurants/1/slots",
        headers=admin_headers,
        json={
            "day": slot_day,
            "time": slot_time,
            "is_open": True,
        },
    ).json()["slot"]
    slot_id = slot["id"]

    restaurants = client.get("/api/public/restaurants").json()
    print("restaurants")
    pprint(restaurants)

    db = SessionLocal()
    try:
        client.post("/api/public/email-verifications/request", json={"email": reservation_email})
        reservation_verification = (
            db.query(EmailVerification)
            .filter(EmailVerification.email == reservation_email)
            .order_by(EmailVerification.created_at.desc())
            .first()
        )
        reservation_verification_confirm = client.post(
            "/api/public/email-verifications/confirm",
            json={"email": reservation_email, "code": reservation_verification.code},
        )
        print("\nreservation_verification_confirm")
        print(reservation_verification_confirm.status_code, reservation_verification_confirm.json())
    finally:
        db.close()

    reservation = client.post(
        "/api/public/restaurants/1/reservations",
        json={
            "slot_id": slot_id,
            "party_size": 2,
            "guest_name": "Smoke Reservation",
            "guest_email": reservation_email,
            "phone_number": reservation_phone,
        },
    ).json()
    print("\nreservation")
    pprint(reservation)

    payment_complete = client.post(f"/api/public/payments/{reservation['payment_token']}/complete").json()
    print("\npayment_complete")
    pprint(payment_complete)

    duplicate_reservation = client.post(
        "/api/public/restaurants/1/reservations",
        json={
            "slot_id": slot_id,
            "party_size": 2,
            "guest_name": "Smoke Reservation",
            "guest_email": reservation_email,
            "phone_number": reservation_phone,
        },
    )
    print("\nduplicate_reservation")
    print(duplicate_reservation.status_code, duplicate_reservation.json())

    db = SessionLocal()
    try:
        client.post("/api/public/email-verifications/request", json={"email": waitlist_email})
        waitlist_verification = (
            db.query(EmailVerification)
            .filter(EmailVerification.email == waitlist_email)
            .order_by(EmailVerification.created_at.desc())
            .first()
        )
        waitlist_verification_confirm = client.post(
            "/api/public/email-verifications/confirm",
            json={"email": waitlist_email, "code": waitlist_verification.code},
        )
        print("\nwaitlist_verification_confirm")
        print(waitlist_verification_confirm.status_code, waitlist_verification_confirm.json())
    finally:
        db.close()

    waitlist = client.post(
        "/api/public/restaurants/1/waitlist",
        json={
            "day": slot_day,
            "time_start": slot_time,
            "time_end": slot_time,
            "party_size": 2,
            "guest_name": "Smoke Waitlist",
            "guest_email": waitlist_email,
            "phone_number": waitlist_phone,
            "notes": "window if possible",
        },
    ).json()
    print("\nwaitlist")
    pprint(waitlist)

    duplicate_waitlist = client.post(
        "/api/public/restaurants/1/waitlist",
        json={
            "day": slot_day,
            "time_start": slot_time,
            "time_end": slot_time,
            "party_size": 2,
            "guest_name": "Smoke Waitlist",
            "guest_email": waitlist_email,
            "phone_number": waitlist_phone,
            "notes": "window if possible",
        },
    )
    print("\nduplicate_waitlist")
    print(duplicate_waitlist.status_code, duplicate_waitlist.json())

    cancel = client.post(
        f"/api/admin/reservations/{reservation['reservation_id']}/cancel",
        headers=admin_headers,
    ).json()
    print("\ncancel")
    pprint(cancel)

    db = SessionLocal()
    try:
        claim = db.query(Claim).order_by(Claim.created_at.desc()).first()
        if claim:
            accept = client.post(f"/api/public/claims/{claim.token}/accept").json()
            print("\nclaim_accept")
            pprint(accept)
            payment_complete = client.post(f"/api/public/payments/{accept['payment_token']}/complete").json()
            print("\nwaitlist_payment_complete")
            pprint(payment_complete)
    finally:
        db.close()


if __name__ == "__main__":
    main()
