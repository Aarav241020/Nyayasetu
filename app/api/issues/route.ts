import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Public map + list feed, highest priority first.
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  let q = supabaseAdmin
    .from('complaints')
    .select('uid, title, category, status, city, state, latitude, longitude, priority_score, priority_band, confirmations, is_escalated, sla_deadline, created_at, updated_at')
    .is('parent_id', null)
    .not('latitude', 'is', null)
    .order('priority_score', { ascending: false })
    .limit(1000);
  const status = p.get('status');
  if (status === 'open') q = q.not('status', 'in', '("resolved","closed")');
  else if (status === 'resolved') q = q.in('status', ['resolved', 'closed']);
  const category = p.get('category'), city = p.get('city');
  if (category) q = q.eq('category', category);
  if (city) q = q.ilike('city', city);
  const { data, error } = await q;
  if (error) return NextResponse.json({ success: false, message: 'Failed to load issues.' }, { status: 500 });
  return NextResponse.json({ success: true, issues: data });
}
