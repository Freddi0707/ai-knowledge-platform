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
