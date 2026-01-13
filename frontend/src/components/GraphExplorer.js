import React, { useState, useMemo, useRef, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { ZoomIn, ZoomOut, Maximize2, Info, List, Network, HelpCircle, X } from 'lucide-react';
import FilterSidebar from './FilterSidebar';
import ConnectionModal from './ConnectionModal';

/**
 * GraphExplorer - Kombiniert Filter-Sidebar mit interaktivem Paper-Graph
 *
 * Props:
 * - papers: array - Alle Papers aus dem Upload
 */
export default function GraphExplorer({ papers = [], highlightedSources = null }) {
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
  const [viewMode, setViewMode] = useState('graph'); // 'graph' or 'list'
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showOnlyHighlighted, setShowOnlyHighlighted] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [focusedNode, setFocusedNode] = useState(null); // For focus mode

  // Get DOIs of highlighted sources for filtering
  const highlightedDOIs = useMemo(() => {
    if (!highlightedSources) return new Set();
    return new Set(highlightedSources.map(s => s.doi).filter(Boolean));
  }, [highlightedSources]);

  // Papers filtern basierend auf Filtern
  const filteredPapers = useMemo(() => {
    return papers.filter(paper => {
      // Highlighted Sources Filter (wenn aktiv, nur diese zeigen)
      if (showOnlyHighlighted && highlightedDOIs.size > 0) {
        if (!highlightedDOIs.has(paper.doi)) {
          return false;
        }
      }

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
  }, [papers, filters, showOnlyHighlighted, highlightedDOIs]);

  // Hilfsfunktion: Erstelle Citation-Style Label (z.B. "Verhoef et al., 2021")
  const getCitationLabel = (paper) => {
    const firstAuthor = paper.authors?.split(';')[0]?.trim().replace(/\s*\(\d+\)/g, '') || 'Unknown';
    const lastName = firstAuthor.split(',')[0]?.trim() || firstAuthor;
    const year = paper.date?.substring(0, 4) || 'n.d.';
    const authorCount = paper.authors?.split(';').length || 1;
    return authorCount > 1 ? `${lastName} et al., ${year}` : `${lastName}, ${year}`;
  };

  // Hilfsfunktion: Farbe basierend auf Jahr (älter = hell grün, neuer = dunkel grün)
  const getYearColor = (paper) => {
    const year = parseInt(paper.date?.substring(0, 4)) || 2020;
    const minYear = 2015;
    const maxYear = 2025;
    const normalized = Math.max(0, Math.min(1, (year - minYear) / (maxYear - minYear)));

    // Gradient von hell teal (#99d8c9) zu dunkel teal (#006d5b)
    const r = Math.round(153 - normalized * 103); // 153 -> 50
    const g = Math.round(216 - normalized * 107); // 216 -> 109
    const b = Math.round(201 - normalized * 110); // 201 -> 91
    return `rgb(${r}, ${g}, ${b})`;
  };

  // Hilfsfunktion: Größe basierend auf Citations
  const getNodeSize = (paper) => {
    const citations = parseInt(paper.citations) || 0;
    // Min 3, Max 15, skaliert logarithmisch
    return Math.max(3, Math.min(15, 3 + Math.log(citations + 1) * 2));
  };

  // Graph-Daten generieren: Nur Papers als Knoten, Verbindungen bei gemeinsamen Autoren/Keywords
  const graphData = useMemo(() => {
    const nodes = filteredPapers.map((paper, idx) => ({
      id: `paper-${idx}`,
      label: getCitationLabel(paper),
      paper: paper,
      color: getYearColor(paper),
      size: getNodeSize(paper),
      citations: parseInt(paper.citations) || 0
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
          // Berechne Verbindungsstärke (Autoren zählen mehr als Keywords)
          const strength = sharedAuthors.length * 2 + sharedKeywords.length * 0.5;

          links.push({
            source: `paper-${i}`,
            target: `paper-${j}`,
            id: linkId,
            strength: strength,
            // Dicke basierend auf Stärke der Verbindung
            width: Math.min(5, 1 + strength * 0.8)
          });

          linkDetails[linkId] = {
            source: paperA,
            target: paperB,
            sharedAuthors,
            sharedKeywords,
            strength
          };
        }
      }
    }

    // Top-3 Verbindungen pro Paper behalten
    const MAX_LINKS_PER_NODE = 3;
    const nodeLinkCount = {};

    // Sortiere Links nach Stärke (stärkste zuerst)
    links.sort((a, b) => b.strength - a.strength);

    // Filtere: Behalte Link nur wenn beide Nodes noch unter Limit sind
    const filteredLinks = links.filter(link => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;

      const sourceCount = nodeLinkCount[sourceId] || 0;
      const targetCount = nodeLinkCount[targetId] || 0;

      if (sourceCount < MAX_LINKS_PER_NODE && targetCount < MAX_LINKS_PER_NODE) {
        nodeLinkCount[sourceId] = sourceCount + 1;
        nodeLinkCount[targetId] = targetCount + 1;
        return true;
      }
      return false;
    });

    // Berechne max Stärke für Normalisierung
    const maxStrength = Math.max(...filteredLinks.map(l => l.strength), 1);
    filteredLinks.forEach(link => {
      link.normalizedStrength = link.strength / maxStrength;
    });

    return { nodes, links: filteredLinks, linkDetails, maxStrength, allLinksCount: links.length };
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
    // Toggle focus mode: click same node again to unfocus
    if (focusedNode === node.id) {
      setFocusedNode(null);
    } else {
      setFocusedNode(node.id);
    }
    setSelectedPaper(node.paper);
  }, [focusedNode]);

  const handleBackgroundClick = useCallback(() => {
    setFocusedNode(null);
  }, []);

  // Get connected nodes for focus mode
  const connectedNodes = useMemo(() => {
    if (!focusedNode) return new Set();
    const connected = new Set([focusedNode]);
    graphData.links.forEach(link => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      if (sourceId === focusedNode) connected.add(targetId);
      if (targetId === focusedNode) connected.add(sourceId);
    });
    return connected;
  }, [focusedNode, graphData.links]);

  const handleZoomIn = () => graphRef.current?.zoom(graphRef.current.zoom() * 1.5, 400);
  const handleZoomOut = () => graphRef.current?.zoom(graphRef.current.zoom() / 1.5, 400);
  const handleFitView = () => graphRef.current?.zoomToFit(400, 50);

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Knowledge Graph</h2>
          <p className="text-xs text-gray-500">
            {filteredPapers.length} Papers, {graphData.links.length} Verbindungen
            {graphData.allLinksCount > graphData.links.length && (
              <span className="text-gray-400 ml-1">
                (Top-3 von {graphData.allLinksCount})
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {/* Show Only Sources Toggle */}
          {highlightedSources && highlightedSources.length > 0 && (
            <button
              onClick={() => setShowOnlyHighlighted(!showOnlyHighlighted)}
              className={`flex items-center px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                showOnlyHighlighted
                  ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title="Nur Quellen der letzten Antwort anzeigen"
            >
              {showOnlyHighlighted ? `Quellen (${highlightedSources.length})` : 'Nur Quellen'}
            </button>
          )}
          {/* View Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('graph')}
              className={`flex items-center px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                viewMode === 'graph' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Network className="w-3.5 h-3.5 mr-1" />
              Graph
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                viewMode === 'list' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <List className="w-3.5 h-3.5 mr-1" />
              Liste
            </button>
          </div>
          {/* Info Button */}
          <button
            onClick={() => setShowInfoModal(true)}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            title="Legende & Erklärung"
          >
            <HelpCircle className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Main Content: Sidebar + Graph */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Fixed width */}
        <div className="w-72 flex-shrink-0 border-r bg-white overflow-hidden">
          <FilterSidebar
            papers={papers}
            filters={filters}
            onFilterChange={handleFilterChange}
          />
        </div>

        {/* Graph Area - Takes remaining space */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Graph Controls - only show in graph mode */}
          {viewMode === 'graph' && (
            <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b">
              {/* Year Gradient Legend */}
              <div className="flex items-center space-x-3 text-xs">
                <span className="text-gray-500">Jahr:</span>
                <div className="flex items-center">
                  <div
                    className="w-24 h-3 rounded-full mr-2"
                    style={{
                      background: 'linear-gradient(to right, rgb(153, 216, 201), rgb(50, 109, 91))'
                    }}
                  />
                  <span className="text-gray-500">2015 → 2025</span>
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
          )}

          {/* Graph View */}
          {viewMode === 'graph' && (
            <div className="flex-1 bg-gray-100">
              {graphData.nodes.length > 0 ? (
                <ForceGraph2D
                  ref={graphRef}
                  graphData={graphData}
                  nodeLabel={(node) => node.label}
                  nodeColor={(node) => {
                    // Dim nodes not connected to focused node
                    if (focusedNode && !connectedNodes.has(node.id)) {
                      return 'rgba(200, 200, 200, 0.3)';
                    }
                    return node.color;
                  }}
                  nodeVal={3}
                  // Kantendicke basierend auf Stärke
                  linkWidth={(link) => {
                    if (focusedNode) {
                      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
                      if (sourceId === focusedNode || targetId === focusedNode) {
                        return (link.width || 1) * 1.5; // Highlight connected links
                      }
                    }
                    return link.width || 1;
                  }}
                  // Kantenfarbe: dim wenn nicht verbunden mit fokussiertem Node
                  linkColor={(link) => {
                    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                    const targetId = typeof link.target === 'object' ? link.target.id : link.target;

                    if (focusedNode) {
                      if (sourceId === focusedNode || targetId === focusedNode) {
                        return 'rgba(79, 70, 229, 0.8)'; // Indigo for connected
                      }
                      return 'rgba(200, 200, 200, 0.15)'; // Dim others
                    }
                    const alpha = 0.2 + (link.normalizedStrength || 0) * 0.6;
                    return `rgba(100, 116, 139, ${alpha})`;
                  }}
                  // Kanten immer zeigen (wir haben schon Top-3 gefiltert)
                  linkVisibility={() => true}
                  onNodeClick={handleNodeClick}
                  onLinkClick={handleLinkClick}
                  onBackgroundClick={handleBackgroundClick}
                  onZoom={({ k }) => setZoomLevel(k)}
                  linkDirectionalParticles={0}
                  cooldownTicks={300}
                  d3VelocityDecay={0.2}
                  d3AlphaDecay={0.01}
                  d3AlphaMin={0.001}
                  // Distanz: starke Verbindungen = näher, schwache = weiter
                  linkDistance={(link) => {
                    const baseDistance = 80;
                    const strength = link.normalizedStrength || 0.5;
                    return baseDistance * (1.5 - strength * 0.7);
                  }}
                  nodeRelSize={4}
                  d3Force={(d3) => {
                    d3('charge').strength(-150); // Weniger Abstoßung
                    d3('center').strength(0.05); // Leichter Zug zur Mitte
                  }}
                  onEngineStop={() => graphRef.current?.zoomToFit(400, 80)}
                  nodeCanvasObject={(node, ctx, globalScale) => {
                    const size = node.size || 4;
                    const isDimmed = focusedNode && !connectedNodes.has(node.id);
                    const isFocused = focusedNode === node.id;

                    ctx.beginPath();
                    ctx.arc(node.x, node.y, isFocused ? size * 1.3 : size, 0, 2 * Math.PI);
                    ctx.fillStyle = isDimmed ? 'rgba(200, 200, 200, 0.3)' : node.color;
                    ctx.fill();

                    // Ring for focused node
                    if (isFocused) {
                      ctx.strokeStyle = 'rgba(79, 70, 229, 0.9)';
                      ctx.lineWidth = 3;
                    } else {
                      ctx.strokeStyle = isDimmed ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.8)';
                      ctx.lineWidth = 1.5;
                    }
                    ctx.stroke();

                    // Label: show if zoomed in OR if node is connected to focused
                    const showLabel = globalScale > 1.2 || (focusedNode && connectedNodes.has(node.id));
                    if (showLabel && !isDimmed) {
                      const label = node.label || '';
                      const fontSize = Math.max(10 / globalScale, 4);
                      ctx.font = `${isFocused ? 'bold ' : ''}${fontSize}px Sans-Serif`;
                      ctx.textAlign = 'center';
                      ctx.textBaseline = 'top';
                      ctx.fillStyle = isFocused ? '#4f46e5' : '#374151';
                      ctx.fillText(label, node.x, node.y + size + 2);
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
          )}

          {/* List View */}
          {viewMode === 'list' && (
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr className="border-b">
                    <th className="text-left px-4 py-3 font-medium text-gray-700">Titel</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-700">Autoren</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-700 w-20">Jahr</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-700 w-24">Zitationen</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-700 w-20">VHB</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-700 w-20">ABDC</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPapers.map((paper, idx) => (
                    <tr
                      key={idx}
                      onClick={() => setSelectedPaper(paper)}
                      className="border-b hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center">
                          <div
                            className="w-3 h-3 rounded-full mr-3 flex-shrink-0"
                            style={{ backgroundColor: getYearColor(paper) }}
                          />
                          <span className="text-gray-800 line-clamp-2">{paper.title}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {getCitationLabel(paper)}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">
                        {paper.date?.substring(0, 4)}
                      </td>
                      <td className="px-4 py-3 text-center font-medium text-gray-800">
                        {paper.citations || 0}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {paper.vhbRanking && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                            {paper.vhbRanking}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {paper.abdcRanking && (
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                            {paper.abdcRanking}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredPapers.length === 0 && (
                <div className="h-64 flex items-center justify-center text-gray-500">
                  <p>Keine Papers entsprechen den Filtern.</p>
                </div>
              )}
            </div>
          )}

          {/* Info Bar - only in graph mode */}
          {viewMode === 'graph' && (
            <div className="px-4 py-2 bg-blue-50 border-t flex items-center justify-between text-sm text-blue-700">
              <div className="flex items-center">
                <Info className="w-4 h-4 mr-2" />
                {focusedNode ? (
                  <span>
                    <strong>Fokus-Modus:</strong> Nur verbundene Papers werden angezeigt.
                    Klicke auf den Hintergrund oder denselben Node zum Zurücksetzen.
                  </span>
                ) : (
                  <span>
                    <strong>Klicke auf ein Paper</strong> um nur dessen Verbindungen zu sehen.
                    Klicke auf eine Kante für Details.
                  </span>
                )}
              </div>
              {focusedNode && (
                <button
                  onClick={() => setFocusedNode(null)}
                  className="px-2 py-1 bg-blue-100 hover:bg-blue-200 rounded text-xs font-medium"
                >
                  Fokus aufheben
                </button>
              )}
            </div>
          )}
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

      {/* Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Legende & Erklärung</h3>
              <button
                onClick={() => setShowInfoModal(false)}
                className="p-1 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Node Size */}
              <div>
                <h4 className="font-medium text-gray-700 mb-2">Knotengröße</h4>
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-teal-500"></div>
                    <span className="text-sm text-gray-600">Wenig Zitationen</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded-full bg-teal-500"></div>
                    <span className="text-sm text-gray-600">Viele Zitationen</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Je größer der Knoten, desto häufiger wurde das Paper zitiert.
                </p>
              </div>

              {/* Node Color */}
              <div>
                <h4 className="font-medium text-gray-700 mb-2">Knotenfarbe</h4>
                <div className="flex items-center space-x-2">
                  <div
                    className="w-32 h-4 rounded-full"
                    style={{
                      background: 'linear-gradient(to right, rgb(153, 216, 201), rgb(50, 109, 91))'
                    }}
                  />
                  <span className="text-sm text-gray-600">2015 → 2025</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Hellere Farbe = älteres Paper, dunklere Farbe = neueres Paper.
                </p>
              </div>

              {/* Connections */}
              <div>
                <h4 className="font-medium text-gray-700 mb-2">Verbindungen</h4>
                <div className="flex items-center space-x-3 mb-1">
                  <div className="w-12 h-0.5 bg-gray-400"></div>
                  <span className="text-sm text-gray-600">Schwache Verbindung</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-1.5 bg-gray-500"></div>
                  <span className="text-sm text-gray-600">Starke Verbindung</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Verbindungsdicke zeigt die Anzahl gemeinsamer Autoren oder Themen.
                  Es werden nur die <strong>Top-3 stärksten</strong> Verbindungen pro Paper angezeigt.
                </p>
              </div>

              {/* Interaction */}
              <div className="bg-indigo-50 rounded-lg p-3">
                <h4 className="font-medium text-indigo-800 mb-2">Interaktion</h4>
                <ul className="text-xs text-indigo-700 space-y-1">
                  <li><strong>Klick auf Paper:</strong> Fokus-Modus - zeigt nur verbundene Papers</li>
                  <li><strong>Klick auf Kante:</strong> Zeigt warum Papers verbunden sind</li>
                  <li><strong>Klick auf Hintergrund:</strong> Fokus aufheben</li>
                  <li><strong>Mausrad:</strong> Zoom rein/raus</li>
                  <li><strong>Ziehen:</strong> Graph verschieben</li>
                </ul>
              </div>

              {/* Knowledge Graph Info */}
              <div className="bg-blue-50 rounded-lg p-3">
                <h4 className="font-medium text-blue-800 mb-1">Was ist ein Knowledge Graph?</h4>
                <p className="text-xs text-blue-700">
                  Ein Knowledge Graph verbindet Informationen über <strong>relationale Beziehungen</strong> -
                  z.B. gemeinsame Autoren oder Themen. Im Gegensatz zu semantischer Ähnlichkeit
                  (basierend auf Textinhalt) zeigt der Graph <strong>explizite Verbindungen</strong>
                  zwischen Papers.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
