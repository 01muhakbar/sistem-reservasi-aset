'use client';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function UserDashboard() {
  const { user, token, isAuthenticated } = useAuth();
  const router = useRouter();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorNotes, setErrorNotes] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !['mahasiswa', 'fakultas', 'umum_komersial'].includes(user?.role || '')) {
      router.push('/login');
      return;
    }

    fetch('http://localhost:5000/api/bookings/my-bookings', {
      credentials: 'include'
    })
      .then(res => res.json())
      .then(data => {
        setBookings(data.data || []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [isAuthenticated, user, router, token]);

  const handleDownloadPDF = async (id: string) => {
    try {
      const res = await fetch(`http://localhost:5000/api/bookings/${id}/pdf`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Gagal mengunduh PDF');
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Surat_Izin_${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 1000);
    } catch (e) {
      alert('Terjadi kesalahan saat mengunduh PDF.');
    }
  };

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div></div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Ruang Kerja Saya</h1>
        <p className="text-slate-400">Kelola riwayat pengajuan dan unduh dokumen legalitas Anda.</p>
      </div>

      {errorNotes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="glass-card max-w-md w-full rounded-2xl p-6 relative">
            <h3 className="text-xl font-bold text-red-400 mb-4">Catatan Penolakan Kasubdit</h3>
            <div className="bg-slate-900/50 border border-slate-700 p-4 rounded-xl text-slate-300 text-sm mb-6">
              {errorNotes}
            </div>
            <button 
              onClick={() => setErrorNotes(null)}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-2 rounded-xl transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      <div className="glass-card rounded-2xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-800/50 border-b border-slate-700">
              <th className="p-4 font-semibold text-slate-300 rounded-tl-2xl">Unified ID</th>
              <th className="p-4 font-semibold text-slate-300">Kegiatan</th>
              <th className="p-4 font-semibold text-slate-300">Tanggal Pengajuan</th>
              <th className="p-4 font-semibold text-slate-300">Status</th>
              <th className="p-4 font-semibold text-slate-300 rounded-tr-2xl text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {bookings.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500">Belum ada riwayat pengajuan.</td>
              </tr>
            ) : bookings.map((b: any) => (
              <tr key={b.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="p-4">
                  <span className="font-mono text-xs text-blue-400 bg-blue-500/10 px-2 py-1 rounded">{b.booking_code}</span>
                </td>
                <td className="p-4 font-medium">{b.event_name}</td>
                <td className="p-4 text-sm text-slate-400">{new Date(b.created_at).toLocaleDateString('id-ID')}</td>
                <td className="p-4">
                  {b.status === 'pending' ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-500">Pending</span>
                  ) : b.status === 'approved' ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-500">Approved</span>
                  ) : b.status === 'rejected' ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-500">Rejected</span>
                  ) : b.status === 'revoked' ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-500/10 text-orange-500">Revoked (Force Majeure)</span>
                  ) : b.status === 'pending_reschedule' ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">🔄 Menunggu Persetujuan</span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-500/10 text-slate-500">{b.status}</span>
                  )}
                </td>
                <td className="p-4 text-center">
                  {b.status === 'approved' ? (
                    <button 
                      onClick={() => handleDownloadPDF(b.id)}
                      className="bg-green-500/10 hover:bg-green-500 hover:text-white text-green-500 border border-green-500/20 px-4 py-2 rounded-lg text-xs font-medium transition-all w-full flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Unduh PDF
                    </button>
                  ) : b.status === 'rejected' ? (
                    <button 
                      onClick={() => setErrorNotes(b.admin_notes || 'Ditolak oleh sistem.')}
                      className="bg-red-500/10 hover:bg-red-500 hover:text-white text-red-500 border border-red-500/20 px-4 py-2 rounded-lg text-xs font-medium transition-all w-full"
                    >
                      Baca Catatan Penolakan
                    </button>
                  ) : b.status === 'revoked' ? (
                    <button 
                      onClick={() => router.push(`/booking?reschedule_id=${b.id}`)}
                      className="bg-orange-500 hover:bg-orange-600 text-white border border-orange-500/20 px-4 py-2 rounded-lg text-xs font-bold transition-all w-full flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Pilih Jadwal Pengganti
                    </button>
                  ) : b.status === 'pending_reschedule' ? (
                    <span className="text-xs text-purple-400">Diprioritaskan</span>
                  ) : (
                    <span className="text-xs text-slate-500">Menunggu Verifikasi</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
