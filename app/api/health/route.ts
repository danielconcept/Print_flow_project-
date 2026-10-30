import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "printflow",
    timestamp: new Date().toISOString(),
  });
}
