'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../../components/common/Sidebar';
import {
  getNotificationInbox,
  getNotificationHistory,
  markAlertAsRead,
} from '../../services/api';

interface Alert {
  id: number;
  phc_id: number;
  message: string;
  severity: string;
  created_at: string;
  resolved_at?: string;
}

const isInboxItem = (message: string) =>
  message.startsWith('[TRANSFER]') || message.startsWith('[DHO]');

const stripPrefix = (message: string) =>
  message.replace(/^\[(TRANSFER|DHO)\]\s*/, '');

const kindLabel = (message: string) =>
  message.startsWith('[DHO]') ? 'DHO Message' : 'Transfer Update';

export default function NotificationsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [historyAlerts, setHistoryAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [activeTab, setActiveTab] = useState<'unread' | 'history'>('unread');

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
  }, [router]);

  const fetchData = async (currentUser: any) => {
    setLoading(true);
    try {
      const [inboxResult, historyResult] = await Promise.allSettled([
        getNotificationInbox(currentUser?.phc_id),
        getNotificationHistory(currentUser?.phc_id),
      ]);

      if (inboxResult.status === 'fulfilled') {
        setAlerts((inboxResult.value.data || []).filter((a: Alert) => isInboxItem(a.message)));
      } else {
        console.error('Notification inbox fetch failed:', inboxResult.reason);
      }

      if (historyResult.status === 'fulfilled') {
        setHistoryAlerts((historyResult.value.data || []).filter((a: Alert) => isInboxItem(a.message)));
      } else {
        console.error('Notification history fetch failed:', historyResult.reason);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchData(user);
  }, [user]);

  const handleMarkAsRead = async (id: number) => {
    try {
      await markAlertAsRead(id);
      fetchData(user);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to mark as read');
    }
  };

  const severityMeta: Record<string, any> = {
    high: { color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.15)', icon: '🚨', label: 'Critical' },
    medium: { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.15)', icon: '⚠️', label: 'Warning' },
    low: { color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.15)', icon: 'ℹ️', label: 'Info' },
  };

  const currentAlerts = activeTab === 'unread' ? alerts : historyAlerts;
  const filteredAlerts = filter === 'all' ? currentAlerts : currentAlerts.filter(a => a.severity === filter);
  const totalNotifications = alerts.length;

  return (
    <div className="flex min-h-screen" style={{ background: '#030712' }}>
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Alerts & Notifications</h1>
          <p className="text-gray-400 text-sm mt-1">{totalNotifications} notification{totalNotifications !== 1 ? 's' : ''} in inbox</p>
        </div>

        <div>
          <div className="flex border-b border-gray-800 mb-6 gap-6">
            <button
              onClick={() => setActiveTab('unread')}
              className={`pb-3 text-sm font-semibold transition-all ${activeTab === 'unread' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-gray-400 hover:text-white'}`}
            >
              Inbox ({alerts.length})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`pb-3 text-sm font-semibold transition-all ${activeTab === 'history' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-gray-400 hover:text-white'}`}
            >
              History ({historyAlerts.length})
            </button>
          </div>

          <div className="flex gap-2 mb-4">
            {['all', 'high', 'medium', 'low'].map(s => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className="px-4 py-1.5 rounded-lg text-xs font-medium capitalize transition-all"
                style={{
                  background: filter === s ? 'rgba(16,185,129,0.15)' : 'rgba(31,41,55,0.5)',
                  color: filter === s ? '#34d399' : '#9ca3af',
                  border: `1px solid ${filter === s ? 'rgba(16,185,129,0.3)' : 'transparent'}`,
                }}
              >
                {s === 'all'
                  ? `All (${currentAlerts.length})`
                  : `${s} (${currentAlerts.filter(a => a.severity === s).length})`}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="text-center py-16 text-gray-500 text-sm">Loading notifications...</div>
          ) : filteredAlerts.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-4">✅</div>
              <p className="text-gray-400 font-medium">No notifications found</p>
              <p className="text-gray-600 text-sm mt-1">No inbox items match the selected filter</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAlerts.map(a => {
                const meta = severityMeta[a.severity] || severityMeta.low;
                return (
                  <div
                    key={a.id}
                    className="flex items-start justify-between gap-4 px-5 py-4 rounded-2xl transition-all"
                    style={{ background: meta.bg, border: `1px solid ${meta.border}` }}
                  >
                    <div className="flex items-start gap-4">
                      <span className="text-xl mt-0.5 flex-shrink-0">{meta.icon}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] px-2 py-0.5 rounded font-semibold uppercase"
                            style={{ background: `${meta.color}20`, color: meta.color }}>
                            {meta.label}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded font-semibold uppercase text-gray-300 bg-gray-800">
                            {kindLabel(a.message)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-200 leading-relaxed">{stripPrefix(a.message)}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-gray-500">PHC #{a.phc_id}</span>
                          {a.created_at && (
                            <span className="text-xs text-gray-600">{new Date(a.created_at).toLocaleString('en-IN')}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {activeTab === 'unread' && (
                      <button
                        onClick={() => handleMarkAsRead(a.id)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg border flex-shrink-0 hover:bg-gray-800 transition-all text-gray-300 border-gray-700"
                      >
                        ✓ Mark as Read
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
