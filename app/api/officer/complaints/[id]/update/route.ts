import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import { requireAuth } from '@/lib/middleware';
import { UserRole, ComplaintStatus, VALID_STATUS_TRANSITIONS } from '@/types';
import type { UpdateComplaintStatusRequest } from '@/types';
import { rescoreComplaint } from '@/lib/scoring';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await requireAuth(request, [UserRole.OFFICER]);
  if (authResult instanceof NextResponse) return authResult;
  const user = authResult;

  try {
    const { id } = params;
    const body: UpdateComplaintStatusRequest = await request.json();
    const { status: newStatus, remarks, public_note } = body;

    if (!newStatus) {
      return NextResponse.json(
        { success: false, message: 'New status is required.' },
        { status: 400 }
      );
    }

    // Fetch current complaint
    const { data: complaint, error: fetchError } = await supabaseAdmin
      .from('complaints')
      .select('id, status, assigned_officer_id')
      .eq('id', id)
      .single();

    if (fetchError || !complaint) {
      return NextResponse.json(
        { success: false, message: 'Complaint not found.' },
        { status: 404 }
      );
    }

    // Validate status transition
    if (complaint.assigned_officer_id !== user.id) {
      return NextResponse.json({ success: false, message: 'This complaint is not assigned to you.' }, { status: 403 });
    }

    const currentStatus = complaint.status as ComplaintStatus;
    const allowed = VALID_STATUS_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      return NextResponse.json(
        {
          success: false,
          message: `Cannot transition from "${currentStatus}" to "${newStatus}". Allowed: ${allowed.join(', ') || 'none'}.`,
        },
        { status: 400 }
      );
    }

    // Update complaint
    const updateData: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    // resolution_notes is shown publicly, so only the officer's public note goes there;
    // internal remarks stay in complaint_updates.notes, which the tracker never returns.
    if (newStatus === ComplaintStatus.RESOLVED) {
      updateData.resolution_notes = public_note?.trim() || null;
    }

    const { error: updateError } = await supabaseAdmin
      .from('complaints')
      .update(updateData)
      .eq('id', id);

    if (updateError) {
      console.error('[API] status update error:', updateError.message);
      return NextResponse.json(
        { success: false, message: 'Failed to update status.' },
        { status: 500 }
      );
    }

    // Insert timeline entry
    await supabaseAdmin.from('complaint_updates').insert({
      complaint_id: id,
      status: newStatus,
      changed_by: user.id,
      notes: remarks || null,
      public_note: public_note || null,
    });

    await rescoreComplaint(id);

    return NextResponse.json({
      success: true,
      message: `Status updated to "${newStatus}".`,
    });
  } catch (err) {
    console.error('[API] status update error:', err);
    return NextResponse.json(
      { success: false, message: 'Internal server error.' },
      { status: 500 }
    );
  }
}
