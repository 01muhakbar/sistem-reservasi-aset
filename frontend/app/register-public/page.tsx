'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPublicPage() {
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!file) {
      setError('Mohon unggah dokumen identitas (KTP/NIB).');
      setLoading(false);
      return;
    }

    try {
      // 1. Upload File (Mock)
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);
      
      const uploadRes = await fetch('http://localhost:5000/api/upload', {
        method: 'POST',
        body: formDataUpload,
        credentials: 'include'
      });
      
      if (!uploadRes.ok) throw new Error('Gagal mengunggah file KTP/NIB.');
      const uploadData = await uploadRes.json();
      const identity_doc_url = uploadData.data.url;

      // 2. Register
      const res = await fetch('http://localhost:5000/api/auth/register-public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, identity_doc_url }),
        credentials: 'include'
      });

      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
      } else {
        setError(data.error || 'Registrasi gagal.');
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan jaringan.');
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="flex-grow flex items-center justify-center p-4 min-h-[calc(100vh-80px)]">
        <div className="glass-card max-w-md w-full rounded-3xl p-8 text-center relative overflow-hidden">
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">Pendaftaran Berhasil</h2>
          <p className="text-slate-400 mb-8 leading-relaxed">
            Akun Anda sedang dalam status <strong>PENDING KYC</strong>. Mohon tunggu verifikasi Kasubdit sebelum dapat melakukan pengajuan. Anda dapat masuk sekarang untuk mengecek status.
          </p>
          <button onClick={() => router.push('/login')} className="w-full premium-gradient px-4 py-3.5 rounded-xl font-bold text-white shadow-lg shadow-blue-500/25">
            Menuju Halaman Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-grow flex items-center justify-center p-4 min-h-[calc(100vh-80px)]">
      <div className="glass-card max-w-lg w-full rounded-3xl p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-blue-500/20 blur-3xl rounded-full pointer-events-none"></div>

        <div className="text-center mb-8 relative z-10">
          <h2 className="text-2xl font-bold text-white mb-2">Pendaftaran Entitas Eksternal</h2>
          <p className="text-slate-400 text-sm">Wajib bagi EO, Perusahaan, atau Masyarakat Umum.</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm p-3 rounded-xl mb-6 relative z-10 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-5 relative z-10">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Nama Instansi / EO</label>
            <input 
              type="text" required
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Email Akses</label>
            <input 
              type="email" required
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Kata Sandi Baru</label>
            <input 
              type="password" required
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Unggah KTP Penanggung Jawab / NIB</label>
            <div className="relative border-2 border-dashed border-slate-700 rounded-xl p-6 text-center hover:bg-slate-800/30 transition-colors">
              <input 
                type="file" 
                required 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)} 
              />
              <div className="flex flex-col items-center justify-center">
                <svg className="w-8 h-8 text-slate-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                <span className="text-sm font-medium text-slate-300">{file ? file.name : "Seret file atau klik untuk memilih"}</span>
                <span className="text-xs text-slate-500 mt-1">PDF, JPG, PNG up to 10MB</span>
              </div>
            </div>
          </div>
          
          <button 
            type="submit"
            disabled={loading}
            className="w-full premium-gradient px-4 py-3.5 rounded-xl font-bold text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all disabled:opacity-50 flex items-center justify-center"
          >
            {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : 'Kirim Pendaftaran'}
          </button>
          <div className="text-center mt-4">
             <Link href="/login" className="text-sm text-slate-400 hover:text-white transition-colors">Kembali ke halaman Login</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
