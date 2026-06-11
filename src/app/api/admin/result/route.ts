import { NextRequest, NextResponse } from "next/server";
import { setMatchResult, recalculatePoints } from "@/lib/sheets";

function isValidScore(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 20;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { matchId, homeScore, awayScore, adminKey } = body ?? {};

    if (typeof adminKey !== "string" || adminKey !== process.env.ADMIN_KEY) {
      return NextResponse.json({ error: "Invalid admin key" }, { status: 401 });
    }

    if (typeof matchId !== "string" || matchId.trim() === "") {
      return NextResponse.json({ error: "matchId is required" }, { status: 400 });
    }

    if (!isValidScore(homeScore)) {
      return NextResponse.json(
        { error: "homeScore must be an integer between 0 and 20" },
        { status: 400 }
      );
    }

    if (!isValidScore(awayScore)) {
      return NextResponse.json(
        { error: "awayScore must be an integer between 0 and 20" },
        { status: 400 }
      );
    }

    await setMatchResult(matchId, homeScore, awayScore);
    await recalculatePoints(matchId);

    return NextResponse.json({ success: true, message: "Result set and points recalculated" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to set match result" },
      { status: 500 }
    );
  }
}
