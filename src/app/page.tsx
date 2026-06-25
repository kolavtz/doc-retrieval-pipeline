'use client';

import React, { useState, useEffect } from 'react';
import { usePlatformStore } from '../lib/store/usePlatformStore';
import EndpointConfigPanel from '../components/inference/EndpointConfig';
import PriorityQueuePanel from '../components/inference/PriorityQueue';
import DocumentDropzone from '../components/workspace/Dropzone';
import DocumentExtractor from '../components/workspace/Extractor';
import AnomalyLogsPanel from '../components/dashboard/AnomalyLogs';
import AnalyticsPanel from '../components/dashboard/Analytics';
import { Shield, LayoutDashboard, Layers, BarChart3, AlertCircle, RefreshCw, Cpu, Activity } from 'lucide-react';

export default function DashboardHome() {
  const { endpoints, documents, isDemoMode, setDemoMode } = usePlatformStore();
  const [activeTab, setActiveTab] = useState<'workspace' | 'endpoints' | 'dashboard'>('workspace');
  const [liveLogs, setLiveLogs] = useState<{ id: string; msg: string; type: 'info' | 'warn' | 'success' }[]>([]);

  // Calculate live stats
  const activeModelsCount = endpoints.filter(e => e.isEnabled).length;
  const processedDocsCount = documents.filter(d => d.status === 'completed').length;
  
  // Calculate average accuracy if any document is benchmarked
  const benchmarkedDocs = documents.filter(d => d.benchmarkMetrics);
  const avgAccuracy = benchmarkedDocs.length > 0
    ? Math.round(benchmarkedDocs.reduce((acc, d) => acc + (d.benchmarkMetrics?.overallAccuracy || 0), 0) / benchmarkedDocs.length)
    : 0;

  // Listen to document extraction logs to display Toast audit events
  useEffect(() => {
    const latestDoc = documents[documents.length - 1];
    if (!latestDoc || !latestDoc.extractionResult) return;

    const trajectory = latestDoc.extractionResult.metadata.trajectory;
    if (!trajectory || trajectory.length === 0) return;

    const newLogs: typeof liveLogs = [];
    trajectory.forEach((log) => {
      const isLogged = liveLogs.some(l => l.msg.includes(log.endpointName) && l.msg.includes(log.status));
      if (!isLogged) {
        newLogs.push({
          id: 'log-' + Math.random().toString(36).substring(2, 9),
          msg: log.status === 'success'
            ? `Extraction SECURED on model: ${log.endpointName} (${log.latencyMs}ms)`
            : `Failover TRIGGERED: ${log.endpointName} failed (${log.error || 'Timeout'})`,
          type: log.status === 'success' ? 'success' : 'warn'
        });
      }
    });

    if (newLogs.length > 0) {
      setLiveLogs(prev => [...newLogs, ...prev].slice(0, 10)); // keep last 10 logs
    }
  }, [documents]);

  const clearLogs = () => setLiveLogs([]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-950 text-slate-100 font-sans selection:bg-teal-500/30">
      
      {/* 1. Header with Stats */}
      <header className="shrink-0 bg-slate-900/60 border-b border-slate-900 px-6 py-4 flex items-center justify-between backdrop-blur-md z-30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-teal-500/10">
            <Cpu className="w-5 h-5 text-slate-950 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-base font-extrabold tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-teal-400 via-cyan-300 to-indigo-400">
              AETHERDOC PLATFORM
            </h1>
            <span className="text-[9px] uppercase font-bold tracking-widest text-teal-400/80">Document Intelligence & LLM Failover</span>
          </div>
        </div>

        {/* Live Performance Stats Banner */}
        <div className="hidden md:flex items-center gap-6 bg-slate-950/40 border border-slate-850 px-5 py-1.5 rounded-xl">
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-teal-400" />
            <div className="flex flex-col">
              <span className="text-[8px] uppercase font-bold text-slate-500">Active Routing Nodes</span>
              <span className="text-[11px] font-bold font-mono text-slate-200">{activeModelsCount} / {endpoints.length}</span>
            </div>
          </div>

          <div className="h-6 w-[1px] bg-slate-800" />

          <div className="flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
            <div className="flex flex-col">
              <span className="text-[8px] uppercase font-bold text-slate-500">Consolidated Tasks</span>
              <span className="text-[11px] font-bold font-mono text-slate-200">{processedDocsCount} / {documents.length}</span>
            </div>
          </div>

          {avgAccuracy > 0 && (
            <>
              <div className="h-6 w-[1px] bg-slate-800" />
              <div className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-purple-400" />
                <div className="flex flex-col">
                  <span className="text-[8px] uppercase font-bold text-slate-500">Accuracy Benchmark</span>
                  <span className="text-[11px] font-bold font-mono text-emerald-400">{avgAccuracy}%</span>
                </div>
              </div>
            </>
          )}
        </div>
      </header>

      {/* 2. Primary Layout Shell */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Navigation Sidebar */}
        <aside className="w-64 shrink-0 bg-slate-900/30 border-r border-slate-900 p-4 flex flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 px-3">Control Plane</span>
            
            <button
              onClick={() => setActiveTab('workspace')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                activeTab === 'workspace'
                  ? 'bg-slate-900 border-teal-500/20 text-teal-400 shadow-lg shadow-teal-500/[0.02]'
                  : 'bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              Ingestion Workspace
            </button>

            <button
              onClick={() => setActiveTab('endpoints')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                activeTab === 'endpoints'
                  ? 'bg-slate-900 border-teal-500/20 text-teal-400 shadow-lg shadow-teal-500/[0.02]'
                  : 'bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
              }`}
            >
              <Layers className="w-4 h-4" />
              API Inference Manager
            </button>

            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-slate-900 border-teal-500/20 text-teal-400 shadow-lg shadow-teal-500/[0.02]'
                  : 'bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Quality & Verification
            </button>
          </div>

          {/* Alert Logs Preview in Sidebar */}
          {liveLogs.length > 0 && (
            <div className="flex-1 flex flex-col gap-2.5 overflow-hidden">
              <div className="flex items-center justify-between px-3">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Live Ingest Events</span>
                <button onClick={clearLogs} className="text-[9px] text-teal-500 hover:text-teal-400 font-bold">Clear</button>
              </div>
              
              <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 scrollbar-thin">
                {liveLogs.map((log) => (
                  <div
                    key={log.id}
                    className={`p-2.5 border rounded-lg text-[10px] leading-relaxed ${
                      log.type === 'success'
                        ? 'border-emerald-500/20 bg-emerald-500/[0.02] text-emerald-300'
                        : 'border-amber-500/20 bg-amber-500/[0.02] text-amber-300'
                    }`}
                  >
                    {log.msg}
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Main Console Panels */}
        <main className="flex-1 p-6 overflow-hidden bg-slate-950/40 relative">
          
          {activeTab === 'workspace' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full overflow-hidden">
              {/* Left Column: Dropzone & OCR */}
              <div className="h-full overflow-hidden">
                <DocumentDropzone />
              </div>
              {/* Right Column: Output Extractor */}
              <div className="h-full overflow-hidden">
                <DocumentExtractor />
              </div>
            </div>
          )}

          {activeTab === 'endpoints' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full overflow-hidden">
              {/* Left Column: Config Forms */}
              <div className="h-full overflow-hidden">
                <EndpointConfigPanel />
              </div>
              {/* Right Column: Reordering List */}
              <div className="h-full overflow-hidden">
                <PriorityQueuePanel />
              </div>
            </div>
          )}

          {activeTab === 'dashboard' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full overflow-hidden">
              {/* Left Column: Math & Signing anomalies */}
              <div className="h-full overflow-hidden">
                <AnomalyLogsPanel />
              </div>
              {/* Right Column: Accuracy drift benchmarking */}
              <div className="h-full overflow-hidden">
                <AnalyticsPanel />
              </div>
            </div>
          )}

        </main>
      </div>

    </div>
  );
}
