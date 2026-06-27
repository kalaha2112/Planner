# Europe Trip Planner

An interactive, single-page planner for multi-city European itineraries — build a route of
stops connected by travel legs (flight / train / overnight train / Flying Blue award), track
nights, cost & miles, plan each city day-by-day, compare accommodation, manage a pre-trip
to-do list, see a live route map, and roll everything up into nights / budget / miles stats.

This is a **standalone project**, independent of the Wanderbook book app in this repo. It keeps
the layout, structure, and behavior of the original *Europe Trip Planner* design, but is
**re-skinned in Wanderbook's editorial visual language** — the Playfair Display / Bebas Neue /
Cormorant Garamond / DM Sans type stack and an ink/brown/red paper palette. The original
design's functional accents (gold for award miles / itinerary, green for dates / train) are
retained so the route's color-coding stays legible.

## Run

It's plain HTML/CSS/JS — open `index.html` in a browser, or serve the folder:

```
cd planner
python3 -m http.server 8000   # then visit http://localhost:8000
```

The route **map needs an internet connection** (Leaflet + OpenStreetMap tiles, loaded from CDN).
Everything else works offline.

## Features

- **Multiple trips** — add, rename, remove, drag-to-reorder; two seeded routes (Central Europe,
  Scandinavia).
- **Route timeline** — origin → legs → stop cards → home; add / insert / delete / drag-reorder
  stops; per-leg mode + duration + cost/miles; per-stop nights with auto-computed check-in/out
  dates.
- **Itinerary modal** — month calendar of the stay; per-day timed activity items (time, text,
  address → Google Maps, note, cost); an **outfit "closet"** (add by click / paste / drop, with a
  canvas background-knockout) whose stickers drag onto calendar days.
- **Accommodation modal** — compare lodging options per stop (name, link, price, distance,
  features); mark one as chosen (feeds the lodging budget).
- **Budget modal** — flights, intercity transport, city transit (researched local-currency day
  passes → CAD), lodging, food, activities, buffer; editable assumptions; live total + per-person.
- **Map** — Leaflet route with mode-colored legs and clickable stop markers (→ open itinerary).
- **Persistence** — autosaves to `localStorage` (`europe-trip-state-v1`); **Export / Import** as
  JSON; **Reset** restores the default route.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Document shell — fonts, Leaflet CDN, mounts `#app`. |
| `styles.css` | Wanderbook-reskinned design tokens + all component styles. |
| `app.js` | State, computations, rendering, and interactions (vanilla, no framework). |

## Design lineage

The source design was authored as a Claude "Design Component". Its bespoke `<x-dc>` templating
runtime was **not** ported — the logic class and template were read as a behavior/visual spec and
re-expressed here as idiomatic vanilla JS. The seed data, `CITY_COORDS`, FX / city-transit rate
tables, and the budget / miles / date formulas are ported faithfully.
