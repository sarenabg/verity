import { NextResponse } from "next/server";
import { findCoin } from "@/lib/coins";
import { findPair, quote } from "@/lib/intents";

// "How much ETH (or BTC, SOL…) do I send so $X arrives?"
// A dry-run NEAR Intents quote: a real, live price, but no money moves and no
// deposit address is created. Used by Demo mode.

// Any existing NEAR account works for a dry quote.
const RECEIVER = process.env.VERITY_RECEIVER || "intents.near";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbol = url.searchParams.get("symbol") ?? "";
  const chain = url.searchParams.get("chain") ?? "";
  const usd = Math.max(1, Math.min(10_000, Number(url.searchParams.get("usd") ?? "20")));
  const coin = findCoin(symbol, chain);
  if (!coin) return NextResponse.json({ error: "Unknown coin" }, { status: 400 });

  // Fallback if the quote service is unreachable: our own rough price.
  const offline = { symbol, chain, usd, amountIn: usd / coin.approxUsd, seconds: 30, source: "estimate" as const };
  try {
    const { from, usdc } = await findPair(symbol, chain);
    if (!from || !usdc) return NextResponse.json(offline);
    const byPrice = { ...offline, amountIn: (usd / from.price) * 1.003, source: "price" as const };
    try {
      // Refunds go to the receiver's NEAR Intents balance, so no address on the paying chain is needed.
      const q = await quote({ dry: true, originAsset: from.assetId, destinationAsset: usdc.assetId, usd, recipient: RECEIVER, refundTo: RECEIVER, refundType: "INTENTS" });
      return NextResponse.json({ symbol, chain, usd, amountIn: Number(q.amountInFormatted), seconds: Number(q.timeEstimate ?? 30), source: "near-intents" as const });
    } catch {
      return NextResponse.json(byPrice);
    }
  } catch {
    return NextResponse.json(offline);
  }
}
