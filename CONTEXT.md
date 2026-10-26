# NyayaSetu — Master Build Context (siNUsoid PS 9 fork)
# Paste this at the start of every new AI coding session.

## Product
**NyayaSetu (न्याय सेतु)**: geo-tagged civic issue reporting with an **explainable priority score** and a
**public resolution tracker**, India-wide (demo data: Delhi + Neemrana). Built for siNUsoid PS 9.

## Tech stack (don't deviate)
| Layer | Choice |
|---|---|
| Framework | Next.js 14 App Router, TypeScript strict |
| Styling | Tailwind only · icons lucide-react · charts recharts |
| Maps | Leaflet + react-leaflet + OpenStreetMap tiles (load with `next/dynamic`, `ssr:false`) |
| DB / files | Supabase Postgres + Storage bucket `complaint-proofs`. Schema: `supabase/migrations/0001_init.sql` |
| Auth | Staff: email + bcrypt + JWT (`lib/auth.ts`). Citizens: phone OTP → session JWT (`lib/otp.ts`) |
| AI | Groq via the `openai` package, lazy client in `lib/llm.ts`. Must work without a key. |
| i18n | react-i18next, `i18n/en.json` + `i18n/hi.json` |

## Key files
- `types/index.ts`: single source of truth for types. **DB column names match it** (`uid`, `citizen_id`,
  `location_text`, `assigned_officer_id`; timeline rows use `status`, `changed_by`, `notes`, `public_note`).
- `lib/priority.ts`: pure scoring function + `WEIGHTS` (tests: `npm test`).
- `lib/scoring.ts`: `rescoreComplaint`, `findNearby` (150 m duplicate window).
- `lib/geo.ts` (Overpass nearby places, Nominatim reverse geocode), `lib/ai-severity.ts` (text + photo → 1–5).
- `lib/db.ts`: `supabaseAdmin`, `PUBLIC_COMPLAINT_COLUMNS`, `leastLoadedOfficer`.

## Rules
1. All DB access is server-side through `supabaseAdmin`; RLS denies the anon key.
2. Public endpoints select `PUBLIC_COMPLAINT_COLUMNS`, never `*` (no reporter phone/name).
3. Officers may only read/update/transfer complaints assigned to them.
4. Call `rescoreComplaint(id)` after anything that changes status, confirmations or location.
5. Every priority factor must keep a human-readable `reason`.
6. External services (Groq, Overpass, Nominatim) are best-effort with timeouts and a fallback.

## Status flow
`submitted → verified → assigned → in_progress → resolved → closed`, plus `escalated` (SLA breach, automatic via
`/api/cron/escalate`), `reopened`, `transferred`. Allowed moves: `VALID_STATUS_TRANSITIONS` in `types/index.ts`.
