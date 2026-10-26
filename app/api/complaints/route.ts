import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, leastLoadedOfficer } from '@/lib/db';
import { validateOTPSession } from '@/lib/otp';
import { classifyComplaint } from '@/lib/classifier';
import { calculateSLADeadline } from '@/lib/sla';
import { generateComplaintUID } from '@/lib/utils';
import { assessSeverity } from '@/lib/ai-severity';
import { fetchGeoContext, reverseGeocode, inIndia } from '@/lib/geo';
import { findNearby, rescoreComplaint } from '@/lib/scoring';
import type { FileComplaintRequest, FileComplaintResponse } from '@/types';
import { ComplaintCategory, ComplaintStatus } from '@/types';

const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

function fail(message: string, status: number) {
  return NextResponse.json(
    { success: false, complaint_uid: null, message, classification: null } satisfies FileComplaintResponse,
    { status },
  );
}

export async function POST(request: NextRequest) {
  try {
    const body: FileComplaintRequest = await request.json();
    const { session_token, name, title, category, description, address, landmark, ward, latitude, longitude, photo } = body;

    // --- Validate input (trust boundary) ---
    if (!session_token) return fail('Session token is required.', 400);
    if (!name?.trim() || !title?.trim() || !category || !description?.trim()) {
      return fail('Name, title, category and description are required.', 400);
    }
    if (!Object.values(ComplaintCategory).includes(category)) return fail('Unknown category.', 400);
    if (description.trim().length < 30) return fail('Description must be at least 30 characters.', 400);
    if (typeof latitude !== 'number' || typeof longitude !== 'number' || !inIndia(latitude, longitude)) {
      return fail('Pin the issue on the map (locations inside India only).', 400);
    }
    let photoBuffer: Buffer | null = null;
    if (photo) {
      const m = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(photo);
      if (!m) return fail('Photo must be a JPEG, PNG or WebP image.', 400);
      photoBuffer = Buffer.from(m[2], 'base64');
      if (photoBuffer.length > MAX_PHOTO_BYTES) return fail('Photo is too large (max 3 MB).', 400);
    }

    // --- Validate OTP session ---
    const session = await validateOTPSession(session_token);
    if (!session.valid || !session.phone) return fail('Invalid or expired session. Please verify your phone again.', 401);

    // --- Classify, look up the place, and ask the AI in parallel ---
    const classification = classifyComplaint(description, category);
    const [geo, place, aiSeverity] = await Promise.all([
      fetchGeoContext(latitude, longitude),
      reverseGeocode(latitude, longitude),
      assessSeverity({ title, description, category, imageDataUrl: photo }),
    ]);
    const now = new Date();
    const slaDeadline = calculateSLADeadline(classification.category, now);

    // --- Ensure citizen exists ---
    let citizenId: string;
    const { data: existing } = await supabaseAdmin.from('users').select('id').eq('phone', session.phone).limit(1);
    if (existing?.length) {
      citizenId = existing[0].id;
      await supabaseAdmin.from('users').update({ full_name: name }).eq('id', citizenId);
    } else {
      const { data: created, error } = await supabaseAdmin
        .from('users').insert({ phone: session.phone, full_name: name, role: 'citizen' }).select('id').single();
      if (error || !created) {
        console.error('[API] citizen insert error:', error?.message);
        return fail('Failed to register citizen.', 500);
      }
      citizenId = created.id;
    }

    // --- Insert complaint (retry once on the rare UID collision) ---
    const row = {
      citizen_id: citizenId,
      citizen_phone: session.phone,
      citizen_name: name,
      title: title.trim(),
      category: classification.category,
      department_id: classification.department_id,
      description: description.trim(),
      location_text: address?.trim() || place?.address || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
      landmark: landmark || null,
      ward: ward || null,
      latitude,
      longitude,
      city: place?.city ?? null,
      state: place?.state ?? null,
      status: ComplaintStatus.SUBMITTED,
      urgency: classification.urgency,
      sla_deadline: slaDeadline.toISOString(),
      ai_severity: aiSeverity,
      geo_context: geo,
    };
    let complaint: { id: string; uid: string } | null = null;
    for (let attempt = 0; attempt < 2 && !complaint; attempt++) {
      const { data, error } = await supabaseAdmin.from('complaints').insert({ ...row, uid: generateComplaintUID() }).select('id, uid').single();
      if (data) complaint = data;
      else if (error?.code !== '23505') {
        console.error('[API] complaint insert error:', error?.message);
        return fail('Failed to file complaint.', 500);
      }
    }
    if (!complaint) return fail('Failed to file complaint.', 500);

    // --- Photo ---
    if (photoBuffer) {
      const path = `${complaint.id}/report-${Date.now()}.jpg`;
      const { error } = await supabaseAdmin.storage.from('complaint-proofs').upload(path, photoBuffer, { contentType: 'image/jpeg' });
      if (!error) {
        const url = supabaseAdmin.storage.from('complaint-proofs').getPublicUrl(path).data.publicUrl;
        await supabaseAdmin.from('complaints').update({ proof_image_urls: [url] }).eq('id', complaint.id);
      } else console.error('[API] photo upload error:', error.message);
    }

    await supabaseAdmin.from('complaint_updates').insert({
      complaint_id: complaint.id,
      status: ComplaintStatus.SUBMITTED,
      changed_by: citizenId,
      public_note: 'Issue reported by a citizen.',
    });

    // --- Assign to the least busy officer in the department ---
    const officerId = await leastLoadedOfficer(classification.department_id);
    if (officerId) {
      await supabaseAdmin.from('complaints').update({ assigned_officer_id: officerId, status: ComplaintStatus.ASSIGNED }).eq('id', complaint.id);
      await supabaseAdmin.from('complaint_updates').insert({
        complaint_id: complaint.id,
        status: ComplaintStatus.ASSIGNED,
        changed_by: 'system',
        public_note: 'Assigned to an officer.',
      });
    }

    // --- Score it, and re-score nearby duplicates whose report count just went up ---
    const priority = await rescoreComplaint(complaint.id);
    const siblings = await findNearby(latitude, longitude, classification.category, complaint.id);
    await Promise.all(siblings.map((s) => rescoreComplaint(s.id)));

    return NextResponse.json({
      success: true,
      complaint_uid: complaint.uid,
      message: 'Issue reported successfully.',
      classification,
      priority,
    } satisfies FileComplaintResponse);
  } catch (err) {
    console.error('[API] file complaint error:', err);
    return fail('Internal server error.', 500);
  }
}
