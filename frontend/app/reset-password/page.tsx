'use client';
import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const router = useRouter();

  useEffect(() => {
    if (!token) {
      setError('Token pemulihan tidak ditemukan pada URL.');
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    if (password !== confirmPassword) {
      setError('Kata sandi tidak cocok.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('http://localhost:5000/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: password }),
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        setMessage('Kata sandi berhasil diatur ulang. Mengarahkan ke halaman login...');
        setTimeout(() => router.push('/login'), 3000);
      } else {
        setError(data.error || 'Terjadi kesalahan saat mengatur ulang kata sandi.');
      }
    } catch (err) {
      setError('Terjadi kesalahan jaringan.');
    }
    setLoading(false);
  };

  return (
    <div className="flex-grow flex items-center justify-center p-4 min-h-[calc(100vh-80px)]">
      <div className="glass-card max-w-md w-full rounded-3xl p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-green-500/20 blur-3xl rounded-full pointer-events-none"></div>

        <div className="text-center mb-8 relative z-10">
          <h2 className="text-2xl font-bold text-white mb-2">Atur Ulang Sandi</h2>
          <p className="text-slate-400 text-sm">Masukkan kata sandi baru Anda di bawah ini.</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm p-3 rounded-xl mb-6 relative z-10 text-center">
            {error}
          </div>
        )}

        {message && (
          <div className="bg-green-500/10 border border-green-500/30 text-green-400 text-sm p-3 rounded-xl mb-6 relative z-10 text-center">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Kata Sandi Baru</label>
            <input 
              type="password" required
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={!token || !!message}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Konfirmasi Kata Sandi Baru</label>
            <input 
              type="password" required
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={!token || !!message}
            />
          </div>
          
          <button 
            type="submit"
            disabled={loading || !token || !password || !!message}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50 flex items-center justify-center"
          >
            {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : 'Simpan Kata Sandi'}
          </button>
          
          <div className="text-center mt-4">
             <Link href="/login" className="text-sm text-slate-400 hover:text-white transition-colors">Kembali ke halaman Login</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
