'use client';

import React, { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowLeft, Building2, Loader2, MapPin, ShieldAlert, ThumbsUp, User, CheckCircle2, Circle } from 'lucide-react';
import PriorityBreakdown, { PriorityBadge } from '@/components/priority/PriorityBreakdown';
import StatusTimeline from '@/components/complaints/StatusTimeline';
import SLACountdown from '@/components/complaints/SLACountdown';
import CitizenFeedback from '@/components/complaints/CitizenFeedback';
import PhoneVerifyFlow from '@/components/complaints/PhoneVerifyFlow';
import { COMPLAINT_CATEGORIES } from '@/constants/categories';
import type { Complaint, ComplaintStatus, ComplaintTimelineEntry } from '@/types';

const IssuesMap = dynamic(() => import('@/components/map/IssuesMap'), {
  ssr: false,
  loading: () => <div className="h-56 w-full rounded-xl bg-gray-100 animate-pulse" />,
});

const STEPS: { key: string; label: string; reached: string[] }[] = [
  { key: 'submitted', label: 'Reported', reached: ['submitted', 'verified', 'assigned', 'in_progress', 'resolved', 'closed', 'escalated', 'reopened', 'transferred'] },
  { key: 'assigned', label: 'Assigned', reached: ['assigned', 'in_progress', 'resolved', 'closed', 'escalated', 'reopened', 'transferred'] },
  { key: 'in_progress', label: 'Work started', reached: ['in_progress', 'resolved', 'closed', 'escalated'] },
  { key: 'resolved', label: 'Resolved', reached: ['resolved', 'closed'] },
];

interface TrackResponse {
  complaint: Complaint;
  updates: ComplaintTimelineEntry[];
  department_name: string | null;
  officer_name: string | null;
}

export default function IssuePage({ params }: { params: { uid: string } }) {
  const [data, setData] = useState<TrackResponse | null>(null);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState('');

  const load = useCallback(async () => {
    const res = await fetch(`/api/complaints/track/${params.uid}`);
    const d = await res.json();
    if (d.success) setData(d);
    else setError(d.message || 'Issue not found.');
  }, [params.uid]);

  useEffect(() => { load().catch(() => setError('Network error. Please try again.')); }, [load]);

  const confirm = useCallback(async (token: string) => {
    const res = await fetch(`/api/complaints/track/${params.uid}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_token: token }),
    });
    const d = await res.json();
    setConfirming(false);
    setConfirmMsg(d.success ? `Thanks! ${d.confirmations} people have now confirmed this issue.` : d.message);
    if (d.success) load();
  }, [params.uid, load]);

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-700 mb-4">{error}</p>
        <Link href="/issues" className="text-indigo-700 font-medium hover:underline">← Back to all issues</Link>
      </div>
    );
  }
  if (!data) return <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;

  const c = data.complaint;
  const category = COMPLAINT_CATEGORIES.find((x) => x.value === c.category)?.label_en ?? c.category;
  const done = c.status === 'resolved' || c.status === 'closed';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <Link href="/issues" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-4">
          <ArrowLeft className="w-4 h-4" /> All issues
        </Link>

        {/* Header */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-mono text-gray-400">{c.uid}</p>
              <h1 className="text-xl font-bold text-gray-900 mt-0.5">{c.title}</h1>
              <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 shrink-0" /> <span className="truncate">{c.location_text}</span>
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <PriorityBadge band={c.priority_band} score={c.priority_score} />
              <span className="text-xs text-gray-500">{category}{c.city ? ` · ${c.city}` : ''}</span>
            </div>
          </div>

          {/* Stepper: reported -> resolved */}
          <ol className="mt-6 grid grid-cols-4 gap-2" aria-label="Progress">
            {STEPS.map((s) => {
              const reached = s.reached.includes(c.status);
              return (
                <li key={s.key} className="flex flex-col items-center text-center">
                  {reached ? <CheckCircle2 className="w-6 h-6 text-green-600" /> : <Circle className="w-6 h-6 text-gray-300" />}
                  <span className={`text-xs mt-1 font-medium ${reached ? 'text-gray-900' : 'text-gray-400'}`}>{s.label}</span>
                </li>
              );
            })}
          </ol>
          {c.is_escalated && !done && (
            <p className="mt-4 flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <ShieldAlert className="w-4 h-4" /> Escalated to a supervisor because the resolution deadline passed.
            </p>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <PriorityBreakdown score={c.priority_score} band={c.priority_band} factors={c.priority_breakdown ?? []} />

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-2">What was reported</h2>
              <p className="text-sm text-gray-700 whitespace-pre-line">{c.description}</p>
              {c.ai_severity?.hazards?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {c.ai_severity.hazards.map((h) => (
                    <span key={h} className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-800 border border-red-200">{h}</span>
                  ))}
                </div>
              ) : null}
              {(c.proof_image_urls?.length > 0 || c.resolution_proof_url) && (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {c.proof_image_urls?.[0] && (
                    <figure>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={c.proof_image_urls[0]} alt="Photo from the report" className="w-full h-44 object-cover rounded-lg border" />
                      <figcaption className="text-xs text-gray-500 mt-1">Before (citizen photo)</figcaption>
                    </figure>
                  )}
                  {c.resolution_proof_url && (
                    <figure>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={c.resolution_proof_url} alt="Proof of the fix" className="w-full h-44 object-cover rounded-lg border" />
                      <figcaption className="text-xs text-gray-500 mt-1">After (officer proof)</figcaption>
                    </figure>
                  )}
                </div>
              )}
              {c.resolution_notes && <p className="mt-3 text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-2">Fix notes: {c.resolution_notes}</p>}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Timeline</h2>
              <StatusTimeline updates={data.updates} currentStatus={c.status as ComplaintStatus} />
            </div>

            {done && <CitizenFeedback complaintId={c.id} existingRating={c.citizen_rating} existingFeedback={null} />}
          </div>

          <div className="space-y-5">
            {c.latitude != null && c.longitude != null && (
              <IssuesMap
                issues={[{ uid: c.uid, title: c.title, status: c.status, latitude: c.latitude, longitude: c.longitude, priority_band: c.priority_band, priority_score: c.priority_score }]}
                center={[c.latitude, c.longitude]}
                zoom={16}
                height="h-56"
              />
            )}
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3 text-sm">
              <SLACountdown sla_deadline={c.sla_deadline} status={c.status as ComplaintStatus} />
              <p className="flex items-center gap-2 text-gray-700"><Building2 className="w-4 h-4 text-gray-400" /> {data.department_name ?? 'Department pending'}</p>
              <p className="flex items-center gap-2 text-gray-700"><User className="w-4 h-4 text-gray-400" /> {data.officer_name ?? 'Officer not assigned yet'}</p>
              <p className="flex items-center gap-2 text-gray-700"><ThumbsUp className="w-4 h-4 text-gray-400" /> {c.confirmations} people confirmed this</p>
            </div>

            {!done && (
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h2 className="text-sm font-semibold text-gray-900">Seeing this problem too?</h2>
                <p className="text-xs text-gray-500 mt-1 mb-3">Each verified confirmation raises the priority. One per phone number.</p>
                {confirming ? (
                  <PhoneVerifyFlow onVerified={(token) => confirm(token)} />
                ) : (
                  <button onClick={() => { setConfirming(true); setConfirmMsg(''); }}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-indigo-700 text-white font-medium hover:bg-indigo-800">
                    <ThumbsUp className="w-4 h-4" /> I see this too
                  </button>
                )}
                {confirmMsg && <p className="text-sm text-gray-700 mt-3">{confirmMsg}</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
