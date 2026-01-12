import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { ZoomIn, ZoomOut, Maximize2, Info, List, Network, HelpCircle, X } from 'lucide-react';
import FilterSidebar from './FilterSidebar';
import ConnectionModal from './ConnectionModal';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

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
  const [semanticSimilarities, setSemanticSimilarities] = useState([]);
  const [showRelational, setShowRelational] = useState(true); // Show relational (Neo4j) edges
  const [showSemantic, setShowSemantic] = useState(true); // Show semantic (Vector) edges

  // Get DOIs of highlighted sources for filtering
  const highlightedDOIs = useMemo(() => {
    if (!highlightedSources) return new Set();
    return new Set(highlightedSources.map(s => s.doi).filter(Boolean));
  }, [highlightedSources]);

  // Fetch semantic similarities when papers are loaded
  useEffect(() => {
    const fetchSemanticSimilarities = async () => {
      if (papers.length === 0) return;

      try {
        const response = await fetch(`${API_BASE}/api/semantic-similarities`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ threshold: 0.5, max_per_paper: 3 })
        });

        if (response.ok) {
          const data = await response.json();
          setSemanticSimilarities(data.similarities || []);
        }
      } catch (error) {
        console.log('Semantic similarities not available:', error);
      }
    };

    fetchSemanticSimilarities();
  }, [papers]);

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

  // Graph-Daten generieren: Papers als Knoten, relationale + semantische Verbindungen
  const graphData = useMemo(() => {
    // Create DOI to index mapping for semantic similarities
    const doiToIndex = {};
    filteredPapers.forEach((paper, idx) => {
      if (paper.doi) doiToIndex[paper.doi] = idx;
    });

    const nodes = filteredPapers.map((paper, idx) => ({
      id: `paper-${idx}`,
      label: getCitationLabel(paper),
      paper: paper,
      color: getYearColor(paper),
      size: getNodeSize(paper),
      citations: parseInt(paper.citations) || 0
    }));

    const relationalLinks = [];
    const semanticLinks = [];
    const linkDetails = {}; // Speichert Details für jede Verbindung

    // 1. Relationale Verbindungen (gemeinsame Autoren/Keywords)
    for (let i = 0; i < filteredPapers.length; i++) {
      for (let j = i + 1; j < filteredPapers.length; j++) {
        const paperA = filteredPapers[i];
        const paperB = filteredPapers[j];

        // Gemeinsame Autoren finden
        const authorsA = paperA.authors?.split(';').map(a => a.trim().replace(/\s*\(\d+\)/g, '')) || [];
        const authorsB = paperB.authors?.split(';').map(a => a.trim().replace(/\s*\(\d+\)/g, '')) || [];
        const sharedAuthors = authorsA.filter(a => authorsB.includes(a));

        // Gemeinsame Keywords finden (filter out generic sources like "Scopus")
        const keywordsA = paperA.sources?.split(';').map(k => k.trim()).filter(k => k.toLowerCase() !== 'scopus') || [];
        const keywordsB = paperB.sources?.split(';').map(k => k.trim()).filter(k => k.toLowerCase() !== 'scopus') || [];
        const sharedKeywords = keywordsA.filter(k => keywordsB.includes(k));

        // Nur Autoren-basierte Verbindungen (nicht Keywords wie "Scopus")
        if (sharedAuthors.length > 0) {
          const linkId = `relational-${i}-${j}`;
          const strength = sharedAuthors.length * 2;

          relationalLinks.push({
            source: `paper-${i}`,
            target: `paper-${j}`,
            id: linkId,
            strength: strength,
            width: Math.min(5, 1 + strength * 0.8),
            type: 'relational' // Solid line
          });

          linkDetails[linkId] = {
            source: paperA,
            target: paperB,
            sharedAuthors,
            sharedKeywords,
            strength,
            type: 'relational',
            reason: `Gemeinsame Autoren: ${sharedAuthors.join(', ')}`
          };
        }
      }
    }

    // 2. Semantische Verbindungen (aus Vector-Embeddings)
    semanticSimilarities.forEach(sim => {
      const sourceIdx = doiToIndex[sim.source_doi];
      const targetIdx = doiToIndex[sim.target_doi];

      if (sourceIdx !== undefined && targetIdx !== undefined) {
        const linkId = `semantic-${sourceIdx}-${targetIdx}`;

        // Skip if there's already a relational link between these papers
        const hasRelational = relationalLinks.some(l => {
          const relSourceIdx = parseInt(l.source.replace('paper-', ''));
          const relTargetIdx = parseInt(l.target.replace('paper-', ''));
          return (relSourceIdx === sourceIdx && relTargetIdx === targetIdx) ||
                 (relSourceIdx === targetIdx && relTargetIdx === sourceIdx);
        });

        if (!hasRelational) {
          semanticLinks.push({
            source: `paper-${sourceIdx}`,
            target: `paper-${targetIdx}`,
            id: linkId,
            strength: sim.similarity,
            width: Math.min(4, 0.5 + sim.similarity * 3),
            type: 'semantic' // Dashed line
          });

          linkDetails[linkId] = {
            source: filteredPapers[sourceIdx],
            target: filteredPapers[targetIdx],
            sharedAuthors: [],
            sharedKeywords: [],
            strength: sim.similarity,
            type: 'semantic',
            reason: `Semantische Ähnlichkeit: ${(sim.similarity * 100).toFixed(0)}%`
          };
        }
      }
    });

    // Apply Top-3 filtering per type
    const MAX_LINKS_PER_NODE = 3;

    const filterTopLinks = (links) => {
      const nodeLinkCount = {};
      links.sort((a, b) => b.strength - a.strength);

      return links.filter(link => {
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
    };

    const filteredRelational = filterTopLinks(relationalLinks);
    const filteredSemantic = filterTopLinks(semanticLinks);

    // Combine based on toggle states
    let combinedLinks = [];
    if (showRelational) combinedLinks = [...combinedLinks, ...filteredRelational];
    if (showSemantic) combinedLinks = [...combinedLinks, ...filteredSemantic];

    // Normalize strength for visualization
    const maxStrength = Math.max(...combinedLinks.map(l => l.strength), 1);
    combinedLinks.forEach(link => {
      link.normalizedStrength = link.strength / maxStrength;
    });

    return {
      nodes,
      links: combinedLinks,
      linkDetails,
      maxStrength,
      relationalCount: filteredRelational.length,
      semanticCount: filteredSemantic.length,
      allLinksCount: relationalLinks.length + semanticLinks.length
    };
  }, [filteredPapers, semanticSimilarities, showRelational, showSemantic]);

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
            {filteredPapers.length} Papers
            {graphData.links.length > 0 && (
              <span>
                {' '}- <span className="text-emerald-600">{graphData.relationalCount} relational</span>
                {' '}/ <span className="text-indigo-600">{graphData.semanticCount} semantisch</span>
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {/* Edge Type Toggles */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setShowRelational(!showRelational)}
              className={`flex items-center px-2 py-1 rounded text-xs font-medium transition-colors ${
                showRelational ? 'bg-emerald-100 text-emerald-700' : 'text-gray-400'
              }`}
              title="Relationale Verbindungen (gemeinsame Autoren)"
            >
              <span className="w-3 h-0.5 bg-current mr-1"></span>
              Rel
            </button>
            <button
              onClick={() => setShowSemantic(!showSemantic)}
              className={`flex items-center px-2 py-1 rounded text-xs font-medium transition-colors ${
                showSemantic ? 'bg-indigo-100 text-indigo-700' : 'text-gray-400'
              }`}
              title="Semantische Verbindungen (Textähnlichkeit)"
            >
              <span className="w-3 border-t border-dashed border-current mr-1"></span>
              Sem
            </button>
          </div>
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
                  // Custom link rendering: solid for relational, dashed for semantic
                  linkCanvasObjectMode={() => 'replace'}
                  linkCanvasObject={(link, ctx) => {
                    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                    const targetId = typeof link.target === 'object' ? link.target.id : link.target;

                    // Calculate link opacity based on focus mode
                    let alpha = 0.4 + (link.normalizedStrength || 0) * 0.5;
                    let color;

                    if (focusedNode) {
                      if (sourceId === focusedNode || targetId === focusedNode) {
                        alpha = 0.9;
                        color = link.type === 'relational'
                          ? `rgba(16, 185, 129, ${alpha})`  // Emerald for relational
                          : `rgba(99, 102, 241, ${alpha})`; // Indigo for semantic
                      } else {
                        color = 'rgba(200, 200, 200, 0.1)';
                      }
                    } else {
                      color = link.type === 'relational'
                        ? `rgba(16, 185, 129, ${alpha})`  // Emerald for relational
                        : `rgba(99, 102, 241, ${alpha})`; // Indigo for semantic
                    }

                    // Get coordinates
                    const start = link.source;
                    const end = link.target;

                    ctx.beginPath();
                    ctx.strokeStyle = color;
                    ctx.lineWidth = link.width || 1;

                    // Dashed line for semantic, solid for relational
                    if (link.type === 'semantic') {
                      ctx.setLineDash([4, 4]);
                    } else {
                      ctx.setLineDash([]);
                    }

                    ctx.moveTo(start.x, start.y);
                    ctx.lineTo(end.x, end.y);
                    ctx.stroke();

                    // Reset line dash
                    ctx.setLineDash([]);
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
                    const baseDistance = 200;
                    const strength = link.normalizedStrength || 0.5;
                    return baseDistance * (1.2 - strength * 0.8);
                  }}
                  nodeRelSize={4}
                  d3Force={(d3) => {
                    d3('charge').strength(-400);
                    d3('collision', null);
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

              {/* Hybrid Connections */}
              <div>
                <h4 className="font-medium text-gray-700 mb-2">Verbindungstypen</h4>
                <div className="space-y-2">
                  {/* Relational */}
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-0.5 bg-emerald-500"></div>
                    <div>
                      <span className="text-sm font-medium text-emerald-700">Relational</span>
                      <span className="text-xs text-gray-500 ml-1">(durchgezogen)</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 ml-15 pl-[60px]">
                    Gemeinsame Autoren - explizite Fakten aus Neo4j
                  </p>

                  {/* Semantic */}
                  <div className="flex items-center space-x-3 mt-2">
                    <div className="w-12 border-t-2 border-dashed border-indigo-500"></div>
                    <div>
                      <span className="text-sm font-medium text-indigo-700">Semantisch</span>
                      <span className="text-xs text-gray-500 ml-1">(gestrichelt)</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 ml-15 pl-[60px]">
                    Ähnlicher Inhalt - interpretiert aus Vector-Embeddings
                  </p>
                </div>
                <p className="text-xs text-gray-500 mt-3">
                  Die Liniendicke zeigt die Stärke der Verbindung.
                  Es werden max. 3 Verbindungen pro Typ und Paper angezeigt.
                </p>
              </div>

              {/* Interaction */}
              <div className="bg-gray-50 rounded-lg p-3">
                <h4 className="font-medium text-gray-700 mb-2">Interaktion</h4>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li><strong>Klick auf Paper:</strong> Fokus-Modus - zeigt nur verbundene Papers</li>
                  <li><strong>Klick auf Kante:</strong> Zeigt warum Papers verbunden sind</li>
                  <li><strong>Klick auf Hintergrund:</strong> Fokus aufheben</li>
                  <li><strong>Rel/Sem Buttons:</strong> Verbindungstypen ein-/ausblenden</li>
                  <li><strong>Mausrad:</strong> Zoom rein/raus</li>
                </ul>
              </div>

              {/* Hybrid Graph Info */}
              <div className="bg-gradient-to-r from-emerald-50 to-indigo-50 rounded-lg p-3">
                <h4 className="font-medium text-gray-800 mb-1">Hybrid Knowledge Graph</h4>
                <p className="text-xs text-gray-700">
                  Dieser Graph kombiniert zwei Datenquellen:
                </p>
                <ul className="text-xs text-gray-600 mt-1 space-y-0.5">
                  <li>• <span className="text-emerald-700 font-medium">Neo4j</span>: Explizite Relationen (Autoren, Keywords)</li>
                  <li>• <span className="text-indigo-700 font-medium">Vector DB</span>: Semantische Ähnlichkeit (Textinhalt)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
