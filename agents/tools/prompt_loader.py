from __future__ import annotations

from pathlib import Path


PROMPTS_DIR = Path(__file__).resolve().parents[1] / "prompts"


def load_prompt(filename: str) -> str:
    path = PROMPTS_DIR / filename
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8").strip()


def load_agno_instructions() -> list[str]:
    files = ["system.md", "receptionist.md", "decision.md", "policy.md"]
    loaded = [load_prompt(name) for name in files]
    return [text for text in loaded if text]

