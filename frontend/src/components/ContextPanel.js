import React, { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Calendar, Database, Globe } from 'lucide-react';

/**
 * ContextPanel - Zeigt Kontext und Limitationen der Ergebnisse
 * Epistemisches Prinzip: KONTEXTUALISIERUNG
 *
 * Props:
 * - sources: array - Die verwendeten Quellen
 * - totalPapers: number - Gesamtanzahl Papers im System
 * - query: string - Die gestellte Frage
 */
export default function ContextPanel({ sources = [], totalPapers = 0, query = '' }) {
  const [showDetails, setShowDetails] = useState(false);

  // Berechne Zeitraum aus den Quellen
  const years = sources
    .map(s => {
      if (s.year) return parseInt(s.year);
      if (s.date) return parseInt(s.date.substring(0, 4));
      return null;
    })
    .filter(y => y && !isNaN(y));

  const minYear = years.length > 0 ? Math.min(...years) : null;
  const maxYear = years.length > 0 ? Math.max(...years) : null;
  const timeRange = minYear && maxYear
    ? (minYear === maxYear ? `${minYear}` : `${minYear} - ${maxYear}`)
    : 'Unbekannt';

  // Berechne Abdeckung
  const coveragePercent = totalPapers > 0
    ? Math.round((sources.length / totalPapers) * 100)
    : 0;

  // Sammle einzigartige Journals/Quellen
  const uniqueJournals = [...new Set(
    sources
      .map(s => s.journal_name)
      .filter(j => j)
  )];

  // Generiere Limitationen basierend auf den Daten
  const limitations = [];

  if (sources.length < 5) {
    limitations.push({
      type: 'warning',
      text: `Nur ${sources.length} Quellen gefunden - Ergebnisse könnten unvollständig sein`
    });
  }

  if (coveragePercent < 10 && totalPapers > 0) {
    limitations.push({
      type: 'info',
      text: `Nur ${coveragePercent}% der ${totalPapers} Papers wurden als relevant eingestuft`
    });
  }

  if (minYear && maxYear && (maxYear - minYear < 3)) {
    limitations.push({
      type: 'info',
      text: `Quellen aus kurzem Zeitraum (${timeRange}) - begrenzte historische Perspektive`
    });
  }

  if (uniqueJournals.length === 1) {
    limitations.push({
      type: 'info',
      text: `Alle Quellen aus einem Journal - möglicherweise einseitige Perspektive`
    });
  }

  // Standardlimitation immer zeigen
  limitations.push({
    type: 'default',
    text: 'Ergebnisse basieren nur auf den hochgeladenen Daten'
  });

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className="text-lg">🌐</span>
          <h4 className="font-semibold text-gray-800">Kontext & Limitationen</h4>
        </div>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-amber-700 hover:text-amber-900 transition-colors"
        >
          {showDetails ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      {/* Schnellübersicht */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="bg-white rounded-lg p-2 text-center border border-amber-100">
          <Calendar className="w-4 h-4 mx-auto mb-1 text-amber-600" />
          <p className="text-xs text-gray-500">Zeitraum</p>
          <p className="text-sm font-medium text-gray-800">{timeRange}</p>
        </div>

        <div className="bg-white rounded-lg p-2 text-center border border-amber-100">
          <Database className="w-4 h-4 mx-auto mb-1 text-amber-600" />
          <p className="text-xs text-gray-500">Quellen</p>
          <p className="text-sm font-medium text-gray-800">
            {sources.length} {totalPapers > 0 ? `/ ${totalPapers}` : ''}
          </p>
        </div>

        <div className="bg-white rounded-lg p-2 text-center border border-amber-100">
          <Globe className="w-4 h-4 mx-auto mb-1 text-amber-600" />
          <p className="text-xs text-gray-500">Journals</p>
          <p className="text-sm font-medium text-gray-800">{uniqueJournals.length}</p>
        </div>
      </div>

      {/* Limitationen (immer sichtbar) */}
      <div className="space-y-2">
        {limitations.slice(0, showDetails ? limitations.length : 2).map((limitation, idx) => (
          <div
            key={idx}
            className={`flex items-start space-x-2 text-sm rounded p-2
              ${limitation.type === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                limitation.type === 'info' ? 'bg-blue-50 text-blue-700' :
                'bg-gray-50 text-gray-600'}
            `}
          >
            <AlertTriangle className={`w-4 h-4 flex-shrink-0 mt-0.5
              ${limitation.type === 'warning' ? 'text-yellow-600' :
                limitation.type === 'info' ? 'text-blue-500' :
                'text-gray-400'}
            `} />
            <span>{limitation.text}</span>
          </div>
        ))}
      </div>

      {/* Erweiterte Details */}
      {showDetails && (
        <div className="mt-3 pt-3 border-t border-amber-200">
          <p className="text-sm font-medium text-gray-700 mb-2">Verwendete Journals:</p>
          <div className="flex flex-wrap gap-1">
            {uniqueJournals.length > 0 ? (
              uniqueJournals.map((journal, idx) => (
                <span
                  key={idx}
                  className="px-2 py-1 bg-white text-gray-600 rounded text-xs border border-amber-200"
                >
                  {journal}
                </span>
              ))
            ) : (
              <span className="text-sm text-gray-500">Keine Journal-Informationen verfügbar</span>
            )}
          </div>

          <div className="mt-3 p-2 bg-amber-100 rounded text-xs text-amber-800">
            <strong>Hinweis zur Interpretation:</strong> Die Ergebnisse spiegeln nur die
            Perspektiven der gefundenen Quellen wider. Für ein vollständiges Bild
            konsultieren Sie weitere Literatur.
          </div>
        </div>
      )}
    </div>
  );
}
