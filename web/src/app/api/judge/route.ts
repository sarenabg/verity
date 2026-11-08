import { NextResponse } from "next/server";
import { judge } from "@/lib/ai";
import { CLAIM_BY_ID } from "@/lib/content";

// Asks the AI judge to settle a fact.
// POST { claimId, panel } → { verdict: "true" | "false" | "unsettled", reason, votes[] }
// panel=true is the dispute round: three different NEAR-hosted models vote.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const claim = body && CLAIM_BY_ID[body.claimId];
  if (!claim) return NextResponse.json({ error: "Unknown claimId" }, { status: 400 });
  return NextResponse.json(await judge(claim, Boolean(body.panel)));
}
