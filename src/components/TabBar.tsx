"use client";

import { ShieldAlert, Table2, Target, Trophy, Users2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type TabId = "predictions" | "dream4" | "leagues" | "table" | "admin";

const TABS: { id: TabId; label: string; icon: LucideIcon; adminOnly?: boolean }[] = [
  { id: "predictions", label: "הימורים", icon: Target },
  { id: "dream4", label: "הרביעייה שלי", icon: Users2 },
  { id: "leagues", label: "הליגות שלי", icon: Trophy },
  { id: "table", label: "טבלה", icon: Table2 },
  { id: "admin", label: "ניהול", icon: ShieldAlert, adminOnly: true },
];

export function TabBar({
  active,
  onChange,
  isAdmin,
}: {
  active: TabId;
  onChange: (id: TabId) => void;
  isAdmin: boolean;
}) {
  const visibleTabs = TABS.filter((t) => !t.adminOnly || isAdmin);

  return (
    <nav className="sticky bottom-0 z-20 border-t border-slate-border bg-slate-dark/95 backdrop-blur-md [padding-bottom:env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-5xl justify-between px-1">
        {visibleTabs.map(({ id, label, icon: Icon }) => {
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
