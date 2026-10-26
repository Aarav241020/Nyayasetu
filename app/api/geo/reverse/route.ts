import { NextRequest, NextResponse } from 'next/server';
import { reverseGeocode, inIndia } from '@/lib/geo';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const lat = Number(request.nextUrl.searchParams.get('lat'));
  const lng = Number(request.nextUrl.searchParams.get('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !inIndia(lat, lng)) {
    return NextResponse.json({ success: false, message: 'Location must be inside India.' }, { status: 400 });
  }
  const place = await reverseGeocode(lat, lng);
  return NextResponse.json({ success: !!place, place });
}
