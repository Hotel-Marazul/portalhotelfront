from __future__ import annotations

import json
from pathlib import Path

from app.settings import settings
from tools.rag_store import load_knowledge_documents


def main() -> None:
    docs = load_knowledge_documents(settings.rag_knowledge_dir)
    payload = [
        {
            "id": doc.id,
            "source": doc.source,
            "content": doc.content,
        }
        for doc in docs
    ]

    output_file = Path(__file__).resolve().parent / "index.json"
    output_file.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Indexed {len(payload)} document(s) into {output_file}")


if __name__ == "__main__":
    main()

