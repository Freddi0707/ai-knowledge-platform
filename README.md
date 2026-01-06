# ai-knowledge-platform

# ============================================================
# INSTALLATION INSTRUCTIONS
# ============================================================
# 
# 1. Create virtual environment (RECOMMENDED):
#    python -m venv venv
#
# 2. Activate virtual environment:
#    - Windows:     venv\Scripts\activate
#    - macOS/Linux: source venv/bin/activate
#
# 3. Upgrade pip (optional but recommended):
#    pip install --upgrade pip
#
# 4. Install Python dependencies:
#    pip install -r requirements.txt
#
# 5. Download spaCy model:
#    python -m spacy download en_core_web_sm
#
# 6. Install Ollama (separate binary):
#    - Visit: https://ollama.ai/download
#    - Or use: curl https://ollama.ai/install.sh | sh
#
# 7. Pull LLM model:
#    ollama pull llama3.2
#
# 8. Start Neo4j:
#    
#    OPTION A - Neo4j Desktop (Recommended for Development):
#      a. Open Neo4j Desktop
#      b. Create a new project (or use existing)
#      c. Add a local DBMS (database)
#      d. Set password (remember this!)
#      e. Start the database
#      f. Note the connection details:
#         - Bolt URL: bolt://localhost:7687 (default)
#         - HTTP URL: http://localhost:7474 (browser)
#         - Username: neo4j
#         - Password: [your password]
#      g. To import CSVs in Desktop:
#         - Click on database → Open folder → Import
#         - Copy your CSV files from ./neo4j/import to this folder
#         - Open Neo4j Browser and run the import.cypher script
#    
#    OPTION B - Docker (Recommended for Production):
#      docker run -d \
#        --name neo4j \
#        -p 7474:7474 -p 7687:7687 \
#        -e NEO4J_AUTH=neo4j/password \
#        -v $PWD/neo4j/data:/data \
#        -v $PWD/neo4j/import:/var/lib/neo4j/import \
#        neo4j:latest
#
# 9. Update Neo4j password in main.py:
#    NEO4J_PASS = "password"  # Change to your actual password
#
# 10. Run the system:
#     python main.py
#
# ============================================================
# TROUBLESHOOTING
# ============================================================
#
# - If ChromaDB fails: pip install --upgrade chromadb
# - If PyTorch is slow: Install CUDA version for GPU support
# - If Neo4j won't connect: Check Docker is running and port 7687 is free
# - If Ollama errors: Make sure ollama serve is running in background
#
# ============================================================
