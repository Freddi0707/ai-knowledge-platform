import React, { useState } from 'react';
import { Upload, Search, FileText, Loader, CheckCircle, AlertCircle } from 'lucide-react';

// Epistemische UI-Komponenten
import TransparencyPanel from './components/TransparencyPanel';
import ProportionalityPanel from './components/ProportionalityPanel';
import SourceCard from './components/SourceCard';
import ContextPanel from './components/ContextPanel';
import GraphExplorer from './components/GraphExplorer';

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
    journal_name: "Journal of Retailing"
  },
  {
    title: "Understanding Customer Experience Throughout the Customer Journey",
    authors: "Lemon, Katherine N.; Verhoef, Peter C.",
    date: "2020-11-01",
    sources: "Customer Journey; Touchpoints; Marketing; Customer Experience",
    vhbRanking: "A+",
    abdcRanking: "A*",
    doi: "10.1509/jm.15.0420",
    journal_name: "Journal of Marketing"
  },
  {
    title: "Artificial Intelligence in Customer Experience: A Systematic Review",
    authors: "Klaus, Phil; Zaichkowsky, Judith",
    date: "2022-06-20",
    sources: "Artificial Intelligence; Customer Experience; Machine Learning; Digital",
    vhbRanking: "B",
    abdcRanking: "A",
    doi: "10.1108/JSM-02-2022-0045",
    journal_name: "Journal of Service Management"
  },
  {
    title: "Digital Transformation and Customer Loyalty in Retail",
    authors: "Klaus, Phil; Verhoef, Peter C.",
    date: "2023-01-10",
    sources: "Digital Transformation; Customer Loyalty; Marketing; Retail",
    vhbRanking: "A",
    abdcRanking: "A",
    doi: "10.1016/j.jbusres.2022.12.001",
    journal_name: "Journal of Business Research"
  },
  {
    title: "The Role of AI in Modern Marketing Strategies",
    authors: "Smith, John; Klaus, Phil",
    date: "2023-05-15",
    sources: "Artificial Intelligence; Marketing; Strategy; Digital",
    vhbRanking: "B",
    abdcRanking: "A",
    doi: "10.1016/j.jmr.2023.01.001",
    journal_name: "Journal of Marketing Research"
  },
  {
    title: "Service Quality and Customer Satisfaction: A Meta-Analysis",
    authors: "Parasuraman, A.; Lemon, Katherine N.",
    date: "2019-08-20",
    sources: "Service Quality; Customer Satisfaction; Meta-Analysis; Marketing",
    vhbRanking: "A",
    abdcRanking: "A*",
    doi: "10.1016/j.jsr.2019.05.002",
    journal_name: "Journal of Service Research"
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

// ========== HAUPTKOMPONENTE ==========

export default function HybridRAGInterface() {
  // App State: 1=Upload, 2=Graph Explorer, 3=Search
  const [currentStep, setCurrentStep] = useState(1);

  // Upload State
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  // Data State
  const [papers, setPapers] = useState([]);
  const [papersCount, setPapersCount] = useState(0);

  // Search State
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState(null);

  // ========== DEMO MODUS ==========
  const activateDemoMode = () => {
    setPapers(DEMO_PAPERS);
    setPapersCount(DEMO_PAPERS.length);
    setStatus('ready');
    setProgress(`Demo-Modus: ${DEMO_PAPERS.length} Papers geladen`);
    setCurrentStep(2);
  };

  // ========== UPLOAD HANDLER ==========
  const handleFileUpload = async (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setStatus('uploading');
    setProgress('Datei wird hochgeladen...');
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', uploadedFile);

      const uploadResponse = await fetch('http://localhost:5000/api/upload', {
        method: 'POST',
        body: formData
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const uploadResult = await uploadResponse.json();

      // TODO: Papers vom Backend laden
      setPapers(DEMO_PAPERS); // Fallback zu Demo
      setPapersCount(uploadResult.papers_count || 0);
      setStatus('ready');
      setProgress(`${uploadResult.papers_count} Papers verarbeitet`);
      setCurrentStep(2);
    } catch (err) {
      // Fallback zu Demo bei Fehler
      setPapers(DEMO_PAPERS);
      setPapersCount(DEMO_PAPERS.length);
      setStatus('ready');
      setProgress(`Demo-Modus (Backend nicht verfügbar)`);
      setCurrentStep(2);
    }
  };

  // ========== SEARCH HANDLER ==========
  const handleDemoSearch = () => {
    if (!query.trim()) return;
    setSearching(true);
    setTimeout(() => {
      setResults(DEMO_RESULTS);
      setSearching(false);
    }, 1000);
  };

  // ========== RENDER ==========
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            AI Knowledge Platform
          </h1>
          <p className="text-gray-600">
            Semantic Search + Knowledge Graph powered by AI
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Basierend auf den 5 epistemischen Prinzipien (Malik & Terzidis, 2025)
          </p>

          {/* Demo Button */}
          {currentStep === 1 && (
            <button
              onClick={activateDemoMode}
              className="mt-4 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors text-sm font-medium"
            >
              Demo-Modus starten
            </button>
          )}

          {/* Step Indicator */}
          <div className="flex justify-center mt-6 space-x-4">
            {[
              { num: 1, label: 'Upload' },
              { num: 2, label: 'Graph erkunden' },
              { num: 3, label: 'Fragen stellen' }
            ].map((step, idx) => (
              <div key={step.num} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors
                    ${currentStep >= step.num ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'}`}
                >
                  {step.num}
                </div>
                <span className={`ml-2 text-sm ${currentStep >= step.num ? 'text-gray-700' : 'text-gray-400'}`}>
                  {step.label}
                </span>
                {idx < 2 && (
                  <div className={`ml-4 w-16 h-0.5 ${currentStep > step.num ? 'bg-indigo-600' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ========== STEP 1: UPLOAD ========== */}
        {currentStep === 1 && (
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
            <div className="flex items-center mb-4">
              <Upload className="w-6 h-6 mr-2 text-indigo-600" />
              <h2 className="text-2xl font-semibold text-gray-800">
                Research Papers hochladen
              </h2>
            </div>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-indigo-400 transition-colors">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
                disabled={status === 'uploading'}
              />
              <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                {status === 'idle' ? (
                  <>
                    <FileText className="w-16 h-16 text-gray-400 mb-4" />
                    <p className="text-lg text-gray-600 mb-2">Klicken um Excel oder CSV hochzuladen</p>
                    <p className="text-sm text-gray-400">Unterstützt: .xlsx, .xls, .csv</p>
                  </>
                ) : status === 'uploading' ? (
                  <>
                    <Loader className="w-16 h-16 text-indigo-600 mb-4 animate-spin" />
                    <p className="text-lg text-indigo-600 font-medium">{progress}</p>
                  </>
                ) : status === 'ready' ? (
                  <>
                    <CheckCircle className="w-16 h-16 text-green-600 mb-4" />
                    <p className="text-lg text-green-600 font-medium">{progress}</p>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-16 h-16 text-red-600 mb-4" />
                    <p className="text-lg text-red-600 font-medium">{error}</p>
                  </>
                )}
              </label>
            </div>
          </div>
        )}

        {/* ========== STEP 2: GRAPH EXPLORER ========== */}
        {currentStep === 2 && (
          <GraphExplorer
            papers={papers}
            onContinue={() => setCurrentStep(3)}
          />
        )}

        {/* ========== STEP 3: SEARCH ========== */}
        {currentStep >= 3 && (
          <>
            {/* Search Box */}
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <div className="flex items-center mb-4">
                <Search className="w-6 h-6 mr-2 text-indigo-600" />
                <h2 className="text-2xl font-semibold text-gray-800">
                  Fragen stellen
                </h2>
                <button
                  onClick={() => setCurrentStep(2)}
                  className="ml-auto text-sm text-indigo-600 hover:underline"
                >
                  ← Zurück zum Graph
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleDemoSearch()}
                    placeholder="z.B. Was ist Customer Experience Management?"
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <button
                    onClick={handleDemoSearch}
                    disabled={!query.trim() || searching}
                    className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 transition-colors flex items-center space-x-2"
                  >
                    {searching ? (
                      <>
                        <Loader className="w-5 h-5 animate-spin" />
                        <span>Suche...</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-5 h-5" />
                        <span>Suchen</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Example Questions */}
                <div className="flex flex-wrap gap-2">
                  {[
                    "What is customer experience?",
                    "Which papers were written by Klaus?",
                    "Who collaborated on AI research?",
                    "Show me papers about loyalty"
                  ].map((example) => (
                    <button
                      key={example}
                      onClick={() => setQuery(example)}
                      className="text-sm px-3 py-1 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Results */}
            {results && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-gray-800">Antwort</h3>
                  {results.graphUsed && (
                    <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                      Knowledge Graph verwendet
                    </span>
                  )}
                </div>

                <div className="prose max-w-none mb-6 p-4 bg-gray-50 rounded-lg">
                  <p className="text-gray-700 leading-relaxed">{results.answer}</p>
                </div>

                {results.cypherQuery && (
                  <div className="mb-6 bg-gray-50 rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      Verwendete Cypher Query (Nachvollziehbarkeit):
                    </p>
                    <code className="text-xs text-gray-600 block bg-white p-3 rounded border overflow-x-auto">
                      {results.cypherQuery}
                    </code>
                  </div>
                )}

                {/* Epistemische Panels */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                  <TransparencyPanel confidence={results.confidence} sources={results.sources} />
                  <ProportionalityPanel sources={results.sources} />
                </div>

                <div className="mb-6">
                  <ContextPanel sources={results.sources} totalPapers={papersCount} query={query} />
                </div>

                {/* Quellen */}
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-gray-800">
                      Quellen ({results.sources?.length || 0})
                    </h4>
                  </div>
                  <div className="space-y-4">
                    {results.sources?.map((source, idx) => (
                      <SourceCard key={idx} source={source} index={idx + 1} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-gray-400">
          <p>
            Transparenz | Nachvollziehbarkeit | Proportionalität | Intersubjektivität | Kontextualisierung
          </p>
        </div>
      </div>
    </div>
  );
}
