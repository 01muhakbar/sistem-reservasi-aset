'use client';
import dynamic from 'next/dynamic';

// Menonaktifkan Server-Side Rendering (SSR) sepenuhnya untuk halaman Admin
// Ini adalah satu-satunya cara untuk mencegah ekstensi browser (seperti IDM & Bitdefender)
// yang menyuntikkan atribut `bis_skin_checked` agar tidak menyebabkan infinite hydration loop.
const AdminDashboard = dynamic(() => import('./AdminDashboard'), { 
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
      <div className="flex flex-col items-center">
        <svg className="animate-spin -ml-1 mr-3 h-10 w-10 text-blue-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="text-slate-400 font-medium">Memuat antarmuka Admin...</p>
      </div>
    </div>
  )
});

export default function AdminPage() {
  return <AdminDashboard />;
}
