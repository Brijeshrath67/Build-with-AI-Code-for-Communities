'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../../components/common/Sidebar';
<<<<<<< Updated upstream
import { getStock, updateStock, deleteStock } from '../../services/api';
=======
import { getStock, getAllStock, updateStock, deleteStock, getNetworkStatus } from '../../services/api';
>>>>>>> Stashed changes
import { useOfflineSync } from '../../hooks/useOfflineSync';

interface StockItem {
  id: number;
  phc_id: number;
  phc_name?: string;
  medicine: string;
  quantity: number;
  expiry_date: string;
  sync_status: string;
  updated_at: string;
}

<<<<<<< Updated upstream
=======
interface PhcOption {
  id: number;
  name: string;
  district: string;
  type: string;
  stocks?: StockItem[];
}

const normalizeStockItems = (items: any[]): StockItem[] =>
  (items || []).map((s, idx) => ({
    id: s.id ?? idx,
    phc_id: s.phc_id ?? 0,
    phc_name: s.phc_name,
    medicine: s.medicine,
    quantity: s.quantity,
    expiry_date: s.expiry_date,
    sync_status: s.sync_status ?? 'synced',
    updated_at: s.updated_at ?? '',
  }));

>>>>>>> Stashed changes
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const MEDICINE_OPTIONS = [
  'Paracetamol 500mg', 'Amoxicillin 500mg', 'Ibuprofen 400mg',
  'Cetirizine 10mg', 'Metformin 500mg', 'Ciprofloxacin 500mg',
];

export default function InventoryPage() {
  const router = useRouter();
  const [user, setUser]         = useState<any>(null);
  const [stocks, setStocks]     = useState<StockItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [successMsg, setSuccessMsg]   = useState('');
  const [errorMsg, setErrorMsg]       = useState('');
<<<<<<< Updated upstream
=======
  const [selectedPhcId, setSelectedPhcId] = useState<number | ''>('');
  const [phcList, setPhcList] = useState<PhcOption[]>([]);
  const [viewAllPhcs, setViewAllPhcs] = useState(false);
  const skipPhcChangeFetch = useRef(true);
>>>>>>> Stashed changes

  // ── Add / Update modal ──────────────────────────────────────────────────
  const [formOpen, setFormOpen]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ medicine: '', quantity: '', expiry_date: '' });

  // ── Delete confirmation modal ────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<StockItem | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError]       = useState('');
  const [deleting, setDeleting]             = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('phc_token') : null;
  const { isOnline, queueLength, isSyncing, addToQueue } = useOfflineSync(API_URL, token);

  useEffect(() => {
    const t = localStorage.getItem('phc_token');
    const s = localStorage.getItem('phc_user');
    if (!t) { router.push('/login'); return; }
    if (s) setUser(JSON.parse(s));
  }, []);

<<<<<<< Updated upstream
  useEffect(() => {
    if (!user?.phc_id) { setLoading(false); return; }
    fetchStock();
  }, [user]);

  const fetchStock = async () => {
    setLoading(true);
    try {
      const res = await getStock(user.phc_id);
      setStocks(res.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };
=======
  // ─── Fetch stock for a PHC (DB first, network snapshot as fallback) ───────
  const fetchStockForPhc = async (phcId: number, phcs?: PhcOption[]) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await getStock(phcId);
      setStocks(normalizeStockItems(res.data));
    } catch (err: any) {
      console.error('Failed to fetch stock:', err.response?.data || err.message);
      const list = phcs ?? phcList;
      const phc = list.find(p => p.id === phcId);
      if (phc?.stocks?.length) {
        setStocks(normalizeStockItems(phc.stocks));
      } else {
        setStocks([]);
        setErrorMsg('Could not load stock for this health facility.');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchAllStock = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await getAllStock();
      setStocks(normalizeStockItems(res.data));
    } catch (err: any) {
      console.error('Failed to fetch all PHC stock:', err.response?.data || err.message);
      setStocks([]);
      setErrorMsg('Could not load inventory for all PHCs.');
    } finally {
      setLoading(false);
    }
  };

  const refreshInventory = async () => {
    const phcId = Number(selectedPhcId);
    const isDistrictOrAdmin =
      user?.role === 'District Health Official' || user?.role === 'System Admin';

    if (isDistrictOrAdmin && viewAllPhcs) {
      await fetchAllStock();
      return;
    }

    if (!selectedPhcId) return;

    if (isDistrictOrAdmin) {
      try {
        const res = await getNetworkStatus();
        const list: PhcOption[] = res.data?.phcs || [];
        setPhcList(list);
        await fetchStockForPhc(phcId, list);
        return;
      } catch {
        /* fall through to direct stock fetch */
      }
    }

    await fetchStockForPhc(phcId);
  };

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    const isDistrictOrAdmin =
      user.role === 'District Health Official' || user.role === 'System Admin';

    (async () => {
      setLoading(true);
      setErrorMsg('');
      skipPhcChangeFetch.current = true;

      try {
        if (isDistrictOrAdmin) {
          const res = await getNetworkStatus();
          if (cancelled) return;

          const list: PhcOption[] = res.data?.phcs || [];
          setPhcList(list);

          if (list.length === 0) {
            setStocks([]);
            setLoading(false);
            return;
          }

          const initialPhcId = Number(list[0].id);
          setSelectedPhcId(initialPhcId);
          setStocks(normalizeStockItems(list[0].stocks || []));
          await fetchStockForPhc(initialPhcId, list);
        } else if (user.phc_id) {
          const phcId = Number(user.phc_id);
          setSelectedPhcId(phcId);

          // Load network snapshot for PHC name + fallback stock display
          let networkList: PhcOption[] = [];
          try {
            const netRes = await getNetworkStatus();
            if (cancelled) return;
            networkList = netRes.data?.phcs || [];
            setPhcList(networkList);
            const ownPhc = networkList.find(p => p.id === phcId);
            if (ownPhc?.stocks?.length) {
              setStocks(normalizeStockItems(ownPhc.stocks));
            }
          } catch {
            /* getStock below is the primary source */
          }

          await fetchStockForPhc(phcId, networkList);
        } else {
          setStocks([]);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          console.error('Failed to load inventory', e);
          setStocks([]);
          setErrorMsg('Failed to load inventory data. Please check if the backend is running.');
          setLoading(false);
        }
      } finally {
        if (!cancelled) {
          skipPhcChangeFetch.current = false;
        }
      }
    })();

    return () => { cancelled = true; };
  }, [user]);

  // Re-fetch when district official / admin switches PHC in the dropdown
  useEffect(() => {
    if (!selectedPhcId || !user || skipPhcChangeFetch.current) return;

    const isDistrictOrAdmin =
      user.role === 'District Health Official' || user.role === 'System Admin';
    if (!isDistrictOrAdmin) return;
    if (viewAllPhcs) return;

    const phcId = Number(selectedPhcId);
    const phc = phcList.find(p => p.id === phcId);
    if (phc?.stocks?.length) {
      setStocks(normalizeStockItems(phc.stocks));
    }
    fetchStockForPhc(phcId);
  }, [selectedPhcId, viewAllPhcs]);

>>>>>>> Stashed changes

  const flash = (type: 'ok' | 'err', msg: string) => {
    if (type === 'ok') { setSuccessMsg(msg); setErrorMsg(''); }
    else { setErrorMsg(msg); setSuccessMsg(''); }
    setTimeout(() => { setSuccessMsg(''); setErrorMsg(''); }, 4000);
  };

  // ── Update / Add handler ─────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      medicine: form.medicine,
      quantity: parseInt(form.quantity),
      expiry_date: form.expiry_date,
    };
    if (isOnline) {
      try {
        await updateStock(payload);
        flash('ok', 'Stock updated successfully!');
        setFormOpen(false);
        setForm({ medicine: '', quantity: '', expiry_date: '' });
        await refreshInventory();
      } catch (err: any) {
        flash('err', err.response?.data?.detail || 'Update failed');
      }
    } else {
      addToQueue(payload);
      flash('ok', 'Saved offline — will sync when back online.');
      setFormOpen(false);
      setForm({ medicine: '', quantity: '', expiry_date: '' });
    }
    setSubmitting(false);
  };

  // ── Delete handler ───────────────────────────────────────────────────────
  const openDeleteModal = (item: StockItem) => {
    setDeleteTarget(item);
    setDeletePassword('');
    setDeleteError('');
  };

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deleteTarget) return;
    if (!deletePassword.trim()) {
      setDeleteError('Please enter your password to confirm deletion.');
      return;
    }
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteStock(deleteTarget.id, deletePassword);
      flash('ok', `"${deleteTarget.medicine}" removed from stock.`);
      setDeleteTarget(null);
      await refreshInventory();
    } catch (err: any) {
      const detail = err.response?.data?.detail || 'Deletion failed.';
      setDeleteError(detail);
    } finally {
      setDeleting(false);
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const today = new Date();
  const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  const getExpiryStatus = (dateStr: string) => {
    const d = new Date(dateStr);
    if (d <= today)    return { label: 'Expired',        color: '#ef4444', bg: 'rgba(239,68,68,0.1)' };
    if (d <= in30Days) return { label: 'Expiring Soon',  color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' };
    return                    { label: 'OK',              color: '#10b981', bg: 'rgba(16,185,129,0.1)' };
  };

  const getStockStatus = (qty: number) => {
    if (qty === 0)  return { label: 'Out of Stock',  color: '#ef4444' };
    if (qty <= 20)  return { label: 'Critical Low',  color: '#ef4444' };
    if (qty <= 100) return { label: 'Low',           color: '#f59e0b' };
    return                 { label: 'Adequate',      color: '#10b981' };
  };

  const canDelete = user?.role === 'PHC Staff' || user?.role === 'System Admin';
  const filtered  = stocks.filter(s =>
    s.medicine.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex min-h-screen" style={{ background: '#030712' }}>
      <Sidebar />
      <main className="flex-1 ml-64 p-8">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Inventory Management</h1>
            <p className="text-gray-400 text-sm mt-1">
<<<<<<< Updated upstream
              {user?.phc_id ? `PHC ${user.phc_id} Stock` : 'District Stock View'} · {stocks.length} items
=======
              {viewAllPhcs
                ? 'All PHC Inventory'
                : selectedPhc
                  ? `${selectedPhc.name} · ${selectedPhc.type}`
                  : user?.phc_id
                    ? `PHC ${user.phc_id} Stock`
                    : 'District Stock View'} · {stocks.length} items
>>>>>>> Stashed changes
            </p>
          </div>
          <div className="flex items-center gap-3">
            {queueLength > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#fbbf24' }}>
                📶 {queueLength} updates queued {isSyncing ? '(syncing...)' : '(offline)'}
              </div>
            )}
<<<<<<< Updated upstream
=======
            <button
              onClick={() => {
                const header = 'Medicine,Quantity,Expiry Date\n';
                const rows = stocks.map(s => `${s.medicine},${s.quantity},${s.expiry_date}`).join('\n');
                const blob = new Blob([header + rows], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = 'phc_inventory.csv'; a.click();
                URL.revokeObjectURL(url);
              }}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#60a5fa' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
              Export CSV
            </button>
            <label className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer"
              style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', color: '#a78bfa' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 3v12" />
              </svg>
              Import CSV
              <input type="file" accept=".csv" className="hidden" onChange={async (e) => {
                const file = e.target.files?.[0]; if (!file) return;
                const text = await file.text();
                const lines = text.split('\n').filter(l => l.trim());
                const items = lines.slice(1).map(l => {
                  const [medicine, qty, exp] = l.split(',').map(s => s.trim());
                  return { medicine, quantity: parseInt(qty), expiry_date: exp };
                }).filter(it => it.medicine && !isNaN(it.quantity) && it.expiry_date);
                if (items.length === 0) { flash('err', 'No valid stock entries found in CSV.'); return; }
                for (const item of items) {
                  try { await updateStock(item); } catch { /* skip duplicates */ }
                }
                flash('ok', `Imported ${items.length} stock entries from CSV.`);
                await refreshInventory();
                e.target.value = '';
              }} />
            </label>
>>>>>>> Stashed changes
            {user?.role !== 'District Health Official' && (
              <button id="add-stock-btn" onClick={() => setFormOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white"
                style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Update Stock
              </button>
            )}
          </div>
        </div>

<<<<<<< Updated upstream
=======
        {/* ── PHC Dropdown for District Official / Admin ── */}
        {user && (user.role === 'District Health Official' || user.role === 'System Admin') && (
          <div className="mb-6 flex flex-col gap-4 p-4 rounded-xl" style={{ background: 'rgba(17,24,39,0.7)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-gray-400">Select Health Facility:</span>
              <select
                value={selectedPhcId}
                onChange={e => setSelectedPhcId(Number(e.target.value))}
                disabled={viewAllPhcs}
                className="px-4 py-2.5 rounded-xl text-sm text-white focus:outline-none cursor-pointer"
                style={{ background: 'rgba(31,41,55,0.8)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                {phcList.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.type} · {p.district})</option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => {
                  setViewAllPhcs(false);
                  if (selectedPhcId) refreshInventory();
                }}
                className="px-4 py-2 rounded-xl text-sm font-medium"
                style={{ background: viewAllPhcs ? 'rgba(255,255,255,0.06)' : 'rgba(16,185,129,0.15)', border: '1px solid rgba(255,255,255,0.08)', color: viewAllPhcs ? '#cbd5e1' : '#a7f3d0' }}
              >
                Selected PHC Only
              </button>
              <button
                onClick={() => {
                  setViewAllPhcs(true);
                  fetchAllStock();
                }}
                className="px-4 py-2 rounded-xl text-sm font-medium"
                style={{ background: viewAllPhcs ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: viewAllPhcs ? '#a7f3d0' : '#cbd5e1' }}
              >
                All PHCs
              </button>
            </div>
          </div>
        )}

>>>>>>> Stashed changes
        {/* ── Flash messages ── */}
        {successMsg && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm text-emerald-300"
            style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
            ✅ {successMsg}
          </div>
        )}
        {errorMsg && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm text-red-300"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
            ❌ {errorMsg}
          </div>
        )}

        {/* ── Summary cards ── */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Total Items',    value: stocks.length,                                          color: '#6b7280' },
            { label: 'Low Stock',      value: stocks.filter(s => s.quantity <= 20).length,            color: '#f59e0b' },
            { label: 'Expiring Soon',  value: stocks.filter(s => new Date(s.expiry_date) <= in30Days).length, color: '#ef4444' },
          ].map(stat => (
            <div key={stat.label} className="rounded-xl px-5 py-4"
              style={{ background: 'rgba(17,24,39,0.7)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="text-2xl font-bold mb-1" style={{ color: stat.color }}>{stat.value}</div>
              <div className="text-xs text-gray-500">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* ── Search ── */}
        <div className="relative mb-5">
          <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search medicines..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none"
            style={{ background: 'rgba(17,24,39,0.8)', border: '1px solid rgba(255,255,255,0.06)' }} />
        </div>

        {/* ── Stock Table ── */}
        <div className="rounded-2xl overflow-hidden"
          style={{ background: 'rgba(17,24,39,0.7)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                {['PHC', 'Medicine', 'Quantity', 'Stock Status', 'Expiry Date', 'Expiry Status', 'Last Updated', canDelete ? 'Actions' : ''].filter(Boolean).map(h => (
                  <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-16 text-gray-500 text-sm">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-16 text-gray-500 text-sm">No stock records found</td></tr>
              ) : (
                filtered.map((item, idx) => {
                  const expStat  = getExpiryStatus(item.expiry_date);
                  const stkStat  = getStockStatus(item.quantity);
                  return (
                    <tr key={item.id}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: idx % 2 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                      <td className="px-5 py-4 text-sm text-gray-300">{item.phc_name ?? `PHC ${item.phc_id}`}</td>
                      <td className="px-5 py-4 text-sm font-medium text-white">{item.medicine}</td>
                      <td className="px-5 py-4 text-sm font-bold" style={{ color: stkStat.color }}>{item.quantity.toLocaleString()}</td>
                      <td className="px-5 py-4">
                        <span className="text-xs font-medium px-2 py-1 rounded-md"
                          style={{ color: stkStat.color, background: `${stkStat.color}15` }}>
                          {stkStat.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-300">{new Date(item.expiry_date).toLocaleDateString('en-IN')}</td>
                      <td className="px-5 py-4">
                        <span className="text-xs font-medium px-2 py-1 rounded-md"
                          style={{ color: expStat.color, background: expStat.bg }}>
                          {expStat.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs text-gray-500">
                        {item.updated_at ? new Date(item.updated_at).toLocaleDateString('en-IN') : 'N/A'}
                      </td>
                      {canDelete && (
                        <td className="px-5 py-4">
                          <button
                            id={`delete-stock-${item.id}`}
                            onClick={() => openDeleteModal(item)}
                            title="Delete stock record"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-90"
                            style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ══════════════════════════════════════════════════
            Add / Update Stock Modal
        ══════════════════════════════════════════════════ */}
        {formOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
            <div className="w-full max-w-md rounded-2xl p-7"
              style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">Update Stock</h3>
                <button onClick={() => setFormOpen(false)} className="text-gray-400 hover:text-white">✕</button>
              </div>
              {!isOnline && (
                <div className="mb-4 px-3 py-2.5 rounded-lg text-xs text-yellow-300"
                  style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
                  📶 You are offline. This update will be queued and synced when connectivity is restored.
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-1.5">Medicine Name</label>
                  <select value={form.medicine} onChange={e => setForm({ ...form, medicine: e.target.value })} required
                    className="w-full px-4 py-2.5 rounded-xl text-sm text-white focus:outline-none"
                    style={{ background: 'rgba(31,41,55,0.8)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <option value="">Select medicine...</option>
                    {MEDICINE_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1.5">Quantity (units)</label>
                  <input type="number" min="0" value={form.quantity}
                    onChange={e => setForm({ ...form, quantity: e.target.value })} required
                    className="w-full px-4 py-2.5 rounded-xl text-sm text-white focus:outline-none"
                    style={{ background: 'rgba(31,41,55,0.8)', border: '1px solid rgba(255,255,255,0.08)' }} />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1.5">Expiry Date</label>
                  <input type="date" value={form.expiry_date}
                    onChange={e => setForm({ ...form, expiry_date: e.target.value })} required
                    className="w-full px-4 py-2.5 rounded-xl text-sm text-white focus:outline-none"
                    style={{ background: 'rgba(31,41,55,0.8)', border: '1px solid rgba(255,255,255,0.08)', colorScheme: 'dark' }} />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setFormOpen(false)}
                    className="flex-1 py-2.5 rounded-xl text-sm text-gray-400 font-medium"
                    style={{ background: 'rgba(31,41,55,0.5)' }}>Cancel</button>
                  <button type="submit" disabled={submitting} id="submit-stock-btn"
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white"
                    style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                    {submitting ? 'Saving...' : isOnline ? 'Save Stock' : 'Queue Offline'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            Delete Confirmation Modal (password-gated)
        ══════════════════════════════════════════════════ */}
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}>
            <div className="w-full max-w-md rounded-2xl p-7"
              style={{ background: '#111827', border: '1px solid rgba(239,68,68,0.25)' }}>

              {/* Icon + title */}
              <div className="flex items-center gap-3 mb-5">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(239,68,68,0.12)' }}>
                  <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Delete Stock Record</h3>
                  <p className="text-xs text-gray-400 mt-0.5">This action is permanent and cannot be undone</p>
                </div>
              </div>

              {/* What's being deleted */}
              <div className="px-4 py-3 rounded-xl mb-5"
                style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)' }}>
                <p className="text-sm text-gray-200">
                  You are about to permanently delete the stock record for:
                </p>
                <p className="text-base font-bold text-red-300 mt-1">{deleteTarget.medicine}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {deleteTarget.quantity.toLocaleString()} units · Expires {new Date(deleteTarget.expiry_date).toLocaleDateString('en-IN')}
                </p>
              </div>

              {/* Password input */}
              <form onSubmit={handleDelete} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    Enter your password to confirm
                  </label>
                  <input
                    id="delete-confirm-password"
                    type="password"
                    value={deletePassword}
                    onChange={e => { setDeletePassword(e.target.value); setDeleteError(''); }}
                    placeholder="Your login password"
                    autoFocus
                    className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none"
                    style={{ background: 'rgba(31,41,55,0.8)', border: `1px solid ${deleteError ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.08)'}` }}
                  />
                  {deleteError && (
                    <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
                      <span>⚠</span> {deleteError}
                    </p>
                  )}
                </div>

                <div className="flex gap-3 pt-1">
                  <button type="button"
                    onClick={() => { setDeleteTarget(null); setDeletePassword(''); setDeleteError(''); }}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-300"
                    style={{ background: 'rgba(31,41,55,0.6)' }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={deleting}
                    id="confirm-delete-btn"
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all"
                    style={{ background: deleting ? 'rgba(239,68,68,0.4)' : 'linear-gradient(135deg, #ef4444, #dc2626)', cursor: deleting ? 'not-allowed' : 'pointer' }}>
                    {deleting ? 'Deleting...' : 'Yes, Delete Permanently'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
