'use client';
import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loadingPub, setLoadingPub] = useState(false);
  const [loadingSSO, setLoadingSSO] = useState(false);
  const [error, setError] = useState('');
  
  // Mock SSO Modal states
  const [showSSOModal, setShowSSOModal] = useState(false);
  const [ssoEmail, setSsoEmail] = useState('');

  const { user, isAuthenticated, login } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'kasubdit') {
        router.push('/admin');
      } else if (user.role === 'pengelola') {
        router.push('/pengelola/dashboard');
      } else {
        router.push('/user/dashboard');
      }
    }
  }, [isAuthenticated, user, router]);

  const handleLoginPublic = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingPub(true);
    setError('');
    
    // Simulate invisible reCAPTCHA check here

    try {
      const res = await fetch('http://localhost:5000/api/auth/login-public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include' // Important for HttpOnly Cookie
      });

      const data = await res.json();
      if (res.ok) {
        login(data.data);
        if (data.data.role === 'kasubdit') {
          router.push('/admin');
        } else if (data.data.role === 'pengelola') {
          router.push('/pengelola/dashboard');
        } else {
          router.push('/user/dashboard');
        }
      } else {
        setError(data.error || 'Login gagal.');
      }
    } catch (err) {
      setError('Terjadi kesalahan jaringan.');
    }
    setLoadingPub(false);
  };

  const handleLoginSSOClick = () => {
    setShowSSOModal(true);
    setSsoEmail('');
    setError('');
  };

  const submitMockSSO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ssoEmail) return;

    setLoadingSSO(true);
    setError('');

    try {
      const res = await fetch('http://localhost:5000/api/auth/login-sso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: ssoEmail }),
        credentials: 'include'
      });

      const data = await res.json();
      if (res.ok) {
        setShowSSOModal(false);
        login(data.data);
        if (data.data.role === 'kasubdit') {
          router.push('/admin');
        } else if (data.data.role === 'pengelola') {
          router.push('/pengelola/dashboard');
        } else {
          router.push('/user/dashboard');
        }
      } else {
        setError(data.error || 'SSO Login gagal.');
      }
    } catch (err) {
      setError('Terjadi kesalahan jaringan.');
    }
    setLoadingSSO(false);
  };

  return (
    <div className="flex-grow flex items-stretch min-h-[calc(100vh-80px)]">
      {/* KIRI: SSO INTERNAL */}
      <div className="w-1/2 hidden md:flex flex-col justify-center items-center p-12 bg-slate-900/50 border-r border-slate-800 relative overflow-hidden">
        <div className="absolute top-10 left-10 w-64 h-64 bg-red-500/10 blur-3xl rounded-full pointer-events-none"></div>
        <div className="absolute bottom-10 right-10 w-64 h-64 bg-blue-500/10 blur-3xl rounded-full pointer-events-none"></div>
        
        <div className="text-center z-10 max-w-md">
          <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center font-bold shadow-lg shadow-red-500/20 mx-auto mb-6 text-3xl">
            🏛️
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">Warga Kampus Unhas</h2>
          <p className="text-slate-400 mb-8 leading-relaxed">
            Mahasiswa, Dosen, dan Tenaga Kependidikan Universitas Hasanuddin silakan masuk menggunakan kredensial Sikola/Neosia.
          </p>
          
          <button 
            onClick={handleLoginSSOClick}
            disabled={loadingSSO}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-red-600/30 transition-all flex items-center justify-center space-x-2"
          >
            {loadingSSO ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              <>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" /></svg>
                <span>Masuk dengan SSO Unhas</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* KANAN: PUBLIK EXTERNAL */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-4">
        <div className="glass-card max-w-md w-full rounded-3xl p-8 relative overflow-hidden">
          <div className="text-center mb-8 relative z-10">
            <h2 className="text-2xl font-bold text-white mb-2">Akses Eksternal & Umum</h2>
            <p className="text-slate-400 text-sm">Masuk bagi EO, Perusahaan, atau Masyarakat Umum.</p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm p-3 rounded-xl mb-6 relative z-10 text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleLoginPublic} className="space-y-5 relative z-10">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email Instansi / Pribadi</label>
              <input 
                type="email"
                required
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-500"
                placeholder="email@perusahaan.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Kata Sandi</label>
              <input 
                type="password"
                required
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-500"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <div className="text-right mt-2">
                <Link href="/forgot-password" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                  Lupa Kata Sandi?
                </Link>
              </div>
            </div>
            
            <button 
              type="submit"
              disabled={loadingPub || !email || !password}
              className="w-full premium-gradient px-4 py-3.5 rounded-xl font-bold text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loadingPub ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : 'Masuk (Publik)'}
            </button>

            <div className="text-center mt-6 text-sm text-slate-400 border-t border-slate-800 pt-6">
              Belum memiliki akun eksternal?{' '}
              <Link href="/register-public" className="text-blue-400 hover:text-blue-300 font-medium">
                Daftar Sekarang
              </Link>
            </div>
          </form>
        </div>
      </div>

      {/* Mock SSO Modal */}
      {showSSOModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="glass-card max-w-md w-full rounded-3xl p-8 relative shadow-2xl shadow-red-500/10">
            <button 
              onClick={() => setShowSSOModal(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Simulasi SSO Kampus</h3>
              <p className="text-slate-400 text-sm">
                Karena berada di mode pengembangan, silakan masukkan email mock Anda (contoh: <span className="text-blue-400 font-mono">kasubdit@unhas.ac.id</span>).
              </p>
            </div>

            <form onSubmit={submitMockSSO} className="space-y-4">
              <div>
                <input 
                  type="email" required autoFocus
                  placeholder="email@unhas.ac.id"
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-red-500 outline-none transition-all text-center font-mono"
                  value={ssoEmail}
                  onChange={(e) => setSsoEmail(e.target.value)}
                />
              </div>

              <button 
                type="submit"
                disabled={loadingSSO || !ssoEmail}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-red-500/25 transition-all disabled:opacity-50 flex items-center justify-center"
              >
                {loadingSSO ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : 'Otentikasi SSO'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
