import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';

export const dynamic = 'force-dynamic';

type Row = { category: string; city: string | null; status: string; priority_band: string; sla_deadline: string; created_at: string; updated_at: string };

const isDone = (r: Row) => r.status === 'resolved' || r.status === 'closed';

function summarise(group: Row[], now: string) {
  const resolved = group.filter(isDone);
  const hours = resolved.map((r) => (Date.parse(r.updated_at) - Date.parse(r.created_at)) / 3_600_000);
  return {
    total: group.length,
    open: group.length - resolved.length,
    resolved: resolved.length,
    overdue: group.filter((r) => !isDone(r) && r.sla_deadline < now).length,
    on_time_rate: resolved.length ? Math.round((resolved.filter((r) => r.updated_at <= r.sla_deadline).length / resolved.length) * 100) : null,
    avg_resolution_hours: hours.length ? Math.round(hours.reduce((a, b) => a + b, 0) / hours.length) : null,
  };
}

// Public transparency numbers: how fast each city and category actually gets fixed.
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('complaints')
    .select('category, city, status, priority_band, sla_deadline, created_at, updated_at')
    .is('parent_id', null);
  if (error) return NextResponse.json({ success: false, message: 'Failed to load stats.' }, { status: 500 });

  const rows = (data ?? []) as Row[];
  const now = new Date().toISOString();
  const groupBy = (key: 'city' | 'category') => {
    const groups = new Map<string, Row[]>();
    for (const r of rows) {
      const k = r[key] ?? 'Unknown';
      groups.set(k, [...(groups.get(k) ?? []), r]);
    }
    return [...groups.entries()].map(([name, g]) => ({ name, ...summarise(g, now) })).sort((a, b) => b.total - a.total);
  };
  const openByBand: Record<string, number> = { P1: 0, P2: 0, P3: 0, P4: 0 };
  for (const r of rows) if (!isDone(r)) openByBand[r.priority_band] = (openByBand[r.priority_band] ?? 0) + 1;

  return NextResponse.json({ success: true, overall: summarise(rows, now), by_city: groupBy('city'), by_category: groupBy('category'), open_by_band: openByBand });
}
