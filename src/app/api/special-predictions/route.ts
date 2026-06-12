import { NextRequest, NextResponse } from "next/server";
import { getSpecialPredictions, upsertSpecialPrediction } from "@/lib/sheets";
import { TOP_SCORER_OPTIONS, ALL_WC_TEAMS } from "@/lib/special-picks";

export async function GET(request: NextRequest) {
  try {
    const userName = request.nextUrl.searchParams.get("userName") ?? undefined;
    const predictions = await getSpecialPredictions(userName);
    return NextResponse.json(predictions);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch special predictions" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userName, userEmail, type, pick } = body ?? {};

    if (typeof userEmail !== "string" || !userEmail.toLowerCase().endsWith("@citizensbank.com")) {
      return NextResponse.json({ error: "Unauthorized email domain" }, { status: 403 });
    }

    if (typeof userName !== "string" || userName.trim() === "") {
      return NextResponse.json({ error: "userName is required" }, { status: 400 });
    }

    if (type !== "topscorer" && type !== "wcwinner") {
      return NextResponse.json({ error: "type must be 'topscorer' or 'wcwinner'" }, { status: 400 });
    }

    if (typeof pick !== "string" || pick.trim() === "") {
      return NextResponse.json({ error: "pick is required" }, { status: 400 });
    }

    if (type === "topscorer" && !TOP_SCORER_OPTIONS.some((option) => option.id === pick)) {
      return NextResponse.json({ error: "Invalid top scorer pick" }, { status: 400 });
    }

    if (type === "wcwinner" && !ALL_WC_TEAMS.includes(pick)) {
      return NextResponse.json({ error: "Invalid World Cup winner pick" }, { status: 400 });
    }

    const result = await upsertSpecialPrediction({ userName, userEmail, type, pick });

    return NextResponse.json({ success: true, action: result.action });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save special prediction" },
      { status: 500 }
    );
  }
}
