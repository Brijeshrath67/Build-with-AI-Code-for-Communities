'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../../components/common/Sidebar';
import { getActiveAlerts } from '../../services/api';

interface Alert {
  id: number;
  phc_id: number;
  message: string;
  severity: string;
  created_at: string;
  resolved_at?: string;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const t = localStorage.getItem('phc_token');
    const s = localStorage.getItem('phc_user');
    if (!t) { router.push('/login'); return; }
    if (s) setUser(JSON.parse(s));
  }, []);

  useEffect(() => {
    if (!user) return;
    getActiveAlerts(user?.phc_id)
      .then(res => setAlerts(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  const severityMeta: Record<string, any> = {
    high: { color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.15)', icon: '🚨', label: 'Critical' },
    medium: { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.15)', icon: '⚠️', label: 'Warning' },
    low: { color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.15)', icon: 'ℹ️', label: 'Info' },
  };

  const filtered = filter === 'all' ? alerts : alerts.filter(a => a.severity === filter);

  return (
    <div className="flex min-h-screen" style={{ background: '#030712' }}>
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Active Alerts</h1>
          <p className="text-gray-400 text-sm mt-1">{alerts.length} alert{alerts.length !== 1 ? 's' : ''} requiring attention</p>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6">
          {['all', 'high', 'medium', 'low'].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className="px-4 py-1.5 rounded-lg text-xs font-medium capitalize transition-all"
              style={{
                background: filter === s ? 'rgba(16,185,129,0.15)' : 'rgba(31,41,55,0.5)',
                color: filter === s ? '#34d399' : '#9ca3af',
                border: `1px solid ${filter === s ? 'rgba(16,185,129,0.3)' : 'transparent'}`,
              }}>
              {s === 'all' ? `All (${alerts.length})` : `${s} (${alerts.filter(a => a.severity === s).length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-500 text-sm">Loading alerts...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-5xl mb-4">✅</div>
            <p className="text-gray-400 font-medium">No alerts found</p>
            <p className="text-gray-600 text-sm mt-1">All medicine levels are within safe thresholds</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(a => {
              const meta = severityMeta[a.severity] || severityMeta.low;
              return (
                <div key={a.id} className="flex items-start gap-4 px-5 py-4 rounded-2xl transition-all"
                  style={{ background: meta.bg, border: `1px solid ${meta.border}` }}>
                  <span className="text-xl mt-0.5 flex-shrink-0">{meta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 leading-relaxed">{a.message}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md"
                        style={{ background: `${meta.color}20`, color: meta.color }}>
                        {meta.label}
                      </span>
                      <span className="text-xs text-gray-500">PHC #{a.phc_id}</span>
                      {a.created_at && (
                        <span className="text-xs text-gray-600">{new Date(a.created_at).toLocaleString('en-IN')}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
