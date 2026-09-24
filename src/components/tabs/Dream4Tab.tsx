"use client";

import { useMemo, useState } from "react";
import { Star, Users2 } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { computeDream4PickPoints, computePlayerRoundPoints, isFantasyRoundLocked } from "@/lib/scoring";
import type { Player } from "@/lib/types";
import { Badge, Card, PrimaryButton, SectionTitle } from "../ui";

function PlayerPickCard({
  player,
  selected,
  isCaptain,
  disabled,
  onToggle,
  onCaptain,
  points,
}: {
  player: Player;
  selected: boolean;
  isCaptain: boolean;
  disabled: boolean;
  onToggle: () => void;
  onCaptain: () => void;
  points?: number;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-xl border p-3 transition ${
        selected
          ? "border-sand bg-sand/10"
          : "border-slate-border bg-slate-900/50"
      } ${disabled ? "opacity-60" : ""}`}
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className="flex flex-1 items-center gap-3 text-right disabled:cursor-not-allowed"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-slate-300">
          {player.number}
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-slate-50">{player.name}</p>
        </div>
        {typeof points === "number" && (
          <Badge tone={points > 0 ? "green" : "default"}>{points} נק&apos;</Badge>
        )}
      </button>
      {selected && (
        <button
          type="button"
          onClick={onCaptain}
          disabled={disabled}
          title="בחר כקפטן"
          className={`shrink-0 rounded-full p-2 transition ${
            isCaptain ? "bg-sand text-slate-900" : "bg-slate-800 text-slate-400 hover:text-sand-light"
          }`}
        >
          <Star size={16} fill={isCaptain ? "currentColor" : "none"} />
        </button>
      )}
    </div>
  );
}

function Dream4RoundBoard({ round }: { round: number }) {
  const { state, currentUser, submitDream4 } = useApp();

  const roundMatches = state.matches.filter((m) => m.round === round);
  const roundLocked = isFantasyRoundLocked(round, state);
  const roundFinished = roundMatches.length > 0 && roundMatches.every((m) => m.status === "finished");

  const existingPick = state.dream4Picks.find(
    (p) => p.userId === currentUser.id && p.round === round
  );

  const [selected, setSelected] = useState<string[]>(existingPick?.playerIds ?? []);
  const [captain, setCaptain] = useState<string | null>(existingPick?.captainId ?? null);

  const toggle = (playerId: string) => {
    if (roundLocked) return;
    setSelected((prev) => {
      if (prev.includes(playerId)) {
        if (captain === playerId) setCaptain(null);
        return prev.filter((id) => id !== playerId);
      }
      if (prev.length >= 4) return prev;
      return [...prev, playerId];
    });
  };

  const canSave = selected.length === 4 && captain !== null;

  const handleSave = () => {
    if (!canSave || !captain) return;
    submitDream4(round, selected, captain);
  };

  const pickTotal = existingPick ? computeDream4PickPoints(existingPick, state).total : null;

  return (
    <>
      <Card className="mb-4 p-3 text-center text-sm">
        {roundLocked ? (
          <span className="font-semibold text-rose-400">המחזור ננעל לבחירה — לא ניתן לשנות</span>
        ) : (
          <span className="text-slate-300">
            נבחרו {selected.length}/4 שחקנים {captain && "• קפטן נבחר ⭐"}
          </span>
        )}
        {roundFinished && pickTotal !== null && (
          <div className="mt-1 text-lg font-black text-sand-light">סה&quot;כ נקודות: {pickTotal}</div>
        )}
      </Card>

      <div className="space-y-4">
        {state.teams.map((team) => (
          <div key={team.id}>
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xl">{team.emoji}</span>
              <span className="text-sm font-bold" style={{ color: team.color }}>
                {team.name}
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {state.players
                .filter((p) => p.teamId === team.id)
                .map((player) => {
                  const isSelected = selected.includes(player.id);
                  const roundPts = roundFinished
                    ? computePlayerRoundPoints(player, round, state).total
                    : undefined;
                  return (
                    <PlayerPickCard
                      key={player.id}
                      player={player}
                      selected={isSelected}
                      isCaptain={captain === player.id}
                      disabled={roundLocked || (!isSelected && selected.length >= 4)}
                      onToggle={() => toggle(player.id)}
                      onCaptain={() => setCaptain(player.id)}
                      points={roundPts}
                    />
                  );
                })}
            </div>
          </div>
        ))}
      </div>

      {!roundLocked && (
        <PrimaryButton onClick={handleSave} disabled={!canSave} className="mt-4 w-full">
          {existingPick ? "עדכן רביעייה" : "שמור רביעייה"}
        </PrimaryButton>
      )}
    </>
  );
}

export function Dream4Tab() {
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

  return (
    <div className="animate-fade-in">
      <SectionTitle
        title="רביעיית המחזור וקפטן"
        subtitle="בחר 4 שחקנים וקפטן שינקוד נקודות כפולות"
        icon={<Users2 size={20} />}
      />

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {rounds.map((r) => (
          <button
            key={r}
            onClick={() => setActiveRound(r)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${
              activeRound === r
                ? "bg-gradient-to-l from-ocean to-ocean-light text-slate-900"
                : "bg-slate-800/60 text-slate-300 hover:bg-slate-800"
            }`}
          >
            מחזור {r}
          </button>
        ))}
      </div>

      <Dream4RoundBoard key={activeRound} round={activeRound} />
    </div>
  );
}
