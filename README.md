# NyayaSetu: Civic Issue Reporting & Resolution Tracker

**siNUsoid · PS 9.** Citizens pin a civic issue on the map (pothole, garbage, dead streetlight…). NyayaSetu
**scores its priority automatically and explains every point**, routes it to the right department, and shows
the public its progress from *reported* to *resolved*.

> Built on NyayaSetu by Anoopkumar V (Next.js + Supabase civic complaints). This fork adds geo-tagging,
> the priority engine, the public tracker and the extras below.

## What it does

| | |
|---|---|
| **Geo-tagged reporting** | Map pin or GPS (anywhere in India), photo, address auto-filled from the pin. Similar open reports within 150 m are shown before you submit, so people *confirm* instead of duplicating. |
| **Explainable priority (0–100)** | Five factors with fixed weights, and a written reason for each (see below). Officers' queues are sorted by it. |
| **Public tracker** | `/issues` map + ranked list, `/issues/<ID>` with a reported → assigned → work started → resolved stepper, score breakdown, deadline countdown, timeline and before/after photos. No login needed. |
| **Accountability** | Per-category deadlines (SLA); overdue issues auto-escalate to a supervisor and that shows publicly. `/stats` publishes on-time rate and average fix time per city and category. |
| **Extras** | Report by chatting in Hindi or English (`/chat` builds the report for you) · "I see this too" verified confirmations · officer least-load auto-assignment · supervisor priority hotspot map · installable on phones (PWA) · bilingual UI. |

## The priority score

`lib/priority.ts` is a pure, unit-tested function. All weights live in one `WEIGHTS` constant.

| Factor | Max | How |
|---|---|---|
| Severity | 35 | An LLM (Groq Llama vision) rates harm 1–5 from the **description and photo**, blended 70/30 with a per-category baseline. No API key → baseline + urgent keywords. |
| Reports & confirmations | 25 | Similar open reports within 150 m (last 14 days) + verified confirmations, on a **log scale** so spam can't buy the top slot. |
| Location sensitivity | 20 | Hospitals (6), schools (5), main roads (5), markets (2), bus stops (2) within 250 m, from **OpenStreetMap**. |
| Time pressure | 15 | Share of the resolution deadline used; overdue = full points. |
| Seasonal risk | 5 | Drains, sewers, water and mosquito issues during the monsoon (Jun–Sep). |

Bands: **P1 Critical ≥ 70 · P2 High ≥ 50 · P3 Medium ≥ 30 · P4 Low.** Scores are recalculated on filing, on each
confirmation, on status changes, and by the cron job (time pressure grows on its own).

## Run it locally

Needs Node 20+ and a Supabase project (the free tier is fine).

```bash
git clone https://github.com/Aarav241020/Nyayasetu && cd Nyayasetu
npm install
cp .env.local.example .env.local      # fill in Supabase keys (+ optional GROQ_API_KEY)
```

1. **Database:** paste `supabase/migrations/0001_init.sql` into Supabase → SQL Editor → Run.
   (Or with the Supabase CLI: `npx supabase link` then `npx supabase db push`.)
2. **Demo data:** `npm run seed:demo -- --yes` (wipes and recreates ~45 issues in Delhi and Neemrana).
3. **Start:** `npm run dev` → http://localhost:3000

Demo logins (at `/login`): `officer@nyayasetu.in` / `Officer@123` (Roads) · `supervisor@nyayasetu.in` / `Super@123`.
Citizen OTPs are printed in the terminal while `OTP_MOCK_MODE=true`.

Run the cron by hand: `curl http://localhost:3000/api/cron/escalate`.

## Checks

```bash
npm test          # priority engine tests
DEV_LOG=dev.log npm run test:e2e   # full flow against a running dev server (npm run dev > dev.log)
npx tsc --noEmit  # types
npm run lint
npm run build
```

## Stack

Next.js 14 (App Router, TypeScript) · Tailwind · Supabase (Postgres + Storage) · Leaflet + OpenStreetMap ·
Groq (Llama) via the OpenAI SDK · react-i18next (English/Hindi) · recharts.
