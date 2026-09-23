import type {
  AppState,
  Dream4Pick,
  League,
  Match,
  MatchResult,
  Player,
  Prediction,
  SetScore,
  TablePrediction,
  Team,
  User,
} from "./types";
import { generateRoundRobin } from "./roundRobin";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const TEAMS: Team[] = [
  { id: "t1", name: "Y.A.R עובדים זרים", shortName: "Y.A.R", color: "#F59E0B", emoji: "🛡️" },
  { id: "t2", name: "SHAHAR DESIGN", shortName: "SHAHAR", color: "#06B6D4", emoji: "🎨" },
  { id: "t3", name: "חי נחמיאס", shortName: "נחמיאס", color: "#F97316", emoji: "🔥" },
  { id: "t4", name: "TEAM AGUIA - MAX7", shortName: "AGUIA", color: "#22C55E", emoji: "🦅" },
  { id: "t5", name: "MAVENS", shortName: "MAVENS", color: "#8B5CF6", emoji: "🏆" },
  { id: "t6", name: "LA PELOTA", shortName: "PELOTA", color: "#EAB308", emoji: "🏐" },
  { id: "t7", name: "NINVE OCTOPUS", shortName: "NINVE", color: "#0EA5E9", emoji: "🐙" },
  { id: "t8", name: "FRONTLIFE", shortName: "FRONTLIFE", color: "#14B8A6", emoji: "🌊" },
  { id: "t9", name: "BBB", shortName: "BBB", color: "#EAB308", emoji: "🐝" },
  { id: "t10", name: "דורין אטיאס זכרונה לברכה", shortName: "דורין", color: "#94A3B8", emoji: "🕊️" },
  { id: "t11", name: "א.ב מוראנו", shortName: "מוראנו", color: "#A855F7", emoji: "💎" },
  { id: "t12", name: "קאזה דו ברזיל אילת", shortName: "קאזה", color: "#22C55E", emoji: "🇧🇷" },
];

export const PLAYERS: Player[] = [
  { id: "t1p1", name: "דורון דיאמנט", teamId: "t1", position: "חובט", number: 1 },
  { id: "t1p2", name: "יובל כץ", teamId: "t1", position: "מגן", number: 2 },
  { id: "t1p3", name: "ביאל", teamId: "t1", position: "חובט", number: 3 },

  { id: "t2p1", name: "לי ליברמן", teamId: "t2", position: "חובט", number: 1 },
  { id: "t2p2", name: "לירון רומי", teamId: "t2", position: "מגן", number: 2 },
  { id: "t2p3", name: "פרנקלין", teamId: "t2", position: "חובט", number: 3 },

  { id: "t3p1", name: "רון בן ישי", teamId: "t3", position: "חובט", number: 1 },
  { id: "t3p2", name: "מאור האס", teamId: "t3", position: "מגן", number: 2 },

  { id: "t4p1", name: "אורי גלבוע", teamId: "t4", position: "חובט", number: 1 },
  { id: "t4p2", name: "ויקטור ריאל", teamId: "t4", position: "מגן", number: 2 },

  { id: "t5p1", name: "יוסי דרעי", teamId: "t5", position: "חובט", number: 1 },
  { id: "t5p2", name: "דן לוין", teamId: "t5", position: "מגן", number: 2 },
  { id: "t5p3", name: "נם", teamId: "t5", position: "חובט", number: 3 },

  { id: "t6p1", name: "אדיב שביט", teamId: "t6", position: "חובט", number: 1 },
  { id: "t6p2", name: "עידו שימלמיץ", teamId: "t6", position: "מגן", number: 2 },
  { id: "t6p3", name: "נגביניה", teamId: "t6", position: "חובט", number: 3 },

  { id: "t7p1", name: "אורן צוברי", teamId: "t7", position: "חובט", number: 1 },
  { id: "t7p2", name: "ויטיניו", teamId: "t7", position: "מגן", number: 2 },
  { id: "t7p3", name: "שמואל עזזרי", teamId: "t7", position: "חובט", number: 3 },

  { id: "t8p1", name: "קאי חסון", teamId: "t8", position: "חובט", number: 1 },
  { id: "t8p2", name: "אופק גולדברג", teamId: "t8", position: "מגן", number: 2 },
  { id: "t8p3", name: "יובל ספיר", teamId: "t8", position: "חובט", number: 3 },

  { id: "t9p1", name: "מאור אנקונה", teamId: "t9", position: "חובט", number: 1 },
  { id: "t9p2", name: "אלחנדרו ברלב", teamId: "t9", position: "מגן", number: 2 },
  { id: "t9p3", name: "פאוליניו", teamId: "t9", position: "חובט", number: 3 },

  { id: "t10p1", name: "לידור פרנקו", teamId: "t10", position: "חובט", number: 1 },
  { id: "t10p2", name: "הראל שועה", teamId: "t10", position: "מגן", number: 2 },
  { id: "t10p3", name: "דאבי", teamId: "t10", position: "חובט", number: 3 },

  { id: "t11p1", name: "דין שקד", teamId: "t11", position: "חובט", number: 1 },
  { id: "t11p2", name: "רנאן", teamId: "t11", position: "מגן", number: 2 },
  { id: "t11p3", name: "אראל חזיה", teamId: "t11", position: "חובט", number: 3 },

  { id: "t12p1", name: "עידן דיין", teamId: "t12", position: "חובט", number: 1 },
  { id: "t12p2", name: "פסקל שמידט", teamId: "t12", position: "מגן", number: 2 },
  { id: "t12p3", name: "פטריקו", teamId: "t12", position: "חובט", number: 3 },
];

export const USERS: User[] = [
  { id: "me", name: "אתה", avatarColor: "#F59E0B", isAdmin: true },
  { id: "u2", name: "נועה לביא", avatarColor: "#06B6D4" },
  { id: "u3", name: "איתמר כספי", avatarColor: "#22C55E" },
  { id: "u4", name: "שירה אביב", avatarColor: "#EC4899" },
  { id: "u5", name: "דניאל רגב", avatarColor: "#8B5CF6" },
];

const ROUND1_RESULTS: SetScore[] = [
  { a: 18, b: 4 },
  { a: 18, b: 6 },
  { a: 18, b: 8 },
  { a: 18, b: 10 },
  { a: 18, b: 12 },
  { a: 18, b: 14 },
];
const ROUND1_MVPS = ["t1p1", "t2p1", "t3p1", "t4p1", "t5p1", "t6p1"];

export function buildMatches(): Match[] {
  const now = Date.now();
  const fixtureRounds = generateRoundRobin(TEAMS.map((t) => t.id));
  const matches: Match[] = [];

  fixtureRounds.forEach((pairs, roundIdx) => {
    const round = roundIdx + 1;
    pairs.forEach(([teamAId, teamBId], i) => {
      const id = `r${round}m${i + 1}`;
      let startTime: string;
      let status: Match["status"] = "upcoming";
      let result: MatchResult | undefined;

      if (round === 1) {
        // Round 1: already played, finished with results.
        startTime = new Date(now - 10 * DAY + i * HOUR).toISOString();
        status = "finished";
        result = { set: ROUND1_RESULTS[i], mvpPlayerId: ROUND1_MVPS[i] };
      } else if (round === 2) {
        // Round 2: open for predictions, staggered kickoffs for the countdown demo.
        startTime = new Date(now + (4 + i * 8) * HOUR).toISOString();
      } else {
        // Rounds 3-11: future weeks, one per week.
        startTime = new Date(now + (round - 3) * 7 * DAY + i * 2 * HOUR).toISOString();
      }

      matches.push({ id, round, teamAId, teamBId, startTime, status, result });
    });
  });

  return matches;
}

export const PREDICTIONS: Prediction[] = [
  // me
  { id: "pr-me-1", userId: "me", matchId: "r1m1", winnerTeamId: "t1", set: { a: 18, b: 4 } },
  { id: "pr-me-2", userId: "me", matchId: "r1m2", winnerTeamId: "t2", set: { a: 17, b: 5 } },
  { id: "pr-me-3", userId: "me", matchId: "r1m3", winnerTeamId: "t10", set: { a: 8, b: 18 } },
  { id: "pr-me-4", userId: "me", matchId: "r1m4", winnerTeamId: "t4", set: { a: 18, b: 10 } },
  { id: "pr-me-5", userId: "me", matchId: "r1m5", winnerTeamId: "t5", set: { a: 15, b: 9 } },
  { id: "pr-me-6", userId: "me", matchId: "r1m6", winnerTeamId: "t7", set: { a: 13, b: 18 } },
  // u2
  { id: "pr-u2-1", userId: "u2", matchId: "r1m1", winnerTeamId: "t1", set: { a: 18, b: 4 } },
  { id: "pr-u2-2", userId: "u2", matchId: "r1m2", winnerTeamId: "t2", set: { a: 18, b: 6 } },
  { id: "pr-u2-3", userId: "u2", matchId: "r1m3", winnerTeamId: "t3", set: { a: 18, b: 9 } },
  { id: "pr-u2-4", userId: "u2", matchId: "r1m4", winnerTeamId: "t9", set: { a: 18, b: 15 } },
  { id: "pr-u2-5", userId: "u2", matchId: "r1m5", winnerTeamId: "t5", set: { a: 17, b: 11 } },
  { id: "pr-u2-6", userId: "u2", matchId: "r1m6", winnerTeamId: "t6", set: { a: 16, b: 13 } },
  // u3
  { id: "pr-u3-1", userId: "u3", matchId: "r1m1", winnerTeamId: "t12", set: { a: 15, b: 12 } },
  { id: "pr-u3-2", userId: "u3", matchId: "r1m2", winnerTeamId: "t2", set: { a: 18, b: 6 } },
  { id: "pr-u3-3", userId: "u3", matchId: "r1m3", winnerTeamId: "t3", set: { a: 18, b: 8 } },
  { id: "pr-u3-4", userId: "u3", matchId: "r1m4", winnerTeamId: "t4", set: { a: 18, b: 10 } },
  { id: "pr-u3-5", userId: "u3", matchId: "r1m5", winnerTeamId: "t8", set: { a: 14, b: 18 } },
  { id: "pr-u3-6", userId: "u3", matchId: "r1m6", winnerTeamId: "t6", set: { a: 18, b: 14 } },
  // u4
  { id: "pr-u4-1", userId: "u4", matchId: "r1m1", winnerTeamId: "t1", set: { a: 16, b: 5 } },
  { id: "pr-u4-2", userId: "u4", matchId: "r1m2", winnerTeamId: "t11", set: { a: 12, b: 15 } },
  { id: "pr-u4-3", userId: "u4", matchId: "r1m3", winnerTeamId: "t3", set: { a: 18, b: 8 } },
  { id: "pr-u4-4", userId: "u4", matchId: "r1m4", winnerTeamId: "t4", set: { a: 17, b: 9 } },
  { id: "pr-u4-5", userId: "u4", matchId: "r1m5", winnerTeamId: "t5", set: { a: 18, b: 12 } },
  { id: "pr-u4-6", userId: "u4", matchId: "r1m6", winnerTeamId: "t6", set: { a: 18, b: 14 } },
  // u5
  { id: "pr-u5-1", userId: "u5", matchId: "r1m1", winnerTeamId: "t12", set: { a: 15, b: 10 } },
  { id: "pr-u5-2", userId: "u5", matchId: "r1m2", winnerTeamId: "t11", set: { a: 14, b: 16 } },
  { id: "pr-u5-3", userId: "u5", matchId: "r1m3", winnerTeamId: "t10", set: { a: 16, b: 14 } },
  { id: "pr-u5-4", userId: "u5", matchId: "r1m4", winnerTeamId: "t4", set: { a: 18, b: 11 } },
  { id: "pr-u5-5", userId: "u5", matchId: "r1m5", winnerTeamId: "t8", set: { a: 16, b: 13 } },
  { id: "pr-u5-6", userId: "u5", matchId: "r1m6", winnerTeamId: "t6", set: { a: 17, b: 14 } },
];

export const DREAM4_PICKS: Dream4Pick[] = [
  { id: "d-me", userId: "me", round: 1, playerIds: ["t1p1", "t1p2", "t2p1", "t3p1"], captainId: "t1p1" },
  { id: "d-u2", userId: "u2", round: 1, playerIds: ["t2p1", "t4p1", "t5p1", "t1p2"], captainId: "t4p1" },
  { id: "d-u3", userId: "u3", round: 1, playerIds: ["t7p1", "t8p1", "t9p1", "t10p1"], captainId: "t7p1" },
  { id: "d-u4", userId: "u4", round: 1, playerIds: ["t1p1", "t2p1", "t3p1", "t4p1"], captainId: "t1p1" },
  { id: "d-u5", userId: "u5", round: 1, playerIds: ["t6p1", "t6p2", "t5p2", "t1p3"], captainId: "t6p1" },
];

export const TABLE_PREDICTIONS: TablePrediction[] = [
  {
    id: "tp-me",
    userId: "me",
    order: ["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8", "t9", "t10", "t11", "t12"],
  },
  {
    id: "tp-u2",
    userId: "u2",
    order: ["t1", "t2", "t3", "t4", "t6", "t5", "t7", "t8", "t9", "t11", "t10", "t12"],
  },
  {
    id: "tp-u4",
    userId: "u4",
    order: ["t12", "t11", "t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8", "t9", "t10"],
  },
];

export const LEAGUES: League[] = [
  {
    id: "l1",
    name: "חברים מהחוף",
    code: "SUNXPL",
    ownerId: "me",
    memberIds: ["me", "u2", "u3"],
    createdAt: new Date(Date.now() - 12 * DAY).toISOString(),
  },
  {
    id: "l2",
    name: "טורניר המשרד",
    code: "BEACH7",
    ownerId: "u4",
    memberIds: ["u4", "u5", "me"],
    createdAt: new Date(Date.now() - 8 * DAY).toISOString(),
  },
];

export function buildInitialState(): AppState {
  return {
    currentUserId: "me",
    users: USERS,
    teams: TEAMS,
    players: PLAYERS,
    matches: buildMatches(),
    predictions: PREDICTIONS,
    dream4Picks: DREAM4_PICKS,
    tablePredictions: TABLE_PREDICTIONS,
    leagues: LEAGUES,
  };
}
