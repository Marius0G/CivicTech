-- EU Youth Buddy — Supabase setup for real per-user accounts.
--
-- Run ONCE in the Supabase SQL editor (Dashboard → SQL Editor → New query → paste → Run).
-- It creates the per-user `profiles` table that the backend reads/writes (keyed to auth.users).
--
-- The backend talks to this table with the SERVICE ROLE key and therefore bypasses RLS, but we
-- still enable Row Level Security with own-row policies so the table is also safe to read/write
-- directly from the client (anon key) if you ever want to.

create table if not exists public.profiles (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  name        text        not null default '',
  country     text        not null default '',  -- ESC Drupal <option> code, e.g. "RO"
  birthdate   text        not null default '',  -- yyyy-mm-dd
  nationality text        not null default '',
  updated_at  timestamptz not null default now()
);

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
