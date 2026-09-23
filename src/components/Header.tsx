"use client";

import { Waves } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { Avatar } from "./ui";

export function Header() {
  const { state, currentUser, setCurrentUser } = useApp();

  return (
    <header className="sticky top-0 z-20 border-b border-slate-border bg-slate-dark/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sand to-ocean text-slate-900">
            <Waves size={20} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-base font-black leading-tight text-slate-50">פוצ&apos;יוולי</h1>
            <p className="text-[11px] leading-tight text-slate-400">הימורים · פנטזי · ליגות</p>
          </div>
        </div>

        <label className="flex items-center gap-2 rounded-full border border-slate-border bg-slate-800/60 py-1 pl-3 pr-1.5">
          <Avatar name={currentUser.name} color={currentUser.avatarColor} size={26} />
          <select
            value={currentUser.id}
            onChange={(e) => setCurrentUser(e.target.value)}
            className="bg-transparent text-sm font-semibold text-slate-100 outline-none"
          >
            {state.users.map((u) => (
              <option key={u.id} value={u.id} className="bg-slate-800 text-slate-100">
                {u.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </header>
  );
}
