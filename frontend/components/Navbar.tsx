'use client';
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';

function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initial fetch
    fetch('http://localhost:5000/api/notifications', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.data) {
          setNotifications(data.data);
          setUnreadCount(data.data.filter((n: any) => !n.is_read).length);
        }
      })
      .catch(err => console.error(err));

    // SSE Stream
    const eventSource = new EventSource('http://localhost:5000/api/notifications/stream', { withCredentials: true });
    
    eventSource.onmessage = (event) => {
      try {
        const notif = JSON.parse(event.data);
        if (notif.connected) return;
        setNotifications(prev => [notif, ...prev]);
        setUnreadCount(prev => prev + 1);
      } catch (e) {
        console.error(e);
      }
    };

    return () => eventSource.close();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleRead = async (id: string, url: string) => {
    try {
      await fetch(`http://localhost:5000/api/notifications/${id}/read`, {
        method: 'PATCH',
        credentials: 'include'
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
      setOpen(false);
      router.push(url);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string, isRead: boolean) => {
    e.stopPropagation();
    try {
      await fetch(`http://localhost:5000/api/notifications/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      setNotifications(prev => prev.filter(n => n.id !== id));
      if (!isRead) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggle = async () => {
    const newState = !open;
    setOpen(newState);
    
    if (newState && unreadCount > 0) {
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      try {
        await fetch('http://localhost:5000/api/notifications/read-all', {
          method: 'PATCH',
          credentials: 'include'
        });
      } catch (e) {
        console.error(e);
      }
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={handleToggle} 
        className="relative p-2 text-slate-300 hover:text-white transition-colors rounded-full hover:bg-slate-800 focus:outline-none"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-slate-900 shadow-[0_0_8px_rgba(239,68,68,0.6)]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50">
          <div className="p-3 border-b border-slate-700 bg-slate-900/50">
            <h3 className="text-sm font-semibold text-white">Notifikasi</h3>
          </div>
          <div className="max-h-96 overflow-y-auto custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-sm">Tidak ada notifikasi baru</div>
            ) : (
              notifications.map((n) => (
                <div 
                  key={n.id} 
                  onClick={() => handleRead(n.id, n.action_url)}
                  className={`p-4 border-b border-slate-700/50 hover:bg-slate-700/50 cursor-pointer transition-colors ${!n.is_read ? 'bg-slate-800' : 'bg-slate-900/20'}`}
                >
                  <div className="flex justify-between items-start mb-1 gap-2">
                    <span className={`text-sm font-medium ${n.urgency === 'HIGH' ? 'text-red-400' : n.urgency === 'MEDIUM' ? 'text-yellow-400' : 'text-blue-400'}`}>{n.title}</span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {!n.is_read && <span className="w-2 h-2 rounded-full bg-blue-500"></span>}
                      <button 
                        onClick={(e) => handleDelete(e, n.id, n.is_read)}
                        className="text-slate-500 hover:text-red-400 transition-colors p-1 rounded hover:bg-slate-700/50"
                        title="Hapus Notifikasi"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{n.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <header suppressHydrationWarning className="glass-card sticky top-0 z-50 border-b border-slate-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full premium-gradient flex items-center justify-center font-bold shadow-lg">
            BRG
          </div>
          <Link href="/">
            <h1 className="text-xl font-bold tracking-tight">Baruga <span className="premium-text-gradient">Reserve</span></h1>
          </Link>
        </div>
        <nav className="hidden md:flex space-x-8 items-center">
          <Link href="/" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Kalender</Link>
          <Link href="/booking" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Pengajuan</Link>
          
          {isAuthenticated && user?.role === 'kasubdit' && (
            <Link href="/admin" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Dashboard Kasubdit</Link>
          )}
          
          {isAuthenticated && user?.role === 'pengelola' && (
            <Link href="/pengelola/dashboard" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Dashboard Pengelola</Link>
          )}
          
          {isAuthenticated && (user?.role === 'mahasiswa' || user?.role === 'fakultas' || user?.role === 'umum_komersial') && (
            <Link href="/user/dashboard" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Ruang Kerja Saya</Link>
          )}
        </nav>
        <div className="flex items-center gap-4">
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <NotificationBell />
              <span className="text-sm text-slate-400 hidden sm:block">Halo, {user?.name.split(' ')[0]}</span>
              <button 
                onClick={logout}
                className="bg-red-500/10 text-red-500 border border-red-500/20 px-4 py-1.5 rounded-full text-sm font-medium hover:bg-red-500 hover:text-white transition-colors"
              >
                Keluar
              </button>
            </div>
          ) : (
            <Link href="/login" className="premium-gradient px-5 py-2 rounded-full text-sm font-medium hover:opacity-90 transition-opacity shadow-lg shadow-blue-500/20 inline-block">
              Masuk
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
