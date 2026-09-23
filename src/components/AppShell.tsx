"use client";

import { useState } from "react";
import { AppProvider, useApp } from "@/context/AppContext";
import { Header } from "./Header";
import { TabBar, type TabId } from "./TabBar";
import { PredictionsTab } from "./tabs/PredictionsTab";
import { Dream4Tab } from "./tabs/Dream4Tab";
import { SeasonTableTab } from "./tabs/SeasonTableTab";
import { LeaguesTab } from "./tabs/LeaguesTab";
import { AdminTab } from "./tabs/AdminTab";
import { SeasonBanner } from "./SeasonBanner";
import { DisplayNameModal } from "./DisplayNameModal";

function TabContent({ tab }: { tab: TabId }) {
  switch (tab) {
    case "predictions":
      return <PredictionsTab />;
    case "dream4":
      return <Dream4Tab />;
    case "table":
      return <SeasonTableTab />;
    case "leagues":
      return <LeaguesTab />;
    case "admin":
      return <AdminTab />;
  }
}

function Shell() {
  const { currentUser, loading, needsDisplayName, updateDisplayName } = useApp();
  const [tab, setTab] = useState<TabId>("predictions");

  // Defends against a non-admin ending up on the admin tab (e.g. switching the
  // local-dev profile away from an admin while it's active) without mutating
  // state during render.
  const effectiveTab = tab === "admin" && !currentUser.isAdmin ? "predictions" : tab;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-dark">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-border border-t-sand" />
          <p className="text-sm text-slate-400">מתחבר ל-Supabase...</p>
        </div>
      </div>
    );
  }

  if (needsDisplayName) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-dark">
        <DisplayNameModal mode="onboarding" onSubmit={updateDisplayName} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-dark">
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5">
        <SeasonBanner onOpenTab={() => setTab("table")} />
        <TabContent tab={effectiveTab} />
      </main>
      <TabBar active={effectiveTab} onChange={setTab} isAdmin={!!currentUser.isAdmin} />
    </div>
  );
}

export default function AppShell() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
