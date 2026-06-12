import { NextResponse, after } from "next/server";
import { getLeaderboard } from "@/lib/sheets";

export async function GET() {
  after(async () => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/sync-results?cronSecret=${process.env.CRON_SECRET}`, {
        method: "GET",
      });
    } catch {
      // silent fail — background task
    }
  });

  try {
    const leaderboard = await getLeaderboard();
    return NextResponse.json(leaderboard);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch leaderboard" },
      { status: 500 }
    );
  }
}
