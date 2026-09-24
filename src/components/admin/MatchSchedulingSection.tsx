"use client";

import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { REGULAR_SEASON_ROUNDS } from "@/lib/types";
import { Card, PrimaryButton } from "../ui";

const SELECT_CLASS =
  "rounded-lg border border-slate-border bg-slate-900/70 px-3 py-2 text-sm text-slate-50 outline-none focus:border-sand";

export function MatchSchedulingSection() {
  const { state, adminCreateMatch } = useApp();
  const [round, setRound] = useState(1);
  const [teamA, setTeamA] = useState(state.teams[0]?.id ?? "");
  const [teamB, setTeamB] = useState(state.teams[1]?.id ?? "");

  const canSave = !!teamA && !!teamB && teamA !== teamB;

  const handleSave = () => {
    if (!canSave) return;
    adminCreateMatch(round, teamA, teamB);
  };

  return (
    <Card className="p-4">
      <p className="mb-3 text-sm font-bold text-slate-100">קביעת משחק חדש</p>
      <div className="mb-3 grid gap-2 sm:grid-cols-3">
        <select value={round} onChange={(e) => setRound(Number(e.target.value))} className={SELECT_CLASS}>
          {Array.from({ length: REGULAR_SEASON_ROUNDS }, (_, i) => i + 1).map((r) => (
            <option key={r} value={r}>
              מחזור {r}
            </option>
          ))}
        </select>
        <select value={teamA} onChange={(e) => setTeamA(e.target.value)} className={SELECT_CLASS}>
          {state.teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select value={teamB} onChange={(e) => setTeamB(e.target.value)} className={SELECT_CLASS}>
          {state.teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      {!canSave && teamA === teamB && (
        <p className="mb-2 text-xs text-rose-400">יש לבחור שתי קבוצות שונות</p>
      )}
      <PrimaryButton onClick={handleSave} disabled={!canSave} className="w-full">
        <span className="flex items-center justify-center gap-1.5">
          <CalendarPlus size={14} /> קבע משחק
        </span>
      </PrimaryButton>
    </Card>
  );
}
