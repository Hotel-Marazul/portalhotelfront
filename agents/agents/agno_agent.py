from __future__ import annotations

from typing import Any

from app.logger import log_event, sanitize_log_value
from app.settings import settings
from schemas.messages import ChatResponse
from tools.prompt_loader import load_agno_instructions


class AgnoResponseAgent:
    def __init__(self) -> None:
        self.enabled = False
        self._agent: Any | None = None

        if not settings.agno_enabled:
            log_event("agno_disabled", reason="AGNO_ENABLED=false")
            return
        if not settings.openai_api_key:
            log_event("agno_disabled", reason="OPENAI_API_KEY_missing")
            return

        try:
            from agno.agent import Agent  # type: ignore
        except Exception as exc:  # pragma: no cover
            log_event("agno_init_failed", reason="agent_import_error", error_type=exc.__class__.__name__)
            return

        model = self._load_openai_model()
        if model is None:
            return

        try:
            self._agent = Agent(
                model=model,
                instructions=load_agno_instructions()
                or [
                    "Voce e a recepcionista virtual do Hotel Marazul.",
                    "Reescreva a resposta em portugues brasileiro claro e objetivo.",
                    "Nao invente fatos, precos, disponibilidade ou politicas.",
                    "Se houver campos faltantes, mantenha o pedido desses campos.",
                    "Retorne somente o texto final para o usuario.",
                ],
                markdown=False,
            )
            self.enabled = True
            log_event("agno_enabled", model=settings.openai_model)
        except Exception as exc:  # pragma: no cover
            log_event("agno_init_failed", reason="agent_setup_error", error_type=exc.__class__.__name__)

    def _load_openai_model(self) -> Any | None:
        for class_name in ("OpenAIChat", "OpenAIResponses"):
            try:
                module = __import__("agno.models.openai", fromlist=[class_name])
                model_class = getattr(module, class_name)
                return model_class(id=settings.openai_model, api_key=settings.openai_api_key)
            except Exception:
                continue
        log_event("agno_init_failed", reason="openai_model_import_error")
        return None

    def rewrite(self, response: ChatResponse) -> str:
        # Never let a generative layer rewrite validated operational facts.
        safe_reply = sanitize_log_value(response.reply)
        if response.action.type != "none" or not self.enabled or self._agent is None:
            return safe_reply

        missing = ", ".join(response.missing_fields) if response.missing_fields else "nenhum"
        prompt = (
            "Mensagem do usuário: omitida; use somente a resposta base validada.\n\n"
            "Resposta base (correta e validada):\n"
            f"{safe_reply}\n\n"
            "Contexto:\n"
            f"- intent: {response.intent}\n"
            f"- action_type: {response.action.type}\n"
            f"- action_status: {response.action.status}\n"
            f"- missing_fields: {missing}\n\n"
            "Reescreva a resposta base para ficar mais natural, sem alterar os fatos."
        )

        try:
            result = self._agent.run(prompt)
            content = getattr(result, "content", None) or getattr(result, "response", None) or str(result)
            rewritten = sanitize_log_value(str(content).strip())
            return rewritten if rewritten else safe_reply
        except Exception as exc:  # pragma: no cover
            log_event("agno_rewrite_failed", error_type=exc.__class__.__name__)
            return response.reply
