'use client';

import React, { useState } from 'react';
import { usePlatformStore } from '../../lib/store/usePlatformStore';
import { Play, Code, LayoutGrid, Clock, Cpu, HelpCircle, CheckCircle, XCircle } from 'lucide-react';

export default function DocumentExtractor() {
  const { documents, activeDocumentId, runExtraction } = usePlatformStore();
  const [viewMode, setViewMode] = useState<'structured' | 'raw'>('structured');
  const [isLoading, setIsLoading] = useState(false);

  const activeDoc = documents.find((d) => d.id === activeDocumentId);

  const handleExtraction = async () => {
    if (!activeDoc) return;
    setIsLoading(true);
    await runExtraction(activeDoc.id);
    setIsLoading(false);
  };

  // Helper to color confidence badges
  const getConfidenceBadgeClass = (score: number) => {
    if (score >= 90) return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    if (score >= 70) return 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20';
    return 'bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse';
  };

  const getConfidenceText = (score: number) => {
    if (score >= 90) return 'High';
    if (score >= 70) return 'Medium';
    return 'Low Risk';
  };

  // Render nested JSON fields recursively or as flat lists
  const renderKeyValueItem = (key: string, value: any, confidence: number) => {
    if (value === null || value === undefined) {
      return (
        <tr key={key} className="border-b border-slate-900/40 hover:bg-slate-900/10 transition-colors">
          <td className="px-4 py-3 font-mono text-[11px] text-slate-400 font-semibold">{key}</td>
          <td className="px-4 py-3 text-xs italic text-slate-600">null</td>
          <td className="px-4 py-3 text-right">
            <span className={`px-1.5 py-0.2 rounded text-[8px] uppercase tracking-wider font-bold ${getConfidenceBadgeClass(confidence)}`}>
              {confidence}% {getConfidenceText(confidence)}
            </span>
          </td>
        </tr>
      );
    }

    if (typeof value === 'object' && !Array.isArray(value)) {
      return (
        <tr key={key} className="border-b border-slate-900/40 hover:bg-slate-900/10 transition-colors">
          <td className="px-4 py-3 font-mono text-[11px] text-slate-400 font-semibold align-top">{key}</td>
          <td className="px-4 py-3 text-xs align-top" colSpan={2}>
            <div className="bg-slate-950/50 rounded-lg p-2.5 border border-slate-900">
              <table className="w-full">
                <tbody>
                  {Object.entries(value).map(([nestedKey, nestedValue]) => (
                    <tr key={nestedKey}>
                      <td className="font-mono text-[10px] text-slate-500 pr-4 py-0.5">{nestedKey}:</td>
                      <td className="text-slate-300 font-mono text-[10px] py-0.5">{String(nestedValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      );
    }

    if (Array.isArray(value)) {
      return (
        <tr key={key} className="border-b border-slate-900/40 hover:bg-slate-900/10 transition-colors">
          <td className="px-4 py-3 font-mono text-[11px] text-slate-400 font-semibold align-top">{key}</td>
          <td className="px-4 py-3 text-xs align-top" colSpan={2}>
            <div className="bg-slate-950/50 rounded-lg p-2 border border-slate-900 flex flex-col gap-2">
              {value.map((item, idx) => (
                <div key={idx} className="border-b border-slate-900/80 last:border-b-0 pb-1.5 last:pb-0">
                  <span className="text-[9px] uppercase tracking-wider font-bold text-slate-500">Item {idx + 1}</span>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {typeof item === 'object' ? (
                      Object.entries(item).map(([k, v]) => (
                        <div key={k} className="flex flex-col">
                          <span className="text-[8px] uppercase font-bold text-slate-600 font-mono">{k}</span>
                          <span className="text-[10px] text-slate-300 font-mono">{String(v)}</span>
                        </div>
                      ))
                    ) : (
                      <span className="text-[10px] text-slate-300 font-mono">{String(item)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </td>
        </tr>
      );
    }

    return (
      <tr key={key} className="border-b border-slate-900/40 hover:bg-slate-900/10 transition-colors">
        <td className="px-4 py-3 font-mono text-[11px] text-slate-400 font-semibold">{key}</td>
        <td className="px-4 py-3 text-xs font-mono text-slate-200 break-all select-text">{String(value)}</td>
        <td className="px-4 py-3 text-right">
          <span className={`px-1.5 py-0.2 rounded text-[8px] uppercase tracking-wider font-bold ${getConfidenceBadgeClass(confidence)}`}>
            {confidence}% {getConfidenceText(confidence)}
          </span>
        </td>
      </tr>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-2xl backdrop-blur-md overflow-hidden relative">
      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 opacity-80" />
      
      {/* Header Toolbar */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4 shrink-0">
        <h3 className="text-sm font-semibold tracking-wider text-teal-400 uppercase flex items-center gap-2">
          <Cpu className="w-4 h-4 text-emerald-400" />
          Extraction Console
        </h3>

        {activeDoc && activeDoc.status !== 'pending' && (
          <button
            onClick={handleExtraction}
            disabled={isLoading || activeDoc.status === 'extracting'}
            className="px-4 py-1.5 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 disabled:from-slate-800 disabled:to-slate-800 text-slate-950 disabled:text-slate-500 rounded-lg text-xs font-bold shadow-lg shadow-teal-500/10 active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
          >
            {isLoading || activeDoc.status === 'extracting' ? (
              <>
                <Loader className="w-3.5 h-3.5 animate-spin" />
                Parsing...
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current stroke-[2.5]" />
                Extract Structure
              </>
            )}
          </button>
        )}
      </div>

      {!activeDoc ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
          <Cpu className="w-9 h-9 mb-2 text-slate-700" />
          <p className="text-xs">Awaiting document ingestion.</p>
        </div>
      ) : activeDoc.status === 'pending' || activeDoc.status === 'ocr_extracted' ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 border border-dashed border-slate-800/80 rounded-lg p-6">
          <Cpu className="w-9 h-9 mb-2 text-slate-700 animate-pulse" />
          <p className="text-xs font-semibold text-slate-400">OCR Parsing Ready</p>
          <p className="text-[10px] text-slate-600 mt-1 max-w-[240px] text-center">Click "Extract Structure" above to trigger high-availability multi-model parsing.</p>
        </div>
      ) : activeDoc.status === 'extracting' ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
          <div className="relative w-12 h-12 mb-3">
            <div className="absolute inset-0 rounded-full border-4 border-slate-800 border-t-teal-500 animate-spin" />
            <div className="absolute inset-2 rounded-full border-4 border-slate-800 border-b-cyan-500 animate-spin-reverse" />
          </div>
          <p className="text-xs font-semibold">Traversing Priority Failover Chain...</p>
          <p className="text-[10px] text-slate-500 mt-1">Executing Adapter Ingestion Payload</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden gap-4">
          
          {/* Failover Trajectory Visualizer */}
          {activeDoc.extractionResult?.metadata.trajectory && (
            <div className="bg-slate-950/80 border border-slate-850 rounded-xl p-3.5">
              <h4 className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-2.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Failover Ingestion Trajectory
              </h4>
              
              <div className="flex flex-wrap items-center gap-2">
                {activeDoc.extractionResult.metadata.trajectory.map((log, idx) => (
                  <React.Fragment key={log.endpointId}>
                    {idx > 0 && <span className="text-slate-700 text-xs font-bold">➔</span>}
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-semibold ${
                      log.status === 'success'
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        : 'bg-red-500/5 border-red-500/20 text-red-400'
                    }`} title={log.error}>
                      {log.status === 'success' ? (
                        <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-3 h-3 text-red-400 shrink-0" />
                      )}
                      <span>{log.endpointName}</span>
                      <span className="text-slate-600">({log.latencyMs}ms)</span>
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {/* Model details / Metadata */}
          {activeDoc.extractionResult && (
            <div className="flex flex-col gap-2 border-b border-slate-850 pb-2">
              <div className="flex items-center justify-between text-[10px] text-slate-500">
                <span className="flex items-center gap-1">
                  Resolved Model: <span className="font-mono text-slate-300 font-semibold">{activeDoc.extractionResult.metadata.modelUsed}</span>
                </span>
                <span>
                  Total Latency: <span className="text-teal-400 font-bold font-mono">{activeDoc.extractionResult.metadata.latencyMs}ms</span>
                </span>
              </div>
              <div className="flex items-center gap-4 text-[10px] text-slate-400">
                <span className="flex items-center gap-1.5">
                  Category: 
                  <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                    activeDoc.category === 'Bills' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' :
                    activeDoc.category === 'Legal' ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20' :
                    activeDoc.category === 'Operations' ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/20' :
                    'bg-slate-500/15 text-slate-400 border border-slate-500/20'
                  }`}>
                    {activeDoc.category || 'Other'}
                  </span>
                </span>
                <span className="flex items-center gap-1.5">
                  Subcategory: 
                  <span className="text-slate-200 font-semibold px-2 py-0.5 bg-slate-950 rounded border border-slate-850 text-[9px]">
                    {activeDoc.subcategory || 'General'}
                  </span>
                </span>
              </div>
            </div>
          )}

          {/* Error Message if failed */}
          {activeDoc.status === 'failed' && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-300 rounded-lg p-3 text-xs flex items-start gap-2">
              <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-red-400">Critical Error:</span> {activeDoc.error}
              </div>
            </div>
          )}

          {/* Data Explorer */}
          {activeDoc.extractionResult && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Toggles */}
              <div className="flex items-center justify-end gap-1.5 mb-2.5 shrink-0">
                <button
                  onClick={() => setViewMode('structured')}
                  className={`p-1 rounded transition-all cursor-pointer ${
                    viewMode === 'structured' ? 'bg-slate-800 text-teal-400' : 'text-slate-500 hover:text-slate-400'
                  }`}
                  title="Structured view"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('raw')}
                  className={`p-1 rounded transition-all cursor-pointer ${
                    viewMode === 'raw' ? 'bg-slate-800 text-teal-400' : 'text-slate-500 hover:text-slate-400'
                  }`}
                  title="Raw JSON view"
                >
                  <Code className="w-4 h-4" />
                </button>
              </div>

              {/* View Output */}
              <div className="flex-1 overflow-hidden border border-slate-850 rounded-xl bg-slate-950">
                {viewMode === 'raw' ? (
                  <pre className="w-full h-full p-4 font-mono text-[11px] leading-relaxed text-teal-300 overflow-y-auto whitespace-pre select-text scrollbar-thin">
                    {JSON.stringify(activeDoc.extractionResult.extractedData, null, 2)}
                  </pre>
                ) : (
                  <div className="w-full h-full overflow-y-auto scrollbar-thin">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-900/40 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                          <th className="px-4 py-3">JSON Key</th>
                          <th className="px-4 py-3">Extracted Value</th>
                          <th className="px-4 py-3 text-right">Confidence</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(activeDoc.extractionResult.extractedData).map(([key, value]) => {
                          const confidence = activeDoc.extractionResult?.confidenceScores?.[key] ?? 90;
                          return renderKeyValueItem(key, value, confidence);
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Loader wrapper
function Loader({ className }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      ></circle>
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      ></path>
    </svg>
  );
}
