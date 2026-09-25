import React, { useState, useEffect } from 'react';

export default function InventoryModal({ schedule, onClose }: { schedule: any, onClose: () => void }) {
  const [inventories, setInventories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    fetchInventories();
    // Pre-fill allocations from existing data
    const existing = schedule.booking?.inventories || [];
    const allocMap: Record<string, number> = {};
    existing.forEach((inv: any) => {
      allocMap[inv.inventory_id] = inv.quantity_borrowed;
    });
    setAllocations(allocMap);
  }, [schedule]);

  const fetchInventories = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/operations/inventories', { credentials: 'include' });
      const data = await res.json();
      if (res.ok) setInventories(data.data || []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleAllocate = async (inventory_id: string) => {
    const qty = allocations[inventory_id] || 0;
    if (qty <= 0) return;

    setSaving(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch('http://localhost:5000/api/operations/inventories/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: schedule.booking_id,
          inventory_id,
          quantity: qty
        }),
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Gagal mengalokasikan inventaris.');
      } else {
        setSuccessMsg('Inventaris berhasil diperbarui!');
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (err) {
      setError('Kesalahan jaringan.');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="glass-card max-w-lg w-full rounded-3xl p-6 relative">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Kelola Inventaris Ekstra</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="mb-6 p-4 bg-slate-900/50 rounded-xl border border-slate-700">
          <p className="text-sm text-slate-400 mb-1">Acara:</p>
          <p className="font-semibold text-white">{schedule.booking?.event_name}</p>
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm p-3 rounded-xl mb-6 flex items-center gap-2"><svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{error}</div>}
        
        {successMsg && (
          <div className="bg-green-500/10 border border-green-500/30 text-green-400 text-sm p-3 rounded-xl mb-6 flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {successMsg}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center p-8"><div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div></div>
        ) : (
          <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
            {inventories.map(inv => (
              <div key={inv.id} className="flex items-center justify-between p-4 bg-slate-800/50 border border-slate-700 rounded-xl">
                <div>
                  <h4 className="font-semibold text-slate-200">{inv.item_name}</h4>
                  <p className="text-xs text-slate-400">Total Master: {inv.total_quantity}</p>
                </div>
                <div className="flex gap-2 items-center">
                  <input 
                    type="number"
                    min="0"
                    max={inv.total_quantity}
                    value={allocations[inv.id] || 0}
                    onChange={(e) => setAllocations({ ...allocations, [inv.id]: parseInt(e.target.value) || 0 })}
                    className="w-20 bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-1.5 text-center text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <button 
                    onClick={() => handleAllocate(inv.id)}
                    disabled={saving}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    Simpan
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
