import React from 'react';
import { BookOpen, Network, Brain, ArrowRight, Sparkles } from 'lucide-react';

/**
 * WelcomeScreen - Epistemischer Disclaimer beim App-Start
 * Erklärt die Funktionsweise des Hybrid RAG Systems
 */
export default function WelcomeScreen({ onDismiss }) {
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex items-center justify-center p-6 z-50">
      <div className="max-w-2xl w-full">
        {/* Logo/Title */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 backdrop-blur mb-6">
            <Sparkles className="w-8 h-8 text-indigo-300" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">
            Knowledge Architect
          </h1>
          <p className="text-lg text-indigo-200">
            Hybrid RAG System für wissenschaftliche Literatur
          </p>
        </div>

        {/* Epistemische Hinweise */}
        <div className="space-y-4 mb-10">
          {/* Relationale Suche */}
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-5">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <Network className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Knowledge Graph (Neo4j)</h3>
                <p className="text-sm text-gray-300">
                  Zeigt <span className="text-emerald-400 font-medium">explizite Verbindungen</span> zwischen
                  Papers: gemeinsame Autoren, Zitationen, Institutionen.
                  Diese Fakten sind nachprüfbar und objektiv.
                </p>
              </div>
            </div>
          </div>

          {/* Semantische Suche */}
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-5">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                <Brain className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Semantische Suche (Vector DB)</h3>
                <p className="text-sm text-gray-300">
                  Findet <span className="text-indigo-400 font-medium">inhaltlich ähnliche</span> Papers
                  basierend auf Text-Embeddings. Diese Ähnlichkeiten sind
                  KI-interpretiert und können variieren.
                </p>
              </div>
            </div>
          </div>

          {/* LLM Antworten */}
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-5">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">KI-generierte Antworten</h3>
                <p className="text-sm text-gray-300">
                  Antworten werden von einem LLM generiert und können
                  <span className="text-amber-400 font-medium"> Ungenauigkeiten</span> enthalten.
                  Quellen werden mit [1], [2] zitiert - überprüfe diese immer.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Transparenz-Hinweis */}
        <div className="text-center mb-8">
          <p className="text-sm text-gray-400">
            Dieses System zeigt transparent, woher Informationen stammen.
            <br />
            Vertraue nicht blind - verifiziere kritische Aussagen.
          </p>
        </div>

        {/* Start Button */}
        <div className="text-center">
          <button
            onClick={onDismiss}
            className="inline-flex items-center px-8 py-4 bg-white text-slate-900 rounded-xl font-semibold text-lg hover:bg-indigo-100 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            Verstanden, weiter zur App
            <ArrowRight className="w-5 h-5 ml-2" />
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-500 mt-8">
          Knowledge Architect v1.0 - Epistemisch transparente Literaturrecherche
        </p>
      </div>
    </div>
  );
}
