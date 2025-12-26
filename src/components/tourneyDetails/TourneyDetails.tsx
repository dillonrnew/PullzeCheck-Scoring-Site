// src/components/tourneyDetails/TourneyDetails.tsx
import { useEffect, useMemo, useState } from "react";
import type { TourneyCardTourney } from "../TourneyCard";
import { supabase } from "../../supabaseClient";
import type { TabKey } from "./types";
import { coerceSingle } from "./utils";
import { pill, tabStyle } from "./ui";

import ParticipantsPanel from "./panels/ParticipantsPanel";
import LeaderboardPanel from "./panels/LeaderboardPanel";
import SubmitScoresPanel from "./panels/SubmitScoresPanel";
import DetailsPanel from "./panels/DetailsPanel";

type Props = {
  tourney: TourneyCardTourney;
  onBack: () => void;
};

export default function TourneyDetails({ tourney, onBack }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("details");

  const fallbackImage =
    "https://pbs.twimg.com/media/G8QePF8WMAglc6h?format=jpg&name=large";
  const imageSrc = tourney.image || fallbackImage;

  const start = tourney.start_time ? new Date(tourney.start_time) : null;

  const startPretty = useMemo(() => {
    if (!start) return "TBD";
    return `${start.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    })} • ${start.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  }, [tourney.start_time]);

  const prizePool =
    tourney.prize_pool === undefined ||
    tourney.prize_pool === null ||
    tourney.prize_pool === ""
      ? "TBD"
      : typeof tourney.prize_pool === "number"
      ? `$${tourney.prize_pool.toLocaleString()}`
      : String(tourney.prize_pool);

  const signed = tourney.teams_signed_up ?? 0;
  const possible = tourney.teams_possible ?? "TBD";
  const status = tourney.status ?? "unknown";

  /* ==================== SUBMIT SCORES ELIGIBILITY ==================== */

  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [viewerTeamId, setViewerTeamId] = useState<string | null>(null);
  const [viewerTeamName, setViewerTeamName] = useState<string | null>(null);
  const [submitEligibilityLoading, setSubmitEligibilityLoading] = useState(true);

  const canSubmitScores = !!viewerUserId && !!viewerTeamId;

  const detectViewerTeam = async () => {
    setSubmitEligibilityLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData?.user?.id ?? null;
      setViewerUserId(uid);

      if (!uid) {
        setViewerTeamId(null);
        setViewerTeamName(null);
        return;
      }

      const { data: regs, error } = await supabase
        .from("tourney_registrations")
        .select(
          `
          id,
          confirmed,
          team:"Established Teams" (
            "UUID",
            "Team Name",
            "Player 1",
            "Player 2",
            "Player 3"
          )
        `
        )
        .eq("tourney_id", tourney.id)
        .eq("confirmed", true);

      if (error) throw error;

      const match = (((regs as any) ?? []) as any[]).find((r) => {
        const team = coerceSingle(r.team) as any;
        if (!team) return false;
        return team["Player 1"] === uid || team["Player 2"] === uid || team["Player 3"] === uid;
      });

      const team = match ? (coerceSingle(match.team) as any) : null;
      setViewerTeamId(team?.UUID ?? null);
      setViewerTeamName(team?.["Team Name"] ?? null);
    } catch (e) {
      console.error("detectViewerTeam error:", e);
      setViewerTeamId(null);
      setViewerTeamName(null);
    } finally {
      setSubmitEligibilityLoading(false);
    }
  };

  useEffect(() => {
    detectViewerTeam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourney.id]);

  useEffect(() => {
    if (activeTab === "submit" && !submitEligibilityLoading && !canSubmitScores) {
      setActiveTab("details");
    }
  }, [activeTab, submitEligibilityLoading, canSubmitScores]);

  /* ==================== Render ==================== */

  return (
    <div style={{ width: "100%", height: "100%" }}>
      {/* HERO */}
      <div
        style={{
          position: "relative",
          width: "100%",
          backgroundColor: "#0f1325",
          borderBottom: "1px solid rgba(255,255,255,0.12)",
        }}
      >
        <img
          src={imageSrc}
          alt={tourney.title}
          style={{ width: "100%", height: 360, objectFit: "cover", display: "block" }}
        />

        <button
          type="button"
          onClick={onBack}
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.2)",
            background: "#14182d",
            color: "#fff",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          ← Back
        </button>

        <div style={{ position: "absolute", left: 24, bottom: 20, right: 24 }}>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 900, lineHeight: 1.1 }}>{tourney.title}</h1>

          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <span style={pill("#6e8efb")}>Status: {status}</span>
            <span style={pill("#a777e4")}>
              Teams: {signed} / {possible}
            </span>
            <span style={pill("#1e223d")}>Start: {startPretty}</span>
            <span style={pill("#1e223d")}>Prize: {prizePool}</span>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div
        style={{
          display: "flex",
          gap: 12,
          padding: "16px 20px",
          borderBottom: "1px solid rgba(255,255,255,0.12)",
          background: "#0f1325",
          flexWrap: "wrap",
        }}
      >
        <button style={tabStyle(activeTab, "participants")} onClick={() => setActiveTab("participants")}>
          Participants
        </button>
        <button style={tabStyle(activeTab, "leaderboard")} onClick={() => setActiveTab("leaderboard")}>
          Leaderboard
        </button>

        {!submitEligibilityLoading && canSubmitScores && (
          <button style={tabStyle(activeTab, "submit")} onClick={() => setActiveTab("submit")}>
            Submit Scores
          </button>
        )}

        <button style={tabStyle(activeTab, "details")} onClick={() => setActiveTab("details")}>
          Details
        </button>
      </div>

      {/* TAB CONTENT */}
      <div style={{ padding: 24, background: "#0f1325", minHeight: "calc(100vh - 520px)" }}>
        {activeTab === "participants" && <ParticipantsPanel tourneyId={tourney.id} />}
        {activeTab === "leaderboard" && <LeaderboardPanel tourneyId={tourney.id} />}
        {activeTab === "submit" && viewerTeamId && (
          <SubmitScoresPanel tourneyId={tourney.id} teamId={viewerTeamId} teamName={viewerTeamName} />
        )}
        {activeTab === "details" && <DetailsPanel tourney={tourney} />}
      </div>
    </div>
  );
}
