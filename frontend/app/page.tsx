'use client';
import React, { useState, useEffect } from 'react';

export default function CalendarPage() {
  const [allSchedules, setAllSchedules] = useState<any[]>([]);
  const [bookedDays, setBookedDays] = useState<number[]>([]);
  const [pendingDays, setPendingDays] = useState<number[]>([]);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  
  const [currentDate, setCurrentDate] = useState(new Date('2026-09-01')); // Using Sep 2026 as starting point as per instruction context
  const MAX_MONTHS_AHEAD = 6;
  const today = new Date('2026-09-01');

  // Tracking State
  const [trackCode, setTrackCode] = useState('');
  const [trackResult, setTrackResult] = useState<any | null>(null);
  const [trackError, setTrackError] = useState('');
  const [isTracking, setIsTracking] = useState(false);

  useEffect(() => {
    fetch('http://localhost:5000/api/schedules/availability')
      .then(res => res.json())
      .then(data => {
        const schedules = data.data || [];
        setAllSchedules(schedules);
        updateCalendar(schedules, currentDate);
      })
      .catch(err => console.error(err));
  }, []);

  const updateCalendar = (schedules: any[], targetDate: Date) => {
    const booked: number[] = [];
    const pending: number[] = [];
    
    schedules.forEach((schedule: any) => {
      const date = new Date(schedule.start_time);
      if (date.getMonth() === targetDate.getMonth() && date.getFullYear() === targetDate.getFullYear()) {
        const day = date.getDate();
        if (schedule.status === 'confirmed') {
          booked.push(day);
        } else if (schedule.status === 'locked' || schedule.status === 'locked_temporary') {
          pending.push(day);
        }
      }
    });
    
    setBookedDays(booked);
    setPendingDays(pending);
    setSelectedDay(null);
  };

  const handlePrevMonth = () => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    setCurrentDate(newDate);
    updateCalendar(allSchedules, newDate);
  };

  const handleNextMonth = () => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    setCurrentDate(newDate);
    updateCalendar(allSchedules, newDate);
  };

  const monthsDifference = (currentDate.getFullYear() - today.getFullYear()) * 12 + currentDate.getMonth() - today.getMonth();
  const isNextDisabled = monthsDifference >= MAX_MONTHS_AHEAD;

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const getSchedulesForDay = (day: number) => {
    return allSchedules.filter(s => {
      const d = new Date(s.start_time);
      return d.getDate() === day && d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear();
    });
  };

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackCode) return;
    
    setIsTracking(true);
    setTrackError('');
    setTrackResult(null);

    try {
      const res = await fetch(`http://localhost:5000/api/bookings/track/${trackCode}`);
      const data = await res.json();
      
      if (res.ok) {
        setTrackResult(data.data);
      } else {
        setTrackError(data.error || 'Tiket tidak ditemukan.');
      }
    } catch (err) {
      setTrackError('Terjadi kesalahan jaringan.');
    }
    setIsTracking(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Hero Section */}
      <div className="text-center mb-16 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-blue-600/20 blur-[100px] -z-10 rounded-full" />
        <h1 className="text-4xl md:text-5xl font-extrabold mb-4 tracking-tight">
          Cek Ketersediaan <br className="hidden md:block" />
          <span className="premium-text-gradient">Baruga A.P. Pettarani</span>
        </h1>
        <p className="text-slate-400 max-w-2xl mx-auto text-lg">
          Sistem informasi reservasi fasilitas terintegrasi. Pastikan jadwal kegiatan Anda dan 
          gladi resik tersedia sebelum mengajukan permohonan.
        </p>
        <div className="mt-8 flex flex-col md:flex-row items-center justify-center gap-4">
          <a href="/booking" className="premium-gradient px-8 py-3.5 rounded-full text-white font-bold shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 transition-all inline-flex items-center gap-2">
            Mulai Pengajuan Baru
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </a>
        </div>

        {/* Cek Status Pengajuan (Quick Tracking) */}
        <div className="max-w-2xl mx-auto mt-12 bg-slate-900/60 backdrop-blur-md p-6 rounded-3xl border border-slate-700/50 shadow-2xl">
          <h3 className="text-lg font-semibold text-white mb-4 text-left flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Lacak Status Pengajuan
          </h3>
          <form onSubmit={handleTrack} className="flex flex-col sm:flex-row gap-3">
            <input 
              type="text" 
              placeholder="Masukkan ID Tiket (Cth: BRG-2026...)"
              className="flex-grow bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-500"
              value={trackCode}
              onChange={(e) => setTrackCode(e.target.value)}
            />
            <button 
              type="submit"
              disabled={isTracking || !trackCode}
              className="bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-xl font-medium text-white transition-all disabled:opacity-50 whitespace-nowrap flex items-center justify-center min-w-[120px]"
            >
              {isTracking ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : 'Lacak Tiket'}
            </button>
          </form>

          {trackError && <p className="text-red-400 text-sm text-left mt-3">{trackError}</p>}

          {/* Stepper Result */}
          {trackResult && (
            <div className="mt-8 pt-6 border-t border-slate-700/50">
              <div className="flex flex-col items-center mb-6 text-center">
                <span className="text-sm text-slate-400 mb-1">Hasil Pelacakan untuk:</span>
                <span className="text-xl font-mono font-bold text-blue-400">{trackResult.booking_code}</span>
                <span className="text-md font-medium text-white mt-1">{trackResult.event_name}</span>
                <span className="text-xs text-slate-500 mt-1">Diajukan pada {new Date(trackResult.created_at).toLocaleDateString('id-ID')}</span>
              </div>

            <div className="relative mb-12 mt-4 w-full">
              <div className="flex justify-between relative z-10 w-full">
                {/* Step 1 */}
                <div className="flex flex-col items-center flex-1 relative">
                  {/* Connecting Line to next step */}
                  <div className="absolute top-5 left-[50%] w-full h-1 bg-slate-700 -z-10 rounded-r-full"></div>
                  <div className={`absolute top-5 left-[50%] h-1 bg-blue-500 -z-10 rounded-r-full transition-all duration-700`} style={{ width: '100%' }}></div>
                  
                  <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold shadow-[0_0_15px_rgba(59,130,246,0.5)] mb-2 border-4 border-slate-900">1</div>
                  <span className="text-xs font-medium text-blue-400 text-center whitespace-nowrap">Diajukan</span>
                </div>

                {/* Step 2 */}
                <div className="flex flex-col items-center flex-1 relative">
                  {/* Connecting Line to next step */}
                  <div className="absolute top-5 left-[50%] w-full h-1 bg-slate-700 -z-10 rounded-r-full"></div>
                  <div className={`absolute top-5 left-[50%] h-1 bg-blue-500 -z-10 rounded-r-full transition-all duration-700`} style={{ width: trackResult.status === 'pending' ? '0%' : '100%' }}></div>
                  
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold mb-2 border-4 border-slate-900 transition-colors ${trackResult.status === 'pending' ? 'bg-slate-800 text-blue-400 border-blue-500/30' : 'bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]'}`}>2</div>
                  <span className={`text-xs font-medium text-center whitespace-nowrap ${trackResult.status === 'pending' ? 'text-blue-300' : 'text-blue-400'}`}>Verifikasi Kasubdit</span>
                </div>

                {/* Step 3 */}
                <div className="flex flex-col items-center flex-1 relative">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold mb-2 border-4 border-slate-900 transition-colors ${
                    trackResult.status === 'approved' ? 'bg-green-500 text-white shadow-[0_0_15px_rgba(34,197,94,0.5)] border-green-500/20' :
                    trackResult.status === 'rejected' ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)] border-red-500/20' :
                    trackResult.status === 'revoked' ? 'bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.5)] border-purple-500/20' :
                    'bg-slate-800 text-slate-500'
                  }`}>
                    {trackResult.status === 'approved' || trackResult.status === 'rejected' || trackResult.status === 'revoked' ? '3' : '?'}
                  </div>
                  <span className={`text-xs font-medium text-center whitespace-nowrap ${
                    trackResult.status === 'approved' ? 'text-green-400' :
                    trackResult.status === 'rejected' ? 'text-red-400' :
                    trackResult.status === 'revoked' ? 'text-purple-400' :
                    'text-slate-500'
                  }`}>
                    {trackResult.status === 'approved' ? 'Disetujui' : 
                     trackResult.status === 'rejected' ? 'Ditolak' : 
                     trackResult.status === 'revoked' ? 'Dicabut' : 'Keputusan'}
                  </span>
                </div>
              </div>
            </div>
            </div>
          )}
        </div>
      </div>

      {/* Calendar Interface */}
      <div className="glass-card rounded-2xl p-6 md:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/10 blur-[80px] -z-10 rounded-full" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div className="flex items-center gap-4">
            <button onClick={handlePrevMonth} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h2 className="text-2xl font-bold min-w-[240px] whitespace-nowrap text-center">{currentDate.toLocaleString('id-ID', { month: 'long', year: 'numeric' })}</h2>
            <button onClick={handleNextMonth} disabled={isNextDisabled} className="p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-slate-300">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-slate-700"></div> Tersedia</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-yellow-500"></div> Menunggu Persetujuan</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500"></div> Telah Dipesan</div>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2 md:gap-4 text-center mb-4 text-slate-400 font-medium">
          <div>Min</div><div>Sen</div><div>Sel</div><div>Rab</div><div>Kam</div><div>Jum</div><div>Sab</div>
        </div>

        <div className="grid grid-cols-7 gap-2 md:gap-4">
          {/* Empty slots for start of month */}
          <div className="aspect-square rounded-xl p-2" />
          <div className="aspect-square rounded-xl p-2" />
          
          {days.map(day => {
            let statusClass = "bg-slate-800/50 border-slate-700 hover:bg-slate-700 hover:border-slate-500 cursor-pointer text-slate-300";
            if (bookedDays.includes(day)) {
              statusClass = "bg-red-950/40 border-red-900/50 text-red-400 cursor-not-allowed";
            } else if (pendingDays.includes(day)) {
              statusClass = "bg-yellow-950/40 border-yellow-900/50 text-yellow-400 cursor-not-allowed";
            }

            return (
              <div 
                key={day} 
                onClick={() => setSelectedDay(day)}
                className={`aspect-square rounded-xl border flex flex-col items-center justify-center transition-all ${statusClass} ${selectedDay === day ? 'ring-4 ring-blue-500 border-transparent z-10 scale-110' : ''}`}
              >
                <span className="text-lg md:text-xl font-semibold">{day}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Daily View Timeline */}
      {selectedDay && (
        <div className="mt-8 glass-card rounded-2xl p-6 md:p-8 animate-in fade-in slide-in-from-top-4 duration-500">
          <h2 className="text-2xl font-bold mb-6">Jadwal Harian: {selectedDay} September 2026</h2>
          
          <div className="flex gap-6 mb-8 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 rounded"></div>
              Waktu Acara Utama
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #3b82f6 0, #3b82f6 2px, transparent 2px, transparent 6px)' }}></div>
              Waktu Logistik / Sterilisasi (Otomatis)
            </div>
          </div>

          <div className="relative border-l-2 border-slate-700 ml-16 mt-4">
            {/* Hour grid lines */}
            {Array.from({ length: 15 }, (_, i) => i + 8).map(hour => (
              <div key={hour} className="relative h-16 border-t border-slate-800">
                <span className="absolute -left-16 -top-3 text-slate-400 font-mono">{hour.toString().padStart(2, '0')}:00</span>
              </div>
            ))}

            {/* Events overlay */}
            {getSchedulesForDay(selectedDay).map((schedule, idx) => {
              const start = new Date(schedule.start_time);
              const end = new Date(schedule.end_time);
              
              // Jika Hari H (main_event_fullday), render full block
              if (schedule.usage_type === 'main_event_fullday') {
                return (
                  <div 
                    key={idx}
                    className="absolute left-4 right-4 bg-red-500/80 border border-red-500 rounded-lg p-3 flex flex-col justify-center overflow-hidden"
                    style={{ top: '0px', height: `${15 * 64}px` }}
                  >
                    <h3 className="font-bold text-white text-lg">Eksklusif: {schedule.booking?.event_name || 'Acara Hari H'}</h3>
                    <p className="text-red-200 text-sm">Seluruh fasilitas disewa penuh seharian.</p>
                  </div>
                );
              }

              // Jika Gladi Resik, kalkulasi top dan height
              const startHour = start.getHours();
              const startMinute = start.getMinutes();
              const endHour = end.getHours();
              const endMinute = end.getMinutes();
              
              const topPx = (startHour - 8) * 64 + (startMinute / 60) * 64;
              const durationMins = (endHour - startHour) * 60 + (endMinute - startMinute);
              const heightPx = (durationMins / 60) * 64;
              
              const setupMins = schedule.setup_buffer_minutes || 0;
              const setupHeightPx = (setupMins / 60) * 64;
              
              const teardownMins = schedule.teardown_buffer_minutes || 0;
              const teardownHeightPx = (teardownMins / 60) * 64;

              return (
                <React.Fragment key={idx}>
                  {/* Setup Buffer */}
                  {setupMins > 0 && (
                    <div 
                      className="absolute left-4 right-4 border border-blue-500/30 rounded-t-lg opacity-80 flex items-center justify-center overflow-hidden"
                      style={{ 
                        top: `${topPx - setupHeightPx}px`, 
                        height: `${setupHeightPx}px`,
                        backgroundImage: 'repeating-linear-gradient(45deg, #1e3a8a 0, #1e3a8a 2px, transparent 2px, transparent 6px)'
                      }}
                    >
                      <span className="text-[10px] uppercase font-bold text-blue-200 tracking-wider">Persiapan Logistik ({setupMins}m)</span>
                    </div>
                  )}
                  
                  {/* Main Event */}
                  <div 
                    className={`absolute left-4 right-4 bg-red-500/90 border border-red-400 p-2 shadow-lg shadow-red-500/20 flex flex-col justify-center overflow-hidden z-10 ${setupMins > 0 ? '' : 'rounded-t-lg'} ${teardownMins > 0 ? '' : 'rounded-b-lg'}`}
                    style={{ top: `${topPx}px`, height: `${heightPx}px` }}
                  >
                    <h4 className="font-bold text-white text-sm leading-tight truncate">Gladi Resik: {schedule.booking?.event_name}</h4>
                    <span className="text-red-100 text-xs">{start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {end.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>

                  {/* Teardown Buffer */}
                  {teardownMins > 0 && (
                    <div 
                      className="absolute left-4 right-4 border border-blue-500/30 rounded-b-lg opacity-80 flex items-center justify-center overflow-hidden"
                      style={{ 
                        top: `${topPx + heightPx}px`, 
                        height: `${teardownHeightPx}px`,
                        backgroundImage: 'repeating-linear-gradient(45deg, #1e3a8a 0, #1e3a8a 2px, transparent 2px, transparent 6px)'
                      }}
                    >
                      <span className="text-[10px] uppercase font-bold text-blue-200 tracking-wider">Sterilisasi Ruangan ({teardownMins}m)</span>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
