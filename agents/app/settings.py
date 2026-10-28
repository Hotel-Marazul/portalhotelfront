from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

try:
    from dotenv import load_dotenv
except Exception:  # pragma: no cover
    load_dotenv = None


BASE_DIR = Path(__file__).resolve().parents[1]
if load_dotenv is not None:
    load_dotenv(BASE_DIR / ".env", override=False)


def _env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if not value:
        return default
    try:
        return int(value)
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    node_env: str
    agents_port: int
    agents_api_key: str
    rag_top_k: int
    rag_knowledge_dir: Path
    log_file_path: Path
    openai_api_key: str | None
    openai_model: str
    whatsapp_ai_model: str
    whatsapp_ai_reasoning_effort: str | None


def load_settings() -> Settings:
    agents_api_key = (os.getenv("AGENTS_API_KEY") or "").strip()
    if len(agents_api_key) < 32:
        raise RuntimeError("AGENTS_API_KEY is required and must have at least 32 characters. Refusing to start.")

    rag_dir_env = os.getenv("RAG_KNOWLEDGE_DIR", "").strip()
    log_file_env = os.getenv("LOG_FILE_PATH", "").strip()

    return Settings(
        node_env=os.getenv("NODE_ENV", "development"),
        agents_port=_env_int("AGENTS_PORT", 5050),
        agents_api_key=agents_api_key,
        rag_top_k=_env_int("RAG_TOP_K", 3),
        rag_knowledge_dir=Path(rag_dir_env) if rag_dir_env else (BASE_DIR / "rag" / "knowledge"),
        log_file_path=Path(log_file_env) if log_file_env else (BASE_DIR / "logs" / "agents.log"),
        openai_api_key=os.getenv("OPENAI_API_KEY") or None,
        openai_model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        whatsapp_ai_model=os.getenv("WHATSAPP_AI_MODEL") or os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        whatsapp_ai_reasoning_effort=(os.getenv("WHATSAPP_AI_REASONING_EFFORT") or "").strip() or None,
    )


settings = load_settings()
