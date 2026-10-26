import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import { requireAuth } from '@/lib/middleware';
import { UserRole, ComplaintStatus } from '@/types';
import type { EscalateRequest } from '@/types';

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request, [UserRole.SUPERVISOR]);
  if (authResult instanceof NextResponse) return authResult;
  const user = authResult;

  try {
    const body: EscalateRequest = await request.json();
    const { complaint_id, reason, reassign_to_officer_id } = body;

    if (!complaint_id || !reason) {
      return NextResponse.json(
        { success: false, message: 'Complaint ID and reason are required.' },
        { status: 400 }
      );
    }

    // Update complaint
    const updateData: Record<string, unknown> = {
      status: ComplaintStatus.ESCALATED,
      is_escalated: true,
      updated_at: new Date().toISOString(),
    };

    if (reassign_to_officer_id) {
      updateData.assigned_officer_id = reassign_to_officer_id;
    }

    const { error: updateErr } = await supabaseAdmin
      .from('complaints')
      .update(updateData)
      .eq('id', complaint_id);

    if (updateErr) {
      console.error('[API] escalate error:', updateErr.message);
      return NextResponse.json({ success: false, message: 'Failed to escalate.' }, { status: 500 });
    }

    // Insert escalation record
    await supabaseAdmin.from('escalations').insert({
      complaint_id,
      escalated_by: user.id,
      reason,
      auto_escalated: false,
    });

    // Insert complaint_update
    await supabaseAdmin.from('complaint_updates').insert({
      complaint_id,
      status: ComplaintStatus.ESCALATED,
      changed_by: user.id,
      notes: `Escalated by supervisor. Reason: ${reason}`,
      public_note: 'Your complaint has been escalated for priority resolution.',
    });

    return NextResponse.json({ success: true, message: 'Complaint escalated.' });
  } catch (err) {
    console.error('[API] escalate error:', err);
    return NextResponse.json({ success: false, message: 'Internal server error.' }, { status: 500 });
  }
}
