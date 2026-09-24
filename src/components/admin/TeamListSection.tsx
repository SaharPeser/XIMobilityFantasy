"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { LEAGUE_SIZE } from "@/lib/types";
import type { Team } from "@/lib/types";
import { Card, GhostButton, PrimaryButton } from "../ui";
import { EMOJI_OPTIONS } from "./teamOptions";

function TeamCard({ team }: { team: Team }) {
  const { state, adminUpdateTeam, adminDeleteTeam } = useApp();
  const teamPlayers = state.players.filter((p) => p.teamId === team.id);

  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [name, setName] = useState(team.name);
  const [color, setColor] = useState(team.color);
  const [emoji, setEmoji] = useState(team.emoji);
  const [playerNames, setPlayerNames] = useState(teamPlayers.map((p) => p.name));

  const canSave = name.trim().length > 0 && playerNames.every((p) => p.trim().length > 0);

  const handleSave = () => {
    if (!canSave) return;
    adminUpdateTeam(
      team.id,
      name.trim(),
      color,
      emoji,
      teamPlayers.map((p, i) => ({ id: p.id, name: playerNames[i].trim() }))
    );
    setEditing(false);
  };

  const handleCancelEdit = () => {
    setName(team.name);
    setColor(team.color);
    setEmoji(team.emoji);
    setPlayerNames(teamPlayers.map((p) => p.name));
    setEditing(false);
  };

  const handleDelete = async () => {
    const result = await adminDeleteTeam(team.id);
    if (!result.ok) {
      setDeleteError(result.reason ?? "שגיאה במחיקת הקבוצה");
      setConfirmDelete(false);
      return;
    }
  };

  if (editing) {
    return (
      <Card className="p-4">
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
        <div className="mb-3 space-y-2">
          {playerNames.map((p, i) => (
            <input
              key={teamPlayers[i]?.id ?? i}
              value={p}
              onChange={(e) =>
                setPlayerNames((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))
              }
              placeholder={`שחקן ${i + 1}`}
              className="w-full rounded-lg border border-slate-border bg-slate-900/70 px-3 py-2 text-sm text-slate-50 outline-none focus:border-sand"
            />
          ))}
        </div>
        <div className="flex gap-2">
          <PrimaryButton onClick={handleSave} disabled={!canSave} className="flex-1">
            שמור
          </PrimaryButton>
          <GhostButton onClick={handleCancelEdit}>ביטול</GhostButton>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg text-lg"
            style={{ backgroundColor: `${color}22`, border: `1px solid ${color}55` }}
          >
            {emoji}
          </div>
          <p className="text-sm font-bold text-slate-100">{name}</p>
        </div>
        <div className="flex gap-1.5">
          <GhostButton onClick={() => setEditing(true)}>
            <Pencil size={14} />
          </GhostButton>
          <GhostButton onClick={() => setConfirmDelete(true)}>
            <Trash2 size={14} />
          </GhostButton>
        </div>
      </div>

      <ul className="space-y-1 text-sm text-slate-300">
        {teamPlayers.map((p) => (
          <li key={p.id}>{p.name}</li>
        ))}
      </ul>

      {deleteError && <p className="mt-2 text-xs text-rose-400">{deleteError}</p>}

      {confirmDelete && (
        <div className="mt-3 flex items-center gap-2 border-t border-slate-border pt-3">
          <span className="text-xs text-slate-400">למחוק את הקבוצה?</span>
          <PrimaryButton onClick={handleDelete} className="!bg-rose-500 !from-rose-500 !to-rose-500">
            אישור מחיקה
          </PrimaryButton>
          <GhostButton onClick={() => setConfirmDelete(false)}>ביטול</GhostButton>
        </div>
      )}
    </Card>
  );
}

export function TeamListSection() {
  const { state } = useApp();

  return (
    <div className="mb-4">
      <p className="mb-3 text-sm font-bold text-slate-100">
        קבוצות ({state.teams.length} / {LEAGUE_SIZE})
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {state.teams.map((t) => (
          <TeamCard key={t.id} team={t} />
        ))}
      </div>
    </div>
  );
}
