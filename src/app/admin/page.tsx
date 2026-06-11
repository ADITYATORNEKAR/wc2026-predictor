"use client";

import { useEffect, useState } from "react";
import { Match } from "@/lib/types";

interface ScoreInput {
  home: string;
  away: string;
}

interface MatchStatus {
  type: "success" | "error";
  message: string;
}

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [scores, setScores] = useState<Record<string, ScoreInput>>({});
  const [statuses, setStatuses] = useState<Record<string, MatchStatus>>({});
  const [submittingMatchId, setSubmittingMatchId] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<MatchStatus | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!unlocked) return;

    fetch("/api/matches")
      .then((res) => res.json())
      .then(setMatches)
      .catch(() => setMatches([]));
  }, [unlocked]);

  const getScoreInput = (matchId: string): ScoreInput => {
    return scores[matchId] ?? { home: "", away: "" };
  };

  const handleScoreChange = (matchId: string, field: "home" | "away", value: string) => {
    setScores((prev) => ({
      ...prev,
      [matchId]: {
        ...getScoreInput(matchId),
        [field]: value,
      },
    }));
  };

  const handleSubmit = async (matchId: string) => {
    const input = getScoreInput(matchId);
    const homeScore = Number(input.home);
    const awayScore = Number(input.away);

    if (
      input.home === "" ||
      input.away === "" ||
      !Number.isInteger(homeScore) ||
      !Number.isInteger(awayScore) ||
      homeScore < 0 ||
      homeScore > 20 ||
      awayScore < 0 ||
      awayScore > 20
    ) {
      setStatuses((prev) => ({
        ...prev,
        [matchId]: { type: "error", message: "Scores must be whole numbers between 0 and 20" },
      }));
      return;
    }

    setSubmittingMatchId(matchId);
    setStatuses((prev) => ({ ...prev, [matchId]: undefined as unknown as MatchStatus }));

    try {
      const response = await fetch("/api/admin/result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, homeScore, awayScore, adminKey }),
      });

      const data = await response.json();

      if (!response.ok) {
        setStatuses((prev) => ({
          ...prev,
          [matchId]: { type: "error", message: data.error ?? "Failed to set result" },
        }));
        return;
      }

      setStatuses((prev) => ({
        ...prev,
        [matchId]: { type: "success", message: data.message ?? "Result saved" },
      }));
    } catch {
      setStatuses((prev) => ({
        ...prev,
        [matchId]: { type: "error", message: "Failed to set result" },
      }));
    } finally {
      setSubmittingMatchId(null);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage(null);

    try {
      const response = await fetch("/api/sync-results");
      const data = await response.json();

      if (!response.ok) {
        setSyncMessage({
          type: "error",
          message: (data.errors ?? []).join(", ") || "Failed to sync results",
        });
        return;
      }

      const summary = `✅ Synced ${data.synced} match${data.synced === 1 ? "" : "es"}, recalculated points`;
      setSyncMessage({
        type: data.errors?.length ? "error" : "success",
        message: data.errors?.length ? `${summary} (errors: ${data.errors.join(", ")})` : summary,
      });
    } catch {
      setSyncMessage({ type: "error", message: "Failed to sync results from ESPN" });
    } finally {
      setSyncing(false);
    }
  };

  const inputStyle = {
    background: "#003B2B",
    color: "#FFFFFF",
    border: "1px solid #00573F",
    borderRadius: 4,
    padding: "4px 8px",
  };

  const buttonStyle = {
    background: "#00A651",
    color: "#FFFFFF",
    border: "none",
    borderRadius: 4,
    padding: "6px 16px",
    cursor: "pointer",
  };

  if (!unlocked) {
    return (
      <div style={{ maxWidth: 400, margin: "60px auto", padding: 16, background: "#003B2B", color: "#FFFFFF", minHeight: "100vh" }}>
        <h1 style={{ color: "#FFD700" }}>Admin Login</h1>
        <input
          type="password"
          placeholder="Admin key"
          value={adminKey}
          onChange={(e) => setAdminKey(e.target.value)}
          style={{ ...inputStyle, width: "100%", marginTop: 8, marginBottom: 8 }}
        />
        <button onClick={() => setUnlocked(true)} disabled={!adminKey} style={buttonStyle}>
          Enter
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: 16, background: "#003B2B", color: "#FFFFFF", minHeight: "100vh" }}>
      <h1 style={{ color: "#FFD700" }}>Admin: Set Match Results</h1>

      <button onClick={handleSync} disabled={syncing} style={{ ...buttonStyle, marginBottom: 8 }}>
        {syncing ? "Syncing..." : "🔄 Sync Results from ESPN"}
      </button>
      {syncMessage && (
        <p style={{ color: syncMessage.type === "success" ? "#00A651" : "#ff6b6b" }}>
          {syncMessage.message}
        </p>
      )}

      {matches.map((match) => {
        const input = getScoreInput(match.id);
        const status = statuses[match.id];

        return (
          <div key={match.id} style={{ border: "1px solid #00573F", background: "#002820", padding: 12, marginBottom: 12, borderRadius: 8 }}>
            <p>
              <strong>
                {match.homeTeam} vs {match.awayTeam}
              </strong>{" "}
              ({match.group ? `Group ${match.group}` : match.stage})
            </p>
            <label>
              Home Score:{" "}
              <input
                type="number"
                min={0}
                max={20}
                value={input.home}
                onChange={(e) => handleScoreChange(match.id, "home", e.target.value)}
                style={{ ...inputStyle, width: 60 }}
              />
            </label>{" "}
            <label>
              Away Score:{" "}
              <input
                type="number"
                min={0}
                max={20}
                value={input.away}
                onChange={(e) => handleScoreChange(match.id, "away", e.target.value)}
                style={{ ...inputStyle, width: 60 }}
              />
            </label>{" "}
            <button onClick={() => handleSubmit(match.id)} disabled={submittingMatchId === match.id} style={buttonStyle}>
              {submittingMatchId === match.id ? "Saving..." : "Submit"}
            </button>
            {status && (
              <p style={{ color: status.type === "success" ? "#00A651" : "#ff6b6b" }}>{status.message}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
