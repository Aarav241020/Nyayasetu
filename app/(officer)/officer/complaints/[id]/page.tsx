'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  AlertTriangle,
  MapPin,
  Calendar,
  Tag,
  UserCircle,
  Phone,
  Building2,
  Upload,
  Send,
  ArrowRightLeft,
  Image as ImageIcon,
} from 'lucide-react';
import type { Complaint, ComplaintTimelineEntry } from '@/types';
import { ComplaintStatus, VALID_STATUS_TRANSITIONS } from '@/types';
import StatusTimeline from '@/components/complaints/StatusTimeline';
import SLACountdown from '@/components/complaints/SLACountdown';

const TOKEN_KEY = 'nyayasetu_token';

const STATUS_LABELS: Record<string, string> = {
  submitted: 'Submitted',
  verified: 'Verified',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
  escalated: 'Escalated',
  reopened: 'Reopened',
  transferred: 'Transferred',
};

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

const DEPARTMENT_OPTIONS = [
  { id: 'dept_001', name: 'Sanitation & Solid Waste' },
  { id: 'dept_002', name: 'Water & Sewerage' },
  { id: 'dept_003', name: 'Electrical & Street Lighting' },
  { id: 'dept_004', name: 'Roads & Infrastructure' },
  { id: 'dept_005', name: 'Parks & Environment' },
  { id: 'dept_006', name: 'Animal Control' },
  { id: 'dept_007', name: 'Anti-Encroachment' },
];

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

export default function OfficerComplaintDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [updates, setUpdates] = useState<ComplaintTimelineEntry[]>([]);
  const [departmentName, setDepartmentName] = useState('');
  const [citizenName, setCitizenName] = useState('');
  const [citizenPhone, setCitizenPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Status update
  const [newStatus, setNewStatus] = useState('');
  const [remarks, setRemarks] = useState('');
  const [publicNote, setPublicNote] = useState('');
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  // Proof upload
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');

  // Transfer
  const [transferDept, setTransferDept] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [transferMsg, setTransferMsg] = useState('');

  const getToken = () => localStorage.getItem(TOKEN_KEY) || '';

  const fetchDetail = useCallback(async () => {
    try {
      const res = await fetch(`/api/officer/complaints/${params.id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.success) {
        setComplaint(data.complaint);
        setUpdates(data.updates || []);
        setDepartmentName(data.department_name || '');
        setCitizenName(data.citizen_name || '');
        setCitizenPhone(data.citizen_phone || '');
      } else {
        setError(data.message || 'Failed to load.');
      }
    } catch {
      setError('Network error.');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  // Status update
  const handleStatusUpdate = useCallback(async () => {
    if (!newStatus) return;
    setStatusUpdating(true);
    setStatusMsg('');
    try {
      const res = await fetch(`/api/officer/complaints/${params.id}/update`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, remarks: remarks || null, public_note: publicNote || null }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg('Status updated successfully.');
        setNewStatus('');
        setRemarks('');
        setPublicNote('');
        fetchDetail();
      } else {
        setStatusMsg(data.message || 'Update failed.');
      }
    } catch {
      setStatusMsg('Network error.');
    } finally {
      setStatusUpdating(false);
    }
  }, [params.id, newStatus, remarks, publicNote, fetchDetail]);

  // Proof upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProofFile(file);
      setProofPreview(URL.createObjectURL(file));
    }
  };

  const handleUploadProof = useCallback(async () => {
    if (!proofFile) return;
    setUploading(true);
    setUploadMsg('');
    try {
      const formData = new FormData();
      formData.append('file', proofFile);
      const res = await fetch(`/api/officer/complaints/${params.id}/proof`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setUploadMsg('Proof uploaded.');
        setProofFile(null);
        setProofPreview('');
        fetchDetail();
      } else {
        setUploadMsg(data.message || 'Upload failed.');
      }
    } catch {
      setUploadMsg('Network error.');
    } finally {
      setUploading(false);
    }
  }, [params.id, proofFile, fetchDetail]);

  // Transfer
  const handleTransfer = useCallback(async () => {
    if (!transferDept || !transferReason) return;
    setTransferring(true);
    setTransferMsg('');
    try {
      const res = await fetch(`/api/officer/complaints/${params.id}/transfer`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ department_id: transferDept, reason: transferReason }),
      });
      const data = await res.json();
      if (data.success) {
        // The complaint now belongs to another department's officer, so this officer
        // can no longer open it; go back to the queue instead of a "not found" screen.
        setTransferMsg('Complaint transferred. Returning to your queue…');
        setTimeout(() => router.push('/officer'), 1200);
      } else {
        setTransferMsg(data.message || 'Transfer failed.');
      }
    } catch {
      setTransferMsg('Network error.');
    } finally {
      setTransferring(false);
    }
  }, [params.id, transferDept, transferReason, router]);

  if (loading) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-24"></div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
           <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
           <div className="h-6 bg-gray-200 rounded w-64"></div>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-5">
             <div className="bg-white rounded-xl border border-gray-200 p-5 h-64"></div>
             <div className="bg-white rounded-xl border border-gray-200 p-5 h-32"></div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 h-96"></div>
        </div>
      </div>
    );
  }

  if (error || !complaint) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <AlertTriangle className="w-10 h-10 text-gray-300" />
        <p className="text-gray-500">{error || 'Not found.'}</p>
        <button onClick={() => router.push('/officer')} className="text-sm text-indigo-600 hover:underline">← Back to Queue</button>
      </div>
    );
  }

  const allowedTransitions = VALID_STATUS_TRANSITIONS[complaint.status as ComplaintStatus] || [];

  return (
    <div className="p-6">
      {/* Back */}
      <button onClick={() => router.push('/officer')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-indigo-600 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Queue
      </button>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <span className="text-xs font-mono text-gray-400">{complaint.uid}</span>
            <h1 className="text-xl font-bold text-gray-900 mt-1">{complaint.title || 'Untitled'}</h1>
          </div>
          <SLACountdown sla_deadline={complaint.sla_deadline} status={complaint.status as ComplaintStatus} />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: Details + Actions */}
        <div className="xl:col-span-2 space-y-5">
          {/* Metadata */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2.5">
            <div className="flex items-center gap-3 text-sm">
              <Tag className="w-4 h-4 text-gray-400" /><span className="text-gray-500 w-24">Category</span>
              <span className="text-gray-900">{CATEGORY_LABELS[complaint.category] || complaint.category}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Building2 className="w-4 h-4 text-gray-400" /><span className="text-gray-500 w-24">Department</span>
              <span className="text-gray-900">{departmentName || complaint.department_id}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <MapPin className="w-4 h-4 text-gray-400" /><span className="text-gray-500 w-24">Address</span>
              <span className="text-gray-900">{complaint.location_text}{complaint.landmark ? ` (${complaint.landmark})` : ''}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="w-4 h-4 text-gray-400" /><span className="text-gray-500 w-24">Filed</span>
              <span className="text-gray-900">{formatDate(complaint.created_at)}</span>
            </div>
            {citizenName && (
              <div className="flex items-center gap-3 text-sm">
                <UserCircle className="w-4 h-4 text-gray-400" /><span className="text-gray-500 w-24">Citizen</span>
                <span className="text-gray-900">{citizenName}</span>
              </div>
            )}
            {citizenPhone && (
              <div className="flex items-center gap-3 text-sm">
                <Phone className="w-4 h-4 text-gray-400" /><span className="text-gray-500 w-24">Phone</span>
                <span className="text-gray-900">+91 {citizenPhone}</span>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-2">Description</h2>
            <p className="text-sm text-gray-700 leading-relaxed">{complaint.description}</p>
          </div>

          {/* Status Update */}
          {allowedTransitions.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Send className="w-4 h-4 text-indigo-500" /> Update Status
              </h2>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-indigo-500"
              >
                <option value="">Select new status...</option>
                {allowedTransitions.map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>
                ))}
              </select>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Internal remarks (not visible to citizen)..."
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-indigo-500 resize-none"
              />
              <textarea
                value={publicNote}
                onChange={(e) => setPublicNote(e.target.value)}
                placeholder="Public note (visible to citizen)..."
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-indigo-500 resize-none"
              />
              {statusMsg && <p className="text-xs text-indigo-600">{statusMsg}</p>}
              <button
                onClick={handleStatusUpdate}
                disabled={!newStatus || statusUpdating}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium
                  hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {statusUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update Status'}
              </button>
            </div>
          )}

          {/* Proof Upload */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Upload className="w-4 h-4 text-green-500" /> Upload Resolution Proof
            </h2>
            {complaint.resolution_proof_url && (
              <div className="mb-2">
                <p className="text-xs text-gray-400 mb-1">Current proof:</p>
                <img src={complaint.resolution_proof_url} alt="Proof" className="w-full max-w-sm rounded-lg border border-gray-200" />
              </div>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="text-sm text-gray-600"
            />
            {proofPreview && (
              <img src={proofPreview} alt="Preview" className="w-full max-w-xs rounded-lg border border-gray-200" />
            )}
            {uploadMsg && <p className="text-xs text-green-600">{uploadMsg}</p>}
            <button
              onClick={handleUploadProof}
              disabled={!proofFile || uploading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium
                hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ImageIcon className="w-4 h-4" /> Upload Proof</>}
            </button>
          </div>

          {/* Transfer */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-purple-500" /> Transfer Complaint
            </h2>
            <select
              value={transferDept}
              onChange={(e) => setTransferDept(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-indigo-500"
            >
              <option value="">Select target department...</option>
              {DEPARTMENT_OPTIONS.filter((d) => d.id !== complaint.department_id).map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <textarea
              value={transferReason}
              onChange={(e) => setTransferReason(e.target.value)}
              placeholder="Reason for transfer..."
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-indigo-500 resize-none"
            />
            {transferMsg && <p className="text-xs text-purple-600">{transferMsg}</p>}
            <button
              onClick={handleTransfer}
              disabled={!transferDept || !transferReason || transferring}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium
                hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {transferring ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Transfer Complaint'}
            </button>
          </div>
        </div>

        {/* Right: Timeline */}
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Update History</h2>
            <StatusTimeline updates={updates} currentStatus={complaint.status as ComplaintStatus} />
          </div>
        </div>
      </div>
    </div>
  );
}
