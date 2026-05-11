from __future__ import annotations

from dataclasses import dataclass

from schemas.messages import EvidenceItem
from tools.backend_api import BackendApiClient
from tools.retrieval import RetrievalPipeline


@dataclass
class PolicyAnswer:
    answer: str
    evidence: list[EvidenceItem]


class PolicyAgent:
    def __init__(self, retrieval: RetrievalPipeline, backend_api: BackendApiClient) -> None:
        self.retrieval = retrieval
        self.backend_api = backend_api

    async def answer(self, question: str) -> PolicyAnswer:
        retrieval_result = self.retrieval.retrieve(question)
        if retrieval_result.context.strip():
            answer = (
                "Pelas políticas internas encontradas, este é o direcionamento mais próximo da sua pergunta: "
                f"{retrieval_result.context[:450].strip()}"
            )
            return PolicyAnswer(answer=answer, evidence=retrieval_result.evidence)

        backend_policies = await self.backend_api.get_policies()
        if backend_policies:
            joined = " | ".join(str(item) for item in backend_policies[:3])
            return PolicyAnswer(
                answer=f"Encontrei políticas no backend: {joined[:450]}",
                evidence=[EvidenceItem(source="backend:/policies", excerpt=joined[:200])],
            )

        return PolicyAnswer(
            answer=(
                "Não localizei uma política específica para essa pergunta. "
                "Posso encaminhar para atendimento humano com o contexto da conversa."
            ),
            evidence=[],
        )

