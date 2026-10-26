'use client';

import React, { useState, useEffect } from 'react';
import {
  Loader2,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  BarChart3,
  Users,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from 'recharts';
import type { DashboardMetrics, OfficerPerformance } from '@/types';
import PriorityHotspots from '@/components/dashboard/PriorityHotspots';

const TOKEN_KEY = 'nyayasetu_token';

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

interface OverdueComplaint {
  id: string;
  uid: string;
  title: string;
  category: string;
  officer_name: string | null;
  hours_overdue: number;
}

export default function SupervisorDashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [officers, setOfficers] = useState<OfficerPerformance[]>([]);
  const [overdue, setOverdue] = useState<OverdueComplaint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const token = localStorage.getItem(TOKEN_KEY);
      const headers = { Authorization: `Bearer ${token}` };

      const [dashRes, offRes, overdueRes] = await Promise.all([
        fetch('/api/supervisor/dashboard', { headers }),
        fetch('/api/supervisor/officers', { headers }),
        fetch('/api/supervisor/overdue', { headers }),
      ]);

      const [dashData, offData, overdueData] = await Promise.all([
        dashRes.json(), offRes.json(), overdueRes.json(),
      ]);

      if (dashData.success) setMetrics(dashData.metrics);
      if (offData.success) setOfficers(offData.officers);
      if (overdueData.success) setOverdue(overdueData.complaints.slice(0, 5));
      setLoading(false);
    }
    load();
  }, []);

  const handleEscalate = async (complaintId: string) => {
    const token = localStorage.getItem(TOKEN_KEY);
    await fetch('/api/supervisor/escalate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ complaint_id: complaintId, reason: 'SLA breach — escalated by supervisor.' }),
    });
    // Refresh overdue list
    const res = await fetch('/api/supervisor/overdue', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.success) setOverdue(data.complaints.slice(0, 5));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <AlertTriangle className="w-10 h-10 text-gray-300" />
        <p className="text-gray-500">Failed to load dashboard.</p>
      </div>
    );
  }

  const chartCategoryData = metrics.category_breakdown.map((c) => ({
    name: CATEGORY_LABELS[c.category] || c.category,
    count: c.count,
  }));

  const trendData = metrics.daily_trend.map((d) => ({
    date: new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    count: d.count,
  }));


  return (
    <div className="p-6 max-w-6xl mx-auto w-full animate-fadeIn">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Supervisor Dashboard</h1>

      {/* Section 1 — Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <MetricCard icon={<BarChart3 className="w-5 h-5 text-indigo-600" />} label="Total" value={metrics.total_complaints} bg="bg-indigo-50" />
        <MetricCard icon={<TrendingUp className="w-5 h-5 text-blue-600" />} label="Active" value={metrics.active_complaints} bg="bg-blue-50" />
        <MetricCard icon={<CheckCircle className="w-5 h-5 text-green-600" />} label="Resolved" value={metrics.resolved_complaints} bg="bg-green-50" />
        <MetricCard icon={<AlertTriangle className="w-5 h-5 text-red-600" />} label="Overdue" value={metrics.overdue_complaints} bg="bg-red-50" textColor="text-red-700" />
        <MetricCard icon={<Clock className="w-5 h-5 text-orange-600" />} label="Escalated" value={metrics.escalated_complaints} bg="bg-orange-50" />
        <MetricCard icon={<CheckCircle className="w-5 h-5 text-emerald-600" />} label="SLA %" value={`${metrics.sla_compliance_rate}%`} bg="bg-emerald-50" />
      </div>

      {/* Section 2 — Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Category Breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Complaints by Category</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartCategoryData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 7-day Trend */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">7-Day Complaint Trend</h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Section 2.5 — Priority hotspots */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-8">
        <h2 className="text-xl font-semibold text-slate-900 mb-1">Priority hotspots</h2>
        <p className="text-sm text-slate-500 mb-6">Open issues across all areas. Bigger, redder pins have higher priority scores.</p>
        <PriorityHotspots />
      </div>

      {/* Section 3 — Overdue Complaints */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900">Top Overdue Complaints</h2>
          <a href="/supervisor/overdue" className="text-xs text-purple-600 hover:underline">View All →</a>
        </div>
        {overdue.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No overdue complaints. 🎉</p>
        ) : (
          <div className="space-y-2">
            {overdue.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-100">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-gray-500">{c.uid}</span>
                    <span className="text-xs bg-red-200 text-red-800 px-2 py-0.5 rounded-full font-semibold">
                      {c.hours_overdue}h overdue
                    </span>
                  </div>
                  <p className="text-sm text-gray-800 truncate mt-0.5">{c.title || c.category}</p>
                  <p className="text-xs text-gray-500">{c.officer_name || 'Unassigned'}</p>
                </div>
                <button
                  onClick={() => handleEscalate(c.id)}
                  className="ml-3 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 transition-all flex-shrink-0"
                >
                  Escalate
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 4 — Officer Performance Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Users className="w-4 h-4 text-purple-500" /> Officer Performance
        </h2>
        {officers.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No officer data.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-gray-500 font-medium text-xs">Officer</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium text-xs">Dept</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium text-xs">Assigned</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium text-xs">Resolved</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium text-xs">Overdue</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium text-xs">SLA %</th>
                </tr>
              </thead>
              <tbody>
                {officers.map((o) => (
                  <tr key={o.officer_id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-2 px-3 text-gray-900">{o.officer_name}</td>
                    <td className="py-2 px-3 text-gray-500 text-xs">{o.department_name}</td>
                    <td className="py-2 px-3 text-right text-gray-700">{o.assigned_count}</td>
                    <td className="py-2 px-3 text-right text-green-600">{o.resolved_count}</td>
                    <td className="py-2 px-3 text-right text-red-600">{o.overdue_count}</td>
                    <td className="py-2 px-3 text-right">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                        o.sla_compliance_rate >= 80 ? 'bg-green-100 text-green-700' :
                        o.sla_compliance_rate >= 50 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {o.sla_compliance_rate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, bg, textColor }: {
  icon: React.ReactNode; label: string; value: number | string; bg: string; textColor?: string;
}) {
  return (
    <div className={`${bg} rounded-xl p-4`}>
      <div className="mb-2">{icon}</div>
      <p className={`text-2xl font-bold ${textColor || 'text-gray-900'}`}>{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
