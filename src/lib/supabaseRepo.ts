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

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

/** Signs the visitor in anonymously if there's no session yet, returning the auth user id. */
export async function ensureSession(): Promise<string> {
  const client = requireClient();
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw sessionError;

  let userId = sessionData.session?.user?.id;
  if (!userId) {
    const { data, error } = await client.auth.signInAnonymously();
    if (error) throw error;
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
  if (error) throw error;
  if (data) return data.full_name;

  const { error: insertError } = await client.from("profiles").insert({ id: userId });
  // Ignore a conflict raced against the auth trigger; surface anything else.
  if (insertError && insertError.code !== "23505") throw insertError;
  return null;
}

export async function updateDisplayName(userId: string, name: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.from("profiles").update({ full_name: name }).eq("id", userId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Full state load
// ---------------------------------------------------------------------------

export async function fetchAppState(currentUserId: string): Promise<AppState> {
  await ensureProfile(currentUserId);

  const client = requireClient();
  const [
    { data: profileRows, error: profileErr },
    { data: teamRows, error: teamErr },
    { data: playerRows, error: playerErr },
    { data: matchRows, error: matchErr },
    { data: predictionRows, error: predictionErr },
    { data: fantasyRows, error: fantasyErr },
    { data: tableRows, error: tableErr },
    { data: leagueRows, error: leagueErr },
    { data: membershipRows, error: membershipErr },
  ] = await Promise.all([
    client.from("profiles").select("*"),
    client.from("teams").select("*").order("sort_order"),
    client.from("players").select("*"),
    client.from("matches").select("*").order("round"),
    client.from("match_predictions").select("*"),
    client.from("fantasy_picks").select("*"),
    client.from("season_table_predictions").select("*"),
    client.from("private_leagues").select("*"),
    client.from("league_memberships").select("*"),
  ]);

  const firstError =
    profileErr || teamErr || playerErr || matchErr || predictionErr || fantasyErr || tableErr || leagueErr || membershipErr;
  if (firstError) throw firstError;

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
    position: p.position === "מגן" ? "מגן" : "חובט",
    number: p.jersey_number ?? 0,
  }));

  const matches: Match[] = (matchRows ?? []).map((m) => {
    const result: MatchResult | undefined =
      m.score_a !== null && m.score_b !== null
        ? { set: { a: m.score_a, b: m.score_b }, mvpPlayerId: m.mvp_id ?? "" }
        : undefined;
    return {
      id: m.id,
      round: m.round,
      teamAId: m.team_a_id,
      teamBId: m.team_b_id,
      startTime: m.lock_time,
      status: mapDbStatus(m.status),
      result,
    };
  });

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
  };
}

export async function fetchMatches(): Promise<Match[]> {
  const client = requireClient();
  const { data, error } = await client.from("matches").select("*").order("round");
  if (error) throw error;
  return (data ?? []).map((m) => {
    const result: MatchResult | undefined =
      m.score_a !== null && m.score_b !== null
        ? { set: { a: m.score_a, b: m.score_b }, mvpPlayerId: m.mvp_id ?? "" }
        : undefined;
    return {
      id: m.id,
      round: m.round,
      teamAId: m.team_a_id,
      teamBId: m.team_b_id,
      startTime: m.lock_time,
      status: mapDbStatus(m.status),
      result,
    };
  });
}

export async function fetchLeagues(): Promise<League[]> {
  const client = requireClient();
  const [{ data: leagueRows, error: leagueErr }, { data: membershipRows, error: membershipErr }] =
    await Promise.all([
      client.from("private_leagues").select("*"),
      client.from("league_memberships").select("*"),
    ]);
  if (leagueErr) throw leagueErr;
  if (membershipErr) throw membershipErr;

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
  if (error) throw error;
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
  if (error) throw error;
}

export async function submitTablePrediction(userId: string, order: string[]): Promise<void> {
  const client = requireClient();
  const { error } = await client
    .from("season_table_predictions")
    .upsert({ user_id: userId, predicted_order: order }, { onConflict: "user_id" });
  if (error) throw error;
}

export async function createLeague(name: string, ownerId: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.from("private_leagues").insert({ name, owner_id: ownerId });
  if (error) throw error;
}

export async function joinLeagueByCode(code: string): Promise<boolean> {
  const client = requireClient();
  const { error } = await client.rpc("join_league_by_code", { p_code: code });
  if (error) return false;
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
  if (error) throw error;
}

export async function adminResetResult(matchId: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.rpc("admin_reset_match_result", { p_match_id: matchId });
  if (error) throw error;
}

export async function adminSimulateRound(round: number): Promise<void> {
  const client = requireClient();
  const { error } = await client.rpc("admin_simulate_round", { p_round: round });
  if (error) throw error;
}
