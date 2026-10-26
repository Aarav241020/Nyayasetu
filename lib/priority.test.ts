// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scorePriority, bandFor, distanceM, WEIGHTS, type PriorityInput } from './priority';
import { ComplaintCategory, ComplaintStatus, Urgency } from '../types';

const created = new Date('2026-10-01T10:00:00Z');
const base: PriorityInput = {
  category: ComplaintCategory.POTHOLE,
  urgency: Urgency.MEDIUM,
  aiSeverity: null,
  geo: null,
  confirmations: 0,
  nearbyReports: 0,
  status: ComplaintStatus.SUBMITTED,
  createdAt: created,
  slaDeadline: new Date(created.getTime() + 168 * 3_600_000),
  now: new Date('2026-10-01T11:00:00Z'),
};

test('every factor has a reason and stays within its max', () => {
  const r = scorePriority(base);
  assert.equal(r.factors.length, 5);
  for (const f of r.factors) {
    assert.ok(f.reason.length > 0, f.key);
    assert.ok(f.points >= 0 && f.points <= f.max, f.key);
  }
  assert.equal(r.factors.reduce((s, f) => s + f.max, 0), 100);
});

test('dangerous, crowded, overdue issue near a school is P1', () => {
  const r = scorePriority({
    ...base,
    aiSeverity: { severity: 5, hazards: ['open pit'], reasoning: 'Deep pothole on a busy road', source: 'ai' },
    geo: { source: 'osm', radius_m: 250, hospitals: ['City Clinic'], schools: ['DPS'], markets: [], busStops: ['Stop'], majorRoad: 'NH-48' },
    confirmations: 6,
    nearbyReports: 4,
    now: new Date(base.slaDeadline.getTime() + 5 * 3_600_000),
  });
  assert.equal(r.band, 'P1');
  assert.match(r.factors.find((f) => f.key === 'time')!.reason, /5 hours/);
  assert.match(r.factors.find((f) => f.key === 'location')!.reason, /school/);
});

test('minor fresh park issue is P4', () => {
  const r = scorePriority({ ...base, category: ComplaintCategory.PARK_MAINTENANCE, slaDeadline: new Date(created.getTime() + 120 * 3_600_000) });
  assert.equal(r.band, 'P4');
});

test('frequency is logarithmic and capped', () => {
  const pts = (n: number) => scorePriority({ ...base, confirmations: n }).factors.find((f) => f.key === 'frequency')!.points;
  assert.equal(pts(0), 0);
  assert.ok(pts(1) > 0);
  assert.ok(pts(2) - pts(1) > pts(12) - pts(11), 'early reports count more than later ones');
  assert.equal(pts(1000), WEIGHTS.frequency);
});

test('monsoon boosts drains but not potholes', () => {
  const july = new Date('2026-07-10T10:00:00Z');
  const season = (category: ComplaintCategory) =>
    scorePriority({ ...base, category, createdAt: july, slaDeadline: new Date(july.getTime() + 24 * 3_600_000), now: july })
      .factors.find((f) => f.key === 'season')!.points;
  assert.equal(season(ComplaintCategory.DRAIN_OVERFLOW), WEIGHTS.season);
  assert.equal(season(ComplaintCategory.POTHOLE), 0);
});

test('resolved issues get no time pressure', () => {
  const r = scorePriority({ ...base, status: ComplaintStatus.RESOLVED, now: new Date(base.slaDeadline.getTime() + 99 * 3_600_000) });
  assert.equal(r.factors.find((f) => f.key === 'time')!.points, 0);
});

test('bands and distance', () => {
  assert.deepEqual([bandFor(70), bandFor(69), bandFor(50), bandFor(30), bandFor(29)], ['P1', 'P2', 'P2', 'P3', 'P4']);
  const d = distanceM(28.6139, 77.209, 28.6148, 77.209); // ~100 m north
  assert.ok(d > 95 && d < 105, String(d));
});
