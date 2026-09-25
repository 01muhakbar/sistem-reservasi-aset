'use client';
import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';


pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export default function PDFViewer({ url }: { url: string }) {
  const [numPages, setNumPages] = useState<number>(1);
  const [pageNumber, setPageNumber] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem(`pdf_page_${url}`);
      return saved ? parseInt(saved, 10) : 1;
    }
    return 1;
  });
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const fetchedUrlRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (fetchedUrlRef.current === url) return;
    
    async function loadPdf() {
      fetchedUrlRef.current = url;
      try {
        console.log('Attempting to fetch PDF from:', url);
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
        }
        const buffer = await response.arrayBuffer();
        console.log('Downloaded PDF Buffer size:', buffer.byteLength);
        if (buffer.byteLength === 0) {
          throw new Error('File PDF kosong (0 bytes). URL mungkin salah atau Next.js proxy gagal mengalirkan data.');
        }
        setPdfData(buffer);
      } catch (err: any) {
        console.error('Fetch PDF Error:', err);
        setFetchError(err.message || 'Failed to fetch PDF');
      }
    }
    loadPdf();
  }, [url]);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(`pdf_page_${url}`, pageNumber.toString());
    }
  }, [pageNumber, url]);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    // Remove the setPageNumber(1) here so it respects the saved state
  }

  if (fetchError) {
    return (
      <div className="flex-1 w-full overflow-y-auto bg-slate-900/50 flex flex-col items-center justify-center p-8 text-center text-red-400">
        <svg className="w-16 h-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p className="text-lg font-bold mb-2">Gagal Mengunduh Dokumen</p>
        <p className="text-sm font-mono bg-red-900/30 p-2 rounded">{fetchError}</p>
        <p className="text-sm mt-4 text-slate-400">Pastikan server backend Anda menyala (npm run dev) dan file tidak dihapus.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full overflow-y-auto bg-slate-900/50 flex flex-col items-center justify-start py-6">
      {pdfData ? (
        <Document
          file={pdfData}
          onLoadSuccess={onDocumentLoadSuccess}
        loading={
          <div className="flex items-center justify-center text-slate-400 p-8 h-64">
            <svg className="animate-spin -ml-1 mr-3 h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Memuat dokumen...
          </div>
        }
        error={
          <div className="flex flex-col items-center justify-center h-full text-red-400 p-8 text-center">
            <svg className="w-16 h-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p>Gagal memuat dokumen. PDF mungkin rusak atau tidak ditemukan.</p>
          </div>
        }
      >
        <Page 
          pageNumber={pageNumber} 
          renderTextLayer={false} 
          renderAnnotationLayer={false}
          className="shadow-xl"
          width={600}
        />
      </Document>
      ) : (
        <div className="flex items-center justify-center text-slate-400 p-8 h-64">
          <svg className="animate-spin -ml-1 mr-3 h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Mengunduh dokumen dari server...
        </div>
      )}
      
      {/* Pagination Controls */}
      {numPages > 1 && (
        <div className="flex items-center gap-4 mt-6 bg-slate-800 px-4 py-2 rounded-full border border-slate-700 shadow-lg">
          <button
            disabled={pageNumber <= 1}
            onClick={() => setPageNumber(prev => Math.max(prev - 1, 1))}
            className="p-1 rounded-full hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-medium text-slate-300">
            Halaman {pageNumber} dari {numPages}
          </span>
          <button
            disabled={pageNumber >= numPages}
            onClick={() => setPageNumber(prev => Math.min(prev + 1, numPages))}
            className="p-1 rounded-full hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
