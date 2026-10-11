---
name: Personify
description: One identity. Every platform. Authentically you.
colors:
  apricot: "#ffb36d"
  apricot-deep: "#f39a4c"
  slate: "#57617a"
  navy: "#2a354b"
  ink: "#1b1b1b"
  black: "#000000"
  white: "#ffffff"
  rule: "#e5e5e5"
  mist: "rgba(255, 255, 255, 0.72)"
typography:
  display-giant:
    fontFamily: "Archivo, Arial Narrow, sans-serif"
    fontSize: "clamp(64px, 14.6vw, 232px)"
    fontWeight: 700
    lineHeight: 0.84
    letterSpacing: "0.004em"
    fontVariation: "\"wdth\" 62"
  display:
    fontFamily: "Archivo, Arial Narrow, sans-serif"
    fontSize: "clamp(72px, 10vw, 168px)"
    fontWeight: 650
    lineHeight: 0.88
    letterSpacing: "0.005em"
    fontVariation: "\"wdth\" 62"
  headline:
    fontFamily: "Archivo, Arial Narrow, sans-serif"
    fontSize: "clamp(44px, 5vw, 76px)"
    fontWeight: 650
    lineHeight: 0.92
    letterSpacing: "0"
    fontVariation: "\"wdth\" 62"
  panorama:
    fontFamily: "Archivo, Arial Narrow, sans-serif"
    fontSize: "clamp(30px, 3.7vw, 60px)"
    fontWeight: 650
    lineHeight: 1.02
    letterSpacing: "0.005em"
    fontVariation: "\"wdth\" 62"
  title:
    fontFamily: "Archivo, Arial Narrow, sans-serif"
    fontSize: "48px"
    fontWeight: 650
    lineHeight: 1.02
    letterSpacing: "0"
    fontVariation: "\"wdth\" 62"
  cta:
    fontFamily: "Archivo, Arial Narrow, sans-serif"
    fontSize: "28px"
    fontWeight: 650
    lineHeight: 1
    letterSpacing: "0"
    fontVariation: "\"wdth\" 62"
  body:
    fontFamily: "Archivo, Arial Narrow, sans-serif"
    fontSize: "19px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "0"
  body-small:
    fontFamily: "Archivo, Arial Narrow, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0"
  label-condensed:
    fontFamily: "Archivo, Arial Narrow, sans-serif"
    fontSize: "16px"
    fontWeight: 650
    lineHeight: 1.5
    letterSpacing: "0.05em"
    fontVariation: "\"wdth\" 62"
  label-id:
    fontFamily: "Archivo, Arial Narrow, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "0.06em"
    fontFeature: "\"tnum\" 1"
rounded:
  none: "0"
  full: "50%"
  pill: "80px"
spacing:
  gutter: "clamp(16px, 2.6vw, 38px)"
  section-hero: "clamp(72px, 10vw, 140px)"
  section-sheet: "clamp(72px, 9vw, 128px)"
  section-close: "clamp(56px, 7vw, 96px)"
  column-gap: "56px"
  container: "1360px"
components:
  button-cta:
    backgroundColor: "{colors.apricot}"
    textColor: "{colors.navy}"
    typography: "{typography.cta}"
    rounded: "{rounded.none}"
    padding: "16px 40px 17px"
  button-cta-hover:
    backgroundColor: "{colors.slate}"
    textColor: "{colors.white}"
  button-square:
    backgroundColor: "{colors.apricot}"
    textColor: "{colors.navy}"
    rounded: "{rounded.none}"
    size: "60px"
  button-square-hover:
    backgroundColor: "{colors.slate}"
    textColor: "{colors.white}"
  hotspot:
    backgroundColor: "{colors.apricot}"
    textColor: "{colors.navy}"
    rounded: "{rounded.full}"
    size: "48px"
  hotspot-active:
    backgroundColor: "{colors.white}"
    textColor: "{colors.navy}"
  critique-pill:
    backgroundColor: "{colors.white}"
    textColor: "{colors.slate}"
    rounded: "{rounded.none}"
    padding: "16px 22px 18px"
  switch-track:
    rounded: "{rounded.pill}"
    padding: "4px"
  switch-option:
    textColor: "{colors.white}"
    rounded: "{rounded.pill}"
    height: "36px"
    width: "104px"
  switch-option-active:
    backgroundColor: "{colors.white}"
    textColor: "{colors.navy}"
  fact-tick:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.apricot}"
    rounded: "{rounded.none}"
    size: "28px"
  fact-tick-off:
    backgroundColor: "{colors.white}"
  verdict-chip:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.white}"
    rounded: "{rounded.none}"
    padding: "7px 14px 7px 10px"
  more-link:
    textColor: "{colors.apricot}"
    typography: "{typography.label-condensed}"
---

# Design System: Personify

## Overview

**Creative North Star: "The Profile as Panorama"**

The landing world is borrowed, by the user's choice, from a resort virtual tour (the Avoriaz site recorded in `AVORIAZ_STYLE_GUIDE.md`; that file describes the external source, not this project). The source's grammar maps onto the product: the visitor's own profile sentences fill the screen the way a 360° panorama does, and simulated critiques pin to individual sentences as round apricot hotspots. Text is the imagery. There is no photography, and none is needed.

The material is flat, full-bleed planes of colour stacked as the page scrolls: a deep navy field, a drenched apricot band, a white sheet, then a black close. Type does almost all the expressive work: extra-condensed uppercase Archivo at poster sizes, sometimes outlined, with an apricot fill that wipes in from the left to mark what is being looked at. Motion is slow and deliberate (0.5s to 0.7s) rather than snappy.

**Scope.** This world covers the alternative landing page at `/tour` only, scoped under the `.pf` root class in `src/app/landing.css`. The home page (`/`), `/studio`, and `/hub` use the team's scenic design in `src/app/globals.css`. Whether `/tour` replaces the home page is an open team decision. Nothing in this file describes the other pages.

**Key Characteristics:**
- One committed accent (apricot) on navy, black, and white grounds.
- Extra-condensed uppercase display (Archivo, `wdth` 62) at poster scale.
- Outlined lettering with an apricot clip-path wipe as the "this one" signal.
- Square corners or full circles only (plus the pill-shaped platform switch). No shadows.
- Navy text on apricot, never white, because white on apricot fails contrast.

## Colors

A cool navy and slate base under a single warm apricot, the "sunset on snow" contrast of the source.

### Primary
- **Tour Apricot** (`apricot`): the one accent. CTA and square-button fill, hotspot circles, the lit-sentence wipe, the "more" link and its underline, the drenched FactCheck band, focus rings, text selection, the ticks inside fact boxes, and the arrows in the flow line.
- **Burnt Apricot** (`apricot-deep`): a quieter accent used only on white, for filled rating steps and the fact-tick hover border, where plain apricot would be too pale.

### Secondary
- **Wipe Slate** (`slate`): the hover fill that wipes across apricot buttons, body text on white sheets, the critique pill's header text, and captions on apricot.

### Neutral
- **Deep Navy** (`navy`): the hero field. Also the text colour on apricot and the strong text on white (headlines, trait names, rating words), the filled fact tick, and the "no unsupported claims" verdict chip.
- **Close Black** (`black`): the closing section's ground only.
- **Ink** (`ink`): long-form reading text on white (critique rationale, fact text, the fabricated-rewrite specimen).
- **Paper White** (`white`): sheets, the critique pill, the switch knob, the active hotspot, and text on navy and black.
- **Hairline Grey** (`rule`): 1px row dividers in the fact list and flag list, and unlit rating steps.
- **Mist** (`mist`, white at 72%): secondary text on navy and black (sample label, Hinge prompts, hero supporting copy, the flow line, footer).

### Named Rules
**The One Accent Rule.** Apricot is the only hue. Any second colour is a neutral (navy, slate, ink, black, white, grey).

**The Navy-on-Apricot Rule.** Text and icons on an apricot fill are navy. This is a deliberate departure from the source's white-on-apricot, which fails WCAG contrast.

## Typography

**Display Font:** Archivo variable at `wdth` 62 (fallback Arial Narrow, sans-serif), loaded through `next/font` with the width axis and exposed as `--font-archivo`.
**Body Font:** Archivo at its default width.

**Character:** One family in two voices. A condensed uppercase poster voice carries every headline, label, control, and the panorama sentences. The same face at normal width carries reading text. Archivo stands in for the source's Founders Grotesk X-Condensed.

### Hierarchy
- **Display Giant** (700, 64px to 232px, line-height 0.84): only the closing "Authentically you." lockup, outlined with a 2px white stroke.
- **Display** (650, 72px to 168px, 0.88): the drenched band's headline ("Made up? Flagged.").
- **Headline** (650, 44px to 76px, 0.92): section headings on the white sheet.
- **Panorama** (650, 30px to 60px, 1.02): the demo profile's sentences in the hero, outlined at rest and filled apricot when lit.
- **Title** (650, 48px; 40px at 1024px and below, 32px at 640px and below): the hero's h1 in the bottom-left info block.
- **CTA** (650, 28px; 24px at 640px and below): button labels, condensed caps.
- **Body** (400, 19px, 1.45, max 62ch): explanatory paragraphs. Hero support text runs at 19px / 1.35; the close's line runs at 22px.
- **Body Small** (400, 15px, 1.4): captions, flag explanations, notes, hints.
- **Label Condensed** (600 to 650, 16px to 19px, 0.03em to 0.06em tracking, uppercase): pill headers, flag kinds, rating words, switch options, the "more" link, Hinge prompts.
- **Label ID** (600, 14px, 0.06em, uppercase, tabular numerals, normal width): segment and fact IDs (`S1`, `F2`), the citations that tie critique to text.

### Named Rules
**The Condensed Caps Rule.** Anything that names, labels, or commands is set in condensed uppercase (`font-stretch: 62%` plus `font-variation-settings: "wdth" 62`). Anything meant to be read as a paragraph is set at normal width and in sentence case.

**The Outline-and-Wipe Rule.** Outlined lettering (transparent fill, white stroke) means "not yet looked at". An apricot copy revealed with a left-to-right `clip-path` wipe means "this one". Use it for the panorama's lit sentence and the closing "you." only, not as decoration.

## Layout

Full-bleed sections in a fixed order, each a single flat ground: navy hero, apricot band, white sheet, black close. Content sits in a 1360px container with a fluid gutter (16px to 38px). Section padding is fluid: 72px to 140px for the apricot band, 72px to 128px for the sheet, and 56px to 96px at the top of the close.

The hero is a full-viewport (`100svh`) three-row grid: the bar at the top, the panorama centred, and the info block anchored bottom-left. Each panorama row is a three-column grid: a 44px ID column, the sentence, and a 48px hotspot column. Two-column sections use asymmetric 5/7 and 7/5 splits with 56px to 72px column gaps.

Breakpoints are 1024px (the source's single split: two-column sections stack, and the hero foot stacks) and 640px (everything tightens). At 640px and below, the panorama ID column shrinks to 26px, sentences drop to 22px, the critique pill becomes an in-flow block under its row instead of floating, and the flag list moves to two columns with the explanation wrapping below.

## Elevation & Depth

None. There are no shadows anywhere. Depth comes from stacking flat planes (a white sheet laid on the apricot band, the white critique pill laid over the navy panorama) and from z-order. The source's one inset gradient was not carried over.

### Named Rules
**The Flat Plane Rule.** Separate surfaces with a change of ground colour or a 1px hairline, never a shadow or a blur.

## Shapes

There are three shape families. Rectangles have square corners (0): buttons, the critique pill, sheets, fact ticks, the verdict chip, and rating steps. Hotspots and their pulsing focus ring are full circles (50%). The platform switch's track, knob, and options use an 80px pill radius, which is the source's season-toggle form. Borders are thin and functional: 1px hairlines for row dividers, a 1px apricot edge at 50% on the critique pill, a 2px navy rule over the clean-rewrite block, a 2px navy border on fact ticks, and a 2px dashed apricot ring on the missing-evidence hotspot.

### Named Rules
**The Square or Round Rule.** A corner is either 0 or fully round. No intermediate radii (4px, 8px, 12px). The 80px switch pill is the only rounded rectangle, and it is reserved for toggles.

## Components

### Buttons
Tactile, square, and slow. The source's signature is a slate wipe across apricot.
- **Shape:** square corners (0).
- **CTA:** apricot fill with navy condensed-caps label at 28px, padded 16px 40px 17px, optionally with a trailing 24px arrow.
- **Square:** a 60px apricot square with a 26px navy arrow (48px at 640px and below). Used for the "Open the studio" control in the bar.
- **Hover:** a two-stop gradient (slate | apricot) at 200% width slides its position over 0.5s, wiping slate in from the left while the label turns white. Active nudges 1px down.
- **Focus:** a 2px apricot outline at 3px offset, which applies across the whole `.pf` scope.

### Hotspot (signature)
- **Rest:** a 48px apricot circle with a navy plus icon (44px at 640px and below). Hover scales it to 1.08.
- **Active:** the fill turns white, the icon turns to an X, and a 1px apricot ring pulses outward (2.4s, scaling 0.8 to 1.5 and fading out).
- **Missing evidence:** a transparent circle with a 2px dashed apricot border and an apricot icon. When active, it fills apricot with a solid border and a navy icon.

### Critique Pill (signature)
- **Style:** solid white with a 1px apricot edge at 50%, square corners, padded 16px 22px 18px, up to 420px wide. It floats beside its sentence and clears the hotspot column so every hotspot stays reachable. It opens below the row, or above it (`data-up`) for the lower rows.
- **Content:** a header with the audience and segment ID (slate condensed caps, ID in navy tabular numerals), the trait name in 30px navy condensed caps, a categorical rating scale, the rationale in 17px ink, and a "Try:" suggestion at 15px.
- **Departure:** the background is solid white rather than the source's 80% white, so the text keeps AA contrast over outlined type.

### Rating Scale
Four 14x6px rectangles with 3px gaps, followed by the rating word in navy condensed caps. Filled steps use burnt apricot and unlit steps use hairline grey. "Not evident" lights no steps. The word always accompanies the bars, because ratings are categorical words, never scores.

### Platform Switch
A translucent white track (14%) holds a sliding white knob and two 104x36px options in 18px condensed caps (76x32px at 16px for 640px and below). The pressed option turns navy and the knob slides over 0.5s.

### Fact Tick
A 28px square with a 2px navy border. Ticked, it has a navy fill and an apricot check. Unticked, it has a white fill, and the row's text drops to slate with a small navy note explaining the consequence. Hover turns the border burnt apricot. Rows are at least 54px tall and divided by hairlines.

### Verdict Chip
A navy block with a white 600-weight label and an 18px apricot check, padded 7px 14px 7px 10px, square. It carries the "No unsupported concrete claims detected" result only.

### Flag Row
A hairline-divided three-column grid (kind, quoted text, explanation): the kind in 18px navy condensed caps, the quote in 600-weight ink, and the explanation at 15px. Flagged spans in the specimen text get an apricot highlight that sweeps in from the left, plus a 2px navy strike-through.

### Navigation / More Link
The bar holds the wordmark (32px condensed caps, 650; 26px at 640px and below), the platform switch pushed right, and the square button. The "more" link is 19px apricot condensed caps with a 1px apricot underline, and its trailing arrow drops 3px on hover.

## Do's and Don'ts

### Do:
- **Do** put navy text and icons on every apricot fill.
- **Do** keep corners at 0 or 50%; reserve the 80px pill for the platform switch.
- **Do** set names, labels, and controls in condensed caps (`wdth` 62), and reading text at normal width.
- **Do** use the 0.5s `cubic-bezier(0.65, 0, 0.35, 1)` ease for state changes and the 0.7s `cubic-bezier(0.165, 0.84, 0.44, 1)` ease-out for entrances, and honour `prefers-reduced-motion`.
- **Do** cite segment and fact IDs in tabular uppercase wherever a critique or flag points at text.
- **Do** draw unlit panorama sentences solid (white at 86%) rather than outlined at 640px and below, where a 1.5px stroke at 22px closes the counters.

### Don't:
- **Don't** use box-shadows, blurs, or glows to separate surfaces.
- **Don't** introduce a second accent hue.
- **Don't** put white text on apricot.
- **Don't** use intermediate corner radii or rounded cards.
- **Don't** show ratings as percentages, stars, or bare bars without the rating word.
- **Don't** apply these tokens to `/`, `/studio`, or `/hub`; they use the team's scenic design.
