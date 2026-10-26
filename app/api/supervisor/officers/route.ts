import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import { requireAuth } from '@/lib/middleware';
import { UserRole } from '@/types';
import type { OfficerPerformance } from '@/types';

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request, [UserRole.SUPERVISOR]);
  if (authResult instanceof NextResponse) return authResult;

  try {
    // Get all officers
    const { data: officers, error: offErr } = await supabaseAdmin
      .from('users')
      .select('id, full_name, department_id')
      .eq('role', 'officer');

    if (offErr) {
      console.error('[API] officers error:', offErr.message);
      return NextResponse.json({ success: false, message: 'Failed to fetch officers.' }, { status: 500 });
    }

    const now = new Date().toISOString();
    const results: OfficerPerformance[] = [];

    for (const officer of officers || []) {
      // Get user name

      // Get department name
      const { data: dept } = await supabaseAdmin
        .from('departments')
        .select('name')
        .eq('id', officer.department_id)
        .single();

      // Get complaints for this officer
      const { data: complaints } = await supabaseAdmin
        .from('complaints')
        .select('id, status, sla_deadline, created_at, updated_at')
        .eq('assigned_officer_id', officer.id);

      const all = complaints || [];
      const assigned = all.length;
      const resolved = all.filter((c) => c.status === 'resolved' || c.status === 'closed').length;
      const overdue = all.filter((c) =>
        !['resolved', 'closed'].includes(c.status) && c.sla_deadline < now
      ).length;

      // SLA compliance
      const resolvedList = all.filter((c) => c.status === 'resolved' || c.status === 'closed');
      const inSLA = resolvedList.filter((c) => c.updated_at <= c.sla_deadline).length;
      const slaRate = resolvedList.length > 0 ? Math.round((inSLA / resolvedList.length) * 100) : 100;

      // Avg resolution hours
      let totalHours = 0;
      resolvedList.forEach((c) => {
        totalHours += (new Date(c.updated_at).getTime() - new Date(c.created_at).getTime()) / (1000 * 60 * 60);
      });
      const avgHours = resolvedList.length > 0 ? Math.round(totalHours / resolvedList.length) : 0;

      results.push({
        officer_id: officer.id,
        officer_name: officer.full_name || 'Unknown',
        department_name: dept?.name || officer.department_id,
        assigned_count: assigned,
        resolved_count: resolved,
        overdue_count: overdue,
        avg_resolution_hours: avgHours,
        sla_compliance_rate: slaRate,
      });
    }

    // Sort by SLA compliance ascending (worst first)
    results.sort((a, b) => a.sla_compliance_rate - b.sla_compliance_rate);

    return NextResponse.json({ success: true, officers: results });
  } catch (err) {
    console.error('[API] officers error:', err);
    return NextResponse.json({ success: false, message: 'Internal server error.' }, { status: 500 });
  }
}
