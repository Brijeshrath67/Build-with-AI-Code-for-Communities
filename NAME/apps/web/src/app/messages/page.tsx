'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../../components/common/Sidebar';
import { sendBroadcastMessage } from '../../services/api';

export default function MessagesPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high'>('medium');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState('');

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
      const parsed = JSON.parse(stored);
      setUser(parsed);
      if (!['District Health Official', 'System Admin'].includes(parsed?.role)) {
        router.replace('/dashboard');
      }
    } catch (e) {
      router.push('/login');
    }
  }, [router]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      setStatus('Title and message are required.');
      return;
    }
    setSending(true);
    setStatus('');
    try {
      const res = await sendBroadcastMessage({
        title: title.trim(),
        message: message.trim(),
        severity,
      });
      setTitle('');
      setMessage('');
      setSeverity('medium');
      setStatus(res.data?.detail || 'Broadcast sent.');
    } catch (err: any) {
      setStatus(err.response?.data?.detail || 'Failed to send broadcast.');
    } finally {
      setSending(false);
    }
  };

  const isAllowed = user && ['District Health Official', 'System Admin'].includes(user.role);
  if (user && !isAllowed) return null;

  return (
    <div className="flex min-h-screen" style={{ background: '#030712' }}>
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Messages</h1>
          <p className="text-gray-400 text-sm mt-1">
            Send read-only notices to PHC Staff and ASHA Workers. They can view these in notifications but cannot reply.
          </p>
        </div>

        <div className="max-w-3xl rounded-2xl p-6" style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.08)' }}>
          <form className="space-y-4" onSubmit={handleSend}>
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">Title</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Example: Stock movement advisory"
                className="w-full px-4 py-2.5 rounded-xl text-sm text-white focus:outline-none"
                style={{ background: 'rgba(31,41,55,0.8)', border: '1px solid rgba(255,255,255,0.08)' }}
              />
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-1.5">Message</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={6}
                placeholder="Write the notice for PHC Staff and ASHA Workers..."
                className="w-full px-4 py-2.5 rounded-xl text-sm text-white focus:outline-none resize-none"
                style={{ background: 'rgba(31,41,55,0.8)', border: '1px solid rgba(255,255,255,0.08)' }}
              />
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-1.5">Severity</label>
              <select
                value={severity}
                onChange={e => setSeverity(e.target.value as 'low' | 'medium' | 'high')}
                className="w-full px-4 py-2.5 rounded-xl text-sm text-white focus:outline-none"
                style={{ background: 'rgba(31,41,55,0.8)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <p className="text-xs text-gray-500">This creates a read-only notice for PHC Staff and ASHA Workers across the network.</p>
              <button
                type="submit"
                disabled={sending}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
              >
                {sending ? 'Sending...' : 'Send Message'}
              </button>
            </div>
          </form>

          {status && (
            <div className="mt-4 text-sm text-gray-200" style={{ color: status.includes('Failed') ? '#f87171' : '#6ee7b7' }}>
              {status}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
