import json, sys, re
from pathlib import Path
F = Path(sys.argv[1]); j = json.loads((F / "audio/vo.json").read_text())
SP = {"1924": "1924|nineteen_twenty_four", "1924?": "1924?|nineteen_twenty_four", "AI": "AI|a_i", "AIs": "AIs|a_i_s", "$100": "$100|a_hundred_dollars"}
out = ["# narration lines, windows from audio/vo.json"]
for i, l in enumerate(j["lines"]):
    out.append(f"@ {max(0, l['t0'] - 0.25):.2f} {l['t1'] + 0.25:.2f} line{i + 1}")
    out.append(" ".join(SP.get(w, w) for w in l["text"].split()))
(F / "docs/lyrics.txt").write_text("\n".join(out) + "\n")
