"use client";

import { useEffect, useState } from "react";
import { Match } from "@/lib/types";
import { TOP_SCORER_OPTIONS, ALL_WC_TEAMS } from "@/lib/special-picks";

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
  const [leagueCounts, setLeagueCounts] = useState<{ name: string; count: number }[]>([]);
  const [seedMessage, setSeedMessage] = useState<MatchStatus | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [topScorerWinner, setTopScorerWinner] = useState("");
  const [wcWinner, setWcWinner] = useState("");
  const [topScorerMessage, setTopScorerMessage] = useState<MatchStatus | null>(null);
  const [wcWinnerMessage, setWcWinnerMessage] = useState<MatchStatus | null>(null);
  const [submittingTopScorer, setSubmittingTopScorer] = useState(false);
  const [submittingWcWinner, setSubmittingWcWinner] = useState(false);
  const [topScorerLocked, setTopScorerLocked] = useState(false);
  const [lockMessage, setLockMessage] = useState<MatchStatus | null>(null);
  const [togglingLock, setTogglingLock] = useState(false);

  const loadLeagueCounts = async () => {
    try {
      const leaguesRes = await fetch("/api/leagues");
      const leagues: string[] = await leaguesRes.json();

      const counts = await Promise.all(
        leagues.map(async (league) => {
          try {
            const membersRes = await fetch(`/api/leagues/${encodeURIComponent(league)}/members`);
            const members = await membersRes.json();
            return { name: league, count: Array.isArray(members) ? members.length : 0 };
          } catch {
            return { name: league, count: 0 };
          }
        })
      );

      setLeagueCounts(counts);
    } catch {
      setLeagueCounts([]);
    }
  };

  useEffect(() => {
    if (!unlocked) return;

    fetch("/api/matches")
      .then((res) => res.json())
      .then(setMatches)
      .catch(() => setMatches([]));

    loadLeagueCounts();

    fetch("/api/special-predictions/status")
      .then((res) => res.json())
      .then((data) => setTopScorerLocked(!!data.topscorer_locked))
      .catch(() => setTopScorerLocked(false));
  }, [unlocked]);

  const handleToggleTopScorerLock = async () => {
    setTogglingLock(true);
    setLockMessage(null);

    try {
      const response = await fetch("/api/admin/lock-special", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "topscorer", locked: !topScorerLocked, adminKey }),
      });

      const data = await response.json();

      if (!response.ok) {
        setLockMessage({ type: "error", message: data.error ?? "Failed to update lock status" });
        return;
      }

      setTopScorerLocked(!topScorerLocked);
      setLockMessage({ type: "success", message: data.message });
    } catch {
      setLockMessage({ type: "error", message: "Failed to update lock status" });
    } finally {
      setTogglingLock(false);
    }
  };

  const handleSeedLeagues = async () => {
    setSeeding(true);
    setSeedMessage(null);

    try {
      const response = await fetch(`/api/admin/seed-leagues?adminKey=${encodeURIComponent(adminKey)}`);
      const data = await response.json();

      if (!response.ok) {
        setSeedMessage({ type: "error", message: data.error ?? "Failed to seed leagues" });
        return;
      }

      setSeedMessage({
        type: "success",
        message: data.skipped ? "Leagues already seeded" : `✅ Seeded ${data.seeded} leagues`,
      });

      await loadLeagueCounts();
    } catch {
      setSeedMessage({ type: "error", message: "Failed to seed leagues" });
    } finally {
      setSeeding(false);
    }
  };

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

  const handleSetSpecialResult = async (
    type: "topscorer" | "wcwinner",
    correctAnswer: string,
    setSubmitting: (value: boolean) => void,
    setMessage: (value: MatchStatus | null) => void
  ) => {
    if (!correctAnswer) return;

    setSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/special-result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, correctAnswer, adminKey }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage({ type: "error", message: data.error ?? "Failed to set result" });
        return;
      }

      setMessage({ type: "success", message: `✅ Scored ${data.updated} prediction${data.updated === 1 ? "" : "s"}` });
    } catch {
      setMessage({ type: "error", message: "Failed to set result" });
    } finally {
      setSubmitting(false);
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

      <div style={{ border: "1px solid #00573F", background: "#002820", padding: 12, marginBottom: 12, borderRadius: 8 }}>
        <h2 style={{ color: "#FFD700", marginTop: 0 }}>Team Leagues</h2>
        <button onClick={handleSeedLeagues} disabled={seeding} style={{ ...buttonStyle, marginBottom: 8 }}>
          {seeding ? "Seeding..." : "Seed Leagues"}
        </button>
        {seedMessage && (
          <p style={{ color: seedMessage.type === "success" ? "#00A651" : "#ff6b6b" }}>
            {seedMessage.message}
          </p>
        )}
        {leagueCounts.length > 0 && (
          <ul style={{ marginTop: 8 }}>
            {leagueCounts.map((league) => (
              <li key={league.name}>
                {league.name}: {league.count} member{league.count === 1 ? "" : "s"}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ border: "1px solid #00573F", background: "#002820", padding: 12, marginBottom: 12, borderRadius: 8 }}>
        <h2 style={{ color: "#FFD700", marginTop: 0 }}>Lock Controls</h2>
        <p style={{ marginBottom: 8 }}>
          Top Scorer picks are currently{" "}
          <strong style={{ color: topScorerLocked ? "#ff6b6b" : "#00A651" }}>
            {topScorerLocked ? "LOCKED" : "UNLOCKED"}
          </strong>
        </p>
        <button onClick={handleToggleTopScorerLock} disabled={togglingLock} style={buttonStyle}>
          {togglingLock
            ? "Saving..."
            : topScorerLocked
              ? "🔓 Unlock Top Scorer Picks"
              : "🔒 Lock Top Scorer Picks"}
        </button>
        {lockMessage && (
          <p style={{ color: lockMessage.type === "success" ? "#00A651" : "#ff6b6b" }}>
            {lockMessage.message}
          </p>
        )}
      </div>

      <div style={{ border: "1px solid #00573F", background: "#002820", padding: 12, marginBottom: 12, borderRadius: 8 }}>
        <h2 style={{ color: "#FFD700", marginTop: 0 }}>Set Special Results</h2>

        <div style={{ marginBottom: 12 }}>
          <h3 style={{ marginBottom: 4 }}>Golden Boot Winner</h3>
          <select
            value={topScorerWinner}
            onChange={(e) => setTopScorerWinner(e.target.value)}
            style={{ ...inputStyle, marginRight: 8 }}
          >
            <option value="">Select player...</option>
            {TOP_SCORER_OPTIONS.map((player) => (
              <option key={player.id} value={player.id}>
                {player.flag} {player.name} ({player.team})
              </option>
            ))}
          </select>
          <button
            onClick={() =>
              handleSetSpecialResult("topscorer", topScorerWinner, setSubmittingTopScorer, setTopScorerMessage)
            }
            disabled={!topScorerWinner || submittingTopScorer}
            style={buttonStyle}
          >
            {submittingTopScorer ? "Saving..." : "Submit"}
          </button>
          {topScorerMessage && (
            <p style={{ color: topScorerMessage.type === "success" ? "#00A651" : "#ff6b6b" }}>
              {topScorerMessage.message}
            </p>
          )}
        </div>

        <div>
          <h3 style={{ marginBottom: 4 }}>World Cup Winner</h3>
          <select
            value={wcWinner}
            onChange={(e) => setWcWinner(e.target.value)}
            style={{ ...inputStyle, marginRight: 8 }}
          >
            <option value="">Select team...</option>
            {ALL_WC_TEAMS.map((team) => (
              <option key={team} value={team}>
                {team}
              </option>
            ))}
          </select>
          <button
            onClick={() => handleSetSpecialResult("wcwinner", wcWinner, setSubmittingWcWinner, setWcWinnerMessage)}
            disabled={!wcWinner || submittingWcWinner}
            style={buttonStyle}
          >
            {submittingWcWinner ? "Saving..." : "Submit"}
          </button>
          {wcWinnerMessage && (
            <p style={{ color: wcWinnerMessage.type === "success" ? "#00A651" : "#ff6b6b" }}>
              {wcWinnerMessage.message}
            </p>
          )}
        </div>
      </div>

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
