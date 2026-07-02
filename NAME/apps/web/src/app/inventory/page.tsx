'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../../components/common/Sidebar';
import { deleteStock, getAllStock, getStock, updateStock } from '../../services/api';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { MEDICINES } from '../../constants/medicines';

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

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const MEDICINE_OPTIONS = MEDICINES;

const normalizeStockItems = (items: any[]): StockItem[] =>
  (items || []).map((item) => ({
    id: item.id,
    phc_id: item.phc_id,
    phc_name: item.phc_name,
    medicine: item.medicine,
    quantity: item.quantity,
    expiry_date: item.expiry_date,
    sync_status: item.sync_status ?? 'synced',
    updated_at: item.updated_at ?? '',
  }));

export default function InventoryPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ medicine: '', quantity: '', expiry_date: '' });
  const [deleteTarget, setDeleteTarget] = useState<StockItem | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('phc_token') : null;
  const { isOnline, queueLength, isSyncing, addToQueue } = useOfflineSync(API_URL, token);

  useEffect(() => {
    const storedToken = localStorage.getItem('phc_token');
    const storedUser = localStorage.getItem('phc_user');
    if (!storedToken) {
      router.push('/login');
      return;
    }
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, [router]);

  const isDistrictOrAdmin = user?.role === 'District Health Official' || user?.role === 'System Admin';
  const canUpdate = user?.role !== 'District Health Official';
  const canDelete = user?.role === 'PHC Staff' || user?.role === 'System Admin';

  const fetchInventory = async () => {
    if (!user) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const res = isDistrictOrAdmin ? await getAllStock() : await getStock(user.phc_id);
      setStocks(normalizeStockItems(res.data));
    } catch (err: any) {
      console.error('Failed to load inventory', err.response?.data || err.message);
      setStocks([]);
      setErrorMsg('Could not load inventory. Please check if the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [user]);

  const flash = (type: 'ok' | 'err', msg: string) => {
    if (type === 'ok') {
      setSuccessMsg(msg);
      setErrorMsg('');
    } else {
      setErrorMsg(msg);
      setSuccessMsg('');
    }
    setTimeout(() => {
      setSuccessMsg('');
      setErrorMsg('');
    }, 4000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const payload = {
      medicine: form.medicine,
      quantity: parseInt(form.quantity, 10),
      expiry_date: form.expiry_date,
    };

    if (isOnline) {
      try {
        await updateStock(payload);
        flash('ok', 'Stock updated successfully.');
        setFormOpen(false);
        setForm({ medicine: '', quantity: '', expiry_date: '' });
        await fetchInventory();
      } catch (err: any) {
        flash('err', err.response?.data?.detail || 'Update failed.');
      }
    } else {
      addToQueue(payload);
      flash('ok', 'Saved offline. It will sync when you are back online.');
      setFormOpen(false);
      setForm({ medicine: '', quantity: '', expiry_date: '' });
    }

    setSubmitting(false);
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
      setDeletePassword('');
      await fetchInventory();
    } catch (err: any) {
      setDeleteError(err.response?.data?.detail || 'Deletion failed.');
    } finally {
      setDeleting(false);
    }
  };

  const today = new Date();
  const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  const filtered = useMemo(
    () => stocks.filter((stock) => stock.medicine.toLowerCase().includes(searchQuery.toLowerCase())),
    [stocks, searchQuery],
  );

  const getExpiryStatus = (dateStr: string) => {
    const date = new Date(dateStr);
    if (date <= today) return { label: 'Expired', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' };
    if (date <= in30Days) return { label: 'Expiring Soon', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' };
    return { label: 'OK', color: '#10b981', bg: 'rgba(16,185,129,0.1)' };
  };

  const getStockStatus = (qty: number) => {
    if (qty === 0) return { label: 'Out of Stock', color: '#ef4444' };
    if (qty <= 20) return { label: 'Critical Low', color: '#ef4444' };
    if (qty <= 100) return { label: 'Low', color: '#f59e0b' };
    return { label: 'Adequate', color: '#10b981' };
  };

  return (
    <div className="flex min-h-screen" style={{ background: '#030712' }}>
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Inventory Management</h1>
            <p className="text-gray-400 text-sm mt-1">
              {isDistrictOrAdmin ? 'District Stock View' : `PHC ${user?.phc_id ?? ''} Stock`} · {stocks.length} items
            </p>
          </div>

          <div className="flex items-center gap-3">
            {queueLength > 0 && (
              <div className="px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#fbbf24' }}>
                {queueLength} updates queued {isSyncing ? '(syncing...)' : '(offline)'}
              </div>
            )}
            <button
              onClick={fetchInventory}
              className="px-4 py-2.5 rounded-xl text-sm font-medium"
              style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#60a5fa' }}
            >
              Refresh
            </button>
            {canUpdate && (
              <button
                id="add-stock-btn"
                onClick={() => setFormOpen(true)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-white"
                style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
              >
                Update Stock
              </button>
            )}
          </div>
        </div>

        {successMsg && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm text-emerald-300" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
            {successMsg}
          </div>
        )}
        {errorMsg && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm text-red-300" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
            {errorMsg}
          </div>
        )}

        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Total Items', value: stocks.length, color: '#6b7280' },
            { label: 'Low Stock', value: stocks.filter((s) => s.quantity <= 20).length, color: '#f59e0b' },
            { label: 'Expiring Soon', value: stocks.filter((s) => new Date(s.expiry_date) <= in30Days).length, color: '#ef4444' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl px-5 py-4" style={{ background: 'rgba(17,24,39,0.7)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="text-2xl font-bold mb-1" style={{ color: stat.color }}>{stat.value}</div>
              <div className="text-xs text-gray-500">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="relative mb-5">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search medicines..."
            className="w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none"
            style={{ background: 'rgba(17,24,39,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}
          />
        </div>

        <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(17,24,39,0.7)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                {['PHC', 'Medicine', 'Quantity', 'Stock Status', 'Expiry Date', 'Expiry Status', 'Last Updated', canDelete ? 'Actions' : ''].filter(Boolean).map((header) => (
                  <th key={header} className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-400">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={canDelete ? 8 : 7} className="text-center py-16 text-gray-500 text-sm">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={canDelete ? 8 : 7} className="text-center py-16 text-gray-500 text-sm">No stock records found</td></tr>
              ) : (
                filtered.map((item, idx) => {
                  const expStat = getExpiryStatus(item.expiry_date);
                  const stockStat = getStockStatus(item.quantity);
                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: idx % 2 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                      <td className="px-5 py-4 text-sm text-gray-300">{item.phc_name ?? `PHC ${item.phc_id}`}</td>
                      <td className="px-5 py-4 text-sm font-medium text-white">{item.medicine}</td>
                      <td className="px-5 py-4 text-sm font-bold" style={{ color: stockStat.color }}>{item.quantity.toLocaleString()}</td>
                      <td className="px-5 py-4"><span className="text-xs font-medium px-2 py-1 rounded-md" style={{ color: stockStat.color, background: `${stockStat.color}15` }}>{stockStat.label}</span></td>
                      <td className="px-5 py-4 text-sm text-gray-300">{new Date(item.expiry_date).toLocaleDateString('en-IN')}</td>
                      <td className="px-5 py-4"><span className="text-xs font-medium px-2 py-1 rounded-md" style={{ color: expStat.color, background: expStat.bg }}>{expStat.label}</span></td>
                      <td className="px-5 py-4 text-xs text-gray-500">{item.updated_at ? new Date(item.updated_at).toLocaleDateString('en-IN') : 'N/A'}</td>
                      {canDelete && (
                        <td className="px-5 py-4">
                          <button
                            id={`delete-stock-${item.id}`}
                            onClick={() => {
                              setDeleteTarget(item);
                              setDeletePassword('');
                              setDeleteError('');
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium"
                            style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
                          >
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

        {formOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
            <div className="w-full max-w-md rounded-2xl p-7" style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">Update Stock</h3>
                <button onClick={() => setFormOpen(false)} className="text-gray-400 hover:text-white">Close</button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-1.5">Medicine Name</label>
                  <select value={form.medicine} onChange={(e) => setForm({ ...form, medicine: e.target.value })} required className="w-full px-4 py-2.5 rounded-xl text-sm text-white focus:outline-none" style={{ background: 'rgba(31,41,55,0.8)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <option value="">Select medicine...</option>
                    {MEDICINE_OPTIONS.map((medicine) => <option key={medicine} value={medicine}>{medicine}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1.5">Quantity</label>
                  <input type="number" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required className="w-full px-4 py-2.5 rounded-xl text-sm text-white focus:outline-none" style={{ background: 'rgba(31,41,55,0.8)', border: '1px solid rgba(255,255,255,0.08)' }} />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1.5">Expiry Date</label>
                  <input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} required className="w-full px-4 py-2.5 rounded-xl text-sm text-white focus:outline-none" style={{ background: 'rgba(31,41,55,0.8)', border: '1px solid rgba(255,255,255,0.08)', colorScheme: 'dark' }} />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setFormOpen(false)} className="flex-1 py-2.5 rounded-xl text-sm text-gray-400 font-medium" style={{ background: 'rgba(31,41,55,0.5)' }}>Cancel</button>
                  <button type="submit" disabled={submitting} id="submit-stock-btn" className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                    {submitting ? 'Saving...' : isOnline ? 'Save Stock' : 'Queue Offline'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}>
            <div className="w-full max-w-md rounded-2xl p-7" style={{ background: '#111827', border: '1px solid rgba(239,68,68,0.25)' }}>
              <h3 className="text-lg font-bold text-white mb-2">Delete Stock Record</h3>
              <p className="text-sm text-gray-400 mb-5">Enter your password to delete {deleteTarget.medicine}.</p>
              <form onSubmit={handleDelete} className="space-y-4">
                <input
                  id="delete-confirm-password"
                  type="password"
                  value={deletePassword}
                  onChange={(e) => {
                    setDeletePassword(e.target.value);
                    setDeleteError('');
                  }}
                  placeholder="Your login password"
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none"
                  style={{ background: 'rgba(31,41,55,0.8)', border: `1px solid ${deleteError ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.08)'}` }}
                />
                {deleteError && <p className="text-xs text-red-400">{deleteError}</p>}
                <div className="flex gap-3">
                  <button type="button" onClick={() => setDeleteTarget(null)} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-300" style={{ background: 'rgba(31,41,55,0.6)' }}>Cancel</button>
                  <button type="submit" disabled={deleting} id="confirm-delete-btn" className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: deleting ? 'rgba(239,68,68,0.4)' : 'linear-gradient(135deg, #ef4444, #dc2626)' }}>
                    {deleting ? 'Deleting...' : 'Delete'}
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
