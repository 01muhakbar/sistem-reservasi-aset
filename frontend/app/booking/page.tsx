'use client';
import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { differenceInCalendarDays, format } from "date-fns";
export default function BookingPage() {
  const { user, token, isAuthenticated } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const reschedule_id = searchParams.get('reschedule_id');
  
  const [defaultVenueId, setDefaultVenueId] = useState<string>('');
  const [sopText, setSopText] = useState<string>('Memuat SOP...');

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
    
    // Ambil default venue ID
    fetch('http://localhost:5000/api/seed-data')
      .then(res => res.json())
      .then(data => {
        if (data.venue) {
          setDefaultVenueId(data.venue.id);
        }
      })
      .catch(err => console.error(err));

    // Fetch SOP
    fetch('http://localhost:5000/api/settings/sop_text')
      .then(res => res.json())
      .then(data => {
        if (data.data?.value) setSopText(data.data.value);
      })
      .catch(err => console.error(err));
      
    if (reschedule_id) {
      fetch(`http://localhost:5000/api/bookings/my-bookings`, { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
          const target = data.data?.find((b: any) => b.id === reschedule_id);
          if (target) {
            setFormData(prev => ({
              ...prev,
              eventName: target.event_name
            }));
            if (target.vendors && target.vendors.length > 0) {
              setUseExternalVendor(true);
              setVendors(target.vendors.map((v: any) => ({
                category: v.vendor_category,
                name: v.vendor_name,
                pic_name: v.pic_name,
                pic_phone: v.pic_phone
              })));
            }
            setAgreedToTOS(true);
            setStep(1); 
          }
        })
        .catch(err => console.error(err));
    }
  }, [isAuthenticated, router, reschedule_id]);

  const [step, setStep] = useState(0);
  const [agreedToTOS, setAgreedToTOS] = useState(false);
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const [startDate, endDate] = dateRange;

  const [formData, setFormData] = useState({
    eventName: '',
    actualEventStart: '08:00',
    actualEventEnd: '17:00',
    rehearsalDate: '',
    rehearsalStartTime: '13:00',
    rehearsalEndTime: '15:00',
    documentUrl: '',
    fileName: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [bookingCode, setBookingCode] = useState('');
  const [bookingId, setBookingId] = useState('');
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  
  // Gladi State
  const [useGladi, setUseGladi] = useState(false);

  // Vendor State
  const [useExternalVendor, setUseExternalVendor] = useState(false);
  const [vendorPending, setVendorPending] = useState(false);
  const [vendors, setVendors] = useState<{ category: string, name: string, pic_name: string, pic_phone: string }[]>([]);
  const [vendorSchedules, setVendorSchedules] = useState<any[]>([]);
  
  // Timer TTL State
  const [timeLeft, setTimeLeft] = useState<number>(15 * 60); // 15 minutes
  
  // Toast State
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'error' | 'info' }>({ show: false, message: '', type: 'info' });
  const showToast = (message: string, type: 'error' | 'info' = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 5000);
  };

  const isVendorValid = !useExternalVendor || vendorPending || (vendors.length > 0 && vendors.every(v => v.category && v.name && v.pic_name && v.pic_phone));

  const handleNext = () => {
    if (step === 0 && agreedToTOS) {
      setStep(1);
    } else if (step === 1 && startDate && isVendorValid) {
      setStep(2);
    }
  };

  // Timer Effect
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === 3 && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (step === 3 && timeLeft === 0) {
      // Waktu habis, reset form
      setStep(0);
      setAgreedToTOS(false);
      setBookingId('');
      setFormData({ eventName: '', mainEventDate: '', rehearsalDate: '', documentUrl: '', fileName: '' });
      setFileToUpload(null);
      setTimeLeft(15 * 60);
      showToast('Sesi Anda telah kedaluwarsa. Jadwal telah dibebaskan. Silakan ulangi pengajuan.', 'error');
    }
    return () => clearInterval(timer);
  }, [step, timeLeft]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleLockSchedule = async () => {
    setIsSubmitting(true);
    try {
      if (!user) return;
      
      // Guard Clause - Validasi Dinamis Gladi Resik
      if (useGladi && (!formData.rehearsalDate || !formData.rehearsalStartTime || !formData.rehearsalEndTime)) {
        showToast('Data jadwal gladi wajib diisi jika opsi diaktifkan.', 'error');
        setIsSubmitting(false);
        return;
      }
      
      const payload = {
        user_id: user.id,
        event_name: formData.eventName,
        main_event_venue_id: defaultVenueId, 
        main_event_start: startDate ? new Date(`${format(startDate, 'yyyy-MM-dd')}T00:01:00`).toISOString() : '',
        main_event_end: (endDate || startDate) ? new Date(`${format(endDate || startDate || new Date(), 'yyyy-MM-dd')}T23:59:00`).toISOString() : '',
        actual_event_start: formData.actualEventStart,
        actual_event_end: formData.actualEventEnd,
        rehearsal_venue_id: useGladi ? defaultVenueId : null, 
        rehearsal_start: (useGladi && formData.rehearsalDate) ? new Date(`${formData.rehearsalDate}T${formData.rehearsalStartTime}:00`).toISOString() : null,
        rehearsal_end: (useGladi && formData.rehearsalDate) ? new Date(`${formData.rehearsalDate}T${formData.rehearsalEndTime}:00`).toISOString() : null,
        agreed_to_tos: true,
        vendors: vendorPending ? [] : (useExternalVendor ? vendors : []),
        pending_vendor_submission: vendorPending,
        previous_booking_id: bookingId || undefined
      };

      if (!defaultVenueId) {
        showToast('Gagal memuat data gedung (Venue ID). Coba muat ulang halaman.', 'error');
        setIsSubmitting(false);
        return;
      }

      const endpoint = reschedule_id 
        ? `http://localhost:5000/api/bookings/${reschedule_id}/reschedule` 
        : 'http://localhost:5000/api/schedules/lock';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (res.ok) {
        if (reschedule_id) {
          showToast('Jadwal pengganti berhasil diserahkan!', 'info');
          router.push('/user/dashboard');
          return;
        }
        setBookingId(data.data.booking.id);
        setVendorSchedules(data.data.vendorSchedules || []);
        setTimeLeft(15 * 60);
        setStep(3);
      } else {
        showToast(data.error || 'Gagal mengunci jadwal.', 'error');
      }
    } catch (e) {
      showToast('Terjadi kesalahan jaringan.', 'error');
    }
    setIsSubmitting(false);
  };

  const getMaxRehearsalDate = () => {
    if (!startDate) return undefined;
    const main = new Date(startDate);
    main.setDate(main.getDate() - 1);
    return main.toISOString().split('T')[0];
  };

  const isRehearsalInvalid = !!(useGladi && formData.rehearsalDate && startDate && new Date(formData.rehearsalDate) >= startDate);

  const isStep2Valid = useGladi 
    ? formData.rehearsalDate && formData.rehearsalStartTime && formData.rehearsalEndTime && !isRehearsalInvalid
    : true;

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Pengajuan Reservasi</h1>
        <p className="text-slate-400">Ikuti langkah-langkah berikut untuk mengamankan jadwal Anda.</p>
      </div>

      {/* Progress Bar */}
      <div className="flex items-center justify-between mb-8 relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-800 -z-10 rounded"></div>
        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-blue-500 -z-10 rounded transition-all duration-300" style={{ width: step === 1 ? '33%' : step === 2 ? '66%' : '100%' }}></div>
        
        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= 1 ? 'premium-gradient text-white shadow-lg shadow-blue-500/30' : 'bg-slate-800 text-slate-400'}`}>1</div>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= 2 ? 'premium-gradient text-white shadow-lg shadow-blue-500/30' : 'bg-slate-800 text-slate-400'}`}>2</div>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= 3 ? 'premium-gradient text-white shadow-lg shadow-blue-500/30' : 'bg-slate-800 text-slate-400'}`}>3</div>
      </div>

      <div className="glass-card rounded-2xl p-6 md:p-8">
        {step === 0 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <h2 className="text-xl font-semibold mb-4 text-white">SOP & Tata Tertib Penggunaan Gedung</h2>
              <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-4 h-64 overflow-y-auto text-sm text-slate-300 shadow-inner prose prose-invert prose-sm max-w-none">
                <ReactMarkdown>{sopText}</ReactMarkdown>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <input 
                type="checkbox" 
                id="tos_agree"
                checked={agreedToTOS}
                onChange={(e) => setAgreedToTOS(e.target.checked)}
                className="mt-1 w-5 h-5 rounded border-slate-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900 bg-slate-800"
              />
              <label htmlFor="tos_agree" className="text-sm text-slate-300 cursor-pointer">
                Saya menyatakan telah membaca, memahami, dan menyetujui seluruh Standar Operasional Prosedur (SOP) serta bersedia menanggung konsekuensi hukum atas pelanggaran aturan di atas.
              </label>
            </div>

            <button 
              onClick={handleNext}
              disabled={!agreedToTOS}
              className="w-full premium-gradient px-4 py-3 rounded-xl font-medium text-white shadow-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Setuju dan Lanjutkan
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <h2 className="text-xl font-semibold mb-4 text-white">Detail Acara (Hari H)</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Nama Acara</label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="Contoh: Seminar Nasional"
                    value={formData.eventName}
                    onChange={e => setFormData({...formData, eventName: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Tanggal Hari H</label>
                  <DatePicker
                    selectsRange={true}
                    startDate={startDate || undefined}
                    endDate={endDate || undefined}
                    onChange={(update) => setDateRange(update as [Date | null, Date | null])}
                    minDate={new Date()}
                    maxDate={new Date(new Date().setMonth(new Date().getMonth() + 6))}
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholderText="Pilih rentang tanggal acara"
                    dateFormat="dd/MM/yyyy"
                    wrapperClassName="w-full"
                  />
                  {startDate && (
                    <div className="mt-2 flex items-center gap-2 text-sm text-blue-400 bg-blue-950/30 p-2.5 rounded-lg border border-blue-900/50">
                      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {endDate && endDate.getTime() !== startDate.getTime() ? `Eksklusif ${differenceInCalendarDays(endDate, startDate) + 1} Hari Penuh (00:01 - 23:59)` : 'Eksklusif 1 Hari Penuh (00:01 - 23:59)'}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Waktu Mulai Acara</label>
                    <input 
                      type="time" 
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      value={formData.actualEventStart}
                      onChange={e => setFormData({...formData, actualEventStart: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Waktu Selesai Acara</label>
                    <input 
                      type="time" 
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      value={formData.actualEventEnd}
                      onChange={e => setFormData({...formData, actualEventEnd: e.target.value})}
                    />
                  </div>
                </div>
                <div className="text-sm text-slate-500 italic">
                  Catatan: Waktu ini digunakan sebagai acuan operasional dan jadwal bongkar-muat (loading) vendor logistik. Fasilitas tetap diblokir secara eksklusif untuk Anda selama satu hari penuh.
                </div>
              </div>
            </div>

            {/* Vendor Form Toggle */}
            <div className="pt-4 border-t border-slate-700/50">
              <label className="flex items-center gap-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={useExternalVendor}
                  onChange={e => setUseExternalVendor(e.target.checked)}
                  className="w-5 h-5 rounded border-slate-700 text-blue-500 focus:ring-blue-500 bg-slate-800"
                />
                <span className="text-sm font-medium text-slate-300">Apakah acara ini menggunakan vendor logistik dari luar Unhas?</span>
              </label>
              {useExternalVendor && (
                <div className="mt-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={vendorPending}
                      onChange={e => setVendorPending(e.target.checked)}
                      className="mt-0.5 w-5 h-5 rounded border-yellow-700 text-yellow-500 focus:ring-yellow-500 bg-yellow-900/50"
                    />
                    <div className="text-sm text-yellow-200">
                      <span className="font-bold block text-yellow-400">Detail vendor belum tersedia (Akan diisi maksimal H-14 acara)</span>
                      Jika Anda belum menyewa vendor secara spesifik hari ini, centang opsi ini. Anda dapat menyusul mengisinya di dashboard nanti. Kegagalan melengkapi data hingga H-3 akan membatalkan izin masuk kendaraan vendor.
                    </div>
                  </label>
                </div>
              )}

              {useExternalVendor && !vendorPending && (
                <div className="mt-4 space-y-4">
                  {vendors.map((vendor, index) => (
                    <div key={index} className="bg-slate-900/50 border border-slate-700 rounded-xl p-4 relative animate-in zoom-in-95 duration-200">
                      <button 
                        onClick={() => setVendors(vendors.filter((_, i) => i !== index))}
                        className="absolute top-2 right-2 text-red-400 hover:text-red-300"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">Kategori Vendor</label>
                          <select 
                            value={vendor.category}
                            onChange={(e) => {
                              const newVendors = [...vendors];
                              newVendors[index].category = e.target.value;
                              setVendors(newVendors);
                            }}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm outline-none"
                          >
                            <option value="">Pilih Kategori</option>
                            <option value="RIGGING">Rigging</option>
                            <option value="LED_VIDEOTRON">LED Videotron</option>
                            <option value="SOUND_SYSTEM">Sound System</option>
                            <option value="LIGHTING">Lighting</option>
                            <option value="SUPPORT_EQUIPMENT">Tenda / AC</option>
                            <option value="DECORATION">Dekorasi</option>
                            <option value="CATERING">Katering</option>
                            <option value="DOCUMENTATION">Dokumentasi</option>
                            <option value="ENTERTAINMENT">Hiburan</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">Nama Perusahaan / Vendor</label>
                          <input 
                            type="text" 
                            value={vendor.name}
                            onChange={(e) => {
                              const newVendors = [...vendors];
                              newVendors[index].name = e.target.value;
                              setVendors(newVendors);
                            }}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm outline-none"
                            placeholder="PT. Suka Maju"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">Nama PIC</label>
                          <input 
                            type="text" 
                            value={vendor.pic_name}
                            onChange={(e) => {
                              const newVendors = [...vendors];
                              newVendors[index].pic_name = e.target.value;
                              setVendors(newVendors);
                            }}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm outline-none"
                            placeholder="Budi"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">No. HP/WA</label>
                          <input 
                            type="text" 
                            value={vendor.pic_phone}
                            onChange={(e) => {
                              const newVendors = [...vendors];
                              newVendors[index].pic_phone = e.target.value;
                              setVendors(newVendors);
                            }}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm outline-none"
                            placeholder="0812..."
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <button 
                    onClick={() => setVendors([...vendors, { category: '', name: '', pic_name: '', pic_phone: '' }])}
                    className="w-full border border-dashed border-slate-600 hover:border-blue-500 hover:bg-blue-500/10 text-slate-400 hover:text-blue-400 py-3 rounded-xl flex items-center justify-center gap-2 transition-all text-sm font-medium"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Tambah Vendor Eksternal
                  </button>
                </div>
              )}
            </div>
            
            <button 
              onClick={handleNext}
              disabled={!startDate || !formData.eventName || !isVendorValid}
              className="w-full premium-gradient px-4 py-3 rounded-xl font-medium text-white shadow-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Lanjutkan
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4 flex gap-4">
              <div className="mt-1">
                <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-blue-100 mb-1">Pilih Jadwal Gladi Resik / Persiapan</h3>
                <p className="text-sm text-blue-200/70">
                  Opsional: Jika Anda membutuhkan hari khusus untuk gladi resik (H-1) sebelum Hari H, silakan aktifkan opsi di bawah ini.
                </p>
                <div className="mt-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={useGladi}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setUseGladi(checked);
                        // Ghost Data Cleanup
                        if (!checked) {
                          setFormData({
                            ...formData,
                            rehearsalDate: '',
                            rehearsalStartTime: '13:00',
                            rehearsalEndTime: '15:00'
                          });
                        }
                      }}
                      className="w-4 h-4 rounded border-slate-700 text-blue-500 focus:ring-blue-500 bg-slate-800"
                    />
                    <span className="text-sm font-medium text-slate-200">Tambahkan Jadwal Gladi Resik (H-1)</span>
                  </label>
                </div>
              </div>
            </div>

            {useGladi && (
              <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Tanggal Gladi Resik</label>
                  <input 
                    type="date" 
                    min={new Date().toISOString().split('T')[0]}
                    max={getMaxRehearsalDate()}
                    className={`w-full bg-slate-900/50 border rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all ${isRehearsalInvalid ? 'border-red-500/80 ring-1 ring-red-500/50' : 'border-slate-700'}`}
                    value={formData.rehearsalDate}
                    onChange={e => setFormData({...formData, rehearsalDate: e.target.value})}
                  />
                  {isRehearsalInvalid && (
                    <p className="text-red-500 text-sm mt-2 flex items-center gap-1.5 font-medium">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Tanggal Gladi Resik harus sebelum Hari H.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Jam Mulai</label>
                    <input 
                      type="time" 
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      value={formData.rehearsalStartTime}
                      onChange={e => setFormData({...formData, rehearsalStartTime: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Jam Selesai</label>
                    <input 
                      type="time" 
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      value={formData.rehearsalEndTime}
                      onChange={e => setFormData({...formData, rehearsalEndTime: e.target.value})}
                    />
                  </div>
                </div>

                {formData.rehearsalStartTime && formData.rehearsalEndTime && (
                  <div className="bg-blue-500/10 border-l-4 border-blue-500 p-4 rounded-r-lg">
                    <div className="flex gap-3">
                      <svg className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm text-blue-200">
                        Anda menyewa dari jam <strong>{formData.rehearsalStartTime} - {formData.rehearsalEndTime}</strong>. 
                        Sistem otomatis mengalokasikan jeda sterilisasi ruangan 30 menit sebelum dan 60 menit setelah jam yang Anda pilih.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            <div className="flex gap-4">
              <button 
                onClick={() => setStep(1)}
                className="w-1/3 bg-slate-800 hover:bg-slate-700 px-4 py-3 rounded-xl font-medium text-white transition-colors"
              >
                Kembali
              </button>
              <button 
                onClick={handleLockSchedule}
                disabled={!isStep2Valid || isSubmitting}
                className="w-2/3 premium-gradient px-4 py-3 rounded-xl font-medium text-white shadow-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : 'Cek Ketersediaan Ganda'}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-4 flex items-center gap-4 mb-4">
               <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
               </div>
               <div>
                  <h3 className="font-semibold text-green-100">Ketersediaan Dikonfirmasi!</h3>
                  <p className="text-sm text-green-200/70">Jadwal Gladi Resik dan Hari H Anda telah dikunci sementara.</p>
               </div>
               <div className="ml-auto bg-slate-900/50 rounded-lg px-3 py-1 border border-green-500/30 text-center shadow-inner">
                  <span className="text-[10px] text-green-400 font-bold uppercase tracking-wider block mb-0.5">Sisa Waktu</span>
                  <span className={`text-xl font-mono font-bold tracking-widest ${timeLeft < 300 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
                    {formatTime(timeLeft)}
                  </span>
               </div>
             </div>

            {/* Vendor Timeline Summary */}
            {vendorSchedules.length > 0 && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <h3 className="font-semibold text-yellow-100">Peringatan: Jadwal Logistik Vendor</h3>
                </div>
                <div className="space-y-3">
                  {vendorSchedules.map((vs, i) => (
                    <div key={i} className="flex justify-between items-center text-sm bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                      <div>
                        <span className="font-bold text-blue-300 block mb-1">{vs.vendor_category.replace('_', ' ')}</span>
                        <span className="text-slate-300">{vs.vendor_name} (PIC: {vs.pic_name})</span>
                      </div>
                      <div className="text-right text-slate-400">
                        <span className="block text-xs mb-1">Loading: <strong className="text-green-400">{new Date(vs.loading_start).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</strong></span>
                        <span className="block text-xs">Unloading: <strong className="text-red-400">{new Date(vs.unloading_end).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

             <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Unggah Surat Permohonan (PDF)</label>
                <div 
                  className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center hover:bg-slate-800/50 transition-colors cursor-pointer relative"
                  onClick={() => document.getElementById('file-upload')?.click()}
                >
                  <input 
                    type="file" 
                    id="file-upload" 
                    accept=".pdf" 
                    className="hidden" 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setFileToUpload(file);
                        setFormData({...formData, fileName: file.name});
                      }
                    }}
                  />
                  <svg className="w-10 h-10 text-slate-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  {formData.fileName ? (
                    <p className="text-sm font-medium text-blue-400">{formData.fileName}</p>
                  ) : (
                    <p className="text-sm text-slate-400">Klik untuk memilih file PDF atau seret ke sini</p>
                  )}
                </div>
             </div>

             <div className="flex gap-4">
              <button 
                onClick={() => setStep(2)}
                className="w-1/3 bg-slate-800 hover:bg-slate-700 px-4 py-3 rounded-xl font-medium text-white transition-colors"
              >
                Kembali
              </button>
              <button 
                onClick={async () => {
                  if (!fileToUpload) {
                    showToast('Harap unggah surat permohonan terlebih dahulu.', 'error');
                    return;
                  }
                  
                  setIsSubmitting(true);
                  try {
                    // Upload file first
                    const uploadData = new FormData();
                    uploadData.append('file', fileToUpload);
                    
                    const uploadRes = await fetch('http://localhost:5000/api/upload', {
                      method: 'POST',
                      body: uploadData,
                      credentials: 'include'
                    });
                    
                    if (!uploadRes.ok) throw new Error('Gagal mengunggah file');
                    const { url } = await uploadRes.json();

                    // Finalize Booking
                    const res = await fetch(`http://localhost:5000/api/bookings/${bookingId}/finalize`, {
                      method: 'PUT',
                      headers: { 
                        'Content-Type': 'application/json'
                      },
                      credentials: 'include',
                      body: JSON.stringify({ document_url: url })
                    });
                    
                    const data = await res.json();
                    if (res.ok) {
                      setBookingCode(data.data.booking_code);
                      setShowSuccessModal(true);
                    } else {
                      showToast('Gagal: ' + data.error, 'error');
                    }
                  } catch (e) {
                    showToast('Terjadi kesalahan koneksi.', 'error');
                  }
                  setIsSubmitting(false);
                }}
                disabled={isSubmitting || !fileToUpload}
                className="w-2/3 premium-gradient px-4 py-3 rounded-xl font-medium text-white shadow-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center"
              >
                {isSubmitting ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : 'Submit Pengajuan'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Success Modal Overlay */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="glass-card max-w-md w-full rounded-2xl p-8 text-center relative overflow-hidden animate-in zoom-in-95 duration-500">
            {/* Background Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-green-500/20 blur-[50px] -z-10 rounded-full" />
            
            <div className="w-20 h-20 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(34,197,94,0.3)]">
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            
            <h3 className="text-2xl font-bold text-white mb-2">Reservasi Berhasil!</h3>
            <p className="text-slate-400 mb-6">
              Jadwal Anda telah diamankan. Silakan tunggu verifikasi dan persetujuan dari Kasubdit.
            </p>
            
            <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 mb-8">
              <p className="text-xs text-slate-500 mb-1 uppercase tracking-wider font-semibold">Unified Booking ID</p>
              <p className="text-xl font-mono font-bold text-blue-400 tracking-wide">{bookingCode}</p>
            </div>
            
            <button
              onClick={() => window.location.href = '/user/dashboard'}
              className="w-full premium-gradient px-6 py-3.5 rounded-xl font-medium text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 transition-all"
            >
              Kembali ke Ruang Kerja Saya
            </button>
          </div>
        </div>
      )}

      {/* Premium Toast Notification (Untuk Timeout / Error) */}
      <div 
        className={`fixed bottom-8 right-8 z-[100] transition-all duration-500 ease-out transform ${
          toast.show ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-10 opacity-0 scale-95 pointer-events-none'
        }`}
      >
        <div className="glass-card px-5 py-3 rounded-2xl shadow-xl flex items-center gap-4 bg-slate-900/95 backdrop-blur-xl border border-slate-700/50">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
            toast.type === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
          }`}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={toast.type === 'error' ? 'M6 18L18 6M6 6l12 12' : 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'} />
            </svg>
          </div>
          <div>
            <h4 className="text-white font-bold text-sm tracking-wide">
              {toast.type === 'error' ? 'Peringatan' : 'Informasi'}
            </h4>
            <p className="text-slate-400 text-sm max-w-xs">{toast.message}</p>
          </div>
          <button 
            onClick={() => setToast(prev => ({ ...prev, show: false }))}
            className="ml-2 p-1.5 hover:bg-slate-800 rounded-full text-slate-500 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
