# /// script
# dependencies = ["pillow"]
# ///
import sys
from PIL import Image, ImageDraw
files = sys.argv[2:]; cell = 520; cols = 4
rows = (len(files) + cols - 1) // cols
sheet = Image.new("RGB", (cols * cell, rows * (cell + 30)), "white"); d = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(f).convert("RGB"); im.thumbnail((cell - 10, cell - 10))
    x, y = (i % cols) * cell, (i // cols) * (cell + 30)
    sheet.paste(im, (x + 5, y + 5)); d.text((x + 8, y + cell + 6), f.split("/")[-1] + f" {Image.open(f).size}", fill="black")
sheet.save(sys.argv[1])
