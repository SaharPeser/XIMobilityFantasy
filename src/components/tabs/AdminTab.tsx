"use client";

import { useMemo, useState } from "react";
import { Dice5, RotateCcw, ShieldAlert, Trash2 } from "lucide-react";
import { useApp } from "@/context/AppContext";
import type { Match, SetScore } from "@/lib/types";
import { REGULAR_SEASON_ROUNDS } from "@/lib/types";
import { Badge, Card, GhostButton, NumberInput, PrimaryButton, SectionTitle } from "../ui";

function AdminMatchForm({ match }: { match: Match }) {
  const { state, adminSetResult, adminResetResult } = useApp();
  const teamA = state.teams.find((t) => t.id === match.teamAId)!;
  const teamB = state.teams.find((t) => t.id === match.teamBId)!;
  const roster = state.players.filter(
    (p) => p.teamId === match.teamAId || p.teamId === match.teamBId
  );

  const [set, setSet] = useState<SetScore>(match.result?.set ?? { a: 18, b: 14 });
  const [mvp, setMvp] = useState(match.result?.mvpPlayerId ?? roster[0]?.id ?? "");

  const handleSave = () => {
    adminSetResult(match.id, { set, mvpPlayerId: mvp });
  };

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-bold text-slate-100">
          {teamA.emoji} {teamA.shortName} <span className="text-slate-500">נגד</span> {teamB.shortName}{" "}
          {teamB.emoji}
        </p>
        {match.status === "finished" && <Badge tone="green">קיימת תוצאה</Badge>}
      </div>

      <div className="mb-3 flex items-center justify-center gap-3">
        <NumberInput value={set.a} onChange={(a) => setSet({ ...set, a })} ariaLabel={`${teamA.name} תוצאה`} />
        <span className="text-slate-500">-</span>
        <NumberInput value={set.b} onChange={(b) => setSet({ ...set, b })} ariaLabel={`${teamB.name} תוצאה`} />
      </div>

      <div className="mb-3">
        <label className="mb-1 block text-xs font-semibold text-slate-400">MVP המשחק</label>
        <select
          value={mvp}
          onChange={(e) => setMvp(e.target.value)}
          className="w-full rounded-lg border border-slate-border bg-slate-900/70 px-3 py-2 text-sm text-slate-50 outline-none focus:border-sand"
        >
          {roster.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({state.teams.find((t) => t.id === p.teamId)?.shortName})
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2">
        <PrimaryButton onClick={handleSave} className="flex-1">
          שמור וחשב נקודות
        </PrimaryButton>
        {match.status === "finished" && (
          <GhostButton onClick={() => adminResetResult(match.id)}>
            <RotateCcw size={14} />
          </GhostButton>
        )}
      </div>
    </Card>
  );
}

export function AdminTab() {
  const { state, adminSimulateRound, resetAll } = useApp();

  const rounds = useMemo(
    () => Array.from(new Set(state.matches.map((m) => m.round))).sort((a, b) => a - b),
    [state.matches]
  );
  const [activeRound, setActiveRound] = useState(rounds[0]);
  const [confirmReset, setConfirmReset] = useState(false);

  const matches = state.matches.filter((m) => m.round === activeRound);

  return (
    <div className="animate-fade-in">
      <SectionTitle
        title="פאנל ניהול וסימולציה"
        subtitle={`עונה סדירה בת ${REGULAR_SEASON_ROUNDS} מחזורים · הזן תוצאות אמיתיות או הרץ סימולציה`}
        icon={<ShieldAlert size={20} />}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
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
        <GhostButton onClick={() => adminSimulateRound(activeRound)} className="mr-auto">
          <span className="flex items-center gap-1.5">
            <Dice5 size={14} /> סימולציה אוטומטית למחזור {activeRound}
          </span>
        </GhostButton>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {matches.map((m) => (
          <AdminMatchForm key={m.id} match={m} />
        ))}
      </div>

      <Card className="mt-6 flex items-center justify-between p-4">
        <div>
          <p className="text-sm font-bold text-slate-100">איפוס כל הנתונים</p>
          <p className="text-xs text-slate-500">מחזיר את כל התוצאות, הניחושים והליגות לברירת המחדל</p>
        </div>
        {confirmReset ? (
          <div className="flex gap-2">
            <PrimaryButton
              onClick={() => {
                resetAll();
                setConfirmReset(false);
              }}
              className="!bg-rose-500 !from-rose-500 !to-rose-500"
            >
              אישור איפוס
            </PrimaryButton>
            <GhostButton onClick={() => setConfirmReset(false)}>ביטול</GhostButton>
          </div>
        ) : (
          <GhostButton onClick={() => setConfirmReset(true)}>
            <span className="flex items-center gap-1.5">
              <Trash2 size={14} /> איפוס
            </span>
          </GhostButton>
        )}
      </Card>
    </div>
  );
}
