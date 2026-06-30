import { NextResponse } from "next/server";
import { MATCHES } from "@/lib/matches";
import { KNOCKOUT_MATCHES } from "@/lib/knockout-matches";
import { getMatchResultsMap, recalculatePoints } from "@/lib/sheets";

const ALL_MATCHES = [...MATCHES, ...KNOCKOUT_MATCHES];
const THROTTLE_MS = 2500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST() {
  // Auth temporarily disabled
  try {
    const results = await getMatchResultsMap();

    const recalculated: string[] = [];
    const errors: string[] = [];

    for (const match of ALL_MATCHES) {
      const result = results[match.id];
      const hasResult = result && result.home !== "" && !Number.isNaN(Number(result.home));

      if (!hasResult) continue;

      try {
        await recalculatePoints(match.id);
        recalculated.push(match.id);
      } catch (error) {
        errors.push(
          `Failed to recalculate ${match.id}: ${error instanceof Error ? error.message : String(error)}`
        );
      }

      await sleep(THROTTLE_MS);
    }

    return NextResponse.json({ recalculated, errors });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to force-recalculate" },
      { status: 500 }
    );
  }
}
