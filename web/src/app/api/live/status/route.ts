import { NextResponse } from "next/server";
import { status } from "@/lib/intents";

// Live: has the deposit arrived? GET ?address=… → { status }
// PENDING_DEPOSIT → KNOWN_DEPOSIT_TX → PROCESSING → SUCCESS (or INCOMPLETE_DEPOSIT / REFUNDED / FAILED)
export async function GET(req: Request) {
  const address = new URL(req.url).searchParams.get("address") ?? "";
  if (!address || address.length > 200) return NextResponse.json({ error: "Need an address" }, { status: 400 });
  try {
    return NextResponse.json(await status(address));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
