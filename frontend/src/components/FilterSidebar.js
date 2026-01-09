import React, { useState, useMemo } from 'react';
import { Filter, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';

/**
 * FilterSidebar - Kompakte Seitenleiste für Graph-Filter
 *
 * Props:
 * - papers: array - Alle Papers
 * - filters: object - Aktuelle Filter
 * - onFilterChange: function - Callback bei Filteränderung
 */
export default function FilterSidebar({ papers = [], filters, onFilterChange }) {
  // Lokale Filter States
  const [yearRange, setYearRange] = useState(filters?.yearRange || { min: 2015, max: 2025 });
  const [selectedAuthors, setSelectedAuthors] = useState(filters?.authors || []);
  const [selectedKeywords, setSelectedKeywords] = useState(filters?.keywords || []);
  const [selectedRankings, setSelectedRankings] = useState(filters?.rankings || { vhb: [], abdc: [] });

  // Collapsed States
  const [collapsed, setCollapsed] = useState({
    authors: false,
    keywords: false,
    rankings: true
  });

  // Extrahiere Optionen aus Papers
  const { authors, keywords, years, vhbRankings, abdcRankings } = useMemo(() => {
    const authorsSet = new Set();
    const keywordsSet = new Set();
    const yearsSet = new Set();
    const vhbSet = new Set();
    const abdcSet = new Set();

    papers.forEach(paper => {
      if (paper.authors) {
        paper.authors.split(';').forEach(a => {
          const name = a.trim().replace(/\s*\(\d+\)/g, '');
          if (name) authorsSet.add(name);
        });
      }
      if (paper.sources) {
        paper.sources.split(';').forEach(k => {
          if (k.trim()) keywordsSet.add(k.trim());
        });
      }
      if (paper.date) {
        const year = parseInt(paper.date.substring(0, 4));
        if (!isNaN(year)) yearsSet.add(year);
      }
      if (paper.vhbRanking) vhbSet.add(paper.vhbRanking);
      if (paper.abdcRanking) abdcSet.add(paper.abdcRanking);
    });

    return {
      authors: Array.from(authorsSet).sort(),
      keywords: Array.from(keywordsSet).sort(),
      years: Array.from(yearsSet).sort((a, b) => a - b),
      vhbRankings: Array.from(vhbSet).sort(),
      abdcRankings: Array.from(abdcSet).sort()
    };
  }, [papers]);

  const minYear = years.length > 0 ? Math.min(...years) : 2015;
  const maxYear = years.length > 0 ? Math.max(...years) : 2025;

  // Filter anwenden
  const applyFilters = (newFilters) => {
    if (onFilterChange) {
      onFilterChange(newFilters);
    }
  };

  // Toggle Funktionen mit sofortigem Update
  const toggleAuthor = (author) => {
    const newAuthors = selectedAuthors.includes(author)
      ? selectedAuthors.filter(a => a !== author)
      : [...selectedAuthors, author];
    setSelectedAuthors(newAuthors);
    applyFilters({ yearRange, authors: newAuthors, keywords: selectedKeywords, rankings: selectedRankings });
  };

  const toggleKeyword = (keyword) => {
    const newKeywords = selectedKeywords.includes(keyword)
      ? selectedKeywords.filter(k => k !== keyword)
      : [...selectedKeywords, keyword];
    setSelectedKeywords(newKeywords);
    applyFilters({ yearRange, authors: selectedAuthors, keywords: newKeywords, rankings: selectedRankings });
  };

  const toggleVhbRanking = (ranking) => {
    const newVhb = selectedRankings.vhb.includes(ranking)
      ? selectedRankings.vhb.filter(r => r !== ranking)
      : [...selectedRankings.vhb, ranking];
    const newRankings = { ...selectedRankings, vhb: newVhb };
    setSelectedRankings(newRankings);
    applyFilters({ yearRange, authors: selectedAuthors, keywords: selectedKeywords, rankings: newRankings });
  };

  const toggleAbdcRanking = (ranking) => {
    const newAbdc = selectedRankings.abdc.includes(ranking)
      ? selectedRankings.abdc.filter(r => r !== ranking)
      : [...selectedRankings.abdc, ranking];
    const newRankings = { ...selectedRankings, abdc: newAbdc };
    setSelectedRankings(newRankings);
    applyFilters({ yearRange, authors: selectedAuthors, keywords: selectedKeywords, rankings: newRankings });
  };

  const handleYearChange = (type, value) => {
    const newRange = { ...yearRange, [type]: parseInt(value) };
    setYearRange(newRange);
    applyFilters({ yearRange: newRange, authors: selectedAuthors, keywords: selectedKeywords, rankings: selectedRankings });
  };

  // Reset Filter
  const resetFilters = () => {
    setYearRange({ min: minYear, max: maxYear });
    setSelectedAuthors([]);
    setSelectedKeywords([]);
    setSelectedRankings({ vhb: [], abdc: [] });
    applyFilters({ yearRange: { min: minYear, max: maxYear }, authors: [], keywords: [], rankings: { vhb: [], abdc: [] } });
  };

  const activeCount = selectedAuthors.length + selectedKeywords.length +
    selectedRankings.vhb.length + selectedRankings.abdc.length;

  return (
    <div className="w-72 bg-white border-r border-gray-200 h-full overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center">
          <Filter className="w-5 h-5 text-indigo-600 mr-2" />
          <h3 className="font-semibold text-gray-800">Filter</h3>
          {activeCount > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs">
              {activeCount}
            </span>
          )}
        </div>
        <button
          onClick={resetFilters}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
          title="Filter zurücksetzen"
        >
          <RotateCcw className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Zeitraum */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Zeitraum</h4>
          <div className="flex items-center space-x-2 text-sm">
            <input
              type="number"
              value={yearRange.min}
              onChange={(e) => handleYearChange('min', e.target.value)}
              min={minYear}
              max={maxYear}
              className="w-20 px-2 py-1 border rounded text-center"
            />
            <span className="text-gray-400">–</span>
            <input
              type="number"
              value={yearRange.max}
              onChange={(e) => handleYearChange('max', e.target.value)}
              min={minYear}
              max={maxYear}
              className="w-20 px-2 py-1 border rounded text-center"
            />
          </div>
        </div>

        {/* Autoren */}
        <div>
          <button
            onClick={() => setCollapsed(c => ({ ...c, authors: !c.authors }))}
            className="w-full flex items-center justify-between text-sm font-medium text-gray-700 mb-2"
          >
            <span>Autoren ({authors.length})</span>
            {collapsed.authors ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          {!collapsed.authors && (
            <div className="max-h-40 overflow-y-auto space-y-1">
              {authors.slice(0, 20).map(author => (
                <label key={author} className="flex items-center text-sm cursor-pointer hover:bg-gray-50 p-1 rounded">
                  <input
                    type="checkbox"
                    checked={selectedAuthors.includes(author)}
                    onChange={() => toggleAuthor(author)}
                    className="mr-2 rounded text-indigo-600"
                  />
                  <span className="truncate text-gray-700">
                    {author.length > 25 ? author.substring(0, 25) + '...' : author}
                  </span>
                </label>
              ))}
              {authors.length > 20 && (
                <p className="text-xs text-gray-400 p-1">+{authors.length - 20} weitere</p>
              )}
            </div>
          )}
        </div>

        {/* Themen */}
        <div>
          <button
            onClick={() => setCollapsed(c => ({ ...c, keywords: !c.keywords }))}
            className="w-full flex items-center justify-between text-sm font-medium text-gray-700 mb-2"
          >
            <span>Themen ({keywords.length})</span>
            {collapsed.keywords ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          {!collapsed.keywords && (
            <div className="max-h-40 overflow-y-auto space-y-1">
              {keywords.slice(0, 15).map(kw => (
                <label key={kw} className="flex items-center text-sm cursor-pointer hover:bg-gray-50 p-1 rounded">
                  <input
                    type="checkbox"
                    checked={selectedKeywords.includes(kw)}
                    onChange={() => toggleKeyword(kw)}
                    className="mr-2 rounded text-amber-600"
                  />
                  <span className="truncate text-gray-700">{kw}</span>
                </label>
              ))}
              {keywords.length > 15 && (
                <p className="text-xs text-gray-400 p-1">+{keywords.length - 15} weitere</p>
              )}
            </div>
          )}
        </div>

        {/* Rankings */}
        <div>
          <button
            onClick={() => setCollapsed(c => ({ ...c, rankings: !c.rankings }))}
            className="w-full flex items-center justify-between text-sm font-medium text-gray-700 mb-2"
          >
            <span>Journal Rankings</span>
            {collapsed.rankings ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          {!collapsed.rankings && (
            <div className="space-y-3">
              {/* VHB */}
              <div>
                <p className="text-xs text-gray-500 mb-1">VHB</p>
                <div className="flex flex-wrap gap-1">
                  {['A+', 'A', 'B', 'C'].map(r => (
                    <button
                      key={`vhb-${r}`}
                      onClick={() => toggleVhbRanking(r)}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        selectedRankings.vhb.includes(r)
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              {/* ABDC */}
              <div>
                <p className="text-xs text-gray-500 mb-1">ABDC</p>
                <div className="flex flex-wrap gap-1">
                  {['A*', 'A', 'B', 'C'].map(r => (
                    <button
                      key={`abdc-${r}`}
                      onClick={() => toggleAbdcRanking(r)}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        selectedRankings.abdc.includes(r)
                          ? 'bg-purple-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
