import "server-only";
import type { Claim } from "./content";
import { pct, wordingOf } from "./market";
import { chat, nearAiEnabled, parseJsonObject, PANEL_MODELS, WRITER_MODEL, type Proof } from "./nearai";

// The two jobs AI does in Verity:
//  1. Writer: turns a fact plus the market's confidence into one sentence.
//  2. Judge: when someone asks for a fact to be settled, reads the evidence and
//     rules True, False, or "can't settle yet". A dispute goes to a panel of
//     three different models; the majority decides.
// Without NEAR_AI_API_KEY both run in demo mode from the prewritten content.

export type Writer = "near-ai" | "demo";

export type Written = { text: string; writer: Writer; model?: string; proof?: Proof };

export async function writeSentence(claim: Claim, price: number): Promise<Written> {
  const wording = wordingOf(price);
  const fallback: Written = { text: claim[wording], writer: "demo" };
  if (!nearAiEnabled()) return fallback;
  const system =
    "You write one sentence for an encyclopedia whose facts are backed by prediction markets. " +
    "Match your certainty to the market: 70%+ state it plainly, 30-70% present it as disputed, under 30% present it as doubtful or a myth. " +
    "Plain English, no hedging words beyond what the confidence needs, no percentages, no markdown. Reply with the sentence only.";
  const user =
    `Fact: ${claim.question}\nMarket confidence it is true: ${pct(price)}\n` +
    `Example wording if true: ${claim.yes}\nExample wording if disputed: ${claim.mixed}\nExample wording if false: ${claim.no}\n` +
    `Write the sentence for ${pct(price)}.`;
  try {
    const out = await chat(WRITER_MODEL, system, user, 160);
    const text = out.text.split("\n").find((l) => l.trim())?.trim().replace(/^"|"$/g, "");
    if (!text) return fallback;
    return { text, writer: "near-ai", model: WRITER_MODEL, proof: out.proof };
  } catch {
    return fallback;
  }
}

export type Verdict = "true" | "false" | "unsettled";

export type Vote = { model: string; verdict: Verdict; reason: string; writer: Writer; proof?: Proof };

export type Ruling = { verdict: Verdict; reason: string; votes: Vote[] };

function demoVote(claim: Claim, model: string): Vote {
  const verdict: Verdict = claim.checkable ? (claim.truth ? "true" : "false") : "unsettled";
  return { model, verdict, reason: claim.evidence, writer: "demo" };
}

async function liveVote(claim: Claim, model: string): Promise<Vote> {
  const system =
    "You are a careful fact-checking judge for an encyclopedia. Decide whether the claim is TRUE or FALSE based on well-established public evidence. " +
    "If the evidence is not decisive today (open historical questions, matters of definition, unproven science), answer UNSETTLED. " +
    'Reply with JSON only: {"verdict":"TRUE"|"FALSE"|"UNSETTLED","reason":"one or two plain sentences"}';
  const user = `Claim: ${claim.question}\nSources to consider: ${claim.sources.map((s) => s.url).join(", ")}`;
  const out = await chat(model, system, user, 300);
  const parsed = parseJsonObject<{ verdict?: string; reason?: string }>(out.text);
  const v = (parsed?.verdict ?? "").toUpperCase();
  const verdict: Verdict = v === "TRUE" ? "true" : v === "FALSE" ? "false" : "unsettled";
  return { model, verdict, reason: parsed?.reason?.trim() || "No reason given.", writer: "near-ai", proof: out.proof };
}

export async function judge(claim: Claim, panel: boolean): Promise<Ruling> {
  const models = panel ? PANEL_MODELS : [WRITER_MODEL];
  const votes = await Promise.all(
    models.map(async (m) => {
      if (!nearAiEnabled()) return demoVote(claim, m);
      try {
        return await liveVote(claim, m);
      } catch {
        return { ...demoVote(claim, m), reason: `${claim.evidence} (NEAR AI was unreachable, so this vote used the demo ruling.)` };
      }
    }),
  );
  const tally = (v: Verdict) => votes.filter((x) => x.verdict === v).length;
  const need = Math.floor(votes.length / 2) + 1;
  const verdict: Verdict = tally("true") >= need ? "true" : tally("false") >= need ? "false" : "unsettled";
  const reason = votes.find((v) => v.verdict === verdict)?.reason ?? votes[0].reason;
  return { verdict, reason, votes };
}
