import React from 'react';
import { X, Users, Tag, FileText, ExternalLink } from 'lucide-react';

/**
 * ConnectionModal - Zeigt Details zur Verbindung zwischen zwei Papers
 * Epistemisches Prinzip: TRANSPARENZ
 *
 * Props:
 * - connection: { source: Paper, target: Paper, sharedAuthors: [], sharedKeywords: [] }
 * - onClose: function
 * - onPaperClick: function - Wenn User mehr Details zu einem Paper will
 */
export default function ConnectionModal({ connection, onClose, onPaperClick }) {
  if (!connection) return null;

  const { source, target, sharedAuthors = [], sharedKeywords = [] } = connection;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">
            Verbindung zwischen Papers
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Die zwei Papers */}
          <div className="flex items-center justify-center mb-6">
            <div className="flex-1 text-center p-3 bg-green-50 rounded-lg border border-green-200">
              <FileText className="w-6 h-6 mx-auto mb-2 text-green-600" />
              <p className="text-sm font-medium text-gray-800 line-clamp-2">
                {source?.title || 'Paper A'}
              </p>
            </div>

            <div className="px-4 text-2xl text-gray-400">↔</div>

            <div className="flex-1 text-center p-3 bg-green-50 rounded-lg border border-green-200">
              <FileText className="w-6 h-6 mx-auto mb-2 text-green-600" />
              <p className="text-sm font-medium text-gray-800 line-clamp-2">
                {target?.title || 'Paper B'}
              </p>
            </div>
          </div>

          {/* Transparenz-Erklärung */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center mb-2">
              <span className="text-lg mr-2">🎯</span>
              <h4 className="font-semibold text-blue-800">Warum sind diese Papers verbunden?</h4>
            </div>
            <p className="text-sm text-blue-700">
              Die Verbindung basiert auf gemeinsamen Eigenschaften, die auf thematische
              oder autorenbezogene Zusammenhänge hinweisen.
            </p>
          </div>

          {/* Gemeinsame Autoren */}
          {sharedAuthors.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center mb-2">
                <Users className="w-5 h-5 text-indigo-600 mr-2" />
                <h4 className="font-medium text-gray-800">
                  Gemeinsame Autoren ({sharedAuthors.length})
                </h4>
              </div>
              <div className="flex flex-wrap gap-2 pl-7">
                {sharedAuthors.map((author, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm"
                  >
                    {author}
                  </span>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2 pl-7">
                Diese Autoren haben an beiden Papers mitgearbeitet.
              </p>
            </div>
          )}

          {/* Gemeinsame Themen/Keywords */}
          {sharedKeywords.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center mb-2">
                <Tag className="w-5 h-5 text-amber-600 mr-2" />
                <h4 className="font-medium text-gray-800">
                  Gemeinsame Themen ({sharedKeywords.length})
                </h4>
              </div>
              <div className="flex flex-wrap gap-2 pl-7">
                {sharedKeywords.map((keyword, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2 pl-7">
                Beide Papers behandeln diese Themen.
              </p>
            </div>
          )}

          {/* Keine Verbindung gefunden */}
          {sharedAuthors.length === 0 && sharedKeywords.length === 0 && (
            <div className="text-center py-4 text-gray-500">
              <p>Keine gemeinsamen Eigenschaften gefunden.</p>
            </div>
          )}

          {/* Verbindungsstärke */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-700 mb-2">Verbindungsstärke</h4>
            <div className="flex items-center">
              <div className="flex-1 bg-gray-200 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-green-400 to-green-600 h-3 rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (sharedAuthors.length * 30 + sharedKeywords.length * 20))}%`
                  }}
                />
              </div>
              <span className="ml-3 text-sm font-medium text-gray-600">
                {sharedAuthors.length > 0 && sharedKeywords.length > 0
                  ? 'Stark'
                  : sharedAuthors.length > 0 || sharedKeywords.length > 1
                  ? 'Mittel'
                  : 'Schwach'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Basiert auf: {sharedAuthors.length} gemeinsame Autoren, {sharedKeywords.length} gemeinsame Themen
            </p>
          </div>

          {/* Paper Details Buttons */}
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              onClick={() => onPaperClick?.(source)}
              className="flex items-center justify-center px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm font-medium text-gray-700"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Paper A Details
            </button>
            <button
              onClick={() => onPaperClick?.(target)}
              className="flex items-center justify-center px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm font-medium text-gray-700"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Paper B Details
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
