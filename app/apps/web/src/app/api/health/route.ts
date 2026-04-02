import { NextResponse } from "next/server";

// Read version once at module load (avoids repeated fs reads)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { version } = require("../../../../package.json") as { version: string };

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
      version,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
