from __future__ import annotations

import itertools
from dataclasses import dataclass

from sqlalchemy.orm import Session

from .models import DiningTable, Reservation, ReservationTable, Slot


@dataclass
class TableCandidate:
    tables: list[DiningTable]
    capacity: int
    waste: int


def get_reserved_table_ids(db: Session, slot_id: int) -> set[int]:
    reservation_ids = [
        row.id
        for row in db.query(Reservation)
        .filter(Reservation.slot_id == slot_id, Reservation.status.in_(["pending", "confirmed"]))
        .all()
    ]
    if not reservation_ids:
        return set()

    assignments = db.query(ReservationTable).filter(ReservationTable.reservation_id.in_(reservation_ids)).all()
    return {assignment.table_id for assignment in assignments}


def _combo_allowed(combo: tuple[DiningTable, ...]) -> bool:
    if len(combo) <= 1:
        return True

    groups = {table.combinable_group for table in combo if table.combinable_group}
    if len(groups) == 1 and len(groups) == len(combo):
        return True
    return False


def find_best_tables(
    db: Session,
    restaurant_id: int,
    slot_id: int,
    party_size: int,
    max_tables: int = 3,
) -> list[DiningTable] | None:
    reserved_ids = get_reserved_table_ids(db, slot_id)
    tables = (
        db.query(DiningTable)
        .filter(DiningTable.restaurant_id == restaurant_id, DiningTable.is_active.is_(True))
        .all()
    )
    available = [table for table in tables if table.id not in reserved_ids]
    if not available:
        return None

    best: TableCandidate | None = None
    for count in range(1, min(max_tables, len(available)) + 1):
        for combo in itertools.combinations(available, count):
            if not _combo_allowed(combo):
                continue
            capacity = sum(table.capacity for table in combo)
            if capacity < party_size:
                continue
            candidate = TableCandidate(list(combo), capacity, capacity - party_size)
            if best is None:
                best = candidate
                continue
            if candidate.waste < best.waste:
                best = candidate
            elif candidate.waste == best.waste and len(candidate.tables) < len(best.tables):
                best = candidate

    return best.tables if best else None


def slot_has_available_tables(db: Session, restaurant_id: int, slot_id: int) -> bool:
    reserved_ids = get_reserved_table_ids(db, slot_id)
    tables = (
        db.query(DiningTable)
        .filter(DiningTable.restaurant_id == restaurant_id, DiningTable.is_active.is_(True))
        .all()
    )
    return any(table.id not in reserved_ids for table in tables)


def refresh_slot_open_state(db: Session, slot_id: int) -> bool:
    slot = db.get(Slot, slot_id)
    if not slot:
        return False
    slot.is_open = slot_has_available_tables(db, slot.restaurant_id, slot_id)
    db.commit()
    return slot.is_open
