import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import { requireAuth } from '@/lib/middleware';
import { UserRole } from '@/types';

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request, [UserRole.SUPERVISOR]);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const now = new Date().toISOString();

    // Overdue = SLA breached AND not resolved/closed
    const { data: complaints, error } = await supabaseAdmin
      .from('complaints')
      .select('*, officer:users!complaints_assigned_officer_id_fkey(full_name), department:departments(name)')
      .lt('sla_deadline', now)
      .not('status', 'in', '("resolved","closed")')
      .order('sla_deadline', { ascending: true });

    if (error) {
      console.error('[API] overdue error:', error.message);
      return NextResponse.json({ success: false, message: 'Failed to fetch overdue.' }, { status: 500 });
    }

    // Officer and department names come joined in the same query.
    const enriched = (complaints || []).map(({ officer, department, ...c }) => ({
      ...c,
      officer_name: (officer as { full_name: string } | null)?.full_name ?? null,
      department_name: (department as { name: string } | null)?.name ?? null,
      hours_overdue: Math.round((Date.now() - new Date(c.sla_deadline).getTime()) / 3_600_000),
    }));

    return NextResponse.json({ success: true, complaints: enriched });
  } catch (err) {
    console.error('[API] overdue error:', err);
    return NextResponse.json({ success: false, message: 'Internal server error.' }, { status: 500 });
  }
}
