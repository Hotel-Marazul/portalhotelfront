from __future__ import annotations

import os
import subprocess
import sys


def run_test() -> None:
    env = os.environ.copy()
    env["AGENTS_MUTATIONS_ENABLED"] = "false"
    script = """
import asyncio
import hashlib
import hmac
import os
from app.settings import load_settings, settings
from app.server import create_app
from orchestration.supervisor import Supervisor
from schemas.messages import ChatRequest
from fastapi.testclient import TestClient

async def main():
    assert settings.agents_mutations_enabled is False
    os.environ["AGENTS_MUTATIONS_ENABLED"] = "unexpected"
    assert load_settings().agents_mutations_enabled is False
    response = await Supervisor().handle_chat(ChatRequest(
        conversation_id="rollback-check",
        user_message="quero reservar um quarto",
    ))
    assert response.action.status == "blocked"
    assert "temporariamente desativadas" in response.reply

asyncio.run(main())
client = TestClient(create_app())
initiator = "123e4567-e89b-12d3-a456-426614174000"
signature = hmac.new(settings.agents_api_key.encode(), initiator.encode(), hashlib.sha256).hexdigest()
http_response = client.post("/chat", headers={
    "X-API-Key": settings.agents_api_key,
    "X-Agent-Initiator": initiator,
    "X-Agent-Context-Signature": signature,
}, json={
    "conversation_id": "rollback-http-check",
    "user_message": "quero reservar um quarto",
})
assert http_response.status_code == 200
assert http_response.json()["action"]["status"] == "blocked"
"""
    result = subprocess.run([sys.executable, "-c", script], env=env, capture_output=True, text=True)
    assert result.returncode == 0, result.stderr or result.stdout


if __name__ == "__main__":
    run_test()
    print("test_rollback_flag: ok")
