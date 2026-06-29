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

  const STORAGE_KEY = 'europe-trip-state-v1';

  /* ---- cross-device cloud sync (kvdb.io — keyless public bucket) ----
     Why kvdb.io and not a JSON-bin: every request here is a CORS
     "simple request" (no custom headers → no preflight), and the new
     bucket id comes back in the response BODY, so we never depend on a
     CORS-exposed response header. That makes it work from a plain
     https page across browsers/networks where header-/preflight-based
     services silently fail with "Load failed" / "Failed to fetch". */
  const SYNC_KEY      = 'europe-trip-sync-v1';        // local record of the link {id, rev, lastSyncedAt}
  const SYNC_API      = 'https://kvdb.io';            // bucket store
  const SYNC_KEYNAME  = 'state';                      // key within the bucket that holds our payload
  const APP_TAG       = 'europe-trip-planner';        // payload marker so we only adopt our own data
  const SYNC_POLL_MS  = 20000;                        // how often to pull while the tab is visible
  const CLOUD_PUSH_DEBOUNCE_MS = 900;                 // coalesce rapid edits into one upload

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
        outboundLeg: { mode: 'flying-blue', duration: '8h20m nonstop · Delta', cost: 70, miles: 25000 },
        stops: [
          { city: 'Prague', nights: 4, note: '', leg: { mode: 'train', duration: '~6h direct', cost: 35 } },
          { city: 'Kraków', nights: 4, note: '', leg: { mode: 'overnight-train', duration: '~9h sleeper · saves a hotel night', cost: 80 } },
          { city: 'Budapest', nights: 4, note: '', leg: { mode: 'flying-blue', duration: '~2h15m AF · same ticket as flight home', cost: 0, miles: 0 } },
          { city: 'Paris', nights: 2, note: '', leg: { mode: 'flying-blue', duration: '9h45m nonstop · Air France', cost: 220, miles: 25000 } }
        ],
        homeLabel: 'Vancouver (YVR)'
      },
      scandinavia: {
        label: 'Scandinavia',
        depart: '2026-09-14', returnDate: '2026-09-30', travelers: 2,
        originLabel: 'New York (JFK)',
        outboundLeg: { mode: 'flying-blue', duration: '8h nonstop · Delta', cost: 70, miles: 25000 },
        stops: [
          { city: 'Copenhagen', nights: 2, note: '', leg: { mode: 'flight', duration: '~1h30m · SAS / Norwegian', cost: 130 } },
          { city: 'Bergen', nights: 3, note: '', leg: { mode: 'train', duration: '~6h45m · Bergen Railway (scenic)', cost: 90 } },
          { city: 'Oslo', nights: 4, note: '', leg: { mode: 'train', duration: '~5-6h', cost: 80 } },
          { city: 'Stockholm', nights: 4, note: '', leg: { mode: 'flying-blue', duration: '~2h40m AF · same ticket as flight home', cost: 0, miles: 0 } },
          { city: 'Paris', nights: 2, note: '', leg: { mode: 'flying-blue', duration: '9h45m nonstop · Air France', cost: 220, miles: 25000 } }
        ],
        homeLabel: 'Vancouver (YVR)'
      }
    }
  };

  const MODE_OPTIONS = [
    { value: 'flight', label: 'Flight' },
    { value: 'train', label: 'Train' },
    { value: 'overnight-train', label: 'Overnight train' },
    { value: 'flying-blue', label: 'Flying Blue award' }
  ];
  const MODE_HEX = { 'flight': '#91040C', 'train': '#5E8475', 'overnight-train': '#46604F', 'flying-blue': '#C8901F' };

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
    'venice': [45.4408, 12.3155], 'rome': [41.9028, 12.4964], 'warsaw': [52.2297, 21.0122]
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
    pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    msg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
    grip: '<circle cx="3.5" cy="3" r="1.5"/><circle cx="8.5" cy="3" r="1.5"/><circle cx="3.5" cy="8" r="1.5"/><circle cx="8.5" cy="8" r="1.5"/><circle cx="3.5" cy="13" r="1.5"/><circle cx="8.5" cy="13" r="1.5"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    spark: '<path d="M12 3l1.6 5.1L19 9.7l-4.4 2.9L16 18l-4-3.2L8 18l1.4-5.4L5 9.7l5.4-.6z"/>',
    clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
    sticker: '<rect x="3" y="3" width="18" height="18" rx="2.5"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>'
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
    }

    /* ---------- lifecycle ---------- */
    init() {
      this.wireDelegation();
      this.loadState();
      this.render();
      this.ensureMap(0);
      this.startSyncLoop();
      if (this.isLinked()) this.pullCloud();   // pick up edits made on another device
    }
    currentTrip() { return this.data.trips[this.data.active]; }
    legByIndex(i) { const t = this.currentTrip(); return i === 0 ? t.outboundLeg : t.stops[i - 1].leg; }

    bump() { this.render(); this.scheduleSave(); this.touchMap(); }
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
      this._saveTimer = setTimeout(() => {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data)); this.flashSaved(); } catch (e) {}
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
        const legs = [trip.outboundLeg, ...(trip.stops || []).map(s => s.leg)];
        legs.forEach(l => { if (l && l.mode === 'flying-blue' && l.miles == null) l.miles = (Number(l.cost) > 0 ? (d.meta.milesPerTicket || 25000) : 0); });
      });
      if (d.meta && d.meta.title == null) d.meta.title = '';
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
      if (!Array.isArray(d.stickerStock)) d.stickerStock = [];
      if (!Array.isArray(d.placedStickers)) d.placedStickers = [];
      d.placedStickers.forEach(ps => {
        if (!ps.target) ps.target = 'page';
        if (!ps.image) { const s = d.stickerStock.find(s => s.id === ps.stockId); if (s) ps.image = s.image; }
      });
    }

    /* ============================================================
       CROSS-DEVICE CLOUD SYNC  (kvdb.io)
       ------------------------------------------------------------
       localStorage is per-device, so edits on a phone never reach a
       laptop. Sync mirrors the planner state to a keyless public
       bucket; both devices link the same short code (the bucket id)
       and pull/push automatically. Conflict policy is simple
       last-write-wins, keyed on a millisecond `rev` timestamp that
       bumps on every local edit.

       All requests below are deliberately CORS "simple requests":
       no custom request headers (so no preflight), and the bucket id
       is read from the response BODY (not a CORS-exposed header).
       ============================================================ */
    loadSyncRec() {
      try { const v = localStorage.getItem(SYNC_KEY); if (v) return JSON.parse(v); } catch (e) {}
      return { id: null, rev: 0, lastSyncedAt: 0 };
    }
    persistSyncRec() { try { localStorage.setItem(SYNC_KEY, JSON.stringify(this.sync)); } catch (e) {} }
    isLinked() { return !!(this.sync && this.sync.id); }
    saveLocalNow() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data)); } catch (e) {} }

    bucketUrl(id) { return SYNC_API + '/' + encodeURIComponent(id) + '/' + SYNC_KEYNAME; }
    cloudPayload() { return JSON.stringify({ app: APP_TAG, rev: this.sync.rev || Date.now(), data: this.data }); }
    // a fetch that rejects (no response) means the host was unreachable —
    // network block, offline, or a CORS failure. Surface that distinctly.
    unreachable() {
      const e = new Error(navigator.onLine === false
        ? 'You appear to be offline.'
        : 'Could not reach the sync service (network/Wi-Fi may be blocking it).');
      e.code = 'unreachable'; return e;
    }
    netMsg(e) { return (e && e.message) ? e.message : 'Network error.'; }

    async cloudCreate() {
      let res;
      // kvdb only parses the create body as bucket config when it arrives with a
      // JSON content-type; sent as plain text it errors (HTTP 500). So declare
      // application/json here. This makes create a "preflighted" request, but
      // kvdb returns CORS headers (we can read its responses), so it answers the
      // preflight. GET/PUT below stay header-free simple requests.
      try {
        res = await fetch(SYNC_API + '/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',   // empty config = a public, shareable bucket
        });
      } catch (e) { throw this.unreachable(); }
      if (!res.ok) throw new Error('Could not create a code (HTTP ' + res.status + ').');
      const id = (await res.text()).trim();
      if (!id) throw new Error('Sync service returned an empty code.');
      return id;
    }
    async cloudGet(id) {
      let res;
      try { res = await fetch(this.bucketUrl(id), { method: 'GET', cache: 'no-store' }); }
      catch (e) { throw this.unreachable(); }
      if (res.status === 404) { const e = new Error('No data found for that code.'); e.code = 404; throw e; }
      if (!res.ok) throw new Error('Could not read sync (HTTP ' + res.status + ').');
      const txt = await res.text();
      if (!txt) { const e = new Error('No data found for that code.'); e.code = 404; throw e; }
      try { return JSON.parse(txt); } catch (e) { throw new Error('Synced data was unreadable.'); }
    }
    async cloudPut(id) {
      let res;
      try { res = await fetch(this.bucketUrl(id), { method: 'PUT', body: this.cloudPayload() }); }
      catch (e) { throw this.unreachable(); }
      if (res.status === 413) throw new Error('This trip is too large for the free sync tier.');
      if (!res.ok) throw new Error('Could not save to sync (HTTP ' + res.status + ').');
    }
    validPayload(p) { return !!(p && p.data && p.data.trips && p.data.meta); }

    /* ----- user actions ----- */
    async createSync() {
      if (this._syncBusy) return;
      this._syncBusy = true; this.setSyncStatus('syncing', 'Creating…');
      try {
        if (!this.sync.rev) this.sync.rev = Date.now();
        const id = await this.cloudCreate();
        this.sync.id = id; this.persistSyncRec();
        await this.cloudPut(id);                 // seed the new bucket with current trips
        this.sync.lastSyncedAt = Date.now(); this.persistSyncRec();
        this._syncBusy = false; this.setSyncStatus('synced', 'Code created'); this.bumpModal();
      } catch (e) {
        this._syncBusy = false;
        if (!this.sync.lastSyncedAt) { this.sync.id = null; this.persistSyncRec(); }  // creation didn't complete
        this.setSyncStatus('error', this.netMsg(e)); this.bumpModal();
      }
    }
    async linkSync(rawId) {
      // tolerate a pasted full URL (e.g. https://kvdb.io/<id>/state) — keep just the bucket id
      let id = (rawId || '').trim();
      const m = id.match(/kvdb\.io\/([^/\s?#]+)/i);
      if (m) id = m[1];
      if (!id) { this.setSyncStatus('error', 'Enter a sync code.'); return; }
      if (this._syncBusy) return;
      this._syncBusy = true; this.setSyncStatus('syncing', 'Linking…');
      try {
        const payload = await this.cloudGet(id);
        if (!this.validPayload(payload)) throw new Error('That code has no planner data.');
        this.snapshot();
        this.data = payload.data; this.migrate(); this._lastCoordKey = '';
        this.sync.id = id; this.sync.rev = Number(payload.rev) || Date.now(); this.sync.lastSyncedAt = Date.now();
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
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') this.pullCloud(); });
      window.addEventListener('focus', () => this.pullCloud());
      window.addEventListener('online', () => { if (this.isLinked()) this.pullCloud(); });
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
      if (!this.leafletMap) return;
      clearTimeout(this._mapTimer);
      this._mapTimer = setTimeout(() => { this.leafletMap.invalidateSize(); this.renderMap(); }, 220);
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
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19, detectRetina: true }).addTo(this.dayMap);
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
      if (pts.length > 1) this.dayLines.addLayer(L.polyline(pts, { color: '#91040C', weight: 1.5, opacity: .28, dashArray: '5 6' }));
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
      this._newStopIdx = idx;
      this.bump();
    }
    removeStop(idx) { this.snapshot(); this.currentTrip().stops.splice(idx, 1); if (this.openStopIdx === idx) this.openStopIdx = null; this.bump(); }
    reorderStop(from, to) {
      if (from === to) return;
      const st = this.currentTrip().stops; const [it] = st.splice(from, 1); st.splice(to, 0, it);
      if (this.openStopIdx === from) this.openStopIdx = to; this.bump();
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
            <div class="route">
              <div class="route-spine"><svg viewBox="0 0 6 200" preserveAspectRatio="none"><path d="M3 0 C1.4 40 4.6 80 3 120 S1.4 170 3 200"/></svg></div>
              ${this.renderRoute(trip, d, fmt)}
              <div class="add-stop-wrap"><button class="add-stop" data-act="add-stop" title="Add stop" aria-label="Add stop">+</button></div>
            </div>
            <aside class="aside">
              ${SHOW_MAP ? `<div style="display:flex;flex-direction:column;gap:8px;"><div id="map-holder"></div><div class="map-note"></div></div>` : ''}
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
        this.renderBudgetModal(budget, travelers, nights) +
        this.renderSyncModal();

      // re-attach persistent aside map node
      const holder = this.root.querySelector('#map-holder');
      if (holder) { holder.appendChild(this.mapEl); if (this.leafletMap) this.leafletMap.invalidateSize(); }
      // re-attach the per-day itinerary map (it lives inside the modal root)
      this.mountDayMap();
      this.paintSaved();

      // focus the city input of a newly inserted stop, then clear the flag
      if (this._newStopIdx != null) {
        const inputs = this.root.querySelectorAll('.stop .city');
        const el = inputs[this._newStopIdx];
        if (el) { el.focus(); el.select(); }
        this._newStopIdx = null;
      }
    }

    renderHeader(meta, dateRangeStr) {
      return `<div class="header">
        <input class="trip-title" value="${escA(meta.title)}" data-ch="trip-title" placeholder="Name this trip">
        <span class="date-badge">${esc(dateRangeStr)}</span>
        <span class="saved" style="opacity:0">saved</span>
        <div class="toolbar">
          <button class="tool-btn" data-act="undo" title="Undo (⌘Z)" aria-label="Undo" ${!this._history.length ? 'disabled' : ''}>${svg(I.undo)}<span class="tool-lbl">Undo</span></button>
          <button class="tool-btn" data-act="reset" title="Reset route" aria-label="Reset route">${svg(I.reset)}<span class="tool-lbl">Reset</span></button>
          <button class="tool-btn" data-act="export" title="Export trip" aria-label="Export trip">${svg(I.download)}<span class="tool-lbl">Export</span></button>
          <button class="tool-btn" data-act="import" title="Import trip" aria-label="Import trip">${svg(I.upload)}<span class="tool-lbl">Import</span></button>
          <input type="file" accept="application/json" class="import-file" data-ch="import-file" style="display:none">
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
        <div class="meta-field travelers"><label>Travelers</label><input type="text" inputmode="numeric" value="${escA(travelers)}" data-ch="travelers"></div>
      </div>`;
    }

    renderRoute(trip, d, fmt) {
      const legHtml = (leg, legIdx, insertIdx) => {
        const isFB = leg.mode === 'flying-blue';
        const opts = MODE_OPTIONS.map(o => `<option value="${o.value}"${o.value === leg.mode ? ' selected' : ''}>${o.label}</option>`).join('');
        return `<div class="leg"><div class="inner">
          <span class="mode-dot" style="background:${MODE_HEX[leg.mode] || '#7a7260'}"></span>
          <select data-ch="leg-mode" data-leg="${legIdx}">${opts}</select>
          <input class="dur" value="${escA(leg.duration)}" data-ch="leg-dur" data-leg="${legIdx}" placeholder="duration / notes">
          ${SHOW_COSTS ? `<span class="cost-wrap${isFB ? ' cost-wrap--fb' : ''}">
            <input class="cost" type="text" inputmode="numeric" value="${escA(isFB ? (leg.miles ?? 0) : (leg.cost ?? 0))}" data-ch="leg-cost" data-leg="${legIdx}">
            <span class="unit">${isFB ? 'mi/pp' : '$/pp'}</span></span>` : ''}
          <button class="insert" data-act="insert-stop" data-i="${insertIdx}" title="Insert a stop here" aria-label="Insert a stop here">+</button>
        </div></div>`;
      };
      let out = '';
      out += `<div class="endpoint"><div class="node"></div><div class="row">
        <input value="${escA(trip.originLabel)}" data-ch="origin-label" placeholder="Flying from">
        <span class="date">${d ? '· ' + esc(fmt(d.origin)) : ''}</span></div></div>`;
      out += legHtml(trip.outboundLeg, 0, 0);
      trip.stops.forEach((stop, idx) => {
        const r = d ? d.stops[idx] : null;
        const chosen = (stop.accom && stop.accom.options || []).find(o => o.chosen);
        const accomLabel = chosen ? chosen.name : 'Add accommodation';
        const accomSet = !!(chosen && chosen.name && chosen.name.trim());
        const dim = this._dragStopIdx === idx ? .38 : 1;
        out += `<div class="stop" data-drop="stop" data-i="${idx}" style="opacity:${dim}">
          <div class="dot"></div>
          <div class="card">
            <div class="head">
              <input class="city" value="${escA(stop.city)}" data-ch="stop-city" data-i="${idx}" placeholder="City">
              <button class="iti-btn" data-act="stop-iti" data-i="${idx}" title="Open day-by-day itinerary" aria-label="Open day-by-day itinerary">${svg(I.calendar)}</button>
              <div class="nights">
                <input type="number" value="${escA(stop.nights)}" data-ch="stop-nights" data-i="${idx}">
                <span>nights</span>
              </div>
            </div>
            <div class="subdate">${r ? esc(fmt(r.start) + ' → ' + fmt(r.end)) : ''}</div>
            <button class="accom-btn" data-act="stop-accom" data-i="${idx}" title="Edit accommodation">
              ${svg(I.building, { w: 14, h: 14, stroke: '#a89e8c' })}
              <span class="lbl" style="color:${accomSet ? 'var(--ink)' : 'var(--ink-mute)'}">${esc(accomLabel)}</span>
              <span class="chev">›</span>
            </button>
            <div class="foot">
              <div class="grip" data-grip-stop="${idx}" title="Drag to reorder"><svg width="12" height="18" viewBox="0 0 8 14" fill="currentColor" aria-hidden="true"><circle cx="1.6" cy="1.6" r="1.6"/><circle cx="6.4" cy="1.6" r="1.6"/><circle cx="1.6" cy="7" r="1.6"/><circle cx="6.4" cy="7" r="1.6"/><circle cx="1.6" cy="12.4" r="1.6"/><circle cx="6.4" cy="12.4" r="1.6"/></svg></div>
              <button class="trash" data-act="stop-delete" data-i="${idx}" title="Remove stop" aria-label="Remove stop">${svg(I.trash, { w: 14, h: 14, sw: 2.4 })}</button>
            </div>
          </div>
        </div>`;
        out += legHtml(stop.leg, idx + 1, idx + 1);
      });
      out += `<div class="endpoint"><div class="node"></div><div class="row">
        <input value="${escA(trip.homeLabel)}" data-ch="home-label" placeholder="Flying home to">
        <span class="date">${d ? '· ' + esc(fmt(d.home)) : ''}</span></div></div>`;
      return out;
    }

    renderSummary(nights, grand, perPerson, miles, balance) {
      const covered = miles > 0 && balance >= miles;
      return `<div class="summary">
        <div class="stat"><div class="fig">${nights}</div><div class="cap">nights on the ground</div></div>
        ${SHOW_COSTS ? `<div class="stat cash clickable" data-act="open-budget" title="See budget breakdown">
          <div class="fig">${esc(money(grand))}</div><div class="cap">total budget · ${esc(money(perPerson))} / person</div></div>
        <div class="stat miles${covered ? ' covered' : ''}"><div class="fig">${miles.toLocaleString()}</div><div class="cap">flying blue miles needed</div></div>` : ''}
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
          <input class="time" value="${escA(it.time)}" data-ch="item-time" data-i="${ii}" placeholder="9:00">
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
      const body = linked ? `
        <p class="sync-lead">This planner is syncing. To see the same trips on another device, open this page there, tap <b>Sync</b> → <b>Link a code</b>, and enter the code below.</p>
        <label class="sync-field-lbl">Your sync code</label>
        <div class="sync-code-row">
          <input class="sync-code-out" value="${escA(this.sync.id)}" readonly data-act="sync-select">
          <button class="sync-btn" data-act="sync-copy">Copy</button>
        </div>
        <div class="sync-row">
          <span class="sync-status ${statusCls}">${esc(this.syncStatusLabel())}</span>
          <span class="sync-when">${esc(when)}</span>
        </div>
        <div class="sync-actions">
          <button class="sync-btn primary" data-act="sync-now"${this._syncBusy ? ' disabled' : ''}>Sync now</button>
          <button class="sync-btn ghost" data-act="sync-unlink">Unlink this device</button>
        </div>
        <p class="sync-note">Trips are stored in a free public cloud bin. Anyone with this code can read or change them — treat it like a shared password. Offline edits upload automatically when you reconnect.</p>
      ` : `
        <p class="sync-lead">Sync keeps your trips in step across phone and laptop. Create a code on one device, then link it on the other.</p>
        <div class="sync-actions">
          <button class="sync-btn primary" data-act="sync-create"${this._syncBusy ? ' disabled' : ''}>Create a sync code</button>
        </div>
        <div class="sync-or"><span>or link a code</span></div>
        <label class="sync-field-lbl">Already have a code? Enter it here</label>
        <div class="sync-code-row">
          <input class="sync-code-in" placeholder="Paste sync code" data-ch="sync-code-in" value="${escA(this._syncCodeDraft || '')}">
          <button class="sync-btn" data-act="sync-link"${this._syncBusy ? ' disabled' : ''}>Link</button>
        </div>
        <div class="sync-row"><span class="sync-status ${statusCls}">${esc(this.syncStatusLabel())}</span></div>
        <p class="sync-note">Your trips will be stored in a free public cloud bin so both devices can reach them. Anyone with the code can view or edit it, so keep it private.</p>
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
        case 'tab-select': if (this.data.active !== key) { this.data.active = key; this._lastCoordKey = ''; this.bump(); } break;
        case 'tab-remove': this.removeTrip(key); break;
        case 'add-stop': this.insertStop(trip.stops.length); break;
        case 'insert-stop': this.insertStop(i); break;
        case 'stop-iti': this.openStop(i); break;
        case 'stop-accom': this.openAccom(i); break;
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
        case 'sync-link': { const inp = this.modalEl.querySelector('.sync-code-in'); this.linkSync(inp ? inp.value : this._syncCodeDraft); break; }
        case 'sync-now': this.syncNow(); break;
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
        case 'leg-cost': { const leg = this.legByIndex(Number(t.dataset.leg)); const num = Number(v) || 0; if (leg.mode === 'flying-blue') leg.miles = num; else leg.cost = num; this.bump(); break; }
        case 'stop-city': trip.stops[i].city = v; this.bump(); break;
        case 'stop-nights': trip.stops[i].nights = Number(v) || 0; this.bump(); break;
        case 'todo-text': meta.todos[i].text = v; this.bump(); break;
        case 'import-file': this.importFile(e); break;
        case 'sync-code-in': this._syncCodeDraft = v; break;
        // itinerary modal
        case 'iti-city': trip.stops[this.openStopIdx].city = v; this.bump(); break;
        case 'item-time': trip.stops[this.openStopIdx].itinerary[this.activeDay].items[i].time = v; this.bumpModal(); this.scheduleSave(); break;
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
        case 'budget-edit': meta.budget[t.dataset.key] = Math.max(0, Number(v) || 0); this.bump(); break;
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
    onPointerDown(e) {
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
