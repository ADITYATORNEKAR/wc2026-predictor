import { NextResponse } from "next/server";
import { MATCHES } from "@/lib/matches";
import { KNOCKOUT_MATCHES } from "@/lib/knockout-matches";
import { getMatchResultsMap } from "@/lib/sheets";

export async function GET() {
  const allMatches = [...MATCHES, ...KNOCKOUT_MATCHES];

  try {
    const results = await getMatchResultsMap();

    const withResults = allMatches.map((match) => {
      const result = results[match.id];
      if (!result || result.home === "" || result.away === "") return match;

      return {
        ...match,
        actualHome: Number(result.home),
        actualAway: Number(result.away),
      };
    });

    return NextResponse.json(withResults);
  } catch {
    return NextResponse.json(allMatches);
  }
}
