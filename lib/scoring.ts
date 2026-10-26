import { supabaseAdmin } from '@/lib/db';
import { scorePriority, distanceM } from '@/lib/priority';
import type { AISeverity, ComplaintCategory, GeoContext, PriorityResult, Urgency } from '@/types';

export const NEARBY_RADIUS_M = 150;
const NEARBY_DAYS = 14;

export interface NearbyIssue {
  id: string;
  uid: string;
  title: string;
  status: string;
  priority_band: string;
  confirmations: number;
  distance_m: number;
}

/** Open, un-merged issues of the same category within 150 m reported in the last 14 days. */
export async function findNearby(lat: number, lon: number, category: string, excludeId?: string): Promise<NearbyIssue[]> {
  const dLat = NEARBY_RADIUS_M / 111_320;
  const dLon = NEARBY_RADIUS_M / (111_320 * Math.cos((lat * Math.PI) / 180));
  const since = new Date(Date.now() - NEARBY_DAYS * 86_400_000).toISOString();
  const { data } = await supabaseAdmin
    .from('complaints')
    .select('id, uid, title, status, priority_band, confirmations, latitude, longitude')
    .eq('category', category)
    .is('parent_id', null)
    .not('status', 'in', '("resolved","closed")')
    .gte('created_at', since)
    .gte('latitude', lat - dLat).lte('latitude', lat + dLat)
    .gte('longitude', lon - dLon).lte('longitude', lon + dLon);
  return (data ?? [])
    .filter((c) => c.id !== excludeId)
    .map((c) => ({ ...c, distance_m: Math.round(distanceM(lat, lon, c.latitude, c.longitude)) }))
    .filter((c) => c.distance_m <= NEARBY_RADIUS_M)
    .sort((a, b) => a.distance_m - b.distance_m)
    .map(({ latitude: _la, longitude: _lo, ...c }) => c); // eslint-disable-line @typescript-eslint/no-unused-vars
}

/** Recompute and store one complaint's priority. Called on filing, confirmation, status change and by the cron. */
export async function rescoreComplaint(id: string): Promise<PriorityResult | null> {
  const { data: c } = await supabaseAdmin
    .from('complaints')
    .select('id, category, urgency, status, ai_severity, geo_context, confirmations, latitude, longitude, created_at, sla_deadline')
    .eq('id', id)
    .single();
  if (!c) return null;
  const nearby = c.latitude != null && c.longitude != null ? (await findNearby(c.latitude, c.longitude, c.category, c.id)).length : 0;
  const result = scorePriority({
    category: c.category as ComplaintCategory,
    urgency: c.urgency as Urgency,
    aiSeverity: c.ai_severity as AISeverity | null,
    geo: c.geo_context as GeoContext | null,
    confirmations: c.confirmations,
    nearbyReports: nearby,
    status: c.status,
    createdAt: new Date(c.created_at),
    slaDeadline: new Date(c.sla_deadline),
  });
  await supabaseAdmin
    .from('complaints')
    .update({ priority_score: result.score, priority_band: result.band, priority_breakdown: result.factors })
    .eq('id', id);
  return result;
}

/** Refresh every open complaint (time pressure grows even when nothing else changes). */
export async function rescoreOpenComplaints(): Promise<number> {
  const { data } = await supabaseAdmin.from('complaints').select('id').not('status', 'in', '("resolved","closed")');
  for (const { id } of data ?? []) await rescoreComplaint(id);
  return data?.length ?? 0;
}
