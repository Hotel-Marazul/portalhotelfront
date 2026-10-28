from __future__ import annotations

from datetime import datetime, timezone
from zoneinfo import ZoneInfo


def hotel_clock_context(hotel_timezone: str) -> dict[str, str]:
    now = datetime.now(timezone.utc).astimezone(ZoneInfo(hotel_timezone))
    return {
        "hotelNow": now.isoformat(timespec="seconds"),
        "hotelToday": now.date().isoformat(),
        "timezone": hotel_timezone,
    }
