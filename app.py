# app.py - Flask Backend with Automated Neo4j Import
"""
Flask API that automatically:
1. Accepts file uploads
2. Processes data (ETL)
3. Creates vector embeddings
4. AUTOMATICALLY imports to Neo4j (no manual steps!)
5. Provides search API
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
import tempfile
from neo4j import GraphDatabase

# Import your existing modules
from backend.etl import (
    load_and_parse_standard_data,
    export_neo4j_csvs,
    safe_str,
    split_authors,
    split_keywords,
    make_stable_id
)
from backend.search import (
    create_documents_and_metadata,
    create_vector_store,
    HybridSearchEngine
)

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend

# Configuration
UPLOAD_FOLDER = './uploads'
DB_PATH = "./research_index_db"
COLLECTION_NAME = "papers_collection"
NEO4J_URL = "bolt://localhost:7687"
NEO4J_USER = "neo4j"
NEO4J_PASS = "Chongyichian@2257"  # Change this!

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max

# Global search engine (initialized after upload)
search_engine = None


def auto_import_to_neo4j(df):
    """
    Automatically import data to Neo4j using Python driver
    No manual CSV copying needed!
    """
    print("\n🔗 Connecting to Neo4j...")

    driver = GraphDatabase.driver(NEO4J_URL, auth=(NEO4J_USER, NEO4J_PASS))

    try:
        with driver.session() as session:
            # Clear existing data
            print("🧹 Clearing old data...")
            session.run("MATCH (n) DETACH DELETE n")

            # Create constraints
            print("📋 Creating constraints...")
            session.run("""
                CREATE CONSTRAINT paper_id_unique IF NOT EXISTS 
                FOR (p:Paper) REQUIRE p.paper_id IS UNIQUE
            """)
            session.run("""
                CREATE CONSTRAINT author_id_unique IF NOT EXISTS 
                FOR (a:Author) REQUIRE a.author_id IS UNIQUE
            """)
            session.run("""
                CREATE CONSTRAINT keyword_id_unique IF NOT EXISTS 
                FOR (k:Keyword) REQUIRE k.keyword_id IS UNIQUE
            """)

            # Import Papers
            print("📄 Importing papers...")
            for _, row in df.iterrows():
                doi = safe_str(row.get("doi", "")).strip()
                if not doi:
                    continue

                session.run("""
                    MERGE (p:Paper {paper_id: $paper_id})
                    SET p.title = $title,
                        p.abstract = $abstract,
                        p.date = $date,
                        p.journal_name = $journal_name,
                        p.doi = $doi,
                        p.url = $url,
                        p.citations = $citations
                """, {
                    "paper_id": doi,
                    "title": row["title"],
                    "abstract": row["abstract"],
                    "date": row["date"],
                    "journal_name": row["journal_name"],
                    "doi": doi,
                    "url": row.get("url", ""),
                    "citations": row.get("citations", "")
                })

            # Import Authors and Relationships
            print("👥 Importing authors...")
            for _, row in df.iterrows():
                doi = safe_str(row.get("doi", "")).strip()
                if not doi:
                    continue

                for author_name in split_authors(row.get("authors", "")):
                    author_id = make_stable_id("AUTHOR", author_name)

                    # Create author
                    session.run("""
                        MERGE (a:Author {author_id: $author_id})
                        SET a.name = $name
                    """, {"author_id": author_id, "name": author_name})

                    # Create relationship
                    session.run("""
                        MATCH (a:Author {author_id: $author_id})
                        MATCH (p:Paper {paper_id: $paper_id})
                        MERGE (a)-[:AUTHORED]->(p)
                    """, {"author_id": author_id, "paper_id": doi})

            # Import Keywords (if available)
            if "sources" in df.columns:
                print("🏷️ Importing keywords...")
                for _, row in df.iterrows():
                    doi = safe_str(row.get("doi", "")).strip()
                    if not doi:
                        continue

                    for kw in split_keywords(row.get("sources", "")):
                        kw_id = make_stable_id("KEYWORD", kw)

                        # Create keyword
                        session.run("""
                            MERGE (k:Keyword {keyword_id: $keyword_id})
                            SET k.name = $name
                        """, {"keyword_id": kw_id, "name": kw})

                        # Create relationship
                        session.run("""
                            MATCH (p:Paper {paper_id: $paper_id})
                            MATCH (k:Keyword {keyword_id: $keyword_id})
                            MERGE (p)-[:HAS_KEYWORD]->(k)
                        """, {"paper_id": doi, "keyword_id": kw_id})

            # Verify import
            result = session.run("MATCH (n) RETURN count(n) as count")
            count = result.single()["count"]
            print(f"✅ Imported {count} nodes to Neo4j")

    finally:
        driver.close()


@app.route('/api/upload', methods=['POST'])
def upload_file():
    """
    Handle file upload and automatic processing
    """
    global search_engine

    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']

    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    if not file.filename.endswith(('.xlsx', '.xls', '.csv')):
        return jsonify({'error': 'Invalid file type. Use Excel or CSV'}), 400

    try:
        # Save uploaded file
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)

        # Step 1: ETL - Load and clean data
        print("\n📊 Step 1: Processing data...")
        df = load_and_parse_standard_data(filepath)

        if df.empty:
            return jsonify({'error': 'No valid papers found in file'}), 400

        # Step 2: Create vector embeddings
        print("\n🧮 Step 2: Creating vector embeddings...")
        contents, metadatas, ids = create_documents_and_metadata(df)
        create_vector_store(contents, metadatas, ids, DB_PATH, COLLECTION_NAME)

        # Step 3: Auto-import to Neo4j
        print("\n🔗 Step 3: Importing to Neo4j...")
        auto_import_to_neo4j(df)

        # Step 4: Initialize search engine
        print("\n🚀 Step 4: Initializing search engine...")
        search_engine = HybridSearchEngine(
            db_path=DB_PATH,
            collection_name=COLLECTION_NAME,
            neo4j_url=NEO4J_URL,
            neo4j_user=NEO4J_USER,
            neo4j_pass=NEO4J_PASS,
            llm_model="llama3.2"
        )

        return jsonify({
            'success': True,
            'message': 'File processed successfully',
            'papers_count': len(df),
            'status': 'ready'
        })

    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/search', methods=['POST'])
def search():
    """
    Handle search queries
    """
    global search_engine

    if search_engine is None:
        return jsonify({'error': 'Please upload a file first'}), 400

    data = request.json
    query = data.get('query', '').strip()

    if not query:
        return jsonify({'error': 'Query cannot be empty'}), 400

    try:
        # Perform hybrid search
        result = search_engine.hybrid_answer(query)

        # Format response
        response = {
            'answer': result['answer'],
            'confidence': result['best_score'],
            'sources': [
                {
                    'title': meta.get('title'),
                    'authors': meta.get('authors'),
                    'year': meta.get('year'),
                    'similarity': result['similarities'][i],
                    'link': meta.get('access_link')
                }
                for i, meta in enumerate(result['sources'])
            ],
            'graphUsed': result.get('graph_used', False),
            'cypherQuery': result.get('cypher_query')
        }

        return jsonify(response)

    except Exception as e:
        print(f"❌ Search error: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/status', methods=['GET'])
def status():
    """
    Check if system is ready
    """
    return jsonify({
        'ready': search_engine is not None,
        'neo4j_url': NEO4J_URL
    })


@app.route('/api/health', methods=['GET'])
def health():
    """
    Health check endpoint
    """
    return jsonify({'status': 'ok'})


if __name__ == '__main__':
    print("""
╔══════════════════════════════════════════════════════════╗
║         HYBRID RAG API SERVER                           ║
║         Automatic Neo4j Import + Web Interface          ║
╚══════════════════════════════════════════════════════════╝

Starting server on http://localhost:5000
    """)

    app.run(debug=True, host='0.0.0.0', port=5000)