"use client";

import { useEffect, useState } from "react";
import Leaderboard from "@/components/Leaderboard";

interface LeaderboardEntry {
  name: string;
  points: number;
}

export default function TopLeaderboard() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((res) => res.json())
      .then(setLeaderboard)
      .catch(() => setLeaderboard([]));
  }, []);

  return <Leaderboard entries={leaderboard.slice(0, 3)} />;
}
