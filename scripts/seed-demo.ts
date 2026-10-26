/**
 * Demo data for Delhi and Neemrana (NIIT University area).
 *
 *   npm run seed:demo
 *
 * WIPES all complaints and users, then creates staff logins, ~45 issues across
 * every status, confirmations and duplicates. Nearby-place data comes from the
 * real OpenStreetMap API for each pin; AI severity is used only if GROQ_API_KEY
 * is set (otherwise the score uses the honest category baseline).
 */
import bcrypt from 'bcryptjs';
import { supabaseAdmin as db } from '@/lib/db';
import { fetchGeoContext } from '@/lib/geo';
import { assessSeverity } from '@/lib/ai-severity';
import { classifyComplaint } from '@/lib/classifier';
import { calculateSLADeadline } from '@/lib/sla';
import { rescoreComplaint } from '@/lib/scoring';
import { runAutoEscalation } from '@/lib/escalation';
import { CATEGORY_DEPARTMENT_MAP, ComplaintCategory as C, ComplaintStatus as S } from '@/types';
import type { GeoContext } from '@/types';

const HOUR = 3_600_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let seed = 42;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646; // deterministic
const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
const jitter = (m: number) => (rand() - 0.5) * 2 * (m / 111_320); // ~m metres

// ---------------------------------------------------------------------------
// Staff (passwords match the README / demo banner)
// ---------------------------------------------------------------------------
const STAFF = [
  { email: 'supervisor@nyayasetu.in', full_name: 'Meera Krishnan', role: 'supervisor', password: 'Super@123', department_id: null },
  { email: 'officer@nyayasetu.in', full_name: 'Rajesh Kumar', role: 'officer', password: 'Officer@123', department_id: 'dept_004' },
  { email: 'sanitation@nyayasetu.in', full_name: 'Sunita Yadav', role: 'officer', password: 'Officer@123', department_id: 'dept_001' },
  { email: 'water@nyayasetu.in', full_name: 'Imran Qureshi', role: 'officer', password: 'Officer@123', department_id: 'dept_002' },
  { email: 'electrical@nyayasetu.in', full_name: 'Harpreet Singh', role: 'officer', password: 'Officer@123', department_id: 'dept_003' },
  { email: 'parks@nyayasetu.in', full_name: 'Kavita Joshi', role: 'officer', password: 'Officer@123', department_id: 'dept_005' },
  { email: 'animals@nyayasetu.in', full_name: 'Arun Mehra', role: 'officer', password: 'Officer@123', department_id: 'dept_006' },
  { email: 'encroachment@nyayasetu.in', full_name: 'Deepak Chauhan', role: 'officer', password: 'Officer@123', department_id: 'dept_007' },
];

// ---------------------------------------------------------------------------
// Issues. [title, category, description, lat, lng, place, city, state]
// ---------------------------------------------------------------------------
type Row = [string, C, string, number, number, string, string, string];
const D = (t: string, c: C, d: string, lat: number, lng: number, place: string): Row => [t, c, d, lat, lng, place, 'Delhi', 'Delhi'];
const N = (t: string, c: C, d: string, lat: number, lng: number, place: string): Row => [t, c, d, lat, lng, place, 'Neemrana', 'Rajasthan'];

const ISSUES: Row[] = [
  // --- Neemrana / NIIT University ---
  N('Deep pothole at NU main gate on NH-48', C.POTHOLE, 'A deep pothole right at the NIIT University gate on NH-48. Bikes swerve into the highway lane to avoid it; two students fell last week.', 27.9621, 76.4046, 'NH-48, near NIIT University gate'),
  N('Streetlights dead on NU approach road', C.STREETLIGHT, 'All streetlights on the stretch from NH-48 to the NU hostel gate are off after 7 pm. Students walking back from the bus stop are in complete darkness.', 27.9612, 76.4031, 'NU approach road'),
  N('Garbage pile behind Neemrana bus stand', C.GARBAGE_COLLECTION, 'Huge garbage heap behind the bus stand, not cleared for over a week. Stray cattle are eating plastic and the smell reaches the ticket counter.', 27.9851, 76.3902, 'Neemrana bus stand'),
  N('Garbage not collected near bus stand market', C.GARBAGE_COLLECTION, 'Shopkeepers near the bus stand have been dumping waste on the corner because the municipal collection van has not come for days.', 27.9855, 76.3897, 'Bus stand market, Neemrana'),
  N('Waste dumped by roadside near bus stand', C.GARBAGE_COLLECTION, 'Plastic and food waste piled on the roadside near the bus stand entrance, blocking half the footpath for passengers.', 27.9848, 76.3906, 'Bus stand entrance'),
  N('Open drain overflowing on Fort Road', C.DRAIN_OVERFLOW, 'The open drain along Neemrana Fort road overflows every evening and dirty water spreads across the road used by tourists and school children.', 27.9878, 76.3852, 'Neemrana Fort road'),
  N('Pothole cluster on NH-48 service lane', C.POTHOLE, 'Series of potholes on the NH-48 service lane near the Neemrana flyover. Trucks entering the industrial area slow down suddenly, causing near misses.', 27.9791, 76.4012, 'NH-48 service lane, flyover'),
  N('Stray dogs chasing students near Majrakath', C.STRAY_ANIMAL, 'A pack of 6-7 stray dogs near the Majrakath turn chases two-wheelers and students cycling to campus, especially early morning.', 27.9553, 76.3951, 'Majrakath turn'),
  N('Water pipeline leaking in industrial area', C.WATER_LEAKAGE, 'Main water pipeline leaking continuously near the Japanese zone gate, wasting thousands of litres a day and flooding the road shoulder.', 27.9722, 76.4121, 'Neemrana industrial area'),
  N('Illegal construction debris dumped on village road', C.ILLEGAL_DUMPING, 'Truckloads of construction debris dumped overnight on the village road leading to NU. The road is now single-lane.', 27.9585, 76.3998, 'Village road to NU'),
  N('Stagnant water breeding mosquitoes near market', C.MOSQUITO_SANITATION, 'Rainwater has been stagnant in an empty plot next to the main market for two weeks. Many dengue cases reported in the colony.', 27.9862, 76.3878, 'Main market, Neemrana'),
  N('Broken streetlight at Neemrana flyover', C.STREETLIGHT, 'The high-mast light at the flyover junction has been off for 10 days. The junction is dangerous at night with highway traffic.', 27.9795, 76.4005, 'Neemrana flyover junction'),
  N('Sewer blocked near government school', C.SEWER_BLOCKAGE, 'Sewer line blocked outside the government senior secondary school. Sewage is leaking near the school gate where children wait.', 27.9869, 76.3866, 'Govt school, Neemrana'),
  N('Park benches broken in Neemrana town park', C.PARK_MAINTENANCE, 'Most benches in the town park are broken and the walking track lights do not work. Elderly residents have stopped using it.', 27.9843, 76.3884, 'Town park'),
  N('Shops encroaching footpath on NH-48 market stretch', C.ENCROACHMENT, 'Shops near the highway market have extended onto the footpath, forcing pedestrians to walk on the NH-48 carriageway.', 27.9808, 76.3996, 'NH-48 market stretch'),
  N('Pothole near NU staff quarters', C.POTHOLE, 'A large pothole on the internal road near the staff quarters fills with water and hides its depth. A car got stuck yesterday.', 27.9603, 76.4019, 'Near NU staff quarters'),

  // --- Delhi ---
  D('Sewage overflowing near AIIMS gate 2', C.SEWER_BLOCKAGE, 'Sewage overflowing onto the road outside AIIMS gate 2. Patients and ambulances have to pass through dirty water. Urgent health hazard.', 28.5672, 77.2100, 'AIIMS, Ansari Nagar'),
  D('Sewer blocked on Aurobindo Marg near AIIMS', C.SEWER_BLOCKAGE, 'Manhole near the AIIMS metro exit is overflowing with sewage, spreading towards the bus stop.', 28.5677, 77.2095, 'AIIMS metro exit'),
  D('Open manhole in Lajpat Nagar market', C.SEWER_BLOCKAGE, 'Manhole cover missing in Central Market, Lajpat Nagar. It is in the middle of the walking lane and very dangerous at night. Urgent.', 28.5677, 77.2433, 'Lajpat Nagar Central Market'),
  D('Garbage piling up in Chandni Chowk lane', C.GARBAGE_COLLECTION, 'Garbage not collected for 5 days in the lane behind Paranthe Wali Gali. Overflowing bins attract rats.', 28.6506, 77.2303, 'Chandni Chowk'),
  D('Waste overflowing near Chandni Chowk metro', C.GARBAGE_COLLECTION, 'Community bins near the metro gate overflowing; waste spills onto the road during peak hours.', 28.6509, 77.2309, 'Chandni Chowk metro'),
  D('Garbage dump next to Town Hall', C.GARBAGE_COLLECTION, 'A dhalao near the old Town Hall has not been emptied for a week; waste now covers the footpath.', 28.6502, 77.2298, 'Town Hall, Chandni Chowk'),
  D('Huge pothole on Ring Road near Moolchand', C.POTHOLE, 'A huge pothole on the Ring Road flyover approach near Moolchand. Two-wheelers brake suddenly; an accident is waiting to happen.', 28.5654, 77.2357, 'Moolchand flyover'),
  D('Streetlights not working in Hauz Khas Village road', C.STREETLIGHT, 'Streetlights along Hauz Khas Village road are off for a week. The road is unsafe for women walking back at night.', 28.5494, 77.2001, 'Hauz Khas Village'),
  D('Water pipe burst in Karol Bagh', C.WATER_LEAKAGE, 'Water main burst on Ajmal Khan Road; clean water flooding the market since morning while nearby houses have no supply.', 28.6519, 77.1909, 'Ajmal Khan Road, Karol Bagh'),
  D('Drain overflow in Mayur Vihar Phase 1', C.DRAIN_OVERFLOW, 'Storm drain overflowing near Pocket 1 after the rain; dirty water entering ground floor homes.', 28.6083, 77.2950, 'Mayur Vihar Phase 1'),
  D('Stagnant water and mosquitoes in Rohini Sector 7', C.MOSQUITO_SANITATION, 'Construction pit in Sector 7 full of stagnant water for weeks; mosquitoes everywhere and two dengue cases in the block.', 28.7041, 77.1025, 'Rohini Sector 7'),
  D('Stray cattle blocking road in Dwarka Sector 10', C.STRAY_ANIMAL, 'Herd of stray cattle sitting on the main road near the Sector 10 market causes daily jams and a few minor accidents.', 28.5823, 77.0500, 'Dwarka Sector 10'),
  D('Illegal dumping of debris near Yamuna bank', C.ILLEGAL_DUMPING, 'Trucks dumping construction debris near the Yamuna floodplain at night. The heap is growing every week.', 28.6129, 77.2780, 'Yamuna bank, Mayur Vihar'),
  D('Footpath encroached in Saket', C.ENCROACHMENT, 'Vendors have fully occupied the footpath outside Select Citywalk; pedestrians walk on the road with fast traffic.', 28.5285, 77.2190, 'Saket District Centre'),
  D('Broken swings in Lodhi Garden play area', C.PARK_MAINTENANCE, 'Two swings in the children play area of Lodhi Garden have broken chains and sharp edges.', 28.5931, 77.2197, 'Lodhi Garden'),
  D('Pothole outside school in Dwarka Sector 6', C.POTHOLE, 'Big pothole right outside the school gate in Dwarka Sector 6; school vans tilt and children have to step around it.', 28.5900, 77.0566, 'Dwarka Sector 6'),
  D('Dark stretch near Connaught Place outer circle', C.STREETLIGHT, 'Several lights on the outer circle near Block F are not working; the stretch is dark and feels unsafe.', 28.6315, 77.2167, 'Connaught Place outer circle'),
  D('Water leakage near Rajiv Chowk metro', C.WATER_LEAKAGE, 'Continuous water leakage from an underground pipe near metro gate 7 has made the pavement slippery.', 28.6328, 77.2197, 'Rajiv Chowk'),
  D('Garbage not collected in Rohini Sector 3', C.GARBAGE_COLLECTION, 'Door-to-door collection stopped for a week in Sector 3 pocket B; residents are throwing waste in the park.', 28.6990, 77.1110, 'Rohini Sector 3'),
  D('Drain choked near Sarojini Nagar market', C.DRAIN_OVERFLOW, 'Drain outside the market is choked with plastic; water collects on the road after every shower.', 28.5772, 77.1968, 'Sarojini Nagar market'),
  D('Stray dogs aggressive in Kalkaji', C.STRAY_ANIMAL, 'Pack of aggressive stray dogs near Kalkaji temple road; a child was bitten last week.', 28.5494, 77.2588, 'Kalkaji'),
  D('Encroachment on road in Paharganj', C.ENCROACHMENT, 'Hotels have extended ramps and signboards onto Main Bazar road, making it impossible for ambulances to enter.', 28.6441, 77.2131, 'Main Bazar, Paharganj'),
  D('Pothole on Mathura Road near Ashram', C.POTHOLE, 'Deep pothole on Mathura Road near Ashram flyover; water hides it during rain.', 28.5710, 77.2550, 'Ashram, Mathura Road'),
  D('Mosquito breeding in Saket park pond', C.MOSQUITO_SANITATION, 'The decorative pond in the Saket J-block park has stagnant green water and heavy mosquito breeding.', 28.5245, 77.2066, 'Saket J Block park'),
  D('Streetlight sparking in Karol Bagh', C.STREETLIGHT, 'A streetlight pole on Pusa Road is sparking with exposed wires at the base. Danger to people waiting at the bus stop.', 28.6440, 77.1890, 'Pusa Road'),
  D('Park lights off in Rajouri Garden', C.PARK_MAINTENANCE, 'All lights in the J-block park are off, and the gym equipment is rusting.', 28.6420, 77.1220, 'Rajouri Garden'),
  D('Garbage burning near Okhla', C.ILLEGAL_DUMPING, 'Waste is being dumped and burnt in an empty plot near Okhla Phase 2, smoke enters nearby houses every night.', 28.5355, 77.2720, 'Okhla Phase 2'),
];

// Status mix: [status, share]. Older issues are more likely resolved.
const STATUS_FOR_AGE = (ageH: number, slaH: number): S => {
  const r = rand();
  if (ageH > slaH * 1.2) return r < 0.6 ? S.RESOLVED : r < 0.75 ? S.CLOSED : S.IN_PROGRESS; // overdue ones not resolved get escalated later
  if (ageH > slaH * 0.5) return r < 0.35 ? S.RESOLVED : r < 0.75 ? S.IN_PROGRESS : S.ASSIGNED;
  return r < 0.15 ? S.IN_PROGRESS : r < 0.85 ? S.ASSIGNED : S.SUBMITTED;
};

async function main() {
  if (!process.argv.includes('--yes')) {
    console.log('This WIPES all complaints and users in the configured Supabase project.\nRun: npm run seed:demo -- --yes');
    process.exit(1);
  }
  const t0 = Date.now();
  console.log('Clearing old data…');
  await db.from('complaints').delete().not('id', 'is', null);
  await db.from('otp_verifications').delete().not('id', 'is', null);
  await db.from('users').delete().not('id', 'is', null);

  console.log('Creating staff…');
  const officers: Record<string, string> = {};
  for (const s of STAFF) {
    const { password, ...row } = s;
    const { data, error } = await db.from('users').insert({ ...row, password_hash: await bcrypt.hash(password, 10) }).select('id').single();
    if (error) throw new Error(`staff ${s.email}: ${error.message}`);
    if (s.department_id) officers[s.department_id] = data.id;
  }

  console.log(`Creating ${ISSUES.length} issues (looking up nearby places on OpenStreetMap, ~1 s each)…`);
  const now = Date.now();
  const useAI = !!process.env.GROQ_API_KEY;
  for (const [idx, [title, category, description, lat, lng, place, city, state]] of ISSUES.entries()) {
    const phone = `98${String(10000000 + idx * 7919).slice(0, 8)}`;
    const { data: citizen } = await db.from('users').insert({ phone, full_name: `Demo Citizen ${idx + 1}`, role: 'citizen' }).select('id').single();

    const ageH = 2 + Math.floor(rand() * 20 * 24); // up to 20 days old
    const created = new Date(now - ageH * HOUR);
    const cls = classifyComplaint(description, category);
    const sla = calculateSLADeadline(category, created);
    const slaH = (sla.getTime() - created.getTime()) / HOUR;
    const status = STATUS_FOR_AGE(ageH, slaH);
    const done = status === S.RESOLVED || status === S.CLOSED;
    const geo: GeoContext = await fetchGeoContext(lat, lng);
    await sleep(1100); // be polite to the free Overpass API
    const ai = useAI ? await assessSeverity({ title, description, category }) : null;
    const resolvedAt = done ? new Date(created.getTime() + slaH * (0.3 + rand() * 1.1) * HOUR) : null;
    const officer = officers[CATEGORY_DEPARTMENT_MAP[category]] ?? null;

    const { data: c, error } = await db.from('complaints').insert({
      uid: `NYC-${created.toISOString().slice(0, 10).replace(/-/g, '')}-${String(10001 + idx)}`,
      citizen_id: citizen!.id,
      citizen_phone: phone,
      citizen_name: `Demo Citizen ${idx + 1}`,
      title, category, description,
      department_id: cls.department_id,
      location_text: place, city, state,
      latitude: lat + jitter(15), longitude: lng + jitter(15),
      status, urgency: cls.urgency,
      sla_deadline: sla.toISOString(),
      assigned_officer_id: status === S.SUBMITTED ? null : officer,
      resolution_notes: done ? pick(['Repaired and site cleaned.', 'Cleared by the ward team.', 'Fixed; please reopen if it recurs.']) : null,
      citizen_rating: status === S.CLOSED ? 3 + Math.floor(rand() * 3) : null,
      ai_severity: ai,
      geo_context: geo,
      created_at: created.toISOString(),
      updated_at: (resolvedAt ?? created).toISOString(),
    }).select('id').single();
    if (error) throw new Error(`issue ${title}: ${error.message}`);

    // Public timeline
    const steps: [S, string, number][] = [[S.SUBMITTED, 'Issue reported by a citizen.', 0]];
    if (status !== S.SUBMITTED) steps.push([S.ASSIGNED, 'Assigned to an officer.', 0.2]);
    if ([S.IN_PROGRESS, S.RESOLVED, S.CLOSED].includes(status)) steps.push([S.IN_PROGRESS, 'Work has started on site.', 2 + rand() * 10]);
    if (done) steps.push([S.RESOLVED, 'Marked resolved by the officer.', (resolvedAt!.getTime() - created.getTime()) / HOUR]);
    if (status === S.CLOSED) steps.push([S.CLOSED, 'Closed after citizen feedback.', (resolvedAt!.getTime() - created.getTime()) / HOUR + 6]);
    await db.from('complaint_updates').insert(steps.map(([st, note, h]) => ({
      complaint_id: c!.id, status: st, changed_by: st === S.SUBMITTED ? citizen!.id : 'system', public_note: note,
      created_at: new Date(created.getTime() + h * HOUR).toISOString(),
    })));

    // Some open issues get "I see this too" confirmations
    if (!done && rand() < 0.55) {
      const n = 1 + Math.floor(rand() * 9);
      await db.from('complaint_confirmations').insert(Array.from({ length: n }, (_, k) => ({ complaint_id: c!.id, phone: `97${idx}${k}`.padEnd(10, '0') })));
      await db.from('complaints').update({ confirmations: n }).eq('id', c!.id);
    }
    process.stdout.write(`  ${idx + 1}/${ISSUES.length} ${city}: ${title}\n`);
  }

  console.log('Escalating overdue issues and scoring everything…');
  const escalated = await runAutoEscalation();
  const { data: all } = await db.from('complaints').select('id');
  for (const { id } of all ?? []) await rescoreComplaint(id);
  console.log(`Done in ${Math.round((Date.now() - t0) / 1000)} s: ${all?.length} issues, ${escalated} auto-escalated. AI severity: ${useAI ? 'on' : 'off (no GROQ_API_KEY)'}.`);
  console.log('Logins: officer@nyayasetu.in / Officer@123 (Roads), supervisor@nyayasetu.in / Super@123');
}

main().catch((e) => { console.error(e); process.exit(1); });
