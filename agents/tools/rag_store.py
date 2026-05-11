from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path


TOKEN_PATTERN = re.compile(r"[a-zA-Z0-9_]{3,}")


@dataclass
class RagDocument:
    id: str
    source: str
    content: str


def _tokenize(text: str) -> set[str]:
    return {token.lower() for token in TOKEN_PATTERN.findall(text)}


class InMemoryRagStore:
    def __init__(self) -> None:
        self._documents: list[RagDocument] = []

    def add_documents(self, documents: list[RagDocument]) -> None:
        self._documents.extend(documents)

    def search(self, query: str, top_k: int = 3) -> list[RagDocument]:
        query_tokens = _tokenize(query)
        if not query_tokens:
            return []

        scored: list[tuple[int, RagDocument]] = []
        for doc in self._documents:
            score = len(query_tokens.intersection(_tokenize(doc.content)))
            if score > 0:
                scored.append((score, doc))

        scored.sort(key=lambda item: item[0], reverse=True)
        return [doc for _, doc in scored[:top_k]]


def load_knowledge_documents(knowledge_dir: Path) -> list[RagDocument]:
    if not knowledge_dir.exists():
        return []

    documents: list[RagDocument] = []
    for path in sorted(knowledge_dir.glob("**/*")):
        if not path.is_file() or path.suffix.lower() not in {".md", ".txt"}:
            continue
        text = path.read_text(encoding="utf-8")
        doc_id = path.stem
        documents.append(RagDocument(id=doc_id, source=str(path), content=text))

    return documents

