# Research and design notes

_8 Nov 2026._

## What exists on NEAR today

| Need | What's available | Decision |
|---|---|---|
| Prediction-market contracts | None live. Flux (NEAR's first market and oracle protocol, 2020–22) rebranded as SEDA and moved on. | Write our own small market contract (`contracts/verity_market`). |
| Oracles | Pyth (`pyth-oracle.near`) covers prices only, and Pyth said it would end NEAR support after 31 Jul 2026. Nothing exists for "is this fact true?" | An AI judge on NEAR AI, with a dispute window and a multi-model panel. |
| AI | NEAR AI Cloud: an OpenAI-compatible API at `https://cloud-api.near.ai/v1`. NEAR hosts some models itself in TEEs (marked `owned_by: "nearai"` in `/v1/models`). Answers can be checked with `GET /v1/signature/{chat_id}`. | Writer: Qwen 3.8 27B. Panel: Qwen 3.8, GLM 5.3 Flash, DeepSeek V4.1 Flash. |
| Betting from any chain | NEAR Intents 1Click API: `EXACT_OUTPUT` quotes that turn ~200 tokens on ~40 chains into exact USDC on NEAR. There is no testnet; `dry: true` quotes are free. | Live dry quotes in the app; the transfer is simulated. |

## Other hackathon projects nearby

Searched the public project list by name on 8 Nov. No project turns encyclopedia facts into markets. The closest:

- **NEARpedia:** up-to-date NEAR facts for AI coding agents, with sources and dates. No markets.
- **PredicTEE:** a TEE AI oracle that places Polymarket trades through Chain Signatures.
- **NEAR Claim Check:** checks claims about tokens against chain data. No AI, no markets.
- **OddsHedge:** an agent that finds gaps between Polymarket odds and Hyperliquid prices.

## "Perpetual" markets: the options we weighed

1. **Never settle; cash out only.** This is the simplest option. Its weakness: with no final payout, prices can drift toward "what will others think" (a Keynesian beauty contest).
2. **Self-resolving markets** (Srinivasan, Karger & Chen, 2023). After each trade there is a small chance the market ends and pays out at the last price. In theory, truthful betting is the best strategy. But it is hard to explain, and critics note it is closer to peer prediction than to a market.
3. **Augur-style optional resolution** (chosen). Markets run forever, but anyone can force a checkable fact to a ruling, and rulings can be disputed with escalating bonds. Augur escalates to a fork of REP holders. We escalate to a panel of independent AI models running in TEEs, which is cheap enough to use for every fact.

Note: Kalshi's and Polymarket's 2026 "perpetuals" are funding-rate futures on asset prices, not on facts, so they don't solve this problem.

## Market maker

Fixed-product market maker (the design of Gnosis and Polymarket): `yes × no = k`, and the True price is `no / (yes + no)`. Why this one:

- It is integer-only and safe to run on-chain.
- Buying and selling are symmetric.
- Facts near 0% or 100% need a deep pool, or they are cheap to push around. Each fact's depth is set to match how settled it is.

## Sources

- Self-resolving markets: https://arxiv.org/abs/2306.04305
- NEAR AI Cloud verification: https://docs.near.ai/cloud/verification
- NEAR AI response signatures: https://docs.near.ai/cloud/verification/cloud-api/response-signatures
- 1Click API: https://docs.near-intents.org/integration/distribution-channels/1click-api/about-1click-api
- Pyth on NEAR: https://docs.pyth.network/price-feeds/core/contract-addresses/near
- Flux → SEDA: https://www.coincarp.com/currencies/announcement/flux-protocol-has-rebranded-to-seda-protocol/
