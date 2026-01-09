import React, { useState } from 'react';
import { ExternalLink, ChevronDown, ChevronUp, CheckCircle, BookOpen } from 'lucide-react';

/**
 * SourceCard - Einzelne Quelle mit allen Details
 * Epistemische Prinzipien: NACHVOLLZIEHBARKEIT + INTERSUBJEKTIVITÄT
 *
 * Basiert auf den echten Datenfeldern aus Scopus/Excel:
 * title, authors, abstract, date, vhbRanking, abdcRanking,
 * journal_name, doi, url, citations
 */
export default function SourceCard({ source, index }) {
  const [expanded, setExpanded] = useState(false);

  // Destrukturiere die echten Felder aus den Daten
  const {
    title = 'Unbekannter Titel',
    authors = 'Unbekannte Autoren',
    year = null,        // Wird aus date extrahiert oder direkt übergeben
    date = null,        // Alternativ: Volles Datum
    similarity = 0,     // Vom Search-Algorithmus berechnet
    doi = null,
    url = null,
    journal_name = null,
    vhbRanking = null,
    abdcRanking = null,
    citations = null,
    abstract = null
  } = source;

  // Jahr aus date extrahieren falls nicht direkt vorhanden
  const displayYear = year || (date ? date.substring(0, 4) : 'N/A');

  const matchPercent = Math.round(similarity * 100);

  // Ranking-Badge Farbe basierend auf VHB/ABDC System
  const getRankingColor = (ranking) => {
    if (!ranking) return 'bg-gray-100 text-gray-600';
    const r = ranking.toUpperCase();
    if (r === 'A+' || r === 'A*') return 'bg-green-100 text-green-700 border border-green-300';
    if (r === 'A') return 'bg-blue-100 text-blue-700 border border-blue-300';
    if (r === 'B') return 'bg-yellow-100 text-yellow-700 border border-yellow-300';
    if (r === 'C') return 'bg-orange-100 text-orange-700 border border-orange-300';
    return 'bg-gray-100 text-gray-600';
  };

  // Autoren formatieren (von "Name, Vorname (ID); ..." zu "Name, V.; ...")
  const formatAuthors = (authorsStr) => {
    if (!authorsStr) return 'Unbekannte Autoren';
    // Entferne IDs in Klammern und kürze
    return authorsStr
      .replace(/\s*\(\d+\)/g, '')  // Entferne (123456) IDs
      .split(';')
      .slice(0, 3)  // Maximal 3 Autoren zeigen
      .map(a => a.trim())
      .join('; ')
      + (authorsStr.split(';').length > 3 ? ' et al.' : '');
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:border-indigo-300 hover:shadow-md transition-all bg-white">
      {/* Header */}
      <div className="flex justify-between items-start mb-2">
        <h5 className="font-medium text-gray-800 flex-1 leading-tight">
          <span className="text-indigo-600 font-bold mr-1">[{index}]</span>
          {title}
        </h5>
        <div className="flex items-center space-x-2 ml-2 flex-shrink-0">
          <span className={`text-sm px-2 py-1 rounded-full font-medium
            ${matchPercent >= 80 ? 'bg-green-100 text-green-700' :
              matchPercent >= 50 ? 'bg-yellow-100 text-yellow-700' :
              'bg-gray-100 text-gray-600'}
          `}>
            {matchPercent}% Match
          </span>
        </div>
      </div>

      {/* Autoren & Jahr */}
      <p className="text-sm text-gray-600 mb-3">
        {formatAuthors(authors)} ({displayYear})
      </p>

      {/* Badges Row - INTERSUBJEKTIVITÄT */}
      <div className="flex flex-wrap gap-2 mb-3">
        {/* Peer-Review Badge - Akademische Journals sind peer-reviewed */}
        <span className="inline-flex items-center px-2 py-1 bg-green-50 text-green-700 rounded-full text-xs border border-green-200">
          <CheckCircle className="w-3 h-3 mr-1" />
          Peer-Reviewed
        </span>

        {/* Journal Name */}
        {journal_name && (
          <span className="inline-flex items-center px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs border border-blue-200">
            <BookOpen className="w-3 h-3 mr-1" />
            {journal_name.length > 30 ? journal_name.substring(0, 30) + '...' : journal_name}
          </span>
        )}

        {/* VHB Ranking */}
        {vhbRanking && (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRankingColor(vhbRanking)}`}>
            VHB: {vhbRanking}
          </span>
        )}

        {/* ABDC Ranking */}
        {abdcRanking && (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRankingColor(abdcRanking)}`}>
            ABDC: {abdcRanking}
          </span>
        )}

        {/* Zitationen */}
        {citations !== null && citations !== undefined && (
          <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded-full text-xs border border-purple-200">
            {citations} Zitierungen
          </span>
        )}
      </div>

      {/* NACHVOLLZIEHBARKEIT - DOI & Links */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {doi && (
          <a
            href={`https://doi.org/${doi}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:text-indigo-800 hover:underline inline-flex items-center"
          >
            DOI: {doi.length > 35 ? doi.substring(0, 35) + '...' : doi}
            <ExternalLink className="w-3 h-3 ml-1" />
          </a>
        )}

        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:text-indigo-800 hover:underline inline-flex items-center"
          >
            Quelle ansehen
            <ExternalLink className="w-3 h-3 ml-1" />
          </a>
        )}
      </div>

      {/* Expandierbares Abstract */}
      {abstract && (
        <div className="mt-3 border-t pt-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            {expanded ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
            {expanded ? 'Abstract verbergen' : 'Abstract anzeigen'}
          </button>

          {expanded && (
            <p className="mt-2 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg leading-relaxed">
              {abstract.length > 500 ? abstract.substring(0, 500) + '...' : abstract}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
