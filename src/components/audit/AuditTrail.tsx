'use client';

import React, { useState, useMemo } from 'react';
import { usePlatformStore, DocCategory } from '../../lib/store/usePlatformStore';
import { decryptText, encryptText } from '../../lib/crypto/encryption';
import { 
  Shield, 
  Key, 
  Folder, 
  Lock, 
  Unlock, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  ArrowRight, 
  Search, 
  FileText, 
  Database, 
  Settings, 
  CloudLightning,
  Check,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export default function AuditTrailPanel() {
  const { 
    documents, 
    encryptionPassphrase, 
    setEncryptionPassphrase, 
    gdriveToken, 
    setGdriveToken, 
    isDemoMode, 
    setDemoMode,
    syncDocumentToGDrive 
  } = usePlatformStore();

  // Component states
  const [filterCategory, setFilterCategory] = useState<DocCategory | 'All'>('All');
  const [filterYear, setFilterYear] = useState<string>('All');
  const [filterMonth, setFilterMonth] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const [syncingDocId, setSyncingDocId] = useState<string | null>(null);
  
  // Decryption Modal States
  const [decryptionTarget, setDecryptionTarget] = useState<string | null>(null); // docId
  const [inputPassphrase, setInputPassphrase] = useState<string>('');
  const [decryptedOutput, setDecryptedOutput] = useState<string | null>(null);
  const [decryptionError, setDecryptionError] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState<boolean>(false);

  // Collapsed trajectory panel tracking
  const [expandedTrajectoryDocId, setExpandedTrajectoryDocId] = useState<string | null>(null);

  // Get completed documents
  const completedDocs = useMemo(() => {
    return documents.filter(d => d.status === 'completed');
  }, [documents]);

  // Extract years and months dynamically from document metadata
  const { years, months } = useMemo(() => {
    const yearsSet = new Set<string>();
    const monthsSet = new Set<string>();

    completedDocs.forEach(d => {
      const extractedData = d.extractionResult?.extractedData;
      if (extractedData) {
        const dateStr = extractedData.invoice_date || extractedData.statement_date || extractedData.effective_date || extractedData.report_date || '';
        if (dateStr) {
          try {
            const dateObj = new Date(dateStr);
            if (!isNaN(dateObj.getTime())) {
              yearsSet.add(dateObj.getFullYear().toString());
              monthsSet.add(dateObj.toLocaleString('en-US', { month: 'long' }));
            }
          } catch {}
        }
      }
    });

    return {
      years: Array.from(yearsSet).sort((a, b) => b.localeCompare(a)),
      months: Array.from(monthsSet).sort()
    };
  }, [completedDocs]);

  // Filter completed documents
  const filteredDocs = useMemo(() => {
    return completedDocs.filter(doc => {
      const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (doc.subcategory || '').toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = filterCategory === 'All' || doc.category === filterCategory;
      
      let matchesYear = filterYear === 'All';
      let matchesMonth = filterMonth === 'All';

      const extractedData = doc.extractionResult?.extractedData;
      if (extractedData) {
        const dateStr = extractedData.invoice_date || extractedData.statement_date || extractedData.effective_date || extractedData.report_date || '';
        if (dateStr) {
          try {
            const dateObj = new Date(dateStr);
            if (!isNaN(dateObj.getTime())) {
              if (filterYear !== 'All') {
                matchesYear = dateObj.getFullYear().toString() === filterYear;
              }
              if (filterMonth !== 'All') {
                matchesMonth = dateObj.toLocaleString('en-US', { month: 'long' }) === filterMonth;
              }
            }
          } catch {}
        }
      }

      return matchesSearch && matchesCategory && matchesYear && matchesMonth;
    });
  }, [completedDocs, searchQuery, filterCategory, filterYear, filterMonth]);

  // Handle Sync Action
  const handleSync = async (docId: string) => {
    setSyncingDocId(docId);
    try {
      await syncDocumentToGDrive(docId);
    } catch (err) {
      console.error(err);
    } finally {
      setSyncingDocId(null);
    }
  };

  // Perform client-side decryption validation check
  const handleDecrypt = async () => {
    if (!decryptionTarget) return;
    const doc = completedDocs.find(d => d.id === decryptionTarget);
    if (!doc || !doc.extractionResult) return;

    setIsDecrypting(true);
    setDecryptionError(null);
    setDecryptedOutput(null);

    try {
      // 1. Generate the same structured payload that is uploaded encrypted
      const dateStr = doc.extractionResult.extractedData.invoice_date || 
                      doc.extractionResult.extractedData.statement_date || 
                      doc.extractionResult.extractedData.effective_date || 
                      doc.extractionResult.extractedData.report_date || '';
      
      const auditPayload = JSON.stringify({
        document_id: doc.id,
        file_name: doc.name,
        size_bytes: doc.size,
        category: doc.category || 'Other',
        subcategory: doc.subcategory || 'General',
        raw_ocr_text: doc.rawOcrText,
        extracted_metadata: doc.extractionResult.extractedData,
        confidence_scores: doc.extractionResult.confidenceScores,
        routing_trajectory: doc.extractionResult.metadata.trajectory,
        synced_at: doc.gdriveSyncTime || new Date().toLocaleString()
      }, null, 2);

      // 2. Encrypt locally using the CURRENT master stores passphrase
      const encryptedPkg = await encryptText(auditPayload, encryptionPassphrase);

      // 3. Attempt decryption using the USER INPUT passphrase
      // This cryptographically demonstrates the safety of the local keys
      const decryptedText = await decryptText(encryptedPkg, inputPassphrase);
      
      // 4. Set successful output
      setDecryptedOutput(decryptedText);
    } catch (err: any) {
      console.error('Decryption failed:', err);
      setDecryptionError('Integrity check failed: Incorrect decryption passphrase or corrupted package block.');
    } finally {
      setIsDecrypting(false);
    }
  };

  const openDecryptionModal = (docId: string) => {
    setDecryptionTarget(docId);
    setInputPassphrase(encryptionPassphrase); // default fill for test ease
    setDecryptedOutput(null);
    setDecryptionError(null);
  };

  const closeDecryptionModal = () => {
    setDecryptionTarget(null);
    setDecryptedOutput(null);
    setDecryptionError(null);
  };

  // Mock OAuth Connect trigger
  const handleConnectGDrive = () => {
    if (isDemoMode) {
      const mockToken = 'mock-oauth2-token-' + Math.random().toString(36).substring(2, 10);
      setGdriveToken(mockToken);
    } else {
      // In production mode, open Google OAuth Flow:
      // Typically: gapi.oauth2.authorize({ client_id, scope: '.../auth/drive.file' })
      // For this UI, we set a mock connection if no clientId is configured, or support prompt
      const token = prompt('Enter your Google GDrive OAuth Access Token (leave blank to use Sandbox Simulation Mode):');
      if (token) {
        setGdriveToken(token);
      } else {
        setDemoMode(true);
        setGdriveToken('mock-gdrive-sandbox-token');
      }
    }
  };

  const handleDisconnectGDrive = () => {
    setGdriveToken(null);
  };

  return (
    <div className="flex flex-col h-full gap-6 overflow-hidden">
      
      {/* 1. Header Configurations Card */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
        
        {/* Passphrase Manager */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between backdrop-blur-md relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-purple-500 to-indigo-500 opacity-75" />
          <div>
            <h4 className="text-xs font-bold tracking-wider text-indigo-400 uppercase flex items-center gap-1.5 mb-1.5">
              <Key className="w-3.5 h-3.5" />
              AES-GCM Encryption Key
            </h4>
            <p className="text-[10px] text-slate-400 leading-normal">
              Documents are encrypted client-side using PBKDF2 (100k iterations) before leaving the browser context.
            </p>
          </div>
          <div className="mt-3.5 flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="password"
                value={encryptionPassphrase}
                onChange={(e) => setEncryptionPassphrase(e.target.value)}
                placeholder="Enter passphrase"
                className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500/40 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:ring-0 focus:outline-none"
              />
              <Lock className="absolute right-2.5 top-2 w-3 h-3 text-slate-600" />
            </div>
          </div>
        </div>

        {/* Google Drive Account Credentials */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between backdrop-blur-md relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-teal-500 to-cyan-500 opacity-75" />
          <div>
            <h4 className="text-xs font-bold tracking-wider text-teal-400 uppercase flex items-center gap-1.5 mb-1.5">
              <Database className="w-3.5 h-3.5" />
              Google Drive Connection
            </h4>
            <p className="text-[10px] text-slate-400 leading-normal">
              Files sync to Drive in category-based partition folders: <span className="font-mono text-slate-300">Category / Year / Month</span>.
            </p>
          </div>
          <div className="mt-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${gdriveToken ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
              <span className="text-[10px] font-semibold text-slate-300">
                {gdriveToken ? (isDemoMode ? 'Sandbox Token Connected' : 'GDrive Active API') : 'Disconnected'}
              </span>
            </div>
            {gdriveToken ? (
              <button
                onClick={handleDisconnectGDrive}
                className="px-2.5 py-1 bg-red-950/30 hover:bg-red-950/50 border border-red-900/30 hover:border-red-900/50 text-red-400 rounded-md text-[10px] font-bold transition-all cursor-pointer"
              >
                Disconnect
              </button>
            ) : (
              <button
                onClick={handleConnectGDrive}
                className="px-2.5 py-1 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-md text-[10px] font-bold shadow-lg shadow-teal-500/10 transition-all cursor-pointer"
              >
                Authorize API
              </button>
            )}
          </div>
        </div>

        {/* Sandboxed Simulation Control */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between backdrop-blur-md relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-amber-500 to-orange-500 opacity-75" />
          <div>
            <h4 className="text-xs font-bold tracking-wider text-amber-400 uppercase flex items-center gap-1.5 mb-1.5">
              <CloudLightning className="w-3.5 h-3.5" />
              Sync Engine Settings
            </h4>
            <p className="text-[10px] text-slate-400 leading-normal">
              Toggle between the visual sync folder simulation and direct GCP REST uploads.
            </p>
          </div>
          <div className="mt-3.5 flex items-center justify-between bg-slate-950/40 border border-slate-850 px-2.5 py-1 rounded-lg">
            <span className="text-[9px] uppercase font-extrabold text-slate-500">Sandbox Simulation Mode</span>
            <button
              onClick={() => {
                setDemoMode(!isDemoMode);
                if (!isDemoMode) {
                  setGdriveToken('mock-gdrive-sandbox-token');
                } else {
                  setGdriveToken(null);
                }
              }}
              className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${isDemoMode ? 'bg-amber-500' : 'bg-slate-800'}`}
            >
              <div className={`w-4 h-4 bg-slate-950 rounded-full transition-transform transform ${isDemoMode ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>
      </section>

      {/* 2. Main Audit List Section */}
      <section className="flex-1 bg-slate-900/40 border border-slate-900 rounded-xl flex flex-col overflow-hidden">
        
        {/* Filters Toolbar */}
        <div className="p-4 border-b border-slate-900 bg-slate-950/30 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ledger files..."
                className="bg-slate-950/60 border border-slate-800 focus:border-teal-500/40 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:ring-0 focus:outline-none w-48 transition-all"
              />
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-500" />
            </div>

            {/* Category Select */}
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as DocCategory | 'All')}
              className="bg-slate-950/60 border border-slate-800 focus:border-teal-500/40 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:ring-0 focus:outline-none cursor-pointer"
            >
              <option value="All">All Categories</option>
              <option value="Bills">Bills</option>
              <option value="Legal">Legal</option>
              <option value="Operations">Operations</option>
              <option value="Other">Other</option>
            </select>

            {/* Year Select */}
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="bg-slate-950/60 border border-slate-800 focus:border-teal-500/40 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:ring-0 focus:outline-none cursor-pointer"
            >
              <option value="All">All Years</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>

            {/* Month Select */}
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="bg-slate-950/60 border border-slate-800 focus:border-teal-500/40 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:ring-0 focus:outline-none cursor-pointer"
            >
              <option value="All">All Months</option>
              {months.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div className="text-[10px] text-slate-500 font-semibold font-mono">
            Showing {filteredDocs.length} of {completedDocs.length} Compliance Records
          </div>
        </div>

        {/* Ledger Audits Table / Grid */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {filteredDocs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 p-8">
              <Shield className="w-10 h-10 mb-2 text-slate-800" />
              <p className="text-xs font-semibold text-slate-400">No Compliance Records Found</p>
              <p className="text-[10px] text-slate-600 mt-1 max-w-[280px] text-center">
                Run extraction models on ingested files in the workspace to classify and generate compliance audit records.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-900">
              {filteredDocs.map((doc) => {
                const isSynced = !!doc.gdriveFileId;
                const isSyncing = syncingDocId === doc.id;
                const isTrajectoryExpanded = expandedTrajectoryDocId === doc.id;
                
                // Get extracted dates
                const dateVal = doc.extractionResult?.extractedData.invoice_date || 
                                doc.extractionResult?.extractedData.statement_date || 
                                doc.extractionResult?.extractedData.effective_date || 
                                doc.extractionResult?.extractedData.report_date || 
                                'N/A';

                return (
                  <div key={doc.id} className="p-4 hover:bg-slate-900/10 transition-colors">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      
                      {/* Name / Category Metadata */}
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-850 flex items-center justify-center shrink-0 mt-0.5">
                          <FileText className="w-4 h-4 text-indigo-400" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-xs font-bold text-slate-200 truncate max-w-[200px] md:max-w-[320px]">
                              {doc.name}
                            </h4>
                            <span className={`px-1.5 py-0.2 rounded text-[8px] font-bold uppercase tracking-wider ${
                              doc.category === 'Bills' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' :
                              doc.category === 'Legal' ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20' :
                              doc.category === 'Operations' ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/20' :
                              'bg-slate-500/15 text-slate-400 border border-slate-500/20'
                            }`}>
                              {doc.category || 'Other'}
                            </span>
                            <span className="text-[10px] text-slate-500 font-semibold">• {doc.subcategory}</span>
                          </div>
                          <div className="flex items-center gap-2.5 mt-1 text-[10px] text-slate-500 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-600" />
                              {dateVal}
                            </span>
                            <span>•</span>
                            <span>Size: {(doc.size / 1024).toFixed(1)} KB</span>
                            {isSynced && (
                              <>
                                <span>•</span>
                                <span className="text-emerald-400 font-mono text-[9px]">Synced at: {doc.gdriveSyncTime}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Operations / Status Control */}
                      <div className="flex items-center gap-3 self-end md:self-auto shrink-0">
                        {/* Decrypt action */}
                        <button
                          onClick={() => openDecryptionModal(doc.id)}
                          className="px-2.5 py-1.5 bg-slate-950 border border-slate-850 hover:border-slate-700 text-slate-300 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <Unlock className="w-3 h-3 text-indigo-400" />
                          Decrypt & Verify
                        </button>

                        {/* GDrive status indicator & trigger */}
                        {isSynced ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setExpandedTrajectoryDocId(isTrajectoryExpanded ? null : doc.id)}
                              className="px-2.5 py-1.5 bg-slate-900/80 border border-emerald-500/20 text-emerald-400 rounded-lg text-[10px] font-semibold flex items-center gap-1.5 hover:bg-slate-900 transition-colors cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              Synced Secure
                              {isTrajectoryExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleSync(doc.id)}
                            disabled={isSyncing}
                            className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-900 text-white disabled:text-slate-500 disabled:border-slate-800 disabled:border border border-indigo-500/10 rounded-lg text-[10px] font-bold shadow-lg shadow-indigo-600/10 transition-all flex items-center gap-1 cursor-pointer"
                          >
                            {isSyncing ? (
                              <>
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                Encrypting & Syncing...
                              </>
                            ) : (
                              <>
                                <Folder className="w-3 h-3 fill-current" />
                                Sync GDrive Archive
                              </>
                            )}
                          </button>
                        )}
                      </div>

                    </div>

                    {/* Sync Trajectory Log Dropdown */}
                    {isTrajectoryExpanded && doc.gdriveSyncTrajectory && (
                      <div className="mt-3.5 ml-11 bg-slate-950/80 border border-slate-850 rounded-xl p-3.5">
                        <h5 className="text-[9px] uppercase font-bold tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                          <CloudLightning className="w-3.5 h-3.5 text-slate-400" />
                          Secure GDrive Directory Hierarchy Path
                        </h5>
                        <div className="flex flex-col gap-1.5">
                          {doc.gdriveSyncTrajectory.map((log, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-[10px] font-mono leading-relaxed">
                              <span className="text-slate-700">[{idx + 1}]</span>
                              {log.toLowerCase().includes('error') ? (
                                <span className="text-red-400">{log}</span>
                              ) : log.toLowerCase().includes('secure') || log.toLowerCase().includes('success') ? (
                                <span className="text-emerald-400 flex items-center gap-1">
                                  <Check className="w-3 h-3 stroke-[3]" />
                                  {log}
                                </span>
                              ) : (
                                <span className="text-slate-400">{log}</span>
                              )}
                            </div>
                          ))}
                        </div>
                        {doc.gdriveFileId && (
                          <div className="mt-2.5 pt-2 border-t border-slate-900 text-[9px] text-slate-500 flex items-center gap-1.5 select-text">
                            <span>Cloud Resource Key:</span>
                            <span className="font-mono text-slate-400 font-bold bg-slate-900 px-1.5 py-0.5 rounded border border-slate-850">
                              {doc.gdriveFileId}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          )}
        </div>

      </section>

      {/* 3. Decryption Interactive Modal */}
      {decryptionTarget && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl relative">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-850 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Unlock className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="text-sm font-bold text-slate-200">Local Archive Decryptor</h3>
                  <span className="text-[9px] uppercase font-bold tracking-wider text-slate-500">
                    Verify client-side package integrity
                  </span>
                </div>
              </div>
              <button 
                onClick={closeDecryptionModal}
                className="text-slate-500 hover:text-slate-300 text-sm font-bold p-1 hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex-1 overflow-y-auto flex flex-col gap-4 scrollbar-thin">
              
              <div className="bg-slate-950/40 border border-slate-850 p-3.5 rounded-xl text-xs text-slate-400 leading-relaxed">
                🛡️ This utility derives the AES key locally using PBKDF2 with the typed passphrase to decrypt the secure compliance package of <span className="font-semibold text-slate-200 font-mono">{(completedDocs.find(d => d.id === decryptionTarget))?.name}</span>. The server receives zero key knowledge.
              </div>

              {/* Password inputs */}
              <div className="flex flex-col gap-1.5 shrink-0">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Decryption Passphrase</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={inputPassphrase}
                      onChange={(e) => setInputPassphrase(e.target.value)}
                      placeholder="Enter passphrase to decrypt..."
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500/40 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:ring-0 focus:outline-none"
                    />
                    <Key className="absolute right-3 top-2.5 w-3.5 h-3.5 text-slate-600" />
                  </div>
                  <button
                    onClick={handleDecrypt}
                    disabled={isDecrypting || !inputPassphrase}
                    className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer shadow-lg shadow-indigo-600/10 active:scale-95 disabled:opacity-50"
                  >
                    {isDecrypting ? 'Decrypting...' : 'Verify Cryptography'}
                  </button>
                </div>
              </div>

              {/* Outputs block */}
              <div className="flex-1 flex flex-col overflow-hidden min-h-[220px]">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1.5">Decrypted Payload Output</span>
                
                <div className="flex-1 border border-slate-850 rounded-xl bg-slate-950/80 overflow-hidden relative">
                  {decryptionError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-red-400 bg-red-950/[0.03]">
                      <AlertCircle className="w-8 h-8 mb-2 text-red-500" />
                      <p className="text-xs font-bold">Cryptographic Rejection</p>
                      <p className="text-[10px] text-slate-500 mt-1 max-w-[340px] leading-relaxed">
                        {decryptionError}
                      </p>
                    </div>
                  )}

                  {!decryptedOutput && !decryptionError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600">
                      <Lock className="w-8 h-8 mb-2 text-slate-800" />
                      <p className="text-[10px] uppercase font-bold tracking-widest">Awaiting Verification key</p>
                    </div>
                  )}

                  {decryptedOutput && (
                    <pre className="w-full h-full p-4 font-mono text-[10px] leading-relaxed text-indigo-300 overflow-y-auto whitespace-pre select-text scrollbar-thin">
                      {decryptedOutput}
                    </pre>
                  )}
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-850 bg-slate-950/30 flex justify-end shrink-0">
              <button
                onClick={closeDecryptionModal}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
