'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../../services/api';

interface PHC {
  id: number;
  name: string;
  district: string;
  latitude: number;
  longitude: number;
  type: string;
  stockStatus?: 'critical' | 'low' | 'ok';
}

// Seed PHC data as fallback when API is unavailable
const FALLBACK_PHCS: PHC[] = [
  { id: 1, name: 'UPHC Unit-9', district: 'Bangalore Urban', latitude: 12.9715987, longitude: 77.5945627, type: 'UPHC', stockStatus: 'critical' },
  { id: 2, name: 'UPHC Unit-3', district: 'Bangalore Urban', latitude: 12.9815987, longitude: 77.6045627, type: 'UPHC', stockStatus: 'ok' },
  { id: 3, name: 'CHC Nelamangala', district: 'Bangalore Rural', latitude: 13.0987, longitude: 77.3912, type: 'CHC', stockStatus: 'low' },
  { id: 4, name: 'PHC Devanahalli', district: 'Bangalore Rural', latitude: 13.2486, longitude: 77.7123, type: 'PHC', stockStatus: 'low' },
  { id: 5, name: 'UPHC Malleswaram', district: 'Bangalore Urban', latitude: 13.0031, longitude: 77.5643, type: 'UPHC', stockStatus: 'critical' },
  { id: 6, name: 'UPHC Jayanagar', district: 'Bangalore Urban', latitude: 12.9250, longitude: 77.5938, type: 'UPHC', stockStatus: 'low' },
  { id: 7, name: 'PHC Yelahanka', district: 'Bangalore Urban', latitude: 13.1007, longitude: 77.5963, type: 'PHC', stockStatus: 'critical' },
  { id: 8, name: 'CHC Hoskote', district: 'Bangalore Rural', latitude: 13.0707, longitude: 77.7981, type: 'CHC', stockStatus: 'low' },
  { id: 9, name: 'PHC Anekal', district: 'Bangalore Urban', latitude: 12.7111, longitude: 77.6956, type: 'PHC', stockStatus: 'ok' },
  { id: 10, name: 'PHC Magadi', district: 'Bangalore Rural', latitude: 12.9572, longitude: 77.2236, type: 'PHC', stockStatus: 'low' },
];

const statusColors: Record<string, string> = {
  critical: '#ef4444',
  low: '#f59e0b',
  ok: '#10b981',
};

export default function PHCMap() {
  const [phcs, setPHCs] = useState<PHC[]>(FALLBACK_PHCS);
  const [activeTransferLine, setActiveTransferLine] = useState<[number, number][] | null>(null);

  useEffect(() => {
    // Try fetching live PHC data
    api.get('/api/v1/dashboard/network')
      .then(res => {
        const livePhcs = res.data?.phcs || [];
        if (!livePhcs.length) {
          setPHCs(FALLBACK_PHCS);
          return;
        }

        setPHCs(livePhcs.map((phc: any) => {
          const quantities = (phc.stocks || []).map((stock: any) => stock.quantity);
          const hasOutOfStock = quantities.some((qty: number) => qty === 0);
          const hasCritical = quantities.some((qty: number) => qty > 0 && qty <= 20);
          const hasLow = quantities.some((qty: number) => qty > 20 && qty <= 50);

          return {
            id: phc.id,
            name: phc.name,
            district: phc.district,
            latitude: phc.latitude,
            longitude: phc.longitude,
            type: phc.type,
            stockStatus: hasOutOfStock || hasCritical ? 'critical' : hasLow ? 'low' : 'ok',
          };
        }));
      })
      .catch(() => {
        setPHCs(FALLBACK_PHCS);
      });
  }, []);

  const center: [number, number] = [12.9716, 77.5946];

  return (
    <div style={{ height: '420px', width: '100%' }}>
      <MapContainer
        center={center}
        zoom={11}
        style={{ height: '100%', width: '100%', background: '#0a0f1e' }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="map-tiles-dark"
        />

        {phcs.map(phc => {
          const color = statusColors[phc.stockStatus || 'ok'];
          return (
            <CircleMarker
              key={phc.id}
              center={[phc.latitude, phc.longitude]}
              radius={phc.type === 'CHC' ? 16 : 12}
              fillColor={color}
              color={color}
              weight={2}
              opacity={0.9}
              fillOpacity={0.3}
              eventHandlers={{
                click: () => {
                  // Draw a sample transfer line from Unit-9 to Unit-3 on click
                  if (phc.id === 1 || phc.id === 2) {
                    setActiveTransferLine([[12.9715987, 77.5945627], [12.9815987, 77.6045627]]);
                  } else {
                    setActiveTransferLine(null);
                  }
                }
              }}
            >
              <Popup className="phc-popup">
                <div style={{ fontFamily: 'Inter, sans-serif', padding: '4px 0', minWidth: '160px' }}>
                  <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>{phc.name}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>{phc.type} · {phc.district}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, display: 'inline-block' }} />
                    <span style={{ fontSize: '12px', fontWeight: 600, color }}>
                      {phc.stockStatus === 'critical' ? '🚨 Critical Stock' : phc.stockStatus === 'low' ? '⚠️ Low Stock' : '✅ Stock OK'}
                    </span>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        {/* Active transfer route visualization */}
        {activeTransferLine && (
          <Polyline
            positions={activeTransferLine}
            pathOptions={{ color: '#10b981', weight: 2, dashArray: '6, 6', opacity: 0.8 }}
          />
        )}
      </MapContainer>

      {/* Legend */}
      <div className="flex items-center gap-5 px-4 py-3 text-xs" style={{ background: 'rgba(17,24,39,0.9)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <span className="text-gray-500 font-medium">STOCK STATUS:</span>
        {[{ label: 'Critical', color: '#ef4444' }, { label: 'Low', color: '#f59e0b' }, { label: 'Adequate', color: '#10b981' }].map(l => (
          <span key={l.label} className="flex items-center gap-1.5 text-gray-400">
            <span className="w-3 h-3 rounded-full" style={{ background: l.color, opacity: 0.8 }} />
            {l.label}
          </span>
        ))}
        <span className="text-gray-600 ml-2">· Click PHC markers to view transfer routes</span>
      </div>
    </div>
  );
}
