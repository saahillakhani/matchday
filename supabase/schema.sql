-- ============================================================
-- The Matchday — Schema v2
-- Run in the Supabase SQL editor of the new project
-- (https://supabase.com/dashboard/project/cfyedpuubtqjxjupnpht).
-- This is a fresh project — no existing tables to drop.
-- ============================================================


-- ── 1. Profiles ───────────────────────────────────────────────
-- One row per Supabase Auth user. Created automatically on sign-up
-- via a trigger (see bottom of file). Supabase Auth handles
-- password hashing, sessions, OAuth (Apple / Google).

create table profiles (
  id           uuid primary key references auth.users on delete cascade,
  display_name text not null,
  created_at   timestamptz default now()
);


-- ── 2. Leagues ────────────────────────────────────────────────
-- A league is a private group. It has a short human-readable
-- join code (e.g. "friends5") and stores the 6 chosen teams
-- plus the rotation order once the season is locked in.

create table leagues (
  id             uuid primary key default gen_random_uuid(),
  code           text unique not null,          -- join code shared with friends
  name           text not null,
  created_by     uuid references profiles(id) on delete set null,
  season         int not null default 2025,
  selected_teams text[] not null default '{}',  -- 6 team names, set at season start
  base_order     uuid[] not null default '{}',  -- ordered array of user IDs (rotation)
  current_gw     int not null default 1,
  locked         boolean not null default false, -- true once season has started
  created_at     timestamptz default now()
);

-- Index for fast join-code lookups
create index leagues_code_idx on leagues(code);


-- ── 3. League Members ─────────────────────────────────────────
-- Replaces the old "players" table. Links a user to a league.
-- One user can be in multiple leagues.

create table league_members (
  id          uuid primary key default gen_random_uuid(),
  league_id   uuid references leagues(id) on delete cascade,
  user_id     uuid references profiles(id) on delete cascade,
  joined_at   timestamptz default now(),
  unique (league_id, user_id)
);

create index league_members_league_idx on league_members(league_id);
create index league_members_user_idx   on league_members(user_id);


-- ── 4. Predictions ────────────────────────────────────────────
-- One row per user / league / gameweek / match.
-- Locked once the GW's first kickoff passes (enforced in app layer).

create table predictions (
  id          uuid primary key default gen_random_uuid(),
  league_id   uuid references leagues(id) on delete cascade,
  user_id     uuid references profiles(id) on delete cascade,
  gw          int not null,
  match_index int not null,                     -- 0-based index matching fixture order
  home_score  int,
  away_score  int,
  submitted_at timestamptz default now(),
  unique (league_id, user_id, gw, match_index)
);

create index predictions_league_gw_idx on predictions(league_id, gw);


-- ── 5. Results ────────────────────────────────────────────────
-- Official scores per league / GW / match.
-- Written by the cron sync job (service role only).

create table results (
  id          uuid primary key default gen_random_uuid(),
  league_id   uuid references leagues(id) on delete cascade,
  gw          int not null,
  match_index int not null,
  home_score  int,
  away_score  int,
  updated_at  timestamptz default now(),
  unique (league_id, gw, match_index)
);

create index results_league_gw_idx on results(league_id, gw);


-- ── 6. Row Level Security ─────────────────────────────────────

alter table profiles       enable row level security;
alter table leagues         enable row level security;
alter table league_members  enable row level security;
alter table predictions     enable row level security;
alter table results         enable row level security;


-- profiles: anyone authenticated can read; users update only their own
create policy "profiles_read"   on profiles for select using (auth.role() = 'authenticated');
create policy "profiles_update" on profiles for update using (auth.uid() = id);

-- leagues: members can read their own leagues; authenticated users can create
create policy "leagues_read"   on leagues for select using (
  exists (
    select 1 from league_members
    where league_members.league_id = leagues.id
    and   league_members.user_id   = auth.uid()
  )
);
create policy "leagues_insert" on leagues for insert with check (auth.role() = 'authenticated');
create policy "leagues_update" on leagues for update using (created_by = auth.uid());

-- league_members: members can see who's in their league; users can join (insert themselves)
create policy "members_read"   on league_members for select using (
  exists (
    select 1 from league_members lm
    where lm.league_id = league_members.league_id
    and   lm.user_id   = auth.uid()
  )
);
create policy "members_insert" on league_members for insert
  with check (user_id = auth.uid());
create policy "members_delete" on league_members for delete
  using (user_id = auth.uid()); -- users can leave a league

-- predictions: users can only write their own; read handled in app layer
-- (rotation-based visibility is too complex for RLS — enforced in API routes)
create policy "predictions_read" on predictions for select using (
  exists (
    select 1 from league_members
    where league_members.league_id = predictions.league_id
    and   league_members.user_id   = auth.uid()
  )
);
create policy "predictions_insert" on predictions for insert
  with check (user_id = auth.uid());
create policy "predictions_update" on predictions for update
  using (user_id = auth.uid());

-- results: all league members can read; only service role can write (cron)
create policy "results_read" on results for select using (
  exists (
    select 1 from league_members
    where league_members.league_id = results.league_id
    and   league_members.user_id   = auth.uid()
  )
);


-- ── 7. Realtime ───────────────────────────────────────────────
-- Subscribe to predictions + results so the UI updates live.

alter publication supabase_realtime add table predictions;
alter publication supabase_realtime add table results;
alter publication supabase_realtime add table league_members;


-- ── 8. Auto-create profile on sign-up ─────────────────────────
-- Trigger fires whenever a new user is created in auth.users.
-- Pulls display_name from the metadata set during sign-up.

create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();


-- ── Notes ─────────────────────────────────────────────────────
--
-- ROTATION LOGIC (app layer, not DB):
--   For GW n, the picker order is base_order rotated left by (n-1) positions.
--   e.g. base_order = [A, B, C, D, E]
--        GW 1 → [A, B, C, D, E]   (A picks first, no info)
--        GW 2 → [B, C, D, E, A]   (B picks first)
--        GW 3 → [C, D, E, A, B]   (C picks first)
--
-- PREDICTION VISIBILITY (app layer):
--   Within an open GW, user X can see predictions submitted by users
--   who appear before X in that week's rotation order.
--   Once the GW is locked (first kickoff passed), all predictions visible.
--
-- AUTO-LOCKING (cron job):
--   When the cron detects the first fixture of current_gw has kicked off:
--   1. If base_order = '{}', randomise current league_members and write it.
--   2. Set locked = true. No new members can join after this.
--   3. Increment current_gw.
--   This means a league created in GW 2 can accept members freely until
--   the first GW 2 fixture kicks off, then locks automatically.
--   GW 1 is simply skipped — that's fine and expected behaviour.
--
-- JOINING A LEAGUE:
--   Users can join (insert into league_members) only while locked = false.
--   Enforced in the API layer when processing join requests.
--
-- SELECTED TEAMS:
--   Stored as team name strings matching FPL bootstrap team names.
--   e.g. ['Arsenal', 'Chelsea', 'Liverpool', 'Manchester City',
--          'Manchester United', 'Tottenham Hotspur']
--   The fixtures API filters by these names when fetching a GW's matches.
--   Selected at league creation — cannot be changed after locked = true.
