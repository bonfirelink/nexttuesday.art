---
name: Next Tuesday Society
description: The home emblem and its colour code, as shipped.
colors:
  plywood: "#e6d8c0"
  ink: "#141312"
  bone: "#e8dcc6"
  bone-muted: "#a59d8f"
  muted: "#5e5a52"
  voice: "#9e1430"
  shade: "#55544f"
  etch: "#77726a"
  grid: "rgb(229 29 71 / .08)"
  grid-dark: "rgb(229 29 71 / .2)"
  code-embers: "#e51d47"
  code-philo: "#858481"
  code-intersect: "#e9e2cf"
  code-events: "#d9a414"
  sky: "#3a8fc6"
  reserve: "#2f9a5a"
typography:
  display:
    fontFamily: "Fraunces, Iowan Old Style, Palatino Linotype, Georgia, serif"
    fontSize: "clamp(2.6rem, 11.5vw, 5.5rem)"
    fontWeight: 700
    lineHeight: 0.92
  voice:
    fontFamily: "Fraunces, Iowan Old Style, Palatino Linotype, Georgia, serif"
    fontSize: "clamp(1.15rem, 3.2vw, 1.5rem)"
    fontWeight: 400
  label:
    fontFamily: "Instrument Sans, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.72rem"
    fontWeight: 600
    letterSpacing: "0.14em"
rounded:
  plate: "22px"
spacing:
  grid-sun: "30px"
  grid-opening: "28px"
components:
  plate-black-sun:
    backgroundColor: "{colors.plywood}"
    textColor: "{colors.ink}"
    rounded: "{rounded.plate}"
  plate-black-opening:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.bone}"
    rounded: "{rounded.plate}"
  star-dot-embers:
    backgroundColor: "{colors.code-embers}"
  star-dot-philo:
    backgroundColor: "{colors.code-philo}"
  star-dot-intersect:
    backgroundColor: "{colors.code-intersect}"
  star-dot-events:
    backgroundColor: "{colors.code-events}"
  star-dot-reserve:
    backgroundColor: "{colors.reserve}"
---

# Design System: Next Tuesday Society

This file records the colour palette and the home emblem as they ship. The
tokens live in `site/_nts/nts.css`, section 1; how the code is wired is in
[INTERNALS.md](INTERNALS.md).

## Overview

**Creative North Star: "The Machine of Cogwheels"**

The home opens on an emblem that reads as a slow machine: a black sun with
a ticking dial, colour bands, a pyramid with an eye at its centre, and
rings that turn against each other like meshed gears. Stopping it is the
start of a puzzle: everything settles into one symmetric pose and a
seven-point star draws itself behind it.

Colour is a code, not decoration. Each initiative has one colour, and that
colour appears only as small solid shapes on quiet neutrals: beige, plywood,
ink and bone. A faint red grid under the emblem brings in technique and
architecture without shouting.

**Key Characteristics:**
- Neutral grounds, colour only in small solid shapes.
- One colour per initiative, the same everywhere it appears.
- Ink keylines between colours and around the light ones.
- Slow, compositor-only motion; the dial ticks like a seconds hand, backwards.
- Two grounds, Black sun (default) and Black opening, picked on the page.

The coral still used elsewhere on the home (sigil, links, nav dots, compass,
ledger) is legacy, to move onto these tokens in a later change.

## Colors

Warm neutrals carry everything; five code colours mark meaning in small
doses.

### Primary: the code

One colour per initiative, wherever it appears: orbit dots, pyramid faces,
marks.

- **Embers Red** (`--code-embers`, #e51d47): EMBERS, the rave; fire. The
  embers orbit's star dots, the pyramid's upper right face, the outer band
  of the sun. 3.25:1 on plywood, 4.06:1 on ink.
- **Philo Grey** (`--code-philo`, #858481): NOT NOT PHILO, the salons. The
  philo orbit's star dots. Its shadow, `--pal-shade`, is the pyramid's lower
  face.
- **Phosphor** (`--code-intersect`, #e9e2cf): INTERSECT. The intersect
  orbit's star dots and the pyramid's upper left face. Nearly invisible on
  the beige (1.09:1 on plywood), so it always sits inside an ink keyline
  there.
- **Ochre** (`--code-events`, #d9a414): the events and what is yet to come.
  Also the eye and the north mark, and the secret line on the Black opening
  (8.2:1 on ink). Weak on the beige (1.61:1 on plywood): ink keyline always.

### Secondary

- **Sky** (`--pal-sky`, #3a8fc6): the sun's inner band. No initiative; it
  sits only on the ink ring (5.2:1).
- **Reserve Green** (`--pal-reserve`, #2f9a5a): for what is none of the
  initiatives above. Today one star dot on the outer orbit: Experiments.

### Neutral

- **Plywood** (`--pal-plywood`, #e6d8c0): the plate under the Black sun.
- **Ink** (`--pal-ink`, #141312): the Black sun's dial, every keyline, the
  plate of the Black opening. 13.2:1 on plywood.
- **Bone** (`--pal-bone`, #e8dcc6): the Black opening's dial, text on the
  black, the eye lit on hover and focus. 13.7:1 on ink.
- **Bone Muted** (`--pal-bone-muted`, #a59d8f): small text on the black
  (6.9:1).
- **Muted** (`--pal-muted`, #5e5a52): small text on the plywood (4.9:1).
- **Voice** (`--pal-voice`, #9e1430): the italic voice and the secret on a
  light ground (5.8:1 on plywood).

- **Shade** (`--pal-shade`, #55544f): the pyramid's lower face.
- **Etch** (`--pal-etch`, #77726a): faint geometry only: the sunburst in the
  dial and the chalk star on stop, both at reduced opacity.
- **Grid** (`--pal-grid`, `--pal-grid-dark`): the faint red grid on the
  plate, on light and on dark.

### Named Rules

**The Small Shapes Rule.** Code colour comes only as small solid shapes:
dots, triangles, thin bands. Never a background, a panel or a text block.

**The Keyline Rule.** No two code colours meet as fields: an ink keyline
(.9) separates the sun's bands. The pyramid is the one drawn object whose
faces meet edge to edge; its fine ink outline holds them together.

**The Light Code Rule.** Ochre and phosphor take an ink keyline on the
beige. Every star dot carries a fine ink ring, so the grey and the green,
below 3:1 on plywood, are held the same way.

**The No Coral Rule.** No flat warm orange or coral accent on the beige.
The red that marks things is the embers red, in small shapes.

**The Named Colour Rule.** A code colour that means something is named in
text where it leads: each bead's accessible name, and the world it opens.

**The Contrast Rule.** Text holds 4.5:1 on its ground; marks hold 3:1, or
take an ink keyline.

**The Reserve Rule.** Green is kept for things distinct from the main code.
It never stands in for an initiative.

**The Token Rule.** A new colour on the home is a token in section 1 first.

## Typography

**Display Font:** Fraunces (with Iowan Old Style, Georgia)
**Body Font:** Instrument Sans (with Helvetica Neue, Arial)

On the plate, type takes the ground's inks only: ink and muted on the Black
sun, bone and bone muted on the Black opening.

### Hierarchy
- **Display** (700, clamp(2.6rem, 11.5vw, 5.5rem), 0.92): the society's name
  beside the emblem.
- **Voice** (italic 400, clamp(1.15rem, 3.2vw, 1.5rem)): the secret that
  appears on stop, in voice red on the Black sun and ochre on the Black
  opening.
- **Label** (600, 0.72rem, 0.16em, uppercase): the whisper under the name.

## Layout

The emblem sits on a plate. On a phone the plate runs to the screen's edges,
as the orbits do; from 600px it is a card inset 10px, with rounded corners.
From 900px the name sits beside the emblem. The emblem keeps its size and
position on every ground.

The emblem is a 202-unit square centred on its middle; every radius below
is in those units.

## Elevation & Depth

The emblem is flat: depth comes from stacked layers and ink keylines, not
shadows. Each body rides in a small moat of the plate's colour, so the
rings and orbits it crosses stop short of its edge. The beads keep their
own short shadow and hover lift, shared with the rest of the site.

## Shapes

Circles and triangles. The dial, the bands, the rings and the orbits are
concentric circles; the pyramid is a triangle seen from above, flipped on
stop; the star behind is a seven-point {7/3} star.

Two line tiers draw the emblem:
- **Keylines (.9):** between the bands, round the ochre north.
- **Fine (.45):** the pyramid's outline, the eye's border, the star dots'
  rings, the beam.

Marks, rings and orbits have their own thin widths, all at or under .9.

## Components

### The emblem

Back to front:
- **The star:** a seven-point {7/3} star with its points at r 90, drawn in
  chalk in etch, hidden while the machine runs.
- **The dotted ring:** 132 round dots at r 55.
- **The dial:** a disc to r 35, ink on the Black sun, bone on the Black
  opening.
- **The bands:** an ink ring from r 35 to the rim at r 50, carrying three
  bands, sky inside, then ochre, then red, with equal .9 keylines, and a
  60-mark bezel just outside.
- **The sunburst:** 72 faint etch rays inside the dial.
- **The marks:** 60 marks round the dial, longer every 5 and every 15, and
  the north: an ochre mark with an ink keyline.
- **The pyramid:** three faces meeting at the eye: phosphor upper left, red
  upper right, shade below, one fine outline. The eye is ochre with a fine
  ink border; it is the stop button and lights to bone on hover or focus,
  with a beam.
- **The orbits:** r 66 (EMBERS, three red dots), r 78.4 (NOT NOT PHILO, two
  grey dots), r 84 (INTERSECT, two phosphor dots), r 96.4 (two ochre event
  dots and the green Experiments dot). The world beads ride between them.

### The two grounds

- **Black sun** (default): plywood plate, ink dial, bone marks.
- **Black opening:** ink plate, bone dial, ink marks, ochre secret.

A pair of small round swatches in the plate's top corner switches them; the
choice is remembered.

### Star dots

A code-colour disc with a fine ink ring. Its hit area is about 43px on a
phone on the inner and outer orbits, smaller on the two middle ones. The
dots are decorative marks until their pages exist: not focusable, hidden
from assistive tech, and a tap does nothing. A halo ring appears on a
pointer's hover. One dot pulses now and then.

### Motion

- **Compositor only.** Only transform and opacity move. Each turning layer
  is one whole drawing; nothing is drawn per frame.
- **Gears.** Neighbouring layers turn against each other, slowly: the dotted
  ring in 70s, the bands in 95s, the orbits in 120s, 170s, 230s and 300s.
- **The tick.** The dial's marks turn counter-clockwise like a seconds hand:
  60 steps of 6 degrees a minute, each eased over the last .24s of its second
  with a small overshoot, back on the north each minute.
- **The stop.** The eye stops the machine. Every part glides by the shorter
  way into one symmetric pose: the pyramid flips to point down at the
  events, NOT NOT PHILO at 12 o'clock, INTERSECT at 4, EMBERS at 8, and the
  dots fill the other hours in mirror pairs. The dial fades to the plate
  over 1.6s, the marks and sunburst with it, the north stays, the star draws
  in and the secret appears. Resuming is the same swap reversed, same
  duration, carrying on from where each part stands.
- **Reduced motion.** Nothing turns, glides or draws: the dial still fades,
  the pyramid swaps to a copy drawn upside down, the star fades in whole.

## Do's and Don'ts

### Do:
- **Do** take every colour on the home from the section 1 tokens.
- **Do** keep code colour to small solid shapes: dots, triangles, thin bands.
- **Do** put an ink keyline between code colours and round ochre and
  phosphor on the beige.
- **Do** name a code colour in text wherever it means something.
- **Do** hold 4.5:1 for text and 3:1 for marks.
- **Do** move only transform and opacity, on whole layers.

### Don't:
- **Don't** use a code colour as a field, a background or body text.
- **Don't** let two code colours touch without a keyline.
- **Don't** put a flat warm orange or coral accent on the beige.
- **Don't** use the reserve green for an initiative.
- **Don't** thicken the pyramid's outline, the eye's border or the dots'
  rings past the fine tier.
- **Don't** change the emblem's size or position.
