# /// script
# dependencies = ["pillow", "numpy"]
# ///
"""Find where a crop sits inside a full screenshot (same scale): coarse search on 1/4 size, refine at full."""
import sys, numpy as np
from PIL import Image
D = "promo2/assets/shots/flow/"
def g(p, k=1):
    im = Image.open(D + p).convert("L")
    if k > 1: im = im.resize((im.width // k, im.height // k))
    return np.asarray(im, np.float32)
for big, small, h in [("d02_everest.png", "c02_paragraph.png", 370), ("d02_everest.png", "c02_card_mallory.png", 300),
                      ("d09_wall.png", "c02_card_mallory.png", 120), ("d11_wall_settled.png", "c11_paragraph_settled.png", 150),
                      ("d09_wall.png", "c11_paragraph_settled.png", 150), ("d17_live_everest.png", "c02_paragraph.png", 370)]:
    B4, S4 = g(big, 4), g(small, 4)[: h // 4]
    sh, sw = S4.shape; best = (1e18, 0, 0)
    for y in range(0, B4.shape[0] - sh):
        for x in range(0, B4.shape[1] - sw, 1):
            d = np.mean(np.abs(B4[y:y + sh, x:x + sw] - S4))
            if d < best[0]: best = (d, x, y)
    B, S = g(big), g(small)[:h]
    _, x4, y4 = best; best2 = (1e18, 0, 0)
    for y in range(max(0, y4 * 4 - 6), y4 * 4 + 7):
        for x in range(max(0, x4 * 4 - 6), x4 * 4 + 7):
            if y + S.shape[0] > B.shape[0] or x + S.shape[1] > B.shape[1]: continue
            d = np.mean(np.abs(B[y:y + S.shape[0], x:x + S.shape[1]] - S))
            if d < best2[0]: best2 = (d, x, y)
    print(f"{small} in {big}: x={best2[1]} y={best2[2]} err={best2[0]:.1f}")
