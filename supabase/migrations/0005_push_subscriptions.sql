-- ============================================================
-- Migration: 0005 — Push subscriptions (web push notifications)
-- Date: 2026-05-19
--
-- One row per browser/device a user has enabled notifications on.
-- A user can have several (phone, laptop). The endpoint is the
-- browser's push service URL and is globally unique. p256dh + auth
-- are the encryption keys the server needs to send a push.
--
-- Notifications are sent server-side with the service role, which
-- bypasses RLS. The policies below only let a signed-in user manage
-- their own device rows from the app.
--
-- Apply: paste into Supabase SQL editor and Run.
-- ============================================================

create table if not exists push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx
  on push_subscriptions(user_id);

alter table push_subscriptions enable row level security;

-- A user can only see, add, and remove their own device rows.
create policy "push_subs_read" on push_subscriptions for select
  using (user_id = auth.uid());

create policy "push_subs_insert" on push_subscriptions for insert
  with check (user_id = auth.uid());

create policy "push_subs_delete" on push_subscriptions for delete
  using (user_id = auth.uid());
