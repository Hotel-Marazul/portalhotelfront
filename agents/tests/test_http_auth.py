from __future__ import annotations

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient

from app.server import create_app
from app.settings import settings


def run_test() -> None:
    client = TestClient(create_app())
    assert client.get("/health").status_code == 401
    assert client.post("/chat", json={"conversation_id": "test-auth", "user_message": "oi"}).status_code == 401
    assert client.get("/health", headers={"X-API-Key": settings.agents_api_key}).status_code == 200
    assert client.get("/docs").status_code == 404
    assert client.get("/redoc").status_code == 404
    assert client.get("/openapi.json").status_code == 404


def test_http_auth() -> None:
    run_test()


if __name__ == "__main__":
    run_test()
    print("test_http_auth: ok")
