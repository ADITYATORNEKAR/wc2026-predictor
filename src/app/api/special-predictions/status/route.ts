import { NextResponse } from "next/server";
import { getConfig } from "@/lib/sheets";

export async function GET() {
  try {
    const [topscorerLocked, wcwinnerLocked] = await Promise.all([
      getConfig("topscorer_locked"),
      getConfig("wcwinner_locked"),
    ]);

    return NextResponse.json({
      topscorer_locked: topscorerLocked === "true",
      wcwinner_locked: wcwinnerLocked === "true",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch lock status" },
      { status: 500 }
    );
  }
}
