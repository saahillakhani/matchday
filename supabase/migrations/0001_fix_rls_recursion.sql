-- ============================================================
-- Migration: 0001 — Fix RLS recursion on league_members
-- Date: 2026-05-12
--
-- Problem
--   The original members_read policy on league_members reads from
--   league_members inside its USING clause. That self-reference triggers
--   the same policy on the inner read, which recurses indefinitely.
--   Postgres raises "infinite recursion detected in policy for relation
--   league_members" on any read that touches this table.
--
-- Fix
--   Introduce a SECURITY DEFINER helper function that returns the league
--   IDs the current user belongs to without going through RLS. Rewrite
--   the relevant SELECT policies to use it.
--
-- Apply
--   Paste this file into Supabase SQL editor and Run.
-- ============================================================


-- Helper: league IDs the current user is a member of.
-- SECURITY DEFINER runs as the function owner, bypassing RLS so it can
-- read league_members directly. It only ever returns rows for the
-- authenticated caller (auth.uid()) so it cannot leak peer data.
create or replace function public.user_league_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select league_id from public.league_members where user_id = auth.uid();
$$;

revoke all on function public.user_league_ids() from public;
grant execute on function public.user_league_ids() to authenticated;


-- Rewrite the recursing policy.
drop policy if exists "members_read" on public.league_members;
create policy "members_read" on public.league_members for select
  using (league_id in (select public.user_league_ids()));


-- Rewrite the other policies that join through league_members for
-- consistency. They don't strictly recurse (since they read from a
-- different base table) but they all evaluate the inner league_members
-- query under RLS, which was the actual recursion entry point in the
-- create-league flow.
drop policy if exists "leagues_read" on public.leagues;
create policy "leagues_read" on public.leagues for select
  using (id in (select public.user_league_ids()));

drop policy if exists "predictions_read" on public.predictions;
create policy "predictions_read" on public.predictions for select
  using (league_id in (select public.user_league_ids()));

drop policy if exists "results_read" on public.results;
create policy "results_read" on public.results for select
  using (league_id in (select public.user_league_ids()));
