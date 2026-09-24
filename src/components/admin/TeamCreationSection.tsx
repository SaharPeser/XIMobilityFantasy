"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { Card, PrimaryButton } from "../ui";

const EMOJI_OPTIONS = ["🏐", "🦅", "🔥", "🏆", "🐙", "🌊", "🐝", "🕊️", "💎", "🇧🇷", "⚡", "🎨"];

export function TeamCreationSection() {
  const { adminCreateTeam } = useApp();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#F59E0B");
  const [emoji, setEmoji] = useState(EMOJI_OPTIONS[0]);
  const [players, setPlayers] = useState<[string, string, string]>(["", "", ""]);

  const canSave = name.trim().length > 0 && players.every((p) => p.trim().length > 0);

  const handleSave = () => {
    if (!canSave) return;
    adminCreateTeam(name.trim(), color, emoji, [
      players[0].trim(),
      players[1].trim(),
      players[2].trim(),
    ]);
    setName("");
    setPlayers(["", "", ""]);
  };

  return (
    <Card className="p-4">
      <p className="mb-3 text-sm font-bold text-slate-100">יצירת קבוצה חדשה</p>

      <div className="mb-3 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="שם הקבוצה"
          className="min-w-0 flex-1 rounded-lg border border-slate-border bg-slate-900/70 px-3 py-2 text-sm text-slate-50 outline-none focus:border-sand"
        />
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          aria-label="צבע הקבוצה"
          className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-slate-border bg-slate-900/70"
        />
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {EMOJI_OPTIONS.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => setEmoji(e)}
            className={`flex h-9 w-9 items-center justify-center rounded-lg border text-lg transition ${
              emoji === e ? "border-sand bg-sand/15" : "border-slate-border bg-slate-900/50"
            }`}
          >
            {e}
          </button>
        ))}
      </div>

      <p className="mb-2 text-xs font-semibold text-slate-400">3 שחקנים (שם בלבד)</p>
      <div className="mb-3 space-y-2">
        {players.map((p, i) => (
          <input
            key={i}
            value={p}
            onChange={(e) =>
              setPlayers((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)) as typeof prev)
            }
            placeholder={`שחקן ${i + 1}`}
            className="w-full rounded-lg border border-slate-border bg-slate-900/70 px-3 py-2 text-sm text-slate-50 outline-none focus:border-sand"
          />
        ))}
      </div>

      <PrimaryButton onClick={handleSave} disabled={!canSave} className="w-full">
        <span className="flex items-center justify-center gap-1.5">
          <UserPlus size={14} /> צור קבוצה
        </span>
      </PrimaryButton>
    </Card>
  );
}
