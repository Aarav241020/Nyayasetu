import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import { requireAuth } from '@/lib/middleware';
import { UserRole } from '@/types';

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request, [UserRole.OFFICER]);
  if (authResult instanceof NextResponse) return authResult;
  const user = authResult;

  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');
    const urgencyFilter = searchParams.get('urgency');
    const sortBy = searchParams.get('sort_by') || 'priority_score';
    const sortOrder = searchParams.get('sort_order') || 'desc';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const perPage = 20;

    let query = supabaseAdmin
      .from('complaints')
      .select('*', { count: 'exact' })
      .eq('assigned_officer_id', user.id);

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    if (urgencyFilter) {
      query = query.eq('urgency', urgencyFilter);
    }

    const validSortFields = ['priority_score', 'sla_deadline', 'created_at', 'updated_at'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'priority_score';

    query = query.order(sortField, { ascending: sortOrder === 'asc' });

    const from = (page - 1) * perPage;
    const to = from + perPage - 1;
    query = query.range(from, to);

    const { data: complaints, error, count } = await query;

    if (error) {
      console.error('[API] officer queue error:', error.message);
      return NextResponse.json(
        { success: false, message: 'Failed to fetch queue.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      complaints: complaints || [],
      total: count || 0,
      page,
      per_page: perPage,
    });
  } catch (err) {
    console.error('[API] officer queue error:', err);
    return NextResponse.json(
      { success: false, message: 'Internal server error.' },
      { status: 500 }
    );
  }
}
