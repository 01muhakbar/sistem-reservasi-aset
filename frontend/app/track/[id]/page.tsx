'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../contexts/AuthContext';

export default function TrackPage() {
  const { id } = useParams();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [trackResult, setTrackResult] = useState<any>(null);
  const [trackError, setTrackError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (id) {
      fetchTrackingInfo(id as string);
    }
  }, [id]);

  const fetchTrackingInfo = async (trackCode: string) => {
    setIsLoading(true);
    setTrackError('');
    try {
      const res = await fetch(`http://localhost:5000/api/bookings/track/${trackCode}`);
      const data = await res.json();
      
      if (res.ok) {
        setTrackResult(data.data);
      } else {
        setTrackError(data.error || 'Tiket tidak ditemukan.');
      }
    } catch (err) {
      setTrackError('Terjadi kesalahan jaringan.');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen pt-20 px-4 flex flex-col items-center">
      <div className="w-full max-w-2xl bg-slate-900/60 backdrop-blur-md p-6 sm:p-8 rounded-3xl border border-slate-700/50 shadow-2xl mt-12 relative">
        <div className="absolute top-0 right-1/4 w-32 h-32 bg-blue-500/10 blur-[80px] -z-10 rounded-full" />
        
        <div className="flex items-center justify-between mb-8 border-b border-slate-700/50 pb-4">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Status Pelacakan
          </h2>
          <Link href="/" className="text-sm font-medium text-slate-400 hover:text-white transition-colors flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Kembali
          </Link>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <span className="w-10 h-10 border-4 border-slate-700 border-t-blue-500 rounded-full animate-spin mb-4"></span>
            <p className="text-slate-400">Mencari data reservasi...</p>
          </div>
        ) : trackError ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Error 404</h3>
            <p className="text-slate-400 mb-6">{trackError}</p>
            <Link href="/" className="px-6 py-2 bg-slate-800 hover:bg-slate-700 rounded-full text-sm font-medium text-white transition-colors">
              Ke Beranda
            </Link>
          </div>
        ) : trackResult && (
          <div>
            <div className="flex flex-col items-center mb-8 text-center">
              <span className="text-sm text-slate-400 mb-1">Hasil Pelacakan untuk:</span>
              <span className="text-2xl font-mono font-bold text-blue-400">{trackResult.booking_code}</span>
              <span className="text-lg font-medium text-white mt-2">{trackResult.event_name}</span>
              <span className="text-sm text-slate-500 mt-1">Diajukan pada {new Date(trackResult.created_at).toLocaleDateString('id-ID')}</span>
            </div>

            <div className="relative mb-12 mt-4 w-full">
              <div className="flex justify-between relative z-10 w-full">
                {/* Step 1 */}
                <div className="flex flex-col items-center flex-1 relative">
                  {/* Connecting Line to next step */}
                  <div className="absolute top-6 left-[50%] w-full h-1 bg-slate-700 -z-10 rounded-r-full"></div>
                  <div className={`absolute top-6 left-[50%] h-1 bg-blue-500 -z-10 rounded-r-full transition-all duration-700`} style={{ width: '100%' }}></div>
                  
                  <div className="w-12 h-12 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-lg shadow-[0_0_15px_rgba(59,130,246,0.5)] mb-3 border-4 border-slate-900">1</div>
                  <span className="text-sm font-medium text-blue-400 text-center whitespace-nowrap">Diajukan</span>
                </div>

                {/* Step 2 */}
                <div className="flex flex-col items-center flex-1 relative">
                  {/* Connecting Line to next step */}
                  <div className="absolute top-6 left-[50%] w-full h-1 bg-slate-700 -z-10 rounded-r-full"></div>
                  <div className={`absolute top-6 left-[50%] h-1 bg-blue-500 -z-10 rounded-r-full transition-all duration-700`} style={{ width: trackResult.status === 'pending' ? '0%' : '100%' }}></div>
                  
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg mb-3 border-4 border-slate-900 transition-colors ${trackResult.status === 'pending' ? 'bg-slate-800 text-blue-400 border-blue-500/30' : 'bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]'}`}>2</div>
                  <span className={`text-sm font-medium text-center whitespace-nowrap ${trackResult.status === 'pending' ? 'text-blue-300' : 'text-blue-400'}`}>Verifikasi Kasubdit</span>
                </div>

                {/* Step 3 */}
                <div className="flex flex-col items-center flex-1 relative">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg mb-3 border-4 border-slate-900 transition-colors ${
                    trackResult.status === 'approved' ? 'bg-green-500 text-white shadow-[0_0_15px_rgba(34,197,94,0.5)] border-green-500/20' :
                    trackResult.status === 'rejected' ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)] border-red-500/20' :
                    trackResult.status === 'revoked' ? 'bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.5)] border-purple-500/20' :
                    'bg-slate-800 text-slate-500'
                  }`}>
                    {trackResult.status === 'approved' || trackResult.status === 'rejected' || trackResult.status === 'revoked' ? '3' : '?'}
                  </div>
                  <span className={`text-sm font-medium text-center whitespace-nowrap ${
                    trackResult.status === 'approved' ? 'text-green-400' :
                    trackResult.status === 'rejected' ? 'text-red-400' :
                    trackResult.status === 'revoked' ? 'text-purple-400' :
                    'text-slate-500'
                  }`}>
                    {trackResult.status === 'approved' ? 'Disetujui' : 
                     trackResult.status === 'rejected' ? 'Ditolak' : 
                     trackResult.status === 'revoked' ? 'Dicabut' : 'Keputusan'}
                  </span>
                </div>
              </div>
            </div>

            {/* Details Section */}
            {trackResult.admin_notes && (
              <div className={`p-4 rounded-xl text-sm mb-6 ${trackResult.status === 'rejected' ? 'bg-red-500/10 text-red-200 border border-red-500/20' : trackResult.status === 'revoked' ? 'bg-purple-500/10 text-purple-200 border border-purple-500/20' : 'bg-slate-800 text-slate-300'}`}>
                <strong className="block mb-1 font-semibold">{trackResult.status === 'rejected' ? 'Alasan Penolakan:' : trackResult.status === 'revoked' ? 'Alasan Pencabutan Izin:' : 'Catatan Admin:'}</strong>
                {trackResult.admin_notes}
              </div>
            )}
            
            {(trackResult.status === 'approved' || trackResult.status === 'revoked') && (
              <div className="flex justify-center mt-8">
                {trackResult.status === 'approved' && isAuthenticated ? (
                  <button 
                    onClick={async () => {
                      try {
                        const res = await fetch(`http://localhost:5000/api/bookings/${trackResult.id}/pdf`, {
                          credentials: 'include'
                        });
                        if (res.ok) {
                          const blob = await res.blob();
                          const url = window.URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `Surat_Izin_${trackResult.booking_code}.pdf`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          window.URL.revokeObjectURL(url);
                        } else {
                          alert('Gagal mengunduh dokumen. Sesi mungkin telah berakhir.');
                        }
                      } catch (err) {
                        alert('Terjadi kesalahan jaringan.');
                      }
                    }}
                    className="premium-gradient px-6 py-3 rounded-full text-white font-medium shadow-lg hover:shadow-blue-500/30 transition-all flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    Unduh Surat Izin
                  </button>
                ) : trackResult.status === 'revoked' ? (
                  <button 
                    onClick={() => router.push('/booking?reschedule_id=' + trackResult.id)}
                    className="bg-purple-600 hover:bg-purple-500 px-6 py-3 rounded-full text-white font-medium shadow-lg hover:shadow-purple-500/30 transition-all flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    Jadwalkan Ulang (Reschedule)
                  </button>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
