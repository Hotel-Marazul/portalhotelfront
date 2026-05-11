from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass
class PricingEstimate:
    nights: int
    min_total: float | None
    message: str


class PricingAgent:
    def estimate(self, check_in: str, check_out: str, available_rooms: list[dict]) -> PricingEstimate:
        in_date = datetime.strptime(check_in, "%Y-%m-%d")
        out_date = datetime.strptime(check_out, "%Y-%m-%d")
        nights = max((out_date - in_date).days, 1)

        if not available_rooms:
            return PricingEstimate(
                nights=nights,
                min_total=None,
                message="Não consigo estimar preço sem quartos disponíveis no período.",
            )

        daily_prices = [float(room.get("dailyPrice", 0.0)) for room in available_rooms]
        min_daily = min(price for price in daily_prices if price > 0) if any(price > 0 for price in daily_prices) else 0
        min_total = round(min_daily * nights, 2) if min_daily > 0 else None

        if min_total is None:
            return PricingEstimate(
                nights=nights,
                min_total=None,
                message="Há disponibilidade, mas não foi possível estimar o valor com os dados atuais.",
            )

        return PricingEstimate(
            nights=nights,
            min_total=min_total,
            message=f"Estimativa mínima para {nights} diária(s): R$ {min_total:.2f}.",
        )

