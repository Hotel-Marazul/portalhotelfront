from __future__ import annotations

import json
import logging
import re
from pathlib import Path
from typing import Any

from app.settings import settings


def configure_logger() -> logging.Logger:
    logger = logging.getLogger("agents")
    if logger.handlers:
        return logger

    logger.setLevel(logging.INFO)
    formatter = logging.Formatter("%(message)s")

    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(formatter)
    logger.addHandler(stream_handler)

    log_path = Path(settings.log_file_path)
    log_path.parent.mkdir(parents=True, exist_ok=True)
    file_handler = logging.FileHandler(log_path, encoding="utf-8")
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

    return logger


logger = configure_logger()

SENSITIVE_KEY = re.compile(
    r"(cpf|token|secret|cookie|authorization|password|payment|amount|api[_-]?key|credential|bearer)",
    re.IGNORECASE,
)
CPF_PATTERN = re.compile(r"(?<!\d)\d{3}[.\s-]?\d{3}[.\s-]?\d{3}[.\s-]?\d{2}(?!\d)")
SENSITIVE_TEXT_PATTERN = re.compile(
    r"\b(?:bearer|token|api[_-]?key|password|cookie|secret|credential)\s*[:=]\s*[^\s,;]+",
    re.IGNORECASE,
)


def sanitize_log_value(value: Any, key: str = "") -> Any:
    if SENSITIVE_KEY.search(key):
        return "[redacted]"
    if isinstance(value, dict):
        return {str(item_key): sanitize_log_value(item_value, str(item_key)) for item_key, item_value in value.items()}
    if isinstance(value, list):
        return [sanitize_log_value(item) for item in value]
    if isinstance(value, str):
        sanitized = CPF_PATTERN.sub("[redacted-cpf]", value)
        return SENSITIVE_TEXT_PATTERN.sub("[redacted-secret]", sanitized)[:500]
    return value


def log_event(event: str, **payload: Any) -> None:
    logger.info(
        json.dumps(
            {
                "event": event,
                **sanitize_log_value(payload),
            },
            ensure_ascii=False,
        )
    )
