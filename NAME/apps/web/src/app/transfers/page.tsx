'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../../components/common/Sidebar';
import { getTransferLedger, createTransfer, approveTransfer, getMatches } from '../../services/api';

interface Transfer {
  id: number;
  medicine: string;
  quantity: number;
  status: string;
  source_phc: { id: number; name: string };
  destination_phc: { id: number; name: string };
  created_at: string;
  approved_at?: string;
}

interface MatchItem {
  phc_id: number;
  phc_name: string;
  distance_km: number;
  available_surplus: number;
  expiry_date: string;
  similarity_score: number;
}

const statusMeta: Record<string, { color: string; bg: string; icon: string }> = {
  pending: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: '⏳' },
  approved: { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', icon: '✅' },
  completed: { color: '#10b981', bg: 'rgba(16,185,129,0.1)', icon: '📦' },
  rejected: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', icon: '❌' },
  in_transit: { color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', icon: '🚚' },
};

const MEDICINES = ['Paracetamol 500mg', 'Amoxicillin 500mg', 'Ibuprofen 400mg', 'Cetirizine 10mg', 'Metformin 500mg'];

export default function TransfersPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [matchResults, setMatchResults] = useState<MatchItem[]>([]);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchMedicine, setMatchMedicine] = useState('');
  const [form, setForm] = useState({ destination_phc_id: '', medicine: '', quantity: '' });
  const [submitting, setSubmitting] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    const t = localStorage.getItem('phc_token');
    const s = localStorage.getItem('phc_user');
    if (!t) { router.push('/login'); return; }
    if (s) setUser(JSON.parse(s));
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchTransfers();
  }, [user]);

  const fetchTransfers = async () => {
    try {
      const res = await getTransferLedger();
      setTransfers(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFindMatches = async () => {
    if (!matchMedicine || !user?.phc_id) return;
    setMatchLoading(true);
    try {
      const res = await getMatches(user.phc_id, matchMedicine, 100);
      setMatchResults(res.data?.recommendations || []);
    } catch (err) {
      console.error(err);
    } finally {
      setMatchLoading(false);
    }
  };

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.phc_id) return;
    setSubmitting(true);
    try {
      await createTransfer({
        source_phc_id: parseInt(form.destination_phc_id), // source = the PHC with surplus
        destination_phc_id: user.phc_id,                  // destination = current user's PHC
        medicine: form.medicine,
        quantity: parseInt(form.quantity),
      });
      setCreateOpen(false);
      setForm({ destination_phc_id: '', medicine: '', quantity: '' });
      setMatchResults([]);
      fetchTransfers();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to create transfer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (id: number) => {
    try {
      await approveTransfer(id);
      fetchTransfers();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Approval failed');
    }
  };

  const filtered = filterStatus === 'all' ? transfers : transfers.filter(t => t.status === filterStatus);

  return (
    <div className="flex min-h-screen" style={{ background: '#030712' }}>
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Transfer Ledger</h1>
            <p className="text-gray-400 text-sm mt-1">Immutable audit trail of all lateral redistribution transfers</p>
          </div>
          {user?.role !== 'District Health Official' && user?.phc_id && (
            <button
              id="create-transfer-btn"
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              Request Transfer
            </button>
          )}
        </div>

        {/* Status Filter Tabs */}
        <div className="flex gap-2 mb-6">
          {['all', 'pending', 'completed', 'rejected'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className="px-4 py-1.5 rounded-lg text-xs font-medium capitalize transition-all"
              style={{
                background: filterStatus === s ? 'rgba(16,185,129,0.15)' : 'rgba(31,41,55,0.5)',
                color: filterStatus === s ? '#34d399' : '#9ca3af',
                border: `1px solid ${filterStatus === s ? 'rgba(16,185,129,0.3)' : 'transparent'}`
              }}>
              {s === 'all' ? `All (${transfers.length})` : s}
            </button>
          ))}
        </div>

        {/* Transfers Table */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(17,24,39,0.7)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                {['ID', 'Medicine', 'Qty', 'From → To', 'Status', 'Date', 'Action'].map(h => (
                  <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-16 text-gray-500 text-sm">Loading ledger...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-16 text-gray-500 text-sm">No transfers found</td></tr>
              ) : (
                filtered.map((t, idx) => {
                  const meta = statusMeta[t.status] || statusMeta.pending;
                  const canApprove = t.status === 'pending' && ['PHC Staff', 'System Admin'].includes(user?.role || '');
                  return (
                    <tr key={t.id}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: idx % 2 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                      <td className="px-5 py-4 text-xs text-gray-500">#{t.id}</td>
                      <td className="px-5 py-4 text-sm font-medium text-white">{t.medicine}</td>
                      <td className="px-5 py-4 text-sm font-bold text-emerald-400">{t.quantity}</td>
                      <td className="px-5 py-4 text-xs text-gray-300">
                        <span className="font-medium">{t.source_phc?.name || `PHC ${t.source_phc?.id}`}</span>
                        <span className="mx-1 text-gray-600">→</span>
                        <span className="font-medium">{t.destination_phc?.name || `PHC ${t.destination_phc?.id}`}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-lg capitalize"
                          style={{ background: meta.bg, color: meta.color }}>
                          {meta.icon} {t.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs text-gray-500">
                        {new Date(t.created_at).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-5 py-4">
                        {canApprove && (
                          <button
                            onClick={() => handleApprove(t.id)}
                            id={`approve-transfer-${t.id}`}
                            className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all hover:opacity-80"
                            style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.25)' }}>
                            Approve & Execute
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Create Transfer Modal with Match Engine */}
        {createOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
            <div className="w-full max-w-2xl rounded-2xl p-7 max-h-[90vh] overflow-y-auto" style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">Request Lateral Transfer</h3>
                <button onClick={() => setCreateOpen(false)} className="text-gray-400 hover:text-white">✕</button>
              </div>

              {/* Match Engine */}
              <div className="mb-6 rounded-xl p-4" style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)' }}>
                <h4 className="text-sm font-semibold text-emerald-400 mb-3">🤖 Find Nearby Surplus (AI Match Engine)</h4>
                <div className="flex gap-2">
                  <select value={matchMedicine} onChange={e => setMatchMedicine(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg text-sm text-white focus:outline-none"
                    style={{ background: 'rgba(31,41,55,0.8)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <option value="">Select medicine to search...</option>
                    {MEDICINES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <button onClick={handleFindMatches} disabled={!matchMedicine || matchLoading}
                    id="find-matches-btn"
                    className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all"
                    style={{ background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.3)' }}>
                    {matchLoading ? 'Searching...' : 'Search'}
                  </button>
                </div>

                {matchResults.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {matchResults.map(m => (
                      <div key={m.phc_id}
                        onClick={() => setForm(f => ({ ...f, destination_phc_id: String(m.phc_id), medicine: matchMedicine }))}
                        className="flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all hover:border-emerald-500"
                        style={{ background: 'rgba(31,41,55,0.6)', border: `1px solid ${form.destination_phc_id === String(m.phc_id) ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.05)'}` }}>
                        <div>
                          <div className="text-sm font-medium text-white">{m.phc_name}</div>
                          <div className="text-xs text-gray-400 mt-0.5">{m.distance_km} km away · Expires {new Date(m.expiry_date).toLocaleDateString('en-IN')}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-emerald-400 font-bold text-sm">{m.available_surplus} units</div>
                          <div className="text-xs text-gray-500">available</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Transfer Form */}
              <form onSubmit={handleCreateTransfer} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-1.5">Source PHC ID (Supplier)</label>
                  <input type="number" value={form.destination_phc_id}
                    onChange={e => setForm({ ...form, destination_phc_id: e.target.value })}
                    placeholder="PHC ID with surplus stock"
                    required
                    className="w-full px-4 py-2.5 rounded-xl text-sm text-white focus:outline-none"
                    style={{ background: 'rgba(31,41,55,0.8)', border: '1px solid rgba(255,255,255,0.08)' }} />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1.5">Medicine</label>
                  <select value={form.medicine} onChange={e => setForm({ ...form, medicine: e.target.value })}
                    required
                    className="w-full px-4 py-2.5 rounded-xl text-sm text-white focus:outline-none"
                    style={{ background: 'rgba(31,41,55,0.8)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <option value="">Select medicine...</option>
                    {MEDICINES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1.5">Quantity to Transfer</label>
                  <input type="number" min="1" value={form.quantity}
                    onChange={e => setForm({ ...form, quantity: e.target.value })}
                    required
                    className="w-full px-4 py-2.5 rounded-xl text-sm text-white focus:outline-none"
                    style={{ background: 'rgba(31,41,55,0.8)', border: '1px solid rgba(255,255,255,0.08)' }} />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setCreateOpen(false)}
                    className="flex-1 py-2.5 rounded-xl text-sm text-gray-400 font-medium"
                    style={{ background: 'rgba(31,41,55,0.5)' }}>Cancel</button>
                  <button type="submit" disabled={submitting}
                    id="submit-transfer-btn"
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white"
                    style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                    {submitting ? 'Creating...' : 'Create Transfer Request'}
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
