"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";
import type { RoundConfig } from "@/lib/types";
import { REGULAR_SEASON_ROUNDS } from "@/lib/types";
import { Card, PrimaryButton } from "../ui";

function toLocalInput(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): string {
  return value ? new Date(value).toISOString() : new Date().toISOString();
}

const DATE_INPUT_CLASS =
  "mt-1 w-full rounded-lg border border-slate-border bg-slate-900/70 px-2 py-1.5 text-sm text-slate-50 outline-none focus:border-sand";

function RoundRow({ round, existing }: { round: number; existing?: RoundConfig }) {
  const { adminSetRoundConfig } = useApp();
  const [date, setDate] = useState(toLocalInput(existing?.date));
  const [predictionsDeadline, setPredictionsDeadline] = useState(
    toLocalInput(existing?.predictionsDeadline)
  );
  const [fantasyDeadline, setFantasyDeadline] = useState(toLocalInput(existing?.fantasyDeadline));

  const handleSave = () => {
    adminSetRoundConfig({
      round,
      date: fromLocalInput(date),
      predictionsDeadline: fromLocalInput(predictionsDeadline || date),
      fantasyDeadline: fromLocalInput(fantasyDeadline || date),
    });
  };

  return (
    <Card className="p-4">
      <p className="mb-3 text-sm font-bold text-slate-100">מחזור {round}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs text-slate-400">
          תאריך המחזור
          <input
            type="datetime-local"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={DATE_INPUT_CLASS}
          />
        </label>
        <label className="text-xs text-slate-400">
          דדליין לניחושי תוצאות
          <input
            type="datetime-local"
            value={predictionsDeadline}
            onChange={(e) => setPredictionsDeadline(e.target.value)}
            className={DATE_INPUT_CLASS}
          />
        </label>
        <label className="text-xs text-slate-400">
          דדליין לרביעיית הפנטזי
          <input
            type="datetime-local"
            value={fantasyDeadline}
            onChange={(e) => setFantasyDeadline(e.target.value)}
            className={DATE_INPUT_CLASS}
          />
        </label>
      </div>
      <PrimaryButton onClick={handleSave} disabled={!date} className="mt-3">
        שמור מחזור {round}
      </PrimaryButton>
    </Card>
  );
}

export function RoundConfigSection() {
  const { state, adminSetSeasonTableDeadline } = useApp();
  const [seasonDeadline, setSeasonDeadline] = useState(toLocalInput(state.seasonTableDeadline));

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <p className="mb-2 text-sm font-bold text-slate-100">דדליין גלובלי לניחוש טבלת העונה</p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="datetime-local"
            value={seasonDeadline}
            onChange={(e) => setSeasonDeadline(e.target.value)}
            className="rounded-lg border border-slate-border bg-slate-900/70 px-2 py-1.5 text-sm text-slate-50 outline-none focus:border-sand"
          />
          <PrimaryButton
            onClick={() => adminSetSeasonTableDeadline(fromLocalInput(seasonDeadline))}
            disabled={!seasonDeadline}
          >
            שמור
          </PrimaryButton>
        </div>
      </Card>

      {Array.from({ length: REGULAR_SEASON_ROUNDS }, (_, i) => i + 1).map((round) => (
        <RoundRow key={round} round={round} existing={state.roundConfigs.find((r) => r.round === round)} />
      ))}
    </div>
  );
}
