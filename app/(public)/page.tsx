'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { MapPin, ArrowRight, AlertTriangle, Users, Clock, CloudRain, Camera, ListOrdered, CheckCircle2, MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { WEIGHTS } from '@/lib/priority';
import { PriorityBadge } from '@/components/priority/PriorityBreakdown';
import type { PriorityBand } from '@/types';

interface Overall { total: number; open: number; resolved: number; overdue: number; on_time_rate: number | null; avg_resolution_hours: number | null }
interface TopIssue { uid: string; title: string; city: string | null; priority_band: PriorityBand; priority_score: number; confirmations: number }

// Generated from the real weights in lib/priority.ts, so this page can't drift from the scoring code.
const FACTORS = [
  { icon: AlertTriangle, name: 'Severity', max: WEIGHTS.severity, how: 'AI reads the description and the photo and rates harm from 1 to 5, blended with a per-category baseline.' },
  { icon: Users, name: 'Reports & confirmations', max: WEIGHTS.frequency, how: 'Similar reports within 150 m plus verified "I see this too" taps, on a log scale so spam cannot buy the top slot.' },
  { icon: MapPin, name: 'Location sensitivity', max: WEIGHTS.location, how: 'Hospitals, schools, main roads, markets and bus stops within 250 m, from OpenStreetMap.' },
  { icon: Clock, name: 'Time pressure', max: WEIGHTS.time, how: 'How much of the resolution deadline is used up. Overdue issues get the full points and are escalated.' },
  { icon: CloudRain, name: 'Seasonal risk', max: WEIGHTS.season, how: 'Drains, sewers and mosquito breeding get extra weight during the monsoon.' },
];

export default function LandingPage() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<Overall | null>(null);
  const [top, setTop] = useState<TopIssue[]>([]);

  useEffect(() => {
    fetch('/api/stats').then((r) => r.json()).then((d) => d.success && setStats(d.overall)).catch(() => {});
    fetch('/api/issues?status=open').then((r) => r.json()).then((d) => setTop((d.issues ?? []).slice(0, 5))).catch(() => {});
  }, []);

  return (
    <div className="flex flex-col w-full animate-fadeIn">
      {/* Hero */}
      <section className="bg-gradient-to-b from-indigo-50 to-white">
        <div className="max-w-6xl mx-auto px-4 pt-20 pb-16 grid lg:grid-cols-2 gap-12 items-center [&>*]:min-w-0">
          <div>
            <p className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 text-sm font-medium mb-6">
              <MapPin className="w-4 h-4" /> {t('landing.v2.badge', { defaultValue: 'Civic issues, India-wide' })}
            </p>
            <h1 className="text-4xl md:text-6xl font-extrabold text-gray-900 tracking-tight leading-tight">
              {t('landing.v2.headline', { defaultValue: 'Report it. See how urgent it is. Watch it get fixed.' })}
            </h1>
            <p className="text-lg text-gray-600 mt-6 max-w-xl">
              {t('landing.v2.sub', { defaultValue: 'Pin a pothole, garbage dump or dead streetlight on the map. NyayaSetu scores its priority automatically, explains every point, and shows everyone its progress until it is resolved.' })}
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Link href="/complaints/file" className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-indigo-700 text-white font-semibold hover:bg-indigo-800">
                {t('landing.v2.report', { defaultValue: 'Report an issue' })} <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/issues" className="inline-flex items-center gap-2 px-6 py-3 rounded-md border border-slate-300 bg-white text-slate-800 font-semibold hover:bg-slate-50">
                {t('landing.v2.map', { defaultValue: 'See the live map' })}
              </Link>
              <Link href="/chat" className="inline-flex items-center gap-2 px-6 py-3 rounded-md text-indigo-800 font-semibold hover:bg-indigo-50">
                <MessageSquare className="w-4 h-4" /> {t('landing.v2.chat', { defaultValue: 'Report by chat (Hindi / English)' })}
              </Link>
            </div>
          </div>

          {/* Live top priorities */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-900">{t('landing.v2.topNow', { defaultValue: 'Highest priority right now' })}</h2>
              <Link href="/issues" className="text-xs text-indigo-700 font-medium hover:underline">View all →</Link>
            </div>
            {top.length === 0 ? (
              <p className="text-sm text-gray-500 py-10 text-center">No open issues yet.</p>
            ) : (
              <ol className="divide-y divide-gray-100">
                {top.map((i, idx) => (
                  <li key={i.uid}>
                    <Link href={`/issues/${i.uid}`} className="flex items-center gap-3 py-3 hover:bg-gray-50 rounded-md px-1">
                      <span className="w-5 text-xs tabular-nums text-gray-400">{idx + 1}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-gray-900 truncate">{i.title}</span>
                        <span className="block text-xs text-gray-500">{i.city ?? ''}{i.confirmations ? ` · ${i.confirmations} confirmation${i.confirmations === 1 ? '' : 's'}` : ''}</span>
                      </span>
                      <PriorityBadge band={i.priority_band} score={i.priority_score} />
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        {/* Live numbers */}
        {stats && (
          <div className="max-w-6xl mx-auto px-4 pb-14 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Issues reported', value: stats.total },
              { label: 'Resolved', value: stats.resolved },
              { label: 'Resolved on time', value: stats.on_time_rate == null ? '–' : `${stats.on_time_rate}%` },
              { label: 'Avg. time to fix', value: stats.avg_resolution_hours == null ? '–' : `${stats.avg_resolution_hours} h` },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{s.value}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* How it works */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4 grid md:grid-cols-3 gap-6">
          {[
            { icon: Camera, title: 'Pin & snap', body: 'Drop a pin (or use GPS), add a photo. Similar open reports nearby are shown so you can confirm instead of duplicating.' },
            { icon: ListOrdered, title: 'Scored automatically', body: 'A 0–100 priority with a reason for every point. Officers work their queue from the top, not first-come-first-served.' },
            { icon: CheckCircle2, title: 'Tracked in public', body: 'Reported → assigned → work started → resolved, with deadlines, auto-escalation and before/after photos for anyone to check.' },
          ].map((s) => (
            <div key={s.title} className="p-6 rounded-xl border border-slate-200">
              <s.icon className="w-6 h-6 text-indigo-700" />
              <h3 className="text-lg font-semibold text-gray-900 mt-3">{s.title}</h3>
              <p className="text-sm text-gray-600 mt-2">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Scoring explained */}
      <section className="py-16 bg-gray-50 border-t border-slate-200">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-900">How the priority score works</h2>
          <p className="text-gray-600 mt-2 max-w-3xl">Transparent by design: five factors, fixed weights, a written reason for each one. Bands: P1 Critical ≥ 70, P2 High ≥ 50, P3 Medium ≥ 30, P4 Low.</p>
          <div className="mt-8 grid md:grid-cols-5 gap-4">
            {FACTORS.map((f) => (
              <div key={f.name} className="bg-white rounded-xl border border-slate-200 p-5">
                <f.icon className="w-5 h-5 text-indigo-700" />
                <p className="mt-3 font-semibold text-gray-900">{f.name}</p>
                <p className="text-sm text-indigo-800 font-medium">up to {f.max} pts</p>
                <p className="text-xs text-gray-600 mt-2">{f.how}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
