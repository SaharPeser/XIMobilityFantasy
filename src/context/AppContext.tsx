"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";
import type {
  AppState,
  Dream4Pick,
  League,
  Match,
  MatchResult,
  Prediction,
  SetScore,
  TablePrediction,
} from "@/lib/types";
import { buildInitialState } from "@/lib/mockData";
import { generateInviteCode } from "@/lib/scoring";

const STORAGE_KEY = "futevolei-state-v2";

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
  submitPrediction: (matchId: string, winnerTeamId: string, set: SetScore) => void;
  submitDream4: (round: number, playerIds: string[], captainId: string) => void;
  submitTablePrediction: (order: string[]) => void;
  createLeague: (name: string) => void;
  joinLeague: (code: string) => boolean;
  setCurrentUser: (userId: string) => void;
  adminSetResult: (matchId: string, result: MatchResult) => void;
  adminResetResult: (matchId: string) => void;
  adminSimulateRound: (round: number) => void;
  resetAll: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => {
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
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore quota errors
    }
  }, [state]);

  const currentUser = useMemo(
    () =>
      state.users.find((u) => u.id === state.currentUserId) ?? state.users[0],
    [state.users, state.currentUserId]
  );

  const submitPrediction = useCallback(
    (matchId: string, winnerTeamId: string, set: SetScore) => {
      dispatch({
        type: "SUBMIT_PREDICTION",
        userId: state.currentUserId,
        matchId,
        winnerTeamId,
        set,
      });
    },
    [state.currentUserId]
  );

  const submitDream4 = useCallback(
    (round: number, playerIds: string[], captainId: string) => {
      dispatch({
        type: "SUBMIT_DREAM4",
        userId: state.currentUserId,
        round,
        playerIds,
        captainId,
      });
    },
    [state.currentUserId]
  );

  const submitTablePrediction = useCallback(
    (order: string[]) => {
      dispatch({ type: "SUBMIT_TABLE_PREDICTION", userId: state.currentUserId, order });
    },
    [state.currentUserId]
  );

  const createLeague = useCallback(
    (name: string) => {
      dispatch({ type: "CREATE_LEAGUE", name, ownerId: state.currentUserId });
    },
    [state.currentUserId]
  );

  const joinLeague = useCallback(
    (code: string) => {
      const exists = state.leagues.some(
        (l) => l.code.toUpperCase() === code.toUpperCase()
      );
      if (exists) {
        dispatch({ type: "JOIN_LEAGUE", code, userId: state.currentUserId });
      }
      return exists;
    },
    [state.currentUserId, state.leagues]
  );

  const setCurrentUser = useCallback((userId: string) => {
    dispatch({ type: "SET_CURRENT_USER", userId });
  }, []);

  const adminSetResult = useCallback((matchId: string, result: MatchResult) => {
    dispatch({ type: "ADMIN_SET_RESULT", matchId, result });
  }, []);

  const adminResetResult = useCallback((matchId: string) => {
    dispatch({ type: "ADMIN_RESET_RESULT", matchId });
  }, []);

  const adminSimulateRound = useCallback((round: number) => {
    dispatch({ type: "ADMIN_SIMULATE_ROUND", round });
  }, []);

  const resetAll = useCallback(() => {
    dispatch({ type: "RESET_ALL" });
  }, []);

  const value: AppContextValue = {
    state,
    dispatch,
    currentUser,
    submitPrediction,
    submitDream4,
    submitTablePrediction,
    createLeague,
    joinLeague,
    setCurrentUser,
    adminSetResult,
    adminResetResult,
    adminSimulateRound,
    resetAll,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
