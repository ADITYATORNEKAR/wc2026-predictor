import { NextRequest, NextResponse } from "next/server";
import { getSpecialPredictions, setSpecialPredictionResult } from "@/lib/sheets";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, correctAnswer, adminKey } = body ?? {};

    if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
      return NextResponse.json({ error: "Invalid admin key" }, { status: 401 });
    }

    if (type !== "topscorer" && type !== "wcwinner") {
      return NextResponse.json({ error: "type must be 'topscorer' or 'wcwinner'" }, { status: 400 });
    }

    if (typeof correctAnswer !== "string" || correctAnswer.trim() === "") {
      return NextResponse.json({ error: "correctAnswer is required" }, { status: 400 });
    }

    await setSpecialPredictionResult(type, correctAnswer);

    const predictions = await getSpecialPredictions();
    const updated = predictions.filter((p) => p.type === type).length;

    return NextResponse.json({ updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to set special result" },
      { status: 500 }
    );
  }
}
