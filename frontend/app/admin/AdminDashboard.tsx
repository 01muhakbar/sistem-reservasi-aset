'use client';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import PDFViewer from './PDFViewer';
function QuickBlockForm() {
  const [formData, setFormData] = useState({ eventName: '', startDate: '', endDate: '', venueId: 'VENUE-01' });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg('');
    try {
      const res = await fetch('http://localhost:5000/api/schedules/quick-block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          event_name: formData.eventName,
          start_date: formData.startDate,
          end_date: formData.endDate,
          venue_id: formData.venueId
        })
      });
      const data = await res.json();
      if (res.ok) {
        setMsg('Berhasil mengunci tanggal institusi.');
        setFormData({ eventName: '', startDate: '', endDate: '', venueId: 'VENUE-01' });
      } else {
        setMsg(data.error || 'Terjadi kesalahan.');
      }
    } catch (err) {
      setMsg('Kesalahan jaringan.');
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {msg && <div className="p-3 bg-slate-800 text-white rounded-lg text-sm">{msg}</div>}
      <div>
        <label className="block text-sm text-slate-300 mb-1">Pilih Fasilitas</label>
        <select className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white" value={formData.venueId} onChange={e => setFormData({...formData, venueId: e.target.value})}>
          <option value="VENUE-01">Gedung Baruga A.P. Pettarani</option>
        </select>
      </div>
      <div>
        <label className="block text-sm text-slate-300 mb-1">Nama Kegiatan Institusi</label>
        <input required type="text" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white" placeholder="Misal: Wisuda Universitas" value={formData.eventName} onChange={e => setFormData({...formData, eventName: e.target.value})} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-slate-300 mb-1">Tanggal Mulai (00:00)</label>
          <input required type="date" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} />
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-1">Tanggal Selesai (23:59)</label>
          <input required type="date" min={formData.startDate} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white" value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} />
        </div>
      </div>
      <button type="submit" disabled={loading} className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl shadow-lg transition-colors font-medium">
        {loading ? 'Menyimpan...' : 'Kunci Jadwal (Bypass)'}
      </button>
    </form>
  );
}

export default function AdminDashboard() {
  const { user, token, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'kasubdit') {
      router.push('/login');
    }
  }, [isAuthenticated, user, router]);

  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewBooking, setReviewBooking] = useState<any | null>(null);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });
  
  // New States
  const [selectedBookingForVendor, setSelectedBookingForVendor] = useState<any | null>(null);
  const [rejectModalData, setRejectModalData] = useState<{ id: string, notes: string } | null>(null);
  const [revokeModalData, setRevokeModalData] = useState<{ id: string } | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [revokeDropdownOpen, setRevokeDropdownOpen] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'bookings' | 'kyc' | 'sop'>('bookings');
  const [sopText, setSopText] = useState('');
  const [savingSop, setSavingSop] = useState(false);
  const [pendingKycUsers, setPendingKycUsers] = useState<any[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownloadPDF = async (bookingId: string) => {
    setDownloadingId(bookingId);
    try {
      const res = await fetch(`http://localhost:5000/api/bookings/${bookingId}/pdf`, {
        credentials: 'include'
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Surat_Izin_${bookingId}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        showToast('Dokumen berhasil diunduh.', 'success');
      } else {
        showToast('Gagal memuat dokumen legalitas. Silakan coba beberapa saat lagi.', 'error');
      }
    } catch (e) {
      showToast('Terjadi kesalahan jaringan saat mengunduh PDF.', 'error');
    } finally {
      setDownloadingId(null);
    }
  };

  const fetchKycUsers = () => {
    fetch('http://localhost:5000/api/users/kyc/pending', { credentials: 'include' })
      .then(res => res.json())
      .then(data => setPendingKycUsers(data.data || []))
      .catch(err => console.error(err));
  };

  const fetchSop = () => {
    fetch('http://localhost:5000/api/settings/sop_text')
      .then(res => res.json())
      .then(data => {
        if (data.data?.value) setSopText(data.data.value);
      })
      .catch(err => console.error(err));
  };

  useEffect(() => {
    if (viewMode === 'kyc') fetchKycUsers();
    if (viewMode === 'sop') fetchSop();
  }, [viewMode]);

  const handleSaveSop = async () => {
    setSavingSop(true);
    try {
      const res = await fetch('http://localhost:5000/api/settings/sop_text', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: sopText }),
        credentials: 'include'
      });
      if (res.ok) {
        showToast('SOP berhasil diperbarui.');
      } else {
        showToast('Gagal memperbarui SOP.', 'error');
      }
    } catch (err) {
      showToast('Terjadi kesalahan jaringan.', 'error');
    }
    setSavingSop(false);
  };

  const handleVerifyKyc = async (id: string, status: 'VERIFIED' | 'REJECTED') => {
    try {
      const res = await fetch(`http://localhost:5000/api/users/kyc/${id}/verify`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
        credentials: 'include'
      });
      if (res.ok) {
        showToast(`Akun berhasil ${status === 'VERIFIED' ? 'diverifikasi' : 'ditolak'}.`);
        fetchKycUsers();
      } else {
        showToast('Gagal memverifikasi akun.', 'error');
      }
    } catch (e) {
      showToast('Terjadi kesalahan jaringan.', 'error');
    }
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 3000);
  };

  // Debounce Effect
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchBookings = () => {
    setLoading(true);
    const query = new URLSearchParams();
    if (debouncedSearch) query.append('search', debouncedSearch);
    if (activeTab !== 'all') query.append('status', activeTab);

    fetch(`http://localhost:5000/api/bookings?${query.toString()}`, {
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
  };

  useEffect(() => {
    fetchBookings();
  }, [debouncedSearch, activeTab]);

  const pendingCount = bookings.filter(b => b.status === 'pending').length;
  const approvedCount = bookings.filter(b => b.status === 'approved').length;

  const handleApprove = async (id: string) => {
    try {
      const seedRes = await fetch('http://localhost:5000/api/seed-data');
      const seedData = await seedRes.json();
      
      const res = await fetch(`http://localhost:5000/api/bookings/${id}/approve`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ kasubdit_id: user?.id })
      });
      if (res.ok) {
        showToast('Booking berhasil disetujui, jadwal telah diperbarui!');
        fetchBookings();
        setReviewBooking(null);
      }
    } catch (e) {
      console.error(e);
      showToast('Terjadi kesalahan saat memproses persetujuan.', 'error');
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectModalData) return;

    try {
      const res = await fetch(`http://localhost:5000/api/bookings/${rejectModalData.id}/reject`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ 
          kasubdit_id: user?.id,
          admin_notes: rejectModalData.notes
        })
      });

      if (res.ok) {
        showToast('Booking berhasil ditolak.', 'success');
        fetchBookings();
        setRejectModalData(null);
      }
    } catch (e) {
      console.error(e);
      showToast('Terjadi kesalahan saat menolak booking.', 'error');
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      const seedRes = await fetch('http://localhost:5000/api/seed-data');
      const seedData = await seedRes.json();
      
      const res = await fetch(`http://localhost:5000/api/bookings/${id}/revoke`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ kasubdit_id: user?.id, reason: revokeReason })
      });

      if (res.ok) {
        showToast('Jadwal berhasil dicabut paksa (Force Majeure).', 'success');
        fetchBookings();
        setRevokeDropdownOpen(null);
        setRevokeReason('');
      } else {
        const errData = await res.json();
        showToast(errData.error || 'Gagal mencabut persetujuan.', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Terjadi kesalahan saat mencabut booking.', 'error');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Dashboard Kasubdit</h1>
          <p className="text-slate-400">Pusat verifikasi dan persetujuan jadwal fasilitas.</p>
        </div>
        <div className="flex gap-4">
          <div className="glass-card px-4 py-2 rounded-xl border border-slate-700 text-center">
            <span className="block text-2xl font-bold text-yellow-400">{pendingCount}</span>
            <span className="text-xs text-slate-400">Menunggu</span>
          </div>
          <div className="glass-card px-4 py-2 rounded-xl border border-slate-700 text-center">
            <span className="block text-2xl font-bold text-green-400">{approvedCount}</span>
            <span className="text-xs text-slate-400">Disetujui</span>
          </div>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="flex gap-4 mb-6">
        <button 
          onClick={() => setViewMode('bookings')}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${viewMode === 'bookings' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
        >
          Persetujuan Jadwal
        </button>
        <button 
          onClick={() => setViewMode('kyc')}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${viewMode === 'kyc' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
        >
          Verifikasi Akun Eksternal {pendingKycUsers.length > 0 && <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{pendingKycUsers.length}</span>}
        </button>
        <button 
          onClick={() => setViewMode('sop')}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${viewMode === 'sop' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
        >
          Pengaturan SOP
        </button>
        <button 
          onClick={() => setViewMode('quickblock')}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${viewMode === 'quickblock' ? 'bg-red-600 text-white shadow-lg shadow-red-600/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
        >
          Kunci Tanggal Institusi
        </button>
      </div>

      {viewMode === 'sop' ? (
        <div className="glass-card rounded-2xl p-6">
          <h2 className="text-xl font-bold text-white mb-2">Kelola SOP & Tata Tertib</h2>
          <p className="text-slate-400 mb-6 text-sm">Gunakan format <a href="https://www.markdownguide.org/basic-syntax/" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">Markdown</a> untuk menebalkan teks atau membuat daftar. Perubahan akan langsung terlihat di halaman Pengajuan Reservasi.</p>
          
          <textarea
            value={sopText}
            onChange={(e) => setSopText(e.target.value)}
            className="w-full h-96 bg-slate-900 border border-slate-700 rounded-xl p-4 text-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent custom-scrollbar mb-4"
            placeholder="Ketik SOP di sini..."
          />
          
          <div className="flex justify-end">
            <button
              onClick={handleSaveSop}
              disabled={savingSop}
              className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl font-medium shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
            >
              {savingSop ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </div>
      ) : viewMode === 'kyc' ? (
        <div className="glass-card rounded-2xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-800/50 border-b border-slate-700">
                <th className="p-4 font-semibold text-slate-300 rounded-tl-2xl">Nama Instansi / EO</th>
                <th className="p-4 font-semibold text-slate-300">Email</th>
                <th className="p-4 font-semibold text-slate-300">Dokumen Legalitas (KTP/NIB)</th>
                <th className="p-4 font-semibold text-slate-300 rounded-tr-2xl">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {pendingKycUsers.length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center text-slate-500">Tidak ada akun eksternal yang menunggu verifikasi.</td></tr>
              ) : pendingKycUsers.map(u => (
                <tr key={u.id}>
                  <td className="p-4 font-semibold">{u.name}</td>
                  <td className="p-4 text-slate-400">{u.email}</td>
                  <td className="p-4">
                    <a href={u.identity_doc_url} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline inline-flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      Lihat Dokumen
                    </a>
                  </td>
                  <td className="p-4 flex gap-2">
                    <button onClick={() => handleVerifyKyc(u.id, 'VERIFIED')} className="bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-all">Verifikasi</button>
                    <button onClick={() => handleVerifyKyc(u.id, 'REJECTED')} className="bg-red-500/10 hover:bg-red-500 hover:text-white text-red-500 border border-red-500/20 px-3 py-1.5 rounded-lg text-sm font-medium transition-all">Tolak</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : viewMode === 'quickblock' ? (
        <div className="glass-card rounded-2xl p-6">
          <h2 className="text-xl font-bold text-white mb-2">Kunci Tanggal Institusi (Quick Block)</h2>
          <p className="text-slate-400 mb-6 text-sm">Fitur ini digunakan oleh Rektorat (Kasubdit) untuk langsung mengunci kalender tanpa proses approval bertingkat (Bypass).</p>
          <QuickBlockForm />
        </div>
      ) : (
      <>
      {/* Tabs & Search */}
      <div className="flex flex-col md:flex-row justify-between gap-4 mb-6">
        <div className="flex gap-2 bg-slate-900/50 p-1 rounded-xl border border-slate-700/50 overflow-x-auto">
          {['all', 'pending', 'approved', 'rejected', 'revoked'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === tab ? 'bg-blue-500/20 text-blue-400 shadow-sm' : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800'}`}
            >
              {tab === 'all' ? 'Semua' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
        <div className="relative">
          <input 
            type="text"
            placeholder="Cari kegiatan atau ID..."
            className="w-full md:w-64 bg-slate-900/50 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <svg className="w-4 h-4 absolute left-3.5 top-2.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      <div className="glass-card rounded-2xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-800/50 border-b border-slate-700">
              <th className="text-left p-4 font-semibold text-slate-300 rounded-tl-2xl">Unified ID</th>
              <th className="text-left p-4 font-semibold text-slate-300">Kegiatan</th>
              <th className="text-left p-4 font-semibold text-slate-300">Dokumen</th>
              <th className="text-left p-4 font-semibold text-slate-300">Detail Jadwal Bundling</th>
              <th className="text-left p-4 font-semibold text-slate-300">Status</th>
              <th className="text-left p-4 font-semibold text-slate-300 rounded-tr-2xl">Aksi (1-Click)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {bookings.map((booking) => {
              const mainSchedule = booking.schedules?.find((s: any) => s.usage_type === 'main_event_fullday');
              const rehearsalSchedule = booking.schedules?.find((s: any) => s.usage_type === 'gladi_timeslot');
              
              return (
              <tr key={booking.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="p-4">
                  <span className="font-mono text-sm text-blue-400 bg-blue-400/10 px-2 py-1 rounded">
                    {booking.booking_code}
                  </span>
                </td>
                <td className="p-4">
                  <p className="font-semibold flex items-center gap-2">
                    {booking.event_name}
                    {booking.user?.reputation_flag === 'warning' && (
                      <span className="group relative inline-flex items-center justify-center bg-yellow-500/10 text-yellow-500 border border-yellow-500/30 rounded-full px-2 py-0.5 text-xs font-bold cursor-help" title="Rekam Jejak Buruk: Pernah Meninggalkan Fasilitas Kotor">
                        ⚠️ Warning
                      </span>
                    )}
                    {booking.user?.reputation_flag === 'blacklisted' && (
                      <span className="group relative inline-flex items-center justify-center bg-red-500/10 text-red-500 border border-red-500/30 rounded-full px-2 py-0.5 text-xs font-bold cursor-help" title="Rekam Jejak Buruk: Pernah Merusak Fasilitas">
                        🚨 Blacklisted
                      </span>
                    )}
                  </p>
                  {booking.vendors && booking.vendors.length > 0 && (
                    <span className="inline-block mt-1 bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full border border-yellow-200 shadow-sm">
                      🚚 Logistik Eksternal
                    </span>
                  )}
                  <p className="text-sm text-slate-400 mt-1">{booking.user?.name} - {booking.user?.department_or_faculty}</p>
                </td>
                <td className="p-4">
                  {booking.status === 'approved' ? (
                    <div className="flex flex-col gap-2">
                      <button 
                        onClick={() => setReviewBooking(booking)}
                        className="flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-slate-300 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors border border-slate-700"
                      >
                        📄 Lihat Proposal
                      </button>
                      <button 
                        onClick={() => handleDownloadPDF(booking.id)}
                        disabled={downloadingId === booking.id}
                        className="flex items-center justify-center gap-2 text-sm text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 rounded-lg transition-colors border border-blue-500/20 disabled:opacity-50"
                      >
                        {downloadingId === booking.id ? 'Mengunduh...' : '📥 Unduh Surat Izin'}
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setReviewBooking(booking)}
                      className="flex items-center justify-center gap-2 text-sm text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 rounded-lg transition-colors border border-blue-500/20"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      Review Proposal
                    </button>
                  )}
                </td>
                <td className="p-4">
                  <div className="flex flex-col gap-1 text-sm relative">
                    {booking.vendors && booking.vendors.length > 0 && (
                      <button 
                        onClick={() => setSelectedBookingForVendor(booking)}
                        className="absolute -right-2 -top-2 p-1 text-slate-400 hover:text-blue-400 rounded-full hover:bg-slate-800 transition-colors z-10"
                        title="Lihat Detail Logistik Vendor"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                    )}
                    <span className="flex items-center gap-2 group relative pr-6">
                      <div className="w-2 h-2 rounded-full bg-orange-500"></div> 
                      Gladi: <span className="font-medium">{rehearsalSchedule ? new Date(rehearsalSchedule.start_time).toLocaleDateString('id-ID') : '-'}</span>
                      {rehearsalSchedule && (
                        <span className="text-slate-400">
                          ({new Date(rehearsalSchedule.start_time).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})} - {new Date(rehearsalSchedule.end_time).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})})
                        </span>
                      )}
                      
                      {/* Tooltip Info */}
                      {rehearsalSchedule && rehearsalSchedule.teardown_buffer_minutes > 0 && (
                        <>
                          <svg className="w-4 h-4 text-slate-400 hover:text-blue-400 cursor-pointer" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block w-48 p-2 bg-slate-800 text-xs text-blue-200 border border-slate-700 rounded-lg shadow-xl z-10 text-center">
                            Termasuk waktu sterilisasi hingga pukul {
                              (() => {
                                const endDate = new Date(rehearsalSchedule.end_time);
                                endDate.setMinutes(endDate.getMinutes() + rehearsalSchedule.teardown_buffer_minutes);
                                return endDate.toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'});
                              })()
                            }
                          </div>
                        </>
                      )}
                    </span>
                    <span className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div> 
                      Hari H: <span className="font-medium">{mainSchedule ? new Date(mainSchedule.start_time).toLocaleDateString('id-ID') : '-'}</span>
                    </span>
                  </div>
                </td>
                <td className="p-4">
                  {booking.status === 'pending' ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                      <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse"></div>
                      Pending
                    </span>
                  ) : booking.status === 'pending_reschedule' ? (
                    <span className="inline-flex flex-col items-start gap-1">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                        <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse"></div>
                        Pending
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-pink-500/20 text-pink-400 border border-pink-500/30">
                        🔄 Prioritas: Jadwal Pengganti
                      </span>
                    </span>
                  ) : booking.status === 'approved' ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-500 border border-green-500/20">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                      Approved
                    </span>
                  ) : booking.status === 'rejected' ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-500 border border-red-500/20">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                      Rejected
                    </span>
                  ) : booking.status === 'revoked' ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-500 border border-purple-500/20">
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                      Revoked
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-500/10 text-slate-500 border border-slate-500/20">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-500"></div>
                      {booking.status}
                    </span>
                  )}
                </td>
                <td className="p-4 text-center">
                  {booking.status === 'pending' || booking.status === 'pending_reschedule' ? (
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleApprove(booking.id)}
                        className="premium-gradient flex-1 px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity shadow-lg shadow-blue-500/20"
                      >
                        Approve
                      </button>
                      <button 
                        onClick={() => setRejectModalData({ id: booking.id, notes: '' })}
                        className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20 flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                      >
                        Tolak
                      </button>
                    </div>
                  ) : booking.status === 'approved' ? (
                    <div className="relative">
                      <button 
                        onClick={() => setRevokeDropdownOpen(revokeDropdownOpen === booking.id ? null : booking.id)}
                        className="bg-green-500/10 text-green-500 border border-green-500/20 px-4 py-2 rounded-lg text-sm font-medium w-full flex justify-between items-center"
                      >
                        Telah Diverifikasi
                        <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {revokeDropdownOpen === booking.id && (
                        <div className="absolute top-full mt-1 right-0 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden z-20 animate-in fade-in zoom-in-95 duration-200">
                          <button 
                            onClick={() => {
                              setRevokeModalData({ id: booking.id });
                              setRevokeDropdownOpen(null);
                            }}
                            className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 font-medium transition-colors"
                          >
                            Cabut Persetujuan (Force Majeure)
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <button disabled className="bg-slate-800 text-slate-500 px-4 py-2 rounded-lg text-sm font-medium cursor-not-allowed w-full">
                      Telah Selesai
                    </button>
                  )}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </>
      )}

      {/* Review Document Modal */}
      {reviewBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="glass-card max-w-4xl w-full max-h-[90vh] rounded-2xl overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-500">
            {/* Header */}
            <div className="p-6 border-b border-slate-700/50 flex justify-between items-center bg-slate-900/50">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Review Surat Permohonan</h3>
                <p className="text-sm text-slate-400">Unified ID: <span className="font-mono text-blue-400">{reviewBooking.booking_code}</span> | Kegiatan: {reviewBooking.event_name}</p>
              </div>
              <button 
                onClick={() => setReviewBooking(null)}
                className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Body - Actual PDF Viewer */}
            <div className="p-6 flex-1 bg-slate-950/50 flex flex-col">
              <div className="w-full h-[65vh] bg-white rounded-lg shadow-2xl overflow-hidden relative border border-slate-700">
                {reviewBooking.document_url ? (
                  <div className="flex flex-col h-full">
                    {/* Persistent Toolbar */}
                    <div className="bg-slate-100 border-b border-slate-200 p-3 flex justify-between items-center text-slate-600 text-sm">
                      <span className="font-mono truncate max-w-md">{reviewBooking.document_url.split('/').pop()}</span>
                      <a 
                        href={`http://localhost:5000${encodeURI(reviewBooking.document_url)}`}
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition-colors shadow-sm"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        Buka di Tab Baru
                      </a>
                    </div>
                    {/* PDF Viewer using dynamically imported component */}
                    <PDFViewer url={`http://localhost:5000${encodeURI(reviewBooking.document_url)}`} />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-500">
                    <p>File tidak ditemukan atau format tidak didukung.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-6 border-t border-slate-700/50 bg-slate-900/80 flex justify-end gap-4 items-center">
              <span className="text-sm text-slate-400 mr-auto">
                Setelah direview, Anda dapat langsung menyetujui pengajuan ini.
              </span>
              <button 
                onClick={() => setReviewBooking(null)}
                className="px-6 py-2.5 rounded-xl font-medium text-slate-300 hover:bg-slate-800 transition-colors"
              >
                Tutup
              </button>
              {(reviewBooking.status === 'pending' || reviewBooking.status === 'pending_reschedule') && (
                <button 
                  onClick={() => handleApprove(reviewBooking.id)}
                  className="premium-gradient px-6 py-2.5 rounded-xl font-medium text-white shadow-lg hover:opacity-90 transition-opacity flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Approve Sekarang
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="glass-card max-w-md w-full rounded-2xl overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-500 border border-red-500/30 shadow-[0_0_50px_-12px_rgba(239,68,68,0.3)]">
            <div className="p-6 border-b border-slate-700/50 bg-slate-900/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Tolak Pengajuan</h3>
                  <p className="text-sm text-slate-400">Jelaskan alasan penolakan kepada pemohon.</p>
                </div>
              </div>
            </div>
            <form onSubmit={handleReject} className="p-6 flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Catatan Penolakan (Wajib)</label>
                <textarea 
                  required
                  rows={4}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-red-500 outline-none transition-all placeholder:text-slate-600"
                  placeholder="Misal: Format dokumen tidak sesuai dengan kebijakan rektorat..."
                  value={rejectModalData.notes}
                  onChange={(e) => setRejectModalData({ ...rejectModalData, notes: e.target.value })}
                ></textarea>
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button 
                  type="button"
                  onClick={() => setRejectModalData(null)}
                  className="px-4 py-2 rounded-xl font-medium text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  className="bg-red-500 hover:bg-red-600 px-6 py-2 rounded-xl font-medium text-white shadow-lg shadow-red-500/20 transition-all disabled:opacity-50"
                  disabled={!rejectModalData.notes.trim()}
                >
                  Kirim Penolakan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal Pemetaan Vendor Logistik */}
      {selectedBookingForVendor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="glass-card max-w-4xl w-full max-h-[90vh] rounded-2xl overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-500 shadow-[0_0_50px_-12px_rgba(59,130,246,0.3)]">
            <div className="p-6 border-b border-slate-700/50 bg-slate-900/80 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Detail Logistik Vendor</h3>
                  <p className="text-sm text-slate-400">Penyewa: {selectedBookingForVendor.user?.name}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedBookingForVendor(null)}
                className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar">
              {selectedBookingForVendor.vendors && selectedBookingForVendor.vendors.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-700/50">
                        <th className="pb-3 text-sm font-semibold text-slate-300 pl-4">Kategori</th>
                        <th className="pb-3 text-sm font-semibold text-slate-300">Nama Vendor</th>
                        <th className="pb-3 text-sm font-semibold text-slate-300">PIC</th>
                        <th className="pb-3 text-sm font-semibold text-slate-300">Kontak</th>
                        <th className="pb-3 text-sm font-semibold text-slate-300 pr-4 text-right">Jadwal Logistik</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {selectedBookingForVendor.vendors.map((vendor: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-4 pl-4 text-sm font-medium text-blue-400">{vendor.vendor_category.replace(/_/g, ' ')}</td>
                          <td className="py-4 text-sm text-slate-200">{vendor.vendor_name}</td>
                          <td className="py-4 text-sm text-slate-200">{vendor.pic_name}</td>
                          <td className="py-4 text-sm font-mono text-slate-400">{vendor.pic_phone}</td>
                          <td className="py-4 pr-4 text-right">
                            <div className="flex flex-col items-end gap-1">
                              <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded flex items-center gap-1 border border-slate-700/50">
                                <span className="text-blue-400">Masuk:</span> {new Date(vendor.loading_start).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                              </span>
                              <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded flex items-center gap-1 border border-slate-700/50">
                                <span className="text-red-400">Keluar:</span> {new Date(vendor.unloading_end).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-slate-400 text-center py-4">Tidak ada data vendor.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Premium Toast Notification */}
      <div 
        className={`fixed bottom-8 right-8 z-[100] transition-all duration-500 ease-out transform ${
          toast.show ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-10 opacity-0 scale-95 pointer-events-none'
        }`}
      >
        <div className="glass-card px-5 py-3 rounded-2xl shadow-[0_10px_40px_-10px_rgba(59,130,246,0.2)] flex items-center gap-4 bg-slate-900/95 backdrop-blur-xl border border-slate-700/50">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
            toast.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          }`}>
            {toast.type === 'success' ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </div>
          <div>
            <h4 className="text-white font-bold text-sm tracking-wide">
              {toast.type === 'success' ? 'Berhasil' : 'Gagal'}
            </h4>
            <p className="text-slate-400 text-sm">{toast.message}</p>
          </div>
          <button 
            onClick={() => setToast(prev => ({ ...prev, show: false }))}
            className="ml-2 p-1.5 hover:bg-slate-800 rounded-full text-slate-500 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      {/* Revoke (Force Majeure) Modal */}
      {revokeModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setRevokeModalData(null)}></div>
          <div className="bg-slate-900 border border-red-500/30 rounded-2xl p-6 w-full max-w-md shadow-2xl shadow-red-900/20 z-10 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-4 mb-4 text-red-400">
              <div className="p-3 bg-red-500/10 rounded-full">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white">Cabut Persetujuan</h3>
            </div>
            <p className="text-slate-300 text-sm mb-4 leading-relaxed">
              Anda akan membatalkan secara paksa jadwal yang telah disetujui <strong className="text-red-400">(Force Majeure)</strong>. Tindakan ini tidak dapat dibatalkan dan akan mencabut akses penyewa ke fasilitas terkait.
            </p>
            <textarea
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              placeholder="Berikan alasan pencabutan (contoh: Acara Universitas mendadak)..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-sm text-white focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all outline-none mb-6 resize-none min-h-[100px]"
            ></textarea>
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => {
                  setRevokeModalData(null);
                  setRevokeReason('');
                }}
                className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
              >
                Batal
              </button>
              <button 
                disabled={revokeReason.trim() === ''}
                onClick={() => {
                  handleRevoke(revokeModalData.id);
                  setRevokeModalData(null);
                }}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors shadow-lg ${revokeReason.trim() === '' ? 'bg-slate-600 cursor-not-allowed opacity-50' : 'bg-red-600 hover:bg-red-700 shadow-red-900/50'}`}
              >
                Ya, Cabut Paksa
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
