from __future__ import annotations

from datetime import date, datetime, time, timedelta
import secrets

from sqlalchemy.orm import Session

from .config import (
    APP_BASE_URL,
    CLAIM_TTL_SECONDS,
    DEPOSIT_PER_PERSON,
    EMAIL_VERIFICATION_CODE_TTL_SECONDS,
    EMAIL_VERIFICATION_SESSION_TTL_SECONDS,
    PAYMENT_TTL_SECONDS,
)
from .emailer import send_email
from .models import (
    Claim,
    DiningTable,
    EmailVerification,
    NotificationLog,
    OpenSlot,
    Payment,
    Reservation,
    ReservationTable,
    Restaurant,
    Slot,
    WaitlistRequest,
)
from .table_assignment import find_best_tables, refresh_slot_open_state


def utcnow() -> datetime:
    return datetime.utcnow()


def normalize_email(email: str) -> str:
    return email.strip().lower()


def normalize_phone(phone: str | None) -> str | None:
    digits = "".join(ch for ch in str(phone or "") if ch.isdigit())
    return digits or None


def same_identity(
    email_a: str | None,
    phone_a: str | None,
    email_b: str | None,
    phone_b: str | None,
) -> bool:
    normalized_email_a = normalize_email(email_a or "") if email_a else None
    normalized_email_b = normalize_email(email_b or "") if email_b else None
    normalized_phone_a = normalize_phone(phone_a)
    normalized_phone_b = normalize_phone(phone_b)
    email_match = normalized_email_a and normalized_email_b and normalized_email_a == normalized_email_b
    phone_match = normalized_phone_a and normalized_phone_b and normalized_phone_a == normalized_phone_b
    return bool(email_match or phone_match)


def restaurant_name(db: Session, restaurant_id: int) -> str:
    restaurant = db.get(Restaurant, restaurant_id)
    return restaurant.name if restaurant else f"Restaurant {restaurant_id}"


def create_email_verification(db: Session, email: str) -> dict:
    normalized_email = normalize_email(email)
    existing = db.query(EmailVerification).filter(
        EmailVerification.email == normalized_email,
        EmailVerification.status == "pending",
    ).all()
    for row in existing:
        row.status = "superseded"

    code = f"{secrets.randbelow(1_000_000):06d}"
    verification = EmailVerification(
        email=normalized_email,
        code=code,
        status="pending",
        expires_at=utcnow() + timedelta(seconds=EMAIL_VERIFICATION_CODE_TTL_SECONDS),
    )
    db.add(verification)
    db.commit()
    db.refresh(verification)

    subject = "[Smart Booking System] 이메일 인증 코드"
    body = (
        "안녕하세요.\n\n"
        f"예약 진행을 위한 인증번호는 {code} 입니다.\n"
        f"인증번호는 {EMAIL_VERIFICATION_CODE_TTL_SECONDS // 60}분 동안 유효합니다.\n\n"
        "본인이 요청하지 않았다면 이 메일을 무시해 주세요."
    )
    ok, detail = send_email(normalized_email, subject, body)
    if not ok:
        verification.status = "failed"
        db.commit()
        return {"ok": False, "reason": "send_failed", "detail": detail}

    return {"ok": True, "expires_at": verification.expires_at, "detail": detail}


def confirm_email_verification(db: Session, email: str, code: str) -> dict:
    normalized_email = normalize_email(email)
    verification = (
        db.query(EmailVerification)
        .filter(EmailVerification.email == normalized_email)
        .order_by(EmailVerification.created_at.desc())
        .first()
    )
    if not verification:
        return {"ok": False, "reason": "verification_not_found"}
    if verification.status != "pending":
        if verification.status == "verified":
            return {"ok": True, "already_verified": True}
        return {"ok": False, "reason": f"verification_not_pending:{verification.status}"}
    if verification.expires_at < utcnow():
        verification.status = "expired"
        db.commit()
        return {"ok": False, "reason": "verification_expired"}
    if verification.code != code.strip():
        return {"ok": False, "reason": "verification_code_mismatch"}

    verification.status = "verified"
    verification.verified_at = utcnow()
    db.commit()
    return {"ok": True, "verified_at": verification.verified_at}


def has_recent_email_verification(db: Session, email: str) -> bool:
    normalized_email = normalize_email(email)
    verification = (
        db.query(EmailVerification)
        .filter(
            EmailVerification.email == normalized_email,
            EmailVerification.status == "verified",
            EmailVerification.verified_at.is_not(None),
        )
        .order_by(EmailVerification.verified_at.desc())
        .first()
    )
    if not verification or not verification.verified_at:
        return False
    return verification.verified_at >= utcnow() - timedelta(seconds=EMAIL_VERIFICATION_SESSION_TTL_SECONDS)


def find_duplicate_reservation(
    db: Session,
    restaurant_id: int,
    slot_id: int,
    guest_email: str,
    phone_number: str | None,
) -> Reservation | None:
    reservations = (
        db.query(Reservation)
        .filter(
            Reservation.restaurant_id == restaurant_id,
            Reservation.slot_id == slot_id,
            Reservation.status.in_(["pending", "confirmed"]),
        )
        .all()
    )
    for reservation in reservations:
        if same_identity(reservation.guest_email, reservation.phone_number, guest_email, phone_number):
            return reservation
    return None


def find_duplicate_waitlist(
    db: Session,
    restaurant_id: int,
    day: date,
    time_start: time,
    time_end: time,
    guest_email: str,
    phone_number: str | None,
) -> WaitlistRequest | None:
    candidates = (
        db.query(WaitlistRequest)
        .filter(
            WaitlistRequest.restaurant_id == restaurant_id,
            WaitlistRequest.day == day,
            WaitlistRequest.status.in_(["active", "offered"]),
        )
        .all()
    )
    for candidate in candidates:
        if candidate.time_start <= time_end and candidate.time_end >= time_start and same_identity(
            candidate.guest_email,
            candidate.phone_number,
            guest_email,
            phone_number,
        ):
            return candidate
    return None


def find_existing_reservation_in_window(
    db: Session,
    restaurant_id: int,
    day: date,
    time_start: time,
    time_end: time,
    guest_email: str,
    phone_number: str | None,
) -> Reservation | None:
    reservations = (
        db.query(Reservation)
        .join(Slot, Slot.id == Reservation.slot_id)
        .filter(
            Reservation.restaurant_id == restaurant_id,
            Reservation.status.in_(["pending", "confirmed"]),
            Slot.day == day,
        )
        .all()
    )
    for reservation in reservations:
        slot = db.get(Slot, reservation.slot_id)
        if slot and time_start <= slot.time <= time_end and same_identity(
            reservation.guest_email,
            reservation.phone_number,
            guest_email,
            phone_number,
        ):
            return reservation
    return None


def _upsert_open_slot(db: Session, reservation: Reservation) -> OpenSlot:
    open_slot = (
        db.query(OpenSlot)
        .filter(OpenSlot.slot_id == reservation.slot_id, OpenSlot.is_active.is_(True))
        .first()
    )
    if open_slot:
        open_slot.party_size_cap = max(open_slot.party_size_cap, reservation.party_size)
    else:
        open_slot = OpenSlot(
            restaurant_id=reservation.restaurant_id,
            slot_id=reservation.slot_id,
            party_size_cap=reservation.party_size,
            is_active=True,
        )
        db.add(open_slot)
    db.commit()
    db.refresh(open_slot)
    return open_slot


def match_waitlists(db: Session, open_slot: OpenSlot) -> list[WaitlistRequest]:
    slot = db.get(Slot, open_slot.slot_id)
    if not slot:
        return []
    return (
        db.query(WaitlistRequest)
        .filter(
            WaitlistRequest.restaurant_id == open_slot.restaurant_id,
            WaitlistRequest.day == slot.day,
            WaitlistRequest.status == "active",
            WaitlistRequest.party_size <= open_slot.party_size_cap,
            WaitlistRequest.time_start <= slot.time,
            WaitlistRequest.time_end >= slot.time,
        )
        .order_by(WaitlistRequest.created_at.asc())
        .all()
    )


def create_claim(db: Session, open_slot: OpenSlot, waitlist: WaitlistRequest) -> Claim:
    claim = Claim(
        token=secrets.token_urlsafe(24),
        open_slot_id=open_slot.id,
        waitlist_id=waitlist.id,
        expires_at=utcnow() + timedelta(seconds=CLAIM_TTL_SECONDS),
        status="active",
    )
    db.add(claim)
    waitlist.status = "offered"
    db.commit()
    db.refresh(claim)
    return claim


def send_claim_email(db: Session, waitlist: WaitlistRequest, claim: Claim) -> tuple[bool, str]:
    open_slot = db.get(OpenSlot, claim.open_slot_id)
    slot = db.get(Slot, open_slot.slot_id) if open_slot else None
    restaurant = restaurant_name(db, waitlist.restaurant_id)
    url = f"{APP_BASE_URL}/claim/{claim.token}"
    subject = f"[{restaurant}] 예약 가능 알림"
    body = (
        f"{waitlist.guest_name}님 안녕하세요.\n\n"
        f"대기하신 시간에 자리가 생겼습니다.\n"
        f"- 식당: {restaurant}\n"
        f"- 날짜: {slot.day.isoformat() if slot else '-'}\n"
        f"- 시간: {slot.time.strftime('%H:%M') if slot else '-'}\n"
        f"- 인원: {waitlist.party_size}명\n"
        f"- 수락 링크: {url}\n\n"
        f"오퍼는 {CLAIM_TTL_SECONDS // 60}분 동안 유효합니다."
    )
    ok, detail = send_email(waitlist.guest_email, subject, body)
    db.add(
        NotificationLog(
            waitlist_id=waitlist.id,
            claim_id=claim.id,
            channel="email",
            result="sent" if ok else "failed",
            detail=detail,
        )
    )
    db.commit()
    return ok, detail


def dispatch_next_waitlister(db: Session, open_slot: OpenSlot) -> dict:
    if not open_slot.is_active:
        return {"ok": False, "reason": "open_slot_inactive"}

    active_claim = (
        db.query(Claim)
        .filter(Claim.open_slot_id == open_slot.id, Claim.status == "active")
        .first()
    )
    if active_claim:
        return {"ok": True, "reason": "claim_already_active", "claim_token": active_claim.token}

    for waitlist in match_waitlists(db, open_slot):
        duplicate = (
            db.query(Claim)
            .filter(Claim.waitlist_id == waitlist.id, Claim.status == "active")
            .first()
        )
        if duplicate:
            continue

        claim = create_claim(db, open_slot, waitlist)
        ok, detail = send_claim_email(db, waitlist, claim)
        return {
            "ok": ok,
            "claim_token": claim.token,
            "waitlist_id": waitlist.id,
            "detail": detail,
        }

    return {"ok": True, "reason": "no_matching_waitlisters"}


def create_pending_reservation_and_payment(
    db: Session,
    restaurant_id: int,
    slot_id: int,
    party_size: int,
    guest_name: str,
    guest_email: str,
    phone_number: str | None = None,
    source_open_slot_id: int | None = None,
) -> dict:
    normalized_email = normalize_email(guest_email)
    normalized_phone = normalize_phone(phone_number)
    duplicate_reservation = find_duplicate_reservation(
        db,
        restaurant_id,
        slot_id,
        normalized_email,
        normalized_phone,
    )
    if duplicate_reservation:
        return {
            "ok": False,
            "reason": "duplicate_reservation",
            "existing_reservation_id": duplicate_reservation.id,
        }

    tables = find_best_tables(db, restaurant_id, slot_id, party_size, max_tables=3)
    if not tables:
        return {"ok": False, "reason": "fully_booked"}

    reservation = Reservation(
        restaurant_id=restaurant_id,
        slot_id=slot_id,
        party_size=party_size,
        guest_name=guest_name,
        guest_email=normalized_email,
        phone_number=normalized_phone,
        status="pending",
        source_open_slot_id=source_open_slot_id,
    )
    db.add(reservation)
    db.commit()
    db.refresh(reservation)

    for table in tables:
        db.add(ReservationTable(reservation_id=reservation.id, table_id=table.id))
    db.commit()

    payment = Payment(
        token=secrets.token_urlsafe(24),
        reservation_id=reservation.id,
        amount=DEPOSIT_PER_PERSON * party_size,
        status="pending",
        expires_at=utcnow() + timedelta(seconds=PAYMENT_TTL_SECONDS),
    )
    db.add(payment)

    if source_open_slot_id:
        open_slot = db.get(OpenSlot, source_open_slot_id)
        if open_slot:
            open_slot.is_active = False

    db.commit()
    refresh_slot_open_state(db, slot_id)
    db.refresh(payment)
    return {
        "ok": True,
        "reservation_id": reservation.id,
        "payment_token": payment.token,
        "amount": payment.amount,
        "tables": [table.name for table in tables],
    }


def accept_claim_and_create_payment(db: Session, claim_token: str) -> dict:
    claim = db.query(Claim).filter(Claim.token == claim_token).first()
    if not claim:
        return {"ok": False, "reason": "claim_not_found"}
    if claim.status != "active":
        return {"ok": False, "reason": f"claim_not_active:{claim.status}"}
    if claim.expires_at < utcnow():
        claim.status = "expired"
        db.commit()
        return {"ok": False, "reason": "claim_expired"}

    waitlist = db.get(WaitlistRequest, claim.waitlist_id)
    open_slot = db.get(OpenSlot, claim.open_slot_id)
    if not waitlist or not open_slot or not open_slot.is_active:
        return {"ok": False, "reason": "offer_unavailable"}

    claim.status = "accepted"
    waitlist.status = "fulfilled"
    db.commit()

    result = create_pending_reservation_and_payment(
        db,
        restaurant_id=open_slot.restaurant_id,
        slot_id=open_slot.slot_id,
        party_size=waitlist.party_size,
        guest_name=waitlist.guest_name,
        guest_email=waitlist.guest_email,
        phone_number=waitlist.phone_number,
        source_open_slot_id=open_slot.id,
    )

    if result.get("ok"):
        return result

    if result.get("reason") == "duplicate_reservation":
        claim.status = "cancelled"
        waitlist.status = "cancelled"
    else:
        claim.status = "expired"
        waitlist.status = "active"
    open_slot.is_active = True
    db.commit()
    dispatch_next_waitlister(db, open_slot)
    return result


def complete_payment_and_confirm_reservation(db: Session, payment_token: str) -> dict:
    payment = db.query(Payment).filter(Payment.token == payment_token).first()
    if not payment:
        return {"ok": False, "reason": "payment_not_found"}
    if payment.status != "pending":
        return {"ok": False, "reason": f"payment_not_pending:{payment.status}"}
    if payment.expires_at < utcnow():
        payment.status = "expired"
        db.commit()
        return {"ok": False, "reason": "payment_expired"}

    reservation = db.get(Reservation, payment.reservation_id)
    if not reservation or reservation.status != "pending":
        payment.status = "failed"
        db.commit()
        return {"ok": False, "reason": "reservation_invalid"}

    payment.status = "paid"
    reservation.status = "confirmed"
    db.commit()
    refresh_slot_open_state(db, reservation.slot_id)
    return {"ok": True, "reservation_id": reservation.id}


def cancel_reservation_and_dispatch(db: Session, reservation_id: int) -> dict:
    reservation = db.get(Reservation, reservation_id)
    if not reservation:
        return {"ok": False, "reason": "reservation_not_found"}
    if reservation.status == "cancelled":
        return {"ok": True, "reason": "already_cancelled"}

    reservation.status = "cancelled"
    db.commit()

    payment = (
        db.query(Payment)
        .filter(Payment.reservation_id == reservation.id)
        .order_by(Payment.created_at.desc())
        .first()
    )
    if payment:
        if payment.status == "paid":
            payment.status = "refunded"
        elif payment.status == "pending":
            payment.status = "failed"
        db.commit()

    open_slot = _upsert_open_slot(db, reservation)
    refresh_slot_open_state(db, reservation.slot_id)
    dispatch_result = dispatch_next_waitlister(db, open_slot)
    return {"ok": True, "reservation_id": reservation.id, "dispatch": dispatch_result}


def expire_claims_and_escalate(db: Session) -> int:
    claims = db.query(Claim).filter(Claim.status == "active", Claim.expires_at < utcnow()).all()
    processed = 0
    for claim in claims:
        claim.status = "expired"
        waitlist = db.get(WaitlistRequest, claim.waitlist_id)
        if waitlist and waitlist.status == "offered":
            waitlist.status = "active"
        db.commit()
        open_slot = db.get(OpenSlot, claim.open_slot_id)
        if open_slot and open_slot.is_active:
            dispatch_next_waitlister(db, open_slot)
        processed += 1
    return processed


def expire_payments_and_release(db: Session) -> int:
    payments = db.query(Payment).filter(Payment.status == "pending", Payment.expires_at < utcnow()).all()
    processed = 0
    for payment in payments:
        payment.status = "expired"
        reservation = db.get(Reservation, payment.reservation_id)
        if not reservation:
            db.commit()
            processed += 1
            continue
        reservation.status = "cancelled"
        db.commit()

        if reservation.source_open_slot_id:
            restored = db.get(OpenSlot, reservation.source_open_slot_id)
            if restored:
                restored.is_active = True
                restored.party_size_cap = max(restored.party_size_cap, reservation.party_size)
                db.commit()
                refresh_slot_open_state(db, reservation.slot_id)
                dispatch_next_waitlister(db, restored)
            else:
                open_slot = _upsert_open_slot(db, reservation)
                refresh_slot_open_state(db, reservation.slot_id)
                dispatch_next_waitlister(db, open_slot)
        else:
            open_slot = _upsert_open_slot(db, reservation)
            refresh_slot_open_state(db, reservation.slot_id)
            dispatch_next_waitlister(db, open_slot)
        processed += 1
    return processed


def payment_summary(db: Session, payment: Payment) -> dict:
    reservation = db.get(Reservation, payment.reservation_id)
    pairs = db.query(ReservationTable).filter(ReservationTable.reservation_id == payment.reservation_id).all()
    table_ids = [pair.table_id for pair in pairs]
    tables = db.query(DiningTable).filter(DiningTable.id.in_(table_ids)).all() if table_ids else []
    return {
        "token": payment.token,
        "reservation_id": payment.reservation_id,
        "amount": payment.amount,
        "status": payment.status,
        "expires_at": payment.expires_at,
        "tables": [table.name for table in tables],
        "guest_name": reservation.guest_name if reservation else None,
    }
