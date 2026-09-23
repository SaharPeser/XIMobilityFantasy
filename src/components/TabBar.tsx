"use client";

import { BarChart3, ShieldAlert, Table2, Target, Trophy, Users2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type TabId = "predictions" | "dream4" | "table" | "leagues" | "leaderboard" | "admin";

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: "predictions", label: "הימורים", icon: Target },
  { id: "dream4", label: "הרביעייה שלי", icon: Users2 },
  { id: "table", label: "טבלת העונה", icon: Table2 },
  { id: "leagues", label: "הליגות שלי", icon: Trophy },
  { id: "leaderboard", label: "טבלת מובילים", icon: BarChart3 },
  { id: "admin", label: "ניהול", icon: ShieldAlert },
];

export function TabBar({
  active,
  onChange,
}: {
  active: TabId;
  onChange: (id: TabId) => void;
}) {
  return (
    <nav className="sticky bottom-0 z-20 border-t border-slate-border bg-slate-dark/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl justify-between px-1">
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className="flex flex-1 flex-col items-center gap-0.5 py-2.5 transition"
            >
              <Icon
                size={20}
                className={isActive ? "text-sand" : "text-slate-500"}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span
                className={`text-[10px] font-semibold ${
                  isActive ? "text-sand-light" : "text-slate-500"
                }`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
