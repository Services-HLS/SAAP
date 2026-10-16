"""Make player-reg hero transparent with soft irregular bottom splash (no straight crop, no blob holes)."""
from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageFilter

ASSETS = Path(r"C:\Users\yadav\.cursor\projects\c-Users-yadav-OneDrive-Desktop-Sports-Sports\assets")
PUBLIC = Path(r"c:\Users\yadav\OneDrive\Desktop\Sports\Sports\frontend\public")
OUT = PUBLIC / "player-reg-hero.png"

candidates = [
    ASSETS / "player-reg-hero-organic.jpg",
    ASSETS / "player-reg-hero-organic.png",
    ASSETS / "player-reg-hero-splash.jpg",
    ASSETS / "player-reg-hero-splash.png",
    ASSETS / "player-reg-hero.jpg",
    PUBLIC / "player-reg-hero.png",
    PUBLIC / "player-reg-hero.jpg",
]
src = next((p for p in candidates if p.exists()), None)
if not src:
    raise SystemExit("No source hero found")

print("Source:", src)
im = Image.open(src).convert("RGBA")
w, h = im.size
px = im.load()
rng = random.Random(42)


def chroma(r, g, b):
    return max(r, g, b) - min(r, g, b)


def luminance(r, g, b):
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


# Remove white / pale backgrounds
for y in range(h):
    for x in range(w):
        r, g, b, a = px[x, y]
        lum = luminance(r, g, b)
        sat = chroma(r, g, b)
        if r > 230 and g > 230 and b > 230:
            px[x, y] = (r, g, b, 0)
        elif lum > 212 and sat < 30:
            px[x, y] = (r, g, b, 0)
        elif b > r and b > g and lum > 188 and sat < 72 and b > 205:
            px[x, y] = (r, g, b, int(max(0, min(255, (sat - 16) * 4.2))))

# Precompute irregular bottom boundary (higher = more content kept)
boundary = []
for x in range(w):
    y_cut = (
        h * 0.78
        + math.sin(x / 42.0) * (h * 0.035)
        + math.sin(x / 19.0 + 1.1) * (h * 0.022)
        + math.sin(x / 11.0 + 2.4) * (h * 0.014)
        + math.sin(x / 7.0) * (h * 0.008)
    )
    # splash peaks — push boundary down in places so drips remain
    if math.sin(x / 31.0 + 0.6) > 0.55:
        y_cut += h * 0.04
    if math.sin(x / 13.0 + 2.0) > 0.7:
        y_cut += h * 0.03
    boundary.append(y_cut)

# Soften boundary horizontally
smooth = boundary[:]
for x in range(w):
    vals = [boundary[max(0, min(w - 1, x + d))] for d in range(-8, 9)]
    smooth[x] = sum(vals) / len(vals)

# Apply soft splash fade below boundary (no hard circles)
fade = h * 0.16
for x in range(w):
    y0 = smooth[x]
    for y in range(h):
        r, g, b, a = px[x, y]
        if a == 0:
            continue
        if y < y0:
            # slight side fringe noise near bottom half edges only
            continue
        # distance below organic edge
        t = (y - y0) / fade
        # irregular drip: keep some columns longer
        drip = 0.15 + 0.35 * (0.5 + 0.5 * math.sin(x / 9.0 + y / 20.0))
        t = t / max(0.35, drip)
        if t <= 0:
            continue
        if t >= 1.15:
            px[x, y] = (r, g, b, 0)
        else:
            # smoothstep fade
            u = min(1.0, t)
            s = u * u * (3 - 2 * u)
            na = int(a * (1.0 - s))
            # speckled splash holes near the very edge
            if u > 0.55 and ((x * 17 + y * 31) % 23) < 4:
                na = int(na * 0.25)
            if u > 0.75 and ((x * 13 + y * 7) % 11) < 3:
                na = 0
            px[x, y] = (r, g, b, max(0, na))

# Light Gaussian only on alpha channel for softer edge
rgb = im.convert("RGB")
alpha = im.getchannel("A").filter(ImageFilter.GaussianBlur(radius=1.6))
im = Image.merge("RGBA", (*rgb.split(), alpha))

bbox = im.getbbox()
if bbox:
    pad = 10
    im = im.crop((
        max(0, bbox[0] - pad),
        max(0, bbox[1] - pad),
        min(w, bbox[2] + pad),
        min(h, bbox[3] + pad),
    ))

OUT.parent.mkdir(parents=True, exist_ok=True)
im.save(OUT, "PNG", optimize=True)
print(f"Wrote {OUT} size={im.size}")
bottom = [im.getpixel((x, im.size[1] - 1))[3] for x in range(0, im.size[0], max(1, im.size[0] // 30))]
print("bottom_opaque", sum(1 for a in bottom if a > 30), "/", len(bottom))
