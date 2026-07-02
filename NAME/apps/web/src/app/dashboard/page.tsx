'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../../components/common/Sidebar';
import { getForecasts, getActiveAlerts, getTransferLedger, getStock } from '../../services/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface Alert { id: number; message: string; severity: string; phc_id: number; created_at: string; }
interface Forecast { id: number; medicine: string; risk_score: string; stockout_date: string; }
interface Transfer { id: number; medicine: string; quantity: number; status: string; source_phc: any; destination_phc: any; created_at: string; }
interface StockItem { medicine: string; quantity: number; expiry_date: string; }

const riskColors: Record<string, string> = { HIGH: '#ef4444', MEDIUM: '#f59e0b', LOW: '#10b981' };
const statusColors: Record<string, string> = { pending: '#f59e0b', approved: '#3b82f6', completed: '#10b981', rejected: '#ef4444' };

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);

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
    const phcId = user.phc_id;

    const fetchData = async () => {
      // Load alerts and transfers first (don't block on PHC-specific data)
      const [alertsResult, transfersResult] = await Promise.allSettled([
        getActiveAlerts(phcId),
        getTransferLedger(),
      ]);
      if (alertsResult.status === 'fulfilled') setAlerts(alertsResult.value.data?.slice(0, 5) || []);
      if (transfersResult.status === 'fulfilled') setTransfers(transfersResult.value.data?.slice(0, 5) || []);

      // Load stock and forecasts independently — each failure is caught separately
      if (phcId) {
        const [forecastsResult, stocksResult] = await Promise.allSettled([
          getForecasts(phcId),
          getStock(phcId),
        ]);
        if (forecastsResult.status === 'fulfilled') {
          setForecasts(forecastsResult.value.data || []);
        } else {
          console.warn('Forecasts failed to load:', forecastsResult.reason);
        }
        if (stocksResult.status === 'fulfilled') {
          setStocks(stocksResult.value.data || []);
        } else {
          console.warn('Stocks failed to load:', stocksResult.reason);
        }
      }

      setLoading(false);
    };

    fetchData();
  }, [user]);


  const highRiskCount = forecasts.filter(f => f.risk_score === 'HIGH').length;
  const medRiskCount = forecasts.filter(f => f.risk_score === 'MEDIUM').length;
  const pendingTransfers = transfers.filter(t => t.status === 'pending').length;

  const stockChartData = stocks.map(s => ({
    name: s.medicine.replace(' 500mg', '').replace(' 400mg', '').replace(' 10mg', ''),
    quantity: s.quantity,
  }));

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: '#030712' }}>
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen" style={{ background: '#030712' }}>
      <Sidebar />
      <main className="flex-1 ml-64 p-8 overflow-y-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">
            Welcome back, <span style={{ color: '#10b981' }}>{user?.name}</span>
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            {user?.role} · {user?.phc_id ? `PHC ${user.phc_id}` : 'All Districts'} · {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'High Risk Stockouts', value: highRiskCount, icon: '🚨', color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)' },
            { label: 'Medium Risk Items', value: medRiskCount, icon: '⚠️', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' },
            { label: 'Pending Transfers', value: pendingTransfers, icon: '🔄', color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)' },
            { label: 'Active Alerts', value: alerts.length, icon: '🔔', color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.2)' },
          ].map(card => (
            <div key={card.label} className="rounded-2xl p-5 transition-all hover:scale-[1.02]"
              style={{ background: card.bg, border: `1px solid ${card.border}` }}>
              <div className="text-2xl mb-3">{card.icon}</div>
              <div className="text-3xl font-bold mb-1" style={{ color: card.color }}>{card.value}</div>
              <div className="text-xs text-gray-400 font-medium">{card.label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Stock Chart */}
          <div className="rounded-2xl p-6" style={{ background: 'rgba(17,24,39,0.7)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-semibold">Current Stock Levels</h2>
              <a href="/inventory" className="text-xs font-medium" style={{ color: '#10b981' }}>View All →</a>
            </div>
            {stocks.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stockChartData} barSize={32}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#f3f4f6' }}
                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                  />
                  <Bar dataKey="quantity" radius={[6, 6, 0, 0]}>
                    {stockChartData.map((entry, index) => (
                      <Cell key={index} fill={entry.quantity <= 20 ? '#ef4444' : entry.quantity <= 100 ? '#f59e0b' : '#10b981'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-500 text-sm">No stock data available</div>
            )}
          </div>

          {/* Forecasts */}
          <div className="rounded-2xl p-6" style={{ background: 'rgba(17,24,39,0.7)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-semibold">AI Stockout Forecasts</h2>
              <span className="text-xs text-gray-500">Next 30 days</span>
            </div>
            {forecasts.length > 0 ? (
              <div className="space-y-3">
                {forecasts.map(f => (
                  <div key={f.id} className="flex items-center justify-between px-4 py-3 rounded-xl"
                    style={{ background: 'rgba(31,41,55,0.6)' }}>
                    <div>
                      <div className="text-sm font-medium text-white">{f.medicine}</div>
                      <div className="text-xs text-gray-500 mt-0.5">Stockout by {new Date(f.stockout_date).toLocaleDateString('en-IN')}</div>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                      style={{ background: `${riskColors[f.risk_score]}18`, color: riskColors[f.risk_score], border: `1px solid ${riskColors[f.risk_score]}30` }}>
                      {f.risk_score}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-500 text-sm">
                <div className="text-center">
                  <div className="text-4xl mb-2">✅</div>
                  <p>No stockout risks detected</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Alerts & Recent Transfers */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Active Alerts */}
          <div className="rounded-2xl p-6" style={{ background: 'rgba(17,24,39,0.7)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-semibold">Active Alerts</h2>
              <a href="/notifications" className="text-xs font-medium" style={{ color: '#10b981' }}>View All →</a>
            </div>
            {alerts.length > 0 ? (
              <div className="space-y-3">
                {alerts.map(a => (
                  <div key={a.id} className="flex items-start gap-3 px-4 py-3 rounded-xl"
                    style={{ background: a.severity === 'high' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)', border: `1px solid ${a.severity === 'high' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)'}` }}>
                    <span className="text-base mt-0.5">{a.severity === 'high' ? '🚨' : '⚠️'}</span>
                    <p className="text-xs text-gray-300 leading-relaxed">{a.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-32 flex items-center justify-center text-gray-500 text-sm">No active alerts</div>
            )}
          </div>

          {/* Recent Transfers */}
          <div className="rounded-2xl p-6" style={{ background: 'rgba(17,24,39,0.7)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-semibold">Recent Transfers</h2>
              <a href="/transfers" className="text-xs font-medium" style={{ color: '#10b981' }}>View Ledger →</a>
            </div>
            {transfers.length > 0 ? (
              <div className="space-y-3">
                {transfers.map(t => (
                  <div key={t.id} className="flex items-center justify-between px-4 py-3 rounded-xl"
                    style={{ background: 'rgba(31,41,55,0.6)' }}>
                    <div>
                      <div className="text-sm font-medium text-white">{t.quantity} × {t.medicine}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {t.source_phc?.name} → {t.destination_phc?.name}
                      </div>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-lg capitalize"
                      style={{ background: `${statusColors[t.status] || '#6b7280'}18`, color: statusColors[t.status] || '#6b7280' }}>
                      {t.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-32 flex items-center justify-center text-gray-500 text-sm">No transfers recorded</div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
