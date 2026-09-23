"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Shield, UserPlus } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { computeLeaderboard } from "@/lib/scoring";
import { Avatar, Badge, Card, GhostButton, PrimaryButton, SectionTitle } from "../ui";

function LeagueCard({ leagueId }: { leagueId: string }) {
  const { state, currentUser } = useApp();
  const league = state.leagues.find((l) => l.id === leagueId)!;
  const [copied, setCopied] = useState(false);

  const leaderboard = useMemo(
    () => computeLeaderboard(state, league.memberIds),
    [state, league.memberIds]
  );

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(league.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — ignore
    }
  };

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-50">{league.name}</h3>
          <p className="text-xs text-slate-500">{league.memberIds.length} חברים</p>
        </div>
        <button
          onClick={copyCode}
          className="flex items-center gap-1.5 rounded-lg border border-slate-border bg-slate-900/60 px-3 py-1.5 text-sm font-mono font-bold text-sand-light transition hover:border-sand/50"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {league.code}
        </button>
      </div>

      <div className="space-y-1.5">
        {leaderboard.map((entry, i) => {
          const user = state.users.find((u) => u.id === entry.userId)!;
          const isMe = user.id === currentUser.id;
          return (
            <div
              key={entry.userId}
              className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${
                isMe ? "bg-sand/10" : ""
              }`}
            >
              <span className="w-5 text-center text-xs font-bold text-slate-500">{i + 1}</span>
              <Avatar name={user.name} color={user.avatarColor} size={28} />
              <span className={`flex-1 text-sm ${isMe ? "font-bold text-sand-light" : "text-slate-200"}`}>
                {user.name}
              </span>
              <span className="text-sm font-black text-slate-50">{entry.total}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function LeaguesTab() {
  const { state, currentUser, createLeague, joinLeague } = useApp();
  const [newLeagueName, setNewLeagueName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState(false);

  const myLeagues = state.leagues.filter((l) => l.memberIds.includes(currentUser.id));

  const handleCreate = () => {
    if (!newLeagueName.trim()) return;
    createLeague(newLeagueName.trim());
    setNewLeagueName("");
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    const ok = await joinLeague(joinCode.trim());
    setJoinError(!ok);
    if (ok) setJoinCode("");
  };

  return (
    <div className="animate-fade-in">
      <SectionTitle
        title="הליגות הסגורות שלי"
        subtitle="תחרו מול חברים בליגה פרטית משלכם"
        icon={<Shield size={20} />}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <p className="mb-2 text-sm font-bold text-slate-200">צור ליגה חדשה</p>
          <div className="flex gap-2">
            <input
              value={newLeagueName}
              onChange={(e) => setNewLeagueName(e.target.value)}
              placeholder="שם הליגה"
              className="min-w-0 flex-1 rounded-lg border border-slate-border bg-slate-900/70 px-3 py-2 text-sm text-slate-50 outline-none focus:border-sand"
            />
            <PrimaryButton onClick={handleCreate}>צור</PrimaryButton>
          </div>
        </Card>

        <Card className="p-4">
          <p className="mb-2 text-sm font-bold text-slate-200">הצטרף עם קוד הזמנה</p>
          <div className="flex gap-2">
            <input
              value={joinCode}
              onChange={(e) => {
                setJoinCode(e.target.value.toUpperCase());
                setJoinError(false);
              }}
              placeholder="לדוגמה: AB12CD"
              maxLength={6}
              className="min-w-0 flex-1 rounded-lg border border-slate-border bg-slate-900/70 px-3 py-2 text-sm font-mono uppercase text-slate-50 outline-none focus:border-ocean"
            />
            <GhostButton onClick={handleJoin}>
              <span className="flex items-center gap-1">
                <UserPlus size={14} /> הצטרף
              </span>
            </GhostButton>
          </div>
          {joinError && <p className="mt-1 text-xs text-rose-400">קוד לא נמצא, נסה שוב</p>}
        </Card>
      </div>

      {myLeagues.length === 0 ? (
        <Card className="p-6 text-center text-sm text-slate-400">
          עדיין לא הצטרפת לאף ליגה. צור אחת או הצטרף עם קוד!
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {myLeagues.map((l) => (
            <LeagueCard key={l.id} leagueId={l.id} />
          ))}
        </div>
      )}

      <Badge tone="default">
        <span className="text-slate-400">
          כל ליגה שאתה יוצר מקבלת קוד הזמנה בן 6 תווים לשיתוף עם חברים
        </span>
      </Badge>
    </div>
  );
}
