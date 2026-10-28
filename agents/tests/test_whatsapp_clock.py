from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

sys.path.append(str(Path(__file__).resolve().parents[1]))

from whatsapp.clock import hotel_clock_context


def test_clock_uses_hotel_day_and_offset_at_utc_midnight() -> None:
    with patch("whatsapp.clock.datetime") as clock:
        clock.now.return_value = datetime(2027, 1, 1, 1, 30, tzinfo=timezone.utc)
        context = hotel_clock_context("America/Sao_Paulo")
    assert context == {
        "hotelNow": "2026-12-31T22:30:00-03:00",
        "hotelToday": "2026-12-31",
        "timezone": "America/Sao_Paulo",
    }


def test_clock_refreshes_for_each_call() -> None:
    with patch("whatsapp.clock.datetime") as clock:
        clock.now.side_effect = [
            datetime(2026, 10, 27, 12, tzinfo=timezone.utc),
            datetime(2026, 10, 28, 12, tzinfo=timezone.utc),
        ]
        first = hotel_clock_context("America/Sao_Paulo")
        second = hotel_clock_context("America/Sao_Paulo")
    assert first["hotelToday"] == "2026-10-27"
    assert second["hotelToday"] == "2026-10-28"
