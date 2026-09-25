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


def _env_float(name: str, default: float) -> float:
    value = os.getenv(name)
    if not value:
        return default
    try:
        return float(value)
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    node_env: str
    agents_port: int
    backend_base_url: str
    backend_bearer_token: str
    agents_api_key: str
    backend_timeout_seconds: float
    rag_top_k: int
    rag_knowledge_dir: Path
    log_file_path: Path
    agno_enabled: bool
    agents_mutations_enabled: bool
    openai_api_key: str | None
    openai_model: str
    whatsapp_ai_model: str
    whatsapp_ai_reasoning_effort: str | None


def load_settings() -> Settings:
    backend_bearer_token = (os.getenv("BACKEND_BEARER_TOKEN") or "").strip()
    if not backend_bearer_token:
        raise RuntimeError(
            "BACKEND_BEARER_TOKEN is required but not set. "
            "Set it in your .env file (agents service). "
            "Refusing to start without authentication configured."
        )

    agents_api_key = (os.getenv("AGENTS_API_KEY") or "").strip()
    if len(agents_api_key) < 32:
        raise RuntimeError("AGENTS_API_KEY is required and must have at least 32 characters. Refusing to start.")

    rag_dir_env = os.getenv("RAG_KNOWLEDGE_DIR", "").strip()
    log_file_env = os.getenv("LOG_FILE_PATH", "").strip()
    agno_enabled_raw = os.getenv("AGNO_ENABLED", "true").strip().lower()
    mutations_enabled_raw = os.getenv("AGENTS_MUTATIONS_ENABLED", "true").strip().lower()

    return Settings(
        node_env=os.getenv("NODE_ENV", "development"),
        agents_port=_env_int("AGENTS_PORT", 5050),
        backend_base_url=os.getenv("BACKEND_BASE_URL", "http://localhost:5000/api").rstrip("/"),
        backend_bearer_token=backend_bearer_token,
        agents_api_key=agents_api_key,
        backend_timeout_seconds=_env_float("BACKEND_TIMEOUT_SECONDS", 10.0),
        rag_top_k=_env_int("RAG_TOP_K", 3),
        rag_knowledge_dir=Path(rag_dir_env) if rag_dir_env else (BASE_DIR / "rag" / "knowledge"),
        log_file_path=Path(log_file_env) if log_file_env else (BASE_DIR / "logs" / "agents.log"),
        agno_enabled=agno_enabled_raw not in {"0", "false", "no", "off"},
        agents_mutations_enabled=mutations_enabled_raw in {"1", "true", "yes", "on"},
        openai_api_key=os.getenv("OPENAI_API_KEY") or None,
        openai_model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        whatsapp_ai_model=os.getenv("WHATSAPP_AI_MODEL") or os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        whatsapp_ai_reasoning_effort=(os.getenv("WHATSAPP_AI_REASONING_EFFORT") or "").strip() or None,
    )


settings = load_settings()
