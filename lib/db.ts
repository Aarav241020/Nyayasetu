import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ---------------------- Environment Validation ----------------------

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL — add it to .env.local (see .env.local.example)'
  );
}

if (!supabaseAnonKey) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_ANON_KEY — add it to .env.local (see .env.local.example)'
  );
}

// ---------------------- Public Client (anon key) ----------------------
// Use this for client-side operations and public queries.

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// ---------------------- Admin Client (service role key) ----------------------
// Use this for server-side operations that require elevated privileges.
// NEVER expose this client or its key to the browser.

function createAdminClient(): SupabaseClient {
  if (!supabaseServiceRoleKey) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY — add it to .env.local (see .env.local.example). ' +
      'This key is required for server-side operations.'
    );
  }
  return createClient(supabaseUrl!, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export const supabaseAdmin: SupabaseClient = createAdminClient();

// Columns safe to show the public: never citizen_phone, citizen_name or citizen_id.
export const PUBLIC_COMPLAINT_COLUMNS =
  'id, uid, title, category, department_id, description, location_text, landmark, latitude, longitude, city, state, ward, zone, ' +
  'status, urgency, proof_image_urls, sla_deadline, is_escalated, resolution_notes, resolution_proof_url, citizen_rating, ' +
  'confirmations, priority_score, priority_band, priority_breakdown, ai_severity, geo_context, parent_id, created_at, updated_at';

/** Active officer in a department with the fewest open complaints (null if the department has none). */
export async function leastLoadedOfficer(departmentId: string): Promise<string | null> {
  const { data: officers } = await supabaseAdmin
    .from('users').select('id').eq('department_id', departmentId).eq('role', 'officer').eq('is_active', true);
  if (!officers?.length) return null;
  const { data: open } = await supabaseAdmin
    .from('complaints').select('assigned_officer_id')
    .in('assigned_officer_id', officers.map((o) => o.id))
    .not('status', 'in', '("resolved","closed")');
  const load = new Map(officers.map((o) => [o.id, 0]));
  for (const c of open ?? []) load.set(c.assigned_officer_id, (load.get(c.assigned_officer_id) ?? 0) + 1);
  return [...load.entries()].sort((a, b) => a[1] - b[1])[0][0];
}
