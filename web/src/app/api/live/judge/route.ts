import { NextResponse } from "next/server";
import { judge, type Ruling } from "@/lib/ai";
import { view, type ChainClaim } from "@/lib/chain";
import { LIVE } from "@/lib/config";
import { CLAIM_BY_ID } from "@/lib/content";

// Live AI judge. When a fact on the contract is waiting for a ruling (someone
// posted the bond), this runs the NEAR AI judge, or the 3-model panel after a
// dispute, and posts the answer on-chain.
//
// It signs with VERITY_JUDGE_KEY: a function-call key that can only call
// `propose_ruling` and `panel_ruling` on the contract. It cannot move money.
// Safe to call any number of times: it only acts when the contract is waiting.
// POST { claimId, panel } → { verdict, reason, tx }

export const maxDuration = 60;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const claim = body && CLAIM_BY_ID[body.claimId];
  if (!claim || !LIVE.contract) return NextResponse.json({ error: "Unknown fact" }, { status: 400 });
  const accountId = process.env.VERITY_JUDGE_ACCOUNT || LIVE.contract;
  const key = process.env.VERITY_JUDGE_KEY;
  if (!key) return NextResponse.json({ error: "The judge is offline (no key set)." }, { status: 503 });

  const onChain = await view<ChainClaim | null>(LIVE.contract, "get_claim", { id: claim.id });
  const st = onChain && typeof onChain.status === "object" ? onChain.status : null;
  const panel = Boolean(st && "Disputed" in st);
  if (!st || !("Judging" in st || "Disputed" in st)) return NextResponse.json({ error: "Nothing to judge right now." }, { status: 409 });

  const ruling = await judge(claim, panel);
  const verdict = ruling.verdict === "unsettled" ? null : ruling.verdict === "true";
  try {
    const [{ Account }, { JsonRpcProvider }, { KeyPairSigner }] = await Promise.all([import("@near-js/accounts"), import("@near-js/providers"), import("@near-js/signers")]);
    const account = new Account(accountId, new JsonRpcProvider({ url: LIVE.rpc }), KeyPairSigner.fromSecretKey(key as `ed25519:${string}`));
    const outcome = await account.callFunctionRaw({
      contractId: LIVE.contract,
      methodName: panel ? "panel_ruling" : "propose_ruling",
      args: { claim: claim.id, verdict, evidence: evidence(ruling) },
      gas: 50n * 10n ** 12n,
    });
    return NextResponse.json({ verdict: ruling.verdict, reason: ruling.reason, panel, tx: outcome.transaction?.hash ?? null });
  } catch (e) {
    return NextResponse.json({ error: `Couldn't post the ruling: ${(e as Error).message.slice(0, 160)}` }, { status: 502 });
  }
}

/** Compact JSON kept on-chain: the reason and each model's vote with its TEE signature info. */
function evidence(r: Ruling): string {
  const out = {
    r: r.reason.slice(0, 280),
    v: r.votes.map((v) => [v.model, v.verdict, v.proof?.signatureKind ?? null, v.proof?.hashesMatch ? v.proof.signingAddress : null, v.writer]),
  };
  return JSON.stringify(out);
}
