import { NextResponse } from "next/server";
import { getLeagues } from "@/lib/sheets";

export async function GET() {
  try {
    const leagues = await getLeagues();
    return NextResponse.json(leagues);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch leagues" },
      { status: 500 }
    );
  }
}
