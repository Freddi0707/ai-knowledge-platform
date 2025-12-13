"""
Main entry point for the AI Knowledge Platform.
Used for running backend services or dev setup scripts.
"""

if __name__ == "__main__":
    print("AI Knowledge Platform – main entry point.")

from backend.embedding import run_indexing_pipeline

if __name__ == "__main__":
    # fill in the "" your local file path - later we will integrate upload field
    file_path = "data/ScopusExample.xlsx"
    run_indexing_pipeline(file_path)
