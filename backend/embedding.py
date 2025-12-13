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
from typing import Optional
from chromadb import PersistentClient
from sentence_transformers import SentenceTransformer
import shutil
import math

# ------------------------------------------------------------
# Fixed schema (standardized export from legacy project)
# ------------------------------------------------------------

# 1) These columns MUST exist in every uploaded file
REQUIRED_COLUMNS = [
    "title",
    "authors",
    "abstract",
    "date",
    "source",
    "vhbRanking",
    "abcdRanking",
    "journal_name",
    "doi",
]

# 2) Map your real column names -> internal names (only needed if legacy uses different casing)
# Example: if Excel headers are "Title", "Abstract", ... then map them here.
OPTIONAL_COLUMNS = {
    "sources",
    "source_count",
    "issn",
    "eissn",
    "url",
    "citations",
    "journal_quartile",
}

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
# Safe conversion (fixes NaN → "")
# ------------------------------------------------------------
def safe_str(x):
    if x is None:
        return ""
    if isinstance(x, float) and math.isnan(x):
        return ""
    return str(x)


# ------------------------------------------------------------
# Ask user for file
# ------------------------------------------------------------
def get_user_file_path() -> Optional[str]:
    print("\n📂 Enter CSV/XLS/XLSX file path:")
    fp = input("File path: ").strip().strip('"').strip("'")
    if not os.path.exists(fp):
        print("❌ File not found.")
        return None
    return fp


# ------------------------------------------------------------
# Load + Parse dataset
# ------------------------------------------------------------
def load_and_parse_standard_data(file_path: str) -> pd.DataFrame:
    print(f"\n📄 Loading standardized file: {file_path}")

    if file_path.endswith(".csv"):
        df = pd.read_csv(file_path, encoding="utf-8", on_bad_lines="skip")
    else:
        df = pd.read_excel(file_path)

    # Normalize headers
    df.columns = [str(c).strip() for c in df.columns]

    # Validate required columns
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(
            f"❌ Missing required columns: {missing}\n"
            f"Found columns: {list(df.columns)}"
        )

    # Keep only known columns (order is intentional)
    cols = REQUIRED_COLUMNS + [c for c in OPTIONAL_COLUMNS if c in df.columns]
    df = df[cols]

    # Clean NaNs
    for col in df.columns:
        df[col] = df[col].apply(safe_str)

    # Optional hard filter (recommended for embeddings)
    df = df[
        (df["title"].str.strip() != "") &
        (df["abstract"].str.strip() != "")
    ]

    print(f"✔ Valid rows kept: {len(df)}")
    return df




# ------------------------------------------------------------
# Build rich text documents for embedding (MODIFIED for Snippet/Link)
# ------------------------------------------------------------
def create_documents_and_metadata(df: pd.DataFrame):
    contents, metadatas, ids = [], [], []

    for idx, row in df.iterrows():
        title = row["title"]
        abstract = row["abstract"]
        keywords = row.get("sources", "") or row.get("journal_name", "")
        doi = row.get("doi", "")
        url = row.get("url", "")

        link = url if url else (f"https://doi.org/{doi}" if doi else "")

        # Rich document text (used for embedding)
        content = f"""
        Title: {title}
        Abstract: {abstract}
        Authors: {row["authors"]}
        Journal: {row["journal_name"]}
        Year: {row["date"]}
        """.strip()

        # Append additional fields as context (optional)
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

        metadatas.append({
            "title": title,
            "authors": row["authors"],
            "journal": row["journal_name"],
            "year": row["date"],
            "doi": doi,
            "url": link,
            "citations": row.get("citations", ""),
            "vhb_ranking": row.get("vhbRanking", ""),
            "abcd_ranking": row.get("abcdRanking", ""),
            "abstract_snippet": snippet,
            "access_link": link,
            "keywords": keywords,
        })

        ids.append(f"doc_{idx}")

    # Debug: show one example
    if contents:
        print("\n📝 Example indexed document:\n", contents[0][:600])
    return contents, metadatas, ids


# ------------------------------------------------------------
# Create Chroma Index (cosine)
# ------------------------------------------------------------
def create_vector_store(contents, metadatas, ids, db_path, collection_name):
    print("\n🧮 Generating normalized embeddings...")

    # Using all-MiniLM-L6-v2, which is good for quick, high-performance RAG demos
    model = SentenceTransformer("all-MiniLM-L6-v2")
    embeddings = model.encode(contents, normalize_embeddings=True).tolist()

    if os.path.exists(db_path):
        print("⚠ Removing old DB...")
        shutil.rmtree(db_path)

    client = PersistentClient(path=db_path)

    collection = client.get_or_create_collection(
        name=collection_name,
        metadata={"hnsw:space": "cosine"}  # cosine distance for similarity
    )

    collection.add(
        ids=ids,
        embeddings=embeddings,
        documents=contents,
        metadatas=metadatas
    )

    print(f"📦 Indexed {len(ids)} documents.")


# ------------------------------------------------------------
# Metadata preview
# ------------------------------------------------------------
def inspect_collection_metadata(path, name):
    col = PersistentClient(path=path).get_collection(name)
    meta = col.get(include=["metadatas"], limit=1)  # Reduced limit for cleaner preview

    print("\n📘 METADATA PREVIEW (Example):")
    for m in meta["metadatas"]:
        print("Title:", m["title"])
        print("Keywords:", m["keywords"])
        print("Access Link:", m["access_link"] if m["access_link"] else "N/A")
        print("Snippet:", m["abstract_snippet"])


# ------------------------------------------------------------
# Full pipeline + search loop (MODIFIED to display sources)
# ------------------------------------------------------------
def run_indexing_pipeline(file_path: str):
    DB = "./research_index_db"
    COL = "papers_collection"

    df = load_and_parse_standard_data(file_path)

    if df.empty:
        print("❌ No papers with title + abstract. Aborting.")
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

        # ⭐ INCLUDE documents and metadatas for retrieval
        results = col.query(
            query_embeddings=[q_emb],
            n_results=3,
            include=["metadatas", "distances", "documents"]
        )

        distances = results["distances"][0]
        similarities = [1 - d for d in distances]

        best = similarities[0]

        if best < THRESHOLD:
            print("\n❌ No relevant papers found (low similarity).")
            continue

        # ⭐ SIMULATE LLM ANSWER GENERATION AND CITATION DISPLAY
        print(f"\n🔎 LLM Answer (Grounded in {len(results['metadatas'][0])} Sources, best score={best:.3f}):")

        # In a full RAG system, the LLM would synthesize the answer first,
        # and then append the source list below.
        print("\n[LLM GENERATED ANSWER HERE]")
        print("...")

        # --- TRACEABILITY & TRANSPARENCY: Displaying Sources ---
        print("\n--- SOURCES USED FOR GROUNDING (Traceability) ---")
        for i, meta in enumerate(results["metadatas"][0]):
            link = meta["access_link"]

            print(f"\n[Source {i + 1}] Similarity: {similarities[i]:.3f}")
            print(f"Title: {meta['title']}")
            print(f"Link: {link}" if link else "Link: N/A")
            print(f"Snippet: {meta['abstract_snippet']}")

        print("------------------------------------------------")


# ------------------------------------------------------------
# Main
# ------------------------------------------------------------
if __name__ == "__main__":
    fp = get_user_file_path()
    if fp:
        run_indexing_pipeline(fp)