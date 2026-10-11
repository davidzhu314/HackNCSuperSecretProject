"""Generate the Identity Hub's wave-ridge background textures (light and dark).

Run from the repo root:  python scripts/hub_textures.py
Writes public/textures/hub-waves-light.svg and hub-waves-dark.svg.

Each texture is a stack of wave-shaped layers, drawn top to bottom like paper cut-outs: every layer
covers the one above it and casts a soft shadow onto it, which reads as a ridge. The dark version
adds a faint lit edge on each crest, light falling from the top, and fine grain.
"""

import math
from pathlib import Path

W, H = 1600, 900
STEP = 20  # px between sampled points; small enough that the polyline looks smooth
TILT = -0.32  # ridges rise to the right, like the references
OUT = Path(__file__).resolve().parent.parent / "public" / "textures"


def ridge(i: int, spacing: float, scale: float) -> list[tuple[float, float]]:
    """One wave line. Amplitude and phase drift with i so the ridges flow rather than repeat.
    `spacing` is the gap between ridges; `scale` stretches the waves (bigger, slower swells)."""
    base = -620 + i * spacing
    amp = (46 + 18 * math.sin(i * 0.37)) * scale
    wavelength = (1250 + 160 * math.cos(i * 0.21)) * scale
    phase = i * 0.11
    pts = []
    for x in range(-40, W + 41, STEP):
        sway = amp * math.sin(2 * math.pi * x / wavelength + phase)
        swell = 22 * math.sin(2 * math.pi * x / 2900 + 1.3)  # a slow second wave so it isn't uniform
        pts.append((x, base + TILT * x + sway + swell))
    return pts


def layer_path(pts: list[tuple[float, float]]) -> str:
    """The region below a wave line, closed off past the bottom of the canvas."""
    line = " ".join(f"{x},{y:.1f}" for x, y in pts)
    return f"M{line} L{W + 40},{H + 40} L-40,{H + 40}Z"


def line_path(pts: list[tuple[float, float]]) -> str:
    return "M" + " ".join(f"{x},{y:.1f}" for x, y in pts)


def visible(pts: list[tuple[float, float]]) -> bool:
    return any(-60 < y < H + 60 for _, y in pts)


def ridges(spacing: float, scale: float) -> list[list[tuple[float, float]]]:
    return [r for r in (ridge(i, spacing, scale) for i in range(int(2300 / spacing))) if visible(r)]


# Light: many fine ridges (first reference). Dark: fewer, broader dunes (second reference).
LIGHT_RIDGES = ridges(58, 1.0)
DARK_RIDGES = ridges(118, 1.45)


def light() -> str:
    # Each layer gets its own shadow (filter on the path, not the group) so they stack.
    layers = "".join(f'<path d="{layer_path(r)}" filter="url(#s)"/>' for r in LIGHT_RIDGES)
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid slice">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#fafafb"/><stop offset="1" stop-color="#f1f1f3"/>
</linearGradient>
<filter id="s" x="-5%" y="-10%" width="110%" height="120%">
<feDropShadow dx="0" dy="-5" stdDeviation="7" flood-color="#3a3d48" flood-opacity=".13"/>
</filter>
</defs>
<rect width="{W}" height="{H}" fill="#fbfbfc"/>
<g fill="url(#g)">{layers}</g>
</svg>
"""


def dark() -> str:
    # Each layer gets its own shadow (filter on the path, not the group) so they stack.
    layers = "".join(f'<path d="{layer_path(r)}" filter="url(#s)"/>' for r in DARK_RIDGES)
    crests = "".join(f'<path d="{line_path(r)}"/>' for r in DARK_RIDGES)
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid slice">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#202125"/><stop offset="1" stop-color="#0b0c0e"/>
</linearGradient>
<linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
<stop offset=".35" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/>
</linearGradient>
<radialGradient id="light" cx=".42" cy="-.05" r=".75">
<stop offset="0" stop-color="#ffffff" stop-opacity=".2"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
</radialGradient>
<filter id="s" x="-5%" y="-10%" width="110%" height="120%">
<feDropShadow dx="0" dy="-16" stdDeviation="22" flood-color="#000" flood-opacity=".95"/>
</filter>
<filter id="soft" x="-5%" y="-20%" width="110%" height="140%"><feGaussianBlur stdDeviation="7"/></filter>
<filter id="grain" x="0" y="0" width="100%" height="100%">
<feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/>
<feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .55 0"/>
</filter>
</defs>
<rect width="{W}" height="{H}" fill="#0e0f11"/>
<g fill="url(#g)">{layers}</g>
<g fill="none" stroke="#ffffff" stroke-opacity=".09" stroke-width="16" filter="url(#soft)" transform="translate(0 12)">{crests}</g>
<rect width="{W}" height="{H}" fill="url(#light)"/>
<rect width="{W}" height="{H}" fill="url(#fade)"/>
<rect width="{W}" height="{H}" filter="url(#grain)" opacity=".16"/>
</svg>
"""


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for name, svg in (("hub-waves-light.svg", light()), ("hub-waves-dark.svg", dark())):
        (OUT / name).write_text(svg, encoding="utf-8")
        print(f"{name}: {len(svg) / 1024:.0f} KB")
