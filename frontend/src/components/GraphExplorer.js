import React, { useState, useMemo, useRef, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { ZoomIn, ZoomOut, Maximize2, Info, ArrowRight } from 'lucide-react';
import FilterSidebar from './FilterSidebar';
import ConnectionModal from './ConnectionModal';

/**
 * GraphExplorer - Kombiniert Filter-Sidebar mit interaktivem Paper-Graph
 *
 * Props:
 * - papers: array - Alle Papers aus dem Upload
 * - onContinue: function - Callback für "Weiter zu Fragen"
 */
export default function GraphExplorer({ papers = [], onContinue }) {
  const graphRef = useRef();

  // State
  const [filters, setFilters] = useState({
    yearRange: { min: 2015, max: 2025 },
    authors: [],
    keywords: [],
    rankings: { vhb: [], abdc: [] }
  });
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [selectedPaper, setSelectedPaper] = useState(null);

  // Papers filtern basierend auf Filtern
  const filteredPapers = useMemo(() => {
    return papers.filter(paper => {
      // Jahr Filter
      if (paper.date) {
        const year = parseInt(paper.date.substring(0, 4));
        if (year < filters.yearRange.min || year > filters.yearRange.max) {
          return false;
        }
      }

      // Autoren Filter (wenn ausgewählt, muss Paper mindestens einen haben)
      if (filters.authors.length > 0) {
        const paperAuthors = paper.authors?.split(';').map(a => a.trim().replace(/\s*\(\d+\)/g, '')) || [];
        if (!filters.authors.some(a => paperAuthors.includes(a))) {
          return false;
        }
      }

      // Keywords Filter
      if (filters.keywords.length > 0) {
        const paperKeywords = paper.sources?.split(';').map(k => k.trim()) || [];
        if (!filters.keywords.some(k => paperKeywords.includes(k))) {
          return false;
        }
      }

      // VHB Ranking Filter
      if (filters.rankings.vhb.length > 0) {
        if (!filters.rankings.vhb.includes(paper.vhbRanking)) {
          return false;
        }
      }

      // ABDC Ranking Filter
      if (filters.rankings.abdc.length > 0) {
        if (!filters.rankings.abdc.includes(paper.abdcRanking)) {
          return false;
        }
      }

      return true;
    });
  }, [papers, filters]);

  // Graph-Daten generieren: Nur Papers als Knoten, Verbindungen bei gemeinsamen Autoren/Keywords
  const graphData = useMemo(() => {
    const nodes = filteredPapers.map((paper, idx) => ({
      id: `paper-${idx}`,
      label: paper.title,
      paper: paper,
      // Farbe basierend auf Ranking
      color: paper.vhbRanking === 'A+' || paper.abdcRanking === 'A*' ? '#10b981' :
             paper.vhbRanking === 'A' || paper.abdcRanking === 'A' ? '#3b82f6' :
             paper.vhbRanking === 'B' || paper.abdcRanking === 'B' ? '#f59e0b' : '#94a3b8'
    }));

    const links = [];
    const linkDetails = {}; // Speichert Details für jede Verbindung

    // Finde Verbindungen zwischen Papers
    for (let i = 0; i < filteredPapers.length; i++) {
      for (let j = i + 1; j < filteredPapers.length; j++) {
        const paperA = filteredPapers[i];
        const paperB = filteredPapers[j];

        // Gemeinsame Autoren finden
        const authorsA = paperA.authors?.split(';').map(a => a.trim().replace(/\s*\(\d+\)/g, '')) || [];
        const authorsB = paperB.authors?.split(';').map(a => a.trim().replace(/\s*\(\d+\)/g, '')) || [];
        const sharedAuthors = authorsA.filter(a => authorsB.includes(a));

        // Gemeinsame Keywords finden
        const keywordsA = paperA.sources?.split(';').map(k => k.trim()) || [];
        const keywordsB = paperB.sources?.split(';').map(k => k.trim()) || [];
        const sharedKeywords = keywordsA.filter(k => keywordsB.includes(k));

        // Verbindung erstellen wenn gemeinsame Eigenschaften
        if (sharedAuthors.length > 0 || sharedKeywords.length > 0) {
          const linkId = `paper-${i}__paper-${j}`;
          links.push({
            source: `paper-${i}`,
            target: `paper-${j}`,
            id: linkId,
            // Dicke basierend auf Stärke der Verbindung
            width: Math.min(5, 1 + sharedAuthors.length * 1.5 + sharedKeywords.length * 0.5)
          });

          linkDetails[linkId] = {
            source: paperA,
            target: paperB,
            sharedAuthors,
            sharedKeywords
          };
        }
      }
    }

    return { nodes, links, linkDetails };
  }, [filteredPapers]);

  // Handlers
  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
  };

  const handleLinkClick = useCallback((link) => {
    const details = graphData.linkDetails[link.id];
    if (details) {
      setSelectedConnection(details);
    }
  }, [graphData.linkDetails]);

  const handleNodeClick = useCallback((node) => {
    setSelectedPaper(node.paper);
  }, []);

  const handleZoomIn = () => graphRef.current?.zoom(graphRef.current.zoom() * 1.5, 400);
  const handleZoomOut = () => graphRef.current?.zoom(graphRef.current.zoom() / 1.5, 400);
  const handleFitView = () => graphRef.current?.zoomToFit(400, 50);

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Knowledge Graph Explorer</h2>
          <p className="text-sm text-gray-500">
            {filteredPapers.length} Papers, {graphData.links.length} Verbindungen
          </p>
        </div>
        <button
          onClick={onContinue}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Weiter zu Fragen
          <ArrowRight className="w-4 h-4 ml-2" />
        </button>
      </div>

      {/* Main Content: Sidebar + Graph */}
      <div className="flex" style={{ height: '600px' }}>
        {/* Sidebar */}
        <FilterSidebar
          papers={papers}
          filters={filters}
          onFilterChange={handleFilterChange}
        />

        {/* Graph Area */}
        <div className="flex-1 flex flex-col">
          {/* Graph Controls */}
          <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b">
            {/* Legende */}
            <div className="flex items-center space-x-4 text-xs">
              <span className="text-gray-500">Farbe nach Ranking:</span>
              <div className="flex items-center">
                <span className="w-3 h-3 rounded-full bg-green-500 mr-1"></span>
                <span>A+/A*</span>
              </div>
              <div className="flex items-center">
                <span className="w-3 h-3 rounded-full bg-blue-500 mr-1"></span>
                <span>A</span>
              </div>
              <div className="flex items-center">
                <span className="w-3 h-3 rounded-full bg-amber-500 mr-1"></span>
                <span>B</span>
              </div>
              <div className="flex items-center">
                <span className="w-3 h-3 rounded-full bg-gray-400 mr-1"></span>
                <span>Andere</span>
              </div>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center space-x-1">
              <button onClick={handleZoomIn} className="p-1.5 hover:bg-gray-200 rounded" title="Zoom In">
                <ZoomIn className="w-4 h-4 text-gray-600" />
              </button>
              <button onClick={handleZoomOut} className="p-1.5 hover:bg-gray-200 rounded" title="Zoom Out">
                <ZoomOut className="w-4 h-4 text-gray-600" />
              </button>
              <button onClick={handleFitView} className="p-1.5 hover:bg-gray-200 rounded" title="Alles anzeigen">
                <Maximize2 className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Graph */}
          <div className="flex-1 bg-gray-100">
            {graphData.nodes.length > 0 ? (
              <ForceGraph2D
                ref={graphRef}
                graphData={graphData}
                nodeLabel={(node) => node.label}
                nodeColor={(node) => node.color}
                nodeVal={8}
                linkWidth={(link) => link.width || 1}
                linkColor={() => '#94a3b8'}
                onNodeClick={handleNodeClick}
                onLinkClick={handleLinkClick}
                linkDirectionalParticles={2}
                linkDirectionalParticleWidth={2}
                cooldownTicks={100}
                onEngineStop={() => graphRef.current?.zoomToFit(400, 50)}
                nodeCanvasObject={(node, ctx, globalScale) => {
                  const size = 6;
                  ctx.beginPath();
                  ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
                  ctx.fillStyle = node.color;
                  ctx.fill();
                  ctx.strokeStyle = '#fff';
                  ctx.lineWidth = 1.5;
                  ctx.stroke();

                  // Label wenn genug gezoomt
                  if (globalScale > 1) {
                    const label = node.label?.length > 30 ? node.label.substring(0, 30) + '...' : node.label;
                    const fontSize = Math.max(10 / globalScale, 4);
                    ctx.font = `${fontSize}px Sans-Serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'top';
                    ctx.fillStyle = '#374151';
                    ctx.fillText(label || '', node.x, node.y + size + 2);
                  }
                }}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <p className="mb-2">Keine Papers entsprechen den Filtern.</p>
                  <p className="text-sm">Versuche die Filter anzupassen.</p>
                </div>
              </div>
            )}
          </div>

          {/* Info Bar */}
          <div className="px-4 py-2 bg-blue-50 border-t flex items-center text-sm text-blue-700">
            <Info className="w-4 h-4 mr-2" />
            <span>
              <strong>Klicke auf eine Verbindung</strong> um zu sehen, warum Papers zusammenhängen.
              Klicke auf ein Paper für Details.
            </span>
          </div>
        </div>
      </div>

      {/* Connection Modal */}
      {selectedConnection && (
        <ConnectionModal
          connection={selectedConnection}
          onClose={() => setSelectedConnection(null)}
          onPaperClick={(paper) => {
            setSelectedPaper(paper);
            setSelectedConnection(null);
          }}
        />
      )}

      {/* Paper Detail Modal */}
      {selectedPaper && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold text-gray-800 pr-4">{selectedPaper.title}</h3>
              <button
                onClick={() => setSelectedPaper(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <span className="font-medium text-gray-600">Autoren:</span>
                <p className="text-gray-800">{selectedPaper.authors}</p>
              </div>
              <div>
                <span className="font-medium text-gray-600">Jahr:</span>
                <p className="text-gray-800">{selectedPaper.date?.substring(0, 4)}</p>
              </div>
              {selectedPaper.journal_name && (
                <div>
                  <span className="font-medium text-gray-600">Journal:</span>
                  <p className="text-gray-800">{selectedPaper.journal_name}</p>
                </div>
              )}
              <div className="flex space-x-4">
                {selectedPaper.vhbRanking && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                    VHB: {selectedPaper.vhbRanking}
                  </span>
                )}
                {selectedPaper.abdcRanking && (
                  <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                    ABDC: {selectedPaper.abdcRanking}
                  </span>
                )}
              </div>
              {selectedPaper.doi && (
                <div>
                  <a
                    href={`https://doi.org/${selectedPaper.doi}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:underline"
                  >
                    DOI: {selectedPaper.doi}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
