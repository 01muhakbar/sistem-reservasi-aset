import React, { useState } from 'react';

export default function GatepassModal({ schedule, onClose }: { schedule: any, onClose: () => void }) {
  const [vendors, setVendors] = useState<any[]>(schedule.booking?.vendors || []);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadPDF = async () => {
    setIsDownloading(true);
    try {
      const res = await fetch(`http://localhost:5000/api/bookings/${schedule.booking_id}/pdf`, {
        credentials: 'include'
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Surat_Izin_${schedule.booking_id}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        alert('Gagal memuat dokumen legalitas. Silakan coba beberapa saat lagi.');
      }
    } catch (e) {
      alert('Terjadi kesalahan jaringan saat mengunduh PDF.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleVendorStatusChange = async (vendor: any, newStatus: 'DI_LOKASI' | 'SELESAI') => {
    setLoadingId(vendor.id);
    try {
      const res = await fetch(`http://localhost:5000/api/operations/vendors/${vendor.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ check_in_status: newStatus }),
        credentials: 'include'
      });
      if (res.ok) {
        const updatedVendors = vendors.map(v => 
          v.id === vendor.id ? { ...v, check_in_status: newStatus } : v
        );
        setVendors(updatedVendors);
      } else {
        alert('Gagal memperbarui status check-in.');
      }
    } catch (err) {
      alert('Kesalahan jaringan.');
    }
    setLoadingId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="glass-card max-w-5xl w-full max-h-[90vh] rounded-2xl overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-500 shadow-[0_0_50px_-12px_rgba(59,130,246,0.3)]">
        <div className="p-6 border-b border-slate-700/50 bg-slate-900/80 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Gatepass Vendor Logistik</h3>
              <p className="text-sm text-slate-400">Penyewa: {schedule.booking?.user?.name} | Acara: {schedule.booking?.event_name}</p>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <button 
              onClick={handleDownloadPDF}
              disabled={isDownloading}
              className="bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              {isDownloading ? 'Mengunduh...' : 'Cetak Gatepass & Surat Izin'}
            </button>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="p-6 overflow-y-auto custom-scrollbar">
          {vendors && vendors.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-700/50">
                    <th className="pb-3 text-sm font-semibold text-slate-300 pl-4">Kategori</th>
                    <th className="pb-3 text-sm font-semibold text-slate-300">Nama Vendor</th>
                    <th className="pb-3 text-sm font-semibold text-slate-300">PIC</th>
                    <th className="pb-3 text-sm font-semibold text-slate-300 pr-4">Kontak</th>
                    <th className="pb-3 text-sm font-semibold text-slate-300 text-right pr-4">Jadwal Logistik</th>
                    <th className="pb-3 text-sm font-semibold text-slate-300 text-center pl-4">Status Lapangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {vendors.map((vendor: any, idx: number) => {
                    const status = vendor.check_in_status || 'MENUNGGU';
                    
                    let bgClass = "hover:bg-slate-800/30 transition-colors";
                    if (status === 'DI_LOKASI') bgClass = "bg-green-900/20";
                    if (status === 'SELESAI') bgClass = "bg-slate-800 opacity-50";

                    return (
                      <tr key={idx} className={bgClass}>
                        <td className="py-4 pl-4 text-sm font-medium text-blue-400">{vendor.vendor_category.replace(/_/g, ' ')}</td>
                        <td className={`py-4 text-sm text-slate-200 ${status === 'SELESAI' ? 'line-through' : ''}`}>{vendor.vendor_name}</td>
                        <td className="py-4 text-sm text-slate-200">{vendor.pic_name}</td>
                        <td className="py-4 text-sm font-mono text-slate-400">{vendor.pic_phone}</td>
                        <td className="py-4 pr-4 text-right">
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded flex items-center gap-1 border border-slate-700/50">
                              <span className="text-blue-500 font-bold">Masuk:</span> {new Date(vendor.loading_start).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                            </span>
                            <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded flex items-center gap-1 border border-slate-700/50">
                              <span className="text-red-500 font-bold">Keluar:</span> {new Date(vendor.unloading_end).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 pl-4 text-center border-l border-slate-700/30">
                          {status === 'SELESAI' ? (
                            <span className="text-xs font-bold text-slate-500 bg-slate-700/50 px-3 py-1.5 rounded-full border border-slate-600/50">
                              SELESAI
                            </span>
                          ) : (
                            <div className="flex flex-col gap-2 items-center justify-center">
                              <button
                                onClick={() => handleVendorStatusChange(vendor, 'DI_LOKASI')}
                                disabled={status === 'DI_LOKASI' || loadingId === vendor.id}
                                className={`text-xs font-bold px-3 py-1.5 rounded-full transition-all w-full max-w-[100px] ${
                                  status === 'DI_LOKASI' 
                                    ? 'bg-green-500/10 text-green-500 border border-green-500/30 opacity-50 cursor-not-allowed'
                                    : 'bg-green-600 text-white hover:bg-green-500 shadow-lg shadow-green-500/20'
                                }`}
                              >
                                {loadingId === vendor.id && status !== 'DI_LOKASI' ? '...' : 'Check-In'}
                              </button>
                              
                              <button
                                onClick={() => {
                                  if (window.confirm(`Konfirmasi: Vendor ${vendor.vendor_name} telah selesai bongkar muat dan keluar kampus?`)) {
                                    handleVendorStatusChange(vendor, 'SELESAI');
                                  }
                                }}
                                disabled={status !== 'DI_LOKASI' || loadingId === vendor.id}
                                className={`text-xs font-bold px-3 py-1.5 rounded-full transition-all w-full max-w-[100px] ${
                                  status !== 'DI_LOKASI'
                                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                                    : 'bg-slate-700 text-white hover:bg-slate-600 border border-slate-600 shadow-md'
                                }`}
                              >
                                {loadingId === vendor.id && status === 'DI_LOKASI' ? '...' : 'Check-Out'}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-slate-400 text-center py-4">Tidak ada data vendor.</p>
          )}
        </div>
      </div>
    </div>
  );
}
