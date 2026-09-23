"use client";

import { useMemo, useState } from "react";
import { Target } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { MatchCard } from "../MatchCard";
import { SectionTitle } from "../ui";

export function PredictionsTab() {
  const { state } = useApp();

  const rounds = useMemo(
    () => Array.from(new Set(state.matches.map((m) => m.round))).sort((a, b) => a - b),
    [state.matches]
  );

  const defaultRound = useMemo(() => {
    const openRound = state.matches.find((m) => m.status === "upcoming")?.round;
    return openRound ?? rounds[0];
  }, [state.matches, rounds]);

  const [activeRound, setActiveRound] = useState(defaultRound);

  const matches = state.matches
    .filter((m) => m.round === activeRound)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  return (
    <div className="animate-fade-in">
      <SectionTitle
        title="הימורי תוצאות"
        subtitle="נחש את המנצח ואת התוצאה המדויקת בכל משחק"
        icon={<Target size={20} />}
      />

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {rounds.map((r) => (
          <button
            key={r}
            onClick={() => setActiveRound(r)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${
              activeRound === r
                ? "bg-gradient-to-l from-sand to-sand-light text-slate-900"
                : "bg-slate-800/60 text-slate-300 hover:bg-slate-800"
            }`}
          >
            מחזור {r}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {matches.map((m) => (
          <MatchCard key={m.id} match={m} />
        ))}
      </div>
    </div>
  );
}
