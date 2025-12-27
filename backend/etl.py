# backend/etl.py
import os
import math
import re
import hashlib
from typing import Optional, List, Tuple, Dict

import pandas as pd


# ------------------------------------------------------------
# Column normalization (robust against Excel quirks + quotes)
# ------------------------------------------------------------
def normalize_col(col: str) -> str:
    """
    Normalize column names to avoid hidden Excel characters:
    - BOM (\ufeff)
    - Non-breaking spaces (\xa0)
    - Leading/trailing/multiple whitespaces
    - Wrapping quotes: '"title"' -> 'title'
    """
    s = str(col)
    s = s.replace("\ufeff", "")
    s = s.replace("\xa0", " ")
    s = s.strip()
    s = " ".join(s.split())

    # Remove wrapping quotes repeatedly (handles "'title'" and '"title"')
    while len(s) >= 2 and (
            (s[0] == '"' and s[-1] == '"') or
            (s[0] == "'" and s[-1] == "'")
    ):
        s = s[1:-1].strip()

    # Remove any remaining edge quotes (defensive)
    s = s.strip('"').strip("'").strip()
    return s


# ------------------------------------------------------------
# Fixed schema (standardized export from legacy project)
# IMPORTANT: Input column is "abdcRanking" (we must accept it)
# ------------------------------------------------------------
REQUIRED_COLUMNS = [
    "title",
    "authors",
    "abstract",
    "date",
    "source",
    "vhbRanking",
    "abdcRanking",   # legacy typo in upstream export
    "journal_name",
    "doi",
]

OPTIONAL_COLUMNS = {
    "sources",          # often used as keywords / subject areas (if present)
    "source_count",
    "issn",
    "eissn",
    "url",
    "citations",
    "journal_quartile",
}


# ------------------------------------------------------------
# Safe conversion (NaN / None → "")
# ------------------------------------------------------------
def safe_str(x):
    if x is None:
        return ""
    if isinstance(x, float) and math.isnan(x):
        return ""
    return str(x)


# ------------------------------------------------------------
# Ask user for file path (CLI helper)
# ------------------------------------------------------------
def get_user_file_path() -> Optional[str]:
    print("\n📂 Enter CSV/XLS/XLSX file path:")
    fp = input("File path: ").strip().strip('"').strip("'")
    if not os.path.exists(fp):
        print("❌ File not found.")
        return None
    return fp


# ------------------------------------------------------------
# Load + Parse standardized dataset (ETL Stage 1)
# ------------------------------------------------------------
def load_and_parse_standard_data(file_path: str) -> pd.DataFrame:
    print(f"\n📄 Loading standardized file: {file_path}")

    # Load file
    if file_path.lower().endswith(".csv"):
        df = pd.read_csv(file_path, encoding="utf-8", on_bad_lines="skip")
    else:
        df = pd.read_excel(file_path)

    # Normalize headers
    df.columns = [normalize_col(c) for c in df.columns]

    # Debug: show exact representations
    print("🧾 Normalized columns:", [repr(c) for c in df.columns])

    # Validate required columns
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(
            f"❌ Missing required columns: {missing}\n"
            f"Found columns: {list(df.columns)}"
        )

    # Keep only known columns (stable order)
    selected_columns = REQUIRED_COLUMNS + [c for c in OPTIONAL_COLUMNS if c in df.columns]
    df = df[selected_columns]

    # Clean values
    for col in df.columns:
        df[col] = df[col].apply(safe_str)

    # Hard quality filter (recommended for graph + embeddings)
    before = len(df)
    df = df[
        (df["title"].str.strip() != "") &
        (df["abstract"].str.strip() != "") &
        (df["doi"].str.strip() != "")
    ]
    after = len(df)

    print(f"✔ Rows before filter: {before}")
    print(f"✔ Rows after filter:  {after}")

    return df


# ============================================================
# Neo4j CSV Export (Stage 1)
# ============================================================

def _sha1(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()


def make_stable_id(prefix: str, value: str) -> str:
    """
    Deterministic ID generator (platform-level, no semantics).
    Example: AUTHOR_<sha1(name)>
    """
    v = safe_str(value).strip()
    return f"{prefix}_{_sha1(v.lower())}"


def split_authors(authors_raw: str) -> List[str]:
    """
    Based on your Scopus Example screenshots:
    - Authors are separated by semicolon ';'
    - Commas belong to names (e.g., 'Smith, John') and MUST NOT be split.
    """
    s = safe_str(authors_raw)
    if not s.strip():
        return []
    parts = [p.strip() for p in s.split(";")]
    return [p for p in parts if p]


def split_keywords(raw: str) -> List[str]:
    """
    Optional helper:
    If 'sources' exists and contains multiple values, we try to split robustly.
    This stays TECHNICAL (no interpretation).
    We split on ';' first; if not present, we try '|' then ',' as a fallback.
    """
    s = safe_str(raw).strip()
    if not s:
        return []

    if ";" in s:
        parts = [p.strip() for p in s.split(";")]
    elif "|" in s:
        parts = [p.strip() for p in s.split("|")]
    else:
        # Fallback: comma-separated keywords (only as a last resort)
        parts = [p.strip() for p in s.split(",")]

    # remove empties + de-duplicate while preserving order
    seen = set()
    out = []
    for p in parts:
        if p and p.lower() not in seen:
            out.append(p)
            seen.add(p.lower())
    return out


def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def export_neo4j_csvs(
    df: pd.DataFrame,
    out_dir: str = "./neo4j/import",
    export_keywords: bool = True,
) -> Dict[str, str]:
    """
    Writes Neo4j-friendly CSVs for Stage 1.

    Outputs:
    - papers.csv               (:Paper)
    - authors.csv              (:Author)
    - authored.csv             (:Author)-[:AUTHORED]->(:Paper)

    Optional (if export_keywords and 'sources' present):
    - keywords.csv             (:Keyword)
    - has_keyword.csv          (:Paper)-[:HAS_KEYWORD]->(:Keyword)

    IDs:
    - Paper ID = doi  (as agreed)
    - Author ID = AUTHOR_<sha1(author_name)>
    - Keyword ID = KEYWORD_<sha1(keyword)>
    """
    ensure_dir(out_dir)

    # -------------------------
    # Papers
    # -------------------------
    papers = df.copy()
    papers["paper_id"] = papers["doi"].apply(lambda x: safe_str(x).strip())

    # Put paper_id first, keep rest as properties
    paper_cols = ["paper_id"] + [c for c in papers.columns if c != "paper_id"]
    papers = papers[paper_cols]

    papers_path = os.path.join(out_dir, "papers.csv")
    papers.to_csv(papers_path, index=False, encoding="utf-8")

    # -------------------------
    # Authors & AUTHORED edges
    # -------------------------
    author_rows: List[Dict[str, str]] = []
    authored_rows: List[Dict[str, str]] = []

    for _, row in df.iterrows():
        doi = safe_str(row.get("doi", "")).strip()
        if not doi:
            continue

        for author_name in split_authors(row.get("authors", "")):
            author_id = make_stable_id("AUTHOR", author_name)

            author_rows.append(
                {
                    "author_id": author_id,
                    "name": author_name,
                }
            )

            authored_rows.append(
                {
                    "author_id": author_id,
                    "paper_id": doi,
                }
            )

    authors_df = pd.DataFrame(author_rows).drop_duplicates(subset=["author_id"])
    authored_df = pd.DataFrame(authored_rows).drop_duplicates()

    authors_path = os.path.join(out_dir, "authors.csv")
    authored_path = os.path.join(out_dir, "authored.csv")

    authors_df.to_csv(authors_path, index=False, encoding="utf-8")
    authored_df.to_csv(authored_path, index=False, encoding="utf-8")

    written = {
        "papers": papers_path,
        "authors": authors_path,
        "authored": authored_path,
    }

    # -------------------------
    # Keywords & HAS_KEYWORD edges (optional)
    # -------------------------
    if export_keywords and ("sources" in df.columns):
        keyword_rows: List[Dict[str, str]] = []
        has_keyword_rows: List[Dict[str, str]] = []

        for _, row in df.iterrows():
            doi = safe_str(row.get("doi", "")).strip()
            if not doi:
                continue

            raw_sources = row.get("sources", "")
            for kw in split_keywords(raw_sources):
                kw_id = make_stable_id("KEYWORD", kw)

                keyword_rows.append(
                    {
                        "keyword_id": kw_id,
                        "name": kw,
                    }
                )

                has_keyword_rows.append(
                    {
                        "paper_id": doi,
                        "keyword_id": kw_id,
                    }
                )

        keywords_df = pd.DataFrame(keyword_rows).drop_duplicates(subset=["keyword_id"])
        has_keyword_df = pd.DataFrame(has_keyword_rows).drop_duplicates()

        keywords_path = os.path.join(out_dir, "keywords.csv")
        has_keyword_path = os.path.join(out_dir, "has_keyword.csv")

        keywords_df.to_csv(keywords_path, index=False, encoding="utf-8")
        has_keyword_df.to_csv(has_keyword_path, index=False, encoding="utf-8")

        written["keywords"] = keywords_path
        written["has_keyword"] = has_keyword_path

    # -------------------------
    # Print summary
    # -------------------------
    print("\n📤 Neo4j CSV Export complete:")
    print(f" - papers:   {len(papers)}")
    print(f" - authors:  {len(authors_df)}")
    print(f" - authored: {len(authored_df)}")
    if "keywords" in written:
        # keywords_df / has_keyword_df exist in this branch
        print(f" - keywords: {len(keywords_df)}")
        print(f" - has_kw:   {len(has_keyword_df)}")

    print(f"\n📁 Output dir: {os.path.abspath(out_dir)}")
    return written


def write_neo4j_import_cypher(out_dir: str = "./neo4j/import") -> str:
    """
    Optional helper: writes an import.cypher that you can run in Neo4j Browser.

    Assumes you mounted Neo4j /import to this directory.
    In Neo4j Browser you can run:
      :source import.cypher
    """
    ensure_dir(out_dir)
    cypher_path = os.path.join(out_dir, "import.cypher")

    # Note: file:/// paths refer to Neo4j's import directory inside the container.
    # If you use docker-compose from earlier, ./neo4j/import -> /var/lib/neo4j/import.
    cypher = """
// ------------------------------
// Constraints / Indexes
// ------------------------------
CREATE CONSTRAINT paper_id_unique IF NOT EXISTS
FOR (p:Paper) REQUIRE p.paper_id IS UNIQUE;

CREATE CONSTRAINT author_id_unique IF NOT EXISTS
FOR (a:Author) REQUIRE a.author_id IS UNIQUE;

CREATE CONSTRAINT keyword_id_unique IF NOT EXISTS
FOR (k:Keyword) REQUIRE k.keyword_id IS UNIQUE;

// ------------------------------
// Nodes
// ------------------------------
LOAD CSV WITH HEADERS FROM 'file:///papers.csv' AS row
MERGE (p:Paper {paper_id: row.paper_id})
SET
  p.title = row.title,
  p.abstract = row.abstract,
  p.date = row.date,
  p.source = row.source,
  p.vhbRanking = row.vhbRanking,
  p.abdcRanking = row.abdcRanking,
  p.journal_name = row.journal_name,
  p.doi = row.doi,
  p.url = row.url,
  p.citations = row.citations,
  p.journal_quartile = row.journal_quartile,
  p.issn = row.issn,
  p.eissn = row.eissn,
  p.source_count = row.source_count,
  p.sources = row.sources;

LOAD CSV WITH HEADERS FROM 'file:///authors.csv' AS row
MERGE (a:Author {author_id: row.author_id})
SET a.name = row.name;

LOAD CSV WITH HEADERS FROM 'file:///keywords.csv' AS row
MERGE (k:Keyword {keyword_id: row.keyword_id})
SET k.name = row.name;

// ------------------------------
// Relationships
// ------------------------------
LOAD CSV WITH HEADERS FROM 'file:///authored.csv' AS row
MATCH (a:Author {author_id: row.author_id})
MATCH (p:Paper  {paper_id: row.paper_id})
MERGE (a)-[:AUTHORED]->(p);

LOAD CSV WITH HEADERS FROM 'file:///has_keyword.csv' AS row
MATCH (p:Paper  {paper_id: row.paper_id})
MATCH (k:Keyword {keyword_id: row.keyword_id})
MERGE (p)-[:HAS_KEYWORD]->(k);
""".strip()

    with open(cypher_path, "w", encoding="utf-8") as f:
        f.write(cypher + "\n")

    print(f"\n🧾 Wrote Cypher import script: {os.path.abspath(cypher_path)}")
    return cypher_path
