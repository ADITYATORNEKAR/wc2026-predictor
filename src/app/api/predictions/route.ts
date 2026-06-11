import { NextRequest, NextResponse } from "next/server";
import { getPredictions, addPrediction } from "@/lib/sheets";
import { MATCHES } from "@/lib/matches";

export async function GET() {
  try {
    const predictions = await getPredictions();
    return NextResponse.json(predictions);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch predictions" },
      { status: 500 }
    );
  }
}

function isValidScore(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 20;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userName, userEmail, matchId, predictedHome, predictedAway } = body ?? {};

    if (typeof userEmail !== "string" || !userEmail.toLowerCase().endsWith("@citizensbank.com")) {
      return NextResponse.json({ error: "Unauthorized email domain" }, { status: 403 });
    }

    const resolvedUserName =
      typeof userName === "string" && userName.trim() !== "" ? userName.trim() : userEmail.split("@")[0];

    if (typeof matchId !== "string" || matchId.trim() === "") {
      return NextResponse.json({ error: "matchId is required" }, { status: 400 });
    }

    const match = MATCHES.find((m) => m.id === matchId);

    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 400 });
    }

    if (new Date(match.matchDate) <= new Date()) {
      return NextResponse.json(
        { error: "Predictions are closed — this match has already started" },
        { status: 400 }
      );
    }

    if (!isValidScore(predictedHome)) {
      return NextResponse.json(
        { error: "predictedHome must be an integer between 0 and 20" },
        { status: 400 }
      );
    }

    if (!isValidScore(predictedAway)) {
      return NextResponse.json(
        { error: "predictedAway must be an integer between 0 and 20" },
        { status: 400 }
      );
    }

    await addPrediction({
      userName: resolvedUserName,
      matchId,
      predictedHome,
      predictedAway,
      submittedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to add prediction" },
      { status: 500 }
    );
  }
}
