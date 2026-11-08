import { NextResponse } from "next/server";
import { nearAiEnabled, PANEL_MODELS, WRITER_MODEL } from "@/lib/nearai";

// Tells the page whether the AI is live (NEAR AI key set) or in demo mode.
export function GET() {
  return NextResponse.json({ nearAi: nearAiEnabled(), writer: WRITER_MODEL, panel: PANEL_MODELS, contract: process.env.NEXT_PUBLIC_VERITY_CONTRACT || null });
}
