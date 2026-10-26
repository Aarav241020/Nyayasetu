'use client';

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { BAND_STYLE } from '@/components/priority/PriorityBreakdown';
import { COMPLAINT_CATEGORIES } from '@/constants/categories';
import type { PriorityBand } from '@/types';

interface Summary { total: number; open: number; resolved: number; overdue: number; on_time_rate: number | null; avg_resolution_hours: number | null }
interface Group extends Summary { name: string }
interface Stats { overall: Summary; by_city: Group[]; by_category: Group[]; open_by_band: Record<PriorityBand, number> }

const catLabel = (v: string) => COMPLAINT_CATEGORIES.find((c) => c.value === v)?.label_en ?? v;

function Table({ title, rows, nameOf }: { title: string; rows: Group[]; nameOf: (n: string) => string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
      <h2 className="text-sm font-semibold text-gray-900 px-5 pt-4 pb-2">{title}</h2>
      <table className="w-full text-sm">
        <thead className="text-xs text-gray-500 border-b border-gray-100">
          <tr>
            <th className="text-left font-medium px-5 py-2">Name</th>
            <th className="text-right font-medium px-3 py-2">Reported</th>
            <th className="text-right font-medium px-3 py-2">Open</th>
            <th className="text-right font-medium px-3 py-2">Overdue</th>
            <th className="text-right font-medium px-3 py-2">On time</th>
            <th className="text-right font-medium px-5 py-2">Avg. fix</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((r) => (
            <tr key={r.name} className="border-b border-gray-50">
              <td className="px-5 py-2 text-gray-900">{nameOf(r.name)}</td>
              <td className="px-3 py-2 text-right">{r.total}</td>
              <td className="px-3 py-2 text-right">{r.open}</td>
              <td className={`px-3 py-2 text-right ${r.overdue ? 'text-red-700 font-medium' : ''}`}>{r.overdue}</td>
              <td className="px-3 py-2 text-right">{r.on_time_rate == null ? '–' : `${r.on_time_rate}%`}</td>
              <td className="px-5 py-2 text-right">{r.avg_resolution_hours == null ? '–' : `${r.avg_resolution_hours} h`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => { fetch('/api/stats').then((r) => r.json()).then((d) => d.success && setStats(d)).catch(() => {}); }, []);

  if (!stats) return <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;
  const o = stats.overall;
  const openTotal = Object.values(stats.open_by_band).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transparency dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Public numbers on how fast reported issues actually get fixed. Updated live.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            ['Reported', o.total], ['Open', o.open], ['Overdue', o.overdue],
            ['Resolved on time', o.on_time_rate == null ? '–' : `${o.on_time_rate}%`],
            ['Avg. time to fix', o.avg_resolution_hours == null ? '–' : `${o.avg_resolution_hours} h`],
          ].map(([label, value]) => (
            <div key={label} className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Open issues by priority</h2>
          <div className="flex h-3 rounded-full overflow-hidden gap-0.5" role="img" aria-label="Open issues by priority band">
            {(Object.keys(BAND_STYLE) as PriorityBand[]).map((b) => (
              <div key={b} style={{ width: `${(stats.open_by_band[b] / openTotal) * 100}%`, background: BAND_STYLE[b].hex }} />
            ))}
          </div>
          <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-600">
            {(Object.keys(BAND_STYLE) as PriorityBand[]).map((b) => (
              <span key={b} className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: BAND_STYLE[b].hex }} aria-hidden />
                {b} {BAND_STYLE[b].label}: <span className="tabular-nums font-medium text-gray-900">{stats.open_by_band[b]}</span>
              </span>
            ))}
          </div>
        </div>

        <Table title="By city" rows={stats.by_city} nameOf={(n) => n} />
        <Table title="By category" rows={stats.by_category} nameOf={catLabel} />
      </div>
    </div>
  );
}
