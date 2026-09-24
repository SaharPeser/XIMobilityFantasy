import type {
  AppState,
  Dream4Pick,
  Match,
  MatchResult,
  Player,
  PlayoffZone,
  Prediction,
  SetScore,
  TeamStanding,
} from "./types";
import { REGULAR_SEASON_ROUNDS } from "./types";

export function scoresEqual(a: SetScore, b: SetScore): boolean {
  return a.a === b.a && a.b === b.b;
}

export function getMatchWinnerTeamId(match: Match, result: MatchResult): string {
  return result.set.a > result.set.b ? match.teamAId : match.teamBId;
}

export function pointDiff(set: SetScore): number {
  return set.a - set.b;
}

export interface PredictionScoreBreakdown {
  points: number;
  correctWinner: boolean;
  exactScore: boolean;
  diffBonus: boolean;
}

export function computePredictionScore(
  pred: Prediction,
  match: Match
): PredictionScoreBreakdown {
  if (!match.result) {
    return { points: 0, correctWinner: false, exactScore: false, diffBonus: false };
  }
  const actualWinnerId = getMatchWinnerTeamId(match, match.result);
  const correctWinner = pred.winnerTeamId === actualWinnerId;

  const actualDiff = pointDiff(match.result.set);
  const predDiff = pointDiff(pred.set);
  const exactScore = scoresEqual(match.result.set, pred.set);

  let points = 0;
  let diffBonus = false;
  if (correctWinner) points += 3;
  if (exactScore) {
    points += 6;
  } else if (correctWinner && actualDiff === predDiff) {
    points += 1;
    diffBonus = true;
  }

  return { points, correctWinner, exactScore, diffBonus };
}

export function predictionPointsForUser(userId: string, state: AppState): number {
  return state.predictions
    .filter((p) => p.userId === userId)
    .reduce((sum, p) => {
      const match = state.matches.find((m) => m.id === p.matchId);
      if (!match) return sum;
      return sum + computePredictionScore(p, match).points;
    }, 0);
}

export interface PlayerRoundPoints {
  win: boolean;
  blowout: boolean;
  mvp: boolean;
  total: number;
}

export function computePlayerRoundPoints(
  player: Player,
  round: number,
  state: AppState
): PlayerRoundPoints {
  const match = state.matches.find(
    (m) =>
      m.round === round &&
      (m.teamAId === player.teamId || m.teamBId === player.teamId)
  );
  if (!match || !match.result) {
    return { win: false, blowout: false, mvp: false, total: 0 };
  }

  const winnerId = getMatchWinnerTeamId(match, match.result);
  const win = winnerId === player.teamId;

  const diff = Math.abs(pointDiff(match.result.set));
  const blowout = win && diff > 6;
  const mvp = match.result.mvpPlayerId === player.id;

  let total = 0;
  if (win) total += 4;
  if (blowout) total += 2;
  if (mvp) total += 5;

  return { win, blowout, mvp, total };
}

export function computeDream4PickPoints(
  pick: Dream4Pick,
  state: AppState
): { total: number; perPlayer: Record<string, PlayerRoundPoints & { multiplied: number }> } {
  const perPlayer: Record<string, PlayerRoundPoints & { multiplied: number }> = {};
  let total = 0;
  for (const playerId of pick.playerIds) {
    const player = state.players.find((p) => p.id === playerId);
    if (!player) continue;
    const pts = computePlayerRoundPoints(player, pick.round, state);
    const isCaptain = pick.captainId === playerId;
    const multiplied = isCaptain ? pts.total * 2 : pts.total;
    perPlayer[playerId] = { ...pts, multiplied };
    total += multiplied;
  }
  return { total, perPlayer };
}

export function fantasyPointsForUser(userId: string, state: AppState): number {
  return state.dream4Picks
    .filter((p) => p.userId === userId)
    .reduce((sum, p) => sum + computeDream4PickPoints(p, state).total, 0);
}

export interface TablePredictionBreakdown {
  total: number;
  correctSlots: boolean[]; // index-aligned with the prediction order
}

export function computeTablePredictionScore(
  userId: string,
  state: AppState
): TablePredictionBreakdown {
  const pred = state.tablePredictions.find((p) => p.userId === userId);
  if (!pred) return { total: 0, correctSlots: [] };
  const standings = computeStandings(state);
  const actualOrder = standings.map((s) => s.teamId);
  const correctSlots = pred.order.map((teamId, i) => actualOrder[i] === teamId);
  const total = correctSlots.filter(Boolean).length * 5;
  return { total, correctSlots };
}

export interface UserPointsSummary {
  userId: string;
  predictionPoints: number;
  fantasyPoints: number;
  tablePoints: number;
  total: number;
}

export function computeUserTotalPoints(
  userId: string,
  state: AppState
): UserPointsSummary {
  const predictionPoints = predictionPointsForUser(userId, state);
  const fantasyPoints = fantasyPointsForUser(userId, state);
  const tablePoints = computeTablePredictionScore(userId, state).total;
  return {
    userId,
    predictionPoints,
    fantasyPoints,
    tablePoints,
    total: predictionPoints + fantasyPoints + tablePoints,
  };
}

export function computeLeaderboard(
  state: AppState,
  userIds?: string[]
): UserPointsSummary[] {
  const ids = userIds ?? state.users.map((u) => u.id);
  return ids
    .map((id) => computeUserTotalPoints(id, state))
    .sort((a, b) => b.total - a.total);
}

export function computeRoundPredictionPoints(
  userId: string,
  round: number,
  state: AppState
): number {
  const matchIds = state.matches
    .filter((m) => m.round === round)
    .map((m) => m.id);
  return state.predictions
    .filter((p) => p.userId === userId && matchIds.includes(p.matchId))
    .reduce((sum, p) => {
      const match = state.matches.find((m) => m.id === p.matchId);
      if (!match) return sum;
      return sum + computePredictionScore(p, match).points;
    }, 0);
}

export function computeRoundFantasyPoints(
  userId: string,
  round: number,
  state: AppState
): number {
  const pick = state.dream4Picks.find(
    (p) => p.userId === userId && p.round === round
  );
  if (!pick) return 0;
  return computeDream4PickPoints(pick, state).total;
}

export function computeRoundLeaderboard(
  state: AppState,
  round: number,
  userIds?: string[]
): UserPointsSummary[] {
  const ids = userIds ?? state.users.map((u) => u.id);
  return ids
    .map((id) => {
      const predictionPoints = computeRoundPredictionPoints(id, round, state);
      const fantasyPoints = computeRoundFantasyPoints(id, round, state);
      return {
        userId: id,
        predictionPoints,
        fantasyPoints,
        tablePoints: 0,
        total: predictionPoints + fantasyPoints,
      };
    })
    .sort((a, b) => b.total - a.total);
}

function zoneForRank(rank: number): PlayoffZone {
  if (rank <= 2) return "final4-direct";
  if (rank <= 6) return "final4-playin";
  if (rank <= 8) return "mid";
  if (rank <= 10) return "relegation-playoff";
  return "relegation-direct";
}

export function computeStandings(state: AppState): TeamStanding[] {
  const table = new Map<string, TeamStanding>();
  for (const team of state.teams) {
    table.set(team.id, {
      teamId: team.id,
      played: 0,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      diff: 0,
      leaguePoints: 0,
      rank: 0,
      zone: "mid",
    });
  }

  for (const match of state.matches) {
    if (match.round > REGULAR_SEASON_ROUNDS || !match.result) continue;
    const a = table.get(match.teamAId);
    const b = table.get(match.teamBId);
    if (!a || !b) continue;
    const { a: scoreA, b: scoreB } = match.result.set;
    a.played += 1;
    b.played += 1;
    a.pointsFor += scoreA;
    a.pointsAgainst += scoreB;
    b.pointsFor += scoreB;
    b.pointsAgainst += scoreA;
    if (scoreA > scoreB) {
      a.wins += 1;
      a.leaguePoints += 3;
      b.losses += 1;
    } else {
      b.wins += 1;
      b.leaguePoints += 3;
      a.losses += 1;
    }
  }

  const standings = Array.from(table.values()).map((s) => ({
    ...s,
    diff: s.pointsFor - s.pointsAgainst,
  }));

  standings.sort((x, y) => {
    if (y.leaguePoints !== x.leaguePoints) return y.leaguePoints - x.leaguePoints;
    if (y.diff !== x.diff) return y.diff - x.diff;
    if (y.pointsFor !== x.pointsFor) return y.pointsFor - x.pointsFor;
    return x.teamId.localeCompare(y.teamId);
  });

  standings.forEach((s, i) => {
    s.rank = i + 1;
    s.zone = zoneForRank(s.rank);
  });

  return standings;
}

export function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function isMatchLocked(match: Match): boolean {
  if (match.status !== "upcoming") return true;
  return Date.now() >= new Date(match.startTime).getTime();
}

export function isSeasonLocked(state: AppState): boolean {
  const round1Matches = state.matches.filter((m) => m.round === 1);
  if (round1Matches.length === 0) return false;
  return round1Matches.some((m) => isMatchLocked(m));
}

export function getRoundConfig(state: AppState, round: number) {
  return state.roundConfigs.find((r) => r.round === round);
}

function isPast(iso: string | undefined): boolean {
  return !!iso && Date.now() >= new Date(iso).getTime();
}

/** A match's predictions lock once its round's admin-set deadline passes
 * (falling back to the match's own status/start time if no deadline is set). */
export function isPredictionsLocked(match: Match, state: AppState): boolean {
  if (match.status !== "upcoming") return true;
  if (isPast(getRoundConfig(state, match.round)?.predictionsDeadline)) return true;
  return isMatchLocked(match);
}

/** A round's Dream4 picks lock once its admin-set fantasy deadline passes
 * (falling back to any of the round's matches locking). */
export function isFantasyRoundLocked(round: number, state: AppState): boolean {
  if (isPast(getRoundConfig(state, round)?.fantasyDeadline)) return true;
  return state.matches.filter((m) => m.round === round).some((m) => isMatchLocked(m));
}

/** Season table predictions lock once the admin-set global deadline passes
 * (falling back to round 1 starting, as before). */
export function isTablePredictionsLocked(state: AppState): boolean {
  if (isPast(state.seasonTableDeadline)) return true;
  return isSeasonLocked(state);
}
