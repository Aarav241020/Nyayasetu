'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, AlertTriangle, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

const TOKEN_KEY = 'nyayasetu_token';

const CATEGORY_LABELS: Record<string, string> = {
  garbage_collection: 'Garbage Collection',
  water_leakage: 'Water Leakage',
  sewer_blockage: 'Sewer Blockage',
  drain_overflow: 'Drain Overflow',
  streetlight: 'Streetlight',
  pothole: 'Pothole',
  illegal_dumping: 'Illegal Dumping',
  mosquito_sanitation: 'Mosquito / Sanitation',
  stray_animal: 'Stray Animal',
  park_maintenance: 'Park Maintenance',
  encroachment: 'Encroachment',
};

interface OverdueComplaint {
  id: string;
  uid: string;
  title: string;
  category: string;
  status: string;
  officer_name: string | null;
  department_name: string | null;
  hours_overdue: number;
  location_text: string;
  sla_deadline: string;
}

interface OfficerOption {
  officer_id: string;
  officer_name: string;
  department_name: string;
}

export default function SupervisorOverduePage() {
  const router = useRouter();
  const [complaints, setComplaints] = useState<OverdueComplaint[]>([]);
  const [officers, setOfficers] = useState<OfficerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [escalatingId, setEscalatingId] = useState<string | null>(null);

  const getToken = () => localStorage.getItem(TOKEN_KEY) || '';

  const fetchData = useCallback(async () => {
    const headers = { Authorization: `Bearer ${getToken()}` };
    const [overdueRes, offRes] = await Promise.all([
      fetch('/api/supervisor/overdue', { headers }),
      fetch('/api/supervisor/officers', { headers }),
    ]);
    const [overdueData, offData] = await Promise.all([overdueRes.json(), offRes.json()]);

    if (overdueData.success) setComplaints(overdueData.complaints);
    if (offData.success) {
      setOfficers(offData.officers.map((o: OfficerOption) => ({
        officer_id: o.officer_id,
        officer_name: o.officer_name,
        department_name: o.department_name,
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleEscalate = async (complaintId: string, reassignTo?: string) => {
    setEscalatingId(complaintId);
    await fetch('/api/supervisor/escalate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        complaint_id: complaintId,
        reason: 'SLA breach — escalated by supervisor.',
        reassign_to_officer_id: reassignTo || undefined,
      }),
    });
    setEscalatingId(null);
    fetchData();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-32"><Loader2 className="w-6 h-6 text-purple-600 animate-spin" /></div>;
  }

  return (
    <div className="p-6">
      <button onClick={() => router.push('/supervisor')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-purple-600 mb-4">
        <ArrowLeft className="w-4 h-4" /> Dashboard
      </button>

      <h1 className="text-xl font-bold text-gray-900 mb-2">Overdue Complaints</h1>
      <p className="text-sm text-gray-500 mb-6">{complaints.length} complaint(s) have breached SLA</p>

      {complaints.length === 0 ? (
        <div className="text-center py-16">
          <AlertTriangle className="w-10 h-10 text-green-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No overdue complaints. Everything is on track! 🎉</p>
        </div>
      ) : (
        <div className="space-y-3">
          {complaints.map((c) => (
            <OverdueCard
              key={c.id}
              complaint={c}
              officers={officers}
              escalating={escalatingId === c.id}
              onEscalate={handleEscalate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OverdueCard({
  complaint,
  officers,
  escalating,
  onEscalate,
}: {
  complaint: OverdueComplaint;
  officers: OfficerOption[];
  escalating: boolean;
  onEscalate: (id: string, reassignTo?: string) => void;
}) {
  const [reassignTo, setReassignTo] = useState('');

  return (
    <div className="bg-white rounded-xl border border-red-200 p-5">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-xs font-mono text-gray-400">{complaint.uid}</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700">
              {complaint.hours_overdue}h overdue
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-700">
              {complaint.status.replace('_', ' ').toUpperCase()}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-gray-900">{complaint.title || CATEGORY_LABELS[complaint.category]}</h3>
          <p className="text-xs text-gray-500 mt-1">{complaint.location_text}</p>
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
            <span>Officer: <strong className="text-gray-700">{complaint.officer_name || 'Unassigned'}</strong></span>
            <span>Dept: {complaint.department_name || '—'}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 sm:items-end flex-shrink-0">
          <select
            value={reassignTo}
            onChange={(e) => setReassignTo(e.target.value)}
            className="px-2 py-1.5 rounded-lg border border-gray-300 text-xs outline-none focus:border-purple-500 w-full sm:w-48"
          >
            <option value="">Reassign to officer...</option>
            {officers.map((o) => (
              <option key={o.officer_id} value={o.officer_id}>
                {o.officer_name} ({o.department_name})
              </option>
            ))}
          </select>

          <button
            onClick={() => onEscalate(complaint.id, reassignTo || undefined)}
            disabled={escalating || (complaint.status === 'escalated' && !reassignTo)}
            title={complaint.status === 'escalated' && !reassignTo ? 'Already escalated. Pick an officer to reassign.' : undefined}
            className="flex items-center justify-center gap-1 px-4 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium
              hover:bg-red-700 disabled:opacity-50 transition-all w-full sm:w-auto"
          >
            {escalating ? <Loader2 className="w-3 h-3 animate-spin" /> : complaint.status === 'escalated' ? (reassignTo ? 'Reassign' : 'Already escalated') : 'Escalate'}
          </button>
        </div>
      </div>
    </div>
  );
}
