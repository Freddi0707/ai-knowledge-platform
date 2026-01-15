
# backend/search.py
"""
Hybrid Search Engine: Combines Vector Search (ChromaDB) + Knowledge Graph (Neo4j)
"""

import os
import shutil
from sentence_transformers import SentenceTransformer
from chromadb import PersistentClient
from langchain_ollama import OllamaLLM
from langchain_community.graphs import Neo4jGraph
from langchain_community.chains.graph_qa.cypher import GraphCypherQAChain
from langchain_core.prompts import PromptTemplate
from neo4j import GraphDatabase  # Plain driver for direct Cypher (no APOC needed)
from backend.etl import safe_str


def create_documents_and_metadata(df):
    """Prepare documents for embedding"""
    contents, metadatas, ids = [], [], []

    for _, row in df.iterrows():
        doi = safe_str(row.get("doi", "")).strip()
        if not doi:
            continue

        title = row["title"]
        abstract = row["abstract"]
        url = row.get("url", "")
        link = url if url else f"https://doi.org/{doi}"

        # Document for embedding
        content = f"""
Title: {title}
Abstract: {abstract}
Authors: {row["authors"]}
Journal: {row["journal_name"]}
Year: {row["date"]}
""".strip()

        # Metadata - include all fields for search results
        snippet = abstract[:200].strip() + ("..." if len(abstract) > 200 else "")

        contents.append(content)
        metadatas.append({
            "title": title,
            "authors": row["authors"],
            "journal": row["journal_name"],
            "year": row["date"],
            "doi": doi,
            "url": link,
            "abstract_snippet": snippet,
            "abstract": abstract,  # Full abstract
            "access_link": link,
            "vhbRanking": safe_str(row.get("vhbRanking", "")),
            "abdcRanking": safe_str(row.get("abdcRanking", "")),
            "citations": safe_str(row.get("citations", ""))
        })
        ids.append(doi)

    return contents, metadatas, ids


def create_vector_store(contents, metadatas, ids, db_path, collection_name):
    """Create ChromaDB vector store with better lock handling"""
    import shutil
    import time

    print("\n🧮 Generating embeddings...")

    model = SentenceTransformer("all-MiniLM-L6-v2")
    embeddings = model.encode(contents, normalize_embeddings=True).tolist()

    # Force close any existing connections
    if os.path.exists(db_path):
        print("🧹 Cleaning up old database...")
        max_attempts = 3
        for attempt in range(max_attempts):
            try:
                shutil.rmtree(db_path)
                print("✅ Old database removed")
                break
            except PermissionError:
                if attempt < max_attempts - 1:
                    print(f"⚠️ Database locked, retrying ({attempt + 1}/{max_attempts})...")
                    time.sleep(2)
                else:
                    # Use a new path if still locked
                    db_path = f"{db_path}_{int(time.time())}"
                    print(f"⚠️ Using new path: {db_path}")

    client = PersistentClient(path=db_path)
    collection = client.get_or_create_collection(
        name=collection_name,
        metadata={"hnsw:space": "cosine"}
    )

    collection.add(
        ids=ids,
        embeddings=embeddings,
        documents=contents,
        metadatas=metadatas
    )

    print(f"✅ Indexed {len(ids)} documents")


class HybridSearchEngine:
    """Combines semantic search + knowledge graph"""

    def __init__(self, db_path, collection_name, neo4j_url, neo4j_user, neo4j_pass, llm_model="llama3.2"):
        print("\n🚀 Initializing Hybrid Search Engine...")

        # LLM - Using faster model by default
        self.llm = OllamaLLM(
            model=llm_model,
            temperature=0.7,
            num_predict=512,  # Limit response length for speed
            timeout=120  # 2 minutes timeout
        )
        print(f"✅ LLM loaded ({llm_model})")

        # Vector store
        self.vector_model = SentenceTransformer("all-MiniLM-L6-v2")
        self.collection = PersistentClient(path=db_path).get_collection(collection_name)
        print("✅ Vector store connected")

        # Knowledge graph - use plain neo4j driver for direct Cypher (no APOC needed)
        self.graph_chain = None
        self.neo4j_driver = None
        try:
            # Use plain neo4j driver - doesn't require APOC
            self.neo4j_driver = GraphDatabase.driver(neo4j_url, auth=(neo4j_user, neo4j_pass))

            # Test connection with a simple query
            with self.neo4j_driver.session() as session:
                result = session.run("RETURN 1 as test")
                result.single()

            self.graph_available = True
            print("✅ Knowledge graph connected (direct Cypher)")

            # Optionally try LangChain QA chain (needs APOC - usually unavailable)
            try:
                self.graph = Neo4jGraph(url=neo4j_url, username=neo4j_user, password=neo4j_pass)
                cypher_prompt = PromptTemplate(
                    input_variables=["schema", "question"],
                    template="""You are a Neo4j expert. Write a Cypher query for this question.

Schema: {schema}
Question: {question}

Rules:
- Use MATCH to find patterns
- Use WHERE for filtering
- LIMIT results to 10
- Return only the Cypher query

Cypher Query:"""
                )

                self.graph_chain = GraphCypherQAChain.from_llm(
                    llm=self.llm,
                    graph=self.graph,
                    cypher_prompt=cypher_prompt,
                    verbose=True,
                    return_intermediate_steps=True
                )
                print("✅ LangChain QA Chain available (APOC found)")
            except Exception as chain_error:
                # APOC not available - that's OK, we can still use direct Cypher
                print(f"ℹ️ LangChain QA Chain unavailable (APOC plugin not installed)")

        except Exception as e:
            print(f"⚠️ Neo4j connection failed: {e}")
            self.graph_available = False

    def _run_cypher(self, cypher: str, params: dict = None) -> list:
        """Run Cypher query using plain neo4j driver"""
        if not self.neo4j_driver:
            return []
        with self.neo4j_driver.session() as session:
            result = session.run(cypher, params or {})
            return [dict(record) for record in result]

    def should_use_graph(self, query: str) -> bool:
        """Check if query needs graph data"""
        if not self.graph_available:
            print("   [DEBUG] Graph not available")
            return False

        query_lower = query.lower()

        # Check for "written" in any form
        if "written" in query_lower:
            print(f"   [DEBUG] Found 'written' in query")
            return True

        # Check for "author" keyword
        if "author" in query_lower:
            print(f"   [DEBUG] Found 'author' in query")
            return True

        # Check for "wrote" keyword
        if "wrote" in query_lower:
            print(f"   [DEBUG] Found 'wrote' in query")
            return True

        # Check for keyword-related queries
        if any(kw in query_lower for kw in ["keyword", "topic", "about", "related to", "papers on", "research on"]):
            print(f"   [DEBUG] Found keyword/topic pattern in query")
            return True

        print(f"   [DEBUG] No graph patterns matched in: {query_lower}")
        return False

    def semantic_search(self, query: str, n_results: int = 2, threshold: float = 0.30):
        """Semantic search via embeddings (reduced to 2 results for speed)"""
        q_emb = self.vector_model.encode(query, normalize_embeddings=True).tolist()

        results = self.collection.query(
            query_embeddings=[q_emb],
            n_results=n_results,
            include=["metadatas", "distances", "documents"]
        )

        distances = results["distances"][0]
        similarities = [1 - d for d in distances]

        if not similarities or similarities[0] < threshold:
            return None, None, 0

        return results, similarities, similarities[0]

    def graph_search(self, query: str):
        """Query knowledge graph with direct queries for common patterns"""
        if not self.graph_available:
            return {"success": False, "error": "Graph unavailable"}

        try:
            query_lower = query.lower()

            # Extract author name more intelligently
            def extract_author_name(text):
                """Extract author name from query"""
                import re

                # Pattern 1: "by [Name]" or "written by [Name]"
                match = re.search(r'\b(?:by|from|of)\s+([A-Z][a-zäöüß]+(?:\s+[A-Z][a-zäöüß]+)*)', text)
                if match:
                    return match.group(1)

                # Pattern 2: Just find any capitalized name
                words = text.split()
                for i, word in enumerate(words):
                    if word and word[0].isupper() and word.lower() not in ['which', 'who', 'what', 'paper', 'papers',
                                                                           'author', 'authors']:
                        # Collect consecutive capitalized words
                        name_parts = [word.strip("?,.")]
                        j = i + 1
                        while j < len(words) and words[j] and words[j][0].isupper():
                            name_parts.append(words[j].strip("?,."))
                            j += 1
                        return " ".join(name_parts)

                return None

            # Pattern 1: "papers by [author]" or "written by [author]"
            if any(phrase in query_lower for phrase in
                   ["papers by", "written by", "works by", "paper were written", "paper was written"]):
                author_name = extract_author_name(query)

                if author_name:
                    # Try exact match first, then partial match
                    cypher = f"""
                    MATCH (a:Author)-[:AUTHORED]->(p:Paper)
                    WHERE a.name CONTAINS '{author_name}'
                    RETURN a.name as author, p.title as title, p.doi as doi
                    LIMIT 10
                    """
                    results = self._run_cypher(cypher)

                    if results:
                        result_text = f"Found {len(results)} paper(s) by authors matching '{author_name}':\n"
                        dois = []
                        for r in results:
                            result_text += f"\n• '{r['title']}' by {r['author']}"
                            if r.get('doi'):
                                dois.append(r['doi'])
                        return {"success": True, "cypher": cypher, "result": result_text, "dois": dois}
                    else:
                        # Try last name only
                        last_name = author_name.split()[-1]
                        cypher = f"""
                        MATCH (a:Author)-[:AUTHORED]->(p:Paper)
                        WHERE a.name CONTAINS '{last_name}'
                        RETURN a.name as author, p.title as title, p.doi as doi
                        LIMIT 10
                        """
                        results = self._run_cypher(cypher)

                        if results:
                            result_text = f"Found {len(results)} paper(s) by authors with last name '{last_name}':\n"
                            dois = []
                            for r in results:
                                result_text += f"\n• '{r['title']}' by {r['author']}"
                                if r.get('doi'):
                                    dois.append(r['doi'])
                            return {"success": True, "cypher": cypher, "result": result_text, "dois": dois}

            # Pattern 2: "who collaborated with [author]"
            if "collaborated" in query_lower or "co-author" in query_lower:
                author_name = extract_author_name(query)

                if author_name:
                    cypher = f"""
                    MATCH (a1:Author)-[:AUTHORED]->(p:Paper)<-[:AUTHORED]-(a2:Author)
                    WHERE a1.name CONTAINS '{author_name}'
                    AND a1 <> a2
                    RETURN DISTINCT a2.name as collaborator, p.title as paper, p.doi as doi
                    LIMIT 10
                    """
                    results = self._run_cypher(cypher)

                    if results:
                        result_text = f"Authors who collaborated with {author_name}:\n"
                        collaborators = set()
                        dois = []
                        for r in results:
                            collaborators.add(r['collaborator'])
                            if r.get('doi'):
                                dois.append(r['doi'])
                        for collab in collaborators:
                            result_text += f"\n• {collab}"
                        return {"success": True, "cypher": cypher, "result": result_text, "dois": dois}

            # Pattern 3: "papers by same author" or "authors with multiple papers"
            if "same author" in query_lower or "multiple papers" in query_lower:
                cypher = """
                MATCH (a:Author)-[:AUTHORED]->(p:Paper)
                WITH a, count(p) as paper_count, collect(p.title) as papers
                WHERE paper_count > 1
                RETURN a.name as author, paper_count, papers
                ORDER BY paper_count DESC
                """
                results = self._run_cypher(cypher)

                if results:
                    result_text = "Authors with multiple papers:\n"
                    for r in results:
                        result_text += f"\n• {r['author']} ({r['paper_count']} papers):"
                        for paper in r['papers']:
                            result_text += f"\n  - {paper}"
                    return {"success": True, "cypher": cypher, "result": result_text}

            # Pattern 4: List all authors
            if "all authors" in query_lower or "list authors" in query_lower:
                cypher = """
                MATCH (a:Author)
                RETURN a.name as author
                ORDER BY a.name
                """
                results = self._run_cypher(cypher)

                if results:
                    result_text = f"All authors in database ({len(results)} total):\n"
                    for r in results:
                        result_text += f"\n• {r['author']}"
                    return {"success": True, "cypher": cypher, "result": result_text}

            # Pattern 5: Papers by keyword/topic
            if any(phrase in query_lower for phrase in ["papers about", "papers on", "research on", "topic", "keyword"]):
                # Extract the topic/keyword from query
                import re
                topic_match = re.search(r'(?:about|on|topic|keyword)[:\s]+["\']?([^"\'?,]+)["\']?', query_lower)
                if topic_match:
                    topic = topic_match.group(1).strip()
                else:
                    # Try to extract any quoted term or the last significant word
                    words = query_lower.replace("?", "").split()
                    topic = words[-1] if words else None

                if topic:
                    cypher = f"""
                    MATCH (p:Paper)-[:HAS_KEYWORD]->(k:Keyword)
                    WHERE toLower(k.name) CONTAINS toLower($topic)
                    RETURN DISTINCT p.title as title, p.doi as doi, collect(k.name) as keywords
                    LIMIT 10
                    """
                    results = self._run_cypher(cypher, {"topic": topic})

                    if results:
                        result_text = f"Found {len(results)} paper(s) related to '{topic}':\n"
                        dois = []
                        for r in results:
                            keywords_str = ", ".join(r['keywords'][:3]) if r['keywords'] else ""
                            result_text += f"\n• '{r['title']}' (keywords: {keywords_str})"
                            if r.get('doi'):
                                dois.append(r['doi'])
                        return {"success": True, "cypher": cypher, "result": result_text, "dois": dois}

            # Pattern 6: List all keywords/topics
            if any(phrase in query_lower for phrase in ["all keywords", "list keywords", "all topics", "list topics", "what topics"]):
                cypher = """
                MATCH (k:Keyword)<-[:HAS_KEYWORD]-(p:Paper)
                WITH k.name as keyword, k.type as type, count(p) as paper_count
                RETURN keyword, type, paper_count
                ORDER BY paper_count DESC
                LIMIT 30
                """
                results = self._run_cypher(cypher)

                if results:
                    result_text = f"Top keywords/topics ({len(results)} shown):\n"
                    for r in results:
                        type_label = f" [{r['type']}]" if r.get('type') else ""
                        result_text += f"\n• {r['keyword']}{type_label} ({r['paper_count']} papers)"
                    return {"success": True, "cypher": cypher, "result": result_text}

            # Fallback: Use LLM to generate Cypher (if available) or suggest alternatives
            if self.graph_chain:
                response = self.graph_chain.invoke({"query": query})

                cypher = "N/A"
                if "intermediate_steps" in response and response["intermediate_steps"]:
                    cypher = response["intermediate_steps"][0].get("query", "N/A")

                result_text = response.get("result", "No results")

                # If LLM result is empty, provide helpful message
                if not result_text or "don't know" in result_text.lower():
                    result_text = "No results found. Try queries like:\n• 'Which papers were written by Klaus?'\n• 'Who collaborated with Maklan?'\n• 'Show me authors with multiple papers'"

                return {
                    "success": True,
                    "cypher": cypher,
                    "result": result_text
                }
            else:
                # No LangChain QA chain available, provide helpful message
                return {
                    "success": False,
                    "cypher": None,
                    "result": "No matching pattern found. Try queries like:\n• 'Papers written by [Author Name]'\n• 'Who collaborated with [Author Name]'\n• 'Papers about [topic]'\n• 'List all authors'\n• 'What topics are covered?'"
                }

        except Exception as e:
            return {"success": False, "error": str(e), "result": f"Error: {e}"}

    def hybrid_answer(self, query: str):
        """Main hybrid search method"""
        import time as time_module

        print(f"\n{'=' * 60}")
        print(f"🔍 Query: {query}")
        print(f"{'=' * 60}")

        # Transparency tracking
        transparency = {
            "steps": [],
            "timing": {},
            "methods_used": []
        }
        total_start = time_module.time()

        # Check if graph search is needed FIRST (for author/keyword queries)
        use_graph = self.should_use_graph(query)
        print(f"\n🔍 Graph search needed: {use_graph}")

        # Semantic search
        print("\n📚 Running semantic search...")
        step_start = time_module.time()
        vector_results, similarities, best_score = self.semantic_search(query)
        transparency["timing"]["semantic_search"] = round(time_module.time() - step_start, 2)
        transparency["methods_used"].append("Semantic Search (ChromaDB + Embeddings)")
        transparency["steps"].append({
            "name": "Semantic Search",
            "description": f"Searched {self.collection.count()} documents using sentence embeddings",
            "result": f"Found {len(similarities) if similarities else 0} relevant papers (best match: {best_score:.1%})"
        })

        # If no semantic results BUT graph is needed, try graph-only answer
        if vector_results is None:
            if use_graph:
                print("\n🔗 No semantic results, trying graph-only search...")
                step_start = time_module.time()
                graph_response = self.graph_search(query)
                transparency["timing"]["graph_search"] = round(time_module.time() - step_start, 2)

                if graph_response["success"]:
                    transparency["methods_used"].append("Knowledge Graph (Neo4j)")
                    transparency["steps"].append({
                        "name": "Graph Search",
                        "description": "Queried Neo4j knowledge graph for structured relationships",
                        "result": "Found results via graph query",
                        "cypher": graph_response.get("cypher")
                    })

                    # Fetch full metadata for DOIs found in graph search
                    sources = []
                    similarities = []
                    graph_dois = graph_response.get("dois", [])
                    if graph_dois:
                        try:
                            # Get metadata from vector store for these DOIs
                            graph_results = self.collection.get(
                                ids=graph_dois,
                                include=["metadatas"]
                            )
                            if graph_results and graph_results.get("metadatas"):
                                sources = graph_results["metadatas"]
                                similarities = [1.0] * len(sources)  # Graph matches are exact
                        except Exception as e:
                            print(f"   Could not fetch metadata for graph DOIs: {e}")

                    transparency["timing"]["total"] = round(time_module.time() - total_start, 2)

                    return {
                        "answer": graph_response["result"],
                        "sources": sources,
                        "similarities": similarities,
                        "best_score": 1.0 if sources else 0,
                        "graph_used": True,
                        "cypher_query": graph_response.get("cypher"),
                        "transparency": transparency
                    }

            # No results from either search
            transparency["timing"]["total"] = round(time_module.time() - total_start, 2)
            return {
                "answer": "❌ No relevant papers found.",
                "sources": [],
                "similarities": [],
                "best_score": 0,
                "graph_used": False,
                "transparency": transparency
            }

        print(f"✅ Found {len(vector_results['documents'][0])} papers (score: {best_score:.3f})")

        # Extract context with numbered citations
        docs = vector_results["documents"][0]
        metas = vector_results["metadatas"][0]
        semantic_context = "\n\n".join([
            f"[{i+1}] {metas[i].get('title', 'Unknown')} ({metas[i].get('authors', 'Unknown').split(';')[0].split(',')[0]}, {metas[i].get('date', '')[:4]}): {doc}"
            for i, doc in enumerate(docs)
        ])

        graph_context = ""
        cypher_query = None

        if use_graph:
            print("\n🔗 Running graph query...")
            step_start = time_module.time()
            graph_response = self.graph_search(query)
            transparency["timing"]["graph_search"] = round(time_module.time() - step_start, 2)

            print(f"   Graph response success: {graph_response.get('success')}")  # DEBUG

            if graph_response["success"]:
                graph_context = graph_response["result"]
                cypher_query = graph_response["cypher"]
                transparency["methods_used"].append("Knowledge Graph (Neo4j)")
                transparency["steps"].append({
                    "name": "Graph Search",
                    "description": "Queried Neo4j knowledge graph for structured relationships",
                    "result": f"Found graph data using Cypher query",
                    "cypher": cypher_query
                })
                print(f"✅ Graph query successful")
                print(f"   Result preview: {graph_context[:100]}...")  # DEBUG
            else:
                transparency["steps"].append({
                    "name": "Graph Search",
                    "description": "Attempted graph query but no results found",
                    "result": graph_response.get('error', 'No matching pattern')
                })
                print(f"⚠️ Graph query failed: {graph_response.get('error')}")
        else:
            transparency["steps"].append({
                "name": "Graph Search",
                "description": "Skipped - query doesn't require graph patterns",
                "result": "Not needed for this query type"
            })
            print("\n📄 Semantic only (no graph needed)")

        # Generate answer
        print("\n🤖 Generating answer (this may take 10-30 seconds)...")
        step_start = time_module.time()

        if use_graph and graph_context and "No results found" not in graph_context:
            prompt = f"""Answer the question using the numbered sources below. Use inline citations like [1], [2] to reference specific papers.

SOURCES:
{semantic_context}

GRAPH CONTEXT:
{graph_context}

QUESTION: {query}

INSTRUCTIONS:
- Write 2-3 paragraphs maximum
- Use [1], [2], [3] etc. to cite sources inline
- Only cite sources that directly support your statements
- Be concise and factual

ANSWER:"""
        else:
            prompt = f"""Answer the question using the numbered sources below. Use inline citations like [1], [2] to reference specific papers.

SOURCES:
{semantic_context}

QUESTION: {query}

INSTRUCTIONS:
- Write 2-3 paragraphs maximum
- Use [1], [2], [3] etc. to cite sources inline
- Only cite sources that directly support your statements
- Be concise and factual

ANSWER:"""

        try:
            answer = self.llm.invoke(prompt)
            transparency["timing"]["llm_generation"] = round(time_module.time() - step_start, 2)
            transparency["methods_used"].append(f"LLM Answer Generation (Ollama)")
            transparency["steps"].append({
                "name": "LLM Generation",
                "description": f"Generated answer using local LLM model",
                "result": f"Answer generated in {transparency['timing']['llm_generation']}s"
            })
            print("✅ Answer generated")
        except Exception as e:
            print(f"⚠️ LLM timeout or error: {e}")
            answer = "⚠️ Answer generation timed out. Please try a simpler question or use a faster model."
            transparency["steps"].append({
                "name": "LLM Generation",
                "description": "LLM answer generation failed",
                "result": str(e)
            })

        # Total timing
        transparency["timing"]["total"] = round(time_module.time() - total_start, 2)
        transparency["prompt"] = prompt  # Include the actual prompt for full transparency

        return {
            "answer": answer,
            "sources": vector_results["metadatas"][0],
            "similarities": similarities,
            "best_score": best_score,
            "graph_used": use_graph and graph_context and "No results found" not in graph_context,
            "cypher_query": cypher_query,
            "transparency": transparency
        }