# Going live on NEAR mainnet

This turns on **Live** mode: real USDC bets on NEAR. **You sign every step yourself.** Nobody else ever sees your keys.

You need:
- a NEAR mainnet account (we'll call it `YOU.near`);
- about **7 NEAR**: ~5 for the contract's storage, plus a little for fees;
- **54 USDC on NEAR**, the starting money for the 27 markets (2 USDC each). You get most of it back as markets settle. You also need a little more if you want to bet yourself.
- the NEAR command-line tool (`near`), already on this Mac.

Replace `YOU` everywhere below with your account name.

## 1. Let the command-line tool use your account (once)

This opens your wallet in the browser. Approve it there.

```bash
near account import-account using-web-wallet network-config mainnet
```

## 2. Create the contract's own account

```bash
near account create-account fund-myself verity.YOU.near '5 NEAR' autogenerate-new-keypair save-to-keychain sign-as YOU.near network-config mainnet sign-with-keychain send
```

## 3. Put the contract on it

Rulings use a 1 USDC deposit, disputes a 2 USDC deposit, and the dispute window is 1 hour. The smallest bet is 0.10 USDC.

```bash
near contract deploy verity.YOU.near use-file contracts/verity_market/target/near/verity_market.wasm with-init-call new json-args '{"owner":"YOU.near","token":"17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1","judge":"verity.YOU.near","panel":"verity.YOU.near","ruling_bond":"1000000","dispute_bond":"2000000","dispute_window_ns":3600000000000,"min_bet":"100000"}' prepaid-gas '100.0 Tgas' attached-deposit '0 NEAR' network-config mainnet sign-with-keychain send
```

The wasm file comes from `cd contracts/verity_market && cargo near build non-reproducible-wasm --skip-rust-version-check`. Its SHA-256 is printed by the build.

## 4. Give the AI judge a limited key

The judge posts rulings on-chain. Its key can **only** call `propose_ruling` and `panel_ruling` on your contract, and can spend at most 0.5 NEAR on fees. It **cannot move any money**.

`JUDGE_PUBLIC_KEY` is generated for you (see "Website settings" below):

```bash
near account add-key verity.YOU.near grant-function-call-access --allowance '0.5 NEAR' --contract-account-id verity.YOU.near --function-names 'propose_ruling, panel_ruling' use-manually-provided-public-key JUDGE_PUBLIC_KEY network-config mainnet sign-with-keychain send
```

## 5. Website settings (Vercel → Project → Settings → Environment Variables)

| Name | Value |
|---|---|
| `NEXT_PUBLIC_VERITY_CONTRACT` | `verity.YOU.near` |
| `VERITY_JUDGE_ACCOUNT` | `verity.YOU.near` |
| `VERITY_JUDGE_KEY` | the judge's private key (secret) |
| `NEAR_AI_API_KEY` | from https://cloud.near.ai (secret; $10 free via https://nearbuilders.org/join) |
| `ONECLICK_JWT` (optional) | from https://partners.near-intents.org, removes the 0.2% fee |

Then redeploy the site.

## 6. Open the markets

1. Open `https://YOUR-SITE/admin` and connect `YOU.near`.
2. Click the three steps, confirming each in your wallet:
   - let the contract hold USDC (0.00125 NEAR);
   - create the 27 facts;
   - start every market (54 USDC).

## 7. Check it

- Switch to **Live** in the header and open Mount Everest. The prices should match the Demo starting prices.
- Bet 0.25 USDC on a fact. Your wallet asks you to confirm, the price moves, and the bet appears in **My bets**.
- Cash out, then **Withdraw to wallet**.

## Tested first on testnet

The same steps were run end to end on NEAR testnet with throwaway accounts and a test USDC token (`contracts/mock_usdc`). See `web/scripts/live-setup.mts` and `web/scripts/live-e2e.mts`.
