from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any


ISO_DATE_PATTERN = re.compile(r"\b(\d{4}-\d{2}-\d{2})\b")
BR_DATE_PATTERN = re.compile(r"\b(\d{2})/(\d{2})(?:/(\d{4}))?\b")
UUID_PATTERN = re.compile(
    r"\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\b"
)
GUESTS_PATTERN = re.compile(r"\b(\d{1,2})\s*(?:pessoas?|h[oó]spedes?)\b", re.IGNORECASE)


def normalize_text(value: str) -> str:
    return value.strip().lower()


def parse_date(value: str) -> datetime:
    return datetime.strptime(value, "%Y-%m-%d")


def date_to_backend_iso(value: str) -> str:
    parsed = parse_date(value).replace(tzinfo=timezone.utc)
    return parsed.isoformat().replace("+00:00", "Z")


def extract_dates(message: str) -> tuple[str | None, str | None]:
    iso_dates = ISO_DATE_PATTERN.findall(message)
    if len(iso_dates) >= 2:
        return iso_dates[0], iso_dates[1]

    br_dates = BR_DATE_PATTERN.findall(message)
    if len(br_dates) >= 2:
        current_year = datetime.now().year

        def to_iso(part: tuple[str, str, str]) -> str:
            day, month, year = part
            final_year = int(year) if year else current_year
            return f"{final_year:04d}-{int(month):02d}-{int(day):02d}"

        return to_iso(br_dates[0]), to_iso(br_dates[1])

    return None, None


def extract_guest_count(message: str) -> int | None:
    match = GUESTS_PATTERN.search(message)
    if not match:
        return None
    return int(match.group(1))


def extract_reservation_id(message: str) -> str | None:
    match = UUID_PATTERN.search(message)
    if not match:
        return None
    return match.group(0)


def validate_period(check_in: str | None, check_out: str | None) -> bool:
    if not check_in or not check_out:
        return False
    try:
        in_date = parse_date(check_in)
        out_date = parse_date(check_out)
    except ValueError:
        return False
    return out_date > in_date


def missing_booking_fields(extracted: dict[str, Any]) -> list[str]:
    missing: list[str] = []
    if not extracted.get("check_in"):
        missing.append("check_in")
    if not extracted.get("check_out"):
        missing.append("check_out")
    if not extracted.get("client_id"):
        missing.append("client_id")
    return missing

