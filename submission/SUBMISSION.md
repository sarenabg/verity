# Verity: submission pack (draft for review; nothing has been submitted or posted)

## Links
- Live site: https://verity-pied-phi.vercel.app (Demo mode). Live turns on after DEPLOY.md: either real USDC on mainnet, or test dollars on testnet (no real money; DEPLOY.md "Option: Live with test dollars")
- Repo: https://github.com/sarenabg/verity (**private**: make it public before 14 Nov 23:59 UTC)
- Videos (local files, attach to the X post):
  - `media/out/promo/final.mp4` (30 s, 16:9) and `final_9x16.mp4`
  - `media/out/walkthrough/final.mp4` (75 s, 16:9) and `final_9x16.mp4`
  - Note: both videos were made before the 8 Nov QA fixes, so they show the old Dogecoin logo and plain wallet squares. The app itself is fixed; the narrated remakes are paused (`media/NARRATED_VIDEOS_STATUS.md`).
- Screenshots: `submission/screenshots/` (retaken 8 Nov from the fixed app; 6-live-mode shows Live on testnet)

## Form answers (draft)

| Field | Draft |
|---|---|
| Project name | Verity |
| Team lead | **you decide** |
| Email | **you decide** |
| Team size | **you decide** |
| Tracks | `open`, `privacy`, `defi` |
| NEAR account (payout) | **your mainnet account** (never invented for you) |
| Repository | https://github.com/sarenabg/verity |
| Demo post | **link to your X post** |

**What did you build? (≈1,100 characters)**

> Encyclopedias tell you what's "true" but never how sure anyone is. Verity is an encyclopedia where every fact has a prediction market behind it. People bet True or False, and the price is the world's confidence in that fact. An AI writes each page from the odds: near-certain facts are stated plainly, shaky ones are called disputed, and myths are called myths. When a bet moves a fact across a line, the AI rewrites that sentence live.
>
> Markets never close, and you can cash out any time. Any checkable fact can be settled: post a bond, and an AI judge running in a TEE on NEAR AI Cloud rules True, False or "can't settle yet". Anyone can dispute the ruling, which escalates to a panel of three different models.
>
> NEAR does the heavy lifting:
> - our own market contract (USDC bets, on-chain price history, judge and dispute roles);
> - NEAR Intents, so you can bet with BTC, ETH, SOL or 200+ coins;
> - NEAR AI, for verifiable, signed AI rulings.
>
> Demo mode runs with play money and no wallet. Live mode bets USDC through the contract with your own NEAR wallet; it is tested end to end on testnet. (Edit this line once you choose mainnet or testnet for the hosted Live mode.)

## X post draft (you post it)

> What if an encyclopedia told you how sure it is?
>
> Verity: every fact has a market. Bet True or False, and the AI rewrites the page from the odds. Bet $100 that Mallory summited Everest in 1924 and watch the sentence change.
>
> On @NEARProtocol: AI judges on NEAR AI (TEE-signed), bets from any coin via NEAR Intents, our own market contract.
>
> Try it: https://verity-pied-phi.vercel.app
> Which "fact" would you bet against?
>
> Built at NEAR HACKATHON #NEARHackathon @NearBuilders

## Before submitting (checklist)
- [ ] Decide which 2 projects you lead (rule Q-015: max 2 per person). Fill in "Other project by the same person" in the README's *Hackathon disclosures*.
- [ ] Push the latest commits so the hosted site gets today's fixes (Vercel redeploys from the repo).
- [ ] Live: mainnet with real USDC (DEPLOY.md steps 1-7), or testnet with test dollars (DEPLOY.md, "Option: Live with test dollars"), or Demo only. Testnet-only is eligible (rule Q-010).
- [ ] Add a NEAR AI key in Vercel (optional, turns on the live AI writer and judge).
- [ ] Make the repo public, post on X, then submit the form (only with your OK).
