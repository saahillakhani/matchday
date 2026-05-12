-- ============================================================
-- Migration: 0003 — Public RPC for joining a league by code
-- Date: 2026-05-12
--
-- Context
--   The /join?code=… page needs to display the league's name before the
--   visitor confirms joining. But the leagues_read RLS policy only lets
--   members or creators read the leagues table — a brand-new joiner
--   can't see what they're about to join.
--
-- Fix
--   A SECURITY DEFINER function that takes a code and returns only the
--   league's id, name, and locked flag. It bypasses RLS so anyone can
--   call it, but exposes only the bare minimum needed to confirm a join
--   — no members, no team list, no created_by. Granted to anon + auth.
-- ============================================================

create or replace function public.get_league_by_code(p_code text)
returns table (id uuid, name text, locked boolean)
language sql
stable
security definer
set search_path = public
as $$
  select l.id, l.name, l.locked from public.leagues l where l.code = p_code limit 1;
$$;

revoke all on function public.get_league_by_code(text) from public;
grant execute on function public.get_league_by_code(text) to anon, authenticated;
