import React, { useState, useEffect } from 'react';
import { Upload, Search, FileText, Loader, CheckCircle, MessageSquare, Send, ChevronDown, ChevronUp } from 'lucide-react';
import TransparencyPanel from './components/TransparencyPanel';
import ProportionalityPanel from './components/ProportionalityPanel';
import SourceCard from './components/SourceCard';
import ContextPanel from './components/ContextPanel';
import GraphExplorer from './components/GraphExplorer';

// API Configuration - uses environment variable with fallback
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// ========== DUMMY-DATEN FÜR DESIGN-PREVIEW ==========

const DEMO_PAPERS = [
  {
    title: "Customer Experience Management: A Critical Review of an Emerging Idea",
    authors: "Verhoef, Peter C.; Lemon, Katherine N.; Parasuraman, A.",
    date: "2021-03-15",
    sources: "Customer Experience; Marketing; Service Quality; Management",
    vhbRanking: "A",
    abdcRanking: "A*",
    doi: "10.1016/j.jretai.2020.11.002",
    journal_name: "Journal of Retailing",
    citations: 342
  },
  {
    title: "Understanding Customer Experience Throughout the Customer Journey",
    authors: "Lemon, Katherine N.; Verhoef, Peter C.",
    date: "2016-11-01",
    sources: "Customer Journey; Touchpoints; Marketing; Customer Experience",
    vhbRanking: "A+",
    abdcRanking: "A*",
    doi: "10.1509/jm.15.0420",
    journal_name: "Journal of Marketing",
    citations: 891
  },
  {
    title: "Artificial Intelligence in Customer Experience: A Systematic Review",
    authors: "Klaus, Phil; Zaichkowsky, Judith",
    date: "2022-06-20",
    sources: "Artificial Intelligence; Customer Experience; Machine Learning; Digital",
    vhbRanking: "B",
    abdcRanking: "A",
    doi: "10.1108/JSM-02-2022-0045",
    journal_name: "Journal of Service Management",
    citations: 56
  },
  {
    title: "Digital Transformation and Customer Loyalty in Retail",
    authors: "Klaus, Phil; Verhoef, Peter C.",
    date: "2023-01-10",
    sources: "Digital Transformation; Customer Loyalty; Marketing; Retail",
    vhbRanking: "A",
    abdcRanking: "A",
    doi: "10.1016/j.jbusres.2022.12.001",
    journal_name: "Journal of Business Research",
    citations: 28
  },
  {
    title: "The Role of AI in Modern Marketing Strategies",
    authors: "Smith, John; Klaus, Phil",
    date: "2024-05-15",
    sources: "Artificial Intelligence; Marketing; Strategy; Digital",
    vhbRanking: "B",
    abdcRanking: "A",
    doi: "10.1016/j.jmr.2023.01.001",
    journal_name: "Journal of Marketing Research",
    citations: 12
  },
  {
    title: "Service Quality and Customer Satisfaction: A Meta-Analysis",
    authors: "Parasuraman, A.; Lemon, Katherine N.",
    date: "2017-08-20",
    sources: "Service Quality; Customer Satisfaction; Meta-Analysis; Marketing",
    vhbRanking: "A",
    abdcRanking: "A*",
    doi: "10.1016/j.jsr.2019.05.002",
    journal_name: "Journal of Service Research",
    citations: 523
  }
];

const DEMO_RESULTS = {
  answer: "Customer Experience (CX) bezeichnet die Gesamtheit aller Erfahrungen, die ein Kunde mit einem Unternehmen macht. Laut den analysierten Papers umfasst CX alle Interaktionen über verschiedene Touchpoints hinweg - von der ersten Wahrnehmung bis zur Nachkaufphase. Die Forschung zeigt, dass positive Customer Experience zu höherer Kundenloyalität und Weiterempfehlungsbereitschaft führt.",
  confidence: 0.85,
  graphUsed: true,
  cypherQuery: "MATCH (p:Paper)-[:HAS_KEYWORD]->(k:Keyword) WHERE k.name CONTAINS 'customer experience' RETURN p.title, p.authors LIMIT 5",
  sources: [
    {
      title: "Customer Experience Management: A Critical Review of an Emerging Idea",
      authors: "Verhoef, Peter C.; Lemon, Katherine N.; Parasuraman, A.",
      date: "2021-03-15",
      similarity: 0.92,
      doi: "10.1016/j.jretai.2020.11.002",
      url: "https://www.scopus.com/record/example1",
      journal_name: "Journal of Retailing",
      vhbRanking: "A",
      abdcRanking: "A*",
      citations: 342,
      abstract: "This paper provides a critical review of the customer experience concept and its management."
    },
    {
      title: "Understanding Customer Experience Throughout the Customer Journey",
      authors: "Lemon, Katherine N.; Verhoef, Peter C.",
      date: "2020-11-01",
      similarity: 0.87,
      doi: "10.1509/jm.15.0420",
      url: "https://www.scopus.com/record/example2",
      journal_name: "Journal of Marketing",
      vhbRanking: "A+",
      abdcRanking: "A*",
      citations: 891,
      abstract: "Customer experience is a multidimensional construct focusing on cognitive, emotional, and behavioral responses."
    },
    {
      title: "Artificial Intelligence in Customer Experience: A Systematic Review",
      authors: "Klaus, Phil; Zaichkowsky, Judith",
      date: "2022-06-20",
      similarity: 0.78,
      doi: "10.1108/JSM-02-2022-0045",
      url: "https://www.scopus.com/record/example3",
      journal_name: "Journal of Service Management",
      vhbRanking: "B",
      abdcRanking: "A",
      citations: 56,
      abstract: "This systematic review examines how AI technologies are transforming customer experience management."
    }
  ]
};

// ========== CITATION COMPONENT ==========

function AnswerWithCitations({ answer, sources = [] }) {
  const [hoveredCitation, setHoveredCitation] = useState(null);

  // Parse answer and replace [1], [2], etc. with interactive elements
  const renderAnswerWithCitations = () => {
    if (!answer) return null;

    // Split by citation pattern [number]
    const parts = answer.split(/(\[\d+\])/g);

    return parts.map((part, index) => {
      const match = part.match(/^\[(\d+)\]$/);
      if (match) {
        const citationNum = parseInt(match[1]);
        const source = sources[citationNum - 1];

        if (source) {
          return (
            <span
              key={index}
              className="relative inline-block"
              onMouseEnter={() => setHoveredCitation(citationNum)}
              onMouseLeave={() => setHoveredCitation(null)}
            >
              <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-semibold bg-indigo-100 text-indigo-700 rounded cursor-pointer hover:bg-indigo-200 transition-colors mx-0.5">
                {citationNum}
              </span>
              {hoveredCitation === citationNum && (
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-72 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl z-50">
                  <p className="font-semibold mb-1 line-clamp-2">{source.title}</p>
                  <p className="text-gray-300 text-xs">
                    {source.authors?.split(';')[0]?.trim()}, {source.date?.substring(0, 4)}
                  </p>
                  {source.journal_name && (
                    <p className="text-gray-400 text-xs italic mt-1">{source.journal_name}</p>
                  )}
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                    <div className="border-4 border-transparent border-t-gray-900"></div>
                  </div>
                </div>
              )}
            </span>
          );
        }
      }
      return <span key={index}>{part}</span>;
    });
  };

  return <>{renderAnswerWithCitations()}</>;
}

// ========== HAUPTKOMPONENTE ==========

export default function HybridRAGInterface() {
  // Upload State
  const [file, setFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('idle'); // idle, uploading, ready
  const [uploadProgress, setUploadProgress] = useState('');

  // Data State
  const [papers, setPapers] = useState([]);
  const [papersCount, setPapersCount] = useState(0);

  // Search State
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [searchTime, setSearchTime] = useState(0);

  // Timer for search progress
  useEffect(() => {
    let interval;
    if (searching) {
      setSearchTime(0);
      interval = setInterval(() => {
        setSearchTime(t => t + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [searching]);

  // UI State
  const [uploadExpanded, setUploadExpanded] = useState(true);

  // ========== DEMO MODUS ==========
  const activateDemoMode = () => {
    setPapers(DEMO_PAPERS);
    setPapersCount(DEMO_PAPERS.length);
    setUploadStatus('ready');
    setUploadProgress(`Demo: ${DEMO_PAPERS.length} Papers geladen`);
    setUploadExpanded(false);
  };

  // ========== UPLOAD HANDLER ==========
  const handleFileUpload = async (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setUploadStatus('uploading');
    setUploadProgress('Datei wird hochgeladen...');

    try {
      const formData = new FormData();
      formData.append('file', uploadedFile);

      const uploadResponse = await fetch(`${API_BASE_URL}/api/upload`, {
        method: 'POST',
        body: formData
      });

      if (!uploadResponse.ok) {
        throw new Error('Upload failed');
      }

      const uploadResult = await uploadResponse.json();
      // Use real papers from backend, fallback to demo if not available
      setPapers(uploadResult.papers || DEMO_PAPERS);
      setPapersCount(uploadResult.papers_count || 0);
      setUploadStatus('ready');
      setUploadProgress(`${uploadResult.papers_count} Papers verarbeitet`);
      setUploadExpanded(false);
    } catch (err) {
      // Fallback zu Demo bei Fehler
      setPapers(DEMO_PAPERS);
      setPapersCount(DEMO_PAPERS.length);
      setUploadStatus('ready');
      setUploadProgress(`Demo-Modus (Backend nicht verfügbar)`);
      setUploadExpanded(false);
    }
  };

  // ========== SEARCH HANDLER ==========
  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setShowResults(false);

    try {
      const response = await fetch(`${API_BASE_URL}/api/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: query.trim() })
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      setResults(data);
      setSearching(false);
      setShowResults(true);
    } catch (err) {
      // Fallback to demo results if backend unavailable
      console.warn('Backend unavailable, using demo results:', err);
      setResults(DEMO_RESULTS);
      setSearching(false);
      setShowResults(true);
    }
  };

  // ========== RENDER ==========
  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <header className="bg-white border-b px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-800">AI Knowledge Platform</h1>
          <p className="text-xs text-gray-500">
            Basierend auf den 5 epistemischen Prinzipien (Malik & Terzidis, 2025)
          </p>
        </div>
        {uploadStatus === 'idle' && (
          <button
            onClick={activateDemoMode}
            className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors text-sm font-medium"
          >
            Demo starten
          </button>
        )}
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Upload + Graph */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Upload Section - Collapsible */}
          {uploadStatus === 'idle' ? (
            <div className="p-4 bg-white border-b">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-indigo-400 transition-colors">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                  <FileText className="w-12 h-12 text-gray-400 mb-3" />
                  <p className="text-gray-600 mb-1">Excel oder CSV hochladen</p>
                  <p className="text-sm text-gray-400">.xlsx, .xls, .csv</p>
                </label>
              </div>
            </div>
          ) : (
            <div
              className="bg-white border-b cursor-pointer"
              onClick={() => setUploadExpanded(!uploadExpanded)}
            >
              <div className="px-4 py-2 flex items-center justify-between">
                <div className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                  <span className="text-sm text-gray-700">{uploadProgress}</span>
                </div>
                {uploadExpanded ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </div>
              {uploadExpanded && (
                <div className="px-4 pb-3 pt-1 border-t">
                  <div className="flex items-center space-x-2">
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="file-upload-2"
                    />
                    <label
                      htmlFor="file-upload-2"
                      className="text-sm text-indigo-600 hover:underline cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Andere Datei hochladen
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Graph Explorer */}
          {papers.length > 0 ? (
            <div className="flex-1 overflow-hidden p-4">
              <GraphExplorer papers={papers} highlightedSources={results?.sources} />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <Upload className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Lade Papers hoch oder starte den Demo-Modus</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar: Search & Results */}
        <div className="w-96 bg-white border-l flex flex-col flex-shrink-0">
          {/* Search Header */}
          <div className="p-4 border-b">
            <div className="flex items-center mb-3">
              <MessageSquare className="w-5 h-5 text-indigo-600 mr-2" />
              <h2 className="font-semibold text-gray-800">Fragen stellen</h2>
            </div>

            {/* Search Input */}
            <div className="flex space-x-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="z.B. Was ist Customer Experience?"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                disabled={papers.length === 0}
              />
              <button
                onClick={handleSearch}
                disabled={!query.trim() || searching || papers.length === 0}
                className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 transition-colors"
              >
                {searching ? (
                  <Loader className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>

            {/* Example Questions */}
            {papers.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {["Customer Experience?", "Papers von Klaus?", "AI Research?"].map((q) => (
                  <button
                    key={q}
                    onClick={() => setQuery(q)}
                    className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Results Area */}
          <div className="flex-1 overflow-y-auto">
            {!results && !searching && (
              <div className="h-full flex items-center justify-center text-gray-400 p-4">
                <div className="text-center">
                  <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">
                    {papers.length === 0
                      ? "Lade zuerst Papers hoch"
                      : "Stelle eine Frage zu deinen Papers"
                    }
                  </p>
                </div>
              </div>
            )}

            {searching && (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <Loader className="w-8 h-8 mx-auto mb-3 animate-spin text-indigo-600" />
                  <p className="text-sm text-gray-500 mb-2">
                    {searchTime < 5 ? 'Suche in Knowledge Graph...' :
                     searchTime < 15 ? 'Generiere Antwort mit LLM...' :
                     searchTime < 30 ? 'Analysiere Quellen...' :
                     'Bitte warten, komplexe Anfrage...'}
                  </p>
                  <p className="text-xs text-gray-400">{searchTime}s</p>
                  {searchTime > 20 && (
                    <p className="text-xs text-amber-500 mt-2">LLM-Antworten können bis zu 2 Minuten dauern</p>
                  )}
                </div>
              </div>
            )}

            {showResults && results && (
              <div className="p-4 space-y-4">
                {/* Answer */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-800">Antwort</h3>
                    {results.graphUsed && (
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                        Knowledge Graph
                      </span>
                    )}
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700 leading-relaxed">
                    <AnswerWithCitations answer={results.answer} sources={results.sources} />
                  </div>
                </div>

                {/* Cypher Query - Traceability */}
                {results.cypherQuery && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs font-medium text-gray-500 mb-1">Cypher Query:</p>
                    <code className="text-xs text-gray-600 block bg-white p-2 rounded border overflow-x-auto">
                      {results.cypherQuery}
                    </code>
                  </div>
                )}

                {/* Epistemic Panels */}
                <TransparencyPanel confidence={results.confidence} sources={results.sources} />
                <ProportionalityPanel sources={results.sources} />
                <ContextPanel sources={results.sources} totalPapers={papersCount} query={query} />

                {/* Sources */}
                <div>
                  <h4 className="font-semibold text-gray-800 mb-3">
                    Quellen ({results.sources?.length})
                  </h4>
                  <div className="space-y-3">
                    {results.sources?.map((source, idx) => (
                      <SourceCard key={idx} source={source} index={idx + 1} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t px-4 py-2 text-center text-xs text-gray-400 flex-shrink-0">
        Transparenz | Nachvollziehbarkeit | Proportionalität | Intersubjektivität | Kontextualisierung
      </footer>
    </div>
  );
}
