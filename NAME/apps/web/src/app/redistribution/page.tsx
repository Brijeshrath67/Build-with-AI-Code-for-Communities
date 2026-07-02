'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../../components/common/Sidebar';
import { getStock, getForecasts, getMatches, createTransfer } from '../../services/api';

interface StockItem { id: number; phc_id: number; medicine: string; quantity: number; expiry_date: string; updated_at: string; }
interface ForecastItem { id: number; medicine: string; risk_score: string; stockout_date: string; }
interface MatchRec { phc_id: number; phc_name: string; distance_km: number; available_surplus: number; expiry_date: string; similarity_score: number; }

const riskColors: Record<string, string> = { HIGH: '#ef4444', MEDIUM: '#f59e0b', LOW: '#10b981' };

export default function RedistributionPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [forecasts, setForecasts] = useState<ForecastItem[]>([]);
  const [selectedMedicine, setSelectedMedicine] = useState('');
  const [requestQty, setRequestQty] = useState(50);
  const [matches, setMatches] = useState<MatchRec[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState<number | null>(null);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('phc_token');
    const stored = localStorage.getItem('phc_user');
    if (!token) { router.push('/login'); return; }
    if (stored) setUser(JSON.parse(stored));
  }, []);

  useEffect(() => {
    if (!user?.phc_id) { setLoading(false); return; }
    const fetchData = async () => {
      try {
        const [sRes, fRes] = await Promise.all([
          getStock(user.phc_id),
          getForecasts(user.phc_id),
        ]);
        setStocks(sRes.data || []);
        setForecasts(fRes.data || []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [user]);

  const lowStockItems = stocks.filter(s => s.quantity <= 100);

  const handleFindMatches = async () => {
    if (!selectedMedicine || !user?.phc_id) return;
    setSearching(true);
    setError('');
    setMatches([]);
    try {
      const res = await getMatches(user.phc_id, selectedMedicine, requestQty);
      setMatches(res.data?.recommendations || []);
      if (!res.data?.recommendations?.length) {
        setError('No surplus stock found nearby for this medicine.');
      }
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to find matches. Ensure backend is running.');
    } finally {
      setSearching(false);
    }
  };

  const handleCreateTransfer = async (match: MatchRec) => {
    if (!user?.phc_id) return;
    setCreating(match.phc_id);
    setSuccess('');
    try {
      await createTransfer({
        source_phc_id: match.phc_id,
        destination_phc_id: user.phc_id,
        medicine: selectedMedicine,
        quantity: Math.min(match.available_surplus, requestQty),
      });
      setSuccess(`Transfer request created: ${Math.min(match.available_surplus, requestQty)} units from ${match.phc_name}`);
      setMatches([]);
      setSelectedMedicine('');
      const [sRes, fRes] = await Promise.all([
        getStock(user.phc_id),
        getForecasts(user.phc_id),
      ]);
      setStocks(sRes.data || []);
      setForecasts(fRes.data || []);
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to create transfer.');
    } finally {
      setCreating(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: '#030712' }}>
        <div className="w-12 h-12 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen" style={{ background: '#030712' }}>
      <Sidebar />
      <main className="flex-1 ml-64 p-8 overflow-y-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">AI Redistribution Engine</h1>
          <p className="text-gray-400 text-sm mt-1">Find nearby PHCs with surplus medicine and recommend lateral transfers</p>
        </div>

        {!user?.phc_id && (
          <div className="rounded-2xl p-8 text-center" style={{ background: 'rgba(17,24,39,0.7)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="text-5xl mb-4">🏥</div>
            <h2 className="text-lg font-semibold text-white mb-2">No PHC Assigned</h2>
            <p className="text-gray-400 text-sm">Log in as PHC Staff or ASHA Worker to use redistribution.</p>
          </div>
        )}

        {user?.phc_id && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              <div className="rounded-2xl p-5 lg:col-span-2" style={{ background: 'rgba(17,24,39,0.7)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h2 className="text-white font-semibold mb-4">Current Stock — Low Items</h2>
                {stocks.length === 0 ? (
                  <p className="text-gray-500 text-sm">No stock records found.</p>
                ) : (
                  <div className="space-y-2">
                    {stocks.map(s => {
                      const isLow = s.quantity <= 100;
                      const isCritical = s.quantity <= 20;
                      return (
                        <div key={s.id} className="flex items-center justify-between px-4 py-3 rounded-xl"
                          style={{ background: isCritical ? 'rgba(239,68,68,0.08)' : isLow ? 'rgba(245,158,11,0.08)' : 'rgba(31,41,55,0.6)', border: `1px solid ${isCritical ? 'rgba(239,68,68,0.15)' : isLow ? 'rgba(245,158,11,0.15)' : 'transparent'}` }}>
                          <div>
                            <div className="text-sm font-medium text-white">{s.medicine}</div>
                            <div className="text-xs text-gray-500">Expires: {new Date(s.expiry_date).toLocaleDateString('en-IN')} · Updated: {new Date(s.updated_at).toLocaleDateString('en-IN')}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold" style={{ color: isCritical ? '#ef4444' : isLow ? '#f59e0b' : '#10b981' }}>{s.quantity}</div>
                            <div className="text-xs text-gray-500">units</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-2xl p-5" style={{ background: 'rgba(17,24,39,0.7)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h2 className="text-white font-semibold mb-4">AI Forecast Alerts</h2>
                {forecasts.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-3xl mb-2">✅</div>
                    <p className="text-gray-500 text-sm">No stockout risks</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {forecasts.filter(f => f.risk_score !== 'LOW').map(f => (
                      <div key={f.id} className="px-4 py-3 rounded-xl" style={{ background: 'rgba(31,41,55,0.6)' }}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-white">{f.medicine}</span>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ background: `${riskColors[f.risk_score]}18`, color: riskColors[f.risk_score] }}>{f.risk_score}</span>
                        </div>
                        <div className="text-xs text-gray-500">Stockout by: {new Date(f.stockout_date).toLocaleDateString('en-IN')}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl p-6 mb-6" style={{ background: 'rgba(17,24,39,0.7)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <h2 className="text-white font-semibold mb-5">Find Surplus Stock Nearby</h2>
              <div className="flex items-end gap-4 mb-6">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Select Medicine</label>
                  <select
                    value={selectedMedicine}
                    onChange={e => { setSelectedMedicine(e.target.value); setMatches([]); setError(''); }}
                    className="w-full px-4 py-3 rounded-xl text-sm text-white focus:outline-none"
                    style={{ background: 'rgba(31,41,55,0.8)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    <option value="">Choose a medicine...</option>
                    {stocks.filter(s => s.quantity <= 100).map(s => (
                      <option key={s.medicine} value={s.medicine}>{s.medicine}</option>
                    ))}
                    {stocks.filter(s => s.quantity > 100).map(s => (
                      <option key={s.medicine} value={s.medicine}>{s.medicine}</option>
                    ))}
                  </select>
                </div>
                <div className="w-32">
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Request Qty</label>
                  <input
                    type="number"
                    min={1}
                    value={requestQty}
                    onChange={e => { setRequestQty(Number(e.target.value) || 1); setMatches([]); setError(''); }}
                    className="w-full px-4 py-3 rounded-xl text-sm text-white focus:outline-none"
                    style={{ background: 'rgba(31,41,55,0.8)', border: '1px solid rgba(255,255,255,0.08)' }}
                  />
                </div>
                <button
                  onClick={handleFindMatches}
                  disabled={!selectedMedicine || searching}
                  className="px-6 py-3 rounded-xl font-medium text-sm text-white transition-all"
                  style={{ background: !selectedMedicine || searching ? 'rgba(16,185,129,0.3)' : 'linear-gradient(135deg, #10b981, #059669)', cursor: !selectedMedicine || searching ? 'not-allowed' : 'pointer' }}
                >
                  {searching ? (
                    <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Searching...</span>
                  ) : 'Find Matches'}
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}>
                  {error}
                </div>
              )}

              {success && (
                <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#6ee7b7' }}>
                  {success}
                </div>
              )}

              {matches.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-300 mb-3">
                    AI-Ranked Matches for <span className="text-emerald-400">{selectedMedicine}</span>
                  </h3>
                  <div className="space-y-3">
                    {matches.map((m, i) => (
                      <div key={m.phc_id} className="flex items-center justify-between px-5 py-4 rounded-xl transition-all hover:scale-[1.01]"
                        style={{ background: i === 0 ? 'rgba(16,185,129,0.08)' : 'rgba(31,41,55,0.6)', border: `1px solid ${i === 0 ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.04)'}` }}>
                        <div className="flex items-center gap-4">
                          {i === 0 && <span className="text-lg">🥇</span>}
                          {i === 1 && <span className="text-lg">🥈</span>}
                          {i === 2 && <span className="text-lg">🥉</span>}
                          {i > 2 && <span className="text-base text-gray-500 w-6 text-center">{i + 1}</span>}
                          <div>
                            <div className="text-sm font-medium text-white">{m.phc_name}</div>
                            <div className="text-xs text-gray-400 mt-0.5">
                              <span>{m.distance_km} km away</span>
                              <span className="mx-2">·</span>
                              <span style={{ color: m.available_surplus >= 300 ? '#10b981' : '#f59e0b' }}>{m.available_surplus} units surplus</span>
                              <span className="mx-2">·</span>
                              <span>Expires {new Date(m.expiry_date).toLocaleDateString('en-IN')}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-xs text-gray-500">Match Score</div>
                            <div className="text-sm font-bold" style={{ color: m.similarity_score >= 0.7 ? '#10b981' : m.similarity_score >= 0.4 ? '#f59e0b' : '#6b7280' }}>
                              {Math.round(m.similarity_score * 100)}%
                            </div>
                          </div>
                          <button
                            onClick={() => handleCreateTransfer(m)}
                            disabled={creating === m.phc_id}
                            className="px-4 py-2 rounded-xl text-xs font-medium text-white transition-all"
                            style={{ background: creating === m.phc_id ? 'rgba(16,185,129,0.3)' : 'linear-gradient(135deg, #10b981, #059669)', cursor: creating === m.phc_id ? 'not-allowed' : 'pointer' }}
                          >
                            {creating === m.phc_id ? 'Sending...' : 'Transfer'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!searching && matches.length === 0 && !error && selectedMedicine && (
                <div className="text-center py-10">
                  <div className="text-4xl mb-3">🔍</div>
                  <p className="text-gray-500 text-sm">Click "Find Matches" to search for nearby PHCs with surplus <span className="text-emerald-400">{selectedMedicine}</span></p>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
