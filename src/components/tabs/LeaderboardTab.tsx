"use client";

import { useMemo, useState } from "react";
import { Medal } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { computeLeaderboard, computeRoundLeaderboard } from "@/lib/scoring";
import { Avatar, Card } from "../ui";

const MEDAL_COLORS = ["#F59E0B", "#94A3B8", "#B45309"];

export function LeaderboardTab() {
  const { state, currentUser } = useApp();

  const rounds = useMemo(
    () => Array.from(new Set(state.matches.map((m) => m.round))).sort((a, b) => a - b),
    [state.matches]
  );

  const [view, setView] = useState<"global" | number>("global");

  const entries = useMemo(() => {
    if (view === "global") return computeLeaderboard(state);
    return computeRoundLeaderboard(state, view);
  }, [state, view]);

  return (
    <div className="animate-fade-in">
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setView("global")}
          className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${
            view === "global"
              ? "bg-gradient-to-l from-sand to-sand-light text-slate-900"
              : "bg-slate-800/60 text-slate-300 hover:bg-slate-800"
          }`}
        >
          דירוג כללי
        </button>
        {rounds.map((r) => (
          <button
            key={r}
            onClick={() => setView(r)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${
              view === r
                ? "bg-gradient-to-l from-ocean to-ocean-light text-slate-900"
                : "bg-slate-800/60 text-slate-300 hover:bg-slate-800"
            }`}
          >
            מחזור {r}
          </button>
        ))}
      </div>

      <Card className="divide-y divide-slate-border overflow-hidden">
        {entries.map((entry, i) => {
          const user = state.users.find((u) => u.id === entry.userId)!;
          const isMe = user.id === currentUser.id;
          return (
            <div
              key={entry.userId}
              className={`flex items-center gap-3 px-4 py-3 ${isMe ? "bg-sand/10" : ""}`}
            >
              <div className="flex w-7 items-center justify-center">
                {i < 3 ? (
                  <Medal size={18} color={MEDAL_COLORS[i]} fill={MEDAL_COLORS[i]} />
                ) : (
                  <span className="text-sm font-bold text-slate-500">{i + 1}</span>
                )}
              </div>
              <Avatar name={user.name} color={user.avatarColor} />
              <div className="flex-1">
                <p className={`text-sm font-bold ${isMe ? "text-sand-light" : "text-slate-100"}`}>
                  {user.name} {isMe && "(אתה)"}
                </p>
                <p className="text-xs text-slate-500">
                  הימורים {entry.predictionPoints} · פנטזי {entry.fantasyPoints}
                  {entry.tablePoints > 0 && ` · טבלה ${entry.tablePoints}`}
                </p>
              </div>
              <span className="text-xl font-black text-slate-50">{entry.total}</span>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
