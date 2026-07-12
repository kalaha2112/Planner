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

  // Public web build (the single-file standalone.html served by rawgithack from
  // the main branch of the Planner repo — always the latest merged build). The
  // Sync modal links here, carrying "?sync=<code>" so the hosted page
  // auto-connects to this device's endpoint — two-way sync.
  const HOSTED_WEB_URL = 'https://raw.githack.com/kalaha2112/Planner/main/planner/standalone.html';

  // Startup page headline (editable in place; persisted in meta.introText and synced)
  const DEFAULT_INTRO_TEXT = 'The first website was published in 1990 by computer scientist Tim Berners-Lee and now it seems like an eyesore. Early websites were basic few';

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
          { city: 'Paris', nights: 2, note: '', leg: { mode: 'flight', duration: '9h45m nonstop · Air France', cost: 220, miles: 0 } }
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
          { city: 'Copenhagen', nights: 2, note: '', leg: { mode: 'flight', duration: '~1h30m · SAS / Norwegian', cost: 130 } },
          { city: 'Bergen', nights: 3, note: '', leg: { mode: 'train', duration: '~6h45m · Bergen Railway (scenic)', cost: 90 } },
          { city: 'Oslo', nights: 4, note: '', leg: { mode: 'train', duration: '~5-6h', cost: 80 } },
          { city: 'Stockholm', nights: 4, note: '', leg: { mode: 'flight', duration: '~2h40m AF · same ticket as flight home', cost: 0, miles: 0 } },
          { city: 'Paris', nights: 2, note: '', leg: { mode: 'flight', duration: '9h45m nonstop · Air France', cost: 220, miles: 0 } }
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
  const PK_ART_CLOSED = 'data:image/png;base64,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';
  const PK_ART_OPEN = 'data:image/png;base64,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';
  // Packing categories — chips float in two arcs above the case and rise out
  // of it when the sheet scrolls into view. cx/cy are fractions of the sheet.
  const PACK_SLOTS = [
    { k: 'tech',       label: 'Electronics', cx: .21, cy: .10 },
    { k: 'toiletries', label: 'Toiletries',  cx: .47, cy: .07 },
    { k: 'documents',  label: 'Documents',   cx: .73, cy: .10 },
    { k: 'clothes',    label: 'Clothes',     cx: .13, cy: .27 },
    { k: 'shoes',      label: 'Shoes',       cx: .44, cy: .25 },
    { k: 'extras',     label: 'Extras',      cx: .83, cy: .27 },
  ];

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
      this.packOpen = null;         // packing slot whose popover is pinned open (view state)
      this._pkAnim = 'closed';      // packing sheet animation state: closed → open
      this._pkIO = ('IntersectionObserver' in window) ? new IntersectionObserver((es) => es.forEach(e => {
        if (e.isIntersecting && e.intersectionRatio >= .35) this._playPackAnim(325);
        else if (!e.isIntersecting) this._setPackAnim('closed');
      }), { threshold: [0, .35] }) : null;
      this._wheelAcc = 0;           // trackpad delta accumulator for page turns
      this._wheelT = 0;
      // ---- cloud sync ----
      this.sync = this.loadSyncRec();   // { id, rev, lastSyncedAt }
      this.syncOpen = false;            // sync modal open?
      this._syncBusy = false;           // an in-flight request guards against overlap
      this._syncStatus = this.isLinked() ? 'synced' : 'off'; // off|syncing|synced|offline|error
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
      // mobile: tapping a pin opens that stop's card as a popup
      this.mainPinsOverlayEl.addEventListener('click', (e) => {
        if (!this._mobileMap()) return;
        const pin = e.target.closest('.map-pin-outer');
        if (!pin) return;
        const idx = Number(pin.dataset.pin);
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
      // auto-link from URL: any copy opened as …?sync=<code or endpoint URL>
      // (or #sync=…) connects itself to that endpoint — this is how the
      // installed app and the rawgithack-hosted standalone find each other.
      const sm = (location.search + '&' + location.hash.replace(/^#/, '')).match(/[?&]sync=([^&]+)/);
      const syncCode = sm ? this.normalizeEndpoint(decodeURIComponent(sm[1])) : '';
      if (syncCode && syncCode !== 't-' && syncCode !== this.sync.id) {
        this.syncOpen = true; this.bumpModal();   // show progress/result in the sync modal
        this.connectEndpoint(syncCode);
      } else if (this.isLinked()) {
        this.pullCloud();   // pick up edits made on another device
      }
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
      if (this._webMag()) return this.syncOpen || this.budgetOpen || this.stickerPanelOpen;
      return this.syncOpen || this.budgetOpen || this.stickerPanelOpen ||
        this.accomOpenIdx != null || this.transportOpenIdx != null || this.openStopIdx != null;
    }
    // sync pulls must not clobber content mid-edit. The app blocks while an
    // editing modal is open; the ledger's leaves are always open, so there we
    // block only while the user is actually typing in a field.
    _syncEditGuard() {
      if (this._webMag()) {
        const ae = document.activeElement;
        return !!(ae && (ae.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)));
      }
      return (this.openStopIdx != null || this.accomOpenIdx != null || this.budgetOpen);
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
      };
      const unpark = () => {
        if (!parked) return;
        parked = false;
        overlay.classList.remove('intro-parked');
        appRoot.style.willChange = 'transform';
        document.documentElement.classList.add('intro-lock');
        this._introParked = false; this.updateTopActions();        // sync button returns with the intro
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
      // target view: the trip's centroid (fallback: Europe)
      const tLat = stops.length ? stops.reduce((a, c) => a + c[0], 0) / stops.length : 47;
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
        this._globeView = { lat: tLat, lng: tLng };
        this._drawGlobe(svg, tLat, tLng, stops);
        return;
      }
      const from = { lat: cur.lat, lng: cur.lng };
      const t0 = performance.now();
      const D = Math.min(1600, 700 + dist * 6);   // farther hops spin a little longer
      const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const step = (now) => {
        const k = Math.min(1, (now - t0) / D);
        const e = ease(k);
        this._globeView = { lat: from.lat + dLat * e, lng: from.lng + dLng * e };
        this._drawGlobe(svg, this._globeView.lat, this._globeView.lng, stops);
        if (k < 1) this._globeAnim = requestAnimationFrame(step);
      };
      this._globeAnim = requestAnimationFrame(step);
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
    legByIndex(i) { const t = this.currentTrip(); return i === 0 ? t.outboundLeg : t.stops[i - 1].leg; }

    bump() { this.render(); this.scheduleSave(); this.touchMap(); if (this._introGlobeRefresh) this._introGlobeRefresh(); if (this._introTabsRefresh) this._introTabsRefresh(); }
    bumpModal() {
      // web ledger: itinerary/accom/transport/budget render on the leaves inside
      // #app, so a "modal" bump has to redraw the whole page (render() also
      // refreshes the floating panels in modalEl)
      if (this._webMag()) { this.render(); return; }
      const trip = this.currentTrip();
      const travelers = Math.max(1, Number(trip.travelers) || 1);
      const d = this.computeDates(trip);
      const fmt = (x) => this.formatDate(x);
      const nights = trip.stops.reduce((s, st) => s + (Number(st.nights) || 0), 0);
      const budget = this.computeBudget(trip, travelers, nights);
      this.modalEl.innerHTML =
        this.renderStickerPanel() +
        this.renderItineraryModal(trip, d, fmt) +
        this.renderAccomModal(trip, d, fmt) +
        this.renderTransportModal(trip) +
        this.renderBudgetModal(budget, travelers, nights) +
        this.renderSyncModal();
      // modal-only re-render still has to (re)mount the per-day map node
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

    cloudPayload() { return JSON.stringify({ app: APP_TAG, rev: this.sync.rev || Date.now(), data: this.data }); }
    // parse "<tag>-<id>" (tolerating a pasted full URL) into a backend + id
    parseCode(code) {
      let c = (code || '').trim();
      const url = c.match(/(?:jsonBlob|bin)\/([^/\s?#]+)/i);     // full URL paste
      if (url) c = url[1];
      const m = c.match(/^([a-z])-(.+)$/i);
      if (m && SYNC_BACKENDS[m[1]]) return { be: SYNC_BACKENDS[m[1]], id: m[2] };
      return { be: SYNC_BACKENDS[SYNC_ORDER[0]], id: c };          // legacy / untagged
    }
    // normalize a thrown error: a bare fetch rejection (TypeError) means the
    // host was unreachable / CORS-blocked; our own errors carry a message.
    normErr(e) {
      if (e && (e.code || /HTTP|unreadable|no code|no data|too large/i.test(e.message || ''))) return e;
      const er = new Error(navigator.onLine === false
        ? 'You appear to be offline.'
        : 'Could not reach the sync service (it may be down or blocked on this network).');
      er.code = 'unreachable'; return er;
    }
    netMsg(e) { return (e && e.message) ? e.message : 'Network error.'; }

    async cloudGet(code) {
      const { be, id } = this.parseCode(code);
      let txt;
      try { txt = await be.get(id); } catch (e) { throw this.normErr(e); }
      if (!txt) throw _notFound();
      try { return JSON.parse(txt); } catch (e) { throw new Error('Synced data was unreadable.'); }
    }
    async cloudPut(code) {
      const { be, id } = this.parseCode(code);
      try { await be.put(id, this.cloudPayload()); } catch (e) { throw this.normErr(e); }
    }
    validPayload(p) { return !!(p && p.data && p.data.trips && p.data.meta); }

    /* ----- user actions ----- */
    async createSync() {
      if (this._syncBusy) return;
      this._syncBusy = true; this.setSyncStatus('syncing', 'Creating…');
      if (!this.sync.rev) this.sync.rev = Date.now();
      const body = this.cloudPayload();
      const fails = [];
      for (const tag of SYNC_ORDER) {
        try {
          const id = await SYNC_BACKENDS[tag].create(body);   // create stores our data too
          this.sync.id = tag + '-' + id; this.sync.lastSyncedAt = Date.now(); this.persistSyncRec();
          this._syncBusy = false; this.setSyncStatus('synced', 'Code created'); this.bumpModal();
          return;
        } catch (e) {
          const ne = this.normErr(e);
          fails.push(SYNC_BACKENDS[tag].name + ': ' + (ne.code === 'unreachable' ? 'unreachable' : ne.message));
        }
      }
      this._syncBusy = false;
      this.setSyncStatus('error', 'Sync failed — ' + fails.join(' · ')); this.bumpModal();
    }
    async linkSync(rawId) {
      const code = (rawId || '').trim();
      if (!code) { this.setSyncStatus('error', 'Enter a sync code.'); return; }
      if (this._syncBusy) return;
      this._syncBusy = true; this.setSyncStatus('syncing', 'Linking…');
      try {
        const payload = await this.cloudGet(code);
        if (!this.validPayload(payload)) throw new Error('That code has no planner data.');
        this.snapshot();
        this.data = payload.data; this.migrate(); this._lastCoordKey = '';
        this.sync.id = code; this.sync.rev = Number(payload.rev) || Date.now(); this.sync.lastSyncedAt = Date.now();
        this.persistSyncRec(); this.saveLocalNow();
        this._syncBusy = false; this._syncCodeDraft = '';
        this.setSyncStatus('synced', 'Linked'); this.render(); this.bumpModal();
      } catch (e) {
        this._syncBusy = false;
        this.setSyncStatus('error', e.code === 404 ? 'No data found for that code.' : this.netMsg(e));
      }
    }
    unlinkSync() {
      clearTimeout(this._cloudPushTimer);
      this.sync = { id: null, rev: this.sync.rev || 0, lastSyncedAt: 0 };
      this.persistSyncRec(); this.setSyncStatus('off', ''); this.bumpModal();
    }
    syncNow() { this.pullCloud({ force: true }); }

    // URL of the hosted web build, carrying this device's sync code when linked
    // so the opened page auto-connects to the same trips.
    hostedWebUrl() {
      return this.isLinked()
        ? HOSTED_WEB_URL + '?sync=' + encodeURIComponent(this.sync.id)
        : HOSTED_WEB_URL;
    }
    // Open the hosted web build. If this device isn't linked yet, first create a
    // sync endpoint automatically, then hand the new tab the ?sync= link so both
    // ends stay in sync. The blank tab is opened up-front (inside the user
    // gesture) so it isn't caught by the popup blocker after the async create.
    async openHostedWeb() {
      if (this.isLinked()) { window.open(this.hostedWebUrl(), '_blank', 'noopener'); return; }
      const win = window.open('about:blank', '_blank');
      await this.createSync();
      if (this.isLinked()) { if (win) win.location = this.hostedWebUrl(); else window.open(this.hostedWebUrl(), '_blank', 'noopener'); }
      else if (win) win.close();   // couldn't create an endpoint; status shows the error
    }

    // reconstruct a human endpoint URL from a "t-<key>" code (for display)
    endpointUrl(code) {
      const { be, id } = this.parseCode(code);
      if (be && be.base && /textdb/.test(be.base)) return be.base + '/' + id;
      return code;
    }
    // normalize whatever the user pasted (full textdb URL, page URL, or raw key)
    // into our "t-<key>" code form
    normalizeEndpoint(raw) {
      let v = (raw || '').trim();
      if (!v) return '';
      let m = v.match(/textdb\.dev\/api\/data\/([^/\s?#]+)/i);
      if (!m) m = v.match(/textdb\.dev\/(?:e\/)?([^/\s?#]+)/i);
      if (m) return 't-' + m[1];
      if (/^[a-z]-/i.test(v) && SYNC_BACKENDS[v[0].toLowerCase()]) return v;   // already a tagged code
      return 't-' + v.replace(/[^\w-]/g, '');                                  // bare key
    }
    // Connect a user-created endpoint: load its trips if it already has some
    // (2nd device), otherwise initialize it with this device's trips (1st device).
    async connectEndpoint(raw) {
      const code = this.normalizeEndpoint(raw);
      if (!code || code === 't-') { this.setSyncStatus('error', 'Paste your textdb endpoint first.'); return; }
      if (this._syncBusy) return;
      this._syncBusy = true; this.setSyncStatus('syncing', 'Connecting…');
      try {
        let payload = null;
        try { payload = await this.cloudGet(code); }
        catch (e) { if (e.code !== 404) throw e; }   // 404/empty = brand-new endpoint
        if (payload && this.validPayload(payload)) {
          // endpoint already holds trips — adopt them
          this.snapshot();
          this.data = payload.data; this.migrate(); this._lastCoordKey = '';
          this.sync.id = code; this.sync.rev = Number(payload.rev) || Date.now(); this.sync.lastSyncedAt = Date.now();
          this.persistSyncRec(); this.saveLocalNow();
          this._syncBusy = false; this._syncCodeDraft = '';
          this.setSyncStatus('synced', 'Connected — trips loaded'); this.render(); this.bumpModal();
        } else {
          // empty endpoint — seed it with our current trips, then read back to confirm it stuck
          if (!this.sync.rev) this.sync.rev = Date.now();
          this.sync.id = code; this.persistSyncRec();
          await this.cloudPut(code);
          let check = null; try { check = await this.cloudGet(code); } catch (e) {}
          if (!check || !this.validPayload(check)) {
            this.sync.id = null; this.persistSyncRec();
            throw new Error("Saved, but the endpoint didn't keep the data — double-check you pasted the API URL from textdb.dev (textdb.dev/api/data/…).");
          }
          this.sync.lastSyncedAt = Date.now(); this.persistSyncRec();
          this._syncBusy = false; this._syncCodeDraft = '';
          this.setSyncStatus('synced', 'Connected — endpoint set up'); this.render(); this.bumpModal();
        }
      } catch (e) {
        this._syncBusy = false;
        this.setSyncStatus('error', e.code === 404 ? 'Endpoint not found.' : this.netMsg(e)); this.bumpModal();
      }
    }

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
        await this.cloudPut(this.sync.id);
        this.sync.lastSyncedAt = Date.now(); this.persistSyncRec();
        this._syncBusy = false; this.setSyncStatus('synced', '');
      } catch (e) {
        this._syncBusy = false;
        if (e.code === 404) this.setSyncStatus('error', 'Sync code no longer exists — re-create or re-link.');
        else { this.setSyncStatus('offline', this.netMsg(e)); this.scheduleCloudPush(); }
      }
    }
    async pullCloud(opts = {}) {
      if (!this.isLinked() || this._syncBusy) return;
      // don't clobber content the user is mid-edit in (app: an open editing
      // modal · web ledger: a focused field); "Sync now" (force) still goes through.
      if (!opts.force && this._syncEditGuard()) return;
      this._syncBusy = true; if (opts.force) this.setSyncStatus('syncing', 'Checking…');
      try {
        const payload = await this.cloudGet(this.sync.id);
        const remoteRev = Number(payload && payload.rev) || 0;
        const localRev = this.sync.rev || 0;
        if (this.validPayload(payload) && remoteRev > localRev) {
          // remote is newer — adopt it (but never clobber a modal the user is typing in)
          this.data = payload.data; this.migrate(); this._lastCoordKey = '';
          this.sync.rev = remoteRev; this.sync.lastSyncedAt = Date.now(); this.persistSyncRec();
          this.saveLocalNow();
          this._syncBusy = false; this.setSyncStatus('synced', 'Updated from another device');
          this.render(); this.bumpModal(); this.touchMap();
        } else if (remoteRev < localRev) {
          // we hold newer edits (e.g. made offline) — push them up
          this._syncBusy = false; this.setSyncStatus('synced', ''); this.scheduleCloudPush();
        } else {
          this.sync.lastSyncedAt = Date.now(); this.persistSyncRec();
          this._syncBusy = false; this.setSyncStatus('synced', opts.force ? 'Up to date' : '');
        }
      } catch (e) {
        this._syncBusy = false;
        if (e.code === 404) this.setSyncStatus('error', 'Sync code no longer exists.');
        else this.setSyncStatus('offline', opts.force ? this.netMsg(e) : '');
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
    _loadMinimalBasemap() {
      const topo = window.topojson;
      if (!topo || !this.mainMapLand) return;
      this._ensureAtlas().then((world) => {
        if (!world || this._basemapBuilt) return;
        this._basemapBuilt = true;
        const countries = this._smoothCountries(topo.feature(world, world.objects.countries));
        window.L.geoJSON(
          countries,
          { style: { fillColor: '#000000', fillOpacity: 1, color: '#47403a', weight: 3, opacity: 1, lineJoin: 'round', lineCap: 'round', className: 'map-land' } }   // .map-land CSS themes fill/stroke
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
    }
    _resetPins() {
      this._pinsDropped = false;
      clearTimeout(this._pinDropT);
      this.mainPinsOverlayEl.classList.remove('pins-drop');
      this.mainPinsOverlayEl.classList.add('pins-wait');
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
        L.polyline(polyCoords, { color: '#000000', weight: 2.2, opacity: 0.65, className: 'map-route-line' }).addTo(this.mainMapLines);
      }

      // Numbered pins rendered in overlay div (outside Leaflet — no overflow clipping)
      this.mainPinsOverlayEl.innerHTML = stops.map((stop, idx) => {
        if (!coords[idx]) return '';
        return `<div class="map-pin-outer" data-pin="${idx}"><div class="map-pin-main" style="background:var(--red)"><input type="number" class="pin-order-input" value="${idx + 1}" min="1" max="${stops.length}" data-ch="stop-order" data-i="${idx}" title="Tap to change order"></div></div>`;
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

      // Position city labels — only show those within the current viewport
      const bounds = map.getBounds();
      const labelEls = this.mainCityLabelsEl.children;
      this._mapCities.forEach(([, lat, lng], i) => {
        const el = labelEls[i];
        if (!el) return;
        if (!bounds.contains([lat, lng])) { el.style.display = 'none'; return; }
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
      if (pts.length > 1) this.dayLines.addLayer(L.polyline(pts, { color: '#ffffff', weight: 1.8, opacity: .6, dashArray: '6 8', className: 'day-route-line' }));   // .day-route-line CSS: dark dashes on the light map, white on the night map
      if (pts.length === 1) this.dayMap.setView(pts[0], 14);
      else if (pts.length > 1) this.dayMap.fitBounds(pts, { padding: [30, 30], maxZoom: 15 });
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

      // Resolve the hotel as the fixed route origin
      const chosen = (stop.accom && stop.accom.options || []).find(o => o.chosen);
      let origin = null;
      if (chosen && chosen.name && chosen.name.trim()) {
        const hq = chosen.name.trim();
        const hKey = normKey(hq) + '|' + normKey(stop.city || '');
        if (!this._geoCache.has(hKey)) {
          // hotel not geocoded yet — trigger it and ask user to retry
          this.geocode(hq, stop.city).then(() => this.scheduleDayMap());
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
      const originLabel = (chosen && chosen.name && chosen.name.trim() && origin) ? chosen.name.trim() : (origin ? stop.city : null);
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
      this.data.active = key; this.bump();
    }
    removeTrip(key) {
      const keys = Object.keys(this.data.trips);
      if (keys.length <= 1) return;
      if (!confirm('Remove this trip and everything in it?')) return;
      this.snapshot();
      delete this.data.trips[key];
      if (this.data.active === key) this.data.active = Object.keys(this.data.trips)[0];
      this.bump();
    }
    reorderTrips(fromKey, toKey) {
      if (!fromKey || fromKey === toKey) return;
      const keys = Object.keys(this.data.trips); const fi = keys.indexOf(fromKey), ti = keys.indexOf(toKey);
      if (fi < 0 || ti < 0) return;
      keys.splice(fi, 1); keys.splice(ti, 0, fromKey);
      const re = {}; keys.forEach(k => re[k] = this.data.trips[k]); this.data.trips = re; this.bump();
    }
    addTodo() { this.data.meta.todos.push({ text: '', done: false }); this.bump(); }
    removeTodo(i) { this.snapshot(); this.data.meta.todos.splice(i, 1); this.bump(); }

    /* ---------- itinerary / accommodation ---------- */
    openStop(idx) {
      this.openStopIdx = idx; this.activeDay = null; this._optimizeNote = null; this._selectedItem = null;
      // web ledger: the itinerary is page 2 — flip to it with this stop selected
      if (this._webMag()) { this.render(); this.magGoto(1); return; }
      this.bumpModal();
    }
    closeStop() { this.openStopIdx = null; this.bumpModal(); }
    openAccom(idx) {
      this.accomOpenIdx = idx;
      // web ledger: hotels share page 3 with transport
      if (this._webMag()) { this.render(); this.magGoto(2); return; }
      this.bumpModal();
    }
    closeAccom() { this.accomOpenIdx = null; this.bumpModal(); }
    openTransport(idx) {
      // web ledger: transport is inline on page 3 (same stop selector as hotels)
      if (this._webMag()) { this.accomOpenIdx = idx; this.render(); this.magGoto(2); return; }
      this.transportOpenIdx = idx; this.bumpModal();
    }
    closeTransport() { this.transportOpenIdx = null; this.bumpModal(); }
    ensureItinerary(stop) {
      if (!Array.isArray(stop.itinerary)) stop.itinerary = [];
      const days = Math.max(1, Number(stop.nights) || 1);
      while (stop.itinerary.length < days) stop.itinerary.push({ items: [], outfits: [] });
      stop.itinerary.forEach(d => { if (!Array.isArray(d.outfits)) d.outfits = []; if (!Array.isArray(d.items)) d.items = []; });
      return stop.itinerary;
    }
    addDayItem(stop, dayIdx) { this.ensureItinerary(stop); stop.itinerary[dayIdx].items.push({ time: '', text: '' }); this.bump(); }
    removeDayItem(stop, dayIdx, itemIdx) { stop.itinerary[dayIdx].items.splice(itemIdx, 1); this.bump(); }
    addAccomOption(stopIdx) { const s = this.currentTrip().stops[stopIdx]; if (!s.accom) s.accom = { options: [] }; s.accom.options.push({ id: Date.now(), name: '', link: '', totalPrice: '', features: '', distance: '', chosen: false }); this.bump(); }
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
      return new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
          const W = img.width, H = img.height;
          const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
          const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0);
          let d; try { d = ctx.getImageData(0, 0, W, H); } catch (e) { resolve(dataUrl); return; }
          const px = d.data;
          let hasAlpha = false;
          for (let i = 3; i < px.length; i += 4) { if (px[i] < 200) { hasAlpha = true; break; } }
          if (hasAlpha) { resolve(dataUrl); return; }
          const samp = (x, y) => { const i = (y * W + x) * 4; return [px[i], px[i + 1], px[i + 2]]; };
          const corners = [samp(0, 0), samp(W - 1, 0), samp(0, H - 1), samp(W - 1, H - 1)];
          const bg = corners.reduce((a, c) => [a[0] + c[0], a[1] + c[1], a[2] + c[2]], [0, 0, 0]).map(v => v / 4);
          for (let i = 0; i < px.length; i += 4) {
            const dr = px[i] - bg[0], dg = px[i + 1] - bg[1], db = px[i + 2] - bg[2];
            const dist = Math.sqrt(dr * dr + dg * dg + db * db);
            if (dist < 42) px[i + 3] = 0; else if (dist < 85) px[i + 3] = Math.round((dist - 42) / 43 * 255);
          }
          ctx.putImageData(d, 0, 0); resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
      });
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
      }

      const html = web
        ? this.renderLedger(trip, meta, travelers, d, fmt, nights, budget, milesNeeded)
        : `
        <div class="page" style="position:relative">
          ${this.renderMeta(trip, travelers)}
          <div class="body-cols">
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
            <aside class="aside">
              ${this.renderSummary(nights, budget.grandTotal, budget.perPerson, milesNeeded, meta.milesBalance || 0, travelers)}
              ${this.renderPackBlock(trip)}
              ${this.renderTodos(meta)}
            </aside>
          </div>
          <div class="placed-stickers-layer">${this.renderPlacedStickers()}</div>
        </div>
      `;
      this.root.innerHTML = html;
      this.modalEl.innerHTML = web
        ? this.renderStickerPanel() +                          // leaves carry itinerary/accom/transport
          this.renderBudgetModal(budget, travelers, nights) +  // the bill prints over the panel area
          this.renderSyncModal()
        : this.renderStickerPanel() +
          this.renderItineraryModal(trip, d, fmt) +
          this.renderAccomModal(trip, d, fmt) +
          this.renderTransportModal(trip) +
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
            <aside class="pk-panel">${this.renderPackPanel(trip)}</aside>
            <div class="pk-wrap">${this.renderPackBody(trip)}</div>
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
      const keys = Object.keys(this.data.trips);
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
          <div class="stat-half"><div class="fig">${nights}</div><div class="cap">night${nights === 1 ? '' : 's'}</div></div>
          <div class="stat-half stat-travelers">${this.travelersPip(travelers)}</div>
        </div>
        ${SHOW_COSTS ? `<div class="stat cash clickable" data-act="open-budget" title="See budget breakdown">
          <div class="fig">${esc(money(grand))}</div><div class="cap">total · ${esc(money(perPerson))} / person</div></div>
        <div class="stat miles${covered ? ' covered' : ''}"><div class="fig">${miles.toLocaleString()}</div><div class="cap">reward points needed</div></div>` : ''}
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
      if (!stop) return `<div class="ss-hint">Hover a pin on the map to preview a stop — or hit <b>+</b> to add one.</div>`;
      const r = d ? d.stops[idx] : null;
      const nightsN = Math.max(1, Number(stop.nights) || 1);
      const leg = stop.leg || {};
      const modeLbl = (MODE_OPTIONS.find(o => o.value === leg.mode) || {}).label || '';
      const chosen = (stop.accom && stop.accom.options || []).filter(o => o.chosen && o.name && o.name.trim()).map(o => o.name.trim());
      return `<div class="ss-card">
        <div class="ss-top">
          <span class="ss-num">${idx + 1}</span>
          <input class="city" value="${escA(stop.city)}" data-ch="stop-city" data-i="${idx}" placeholder="City name…">
          <button class="ss-x" data-act="stop-delete" data-i="${idx}" title="Remove stop" aria-label="Remove stop">${svg(I.trash, { w: 13, h: 13, sw: 2.2 })}</button>
        </div>
        <div class="ss-dates">${r ? esc(fmt(r.start) + ' → ' + fmt(r.end)) + ` · ${nightsN} night${nightsN === 1 ? '' : 's'}` : `${nightsN} night${nightsN === 1 ? '' : 's'}`}</div>
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
      const ends = { tech: [258, 398], toiletries: [344, 268], documents: [425, 289], clothes: [222, 430], shoes: [305, 452], extras: [388, 424] };
      const leads = PACK_SLOTS.map((s, i) => {
        const x0 = Math.round(s.cx * 640), y0 = Math.round(s.cy * 560 + 26);
        const [x1, y1] = ends[s.k];
        const d = `transition-delay:${140 + i * 90}ms`;
        return `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" style="${d}"/><circle cx="${x1}" cy="${y1}" r="2.4" style="${d}"/>`;
      }).join('');
      const slots = PACK_SLOTS.map((s, i) => {
        const list = pack[s.k] || [];
        const done = list.filter(x => x.done).length;
        return `<div class="pk-slot${this.packOpen === s.k ? ' open' : ''}" data-slot="${s.k}" style="left:${s.cx * 100}%;top:${s.cy * 100}%;transition-delay:${220 + i * 90}ms">
          <div class="pk-chip"><span class="pk-lab">${esc(s.label)}</span><span class="pk-cnt${list.length && done === list.length ? ' full' : ''}">${list.length ? done + '/' + list.length : '+ add'}</span></div>
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
      const endpoint = linked ? this.endpointUrl(this.sync.id) : '';
      const body = linked ? `
        <p class="sync-lead">Synced to your textdb endpoint. On your other device, open <b>Sync</b> and paste the <b>same</b> link below to load these trips.</p>
        <label class="sync-field-lbl">Your endpoint (paste this on the other device)</label>
        <div class="sync-code-row">
          <input class="sync-code-out" value="${escA(endpoint)}" readonly data-act="sync-select">
          <button class="sync-btn" data-act="sync-copy">Copy</button>
        </div>
        <div class="sync-row">
          <span class="sync-status ${statusCls}">${esc(this.syncStatusLabel())}</span>
          <span class="sync-when">${esc(when)}</span>
        </div>
        <div class="sync-actions">
          <button class="sync-btn primary" data-act="sync-now"${this._syncBusy ? ' disabled' : ''}>Sync now</button>
          <button class="sync-btn ghost" data-act="sync-unlink">Disconnect this device</button>
        </div>
        <a class="sync-btn open-web-btn" href="${escA(this.hostedWebUrl())}" target="_blank" rel="noopener">Open the web version ↗</a>
        <p class="sync-note">Opens the hosted planner already linked to this device — edits flow both ways.</p>
        <p class="sync-note">Trips live at this public endpoint. Anyone with the link can read or change them — treat it like a shared password. Offline edits upload automatically when you reconnect.</p>
        <p class="sync-note">Auto-link another copy: open it with <code>?sync=${escA(this.sync.id)}</code> appended to its address (works for the installed app and the hosted standalone page alike). Copies served from the <b>same host</b> share edits live without any setup.</p>
      ` : `
        <p class="sync-lead">Create one free storage endpoint (no account, no email), then paste it on both devices. This device sets it up; the other one loads from it.</p>
        <ol class="sync-steps">
          <li>Open <a href="https://textdb.dev" target="_blank" rel="noopener" class="sync-link">textdb.dev ↗</a> and copy the <b>API URL</b> it shows (looks like <code>textdb.dev/api/data/…</code>).</li>
          <li>Paste it below and tap <b>Connect</b>.</li>
          <li>Do the same with the <b>same link</b> on your other device.</li>
        </ol>
        <div class="sync-code-row">
          <input class="sync-code-in" placeholder="Paste your textdb endpoint / link" data-ch="sync-code-in" value="${escA(this._syncCodeDraft || '')}">
          <button class="sync-btn primary" data-act="sync-connect"${this._syncBusy ? ' disabled' : ''}>Connect</button>
        </div>
        <div class="sync-row"><span class="sync-status ${statusCls}">${esc(this.syncStatusLabel())}</span></div>
        <p class="sync-note">Your trips are stored at this public endpoint so both devices can reach them. Anyone with the link can view or edit it, so keep it private.</p>
        <div class="sync-or">or</div>
        <button class="sync-btn open-web-btn" data-act="open-web"${this._syncBusy ? ' disabled' : ''}>Open the web version, synced ↗</button>
        <p class="sync-note">One tap: creates a sync endpoint automatically and opens the hosted planner already linked to this device — edits then flow both ways.</p>
      `;
      return `<div class="overlay" data-act="overlay-sync">
        <div class="dialog sync-dialog" data-stop>
          <div class="head"><div class="row">
            <div style="flex:1">
              <div class="eyebrow">Cross-device sync</div>
              <div class="sync-title">${linked ? 'Synced' : 'Set up sync'}</div>
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
      else if (this.accomOpenIdx != null) { this.closeAccom(); }
      else if (this.transportOpenIdx != null) { this.closeTransport(); }
      else if (this.openStopIdx != null) { this.closeStop(); }
    }

    onClick(e) {
      // a click outside the packing slots AND the docked panel clears the checklist
      if (this.packOpen != null && !(e.target.closest && e.target.closest('.pk-slot, .pk-panel'))) {
        this.packOpen = null;
        this._paintPackPanel();
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
        case 'sync-create': this.createSync(); break;
        case 'sync-connect': { const inp = this.modalEl.querySelector('.sync-code-in'); this.connectEndpoint(inp ? inp.value : this._syncCodeDraft); break; }
        case 'sync-link': { const inp = this.modalEl.querySelector('.sync-code-in'); this.linkSync(inp ? inp.value : this._syncCodeDraft); break; }
        case 'sync-now': this.syncNow(); break;
        case 'open-web': this.openHostedWeb(); break;
        case 'sync-unlink': if (confirm('Unlink this device? Your trips stay here but stop syncing with other devices.')) this.unlinkSync(); break;
        case 'sync-select': if (t.select) t.select(); break;
        case 'sync-copy': {
          const inp = this.modalEl.querySelector('.sync-code-out');
          if (inp) {
            inp.select();
            try { navigator.clipboard.writeText(inp.value); } catch (err) { try { document.execCommand('copy'); } catch (e2) {} }
            this.setSyncStatus('synced', 'Code copied');
          }
          break;
        }
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
      const dialogEl = hitEl && hitEl.closest ? hitEl.closest('[data-sticker-target]') : null;
      if (dialogEl) {
        let target = dialogEl.dataset.stickerTarget;
        if (target.startsWith('iti-') && this.activeDay != null) target = target + '-day-' + this.activeDay;
        this.placeSticker(stockId, clientX - 40, clientY - 40, target);
        return true;
      }
      const pageEl = this.root.querySelector('.page');
      if (pageEl) {
        const rect = pageEl.getBoundingClientRect();
        this.placeSticker(stockId, clientX - rect.left - 40, clientY - rect.top - 40, 'page');
        return true;
      }
      return false;
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
