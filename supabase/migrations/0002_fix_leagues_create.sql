-- ============================================================
-- Migration: 0002 — Fix league create flow under RLS
-- Date: 2026-05-12
--
-- Problem 1
--   leagues_insert relies on auth.role() = 'authenticated', which does
--   not reliably return 'authenticated' for cookie-auth sessions in the
--   current Supabase Postgres version. INSERTs from /api/league/create
--   were rejected with "new row violates row-level security policy".
--
-- Problem 2
--   Even with a corrected INSERT, the supabase-js .insert().select()
--   round-trip evaluates leagues_read against the newly-inserted row.
--   At that moment the creator is not yet in league_members for the
--   league (their membership is inserted in a separate call right
--   after), so the SELECT returns nothing or errors.
--
-- Fix
--   1. Tighten leagues_insert to require created_by = auth.uid(). This
--      both replaces the unreliable role check and prevents users from
--      creating leagues attributed to someone else.
--   2. Broaden leagues_read so creators can always see their own
--      leagues, regardless of league_members state. Semantically
--      correct anyway — you can read what you made.
--
-- Apply
--   Paste this file into Supabase SQL editor and Run.
-- ============================================================

drop policy if exists "leagues_insert" on public.leagues;
create policy "leagues_insert" on public.leagues for insert
  with check (created_by = auth.uid());

drop policy if exists "leagues_read" on public.leagues;
create policy "leagues_read" on public.leagues for select
  using (
    id in (select public.user_league_ids())
    or created_by = auth.uid()
  );
