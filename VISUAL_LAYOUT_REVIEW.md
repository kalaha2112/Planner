# Planner PWA — Visual, Clustering & Layout Review

A review of the **`planner/` app** (the *Europe Trip Planner* PWA, distinct from the
Wanderbook book prototype). Grounded in the rendered UI — the app was served locally and
captured with headless Chromium across both themes, all four desktop "ledger" leaves, the
budget receipt, and the mobile "app book" — and cross-referenced against `styles.css` /
`app.js`.

**Scope:** advisory only. No source files were changed. Findings are prioritized
**High / Medium / Low**; each is *observation → why it matters → proposed fix*, with the
concrete selector/token to touch.

---

## What's already working

Worth stating plainly, because the fixes below should preserve it:

- **A coherent editorial token system** — the ink ladder, radii scale (`--r-*`), and type
  roles are disciplined; the "ledger/paper" identity is strong and consistent.
- **A genuinely thorough dark theme** (`styles.css:81+`) — every literal is re-mapped, not
  just inverted; it reads beautifully (and, ironically, fixes the map — see H1).
- **Two delightful metaphors** — the packing **"Suitcase"** leaf (objects leader-lined to a
  hand-drawn case + checklist) and the budget **"printed receipt"** (mono type, barcode,
  torn edge, "printer-on" dot). These are the high points; protect them.
- **The mobile vertical composition** — map → 3 action cards → stats → packing → to-do — is
  clean, scannable, and well-clustered. It is arguably a better information design than the
  desktop leaves (see M3).
- Accessible focus ring (`:focus-visible`, `styles.css:160`) and a real reduced-motion path.

---

## Top 5 quick wins

1. **Make the route line visible in light mode** (H1) — one token: `--map-route`.
2. **Lighten the basemap landmass** so it stops swallowing the route + content (H2).
3. **Un-collide pin numbers from city labels** on the map (H3).
4. **Ship a travel-themed default intro headline** — the current default is lorem about
   Tim Berners-Lee (L1).
5. **Add a backdrop behind the budget receipt** so it reads as a modal, not floating debris
   over a lit map (M4).

---

## High priority

### H1 · The route polyline is invisible in light mode
The map's whole job is to show the *route*, but in light mode only the disconnected red
number pins render — no lines between them. Cause: `--map-route: #000000` (`styles.css:50`)
draws the polyline in black **on top of** the black landmass `--map-land: #000000`
(`styles.css:48`). In **dark** mode the same polyline is `#F2EFE7` (warm white,
`styles.css:121`) and the Prague→Kraków→Budapest→Paris route is crisp and legible. So the
core visualization silently works in one theme and fails in the other.
**Fix:** give the light-mode route a color that contrasts with the land fill — e.g. the
brand red `--red`, or white with a thin dark casing — decoupled from the land color.

### H2 · The basemap reads as a near-solid black inkblot
`--map-land: #000000` fills every landmass pure black (route leaf + budget leaf). It's
dramatic but it (a) hides the route line (H1), (b) makes the red pins fight a near-black
field, (c) reduces country shapes to barely-readable grey seams, and (d) visually
outweighs everything else on the page. The map dominates the composition rather than
serving it.
**Fix:** move land to a paper/ink *tint* (a light warm grey in light mode, as dark mode
already effectively does with `#0B0A09`), give borders defined contrast, and reserve the
strongest values for the **route + pins** — the things the user actually reads.

### H3 · Pin number badges collide with city labels
On the map, each red numbered marker sits directly on the OSM gold city label, so they
overprint: "**1**PRAGUE", "**4**PARIS", "**3**BUDAPEST" (visible on both the route and
budget leaves). It looks like a rendering bug and hurts legibility of both the number and
the name.
**Fix:** offset the stop label from the marker (a small leader or a right-anchored chip),
or suppress the basemap label where a stop pin coincides so only one label shows.

### H4 · Ledger leaves have a very low content-to-canvas ratio
Each desktop leaf is a **full-viewport page**, but the content clusters at the top:
- *Transport & Hotels* — the two columns fill only the top ~30%; the lower ~70% is blank,
  with the full-height vertical divider running through the void.
- *Itinerary* — with no day selected the entire right half is empty; the calendar highlights
  only the 4 stay days in a mostly-grey month.
- *Route* — the right column ends after four stop names; its lower half is empty.

The pages feel abandoned rather than spacious.
**Fix (pick per leaf):** cap the content column to its natural height and vertically center
the block; or shorten the leaf to fit content; or fill the space deliberately (the *Suitcase*
leaf shows how a full-bleed illustration earns the height). Don't let a full-height divider
frame emptiness.

---

## Medium priority

### M1 · Cold-start / empty states are stark
Closely related to H4: an empty trip shows an empty calendar, "SLEEPING — No options yet",
empty right panes, and "0 of 5 packed" with lots of blank canvas and little guidance. A new
user's first screen is mostly white space.
**Fix:** richer empty states — ghost/sample cards, one-line prompts, a suggested first
action — so sparse data still reads as designed.

### M2 · Border-weight monotony flattens hierarchy
`--line`, `--brown`, and `--dash` are all pure black `#000000` (`styles.css:14,29,32`) and
are applied as 1px borders to nearly everything: cards, the summary box, todos, the map,
input underlines, todo checkboxes, pills, dividers. With every element outlined at the same
weight, nothing recedes — the UI reads boxy and busy, and grouping is carried entirely by
proximity, not by container weight.
**Fix:** introduce a small border ladder — keep black for true structural containers, but
demote minor dividers / secondary boxes to a hairline grey (a `--line-soft`). Preserves the
ledger character while restoring depth.

### M3 · Desktop and mobile are effectively two different UIs
Desktop is a **paginated notebook** of map/form leaves (with the empty-page problem, H4);
mobile is a **single scrolling stack** (map → Itinerary/Hotel/Transport cards → stats →
packing → to-do) that is tighter and more scannable. The rich `.stop` cards with 36px
Josefin city names (`styles.css:331-407`) only surface in the mobile/compact context. The
divergence means twice the surface to maintain and an inconsistent mental model.
**Fix:** let the more successful mobile stacking inform the desktop empty leaves (denser,
content-sized blocks rather than full-viewport pages), and reconcile where the "big stop
card" pattern lives.

### M4 · The budget receipt floats without a backdrop
The receipt slides in on the right **over a fully-lit black map** — no scrim, no blur — so
it reads as floating debris rather than a focused modal, and the busy map competes with it.
It also overflows the viewport (only the tail — TOTAL / barcode — was visible; the itemized
lines sat above the fold).
**Fix:** dim/blur the leaf behind the receipt, and frame the receipt so it fits or scrolls
within its panel rather than running off-screen.

### M5 · The functional color code is carrying a lot at once
Four coded colors coexist and several do double duty: **red** = stops + cash + flight;
**gold** = miles + itinerary + links + *map city labels*; **green** = dates + train + saved
+ chosen. On the route leaf alone the eye must parse a green date header, a red total, a
gold "reward points" figure, red pins, and gold map labels simultaneously.
**Fix:** audit for overload — especially gold, which labels the map *and* signals miles *and*
marks itinerary. Consider narrowing each hue to one primary meaning.

### M6 · Mixed illustration styles on the packing leaf
The suitcase is clean line-art, but the floating objects (laptop + AirPods, packing cube,
passport/notebook) are photographic/rendered greyscale. Side by side the styles clash.
**Fix:** commit to one register — ideally line-art for everything, to match the suitcase and
the hand-drawn intro globe.

---

## Low priority / polish

- **L1 · Intro headline is placeholder lorem.** The default startup hero reads "THE FIRST
  WEBSITE WAS PUBLISHED IN 1990 BY COMPUTER SCIENTIST TIM BERNERS-LEE AND NOW IT SEEMS LIKE
  AN EYESORE…" — filler, not travel copy. It's editable/persisted (`meta.introText`,
  `app.js:97`), but `DEFAULT_INTRO_TEXT` should be on-brand for a trip planner.
- **L2 · Wheel over-scroll skips leaves.** The intro→planner scroll and the leaf paging share
  one wheel axis, so a single gesture can jump from the intro past the route into the
  itinerary. Add a short threshold/lock at the intro-park boundary before paging engages.
- **L3 · Small tap targets & micro-labels.** Grip (34×20), trash (18×20) at opacity .7, and
  7–10px uppercase labels are borderline for touch/accessibility; nudge to ~44px targets and
  verify label contrast (`--ink-mute` on `--shell`).
- **L4 · Vertical divider tabs.** The right-edge ITINERARY / TRANSPORT & HOTELS / PACKING
  tabs are elegant but vertical text is slower to scan, and active(black)/inactive(outline)
  differ subtly — consider a stronger active affordance.
- **L5 · Documented type stack drift.** CLAUDE.md / the planner README cite the Wanderbook
  stack (Cormorant Garamond, DM Sans), but the app ships Jost / Sora / Josefin Sans. Harmless
  but worth reconciling the docs so the system stays legible to future work.

---

## Suggested sequencing

1. **H1 + H2 + H3** together — they're all the map, and the map is the app's signature
   surface. Biggest visible improvement for the least code (mostly tokens + label logic).
2. **H4 + M1** — the empty-page/empty-state problem; the single largest "feels unfinished"
   driver.
3. **M2 + M4 + M6** — hierarchy and finish polish.
4. **M5** and the **L** items — refinement.

Happy to implement any subset on request.
