// Verity promo: a pure function of time. window.seek(t) paints frame t.
// Timing is in beats (u) on the measured grid (120 bpm, 2 beats = 1 s); docs/shotlist.md is the plan.
// Every product image is a real screen captured from the app (assets/shots/flow, by ../capture.mjs).
import * as M from './lib/motion.js';

const { W, H, FORMAT, E, prog, lerp, springU, SPRING, wobble, font, layout, glyph, text, fill, rrect, clamp } = M;

// Atlas brand tokens (web/src/app/globals.css). One accent: truth blue. Myth orange appears only
// where the product itself shows it.
const C = { paper: '#F7F4EE', ink: '#1C1917', muted: '#57534E', line: '#E7E1D6', blue: '#1E40AF', orange: '#C2410C', white: '#FFFFFF' };
const DISPLAY = 'Display', UI = 'UI';
const P = FORMAT.portrait;
const s = FORMAT.safe;

const HITS = [
  [0, 'Every', 'impact'],
  [0.5, 'fact', 'pop', { pitch: 'A5' }],
  [1, 'has', 'pop', { pitch: 'C6' }],
  [1.5, 'a', 'pop', { pitch: 'D6' }],
  [2, 'price.', 'pop', { pitch: 'F6' }],
  [2.6, 'underline', 'whoosh', { len: 0.4, from: 900, to: 2600 }],
  [4, 'paragraph', 'click'],
  [6, '14%', 'blip', { pitch: 'E6' }],
  [7.75, 'whip to card', 'whoosh', { len: 0.4 }],
  [8, 'drop: card lands', 'impact'],
  [10, '$100 chip', 'click'],
  [11, '-> 37%', 'blip', { pitch: 'A6' }],
  [12, 'rewrite sweep', 'riser', { len: 0.5 }],
  [12.5, 'highlight', 'whoosh', { len: 0.5, from: 600, to: 3000 }],
  [16, 'new wording', 'bell', { pitch: 'D6' }],
  [20, 'coin wave', 'pop', { pitch: 'D5' }],
  [20.5, 'coin', 'pop', { pitch: 'F5' }],
  [21, 'coin', 'pop', { pitch: 'A5' }],
  [24, 'quote', 'coins'],
  [28, 'judge box', 'click'],
  [32, 'Settled: False', 'thud'],
  [36, 'panel', 'click'],
  [37, 'vote 1', 'tok', { pitch: 'D5' }],
  [38, 'vote 2', 'tok', { pitch: 'F5' }],
  [39, 'vote 3', 'tok', { pitch: 'A5' }],
  [40, 'final answer', 'thud'],
  [43.75, 'whip', 'whoosh', { len: 0.4 }],
  [44, 'open question', 'swell'],
  [50, 'montage 1', 'click'],
  [52, 'montage 2', 'click'],
  [54, 'montage 3', 'click'],
  [56, 'end card', 'impact'],
  [56.75, 'logo check', 'bell', { pitch: 'D6' }],
];

// ------------------------------------------------------------------ helpers

/** A real screenshot (or a source-pixel crop of one) as a floating card with a soft shadow. */
function card(ctx, img, src, cx, cy, w, { alpha = 1, scale = 1, radius = 26, shadow = 1, clipY = 1 } = {}) {
  if (!img || alpha <= 0) return;
  const [sx, sy, sw, sh] = src || [0, 0, img.width, img.height];
  const h = (w * sh) / sw;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  if (shadow > 0) {
    ctx.save();
    ctx.shadowColor = `rgba(28,25,23,${0.16 * shadow})`;
    ctx.shadowBlur = 60;
    ctx.shadowOffsetY = 24;
    rrect(ctx, -w / 2, -h / 2, w, h, radius);
    ctx.fillStyle = C.white;
    ctx.fill();
    ctx.restore();
  }
  rrect(ctx, -w / 2, -h / 2, w, h * clipY, radius);
  ctx.clip();
  ctx.drawImage(img, sx, sy, sw, sh, -w / 2, -h / 2, w, h);
  ctx.restore();
  return h;
}

/** Display headline, word by word on given beats; lines are arrays of words. */
function headline(ctx, u, lines, { x, y, size, start, step = 0.5, color = C.ink, exitAt = 1e9, accentWord = -1 }) {
  const f = font(size, 500, DISPLAY);
  const lh = size * 1.02;
  let wi = 0;
  const exit = E.inBack(prog(u, exitAt, exitAt + 0.5), 1.2);
  lines.forEach((words, li) => {
    let cx = x;
    words.forEach((word) => {
      const L = layout(ctx, word, f, -0.02 * size);
      const u0 = start + wi * step;
      const k = springU(u, u0, SPRING.snappy);
      if (k > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(cx - 10, y + li * lh - size * 1.05, L.width + 40, size * 1.35);
        ctx.clip();
        text(ctx, word, cx, y + li * lh + (1 - k) * size * 0.9 + exit * size * 1.3, f, wi === accentWord ? C.blue : color, 'left', -0.02 * size);
        ctx.restore();
      }
      cx += L.width + size * 0.26;
      wi++;
    });
  });
  return lh * lines.length;
}

function label(ctx, str, x, y, size, color = C.muted, align = 'left') {
  text(ctx, str, x, y, font(size, 500, UI), color, align);
}

function pill(ctx, str, x, y, size, k = 1) {
  if (k <= 0) return;
  const f = font(size, 600, UI);
  ctx.font = f;
  const w = ctx.measureText(str).width + size * 2.6;
  const h = size * 2.1;
  ctx.save();
  ctx.globalAlpha = clamp(k);
  ctx.translate(x + w / 2, y);
  ctx.scale(0.8 + 0.2 * k, 0.8 + 0.2 * k);
  rrect(ctx, -w / 2, -h / 2, w, h, h / 2);
  ctx.fillStyle = C.white;
  ctx.fill();
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-w / 2 + size * 1.1, 0, size * 0.32, 0, M.TAU);
  ctx.fillStyle = '#2563EB';
  ctx.fill();
  text(ctx, str, -w / 2 + size * 1.75, size * 0.36, f, C.blue);
  ctx.restore();
}

/** Logo: the circle and the check mark from web/public/favicon.svg, drawn on. */
function logo(ctx, cx, cy, r, p) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = r * 0.12;
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + M.TAU * E.outCubic(prog(p, 0, 0.55)));
  ctx.stroke();
  const q = E.outCubic(prog(p, 0.45, 1));
  if (q > 0) {
    const pts = [[-0.46, 0.04], [-0.12, 0.38], [0.5, -0.36]];
    ctx.strokeStyle = C.blue;
    ctx.lineWidth = r * 0.17;
    ctx.beginPath();
    ctx.moveTo(cx + pts[0][0] * r, cy + pts[0][1] * r);
    const seg1 = clamp(q * 2), seg2 = clamp(q * 2 - 1);
    ctx.lineTo(cx + lerp(pts[0][0], pts[1][0], seg1) * r, cy + lerp(pts[0][1], pts[1][1], seg1) * r);
    if (seg2 > 0) ctx.lineTo(cx + lerp(pts[1][0], pts[2][0], seg2) * r, cy + lerp(pts[1][1], pts[2][1], seg2) * r);
    ctx.stroke();
  }
  ctx.restore();
}

// Layout: where the headline sits and where the product sits, per format.
const HEAD = P ? { x: s.x, y: s.y + 120, size: 104 } : { x: s.x + 40, y: H * 0.42, size: 96 };
const STAGE = P ? { cx: W / 2, cy: s.y + s.h * 0.66 } : { cx: W * 0.68, cy: H / 2 };

// ------------------------------------------------------------------ S1 hook  (u 0..4)
function sHook(ctx, u) {
  const size = P ? 150 : 150;
  const x = P ? s.x : W * 0.12;
  const y = P ? s.y + s.h * 0.36 : H * 0.44;
  headline(ctx, u, P ? [['Every'], ['fact', 'has'], ['a', 'price.']] : [['Every', 'fact'], ['has', 'a', 'price.']], { x, y, size, start: -0.45, step: 0.5, exitAt: 3.5 });
  // the orange underline under "price." draws on, then stretches out of frame into shot 2
  const f = font(size, 500, DISPLAY);
  ctx.font = f;
  const lineW = P ? 0 : ctx.measureText('has a ').width + size * 0.26 * 2 - ctx.measureText(' ').width * 2;
  const pw = ctx.measureText('price.').width;
  const lx = P ? x + ctx.measureText('a').width + size * 0.26 : x + lineW;
  const ly = y + (P ? 2 : 1) * size * 1.02 + size * 0.16;
  const d = E.outCubic(prog(u, 2.4, 3.1));
  const stretch = E.inCubic(prog(u, 3.4, 4));
  if (d > 0) {
    ctx.fillStyle = C.orange;
    const x0 = lerp(lx, 0, stretch);
    ctx.fillRect(x0, ly, lerp(pw * d, W, stretch), size * 0.06);
  }
}

// ------------------------------------------------------------------ S2 the claim  (u 4..8)
function sClaim(ctx, u, I) {
  const w = P ? W * 0.94 : W * 0.86;
  // log-space push: constant-rate dolly
  const z = 1.0 * (1.12 / 1.0) ** E.inOutSine(prog(u, 4, 8));
  const k = springU(u, 3.9, SPRING.gentle);
  const whip = E.inCubic(prog(u, 7.6, 8.1));
  // portrait: the paragraph is wider than the frame, so the camera sits on the Mallory sentence
  const cx = W / 2 - whip * W;
  card(ctx, I.para, null, cx, H / 2 + (1 - k) * 120, w, { scale: z, shadow: 0.6, radius: 18 });
  label(ctx, 'Mount Everest', P ? s.x : W * 0.07 - whip * W, P ? s.y + 60 : H * 0.16, P ? 44 : 40, C.ink);
}

// ------------------------------------------------------------------ S3 the market card  (u 8..12)
function sCard(ctx, u, I) {
  const inK = springU(u, 7.75, SPRING.snappy);
  const out = E.inCubic(prog(u, 11.6, 12.1));
  const w = P ? s.w * 0.78 : 620;
  const src = [0, 0, 760, 1150];
  const cx = lerp(W + w, STAGE.cx, inK) - out * W;
  const q = 0.035 * wobble((u - 8) * 0.5, 2.2, 6);
  const swap = prog(u, 10, 10.2);
  const img = swap < 1 ? I.card : I.card100;
  ctx.save();
  ctx.translate(cx, STAGE.cy);
  ctx.scale(1 + q, 1 - q);
  card(ctx, img, src, 0, 0, w, { radius: 28 });
  if (swap > 0 && swap < 1) card(ctx, I.card100, src, 0, 0, w, { alpha: swap, radius: 28, shadow: 0 });
  ctx.restore();
  headline(ctx, u, P ? [['Think'], ['it’s', 'true?']] : [['Think'], ['it’s', 'true?']], { ...HEAD, x: HEAD.x - out * W, start: 8.25, step: 0.4 });
  const bet = springU(u, 10.5, SPRING.bouncy);
  if (bet > 0) {
    const y = P ? HEAD.y + HEAD.size * 2.25 : HEAD.y + HEAD.size * 2.6;
    text(ctx, 'Bet on it.', HEAD.x - out * W, y + (1 - bet) * 40, font(HEAD.size * 0.62, 600, UI), C.blue);
  }
}

// ------------------------------------------------------------------ S4 the rewrite  (u 12..20)
function sRewrite(ctx, u, I) {
  const k = springU(u, 11.8, SPRING.gentle);
  const out = E.inCubic(prog(u, 19.6, 20.1));
  const w = P ? W * 0.94 : W * 0.78;
  const cx = W / 2 + (1 - k) * W * 0.4;
  const cy = P ? s.y + s.h * 0.62 : H * 0.6;
  const h = card(ctx, I.para, null, cx, cy - out * H, w, { shadow: 0.6, radius: 18 });
  // the AI's rewrite sweeps across: the real highlighted frame revealed left to right
  const sweep = E.inOutCubic(prog(u, 12.4, 13.6));
  if (sweep > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - w / 2, cy - h / 2 - out * H, w * sweep, h);
    ctx.clip();
    card(ctx, I.rewriting, null, cx, cy - out * H, w, { shadow: 0, radius: 18 });
    ctx.restore();
  }
  const settle = prog(u, 15.4, 16.4);
  if (settle > 0) card(ctx, I.rewritten, null, cx, cy - out * H, w, { alpha: E.inOutSine(settle), shadow: 0, radius: 18 });
  const hy = P ? s.y + 110 : H * 0.2;
  headline(ctx, u, P ? [['The', 'page'], ['rewrites'], ['itself.']] : [['The', 'page', 'rewrites', 'itself.']], { x: P ? s.x : W * 0.11, y: hy - out * H, size: P ? 112 : 92, start: 11.6, step: 0.45, accentWord: 2 });
  const lab = E.outCubic(prog(u, 16, 16.6));
  if (lab > 0) label(ctx, '14% → 37%: now “still an open question.”', P ? s.x : W * 0.11, (P ? s.y + s.h - 40 : H * 0.88) - out * H + (1 - lab) * 20, P ? 38 : 32, C.muted);
}

// ------------------------------------------------------------------ S5 any coin  (u 20..28)
function sCoins(ctx, u, I) {
  const out = E.inCubic(prog(u, 27.6, 28.1));
  const w = P ? s.w * 0.9 : 800;
  const pop = springU(u, 19.5, SPRING.bouncy);
  const push = E.inOutCubic(prog(u, 23.6, 24.4));
  const cy = STAGE.cy;
  const sc = 0.85 + 0.15 * pop;
  // A slides up and out as B slides up and in: both on screen during the push.
  card(ctx, I.coins, [4, 4, 888, 824], STAGE.cx, cy - push * H * 0.9 - out * H, w, { alpha: clamp(pop * 2), scale: sc, radius: 36 });
  if (push > 0) card(ctx, I.quote, [4, 4, 888, 812], STAGE.cx, cy + (1 - push) * H * 0.9 - out * H, w, { radius: 36 });
  const y = P ? s.y + 110 : HEAD.y - 40;
  headline(ctx, u, P ? [['Bet', 'with'], ['any', 'coin.']] : [['Bet', 'with'], ['any', 'coin.']], { x: HEAD.x, y: y - out * H, size: HEAD.size, start: 20, step: 0.5, accentWord: 2 });
  const lab = E.outCubic(prog(u, 24.4, 25));
  if (lab > 0) label(ctx, 'Live prices from NEAR Intents', HEAD.x, y + HEAD.size * 2.3 - out * H + (1 - lab) * 20, P ? 38 : 32);
}

// ------------------------------------------------------------------ S6 the judge  (u 28..36)
function sJudge(ctx, u, I) {
  const out = E.inCubic(prog(u, 35.6, 36.1));
  const w = P ? s.w * 0.92 : 820;
  const rise = springU(u, 27.3, SPRING.snappy);
  const cy = STAGE.cy + (P ? 120 : 90);
  card(ctx, I.judge, [44, 1505, 672, 556], STAGE.cx, cy + (1 - rise) * 260 - out * H, w, { alpha: clamp(rise * 1.5), radius: 30 });
  // the real "Settled: False" header stamps in above, with squash and settle
  const st = springU(u, 31.8, SPRING.bouncy);
  if (st > 0) {
    const q = 0.06 * wobble((u - 32) * 0.5, 2.6, 7);
    ctx.save();
    ctx.translate(STAGE.cx, cy - (P ? 470 : 330) - out * H);
    ctx.scale((0.6 + 0.4 * st) * (1 + q), (0.6 + 0.4 * st) * (1 - q));
    card(ctx, I.settled, [0, 0, 760, 330], 0, 0, w, { alpha: clamp(st * 2), radius: 30 });
    ctx.restore();
  }
  const y = P ? s.y + 60 : HEAD.y - 40;
  if (!P) headline(ctx, u, [['An', 'AI', 'judge'], ['settles', 'it.']], { x: HEAD.x, y: y - out * H, size: HEAD.size, start: 28, step: 0.4, accentWord: 1 });
  else headline(ctx, u, [['An', 'AI', 'judge'], ['settles', 'it.']], { x: s.x, y: s.y + 100 - out * H, size: 96, start: 28, step: 0.4, accentWord: 1 });
}

// ------------------------------------------------------------------ S7 the panel  (u 36..44)
function sPanel(ctx, u, I) {
  const k = springU(u, 35.8, SPRING.snappy);
  const out = E.inCubic(prog(u, 43.6, 44.1)) * (P ? 1 : 1);
  const w = P ? s.w * 0.92 : 840;
  const src = [44, 530, 672, 560];
  const h = (w * src[3]) / src[2];
  const cx = STAGE.cx - out * W, cy = STAGE.cy + (1 - k) * H * 0.6;
  card(ctx, I.panel, src, cx, cy, w, { radius: 30 });
  // reveal the three votes on their beats: cover rows not yet cast with the box's own white
  const sc = w / src[2];
  const rows = [[825, 875, 37], [875, 918, 38], [918, 962, 39], [962, 1060, 40]];
  ctx.save();
  rrect(ctx, cx - w / 2, cy - h / 2, w, h, 30);
  ctx.clip();
  rows.forEach(([y0, y1, ub]) => {
    const r = E.outCubic(prog(u, ub, ub + 0.35));
    if (r >= 1) return;
    ctx.fillStyle = C.white;
    const yy = cy - h / 2 + (y0 - src[1]) * sc;
    const x0 = cx - w / 2 + 30 * sc, full = w - 60 * sc;
    ctx.fillRect(x0 + r * full, yy, full * (1 - r), (y1 - y0) * sc);
  });
  ctx.restore();
  const y = P ? s.y + 100 : HEAD.y - 40;
  headline(ctx, u, [['Disputes', 'go', 'to'], ['three', 'AIs.']], { x: (P ? s.x : HEAD.x) - out * W, y, size: P ? 96 : HEAD.size, start: 36, step: 0.35, accentWord: 3 });
}

// ------------------------------------------------------------------ S8 open questions  (u 44..50)
function sOpen(ctx, u, I) {
  const inK = E.outCubic(prog(u, 43.6, 44.1));
  const out = E.inCubic(prog(u, 49.6, 50));
  const w = P ? s.w * 0.92 : 840;
  const z = 1.0 * (1.06) ** E.inOutSine(prog(u, 44, 50));
  card(ctx, I.cant, [44, 1515, 672, 580], STAGE.cx + (1 - inK) * W, STAGE.cy + (P ? 80 : 40), w, { scale: z, radius: 30, alpha: 1 - out });
  const y = P ? s.y + 100 : HEAD.y - 40;
  headline(ctx, u, [['Open', 'questions'], ['stay', 'open.']], { x: (P ? s.x : HEAD.x) + (1 - inK) * W, y, size: P ? 104 : HEAD.size, start: 44.3, step: 0.45 });
}

// ------------------------------------------------------------------ S9 montage  (u 50..56)
function sMontage(ctx, u, I) {
  const i = u < 52 ? 0 : u < 54 ? 1 : 2;
  const u0 = 50 + i * 2;
  const z = 1.0 * (1.08) ** prog(u, u0, u0 + 2);
  const shots = P ? [I.phone, I.homeMobile, I.live] : [I.home, I.phone, I.live];
  const img = shots[i];
  const isPhone = img === I.phone || img === I.homeMobile;
  // portrait: the Live screen is cropped to its right half (Live pill, wallet button, market card)
  const src = P && img === I.live ? [1500, 0, 1380, 1800] : null;
  const w = isPhone ? (P ? s.w * 0.7 : 430) : P ? s.w * 0.98 : W * 0.78;
  card(ctx, img, src, W / 2, isPhone ? H / 2 + (P ? 60 : 0) : P ? H * 0.55 : H * 0.52, w, { scale: z, radius: isPhone ? 46 : 22 });
  if (img === I.live) pill(ctx, 'Live · real USDC on NEAR', P ? s.x : W * 0.11, P ? s.y + 60 : H * 0.09, P ? 34 : 28, springU(u, 54.2, SPRING.bouncy));
  if (img === I.phone) label(ctx, 'On any phone', P ? s.x : W * 0.11, P ? s.y + 60 : H * 0.12, P ? 40 : 34, C.ink);
  if (img === I.home || img === I.homeMobile) label(ctx, 'Demo or Live', P ? s.x : W * 0.11, P ? s.y + 60 : H * 0.12, P ? 40 : 34, C.ink);
}

// ------------------------------------------------------------------ S10 end card  (u 56..60)
function sEnd(ctx, u) {
  const p = prog(u, 55.7, 57.1);
  const cx = W / 2;
  const cy = P ? H * 0.38 : H * 0.34;
  logo(ctx, cx, cy, P ? 90 : 70, p);
  const nameK = springU(u, 55.9, SPRING.snappy);
  const nameSize = P ? 150 : 140;
  if (nameK > 0) {
    ctx.save();
    ctx.globalAlpha = clamp(nameK * 1.5);
    text(ctx, 'Verity', cx, cy + (P ? 290 : 230) + (1 - nameK) * 50, font(nameSize, 600, DISPLAY), C.ink, 'center', -0.02 * nameSize);
    ctx.restore();
  }
  const tag = E.outCubic(prog(u, 57.2, 57.9));
  if (tag > 0) {
    ctx.save();
    ctx.globalAlpha = tag;
    const ty = cy + (P ? 400 : 320) + (1 - tag) * 20;
    if (P) {
      text(ctx, 'The encyclopedia that knows', cx, ty, font(48, 500, UI), C.muted, 'center');
      text(ctx, 'how sure it is.', cx, ty + 64, font(48, 500, UI), C.muted, 'center');
    } else text(ctx, 'The encyclopedia that knows how sure it is.', cx, ty, font(40, 500, UI), C.muted, 'center');
    ctx.restore();
  }
  const url = E.outCubic(prog(u, 57.8, 58.4));
  if (url > 0) {
    ctx.save();
    ctx.globalAlpha = url;
    const uy = P ? H * 0.72 : H * 0.8;
    text(ctx, 'verity-pied-phi.vercel.app', cx, uy, font(P ? 44 : 36, 600, UI), C.blue, 'center');
    text(ctx, 'Built on NEAR', cx, uy + (P ? 70 : 56), font(P ? 36 : 30, 500, UI), C.muted, 'center');
    ctx.restore();
  }
}

M.film({
  fonts: [font(100, 500, DISPLAY), font(100, 600, DISPLAY), font(40, 500, UI), font(40, 600, UI)],
  images: {
    para: 'assets/shots/flow/c02_paragraph.png',
    card: 'assets/shots/flow/c02_card_mallory.png',
    card100: 'assets/shots/flow/c03_card_100.png',
    rewriting: 'assets/shots/flow/c04_paragraph_rewriting.png',
    rewritten: 'assets/shots/flow/c05_paragraph_rewritten.png',
    coins: 'assets/shots/flow/c06_coins.png',
    quote: 'assets/shots/flow/c07_quote.png',
    judge: 'assets/shots/flow/c10_judge_says.png',
    settled: 'assets/shots/flow/c11_card_settled.png',
    panel: 'assets/shots/flow/c12_panel.png',
    cant: 'assets/shots/flow/c13_cant_settle.png',
    home: 'assets/shots/flow/d01_home.png',
    homeMobile: 'assets/shots/mobile_viewport.png',
    phone: 'assets/shots/flow/m02_sheet.png',
    live: 'assets/shots/flow/d17_live_everest.png',
  },
  hits: HITS,
  draw(ctx, u, t, I) {
    fill(ctx, C.paper);
    if (u < 4) sHook(ctx, u);
    else if (u < 8) {
      sClaim(ctx, u, I);
      if (u > 7.6) sCard(ctx, u, I);
    } else if (u < 12) sCard(ctx, u, I);
    else if (u < 20) sRewrite(ctx, u, I);
    else if (u < 28) sCoins(ctx, u, I);
    else if (u < 36) sJudge(ctx, u, I);
    else if (u < 44) sPanel(ctx, u, I);
    else if (u < 50) {
      if (u < 44.2) sPanel(ctx, u, I);
      sOpen(ctx, u, I);
    } else if (u < 56) sMontage(ctx, u, I);
    else sEnd(ctx, u);
  },
});
