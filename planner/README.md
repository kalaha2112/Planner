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

## Visual language — Night Market

The planner is skinned as **Night Market**: acid lime, amber and papaya over a
green-black, with gradient accents on primary actions, frosted glass on the stop cards
and halo shadows instead of outlines. Light mode is plain white; dark mode is the hero,
where an aurora wash sits behind the page and the accents glow.

| Role | Light | Dark |
|---|---|---|
| Page / surface | `#FFFFFF` | `#0E1109` / `#171B10` |
| Ink | `#141709` | `#EFF6DF` |
| Structural (pills, buttons, nodes) | `#232A0E` | `#EFF6DF` |
| Cash / flight / active | `#FF5A2B` papaya | `#FF7A3D` |
| Miles / award / itinerary | `#FFA800` amber | `#FFBE3D` |
| Dates / train / saved | `#6FA800` lime | `#A8E82C` |

Type: **Space Grotesk** (display), **Sora** (UI), **Bebas Neue** (caps),
**Instrument Serif** (the italic date and sub lines).

It is all driven by the custom properties in `:root` and `[data-theme="dark"]` at the top
of `styles.css` — including the transport-mode colours (`--mode-*`, read by `MODE_HEX` in
`app.js`), so route pips, leg lines and map dashes recolour with the palette rather than
being frozen in JS. The `SURFACE TREATMENT` block near the foot of the sheet carries the
few things a token can't express (aurora, glass, gradient fills); it sits late in the file
deliberately, because those plain class selectors only beat the component rules they
override by source order.

## 3D and motion

- **three.js** (`vendor/three/`) — three things, all layered onto the existing layout rather
  than replacing it:
  - the **intro hero globe** (graticule, country outlines from the shared 110m atlas, lit stop
    markers and a route that traces itself out), sitting over the flat SVG globe;
  - the **packing case**, which is the original `PK_ART_*` artwork on textured planes moving in
    real perspective — the same drawing, turning and swaying in 3D, opening as you scroll;
  - low-poly **card icons** (calendar, bed, plane) on the three entry cards, built from
    primitives so there are no asset files to fetch.

  Everything reads its colours from the design tokens, so it all re-themes with the app.
- **GSAP + ScrollTrigger** (`vendor/gsap/`) — the scroll motion over the overview: the date
  range, map, entry cards, stats and to-dos reveal and stagger in, the map parallaxes and tilts
  as it passes (returning flat when settled, so Leaflet's hit-testing is never distorted), and
  the packing case's open/close is scrubbed against scroll position.

Both layers are strictly additive, and the fallbacks are tested: without WebGL, without
three/GSAP, or under `prefers-reduced-motion`, the flat SVG globe, the flat SVG card icons and
the original two-PNG suitcase crossfade are what render, and nothing animates.

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
(The PWA wiring below is stripped from this build — `file://` pages can't register a service worker.
That also means no share-target registration: in the single file, import shared posts by pasting
or dropping them.)

## Install as an app (PWA)

The served planner is a full **installable app**: manifest, icons, offline service worker,
standalone display, and safe-area handling for notched phones.

- **Install** — serve over `https://` (or `localhost`) and use the browser's *Install app* /
  *Add to Home Screen* action. It launches full-screen in its own window, with the paper-shell
  theme color and the route-pin icon (`icons/`).
- **Share target** — once installed on Android, Planner shows up in the system share sheet, so a
  RedNote / TikTok / Instagram post can be sent straight to it (see
  [Importing shared posts](#importing-shared-posts)).
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

Because the deploy tracks `main`, every merge to `main` redeploys the hosted copy — no URL
bumping needed. Pages serves from a real HTTPS origin, so the service worker, offline cache
and "install as app" all work.

## Cross-device sync (shared, no sign-in)

Sync is backed by **Supabase** (Postgres + Realtime). There is **no sign-in and no codes**:
every device that opens the app reads and writes **one shared row** and auto-syncs it in
realtime. Anyone with the link shares these trips — it's meant for you + people you trust,
not a private per-user account.

- **Config** (`app.js`): `SUPABASE_URL`, `SUPABASE_ANON_KEY` (a publishable client key — safe
  to ship), `CLOUD_TABLE = 'shared_state'`, and `SHARED_ID` (the single row id). The client is
  vendored at `vendor/supabase/supabase.js`.
- **How it flows** — on load the app reads the shared row (or seeds it from this device's
  trips), then subscribes to `postgres_changes` on that row. A local edit bumps a millisecond
  `rev` and upserts (debounced ~1s); a realtime change on another device triggers a re-fetch
  of the authoritative row. Conflicts resolve last-write-wins on `rev`.
- **Offline** — edits save to `localStorage` first and upload automatically on reconnect; two
  tabs on the same origin also mirror live via `storage` events.

### Supabase setup (one-time, per project)

In the Supabase **SQL editor**, run this. No auth configuration is needed — the app talks to
the shared row with the publishable (anon) key.

```sql
create table if not exists public.shared_state (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  rev bigint not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.shared_state enable row level security;
-- shared space: the app's publishable (anon) key may read/write the shared row
create policy "shared anon access" on public.shared_state
  for all to anon using (true) with check (true);
alter publication supabase_realtime add table public.shared_state;
```

> Because access is open to the `anon` role, keep the app's link to people you trust. To make
> the data private again, switch back to per-user accounts (auth + a `user_id`-keyed table
> with `auth.uid() = user_id` policies).

## Features

- **Multiple trips** — add, rename, remove, drag-to-reorder; two seeded routes (Central Europe,
  Scandinavia).
- **Route timeline** — origin → legs → stop cards → home; add / insert / delete / drag-reorder
  stops; per-leg mode + duration + cost/miles; per-stop nights with auto-computed check-in/out
  dates.
- **Itinerary modal** — month calendar of the stay; per-day timed activity items (time, text,
  address → Google Maps, note, cost); an **outfit "closet"** (add by click / paste / drop, with a
  canvas background-knockout) whose stickers drag onto calendar days.
- **Import from a shared post** — send a RedNote / TikTok / Instagram post to the app (or paste
  it) and it pulls out the places, times, addresses and prices, then drops the ones you tick onto
  a chosen day. See [Importing shared posts](#importing-shared-posts).
- **Optimize route** — a one-click optimizer reorders the selected day's activities to remove
  backtracking, using each activity's geocoded address (nearest-neighbour + 2-opt over the pins).
  It keeps the schedule chronological (reassigns existing times in order), reports how much shorter
  the walking route is, and is undoable (⌘/Ctrl-Z). Runs entirely in-browser — no API key.
- **Accommodation modal** — compare lodging options per stop (name, link, price, distance,
  features); clicking one books it, which feeds the lodging budget, lifts it to the top of the
  list on a turning wheel, and crosses its line off the Bookings checklist.
- **Bookings checklist** — every flight, train and chosen hotel the route implies, one line per
  item per city, crossed out as each is booked. See [Bookings](#bookings).
- **Prices in any currency** — type a hotel price or fare the way it's quoted (`1 euro`, `1.5 pl`,
  `9800 czk / 4 nights`) and the currency is read out of the text and converted to CAD live.
  See [Foreign-currency prices](#foreign-currency-prices).
- **Station pickers on rail legs** — set a leg to Train and it gains depart/arrive station fields
  that suggest the actual stations of the two cities that leg connects.
  See [Train stations](#train-stations).
- **Budget modal** — flights, intercity transport, city transit (researched local-currency day
  passes → CAD), lodging, food, activities, buffer; editable assumptions; live total + per-person.
- **Map** — Leaflet route with mode-colored legs and clickable stop markers (→ open itinerary).
- **Persistence** — autosaves to `localStorage` (`europe-trip-state-v1`); **Export / Import** as
  JSON; **Reset** restores the default route.

## Bookings

Anything the route implies you have to reserve shows up as a line in **Bookings**, beside the
pre-trip to-do list — one line per item per city:

```
PRAGUE
 ☑ B̶o̶o̶k̶ ̶f̶l̶i̶g̶h̶t̶ ̶f̶r̶o̶m̶ ̶N̶e̶w̶ ̶Y̶o̶r̶k̶ ̶(̶J̶F̶K̶)̶
 ☑ B̶o̶o̶k̶ ̶H̶o̶t̶e̶l̶ ̶J̶o̶s̶e̶f̶
KRAKÓW
 ☐ Book train from Prague
 ☐ Book Hotel Stary
```

Each city gets the journey that reaches it and one hotel line. The hotel line always reads
**Book a hotel** and strikes through once something is booked there — naming the hotel would only
repeat what the Sleeping list already shows, and a split stay would read as two identical lines.

Tick it anywhere. A leg has a **Booked** box in its transport editor; a hotel is booked by
clicking it in the accommodation list, which stamps a **BOOKED** badge on the row and lifts it to
the top on the wheel. Every checklist line has its own box too. They all write one flag, so
ticking any of them crosses the line out and moves the counter.

The checklist is derived from the trip on every render rather than stored, so renaming,
reordering or deleting a stop can't leave a stale reminder behind.

## Foreign-currency prices

Research arrives in the local currency — a Prague hotel quotes CZK, a Trenitalia fare quotes EUR —
but every rollup in the app is CAD. So the two price fields that feed the budget read a currency
as well as an amount:

| Field | Where |
|---|---|
| Hotel **Total price** | Accommodation research, per option |
| Transport **Cost / pp** | Transport modal, and the compact leg editor on each stop card |

**Just type it.** Both fields are free text and the currency is read straight out of what you
wrote — `1 euro`, `1.5 pl`, `€42`, `500 yen`, `9800 czk / 4 nights`. Currency codes work exactly
or by any unambiguous prefix (`pl` → PLN, `cz` → CZK), as do names and nicknames (`pounds`,
`quid`, `zloty`, `forint`, `yen`) and symbols. Wording around the number is ignored, so
`9800 czk / 4 nights` is 9800 CZK; when several numbers appear the one carrying a currency wins,
so `2 nights at 100 eur` is 100 EUR, not 2.

The dropdown beside the field answers for a **bare** number — type `420` and it's whatever the
dropdown says. Once the text names a currency the dropdown stops being a control and just reports
what was read, because two controls arguing over one value is worse than one control and an
explanation.

Nothing is ever guessed. A symbol several currencies share (`kr` across the Nordics, `$` across
ten) resolves to the currency already selected if it's one of them; otherwise the field says
`that symbol is DKK / NOK / SEK / ISK — pick one` and converts nothing until you do.

What you typed is stored verbatim and never rewritten — only the amount and the conversion are
derived — so the figure you researched is still the figure you see. Under a non-CAD field the app
prints what it works out to (`≈ $608 CAD · 1 CZK = $0.062`); on a collapsed hotel row the price
reads `9800 CZK ≈ $608`. A CAD price shows no conversion line at all, so nothing changes for
prices already in dollars.

One limit worth knowing: commas are read as thousands separators, as they always were, so `1,5`
is 15 rather than 1.5 — write `1.5`.

The **Budget** receipt converts each leg and each chosen hotel individually — one stop can mix a
€-quoted hotel with a $-quoted one — and names the currencies it folded in on the affected lines
(`trains & buses from route legs · converted from EUR`).

Rates live in the `FX_CAD` table in `app.js` (the same table the city-transit day passes already
used) and are static — they're travel-planning estimates, not live FX, and no network call is made.
Editing a rate re-converts everything that references it. The currency list offered in the pickers
is derived from that table, so adding a rate is enough to add the currency.

Trips saved before this existed load as CAD, with totals unchanged.

## Train stations

A city is not a station. "Paris → Milan" leaves from one of seven Paris termini, and which one is
on the ticket — so a leg set to **Train** or **Overnight train** grows two extra fields, *Depart*
and *Arrive*, each labelled with the city it belongs to and each offering that city's stations:

```
DEPART · PRAGUE     Praha hlavní nádraží      ← list: hl.n., Holešovice, Masarykovo
ARRIVE · KRAKÓW     Kraków Główny
```

The cities are read off the route, not stored on the leg, so renaming or reordering a stop
re-aims both lists immediately.

**A stop's section is the journey that reaches it** — which is what "Getting there" means, and what
the route map's stop card already showed. So *Depart* is the previous stop (the origin, for the
first one) and *Arrive* is the stop itself.

The leg **home** from the last stop has no section of its own, by design: every section belongs to
the stop it reaches, and that leg reaches no stop. It still exists on the route and its fare still
counts in the budget — it just isn't edited here. (On the seeded routes it's zero, because the
return is on the same ticket as the outbound flight.)

Worth knowing if you read the source: a stop stores its own **departure** leg (`stops[i].leg`
leaves `stops[i]` — the seed route settles it, since Paris is the last stop and `Paris.leg` is the
9h45 Air France home). The leg *reaching* stop `i` is therefore `legByIndex(i)`, one earlier.

The list **suggests, never restricts** — it's a `<datalist>`, so a station that isn't in the table
can simply be typed, and nothing is auto-filled on your behalf. The empty field shows the city's
main station as a placeholder so you can see what the list is offering.

Coverage is `CITY_STATIONS` (`app.js`): **146 of the 173 cities the app knows**, with the main
station first and secondary termini after it (Berlin lists Hauptbahnhof through Lichtenberg, Zoo
and Spandau), in the local spelling printed on boards and tickets. Adding a city is one line.

The 27 without a list mostly have no intercity passenger rail at all — Reykjavík, Dubrovnik,
Valletta, Bali, Calgary — and the rest are left out rather than guessed, since an invented station
name is worse than none. Those cities still get both fields; type your own.

Lookups are forgiving. Accents don't matter (`Gdansk` finds `Gdańsk Główny`), local and alternate
spellings alias to the same list (`Köln`→Cologne, `Milano`→Milan, `Firenze`→Florence), and origin
and home labels carrying an airport code fall back to the bare name, so `Vancouver (YVR)` and
`New York (JFK)` still resolve.

## Importing shared posts

Travel research arrives as a RedNote note, a TikTok video or an Instagram reel. The planner takes
that share and turns it into itinerary rows — **entirely in the browser**. Nothing is fetched from
those platforms (they block cross-origin reads of their pages, and there's no API key here): the
app reads only the text the share sheet or your clipboard hands over. That's enough, because the
posts people save for travel are almost always structured lists.

**Three ways in**

1. **Share sheet → Planner** (installed PWA on Android). `manifest.webmanifest` declares a
   `share_target`, so Planner appears in the system share sheet. The share arrives as
   `?title=&text=&url=` on the app's start URL; `initShareTarget()` consumes it, scrubs the query
   out of the address bar, and opens the review sheet already filled in.
   *iOS/iPadOS doesn't implement Web Share Target* — there, use **Copy link** / **Copy** in the
   post's menu and paste (route 2).
2. **Paste** — **Import post** on any day header opens the sheet, already aimed at that city and
   day; paste into the box, or hit **Paste from clipboard**. A paste extracts immediately.
3. **Drop** — drag a link or selected text onto the box.

**What it extracts** (`social-import.js`, a pure module with no app dependencies)

| From the post | Becomes |
|---|---|
| `📍1. Blue Bottle Coffee`, `• Tram 28`, `☕️ Fuglen` | an activity |
| `地址：…` / `Address: …`, or `Name, 12 Some St, City` | the activity's address (→ map pin, Google Maps link) |
| `9:00`, `12:30`, `上午9点`, `7pm` at the start of a line | the activity's time |
| `营业时间：8:00-19:00`, `推荐理由：…`, a trailing ` — go early` | the activity's note |
| `$15` | the activity's cost |
| `Day 2`, `第三天`, `2日目` | which day each activity lands on |
| `#kyoto`, city names in the text | the stay it's aimed at, when it matches one of your stops |

Lines are scored on those signals and only clear the bar with real evidence, so captions and
comments don't turn into fake stops. Everything found is shown **for review** — editable, with a
tick per row, a city + day target, and a "keep the post's N days" option — and nothing touches the
itinerary until you press **Add**. A re-import won't duplicate a place already on that day, and
⌘/Ctrl-Z undoes the whole batch.

Two deliberate limits:

- **Only `$` amounts become a cost.** The Activities budget line is plain dollars, so `¥1200` or
  `€18` is kept as a note rather than silently distorting the total.
- **Images aren't read** — no OCR. A share that's only a link yields one row (the post itself) so
  you can keep it as a to-check reminder; paste the caption for a full read.

Imported rows carry a small **RedNote / TikTok / Instagram** chip linking back to the post.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Document shell — fonts, local Leaflet, PWA wiring, mounts `#app`. |
| `social-import.js` | Shared-post extractor — text in, candidate activities out. Pure, offline, no deps. |
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
