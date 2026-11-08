// Verity promo, narrated. A pure function of time: window.seek(t) paints frame t.
// Times are in SECONDS and come from the narration itself (lyrics.json, word-aligned by align.py);
// docs/shotlist.md is the approved plan. Every product image is a real capture (assets/shots/flow).
import * as M from './lib/motion.js';
import { C, DISPLAY, UI, P, S, W, H, E, SPRING, prog, lerp, clamp, font, text, sp, ez, voice, kinetic, label, counter,
  cam, toView, windowCard, inView, wipe, ring, stroke, band, path, cursor, card, logo, wordmark, COINS, coin } from './lib/kit.js';

const LY = await fetch('lyrics.json').then((r) => r.json());
const GRIDJ = await fetch('beats.json').then((r) => r.json());
const V = voice(LY);
const ph = (line, str) => V.phrase(line, str);

// ------------------------------------------------------------------ layout per format
const TX = P ? S.x : 110;                                            // type column
const VIEW = P ? { x: 48, y: 800, w: 984, h: 700, r: 28 } : { x: 800, y: 90, w: 1030, h: 900, r: 28 };
const STAGE = P ? { x: 540, y: 1160 } : { x: 1315, y: 540 };        // centre for floating cards

// d02_everest.png: source pixel positions (crops located exactly with tools/locate.py)
const EV = {
  column: [330, 180, 1700, 1640],
  mallory: [870, 1225, 1660, 1390],
  card: [1752, 298, 2512, 1500],
  cardAt: [1752, 298],
  para: [368, 1164, 1656, 1534],
  paraAt: [368, 1164],
  pct: [1795, 545, 2015, 655],
  chip100: [2129, 1263],
  betBtn: [2133, 1386],
};
// d09_wall.png: the myth sentence ("Contrary to a popular myth...")
const WALL = { page: [330, 700, 1700, 1300], myth: [368, 976, 1656, 1126] };

function shakeAt(ctx, t, t0, amp, decay = 0.18) {
  if (t < t0) return;
  const a = amp * Math.exp(-(t - t0) / decay);
  if (a > 0.3) ctx.translate(a * M.noise1(t * 60, 4), a * M.noise1(t * 60, 11));
}

// ------------------------------------------------------------------ 1 hook (0 - 6)
function sHook(ctx, t, I) {
  // a real article paragraph flies in on an angle, already moving on frame 0
  const k = sp(t, -0.35, SPRING.gentle);
  const out = ez(t, 5.3, 5.95, E.inCubic);
  const w = P ? 980 : 860;
  const cx = (P ? 540 : 1450) + (1 - k) * 1100 + out * 1300;
  const cy = (P ? 1250 : 600) + (1 - k) * 120 + out * 200;
  const rot = lerp(-0.26, -0.07, k) + out * 0.3;
  card(ctx, I.para, null, cx, cy, w, { rot, radius: 20, shadow: 0.8 });
  // the giant question mark drops onto it on "anyone"
  const q = sp(t, 4.5, SPRING.bouncy);
  if (q > 0) {
    const sq = 0.16 * M.wobble(t - 4.62, 3, 6);
    ctx.save();
    ctx.translate((P ? 860 : 1730) + out * 1300, (P ? 1180 : 560) - (1 - q) * 700 + out * 200);
    ctx.rotate(0.08 + out * 0.3);
    ctx.scale(1 + sq, 1 - sq);
    text(ctx, '?', 0, 0, font(P ? 360 : 440, 500, DISPLAY), C.ink, 'center');
    ctx.restore();
  }
  const y0 = P ? 380 : 330;
  const ex = 5.3;
  kinetic(ctx, t, [ph(0, 'Encyclopedias tell you')], { x: TX, y: y0, size: 54, family: UI, color: C.muted, exit: ex });
  kinetic(ctx, t, [ph(0, "what's true.")], { x: TX, y: y0 + 150, size: 140, exit: ex });
  kinetic(ctx, t, [ph(0, 'But never')], { x: TX, y: y0 + 280, size: 54, family: UI, color: C.muted, exit: ex });
  kinetic(ctx, t, [ph(0, 'how sure?')], { x: TX, y: y0 + 430, size: 140, color: C.blue, exit: ex });
}

// ------------------------------------------------------------------ 2 brand (6 - 10.9)
function sBrand(ctx, t, I) {
  const whip = ez(t, 10.45, 10.95, E.inCubic) * W * 1.1;
  ctx.save();
  ctx.translate(-whip, 0);
  // three real article cards from the home page fan out behind, each on its own spring
  const crops = [[369, 1306, 692, 382], [1096, 1306, 690, 382], [1820, 1306, 691, 382]];
  crops.forEach((src, i) => {
    const k = sp(t, 6.2 + i * 0.12, SPRING.bouncy);
    if (k <= 0) return;
    const d = i - 1;
    const par = (t - 6.6) * 14 * d;
    const cw = P ? 340 : 520;
    const x = W / 2 + d * (P ? 320 : 560) * k + par;
    const y = (P ? 1430 : 880) + (1 - k) * 500 + Math.abs(d) * 30;
    card(ctx, I.home, src, x, y, cw, { rot: d * 0.07 * k, radius: 22, shadow: 0.7 });
  });
  logo(ctx, W / 2, P ? 520 : 230, P ? 84 : 64, prog(t, 5.95, 6.9));
  wordmark(ctx, t, 6.33, W / 2, P ? 830 : 470, P ? 190 : 170);
  kinetic(ctx, t, [ph(1, 'the encyclopedia where')], { x: W / 2, y: P ? 950 : 575, size: P ? 52 : 50, family: UI, color: C.muted, align: 'center' });
  const rows = P ? [ph(1, 'every fact'), ph(1, 'has a price.')] : [ph(1, 'every fact has a price.')];
  kinetic(ctx, t, rows, { x: W / 2, y: P ? 1080 : 690, size: P ? 112 : 96, align: 'center', accent: new Set(['price.']) });
  ctx.restore();
}

// ------------------------------------------------------------------ 3+4 the claim and the rewrite (10.4 - 22.7)
function sEverest(ctx, t, I) {
  const enter = sp(t, 10.45, SPRING.gentle);
  const exit = ez(t, 22.15, 22.6, E.inCubic);
  const v = { ...VIEW, x: VIEW.x + (1 - enter) * W, y: VIEW.y + exit * H };
  const c = cam(t, [
    [10.4, 10.4, EV.column, 1.04],
    [11.35, 12.7, EV.mallory, 1.2],
    [13.85, 14.5, EV.card, 1.04],
    [19.25, 20.0, EV.para, 1.06],
  ], v, 0.012);
  windowCard(ctx, v);
  inView(ctx, v, c, (g) => {
    g.drawImage(I.d02, 0, 0);
    // the myth sentence lights up as it is named
    band(g, t, [880, 1240, 1650, 1302], 11.5, 0.5, { color: 'rgba(194,65,12,0.10)' });
    band(g, t, [362, 1316, 1585, 1378], 11.85, 0.7, { color: 'rgba(194,65,12,0.10)' });
    stroke(g, t, 891, 1642, 1292, 11.55, 0.5, { color: C.orange, width: 5 });
    stroke(g, t, 369, 1573, 1367, 11.95, 0.7, { color: C.orange, width: 5 });
    // the card answers: 14%, then the $100 chip, then 37% after the bet
    const [ax, ay] = EV.cardAt;
    if (t > 16.22) { g.globalAlpha = ez(t, 16.22, 16.32); g.drawImage(I.card100, ax, ay); g.globalAlpha = 1; }
    if (t > 18.55) { g.globalAlpha = ez(t, 18.55, 18.85); g.drawImage(I.cardAfter, ax, ay); g.globalAlpha = 1; }
    ring(g, t, [1795, 545, 2015, 655], 14.2, 15.3, { color: C.orange, width: 5 });
    ring(g, t, [1795, 525, 2015, 640], 18.75, 19.4, { width: 5 });
    // the AI rewrites the paragraph: the real highlighted frame, then the settled wording
    const [px, py] = EV.paraAt;
    wipe(g, I.rewriting, px, py, EV.para, ez(t, 20.0, 20.9));
    if (t > 21.0) { g.globalAlpha = ez(t, 21.0, 21.6); g.drawImage(I.rewritten, px, py); g.globalAlpha = 1; }
  });
  // the cursor bets $100 on True
  const ca = ez(t, 15.15, 15.4) * (1 - ez(t, 17.3, 17.6));
  if (ca > 0) {
    const [sx, sy] = path(t, [[0, 0, [2420, 1660]], [15.3, 15.95, EV.chip100], [16.35, 16.62, EV.betBtn]]);
    const [x, y] = toView(c, v, sx, sy);
    cursor(ctx, t, x, y, { taps: [16.21, 16.75], scale: P ? 1.3 : 1.15, alpha: ca });
  }

  // type column
  const y0 = P ? 360 : 380;
  kinetic(ctx, t, [ph(2, 'Mallory'), ph(2, 'reached the top'), ph(2, 'first, in 1924?')], { x: TX, y: y0, size: P ? 96 : 92, lh: P ? 100 : 104, exit: 14.15, accent: new Set(['1924?']) });
  const cy = P ? 500 : 420;
  const ce = ez(t, 22.1, 22.45, E.inCubic);
  if (t > 13.8 && ce < 1) {
    ctx.save();
    ctx.globalAlpha = 1 - ce;
    ctx.translate(0, -ce * 80);
    counter(ctx, t, TX, cy, P ? 200 : 230, 14, 37, 17.55, 19.0, { appear: 14.15 });
    label(ctx, t, "chance it's true", TX + 6, cy + (P ? 64 : 72), P ? 40 : 38, { t0: 14.45 });
    ctx.restore();
  }
  const ry = P ? 660 : 640;
  kinetic(ctx, t, [ph(2, 'Put money on it.')], { x: TX, y: ry, size: P ? 88 : 84, exit: 17.2 });
  kinetic(ctx, t, [ph(3, 'the odds move,')], { x: TX, y: ry, size: P ? 88 : 84, exit: 19.45 });
  const rr = P ? [ph(3, 'the AI rewrites'), ph(3, 'the page.')] : [ph(3, 'the AI'), ph(3, 'rewrites'), ph(3, 'the page.')];
  kinetic(ctx, t, rr, { x: TX, y: ry, size: P ? 88 : 92, lh: P ? 96 : 100, exit: 22.1, accent: new Set(['rewrites']) });
}

// ------------------------------------------------------------------ 5 any coin (22.4 - 25.5)
const COIN_ORDER = ['USDC', 'ETH', 'BTC', 'SOL', 'NEAR', 'USDT', 'XRP', 'ZEC'];
const coinLand = (i) => 22.78 + i * 0.22;
function sCoins(ctx, t, I) {
  const out = ez(t, 25.1, 25.45, E.inCubic) * W;
  ctx.save();
  ctx.translate(-out, 0);
  const w = P ? 820 : 740;
  const src = [4, 4, 888, 824];
  const sc = w / src[2];
  const pop = sp(t, 22.4, SPRING.bouncy);
  const flipA = 1 - ez(t, 24.55, 24.72, E.inCubic);
  const flipB = ez(t, 24.72, 24.95, E.outCubic);
  const cx = STAGE.x, cy = STAGE.y;
  if (flipA > 0 && pop > 0) {
    const h = (w * src[3]) / src[2];
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(0.85 + 0.15 * pop, (0.85 + 0.15 * pop) * flipA);
    card(ctx, I.coins, src, 0, 0, w, { alpha: clamp(pop * 2), radius: 34 });
    // icons not yet landed are covered by the tile's own white; the real logos fall into place
    COIN_ORDER.forEach((name, i) => {
      if (t >= coinLand(i)) return;
      const [ix, iy] = COINS[name];
      ctx.beginPath();
      ctx.arc(-w / 2 + (ix - src[0]) * sc, -h / 2 + (iy - src[1]) * sc, 52 * sc, 0, M.TAU);
      ctx.fillStyle = C.white;
      ctx.fill();
    });
    ctx.restore();
    COIN_ORDER.forEach((name, i) => {
      const tl = coinLand(i);
      const f = prog(t, tl - 0.5, tl);
      if (f <= 0 || f >= 1) return;
      const [ix, iy] = COINS[name];
      const sc2 = sc * (0.85 + 0.15 * pop);
      const tx = cx - (w * sc2) / sc / 2 + (ix - src[0]) * sc2;
      const ty = cy - ((w * src[3]) / src[2] * sc2) / sc / 2 + (iy - src[1]) * sc2;
      const y = lerp(-120, ty, E.inQuad(f));
      const x = tx + (1 - f) * (i % 2 ? 90 : -90);
      coin(ctx, I.coinsRaw, name, x, y, 37 * sc2 * 1.15, { rot: (1 - f) * 4 * (i % 2 ? 1 : -1) });
    });
  }
  if (flipB > 0) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, flipB);
    card(ctx, I.quote, [4, 4, 888, 812], 0, 0, w, { radius: 34 });
    ctx.restore();
  }
  const y0 = P ? 360 : 400;
  kinetic(ctx, t, [ph(4, 'Pay with')], { x: TX, y: y0, size: 58, family: UI, color: C.muted });
  kinetic(ctx, t, [ph(4, 'any coin')], { x: TX, y: y0 + (P ? 150 : 170), size: P ? 150 : 140, accent: new Set(['any']) });
  kinetic(ctx, t, [ph(4, 'you already own.')], { x: TX, y: y0 + (P ? 250 : 280), size: 54, family: UI, color: C.muted });
  ctx.restore();
}

// ------------------------------------------------------------------ 6 the judge and the panel (25.1 - 31.9)
function sJudge(ctx, t, I) {
  const enter = sp(t, 25.12, SPRING.gentle);
  const out = ez(t, 31.5, 31.85, E.inCubic);
  ctx.save();
  ctx.translate(0, -out * H);
  shakeAt(ctx, t, 28.1, 22);
  const v = { ...VIEW, x: VIEW.x + (1 - enter) * W };
  const c = cam(t, [[25, 25, WALL.page], [25.55, 26.5, WALL.myth, 1.12]], v, 0.01);
  windowCard(ctx, v);
  inView(ctx, v, c, (g) => {
    g.drawImage(I.wall, 0, 0);
    ring(g, t, [368, 990, 1656, 1112], 26.2, 27.0, { color: C.orange, width: 5 });
  });
  // dim the page once the judge speaks
  const dim = ez(t, 26.9, 27.3) * 0.55;
  if (dim > 0) {
    ctx.save();
    ctx.globalAlpha = dim;
    M.rrect(ctx, v.x, v.y, v.w, v.h, v.r);
    ctx.fillStyle = C.paper;
    ctx.fill();
    ctx.restore();
  }
  // the judge's verdict rises; "Settled: False" slams on top of it
  const jw = P ? 820 : 700;
  const jIn = sp(t, 26.95, SPRING.snappy);
  const jOut = ez(t, 28.95, 29.35, E.inCubic);
  const jy = (P ? 1190 : 640) + (1 - jIn) * 700;
  if (jIn > 0 && jOut < 1) {
    card(ctx, I.judge, [44, 1505, 672, 556], STAGE.x - jOut * W, jy, jw, { radius: 30 });
    const st = sp(t, 27.98, SPRING.bouncy);
    if (st > 0) {
      const sq = 0.07 * M.wobble(t - 28.1, 2.6, 6);
      const s0 = lerp(1.7, 1, st);
      ctx.save();
      ctx.translate(STAGE.x - jOut * W, jy - (P ? 330 : 330));
      ctx.rotate(-0.035);
      ctx.scale(s0 * (1 + sq), s0 * (1 - sq));
      card(ctx, I.settled, [0, 0, 760, 330], 0, 0, jw * 0.92, { alpha: clamp(st * 3), radius: 28 });
      ctx.restore();
    }
  }
  // the three-model panel: each vote appears as it is said
  const pIn = sp(t, 29.0, SPRING.snappy);
  if (pIn > 0) {
    const pw = P ? 860 : 720;
    const src = [44, 530, 672, 560];
    const h = (pw * src[3]) / src[2];
    const cx = STAGE.x + (1 - pIn) * W, cy = (P ? 1170 : 560);
    card(ctx, I.panel, src, cx, cy, pw, { radius: 30 });
    const sc = pw / src[2];
    const rows = [[825, 875, 30.09], [875, 918, 30.49], [918, 962, 30.91], [962, 1060, 31.2]];
    ctx.save();
    M.rrect(ctx, cx - pw / 2, cy - h / 2, pw, h, 30);
    ctx.clip();
    rows.forEach(([y0, y1, tv]) => {
      const r = E.outCubic(prog(t, tv - 0.05, tv + 0.25));
      if (r >= 1) return;
      const yy = cy - h / 2 + (y0 - src[1]) * sc;
      const x0 = cx - pw / 2 + 30 * sc, full = pw - 60 * sc;
      ctx.fillStyle = C.white;
      ctx.fillRect(x0 + r * full, yy, full * (1 - r), (y1 - y0) * sc);
    });
    ctx.restore();
  }
  const y0 = P ? 340 : 330;
  kinetic(ctx, t, [ph(5, 'When a fact can be checked,')], { x: TX, y: y0, size: P ? 48 : 46, family: UI, color: C.muted, exit: 28.95 });
  kinetic(ctx, t, [ph(5, 'an AI judge'), ph(5, 'settles it.')], { x: TX, y: y0 + (P ? 150 : 160), size: P ? 112 : 108, lh: P ? 116 : 112, exit: 28.95, accent: new Set(['AI']) });
  kinetic(ctx, t, [ph(5, 'Disagree?')], { x: TX, y: y0 + (P ? 150 : 160), size: P ? 112 : 108, exit: 29.95 });
  kinetic(ctx, t, [ph(5, 'Three AIs'), ph(5, 'vote.')], { x: TX, y: y0 + (P ? 150 : 160), size: P ? 112 : 120, lh: P ? 116 : 124, accent: new Set(['AIs']) });
  ctx.restore();
}

// ------------------------------------------------------------------ 7 open questions (31.6 - 36.5)
function sOpen(ctx, t, I) {
  const k = sp(t, 31.62, SPRING.gentle);
  const out = ez(t, 36.1, 36.45, E.inCubic);
  const w = P ? 860 : 760;
  const src = [44, 1515, 672, 580];
  const z = 1.06 ** ez(t, 31.6, 36.3, E.inOutSine);
  const cx = STAGE.x, cy = STAGE.y + (P ? 10 : 0) + (1 - k) * 600 - out * H;
  card(ctx, I.cant, src, cx, cy, w, { scale: z, radius: 30 });
  // ring the real "Can't settle yet" pill when "open" is said
  const sc = (w / src[2]) * z, h = (w * src[3]) / src[2] * z;
  const toC = (x, y) => [cx - (w * z) / 2 + x * sc, cy - h / 2 + y * sc];
  const [x0, y0] = toC(380, 46), [x1, y1] = toC(650, 108);
  ring(ctx, t, [x0, y0, x1, y1], 34.3, 36.0, { width: 5, radius: 26, pad: 6 });
  const ty = P ? 380 : 400;
  ctx.save();
  ctx.translate(0, -out * 120);
  ctx.globalAlpha = 1 - out;
  kinetic(ctx, t, [ph(6, 'Facts nobody can prove yet')], { x: TX, y: ty, size: P ? 50 : 48, family: UI, color: C.muted });
  kinetic(ctx, t, [ph(6, 'stay open.')], { x: TX, y: ty + (P ? 170 : 180), size: P ? 150 : 150, accent: new Set(['open.']) });
  kinetic(ctx, t, [ph(6, 'Honestly.')], { x: TX, y: ty + (P ? 270 : 290), size: 54, family: UI, color: C.ink, weight: 600 });
  ctx.restore();
}

// ------------------------------------------------------------------ 8 end card (36.3 - 46)
function sEnd(ctx, t) {
  logo(ctx, W / 2, P ? 600 : 290, P ? 84 : 66, prog(t, 36.4, 37.3));
  wordmark(ctx, t, 36.8, W / 2, P ? 900 : 510, P ? 190 : 170);
  const rows = P ? [ph(7, 'The encyclopedia that'), ph(7, 'knows how sure it is.')] : [ph(7, 'The encyclopedia that knows how sure it is.')];
  kinetic(ctx, t, rows, { x: W / 2, y: P ? 1020 : 615, size: P ? 54 : 50, lh: 74, family: UI, color: C.muted, align: 'center' });
  label(ctx, t, 'verity-pied-phi.vercel.app', W / 2, P ? 1300 : 790, P ? 46 : 40, { t0: 40.9, color: C.blue, align: 'center', weight: 600 });
  kinetic(ctx, t, [ph(7, 'Built on NEAR.')], { x: W / 2, y: P ? 1380 : 860, size: P ? 42 : 36, family: UI, color: C.muted, align: 'center' });
}

// ------------------------------------------------------------------ sound: every accent, in seconds
const hit = (t, lab, sfx, opts) => [(t - GRIDJ.offset) / GRIDJ.period, lab, sfx, opts];
const HITS = [
  hit(0.05, 'paragraph in', 'whoosh', { len: 0.5 }),
  hit(1.91, "what's", 'pop', { pitch: 'A5' }),
  hit(2.25, 'true', 'pop', { pitch: 'D6' }),
  hit(3.78, 'how', 'pop', { pitch: 'A5' }),
  hit(4.16, 'sure', 'pop', { pitch: 'D6' }),
  hit(4.62, '? lands', 'thud'),
  hit(5.55, 'card away', 'whoosh', { len: 0.4 }),
  hit(6.25, 'cards fan', 'whoosh', { len: 0.5, from: 600, to: 2400 }),
  hit(6.35, 'Verity', 'impact'),
  hit(6.85, 'check mark', 'bell', { pitch: 'D6' }),
  hit(10.75, 'whip', 'whoosh', { len: 0.4 }),
  hit(11.6, 'underline', 'whoosh', { len: 0.5, from: 900, to: 2600 }),
  hit(14.2, 'to card', 'whoosh', { len: 0.35 }),
  hit(14.3, '14%', 'blip', { pitch: 'E6' }),
  hit(16.21, '$100', 'click'),
  hit(16.75, 'bet', 'click'),
  hit(17.6, 'odds roll', 'tick'),
  hit(19.0, '37%', 'blip', { pitch: 'A6' }),
  hit(20.0, 'rewrite sweep', 'whoosh', { len: 0.8, from: 600, to: 3000 }),
  hit(21.05, 'new wording', 'bell', { pitch: 'D6' }),
  hit(22.45, 'picker', 'pop', { pitch: 'D5' }),
  ...COIN_ORDER.map((n, i) => hit(coinLand(i), `coin ${n}`, 'pop', { pitch: ['D5', 'F5', 'A5', 'C6', 'D6', 'F6', 'A6', 'C7'][i] })),
  hit(24.72, 'quote flip', 'click'),
  hit(24.95, 'quote', 'coins'),
  hit(25.25, 'window', 'whoosh', { len: 0.4 }),
  hit(27.0, 'judge', 'click'),
  hit(28.1, 'Settled: False', 'impact'),
  hit(29.1, 'panel', 'whoosh', { len: 0.35 }),
  hit(30.09, 'vote 1', 'tok', { pitch: 'D5' }),
  hit(30.49, 'vote 2', 'tok', { pitch: 'F5' }),
  hit(30.91, 'vote 3', 'tok', { pitch: 'A5' }),
  hit(31.25, 'final answer', 'thud'),
  hit(31.75, 'open card', 'swell'),
  hit(34.32, 'open', 'bell', { pitch: 'A5' }),
  hit(36.82, 'end card', 'impact'),
  hit(37.25, 'logo check', 'bell', { pitch: 'D6' }),
];

M.film({
  fonts: [font(100, 500, DISPLAY), font(100, 600, DISPLAY), font(40, 500, UI), font(40, 600, UI)],
  images: {
    para: 'assets/shots/flow/c02_paragraph.png',
    home: 'assets/shots/flow/d01_home.png',
    d02: 'assets/shots/flow/d02_everest.png',
    card100: 'assets/shots/flow/c03_card_100.png',
    cardAfter: 'assets/shots/flow/c05_card_after.png',
    rewriting: 'assets/shots/flow/c04_paragraph_rewriting.png',
    rewritten: 'assets/shots/flow/c05_paragraph_rewritten.png',
    coins: 'assets/shots/flow/c06_coins.png',
    coinsRaw: 'assets/shots/flow/c06_coins.png',
    quote: 'assets/shots/flow/c07_quote.png',
    wall: 'assets/shots/flow/d09_wall.png',
    judge: 'assets/shots/flow/c10_judge_says.png',
    settled: 'assets/shots/flow/c11_card_settled.png',
    panel: 'assets/shots/flow/c12_panel.png',
    cant: 'assets/shots/flow/c13_cant_settle.png',
  },
  hits: HITS,
  draw(ctx, u, t, I) {
    M.fill(ctx, C.paper);
    if (t < 6.0) sHook(ctx, t, I);
    if (t >= 5.9 && t < 11.0) sBrand(ctx, t, I);
    if (t >= 10.4 && t < 22.7) sEverest(ctx, t, I);
    if (t >= 22.3 && t < 25.5) sCoins(ctx, t, I);
    if (t >= 25.05 && t < 31.9) sJudge(ctx, t, I);
    if (t >= 31.55 && t < 36.5) sOpen(ctx, t, I);
    if (t >= 36.3) sEnd(ctx, t);
  },
});
