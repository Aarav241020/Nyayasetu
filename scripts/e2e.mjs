// End-to-end check against a running server: node scripts/e2e.mjs [baseUrl]
// Needs OTP_MOCK_MODE=true (the demo OTP comes back in the send-otp response).
import assert from 'node:assert/strict';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const api = async (path, body, token) => {
  const res = await fetch(BASE + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
};
const patch = async (path, body, token) => {
  const res = await fetch(BASE + path, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  return { status: res.status, json: await res.json() };
};
const step = (msg) => console.log('✔', msg);
// 1x1 JPEG, enough to exercise the upload path
const PHOTO = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/yQALCAABAAEBAREA/8wABgAQEAX/2gAIAQEAAD8A0s8g/9k=';

async function citizenSession(phone) {
  const sent = (await api('/api/auth/send-otp', { phone })).json;
  assert.equal(sent.success, true);
  const otp = sent.demo_otp;
  assert.match(otp ?? '', /^\d{6}$/, 'demo OTP returned in mock mode');
  const v = await api('/api/auth/verify-otp', { phone, otp });
  assert.ok(v.json.session_token, 'verify-otp returned a session');
  return v.json.session_token;
}

// 1. Public feed + privacy
const feed = await api('/api/issues?status=open');
assert.ok(feed.json.issues.length > 0);
const scores = feed.json.issues.map((i) => i.priority_score);
assert.deepEqual(scores, [...scores].sort((a, b) => b - a), 'feed sorted by priority');
const top = feed.json.issues[0];
const tracked = await api(`/api/complaints/track/${top.uid}`);
for (const k of ['citizen_phone', 'citizen_name', 'citizen_id', 'assigned_officer_id']) assert.ok(!(k in tracked.json.complaint), `tracker leaks ${k}`);
assert.equal(tracked.json.complaint.priority_breakdown.length, 5);
step(`public feed sorted (${feed.json.issues.length} open), tracker hides reporter details`);

// 2. File a geo-tagged issue 40 m from an existing open sewer issue (Lajpat Nagar)
const token = await citizenSession('9876500001');
const filed = await api('/api/complaints', {
  session_token: token, name: 'E2E Tester', title: 'Manhole overflowing in Lajpat Nagar market lane',
  category: 'sewer_blockage', description: 'The manhole cover is broken and sewage is spilling into the market lane, children walk here.',
  address: '', landmark: null, ward: null, latitude: 28.56803, longitude: 77.24336, photo: PHOTO,
});
assert.equal(filed.json.success, true, JSON.stringify(filed.json));
const p = filed.json.priority;
assert.ok(p.score > 0 && ['P1', 'P2', 'P3', 'P4'].includes(p.band));
assert.ok(p.factors.find((f) => f.key === 'frequency').points > 0, 'nearby duplicate counted');
const stored = (await api(`/api/complaints/track/${filed.json.complaint_uid}`)).json.complaint;
assert.equal(stored.proof_image_urls.length, 1, 'photo stored');
assert.equal((await fetch(stored.proof_image_urls[0])).status, 200, 'photo URL is public');
step(`filed ${filed.json.complaint_uid}: ${p.score} ${p.band}; ${p.factors.map((f) => `${f.key}=${f.points}`).join(', ')}`);

const near = await api('/api/complaints/nearby?lat=28.56803&lng=77.24336&category=sewer_blockage');
assert.ok(near.json.issues.length >= 2);
step(`duplicate check finds ${near.json.issues.length} open sewer reports within 150 m`);

// 3. "I see this too" from a second phone raises the score; repeat is rejected; reporter can't self-confirm
const before = (await api(`/api/complaints/track/${filed.json.complaint_uid}`)).json.complaint.priority_score;
const t2 = await citizenSession('9876500002');
const c1 = await api(`/api/complaints/track/${filed.json.complaint_uid}/confirm`, { session_token: t2 });
assert.equal(c1.json.success, true, JSON.stringify(c1.json));
assert.ok(c1.json.priority.score >= before);
assert.equal((await api(`/api/complaints/track/${filed.json.complaint_uid}/confirm`, { session_token: t2 })).status, 409);
assert.equal((await api(`/api/complaints/track/${filed.json.complaint_uid}/confirm`, { session_token: token })).status, 409);
step(`confirmation: score ${before} → ${c1.json.priority.score}; duplicate and self-confirm rejected`);

// 4. Officer (Water & Sewerage) works it; another officer can't touch it
const water = (await api('/api/auth/login', { email: 'water@nyayasetu.in', password: 'Officer@123' })).json.token;
const roads = (await api('/api/auth/login', { email: 'officer@nyayasetu.in', password: 'Officer@123' })).json.token;
const queue = (await api('/api/officer/queue', null, water)).json.complaints;
const qs = queue.map((c) => c.priority_score);
assert.deepEqual(qs, [...qs].sort((a, b) => b - a), 'queue sorted by priority');
const mine = queue.find((c) => c.uid === filed.json.complaint_uid);
assert.ok(mine, 'new issue auto-assigned to the water officer');
assert.equal((await patch(`/api/officer/complaints/${mine.id}/update`, { status: 'in_progress', remarks: null, public_note: 'Team dispatched.' }, roads)).status, 403);
const upd = await patch(`/api/officer/complaints/${mine.id}/update`, { status: 'in_progress', remarks: null, public_note: 'Team dispatched.' }, water);
assert.equal(upd.json.success, true, JSON.stringify(upd.json));
const after = (await api(`/api/complaints/track/${filed.json.complaint_uid}`)).json;
assert.equal(after.complaint.status, 'in_progress');
assert.ok(after.updates.some((u) => u.public_note === 'Team dispatched.'));
step('officer queue sorted by priority; wrong officer blocked (403); status change visible on the public tracker');

// 5. Cron
const cron = await api('/api/cron/escalate');
assert.equal(cron.json.success, true);
step(`cron: ${cron.json.message}`);

// 6. Validation at the trust boundary
const bad = await api('/api/complaints', { session_token: token, name: 'x', title: 'x', category: 'pothole', description: 'a'.repeat(40), latitude: 51.5, longitude: -0.12 });
assert.equal(bad.status, 400);
step('rejects locations outside India');
console.log('\nAll end-to-end checks passed.');
