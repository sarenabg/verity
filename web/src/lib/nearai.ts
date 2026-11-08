import "server-only";
import { createHash } from "node:crypto";

// NEAR AI Cloud: an OpenAI-compatible API whose NEAR-hosted models run inside
// sealed hardware (TEEs). Every answer can be checked afterwards: we fetch the
// signature for the chat and confirm it covers the exact bytes we sent and got.
// Docs: https://docs.near.ai/cloud/verification/cloud-api/response-signatures

const BASE = "https://cloud-api.near.ai/v1";

/** Models NEAR hosts itself in TEEs (owned_by "nearai" in /v1/models). */
export const WRITER_MODEL = process.env.NEAR_AI_MODEL || "Qwen/Qwen3.8-27B";
export const PANEL_MODELS = (process.env.NEAR_AI_PANEL || "Qwen/Qwen3.8-27B,z-ai/glm-5.3-flash,deepseek-ai/DeepSeek-V4.1-Flash-1017")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

export function nearAiEnabled(): boolean {
  return Boolean(process.env.NEAR_AI_API_KEY);
}

export type Proof = {
  chatId: string;
  model: string;
  signatureKind: string | null; // "provider_tee" | "gateway" | null
  signingAddress: string | null;
  signature: string | null;
  hashesMatch: boolean; // the signed text covers our exact request and response bytes
};

export type Completion = { text: string; proof: Proof };

const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

export async function chat(model: string, system: string, user: string, maxTokens = 400): Promise<Completion> {
  const key = process.env.NEAR_AI_API_KEY;
  if (!key) throw new Error("NEAR_AI_API_KEY is not set");
  const requestBody = JSON.stringify({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    max_tokens: maxTokens,
    temperature: 0.2,
  });
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, "x-no-aliasing": "true" },
    body: requestBody,
    signal: AbortSignal.timeout(45_000),
  });
  const responseBody = await res.text();
  if (!res.ok) throw new Error(`NEAR AI ${res.status}: ${responseBody.slice(0, 200)}`);
  const json = JSON.parse(responseBody);
  const text: string = json.choices?.[0]?.message?.content ?? "";
  const proof = await fetchProof(json.id, model, sha256(requestBody), sha256(responseBody)).catch(() => ({
    chatId: json.id,
    model,
    signatureKind: null,
    signingAddress: null,
    signature: null,
    hashesMatch: false,
  }));
  return { text: stripThinking(text), proof };
}

async function fetchProof(chatId: string, model: string, requestHash: string, responseHash: string): Promise<Proof> {
  const res = await fetch(`${BASE}/signature/${encodeURIComponent(chatId)}?signing_algo=ecdsa`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${process.env.NEAR_AI_API_KEY}` },
    signal: AbortSignal.timeout(15_000),
  });
  const sig = await res.json();
  const signed: string = sig.text ?? "";
  const kind: string | null = sig.signature_kind ?? null;
  const expected = kind === "provider_tee" ? `${model}:${requestHash}:${responseHash}` : `${requestHash}:${responseHash}`;
  return {
    chatId,
    model,
    signatureKind: kind,
    signingAddress: sig.signing_address ?? null,
    signature: sig.signature ?? null,
    hashesMatch: signed === expected,
  };
}

/** Some reasoning models wrap their thinking in <think> tags. */
function stripThinking(s: string): string {
  return s.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

/** Pull the first JSON object out of a model's reply. */
export function parseJsonObject<T>(s: string): T | null {
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(s.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
