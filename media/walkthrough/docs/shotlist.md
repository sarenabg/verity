# Verity demo walkthrough: shot list
75 s · 88 bpm · 110 beats · formats: 16x9 (primary), 9x16
Music: synth lo-fi, F major (calm, under the captions) · VO: none, with captions instead
Every frame is a real screen from the app, captured by clicking through it (`assets/shots/flow/`). A short caption names each step. The camera moves are gentle: pans and slow push-ins, to guide the eye.

| # | beats | time | step | on screen (asset) | motion | caption | sound |
|---|-------|------|------|-------------------|--------|---------|-------|
| 1 | 0-8 | 0.0-5.5 | Title | `flow/d01_home.png` | slow pan down the home page | "Verity · every fact has a market" | soft pad |
| 2 | 8-16 | 5.5-10.9 | An article | `flow/d02_everest.png` | push in on the Mallory sentence (orange underline, 14%) | "Each underlined fact has a market. Colour = how sure people are." | tick |
| 3 | 16-24 | 10.9-16.4 | Place a bet | `flow/c02_card_mallory.png` → `c03_card_100.png` | card slides in, then the $100 chip and "→ 37%" highlight | "Bet $100 that Mallory got there first." | click |
| 4 | 24-32 | 16.4-21.8 | The page rewrites | `flow/c04_paragraph_rewriting.png` → `c05_paragraph_rewritten.png` | yellow highlight, then settles to the new "open question" wording | "It crosses 30%, so the AI rewrites the sentence." | chime |
| 5 | 32-40 | 21.8-27.3 | Page history | `flow/c05_history.png` + `c05_card_after.png` | split screen: history line and your bet's value | "Every rewrite is logged. Cash out any time." | tick |
| 6 | 40-48 | 27.3-32.7 | Any coin | `flow/c06_coins.png` → `c07_quote.png` → `c08_moving.png` | three dialog states, slide by slide | "Pay with ETH, BTC, SOL… Live price from NEAR Intents." | 3 ticks |
| 7 | 48-60 | 32.7-40.9 | Settle a fact | `flow/d09_wall.png` → `c10_judge_says.png` → `d11_wall_settled.png` | push to the card; judge box; then the page with ✓ | "Ask the AI judge. It rules False. After the dispute window, winners are paid." | thud on settle |
| 8 | 60-72 | 40.9-49.1 | Dispute | `flow/c12_panel.png` | votes appear one by one | "Disagree? Dispute, and three different AI models vote." | 3 ticks |
| 9 | 72-80 | 49.1-54.5 | Open questions | `flow/c13_cant_settle.png` | gentle push | "No evidence yet? The judge says so, and the market stays open." | swell |
| 10 | 80-88 | 54.5-60.0 | My bets | `flow/d14_bets.png` | pan across the stats | "Your bets, profit and activity." | tick |
| 11 | 88-100 | 60.0-68.2 | Live mode | `flow/c16_mode.png` → `flow/d17_live_everest.png` → `flow/c18_connect.png` | three states | "Switch to Live: real USDC on NEAR. Your wallet confirms every bet." | 3 ticks |
| 12 | 100-104 | 68.2-70.9 | On a phone | `flow/m01_article.png` → `flow/m02_sheet.png` in a phone frame | the sheet slides up | "Works on phones." | swish |
| 13 | 104-110 | 70.9-75.0 | End card | Logo + "Verity" + `verity-pied-phi.vercel.app` + "Built at NEAR HACKATHON" | type settles; holds | (none) | final chord |

Formats:
- 9x16: the screen sits in the top 60% (crop centred on the subject: card, sentence or dialog), with the caption in large type below it. Desktop-wide shots (2, 5, 10) use the card or the paragraph crop instead of the full page.

Longest gap without a new event: shot 7, beats 48-60 (8.2 s). It has three state changes inside it.
