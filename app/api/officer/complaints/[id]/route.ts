import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import { requireAuth } from '@/lib/middleware';
import { UserRole } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await requireAuth(request, [UserRole.OFFICER]);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { id } = params;

    const { data: complaint, error } = await supabaseAdmin
      .from('complaints')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !complaint || complaint.assigned_officer_id !== authResult.id) {
      return NextResponse.json(
        { success: false, message: 'Complaint not found.' },
        { status: 404 }
      );
    }

    // Fetch all updates
    const { data: updates } = await supabaseAdmin
      .from('complaint_updates')
      .select('*')
      .eq('complaint_id', id)
      .order('created_at', { ascending: true });

    // Department name
    let departmentName: string | null = null;
    if (complaint.department_id) {
      const { data: dept } = await supabaseAdmin
        .from('departments')
        .select('name')
        .eq('id', complaint.department_id)
        .single();
      departmentName = dept?.name || null;
    }

    // Citizen info
    let citizenName: string | null = null;
    let citizenPhone: string | null = null;
    if (complaint.citizen_id) {
      const { data: citizen } = await supabaseAdmin
        .from('users')
        .select('full_name, phone')
        .eq('id', complaint.citizen_id)
        .single();
      citizenName = citizen?.full_name || null;
      citizenPhone = citizen?.phone || null;
    }

    return NextResponse.json({
      success: true,
      complaint,
      updates: updates || [],
      department_name: departmentName,
      citizen_name: citizenName,
      citizen_phone: citizenPhone,
    });
  } catch (err) {
    console.error('[API] officer complaint detail error:', err);
    return NextResponse.json(
      { success: false, message: 'Internal server error.' },
      { status: 500 }
    );
  }
}
