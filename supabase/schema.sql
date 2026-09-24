-- Footvolley app — production database schema for Supabase (Postgres).
--
-- Run via `supabase db push`, the Supabase SQL editor, or as a migration.
-- Requires Postgres 13+ (gen_random_uuid() is built-in, no pgcrypto needed).
--
-- The app currently runs entirely on local mock state (src/context/AppContext.tsx,
-- src/lib/mockData.ts). This schema is the target shape for when that mock layer
-- is swapped for real Supabase calls — nothing in the app queries these tables yet.
--
-- Scoring rules mirrored here from src/lib/scoring.ts:
--   predictions: +3 correct winner, +6 exact score, +1 point-differential bonus
--   fantasy:     +4 team win, +2 blowout win (diff > 6), +5 match MVP, x2 for captain
--   table:       +5 per team predicted in its exact final regular-season slot

-- =========================================================================
-- Helpers
-- =========================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================================================================
-- profiles (1:1 with auth.users)
-- =========================================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Nullable: the app signs visitors in via Supabase Anonymous Auth
  -- (see src/lib/supabaseRepo.ts), and anonymous auth users have no email.
  -- A unique constraint still allows multiple NULLs in Postgres.
  email text unique,
  full_name text,
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- Auto-create a profile row whenever a new Supabase auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Regular users can update their own profile, but never grant themselves 'admin'.
create or replace function public.prevent_role_self_escalation()
returns trigger
language plpgsql
as $$
begin
  if new.role <> old.role and not public.is_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$$;

create trigger profiles_block_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_self_escalation();

-- =========================================================================
-- teams & players
-- =========================================================================

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text not null,
  color text not null default '#F59E0B',
  emoji text,
  sort_order int not null default 0
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  name text not null,
  jersey_number int
);

create index players_team_id_idx on public.players (team_id);

-- =========================================================================
-- matches (11-round round-robin regular season)
-- =========================================================================

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  -- Named round_number (not round) for consistency with fantasy_picks.round_number.
  round_number int not null check (round_number between 1 and 11),
  team_a_id uuid not null references public.teams (id),
  team_b_id uuid not null references public.teams (id),
  score_a int check (score_a is null or score_a >= 0),
  score_b int check (score_b is null or score_b >= 0),
  mvp_id uuid references public.players (id),
  -- Locking is purely status-based (no dedicated scheduling/lock_time
  -- column): a match accepts predictions while 'scheduled' and is closed the
  -- moment an admin marks it 'live' or 'finished'. created_at is what the
  -- client uses for its own countdown/lock display (see supabaseRepo.ts).
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'finished')),
  created_at timestamptz not null default now(),
  constraint matches_teams_distinct check (team_a_id <> team_b_id),
  constraint matches_round_pair_unique unique (round_number, team_a_id, team_b_id)
);

create index matches_round_idx on public.matches (round_number);

-- =========================================================================
-- round_config & season_settings (admin-set dates/deadlines)
-- =========================================================================

create table public.round_config (
  round_number int primary key check (round_number between 1 and 11),
  round_date timestamptz not null,
  predictions_deadline timestamptz not null,
  fantasy_deadline timestamptz not null
);

-- Singleton row (id is always true) holding the one global deadline that
-- isn't per-round: when season table predictions lock.
create table public.season_settings (
  id boolean primary key default true check (id),
  table_predictions_deadline timestamptz not null
);

-- A round locks for fantasy picks once any of its matches is no longer
-- 'scheduled', OR once the admin's fantasy_deadline for that round passes.
create or replace function public.is_round_locked(p_round int)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.matches
    where round_number = p_round and status <> 'scheduled'
  )
  or exists (
    select 1 from public.round_config
    where round_number = p_round and now() >= fantasy_deadline
  );
$$;

-- Season table predictions lock once the admin's global deadline passes
-- (falling back to round 1 being locked, if no deadline has been set yet).
create or replace function public.is_season_locked()
returns boolean
language sql
stable
as $$
  select public.is_round_locked(1)
    or exists (
      select 1 from public.season_settings
      where now() >= table_predictions_deadline
    );
$$;

-- =========================================================================
-- match_predictions
-- =========================================================================
-- predicted_winner_id is kept alongside the predicted score (rather than
-- derived from pred_score_a/b) because the app lets a user's winner pick and
-- score guess disagree — the +3 / +6 / +1 scoring formula is defined against
-- both independently, matching src/lib/scoring.ts::computePredictionScore.

create table public.match_predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  match_id uuid not null references public.matches (id) on delete cascade,
  predicted_winner_id uuid not null references public.teams (id),
  pred_score_a int not null check (pred_score_a >= 0),
  pred_score_b int not null check (pred_score_b >= 0),
  points_earned int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, match_id)
);

create index match_predictions_match_id_idx on public.match_predictions (match_id);
create index match_predictions_user_id_idx on public.match_predictions (user_id);

create trigger match_predictions_set_updated_at
  before update on public.match_predictions
  for each row execute function public.set_updated_at();

-- =========================================================================
-- fantasy_picks (Dream4 + captain, one pick per user per round)
-- =========================================================================

create table public.fantasy_picks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  round_number int not null check (round_number between 1 and 11),
  player_ids uuid[] not null,
  captain_id uuid not null,
  points_earned int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, round_number),
  check (cardinality(player_ids) = 4),
  check (captain_id = any (player_ids))
);

create index fantasy_picks_round_idx on public.fantasy_picks (round_number);

create trigger fantasy_picks_set_updated_at
  before update on public.fantasy_picks
  for each row execute function public.set_updated_at();

-- Points earned by a single player for a single round, mirroring
-- src/lib/scoring.ts::computePlayerRoundPoints. Each team plays exactly one
-- match per round (round-robin), so at most one match qualifies.
create or replace function public.player_round_points(p_player_id uuid, p_round int)
returns int
language plpgsql
stable
as $$
declare
  v_team_id uuid;
  v_match record;
  v_points int := 0;
  v_diff int;
begin
  select team_id into v_team_id from public.players where id = p_player_id;
  if v_team_id is null then
    return 0;
  end if;

  select * into v_match
  from public.matches
  where round_number = p_round
    and status = 'finished'
    and (team_a_id = v_team_id or team_b_id = v_team_id)
  limit 1;

  if v_match is null then
    return 0;
  end if;

  v_diff := abs(v_match.score_a - v_match.score_b);

  if (v_match.team_a_id = v_team_id and v_match.score_a > v_match.score_b)
     or (v_match.team_b_id = v_team_id and v_match.score_b > v_match.score_a) then
    v_points := v_points + 4;
    if v_diff > 6 then
      v_points := v_points + 2;
    end if;
  end if;

  if v_match.mvp_id = p_player_id then
    v_points := v_points + 5;
  end if;

  return v_points;
end;
$$;

-- =========================================================================
-- season_table_predictions (pre-season 1st-12th order, one per user)
-- =========================================================================

create table public.season_table_predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade unique,
  predicted_order uuid[] not null,
  points_earned int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(predicted_order) = 12)
);

create trigger season_table_predictions_set_updated_at
  before update on public.season_table_predictions
  for each row execute function public.set_updated_at();

-- Live regular-season standings, derived from finished matches only.
-- 3 league points per win; ties broken by point differential, then points
-- scored, then team id — mirrors src/lib/scoring.ts::computeStandings.
create or replace view public.season_standings as
with results as (
  select team_a_id as team_id, score_a as points_for, score_b as points_against,
         (score_a > score_b) as won
  from public.matches
  where status = 'finished' and round_number <= 11
  union all
  select team_b_id as team_id, score_b as points_for, score_a as points_against,
         (score_b > score_a) as won
  from public.matches
  where status = 'finished' and round_number <= 11
),
agg as (
  select
    t.id as team_id,
    count(r.team_id) as played,
    coalesce(sum((r.won)::int), 0) as wins,
    coalesce(sum((not r.won)::int), 0) as losses,
    coalesce(sum(r.points_for), 0) as points_for,
    coalesce(sum(r.points_against), 0) as points_against,
    coalesce(sum(r.points_for), 0) - coalesce(sum(r.points_against), 0) as diff,
    coalesce(sum((r.won)::int), 0) * 3 as league_points
  from public.teams t
  left join results r on r.team_id = t.id
  group by t.id
)
select
  team_id, played, wins, losses, points_for, points_against, diff, league_points,
  row_number() over (
    order by league_points desc, diff desc, points_for desc, team_id asc
  ) as rank
from agg;

create or replace function public.recompute_table_predictions()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order uuid[];
begin
  select array_agg(team_id order by rank) into v_order from public.season_standings;

  update public.season_table_predictions stp
  set points_earned = (
    select coalesce(sum(case when stp.predicted_order[i] = v_order[i] then 5 else 0 end), 0)
    from generate_subscripts(stp.predicted_order, 1) as i
  );
end;
$$;

-- =========================================================================
-- private_leagues & league_memberships
-- =========================================================================

create or replace function public.generate_league_code()
returns text
language sql
as $$
  select upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6));
$$;

create table public.private_leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique default public.generate_league_code(),
  owner_id uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.league_memberships (
  league_id uuid not null references public.private_leagues (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (league_id, user_id)
);

create index league_memberships_user_id_idx on public.league_memberships (user_id);

-- League creators are automatically added as members.
create or replace function public.add_owner_as_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.league_memberships (league_id, user_id)
  values (new.id, new.owner_id)
  on conflict do nothing;
  return new;
end;
$$;

create trigger private_leagues_add_owner
  after insert on public.private_leagues
  for each row execute function public.add_owner_as_member();

-- Join-by-code runs as a SECURITY DEFINER RPC so members don't need broad
-- SELECT access on private_leagues just to look up a code.
create or replace function public.join_league_by_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_league_id uuid;
begin
  select id into v_league_id from public.private_leagues where upper(code) = upper(p_code);
  if v_league_id is null then
    raise exception 'League code not found';
  end if;

  insert into public.league_memberships (league_id, user_id)
  values (v_league_id, auth.uid())
  on conflict do nothing;

  return v_league_id;
end;
$$;

-- =========================================================================
-- Admin scoring entry points
-- =========================================================================
-- _apply_match_result is the shared core: writes a match's score/MVP and
-- recomputes every dependent point total in one transaction (predictions for
-- this match, fantasy picks for this round, and every season-table
-- prediction against the refreshed standings). It is NOT exposed directly —
-- only the admin-only RPCs below call it, each after its own is_admin() check.

create or replace function public._apply_match_result(
  p_match_id uuid,
  p_score_a int,
  p_score_b int,
  p_mvp_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round int;
  v_team_a uuid;
  v_team_b uuid;
  v_winner uuid;
  v_diff int;
begin
  update public.matches
  set score_a = p_score_a,
      score_b = p_score_b,
      mvp_id = p_mvp_id,
      status = 'finished'
  where id = p_match_id
  returning round_number, team_a_id, team_b_id into v_round, v_team_a, v_team_b;

  if v_round is null then
    raise exception 'Match % not found', p_match_id;
  end if;

  v_winner := case when p_score_a > p_score_b then v_team_a else v_team_b end;
  v_diff := p_score_a - p_score_b;

  update public.match_predictions mp
  set points_earned =
    (case when mp.predicted_winner_id = v_winner then 3 else 0 end)
    + (case
        when mp.pred_score_a = p_score_a and mp.pred_score_b = p_score_b then 6
        when mp.predicted_winner_id = v_winner and (mp.pred_score_a - mp.pred_score_b) = v_diff then 1
        else 0
      end)
  where mp.match_id = p_match_id;

  update public.fantasy_picks fp
  set points_earned = (
    select coalesce(sum(
      public.player_round_points(pid, fp.round_number)
      * (case when pid = fp.captain_id then 2 else 1 end)
    ), 0)
    from unnest(fp.player_ids) as pid
  )
  where fp.round_number = v_round;

  perform public.recompute_table_predictions();
end;
$$;

-- The main path the admin panel calls to save a real result.
create or replace function public.admin_set_match_result(
  p_match_id uuid,
  p_score_a int,
  p_score_b int,
  p_mvp_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can set match results';
  end if;
  perform public._apply_match_result(p_match_id, p_score_a, p_score_b, p_mvp_id);
end;
$$;

-- One-click round simulation: fills in a random result (and a random MVP
-- from either roster) for every not-yet-finished match in the round.
create or replace function public.admin_simulate_round(p_round int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m record;
  v_a_wins boolean;
  v_winner_score int;
  v_loser_score int;
  v_score_a int;
  v_score_b int;
  v_mvp uuid;
begin
  if not public.is_admin() then
    raise exception 'Only admins can simulate results';
  end if;

  for m in
    select id, team_a_id, team_b_id from public.matches
    where round_number = p_round and status <> 'finished'
  loop
    v_winner_score := 18;
    v_loser_score := 2 + floor(random() * 15)::int;
    v_a_wins := random() > 0.5;
    v_score_a := case when v_a_wins then v_winner_score else v_loser_score end;
    v_score_b := case when v_a_wins then v_loser_score else v_winner_score end;

    select id into v_mvp
    from public.players
    where team_id in (m.team_a_id, m.team_b_id)
    order by random()
    limit 1;

    perform public._apply_match_result(m.id, v_score_a, v_score_b, v_mvp);
  end loop;
end;
$$;

-- Undoes a result: clears the match back to 'scheduled' and zeroes every
-- point total that depended on it.
create or replace function public.admin_reset_match_result(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round int;
begin
  if not public.is_admin() then
    raise exception 'Only admins can reset match results';
  end if;

  update public.matches
  set score_a = null, score_b = null, mvp_id = null, status = 'scheduled'
  where id = p_match_id
  returning round_number into v_round;

  if v_round is null then
    raise exception 'Match % not found', p_match_id;
  end if;

  update public.match_predictions set points_earned = 0 where match_id = p_match_id;

  update public.fantasy_picks fp
  set points_earned = (
    select coalesce(sum(
      public.player_round_points(pid, fp.round_number)
      * (case when pid = fp.captain_id then 2 else 1 end)
    ), 0)
    from unnest(fp.player_ids) as pid
  )
  where fp.round_number = v_round;

  perform public.recompute_table_predictions();
end;
$$;

-- =========================================================================
-- Row Level Security
-- =========================================================================

alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.matches enable row level security;
alter table public.match_predictions enable row level security;
alter table public.fantasy_picks enable row level security;
alter table public.season_table_predictions enable row level security;
alter table public.private_leagues enable row level security;
alter table public.league_memberships enable row level security;
alter table public.round_config enable row level security;
alter table public.season_settings enable row level security;

-- profiles: everyone signed in can read the roster (names/avatars for
-- leaderboards); a user can only edit their own row, and never their role.
create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated using (true);

create policy "profiles_update_own" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- teams / players / matches: public read, admin-only write.
-- Match *results* should go through admin_set_match_result() so dependent
-- points recompute atomically; this policy still covers scheduling edits
-- (status) and is a defense-in-depth backstop either way.
create policy "teams_select_all" on public.teams for select to authenticated using (true);
create policy "teams_admin_write" on public.teams for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "players_select_all" on public.players for select to authenticated using (true);
create policy "players_admin_write" on public.players for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "matches_select_all" on public.matches for select to authenticated using (true);
create policy "matches_admin_write" on public.matches for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- round_config / season_settings: public read (drives client-side lock
-- countdowns for everyone), admin-only write.
create policy "round_config_select_all" on public.round_config for select to authenticated using (true);
create policy "round_config_admin_write" on public.round_config for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "season_settings_select_all" on public.season_settings for select to authenticated using (true);
create policy "season_settings_admin_write" on public.season_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- match_predictions: visible to their owner always, to everyone else only
-- once the match is finished (keeps picks private pre-kickoff). Writable by
-- the owner only while the match is still 'scheduled' (no separate time-based
-- lock — see the comment on public.matches).
create policy "match_predictions_select" on public.match_predictions
  for select to authenticated
  using (
    auth.uid() = user_id
    or exists (select 1 from public.matches m where m.id = match_id and m.status = 'finished')
  );

create policy "match_predictions_insert" on public.match_predictions
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.matches m
      where m.id = match_id
        and m.status = 'scheduled'
        and not exists (
          select 1 from public.round_config rc
          where rc.round_number = m.round_number and now() >= rc.predictions_deadline
        )
    )
  );

create policy "match_predictions_update" on public.match_predictions
  for update to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.matches m
      where m.id = match_id
        and m.status = 'scheduled'
        and not exists (
          select 1 from public.round_config rc
          where rc.round_number = m.round_number and now() >= rc.predictions_deadline
        )
    )
  );

-- points_earned is server-computed only (admin_set_match_result); block any
-- client attempt to set or alter it directly.
create or replace function public.prevent_points_tampering()
returns trigger
language plpgsql
as $$
begin
  if not public.is_admin() then
    if tg_op = 'INSERT' then
      new.points_earned := 0;
    else
      new.points_earned := old.points_earned;
    end if;
  end if;
  return new;
end;
$$;

create trigger match_predictions_block_points
  before insert or update on public.match_predictions
  for each row execute function public.prevent_points_tampering();

create trigger fantasy_picks_block_points
  before insert or update on public.fantasy_picks
  for each row execute function public.prevent_points_tampering();

create trigger table_predictions_block_points
  before insert or update on public.season_table_predictions
  for each row execute function public.prevent_points_tampering();

-- fantasy_picks: same visibility/lock shape as match_predictions, but keyed
-- off the whole round (locks the moment any match in that round starts).
create policy "fantasy_picks_select" on public.fantasy_picks
  for select to authenticated
  using (auth.uid() = user_id or public.is_round_locked(round_number));

create policy "fantasy_picks_insert" on public.fantasy_picks
  for insert to authenticated
  with check (auth.uid() = user_id and not public.is_round_locked(round_number));

create policy "fantasy_picks_update" on public.fantasy_picks
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and not public.is_round_locked(round_number));

-- season_table_predictions: locks for good once round 1 kicks off.
create policy "table_predictions_select" on public.season_table_predictions
  for select to authenticated
  using (auth.uid() = user_id or public.is_season_locked());

create policy "table_predictions_insert" on public.season_table_predictions
  for insert to authenticated
  with check (auth.uid() = user_id and not public.is_season_locked());

create policy "table_predictions_update" on public.season_table_predictions
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and not public.is_season_locked());

-- private_leagues: only members (or the owner) can see a league's row.
-- Membership itself is only ever written by add_owner_as_member() or
-- join_league_by_code(), both SECURITY DEFINER — no direct insert policy.
create policy "leagues_select_member" on public.private_leagues
  for select to authenticated
  using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.league_memberships lm
      where lm.league_id = id and lm.user_id = auth.uid()
    )
  );

create policy "leagues_insert_own" on public.private_leagues
  for insert to authenticated
  with check (owner_id = auth.uid());

create policy "leagues_update_owner" on public.private_leagues
  for update to authenticated
  using (owner_id = auth.uid());

create policy "leagues_delete_owner" on public.private_leagues
  for delete to authenticated
  using (owner_id = auth.uid());

-- league_memberships: a member can see every membership row for any league
-- they themselves belong to (so the app can render the member list).
create policy "memberships_select_co_member" on public.league_memberships
  for select to authenticated
  using (
    exists (
      select 1 from public.league_memberships self
      where self.league_id = league_memberships.league_id and self.user_id = auth.uid()
    )
  );
