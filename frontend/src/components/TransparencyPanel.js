import React, { useState } from 'react';
import { Info, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * TransparencyPanel - Zeigt Konfidenz mit Erklärung
 * Epistemisches Prinzip: TRANSPARENZ
 *
 * Props:
 * - confidence: number (0-1) - Der Konfidenzwert
 * - sources: array - Die verwendeten Quellen für die Berechnung
 */
export default function TransparencyPanel({ confidence, sources = [] }) {
  const [showExplanation, setShowExplanation] = useState(false);

  const confidencePercent = Math.round(confidence * 100);

  // Konfidenz-Level bestimmen
  const getConfidenceLevel = (percent) => {
    if (percent >= 80) return { label: 'Hoch', color: 'green' };
    if (percent >= 50) return { label: 'Mittel', color: 'yellow' };
    return { label: 'Niedrig', color: 'red' };
  };

  const level = getConfidenceLevel(confidencePercent);

  // Berechne durchschnittliche Similarity der Quellen
  const avgSimilarity = sources.length > 0
    ? Math.round(sources.reduce((sum, s) => sum + (s.similarity || 0), 0) / sources.length * 100)
    : 0;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
      {/* Header mit Icon */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className="text-lg">🎯</span>
          <h4 className="font-semibold text-gray-800">Transparenz</h4>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium
          ${level.color === 'green' ? 'bg-green-100 text-green-700' : ''}
          ${level.color === 'yellow' ? 'bg-yellow-100 text-yellow-700' : ''}
          ${level.color === 'red' ? 'bg-red-100 text-red-700' : ''}
        `}>
          {level.label}e Konfidenz
        </span>
      </div>

      {/* Konfidenz-Balken */}
      <div className="mb-3">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-600">Konfidenz</span>
          <span className="font-medium text-gray-800">{confidencePercent}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-500
              ${level.color === 'green' ? 'bg-green-500' : ''}
              ${level.color === 'yellow' ? 'bg-yellow-500' : ''}
              ${level.color === 'red' ? 'bg-red-500' : ''}
            `}
            style={{ width: `${confidencePercent}%` }}
          />
        </div>
      </div>

      {/* Erklärung Toggle */}
      <button
        onClick={() => setShowExplanation(!showExplanation)}
        className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-800 transition-colors"
      >
        <Info className="w-4 h-4" />
        <span>Wie wird die Konfidenz berechnet?</span>
        {showExplanation ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {/* Erklärung (expandierbar) */}
      {showExplanation && (
        <div className="mt-3 p-3 bg-white rounded-lg border border-blue-100 text-sm">
          <p className="text-gray-700 mb-2">
            <strong>Die Konfidenz basiert auf:</strong>
          </p>
          <ul className="space-y-1 text-gray-600">
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>
                <strong>Durchschnittliche Ähnlichkeit:</strong> {avgSimilarity}%
                (Semantische Nähe der Quellen zur Frage)
              </span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>
                <strong>Anzahl Quellen:</strong> {sources.length} Paper gefunden
              </span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>
                <strong>Berechnung:</strong> Gewichteter Durchschnitt der Similarity-Scores
              </span>
            </li>
          </ul>
          <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-yellow-800 text-xs">
            <strong>Hinweis:</strong> Eine hohe Konfidenz bedeutet nicht, dass die Antwort korrekt ist.
            Bitte überprüfen Sie die Quellen.
          </div>
        </div>
      )}
    </div>
  );
}
