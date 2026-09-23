import { Minus, Plus } from "lucide-react";
import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-border bg-slate-card/80 backdrop-blur-sm shadow-lg shadow-black/20 ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center gap-2">
      {icon && <span className="text-sand">{icon}</span>}
      <div>
        <h2 className="text-lg font-bold text-slate-50">{title}</h2>
        {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
      </div>
    </div>
  );
}

export function Badge({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "sand" | "ocean" | "green" | "red";
}) {
  const tones: Record<string, string> = {
    default: "bg-slate-700/60 text-slate-200",
    sand: "bg-sand/15 text-sand-light border border-sand/30",
    ocean: "bg-ocean/15 text-ocean-light border border-ocean/30",
    green: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
    red: "bg-rose-500/15 text-rose-400 border border-rose-500/30",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  className = "",
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl bg-gradient-to-l from-sand to-sand-light px-4 py-2.5 text-sm font-bold text-slate-900 shadow-md shadow-sand/20 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 ${className}`}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  disabled,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl border border-slate-border bg-slate-800/60 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-ocean/50 hover:text-ocean-light active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

export function NumberInput({
  value,
  onChange,
  disabled,
  ariaLabel,
  min = 0,
  max = 30,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  ariaLabel?: string;
  min?: number;
  max?: number;
}) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  const safeValue = Number.isFinite(value) ? value : 0;

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label={`${ariaLabel ?? "ערך"} הפחת`}
        disabled={disabled || safeValue <= min}
        onClick={() => onChange(clamp(safeValue - 1))}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-border bg-slate-800/80 text-slate-300 transition active:scale-90 disabled:cursor-not-allowed disabled:opacity-30"
      >
        <Minus size={16} />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        aria-label={ariaLabel}
        value={safeValue}
        disabled={disabled}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
        className="h-11 w-12 rounded-lg border border-slate-border bg-slate-900/70 text-center text-lg font-bold text-slate-50 outline-none focus:border-sand disabled:opacity-50"
      />
      <button
        type="button"
        aria-label={`${ariaLabel ?? "ערך"} הוסף`}
        disabled={disabled || safeValue >= max}
        onClick={() => onChange(clamp(safeValue + 1))}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-border bg-slate-800/80 text-slate-300 transition active:scale-90 disabled:cursor-not-allowed disabled:opacity-30"
      >
        <Plus size={16} />
      </button>
    </div>
  );
}

export function Avatar({ name, color, size = 36 }: { name: string; color: string; size?: number }) {
  const initial = name.trim().charAt(0);
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-slate-900"
      style={{ backgroundColor: color, width: size, height: size, fontSize: size * 0.42 }}
    >
      {initial}
    </div>
  );
}
