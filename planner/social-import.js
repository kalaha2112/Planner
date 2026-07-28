/* ============================================================
   social-import.js — shared social post → itinerary extractor
   ------------------------------------------------------------
   Turns whatever a share sheet hands over (a RedNote / 小红书
   note, a TikTok video caption, an Instagram reel link, or a
   plain pasted note) into a list of *candidate activities* the
   planner can drop onto an itinerary day.

   Everything here is PURE and offline: no network, no API key,
   no scraping. The social apps block cross-origin fetches of
   their pages, so the only text we ever see is the text the
   user shared — a caption, a copied note body, a link, or all
   three. That is enough: the posts people save for travel are
   almost always structured lists ("📍1. …  地址：…  ¥…").

   Public API
     SocialImport.parse(rawText, { cities })  → ParseResult
     SocialImport.detectSource(rawText)       → source id
     SocialImport.SOURCES                     → source metadata

   ParseResult = {
     source, sourceLabel, url, links[], title, city, tags[],
     dayCount,                       // distinct "Day N" headers seen
     activities: [{
       id, use, day,                 // day: 0-based, or null
       time, text, address, note, cost, signals[]
     }]
   }
   ============================================================ */
;(function (global) {
  'use strict';

  /* ---------- sources ---------- */
  const SOURCES = [
    {
      id: 'rednote', label: 'RedNote',
      hosts: ['xiaohongshu.com', 'xhslink.com', 'xhs.cn', 'xhsl.ink', 'rednote.com'],
      marks: [/小红书/, /rednote/i, /xhs/i]
    },
    {
      id: 'tiktok', label: 'TikTok',
      hosts: ['tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com', 'douyin.com'],
      marks: [/tiktok/i, /抖音/]
    },
    {
      id: 'instagram', label: 'Instagram',
      hosts: ['instagram.com', 'instagr.am', 'ig.me'],
      marks: [/instagram/i, /\breels?\b/i]
    }
  ];
  const SOURCE_LABEL = { rednote: 'RedNote', tiktok: 'TikTok', instagram: 'Instagram', note: 'Shared note' };

  /* ---------- lexicon ----------
     Deliberately multilingual: the posts worth importing are as often
     Chinese/Japanese as English. A word here only *contributes* to a
     score, so a stray match never creates an activity on its own. */
  const PLACE_WORDS = [
    // food & drink
    'cafe', 'café', 'coffee', 'espresso', 'restaurant', 'bistro', 'brasserie', 'trattoria', 'osteria',
    'izakaya', 'ramen', 'sushi', 'yakitori', 'bakery', 'boulangerie', 'patisserie', 'brunch', 'breakfast',
    'lunch', 'dinner', 'bar', 'wine bar', 'pub', 'rooftop', 'food hall', 'street food', 'night market',
    // shops
    'market', 'mall', 'store', 'shop', 'boutique', 'bookstore', 'bookshop', 'vintage',
    // sights
    'museum', 'gallery', 'palace', 'castle', 'temple', 'shrine', 'church', 'cathedral', 'basilica',
    'mosque', 'synagogue', 'monastery', 'abbey', 'tower', 'bridge', 'square', 'plaza', 'piazza',
    'park', 'garden', 'zoo', 'aquarium', 'planetarium', 'observatory', 'viewpoint', 'lookout',
    'beach', 'lake', 'river', 'canal', 'falls', 'waterfall', 'mountain', 'valley', 'island',
    'harbor', 'harbour', 'pier', 'port', 'station', 'airport', 'district', 'quarter', 'old town',
    'street', 'avenue', 'boulevard', 'alley', 'lane',
    // stays & doing
    'hotel', 'hostel', 'ryokan', 'onsen', 'spa', 'trail', 'hike', 'tour', 'cruise', 'ferry',
    'club', 'theatre', 'theater', 'cinema', 'stadium', 'arena', 'library', 'workshop', 'class',
    // ja
    '神社', '寺', '城', '公園', '美術館', '博物館', '庭園', '温泉', '駅', '商店街', '横丁', '屋台',
    '食堂', '喫茶', 'ラーメン', 'カフェ', '展望台', '市場',
    // zh
    '公园', '博物馆', '美术馆', '咖啡', '餐厅', '饭店', '酒吧', '市场', '夜市', '广场', '教堂',
    '古城', '老城', '观景台', '景点', '小吃', '甜品', '面包', '书店', '酒店', '民宿', '车站',
    '寺庙', '街区', '园林', '海滩', '瀑布', '步道', '大社', '神宫', '古镇', '胡同', '塔', '桥', '湖', '山', '寺', '宫',
    // ko
    '카페', '시장', '공원', '거리', '맛집'
  ];

  const ACTION_WORDS = [
    'visit', 'see', 'explore', 'wander', 'walk', 'stroll', 'eat', 'try', 'taste', 'sample', 'drink',
    'grab', 'shop', 'browse', 'book', 'stay', 'watch', 'catch', 'hike', 'climb', 'ride', 'tour',
    'check out', 'must see', 'must-see', 'must try', 'must-try', 'must visit', 'must-visit',
    'don\'t miss', 'do not miss', 'stop by', 'swing by', 'sunset at', 'sunrise at',
    '打卡', '必去', '必吃', '必玩', '必逛', '推荐', '逛', '体验', '散步', 'おすすめ', '巡り'
  ];

  /* attribute lines — "地址：…", "Address: …" — attach to the activity above.
     Latin keywords require the colon; a bare "Entrance to the park was
     lovely" is prose, not a price. */
  const ATTRS = [
    { key: 'address', rx: /^(?:📍|🗺️|🏠)?\s*(?:地址|地點|地点|所在地|住所|위치|주소|address|addr|location|where)\s*[:：]\s*(.+)$/i },
    { key: 'hours', rx: /^(?:🕒|⏰)?\s*(?:营业时间|營業時間|开放时间|開放時間|営業時間|時間|영업시간|hours|opening hours|open|timing|timings)\s*[:：]\s*(.+)$/i },
    { key: 'price', rx: /^(?:💰|💵)?\s*(?:人均|均价|均價)\s*[:：]?\s*(.+)$/ },
    { key: 'price', rx: /^(?:💰|💵)?\s*(?:价格|價格|费用|費用|门票|門票|예산|price|cost|budget|ticket|entry fee|entrance fee|admission)\s*[:：]\s*(.+)$/i },
    { key: 'note', rx: /^(?:💡|📝|⚠️)?\s*(?:tip|tips|note|notes|推荐理由|推薦理由|注意|贴士|備考|메모)\s*[:：]\s*(.+)$/i },
    { key: 'note', rx: /^(?:🚇|🚉)?\s*(?:交通|how to get there|getting there|transport|nearest station|最寄り駅)\s*[:：]\s*(.+)$/i }
  ];

  /* platform share-sheet boilerplate — never an activity */
  const BOILERPLATE = [
    /复制本条信息[^\n]*/g, /复制这段(描述|内容)[^\n]*/g, /打开[【\[]?(小红书|抖音)[】\]]?[^\n]*/g,
    /查看(精彩内容|全文)[！!。]?/g, /点击链接[^\n]*/g, /长按复制[^\n]*/g,
    /check\s+out\s+[^\n]*?\bon\s+tiktok\b[^\n]*/gi, /\b(?:check\s+out|watch)\s+[^\n]{0,60}?['’]s\s+(?:video|post|reel)[!.]?/gi, /watch\s+[^\n]*?\bon\s+tiktok\b[^\n]*/gi,
    /\bon\s+tiktok\b\s*$/gim, /\bsee\s+this\s+instagram\b[^\n]*/gi,
    /\bshared\s+(?:via|from)\s+(?:instagram|tiktok|rednote)\b[^\n]*/gi,
    /\bsent\s+via\s+instagram\b[^\n]*/gi, /\bview\s+(?:profile|post|reel)\s+on\s+instagram\b[^\n]*/gi,
    /\bdownload\s+the\s+app\b[^\n]*/gi
  ];

  /* ---------- small regex kit ---------- */
  const RX_URL = /\bhttps?:\/\/[^\s"'<>）)】\]，,；;]+/gi;
  const RX_HASHTAG = /[#＃]([^\s#＃,，。.!！?？]+)/g;
  const RX_MARKER = /^\s*(?:[0-9]{1,2}\s*[.、)．,]|[\u2460-\u2473]|[\u2776-\u277F]|[-–—•*·‣▪◦▫]|【|\[)\s*/;
  const RX_LEAD_EMOJI = /^\s*(?:\p{Extended_Pictographic}️?\s*)+/u;
  const RX_TRAIL_PUNCT = /[\s，。,.;；:：、~～\-–—|｜]+$/;
  const RX_DAY = /^\s*(?:day\s*([0-9]{1,2})\b|d([0-9]{1,2})\b|第\s*([0-9]{1,2}|[一二三四五六七八九十])\s*[天日]|([0-9]{1,2})\s*日目|([0-9]{1,2})일차)/i;
  const CN_NUM = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10 };
  const RX_CJK = /[぀-ヿ㐀-鿿가-힯]/;
  const RX_APP_NAME = /^(?:tiktok|instagram|rednote|xiaohongshu|小红书|抖音|reels?|douyin)$/i;

  const clean = (s) => String(s == null ? '' : s)
    .replace(/\r\n?/g, '\n')
    .replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, '')
    .replace(/ /g, ' ');

  const tidy = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const norm = (s) => tidy(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch (e) { return ''; } };

  /* ---------- links & source ---------- */
  function extractLinks(text) {
    const out = [];
    const seen = new Set();
    (clean(text).match(RX_URL) || []).forEach(raw => {
      const url = raw.replace(/[.,;)】\]]+$/, '');
      if (seen.has(url)) return;
      seen.add(url);
      const host = hostOf(url);
      const src = SOURCES.find(s => s.hosts.some(h => host === h || host.endsWith('.' + h)));
      out.push({ url, host, source: src ? src.id : 'note' });
    });
    return out;
  }

  function detectSource(text) {
    const links = extractLinks(text);
    const hit = links.find(l => l.source !== 'note');
    if (hit) return hit.source;
    const t = clean(text);
    const marked = SOURCES.find(s => s.marks.some(rx => rx.test(t)));
    return marked ? marked.id : 'note';
  }

  /* ---------- time ----------
     Only a time at the *head* of a line counts as the activity's time.
     That keeps "open 8:00–19:00" (an opening-hours line) from being read
     as "be there at 8". */
  function leadingTime(line) {
    let m = line.match(/^\s*(?:(上午|中午|下午|晚上|傍晚|凌晨)\s*)?(\d{1,2})\s*[:：.]\s*(\d{2})\s*(am|pm|a\.m\.|p\.m\.)?\s*(?:[-–—~～]\s*\d{1,2}\s*[:：.]?\s*\d{0,2}\s*(?:am|pm)?)?\s*(?:[-–—~：:|｜、,，)】\]]|\s)\s*/i);
    if (m) {
      const h = clockTo24(+m[2], m[4], m[1]);
      if (h != null && +m[3] < 60) return { time: pad(h) + ':' + m[3], rest: line.slice(m[0].length) };
    }
    m = line.match(/^\s*(?:(上午|中午|下午|晚上|傍晚|凌晨)\s*)?(\d{1,2})\s*(am|pm|a\.m\.|p\.m\.)\s*(?:[-–—~：:|｜、,，)】\]]|\s)\s*/i);
    if (m) {
      const h = clockTo24(+m[2], m[3], m[1]);
      if (h != null) return { time: pad(h) + ':00', rest: line.slice(m[0].length) };
    }
    m = line.match(/^\s*(上午|中午|下午|晚上|傍晚|凌晨)?\s*(\d{1,2})\s*[点時时]\s*(半|\d{1,2}\s*分?)?\s*/);
    if (m && (m[1] || m[3] != null)) {
      const h = clockTo24(+m[2], null, m[1]);
      const min = !m[3] ? '00' : (m[3] === '半' ? '30' : pad(parseInt(m[3], 10) || 0));
      if (h != null) return { time: pad(h) + ':' + min, rest: line.slice(m[0].length) };
    }
    return null;
  }
  function clockTo24(h, ampm, cn) {
    if (!(h >= 0 && h <= 24)) return null;
    const a = (ampm || '').toLowerCase().replace(/\./g, '');
    if (a === 'pm' && h < 12) h += 12;
    if (a === 'am' && h === 12) h = 0;
    if (!a && cn) {
      if ((cn === '下午' || cn === '晚上' || cn === '傍晚') && h < 12) h += 12;
      if (cn === '凌晨' && h === 12) h = 0;
    }
    return h % 24;
  }
  const pad = (n) => String(n).padStart(2, '0');

  /* ---------- money ----------
     `cost` feeds the planner's Activities budget line, which is plain
     dollars — so only a $ (or bare) amount lands there. Anything in a
     foreign currency is kept as a note instead of silently distorting
     the budget. */
  function extractMoney(line) {
    let m = line.match(/([$])\s?(\d[\d,]*(?:\.\d{1,2})?)/);
    if (m) return { cost: m[2].replace(/,/g, ''), label: m[0], rest: line.replace(m[0], ' ') };
    m = line.match(/([¥￥€£₩฿])\s?(\d[\d,]*(?:\.\d{1,2})?)/);
    if (m) return { cost: '', label: m[1] + m[2], rest: line.replace(m[0], ' ') };
    m = line.match(/(?:人均|均价|均價)\s*[¥￥$]?\s*(\d[\d,]*)/);
    if (m) return { cost: '', label: '人均 ' + m[1], rest: line.replace(m[0], ' ') };
    m = line.match(/\b(\d[\d,]*(?:\.\d{1,2})?)\s*(元|円|圓|yen|rmb|eur|euros?|gbp|krw|usd|dollars?)\b/i);
    if (m) return { cost: /usd|dollars?/i.test(m[2]) ? m[1].replace(/,/g, '') : '', label: m[0], rest: line.replace(m[0], ' ') };
    return null;
  }

  /* ---------- day headers ---------- */
  function dayHeader(line) {
    const m = line.match(RX_DAY);
    if (!m) return null;
    const raw = m[1] || m[2] || m[3] || m[4] || m[5];
    const n = CN_NUM[raw] || parseInt(raw, 10);
    if (!(n >= 1 && n <= 60)) return null;
    return { day: n - 1, rest: line.slice(m[0].length).replace(/^[\s:：.、)\-–—|｜]+/, '') };
  }

  /* ---------- scoring ----------
     A line becomes a candidate activity only if it clears SCORE_MIN.
     Signals are kept on the candidate so the UI can show *why* it was
     picked, and so a reviewer can spot a bad guess at a glance. */
  const SCORE_MIN = 3;
  function scoreLine(line, ctx) {
    const signals = [];
    let score = 0;
    const lower = norm(line);
    if (!lower) return { score: 0, signals };

    if (ctx.marker) { score += 3; signals.push('list'); }
    if (/📍|🗺️|🏛️|⛩️/.test(line)) { score += 3; signals.push('pin'); }
    else if (ctx.leadEmoji) { score += 2; signals.push('emoji'); }
    if (ctx.time) { score += 2; signals.push('time'); }
    if (ctx.money) { score += 1; signals.push('price'); }

    const cjk = RX_CJK.test(line);
    const place = PLACE_WORDS.find(w => (RX_CJK.test(w) ? line.includes(w) : new RegExp('\\b' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + 's?\\b', 'i').test(lower)));
    if (place) { score += 2; signals.push('place'); }
    const action = ACTION_WORDS.find(w => (RX_CJK.test(w) ? line.includes(w) : lower.includes(w)));
    if (action) { score += 2; signals.push('verb'); }
    // a run of capitalised words reads as a proper name ("Fushimi Inari Shrine");
    // the longer the run, the more it looks like a venue and not a sentence start
    const nameRun = line.match(/(^|\s)((?:[A-Z][\w'’&.-]*)(?:\s+(?:[A-Z][\w'’&.-]*|de|di|du|da|la|le|el|van|von|of|the))+)/);
    if (nameRun) { score += nameRun[2].split(/\s+/).length >= 3 ? 2 : 1; signals.push('name'); }
    // CJK has no capitalisation to lean on, so a short line naming a place
    // carries the same weight a Latin proper-name run would
    if (cjk && place && line.length <= 24) score += 1;
    if (ctx.cities && ctx.cities.length) {
      const city = ctx.cities.find(c => lower.includes(c));
      if (city) { score += 1; signals.push('city'); }
    }

    // long prose without a marker is a caption, not an activity
    const words = lower.split(/\s+/).length;
    if (!ctx.marker && !cjk && words > 14) score -= 3;
    if (cjk && line.length > 60 && !ctx.marker) score -= 2;
    return { score, signals, nameRun: !!nameRun };
  }

  /* ---------- main ---------- */
  function parse(raw, opts) {
    const options = opts || {};
    const cities = (options.cities || []).map(norm).filter(c => c.length > 2);
    const text = clean(raw);
    const links = extractLinks(text);
    const source = detectSource(text);
    const primary = (links.find(l => l.source === source) || links[0] || {}).url || '';

    // strip URLs + share boilerplate before line analysis
    let body = text.replace(RX_URL, ' ');
    BOILERPLATE.forEach(rx => { body = body.replace(rx, ' '); });

    const tags = [];
    body = body.replace(RX_HASHTAG, (_, t) => { tags.push(t); return ' '; });

    const rawLines = body.split('\n').map(l => l.replace(/\s+$/, ''));
    const activities = [];
    const days = new Set();
    let currentDay = null;
    let title = '';

    const push = (act) => { activities.push(act); return act; };
    const last = () => activities[activities.length - 1] || null;

    let firstLine = true;
    for (let li = 0; li < rawLines.length; li++) {
      let line = tidy(rawLines[li]);
      if (!line) continue;
      // 【标题 - 作者 | 小红书】 — the RedNote share wrapper
      const wrapped = line.match(/^【\s*(.+?)\s*】$/);
      if (wrapped) line = wrapped[1].split(/\s+-\s+|\s*[|｜]\s*/)[0];
      // RedNote share text prefixes the note title with its like counter
      // ("59 东京咖啡合集"). Only on the opening line, and only ahead of CJK —
      // a Latin headline legitimately starts with a number ("3 days in Kyoto").
      if (firstLine) line = line.replace(/^\d{1,6}\s+(?=[　-鿿가-힯])/, '');
      firstLine = false;
      if (!line || line.length < 2) continue;

      // --- day header ("Day 2", "第三天") ---
      const dh = dayHeader(line);
      if (dh) {
        currentDay = dh.day;
        days.add(dh.day);
        if (!dh.rest) continue;
        line = dh.rest;                      // "Day 2 — Fushimi Inari" keeps going
      }

      // --- attribute line → enrich the activity above ---
      const attr = matchAttr(line);
      if (attr) {
        const target = last();
        if (target) {
          applyAttr(target, attr);
          continue;
        }
        // an address with nothing above it still describes a place
        if (attr.key !== 'address') continue;
        line = attr.value;
      }

      // --- strip decoration: "📍1. …", "☕️ …", "- 09:00 …" ---
      // markers and lead emoji interleave, so peel until nothing more comes off
      let rest = line, marker = false, leadEmoji = false;
      for (let pass = 0; pass < 4; pass++) {
        const mk = rest.match(RX_MARKER);
        if (mk && mk[0].trim()) { rest = rest.slice(mk[0].length); marker = true; continue; }
        const em = rest.match(RX_LEAD_EMOJI);
        if (em && em[0].trim()) { rest = rest.slice(em[0].length); leadEmoji = true; continue; }
        break;
      }
      rest = rest.replace(/^[】\]]\s*/, '');

      const t = leadingTime(rest);
      if (t) rest = t.rest;
      const m = extractMoney(rest);
      if (m) rest = m.rest;

      let name = tidy(rest).replace(RX_TRAIL_PUNCT, '');
      const ctx = { marker, leadEmoji, time: !!t, money: !!m, cities };
      const { score, signals, nameRun } = scoreLine(line, ctx);

      // The opening line of a post is its headline, not a stop on the route —
      // unless it carries a list marker, a pin or a time, which make it a real
      // entry. If nothing else parses out, the headline becomes the fallback row.
      if (!title && !marker && !leadEmoji && !t && !/📍/.test(line) && name.length >= 3) {
        title = name;
        continue;
      }

      // Inside a day-by-day post ("Day 2 …"), plain lines are the plan — accept
      // them on a lighter signal than a free-form caption needs.
      const threshold = currentDay != null ? SCORE_MIN - 1 : SCORE_MIN;

      if (score < threshold || name.length < 2 || name.length > 140) {
        // not an activity — but a stray line right under one is often its note
        const prev = last();
        if (prev && !prev.note && !nameRun && name.length >= 4 && name.length <= 90 && score >= 1) prev.note = name;
        continue;
      }

      // "Fushimi Inari Shrine — go early, it gets packed" → name + note.
      // Worth doing beyond tidiness: with no address, the day map geocodes the
      // activity text, and a sentence of advice never resolves to a pin.
      const aside = splitTrailingNote(name);
      let note = '';
      if (aside) { name = aside.name; note = aside.note; }

      // an inline address ("Blue Bottle, 1-4-8 Hirano, Koto City")
      let address = '';
      const split = splitInlineAddress(name);
      if (split) { name = split.name; address = split.address; }

      const act = push({
        id: 'sa' + activities.length + '-' + Math.random().toString(36).slice(2, 7),
        use: true,
        day: currentDay,
        time: t ? t.time : '',
        text: name,
        address,
        note: m && !m.cost ? joinNote(note, m.label) : note,
        cost: m && m.cost ? m.cost : '',
        signals
      });
      if (!title) title = act.text;
    }

    // Android share sheets often pass the app's own name as the share title —
    // "TikTok" is not this post's headline.
    if (RX_APP_NAME.test(tidy(title))) title = '';

    dedupe(activities);
    const trimmed = activities.slice(0, 60);

    // nothing structured found → keep the share itself as one reviewable row
    if (!trimmed.length) {
      const fallback = tidy(title) || firstMeaningfulLine(rawLines) || (SOURCE_LABEL[source] + ' post');
      trimmed.push({
        id: 'sa-link', use: true, day: null, time: '',
        text: fallback.slice(0, 120), address: '', note: '', cost: '',
        signals: ['link']
      });
    }

    return {
      source,
      sourceLabel: SOURCE_LABEL[source] || SOURCE_LABEL.note,
      url: primary,
      links,
      title: tidy(title).slice(0, 140),
      city: guessCity(text, tags, cities, options.cities || []),
      tags,
      dayCount: days.size,
      activities: trimmed
    };
  }

  function matchAttr(line) {
    for (const a of ATTRS) {
      const m = line.match(a.rx);
      if (m && tidy(m[1])) return { key: a.key, value: tidy(m[1]).replace(RX_TRAIL_PUNCT, '') };
    }
    // "📍 Kiyomizu-dera, 1-294 Kiyomizu" — a pin line with no label
    const pin = line.match(/^\s*📍\s*(.+)$/);
    if (pin && /\d/.test(pin[1]) && /[,，]/.test(pin[1])) return { key: 'address', value: tidy(pin[1]) };
    return null;
  }

  function applyAttr(act, attr) {
    if (attr.key === 'address') { act.address = act.address || attr.value; return; }
    if (attr.key === 'price') {
      const m = extractMoney(attr.value);
      if (m && m.cost) act.cost = act.cost || m.cost;
      else act.note = joinNote(act.note, m ? m.label : attr.value);
      return;
    }
    act.note = joinNote(act.note, (attr.key === 'hours' ? 'Hours ' : '') + attr.value);
  }
  const joinNote = (a, b) => (a ? a + ' · ' + b : b).slice(0, 180);

  /* "Name, 12 Some Street, City" → name + address, when a later segment
     carries a street number (or a CJK administrative suffix) and the first
     does not. */
  const RX_ADDR_TAIL = /[市区區町丁目路街道県縣府省郡村시구로]/;
  function splitInlineAddress(s) {
    const parts = s.split(/\s*[,，]\s*/).filter(Boolean);
    if (parts.length < 2 || /\d/.test(parts[0])) return null;
    const tail = parts.slice(1);
    if (!tail.some(p => /\d/.test(p)) && !tail.some(p => RX_ADDR_TAIL.test(p))) return null;
    return { name: parts[0], address: tail.join(', ') };
  }

  /* "Kiyomizu-dera — go at sunrise" → name + note. Only a spaced dash counts,
     so hyphenated names ("Kiyomizu-dera") stay whole. */
  function splitTrailingNote(s) {
    const m = s.match(/^(.{3,}?)\s+[—–\-·|｜]\s+(.{4,})$/);
    if (!m) return null;
    if (/^\d/.test(m[2]) && m[2].length < 12) return null;    // "Room 4 - 12" is not a note
    return { name: tidy(m[1]).replace(RX_TRAIL_PUNCT, ''), note: tidy(m[2]) };
  }

  /* keep the FIRST occurrence — it's the one the attribute lines
     (address / hours / price) were attached to */
  function dedupe(list) {
    const seen = new Set();
    for (let i = 0; i < list.length; i++) {
      const k = norm(list[i].text);
      if (!k || seen.has(k)) { list.splice(i, 1); i--; }
      else seen.add(k);
    }
  }

  function firstMeaningfulLine(lines) {
    for (const l of lines) {
      const s = tidy(l);
      if (s.length >= 4) return s;
    }
    return '';
  }

  /* City guess: longest known city name mentioned in the post (hashtags
     count too — "#kyototravel" is the usual give-away). */
  function guessCity(text, tags, citiesNorm, citiesRaw) {
    const hay = norm(text + ' ' + tags.join(' '));
    let best = '', bestLen = 0;
    citiesNorm.forEach((c, i) => {
      if (c.length > bestLen && hay.includes(c)) { best = citiesRaw[i]; bestLen = c.length; }
    });
    return best;
  }

  const SocialImport = { parse, detectSource, extractLinks, SOURCES, SOURCE_LABEL, _internals: { leadingTime, extractMoney, dayHeader, scoreLine, splitInlineAddress, splitTrailingNote } };

  global.SocialImport = SocialImport;
  if (typeof module !== 'undefined' && module.exports) module.exports = SocialImport;
})(typeof globalThis !== 'undefined' ? globalThis : this);
