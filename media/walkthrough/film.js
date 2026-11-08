// Verity demo walkthrough: a pure function of time. window.seek(t) paints frame t.
// 88 bpm grid (1 beat = 0.68 s); docs/shotlist.md is the plan. Every screen is the real app,
// captured by clicking through it (assets/shots/flow, by ../capture.mjs).
import * as M from './lib/motion.js';

const { W, H, FORMAT, E, prog, lerp, springU, SPRING, font, text, fill, rrect, clamp, cover } = M;

const C = { paper: '#F7F4EE', ink: '#1C1917', muted: '#57534E', line: '#E7E1D6', blue: '#1E40AF', white: '#FFFFFF' };
const DISPLAY = 'Display', UI = 'UI';
const P = FORMAT.portrait;
const s = FORMAT.safe;

// Stage (where the screen sits) and caption area, per format.
const STAGE = P ? { x: 40, y: s.y - 60, w: W - 80, h: s.h * 0.76 } : { x: 120, y: 60, w: W - 240, h: 800 };
const CAP = P ? { x: s.x, y: STAGE.y + STAGE.h + 110, size: 54, max: s.w } : { x: W / 2, y: 962, size: 46, max: W - 300 };

function card(ctx, img, src, cx, cy, w, { alpha = 1, scale = 1, radius = 26, shadow = 1 } = {}) {
  if (!img || alpha <= 0) return 0;
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
  rrect(ctx, -w / 2, -h / 2, w, h, radius);
  ctx.clip();
  ctx.drawImage(img, sx, sy, sw, sh, -w / 2, -h / 2, w, h);
  ctx.restore();
  return h;
}

/** Fit a crop inside the stage (contain), centred, with an optional width cap. */
function fit(ctx, img, src, opts = {}) {
  const [, , sw, sh] = src || [0, 0, img.width, img.height];
  const maxW = opts.maxW ?? STAGE.w;
  const w = Math.min(maxW, (STAGE.h * 0.94 * sw) / sh);
  card(ctx, img, src, STAGE.x + STAGE.w / 2 + (opts.dx ?? 0), STAGE.y + STAGE.h / 2 + (opts.dy ?? 0), w, opts);
  return w;
}

/** A full desktop screen filling the stage, with a camera move [fx, fy, zoom] from a to b (log-space zoom). */
function screen(ctx, img, u, u0, u1, a, b, dx = 0) {
  const p = E.inOutSine(prog(u, u0, u1));
  const z = a[2] * (b[2] / a[2]) ** p;
  ctx.save();
  ctx.shadowColor = 'rgba(28,25,23,0.14)';
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 20;
  rrect(ctx, STAGE.x + dx, STAGE.y, STAGE.w, STAGE.h, 22);
  ctx.fillStyle = C.white;
  ctx.fill();
  ctx.restore();
  cover(ctx, img, STAGE.x + dx, STAGE.y, STAGE.w, STAGE.h, { fx: lerp(a[0], b[0], p), fy: lerp(a[1], b[1], p), zoom: z, radius: 22 });
}

const STEPS = [
  { u: 0, cap: 'Verity: every fact has a market.', draw: (ctx, u, I, dx) => screen(ctx, I.home, u, 0, 8, P ? [0.15, 0.1, 1.35] : [0.5, 0, 1], P ? [0.45, 0.5, 1.5] : [0.5, 0.7, 1.05], dx) },
  { u: 8, cap: 'Each underlined fact has a market. Its colour shows how sure people are.', draw: (ctx, u, I, dx) => screen(ctx, I.everest, u, 8.5, 15.5, P ? [0.25, 0.45, 1.0] : [0.5, 0.35, 1.0], P ? [0.24, 0.6, 1.25] : [0.18, 0.68, 1.65], dx) },
  {
    u: 16,
    cap: 'Bet $100 that George Mallory got to the top first.',
    draw: (ctx, u, I, dx) => {
      const src = [0, 0, 760, 1150];
      fit(ctx, I.card, src, { dx, maxW: P ? STAGE.w * 0.8 : 560 });
      const sw = prog(u, 19.6, 20);
      if (sw > 0) fit(ctx, I.card100, src, { dx, maxW: P ? STAGE.w * 0.8 : 560, alpha: sw, shadow: 0 });
    },
  },
  {
    u: 24,
    cap: 'It crosses 30%, so the AI rewrites the sentence.',
    draw: (ctx, u, I, dx) => {
      const w = P ? STAGE.w : 1200;
      const cx = STAGE.x + STAGE.w / 2 + dx, cy = STAGE.y + STAGE.h / 2;
      const h = card(ctx, I.para, null, cx, cy, w, { radius: 18 });
      const sweep = E.inOutCubic(prog(u, 25, 26.4));
      if (sweep > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(cx - w / 2, cy - h / 2, w * sweep, h);
        ctx.clip();
        card(ctx, I.rewriting, null, cx, cy, w, { radius: 18, shadow: 0 });
        ctx.restore();
      }
      const settle = prog(u, 28.5, 29.5);
      if (settle > 0) card(ctx, I.rewritten, null, cx, cy, w, { radius: 18, shadow: 0, alpha: E.inOutSine(settle) });
    },
  },
  {
    u: 32,
    cap: 'Every rewrite is logged. Cash out any time.',
    draw: (ctx, u, I, dx) => {
      const k = springU(u, 33, SPRING.snappy);
      if (P) {
        card(ctx, I.history, [0, 0, 1288, 248], W / 2 + dx, STAGE.y + 200, STAGE.w, { radius: 18 });
        card(ctx, I.after, [0, 1250, 760, 330], W / 2 + dx + (1 - k) * W, STAGE.y + STAGE.h * 0.68, STAGE.w * 0.85, { radius: 24 });
      } else {
        card(ctx, I.history, [0, 0, 1288, 248], W / 2 + dx, STAGE.y + 200, 1500, { radius: 18 });
        card(ctx, I.after, [0, 1250, 760, 330], W / 2 + dx + (1 - k) * W, STAGE.y + 590, 700, { radius: 24 });
      }
    },
  },
  {
    u: 40,
    cap: 'Pay with ETH, BTC, SOL and more, at a live NEAR Intents price.',
    draw: (ctx, u, I, dx) => {
      const which = u < 43 ? I.coins : u < 46 ? I.quote : I.moving;
      const src = which === I.moving ? [4, 4, 888, 496] : which === I.quote ? [4, 4, 888, 812] : [4, 4, 888, 824];
      const k = u < 43 ? 1 : springU(u, u < 46 ? 42.75 : 45.75, SPRING.snappy);
      fit(ctx, which, src, { dx: dx + (1 - k) * 200, maxW: P ? STAGE.w : 760, alpha: clamp(k * 1.5), radius: 34 });
    },
  },
  {
    u: 48,
    cap: 'Ask the AI judge. It rules False. After the dispute window, winners are paid.',
    draw: (ctx, u, I, dx) => {
      if (u < 51) screen(ctx, I.wall, u, 48, 51, [0.5, 0.3, 1], [0.86, 0.4, 1.5], dx);
      else if (u < 56) fit(ctx, I.judge, [44, 1505, 672, 556], { dx, maxW: P ? STAGE.w : 820, alpha: clamp(springU(u, 50.8, SPRING.snappy) * 1.4), radius: 30 });
      else screen(ctx, I.wallSettled, u, 56, 60, P ? [0.2, 0.35, 1.2] : [0.5, 0.3, 1], P ? [0.18, 0.42, 1.4] : [0.3, 0.48, 1.45], dx);
    },
  },
  {
    u: 60,
    cap: 'Disagree? Dispute it, and three different AI models vote.',
    draw: (ctx, u, I, dx) => {
      const src = [44, 530, 672, 560];
      const w = fit(ctx, I.panel, src, { dx, maxW: P ? STAGE.w : 820, radius: 30 });
      const h = (w * src[3]) / src[2];
      const cx = STAGE.x + STAGE.w / 2 + dx, cy = STAGE.y + STAGE.h / 2;
      const sc = w / src[2];
      ctx.save();
      rrect(ctx, cx - w / 2, cy - h / 2, w, h, 30);
      ctx.clip();
      [[825, 875, 63], [875, 918, 65], [918, 962, 67], [962, 1060, 69]].forEach(([y0, y1, ub]) => {
        const r = E.outCubic(prog(u, ub, ub + 0.4));
        if (r >= 1) return;
        const x0 = cx - w / 2 + 30 * sc, full = w - 60 * sc;
        ctx.fillStyle = C.white;
        ctx.fillRect(x0 + r * full, cy - h / 2 + (y0 - src[1]) * sc, full * (1 - r), (y1 - y0) * sc);
      });
      ctx.restore();
    },
  },
  {
    u: 72,
    cap: 'No proof yet? The judge says so, and the market stays open.',
    draw: (ctx, u, I, dx) => fit(ctx, I.cant, [44, 1515, 672, 580], { dx, maxW: P ? STAGE.w : 820, radius: 30, scale: 1.0 * 1.05 ** prog(u, 72, 80) }),
  },
  { u: 80, cap: 'My bets: balance, open bets, profit and activity.', draw: (ctx, u, I, dx) => screen(ctx, I.bets, u, 80, 88, P ? [0.3, 0.0, 1.4] : [0.5, 0.0, 1.15], P ? [0.35, 0.45, 1.55] : [0.5, 0.5, 1.3], dx) },
  {
    u: 88,
    cap: 'Switch to Live: real USDC on NEAR. Your wallet confirms every bet.',
    draw: (ctx, u, I, dx) => {
      if (u < 92) fit(ctx, I.mode, [4, 4, 888, 764], { dx, maxW: P ? STAGE.w : 760, radius: 34 });
      else if (u < 96) screen(ctx, I.live, u, 92, 96, P ? [0.95, 0.15, 1.3] : [0.5, 0.1, 1.0], P ? [0.95, 0.3, 1.45] : [0.7, 0.25, 1.25], dx);
      else fit(ctx, I.connect, [4, 4, 888, 1012], { dx, maxW: P ? STAGE.w : 700, radius: 34 });
    },
  },
  {
    u: 100,
    cap: 'And it works on phones.',
    draw: (ctx, u, I, dx) => {
      const img = u < 102 ? I.mArticle : I.mSheet;
      const h = STAGE.h * 0.98;
      card(ctx, img, null, STAGE.x + STAGE.w / 2 + dx, STAGE.y + STAGE.h / 2, (h * 1170) / 2532, { radius: 48 });
    },
  },
];

const HITS = [
  ...STEPS.slice(1).map((st, i) => [st.u, `step ${i + 2}`, 'whoosh', { len: 0.35 }]),
  [20, '$100', 'click'],
  [25, 'rewrite sweep', 'whoosh', { len: 0.6, from: 600, to: 3000 }],
  [29, 'new wording', 'bell', { pitch: 'F6' }],
  [33, 'your bet', 'pop', { pitch: 'A5' }],
  [43, 'quote', 'coins'],
  [46, 'arrived', 'blip', { pitch: 'C6' }],
  [51, 'judge', 'click'],
  [56, 'settled', 'thud'],
  [63, 'vote 1', 'tok', { pitch: 'F5' }],
  [65, 'vote 2', 'tok', { pitch: 'A5' }],
  [67, 'vote 3', 'tok', { pitch: 'C6' }],
  [69, 'final', 'thud'],
  [92, 'live', 'blip', { pitch: 'F6' }],
  [96, 'connect', 'click'],
  [102, 'sheet', 'whoosh', { len: 0.4 }],
  [104, 'end card', 'impact'],
  [104.6, 'logo', 'bell', { pitch: 'F6' }],
];

function caption(ctx, u, i) {
  const st = STEPS[i];
  const k = E.outCubic(prog(u, st.u + 0.2, st.u + 0.9));
  if (k <= 0) return;
  const f = font(CAP.size, 600, UI);
  ctx.save();
  ctx.globalAlpha = k;
  const n = `${i + 1} / ${STEPS.length}`;
  if (P) {
    text(ctx, n, CAP.x, CAP.y - 70 + (1 - k) * 20, font(32, 600, UI), C.blue);
    wrap(ctx, st.cap, CAP.x, CAP.y + (1 - k) * 20, CAP.max, CAP.size * 1.3, f, C.ink, 'left');
  } else {
    text(ctx, n, STAGE.x, CAP.y + (1 - k) * 16, font(28, 600, UI), C.blue);
    text(ctx, st.cap, CAP.x, CAP.y + (1 - k) * 16, f, C.ink, 'center');
  }
  ctx.restore();
}

function wrap(ctx, str, x, y, max, lh, f, color, align) {
  ctx.font = f;
  const words = str.split(' ');
  let line = '', yy = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > max && line) {
      text(ctx, line, x, yy, f, color, align);
      line = w;
      yy += lh;
    } else line = test;
  }
  if (line) text(ctx, line, x, yy, f, color, align);
}

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
    const a = clamp(q * 2), b = clamp(q * 2 - 1);
    ctx.lineTo(cx + lerp(pts[0][0], pts[1][0], a) * r, cy + lerp(pts[0][1], pts[1][1], a) * r);
    if (b > 0) ctx.lineTo(cx + lerp(pts[1][0], pts[2][0], b) * r, cy + lerp(pts[1][1], pts[2][1], b) * r);
    ctx.stroke();
  }
  ctx.restore();
}

function endCard(ctx, u) {
  const cx = W / 2, cy = P ? H * 0.36 : H * 0.32;
  logo(ctx, cx, cy, P ? 90 : 66, prog(u, 103.8, 105.2));
  const k = springU(u, 104, SPRING.snappy);
  if (k > 0) {
    ctx.save();
    ctx.globalAlpha = clamp(k * 1.5);
    text(ctx, 'Verity', cx, cy + (P ? 290 : 220) + (1 - k) * 40, font(P ? 150 : 130, 600, DISPLAY), C.ink, 'center');
    ctx.restore();
  }
  const t2 = E.outCubic(prog(u, 105, 105.8));
  if (t2 > 0) {
    ctx.save();
    ctx.globalAlpha = t2;
    const y = cy + (P ? 420 : 320);
    text(ctx, 'verity-pied-phi.vercel.app', cx, y, font(P ? 46 : 38, 600, UI), C.blue, 'center');
    text(ctx, 'Built at NEAR HACKATHON', cx, y + (P ? 72 : 58), font(P ? 38 : 30, 500, UI), C.muted, 'center');
    ctx.restore();
  }
}

M.film({
  fonts: [font(100, 600, DISPLAY), font(40, 500, UI), font(40, 600, UI)],
  images: {
    home: 'assets/shots/flow/d01_home.png',
    everest: 'assets/shots/flow/d02_everest.png',
    card: 'assets/shots/flow/c02_card_mallory.png',
    card100: 'assets/shots/flow/c03_card_100.png',
    para: 'assets/shots/flow/c02_paragraph.png',
    rewriting: 'assets/shots/flow/c04_paragraph_rewriting.png',
    rewritten: 'assets/shots/flow/c05_paragraph_rewritten.png',
    history: 'assets/shots/flow/c05_history.png',
    after: 'assets/shots/flow/c05_card_after.png',
    coins: 'assets/shots/flow/c06_coins.png',
    quote: 'assets/shots/flow/c07_quote.png',
    moving: 'assets/shots/flow/c08_moving.png',
    wall: 'assets/shots/flow/d09_wall.png',
    judge: 'assets/shots/flow/c10_judge_says.png',
    wallSettled: 'assets/shots/flow/d11_wall_settled.png',
    panel: 'assets/shots/flow/c12_panel.png',
    cant: 'assets/shots/flow/c13_cant_settle.png',
    bets: 'assets/shots/flow/d14_bets.png',
    mode: 'assets/shots/flow/c16_mode.png',
    live: 'assets/shots/flow/d17_live_everest.png',
    connect: 'assets/shots/flow/c18_connect.png',
    mArticle: 'assets/shots/flow/m01_article.png',
    mSheet: 'assets/shots/flow/m02_sheet.png',
  },
  hits: HITS,
  draw(ctx, u, t, I) {
    fill(ctx, C.paper);
    if (u >= 104) return endCard(ctx, u);
    let i = STEPS.length - 1;
    while (i > 0 && u < STEPS[i].u) i--;
    // push: the new step slides in from the right as the old one slides out left
    const p = i > 0 ? E.inOutCubic(prog(u, STEPS[i].u - 0.35, STEPS[i].u + 0.35)) : 1;
    if (p < 1 && i > 0) STEPS[i - 1].draw(ctx, u, I, -p * W);
    STEPS[i].draw(ctx, u, I, (1 - p) * W);
    caption(ctx, u, i);
    if (u > 103.4) {
      const q = E.inOutCubic(prog(u, 103.4, 104));
      ctx.fillStyle = C.paper;
      ctx.fillRect(0, H * (1 - q), W, H * q);
    }
  },
});
