'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import type { Complaint } from '@/types';
import { ComplaintStatus } from '@/types';
import { PriorityBadge } from '@/components/priority/PriorityBreakdown';

interface ComplaintQueueCardProps {
  complaint: Complaint;
}

const STATUS_COLORS: Record<string, string> = {
  submitted: 'bg-gray-100 text-gray-700',
  verified: 'bg-blue-100 text-blue-700',
  assigned: 'bg-indigo-100 text-indigo-700',
  in_progress: 'bg-amber-100 text-amber-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-gray-200 text-gray-600',
  escalated: 'bg-red-100 text-red-700',
  reopened: 'bg-orange-100 text-orange-700',
  transferred: 'bg-purple-100 text-purple-700',
};

const URGENCY_COLORS: Record<string, string> = {
  low: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-red-100 text-red-700',
};

const CATEGORY_LABELS: Record<string, string> = {
  garbage_collection: 'Garbage',
  water_leakage: 'Water',
  sewer_blockage: 'Sewer',
  drain_overflow: 'Drain',
  streetlight: 'Streetlight',
  pothole: 'Pothole',
  illegal_dumping: 'Dumping',
  mosquito_sanitation: 'Mosquito',
  stray_animal: 'Stray Animal',
  park_maintenance: 'Park',
  encroachment: 'Encroach',
};

function getSLAStatus(deadline: string, status: string): { label: string; color: string } {
  const terminal = [ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED] as string[];
  if (terminal.includes(status)) {
    return { label: 'Done', color: 'bg-green-100 text-green-700' };
  }
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff < 0) {
    const hoursOver = Math.abs(Math.floor(diff / (1000 * 60 * 60)));
    return { label: `${hoursOver}h overdue`, color: 'bg-red-100 text-red-700' };
  }
  const hoursLeft = Math.floor(diff / (1000 * 60 * 60));
  if (hoursLeft <= 4) {
    return { label: `${hoursLeft}h left`, color: 'bg-orange-100 text-orange-700' };
  }
  return { label: `${hoursLeft}h left`, color: 'bg-green-100 text-green-700' };
}

export default function ComplaintQueueCard({ complaint }: ComplaintQueueCardProps) {
  const router = useRouter();
  const sla = getSLAStatus(complaint.sla_deadline, complaint.status);

  return (
    <button
      onClick={() => router.push(`/officer/complaints/${complaint.id}`)}
      className="w-full text-left bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:border-indigo-300
        hover:shadow-md transition-all group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-mono text-gray-400">{complaint.uid}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_COLORS[complaint.status]}`}>
              {complaint.status.replace('_', ' ').toUpperCase()}
            </span>
            {complaint.priority_band && <PriorityBadge band={complaint.priority_band} score={complaint.priority_score} />}
          </div>
          <h3 className="text-sm font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
            {complaint.title || complaint.description.slice(0, 60)}
          </h3>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <MapPin className="w-3 h-3" />
              <span className="truncate max-w-[180px]">{complaint.location_text}</span>
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${URGENCY_COLORS[complaint.urgency]}`}>
            {complaint.urgency.toUpperCase()}
          </span>
          <span className="text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
            {CATEGORY_LABELS[complaint.category] || complaint.category}
          </span>
          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${sla.color}`}>
            {sla.label.includes('overdue') ? (
              <AlertTriangle className="w-3 h-3" />
            ) : sla.label === 'Done' ? (
              <CheckCircle className="w-3 h-3" />
            ) : (
              <Clock className="w-3 h-3" />
            )}
            {sla.label}
          </span>
        </div>
      </div>
    </button>
  );
}
