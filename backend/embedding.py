import os
os.environ["CHROMA_TELEMETRY_DISABLED"] = "true"

# ---- Patch Chroma telemetry bug ----
try:
    import chromadb.telemetry.opentelemetry as otel

    def _no_capture(*args, **kwargs):
        return None

    otel.capture = _no_capture
    otel.otel_capture = _no_capture
except Exception:
    pass

import pandas as pd
import spacy
from chromadb import PersistentClient
from sentence_transformers import SentenceTransformer
import shutil

# ✅ ETL/Parsing ausgelagert (Data & Platform Engineer)
from backend.etl import (
    load_and_parse_standard_data,
    get_user_file_path,
    safe_str,
    REQUIRED_COLUMNS,
    OPTIONAL_COLUMNS,
)

# ------------------------------------------------------------
# spaCy (optional, currently not used for cleaning)
# ------------------------------------------------------------
try:
    nlp = spacy.load("en_core_web_sm")
    print("🟢 spaCy loaded.")
except Exception:
    print("⚠ spaCy missing. Continuing without NLP cleaning.")
    nlp = None


# ------------------------------------------------------------
# Build rich text documents for embedding
# ------------------------------------------------------------
def create_documents_and_metadata(df: pd.DataFrame):
    contents, metadatas, ids = [], [], []

    for idx, row in df.iterrows():
        title = row["title"]
        abstract = row["abstract"]
        keywords = row.get("sources", "") or row.get("journal_name", "")
        doi = row.get("doi", "")
        url = row.get("url", "")

        # ✅ DOI is the Paper-ID: if missing -> skip
        if not safe_str(doi).strip():
            continue

        link = url if url else f"https://doi.org/{doi}"

        # Document text (used for embedding)
        content = f"""
Title: {title}
Abstract: {abstract}
Authors: {row["authors"]}
Journal: {row["journal_name"]}
Year: {row["date"]}
""".strip()

        # (Optional) include any unexpected extra columns
        extras = []
        for col in df.columns:
            if col not in REQUIRED_COLUMNS and col not in OPTIONAL_COLUMNS:
                val = safe_str(row[col])
                if val.strip():
                    extras.append(f"{col}: {val}")
        if extras:
            content += "\n" + " | ".join(extras)

        contents.append(content)

        # Truncate abstract for snippet display
        snippet_length = 200
        snippet = abstract[:snippet_length].strip()
        if len(abstract) > snippet_length:
            snippet += "..."

        metadatas.append(
            {
                "title": title,
                "authors": row["authors"],
                "journal": row["journal_name"],
                "year": row["date"],
                "doi": doi,
                "url": link,
                "citations": row.get("citations", ""),
                "vhb_ranking": row.get("vhbRanking", ""),
                # ✅ accept legacy input column name
                "abdc_ranking": row.get("abdcRanking", ""),
                "abstract_snippet": snippet,
                "access_link": link,
                "keywords": keywords,
            }
        )

        # ✅ IDs = DOI (for later Neo4j/Qdrant linkage)
        ids.append(doi)

    # Debug: show one example
    if contents:
        print("\n📝 Example indexed document:\n", contents[0][:600])

    return contents, metadatas, ids


# ------------------------------------------------------------
# Create Chroma Index (cosine)
# ------------------------------------------------------------
def create_vector_store(contents, metadatas, ids, db_path, collection_name):
    print("\n🧮 Generating normalized embeddings...")

    model = SentenceTransformer("all-MiniLM-L6-v2")
    embeddings = model.encode(contents, normalize_embeddings=True).tolist()

    if os.path.exists(db_path):
        print("⚠ Removing old DB...")
        shutil.rmtree(db_path)

    client = PersistentClient(path=db_path)

    collection = client.get_or_create_collection(
        name=collection_name,
        metadata={"hnsw:space": "cosine"},
    )

    collection.add(
        ids=ids,
        embeddings=embeddings,
        documents=contents,
        metadatas=metadatas,
    )

    print(f"📦 Indexed {len(ids)} documents.")


# ------------------------------------------------------------
# Metadata preview
# ------------------------------------------------------------
def inspect_collection_metadata(path, name):
    col = PersistentClient(path=path).get_collection(name)
    meta = col.get(include=["metadatas"], limit=1)

    print("\n📘 METADATA PREVIEW (Example):")
    for m in meta["metadatas"]:
        print("Title:", m.get("title"))
        print("Keywords:", m.get("keywords"))
        print("Access Link:", m.get("access_link") if m.get("access_link") else "N/A")
        print("Snippet:", m.get("abstract_snippet"))


# ------------------------------------------------------------
# Full pipeline + search loop
# ------------------------------------------------------------
def run_indexing_pipeline(file_path: str):
    DB = "./research_index_db"
    COL = "papers_collection"

    df = load_and_parse_standard_data(file_path)

    if df.empty:
        print("❌ No papers with title + abstract + doi. Aborting.")
        return

    contents, metadatas, ids = create_documents_and_metadata(df)
    create_vector_store(contents, metadatas, ids, DB, COL)

    inspect_collection_metadata(DB, COL)

    print("\n--- 🔍 SEMANTIC SEARCH & RAG TRACEABILITY ---")

    model = SentenceTransformer("all-MiniLM-L6-v2")
    col = PersistentClient(path=DB).get_collection(COL)

    THRESHOLD = 0.30

    while True:
        q = input("\n🔍 Ask a question (or type 'exit'): ").strip()
        if q.lower() == "exit":
            break

        q_emb = model.encode(q, normalize_embeddings=True).tolist()

        results = col.query(
            query_embeddings=[q_emb],
            n_results=3,
            include=["metadatas", "distances", "documents"],
        )

        distances = results["distances"][0]
        similarities = [1 - d for d in distances]
        best = similarities[0]

        if best < THRESHOLD:
            print("\n❌ No relevant papers found (low similarity).")
            continue

        print(f"\n🔎 LLM Answer (Grounded in {len(results['metadatas'][0])} Sources, best score={best:.3f}):")
        print("\n[LLM GENERATED ANSWER HERE]")
        print("...")

        print("\n--- SOURCES USED FOR GROUNDING (Traceability) ---")
        for i, meta in enumerate(results["metadatas"][0]):
            link = meta.get("access_link")

            print(f"\n[Source {i + 1}] Similarity: {similarities[i]:.3f}")
            print(f"Title: {meta.get('title')}")
            print(f"Link: {link}" if link else "Link: N/A")
            print(f"Snippet: {meta.get('abstract_snippet')}")
        print("------------------------------------------------")


# ------------------------------------------------------------
# Main (only if embedding.py is run directly)
# Prefer starting via main.py
# ------------------------------------------------------------
if __name__ == "__main__":
    fp = get_user_file_path()
    if fp:
        run_indexing_pipeline(fp)
