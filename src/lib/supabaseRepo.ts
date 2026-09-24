import type { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";
import type {
  AppState,
  Dream4Pick,
  League,
  Match,
  MatchResult,
  MatchStatus,
  Player,
  Prediction,
  RoundConfig,
  SetScore,
  TablePrediction,
  Team,
  User,
} from "./types";

/**
 * Maps Supabase rows (see supabase/schema.sql) onto the app's existing
 * types, and holds every read/write call the app makes against the real
 * backend. src/lib/scoring.ts keeps computing points client-side from these
 * raw rows exactly as it does for the mock data — the DB's own
 * `points_earned` columns (written by the admin_* RPCs) are never read here,
 * only kept in sync server-side for any other consumer of the database.
 */

function requireClient() {
  if (!supabase) throw new Error("Supabase client is not configured");
  return supabase;
}

/** Renders a PostgrestError (or anything else a call can throw) as one readable line. */
function describeError(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as Partial<PostgrestError> & { message?: string };
    if (e.message) {
      const parts = [e.message];
      if (e.code) parts.push(`code: ${e.code}`);
      if (e.details) parts.push(`details: ${e.details}`);
      if (e.hint) parts.push(`hint: ${e.hint}`);
      return parts.join(" | ");
    }
  }
  return String(err);
}

/** Logs the exact Supabase error (not a generic message) and returns it for re-throwing. */
function logAndReturn(label: string, error: unknown): unknown {
  console.error(`[futevolei] Supabase error in ${label}: ${describeError(error)}`, error);
  return error;
}

function colorFromId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  return hslToHex(hue, 65, 55);
}

function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) =>
    light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (n: number) =>
    Math.round(f(n) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(0)}${toHex(8)}${toHex(4)}`;
}

function mapDbStatus(status: string): MatchStatus {
  if (status === "finished") return "finished";
  if (status === "live") return "locked";
  return "upcoming";
}

function mapMatchRow(m: {
  id: string;
  round_number: number;
  team_a_id: string;
  team_b_id: string;
  score_a: number | null;
  score_b: number | null;
  mvp_id: string | null;
  status: string;
  created_at: string;
}): Match {
  const result: MatchResult | undefined =
    m.score_a !== null && m.score_b !== null
      ? { set: { a: m.score_a, b: m.score_b }, mvpPlayerId: m.mvp_id ?? "" }
      : undefined;
  return {
    id: m.id,
    round: m.round_number,
    teamAId: m.team_a_id,
    teamBId: m.team_b_id,
    // No dedicated scheduling column on the live table — created_at is the
    // best available timestamp for the client's own countdown/lock display.
    // Real enforcement of the lock is server-side and status-based (see
    // is_round_locked() and the match_predictions RLS policies in schema.sql).
    startTime: m.created_at,
    status: mapDbStatus(m.status),
    result,
  };
}

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

/** Signs the visitor in anonymously if there's no session yet, returning the auth user id. */
export async function ensureSession(): Promise<string> {
  const client = requireClient();
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw logAndReturn("auth.getSession", sessionError);

  let userId = sessionData.session?.user?.id;
  if (!userId) {
    const { data, error } = await client.auth.signInAnonymously();
    if (error) throw logAndReturn("auth.signInAnonymously", error);
    userId = data.user?.id;
  }
  if (!userId) throw new Error("Could not establish a Supabase session");
  return userId;
}

/**
 * The handle_new_user trigger should have created this already; upsert
 * defensively. Returns the profile's current display name, if any — used to
 * decide whether the first-visit "what's your name?" prompt is needed.
 */
export async function ensureProfile(userId: string): Promise<string | null> {
  const client = requireClient();
  const { data, error } = await client
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw logAndReturn("profiles select (ensureProfile)", error);
  if (data) return data.full_name;

  const { error: insertError } = await client.from("profiles").insert({ id: userId });
  // Ignore a conflict raced against the auth trigger; surface anything else.
  if (insertError && insertError.code !== "23505") {
    throw logAndReturn("profiles insert (ensureProfile)", insertError);
  }
  return null;
}

export async function updateDisplayName(userId: string, name: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.from("profiles").update({ full_name: name }).eq("id", userId);
  if (error) throw logAndReturn("profiles update (updateDisplayName)", error);
}

// ---------------------------------------------------------------------------
// Full state load
// ---------------------------------------------------------------------------

export async function fetchAppState(currentUserId: string): Promise<AppState> {
  await ensureProfile(currentUserId);

  const client = requireClient();
  const results = await Promise.all([
    client.from("profiles").select("*"),
    client.from("teams").select("*").order("name"),
    client.from("players").select("*").order("name"),
    client.from("matches").select("*").order("round_number").order("id"),
    client.from("match_predictions").select("*"),
    client.from("fantasy_picks").select("*"),
    client.from("season_table_predictions").select("*"),
    client.from("private_leagues").select("*"),
    client.from("league_memberships").select("*"),
    client.from("round_config").select("*").order("round_number"),
    client.from("season_settings").select("*").eq("id", true).maybeSingle(),
  ] as const);

  const labels = [
    "profiles select",
    "teams select",
    "players select",
    "matches select",
    "match_predictions select",
    "fantasy_picks select",
    "season_table_predictions select",
    "private_leagues select",
    "league_memberships select",
    "round_config select",
    "season_settings select",
  ];

  results.forEach((r, i) => {
    if (r.error) logAndReturn(labels[i], r.error);
  });
  const firstFailure = results.find((r) => r.error);
  if (firstFailure?.error) throw firstFailure.error;

  const [
    { data: profileRows },
    { data: teamRows },
    { data: playerRows },
    { data: matchRows },
    { data: predictionRows },
    { data: fantasyRows },
    { data: tableRows },
    { data: leagueRows },
    { data: membershipRows },
    { data: roundConfigRows },
    { data: seasonSettingsRow },
  ] = results;

  const users: User[] = (profileRows ?? []).map((p) => ({
    id: p.id,
    name: p.full_name || (p.email ? p.email.split("@")[0] : "אורח"),
    avatarColor: colorFromId(p.id),
    isAdmin: p.role === "admin",
  }));

  const teams: Team[] = (teamRows ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    shortName: t.short_name,
    color: t.color,
    emoji: t.emoji ?? "🏐",
  }));

  const players: Player[] = (playerRows ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    teamId: p.team_id,
    number: p.jersey_number ?? 0,
  }));

  const matches: Match[] = (matchRows ?? []).map(mapMatchRow);

  const predictions: Prediction[] = (predictionRows ?? []).map((p) => ({
    id: p.id,
    userId: p.user_id,
    matchId: p.match_id,
    winnerTeamId: p.predicted_winner_id,
    set: { a: p.pred_score_a, b: p.pred_score_b },
  }));

  const dream4Picks: Dream4Pick[] = (fantasyRows ?? []).map((f) => ({
    id: f.id,
    userId: f.user_id,
    round: f.round_number,
    playerIds: f.player_ids,
    captainId: f.captain_id,
  }));

  const tablePredictions: TablePrediction[] = (tableRows ?? []).map((t) => ({
    id: t.id,
    userId: t.user_id,
    order: t.predicted_order,
  }));

  const leagues: League[] = (leagueRows ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    code: l.code,
    ownerId: l.owner_id,
    memberIds: (membershipRows ?? [])
      .filter((m) => m.league_id === l.id)
      .map((m) => m.user_id),
    createdAt: l.created_at,
  }));

  const roundConfigs: RoundConfig[] = (roundConfigRows ?? []).map((r) => ({
    round: r.round_number,
    date: r.round_date,
    predictionsDeadline: r.predictions_deadline,
    fantasyDeadline: r.fantasy_deadline,
  }));

  const seasonTableDeadline = seasonSettingsRow?.table_predictions_deadline ?? "";

  return {
    currentUserId,
    users,
    teams,
    players,
    matches,
    predictions,
    dream4Picks,
    tablePredictions,
    leagues,
    roundConfigs,
    seasonTableDeadline,
  };
}

export async function fetchMatches(): Promise<Match[]> {
  const client = requireClient();
  const { data, error } = await client
    .from("matches")
    .select("*")
    .order("round_number")
    .order("id");
  if (error) throw logAndReturn("matches select (fetchMatches)", error);
  return (data ?? []).map(mapMatchRow);
}

export async function fetchLeagues(): Promise<League[]> {
  const client = requireClient();
  const [{ data: leagueRows, error: leagueErr }, { data: membershipRows, error: membershipErr }] =
    await Promise.all([
      client.from("private_leagues").select("*"),
      client.from("league_memberships").select("*"),
    ]);
  if (leagueErr) throw logAndReturn("private_leagues select (fetchLeagues)", leagueErr);
  if (membershipErr) throw logAndReturn("league_memberships select (fetchLeagues)", membershipErr);

  return (leagueRows ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    code: l.code,
    ownerId: l.owner_id,
    memberIds: (membershipRows ?? [])
      .filter((m) => m.league_id === l.id)
      .map((m) => m.user_id),
    createdAt: l.created_at,
  }));
}

// ---------------------------------------------------------------------------
// User writes
// ---------------------------------------------------------------------------

export async function submitPrediction(
  userId: string,
  matchId: string,
  winnerTeamId: string,
  set: SetScore
): Promise<void> {
  const client = requireClient();
  const { error } = await client.from("match_predictions").upsert(
    {
      user_id: userId,
      match_id: matchId,
      predicted_winner_id: winnerTeamId,
      pred_score_a: set.a,
      pred_score_b: set.b,
    },
    { onConflict: "user_id,match_id" }
  );
  if (error) throw logAndReturn("match_predictions upsert (submitPrediction)", error);
}

export async function submitDream4(
  userId: string,
  round: number,
  playerIds: string[],
  captainId: string
): Promise<void> {
  const client = requireClient();
  const { error } = await client.from("fantasy_picks").upsert(
    {
      user_id: userId,
      round_number: round,
      player_ids: playerIds,
      captain_id: captainId,
    },
    { onConflict: "user_id,round_number" }
  );
  if (error) throw logAndReturn("fantasy_picks upsert (submitDream4)", error);
}

export async function submitTablePrediction(userId: string, order: string[]): Promise<void> {
  const client = requireClient();
  const { error } = await client
    .from("season_table_predictions")
    .upsert({ user_id: userId, predicted_order: order }, { onConflict: "user_id" });
  if (error) throw logAndReturn("season_table_predictions upsert (submitTablePrediction)", error);
}

export async function createLeague(name: string, ownerId: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.from("private_leagues").insert({ name, owner_id: ownerId });
  if (error) throw logAndReturn("private_leagues insert (createLeague)", error);
}

export async function joinLeagueByCode(code: string): Promise<boolean> {
  const client = requireClient();
  const { error } = await client.rpc("join_league_by_code", { p_code: code });
  if (error) {
    logAndReturn("join_league_by_code rpc", error);
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Admin writes
// ---------------------------------------------------------------------------

export async function adminSetResult(matchId: string, result: MatchResult): Promise<void> {
  const client = requireClient();
  const { error } = await client.rpc("admin_set_match_result", {
    p_match_id: matchId,
    p_score_a: result.set.a,
    p_score_b: result.set.b,
    p_mvp_id: result.mvpPlayerId || null,
  });
  if (error) throw logAndReturn("admin_set_match_result rpc", error);
}

export async function adminResetResult(matchId: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.rpc("admin_reset_match_result", { p_match_id: matchId });
  if (error) throw logAndReturn("admin_reset_match_result rpc", error);
}

export async function adminSimulateRound(round: number): Promise<void> {
  const client = requireClient();
  const { error } = await client.rpc("admin_simulate_round", { p_round: round });
  if (error) throw logAndReturn("admin_simulate_round rpc", error);
}

export async function fetchRoundConfigs(): Promise<RoundConfig[]> {
  const client = requireClient();
  const { data, error } = await client.from("round_config").select("*").order("round_number");
  if (error) throw logAndReturn("round_config select (fetchRoundConfigs)", error);
  return (data ?? []).map((r) => ({
    round: r.round_number,
    date: r.round_date,
    predictionsDeadline: r.predictions_deadline,
    fantasyDeadline: r.fantasy_deadline,
  }));
}

export async function updateRoundConfig(config: RoundConfig): Promise<void> {
  const client = requireClient();
  const { error } = await client.from("round_config").upsert(
    {
      round_number: config.round,
      round_date: config.date,
      predictions_deadline: config.predictionsDeadline,
      fantasy_deadline: config.fantasyDeadline,
    },
    { onConflict: "round_number" }
  );
  if (error) throw logAndReturn("round_config upsert (updateRoundConfig)", error);
}

export async function updateSeasonTableDeadline(deadline: string): Promise<void> {
  const client = requireClient();
  const { error } = await client
    .from("season_settings")
    .upsert({ id: true, table_predictions_deadline: deadline }, { onConflict: "id" });
  if (error) throw logAndReturn("season_settings upsert (updateSeasonTableDeadline)", error);
}

export async function createTeam(
  name: string,
  color: string,
  emoji: string,
  playerNames: [string, string, string]
): Promise<void> {
  const client = requireClient();
  const { data: team, error: teamError } = await client
    .from("teams")
    .insert({ name, short_name: name.slice(0, 10), color, emoji })
    .select()
    .single();
  if (teamError) throw logAndReturn("teams insert (createTeam)", teamError);

  const { error: playersError } = await client.from("players").insert(
    playerNames.map((playerName, i) => ({
      team_id: team.id,
      name: playerName,
      jersey_number: i + 1,
    }))
  );
  if (playersError) throw logAndReturn("players insert (createTeam)", playersError);
}

export async function updateTeam(
  teamId: string,
  name: string,
  color: string,
  emoji: string,
  players: { id: string; name: string }[]
): Promise<void> {
  const client = requireClient();
  const { error: teamError } = await client
    .from("teams")
    .update({ name, short_name: name.slice(0, 10), color, emoji })
    .eq("id", teamId);
  if (teamError) throw logAndReturn("teams update (updateTeam)", teamError);

  await Promise.all(
    players.map(async (p) => {
      const { error } = await client.from("players").update({ name: p.name }).eq("id", p.id);
      if (error) throw logAndReturn("players update (updateTeam)", error);
    })
  );
}

export async function deleteTeam(teamId: string): Promise<void> {
  const client = requireClient();

  // matches.team_a_id/team_b_id have no cascade, so remove this team's
  // matches first (which cascades their match_predictions) before the team.
  const { error: matchesError } = await client
    .from("matches")
    .delete()
    .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`);
  if (matchesError) throw logAndReturn("matches delete (deleteTeam)", matchesError);

  const { error } = await client.from("teams").delete().eq("id", teamId);
  if (error) throw logAndReturn("teams delete (deleteTeam)", error);
}

/** Wipes teams, players, matches, and every prediction/pick that depends on
 * them — for rebuilding a tournament's roster and schedule from scratch. */
export async function resetTournamentData(): Promise<void> {
  const client = requireClient();
  const tables = [
    "match_predictions",
    "fantasy_picks",
    "season_table_predictions",
    "matches",
    "players",
    "teams",
  ] as const;
  for (const table of tables) {
    const { error } = await client.from(table).delete().not("id", "is", null);
    if (error) throw logAndReturn(`${table} delete (resetTournamentData)`, error);
  }
}

export async function createMatch(round: number, teamAId: string, teamBId: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.from("matches").insert({
    round_number: round,
    team_a_id: teamAId,
    team_b_id: teamBId,
    status: "scheduled",
  });
  if (error) throw logAndReturn("matches insert (createMatch)", error);
}

export async function fetchTeamsAndPlayers(): Promise<{ teams: Team[]; players: Player[] }> {
  const client = requireClient();
  const [{ data: teamRows, error: teamErr }, { data: playerRows, error: playerErr }] =
    await Promise.all([
      client.from("teams").select("*").order("name"),
      client.from("players").select("*").order("name"),
    ]);
  if (teamErr) throw logAndReturn("teams select (fetchTeamsAndPlayers)", teamErr);
  if (playerErr) throw logAndReturn("players select (fetchTeamsAndPlayers)", playerErr);

  const teams: Team[] = (teamRows ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    shortName: t.short_name,
    color: t.color,
    emoji: t.emoji ?? "🏐",
  }));
  const players: Player[] = (playerRows ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    teamId: p.team_id,
    number: p.jersey_number ?? 0,
  }));
  return { teams, players };
}
