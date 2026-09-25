import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Sistem Reservasi Aset | Baruga A.P. Pettarani',
  description: 'Sistem Informasi Reservasi Fasilitas Terintegrasi Universitas Hasanuddin',
};

import { AuthProvider } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body suppressHydrationWarning className={`${inter.className} min-h-screen bg-[#0F172A] text-slate-50 flex flex-col`}>
        <AuthProvider>
          <Navbar />
          <main className="flex-grow">
            {children}
          </main>
        </AuthProvider>

        <footer className="border-t border-slate-800 py-8 text-center text-slate-500 text-sm mt-auto">
          &copy; {new Date().getFullYear()} Universitas Hasanuddin. Hak Cipta Dilindungi.
        </footer>
      </body>
    </html>
  );
}
