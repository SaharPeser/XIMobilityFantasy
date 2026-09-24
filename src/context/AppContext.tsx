"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
import type {
  AppState,
  Dream4Pick,
  League,
  Match,
  MatchResult,
  Prediction,
  RoundConfig,
  SetScore,
  TablePrediction,
} from "@/lib/types";
import { buildInitialState } from "@/lib/mockData";
import { generateInviteCode } from "@/lib/scoring";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import * as repo from "@/lib/supabaseRepo";
import { readCachedDisplayName, writeCachedDisplayName } from "@/lib/displayNameCache";

const STORAGE_KEY = "futevolei-state-v3";

export type DataSource = "mock" | "supabase";

type Action =
  | { type: "SET_CURRENT_USER"; userId: string }
  | {
      type: "SUBMIT_PREDICTION";
      userId: string;
      matchId: string;
      winnerTeamId: string;
      set: SetScore;
    }
  | {
      type: "SUBMIT_DREAM4";
      userId: string;
      round: number;
      playerIds: string[];
      captainId: string;
    }
  | { type: "SUBMIT_TABLE_PREDICTION"; userId: string; order: string[] }
  | { type: "CREATE_LEAGUE"; name: string; ownerId: string }
  | { type: "JOIN_LEAGUE"; code: string; userId: string }
  | { type: "ADMIN_SET_RESULT"; matchId: string; result: MatchResult }
  | { type: "ADMIN_SIMULATE_ROUND"; round: number }
  | { type: "ADMIN_RESET_RESULT"; matchId: string }
  | { type: "ADMIN_SET_ROUND_CONFIG"; config: RoundConfig }
  | { type: "ADMIN_SET_SEASON_TABLE_DEADLINE"; deadline: string }
  | {
      type: "ADMIN_CREATE_TEAM";
      teamId: string;
      name: string;
      color: string;
      emoji: string;
      playerNames: [string, string, string];
    }
  | { type: "ADMIN_CREATE_MATCH"; matchId: string; round: number; teamAId: string; teamBId: string }
  | {
      type: "ADMIN_UPDATE_TEAM";
      teamId: string;
      name: string;
      color: string;
      emoji: string;
      players: { id: string; name: string }[];
    }
  | { type: "ADMIN_DELETE_TEAM"; teamId: string }
  | { type: "RESET_ALL" };

function simulateMatchResult(): MatchResult {
  const winnerScore = 18;
  const loserScore = Math.floor(Math.random() * 15) + 2; // 2..16
  const aWon = Math.random() > 0.5;
  const set: SetScore = aWon
    ? { a: winnerScore, b: loserScore }
    : { a: loserScore, b: winnerScore };
  return { set, mvpPlayerId: "" };
}

// Pure AppState transitions. Used both to drive the local-only mock reducer
// and, in Supabase mode, to apply an optimistic local update immediately
// (before/alongside the real async write via src/lib/supabaseRepo.ts) so the
// UI never has to wait on a round trip for its own actions.
function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "SET_CURRENT_USER":
      return { ...state, currentUserId: action.userId };

    case "SUBMIT_PREDICTION": {
      const existing = state.predictions.find(
        (p) => p.userId === action.userId && p.matchId === action.matchId
      );
      const pred: Prediction = {
        id: existing?.id ?? `pr-${action.userId}-${action.matchId}-${Date.now()}`,
        userId: action.userId,
        matchId: action.matchId,
        winnerTeamId: action.winnerTeamId,
        set: action.set,
      };
      const predictions = existing
        ? state.predictions.map((p) => (p.id === existing.id ? pred : p))
        : [...state.predictions, pred];
      return { ...state, predictions };
    }

    case "SUBMIT_DREAM4": {
      const existing = state.dream4Picks.find(
        (p) => p.userId === action.userId && p.round === action.round
      );
      const pick: Dream4Pick = {
        id: existing?.id ?? `d-${action.userId}-${action.round}-${Date.now()}`,
        userId: action.userId,
        round: action.round,
        playerIds: action.playerIds,
        captainId: action.captainId,
      };
      const dream4Picks = existing
        ? state.dream4Picks.map((p) => (p.id === existing.id ? pick : p))
        : [...state.dream4Picks, pick];
      return { ...state, dream4Picks };
    }

    case "SUBMIT_TABLE_PREDICTION": {
      const existing = state.tablePredictions.find((p) => p.userId === action.userId);
      const pred: TablePrediction = {
        id: existing?.id ?? `tp-${action.userId}-${Date.now()}`,
        userId: action.userId,
        order: action.order,
      };
      const tablePredictions = existing
        ? state.tablePredictions.map((p) => (p.id === existing.id ? pred : p))
        : [...state.tablePredictions, pred];
      return { ...state, tablePredictions };
    }

    case "CREATE_LEAGUE": {
      const existingCodes = new Set(state.leagues.map((l) => l.code));
      let code = generateInviteCode();
      while (existingCodes.has(code)) code = generateInviteCode();
      const league: League = {
        id: `l-${Date.now()}`,
        name: action.name,
        code,
        ownerId: action.ownerId,
        memberIds: [action.ownerId],
        createdAt: new Date().toISOString(),
      };
      return { ...state, leagues: [...state.leagues, league] };
    }

    case "JOIN_LEAGUE": {
      const league = state.leagues.find(
        (l) => l.code.toUpperCase() === action.code.toUpperCase()
      );
      if (!league) return state;
      if (league.memberIds.includes(action.userId)) return state;
      const leagues = state.leagues.map((l) =>
        l.id === league.id
          ? { ...l, memberIds: [...l.memberIds, action.userId] }
          : l
      );
      return { ...state, leagues };
    }

    case "ADMIN_SET_RESULT": {
      const matches = state.matches.map((m) =>
        m.id === action.matchId
          ? { ...m, status: "finished" as const, result: action.result }
          : m
      );
      return { ...state, matches };
    }

    case "ADMIN_RESET_RESULT": {
      const matches = state.matches.map((m) =>
        m.id === action.matchId
          ? { ...m, status: "upcoming" as const, result: undefined }
          : m
      );
      return { ...state, matches };
    }

    case "ADMIN_SET_ROUND_CONFIG": {
      const exists = state.roundConfigs.some((r) => r.round === action.config.round);
      const roundConfigs = exists
        ? state.roundConfigs.map((r) => (r.round === action.config.round ? action.config : r))
        : [...state.roundConfigs, action.config].sort((a, b) => a.round - b.round);
      return { ...state, roundConfigs };
    }

    case "ADMIN_SET_SEASON_TABLE_DEADLINE":
      return { ...state, seasonTableDeadline: action.deadline };

    case "ADMIN_CREATE_TEAM": {
      const team = { id: action.teamId, name: action.name, shortName: action.name.slice(0, 10), color: action.color, emoji: action.emoji };
      const players = action.playerNames.map((name, i) => ({
        id: `${action.teamId}p${i + 1}`,
        name,
        teamId: action.teamId,
        number: i + 1,
      }));
      return { ...state, teams: [...state.teams, team], players: [...state.players, ...players] };
    }

    case "ADMIN_CREATE_MATCH": {
      const match: Match = {
        id: action.matchId,
        round: action.round,
        teamAId: action.teamAId,
        teamBId: action.teamBId,
        startTime: new Date().toISOString(),
        status: "upcoming",
      };
      return { ...state, matches: [...state.matches, match] };
    }

    case "ADMIN_UPDATE_TEAM": {
      const teams = state.teams.map((t) =>
        t.id === action.teamId
          ? { ...t, name: action.name, shortName: action.name.slice(0, 10), color: action.color, emoji: action.emoji }
          : t
      );
      const nameById = new Map(action.players.map((p) => [p.id, p.name]));
      const players = state.players.map((p) =>
        nameById.has(p.id) ? { ...p, name: nameById.get(p.id)! } : p
      );
      return { ...state, teams, players };
    }

    case "ADMIN_DELETE_TEAM": {
      const teams = state.teams.filter((t) => t.id !== action.teamId);
      const players = state.players.filter((p) => p.teamId !== action.teamId);
      return { ...state, teams, players };
    }

    case "ADMIN_SIMULATE_ROUND": {
      const matches: Match[] = state.matches.map((m) => {
        if (m.round !== action.round) return m;
        const result = m.result ?? simulateMatchResult();
        const roster = state.players.filter(
          (p) => p.teamId === m.teamAId || p.teamId === m.teamBId
        );
        const mvpPlayerId =
          result.mvpPlayerId ||
          roster[Math.floor(Math.random() * roster.length)]?.id ||
          "";
        return {
          ...m,
          status: "finished",
          result: { ...result, mvpPlayerId },
        };
      });
      return { ...state, matches };
    }

    case "RESET_ALL":
      return buildInitialState();

    default:
      return state;
  }
}

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  currentUser: AppState["users"][number];
  dataSource: DataSource;
  loading: boolean;
  needsDisplayName: boolean;
  updateDisplayName: (name: string) => void;
  submitPrediction: (matchId: string, winnerTeamId: string, set: SetScore) => void;
  submitDream4: (round: number, playerIds: string[], captainId: string) => void;
  submitTablePrediction: (order: string[]) => void;
  createLeague: (name: string) => void;
  joinLeague: (code: string) => Promise<boolean>;
  setCurrentUser: (userId: string) => void;
  adminSetResult: (matchId: string, result: MatchResult) => void;
  adminResetResult: (matchId: string) => void;
  adminSimulateRound: (round: number) => void;
  adminSetRoundConfig: (config: RoundConfig) => void;
  adminSetSeasonTableDeadline: (deadline: string) => void;
  adminCreateTeam: (
    name: string,
    color: string,
    emoji: string,
    playerNames: [string, string, string]
  ) => void;
  adminCreateMatch: (round: number, teamAId: string, teamBId: string) => void;
  adminUpdateTeam: (
    teamId: string,
    name: string,
    color: string,
    emoji: string,
    players: { id: string; name: string }[]
  ) => void;
  adminDeleteTeam: (teamId: string) => Promise<{ ok: boolean; reason?: string }>;
  resetAll: () => void;
  refetchAll: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  // The local demo path — always initialized so it's instantly ready as a
  // fallback, and remains the whole app when Supabase isn't configured.
  const [mockState, dispatch] = useReducer(reducer, undefined, () => {
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw) as AppState;
      } catch {
        // ignore corrupted storage
      }
    }
    return buildInitialState();
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(mockState));
    } catch {
      // ignore quota errors
    }
  }, [mockState]);

  // The real backend path.
  const [dataSource, setDataSource] = useState<DataSource>("mock");
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [supaState, setSupaState] = useState<AppState | null>(null);
  // Set while a Supabase session exists but its profile has no display name
  // yet — gates the app behind the name-entry modal (see AppShell.tsx).
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  const loadSupabaseState = useCallback(async (userId: string) => {
    const fresh = await repo.fetchAppState(userId);
    setSupaState(fresh);
    setDataSource("supabase");
    setPendingUserId(null);
  }, []);

  useEffect(() => {
    // `loading` already starts false in this case (see useState above).
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    (async () => {
      try {
        const userId = await repo.ensureSession();
        const dbName = await repo.ensureProfile(userId);
        const cachedName = readCachedDisplayName(userId);

        if (!dbName && cachedName) {
          // We have a name locally (e.g. an earlier write failed) — resync
          // it to the profile instead of asking again.
          await repo.updateDisplayName(userId, cachedName).catch(() => {});
        } else if (!dbName && !cachedName) {
          // First visit: ask for a name before entering the app.
          if (!cancelled) {
            setPendingUserId(userId);
            setLoading(false);
          }
          return;
        }

        if (cancelled) return;
        await loadSupabaseState(userId);
      } catch (err) {
        // Requirement: fall back to local mock data if Supabase env vars are
        // missing or the connection/anonymous-auth handshake fails (e.g.
        // Anonymous Sign-ins not enabled on the project yet).
        console.warn("[futevolei] Supabase unavailable, using local demo data instead.", err);
        if (!cancelled) setDataSource("mock");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadSupabaseState]);

  const state = dataSource === "supabase" && supaState ? supaState : mockState;

  const currentUser = useMemo(
    () =>
      state.users.find((u) => u.id === state.currentUserId) ?? state.users[0],
    [state.users, state.currentUserId]
  );

  const applyLocally = useCallback(
    (action: Action) => {
      if (dataSource === "supabase") {
        setSupaState((prev) => (prev ? reducer(prev, action) : prev));
      } else {
        dispatch(action);
      }
    },
    [dataSource]
  );

  const submitPrediction = useCallback(
    (matchId: string, winnerTeamId: string, set: SetScore) => {
      const userId = state.currentUserId;
      applyLocally({ type: "SUBMIT_PREDICTION", userId, matchId, winnerTeamId, set });
      if (dataSource === "supabase") {
        repo.submitPrediction(userId, matchId, winnerTeamId, set).catch((err) => {
          console.error("[futevolei] Failed to save prediction to Supabase", err);
        });
      }
    },
    [applyLocally, dataSource, state.currentUserId]
  );

  const submitDream4 = useCallback(
    (round: number, playerIds: string[], captainId: string) => {
      const userId = state.currentUserId;
      applyLocally({ type: "SUBMIT_DREAM4", userId, round, playerIds, captainId });
      if (dataSource === "supabase") {
        repo.submitDream4(userId, round, playerIds, captainId).catch((err) => {
          console.error("[futevolei] Failed to save fantasy pick to Supabase", err);
        });
      }
    },
    [applyLocally, dataSource, state.currentUserId]
  );

  const submitTablePrediction = useCallback(
    (order: string[]) => {
      const userId = state.currentUserId;
      applyLocally({ type: "SUBMIT_TABLE_PREDICTION", userId, order });
      if (dataSource === "supabase") {
        repo.submitTablePrediction(userId, order).catch((err) => {
          console.error("[futevolei] Failed to save table prediction to Supabase", err);
        });
      }
    },
    [applyLocally, dataSource, state.currentUserId]
  );

  const updateDisplayName = useCallback(
    (name: string) => {
      if (pendingUserId) {
        // First-visit onboarding: save the name, then load the rest of the app.
        const userId = pendingUserId;
        writeCachedDisplayName(userId, name);
        setLoading(true);
        repo
          .updateDisplayName(userId, name)
          .catch((err) => console.error("[futevolei] Failed to save display name", err))
          .then(() => loadSupabaseState(userId))
          .catch((err) => {
            console.error("[futevolei] Failed to load app data after onboarding", err);
            setDataSource("mock");
          })
          .finally(() => setLoading(false));
        return;
      }

      if (dataSource === "supabase") {
        const userId = state.currentUserId;
        writeCachedDisplayName(userId, name);
        setSupaState((prev) =>
          prev
            ? {
                ...prev,
                users: prev.users.map((u) => (u.id === userId ? { ...u, name } : u)),
              }
            : prev
        );
        repo.updateDisplayName(userId, name).catch((err) => {
          console.error("[futevolei] Failed to save display name to Supabase", err);
        });
      }
    },
    [dataSource, loadSupabaseState, pendingUserId, state.currentUserId]
  );

  const createLeague = useCallback(
    (name: string) => {
      if (dataSource === "supabase") {
        repo
          .createLeague(name, state.currentUserId)
          .then(() => repo.fetchLeagues())
          .then((leagues) => setSupaState((prev) => (prev ? { ...prev, leagues } : prev)))
          .catch((err) => console.error("[futevolei] Failed to create league", err));
        return;
      }
      dispatch({ type: "CREATE_LEAGUE", name, ownerId: state.currentUserId });
    },
    [dataSource, state.currentUserId]
  );

  const joinLeague = useCallback(
    async (code: string) => {
      if (dataSource === "supabase") {
        const ok = await repo.joinLeagueByCode(code);
        if (ok) {
          const leagues = await repo.fetchLeagues();
          setSupaState((prev) => (prev ? { ...prev, leagues } : prev));
        }
        return ok;
      }
      const exists = state.leagues.some(
        (l) => l.code.toUpperCase() === code.toUpperCase()
      );
      if (exists) {
        dispatch({ type: "JOIN_LEAGUE", code, userId: state.currentUserId });
      }
      return exists;
    },
    [dataSource, state.currentUserId, state.leagues]
  );

  const setCurrentUser = useCallback(
    (userId: string) => {
      // Only meaningful in mock mode: Supabase mode has exactly one real,
      // signed-in identity (see repo.ensureSession), so there's no one else
      // to switch to.
      if (dataSource === "mock") dispatch({ type: "SET_CURRENT_USER", userId });
    },
    [dataSource]
  );

  const adminSetResult = useCallback(
    (matchId: string, result: MatchResult) => {
      if (dataSource === "supabase") {
        repo
          .adminSetResult(matchId, result)
          .then(() => repo.fetchMatches())
          .then((matches) => setSupaState((prev) => (prev ? { ...prev, matches } : prev)))
          .catch((err) => console.error("[futevolei] Failed to save match result", err));
        return;
      }
      dispatch({ type: "ADMIN_SET_RESULT", matchId, result });
    },
    [dataSource]
  );

  const adminResetResult = useCallback(
    (matchId: string) => {
      if (dataSource === "supabase") {
        repo
          .adminResetResult(matchId)
          .then(() => repo.fetchMatches())
          .then((matches) => setSupaState((prev) => (prev ? { ...prev, matches } : prev)))
          .catch((err) => console.error("[futevolei] Failed to reset match result", err));
        return;
      }
      dispatch({ type: "ADMIN_RESET_RESULT", matchId });
    },
    [dataSource]
  );

  const adminSimulateRound = useCallback(
    (round: number) => {
      if (dataSource === "supabase") {
        repo
          .adminSimulateRound(round)
          .then(() => repo.fetchMatches())
          .then((matches) => setSupaState((prev) => (prev ? { ...prev, matches } : prev)))
          .catch((err) => console.error("[futevolei] Failed to simulate round", err));
        return;
      }
      dispatch({ type: "ADMIN_SIMULATE_ROUND", round });
    },
    [dataSource]
  );

  const adminSetRoundConfig = useCallback(
    (config: RoundConfig) => {
      applyLocally({ type: "ADMIN_SET_ROUND_CONFIG", config });
      if (dataSource === "supabase") {
        repo.updateRoundConfig(config).catch((err) => {
          console.error("[futevolei] Failed to save round deadlines", err);
        });
      }
    },
    [applyLocally, dataSource]
  );

  const adminSetSeasonTableDeadline = useCallback(
    (deadline: string) => {
      applyLocally({ type: "ADMIN_SET_SEASON_TABLE_DEADLINE", deadline });
      if (dataSource === "supabase") {
        repo.updateSeasonTableDeadline(deadline).catch((err) => {
          console.error("[futevolei] Failed to save season table deadline", err);
        });
      }
    },
    [applyLocally, dataSource]
  );

  const adminCreateTeam = useCallback(
    (name: string, color: string, emoji: string, playerNames: [string, string, string]) => {
      if (dataSource === "supabase") {
        repo
          .createTeam(name, color, emoji, playerNames)
          .then(() => repo.fetchTeamsAndPlayers())
          .then(({ teams, players }) => setSupaState((prev) => (prev ? { ...prev, teams, players } : prev)))
          .catch((err) => console.error("[futevolei] Failed to create team", err));
        return;
      }
      const teamId = `team-${Date.now()}`;
      dispatch({ type: "ADMIN_CREATE_TEAM", teamId, name, color, emoji, playerNames });
    },
    [dataSource]
  );

  const adminCreateMatch = useCallback(
    (round: number, teamAId: string, teamBId: string) => {
      if (dataSource === "supabase") {
        repo
          .createMatch(round, teamAId, teamBId)
          .then(() => repo.fetchMatches())
          .then((matches) => setSupaState((prev) => (prev ? { ...prev, matches } : prev)))
          .catch((err) => console.error("[futevolei] Failed to create match", err));
        return;
      }
      const matchId = `match-${Date.now()}`;
      dispatch({ type: "ADMIN_CREATE_MATCH", matchId, round, teamAId, teamBId });
    },
    [dataSource]
  );

  const adminUpdateTeam = useCallback(
    (
      teamId: string,
      name: string,
      color: string,
      emoji: string,
      players: { id: string; name: string }[]
    ) => {
      if (dataSource === "supabase") {
        repo
          .updateTeam(teamId, name, color, emoji, players)
          .then(() => repo.fetchTeamsAndPlayers())
          .then(({ teams, players }) => setSupaState((prev) => (prev ? { ...prev, teams, players } : prev)))
          .catch((err) => console.error("[futevolei] Failed to update team", err));
        return;
      }
      dispatch({ type: "ADMIN_UPDATE_TEAM", teamId, name, color, emoji, players });
    },
    [dataSource]
  );

  const adminDeleteTeam = useCallback(
    async (teamId: string) => {
      const hasMatches = state.matches.some((m) => m.teamAId === teamId || m.teamBId === teamId);
      if (hasMatches) {
        return { ok: false, reason: "לא ניתן למחוק קבוצה עם משחקים משובצים בלוח" };
      }

      if (dataSource === "supabase") {
        try {
          await repo.deleteTeam(teamId);
          const { teams, players } = await repo.fetchTeamsAndPlayers();
          setSupaState((prev) => (prev ? { ...prev, teams, players } : prev));
          return { ok: true };
        } catch (err) {
          console.error("[futevolei] Failed to delete team", err);
          return { ok: false, reason: "שגיאה במחיקת הקבוצה" };
        }
      }

      dispatch({ type: "ADMIN_DELETE_TEAM", teamId });
      return { ok: true };
    },
    [dataSource, state.matches]
  );

  const resetAll = useCallback(() => {
    // No destructive "factory reset" against a shared production database —
    // this only ever clears the local mock sandbox.
    if (dataSource === "supabase") return;
    dispatch({ type: "RESET_ALL" });
  }, [dataSource]);

  const refetchAll = useCallback(() => {
    if (dataSource !== "supabase") return;
    setLoading(true);
    repo
      .fetchAppState(state.currentUserId)
      .then((fresh) => setSupaState(fresh))
      .catch((err) => console.error("[futevolei] Failed to refresh from Supabase", err))
      .finally(() => setLoading(false));
  }, [dataSource, state.currentUserId]);

  const value: AppContextValue = {
    state,
    dispatch,
    currentUser,
    dataSource,
    loading,
    needsDisplayName: pendingUserId !== null,
    updateDisplayName,
    submitPrediction,
    submitDream4,
    submitTablePrediction,
    createLeague,
    joinLeague,
    setCurrentUser,
    adminSetResult,
    adminResetResult,
    adminSimulateRound,
    adminSetRoundConfig,
    adminSetSeasonTableDeadline,
    adminCreateTeam,
    adminCreateMatch,
    adminUpdateTeam,
    adminDeleteTeam,
    resetAll,
    refetchAll,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
