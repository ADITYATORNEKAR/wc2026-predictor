export type Stage = "Group" | "R16" | "QF" | "SF" | "Final";

export interface Match {
  id: string;
  homeTeam: string;
  awayTeam: string;
  group: string;
  matchDate: string; // ISO string
  stage: Stage;
  actualHome?: number;
  actualAway?: number;
}

export interface Prediction {
  id: string;
  userName: string;
  matchId: string;
  predictedHome: number;
  predictedAway: number;
  points?: number;
  submittedAt: string;
}

export interface User {
  name: string;
  totalPoints: number;
  predictions: Prediction[];
}
