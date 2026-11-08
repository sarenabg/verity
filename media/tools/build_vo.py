# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "soundfile"]
# ///
"""Place one narration clip per script line on the beat grid.

    uv run tools/build_vo.py <film> --bpm 120 --lead 0.5 --gap 0.55 --tail 2.5

Reads <film>/audio/vo/*.mp3 (sorted) and <film>/audio/script.txt (one line per clip).
Each clip's speech onset is found from its own RMS envelope and placed on the next half beat
after the previous line's speech ends plus --gap. Writes <film>/audio/vo.wav (48 kHz mono)
and <film>/audio/vo.json: {bpm, period, duration, lines: [{text, t0, t1, pauses: [[a, b]...]}]}
with t0/t1 = speech start/end in film seconds and pauses = silences inside the line (film seconds).
"""
import argparse, json, math, subprocess, sys
from pathlib import Path
import numpy as np, soundfile as sf

SR = 48000
ap = argparse.ArgumentParser()
ap.add_argument("film"); ap.add_argument("--bpm", type=float, required=True)
ap.add_argument("--lead", type=float, default=0.5); ap.add_argument("--gap", type=float, default=0.55)
ap.add_argument("--tail", type=float, default=2.5); ap.add_argument("--snap", type=float, default=0.5, help="snap step in beats")
a = ap.parse_args()
F = Path(a.film); A = F / "audio"
clips = sorted((A / "vo").glob("*.mp3"))
lines = [l.rstrip("\n") for l in (A / "script.txt").read_text().splitlines() if l.strip() and not l.startswith("#")]
if len(clips) != len(lines): sys.exit(f"{len(clips)} clips but {len(lines)} script lines")

def load(p):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(p), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).copy()

def env_db(x, hop=240):  # 5 ms hop, 20 ms window
    n = len(x) // hop
    fr = np.lib.stride_tricks.sliding_window_view(np.pad(x, (480, 480)), 960)[::hop][:n]
    return 20 * np.log10(np.sqrt((fr ** 2).mean(1)) + 1e-9), hop

period = 60 / a.bpm
step = period * a.snap
out, meta, cursor = [], [], a.lead
for clip, line in zip(clips, lines):
    pause = 0.0
    if "|" in line.split(" ")[0]:
        p, line = line.split("|", 1); pause = float(p)
    x = load(clip)
    db, hop = env_db(x)
    on = np.where(db > -38)[0]
    s0, s1 = on[0] * hop / SR, (on[-1] + 1) * hop / SR
    onset = math.ceil((cursor + pause) / step - 1e-9) * step
    start = onset - s0
    # silences inside the line (>= 120 ms below -38 dB), for timing on-screen words
    quiet = db <= -38; pauses = []; i = on[0]
    while i < on[-1]:
        if quiet[i]:
            j = i
            while j < on[-1] and quiet[j]: j += 1
            if (j - i) * hop / SR >= 0.12: pauses.append([round(start + i * hop / SR, 3), round(start + j * hop / SR, 3)])
            i = j
        else: i += 1
    out.append((start, x))
    meta.append({"clip": clip.name, "text": line, "t0": round(onset, 3), "t1": round(start + s1, 3), "pauses": pauses})
    cursor = start + s1 + a.gap
end = meta[-1]["t1"] + a.tail
bar = period * 4
dur = math.ceil(end / bar - 1e-9) * bar
buf = np.zeros(int(dur * SR) + SR, np.float32)
for start, x in out:
    i = int(round(start * SR)); buf[i:i + len(x)] += x
buf = buf[: int(dur * SR)]
sf.write(A / "vo.wav", buf, SR, subtype="PCM_24")
(A / "vo.json").write_text(json.dumps({"bpm": a.bpm, "period": period, "duration": round(dur, 3), "lines": meta}, indent=1))
for m in meta: print(f"{m['t0']:7.2f} -> {m['t1']:7.2f}  {m['text'][:60]}")
print(f"duration {dur:.2f}s ({dur / bar:.0f} bars of {bar:.3f}s)")
