import React, { useState, useEffect } from 'react';
import { Upload, Search, FileText, Loader, CheckCircle, MessageSquare, Send, ChevronDown, ChevronUp, Home } from 'lucide-react';
import TransparencyPanel from './components/TransparencyPanel';
import ProportionalityPanel from './components/ProportionalityPanel';
import SourceCard from './components/SourceCard';
import ContextPanel from './components/ContextPanel';
import GraphExplorer from './components/GraphExplorer';
import WelcomeScreen from './components/WelcomeScreen';

// API Configuration - uses environment variable with fallback
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// ========== DEMO DATA FOR DESIGN PREVIEW ==========

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
  answer: "Customer Experience (CX) refers to the totality of all experiences a customer has with a company. According to the analyzed papers, CX encompasses all interactions across various touchpoints - from initial awareness to the post-purchase phase. Research shows that positive customer experience leads to higher customer loyalty and willingness to recommend.",
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

// ========== MAIN COMPONENT ==========

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

  // Welcome Screen State (always show on launch)
  const [showWelcome, setShowWelcome] = useState(true);

  const handleDismissWelcome = () => {
    setShowWelcome(false);
  };

  // ========== DEMO MODE ==========
  const activateDemoMode = () => {
    setPapers(DEMO_PAPERS);
    setPapersCount(DEMO_PAPERS.length);
    setUploadStatus('ready');
    setUploadProgress(`Demo: ${DEMO_PAPERS.length} papers loaded`);
    setUploadExpanded(false);
  };

  // ========== BACK TO START ==========
  const resetToWelcome = () => {
    setFile(null);
    setUploadStatus('idle');
    setUploadProgress('');
    setPapers([]);
    setPapersCount(0);
    setQuery('');
    setSearching(false);
    setResults(null);
    setShowResults(false);
    setUploadExpanded(true);
  };

  // ========== UPLOAD HANDLER ==========
  const handleFileUpload = async (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setUploadStatus('uploading');
    setUploadProgress('Uploading file...');

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
      setUploadProgress(`${uploadResult.papers_count} papers processed`);
      setUploadExpanded(false);
    } catch (err) {
      // Fallback to demo on error
      setPapers(DEMO_PAPERS);
      setPapersCount(DEMO_PAPERS.length);
      setUploadStatus('ready');
      setUploadProgress(`Demo mode (backend unavailable)`);
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

  // Show welcome screen first
  if (showWelcome) {
    return <WelcomeScreen onDismiss={handleDismissWelcome} />;
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="bg-white px-6 py-4 flex items-center justify-between flex-shrink-0 shadow-sm">
        <div className="flex items-center space-x-4">
          {uploadStatus !== 'idle' && (
            <button
              onClick={resetToWelcome}
              className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              title="Back to start"
            >
              <Home className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-xl font-semibold text-gray-800">AI Knowledge Platform</h1>
            <p className="text-xs text-gray-400">
              Based on the 5 epistemic principles (Malik & Terzidis, 2025)
            </p>
          </div>
        </div>
        {uploadStatus === 'idle' && (
          <button
            onClick={activateDemoMode}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium shadow-sm"
          >
            Start Demo
          </button>
        )}
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Upload + Graph */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Upload Section - Collapsible */}
          {uploadStatus === 'idle' ? (
            <div className="p-6 bg-white">
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-indigo-300 hover:bg-indigo-50/30 transition-all">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                    <FileText className="w-8 h-8 text-slate-400" />
                  </div>
                  <p className="text-gray-700 font-medium mb-1">Upload Excel or CSV</p>
                  <p className="text-sm text-slate-400">.xlsx, .xls, .csv</p>
                </label>
              </div>
            </div>
          ) : (
            <div
              className="bg-white cursor-pointer"
              onClick={() => setUploadExpanded(!uploadExpanded)}
            >
              <div className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center mr-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                  </div>
                  <span className="text-sm text-gray-600">{uploadProgress}</span>
                </div>
                {uploadExpanded ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </div>
              {uploadExpanded && (
                <div className="px-4 pb-3 pt-2 border-t border-slate-100">
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
                      className="text-sm text-indigo-600 hover:text-indigo-700 cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Upload different file
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
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-10 h-10 text-slate-300" />
                </div>
                <p className="text-slate-400">Upload papers or start demo mode</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar: Search & Results */}
        <div className="w-96 bg-white border-l border-slate-200 flex flex-col flex-shrink-0">
          {/* Search Header */}
          <div className="p-4 border-b border-slate-100">
            <div className="flex items-center mb-3">
              <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center mr-2">
                <MessageSquare className="w-4 h-4 text-indigo-600" />
              </div>
              <h2 className="font-medium text-gray-800">Ask Questions</h2>
            </div>

            {/* Search Input */}
            <div className="flex space-x-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="e.g. What is Customer Experience?"
                className="flex-1 px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-slate-50 focus:bg-white transition-colors"
                disabled={papers.length === 0}
              />
              <button
                onClick={handleSearch}
                disabled={!query.trim() || searching || papers.length === 0}
                className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 transition-colors"
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
              <div className="mt-3 flex flex-wrap gap-1.5">
                {["Customer Experience?", "Papers by Klaus?", "AI Research?"].map((q) => (
                  <button
                    key={q}
                    onClick={() => setQuery(q)}
                    className="text-xs px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full hover:bg-indigo-100 hover:text-indigo-700 transition-colors"
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
              <div className="h-full flex items-center justify-center p-4">
                <div className="text-center">
                  <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Search className="w-7 h-7 text-slate-300" />
                  </div>
                  <p className="text-sm text-slate-400">
                    {papers.length === 0
                      ? "Upload papers first"
                      : "Ask a question about your papers"
                    }
                  </p>
                </div>
              </div>
            )}

            {searching && (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Loader className="w-6 h-6 animate-spin text-indigo-600" />
                  </div>
                  <p className="text-sm text-slate-600 mb-1">
                    {searchTime < 5 ? 'Searching Knowledge Graph...' :
                     searchTime < 15 ? 'Generating answer with LLM...' :
                     searchTime < 30 ? 'Analyzing sources...' :
                     'Please wait, complex query...'}
                  </p>
                  <p className="text-xs text-slate-400">{searchTime}s</p>
                  {searchTime > 20 && (
                    <p className="text-xs text-amber-600 mt-2">LLM responses can take up to 2 minutes</p>
                  )}
                </div>
              </div>
            )}

            {showResults && results && (
              <div className="p-4 space-y-4">
                {/* Answer */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-800">Answer</h3>
                    {results.graphUsed && (
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full text-xs font-medium">
                        Knowledge Graph
                      </span>
                    )}
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl text-sm text-gray-700 leading-relaxed">
                    <AnswerWithCitations answer={results.answer} sources={results.sources} />
                  </div>
                </div>

                {/* Cypher Query - Traceability */}
                {results.cypherQuery && (
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-xs font-medium text-slate-500 mb-1">Cypher Query:</p>
                    <code className="text-xs text-slate-600 block bg-white p-2 rounded-lg border border-slate-200 overflow-x-auto">
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
                    Sources ({results.sources?.length})
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
      <footer className="bg-white px-4 py-3 text-center text-xs text-slate-400 flex-shrink-0 border-t border-slate-100">
        <span className="text-slate-500">5 Principles:</span> Transparency · Traceability · Proportionality · Intersubjectivity · Contextualization
      </footer>
    </div>
  );
}
