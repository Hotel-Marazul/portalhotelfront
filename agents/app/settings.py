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
    backend_bearer_token: str | None
    backend_timeout_seconds: float
    rag_top_k: int
    rag_knowledge_dir: Path
    log_file_path: Path
    agno_enabled: bool
    openai_api_key: str | None
    openai_model: str


def load_settings() -> Settings:
    rag_dir_env = os.getenv("RAG_KNOWLEDGE_DIR", "").strip()
    log_file_env = os.getenv("LOG_FILE_PATH", "").strip()
    agno_enabled_raw = os.getenv("AGNO_ENABLED", "true").strip().lower()

    return Settings(
        node_env=os.getenv("NODE_ENV", "development"),
        agents_port=_env_int("AGENTS_PORT", 5050),
        backend_base_url=os.getenv("BACKEND_BASE_URL", "http://localhost:5000/api").rstrip("/"),
        backend_bearer_token=os.getenv("BACKEND_BEARER_TOKEN") or None,
        backend_timeout_seconds=_env_float("BACKEND_TIMEOUT_SECONDS", 10.0),
        rag_top_k=_env_int("RAG_TOP_K", 3),
        rag_knowledge_dir=Path(rag_dir_env) if rag_dir_env else (BASE_DIR / "rag" / "knowledge"),
        log_file_path=Path(log_file_env) if log_file_env else (BASE_DIR / "logs" / "agents.log"),
        agno_enabled=agno_enabled_raw not in {"0", "false", "no", "off"},
        openai_api_key=os.getenv("OPENAI_API_KEY") or None,
        openai_model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
    )


settings = load_settings()
