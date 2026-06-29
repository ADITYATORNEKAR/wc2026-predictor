import { NextRequest, NextResponse } from "next/server";
import { setConfig } from "@/lib/sheets";

export async function POST(request: NextRequest) {
  try {
    const adminKey =
      request.nextUrl.searchParams.get("adminKey") ??
      (await request.json().catch(() => ({})))?.adminKey;

    if (typeof adminKey !== "string" || adminKey !== process.env.ADMIN_KEY) {
      return NextResponse.json({ error: "Invalid admin key" }, { status: 401 });
    }

    await setConfig("topscorer_locked", "true");

    return NextResponse.json({
      success: true,
      message: "Top scorer predictions are now locked",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to lock top scorer" },
      { status: 500 }
    );
  }
}
