-- NyayaSetu (siNUsoid PS 9) — schema.
-- Column names match types/index.ts. All access goes through Next.js API routes
-- using the service role; RLS is on with no policies, so the anon key can't read or write.

create table public.departments (
  id   text primary key,
  name text not null
);

insert into public.departments (id, name) values
  ('dept_001', 'Sanitation & Solid Waste'),
  ('dept_002', 'Water & Sewerage'),
  ('dept_003', 'Electrical & Street Lighting'),
  ('dept_004', 'Roads & Infrastructure'),
  ('dept_005', 'Parks & Environment'),
  ('dept_006', 'Animal Control'),
  ('dept_007', 'Anti-Encroachment');

-- Citizens (phone, via OTP) and staff (email + password) share one table.
create table public.users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique,
  phone         text unique,
  full_name     text,
  role          text not null default 'citizen' check (role in ('citizen', 'officer', 'supervisor', 'admin')),
  password_hash text,
  is_active     boolean not null default true,
  department_id text references public.departments (id),
  ward          text,
  zone          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.otp_verifications (
  id            uuid primary key default gen_random_uuid(),
  phone         text not null,
  otp_hash      text not null,
  expires_at    timestamptz not null,
  is_verified   boolean not null default false,
  session_token text,
  created_at    timestamptz not null default now()
);
create index otp_phone_idx on public.otp_verifications (phone, created_at desc);

create table public.complaints (
  id                   uuid primary key default gen_random_uuid(),
  uid                  text not null unique,                 -- NYC-YYYYMMDD-XXXXX, public tracking id
  citizen_id           uuid references public.users (id),
  citizen_phone        text,                                 -- never returned by public endpoints
  citizen_name         text,
  title                text not null,
  category             text not null,
  department_id        text references public.departments (id),
  description          text not null,
  location_text        text not null,
  landmark             text,
  latitude             double precision,
  longitude            double precision,
  city                 text,
  state                text,
  ward                 text,
  zone                 text,
  status               text not null default 'submitted',
  urgency              text not null default 'medium',
  proof_image_urls     text[] not null default '{}',
  sla_deadline         timestamptz not null,
  assigned_officer_id  uuid references public.users (id),
  is_escalated         boolean not null default false,
  resolution_notes     text,
  resolution_proof_url text,
  citizen_feedback     text,
  citizen_rating       int check (citizen_rating between 1 and 5),
  -- Priority scoring (lib/priority.ts)
  ai_severity          jsonb,      -- { severity 1-5, hazards[], reasoning, source }
  geo_context          jsonb,      -- nearby schools/hospitals/roads from OpenStreetMap
  confirmations        int not null default 0,
  priority_score       int not null default 0,
  priority_band        text not null default 'P4',
  priority_breakdown   jsonb not null default '[]',
  parent_id            uuid references public.complaints (id),  -- set when merged into an earlier report
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index complaints_status_idx   on public.complaints (status);
create index complaints_officer_idx  on public.complaints (assigned_officer_id);
create index complaints_priority_idx on public.complaints (priority_score desc);
create index complaints_geo_idx      on public.complaints (latitude, longitude);

-- Public timeline. changed_by is a user id or 'system'.
create table public.complaint_updates (
  id           uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints (id) on delete cascade,
  status       text not null,
  changed_by   text not null,
  notes        text,
  public_note  text,
  created_at   timestamptz not null default now()
);
create index complaint_updates_complaint_idx on public.complaint_updates (complaint_id, created_at);

-- "I see this too": one confirmation per phone per issue.
create table public.complaint_confirmations (
  complaint_id uuid not null references public.complaints (id) on delete cascade,
  phone        text not null,
  created_at   timestamptz not null default now(),
  primary key (complaint_id, phone)
);

create table public.escalations (
  id             uuid primary key default gen_random_uuid(),
  complaint_id   uuid not null references public.complaints (id) on delete cascade,
  escalated_by   text not null,
  reason         text not null,
  auto_escalated boolean not null default false,
  created_at     timestamptz not null default now()
);

create table public.ai_logs (
  id         uuid primary key default gen_random_uuid(),
  input      text,
  output     text,
  model      text,
  type       text,
  created_at timestamptz not null default now()
);

alter table public.departments             enable row level security;
alter table public.users                   enable row level security;
alter table public.otp_verifications       enable row level security;
alter table public.complaints              enable row level security;
alter table public.complaint_updates       enable row level security;
alter table public.complaint_confirmations enable row level security;
alter table public.escalations             enable row level security;
alter table public.ai_logs                 enable row level security;

-- Public bucket for citizen photos and officers' resolution proof.
insert into storage.buckets (id, name, public) values ('complaint-proofs', 'complaint-proofs', true)
on conflict (id) do nothing;
