# Avoriaz Virtual Tour — Style Guide (reference)

Source: https://visitevirtuelle.avoriaz.com (built by Poppr; 360° tour on krpano).
Extracted 2026-10-10 from the site's shipped stylesheet `/css/index.css` (raw CSS, not screenshots). Values are what the CSS declares; usage notes come from the selectors they appear in.

This is a reference for an external site. It is **not** this project's design system (that will live in `DESIGN.md`).

## Colors

| Role | Hex | Where it's used |
|---|---|---|
| Primary / accent (apricot) | `#FFB36D` | `body` background, `.button` fill, hotspot circles, landing `h2`, "show more" link + underline, filled landing headline |
| Secondary (slate blue) | `#56607A` / `#57617A` | Button hover fill (wipe), nav button hover, all dark text on white panels, hotspot labels, close button fill, scrollbar thumb. Two near-identical hexes; treat as one token. |
| Deep navy | `#2A354B` | Full-screen nav overlay background |
| White | `#FFFFFF` | Default text (on photo/video/apricot), info panels, nav bar, season-switch knob |
| Black | `#000000` | Landing screen background, active season icon |
| Near-black (mask) | `#1B1B1B` at 75% opacity | Modal backdrop |
| Warm dark | `#33302D` | Nav copyright area (also `rgba(51,48,45,.8)` / `.1`) |
| Divider grey | `#E5E5E5` | 1px rule beside the nav back button |

Translucency is the main way it layers UI over panoramas:
- `rgba(255,255,255,.2)`: season-switch track; `.1`/`.4`/`.5`/`.55`/`.7` for hover and secondary layers
- `rgba(255,255,255,.8)` + `1px solid rgba(255,179,109,.5)`: hotspot label pill
- `rgba(0,0,0,.15–.7)`: gradients and scrims over imagery

**Contrast note:** white on `#FFB36D` is about **1.8:1**, which fails WCAG AA at every text size. The site relies on large, bold condensed caps to get away with it. `#57617A` on white is about **6.2:1** (passes AA).

## Typography

One family: **Founders Grotesk** (Klim Type Foundry, commercial license). It's self-hosted as `.otf` files, one `@font-face` per cut and all at `font-weight: normal`. A commented-out Adobe Typekit link suggests it was once served from there.

| CSS name | Cut | Role |
|---|---|---|
| `FoundersGroteskXSemiBold` | X-Condensed Semibold | Display: landing headlines, panel titles, nav items, large CTAs. Always uppercase. |
| `FoundersGroteskXMedium` | X-Condensed Medium | Secondary display |
| `FoundersGroteskCondensedSemiBold` / `Medium` / `Regular` | Condensed | Hotspot labels (uppercase), "show more" links |
| `FoundersGroteskMedium` / `SemiBold` | Normal width | Small button labels |
| `FoundersGroteskRegular` | Regular | Body (16px base), descriptions, copyright |

Type scale (px, size / line-height):

| Use | Desktop | ≤1024px |
|---|---|---|
| Landing hero (outlined) | 225 (180 at 1025–1250) | 100 |
| Landing kicker `h2` | 60 (50) | 30 |
| Info title | 40 / 53 | 40 / 53 |
| Nav level-1 items | 30 / 40 | 30 / 40 |
| Large CTA button | 28 | 28 |
| Panel description | 20 / 24 | 20 / 24 |
| Info description / overview link | 18 / 22 | hidden / 18 |
| Hotspot title / subtitle | 20 / 22, 16 / 17 | same |
| Body | 16 | 16 |
| Modal copy / copyright | 14 / 24, 14 / 29 | same |
| Small button | 12 / 29 | 12 / 29 |

Signature move: the landing hero word is set at 225px X-Condensed caps as an **outline** (`color: transparent; -webkit-text-stroke: 2px #fff`). A filled apricot copy (`3px #FFB36D` stroke) is revealed over it with an animated `clip-path` wipe.

## Spacing

There's no formal scale. Values are hand-tuned, but they cluster:

- **Viewport gutters:** desktop 35–38px (`nav-button` 35px, `info` left 38px, season switch 36px); mobile 14–16px.
- **Bottom offsets:** 24px (overview link), 32px (info block desktop), 12px (mobile), 48px (copyright).
- **Stack rhythm:** 4 / 8 / 11 / 15–16 / 20 / 30px margins.
- **Control sizes:** 60×60 square nav button and 60px round hotspots; 72px nav bar height and back button.
- **Panels:** `info-more` padding `60px 0 30px 14px`; modal content `0 20px`, max-width 600px at 80% width.
- **Breakpoint:** a single split at **1024 / 1025px**, plus a 1025–1250px step for the hero type.

## Border radius

The geometry is deliberately binary, either square or fully round:

- **0** for buttons, panels, the nav bar, the close button and modals. No rounded rectangles.
- **50% / 100%** for hotspot circles and the season-switch knob.
- **Pill (80–200px)** for the season-switch track and the hotspot label container.
- 3–5px and 10px values appear only in vendor CSS (scrollbars, image viewer).

## Buttons

**Primary `.button`:**
- Square corners, apricot fill, white text.
- Small size: `FoundersGroteskMedium` 12px / 29px, padding `8px 40px 4px`. The extra top padding optically centers the caps.
- Large CTA size: X-Condensed Semibold 28px uppercase, padding `11px 40px 15px`.
- Hover: a horizontal **color wipe** from apricot to slate (`linear-gradient(to right, #56607A 50%, #FFB36D 50%)`, `background-size: 200%`, background-position animated over 0.5s). It reverses on mouse-out.

**Nav button:** 60×60 square with the same wipe. It holds an animated hamburger that morphs into a close icon.

**Close button:** a slate square with a white glyph at 22px, padding `13px 16.5px`, pinned to the panel's top-right corner.

**Text links:** "Show more" is apricot Condensed Semibold 18px with a 1px apricot underline (`border-bottom`). The overview link is white Regular 18px at 0.9 opacity with a tiny `<` chevron, and fades to 0.6 on hover.

**Season toggle:** a 60×30 translucent white pill with a 24px white knob that slides between the snowflake and sun icons. The active icon turns black.

## Cards and panels

No floating cards and **no box-shadows** anywhere (the only shadow is one inset gradient). Surfaces are flat, full-bleed planes:

- **Info overlay:** no background. White text sits straight on the panorama at the bottom-left: a 40px X-Condensed title, an 18px description (max-width 600px), a "show more" link and a CTA.
- **Info-more sheet:** a solid white panel that slides up from the bottom (`bottom: -105%` → `0`), full-screen on mobile. Slate text, an uppercase X-Condensed title, a 20/24 description, the CTA pinned to the bottom, and the square slate close button.
- **Hotspot:** a 60px apricot circle. On hover it opens a pill of 80% white with a 1px apricot border at 50% opacity, holding a slate uppercase condensed title and subtitle.
- **Nav overlay:** a full-screen deep navy (`#2A354B`) layer with 30px uppercase X-Condensed items, animated bullet dots and a 72px white top bar.
- **Modal:** `#1B1B1B` mask at 75% opacity, centered content up to 600px wide, 14/24 copy, underlined links.

## Motion

- House easing is `cubic-bezier(0.65, 0, 0.35, 1)` (easeInOutCubic) at **0.5s**. It's used about 50 times, on nearly everything.
- Reveals use `cubic-bezier(0.165, 0.84, 0.44, 1)` (easeOutQuart) at 0.7–0.8s, staggered by 0.15s.
- Hamburger micro-motion uses `cubic-bezier(0.645, 0.045, 0.355, 1)` at 0.15s.
- Libraries loaded: anime.js, tsParticles confetti (for a contest feature), and model-viewer (3D).

## Overall tone

Alpine resort marketing as a cinematic, image-first experience. The photography and 360° video do the work, and the UI stays a thin, confident layer on top. The look is editorial and poster-like: huge extra-condensed uppercase type, outlined hero lettering, flat square blocks of a single warm apricot against cool slate and navy, and no shadows, gradients-as-decoration or rounded cards. The warm apricot against cool blue-grey reads like a sunset on snow. A winter/summer switch and season imagery make the resort feel year-round. Motion is smooth and deliberate (0.5s ease-in-out everywhere) rather than snappy. It feels premium and playful at once, quieter than a typical ski-resort site, and its accessibility is weak (low-contrast white-on-apricot, text hidden on mobile).

## Caveats

- Values come from the CSS file only. I didn't take screenshots, and colors or styles set inside krpano's XML skin or the JS bundle aren't captured.
- Founders Grotesk needs a paid Klim license. Using it in this project would mean buying one or choosing a substitute.
