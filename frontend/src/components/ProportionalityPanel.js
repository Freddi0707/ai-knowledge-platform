import React from 'react';

/**
 * ProportionalityPanel - Zeigt wie stark jede Quelle zum Ergebnis beiträgt
 * Epistemisches Prinzip: PROPORTIONALITÄT
 *
 * Props:
 * - sources: array - Die Quellen mit similarity scores
 */
export default function ProportionalityPanel({ sources = [] }) {
  if (!sources || sources.length === 0) {
    return null;
  }

  // Berechne die proportionalen Beiträge (normalisiert auf 100%)
  const totalSimilarity = sources.reduce((sum, s) => sum + (s.similarity || 0), 0);

  const sourcesWithContribution = sources.map((source, index) => ({
    ...source,
    contribution: totalSimilarity > 0
      ? Math.round((source.similarity / totalSimilarity) * 100)
      : Math.round(100 / sources.length),
    index: index + 1
  }));

  // Farben für die Balken (absteigend nach Beitrag)
  const getBarColor = (index) => {
    const colors = [
      'bg-indigo-500',  // Höchster Beitrag
      'bg-blue-500',
      'bg-cyan-500',
      'bg-teal-500',
      'bg-green-500'
    ];
    return colors[index] || 'bg-gray-400';
  };

  return (
    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
      {/* Header */}
      <div className="flex items-center space-x-2 mb-3">
        <span className="text-lg">⚖️</span>
        <h4 className="font-semibold text-gray-800">Proportionalität</h4>
      </div>

      <p className="text-sm text-gray-600 mb-3">
        Wie stark trägt jede Quelle zur Antwort bei:
      </p>

      {/* Beitrags-Balken */}
      <div className="space-y-2">
        {sourcesWithContribution.map((source, idx) => (
          <div key={idx} className="group">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-700 truncate max-w-xs" title={source.title}>
                [{source.index}] {source.title?.substring(0, 40)}
                {source.title?.length > 40 ? '...' : ''}
              </span>
              <span className="font-medium text-gray-800 ml-2">
                {source.contribution}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${getBarColor(idx)}`}
                style={{ width: `${source.contribution}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Erklärung */}
      <div className="mt-3 text-xs text-gray-500">
        Die Prozente zeigen, wie stark jede Quelle semantisch zur Beantwortung
        Ihrer Frage beigetragen hat (basierend auf Similarity-Scores).
      </div>
    </div>
  );
}
