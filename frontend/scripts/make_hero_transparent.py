"""Convert player-reg hero to transparent PNG and place in public/."""
from pathlib import Path
from PIL import Image

ASSETS = Path(r"C:\Users\yadav\.cursor\projects\c-Users-yadav-OneDrive-Desktop-Sports-Sports\assets")
PUBLIC = Path(r"c:\Users\yadav\OneDrive\Desktop\Sports\Sports\frontend\public")
OUT = PUBLIC / "player-reg-hero.png"

candidates = [
    ASSETS / "player-reg-hero.jpg",
    ASSETS / "player-reg-hero.png",
    PUBLIC / "player-reg-hero.jpg",
]
src = next((p for p in candidates if p.exists()), None)
if not src:
    raise SystemExit("No source hero image found")

print(f"Source: {src}")
im = Image.open(src).convert("RGBA")
px = im.load()
w, h = im.size


def chroma(r, g, b):
    mx, mn = max(r, g, b), min(r, g, b)
    return mx - mn


def luminance(r, g, b):
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


for y in range(h):
    for x in range(w):
        r, g, b, a = px[x, y]
        lum = luminance(r, g, b)
        sat = chroma(r, g, b)

        # Pure / near white
        if r > 232 and g > 232 and b > 232:
            px[x, y] = (r, g, b, 0)
            continue

        # Light cool gray plate
        if lum > 210 and sat < 22:
            px[x, y] = (r, g, b, 0)
            continue

        # Soft sky / wash blues that are pale (not jersey / splash blues)
        if b > r and b > g and lum > 175 and sat < 85 and b > 200:
            # fade pale cyan wash
            alpha = int(max(0, min(255, (sat - 20) * 4)))
            px[x, y] = (r, g, b, alpha)
            continue

        # Very pale bluish whites
        if lum > 225 and sat < 40 and b >= g >= r:
            px[x, y] = (r, g, b, 0)

# Clean fringe near transparent pixels
for y in range(1, h - 1):
    for x in range(1, w - 1):
        r, g, b, a = px[x, y]
        if a < 30:
            px[x, y] = (r, g, b, 0)
            continue
        if a == 255:
            lum = luminance(r, g, b)
            if lum > 200 and chroma(r, g, b) < 55:
                transparent = sum(1 for dy in (-1, 0, 1) for dx in (-1, 0, 1) if px[x + dx, y + dy][3] < 40)
                if transparent >= 4:
                    px[x, y] = (r, g, b, 0)

OUT.parent.mkdir(parents=True, exist_ok=True)
im.save(OUT, "PNG", optimize=True)
print(f"Wrote {OUT} size={im.size}")
# Also keep a jpg fallback for older cache references — skip overwriting jpg with opaque
print("Done")
