'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../../components/common/Sidebar';
import { getTransferLedger, createTransfer, approveTransfer, declineTransfer, withdrawTransfer, getMatches } from '../../services/api';
import { MEDICINES } from '../../constants/medicines';


interface Transfer {
  id: number;
  medicine: string;
  quantity: number;
  status: string;
  message?: string;
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

export default function TransfersPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [ledgerError, setLedgerError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [matchResults, setMatchResults] = useState<MatchItem[]>([]);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchMedicine, setMatchMedicine] = useState('');
  const [form, setForm] = useState({ supplier_phc_id: '', medicine: '', quantity: '', message: '', requested_expiry_date: '' });
  const [submitting, setSubmitting] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshRequestId = useRef(0);
  const refreshInFlight = useRef(false);

  const refreshLedger = async (currentUser?: any, options: { background?: boolean } = {}) => {
    if (!currentUser?.phc_id && currentUser?.role !== 'System Admin' && currentUser?.role !== 'District Health Official') {
      return;
    }
    if (options.background && refreshInFlight.current) {
      return;
    }

    const requestId = ++refreshRequestId.current;
    refreshInFlight.current = true;

    if (options.background) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
      setLedgerError('');
    }

    try {
      const res = await getTransferLedger();
      if (requestId !== refreshRequestId.current) return;
      setTransfers(res.data || []);
      setLedgerError('');
    } catch (err: any) {
      if (requestId !== refreshRequestId.current) return;
      console.error('Transfer ledger load failed:', err);
      if (!options.background || transfers.length === 0) {
        setLedgerError(err.response?.data?.detail || 'Unable to load transfer ledger.');
      }
    } finally {
      if (requestId === refreshRequestId.current) {
        setLoading(false);
        setIsRefreshing(false);
      }
      refreshInFlight.current = false;
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('phc_token');
    const stored = localStorage.getItem('phc_user');
    if (!token || !stored) {
      localStorage.removeItem('phc_token');
      localStorage.removeItem('phc_user');
      document.cookie = 'phc_token=; path=/; max-age=0; SameSite=Lax';
      router.push('/login');
      return;
    }
    try {
      setUser(JSON.parse(stored));
    } catch (e) {
      localStorage.removeItem('phc_token');
      localStorage.removeItem('phc_user');
      document.cookie = 'phc_token=; path=/; max-age=0; SameSite=Lax';
      router.push('/login');
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    refreshLedger(user);
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const tick = () => refreshLedger(user, { background: true });
    const interval = window.setInterval(tick, 15000);
    const onFocus = () => tick();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') tick();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [user]);

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
    if (!form.message.trim()) {
      alert('Please write a message to the supplier before submitting the request.');
      return;
    }
    setSubmitting(true);
    try {
      await createTransfer({
        source_phc_id: parseInt(form.supplier_phc_id), // source = the PHC with surplus (supplier)
        destination_phc_id: user.phc_id,                // destination = current user's PHC (requester)
        medicine: form.medicine,
        quantity: parseInt(form.quantity),
        message: form.message.trim(),
        requested_expiry_date: form.requested_expiry_date || null,
      });
      setCreateOpen(false);
      setForm({ supplier_phc_id: '', medicine: '', quantity: '', message: '', requested_expiry_date: '' });
      setMatchResults([]);
      refreshLedger(user, { background: true });
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to create transfer');
    } finally {
      setSubmitting(false);
    }
  };

  // Accept (approve) — called by SOURCE PHC doctor (supplier, e.g. Dr. Suresh)
  const handleApprove = async (id: number) => {
    try {
      await approveTransfer(id);
      refreshLedger(user, { background: true });
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Accept failed');
    }
  };

  // Decline — called by SOURCE PHC doctor (supplier, e.g. Dr. Suresh)
  const handleDecline = async (id: number) => {
    const reason = prompt('Please enter the reason for declining this request:');
    if (reason === null) return;
    if (!reason.trim()) {
      alert('A reason is required to decline the request.');
      return;
    }
    try {
      await declineTransfer(id, reason.trim());
      refreshLedger(user, { background: true });
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Decline failed');
    }
  };

  // Withdraw — called by DESTINATION PHC doctor (requester, e.g. Dr. Ramesh)
  const handleWithdraw = async (id: number) => {
    if (!confirm('Are you sure you want to withdraw this transfer request?')) return;
    try {
      await withdrawTransfer(id);
      refreshLedger(user, { background: true });
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Withdraw failed');
    }
  };

  const filtered = filterStatus === 'all' ? transfers : transfers.filter(t => t.status === filterStatus);
  const ledgerTabs = ['all', 'pending', 'approved', 'in_transit', 'completed', 'rejected'];

  return (
    <div className="flex min-h-screen" style={{ background: '#030712' }}>
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Transfer Ledger</h1>
            <p className="text-gray-400 text-sm mt-1">
              Immutable audit trail of all lateral redistribution transfers
              {isRefreshing && <span className="ml-2 text-emerald-400">(syncing)</span>}
            </p>
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
          {ledgerTabs.map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className="px-4 py-1.5 rounded-lg text-xs font-medium capitalize transition-all"
              style={{
                background: filterStatus === s ? 'rgba(16,185,129,0.15)' : 'rgba(31,41,55,0.5)',
                color: filterStatus === s ? '#34d399' : '#9ca3af',
                border: `1px solid ${filterStatus === s ? 'rgba(16,185,129,0.3)' : 'transparent'}`
              }}>
              {s === 'all' ? `All (${transfers.length})` : s.replace('_', ' ')}
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
              ) : ledgerError ? (
                <tr><td colSpan={7} className="text-center py-16 text-red-400 text-sm">{ledgerError}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-16 text-gray-500 text-sm">No transfer history yet</td></tr>
              ) : (
                filtered.map((t, idx) => {
                  const meta = statusMeta[t.status] || statusMeta.pending;

                  // source_phc = supplier (e.g. Dr. Suresh's PHC)
                  // destination_phc = requester (e.g. Dr. Ramesh's PHC)
                  const isSource = user?.phc_id === t.source_phc?.id;        // supplier → Accept / Decline
                  const isDestination = user?.phc_id === t.destination_phc?.id; // requester → Withdraw
                  const isAdmin = user?.role === 'System Admin';

                  // Supplier (source) can Accept or Decline a pending request
                  const canAcceptDecline = t.status === 'pending' && (isAdmin || isSource);
                  // Requester (destination) can Withdraw their own pending request
                  const canWithdraw = t.status === 'pending' && (isAdmin || isDestination) && !isSource;

                  return (
                    <tr key={t.id}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: idx % 2 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                      <td className="px-5 py-4 text-xs text-gray-500">#{t.id}</td>
                      <td className="px-5 py-4 text-sm font-medium text-white">
                        <div>{t.medicine}</div>
                        {t.message && (
                          <div className="text-xs text-gray-500 mt-0.5 italic max-w-[180px] truncate" title={t.message}>
                            💬 {t.message}
                          </div>
                        )}
                      </td>
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
                        <div className="flex gap-2 flex-wrap">
                          {/* SOURCE doctor (supplier) sees: Accept + Decline */}
                          {canAcceptDecline && (
                            <>
                              <button
                                onClick={() => handleApprove(t.id)}
                                id={`accept-transfer-${t.id}`}
                                className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all hover:opacity-80"
                                style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.25)' }}>
                                ✓ Accept
                              </button>
                              <button
                                onClick={() => handleDecline(t.id)}
                                id={`decline-transfer-${t.id}`}
                                className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all hover:opacity-80"
                                style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                                ✗ Decline
                              </button>
                            </>
                          )}
                          {/* DESTINATION doctor (requester) sees: Withdraw */}
                          {canWithdraw && (
                            <button
                              onClick={() => handleWithdraw(t.id)}
                              id={`withdraw-transfer-${t.id}`}
                              className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all hover:opacity-80"
                              style={{ background: 'rgba(245,158,11,0.1)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.2)' }}>
                              ↩ Withdraw
                            </button>
                          )}
                        </div>
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
                        onClick={() => setForm(f => ({ ...f, supplier_phc_id: String(m.phc_id), medicine: matchMedicine }))}
                        className="flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all hover:border-emerald-500"
                        style={{ background: 'rgba(31,41,55,0.6)', border: `1px solid ${form.supplier_phc_id === String(m.phc_id) ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.05)'}` }}>
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium text-white">{m.phc_name}</div>
                            <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>ID #{m.phc_id}</span>
                          </div>
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
                  <input type="number" value={form.supplier_phc_id}
                    onChange={e => setForm({ ...form, supplier_phc_id: e.target.value })}
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
                <div>
                  <label className="block text-sm text-gray-300 mb-1.5">Requested Expiry Date</label>
                  <input type="date" value={form.requested_expiry_date}
                    onChange={e => setForm({ ...form, requested_expiry_date: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl text-sm text-white focus:outline-none"
                    style={{ background: 'rgba(31,41,55,0.8)', border: '1px solid rgba(255,255,255,0.08)', colorScheme: 'dark' }} />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1.5">
                    Message to Supplier <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    value={form.message}
                    onChange={e => setForm({ ...form, message: e.target.value })}
                    placeholder="Write a message explaining your need (e.g. 'We are critically low on Paracetamol due to an outbreak. Please transfer urgently.')"
                    required
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-xl text-sm text-white focus:outline-none resize-none"
                    style={{ background: 'rgba(31,41,55,0.8)', border: '1px solid rgba(255,255,255,0.08)' }} />
                  <p className="text-xs text-gray-500 mt-1">This message will appear in the supplier's Alerts so they can make an informed decision.</p>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setCreateOpen(false)}
                    className="flex-1 py-2.5 rounded-xl text-sm text-gray-400 font-medium"
                    style={{ background: 'rgba(31,41,55,0.5)' }}>Cancel</button>
                  <button type="submit" disabled={submitting}
                    id="submit-transfer-btn"
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white"
                    style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                    {submitting ? 'Sending Request...' : 'Send Transfer Request'}
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
