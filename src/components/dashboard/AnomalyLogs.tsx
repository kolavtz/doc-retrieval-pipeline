'use client';

import React from 'react';
import { usePlatformStore } from '../../lib/store/usePlatformStore';
import { AlertCircle, CheckCircle, ShieldAlert, FileWarning, ArrowRight } from 'lucide-react';

export default function AnomalyLogsPanel() {
  const { documents, activeDocumentId } = usePlatformStore();
  const activeDoc = documents.find((d) => d.id === activeDocumentId);

  if (!activeDoc) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-2xl backdrop-blur-md h-full flex flex-col items-center justify-center text-slate-500">
        <ShieldAlert className="w-8 h-8 mb-2 text-slate-700" />
        <p className="text-xs">Select an ingested document to verify validation logs.</p>
      </div>
    );
  }

  const { status, anomalies, error } = activeDoc;
  const isProcessed = status === 'completed' || status === 'failed';

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-2xl backdrop-blur-md h-full flex flex-col overflow-hidden relative">
      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 opacity-80" />
      
      <h3 className="text-sm font-semibold tracking-wider text-teal-400 uppercase mb-4 flex items-center gap-2 shrink-0">
        <ShieldAlert className="w-4 h-4 text-orange-400" />
        Automated Validation & Anomalies
      </h3>

      {!isProcessed ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 border border-dashed border-slate-800/80 rounded-lg p-6">
          <AlertCircle className="w-7 h-7 mb-2 text-slate-700 animate-pulse" />
          <p className="text-xs font-semibold text-slate-400">Awaiting Extraction Execution</p>
          <p className="text-[10px] text-slate-600 mt-1 max-w-[200px] text-center">Run extraction on this document to trigger the validation rule engine.</p>
        </div>
      ) : status === 'failed' ? (
        <div className="flex-1 flex flex-col items-center justify-center text-red-400 border border-red-950/20 rounded-lg p-6 bg-red-950/5">
          <XCircleIcon className="w-8 h-8 mb-2 text-red-500" />
          <p className="text-xs font-semibold">Extraction Incomplete</p>
          <p className="text-[10px] text-slate-500 mt-1 max-w-[240px] text-center">Validation rules could not be executed because all LLM routing paths failed.</p>
        </div>
      ) : anomalies.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-emerald-500/20 rounded-lg p-6 bg-emerald-500/[0.02]">
          <CheckCircle className="w-9 h-9 mb-2 text-emerald-400" />
          <p className="text-xs font-bold text-slate-200">Compliance Verified</p>
          <p className="text-[10px] text-slate-400 mt-1 max-w-[240px] text-center">All mathematical formulas reconcile. No schema exceptions or date omissions were detected.</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-3 overflow-y-auto pr-1">
          {anomalies.map((anomaly) => {
            const isError = anomaly.type === 'error';
            return (
              <div
                key={anomaly.id}
                className={`p-3.5 border rounded-xl flex items-start gap-3 transition-colors ${
                  isError
                    ? 'border-red-500/20 bg-red-500/[0.02] text-red-200'
                    : 'border-amber-500/20 bg-amber-500/[0.02] text-amber-200'
                }`}
              >
                {isError ? (
                  <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                ) : (
                  <FileWarning className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                )}

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.2 rounded border ${
                      isError
                        ? 'bg-red-500/10 border-red-500/30 text-red-400'
                        : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    }`}>
                      {anomaly.type}
                    </span>
                    {anomaly.field && (
                      <span className="font-mono text-[10px] text-slate-400 font-bold">
                        field: {anomaly.field}
                      </span>
                    )}
                  </div>

                  <p className="text-xs mt-1.5 text-slate-300 leading-relaxed font-medium">
                    {anomaly.message}
                  </p>

                  <div className="mt-2.5 flex items-center gap-1.5 text-[9px] font-bold text-slate-500 cursor-help hover:text-slate-400 transition-colors">
                    <span>Audit Rule Ref: SEC-RULE-104</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                    <span>Compliance Check</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// XCircle helper
function XCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth="2.5"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}
