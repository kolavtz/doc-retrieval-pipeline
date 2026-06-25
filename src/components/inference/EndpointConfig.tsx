'use client';

import React, { useState, useEffect } from 'react';
import { usePlatformStore, ProviderType, EndpointConfig } from '../../lib/store/usePlatformStore';
import { Plus, Trash2, Edit2, Check, X, Shield, ShieldAlert, Key, Globe, Cpu } from 'lucide-react';

const PROVIDERS: { value: ProviderType; label: string; defaultUrl: string; models: string[] }[] = [
  {
    value: 'openai',
    label: 'OpenAI',
    defaultUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'o1-mini'],
  },
  {
    value: 'anthropic',
    label: 'Anthropic Claude',
    defaultUrl: 'https://api.anthropic.com/v1',
    models: ['claude-3-5-sonnet-20240620', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
  },
  {
    value: 'google',
    label: 'Google Gemini',
    defaultUrl: 'https://generativelanguage.googleapis.com',
    models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp'],
  },
  {
    value: 'groq',
    label: 'Groq Cloud',
    defaultUrl: 'https://api.groq.com/openai/v1',
    models: ['llama-3.1-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
  },
  {
    value: 'xai',
    label: 'xAI Grok',
    defaultUrl: 'https://api.x.ai/v1',
    models: ['grok-beta'],
  },
  {
    value: 'custom',
    label: 'Custom / Local (Ollama/LM Studio)',
    defaultUrl: 'http://localhost:1234/v1',
    models: ['llama3', 'mistral', 'phi3', 'custom-model'],
  },
];

export default function EndpointConfigPanel() {
  const { endpoints, addEndpoint, updateEndpoint, deleteEndpoint } = usePlatformStore();
  
  // Form State
  const [name, setName] = useState('');
  const [provider, setProvider] = useState<ProviderType>('openai');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [modelId, setModelId] = useState('');
  const [isEditing, setIsEditing] = useState<string | null>(null);

  // Auto-populate default values when provider changes
  useEffect(() => {
    const selectedProvider = PROVIDERS.find((p) => p.value === provider);
    if (selectedProvider) {
      setBaseUrl(selectedProvider.defaultUrl);
      setModelId(selectedProvider.models[0]);
    }
  }, [provider]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !baseUrl || !modelId) return;

    if (isEditing) {
      updateEndpoint(isEditing, {
        name,
        provider,
        baseUrl,
        apiKey: apiKey || 'not-needed',
        modelId,
      });
      setIsEditing(null);
    } else {
      addEndpoint({
        name,
        provider,
        baseUrl,
        apiKey: apiKey || 'not-needed',
        modelId,
        isEnabled: true,
      });
    }

    // Reset Form
    setName('');
    setApiKey('');
    const firstProvider = PROVIDERS[0];
    setProvider(firstProvider.value);
    setBaseUrl(firstProvider.defaultUrl);
    setModelId(firstProvider.models[0]);
  };

  const handleEdit = (endpoint: EndpointConfig) => {
    setIsEditing(endpoint.id);
    setName(endpoint.name);
    setProvider(endpoint.provider);
    setBaseUrl(endpoint.baseUrl);
    setApiKey(endpoint.apiKey === 'not-needed' ? '' : endpoint.apiKey);
    setModelId(endpoint.modelId);
  };

  const cancelEdit = () => {
    setIsEditing(null);
    setName('');
    setApiKey('');
    const selected = PROVIDERS.find((p) => p.value === provider);
    if (selected) {
      setBaseUrl(selected.defaultUrl);
      setModelId(selected.models[0]);
    }
  };

  const selectedProviderInfo = PROVIDERS.find((p) => p.value === provider);

  return (
    <div className="flex flex-col gap-6 h-full overflow-y-auto pr-1">
      {/* Configuration Form */}
      <form onSubmit={handleSubmit} className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-2xl backdrop-blur-md relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-teal-500 via-emerald-500 to-cyan-500 opacity-80" />
        
        <h3 className="text-sm font-semibold tracking-wider text-teal-400 uppercase mb-4 flex items-center gap-2">
          <Cpu className="w-4 h-4" />
          {isEditing ? 'Modify Endpoint Credentials' : 'Add LLM Ingest Endpoint'}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Endpoint Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400">Endpoint Identifier Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Claude 3.5 Backup"
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500/50 transition-colors"
              required
            />
          </div>

          {/* Provider Selection */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400">Model Provider</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as ProviderType)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-teal-500/50 transition-colors cursor-pointer"
            >
              {PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Base URL */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400 flex items-center gap-1">
              <Globe className="w-3 h-3 text-slate-500" />
              API Base URL
            </label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.openai.com/v1"
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500/50 transition-colors"
              required
            />
          </div>

          {/* API Key */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400 flex items-center gap-1">
              <Key className="w-3 h-3 text-slate-500" />
              API Key (stored securely client-side)
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={provider === 'custom' ? 'Optional for local LLMs' : 'Enter secret key...'}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500/50 transition-colors"
            />
          </div>

          {/* Model ID Selection */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400">Model Selector</label>
            <div className="flex gap-2">
              <select
                value={selectedProviderInfo?.models.includes(modelId) ? modelId : 'override'}
                onChange={(e) => {
                  if (e.target.value !== 'override') {
                    setModelId(e.target.value);
                  }
                }}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-teal-500/50 transition-colors cursor-pointer"
              >
                {selectedProviderInfo?.models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
                <option value="override">-- Manual String Override --</option>
              </select>
            </div>
          </div>

          {/* Model ID Text Override */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400">Manual Model ID Override</label>
            <input
              type="text"
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              placeholder="e.g. gpt-4o-mini"
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500/50 transition-colors"
              required
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-3 pt-2">
          {isEditing && (
            <button
              type="button"
              onClick={cancelEdit}
              className="px-4 py-1.5 border border-slate-800 bg-slate-950 text-slate-400 rounded-lg hover:text-slate-200 text-xs font-semibold transition-all hover:bg-slate-900"
            >
              Cancel Edit
            </button>
          )}
          <button
            type="submit"
            className="px-5 py-1.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 rounded-lg text-xs font-bold shadow-lg shadow-teal-500/10 hover:shadow-teal-500/20 active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
          >
            {isEditing ? (
              <>
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                Update Endpoint
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                Register Endpoint
              </>
            )}
          </button>
        </div>
      </form>

      {/* Configured Endpoints List */}
      <div className="flex-1 bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-2xl backdrop-blur-md overflow-hidden flex flex-col">
        <h3 className="text-sm font-semibold tracking-wider text-teal-400 uppercase mb-4 flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-400" />
          Registered Models Credentials
        </h3>
        
        {endpoints.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-slate-800/80 rounded-lg p-6 text-slate-500">
            <ShieldAlert className="w-8 h-8 mb-2 text-slate-600" />
            <p className="text-xs">No active models configured.</p>
            <p className="text-[10px] text-slate-600 mt-1">Configure credentials above to build the failover queue.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto border border-slate-800/80 rounded-lg bg-slate-950">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/40 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="px-4 py-3">Route Status</th>
                  <th className="px-4 py-3">Endpoint Name</th>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Model Tag</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {endpoints.map((ep) => (
                  <tr key={ep.id} className="hover:bg-slate-900/30 transition-colors">
                    {/* Status Checkbox */}
                    <td className="px-4 py-3 align-middle">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={ep.isEnabled}
                          onChange={(e) => updateEndpoint(ep.id, { isEnabled: e.target.checked })}
                          className="rounded border-slate-850 bg-slate-950 text-teal-500 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                        />
                        <span className={`w-2 h-2 rounded-full ${ep.isEnabled ? 'bg-emerald-400 shadow-sm shadow-emerald-400' : 'bg-slate-600'}`} />
                      </div>
                    </td>

                    {/* Name */}
                    <td className="px-4 py-3 font-medium text-slate-200 align-middle">
                      {ep.name}
                    </td>

                    {/* Provider Badge */}
                    <td className="px-4 py-3 align-middle">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                        ep.provider === 'openai' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        ep.provider === 'anthropic' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' :
                        ep.provider === 'google' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                        ep.provider === 'groq' ? 'bg-pink-500/10 text-pink-400 border border-pink-500/20' :
                        ep.provider === 'xai' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                        'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                      }`}>
                        {ep.provider}
                      </span>
                    </td>

                    {/* Model ID */}
                    <td className="px-4 py-3 font-mono text-slate-400 text-[11px] align-middle">
                      {ep.modelId}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-center align-middle">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEdit(ep)}
                          className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-teal-400 rounded-lg transition-colors cursor-pointer"
                          title="Edit Config"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteEndpoint(ep.id)}
                          className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                          title="Delete Endpoint"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
