'use client';

import React, { useRef, useState } from 'react';
import { usePlatformStore } from '../../lib/store/usePlatformStore';
import { UploadCloud, FileText, CheckCircle2, Loader2, Edit3, Save, FileJson, AlertCircle, FileSpreadsheet } from 'lucide-react';
import { exportBillingToExcel } from '../../lib/excel/billingExporter';

// CDN script loading utility for PDF.js
const loadPdfjsFromCDN = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Browser window not available'));
      return;
    }
    
    if ((window as any).pdfjsLib) {
      resolve((window as any).pdfjsLib);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.async = true;
    script.onload = () => {
      const pdfjsLib = (window as any).pdfjsLib;
      if (pdfjsLib) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(pdfjsLib);
      } else {
        reject(new Error('Failed to bind pdfjsLib to window.'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load PDF.js CDN script.'));
    document.head.appendChild(script);
  });
};

// CDN script loading utility for Tesseract.js (Local Browser OCR)
const loadTesseractFromCDN = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Browser window not available'));
      return;
    }
    
    if ((window as any).Tesseract) {
      resolve((window as any).Tesseract);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/4.1.1/tesseract.min.js';
    script.async = true;
    script.onload = () => {
      const Tesseract = (window as any).Tesseract;
      if (Tesseract) {
        resolve(Tesseract);
      } else {
        reject(new Error('Failed to bind Tesseract to window.'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load Tesseract.js CDN script.'));
    document.head.appendChild(script);
  });
};

export default function DocumentDropzone() {
  const { 
    documents, 
    activeDocumentId, 
    setActiveDocumentId, 
    uploadDocuments, 
    updateDocumentOcr, 
    runConsolidation
  } = usePlatformStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isEditingOcr, setIsEditingOcr] = useState(false);
  const [editedText, setEditedText] = useState('');
  const [parsingStatus, setParsingStatus] = useState<string | null>(null);
  
  // Selection for consolidation
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [isConsolidating, setIsConsolidating] = useState(false);

  const activeDoc = documents.find((d) => d.id === activeDocumentId);

  // Core file processing logic (PDF, Images, Text)
  const processFiles = async (files: File[]) => {
    setParsingStatus('Loading document parser...');
    const processedData: Record<string, { text: string; images: string[] }> = {};
    let tesseractInstance: any = null;

    for (const file of files) {
      const lowerName = file.name.toLowerCase();
      
      // 1. PDF Parser (Supports selectable text AND scanned visual OCR via Tesseract.js)
      if (file.type === 'application/pdf' || lowerName.endsWith('.pdf')) {
        try {
          setParsingStatus(`Initializing PDF.js CDN Engine...`);
          const pdfjsLib = await loadPdfjsFromCDN();

          setParsingStatus(`Reading PDF binary stream: ${file.name}...`);
          const arrayBuffer = await file.arrayBuffer();
          const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
          const pdf = await loadingTask.promise;
          
          let fullText = '';
          const images: string[] = [];

          for (let i = 1; i <= pdf.numPages; i++) {
            setParsingStatus(`Parsing page ${i} / ${pdf.numPages}...`);
            const page = await pdf.getPage(i);
            
            // Extract text layer if present
            const textContent = await page.getTextContent();
            let pageText = textContent.items
              .map((item: any) => item.str)
              .join(' ');
            
            // Render to canvas (required for thumbnail tray and Tesseract OCR fallback)
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            let imgUrl = '';
            
            if (context) {
              canvas.height = viewport.height;
              canvas.width = viewport.width;
              
              await page.render({
                canvasContext: context,
                viewport: viewport,
                canvas: canvas
              }).promise;
              
              imgUrl = canvas.toDataURL('image/jpeg', 0.85);
              images.push(imgUrl);
            }

            // SCANNED PDF DETECTION: If text layer is empty (< 15 characters), execute Tesseract OCR!
            if (pageText.trim().length < 15) {
              setParsingStatus(`Scanned image detected. Loading Tesseract OCR on page ${i}...`);
              if (!tesseractInstance) {
                tesseractInstance = await loadTesseractFromCDN();
              }
              setParsingStatus(`Running browser OCR on page ${i}... (takes a few seconds)`);
              const ocrResult = await tesseractInstance.recognize(canvas, 'eng');
              pageText = ocrResult.data.text;
            }
            
            fullText += `--- PAGE ${i} ---\n${pageText}\n\n`;
          }
          
          processedData[file.name] = { text: fullText.trim(), images };
        } catch (err) {
          console.error(`Error processing PDF ${file.name} via CDN:`, err);
          processedData[file.name] = { text: '', images: [] };
        }
      } 
      // 2. Direct Image Ingest (PNG, JPG, JPEG)
      else if (file.type.startsWith('image/') || lowerName.endsWith('.png') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) {
        try {
          setParsingStatus(`Loading Tesseract OCR for image: ${file.name}...`);
          if (!tesseractInstance) {
            tesseractInstance = await loadTesseractFromCDN();
          }

          setParsingStatus(`Reading image binary: ${file.name}...`);
          // Read image as Data URL
          const imgUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.onerror = (e) => reject(new Error('Failed to read image file.'));
            reader.readAsDataURL(file);
          });

          setParsingStatus(`Executing browser OCR on image... (takes a few seconds)`);
          const ocrResult = await tesseractInstance.recognize(imgUrl, 'eng');
          const extractedText = ocrResult.data.text;

          processedData[file.name] = { text: extractedText.trim(), images: [imgUrl] };
        } catch (err) {
          console.error(`Error performing image OCR on ${file.name}:`, err);
          processedData[file.name] = { text: '', images: [] };
        }
      }
      // 3. Text Files Ingest (.txt, .md, .csv, .json)
      else if (file.type.startsWith('text/') || lowerName.endsWith('.txt') || lowerName.endsWith('.csv') || lowerName.endsWith('.json') || lowerName.endsWith('.md')) {
        try {
          setParsingStatus(`Reading text file: ${file.name}...`);
          const text = await file.text();
          processedData[file.name] = { text, images: [] };
        } catch (err) {
          console.error(`Error reading text file ${file.name}:`, err);
        }
      }
    }

    setParsingStatus('Uploading to workspace store...');
    await uploadDocuments(files, processedData);
    setParsingStatus(null);
  };

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesArray = Array.from(e.dataTransfer.files);
      await processFiles(filesArray);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      await processFiles(filesArray);
    }
  };

  // OCR editing
  const startEditOcr = () => {
    if (activeDoc) {
      setEditedText(activeDoc.rawOcrText);
      setIsEditingOcr(true);
    }
  };

  const saveEditedOcr = () => {
    if (activeDoc) {
      updateDocumentOcr(activeDoc.id, editedText);
      setIsEditingOcr(false);
    }
  };

  // Consolidation toggle
  const handleConsolidationToggle = (id: string) => {
    setSelectedDocIds((prev) => 
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const executeConsolidation = async () => {
    if (selectedDocIds.length < 2) return;
    setIsConsolidating(true);
    await runConsolidation(selectedDocIds);
    setIsConsolidating(false);
    setSelectedDocIds([]);
  };

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Upload area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !parsingStatus && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ${
          isDragOver
            ? 'border-teal-500 bg-teal-500/5'
            : 'border-slate-800 bg-slate-900/20 hover:border-slate-700 hover:bg-slate-900/30'
        } ${parsingStatus ? 'pointer-events-none opacity-60' : ''}`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          multiple
          className="hidden"
          accept=".pdf,.txt,.docx,.png,.jpg,.jpeg,.csv,.json"
        />
        {parsingStatus ? (
          <div className="flex flex-col items-center py-2">
            <Loader2 className="w-8 h-8 mb-2 text-teal-400 animate-spin" />
            <p className="text-xs font-semibold text-slate-300">{parsingStatus}</p>
          </div>
        ) : (
          <>
            <UploadCloud className={`w-8 h-8 mb-2 transition-transform ${isDragOver ? 'scale-110 text-teal-400' : 'text-slate-500 group-hover:text-slate-400'}`} />
            <p className="text-xs font-semibold text-slate-300">Drag & Drop files here, or click to upload</p>
            <p className="text-[10px] text-slate-500 mt-1">PDFs, PNG, JPG, JPEG (Scanned pages undergo local Tesseract OCR)</p>
          </>
        )}
      </div>

      {/* Consolidation Workspace Control */}
      {documents.length >= 2 && (
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-3.5 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">Document Consolidation Panel</span>
            <div className="flex items-center gap-2">
              {/* Excel Export Button */}
              <button
                onClick={() => {
                  const docsToExport = selectedDocIds.length > 0
                    ? documents.filter(d => selectedDocIds.includes(d.id))
                    : documents;
                  exportBillingToExcel(docsToExport);
                }}
                className="px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-[10px] font-bold active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
                title="Export selected or all completed billing records to Excel split by month"
              >
                <FileSpreadsheet className="w-3 h-3" />
                Export Ledger (Excel)
              </button>

              {selectedDocIds.length >= 2 && (
                <button
                  onClick={executeConsolidation}
                  disabled={isConsolidating}
                  className="px-3 py-1 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 rounded-lg text-[10px] font-bold shadow-lg shadow-teal-500/10 active:scale-95 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  {isConsolidating ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Consolidating...
                    </>
                  ) : (
                    <>
                      <FileJson className="w-3 h-3" />
                      Consolidate {selectedDocIds.length} Selected
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
          <p className="text-[10px] text-slate-500">Select multiple items to consolidate. Use "Export Ledger" to download a multi-sheet Excel file grouped by month with accumulated spent sums.</p>
        </div>
      )}

      {/* Document tabs / List */}
      {documents.length > 0 && (
        <div className="flex-1 flex flex-col border border-slate-800 bg-slate-900/60 rounded-xl overflow-hidden shadow-2xl">
          {/* Tabs bar */}
          <div className="flex items-center gap-1.5 p-2 bg-slate-950/80 border-b border-slate-800 overflow-x-auto whitespace-nowrap scrollbar-thin">
            {documents.map((doc) => {
              const isActive = doc.id === activeDocumentId;
              const isSelected = selectedDocIds.includes(doc.id);
              const isProcessing = doc.status === 'pending' || doc.status === 'extracting';
              
              return (
                <div key={doc.id} className="flex items-center gap-1 shrink-0">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleConsolidationToggle(doc.id)}
                    className="rounded border-slate-800 bg-slate-950 text-teal-500 focus:ring-0 w-3 h-3 cursor-pointer ml-1"
                    title="Select for consolidation"
                  />
                  
                  <button
                    onClick={() => setActiveDocumentId(doc.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      isActive
                        ? 'bg-slate-900 border-teal-500/40 text-teal-400'
                        : 'bg-slate-950/40 border-slate-850 hover:border-slate-800 text-slate-400'
                    }`}
                  >
                    {isProcessing ? (
                      <Loader2 className="w-3 h-3 animate-spin text-teal-400" />
                    ) : (
                      <FileText className={`w-3 h-3 ${isActive ? 'text-teal-400' : 'text-slate-500'}`} />
                    )}
                    <span className="max-w-[120px] truncate">{doc.name}</span>
                  </button>
                </div>
              );
            })}
          </div>

          {/* OCR Content display */}
          <div className="flex-1 flex flex-col p-4 overflow-hidden bg-slate-950/20">
            {activeDoc ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-850 pb-2.5 mb-3 shrink-0">
                  <div>
                    <h4 className="text-xs font-semibold text-slate-200 truncate max-w-[200px]">{activeDoc.name}</h4>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Type: {activeDoc.type} • Size: {formatSize(activeDoc.size)} {activeDoc.pageImages && activeDoc.pageImages.length > 0 && `• Pages/Images: ${activeDoc.pageImages.length}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                      activeDoc.status === 'ocr_extracted' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                      activeDoc.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      activeDoc.status === 'extracting' ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' :
                      activeDoc.status === 'failed' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                      'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                    }`}>
                      {activeDoc.status.replace('_', ' ')}
                    </span>

                    {activeDoc.status !== 'pending' && (
                      isEditingOcr ? (
                        <button
                          onClick={saveEditedOcr}
                          className="px-2.5 py-1 bg-teal-500 text-slate-950 rounded-md text-[10px] font-bold flex items-center gap-1 hover:bg-teal-400 transition-colors cursor-pointer"
                        >
                          <Save className="w-3 h-3" />
                          Save OCR
                        </button>
                      ) : (
                        <button
                          onClick={startEditOcr}
                          className="px-2.5 py-1 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-md text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3 text-slate-400" />
                          Edit OCR Layer
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* OCR Text Area */}
                <div className="flex-1 overflow-hidden border border-slate-850 rounded-lg bg-slate-950/80">
                  {activeDoc.status === 'pending' ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 p-6">
                      <Loader2 className="w-7 h-7 mb-2 text-teal-400 animate-spin" />
                      <p className="text-xs">Processing document layout...</p>
                    </div>
                  ) : isEditingOcr ? (
                    <textarea
                      value={editedText}
                      onChange={(e) => setEditedText(e.target.value)}
                      className="w-full h-full p-4 font-mono text-[11px] leading-relaxed bg-transparent text-teal-300 focus:outline-none resize-none overflow-y-auto scrollbar-thin"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col overflow-hidden">
                      {/* Visual representations of extracted pages */}
                      {activeDoc.pageImages && activeDoc.pageImages.length > 0 && (
                        <div className="p-2 border-b border-slate-900 bg-slate-900/10 flex gap-2 overflow-x-auto shrink-0 scrollbar-thin">
                          {activeDoc.pageImages.map((img, idx) => (
                            <div key={idx} className="relative w-12 h-16 border border-slate-800 bg-slate-950 rounded shrink-0 overflow-hidden group">
                              <img src={img} alt={`Page ${idx + 1}`} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                              <span className="absolute bottom-0 left-0 w-full bg-slate-900/90 text-[8px] font-bold text-center text-slate-400 py-0.5">P{idx + 1}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <pre className="flex-1 w-full p-4 font-mono text-[11px] leading-relaxed text-slate-400 overflow-y-auto whitespace-pre-wrap select-text scrollbar-thin">
                        {activeDoc.rawOcrText || "[No text layer found in document. Run extraction to trigger visual LLM OCR.]"}
                      </pre>
                    </div>
                  )}
                </div>

                <div className="mt-2 text-[10px] text-slate-500 flex items-start gap-1">
                  <AlertCircle className="w-3.5 h-3.5 stroke-[2] shrink-0 mt-0.5 text-teal-400/70" />
                  <span>
                    💡 <span className="font-semibold text-slate-400">OCR Consistent Layer:</span> PDFs are processed page-by-page. For text-based files, the actual characters are extracted directly. Scanned PDF page images and raw images (.png, .jpg) undergo local browser Tesseract.js OCR.
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-6">
                <FileText className="w-10 h-10 mb-2 text-slate-700" />
                <p className="text-xs">Select an uploaded document to inspect the OCR layer.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
