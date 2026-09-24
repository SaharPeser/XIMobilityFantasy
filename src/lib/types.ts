export interface Team {
  id: string;
  name: string;
  shortName: string;
  color: string;
  emoji: string;
}

export interface Player {
  id: string;
  name: string;
  teamId: string;
  number: number;
}

export interface SetScore {
  a: number;
  b: number;
}

export type MatchStatus = "upcoming" | "locked" | "finished";

export interface MatchResult {
  set: SetScore;
  mvpPlayerId: string;
}

/** Regular season round-robin match. Playoff rounds are not simulated — see PlayoffZone. */
export interface Match {
  id: string;
  round: number;
  teamAId: string;
  teamBId: string;
  startTime: string; // ISO
  status: MatchStatus;
  result?: MatchResult;
}

export interface Prediction {
  id: string;
  userId: string;
  matchId: string;
  winnerTeamId: string;
  set: SetScore;
}

export interface Dream4Pick {
  id: string;
  userId: string;
  round: number;
  playerIds: string[]; // exactly 4
  captainId: string;
}

/** Pre-season prediction of the final regular-season (1-12) table order. */
export interface TablePrediction {
  id: string;
  userId: string;
  order: string[]; // team ids, index 0 = predicted 1st place ... index 11 = predicted 12th place
}

/** Admin-configured dates/deadlines for one round. All fields are ISO strings. */
export interface RoundConfig {
  round: number;
  date: string;
  predictionsDeadline: string;
  fantasyDeadline: string;
}

export interface League {
  id: string;
  name: string;
  code: string;
  ownerId: string;
  memberIds: string[];
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  avatarColor: string;
  isAdmin?: boolean;
}

export interface AppState {
  currentUserId: string;
  users: User[];
  teams: Team[];
  players: Player[];
  matches: Match[];
  predictions: Prediction[];
  dream4Picks: Dream4Pick[];
  tablePredictions: TablePrediction[];
  leagues: League[];
  roundConfigs: RoundConfig[];
  /** ISO string; season table predictions lock once this passes. */
  seasonTableDeadline: string;
}

export const REGULAR_SEASON_ROUNDS = 11;
export const LEAGUE_SIZE = 12;

export type PlayoffZone =
  | "final4-direct"
  | "final4-playin"
  | "mid"
  | "relegation-playoff"
  | "relegation-direct";

export interface TeamStanding {
  teamId: string;
  played: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  diff: number;
  leaguePoints: number;
  rank: number;
  zone: PlayoffZone;
}
