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
          { city: 'Budapest', nights: 4, note: '', leg: { mode: 'flying-blue', duration: '~2h15m AF · same ticket as flight home', cost: 0, miles: 0 } },
          { city: 'Paris', nights: 2, note: '', leg: { mode: 'flying-blue', duration: '9h45m nonstop · Air France', cost: 220, miles: 0 } }
        ],
        homeLabel: 'Vancouver (YVR)'
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
          { city: 'Stockholm', nights: 4, note: '', leg: { mode: 'flying-blue', duration: '~2h40m AF · same ticket as flight home', cost: 0, miles: 0 } },
          { city: 'Paris', nights: 2, note: '', leg: { mode: 'flying-blue', duration: '9h45m nonstop · Air France', cost: 220, miles: 0 } }
        ],
        homeLabel: 'Vancouver (YVR)'
      }
    }
  };

  const MODE_OPTIONS = [
    { value: 'flight', label: 'Flight' },
    { value: 'flying-blue', label: 'Rewards' },
    { value: 'train', label: 'Train' },
    { value: 'bus', label: 'Bus' }
  ];
  const MODE_HEX = { 'flight': '#91040C', 'train': '#5E8475', 'bus': '#4A7098', 'overnight-train': '#46604F', 'flying-blue': '#C8901F' };

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
    'toronto': [43.6532, -79.3832], 'montreal': [45.5017, -73.5673], 'los_angeles': [34.0522, -118.2437]
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
    reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    sync: '<path d="M21 12a9 9 0 0 0-15-6.7L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 15 6.7L21 16"/><path d="M21 21v-5h-5"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 9l5-5 5 5"/><path d="M12 4v12"/>',
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
    route: '<rect x="3" y="4" width="18" height="14" rx="3"/><path d="M3 10h18"/><rect x="7" y="6" width="4" height="3" rx="1"/><rect x="13" y="6" width="4" height="3" rx="1"/><path d="M7 18l-2 3"/><path d="M17 18l2 3"/>'
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
      this.mainPinsOverlayEl.className = 'main-pins-overlay';
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
      this.render();
      this.ensureMap(0);
      this.initIntro();
      this.initTouchPointer();
      // crossing the mobile-map breakpoint (resizing an iPad window, rotating)
      // swaps pins-only popup mode ↔ floating cards live
      try {
        window.matchMedia('(max-width: 700px)').addEventListener('change', () => {
          this._openMapCardIdx = null; this._openMapCardFlipped = false;
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
        <button class="intro-hint" aria-label="Continue to the planner"><span>scroll</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
        </button>`;
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
      };
      const unpark = () => {
        if (!parked) return;
        parked = false;
        overlay.classList.remove('intro-parked');
        appRoot.style.willChange = 'transform';
        document.documentElement.classList.add('intro-lock');
      };
      const apply = () => {
        raf = 0;
        cur += (target - cur) * 0.32;                    // tight tracking — reads as native scroll
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
        if (t && t.closest && t.closest('.overlay, .sticker-panel')) return false;
        let el = t instanceof Element ? t : null;
        while (el && el !== document.body) { if (el.scrollTop > 1) return false; el = el.parentElement; }
        return (window.scrollY || document.documentElement.scrollTop || 0) <= 1;
      };
      const onWheel = (e) => {
        if (parked) {
          if (e.deltaY < 0 && atAppTop(e.target)) {      // pull the intro back down
            e.preventDefault();
            target = clamp01(target + e.deltaY / window.innerHeight);
            kick();
          }
          return;                                        // otherwise: native scroll
        }
        e.preventDefault();
        target = clamp01(target + e.deltaY / window.innerHeight);   // ~1:1 with the wheel
        kick();
      };
      let touchY = null, touchV = 0, touchT = 0, touchDriving = false;
      const onTouchStart = (e) => { touchY = e.touches[0].clientY; touchV = 0; touchT = e.timeStamp; touchDriving = !parked; };
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
          target = clamp01(target + touchV * 260 / window.innerHeight);   // flick inertia, no snapping
          kick();
        }
        touchY = null; touchDriving = false;
      };
      document.addEventListener('wheel', onWheel, { passive: false, capture: true });
      document.addEventListener('touchstart', onTouchStart, { passive: true, capture: true });
      document.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
      document.addEventListener('touchend', onTouchEnd, { passive: true, capture: true });
      const onKey = (e) => {
        if (document.activeElement === textEl) return;   // typing in the headline
        if (parked) {
          if ((e.key === 'ArrowUp' || e.key === 'PageUp') && atAppTop(e.target)) { e.preventDefault(); target = 0; kick(); }
          return;
        }
        if (e.key === ' ' || e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === 'Enter') { e.preventDefault(); target = 1; kick(); }
        else if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); target = 0; kick(); }
      };
      document.addEventListener('keydown', onKey, true);
      overlay.querySelector('.intro-hint').addEventListener('click', () => { target = 1; kick(); });
      // tests / power users: jump straight to the app
      this._introSkip = () => { target = 1; cur = 1; apply(); };
    }
    skipIntro() { if (this._introSkip) this._introSkip(); }

    // Transparent wireframe globe (orthographic): graticule + continent outlines
    // + every stop as a red dot, consecutive stops linked by dashed route lines.
    _buildIntroGlobe(svg) {
      if (!svg) return;
      const W = 400, R = 186, CX = 200, CY = 200;
      const stops = this.currentTrip().stops
        .map(s => this.resolveCoord(s.city))
        .filter(Boolean);
      // center the view on the trip so the stops face us (fallback: Europe)
      const lat0 = (stops.length ? stops.reduce((a, c) => a + c[0], 0) / stops.length : 47) * Math.PI / 180;
      const lng0 = (stops.length ? stops.reduce((a, c) => a + c[1], 0) / stops.length : 12) * Math.PI / 180;
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
      const ink = '#23140C';
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
      out += `<g stroke="#91040C" stroke-width="1.2" stroke-dasharray="4 4" opacity=".8">${links}</g>`;
      out += `<g fill="#91040C">${pj.filter(Boolean).map(p => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4.2"/>`).join('')}</g>`;
      svg.innerHTML = out;
    }

    currentTrip() { return this.data.trips[this.data.active]; }
    legByIndex(i) { const t = this.currentTrip(); return i === 0 ? t.outboundLeg : t.stops[i - 1].leg; }

    bump() { this.render(); this.scheduleSave(); this.touchMap(); if (this._introGlobeRefresh) this._introGlobeRefresh(); }
    bumpModal() {
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
    }
    // attach the persistent day-map node into the freshly-rendered modal and (re)init Leaflet
    mountDayMap() {
      const dayHolder = this.modalEl.querySelector('#day-map-holder');
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
      Object.values(d.trips || {}).forEach(trip => {
        // Reset outbound leg from flying-blue to flight (seed data previously defaulted to flying-blue)
        if (trip.outboundLeg && trip.outboundLeg.mode === 'flying-blue') {
          trip.outboundLeg.mode = 'flight';
          trip.outboundLeg.cost = trip.outboundLeg.cost || 0;
          delete trip.outboundLeg.miles;
        }
        // Zero out the default seed miles (25000) on any flying-blue leg that still carries it unchanged
        (trip.stops || []).forEach(s => {
          if (s.leg && s.leg.mode === 'flying-blue' && s.leg.miles === 25000 && !s._milesEdited) s.leg.miles = 0;
        });
        const legs = [trip.outboundLeg, ...(trip.stops || []).map(s => s.leg)];
        legs.forEach(l => { if (l && l.mode === 'flying-blue' && l.miles == null) l.miles = 0; });
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
      // don't clobber an itinerary/accom/budget modal the user is mid-edit in;
      // an explicit "Sync now" (force) still goes through.
      const editingOpen = (this.openStopIdx != null || this.accomOpenIdx != null || this.budgetOpen);
      if (!opts.force && editingOpen) return;
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
      // same guard as pullCloud: never clobber a modal mid-edit — retry after it closes
      if (this.openStopIdx != null || this.accomOpenIdx != null || this.budgetOpen) {
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
      const dot = this.root && this.root.querySelector('.sync-dot');
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
      return null;
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
      if (this.mainLeafletMap) {
        this.mainLeafletMap.invalidateSize();
        setTimeout(() => this.renderMainMap(), 250);
      }
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
          radius: ep ? 6 : 8, color: ep ? '#23140C' : '#91040C', weight: ep ? 2 : 0,
          fillColor: ep ? '#ffffff' : '#91040C', fillOpacity: 1,
          className: ep ? '' : 'map-stop-dot'
        });
        if (!ep && stopIdx != null) marker.on('click', () => this.openStop(stopIdx));
        this.mapMarkers.addLayer(marker);
      });
      for (let i = 0; i < resolved.length - 1; i++) {
        const a = resolved[i], b = resolved[i + 1], leg = legs[i];
        if (!a.coord || !b.coord) continue;
        const color = MODE_HEX[leg.mode] || '#7a7260';
        const dashed = leg.mode === 'flight' || leg.mode === 'flying-blue';
        this.mapLines.addLayer(L.polyline([a.coord, b.coord], { color, weight: 3, opacity: .85, dashArray: dashed ? '6 6' : null }));
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
          { style: { fillColor: '#23140C', fillOpacity: 1, color: '#47403a', weight: 3, opacity: 1, lineJoin: 'round', lineCap: 'round' } }
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
        L.polyline(polyCoords, { color: '#23140C', weight: 2.2, opacity: 0.65 }).addTo(this.mainMapLines);
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

    _legFields(leg, legIdx) {
      const isFB = leg.mode === 'flying-blue';
      const opts = MODE_OPTIONS.map(o => `<option value="${o.value}"${o.value === leg.mode ? ' selected' : ''}>${o.label}</option>`).join('');
      return `<div class="map-leg-row">
        <span class="mode-dot" style="background:${MODE_HEX[leg.mode] || '#7a7260'}"></span>
        <select data-ch="leg-mode" data-leg="${legIdx}">${opts}</select>
        <input class="dur" value="${escA(leg.duration)}" data-ch="leg-dur" data-leg="${legIdx}" placeholder="notes">
        ${SHOW_COSTS ? `<span class="cost-wrap${isFB ? ' cost-wrap--fb' : ''}">
          <input class="cost" type="text" inputmode="numeric" value="${escA(isFB ? (leg.miles ?? 0) : (leg.cost ?? 0))}" data-ch="leg-cost" data-leg="${legIdx}">
          <span class="unit">${isFB ? 'mi/pp' : '$/pp'}</span></span>` : ''}
      </div>`;
    }

    _renderMainMapCardHTML(stops, legs, d, fmt) {
      let html = '';
      stops.forEach((stop, idx) => {
        const r = d ? d.stops[idx] : null;
        const chosen = (stop.accom && stop.accom.options || []).find(o => o.chosen);
        const accomSet = !!(chosen && chosen.name && chosen.name.trim());
        const modeColor = MODE_HEX[(legs[idx] || {}).mode] || '#7a7260';
        const dim = this._dragStopIdx === idx ? 0.38 : 1;
        html += `<div class="stop map-stop" data-i="${idx}" style="opacity:${dim}">
          <div class="card mc-flip">
            <div class="mc-front">
              <span class="mc-mode-pip" style="background:${modeColor}"></span>
              <div class="mc-city-display">${stop.city ? esc(stop.city) : '<span style="opacity:.3">City?</span>'}</div>
              <div class="mc-meta">
                ${r ? `<div class="mc-dates-display">${esc(fmt(r.start))} – ${esc(fmt(r.end))}</div>` : (stop.nights ? `<div class="mc-dates-display">${stop.nights} nights</div>` : '')}
                ${accomSet ? `<div class="mc-hotel-display">${esc(chosen.name)}</div>` : ''}
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
        linesHTML += `<line x1="${pinPt.x.toFixed(1)}" y1="${pinPt.y.toFixed(1)}" x2="${cx.toFixed(1)}" y2="${cy.toFixed(1)}" stroke="oklch(40% 0.012 70)" stroke-width="0.9" stroke-dasharray="5 4" opacity="0.28"/>`;
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
    ensureDayMap(tries) {
      if (!this.dayMapEl.isConnected || !window.L) { if ((tries || 0) < 80) setTimeout(() => this.ensureDayMap((tries || 0) + 1), 100); return; }
      if (this.dayMap) { this.dayMap.invalidateSize(); this.renderDayMap(); return; }
      const L = window.L;
      this.dayMap = L.map(this.dayMapEl, { scrollWheelZoom: false, zoomSnap: .25, zoomDelta: .5, wheelPxPerZoomLevel: 120, inertia: true, attributionControl: false });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, detectRetina: true }).addTo(this.dayMap);
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
      if (pts.length > 1) this.dayLines.addLayer(L.polyline(pts, { color: '#ffffff', weight: 1.5, opacity: .35, dashArray: '5 6' }));   // white so the route reads on the black night map
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
      this._editingStopIdx = idx;
      if (this._mobileMap()) { this._openMapCardIdx = idx; this._openMapCardFlipped = true; }   // new stop pops up in edit mode
      this.bump();
    }
    removeStop(idx) {
      this.snapshot(); this.currentTrip().stops.splice(idx, 1);
      if (this.openStopIdx === idx) this.openStopIdx = null;
      if (this._openMapCardIdx != null) { this._openMapCardIdx = null; this._openMapCardFlipped = false; }
      this.bump();
    }
    reorderStop(from, to) {
      if (from === to) return;
      const st = this.currentTrip().stops; const [it] = st.splice(from, 1); st.splice(to, 0, it);
      if (this.openStopIdx === from) this.openStopIdx = to;
      if (this._openMapCardIdx === from) this._openMapCardIdx = to;   // popup follows its stop
      this.bump();
    }
    resetRoute() {
      if (!confirm('Reset this route to its default state? This cannot be undone.')) return;
      this.snapshot();
      this.data.trips[this.data.active] = clone(DEFAULT_STATE.trips[this.data.active] || Object.values(DEFAULT_STATE.trips)[0]);
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
    openStop(idx) { this.openStopIdx = idx; this.activeDay = null; this._optimizeNote = null; this._selectedItem = null; this.bumpModal(); }
    closeStop() { this.openStopIdx = null; this.bumpModal(); }
    openAccom(idx) { this.accomOpenIdx = idx; this.bumpModal(); }
    closeAccom() { this.accomOpenIdx = null; this.bumpModal(); }
    openTransport(idx) { this.transportOpenIdx = idx; this.bumpModal(); }
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
    chooseAccomOption(stopIdx, optIdx) { const o = this.currentTrip().stops[stopIdx].accom.options; o.forEach((x, i) => x.chosen = (i === optIdx ? !x.chosen : false)); this.bump(); }

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
    exportState() {
      const blob = new Blob([JSON.stringify(this.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'europe-trip-state.json';
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    }
    importFile(e) {
      const file = e.target.files[0]; if (!file) return;
      if (!confirm('Import will replace your current trip data. Continue?')) { e.target.value = ''; return; }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result);
          if (!parsed.trips || !parsed.meta) throw new Error('bad');
          this.snapshot();
          this.data = parsed; this.migrate(); this._lastCoordKey = ''; this.bump();
        } catch (err) { alert('Could not read that file — make sure it is a JSON export from this tool.'); }
      };
      reader.readAsText(file); e.target.value = '';
    }

    /* ---------- budget computation ---------- */
    computeBudget(trip, travelers, nights) {
      const meta = this.data.meta;
      const legs = [trip.outboundLeg, ...trip.stops.map(s => s.leg)];
      const bud = meta.budget;
      const flightCost = legs.reduce((s, l) => s + (l.mode === 'flight' ? (Number(l.cost) || 0) : 0), 0) * travelers;
      const intercityCost = legs.reduce((s, l) => s + (l.mode !== 'flight' && l.mode !== 'flying-blue' ? (Number(l.cost) || 0) : 0), 0) * travelers;
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
        const chosen = ((st.accom && st.accom.options) || []).find(o => o.chosen);
        const amt = chosen ? parseAmt(chosen.totalPrice) : 0;
        if (chosen && amt > 0) { anyChosenPrice = true; lodgingFromHotels += amt; hotelNightsCovered += Number(st.nights) || 0; lodgingParts.push(`${st.city} $${Math.round(amt)}`); }
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
      const milesNeeded = legs.reduce((s, l) => s + (l.mode === 'flying-blue' ? (Number(l.miles) || 0) : 0), 0) * travelers;
      const budget = this.computeBudget(trip, travelers, nights);

      let dateRangeStr = '';
      if (d) { const days = Math.max(0, Math.round((d.home - d.origin) / 86400000)); dateRangeStr = fmt(d.origin) + ' – ' + fmt(d.home) + ' · ' + days + ' days'; }

      const html = `
        <div class="page" style="position:relative">
          ${this.renderHeader(meta, dateRangeStr)}
          ${this.renderTabs()}
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
              ${this.renderSummary(nights, budget.grandTotal, budget.perPerson, milesNeeded, meta.milesBalance || 0)}
              ${this.renderTodos(meta)}
            </aside>
          </div>
          <div class="placed-stickers-layer">${this.renderPlacedStickers()}</div>
        </div>
      `;
      this.root.innerHTML = html;
      this.modalEl.innerHTML =
        this.renderStickerPanel() +
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
        // Invalidate after layout so Leaflet reads the correct dimensions
        setTimeout(() => {
          if (this.mainLeafletMap) {
            this.mainLeafletMap.invalidateSize();
            this.renderMainMap();
          }
        }, 50);
      }
      // re-attach the per-day itinerary map (it lives inside the modal root)
      this.mountDayMap();
      this.paintSaved();
    }

    renderHeader(meta, dateRangeStr) {
      return `<div class="header">
        <span class="saved" style="opacity:0">saved</span>
        <div class="toolbar">
          <button class="tool-btn" data-act="undo" title="Undo (⌘Z)" aria-label="Undo" ${!this._history.length ? 'disabled' : ''}>${svg(I.undo)}<span class="tool-lbl">Undo</span></button>
          <button class="tool-btn sync-toggle-btn${this.isLinked() ? ' active' : ''}" data-act="open-sync" title="Sync across devices" aria-label="Sync across devices"><span class="sync-dot s-${this.isLinked() ? this._syncStatus : 'off'}"></span>${svg(I.sync)}<span class="tool-lbl">Sync</span></button>
          <div class="toolbar-divider"></div>
          <button class="tool-btn sticker-toggle-btn${this.stickerPanelOpen ? ' active' : ''}" data-act="toggle-stickers" title="Memories" aria-label="Memories">${svg(I.sticker)}<span class="tool-lbl">Memory</span></button>
        </div>
      </div>`;
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
      return `<div class="tabs-row"><div class="tabs">${pills}</div>
        <button class="add-trip" data-act="add-trip" title="Add a trip" aria-label="Add a trip">+</button></div>`;
    }

    renderMeta(trip, travelers) {
      return `<div class="meta-row">
        <div class="meta-field"><label>Depart</label><input type="date" value="${escA(trip.depart)}" data-ch="depart"></div>
        <div class="meta-field"><label>Return</label><input type="date" value="${escA(trip.returnDate)}" data-ch="return"></div>
        <div class="meta-field">
          <label>Travelers</label>
          <div class="travelers-pip">
            ${Array.from({ length: travelers }, () => `<button class="traveler-icon" data-act="traveler-dec" title="Remove traveler"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="7" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg></button>`).join('')}
            <button class="traveler-add" data-act="traveler-inc" title="Add traveler">+</button>
          </div>
        </div>
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
        leadersSvg += `<line x1="${sx}" y1="${sy}" x2="${ccx.toFixed(1)}" y2="${ccy.toFixed(1)}" stroke="oklch(40% 0.012 70)" stroke-width="0.9" stroke-dasharray="5 4" opacity="0.28"/>`;
        dotsSvg += `<circle cx="${sx}" cy="${sy}" r="11" style="fill:var(--red)" stroke="oklch(97% 0.005 60)" stroke-width="2"/>`;
      });

      const bgSvg = `<svg class="map-bg" viewBox="0 0 740 480" xmlns="http://www.w3.org/2000/svg">
        <rect width="740" height="480" fill="oklch(95.5% 0.004 70)"/>
        <!-- Continental Europe + Iberia -->
        <path fill="oklch(91% 0.008 70)" stroke="oklch(75% 0.01 70)" stroke-width="0.7" d="
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
        <path fill="oklch(91% 0.008 70)" stroke="oklch(75% 0.01 70)" stroke-width="0.7" d="
          M 338 82 L 302 80 L 270 32 L 266 0 L 476 0 L 495 54 L 450 116 L 404 128 L 370 87 Z"/>
        <!-- Great Britain -->
        <path fill="oklch(91% 0.008 70)" stroke="oklch(75% 0.01 70)" stroke-width="0.7" d="
          M 88 70 C 110 66 158 95 202 215 C 188 229 170 232 76 240
          C 82 202 90 148 80 130 C 72 108 70 82 88 70 Z"/>
        <!-- Ireland -->
        <path fill="oklch(91% 0.008 70)" stroke="oklch(75% 0.01 70)" stroke-width="0.7" d="
          M 52 130 L 70 134 L 65 192 L 31 208 L 4 213 L 2 150 Z"/>
        ${routeD ? `<path d="${routeD}" fill="none" stroke="oklch(22% 0.025 70)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
        ${leadersSvg}${dotsSvg}
      </svg>`;

      // ---- stop cards + HTML pin overlays (absolutely positioned) ----
      let cardsHtml = '', pinsHtml = '';
      stops.forEach((stop, idx) => {
        const [sx, sy] = positions[idx];
        const right = idx % 2 === 0;
        const dim = this._dragStopIdx === idx ? .38 : 1;
        const r = d ? d.stops[idx] : null;
        const chosen = (stop.accom && stop.accom.options || []).find(o => o.chosen);
        const accomLabel = chosen ? chosen.name : 'Add accommodation';
        const accomSet = !!(chosen && chosen.name && chosen.name.trim());

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
                ${accomSet ? `<div class="mc-hotel-display">${esc(chosen.name)}</div>` : ''}
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

    renderSummary(nights, grand, perPerson, miles, balance) {
      const covered = miles > 0 && balance >= miles;
      return `<div class="summary">
        <div class="stat"><div class="fig">${nights}</div><div class="cap">nights on the ground</div></div>
        ${SHOW_COSTS ? `<div class="stat cash clickable" data-act="open-budget" title="See budget breakdown">
          <div class="fig">${esc(money(grand))}</div><div class="cap">total budget · ${esc(money(perPerson))} / person</div></div>
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
            ${svg(I.plus, { w: 14, h: 14, sw: 2.2, stroke: '#C8901F' })}<span>Add</span>
          </div>
          <div class="add-outfit paste-tile" data-act="sticker-paste" tabindex="0" title="Paste a copied/lifted image">
            ${svg(I.clipboard, { w: 14, h: 14, sw: 2, stroke: '#C8901F' })}<span>Paste</span>
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

    renderItineraryModal(trip, d, fmt) {
      if (this.openStopIdx == null || !trip.stops[this.openStopIdx]) return '';
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
              <div class="field">${svg(I.pin, { w: 11, h: 11, stroke: '#a89e8c' })}<input value="${escA(it.address)}" data-ch="item-address" data-i="${ii}" placeholder="Address">${hasAddr ? `<a class="maps" href="https://maps.google.com/?q=${encodeURIComponent(it.address || '')}" target="_blank" rel="noopener" title="Open in Maps">↗</a>` : ''}</div>
              <div class="field">${svg(I.msg, { w: 11, h: 11, stroke: '#a89e8c' })}<input value="${escA(it.note)}" data-ch="item-note" data-i="${ii}" placeholder="Note"></div>
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
        dayBlock = `<div class="iti-foot">
          <div class="day-cols">
            <div class="day-main">
              <div class="day-head">
                <div class="day-title">Day ${activeDay + 1}${dayDate(activeDay) ? ' · ' + esc(dayDate(activeDay)) : ''}</div>
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
          <div class="iti-body">
            <div class="iti-left">
              <div class="cal">${cal}</div>
              <div class="closet">
                <div class="hd"><div class="t">Closet</div><span class="hint">add an outfit, then drag it onto any date</span></div>
                <div class="strip">${stripCells}
                  <div class="add-outfit" data-act="closet-add" data-drop="closet-zone" tabindex="0" title="Paste, drop, or tap to add an outfit">
                    ${svg(I.plus, { w: 16, h: 16, sw: 2.2, stroke: '#C8901F' })}<span>Add</span></div>
                  <div class="add-outfit paste-tile" data-act="closet-paste" tabindex="0" title="Paste a copied/lifted image">
                    ${svg(I.clipboard, { w: 15, h: 15, sw: 2, stroke: '#C8901F' })}<span>Paste</span></div>
                  <input type="file" accept="image/*" class="closet-file" data-ch="closet-file" style="display:none">
                </div>
              </div>
            </div>
            ${hasDay ? `<div class="iti-right">${dayBlock}</div>` : ''}
          </div>
        </div>
        ${hasDay ? `<div class="placed-stickers-layer placed-stickers-layer--modal">${this.renderPlacedStickers('iti-' + sIdx + '-day-' + activeDay)}</div>` : ''}
      </div>`;
    }

    renderAccomModal(trip, d, fmt) {
      if (this.accomOpenIdx == null || !trip.stops[this.accomOpenIdx]) return '';
      const idx = this.accomOpenIdx; const stop = trip.stops[idx];
      if (!stop.accom) stop.accom = { options: [] };
      const range = d ? d.stops[idx] : null;
      const nightsN = Math.max(1, Number(stop.nights) || 1);
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
          <div class="accom-body">
            ${stop.accom.options.length === 0 ? `<p class="empty-note" style="margin:4px 0">No options yet — add one below to start researching.</p>` : ''}
            ${opts}
            <button class="add-option" data-act="accom-add" style="width:100%">+</button>
          </div>
        </div>
        <div class="placed-stickers-layer placed-stickers-layer--modal">${this.renderPlacedStickers('accom-' + idx)}</div>
      </div>`;
    }

    renderTransportModal(trip) {
      if (this.transportOpenIdx == null || !trip.stops[this.transportOpenIdx]) return '';
      const idx = this.transportOpenIdx;
      const leg = this.legByIndex(idx);
      const stop = trip.stops[idx];
      const isFB = leg.mode === 'flying-blue';
      const modeColor = MODE_HEX[leg.mode] || '#7a7260';
      const fmtCost = n => { const v = Number(n) || 0; return v >= 1000 ? v.toLocaleString('en-US') : (v || ''); };
      const pills = MODE_OPTIONS.map(o =>
        `<button class="t-pill${leg.mode === o.value ? ' active' : ''}" data-act="transport-mode" data-leg="${idx}" data-mode="${escA(o.value)}" style="${leg.mode === o.value ? `background:${modeColor};border-color:${modeColor}` : ''}">${esc(o.label)}</button>`
      ).join('');
      const idLabel = (leg.mode === 'flight' || isFB) ? 'Flight No.' : leg.mode === 'train' ? 'Train No.' : 'Line';
      const costLabel = isFB ? 'Miles / pp' : 'Cost / pp';
      const costUnit = isFB ? 'mi' : '$';
      const costVal = escA(fmtCost(isFB ? (leg.miles ?? 0) : (leg.cost ?? 0)));
      return `<div class="overlay" data-act="overlay-transport">
        <div class="dialog transport-dialog">
          <div class="head"><div class="row">
            <div style="flex:1;min-width:0">
              <div class="eyebrow">Getting there</div>
              <div class="transport-city">${esc(stop.city || 'Stop')}</div>
            </div>
            <button class="modal-x" data-act="close-transport">✕</button>
          </div></div>
          <div class="transport-body">
            <div class="t-pills">${pills}</div>
            <div class="t-row-3">
              <div class="t-fld">
                <label>Depart</label>
                <input class="t-line-inp" value="${escA(leg.departure || '')}" data-ch="transport-depart" data-leg="${idx}" placeholder="09:00">
              </div>
              <div class="t-fld">
                <label>Arrive</label>
                <input class="t-line-inp" value="${escA(leg.arrival || '')}" data-ch="transport-arrival" data-leg="${idx}" placeholder="17:30">
              </div>
              <div class="t-fld">
                <label>Transfer</label>
                <input class="t-line-inp t-transfer" type="number" min="0" value="${escA(leg.transfers ?? '')}" data-ch="transport-transfers" data-leg="${idx}" placeholder="0">
              </div>
            </div>
            <div class="t-row-2">
              <div class="t-fld">
                <label>${esc(idLabel)}</label>
                <input class="t-line-inp" value="${escA(leg.vehicleId || '')}" data-ch="transport-id" data-leg="${idx}" placeholder="—">
              </div>
              <div class="t-fld">
                <label>${esc(costLabel)}</label>
                <div class="t-cost-row">
                  <span class="t-unit">${costUnit}</span>
                  <input class="t-line-inp" inputmode="numeric" value="${costVal}" data-ch="transport-cost" data-leg="${idx}">
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>`;
    }

    renderBudgetModal(budget, travelers, nights) {
      if (!this.budgetOpen) return '';
      const lines = budget.lines.map(line => {
        const editable = !!line.key;
        let right;
        if (line.isOverride) right = `<div class="amt"><input type="text" inputmode="numeric" value="${escA(line.override)}" data-ch="budget-override" title="Auto-calculated · edit to override"></div>`;
        else right = `<div class="amt">${esc(line.total)}</div>`;
        const mid = editable ? `<div class="edit"><input type="text" inputmode="numeric" value="${escA(line.value)}" data-ch="budget-edit" data-key="${escA(line.key)}"><span class="u">${esc(line.unit)}</span></div>` : '';
        return `<div class="bline"><div class="info"><div class="l">${esc(line.label)}</div><div class="m">${esc(line.mult)}</div></div>${mid}${right}</div>`;
      }).join('');
      return `<div class="overlay" data-act="overlay-budget">
        <div class="dialog budget-dialog" data-stop>
          <div class="head"><div class="row">
            <div style="flex:1">
              <div class="eyebrow">Budget breakdown</div>
              <div class="budget-total">${esc(money(budget.grandTotal))}</div>
              <div class="budget-sub">${esc(money(budget.perPerson))} / person · ${travelers} travelers · ${nights} nights</div>
            </div>
            <button class="modal-x" data-act="close-budget">✕</button>
          </div></div>
          <div class="budget-body">
            ${lines}
            <div class="btotal"><div class="l">Total</div><div class="v">${esc(money(budget.grandTotal))}</div></div>
            <p class="budget-note">All figures in CAD. Flights &amp; intercity transport are pulled from your route legs; city public transport uses researched local-currency day passes converted to CAD. Edit any rate to refine — it updates live.</p>
          </div>
        </div>
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
      if (this.syncOpen) { this.syncOpen = false; this.bumpModal(); }
      else if (this.budgetOpen) { this.budgetOpen = false; this.bumpModal(); }
      else if (this.accomOpenIdx != null) { this.closeAccom(); }
      else if (this.transportOpenIdx != null) { this.closeTransport(); }
      else if (this.openStopIdx != null) { this.closeStop(); }
    }

    onClick(e) {
      const t = e.target.closest('[data-act]'); if (!t) return;
      const act = t.dataset.act;
      const i = t.dataset.i != null ? Number(t.dataset.i) : null;
      const key = t.dataset.key; const id = t.dataset.id;
      const trip = this.currentTrip();
      switch (act) {
        case 'undo': this.undo(); break;
        case 'reset': this.resetRoute(); break;
        case 'export': this.exportState(); break;
        case 'import': this.root.querySelector('.import-file').click(); break;
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
        case 'open-budget': this.budgetOpen = true; this.bumpModal(); break;
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
        case 'transport-mode': { const leg = this.legByIndex(Number(t.dataset.leg)); leg.mode = t.dataset.mode; if (leg.mode === 'flying-blue' && leg.miles == null) leg.miles = 25000; this.bump(); break; }
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
        case 'trip-title': meta.title = v; this.bump(); break;
        case 'tab-rename': this.data.trips[t.dataset.key].label = v; this.bump(); break;
        case 'depart': trip.depart = v; this.bump(); break;
        case 'return': trip.returnDate = v; this.bump(); break;
        case 'travelers': trip.travelers = Math.max(1, Number(v) || 1); this.bump(); break;
        case 'origin-label': trip.originLabel = v; this.bump(); break;
        case 'home-label': trip.homeLabel = v; this.bump(); break;
        case 'leg-mode': { const leg = this.legByIndex(Number(t.dataset.leg)); leg.mode = v; if (leg.mode === 'flying-blue' && leg.miles == null) leg.miles = 25000; this.bump(); break; }
        case 'leg-dur': this.legByIndex(Number(t.dataset.leg)).duration = v; this.bump(); break;
        case 'leg-cost': { const leg = this.legByIndex(Number(t.dataset.leg)); const num = Number((v+'').replace(/,/g,'')) || 0; if (leg.mode === 'flying-blue') leg.miles = num; else leg.cost = num; this.bump(); break; }
        case 'transport-cost': { const leg = this.legByIndex(Number(t.dataset.leg)); const num = Number(v.replace(/,/g, '')) || 0; if (leg.mode === 'flying-blue') leg.miles = num; else leg.cost = num; this.scheduleSave(); break; }
        case 'transport-depart': { this.legByIndex(Number(t.dataset.leg)).departure = v; this.scheduleSave(); break; }
        case 'transport-arrival': { this.legByIndex(Number(t.dataset.leg)).arrival = v; this.scheduleSave(); break; }
        case 'transport-transfers': { this.legByIndex(Number(t.dataset.leg)).transfers = Number(v) || 0; this.scheduleSave(); break; }
        case 'transport-id': { this.legByIndex(Number(t.dataset.leg)).vehicleId = v; this.scheduleSave(); break; }
        case 'stop-city': trip.stops[i].city = v; this.bump(); break;
        case 'stop-nights': trip.stops[i].nights = Number(v) || 0; this.bump(); break;
        case 'stop-order': { const newIdx = Math.max(0, Math.min(trip.stops.length - 1, (Number(v) || 1) - 1)); if (newIdx !== i) { this.snapshot(); this.reorderStop(i, newIdx); } break; }
        case 'todo-text': meta.todos[i].text = v; this.bump(); break;
        case 'import-file': this.importFile(e); break;
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
          padding: '7px 12px', borderRadius: '8px', background: '#23140C', color: '#fff',
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
    onDrop(e) {
      if (this._stockStickerDrag) {
        e.preventDefault();
        const dialogEl = e.target.closest('[data-sticker-target]');
        if (dialogEl) {
          let target = dialogEl.dataset.stickerTarget;
          if (target.startsWith('iti-') && this.activeDay != null) target = target + '-day-' + this.activeDay;
          this.placeSticker(this._stockStickerDrag, e.clientX - 40, e.clientY - 40, target);
        } else {
          const pageEl = this.root.querySelector('.page');
          if (pageEl) {
            const rect = pageEl.getBoundingClientRect();
            this.placeSticker(this._stockStickerDrag, e.clientX - rect.left - 40, e.clientY - rect.top - 40, 'page');
          }
        }
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
  }

  document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('app');
    const app = new Planner(root);
    window.__planner = app;
    app.init();
  });
})();
