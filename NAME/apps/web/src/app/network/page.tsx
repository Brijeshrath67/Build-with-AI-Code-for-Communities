'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../../components/common/Sidebar';
import { getNetworkStatus, reassignDoctor } from '../../services/api';

interface PHCStock {
  medicine: string;
  quantity: number;
  expiry_date: string;
}

interface PHCDoctor {
  id: number;
  name: string;
  phone: string;
  status: string;
}

interface PHC {
  id: number;
  name: string;
  district: string;
  type: string;
  latitude: number;
  longitude: number;
  stocks: PHCStock[];
  doctors: PHCDoctor[];
  distance?: number;
}

export default function NetworkPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [phcs, setPhcs] = useState<PHC[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal / Side panel state
  const [selectedPhc, setSelectedPhc] = useState<PHC | null>(null);
  const [reassignTargets, setReassignTargets] = useState<Record<number, number>>({});
  const [shuffling, setShuffling] = useState<number | null>(null);
  const isAllowedRole = user?.role === 'District Health Official' || user?.role === 'System Admin';

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
    if (!isAllowedRole) {
      router.replace('/dashboard');
    }
  }, [user, isAllowedRole, router]);

  const fetchNetworkData = async () => {
    if (!user || !isAllowedRole) return;
    try {
      const res = await getNetworkStatus();
      const rawPhcs: PHC[] = res.data?.phcs || [];

      // Find user's PHC coordinates to compute distances
      const userPhcId = user.phc_id;
      const userPhc = rawPhcs.find(p => p.id === userPhcId);

      let processedPhcs = rawPhcs;

      if (userPhc) {
        // Compute Haversine distance from user's PHC
        processedPhcs = rawPhcs.map(phc => {
          if (phc.id === userPhcId) {
            return { ...phc, distance: 0 };
          }
          const R = 6371; // Earth radius in km
          const dLat = ((phc.latitude - userPhc.latitude) * Math.PI) / 180;
          const dLon = ((phc.longitude - userPhc.longitude) * Math.PI) / 180;
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((userPhc.latitude * Math.PI) / 180) *
              Math.cos((phc.latitude * Math.PI) / 180) *
              Math.sin(dLon / 2) *
              Math.sin(dLon / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const distance = R * c;
          return { ...phc, distance: Math.round(distance * 10) / 10 };
        });

        // Sort by distance
        processedPhcs.sort((a, b) => (a.distance || 0) - (b.distance || 0));
      }

      setPhcs(processedPhcs);
      
      // Update selected PHC reference if modal is open
      if (selectedPhc) {
        const updated = processedPhcs.find(p => p.id === selectedPhc.id);
        if (updated) setSelectedPhc(updated);
      }
    } catch (err) {
      console.error('Error fetching network status:', err);
      setError('Failed to load network stock data. Please check if the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchNetworkData();
  }, [user]);

  const handleDoctorReassign = async (doctorId: number) => {
    const targetPhcId = reassignTargets[doctorId];
    if (!targetPhcId) {
      alert('Please select a target health facility to reassign to.');
      return;
    }
    const targetPhc = phcs.find(p => p.id === targetPhcId);
    if (!confirm(`Are you sure you want to reassign this doctor to ${targetPhc?.name}?`)) return;
    
    setShuffling(doctorId);
    try {
      await reassignDoctor(doctorId, targetPhcId);
      alert('Doctor successfully reassigned!');
      await fetchNetworkData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Reassignment failed');
    } finally {
      setShuffling(null);
    }
  };

  // Filter PHCs or medicines based on search query
  const filteredPhcs = phcs.filter(phc => {
    const matchesPhcName = phc.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPhcId = String(phc.id).includes(searchQuery.trim());
    const matchesMedicine = phc.stocks.some(s =>
      s.medicine.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return matchesPhcName || matchesPhcId || matchesMedicine;
  });

  const isDistrictOfficer = isAllowedRole;

  if (user && !isAllowedRole) {
    return null;
  }

  return (
    <div className="flex min-h-screen" style={{ background: '#030712' }}>
      <Sidebar />
      <main className="flex-1 ml-64 p-8 overflow-y-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">PHC Network Overview</h1>
            <p className="text-gray-400 text-sm mt-1">
              {isDistrictOfficer
                ? 'District-wide healthcare facility overview. Click on any facility to view stock details, appointed doctors, and reassign staff.'
                : 'All health center inventories in the network.'}
            </p>
          </div>
          {/* Search bar */}
          <div className="relative w-full md:w-80">
            <input
              type="text"
              placeholder="Search by PHC, ID, or Medicine..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2.5 pl-10 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none transition-all"
              style={{ background: 'rgba(17,24,39,0.8)', border: '1px solid rgba(255,255,255,0.07)' }}
            />
            <span className="absolute left-3.5 top-3.5 text-gray-500">🔍</span>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl text-sm text-red-300" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex h-[50vh] items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-400 text-sm">Loading PHC network data...</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredPhcs.map(phc => {
              const isOwnPhc = phc.id === user?.phc_id;
              return (
                <div
                  key={phc.id}
                  onClick={() => isDistrictOfficer && setSelectedPhc(phc)}
                  className={`rounded-2xl p-6 transition-all hover:scale-[1.01] ${isDistrictOfficer ? 'cursor-pointer hover:border-emerald-500/40' : ''}`}
                  style={{
                    background: isOwnPhc ? 'rgba(16,185,129,0.04)' : 'rgba(17,24,39,0.7)',
                    border: isOwnPhc ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  {/* PHC Info header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-white">{phc.name}</span>
                        {isOwnPhc && (
                          <span
                            className="text-[10px] px-2 py-0.5 rounded font-semibold uppercase"
                            style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}
                          >
                            My PHC
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 mt-1 block">
                        PHC #{phc.id} · {phc.type} · {phc.district}
                      </span>
                    </div>
                    {phc.distance !== undefined && (
                      <span
                        className="text-xs px-2.5 py-1 rounded-lg font-semibold"
                        style={{
                          background: isOwnPhc ? 'rgba(16,185,129,0.1)' : 'rgba(59,130,246,0.1)',
                          color: isOwnPhc ? '#10b981' : '#3b82f6',
                        }}
                      >
                        {phc.distance === 0 ? 'Here' : `${phc.distance} km`}
                      </span>
                    )}
                  </div>

                  {/* Stock List (Brief Overview) */}
                  <div className="mt-4 border-t pt-4" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Medicines Stocks</h3>
                      {isDistrictOfficer && <span className="text-xs text-emerald-400">View Details & Docs →</span>}
                    </div>
                    <div className="space-y-2">
                      {phc.stocks.slice(0, 3).map(s => {
                        const isLow = s.quantity <= 20;
                        const isSurplus = s.quantity >= 300;
                        let pillBg = 'rgba(75,85,99,0.15)';
                        let pillColor = '#9ca3af';

                        if (isLow) {
                          pillBg = 'rgba(239,68,68,0.12)';
                          pillColor = '#f87171';
                        } else if (isSurplus) {
                          pillBg = 'rgba(16,185,129,0.12)';
                          pillColor = '#34d399';
                        }

                        return (
                          <div
                            key={s.medicine}
                            className="flex items-center justify-between p-2 rounded-xl text-sm"
                            style={{ background: 'rgba(255,255,255,0.01)' }}
                          >
                            <span className="text-gray-300 font-medium text-xs">{s.medicine}</span>
                            <span
                              className="text-[10px] font-semibold px-2 py-0.5 rounded"
                              style={{ background: pillBg, color: pillColor }}
                            >
                              {s.quantity} units
                            </span>
                          </div>
                        );
                      })}
                      {phc.stocks.length > 3 && (
                        <p className="text-[10px] text-gray-500 text-right">+ {phc.stocks.length - 3} more medicines</p>
                      )}
                      {phc.stocks.length === 0 && (
                        <p className="text-xs text-gray-500 py-2">No stocks recorded for this facility.</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredPhcs.length === 0 && (
              <div className="col-span-full py-16 text-center text-gray-500 text-sm">
                No matching health centers or medicines found.
              </div>
            )}
          </div>
        )}

        {/* District Health Officer Details Modal */}
        {selectedPhc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
            <div className="w-full max-w-4xl rounded-2xl p-7 max-h-[90vh] overflow-y-auto"
              style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.08)' }}>
              
              <div className="flex items-center justify-between pb-4 border-b border-gray-800 mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white">{selectedPhc.name} Details</h3>
                  <p className="text-xs text-gray-400 mt-1">PHC #{selectedPhc.id} · {selectedPhc.type} · {selectedPhc.district} · Coord: {selectedPhc.latitude.toFixed(4)}, {selectedPhc.longitude.toFixed(4)}</p>
                </div>
                <button onClick={() => { setSelectedPhc(null); setReassignTargets({}); }} className="text-gray-400 hover:text-white text-lg font-bold">✕</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* Column 1: Complete Stocks */}
                <div>
                  <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Complete Stock Inventory ({selectedPhc.stocks.length} items)</h4>
                  <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-2">
                    {selectedPhc.stocks.length > 0 ? (
                      selectedPhc.stocks.map(s => {
                        const isLow = s.quantity <= 20;
                        const isSurplus = s.quantity >= 300;
                        let pillBg = 'rgba(75,85,99,0.15)';
                        let pillColor = '#9ca3af';

                        if (isLow) {
                          pillBg = 'rgba(239,68,68,0.12)';
                          pillColor = '#f87171';
                        } else if (isSurplus) {
                          pillBg = 'rgba(16,185,129,0.12)';
                          pillColor = '#34d399';
                        }

                        return (
                          <div
                            key={s.medicine + s.expiry_date}
                            className="flex items-center justify-between p-3 rounded-xl text-sm"
                            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.03)' }}
                          >
                            <div>
                              <span className="text-gray-200 font-medium block">{s.medicine}</span>
                              <span className="text-[10px] text-gray-500">Expires {new Date(s.expiry_date).toLocaleDateString('en-IN')}</span>
                            </div>
                            <span
                              className="text-xs font-semibold px-2.5 py-1 rounded"
                              style={{ background: pillBg, color: pillColor }}
                            >
                              {s.quantity} units
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-gray-500 py-4">No stocks recorded for this facility.</p>
                    )}
                  </div>
                </div>

                {/* Column 2: Appointed Doctors & Shuffling */}
                <div>
                  <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Appointed Doctors ({selectedPhc.doctors.length})</h4>
                  <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                    {selectedPhc.doctors.length > 0 ? (
                      selectedPhc.doctors.map(doc => {
                        // Find potential reallocation targets (PHCs in the same district, excluding current PHC)
                        const eligiblePhcs = phcs.filter(p => p.district === selectedPhc.district && p.id !== selectedPhc.id);
                        
                        return (
                          <div
                            key={doc.id}
                            className="p-4 rounded-xl space-y-3"
                            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.03)' }}
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <span className="text-sm font-semibold text-white block">{doc.name}</span>
                                <span className="text-xs text-gray-500">Doctor #{doc.id} · {doc.phone}</span>
                              </div>
                              <span className="text-[10px] px-2 py-0.5 rounded font-semibold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                {doc.status}
                              </span>
                            </div>

                            {/* Shuffling options */}
                            <div className="pt-2 border-t border-gray-800 space-y-2">
                              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Shuffle Facility within District</label>
                              <div className="flex gap-2">
                                <select
                                  value={reassignTargets[doc.id] || ''}
                                  onChange={e => setReassignTargets(prev => ({ ...prev, [doc.id]: Number(e.target.value) }))}
                                  className="flex-1 px-3 py-2 rounded-lg text-xs text-white focus:outline-none"
                                  style={{ background: 'rgba(31,41,55,0.8)', border: '1px solid rgba(255,255,255,0.08)' }}
                                >
                                  <option value="">Select target PHC...</option>
                                  {eligiblePhcs.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => handleDoctorReassign(doc.id)}
                                  disabled={shuffling === doc.id || !reassignTargets[doc.id]}
                                  className="px-3 py-2 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-all disabled:opacity-50"
                                >
                                  {shuffling === doc.id ? 'Shuffling...' : 'Reassign'}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-gray-500 py-4">No doctors appointed to this facility.</p>
                    )}
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
