import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import { validateOTPSession } from '@/lib/otp';
import { rescoreComplaint } from '@/lib/scoring';

// "I see this too": one confirmation per verified phone per issue. Raises the frequency factor.
export async function POST(request: NextRequest, { params }: { params: { uid: string } }) {
  try {
    const { session_token } = await request.json();
    const session = session_token ? await validateOTPSession(session_token) : { valid: false, phone: null };
    if (!session.valid || !session.phone) {
      return NextResponse.json({ success: false, message: 'Please verify your phone first.' }, { status: 401 });
    }
    const { data: c } = await supabaseAdmin.from('complaints').select('id, status, citizen_phone').eq('uid', params.uid.toUpperCase()).single();
    if (!c) return NextResponse.json({ success: false, message: 'Issue not found.' }, { status: 404 });
    if (['resolved', 'closed'].includes(c.status)) {
      return NextResponse.json({ success: false, message: 'This issue is already resolved.' }, { status: 409 });
    }
    if (c.citizen_phone === session.phone) {
      return NextResponse.json({ success: false, message: 'You reported this issue, so it already counts.' }, { status: 409 });
    }
    const { error } = await supabaseAdmin.from('complaint_confirmations').insert({ complaint_id: c.id, phone: session.phone });
    if (error?.code === '23505') return NextResponse.json({ success: false, message: 'You have already confirmed this issue.' }, { status: 409 });
    if (error) throw new Error(error.message);

    const { count } = await supabaseAdmin.from('complaint_confirmations').select('*', { count: 'exact', head: true }).eq('complaint_id', c.id);
    await supabaseAdmin.from('complaints').update({ confirmations: count ?? 0 }).eq('id', c.id);
    const priority = await rescoreComplaint(c.id);
    return NextResponse.json({ success: true, confirmations: count ?? 0, priority });
  } catch (err) {
    console.error('[API] confirm error:', err);
    return NextResponse.json({ success: false, message: 'Internal server error.' }, { status: 500 });
  }
}
