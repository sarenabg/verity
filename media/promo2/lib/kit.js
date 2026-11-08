// kit.js: shared pieces for the narrated Verity films (promo2, demo2).
// Everything here is a pure function of time t (seconds). Real screenshots only: the camera,
// cursor, rings and wipes move and point at captured screens; nothing here draws a fake UI.
import * as M from './motion.js';

const { W, H, FORMAT, E, prog, lerp, clamp, spring, SPRING, font, text, rrect, layout } = M;

// Atlas tokens (web/src/app/globals.css). One accent, truth blue; myth orange only where the app uses it.
export const C = {
  paper: '#F7F4EE', page: '#F6F3EC', ink: '#1C1917', muted: '#57534E', line: '#E7E1D6',
  blue: '#1E40AF', blue2: '#2563EB', orange: '#C2410C', white: '#FFFFFF', hl: 'rgba(250,204,21,0.38)',
};
export const DISPLAY = 'Display', UI = 'UI';
export const P = FORMAT.portrait;
export const S = FORMAT.safe;

/** Spring from time t0 (seconds). */
export const sp = (t, t0, cfg = SPRING.snappy) => spring(t - t0, cfg);
/** Eased 0..1 over [a, b]. */
export const ez = (t, a, b, f = E.inOutCubic) => f(prog(t, a, b));

// ------------------------------------------------------------------ narration word times
// lyrics.json comes from align.py: {lines: [{words: [{w, t0, t1}]}]} in film seconds.
const norm = (s) => s.toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9$%']/g, '');
export function voice(LY) {
  const find = (line, w, n = 0) => {
    let k = 0;
    for (const x of LY.lines[line].words) if (norm(x.w) === norm(w) && k++ === n) return x;
    throw new Error(`word "${w}" (#${n}) not in narration line ${line}`);
  };
  return {
    at: (line, w, n = 0) => find(line, w, n).t0,
    end: (line, w, n = 0) => find(line, w, n).t1,
    line: (i) => LY.lines[i],
    /** A phrase from line `line` as [{w, t}], each word timed to when it is said. Display text
     *  comes from `str` (so capitals and punctuation can differ from the transcript). */
    phrase(line, str) {
      const want = str.split(/\s+/);
      const ws = LY.lines[line].words;
      for (let i = 0; i + want.length <= ws.length; i++) {
        if (want.every((w, j) => norm(w) === norm(ws[i + j].w))) return want.map((w, j) => ({ w, t: ws[i + j].t0 }));
      }
      throw new Error(`phrase "${str}" not in narration line ${line}`);
    },
  };
}

// ------------------------------------------------------------------ kinetic type
/**
 * Lines of words that rise into a mask, each on the moment it is said.
 * rows: [[{w, t}, ...], ...]. opts: x, y (first baseline), size, weight, family, color, lh,
 * accent (Set of display words drawn in accentColor), exit (time the block lifts out), align.
 * Returns the block height.
 */
export function kinetic(ctx, t, rows, o) {
  const size = o.size, family = o.family || DISPLAY, weight = o.weight || 500;
  const f = font(size, weight, family);
  const lh = o.lh || size * 1.04;
  const track = o.track ?? -0.02 * size;
  const gap = size * 0.25;
  rows.forEach((row, li) => {
    const widths = row.map((it) => layout(ctx, it.w, f, track).width);
    const total = widths.reduce((a, b) => a + b, 0) + gap * (row.length - 1);
    let cx = o.align === 'center' ? o.x - total / 2 : o.align === 'right' ? o.x - total : o.x;
    const by = o.y + li * lh;
    row.forEach((it, wi) => {
      const k = sp(t, it.t - 0.06, o.spring || SPRING.snappy);
      const ex = o.exit != null ? E.inBack(prog(t, o.exit + li * 0.04 + wi * 0.015, o.exit + 0.42 + li * 0.04 + wi * 0.015), 1.3) : 0;
      if (k > 0 && ex < 1) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(cx - size * 0.2, by - size * 1.1, widths[wi] + size * 0.5, size * 1.42);
        ctx.clip();
        const col = o.colorOf ? o.colorOf(it, t) : o.accent && o.accent.has(it.w) ? o.accentColor || C.blue : o.color || C.ink;
        text(ctx, it.w, cx, by + (1 - k) * size * 1.0 - ex * size * 1.3, f, col, 'left', track);
        ctx.restore();
      }
      cx += widths[wi] + gap;
    });
  });
  return lh * rows.length;
}

/** Plain UI label with a fade-and-rise in at t0. */
export function label(ctx, t, str, x, y, size, { t0 = -1, color = C.muted, align = 'left', weight = 500, exit = null } = {}) {
  const k = E.outCubic(prog(t, t0, t0 + 0.45));
  const ex = exit != null ? E.inCubic(prog(t, exit, exit + 0.35)) : 0;
  if (k <= 0 || ex >= 1) return;
  ctx.save();
  ctx.globalAlpha = k * (1 - ex);
  text(ctx, str, x, y + (1 - k) * size * 0.5 - ex * size * 0.5, font(size, weight, UI), color, align);
  ctx.restore();
}

/** A big percentage that rolls from a to b over [t0, t1]; colour shifts myth-orange -> ink. */
export function counter(ctx, t, x, y, size, a, b, t0, t1, { align = 'left', appear = t0 - 0.4, color } = {}) {
  const k = sp(t, appear, SPRING.bouncy);
  if (k <= 0) return;
  const v = Math.round(lerp(a, b, E.inOutCubic(prog(t, t0, t1))));
  const col = color || (v < 30 ? C.orange : C.ink);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(0.6 + 0.4 * k, 0.6 + 0.4 * k);
  ctx.globalAlpha = clamp(k * 2);
  text(ctx, `${v}%`, 0, 0, font(size, 500, DISPLAY), col, align, -0.03 * size);
  ctx.restore();
}

// ------------------------------------------------------------------ the camera on a real screen
/**
 * A view is the box on the canvas where a screenshot is shown: {x, y, w, h, r}.
 * keys: [[tStart, tEnd, [x0, y0, x1, y1], pad?], ...] in source pixels. The first key is the
 * opening framing; each later key moves the camera there over [tStart, tEnd] (eased centre,
 * log-space zoom, so it reads as one constant-rate dolly).
 */
export function cam(t, keys, view, drift = 0) {
  const fit = (r, pad = 1.08) => {
    const rw = (r[2] - r[0]) * pad, rh = (r[3] - r[1]) * pad;
    return { x: (r[0] + r[2]) / 2, y: (r[1] + r[3]) / 2, s: Math.min(view.w / rw, view.h / rh) };
  };
  let c = fit(keys[0][2], keys[0][3]);
  let since = keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [a, b, r, pad] = keys[i];
    if (t <= a) break;
    const n = fit(r, pad);
    const p = E.inOutCubic(prog(t, a, b));
    c = { x: lerp(c.x, n.x, p), y: lerp(c.y, n.y, p), s: c.s * (n.s / c.s) ** p };
    since = b;
  }
  // a slow push between moves keeps a held frame alive
  if (drift) c.s *= 1 + drift * Math.max(0, t - since);
  return c;
}
/** Source pixel -> canvas pixel through camera c in view v. */
export const toView = (c, v, x, y) => [v.x + v.w / 2 + (x - c.x) * c.s, v.y + v.h / 2 + (y - c.y) * c.s];

/** The window card a screen lives in: soft shadow, rounded clip, page colour behind. */
export function windowCard(ctx, v, { alpha = 1, shadow = 1 } = {}) {
  ctx.save();
  ctx.globalAlpha = alpha;
  if (shadow > 0) {
    ctx.shadowColor = `rgba(28,25,23,${0.18 * shadow})`;
    ctx.shadowBlur = 70;
    ctx.shadowOffsetY = 26;
  }
  rrect(ctx, v.x, v.y, v.w, v.h, v.r ?? 26);
  ctx.fillStyle = C.page;
  ctx.fill();
  ctx.restore();
}

/**
 * Draw inside view v with camera c: fn(ctx) paints in source-pixel coordinates (images at their
 * real offsets, overlays on real UI positions). Clipped to the view's rounded box.
 */
export function inView(ctx, v, c, fn, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  rrect(ctx, v.x, v.y, v.w, v.h, v.r ?? 26);
  ctx.clip();
  ctx.translate(v.x + v.w / 2, v.y + v.h / 2);
  ctx.scale(c.s, c.s);
  ctx.translate(-c.x, -c.y);
  fn(ctx);
  ctx.restore();
}

/** In source coordinates: reveal img2 over img1 left to right across rect r (both at x0, y0). */
export function wipe(ctx, img, x0, y0, r, p) {
  if (p <= 0) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(r[0], r[1], (r[2] - r[0]) * p, r[3] - r[1]);
  ctx.clip();
  ctx.drawImage(img, x0, y0);
  ctx.restore();
}

/** In source coordinates: a rounded focus ring that draws on at t0 and fades at t1. */
export function ring(ctx, t, r, t0, t1, { color = C.blue2, width = 6, pad = 10, radius = 18 } = {}) {
  const a = E.outCubic(prog(t, t0, t0 + 0.35)) * (1 - E.inCubic(prog(t, t1, t1 + 0.35)));
  if (a <= 0) return;
  const g = 1 + 0.06 * (1 - E.outCubic(prog(t, t0, t0 + 0.5)));
  const cx = (r[0] + r[2]) / 2, cy = (r[1] + r[3]) / 2;
  const w = (r[2] - r[0] + pad * 2) * g, h = (r[3] - r[1] + pad * 2) * g;
  ctx.save();
  ctx.globalAlpha = a;
  rrect(ctx, cx - w / 2, cy - h / 2, w, h, radius);
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.globalAlpha = a * 0.08;
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

/** In source coordinates: a line that draws itself left to right (an underline lighting up). */
export function stroke(ctx, t, x0, x1, y, t0, dur, { color = C.blue2, width = 6, fade = null } = {}) {
  const p = E.outCubic(prog(t, t0, t0 + dur));
  const a = fade != null ? 1 - E.inCubic(prog(t, fade, fade + 0.4)) : 1;
  if (p <= 0 || a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(lerp(x0, x1, p), y);
  ctx.stroke();
  ctx.restore();
}

/** In source coordinates: a highlighter band behind words (multiply, so the text stays crisp). */
export function band(ctx, t, r, t0, dur, { color = C.hl, fade = null } = {}) {
  const p = E.inOutCubic(prog(t, t0, t0 + dur));
  const a = fade != null ? 1 - E.inCubic(prog(t, fade, fade + 0.4)) : 1;
  if (p <= 0 || a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = color;
  ctx.fillRect(r[0], r[1], (r[2] - r[0]) * p, r[3] - r[1]);
  ctx.restore();
}

// ------------------------------------------------------------------ cursor
/** Cursor position along keys [[tStart, tEnd, [x, y]], ...] (any coordinate space). */
export function path(t, keys) {
  let p = keys[0][2];
  for (let i = 1; i < keys.length; i++) {
    const [a, b, q] = keys[i];
    if (t <= a) break;
    const k = E.inOutCubic(prog(t, a, b));
    // a slight arc, like a hand
    const arc = Math.sin(Math.PI * k) * 0.08 * Math.hypot(q[0] - p[0], q[1] - p[1]);
    p = [lerp(p[0], q[0], k), lerp(p[1], q[1], k) - arc];
  }
  return p;
}
/** The pointer arrow, drawn in canvas pixels. taps: times it clicks (press + ripple). */
export function cursor(ctx, t, x, y, { taps = [], scale = 1, alpha = 1 } = {}) {
  if (alpha <= 0) return;
  let press = 0;
  for (const tt of taps) press = Math.max(press, M.bump(t, tt, 0.12));
  for (const tt of taps) {
    const r = prog(t, tt, tt + 0.55);
    if (r > 0 && r < 1) {
      ctx.save();
      ctx.globalAlpha = alpha * (1 - r) * 0.55;
      ctx.strokeStyle = C.blue2;
      ctx.lineWidth = 5 * scale;
      ctx.beginPath();
      ctx.arc(x, y, (14 + 46 * E.outCubic(r)) * scale, 0, M.TAU);
      ctx.stroke();
      ctx.restore();
    }
  }
  const s = scale * (1 - 0.14 * press);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.shadowColor = 'rgba(0,0,0,0.28)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 38);
  ctx.lineTo(9.5, 29);
  ctx.lineTo(16, 43);
  ctx.lineTo(22, 40.5);
  ctx.lineTo(15.5, 27);
  ctx.lineTo(28, 27);
  ctx.closePath();
  ctx.fillStyle = C.ink;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 3;
  ctx.strokeStyle = C.white;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
}

// ------------------------------------------------------------------ cards and brand
/** A crop of a real screenshot as a floating card centred on (cx, cy), width w. Returns its height. */
export function card(ctx, img, src, cx, cy, w, { alpha = 1, scale = 1, radius = 26, shadow = 1, rot = 0 } = {}) {
  if (!img || alpha <= 0) return 0;
  const [sx, sy, sw, sh] = src || [0, 0, img.width, img.height];
  const h = (w * sh) / sw;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  if (rot) ctx.rotate(rot);
  ctx.scale(scale, scale);
  if (shadow > 0) {
    ctx.save();
    ctx.shadowColor = `rgba(28,25,23,${0.17 * shadow})`;
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

/** Logo from web/public/favicon.svg: the circle, then the check mark, drawn on as p goes 0..1. */
export function logo(ctx, cx, cy, r, p) {
  if (p <= 0) return;
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

/** "Verity" set glyph by glyph, each dropping in with a squash. */
export function wordmark(ctx, t, t0, cx, y, size) {
  const f = font(size, 600, DISPLAY);
  const track = -0.02 * size;
  const L = layout(ctx, 'Verity', f, track);
  const x0 = cx - L.width / 2;
  L.glyphs.forEach((g, i) => {
    const k = sp(t, t0 + i * 0.045, SPRING.bouncy);
    if (k <= 0) return;
    const q = 0.12 * M.wobble(t - t0 - i * 0.045 - 0.12, 3, 7);
    ctx.save();
    ctx.globalAlpha = clamp(k * 2);
    M.glyph(ctx, g.ch, x0 + g.cx, y - (1 - k) * size * 0.6, f, C.ink, 1 + q, 1 - q);
    ctx.restore();
  });
}

// coin icons in assets/shots/flow/c06_coins.png (896 x 832): centre of each round logo
export const COINS = {
  USDC: [174, 236], ETH: [448, 236], BTC: [721, 236],
  SOL: [174, 448], NEAR: [448, 448], USDT: [721, 448],
  XRP: [174, 660], ZEC: [721, 660],
};
export const COIN_R = 37;

/** One round coin logo cut from the real coin picker, drawn at (x, y) with radius r. */
export function coin(ctx, img, name, x, y, r, { rot = 0, alpha = 1 } = {}) {
  const [cx, cy] = COINS[name];
  const R = COIN_R;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, M.TAU);
  ctx.clip();
  ctx.drawImage(img, cx - R, cy - R, R * 2, R * 2, -r, -r, r * 2, r * 2);
  ctx.restore();
}

export { W, H, FORMAT, E, prog, lerp, clamp, SPRING, font, text, rrect, layout };
