import { NextRequest, NextResponse } from "next/server";
import { joinLeague } from "@/lib/sheets";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userName, userEmail, leagueName } = body ?? {};

    if (typeof userEmail !== "string" || !userEmail.toLowerCase().endsWith("@citizensbank.com")) {
      return NextResponse.json({ error: "Unauthorized email domain" }, { status: 403 });
    }

    if (typeof leagueName !== "string" || leagueName.trim() === "") {
      return NextResponse.json({ error: "leagueName is required" }, { status: 400 });
    }

    const resolvedUserName =
      typeof userName === "string" && userName.trim() !== "" ? userName.trim() : userEmail.split("@")[0];

    await joinLeague(resolvedUserName, userEmail, leagueName);

    return NextResponse.json({ success: true, leagueName });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to join league" },
      { status: 500 }
    );
  }
}
