import React, { useState } from 'react';
import { Upload, Search, Database, FileText, Loader, CheckCircle, AlertCircle } from 'lucide-react';

export default function HybridRAGInterface() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle'); // idle, uploading, processing, ready, error
  const [progress, setProgress] = useState('');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');

  // Simulate backend API calls (replace with actual API)
  const handleFileUpload = async (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setStatus('uploading');
    setProgress('Uploading file...');
    setError('');

    try {
      // Step 1: Upload file to backend
      const formData = new FormData();
      formData.append('file', uploadedFile);

      setProgress('Uploading file...');
      const uploadResponse = await fetch('http://localhost:5000/api/upload', {
        method: 'POST',
        body: formData
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const uploadResult = await uploadResponse.json();

      setStatus('ready');
      setProgress(`✅ System ready! Processed ${uploadResult.papers_count} papers.`);
    } catch (err) {
      setStatus('error');
      setError(`Failed to process file: ${err.message}`);
      console.error(err);
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) return;

    setSearching(true);
    setResults(null);
    setError('');

    try {
      const response = await fetch('http://localhost:5000/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Search failed');
      }

      const data = await response.json();

      setResults(data);
    } catch (err) {
      setError(`Search failed: ${err.message}`);
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            🧠 Hybrid RAG System
          </h1>
          <p className="text-gray-600">
            Semantic Search + Knowledge Graph powered by AI
          </p>
        </div>

        {/* Upload Section */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center mb-4">
            <Upload className="w-6 h-6 mr-2 text-indigo-600" />
            <h2 className="text-2xl font-semibold text-gray-800">
              Step 1: Upload Research Papers
            </h2>
          </div>

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-indigo-400 transition-colors">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
              disabled={status === 'uploading' || status === 'processing'}
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer flex flex-col items-center"
            >
              {status === 'idle' ? (
                <>
                  <FileText className="w-16 h-16 text-gray-400 mb-4" />
                  <p className="text-lg text-gray-600 mb-2">
                    Click to upload Excel or CSV file
                  </p>
                  <p className="text-sm text-gray-400">
                    Supported: .xlsx, .xls, .csv
                  </p>
                </>
              ) : status === 'uploading' || status === 'processing' ? (
                <>
                  <Loader className="w-16 h-16 text-indigo-600 mb-4 animate-spin" />
                  <p className="text-lg text-indigo-600 font-medium">
                    {progress}
                  </p>
                </>
              ) : status === 'ready' ? (
                <>
                  <CheckCircle className="w-16 h-16 text-green-600 mb-4" />
                  <p className="text-lg text-green-600 font-medium">
                    {progress}
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    File: {file?.name}
                  </p>
                </>
              ) : (
                <>
                  <AlertCircle className="w-16 h-16 text-red-600 mb-4" />
                  <p className="text-lg text-red-600 font-medium">{error}</p>
                  <button className="mt-4 text-indigo-600 underline">
                    Try again
                  </button>
                </>
              )}
            </label>
          </div>

          {status === 'uploading' || status === 'processing' ? (
            <div className="mt-4 bg-blue-50 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <Database className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900 mb-2">
                    Processing Pipeline:
                  </p>
                  <ol className="text-sm text-blue-800 space-y-1">
                    <li>✓ Data validation and cleaning</li>
                    <li>✓ Vector embedding generation</li>
                    <li>✓ Knowledge graph construction</li>
                    <li className="text-blue-600 animate-pulse">
                      → Importing to Neo4j...
                    </li>
                  </ol>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Search Section */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center mb-4">
            <Search className="w-6 h-6 mr-2 text-indigo-600" />
            <h2 className="text-2xl font-semibold text-gray-800">
              Step 2: Ask Questions
            </h2>
          </div>

          <div className="space-y-4">
            <div className="flex space-x-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="E.g., What is customer experience management?"
                disabled={status !== 'ready' || searching}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <button
                onClick={handleSearch}
                disabled={status !== 'ready' || !query.trim() || searching}
                className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                {searching ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    <span>Searching...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    <span>Search</span>
                  </>
                )}
              </button>
            </div>

            {status !== 'ready' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  ⚠️ Please upload a file first before asking questions
                </p>
              </div>
            )}

            {/* Example Questions */}
            <div className="border-t pt-4">
              <p className="text-sm text-gray-600 mb-2">Example questions:</p>
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
                    disabled={status !== 'ready'}
                    className="text-sm px-3 py-1 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Results Section */}
        {results && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-800">Answer</h3>
              <div className="flex items-center space-x-4 text-sm">
                <span className="text-gray-600">
                  Confidence: {(results.confidence * 100).toFixed(0)}%
                </span>
                {results.graphUsed && (
                  <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">
                    🔗 Graph Enhanced
                  </span>
                )}
              </div>
            </div>

            <div className="prose max-w-none mb-6">
              <p className="text-gray-700 leading-relaxed">{results.answer}</p>
            </div>

            {results.cypherQuery && (
              <div className="mb-6 bg-gray-50 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Cypher Query Used:
                </p>
                <code className="text-xs text-gray-600 block bg-white p-3 rounded border">
                  {results.cypherQuery}
                </code>
              </div>
            )}

            <div className="border-t pt-4">
              <h4 className="text-lg font-semibold text-gray-800 mb-3">
                Sources
              </h4>
              <div className="space-y-3">
                {results.sources.map((source, idx) => (
                  <div
                    key={idx}
                    className="border border-gray-200 rounded-lg p-4 hover:border-indigo-300 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h5 className="font-medium text-gray-800">
                        [{idx + 1}] {source.title}
                      </h5>
                      <span className="text-sm text-gray-500">
                        {(source.similarity * 100).toFixed(0)}% match
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      {source.authors} ({source.year})
                    </p>
                    <a
                      href={source.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-indigo-600 hover:underline"
                    >
                      View paper →
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {error && !results && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}