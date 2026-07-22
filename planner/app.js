/* ============================================================
   EUROPE TRIP PLANNER — vanilla port
   Behaviour/data ported from the design's Component logic class.
   Rendered with template strings + event delegation; a full
   re-render runs on each mutation (safe: all field edits commit
   on `change`, i.e. after blur, so typing is never interrupted).
   The Leaflet map node is persistent and re-attached each render.
   ============================================================ */
(() => {
  "use strict";

  /* ---- component-level toggles (design props) ---- */
  const SHOW_MAP = true;
  const SHOW_COSTS = true;

  // City SVG coordinates  viewBox 0 0 740 480  lon -10…32°E  lat 38…62°N
  // x = (lon + 10) / 42 * 740    y = (62 - lat) / 24 * 480
  const CITY_MAP = {
    // Scandinavia
    'oslo':[365,42],'stockholm':[495,54],'copenhagen':[396,127],'kobenhavn':[396,127],
    'helsinki':[616,37],'bergen':[270,32],'gothenburg':[387,87],'goteborg':[387,87],
    'trondheim':[320,4],'malmo':[388,128],'aarhus':[360,107],'turku':[580,100],
    // British Isles
    'london':[176,210],'edinburgh':[120,120],'dublin':[66,173],'manchester':[137,170],
    'glasgow':[103,122],'birmingham':[137,187],'bristol':[122,205],'liverpool':[118,180],
    // Western Europe
    'paris':[218,263],'marseille':[271,374],'lyon':[238,318],'bordeaux':[148,325],
    'amsterdam':[263,192],'brussels':[253,222],'bruxelles':[253,222],
    'antwerp':[262,208],'rotterdam':[250,198],'cologne':[299,220],'koln':[299,220],
    'frankfurt':[330,237],'hamburg':[352,171],'dusseldorf':[282,205],
    'zurich':[327,292],'bern':[308,303],'geneva':[285,315],'geneve':[285,315],
    'madrid':[111,432],'barcelona':[215,413],'seville':[66,466],'sevilla':[66,466],
    'lisbon':[15,466],'lisboa':[15,466],'porto':[24,418],'bilbao':[148,371],'valencia':[194,443],
    // Central Europe
    'berlin':[413,189],'munich':[385,282],'munchen':[385,282],'vienna':[465,280],
    'wien':[465,280],'prague':[431,238],'praha':[431,238],'warsaw':[547,196],
    'warszawa':[547,196],'krakow':[529,239],'krakow':[529,239],'krakow':[529,239],
    'budapest':[512,290],'bratislava':[478,282],'brno':[463,262],'wroclaw':[477,218],
    'poznan':[450,196],'gdansk':[506,153],'lodz':[500,210],'lublin':[558,217],
    'salzburg':[425,283],'innsbruck':[398,294],'graz':[470,298],'linz':[444,272],
    'dresden':[430,207],'leipzig':[415,212],'stuttgart':[338,257],
    'nuremberg':[365,254],'nurnberg':[365,254],'bonn':[294,218],
    // Italy
    'milan':[339,328],'milano':[339,328],'venice':[395,329],'venezia':[395,329],
    'rome':[397,402],'roma':[397,402],'florence':[376,362],'firenze':[376,362],
    'naples':[429,422],'napoli':[429,422],'bologna':[373,345],'turin':[302,330],
    'torino':[302,330],'genoa':[324,348],'genova':[324,348],'pisa':[356,357],
    'palermo':[402,468],'bari':[470,408],'catania':[428,475],
    // Balkans & Eastern Med
    'zagreb':[458,322],'ljubljana':[432,318],'sarajevo':[502,342],
    'belgrade':[535,326],'sofia':[580,358],'bucharest':[636,349],
    'dubrovnik':[495,372],'split':[466,354],'skopje':[554,370],
    'thessaloniki':[571,400],'athens':[580,440],'istanbul':[686,418],
    'valletta':[396,470],'tirana':[512,382],'podgorica':[504,360],
    // Eastern Europe
    'kyiv':[714,231],'kiev':[714,231],'lviv':[598,244],
    'minsk':[663,162],'riga':[601,102],'tallinn':[612,53],
    'vilnius':[621,132],'kaunas':[596,128],'odessa':[720,319],
    'chisinau':[668,300],'luxembourg':[285,248],'reykjavik':[0,60],
    // Common anglicizations
    'new york':[0,0],'nyc':[0,0],'jfk':[0,0],
  };

  const STORAGE_KEY = 'europe-trip-state-v1';
  const WX_CACHE_KEY = 'europe-trip-weather-v1';       // cached daily weather per (coord, stay)

  /* ---- cross-device cloud sync (keyless, no-signup JSON stores) ----
     No single free bin service is reliable across every network, so we
     don't bet on one. `createSync` tries the backends in SYNC_ORDER and
     keeps whichever answers; the chosen backend is recorded as a
     one-letter prefix on the sync code (e.g. "e-AbC123") so link / push
     / pull all hit the same store. Each `create` returns the code id;
     `get` returns the stored JSON text; `put` overwrites it. */
  const SYNC_KEY  = 'europe-trip-sync-v1';            // local record of the link {id, rev, lastSyncedAt}
  const APP_TAG   = 'europe-trip-planner';            // payload marker so we only adopt our own data
  const SYNC_POLL_MS  = 20000;                        // how often to pull while the tab is visible
  const CLOUD_PUSH_DEBOUNCE_MS = 900;                 // coalesce rapid edits into one upload

  // Public web build — the installable PWA served by GitHub Pages from the
  // planner/ folder on the main branch (redeployed on every merge). The Sync
  // modal links here, carrying "?sync=<code>" so the opened page auto-connects
  // to this device's endpoint — two-way sync. Using the Pages origin (rather
  // than the old rawgithack standalone) means "open on another device" lands on
  // the exact app you published, and two tabs on the same host even share edits
  // live via localStorage.
  const HOSTED_WEB_URL = 'https://kalaha2112.github.io/Planner/';

  // ---- Supabase-backed shared sync ----
  // No sign-in: every device that opens the app reads/writes one shared row and
  // auto-syncs it in realtime. Anyone with the link shares these trips (intended
  // for you + people you trust). The publishable key is a client key by design.
  const SUPABASE_URL = 'https://hqvojhssaciyncztkgzz.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_HonO-3xvVOuYt33iHgOPDQ_aEMxrz7n';
  const CLOUD_TABLE = 'shared_state';
  const SHARED_ID = 'kalaha-planner-shared';   // the single shared row every device syncs

  // Startup page headline (editable in place; persisted in meta.introText and synced)
  const DEFAULT_INTRO_TEXT = 'The best trips begin as a scribble on a map — a handful of cities, a stack of nights, and the quiet thrill of not quite knowing yet.';

  const _notFound = () => { const e = new Error('No data found for that code.'); e.code = 404; return e; };
  const _httpErr  = (name, status) => new Error('“' + name + '” error (HTTP ' + status + ').');

  // IMPORTANT: every request below is a CORS "simple request" — no custom
  // headers (the body goes as the default text/plain), so the browser never
  // sends a preflight. Preflight that the bin server fails to answer is what
  // surfaced as "could not reach". Each store still keeps the raw JSON we send.
  const SYNC_BACKENDS = {
    // textdb.dev — keyless, no signup, and crucially NO server-side "create":
    // the key is chosen client-side and the first write creates it. That sidesteps
    // the create-endpoint failures (HTTP 401/500) that broke the other stores.
    t: {
      name: 'textdb',
      base: 'https://textdb.dev/api/data',
      _strat: null,   // index of the write format confirmed to persist (memoized)
      newKey() {
        return 'wb-' + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 8);
      },
      async create(body) {
        const id = this.newKey();
        await this.put(id, body);
        return id;
      },
      _url(id) { return this.base + '/' + encodeURIComponent(id); },
      // candidate write formats — we don't know which textdb wants, so try each
      _writes(id, body) {
        const url = this._url(id);
        return [
          { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'value=' + encodeURIComponent(body) },
          { method: 'POST', body },                  // raw text/plain POST
          { method: 'PUT', body },                   // raw text/plain PUT
          { method: 'PUT', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'value=' + encodeURIComponent(body) },
        ].map((opt) => ({ url, opt }));
      },
      // recover our payload OBJECT from whatever textdb hands back: raw JSON,
      // a {"value":"…"} wrapper, a JSON-string, or a "value=<urlencoded>" body.
      _extract(txt) {
        if (!txt) return null;
        const ours = (o) => (o && o.app === APP_TAG && o.data) ? o : null;
        const tryP = (s) => { try { return JSON.parse(s); } catch (e) { return null; } };
        let o = tryP(txt);
        let r = ours(o); if (r) return r;
        if (o && typeof o === 'object' && typeof o.value === 'string') { r = ours(tryP(o.value)); if (r) return r; }
        if (typeof o === 'string') { r = ours(tryP(o)); if (r) return r; }
        // form-style "value=<urlencoded>" (or a bare urlencoded body)
        let s = txt; const eq = s.indexOf('value='); if (eq !== -1) s = s.slice(eq + 6);
        try { r = ours(tryP(decodeURIComponent(s.replace(/\+/g, ' ')))); if (r) return r; } catch (e) {}
        // last resort: slice from our object's start and parse the balanced braces
        const i = txt.indexOf('{"app":"' + APP_TAG + '"');
        if (i !== -1) {
          let depth = 0;
          for (let k = i; k < txt.length; k++) {
            if (txt[k] === '{') depth++;
            else if (txt[k] === '}') { depth--; if (depth === 0) { r = ours(tryP(txt.slice(i, k + 1))); if (r) return r; break; } }
          }
        }
        return null;
      },
      async _readObj(id) {
        const res = await fetch(this._url(id), { method: 'GET', cache: 'no-store' });
        if (!res.ok) return { status: res.status, obj: null };
        return { status: res.status, obj: this._extract(await res.text()) };
      },
      async get(id) {
        const r = await this._readObj(id);
        if (r.status && r.status !== 200) throw _httpErr(this.name, r.status);
        if (!r.obj) throw _notFound();
        return JSON.stringify(r.obj);   // hand cloudGet clean JSON
      },
      async put(id, body) {
        let wantRev; try { wantRev = JSON.parse(body).rev; } catch (e) {}
        const writes = this._writes(id, body);
        const order = this._strat != null
          ? [this._strat, ...writes.map((_, i) => i).filter((i) => i !== this._strat)]
          : writes.map((_, i) => i);
        let lastStatus = 0;
        for (const i of order) {
          let res;
          try { res = await fetch(writes[i].url, writes[i].opt); } catch (e) { throw e; }  // unreachable → bubble up
          lastStatus = res.status;
          if (res.ok) {
            const r = await this._readObj(id);   // confirm OUR write (matching rev) actually round-trips
            if (r.obj && (wantRev == null || r.obj.rev === wantRev)) { this._strat = i; return; }
          }
        }
        throw new Error('textdb: endpoint did not store the data (HTTP ' + (lastStatus || 0) + ').');
      },
    },
    // jsonblob — keyless, no signup, id returned in the X-jsonblob header.
    j: {
      name: 'jsonblob',
      base: 'https://jsonblob.com/api/jsonBlob',
      async create(body) {
        const res = await fetch(this.base, { method: 'POST', body });
        if (!res.ok) throw _httpErr(this.name, res.status);
        const id = res.headers.get('X-jsonblob') || ((res.headers.get('Location') || '').split('/').filter(Boolean).pop());
        if (!id) throw new Error('jsonblob: code header not readable (CORS).');
        return id;
      },
      async get(id) {
        const res = await fetch(this.base + '/' + encodeURIComponent(id), { method: 'GET', cache: 'no-store' });
        if (res.status === 404) throw _notFound();
        if (!res.ok) throw _httpErr(this.name, res.status);
        return res.text();
      },
      async put(id, body) {
        const res = await fetch(this.base + '/' + encodeURIComponent(id), { method: 'PUT', body });
        if (res.status === 404) throw _notFound();
        if (!res.ok) throw _httpErr(this.name, res.status);
      },
    },
    // ExtendsClass JSON Storage — keyless, no signup, id returned in the body.
    e: {
      name: 'extendsclass',
      base: 'https://json.extendsclass.com/bin',
      async create(body) {
        const res = await fetch(this.base, { method: 'POST', body });
        if (!res.ok) throw _httpErr(this.name, res.status);
        const j = await res.json().catch(() => null); const id = j && (j.id || j.Id);
        if (!id) throw new Error('extendsclass: no code in response.');
        return id;
      },
      async get(id) {
        const res = await fetch(this.base + '/' + encodeURIComponent(id), { method: 'GET', cache: 'no-store' });
        if (res.status === 404) throw _notFound();
        if (!res.ok) throw _httpErr(this.name, res.status);
        return res.text();
      },
      async put(id, body) {
        const res = await fetch(this.base + '/' + encodeURIComponent(id), { method: 'PUT', body });
        if (res.status === 404) throw _notFound();
        if (!res.ok) throw _httpErr(this.name, res.status);
      },
    },
    // kvdb.io — confirmed reachable on the user's network; bucket id in body.
    // create makes a public bucket, then seeds it via put().
    k: {
      name: 'kvdb',
      base: 'https://kvdb.io',
      async create(body) {
        const res = await fetch(this.base + '/', { method: 'POST', body: '{}' });
        if (!res.ok) throw _httpErr(this.name, res.status);
        const id = (await res.text()).trim();
        if (!id) throw new Error('kvdb: empty code.');
        await this.put(id, body);
        return id;
      },
      async get(id) {
        const res = await fetch(this.base + '/' + encodeURIComponent(id) + '/state', { method: 'GET', cache: 'no-store' });
        if (res.status === 404) throw _notFound();
        if (!res.ok) throw _httpErr(this.name, res.status);
        return res.text();
      },
      async put(id, body) {
        const res = await fetch(this.base + '/' + encodeURIComponent(id) + '/state', { method: 'PUT', body });
        if (res.status === 404) throw _notFound();
        if (!res.ok) throw _httpErr(this.name, res.status);
      },
    },
  };
  const SYNC_ORDER = ['t', 'j', 'e', 'k'];   // create tries these in order

  const DEFAULT_STATE = {
    meta: {
      travelers: 2, milesBalance: 150000, milesPerTicket: 25000,
      depart: '2026-09-14', returnDate: '2026-09-30', title: '',
      budget: { lodgingPerNight: 140, foodPerDayPP: 55, activitiesPerDayPP: 35, cityPassOverride: null, otherTotal: 0 },
      todos: [
        { text: 'Check passport valid 6+ months', done: false },
        { text: 'Book flights', done: false },
        { text: 'Travel insurance', done: false },
        { text: 'Notify bank of travel', done: false },
        { text: 'Reserve accommodation', done: false },
        { text: 'Get euros / local cash', done: false },
        { text: 'Download offline maps', done: false }
      ]
    },
    stickerStock: [],
    placedStickers: [],
    active: 'centralEurope',
    tripOrder: ['centralEurope', 'scandinavia'],
    trips: {
      centralEurope: {
        label: 'Central Europe',
        depart: '2026-09-14', returnDate: '2026-09-30', travelers: 2,
        originLabel: 'New York (JFK)',
        outboundLeg: { mode: 'flight', duration: '8h20m nonstop · Delta', cost: 70 },
        stops: [
          { city: 'Prague', nights: 4, note: '', leg: { mode: 'train', duration: '~6h direct', cost: 35 } },
          { city: 'Kraków', nights: 4, note: '', leg: { mode: 'overnight-train', duration: '~9h sleeper · saves a hotel night', cost: 80 } },
          { city: 'Budapest', nights: 4, note: '', leg: { mode: 'flight', duration: '~2h15m AF · same ticket as flight home', cost: 0, miles: 0 } },
          { city: 'Paris', nights: 2, note: '', leg: { mode: 'flight', duration: '9h45m nonstop · Air France', cost: 0, miles: 0 } }
        ],
        homeLabel: 'Vancouver (YVR)',
        packing: {
          documents: [{ text: 'Passports', done: false }, { text: 'Rail tickets (offline PDF)', done: false }],
          tech: [{ text: 'Phone + charger', done: false }, { text: 'EU plug adapter', done: false }],
          clothes: [{ text: 'Layers — Sep evenings get cold', done: false }]
        }
      },
      scandinavia: {
        label: 'Scandinavia',
        depart: '2026-09-14', returnDate: '2026-09-30', travelers: 2,
        originLabel: 'New York (JFK)',
        outboundLeg: { mode: 'flight', duration: '8h nonstop · Delta', cost: 70 },
        stops: [
          { city: 'Copenhagen', nights: 2, note: '', leg: { mode: 'flight', duration: '~1h30m · SAS / Norwegian', cost: 0 } },
          { city: 'Bergen', nights: 3, note: '', leg: { mode: 'train', duration: '~6h45m · Bergen Railway (scenic)', cost: 90 } },
          { city: 'Oslo', nights: 4, note: '', leg: { mode: 'train', duration: '~5-6h', cost: 80 } },
          { city: 'Stockholm', nights: 4, note: '', leg: { mode: 'flight', duration: '~2h40m AF · same ticket as flight home', cost: 0, miles: 0 } },
          { city: 'Paris', nights: 2, note: '', leg: { mode: 'flight', duration: '9h45m nonstop · Air France', cost: 0, miles: 0 } }
        ],
        homeLabel: 'Vancouver (YVR)'
      }
    }
  };

  const MODE_OPTIONS = [
    { value: 'flight', label: 'Flight' },
    { value: 'train', label: 'Train' },
    { value: 'bus', label: 'Bus' }
  ];
  const MODE_HEX = { 'flight': '#91040C', 'train': '#5E8475', 'bus': '#4A7098', 'overnight-train': '#46604F', 'flying-blue': '#C8901F' };

  // Packing-sheet art: the user's line-art carry-on in two states (closed
  // roller / open clamshell), converted to alpha masks so the app tints the
  // strokes with the theme ink (light & dark) via CSS mask-image. Embedded
  // as data URIs so the single-file standalone build works offline.
  const PK_ART_CLOSED = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyOTUiIGhlaWdodD0iNTI2IiB2aWV3Qm94PSIwIDAgMjk1IDUyNiIgdmVyc2lvbj0iMS4xIj48cGF0aCBkPSJNIDEyOC43MTggMTAuNTU1IEMgMTI0LjE0OSAxNS4xMjMsIDEyNi42MTMgMjQsIDEzMi40NTAgMjQgQyAxMzMuNzE4IDI0LCAxMzUuMjM0IDI0LjU3NywgMTM1LjgyMCAyNS4yODMgQyAxMzcuMjQ2IDI3LjAwMSwgMTM3LjY1OSAxMTEuNzQxLCAxMzYuMjQ5IDExMy4xNTEgQyAxMzUuNjAxIDExMy43OTksIDEzMy45MDIgMTEzLjgxMywgMTMxLjM3NyAxMTMuMTkzIEMgMTI5LjI0NSAxMTIuNjY4LCAxMjQuMTI1IDExMS42ODksIDEyMCAxMTEuMDE3IEMgMTE1Ljg3NSAxMTAuMzQ1LCAxMTEuMTk1IDEwOS4zOTEsIDEwOS42MDEgMTA4Ljg5NyBDIDEwMS4zMzEgMTA2LjMzOCwgOTUuMzUwIDEwNy42MDUsIDgwLjc5MyAxMTUgQyA3My4yMTQgMTE4Ljg1MCwgNjYuMTA1IDEyMiwgNjQuOTk2IDEyMiBDIDYyLjI0NCAxMjIsIDU0LjIxOCAxMjUuODY3LCA1Mi43MjAgMTI3LjkxNSBDIDUxLjA1NCAxMzAuMTkxLCA0Ni45NTUgMTMyLjkxNSwgMzcuNTAwIDEzOC4wMzAgQyAxOS4zNDQgMTQ3Ljg1MiwgMTMuNTUzIDE1MS41NzEsIDExLjg1NCAxNTQuNTAwIEMgMTAuMjYwIDE1Ny4yNDgsIDEwLjAyNSAxNjQuODEwLCA5LjA1OSAyNDQuNTAwIEMgOC40NzkgMjkyLjM1MCwgOC4wMDMgMzU3LjQ0MCwgOC4wMDIgMzg5LjE0NSBDIDggNDQ2Ljc5MCwgOCA0NDYuNzkwLCAxMC41NDQgNDQ5LjE0NSBDIDE0LjkxMyA0NTMuMTg5LCAxNi4wMDQgNDU2LjMyNSwgMTUuOTUyIDQ2NC43MDAgQyAxNS45MTkgNDcwLjA4MSwgMTUuMzc2IDQ3My40NjcsIDE0LjIwMiA0NzUuNjE5IEMgMTMuMjY2IDQ3Ny4zMzQsIDExLjQ4OCA0ODAuNTc5LCAxMC4yNTAgNDgyLjgyOSBDIDAuOTUyIDQ5OS43MzcsIDIwLjU3NyA1MTcuOTg1LCAzNi40MTYgNTA3LjE2MCBDIDQyLjc0OSA1MDIuODMyLCA0NC4wNDMgNTAwLjI5NywgNDUuNDg0IDQ4OS4zOTMgQyA0Ni4yMDMgNDgzLjk1MiwgNDcuNTgxIDQ3NS41MTIsIDQ4LjU0NSA0NzAuNjM3IEMgNTAuNjY0IDQ1OS45MzIsIDQ4LjM0MSA0NjAuMTA4LCA4MCA0NjguMjU0IEMgODcuNDI1IDQ3MC4xNjQsIDk0LjYyNSA0NzEuOTc3LCA5NiA0NzIuMjgyIEMgOTcuMzc1IDQ3Mi41ODgsIDEwMy45MDAgNDc0LjI2OCwgMTEwLjUwMCA0NzYuMDE3IEMgMTE3LjEwMCA0NzcuNzY2LCAxMjQuMDc1IDQ3OS41NjIsIDEyNiA0ODAuMDA4IEMgMTI3LjkyNSA0ODAuNDU0LCAxMzQgNDgxLjk2NywgMTM5LjUwMCA0ODMuMzcxIEMgMTU5Ljg4MiA0ODguNTc0LCAxNzQuNDQ2IDQ5MiwgMTc2LjE4MiA0OTIgQyAxNzcuMTY1IDQ5MiwgMTc5LjM3MCA0OTMuMjUyLCAxODEuMDgzIDQ5NC43ODIgQyAxODUuNjA0IDQ5OC44MjMsIDE4Ni4yNjEgNTA1LjQ5NywgMTgyLjY3MCA1MTAuOTIzIEMgMTgxLjI0NSA1MTMuMDc2LCAxNzkuNzg2IDUxNi4xMTIsIDE3OS40MjcgNTE3LjY2OSBDIDE3OC44OTAgNTIwLjAwNSwgMTc5LjMwOSA1MTkuNjgxLCAxODEuODI1IDUxNS44MTQgQyAxODUuNjAwIDUxMC4wMTQsIDE4OC43MzUgNTA3Ljg5NywgMTk0LjUxNCA1MDcuMjQ1IEMgMTk5LjgwMiA1MDYuNjQ5LCAyMDAuNzU0IDUwOC44MDUsIDE5Ni40NDkgNTExLjYyNSBDIDE5My43NzQgNTEzLjM3OCwgMTkwLjQ0MiA1MTguNzc1LCAxOTEuNDI2IDUxOS43NjAgQyAxOTEuNzQyIDUyMC4wNzUsIDE5MiA1MTkuODA4LCAxOTIgNTE5LjE2NyBDIDE5MiA1MTguNTI1LCAxOTIuOTAwIDUxOCwgMTk0IDUxOCBDIDE5NS4xMDAgNTE4LCAxOTYgNTE4LjQ1MCwgMTk2IDUxOSBDIDE5NiA1MjIuNzY2LCAyMDIuMTU3IDUxMy44MTcsIDIwNC44NzQgNTA2LjEwMSBDIDIwNi43OTcgNTAwLjY0MCwgMjA4LjYyMCA0OTgsIDIxMC40NjcgNDk4IEMgMjExLjE0MCA0OTgsIDIxMi41MjQgNDk3LjA3OSwgMjEzLjU0MyA0OTUuOTUzIEMgMjE0LjY5NyA0OTQuNjc3LCAyMTYuMzU4IDQ5NC4wMTcsIDIxNy45NDggNDk0LjIwMyBDIDIyMC4zODYgNDk0LjQ4NywgMjIwLjQ4NSA0OTQuNzQ1LCAyMjAuMTYzIDUwMCBDIDIxOS45NzcgNTAzLjAyNSwgMjE4LjU2MyA1MDguNzYyLCAyMTcuMDIwIDUxMi43NTAgQyAyMTUuNDc3IDUxNi43MzcsIDIxNC41NjUgNTIwLCAyMTQuOTk1IDUyMCBDIDIxNi40MDYgNTIwLCAyMjEuOTI2IDUwNC42MTcsIDIyMi41MzAgNDk5IEMgMjIyLjg1NSA0OTUuOTc1LCAyMjMuMzA4IDQ5Mi41NjMsIDIyMy41MzcgNDkxLjQxOCBDIDIyNC4wOTUgNDg4LjYzMiwgMjQzLjM1MyA0NzUuNzY3LCAyNDYuMzMwIDQ3Ni4xOTEgQyAyNDguMjA1IDQ3Ni40NTgsIDI0OC40NjYgNDc3LjA1OSwgMjQ4LjI0NyA0ODAuNjIwIEMgMjQ3LjUzNiA0OTIuMTczLCAyNTkuNjc0IDUwMy44NDEsIDI2OS41NjQgNTAxLjExMCBDIDI4Mi40MTUgNDk3LjU2MiwgMjg1LjY0MCA0ODkuMjIyLCAyODYuNjE5IDQ1NyBDIDI4Ni43NjEgNDUyLjMyNSwgMjg3LjM3MyA0NDYuMDI1LCAyODcuOTc4IDQ0MyBDIDI4OS43ODMgNDMzLjk3OSwgMjg4LjIwMiAxNDkuMzkxLCAyODYuMzI2IDE0NS43MDcgQyAyODQuNDI3IDE0MS45NzcsIDI4Mi4zNzcgMTQxLjI4NCwgMjYwLjUwMCAxMzYuOTc4IEMgMjU3Ljc1MCAxMzYuNDM3LCAyNTEuOTAwIDEzNS4yNTksIDI0Ny41MDAgMTM0LjM2MCBDIDIzOC44NDkgMTMyLjU5MywgMjMxLjk2NyAxMzEuMzU5LCAyMjUuMjEzIDEzMC4zNjQgQyAyMjIuMjk0IDEyOS45MzMsIDIyMC41NjQgMTI5LjA1NywgMjE5Ljc5MCAxMjcuNjE2IEMgMjE4Ljc4NSAxMjUuNzQ1LCAyMTcuMzI3IDgxLjg5NCwgMjE3LjA3MCA0NS43NTAgQyAyMTcgMzYsIDIxNyAzNiwgMjE5Ljk0NCAzNiBDIDIyNi45NDQgMzYsIDIzMC43ODUgMjcuNTkzLCAyMjYuMDc1IDIyLjU4MCBDIDIyNC4yMDMgMjAuNTg3LCAyMjIuMjEzIDIwLjAxOCwgMjEzLjY3MiAxOS4wMzMgQyAxOTQuNDUxIDE2LjgxNywgMTkzLjA4OCAxNi40MjgsIDE4OS4wMDYgMTIuMDA3IEMgMTg1LjQ4NSA4LjE5MiwgMTg1LjAyMSA4LCAxNzkuMzQyIDggQyAxNzQuNjM0IDgsIDE3Mi44OTQgOC40NTAsIDE3MS4wODYgMTAuMTM1IEMgMTY4LjY1NCAxMi40MDAsIDE2OC42MjcgMTIuNDAxLCAxNDYuNTAwIDEwLjU4OSBDIDEzOS45MDUgMTAuMDQ5LCAxNDkuNjkxIDExLjc3MywgMTY2IDE0LjAyNCBDIDE3MC42NzUgMTQuNjcwLCAxNzYuOTc1IDE1LjU0OSwgMTgwIDE1Ljk3OSBDIDE4My4wMjUgMTYuNDA5LCAxOTEuOTQ0IDE3LjYwMiwgMTk5LjgxOSAxOC42MzAgQyAyMTMuNzA3IDIwLjQ0MiwgMjE0LjEyNSAyMC41NjYsIDIxMy43MDggMjIuNzQ5IEMgMjEzLjM1OCAyNC41NzYsIDIxMy43MjggMjUsIDIxNS42NzAgMjUgQyAyMTYuOTg2IDI1LCAyMTguMzIyIDI0LjMyNSwgMjE4LjYzOCAyMy41MDAgQyAyMTkuNjIyIDIwLjkzNywgMjI0LjUxOSAyMS42NDksIDIyNS44MzkgMjQuNTQ3IEMgMjI3LjUwNSAyOC4yMDIsIDIyNy4yNzggMzAuNDM4LCAyMjUuMDM2IDMyLjQ2OCBDIDIyMi40OTQgMzQuNzY4LCAyMTkuNjg0IDM0LjU0MywgMTgyIDI5LjAyOCBDIDE3OC40MjUgMjguNTA1LCAxNjYuOTUwIDI3LjEwMywgMTU2LjUwMCAyNS45MTQgQyAxMzIuOTc1IDIzLjIzNSwgMTI5Ljg2MCAyMi40MjksIDEyOC41NTEgMTguNjgyIEMgMTI2Ljg4MyAxMy45MDgsIDEyOS40OTIgMTAuNjI4LCAxMzUuNTMyIDkuOTA3IEMgMTM4LjI2NCA5LjU4MSwgMTM5Ljc2OSA5LjI0NCwgMTM4Ljg3NSA5LjE1NyBDIDEzNy45ODEgOS4wNzEsIDEzNS45NDIgOC43MzgsIDEzNC4zNDMgOC40MTkgQyAxMzIuMDUzIDcuOTYxLCAxMzAuODU4IDguNDE0LCAxMjguNzE4IDEwLjU1NSBNIDE3MyAxMS44NjQgQyAxNzMgMTMuMzI0LCAxNzQuMDA3IDEzLjg2NiwgMTc3LjY0MCAxNC4zNjQgQyAxODQuODE3IDE1LjM0OCwgMTg4IDE1LjE0NCwgMTg4IDEzLjcwMCBDIDE4OCAxMS4wNjYsIDE4NS40OTQgMTAsIDE3OS4zMDAgMTAgQyAxNzMuODIwIDEwLCAxNzMgMTAuMjQzLCAxNzMgMTEuODY0IE0gMTM5LjY2NyAyNi42NjcgQyAxMzguNDgyIDI3Ljg1MSwgMTM4LjkzNCA0MS41MzQsIDE0MC4yMDAgNDIuODAwIEMgMTQxLjc1MCA0NC4zNTAsIDE0Ny4yNTAgNDQuMzUwLCAxNDguODAwIDQyLjgwMCBDIDE0OS40OTEgNDIuMTA5LCAxNTAgMzguODAwLCAxNTAgMzUgQyAxNTAgMzEuMjAwLCAxNDkuNDkxIDI3Ljg5MSwgMTQ4LjgwMCAyNy4yMDAgQyAxNDcuNTMwIDI1LjkzMCwgMTQwLjc5NiAyNS41MzcsIDEzOS42NjcgMjYuNjY3IE0gMTUyIDcxLjc4OSBDIDE1MiAxMTMuNzUyLCAxNTIuMTE5IDExNi44MTEsIDE1My44OTIgMTIwLjI4OSBDIDE1NS43NDggMTIzLjkzMCwgMTU1Ljc0OCAxMjQsIDE1My44OTIgMTI0IEMgMTUxLjU1NSAxMjQsIDE1MS4zMDcgMTI3LjUyMCwgMTUzLjU4MiAxMjguMzkzIEMgMTU2LjkzOCAxMjkuNjgxLCAxNTguMjQyIDEyOS4wOTksIDE1Ny42MTMgMTI2LjU5MyBDIDE1Ny4wMDggMTI0LjE4NiwgMTU3LjAwOCAxMjQuMTg2LCAxNjAuNzU0IDEyNS45NjIgQyAxNjcuMDU5IDEyOC45NTEsIDE3My45OTEgMTMwLjA4MywgMTg3LjAyMSAxMzAuMjQ4IEMgMjA1LjQzNSAxMzAuNDgzLCAyMDQgMTMyLjU5OSwgMjA0LjAwMSAxMDUuMjE1IEMgMjA0LjAwMSA3Ni4yMjQsIDIwMi4wOTcgMzQuNzEzLCAyMDAuNzI2IDMzLjg0NiBDIDIwMC4xNTggMzMuNDg2LCAxOTcuMTc0IDMyLjkwMSwgMTk0LjA5NiAzMi41NDYgQyAxOTEuMDE4IDMyLjE5MSwgMTgzLjc3NSAzMS4yMDcsIDE3OCAzMC4zNTkgQyAxNjQuMzkxIDI4LjM2MCwgMTU0LjgxOCAyNy4wNzQsIDE1My4yNTAgMjcuMDMzIEMgMTUyLjI2OCAyNy4wMDcsIDE1MiAzNi42MDcsIDE1MiA3MS43ODkgTSAyMDUuMjUwIDM1LjEyMyBDIDIwMy45MzEgMzYuNDcxLCAyMDMuNzMzIDQyLjgyOCwgMjA0Ljg4MiA0Ni45NDUgQyAyMDUuNzA0IDQ5Ljg5MiwgMjExLjMxNCA1MS44MTQsIDIxMy41ODYgNDkuOTI4IEMgMjE1LjE0MCA0OC42MzksIDIxNS41NjMgMzguNDM1LCAyMTQuMTU0IDM2LjIxNSBDIDIxMi45NjUgMzQuMzQyLCAyMDYuNzYwIDMzLjU4MSwgMjA1LjI1MCAzNS4xMjMgTSAxMzkuNjY3IDQ2LjY2NyBDIDEzOC4yNTkgNDguMDc0LCAxMzguOTA5IDg3LCAxNDAuMzM5IDg3IEMgMTQyLjQ1OSA4NywgMTQ0IDkxLjU5MSwgMTQ0IDk3LjkwOCBDIDE0NCAxMDMuNTcxLCAxNDMuOTM1IDEwMy43MTAsIDE0MS41MDAgMTAzLjI0NSBDIDEzOSAxMDIuNzY3LCAxMzkgMTAyLjc2NywgMTM5IDExMS42OTIgQyAxMzkgMTIyLjU2MCwgMTM5LjkyOCAxMjQuMjgwLCAxNDUuNTQwIDEyMy44MjMgQyAxNDkuNTAwIDEyMy41MDAsIDE0OS41MDAgMTIzLjUwMCwgMTQ5Ljc2MiA4Ni4zMzQgQyAxNDkuOTkzIDUzLjUzMCwgMTQ5LjgzOCA0OC45ODEsIDE0OC40NDEgNDcuNTg0IEMgMTQ2Ljg2NyA0Ni4wMTAsIDE0MC45NDIgNDUuMzkxLCAxMzkuNjY3IDQ2LjY2NyBNIDIwNS43MjIgNTQuMjgxIEMgMjA1LjQ1MiA1NC45ODYsIDIwNS41ODggNzMuMzAwLCAyMDYuMDI1IDk0Ljk3OSBDIDIwNi45MDUgMTM4LjY3MSwgMjA2LjY4OSAxMzcuNDYyLCAyMTMuNTAwIDEzNi43OTQgQyAyMTYuNDgxIDEzNi41MDIsIDIxNi41MDIgMTM2LjQ1NywgMjE2Ljc5OSAxMjkuNjA5IEMgMjE3LjAwOSAxMjQuNzU3LCAyMTYuNDkxIDEyMC43ODYsIDIxNS4wNDkgMTE2LjE5MSBDIDIxMi41MzYgMTA4LjE4MywgMjEyLjM1MiAxMDAuNzgzLCAyMTQuNjIwIDk4LjkwMSBDIDIxNi43NjcgOTcuMTE5LCAyMTYuMjgxIDU3LjI0OCwgMjE0LjA4MCA1NC41OTYgQyAyMTIuNDk4IDUyLjY5MSwgMjA2LjQyMSA1Mi40NjIsIDIwNS43MjIgNTQuMjgxIE0gOTQuNTAwIDExMS4zNDggQyA5Mi4zMDAgMTExLjk4MiwgODcuMjE2IDExNC4zMDAsIDgzLjIwMSAxMTYuNTAwIEMgNzcuMDI0IDExOS44ODYsIDc1Ljk2NSAxMjAuODQ0LCA3Ni4zMTEgMTIyLjczOSBDIDc2LjY5MSAxMjQuODMwLCA3Ni40NTYgMTI0LjkzNywgNzIuNzcxIDEyNC4zNDcgQyA2OS4wNTUgMTIzLjc1MywgNjguODQzIDEyMy44NTQsIDY5LjE2MiAxMjYuMDY3IEMgNjkuMzc4IDEyNy41NjksIDcwLjQwMyAxMjguNjY4LCA3MiAxMjkuMTA5IEMgNzUuODIxIDEzMC4xNjYsIDcyLjA0MSAxMzAuMDgwLCA2Ny41MDAgMTI5LjAwNyBDIDY1LjMwMCAxMjguNDg3LCA2Mi43MTIgMTI4LjMwMywgNjEuNzUwIDEyOC41OTggQyA1OS45NzUgMTI5LjE0MiwgNTkuMzYzIDEzMS40ODgsIDYwLjc2OSAxMzIuMzU3IEMgNjIuNTYyIDEzMy40NjUsIDIzNy4xNDcgMTY4LCAyNDAuOTU3IDE2OCBDIDI0Ny4xMDYgMTY4LCAyNDYuMTc1IDE2NS4wMzIsIDIzOS40OTcgMTYzLjM0MSBDIDIzNi43NDggMTYyLjY0NiwgMjM1Ljg1MCAxNjIuMjc4LCAyMzcuNTAwIDE2Mi41MjUgQyAyNTAuMTAwIDE2NC40MDUsIDI1MyAxNjQuMzUwLCAyNTMgMTYyLjIzMyBDIDI1MyAxNjAuNTk1LCAyNTIuMTM0IDE2MC4wMjYsIDI0OC43NTAgMTU5LjQ0MCBDIDI0Ni40MTIgMTU5LjAzNiwgMjQ1LjA3NSAxNTguNTA0LCAyNDUuNzc5IDE1OC4yNTkgQyAyNDYuNDgyIDE1OC4wMTUsIDI0OS4xOTQgMTU4LjMyNywgMjUxLjgwNCAxNTguOTUzIEMgMjU3LjUwOCAxNjAuMzIxLCAyNTkuMjQ4IDE1OS43MTQsIDI3MC4zMDkgMTUyLjUwMCBDIDI3OS40MDIgMTQ2LjU2OSwgMjgwLjYyMiAxNDMuNDg0LCAyNzQuMjUwIDE0Mi41MjggQyAyNjkuNjIyIDE0MS44MzUsIDI0OS43MDAgMTM4LjM3NiwgMjQxLjIzOCAxMzYuNzk3IEMgMjM1LjM2MCAxMzUuNzAwLCAyMzQuODA3IDEzNS43NjMsIDIzMi4yMzggMTM3LjgxOSBDIDIyNC4wNjYgMTQ0LjM2MSwgMjI0LjQyMiAxNDQuMzIwLCAyMDcuNTAwIDE0MC42MjkgQyAyMDAuOTAwIDEzOS4xODksIDE5MS45MDAgMTM3LjM1NywgMTg3LjUwMCAxMzYuNTU2IEMgMTgzLjEwMCAxMzUuNzU2LCAxNzEuODUwIDEzMy41NDAsIDE2Mi41MDAgMTMxLjYzMiBDIDE1My4xNTAgMTI5LjcyNCwgMTQyLjEyNSAxMjcuNDkxLCAxMzggMTI2LjY3MCBDIDEzMy4zMzMgMTI1Ljc0MCwgMTMxLjcyMCAxMjUuMTQzLCAxMzMuNzMxIDEyNS4wODggQyAxMzcuNDQzIDEyNC45ODcsIDEzOC45OTIgMTIxLjcyMywgMTM3LjA1MCAxMTguMDkzIEMgMTM0LjgyMiAxMTMuOTMwLCAxMjMgMTE2LjQwMywgMTIzIDEyMS4wMzIgQyAxMjMgMTIyLjAyMywgMTIzLjQ2MSAxMjMuMDYyLCAxMjQuMDI1IDEyMy4zNDIgQyAxMjQuNTg5IDEyMy42MjEsIDEyNC41MDggMTIzLjc0NCwgMTIzLjg0NiAxMjMuNjE1IEMgMTIxLjM3OSAxMjMuMTM1LCAxMjAuMzc3IDExOS45NzQsIDEyMi4yNTAgMTE4LjU4MSBDIDEyNS42MDYgMTE2LjA4NSwgMTI0LjMxOSAxMTQuMzM2LCAxMTguMjUwIDExMy4xNDQgQyAxMDAuOTg2IDEwOS43NTIsIDEwMC4yMzggMTA5LjY5NiwgOTQuNTAwIDExMS4zNDggTSA5NiAxMjkgQyA5Ny4zNzUgMTI5LjQ0MCwgOTkuNjI1IDEyOS44MDEsIDEwMSAxMjkuODAxIEMgMTAzLjUwMCAxMjkuODAxLCAxMDMuNTAwIDEyOS44MDEsIDEwMSAxMjkgQyA5OS42MjUgMTI4LjU2MCwgOTcuMzc1IDEyOC4xOTksIDk2IDEyOC4xOTkgQyA5My41MDAgMTI4LjE5OSwgOTMuNTAwIDEyOC4xOTksIDk2IDEyOSBNIDc4IDEzMSBDIDc5LjM3NSAxMzEuNDQwLCA4MS40MDAgMTMxLjgwMSwgODIuNTAwIDEzMS44MDEgQyA4NC4wODQgMTMxLjgwMSwgODMuOTgwIDEzMS42MzQsIDgyIDEzMSBDIDgwLjYyNSAxMzAuNTYwLCA3OC42MDAgMTMwLjE5OSwgNzcuNTAwIDEzMC4xOTkgQyA3NS45MTYgMTMwLjE5OSwgNzYuMDIwIDEzMC4zNjYsIDc4IDEzMSBNIDEwNiAxMzEgQyAxMDcuMzc1IDEzMS40NDAsIDEwOS42MjUgMTMxLjc5MiwgMTExIDEzMS43ODIgQyAxMTMuMjQ2IDEzMS43NjUsIDExMy4xOTUgMTMxLjY4NiwgMTEwLjUwMCAxMzEgQyAxMDYuMjcwIDEyOS45MjQsIDEwMi42MzkgMTI5LjkyNCwgMTA2IDEzMSBNIDE5MC42ODkgMTMxLjczMiBDIDE4Ny44MTAgMTMyLjAzMSwgMTg2Ljk1NSAxMzIuNTMwLCAxODcuMTk0IDEzMy43NzAgQyAxODcuNDI2IDEzNC45NzIsIDE4OS42MDcgMTM1Ljc4NywgMTk1LjM0NyAxMzYuODE0IEMgMjA0LjA0OCAxMzguMzcxLCAyMDUuNjcwIDEzNy44MDQsIDIwNC42MDggMTMzLjU3MyBDIDIwMy45MjQgMTMwLjg0OCwgMjAxLjg0NSAxMzAuNTczLCAxOTAuNjg5IDEzMS43MzIgTSA4Ny41MDAgMTMzIEMgOTEuNzMwIDEzNC4wNzYsIDk1LjM2MSAxMzQuMDc2LCA5MiAxMzMgQyA5MC42MjUgMTMyLjU2MCwgODguMzc1IDEzMi4yMDgsIDg3IDEzMi4yMTggQyA4NC43NTQgMTMyLjIzNSwgODQuODA1IDEzMi4zMTQsIDg3LjUwMCAxMzMgTSAxMTQuMDgzIDEzMi40MDggQyAxMTQuODY2IDEzMy4xNzUsIDI0MS4xNzUgMTU4LjExMywgMjQyLjcyMyAxNTcuODA2IEMgMjQzLjU3MSAxNTcuNjM4LCAyMjguNzk0IDE1NC40MDksIDIwOS44ODMgMTUwLjYzMiBDIDE5MC45NzIgMTQ2Ljg1NCwgMTczLjcwMCAxNDMuMzQzLCAxNzEuNTAwIDE0Mi44MjkgQyAxNTQuODU0IDEzOC45NDAsIDExMi45OTcgMTMxLjM0MywgMTE0LjA4MyAxMzIuNDA4IE0gNDUuOTYwIDEzNi45NzMgQyA0MS44NTcgMTM5LjE1OCwgMzMuNDM4IDE0My40NTQsIDI3LjI1MCAxNDYuNTE5IEMgMTMuMjIwIDE1My40NjksIDEyLjU5MyAxNTUuMDk4LCAyMy4yNTAgMTU2LjkxNiBDIDI3LjIzOCAxNTcuNTk2LCAzMi4zMDAgMTU4LjUzMiwgMzQuNTAwIDE1OC45OTUgQyAzNi43MDAgMTU5LjQ1OSwgNDEuMjAwIDE2MC4zODMsIDQ0LjUwMCAxNjEuMDUxIEMgNDcuODAwIDE2MS43MTgsIDU0LjMyNSAxNjMuMTA3LCA1OSAxNjQuMTM4IEMgNjMuNjc1IDE2NS4xNjgsIDY5Ljc1MCAxNjYuNDgxLCA3Mi41MDAgMTY3LjA1NSBDIDc1LjI1MCAxNjcuNjI4LCA3OS4zMDAgMTY4LjUwOSwgODEuNTAwIDE2OS4wMTIgQyA4My43MDAgMTY5LjUxNSwgOTIuMDI1IDE3MS4zMTAsIDEwMCAxNzMgQyAxMDcuOTc1IDE3NC42OTAsIDExNi41MjUgMTc2LjUzOCwgMTE5IDE3Ny4xMDcgQyAxMzAuOTkzIDE3OS44NjEsIDE0My4xOTAgMTgyLjQ3MCwgMTU1LjgzMyAxODQuOTg1IEMgMTYxLjE1MCAxODYuMDQzLCAxNzIuMDI1IDE4OC4zMzgsIDE4MCAxOTAuMDg2IEMgMTg3Ljk3NSAxOTEuODMzLCAxOTcuNDU1IDE5My40NzUsIDIwMS4wNjYgMTkzLjczNCBDIDIwNy42MzEgMTk0LjIwNSwgMjA3LjYzMSAxOTQuMjA1LCAyMTYuMDY2IDE4OC4zNDQgQyAyMjAuNzA1IDE4NS4xMjEsIDIyNy41MzYgMTgwLjQ2MiwgMjMxLjI0NiAxNzcuOTkyIEMgMjM2LjEzOCAxNzQuNzM0LCAyMzcuOTI0IDE3Mi45NjgsIDIzNy43NDYgMTcxLjU2MiBDIDIzNy40NzUgMTY5LjQyNiwgMjM4LjMxMyAxNjkuNjE0LCAxNjQgMTU0Ljk1OSBDIDE0My45MjUgMTUwLjk5OSwgMTIwLjMwMCAxNDYuMjEwLCAxMTEuNTAwIDE0NC4zMTUgQyAxMDIuNzAwIDE0Mi40MjAsIDkzLjQ3NSAxNDAuNTAwLCA5MSAxNDAuMDQ5IEMgODguNTI1IDEzOS41OTgsIDc5LjYxNSAxMzcuODI4LCA3MS4xOTkgMTM2LjExNSBDIDUyLjQ4MyAxMzIuMzA1LCA1NC44NzkgMTMyLjIyMywgNDUuOTYwIDEzNi45NzMgTSAyMTguODQ3IDEzNi40MzYgQyAyMTcuNTI3IDEzOS4zMzMsIDIxOC4zMjAgMTQyLCAyMjAuNTAxIDE0MiBDIDIyMy44OTggMTQyLCAyMjkgMTM5LjA5MywgMjI5IDEzNy4xNTggQyAyMjkgMTMzLjIwMiwgMjIwLjU5MyAxMzIuNjA0LCAyMTguODQ3IDEzNi40MzYgTSAyNTUgMTQ0LjM2MiBDIDI1NSAxNDUuMDIyLCAyNjYuMTAyIDE0OC4yMzEsIDI2Ni42MTQgMTQ3LjcxOSBDIDI2Ni44MzMgMTQ3LjUwMCwgMjY1LjA5NyAxNDYuNzcwLCAyNjIuNzU2IDE0Ni4wOTYgQyAyNjAuNDE1IDE0NS40MjMsIDI1Ny43MTIgMTQ0LjY0NiwgMjU2Ljc1MCAxNDQuMzY5IEMgMjU1Ljc4NyAxNDQuMDkyLCAyNTUgMTQ0LjA4OSwgMjU1IDE0NC4zNjIgTSAyNjguNzUwIDE1Ni43MTEgTCAyNTcgMTY0LjM4MSAyNTcgMjA5LjgwNyBDIDI1NyAyNTUuMjMzLCAyNTcgMjU1LjIzMywgMjU5LjI1MCAyNTQuNjA5IEMgMjYwLjQ4OCAyNTQuMjY1LCAyNjIuNDkwIDI1My43MjAsIDI2My43MDAgMjUzLjM5NiBDIDI2Ny4yNTEgMjUyLjQ0NywgMjcxIDI1Ni45MjgsIDI3MSAyNjIuMTIxIEMgMjcxIDI2Ny4yOTMsIDI3MC4xOTQgMjY2Ljc0OSwgMjY5LjE5NiAyNjAuOTAzIEMgMjY4LjU5NyAyNTcuMzk0LCAyNjcuOTI0IDI1Ni4zNDUsIDI2NS43ODUgMjU1LjU5MyBDIDI2MS45MDggMjU0LjIzMCwgMjYwIDI1Ni4yMjYsIDI2MCAyNjEuNjQ3IEMgMjYwIDI2Ni4zNTgsIDI2Mi41NzcgMjY4LjQ5MCwgMjY3LjQzNCAyNjcuNzk1IEMgMjY5LjcxMiAyNjcuNDcwLCAyNzEuNzQxIDI3My4xMTAsIDI3NS45NTkgMjkxLjUwMCBDIDI4MC4xNzAgMzA5Ljg1NSwgMjgwLjE3MiAzMzguNDA2LCAyNzUuOTY0IDM1MS43MDkgQyAyNzQuNzM1IDM1NS41OTYsIDI3NCAzNjAuNzM4LCAyNzQgMzY1LjQ1OSBDIDI3NCAzNzYuMDkxLCAyNjkuMjI0IDM4MC4yNDEsIDI2Mi44OTAgMzc1LjExMiBDIDI1OS4wMjggMzcxLjk4NSwgMjU4Ljg3MiAzNTUuNjkxLCAyNjIuNTg0IDM0MyBDIDI2NS41MzkgMzMyLjg5NSwgMjY2LjI3NCAzMjAuNjM3LCAyNjQuODM0IDMwNS41MDAgQyAyNjQuMTY4IDI5OC41MDAsIDI2NC4xNjggMjk4LjUwMCwgMjY1LjU4NSAzMDQgQyAyNjcuOTE1IDMxMy4wNDEsIDI2Ny41NTggMzI2LjcyOSwgMjY0LjU2MCAzNDMuMzI2IEMgMjYxLjY0MSAzNTkuNDc5LCAyNjEuODk1IDM2MS4zODgsIDI2Ni44ODIgMzYwLjgwMSBDIDI3My42NTIgMzYwLjAwNCwgMjc2LjM4NyAzNDguMTUxLCAyNzYuMzAwIDMyMCBDIDI3Ni4yMDcgMjkwLjQ2MCwgMjcxLjUwOSAyNjkuOTc5LCAyNjQuNjQxIDI2OS4xNzggQyAyNjAuMTkzIDI2OC42NTksIDI1OC42ODIgMjcwLjY2NSwgMjU5LjMzOSAyNzYuMjE3IEMgMjU5Ljg0NSAyODAuNDg4LCAyNTkuNjk3IDI4MSwgMjU3Ljk1MyAyODEgQyAyNTYuMDMwIDI4MSwgMjU2IDI4Mi4zOTgsIDI1NiAzNzIgQyAyNTYgNDc0LjM2NiwgMjU1LjI3MyA0NjUuODE2LCAyNjMuNTE4IDQ2MC4zNzAgQyAyNjkuMDk0IDQ1Ni42ODcsIDI2OS45OTcgNDU1LjI1NCwgMjcwLjAyMSA0NTAuMDU5IEMgMjcwLjA2MiA0NDEuMTc1LCAyNzUuOTg1IDQyNC43MzcsIDI4MS41MTIgNDE4LjE2OCBDIDI4Mi45NDYgNDE2LjQ2MywgMjg0LjQ1OSA0MTMuODE2LCAyODQuODczIDQxMi4yODQgQyAyODYuMTgxIDQwNy40NDcsIDI4Ni4zNjcgMTUzLjU1NCwgMjg1LjA2NCAxNTEuMTIwIEMgMjgzLjI5OCAxNDcuODIxLCAyODEuMzQxIDE0OC40OTEsIDI2OC43NTAgMTU2LjcxMSBNIDE5NyAxNTUgQyAxOTguMzc1IDE1NS40NDAsIDIwMC42MjUgMTU1Ljc5MiwgMjAyIDE1NS43ODIgQyAyMDQuMjQ2IDE1NS43NjUsIDIwNC4xOTUgMTU1LjY4NiwgMjAxLjUwMCAxNTUgQyAxOTcuMjcwIDE1My45MjQsIDE5My42MzkgMTUzLjkyNCwgMTk3IDE1NSBNIDExLjc1NCAyNzUuMjUwIEMgMTEuNjE4IDMzOS43MzgsIDExLjUwNiAzOTYuMDQ2LCAxMS41MDQgNDAwLjM3OSBDIDExLjUwMCA0MDcuNzAzLCAxMS42NzYgNDA4LjM2OSwgMTQgNDA5LjgxOSBDIDE4LjQxMSA0MTIuNTczLCAyNy4zNDUgNDIyLjI3NywgMzIuODAyIDQzMC4yNDAgQyAzNy42MzAgNDM3LjI4NiwgNDQgNDUwLjUwNywgNDQgNDUzLjQ4MyBDIDQ0IDQ1Ni40NDgsIDQ5LjcxNyA0NTguMzQ5LCA4NC41MDAgNDY2Ljk0OSBDIDEwNC44NTAgNDcxLjk4MCwgMTMwLjQ2NSA0NzguMzI1LCAxNDEuNDIzIDQ4MS4wNDggQyAxNTIuMzgwIDQ4My43NzIsIDE2Mi4zNzYgNDg2LCAxNjMuNjM2IDQ4NiBDIDE2NS4zMDQgNDg2LCAxNjYuOTg2IDQ4NC40MzgsIDE2OS44MzIgNDgwLjI1MCBDIDE3Ny45NjAgNDY4LjI4OCwgMTg4LjY2NSA0NTguMzkzLCAxOTguNzMzIDQ1My41MzYgTCAyMDMuNjg0IDQ1MS4xNDggMjA0LjI3MCA0MDcuOTQxIEMgMjA1LjA0MiAzNTEuMTY2LCAyMDMuOTUyIDE5OC4wODksIDIwMi43NzIgMTk3LjM1OSBDIDIwMS44NjcgMTk2LjgwMCwgMTkzLjExMSAxOTQuODEyLCAxNzUgMTkxLjA1NSBDIDE2OS43NzUgMTg5Ljk3MSwgMTYxLjIyNSAxODguMTU5LCAxNTYgMTg3LjAyOCBDIDE1MC43NzUgMTg1Ljg5NywgMTM5Ljc1MCAxODMuNTgyLCAxMzEuNTAwIDE4MS44ODMgQyAxMjMuMjUwIDE4MC4xODQsIDExMi42NzUgMTc3Ljk4NiwgMTA4IDE3Ni45OTggQyA4OS4wOTMgMTczLjAwMSwgNzguMzcxIDE3MC43NTQsIDc2IDE3MC4yOTEgQyA1Mi41NTEgMTY1LjcxNywgMzcuNjY5IDE2Mi41ODQsIDI5LjYyMiAxNjAuNTI2IEMgMjQuMTg5IDE1OS4xMzcsIDE4LjAwMSAxNTgsIDE1Ljg3MiAxNTggTCAxMiAxNTggMTEuNzU0IDI3NS4yNTAgTSAyMTcgMTU5IEMgMjE4LjM3NSAxNTkuNDQwLCAyMjAuNjI1IDE1OS43OTIsIDIyMiAxNTkuNzgyIEMgMjI0LjI0NiAxNTkuNzY1LCAyMjQuMTk1IDE1OS42ODYsIDIyMS41MDAgMTU5IEMgMjE3LjI3MCAxNTcuOTI0LCAyMTMuNjM5IDE1Ny45MjQsIDIxNyAxNTkgTSAyMjcgMTYxIEMgMjI4LjM3NSAxNjEuNDQwLCAyMzAuNjI1IDE2MS43OTIsIDIzMiAxNjEuNzgyIEMgMjM0LjI0NiAxNjEuNzY1LCAyMzQuMTk1IDE2MS42ODYsIDIzMS41MDAgMTYxIEMgMjI3LjI3MCAxNTkuOTI0LCAyMjMuNjM5IDE1OS45MjQsIDIyNyAxNjEgTSAyNDkuNTk4IDE3MC4xODUgQyAyNDkuMzM3IDE3MS40NTgsIDI0OC44NTQgMjM4Ljk4NywgMjQ4LjUyMyAzMjAuMjUwIEMgMjQ3LjkyMiA0NjgsIDI0Ny45MjIgNDY4LCAyNTAuMzkzIDQ2OCBDIDI1MS44OTYgNDY4LCAyNTMuMDU1IDQ2Ny4zMTQsIDI1My4zNTAgNDY2LjI1MCBDIDI1My42MTcgNDY1LjI4NywgMjUzLjk4NSAzOTcuOTAwLCAyNTQuMTY4IDMxNi41MDAgQyAyNTQuNTAwIDE2OC41MDAsIDI1NC41MDAgMTY4LjUwMCwgMjUyLjI4NSAxNjguMTg1IEMgMjUwLjY0NCAxNjcuOTUyLCAyNDkuOTQ4IDE2OC40NzAsIDI0OS41OTggMTcwLjE4NSBNIDE3NS41MDAgMTcyLjYyNSBDIDE3My43MDIgMTc0LjE1NSwgMTczLjMzNCAxNzQuNzYzLCAxNzQuNTgyIDE3NC4xNDMgQyAxNzYuNDE1IDE3My4yMzMsIDE3OS44NTMgMTY5Ljk0MSwgMTc4Ljg3MiAxNzAuMDM2IEMgMTc4LjY2OCAxNzAuMDU2LCAxNzcuMTUwIDE3MS4yMjEsIDE3NS41MDAgMTcyLjYyNSBNIDI0Mi45MDggMTczLjYxMSBDIDI0MS43MTQgMTc1LjA1MCwgMjQxLjQ2MSAxOTcuODM2LCAyNDEuMjQ2IDMyMy42NTQgQyAyNDAuOTkxIDQ3MiwgMjQwLjk5MSA0NzIsIDI0My4zNjMgNDcyIEMgMjQ1LjczNSA0NzIsIDI0NS43MzUgNDcyLCAyNDYuMzQzIDQ1MS43NTAgQyAyNDYuNjc4IDQ0MC42MTMsIDI0Ny4wNzUgMzczLjIzMSwgMjQ3LjIyNiAzMDIuMDE0IEMgMjQ3LjQ3NSAxODQuMjQ5LCAyNDcuMzU2IDE3Mi41MDAsIDI0NS45MDggMTcyLjIyMSBDIDI0NS4wMzIgMTcyLjA1MiwgMjQzLjY4MiAxNzIuNjc4LCAyNDIuOTA4IDE3My42MTEgTSAyMzAuNTAwIDE4MC43MjEgQyAyMTcuMDY2IDE4OS40NTQsIDIxMi45MzIgMTkyLCAyMTIuMTg2IDE5MiBDIDIxMS43MjYgMTkyLCAyMTAuMjU4IDE5My4xNjEsIDIwOC45MjQgMTk0LjU4MSBDIDIwNi41MDAgMTk3LjE2MSwgMjA2LjUwMCAxOTcuMTYxLCAyMDYuODMyIDMyMy4zMzEgQyAyMDcuMDE0IDM5Mi43MjQsIDIwNy4zODQgNDUwLjQ0OCwgMjA3LjY1NCA0NTEuNjA3IEMgMjA3LjkyNCA0NTIuNzY1LCAyMDkuODI3IDQ1NC42NTksIDIxMS44ODQgNDU1LjgxNSBDIDIyMC41NDYgNDYwLjY4MywgMjI3Ljg1MCA0NjkuNTIzLCAyMzAuNDIyIDQ3OC4yNTAgQyAyMzEuMDk3IDQ4MC41NDMsIDIzNS4yMTcgNDgwLjUyMywgMjM3LjMwNSA0NzguMjE1IEMgMjM4Ljc3MCA0NzYuNTk3LCAyMzguOTg2IDQ2Mi41NTQsIDIzOS42MjMgMzI3LjIxNSBDIDI0MC4zMjYgMTc4LCAyNDAuMzI2IDE3OCwgMjM3LjQxMyAxNzguMDYwIEMgMjM1LjgxMSAxNzguMDkzLCAyMzIuNzAwIDE3OS4yOTAsIDIzMC41MDAgMTgwLjcyMSBNIDMzIDI5OS4zMzMgQyAzMyAzNjYuOTY0LCAzMy4zNzcgNDE3LCAzMy44ODUgNDE3IEMgMzQuNzMyIDQxNywgMzQuMjQ1IDE4Mi45NzUsIDMzLjM5NyAxODIuMDgzIEMgMzMuMTc4IDE4MS44NTQsIDMzIDIzNC42MTcsIDMzIDI5OS4zMzMgTSAxOTYuNTAwIDE4OC41NzAgQyAxOTkuMjUwIDE4OS4zMzUsIDIwMi4xNzUgMTg5LjkyMywgMjAzIDE4OS44NzYgQyAyMDUuMzc2IDE4OS43NDAsIDE5Ni43ODAgMTg3LjE1MiwgMTk0IDE4Ny4xNjYgQyAxOTIuNTA0IDE4Ny4xNzQsIDE5My41MDggMTg3LjczOCwgMTk2LjUwMCAxODguNTcwIE0gNTcuMTIzIDMwMS4yNTAgQyA1Ny4xOTAgMzYyLjk4OCwgNTcuNTMxIDQxOC4yMjUsIDU3Ljg4MCA0MjQgQyA1OC44OTUgNDQwLjc5MSwgNTkuODAzIDMyNi4zMjQsIDU5LjIyNyAyNTQuMjMyIEMgNTguOTQwIDIxOC4zNTUsIDU4LjMyMiAxODksIDU3Ljg1MyAxODkgQyA1Ny4zODQgMTg5LCA1Ny4wNTUgMjM5LjUxMiwgNTcuMTIzIDMwMS4yNTAgTSA4MiAzMDguODQ2IEMgODIgNDIwLjk4NSwgODIuMzUzIDQ0MywgODQuMTUwIDQ0MyBDIDg0LjYxNyA0NDMsIDg1IDQyMS41MTIsIDg0Ljk5OSAzOTUuMjUwIEMgODQuOTk4IDMxMy4zNjgsIDgzLjcxMCAxOTMsIDgyLjgzNSAxOTMgQyA4Mi4zNzYgMTkzLCA4MiAyNDUuMTMxLCA4MiAzMDguODQ2IE0gMTA4LjE3MCAyNDUgQyAxMDguMDU2IDI2OC45MjUsIDEwNy42ODcgMzA5LjY1MCwgMTA3LjM1MCAzMzUuNTAwIEMgMTA2LjY5MyAzODUuOTEzLCAxMDcuNjY4IDQ0OCwgMTA5LjExNSA0NDggQyAxMTAuMTMxIDQ0OCwgMTEwLjA4MyAyODIuMjkxLCAxMDkuMDU0IDIzMy41MDAgQyAxMDguMzc5IDIwMS41MDAsIDEwOC4zNzkgMjAxLjUwMCwgMTA4LjE3MCAyNDUgTSAxMzMuNzU0IDI0NS41MDAgQyAxMzIuMzc1IDMyMy4wODQsIDEzMS44MzAgNDUyLjQxNCwgMTMyLjg3NiA0NTMuOTQ4IEMgMTMzLjY3MyA0NTUuMTE4LCAxMzMuOTc2IDQ1NC45MjYsIDEzNC40NTUgNDUyLjk0OCBDIDEzNC43ODIgNDUxLjYwMiwgMTM0LjkyNSAzOTQuOTI1LCAxMzQuNzc0IDMyNyBDIDEzNC41NTQgMjI3Ljg1OCwgMTM0LjM1MyAyMTEuNzg0LCAxMzMuNzU0IDI0NS41MDAgTSAxNTcuNjY0IDI0Ny43NTAgQyAxNTYuNzE4IDMwNC42MjQsIDE1Ni44NDQgNDU5LCAxNTcuODM2IDQ1OSBDIDE1OC4yOTYgNDU5LCAxNTguOTcxIDQzMi42MDEsIDE1OS4zMzYgNDAwLjMzNSBDIDE2MC4yNjQgMzE4LjM0MSwgMTYwLjE2NCAyMDgsIDE1OS4xNjMgMjA4IEMgMTU4LjcwMiAyMDgsIDE1OC4wMjggMjI1Ljg4NywgMTU3LjY2NCAyNDcuNzUwIE0gMTgyLjY2NyAyNzguNTgyIEMgMTgxLjczNCAzNjguMjI3LCAxODEuODM1IDQ1MiwgMTgyLjg3NSA0NTIgQyAxODMuODkyIDQ1MiwgMTg1LjAwMiAyMTkuNDY5LCAxODMuOTk5IDIxNi41ODIgQyAxODMuNjMyIDIxNS41MjcsIDE4My4wMzIgMjQzLjQyNywgMTgyLjY2NyAyNzguNTgyIE0gMjYwLjE0MSAyODQgQyAyNjAuMTQxIDI4NC44MjUsIDI2MC41MjcgMjg2LjQwMCwgMjYxIDI4Ny41MDAgQyAyNjEuNTQyIDI4OC43NjEsIDI2MS44NTkgMjg4Ljk0NSwgMjYxLjg1OSAyODggQyAyNjEuODU5IDI4Ny4xNzUsIDI2MS40NzMgMjg1LjYwMCwgMjYxIDI4NC41MDAgQyAyNjAuNDU4IDI4My4yMzksIDI2MC4xNDEgMjgzLjA1NSwgMjYwLjE0MSAyODQgTSAyNjIuMTk5IDI5MS41MDAgQyAyNjIuMTk5IDI5Mi42MDAsIDI2Mi41NjAgMjk0LjYyNSwgMjYzIDI5NiBDIDI2My42MzQgMjk3Ljk4MCwgMjYzLjgwMSAyOTguMDg0LCAyNjMuODAxIDI5Ni41MDAgQyAyNjMuODAxIDI5NS40MDAsIDI2My40NDAgMjkzLjM3NSwgMjYzIDI5MiBDIDI2Mi4zNjYgMjkwLjAyMCwgMjYyLjE5OSAyODkuOTE2LCAyNjIuMTk5IDI5MS41MDAgTSAyNjIuNzE0IDM2My42MTkgQyAyNjEuNDA3IDM2NC45MjYsIDI2MS45NTQgMzcyLjcxNywgMjYzLjQ0MCAzNzMuOTUwIEMgMjY0LjIzMSAzNzQuNjA3LCAyNjYuMTQ0IDM3NC45OTksIDI2Ny42OTAgMzc0LjgyMiBDIDI3MC4zOTAgMzc0LjUxMywgMjcwLjUwMCAzNzQuMjg2LCAyNzAuNTAwIDM2OSBDIDI3MC41MDAgMzYzLjUwMCwgMjcwLjUwMCAzNjMuNTAwLCAyNjYuOTY0IDM2My4yMDIgQyAyNjUuMDIwIDM2My4wMzksIDI2My4xMDcgMzYzLjIyNiwgMjYyLjcxNCAzNjMuNjE5IE0gMTEuNjQzIDQyOS4wNDAgQyAxMC45NDkgNDQ2LjcwMCwgMTEuNDM5IDQ0OS45NzUsIDE0Ljc4NSA0NTAuMDI2IEMgMTUuNzI4IDQ1MC4wNDEsIDIxIDQ1MS4xNTksIDI2LjUwMCA0NTIuNTEyIEMgNDAuNjU3IDQ1NS45OTQsIDQxLjQwNCA0NTUuOTI2LCA0MC42NTIgNDUxLjIyOCBDIDM4Ljg0NCA0MzkuOTIwLCAxOS45MzAgNDEyLCAxNC4wNzcgNDEyIEMgMTIuNDg2IDQxMiwgMTIuMjQ3IDQxMy42NzcsIDExLjY0MyA0MjkuMDQwIE0gMjgwLjI2OSA0MjEuNzUwIEMgMjc0LjU4MiA0MzAuMTI4LCAyNjkuNDc3IDQ1MywgMjczLjI5NCA0NTMgQyAyNzQuMDA2IDQ1MywgMjc3LjA0NCA0NTEuNTMxLCAyODAuMDQ0IDQ0OS43MzUgQyAyODUuNTAwIDQ0Ni40NzAsIDI4NS41MDAgNDQ2LjQ3MCwgMjg1LjY0MyA0MzYuOTg1IEMgMjg1LjkwMyA0MTkuNzA3LCAyODQuNDUxIDQxNS41OTAsIDI4MC4yNjkgNDIxLjc1MCBNIDE2LjAxNSA0MzUuMDU5IEMgMTUuOTk4IDQ0My40NzMsIDE2LjkzNSA0NDUuNDE1LCAyMS41MDAgNDQ2LjQyMiBDIDI0LjUwMCA0NDcuMDg0LCAyNC41MDAgNDQ3LjA4NCwgMjEuMjUwIDQ0NS4wNTcgQyAxOC4xNDggNDQzLjEyMiwgMTcuOTk5IDQ0Mi43NDMsIDE3Ljk4NSA0MzYuNzY1IEMgMTcuOTc2IDQzMy4zMTksIDE3LjUzMyA0MjkuODI1LCAxNyA0MjkgQyAxNi4zMjcgNDI3Ljk1OCwgMTYuMDI2IDQyOS44MDksIDE2LjAxNSA0MzUuMDU5IE0gMjc1Ljg4OCA0NTUuNTI0IEMgMjcxLjU5NCA0NTguNzQ4LCAyNzEuMjMxIDQ1OS4zNzgsIDI3MC42MDggNDY0LjY3NyBDIDI3MC4yNDAgNDY3LjgwNywgMjY5LjQ3OCA0NzAuOTI0LCAyNjguOTE1IDQ3MS42MDMgQyAyNjguMzUxIDQ3Mi4yODIsIDI2OC4wMjcgNDc1LjIzNywgMjY4LjE5NSA0NzguMTY5IEMgMjY4LjQ4MiA0ODMuMTg1LCAyNjguNjY2IDQ4My41MTksIDI3MS4zMTUgNDgzLjgyMyBDIDI3NC45NzggNDg0LjI0MywgMjc4LjU0MSA0ODEuODQxLCAyODAuMzA3IDQ3Ny43NjEgQyAyODMuNTM2IDQ3MC4zMDMsIDI4My45MTMgNDY4Ljc4NiwgMjg0LjU3OSA0NjAuNTgyIEMgMjg1LjI3NSA0NTIuMDAyLCAyODUuMjc0IDQ1MiwgMjgyLjg4OCA0NTIuMDMwIEMgMjgxLjU3NCA0NTIuMDQ3LCAyNzguNDI1IDQ1My42MTksIDI3NS44ODggNDU1LjUyNCBNIDE4LjI3MyA0NjMuNTg4IEwgMTguMjczIDQ3My4xNzYgMjUuMzg2IDQ3Mi40NzQgQyAzNC4zNDEgNDcxLjU5MiwgMzQgNDcxLjg2MSwgMzQgNDY1LjY2MyBDIDM0IDQ1OS4wNDYsIDMyLjI0NSA0NTYuNTUxLCAyNi41ODkgNDU1LjEyNyBDIDE4LjA2MCA0NTIuOTc5LCAxOC4yNzMgNDUyLjc2MywgMTguMjczIDQ2My41ODggTSAxOTUuMzE2IDQ1Ny4wNzIgQyAxODUuMzMxIDQ2Mi4wMTUsIDE2OS41MzEgNDgwLjIwMCwgMTcwLjIwNSA0ODUuOTc0IEMgMTcwLjQ0NSA0ODguMDI4LCAxNzEuMjQ4IDQ4OC42NjIsIDE3NC41MDAgNDg5LjM2NCBDIDE3Ni43MDAgNDg5Ljg0MCwgMTc5LjQwMCA0OTAuNTkzLCAxODAuNTAwIDQ5MS4wMzkgQyAxODEuNjAwIDQ5MS40ODUsIDE4My42MjUgNDkyLjA4NiwgMTg1IDQ5Mi4zNzYgQyAxODYuMzc1IDQ5Mi42NjUsIDE5MS4wMTIgNDkzLjY5OCwgMTk1LjMwNSA0OTQuNjcxIEMgMjA1LjI1MyA0OTYuOTI2LCAyMDUuMzA5IDQ5Ni44NTYsIDIwNC41NjQgNDgzLjA5NCBDIDIwNC4yNTQgNDc3LjM3MSwgMjA0IDQ2OC43MDksIDIwNCA0NjMuODQ0IEMgMjA0IDQ1My42NzIsIDIwMy4yOTYgNDUzLjEyMywgMTk1LjMxNiA0NTcuMDcyIE0gMjA3LjUwMyA0NzMuOTE1IEMgMjA3LjEwNCA0ODMuNzY4LCAyMDcuMDc5IDQ5Mi4zMTgsIDIwNy40NDcgNDkyLjkxNSBDIDIwOC45NDggNDk1LjM0MywgMjE1LjUyMCA0OTIuNzIzLCAyMjUuMjUwIDQ4NS44MTYgQyAyMjkuOTg4IDQ4Mi40NTMsIDIyOC43NzMgNDc2LjI5OCwgMjIxLjMxNyA0NjUuODkxIEMgMjE4LjEyNSA0NjEuNDM1LCAyMTEuNTI4IDQ1NiwgMjA5LjMxMSA0NTYgQyAyMDguNjA0IDQ1NiwgMjA3Ljk3OSA0NjIuMTkwLCAyMDcuNTAzIDQ3My45MTUgTSAzNS43NjcgNDU4LjU2NiBDIDM1LjQ1NiA0NTguODc3LCAzNS40MzkgNDYxLjc0OSwgMzUuNzI5IDQ2NC45NDggQyAzNi4yMTUgNDcwLjMxMSwgMzUuOTMwIDQ3MS40MDUsIDMyLjA3NyA0NzguOTY4IEMgMjYuNzcxIDQ4OS4zODEsIDI2LjQ5OSA0OTYuMjcxLCAzMS4zNzIgNDk2LjgyOCBDIDM2LjI4OCA0OTcuMzkwLCA0Mi4wMjUgNDkwLjY1NCwgNDQuODUzIDQ4MSBDIDQ2LjQ1NyA0NzUuNTIyLCA0OC4zNTUgNDYyLjAyMSwgNDcuNjIzIDQ2MS4yODkgQyA0NS43MDkgNDU5LjM3NiwgMzYuOTY2IDQ1Ny4zNjcsIDM1Ljc2NyA0NTguNTY2IE0gOTUuNjI4IDQ2My45NTEgQyA5Ni43MTIgNDY0LjkzOSwgMTMwLjk4NSA0NzMuMzQ5LCAxMzEuNTY1IDQ3Mi43NjkgQyAxMzEuNzk3IDQ3Mi41MzYsIDEyNS4xMjcgNDcwLjYyNiwgMTE2Ljc0MyA0NjguNTIzIEMgOTYuMjQzIDQ2My4zODEsIDk0LjYxNiA0NjMuMDI4LCA5NS42MjggNDYzLjk1MSBNIDI1Ni4yMjUgNDY4LjYwMyBDIDI1MC4wODUgNDczLjQ0MiwgMjQ4LjI1MiA0ODIuNjU0LCAyNTEuOTc3IDQ4OS45NTYgQyAyNTQuNjExIDQ5NS4xMTgsIDI1OC4zNzIgNDk3LjYwNSwgMjY0Ljg4OCA0OTguNDkyIEMgMjcwLjE3NSA0OTkuMjEyLCAyNzAuMjY4IDQ5OS4xODEsIDI2OS44MjMgNDk2Ljg1NCBDIDI2OS40MDQgNDk0LjY2MywgMjY5LjY0NyA0OTQuNTA5LCAyNzMuMDI1IDQ5NC44MzEgQyAyNzguMDI4IDQ5NS4zMDgsIDI4MS43MzkgNDkxLjk4NiwgMjgyLjYxMCA0ODYuMjUwIEMgMjgzLjIwNSA0ODIuMzMyLCAyODMuMDgyIDQ4MiwgMjgxLjAzNiA0ODIgQyAyNzkuODE0IDQ4MiwgMjc3LjY3MSA0ODIuOTAwLCAyNzYuMjczIDQ4NCBDIDI3MS4zMDcgNDg3LjkwNywgMjY2IDQ4NC41ODUsIDI2NiA0NzcuNTY5IEMgMjY2IDQ3NC4yNTksIDI2NS43NDEgNDczLjgzNCwgMjY0IDQ3NC4yOTAgQyAyNjEuNjQzIDQ3NC45MDYsIDI2MS41MjUgNDc0LjIxMywgMjYzLjUzMiA0NzEuNTU5IEMgMjY3LjY3NyA0NjYuMDc4LCAyNjIuMjI2IDQ2My44NzQsIDI1Ni4yMjUgNDY4LjYwMyBNIDE1LjcyMiA0NzguMTM1IEMgMTEuNTQ2IDQ4MS4yNTEsIDEwIDQ4NS4xMDgsIDEwIDQ5Mi40MTYgQyAxMCA0OTguMjc3LCAxMC4zMTEgNDk5LjI4NSwgMTMuMTA0IDUwMi40NjUgQyAxNy4yMzcgNTA3LjE3MywgMjAuNDk5IDUwNy4zMTcsIDE5LjU1NyA1MDIuNzUwIEMgMTcuMzc0IDQ5Mi4xNjEsIDE4LjA0OCA0ODcuNDQ2LCAyMi42MjQgNDgxLjMxNyBDIDIzLjkzMSA0NzkuNTY2LCAyNSA0NzcuNjUzLCAyNSA0NzcuMDY3IEMgMjUgNDc1LjIzMSwgMTguNjMyIDQ3NS45NjUsIDE1LjcyMiA0NzguMTM1IE0gMjYxLjEzNiA0NzkuNzgyIEMgMjYwLjk3NSA0ODQuODM1LCAyNjIuODM4IDQ4OS43MTcsIDI2NS45ODggNDkyLjUwMCBDIDI2OC4wNjggNDk0LjMzOCwgMjY4LjA0MSA0OTQuMTg4LCAyNjUuNjUyIDQ5MC42NDkgQyAyNjQuMjIzIDQ4OC41MzIsIDI2Mi44MjUgNDg1LjM4MiwgMjYyLjU0NiA0ODMuNjQ5IEMgMjYyLjI2NyA0ODEuOTE3LCAyNjEuODY3IDQ3OS4zNzUsIDI2MS42NTYgNDc4IEMgMjYxLjQ0MSA0NzYuNjAyLCAyNjEuMjEyIDQ3Ny4zODcsIDI2MS4xMzYgNDc5Ljc4MiBNIDIyLjg4MiA0ODIuNjkyIEMgMTYuNDc2IDQ5My4wNTYsIDIxLjQ1MCA1MDguMDEzLCAzMS4yOTcgNTA3Ljk5NiBDIDM0Ljc3NSA1MDcuOTkwLCAzOS41MDggNTA0LjU1NywgNDEuMzMwIDUwMC43MTcgQyA0NC41ODYgNDkzLjg1NSwgNDIuMzk1IDQ5MS44MDcsIDM2LjgxOCA0OTYuNTAwIEMgMjkuNzM0IDUwMi40NjEsIDIyLjk1NCA0OTUuNDE0LCAyNi45OTIgNDg2LjI4NiBDIDI5LjUwMCA0ODAuNjE2LCAyOS41MjAgNDc5LCAyNy4wODIgNDc5IEMgMjUuOTQ5IDQ3OSwgMjQuMjI5IDQ4MC41MTIsIDIyLjg4MiA0ODIuNjkyIE0gMjE2LjMwNiA0ODQuNTYwIEMgMjE0LjI2MyA0ODYuNDI1LCAyMTQuMDY2IDQ4Ni44NDcsIDIxNS41ODIgNDg2LjExNSBDIDIxNy42NTcgNDg1LjExMywgMjIwLjc1NiA0ODIsIDIxOS42NzggNDgyIEMgMjE5LjM2NyA0ODIsIDIxNy44NDkgNDgzLjE1MiwgMjE2LjMwNiA0ODQuNTYwIE0gMTgwIDQ4Ni4zNTEgQyAxODEuMzc1IDQ4Ny4xMzAsIDE4NC41MjUgNDg4LjA0MywgMTg3IDQ4OC4zODAgQyAxOTEuNTAwIDQ4OC45OTMsIDE5MS41MDAgNDg4Ljk5MywgMTg3Ljk2NCA0ODcuNjIzIEMgMTg2LjAxOSA0ODYuODY5LCAxODIuODY5IDQ4NS45NTYsIDE4MC45NjQgNDg1LjU5NCBDIDE3Ny41NjUgNDg0Ljk0NywgMTc3LjU0NyA0ODQuOTYxLCAxODAgNDg2LjM1MSBNIDE4Ni4wMTQgNDk4Ljc1MCBDIDE4Ni4wNDcgNTA1LjU0NSwgMTg2LjQwNyA1MDUuODExLCAxOTUuMzQwIDUwNS42NDkgQyAyMDMuNDUwIDUwNS41MDEsIDIwMy41MDIgNTA1LjQ4MywgMjAzLjgxNiA1MDIuNzU4IEMgMjA0LjA1OCA1MDAuNjU0LCAyMDMuNTkzIDQ5OS44MTIsIDIwMS44MTYgNDk5LjEzNiBDIDE5MC44NTUgNDk0Ljk2OCwgMTg1Ljk5NCA0OTQuODQ5LCAxODYuMDE0IDQ5OC43NTAiIHN0cm9rZT0ibm9uZSIgZmlsbD0iIzAwMDAwMCIgZmlsbC1ydWxlPSJldmVub2RkIi8+PC9zdmc+';
  const PK_ART_OPEN = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OTMiIGhlaWdodD0iNDg5IiB2aWV3Qm94PSIwIDAgNDkzIDQ4OSIgdmVyc2lvbj0iMS4xIj48cGF0aCBkPSJNIDIwMC40NDIgOS44ODggQyAxOTMuNjIzIDEzLjAyNSwgMTg4IDIyLjUyMiwgMTg4IDMwLjkwNCBDIDE4OCAzMy42MTEsIDE4NC45MzEgMzMuNjg2LCAxODIuNTM0IDMxLjAzOCBDIDE3Ny45NTYgMjUuOTc5LCAxNjguODM1IDI2LjI3NSwgMTYzLjk0MCAzMS42NDIgQyAxNjEuNTAwIDM0LjMxNywgMTYxLjUwMCAzNC4zMTcsIDE2NC42NDYgMzIuMDQ3IEMgMTcwLjQzMCAyNy44NzUsIDE4MiAyOC40MjgsIDE4MiAzMi44NzcgQyAxODIgMzQuMDkyLCAxODAuNjE1IDM1LjUyMCwgMTc4LjI1MCAzNi43NDMgQyAxNzMuOTgxIDM4Ljk1MCwgMTcyLjc4MCA0Mi43NDYsIDE3NS42MTAgNDUuMDg2IEMgMTc3LjE4MSA0Ni4zODQsIDE3Ny4yMTMgNDYuMzI2LCAxNzYuMDAzIDQ0LjM4MiBDIDE3NC4xNzQgNDEuNDQ1LCAxNzUuMjc4IDM5LjMyOCwgMTc5LjU3OSAzNy41MzIgQyAxODYuMDk2IDM0LjgwOSwgMTg4IDM1LjM2NywgMTg4IDQwIEMgMTg4IDQzLjMzMywgMTg3LjY2NyA0NCwgMTg2IDQ0IEMgMTg0LjY2NyA0NCwgMTg0IDQ0LjY2NywgMTg0IDQ2IEMgMTg0IDQ3LjEwMCwgMTgzLjYwMSA0OCwgMTgzLjExMyA0OCBDIDE4Mi42MjYgNDgsIDE4Mi4wMjkgNDkuMzQ5LCAxODEuNzg3IDUwLjk5OCBDIDE4MS4zODUgNTMuNzM0LCAxODEuNDkyIDUzLjg2NSwgMTgzLjAwMiA1Mi40OTggQyAxODcuNDk0IDQ4LjQzMywgMTg3LjYzNyA0OS4xNzQsIDE4OC4zMzcgODAuMjUwIEMgMTg5LjU4MCAxMzUuMzgyLCAxODkuMjUxIDE2MiwgMTg3LjMyOSAxNjIgQyAxODYuNDEwIDE2MiwgMTg0LjgzNSAxNjEuMjU1LCAxODMuODI5IDE2MC4zNDUgQyAxODIuMTEzIDE1OC43OTMsIDE4MiAxNTguODE4LCAxODIgMTYwLjc0NiBDIDE4MiAxNjIuMDI3LCAxODAuNzEwIDE2My41NjQsIDE3OC41NzggMTY0LjgyMiBDIDE3MS44NDMgMTY4Ljc5NSwgMTcyLjEzNSAxNzMuNTgwLCAxNzkuMzM5IDE3Ny4zMDQgQyAxODIuNTAxIDE3OC45MzgsIDE4My4wOTcgMTc5LjcxNCwgMTgyLjcxNyAxODEuNjk4IEMgMTgyLjI1NyAxODQuMTA3LCAxODIuMjU3IDE4NC4xMDcsIDE4NC41NzggMTgxLjkyNyBDIDE4OC4yNDEgMTc4LjQ4NiwgMTkwIDE3OS45NjksIDE5MCAxODYuNTAxIEMgMTkwIDE5NS43MzQsIDE5My43MzYgMjAyLjI2NCwgMjAxLjIxMCAyMDYuMDk3IEMgMjA3LjAyNyAyMDkuMDgxLCAyMDcuMDY2IDIwOC4zMDYsIDIwMS4yNjYgMjA0Ljk3OSBDIDE5NS40NzQgMjAxLjY1OCwgMTkzLjI2OSAxOTguOTE2LCAxOTEuODUyIDE5My4yNzMgQyAxOTEuMzIwIDE5MS4xNTQsIDE5MC42NTYgMTU0LjE0NywgMTkwLjMzNiAxMDguODYwIEMgMTg5LjcwMyAxOS4yMTgsIDE4OS41NDggMjEuNjYwLCAxOTYuMjcyIDE1LjI5MyBDIDIwMi4yMjIgOS42NjAsIDIwNi45ODAgOS4xMzAsIDIyNi41MDAgMTEuOTMwIEMgMjUwLjA1OCAxNS4zMDksIDI3MC4zMjIgMTcuOTU3LCAyODggMTkuOTY4IEMgMjkyLjY3NSAyMC40OTksIDMwMC4zMjUgMjEuMzcyLCAzMDUgMjEuOTA3IEMgMzA5LjY3NSAyMi40NDIsIDMyMS42MDAgMjMuODA2LCAzMzEuNTAwIDI0LjkzOSBDIDM3MC4xNjkgMjkuMzY0LCAzODkuNTUxIDMxLjcwNiwgNDA2LjUwMCAzMy45OTggQyA0MTAuOTAwIDM0LjU5NCwgNDE4LjMyNSAzNS41MjMsIDQyMyAzNi4wNjMgQyA0MzMuODYwIDM3LjMxOCwgNDM3LjAzMyAzOC4zODEsIDQ0MC4zOTIgNDEuODg3IEMgNDQ1Ljg1NyA0Ny41OTIsIDQ0Ny4wMTkgNTcuNTM1LCA0NDUuMDU4IDgxLjgyOCBDIDQ0NC4xNjYgOTIuODcwLCA0NDMuNDE5IDEwNi40OTgsIDQ0MS4wMjAgMTU1LjUwMCBDIDQ0MC40NTUgMTY3LjA1MCwgNDM5LjU1MSAxODUuNTAwLCA0MzkuMDExIDE5Ni41MDAgQyA0MzguNDcyIDIwNy41MDAsIDQzNy41MjAgMjI3LjMwMCwgNDM2Ljg5NiAyNDAuNTAwIEMgNDM1LjY1NCAyNjYuNzY0LCA0MzQuNDk4IDI3Mi4zMDksIDQyOS4yNDcgMjc3LjE4MCBDIDQyMi41MzkgMjgzLjQwMiwgNDE0LjczMyAyODMuMjI3LCAzOTkuNTAwIDI3Ni41MTMgQyAzOTcuODUwIDI3NS43ODYsIDM5NC45MjUgMjc0Ljc0MCwgMzkzIDI3NC4xODkgQyAzOTEuMDc1IDI3My42MzgsIDM4NS42NzUgMjcxLjc1NSwgMzgxIDI3MC4wMDQgQyAzNzYuMzI1IDI2OC4yNTQsIDM3MS4zNzUgMjY2LjQ1MSwgMzcwIDI2NS45OTggQyAzNjYuMTQzIDI2NC43MjgsIDM1MS40MzYgMjU5LjQ2NywgMzQyIDI1NS45ODIgQyAzMzcuMzI1IDI1NC4yNTUsIDMzMS4wMjUgMjUyLjAyNiwgMzI4IDI1MS4wMjggQyAzMjIuODQzIDI0OS4zMjcsIDMxNi4wODAgMjQ2Ljg1OCwgMzExLjUwMCAyNDUuMDA0IEMgMzA5LjYyNyAyNDQuMjQ2LCAzMDUuOTY3IDI0Mi44OTcsIDI5Mi41MDAgMjM4IEMgMjg5LjQ3NSAyMzYuOTAwLCAyODQuNjM3IDIzNS4xMTUsIDI4MS43NTAgMjM0LjAzMyBDIDI3NC44OTggMjMxLjQ2NSwgMjQ0LjA4MiAyMjAuOTk1LCAyNDEuNTAwIDIyMC4zNTcgQyAyMzYuNzgyIDIxOS4xOTEsIDI0My4xOTEgMjIyLjAwNiwgMjU2LjUwMCAyMjYuOTQ2IEMgMjY0LjIwMCAyMjkuODA0LCAyNzIuNzUwIDIzMi45NzgsIDI3NS41MDAgMjMzLjk5OSBDIDI3OC4yNTAgMjM1LjAyMCwgMjg0LjMyNSAyMzcuMTk4LCAyODkgMjM4Ljg0MCBDIDI5My42NzUgMjQwLjQ4MiwgMzAzLjkxMiAyNDQuMTE1LCAzMTEuNzUwIDI0Ni45MTMgQyAzMjguNjA4IDI1Mi45MzEsIDM1My4yNjMgMjYxLjcwMCwgMzU3LjUwMCAyNjMuMTg0IEMgMzU5LjE1MCAyNjMuNzYyLCAzNjEuODUwIDI2NC43OTEsIDM2My41MDAgMjY1LjQ3MSBDIDM2NS4xNTAgMjY2LjE1MSwgMzY5LjM1NCAyNjcuNzQ0LCAzNzIuODQxIDI2OS4wMTAgQyAzODAuMzk4IDI3MS43NTQsIDM4MC45MjEgMjcyLjcyMiwgMzc4LjE0NSAyNzguODI1IEMgMzc2LjQ0OCAyODIuNTU2LCAzNzQuMDQ4IDI5My4yNDMsIDM3NC4wMDggMjk3LjI1MCBDIDM3My45OTIgMjk4Ljc1MywgMzY4LjU3NiAyOTcuOTM5LCAzNjEuNjIxIDI5NS4zODkgQyAzNTcuNzA0IDI5My45NTMsIDM0Ny4wNzUgMjkwLjE3NywgMzM4IDI4Ni45OTcgQyAzMjguOTI1IDI4My44MTgsIDMxNy42NzUgMjc5Ljc5MiwgMzEzIDI3OC4wNTEgQyAyOTkuNDQyIDI3My4wMDMsIDI5NC4wMjggMjcxLjAyNiwgMjg1LjUwMCAyNjguMDExIEMgMjgxLjEwMCAyNjYuNDU2LCAyNzMuOTAwIDI2My44NDYsIDI2OS41MDAgMjYyLjIxMiBDIDI0My4wMzkgMjUyLjM4NCwgMjI4LjA1NCAyNDcsIDIyNy4xNjMgMjQ3IEMgMjIyLjIwOSAyNDcsIDIyMC4yNzcgMjMzLjY0NCwgMjI0LjA2NSAyMjUuNTg1IEMgMjI3LjMxMiAyMTguNjc4LCAyMjkuMjQxIDIxNy4zODQsIDIzNC4yODUgMjE4LjczMSBDIDI0Mi4yMzcgMjIwLjg1MywgMjM4Ljk0MyAyMTkuMzMzLCAyMjMuMzI2IDIxMy42NzQgQyAyMTQuNzEzIDIxMC41NTQsIDIwNy40OTIgMjA4LjE3NSwgMjA3LjI3OSAyMDguMzg4IEMgMjA3LjA2NiAyMDguNjAxLCAyMTAuNjE1IDIxMC4xMjAsIDIxNS4xNjcgMjExLjc2NCBDIDIyNS4wNzEgMjE1LjM0MiwgMjI2LjE5MCAyMTYuNjM1LCAyMjMuNTc4IDIyMS40ODUgQyAyMjAuNzY5IDIyNi43MDEsIDIyMC4xODIgMjI2LjYxNywgMTk2IDIxNy41NjYgQyAxODUuMDk4IDIxMy40ODUsIDE4MS4xMTUgMjEzLjIwNCwgMTczLjc2MSAyMTUuOTk5IEMgMTY2Ljk0NyAyMTguNTg5LCAxNjQgMjE4LjYwNywgMTY0IDIxNi4wNTkgQyAxNjQgMjE0Ljk5MSwgMTY0LjQ1MCAyMTMuODQwLCAxNjUgMjEzLjUwMCBDIDE2NS41NTAgMjEzLjE2MCwgMTY2IDIxMC44MTMsIDE2NiAyMDguMjg1IEMgMTY2IDIwMC41OTAsIDE1OS4yNDYgMTkzLjg1MSwgMTUxLjgwMCAxOTQuMTE4IEMgMTQ4Ljg4NiAxOTQuMjIzLCAxNDkuMDYwIDE5NC4zNTMsIDE1My4yODggMTk1LjIzMyBDIDE1OS4zNDcgMTk2LjQ5NSwgMTYzLjU3NyAyMDAuNTQwLCAxNjQuNDkxIDIwNS45NDUgQyAxNjUuODM2IDIxMy45MDYsIDE2Mi44NTUgMjE2LjM1OCwgMTU4LjM0NyAyMTEgQyAxNTQuMTkyIDIwNi4wNjMsIDE0OS43MTYgMjA3Ljg5MSwgMTQ4LjM4OCAyMTUuMDY2IEMgMTQ4LjAzOSAyMTYuOTU1LCAxNDcuMDY0IDIxOS4wNTAsIDE0Ni4yMjMgMjE5LjcyMiBDIDE0NC44NTggMjIwLjgxMywgMTQ0Ljg3MiAyMjEuMDEzLCAxNDYuMzQ3IDIyMS41NzkgQyAxNDkuOTIxIDIyMi45NTEsIDE0OC4wNTggMjI1LjQ4OSwgMTQxLjc1MCAyMjcuODM5IEMgMTM4LjMxMyAyMjkuMTIwLCAxMzIuMDEyIDIzMS40ODAsIDEyNy43NTAgMjMzLjA4NCBDIDEyMy40ODcgMjM0LjY4OCwgMTE2LjI4NyAyMzcuMzkzLCAxMTEuNzUwIDIzOS4wOTUgQyAxMDcuMjEyIDI0MC43OTgsIDEwMi42MDAgMjQyLjU1NiwgMTAxLjUwMCAyNDMuMDAzIEMgMTAwLjQwMCAyNDMuNDUxLCA5MS4xNzUgMjQ3LjA0OSwgODEgMjUxIEMgNzAuODI1IDI1NC45NTEsIDYxLjYwMCAyNTguNTUxLCA2MC41MDAgMjU5IEMgNDEuNjkyIDI2Ni42NzYsIDQwLjUyMyAyNjYuNjM5LCA0Mi44NzcgMjU4LjQzMCBDIDQzLjQ1MCAyNTYuNDI5LCA0My4zNDYgMjU0LjM3NywgNDIuNTczIDI1Mi40ODcgQyA0MS40NjIgMjQ5Ljc2OSwgNDEuMzk2IDI0OS45MjAsIDQxLjQ0NyAyNTUuMDUwIEMgNDEuNDk2IDI2MC4wNzQsIDQxLjMyNCAyNjAuNDk0LCAzOS4yNDkgMjYwLjQyMSBDIDM3LjIxNiAyNjAuMzQ5LCAzNy4xNDMgMjYwLjUwMSwgMzguNDk5IDI2MS45OTkgQyA0MC44NjIgMjY0LjYxMCwgNDAuMzg0IDI2NywgMzcuNTAwIDI2NyBDIDM2LjEyNSAyNjcsIDM0Ljk1NSAyNjYuNDM4LCAzNC45MDAgMjY1Ljc1MCBDIDM0Ljg0NSAyNjUuMDYzLCAzNC40OTAgMjY1LjYyNSwgMzQuMTA5IDI2NyBDIDMzLjMzMCAyNjkuODE4LCAyOS4yNjAgMjcxLjAxOCwgMjcuODc4IDI2OC44MzcgQyAyNi43MDAgMjY2Ljk3OSwgMjYuNzkxIDI2MS4yNjAsIDI4LjAzNSAyNTguOTM0IEMgMjkuMjA3IDI1Ni43NDQsIDMyLjkyOCAyNTYuMzc2LCAzNC45NDcgMjU4LjI1MCBDIDM2LjAxMiAyNTkuMjM4LCAzNi4xNDYgMjU5LjIzOSwgMzUuNTkxIDI1OC4yNTUgQyAzMi43OTkgMjUzLjMwOSwgMjYuMzQ3IDI1Ni4yOTEsIDI1LjgwOSAyNjIuNzc2IEMgMjUuNTMwIDI2Ni4xMzgsIDI1LjIyNSAyNjYuNDk2LCAyMi42NjkgMjY2LjQ1NCBDIDIwLjEwOSAyNjYuNDEzLCAyMC4wMDggMjY2LjUzMywgMjEuNjEwIDI2Ny43MDQgQyAyMi41ODUgMjY4LjQxNywgMjMuNzQ2IDI2OSwgMjQuMTkxIDI2OSBDIDI3LjE0NCAyNjksIDIzLjk2NCAyNzIuMjk2LCAxOC41ODMgMjc0LjgxNCBDIDkuOTMzIDI3OC44NjIsIDguNDQyIDI4MS4zMDIsIDguNzIyIDI5MC45NTQgQyAxMC42MjUgMzU2LjU4MSwgMTAuMTQ1IDM1Mi4wMDksIDE1LjY2NCAzNTcuMTM0IEMgMTkuMTk2IDM2MC40MTMsIDM5Ljc4NyAzNzIuNTg4LCA5MS42OTkgNDAyLjA5MCBDIDEwMS4wNDAgNDA3LjM5OSwgMTE3LjQ5NCA0MTYuODg0LCAxMjQuNzY0IDQyMS4xNTAgQyAxMjkuMzA5IDQyMy44MTgsIDEzMy4yOTAgNDI2LCAxMzMuNjA5IDQyNiBDIDEzMy45MjkgNDI2LCAxMzUuMzg2IDQyNi44MzEsIDEzNi44NDYgNDI3Ljg0NyBDIDEzOC4zMDYgNDI4Ljg2MywgMTQxLjk3NSA0MzEuMDQ3LCAxNDUgNDMyLjcwMCBDIDE0OC4wMjUgNDM0LjM1MywgMTUyLjA3NSA0MzYuNjE3LCAxNTQgNDM3LjczMiBDIDE3NC43MzUgNDQ5Ljc0MCwgMTk2LjMwNyA0NjIsIDE5Ni43MDEgNDYyIEMgMTk2Ljk3MCA0NjIsIDE5OC4zODYgNDYyLjgzMywgMTk5Ljg0NiA0NjMuODUxIEMgMjAxLjMwNiA0NjQuODY5LCAyMDYuMTAwIDQ2Ny42MzksIDIxMC41MDAgNDcwLjAwNiBDIDIxNC45MDAgNDcyLjM3MywgMjIwLjMwMCA0NzUuNTA5LCAyMjIuNTAwIDQ3Ni45NzUgQyAyMjguNTQ0IDQ4MS4wMDIsIDIzMi4zMDEgNDgyLjIwMCwgMjM4Ljg4MSA0ODIuMjAwIEMgMjQ3LjY0NSA0ODIuMjAwLCAyNTAuODQxIDQ4MC44ODUsIDI4MCA0NjUuMjgyIEMgMjgzLjAyNSA0NjMuNjYzLCAyOTAgNDU5Ljk0NywgMjk1LjUwMCA0NTcuMDI0IEMgMzAxIDQ1NC4xMDEsIDMwNy45NzUgNDUwLjM2MiwgMzExIDQ0OC43MTQgQyAzMTQuMDI1IDQ0Ny4wNjcsIDMxOS40MjUgNDQ0LjE1NSwgMzIzIDQ0Mi4yNDMgQyAzMjYuNTc1IDQ0MC4zMzAsIDMzMS43NTAgNDM3LjUzNSwgMzM0LjUwMCA0MzYuMDMxIEMgMzM3LjI1MCA0MzQuNTI3LCAzNDQgNDMwLjkwMSwgMzQ5LjUwMCA0MjcuOTc0IEMgMzU1IDQyNS4wNDYsIDM2NC42NzUgNDE5Ljc0MSwgMzcxIDQxNi4xODQgQyAzNzcuMzI1IDQxMi42MjcsIDM4NC43NTAgNDA4LjUwOSwgMzg3LjUwMCA0MDcuMDMzIEMgMzkwLjI1MCA0MDUuNTU2LCAzOTUuNTgzIDQwMi40NzAsIDM5OS4zNTIgNDAwLjE3NCBDIDQwMy4xMjEgMzk3Ljg3OCwgNDA2LjQxMCAzOTYsIDQwNi42NjEgMzk2IEMgNDA4LjIwNSAzOTYsIDQxNS41NzggMzg4Ljg1MSwgNDE3LjQ5MCAzODUuNTAwIEMgNDIxLjAwMyAzNzkuMzQwLCA0MjIuNDMyIDM2NS4xODksIDQyMi40MzcgMzM2LjUwMCBDIDQyMi40NDEgMzEyLjMxNywgNDIyLjM2NCAzMTEuMzQ0LCA0MjAuMTAzIDMwNi43MzQgQyA0MTcuODkzIDMwMi4yMzAsIDQxMy41MjUgMjk4LCA0MTEuMDgyIDI5OCBDIDQxMC40NzIgMjk4LCA0MDkuMTkxIDI5Ny41ODcsIDQwOC4yMzYgMjk3LjA4MiBDIDQwNS4xNzIgMjk1LjQ2MSwgMzk3LjYyMSAyOTIuMzk5LCAzOTMuNDU2IDI5MS4wODkgQyAzODYuNzAwIDI4OC45NjIsIDM3OC41MTcgMjg0LjU5MywgMzc4LjIxNSAyODIuOTUwIEMgMzc4LjA1OCAyODIuMDk3LCAzNzguOTgyIDI3OS44NDcsIDM4MC4yNjggMjc3Ljk1MCBDIDM4My4zOTAgMjczLjM0MywgMzg1LjkyNyAyNzMuNTExLCA0MDMgMjc5LjQ1NCBDIDQxOS4zNzIgMjg1LjE1MiwgNDE2LjQ5MSAyODUuMzQzLCA0NDQgMjc2LjczMCBDIDQ2My45NzAgMjcwLjQ3NywgNDczLjUwMyAyNjMuODgyLCA0NzYuMzA1IDI1NC4zODEgQyA0NzcuOTc1IDI0OC43MTksIDQ3OS40MTUgMjMxLjA2OCwgNDgwLjk4OCAxOTcgQyA0ODIuNDEyIDE2Ni4xNTksIDQ4My45MDUgMTM3LjQ3OSwgNDg1LjA0OCAxMTkgQyA0ODUuNTc1IDExMC40NzUsIDQ4NiA5NC4wNTAsIDQ4NS45OTMgODIuNTAwIEMgNDg1Ljk3NCA1MS40ODgsIDQ4NC4wODggNDguNDQwLCA0NjAuNDM3IDQxLjIwMyBDIDQ0Ny4wNjUgMzcuMTEyLCA0MzguNjkzIDM1LjE2OCwgNDMxLjUwMCAzNC40ODUgQyA0MjUuODMwIDMzLjk0NiwgNDIwLjQyMyAzMy4zMDcsIDQwMi4yNTAgMzEuMDI4IEMgMzkyLjk3MiAyOS44NjQsIDM4MC45MjYgMjguNDY4LCAzNjggMjcuMDU4IEMgMzYyLjc3NSAyNi40ODgsIDM1NC4yMjUgMjUuNTU1LCAzNDkgMjQuOTg0IEMgMzQzLjc3NSAyNC40MTQsIDMzNi44MDAgMjMuNTM0LCAzMzMuNTAwIDIzLjAzMCBDIDMzMC4yMDAgMjIuNTI1LCAzMjMuMjI1IDIxLjYyMCwgMzE4IDIxLjAxOCBDIDMxMi43NzUgMjAuNDE2LCAzMDUuNTc1IDE5LjUwNSwgMzAyIDE4Ljk5NSBDIDI5OC40MjUgMTguNDg1LCAyOTEuMjI1IDE3LjU4MywgMjg2IDE2Ljk5MiBDIDI4MC43NzUgMTYuNDAwLCAyNzMuMzUwIDE1LjUwNywgMjY5LjUwMCAxNS4wMDcgQyAyNjUuNjUwIDE0LjUwNywgMjU3Ljc3NSAxMy41ODMsIDI1MiAxMi45NTQgQyAyNDYuMjI1IDEyLjMyNSwgMjM3IDExLjEzNSwgMjMxLjUwMCAxMC4zMTAgQyAyMTUuMDM3IDcuODQwLCAyMDUuMTg2IDcuNzA3LCAyMDAuNDQyIDkuODg4IE0gMjA2LjUwMCAxOC45NDMgQyAyMDIuMDAxIDIwLjgyOSwgMjAwLjAzMCAyNC4zODQsIDE5OC45NDggMzIuNTY2IEMgMTk3Ljg4NSA0MC42MDIsIDE5OC40NjggMTc1Ljc0NSwgMTk5LjYxNCAxODYuODMyIEMgMjAwLjMzNSAxOTMuODE0LCAyMDQuODU2IDE5OC41MTAsIDIxNC4wNDkgMjAxLjgyOCBDIDIxNy41OTcgMjAzLjEwOCwgMjIxLjQwMCAyMDQuNTQwLCAyMjIuNTAwIDIwNS4wMTEgQyAyMjMuNjAwIDIwNS40ODEsIDIyOC40MzggMjA3LjI0NiwgMjMzLjI1MCAyMDguOTMzIEMgMjM4LjA2MyAyMTAuNjIwLCAyNDUuNzEzIDIxMy4zMTcsIDI1MC4yNTAgMjE0LjkyNyBDIDI1OS4wNjggMjE4LjA1NiwgMjkyLjA3MiAyMjkuNTk0LCAzMTEgMjM2LjE2NSBDIDMxNy4zMjUgMjM4LjM2MSwgMzI4LjU3NSAyNDIuMzQxLCAzMzYgMjQ1LjAxMCBDIDM1NS45OTkgMjUyLjE5OCwgMzgwLjc0NCAyNjAuOTU1LCAzODcgMjYzLjA1OCBDIDM5MC4wMjUgMjY0LjA3NiwgMzk3LjIwMSAyNjYuNTAzLCA0MDIuOTQ2IDI2OC40NTQgQyA0MTUuMDEwIDI3Mi41NDksIDQxOC4wODcgMjcyLjc4NiwgNDIyLjA5OCAyNjkuOTMwIEMgNDI1LjQyOCAyNjcuNTU5LCA0MjYuOTY5IDI2NS4wMjksIDQyOC4xMzEgMjYwLjAyNCBDIDQyOS4wODggMjU1Ljg5NywgNDMxLjQzMyAyMTUuMTI5LCA0MzIuOTY0IDE3NiBDIDQzMy41NTUgMTYwLjg3NSwgNDM0LjU3NyAxMzkuNTAwLCA0MzUuMjM0IDEyOC41MDAgQyA0MzUuODkxIDExNy41MDAsIDQzNi40NDUgOTYuNTc1LCA0MzYuNDY1IDgyIEMgNDM2LjUwMCA1NS44MTIsIDQzNi40NzMgNTUuNDYxLCA0MzQuMTY3IDUyLjIyOSBDIDQzMS4yOTAgNDguMTk1LCA0MjcuNDIyIDQ2LjUyMCwgNDE5IDQ1LjY2MiBDIDQxNS40MjUgNDUuMjk3LCA0MDkuMTI1IDQ0LjUyOSwgNDA1IDQzLjk1NCBDIDQwMC44NzUgNDMuMzc5LCAzOTMuOTAwIDQyLjQ3OSwgMzg5LjUwMCA0MS45NTQgQyAzODAuODU1IDQwLjkyMiwgMzcyLjA5MiAzOS43ODIsIDM1OS41MDAgMzguMDUxIEMgMzU1LjEwMCAzNy40NDYsIDMzMy45NTAgMzQuNzE2LCAzMTIuNTAwIDMxLjk4NSBDIDI0MC40ODAgMjIuODE0LCAyMjAuMjIzIDIwLjEzMCwgMjExIDE4LjUzNiBDIDIwOS42MjUgMTguMjk5LCAyMDcuNjAwIDE4LjQ4MiwgMjA2LjUwMCAxOC45NDMgTSAyMDQuNzQwIDIyLjAwOCBDIDIwMC42ODkgMjQuNTQ1LCAxOTkuOTQxIDI5LjI2MiwgMjAwLjA0MSA1MS42MjEgQyAyMDAuMTE3IDY4LjczMiwgMjAwLjQxNCA3My4wOTgsIDIwMS41NjQgNzQuMDUzIEMgMjAyLjM1MCA3NC43MDYsIDIxMC4zMDcgNzYuNzU4LCAyMTkuMjQ3IDc4LjYxMyBDIDIzMi43OTAgODEuNDI1LCAyNTYuMjA5IDg2LjI4MCwgMjc0LjUwMCA5MC4wNjkgQyAyNzYuNzAwIDkwLjUyNSwgMjg5LjUyNSA5My4xODIsIDMwMyA5NS45NzUgQyAzMjMuNzY2IDEwMC4yNzgsIDM1Ni45MTIgMTA2LjkzMiwgMzc4IDExMS4wMzEgQyAzODEuMDI1IDExMS42MTksIDM4NS41MjUgMTEyLjUzNCwgMzg4IDExMy4wNjUgQyAzOTIuOTkyIDExNC4xMzUsIDQwMi4xMDAgMTE1Ljk3MiwgNDE4LjE4NCAxMTkuMTUyIEMgNDI0LjA2MSAxMjAuMzE0LCA0MjkuNTA4IDEyMS4wMTksIDQzMC4yOTAgMTIwLjcxOSBDIDQzMS45NDAgMTIwLjA4NiwgNDMyLjU1MyAxMTMuODQyLCA0MzQuMDI2IDgyLjY5MiBDIDQzNS4wMjEgNjEuNjQ1LCA0MzQuODQ5IDU4Ljc0MSwgNDMyLjMxMiA1My43MDcgQyA0MzAuMjU2IDQ5LjYyOSwgNDI3LjY4NyA0OS4wMjQsIDM5NSA0NC45MzEgQyAzOTAuMzI1IDQ0LjM0NSwgMzgzLjgwMCA0My40NjgsIDM4MC41MDAgNDIuOTgxIEMgMzc3LjIwMCA0Mi40OTUsIDM3MC42NzUgNDEuNTk5LCAzNjYgNDAuOTkxIEMgMzYxLjMyNSA0MC4zODQsIDM1NC41NzUgMzkuNDg4LCAzNTEgMzkgQyAzNDcuNDI1IDM4LjUxMiwgMzQwLjY3NSAzNy42MTYsIDMzNiAzNy4wMDkgQyAzMzEuMzI1IDM2LjQwMSwgMzI0LjgwMCAzNS40ODEsIDMyMS41MDAgMzQuOTY0IEMgMzE4LjIwMCAzNC40NDYsIDMwOC41MjUgMzMuMTA2LCAzMDAgMzEuOTg0IEMgMjc5LjgxNSAyOS4zMjgsIDI1OS4wMzUgMjYuNDk4LCAyNDEgMjMuOTQ5IEMgMjIyLjY3NyAyMS4zNjAsIDIwNy4xMDYgMjAuNTI2LCAyMDQuNzQwIDIyLjAwOCBNIDIyMS44MTQgMzIuMDM1IEMgMjIzLjk3MCAzMi45MTgsIDIzNC4zMzkgMzQuNTUyLCAyNTMuNTAwIDM3LjAyOSBDIDI1Ny45MDAgMzcuNTk4LCAyNjQuNjUwIDM4LjQ4NSwgMjY4LjUwMCAzOSBDIDI3Mi4zNTAgMzkuNTE1LCAyNzkuMTAwIDQwLjQwNiwgMjgzLjUwMCA0MC45ODAgQyAyODcuOTAwIDQxLjU1NCwgMjk4LjAyNSA0Mi44ODYsIDMwNiA0My45NDAgQyAzMjcuMDA2IDQ2LjcxNywgMzI5LjY5MCA0Ni45NzQsIDMyOCA0Ni4wNDYgQyAzMjcuMTc1IDQ1LjU5NCwgMzI0LjAyNSA0NC45MTIsIDMyMSA0NC41MzIgQyAzMTcuOTc1IDQ0LjE1MiwgMzEwLjMyNSA0Mi45OTAsIDMwNCA0MS45NDkgQyAyOTcuNjc1IDQwLjkwOSwgMjg5LjM1MCAzOS41NzMsIDI4NS41MDAgMzguOTgwIEMgMjgxLjY1MCAzOC4zODcsIDI3Ni40NzUgMzcuNTEwLCAyNzQgMzcuMDMwIEMgMjcxLjUyNSAzNi41NTEsIDI2NC43NzUgMzUuNjUyLCAyNTkgMzUuMDMzIEMgMjIyLjM4OSAzMS4xMDksIDIxOC44NTkgMzAuODI1LCAyMjEuODE0IDMyLjAzNSBNIDE2Ni40MjkgMzYuNDY4IEMgMTY1LjU0MCAzNy44MjUsIDE2NC45NjcgMzkuMzU3LCAxNjUuMTU2IDM5Ljg3MiBDIDE2NS4zNDUgNDAuMzg3LCAxNjYuMjc4IDM5LjI3NiwgMTY3LjIyOSAzNy40MDQgQyAxNjkuMjQyIDMzLjQ0MSwgMTY4Ljc3MiAzMi44OTIsIDE2Ni40MjkgMzYuNDY4IE0gMjA3LjI4NiA0NS41MDAgQyAyMDcuMjk0IDQ4LjI1MCwgMjA3LjQ4OCA0OS4yNTYsIDIwNy43MTggNDcuNzM2IEMgMjA3Ljk0NyA0Ni4yMTYsIDIwNy45NDEgNDMuOTY2LCAyMDcuNzA0IDQyLjczNiBDIDIwNy40NjcgNDEuNTA2LCAyMDcuMjc5IDQyLjc1MCwgMjA3LjI4NiA0NS41MDAgTSA0NDYuMzk0IDQ0LjExNiBDIDQ0OC4wNzQgNTIuNzIzLCA0NDguMjE0IDYwLjIxMiwgNDQ3LjEyNCA4MyBDIDQ0Ni40NzkgOTYuNDc1LCA0NDUuMDczIDEyNy4wNzUsIDQ0NCAxNTEgQyA0NDAuOTUzIDIxOC45MTYsIDQzOC4zNTEgMjYxLjY0NCwgNDM2LjkzNiAyNjcgQyA0MzUuMzE0IDI3My4xNDEsIDQzNS43MTAgMjc2LCA0MzguMTgzIDI3NiBDIDQ0MC42MjggMjc2LCA0NTAuMjg3IDI3Mi44MzMsIDQ1Ni43MzkgMjY5LjkxNiBDIDQ1OS4wNzEgMjY4Ljg2MiwgNDYxLjI0MCAyNjgsIDQ2MS41NTkgMjY4IEMgNDYzLjY3NSAyNjgsIDQ3MS4zODUgMjYxLjE4NSwgNDczLjIxNiAyNTcuNjk4IEMgNDc2LjE3MSAyNTIuMDY4LCA0NzcuMjc4IDIzMCwgNDc0LjYwNSAyMzAgQyA0NzMuNjgzIDIzMCwgNDczIDIzMC44MjYsIDQ3MyAyMzEuOTQxIEMgNDczIDIzMy4wMDksIDQ3Mi41NDYgMjM0LjE2MiwgNDcxLjk5MiAyMzQuNTA1IEMgNDcxLjMyMiAyMzQuOTE5LCA0NzEuMjA4IDIzMS4xNjQsIDQ3MS42NTIgMjIzLjMxNCBDIDQ3Mi41MjcgMjA3Ljg1MywgNDczLjgwMSAyMDMuNTkyLCA0NzMuOTE0IDIxNS43NTAgQyA0NzMuOTgxIDIyMi45NzUsIDQ3NC4zMDcgMjI1LCA0NzUuNDAxIDIyNSBDIDQ3Ni45MDkgMjI1LCA0NzYuOTk2IDIyMy45MzMsIDQ3OS4wMTEgMTgwLjUwMCBDIDQ3OS41NzIgMTY4LjQwMCwgNDgwLjQ2MyAxNDkuNzI1LCA0ODAuOTg5IDEzOSBDIDQ4NC4yMjggNzMuMDI1LCA0ODQuMzgxIDY1LjY2NCwgNDgyLjYyNSA2MC4zNzcgQyA0NzkuMzY5IDUwLjU3NSwgNDY4LjA3MiA0My44ODUsIDQ1MC42MTcgNDEuNDIyIEMgNDQ1LjczNCA0MC43MzMsIDQ0NS43MzQgNDAuNzMzLCA0NDYuMzk0IDQ0LjExNiBNIDE2Ny40NDEgNTQuNTQwIEMgMTY5LjYyNCA1Ni4xODEsIDE3Ni43MTIgNTYuNDcyLCAxNzkgNTUuMDEzIEMgMTgwLjA0MCA1NC4zNTAsIDE3OS40MDkgNTQuMjMyLCAxNzYuOTQxIDU0LjYyOCBDIDE3NC45ODQgNTQuOTQyLCAxNzEuNjA5IDU0LjcyMywgMTY5LjQ0MSA1NC4xNDAgQyAxNjUuODkyIDUzLjE4NiwgMTY1LjY5MyA1My4yMjUsIDE2Ny40NDEgNTQuNTQwIE0gNDEzLjE2NyA1Ni44NzYgQyA0MTIuMjUwIDU3LjQ1NywgNDEzLjIzNCA1OC4wNzMsIDQxNi4zMTkgNTguODUwIEMgNDIwLjk1MiA2MC4wMTcsIDQyNiA2NC42NTQsIDQyNiA2Ny43NDMgQyA0MjYgNjguNjE4LCA0MjYuMjk1IDY5LjAzOCwgNDI2LjY1NiA2OC42NzcgQyA0MjguMzEwIDY3LjAyMywgNDIzLjYxNiA1OS45OTIsIDQxOS41NDEgNTguMDIwIEMgNDE0Ljc4NSA1NS43MTgsIDQxNC45NDggNTUuNzQ3LCA0MTMuMTY3IDU2Ljg3NiBNIDQ3Ni41NTEgNjIuNDY4IEMgNDc3LjM0OCA2NC4zNzUsIDQ3OCA2OC44NzUsIDQ3OCA3Mi40NjggQyA0NzggNzYuMTU2LCA0NzguNDM1IDc5LCA0NzkgNzkgQyA0ODAuNzczIDc5LCA0ODAuMDc5IDY3Ljc3MSwgNDc4LjAyNyA2My4yNTAgQyA0NzUuNzIxIDU4LjE2OSwgNDc0LjQ4MCA1Ny41MTIsIDQ3Ni41NTEgNjIuNDY4IE0gMjAwLjMwOSA3OS42MzYgQyAxOTkuMjA2IDgyLjUxMSwgMjAxLjUyMSA4NC40NTYsIDIwOC4wOTUgODYuMTc5IEwgMjE0LjUwMCA4Ny44NTggMjA3Ljg1OCA4Ny4zMDIgQyAyMDEuNTY0IDg2Ljc3NSwgMjAxLjE3NyA4Ni44NjcsIDIwMC40ODEgODkuMDYxIEMgMTk5LjkzMCA5MC43OTcsIDIwMC4yODIgOTEuODEwLCAyMDEuODkzIDkzLjExNCBDIDIwNC4wNDAgOTQuODUzLCAyMDQuMDQwIDk0Ljg1MywgMjAxLjk4MyA5NS41MDYgQyAxOTkuOTQwIDk2LjE1NCwgMTk5LjkyNyA5Ni40ODEsIDIwMC4yMTMgMTQyLjgyOSBDIDIwMC40ODIgMTg2LjQ5OCwgMjAwLjYyMSAxODkuNzAwLCAyMDIuMzg2IDE5Mi42MTQgQyAyMDUuMDc1IDE5Ny4wNTYsIDIwNy44MDQgMTk4LjM5MSwgMjI5LjgzMCAyMDYuMDMxIEMgMjQ4Ljg5MSAyMTIuNjQzLCAyNjUuMTE2IDIxOC4zOTcsIDI3Ny41MDAgMjIyLjkzNiBDIDI4MC44MDAgMjI0LjE0NSwgMjg1Ljk3NSAyMjUuOTY0LCAyODkgMjI2Ljk3OCBDIDI5Mi4wMjUgMjI3Ljk5MiwgMzAxLjAyNSAyMzEuMTU2LCAzMDkgMjM0LjAwOSBDIDMxNi45NzUgMjM2Ljg2MSwgMzI4LjQ1MCAyNDAuOTIzLCAzMzQuNTAwIDI0My4wMzQgQyAzNDAuNTUwIDI0NS4xNDYsIDM1NS44NTAgMjUwLjUxOSwgMzY4LjUwMCAyNTQuOTc1IEMgNDE2LjI3MiAyNzEuODA0LCA0MTcuNDY5IDI3Mi4wODcsIDQyMi40OTcgMjY3Ljc1MCBDIDQyNi4zMzYgMjY0LjQzOCwgNDI3LjA2OSAyNTkuOTUxLCA0MjguMDA4IDIzNCBDIDQyOC40NzYgMjIxLjA3NSwgNDI5LjM1NyAxOTcuMDk2LCA0MjkuOTY2IDE4MC43MTQgQyA0MzAuNTc1IDE2NC4zMzEsIDQzMC44MDUgMTUwLjQ5NCwgNDMwLjQ3OCAxNDkuOTY0IEMgNDI5LjE5NCAxNDcuODg3LCA0MjYuMTgwIDE0OS4wNDUsIDQyNS4xNDUgMTUyLjAxMyBDIDQyNC4xMTQgMTU0Ljk3MiwgNDIxLjUzNyAxNTYuODcxLCA0MjAuMjcyIDE1NS42MDUgQyA0MTkuOTE4IDE1NS4yNTIsIDQxOS4zNzUgMTUzLjEwMywgNDE5LjA2NSAxNTAuODMxIEMgNDE4LjUwMSAxNDYuNzA3LCA0MTguNDg3IDE0Ni42OTUsIDQxMi41MDAgMTQ1LjMxNCBDIDQwOS4yMDAgMTQ0LjU1MywgNDA0LjkyNSAxNDMuNTIwLCA0MDMgMTQzLjAxOCBDIDQwMS4wNzUgMTQyLjUxNywgMzk1LjIyNSAxNDEuMTcxLCAzOTAgMTQwLjAyOCBDIDM4NC43NzUgMTM4Ljg4NCwgMzc4LjkyNSAxMzcuNTMyLCAzNzcgMTM3LjAyMiBDIDM3NS4wNzUgMTM2LjUxMiwgMzY5LjY3NSAxMzUuMTk4LCAzNjUgMTM0LjEwMyBDIDM2MC4zMjUgMTMzLjAwNywgMzQ5LjA3NSAxMzAuMzEyLCAzNDAgMTI4LjExNCBDIDMzMC45MjUgMTI1LjkxNiwgMzE4Ljc3NSAxMjIuOTgyLCAzMTMgMTIxLjU5NCBDIDI0Mi4wMzcgMTA0LjU0NiwgMjE4LjA1MSA5OC42MTUsIDIxOC40NTIgOTguMjE1IEMgMjE4Ljc5NCA5Ny44NzIsIDI1Ni43MjkgMTA2LjA4MCwgMjc4IDExMS4wOTkgQyAyOTAuNjU4IDExNC4wODUsIDMwMi44NzMgMTE2Ljg3OCwgMzEyLjI1MCAxMTguOTMwIEMgMzE0LjU4NyAxMTkuNDQyLCAzMTguNzUwIDEyMC4zNzMsIDMyMS41MDAgMTIxIEMgMzI0LjI1MCAxMjEuNjI3LCAzMjguMzAwIDEyMi41MjcsIDMzMC41MDAgMTIzIEMgMzM2LjU2MyAxMjQuMzAzLCAzNDQuMDk0IDEyNi4wMjUsIDM0OCAxMjcgQyAzNTEuMjQ3IDEyNy44MTAsIDM1NC4wODYgMTI4LjQ2MCwgMzY1LjI1MCAxMzAuOTQ3IEMgMzcxLjc4OSAxMzIuNDAzLCAzOTUuMDczIDEzNy45NDAsIDM5OSAxMzguOTczIEMgNDA1LjMzNCAxNDAuNjM5LCA0MTkuMDQzIDE0NCwgNDE5LjUwMyAxNDQgQyA0MjAuODQ3IDE0NCwgNDIzLjA4MyAxMzguODM4LCA0MjIuNTE1IDEzNy4wNDggQyA0MjEuNjU5IDEzNC4zNDksIDQxOS41MjkgMTMzLjMwMywgNDEyLjQwMiAxMzIuMDc5IEMgNDA5LjE1NiAxMzEuNTIxLCA0MDIuMjI1IDEzMC4xMDUsIDM5NyAxMjguOTMyIEMgMzkxLjc3NSAxMjcuNzU5LCAzODUuOTI1IDEyNi40NDcsIDM4NCAxMjYuMDE4IEMgMzgyLjA3NSAxMjUuNTg5LCAzNzIuMTc1IDEyMy4zMzIsIDM2MiAxMjEuMDAyIEMgMzUxLjgyNSAxMTguNjczLCAzNDEuNTEyIDExNi4zNjksIDMzOS4wODIgMTE1Ljg4MiBDIDMzNi42NTIgMTE1LjM5NiwgMzM0LjQwMiAxMTQuNzEwLCAzMzQuMDgyIDExNC4zNTcgQyAzMzMuMzA3IDExMy41MDUsIDMzNy42NjAgMTE0LjI1OSwgMzU1IDExNy45ODAgQyAzNjIuOTc1IDExOS42OTEsIDM3My43NzUgMTIxLjk2NCwgMzc5IDEyMy4wMzEgQyAzOTAuNTgzIDEyNS4zOTYsIDQwMS43NDcgMTI3Ljg2NCwgNDE3LjIzOCAxMzEuNDgxIEMgNDMwLjY0NyAxMzQuNjEzLCA0MzIgMTM0LjQ0NSwgNDMyIDEyOS42NTQgQyA0MzIgMTI0Ljc0NywgNDMwLjM0OSAxMjMuOTI1LCA0MTQuNTAwIDEyMC45NDAgQyA0MDYuNTY0IDExOS40NDUsIDM5MC42MzEgMTE2LjE3NywgMzg1IDExNC44ODkgQyAzNzYuNTU2IDExMi45NTgsIDM3Mi40OTcgMTEyLjA3MywgMzU4IDEwOSBDIDM1MC4wMjUgMTA3LjMxMCwgMzQxLjcwMCAxMDUuNTA3LCAzMzkuNTAwIDEwNC45OTQgQyAzMzcuMzAwIDEwNC40ODEsIDMyOS44NzUgMTAyLjkzNSwgMzIzIDEwMS41NTggQyAzMTYuMTI1IDEwMC4xODIsIDMwMS43MjUgOTcuMjIwLCAyOTEgOTQuOTc3IEMgMjQ4LjUyOSA4Ni4wOTUsIDIwNy4wOTEgNzgsIDIwNC4wOTUgNzggQyAyMDIuMDk0IDc4LCAyMDAuNzA3IDc4LjU5OSwgMjAwLjMwOSA3OS42MzYgTSAyMTYuNTAwIDg5IEMgMjE3LjYwMCA4OS40NzMsIDIxOS42MjUgODkuODQ2LCAyMjEgODkuODMwIEMgMjIzLjUwMCA4OS44MDEsIDIyMy41MDAgODkuODAxLCAyMjEgODkgQyAyMTkuNjI1IDg4LjU2MCwgMjE3LjYwMCA4OC4xODYsIDIxNi41MDAgODguMTcwIEMgMjE0LjUwMCA4OC4xNDEsIDIxNC41MDAgODguMTQxLCAyMTYuNTAwIDg5IE0gMjI1LjUwMCA5MSBDIDIyNi42MDAgOTEuNDczLCAyMjguNjI1IDkxLjg0NiwgMjMwIDkxLjgzMCBDIDIzMi41MDAgOTEuODAxLCAyMzIuNTAwIDkxLjgwMSwgMjMwIDkxIEMgMjI4LjYyNSA5MC41NjAsIDIyNi42MDAgOTAuMTg2LCAyMjUuNTAwIDkwLjE3MCBDIDIyMy41MDAgOTAuMTQxLCAyMjMuNTAwIDkwLjE0MSwgMjI1LjUwMCA5MSBNIDIzNSA5MyBDIDIzNi4zNzUgOTMuNDQwLCAyMzguNDAwIDkzLjgwMSwgMjM5LjUwMCA5My44MDEgQyAyNDEuMDg0IDkzLjgwMSwgMjQwLjk4MCA5My42MzQsIDIzOSA5MyBDIDIzNy42MjUgOTIuNTYwLCAyMzUuNjAwIDkyLjE5OSwgMjM0LjUwMCA5Mi4xOTkgQyAyMzIuOTE2IDkyLjE5OSwgMjMzLjAyMCA5Mi4zNjYsIDIzNSA5MyBNIDQ3Ni43NTAgOTkuNDAxIEMgNDc2LjMzNyAxMDMuNzQ2LCA0NzYuMDQ1IDExMC45NDYsIDQ3Ni4xMDAgMTE1LjQwMSBDIDQ3Ni4xOTEgMTIyLjY3OSwgNDc2LjI5NSAxMjMuMDk4LCA0NzcuMTMwIDExOS41MzUgQyA0NzcuNjQwIDExNy4zNTQsIDQ3Ny45MzMgMTEwLjE1NCwgNDc3Ljc3OSAxMDMuNTM1IEMgNDc3LjUwMCA5MS41MDAsIDQ3Ny41MDAgOTEuNTAwLCA0NzYuNzUwIDk5LjQwMSBNIDI0OS40MzggOTYuMDQ1IEMgMjUzLjgwNCA5Ny4xNDMsIDI1Ny44NTQgOTcuODc1LCAyNTguNDM4IDk3LjY3MiBDIDI1OS41NjYgOTcuMjc5LCAyNTIuMTc2IDk1LjUyNywgMjQ1LjUwMCA5NC42MDMgQyAyNDMuMzAwIDk0LjI5OSwgMjQ1LjA3MiA5NC45NDgsIDI0OS40MzggOTYuMDQ1IE0gMjYwLjUwMCA5OC41NDggQyAyNjEuMDUwIDk4Ljc2MiwgMjcwLjk1MCAxMDEsIDI4Mi41MDAgMTAzLjUyMCBDIDI5NC4wNTAgMTA2LjA0MCwgMzA5LjY5NSAxMDkuNDY1LCAzMTcuMjY2IDExMS4xMjkgQyAzMjQuODM3IDExMi43OTQsIDMzMS41MTQgMTEzLjk5NSwgMzMyLjEwNSAxMTMuNzk4IEMgMzMyLjY5NSAxMTMuNjAyLCAzMjEuMTAwIDExMC44MDQsIDMwNi4zMzkgMTA3LjU4MiBDIDI5MS41NzcgMTA0LjM2MCwgMjc1Ljc3MCAxMDAuODg1LCAyNzEuMjExIDk5Ljg2MiBDIDI2My45MDIgOTguMjIwLCAyNTcuNzExIDk3LjQ2MSwgMjYwLjUwMCA5OC41NDggTSAyMDUuNzMxIDExMiBDIDIwNC43MTAgMTE1LjYyOCwgMjA0LjgzOCAxNTQsIDIwNS44NzIgMTU0IEMgMjA3LjA3NiAxNTQsIDIwOC4xOTIgMTIxLjc2OSwgMjA3LjIyMyAxMTUgQyAyMDYuNTc2IDExMC40ODYsIDIwNi4zMDkgMTA5Ljk0OCwgMjA1LjczMSAxMTIgTSAyMTIuNzUwIDExMi41ODEgQyAyMTIuMzM4IDExMi45OTUsIDIxMiAxMTkuODczLCAyMTIgMTI3Ljg2NyBDIDIxMiAxMzcuODI0LCAyMTIuMzI0IDE0Mi4wNzYsIDIxMy4wMjkgMTQxLjM3MSBDIDIxMy42NjQgMTQwLjczNiwgMjEzLjk1MSAxMzQuOTAwLCAyMTMuNzc5IDEyNi4wODYgQyAyMTMuNjI1IDExOC4yNDQsIDIxMy4xNjIgMTEyLjE2NywgMjEyLjc1MCAxMTIuNTgxIE0gMjI0LjMyMCAxMjAgQyAyMjQuMzIwIDEyMy41NzUsIDIyNC41MDIgMTI1LjAzNywgMjI0LjcyMyAxMjMuMjUwIEMgMjI0Ljk0NSAxMjEuNDYzLCAyMjQuOTQ1IDExOC41MzcsIDIyNC43MjMgMTE2Ljc1MCBDIDIyNC41MDIgMTE0Ljk2MywgMjI0LjMyMCAxMTYuNDI1LCAyMjQuMzIwIDEyMCBNIDIzMC4wMTUgMTIwLjc1MCBDIDIzMC4wMDcgMTIzLjYzOCwgMjMwLjQ1MCAxMjYsIDIzMSAxMjYgQyAyMzIuMjc5IDEyNiwgMjMyLjI3OSAxMTguOTc5LCAyMzEgMTE3IEMgMjMwLjMwNiAxMTUuOTI2LCAyMzAuMDI2IDExNi45OTIsIDIzMC4wMTUgMTIwLjc1MCBNIDIxOS4yNzIgMTI2IEMgMjE5LjI3MiAxMjguNDc1LCAyMTkuNDY3IDEyOS40ODgsIDIxOS43MDYgMTI4LjI1MCBDIDIxOS45NDQgMTI3LjAxMywgMjE5Ljk0NCAxMjQuOTg3LCAyMTkuNzA2IDEyMy43NTAgQyAyMTkuNDY3IDEyMi41MTMsIDIxOS4yNzIgMTIzLjUyNSwgMjE5LjI3MiAxMjYgTSA0MjYuNDIxIDEzOC4zNDUgQyA0MjUuMDg1IDE0MS44MjcsIDQyNi40MDkgMTQ1LjUwMCwgNDI5IDE0NS41MDAgQyA0MzIuNjAyIDE0NS41MDAsIDQzMi44MzMgMTM3LjY4OSwgNDI5LjI0NiAxMzcuMTgwIEMgNDI3LjkzOCAxMzYuOTk0LCA0MjYuNzUyIDEzNy40ODMsIDQyNi40MjEgMTM4LjM0NSBNIDE2Ny40NTcgMTU3LjgwNCBDIDE1Ny42MDAgMTY0LjAwNSwgMTU1LjQ4OCAxNzQuMDcwLCAxNjIuNDEyIDE4MS44NDUgQyAxNjYuODc4IDE4Ni44NjAsIDE3NS40NDcgMTg4LjY4NCwgMTc5LjU1OSAxODUuNDk0IEMgMTgxLjM2OSAxODQuMDkwLCAxODEuMzExIDE4NC4wNTYsIDE3OC42ODUgMTg0Ljk5NCBDIDE3NC43MjUgMTg2LjQwOSwgMTcxLjMyMiAxODYuMjQ3LCAxNjcuNTY1IDE4NC40NjQgQyAxNjEuNzUwIDE4MS43MDUsIDE1Ny41OTIgMTcwLjg0NSwgMTYxLjc1MCAxNjkuMjc4IEMgMTY0LjgxNSAxNjguMTIzLCAxNzEuMzYxIDE2MywgMTY5Ljc3MiAxNjMgQyAxNjguOTMyIDE2MywgMTY3LjY4NSAxNjMuNjc1LCAxNjcgMTY0LjUwMCBDIDE2NS40NjEgMTY2LjM1NSwgMTYyIDE2Ni40NzYsIDE2MiAxNjQuNjc0IEMgMTYyIDE2MC4zOTAsIDE3MS45MzYgMTU2LjI2MSwgMTc4LjAzNiAxNTguMDEwIEMgMTgwLjQ0OSAxNTguNzAyLCAxODEuMDY0IDE1OC42NjQsIDE4MC4yNzAgMTU3Ljg3MCBDIDE3OC4xODAgMTU1Ljc4MCwgMTcwLjczNiAxNTUuNzQyLCAxNjcuNDU3IDE1Ny44MDQgTSAxODEuNTEzIDE2NC41MDcgQyAxNzIuMDUxIDE2Ny44NzcsIDE3Mi45NTAgMTc0LjM4OSwgMTgzLjI1NyAxNzcuMTQ2IEMgMTg5LjM3MyAxNzguNzgyLCAxODkuOTY4IDE3OC4wNTIsIDE4OS4yODMgMTY5Ljc1MCBDIDE4OC42NjIgMTYyLjIyMywgMTg4LjQwOCAxNjIuMDUyLCAxODEuNTEzIDE2NC41MDcgTSAyMTAuMzc4IDE3OS4zNjQgQyAyMTAuNjAwIDE4Mi4wNTUsIDIxMS42NTEgMTg1LjQwNiwgMjEyLjcyOSAxODYuODY0IEMgMjE0Ljk4MSAxODkuOTExLCAyMjIuNDM1IDE5NC4zNTcsIDIyNC4yNjAgMTkzLjc0MiBDIDIyNC45NDIgMTkzLjUxMiwgMjIzLjQzNCAxOTIuNDA4LCAyMjAuOTA4IDE5MS4yODggQyAyMTUuOTIxIDE4OS4wNzcsIDIxMi4wNDEgMTg0LjU2NSwgMjExLjkzMCAxODAuODQ2IEMgMjExLjg5MSAxNzkuNTU2LCAyMTEuNDM1IDE3Ny42MDAsIDIxMC45MTcgMTc2LjUwMCBDIDIxMC4yMjcgMTc1LjAzNSwgMjEwLjA4MyAxNzUuODAwLCAyMTAuMzc4IDE3OS4zNjQgTSAxNTEuNDI5IDE5OS44ODUgQyAxNTIuMTAzIDIwMC45NzYsIDE1OCAyMDEuOTI2LCAxNTggMjAwLjk0MyBDIDE1OCAyMDAuMjA3LCAxNTQuNDc5IDE5OS4wMzgsIDE1Mi4xOTEgMTk5LjAxNCBDIDE1MS40NzEgMTk5LjAwNiwgMTUxLjEyOCAxOTkuMzk4LCAxNTEuNDI5IDE5OS44ODUgTSAxMzguNDAzIDIwMy4xNTcgQyAxMzcuNDI3IDIwNC43MzYsIDEzNy42MjMgMjEzLjAyMywgMTM4LjY2MSAyMTQuMDYzIEMgMTM5LjEyMyAyMTQuNTI1LCAxMzkuNTAwIDIxMi4wMDEsIDEzOS41MDAgMjA4LjQ1NCBDIDEzOS41MDAgMjAxLjUxNiwgMTM5LjQ3OSAyMDEuNDE2LCAxMzguNDAzIDIwMy4xNTcgTSAyNjYgMjA3LjE1OSBDIDI3MC4xNDEgMjA5LjEyNCwgMjk4LjIxNCAyMjAuMDk5LCAzMDQgMjIyLjAxNiBDIDMwNS4zNzUgMjIyLjQ3MSwgMzExLjY3NSAyMjQuNzI0LCAzMTggMjI3LjAyMiBDIDMyNC4zMjUgMjI5LjMxOSwgMzMyLjIwMCAyMzIuMDA0LCAzMzUuNTAwIDIzMi45ODggQyAzMzguODAwIDIzMy45NzEsIDM1MC4yMjYgMjM3LjcyNSwgMzYwLjg5MiAyNDEuMzMwIEMgMzcxLjU1NyAyNDQuOTM1LCAzNzkuODgyIDI0Ny41MTEsIDM3OS4zOTIgMjQ3LjA1NCBDIDM3OC45MDEgMjQ2LjU5OCwgMzcxLjk3NSAyNDMuODk0LCAzNjQgMjQxLjA0NSBDIDM1Ni4wMjUgMjM4LjE5NiwgMzQ3LjEzNyAyMzQuOTk1LCAzNDQuMjUwIDIzMy45MzIgQyAzNDEuMzYzIDIzMi44NzAsIDMzNi42MzcgMjMxLjEyOSwgMzMzLjc1MCAyMzAuMDY0IEMgMjg4LjU0MiAyMTMuMzk2LCAyNTUuODM4IDIwMi4zMzksIDI2NiAyMDcuMTU5IE0gMTUxLjIwMCAyMTAuMjAwIEMgMTQ5LjU3NCAyMTEuODI2LCAxNDkuNjgzIDIxNC45NDEsIDE1MS4zODggMjE1LjU5NSBDIDE1Mi4xNTEgMjE1Ljg4OCwgMTUzLjA0MCAyMTcuNDQ5LCAxNTMuMzYzIDIxOS4wNjQgQyAxNTMuOTk2IDIyMi4yMzAsIDE1Ni40MTggMjIyLjkxNywgMTYwLjA2NiAyMjAuOTY1IEMgMTYyLjgxOSAyMTkuNDkxLCAxNjIuNDkwIDIxNy45MzIsIDE1OC40MjIgMjEzLjE4MCBDIDE1NC42ODIgMjA4LjgxMCwgMTUzLjIwMSAyMDguMTk5LCAxNTEuMjAwIDIxMC4yMDAgTSAxNzMuNTAwIDIxOC4yMDEgQyAxNzAuNzUwIDIxOS4zMjIsIDE2Ni41OTIgMjIxLjA4NiwgMTY0LjI2MSAyMjIuMTIwIEMgMTYxLjkyOSAyMjMuMTU0LCAxNTkuNTYxIDIyNCwgMTU4Ljk5NyAyMjQgQyAxNTguNDM0IDIyNCwgMTU3LjE5MSAyMjQuMzk3LCAxNTYuMjM2IDIyNC44ODMgQyAxNTUuMjgxIDIyNS4zNjksIDE1My4zNzUgMjI2LjIwOSwgMTUyIDIyNi43NTAgQyAxNTAuNjI1IDIyNy4yOTAsIDE0OC4zNzUgMjI4LjIwMCwgMTQ3IDIyOC43NzEgQyAxNDUuNjI1IDIyOS4zNDIsIDE0MC42NzUgMjMxLjI0NSwgMTM2IDIzMyBDIDEyNS43MjAgMjM2Ljg1OSwgMTI0LjIxMCAyMzcuNDM5LCAxMjEgMjM4Ljc2NSBDIDExOS42MjUgMjM5LjMzMywgMTE2LjkyNSAyNDAuMzM5LCAxMTUgMjQxIEMgMTEzLjA3NSAyNDEuNjYxLCAxMTAuNjAwIDI0Mi41NjMsIDEwOS41MDAgMjQzLjAwMyBDIDEwNy4wODcgMjQzLjk3MSwgOTkuODI5IDI0Ni42NjIsIDg2Ljc1MCAyNTEuNDM5IEMgODEuMzg4IDI1My4zOTcsIDcyLjYxMyAyNTYuNjAzLCA2Ny4yNTAgMjU4LjU2MSBDIDU0LjgzMyAyNjMuMDk2LCA0OC42MzYgMjY1LjM3OSwgNDMuMDE1IDI2Ny40ODkgQyA0MC41NDggMjY4LjQxNSwgMzUuMzczIDI3MC4yMzgsIDMxLjUxNSAyNzEuNTQwIEMgMTUuNTUxIDI3Ni45MjgsIDEyLjUyNyAyNzguNTQwLCAxMi4xOTEgMjgxLjgzOCBDIDExLjgwNCAyODUuNjQ3LCAxMy43MzEgMjg5LjQwMCwgMTguNjU0IDI5NC40MjYgQyAyMi40NTYgMjk4LjMwOCwgMjIuNDYyIDI5OC4zMjYsIDE5LjE4OSAyOTYuMDY0IEMgMTcuMzY3IDI5NC44MDYsIDE1LjM0NyAyOTIuOTI3LCAxNC42OTggMjkxLjg4OCBDIDEyLjU3NCAyODguNDg3LCA5Ljk5NyAyODkuNTEzLCAxMC4wMjIgMjkzLjc1MCBDIDEwLjA1OCAyOTkuODMwLCAxNC44MzUgMzA0LjExNiwgMzEuNTAwIDMxMy4wMjIgQyAzOC4wMDUgMzE2LjQ5OSwgNDUuMDg5IDMyMC40NTMsIDUyLjMwNCAzMjQuNjM2IEMgNTUuNDk2IDMyNi40ODYsIDU4LjI3MyAzMjgsIDU4LjQ3NSAzMjggQyA1OC42NzcgMzI4LCA2Mi43MzggMzMwLjI1MCwgNjcuNTAwIDMzMyBDIDcyLjI2MiAzMzUuNzUwLCA3Ni4zMjcgMzM4LCA3Ni41MzUgMzM4IEMgNzYuNzQyIDMzOCwgNzkuMjk0IDMzOS40MTMsIDgyLjIwNiAzNDEuMTQxIEMgODcuNzQ5IDM0NC40MjksIDkxLjU0MiAzNDYuNTYzLCAxMDEuNTAwIDM1MS45OTggQyAxMDQuODAwIDM1My43OTgsIDExMC40MjUgMzU2Ljk1NywgMTE0IDM1OS4wMTcgQyAxMTcuNTc1IDM2MS4wNzcsIDEyOC4xNTAgMzY3LjAxOCwgMTM3LjUwMCAzNzIuMjIwIEMgMTQ2Ljg1MCAzNzcuNDIxLCAxNTYuMzAwIDM4Mi43MTMsIDE1OC41MDAgMzgzLjk4MCBDIDE2My4zODYgMzg2Ljc5MywgMTY4LjYwMiAzODkuNjkyLCAxNzYuNTAwIDM5My45ODQgQyAxNzkuODAwIDM5NS43NzcsIDE4My44NTAgMzk4LjAzNCwgMTg1LjUwMCAzOTguOTk5IEMgMTg3LjE1MCAzOTkuOTYzLCAxOTAuNTI1IDQwMS44NzAsIDE5MyA0MDMuMjM1IEMgMTk1LjQ3NSA0MDQuNjAwLCAxOTkuMzAwIDQwNi43NDQsIDIwMS41MDAgNDA4IEMgMjAzLjcwMCA0MDkuMjU2LCAyMDcuNTI1IDQxMS40MDUsIDIxMCA0MTIuNzc3IEMgMjEyLjQ3NSA0MTQuMTQ5LCAyMTcuMTM3IDQxNi44MDAsIDIyMC4zNjEgNDE4LjY2OSBDIDIzMi42MTUgNDI1Ljc3NCwgMjM5LjEyNCA0MjUuMjQwLCAyNTUuNTAwIDQxNS43ODkgQyAyNjMuOTg5IDQxMC44ODksIDI2Ny45NzMgNDA4LjU5MiwgMjcyLjI1MCA0MDYuMTI4IEMgMjc0LjAzOCA0MDUuMDk5LCAyNzkuNzc1IDQwMS43ODgsIDI4NSAzOTguNzcxIEMgMjkwLjIyNSAzOTUuNzU0LCAyOTYuNTI1IDM5Mi4xNjAsIDI5OSAzOTAuNzg0IEMgMzAxLjQ3NSAzODkuNDA4LCAzMDUuMzAwIDM4Ny4yNTYsIDMwNy41MDAgMzg2IEMgMzA5LjcwMCAzODQuNzQ0LCAzMTMuNTI1IDM4Mi41OTIsIDMxNiAzODEuMjE2IEMgMzE4LjQ3NSAzNzkuODQwLCAzMjQuNjk4IDM3Ni4zMDMsIDMyOS44MjkgMzczLjM1NyBDIDMzNC45NjAgMzcwLjQxMSwgMzM5LjMxMiAzNjgsIDMzOS41MDAgMzY4IEMgMzM5LjY4OCAzNjgsIDM0NC4wNDAgMzY1LjU4OSwgMzQ5LjE3MSAzNjIuNjQzIEMgMzU0LjMwMiAzNTkuNjk3LCAzNjAuNTI1IDM1Ni4xNjAsIDM2MyAzNTQuNzg0IEMgMzY3LjQ4OCAzNTIuMjg5LCAzNzEuNjQ4IDM0OS45MjgsIDM3OC43NTAgMzQ1Ljg0MyBDIDM4MC44MTMgMzQ0LjY1NywgMzgzLjQwNSAzNDMuMTk1LCAzODQuNTEwIDM0Mi41OTMgQyA0MDcuMzM1IDMzMC4xODAsIDQxOSAzMjEuMTM2LCA0MTkgMzE1Ljg1MCBDIDQxOSAzMTMuOTg0LCA0MTQuNTYwIDMxMy4wNzEsIDQxMy44MzMgMzE0Ljc4NyBDIDQxMi43NjkgMzE3LjMwMCwgNDAwLjUxNSAzMjUuMDA3LCAzNzUgMzM5LjIxMiBDIDM3Mi41MjUgMzQwLjU5MCwgMzY4LjcwMCAzNDIuNzQ0LCAzNjYuNTAwIDM0NCBDIDM2NC4zMDAgMzQ1LjI1NiwgMzYwLjQ3NSAzNDcuNDA4LCAzNTggMzQ4Ljc4NCBDIDM1NS41MjUgMzUwLjE2MCwgMzQ5LjMwMiAzNTMuNjk3LCAzNDQuMTcxIDM1Ni42NDMgQyAzMzkuMDQwIDM1OS41ODksIDMzNC42MDkgMzYyLCAzMzQuMzI1IDM2MiBDIDMzNC4wNDEgMzYyLCAzMzIuNjE0IDM2Mi44MzEsIDMzMS4xNTQgMzYzLjg0NyBDIDMyOS42OTQgMzY0Ljg2MywgMzI2LjAyNSAzNjcuMDQ4LCAzMjMgMzY4LjcwMiBDIDMxNC42ODkgMzczLjI0NiwgMzA4LjE5MCAzNzYuODc5LCAzMDEgMzgxIEMgMjk3LjQyNSAzODMuMDQ5LCAyOTIuMjUwIDM4NS45NjQsIDI4OS41MDAgMzg3LjQ3OCBDIDI4Ni43NTAgMzg4Ljk5MiwgMjc3Ljc1MCAzOTQuMDY5LCAyNjkuNTAwIDM5OC43NjEgQyAyNDcuOTg5IDQxMC45OTMsIDIzNy45NjQgNDE2LCAyMzQuOTgzIDQxNiBDIDIzMi4zMTQgNDE2LCAyMjMuNDc5IDQxMi4xNDQsIDIxOSA0MDkuMDI1IEMgMjE3LjYyNSA0MDguMDY3LCAyMTMuODAwIDQwNS44MDMsIDIxMC41MDAgNDAzLjk5NCBDIDIwMS43NzAgMzk5LjIwOCwgMTU1LjQ2NCAzNzMuMzY5LCAxNDEuNzUwIDM2NS42MzAgQyAxMzUuMjg3IDM2MS45ODQsIDEyNC43MTMgMzU2LjA0MCwgMTE4LjI1MCAzNTIuNDIyIEMgMTExLjc4NyAzNDguODA0LCAxMDYuMDUwIDM0NS4zNjEsIDEwNS41MDAgMzQ0Ljc3MiBDIDEwNC45NTAgMzQ0LjE4MiwgMTA2Ljk3NSAzNDUuMDY2LCAxMTAgMzQ2LjczNiBDIDEyOS4wNjkgMzU3LjI2MiwgMTYyLjMwNyAzNzUuNzQ5LCAxNzIuNTAwIDM4MS40OTkgQyAyMTEuNDk3IDQwMy40OTcsIDIyNS41MzUgNDExLjA0MCwgMjI5LjQ5MCA0MTIuMTE4IEMgMjM3LjA2MSA0MTQuMTgzLCAyNDQuNTE0IDQxMS43MzgsIDI2Mi42MzggNDAxLjI0NyBDIDI2Ni40MTIgMzk5LjA2MiwgMjcxLjc1MCAzOTYuMDQ4LCAyNzQuNTAwIDM5NC41NTAgQyAyOTcuMzIyIDM4Mi4xMTUsIDMwNi4wNzUgMzc2LjUxOSwgMzA1Ljc5MyAzNzQuNTQ0IEMgMzA1LjM4NSAzNzEuNjk3LCAzMDEuOTYzIDM3MS40NjgsIDI5Ny4wNzcgMzczLjk2MSBDIDI5NC44MzUgMzc1LjEwNSwgMjkzIDM3NS44NDksIDI5MyAzNzUuNjE2IEMgMjkzIDM3NS4yNTAsIDI5NS41NjAgMzczLjY5OCwgMzA2LjUwMCAzNjcuNDI5IEMgMzQ1LjQ1MyAzNDUuMTA3LCAzNTIgMzQxLjA3NCwgMzUyIDMzOS4zOTcgQyAzNTIgMzM4LjU5MCwgMzQ5Ljg2MyAzMzYuOTgwLCAzNDcuMjUwIDMzNS44MjAgQyAzNDEuNjMzIDMzMy4zMjYsIDMzNC4zNTggMzMzLjA4MywgMzE5IDMzNC44NzQgQyAzMDguOTk0IDMzNi4wNDEsIDMwMy4yNzIgMzM2LjY0OSwgMjgwLjUwMCAzMzguOTcwIEMgMjc1IDMzOS41MzAsIDI2Ni4xNDggMzQwLjQ0MiwgMjYwLjgzMCAzNDAuOTk1IEMgMjU1LjUxMSAzNDEuNTQ4LCAyNDcuMjk4IDM0MiwgMjQyLjU4MCAzNDIgQyAyMjguOTkyIDM0MiwgMjMwLjA0NSAzNDQuMDE3LCAyNTUuMzcxIDM2Ni41MDkgQyAyNjcuNDcwIDM3Ny4yNTQsIDI3Ni4wNzEgMzgzLjIyMCwgMjc4LjcyOSAzODIuNzExIEMgMjgxLjg5OSAzODIuMTA2LCAyODEuNTkzIDM4Mi40ODksIDI3NyAzODQuODgzIEMgMjczIDM4Ni45NjgsIDI3MyAzODYuOTY4LCAyNzIuOTkxIDM4NC43MzQgQyAyNzIuOTg1IDM4My4xMTcsIDI3MS4zOTYgMzgxLjQ3NCwgMjY3LjI0MSAzNzguNzg2IEMgMjY0LjA4NCAzNzYuNzQzLCAyNTQuOTgxIDM2OC41MzAsIDI0Ny4wMTMgMzYwLjUzNiBDIDIzOS4wNDUgMzUyLjU0MSwgMjMxLjk1MCAzNDYsIDIzMS4yNDcgMzQ2IEMgMjI3LjQ3NCAzNDYsIDIyMiAzNDguNjA0LCAyMjIgMzUwLjM5OSBDIDIyMiAzNTQuMjUxLCAyNTEuOTI0IDM4Mi42NjUsIDI2Mi4wMjAgMzg4LjM5OSBDIDI2Ni4wOTAgMzkwLjcxMSwgMjY2LjA5MCAzOTAuNzExLCAyNjMuNTQ1IDM5Mi4zNzkgQyAyNjEuMTQyIDM5My45NTMsIDI2MSAzOTMuOTQ1LCAyNjEgMzkyLjIzNyBDIDI2MSAzOTEuMTM0LCAyNTYuNzIyIDM4Ny4wMDgsIDI1MC4wNDUgMzgxLjY3MSBDIDI0NC4wMjAgMzc2Ljg1NSwgMjM2LjAzMiAzNjkuNDY3LCAyMzIuMjk1IDM2NS4yNTQgQyAyMTMuNDcwIDM0NC4wMzIsIDIwOS4wNTggMzQwLCAyMDQuNjY0IDM0MCBDIDIwMi4yMjggMzQwLCAxNzQuMzQxIDMzMC45MTEsIDE3MC43NjQgMzI4Ljk1MSBDIDE2OS44MDkgMzI4LjQyOCwgMTY4LjM1OSAzMjgsIDE2Ny41NDMgMzI4IEMgMTY2LjcyNyAzMjgsIDE2My40NTggMzI2LjgyNiwgMTYwLjI4MCAzMjUuMzkyIEMgMTU3LjEwMSAzMjMuOTU4LCAxNTIuOTI1IDMyMi4wNzIsIDE1MSAzMjEuMjAzIEMgMTQ2LjY2NyAzMTkuMjQ1LCAxMzUuNDUwIDMxMi41OTEsIDEyMy4yMjQgMzA0LjcyNyBDIDExMi42NTUgMjk3LjkyOSwgMTEzLjE3MyAyOTcuOTY0LCA5OS4xODYgMzAzLjExNiBDIDk0LjYwMiAzMDQuODA0LCA5MC42NDAgMzA1Ljk3MywgOTAuMzgwIDMwNS43MTQgQyA5MC4xMjEgMzA1LjQ1NCwgOTQuMjA0IDMwMy41NzgsIDk5LjQ1NCAzMDEuNTQzIEMgMTA1LjA1OCAyOTkuMzcyLCAxMDkgMjk3LjI4MCwgMTA5IDI5Ni40NzcgQyAxMDkgMjk1LjcyNSwgMTA2Ljg2MyAyOTMuMTgxLCAxMDQuMjUwIDI5MC44MjQgQyA5Ni40NDYgMjgzLjc4MiwgODguNzQ4IDI3NS43MjYsIDg0LjU0NSAyNzAuMjAwIEMgNzkuMTgyIDI2My4xNTEsIDgxLjYzNCAyNjIuODIyLCA0OS45NTAgMjc0LjgzNyBDIDIwLjk3MCAyODUuODI3LCAyMC4zOTkgMjg2LjI1NywgMjcuNjkzIDI5MS42MDAgQyAzMy4xNTEgMjk1LjU5OSwgMzMuOTI0IDI5Ni40NDgsIDMwLjUwMCAyOTQuNjgwIEMgMjYuNDQzIDI5Mi41ODUsIDIyIDI4OC4yNjAsIDIyIDI4Ni40MDUgQyAyMiAyODQuNzM4LCAyNi42NDkgMjgyLjQ5NSwgNDMuNTAwIDI3Ni4wMzAgQyA0OS41NTAgMjczLjcwOSwgNjIuNjAwIDI2OC42NzAsIDcyLjUwMCAyNjQuODMyIEMgODIuNDAwIDI2MC45OTQsIDk1LjIyNSAyNTYuMDQ1LCAxMDEgMjUzLjgzMyBDIDEwNi43NzUgMjUxLjYyMiwgMTEyLjQwMCAyNDkuNDQwLCAxMTMuNTAwIDI0OC45ODQgQyAxMTYuMTI5IDI0Ny44OTYsIDE0My4wNjggMjM3LjQ3MiwgMTU5LjUwMCAyMzEuMTg0IEMgMTg0LjY4NSAyMjEuNTQ3LCAxODEuOTQwIDIyMS42NTgsIDIwMi40NTggMjI5LjQ1NSBDIDIxNi40MjQgMjM0Ljc2MywgMjIwIDIzNS4xOTIsIDIyMCAyMzEuNTU5IEMgMjIwIDIyOC40ODQsIDIyMC4zMTYgMjI4LjY2NiwgMjAzIDIyMS43NzYgQyAxODYuNjc2IDIxNS4yODEsIDE4Mi4wMzggMjE0LjcxOSwgMTczLjUwMCAyMTguMjAxIE0gMTc1Ljc1MCAyMjcuMzY3IEMgMTczLjQwOSAyMjkuMTc4LCAxNzMuNTMzIDIzMC4zNDYsIDE3Ni42MjQgMjM1LjYyMSBDIDE4MC40ODMgMjQyLjIwNiwgMTgyLjUwMCAyNDEuMzAyLCAxODIuNTAwIDIzMi45ODYgQyAxODIuNTAwIDIyNi43OTksIDE4Mi4zODUgMjI2LjQ4OSwgMTgwIDIyNi4yNTYgQyAxNzguNjI1IDIyNi4xMjMsIDE3Ni43MTMgMjI2LjYyMiwgMTc1Ljc1MCAyMjcuMzY3IE0gMTg2LjY4MyAyMjYuNzUwIEMgMTg2LjQ0NCAyMjcuMTYyLCAxODUuOTMxIDIzMi41MzYsIDE4NS41NDQgMjM4LjY5MiBDIDE4NC44MzkgMjQ5Ljg4NCwgMTg0LjgzOSAyNDkuODg0LCAxODkuMjcwIDI1OS4xOTIgQyAxOTEuNzA4IDI2NC4zMTEsIDE5NC4zMjAgMjcwLjIxNiwgMTk1LjA3NSAyNzIuMzEzIEMgMTk2LjczMiAyNzYuOTE3LCAxOTYuOTQwIDI3Ny4wODUsIDIwNC41MDAgMjc5LjkzNCBDIDIwNy44MDAgMjgxLjE3OCwgMjExLjQwMCAyODIuNTcyLCAyMTIuNTAwIDI4My4wMzIgQyAyMTMuNjAwIDI4My40OTIsIDIyMC44MDAgMjg2LjE4MSwgMjI4LjUwMCAyODkuMDA3IEMgMjM2LjIwMCAyOTEuODMzLCAyNDUuOTg4IDI5NS40NjIsIDI1MC4yNTAgMjk3LjA3MyBDIDI1NC41MTIgMjk4LjY4MywgMjYxLjcxMiAzMDEuMzkzLCAyNjYuMjUwIDMwMy4wOTUgQyAyNzAuNzg4IDMwNC43OTgsIDI3NS40MDAgMzA2LjU1NCwgMjc2LjUwMCAzMDYuOTk4IEMgMjc3LjYwMCAzMDcuNDQyLCAyODEuMjAwIDMwOC43OTMsIDI4NC41MDAgMzEwIEMgMjg3LjgwMCAzMTEuMjA3LCAyOTEuNDAwIDMxMi41NTMsIDI5Mi41MDAgMzEyLjk5MCBDIDMwMy43MTMgMzE3LjQ0OCwgMzA1Ljc5NCAzMTcuOTk4LCAzMTEuMzgzIDMxNy45ODIgQyAzMTcuNjQ2IDMxNy45NjMsIDMyNS41MTAgMzE2Ljc0NywgMzQ0IDMxMi45MzggQyAzNDkuNzc1IDMxMS43NDksIDM1Ni41MjUgMzEwLjQwMCwgMzU5IDMwOS45NDEgQyAzNzEuMDYzIDMwNy43MDQsIDM4NS40OTggMzAzLjM3MCwgMzg1Ljc4MSAzMDEuODk5IEMgMzg2LjQxOCAyOTguNTkzLCAzNzcuOTY2IDI5Ni44MTYsIDM3NC44ODEgMjk5LjYwOCBDIDM3Mi43MjMgMzAxLjU2MSwgMzY2LjUxNiAyOTkuNTY1LCAzMTUuNTAwIDI4MC41MTggQyAyOTcuMzUwIDI3My43NDEsIDI3OS4zNTAgMjY3LjA2MCwgMjc1LjUwMCAyNjUuNjcyIEMgMjcxLjY1MCAyNjQuMjgzLCAyNjQuOTAwIDI2MS44MTQsIDI2MC41MDAgMjYwLjE4NSBDIDI1Ni4xMDAgMjU4LjU1NiwgMjQ2LjY1MCAyNTUuMDkwLCAyMzkuNTAwIDI1Mi40ODMgQyAyMjQuMTU1IDI0Ni44ODksIDIyMy4xMTIgMjQ2LjI0NywgMjIwLjUwMCAyNDAuNzk2IEMgMjE4LjU0MiAyMzYuNzA5LCAyMTguMjA5IDIzNi41MTMsIDIwNC41MDAgMjMxLjM1NSBDIDE5MC41NjIgMjI2LjExMSwgMTg3LjUxMSAyMjUuMzIyLCAxODYuNjgzIDIyNi43NTAgTSAyMjcuMTYyIDIyOS41NDMgQyAyMjUuNzg4IDIzMi41NTksIDIyNS42NjQgMjM3LjkyMSwgMjI2LjkyMyAyMzkuOTEwIEMgMjI3LjUxMSAyNDAuODM5LCAyMjcuOTQzIDIzOC45NjUsIDIyOC4xODkgMjM0LjQxMCBDIDIyOC42MzEgMjI2LjIyOCwgMjI4LjY0NCAyMjYuMjkwLCAyMjcuMTYyIDIyOS41NDMgTSAxNjQuNzUwIDIzMS41NzIgQyAxNjEuMTkyIDIzMy41MDIsIDE2MS4yNzggMjM0LjU2OSwgMTY1LjU2NSAyNDEuNjI5IEMgMTcyLjM3MSAyNTIuODM5LCAxNzkuMTU0IDI2OC4xNjgsIDE4Ni45NzAgMjkwIEMgMTk0LjkwMCAzMTIuMTUyLCAxOTkuNjE3IDMyMS4zOTgsIDIwMy4yMDEgMzIxLjgxMiBDIDIxMC4yNzcgMzIyLjYyOCwgMjExLjU5OCAzMTguNTI2LCAyMDcuMDcwIDMwOS43OTcgQyAyMDMuOTAxIDMwMy42OTAsIDE5OS4wMjggMjkxLjA4NSwgMTk0LjAwNSAyNzYgQyAxOTEuMTUyIDI2Ny40MzUsIDE3OS4wMDcgMjQxLjQ3NCwgMTc0LjAwNSAyMzMuMjQ4IEMgMTcxLjc5OSAyMjkuNjIwLCAxNjkuMjExIDIyOS4xNTIsIDE2NC43NTAgMjMxLjU3MiBNIDQxNy41ODYgMjM0LjEzMiBDIDQxNy4zMDUgMjM1LjQzNCwgNDE2LjYyMiAyMzkuNjM2LCA0MTYuMDcwIDI0My40NjggQyA0MTQuOTI2IDI1MS4zOTgsIDQxMi41OTUgMjU1LjIzMiwgNDA4LjM5NCAyNTYuMDkzIEMgNDA1Ljk1MCAyNTYuNTk0LCA0MDUuNzgyIDI1Ni44MDgsIDQwNy4zMTQgMjU3LjQ3NCBDIDQxMi41NDggMjU5Ljc1MCwgNDE2Ljg0MCAyNTIuOTUyLCA0MTcuOTU1IDI0MC42MTYgQyA0MTguNjkzIDIzMi40NjAsIDQxOC41MzcgMjI5LjcyOCwgNDE3LjU4NiAyMzQuMTMyIE0gMTQ4LjUwMCAyMzcuNDcyIEMgMTQ1LjIwMCAyMzguNzc4LCAxMzIuNjAwIDI0My42MzcsIDEyMC41MDAgMjQ4LjI2OSBDIDEwMi42ODUgMjU1LjA4OSwgOTguNDQzIDI1Ny4wNzQsIDk4LjE5OSAyNTguNzAxIEMgOTcuNjIwIDI2Mi41NzcsIDEyNS45NjggMjg5LCAxMzAuNzA3IDI4OSBDIDEzMS43OTkgMjg5LCAxMzYuNDc0IDI4Ny42MTAsIDE0MS4wOTYgMjg1LjkxMSBDIDE0NS43MTggMjg0LjIxMiwgMTUwLjYyNSAyODIuNDUyLCAxNTIgMjgyIEMgMTU3LjY0MCAyODAuMTQ3LCAxNzEuMTY4IDI3NS4wMjcsIDE3My43NDEgMjczLjc3MiBDIDE3Ny44MTcgMjcxLjc4NCwgMTc3LjI0NyAyNjcuNDcxLCAxNzEuMjM0IDI1NC43OTMgQyAxNjEuNDA3IDIzNC4wNzUsIDE1OS45MjkgMjMyLjk0OSwgMTQ4LjUwMCAyMzcuNDcyIE0gMjMuMjc0IDI0NC4wOTMgQyAxNi41NDYgMjQ3LjQyNCwgMTIuODEzIDI1Ni4xMTcsIDE2LjAxNCAyNjEgQyAxNi43MTUgMjYyLjA2OSwgMTYuODIwIDI2MS41NzcsIDE2LjM4MSAyNTkuMjg3IEMgMTUuNTU2IDI1NC45ODUsIDE2LjQ3MyAyNTEuNzgwLCAxOS41ODkgMjQ4LjA3NyBDIDIyLjQxOSAyNDQuNzEzLCAyNy4zMzcgMjQzLjgyOSwgMjguMzYyIDI0Ni41MDAgQyAyOS4xOTggMjQ4LjY4MCwgMzEgMjQ4LjMzOCwgMzEgMjQ2IEMgMzEgMjQ0Ljc2OCwgMzEuNjcyIDI0My45OTQsIDMyLjc1MCAyNDMuOTg1IEMgMzQuMjQ2IDI0My45NzIsIDM0LjI4MiAyNDMuODI4LCAzMyAyNDMgQyAzMC42NzcgMjQxLjQ5OSwgMjcuODgwIDI0MS44MTMsIDIzLjI3NCAyNDQuMDkzIE0gMjg3IDI0My44MzEgQyAyODcuODI1IDI0NC4zNDEsIDI4OS42MjUgMjQ1LjA1OSwgMjkxIDI0NS40MjcgQyAyOTIuNzM3IDI0NS44OTIsIDI5My4wNDIgMjQ1LjgxMywgMjkyIDI0NS4xNjkgQyAyOTEuMTc1IDI0NC42NTksIDI4OS4zNzUgMjQzLjk0MSwgMjg4IDI0My41NzMgQyAyODYuMjYzIDI0My4xMDgsIDI4NS45NTggMjQzLjE4NywgMjg3IDI0My44MzEgTSAzNS4wMDggMjQ0LjcxNSBDIDM1LjAxMiAyNDUuMTQ3LCAzNi4xMzggMjQ2LjAyMCwgMzcuNTA5IDI0Ni42NTYgQyAzOC44ODAgMjQ3LjI5MywgMzkuNzUyIDI0Ny40MDcsIDM5LjQ0NiAyNDYuOTEyIEMgMzguNjMwIDI0NS41OTMsIDM0Ljk5OSAyNDMuNzk1LCAzNS4wMDggMjQ0LjcxNSBNIDI5NSAyNDYuODMxIEMgMjk1LjgyNSAyNDcuMzQxLCAyOTcuNjI1IDI0OC4wNTksIDI5OSAyNDguNDI3IEMgMzAwLjczNyAyNDguODkyLCAzMDEuMDQyIDI0OC44MTMsIDMwMCAyNDguMTY5IEMgMjk5LjE3NSAyNDcuNjU5LCAyOTcuMzc1IDI0Ni45NDEsIDI5NiAyNDYuNTczIEMgMjk0LjI2MyAyNDYuMTA4LCAyOTMuOTU4IDI0Ni4xODcsIDI5NSAyNDYuODMxIE0gNDY3Ljk5OCAyNTIuNjc0IEMgNDY1LjgxMyAyNTUuNTk0LCA0NjIuMjQ5IDI1OC41OTIsIDQ1OC41MDAgMjYwLjY2MiBDIDQ1NS4yMDAgMjYyLjQ4NSwgNDUzLjA4NSAyNjMuOTgyLCA0NTMuODAwIDI2My45ODggQyA0NTcuNjAzIDI2NC4wMjMsIDQ2Ny45NjcgMjU1Ljg5OCwgNDcwLjU5MCAyNTAuODI1IEMgNDcyLjY0NiAyNDYuODUwLCA0NzIuMDI2IDI0Ny4yOTIsIDQ2Ny45OTggMjUyLjY3NCBNIDEyMS41MDAgMjUzLjE2NCBDIDExNy4xMDAgMjU0Ljg2MywgMTEzLjA1MCAyNTYuNjc5LCAxMTIuNTAwIDI1Ny4xOTkgQyAxMTEuNTE0IDI1OC4xMzIsIDEyMS4xODUgMjU0LjcwMywgMTI4IDI1MS43MDQgQyAxMzQuMTg2IDI0OC45ODEsIDEyOS43NjAgMjQ5Ljk3NSwgMTIxLjUwMCAyNTMuMTY0IE0gODYuMjUwIDI2MS4yMjAgQyA4NC43NTIgMjYxLjk0MywgODQgMjYzLjE5NSwgODQgMjY0Ljk2NyBDIDg0IDI3MC45MTAsIDEwNi41NTEgMjkzLjE1NCwgMTIxLjUwMCAzMDEuOTU2IEMgMTMyLjY2NiAzMDguNTMxLCAxNDkuMjMxIDMxOCwgMTQ5LjU2OCAzMTggQyAxNDkuNzc4IDMxOCwgMTUyLjc3NCAzMTkuMjg5LCAxNTYuMjI1IDMyMC44NjUgQyAxNjIuNTgzIDMyMy43NjcsIDE3OS4zNTYgMzI5LjkwOSwgMTg4LjUwMCAzMzIuNjgyIEMgMTkxLjI1MCAzMzMuNTE2LCAxOTQuNTM0IDMzNC42MDQsIDE5NS43OTcgMzM1LjA5OSBDIDIwMS4zNjIgMzM3LjI4MiwgMjAzLjAwMSAzMzYuNDA0LCAyMDIuOTg1IDMzMS4yNTAgQyAyMDIuOTY1IDMyNS4wMTIsIDIwMi40MjUgMzI0LjM1MCwgMTk1Ljk2OCAzMjIuNjQxIEMgMTkwLjM4OSAzMjEuMTY1LCAxODIuMDk2IDMxOC41MzUsIDE3OC41MDAgMzE3LjEwMyBDIDE3Ny40MDAgMzE2LjY2NCwgMTY4Ljk2MCAzMTIuNjIyLCAxNTkuNzQ2IDMwOC4xMjAgQyAxMzUuOTUwIDI5Ni40OTQsIDEyMS4yNjkgMjg2LjQ2NCwgMTA2LjY1NCAyNzEuODQ3IEMgOTQuMDk0IDI1OS4yODYsIDkyLjI1MiAyNTguMzI2LCA4Ni4yNTAgMjYxLjIyMCBNIDUzLjcxMSAyNzguNjgzIEMgNDkuOTc3IDI4MC4wOTgsIDQ3LjEwNiAyODEuNDM5LCA0Ny4zMzAgMjgxLjY2MyBDIDQ3Ljg0OCAyODIuMTgxLCA1OS4xODIgMjc4LjA0NiwgNjAuNDUwIDI3Ni44NzcgQyA2MS43NTYgMjc1LjY3MiwgNjEuNDI2IDI3NS43NjAsIDUzLjcxMSAyNzguNjgzIE0gMTY1LjUwMCAyNzkuMTc1IEMgMTU1Ljc1NCAyODIuNzkxLCAxNDIuNDkyIDI4Ny44NDAsIDEzOC43MTcgMjg5LjM3MSBDIDEzMi44NjUgMjkxLjc0NCwgMTM1LjI5OSAyOTMuODY4LCAxNTUuNTAwIDMwNC4wMTggQyAxODAuNDExIDMxNi41MzUsIDE5My45MDggMzIwLjk2MywgMTk0Ljc1NiAzMTYuODk3IEMgMTk0Ljk0MCAzMTYuMDE1LCAxOTMuNTI1IDMxMS45NjUsIDE5MS42MTMgMzA3Ljg5NyBDIDE4OC43NzYgMzAxLjg2MywgMTgyLjg0MSAyODYuMDQzLCAxODAuMzAyIDI3Ny43NTAgQyAxNzkuNTI4IDI3NS4yMjEsIDE3NC45NzMgMjc1LjY1OSwgMTY1LjUwMCAyNzkuMTc1IE0gMzI4IDI3OC45MzAgQyAzMzAuMTYzIDI4MC4xODQsIDM0NC44MTUgMjg1LjAxMCwgMzQ2LjI3MSAyODQuOTQ4IEMgMzQ2Ljk0NyAyODQuOTE5LCAzNDMuMjgyIDI4My4zNDQsIDMzOC4xMjcgMjgxLjQ0OCBDIDMyOS4xODEgMjc4LjE1NywgMzI0Ljc3OCAyNzcuMDYzLCAzMjggMjc4LjkzMCBNIDM2OS43NDEgMjgxLjMzMiBDIDM2OS4zMzMgMjgyLjMzOSwgMzY5LjAxNCAyODQuMTM5LCAzNjkuMDMwIDI4NS4zMzIgQyAzNjkuMDU4IDI4Ny4zMDgsIDM2OS4xNTMgMjg3LjM0MiwgMzcwLjA5NiAyODUuNzIxIEMgMzcwLjY2NiAyODQuNzQzLCAzNzAuOTg1IDI4Mi45NDMsIDM3MC44MDcgMjgxLjcyMSBDIDM3MC41MTQgMjc5LjcyMSwgMzcwLjQwOCAyNzkuNjgyLCAzNjkuNzQxIDI4MS4zMzIgTSAyMDAuMDA3IDI4NC4yNTAgQyAyMDAuMDE4IDI4Ny41MjIsIDIwNS42MDggMzAzLjM2NCwgMjA5LjY0OCAzMTEuNTc0IEMgMjEzLjAzNCAzMTguNDUyLCAyMTMuMzI4IDMxOC43NDEsIDIyMC4zMTUgMzIyLjAzNyBDIDIyOS4zMTIgMzI2LjI4MSwgMjQwLjIzNiAzMjYuOTMzLCAyNjIgMzI0LjUyNyBDIDI2OS45NzUgMzIzLjY0NSwgMjgwLjY5MSAzMjIuNTAwLCAyODUuODE0IDMyMS45ODIgQyAyOTAuOTM2IDMyMS40NjMsIDI5NS41NDkgMzIwLjc3OSwgMjk2LjA2NCAzMjAuNDYxIEMgMjk3LjYxOSAzMTkuNTAwLCAyOTcuMTE2IDMxNi45NzUsIDI5NS4yNTAgMzE2LjM3MiBDIDI5Mi45MjkgMzE1LjYyMywgMjcwLjcwMiAzMDcuMTk3LCAyNDEuNTAwIDI5NS45OTYgQyAyMjkuNDQyIDI5MS4zNzEsIDIxNi4yOTMgMjg2LjM4MSwgMjA5LjUxNCAyODMuODU3IEMgMjAyLjYzOCAyODEuMjk2LCAxOTkuOTk4IDI4MS40MDUsIDIwMC4wMDcgMjg0LjI1MCBNIDM3Ni4zMzIgMjkwLjU3OCBDIDM3NS4zODIgMjkzLjA1MywgMzc3LjY1NiAyOTQuNTE0LCAzOTAuMzA0IDI5OS41NTEgQyA0MDIuMjUzIDMwNC4zMDksIDQwNSAzMDUuOTk0LCA0MDUgMzA4LjU2MyBDIDQwNSAzMTEuNTkwLCAzOTcuMjA5IDMxNy4xNjEsIDM3OC41MDAgMzI3LjUxMyBDIDM3NS43NTAgMzI5LjAzNCwgMzcxLjQ3NSAzMzEuMzk3LCAzNjkgMzMyLjc2MyBDIDM2Ni41MjUgMzM0LjEyOSwgMzYzLjE1MCAzMzYuMDM2LCAzNjEuNTAwIDMzNyBDIDM1OS44NTAgMzM3Ljk2NCwgMzU2LjQ3NSAzMzkuODcxLCAzNTQgMzQxLjIzOSBDIDM0My44MDQgMzQ2Ljg3MiwgMzA4LjQwNSAzNjcuMzM1LCAzMDcuMjAyIDM2OC4yOTIgQyAzMDYuNDg4IDM2OC44NjAsIDMwNi4wMzggMzcwLjI2NCwgMzA2LjIwMiAzNzEuNDEyIEMgMzA2LjYxNCAzNzQuMjk1LCAzMTAuMzMyIDM3NC42MTIsIDMxMy45MDMgMzcyLjA2OSBDIDMxNS41MDEgMzcwLjkzMSwgMzE3LjA4NSAzNzAsIDMxNy40MjIgMzcwIEMgMzE3Ljc2MCAzNzAsIDMyMC45OTkgMzY4LjIwMCwgMzI0LjYyMCAzNjYgQyAzMjguMjQyIDM2My44MDAsIDMzMS4zMTcgMzYyLCAzMzEuNDU1IDM2MiBDIDMzMS41OTMgMzYyLCAzNDEuOTQ2IDM1Ni4xNTAsIDM1NC40NjIgMzQ5IEMgMzY2Ljk3OCAzNDEuODUwLCAzNzcuNDM3IDMzNiwgMzc3LjcwNSAzMzYgQyAzNzcuOTcyIDMzNiwgMzc5LjM4NiAzMzUuMTY3LCAzODAuODQ2IDMzNC4xNDkgQyAzODIuMzA2IDMzMy4xMzEsIDM4Ny4xMDAgMzMwLjM2MSwgMzkxLjUwMCAzMjcuOTk0IEMgNDA2LjU5NCAzMTkuODc0LCA0MTYgMzEyLjA1OCwgNDE2IDMwNy42MzYgQyA0MTYgMzA0LjI1MCwgNDEyLjA4MCAzMDAuODMxLCA0MDUuMzQzIDI5OC4zNDAgQyAzNzcuODM3IDI4OC4xNzAsIDM3Ny4zMTAgMjg4LjAyOSwgMzc2LjMzMiAyOTAuNTc4IE0gNDEgMzAwLjQ0OSBDIDQxIDMwMC43MjQsIDQyLjM1MCAzMDEuNjQ3LCA0NCAzMDIuNTAwIEMgNDUuNjUwIDMwMy4zNTMsIDQ3IDMwMy44MjYsIDQ3IDMwMy41NTEgQyA0NyAzMDMuMjc2LCA0NS42NTAgMzAyLjM1MywgNDQgMzAxLjUwMCBDIDQyLjM1MCAzMDAuNjQ3LCA0MSAzMDAuMTc0LCA0MSAzMDAuNDQ5IE0gMzc5IDMwNy4xNTYgQyAzNjYuNzUyIDMxMS4xNDUsIDM2My42MDQgMzExLjk5MCwgMzUzLjUwMCAzMTQgQyAzNTAuNzUwIDMxNC41NDcsIDM0Ni40NzUgMzE1LjQ0NywgMzQ0IDMxNiBDIDMzOC4wNjQgMzE3LjMyNiwgMzI5LjkwMSAzMTguODczLCAzMjIuNTAwIDMyMC4wNzQgQyAzMTYuODM1IDMyMC45OTMsIDMxMS4yMDQgMzIxLjcwNCwgMjkxLjc1MCAzMjMuOTU1IEMgMjg3LjIxMiAzMjQuNDgwLCAyNzkuNjc1IDMyNS40MjUsIDI3NSAzMjYuMDU2IEMgMjcwLjMyNSAzMjYuNjg2LCAyNTguODUwIDMyNy40OTQsIDI0OS41MDAgMzI3Ljg1MSBDIDIzMi41MDAgMzI4LjUwMCwgMjMyLjUwMCAzMjguNTAwLCAyMzIuNjEyIDMzMi4yMzIgQyAyMzIuODIwIDMzOS4xMTYsIDIzMy41MTYgMzM5LjM2NCwgMjUwLjQ4NiAzMzguNTkxIEMgMjU4Ljc0NCAzMzguMjE2LCAyNjguNDI1IDMzNy41MDQsIDI3MiAzMzcuMDA5IEMgMjc4LjM1NyAzMzYuMTMwLCAyODguODAxIDMzNS4xMjYsIDMxNCAzMzIuOTcxIEMgMzIwLjg3NSAzMzIuMzgzLCAzMjguNTI1IDMzMS41MDgsIDMzMSAzMzEuMDI3IEMgMzMzLjQ3NSAzMzAuNTQ1LCAzMzguNDI1IDMyOS42MzMsIDM0MiAzMjkgQyAzNTcuNjAxIDMyNi4yMzgsIDM5MS4yMzEgMzE2LjQ2MSwgMzk5LjI1MCAzMTIuMzU2IEMgNDAyLjQ5MCAzMTAuNjk4LCA0MDIuOTM5IDMwNy4wNjgsIDQwMC4xMjMgMzA1LjMwOSBDIDM5NS44NzggMzAyLjY1OCwgMzkxLjY4NyAzMDMuMDI0LCAzNzkgMzA3LjE1NiBNIDEyLjY2NyAzMDYuNjY3IEMgMTEuNTAwIDMwNy44MzMsIDExLjkxNiAzNDUuNDUwLCAxMy4xMzYgMzQ5LjEwMSBDIDE1LjU4OSAzNTYuNDQxLCAyMC42ODkgMzYwLjAzMSwgNjIgMzgzLjUwNCBDIDc4LjIyNSAzOTIuNzIzLCA5NS4yMTkgNDAyLjQ1NiwgOTkuNzY0IDQwNS4xMzMgQyAxMDQuMzA5IDQwNy44MTAsIDEwOC4yNTUgNDEwLCAxMDguNTM0IDQxMCBDIDEwOC44MTIgNDEwLCAxMTAuNzE4IDQxMS4wNTMsIDExMi43NzAgNDEyLjM0MSBDIDExNC44MjEgNDEzLjYyOSwgMTE4LjUyNSA0MTUuODE1LCAxMjEgNDE3LjIwMCBDIDEyNi43NTIgNDIwLjQxOCwgMTMxLjAyMiA0MjIuODY0LCAxMzguNTAwIDQyNy4yMjggQyAxNDEuODAwIDQyOS4xNTMsIDE0Ni41MjUgNDMxLjg1MSwgMTQ5IDQzMy4yMjMgQyAxNTMuNjUwIDQzNS44MDEsIDE1OC42MTkgNDM4LjYyMSwgMTY0LjI1MCA0NDEuODgxIEMgMTc2LjcyNCA0NDkuMTAzLCAyMDIuNjA5IDQ2My44MTgsIDIwOCA0NjYuNzUyIEMgMjExLjU3NSA0NjguNjk4LCAyMTQuOTUwIDQ3MC42MjcsIDIxNS41MDAgNDcxLjAzOSBDIDIxNi4wNTAgNDcxLjQ1MCwgMjE4LjE4OCA0NzIuNzM1LCAyMjAuMjUwIDQ3My44OTMgQyAyMjIuMzEzIDQ3NS4wNTIsIDIyNS42NDcgNDc2LjkzMywgMjI3LjY2MSA0NzguMDczIEMgMjMwLjM2NyA0NzkuNjA2LCAyMzMuMTgzIDQ4MC4xNjYsIDIzOC40NTYgNDgwLjIyMSBDIDI0Ni42MzYgNDgwLjMwNSwgMjU3Ljc4MyA0NzYuMDM0LCAyNzQuNTAwIDQ2Ni40MTAgQyAyODMuNTAwIDQ2MS4yMjksIDI4My41MDAgNDYxLjIyOSwgMjg0IDQ1MS42MjkgQyAyODQuNDkwIDQ0Mi4yMjQsIDI4NC41NzEgNDQxLjk2MywgMjg3Ljk3NyA0MzguNzY1IEMgMjkxLjMxOSA0MzUuNjI4LCAyOTEuMzQ4IDQzNS42MTksIDI4OC43MjcgNDM4LjU1NSBDIDI4Ni4yNTYgNDQxLjMyMiwgMjg2IDQ0Mi4zMzYsIDI4NiA0NDkuMzM2IEMgMjg2IDQ1OS4xMTQsIDI4Ni42MjAgNDU5LjM4MSwgMjk2LjY4NCA0NTMuOTMzIEMgMzA4LjA0MiA0NDcuNzg1LCAzMTAgNDQ2LjIzNSwgMzEwIDQ0My4zOTMgQyAzMTAgNDM4LjAwOCwgMzE2Ljc0NiA0MzMuMTU5LCAzNDQuOTgwIDQxOC4yNDggQyAzNDkuNjY2IDQxNS43NzMsIDM1My45NTAgNDEzLjQxNywgMzU0LjUwMCA0MTMuMDEyIEMgMzU2Ljk5MyA0MTEuMTc3LCAzNjEuMTg4IDQxMC45OTgsIDM2My45MTcgNDEyLjYxMCBDIDM2Ny4zNjcgNDE0LjY0OCwgMzY5LjczOCA0MTQuMTMyLCAzNzcgNDA5Ljc2NCBDIDM4Mi41MDAgNDA2LjQ1NSwgMzgyLjUwMCA0MDYuNDU1LCAzODIuNTAwIDM5OS42OTEgQyAzODIuNTAwIDM4Ny43MDgsIDM4MC4zNzMgMzg3LjkxNCwgMzUzLjUwMCA0MDIuNTAyIEMgMzUwLjIwMCA0MDQuMjkzLCAzNDMuNDUwIDQwNy44OTIsIDMzOC41MDAgNDEwLjQ5OSBDIDMzMC4zMTUgNDE0LjgwOSwgMzI2LjkwOSA0MTYuNjUxLCAzMTQuNTAwIDQyMy40NzcgQyAzMDEuNTIxIDQzMC42MTcsIDI5NC44MTMgNDMzLjk0MSwgMjk3IDQzMi4xNDggQyAyOTkuNjIwIDQyOS45OTksIDMxMC42NTAgNDIzLjM0MiwgMzIwIDQxOC4yNjUgQyAzMzUuMjEyIDQxMC4wMDQsIDMzNy43MjUgNDA4LjYyNCwgMzQwLjUwMCA0MDcuMDAxIEMgMzU4Ljc4OCAzOTYuMzA5LCAzNzYuMTA4IDM4OCwgMzgwLjExMCAzODggQyAzODIuNzI2IDM4OCwgMzg0Ljc2OSAzOTEuNjUwLCAzODUuNTY5IDM5Ny43NTAgQyAzODYuNDY0IDQwNC41NzEsIDM4Ny4wMzQgNDA0LjUyMCwgNDAwIDM5Ni40NjcgQyA0MTYuOTUxIDM4NS45NDAsIDQxNy4wNTQgMzg1LjczMSwgNDE4Ljk0OSAzNTggQyA0MjEuMDgyIDMyNi43OTEsIDQyMC4yNzcgMzIwLjAyOSwgNDE1LjExNyAzMjUuODEzIEMgNDEyLjc3NCAzMjguNDQwLCA0MDUuOTU4IDMzMi44NjMsIDM5NCAzMzkuNTE2IEMgMzg4LjIyNSAzNDIuNzMwLCAzODAuMjQ1IDM0Ny4zMDMsIDM3Ni4yNjcgMzQ5LjY3OSBDIDM3Mi4yODkgMzUyLjA1NiwgMzY4Ljg0NyAzNTQsIDM2OC42MTkgMzU0IEMgMzY4LjM5MSAzNTQsIDM2NS4zNDYgMzU1LjcyNSwgMzYxLjg1MiAzNTcuODM0IEMgMzU4LjM1OCAzNTkuOTQzLCAzNTMuMDI1IDM2My4wMjcsIDM1MCAzNjQuNjg3IEMgMzQzLjQxNyAzNjguMzAwLCAzMzkuMjc2IDM3MC42NjcsIDMzMi4yMDYgMzc0Ljg2MCBDIDMyOS4yOTQgMzc2LjU4NywgMzI2LjcyNyAzNzgsIDMyNi41MDAgMzc4IEMgMzI2LjI3MyAzNzgsIDMyMy43MDYgMzc5LjQxMywgMzIwLjc5NCAzODEuMTQwIEMgMzE0LjU2MSAzODQuODM2LCAzMTAuMTY3IDM4Ny4zNTgsIDMwNCAzOTAuNzc5IEMgMzAxLjUyNSAzOTIuMTUxLCAyOTYuNTc1IDM5NC45NTEsIDI5MyAzOTcuMDAxIEMgMjg5LjQyNSAzOTkuMDUxLCAyODQuMDI1IDQwMi4wNzcsIDI4MSA0MDMuNzI1IEMgMjY4LjIxMSA0MTAuNjkzLCAyNjMuMjQ5IDQxMy40MTgsIDI1OSA0MTUuODAzIEMgMjUxLjM2MCA0MjAuMDkyLCAyNDMuMDM4IDQyNCwgMjQxLjU0MyA0MjQgQyAyNDAuNzU5IDQyNCwgMjM5Ljg0MCA0MjQuNDUwLCAyMzkuNTAwIDQyNSBDIDIzOC4wMTEgNDI3LjQxMCwgMjI5LjgxMCA0MjYuMDI1LCAyMjIuNjMyIDQyMi4xNTEgQyAyMTAuMTc4IDQxNS40MzAsIDIwMy41MzAgNDExLjczNSwgMjAyLjUwMCA0MTAuOTYxIEMgMjAxLjUzNiA0MTAuMjM2LCAxOTkuNTIxIDQwOS4xMDgsIDE4Ni41MDAgNDAyLjAwMiBDIDE4My4yMDAgNDAwLjIwMiwgMTc3LjU3NSAzOTcuMDUwLCAxNzQgMzk1IEMgMTcwLjQyNSAzOTIuOTUwLCAxNjQuODAwIDM4OS43ODgsIDE2MS41MDAgMzg3Ljk3NCBDIDE1OC4yMDAgMzg2LjE2MCwgMTQ4LjUyNSAzODAuNzcyLCAxNDAgMzc2IEMgMTMxLjQ3NSAzNzEuMjI4LCAxMjEuODAwIDM2NS44MzcsIDExOC41MDAgMzY0LjAyMCBDIDExNS4yMDAgMzYyLjIwMywgMTA4IDM1OC4xNDUsIDEwMi41MDAgMzU1LjAwMSBDIDk3IDM1MS44NTgsIDkwLjQ3NSAzNDguMTYwLCA4OCAzNDYuNzgzIEMgNzYuMTg4IDM0MC4yMTEsIDcxLjg4OSAzMzcuNzc5LCA0OS41MDAgMzI1IEMgMTIuOTU2IDMwNC4xNDIsIDE0LjQ0OSAzMDQuODg1LCAxMi42NjcgMzA2LjY2NyBNIDgyLjUwMCAzMDguMDcyIEMgODAuMzAwIDMwOS4xMzAsIDc5LjYyNSAzMDkuNzE2LCA4MSAzMDkuMzc0IEMgODQuNzYzIDMwOC40MzksIDg5LjcxMSAzMDYuMTY0LCA4OCAzMDYuMTU2IEMgODcuMTc1IDMwNi4xNTIsIDg0LjcwMCAzMDcuMDE0LCA4Mi41MDAgMzA4LjA3MiBNIDcyLjA1MSAzMTEuNjY2IEMgNzAuMTUzIDMxMi40OTIsIDY3LjM0MSAzMTIuOTgzLCA2NS44MDEgMzEyLjc1NyBDIDYyLjA5MSAzMTIuMjEzLCA2Mi4yMTIgMzEyLjM4OCwgNjcuNjI2IDMxNS40MTUgQyA3My4yMTUgMzE4LjUzOCwgNzIuODIzIDMxOC41MjcsIDcyLjI1NCAzMTUuNTQ3IEMgNzEuODY3IDMxMy41MjMsIDcyLjM3MyAzMTIuODM3LCA3NS4xNDIgMzExLjYyOCBDIDc2Ljk4OSAzMTAuODIyLCA3Ny44MjUgMzEwLjE2MywgNzcgMzEwLjE2MyBDIDc2LjE3NSAzMTAuMTYzLCA3My45NDggMzEwLjgzOSwgNzIuMDUxIDMxMS42NjYgTSA3NCAzMTguNDQ5IEMgNzQgMzE4LjcyNCwgNzUuMzUwIDMxOS42NDcsIDc3IDMyMC41MDAgQyA3OC42NTAgMzIxLjM1MywgODAgMzIxLjgyNiwgODAgMzIxLjU1MSBDIDgwIDMyMS4yNzYsIDc4LjY1MCAzMjAuMzUzLCA3NyAzMTkuNTAwIEMgNzUuMzUwIDMxOC42NDcsIDc0IDMxOC4xNzQsIDc0IDMxOC40NDkgTSAzNTMuNDEyIDMyMC45NzEgQyAzNTIuMjY0IDMyMS40MzYsIDM0OC43NzAgMzIyLjEzNSwgMzQ1LjY0OSAzMjIuNTI1IEMgMzQyLjUyNyAzMjIuOTE1LCAzMzkuNjkwIDMyMy42OTIsIDMzOS4zNDQgMzI0LjI1MiBDIDMzOC45MzIgMzI0LjkyMCwgMzQwLjIyNiAzMjUuMDQyLCAzNDMuMTA4IDMyNC42MDkgQyAzNDguNjA3IDMyMy43ODEsIDM2MC4yMDQgMzIwLjE5MiwgMzU3LjUwMCAzMjAuMTU1IEMgMzU2LjQwMCAzMjAuMTM5LCAzNTQuNTYwIDMyMC41MDcsIDM1My40MTIgMzIwLjk3MSBNIDgxIDMyMi40NDkgQyA4MSAzMjIuNzI0LCA4Mi4zNTAgMzIzLjY0NywgODQgMzI0LjUwMCBDIDg1LjY1MCAzMjUuMzUzLCA4NyAzMjUuODI2LCA4NyAzMjUuNTUxIEMgODcgMzI1LjI3NiwgODUuNjUwIDMyNC4zNTMsIDg0IDMyMy41MDAgQyA4Mi4zNTAgMzIyLjY0NywgODEgMzIyLjE3NCwgODEgMzIyLjQ0OSBNIDIwNS44ODcgMzI0LjExMyBDIDIwMS41MjMgMzI4LjQ3NywgMjA2LjY0MSAzMzkuNTM0LCAyMTQuOTc1IDM0My43NTAgQyAyMjcuNjYyIDM1MC4xNjcsIDIzNi41NzYgMzQyLjExNSwgMjI5LjEwNCAzMzAuOTg4IEMgMjIzLjQyMCAzMjIuNTI1LCAyMTEuMTE4IDMxOC44ODIsIDIwNS44ODcgMzI0LjExMyBNIDM2OS41MDAgMzI0LjkzOCBDIDM2Ni4yNTkgMzI2LjIzOCwgMzYwLjg5NiAzMjcuNzczLCAzNTQuNzUwIDMyOS4xNTggQyAzNDkuODUzIDMzMC4yNjMsIDM0OSAzMzAuNzg2LCAzNDkgMzMyLjY4OSBDIDM0OSAzMzUuNjUzLCAzNTUuOTYxIDMzNy43OTQsIDM1OS44NDUgMzM2LjAyNSBDIDM2Ni40MDQgMzMzLjAzNiwgMzc2IDMyNi43NTksIDM3NiAzMjUuNDU2IEMgMzc2IDMyMy44NzEsIDM3Mi43OTUgMzIzLjYxNiwgMzY5LjUwMCAzMjQuOTM4IE0gODggMzI2LjQ2NiBDIDg4IDMyNi43NDEsIDkwLjI1MCAzMjguMTA2LCA5MyAzMjkuNTAwIEMgOTUuNzUwIDMzMC44OTQsIDk4IDMzMS44MDksIDk4IDMzMS41MzQgQyA5OCAzMzEuMjU5LCA5NS43NTAgMzI5Ljg5NCwgOTMgMzI4LjUwMCBDIDkwLjI1MCAzMjcuMTA2LCA4OCAzMjYuMTkxLCA4OCAzMjYuNDY2IE0gMjEyLjAzNSAzMjguOTM0IEMgMjEwLjQ5NyAzMzEuODA4LCAyMTAuNzEwIDMzMi42MDEsIDIxNC4wNDIgMzM2LjM5NSBDIDIxOC43NDIgMzQxLjc0OCwgMjI2LjI0NiAzNDIuMjEzLCAyMjUuODg0IDMzNy4xMjggQyAyMjUuNzgzIDMzNS43MDYsIDIyNS43MTEgMzM1LjcxNiwgMjI1LjMyMCAzMzcuMjAzIEMgMjI0LjI2MSAzNDEuMjI0LCAyMTguOTMxIDM0MC4yNzEsIDIxNS4wNzggMzM1LjM3MSBDIDIxMi4zNzUgMzMxLjkzNSwgMjEyLjQ0MCAzMjkuMTYxLCAyMTUuMjUwIDMyOC4wMzEgQyAyMTcuNTAwIDMyNy4xMjcsIDIxNy41MDAgMzI3LjEyNywgMjE1LjI4NSAzMjcuMDYzIEMgMjE0LjA2NyAzMjcuMDI5LCAyMTIuNjA1IDMyNy44NzAsIDIxMi4wMzUgMzI4LjkzNCBNIDk5LjUwMCAzMzIuNzM2IEMgMTAwLjA1MCAzMzMuMzAxLCAxMDQuMTAwIDMzNS42ODcsIDEwOC41MDAgMzM4LjAzOSBDIDExMi45MDAgMzQwLjM5MSwgMTE2LjA1MCAzNDEuODYwLCAxMTUuNTAwIDM0MS4zMDMgQyAxMTQuOTUwIDM0MC43NDcsIDExMC45MDAgMzM4LjM2MCwgMTA2LjUwMCAzMzYgQyAxMDIuMTAwIDMzMy42NDAsIDk4Ljk1MCAzMzIuMTcxLCA5OS41MDAgMzMyLjczNiBNIDg3IDMzNC40NDkgQyA4NyAzMzQuNzI0LCA4OC4zNTAgMzM1LjY0NywgOTAgMzM2LjUwMCBDIDkxLjY1MCAzMzcuMzUzLCA5MyAzMzcuODI2LCA5MyAzMzcuNTUxIEMgOTMgMzM3LjI3NiwgOTEuNjUwIDMzNi4zNTMsIDkwIDMzNS41MDAgQyA4OC4zNTAgMzM0LjY0NywgODcgMzM0LjE3NCwgODcgMzM0LjQ0OSBNIDExNy41MDAgMzQyLjcyNCBDIDExOC4wNTAgMzQzLjI5NSwgMTIyLjEwMCAzNDUuNjg3LCAxMjYuNTAwIDM0OC4wMzkgQyAxMzAuOTAwIDM1MC4zOTEsIDEzNC4wNTAgMzUxLjg0OCwgMTMzLjUwMCAzNTEuMjc2IEMgMTMyLjk1MCAzNTAuNzA1LCAxMjguOTAwIDM0OC4zMTMsIDEyNC41MDAgMzQ1Ljk2MSBDIDEyMC4xMDAgMzQzLjYwOSwgMTE2Ljk1MCAzNDIuMTUyLCAxMTcuNTAwIDM0Mi43MjQgTSAxNyAzNDYuODE4IEMgMTcgMzQ3LjQ1MSwgMTguMzkxIDM0OS40MzgsIDIwLjA5MCAzNTEuMjM0IEMgMjMuMTgwIDM1NC41MDAsIDIzLjE4MCAzNTQuNTAwLCAyMC4zODEgMzUwLjUwMCBDIDE4Ljg0MSAzNDguMzAwLCAxNy40NTAgMzQ2LjMxMywgMTcuMjkwIDM0Ni4wODMgQyAxNy4xMzEgMzQ1Ljg1NCwgMTcgMzQ2LjE4NSwgMTcgMzQ2LjgxOCBNIDEzNS41NTAgMzUyLjg2MCBDIDEzNi4zNTMgMzUzLjU4NywgMTcxLjkxNiAzNzMuNDgxLCAxOTAgMzgzLjMyMCBDIDE5My4wMjUgMzg0Ljk2NiwgMTk4Ljg3NSAzODguMjAxLCAyMDMgMzkwLjUxMCBDIDIwNy4xMjUgMzkyLjgxOSwgMjEzLjIwMCAzOTYuMTg2LCAyMTYuNTAwIDM5Ny45OTEgQyAyMTkuODAwIDM5OS43OTcsIDIyNC40MzUgNDAyLjM5NCwgMjI2LjgwMCA0MDMuNzYyIEMgMjMwLjE3OSA0MDUuNzE2LCAyMzIuMDM2IDQwNi4xNDMsIDIzNS40NzAgNDA1Ljc1NiBDIDIzOS41ODggNDA1LjI5MiwgMjUzIDM5OS43NjgsIDI1MyAzOTguNTM2IEMgMjUzIDM5OC4yMjMsIDI1MC42NjYgMzk5LjE0OSwgMjQ3LjgxMyA0MDAuNTk1IEMgMjM3LjI0NyA0MDUuOTQ5LCAyMzEuODgwIDQwNS4yMjQsIDIxNiAzOTYuMjk5IEMgMjAxLjQ1NCAzODguMTIzLCAxODQuNDQwIDM3OC42ODAsIDE3OSAzNzUuNzY1IEMgMTc1LjQyNSAzNzMuODQ4LCAxNjkuODAwIDM3MC43ODksIDE2Ni41MDAgMzY4Ljk2NSBDIDEzNC4xMTcgMzUxLjA3MiwgMTMyLjg0MyAzNTAuNDEwLCAxMzUuNTUwIDM1Mi44NjAgTSA0MTIuNzUwIDM1Ni4zMzIgQyA0MTIuMzM3IDM1Ny4zMzksIDQxMiAzNjAuMzE1LCA0MTIgMzYyLjk0NSBDIDQxMiAzNzAuNzkyLCA0MTAuMTYxIDM3OC4xOTEsIDQwNi44OTAgMzgzLjUwMCBDIDQwMy44MTAgMzg4LjUwMCwgNDAzLjgxMCAzODguNTAwLCA0MDYuOTAyIDM4NS41NjYgQyA0MTEuODA0IDM4MC45MTQsIDQxNC4xMjcgMzczLjMzNiwgNDEzLjc4NyAzNjMuMTE0IEMgNDEzLjYxOCAzNTguMDU2LCA0MTMuMTkwIDM1NS4yNTYsIDQxMi43NTAgMzU2LjMzMiBNIDc0Ljc3NCAzNTcuNzYwIEMgNzAuNTAzIDM2Mi42NTgsIDcwLjQzOCAzNjUuNzQ2LCA3NC41NDkgMzY4LjQ0MCBDIDc4LjEwMCAzNzAuNzY3LCA3OC42NDMgMzcwLjMyNiwgNzUuNjQ2IDM2Ny41NDggQyA3Mi43MTcgMzY0LjgzMywgNzIuNDg1IDM2My44MzAsIDc0LjA5MiAzNjAuODI4IEMgNzUuNDA4IDM1OC4zNjksIDc4LjgwMyAzNTguNzcxLCA4NC4zNDkgMzYyLjA0NCBDIDkwLjAyNSAzNjUuMzkyLCA4OC43ODcgMzcwLCA4Mi4yMTEgMzcwIEMgNzguODIyIDM3MCwgNzguODIyIDM3MCwgODEuNDExIDM3My4wNzcgQyA4Mi44MzUgMzc0Ljc2OSwgODQgMzc3LjMwMywgODQgMzc4LjcwOSBDIDg0IDM4Mi40NDksIDg4Ljg1NiAzODYuNDk2LCAxMDIuOTQ5IDM5NC41MDAgQyAxMDkuNzI3IDM5OC4zNTAsIDExNy4zNTAgNDAyLjc1MSwgMTE5Ljg4NyA0MDQuMjgwIEMgMTMyLjM2MCA0MTEuNzk4LCAxMzYuNTI4IDQxMy4xNzUsIDE0NC44MDEgNDEyLjUwOSBDIDE1MS43NzQgNDExLjk0OCwgMTUyLjk2MiA0MTIuMTI5LCAxNTcuNDA2IDQxNC40MzggQyAxNjIuODM4IDQxNy4yNTksIDE2My45NDUgNDE2Ljk0MSwgMTY2LjYwNyA0MTEuNzkzIEMgMTY4LjU0MiA0MDguMDUxLCAxNjguMzYzIDQwNy44NDgsIDE1OC4zMDAgNDAyLjM2MiBDIDE0OS45NzEgMzk3LjgyMiwgMTQ5LjQxOSAzOTcuNjcwLCAxNDEuOTc3IDM5Ny44NTMgQyAxMzQuMjc1IDM5OC4wNDMsIDEzNC4yNzUgMzk4LjA0MywgMTE4LjUzNyAzODkuMDIxIEMgMTA5Ljg4MSAzODQuMDYwLCAxMDIuNDczIDM4MCwgMTAyLjA3NCAzODAgQyAxMDAuNjQ1IDM4MCwgOTcuMjA0IDM3NS40MTgsIDk1LjI0NiAzNzAuOTA4IEMgOTMuMTcxIDM2Ni4xMjksIDkxLjI2NCAzNjQuNDUzLCA4MS44OTYgMzU5LjE3NyBDIDc2LjYxOCAzNTYuMjA0LCA3Ni4yMDQgMzU2LjEyMSwgNzQuNzc0IDM1Ny43NjAgTSA4Ni4wNzMgMzcwLjYzNSBDIDgzLjYwNyAzNzMuNzY5LCA4My41ODMgMzc0LjA2NywgODUuNDQ5IDM3OC41MzIgQyA4Ny4wMDIgMzgyLjI0OSwgOTAuMjM3IDM4My4xOTcsIDkzLjAyMyAzODAuNzUwIEMgOTMuODA2IDM4MC4wNjMsIDkzLjY3MSAzODAuNDM1LCA5Mi43MjMgMzgxLjU3OSBDIDg5LjUyNyAzODUuNDM0LCA5MC4zODEgMzg2LjI5NywgMTA1LjUwMCAzOTQuNDk1IEMgMTA5LjM1MCAzOTYuNTgzLCAxMTIuOTUwIDM5OC42MTYsIDExMy41MDAgMzk5LjAxMyBDIDExNi42MTEgNDAxLjI2MCwgMTMyLjAyMiA0MDksIDEzMy4zODUgNDA5IEMgMTM0LjU5MiA0MDksIDEzNSA0MDguMDI3LCAxMzUgNDA1LjE1NSBDIDEzNSA0MDAuNzkwLCAxMzMuODczIDM5OS41MDMsIDEyNi41MDAgMzk1LjQ1MSBDIDEyMy43NTAgMzkzLjk0MCwgMTE2LjUwMyAzODkuODQ2LCAxMTAuMzk1IDM4Ni4zNTIgQyAxMDQuMjg4IDM4Mi44NTgsIDk4LjM4OCAzODAsIDk3LjI4NSAzODAgQyA5NS42MjIgMzgwLCA5NS4xNzcgMzc5LjE0MSwgOTQuNjg0IDM3NC45NzYgQyA5NC4zNTYgMzcyLjIxMywgOTMuODE3IDM2OS41MTMsIDkzLjQ4NSAzNjguOTc2IEMgOTIuMzA4IDM2Ny4wNzEsIDg4LjE0MyAzNjguMDAyLCA4Ni4wNzMgMzcwLjYzNSBNIDEzOC40MDIgNDAxLjM5NSBDIDEzNy4xMjkgNDA0LjcxMywgMTM4LjQ1OSA0MTAuNDk0LCAxNDAuNTY2IDQxMC43OTUgQyAxNDUuNDczIDQxMS40OTcsIDE0OCA0MDkuMzY2LCAxNDggNDA0LjUyNSBDIDE0OCA0MDAsIDE0OCA0MDAsIDE0My40NjkgNDAwIEMgMTQwLjUxNSA0MDAsIDEzOC43NTEgNDAwLjQ4NiwgMTM4LjQwMiA0MDEuMzk1IE0gMTUwLjQ4NSA0MDMuMDI0IEMgMTQ4LjkwMCA0MDUuNTg5LCAxNTEuMjEyIDQxMC4wNjcsIDE1NS4xNjAgNDEyLjA4MiBDIDE2MC45MjYgNDE1LjAyMywgMTY0LjQxNSA0MTQuMzc4LCAxNjQuODEwIDQxMC4yOTcgQyAxNjUuMDk1IDQwNy4zNTAsIDE2NC43MTggNDA2Ljg5MSwgMTYwLjA5MyA0MDQuNTQ3IEMgMTU0Ljc3MiA0MDEuODUxLCAxNTEuNTI4IDQwMS4zMzcsIDE1MC40ODUgNDAzLjAyNCBNIDMzNy40NTQgNDI0LjEyNiBDIDMxNy4yMTIgNDM0LjM5OCwgMzEyIDQzNy44OTgsIDMxMiA0NDEuMjE4IEMgMzEyIDQ0My40MTYsIDMxNC41MjIgNDQ0LjYxOSwgMzE2LjI2MyA0NDMuMjUyIEMgMzE2Ljk0MyA0NDIuNzE3LCAzMjEuMTAwIDQ0MC4zNDEsIDMyNS41MDAgNDM3Ljk3MCBDIDMyOS45MDAgNDM1LjYwMCwgMzM1LjA3NSA0MzIuNzcwLCAzMzcgNDMxLjY4MyBDIDM0MC40NjYgNDI5LjcyNCwgMzQ2LjgzOSA0MjYuMjAyLCAzNTYuNTAwIDQyMC45MDIgQyAzNjIuMTI4IDQxNy44MTYsIDM2My45MzcgNDE0LCAzNTkuNzczIDQxNCBDIDM1OC40NzIgNDE0LCAzNDguNDI5IDQxOC41NTcsIDMzNy40NTQgNDI0LjEyNiBNIDIzNS4wOTkgNDQ1Ljc1MCBDIDIzNS4xNTMgNDUyLjIxMiwgMjM1LjU0MCA0NTkuOTc1LCAyMzUuOTU4IDQ2MyBDIDIzNi41MTAgNDY2Ljk5NCwgMjM2Ljc1NyA0NjMuNzc1LCAyMzYuODU5IDQ1MS4yNTAgQyAyMzYuOTQ4IDQ0MC4zMjMsIDIzNi42MzMgNDM0LCAyMzYgNDM0IEMgMjM1LjM4NCA0MzQsIDIzNS4wMzggNDM4LjUxNywgMjM1LjA5OSA0NDUuNzUwIE0gMTc3IDQ0MS4zODUgQyAxNzcgNDQxLjU2MywgMTgwLjQxMiA0NDQuMDU3LCAxODQuNTgzIDQ0Ni45MjcgQyAxOTEuNzY3IDQ1MS44NzIsIDIxMyA0NjMuNjc5LCAyMTMgNDYyLjcyOSBDIDIxMyA0NjIuMzE2LCAyMDMuMDM0IDQ1NS45MDcsIDE5OC41MDAgNDUzLjQwNSBDIDE5Ny40MDAgNDUyLjc5NywgMTkyLjkwMCA0NTAuMDczLCAxODguNTAwIDQ0Ny4zNTEgQyAxODEuMDAxIDQ0Mi43MTIsIDE3NyA0NDAuNjM2LCAxNzcgNDQxLjM4NSBNIDI1OC4xMjMgNDY2LjgwNCBDIDI1NC42MTUgNDY4LjI0MCwgMjUyLjIwNyA0NjkuNTY5LCAyNTIuNzcxIDQ2OS43NTcgQyAyNTMuMzM0IDQ2OS45NDUsIDI1Ni42NTQgNDY4Ljc2NSwgMjYwLjE0OCA0NjcuMTM1IEMgMjY3Ljk5MCA0NjMuNDc3LCAyNjYuNzQ2IDQ2My4yNzQsIDI1OC4xMjMgNDY2LjgwNCIgc3Ryb2tlPSJub25lIiBmaWxsPSIjMDAwMDAwIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiLz48L3N2Zz4=';
  // Packing categories — chips float in two arcs above the case and rise out
  // of it when the sheet scrolls into view. cx/cy are fractions of the sheet.
  // sz = icon size in cqw (per category); gap lifts an icon higher above its chip
  const PACK_SLOTS = [
    { k: 'tech',       label: 'Electronics', cx: .30, cy: .12, sz: 17 },
    { k: 'toiletries', label: 'Toiletries',  cx: .61, cy: .12, sz: 16 },
    { k: 'documents',  label: 'Documents',   cx: .90, cy: .15, sz: 10, gap: 2 },
    { k: 'clothes',    label: 'Clothes',     cx: .10, cy: .30, sz: 17 },
    { k: 'shoes',      label: 'Shoes',       cx: .48, cy: .27, sz: 8, gap: 2 },
    { k: 'extras',     label: 'Extras',      cx: .73, cy: .30, sz: 17 },
  ];

  // Per-category chip icons — line art extracted from the user's reference
  // images (color fills discarded, dark strokes kept as alpha), so they tint
  // with the theme ink the same way as the suitcase art. Categories without
  // an uploaded reference yet fall back to a plain text chip.
  const PK_ICONS = {
    toiletries: 'data:image/png;base64,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',
    clothes: 'data:image/png;base64,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',
    documents: 'data:image/png;base64,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',
  };

  // Full-colour uploaded category icons (built from your reference images),
  // shown as-is via an <img> rather than tinted like the ink masks above.
  const PK_PHOTO_ICONS = {
    shoes: 'data:image/webp;base64,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',
    extras: 'data:image/webp;base64,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',
    tech: 'data:image/webp;base64,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',
    documents: 'data:image/webp;base64,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',
    clothes: 'data:image/webp;base64,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',
    toiletries: 'data:image/webp;base64,UklGRjonAABXRUJQVlA4WAoAAAAwAAAA/wAAogAASUNDUMgBAAAAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADZBTFBIcwsAAAEhMWmK0XsR/Q/lQkgCgaT9vWeIiNTRtq09bSR9v2SKMZwUc616/2fpYSzmCidOLOm/aIgH/9uICZgAT9u2p420bdu+S3Y4xdh84q+/mGnEzAxNxRRmy9I+SCrlpLoXTSNiAhD+oRoB8BS6AgrSp5/vV43PZv1hUk3c3f9abtSZQgCxWEJ5w/cc1t2AFIilFQTQAApYSBAkljT1RrlkDQEDAhAg5b3bHFLAB5MoxFdIKODr6GsgSHafbpYR8mw0NiWb9067o+v/tX0ASEIIPg+m+SL7z3WgAEgrI0FAaa2SJqQhF0hQcMOhGhVrkA2nAmwlZVJKDQSCAGQ3NypzJAzmBSi7u3HCpJ0pfBCIkogooV1NQACAMZpKrWwV5J0jqdlgMrr+f9vlAcYYSWEydXbjxeT3/8417yauMAEEkmrZWhHVJ1uNsk1TQwJCUJAbXpyFp7tJiYOTVgDLuzVbqpWMgWAEykAiEABCIAAK82Ton0/DeBwenRLzeQY6NE8qpLDKm5k1BpIEBEiiIB/cuDvJM9GQgNx45Gx5Y/L3f2W5D951L/oCDAEtJ4UgJtZUj/drqSHrn+xuVZJSKSEpKAQv13372n92WCqbzn+vAlA93ExMklIAQIry/f44y6GFmCdZ2juyVDbw2fX12D0uJRIaKgRyTVrpzpxFjDWLMQAgAAjzAhCC9/ICSUHBZYHG5q3bzGXeTy7/eR1oE0MhSBCMARVyN8tC2qimW1++2KxYMt2qVlImiSEBSYL8tNPRTt0mmLYGAJJG2WTjiQeIAAHQ1OU5giCBAgiAtr6ZyG4+r+St68u2e0SKJ9GVGsixkRGjUnIYAGNQqyBAAggAQgggoGyW57nCrPW2nbNcTigFLwRYayA/nUzGrrK/Va4f7dVSAzKxCUgaLBQgBeeQJiB9llNEYugyHwQAwlyQ8HBaS6B+UEp3ksvTntMjIZ5UU9Ou0FKpMmVYDmPwtxUWCgohQH7aHXuUS9YsYIA1pLybTWd5ebNZSqqlxAAERIAAeM+8ABCABBAAgiQYrJiEaKsmPTxM29etiX8MRAnk+gYisDFRsRzGGIO/uQBAgKiQ+xCSxACSMG9AyHvvZUuJJYl5QgAFEA8UAFC4XyDWk6Ct7x1vjC5uh279lEBDZqApUhpZsxiDf6wwLwmiISAsJgBIEEAD4sNMAJApH7xsTq4v+/maEV+kpS+XKT1bMhiDf7wAgSAeLMwTH3SClZ2jI392OvBr5Qk1dbW0OG+mKg6Df0cBxMfalJqH+/b8dKT1UTwNbV0dsDRVchj7t/i4M6keHIW3t/m6EE8s1zYQ2RhZsRgDARKQrT85bJ0MtB5aQ65jV4CNzFQcxogEAFCm8axxczVdCy3V0xeLLLwoWYwxkCPN1gtz1nZroOT2DeRWXi0YDgOQBFh5eXz9frQ6JbHvGBmbMhhjAEDkQIA7L5N3rXxlqT2nKm82HAYSLe0+659MVhXbdcQYqTgMJEqUn9dPu341oV1nfCMWYyBUs/+8ezZdidZ1JTNmMRArK68a7zr5KhJXut4ZDARrdz+9O8lWoB248KbiMEbkgtor+36g4hJXAhWQLAW79+Tmyhem9J34wEQDCtVP3ftZYQ2XfBvCAWCPm+/HRSlDp9440qHQ2O/0VFPknLbGQLpUejy9C/UoXadeOfIBzSGufT2BE4UlBgJmc/NmVgspnHtniAi1g9txLcqenhlHREyfDNu1hPawCgMRJ8e6rCUzNGYJifu1izo8Q7EJR0ho7N3WoBUOrawxEHL5eauG1JGmR5aUaI/cdoGeUwtLDKTM3cpWStOx1IQlqI3qVrFTLc8MBnJK021I0wm24AgKNtlG6xqYshgI2tS3CfRpK0xWh9vEekoGI6La+4ywr0WaVhiI2jQBSCSiEGtpgwGAx2dIKwEl0tWhsMrIuzUHgCiOsGCUpj0HhgLO2r1rz+YckHjLpVNzYwbxFcifrs1YEjt3qfKhYpFAXw97dmfKYPK61FNyAJhW6BmCF09WKgaT1i7FYQAESGLfEe3Vq3dz4ooYDgAAAdKw40hu5HclcX3wpAgBAAJKrGtIu2WI6ydsR4YQACCExNoiKw5I+0e39h2IEQIAQIgv4DBxvfqEHdgRIwQ+JwTkXbpxjRzaEVPIZyJnC9ceKIf6Yh4iNXBmbj3R9vRkNCI1cCZu3SMDRzIaIUIDY+bOI2dgVy70GZEYGHPPXpWa+tpCHgLi1mdgzT27Nde0qyPjIUJDGP3/p9/69u+vpkGKK92DMLr44w++/fN3Ay8pppDfA81a//nZD3/679YsIKbl7gPy/tuffuOHf7qYBEUaNLv8/be/8rPXw6B4Qr4UlPX+9/Nv/vgiR0RzOSAfvP/1T/41iSn7EGh6+/e/96RoonkQ4Nuv+wHxXARcZ6yIKjR0+z6iQhHq3OXxpKJcPCEvArNxiCe5Qvw4jycUk3cmUiwpL8RdDgOi2RfTmiiaxELCNEfkB0UUi4lpqhiFeEIoJjhFk1wxs1E8hXEhGrVcNGlQCHoXWTSFrJjpxVixBBWTnfa8IolJMfl5OyCSTaMY9brRZLeLweRmFktsFDR4M4LiCJWCpq87AXHMtCB3fhdNtqBweeljKSkI/bOZ4ghpUaP/DSKJpqjspB1JYFH+4txHUuG6u8gVRywKk65H3LtuFnn+ehJ7V6PY60wjT1MfSSpOiiMh+l3shWHs+bvou4q9MFoB4wh+BZEsRL58FnkYzCJP7UHcCf087uC7lchzt1uRl11tRp4bVeNOo7wcd+FGSdz585KJOs2utxB3g9ta1Cm0pmnUYfquYeKud3KAqA/tdnUVCjZ68iuTrCL3qYmd7LzJVYyHuzZywqi9jVX2W8/S2LmZNFYyut5vMGaE/FLpSmZnzf2ogUbnO2Yl+dn40zJjxt/2trDam3ef7USMOD5laUXDf+8/s/ECd3N5YFaUn4aXlrEiDN9nday6d3dUR7S6m4sds7Lpyc4uGCdS/33WwMr9qTlOEanZ+d2uXV24ab1oMEYE9d+ihjXsvjs8sDEC5Tc3W2Ydxv/Xp3UTI3nvNK1hHfPLk6fHJcaGkA8u+sd2LTR8jRebBowKIR9cdeoVrKc7vdh9UTUCwMchcDktx4+O7skH51fJFtdEvdfDZwc1Q6ytuJwILQdIAEgQ0DrwgyICEELWubkx2xbr6q5OwtF+w3JtlhYACEsGBYQsE1gqJSS4BgRBQOAHYV6YDftXw+qWxdpqcHqa7B81ylbkWlDQPVRwLghcoBC893m/H5A2N0rWGpCrSlJrSBCrJsC1YIDceHAxnFW2DNbY995fam9nr5IagCxAizRHQVLwIgQguGEvA7QACrnkRqMAW6+XEpIQV8PNrWo5SQACXIFJaKhluIjQHJcQfBZ6N/2WOagZrHU+uLwe1PYbGxuGJB8iAALhAUCAQp5NRwIIKbhuO8P9NJZMalUDPxm7ECBRXKCCzPMnO41KyRAEeA8fVmlWE2O4hAwBEDBzui+E0Ovl7Ru7u1Ei1jwb3132J8nBXsk2q5ZLCELwwQcaP80EUApuNuv2giAQhuWKAbWAtNbatG4NfK8/cwqCqAXQIj7k4GCjVk4MlnswzebzzUpqsaQppZYwNl0AUBSgrD29uczLjc2ywfqHSa99NQtCaX+nvIQoee+zzDH1nbEAgZgnAQJgeauaUFwAgoYEAJ/NcgURCFjMRQ+u1kqJNcRCFgRuPheWN82aNTSVsjVztMbN9U4y0OyWDR6l3HgwvOs4W6mYJSDCIwQv2DDLMU8m5XKzQgoAmRgULEGAsHJjQOqewlnZGM7yfBmmKYyYWHJBBbMAyA2wVy1ZPNrgZ92+n7Y6WbiPBK2xpTRVlmxVCRAwNkktIHxEaccul5bQYByC/CzLPUCwymmQzMZ2JSUKBgBWUDgg0BkAAHBmAJ0BKgABowA+USCORiOhoSEkkKwQcAoJaT8BBZr+pkbAEvrFjBZgb4ZZFgCH8i/AD9T/hz4//r/BnzafQtd38hxp+pf13mt/MvzD/N9cf9l/x/If9t+8bnS4dPo2gT69f87y1v2PP/87/2Xm0f8P1D7oHx2PWK/5/9N62PrH/0e4h/OP7z/zPWS9gH7N+yH+szSUuBPu0+kHD+/+SgoYv/8PZ+3bohrA03KC9zaFlkZrSyHCTLd6zxJixdIJ9bausVOm9CBuqs8RVL23cA6w95YlHKDYAFId81O3J62REDPrjUt/UwCx7s16T388hbLyO1c0kPBTB5ZbnKtwNo/nkWWXnIv4zTfRAQzfZuSo6BJVUeDH2IH0Pj7Tg/D0OD8/9xiWvMwwa2QCZ2PJDtvNamukJdkXzc20HR7QMS1DIMa/3tWD9cZm90zwzA9OmtxumjWLYDyPFog+IlZbDfWEHa+YVZk0A9a+ZajzK2BgRIU3vxl5pcoah0BT1mGUv27P9AWrvyMVaBErQgRxnpCWPp1xgjSZ9xSv8kG4wrs/eTzYt6og77BBVcwe/8WZJ1lxris/qlSUjV+l2Nf4cpe0N13cfgm5YDe4R8kgPjDosD88fTUqgExpcYGVTaPW/SVwguXiTVwfULusA6sDUgGKhx9zSJ7Iu5dG3OfFhNWQ0LerEqR3mkB2aUmPUEUDLyIUI8AHgEATg+vAbbs5QZ10GhvaAdUihppSVS/jRcGvmec49gYE8nbAEL1Mx9c3kUoBmdiUuRi8BUnXG3nQ+2gbQNeRW7p47ASbG0miESb8ZoAuLIoJpAOEGXyNr5b5prGJ9PsJs4h7ftWnCCoaGDTOq5qodaUGgnQJZpJTFFZfAv6k6lYhFyX1OJmlo0zmlSfJNEX1bP5zO/+/omQUNIMUTpgD0IVw3x9WYd3beUoGrCMCHrRiGO47+xPxFbVZpke8cR4AxRMuyvlAhClSUxikjSOcjbpChnExmoCjHlZrWzLWiPBVZ9PjSRMsHDg9jG71qeZ5Ne2PtxqzUtXLEt3dv4LWAnffaCihdRI7i2dv3a612j99hJGQBojoQBQxJxIEnPmvbU1vKZaVmAD+/nyWe7iAYVQlXCJRacPnWHd4esr0qgjfMC071foeKScB6UAMp2XOFvDZ/u3ly2cJP22PDlnOtfjtvXhMW9VQCadaumQCxyKiJbQRHJzP+JpdbUwpEKzSuugD/WyrxgstSU/NxTe85iRPcLAfk75aiR0H+mtUhQSzqFfs76RDBU9zkPerd+euJ++wzjCPVcMlBxqhLOcpXFxOq2mbw0evqz7opb+OqkbC6EaTRbgzS68sN2RP4Ytk5OFG+gVO0ZjfH0HLfd9p2ZVEvGsdVYBVEUk+YkUu5x5zV4GS8XqOvxoUraBkky78xptdKrlKwSz4y17er73hfGYqjH3hkj3hhN1MH0Hg40O+Kx9RtKdBiP+QW/gT6ZcFTk3oIvXyNmx+qsHmEYE8sbKVgYnHBz7M5E5e44XyOw2gtWZvs4CGfAUwbpo6fTSVIs/bTny2pgxzZaS7hL6wgNfzj3WosnzMX3ZI/5LmtB6StmhzFdhyqkqWnftAgo4/2Ng/2+GONnYUAvtQt3qwVytPCxGB20IPtjVGAfpEjnNWx/3+BoCuKxWs5VDn41++PLwChu0QPWt7lNiADmH+IbNW9hzad3egJAWe+ILLg9UeExEnR4JDCZla/1ZbW68fHZU2N0ArJyeRqEyK3q5A0bbQk6b1Zm0G3J38J/pbv8dzR3CSmxtPDzIglSmpVDsyi6st9J4o5UvaAEIhrQhlcpmR2vi+l1r0iQsQG7bKh1lfzulWK9h5XLjXYfeeh9uW1RSptPSrV9K3C3fSOICrzFPbZ6/iHxTOptPo3sl2A2RxI29bjBo3CLXxVimaHxzVk4Z2vNEohEElGRasNFfL+UPz5+dIkPw3AQDFDYyGKSvyiyxxlV45f32lQ13ob0Ut1/ofDqfmfx8ma+vOKF4UTkI9ysfak1SD9wcJK+TXYmkdn2XwgD6JwyD2VpMociyL6LeG0iqt28NoY9bP1VwslsXQfhZKuQbK3HVwXnse5qVcN/6fqS72+F+erql05tba2V4A7U2lR37ByBAWFmTLp0BO+2mHJvZpKnNOfzNeCxgnCR5cmhHjNdGyGObctA4TomDH7Mhe2rUMN5YOtDS7lfC7WhFXRhAgyf1w9XdDlerDQAjcEFv9bi8yQQAYboyDSylxbFwSopWEo2V6GKFK9hKnm3v2dSMUfdi+wc8IKpsmAiN4DRAVHEiFAMX+F7n5CryEajaQ66Ol4tcEYzRtY4duCFXTH7h/6LlfDIbaKQPZfm15hEkScBuzfr/UGc9o4L1hmnuMFsiyalUH/yK9f04ssMwG+wMfqA/Tlod1fhg7oS+4G+vgr4gFAlWahn6YOZxyaA443sPRpweFrL4FE7orH7z1PjPtwUEI4GZKQdR8S2Oy/JI8Nmfn88LT3cd8K4BbgQ4mC0eYKrHHgjZqQ7JtKchMglNJWnWUPGbRCvrmbZG6YIquDUmKYgy+GOAZ0fudAj/0cnmd6ISQAtp82IHp9/NUSDFjjrjTcMKMeUmmQ+5DFJA3QQLGjtIvNhCyYA+X75lElxY7HFPsQeZaFVrxzU0O1FNAiwhiaaSNEBBSe9W2Ql6zgr0TPRlTyk58QJtzOOH4grBrhtPxO4C4ZUMeQlGIG0e8Gs97bdY2GZ/jCFBRDrdgAdPjB0EIjcxiVQtUP2PfXgCzoDy6E6JOMIe4DEvrohRHAdLuIiXLOaskNmtjCY6zKi0+cEic432P7V1uDThNO/sGf6RFvxxIRXsDTVqfnY/y/DUEVuzH25Cnu3Y0LfyKTtJvZ3McovWxgis7BVNXXYuZnMdO1LcHk8ei3qtNFAWVOg7RZMK+qviB+SoiE5kKe+egfVFxnDgboYdWeq8AVU9oV+MEiZbAcBdvPlmIOkgz0o8wQMcOWcg1ia90EnDH9UlQvH+rnH99MbotEw2ergVyjE3Xc1RKyFQg6xuPsxf2Rg1pGcJIVnnAj5117A7gdAwXzWj87HN7we0v/9pg1DC9rfvS7hcSO+gtQy6VuVrOUHLADacbNLLKnagL95yW14Cs0+7yxwPAZvp4AZ4hD0EhI0+6hXjtRRvHAPMaV8/jwcihlLrkNh8TnTwkNO5+/Mn+di9OqUCZcB8bK7Cq4CHJ7vmE3EZd0qcOCwAdLpwz8xKSeft+bmHnR2rq3PWgZyMvp8gCMvGFX+D4hxy6a5Cibk0zqCgP9uf40V5NAdzKCvF+S21NpZDRK2isLAw67XfqqUW9w7HPl/HI2EKv/5nEFFOgQmjsCL9lr7HuiBY92wqUp+GAmkxCB9u+l1n2YbWFK0XnpGW5g/Pphh6VAn0Km3NuEI8HceyR3etCs2Kiq0N/RDMtNxnAuv85jnG1gxRcGIHq3stTWaLv1TvqQQYoMFXRk7p/flyGRvuePOZkhK9qxTt1kxqARxv0KMpiYbfoBRHfKbNnCqNN1b79QPxTTF5HadaPa4/nxTdo01VFhqyIiqvmfUNPZKGBgJfk1yTHp8qoxsNMtIcov7IVu1XsyYBo0AyOtbehs0gCleOaFVjQgGKhM1+UK7U0/jelirkZV/EI36opz2Nn/M8+CiEtjjWfUggW4I/YF+Od/NEWmREfxCWQjxghbO/pwBqVHtN99CB2xBoHi+gC5aCJ5WMErTdNfFe3Eh0kFKmS4BRrLLdgyoQLpK3rnJqh9kFv+7MFOYB1lC8cJWawAfyLlntdL+jBKGRziZTu47hCm0czqL+AHm3Y1jVoP1nNkujfSe/fhPE5Nj45OCe3zneRtTdfYNoBmfztEUYs0B+oyRi2ovjopE+qfD0V3+0ld3wkCma9RTmB9WBQZuS/ADN1RoCl3qSvLlf66xlpfWxwTLKhlKzkcxCHFI+jCHLZgviIha8prVqM+SpSF2AI2C9LZ0/2Hu6jI6eTCNaDFeUsDDobz2+7TdVkiAoSwNxCdzgvii9VB24nxJqms+d0hieWihV74y8RxYeZffu4UEmqypaJiN81ERIZBixjd+1pDbmQg3QOCef49jgx5s7/ERmfTgqB1gVriQt/8kcjNDSheMyIqfYgiQipLJOEAfmyz6rxxrHB6/1mO5DC2BBh0n23GBlEdfEZyX9IZBtqydv+9f7sH1kzGfl6/5H1Jj7Vx43AXj8sDWugWJVppGeVkbYn2KrYA1Oj98unSgksUNId/zXZuevcCeA4O9BY0PgxYKVMlyfeHxlLL9+gwY0SjbRRauZYXAQ1srxcEeTD+4lyhrycgq99TFnsQBbWwZl00HJ1aBUMHc9jJqNmMxXkfReitOFZweYZzLR+gD62bWSXJIr5PYttelZFubpQSLZvHn+LmQR/jseCy+VyGvxxXM55o/M8H/t9ngq++rFi3LwHAiU+FUiLYX+7d4HjpOb+V/T2RPh8SJ9vrXSWd2OF7DOk7+D2HJ0Bbt1Auj5f+13dOP3gW/XIEmXe8inbMmaulWiu7BjhaN8CtLrFRccPBJV5iuCMZv9b9cprzAr9Xen3de1jxZpq5h2meUwDIKuu8tjgCSbKlCu1wGz1MKpPYGt1AZ1/LYyTD4Kv0TqVug2mbwbZAoR+Se4Sn2a7RZV4x/+akIGPz0YIFzcUfV7pOxqSXgm2cgrZJPzbn91MQL69IC+A+q2x19IuwhKyGzOSLXOoyxLC8AbEkB5V2119kawJ/DSj9inauizyDE/Wh3lolYxWg+Oh6DzC1LbfjbTBXLBWzuVrt1zcy9JqDFP/fCtkAvhnfKslaRMvsayzAMYNaRj1F0Ozj3JLURs9K3p3mYQ0hYSBDBfvNZzz86N4enAQjkZVLHsosljI2NLZUQNv5gGFpvoMrK9QBno1ugz/7ik9obBHhBzrJso6uU1gx/c5xqWJEg/ZHmLw0oNknLPCGZtrcKMxxAXDC+5Z93zCkGujfBa8jlj/1cPLWp82y1E0RIOagV3P5KvL2fXZgFqkmfqFDOPMJlKL1wkeIKtlJaj7fZMBWQ0PzuKfCdNgaH1uzOMdrjpjGmQkeSlqzo8HqjwZAUAvHO03Cx5yLh/eTcMUPGwRDYtU6Vm51w4D1nSrhnMmc2y4uomCIjubvjoBq24bOcZGQeaxpCkHHK8skBmjY9HERlW3sftuwaH50050AJrb4thGCpAf/b/zxKcRENwBp6A/5JVuF7UyfJ9/wveFQkj1dkpeqOk3Jt8zPfDTfhEGsr0o5sPnR7Q+yXSsrr0/PUKwjZgz5ij0dFKtbkoEqE8yNxS77njUeb2sHBvfNuMI27FoOhx8Qu0qkllHWtptOJrMvTCacLCwsQfDL/aa//emfw2bfPT2chkKkXIEq+TIJ2jKBPR6i+/qgttKA+nP5K0+gqFEWxSWbaLfCJRbHx1OZALK+6vBRJx3MbpqhEHzmkc8UkhBRrM6mW/RPwZIuI8n4HhiVMaBNiTTUFtIGkEgw29DSdEtLCiJIp6rN0KN0VgiggHuBs8axLxylNMPCwmk4FUdNYFKDdWi9hMFmlccI5ZkAdshW5R2SBz+ATTukvdeeqtYTXBDe906JpuUDeZsIFWbcE5M0ox5ThOF7lO2I1lQP40yhR7mdhOdsH87Cb7G9lzZ1XRQDwXYTg8x71HeYYJOQ931iKj6t1cIqi8SFw1kWotlI4Y94r5GGRzn66jkq/qTsSau8advAz+BQqPssTIKZMsKHyCVnJoAGnnpTHXiX06zImfHejpGUs67J7cRau+EcV0AdMkJvzRPTJi/EvD6Im5aYjK940sr+15XlxDqrYRp95+dflA1KHiPodUc9R1HR5DV1SR/M4N0ob9sKE2s0cDgr4VfYqw2D5WE4xJkQ2HVMKFznIZjyYY0ZaLwpCXpT1IcU3y/QCuj2LvP8emsRrS0ZwOk3ZvAfww/CcWxCTRiI6WH+CoPQWcICrNf9An20xlrQR/QW8AJcredSNvN8utdgMx5D0ksaWqg+kwGvLquTnSP6Jy+FDKB6JvXfVHDmkVzhbjfziX90wKRL5O5Xe72SU7oib9qw3/Np2pYlh3ZO9PF462yLBTqcN86gTmKd5A/PsDb37W+JXxc3+nCugaQu8qa7jcUVFkVJJaO+RoPRMCCo1Xszk9fO2QdeQ8/HH78UdiCPRP2YB4UWY/ilOK2urf96NxOYTT/aHRuB24po5RNl/Zg5uexwg2u5F1qTdgnrdDdgkWf0SednKcMK4fVfiPjISl+0DwsCpREDpnjHCaTwpCwru8j0vg2HHDNizcmiCH2yJ3GCTViFNgxRVyZxKbTyGOz4YcJkCL1d3RnTKrzWKyF1dazOVnOZ+gPEZnJQQPqHFUXGBTM9guH9IGsuVDe7f7lDpEXc5BWrj9h+J8Rc7Z2P47wTWSzRZIGoTz7Z7xA3p8yyuGM7Lp/+f6XVn61D6f+nbz7r/o1W1hP8ejXpYLdQ6e8/8862p7bm/ZfhylsPQBHSPWzCpCe+sqaTWuBVt9lwvJgLkwJfRqFunKbZ5e1d1Jekpags0DFYeQ8c5kXKzfUfB56EAEc1jFN3NQ9h1fhQe5K4X3uRxSaD5Sw6KSukmFElP9CI3obv2SXFTSCN8/lfHv76pE0rXy3aTC7meBbGKF9gn1ISZpY4u+PYu/DOOLjGT88iRy2vbt64cKethYOVG7CtTlq3roffxugbwsagGaW6dqZfCn7H83AHnYxsc++SDXT8jlq1r5axGlcFlYYL0NJ83vL2MzPaa4EkTq7iiRmxNoB09gmLKe7hmaTjHKX6hYLYi3zcWNpC/IdaQQWPZeRHnDYLYKPZr5ctNtydA4v9Ac8SkB/F6kk6EQccuy0yypWH1FzmDCIKbOxVpCIjDc9mVWGuCc/3drVJQnQHKvvaMwDnQHTJm/sC5s4btgV48HkS0IFgxViotGXmESXuMkx0mo/LghBzMIqnSZHgXjK++DYXTvWC8ilXEGAhKEIREOXvu46QcAN74ueZ3ReNUfToQmWXoyODjZjZgnREJ/a5CDQe3OKHfLqGEoCvbgGJc60RkBvnzQPMXo8yqslPNmFYNeXbzIQiVFzjxMaf+8MIeq2HyJ4BYyj8osIVs3auli9L35f2jC8veNWV3r7e+mrXd/asyPtuMRVgmCL4NoUlA/Ej83+T/RjWE3wyjxY9OaXJOpkCfpd0la7vdnVT2uTqKKaQFd8gRlR3V0/xFViF+nkmtc4xTuTOgBzPMXQRFMDwhD5TvOSMfxGQw8kHvOhpK6xb7HCf+5G6SrOOBlV18Pery4Y3BUOExHTU8vv4kRmi91eLsgWqZRbtveG0NAlAI4Zwc0IjLNQXmR3WyUxVUKoCnAva6/CQjnGvz/af3TG2WmD8nMjVi1yYZ6J2toJXXdcsfdkPyjf0XEzrLoCH6oOFx5TOgB5aubCDS8+QbuYpzr52u48r2V5LyAd5KdgD80hsj1oDoSSkRd9HLK9xZ9/QGLIIib/2tMaM2/tVjoPD5CiOPuy2mstrvfvDYSLuBojWKiOCx6z4u3TQYGULqCzjBRfLdYShjLrXTCUuedJCFmNYHcmbWiSH6IfnM0r0b4oMSFFmnGzUYUOYGnMII82odWulwxlbLB55Z3iGo/MknXq4jieNgHHxtn2e1loVZY6Yyg81zkEGyIbW8iXFk42x7fFycOZGkyZMdCDG1wnx4iY9kmGzihCFMQ8Q2OyifO1NhR44UeKXmHFwrGjPt8DruygXzmg8s/Ftq+a9putH0AuSVC4DKSEucHh1MjKvZYxjEpqm+4/3Di7uhJnqZ92RJCDEHMdp9XduVMX4CLU5sgN7X1CprNmop1OPqviUWDRel7/XaqVyt798dgaLhG85ScZe7GeroiRnbbPrj2U55GqFdP8x44YMCCfszCzN0TEXkNPSRU2BNI710k9aZonb7wWp75HwnQwdB03/oV6qE0cOyRLAfxQnU+oFKP06/jihYpK25Qw7tbuZAs5rljinc6MPv+j0yAzgilhLsne92n33w8DUBjzJRaG/mVkq8f0xfKpILCXuhY5n0qiNoN3avZVwCoH/uSI0wC5xMvmBCl2pDrxKVQYowqaaQHkfM/Mn0yQVCuiJq+2nn+HVTJip72KbBWrcQpsXBaRPfFaQ2ORFwDa3AveS83b+/ovwwbpEKkHg96d6gm2bbW7E3ukjiK5YkPHGo/c4mXiRj4Kjwj2ZO82tzh2f/j2oXrRhs/oUgLesPFGI/F81id2o7mpEHlDYD0Z3+ADqFavHV4qCoNpoLyAhnyhyeksM75mI7/PHHnjzv7qImyrfw0NxfmyNQeuKw+viRgbyYNn/6y/NF4W5Wp51W42+1sdZv2gZizfi/AeEDjJCLOMMZMcb5XVgKBV13E5L91dj+qvdru//0uo1rfFVAeS8Ajdc3IjOMAzXzVFhOOSozt/8xn5EgJfv/jQu7xGqKl56JK5llI2W+ENYAIXoH8y9DS7BKxwO7FsRGZ5ERQAdJhX8Q6/AN0NqJ1JJdW35CAOw20lAG6WaO3SMcfa0c92J940zG5tAR9frNptyxq/GZmmUmPQJJKbzqdN9ZrxOXAlpaOu8/sB8nTqLkc2sY/8q9fcOg3MjlWRJOJkAD08hGhXVrAEje9OxlpgAA23tJb8lfWoapmviUIoj0Z4HnU6RJXSAps6TFoKYyFJcdle4MA+TXFJqcK7cHc5jK6vlG05XUwYCbhtjSz9bWrc+BaH8gJQZ4QK0ZayGNw7EEB423MCOj5gm4DDWMcfDlPYoe/VXfqVsAlxJdVQSR7wcChc/34YgAAA',
  };

  // WMO weather-interpretation codes (Open-Meteo `weather_code`) → a small
  // emoji + label set. Grouped into the buckets that read at a glance on a
  // day header; the full code list collapses into ~9 conditions.
  function wxInfo(code) {
    if (code == null) return { icon: '', label: '' };
    if (code === 0) return { icon: '☀️', label: 'Clear' };
    if (code === 1) return { icon: '🌤️', label: 'Mainly clear' };
    if (code === 2) return { icon: '⛅', label: 'Partly cloudy' };
    if (code === 3) return { icon: '☁️', label: 'Overcast' };
    if (code === 45 || code === 48) return { icon: '🌫️', label: 'Fog' };
    if (code >= 51 && code <= 57) return { icon: '🌦️', label: 'Drizzle' };
    if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { icon: '🌧️', label: 'Rain' };
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { icon: '🌨️', label: 'Snow' };
    if (code >= 95) return { icon: '⛈️', label: 'Thunderstorm' };
    return { icon: '', label: '' };
  }

  const CITY_COORDS = {
    'new york': [40.6413, -73.7781], 'jfk': [40.6413, -73.7781],
    'newark': [40.6895, -74.1745], 'ewr': [40.6895, -74.1745],
    'vancouver': [49.1939, -123.1844], 'yvr': [49.1939, -123.1844],
    'prague': [50.0755, 14.4378], 'krakow': [50.0647, 19.9450],
    'budapest': [47.4979, 19.0402],
    'paris': [48.8566, 2.3522], 'cdg': [49.0097, 2.5479],
    'copenhagen': [55.6761, 12.5683], 'cph': [55.6761, 12.5683],
    'bergen': [60.3913, 5.3221], 'oslo': [59.9139, 10.7522], 'stockholm': [59.3293, 18.0686],
    'vienna': [48.2082, 16.3738], 'hallstatt': [47.5622, 13.6493], 'munich': [48.1351, 11.5820],
    'bratislava': [48.1486, 17.1077], 'berlin': [52.5200, 13.4050], 'amsterdam': [52.3676, 4.9041],
    'zurich': [47.3769, 8.5417], 'ljubljana': [46.0569, 14.5058], 'bled': [46.3683, 14.1147],
    'venice': [45.4408, 12.3155], 'rome': [41.9028, 12.4964], 'warsaw': [52.2297, 21.0122],
    // British Isles
    'london': [51.5074, -0.1278], 'edinburgh': [55.9533, -3.1883], 'dublin': [53.3498, -6.2603],
    'manchester': [53.4808, -2.2426], 'glasgow': [55.8642, -4.2518], 'birmingham': [52.4862, -1.8904],
    'bristol': [51.4545, -2.5879], 'liverpool': [53.4084, -2.9916],
    // France / Benelux
    'marseille': [43.2965, 5.3698], 'lyon': [45.7640, 4.8357], 'bordeaux': [44.8378, -0.5792],
    'brussels': [50.8503, 4.3517], 'bruxelles': [50.8503, 4.3517], 'antwerp': [51.2194, 4.4025],
    'rotterdam': [51.9244, 4.4777], 'luxembourg': [49.6116, 6.1319],
    // Germany
    'cologne': [50.9333, 6.9500], 'koln': [50.9333, 6.9500],
    'frankfurt': [50.1109, 8.6821], 'hamburg': [53.5753, 10.0153], 'dusseldorf': [51.2217, 6.7762],
    'dresden': [51.0504, 13.7373], 'leipzig': [51.3397, 12.3731], 'stuttgart': [48.7758, 9.1829],
    'nuremberg': [49.4521, 11.0767], 'nurnberg': [49.4521, 11.0767], 'bonn': [50.7374, 7.0982],
    // Switzerland
    'bern': [46.9481, 7.4474], 'geneva': [46.2044, 6.1432], 'geneve': [46.2044, 6.1432],
    // Spain / Portugal
    'madrid': [40.4168, -3.7038], 'barcelona': [41.3851, 2.1734], 'seville': [37.3891, -5.9845],
    'sevilla': [37.3891, -5.9845], 'lisbon': [38.7223, -9.1393], 'lisboa': [38.7223, -9.1393],
    'porto': [41.1579, -8.6291], 'bilbao': [43.2630, -2.9350], 'valencia': [39.4699, -0.3763],
    // Scandinavia
    'helsinki': [60.1699, 24.9384], 'gothenburg': [57.7089, 11.9746], 'goteborg': [57.7089, 11.9746],
    'trondheim': [63.4305, 10.3951], 'malmo': [55.6050, 13.0038], 'aarhus': [56.1629, 10.2039],
    'turku': [60.4518, 22.2666], 'reykjavik': [64.1466, -21.9426],
    // Baltics
    'tallinn': [59.4370, 24.7536], 'riga': [56.9496, 24.1052],
    'vilnius': [54.6872, 25.2797], 'kaunas': [54.8985, 23.9036],
    // Eastern Europe
    'minsk': [53.9045, 27.5615],
    'kyiv': [50.4501, 30.5234], 'kiev': [50.4501, 30.5234], 'lviv': [49.8397, 24.0297],
    'odessa': [46.4825, 30.7233], 'chisinau': [47.0105, 28.6382],
    // Poland
    'wroclaw': [51.1079, 17.0385], 'poznan': [52.4064, 16.9252],
    'gdansk': [54.3520, 18.6466], 'lodz': [51.7592, 19.4560], 'lublin': [51.2465, 22.5684],
    'brno': [49.1951, 16.6068],
    // Austria
    'innsbruck': [47.2692, 11.4041], 'graz': [47.0707, 15.4395], 'linz': [48.3069, 14.2858],
    // Italy
    'milan': [45.4654, 9.1859], 'milano': [45.4654, 9.1859], 'florence': [43.7696, 11.2558],
    'firenze': [43.7696, 11.2558], 'naples': [40.8518, 14.2681], 'napoli': [40.8518, 14.2681],
    'bologna': [44.4949, 11.3426], 'turin': [45.0703, 7.6869], 'torino': [45.0703, 7.6869],
    'genoa': [44.4056, 8.9463], 'genova': [44.4056, 8.9463], 'pisa': [43.7228, 10.4017],
    'palermo': [38.1157, 13.3615], 'bari': [41.1171, 16.8719], 'catania': [37.5079, 15.0830],
    // Balkans
    'zagreb': [45.8150, 15.9819], 'sarajevo': [43.8563, 18.4131], 'belgrade': [44.8176, 20.4633],
    'sofia': [42.6977, 23.3219], 'bucharest': [44.4268, 26.1025], 'dubrovnik': [42.6507, 18.0944],
    'split': [43.5081, 16.4402], 'skopje': [41.9965, 21.4314], 'thessaloniki': [40.6401, 22.9444],
    'athens': [37.9838, 23.7275], 'istanbul': [41.0082, 28.9784], 'valletta': [35.8997, 14.5147],
    'tirana': [41.3275, 19.8189], 'podgorica': [42.4304, 19.2594],
    // North America
    'toronto': [43.6532, -79.3832], 'montreal': [45.5017, -73.5673], 'los angeles': [34.0522, -118.2437],
    'san francisco': [37.7749, -122.4194], 'chicago': [41.8781, -87.6298], 'boston': [42.3601, -71.0589],
    'seattle': [47.6062, -122.3321], 'washington': [38.9072, -77.0369], 'miami': [25.7617, -80.1918],
    'calgary': [51.0447, -114.0719], 'mexico city': [19.4326, -99.1332],
    // Asia
    'tokyo': [35.6762, 139.6503], 'osaka': [34.6937, 135.5023], 'kyoto': [35.0116, 135.7681],
    'seoul': [37.5665, 126.9780], 'busan': [35.1796, 129.0756],
    'beijing': [39.9042, 116.4074], 'shanghai': [31.2304, 121.4737], 'hong kong': [22.3193, 114.1694],
    'taipei': [25.0330, 121.5654], 'singapore': [1.3521, 103.8198], 'bangkok': [13.7563, 100.5018],
    'chiang mai': [18.7883, 98.9853], 'hanoi': [21.0285, 105.8542],
    'ho chi minh city': [10.8231, 106.6297], 'ho chi minh': [10.8231, 106.6297], 'saigon': [10.8231, 106.6297],
    'da nang': [16.0544, 108.2022], 'phnom penh': [11.5564, 104.9282], 'siem reap': [13.3671, 103.8448],
    'kuala lumpur': [3.1390, 101.6869], 'jakarta': [-6.2088, 106.8456], 'bali': [-8.4095, 115.1889],
    'denpasar': [-8.6705, 115.2126], 'manila': [14.5995, 120.9842],
    'delhi': [28.6139, 77.2090], 'mumbai': [19.0760, 72.8777],
    // Middle East / Africa
    'dubai': [25.2048, 55.2708], 'doha': [25.2854, 51.5310], 'tel aviv': [32.0853, 34.7818],
    'cairo': [30.0444, 31.2357], 'marrakech': [31.6295, -7.9811], 'cape town': [-33.9249, 18.4241],
    // Oceania / South America
    'sydney': [-33.8688, 151.2093], 'melbourne': [-37.8136, 144.9631], 'auckland': [-36.8509, 174.7645],
    'rio de janeiro': [-22.9068, -43.1729], 'sao paulo': [-23.5505, -46.6333],
    'buenos aires': [-34.6037, -58.3816], 'lima': [-12.0464, -77.0428]
  };

  const FX_CAD = {
    USD: 1.37, EUR: 1.48, GBP: 1.73, CHF: 1.58, CAD: 1,
    CZK: 0.062, PLN: 0.36, HUF: 0.0040, DKK: 0.198, NOK: 0.135, SEK: 0.137, RON: 0.30, BGN: 0.76, HRK: 0.20, ISK: 0.0099, TRY: 0.040, RUB: 0.015,
    JPY: 0.0091, CNY: 0.19, KRW: 0.00102, HKD: 0.176, TWD: 0.043, SGD: 1.02, THB: 0.040, MYR: 0.31, IDR: 0.000086, VND: 0.000054, PHP: 0.024, INR: 0.016,
    AED: 0.37, SAR: 0.37, QAR: 0.38, ILS: 0.37,
    AUD: 0.90, NZD: 0.83, MXN: 0.072, BRL: 0.25, ARS: 0.0014, CLP: 0.0014, ZAR: 0.075, EGP: 0.028, MAD: 0.14
  };
  const CITY_PASS_LOCAL = {
    'new york': { a: 8.90, c: 'USD' }, 'jfk': { a: 8.90, c: 'USD' }, 'newark': { a: 8.90, c: 'USD' }, 'ewr': { a: 8.90, c: 'USD' },
    'los angeles': { a: 7, c: 'USD' }, 'san francisco': { a: 5, c: 'USD' }, 'chicago': { a: 5, c: 'USD' }, 'washington': { a: 13.50, c: 'USD' },
    'boston': { a: 11, c: 'USD' }, 'seattle': { a: 8, c: 'USD' }, 'miami': { a: 5.65, c: 'USD' },
    'vancouver': { a: 11.25, c: 'CAD' }, 'yvr': { a: 11.25, c: 'CAD' }, 'toronto': { a: 13.50, c: 'CAD' }, 'montreal': { a: 11.50, c: 'CAD' }, 'calgary': { a: 11.25, c: 'CAD' },
    'mexico city': { a: 30, c: 'MXN' },
    'london': { a: 8.90, c: 'GBP' }, 'edinburgh': { a: 5, c: 'GBP' }, 'manchester': { a: 6.40, c: 'GBP' }, 'dublin': { a: 8, c: 'EUR' },
    'paris': { a: 8.65, c: 'EUR' }, 'cdg': { a: 8.65, c: 'EUR' }, 'nice': { a: 5, c: 'EUR' }, 'lyon': { a: 6.20, c: 'EUR' }, 'marseille': { a: 5.20, c: 'EUR' },
    'amsterdam': { a: 9, c: 'EUR' }, 'brussels': { a: 8, c: 'EUR' }, 'luxembourg': { a: 0, c: 'EUR' },
    'berlin': { a: 9.90, c: 'EUR' }, 'munich': { a: 9.20, c: 'EUR' }, 'frankfurt': { a: 8.90, c: 'EUR' }, 'hamburg': { a: 8.40, c: 'EUR' }, 'cologne': { a: 9.30, c: 'EUR' },
    'vienna': { a: 8, c: 'EUR' }, 'salzburg': { a: 6, c: 'EUR' }, 'hallstatt': { a: 3, c: 'EUR' },
    'zurich': { a: 8.80, c: 'CHF' }, 'geneva': { a: 10, c: 'CHF' }, 'bern': { a: 9, c: 'CHF' }, 'lucerne': { a: 8, c: 'CHF' },
    'copenhagen': { a: 90, c: 'DKK' }, 'bergen': { a: 119, c: 'NOK' }, 'oslo': { a: 121, c: 'NOK' }, 'stockholm': { a: 175, c: 'SEK' }, 'gothenburg': { a: 75, c: 'SEK' }, 'helsinki': { a: 9, c: 'EUR' }, 'reykjavik': { a: 1900, c: 'ISK' },
    'rome': { a: 7, c: 'EUR' }, 'florence': { a: 5, c: 'EUR' }, 'venice': { a: 25, c: 'EUR' }, 'milan': { a: 7.60, c: 'EUR' }, 'naples': { a: 4.50, c: 'EUR' },
    'madrid': { a: 8.40, c: 'EUR' }, 'barcelona': { a: 11.20, c: 'EUR' }, 'seville': { a: 5, c: 'EUR' }, 'lisbon': { a: 6.80, c: 'EUR' }, 'porto': { a: 7, c: 'EUR' },
    'athens': { a: 4.50, c: 'EUR' }, 'ljubljana': { a: 2.50, c: 'EUR' }, 'bled': { a: 3, c: 'EUR' }, 'dubrovnik': { a: 15, c: 'EUR' }, 'zagreb': { a: 4, c: 'EUR' },
    'prague': { a: 120, c: 'CZK' }, 'krakow': { a: 17, c: 'PLN' }, 'warsaw': { a: 15, c: 'PLN' }, 'budapest': { a: 2500, c: 'HUF' },
    'bratislava': { a: 3.50, c: 'EUR' }, 'bucharest': { a: 8, c: 'RON' }, 'sofia': { a: 4, c: 'BGN' }, 'istanbul': { a: 100, c: 'TRY' },
    'tokyo': { a: 600, c: 'JPY' }, 'osaka': { a: 800, c: 'JPY' }, 'kyoto': { a: 700, c: 'JPY' },
    'seoul': { a: 5000, c: 'KRW' }, 'singapore': { a: 12, c: 'SGD' }, 'bangkok': { a: 150, c: 'THB' },
    'dubai': { a: 22, c: 'AED' }, 'sydney': { a: 17.80, c: 'AUD' }, 'auckland': { a: 20, c: 'NZD' },
    'cape town': { a: 60, c: 'ZAR' }, 'marrakech': { a: 40, c: 'MAD' }
  };
  const DEFAULT_PASS = { a: 10, c: 'USD' };

  const WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  /* ---- icons (Lucide-style) ---- */
  const I = {
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    sync: '<path d="M21 12a9 9 0 0 0-15-6.7L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 15 6.7L21 16"/><path d="M21 21v-5h-5"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
    building: '<path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/><path d="M9 9v.01"/><path d="M9 12v.01"/><path d="M9 15v.01"/><path d="M9 18v.01"/>',
    bed: '<path d="M2 20V10a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v10"/><path d="M2 20h20"/><rect x="6" y="10" width="5" height="4" rx="1.5"/><rect x="13" y="10" width="5" height="4" rx="1.5"/>',
    pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    msg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
    grip: '<circle cx="3.5" cy="3" r="1.5"/><circle cx="8.5" cy="3" r="1.5"/><circle cx="3.5" cy="8" r="1.5"/><circle cx="8.5" cy="8" r="1.5"/><circle cx="3.5" cy="13" r="1.5"/><circle cx="8.5" cy="13" r="1.5"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    spark: '<path d="M12 3l1.6 5.1L19 9.7l-4.4 2.9L16 18l-4-3.2L8 18l1.4-5.4L5 9.7l5.4-.6z"/>',
    clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
    sticker: '<rect x="3" y="3" width="18" height="18" rx="2.5"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
    route: '<rect x="3" y="4" width="18" height="14" rx="3"/><path d="M3 10h18"/><rect x="7" y="6" width="4" height="3" rx="1"/><rect x="13" y="6" width="4" height="3" rx="1"/><path d="M7 18l-2 3"/><path d="M17 18l2 3"/>',
    home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 9.5V20a1 1 0 0 0 1 1H10v-6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v6h3.5a1 1 0 0 0 1-1V9.5"/>'
  };
  const svg = (paths, opt = {}) => {
    const { w = 16, h = 16, sw = 2, fill = 'none', stroke = 'currentColor' } = opt;
    return `<svg width="${w}" height="${h}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  };

  /* ---- small utils ---- */
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const escA = (s) => esc(s).replace(/"/g, '&quot;');
  const money = (n) => '$' + Math.round(n).toLocaleString();
  const RX_DIACRITICS = /[̀-ͯ]/g;
  const normKey = (s) => (s || '').normalize('NFD').replace(RX_DIACRITICS, '').toLowerCase().trim();

  class Planner {
    constructor(root) {
      this.root = root;
      this.data = clone(DEFAULT_STATE);
      // transient ui state
      this.openStopIdx = null;
      this.activeDay = null;
      this.accomOpenIdx = null;
      this.transportOpenIdx = null;
      this.budgetOpen = false;
      this._savedShow = false;
      this._dragStopIdx = null;
      this._dragKey = null;
      this._plannerDrag = null;
      this._lastCoordKey = '';
      this._history = [];
      this.stickerPanelOpen = false;
      // ---- web ledger (≥701px): a vertical stack of full-width leaves —
      // scrolling down slides the next page up from below, the same motion
      // as the intro→trip scroll. Which leaf is open + the slide lock are
      // pure view state.
      this.magIdx = 0;              // 0 route · 1 itinerary · 2 transport&hotels · 3 packing&to-do
      this._magAnimating = false;
      // ---- app (≤700px): the phone twin of the ledger — an overview page with
      // entry cards that rise a sub-page up (Itinerary / Hotel / Transportation)
      // with a tab bar pinned on top. appStopIdx is the shared stop selection.
      this.appPage = 0;             // 0 overview · 1 itinerary · 2 hotel · 3 transport
      this.appStopIdx = 0;
      this._appAnimating = false;
      this.packOpen = null;         // packing slot whose popover is pinned open (view state)
      this._pkAnim = 'closed';      // packing sheet animation state: closed → open
      this._pkIO = ('IntersectionObserver' in window) ? new IntersectionObserver((es) => es.forEach(e => {
        if (e.isIntersecting && e.intersectionRatio >= .35) this._playPackAnim(325);
        else if (!e.isIntersecting) this._setPackAnim('closed');
      }), { threshold: [0, .35] }) : null;
      this._wheelAcc = 0;           // trackpad delta accumulator for page turns
      this._wheelT = 0;
      // ---- cloud sync (shared row via Supabase, no sign-in) ----
      this.sync = this.loadSyncRec();   // { id, rev, lastSyncedAt }; id = the shared row once connected
      this.sync.id = null;              // set to SHARED_ID once the cloud client is up
      this._sb = null;                  // lazily-created Supabase client
      this._rt = null;                  // realtime channel subscription
      this.syncOpen = false;            // sync modal open?
      this._syncBusy = false;           // an in-flight request guards against overlap
      this._syncStatus = 'off';         // off|syncing|synced|offline|error
      this._syncMsg = '';
      this._syncCodeDraft = '';
      this._cloudPushTimer = null;
      this._syncPoll = null;
      this._stockStickerDrag = null;
      this._movingSticker = null;
      this._resizingSticker = null;
      this._dragCellImg = null;
      this._onPM = null;
      this._onPU = null;
      // persistent aside map node (survives re-renders)
      this.mapEl = document.createElement('div');
      this.mapEl.className = 'map';
      // modal container outside root so modal open/close never re-renders main content
      this.modalEl = document.createElement('div');
      this.modalEl.id = 'modal-root';
      document.body.appendChild(this.modalEl);
      // per-day itinerary map (second persistent Leaflet instance, lives inside the modal)
      this.dayMapEl = document.createElement('div');
      this.dayMapEl.className = 'map daymap';
      this._geoCache = new Map();   // normalized address -> {lat,lng} | null (runtime only)
      this._geoQueue = Promise.resolve();
      this._geoLast = 0;
      this._wxCache = new Map();     // "lat,lng|start|end" -> { kind, ts, days:{ iso:{code,hi,lo,pop} } }
      this._wxPending = new Set();   // in-flight weather keys (dedupe fetches)
      this._loadWeather();           // rehydrate non-stale cached weather
      this._flashItem = null;       // item index to flash once after a pin click
      this._selectedItem = null;    // item index persistently highlighted by pin toggle
      this._optimizeNote = null;    // result banner from the route optimizer
      this._mapCardDrag = null;
      // persistent main map nodes (survive re-renders)
      this.mainMapEl = document.createElement('div');
      this.mainMapEl.className = 'main-map-leaflet';
      this.mainLeafletMap = null;
      this.mainMapLines = null;
      this._editingStopIdx = null;
      // mobile map popup (≤700px): which stop's card is open, and whether it
      // shows the edit (back) face. Not persisted — purely view state.
      this._openMapCardIdx = null;
      this._openMapCardFlipped = false;
      this.mainCardsOverlayEl = document.createElement('div');
      this.mainCardsOverlayEl.className = 'main-cards-overlay';
      document.addEventListener('pointerdown', (e) => {
        if (this._editingStopIdx != null) {
          const editingCard = this.mainCardsOverlayEl.querySelector(`.map-stop[data-i="${this._editingStopIdx}"]`);
          if (editingCard && !editingCard.contains(e.target)) {
            editingCard.classList.remove('mc-editing');
            this._editingStopIdx = null;
          }
        }
        // mobile popup stays open until a tap lands outside the card and outside any pin
        if (this._openMapCardIdx != null && this._mobileMap()) {
          const openCard = this.mainCardsOverlayEl.querySelector(`.map-stop[data-i="${this._openMapCardIdx}"]`);
          const onPin = e.target.closest && e.target.closest('.map-pin-outer');
          if ((!openCard || !openCard.contains(e.target)) && !onPin) this._closeMapPopup();
        }
      }, true);
      // tap on the open popup's front face flips it to the edit face (no :hover on touch)
      this.mainCardsOverlayEl.addEventListener('click', (e) => {
        if (!this._mobileMap()) return;
        const cardEl = e.target.closest('.map-stop');
        if (!cardEl || !e.target.closest('.mc-front')) return;
        if (Number(cardEl.dataset.i) !== this._openMapCardIdx) return;
        this._openMapCardFlipped = true;
        cardEl.classList.add('mc-editing');
        this._positionMainCards();   // re-clamp at the larger editing width so it stays inside the map
      });
      this.mainPinsOverlayEl = document.createElement('div');
      this.mainPinsOverlayEl.className = 'main-pins-overlay pins-wait';
      // stop pins drop in when the map scrolls into view (same scroll-trigger
      // feel as the packing sheet). The overlay is a persistent node that rides
      // inside whichever #main-map-holder is active, so one observer covers both
      // the phone map and the web ledger's route leaf. The container class
      // (pins-wait → pins-drop → settled) persists across renderMainMap's
      // innerHTML rebuilds, so freshly-built pins inherit the right state.
      this._pinsDropped = false;
      this._pinIO = ('IntersectionObserver' in window) ? new IntersectionObserver((es) => es.forEach(e => {
        if (e.isIntersecting && e.intersectionRatio >= .35) this._dropPins();
        else if (!e.isIntersecting) this._resetPins();
      }), { threshold: [0, .35] }) : null;
      if (this._pinIO) this._pinIO.observe(this.mainPinsOverlayEl);
      // web ledger: hovering a pin previews that stop in the column's card
      // slot (patched in place — no full re-render on a hover)
      this.stopInfoIdx = null;
      this.mainPinsOverlayEl.addEventListener('mouseover', (e) => {
        if (!this._webMag()) return;
        const pin = e.target.closest('.map-pin-outer');
        if (!pin) return;
        const idx = Number(pin.dataset.pin);
        if (idx === this.stopInfoIdx) return;
        this.stopInfoIdx = idx;
        this._paintStopSpot();
      });
      // tapping a pin: web ledger opens that stop's dock card (touch has no
      // hover); the phone app opens the on-map popup.
      this.mainPinsOverlayEl.addEventListener('click', (e) => {
        const pin = e.target.closest('.map-pin-outer');
        if (!pin) return;
        const idx = Number(pin.dataset.pin);
        if (this._webMag()) { this.stopInfoIdx = idx; this._paintStopSpot(); return; }
        if (!this._mobileMap()) return;
        if (this._openMapCardIdx === idx) return;   // already open — tap edits the order number
        this._openMapCardIdx = idx;
        this._openMapCardFlipped = false;
        this._syncPinOpenClass();
        this._positionMainCards();
      });
      this.mainCityLabelsEl = document.createElement('div');
      this.mainCityLabelsEl.className = 'main-city-labels-overlay';
      this._mapCities = [];
      this.mainLeadersEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      this.mainLeadersEl.setAttribute('class', 'main-leaders-svg');
      this.mainLeadersEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      this._lastMainCoordKey = '';
    }

    /* ---------- lifecycle ---------- */
    init() {
      this.wireDelegation();
      this.loadState();
      this.initTopActions();
      this.render();
      this.ensureMap(0);
      this.initIntro();
      this.initLedgerNav();
      this.initTouchPointer();
      // crossing the mobile-map breakpoint (resizing an iPad window, rotating)
      // swaps the whole layout live: ≤700px the app page, ≥701px the web ledger.
      // Leaving the ledger, its always-open leaf selections must not linger as
      // "open modals" on the app side (and vice versa: entering it needs defaults).
      try {
        window.matchMedia('(max-width: 700px)').addEventListener('change', () => {
          this._openMapCardIdx = null; this._openMapCardFlipped = false;
          if (!this._webMag()) { this.openStopIdx = null; this.accomOpenIdx = null; this.budgetOpen = false; }
          this._magAnimating = false;
          this.render();
          this.touchMap();
        });
      } catch (e) { /* very old Safari: no MQL addEventListener — a reload still applies the right mode */ }
      this.startSyncLoop();
      // Shared sync: connect to the shared row, load it (or seed it from this
      // device), and subscribe to realtime updates from other devices. No sign-in.
      this.initCloud();
      // one-time cleanup: shrink any full-res images saved before stickers were
      // downscaled on intake. A single oversized sticker bloats the payload past
      // the store's cap and blocks ALL sync, so this unsticks devices that were
      // already carrying big memories/closet photos.
      setTimeout(() => this.compactStoredImages(), 1500);
    }
    // Re-encode oversized stored images (legacy full-res stickers/outfits) through
    // the same downscale+WebP pipeline new images already use. Runs at most once
    // per device; only rewrites images that actually shrink, then saves + syncs.
    async compactStoredImages() {
      if (this._compactedImages) return;
      this._compactedImages = true;
      const BIG = 260000;   // ~260KB of base64 — comfortably above a compacted sticker, below a raw photo
      let changed = false;
      const shrink = async (url) => {
        if (typeof url !== 'string' || url.length <= BIG || url.indexOf('data:image/') !== 0) return url;
        try { const out = await this.autoCutout(url); if (out && out.length < url.length) { changed = true; return out; } } catch (e) {}
        return url;
      };
      const d = this.data;
      for (const s of d.stickerStock || []) s.image = await shrink(s.image);
      for (const ps of d.placedStickers || []) {
        const st = (d.stickerStock || []).find(s => s.id === ps.stockId);
        if (st && st.image != null) { if (ps.image !== st.image) { ps.image = st.image; changed = true; } }
        else ps.image = await shrink(ps.image);
      }
      for (const trip of Object.values(d.trips || {})) {
        for (const o of trip.closet || []) o.image = await shrink(o.image);
        for (const stop of trip.stops || []) for (const day of stop.itinerary || []) for (const outfit of (day && day.outfits) || []) {
          const co = (trip.closet || []).find(c => c.id === outfit.id);
          if (co && co.image != null) { if (outfit.image !== co.image) { outfit.image = co.image; changed = true; } }
          else outfit.image = await shrink(outfit.image);
        }
      }
      if (!changed) return;
      this.saveLocalNow();
      if (this.isLinked()) { this.sync.rev = Date.now(); this.persistSyncRec(); this.scheduleCloudPush(); }
      this.render(); this.bumpModal(); this.touchMap();
    }
    /* Touch pointer indicator: iOS/iPadOS have no cursor, so show the same
       dashed arrow at the fingertip — but only for taps and drags. When the
       browser claims the gesture as a scroll it fires pointercancel (and the
       page scrolls), so we hide instantly there; app drags capture the pointer
       (touch-action:none grips), so no cancel fires and the arrow follows the
       finger. Passive + pointer-events:none — never blocks any interaction. */
    initTouchPointer() {
      if (this._touchArrow) return;
      const el = document.createElement('div');
      el.className = 'touch-arrow';
      el.setAttribute('aria-hidden', 'true');
      document.body.appendChild(el);
      this._touchArrow = el;
      const SIZE = 34, TIPX = SIZE * 21 / 32, TIPY = SIZE * 20 / 32, LIFT = 8;
      let raf = 0, x = 0, y = 0, hideT = 0, down = false;
      const place = () => { raf = 0; el.style.transform = `translate3d(${x - LIFT - TIPX}px, ${y - LIFT - TIPY}px, 0)`; };
      const show = (e) => {
        if (e.pointerType !== 'touch') return;     // real cursor handles mouse/pen
        if (e.type === 'pointerdown') down = true;
        else if (!down) return;                    // ignore stray moves outside a touch
        x = e.clientX; y = e.clientY;
        clearTimeout(hideT);
        el.classList.add('on');
        if (!raf) raf = requestAnimationFrame(place);
      };
      const hideNow = () => { down = false; clearTimeout(hideT); el.classList.remove('on'); };
      const hide = (e) => {
        if (e && e.pointerType && e.pointerType !== 'touch') return;
        down = false;
        clearTimeout(hideT);
        hideT = setTimeout(() => el.classList.remove('on'), 240);   // brief linger after a tap/drag ends
      };
      document.addEventListener('pointerdown', show, { passive: true });
      document.addEventListener('pointermove', show, { passive: true });
      document.addEventListener('pointerup', hide, { passive: true });
      // scroll took over (browser cancels the pointer stream) → not a tap/drag: vanish at once
      document.addEventListener('pointercancel', (e) => { if (!e.pointerType || e.pointerType === 'touch') hideNow(); }, { passive: true });
      document.addEventListener('scroll', () => { if (down || el.classList.contains('on')) hideNow(); }, { passive: true, capture: true });
    }

    /* ============================================================
       STARTUP / LOADING PAGE
       ------------------------------------------------------------
       Full-screen editorial hero shown on every launch, above the
       trip page: editable headline (persisted in meta.introText,
       synced like everything else) + a transparent wireframe globe
       plotting all current stops linked by the route. Scrolling
       down eases the text 0→40px (4px lateral offset), rotates the
       globe 358°, and slides the whole page up to reveal the app.
       ============================================================ */
    /* ============================================================
       TOP ACTIONS — fixed cluster at the top right of the screen:
       undo · sync · memory · dark-mode toggle. Lives on <body> at
       z 1600 (above modals 1000, sticker layer 1020, drag ghost
       1200, intro overlay 1500), so it stays visible and clickable
       on the intro page, the trip page, and over open modals.
       ============================================================ */
    initTopActions() {
      const ta = document.createElement('div');
      ta.className = 'top-actions';
      ta.innerHTML = `
        <button class="tool-btn" data-act="undo" title="Undo (⌘Z)" aria-label="Undo" disabled>${svg(I.undo)}</button>
        <button class="tool-btn sync-toggle-btn" data-act="open-sync" title="Sync across devices" aria-label="Sync across devices"><span class="sync-dot s-off"></span>${svg(I.sync)}</button>
        <button class="tool-btn sticker-toggle-btn" data-act="toggle-stickers" title="Memories" aria-label="Memories">${svg(I.sticker)}</button>
        <button class="theme-btn" data-act="toggle-theme" aria-label="Toggle dark mode" title="Toggle dark mode">
          <svg class="ic-moon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
          <svg class="ic-sun" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
        </button>`;
      document.body.appendChild(ta);
      this.topActionsEl = ta;
      ta.addEventListener('click', (e) => this.onClick(e));   // same delegated dispatch as the app root
      // pre-paint boot may have set dark before the app booted — sync the meta
      const themeMeta = document.querySelector('meta[name="theme-color"]');   // absent in standalone.html
      if (themeMeta && document.documentElement.getAttribute('data-theme') === 'dark') themeMeta.setAttribute('content', '#121210');
      this.updateTopActions();
    }
    toggleTheme() {
      const dark = document.documentElement.getAttribute('data-theme') !== 'dark';
      if (dark) document.documentElement.setAttribute('data-theme', 'dark');
      else document.documentElement.removeAttribute('data-theme');
      const themeMeta = document.querySelector('meta[name="theme-color"]');
      if (themeMeta) themeMeta.setAttribute('content', dark ? '#121210' : '#e8e4dc');
      try { localStorage.setItem('europe-trip-theme-v1', dark ? 'dark' : 'light'); } catch (e) {}
      if (this._introGlobeRefresh) this._introGlobeRefresh();   // globe strokes re-read --ink/--red
      this.updateTopActions();
    }
    _anyModalOpen() {
      // web ledger: itinerary/accom/transport live on always-open leaves, not
      // modals — only the bill and the floating panels count as "open" there
      // app itinerary/accom/transport now live on always-rendered leaves too
      // (not modals), so only the bill and the floating panels count as "open"
      return this.syncOpen || this.budgetOpen || this.stickerPanelOpen;
    }
    // sync pulls must not clobber content mid-edit. The app blocks while an
    // editing modal is open; the ledger's leaves are always open, so there we
    // block only while the user is actually typing in a field.
    _syncEditGuard() {
      // both layouts now keep their pages always-rendered, so block a clobbering
      // pull only while the user is actually typing in a field (or the bill's open)
      const ae = document.activeElement;
      if (ae && (ae.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName))) return true;
      return this.budgetOpen;
    }
    updateTopActions() {
      const ta = this.topActionsEl; if (!ta) return;
      const undoBtn = ta.querySelector('[data-act="undo"]');
      if (undoBtn) undoBtn.disabled = !this._history.length;
      const syncBtn = ta.querySelector('.sync-toggle-btn');
      if (syncBtn) {
        syncBtn.classList.toggle('active', this.isLinked());
        // sync lives on the intro page only: hide it once scrolled to the trip
        // page (parked) or while any modal/panel is open
        syncBtn.style.display = (this._introParked || this._anyModalOpen()) ? 'none' : '';
      }
      const dot = ta.querySelector('.sync-dot');
      if (dot) dot.className = 'sync-dot s-' + (this.isLinked() ? this._syncStatus : 'off');
      const memBtn = ta.querySelector('.sticker-toggle-btn');
      if (memBtn) memBtn.classList.toggle('active', this.stickerPanelOpen);
      const themeBtn = ta.querySelector('[data-act="toggle-theme"]');
      if (themeBtn) themeBtn.setAttribute('aria-pressed', String(document.documentElement.getAttribute('data-theme') === 'dark'));
    }

    initIntro() {
      if (this._introEl) return;
      const overlay = document.createElement('div');
      overlay.className = 'intro-overlay';
      // globe first in the DOM: on wide screens it floats left and the headline
      // wraps along its right curve (shape-outside); on phones flex `order`
      // puts the text first with the globe centered beneath, overlapping.
      overlay.innerHTML = `
        <div class="intro-inner">
          <div class="intro-globe"><svg viewBox="0 0 400 400" aria-hidden="true"></svg></div>
          <div class="intro-text" contenteditable="true" spellcheck="false" aria-label="Edit intro text"></div>
        </div>
        <div class="intro-tabs" role="tablist" aria-label="Trips"></div>`;
      document.body.appendChild(overlay);
      this._introEl = overlay;
      document.documentElement.classList.add('intro-lock');

      const textEl = overlay.querySelector('.intro-text');
      textEl.textContent = (this.data.meta.introText != null ? this.data.meta.introText : DEFAULT_INTRO_TEXT);
      textEl.addEventListener('input', () => {
        this.data.meta.introText = textEl.innerText.replace(/\s+$/,'');
        this.scheduleSave();
      });

      const globeWrap = overlay.querySelector('.intro-globe');
      const svg = overlay.querySelector('.intro-globe svg');
      this._buildIntroGlobe(svg);                       // graticule + stops now…
      this._ensureAtlas().then(() => this._buildIntroGlobe(svg));   // …continents when the atlas lands
      this._introGlobeRefresh = () => this._buildIntroGlobe(svg);   // stops added while intro open
      // pointer parallax: nudge the globe a few degrees toward the cursor
      this._globePar = this._globePar || { lat: 0, lng: 0, tlat: 0, tlng: 0 };
      globeWrap.addEventListener('pointermove', (e) => {
        const r = globeWrap.getBoundingClientRect();
        this._globePar.tlng = ((e.clientX - r.left) / r.width - 0.5) * 22;    // ±11°
        this._globePar.tlat = -((e.clientY - r.top) / r.height - 0.5) * 16;   // ±8°
        this._startGlobeIdle();
      });
      globeWrap.addEventListener('pointerleave', () => { this._globePar.tlat = 0; this._globePar.tlng = 0; });

      // ---- trip-tab row, now living at the bottom of the intro (the "+" first,
      // then the tabs; the row scrolls left/right and never wraps). It stays wired
      // to the trip page + globe: selecting/adding/reordering runs the normal
      // handlers, so `this.data.active` changes propagate to both. ----
      const introTabsEl = overlay.querySelector('.intro-tabs');
      const renderIntroTabs = () => {
        const keepScroll = introTabsEl.scrollLeft;
        introTabsEl.innerHTML = this.renderTabs();
        introTabsEl.scrollLeft = keepScroll;            // don't jump the row on re-render
      };
      renderIntroTabs();
      this._introTabsEl = introTabsEl;
      this._introTabsRefresh = renderIntroTabs;
      // the tab row lives outside #app, so wire the same delegated handlers the
      // trip page uses (wireDelegation binds only #app + modals). Covers click
      // (select/add/remove), change (rename), and native drag reorder.
      overlay.addEventListener('click', (e) => this.onClick(e));
      overlay.addEventListener('change', (e) => this.onChange(e));
      overlay.addEventListener('dragstart', (e) => this.onDragStart(e));
      overlay.addEventListener('dragover', (e) => this.onDragOver(e));
      overlay.addEventListener('drop', (e) => this.onDrop(e));
      overlay.addEventListener('dragend', (e) => this.onDragEnd(e));
      overlay.addEventListener('pointerdown', (e) => this.onPointerDown(e));   // touch drag-reorder (native DnD never fires from touch)
      // editing a tab name shouldn't start an ancestor drag (mirrors wireDelegation)
      overlay.addEventListener('focusin', (e) => {
        const t = e.target;
        if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) {
          let el = t.parentElement;
          while (el && el !== overlay) { if (el.getAttribute && el.getAttribute('draggable') === 'true') { el.setAttribute('draggable', 'false'); el.dataset.dragRestore = '1'; } el = el.parentElement; }
        }
      });
      overlay.addEventListener('focusout', () => { overlay.querySelectorAll('[data-drag-restore="1"]').forEach(el => { el.setAttribute('draggable', 'true'); delete el.dataset.dragRestore; }); });

      // ---- seamless scroll driver: the intro and the trip page behave like
      // one tall page. Wheel/touch track ~1:1; fully scrolled the intro PARKS
      // (hidden, non-interactive) instead of being removed, and scrolling up
      // at the top of the trip page pulls it back down. ----
      // The intro (fixed overlay) slides UP while the trip page slides up from
      // BELOW to replace it — the two move together, not a curtain lifting off a
      // static page. The trip page (#app) is a tall document, so it's driven in
      // viewport PIXELS (not %, which would be a % of its own content height) so
      // its top edge meets the intro's bottom edge exactly.
      const appRoot = document.getElementById('app');
      const vh = () => window.innerHeight;
      appRoot.style.transform = `translate3d(0, ${vh()}px, 0)`;   // start fully below the fold
      appRoot.style.willChange = 'transform';
      const easeInOut = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      let target = 0, cur = 0, raf = 0, parked = false;
      const clamp01 = (v) => Math.max(0, Math.min(1, v));
      const park = () => {
        if (parked) return;
        parked = true;
        overlay.classList.add('intro-parked');
        appRoot.style.transform = '';                              // hand the trip page back to native flow
        appRoot.style.willChange = '';                             // (so scroll + position:fixed work normally)
        document.documentElement.classList.remove('intro-lock');   // page scrolls natively again
        this._introParked = true; this.updateTopActions();         // hide the intro-only sync button
        this._stopGlobeIdle();                                     // globe is off-screen now — stop idle spin
        this._statPrev = {};                                       // count the stats up when first revealed
        this._animateStats();
        const active = this.root.querySelector('.ledger-leaf.active') || this.root.querySelector('.app-ov');
        this._playEnter(active && (active.querySelector('.leaf-inner') || active));
      };
      const unpark = () => {
        if (!parked) return;
        parked = false;
        overlay.classList.remove('intro-parked');
        appRoot.style.willChange = 'transform';
        document.documentElement.classList.add('intro-lock');
        this._introParked = false; this.updateTopActions();        // sync button returns with the intro
        this._startGlobeIdle();                                    // globe visible again — resume idle spin
      };
      const apply = () => {
        raf = 0;
        cur += (target - cur) * 0.38;                    // tracking — a touch snappier (settles faster, still a smooth glide)
        if (Math.abs(target - cur) < 0.0008) cur = target;
        const e = easeInOut(clamp01(cur));
        overlay.style.transform = `translate3d(0, ${(-cur * 100).toFixed(3)}%, 0)`;
        appRoot.style.transform = `translate3d(0, ${((1 - cur) * vh()).toFixed(2)}px, 0)`;   // rises from below to fill
        textEl.style.transform = `translate3d(${(e * 4).toFixed(2)}px, ${(e * 40).toFixed(2)}px, 0)`;   // down 0→40px, 4px offset
        globeWrap.style.transform = `rotate(${(cur * 358).toFixed(2)}deg)`;                              // rotate 358°
        if (cur >= 0.999) park(); else unpark();
        if (cur !== target) raf = requestAnimationFrame(apply);
      };
      const kick = () => { if (!raf) raf = requestAnimationFrame(apply); };
      // "at the very top of the app" — window unscrolled and no ancestor of the
      // event target scrolled down (aside lists, modals keep their own scroll)
      const atAppTop = (t) => {
        // web ledger: only page 1 hands the gesture back to the cover —
        // deeper pages flip back through the notebook first
        if (this._webMag() && this.magIdx !== 0) return false;
        if (t && t.closest && t.closest('.overlay, .sticker-panel')) return false;
        let el = t instanceof Element ? t : null;
        while (el && el !== document.body) { if (el.scrollTop > 1) return false; el = el.parentElement; }
        return (window.scrollY || document.documentElement.scrollTop || 0) <= 1;
      };
      const onTabs = (t) => t && t.closest && t.closest('.intro-tabs');
      const onModal = (t) => t && t.closest && t.closest('.overlay, .sticker-panel');   // sync/memory opened over the intro
      const onWheel = (e) => {
        if (onModal(e.target)) return;                   // let the modal/panel scroll natively, don't drive the intro
        if (onTabs(e.target)) {                          // scroll the tab row sideways, don't drive the intro
          introTabsEl.scrollLeft += (e.deltaX || e.deltaY);
          e.preventDefault();
          return;
        }
        // Web ledger: the cover is a discrete open/close, not a scrubbable
        // scroll — a wheel notch snaps the transition all the way (target 0/1)
        // so it never settles half-open (the "half intro, half page" state).
        // The phone app keeps the 1:1 incremental drag (with flick inertia).
        const web = this._webMag();
        if (parked) {
          if (e.deltaY < 0 && atAppTop(e.target)) {      // pull the intro back down
            e.preventDefault();
            target = web ? 0 : clamp01(target + e.deltaY * 1.3 / window.innerHeight);
            kick();
          }
          return;                                        // otherwise: native scroll
        }
        e.preventDefault();
        target = web ? (e.deltaY > 0 ? 1 : 0) : clamp01(target + e.deltaY * 1.3 / window.innerHeight);
        kick();
      };
      let touchY = null, touchV = 0, touchT = 0, touchDriving = false;
      const onTouchStart = (e) => {
        if (onModal(e.target) || onTabs(e.target)) { touchY = null; return; }  // let modals/panel + tab row scroll natively
        touchY = e.touches[0].clientY; touchV = 0; touchT = e.timeStamp; touchDriving = !parked;
      };
      const onTouchMove = (e) => {
        if (touchY == null) return;
        const y = e.touches[0].clientY;
        const dy = touchY - y;                            // >0 = finger up = scroll down
        if (parked && !touchDriving) {
          if (dy < 0 && atAppTop(e.target)) touchDriving = true;   // pulling down at the top
          else { touchY = y; return; }                    // native page scroll
        }
        const dt = Math.max(1, e.timeStamp - touchT);
        touchV = dy / dt;                                 // px/ms for release inertia
        touchT = e.timeStamp;
        target = clamp01(target + dy / window.innerHeight);        // ~1:1 with the finger
        touchY = y;
        e.preventDefault();
        kick();
      };
      const onTouchEnd = () => {
        if (touchY != null && touchDriving) {
          target = clamp01(target + touchV * 340 / window.innerHeight);   // flick inertia — carries further so a flick completes the transition
          kick();
        }
        touchY = null; touchDriving = false;
      };
      document.addEventListener('wheel', onWheel, { passive: false, capture: true });
      document.addEventListener('touchstart', onTouchStart, { passive: true, capture: true });
      document.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
      document.addEventListener('touchend', onTouchEnd, { passive: true, capture: true });
      const onKey = (e) => {
        const ae = document.activeElement;
        if (ae === textEl || (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName))) return;   // typing in the headline or a tab name
        if (parked) {
          if ((e.key === 'ArrowUp' || e.key === 'PageUp') && atAppTop(e.target)) { e.preventDefault(); target = 0; kick(); }
          return;
        }
        if (e.key === ' ' || e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === 'Enter') { e.preventDefault(); target = 1; kick(); }
        else if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); target = 0; kick(); }
      };
      document.addEventListener('keydown', onKey, true);
      // tests / power users: jump straight to the app
      this._introSkip = () => { target = 1; cur = 1; apply(); };
      // web ledger: "close the notebook" — ease the cover back down
      this._introReturn = () => { target = 0; kick(); };
    }
    skipIntro() { if (this._introSkip) this._introSkip(); }

    // Transparent wireframe globe (orthographic): graticule + continent outlines
    // + every stop as a red dot, consecutive stops linked by dashed route lines.
    // Big view changes (switching trips across regions) don't snap — the globe
    // SPINS horizontally to face the new trip, easing lng around the shortest
    // arc (lat follows) and re-projecting every frame.
    _buildIntroGlobe(svg) {
      if (!svg) return;
      const stops = this.currentTrip().stops
        .map(s => this.resolveCoord(s.city))
        .filter(Boolean);
      this._globeSvg = svg; this._globeStops = stops;               // shared with the idle-spin loop
      this._globePar = this._globePar || { lat: 0, lng: 0, tlat: 0, tlng: 0 };
      // target view: the trip's centroid (fallback: Europe). Cap the latitude so
      // high-latitude trips (Europe/Scandinavia) don't tilt the globe so far north
      // that the pole and its converging meridians dominate the top.
      const tLatRaw = stops.length ? stops.reduce((a, c) => a + c[0], 0) / stops.length : 47;
      const tLat = Math.min(tLatRaw, 35);
      const tLng = stops.length ? stops.reduce((a, c) => a + c[1], 0) / stops.length : 12;
      cancelAnimationFrame(this._globeAnim || 0);
      const cur = this._globeView;
      const dLng = cur ? ((tLng - cur.lng + 540) % 360) - 180 : 0;   // shortest way around
      const dLat = cur ? tLat - cur.lat : 0;
      const dist = cur ? Math.hypot(dLng, dLat) : 0;
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      // Instant draw (no spin) when: first paint · reduced-motion · a small
      // nudge (nearby stop, re-theme, atlas landing) · OR the intro is parked
      // (web ledger). Parked, the globe is off-screen, so a multi-frame spin
      // is invisible work that steals the main thread from the map's flyTo on
      // a trip switch — just snap the view so it's correct when the cover returns.
      if (!cur || reduced || dist < 12 || this._introParked) {
        // a tiny refresh while the idle spin is running must not snap the globe
        // back to the target lng — let idle keep advancing; just refresh stops.
        if (this._idleRAF && cur && dist < 12 && !this._introParked && !reduced) return;
        this._globeView = { lat: tLat, lng: tLng };
        this._globeSpinning = false;
        this._drawGlobe(svg, tLat, tLng, stops);
        this._startGlobeIdle();
        return;
      }
      const from = { lat: cur.lat, lng: cur.lng };
      const t0 = performance.now();
      const D = Math.min(1600, 700 + dist * 6);   // farther hops spin a little longer
      const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      this._globeSpinning = true;
      const step = (now) => {
        const k = Math.min(1, (now - t0) / D);
        const e = ease(k);
        this._globeView = { lat: from.lat + dLat * e, lng: from.lng + dLng * e };
        this._drawGlobe(svg, this._globeView.lat, this._globeView.lng, stops);
        if (k < 1) { this._globeAnim = requestAnimationFrame(step); }
        else { this._globeSpinning = false; this._startGlobeIdle(); }
      };
      this._globeAnim = requestAnimationFrame(step);
    }
    // Idle: a slow continuous drift + pointer parallax so the hero globe feels
    // alive. Runs only while the intro is on-screen, no targeted spin is mid-
    // flight, and motion is allowed. Draws the base view + eased parallax offset.
    _startGlobeIdle() {
      if (this._idleRAF || this._introParked) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      if (!this._globeIdleBound) this._globeIdleBound = (t) => this._globeIdleTick(t);
      this._idleLast = 0;
      this._idleRAF = requestAnimationFrame(this._globeIdleBound);
    }
    _stopGlobeIdle() { if (this._idleRAF) { cancelAnimationFrame(this._idleRAF); this._idleRAF = 0; } }
    _globeIdleTick(now) {
      this._idleRAF = requestAnimationFrame(this._globeIdleBound);
      if (!this._globeSvg || !this._globeView) return;
      const dt = this._idleLast ? Math.min(50, now - this._idleLast) : 16;
      this._idleLast = now;
      const p = this._globePar;
      p.lat += (p.tlat - p.lat) * 0.08;                 // ease parallax toward the pointer target
      p.lng += (p.tlng - p.lng) * 0.08;
      if (this._globeSpinning || this._introParked) return;   // spin draws its own frames; parked = off-screen
      this._globeView.lng += 4.5 * dt / 1000;           // ~4.5°/sec drift (a bit more playful)
      const lat = Math.min(35, this._globeView.lat + p.lat);
      this._drawGlobe(this._globeSvg, lat, this._globeView.lng + p.lng, this._globeStops);
    }
    _drawGlobe(svg, lat0deg, lng0deg, stops) {
      const W = 400, R = 186, CX = 200, CY = 200;
      const lat0 = lat0deg * Math.PI / 180;
      const lng0 = lng0deg * Math.PI / 180;
      const sin0 = Math.sin(lat0), cos0 = Math.cos(lat0);
      const proj = (lat, lng) => {
        const φ = lat * Math.PI / 180, λ = lng * Math.PI / 180 - lng0;
        const cosc = sin0 * Math.sin(φ) + cos0 * Math.cos(φ) * Math.cos(λ);
        if (cosc < 0.02) return null;   // back hemisphere
        return [
          CX + R * Math.cos(φ) * Math.sin(λ),
          CY - R * (cos0 * Math.sin(φ) - sin0 * Math.cos(φ) * Math.cos(λ)),
        ];
      };
      const pathFrom = (pts) => {   // polyline path, broken where points dip behind the globe
        let d = '', pen = false;
        for (const p of pts) {
          if (!p) { pen = false; continue; }
          d += (pen ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1);
          pen = true;
        }
        return d;
      };
      // theme-aware: rebuilt on toggle (applyTheme -> _buildIntroGlobe)
      const cs = getComputedStyle(document.documentElement);
      const ink = cs.getPropertyValue('--ink').trim() || '#000000';
      const dot = cs.getPropertyValue('--red').trim() || '#91040C';
      let out = `<circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${ink}" stroke-width="1.1" opacity=".55"/>`;
      // graticule — meridians + parallels every 30°
      let grat = '';
      for (let lng = -180; lng < 180; lng += 30) {
        const pts = []; for (let lat = -90; lat <= 90; lat += 2.5) pts.push(proj(lat, lng));
        grat += pathFrom(pts) ? `<path d="${pathFrom(pts)}"/>` : '';
      }
      for (let lat = -60; lat <= 60; lat += 30) {
        const pts = []; for (let lng = -180; lng <= 180; lng += 2.5) pts.push(proj(lat, lng));
        grat += pathFrom(pts) ? `<path d="${pathFrom(pts)}"/>` : '';
      }
      out += `<g fill="none" stroke="${ink}" stroke-width=".55" opacity=".38">${grat}</g>`;
      // continent outlines (110m atlas, front hemisphere only)
      const topo = window.topojson, world = window.WORLD_ATLAS_DATA;
      if (topo && world) {
        let land = '';
        const feats = topo.feature(world, world.objects.countries).features;
        for (const f of feats) {
          const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
          for (const poly of polys) for (const ring of poly) {
            const pts = ring.map(([lng, lat]) => proj(lat, lng));
            const d = pathFrom(pts);
            if (d) land += `<path d="${d}"/>`;
          }
        }
        out += `<g fill="none" stroke="${ink}" stroke-width=".8" opacity=".5" stroke-linejoin="round">${land}</g>`;
      }
      // the trip: stops linked in order, then dots on top
      const pj = stops.map(([lat, lng]) => proj(lat, lng));
      let links = '';
      for (let i = 1; i < pj.length; i++) {
        if (pj[i - 1] && pj[i]) links += `<line x1="${pj[i-1][0].toFixed(1)}" y1="${pj[i-1][1].toFixed(1)}" x2="${pj[i][0].toFixed(1)}" y2="${pj[i][1].toFixed(1)}"/>`;
      }
      out += `<g stroke="${dot}" stroke-width="1.2" stroke-dasharray="4 4" opacity=".8">${links}</g>`;
      out += `<g fill="${dot}">${pj.filter(Boolean).map(p => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4.2"/>`).join('')}</g>`;
      svg.innerHTML = out;
    }

    currentTrip() { return this.data.trips[this.data.active]; }
    // Trip keys in display order (from data.tripOrder, self-healed), not raw
    // Object.keys — object key order is lost across the jsonb sync (see migrate).
    tripKeys() {
      const tkeys = Object.keys(this.data.trips || {});
      let order = Array.isArray(this.data.tripOrder)
        ? this.data.tripOrder.filter((k, i, a) => tkeys.includes(k) && a.indexOf(k) === i)   // valid + de-duped
        : [];
      tkeys.forEach(k => { if (!order.includes(k)) order.push(k); });
      this.data.tripOrder = order;
      return order.slice();
    }
    legByIndex(i) { const t = this.currentTrip(); return i === 0 ? t.outboundLeg : t.stops[i - 1].leg; }

    bump() { this.render(); this.scheduleSave(); this.touchMap(); if (this._introGlobeRefresh) this._introGlobeRefresh(); if (this._introTabsRefresh) this._introTabsRefresh(); }
    bumpModal() {
      // web ledger: itinerary/accom/transport/budget render on the leaves inside
      // #app, so a "modal" bump has to redraw the whole page (render() also
      // refreshes the floating panels in modalEl)
      // web ledger + app sub-pages (appPage>0) both render inside #app, so a
      // "modal" bump there redraws the whole page (render() also refreshes the
      // floating panels in modalEl). The fresh markup carries the right leaf
      // state class, so no unwanted slide animation fires.
      if (this._webMag() || this.appPage > 0) { this.render(); return; }
      // app overview: only the budget/sticker/sync modals live in modalEl now —
      // itinerary/accom/transport are leaves, not modals
      const trip = this.currentTrip();
      const travelers = Math.max(1, Number(trip.travelers) || 1);
      const nights = trip.stops.reduce((s, st) => s + (Number(st.nights) || 0), 0);
      const budget = this.computeBudget(trip, travelers, nights);
      this.modalEl.innerHTML =
        this.renderStickerPanel() +
        this.renderBudgetModal(budget, travelers, nights) +
        this.renderSyncModal();
      this.mountDayMap();
      this.updateTopActions();   // sticker toggle / sync-modal actions change cluster state
    }
    // attach the persistent day-map node into the freshly-rendered markup and
    // (re)init Leaflet — the holder lives in the modal (app) or on leaf 3 (web)
    mountDayMap() {
      const dayHolder = this.modalEl.querySelector('#day-map-holder') || this.root.querySelector('#day-map-holder');
      if (dayHolder) { dayHolder.appendChild(this.dayMapEl); this.ensureDayMap(0); if (this.dayMap) this.dayMap.invalidateSize(); this.scheduleDayMap(); }
    }
    snapshot() { this._history.push(clone(this.data)); if (this._history.length > 20) this._history.shift(); }
    undo() { if (!this._history.length) return; this.data = this._history.pop(); this.migrate(); this._lastCoordKey = ''; this.bump(); }

    /* ---------- persistence ---------- */
    scheduleSave() {
      clearTimeout(this._saveTimer);
      this._savePending = true;   // guards adoptLocal from reverting an unflushed edit
      this._saveTimer = setTimeout(() => {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data)); this.flashSaved(); } catch (e) {}
        this._savePending = false;
        // a local edit advances our revision and queues a cloud upload (if linked)
        if (this.isLinked()) { this.sync.rev = Date.now(); this.persistSyncRec(); this.scheduleCloudPush(); }
      }, 450);
    }
    flashSaved() {
      this._savedShow = true; this.paintSaved();
      clearTimeout(this._savedTimer);
      this._savedTimer = setTimeout(() => { this._savedShow = false; this.paintSaved(); }, 1300);
    }
    paintSaved() { const el = this.root.querySelector('.saved'); if (el) el.style.opacity = this._savedShow ? 1 : 0; }
    loadState() {
      try { const v = localStorage.getItem(STORAGE_KEY); if (v) { this.data = JSON.parse(v); this.migrate(); } } catch (e) {}
    }
    migrate() {
      const d = this.data;
      // Trip display order must survive the Supabase sync. Postgres jsonb does
      // NOT preserve object key order — it re-sorts keys canonically (by length,
      // then bytewise), which drops a freshly-added trip (its `trip<timestamp>`
      // key is the longest) to the end regardless of a drag-reorder. So keep an
      // explicit ordered key array (arrays keep their order through jsonb) and
      // self-heal it here on every load/cloud-pull: known keys keep their order,
      // any new/unknown keys are appended.
      {
        const tkeys = Object.keys(d.trips || {});
        let order = Array.isArray(d.tripOrder)
          ? d.tripOrder.filter((k, i, a) => tkeys.includes(k) && a.indexOf(k) === i)   // valid + de-duped
          : [];
        tkeys.forEach(k => { if (!order.includes(k)) order.push(k); });
        d.tripOrder = order;
      }
      // Rewards used to be a separate "flying-blue" mode; it's now folded into
      // Flight (a reward-points field alongside cost). Convert any leg still
      // carrying the old mode, keep its miles value, and make sure every
      // flight leg has a numeric miles field for the reward-points input.
      Object.values(d.trips || {}).forEach(trip => {
        const legs = [trip.outboundLeg, ...(trip.stops || []).map(s => s.leg)];
        legs.forEach(l => {
          if (!l) return;
          if (l.mode === 'flying-blue') {
            l.mode = 'flight';
            if (l.miles === 25000) l.miles = 0;   // clear the untouched seed default
          }
          if (l.mode === 'flight' && l.miles == null) l.miles = 0;
        });
      });
      if (d.meta && d.meta.title == null) d.meta.title = '';
      if (d.meta && d.meta.introText == null) d.meta.introText = DEFAULT_INTRO_TEXT;
      if (d.meta && !Array.isArray(d.meta.todos)) d.meta.todos = clone(DEFAULT_STATE.meta.todos);
      if (d.meta && !d.meta.budget) d.meta.budget = clone(DEFAULT_STATE.meta.budget);
      if (d.meta && d.meta.budget && d.meta.budget.cityPassOverride === 0) d.meta.budget.cityPassOverride = null;
      // One-time: seed trips used to pre-fill secondary (intercity/return)
      // flight legs with placeholder fares ($130, $220) that inflated the
      // Flights budget line. Zero any stop flight leg still holding exactly
      // an old seed value; the flag makes sure a fare you re-enter later is
      // never wiped.
      if (d.meta && !d.meta._flightSeedsCleared) {
        Object.values(d.trips || {}).forEach(trip => {
          (trip.stops || []).forEach(s => {
            const l = s && s.leg;
            if (l && l.mode === 'flight' && (Number(l.cost) === 130 || Number(l.cost) === 220)) l.cost = 0;
          });
        });
        d.meta._flightSeedsCleared = true;
      }
      // One-time: same story for reward points — secondary flight legs used to
      // carry a 25,000-point placeholder that inflated the "reward points
      // needed" total. Zero any stop flight leg still holding exactly the old
      // seed. Separate flag so it runs even for data already migrated above.
      if (d.meta && !d.meta._flightPointSeedsCleared) {
        Object.values(d.trips || {}).forEach(trip => {
          (trip.stops || []).forEach(s => {
            const l = s && s.leg;
            if (l && l.mode === 'flight' && Number(l.miles) === 25000) l.miles = 0;
          });
        });
        d.meta._flightPointSeedsCleared = true;
      }
      Object.values(d.trips || {}).forEach(trip => {
        if (trip.depart == null) trip.depart = d.meta.depart;
        if (trip.returnDate == null) trip.returnDate = d.meta.returnDate;
        if (trip.travelers == null) trip.travelers = d.meta.travelers || 2;
        if (!Array.isArray(trip.closet)) trip.closet = [];
        if (!trip.packing || typeof trip.packing !== 'object' || Array.isArray(trip.packing)) trip.packing = {};
        (trip.stops || []).forEach(s => {
          (s.itinerary || []).forEach(day => {
            if (day && !Array.isArray(day.outfits)) day.outfits = [];
            if (day && Array.isArray(day.outfits)) day.outfits = day.outfits.map(e => {
              if (typeof e === 'string') { const o = (trip.closet || []).find(o => o.id === e); return { id: e, image: o ? o.image : '' }; }
              return e;
            });
          });
          if (!s.accom || typeof s.accom !== 'object' || !Array.isArray(s.accom.options)) s.accom = { options: [] };
        });
      });
      Object.values(d.trips || {}).forEach(trip => {
        if (Array.isArray(trip.stops)) trip.stops = trip.stops.filter(s => s.city && s.city.trim());
      });
      if (!Array.isArray(d.stickerStock)) d.stickerStock = [];
      if (!Array.isArray(d.placedStickers)) d.placedStickers = [];
      d.placedStickers.forEach(ps => {
        if (!ps.target) ps.target = 'page';
        if (!ps.image) { const s = d.stickerStock.find(s => s.id === ps.stockId); if (s) ps.image = s.image; }
      });
    }

    /* ============================================================
       CROSS-DEVICE CLOUD SYNC  (multi-backend, keyless)
       ------------------------------------------------------------
       localStorage is per-device, so edits on a phone never reach a
       laptop. Sync mirrors the planner state to a keyless public JSON
       store; both devices link the same short code and pull/push
       automatically. Conflict policy is simple last-write-wins, keyed
       on a millisecond `rev` timestamp that bumps on every local edit.

       The code is "<backend>-<id>" (e.g. "e-AbC123"); see SYNC_BACKENDS.
       ============================================================ */
    loadSyncRec() {
      try { const v = localStorage.getItem(SYNC_KEY); if (v) return JSON.parse(v); } catch (e) {}
      return { id: null, rev: 0, lastSyncedAt: 0 };
    }
    persistSyncRec() { try { localStorage.setItem(SYNC_KEY, JSON.stringify(this.sync)); } catch (e) {} }
    isLinked() { return !!(this.sync && this.sync.id); }
    saveLocalNow() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data)); } catch (e) {} }

    netMsg(e) { return (e && e.message) ? e.message : 'Network error.'; }
    validPayload(p) { return !!(p && p.data && p.data.trips && p.data.meta); }

    /* ----- Supabase client (no auth: shared row) ----- */
    sb() {
      if (this._sb) return this._sb;
      if (!(window.supabase && SUPABASE_URL && SUPABASE_ANON_KEY)) return null;
      try {
        this._sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
        });
      } catch (e) { this._sb = null; }
      return this._sb;
    }
    // Boot cloud sync: connect to the shared row, load it (or seed it from this
    // device), and subscribe to realtime changes. No sign-in — every device that
    // opens the app is on the same shared trips automatically.
    async initCloud() {
      const sb = this.sb();
      if (!sb) { this.setSyncStatus('off', ''); return; }
      this.sync.id = SHARED_ID;
      this.setSyncStatus('syncing', 'Connecting…');
      this.pullCloud({ force: true });     // adopt shared trips (or seed them)
      this.subscribeRealtime();            // live updates from other devices
      this.render(); this.bumpModal();
    }
    subscribeRealtime() {
      const sb = this.sb();
      if (!sb) return;
      this.unsubscribeRealtime();
      // A large row can exceed a realtime payload, so treat any change as a signal
      // to re-fetch the authoritative row rather than trusting the pushed copy.
      this._rt = sb.channel('planner-shared')
        .on('postgres_changes', { event: '*', schema: 'public', table: CLOUD_TABLE, filter: 'id=eq.' + SHARED_ID }, () => this.pullCloud())
        .subscribe();
    }
    unsubscribeRealtime() {
      if (this._rt && this._sb) { try { this._sb.removeChannel(this._rt); } catch (e) {} }
      this._rt = null;
    }

    /* ----- read / write the shared row ----- */
    async cloudRowSelect() {
      const sb = this.sb(); if (!sb) return null;
      const { data, error } = await sb.from(CLOUD_TABLE).select('rev,data').eq('id', SHARED_ID).maybeSingle();
      if (error) throw error;
      return data ? { rev: Number(data.rev) || 0, data: data.data } : null;
    }
    async cloudRowUpsert() {
      const sb = this.sb(); if (!sb) return;
      const { error } = await sb.from(CLOUD_TABLE).upsert(
        { id: SHARED_ID, rev: this.sync.rev || Date.now(), data: this.data, updated_at: new Date().toISOString() },
        { onConflict: 'id' });
      if (error) throw error;
    }
    syncNow() { this.pullCloud({ force: true }); }

    // "Open the web version" just opens the published app — the other device is
    // already on the same shared trips automatically, nothing to carry.
    hostedWebUrl() { return HOSTED_WEB_URL; }
    openHostedWeb() { window.open(HOSTED_WEB_URL, '_blank', 'noopener'); }

    /* ----- push / pull ----- */
    scheduleCloudPush() {
      if (!this.isLinked()) return;
      clearTimeout(this._cloudPushTimer);
      this._cloudPushTimer = setTimeout(() => this.pushCloud(), CLOUD_PUSH_DEBOUNCE_MS);
    }
    async pushCloud() {
      if (!this.isLinked()) return;
      if (this._syncBusy) { this.scheduleCloudPush(); return; }   // retry once current request settles
      this._syncBusy = true; this.setSyncStatus('syncing', 'Saving…');
      try {
        await this.cloudRowUpsert();
        this.sync.lastSyncedAt = Date.now(); this.persistSyncRec();
        this._syncBusy = false; this.setSyncStatus('synced', '');
      } catch (e) {
        this._syncBusy = false;
        this.setSyncStatus('offline', this.netMsg(e)); this.scheduleCloudPush();
      }
    }
    async pullCloud(opts = {}) {
      if (!this.isLinked() || this._syncBusy) return;
      // don't clobber content the user is mid-edit in (app: an open editing
      // modal · web ledger: a focused field); "Sync now" (force) still goes through.
      if (!opts.force && this._syncEditGuard()) return;
      this._syncBusy = true; if (opts.force) this.setSyncStatus('syncing', 'Checking…');
      try {
        const row = await this.cloudRowSelect();
        const remoteRev = row ? row.rev : 0;
        const localRev = this.sync.rev || 0;
        if (row && this.validPayload({ data: row.data }) && remoteRev > localRev) {
          // remote is newer — adopt it (but never clobber a modal the user is typing in)
          this.data = row.data; this.migrate(); this._lastCoordKey = '';
          this.sync.rev = remoteRev; this.sync.lastSyncedAt = Date.now(); this.persistSyncRec();
          this.saveLocalNow();
          this._syncBusy = false; this.setSyncStatus('synced', 'Updated from another device');
          this.render(); this.bumpModal(); this.touchMap();
        } else if (!row) {
          // first time on this account — seed the cloud with the trips on this device
          if (!this.sync.rev) this.sync.rev = Date.now();
          this.persistSyncRec();
          this._syncBusy = false; this.setSyncStatus('synced', ''); this.scheduleCloudPush();
        } else if (remoteRev < localRev) {
          // we hold newer edits (e.g. made offline) — push them up
          this._syncBusy = false; this.setSyncStatus('synced', ''); this.scheduleCloudPush();
        } else {
          this.sync.lastSyncedAt = Date.now(); this.persistSyncRec();
          this._syncBusy = false; this.setSyncStatus('synced', opts.force ? 'Up to date' : '');
        }
      } catch (e) {
        this._syncBusy = false;
        this.setSyncStatus('offline', opts.force ? this.netMsg(e) : '');
      }
    }
    startSyncLoop() {
      if (this._syncPoll) return;
      this._syncPoll = setInterval(() => {
        if (this.isLinked() && document.visibilityState === 'visible') this.pullCloud();
      }, SYNC_POLL_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') { this.adoptLocalSoon(); this.pullCloud(); }
      });
      window.addEventListener('focus', () => this.pullCloud());
      window.addEventListener('online', () => { if (this.isLinked()) this.pullCloud(); });
      // same-origin live sync: localStorage is shared per-origin, so when the
      // installed app and another copy (e.g. standalone.html on the same host)
      // are both open, a save in one fires `storage` in the other — adopt it live.
      window.addEventListener('storage', (e) => {
        if (e.key === null || e.key === STORAGE_KEY || e.key === SYNC_KEY) this.adoptLocalSoon();
      });
    }

    /* ----- same-origin adoption (installed app ↔ another window/tab) ----- */
    adoptLocalSoon() {
      clearTimeout(this._adoptTimer);
      this._adoptTimer = setTimeout(() => this.adoptLocal(), 300);   // state+sync keys land as a burst
    }
    adoptLocal() {
      if (this._savePending) { this.adoptLocalSoon(); return; }   // our own edit is mid-flight; it wins
      // same guard as pullCloud: never clobber a mid-edit — retry after it clears
      if (this._syncEditGuard()) {
        clearTimeout(this._adoptTimer);
        this._adoptTimer = setTimeout(() => this.adoptLocal(), 4000);
        return;
      }
      this.sync = this.loadSyncRec();   // other window may have (un)linked or advanced rev
      let raw = null;
      try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) {}
      if (!raw || raw === JSON.stringify(this.data)) { this.paintSyncStatus(); return; }
      let next; try { next = JSON.parse(raw); } catch (e) { return; }
      this.data = next; this.migrate(); this._lastCoordKey = '';
      if (this.isLinked()) this.setSyncStatus('synced', 'Updated from another window');
      this.render(); this.bumpModal(); this.touchMap(); this.paintSyncStatus();
    }

    /* ----- status UI ----- */
    setSyncStatus(status, msg) { this._syncStatus = status; this._syncMsg = msg || ''; this.paintSyncStatus(); }
    syncStatusLabel() {
      switch (this._syncStatus) {
        case 'syncing': return this._syncMsg || 'Syncing…';
        case 'synced':  return this._syncMsg || 'Synced';
        case 'offline': return this._syncMsg || 'Offline';
        case 'error':   return this._syncMsg || 'Sync error';
        default:        return this.isLinked() ? 'Synced' : 'Not synced';
      }
    }
    relTime(ts) {
      if (!ts) return '';
      const s = Math.round((Date.now() - ts) / 1000);
      if (s < 60) return 'just now';
      const m = Math.round(s / 60); if (m < 60) return m + ' min ago';
      const h = Math.round(m / 60); if (h < 24) return h + ' h ago';
      return new Date(ts).toLocaleDateString();
    }
    paintSyncStatus() {
      const dot = this.topActionsEl && this.topActionsEl.querySelector('.sync-dot');
      if (dot) dot.className = 'sync-dot s-' + (this.isLinked() ? this._syncStatus : 'off');
      const st = this.modalEl && this.modalEl.querySelector('.sync-status');
      if (st) { st.textContent = this.syncStatusLabel(); st.className = 'sync-status s-' + this._syncStatus; }
      const when = this.modalEl && this.modalEl.querySelector('.sync-when');
      if (when) when.textContent = this.sync.lastSyncedAt ? ('Last synced ' + this.relTime(this.sync.lastSyncedAt)) : '';
    }

    /* ---------- dates ---------- */
    formatDate(d) { if (!d || isNaN(d.getTime())) return '—'; return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
    computeDates(trip) {
      const dep = new Date((trip.depart || this.data.meta.depart) + 'T00:00:00');
      if (isNaN(dep.getTime())) return null;
      let cursor = new Date(dep); cursor.setDate(cursor.getDate() + 1);
      const stopRanges = [];
      trip.stops.forEach(stop => {
        const start = new Date(cursor);
        const end = new Date(start); end.setDate(end.getDate() + (Number(stop.nights) || 0));
        stopRanges.push({ start, end });
        cursor = new Date(end);
        if (stop.leg.mode === 'overnight-train') cursor.setDate(cursor.getDate() + 1);
      });
      return { origin: dep, stops: stopRanges, home: cursor };
    }

    /* ---------- SVG route map (aside) ---------- */
    resolveCoord(label) {
      if (!label) return null;
      const base = normKey(label.replace(/\(.*?\)/g, '').trim());
      if (CITY_COORDS[base]) return CITY_COORDS[base];
      const m = label.match(/\(([^)]+)\)/);
      if (m) { const code = normKey(m[1]); if (CITY_COORDS[code]) return CITY_COORDS[code]; }
      const fw = base.split(/[, ]+/)[0];
      if (fw && CITY_COORDS[fw]) return CITY_COORDS[fw];
      // city not in the static table (e.g. outside Europe) — fall back to the
      // shared Nominatim geocoder. Sync path reads the cache; a miss kicks off
      // one lookup, and the globe/maps refresh when the coordinate lands.
      if (!base) return null;
      const g = this._geoCache.get(base + '|');
      if (g) return [g.lat, g.lng];
      if (g === undefined) this._geocodeCity(label, base);   // null = known failure, don't retry
      return null;
    }
    _geocodeCity(label, key) {
      if (!this._cityGeoPending) this._cityGeoPending = new Set();
      if (this._cityGeoPending.has(key)) return;
      this._cityGeoPending.add(key);
      this.geocode(label.replace(/\(.*?\)/g, '').trim(), '').then((coord) => {
        this._cityGeoPending.delete(key);
        if (!coord) return;
        // redraw everything that plots stops: route maps + the intro globe
        this._lastCoordKey = '';
        this.touchMap();
        if (this._introGlobeRefresh) this._introGlobeRefresh();
      }).catch(() => this._cityGeoPending.delete(key));
    }
    ensureMap(tries) {
      if (!this.mapEl.isConnected || !window.L) { if (tries < 80) setTimeout(() => this.ensureMap(tries + 1), 100); return; }
      if (this.leafletMap) return;
      const L = window.L;
      this.leafletMap = L.map(this.mapEl, { scrollWheelZoom: false, zoomSnap: .25, zoomDelta: .5, wheelPxPerZoomLevel: 120, inertia: true });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(this.leafletMap);
      this.mapLines = L.layerGroup().addTo(this.leafletMap);
      this.mapMarkers = L.layerGroup().addTo(this.leafletMap);
      this.leafletMap.setView([54, 10], 4);
      this.mapEl.addEventListener('mouseenter', () => this.leafletMap.scrollWheelZoom.enable());
      this.mapEl.addEventListener('mouseleave', () => this.leafletMap.scrollWheelZoom.disable());
      this.renderMap();
    }
    touchMap() {
      if (this.leafletMap) {
        clearTimeout(this._mapTimer);
        this._mapTimer = setTimeout(() => { this.leafletMap.invalidateSize(); this.renderMap(); }, 220);
      }
      this._scheduleMainMap(60);
    }
    // A single debounced main-map render+invalidate. render() and touchMap()
    // both want to refresh the map after a bump(); routing both through one
    // shared timer collapses them into ONE renderMainMap, so the flyToBounds
    // animation runs once uninterrupted instead of a second call snapping it
    // to the end mid-flight (the jank/lag on a trip switch).
    _scheduleMainMap(delay = 60) {
      clearTimeout(this._mainMapTimer);
      this._mainMapTimer = setTimeout(() => this._doMainMap(0), delay);
    }
    _doMainMap(tries) {
      if (!this.mainLeafletMap) {   // Leaflet still spinning up (ensureMainMap retries)
        if (tries < 40) this._mainMapTimer = setTimeout(() => this._doMainMap(tries + 1), 100);
        return;
      }
      this.mainLeafletMap.invalidateSize();
      this.renderMainMap();
    }
    renderMap() {
      if (!this.leafletMap || !window.L) return;
      const L = window.L;
      this.mapLines.clearLayers(); this.mapMarkers.clearLayers();
      const trip = this.currentTrip();
      const points = [{ label: trip.originLabel, kind: 'endpoint' },
        ...trip.stops.map(s => ({ label: s.city, kind: 'stop', nights: s.nights, note: s.note })),
        { label: trip.homeLabel, kind: 'endpoint' }];
      const legs = [trip.outboundLeg, ...trip.stops.map(s => s.leg)];
      const resolved = points.map(p => ({ ...p, coord: this.resolveCoord(p.label) }));
      const missing = resolved.filter(p => !p.coord).map(p => p.label).filter(Boolean);
      const coordKey = resolved.filter(p => p.coord).map(p => p.coord.map(n => n.toFixed(2)).join(',')).join('|');
      const changed = coordKey !== this._lastCoordKey; this._lastCoordKey = coordKey;
      const bounds = [];
      resolved.forEach((p, pi) => {
        if (!p.coord) return;
        bounds.push(p.coord);
        const ep = p.kind === 'endpoint';
        const stopIdx = ep ? null : pi - 1;
        const marker = L.circleMarker(p.coord, {
          radius: ep ? 6 : 8, color: ep ? '#000000' : '#91040C', weight: ep ? 2 : 0,
          fillColor: ep ? '#ffffff' : '#91040C', fillOpacity: 1,
          // attribute colors above are light-theme fallbacks; the class rules
          // (.map-ep-dot / .map-stop-dot) override them and follow the theme
          className: ep ? 'map-ep-dot' : 'map-stop-dot'
        });
        if (!ep && stopIdx != null) marker.on('click', () => this.openStop(stopIdx));
        this.mapMarkers.addLayer(marker);
      });
      for (let i = 0; i < resolved.length - 1; i++) {
        const a = resolved[i], b = resolved[i + 1], leg = legs[i];
        if (!a.coord || !b.coord) continue;
        const color = MODE_HEX[leg.mode] || '#7a7260';
        const dashed = leg.mode === 'flight';
        this.mapLines.addLayer(L.polyline([a.coord, b.coord], { color, weight: 3, opacity: .85, dashArray: dashed ? '6 6' : null, className: 'leg-' + leg.mode }));
      }
      if (bounds.length === 1) changed ? this.leafletMap.flyTo(bounds[0], 5, { duration: .8 }) : this.leafletMap.setView(bounds[0], 5);
      else if (bounds.length > 1) changed ? this.leafletMap.flyToBounds(bounds, { padding: [26, 26], duration: .8 }) : this.leafletMap.fitBounds(bounds, { padding: [26, 26] });
      this._mapMissing = missing.length ? `Couldn't place: ${missing.join(', ')} — try the nearest major city or airport code.`
        : `${bounds.length} points · route across ${trip.stops.length} stops.`;
      const note = this.root.querySelector('.map-note'); if (note) note.textContent = this._mapMissing;
    }

    /* ---------- main Leaflet map (replaces static SVG canvas) ---------- */
    ensureMainMap(tries = 0) {
      if (!this.mainMapEl.isConnected || !window.L) {
        if (tries < 80) setTimeout(() => this.ensureMainMap(tries + 1), 100);
        return;
      }
      if (this.mainLeafletMap) { return; }
      const L = window.L;
      // touch devices: one-finger drag must scroll the PAGE, not pan the map
      // (dragging:false keeps Leaflet's touch-action at pan-x pan-y, so the
      // browser handles the swipe; pinch still zooms/pans the map, and desktop
      // mouse dragging is unaffected — coarse pointer = touch-first device)
      const touchFirst = window.matchMedia('(pointer: coarse)').matches;
      const map = L.map(this.mainMapEl, {
        scrollWheelZoom: false, dragging: !touchFirst, zoomSnap: 0.25, zoomDelta: 0.5,
        zoomControl: false, attributionControl: false, inertia: true,
        center: [50, 14], zoom: 5
      });
      this.mainLeafletMap = map;
      // Layer order: land polygons → route lines (pins/labels live in overlay divs above)
      this.mainMapLand    = L.layerGroup().addTo(map);
      this.mainMapLines   = L.layerGroup().addTo(map);
      map.on('move zoom moveend zoomend', () => this._positionMainCards());
      // web ledger: tapping empty map (not a pin) closes the open stop card,
      // returning the dock to the stop list
      map.on('click', () => {
        if (this._webMag() && this.stopInfoIdx != null) { this.stopInfoIdx = null; this._paintStopSpot(); }
      });
      // scroll-to-zoom stays OFF (created with scrollWheelZoom:false) — wheel
      // scrolls the page; zoom via double-click, pinch, or +/- keys instead
      this._loadMinimalBasemap();
    }

    _chaikinRing(ring, n = 3) {
      let pts = ring.slice(0, -1);
      for (let iter = 0; iter < n; iter++) {
        const out = [], len = pts.length;
        for (let i = 0; i < len; i++) {
          const a = pts[i], b = pts[(i + 1) % len];
          out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
          out.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
        }
        pts = out;
      }
      pts.push(pts[0]);
      return pts;
    }

    _smoothCountries(geojson) {
      geojson.features.forEach(f => {
        if (!f.geometry) return;
        const g = f.geometry;
        if (g.type === 'Polygon') g.coordinates = g.coordinates.map(r => this._chaikinRing(r));
        else if (g.type === 'MultiPolygon') g.coordinates = g.coordinates.map(p => p.map(r => this._chaikinRing(r)));
      });
      return geojson;
    }

    // standalone.html inlines the atlas; the served build (index.html) doesn't,
    // so fetch it once and share the promise (basemap + intro globe both use it)
    _ensureAtlas() {
      if (window.WORLD_ATLAS_DATA) return Promise.resolve(window.WORLD_ATLAS_DATA);
      if (!this._atlasPromise) {
        this._atlasPromise = fetch('vendor/topojson/countries-110m.json')
          .then(r => r.json())
          .then(w => { window.WORLD_ATLAS_DATA = w; return w; })
          .catch(() => { this._atlasPromise = null; return null; });
      }
      return this._atlasPromise;
    }
    // Detailed (50m) atlas for the stop map's blueprint coastlines. Kept separate
    // from the globe's 110m atlas — the globe re-projects every idle frame, so it
    // stays low-res for speed. Falls back to 110m if the 50m file can't load.
    _ensureHiAtlas() {
      if (window.WORLD_ATLAS_50) return Promise.resolve(window.WORLD_ATLAS_50);
      if (!this._hiAtlasPromise) {
        this._hiAtlasPromise = fetch('vendor/topojson/countries-50m.json')
          .then(r => r.json())
          .then(w => { window.WORLD_ATLAS_50 = w; return w; })
          .catch(() => { this._hiAtlasPromise = null; return this._ensureAtlas(); });
      }
      return this._hiAtlasPromise;
    }
    _loadMinimalBasemap() {
      const topo = window.topojson;
      if (!topo || !this.mainMapLand) return;
      this._ensureHiAtlas().then((world) => {
        if (!world || this._basemapBuilt) return;
        this._basemapBuilt = true;
        // RAW geometry (no Chaikin smoothing) + the detailed 50m atlas → crisp,
        // accurate coastlines. Thin stroke; .map-land CSS themes fill/stroke/width.
        const countries = topo.feature(world, world.objects.countries);
        window.L.geoJSON(
          countries,
          { style: { fillColor: '#000000', fillOpacity: 1, color: '#000000', weight: 0.6, opacity: 1, lineJoin: 'round', lineCap: 'round', className: 'map-land' } }
        ).addTo(this.mainMapLand);
        this._addMinimalCityLabels();
        this._positionMainCards();
      });
    }

    _addMinimalCityLabels() {
      /* 30 tier-1 world cities — rendered in overlay div above Leaflet to avoid clipping */
      this._mapCities = [
        // Europe
        ['London',51.507,-0.128],['Paris',48.857,2.352],['Berlin',52.520,13.405],
        ['Rome',41.903,12.496],['Madrid',40.417,-3.704],['Vienna',48.208,16.374],
        ['Warsaw',52.230,21.012],['Prague',50.076,14.438],['Budapest',47.498,19.040],
        ['Amsterdam',52.368,4.904],['Stockholm',59.329,18.069],['Lisbon',38.722,-9.139],
        // Russia / Turkey
        ['Moscow',55.756,37.617],['Istanbul',41.008,28.978],
        // Americas
        ['New York',40.713,-74.006],['Los Angeles',34.052,-118.244],
        ['Toronto',43.653,-79.383],['Mexico City',19.433,-99.133],
        ['São Paulo',-23.551,-46.633],['Buenos Aires',-34.604,-58.382],
        // Asia / Pacific
        ['Tokyo',35.676,139.650],['Beijing',39.904,116.407],['Shanghai',31.230,121.474],
        ['Seoul',37.567,126.978],['Singapore',1.352,103.820],
        ['Mumbai',19.076,72.878],['Dubai',25.205,55.271],['Sydney',-33.869,151.209],
        // Africa
        ['Cairo',30.044,31.236],['Lagos',6.524,3.379],
      ];
      this.mainCityLabelsEl.innerHTML = this._mapCities
        .map(([name]) => `<span class="map-city-label" style="position:absolute">${name}</span>`)
        .join('');
    }

    // ≤700px the map switches to pins-only + one tap-to-open popup card;
    // above it (laptop, full-screen iPad) the floating-cards design applies.
    _mobileMap() { return window.matchMedia('(max-width: 700px)').matches; }
    // ≥701px the whole planner renders as the web ledger notebook instead of
    // the app's single scrolling page — same state, different composition.
    _webMag() { return window.matchMedia('(min-width: 701px)').matches; }
    _closeMapPopup() {
      if (this._openMapCardIdx != null) {
        const openCard = this.mainCardsOverlayEl.querySelector(`.map-stop[data-i="${this._openMapCardIdx}"]`);
        if (openCard) openCard.classList.remove('mc-editing');
      }
      this._openMapCardIdx = null;
      this._openMapCardFlipped = false;
      this._syncPinOpenClass();
      this._positionMainCards();
    }
    // only the open popup's pin keeps an interactive order input on mobile
    _syncPinOpenClass() {
      const mobile = this._mobileMap();
      this.mainPinsOverlayEl.querySelectorAll('.map-pin-outer').forEach(p => {
        p.classList.toggle('pin-open', mobile && Number(p.dataset.pin) === this._openMapCardIdx);
      });
    }
    // pins fall in, staggered, when the map first scrolls into view. Runs the
    // keyframe for its window, then drops back to the settled default so later
    // renderMainMap rebuilds (pan/coord updates) don't re-trigger the drop.
    _dropPins() {
      if (this._pinsDropped) return;
      this._pinsDropped = true;
      const el = this.mainPinsOverlayEl;
      el.classList.remove('pins-wait');
      clearTimeout(this._pinDropT);
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;   // just show them
      el.classList.add('pins-drop');
      const n = el.querySelectorAll('.map-pin-outer').length;
      this._pinDropT = setTimeout(() => el.classList.remove('pins-drop'), 900 + Math.min(n, 7) * 110);
      this._drawMainRoute();   // draw the ink route in as the pins land
    }
    _resetPins() {
      this._pinsDropped = false;
      this._routeDrawn = false;
      clearTimeout(this._pinDropT);
      this.mainPinsOverlayEl.classList.remove('pins-drop');
      this.mainPinsOverlayEl.classList.add('pins-wait');
    }
    // Animate an SVG path drawing itself via stroke-dashoffset. restore:true
    // clears the inline dash afterwards so a natively-dashed line (day route)
    // returns to its CSS dashes once drawn.
    _animateStroke(path, opts = {}) {
      if (!path || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      let len; try { len = path.getTotalLength(); } catch (e) { return; }
      if (!len) return;
      const dur = opts.dur || 1100, delay = opts.delay || 0;
      path.style.transition = 'none';
      path.style.strokeDasharray = len + 'px';
      path.style.strokeDashoffset = len + 'px';
      path.getBoundingClientRect();   // force reflow so the offset starts at full length
      requestAnimationFrame(() => {
        path.style.transition = `stroke-dashoffset ${dur}ms cubic-bezier(.33,0,.15,1) ${delay}ms`;
        path.style.strokeDashoffset = '0px';
        if (opts.restore) {
          const done = () => { path.style.transition = ''; path.style.strokeDasharray = ''; path.style.strokeDashoffset = ''; path.removeEventListener('transitionend', done); };
          path.addEventListener('transitionend', done);
        }
      });
    }
    // Draw the route in dash-by-dash: the polyline keeps its "5 7" dash pattern
    // and we extend its points along the curve over time, so it's dashed from the
    // first frame and new dashes appear at the leading tip (no solid-then-dash).
    _drawMainRoute() {
      if (this._routeDrawn) return;
      const poly = this._mainRoutePoly, full = this._mainRouteFull;
      if (!poly || !full || full.length < 3) return;
      this._routeDrawn = true;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;   // full line already shown
      const dur = 2900, t0 = performance.now() + 220;   // 220ms delay so pins land first
      const ease = (t) => t;                            // linear = steady, clearer dash-by-dash reveal
      poly.setLatLngs(full.slice(0, 2));                // start as a short dashed stub
      const step = (now) => {
        const k = Math.max(0, Math.min(1, (now - t0) / dur));
        poly.setLatLngs(full.slice(0, Math.max(2, Math.round(ease(k) * full.length))));
        if (k < 1) requestAnimationFrame(step);
        else poly.setLatLngs(full);
      };
      requestAnimationFrame(step);
    }
    // mirrors the CSS card widths on .main-cards-overlay .map-stop (styles.css):
    // clamp(100px, 15.4cqw, 155px) on wide screens, fixed 185px popup ≤700px —
    // so every JS position/leader-line computation matches the card's actual size.
    _mainCardSize() {
      // compact popup 123px — same width front and back; the edit face is a
      // little taller (72px) to fit the full-size controls (CSS mirrors this)
      if (this._mobileMap()) {
        const w = 123;
        const flipped = this._openMapCardFlipped && this._openMapCardIdx != null;
        return { w, h: flipped ? 67 : w * (74 / 155) };
      }
      const mapW = this.mainMapEl.offsetWidth || 800;
      const w = Math.max(100, Math.min(155, mapW * 0.154));
      return { w, h: w * (74 / 155) };
    }
    // Smooth curved "travel route" that PASSES THROUGH each stop in order —
    // a centripetal Catmull-Rom spline. Unlike a per-leg bow, it never arcs over
    // a neighbouring pin and won't loop/self-cross (centripetal α=0.5 avoids the
    // cusps/kinks uniform Catmull-Rom can produce on sharp turns).
    _curvePath(pts, steps = 18) {
      const n = pts.length;
      if (n < 3) return pts.slice();                 // 2 stops → straight (still dashed)
      const clamp = (i) => pts[Math.max(0, Math.min(n - 1, i))];
      const lerp = (A, B, tA, tB, t) => {
        const w = (t - tA) / ((tB - tA) || 1e-6);
        return [A[0] + (B[0] - A[0]) * w, A[1] + (B[1] - A[1]) * w];
      };
      const knot = (ti, A, B) => ti + Math.pow(Math.hypot(B[0] - A[0], B[1] - A[1]) || 1e-6, 0.5);
      const TIGHT = 0.55;   // blend toward the straight leg so the curve hugs the
                            // route (0 = straight, 1 = full spline) — keeps it from
                            // swinging wide over neighbouring pins
      const out = [pts[0]];
      for (let i = 0; i < n - 1; i++) {
        const p0 = clamp(i - 1), p1 = clamp(i), p2 = clamp(i + 1), p3 = clamp(i + 2);
        const t0 = 0, t1 = knot(t0, p0, p1), t2 = knot(t1, p1, p2), t3 = knot(t2, p2, p3);
        for (let s = 1; s <= steps; s++) {
          const f = s / steps;
          const t = t1 + (t2 - t1) * f;
          const A1 = lerp(p0, p1, t0, t1, t), A2 = lerp(p1, p2, t1, t2, t), A3 = lerp(p2, p3, t2, t3, t);
          const B1 = lerp(A1, A2, t0, t2, t), B2 = lerp(A2, A3, t1, t3, t);
          const c = lerp(B1, B2, t1, t2, t);
          const sx = p1[0] + (p2[0] - p1[0]) * f, sy = p1[1] + (p2[1] - p1[1]) * f;   // straight leg
          out.push([c[0] * TIGHT + sx * (1 - TIGHT), c[1] * TIGHT + sy * (1 - TIGHT)]);
        }
      }
      return out;
    }
    renderMainMap() {
      if (!this.mainLeafletMap || !window.L) return;
      const L = window.L;
      const map = this.mainLeafletMap;
      const trip = this.currentTrip();
      const stops = trip.stops;
      const fmt = x => this.formatDate(x);
      const legs = [trip.outboundLeg, ...stops.map(s => s.leg)];

      this.mainMapLines.clearLayers();

      const coords = stops.map(s => this.resolveCoord(s.city));
      const bounds = coords.filter(Boolean);

      // Route polyline
      const polyCoords = [];
      coords.forEach((c) => { if (c) polyCoords.push(c); });
      if (polyCoords.length > 1) {
        this._mainRouteFull = this._curvePath(polyCoords);
        this._mainRoutePoly = L.polyline(this._mainRouteFull, { color: '#000000', weight: 2.2, opacity: 0.65, dashArray: '5 7', className: 'map-route-line' });
        this._mainRoutePoly.addTo(this.mainMapLines);
      }

      // Numbered pins rendered in overlay div (outside Leaflet — no overflow clipping)
      const webMag = this._webMag();
      this.mainPinsOverlayEl.innerHTML = stops.map((stop, idx) => {
        if (!coords[idx]) return '';
        // web: static number — tapping the pin opens the dock card (reorder is
        // done from the dock list). phone: editable number reorders in place.
        const num = webMag
          ? `<span class="pin-order-num">${idx + 1}</span>`
          : `<input type="number" class="pin-order-input" value="${idx + 1}" min="1" max="${stops.length}" data-ch="stop-order" data-i="${idx}" title="Tap to change order">`;
        return `<div class="map-pin-outer" data-pin="${idx}"><div class="map-pin-main" style="background:var(--red)">${num}</div></div>`;
      }).join('');
      this._syncPinOpenClass();

      if (bounds.length === 1) {
        const key = bounds[0].join(',');
        key !== this._lastMainCoordKey ? map.flyTo(bounds[0], 7, { duration: 0.8 }) : map.setView(bounds[0], 7);
      } else if (bounds.length > 1) {
        const key = bounds.map(b => b.join(',')).join('|');
        key !== this._lastMainCoordKey ? map.flyToBounds(bounds, { padding: [60, 60], duration: 0.8 }) : map.fitBounds(bounds, { padding: [60, 60] });
        this._lastMainCoordKey = bounds.map(b => b.join(',')).join('|');
      }

      // Render cards HTML into overlay
      this._renderMainMapCardHTML(stops, legs, this.computeDates(trip), fmt);
      this._positionMainCards();
      this._updateMainLeaders();
    }

    // compact map-card editor: mode + duration + cost only — reward points
    // for a flight leg are edited on the Transport & Hotels page
    _legFields(leg, legIdx) {
      const opts = MODE_OPTIONS.map(o => `<option value="${o.value}"${o.value === leg.mode ? ' selected' : ''}>${o.label}</option>`).join('');
      return `<div class="map-leg-row">
        <span class="mode-dot" style="background:${MODE_HEX[leg.mode] || '#7a7260'}"></span>
        <select data-ch="leg-mode" data-leg="${legIdx}">${opts}</select>
        <input class="dur" value="${escA(leg.duration)}" data-ch="leg-dur" data-leg="${legIdx}" placeholder="notes">
        ${SHOW_COSTS ? `<span class="cost-wrap">
          <input class="cost" type="text" inputmode="numeric" value="${escA(leg.cost ?? 0)}" data-ch="leg-cost" data-leg="${legIdx}">
          <span class="unit">$/pp</span></span>` : ''}
      </div>`;
    }

    _renderMainMapCardHTML(stops, legs, d, fmt) {
      // Web ledger: the map shows pins only — each stop's details (city,
      // nights, delete, itinerary/hotels/transport) live in the dock card
      // (.stop-spot) beside the map, so no cards are drawn over the map here.
      if (this._webMag()) { this.mainCardsOverlayEl.innerHTML = ''; return; }
      let html = '';
      stops.forEach((stop, idx) => {
        const r = d ? d.stops[idx] : null;
        const chosenNames = (stop.accom && stop.accom.options || []).filter(o => o.chosen && o.name && o.name.trim()).map(o => o.name.trim());
        const accomSet = chosenNames.length > 0;
        // each stop's own .leg is the leg that arrives at it (legByIndex(idx+1)
        // is the equivalent lookup) — index into the shifted `legs` array here
        // was off by one and showed the PREVIOUS stop's transport color
        const modeColor = MODE_HEX[(stop.leg || {}).mode] || '#7a7260';
        const dim = this._dragStopIdx === idx ? 0.38 : 1;
        html += `<div class="stop map-stop" data-i="${idx}" style="opacity:${dim}">
          <div class="card mc-flip">
            <div class="mc-front">
              <span class="mc-mode-pip" style="background:${modeColor}"></span>
              <div class="mc-city-display">${stop.city ? esc(stop.city) : '<span style="opacity:.3">City?</span>'}</div>
              <div class="mc-meta">
                ${r ? `<div class="mc-dates-display">${esc(fmt(r.start))} – ${esc(fmt(r.end))}</div>` : (stop.nights ? `<div class="mc-dates-display">${stop.nights} nights</div>` : '')}
                ${accomSet ? `<div class="mc-hotel-display">${chosenNames.map(n => esc(n)).join(' · ')}</div>` : ''}
              </div>
            </div>
            <div class="mc-back">
              <div class="head">
                <div class="mc-top-row">
                  <input class="city" value="${escA(stop.city)}" data-ch="stop-city" data-i="${idx}" placeholder="City">
                  <div class="nights"><input type="number" value="${escA(stop.nights)}" data-ch="stop-nights" data-i="${idx}"><span>nts</span></div>
                </div>
                <div class="mc-btn-row">
                  <button class="iti-btn" data-act="stop-accom" data-i="${idx}" title="Accommodation" aria-label="Accommodation">${svg(I.bed)}</button>
                  <button class="iti-btn" data-act="stop-iti" data-i="${idx}" title="Itinerary" aria-label="Open itinerary">${svg(I.calendar)}</button>
                  <button class="iti-btn mc-transport-btn" data-act="stop-transport" data-i="${idx}" title="Transport" aria-label="Transport" style="color:${modeColor}">${svg(I.route)}</button>
                </div>
              </div>
              <div class="foot">
                <div class="grip" data-map-drag="${idx}" title="Drag card on map"><svg width="9" height="9" viewBox="0 0 7 7" fill="currentColor" aria-hidden="true"><circle cx="1.4" cy="1.4" r="1.1"/><circle cx="5.6" cy="1.4" r="1.1"/><circle cx="1.4" cy="5.6" r="1.1"/><circle cx="5.6" cy="5.6" r="1.1"/></svg></div>
                <button class="trash" data-act="stop-delete" data-i="${idx}" title="Remove stop" aria-label="Remove stop">${svg(I.trash, { w: 14, h: 14, sw: 2.4 })}</button>
              </div>
            </div>
          </div>
        </div>`;
      });
      this.mainCardsOverlayEl.innerHTML = html;
      if (this._editingStopIdx != null) {
        const cardEl = this.mainCardsOverlayEl.querySelector(`.map-stop[data-i="${this._editingStopIdx}"]`);
        if (cardEl) {
          cardEl.classList.add('mc-editing');
          const ci = cardEl.querySelector('.city');
          if (ci && !cardEl.contains(document.activeElement)) { ci.focus(); ci.select(); }
        }
      }
      // mobile popup flipped to its edit face survives re-renders (e.g. nights edit → bump)
      if (this._mobileMap() && this._openMapCardIdx != null && this._openMapCardFlipped) {
        const openEl = this.mainCardsOverlayEl.querySelector(`.map-stop[data-i="${this._openMapCardIdx}"]`);
        if (openEl) openEl.classList.add('mc-editing');   // class only — no focus, no keyboard pop
      }
    }

    _positionMainCards() {
      if (!this.mainLeafletMap) return;
      const map = this.mainLeafletMap;
      const trip = this.currentTrip();
      const stops = trip.stops;
      const mapW = this.mainMapEl.offsetWidth || 800;
      const mapH = this.mainMapEl.offsetHeight || 480;
      const { w: CARD_W, h: CARD_H } = this._mainCardSize();

      // ---- pass 1: each stop's desired position, before de-overlap ----
      // `auto` marks cards placed by the default pin-offset heuristic — only those
      // get nudged apart from each other; a card the user explicitly dragged
      // (stop.cardLatLng) or that's mid-edit with no city yet keeps its exact spot.
      const mobile = this._mobileMap();
      const placed = [];
      stops.forEach((stop, idx) => {
        const cardEl = this.mainCardsOverlayEl.querySelector(`.map-stop[data-i="${idx}"]`);
        if (!cardEl) return;

        // mobile (≤700px): pins only — the sole visible card is the tapped
        // popup (or a just-added stop mid-edit), placed right by its pin.
        if (mobile) {
          if (idx !== this._openMapCardIdx && idx !== this._editingStopIdx) {
            cardEl.style.display = 'none';
            return;
          }
          const coord = this.resolveCoord(stop.city);
          let px, py;
          if (coord) {
            const pt = map.latLngToContainerPoint(coord);
            px = pt.x - CARD_W / 2;
            // leave a clear gap between the card and the pin (pin radius 13 + ~13 gap)
            py = pt.y - CARD_H - 26;          // prefer above the pin
            if (py < 6) py = pt.y + 26;       // flip below when it would clip the top
          } else {
            px = mapW / 2 - CARD_W / 2;       // no coords yet (new stop) → center
            py = mapH / 2 - CARD_H / 2;
          }
          cardEl.style.display = '';
          placed.push({ cardEl, px, py, auto: false });
          return;
        }

        let px, py, auto = false;
        if (stop.cardLatLng) {
          const pt = map.latLngToContainerPoint(stop.cardLatLng);
          px = pt.x - CARD_W / 2;
          py = pt.y - CARD_H / 2;
        } else {
          const coord = this.resolveCoord(stop.city);
          if (!coord) {
            if (idx === this._editingStopIdx) {
              px = mapW / 2 - CARD_W / 2;
              py = mapH / 2 - CARD_H / 2;
            } else {
              cardEl.style.display = 'none';
              return;
            }
          } else {
            const pt = map.latLngToContainerPoint(coord);
            const right = idx % 2 === 0;
            px = right ? pt.x + 18 : pt.x - CARD_W - 18;
            py = pt.y - CARD_H - 8;
            auto = true;
          }
        }
        cardEl.style.display = '';
        placed.push({ cardEl, px, py, auto });
      });

      // ---- pass 2: nudge apart any auto-placed cards that collide ----
      // pins that are geographically close converge in pixel space as the map
      // shrinks, so same-size cards can still land on top of each other; a few
      // rounds of iterative AABB separation is enough for the handful of stops
      // a trip typically has. Leader lines (_updateMainLeaders) keep each
      // nudged card visually tied back to its own pin.
      const GAP = 6;
      for (let iter = 0; iter < 4; iter++) {
        let moved = false;
        for (let i = 0; i < placed.length; i++) {
          if (!placed[i].auto) continue;
          for (let j = i + 1; j < placed.length; j++) {
            if (!placed[j].auto) continue;
            const a = placed[i], b = placed[j];
            const overlapX = Math.min(a.px + CARD_W, b.px + CARD_W) - Math.max(a.px, b.px);
            const overlapY = Math.min(a.py + CARD_H, b.py + CARD_H) - Math.max(a.py, b.py);
            if (overlapX <= 0 || overlapY <= 0) continue;
            moved = true;
            if (overlapX < overlapY) {
              const push = (overlapX + GAP) / 2;
              if (a.px + CARD_W / 2 <= b.px + CARD_W / 2) { a.px -= push; b.px += push; }
              else { a.px += push; b.px -= push; }
            } else {
              const push = (overlapY + GAP) / 2;
              if (a.py + CARD_H / 2 <= b.py + CARD_H / 2) { a.py -= push; b.py += push; }
              else { a.py += push; b.py -= push; }
            }
          }
        }
        if (!moved) break;
      }

      // ---- pass 3: clamp to the visible map area and commit to the DOM ----
      const INSET = mobile ? 6 : 4;
      placed.forEach(({ cardEl, px, py }) => {
        px = Math.max(INSET, Math.min(mapW - CARD_W - INSET, px));
        py = Math.max(INSET, Math.min(mapH - CARD_H - INSET, py));
        cardEl.style.left = px + 'px';
        cardEl.style.top = py + 'px';
      });

      // Position stop pins — clamp to map bounds so .map-route overflow:hidden never clips them
      const PIN_R = mobile ? 13 : 11; // half the pin (26px touch pins ≤700px, 22px otherwise)
      const pinEls = this.mainPinsOverlayEl.querySelectorAll('.map-pin-outer');
      stops.forEach((stop, idx) => {
        const pinEl = pinEls[idx];
        if (!pinEl) return;
        const coord = this.resolveCoord(stop.city);
        if (!coord) { pinEl.style.display = 'none'; return; }
        const pt = map.latLngToContainerPoint(coord);
        const cx = Math.max(PIN_R + 2, Math.min(mapW - PIN_R - 2, pt.x));
        const cy = Math.max(PIN_R + 2, Math.min(mapH - PIN_R - 2, pt.y));
        pinEl.style.display = '';
        pinEl.style.left = (cx - PIN_R) + 'px';
        pinEl.style.top = (cy - PIN_R) + 'px';
      });

      // Position city labels — only show those within the current viewport,
      // and skip any basemap label that duplicates a stop city (the numbered
      // pin already names it, so drawing both collides — "1PRAGUE").
      const bounds = map.getBounds();
      const stopNames = new Set(stops.map(s => (s.city || '').trim().toLowerCase()));
      const labelEls = this.mainCityLabelsEl.children;
      this._mapCities.forEach(([name, lat, lng], i) => {
        const el = labelEls[i];
        if (!el) return;
        if (stopNames.has(name.toLowerCase()) || !bounds.contains([lat, lng])) { el.style.display = 'none'; return; }
        el.style.display = '';
        const pt = map.latLngToContainerPoint([lat, lng]);
        el.style.left = (pt.x + 2) + 'px';
        el.style.top = (pt.y - 4) + 'px';
      });

      this._updateMainLeaders();
    }

    _updateMainLeaders() {
      if (!this.mainLeafletMap) return;
      const map = this.mainLeafletMap;
      const trip = this.currentTrip();
      const stops = trip.stops;
      const { w: CARD_W, h: CARD_H } = this._mainCardSize();
      const rect = this.mainMapEl.getBoundingClientRect();
      const svgW = rect.width || 800, svgH = rect.height || 480;
      this.mainLeadersEl.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`);
      this.mainLeadersEl.setAttribute('width', svgW);
      this.mainLeadersEl.setAttribute('height', svgH);

      let linesHTML = '';
      stops.forEach((stop, idx) => {
        const coord = this.resolveCoord(stop.city);
        if (!coord) return;
        const pinPt = map.latLngToContainerPoint(coord);
        const cardEl = this.mainCardsOverlayEl.querySelector(`.map-stop[data-i="${idx}"]`);
        if (!cardEl || cardEl.style.display === 'none') return;   // hidden (mobile pins-only) → no leader
        const cx = parseFloat(cardEl.style.left) + CARD_W / 2;
        const cy = parseFloat(cardEl.style.top) + CARD_H / 2;
        if (isNaN(cx) || isNaN(cy)) return;
        linesHTML += `<line class="mini-leader" x1="${pinPt.x.toFixed(1)}" y1="${pinPt.y.toFixed(1)}" x2="${cx.toFixed(1)}" y2="${cy.toFixed(1)}" stroke="oklch(40% 0.012 70)" stroke-width="0.9" stroke-dasharray="5 4" opacity="0.28"/>`;
      });
      this.mainLeadersEl.innerHTML = linesHTML;
    }

    /* ---------- per-day itinerary map (inside the modal) ---------- */
    geocode(address, cityHint) {
      const q = (address || '').trim();
      if (!q) return Promise.resolve(null);
      const key = normKey(q) + '|' + normKey(cityHint || '');
      if (this._geoCache.has(key)) return Promise.resolve(this._geoCache.get(key));
      // serialize lookups ~1.1s apart to respect the Nominatim usage policy
      const run = this._geoQueue.then(async () => {
        if (this._geoCache.has(key)) return this._geoCache.get(key);
        const wait = Math.max(0, 1100 - (Date.now() - this._geoLast));
        if (wait) await new Promise(r => setTimeout(r, wait));
        this._geoLast = Date.now();
        let coord = null;
        try {
          const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=' + encodeURIComponent(cityHint ? (q + ', ' + cityHint) : q);
          const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
          if (res.ok) { const j = await res.json(); if (j && j[0]) coord = { lat: parseFloat(j[0].lat), lng: parseFloat(j[0].lon) }; }
        } catch (e) { /* offline / blocked → leave null */ }
        this._geoCache.set(key, coord);
        return coord;
      });
      this._geoQueue = run.catch(() => {});
      return run;
    }

    /* ---------- daily weather (Open-Meteo — keyless & CORS-open, like the
       geocoder). One request covers a whole stay. Near-term stays (inside the
       16-day forecast window) get a real forecast; stays further out — or fully
       in the past — fall back to the archive API for the same calendar dates,
       shown as "typical" weather for future trips. Cached in-memory and in
       localStorage: forecasts go stale after 3h; typical/archive values are
       stable, so they live 30 days. Nothing blocks a render — a cache miss
       serves nothing and kicks off a fetch that re-renders on arrival, exactly
       like the geocoder feeding the day map. ---------- */
    _wxISO(d) { const p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
    _wxParseISO(s) { const a = s.split('-').map(Number); return new Date(a[0], a[1] - 1, a[2]); }
    _wxShiftYear(d, n) { const x = new Date(d); x.setFullYear(x.getFullYear() + n); return x; }
    _wxKey(coord, start, end) { return coord[0].toFixed(2) + ',' + coord[1].toFixed(2) + '|' + this._wxISO(start) + '|' + this._wxISO(end); }
    _wxStale(entry) {
      const age = Date.now() - (entry.ts || 0);
      return age > (entry.kind === 'forecast' ? 3 * 3600e3 : 30 * 86400e3);
    }
    // Weather for a single stay day, resolved through the stop's city coord.
    // Returns { code, hi, lo, pop, typical } or null when nothing is cached yet.
    dayWeather(stop, range, dayIdx) {
      if (!range || dayIdx == null || dayIdx < 0) return null;
      const coord = this.resolveCoord(stop && stop.city);   // also kicks off geocoding on a miss
      if (!coord) return null;
      const entry = this._weatherForStay(coord, range.start, range.end);
      if (!entry) return null;
      const dt = new Date(range.start); dt.setDate(dt.getDate() + dayIdx);
      const wx = entry.days[this._wxISO(dt)];
      return wx ? Object.assign({ typical: entry.kind === 'typical' }, wx) : null;
    }
    _weatherForStay(coord, start, end) {
      const key = this._wxKey(coord, start, end);
      const hit = this._wxCache.get(key);
      if (hit && !this._wxStale(hit)) return hit;      // fresh → use it
      this._fetchWeather(key, coord, start, end);      // miss/stale → refresh
      return hit || null;                              // serve stale (if any) meanwhile
    }
    _fetchWeather(key, coord, start, end) {
      if (this._wxPending.has(key)) return;
      this._wxPending.add(key);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const dayMs = 86400e3;
      const startOut = Math.round((start - today) / dayMs);
      const endOut = Math.round((end - today) / dayMs);
      const lat = coord[0].toFixed(3), lng = coord[1].toFixed(3);
      let url, kind, yearShift = 0;
      if (startOut >= -1 && endOut <= 15) {
        // whole stay sits inside the live forecast window (yesterday → +16d)
        kind = 'forecast';
        url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lng +
          '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
          '&timezone=auto&forecast_days=16';
      } else {
        // outside the window: read the archive for the same calendar dates.
        // Future trips shift back to the last finished year → "typical"; past
        // trips read their own dates → actual recorded weather.
        kind = startOut > 15 ? 'typical' : 'actual';
        if (kind === 'typical') { yearShift = new Date().getFullYear() - start.getFullYear(); if (yearShift <= 0) yearShift = 1; }
        const s = this._wxShiftYear(start, -yearShift);
        const e = this._wxShiftYear(end, -yearShift);
        url = 'https://archive-api.open-meteo.com/v1/archive?latitude=' + lat + '&longitude=' + lng +
          '&start_date=' + this._wxISO(s) + '&end_date=' + this._wxISO(e) +
          '&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto';
      }
      fetch(url)
        .then(r => r.ok ? r.json() : null)
        .then(j => {
          const days = {};
          const dd = j && j.daily;
          if (dd && Array.isArray(dd.time)) {
            for (let i = 0; i < dd.time.length; i++) {
              // re-key shifted archive dates back onto the stay's own dates
              let iso = dd.time[i];
              if (yearShift) iso = this._wxISO(this._wxShiftYear(this._wxParseISO(iso), yearShift));
              const hi = dd.temperature_2m_max, lo = dd.temperature_2m_min, pp = dd.precipitation_probability_max;
              days[iso] = {
                code: dd.weather_code ? dd.weather_code[i] : null,
                hi: (hi && hi[i] != null) ? Math.round(hi[i]) : null,
                lo: (lo && lo[i] != null) ? Math.round(lo[i]) : null,
                pop: (pp && pp[i] != null) ? pp[i] : null,
              };
            }
          }
          return days;
        })
        .catch(() => ({}))     // offline / blocked → cache an empty entry so we don't hammer
        .then(days => {
          this._wxCache.set(key, { kind, ts: Date.now(), days });
          this._persistWeather();
          this._wxPending.delete(key);
          // re-render only if the itinerary is still open (day header shows the
          // chip); if the modal was closed meanwhile the value simply waits in cache
          if (this.openStopIdx != null) this.bumpModal();
        });
    }
    _persistWeather() {
      try {
        const o = {}; this._wxCache.forEach((v, k) => { o[k] = v; });
        localStorage.setItem(WX_CACHE_KEY, JSON.stringify(o));
      } catch (e) {}
    }
    _loadWeather() {
      try {
        const o = JSON.parse(localStorage.getItem(WX_CACHE_KEY) || '{}');
        Object.keys(o).forEach(k => { const v = o[k]; if (v && v.days && !this._wxStale(v)) this._wxCache.set(k, v); });
      } catch (e) {}
    }
    ensureDayMap(tries) {
      if (!this.dayMapEl.isConnected || !window.L) { if ((tries || 0) < 80) setTimeout(() => this.ensureDayMap((tries || 0) + 1), 100); return; }
      if (this.dayMap) { this.dayMap.invalidateSize(); this.renderDayMap(); return; }
      const L = window.L;
      this.dayMap = L.map(this.dayMapEl, { scrollWheelZoom: false, zoomSnap: .25, zoomDelta: .5, wheelPxPerZoomLevel: 120, inertia: true, attributionControl: false });
      // Labels differ by version (see _mobileMap):
      //  · APP (phone): area names only — dark_nolabels base + a transparent
      //    area-label overlay capped at z15. Street names (Carto puts them in
      //    the label tiles ~z16+) stay below the cap and never load. UNCHANGED.
      //  · WEB (desktop): full dark_all labels, i.e. street names shown — the
      //    street-label setting from before the area-only overlay existed.
      // NOTE: do not get clever with tileSize 512 / zoomOffset -1 here — that
      // combination broke tile loading and the map went blank-black.
      if (this._mobileMap()) {
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', { maxZoom: 19, detectRetina: true }).addTo(this.dayMap);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png', { maxZoom: 15, detectRetina: true }).addTo(this.dayMap);
      } else {
        // Web: dilated bold-white street base, plus the labels (street names
        // included) in their OWN pane so the street-line dilate filter never
        // touches the text — dilating the baked-in labels made them unreadable
        // blobs. The label pane gets its own gentle whitening filter (no
        // dilate) via .leaflet-daylabels-pane in styles.css.
        this.dayMap.createPane('daylabels');
        const lp = this.dayMap.getPane('daylabels');
        lp.style.zIndex = 550;              // above tiles + grain, below markers (600)
        lp.style.pointerEvents = 'none';
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', { maxZoom: 19, detectRetina: true }).addTo(this.dayMap);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png', { maxZoom: 19, detectRetina: true, pane: 'daylabels' }).addTo(this.dayMap);
      }
      this.dayLines = L.layerGroup().addTo(this.dayMap);
      this.dayMarkers = L.layerGroup().addTo(this.dayMap);
      this.dayMap.setView([48, 10], 4);
      this.dayMapEl.addEventListener('mouseenter', () => this.dayMap.scrollWheelZoom.enable());
      this.dayMapEl.addEventListener('mouseleave', () => this.dayMap.scrollWheelZoom.disable());
      this.renderDayMap();
      // the modal animates in; recompute size once it settles so tiles aren't blank
      requestAnimationFrame(() => { if (this.dayMap) this.dayMap.invalidateSize(); });
      setTimeout(() => { if (this.dayMap) { this.dayMap.invalidateSize(); this.renderDayMap(); } }, 360);
    }
    countPlaced(stop, items) {
      return (items || []).filter(it => {
        const q = (it.address || '').trim() || (it.text || '').trim();
        if (!q) return false;
        const cityHint = q.includes(',') ? '' : (stop.city || '');
        if (this._geoCache.get(normKey(q) + '|' + normKey(cityHint))) return true;
        const parts = q.split(',').map(s => s.trim()).filter(Boolean);
        if (parts.length >= 3 && !/\d/.test(parts[0])) {
          if (this._geoCache.get(normKey(parts.slice(1).join(', ')) + '|')) return true;
        }
        return false;
      }).length;
    }
    scheduleDayMap() {
      if (!this.dayMap) return;
      clearTimeout(this._dayMapTimer);
      this._dayMapTimer = setTimeout(() => {
        this.dayMap.invalidateSize();
        this.renderDayMap();
        // patch optimize button disabled state — renderDayMap runs async after geocoding,
        // so the button HTML rendered at modal-open time is stale
        const btn = this.modalEl.querySelector('.optimize-btn');
        if (btn && this.openStopIdx != null && this.activeDay != null) {
          const stop = this.currentTrip().stops[this.openStopIdx];
          const day = stop && (stop.itinerary || [])[this.activeDay];
          const n = this.countPlaced(stop, day && day.items);
          btn.disabled = n < 2;
          btn.title = n < 2 ? 'Add an address to at least 2 activities first' : 'Reorder the day to avoid backtracking';
        }
      }, 200);
    }
    renderDayMap() {
      if (!this.dayMap || !window.L) return;
      const L = window.L;
      const trip = this.currentTrip();
      const stop = trip.stops[this.openStopIdx];
      if (!stop || this.activeDay == null) return;
      this.dayLines.clearLayers(); this.dayMarkers.clearLayers();
      const day = (stop.itinerary || [])[this.activeDay] || { items: [] };
      const items = day.items || [];
      const cityCoord = this.resolveCoord(stop.city);
      // Strip a leading business/venue name from a Google Maps address string.
      // e.g. "Souvenir and Coffee, Budapest, Kristóf tér 3, 1052 Hungary"
      //   → "Budapest, Kristóf tér 3, 1052 Hungary"
      // Heuristic: first segment has no digits AND at least one later segment does.
      const stripVenueName = (a) => {
        const parts = a.split(',').map(s => s.trim()).filter(Boolean);
        if (parts.length < 3 || /\d/.test(parts[0])) return null;
        if (!parts.slice(1).some(p => /\d/.test(p))) return null;
        return parts.slice(1).join(', ');
      };

      // Try geocoding with automatic fallback chain, returning the best coord found.
      // Returns { coord, pending: true } or { coord: null/obj, pending: false }.
      const resolve = (addr, cityHint) => {
        const key = normKey(addr) + '|' + normKey(cityHint);
        if (!this._geoCache.has(key)) {
          this.geocode(addr, cityHint).then(() => this.scheduleDayMap());
          return { coord: null, pending: true };
        }
        return { coord: this._geoCache.get(key), pending: false };
      };

      const pts = []; let placed = 0, withAddr = 0, pending = 0, notFound = 0;
      items.forEach((it, ii) => {
        // use explicit address if set, otherwise fall back to the activity text as a place name
        const addr = (it.address || '').trim() || (it.text || '').trim();
        if (!addr) return;
        withAddr++;
        // Full formatted addresses (commas) already contain location; don't append city.
        // Short landmark names benefit from city hint for disambiguation.
        const cityHint = addr.includes(',') ? '' : (stop.city || '');

        let r = resolve(addr, cityHint);
        if (r.pending) { pending++; return; }
        let coord = r.coord;

        if (!coord) {
          // Try stripping a leading venue/business name (Google Maps pastes include it)
          const stripped = stripVenueName(addr);
          if (stripped) {
            r = resolve(stripped, '');
            if (r.pending) { pending++; return; }
            coord = r.coord;
          }
        }

        if (!coord && cityHint) {
          // Short name with city hint returned nothing — try without city hint
          r = resolve(addr, '');
          if (r.pending) { pending++; return; }
          coord = r.coord;
        }

        if (!coord) { notFound++; return; }
        placed++;
        pts.push([coord.lat, coord.lng]);
        const label = it.text || addr;
        const marker = L.marker([coord.lat, coord.lng], {
          icon: L.divIcon({ className: 'day-pin' + (ii === this._selectedItem ? ' active' : ''), html: '<span data-n="' + (ii + 1) + '"></span>', iconSize: [28, 28], iconAnchor: [8, 28] })
        });
        marker.on('click', () => {
          const wasSelected = this._selectedItem === ii;
          this._selectedItem = wasSelected ? null : ii;
          this._flashItem = null;
          this.bumpModal();
          if (!wasSelected) this.scrollToItem(ii);
        });
        this.dayMarkers.addLayer(marker);
      });
      // chosen hotel → a distinct "home base" pin and the route's start point,
      // geocoded from its address (same key the optimizer uses via hotelHQ)
      let hotelPt = null;
      const hq = this.hotelHQ(stop);
      if (hq) {
        const hr = resolve(hq.q, hq.cityHint);
        if (hr.pending) pending++;
        else if (hr.coord) {
          hotelPt = [hr.coord.lat, hr.coord.lng];
          this.dayMarkers.addLayer(L.marker(hotelPt, {
            title: hq.name, zIndexOffset: -50,
            icon: L.divIcon({ className: 'day-pin day-pin-hotel', html: '<span>' + svg(I.bed, { w: 13, h: 13, sw: 2, stroke: '#1a1a1a' }) + '</span>', iconSize: [30, 30], iconAnchor: [9, 30] })
          }));
        }
      }

      const routePts = hotelPt ? [hotelPt].concat(pts) : pts;
      if (routePts.length > 1) {
        this.dayLines.addLayer(L.polyline(routePts, { color: '#ffffff', weight: 1.8, opacity: .6, dashArray: '6 8', className: 'day-route-line' }));   // .day-route-line CSS: dark dashes on the light map, white on the night map
        // draw the route in once per opened day (then it settles to its CSS dashes)
        const dkey = this.openStopIdx + ':' + this.activeDay;
        if (this._dayRouteKey !== dkey) {
          this._dayRouteKey = dkey;
          const dpath = this.dayMapEl.querySelector('path.day-route-line');
          this._animateStroke(dpath, { dur: 1000, delay: 120, restore: true });
        }
      }
      if (routePts.length === 1) this.dayMap.setView(routePts[0], 14);
      else if (routePts.length > 1) this.dayMap.fitBounds(routePts, { padding: [30, 30], maxZoom: 15 });
      else if (cityCoord) this.dayMap.setView(cityCoord, 11);
      const cap = this.modalEl.querySelector('.daymap-cap');
      if (cap) {
        if (withAddr === 0) cap.textContent = 'Add a place name or address to any activity to map it.';
        else if (pending > 0) cap.textContent = placed + ' of ' + withAddr + ' placed · locating' + (notFound ? ', ' + notFound + ' not found' : '') + '…';
        else if (placed === 0 && notFound > 0) cap.textContent = 'Could not locate ' + notFound + ' address' + (notFound > 1 ? 'es' : '') + ' — try a full street address or landmark name.';
        else cap.textContent = placed + ' of ' + withAddr + ' placed' + (notFound ? ' · ' + notFound + ' not found' : '');
      }
    }
    scrollToItem(ii) {
      const el = this.modalEl.querySelector('.item[data-idx="' + ii + '"]');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    /* ---------- day-plan route optimizer (avoid backtracking) ---------- */
    haversine(a, b) {
      const R = 6371, toR = Math.PI / 180;
      const dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
      const la1 = a.lat * toR, la2 = b.lat * toR;
      const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
      return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
    }
    parseTimeMin(s) {
      const m = String(s || '').match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
      if (!m) return Infinity;
      let h = Number(m[1]); const min = Number(m[2] || 0); const ap = (m[3] || '').toLowerCase();
      if (ap === 'pm' && h < 12) h += 12; if (ap === 'am' && h === 12) h = 0;
      return h * 60 + min;
    }
    pathLen(order) { let d = 0; for (let i = 0; i < order.length - 1; i++) d += this.haversine(order[i], order[i + 1]); return d; }
    // The chosen hotel's geocode query — shared by the day map (pin) and the
    // optimizer (route origin) so both hit the same _geoCache key. Prefers the
    // explicit address; falls back to the hotel name. Returns null if neither.
    hotelHQ(stop) {
      const chosen = ((stop && stop.accom && stop.accom.options) || []).find(o => o.chosen);
      if (!chosen) return null;
      const q = (chosen.address || '').trim() || (chosen.name || '').trim();
      if (!q) return null;
      const cityHint = q.includes(',') ? '' : (stop.city || '');   // full addresses already carry the city
      return { q, cityHint, name: (chosen.name || '').trim() || q };
    }
    optimizeDay() {
      const stop = this.currentTrip().stops[this.openStopIdx];
      if (!stop || this.activeDay == null) return;
      const day = stop.itinerary[this.activeDay] || { items: [] };
      const items = day.items || [];
      // split into geocoded (placeable) and the rest (kept in original order, appended)
      const placed = [], unplaced = [];
      items.forEach((it, idx) => {
        const q = (it.address || '').trim() || (it.text || '').trim();
        const cityHint = q.includes(',') ? '' : (stop.city || '');
        let coord = this._geoCache.get(normKey(q) + '|' + normKey(cityHint));
        if (!coord) {
          const parts = q.split(',').map(s => s.trim()).filter(Boolean);
          if (parts.length >= 3 && !/\d/.test(parts[0])) coord = this._geoCache.get(normKey(parts.slice(1).join(', ')) + '|');
        }
        if (coord) placed.push({ it, idx, lat: coord.lat, lng: coord.lng });
        else unplaced.push({ it, idx });
      });
      if (placed.length < 2) { this._optimizeNote = { kind: 'warn', text: 'Add an address to at least two activities so they can be placed on the map, then optimize.' }; this.bumpModal(); return; }

      // Resolve the chosen hotel (by address, falling back to name) as the fixed route origin
      const hq = this.hotelHQ(stop);
      let origin = null;
      if (hq) {
        const hKey = normKey(hq.q) + '|' + normKey(hq.cityHint);
        if (!this._geoCache.has(hKey)) {
          // hotel not geocoded yet — trigger it and ask user to retry
          this.geocode(hq.q, hq.cityHint).then(() => this.scheduleDayMap());
          this._optimizeNote = { kind: 'warn', text: 'Locating your hotel — try Optimize again in a moment.' };
          this.bumpModal(); return;
        }
        origin = this._geoCache.get(hKey) || null;
      }
      // fall back to city-center coordinates
      if (!origin) {
        const cc = this.resolveCoord(stop.city);
        if (cc) origin = { lat: cc[0], lng: cc[1] };
      }

      const totalLen = (route) => {
        const start = origin || route[0];
        return this.haversine(start, route[0]) + this.pathLen(route);
      };

      const before = totalLen(placed);

      // NN from fixed origin → 2-opt keeping origin fixed
      const nnFromOrigin = () => {
        const used = new Array(placed.length).fill(false);
        const route = []; let cur = origin || placed[0];
        for (let k = 0; k < placed.length; k++) {
          let bi = -1, bd = Infinity;
          for (let j = 0; j < placed.length; j++) {
            if (!used[j]) { const d = this.haversine(cur, placed[j]); if (d < bd) { bd = d; bi = j; } }
          }
          route.push(placed[bi]); used[bi] = true; cur = placed[bi];
        }
        return route;
      };
      const twoOpt = (route) => {
        let improved = true;
        while (improved) {
          improved = false;
          for (let i = 0; i < route.length - 1; i++) {
            for (let k = i + 1; k < route.length; k++) {
              const cand = route.slice(0, i).concat(route.slice(i, k + 1).reverse(), route.slice(k + 1));
              if (totalLen(cand) + 1e-9 < totalLen(route)) { route = cand; improved = true; }
            }
          }
        }
        return route;
      };
      const best = twoOpt(nnFromOrigin());
      const bestLen = totalLen(best);

      // keep schedule chronological: reassign the existing time strings in sorted order
      const newItems = best.map(p => p.it).concat(unplaced.map(u => u.it));
      const times = items.map(it => it.time).filter(t => /\S/.test(t || '')).sort((a, b) => this.parseTimeMin(a) - this.parseTimeMin(b));
      newItems.forEach((it, i) => { it.time = i < times.length ? times[i] : ''; });

      const same = newItems.every((it, i) => it === items[i]);
      const savedPct = before > 0 ? Math.round((1 - bestLen / before) * 100) : 0;
      this.snapshot();
      day.items = newItems;
      const originLabel = (hq && origin) ? hq.name : (origin ? stop.city : null);
      const originNote = originLabel ? ` from ${originLabel}` : '';
      this._optimizeNote = same
        ? { kind: 'ok', text: `Already the most efficient order${originNote} — no changes needed.` }
        : { kind: 'ok', text: `Reordered ${placed.length} stops${originNote} — route ${savedPct > 0 ? savedPct + '% shorter' : 'tightened'} (${before.toFixed(1)} → ${bestLen.toFixed(1)} km). Times kept in order. Undo with ⌘/Ctrl-Z.` };
      this.bump();
    }

    /* ---------- mutators: stops / trips / todos ---------- */
    insertStop(idx) {
      this.currentTrip().stops.splice(idx, 0, { city: '', nights: 2, note: '', leg: { mode: 'train', duration: '', cost: 0 } });
      if (this._webMag()) {
        // web ledger: the new stop is entered in the column's card slot — the
        // floating map card must NOT claim edit mode (it would steal focus)
        this.stopInfoIdx = idx;
      } else {
        this._editingStopIdx = idx;
        if (this._mobileMap()) { this._openMapCardIdx = idx; this._openMapCardFlipped = true; }   // new stop pops up in edit mode
      }
      this.bump();
      if (this._webMag()) {
        const ci = this.root.querySelector('.stop-spot input.city');
        if (ci) { ci.focus(); ci.select(); }
      }
    }
    removeStop(idx) {
      this.snapshot(); this.currentTrip().stops.splice(idx, 1);
      if (this.openStopIdx === idx) this.openStopIdx = null;
      if (this._openMapCardIdx != null) { this._openMapCardIdx = null; this._openMapCardFlipped = false; }
      if (this.stopInfoIdx != null) {
        if (this.stopInfoIdx === idx) this.stopInfoIdx = null;
        else if (this.stopInfoIdx > idx) this.stopInfoIdx--;
      }
      this.bump();
    }
    reorderStop(from, to) {
      if (from === to) return;
      const st = this.currentTrip().stops; const [it] = st.splice(from, 1); st.splice(to, 0, it);
      if (this.openStopIdx === from) this.openStopIdx = to;
      if (this._openMapCardIdx === from) this._openMapCardIdx = to;   // popup follows its stop
      if (this.stopInfoIdx === from) this.stopInfoIdx = to;           // column preview follows too
      this.bump();
    }
    addTrip() {
      const key = 'trip' + Date.now();
      const n = Object.keys(this.data.trips).length + 1;
      this.data.trips[key] = {
        label: 'Trip ' + n, depart: '', returnDate: '', travelers: this.data.meta.travelers || 2,
        originLabel: '', outboundLeg: { mode: 'flight', duration: '', cost: 0 },
        stops: [{ city: '', nights: 0, note: '', leg: { mode: 'flight', duration: '', cost: 0 } }], homeLabel: '', closet: []
      };
      this.tripKeys();   // self-heals data.tripOrder to include the new trip (appended at the end)
      this.data.active = key; this.bump();
    }
    removeTrip(key) {
      const keys = this.tripKeys();
      if (keys.length <= 1) return;
      if (!confirm('Remove this trip and everything in it?')) return;
      this.snapshot();
      delete this.data.trips[key];
      this.data.tripOrder = keys.filter(k => k !== key);
      if (this.data.active === key) this.data.active = this.data.tripOrder[0];
      this.bump();
    }
    reorderTrips(fromKey, toKey) {
      if (!fromKey || fromKey === toKey) return;
      // reorder the explicit order array (jsonb-safe) — don't rebuild the trips
      // object, whose key order the sync would drop anyway
      const keys = this.tripKeys(); const fi = keys.indexOf(fromKey), ti = keys.indexOf(toKey);
      if (fi < 0 || ti < 0) return;
      keys.splice(fi, 1); keys.splice(ti, 0, fromKey);
      this.data.tripOrder = keys; this.bump();
    }
    addTodo() { this.data.meta.todos.push({ text: '', done: false }); this.bump(); }
    removeTodo(i) { this.snapshot(); this.data.meta.todos.splice(i, 1); this.bump(); }

    /* ---------- itinerary / accommodation ---------- */
    openStop(idx) {
      this.openStopIdx = idx; this.activeDay = null; this._optimizeNote = null; this._selectedItem = null;
      // web ledger: the itinerary is page 2 — flip to it with this stop selected
      if (this._webMag()) { this.render(); this.magGoto(1); return; }
      // app: itinerary is sub-page 1 — rise it up with this stop selected
      this.appStopIdx = idx; this.render(); this.appGoto(1);
    }
    closeStop() { if (!this._webMag()) { this.appGoto(0); return; } this.openStopIdx = null; this.bumpModal(); }
    openAccom(idx) {
      this.accomOpenIdx = idx;
      // web ledger: hotels share page 3 with transport
      if (this._webMag()) { this.render(); this.magGoto(2); return; }
      // app: hotel is sub-page 2
      this.appStopIdx = idx; this.render(); this.appGoto(2);
    }
    closeAccom() { if (!this._webMag()) { this.appGoto(0); return; } this.accomOpenIdx = null; this.bumpModal(); }
    openTransport(idx) {
      // web ledger: transport is inline on page 3 (same stop selector as hotels)
      if (this._webMag()) { this.accomOpenIdx = idx; this.render(); this.magGoto(2); return; }
      // app: transport is sub-page 3
      this.appStopIdx = idx; this.render(); this.appGoto(3);
    }
    closeTransport() { if (!this._webMag()) { this.appGoto(0); return; } this.transportOpenIdx = null; this.bumpModal(); }
    ensureItinerary(stop) {
      if (!Array.isArray(stop.itinerary)) stop.itinerary = [];
      const days = Math.max(1, Number(stop.nights) || 1);
      while (stop.itinerary.length < days) stop.itinerary.push({ items: [], outfits: [] });
      stop.itinerary.forEach(d => { if (!Array.isArray(d.outfits)) d.outfits = []; if (!Array.isArray(d.items)) d.items = []; });
      return stop.itinerary;
    }
    addDayItem(stop, dayIdx) { this.ensureItinerary(stop); stop.itinerary[dayIdx].items.push({ time: '', text: '' }); this.bump(); }
    removeDayItem(stop, dayIdx, itemIdx) { stop.itinerary[dayIdx].items.splice(itemIdx, 1); this.bump(); }
    addAccomOption(stopIdx) { const s = this.currentTrip().stops[stopIdx]; if (!s.accom) s.accom = { options: [] }; s.accom.options.push({ id: Date.now(), name: '', link: '', address: '', totalPrice: '', features: '', distance: '', chosen: false }); this.bump(); }
    removeAccomOption(stopIdx, optIdx) { this.snapshot(); this.currentTrip().stops[stopIdx].accom.options.splice(optIdx, 1); this.bump(); }
    chooseAccomOption(stopIdx, optIdx) {
      const opts = this.currentTrip().stops[stopIdx].accom.options;
      const opt = opts[optIdx];
      if (opt.chosen) { opt.chosen = false; this.bump(); return; }   // toggle off
      opt.chosen = true;                                              // choose it
      // allow at most 2 chosen at once: if this makes a 3rd, drop the
      // earliest other chosen option so the newest two stay selected
      let others = opts.filter((x, i) => x.chosen && i !== optIdx).length;
      for (let i = 0; i < opts.length && others > 1; i++) {
        if (i !== optIdx && opts[i].chosen) { opts[i].chosen = false; others--; }
      }
      this.bump();
    }

    /* ---------- outfit closet ---------- */
    ensureCloset() { const t = this.currentTrip(); if (!Array.isArray(t.closet)) t.closet = []; return t.closet; }
    dayOutfits(stop, dayIdx) { this.ensureItinerary(stop); const d = stop.itinerary[dayIdx] || (stop.itinerary[dayIdx] = { items: [], outfits: [] }); if (!Array.isArray(d.outfits)) d.outfits = []; return d.outfits; }
    toggleOutfitOnDay(id, stopIdx, dayIdx) { const arr = this.dayOutfits(this.currentTrip().stops[stopIdx], dayIdx); const i = arr.findIndex(e => e.id === id); if (i >= 0) arr.splice(i, 1); this.bump(); }
    removeOutfitFromCloset(id) {
      const t = this.currentTrip();
      t.closet = (t.closet || []).filter(o => o.id !== id);
      this.bump();
    }
    plannerDrop(targetStopIdx, targetDayIdx) {
      const drag = this._plannerDrag; if (!drag) return;
      if (drag.kind === 'closet') {
        const arr = this.dayOutfits(this.currentTrip().stops[targetStopIdx], targetDayIdx);
        if (!arr.some(e => e.id === drag.id)) arr.push({ id: drag.id, image: drag.image });
      } else if (drag.kind === 'day') {
        if (drag.stopIdx === targetStopIdx && drag.dayIdx === targetDayIdx) { this._plannerDrag = null; return; }
        const fromArr = this.dayOutfits(this.currentTrip().stops[drag.stopIdx], drag.dayIdx);
        const i = fromArr.findIndex(e => e.id === drag.id); if (i >= 0) fromArr.splice(i, 1);
        const toArr = this.dayOutfits(this.currentTrip().stops[targetStopIdx], targetDayIdx);
        if (!toArr.some(e => e.id === drag.id)) toArr.push({ id: drag.id, image: drag.image });
      } else if (drag.kind === 'activity') {
        if (drag.stopIdx === targetStopIdx && drag.dayIdx === targetDayIdx) { this._plannerDrag = null; return; }
        const stop = this.currentTrip().stops[targetStopIdx];
        this.ensureItinerary(stop);
        const fromDay = stop.itinerary[drag.dayIdx];
        const toDay = stop.itinerary[targetDayIdx];
        if (!fromDay || !fromDay.items[drag.itemIdx]) { this._plannerDrag = null; return; }
        const [moved] = fromDay.items.splice(drag.itemIdx, 1);
        toDay.items.push(moved);
        this._selectedItem = null; this._flashItem = null;
      }
      this._plannerDrag = null; this.bump();
    }
    async addClosetSticker(file) {
      if (!file || !file.type.startsWith('image/')) return;
      const url = await new Promise(r => { const fr = new FileReader(); fr.onload = e => r(e.target.result); fr.readAsDataURL(file); });
      const dataUrl = await this.autoCutout(url);
      const closet = this.ensureCloset();
      const id = 'o' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      closet.push({ id, image: dataUrl });
      // auto-assign to the open day if any
      if (this.openStopIdx != null && this.activeDay != null) {
        const arr = this.dayOutfits(this.currentTrip().stops[this.openStopIdx], this.activeDay);
        if (!arr.some(e => e.id === id)) arr.push({ id, image: dataUrl });
      }
      this.bump();
    }
    autoCutout(dataUrl) {
      // Cap every incoming image to STICKER_MAX_PX on its longest side before it
      // enters state. Phone photos are multi-megapixel; unscaled base64 bloats
      // the synced payload past the free JSON stores' size caps, so stickers
      // (and every edit after them) silently fail to sync to other devices.
      const MAX = 512;
      return new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, MAX / Math.max(img.width, img.height));
          const W = Math.max(1, Math.round(img.width * scale));
          const H = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
          const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, W, H);
          const scaled = () => this._encodeSticker(canvas, dataUrl);
          let d; try { d = ctx.getImageData(0, 0, W, H); } catch (e) { resolve(scaled()); return; }
          const px = d.data;
          let hasAlpha = false;
          for (let i = 3; i < px.length; i += 4) { if (px[i] < 200) { hasAlpha = true; break; } }
          if (hasAlpha) { resolve(scaled()); return; }   // keep existing transparency, just downscaled
          const samp = (x, y) => { const i = (y * W + x) * 4; return [px[i], px[i + 1], px[i + 2]]; };
          const corners = [samp(0, 0), samp(W - 1, 0), samp(0, H - 1), samp(W - 1, H - 1)];
          const bg = corners.reduce((a, c) => [a[0] + c[0], a[1] + c[1], a[2] + c[2]], [0, 0, 0]).map(v => v / 4);
          for (let i = 0; i < px.length; i += 4) {
            const dr = px[i] - bg[0], dg = px[i + 1] - bg[1], db = px[i + 2] - bg[2];
            const dist = Math.sqrt(dr * dr + dg * dg + db * db);
            if (dist < 42) px[i + 3] = 0; else if (dist < 85) px[i + 3] = Math.round((dist - 42) / 43 * 255);
          }
          ctx.putImageData(d, 0, 0); resolve(this._encodeSticker(canvas, dataUrl));
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
      });
    }
    // Encode a (downscaled) sticker canvas as compactly as the browser allows.
    // WebP is lossy AND keeps the alpha the cutout produces, so it's ~5-10× the
    // size of the equivalent PNG — the difference between a sticker that syncs
    // and one that overflows the store. Falls back to PNG (alpha-safe) where
    // WebP isn't supported, and to the original data URL only if encoding fails.
    _encodeSticker(canvas, fallbackUrl) {
      try {
        const webp = canvas.toDataURL('image/webp', 0.82);
        if (webp.indexOf('data:image/webp') === 0) return webp;
      } catch (e) {}
      try { return canvas.toDataURL('image/png'); } catch (e) { return fallbackUrl; }
    }

    /* ---------- page stickers ---------- */
    async addToStickerStock(files) {
      for (const file of Array.from(files)) {
        if (!file || !file.type.startsWith('image/')) continue;
        const url = await new Promise(r => { const fr = new FileReader(); fr.onload = ev => r(ev.target.result); fr.readAsDataURL(file); });
        const dataUrl = await this.autoCutout(url);
        const id = 'sk' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        this.data.stickerStock.push({ id, image: dataUrl });
      }
      this.bump();
    }
    removeFromStickerStock(id) {
      this.data.stickerStock = this.data.stickerStock.filter(s => s.id !== id);
      this.bump();
    }
    placeSticker(stockId, x, y, target = 'page') {
      const id = 'ps' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      const stock = this.data.stickerStock.find(s => s.id === stockId);
      if (!stock) return;
      this.data.placedStickers.push({ id, stockId, image: stock.image, x: Math.round(x), y: Math.round(y), w: 80, target });
      this.bump();
    }
    removePlacedSticker(id) {
      this.data.placedStickers = this.data.placedStickers.filter(s => s.id !== id);
      this.bump();
    }

    /* ---------- export / import ---------- */
    /* ---------- budget computation ---------- */
    computeBudget(trip, travelers, nights) {
      const meta = this.data.meta;
      const legs = [trip.outboundLeg, ...trip.stops.map(s => s.leg)];
      const bud = meta.budget;
      const flightCost = legs.reduce((s, l) => s + (l.mode === 'flight' ? (Number(l.cost) || 0) : 0), 0) * travelers;
      const intercityCost = legs.reduce((s, l) => s + (l.mode !== 'flight' ? (Number(l.cost) || 0) : 0), 0) * travelers;
      const cityPassLines = trip.stops.map(st => {
        const p = CITY_PASS_LOCAL[normKey(st.city)] || DEFAULT_PASS;
        const known = !!CITY_PASS_LOCAL[normKey(st.city)];
        const rateCad = p.a * (FX_CAD[p.c] || 1);
        const n = Number(st.nights) || 0;
        return { city: st.city, localAmt: p.a, ccy: p.c, rateCad, nights: n, total: rateCad * n * travelers, known };
      });
      const cityPassAuto = cityPassLines.reduce((s, c) => s + c.total, 0);
      const cityPassTotal = bud.cityPassOverride != null ? Number(bud.cityPassOverride) : cityPassAuto;
      const cityPassDetail = cityPassLines.map(c => `${c.city} ${c.localAmt} ${c.ccy}·$${c.rateCad.toFixed(0)}/day×${c.nights}${c.known ? '' : ' (est.)'}`).join(' · ');
      const parseAmt = s => { const m = (s || '').replace(/,/g, '').match(/\d+(\.\d+)?/); return m ? Number(m[0]) : 0; };
      let lodgingFromHotels = 0, hotelNightsCovered = 0, anyChosenPrice = false; const lodgingParts = [];
      trip.stops.forEach(st => {
        // up to 2 hotels can be chosen per stop — sum both toward lodging,
        // but count the stop's nights as covered only once
        const chosenOpts = ((st.accom && st.accom.options) || []).filter(o => o.chosen);
        const amt = chosenOpts.reduce((s, o) => s + parseAmt(o.totalPrice), 0);
        if (amt > 0) { anyChosenPrice = true; lodgingFromHotels += amt; hotelNightsCovered += Number(st.nights) || 0; lodgingParts.push(`${st.city} $${Math.round(amt)}`); }
      });
      const nightsUncovered = Math.max(0, nights - hotelNightsCovered);
      const lodgingTotal = lodgingFromHotels;
      const lodgingDetail = anyChosenPrice ? ('from chosen hotels · ' + lodgingParts.join(' · ') + (nightsUncovered > 0 ? ' · ' + nightsUncovered + 'n not yet chosen' : '')) : 'choose hotels in the stop cards to populate';
      const foodTotal = (Number(bud.foodPerDayPP) || 0) * nights * travelers;
      let loggedActivities = 0;
      trip.stops.forEach(s => (Array.isArray(s.itinerary) ? s.itinerary : []).forEach(day => (day && Array.isArray(day.items) ? day.items : []).forEach(it => { const v = parseFloat(String(it.cost == null ? '' : it.cost).replace(/[^0-9.]/g, '')); if (!isNaN(v)) loggedActivities += v; })));
      const otherTotal = Number(bud.otherTotal) || 0;
      const grandTotal = flightCost + intercityCost + cityPassTotal + lodgingTotal + foodTotal + loggedActivities + otherTotal;
      const perPerson = travelers > 0 ? Math.round(grandTotal / travelers) : grandTotal;
      const lines = [
        { label: 'Flights', mult: 'from route legs (excl. Flying Blue)', total: money(flightCost) },
        { label: 'Intercity transport', mult: 'trains & buses from route legs', total: money(intercityCost) },
        { label: 'City public transport', mult: cityPassDetail || 'city pass × nights × travelers', total: money(cityPassTotal), override: money(cityPassTotal), isOverride: true },
        { label: 'Lodging', mult: lodgingDetail, total: money(lodgingTotal) },
        { label: 'Food', key: 'foodPerDayPP', unit: '$/day/pp', mult: '× ' + nights + ' × ' + travelers, value: bud.foodPerDayPP, total: money(foodTotal) },
        { label: 'Activities', mult: loggedActivities > 0 ? 'linked from daily plan costs' : 'add costs in the daily plan to populate', total: money(loggedActivities) },
        { label: 'Other / buffer', key: 'otherTotal', unit: '$ total', mult: 'one-off', value: bud.otherTotal, total: money(otherTotal) }
      ];
      return { grandTotal, perPerson, lines };
    }

    /* ============================================================
       RENDER
       ============================================================ */
    render() {
      const trip = this.currentTrip();
      const meta = this.data.meta;
      const travelers = Math.max(1, Number(trip.travelers) || 1);
      const d = this.computeDates(trip);
      const fmt = (x) => this.formatDate(x);
      const nights = trip.stops.reduce((s, st) => s + (Number(st.nights) || 0), 0);
      const legs = [trip.outboundLeg, ...trip.stops.map(s => s.leg)];
      // reward points now live on the flight leg itself (grouped with cost),
      // not a separate "flying-blue" mode
      const milesNeeded = legs.reduce((s, l) => s + (l.mode === 'flight' ? (Number(l.miles) || 0) : 0), 0) * travelers;
      const budget = this.computeBudget(trip, travelers, nights);

      const web = this._webMag();
      if (web) {
        // ledger leaves are always open: their stop selections must stay valid
        const n = trip.stops.length;
        if (n) {
          if (this.openStopIdx == null || this.openStopIdx >= n) { this.openStopIdx = 0; this.activeDay = null; }
          if (this.accomOpenIdx == null || this.accomOpenIdx >= n) this.accomOpenIdx = 0;
        } else { this.openStopIdx = null; this.accomOpenIdx = null; }
        this.magIdx = Math.max(0, Math.min(3, this.magIdx || 0));
      } else {
        // app (phone) twin: the sub-pages reuse openStopIdx/accomOpenIdx/
        // transportOpenIdx, all mirrored off the shared appStopIdx so switching
        // pages keeps the same city selected.
        const n = trip.stops.length;
        if (n) {
          this.appStopIdx = Math.max(0, Math.min(n - 1, this.appStopIdx || 0));
          this.openStopIdx = this.accomOpenIdx = this.transportOpenIdx = this.appStopIdx;
        } else {
          this.appPage = 0;
          this.openStopIdx = this.accomOpenIdx = this.transportOpenIdx = null;
        }
        this.appPage = Math.max(0, Math.min(3, this.appPage || 0));
      }

      const html = web
        ? this.renderLedger(trip, meta, travelers, d, fmt, nights, budget, milesNeeded)
        : this.renderAppBook(trip, meta, travelers, d, fmt, nights, budget, milesNeeded);
      this.root.innerHTML = html;
      this.modalEl.innerHTML = web
        ? this.renderStickerPanel() +                          // leaves carry itinerary/accom/transport
          this.renderBudgetModal(budget, travelers, nights) +  // the bill prints over the panel area
          this.renderSyncModal()
        : this.renderStickerPanel() +                          // app leaves carry itinerary/accom/transport
          this.renderBudgetModal(budget, travelers, nights) +
          this.renderSyncModal();

      // re-attach persistent aside map node
      const holder = this.root.querySelector('#map-holder');
      if (holder) { holder.appendChild(this.mapEl); if (this.leafletMap) this.leafletMap.invalidateSize(); }
      // re-attach persistent main map nodes (survive re-renders)
      const mainHolder = this.root.querySelector('#main-map-holder');
      if (mainHolder) {
        mainHolder.appendChild(this.mainMapEl);
        mainHolder.appendChild(this.mainPinsOverlayEl);
        mainHolder.appendChild(this.mainCityLabelsEl);
        mainHolder.appendChild(this.mainLeadersEl);
        mainHolder.appendChild(this.mainCardsOverlayEl);
        this.ensureMainMap(0);
        // Invalidate + render after layout (shared debounced timer, so a
        // following touchMap() in the same bump() doesn't double-render)
        this._scheduleMainMap(50);
      }
      // re-attach the per-day itinerary map (it lives inside the modal root)
      this.mountDayMap();
      this._watchPackSheet();   // (re)observe the packing sheet for its open animation
      this.paintSaved();
      this.updateTopActions();
      this._animateStats();     // count-up the summary figures when they change
    }

    // Tween the summary figures (nights / total / miles) from their previous
    // value to the new one whenever they change — reuses the rAF easing style.
    _animateStats() {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      if (!this._statPrev) this._statPrev = {};
      const easeOut = (t) => 1 - Math.pow(1 - t, 3);
      const fmt = (v, kind) => kind === 'money' ? money(v)
        : kind === 'comma' ? Math.round(v).toLocaleString()
        : String(Math.round(v));
      this.root.querySelectorAll('.summary .fig[data-fig-key]').forEach(el => {
        const key = el.dataset.figKey;
        const target = Number(el.dataset.count) || 0;
        const prev = this._statPrev[key];
        this._statPrev[key] = target;
        const from = prev === undefined ? 0 : prev;
        if (from === target) return;                 // no change → leave as-is
        const t0 = performance.now(), D = 1000;
        el.textContent = fmt(from, el.dataset.fmt);
        const stepA = (now) => {
          const k = Math.min(1, (now - t0) / D);
          el.textContent = fmt(from + (target - from) * easeOut(k), el.dataset.fmt);
          if (k < 1) requestAnimationFrame(stepA);
          else el.textContent = fmt(target, el.dataset.fmt);
        };
        requestAnimationFrame(stepA);
      });
    }

    // Staggered entrance for a freshly-opened page/leaf. Sets an incrementing
    // --enter-i on each block so CSS can cascade the rise (works regardless of
    // DOM shape). Fires only from real navigation, not on every bump.
    _playEnter(container) {
      if (!container || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const targets = container.querySelectorAll(
        '.leaf-head, .summary .stat, .opt, .item, .todo, .app-card, .meta-range, .map, .todos, .add-option, .add-todo');
      if (!targets.length) return;
      targets.forEach((el, i) => el.style.setProperty('--enter-i', i));
      container.classList.add('leaf-entering');
      clearTimeout(this._enterT);
      this._enterT = setTimeout(() => {
        container.classList.remove('leaf-entering');
        targets.forEach(el => el.style.removeProperty('--enter-i'));
      }, 1300);
    }

    /* ============================================================
       WEB LEDGER (≥701px) — the planner as a stack of full-width
       leaves. Scrolling down slides the next leaf up from below —
       the same continuous motion as the intro→trip scroll — and
       divider tabs on the right edge deep-link to any page.
       Page 1 route map + stats/receipt/to-dos column ·
       page 2 transport & hotels · page 3 itinerary. Same state and
       handlers as the app — only the composition differs.
       ============================================================ */
    renderLedger(trip, meta, travelers, d, fmt, nights, budget, milesNeeded) {
      const page = this.magIdx;
      const state = (i) => i === page ? ' active' : (i < page ? ' past' : ' incoming');
      const stopPills = (act, sel) => trip.stops.map((s, i) =>
        `<button class="leaf-pill${i === sel ? ' on' : ''}" data-act="${act}" data-i="${i}">${esc(s.city || 'Stop ' + (i + 1))}</button>`).join('');
      const nightsLbl = (st) => { const n = Math.max(1, Number(st.nights) || 1); return `${n} night${n === 1 ? '' : 's'}`; };

      // ---- page 1 · the route: full-bleed map plate + the ledger column ----
      const routeLeaf = `
      <section class="ledger-leaf leaf-route${state(0)}" data-leaf="0">
        <div class="leaf-inner">
          <div class="route map-route ledger-map">
            <div id="main-map-holder" class="main-map-wrap"></div>
            <div class="map-ep map-origin">
              <input value="${escA(trip.originLabel)}" data-ch="origin-label" placeholder="Flying from">
              <span class="map-ep-date">${d ? fmt(d.origin) : ''}</span>
            </div>
            <div class="map-ep map-home">
              <input value="${escA(trip.homeLabel)}" data-ch="home-label" placeholder="Flying home to">
              <span class="map-ep-date">${d ? fmt(d.home) : ''}</span>
            </div>
            <button class="map-add-btn" data-act="add-stop" title="Add stop" aria-label="Add stop">+</button>
          </div>
          <aside class="ledger-col">
            ${this.renderMetaRange(trip)}
            ${this.renderSummary(nights, budget.grandTotal, budget.perPerson, milesNeeded, meta.milesBalance || 0, travelers)}
            <div class="stop-spot">${this.renderStopSpot(trip, d, fmt)}</div>
          </aside>
          <div class="placed-stickers-layer">${this.renderPlacedStickers()}</div>
        </div>
        <span class="leaf-folio">01 · 04</span>
      </section>`;

      // ---- page 2 · itinerary (calendar + closet | day planner + day map) ----
      const iIdx = this.openStopIdx;
      const iStop = iIdx != null ? trip.stops[iIdx] : null;
      const iRange = (iStop && d) ? d.stops[iIdx] : null;
      const iNights = iStop ? Math.max(1, Number(iStop.nights) || 1) : 0;
      const hasDay = !!iStop && this.activeDay != null && this.activeDay >= 0 && this.activeDay < iNights;
      const daysLeaf = `
      <section class="ledger-leaf leaf-days${state(1)}" data-leaf="1">
        <div class="leaf-inner">
          <header class="leaf-head">
            <div class="leaf-head-main">
              <div class="eyebrow">Itinerary</div>
              <div class="leaf-title">${iStop ? esc(iStop.city || 'Stop') : 'No stops yet'}</div>
              <div class="leaf-sub">${iRange ? esc(fmt(iRange.start) + ' → ' + fmt(iRange.end)) + ' · ' : ''}${iStop ? nightsLbl(iStop) : ''}</div>
            </div>
            <div class="leaf-pills">${stopPills('ledger-stop-days', iIdx)}</div>
          </header>
          ${iStop ? this.renderItineraryBody(trip, d, fmt) : `
          <p class="empty-note" style="margin:18px 4px">Add a stop on the route page first.</p>`}
          ${hasDay ? `<div class="placed-stickers-layer">${this.renderPlacedStickers('iti-' + iIdx + '-day-' + this.activeDay)}</div>` : ''}
        </div>
        <span class="leaf-folio">02 · 04</span>
      </section>`;

      // ---- page 3 · transport & hotels share the leaf, one stop at a time ----
      const pIdx = this.accomOpenIdx;
      const pStop = pIdx != null ? trip.stops[pIdx] : null;
      const pRange = (pStop && d) ? d.stops[pIdx] : null;
      const planLeaf = `
      <section class="ledger-leaf leaf-plan${state(2)}" data-leaf="2">
        <div class="leaf-inner">
          <header class="leaf-head">
            <div class="leaf-head-main">
              <div class="eyebrow">Transport &amp; Hotels</div>
              <div class="leaf-title">${pStop ? esc(pStop.city || 'Stop') : 'No stops yet'}</div>
              <div class="leaf-sub">${pRange ? esc(fmt(pRange.start) + ' → ' + fmt(pRange.end)) + ' · ' : ''}${pStop ? nightsLbl(pStop) : ''}</div>
            </div>
            <div class="leaf-pills">${stopPills('ledger-stop-plan', pIdx)}</div>
          </header>
          ${pStop ? `
          <div class="leaf-plan-cols">
            <div class="plan-col plan-transport">
              <div class="plan-col-hd">Getting there</div>
              ${this.renderTransportBody(trip, pIdx)}
            </div>
            <div class="plan-col plan-hotels">
              <div class="plan-col-hd">Sleeping</div>
              ${this.renderAccomBody(trip, pIdx)}
            </div>
          </div>
          <div class="placed-stickers-layer">${this.renderPlacedStickers('accom-' + pIdx)}</div>` : `
          <p class="empty-note" style="margin:18px 4px">Add a stop on the route page first.</p>`}
        </div>
        <span class="leaf-folio">03 · 04</span>
      </section>`;

      // ---- page 4 · packing blueprint + the pre-trip to-do list ----
      const pkTotals = PACK_SLOTS.reduce((a, s) => {
        const L = (trip.packing || {})[s.k] || [];
        a.d += L.filter(x => x.done).length; a.t += L.length; return a;
      }, { d: 0, t: 0 });
      const packLeaf = `
      <section class="ledger-leaf leaf-pack${state(3)}" data-leaf="3">
        <div class="leaf-inner">
          <header class="leaf-head">
            <div class="leaf-head-main">
              <div class="eyebrow">Packing &amp; To-do</div>
              <div class="leaf-title">The Suitcase</div>
              <div class="leaf-sub">${pkTotals.t ? pkTotals.d + ' of ' + pkTotals.t + ' packed' : 'Hover an object to start its list'}</div>
            </div>
          </header>
          <div class="pack-cols">
            <div class="pk-main">
              <div class="pk-wrap">${this.renderPackBody(trip)}</div>
              <aside class="pk-panel">${this.renderPackPanel(trip)}</aside>
            </div>
            <aside class="pack-side">${this.renderTodos(meta)}</aside>
          </div>
        </div>
        <span class="leaf-folio">04 · 04</span>
      </section>`;

      // the Route tab reads as a house glyph (matches the design's line-icon
      // set, currentColor so it inherits the tab's ink/on-brown state); the
      // others stay as vertical wordmarks
      const tabDefs = [
        { label: 'Route', icon: true }, { label: 'Itinerary' }, { label: 'Transport & Hotels' }, { label: 'Packing' },
      ];
      const tabs = tabDefs.map((t, i) =>
        `<button class="ledger-tab${t.icon ? ' ledger-tab--icon' : ''}${i === page ? ' on' : ''}" data-act="ledger-goto" data-i="${i}" aria-label="${esc(t.label)}" title="${esc(t.label)}">${t.icon ? svg(I.home, { w: 18, h: 18, sw: 1.8 }) : esc(t.label)}</button>`).join('');
      return `
      <div class="ledger-stage">
        <div class="ledger-book${this.budgetOpen ? ' bill-open' : ''}" data-page="${page}">
          ${routeLeaf}${daysLeaf}${planLeaf}${packLeaf}
          <button class="ledger-edge prev" data-act="ledger-prev" title="Previous page" aria-label="Previous page">‹</button>
          <button class="ledger-edge next" data-act="ledger-next" title="Next page" aria-label="Next page">›</button>
          <nav class="ledger-tabs" aria-label="Pages">${tabs}</nav>
        </div>
      </div>`;
    }

    // switch to page i — the leaves crossfade via the .active class transition
    // (class toggling on live DOM; ordinary re-renders don't animate)
    magGoto(i) {
      if (!this._webMag()) return;
      i = Math.max(0, Math.min(3, i));
      if (i === this.magIdx || this._magAnimating) return;
      this.magIdx = i;
      this._magAnimating = true;   // brief lock so a wheel gesture turns one page, not three
      clearTimeout(this._flipEndT);
      this._flipEndT = setTimeout(() => { this._magAnimating = false; }, 640);   // covers the .62s leaf slide
      this._syncLeafClasses();
      this._afterFlip();
      const active = this.root.querySelector('.ledger-leaf.active');
      this._playEnter(active && (active.querySelector('.leaf-inner') || active));
    }
    _syncLeafClasses() {
      const book = this.root.querySelector('.ledger-book'); if (!book) return;
      book.dataset.page = String(this.magIdx);
      book.querySelectorAll('.ledger-leaf').forEach(el => {
        const i = Number(el.dataset.leaf);
        el.classList.toggle('active', i === this.magIdx);
        el.classList.toggle('past', i < this.magIdx);
        el.classList.toggle('incoming', i > this.magIdx);
      });
      book.querySelectorAll('.ledger-tab').forEach(el => el.classList.toggle('on', Number(el.dataset.i) === this.magIdx));
    }
    // hidden leaves keep their layout (visibility, not display), but Leaflet
    // still wants a nudge when its leaf comes back
    _afterFlip() {
      if (this.magIdx === 0 && this.mainLeafletMap) { this.mainLeafletMap.invalidateSize(); this.renderMainMap(); }
      if (this.magIdx === 1 && this.dayMap) { this.dayMap.invalidateSize(); this.scheduleDayMap(); }
    }

    /* ============================================================
       APP BOOK (≤700px) — the phone twin of the web ledger. The
       overview page carries the map, the prose date range, the stats
       and entry cards; tapping a card rises the matching sub-page
       (Itinerary / Hotel / Transport) up from below, with a tab bar
       pinned on top to switch. Same state/handlers as the ledger —
       only the composition (tabs on top, entry cards) differs.
       ============================================================ */
    renderAppBook(trip, meta, travelers, d, fmt, nights, budget, milesNeeded) {
      const page = this.appPage;
      const nightsLbl = (st) => { const n = Math.max(1, Number(st.nights) || 1); return `${n} night${n === 1 ? '' : 's'}`; };
      const sIdx = this.appStopIdx;
      const sel = trip.stops[sIdx] || null;
      const range = (sel && d) ? d.stops[sIdx] : null;
      const stopPills = () => trip.stops.map((s, i) =>
        `<button class="app-pill${i === sIdx ? ' on' : ''}" data-act="app-stop" data-i="${i}">${esc(s.city || 'Stop ' + (i + 1))}</button>`).join('');
      const subHd = (eyebrow) => `<header class="app-page-hd">
          <div class="app-page-title">${sel ? esc(sel.city || 'Stop') : 'No stops yet'}</div>
          <div class="app-page-sub">${range ? esc(fmt(range.start) + ' → ' + fmt(range.end)) + ' · ' : ''}${sel ? nightsLbl(sel) : ''}</div>
          ${trip.stops.length ? `<div class="app-pills">${stopPills()}</div>` : ''}
        </header>`;
      const emptyNote = `<p class="empty-note" style="margin:18px 4px">Add a stop on the overview first.</p>`;

      // ---- overview (page 0) · stays in normal document flow; the map, prose
      //      date range (between map and stats), stats, entry cards, packing
      //      and to-dos. The sub-pages below rise up over it as fixed overlays. ----
      const overview = `
      <div class="app-ov">
        <div class="page" style="position:relative">
          ${this.renderMetaRange(trip)}
          <div class="route map-route">
            <div id="main-map-holder" class="main-map-wrap"></div>
            <div class="map-ep map-origin">
              <input value="${escA(trip.originLabel)}" data-ch="origin-label" placeholder="Flying from">
              <span class="map-ep-date">${d ? fmt(d.origin) : ''}</span>
            </div>
            <div class="map-ep map-home">
              <input value="${escA(trip.homeLabel)}" data-ch="home-label" placeholder="Flying home to">
              <span class="map-ep-date">${d ? fmt(d.home) : ''}</span>
            </div>
            <button class="map-add-btn" data-act="add-stop" title="Add stop" aria-label="Add stop">+</button>
          </div>
          <div class="app-cards">
            <button class="app-card" data-act="app-goto" data-i="1">${svg(I.calendar, { w: 20, h: 20, sw: 1.8 })}<span>Itinerary</span></button>
            <button class="app-card" data-act="app-goto" data-i="2">${svg(I.bed, { w: 20, h: 20, sw: 1.8 })}<span>Hotel</span></button>
            <button class="app-card" data-act="app-goto" data-i="3">${svg(I.route, { w: 20, h: 20, sw: 1.8 })}<span>Transport</span></button>
          </div>
          <aside class="aside">
            ${this.renderSummary(nights, budget.grandTotal, budget.perPerson, milesNeeded, meta.milesBalance || 0, travelers)}
            ${this.renderPackBlock(trip)}
            ${this.renderTodos(meta)}
          </aside>
          <div class="placed-stickers-layer">${this.renderPlacedStickers()}</div>
        </div>
      </div>`;

      // ---- page 1 · itinerary (calendar + day planner + day map) ----
      const iNights = sel ? Math.max(1, Number(sel.nights) || 1) : 0;
      const hasDay = !!sel && this.activeDay != null && this.activeDay >= 0 && this.activeDay < iNights;
      const itiLeaf = `
      <section class="app-leaf${page === 1 ? ' active' : ''}" data-leaf="1">
        <div class="app-sub-inner">
          ${subHd('Itinerary')}
          ${sel ? this.renderItineraryBody(trip, d, fmt) : emptyNote}
          ${hasDay ? `<div class="placed-stickers-layer">${this.renderPlacedStickers('iti-' + sIdx + '-day-' + this.activeDay)}</div>` : ''}
        </div>
      </section>`;

      // ---- page 2 · hotel (lodging research for the selected stop) ----
      const hotelLeaf = `
      <section class="app-leaf${page === 2 ? ' active' : ''}" data-leaf="2">
        <div class="app-sub-inner">
          ${subHd('Sleeping')}
          ${sel ? this.renderAccomBody(trip, sIdx) : emptyNote}
          ${sel ? `<div class="placed-stickers-layer">${this.renderPlacedStickers('accom-' + sIdx)}</div>` : ''}
        </div>
      </section>`;

      // ---- page 3 · transport (the leg reaching the selected stop) ----
      const transportLeaf = `
      <section class="app-leaf${page === 3 ? ' active' : ''}" data-leaf="3">
        <div class="app-sub-inner">
          ${subHd('Getting there')}
          ${sel ? this.renderTransportBody(trip, sIdx) : emptyNote}
        </div>
      </section>`;

      const tabDefs = [
        { label: 'Overview', icon: I.home }, { label: 'Itinerary', icon: I.calendar },
        { label: 'Hotel', icon: I.bed }, { label: 'Transport', icon: I.route },
      ];
      const tabs = tabDefs.map((t, i) =>
        `<button class="app-tab${i === page ? ' on' : ''}" data-act="app-goto" data-i="${i}" aria-label="${esc(t.label)}" title="${esc(t.label)}">${svg(t.icon, { w: 17, h: 17, sw: 1.8 })}<span>${esc(t.label)}</span></button>`).join('');

      return `<div class="app-root" data-page="${page}">
        ${overview}
        <nav class="app-tabs" aria-label="Pages">${tabs}</nav>
        ${itiLeaf}${hotelLeaf}${transportLeaf}
      </div>`;
    }

    // switch app pages — the sub-pages rise/fall via the .active class
    // transition (class toggling on live DOM; plain re-renders don't animate
    // because the fresh markup already carries the right state class)
    appGoto(i) {
      if (this._webMag()) return;
      i = Math.max(0, Math.min(3, i));
      if (i === this.appPage || this._appAnimating) return;
      this.appPage = i;
      this._appAnimating = true;
      clearTimeout(this._appFlipEndT);
      this._appFlipEndT = setTimeout(() => { this._appAnimating = false; }, 520);
      this._syncAppLeafClasses();
      this._afterAppFlip();
      const active = i === 0
        ? this.root.querySelector('.app-ov')
        : this.root.querySelector('.app-leaf.active .app-sub-inner');
      this._playEnter(active);
    }
    _syncAppLeafClasses() {
      const rootEl = this.root.querySelector('.app-root'); if (!rootEl) return;
      rootEl.dataset.page = String(this.appPage);
      rootEl.querySelectorAll('.app-leaf').forEach(el =>
        el.classList.toggle('active', Number(el.dataset.leaf) === this.appPage));
      rootEl.querySelectorAll('.app-tab').forEach(el =>
        el.classList.toggle('on', Number(el.dataset.i) === this.appPage));
    }
    _afterAppFlip() {
      // the overview map lives in normal flow underneath and never unmounts;
      // only the itinerary's day map (inside the rising leaf) needs a nudge
      if (this.appPage === 1 && this.dayMap) { this.dayMap.invalidateSize(); this.scheduleDayMap(); }
    }
    // true when an ancestor of t is a real scroll region (overflow-y auto/
    // scroll) that can still move in the gesture's direction — that region
    // keeps the gesture instead of a page turn. Must ignore overflow:hidden/
    // clip wrappers: the off-screen leaves sit translated ±100%, which
    // inflates the stage's scrollHeight without making it scrollable.
    _scrollClaims(t, dy) {
      let el = t instanceof Element ? t : null;
      while (el && el !== document.body) {
        if (el.scrollHeight > el.clientHeight + 1 && /(auto|scroll|overlay)/.test(getComputedStyle(el).overflowY)) {
          const canDown = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
          const canUp = el.scrollTop > 1;
          if ((dy > 0 && canDown) || (dy < 0 && canUp)) return true;
        }
        el = el.parentElement;
      }
      return false;
    }
    initLedgerNav() {
      // wheel: turn a page when the gesture isn't claimed by the intro (pull
      // back to the cover), a floating panel, the maps (zoom/pan), or a
      // scrollable region that can still move in that direction
      document.addEventListener('wheel', (e) => {
        if (!this._webMag() || !this._introParked || this._magAnimating) return;
        if (e.defaultPrevented) return;
        const t = e.target;
        if (t && t.closest && t.closest('.overlay, .sticker-panel, .top-actions, .main-map-wrap, .leaflet-container, .daymap')) return;
        const dy = e.deltaY + e.deltaX;
        if (this._scrollClaims(t, dy)) return;
        const now = performance.now();
        if (now - this._wheelT > 480) this._wheelAcc = 0;   // a fresh gesture
        this._wheelT = now;
        this._wheelAcc += dy;
        if (Math.abs(this._wheelAcc) < 110) return;
        const dir = this._wheelAcc > 0 ? 1 : -1;
        this._wheelAcc = 0;
        if (dir < 0 && this.magIdx === 0) return;   // the intro driver owns "up from page 1"
        this.magGoto(this.magIdx + dir);
      }, { passive: true });
      // touch: a vertical swipe turns the page too (tablets) — same claim
      // rules as the wheel. The page-0 pull-back-to-cover swipe stays with
      // the intro driver, so only next-page and deeper-page-up act here.
      let swipeY = null, swipeX = null, swipeEl = null;
      document.addEventListener('touchstart', (e) => {
        swipeY = null;
        if (!this._webMag() || !this._introParked || this._magAnimating) return;
        const t = e.target;
        if (t && t.closest && t.closest('.overlay, .sticker-panel, .top-actions, .main-map-wrap, .leaflet-container, .daymap')) return;
        swipeY = e.touches[0].clientY; swipeX = e.touches[0].clientX; swipeEl = t instanceof Element ? t : null;
      }, { passive: true });
      document.addEventListener('touchend', (e) => {
        if (swipeY == null || this._magAnimating) { swipeY = null; return; }
        const dy = swipeY - e.changedTouches[0].clientY;   // >0 = finger up = next page
        const dx = swipeX - e.changedTouches[0].clientX;
        swipeY = null;
        if (Math.abs(dy) < 70 || Math.abs(dy) < Math.abs(dx) * 1.2) return;   // too short / mostly horizontal
        if (this._scrollClaims(swipeEl, dy)) return;       // a region that scrolls that way keeps the gesture
        const dir = dy > 0 ? 1 : -1;
        if (dir < 0 && this.magIdx === 0) return;          // intro driver owns the pull back to the cover
        this.magGoto(this.magIdx + dir);
      }, { passive: true });
      // pages now slide vertically (same motion as the intro→trip scroll), so
      // ↓/↑ turn them too; ←/→ kept for muscle memory. ↑ (or ←) on page 1
      // closes the notebook back to the cover — the intro driver claims that
      // key first when it applies (defaultPrevented), so don't double-handle.
      document.addEventListener('keydown', (e) => {
        if (!this._webMag() || !this._introParked || this._anyModalOpen()) return;
        if (e.defaultPrevented) return;
        const ae = document.activeElement;
        if (e.key === 'Escape' && this.packOpen != null) {   // clear the packing checklist panel, even mid-edit
          if (ae && ae.blur) ae.blur();
          this.packOpen = null; this._paintPackPanel(); return;
        }
        if (ae && (ae.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName))) return;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); this.magGoto(this.magIdx + 1); }
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
          e.preventDefault();
          if (this.magIdx > 0) this.magGoto(this.magIdx - 1);
          else if (this._introReturn) this._introReturn();
        }
      });
    }

    renderTabs() {
      const keys = this.tripKeys();
      const pills = keys.map(key => {
        const t = this.data.trips[key]; const lbl = t.label || '';
        const w = Math.max(8, Math.min(22, lbl.length + 1)) + 'ch';
        if (this.data.active === key) {
          return `<div class="tab-active" draggable="true" data-drag="trip" data-drop="trip" data-key="${escA(key)}" title="Drag to reorder">
            <input value="${escA(lbl)}" data-ch="tab-rename" data-key="${escA(key)}" style="width:${w}">
            ${keys.length > 1 ? `<button class="tab-x" data-act="tab-remove" data-key="${escA(key)}" title="Remove this trip" aria-label="Remove trip">−</button>` : ''}
            <span style="width:10px"></span>
          </div>`;
        }
        return `<button class="tab-inactive" draggable="true" data-drag="trip" data-drop="trip" data-act="tab-select" data-key="${escA(key)}" title="Drag to reorder · click to open">${esc(lbl)}</button>`;
      }).join('');
      // "+" first (in front of every tab), then the tab pill; the row scrolls
      // left/right (never wraps) so trips added to the end overflow to the right.
      return `<button class="add-trip" data-act="add-trip" title="Add a trip" aria-label="Add a trip">+</button><div class="tabs">${pills}</div>`;
    }

    renderMeta(trip, travelers) {
      return `<div class="meta-row">
        <div class="meta-field"><label>Depart</label><input type="date" value="${escA(trip.depart)}" data-ch="depart"></div>
        <div class="meta-field"><label>Return</label><input type="date" value="${escA(trip.returnDate)}" data-ch="return"></div>
        <span class="saved" style="opacity:0">saved</span>
      </div>`;
    }
    // Web ledger: the date range shown as prose — "September 14 – September 30,
    // 2026" in darker green, no box or labels. Each date opens the native date
    // picker (an invisible <input type=date> the click drives via showPicker).
    renderMetaRange(trip) {
      const parse = s => { const dt = new Date((s || '') + 'T00:00:00'); return isNaN(dt.getTime()) ? null : dt; };
      const dep = parse(trip.depart), ret = parse(trip.returnDate);
      const md = dt => dt ? dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Add date';
      const sameYear = dep && ret && dep.getFullYear() === ret.getFullYear();
      const withYear = (dt, base) => (dep && ret && !sameYear && dt) ? `${base}, ${dt.getFullYear()}` : base;
      const depTxt = withYear(dep, md(dep)), retTxt = withYear(ret, md(ret));
      const yearTxt = sameYear ? `, ${dep.getFullYear()}` : (dep && !ret ? `, ${dep.getFullYear()}` : (ret && !dep ? `, ${ret.getFullYear()}` : ''));
      const seg = (which, txt, val) => `<span class="date-seg" data-act="pick-date" data-for="${which}" role="button" tabindex="0" title="Choose date">
        <span class="date-txt">${esc(txt)}</span>
        <input type="date" class="date-native" data-ch="${which}" value="${escA(val)}" tabindex="-1" aria-label="${which === 'depart' ? 'Depart date' : 'Return date'}">
      </span>`;
      return `<div class="meta-range">
        ${seg('depart', depTxt, trip.depart)}<span class="date-dash">–</span><span class="date-tail">${seg('return', retTxt, trip.returnDate)}<span class="date-year">${esc(yearTxt)}</span></span>
        <span class="saved" style="opacity:0">saved</span>
      </div>`;
    }
    travelersPip(travelers) {
      return `<div class="travelers-pip">
        ${Array.from({ length: travelers }, () => `<button class="traveler-icon" data-act="traveler-dec" title="Remove traveler"><svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="7" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg></button>`).join('')}
        <button class="traveler-add" data-act="traveler-inc" title="Add traveler">+</button>
      </div>`;
    }

    renderRoute(trip, d, fmt) {
      const stops = trip.stops;
      const legs = [trip.outboundLeg, ...stops.map(s => s.leg)];

      // ---- normalize city name for CITY_MAP lookup ----
      const getPos = city => {
        if (!city || !city.trim()) return null;
        const k = normKey(city).replace(/[\s\-']/g, '');
        return CITY_MAP[k] || null;
      };
      const fallback = i => [160 + i * 160, 160 + (i % 2) * 90];
      const positions = stops.map((s, i) => getPos(s.city) || fallback(i));

      // ---- bezier route path through stop positions ----
      const routeD = positions.length < 1 ? '' : positions.reduce((acc, [cx, cy], i) => {
        if (i === 0) return `M ${cx} ${cy}`;
        const [px, py] = positions[i - 1];
        const mx = (px + cx) / 2, my = Math.min(py, cy) - 26;
        return acc + ` Q ${mx} ${my} ${cx} ${cy}`;
      }, '');

      const legFields = (leg, legIdx) => this._legFields(leg, legIdx);

      // ---- SVG: leaders + pin circles (text rendered as HTML overlay below) ----
      const CARD_W_SVG = 148, CARD_H_SVG = 83; /* 20% of 740 = 148; height = 148 × 118/210 ≈ 83 */
      let leadersSvg = '', dotsSvg = '';
      stops.forEach((stop, i) => {
        const [sx, sy] = positions[i];
        const right = i % 2 === 0;
        // card center in SVG coords for leader endpoint
        let ccx, ccy;
        if (stop.cardPos) {
          ccx = stop.cardPos.x / 100 * 740 + CARD_W_SVG / 2;
          ccy = stop.cardPos.y / 100 * 480 + CARD_H_SVG / 2;
        } else {
          const rawX = right ? sx + 54 : sx - 54 - CARD_W_SVG;
          const rawY = sy - 58;
          ccx = Math.max(1, Math.min(591, rawX)) + CARD_W_SVG / 2;
          ccy = Math.max(1, Math.min(396, rawY)) + CARD_H_SVG / 2;
        }
        leadersSvg += `<line class="mini-leader" x1="${sx}" y1="${sy}" x2="${ccx.toFixed(1)}" y2="${ccy.toFixed(1)}" stroke="oklch(40% 0.012 70)" stroke-width="0.9" stroke-dasharray="5 4" opacity="0.28"/>`;
        dotsSvg += `<circle class="mini-dot" cx="${sx}" cy="${sy}" r="11" style="fill:var(--red)" stroke="oklch(97% 0.005 60)" stroke-width="2"/>`;
      });

      const bgSvg = `<svg class="map-bg" viewBox="0 0 740 480" xmlns="http://www.w3.org/2000/svg">
        <rect class="mini-sea" width="740" height="480" fill="oklch(95.5% 0.004 70)"/>
        <!-- Continental Europe + Iberia -->
        <path class="mini-land" fill="oklch(91% 0.008 70)" stroke="oklch(75% 0.01 70)" stroke-width="0.7" d="
          M 210 223 L 165 236 L 97 267 L 100 295 L 144 369
          L 59 362 L 34 381 L 18 418 L 6 456 L 30 480
          L 160 480 L 200 476 L 215 413 L 270 374 L 320 316
          L 310 340 L 290 360 L 270 390 L 262 424 L 278 456 L 305 480
          L 360 480 L 420 450 L 432 424 L 420 395 L 410 368 L 420 344
          L 395 328 L 422 325 L 460 368 L 514 400 L 574 428 L 635 424 L 688 420
          L 720 400 L 740 360 L 740 0 L 688 0
          L 650 40 L 612 53 L 530 120 L 400 154 L 338 82 L 322 107 L 335 137
          L 300 152 L 255 190 Z"/>
        <!-- Scandinavian Peninsula -->
        <path class="mini-land" fill="oklch(91% 0.008 70)" stroke="oklch(75% 0.01 70)" stroke-width="0.7" d="
          M 338 82 L 302 80 L 270 32 L 266 0 L 476 0 L 495 54 L 450 116 L 404 128 L 370 87 Z"/>
        <!-- Great Britain -->
        <path class="mini-land" fill="oklch(91% 0.008 70)" stroke="oklch(75% 0.01 70)" stroke-width="0.7" d="
          M 88 70 C 110 66 158 95 202 215 C 188 229 170 232 76 240
          C 82 202 90 148 80 130 C 72 108 70 82 88 70 Z"/>
        <!-- Ireland -->
        <path class="mini-land" fill="oklch(91% 0.008 70)" stroke="oklch(75% 0.01 70)" stroke-width="0.7" d="
          M 52 130 L 70 134 L 65 192 L 31 208 L 4 213 L 2 150 Z"/>
        ${routeD ? `<path class="mini-route" d="${routeD}" fill="none" stroke="oklch(22% 0.025 70)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
        ${leadersSvg}${dotsSvg}
      </svg>`;

      // ---- stop cards + HTML pin overlays (absolutely positioned) ----
      let cardsHtml = '', pinsHtml = '';
      stops.forEach((stop, idx) => {
        const [sx, sy] = positions[idx];
        const right = idx % 2 === 0;
        const dim = this._dragStopIdx === idx ? .38 : 1;
        const r = d ? d.stops[idx] : null;
        const chosenNames = (stop.accom && stop.accom.options || []).filter(o => o.chosen && o.name && o.name.trim()).map(o => o.name.trim());
        const accomSet = chosenNames.length > 0;

        // Card position as % of canvas
        let cx, cy;
        if (stop.cardPos) {
          cx = stop.cardPos.x.toFixed(2);
          cy = stop.cardPos.y.toFixed(2);
        } else {
          const rawX = right ? sx + 54 : sx - 54 - CARD_W_SVG;
          const rawY = sy - 58;
          cx = (Math.max(1, Math.min(591, rawX)) / 740 * 100).toFixed(2);
          cy = (Math.max(1, Math.min(396, rawY)) / 480 * 100).toFixed(2);
        }

        const modeColor = MODE_HEX[(legs[idx] || {}).mode] || '#7a7260';
        cardsHtml += `<div class="stop map-stop" data-i="${idx}" style="left:${cx}%;top:${cy}%;opacity:${dim}">
          <div class="card mc-flip">
            <!-- FRONT: city · dates · hotel -->
            <div class="mc-front">
              <span class="mc-mode-pip" style="background:${modeColor}"></span>
              <div class="mc-city-display">${stop.city ? esc(stop.city) : '<span style="opacity:.3">City?</span>'}</div>
              <div class="mc-meta">
                ${r ? `<div class="mc-dates-display">${esc(fmt(r.start))} – ${esc(fmt(r.end))}</div>` : (stop.nights ? `<div class="mc-dates-display">${stop.nights} nights</div>` : '')}
                ${accomSet ? `<div class="mc-hotel-display">${chosenNames.map(n => esc(n)).join(' · ')}</div>` : ''}
              </div>
            </div>
            <!-- BACK: all controls -->
            <div class="mc-back">
              <div class="head">
                <input class="city" value="${escA(stop.city)}" data-ch="stop-city" data-i="${idx}" placeholder="City">
                <button class="iti-btn" data-act="stop-accom" data-i="${idx}" title="Accommodation" aria-label="Accommodation">${svg(I.bed)}</button>
                <button class="iti-btn" data-act="stop-iti" data-i="${idx}" title="Itinerary" aria-label="Open itinerary">${svg(I.calendar)}</button>
                <div class="nights"><input type="number" value="${escA(stop.nights)}" data-ch="stop-nights" data-i="${idx}"><span>nts</span></div>
              </div>
              ${legFields(legs[idx], idx)}
              <div class="foot">
                <div class="grip" data-map-drag="${idx}" title="Drag card on map"><svg width="9" height="9" viewBox="0 0 7 7" fill="currentColor" aria-hidden="true"><circle cx="1.4" cy="1.4" r="1.1"/><circle cx="5.6" cy="1.4" r="1.1"/><circle cx="1.4" cy="5.6" r="1.1"/><circle cx="5.6" cy="5.6" r="1.1"/></svg></div>
                <button class="trash" data-act="stop-delete" data-i="${idx}" title="Remove stop" aria-label="Remove stop">${svg(I.trash, { w: 14, h: 14, sw: 2.4 })}</button>
              </div>
            </div>
          </div>
        </div>`;

        // HTML pin overlay: editable number sits on top of the SVG circle
        const pLeft = (sx / 740 * 100).toFixed(2);
        const pTop = (sy / 480 * 100).toFixed(2);
        pinsHtml += `<div class="map-pin-num" style="left:${pLeft}%;top:${pTop}%">
          <input type="number" class="pin-order-input" value="${idx + 1}" min="1" max="${stops.length}" data-ch="stop-order" data-i="${idx}" title="Tap to change stop order">
        </div>`;
      });

      // ---- hidden field: last departing leg (keeps data binding alive) ----
      const hiddenLeg = stops.length > 0
        ? `<div style="display:none">${legFields(legs[stops.length], stops.length)}</div>`
        : '';

      // ---- origin & home endpoint labels (floating corners of the map) ----
      const originEl = `<div class="map-ep map-origin">
        <input value="${escA(trip.originLabel)}" data-ch="origin-label" placeholder="Flying from">
        <span class="map-ep-date">${d ? fmt(d.origin) : ''}</span>
      </div>`;
      const homeEl = `<div class="map-ep map-home">
        <input value="${escA(trip.homeLabel)}" data-ch="home-label" placeholder="Flying home to">
        <span class="map-ep-date">${d ? fmt(d.home) : ''}</span>
      </div>`;

      return `<div class="map-canvas">
        ${bgSvg}
        ${hiddenLeg}
        ${originEl}${cardsHtml}
        ${pinsHtml}
      </div>
      ${homeEl}`;
    }

    renderSummary(nights, grand, perPerson, miles, balance, travelers) {
      const covered = miles > 0 && balance >= miles;
      return `<div class="summary">
        <div class="stat stat-split">
          <div class="stat-half"><div class="fig" data-fig-key="nights" data-count="${nights}" data-fmt="int">${nights}</div><div class="cap">night${nights === 1 ? '' : 's'}</div></div>
          <div class="stat-half stat-travelers">${this.travelersPip(travelers)}</div>
        </div>
        ${SHOW_COSTS ? `<div class="stat cash clickable" data-act="open-budget" title="See budget breakdown">
          <div class="fig" data-fig-key="cash" data-count="${grand}" data-fmt="money">${esc(money(grand))}</div><div class="cap">total · ${esc(money(perPerson))} / person</div></div>
        <div class="stat miles${covered ? ' covered' : ''}"><div class="fig" data-fig-key="miles" data-count="${miles}" data-fmt="comma">${miles.toLocaleString()}</div><div class="cap">reward points needed</div></div>` : ''}
      </div>`;
    }

    renderTodos(meta) {
      const todos = meta.todos || [];
      const done = todos.filter(t => t.done).length;
      const rows = todos.map((t, i) => `<div class="todo">
        <button class="box${t.done ? ' done' : ''}" data-act="todo-toggle" data-i="${i}" aria-label="Toggle task">${t.done ? svg(I.check, { w: 11, h: 11, sw: 3.5 }) : ''}</button>
        <input class="txt${t.done ? ' done' : ''}" value="${escA(t.text)}" data-ch="todo-text" data-i="${i}" placeholder="New task…">
        <button class="x" data-act="todo-remove" data-i="${i}" aria-label="Remove task">✕</button>
      </div>`).join('');
      return `<div class="todos">
        <div class="hd"><div class="t">Pre-trip to-do</div><div class="p">${done} / ${todos.length}</div></div>
        <div>${rows}</div>
        <button class="add-todo" data-act="add-todo" title="Add task" aria-label="Add task">+</button>
      </div>`;
    }

    /* ---------- stop preview card (web route page) — fills the column slot
       where the to-do list used to live. Hovering a map pin previews that
       stop; "+" (add stop) opens a fresh card here to type the city into.
       Dates + nights are read-only, fed from the same computed ranges the
       itinerary page shows — nights aren't edited here. ---------- */
    renderStopSpot(trip, d, fmt) {
      const idx = this.stopInfoIdx;
      const stop = idx != null ? trip.stops[idx] : null;
      // nothing selected → list every stop with a numbered marker (edit the
      // number to reorder) + name + ✕ to delete; an unnamed stop shows a blank
      // line. Tapping a pin swaps this for that stop's detail card below.
      if (!stop) {
        const stops = trip.stops;
        if (!stops.length) return `<div class="ss-hint">No stops yet — hit <b>+</b> on the map to add one.</div>`;
        const rows = stops.map((s, i) => {
          const named = s.city && s.city.trim();
          return `<li class="ss-li">
            <input type="number" class="ss-num-input" value="${i + 1}" min="1" max="${stops.length}" data-ch="stop-order" data-i="${i}" title="Change the number to reorder" aria-label="Stop number — change to reorder">
            <button class="ss-li-name${named ? '' : ' empty'}" data-act="stop-select" data-i="${i}" title="${named ? escA(s.city) : 'Unnamed stop'}">${named ? esc(s.city) : ''}</button>
            <button class="ss-x" data-act="stop-delete" data-i="${i}" title="Remove stop" aria-label="Remove stop">✕</button>
          </li>`;
        }).join('');
        return `<ul class="ss-list">${rows}</ul>`;
      }
      const r = d ? d.stops[idx] : null;
      const leg = stop.leg || {};
      const modeLbl = (MODE_OPTIONS.find(o => o.value === leg.mode) || {}).label || '';
      const chosen = (stop.accom && stop.accom.options || []).filter(o => o.chosen && o.name && o.name.trim()).map(o => o.name.trim());
      return `<div class="ss-card">
        <div class="ss-top">
          <span class="ss-num">${idx + 1}</span>
          <input class="city" value="${escA(stop.city)}" data-ch="stop-city" data-i="${idx}" placeholder="City name…">
          <button class="ss-x" data-act="stop-delete" data-i="${idx}" title="Remove stop" aria-label="Remove stop">${svg(I.trash, { w: 13, h: 13, sw: 2.2 })}</button>
        </div>
        <div class="ss-dates">${r ? esc(fmt(r.start) + ' → ' + fmt(r.end)) + ' · ' : ''}<span class="ss-nights"><input type="number" min="0" value="${escA(stop.nights)}" data-ch="stop-nights" data-i="${idx}" aria-label="Nights"><span class="ss-nlab">nts</span></span></div>
        ${(modeLbl || leg.duration) ? `<div class="ss-leg"><span class="mode-dot" style="background:${MODE_HEX[leg.mode] || '#7a7260'}"></span>${esc(modeLbl)}${leg.duration ? ' · ' + esc(leg.duration) : ''}</div>` : ''}
        ${chosen.length ? `<div class="ss-hotel">${svg(I.bed, { w: 12, h: 12 })} ${chosen.map(n => esc(n)).join(' · ')}</div>` : ''}
        <div class="ss-btns">
          <button data-act="stop-iti" data-i="${idx}">Itinerary</button>
          <button data-act="stop-accom" data-i="${idx}">Hotels</button>
          <button data-act="stop-transport" data-i="${idx}">Transport</button>
        </div>
      </div>`;
    }
    _paintStopSpot() {
      const el = this.root.querySelector('.stop-spot');
      if (!el) return;
      const trip = this.currentTrip();
      el.innerHTML = this.renderStopSpot(trip, this.computeDates(trip), (x) => this.formatDate(x));
    }

    /* ---------- packing list — animated carry-on sheet (web leaf 4 + phone
       card). The sheet opens closed; when it scrolls into view the case pops
       open (closed→open art crossfade) and the category chips rise out of it
       on dashed leaders (this._pkAnim state machine, IntersectionObserver-
       driven). Chips are the hover/tap checklist targets; drawn item icons
       can replace them later without touching the mechanics. ---------- */
    packList(trip, k) {
      const p = trip.packing || (trip.packing = {});
      return p[k] || (p[k] = []);
    }
    renderPackBody(trip) {
      const pack = trip.packing || {};
      const open = this._pkAnim === 'open';
      // where each chip's dashed leader lands inside the OPEN case art
      const ends = { tech: [268, 398], toiletries: [354, 268], documents: [455, 300], clothes: [232, 430], shoes: [340, 505], extras: [398, 424] };
      const leads = PACK_SLOTS.map((s, i) => {
        const x0 = Math.round(s.cx * 640), y0 = Math.round(s.cy * 560 + 26);
        const [x1, y1] = ends[s.k];
        const d = `transition-delay:${140 + i * 90}ms`;
        return `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" style="${d}"/><circle cx="${x1}" cy="${y1}" r="2.4" style="${d}"/>`;
      }).join('');
      const slots = PACK_SLOTS.map((s, i) => {
        const list = pack[s.k] || [];
        const done = list.filter(x => x.done).length;
        // prefer a full-colour uploaded icon (shown as an <img>); fall back to
        // the ink-mask icon, then to a plain text label for icon-less categories
        const photoIcon = PK_PHOTO_ICONS[s.k];
        const maskIcon = PK_ICONS[s.k];
        const icon = photoIcon || maskIcon;
        // per-category size (cqw); gap lifts the icon higher above its count chip
        const sz = s.sz || 12, gap = s.gap || 0;
        const szStyle = `width:${sz}cqw;height:${sz}cqw${gap ? `;bottom:calc(100% + 6px + ${gap}cqw)` : ''}`;
        const iconHtml = photoIcon
          ? `<div class="pk-icon pk-icon--photo" style="${szStyle}"><img src="${photoIcon}" alt="" draggable="false"></div>`
          : (maskIcon ? `<div class="pk-icon" style="${szStyle};-webkit-mask-image:url(${maskIcon});mask-image:url(${maskIcon})"></div>` : '');
        const labelHtml = icon ? '' : `<span class="pk-lab">${esc(s.label)}</span>`;
        return `<div class="pk-slot${icon ? ' has-icon' : ''}${this.packOpen === s.k ? ' open' : ''}" data-slot="${s.k}" title="${escA(s.label)}" style="left:${s.cx * 100}%;top:${s.cy * 100}%;transition-delay:${220 + i * 90}ms">
          ${iconHtml}
          <div class="pk-chip">${labelHtml}<span class="pk-cnt${list.length && done === list.length ? ' full' : ''}">${list.length ? done + '/' + list.length : '+ add'}</span></div>
        </div>`;
      }).join('');
      return `<div class="pk-bp${open ? ' anim-open' : ''}">
        <div class="pk-art pk-art--closed" style="-webkit-mask-image:url(${PK_ART_CLOSED});mask-image:url(${PK_ART_CLOSED})"></div>
        <div class="pk-art pk-art--open" style="-webkit-mask-image:url(${PK_ART_OPEN});mask-image:url(${PK_ART_OPEN})"></div>
        <svg class="pk-leads" viewBox="0 0 640 560" fill="none" aria-hidden="true">${leads}</svg>
        ${slots}
      </div>`;
    }
    // ---- open/close animation state machine (view state, survives renders).
    // An IntersectionObserver watches whichever .pk-bp is in the current
    // layout: ≥35% visible → the case opens; fully out of view → it closes
    // again so the animation replays on the next visit.
    _setPackAnim(state) {
      clearTimeout(this._pkAnimT);
      this._pkAnim = state;
      this.root.querySelectorAll('.pk-bp').forEach(el => el.classList.toggle('anim-open', state === 'open'));
    }
    _playPackAnim(delay) {
      if (this._pkAnim === 'open') return;
      clearTimeout(this._pkAnimT);
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this._pkAnimT = setTimeout(() => this._setPackAnim('open'), reduced ? 0 : (delay || 325));
    }
    _watchPackSheet() {
      if (!this._pkIO) return;
      this._pkIO.disconnect();
      this.root.querySelectorAll('.pk-bp').forEach(el => this._pkIO.observe(el));
    }
    // the checklist panel docked in the empty space LEFT of the sheet (web
    // layout only), so it never covers the drawing. Hovering an object fills
    // it (and it stays); Escape, ✕ or a click elsewhere clears it back to the
    // hint. On the phone the checklist opens inline under the sheet instead —
    // nothing renders here until something is selected.
    renderPackPanel(trip) {
      const s = PACK_SLOTS.find(x => x.k === this.packOpen);
      if (!s) return this._webMag() ? `<div class="pk-hint">Hover an object on the sheet to open its checklist.</div>` : '';
      const list = (trip.packing || {})[s.k] || [];
      const done = list.filter(x => x.done).length;
      const rows = list.map((it, ii) => `<div class="todo">
        <button class="box${it.done ? ' done' : ''}" data-act="pack-toggle" data-slot="${s.k}" data-i="${ii}" aria-label="Toggle item">${it.done ? svg(I.check, { w: 11, h: 11, sw: 3.5 }) : ''}</button>
        <input class="txt${it.done ? ' done' : ''}" value="${escA(it.text)}" data-ch="pack-text" data-slot="${s.k}" data-i="${ii}" placeholder="New item…">
        <button class="x" data-act="pack-remove" data-slot="${s.k}" data-i="${ii}" aria-label="Remove item">✕</button>
      </div>`).join('');
      return `<div class="pk-card" role="dialog" aria-label="${escA(s.label)} checklist">
        <div class="pk-hd"><span class="t">${esc(s.label)}</span><span class="p">${done} / ${list.length}</span><button class="x" data-act="pk-close" title="Close" aria-label="Close">✕</button></div>
        ${rows || `<p class="pk-none">Nothing yet — add the first item.</p>`}
        <button class="add-todo" data-act="add-pack" data-slot="${s.k}" title="Add item" aria-label="Add item">+</button>
      </div>`;
    }
    // phone app: the same suitcase print as a card between the stats and the
    // to-dos — tapping an object opens its checklist inline under the sheet
    renderPackBlock(trip) {
      const totals = PACK_SLOTS.reduce((a, s) => {
        const L = (trip.packing || {})[s.k] || [];
        a.d += L.filter(x => x.done).length; a.t += L.length; return a;
      }, { d: 0, t: 0 });
      return `<div class="todos pack-block">
        <div class="hd"><div class="t">Packing</div><div class="p">${totals.t ? totals.d + ' / ' + totals.t + ' packed' : ''}</div></div>
        ${this.renderPackBody(trip)}
        <div class="pk-panel">${this.renderPackPanel(trip)}</div>
      </div>`;
    }
    // hover switches are patched in place — no full re-render mid-mouse-move
    _paintPackPanel() {
      const panel = this.root.querySelector('.pk-panel');
      if (!panel) return;
      panel.innerHTML = this.renderPackPanel(this.currentTrip());
      this.root.querySelectorAll('.pk-slot').forEach(el =>
        el.classList.toggle('open', el.dataset.slot === this.packOpen));
    }

    renderStickerPanel() {
      if (!this.stickerPanelOpen) return '';
      const stock = this.data.stickerStock || [];
      const items = stock.map(s => `<div class="stock-item" draggable="true" data-drag="stock-sticker" data-id="${escA(s.id)}" title="Drag onto the page to place">
        <img src="${escA(s.image)}" draggable="false">
        <button class="stock-item__del" data-act="stock-delete" data-id="${escA(s.id)}" title="Remove from stock">−</button>
      </div>`).join('');
      return `<div class="sticker-panel">
        <div class="sticker-panel__head">
          <span class="eyebrow" style="font-size:11px;margin-bottom:0">Memories</span>
          <button class="modal-x" style="padding:5px 9px;font-size:14px;line-height:1" data-act="close-stickers">✕</button>
        </div>
        <p class="sticker-panel__hint">Drop a photo anywhere on the page.</p>
        <div class="sticker-panel__strip" data-drop="sticker-zone">
          ${items}
          <div class="add-outfit" data-act="sticker-panel-add" tabindex="0" title="Click, paste, or drop to add photos">
            ${svg(I.plus, { w: 14, h: 14, sw: 2.2, stroke: 'currentColor' })}<span>Add</span>
          </div>
          <div class="add-outfit paste-tile" data-act="sticker-paste" tabindex="0" title="Paste a copied/lifted image">
            ${svg(I.clipboard, { w: 14, h: 14, sw: 2, stroke: 'currentColor' })}<span>Paste</span>
          </div>
        </div>
        <input type="file" accept="image/*" multiple class="sticker-file" data-ch="sticker-file" style="display:none">
      </div>`;
    }

    renderPlacedStickers(target = 'page') {
      return (this.data.placedStickers || []).filter(ps => (ps.target || 'page') === target).map(ps => {
        const img = ps.image;
        if (!img) return '';
        return `<div class="placed-sticker" data-placed-id="${escA(ps.id)}" style="left:${ps.x}px;top:${ps.y}px;width:${ps.w || 80}px">
          <img src="${escA(img)}" draggable="false">
          <button class="placed-sticker__delete" data-act="placed-delete" data-id="${escA(ps.id)}" title="Remove">×</button>
          <div class="placed-sticker__resize" title="Drag to resize"></div>
        </div>`;
      }).join('');
    }

    /* ----- calendar + itinerary modal ----- */
    buildCalendar(startDate, nights, itinerary, activeDay, closet) {
      const key = d => d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
      const stayMap = {}; const stay = [];
      for (let i = 0; i < nights; i++) { const dt = new Date(startDate); dt.setDate(dt.getDate() + i); stay.push(dt); stayMap[key(dt)] = i; }
      const first = stay[0], last = stay[stay.length - 1];
      let months = '';
      let cur = new Date(first.getFullYear(), first.getMonth(), 1);
      const end = new Date(last.getFullYear(), last.getMonth(), 1);
      while (cur <= end) {
        const y = cur.getFullYear(), m = cur.getMonth();
        const label = cur.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const firstDow = new Date(y, m, 1).getDay();
        const daysIn = new Date(y, m + 1, 0).getDate();
        let cells = '';
        for (let b = 0; b < firstDow; b++) cells += '<div></div>';
        for (let dd = 1; dd <= daysIn; dd++) {
          const date = new Date(y, m, dd); const idx = stayMap[key(date)];
          if (idx == null) { cells += `<div class="cal-off">${dd}</div>`; continue; }
          const active = idx === activeDay;
          const outfits = (itinerary[idx] && Array.isArray(itinerary[idx].outfits)) ? itinerary[idx].outfits : [];
          const img = outfits[0] ? outfits[0].image : null;
          const hasOotd = !!img;
          cells += `<button class="cal-cell${active ? ' active' : ''}" data-act="cal-day" data-drop="cell" data-i="${idx}"${hasOotd ? ` draggable="true" data-drag="cell" data-i="${idx}"` : ''}>
            <span>${dd}</span>${img ? `<img src="${escA(img)}" draggable="false">` : ''}</button>`;
        }
        const dow = WEEK.map(l => `<div class="cal-dow">${l}</div>`).join('');
        months += `<div class="cal-month"><div class="label">${esc(label)}</div><div class="cal-grid">${dow}${cells}</div></div>`;
        cur = new Date(y, m + 1, 1);
      }
      return months;
    }

    // The itinerary's working area (calendar + closet | day planner + day map).
    // Shared verbatim by the app's modal and the web ledger's page 3 — both
    // read this.openStopIdx / this.activeDay.
    renderItineraryBody(trip, d, fmt) {
      const sIdx = this.openStopIdx; const stop = trip.stops[sIdx];
      const nightsN = Math.max(1, Number(stop.nights) || 1);
      this.ensureItinerary(stop);
      const hasDay = this.activeDay != null && this.activeDay >= 0 && this.activeDay < nightsN;
      const activeDay = hasDay ? this.activeDay : -1;
      const range = d ? d.stops[sIdx] : null;
      const calStart = range ? range.start : new Date();
      const closet = this.ensureCloset();
      const cal = this.buildCalendar(calStart, nightsN, stop.itinerary, activeDay, closet);
      const dayDate = (i) => { if (!range) return ''; const dt = new Date(range.start); dt.setDate(dt.getDate() + i); return fmt(dt); };

      const stripCells = closet.map(o => `<div class="outfit" draggable="true" data-drag="closet" data-id="${escA(o.id)}" title="Drag onto a date">
        <img src="${escA(o.image)}"><button class="del" data-act="outfit-delete" data-id="${escA(o.id)}" title="Remove from closet">−</button></div>`).join('');

      let dayBlock;
      if (hasDay) {
        const dayObj = stop.itinerary[activeDay] || (stop.itinerary[activeDay] = { items: [], outfits: [] });
        const itemList = dayObj.items || [];
        const flashIdx = this._flashItem; this._flashItem = null;
        const selIdx = this._selectedItem;
        const placedCount = this.countPlaced(stop, itemList);
        const items = itemList.map((it, ii) => {
          const geoQuery = (it.address || '').trim() || (it.text || '').trim();
          const geoCity = geoQuery.includes(',') ? '' : (stop.city || '');
          const placed = !!(geoQuery && (this._geoCache.get(normKey(geoQuery) + '|' + normKey(geoCity)) || this._geoCache.get(normKey(geoQuery) + '|')));
          const hasAddr = /\S/.test(geoQuery);
          return `<div class="item${ii === selIdx ? ' selected' : ''}${ii === flashIdx ? ' flash' : ''}" data-idx="${ii}">
          <span class="item-num${placed ? ' placed' : (hasAddr ? '' : ' empty')}" title="${placed ? 'Mapped' : hasAddr ? 'Locating…' : 'Type a place name to map this'}">${ii + 1}</span>
          <span class="item-grip" data-drag="activity" data-i="${ii}" title="Drag onto another day">
            <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden="true">
              <circle cx="2.4" cy="2.4" r="1.3"/><circle cx="7.6" cy="2.4" r="1.3"/>
              <circle cx="2.4" cy="8" r="1.3"/><circle cx="7.6" cy="8" r="1.3"/>
              <circle cx="2.4" cy="13.6" r="1.3"/><circle cx="7.6" cy="13.6" r="1.3"/>
            </svg>
          </span>
          <div class="mid">
            <input class="text" value="${escA(it.text)}" data-ch="item-text" data-i="${ii}" placeholder="">
            <div class="meta">
              <div class="field">${svg(I.pin, { w: 11, h: 11, stroke: 'currentColor' })}<input value="${escA(it.address)}" data-ch="item-address" data-i="${ii}" placeholder="Address">${hasAddr ? `<a class="maps" href="https://maps.google.com/?q=${encodeURIComponent(it.address || '')}" target="_blank" rel="noopener" title="Open in Maps">↗</a>` : ''}</div>
              <div class="field">${svg(I.msg, { w: 11, h: 11, stroke: 'currentColor' })}<input value="${escA(it.note)}" data-ch="item-note" data-i="${ii}" placeholder="Note"></div>
              <div class="cost-field"><span class="d">$</span><input value="${escA(it.cost)}" data-ch="item-cost" data-i="${ii}" inputmode="numeric"></div>
            </div>
          </div>
          <button class="x" data-act="item-remove" data-i="${ii}" title="Remove">✕</button>
        </div>`;
        }).join('');
        const mapAside = SHOW_MAP ? `<aside class="day-aside">
          <div id="day-map-holder"></div>
          <div class="daymap-cap"></div>
        </aside>` : '';
        const note = this._optimizeNote;
        const wx = this.dayWeather(stop, range, activeDay);
        const wxChip = (wx && wx.hi != null) ? (() => {
          const info = wxInfo(wx.code);
          const tip = (wx.typical ? 'Typical for these dates (same week last year)' : 'Forecast') +
            (info.label ? ' · ' + info.label : '') + (wx.pop != null ? ' · ' + wx.pop + '% precip' : '');
          return `<span class="day-wx${wx.typical ? ' typical' : ''}" title="${escA(tip)}">` +
            (info.icon ? `<span class="ic">${info.icon}</span>` : '') +
            `<span class="tmp">${wx.hi}°${wx.lo != null ? `<span class="lo">/${wx.lo}°</span>` : ''}</span></span>`;
        })() : '';
        dayBlock = `<div class="iti-foot">
          <div class="day-cols">
            <div class="day-main">
              <div class="day-head">
                <div class="day-title">Day ${activeDay + 1}${dayDate(activeDay) ? ' · ' + esc(dayDate(activeDay)) : ''}</div>${wxChip}
                <button class="optimize-btn" data-act="optimize-day" ${placedCount < 2 ? 'disabled' : ''} title="${placedCount < 2 ? 'Add an address to at least 2 activities first' : 'Reorder the day to avoid backtracking'}">${svg(I.spark, { w: 13, h: 13, sw: 1.6 })}<span>Optimize route</span></button>
              </div>
              ${note ? `<div class="optimize-note${note.kind === 'warn' ? ' warn' : ''}"><span>${esc(note.text)}</span><button class="on-x" data-act="optimize-dismiss" title="Dismiss">✕</button></div>` : ''}
              ${items}${itemList.length === 0 ? `<p class="empty-note" style="margin-top:6px">Nothing planned yet for this day.</p>` : ''}
              <button class="add-item" data-act="add-item" title="Add to this day" aria-label="Add to this day">+</button>
            </div>
            ${mapAside}
          </div>
        </div>`;
      } else {
        dayBlock = '';
      }

      return `<div class="iti-body">
        <div class="iti-left">
          <div class="cal">${cal}</div>
          <div class="closet">
            <div class="hd"><div class="t">Closet</div><span class="hint">add an outfit, then drag it onto any date</span></div>
            <div class="strip">${stripCells}
              <div class="add-outfit" data-act="closet-add" data-drop="closet-zone" tabindex="0" title="Paste, drop, or tap to add an outfit">
                ${svg(I.plus, { w: 16, h: 16, sw: 2.2, stroke: 'currentColor' })}<span>Add</span></div>
              <div class="add-outfit paste-tile" data-act="closet-paste" tabindex="0" title="Paste a copied/lifted image">
                ${svg(I.clipboard, { w: 15, h: 15, sw: 2, stroke: 'currentColor' })}<span>Paste</span></div>
              <input type="file" accept="image/*" class="closet-file" data-ch="closet-file" style="display:none">
            </div>
          </div>
        </div>
        ${hasDay ? `<div class="iti-right">${dayBlock}</div>` : ''}
      </div>`;
    }

    renderItineraryModal(trip, d, fmt) {
      if (this.openStopIdx == null || !trip.stops[this.openStopIdx]) return '';
      const sIdx = this.openStopIdx; const stop = trip.stops[sIdx];
      const nightsN = Math.max(1, Number(stop.nights) || 1);
      const range = d ? d.stops[sIdx] : null;
      const hasDay = this.activeDay != null && this.activeDay >= 0 && this.activeDay < nightsN;
      const activeDay = hasDay ? this.activeDay : -1;
      return `<div class="overlay" data-act="overlay-iti">
        <div class="dialog iti-dialog" data-stop data-sticker-target="iti-${sIdx}">
          <div class="head">
            <div class="row">
              <div style="flex:1;min-width:0">
                <div class="eyebrow">Itinerary</div>
                <input class="iti-city" value="${escA(stop.city)}" data-ch="iti-city">
                <div class="iti-sub">${range ? esc(fmt(range.start) + ' → ' + fmt(range.end)) : ''} · ${nightsN} night${nightsN === 1 ? '' : 's'}</div>
              </div>
              <div style="display:flex;gap:8px;align-items:center;flex-shrink:0">
                <button class="tool-btn sticker-toggle-btn${this.stickerPanelOpen ? ' active' : ''}" data-act="toggle-stickers" title="Memories" aria-label="Memories">${svg(I.sticker)}</button>
                <button class="modal-x" data-act="close-iti">✕</button>
              </div>
            </div>
          </div>
          ${this.renderItineraryBody(trip, d, fmt)}
        </div>
        ${hasDay ? `<div class="placed-stickers-layer placed-stickers-layer--modal">${this.renderPlacedStickers('iti-' + sIdx + '-day-' + activeDay)}</div>` : ''}
      </div>`;
    }

    // Lodging options list for one stop — shared by the app's modal and the
    // web ledger's page 2. Handlers key off this.accomOpenIdx, which both keep.
    renderAccomBody(trip, idx) {
      const stop = trip.stops[idx];
      if (!stop.accom) stop.accom = { options: [] };
      const accomList = stop.accom.options;
      const opts = accomList.map((o, oi) => `<div class="opt${o.chosen ? ' chosen' : ''}">
        <div class="top">
          <button class="choose" data-act="accom-choose" data-i="${oi}" title="${o.chosen ? 'Unchose this option' : 'Choose this option'}">${o.chosen ? svg(I.check, { w: 11, h: 11, sw: 3.5, stroke: '#fff' }) : ''}</button>
          <input class="name" value="${escA(o.name)}" data-ch="accom-name" data-i="${oi}" placeholder="Place name…">
          ${o.chosen ? `<span class="badge">Chosen</span>` : ''}
          <button class="rm" data-act="accom-remove" data-i="${oi}" title="Remove option">${svg(I.trash, { w: 13, h: 13, sw: 2.4 })}</button>
        </div>
        <div class="grid">
          <div class="fld fld--addr"><label>Address</label><div class="lk"><input value="${escA(o.address)}" data-ch="accom-address" data-i="${oi}" placeholder="Street, city — for the map & optimizer">${/\S/.test(o.address || '') ? `<a class="maps" href="https://maps.google.com/?q=${encodeURIComponent(o.address || '')}" target="_blank" rel="noopener" title="Open in Maps">↗</a>` : ''}</div></div>
          <div class="fld"><label>Booking link</label><div class="lk"><input value="${escA(o.link)}" data-ch="accom-link" data-i="${oi}" placeholder="https://…">${/\S/.test(o.link || '') ? `<a href="${escA(o.link)}" target="_blank" rel="noopener" title="Open">↗</a>` : ''}</div></div>
          <div class="fld"><label>Total price</label><input class="price" value="${escA(o.totalPrice)}" data-ch="accom-price" data-i="${oi}" placeholder="e.g. $420 / 4 nights"></div>
          <div class="fld"><label>Distance</label><input value="${escA(o.distance)}" data-ch="accom-distance" data-i="${oi}" placeholder="e.g. 300m to centre"></div>
          <div class="fld"><label>Features</label><input value="${escA(o.features)}" data-ch="accom-features" data-i="${oi}" placeholder="e.g. breakfast, pool, A/C"></div>
        </div>
      </div>`).join('');
      return `<div class="accom-body">
        ${stop.accom.options.length === 0 ? `<p class="empty-note" style="margin:4px 0">No options yet — add one below to start researching.</p>` : ''}
        ${opts}
        <button class="add-option" data-act="accom-add" style="width:100%">+</button>
      </div>`;
    }

    renderAccomModal(trip, d, fmt) {
      if (this.accomOpenIdx == null || !trip.stops[this.accomOpenIdx]) return '';
      const idx = this.accomOpenIdx; const stop = trip.stops[idx];
      const range = d ? d.stops[idx] : null;
      const nightsN = Math.max(1, Number(stop.nights) || 1);
      return `<div class="overlay" data-act="overlay-accom">
        <div class="dialog accom-dialog" data-stop data-sticker-target="accom-${idx}">
          <div class="head"><div class="row">
            <div style="flex:1;min-width:0">
              <div class="eyebrow">Accommodation Research</div>
              <div class="accom-city">${esc(stop.city)}</div>
              <div class="accom-sub">${range ? esc(fmt(range.start) + ' → ' + fmt(range.end)) : ''} · ${nightsN} night${nightsN === 1 ? '' : 's'}</div>
            </div>
            <button class="modal-x" data-act="close-accom">✕</button>
          </div></div>
          ${this.renderAccomBody(trip, idx)}
        </div>
        <div class="placed-stickers-layer placed-stickers-layer--modal">${this.renderPlacedStickers('accom-' + idx)}</div>
      </div>`;
    }

    // One leg's editor (mode pills + times + cost/miles) for the leg that
    // reaches stop `idx` — shared by the app's modal and the ledger's page 2.
    // `idx` is the STOP index (matches renderAccomBody's convention and the
    // header's trip.stops[idx] lookup) — the leg belonging to that stop
    // (its own departure leg, stored as stops[idx].leg) is legByIndex(idx+1).
    // Using legByIndex(idx) directly here used to fetch the PREVIOUS stop's
    // leg (off by one) for every field: depart/arrive/cost/mode/etc.
    renderTransportBody(trip, idx) {
      const legIdx = idx + 1;
      const leg = this.legByIndex(legIdx);
      const isFlight = leg.mode === 'flight';
      const modeColor = MODE_HEX[leg.mode] || '#7a7260';
      const fmtCost = n => { const v = Number(n) || 0; return v >= 1000 ? v.toLocaleString('en-US') : (v || ''); };
      const pills = MODE_OPTIONS.map(o =>
        `<button class="t-pill${leg.mode === o.value ? ' active' : ''}" data-act="transport-mode" data-leg="${legIdx}" data-mode="${escA(o.value)}" style="${leg.mode === o.value ? `background:${modeColor};border-color:${modeColor}` : ''}">${esc(o.label)}</button>`
      ).join('');
      const idLabel = isFlight ? 'Flight No.' : leg.mode === 'train' ? 'Train No.' : 'Line';
      const costVal = escA(fmtCost(leg.cost ?? 0));
      const rewardVal = escA(fmtCost(leg.miles ?? 0));
      return `<div class="transport-body">
            <div class="t-pills">${pills}</div>
            <div class="t-row-3">
              <div class="t-fld">
                <label>Depart</label>
                <input class="t-line-inp" value="${escA(leg.departure || '')}" data-ch="transport-depart" data-leg="${legIdx}" placeholder="09:00">
              </div>
              <div class="t-fld">
                <label>Arrive</label>
                <input class="t-line-inp" value="${escA(leg.arrival || '')}" data-ch="transport-arrival" data-leg="${legIdx}" placeholder="17:30">
              </div>
              <div class="t-fld">
                <label>Transfer</label>
                <input class="t-line-inp t-transfer" type="number" min="0" value="${escA(leg.transfers ?? '')}" data-ch="transport-transfers" data-leg="${legIdx}" placeholder="0">
              </div>
            </div>
            <div class="t-row-2">
              <div class="t-fld">
                <label>${esc(idLabel)}</label>
                <input class="t-line-inp" value="${escA(leg.vehicleId || '')}" data-ch="transport-id" data-leg="${legIdx}" placeholder="—">
              </div>
              <div class="t-fld">
                <label>Cost / pp</label>
                <div class="t-cost-row">
                  <span class="t-unit">$</span>
                  <input class="t-line-inp" inputmode="numeric" value="${costVal}" data-ch="transport-cost" data-leg="${legIdx}">
                </div>
              </div>
            </div>
            ${isFlight ? `
            <div class="t-fld t-reward">
              <label>Reward points / pp</label>
              <div class="t-cost-row">
                <span class="t-unit">pts</span>
                <input class="t-line-inp" inputmode="numeric" value="${rewardVal}" data-ch="transport-reward" data-leg="${legIdx}">
              </div>
            </div>` : ''}
          </div>`;
    }

    renderTransportModal(trip) {
      if (this.transportOpenIdx == null || !trip.stops[this.transportOpenIdx]) return '';
      const idx = this.transportOpenIdx;
      const stop = trip.stops[idx];
      return `<div class="overlay" data-act="overlay-transport">
        <div class="dialog transport-dialog">
          <div class="head"><div class="row">
            <div style="flex:1;min-width:0">
              <div class="eyebrow">Getting there</div>
              <div class="transport-city">${esc(stop.city || 'Stop')}</div>
            </div>
            <button class="modal-x" data-act="close-transport">✕</button>
          </div></div>
          ${this.renderTransportBody(trip, idx)}
        </div>
      </div>`;
    }

    // The printed receipt (printer housing + paper + barcode). `inline` drops
    // the close button — on the web ledger the receipt sits on page 1, in-flow.
    renderReceipt(budget, travelers, nights, inline) {
      const lines = budget.lines.map(line => {
        const editable = !!line.key;
        let right;
        if (line.isOverride) right = `<div class="amt"><input type="text" inputmode="numeric" value="${escA(line.override)}" data-ch="budget-override" title="Auto-calculated · edit to override"></div>`;
        else right = `<div class="amt">${esc(line.total)}</div>`;
        const mid = editable ? `<div class="edit"><input type="text" inputmode="numeric" value="${escA(line.value)}" data-ch="budget-edit" data-key="${escA(line.key)}"><span class="u">${esc(line.unit)}</span></div>` : '';
        return `<div class="bline"><div class="info"><div class="l">${esc(line.label)}</div><div class="m">${esc(line.mult)}</div></div>${mid}${right}</div>`;
      }).join('');
      // print-feed animation runs only on the render right after opening —
      // edits re-render live and must not replay the animation
      const printing = this._budgetPrint ? ' printing' : '';
      if (this._budgetPrint) { clearTimeout(this._budgetPrintTimer); this._budgetPrintTimer = setTimeout(() => { this._budgetPrint = false; }, 1900); }
      return `<div class="receipt-wrap" data-stop>
          <div class="printer-slot" aria-hidden="true"></div>
          <div class="receipt-clip">
            <div class="dialog budget-dialog${printing}">
              <div class="head">
                ${inline ? '' : `<button class="modal-x" data-act="close-budget">✕</button>`}
                <div class="eyebrow">Budget breakdown</div>
                <div class="budget-sub">${esc(money(budget.perPerson))} / person · ${travelers} travelers · ${nights} nights</div>
              </div>
              <div class="budget-body">
                ${lines}
                <div class="btotal"><div class="l">Total</div><div class="v">${esc(money(budget.grandTotal))}</div></div>
                <p class="budget-note">All figures in CAD. Flights &amp; intercity transport are pulled from your route legs; city public transport uses researched local-currency day passes converted to CAD. Edit any rate to refine — it updates live.</p>
                <div class="receipt-barcode" aria-hidden="true"></div>
                <div class="receipt-barcode-num">№ ${String(Math.abs(Math.round(budget.grandTotal * 100))).padStart(12, '0')}</div>
              </div>
            </div>
          </div>
        </div>`;
    }

    renderBudgetModal(budget, travelers, nights) {
      if (!this.budgetOpen) return '';
      return `<div class="overlay" data-act="overlay-budget">
        ${this.renderReceipt(budget, travelers, nights, false)}
      </div>`;
    }

    renderSyncModal() {
      if (!this.syncOpen) return '';
      const linked = this.isLinked();
      const statusCls = 's-' + (this._syncStatus || (linked ? 'synced' : 'off'));
      const when = this.sync.lastSyncedAt ? ('Last synced ' + this.relTime(this.sync.lastSyncedAt)) : '';
      const body = linked ? `
        <p class="sync-lead">Your trips sync automatically across every device that opens this app — no sign-in, no codes. Every edit saves and streams to the others in realtime.</p>
        <div class="sync-row">
          <span class="sync-status ${statusCls}">${esc(this.syncStatusLabel())}</span>
          <span class="sync-when">${esc(when)}</span>
        </div>
        <div class="sync-actions">
          <button class="sync-btn primary" data-act="sync-now"${this._syncBusy ? ' disabled' : ''}>Sync now</button>
          <button class="sync-btn open-web-btn" data-act="open-web">Open the web version ↗</button>
        </div>
        <p class="sync-note">To add a device, just open this app's link there — the same trips appear automatically. Offline edits upload the moment you're back online.</p>
        <p class="sync-note">Anyone with the link shares these trips, so keep it to people you trust.</p>
      ` : `
        <p class="sync-lead">Syncing your trips across devices…</p>
        <div class="sync-row"><span class="sync-status ${statusCls}">${esc(this.syncStatusLabel())}</span></div>
        <p class="sync-note">If this doesn't connect, the shared storage may be unreachable on this network — your edits are still saved on this device and will upload when the connection returns.</p>
      `;
      return `<div class="overlay" data-act="overlay-sync">
        <div class="dialog sync-dialog" data-stop>
          <div class="head"><div class="row">
            <div style="flex:1">
              <div class="eyebrow">Cross-device sync</div>
              <div class="sync-title">${linked ? 'Auto-syncing' : 'Connecting…'}</div>
            </div>
            <button class="modal-x" data-act="close-sync">✕</button>
          </div></div>
          <div class="sync-body">${body}</div>
        </div>
      </div>`;
    }

    /* ============================================================
       EVENT DELEGATION
       ============================================================ */
    wireDelegation() {
      const r = this.root;
      r.addEventListener('click', (e) => this.onClick(e));
      r.addEventListener('change', (e) => this.onChange(e));
      r.addEventListener('dragstart', (e) => this.onDragStart(e));
      r.addEventListener('dragover', (e) => this.onDragOver(e));
      r.addEventListener('drop', (e) => this.onDrop(e));
      r.addEventListener('dragend', (e) => this.onDragEnd(e));
      r.addEventListener('paste', (e) => this.onPaste(e));
      r.addEventListener('pointerdown', (e) => this.onPointerDown(e));
      // packing sheet: hovering an object fills the docked checklist panel
      r.addEventListener('mouseover', (e) => {
        const s = e.target.closest && e.target.closest('.pk-slot');
        if (!s || !this._webMag()) return;
        const k = s.dataset.slot;
        if (k === this.packOpen) return;
        this.packOpen = k;
        this._paintPackPanel();
      });
      const m = this.modalEl;
      m.addEventListener('click', (e) => this.onClick(e));
      m.addEventListener('change', (e) => this.onChange(e));
      m.addEventListener('dragstart', (e) => this.onDragStart(e));
      m.addEventListener('dragover', (e) => this.onDragOver(e));
      m.addEventListener('drop', (e) => this.onDrop(e));
      m.addEventListener('dragend', (e) => this.onDragEnd(e));
      m.addEventListener('paste', (e) => this.onPaste(e));
      m.addEventListener('pointerdown', (e) => this.onPointerDown(e));
      // focus guard: disable ancestor drag while editing a field inside it
      r.addEventListener('focusin', (e) => {
        const t = e.target;
        if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) {
          let el = t.parentElement;
          while (el && el !== r) { if (el.getAttribute && el.getAttribute('draggable') === 'true') { el.setAttribute('draggable', 'false'); el.dataset.dragRestore = '1'; } el = el.parentElement; }
        }
      });
      const fmtNumBlur = e => { const t = e.target; if (t.tagName !== 'INPUT' || t.getAttribute('inputmode') !== 'numeric') return; const n = Number((t.value || '').replace(/,/g, '')); if (!isNaN(n) && isFinite(n) && n >= 1000) t.value = n.toLocaleString(); };
      const fmtNumFocus = e => { const t = e.target; if (t.tagName !== 'INPUT' || t.getAttribute('inputmode') !== 'numeric') return; t.value = (t.value || '').replace(/,/g, ''); };
      r.addEventListener('focusin', fmtNumFocus); r.addEventListener('focusout', fmtNumBlur);
      m.addEventListener('focusin', fmtNumFocus); m.addEventListener('focusout', fmtNumBlur);
      r.addEventListener('focusout', () => { r.querySelectorAll('[data-drag-restore="1"]').forEach(el => { el.setAttribute('draggable', 'true'); delete el.dataset.dragRestore; }); });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') this.onEscape();
        if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); this.undo(); }
      });
    }
    onEscape() {
      if (this.syncOpen) { this.syncOpen = false; this.bumpModal(); return; }
      // ledger leaves aren't dismissable — openStopIdx/accomOpenIdx are the
      // pages' stop selections there, not modals. The bill IS a modal on web.
      if (this._webMag()) {
        if (this.budgetOpen) { this.budgetOpen = false; this.bumpModal(); }
        else if (this.stickerPanelOpen) { this.stickerPanelOpen = false; this.bumpModal(); }
        return;
      }
      if (this.budgetOpen) { this.budgetOpen = false; this.bumpModal(); }
      else if (this.stickerPanelOpen) { this.stickerPanelOpen = false; this.bumpModal(); }
      else if (this.appPage > 0) { this.appGoto(0); }   // back to the overview
    }

    onClick(e) {
      // a click outside the packing slots AND the docked panel clears the checklist
      if (this.packOpen != null && !(e.target.closest && e.target.closest('.pk-slot, .pk-panel'))) {
        this.packOpen = null;
        this._paintPackPanel();
      }
      // web ledger: a click away from a pin and the dock card closes the open
      // stop card, returning the dock to the stop list
      if (this._webMag() && this.stopInfoIdx != null && !(e.target.closest && e.target.closest('.map-pin-outer, .stop-spot'))) {
        this.stopInfoIdx = null;
        this._paintStopSpot();
      }
      // tapping an object opens its checklist — the touch path (phone app) and
      // a click fallback for the web's hover
      {
        const slotEl = e.target.closest && e.target.closest('.pk-slot');
        if (slotEl && slotEl.dataset.slot !== this.packOpen) {
          this.packOpen = slotEl.dataset.slot;
          this._paintPackPanel();
        }
      }
      const t = e.target.closest('[data-act]'); if (!t) return;
      const act = t.dataset.act;
      const i = t.dataset.i != null ? Number(t.dataset.i) : null;
      const key = t.dataset.key; const id = t.dataset.id;
      const trip = this.currentTrip();
      switch (act) {
        case 'undo': this.undo(); break;
        case 'toggle-theme': this.toggleTheme(); break;
        case 'add-trip': this.addTrip(); break;
        case 'tab-select': if (this.data.active !== key) { this.data.active = key; this._lastCoordKey = ''; this._openMapCardIdx = null; this._openMapCardFlipped = false; this.bump(); } break;
        case 'tab-remove': this.removeTrip(key); break;
        case 'traveler-inc': trip.travelers = Math.min(12, (Math.max(1, Number(trip.travelers) || 1)) + 1); this.bump(); break;
        case 'traveler-dec': trip.travelers = Math.max(1, (Math.max(1, Number(trip.travelers) || 1)) - 1); this.bump(); break;
        case 'add-stop': this.insertStop(trip.stops.length); break;
        case 'insert-stop': this.insertStop(i); break;
        case 'stop-iti': this.openStop(i); break;
        case 'stop-accom': this.openAccom(i); break;
        case 'stop-transport': this.openTransport(i); break;
        case 'stop-select': this.stopInfoIdx = i; this._paintStopSpot(); break;
        case 'stop-delete': this.removeStop(i); break;
        case 'todo-toggle': { const td = this.data.meta.todos[i]; td.done = !td.done; this.bump(); break; }
        case 'todo-remove': this.removeTodo(i); break;
        case 'add-todo': this.addTodo(); break;
        // packing checklist — every mutation pins the popover open (packOpen)
        // so it survives the re-render instead of relying on :hover coming back
        case 'pack-toggle': { const L = this.packList(trip, t.dataset.slot); if (L[i]) L[i].done = !L[i].done; this.packOpen = t.dataset.slot; this.bump(); break; }
        case 'pack-remove': this.snapshot(); this.packList(trip, t.dataset.slot).splice(i, 1); this.packOpen = t.dataset.slot; this.bump(); break;
        case 'add-pack': this.packList(trip, t.dataset.slot).push({ text: '', done: false }); this.packOpen = t.dataset.slot; this.bump(); break;
        case 'pk-close': this.packOpen = null; this._paintPackPanel(); break;
        case 'open-budget': this.budgetOpen = true; this._budgetPrint = true; this.bumpModal(); break;
        case 'pick-date': {
          const inp = t.querySelector('.date-native') || (t.closest('.meta-range') || document).querySelector(`.date-native[data-ch="${t.dataset.for}"]`);
          if (inp) { if (inp.showPicker) { try { inp.showPicker(); } catch (err) { inp.focus(); } } else inp.focus(); }
          break;
        }
        case 'app-goto': this.appGoto(i); break;
        case 'app-stop': if (this.appStopIdx !== i) { this.appStopIdx = i; this.activeDay = null; this._optimizeNote = null; this._selectedItem = null; this.render(); } break;
        case 'ledger-goto': this.magGoto(i); break;
        case 'ledger-prev': if (this.magIdx > 0) this.magGoto(this.magIdx - 1); else if (this._introReturn) this._introReturn(); break;
        case 'ledger-next': this.magGoto(this.magIdx + 1); break;
        case 'ledger-stop-plan': if (this.accomOpenIdx !== i) { this.accomOpenIdx = i; this.render(); } break;
        case 'ledger-stop-days': if (this.openStopIdx !== i) { this.openStopIdx = i; this.activeDay = null; this._optimizeNote = null; this._selectedItem = null; this.render(); } break;
        case 'close-budget': this.budgetOpen = false; this.bumpModal(); break;
        case 'overlay-budget': if (e.target === t) { this.budgetOpen = false; this.bumpModal(); } break;
        case 'open-sync': this.syncOpen = true; this.bumpModal(); break;
        case 'close-sync': this.syncOpen = false; this.bumpModal(); break;
        case 'overlay-sync': if (e.target === t) { this.syncOpen = false; this.bumpModal(); } break;
        case 'sync-now': this.syncNow(); break;
        case 'open-web': this.openHostedWeb(); break;
        case 'close-iti': this.closeStop(); break;
        case 'overlay-iti': if (e.target === t) this.closeStop(); break;
        case 'close-accom': this.closeAccom(); break;
        case 'overlay-accom': if (e.target === t) this.closeAccom(); break;
        case 'close-transport': this.closeTransport(); break;
        case 'overlay-transport': if (e.target === t) this.closeTransport(); break;
        case 'transport-mode': { const leg = this.legByIndex(Number(t.dataset.leg)); leg.mode = t.dataset.mode; if (leg.mode === 'flight' && leg.miles == null) leg.miles = 0; this.bump(); break; }
        case 'cal-day': { this.activeDay = (this.activeDay === i ? null : i); this._optimizeNote = null; this._selectedItem = null; this.bumpModal(); break; }
        case 'optimize-day': this.optimizeDay(); break;
        case 'optimize-dismiss': this._optimizeNote = null; this.bumpModal(); break;
        case 'add-item': this.addDayItem(trip.stops[this.openStopIdx], this.activeDay); break;
        case 'item-remove': this.removeDayItem(trip.stops[this.openStopIdx], this.activeDay, i); break;
        case 'closet-add': this.modalEl.querySelector('.closet-file').click(); break;
        case 'closet-paste': this.pasteImageFromClipboard('closet'); break;
        case 'outfit-delete': this.removeOutfitFromCloset(id); break;
        case 'accom-choose': this.chooseAccomOption(this.accomOpenIdx, i); break;
        case 'accom-remove': this.removeAccomOption(this.accomOpenIdx, i); break;
        case 'accom-add': this.addAccomOption(this.accomOpenIdx); break;
        case 'toggle-stickers': this.stickerPanelOpen = !this.stickerPanelOpen; this.bumpModal(); break;
        case 'close-stickers': this.stickerPanelOpen = false; this.bumpModal(); break;
        case 'sticker-panel-add': this.modalEl.querySelector('.sticker-file').click(); break;
        case 'sticker-paste': this.pasteImageFromClipboard('sticker'); break;
        case 'stock-delete': this.removeFromStickerStock(id); break;
        case 'placed-delete': e.stopPropagation(); this.removePlacedSticker(id); break;
      }
    }

    onChange(e) {
      const t = e.target.closest('[data-ch]'); if (!t) return;
      const ch = t.dataset.ch; const v = t.value;
      const i = t.dataset.i != null ? Number(t.dataset.i) : null;
      const trip = this.currentTrip(); const meta = this.data.meta;
      switch (ch) {
        case 'tab-rename': this.data.trips[t.dataset.key].label = v; this.bump(); break;
        case 'depart': trip.depart = v; this.bump(); break;
        case 'return': trip.returnDate = v; this.bump(); break;
        case 'travelers': trip.travelers = Math.max(1, Number(v) || 1); this.bump(); break;
        case 'origin-label': trip.originLabel = v; this.bump(); break;
        case 'home-label': trip.homeLabel = v; this.bump(); break;
        case 'leg-mode': { const leg = this.legByIndex(Number(t.dataset.leg)); leg.mode = v; if (leg.mode === 'flight' && leg.miles == null) leg.miles = 0; this.bump(); break; }
        case 'leg-dur': this.legByIndex(Number(t.dataset.leg)).duration = v; this.bump(); break;
        case 'leg-cost': { const leg = this.legByIndex(Number(t.dataset.leg)); leg.cost = Number((v+'').replace(/,/g,'')) || 0; this.bump(); break; }
        // 'change' fires once on blur (not per keystroke), so a full bump()
        // here is safe and keeps the budget/reward-points stats in sync the
        // moment either field is edited, instead of only after the next
        // unrelated render
        case 'transport-cost': { const leg = this.legByIndex(Number(t.dataset.leg)); leg.cost = Number(v.replace(/,/g, '')) || 0; this.bump(); break; }
        case 'transport-reward': { const leg = this.legByIndex(Number(t.dataset.leg)); leg.miles = Number(v.replace(/,/g, '')) || 0; this.bump(); break; }
        case 'transport-depart': { this.legByIndex(Number(t.dataset.leg)).departure = v; this.scheduleSave(); break; }
        case 'transport-arrival': { this.legByIndex(Number(t.dataset.leg)).arrival = v; this.scheduleSave(); break; }
        case 'transport-transfers': { this.legByIndex(Number(t.dataset.leg)).transfers = Number(v) || 0; this.scheduleSave(); break; }
        case 'transport-id': { this.legByIndex(Number(t.dataset.leg)).vehicleId = v; this.scheduleSave(); break; }
        case 'stop-city': trip.stops[i].city = v; this.bump(); break;
        case 'stop-nights': trip.stops[i].nights = Number(v) || 0; this.bump(); break;
        case 'stop-order': { const newIdx = Math.max(0, Math.min(trip.stops.length - 1, (Number(v) || 1) - 1)); if (newIdx !== i) { this.snapshot(); this.reorderStop(i, newIdx); } break; }
        case 'todo-text': meta.todos[i].text = v; this.bump(); break;
        case 'pack-text': { const L = this.packList(trip, t.dataset.slot); if (L[i]) L[i].text = v; this.packOpen = t.dataset.slot; this.bump(); break; }
        case 'sync-code-in': this._syncCodeDraft = v; break;
        // itinerary modal
        case 'iti-city': trip.stops[this.openStopIdx].city = v; this.bump(); break;
        case 'item-text': trip.stops[this.openStopIdx].itinerary[this.activeDay].items[i].text = v; this.bumpModal(); this.scheduleSave(); break;
        case 'item-address': trip.stops[this.openStopIdx].itinerary[this.activeDay].items[i].address = v; this.bumpModal(); this.scheduleSave(); break;
        case 'item-note': trip.stops[this.openStopIdx].itinerary[this.activeDay].items[i].note = v; this.bumpModal(); this.scheduleSave(); break;
        case 'item-cost': trip.stops[this.openStopIdx].itinerary[this.activeDay].items[i].cost = v; this.bumpModal(); this.scheduleSave(); break;
        case 'closet-file': { const f = e.target.files && e.target.files[0]; if (f) this.addClosetSticker(f); e.target.value = ''; break; }
        case 'sticker-file': { const files = e.target.files; if (files && files.length) this.addToStickerStock(files); e.target.value = ''; break; }
        // accommodation modal
        case 'accom-name': trip.stops[this.accomOpenIdx].accom.options[i].name = v; this.bump(); break;
        case 'accom-link': trip.stops[this.accomOpenIdx].accom.options[i].link = v.trim(); this.bump(); break;
        case 'accom-address': trip.stops[this.accomOpenIdx].accom.options[i].address = v; this.bump(); this.scheduleDayMap(); break;
        case 'accom-price': trip.stops[this.accomOpenIdx].accom.options[i].totalPrice = v; this.bump(); break;
        case 'accom-distance': trip.stops[this.accomOpenIdx].accom.options[i].distance = v; this.bump(); break;
        case 'accom-features': trip.stops[this.accomOpenIdx].accom.options[i].features = v; this.bump(); break;
        // budget modal
        case 'budget-edit': meta.budget[t.dataset.key] = Math.max(0, Number((v+'').replace(/,/g,'')) || 0); this.bump(); break;
        case 'budget-override': { const digits = (v || '').replace(/[^0-9.]/g, ''); meta.budget.cityPassOverride = (digits === '') ? null : Math.max(0, Number(digits) || 0); this.bump(); break; }
      }
    }

    onDragStart(e) {
      const t = e.target.closest('[data-drag]'); if (!t) return;
      const kind = t.dataset.drag;
      try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', t.dataset.key || t.dataset.id || t.dataset.i || ''); } catch (_) {}
      if (kind === 'trip') { this._dragKey = t.dataset.key; }
      else if (kind === 'stop') { this._dragStopIdx = Number(t.dataset.i); }
      else if (kind === 'closet') {
        const o = this.ensureCloset().find(o => o.id === t.dataset.id);
        this._plannerDrag = { kind: 'closet', id: t.dataset.id, image: o ? o.image : '' };
      }
      else if (kind === 'activity') {
        const dayIdx = this.activeDay; const itemIdx = Number(t.dataset.i);
        const stop = this.currentTrip().stops[this.openStopIdx];
        const it = stop.itinerary[dayIdx] && stop.itinerary[dayIdx].items[itemIdx];
        this._plannerDrag = { kind: 'activity', stopIdx: this.openStopIdx, dayIdx, itemIdx };
        const label = (it && it.text && it.text.trim()) || 'Activity';
        const di = document.createElement('div');
        di.textContent = label;
        Object.assign(di.style, {
          position: 'fixed', top: '-200px', left: '-200px', maxWidth: '220px',
          padding: '7px 12px', borderRadius: '8px', background: 'var(--brown)', color: 'var(--on-brown)',
          fontFamily: 'Sora, system-ui, sans-serif', fontSize: '12px', fontWeight: '600',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          boxShadow: '0 4px 14px rgba(35,20,12,.3)',
        });
        document.body.appendChild(di);
        e.dataTransfer.setDragImage(di, 14, 14);
        requestAnimationFrame(() => di.remove());
      }
      else if (kind === 'cell') {
        const dayIdx = Number(t.dataset.i); const stop = this.currentTrip().stops[this.openStopIdx];
        const outfits = (stop.itinerary[dayIdx] && stop.itinerary[dayIdx].outfits) || [];
        if (outfits.length) {
          this._plannerDrag = { kind: 'day', id: outfits[0].id, image: outfits[0].image, stopIdx: this.openStopIdx, dayIdx };
          const di = document.createElement('img');
          di.src = outfits[0].image;
          Object.assign(di.style, { position: 'fixed', top: '-200px', left: '-200px', width: '52px', height: '62px', objectFit: 'contain', borderRadius: '8px', filter: 'drop-shadow(0 4px 12px rgba(35,20,12,.3))' });
          document.body.appendChild(di);
          e.dataTransfer.setDragImage(di, 26, 31);
          requestAnimationFrame(() => di.remove());
          const cellImg = t.querySelector('img');
          if (cellImg) { cellImg.style.opacity = '0'; this._dragCellImg = cellImg; }
        }
      }
      else if (kind === 'stock-sticker') {
        this._stockStickerDrag = t.dataset.id;
        try { e.dataTransfer.effectAllowed = 'copy'; e.dataTransfer.setData('text/plain', t.dataset.id); } catch (_) {}
      }
    }
    onDragOver(e) {
      if (this._stockStickerDrag) { e.preventDefault(); return; }
      const t = e.target.closest('[data-drop]'); if (t) e.preventDefault();
    }
    // Place a memory from the tray at a viewport point, onto whatever page or
    // dialog sits under it. Shared by native HTML5 drop (mouse) and the
    // pointer-based touch drag below — iOS Safari never fires DnD from touch.
    placeStockAtPoint(stockId, clientX, clientY, hitEl) {
      const drop = this._stickerDropTarget(hitEl);
      if (!drop) return false;
      let x, y;
      if (drop.fixed) { x = clientX - 40; y = clientY - 40; }   // modal layer is fixed inset:0 — viewport coords map straight in
      else { const r = drop.layer.getBoundingClientRect(); x = clientX - r.left - 40; y = clientY - r.top - 40; }
      this.placeSticker(stockId, x, y, drop.target);
      return true;
    }
    // Resolve where a dropped memory lands: the mobile modal dialog, a web-ledger
    // leaf, or the mobile phone page. Returns { target, layer } (coords are taken
    // from the layer's box) or { target, fixed:true } for the fixed modal layer.
    _stickerDropTarget(hitEl) {
      const near = (sel) => (hitEl && hitEl.closest) ? hitEl.closest(sel) : null;
      // mobile: itinerary/accom opened as a modal dialog over the page
      const dialogEl = near('[data-sticker-target]');
      if (dialogEl) {
        let target = dialogEl.dataset.stickerTarget;
        if (target.startsWith('iti-') && this.activeDay != null) target = target + '-day-' + this.activeDay;
        return { target, fixed: true };
      }
      // web ledger (iPad + desktop): whichever leaf the drop lands on picks the
      // target, matching the per-leaf targets renderLedger renders with
      const leaf = near('.ledger-leaf');
      if (leaf) {
        const layer = leaf.querySelector('.placed-stickers-layer');
        if (!layer) return null;   // a leaf with no active stop/day has no layer
        let target = 'page';
        if (leaf.classList.contains('leaf-days')) {
          if (this.openStopIdx == null || this.activeDay == null) return null;
          target = 'iti-' + this.openStopIdx + '-day-' + this.activeDay;
        } else if (leaf.classList.contains('leaf-plan')) {
          if (this.accomOpenIdx == null) return null;
          target = 'accom-' + this.accomOpenIdx;
        }
        return { target, layer };
      }
      // mobile phone: the single scrolling page
      const pageEl = this.root.querySelector('.page');
      if (pageEl) return { target: 'page', layer: pageEl.querySelector('.placed-stickers-layer') || pageEl };
      return null;
    }
    onDrop(e) {
      if (this._stockStickerDrag) {
        e.preventDefault();
        this.placeStockAtPoint(this._stockStickerDrag, e.clientX, e.clientY, e.target);
        this._stockStickerDrag = null;
        return;
      }
      const t = e.target.closest('[data-drop]'); if (!t) return;
      e.preventDefault(); const drop = t.dataset.drop;
      if (drop === 'trip') { this.reorderTrips(this._dragKey, t.dataset.key); this._dragKey = null; }
      else if (drop === 'stop') { if (this._dragStopIdx != null) this.reorderStop(this._dragStopIdx, Number(t.dataset.i)); this._dragStopIdx = null; }
      else if (drop === 'cell') { if (this.openStopIdx != null) this.plannerDrop(this.openStopIdx, Number(t.dataset.i)); }
      else if (drop === 'closet-zone') { const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f && f.type.startsWith('image/')) this.addClosetSticker(f); }
      else if (drop === 'sticker-zone') {
        const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (f && f.type.startsWith('image/')) this.addToStickerStock([f]);
      }
    }
    onDragEnd(e) {
      if (this._dragCellImg) { this._dragCellImg.style.opacity = ''; this._dragCellImg = null; }
      const t = e.target.closest('[data-drag]');
      // dragging an outfit out of a day cell without dropping on another cell → remove it from that day
      if (t && t.dataset.drag === 'cell' && this._plannerDrag && this._plannerDrag.kind === 'day') {
        const dayIdx = Number(t.dataset.i);
        if (this._plannerDrag.stopIdx === this.openStopIdx && this._plannerDrag.dayIdx === dayIdx) this.toggleOutfitOnDay(this._plannerDrag.id, this._plannerDrag.stopIdx, dayIdx);
      }
      this._plannerDrag = null;
      this._stockStickerDrag = null;
      if (this._dragStopIdx != null) { this._dragStopIdx = null; this.render(); }
      if (this._dragKey != null) { this._dragKey = null; this.render(); }
    }
    // Explicit paste via the Async Clipboard API — works on iOS Safari (lift-subject / Paste),
    // where the DOM `paste` event never reaches the non-editable add tiles.
    async pasteImageFromClipboard(kind) {
      if (!(navigator.clipboard && navigator.clipboard.read)) {
        alert('Paste isn’t supported in this browser — tap “Add” to choose from Photos instead.');
        return;
      }
      try {
        const items = await navigator.clipboard.read();
        const files = [];
        for (const item of items) {
          const type = item.types.find(t => t.startsWith('image/'));
          if (!type) continue;
          const blob = await item.getType(type);
          files.push(new File([blob], 'pasted.png', { type: blob.type || type }));
        }
        if (!files.length) { alert('No image on the clipboard — copy or lift a photo first, then tap Paste.'); return; }
        if (kind === 'closet') { for (const f of files) await this.addClosetSticker(f); }
        else { await this.addToStickerStock(files); }
      } catch (err) {
        alert('Couldn’t read the clipboard. Lift/copy an image first, then tap Paste and allow clipboard access.');
      }
    }
    onPaste(e) {
      const closetZone = e.target.closest('[data-drop="closet-zone"]');
      if (closetZone) {
        const items = (e.clipboardData && e.clipboardData.items) || [];
        const img = [...items].find(it => it.type.startsWith('image/'));
        if (img) { e.preventDefault(); this.addClosetSticker(img.getAsFile()); }
        return;
      }
      if (this.stickerPanelOpen) {
        const items = (e.clipboardData && e.clipboardData.items) || [];
        const img = [...items].find(it => it.type.startsWith('image/'));
        if (img) { e.preventDefault(); this.addToStickerStock([img.getAsFile()]); }
      }
    }
    /* ---- pointer-based stop reordering (touch-friendly) ---- */
    _startStopDrag(e, grip) {
      const stopEl = grip.closest('.stop');
      // snapshot original card midpoints so targeting stays stable while the dragged card is transformed
      const mids = this._stopEls().map(s => { const r = s.getBoundingClientRect(); return r.top + r.height / 2; });
      this._stopDrag = { fromIdx: Number(grip.dataset.gripStop), pointerId: e.pointerId, startY: e.clientY, moved: false, targetIdx: null, stopEl, lastIns: -1, mids };
      try { grip.setPointerCapture(e.pointerId); } catch (_) {}
      if (stopEl) stopEl.classList.add('dragging');
      this._onSPM = (ev) => this._doStopDrag(ev);
      this._onSPU = (ev) => this._endStopDrag(ev);
      document.addEventListener('pointermove', this._onSPM, { passive: false });
      document.addEventListener('pointerup', this._onSPU, { once: true });
      document.addEventListener('pointercancel', this._onSPU, { once: true });
    }
    _stopEls() { return [...this.root.querySelectorAll('.route .stop')]; }
    _dropIndexAt(y) {
      const mids = this._stopDrag && this._stopDrag.mids;
      if (!mids) return 0;
      let ins = 0;
      for (let i = 0; i < mids.length; i++) { if (y > mids[i]) ins = i + 1; }
      return ins;
    }
    _doStopDrag(e) {
      const d = this._stopDrag; if (!d) return;
      if (e.cancelable) e.preventDefault();
      d.curY = e.clientY;                       // record latest; apply once per frame (coalesce)
      if (!d.raf) d.raf = requestAnimationFrame(() => this._stopDragFrame());
    }
    _stopDragFrame() {
      const d = this._stopDrag; if (!d) return;
      d.raf = 0;
      const dy = d.curY - d.startY;
      if (Math.abs(dy) > 4) d.moved = true;
      // GPU-composited transform; the picked-up card tracks the finger 1:1
      if (d.stopEl) d.stopEl.style.transform = `translate3d(0, ${dy}px, 0)`;
      const ins = this._dropIndexAt(d.curY);
      d.targetIdx = ins;
      if (d.moved && ins !== d.lastIns) {
        d.lastIns = ins;
        const els = this._stopEls();
        els.forEach((s, i) => { s.classList.toggle('drop-before', i === ins); s.classList.toggle('drop-after', ins === els.length && i === els.length - 1); });
      }
    }
    _endStopDrag() {
      const d = this._stopDrag; if (!d) return;
      if (d.raf) cancelAnimationFrame(d.raf);
      document.removeEventListener('pointermove', this._onSPM);
      this._stopDrag = null;
      // recompute the final drop slot from the last pointer position (robust to rAF timing)
      const moved = d.moved || (d.curY != null && Math.abs(d.curY - d.startY) > 4);
      let ins = d.targetIdx;
      if (d.curY != null) { ins = 0; for (let i = 0; i < d.mids.length; i++) { if (d.curY > d.mids[i]) ins = i + 1; } }
      if (moved && ins != null) {
        const n = this.currentTrip().stops.length;
        let to = ins > d.fromIdx ? ins - 1 : ins;
        to = Math.max(0, Math.min(n - 1, to));
        this.reorderStop(d.fromIdx, to);   // bump() re-renders and clears drag classes
      } else {
        this.render();                      // restore (clear .dragging)
      }
    }
    /* ---- pointer-based activity move across days (touch + mouse; replaces native
       HTML5 DnD, which iOS Safari never fires for touch) ---- */
    _startActivityDrag(e, grip) {
      if (this.openStopIdx == null || this.activeDay == null) return;
      const itemIdx = Number(grip.dataset.i);
      this._plannerDrag = { kind: 'activity', stopIdx: this.openStopIdx, dayIdx: this.activeDay, itemIdx };
      const row = grip.closest('.item');
      const label = (row && row.querySelector('.text') && row.querySelector('.text').value.trim()) || 'Activity';
      const ghost = document.createElement('div');
      ghost.className = 'drag-ghost';
      ghost.textContent = label;
      document.body.appendChild(ghost);
      if (row) row.classList.add('drag-source');
      this._actDrag = { ghost, row, targetCell: null, moved: false, startX: e.clientX, startY: e.clientY };
      this._moveGhost(e.clientX, e.clientY);
      try { grip.setPointerCapture(e.pointerId); } catch (_) {}
      this._onAPM = (ev) => this._doActivityDrag(ev);
      this._onAPU = () => this._endActivityDrag();
      document.addEventListener('pointermove', this._onAPM, { passive: false });
      document.addEventListener('pointerup', this._onAPU, { once: true });
      document.addEventListener('pointercancel', this._onAPU, { once: true });
    }
    _moveGhost(x, y) {
      const g = this._actDrag && this._actDrag.ghost; if (!g) return;
      g.style.left = x + 'px'; g.style.top = y + 'px';
    }
    _doActivityDrag(e) {
      const d = this._actDrag; if (!d) return;
      if (e.cancelable) e.preventDefault();
      if (Math.abs(e.clientX - d.startX) > 3 || Math.abs(e.clientY - d.startY) > 3) d.moved = true;
      this._moveGhost(e.clientX, e.clientY);
      // ghost has pointer-events:none, so elementFromPoint reads the cell beneath the finger
      const under = document.elementFromPoint(e.clientX, e.clientY);
      const cell = under ? under.closest('.cal-cell[data-drop="cell"]') : null;
      if (cell !== d.targetCell) {
        if (d.targetCell) d.targetCell.classList.remove('drag-target');
        d.targetCell = cell;
        if (cell) cell.classList.add('drag-target');
      }
    }
    _endActivityDrag() {
      const d = this._actDrag; if (!d) return;
      document.removeEventListener('pointermove', this._onAPM);
      this._actDrag = null;
      if (d.ghost) d.ghost.remove();
      if (d.row) d.row.classList.remove('drag-source');
      if (d.targetCell) d.targetCell.classList.remove('drag-target');
      if (d.moved && d.targetCell) {
        this.plannerDrop(this.openStopIdx, Number(d.targetCell.dataset.i)); // moves item + re-renders modal
      } else {
        this._plannerDrag = null;
      }
    }
    /* ---- pointer-based outfit drag for TOUCH only (iOS never fires native DnD
       from touch; the mouse keeps using native HTML5 DnD, untouched here).
       Threshold-armed so a tap still selects the day. On release the outfit drops
       onto the day highlighted during the drag — tracked in _doOutfitTouchDrag,
       NOT the touch-end coordinates, which iOS reports as stale. A day-outfit
       dragged off every day is removed (matches the mouse drag-out behaviour). ---- */
    _armOutfitTouchDrag(e, el, kind) {
      let info;
      if (kind === 'day') {
        if (this.openStopIdx == null) return;
        const dayIdx = Number(el.dataset.i);
        const stop = this.currentTrip().stops[this.openStopIdx];
        const outfits = (stop.itinerary[dayIdx] && stop.itinerary[dayIdx].outfits) || [];
        if (!outfits.length) return;
        info = { kind: 'day', id: outfits[0].id, image: outfits[0].image, stopIdx: this.openStopIdx, dayIdx };
      } else {
        const o = this.ensureCloset().find(x => x.id === el.dataset.id);
        if (!o) return;
        info = { kind: 'closet', id: el.dataset.id, image: o.image };
      }
      this._outfitTouch = { info, kind, srcEl: el, ghost: null, targetCell: null, moved: false, startX: e.clientX, startY: e.clientY, pointerId: e.pointerId };
      this._onOTM = (ev) => this._doOutfitTouchDrag(ev);
      this._onOTU = (ev) => this._endOutfitTouchDrag(ev);
      document.addEventListener('pointermove', this._onOTM, { passive: false });
      document.addEventListener('pointerup', this._onOTU, { once: true });
      document.addEventListener('pointercancel', this._onOTU, { once: true });
    }
    _doOutfitTouchDrag(e) {
      const d = this._outfitTouch; if (!d) return;
      if (!d.moved) {
        if (Math.abs(e.clientX - d.startX) < 5 && Math.abs(e.clientY - d.startY) < 5) return;
        d.moved = true;
        const ghost = document.createElement('img');
        ghost.src = d.info.image || ''; ghost.className = 'sticker-drag-ghost';
        document.body.appendChild(ghost); d.ghost = ghost;
        if (d.kind === 'day') d.srcEl.classList.add('drag-source');
        try { d.srcEl.setPointerCapture(d.pointerId); } catch (_) {}   // claim the gesture so iOS doesn't scroll it away
      }
      if (e.cancelable) e.preventDefault();
      if (d.ghost) { d.ghost.style.left = e.clientX + 'px'; d.ghost.style.top = e.clientY + 'px'; }
      const under = document.elementFromPoint(e.clientX, e.clientY);
      const cell = under ? under.closest('.cal-cell[data-drop="cell"]') : null;
      if (cell !== d.targetCell) {
        if (d.targetCell) d.targetCell.classList.remove('drag-target');
        d.targetCell = cell;
        if (cell) cell.classList.add('drag-target');
      }
    }
    _endOutfitTouchDrag() {
      const d = this._outfitTouch; if (!d) return;
      document.removeEventListener('pointermove', this._onOTM);
      this._outfitTouch = null;
      if (d.ghost) d.ghost.remove();
      if (d.srcEl) d.srcEl.classList.remove('drag-source');
      if (d.targetCell) d.targetCell.classList.remove('drag-target');
      if (!d.moved) return;   // a tap, not a drag — let the day's click handler run
      if (d.targetCell) {
        this._plannerDrag = d.info;                                   // {kind:'day'|'closet', ...}
        this.plannerDrop(this.openStopIdx, Number(d.targetCell.dataset.i));
      } else if (d.kind === 'day') {
        this.toggleOutfitOnDay(d.info.id, d.info.stopIdx, d.info.dayIdx);   // dragged off the calendar → remove
      }
    }
    /* ----- trip tabs: touch drag-to-reorder (mouse uses native HTML5 DnD) ----- */
    _armTripTouchDrag(e, el) {
      const key = el.dataset.key; if (!key) return;
      this._tripTouch = { key, srcEl: el, ghost: null, targetEl: null, moved: false, startX: e.clientX, startY: e.clientY, pointerId: e.pointerId, label: (el.textContent || 'Trip').trim() };
      this._onTTM = (ev) => this._doTripTouchDrag(ev);
      this._onTTU = (ev) => this._endTripTouchDrag(ev);
      document.addEventListener('pointermove', this._onTTM, { passive: false });
      document.addEventListener('pointerup', this._onTTU, { once: true });
      document.addEventListener('pointercancel', this._onTTU, { once: true });
    }
    _doTripTouchDrag(e) {
      const d = this._tripTouch; if (!d) return;
      if (!d.moved) {
        if (Math.abs(e.clientX - d.startX) < 5 && Math.abs(e.clientY - d.startY) < 5) return;
        d.moved = true;
        const ghost = document.createElement('div');
        ghost.className = 'trip-drag-ghost'; ghost.textContent = d.label;
        document.body.appendChild(ghost); d.ghost = ghost;
        d.srcEl.classList.add('drag-source');
        try { d.srcEl.setPointerCapture(d.pointerId); } catch (_) {}   // claim the gesture so iOS doesn't scroll it away
      }
      if (e.cancelable) e.preventDefault();
      if (d.ghost) { d.ghost.style.left = e.clientX + 'px'; d.ghost.style.top = e.clientY + 'px'; }
      const under = document.elementFromPoint(e.clientX, e.clientY);
      const tab = under ? under.closest('[data-drop="trip"]') : null;
      const target = (tab && tab.dataset.key && tab.dataset.key !== d.key) ? tab : null;
      if (target !== d.targetEl) {
        if (d.targetEl) d.targetEl.classList.remove('drag-target');
        d.targetEl = target;
        if (target) target.classList.add('drag-target');
      }
    }
    _endTripTouchDrag() {
      const d = this._tripTouch; if (!d) return;
      document.removeEventListener('pointermove', this._onTTM);
      this._tripTouch = null;
      if (d.ghost) d.ghost.remove();
      if (d.srcEl) d.srcEl.classList.remove('drag-source');
      if (d.targetEl) d.targetEl.classList.remove('drag-target');
      if (!d.moved) return;   // a tap, not a drag — let the click select the trip
      if (d.targetEl && d.targetEl.dataset.key) this.reorderTrips(d.key, d.targetEl.dataset.key);
    }
    _startMapCardDrag(e, stopIdx) {
      if (this._mobileMap()) return;   // popup position is automatic on mobile (grip hidden too)
      const card = this.mainCardsOverlayEl.querySelector(`.map-stop[data-i="${stopIdx}"]`);
      if (!card) return;
      const overlay = this.mainCardsOverlayEl;
      const canvasRect = overlay.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const offsetX = e.clientX - cardRect.left;
      const offsetY = e.clientY - cardRect.top;
      const stopEl = card;
      if (stopEl) stopEl.classList.add('mc-dragging');
      this._mapCardDrag = { stopIdx, card, canvasRect, offsetX, offsetY, stopEl, _lastLeft: null, _lastTop: null };
      card.style.zIndex = '10';
      card.style.transition = 'none';
      this._onMCM = ev => this._doMapCardDrag(ev);
      this._onMCU = () => this._endMapCardDrag();
      document.addEventListener('pointermove', this._onMCM, { passive: false });
      document.addEventListener('pointerup', this._onMCU, { once: true });
      document.addEventListener('pointercancel', this._onMCU, { once: true });
    }
    _doMapCardDrag(e) {
      const d = this._mapCardDrag; if (!d) return;
      if (e.cancelable) e.preventDefault();
      const { card, canvasRect, offsetX, offsetY } = d;
      let newLeft = e.clientX - canvasRect.left - offsetX;
      let newTop = e.clientY - canvasRect.top - offsetY;
      newLeft = Math.max(0, Math.min(canvasRect.width - card.offsetWidth, newLeft));
      newTop = Math.max(0, Math.min(canvasRect.height - card.offsetHeight, newTop));
      card.style.left = newLeft + 'px';
      card.style.top = newTop + 'px';
      d._lastLeft = newLeft;
      d._lastTop = newTop;
    }
    _endMapCardDrag() {
      const d = this._mapCardDrag; if (!d) return;
      document.removeEventListener('pointermove', this._onMCM);
      this._mapCardDrag = null;
      d.card.style.zIndex = '';
      d.card.style.transition = '';
      if (d.stopEl) d.stopEl.classList.remove('mc-dragging');
      if (d._lastLeft == null) return;
      if (this.mainLeafletMap && window.L) {
        // responsive size, matching _positionMainCards — a fixed 155/74 here made
        // dragged cards jump on the next render whenever the map was narrower
        const { w: CARD_W, h: CARD_H } = this._mainCardSize();
        const pt = window.L.point(d._lastLeft + CARD_W / 2, d._lastTop + CARD_H / 2);
        const latlng = this.mainLeafletMap.containerPointToLatLng(pt);
        this.currentTrip().stops[d.stopIdx].cardLatLng = [latlng.lat, latlng.lng];
      }
      this.bump();
    }
    onPointerDown(e) {
      // activity move across days (touch-friendly; native HTML5 DnD never fires from touch on iOS Safari)
      const actGrip = e.target.closest('.item-grip[data-drag="activity"]');
      if (actGrip) { e.preventDefault(); this._startActivityDrag(e, actGrip); return; }
      // map card free-drag (grip icon on map stop cards)
      const mapGrip = e.target.closest('.grip[data-map-drag]');
      if (mapGrip) { e.preventDefault(); this._startMapCardDrag(e, Number(mapGrip.dataset.mapDrag)); return; }
      // pointer-based stop reorder (works on touch + mouse; native HTML5 DnD doesn't fire from touch on iOS)
      const grip = e.target.closest('.grip[data-grip-stop]');
      if (grip) { e.preventDefault(); this._startStopDrag(e, grip); return; }
      // memory tray: drag a stock sticker out onto the page/dialog. Native HTML5
      // DnD carries this on mouse; touch needs the pointer path (iOS never fires
      // DnD from touch). Threshold-armed so a plain tap still isn't a drag.
      if (e.pointerType === 'touch') {
        // trip tabs: reorder by touch-drag (native HTML5 DnD never fires from
        // touch). Threshold-armed → a plain tap still selects the trip.
        const tripTab = e.target.closest('[data-drag="trip"]');
        if (tripTab) { this._armTripTouchDrag(e, tripTab); return; }
        // outfits: move a day's outfit to another day, or drag a closet item onto
        // a day. Native HTML5 DnD (used by the mouse) never fires from touch on
        // iOS, so drive these by pointer. Threshold-armed → a tap still selects.
        const outfitCell = e.target.closest('.cal-cell[data-drag="cell"]');
        if (outfitCell) { this._armOutfitTouchDrag(e, outfitCell, 'day'); return; }
        const closetItem = e.target.closest('.outfit[data-drag="closet"]');
        if (closetItem && !e.target.closest('.del')) { this._armOutfitTouchDrag(e, closetItem, 'closet'); return; }
        const stockEl = e.target.closest('.stock-item[data-drag="stock-sticker"]');
        if (stockEl && !e.target.closest('.stock-item__del')) { this._armStockStickerDrag(e, stockEl); return; }
      }
      const sticker = e.target.closest('.placed-sticker');
      if (!sticker) return;
      if (e.target.closest('.placed-sticker__delete')) return;
      e.preventDefault();
      const id = sticker.dataset.placedId;
      if (e.target.closest('.placed-sticker__resize')) {
        this._resizingSticker = { id, el: sticker, startX: e.clientX, origW: parseFloat(sticker.style.width) || 80 };
        this._onPM = ev => this._doStickerResize(ev);
        this._onPU = ev => this._endStickerResize(ev);
      } else {
        this._movingSticker = { id, el: sticker, startX: e.clientX, startY: e.clientY, origLeft: parseFloat(sticker.style.left) || 0, origTop: parseFloat(sticker.style.top) || 0 };
        this._onPM = ev => this._doStickerMove(ev);
        this._onPU = ev => this._endStickerMove(ev);
      }
      document.addEventListener('pointermove', this._onPM);
      document.addEventListener('pointerup', this._onPU, { once: true });
    }
    _doStickerMove(e) {
      if (!this._movingSticker) return;
      const { el, startX, startY, origLeft, origTop } = this._movingSticker;
      el.style.left = (origLeft + e.clientX - startX) + 'px';
      el.style.top = (origTop + e.clientY - startY) + 'px';
    }
    _endStickerMove(e) {
      if (!this._movingSticker) return;
      const { id, el } = this._movingSticker;
      document.removeEventListener('pointermove', this._onPM);
      this._movingSticker = null;
      const ps = this.data.placedStickers.find(s => s.id === id);
      if (!ps) return;
      const x = Math.round(parseFloat(el.style.left) || 0);
      const y = Math.round(parseFloat(el.style.top) || 0);
      const w = parseFloat(el.style.width) || 80;
      let outOfBounds;
      if (ps.target === 'page') {
        const pageEl = this.root.querySelector('.page');
        const r = pageEl ? pageEl.getBoundingClientRect() : null;
        outOfBounds = r && (x + w < 0 || y + 40 < 0 || x > r.width || y > r.height);
      } else {
        outOfBounds = x + w < 0 || y + 40 < 0 || x > window.innerWidth || y > window.innerHeight;
      }
      if (outOfBounds) {
        this.data.placedStickers = this.data.placedStickers.filter(s => s.id !== id);
        this.bump();
        return;
      }
      ps.x = x; ps.y = y;
      this.scheduleSave();
    }
    _doStickerResize(e) {
      if (!this._resizingSticker) return;
      const { el, startX, origW } = this._resizingSticker;
      el.style.width = Math.max(32, origW + e.clientX - startX) + 'px';
    }
    _endStickerResize(e) {
      if (!this._resizingSticker) return;
      const { id, el } = this._resizingSticker;
      const ps = this.data.placedStickers.find(s => s.id === id);
      if (ps) ps.w = Math.max(32, Math.round(parseFloat(el.style.width) || 80));
      document.removeEventListener('pointermove', this._onPM);
      this._resizingSticker = null;
      this.scheduleSave();
    }
    /* ---- pointer-based memory drag out of the tray (touch; native HTML5 DnD
       handles the mouse). Armed on pointerdown, but a floating ghost only
       appears once the finger crosses the drag threshold, so a tap on a tray
       tile stays a tap. On release the memory lands wherever the finger is —
       the trip page or an open itinerary/accom dialog. ---- */
    _armStockStickerDrag(e, el) {
      const stockId = el.dataset.id;
      const stock = (this.data.stickerStock || []).find(s => s.id === stockId);
      if (!stock) return;
      this._stockTouchDrag = { stockId, image: stock.image, ghost: null, srcEl: el, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, moved: false };
      this._onSSM = (ev) => this._doStockStickerDrag(ev);
      this._onSSU = (ev) => this._endStockStickerDrag(ev);
      document.addEventListener('pointermove', this._onSSM, { passive: false });
      document.addEventListener('pointerup', this._onSSU, { once: true });
      document.addEventListener('pointercancel', this._onSSU, { once: true });
    }
    _doStockStickerDrag(e) {
      const d = this._stockTouchDrag; if (!d) return;
      if (!d.moved) {
        if (Math.abs(e.clientX - d.startX) < 4 && Math.abs(e.clientY - d.startY) < 4) return;
        d.moved = true;
        const ghost = document.createElement('img');
        ghost.src = d.image; ghost.className = 'sticker-drag-ghost';
        document.body.appendChild(ghost);
        d.ghost = ghost;
        try { d.srcEl.setPointerCapture(d.pointerId); } catch (_) {}
      }
      if (e.cancelable) e.preventDefault();
      d.ghost.style.left = e.clientX + 'px';
      d.ghost.style.top = e.clientY + 'px';
    }
    _endStockStickerDrag(e) {
      const d = this._stockTouchDrag; if (!d) return;
      document.removeEventListener('pointermove', this._onSSM);
      this._stockTouchDrag = null;
      if (d.ghost) d.ghost.remove();   // off before the hit-test so it never reads itself
      if (!d.moved) return;            // a tap, not a drag — leave the tile in the tray
      const hit = document.elementFromPoint(e.clientX, e.clientY);
      this.placeStockAtPoint(d.stockId, e.clientX, e.clientY, hit);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('app');
    const app = new Planner(root);
    window.__planner = app;
    app.init();
  });
})();
