from __future__ import annotations

import json
import logging
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


def log_event(event: str, **payload: Any) -> None:
    logger.info(
        json.dumps(
            {
                "event": event,
                **payload,
            },
            ensure_ascii=False,
        )
    )

