import { NextRequest, NextResponse } from 'next/server';
import { runAutoEscalation } from '@/lib/escalation';
import { rescoreOpenComplaints, retryGeoLookups } from '@/lib/scoring';

export const dynamic = 'force-dynamic';

// Run every ~15 min from any scheduler. If CRON_SECRET is set, require `Authorization: Bearer <secret>`.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, message: 'Unauthorized.' }, { status: 401 });
  }
  try {
    const escalated = await runAutoEscalation();
    const geoFixed = await retryGeoLookups();
    const rescored = await rescoreOpenComplaints();
    return NextResponse.json({
      success: true,
      message: `Escalated ${escalated}, re-scored ${rescored}, retried ${geoFixed} location lookups.`,
      escalated_count: escalated,
      rescored_count: rescored,
      geo_fixed_count: geoFixed,
    });
  } catch (err) {
    console.error('[Cron] escalation error:', err);
    return NextResponse.json({ success: false, message: 'Escalation failed.' }, { status: 500 });
  }
}
