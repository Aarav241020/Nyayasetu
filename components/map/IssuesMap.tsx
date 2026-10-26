'use client';

import React from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { BAND_STYLE } from '@/components/priority/PriorityBreakdown';
import type { PriorityBand } from '@/types';

export interface MapIssue {
  uid: string;
  title: string;
  status: string;
  latitude: number;
  longitude: number;
  priority_band: PriorityBand;
  priority_score: number;
  city?: string | null;
}

const DONE = new Set(['resolved', 'closed']);

/** Pins coloured by priority band; resolved issues are hollow and grey. */
export default function IssuesMap({ issues, center, zoom = 5, height = 'h-[520px]' }: {
  issues: MapIssue[];
  center?: [number, number];
  zoom?: number;
  height?: string;
}) {
  return (
    <MapContainer center={center ?? [23.5, 78.5]} zoom={zoom} className={`${height} w-full rounded-xl border border-slate-200 z-0`} scrollWheelZoom>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {issues.map((i) => {
        const done = DONE.has(i.status);
        const color = done ? '#94a3b8' : (BAND_STYLE[i.priority_band] ?? BAND_STYLE.P4).hex;
        return (
          <CircleMarker
            key={i.uid}
            center={[i.latitude, i.longitude]}
            radius={done ? 6 : 6 + Math.round(i.priority_score / 20)}
            pathOptions={{ color: '#fff', weight: 2, fillColor: color, fillOpacity: done ? 0.35 : 0.9 }}
          >
            <Popup>
              <div className="text-sm">
                <p className="font-semibold">{i.title}</p>
                <p className="text-gray-600">{i.priority_band} · score {i.priority_score} · {i.status.replace('_', ' ')}</p>
                <a href={`/issues/${i.uid}`} className="text-indigo-700 underline">Open tracker →</a>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
