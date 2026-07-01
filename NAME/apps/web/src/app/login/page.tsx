'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '../../services/api';

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Demo credentials for quick login
  const demoUsers = [
    { label: 'ASHA Worker', phone: '8888888888', role: 'ASHA Worker' },
    { label: 'PHC Staff (Unit-9)', phone: '7777777777', role: 'PHC Staff' },
    { label: 'District Officer', phone: '5555555555', role: 'District Health Official' },
    { label: 'System Admin', phone: '9999999999', role: 'System Admin' },
  ];

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('phc_token')) {
      router.push('/dashboard');
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await login(phone, password);
      const { access_token, user } = res.data;
      localStorage.setItem('phc_token', access_token);
      localStorage.setItem('phc_user', JSON.stringify(user));
      document.cookie = `phc_token=${access_token}; path=/; max-age=86400; SameSite=Lax`;
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (demoPhone: string) => {
    setPhone(demoPhone);
    setPassword('password123');
    setLoading(true);
    setError('');
    try {
      const res = await login(demoPhone, 'password123');
      const { access_token, user } = res.data;
      localStorage.setItem('phc_token', access_token);
      localStorage.setItem('phc_user', JSON.stringify(user));
      document.cookie = `phc_token=${access_token}; path=/; max-age=86400; SameSite=Lax`;
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Demo login failed. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(135deg, #030712 0%, #0a1628 50%, #030712 100%)' }}>
      {/* Left panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center items-center p-16 relative overflow-hidden">
        {/* Animated glow circles */}
        <div className="absolute w-96 h-96 rounded-full opacity-10 animate-pulse" style={{ background: 'radial-gradient(circle, #10b981, transparent)', top: '10%', left: '5%' }} />
        <div className="absolute w-64 h-64 rounded-full opacity-5 animate-pulse" style={{ background: 'radial-gradient(circle, #3b82f6, transparent)', bottom: '20%', right: '10%', animationDelay: '1s' }} />

        <div className="relative z-10 text-center max-w-lg">
          {/* Logo */}
          <div className="flex items-center justify-center mb-8">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mr-4" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
              <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <h1 className="text-4xl font-bold text-white">PHC Exchange</h1>
          </div>

          <p className="text-2xl font-semibold text-emerald-400 mb-4">AI-Powered Medicine Redistribution</p>
          <p className="text-gray-400 text-lg leading-relaxed mb-12">
            Prevent stockouts and expiry waste by enabling AI-assisted lateral redistribution between nearby Primary Health Centres.
          </p>

          {/* Feature pills */}
          <div className="grid grid-cols-2 gap-3">
            {[
              '🤖 AI Demand Forecasting',
              '🗺️ Geospatial Matching',
              '📦 Real-time Inventory',
              '🔄 Lateral Redistribution',
              '💬 NL Query Assistant',
              '📶 Offline-first Sync',
            ].map((feature) => (
              <div key={feature} className="text-left text-sm px-3 py-2 rounded-lg text-gray-300" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
                {feature}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel - Login form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center mb-8">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mr-3" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">PHC Exchange</h1>
          </div>

          <div className="rounded-2xl p-8" style={{ background: 'rgba(17,24,39,0.8)', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)' }}>
            <h2 className="text-2xl font-bold text-white mb-2">Welcome back</h2>
            <p className="text-gray-400 text-sm mb-8">Sign in to manage your PHC network</p>

            {error && (
              <div className="mb-4 p-3 rounded-lg text-sm text-red-300" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Phone Number</label>
                <input
                  id="phone-input"
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Enter your phone number"
                  required
                  className="w-full px-4 py-3 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none transition-all"
                  style={{ background: 'rgba(31,41,55,0.8)', border: '1px solid rgba(255,255,255,0.08)' }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Password</label>
                <input
                  id="password-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full px-4 py-3 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none transition-all"
                  style={{ background: 'rgba(31,41,55,0.8)', border: '1px solid rgba(255,255,255,0.08)' }}
                />
              </div>

              <button
                id="login-btn"
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl font-semibold text-white transition-all text-sm mt-2"
                style={{ background: loading ? 'rgba(16,185,129,0.4)' : 'linear-gradient(135deg, #10b981, #059669)', cursor: loading ? 'not-allowed' : 'pointer' }}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            {/* Demo Quick Access */}
            <div className="mt-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.06)' }} />
                <span className="text-xs text-gray-500 font-medium">DEMO ACCESS</span>
                <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.06)' }} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {demoUsers.map((u) => (
                  <button
                    key={u.phone}
                    id={`demo-${u.phone}`}
                    onClick={() => handleDemoLogin(u.phone)}
                    disabled={loading}
                    className="text-left px-3 py-2.5 rounded-lg text-xs transition-all"
                    style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.12)', color: '#6ee7b7' }}
                  >
                    <div className="font-medium">{u.label}</div>
                    <div className="text-gray-500 mt-0.5">{u.role}</div>
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-600 mt-3 text-center">All demo accounts use password: <span className="text-gray-400">password123</span></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
