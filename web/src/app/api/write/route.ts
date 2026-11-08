import { NextResponse } from "next/server";
import { writeSentence } from "@/lib/ai";
import { CLAIM_BY_ID } from "@/lib/content";

// Rewrites one fact's sentence for its new market price.
// POST { claimId, price } → { text, writer, model?, proof? }
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const claim = body && CLAIM_BY_ID[body.claimId];
  const price = Number(body?.price);
  if (!claim || !(price > 0 && price < 1)) return NextResponse.json({ error: "Need a known claimId and a price between 0 and 1" }, { status: 400 });
  return NextResponse.json(await writeSentence(claim, price));
}
