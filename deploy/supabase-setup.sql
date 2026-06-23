-- EU Youth Buddy — Supabase setup for real per-user accounts.
--
-- Run ONCE in the Supabase SQL editor (Dashboard → SQL Editor → New query → paste → Run).
-- It creates the per-user `profiles` table that the backend reads/writes (keyed to auth.users).
--
-- The backend talks to this table with the SERVICE ROLE key and therefore bypasses RLS, but we
-- still enable Row Level Security with own-row policies so the table is also safe to read/write
-- directly from the client (anon key) if you ever want to.

-- Columns mirror the visible fields of the Romanian identity card (carte de identitate),
-- plus `country` (the ESC eligibility form's <option> code) for the autopilot. Everything is
-- stored as text so partial/edited scans never fail a type check. This data is EU-resident
-- (your Supabase project's region) and is NEVER sent to the LLM — see app/tools.py.
create table if not exists public.profiles (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  name           text        not null default '',  -- full name (Nume + Prenume), kept for greetings
  first_name     text        not null default '',  -- Prenume
  last_name      text        not null default '',  -- Nume
  cnp            text        not null default '',  -- Cod Numeric Personal (13 digits)
  sex            text        not null default '',  -- Sex (M/F)
  birthdate      text        not null default '',  -- Data nașterii, yyyy-mm-dd
  place_of_birth text        not null default '',  -- Loc naștere
  nationality    text        not null default '',  -- Cetățenie
  country        text        not null default '',  -- ESC Drupal <option> code, e.g. "RO"
  address        text        not null default '',  -- Domiciliu
  series         text        not null default '',  -- Seria (e.g. "RX")
  doc_number     text        not null default '',  -- Număr (e.g. "123456")
  issued_by      text        not null default '',  -- Emisă de (SPCLEP …)
  issue_date     text        not null default '',  -- Data eliberării, yyyy-mm-dd
  expiry_date    text        not null default '',  -- Valabilitate, yyyy-mm-dd
  preferences    jsonb       not null default '{}'::jsonb,  -- light, non-sensitive likes (e.g. {"climate":"warm"})
  updated_at     timestamptz not null default now()
);

-- Migration for projects that created `profiles` before the Romanian-ID fields existed.
-- Safe to run repeatedly; adds any missing column without touching existing data.
alter table public.profiles add column if not exists first_name     text not null default '';
alter table public.profiles add column if not exists last_name      text not null default '';
alter table public.profiles add column if not exists cnp            text not null default '';
alter table public.profiles add column if not exists sex            text not null default '';
alter table public.profiles add column if not exists place_of_birth text not null default '';
alter table public.profiles add column if not exists address        text not null default '';
alter table public.profiles add column if not exists series         text not null default '';
alter table public.profiles add column if not exists doc_number     text not null default '';
alter table public.profiles add column if not exists issued_by      text not null default '';
alter table public.profiles add column if not exists issue_date     text not null default '';
alter table public.profiles add column if not exists expiry_date    text not null default '';
-- Light, non-sensitive user preferences (separate privacy class from the ID fields above).
alter table public.profiles add column if not exists preferences    jsonb not null default '{}'::jsonb;

alter table public.profiles enable row level security;

-- Each signed-in user may read/write ONLY their own row.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = user_id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = user_id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Keep updated_at fresh on every write.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();
