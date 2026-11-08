# Narrated videos: paused (8 Nov 2026)

Video work is on hold at the user's request. Nothing here is rendered. The finished, unnarrated
videos are still in `out/promo/` (30 s) and `out/walkthrough/` (75 s).

## Done
- Scripts and shot lists, approved: `promo2/docs/shotlist.md`, `demo2/docs/shotlist.md`.
- Narration recorded (ElevenLabs, voice "Noah"), one clip per line: `promo2/audio/vo/p1-p8.mp3`,
  `demo2/audio/vo/w01-w13.mp3`. Text in each film's `audio/script.txt`.
- Clips placed on the beat grid by `tools/build_vo.py` → `audio/vo.wav` + `audio/vo.json`.
  Promo runs 46 s (120 bpm), walkthrough 93.3 s (90 bpm).
- Word timings (`lyrics.json`, from the motion-reel `align.py`; median 2 ms off).
- Music beds and beat grids: `audio/music.wav`, `beats.json` (house for the promo, lo-fi for the walkthrough).
- Shared animation kit: `promo2/lib/kit.js` (camera on real screenshots, cursor, rings, wipes, kinetic type).
- Promo animation written: `promo2/film.js`. Never rendered or reviewed.

## Not done
- Promo: render contact sheets, critique rounds, SFX, mix, final render.
- Walkthrough: `demo2/film.js` is still the scaffold template. Copy `promo2/lib/kit.js` into
  `demo2/lib/` and build the 13 steps from `demo2/docs/shotlist.md` on `demo2/lyrics.json`.

## Useful facts
- Crops sit exactly here in the full screenshots (`tools/locate.py`): `c02_paragraph` at (368, 1164)
  and `c02_card_mallory` at (1752, 298) in `d02_everest`; `c11_paragraph_settled` at (368, 976) in `d11_wall_settled`.
- Coin logo centres in `c06_coins.png`: see `COINS` in `promo2/lib/kit.js`.
