// src/pages/HomePage.tsx
import { useEffect, useState } from "react";
import React from "react";
import { supabase } from "../supabaseClient";

import LeftSidebar from "../components/LeftSidebar";
import TourneyGrid from "../components/TourneyGrid";
import AdminDashboard from "../components/AdminDashboard";
import TopHomeBar from "../components/TopHomeBar";
import MyTeams from "../components/MyTeams";
import MyTournaments from "../components/MyTournaments";
import TourneyDetails from "../components/TourneyDetails";
import AdminTeamApprovals from "../components/AdminTeamApprovals";
import CreateTournamentForm from "../components/CreateTournamentForm";
import type { TourneyCardTourney } from "../components/TourneyCard";

export default function HomePage() {
  const [active, setActive] = useState<string>("tournaments");
  const [selectedTourney, setSelectedTourney] =
    useState<TourneyCardTourney | null>(null);

  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [adminLoaded, setAdminLoaded] = useState(false);

  // 🔐 Fetch admin flag once
  useEffect(() => {
    let alive = true;

    const loadAdmin = async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;

      if (!user) {
        if (alive) {
          setIsAdmin(false);
          setAdminLoaded(true);
        }
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      if (alive) {
        setIsAdmin(Boolean(data?.is_admin));
        setAdminLoaded(true);
      }
    };

    loadAdmin();
    return () => {
      alive = false;
    };
  }, []);

  // 🚫 Block rendering admin pages until admin state is known
  if (!adminLoaded) {
    return <div style={{ padding: 20 }}>Loading…</div>;
  }

  const adminOnly = (node: React.ReactNode) =>
    isAdmin ? node : <div style={{ padding: 20 }}>Access denied.</div>;

  const contentMap: Record<string, React.ReactNode> = {
    tournaments: (
      <TourneyGrid
        onViewTourney={(t) => {
          setSelectedTourney(t);
          setActive("tourney-details");
        }}
      />
    ),

    "tourney-details": selectedTourney ? (
      <TourneyDetails
        tourney={selectedTourney}
        onBack={() => setActive("tournaments")}
      />
    ) : (
      <div style={{ padding: 20 }}>No tournament selected.</div>
    ),

    "my-teams": <MyTeams />,
    "my-tournaments": <MyTournaments />,

    // 🔐 ADMIN-ONLY
    "admin-submissions": adminOnly(<AdminDashboard />),
    "admin-create-tourney": adminOnly(<CreateTournamentForm />),
    "admin-team-approvals": adminOnly(<AdminTeamApprovals />),
  };

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <LeftSidebar
        activeItemId={active}
        onSelect={(item) => setActive(item.id)}
        isAdmin={isAdmin} // 👈 optional, see below
      />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <TopHomeBar />

        <div style={{ flex: 1, padding: "20px", overflowY: "auto" }}>
          {contentMap[active] ?? <div>Select a page</div>}
        </div>
      </div>
    </div>
  );
}
