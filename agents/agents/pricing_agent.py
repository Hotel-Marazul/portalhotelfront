from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass
class PricingEstimate:
    nights: int
    min_total: float | None
    message: str


class PricingAgent:
    def estimate(self, check_in: str, check_out: str, available_rooms: list[dict], guests: int = 1, meal_plan: str = "breakfast") -> PricingEstimate:
        in_date = datetime.strptime(check_in, "%Y-%m-%d")
        out_date = datetime.strptime(check_out, "%Y-%m-%d")
        nights = max((out_date - in_date).days, 1)

        if not available_rooms:
            return PricingEstimate(
                nights=nights,
                min_total=None,
                message="Não consigo estimar preço sem quartos disponíveis no período.",
            )

        # Monetary calculations and validity are authoritative in the backend.
        totals = [
            quote["totalPrice"]
            for room in available_rooms
            if isinstance((quote := room.get("pricingQuotes", {}).get(meal_plan)), dict)
            and isinstance(quote.get("totalPrice"), (int, float))
            and quote["totalPrice"] > 0
        ] if guests <= 2 else []
        min_total = min(totals) if totals else None

        if min_total is None:
            return PricingEstimate(
                nights=nights,
                min_total=None,
                message="Há disponibilidade, mas preciso de uma cotação válida do backend para o período e, havendo adicionais, das idades dos hóspedes.",
            )

        return PricingEstimate(
            nights=nights,
            min_total=min_total,
            message=f"Estimativa mínima ({'meia pensão' if meal_plan == 'half_board' else 'só café'}) para {nights} diária(s): R$ {min_total:.2f}.",
        )

