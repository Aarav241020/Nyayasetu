import { ComplaintCategory, ComplaintStatus, Urgency } from '@/types';
import type { AISeverity, GeoContext, PriorityBand, PriorityFactor, PriorityResult } from '@/types';

/**
 * Priority score 0–100 = five transparent factors. Every factor returns its
 * points AND a plain-language reason, so the public tracker can show exactly
 * why an issue ranks where it does. All tunable numbers live in WEIGHTS.
 */
export const WEIGHTS = {
  severity: 35,
  location: 20,
  frequency: 25,
  time: 15,
  season: 5,
  // location sub-weights (sum = location max)
  hospital: 6,
  school: 5,
  majorRoad: 5,
  market: 2,
  busStop: 2,
  // number of independent reports at which the frequency factor maxes out
  frequencySaturation: 16,
  // how much the AI rating counts vs. the category baseline
  aiShare: 0.7,
} as const;

/** Baseline harm of each category on a 1–5 scale (public-health and injury risk first). */
export const CATEGORY_SEVERITY: Record<ComplaintCategory, number> = {
  [ComplaintCategory.SEWER_BLOCKAGE]: 4,
  [ComplaintCategory.DRAIN_OVERFLOW]: 4,
  [ComplaintCategory.POTHOLE]: 4,
  [ComplaintCategory.MOSQUITO_SANITATION]: 4,
  [ComplaintCategory.WATER_LEAKAGE]: 3,
  [ComplaintCategory.GARBAGE_COLLECTION]: 3,
  [ComplaintCategory.STREETLIGHT]: 3,
  [ComplaintCategory.ILLEGAL_DUMPING]: 3,
  [ComplaintCategory.STRAY_ANIMAL]: 3,
  [ComplaintCategory.ENCROACHMENT]: 2,
  [ComplaintCategory.PARK_MAINTENANCE]: 1,
};

const MONSOON_CATEGORIES = new Set<ComplaintCategory>([
  ComplaintCategory.DRAIN_OVERFLOW,
  ComplaintCategory.SEWER_BLOCKAGE,
  ComplaintCategory.MOSQUITO_SANITATION,
  ComplaintCategory.WATER_LEAKAGE,
]);

const DONE = new Set<string>([ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED]);

export interface PriorityInput {
  category: ComplaintCategory;
  urgency: Urgency;
  aiSeverity: AISeverity | null;
  geo: GeoContext | null;
  confirmations: number;
  nearbyReports: number; // other open reports of the same category within 150 m, last 14 days
  status: string;
  createdAt: Date;
  slaDeadline: Date;
  now?: Date;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function severityFactor(i: PriorityInput): PriorityFactor {
  const base = CATEGORY_SEVERITY[i.category] ?? 3;
  let rating: number;
  let reason: string;
  if (i.aiSeverity) {
    rating = WEIGHTS.aiShare * i.aiSeverity.severity + (1 - WEIGHTS.aiShare) * base;
    const what = i.aiSeverity.source === 'ai' ? 'AI review of the report' : 'Keyword check';
    reason = `${what} rated it ${i.aiSeverity.severity}/5 (category baseline ${base}/5)`;
    if (i.aiSeverity.reasoning) reason += `: ${i.aiSeverity.reasoning}`;
  } else {
    rating = base + (i.urgency === Urgency.HIGH ? 1 : 0);
    reason = `Category baseline ${base}/5${i.urgency === Urgency.HIGH ? ', +1 for urgent words in the description' : ''}`;
  }
  rating = clamp(rating, 1, 5);
  return { key: 'severity', label: 'Severity', max: WEIGHTS.severity, points: Math.round((rating / 5) * WEIGHTS.severity), reason };
}

function locationFactor(i: PriorityInput): PriorityFactor {
  const max = WEIGHTS.location;
  if (!i.geo || i.geo.source === 'unavailable') {
    return { key: 'location', label: 'Location sensitivity', max, points: 0, reason: 'Nearby places could not be checked for this location' };
  }
  const g = i.geo;
  const found: string[] = [];
  let pts = 0;
  if (g.hospitals.length) { pts += WEIGHTS.hospital; found.push(`hospital/clinic (${g.hospitals[0]})`); }
  if (g.schools.length) { pts += WEIGHTS.school; found.push(`school (${g.schools[0]})`); }
  if (g.majorRoad) { pts += WEIGHTS.majorRoad; found.push(`main road (${g.majorRoad})`); }
  if (g.markets.length) { pts += WEIGHTS.market; found.push('market'); }
  if (g.busStops.length) { pts += WEIGHTS.busStop; found.push('bus stop'); }
  return {
    key: 'location',
    label: 'Location sensitivity',
    max,
    points: Math.min(max, pts),
    reason: found.length ? `Within ${g.radius_m} m of: ${found.join(', ')}` : `No schools, hospitals, main roads or markets within ${g.radius_m} m`,
  };
}

function frequencyFactor(i: PriorityInput): PriorityFactor {
  const n = Math.max(0, i.confirmations) + Math.max(0, i.nearbyReports);
  // Logarithmic: the first few independent reports matter most, so spamming can't buy a top slot.
  const share = Math.min(1, Math.log2(1 + n) / Math.log2(1 + WEIGHTS.frequencySaturation));
  const parts: string[] = [];
  if (i.confirmations) parts.push(`${plural(i.confirmations, 'person')} confirmed it`);
  if (i.nearbyReports) parts.push(`${plural(i.nearbyReports, 'similar report')} within 150 m in 14 days`);
  return {
    key: 'frequency',
    label: 'Reports & confirmations',
    max: WEIGHTS.frequency,
    points: Math.round(share * WEIGHTS.frequency),
    reason: parts.length ? parts.join('; ') : 'Only one report so far',
  };
}

function timeFactor(i: PriorityInput, now: Date): PriorityFactor {
  const max = WEIGHTS.time;
  if (DONE.has(i.status)) return { key: 'time', label: 'Time pressure', max, points: 0, reason: 'Resolved, so no longer waiting' };
  const total = i.slaDeadline.getTime() - i.createdAt.getTime();
  const used = now.getTime() - i.createdAt.getTime();
  const overdueH = Math.round((now.getTime() - i.slaDeadline.getTime()) / 3_600_000);
  if (overdueH >= 0 && used > 0) {
    return { key: 'time', label: 'Time pressure', max, points: max, reason: `Past its resolution deadline by ${plural(overdueH, 'hour')}` };
  }
  const frac = total > 0 ? clamp(used / total, 0, 1) : 0;
  return { key: 'time', label: 'Time pressure', max, points: Math.round(frac * max), reason: `${Math.round(frac * 100)}% of the ${Math.round(total / 3_600_000)} h deadline used` };
}

function seasonFactor(i: PriorityInput, now: Date): PriorityFactor {
  const monsoon = now.getMonth() >= 5 && now.getMonth() <= 8; // June–September
  const hit = monsoon && MONSOON_CATEGORIES.has(i.category);
  return {
    key: 'season',
    label: 'Seasonal risk',
    max: WEIGHTS.season,
    points: hit ? WEIGHTS.season : 0,
    reason: hit ? 'Monsoon season: flooding and mosquito-borne disease risk is higher' : 'No seasonal risk for this category right now',
  };
}

export function bandFor(score: number): PriorityBand {
  return score >= 70 ? 'P1' : score >= 50 ? 'P2' : score >= 30 ? 'P3' : 'P4';
}

export function scorePriority(input: PriorityInput): PriorityResult {
  const now = input.now ?? new Date();
  const factors = [severityFactor(input), locationFactor(input), frequencyFactor(input), timeFactor(input, now), seasonFactor(input, now)];
  const score = clamp(factors.reduce((s, f) => s + f.points, 0), 0, 100);
  return { score, band: bandFor(score), factors };
}

/** Great-circle distance in metres. */
export function distanceM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
