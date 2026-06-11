import { NextResponse } from "next/server";
import { MATCHES } from "@/lib/matches";
import { KNOCKOUT_MATCHES } from "@/lib/knockout-matches";

export async function GET() {
  return NextResponse.json([...MATCHES, ...KNOCKOUT_MATCHES]);
}
