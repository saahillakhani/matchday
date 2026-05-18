-- ============================================================
-- Migration: 0004 — Submissions (Save vs Submit)
-- Date: 2026-05-18
--
-- Adds a per-(league, user, gameweek) submission record. Predictions
-- can now be SAVED as a private draft (rows in `predictions`, no
-- submission row) or SUBMITTED (a row here), which:
--   - reveals the picks to players below the user in the rotation
--   - moves the "on the clock" marker to the next un-submitted player
--   - locks the user's picks for that gameweek
--
-- `auto` flags rows the cron created at kickoff for players who had
-- draft picks but never pressed Submit.
--
-- Scoring is unaffected — every saved prediction still scores. This
-- table only governs the open-gameweek visibility + rotation + lock.
--
-- Apply: paste into Supabase SQL editor and Run.
-- ============================================================

create table if not exists submissions (
  id           uuid primary key default gen_random_uuid(),
  league_id    uuid references leagues(id) on delete cascade,
  user_id      uuid references profiles(id) on delete cascade,
  gw           int not null,
  submitted_at timestamptz not null default now(),
  auto         boolean not null default false,
  unique (league_id, user_id, gw)
);

create index if not exists submissions_league_gw_idx
  on submissions(league_id, gw);

alter table submissions enable row level security;

-- Members can see all submissions in their league (needed for the
-- rotation marker + the everyone-picks visibility filter).
create policy "submissions_read" on submissions for select
  using (league_id in (select public.user_league_ids()));

-- A user can submit only their own picks.
create policy "submissions_insert" on submissions for insert
  with check (user_id = auth.uid());

-- Only the league creator can delete submissions (the admin "unlock
-- gameweek" action). The cron auto-submit uses the service role, which
-- bypasses RLS entirely.
create policy "submissions_delete" on submissions for delete
  using (
    exists (
      select 1 from leagues
      where leagues.id = submissions.league_id
      and   leagues.created_by = auth.uid()
    )
  );

-- Realtime so the rotation marker updates live as people submit.
alter publication supabase_realtime add table submissions;
