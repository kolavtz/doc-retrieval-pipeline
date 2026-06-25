'use client';

import React, { useState } from 'react';
import { usePlatformStore } from '../../lib/store/usePlatformStore';
import { BarChart3, Upload, FileCheck, Check, Percent, Play, HelpCircle, Code } from 'lucide-react';

export default function AnalyticsPanel() {
  const { 
    documents, 
    activeDocumentId, 
    groundTruths, 
    evaluateDocumentAccuracy,
    addGroundTruth 
  } = usePlatformStore();

  const [gtJsonInput, setGtJsonInput] = useState('');
  const [gtNameInput, setGtNameInput] = useState('');
  const [selectedGtId, setSelectedGtId] = useState('');
  const [isAddingGt, setIsAddingGt] = useState(false);
  const [gtError, setGtError] = useState('');

  const activeDoc = documents.find((d) => d.id === activeDocumentId);

  const triggerEvaluation = () => {
    if (activeDoc && selectedGtId) {
      evaluateDocumentAccuracy(activeDoc.id, selectedGtId);
    }
  };

  const handleSaveGt = (e: React.FormEvent) => {
    e.preventDefault();
    setGtError('');
    if (!gtNameInput || !gtJsonInput) return;

    try {
      const parsed = JSON.parse(gtJsonInput);
      addGroundTruth(gtNameInput, parsed);
      setGtNameInput('');
      setGtJsonInput('');
      setIsAddingGt(false);
    } catch (err: any) {
      setGtError('Invalid JSON format: ' + err.message);
    }
  };

  if (!activeDoc) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-2xl backdrop-blur-md h-full flex flex-col items-center justify-center text-slate-500">
        <BarChart3 className="w-8 h-8 mb-2 text-slate-700" />
        <p className="text-xs">Select an ingested document to inspect accuracy benchmarks.</p>
      </div>
    );
  }

  const { status, benchmarkMetrics } = activeDoc;
  const isProcessed = status === 'completed';

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-2xl backdrop-blur-md h-full flex flex-col overflow-hidden relative">
      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 opacity-80" />
      
      {/* Header */}
      <h3 className="text-sm font-semibold tracking-wider text-teal-400 uppercase mb-4 flex items-center gap-2 shrink-0">
        <BarChart3 className="w-4 h-4 text-purple-400" />
        Accuracy Benchmarking & Drift
      </h3>

      {!isProcessed ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 border border-dashed border-slate-800/80 rounded-lg p-6">
          <BarChart3 className="w-8 h-8 mb-2 text-slate-700 animate-pulse" />
          <p className="text-xs font-semibold text-slate-400">Benchmarking Offline</p>
          <p className="text-[10px] text-slate-600 mt-1 max-w-[200px] text-center">Extraction output must be populated before running accuracy audits.</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          
          {/* Benchmarking Trigger Setup */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0">
            {/* Ground Truth Picker */}
            <div className="bg-slate-950/80 border border-slate-850 rounded-xl p-3.5 flex flex-col gap-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Select Target Ground Truth</label>
              <div className="flex gap-2">
                <select
                  value={selectedGtId}
                  onChange={(e) => setSelectedGtId(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-100 focus:outline-none focus:border-teal-500/50 cursor-pointer"
                >
                  <option value="">-- Choose Schema --</option>
                  {groundTruths.map((gt) => (
                    <option key={gt.id} value={gt.id}>
                      {gt.documentName} Ground Truth
                    </option>
                  ))}
                </select>
                <button
                  onClick={triggerEvaluation}
                  disabled={!selectedGtId}
                  className="px-3 py-1 bg-teal-500 disabled:bg-slate-800 text-slate-950 disabled:text-slate-500 rounded-lg text-[10px] font-bold shadow-lg shadow-teal-500/10 active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Play className="w-3 h-3 fill-current" />
                  Evaluate
                </button>
              </div>
            </div>

            {/* Quick Stats Grid */}
            {benchmarkMetrics ? (
              <div className="grid grid-cols-2 gap-2">
                {/* Accuracy */}
                <div className="bg-slate-950/80 border border-slate-850 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-500 block">Ground Truth Accuracy</span>
                    <span className="text-xl font-bold font-mono text-emerald-400 mt-1 block">
                      {benchmarkMetrics.overallAccuracy}%
                    </span>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <Percent className="w-4 h-4 text-emerald-400" />
                  </div>
                </div>

                {/* Match summary */}
                <div className="bg-slate-950/80 border border-slate-850 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-500 block">Reconciled Fields</span>
                    <span className="text-sm font-semibold text-slate-200 mt-1 block">
                      {benchmarkMetrics.matchedKeysCount} / {benchmarkMetrics.extractedKeysCount}
                    </span>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                    <FileCheck className="w-4 h-4 text-indigo-400" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="border border-slate-850 rounded-xl p-3.5 flex items-center justify-center text-[10px] text-slate-500 italic text-center">
                Configure a matching Ground Truth template and click Evaluate to calculate drift ratio.
              </div>
            )}
          </div>

          {/* Add custom ground truth forms */}
          {isAddingGt ? (
            <form onSubmit={handleSaveGt} className="bg-slate-950/90 border border-slate-850 rounded-xl p-4 shrink-0 flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase">New Ground Truth Target</span>
                {gtError && <span className="text-[9px] text-red-400 font-bold">{gtError}</span>}
              </div>
              <input
                type="text"
                value={gtNameInput}
                onChange={(e) => setGtNameInput(e.target.value)}
                placeholder="e.g. Acme Q3 Invoice"
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-teal-500/50"
                required
              />
              <textarea
                value={gtJsonInput}
                onChange={(e) => setGtJsonInput(e.target.value)}
                placeholder='{\n  "invoice_number": "INV-10022",\n  "grand_total": 7577.50\n}'
                className="bg-slate-950 border border-slate-800 rounded-lg p-2 font-mono text-[10px] h-20 text-teal-400 focus:outline-none focus:border-teal-500/50"
                required
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingGt(false)}
                  className="px-3 py-1 bg-slate-900 border border-slate-800 text-slate-400 rounded-lg text-[10px] font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 bg-teal-500 text-slate-950 rounded-lg text-[10px] font-bold hover:bg-teal-400"
                >
                  Save Schema
                </button>
              </div>
            </form>
          ) : (
            <div className="flex justify-end shrink-0">
              <button
                onClick={() => setIsAddingGt(true)}
                className="px-3 py-1 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
              >
                <Upload className="w-3 h-3" />
                Add Ground Truth JSON
              </button>
            </div>
          )}

          {/* Drift report comparison table */}
          {benchmarkMetrics ? (
            <div className="flex-1 overflow-hidden border border-slate-850 rounded-xl bg-slate-950 flex flex-col">
              <div className="flex-1 overflow-y-auto scrollbar-thin">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/40 text-slate-400 font-semibold uppercase tracking-wider text-[10px] sticky top-0">
                      <th className="px-4 py-3">Audit Field</th>
                      <th className="px-4 py-3">Extracted JSON</th>
                      <th className="px-4 py-3">Ground Truth</th>
                      <th className="px-4 py-3 text-right">Match Ratio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900/60">
                    {benchmarkMetrics.driftReport.map((report) => (
                      <tr key={report.field} className="hover:bg-slate-900/10 transition-colors">
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-400 font-semibold">{report.field}</td>
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-300 max-w-[140px] truncate" title={report.extracted}>{report.extracted}</td>
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-400 max-w-[140px] truncate" title={report.groundTruth}>{report.groundTruth}</td>
                        <td className="px-4 py-3 text-right align-middle">
                          <span className={`px-2 py-0.5 rounded text-[8px] uppercase tracking-wider font-extrabold ${
                            report.status === 'match' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            report.status === 'partial' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                            'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}>
                            {report.similarity}% {report.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 border border-dashed border-slate-800/80 rounded-lg p-6">
              <Code className="w-8 h-8 mb-2 text-slate-700" />
              <p className="text-xs">No active evaluation run found.</p>
              <p className="text-[10px] text-slate-600 mt-1 max-w-[240px] text-center">Pick a template (e.g. invoice or contract) above and click Evaluate to inspect drift report.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
