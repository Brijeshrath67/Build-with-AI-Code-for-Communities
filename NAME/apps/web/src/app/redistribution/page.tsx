'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../../components/common/Sidebar';
import { getStock, getForecasts, getMatches, createTransfer } from '../../services/api';

interface StockItem {
  id: number;
  phc_id: number;
  medicine: string;
  quantity: number;
  expiry_date: string;
  updated_at: string;
}

interface ForecastItem {
  id: number;
  medicine: string;
  risk_score: string;
  stockout_date: string;
}

interface MatchRec {
  phc_id: number;
  phc_name: string;
  distance_km: number;
  available_surplus: number;
  expiry_date: string;
  similarity_score: number;
}

type WarningTone = 'critical' | 'warning' | 'surplus' | 'healthy';

const LOW_STOCK_THRESHOLD = 100;
const CRITICAL_STOCK_THRESHOLD = 20;
const SURPLUS_STOCK_THRESHOLD = 300;

const toneStyles: Record<WarningTone, { label: string; color: string; bg: string; border: string }> = {
  critical: {
    label: 'Critical low',
    color: '#f87171',
    bg: 'rgba(239,68,68,0.10)',
    border: 'rgba(239,68,68,0.20)',
  },
  warning: {
    label: 'Low stock',
    color: '#fbbf24',
    bg: 'rgba(245,158,11,0.10)',
    border: 'rgba(245,158,11,0.20)',
  },
  surplus: {
    label: 'High stock',
    color: '#34d399',
    bg: 'rgba(16,185,129,0.10)',
    border: 'rgba(16,185,129,0.20)',
  },
  healthy: {
    label: 'Healthy',
    color: '#94a3b8',
    bg: 'rgba(148,163,184,0.08)',
    border: 'rgba(148,163,184,0.12)',
  },
};

function getWarningTone(stock: StockItem, forecast?: ForecastItem): WarningTone {
  if (stock.quantity <= CRITICAL_STOCK_THRESHOLD || forecast?.risk_score === 'HIGH') {
    return 'critical';
  }
  if (stock.quantity <= LOW_STOCK_THRESHOLD || forecast?.risk_score === 'MEDIUM') {
    return 'warning';
  }
  if (stock.quantity >= SURPLUS_STOCK_THRESHOLD || forecast?.risk_score === 'LOW') {
    return 'surplus';
  }
  return 'healthy';
}

function getSuggestedQuantity(stock: StockItem, forecast?: ForecastItem) {
  if (stock.quantity <= CRITICAL_STOCK_THRESHOLD || forecast?.risk_score === 'HIGH') {
    return Math.max(25, 100 - stock.quantity);
  }
  if (stock.quantity <= LOW_STOCK_THRESHOLD || forecast?.risk_score === 'MEDIUM') {
    return Math.max(10, 100 - stock.quantity);
  }
  if (stock.quantity >= SURPLUS_STOCK_THRESHOLD) {
    return Math.min(200, Math.floor(stock.quantity * 0.25));
  }
  return 50;
}

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
    if (!token || !stored) {
      localStorage.removeItem('phc_token');
      localStorage.removeItem('phc_user');
      document.cookie = 'phc_token=; path=/; max-age=0; SameSite=Lax';
      router.push('/login');
      return;
    }

    try {
      setUser(JSON.parse(stored));
    } catch {
      localStorage.removeItem('phc_token');
      localStorage.removeItem('phc_user');
      document.cookie = 'phc_token=; path=/; max-age=0; SameSite=Lax';
      router.push('/login');
    }
  }, [router]);

  useEffect(() => {
    if (!user?.phc_id) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        const [stockRes, forecastRes] = await Promise.all([
          getStock(user.phc_id),
          getForecasts(user.phc_id),
        ]);
        setStocks(stockRes.data || []);
        setForecasts(forecastRes.data || []);
      } catch (e) {
        console.error('Failed to load redistribution data:', e);
        setStocks([]);
        setForecasts([]);
        setError('Failed to load stock and forecast data. Please check if the backend is running.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const forecastByMedicine = useMemo(() => {
    return new Map(forecasts.map((forecast) => [forecast.medicine, forecast]));
  }, [forecasts]);

  const medicineOptions = useMemo(() => {
    return Array.from(new Set(stocks.map((stock) => stock.medicine))).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [stocks]);

  const stockWarnings = useMemo(() => {
    return stocks
      .map((stock) => {
        const forecast = forecastByMedicine.get(stock.medicine);
        const tone = getWarningTone(stock, forecast);
        return {
          ...stock,
          forecast,
          tone,
        };
      })
      .sort((a, b) => {
        const priority = { critical: 0, warning: 1, surplus: 2, healthy: 3 } as const;
        return priority[a.tone] - priority[b.tone] || a.medicine.localeCompare(b.medicine);
      });
  }, [stocks, forecastByMedicine]);

  const priorityWarnings = stockWarnings.filter((item) => item.tone !== 'healthy');
  const criticalCount = stockWarnings.filter((item) => item.tone === 'critical').length;
  const lowCount = stockWarnings.filter((item) => item.tone === 'warning').length;
  const surplusCount = stockWarnings.filter((item) => item.tone === 'surplus').length;

  const handleMedicineChange = (medicine: string) => {
    setSelectedMedicine(medicine);
    setMatches([]);
    setError('');

    const stock = stocks.find((item) => item.medicine === medicine);
    if (stock) {
      const forecast = forecastByMedicine.get(medicine);
      setRequestQty(getSuggestedQuantity(stock, forecast));
    }
  };

  const handleFindMatches = async () => {
    if (!selectedMedicine || !user?.phc_id) return;

    setSearching(true);
    setError('');
    setMatches([]);

    try {
      const res = await getMatches(user.phc_id, selectedMedicine, requestQty);
      const recommendations = res.data?.recommendations || [];
      setMatches(recommendations);

      if (!recommendations.length) {
        setError('No surplus stock was found nearby for this medicine.');
      }
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to find matches. Ensure the backend is running.');
    } finally {
      setSearching(false);
    }
  };

  const handleCreateTransfer = async (match: MatchRec) => {
    if (!user?.phc_id) return;

    setCreating(match.phc_id);
    setSuccess('');
    setError('');

    try {
      const quantity = Math.min(match.available_surplus, requestQty);
      await createTransfer({
        source_phc_id: match.phc_id,
        destination_phc_id: user.phc_id,
        medicine: selectedMedicine,
        quantity,
      });

      setSuccess(`Transfer request created for ${quantity} units from ${match.phc_name}.`);
      const [stockRes, forecastRes] = await Promise.all([
        getStock(user.phc_id),
        getForecasts(user.phc_id),
      ]);
      setStocks(stockRes.data || []);
      setForecasts(forecastRes.data || []);
      setMatches([]);
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to create transfer.');
    } finally {
      setCreating(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: '#030712' }}>
        <div className="w-12 h-12 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  const selectedStock = stocks.find((stock) => stock.medicine === selectedMedicine);
  const selectedForecast = forecastByMedicine.get(selectedMedicine);
  const selectedTone = selectedStock ? getWarningTone(selectedStock, selectedForecast) : 'healthy';

  return (
    <div className="flex min-h-screen" style={{ background: '#030712' }}>
      <Sidebar />
      <main className="flex-1 ml-64 p-8 overflow-y-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">AI Redistribution Engine</h1>
          <p className="text-gray-400 text-sm mt-1">
            Fetch live stock from the database, review AI warnings, and match surplus medicines nearby.
          </p>
        </div>

        {!user?.phc_id && (
          <div
            className="rounded-2xl p-8 text-center"
            style={{ background: 'rgba(17,24,39,0.7)', border: '1px solid rgba(255,255,255,0.05)' }}
          >
            <div className="text-5xl mb-4">PHC</div>
            <h2 className="text-lg font-semibold text-white mb-2">No PHC Assigned</h2>
            <p className="text-gray-400 text-sm">Log in as PHC Staff or ASHA Worker to use redistribution.</p>
          </div>
        )}

        {user?.phc_id && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              <div
                className="rounded-2xl p-5 lg:col-span-2"
                style={{ background: 'rgba(17,24,39,0.7)', border: '1px solid rgba(255,255,255,0.05)' }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-white font-semibold">Current Stock Overview</h2>
                    <p className="text-xs text-gray-500 mt-1">Warnings are based on live stock and AI forecast data.</p>
                  </div>
                  <div className="text-xs text-gray-400">{stocks.length} medicines</div>
                </div>

                {stocks.length === 0 ? (
                  <p className="text-gray-500 text-sm">No stock records found.</p>
                ) : (
                  <div className="space-y-2">
                    {stockWarnings.map((item) => {
                      const style = toneStyles[item.tone];
                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between px-4 py-3 rounded-xl"
                          style={{ background: style.bg, border: `1px solid ${style.border}` }}
                        >
                          <div className="min-w-0 pr-4">
                            <div className="text-sm font-medium text-white">{item.medicine}</div>
                            <div className="text-xs text-gray-500 mt-1">
                              Expires: {new Date(item.expiry_date).toLocaleDateString('en-IN')}
                              {' '}| Updated: {item.updated_at ? new Date(item.updated_at).toLocaleDateString('en-IN') : 'N/A'}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-lg font-bold" style={{ color: style.color }}>{item.quantity}</div>
                            <div className="text-xs" style={{ color: style.color }}>{style.label}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div
                className="rounded-2xl p-5"
                style={{ background: 'rgba(17,24,39,0.7)', border: '1px solid rgba(255,255,255,0.05)' }}
              >
                <h2 className="text-white font-semibold mb-4">AI Forecast Alerts</h2>
                {priorityWarnings.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-sm font-semibold text-emerald-400 mb-2">All clear</div>
                    <p className="text-gray-500 text-sm">No low-stock or overstock warnings right now.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {priorityWarnings.slice(0, 6).map((item) => {
                      const style = toneStyles[item.tone];
                      return (
                        <div
                          key={item.id}
                          className="px-4 py-3 rounded-xl"
                          style={{ background: 'rgba(31,41,55,0.6)', border: `1px solid ${style.border}` }}
                        >
                          <div className="flex items-center justify-between gap-3 mb-1">
                            <span className="text-sm text-white">{item.medicine}</span>
                            <span
                              className="text-xs font-semibold px-2 py-0.5 rounded"
                              style={{ color: style.color, background: `${style.color}18` }}
                            >
                              {style.label}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500">
                            Stock: {item.quantity} units | Forecast: {item.forecast?.risk_score || 'N/A'} | Stockout by:{' '}
                            {item.forecast ? new Date(item.forecast.stockout_date).toLocaleDateString('en-IN') : 'N/A'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3 mt-5">
                  <div className="rounded-xl px-3 py-3" style={{ background: 'rgba(239,68,68,0.08)' }}>
                    <div className="text-lg font-bold text-red-300">{criticalCount}</div>
                    <div className="text-[11px] text-gray-400">Critical</div>
                  </div>
                  <div className="rounded-xl px-3 py-3" style={{ background: 'rgba(245,158,11,0.08)' }}>
                    <div className="text-lg font-bold text-amber-300">{lowCount}</div>
                    <div className="text-[11px] text-gray-400">Low</div>
                  </div>
                  <div className="rounded-xl px-3 py-3" style={{ background: 'rgba(16,185,129,0.08)' }}>
                    <div className="text-lg font-bold text-emerald-300">{surplusCount}</div>
                    <div className="text-[11px] text-gray-400">High stock</div>
                  </div>
                </div>
              </div>
            </div>

            <div
              className="rounded-2xl p-6 mb-6"
              style={{ background: 'rgba(17,24,39,0.7)', border: '1px solid rgba(255,255,255,0.05)' }}
            >
              <h2 className="text-white font-semibold mb-5">Find Surplus Stock Nearby</h2>

              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_160px_auto] gap-4 items-end mb-6">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Select Medicine</label>
                  <select
                    value={selectedMedicine}
                    onChange={(e) => handleMedicineChange(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-sm text-white focus:outline-none"
                    style={{ background: 'rgba(31,41,55,0.8)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    <option value="">Choose a medicine from your DB stock...</option>
                    {medicineOptions.map((medicine) => (
                      <option key={medicine} value={medicine}>
                        {medicine}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Request Qty</label>
                  <input
                    type="number"
                    min={1}
                    value={requestQty}
                    onChange={(e) => {
                      setRequestQty(Number(e.target.value) || 1);
                      setMatches([]);
                      setError('');
                    }}
                    className="w-full px-4 py-3 rounded-xl text-sm text-white focus:outline-none"
                    style={{ background: 'rgba(31,41,55,0.8)', border: '1px solid rgba(255,255,255,0.08)' }}
                  />
                </div>

                <button
                  onClick={handleFindMatches}
                  disabled={!selectedMedicine || searching}
                  className="px-6 py-3 rounded-xl font-medium text-sm text-white transition-all"
                  style={{
                    background: !selectedMedicine || searching
                      ? 'rgba(16,185,129,0.30)'
                      : 'linear-gradient(135deg, #10b981, #059669)',
                    cursor: !selectedMedicine || searching ? 'not-allowed' : 'pointer',
                  }}
                >
                  {searching ? 'Searching...' : 'Find Matches'}
                </button>
              </div>

              {selectedMedicine && selectedStock && (
                <div
                  className="mb-4 flex flex-wrap items-center gap-3 rounded-xl px-4 py-3"
                  style={{ background: 'rgba(31,41,55,0.55)', border: '1px solid rgba(255,255,255,0.05)' }}
                >
                  <span
                    className="text-xs font-semibold px-2 py-1 rounded"
                    style={{ color: toneStyles[selectedTone].color, background: `${toneStyles[selectedTone].color}18` }}
                  >
                    {toneStyles[selectedTone].label}
                  </span>
                  <span className="text-xs text-gray-300">
                    Current stock: {selectedStock.quantity} units
                  </span>
                  <span className="text-xs text-gray-500">
                    Suggested transfer qty: {getSuggestedQuantity(selectedStock, selectedForecast)}
                  </span>
                </div>
              )}

              {error && (
                <div
                  className="mb-4 p-3 rounded-lg text-sm"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}
                >
                  {error}
                </div>
              )}

              {success && (
                <div
                  className="mb-4 p-3 rounded-lg text-sm"
                  style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#6ee7b7' }}
                >
                  {success}
                </div>
              )}

              {matches.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-300 mb-3">
                    AI-Ranked Matches for <span className="text-emerald-400">{selectedMedicine}</span>
                  </h3>
                  <div className="space-y-3">
                    {matches.map((match, index) => (
                      <div
                        key={match.phc_id}
                        className="flex items-center justify-between gap-4 px-5 py-4 rounded-xl transition-all hover:scale-[1.01]"
                        style={{
                          background: index === 0 ? 'rgba(16,185,129,0.08)' : 'rgba(31,41,55,0.6)',
                          border: `1px solid ${index === 0 ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.04)'}`,
                        }}
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-white">{match.phc_name}</div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {match.distance_km} km away | {match.available_surplus} units surplus | Expires{' '}
                            {new Date(match.expiry_date).toLocaleDateString('en-IN')}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <div className="text-xs text-gray-500">Match Score</div>
                            <div className="text-sm font-bold" style={{ color: match.similarity_score >= 0.7 ? '#10b981' : '#f59e0b' }}>
                              {Math.round(match.similarity_score * 100)}%
                            </div>
                          </div>
                          <button
                            onClick={() => handleCreateTransfer(match)}
                            disabled={creating === match.phc_id}
                            className="px-4 py-2 rounded-xl text-xs font-medium text-white transition-all"
                            style={{
                              background: creating === match.phc_id
                                ? 'rgba(16,185,129,0.30)'
                                : 'linear-gradient(135deg, #10b981, #059669)',
                              cursor: creating === match.phc_id ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {creating === match.phc_id ? 'Sending...' : 'Transfer'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!searching && matches.length === 0 && !error && selectedMedicine && (
                <div className="text-center py-10">
                  <p className="text-gray-500 text-sm">
                    Click "Find Matches" to search for nearby PHCs with surplus {selectedMedicine}.
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
