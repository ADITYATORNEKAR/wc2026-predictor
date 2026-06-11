import { NextResponse } from "next/server";
import { fetchAllMatches } from "@/lib/espn";

export const revalidate = 60;

export async function GET() {
  try {
    const matches = await fetchAllMatches();
    return NextResponse.json({ matches, lastUpdated: new Date().toISOString() });
  } catch {
    return NextResponse.json({ matches: [], lastUpdated: new Date().toISOString(), error: true });
  }
}
