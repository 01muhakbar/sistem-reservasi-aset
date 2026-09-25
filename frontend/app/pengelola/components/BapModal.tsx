import React, { useState } from 'react';

export default function BapModal({ schedule, onClose }: { schedule: any, onClose: () => void }) {
  const [cleanliness, setCleanliness] = useState<'good' | 'dirty' | 'damaged'>('good');
  const [details, setDetails] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [violatingVendor, setViolatingVendor] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!file && cleanliness !== 'good') {
      setError('Foto bukti wajib diunggah jika kondisi kotor atau rusak.');
      setLoading(false);
      return;
    }

    try {
      let photoUrl = '';
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        const uploadRes = await fetch('http://localhost:5000/api/upload', {
          method: 'POST',
          body: formData,
          credentials: 'include'
        });
        if (!uploadRes.ok) throw new Error('Gagal mengunggah foto.');
        const uploadData = await uploadRes.json();
        photoUrl = uploadData.data.url;
      }

      const res = await fetch('http://localhost:5000/api/operations/bap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: schedule.booking_id,
          cleanliness_status: cleanliness,
          facility_damage_details: details,
          photo_evidence_urls: [photoUrl].filter(Boolean),
          violating_vendor_name: violatingVendor || undefined
        }),
        credentials: 'include'
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Gagal mengirim BAP.');
      } else {
        alert('BAP berhasil dikirim!');
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Kesalahan jaringan.');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="glass-card max-w-lg w-full rounded-3xl p-6 relative">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Berita Acara Pemeriksaan (BAP)</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="mb-6 p-4 bg-slate-900/50 rounded-xl border border-slate-700">
          <p className="text-sm text-slate-400 mb-1">Acara Pasca-Eksekusi:</p>
          <p className="font-semibold text-white">{schedule.booking?.event_name}</p>
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm p-3 rounded-xl mb-6">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">Kondisi Fasilitas Keseluruhan</label>
            <div className="flex gap-4">
              <label className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${cleanliness === 'good' ? 'bg-green-500/20 border-green-500 text-green-400' : 'bg-slate-900/50 border-slate-700 hover:bg-slate-800'}`}>
                <input type="radio" name="status" value="good" className="hidden" checked={cleanliness === 'good'} onChange={() => setCleanliness('good')} />
                <span className="text-2xl">✅</span>
                <span className="text-sm font-medium">Baik / Bersih</span>
              </label>
              <label className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${cleanliness === 'dirty' ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400' : 'bg-slate-900/50 border-slate-700 hover:bg-slate-800'}`}>
                <input type="radio" name="status" value="dirty" className="hidden" checked={cleanliness === 'dirty'} onChange={() => setCleanliness('dirty')} />
                <span className="text-2xl">🧹</span>
                <span className="text-sm font-medium">Kotor Berat</span>
              </label>
              <label className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${cleanliness === 'damaged' ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-slate-900/50 border-slate-700 hover:bg-slate-800'}`}>
                <input type="radio" name="status" value="damaged" className="hidden" checked={cleanliness === 'damaged'} onChange={() => setCleanliness('damaged')} />
                <span className="text-2xl">🚨</span>
                <span className="text-sm font-medium">Rusak</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Catatan Kerusakan (Bila ada)</label>
            <textarea 
              rows={3}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-500"
              placeholder="Contoh: Ada 2 kursi patah, karpet tertumpah kopi."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />
          </div>

          {(cleanliness === 'dirty' || cleanliness === 'damaged') && schedule.booking?.vendors?.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl">
              <label className="block text-sm font-medium text-red-200 mb-2">Pihak yang Bertanggung Jawab</label>
              <select
                value={violatingVendor}
                onChange={(e) => setViolatingVendor(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-red-500 outline-none"
              >
                <option value="">Panitia Penyelenggara (Mahasiswa)</option>
                {schedule.booking.vendors.map((v: any) => (
                  <option key={v.id} value={v.vendor_name}>
                    Vendor: {v.vendor_name} ({v.vendor_category.replace('_', ' ')})
                  </option>
                ))}
              </select>
              <p className="text-xs text-red-300 mt-2 opacity-80">
                Pilih vendor jika murni kesalahan logistik agar ganti rugi dibebankan ke vendor dan mahasiswa tidak di-blacklist.
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Foto Bukti (Kamera Langsung)</label>
            <div className="relative border-2 border-dashed border-slate-700 rounded-xl p-6 text-center hover:bg-slate-800/30 transition-colors">
              {/* Note: capture="environment" forces mobile to use back camera directly */}
              <input 
                type="file" 
                accept="image/*"
                capture="environment"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)} 
              />
              <div className="flex flex-col items-center justify-center">
                <svg className="w-8 h-8 text-slate-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <span className="text-sm font-medium text-slate-300">{file ? file.name : "Ketuk untuk mengambil foto"}</span>
              </div>
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50 flex items-center justify-center"
          >
            {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : 'Kirim Laporan BAP'}
          </button>
        </form>
      </div>
    </div>
  );
}
