'use client';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import InventoryModal from '../components/InventoryModal';
import BapModal from '../components/BapModal';
import GatepassModal from '../components/GatepassModal';

export default function PengelolaDashboard() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();

  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedScheduleForInv, setSelectedScheduleForInv] = useState<any | null>(null);
  const [selectedScheduleForBap, setSelectedScheduleForBap] = useState<any | null>(null);
  const [selectedScheduleForGatepass, setSelectedScheduleForGatepass] = useState<any | null>(null);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'pengelola') {
      router.push('/login');
      return;
    }
    fetchRoster();
  }, [isAuthenticated, user, router]);

  const fetchRoster = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/operations/daily-roster', {
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        setSchedules(data.data || []);
      } else {
        setError(data.error || 'Gagal memuat jadwal.');
      }
    } catch (err) {
      setError('Kesalahan jaringan.');
    }
    setLoading(false);
  };

  const getStatusColor = (usageType: string) => {
    if (usageType.includes('gladi')) return 'border-orange-500 bg-orange-500/10 text-orange-400';
    return 'border-blue-500 bg-blue-500/10 text-blue-400';
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div></div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Monitor Eksekusi Harian</h1>
        <p className="text-slate-400">Jadwal lapangan 7 hari ke depan (Roster Mingguan).</p>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl text-red-400 mb-6">{error}</div>}

      <div className="space-y-6">
        {schedules.length === 0 ? (
          <div className="glass-card p-12 text-center text-slate-500 rounded-2xl">
            Tidak ada agenda eksekusi dalam 7 hari ke depan.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {schedules.map(schedule => {
              const isPastEvent = new Date() > new Date(schedule.end_time);
              const inventories = schedule.booking?.inventories || [];

              return (
                <div key={schedule.id} className={`glass-card p-6 rounded-2xl border-l-4 ${getStatusColor(schedule.usage_type)} flex flex-col justify-between h-full`}>
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <span className="text-sm font-semibold uppercase tracking-wider">{new Date(schedule.start_time).toLocaleDateString('id-ID')}</span>
                      <span className="text-xs bg-slate-800 px-2 py-1 rounded-md text-slate-300">
                        {new Date(schedule.start_time).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})} - {new Date(schedule.end_time).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-1">{schedule.booking?.event_name}</h3>
                    {schedule.booking?.vendors && schedule.booking.vendors.length > 0 && (
                      <span className="inline-block mt-1 mb-2 bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full border border-yellow-200 shadow-sm">
                        🚚 Logistik Eksternal
                      </span>
                    )}
                    <p className="text-sm text-slate-400 mb-4">{schedule.booking?.user?.name} - {schedule.booking?.user?.department_or_faculty}</p>
                    
                    <div className="mb-4">
                      <span className="text-xs text-slate-500 block mb-1">Gedung</span>
                      <p className="text-sm font-medium">{schedule.venue?.name}</p>
                    </div>

                    <div className="mb-6">
                      <span className="text-xs text-slate-500 block mb-2">Inventaris Ekstra (Add-ons)</span>
                      <div className="flex flex-wrap gap-2">
                        {inventories.length === 0 ? (
                          <span className="text-xs text-slate-600 italic">Tidak ada</span>
                        ) : inventories.map((inv: any) => (
                          <span key={inv.id} className="text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2.5 py-1 rounded-full">
                            + {inv.quantity_borrowed} {inv.inventory?.item_name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-slate-700/50">
                    {schedule.booking?.vendors && schedule.booking.vendors.length > 0 && (
                      <button 
                        onClick={() => setSelectedScheduleForGatepass(schedule)}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold py-2.5 rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                        Buka Gatepass Vendor
                      </button>
                    )}

                    <button 
                      onClick={() => setSelectedScheduleForInv(schedule)}
                      className="w-full bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium py-2.5 rounded-xl transition-all"
                    >
                      Kelola Inventaris
                    </button>

                    {isPastEvent ? (
                      schedule.booking?.inspectionReport ? (
                        <div className="w-full bg-green-500/10 text-green-400 text-center text-sm font-medium py-2.5 rounded-xl border border-green-500/20">
                          BAP Telah Dilaporkan
                        </div>
                      ) : (
                        <button 
                          onClick={() => setSelectedScheduleForBap(schedule)}
                          className="w-full bg-red-600 hover:bg-red-700 text-white text-sm font-bold py-2.5 rounded-xl shadow-lg shadow-red-500/20 transition-all animate-pulse"
                        >
                          Buat Laporan BAP
                        </button>
                      )
                    ) : (
                      <div className="w-full bg-slate-900/50 text-slate-500 text-center text-xs font-medium py-2.5 rounded-xl border border-slate-800">
                        Acara Belum Selesai (BAP Dikunci)
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedScheduleForInv && (
        <InventoryModal 
          schedule={selectedScheduleForInv} 
          onClose={() => { setSelectedScheduleForInv(null); fetchRoster(); }} 
        />
      )}

      {selectedScheduleForBap && (
        <BapModal 
          schedule={selectedScheduleForBap} 
          onClose={() => { setSelectedScheduleForBap(null); fetchRoster(); }} 
        />
      )}

      {selectedScheduleForGatepass && (
        <GatepassModal 
          schedule={selectedScheduleForGatepass} 
          onClose={() => { setSelectedScheduleForGatepass(null); fetchRoster(); }} 
        />
      )}
    </div>
  );
}
