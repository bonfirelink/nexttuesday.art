# The worlds: EMBERS, NOT NOT PHILO, INTERSECT

This file covers `site/_nts/worlds/`: the facts of the three world kits (a stylesheet and
scripts each): what they share, then each world with its figure. How the
rest of the site fits, and how a world is registered, is in the
root [INTERNALS.md](INTERNALS.md).

## What all worlds share

### World hero text

The hero's three lines (the name, the label, the punchline) are in
`.hero-text`, in `pages.css`; each world's lines differ in colour and face,
not in how they are laid out. The same fact in each world's section below
points here.

- `.hero-text` of the three worlds is an inline-size container. Every size
  is `min(the role's size, var(--fit))`, with `--fit` in `cqi`: the
  container's width divided by the text's width in em, so the line just fills
  the column at any width and never wraps (`white-space: nowrap`). Each
  `--fit` sits beside its text in `pages.css` and is measured on the copy and
  the face as they are: measure it again when either changes.
- The grid has one `max-content` track, so the title sets the width of the
  column. The punchline would widen it, so it is `width: 0; min-width: 100%`:
  as wide as the track, not wider, and its text may run past it.
- The label is a solid band as wide as the title, its text spread across it
  (`text-align-last: justify`). EMBERS: `--embers-night` on `--embers-fire`;
  INTERSECT: `--w-bg` on `--w-fg` (reverse video); NOT NOT PHILO: white on
  `--philo-red` with the charcoal plate printed off register (`::before`,
  z-index -1, which relies on `.philo-hero .hero-text` being a stacking
  context). The label has its own `::selection` with its colours inverted
  (EMBERS night on cream, PHILO red on white, INTERSECT `--w-fg` on `--w-bg`),
  on the band and its short form, because the selection colours (the world's,
  or the beige palette's on arrival) equal the band's.
- The label has two spans: `.label-long` (`<world>.eyebrow`) and
  `.label-short` (`<world>.eyebrow.short`, "<X> series · NTS" with an
  `abbr`). `@container (width < 30rem)` (the text column, not the viewport)
  swaps them, sets the short one from the left (not spread) and gives the
  label its narrow `--fit`. `tests/layout/hero-lines.spec.mjs` (L7) reads that
  threshold from the page's root font size.
- INTERSECT: the label and the punchline start under the I, not the prompt:
  `margin-left: calc(.815 * var(--title))`, the prompt's width plus its space
  in em of the title (measured as the `--fit` factors are).
- NOT NOT PHILO's punchline is in the display cut of Fraunces
  (`"opsz" 144, "SOFT" 100, "WONK" 1`).

### Grabbing a figure

A press grabs a figure only on the figure, in all three worlds
(`NTS.grab` in `nts.js`): the world gives a test of a point against the
outline it last drew (EMBERS: the hull of the solid's four turned vertices;
philo: its drawn pieces, tested in model units; INTERSECT: the hull of the
last frame's glyphs, from the ends of each row), with `NTS.grab.SLACK`
(14px) around it. `watch` returns `down`/`up` for the drag handlers and puts
`.is-grab` (hover over the figure, mouse and pen) and `.is-grabbing` on the
host, which the stylesheets turn into the cursors. A press elsewhere starts
nothing and captures nothing, so scrolling and clicks go through. The test
runs on pointer events only; keys are per world, and PHILO has none.

## EMBERS

Files: `worlds/embers.css`, `worlds/embers.js`. Classes: `.embers-display`
(the flyer's extended caps, with the glow at night), `.hollow`,
`.embers-label` (the hero's label band, see World hero text),
`.embers-bar` (the red bar: a band on phones, vertical on
the right from 900px inside `.embers-hero`), `.genres`. The entity is
`<canvas class="nts-hearth" tabindex="0" aria-label="…">` inside a
`.hearth-stage`, with a `.hearth-still` for scripts off (`<!-- nts:still embers -->`).
Data attributes tune it (see the file head). Drag turns, a tap stokes it
into a burst of glyph embers, keyboard works. A cancelled touch (the browser taking it for a
scroll) only ends the drag: no stoke, and the spin goes back to what it was at the press. It draws its day palette while the page is `before`; while
the bleed-in's disc opens it draws the night into the twins in the copy
and the day into itself, both from one geometry. On `/embers/` the canvas is the
landing's field: it is the hero's first child, absolute over the whole
hero (which spans the page and pads itself to the wrap), and
`data-anchor=".embers-hero .hearth-stage"` takes the solid's centre and
size from the stage, so the lines fill the hero (the first screen from
900px, where every world's hero is a screen tall) while the tetrahedron
keeps the stage's size, in the entity column and ring all three worlds
share.

The hearth on the page is two layers, so a frame redraws a fraction of
the hero:

- `canvas.nts-hearth` keeps no pixels (a 0x0 backing store). It takes the
  pointer, the keys and the label, and its CSS background (`.is-split` in
  `embers.css`) is the straight lines: one line period, stroked once per
  size and palette by the script at the live canvas's resolution and
  handed over as a data URL (`--hearth-lines`, `--hearth-tile`), repeated.
  A mask shows it over the lines' rows only (`--hearth-rows`: the tile
  repeats past the first and last line) less the box around the solid
  (`--hearth-box`). The mask hides paint, not the pointer: a press on the
  solid reaches the canvas.
- `canvas.nts-hearth-live`, made by the script just after it, covers the
  box (the circumcircle, the ripple at its hottest, the glow and halo) and
  nothing more at rest. While a stoke's embers are in the air it reaches
  up to the hero's top and 170px to each side, then shrinks back to the
  box once the last one is gone: one resize at the burst's start and one
  at its end, each redrawn in the same task, so no blank frame shows. It
  is the only thing cleared and redrawn each frame; `aria-hidden`,
  `pointer-events: none`.
- Embers come only from a stoke (a tap on the solid, Space or Enter):
  nothing rises at rest. A burst throws 26 + 16 × heat of them (220 at
  most) from the hottest ripples; each is a Red Hat Mono bold character (the weight the bar already loads) that
  cools as it climbs, `#` `*` `+` `^` `·`, one step down the palette's
  ember ramp each, and lives 1.8 to 4.3 s (less if it leaves the top). They hop on a character grid:
  a column per mono advance (0.6 em of the 15px glyph), a row per line,
  the baseline on the line, every step snapped to the resolution's grid.
  Each is one blit from a glyph sheet, the five characters drawn once per
  palette at the live canvas's resolution with the glow baked in, and
  drawn again when the resolution changes or the mono finishes loading;
  no text and no blur is drawn per frame. The sheet follows the palette
  being painted, so through the bleed-in the day's glyphs and the night's
  each fall on their own ground. Under reduced motion there are none: the
  still frame takes a stoke's heat for a moment and throws nothing.
- No seam where the lines cross the box's edge: both layers use a
  resolution whose pixels meet the screen's on a common grid (`dpr = DPR
  × m / n`, a grid step every `n / DPR` css px), and every size and edge
  is snapped to that step; the box's top and bottom fall midway between
  two lines. At a resolution that scales to the screen by a non-integer
  factor the CSS background and the canvas are resampled differently,
  hence the snapping of the resolution itself, not just the edges. Measured,
  the seam is 0 at 2 and 3 and at a real device scale factor of 1.25 or
  1.75 (the browser launched with `--force-device-scale-factor`, so layout
  is in device px), and 4 on a phone, where the live layer is scaled 2x. A
  context's emulated fractional `deviceScaleFactor` shows 12-13 of 255
  instead: Blink then snaps layout to whole css px (a `left: 0.4px` reads
  back as 0.390625, the live rect 734.39 snaps to 734), which squeezes the
  live canvas's rows by half a device px. A real OS scaling in Chrome is
  assumed to match the flag; WebKit is not checked.
- `data-max-px="3000000"` budgets what is redrawn, the live canvas at
  rest (the box), so on desktop it draws at the screen's resolution; a
  burst's wider canvas may go over it for its few seconds. On a touch
  screen (`pointer: coarse`) the hearth draws at 1.5x and 24fps (60 again
  while a stoke or one of its embers is hot, as everywhere; an ember is hot
  until it reaches `^`, so the last cooled glyphs drift at the resting
  rate while the wider canvas stays until the last one is gone). The ray test runs only inside the
  solid's outline on each line, and each colour is one path of chained
  polylines in buffers kept across frames.
- `canvas.ntsHearth()` reports heat, frame-rate cap, resolution, box,
  the live canvas's rect, line spacing, the first line's height, the
  embers in the air (and how many are still hot), the spin (rad/s) and the palettes a glyph sheet was drawn for, for the
  tests (as `ntsPose()` reports the turn).

## NOT NOT PHILO

Files: `worlds/philo.css`, `worlds/cubes.js`, `worlds/philo.js`;
its hero lines are laid out as [World hero text](#world-hero-text) says.
Classes: `.philo-bar` (the red label with the misregistered charcoal plate;
`.sm`, `.caps`), `.philo-key` (the red extra-bold key word),
`.philo-rings` (the hero's full-bleed plate of engraved rings, centred on the orbit by custom properties that mirror the hero grid, fading out toward the hero's top and bottom; its rings are phased and cut as described below), `.volumes`/`.volume`, `.fig`. The entity is
`<div class="nts-penrose" role="img" aria-label="…"><!-- nts:still philo --><!-- /nts:still --></div>`;
philo.js appends a canvas and hides the still. Colours from
`--penrose-top`, `--penrose-side`, `--penrose-dark` (`#f5f5f7`, `#a6a7b2`,
`#53566b`) and `--penrose-ground`; before the bleed-in from the home they are
`#f7f1e4`, `#b9b1a3`, `#67625a` on the beige. The host class (`nts-penrose`) and the
ground token are internal names; renaming them would touch every page copy and palette test.

The ring plate and the trace. The plate's rings are 1px lines on a 9px pitch,
the first at `--ph` (the trace's outer radius `--tr` less its 1px line, modulo
the pitch; the gradient's stops run from `--ph` to `--ph + 9px`, so the period
is 9px whatever the phase). One ring would fall exactly on the trace, and a
second mask layer, intersected with the fade, cuts it out: the dashed orbit
runs over clear ground, a pitch either side to the next ring. The phase follows
the trace's size, so it holds at every width; without `mod()` the phase is 0
and only the alignment is lost. `--tr` is worked out in `.philo-rings` as the
trace is in `orrery.css` and `pages.css`: the entity width `--ew` (the grid's
entity column `--col`, `(100cqw - gap) / 2.1`, from 900px, capped at
`--entity-w`), capped at 92svh, less `--ring-inset`, halved; in cqw, because a
percentage in a gradient stop is of the gradient's length. A phone held
sideways sets `--ew`, `--cx`, `--cy` and `--pt` from its `--stage` square
(`orrery.css`, see [The home](INTERNALS.md#the-home-orrerycss-orreryjs-and-the-apertures-aperturescss)). Keep these in step
with `--cx`/`--cy` and with the trace's size; `tests/layout/philo-rings.spec.mjs`
(L2, L2b) checks the plate's centre, the phase, the period and the cut-out band
against the trace. The home fragment's rings have no trace and keep phase 0.

The figure (`cubes.js`) is Reutersvärd's impossible triangle of nine
cubes, going round. The model is a staircase of unit steps along x, y and
z, climbing toward the viewer and seen isometrically (drawn mirrored, the
1934 drawing's way round), so that seen straight on place 9 stands exactly
in front of place 0: that is what closes the loop.

- **The loop's order.** Straight on, where two cubes overlap the one
  further along the loop is in front (each cube covers the next, and at
  each corner the cube after it covers the one before). No back-to-front
  order paints a cycle, so the compositor breaks it at the cube nearest the
  tip, clips any cube painted after one that should cover it at that cube's
  edge. Because all nine move together, no pair's order changes during a
  tick, so nothing pops.
- **The motion.** Every 3 s (`TICK`) all nine step one place together, in
  the last second of a tick (`GLIDE`) and resting for the 2 s before it.
  Each figure's clock (the page's and the home fragment's) starts 0.5 s
  (`FIRST_GLIDE_IN` in `philo.js`) before the first glide, inside the rest, so
  that glide comes about when the page transition ends (the view-transition
  durations in `orrery.css`); later ticks are unchanged.
  The step runs backward along the loop (`cubesAt` reads the clock's phase
  negated; `phase` itself still counts forward): straight on, the cube at
  the tip goes straight back to place 8 along the crossing path. All nine
  are alike, so every tick shows the same picture.
- **The look.** All cubes are drawn alike, flat, with no outline: each of
  the three faces in view takes a tone by how much it faces the light (top,
  side, dark; `shader` thins them toward the ground for the turns below).
  Under the faces of a cube at full opacity lies a core, the cube's hull
  inset 0.75 px in the top tone, so no hairline of the ground shows in the
  seams; a fading cube gets none, since its faces would show the core
  through and shift toward the top tone. `paint()` takes
  `{ top, side, dark, ground }`.
- **The screw, turned.** The nine are the top turn of an endless staircase
  (`TURNS` turns drawn below, fading into the ground): every cube descends a
  place per tick, the deepest one fades out by opacity, and a new one comes
  in at the top from the turn above (the fades are by place, so they stay
  at the ends whichever way the glide runs). Places are counted again from
  the top at each tick, so the screw itself stays put. On the turned layer
  only, every other turn is a shade paler: a cube's fade becomes
  `1 - (1 - fade)(1 - 0.3 tone)`, tone being the parity of the turn
  (`floor(h / 9)`) blended by a smoothstep over the step from a turn's place
  8 to 9; it costs no extra draw, and the straight-on layer never takes
  it.
  The figure draws back as it turns (scale 1 / (1 + sin θ)), so more of the
  screw fits.
- **The handover.** Between 1° and 6° off the straight view the turned
  layer (the screw in true depth, by a plane between each overlapping pair)
  is drawn over the straight one (the top turn in the loop's order) with
  growing opacity, on a second canvas; past 6° only the screw is drawn.
  Straight on only the nine are drawn, so the closed picture is the same at
  every rest pose.

The page figure is turned by drag and tap only (no arrow keys, and the host is
not focusable), and its cubes keep moving while it is pressed, dragged or
turned. The turn is one number, the yaw u; `cubes.turn` (`cubes.js`) holds
its rules, in rad:

- **Poses.** Left (the default, -10.02°, -16.78°), straight, right (19.47°,
  10.89°), derived in code from the lattice step each looks along ([2,1,1],
  [1,3,2]): the view runs along the line between two cubes, so one covers the
  other exactly (right: place 8 covers place 2). The pitch is a cubic
  Hermite curve of the yaw through the three poses, linear past the ends.
- **The wheel.** A drag turns u by the part of each move along the circle
  round the figure's centre (the canvas centre, read once at the press),
  0.011 rad a px: anticlockwise on screen turns toward right, so a stroke
  down the left leg or to the right along the bottom turns right, one down
  the right leg turns left. Past the end poses the figure gives at most 9°
  more (`soften`).
- **A release** under 6 px of travel is a tap: from a turned pose any tap
  goes straight; from straight it goes right when it lands inside the hull of
  place 3, 4 or 5 and not 6's (6 is drawn over 5) or nearest the right leg
  (places 0 to 3), else left (`tapPose`, on the straight-on hulls computed
  from the model). A longer drag goes to the next pose in its direction when
  it covered over a third of the gap to it, else back to the one it began
  nearest (`landing`). `philo.js` runs u there on a critically damped
  spring (13 s⁻¹) and the figure stays: nothing settles it back. Reduced
  motion jumps to the pose.
- **Touch.** The host keeps `touch-action: pan-y`, so a touch that starts
  off the figure scrolls the page. The wheel needs vertical motion, so
  `philo.js` cancels a touch that starts on the figure (a non-passive
  `touchstart` with the same on-figure test as the press, which
  `preventDefault`s): the page doesn't pan for it and the pointer events go
  on. `touch-action` can't do this, since it is per element and not per pixel.
  `tests/behaviour/philo-touch.spec.mjs` drives both with touch events.

Turned,
the screw's lower turns dissolve through a CSS `mask-image` on the hero
canvas (`--screw-mask` in `philo.css`, a radial-gradient smoothstep), in
addition to the per-cube thinning toward the ground that `cubes.js` does.
The mask starts just beyond the rest figure's reach and is on only while
the figure is turned (`philo.js` sets `.is-turned` when the pose leaves the
straight view and clears it when the pose is exactly straight): masking costs
compositing time and at rest would mask nothing. The bleed-in's twin host is
cloned while the figure is straight, so `philo.js` mirrors `.is-turned` onto it
for as long as the twin exists, and the twin canvas gets the same mask. The home fragment's canvas
has none. `tests/static/philo-tokens.spec.mjs` (K3, K4) checks which
canvases are masked, when, and that the fade starts beyond the rest figure.

philo.js repaints only when the drawing would change: a frame repaints when
the motion's phase or the turn has changed, or while a bleed-in twin is open;
anything else that invalidates the canvas (a resize, new colours, a restart
after the loop stopped) goes through `draw`/`redraw` or clears the record of
the last frame.

`paint()` returns the drawn cubes' hulls, which philo.js hit-tests a
press against; `frame()` and `composite()` are what `tools/gen-stills.mjs`
records into the scripts-off still (flat filled paths, cut where a
cube is clipped; `--check` says when a committed still is stale). `tests/static/cubes.spec.mjs` checks
the model and `tests/behaviour/philo-figure.spec.mjs` the drawing.

The draw gate runs at 30 fps on the page and in the home's fragment, with 3 ms
of slack (`1000 / FPS - 3`): frame timestamps jitter, and a draw due a hair
early would slip a whole frame and land at an uneven 66 or 83 ms.
`tests/perf/philo-glide.spec.mjs` holds the cadence (even gaps in the glide, no
draw in the hold). In the home's orb the loop is sized by `REST.fragment`
(1.17): its widest span is about 1.09 orb widths, as large against the orb as
the other worlds' figures, so the round edge cuts it as it cuts theirs. Behind
it, the fragment's background is the hero's ring plate (the same 9 px pitch
and `--plate` weight) centred on the canvas, which is the figure's centre.
`tests/layout/home-bands.spec.mjs` checks both.

## INTERSECT

Files: `worlds/intersect.css`, `worlds/ascii.js`. The world sets IM
Fell as the body and heading face and the mono for labels; the title is
IM Fell behind a mono `>` prompt (the hero lines: World hero text). Classes: `.corr` (the correspondence
table), `.intersect-grain` (a grain div, first in body). The bar is clear at the top (the page grain shows through) and has no grain layer of its own; scrolled, it is `--w-bar-bg`, the ground's mean (`--w-bg-mean`, #131313, the grained ground's measured average) at 80% over a blur. The ground is a `body::before` layer (`--w-bg`) and `body` itself is `--w-bg-mean` (so is `html`, except while the bleed-in runs, `before` and `in`): iPhone Safari samples the body's background for its status strip, and WebKit paints landscape side bands from the sticky bar's colour. The `theme-color` meta is the same value (test `L11` compares them).
The entity is `<pre data-nts-ascii="tetra" data-cols="52" role="img" aria-label="…"><!-- nts:still intersect-lg --><!-- /nts:still --></pre>`;
figures: `tetra`, `heptagram`, `seed`. Live, `ascii.js` moves the baked
still into a hidden `span.ascii-still` and draws the glyphs on a canvas
over the pre's box, one `fillText` per line, in the pre's computed face
and colour, without a glow (on the page and in the fragments alike);
writing the text into the pre made the page lay out on
every frame. Those values are read at mount, on a resize and at the
bleed-in's start and end, never per frame, so a style that changes the
pre's colour at any other moment needs a redraw. The pre stays the box,
the accessible element and the target of drag and keys; the baseline
comes from a probe line in the same face at line-height 1, so the glyphs
sit where the pre's own lines put them (within a device pixel).
The size comes from `fit()`: the solid's mean silhouette span over every
pose a turn or a drag reaches (`SPAN.hero`, 0.97 of the ring, geometric;
the glyphs add about 5%) or its fragment's (`SPAN.fragment`), capped so
its furthest reach, a bound over all rotations, keeps a glyph clear of the
canvas. The page's canvas reaches 16.2% past the pre across and 17.6% down
(`intersect.css`), so the widest poses overshoot the ring as the other
worlds' figures do; `main` clips sideways overflow on that page. The
canvas sets a small face on whole-pixel advances, so the text is scaled
across to the cell width; the cell and each line's origin are snapped to
device pixels, so a glyph has the same ink wherever it falls. `tools/gen-stills.mjs` bakes each still as the
first live frame (`POSE` at the live zoom), and the pre's font size makes
the still's grid span the box as the live glyphs do. The overshooting tip
of a wide pose can't be grabbed: the canvas is `pointer-events: none` and
a press counts only on the pre. The solid is drawn by its edges: its faces
write depth but no glyph (0.05 further back, so a front edge wins against
its own faces), which hides the edges behind. 52 columns on the page and in a fragment (the same frame,
smaller).
