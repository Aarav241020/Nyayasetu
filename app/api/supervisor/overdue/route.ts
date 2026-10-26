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
      .select('*')
      .lt('sla_deadline', now)
      .not('status', 'in', '("resolved","closed")')
      .order('sla_deadline', { ascending: true });

    if (error) {
      console.error('[API] overdue error:', error.message);
      return NextResponse.json({ success: false, message: 'Failed to fetch overdue.' }, { status: 500 });
    }

    // Enrich with officer name + department
    const enriched = await Promise.all(
      (complaints || []).map(async (c) => {
        let officer_name: string | null = null;
        let department_name: string | null = null;

        if (c.assigned_officer_id) {
          const { data: officer } = await supabaseAdmin
            .from('users')
            .select('full_name')
            .eq('id', c.assigned_officer_id)
            .single();
          officer_name = officer?.full_name || null;
        }

        if (c.department_id) {
          const { data: dept } = await supabaseAdmin
            .from('departments')
            .select('name')
            .eq('id', c.department_id)
            .single();
          department_name = dept?.name || null;
        }

        const hoursOverdue = Math.round(
          (Date.now() - new Date(c.sla_deadline).getTime()) / (1000 * 60 * 60)
        );

        return { ...c, officer_name, department_name, hours_overdue: hoursOverdue };
      })
    );

    return NextResponse.json({ success: true, complaints: enriched });
  } catch (err) {
    console.error('[API] overdue error:', err);
    return NextResponse.json({ success: false, message: 'Internal server error.' }, { status: 500 });
  }
}
