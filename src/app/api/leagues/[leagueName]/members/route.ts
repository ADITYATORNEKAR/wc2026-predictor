import { NextResponse } from "next/server";
import { getLeagueMembers } from "@/lib/sheets";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ leagueName: string }> }
) {
  try {
    const { leagueName } = await params;
    const members = await getLeagueMembers(decodeURIComponent(leagueName));
    return NextResponse.json(members);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch league members" },
      { status: 500 }
    );
  }
}
