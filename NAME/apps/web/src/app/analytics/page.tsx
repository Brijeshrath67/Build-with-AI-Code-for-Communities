'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Sidebar from '../../components/common/Sidebar';
import { getDistrictDashboard } from '../../services/api';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

// Dynamic import for map to avoid SSR issues with Leaflet
const PHCMap = dynamic(() => import('../../components/maps/PHCMap'), { ssr: false, loading: () => (
  <div className="h-96 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(17,24,39,0.7)' }}>
    <p className="text-gray-500 text-sm">Loading map...</p>
  </div>
)});

export default function AnalyticsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [data, setData] = useState<any>(null);
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
    const district = user.role === 'District Health Official' || user.role === 'System Admin' ? 'all' : 'Bangalore Urban';
    getDistrictDashboard(district)
      .then(res => setData(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [user]);

  const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#a78bfa', '#ef4444'];

  const pieData = data?.stock_summaries?.slice(0, 5).map((s: any) => ({
    name: s.medicine.replace(' 500mg', '').replace(' 400mg', '').replace(' 10mg', ''),
    value: s.total_quantity,
  })) || [];

  const barData = data?.stock_summaries?.map((s: any) => ({
    name: s.medicine.replace(' 500mg', '').replace(' 400mg', '').replace(' 10mg', ''),
    shortage: s.shortage_phcs_count,
    surplus: s.surplus_phcs_count,
  })) || [];

  return (
    <div className="flex min-h-screen" style={{ background: '#030712' }}>
      <Sidebar />
      <main className="flex-1 ml-64 p-8 overflow-y-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">District Analytics</h1>
          <p className="text-gray-400 text-sm mt-1">
            {data?.district_name || 'Loading...'} · Live inventory and redistribution overview
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-32 text-gray-500 text-sm">Loading analytics...</div>
        ) : (
          <>
            {/* KPI row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[
                { label: 'PHCs in Network', value: data?.total_phcs ?? 0, icon: '🏥', color: '#3b82f6' },
                { label: 'Predicted Stockouts', value: data?.total_stockouts_predicted ?? 0, icon: '⚠️', color: '#ef4444' },
                { label: 'Active Alerts', value: data?.active_alerts_count ?? 0, icon: '🔔', color: '#f59e0b' },
                { label: 'Pending Transfers', value: data?.pending_transfers_count ?? 0, icon: '🔄', color: '#10b981' },
              ].map(card => (
                <div key={card.label} className="rounded-2xl p-5"
                  style={{ background: 'rgba(17,24,39,0.7)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="text-2xl mb-2">{card.icon}</div>
                  <div className="text-3xl font-bold mb-1" style={{ color: card.color }}>{card.value}</div>
                  <div className="text-xs text-gray-500">{card.label}</div>
                </div>
              ))}
            </div>

            {/* Map */}
            <div className="mb-6 rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="px-6 py-4 flex items-center justify-between" style={{ background: 'rgba(17,24,39,0.7)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <h2 className="text-white font-semibold">PHC Network Map</h2>
                <span className="text-xs text-gray-500">Showing all registered PHCs with stock status</span>
              </div>
              <PHCMap />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Pie Chart */}
              <div className="rounded-2xl p-6" style={{ background: 'rgba(17,24,39,0.7)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h2 className="text-white font-semibold mb-5">Medicine Distribution</h2>
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value">
                        {pieData.map((_: any, index: number) => (
                          <Cell key={index} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#f3f4f6', fontSize: '12px' }} />
                      <Legend formatter={(value) => <span style={{ color: '#9ca3af', fontSize: '12px' }}>{value}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-48 flex items-center justify-center text-gray-500 text-sm">No data</div>
                )}
              </div>

              {/* Shortage vs Surplus Bar chart */}
              <div className="rounded-2xl p-6" style={{ background: 'rgba(17,24,39,0.7)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h2 className="text-white font-semibold mb-5">Shortage vs Surplus by Medicine</h2>
                {barData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={barData} barSize={20}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#f3f4f6', fontSize: '12px' }} />
                      <Legend formatter={(value) => <span style={{ color: '#9ca3af', fontSize: '12px' }}>{value}</span>} />
                      <Bar dataKey="shortage" name="Shortage PHCs" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="surplus" name="Surplus PHCs" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-48 flex items-center justify-center text-gray-500 text-sm">No data</div>
                )}
              </div>
            </div>

            {/* Recent Transfers */}
            {data?.recent_transfers?.length > 0 && (
              <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(17,24,39,0.7)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <h2 className="text-white font-semibold">District Transfer History</h2>
                </div>
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      {['Medicine', 'Qty', 'From', 'To', 'Status', 'Date'].map(h => (
                        <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold uppercase text-gray-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent_transfers.slice(0, 8).map((t: any, idx: number) => (
                      <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td className="px-5 py-3.5 text-sm text-white">{t.medicine}</td>
                        <td className="px-5 py-3.5 text-sm font-bold text-emerald-400">{t.quantity}</td>
                        <td className="px-5 py-3.5 text-xs text-gray-300">{t.source_phc?.name}</td>
                        <td className="px-5 py-3.5 text-xs text-gray-300">{t.destination_phc?.name}</td>
                        <td className="px-5 py-3.5">
                          <span className="text-xs px-2 py-1 rounded-md capitalize"
                            style={{ background: t.status === 'completed' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)', color: t.status === 'completed' ? '#10b981' : '#f59e0b' }}>
                            {t.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-gray-500">{new Date(t.created_at).toLocaleDateString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
