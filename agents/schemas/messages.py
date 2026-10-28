from __future__ import annotations

from pydantic import BaseModel


class EvidenceItem(BaseModel):
    source: str
    excerpt: str | None = None
