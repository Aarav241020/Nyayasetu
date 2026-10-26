import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, PUBLIC_COMPLAINT_COLUMNS } from '@/lib/db';

type TrackedRow = Record<string, unknown> & { id: string; department_id: string | null; assigned_officer_id: string | null };

// Public tracker. Never returns the reporter's phone, name or internal officer notes.
export async function GET(_request: NextRequest, { params }: { params: { uid: string } }) {
  try {
    const uid = params.uid?.toUpperCase().trim();
    if (!uid) return NextResponse.json({ success: false, message: 'Complaint UID is required.' }, { status: 400 });

    const { data } = await supabaseAdmin
      .from('complaints')
      .select(PUBLIC_COMPLAINT_COLUMNS + ', assigned_officer_id')
      .eq('uid', uid)
      .single();
    const complaint = data as TrackedRow | null;
    if (!complaint) {
      return NextResponse.json({ success: false, message: `No issue found with ID "${uid}". Please check the ID and try again.` }, { status: 404 });
    }

    const [{ data: updates }, dept, officer] = await Promise.all([
      supabaseAdmin.from('complaint_updates').select('id, status, public_note, created_at').eq('complaint_id', complaint.id).order('created_at'),
      complaint.department_id ? supabaseAdmin.from('departments').select('name').eq('id', complaint.department_id).single() : null,
      complaint.assigned_officer_id ? supabaseAdmin.from('users').select('full_name').eq('id', complaint.assigned_officer_id).single() : null,
    ]);
    const { assigned_officer_id: _omit, ...publicComplaint } = complaint; // eslint-disable-line @typescript-eslint/no-unused-vars

    return NextResponse.json({
      success: true,
      complaint: publicComplaint,
      updates: updates ?? [],
      department_name: dept?.data?.name ?? null,
      officer_name: officer?.data?.full_name ?? null,
    });
  } catch (err) {
    console.error('[API] complaint track error:', err);
    return NextResponse.json({ success: false, message: 'Internal server error.' }, { status: 500 });
  }
}
