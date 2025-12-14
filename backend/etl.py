# backend/etl.py
import os
import math
from typing import Optional

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

    # Remove BOM and NBSP
    s = s.replace("\ufeff", "")
    s = s.replace("\xa0", " ")

    # Trim / collapse whitespace
    s = s.strip()
    s = " ".join(s.split())

    # Remove wrapping quotes if present
    if len(s) >= 2 and ((s[0] == '"' and s[-1] == '"') or (s[0] == "'" and s[-1] == "'")):
        s = s[1:-1].strip()

    # Remove stray quotes at edges (defensive)
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
    "abdcRanking",   # <-- accept legacy typo
    "journal_name",
    "doi",
]

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

    # Hard quality filter (recommended for indexing)
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
