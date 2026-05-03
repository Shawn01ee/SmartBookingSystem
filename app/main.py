from __future__ import annotations

from datetime import date, timedelta, time
from pathlib import Path

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from .config import ADMIN_TOKEN, APP_NAME, DEV_FALLBACK_ADMIN_TOKEN, IS_VERCEL
from .emailer import send_email
from .db import ENGINE, SessionLocal
from .engine import (
    accept_claim_and_create_payment,
    cancel_reservation_and_dispatch,
    confirm_email_verification,
    create_email_verification,
    complete_payment_and_confirm_reservation,
    create_pending_reservation_and_payment,
    dispatch_next_waitlister,
    expire_claims_and_escalate,
    expire_payments_and_release,
    find_duplicate_waitlist,
    find_existing_reservation_in_window,
    has_recent_email_verification,
    normalize_email,
    normalize_phone,
    payment_summary,
    restaurant_name,
)
from .models import Base, Claim, DiningTable, NotificationLog, OpenSlot, Payment, Reservation, ReservationTable, Restaurant, Slot, WaitlistRequest
from .schemas import (
    AdminSessionIn,
    ClaimOut,
    EmailVerificationConfirmIn,
    EmailVerificationRequestIn,
    OpenSlotCreate,
    PaymentOut,
    ReservationCreate,
    RestaurantCreate,
    SlotCreate,
    TableCreate,
    WaitlistCreate,
)
from .table_assignment import refresh_slot_open_state


BASE_PATH = Path(__file__).resolve().parent
STATIC_PATH = BASE_PATH / "static"
FRONTEND_PATH = BASE_PATH.parent / "frontend"
FRONTEND_DIST_PATH = FRONTEND_PATH / "dist"
FRONTEND_ASSETS_PATH = FRONTEND_DIST_PATH / "assets"

app = FastAPI(title=APP_NAME)
if STATIC_PATH.exists():
    app.mount("/static", StaticFiles(directory=STATIC_PATH), name="static")
app.mount("/assets", StaticFiles(directory=FRONTEND_ASSETS_PATH, check_dir=False), name="assets")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def require_admin(x_admin_token: str = Header(..., alias="X-Admin-Token")) -> str:
    if x_admin_token not in {ADMIN_TOKEN, DEV_FALLBACK_ADMIN_TOKEN}:
        raise HTTPException(status_code=401, detail="Invalid admin token")
    return x_admin_token


def serialize_restaurant(restaurant: Restaurant) -> dict:
    return {
        "id": restaurant.id,
        "name": restaurant.name,
        "description": restaurant.description,
        "contact_email": restaurant.contact_email,
    }


def serialize_slot(slot: Slot) -> dict:
    return {
        "id": slot.id,
        "day": slot.day.isoformat(),
        "time": slot.time.strftime("%H:%M:%S"),
        "is_open": slot.is_open,
    }


def serialize_dashboard(db: Session) -> dict:
    restaurants = db.query(Restaurant).order_by(Restaurant.name.asc()).all()
    slots = db.query(Slot).order_by(Slot.day.asc(), Slot.time.asc()).all()
    waitlists = db.query(WaitlistRequest).order_by(WaitlistRequest.created_at.desc()).limit(100).all()
    logs = db.query(NotificationLog).order_by(NotificationLog.sent_at.desc()).limit(100).all()

    slot_cards = []
    for slot in slots:
        reservations = (
            db.query(Reservation)
            .filter(Reservation.slot_id == slot.id)
            .order_by(Reservation.created_at.desc())
            .all()
        )
        open_slot = (
            db.query(OpenSlot)
            .filter(OpenSlot.slot_id == slot.id, OpenSlot.is_active.is_(True))
            .first()
        )
        reservation_rows = []
        for reservation in reservations:
            assignments = db.query(ReservationTable).filter(ReservationTable.reservation_id == reservation.id).all()
            table_ids = [assignment.table_id for assignment in assignments]
            tables = db.query(DiningTable).filter(DiningTable.id.in_(table_ids)).all() if table_ids else []
            payment = (
                db.query(Payment)
                .filter(Payment.reservation_id == reservation.id)
                .order_by(Payment.created_at.desc())
                .first()
            )
            reservation_rows.append(
                {
                    "id": reservation.id,
                    "guest_name": reservation.guest_name,
                    "guest_email": reservation.guest_email,
                    "phone_number": reservation.phone_number,
                    "party_size": reservation.party_size,
                    "status": reservation.status,
                    "tables": [table.name for table in tables],
                    "payment_status": payment.status if payment else None,
                }
            )

        slot_cards.append(
            {
                "slot_id": slot.id,
                "restaurant_id": slot.restaurant_id,
                "restaurant_name": restaurant_name(db, slot.restaurant_id),
                "day": slot.day.isoformat(),
                "time": slot.time.strftime("%H:%M"),
                "is_open": slot.is_open,
                "open_slot": {
                    "id": open_slot.id,
                    "party_size_cap": open_slot.party_size_cap,
                }
                if open_slot
                else None,
                "reservations": reservation_rows,
            }
        )

    return {
        "restaurants": [serialize_restaurant(restaurant) for restaurant in restaurants],
        "tables": [
            {
                "id": table.id,
                "restaurant_id": table.restaurant_id,
                "name": table.name,
                "capacity": table.capacity,
                "combinable_group": table.combinable_group,
                "is_active": table.is_active,
            }
            for table in db.query(DiningTable).order_by(DiningTable.restaurant_id.asc(), DiningTable.capacity.asc()).all()
        ],
        "slots": slot_cards,
        "waitlists": [
            {
                "id": waitlist.id,
                "restaurant_id": waitlist.restaurant_id,
                "restaurant_name": restaurant_name(db, waitlist.restaurant_id),
                "day": waitlist.day.isoformat(),
                "time_start": waitlist.time_start.strftime("%H:%M"),
                "time_end": waitlist.time_end.strftime("%H:%M"),
                "party_size": waitlist.party_size,
                "guest_name": waitlist.guest_name,
                "guest_email": waitlist.guest_email,
                "phone_number": waitlist.phone_number,
                "status": waitlist.status,
                "notes": waitlist.notes,
            }
            for waitlist in waitlists
        ],
        "logs": [
            {
                "id": log.id,
                "waitlist_id": log.waitlist_id,
                "claim_id": log.claim_id,
                "channel": log.channel,
                "result": log.result,
                "detail": log.detail,
                "sent_at": log.sent_at.isoformat() + "Z",
            }
            for log in logs
        ],
    }


SLOT_TIMES = [time(12, 0), time(13, 0), time(18, 0), time(19, 0), time(20, 0)]


def _ensure_weekly_slots(db: Session, restaurant: Restaurant) -> None:
    today = date.today()
    changed = False
    for offset in range(7):
        day = today + timedelta(days=offset)
        for slot_time in SLOT_TIMES:
            exists = (
                db.query(Slot)
                .filter(Slot.restaurant_id == restaurant.id, Slot.day == day, Slot.time == slot_time)
                .first()
            )
            if not exists:
                db.add(Slot(restaurant_id=restaurant.id, day=day, time=slot_time, is_open=True))
                changed = True
    if changed:
        db.commit()


def seed_demo_data(db: Session) -> None:
    existing_mosu = db.query(Restaurant).filter(Restaurant.name == "Mosu Seoul").first()
    if existing_mosu:
        _ensure_weekly_slots(db, existing_mosu)
        return

    legacy_demo = db.query(Restaurant).filter(Restaurant.name.in_(["Seoul Table", "MOSU"])).first()
    if legacy_demo:
        legacy_demo.name = "Mosu Seoul"
        legacy_demo.contact_email = "ops@mosuseoul.local"
        legacy_demo.description = "Fine dining demo restaurant for smart scheduling."
        db.commit()
        _ensure_weekly_slots(db, legacy_demo)
        return

    restaurant = Restaurant(
        name="Mosu Seoul",
        description="Fine dining demo restaurant for smart scheduling.",
        contact_email="ops@mosuseoul.local",
    )
    db.add(restaurant)
    db.commit()
    db.refresh(restaurant)

    tables = [
        DiningTable(restaurant_id=restaurant.id, name="T1", capacity=2, combinable_group="window"),
        DiningTable(restaurant_id=restaurant.id, name="T2", capacity=2, combinable_group="window"),
        DiningTable(restaurant_id=restaurant.id, name="T3", capacity=4, combinable_group=None),
        DiningTable(restaurant_id=restaurant.id, name="T4", capacity=4, combinable_group="hall"),
        DiningTable(restaurant_id=restaurant.id, name="T5", capacity=4, combinable_group="hall"),
        DiningTable(restaurant_id=restaurant.id, name="T6", capacity=6, combinable_group=None),
    ]
    db.add_all(tables)
    db.commit()

    _ensure_weekly_slots(db, restaurant)


class DispatchIn(BaseModel):
    slot_id: int


def ensure_schema() -> None:
    with ENGINE.begin() as connection:
        table_names = set(inspect(connection).get_table_names())
        if "reservations" in table_names:
            reservation_columns = {column["name"] for column in inspect(connection).get_columns("reservations")}
            if "phone_number" not in reservation_columns:
                connection.execute(text("ALTER TABLE reservations ADD COLUMN phone_number VARCHAR(32)"))
        if "waitlist_requests" in table_names:
            waitlist_columns = {column["name"] for column in inspect(connection).get_columns("waitlist_requests")}
            if "phone_number" not in waitlist_columns:
                connection.execute(text("ALTER TABLE waitlist_requests ADD COLUMN phone_number VARCHAR(32)"))


def sync_all_slot_open_states(db: Session) -> None:
    slots = db.query(Slot).all()
    for slot in slots:
        refresh_slot_open_state(db, slot.id)


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=ENGINE)
    ensure_schema()
    db = SessionLocal()
    try:
        seed_demo_data(db)
        sync_all_slot_open_states(db)
    finally:
        db.close()

    if not IS_VERCEL:
        scheduler = BackgroundScheduler()
        scheduler.add_job(engine_tick, "interval", seconds=20)
        scheduler.start()
        app.state.scheduler = scheduler


@app.on_event("shutdown")
def on_shutdown() -> None:
    scheduler: BackgroundScheduler | None = getattr(app.state, "scheduler", None)
    if scheduler:
        scheduler.shutdown(wait=False)


def engine_tick() -> None:
    db = SessionLocal()
    try:
        expire_claims_and_escalate(db)
        expire_payments_and_release(db)
    finally:
        db.close()


@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "service": APP_NAME}


@app.post("/api/admin/session")
def create_admin_session(payload: AdminSessionIn) -> dict:
    if payload.token not in {ADMIN_TOKEN, DEV_FALLBACK_ADMIN_TOKEN}:
        raise HTTPException(status_code=401, detail="Invalid token")
    return {"ok": True}


@app.post("/api/public/email-verifications/request")
def request_email_verification(
    payload: EmailVerificationRequestIn,
    db: Session = Depends(get_db),
) -> dict:
    result = create_email_verification(db, str(payload.email))
    if not result.get("ok"):
        raise HTTPException(status_code=500, detail="인증 메일 발송에 실패했습니다.")
    return {"ok": True, "expires_at": result["expires_at"]}


@app.post("/api/public/email-verifications/confirm")
def confirm_public_email_verification(
    payload: EmailVerificationConfirmIn,
    db: Session = Depends(get_db),
) -> dict:
    result = confirm_email_verification(db, str(payload.email), payload.code)
    if not result.get("ok"):
        reason = result.get("reason")
        if reason == "verification_expired":
            raise HTTPException(status_code=400, detail="인증번호가 만료되었습니다.")
        if reason == "verification_code_mismatch":
            raise HTTPException(status_code=400, detail="인증번호가 올바르지 않습니다.")
        raise HTTPException(status_code=400, detail="이메일 인증을 다시 시도해 주세요.")
    return {"ok": True}


@app.get("/api/public/restaurants")
def list_public_restaurants(db: Session = Depends(get_db)) -> list[dict]:
    restaurants = db.query(Restaurant).order_by(Restaurant.name.asc()).all()
    return [serialize_restaurant(restaurant) for restaurant in restaurants]


@app.get("/api/public/restaurants/{restaurant_id}/slots")
def list_public_slots(restaurant_id: int, db: Session = Depends(get_db)) -> list[dict]:
    slots = (
        db.query(Slot)
        .filter(Slot.restaurant_id == restaurant_id, Slot.is_open.is_(True))
        .order_by(Slot.day.asc(), Slot.time.asc())
        .all()
    )
    return [serialize_slot(slot) for slot in slots]


@app.post("/api/public/restaurants/{restaurant_id}/reservations")
def create_public_reservation(
    restaurant_id: int,
    payload: ReservationCreate,
    db: Session = Depends(get_db),
) -> dict:
    slot = db.get(Slot, payload.slot_id)
    if not slot or slot.restaurant_id != restaurant_id or not slot.is_open:
        raise HTTPException(status_code=400, detail="Invalid slot")
    if not has_recent_email_verification(db, str(payload.guest_email)):
        raise HTTPException(status_code=403, detail="예약 전 이메일 인증이 필요합니다.")

    result = create_pending_reservation_and_payment(
        db,
        restaurant_id=restaurant_id,
        slot_id=payload.slot_id,
        party_size=payload.party_size,
        guest_name=payload.guest_name,
        guest_email=str(payload.guest_email),
        phone_number=payload.phone_number,
    )
    if result.get("reason") == "duplicate_reservation":
        raise HTTPException(
            status_code=409,
            detail="이미 같은 시간에 등록된 예약이 있습니다.",
        )
    if not result.get("ok"):
        return {"ok": False, "status": "waitlist_recommended", "reason": result["reason"]}
    return {"ok": True, "status": "payment_required", **result}


@app.post("/api/public/restaurants/{restaurant_id}/waitlist")
def create_public_waitlist(
    restaurant_id: int,
    payload: WaitlistCreate,
    db: Session = Depends(get_db),
) -> dict:
    restaurant = db.get(Restaurant, restaurant_id)
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    if not has_recent_email_verification(db, str(payload.guest_email)):
        raise HTTPException(status_code=403, detail="대기 신청 전 이메일 인증이 필요합니다.")

    duplicate_waitlist = find_duplicate_waitlist(
        db,
        restaurant_id=restaurant_id,
        day=payload.day,
        time_start=payload.time_start,
        time_end=payload.time_end,
        guest_email=str(payload.guest_email),
        phone_number=payload.phone_number,
    )
    if duplicate_waitlist:
        raise HTTPException(
            status_code=409,
            detail="이미 같은 시간대의 대기 신청이 있습니다.",
        )

    existing_reservation = find_existing_reservation_in_window(
        db,
        restaurant_id=restaurant_id,
        day=payload.day,
        time_start=payload.time_start,
        time_end=payload.time_end,
        guest_email=str(payload.guest_email),
        phone_number=payload.phone_number,
    )
    if existing_reservation:
        raise HTTPException(
            status_code=409,
            detail="이미 같은 시간대에 예약이 있어서 대기 신청이 필요하지 않습니다.",
        )

    waitlist = WaitlistRequest(
        restaurant_id=restaurant_id,
        day=payload.day,
        time_start=payload.time_start,
        time_end=payload.time_end,
        party_size=payload.party_size,
        guest_name=payload.guest_name,
        guest_email=normalize_email(str(payload.guest_email)),
        phone_number=normalize_phone(payload.phone_number),
        notes=payload.notes,
        status="active",
    )
    db.add(waitlist)
    db.commit()
    db.refresh(waitlist)
    return {"ok": True, "waitlist_id": waitlist.id}


@app.get("/api/public/claims/{token}", response_model=ClaimOut)
def get_claim(token: str, db: Session = Depends(get_db)) -> ClaimOut:
    claim = db.query(Claim).filter(Claim.token == token).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    waitlist = db.get(WaitlistRequest, claim.waitlist_id)
    open_slot = db.get(OpenSlot, claim.open_slot_id)
    slot = db.get(Slot, open_slot.slot_id) if open_slot else None
    if not waitlist or not slot:
        raise HTTPException(status_code=404, detail="Claim context not found")
    return ClaimOut(
        token=claim.token,
        status=claim.status,
        expires_at=claim.expires_at,
        restaurant_name=restaurant_name(db, waitlist.restaurant_id),
        day=slot.day,
        time=slot.time,
        party_size=waitlist.party_size,
    )


@app.post("/api/public/claims/{token}/accept")
def accept_claim(token: str, db: Session = Depends(get_db)) -> dict:
    result = accept_claim_and_create_payment(db, token)
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result["reason"])
    return {"ok": True, **result}


@app.get("/api/public/payments/{token}", response_model=PaymentOut)
def get_payment(token: str, db: Session = Depends(get_db)) -> PaymentOut:
    payment = db.query(Payment).filter(Payment.token == token).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return PaymentOut(**payment_summary(db, payment))


@app.get("/api/public/my-reservations")
def get_my_reservations(email: str, db: Session = Depends(get_db)) -> dict:
    norm = normalize_email(email)
    reservations = (
        db.query(Reservation)
        .filter(Reservation.guest_email == norm, Reservation.status.in_(["confirmed", "pending"]))
        .order_by(Reservation.created_at.desc())
        .all()
    )
    waitlists = (
        db.query(WaitlistRequest)
        .filter(WaitlistRequest.guest_email == norm, WaitlistRequest.status.in_(["active", "offered"]))
        .order_by(WaitlistRequest.created_at.desc())
        .all()
    )

    res_list = []
    for r in reservations:
        slot = db.query(Slot).filter(Slot.id == r.slot_id).first()
        rest = db.query(Restaurant).filter(Restaurant.id == r.restaurant_id).first()
        assignments = db.query(ReservationTable).filter(ReservationTable.reservation_id == r.id).all()
        tables = db.query(DiningTable).filter(DiningTable.id.in_([a.table_id for a in assignments])).all() if assignments else []
        res_list.append({
            "id": r.id,
            "restaurant": rest.name if rest else "—",
            "day": slot.day.isoformat() if slot else "—",
            "time": slot.time.strftime("%H:%M") if slot else "—",
            "party_size": r.party_size,
            "status": r.status,
            "tables": [t.name for t in tables],
        })

    wait_list = []
    for w in waitlists:
        rest = db.query(Restaurant).filter(Restaurant.id == w.restaurant_id).first()
        wait_list.append({
            "id": w.id,
            "restaurant": rest.name if rest else "—",
            "day": w.day.isoformat(),
            "time": w.time_start.strftime("%H:%M"),
            "party_size": w.party_size,
            "status": w.status,
        })

    return {"reservations": res_list, "waitlists": wait_list}


@app.get("/api/public/reservations/booked-slots")
def get_booked_slots(email: str, db: Session = Depends(get_db)) -> dict:
    """Return slot IDs and days that this email already has active reservations for."""
    from .models import Reservation as Res
    reservations = (
        db.query(Res)
        .filter(Res.guest_email == normalize_email(email), Res.status == "confirmed")
        .all()
    )
    return {
        "booked_slot_ids": [r.slot_id for r in reservations],
        "booked_days": list({r.slot.day.isoformat() for r in reservations if r.slot}),
    }


@app.post("/api/public/payments/{token}/complete")
def complete_payment(token: str, db: Session = Depends(get_db)) -> dict:
    result = complete_payment_and_confirm_reservation(db, token)
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result["reason"])
    # Send confirmation email
    payment = db.query(Payment).filter(Payment.token == token).first()
    if payment:
        r = db.query(Reservation).filter(Reservation.id == payment.reservation_id).first()
    else:
        r = None
    if r:
        slot = db.query(Slot).filter(Slot.id == r.slot_id).first()
        rest = db.query(Restaurant).filter(Restaurant.id == slot.restaurant_id).first() if slot else None
        day_str = slot.day.strftime("%Y년 %m월 %d일") if slot else "—"
        time_str = slot.time.strftime("%H:%M") if slot else "—"
        rest_name = rest.name if rest else "—"
        send_email(
            r.guest_email,
            f"[{APP_NAME}] 예약이 확정되었습니다",
            f"""안녕하세요, {r.guest_name}님.

예약이 확정되었습니다.

━━━━━━━━━━━━━━━━━━━━━━━━
레스토랑  {rest_name}
날 짜     {day_str}
시 간     {time_str}
인 원     {r.party_size}명
━━━━━━━━━━━━━━━━━━━━━━━━

예약 시간 15분 전부터 입장 가능합니다.
예약 시간보다 15분 이상 늦으실 경우 예약이 취소될 수 있습니다.

감사합니다.
{APP_NAME}
""",
        )
    return result


@app.get("/api/admin/dashboard")
def admin_dashboard(
    _admin: str = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    return serialize_dashboard(db)


@app.post("/api/admin/restaurants")
def admin_create_restaurant(
    payload: RestaurantCreate,
    _admin: str = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    restaurant = Restaurant(
        name=payload.name,
        description=payload.description,
        contact_email=str(payload.contact_email) if payload.contact_email else None,
    )
    db.add(restaurant)
    db.commit()
    db.refresh(restaurant)
    return {"ok": True, "restaurant": serialize_restaurant(restaurant)}


@app.post("/api/admin/restaurants/{restaurant_id}/tables")
def admin_create_table(
    restaurant_id: int,
    payload: TableCreate,
    _admin: str = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    restaurant = db.get(Restaurant, restaurant_id)
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    table = DiningTable(
        restaurant_id=restaurant_id,
        name=payload.name,
        capacity=payload.capacity,
        combinable_group=payload.combinable_group,
        is_active=True,
    )
    db.add(table)
    db.commit()
    db.refresh(table)
    return {"ok": True, "table_id": table.id}


@app.post("/api/admin/restaurants/{restaurant_id}/slots")
def admin_create_slot(
    restaurant_id: int,
    payload: SlotCreate,
    _admin: str = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    restaurant = db.get(Restaurant, restaurant_id)
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    slot = Slot(
        restaurant_id=restaurant_id,
        day=payload.day,
        time=payload.time,
        is_open=payload.is_open,
    )
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return {"ok": True, "slot": serialize_slot(slot)}


@app.post("/api/admin/open-slots")
def admin_create_open_slot(
    payload: OpenSlotCreate,
    _admin: str = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    slot = db.get(Slot, payload.slot_id)
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    open_slot = (
        db.query(OpenSlot)
        .filter(OpenSlot.slot_id == payload.slot_id, OpenSlot.is_active.is_(True))
        .first()
    )
    if open_slot:
        open_slot.party_size_cap = max(open_slot.party_size_cap, payload.party_size_cap)
    else:
        open_slot = OpenSlot(
            restaurant_id=slot.restaurant_id,
            slot_id=payload.slot_id,
            party_size_cap=payload.party_size_cap,
            is_active=True,
        )
        db.add(open_slot)
    db.commit()
    db.refresh(open_slot)
    return {"ok": True, "open_slot_id": open_slot.id}


@app.post("/api/admin/open-slots/{open_slot_id}/dispatch")
def admin_dispatch_open_slot(
    open_slot_id: int,
    _admin: str = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    open_slot = db.get(OpenSlot, open_slot_id)
    if not open_slot:
        raise HTTPException(status_code=404, detail="Open slot not found")
    return dispatch_next_waitlister(db, open_slot, force=True)


@app.post("/api/admin/reservations/{reservation_id}/cancel")
def admin_cancel_reservation(
    reservation_id: int,
    _admin: str = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    result = cancel_reservation_and_dispatch(db, reservation_id)
    if not result.get("ok"):
        raise HTTPException(status_code=404, detail=result["reason"])
    return result


@app.delete("/api/admin/reservations/{reservation_id}")
def admin_delete_reservation(
    reservation_id: int,
    _admin: str = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    reservation = db.get(Reservation, reservation_id)
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")
    db.query(ReservationTable).filter(ReservationTable.reservation_id == reservation_id).delete()
    db.query(Payment).filter(Payment.reservation_id == reservation_id).delete()
    db.delete(reservation)
    db.commit()
    return {"ok": True}


@app.delete("/api/admin/reservations")
def admin_delete_all_reservations(
    _admin: str = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    res_ids = [r.id for r in db.query(Reservation.id).all()]
    db.query(ReservationTable).filter(ReservationTable.reservation_id.in_(res_ids)).delete(synchronize_session=False)
    db.query(Payment).filter(Payment.reservation_id.in_(res_ids)).delete(synchronize_session=False)
    db.query(Reservation).delete(synchronize_session=False)
    # Also wipe waitlist-related data
    db.query(NotificationLog).delete(synchronize_session=False)
    db.query(Claim).delete(synchronize_session=False)
    db.query(WaitlistRequest).delete(synchronize_session=False)
    db.query(OpenSlot).delete(synchronize_session=False)
    # Reset all slots to open (no confirmed reservations remain)
    db.query(Slot).update({"is_open": True}, synchronize_session=False)
    db.commit()
    return {"ok": True, "deleted": len(res_ids)}


@app.delete("/api/admin/waitlist/{waitlist_id}")
def admin_delete_waitlist(
    waitlist_id: int,
    _admin: str = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    waitlist = db.get(WaitlistRequest, waitlist_id)
    if not waitlist:
        raise HTTPException(status_code=404, detail="Waitlist request not found")
    restaurant_id = waitlist.restaurant_id
    slot_day = waitlist.day
    db.query(NotificationLog).filter(NotificationLog.waitlist_id == waitlist_id).delete(synchronize_session=False)
    db.query(Claim).filter(Claim.waitlist_id == waitlist_id).delete(synchronize_session=False)
    db.query(WaitlistRequest).filter(WaitlistRequest.id == waitlist_id).delete(synchronize_session=False)
    db.commit()
    # If no waitlists remain for this restaurant/day, deactivate matching open slots
    remaining = db.query(WaitlistRequest).filter(
        WaitlistRequest.restaurant_id == restaurant_id,
        WaitlistRequest.day == slot_day,
        WaitlistRequest.status.in_(["active", "offered"]),
    ).count()
    if remaining == 0:
        slot_ids = [s.id for s in db.query(Slot.id).filter(
            Slot.restaurant_id == restaurant_id, Slot.day == slot_day
        ).all()]
        if slot_ids:
            db.query(OpenSlot).filter(
                OpenSlot.slot_id.in_(slot_ids), OpenSlot.is_active.is_(True)
            ).update({"is_active": False}, synchronize_session=False)
            db.commit()
    return {"ok": True}


@app.delete("/api/admin/restaurants/{restaurant_id}")
def admin_delete_restaurant(
    restaurant_id: int,
    _admin: str = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    restaurant = db.get(Restaurant, restaurant_id)
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    # cascade: slots → open_slots → claims/waitlists/logs, reservations → payments/tables
    slot_ids = [s.id for s in db.query(Slot.id).filter(Slot.restaurant_id == restaurant_id).all()]
    if slot_ids:
        open_slot_ids = [o.id for o in db.query(OpenSlot.id).filter(OpenSlot.slot_id.in_(slot_ids)).all()]
        if open_slot_ids:
            db.query(Claim).filter(Claim.open_slot_id.in_(open_slot_ids)).delete(synchronize_session=False)
        db.query(OpenSlot).filter(OpenSlot.slot_id.in_(slot_ids)).delete(synchronize_session=False)
        res_ids = [r.id for r in db.query(Reservation.id).filter(Reservation.slot_id.in_(slot_ids)).all()]
        if res_ids:
            db.query(ReservationTable).filter(ReservationTable.reservation_id.in_(res_ids)).delete(synchronize_session=False)
            db.query(Payment).filter(Payment.reservation_id.in_(res_ids)).delete(synchronize_session=False)
            db.query(Reservation).filter(Reservation.id.in_(res_ids)).delete(synchronize_session=False)
        db.query(Slot).filter(Slot.id.in_(slot_ids)).delete(synchronize_session=False)
    wl_ids = [w.id for w in db.query(WaitlistRequest.id).filter(WaitlistRequest.restaurant_id == restaurant_id).all()]
    if wl_ids:
        db.query(NotificationLog).filter(NotificationLog.waitlist_id.in_(wl_ids)).delete(synchronize_session=False)
        db.query(Claim).filter(Claim.waitlist_id.in_(wl_ids)).delete(synchronize_session=False)
        db.query(WaitlistRequest).filter(WaitlistRequest.id.in_(wl_ids)).delete(synchronize_session=False)
    db.query(DiningTable).filter(DiningTable.restaurant_id == restaurant_id).delete(synchronize_session=False)
    db.delete(restaurant)
    db.commit()
    return {"ok": True}


@app.post("/api/admin/engine/run")
def admin_run_engine(
    _admin: str = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    claims = expire_claims_and_escalate(db)
    payments = expire_payments_and_release(db)
    return {"ok": True, "expired_claims": claims, "expired_payments": payments}


def spa() -> FileResponse:
    path = (FRONTEND_DIST_PATH / "index.html") if (FRONTEND_DIST_PATH / "index.html").exists() else (STATIC_PATH / "index.html")
    return FileResponse(path, headers={"Cache-Control": "no-cache, no-store, must-revalidate"})


@app.get("/")
def index() -> FileResponse:
    return spa()


@app.get("/admin")
def admin_page() -> FileResponse:
    return spa()


@app.get("/claim/{token}")
def claim_page(token: str) -> FileResponse:
    return spa()


@app.get("/pay/{token}")
def pay_page(token: str) -> FileResponse:
    return spa()
