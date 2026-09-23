"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Lock,
  ListOrdered,
  Table2,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import {
  computeStandings,
  computeTablePredictionScore,
  isSeasonLocked,
} from "@/lib/scoring";
import type { PlayoffZone } from "@/lib/types";
import { Badge, Card, PrimaryButton, SectionTitle } from "../ui";

const ZONE_STYLES: Record<PlayoffZone, { border: string; label: string }> = {
  "final4-direct": { border: "#F59E0B", label: "עולה ישירות לפיינל פור" },
  "final4-playin": { border: "#06B6D4", label: "פלייאין לפיינל פור" },
  mid: { border: "#475569", label: "אמצע הטבלה" },
  "relegation-playoff": { border: "#F97316", label: "פלייאוף ירידה מול ליגה ב'" },
  "relegation-direct": { border: "#EF4444", label: "ירידה אוטומטית לליגה ב'" },
};

function LiveStandings() {
  const { state } = useApp();
  const standings = computeStandings(state);

  return (
    <div className="animate-fade-in">
      <Card className="overflow-hidden">
        <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-2 border-b border-slate-border bg-slate-900/60 px-3 py-2 text-[11px] font-bold text-slate-400">
          <span className="w-6 text-center">#</span>
          <span>קבוצה</span>
          <span className="w-8 text-center">מ</span>
          <span className="w-10 text-center">נ-ה</span>
          <span className="w-14 text-center">הפרש</span>
          <span className="w-8 text-center">נק&apos;</span>
        </div>
        {standings.map((s) => {
          const team = state.teams.find((t) => t.id === s.teamId)!;
          const zone = ZONE_STYLES[s.zone];
          return (
            <div
              key={s.teamId}
              className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-2 border-b border-slate-border/60 px-3 py-2.5 last:border-0"
              style={{ borderInlineStartWidth: 4, borderInlineStartColor: zone.border, borderInlineStartStyle: "solid" }}
            >
              <span className="w-6 text-center text-sm font-bold text-slate-400">{s.rank}</span>
              <span className="flex items-center gap-2 text-sm font-bold text-slate-100">
                <span>{team.emoji}</span>
                <span className="truncate">{team.name}</span>
              </span>
              <span className="w-8 text-center text-xs text-slate-400">{s.played}</span>
              <span className="w-10 text-center text-xs text-slate-300 tabular-nums">
                {s.wins}-{s.losses}
              </span>
              <span
                className={`w-14 text-center text-xs tabular-nums ${
                  s.diff > 0 ? "text-emerald-400" : s.diff < 0 ? "text-rose-400" : "text-slate-400"
                }`}
              >
                {s.diff > 0 ? "+" : ""}
                {s.diff}
              </span>
              <span className="w-8 text-center text-sm font-black text-slate-50">{s.leaguePoints}</span>
            </div>
          );
        })}
      </Card>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {(Object.entries(ZONE_STYLES) as [PlayoffZone, (typeof ZONE_STYLES)[PlayoffZone]][]).map(
          ([zone, s]) => (
            <div key={zone} className="flex items-center gap-2 text-xs text-slate-400">
              <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: s.border }} />
              {s.label}
            </div>
          )
        )}
      </div>
    </div>
  );
}

function TablePredictionEditor() {
  const { state, currentUser, submitTablePrediction } = useApp();
  const locked = isSeasonLocked(state);
  const existing = state.tablePredictions.find((p) => p.userId === currentUser.id);

  const [order, setOrder] = useState<string[]>(
    existing?.order ?? state.teams.map((t) => t.id)
  );
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
  };

  const handleDrop = (targetIndex: number) => {
    if (dragIndex === null || dragIndex === targetIndex) return;
    const next = [...order];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(targetIndex, 0, moved);
    setOrder(next);
    setDragIndex(null);
  };

  if (locked) {
    const breakdown = computeTablePredictionScore(currentUser.id, state);
    if (!existing) {
      return (
        <Card className="p-6 text-center animate-fade-in">
          <Lock className="mx-auto mb-2 text-slate-500" size={24} />
          <p className="text-sm text-slate-400">
            העונה כבר התחילה ולא הגשת ניחוש טבלה מראש — אפשר לנסות שוב בעונה הבאה!
          </p>
        </Card>
      );
    }
    return (
      <div className="animate-fade-in">
        <Card className="mb-4 p-3 text-center">
          <span className="text-sm text-slate-300">הניחוש שלך ננעל עם תחילת העונה</span>
          <div className="mt-1 text-lg font-black text-sand-light">
            {breakdown.total} נק&apos; עד כה (+5 לכל קבוצה שבמיקום המדויק)
          </div>
        </Card>
        <Card className="divide-y divide-slate-border/60 overflow-hidden">
          {order.map((teamId, i) => {
            const team = state.teams.find((t) => t.id === teamId)!;
            const correct = breakdown.correctSlots[i];
            return (
              <div key={teamId} className="flex items-center gap-3 px-3 py-2.5">
                <span className="w-6 text-center text-sm font-bold text-slate-400">{i + 1}</span>
                <span className="flex-1 text-sm font-semibold text-slate-100">
                  {team.emoji} {team.name}
                </span>
                <Badge tone={correct ? "green" : "default"}>{correct ? "בול!" : "—"}</Badge>
              </div>
            );
          })}
        </Card>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <Card className="mb-4 p-3 text-center text-sm text-slate-300">
        סדר את 12 הקבוצות מהמקום הראשון עד האחרון בעזרת הגרירה או החצים. +5 נק&apos; על כל קבוצה במיקום המדויק
        בסיום העונה הסדירה.
      </Card>
      <Card className="divide-y divide-slate-border/60 overflow-hidden">
        {order.map((teamId, i) => {
          const team = state.teams.find((t) => t.id === teamId)!;
          return (
            <div
              key={teamId}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(i)}
              className="flex items-center gap-3 px-3 py-2.5"
            >
              <GripVertical size={16} className="shrink-0 cursor-grab text-slate-600" />
              <span className="w-6 text-center text-sm font-bold text-slate-400">{i + 1}</span>
              <span className="flex-1 text-sm font-semibold text-slate-100">
                {team.emoji} {team.name}
              </span>
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="rounded-lg bg-slate-800 p-1.5 text-slate-300 transition hover:text-sand-light disabled:opacity-30"
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === order.length - 1}
                  className="rounded-lg bg-slate-800 p-1.5 text-slate-300 transition hover:text-sand-light disabled:opacity-30"
                >
                  <ChevronDown size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </Card>
      <PrimaryButton onClick={() => submitTablePrediction(order)} className="mt-4 w-full">
        {existing ? "עדכן ניחוש טבלה" : "שמור ניחוש טבלה"}
      </PrimaryButton>
    </div>
  );
}

export function SeasonTableTab() {
  const [view, setView] = useState<"live" | "predict">("live");

  return (
    <div className="animate-fade-in">
      <SectionTitle
        title="טבלת העונה"
        subtitle="טבלת הליגה החיה וניחוש מיקומי הסיום מראש"
        icon={<Table2 size={20} />}
      />

      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setView("live")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition ${
            view === "live"
              ? "bg-gradient-to-l from-ocean to-ocean-light text-slate-900"
              : "bg-slate-800/60 text-slate-300 hover:bg-slate-800"
          }`}
        >
          <Table2 size={14} /> טבלה חיה
        </button>
        <button
          onClick={() => setView("predict")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition ${
            view === "predict"
              ? "bg-gradient-to-l from-sand to-sand-light text-slate-900"
              : "bg-slate-800/60 text-slate-300 hover:bg-slate-800"
          }`}
        >
          <ListOrdered size={14} /> ניחוש הטבלה שלי
        </button>
      </div>

      {view === "live" ? <LiveStandings /> : <TablePredictionEditor />}
    </div>
  );
}
