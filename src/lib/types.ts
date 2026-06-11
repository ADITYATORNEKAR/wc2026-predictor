export type Stage = "Group" | "R32" | "R16" | "QF" | "SF" | "3rd" | "Final";

export interface Match {
  id: string;
  homeTeam: string;
  awayTeam: string;
  group: string;
  matchDate: string; // ISO string
  stage: Stage;
  actualHome?: number;
  actualAway?: number;
  homeTeamPlaceholder?: string;
  awayTeamPlaceholder?: string;
}

export interface Prediction {
  id: string;
  userName: string;
  matchId: string;
  prediction: "home" | "draw" | "away";
  points?: number;
  submittedAt: string;
}

export interface User {
  name: string;
  totalPoints: number;
  predictions: Prediction[];
}
