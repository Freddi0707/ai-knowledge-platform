
# backend/search.py
"""
Hybrid Search Engine: Combines Vector Search (ChromaDB) + Knowledge Graph (Neo4j)
"""

import os
import shutil
from sentence_transformers import SentenceTransformer
from chromadb import PersistentClient
from langchain_community.llms import Ollama
from langchain_community.graphs import Neo4jGraph
from langchain_community.chains.graph_qa.cypher import GraphCypherQAChain
from langchain_core.prompts import PromptTemplate

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

        # Metadata
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
            "access_link": link
        })
        ids.append(doi)

    return contents, metadatas, ids


def create_vector_store(contents, metadatas, ids, db_path, collection_name):
    """Createvector store"""
    print("\n🧮 Generating embeddings...")

    model = SentenceTransformer("all-MiniLM-L6-v2")
    embeddings = model.encode(contents, normalize_embeddings=True).tolist()

    if os.path.exists(db_path):
        shutil.rmtree(db_path)

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
        self.llm = Ollama(
            model=llm_model,
            temperature=0.7,
            num_predict=512  # Limit response length for speed
        )
        print(f"✅ LLM loaded ({llm_model})")

        # Vector store
        self.vector_model = SentenceTransformer("all-MiniLM-L6-v2")
        self.collection = PersistentClient(path=db_path).get_collection(collection_name)
        print("✅ Vector store connected")

        # Knowledge graph
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

            self.graph_available = True
            print("✅ Knowledge graph connected")

        except Exception as e:
            print(f"⚠️ Neo4j unavailable: {e}")
            self.graph_available = False

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
                    results = self.graph.query(cypher)

                    if results:
                        result_text = f"Found {len(results)} paper(s) by authors matching '{author_name}':\n"
                        for r in results:
                            result_text += f"\n• '{r['title']}' by {r['author']}"
                        return {"success": True, "cypher": cypher, "result": result_text}
                    else:
                        # Try last name only
                        last_name = author_name.split()[-1]
                        cypher = f"""
                        MATCH (a:Author)-[:AUTHORED]->(p:Paper)
                        WHERE a.name CONTAINS '{last_name}'
                        RETURN a.name as author, p.title as title, p.doi as doi
                        LIMIT 10
                        """
                        results = self.graph.query(cypher)

                        if results:
                            result_text = f"Found {len(results)} paper(s) by authors with last name '{last_name}':\n"
                            for r in results:
                                result_text += f"\n• '{r['title']}' by {r['author']}"
                            return {"success": True, "cypher": cypher, "result": result_text}

            # Pattern 2: "who collaborated with [author]"
            if "collaborated" in query_lower or "co-author" in query_lower:
                author_name = extract_author_name(query)

                if author_name:
                    cypher = f"""
                    MATCH (a1:Author)-[:AUTHORED]->(p:Paper)<-[:AUTHORED]-(a2:Author)
                    WHERE a1.name CONTAINS '{author_name}'
                    AND a1 <> a2
                    RETURN DISTINCT a2.name as collaborator, p.title as paper
                    LIMIT 10
                    """
                    results = self.graph.query(cypher)

                    if results:
                        result_text = f"Authors who collaborated with {author_name}:\n"
                        collaborators = set()
                        for r in results:
                            collaborators.add(r['collaborator'])
                        for collab in collaborators:
                            result_text += f"\n• {collab}"
                        return {"success": True, "cypher": cypher, "result": result_text}

            # Pattern 3: "papers by same author" or "authors with multiple papers"
            if "same author" in query_lower or "multiple papers" in query_lower:
                cypher = """
                MATCH (a:Author)-[:AUTHORED]->(p:Paper)
                WITH a, count(p) as paper_count, collect(p.title) as papers
                WHERE paper_count > 1
                RETURN a.name as author, paper_count, papers
                ORDER BY paper_count DESC
                """
                results = self.graph.query(cypher)

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
                results = self.graph.query(cypher)

                if results:
                    result_text = f"All authors in database ({len(results)} total):\n"
                    for r in results:
                        result_text += f"\n• {r['author']}"
                    return {"success": True, "cypher": cypher, "result": result_text}

            # Fallback: Use LLM to generate Cypher
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

        except Exception as e:
            return {"success": False, "error": str(e), "result": f"Error: {e}"}

    def hybrid_answer(self, query: str):
        """Main hybrid search method"""
        print(f"\n{'=' * 60}")
        print(f"🔍 Query: {query}")
        print(f"{'=' * 60}")

        # Semantic search
        print("\n📚 Running semantic search...")
        vector_results, similarities, best_score = self.semantic_search(query)

        if vector_results is None:
            return {
                "answer": "❌ No relevant papers found.",
                "sources": [],
                "similarities": [],
                "best_score": 0,
                "graph_used": False
            }

        print(f"✅ Found {len(vector_results['documents'][0])} papers (score: {best_score:.3f})")

        # Extract context
        semantic_context = "\n\n".join(vector_results["documents"][0])

        # Check if graph needed
        use_graph = self.should_use_graph(query)
        print(f"\n🔍 Graph search needed: {use_graph}")  # DEBUG

        graph_context = ""
        cypher_query = None

        if use_graph:
            print("\n🔗 Running graph query...")
            graph_response = self.graph_search(query)

            print(f"   Graph response success: {graph_response.get('success')}")  # DEBUG

            if graph_response["success"]:
                graph_context = graph_response["result"]
                cypher_query = graph_response["cypher"]
                print(f"✅ Graph query successful")
                print(f"   Result preview: {graph_context[:100]}...")  # DEBUG
            else:
                print(f"⚠️ Graph query failed: {graph_response.get('error')}")
        else:
            print("\n📄 Semantic only (no graph needed)")

        # Generate answer
        print("\n🤖 Generating answer (this may take 10-30 seconds)...")

        if use_graph and graph_context and "No results found" not in graph_context:
            prompt = f"""Answer using both sources:

📚 PAPERS: {semantic_context}
🔗 GRAPH: {graph_context}

QUESTION: {query}

Provide a clear, concise answer (2-3 paragraphs max) citing specific papers.
ANSWER:"""
        else:
            prompt = f"""Answer based on these papers:

{semantic_context}

QUESTION: {query}

Provide a clear, concise answer (2-3 paragraphs max).
ANSWER:"""

        try:
            answer = self.llm.invoke(prompt)
            print("✅ Answer generated")
        except Exception as e:
            print(f"⚠️ LLM timeout or error: {e}")
            answer = "⚠️ Answer generation timed out. Please try a simpler question or use a faster model."

        return {
            "answer": answer,
            "sources": vector_results["metadatas"][0],
            "similarities": similarities,
            "best_score": best_score,
            "graph_used": use_graph and graph_context and "No results found" not in graph_context,
            "cypher_query": cypher_query
        }