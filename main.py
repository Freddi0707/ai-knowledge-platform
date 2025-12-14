"""
Main entry point for the AI Knowledge Platform.

Run:
  python main.py
  python main.py path/to/ScopusExample.xlsx
"""

import sys

from backend.embedding import run_indexing_pipeline
from backend.etl import get_user_file_path


def main():
    # 1) Optional CLI argument: python main.py <file_path>
    file_path = sys.argv[1] if len(sys.argv) > 1 else None

    # 2) If not provided, ask interactively (same behavior as before)
    if not file_path:
        file_path = get_user_file_path()

    if not file_path:
        print("❌ No file selected. Exiting.")
        return

    run_indexing_pipeline(file_path)


if __name__ == "__main__":
    main()
