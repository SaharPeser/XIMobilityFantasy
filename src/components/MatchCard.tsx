"use client";

import { useState } from "react";
import { Lock, Trophy, CheckCircle2 } from "lucide-react";
import { useApp } from "@/context/AppContext";
import type { Match, SetScore } from "@/lib/types";
import { computePredictionScore, getMatchWinnerTeamId, isMatchLocked } from "@/lib/scoring";
import { Badge, Card, NumberInput, PrimaryButton } from "./ui";
import { CountdownTimer } from "./CountdownTimer";

function TeamBlock({
  emoji,
  name,
  color,
  winner,
}: {
  emoji: string;
  name: string;
  color: string;
  winner?: boolean;
}) {
  return (
    <div
      className={`flex flex-1 flex-col items-center gap-1 text-center ${
        winner ? "opacity-100" : ""
      }`}
    >
      <div
        className="flex h-14 w-14 items-center justify-center rounded-2xl text-2xl"
        style={{ backgroundColor: `${color}22`, border: `1px solid ${color}55` }}
      >
        {emoji}
      </div>
      <span className={`text-sm font-bold ${winner ? "text-sand-light" : "text-slate-100"}`}>
        {name}
      </span>
      {winner && <Trophy size={14} className="text-sand-light" />}
    </div>
  );
}

export function MatchCard({ match }: { match: Match }) {
  const { state, currentUser, submitPrediction } = useApp();
  const teamA = state.teams.find((t) => t.id === match.teamAId)!;
  const teamB = state.teams.find((t) => t.id === match.teamBId)!;

  const myPrediction = state.predictions.find(
    (p) => p.userId === currentUser.id && p.matchId === match.id
  );

  const [expired, setExpired] = useState(false);
  const locked = isMatchLocked(match) || expired;

  const [winner, setWinner] = useState<string | null>(myPrediction?.winnerTeamId ?? null);
  const [set, setSetScore] = useState<SetScore>(myPrediction?.set ?? { a: 18, b: 14 });

  const canSave = winner !== null;

  const handleSave = () => {
    if (!winner) return;
    submitPrediction(match.id, winner, set);
  };

  const isFinished = match.status === "finished" && match.result;
  const winnerTeamId = isFinished ? getMatchWinnerTeamId(match, match.result!) : null;

  const breakdown = isFinished && myPrediction
    ? computePredictionScore(myPrediction, match)
    : null;

  const mvp = isFinished
    ? state.players.find((p) => p.id === match.result!.mvpPlayerId)
    : null;

  return (
    <Card className="p-4 animate-fade-in">
      <div className="mb-3 flex items-center justify-between">
        <Badge tone="ocean">מחזור {match.round}</Badge>
        {isFinished ? (
          <Badge tone="green">
            <CheckCircle2 size={12} /> הסתיים
          </Badge>
        ) : locked ? (
          <Badge tone="red">
            <Lock size={12} /> ננעל
          </Badge>
        ) : (
          <Badge tone="sand">
            <CountdownTimer startTime={match.startTime} onExpire={() => setExpired(true)} />
          </Badge>
        )}
      </div>

      <div className="mb-4 flex items-center gap-3">
        <TeamBlock
          emoji={teamA.emoji}
          name={teamA.name}
          color={teamA.color}
          winner={winnerTeamId === teamA.id}
        />
        <span className="text-sm font-black text-slate-500">VS</span>
        <TeamBlock
          emoji={teamB.emoji}
          name={teamB.name}
          color={teamB.color}
          winner={winnerTeamId === teamB.id}
        />
      </div>

      {isFinished && (
        <div className="mb-3 rounded-xl bg-slate-900/60 p-3 text-center">
          <span className="rounded-lg bg-slate-800 px-3 py-1 text-lg font-bold tabular-nums text-slate-50">
            {match.result!.set.a}-{match.result!.set.b}
          </span>
          {mvp && (
            <p className="mt-2 text-xs text-slate-400">
              MVP המשחק: <span className="font-semibold text-sand-light">{mvp.name}</span>
            </p>
          )}
        </div>
      )}

      {!isFinished && (
        <div className="mb-3 flex gap-2">
          <button
            onClick={() => !locked && setWinner(teamA.id)}
            disabled={locked}
            className={`flex-1 rounded-xl border py-2 text-sm font-bold transition disabled:opacity-50 ${
              winner === teamA.id
                ? "border-sand bg-sand/15 text-sand-light"
                : "border-slate-border bg-slate-900/50 text-slate-300"
            }`}
          >
            ניצחון {teamA.shortName}
          </button>
          <button
            onClick={() => !locked && setWinner(teamB.id)}
            disabled={locked}
            className={`flex-1 rounded-xl border py-2 text-sm font-bold transition disabled:opacity-50 ${
              winner === teamB.id
                ? "border-sand bg-sand/15 text-sand-light"
                : "border-slate-border bg-slate-900/50 text-slate-300"
            }`}
          >
            ניצחון {teamB.shortName}
          </button>
        </div>
      )}

      {!isFinished && (
        <div className="mb-3 space-y-2">
          <p className="text-center text-xs font-semibold text-slate-400">ניחוש תוצאה מדויקת (סט יחיד)</p>
          <div className="flex items-center justify-center gap-3">
            <NumberInput
              value={set.a}
              disabled={locked}
              ariaLabel={`${teamA.name} תוצאה`}
              onChange={(a) => setSetScore({ ...set, a })}
            />
            <span className="text-slate-500">-</span>
            <NumberInput
              value={set.b}
              disabled={locked}
              ariaLabel={`${teamB.name} תוצאה`}
              onChange={(b) => setSetScore({ ...set, b })}
            />
          </div>
        </div>
      )}

      {!isFinished && (
        <PrimaryButton onClick={handleSave} disabled={locked || !canSave} className="w-full">
          {myPrediction ? "עדכן ניחוש" : "שמור ניחוש"}
        </PrimaryButton>
      )}

      {myPrediction && !isFinished && (
        <p className="mt-2 text-center text-xs text-slate-500">
          הניחוש שלך: {state.teams.find((t) => t.id === myPrediction.winnerTeamId)?.shortName} לניצחון,{" "}
          {myPrediction.set.a}-{myPrediction.set.b}
        </p>
      )}

      {isFinished && myPrediction && breakdown && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 border-t border-slate-border pt-3">
          <span className="text-xs text-slate-500">הניחוש שלך זיכה אותך ב-</span>
          <Badge tone={breakdown.points > 0 ? "green" : "red"}>{breakdown.points} נק&apos;</Badge>
          {breakdown.exactScore && <Badge tone="sand">תוצאה מדויקת!</Badge>}
          {breakdown.diffBonus && <Badge tone="ocean">בונוס הפרש</Badge>}
        </div>
      )}

      {isFinished && !myPrediction && (
        <p className="text-center text-xs text-slate-500">לא הימרת על המשחק הזה</p>
      )}
    </Card>
  );
}
