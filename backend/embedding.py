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
# spaCy (optional, currently not used for cleaning)
# ------------------------------------------------------------
try:
    nlp = spacy.load("en_core_web_sm")
    print("🟢 spaCy loaded.")
except Exception:
    print("⚠ spaCy missing. Continuing without NLP cleaning.")
    nlp = None

# ------------------------------------------------------------
# Column Name Mapping (UPDATED for Link/DOI)
# ------------------------------------------------------------
COLUMN_MAPPINGS = {
    "Standardized_Title": [
        "Title", "title", "Document Title", "Document title", "Article Title",
        "article_title", "TI", "display_name"
    ],
    "Standardized_Abstract": [
        "Abstract", "abstract", "AB", "Abstract Note", "abstract_text"
    ],
    "Standardized_Keywords": [
        "Keywords", "keywords", "DE", "Key Words Plus",
        "Author Keywords", "Index Keywords"
    ],
    # ⭐ NEW MAPPING FOR LINK/DOI
    "Standardized_Link": [
        "DOI", "link", "URL", "Accession Number", "ID", "UT"
    ],
}

STANDARDIZED_COLUMNS = {
    "title": "Standardized_Title",
    "abstract": "Standardized_Abstract",
    "keywords": "Standardized_Keywords",
    "link": "Standardized_Link",
}


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
# Load + Standardize dataset (MODIFIED to include Link)
# ------------------------------------------------------------
def load_and_standardize_data(file_path: str) -> pd.DataFrame:
    print(f"\n📄 Loading: {file_path}")

    if file_path.endswith(".csv"):
        df = pd.read_csv(file_path, encoding="utf-8", on_bad_lines="skip")
    else:
        df = pd.read_excel(file_path)

    std = pd.DataFrame()
    cols = {c.strip(): c for c in df.columns}

    # Map each standardized column (now includes Link)
    for std_col, names in COLUMN_MAPPINGS.items():
        found = False
        for name in names:
            if name in cols:
                std[std_col] = df[cols[name]]
                found = True
                break
        if not found:
            std[std_col] = ""

    # NaN -> ""
    for col in std.columns:
        std[col] = std[col].apply(safe_str)

    # Ensure Standardized_Link is created even if empty after mapping
    if "Standardized_Link" not in std.columns:
        std["Standardized_Link"] = ""

    total_before = len(std)

    # ⭐ ONLY KEEP rows with ALL THREE (Title, Abstract, Keywords) non-empty:
    mask = (
            (std["Standardized_Title"].str.strip() != "") &
            (std["Standardized_Abstract"].str.strip() != "") &
            (std["Standardized_Keywords"].str.strip() != "")
    )
    std = std[mask]

    total_after = len(std)

    print(f"✔ Papers with Title + Abstract + Keywords: {total_after} / {total_before}")

    print("🔹 Non-empty Titles:   ", (std["Standardized_Title"].str.strip() != "").sum())
    print("🔹 Non-empty Abstracts:", (std["Standardized_Abstract"].str.strip() != "").sum())
    print("🔹 Non-empty Keywords: ", (std["Standardized_Keywords"].str.strip() != "").sum())

    return std


# ------------------------------------------------------------
# Build rich text documents for embedding (MODIFIED for Snippet/Link)
# ------------------------------------------------------------
def create_documents_and_metadata(df: pd.DataFrame):
    contents, metadatas, ids = [], [], []

    for idx, row in df.iterrows():
        title = safe_str(row["Standardized_Title"])
        abstract = safe_str(row["Standardized_Abstract"])
        keywords = safe_str(row["Standardized_Keywords"])
        link = safe_str(row["Standardized_Link"])  # ⭐ GET THE LINK

        # Rich document text (used for embedding)
        content = f"""
Title: {title}
Abstract: {abstract}
Keywords: {keywords}
""".strip()

        # Append additional fields as context (optional)
        extras = []
        for col in df.columns:
            if col not in STANDARDIZED_COLUMNS.values():
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
            "keywords": keywords,
            "row_index": int(idx),
            "abstract_snippet": snippet,  # ⭐ ADD SNIPPET
            "access_link": link,  # ⭐ ADD LINK
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

    df = load_and_standardize_data(file_path)
    if df.empty:
        print("❌ No papers with title + abstract + keywords. Aborting.")
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