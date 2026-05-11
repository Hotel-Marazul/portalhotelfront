from __future__ import annotations

from dataclasses import dataclass

from app.settings import settings
from schemas.messages import EvidenceItem
from tools.rag_store import InMemoryRagStore, load_knowledge_documents


@dataclass
class RetrievalResult:
    context: str
    evidence: list[EvidenceItem]


class RetrievalPipeline:
    def __init__(self, store: InMemoryRagStore | None = None, top_k: int | None = None) -> None:
        self._store = store or InMemoryRagStore()
        self._top_k = top_k or settings.rag_top_k
        self._bootstrapped = False

    def bootstrap(self) -> None:
        if self._bootstrapped:
            return
        docs = load_knowledge_documents(settings.rag_knowledge_dir)
        self._store.add_documents(docs)
        self._bootstrapped = True

    def retrieve(self, query: str) -> RetrievalResult:
        self.bootstrap()
        docs = self._store.search(query, top_k=self._top_k)

        evidence = [
            EvidenceItem(
                source=f"tool.rag.retrieve::{doc.source}",
                excerpt=doc.content[:280].replace("\n", " ").strip(),
            )
            for doc in docs
        ]
        context = "\n\n".join(doc.content[:1000] for doc in docs)
        return RetrievalResult(context=context, evidence=evidence)
