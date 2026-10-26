'use client';

import React from 'react';
import { AlertTriangle, MapPin, Users, Clock, CloudRain } from 'lucide-react';
import type { PriorityBand, PriorityFactor } from '@/types';

// Band colours follow the status palette; the label always travels with the colour.
export const BAND_STYLE: Record<PriorityBand, { label: string; hex: string; pill: string }> = {
  P1: { label: 'Critical', hex: '#d03b3b', pill: 'bg-red-100 text-red-800 border-red-200' },
  P2: { label: 'High', hex: '#ec835a', pill: 'bg-orange-100 text-orange-800 border-orange-200' },
  P3: { label: 'Medium', hex: '#d99a06', pill: 'bg-amber-100 text-amber-800 border-amber-200' },
  P4: { label: 'Low', hex: '#64748b', pill: 'bg-slate-100 text-slate-700 border-slate-200' },
};

const ICONS: Record<PriorityFactor['key'], React.ElementType> = {
  severity: AlertTriangle,
  location: MapPin,
  frequency: Users,
  time: Clock,
  season: CloudRain,
};

export function PriorityBadge({ band, score }: { band: PriorityBand; score?: number }) {
  const s = BAND_STYLE[band] ?? BAND_STYLE.P4;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-semibold whitespace-nowrap shrink-0 ${s.pill}`}>
      <span className="w-2 h-2 rounded-full" style={{ background: s.hex }} aria-hidden />
      {band} · {s.label}
      {score !== undefined && <span className="font-normal opacity-80">({score})</span>}
    </span>
  );
}

/** Score + one bar per factor with the reason behind its points. */
export default function PriorityBreakdown({ score, band, factors }: { score: number; band: PriorityBand; factors: PriorityFactor[] }) {
  const s = BAND_STYLE[band] ?? BAND_STYLE.P4;
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Why this priority?</h3>
          <p className="text-xs text-gray-500">Calculated automatically from five factors. Every point is explained.</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-gray-900 leading-none">{score}<span className="text-sm text-gray-400 font-normal">/100</span></div>
          <div className="mt-1"><PriorityBadge band={band} /></div>
        </div>
      </div>
      <ul className="space-y-3">
        {factors.map((f) => {
          const Icon = ICONS[f.key] ?? AlertTriangle;
          return (
            <li key={f.key}>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-medium text-gray-800">
                  <Icon className="w-4 h-4 text-gray-400" aria-hidden /> {f.label}
                </span>
                <span className="tabular-nums text-gray-600">+{f.points} <span className="text-gray-400">/ {f.max}</span></span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden" role="presentation">
                <div className="h-full rounded-full" style={{ width: `${(f.points / f.max) * 100}%`, background: s.hex }} />
              </div>
              <p className="text-xs text-gray-500 mt-1">{f.reason}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
