"use client";

import { useState } from "react";
import { AppProvider } from "@/context/AppContext";
import { Header } from "./Header";
import { TabBar, type TabId } from "./TabBar";
import { PredictionsTab } from "./tabs/PredictionsTab";
import { Dream4Tab } from "./tabs/Dream4Tab";
import { SeasonTableTab } from "./tabs/SeasonTableTab";
import { LeaguesTab } from "./tabs/LeaguesTab";
import { LeaderboardTab } from "./tabs/LeaderboardTab";
import { AdminTab } from "./tabs/AdminTab";
import { SeasonBanner } from "./SeasonBanner";

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
    case "leaderboard":
      return <LeaderboardTab />;
    case "admin":
      return <AdminTab />;
  }
}

export default function AppShell() {
  const [tab, setTab] = useState<TabId>("predictions");

  return (
    <AppProvider>
      <div className="flex min-h-screen flex-col bg-slate-dark">
        <Header />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5">
          <SeasonBanner onOpenTab={() => setTab("table")} />
          <TabContent tab={tab} />
        </main>
        <TabBar active={tab} onChange={setTab} />
      </div>
    </AppProvider>
  );
}
