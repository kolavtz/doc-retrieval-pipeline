'use client';

import React from 'react';
import { usePlatformStore, EndpointConfig } from '../../lib/store/usePlatformStore';
import { ArrowUp, ArrowDown, GripVertical, CheckCircle2, AlertTriangle, Layers, ToggleLeft, ToggleRight } from 'lucide-react';

export default function PriorityQueuePanel() {
  const { 
    endpoints, 
    routingPriority, 
    setRoutingPriority, 
    isDemoMode, 
    setDemoMode 
  } = usePlatformStore();

  // Get active endpoints in priority order
  const orderedEndpoints = routingPriority
    .map((id) => endpoints.find((e) => e.id === id))
    .filter((e): e is EndpointConfig => !!e);

  // Handle reordering up
  const moveUp = (index: number) => {
    if (index === 0) return;
    const newPriority = [...routingPriority];
    const temp = newPriority[index];
    newPriority[index] = newPriority[index - 1];
    newPriority[index - 1] = temp;
    setRoutingPriority(newPriority);
  };

  // Handle reordering down
  const moveDown = (index: number) => {
    if (index === routingPriority.length - 1) return;
    const newPriority = [...routingPriority];
    const temp = newPriority[index];
    newPriority[index] = newPriority[index + 1];
    newPriority[index + 1] = temp;
    setRoutingPriority(newPriority);
  };

  // Drag and Drop implementation
  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (isNaN(sourceIndex) || sourceIndex === targetIndex) return;

    const newPriority = [...routingPriority];
    const [draggedItem] = newPriority.splice(sourceIndex, 1);
    newPriority.splice(targetIndex, 0, draggedItem);
    setRoutingPriority(newPriority);
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-2xl backdrop-blur-md h-full flex flex-col relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-cyan-500 via-teal-500 to-indigo-500 opacity-80" />
      
      {/* Header with Demo Toggle */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold tracking-wider text-teal-400 uppercase flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          High-Availability Routing Queue
        </h3>
        
        {/* Simulation Control */}
        <div className="flex items-center gap-2 bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Simulation Engine</span>
          <button
            onClick={() => setDemoMode(!isDemoMode)}
            className="text-slate-400 hover:text-white transition-colors focus:outline-none flex items-center cursor-pointer"
          >
            {isDemoMode ? (
              <ToggleRight className="w-6 h-6 text-teal-400" />
            ) : (
              <ToggleLeft className="w-6 h-6 text-slate-600" />
            )}
          </button>
        </div>
      </div>

      {isDemoMode && (
        <div className="mb-4 bg-teal-500/10 border border-teal-500/20 text-teal-200 rounded-lg p-3 text-xs flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-teal-300">Demo Engine Active:</span> Local LLM calls are configured to fail connection tests, demonstrating fallback routing to the backup cloud models in real time.
          </div>
        </div>
      )}

      {orderedEndpoints.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-lg p-6 text-slate-500">
          <AlertTriangle className="w-8 h-8 mb-2 text-slate-600" />
          <p className="text-xs">No models active in queue.</p>
          <p className="text-[10px] text-slate-600 mt-1">Enable registered models in the Endpoint tab.</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-3 overflow-y-auto pr-1">
          {orderedEndpoints.map((ep, index) => {
            const isEnabled = ep.isEnabled;
            const isFailingLocal = isDemoMode && (ep.id === 'local-llm' || ep.name.toLowerCase().includes('local'));

            return (
              <div key={ep.id} className="relative group">
                {/* Connector Arrow */}
                {index < orderedEndpoints.length - 1 && (
                  <div className="absolute left-[26px] bottom-[-20px] w-[2px] h-[22px] bg-slate-800 z-0">
                    <div className="absolute bottom-0 left-[-4px] w-2 h-2 border-r-2 border-b-2 border-slate-800 rotate-45" />
                  </div>
                )}

                {/* Queue Item Card */}
                <div
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                  className={`relative flex items-center justify-between p-3.5 bg-slate-950 border ${
                    !isEnabled 
                      ? 'border-slate-900 opacity-50' 
                      : isFailingLocal 
                        ? 'border-red-500/30 bg-red-950/5' 
                        : 'border-slate-800 hover:border-slate-700'
                  } rounded-xl shadow-lg transition-all cursor-grab active:cursor-grabbing z-10`}
                >
                  <div className="flex items-center gap-3">
                    {/* Index Badge */}
                    <div className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center border ${
                      !isEnabled 
                        ? 'bg-slate-900 border-slate-800 text-slate-600'
                        : isFailingLocal
                          ? 'bg-red-500/10 border-red-500/20 text-red-400'
                          : 'bg-teal-500/10 border-teal-500/20 text-teal-400'
                    }`}>
                      {index + 1}
                    </div>

                    <GripVertical className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors shrink-0" />

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-200">{ep.name}</span>
                        {isFailingLocal && (
                          <span className="text-[9px] px-1.5 py-0.2 bg-red-500/10 text-red-400 border border-red-500/20 rounded font-semibold uppercase">
                            Connection Error Test
                          </span>
                        )}
                        {!isEnabled && (
                          <span className="text-[9px] px-1.5 py-0.2 bg-slate-800 text-slate-500 rounded font-semibold uppercase">
                            Disabled
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-slate-500 uppercase font-bold font-mono tracking-wider">{ep.provider}</span>
                        <span className="text-slate-700 text-[10px]">•</span>
                        <span className="text-[10px] text-slate-500 font-mono">{ep.modelId}</span>
                      </div>
                    </div>
                  </div>

                  {/* Move actions */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => moveUp(index)}
                      disabled={index === 0}
                      className="p-1 hover:bg-slate-900 border border-slate-850 rounded-lg text-slate-500 hover:text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                      title="Move Priority Up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => moveDown(index)}
                      disabled={index === orderedEndpoints.length - 1}
                      className="p-1 hover:bg-slate-900 border border-slate-850 rounded-lg text-slate-500 hover:text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                      title="Move Priority Down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
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
