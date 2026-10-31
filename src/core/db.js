/**
 * ShelfLife Core Database & Persistence Layer (src/core/db.js)
 * Supabase client, SyncQueue offline manager, 62 database operations, and dbToBook entity transformer.
 */

import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  ADMIN_USER_ID,
  DEMO_AUTHOR_REGIONS_V2,
  COLORS,
  ALL_MONTHS
} from '../utils/constants.js';

// ==========================================
// 1. Supabase Client Initialization
// ==========================================
export let _supabase = null;
export let supabase = null;

try {
  const clientFactory = (typeof window !== 'undefined' && window.supabase) ? window.supabase : null;
  if (clientFactory && SUPABASE_URL && SUPABASE_URL !== 'YOUR_SUPABASE_URL' && SUPABASE_ANON_KEY && SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY') {
    _supabase = supabase = clientFactory.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        flowType: 'implicit',
        // We handle OAuth hash manually (see handleOAuthRedirect) so that
        // mobile redirects never trip Supabase's internal state check.
        detectSessionInUrl: false,
        autoRefreshToken: true,
        persistSession: true,
        storage: (typeof window !== 'undefined') ? window.localStorage : undefined,
      }
    });
  }
} catch (e) {
  console.warn('[Shelf Life] Supabase init failed:', e.message);
}

// ==========================================
// 2. Data & Entity Helper Functions
// ==========================================

export function coverPlaceholder(title, author, sentiment) {
  const c = COLORS[sentiment] || '#6b5b4b';
  const rawT = (title || '').trim();
  const trT = rawT.length > 14 ? rawT.substring(0, 12) + '...' : rawT;
  const ts = trT.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const rawA = (author || '').trim();
  const trA = rawA.length > 18 ? rawA.substring(0, 16) + '...' : rawA;
  const as = trA.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return 'data:image/svg+xml,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="180" viewBox="0 0 120 180"><rect width="120" height="180" fill="${c}" rx="2"/><text x="60" y="65" text-anchor="middle" fill="rgba(255,255,255,0.9)" font-family="Georgia,serif" font-size="14" font-weight="700" font-style="italic"><tspan x="60">${ts}</tspan></text><text x="60" y="105" text-anchor="middle" fill="rgba(255,255,255,0.6)" font-family="sans-serif" font-size="9">${as}</text></svg>`
  ).replace(/'/g, '%27');
}

export function deriveDisplayNameFromEmail(email) {
  const localPart = (email || 'reader').split('@')[0] || 'reader';
  return localPart.slice(0, 6) + '...';
}

export function normalizeDisplayName(input, fallbackEmail) {
  const cleaned = (input || '').trim().replace(/\s+/g, ' ');
  if (cleaned) return cleaned.slice(0, 60);
  return deriveDisplayNameFromEmail(fallbackEmail || 'reader@example.com');
}

export function normalizeGenre(g) {
  if (!g) return 'General Fiction';
  const s = String(g).trim();
  if (/crime|mystery|detective|thriller|suspense/i.test(s)) return 'Crime & Mystery';
  if (/sci-fi|science fiction/i.test(s)) return 'Sci-Fi';
  if (/romance|romantic/i.test(s)) return 'Romance';
  if (/history|historical/i.test(s)) return 'History';
  if (/fantasy/i.test(s)) return 'Fantasy';
  if (/non-fiction|nonfiction/i.test(s)) return 'Non-Fiction';
  if (/biography|memoir/i.test(s)) return 'Biography & Memoir';
  return s;
}

// ==========================================
// 1.5 Word Count Overrides & Master Catalog
// ==========================================
export const WORD_COUNT_OVERRIDES = {
  // Demo Library Books
  'things fall apart': { words: 55000, pageCount: 209 },
  '1q84': { words: 290000, pageCount: 1184 },
  'two kinds of truth': { words: 110000, pageCount: 416 },
  'starter villain': { words: 90000, pageCount: 264 },
  'never boring': { words: 80000, pageCount: 288 },
  'serpentine': { words: 105000, pageCount: 368 },
  'the 100-year-old man': { words: 120000, pageCount: 396 },
  'the 100-year-old man who climbed out the window and disappeared': { words: 120000, pageCount: 396 },
  'the brass verdict': { words: 115000, pageCount: 432 },
  'the heaven & earth grocery store': { words: 125000, pageCount: 400 },
  'the heaven and earth grocery store': { words: 125000, pageCount: 400 },
  'heaven & earth grocery store': { words: 125000, pageCount: 400 },
  'heaven and earth grocery store': { words: 125000, pageCount: 400 },
  'red, white & royal blue': { words: 110000, pageCount: 423 },
  'red white & royal blue': { words: 110000, pageCount: 423 },
  'red white and royal blue': { words: 110000, pageCount: 423 },
  'the things they carried': { words: 65000, pageCount: 233 },
  'side-tracked': { words: 130000, pageCount: 416 },
  'sidetracked': { words: 130000, pageCount: 416 },
  'lily and the octopus': { words: 85000, pageCount: 304 },
  'masked prey': { words: 110000, pageCount: 400 },
  'the wishing game': { words: 82500, pageCount: 304 },
  'for the win': { words: 150000, pageCount: 480 },
  'desert star': { words: 105000, pageCount: 400 },
  'the worst hard time': { words: 130000, pageCount: 368 },
  'special topics in calamity physics': { words: 180000, pageCount: 528 },
  'the late show': { words: 105000, pageCount: 448 },
  'worst ship in the fleet': { words: 40000, pageCount: 160 },
  'the three-body problem': { words: 135000, pageCount: 400 },
  'three-body problem': { words: 135000, pageCount: 400 },
  'remarkably bright creatures': { words: 86350, pageCount: 368 },
  "caliban's war": { words: 194688, pageCount: 624 },
  'calibans war': { words: 194688, pageCount: 624 },
  'my brilliant friend': { words: 110000, pageCount: 336 },
  'the thursday murder club': { words: 110000, pageCount: 400 },
  'dark matter': { words: 95000, pageCount: 342 },
  "abaddon's gate": { words: 175000, pageCount: 560 },
  'abaddons gate': { words: 175000, pageCount: 560 },
  'the undervalued self': { words: 90000, pageCount: 320 },
  'my sister, the serial killer': { words: 65000, pageCount: 240 },
  'my sister the serial killer': { words: 65000, pageCount: 240 },
  'the girl on the train': { words: 105000, pageCount: 336 },
  'altered carbon': { words: 140000, pageCount: 416 },
  'the waiting': { words: 93500, pageCount: 416 },
  'the knowledge': { words: 120000, pageCount: 352 },
  'project hail mary': { words: 148512, pageCount: 496 },
  'the vegetarian': { words: 55000, pageCount: 188 },
  'entanglement: the belt': { words: 95000, pageCount: 320 },
  'entanglement the belt': { words: 95000, pageCount: 320 },
  'crime beat': { words: 120000, pageCount: 384 },
  'the posthumous memoirs of brás cubas': { words: 85000, pageCount: 240 },
  'the posthumous memoirs of bras cubas': { words: 85000, pageCount: 240 },
  'knots and crosses': { words: 90000, pageCount: 256 },
  "the monkey's raincoat": { words: 58270, pageCount: 224 },
  'the monkeys raincoat': { words: 58270, pageCount: 224 },
  'in the garden of beasts': { words: 135000, pageCount: 480 },
  'head on': { words: 80000, pageCount: 272 },
  "the hitchhiker's guide to the galaxy": { words: 46333, pageCount: 216 },
  'the hitchhikers guide to the galaxy': { words: 46333, pageCount: 216 },
  'hitchhikers guide to the galaxy': { words: 46333, pageCount: 216 },
  'becoming': { words: 165000, pageCount: 448 },
  'the martian': { words: 104588, pageCount: 384 },
  'educated': { words: 140000, pageCount: 334 },
  'recursion': { words: 84000, pageCount: 336 },
  'the name of the wind': { words: 259000, pageCount: 662 },
  'mistborn': { words: 212000, pageCount: 541 },
  'mistborn: the final empire': { words: 212000, pageCount: 541 },
  'mistborn the final empire': { words: 212000, pageCount: 541 },

  // Community & Popular Club Books
  'dune': { words: 188000, pageCount: 688 },
  'neuromancer': { words: 89000, pageCount: 271 },
  'hyperion': { words: 178000, pageCount: 482 },
  'foundation': { words: 67000, pageCount: 255 },
  'snow crash': { words: 150000, pageCount: 480 },
  'the left hand of darkness': { words: 85000, pageCount: 304 },
  'children of time': { words: 180000, pageCount: 600 },
  'a memory called empire': { words: 140000, pageCount: 462 },
  'do androids dream of electric sheep?': { words: 65000, pageCount: 210 },
  'do androids dream of electric sheep': { words: 65000, pageCount: 210 },
  'machines like me': { words: 85000, pageCount: 304 },
  'i, robot': { words: 70000, pageCount: 224 },
  'i robot': { words: 70000, pageCount: 224 },
  'a psalm for the wild-built': { words: 38000, pageCount: 160 },
  'a psalm for the wild built': { words: 38000, pageCount: 160 },
  'all systems red': { words: 35000, pageCount: 144 },
  'this is how you lose the time war': { words: 44000, pageCount: 208 },
  'fahrenheit 451': { words: 46000, pageCount: 256 },
  'binti': { words: 24000, pageCount: 96 },
  'the dispossessed': { words: 110000, pageCount: 387 },
  'klara and the sun': { words: 88000, pageCount: 303 },
  'sea of tranquility': { words: 75000, pageCount: 272 },
  'red rising': { words: 115000, pageCount: 382 },
  'babel': { words: 170000, pageCount: 544 },
  'the midnight library': { words: 85000, pageCount: 304 },
  'piranesi': { words: 68000, pageCount: 245 },
  'the ocean at the end of the lane': { words: 55000, pageCount: 181 },
  'silver in the wood': { words: 28000, pageCount: 112 },
  'the fifth season': { words: 145000, pageCount: 512 },
  'american gods': { words: 185000, pageCount: 635 },
  'the way of kings': { words: 383000, pageCount: 1007 },
  'book lovers': { words: 105000, pageCount: 384 },
  'beach read': { words: 95000, pageCount: 361 },
  'the seven husbands of evelyn hugo': { words: 110000, pageCount: 400 },
  'normal people': { words: 75000, pageCount: 273 },
  'the silent patient': { words: 95000, pageCount: 336 },
  'gone girl': { words: 145000, pageCount: 432 },
  'the stepford wives': { words: 35000, pageCount: 144 },
  'the shining': { words: 160000, pageCount: 447 },
  'mexican gothic': { words: 90000, pageCount: 304 },
  'sapiens: a brief history of humankind': { words: 135000, pageCount: 443 },
  'sapiens a brief history of humankind': { words: 135000, pageCount: 443 },
  'sapiens': { words: 135000, pageCount: 443 },
  'atomic habits': { words: 85000, pageCount: 320 },
  'demon copperhead': { words: 165000, pageCount: 560 },
  '1984': { words: 88000, pageCount: 328 },
  'nineteen eighty-four': { words: 88000, pageCount: 328 },
  'brave new world': { words: 64000, pageCount: 268 },
  'the great gatsby': { words: 47094, pageCount: 180 },
  'great gatsby': { words: 47094, pageCount: 180 }
};

const _NORMALIZED_OVERRIDE_MAP = new Map();
function _initNormalizedMap() {
  if (_NORMALIZED_OVERRIDE_MAP.size > 0) return;
  const norm = s => (s || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/['’"`]/g, '').replace(/[^a-z0-9]/g, '');
  for (const [k, v] of Object.entries(WORD_COUNT_OVERRIDES)) {
    const n = norm(k);
    if (n) _NORMALIZED_OVERRIDE_MAP.set(n, v);
    const withoutArt = k.toLowerCase().replace(/^(the|a|an)\s+/i, '');
    const nWithoutArt = norm(withoutArt);
    if (nWithoutArt) _NORMALIZED_OVERRIDE_MAP.set(nWithoutArt, v);
    if (k.includes(':') || k.includes(' - ') || k.includes('—')) {
      const main = k.split(/[:\-—]/)[0].trim();
      const nMain = norm(main);
      if (nMain) _NORMALIZED_OVERRIDE_MAP.set(nMain, v);
      const mainWithoutArt = main.replace(/^(the|a|an)\s+/i, '');
      const nMainWithoutArt = norm(mainWithoutArt);
      if (nMainWithoutArt) _NORMALIZED_OVERRIDE_MAP.set(nMainWithoutArt, v);
    }
  }
}

export function lookupWordCountOverride(title) {
  if (!title || typeof title !== 'string') return null;
  const raw = title.toLowerCase().trim();
  if (WORD_COUNT_OVERRIDES[raw]) return WORD_COUNT_OVERRIDES[raw];

  _initNormalizedMap();
  const norm = s => (s || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/['’"`]/g, '').replace(/[^a-z0-9]/g, '');

  const clean = norm(raw);
  if (!clean) return null;
  if (_NORMALIZED_OVERRIDE_MAP.has(clean)) return _NORMALIZED_OVERRIDE_MAP.get(clean);

  const withoutArt = norm(raw.replace(/^(the|a|an)\s+/i, ''));
  if (withoutArt && _NORMALIZED_OVERRIDE_MAP.has(withoutArt)) return _NORMALIZED_OVERRIDE_MAP.get(withoutArt);

  if (raw.includes(':') || raw.includes(' - ') || raw.includes('—')) {
    const main = raw.split(/[:\-—]/)[0].trim();
    const mainNorm = norm(main);
    if (mainNorm && _NORMALIZED_OVERRIDE_MAP.has(mainNorm)) return _NORMALIZED_OVERRIDE_MAP.get(mainNorm);
    const mainNoArt = norm(main.replace(/^(the|a|an)\s+/i, ''));
    if (mainNoArt && _NORMALIZED_OVERRIDE_MAP.has(mainNoArt)) return _NORMALIZED_OVERRIDE_MAP.get(mainNoArt);
  }

  return null;
}

export function dbToBook(row) {
  if (!row) row = {};
  const fmt = row.format || 'physical';
  const rawWc = row.word_count;
  const wcSource = row.word_count_source || null;
  let pageCount = row.page_count || 0;

  const override = lookupWordCountOverride(row.title);
  const isDefaultOrStuck = !rawWc || rawWc === 26000 || rawWc === 25800 || rawWc === 80000 || rawWc === 10000 || rawWc === 0 || pageCount === 86;

  let wc;
  let resolvedSource;
  let wcEstimated;

  if (override && (isDefaultOrStuck || !wcSource || wcSource === 'unknown' || wcSource === 'calculated' || wcSource === 'openlibrary' || wcSource === 'googlebooks')) {
    wc = override.words;
    pageCount = (pageCount && pageCount !== 86) ? pageCount : (override.pageCount || pageCount || 0);
    resolvedSource = 'provided';
    wcEstimated = false;
  } else if (rawWc && rawWc !== 26000 && rawWc !== 25800) {
    wc = rawWc;
    const isDefault = rawWc === 80000 || rawWc === 10000;
    resolvedSource = wcSource || (isDefault ? 'unknown' : 'provided');
    const estimatedSources = ['calculated', 'openlibrary', 'googlebooks', 'unknown'];
    wcEstimated = (typeof row.word_count_estimated === 'boolean')
      ? row.word_count_estimated
      : estimatedSources.includes(resolvedSource);
  } else if (override) {
    wc = override.words;
    pageCount = pageCount || override.pageCount || 0;
    resolvedSource = 'provided';
    wcEstimated = false;
  } else {
    wc = 80000;
    resolvedSource = wcSource || 'unknown';
    wcEstimated = true;
  }

  const durH = fmt === 'audiobook' ? (row.duration_hours || parseFloat((wc / 9000).toFixed(2))) : null;

  return {
    id: row.id,
    shelfId: row.shelf_id,
    title: row.title,
    author: row.author,
    words: wc,
    year: row.pub_year || 0,
    days: row.status === 'to-read' ? 0 : (row.days_to_read || 5),
    sentiment: row.status === 'to-read' ? (row.sentiment || '') : (row.sentiment === 'okay' ? 'mixed' : (row.sentiment || 'mixed')),
    month: row.month_finished || ALL_MONTHS[new Date().getMonth()],
    genre: normalizeGenre(row.genre),
    fiction: row.fiction !== false,
    coverUrl: row.cover_url || '',
    cover: row.cover_url || coverPlaceholder(row.title, row.author, row.sentiment),
    fallbackCover: coverPlaceholder(row.title, row.author, row.sentiment),
    review: row.review || '',
    currentlyReading: row.currently_reading || false,
    dateStarted: row.date_started || null,
    sortOrder: row.sort_order || 0,
    pageCount: pageCount,
    format: fmt,
    durationHours: durH,
    authorGender: row.author_gender_v2 || (row.author_gender ? row.author_gender.charAt(0).toUpperCase() + row.author_gender.slice(1) : null),
    authorGenderConfidence: row.author_gender_confidence || null,
    authorRegion: (DEMO_AUTHOR_REGIONS_V2[row.author]?.region) || row.author_region_v2 || row.author_region || null,
    authorCountry: (DEMO_AUTHOR_REGIONS_V2[row.author]?.country) || row.author_country || null,
    authorRegionV2: (DEMO_AUTHOR_REGIONS_V2[row.author]?.region) || row.author_region_v2 || null,
    demographicsSource: row.demographics_source || null,
    demographicsVerified: row.demographics_verified || false,
    seriesName: row.series_name || null,
    seriesNumber: row.series_number || null,
    isReread: row.is_reread || false,
    _shelfYear: row._shelfYear || null,
    readYear: row.read_year || row.readYear || row._shelfYear || row.original_read_year || null,
    originalReadYear: row.original_read_year || null,
    originalReadId: row.original_read_id || null,
    rereadCount: row.reread_count || 0,
    isbn: row.isbn || null,
    moods: row.moods || [],
    dnf: row.dnf || false,
    dnfReason: row.dnf_reason || null,
    bookOfYear: row.book_of_year || null,
    dateFinished: row.date_finished || null,
    wordCountSource: resolvedSource,
    wordCountEstimated: wcEstimated,
    status: row.status || (row.currently_reading ? 'reading' : 'finished'),
    language: row.language || 'English',
    toReadNotes: row.to_read_notes || null,
    isPrivate: row.is_private === true,
    favoriteQuotes: row.favorite_quotes || '',
    narrator: row.narrator || null,
    readingClub: row.reading_club || null,
    queueOrder: row.queue_order || 0,
    collectionName: row.collection_name || null,
    readingSessions: Array.isArray(row.reading_sessions) ? row.reading_sessions : [],
    _dbId: row.id,
    _shelfId: row.shelf_id,
  };
}

// ==========================================
// 3. SyncQueue Offline Mutation Manager
// ==========================================

export const SyncQueue = {
  getQueue() {
    try {
      return JSON.parse(localStorage.getItem('sl_sync_queue') || '[]');
    } catch (e) {
      return [];
    }
  },
  setQueue(q) {
    try {
      localStorage.setItem('sl_sync_queue', JSON.stringify(q));
    } catch (e) {}
  },
  add(method, args) {
    const q = this.getQueue();
    q.push({ id: Date.now() + Math.random(), method, args, timestamp: Date.now() });
    this.setQueue(q);
  },
  async process() {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    const q = this.getQueue();
    if (q.length === 0) return;

    if (typeof window !== 'undefined' && window.App && typeof window.App.showToast === 'function') {
      window.App.showToast('Syncing offline changes...');
    }

    const failed = [];
    this.setQueue([]);

    for (let item of q) {
      try {
        if (DB[item.method]) await DB[item.method](...item.args);
      } catch (e) {
        console.error('SyncQueue error:', item.method, e);
        failed.push(item);
      }
    }
    if (failed.length > 0) {
      const current = this.getQueue();
      this.setQueue([...failed, ...current]);
    }
  }
};

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => SyncQueue.process());
}

// ==========================================
// 4. DB Database Operations (62 Methods)
// ==========================================

export const DB = {
  // --- Shelves (5 methods) ---
  async getOrCreateShelf(userId, year) {
    const isDemo = (typeof App !== 'undefined' && App.isDemoMode) || (typeof window !== 'undefined' && window.App && window.App.isDemoMode);
    if (isDemo) {
      return { id: 'demo-shelf-' + year, user_id: userId || 'demo-user', year: year };
    }
    if (!_supabase || !userId || userId === 'null' || userId === 'undefined') return null;
    let { data, error } = await _supabase
      .from('shelves')
      .select('*')
      .eq('user_id', userId)
      .eq('year', year)
      .maybeSingle();

    if (error) {
      console.error('getOrCreateShelf error:', error);
      return null;
    }
    if (data) return data;

    const { data: newShelf, error: createErr } = await _supabase
      .from('shelves')
      .insert({ user_id: userId, year: year, public: true })
      .select()
      .single();

    if (createErr) {
      console.error('createShelf error:', createErr);
      return null;
    }
    return newShelf;
  },

  async getUserYears(userId) {
    if (!_supabase) return [];
    const { data, error } = await _supabase
      .from('shelves')
      .select('year, id, public')
      .eq('user_id', userId)
      .order('year', { ascending: false });

    if (error) {
      console.error('getUserYears error:', error);
      return [];
    }
    return data || [];
  },

  async getUserShelves(userId) {
    return this.getUserYears(userId);
  },

  async updateShelfPublic(shelfId, isPublic) {
    if (!_supabase) return;
    const { error } = await _supabase
      .from('shelves')
      .update({ public: isPublic })
      .eq('id', shelfId);

    if (error) console.error('updateShelfPublic error:', error);
  },

  async getPublicShelf(shelfId) {
    if (!_supabase || !shelfId) return null;
    // Shelves are public by default unless explicitly set to false
    const { data, error } = await _supabase
      .from('shelves')
      .select('*')
      .eq('id', shelfId)
      .neq('public', false)
      .maybeSingle();

    if (!error && data) return data;

    // Fallback: Check without neq filter in case public is null
    const { data: fallback, error: fbErr } = await _supabase
      .from('shelves')
      .select('*')
      .eq('id', shelfId)
      .maybeSingle();

    if (!fbErr && fallback && fallback.public !== false) {
      return fallback;
    }
    return null;
  },

  async deleteShelfAndBooks(shelfId) {
    if (!_supabase) return true;
    const { error: booksErr } = await _supabase
      .from('books')
      .delete()
      .eq('shelf_id', shelfId);

    if (booksErr) console.error('deleteShelfBooks error:', booksErr);

    const { error: shelfErr } = await _supabase
      .from('shelves')
      .delete()
      .eq('id', shelfId);

    if (shelfErr) {
      console.error('deleteShelf error:', shelfErr);
      return false;
    }
    return true;
  },

  // --- Books (9 methods) ---
  async getShelfBooks(shelfId) {
    if (!_supabase) return [];
    const { data, error } = await _supabase
      .from('books')
      .select('*')
      .eq('shelf_id', shelfId)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('getShelfBooks error:', error);
      return [];
    }
    return data || [];
  },

  async addBook(bookData) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      if (!bookData.id) bookData.id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'offline-' + Date.now();
      SyncQueue.add('addBook', [bookData]);
      return bookData;
    }
    const isDemo = (typeof App !== 'undefined' && App.isDemoMode) || (typeof window !== 'undefined' && window.App && window.App.isDemoMode);
    if (isDemo) {
      if (!bookData.id) bookData.id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'demo-' + Date.now();
      return bookData;
    }
    if (!_supabase) return null;

    const { data, error } = await _supabase
      .from('books')
      .insert(bookData)
      .select()
      .single();

    if (error) {
      console.error('addBook error:', error);
      return null;
    }
    return data;
  },

  async updateBook(bookId, updates) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      SyncQueue.add('updateBook', [bookId, updates]);
      return;
    }
    const isDemo = (typeof App !== 'undefined' && App.isDemoMode) || (typeof window !== 'undefined' && window.App && window.App.isDemoMode);
    if (!_supabase || isDemo) return;

    const { error } = await _supabase
      .from('books')
      .update(updates)
      .eq('id', bookId);

    if (error) console.error('updateBook error:', error);
  },

  async deleteBook(bookId) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      SyncQueue.add('deleteBook', [bookId]);
      return;
    }
    const isDemo = (typeof App !== 'undefined' && (App.isDemoMode || App.isGuestImport)) || (typeof window !== 'undefined' && window.App && (window.App.isDemoMode || window.App.isGuestImport));
    if (!_supabase || isDemo) return;

    const { error } = await _supabase
      .from('books')
      .delete()
      .eq('id', bookId);

    if (error) console.error('deleteBook error:', error);
  },

  async addBooks(booksArray) {
    const isDemo = (typeof App !== 'undefined' && App.isDemoMode) || (typeof window !== 'undefined' && window.App && window.App.isDemoMode);
    if (!_supabase || isDemo) return [];
    if (!booksArray.length) return [];

    const { data, error } = await _supabase
      .from('books')
      .insert(booksArray)
      .select();

    if (error) {
      console.error('addBooks error:', error);
      return [];
    }
    return data || [];
  },

  async getPublicShelfBooks(shelfId) {
    if (!_supabase) return [];
    const { data, error } = await _supabase
      .from('books')
      .select('*')
      .eq('shelf_id', shelfId)
      .order('sort_order', { ascending: true });

    if (error) return [];
    return data || [];
  },

  async getPublicUserBooks(userId) {
    const books = await this.getAllUserBooks(userId);
    return (books || []).filter(b => b && b.is_private !== true);
  },

  async updateBookOrder(bookId, sortOrder) {
    const isDemo = (typeof App !== 'undefined' && App.isDemoMode) || (typeof window !== 'undefined' && window.App && window.App.isDemoMode);
    if (!_supabase || isDemo) return;
    await _supabase.from('books').update({ sort_order: sortOrder }).eq('id', bookId);
  },

  async getAllUserBooks(userId) {
    if (!userId || !_supabase) return [];
    const { data: shelves, error: shErr } = await _supabase
      .from('shelves')
      .select('id, year')
      .eq('user_id', userId);

    if (shErr || !shelves || !shelves.length) return [];

    const shelfIds = shelves.map(s => s.id);
    const shelfYearMap = {};
    shelves.forEach(s => { shelfYearMap[s.id] = s.year; });

    let allBooks = [];
    for (let i = 0; i < shelfIds.length; i += 50) {
      const chunk = shelfIds.slice(i, i + 50);
      const { data, error } = await _supabase
        .from('books')
        .select('*')
        .in('shelf_id', chunk);

      if (!error && data) allBooks = allBooks.concat(data);
    }
    allBooks.forEach(b => { b._shelfYear = shelfYearMap[b.shelf_id] || null; });
    return allBooks;
  },

  // --- User Profiles (14 methods) ---
  async getUserProfile(userId) {
    if (!_supabase || !userId) return null;
    const { data, error } = await _supabase
      .from('user_profiles')
      .select('user_id, username, display_name, bio, profile_public, avatar_emoji, created_at, updated_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      const { data: d2 } = await _supabase
        .from('user_profiles')
        .select('user_id, display_name, profile_public, avatar_emoji, created_at, updated_at')
        .eq('user_id', userId)
        .maybeSingle();

      if (d2) return d2;
      console.error('getUserProfile error:', error);
      return null;
    }
    return data;
  },

  async updateUsername(userId, username) {
    if (!_supabase) return null;
    const { data, error } = await _supabase.from('user_profiles').update({ username }).eq('user_id', userId).select();
    if (error) console.error('updateUsername error:', error);
    return data;
  },

  async updateBio(userId, bio) {
    if (!_supabase) return false;
    const { error } = await _supabase
      .from('user_profiles')
      .update({ bio: bio || null })
      .eq('user_id', userId);

    if (error) {
      console.error('updateBio error:', error);
      return false;
    }
    return true;
  },

  async upsertUserProfile(userId, email, displayName) {
    if (!_supabase) return null;
    const safeDisplayName = normalizeDisplayName(displayName, email);
    const payload = {
      user_id: userId,
      email: email || null,
      display_name: safeDisplayName
    };
    const { data, error } = await _supabase
      .from('user_profiles')
      .upsert(payload, { onConflict: 'user_id' })
      .select('user_id, display_name, profile_public, avatar_emoji, created_at, updated_at')
      .maybeSingle();

    if (error) {
      console.error('upsertUserProfile error:', error);
      return null;
    }
    return data;
  },

  async updateDisplayName(userId, email, displayName) {
    if (!_supabase) return null;
    const safeDisplayName = normalizeDisplayName(displayName, email);
    const { data, error } = await _supabase
      .from('user_profiles')
      .update({ display_name: safeDisplayName })
      .eq('user_id', userId)
      .select('user_id, display_name, profile_public, avatar_emoji, created_at, updated_at')
      .maybeSingle();

    if (error) {
      console.error('updateDisplayName error:', error);
      return null;
    }
    return data;
  },

  async updateProfilePublic(userId, isPublic) {
    if (!_supabase) return { user_id: userId, profile_public: !!isPublic };
    const { data, error } = await _supabase
      .from('user_profiles')
      .update({ profile_public: !!isPublic })
      .eq('user_id', userId)
      .select('user_id, display_name, profile_public, avatar_emoji, created_at, updated_at')
      .maybeSingle();

    if (error) {
      console.error('updateProfilePublic error:', error);
      return null;
    }
    return data;
  },

  async getPublicProfiles(excludeUserId) {
    if (!_supabase) return [];
    const { data, error } = await _supabase
      .from('user_profiles')
      .select('user_id, username, display_name, profile_public, avatar_emoji, email');

    if (error) {
      console.warn('getPublicProfiles error:', error);
      return [];
    }
    return (data || []).filter(p => p.user_id !== excludeUserId && !(p.display_name || '').toLowerCase().includes('test')).sort(() => Math.random() - 0.5);
  },

  async getFollowing(userId) {
    if (!userId || !_supabase) return [];
    const { data, error } = await _supabase
      .from('user_profiles')
      .select('following_ids')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.warn('getFollowing error:', error);
      return [];
    }
    let res = (data && Array.isArray(data.following_ids)) ? data.following_ids : [];
    const DINO_UUID = 'eae3ea25-9539-42ac-9e19-82039130c25f';
    if (userId !== DINO_UUID && !res.includes(DINO_UUID)) {
      res.push(DINO_UUID);
      this.setFollowing(userId, res);
    }
    return res;
  },

  async setFollowing(userId, ids) {
    if (!_supabase || !userId) return false;
    const clean = Array.from(new Set((ids || []).filter(Boolean)));
    const { error } = await _supabase
      .from('user_profiles')
      .update({ following_ids: clean })
      .eq('user_id', userId);

    if (error) {
      console.warn('setFollowing error:', error);
      return false;
    }
    return true;
  },

  async getFollowers(userId) {
    if (!userId || !_supabase) return [];
    const { data, error } = await _supabase
      .from('user_profiles')
      .select('user_id, display_name, avatar_emoji, profile_public')
      .contains('following_ids', [userId]);

    if (error) {
      console.warn('getFollowers error:', error);
      return [];
    }
    return data || [];
  },

  async getReadingGoals(userId) {
    if (!userId || !_supabase) return {};
    const { data, error } = await _supabase
      .from('user_profiles')
      .select('reading_goals')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.warn('getReadingGoals failed:', error.message);
      return {};
    }
    return (data && data.reading_goals) ? data.reading_goals : {};
  },

  async setReadingGoal(userId, year, target) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      SyncQueue.add('setReadingGoal', [userId, year, target]);
      return true;
    }
    if (!userId || !_supabase) return false;

    const goals = await this.getReadingGoals(userId);
    if (target && target > 0) goals[year] = target;
    else delete goals[year];

    const { error } = await _supabase
      .from('user_profiles')
      .upsert({ user_id: userId, reading_goals: goals, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });

    if (error) {
      console.warn('setReadingGoal failed:', error.message);
      return false;
    }
    return true;
  },

  async getNotificationPrefs(userId) {
    if (!userId || !_supabase) return {};
    const { data } = await _supabase.from('user_profiles').select('notification_prefs').eq('user_id', userId).maybeSingle();
    return data?.notification_prefs || {};
  },

  async updateNotificationPrefs(userId, prefs) {
    if (!_supabase || !userId) return false;
    const { error } = await _supabase.from('user_profiles').upsert({ user_id: userId, notification_prefs: prefs }, { onConflict: 'user_id' });
    return !error;
  },

  // --- Achievements & Telemetry (6 methods) ---
  async recordAchievement(userId, type, data = {}) {
    if (!userId || !type || !_supabase) return false;
    try {
      const { error } = await _supabase
        .from('achievements')
        .insert({ user_id: userId, type, data });

      if (error && error.code !== '23505') {
        console.warn('recordAchievement error:', error);
        return false;
      }
      return true;
    } catch (e) {
      console.warn('recordAchievement threw:', e);
      return false;
    }
  },

  async getAchievementsFeed(opts = {}) {
    if (!_supabase) return [];
    opts = opts || {};
    const { limit = 40, fromUserIds = null } = opts;

    let q = _supabase
      .from('achievements')
      .select('id, user_id, type, data, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (Array.isArray(fromUserIds)) {
      if (!fromUserIds.length) return [];
      q = q.in('user_id', fromUserIds);
    }

    const { data, error } = await q;
    if (error) {
      console.warn('getAchievementsFeed error:', error);
      return [];
    }
    const rows = data || [];
    if (!rows.length) return [];

    const uids = Array.from(new Set(rows.map(r => r.user_id)));
    const { data: profs } = await _supabase
      .from('user_profiles')
      .select('user_id, display_name, avatar_emoji, profile_public')
      .in('user_id', uids);

    const pmap = {};
    (profs || []).forEach(p => { pmap[p.user_id] = p; });

    return rows
      .filter(r => pmap[r.user_id])
      .map(r => ({
        ...r,
        _name: pmap[r.user_id].display_name || 'A reader',
        _avatar: (typeof window !== 'undefined' && window.App && typeof window.App._getUserAvatar === 'function')
          ? window.App._getUserAvatar(pmap[r.user_id])
          : (pmap[r.user_id].avatar_emoji || '👤')
      }));
  },

  async getSocialFeed(opts = {}) {
    if (!_supabase) return [];
    opts = opts || {};
    const { limit = 40, fromUserIds = null } = opts;
    const achs = await this.getAchievementsFeed({ limit, fromUserIds });

    let q = _supabase
      .from('books')
      .select('id, user_id, title, author, cover_url, status, date_started, date_finished, created_at, sentiment, format')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (Array.isArray(fromUserIds) && fromUserIds.length) {
      q = q.in('user_id', fromUserIds);
    }

    const { data: bks } = await q;
    let all = [...achs];

    if (bks) {
      const profs = await _supabase
        .from('user_profiles')
        .select('user_id, display_name, avatar_emoji, profile_public')
        .in('user_id', Array.from(new Set(bks.map(b => b.user_id))));

      const pmap = {};
      (profs?.data || []).forEach(p => { pmap[p.user_id] = p; });

      bks.forEach(b => {
        if (!pmap[b.user_id]) return;
        const _name = pmap[b.user_id].display_name || 'A reader';
        const _avatar = (typeof window !== 'undefined' && window.App && typeof window.App._getUserAvatar === 'function')
          ? window.App._getUserAvatar(pmap[b.user_id])
          : (pmap[b.user_id].avatar_emoji || '❌');

        if (b.status === 'reading' || b.date_started) {
          all.push({
            id: 'cr_' + b.id,
            user_id: b.user_id,
            type: 'started_book',
            created_at: b.created_at || b.date_started,
            data: { title: b.title, author: b.author, cover: b.cover_url, format: b.format },
            _name,
            _avatar
          });
        }
        if (b.status === 'finished') {
          all.push({
            id: 'fin_' + b.id,
            user_id: b.user_id,
            type: 'finished_book',
            created_at: b.created_at || b.date_finished,
            data: { title: b.title, author: b.author, cover: b.cover_url, sentiment: b.sentiment, format: b.format },
            _name,
            _avatar
          });
        }
      });
    }

    all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return all.slice(0, limit);
  },

  async getMyAchievements(userId) {
    if (!_supabase || !userId) return [];
    const { data, error } = await _supabase
      .from('achievements')
      .select('id, type, created_at, data')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('getMyAchievements:', error);
      return [];
    }
    return data || [];
  },

  async getAchievementRarityCounts() {
    if (!_supabase) return {};
    try {
      const [achRes, usersRes] = await Promise.all([
        _supabase.from('achievements').select('type'),
        _supabase.from('user_profiles').select('user_id', { count: 'exact', head: true })
      ]);

      const counts = {};
      ((achRes && achRes.data) || []).forEach(a => {
        counts[a.type] = (counts[a.type] || 0) + 1;
      });
      counts._totalUsers = (usersRes && usersRes.count) || 0;
      return counts;
    } catch (e) {
      return {};
    }
  },

  getVisitorId() {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return null;
      let vid = window.localStorage.getItem('sl_vid');
      if (!vid) {
        vid = 'v_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
        window.localStorage.setItem('sl_vid', vid);
      }
      return vid;
    } catch (e) {
      return null;
    }
  },

  async trackEvent(eventType, eventData = {}) {
    const isDemo = (typeof App !== 'undefined' && App.isDemoMode) || (typeof window !== 'undefined' && window.App && window.App.isDemoMode);
    if (!_supabase || isDemo) return;
    try {
      const vid = this.getVisitorId();
      const userId = (typeof window !== 'undefined' && window.App && window.App.userId) ? window.App.userId : null;
      const isAnon = !userId;

      if (eventType === 'page_view') {
        try {
          const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
          const device = /iPad|Tablet/i.test(ua) ? 'Tablet'
            : (/Mobi|Android|iPhone|iPod/i.test(ua) ? 'Mobile' : 'Desktop');
          const browser = /Edg\//.test(ua) ? 'Edge'
            : /OPR\/|Opera/.test(ua) ? 'Opera'
            : /Firefox\//.test(ua) ? 'Firefox'
            : /Chrome\//.test(ua) ? 'Chrome'
            : /Safari\//.test(ua) ? 'Safari' : 'Other';
          const os = /Windows/.test(ua) ? 'Windows'
            : /Mac OS X|Macintosh/.test(ua) ? 'macOS'
            : /Android/.test(ua) ? 'Android'
            : /iPhone|iPad|iPod/.test(ua) ? 'iOS'
            : /Linux/.test(ua) ? 'Linux' : 'Other';

          const urlParams = (typeof window !== 'undefined' && window.location) ? new URLSearchParams(window.location.search) : null;
          const shelfParam = urlParams ? urlParams.get('shelf') : null;
          const referrerType = shelfParam ? 'shared_shelf' : ((typeof document !== 'undefined' && document.referrer) ? 'external' : 'direct');

          eventData = Object.assign({
            device,
            browser,
            os,
            visitor_id: vid,
            is_anonymous: isAnon,
            referrer_type: referrerType,
            shelf_id: shelfParam || null
          }, eventData || {});
        } catch (e) {}
      } else {
        eventData = Object.assign({ visitor_id: vid, is_anonymous: isAnon }, eventData || {});
      }

      const payload = {
        user_id: userId,
        event_type: eventType,
        event_data: eventData || {}
      };
      const { error } = await _supabase.from('usage_events').insert(payload);
      if (error) console.warn('trackEvent failed:', error.message);
    } catch (e) {
      console.warn('trackEvent exception:', e && e.message);
    }
  },

  // --- Book Notes (4 methods) ---
  async sendBookNote(opts = {}) {
    if (!_supabase) return null;
    opts = opts || {};
    const { senderId, recipientId, bookId, bookTitle, bookAuthor, bookCover, noteText, triggerStatus } = opts;
    if (!senderId || !recipientId || !bookId || !noteText) return null;

    const payload = {
      sender_id: senderId,
      recipient_id: recipientId,
      book_id: bookId,
      note_text: String(noteText).slice(0, 500),
      trigger_status: triggerStatus || 'finished',
      book_title: bookTitle || null,
      book_author: bookAuthor || null,
      book_cover: bookCover || null
    };

    const { data, error } = await _supabase.from('book_notes').insert(payload).select('*').maybeSingle();
    if (error) {
      console.warn('sendBookNote error:', error);
      return null;
    }
    return data;
  },

  async getReceivedNotes(userId, unreadOnly = false) {
    if (!userId || !_supabase) return [];
    let q = _supabase.from('book_notes').select('*').eq('recipient_id', userId).order('created_at', { ascending: false });
    if (unreadOnly) q = q.is('read_at', null);

    const { data, error } = await q;
    if (error) {
      console.warn('getReceivedNotes error:', error);
      return [];
    }
    const rows = data || [];
    if (!rows.length) return [];

    const uids = Array.from(new Set(rows.map(r => r.sender_id)));
    const { data: profs } = await _supabase.from('user_profiles').select('user_id, display_name, avatar_emoji').in('user_id', uids);
    const pmap = {};
    (profs || []).forEach(p => { pmap[p.user_id] = p; });

    return rows.map(r => ({
      ...r,
      _name: (pmap[r.sender_id] && pmap[r.sender_id].display_name) || 'A reader',
      _avatar: (pmap[r.sender_id] && pmap[r.sender_id].avatar_emoji) || '📚'
    }));
  },

  async getSentNotes(userId) {
    if (!userId || !_supabase) return [];
    const { data, error } = await _supabase.from('book_notes').select('*').eq('sender_id', userId).order('created_at', { ascending: false });
    if (error) {
      console.warn('getSentNotes error:', error);
      return [];
    }
    const rows = data || [];
    if (!rows.length) return [];

    const uids = Array.from(new Set(rows.map(r => r.recipient_id)));
    const { data: profs } = await _supabase.from('user_profiles').select('user_id, display_name, avatar_emoji').in('user_id', uids);
    const pmap = {};
    (profs || []).forEach(p => { pmap[p.user_id] = p; });

    return rows.map(r => ({
      ...r,
      _name: (pmap[r.recipient_id] && pmap[r.recipient_id].display_name) || 'A reader',
      _avatar: (pmap[r.recipient_id] && pmap[r.recipient_id].avatar_emoji) || '📚'
    }));
  },

  async markNoteRead(noteId) {
    if (!noteId || !_supabase) return false;
    const { error } = await _supabase.from('book_notes').update({ read_at: new Date().toISOString() }).eq('id', noteId);
    if (error) {
      console.warn('markNoteRead error:', error);
      return false;
    }
    return true;
  },

  // --- Reading Journal (3 methods) ---
  async addJournalEntry(bookId, userId, type, content) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      SyncQueue.add('addJournalEntry', [bookId, userId, type, content]);
      return { book_id: bookId, user_id: userId, type, content, created_at: new Date().toISOString() };
    }
    if (!_supabase || !userId) return null;

    const { data, error } = await _supabase.from('journal_entries').insert({ book_id: bookId, user_id: userId, entry_type: type, content }).select().single();
    if (error) {
      console.warn('addJournalEntry:', error.message);
      return null;
    }
    return data;
  },

  async getJournalEntries(bookId, userId) {
    if (!userId || !_supabase) return [];
    const { data } = await _supabase.from('journal_entries').select('*').eq('book_id', bookId).eq('user_id', userId).order('created_at', { ascending: false });
    return data || [];
  },

  async deleteJournalEntry(id) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      SyncQueue.add('deleteJournalEntry', [id]);
      return true;
    }
    if (!_supabase) return false;

    const { error } = await _supabase.from('journal_entries').delete().eq('id', id);
    return !error;
  },

  // --- Feed Reactions & Comments (4 methods) ---
  async toggleReaction(achievementId, userId, emoji) {
    if (!_supabase || !userId) return null;
    const { data: ex } = await _supabase.from('feed_reactions').select('id,emoji').eq('achievement_id', achievementId).eq('user_id', userId).maybeSingle();
    if (ex) {
      if (ex.emoji === emoji) {
        await _supabase.from('feed_reactions').delete().eq('id', ex.id);
        return null;
      }
      await _supabase.from('feed_reactions').update({ emoji }).eq('id', ex.id);
      return emoji;
    }
    await _supabase.from('feed_reactions').insert({ achievement_id: achievementId, user_id: userId, emoji });
    return emoji;
  },

  async getReactionCounts(achievementIds) {
    if (!_supabase || !achievementIds || !achievementIds.length) return [];
    const { data } = await _supabase.from('feed_reactions').select('achievement_id,emoji,user_id').in('achievement_id', achievementIds);
    return data || [];
  },

  async addFeedComment(achievementId, userId, content) {
    if (!_supabase || !userId) return null;
    const { data, error } = await _supabase.from('feed_comments').insert({ achievement_id: achievementId, user_id: userId, content }).select().single();
    if (error) {
      console.warn('addFeedComment:', error.message);
      return null;
    }
    return data;
  },

  async getFeedComments(achievementId) {
    if (!_supabase) return [];
    const { data } = await _supabase.from('feed_comments').select('id,content,created_at,user_id,user_profiles!user_id(display_name,avatar_emoji)').eq('achievement_id', achievementId).order('created_at', { ascending: true });
    return data || [];
  },

  // --- Clubs, Discussion, Nominations, Push (17 methods) ---
  async createClub(name, description, userId) {
    if (!_supabase || !userId || (typeof App !== 'undefined' && App.isDemoMode)) {
      const newMockClub = {
        id: 'mock_club_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
        name: name || 'Reading Club',
        description: description || '',
        created_by: userId || 'demo_user',
        invite_code: Math.random().toString(36).substring(2, 6).toUpperCase(),
        myRole: 'admin',
        isPublic: false,
        memberCount: 1,
        past_reads: [],
        current_book_title: '',
        current_book_author: '',
        current_book_cover: ''
      };
      if (typeof window !== 'undefined') {
        window._mockClubs = window._mockClubs || [];
        window._mockClubs.push(newMockClub);
        window._mockClubMembers = window._mockClubMembers || {};
        window._mockClubMembers[newMockClub.id] = [
          { user_id: userId || 'demo_user', role: 'admin', user_profiles: { display_name: 'You', avatar_emoji: '🤠' } }
        ];
      }
      return newMockClub;
    }
    const code = Math.random().toString(36).substring(2, 6).toUpperCase();
    const { data, error } = await _supabase.from('clubs').insert({ name, description, created_by: userId, invite_code: code }).select().single();
    if (error) {
      console.warn('createClub:', error.message);
      return null;
    }
    await _supabase.from('club_members').insert({ club_id: data.id, user_id: userId, role: 'admin' });
    return data;
  },

  async getClubMembers(clubId) {
    if (!_supabase) return [];
    try {
      const { data, error } = await _supabase.from('club_members').select('user_id, role').eq('club_id', clubId);
      if (error) {
        console.warn('getClubMembers error:', error.message);
        return [];
      }
      
      const members = data || [];
      if (members.length > 0) {
        const userIds = [...new Set(members.map(m => m.user_id))].filter(Boolean);
        if (userIds.length > 0) {
          const { data: profs } = await _supabase.from('user_profiles').select('user_id, display_name, avatar_emoji').in('user_id', userIds);
          if (profs) {
            const profMap = {};
            profs.forEach(p => { profMap[p.user_id] = p; });
            members.forEach(m => {
              if (m.user_id && profMap[m.user_id]) {
                m.user_profiles = profMap[m.user_id];
              }
            });
          }
        }
      }
      return members;
    } catch (e) {
      console.warn('getClubMembers exception:', e);
      return [];
    }
  },

  async getPublicClubs() {
    if (!_supabase || (typeof App !== 'undefined' && App.isDemoMode)) {
      if (typeof window !== 'undefined' && window._mockClubs) {
        return window._mockClubs.filter(c => c.isPublic || (c.invite_code && c.invite_code.startsWith('PUBLIC_')));
      }
      return [
        { id: 'mock_c1', name: 'Sci-Fi Sundays', description: 'Exploring the outer limits of imagination.', current_book_title: 'Dune', current_book_author: 'Frank Herbert', current_book_cover: 'https://books.google.com/books/content?vid=ISBN9780441172719&printsec=frontcover&img=1&zoom=1', memberCount: 42, isPublic: true, invite_code: 'PUBLIC_c1' },
        { id: 'mock_c2', name: 'The Classics', description: 'Re-reading the books we were supposed to read in high school.', current_book_title: '1984', current_book_author: 'George Orwell', current_book_cover: 'https://books.google.com/books/content?vid=ISBN9780451524935&printsec=frontcover&img=1&zoom=1', memberCount: 128, isPublic: true, invite_code: 'PUBLIC_c2' }
      ];
    }
    const { data } = await _supabase.from('clubs').select('*').like('invite_code', 'PUBLIC_%');
    
      if (data) {
        data.forEach(c => {
          if (c.invite_code) {
            let core = c.invite_code.startsWith('PUBLIC_') ? c.invite_code.replace('PUBLIC_', '') : c.invite_code;
            if (core.length > 4) {
              const newCore = core.substring(0,4);
              const fullNewCode = c.invite_code.startsWith('PUBLIC_') ? 'PUBLIC_' + newCore : newCore;
              c.invite_code = fullNewCode;
              _supabase.from('clubs').update({ invite_code: fullNewCode }).eq('id', c.id).then();
            }
          }
        });
      }
      return data || [];
  },

  async getMyClubs(userId) {
    if (!_supabase || (typeof App !== 'undefined' && App.isDemoMode)) {
      if (typeof window !== 'undefined' && window._mockClubs) {
        return window._mockClubs.filter(c => !c.isPublic || c.myRole === 'member' || c.myRole === 'admin');
      }
      return [
        { id: 'mock_c1', name: 'Sci-Fi Sundays', description: 'Exploring the outer limits of imagination.', current_book_title: 'Project Hail Mary', current_book_author: 'Andy Weir', current_book_cover: 'https://books.google.com/books/content?vid=ISBN9780593135204&printsec=frontcover&img=1&zoom=1', myRole: 'admin', isPublic: false, invite_code: 'SCIFI2026' }
      ];
    }
    if (!userId) return [];
    const { data } = await _supabase.from('club_members').select('club_id,role,clubs(*)').eq('user_id', userId);
    
      if (data) {
        data.forEach(r => {
          let c = r.clubs;
          if (c && c.invite_code) {
            let core = c.invite_code.startsWith('PUBLIC_') ? c.invite_code.replace('PUBLIC_', '') : c.invite_code;
            if (core.length > 4) {
              const newCore = core.substring(0,4);
              const fullNewCode = c.invite_code.startsWith('PUBLIC_') ? 'PUBLIC_' + newCore : newCore;
              c.invite_code = fullNewCode;
              _supabase.from('clubs').update({ invite_code: fullNewCode }).eq('id', c.id).then();
            }
          }
        });
      }
      return (data || []).map(r => ({ ...r.clubs, myRole: r.role }));
  },

  async getClubBooks(clubId) {
    if (!clubId || !_supabase) return [];
    
    // Fetch members to map user_ids to display names
    const members = await this.getClubMembers(clubId);
    const memberMap = {};
    if (members) {
      members.forEach(m => {
        memberMap[m.user_id] = m.user_profiles?.display_name || 'A Member';
      });
    }

    const { data, error } = await _supabase.from('books').select('*').eq('reading_club', clubId);
    if (error) {
      console.error('getClubBooks error:', error);
      return [];
    }
    
    const groups = {};
    for (const row of (data || [])) {
      const titleLower = (row.title || '').toLowerCase().trim();
      if (!groups[titleLower]) {
        groups[titleLower] = [];
      }
      groups[titleLower].push(row);
    }
    
    const sentimentMap = { 'dislike': -1, 'mixed': 0, 'okay': 0, 'like': 1, 'love': 2 };
    const revSentimentMap = { '-1': 'dislike', '0': 'mixed', '1': 'like', '2': 'love' };
    const uniqueBooks = [];
    
    for (const title in groups) {
      const rows = groups[title];
      let totalDays = 0;
      let totalSentiment = 0;
      let daysCount = 0;
      let sentimentCount = 0;
      const clubReviews = [];
      
      for (const r of rows) {
        if (typeof r.days_to_read === 'number') {
          totalDays += r.days_to_read;
          daysCount++;
        }
        const s = r.sentiment || 'mixed';
        if (sentimentMap[s] !== undefined) {
          totalSentiment += sentimentMap[s];
          sentimentCount++;
        }
        
        if (r.review && r.review.trim() !== '') {
          clubReviews.push({
            reviewerName: memberMap[r.user_id] || 'A Member',
            text: r.review.trim(),
            sentiment: s
          });
        }
      }
      
      const avgDays = daysCount > 0 ? Math.round(totalDays / daysCount) : 5;
      const avgSentimentScore = sentimentCount > 0 ? Math.round(totalSentiment / sentimentCount) : 0;
      const avgSentiment = revSentimentMap[String(avgSentimentScore)] || 'mixed';
      
      const baseRow = rows[0];
      const aggregatedBook = dbToBook(baseRow);
      aggregatedBook.days = avgDays;
      aggregatedBook.sentiment = avgSentiment;
      aggregatedBook._clubReviews = clubReviews;
      
      uniqueBooks.push(aggregatedBook);
    }
    
    return uniqueBooks;
  },

  async joinClub(clubId, userId) {
    const currentUserId = userId || (typeof App !== 'undefined' ? App.userId : null) || 'current_user';
    const currentUserName = (typeof App !== 'undefined' && App.userProfile?.display_name) || (typeof App !== 'undefined' && App.userName) || 'You';
    const currentUserAvatar = (typeof App !== 'undefined' && App.userProfile?.avatar_emoji) || (typeof App !== 'undefined' && App.userAvatar) || '🤠';

    if (!_supabase || (typeof App !== 'undefined' && App.isDemoMode) || String(clubId).startsWith('mock_')) {
      let club = (typeof window !== 'undefined' && window._mockClubs) ? window._mockClubs.find(c => c.id === clubId) : null;
      if (!club && typeof App !== 'undefined' && App.clubs) club = App.clubs.find(c => c.id === clubId);
      if (!club) {
        const isC1 = clubId === 'mock_c1';
        const isC2 = clubId === 'mock_c2';
        club = { 
          id: clubId, 
          name: isC1 ? 'Sci-Fi Sundays' : (isC2 ? 'The Classics' : 'Reading Club'), 
          invite_code: 'PUBLIC_' + Math.random().toString(36).substring(2,6).toUpperCase(), 
          isPublic: true 
        };
      }
      club.myRole = 'member';
      club.isPublic = false;
      if (typeof window !== 'undefined') {
        window._mockClubMembers = window._mockClubMembers || {};
        window._mockClubMembers[clubId] = window._mockClubMembers[clubId] || [
          { user_id: 'u1', role: 'member', user_profiles: { display_name: 'Alex Reader', avatar_emoji: '👽' } },
          { user_id: 'u2', role: 'member', user_profiles: { display_name: 'Jordan Pages', avatar_emoji: '🤖' } }
        ];
        if (!window._mockClubMembers[clubId].some(m => String(m.user_id) === String(currentUserId))) {
          window._mockClubMembers[clubId].push({
            user_id: currentUserId,
            role: 'member',
            user_profiles: { display_name: currentUserName, avatar_emoji: currentUserAvatar }
          });
        }
      }
      return club;
    }
    if (!userId || !clubId) return null;
    const { data: club } = await _supabase.from('clubs').select('*').eq('id', clubId).maybeSingle();
    if (!club) return null;
    await _supabase.from('club_members').upsert({ club_id: club.id, user_id: userId, role: 'member' }, { onConflict: 'club_id,user_id' });
    return club;
  },

  async joinClubByCode(code, userId) {
    const currentUserId = userId || (typeof App !== 'undefined' ? App.userId : null) || 'current_user';
    const currentUserName = (typeof App !== 'undefined' && App.userProfile?.display_name) || (typeof App !== 'undefined' && App.userName) || 'You';
    const currentUserAvatar = (typeof App !== 'undefined' && App.userProfile?.avatar_emoji) || (typeof App !== 'undefined' && App.userAvatar) || '🤠';

    if (!_supabase || (typeof App !== 'undefined' && App.isDemoMode)) {
      const club = (typeof window !== 'undefined' && window._mockClubs) ? window._mockClubs.find(c => c.invite_code === (code||'').toUpperCase().trim()) : null;
      if (club) {
        club.myRole = 'member';
        if (typeof window !== 'undefined') {
          window._mockClubMembers = window._mockClubMembers || {};
          window._mockClubMembers[club.id] = window._mockClubMembers[club.id] || [];
          if (!window._mockClubMembers[club.id].some(m => String(m.user_id) === String(currentUserId))) {
            window._mockClubMembers[club.id].push({
              user_id: currentUserId,
              role: 'member',
              user_profiles: { display_name: currentUserName, avatar_emoji: currentUserAvatar }
            });
          }
        }
        return club;
      }
      return null;
    }
    if (!userId || !code) return null;
    
    const cleanCode = (code||'').toUpperCase().trim();
    let { data: club } = await _supabase.from('clubs').select('*').eq('invite_code', cleanCode).maybeSingle();
    if (!club) {
      const { data: publicClub } = await _supabase.from('clubs').select('*').eq('invite_code', 'PUBLIC_' + cleanCode).maybeSingle();
      club = publicClub;
    }
    
    if (!club) return null;
    await _supabase.from('club_members').upsert({ club_id: club.id, user_id: userId, role: 'member' }, { onConflict: 'club_id,user_id' });
    return club;
  },

  async setClubPick(clubId, bookTitle, bookAuthor, bookCover) {
    if (!_supabase) return false;
    const { error } = await _supabase.from('clubs').update({ current_book_title: bookTitle, current_book_author: bookAuthor, current_book_cover: bookCover }).eq('id', clubId);
    return !error;
  },

  async getClubDiscussion(clubId) {
    if (!_supabase) return [];
    const { data, error } = await _supabase.from('club_discussion').select('id,content,created_at,user_id').eq('club_id', clubId).order('created_at', { ascending: false }).limit(100);
    if (error) {
      console.error('getClubDiscussion error:', error);
      return [];
    }

    if (data && data.length > 0) {
      const userIds = [...new Set(data.map(m => m.user_id))].filter(Boolean);
      if (userIds.length > 0) {
        const { data: profs } = await _supabase.from('user_profiles').select('user_id, display_name, avatar_emoji').in('user_id', userIds);
        if (profs) {
          const profMap = {};
          profs.forEach(p => { profMap[p.user_id] = p; });
          data.forEach(m => {
            if (m.user_id && profMap[m.user_id]) {
              m.user_profiles = profMap[m.user_id];
            }
          });
        }
      }
    }
    
      if (data) {
        data.forEach(c => {
          if (c.invite_code) {
            let core = c.invite_code.startsWith('PUBLIC_') ? c.invite_code.replace('PUBLIC_', '') : c.invite_code;
            if (core.length > 4) {
              const newCore = core.substring(0,4);
              const fullNewCode = c.invite_code.startsWith('PUBLIC_') ? 'PUBLIC_' + newCore : newCore;
              c.invite_code = fullNewCode;
              _supabase.from('clubs').update({ invite_code: fullNewCode }).eq('id', c.id).then();
            }
          }
        });
      }
      return (data || []).reverse();
  },

  async wipeClubDiscussion(clubId) {
    if (!_supabase) return false;
    const { error } = await _supabase.from('club_discussion').delete().eq('club_id', clubId);
    if (error) {
      console.warn('wipeClubDiscussion:', error.message);
      return false;
    }
    return true;
  },

  async deleteClubMessage(msgId) {
    if (!_supabase) return false;
    const { error } = await _supabase.from('club_discussion').delete().eq('id', msgId);
    if (error) {
      console.warn('deleteClubMessage:', error.message);
      return false;
    }
    return true;
  },

  async addClubMessage(clubId, userId, content) {
    if (!_supabase || !userId) return null;
    const { data, error } = await _supabase.from('club_discussion').insert({ club_id: clubId, user_id: userId, content }).select().single();
    if (error) {
      console.warn('addClubMessage:', error.message);
      return null;
    }
    return data;
  },

  async savePushSubscription(userId, endpoint, p256dh, authKey) {
    if (!_supabase || !userId) return false;
    const { error } = await _supabase.from('push_subscriptions').upsert({ user_id: userId, endpoint, p256dh, auth_key: authKey }, { onConflict: 'user_id' });
    return !error;
  },

  async nominateBook(clubId, userId, bookTitle, bookAuthor, bookCover) {
    if (!_supabase || !userId) return null;
    const { data, error } = await _supabase.from('club_nominations').insert({
      club_id: clubId,
      user_id: userId,
      book_title: bookTitle,
      book_author: bookAuthor || '',
      book_cover: bookCover || ''
    }).select().single();

    if (error) {
      console.warn('nominateBook:', error.message);
      return null;
    }
    return data;
  },

  async getClubNominations(clubId) {
    if (!_supabase) return { nominations: [], voteCounts: {}, myVoteNomId: null };
    const { data: noms } = await _supabase.from('club_nominations').select('*,user_profiles!user_id(display_name,avatar_emoji)').eq('club_id', clubId).order('created_at', { ascending: true });
    const { data: votes } = await _supabase.from('club_votes').select('nomination_id,user_id').eq('club_id', clubId);

    const voteCounts = {};
    (votes || []).forEach(v => {
      voteCounts[v.nomination_id] = (voteCounts[v.nomination_id] || 0) + 1;
    });

    const activeUserId = (typeof window !== 'undefined' && window.App && window.App.userId) ? window.App.userId : null;
    const myVote = (votes || []).find(v => v.user_id === activeUserId);

    return { nominations: noms || [], voteCounts, myVoteNomId: myVote?.nomination_id || null };
  },

  async voteForNomination(clubId, nominationId, userId) {
    if (!_supabase || !userId) return false;
    const { error } = await _supabase.from('club_votes').upsert({ club_id: clubId, nomination_id: nominationId, user_id: userId }, { onConflict: 'club_id,user_id' });
    return !error;
  },

  async removeNomination(nominationId) {
    if (!_supabase) return false;
    const { error } = await _supabase.from('club_nominations').delete().eq('id', nominationId);
    return !error;
  },

  async updateClubName(clubId, newName) {
    if (!_supabase) return false;
    const { error } = await _supabase.from('clubs').update({ name: newName }).eq('id', clubId);
    return !error;
  },

  async removeClubMember(clubId, userId) {
    if (!_supabase) return false;
    const { error } = await _supabase.from('club_members').delete().eq('club_id', clubId).eq('user_id', userId);
    return !error;
  },

  async updateClubDescription(clubId, description) {
    if (!_supabase) return false;
    const { error } = await _supabase.from('clubs').update({ description }).eq('id', clubId);
    return !error;
  },

  async updateClubVisibility(clubId, isPublic, inviteCode) {
    if (!_supabase) return false;
    const { error } = await _supabase.from('clubs').update({ is_public: isPublic, invite_code: inviteCode }).eq('id', clubId);
    return !error;
  },

  async updateClubPastReads(clubId, pastReads) {
    if (!clubId) return false;
    if (!_supabase) {
      if (typeof window !== 'undefined' && window._mockClubs) {
        const c = window._mockClubs.find(x => x.id === clubId);
        if (c) c.past_reads = pastReads;
      }
      return true;
    }
    const { error } = await _supabase.from('clubs').update({ past_reads: pastReads }).eq('id', clubId);
    return !error;
  },

  async sendClubMessage(clubId, text, userId, userName) {
    return this.addClubMessage(clubId, userId, text);
  },

  async deleteClub(clubId) {
    if (!clubId) return false;
    if (!_supabase) {
      if (typeof window !== 'undefined') {
        if (window._mockClubs) {
          window._mockClubs = window._mockClubs.filter(c => c.id !== clubId);
          try { localStorage.setItem('sl_mockClubs', JSON.stringify(window._mockClubs)); } catch(e){}
        }
        if (window._mockClubMembers) {
          delete window._mockClubMembers[clubId];
          try { localStorage.setItem('sl_mockClubMembers', JSON.stringify(window._mockClubMembers)); } catch(e){}
        }
      }
      return true;
    }
    try {
      await _supabase.from('club_messages').delete().eq('club_id', clubId);
      await _supabase.from('club_members').delete().eq('club_id', clubId);
      const { error } = await _supabase.from('clubs').delete().eq('id', clubId);
      if (error) {
        console.error('deleteClub error:', error);
        return error.message || false;
      }
      return true;
    } catch(err) {
      console.error('deleteClub exception:', err);
      return err.message || false;
    }
  },

  async updateClubMemberRole(clubId, userId, role) {
    if (!clubId || !userId) return { success: false, error: 'Missing params' };
    if (!_supabase) return { success: true };
    const { data, error } = await _supabase.from('club_members').update({ role }).eq('club_id', clubId).eq('user_id', userId).select();
    if (error) return { success: false, error: error.message };
    if (!data || data.length === 0) return { success: false, error: 'No rows updated (RLS blocked)' };
    return { success: true };
  },

  async getPublicShelfByUser(userId) {
    if (!userId || !_supabase) return null;
    // 1. Try explicit public shelf (year descending)
    const { data, error } = await _supabase
      .from('shelves')
      .select('*')
      .eq('user_id', userId)
      .neq('public', false)
      .order('year', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) return data;

    // 2. Check all shelves for user and find the first non-private one
    const { data: allShelves } = await _supabase
      .from('shelves')
      .select('*')
      .eq('user_id', userId)
      .order('year', { ascending: false });

    if (allShelves && allShelves.length > 0) {
      const publicShelf = allShelves.find(s => s.public !== false);
      return publicShelf || allShelves[0];
    }
    return null;
  }
};

DB._supabase = _supabase;

// ==========================================
// 5. Global Window Bindings
// ==========================================

if (typeof window !== 'undefined') {
  window._supabase = _supabase;
  window.DB = DB;
  window.SyncQueue = SyncQueue;
  window.dbToBook = dbToBook;
  window.WORD_COUNT_OVERRIDES = WORD_COUNT_OVERRIDES;
  window.lookupWordCountOverride = lookupWordCountOverride;
  window.coverPlaceholder = coverPlaceholder;
  window.deriveDisplayNameFromEmail = deriveDisplayNameFromEmail;
  window.normalizeDisplayName = normalizeDisplayName;
  window.normalizeGenre = normalizeGenre;
}

export default DB;
