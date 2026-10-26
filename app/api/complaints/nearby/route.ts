import { NextRequest, NextResponse } from 'next/server';
import { findNearby } from '@/lib/scoring';

export const dynamic = 'force-dynamic';

// Duplicate check before filing: open issues of the same category within 150 m.
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const lat = Number(p.get('lat')), lng = Number(p.get('lng')), category = p.get('category');
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !category) {
    return NextResponse.json({ success: false, message: 'lat, lng and category are required.' }, { status: 400 });
  }
  return NextResponse.json({ success: true, issues: await findNearby(lat, lng, category) });
}
