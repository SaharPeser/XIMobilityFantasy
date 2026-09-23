"use client";

import { useEffect, useState } from "react";

function format(msLeft: number) {
  if (msLeft <= 0) return null;
  const totalSeconds = Math.floor(msLeft / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (days > 0) return `${days} ימים ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function CountdownTimer({
  startTime,
  onExpire,
}: {
  startTime: string;
  onExpire?: () => void;
}) {
  const target = new Date(startTime).getTime();
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (now >= target) onExpire?.();
  }, [now, target, onExpire]);

  const label = format(target - now);
  if (!label) return <span className="font-semibold text-rose-400">ננעל</span>;

  return (
    <span className="tabular-nums font-mono font-semibold text-ocean-light">
      {label}
    </span>
  );
}
