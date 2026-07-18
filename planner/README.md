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

The Leaflet library is **vendored locally** (`vendor/leaflet/`), so the maps load without a CDN.
Only the **map tiles** need an internet connection (OpenStreetMap); offline, the route still draws
as vector markers + lines on a blank background.
Everything else works offline.

### Single-file build (open anywhere, no server)

If you'd rather just **double-click one file** — no server, no relative-path issues — build the
self-contained bundle:

```
cd planner
node build.js            # writes standalone.html (everything inlined)
node build.js --watch    # keep standalone.html in sync while you edit the sources
```

`standalone.html` inlines `styles.css`, `app.js`, and Leaflet into a single HTML file you can open
directly (a `file://` address). It's a **generated** file — edit the sources (`app.js`, `styles.css`,
…), not `standalone.html`; run `node build.js` (or leave `--watch` running) and your edits flow into
it. Map tiles + address geocoding still need internet, same as the served version.
(The PWA wiring below is stripped from this build — `file://` pages can't register a service worker.)

## Install as an app (PWA)

The served planner is a full **installable app**: manifest, icons, offline service worker,
standalone display, and safe-area handling for notched phones.

- **Install** — serve over `https://` (or `localhost`) and use the browser's *Install app* /
  *Add to Home Screen* action. It launches full-screen in its own window, with the paper-shell
  theme color and the route-pin icon (`icons/`).
- **Offline** — `sw.js` precaches the app shell (HTML/CSS/JS, vendored Leaflet + TopoJSON,
  icons) with a **network-first** strategy: online you always run the latest build; offline the
  last-seen build boots and your trips load from `localStorage` as usual. Map tiles you've
  already viewed are cached (capped at ~400 tiles) so visited map areas render offline; fonts
  are cached stale-while-revalidate. Geocoding and the cross-device sync backends are never
  cached — they stay live-only.
- **App feel** — `viewport-fit=cover` + `env(safe-area-inset-*)` padding keeps content clear of
  the notch/home indicator; pull-to-refresh is suppressed in the installed app.

To force-refresh the offline copy after deploying changes, bump `VERSION` in `sw.js` (old
shell caches are cleaned up on activation).

## The hosted web version

The full PWA is published via **GitHub Pages** from the `planner/` folder on the `main`
branch of this repo (deployed by `.github/workflows/deploy-pages.yml`):

<https://kalaha2112.github.io/Planner/>

The Sync modal is wired to this URL (`HOSTED_WEB_URL` in `app.js`): tap **Open the web
version** and it opens the hosted planner with `?sync=<code>` appended, so the opened page
auto-connects to this device's endpoint and edits flow both ways. Before it opens, this
device flushes its most recent edit to the sync endpoint (uploads are debounced), so the
other device never pulls a stale copy that's missing your newest trip. If the device isn't
linked yet, the one-tap button first creates a sync endpoint, then opens the hosted page
already linked. Because the deploy tracks `main`, every merge to `main` redeploys the hosted
copy — no URL bumping needed. (Pages serves from a real HTTPS origin, so the service worker,
offline cache and "install as app" all work — unlike the old rawgithack single-file host.)

## Keeping the app and the hosted standalone.html in sync (both ways)

The installed app and a hosted copy of `standalone.html` (e.g. on **rawgithack**) stay in
sync in two ways, depending on where each is served from:

- **Same host (zero setup, live)** — if the app was installed from the same host that serves
  `standalone.html` (e.g. both under `raw.githack.com/...`), they share the same
  `localStorage`. Each copy listens for `storage` events, so an edit saved in one window
  appears in the other **live** (within ~1s) — no codes, no accounts. (Note rawgithack has two
  hosts: `raw.githack.com` and `rawcdn.githack.com` are *different* origins and don't share
  storage — use the cloud sync below across them.)
- **Different hosts (cloud sync)** — open **Sync** in either copy and connect a textdb
  endpoint, then link the other copy to the same endpoint. Easiest way: once one side is
  linked, open the other side with `?sync=<code>` appended to its URL (the Sync dialog shows
  the exact snippet) — it links itself and loads the trips automatically. From then on every
  edit uploads (debounced ~1s) and each copy pulls every 20s, on focus, and on reconnect.
  Conflicts resolve last-write-wins on a per-edit revision stamp.

Offline behaviour: edits made in the installed app while offline are saved locally, then
uploaded automatically the moment the device is back online — the hosted copy picks them up
on its next pull, and vice versa.

## Features

- **Multiple trips** — add, rename, remove, drag-to-reorder; two seeded routes (Central Europe,
  Scandinavia).
- **Route timeline** — origin → legs → stop cards → home; add / insert / delete / drag-reorder
  stops; per-leg mode + duration + cost/miles; per-stop nights with auto-computed check-in/out
  dates.
- **Itinerary modal** — month calendar of the stay; per-day timed activity items (time, text,
  address → Google Maps, note, cost); an **outfit "closet"** (add by click / paste / drop, with a
  canvas background-knockout) whose stickers drag onto calendar days.
- **Optimize route** — a one-click optimizer reorders the selected day's activities to remove
  backtracking, using each activity's geocoded address (nearest-neighbour + 2-opt over the pins).
  It keeps the schedule chronological (reassigns existing times in order), reports how much shorter
  the walking route is, and is undoable (⌘/Ctrl-Z). Runs entirely in-browser — no API key.
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
| `index.html` | Document shell — fonts, local Leaflet, PWA wiring, mounts `#app`. |
| `vendor/leaflet/` | Bundled Leaflet 1.9.4 (js/css/images) — no CDN dependency. |
| `styles.css` | Wanderbook-reskinned design tokens + all component styles. |
| `app.js` | State, computations, rendering, and interactions (vanilla, no framework). |
| `manifest.webmanifest` | Web app manifest — install metadata, standalone display, icons. |
| `sw.js` | Service worker — offline app shell, capped tile cache, font cache. |
| `icons/` | App icon (SVG source + rendered 192/512/apple-touch PNGs). |

## Design lineage

The source design was authored as a Claude "Design Component". Its bespoke `<x-dc>` templating
runtime was **not** ported — the logic class and template were read as a behavior/visual spec and
re-expressed here as idiomatic vanilla JS. The seed data, `CITY_COORDS`, FX / city-transit rate
tables, and the budget / miles / date formulas are ported faithfully.
