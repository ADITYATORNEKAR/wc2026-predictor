import { NextRequest, NextResponse } from "next/server";
import { getPredictions, upsertPrediction } from "@/lib/sheets";
import { MATCHES } from "@/lib/matches";
import { KNOCKOUT_MATCHES } from "@/lib/knockout-matches";
import { hasMatchStarted } from "@/lib/dateUtils";

export async function GET(request: NextRequest) {
  try {
    const userName = request.nextUrl.searchParams.get("userName");
    const predictions = await getPredictions();

    if (userName) {
      return NextResponse.json(predictions.filter((p) => p.userName === userName));
    }

    return NextResponse.json(predictions);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch predictions" },
      { status: 500 }
    );
  }
}

function isValidPrediction(value: unknown): value is "home" | "draw" | "away" {
  return value === "home" || value === "draw" || value === "away";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userName, userEmail, matchId, prediction } = body ?? {};

    if (typeof userEmail !== "string" || !userEmail.toLowerCase().endsWith("@citizensbank.com")) {
      return NextResponse.json({ error: "Unauthorized email domain" }, { status: 403 });
    }

    const resolvedUserName =
      typeof userName === "string" && userName.trim() !== "" ? userName.trim() : userEmail.split("@")[0];

    if (!isValidPrediction(prediction)) {
      return NextResponse.json(
        { error: "prediction must be one of: home, draw, away" },
        { status: 400 }
      );
    }

    if (typeof matchId !== "string" || matchId.trim() === "") {
      return NextResponse.json({ error: "matchId is required" }, { status: 400 });
    }

    const match = [...MATCHES, ...KNOCKOUT_MATCHES].find((m) => m.id === matchId);

    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 400 });
    }

    if (hasMatchStarted(match.matchDate)) {
      return NextResponse.json(
        { error: "Predictions closed — match has already started" },
        { status: 400 }
      );
    }

    if (match.stage !== "Group" && prediction === "draw") {
      return NextResponse.json(
        { error: "Draw is not a valid prediction for knockout matches" },
        { status: 400 }
      );
    }

    const { action } = await upsertPrediction({
      userName: resolvedUserName,
      matchId,
      prediction,
      submittedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, action });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to add prediction" },
      { status: 500 }
    );
  }
}
