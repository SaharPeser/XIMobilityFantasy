"use client";

import { ListOrdered } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { isTablePredictionsLocked } from "@/lib/scoring";

export function SeasonBanner({ onOpenTab }: { onOpenTab: () => void }) {
  const { state, currentUser } = useApp();

  if (isTablePredictionsLocked(state)) return null;
  const hasPrediction = state.tablePredictions.some((p) => p.userId === currentUser.id);
  if (hasPrediction) return null;

  return (
    <button
      onClick={onOpenTab}
      className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-sand/40 bg-gradient-to-l from-sand/15 to-ocean/10 p-4 text-right transition hover:border-sand/70"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sand/20 text-sand-light">
        <ListOrdered size={20} />
      </div>
      <div className="flex-1">
        <p className="text-sm font-bold text-slate-50">ניחוש טבלת העונה עדיין פתוח!</p>
        <p className="text-xs text-slate-400">
          סדר את 12 הקבוצות מהראשונה עד האחרונה וזכה ב-5 נק&apos; על כל מיקום מדויק
        </p>
      </div>
    </button>
  );
}
