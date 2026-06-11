import { NextResponse } from "next/server";
import { MATCHES } from "@/lib/matches";

export async function GET() {
  return NextResponse.json(MATCHES);
}
