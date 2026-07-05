import { NextResponse } from "next/server";
import { KNOCKOUT_MATCHES } from "@/lib/knockout-matches";
import { getMatchResultsMap } from "@/lib/sheets";
import { Stage } from "@/lib/types";

export const revalidate = 60;

type UnlockedRound = Stage;

function roundComplete(
  stage: Stage,
  results: Record<string, { home: string; away: string }>
): boolean {
  return KNOCKOUT_MATCHES.filter((m) => m.stage === stage).every((m) => {
    const r = results[m.id];
    return r && r.home !== "" && r.away !== "";
  });
}

export async function GET() {
  try {
    const results = await getMatchResultsMap();

    const r32Complete = roundComplete("R32", results);
    const r16Complete = roundComplete("R16", results);
    const qfComplete = roundComplete("QF", results);
    const sfComplete = roundComplete("SF", results);

    const unlockedRounds: UnlockedRound[] = ["R32"];
    if (r32Complete) unlockedRounds.push("R16");
    if (r16Complete) unlockedRounds.push("QF");
    if (qfComplete) unlockedRounds.push("SF");
    if (sfComplete) {
      unlockedRounds.push("Final");
      unlockedRounds.push("3rd");
    }

    return NextResponse.json({ r32Complete, r16Complete, qfComplete, sfComplete, unlockedRounds });
  } catch {
    return NextResponse.json({
      r32Complete: false,
      r16Complete: false,
      qfComplete: false,
      sfComplete: false,
      unlockedRounds: ["R32"] as UnlockedRound[],
    });
  }
}
