"use client";

import dynamic from "next/dynamic";

const AppShell = dynamic(() => import("./AppShell"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center bg-slate-dark">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-border border-t-sand" />
        <p className="text-sm text-slate-400">טוען את פוצ&apos;יוולי...</p>
      </div>
    </div>
  ),
});

export default function AppShellLoader() {
  return <AppShell />;
}
