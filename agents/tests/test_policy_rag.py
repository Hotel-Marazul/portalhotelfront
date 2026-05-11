from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from agents.policy_agent import PolicyAgent
from tools.rag_store import InMemoryRagStore, RagDocument
from tools.retrieval import RetrievalPipeline


class FakeBackendApi:
    async def get_policies(self):
        return []


async def run_test() -> None:
    store = InMemoryRagStore()
    store.add_documents(
        [
            RagDocument(
                id="cancelamento",
                source="fixture",
                content="Cancelamento com menos de 24h pode gerar cobrança da primeira diária.",
            )
        ]
    )
    retrieval = RetrievalPipeline(store=store, top_k=1)
    retrieval._bootstrapped = True  # pylint: disable=protected-access
    agent = PolicyAgent(retrieval, FakeBackendApi())  # type: ignore[arg-type]

    answer = await agent.answer("Qual a política de cancelamento?")
    assert "cancelamento" in answer.answer.lower()
    assert len(answer.evidence) > 0


if __name__ == "__main__":
    asyncio.run(run_test())
    print("test_policy_rag: ok")
