import { NextResponse } from "next/server";
import { findCoin } from "@/lib/coins";
import { findPair, quote } from "@/lib/intents";

// Live: get a real, one-time deposit address. Whatever coin the person sends
// there arrives as exactly $usd of USDC in their own NEAR account. If anything
// fails, NEAR Intents refunds them automatically (to their NEAR Intents balance).
// POST { symbol, chain, usd, account } → { depositAddress, depositMemo?, amountIn, deadline, seconds }
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const coin = body && findCoin(body.symbol, body.chain);
  const usd = Number(body?.usd);
  const account = String(body?.account ?? "");
  if (!coin || !(usd >= 1 && usd <= 1000) || !/^[a-z0-9._-]{2,64}$/.test(account)) {
    return NextResponse.json({ error: "Need a known coin, an amount from 1 to 1000 and a NEAR account" }, { status: 400 });
  }
  try {
    const { from, usdc } = await findPair(coin.symbol, coin.chain);
    if (!from || !usdc) return NextResponse.json({ error: "That coin isn't available right now" }, { status: 400 });
    const q = await quote({ dry: false, originAsset: from.assetId, destinationAsset: usdc.assetId, usd, recipient: account, refundTo: account, refundType: "INTENTS" });
    if (!q.depositAddress) throw new Error("No deposit address returned");
    return NextResponse.json({
      depositAddress: q.depositAddress,
      depositMemo: q.depositMemo ?? null,
      amountIn: q.amountInFormatted,
      deadline: q.deadline ?? null,
      seconds: q.timeEstimate ?? 30,
      chainName: coin.chainName,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
