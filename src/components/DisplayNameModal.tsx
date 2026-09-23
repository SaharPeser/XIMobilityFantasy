"use client";

import { useState } from "react";
import { Waves, X } from "lucide-react";
import { PrimaryButton } from "./ui";

export function DisplayNameModal({
  mode,
  initialName = "",
  onSubmit,
  onClose,
}: {
  mode: "onboarding" | "edit";
  initialName?: string;
  onSubmit: (name: string) => void;
  onClose?: () => void;
}) {
  const [name, setName] = useState(initialName);
  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && trimmed.length <= 40;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit(trimmed);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
      onClick={mode === "edit" ? onClose : undefined}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm animate-fade-in rounded-2xl border border-slate-border bg-slate-card p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sand to-ocean text-slate-900">
            <Waves size={22} strokeWidth={2.5} />
          </div>
          {mode === "edit" && onClose && (
            <button
              onClick={onClose}
              aria-label="סגור"
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <h2 className="mb-1 text-lg font-black text-slate-50">
          {mode === "onboarding" ? "ברוך הבא לפוצ'יוולי!" : "עריכת שם תצוגה"}
        </h2>
        <p className="mb-4 text-sm text-slate-400">
          {mode === "onboarding"
            ? "הזן את שמך כדי להתחיל לשחק — השם יופיע בטבלת המובילים ובליגות הפרטיות שלך"
            : "השם החדש יעודכן בכל מקום שבו הוא מופיע — טבלת מובילים, ליגות ורביעיות"}
        </p>

        <form onSubmit={handleSubmit}>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="השם שלך"
            maxLength={40}
            className="mb-4 w-full rounded-xl border border-slate-border bg-slate-900/70 px-4 py-3 text-base text-slate-50 outline-none focus:border-sand"
          />
          <PrimaryButton type="submit" disabled={!canSubmit} className="w-full">
            {mode === "onboarding" ? "בואו נתחיל" : "שמור שינויים"}
          </PrimaryButton>
        </form>
      </div>
    </div>
  );
}
