import { NextRequest, NextResponse } from "next/server";
import { setConfig } from "@/lib/sheets";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, locked, adminKey } = body ?? {};

    if (typeof adminKey !== "string" || adminKey !== process.env.ADMIN_KEY) {
      return NextResponse.json({ error: "Invalid admin key" }, { status: 401 });
    }

    if (type !== "topscorer" && type !== "wcwinner") {
      return NextResponse.json({ error: "type must be 'topscorer' or 'wcwinner'" }, { status: 400 });
    }

    if (typeof locked !== "boolean") {
      return NextResponse.json({ error: "locked must be a boolean" }, { status: 400 });
    }

    await setConfig(`${type}_locked`, locked ? "true" : "false");

    return NextResponse.json({
      success: true,
      message: `${type} predictions ${locked ? "locked" : "unlocked"}`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update lock status" },
      { status: 500 }
    );
  }
}
