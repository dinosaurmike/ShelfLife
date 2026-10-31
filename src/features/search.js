/**
 * ShelfLife Search, Metadata Enrichment & Scanner Feature (src/features/search.js)
 * Encapsulates OpenLibrary/Google Books lookups, barcode/camera scanner, OCR recognition,
 * DuplicateDetector, Wikidata demographics, GenderAPI, NationalizeAPI, WordCountAPI,
 * manual book entry, CSV import, and global library search.
 */

import {
  NAME_GENDER_DB,
  DEMO_AUTHOR_GENDERS,
  WORDS_PER_PAGE,
  DEFAULT_IMPORT_WORDS,
  ALL_MONTHS,
  LABELS,
  COLORS
} from '../utils/constants.js';

import {
  pagesToWords,
  fmtWords
} from '../utils/math.js';

import {
  esc,
  showToast,
  openModal,
  closeModal,
  openPanel,
  closePanel
} from '../utils/dom.js';

import { DB, dbToBook, coverPlaceholder, WORD_COUNT_OVERRIDES, lookupWordCountOverride } from '../core/db.js';

// ==========================================
// 1. GoogleBooksRating Engine
// ==========================================
export const GoogleBooksRating = {
  _CACHE_TTL: 2592000000, // 30 days
  _MAX_CACHE_ENTRIES: 100,

  _cacheKey(book) {
    if (book.isbn) return 'gbr_isbn_' + book.isbn;
    return 'gbr_' + (book.title + '_' + book.author).toLowerCase().replace(/\s+/g, '_').substring(0, 80);
  },

  getCached(book) {
    try {
      const key = this._cacheKey(book);
      const raw = localStorage.getItem(key);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.expires && Date.now() < data.expires) return data;
        localStorage.removeItem(key);
      }
    } catch (e) { console.warn(e); }
    return null;
  },

  _cache(book, ratingData) {
    try {
      const key = this._cacheKey(book);
      ratingData.cached = Date.now();
      const ttl = ratingData.found ? this._CACHE_TTL : 600000; // 10 min for failed
      ratingData.expires = Date.now() + ttl;
      localStorage.setItem(key, JSON.stringify(ratingData));
      this._evictOldest();
    } catch (e) { console.warn(e); }
  },

  _evictOldest() {
    try {
      const entries = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('gbr_')) {
          try {
            const d = JSON.parse(localStorage.getItem(k));
            entries.push({ key: k, cached: d.cached || 0 });
          } catch (e) { entries.push({ key: k, cached: 0 }); }
        }
      }
      if (entries.length > this._MAX_CACHE_ENTRIES) {
        entries.sort((a, b) => a.cached - b.cached);
        const toRemove = entries.length - this._MAX_CACHE_ENTRIES;
        for (let i = 0; i < toRemove; i++) localStorage.removeItem(entries[i].key);
      }
    } catch (e) { console.warn(e); }
  },

  async _fetchJSON(url, timeoutMs) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs || 7000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      clearTimeout(timeoutId);
      return null;
    }
  },

  async _tryGoogleBooks(book) {
    let url;
    if (book.isbn) {
      url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(book.isbn)}&maxResults=1` + (typeof localStorage !== 'undefined' && localStorage.getItem('sl_gb_key') ? '&key=' + localStorage.getItem('sl_gb_key') : '');
    } else {
      const q = `intitle:${book.title} inauthor:${book.author}`;
      url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=1` + (typeof localStorage !== 'undefined' && localStorage.getItem('sl_gb_key') ? '&key=' + localStorage.getItem('sl_gb_key') : '');
    }

    const data = await this._fetchJSON(url, 7000);
    if (data && data.totalItems > 0 && data.items && data.items[0] && data.items[0].volumeInfo) {
      const vol = data.items[0].volumeInfo;
      if (vol.averageRating) {
        return {
          found: true,
          averageRating: vol.averageRating,
          ratingsCount: vol.ratingsCount || 0,
          source: 'Google Books',
          isbn: (vol.industryIdentifiers || []).find(id => id.type === 'ISBN_13')?.identifier
            || (vol.industryIdentifiers || []).find(id => id.type === 'ISBN_10')?.identifier
            || book.isbn || null
        };
      }
    }
    return null;
  },

  async _tryOpenLibrary(book) {
    const url = `https://openlibrary.org/search.json?title=${encodeURIComponent(book.title)}&author=${encodeURIComponent(book.author)}&fields=key,title,author_name,ratings_average,ratings_count&limit=5`;
    const data = await this._fetchJSON(url, 7000);
    if (data && Array.isArray(data.docs) && data.docs.length) {
      const withRating = data.docs.find(d => d.ratings_average && d.ratings_count);
      if (withRating) {
        return {
          found: true,
          averageRating: Math.round(withRating.ratings_average * 10) / 10,
          ratingsCount: withRating.ratings_count || 0,
          source: 'Open Library'
        };
      }
    }
    return null;
  },

  async _tryNYT(book) {
    const key = (typeof window !== 'undefined' && window.NYT_BOOKS_API_KEY) ? String(window.NYT_BOOKS_API_KEY).trim() : '';
    if (!key) return null;
    const url = `https://api.nytimes.com/svc/books/v3/reviews.json?title=${encodeURIComponent(book.title)}&api-key=${encodeURIComponent(key)}`;
    const data = await this._fetchJSON(url, 7000);
    if (data && Array.isArray(data.results) && data.results.length) {
      const r = data.results[0];
      return {
        found: true,
        nytReview: true,
        reviewUrl: r.url || '',
        byline: r.byline || '',
        source: 'NYT Books Review'
      };
    }
    return null;
  },

  async fetch(book) {
    const cached = this.getCached(book);
    if (cached) return cached;
    let result = null;
    try { result = await this._tryGoogleBooks(book); } catch (e) { result = null; }
    if (!result || !result.found) {
      try { const ol = await this._tryOpenLibrary(book); if (ol && ol.found) result = ol; } catch (e) { console.warn(e); }
    }
    if (!result || !result.found) {
      try { const nyt = await this._tryNYT(book); if (nyt && nyt.found) result = nyt; } catch (e) { console.warn(e); }
    }
    if (!result) result = { found: false };
    this._cache(book, result);
    return result;
  },

  stars(rating) {
    if (!rating) return '';
    const full = Math.floor(rating);
    const half = (rating - full) >= 0.25 && (rating - full) < 0.75 ? 1 : 0;
    const empty = 5 - full - half;
    const actualFull = (rating - full) >= 0.75 ? full + 1 : full;
    const actualEmpty = 5 - actualFull - half;
    return '⭐'.repeat(actualFull) + (half ? '⭐' : '') + '☆'.repeat(Math.max(0, actualEmpty));
  },

  renderHTML(book, ratingData) {
    const sentColors = { love: '#1c3f78', like: '#1e5c3a', mixed: '#c89018', dislike: '#8c1a28' };
    const sentLabels = { love: 'Loved', like: 'Liked', mixed: 'Mixed', dislike: 'Disliked' };
    const sent = book.sentiment || 'mixed';
    const sentColor = sentColors[sent] || '#c89018';
    const sentLabel = sentLabels[sent] || 'Mixed';

    if (!ratingData || !ratingData.found) {
      return `<div style="font-size:12px;color:var(--wood-light);font-family:'DM Mono',monospace;">Personal rating: <strong style="color:${sentColor};">${sentLabel}</strong></div>`;
    }

    let starsHtml = '';
    if (ratingData.averageRating) {
      starsHtml = `<div style="display:flex;align-items:center;gap:6px;margin-top:4px;">
        <span style="font-size:14px;">${this.stars(ratingData.averageRating)}</span>
        <span style="font-size:11px;color:var(--wood-mid);font-family:'DM Mono',monospace;">${ratingData.averageRating.toFixed(1)} (${(ratingData.ratingsCount || 0).toLocaleString()} reviews on ${ratingData.source})</span>
      </div>`;
    }

    return `<div style="font-size:12px;color:var(--wood-light);font-family:'DM Mono',monospace;">
      <div>Personal: <strong style="color:${sentColor};">${sentLabel}</strong></div>
      ${starsHtml}
    </div>`;
  }
};

// ==========================================
// 1b. Series Typo, Consensus & Acronym Helpers
// ==========================================
export const SERIES_ACRONYMS = {
  'lotr': 'The Lord of the Rings',
  'asoiaf': 'A Song of Ice and Fire',
  'wot': 'The Wheel of Time',
  'hp': 'Harry Potter',
  'pjo': 'Percy Jackson & the Olympians',
  'hoo': 'The Heroes of Olympus',
  'kkc': 'The Kingkiller Chronicle',
  'sa': 'The Stormlight Archive',
  'tgr': 'The Realm of the Elderlings',
  'got': 'A Song of Ice and Fire',
  'exp': 'The Expanse',
  'cosmere': 'Cosmere',
  'dresden': 'The Dresden Files',
  'discworld': 'Discworld',
  'mistborn': 'Mistborn',
  'redrising': 'Red Rising',
  'rr': 'Red Rising',
  'thg': 'The Hunger Games',
  'hg': 'The Hunger Games',
  'fma': 'Fullmetal Alchemist',
  'aot': 'Attack on Titan',
  'op': 'One Piece'
};

export function cleanNorm(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/\+/g, ' and ')
    .replace(/^(the|a|an)\s+/i, '')
    .replace(/\b(series|trilogy|saga|chronicles|cycle|sequence|quartet|duology|books?)\b/gi, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function levenshteinDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

export function isTypoOrVariant(input, candidate) {
  if (!input || !candidate) return false;
  const n1 = cleanNorm(input);
  const n2 = cleanNorm(candidate);
  if (!n1 || !n2) return false;
  if (n1 === n2) return true;

  const acronym1 = (SERIES_ACRONYMS[n1.replace(/\s+/g, '')] || '').toLowerCase();
  if (acronym1 && cleanNorm(acronym1) === n2) return true;
  const acronym2 = (SERIES_ACRONYMS[n2.replace(/\s+/g, '')] || '').toLowerCase();
  if (acronym2 && cleanNorm(acronym2) === n1) return true;

  if (n1.length >= 4 && n2.length >= 4) {
    if (n1.startsWith(n2) || n2.startsWith(n1)) return true;
  }

  // Prefix typo match (e.g. "percy jakson" vs "percy jackson and the olympians")
  const shorter = n1.length < n2.length ? n1 : n2;
  const longer = n1.length < n2.length ? n2 : n1;
  const longerPrefix = longer.substring(0, shorter.length);
  if (levenshteinDistance(shorter, longerPrefix) <= 2) return true;

  const maxLen = Math.max(n1.length, n2.length);
  const dist = levenshteinDistance(n1, n2);
  if (maxLen >= 10 && dist <= 3) return true;
  if (maxLen >= 5 && dist <= 2) return true;
  if (maxLen >= 3 && dist <= 1) return true;

  return false;
}

export function findMatchingLibrarySeries(querySeriesName, author = '', books = []) {
  if (!books || !books.length) return null;
  const librarySeries = [...new Set(books.map(b => (b.seriesName || '').trim()).filter(Boolean))];
  if (!librarySeries.length) return null;

  if (querySeriesName && querySeriesName.trim()) {
    const q = querySeriesName.trim();
    // 1. Exact match (case insensitive)
    const exact = librarySeries.find(s => s.toLowerCase() === q.toLowerCase());
    if (exact) return exact;

    // 2. Acronym match
    const lowerKey = q.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (SERIES_ACRONYMS[lowerKey]) {
      const expanded = SERIES_ACRONYMS[lowerKey];
      const matchExpanded = librarySeries.find(s => isTypoOrVariant(s, expanded));
      if (matchExpanded) return matchExpanded;
      return expanded;
    }

    // 3. Typo / Variant match
    const matched = librarySeries.find(s => isTypoOrVariant(q, s));
    if (matched) return matched;
  }

  return null;
}

// ==========================================
// 1c. SeriesMetadataFetcher (Layer 1)
// ==========================================
export const SeriesMetadataFetcher = {
  _CACHE_PREFIX: 'sl_series_cache_',
  _CACHE_TTL: 2592000000, // 30 days
  _FAILED_TTL: 600000,    // 10 minutes
  _MAX_CACHE_ENTRIES: 50,

  _WORD_MAP: {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
    first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10
  },

  _ROMAN_MAP: {
    i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10,
    xi: 11, xii: 12, xiii: 13, xiv: 14, xv: 15, xvi: 16, xvii: 17, xviii: 18, xix: 19, xx: 20
  },

  _BUNDLE_REGEX: new RegExp(
    '\\b(?:box\\s*set|boxed\\s*set|collection|omnibus|trilogy\\s*set|' +
    'complete\\s+(?:series|collection|trilogy|set)|3-book|4-book|5-book|6-book|7-book|' +
    'bundle|anthology|summary|study\\s*guide|analysis\\s+of|companion\\s+to|companion|' +
    'cookbook|coloring\\s*book|activity\\s*book|trivia|workbook|teacher\'?s\\s*guide|' +
    'lesson\\s*plan|cliffnotes|sparknotes|sidekick|key\\s*takeaways|unofficial\\s*guide|' +
    'calendar|poster\\s*book|journal|notebook|audiobook\\s*edition|sample|excerpt|preview)\\b|' +
    '\\bbooks?\\s+\\d+\\s*[-–&to]+\\s*\\d+\\b|' +
    '\\bvol(?:ume)?s?\\s+\\d+\\s*[-–&to]+\\s*\\d+\\b|' +
    '\\bparts?\\s+\\d+\\s*[-–&to]+\\s*\\d+\\b|' +
    '\\b\\d+\\s*[-–&to]+\\s*\\d+\\s+books?\\b',
    'i'
  ),

  _getCacheKey(seriesName) {
    const clean = (seriesName || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').substring(0, 80);
    return this._CACHE_PREFIX + clean;
  },

  getCached(seriesName) {
    if (typeof localStorage === 'undefined') return null;
    try {
      const key = this._getCacheKey(seriesName);
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data.expires && Date.now() < data.expires) {
        return data.volumes || [];
      }
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('[SeriesMetadataFetcher] Cache read error:', e);
    }
    return null;
  },

  setCached(seriesName, author, volumes) {
    if (typeof localStorage === 'undefined') return;
    try {
      const key = this._getCacheKey(seriesName);
      const isSuccess = Array.isArray(volumes) && volumes.length > 0;
      const ttl = isSuccess ? this._CACHE_TTL : this._FAILED_TTL;
      const payload = {
        seriesName: seriesName,
        author: author || '',
        timestamp: Date.now(),
        expires: Date.now() + ttl,
        volumes: volumes || []
      };
      localStorage.setItem(key, JSON.stringify(payload));
      this._evictOldest();
    } catch (e) {
      console.warn('[SeriesMetadataFetcher] Cache write error:', e);
    }
  },

  _evictOldest() {
    if (typeof localStorage === 'undefined') return;
    try {
      const entries = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(this._CACHE_PREFIX)) {
          try {
            const d = JSON.parse(localStorage.getItem(k));
            entries.push({ key: k, timestamp: d.timestamp || 0 });
          } catch (e) {
            entries.push({ key: k, timestamp: 0 });
          }
        }
      }
      if (entries.length > this._MAX_CACHE_ENTRIES) {
        entries.sort((a, b) => a.timestamp - b.timestamp);
        const toRemove = entries.length - this._MAX_CACHE_ENTRIES;
        for (let i = 0; i < toRemove; i++) {
          localStorage.removeItem(entries[i].key);
        }
      }
    } catch (e) {
      console.warn('[SeriesMetadataFetcher] Eviction error:', e);
    }
  },

  async _fetchJSON(url, options = {}, timeoutMs = 8000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      clearTimeout(timeoutId);
      return null;
    }
  },

  _isBundleOrGuide(title = '', subtitle = '', description = '') {
    const combined = `${title} ${subtitle} ${description.slice(0, 300)}`;
    return this._BUNDLE_REGEX.test(combined);
  },

  _isAuthorMatch(itemAuthor = '', targetAuthor = '') {
    if (!targetAuthor || !itemAuthor) return true;
    const normTarget = targetAuthor.toLowerCase().replace(/[^a-z\s]/g, '').trim();
    const normItem = itemAuthor.toLowerCase().replace(/[^a-z\s]/g, '').trim();
    if (!normTarget || !normItem) return true;
    if (normTarget === normItem || normItem.includes(normTarget) || normTarget.includes(normItem)) {
      return true;
    }
    const targetTokens = normTarget.split(/\s+/).filter(t => t.length > 2);
    const itemTokens = normItem.split(/\s+/).filter(t => t.length > 2);
    return targetTokens.some(t => itemTokens.includes(t));
  },

  _parseVolumeNumber(title = '', subtitle = '', description = '', seriesName = '') {
    const combined = `${title} ${subtitle}`.trim();

    // 1. Explicit series hashtag: '#1', '# 2', '#2.5'
    let m = combined.match(/#\s*(\d+(?:\.\d+)?)/);
    if (m) return parseFloat(m[1]);

    // 2. Book / Volume / Part / Bk / Installment followed by number
    m = combined.match(/\b(?:book|volume|vol\.?|part|bk\.?|installment|no\.?)\s*#?\s*(\d+(?:\.\d+)?)/i);
    if (m) return parseFloat(m[1]);

    // 3. Book / Volume / Part followed by spelled word
    m = combined.match(/\b(?:book|volume|vol\.?|part|bk\.?|installment)\s+([a-z]+)\b/i);
    if (m && this._WORD_MAP[m[1].toLowerCase()]) return this._WORD_MAP[m[1].toLowerCase()];

    // 4. Word followed by book/part
    m = combined.match(/\b([a-z]+)\s+(?:book|part|volume|installment)\b/i);
    if (m && this._WORD_MAP[m[1].toLowerCase()]) return this._WORD_MAP[m[1].toLowerCase()];

    // 5. Roman numerals with keyword: 'Book IV', 'Volume VI', 'Part II'
    m = combined.match(/\b(?:book|volume|vol\.?|part|bk\.?)\s+([ivxcdm]+)\b/i);
    if (m && this._ROMAN_MAP[m[1].toLowerCase()]) return this._ROMAN_MAP[m[1].toLowerCase()];

    // 6. Parenthetical roman numeral: '(Volume VII)' or '(VII)'
    m = combined.match(/\(([ivxcdm]+)\)/i);
    if (m && this._ROMAN_MAP[m[1].toLowerCase()]) return this._ROMAN_MAP[m[1].toLowerCase()];

    // 7. Colon / Dash suffix with Roman or digits: 'The Dark Tower VII'
    m = combined.match(/\b(?:the\s+dark\s+tower|dune|foundation)\s+([ivxcdm]+)\b/i);
    if (m && this._ROMAN_MAP[m[1].toLowerCase()]) return this._ROMAN_MAP[m[1].toLowerCase()];

    // 8. Description scanning (first 300 chars)
    if (description) {
      const descSample = description.slice(0, 300);
      m = descSample.match(/\b(?:the\s+)?(\d+)(?:st|nd|rd|th)\s+(?:book|novel|installment|volume)\s+in\s+the\b/i);
      if (m) return parseInt(m[1], 10);

      m = descSample.match(/\b(?:the\s+)?(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s+(?:book|novel|installment|volume)\s+in\s+the\b/i);
      if (m && this._WORD_MAP[m[1].toLowerCase()]) return this._WORD_MAP[m[1].toLowerCase()];

      m = descSample.match(/\b(?:book|volume|installment|part)\s+(\d+)\s+(?:of|in)\s+the\b/i);
      if (m) return parseInt(m[1], 10);

      m = descSample.match(/\b(?:book|volume|installment|part)\s+(\d+)\b/i);
      if (m) return parseInt(m[1], 10);

      m = descSample.match(/\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s+(?:foundation|dune|novel|book|installment)\b/i);
      if (m && this._WORD_MAP[m[1].toLowerCase()]) return this._WORD_MAP[m[1].toLowerCase()];
    }

    // 9. Eponymous title check: If title equals seriesName, treat as Book 1
    const cleanT = (title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanS = (seriesName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanT && cleanS && cleanT === cleanS) {
      return 1;
    }

    return null;
  },

  _cleanTitle(title = '', seriesName = '') {
    if (!title) return '';
    let cleaned = title;

    // Remove parenthetical series/volume tags: '(Harry Potter, #1)', '(Book 2)'
    cleaned = cleaned.replace(/\s*\([^)]*(?:book|vol|part|#|series|movie|edition|tie-in)[^)]*\)/gi, '');

    // Remove bracketed edition tags: '[Illustrated Edition]', '[1/2]'
    cleaned = cleaned.replace(/\s*\[[^\]]*\]/gi, '');

    // Remove subtitle series tags: ': Book Two', ': Part 3', ': The Dark Tower VII'
    cleaned = cleaned.replace(/:\s*(?:being\s+the\s+)?(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|\d+(?:st|nd|rd|th)?)\s+(?:part|book|volume|installment)[^:]*$/gi, '');
    cleaned = cleaned.replace(/:\s*(?:book|volume|vol\.?|part|bk\.?)\s*#?\s*(?:\d+|[ivxcdm]+|[a-z]+)[^:]*$/gi, '');

    // Remove trailing series name tag: ' - The Lord of the Rings'
    if (seriesName) {
      const escSeries = seriesName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      cleaned = cleaned.replace(new RegExp(':\\s*' + escSeries + '.*$', 'i'), '');
      cleaned = cleaned.replace(new RegExp('\\s*-\\s*' + escSeries + '.*$', 'i'), '');
    }

    return cleaned.trim();
  },

  async _queryGoogleBooks(seriesName, author) {
    let query = `intitle:${encodeURIComponent(seriesName)}`;
    if (author) query += `+inauthor:${encodeURIComponent(author)}`;
    let url = `https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=40&printType=books`;
    if (typeof localStorage !== 'undefined' && localStorage.getItem('sl_gb_key')) {
      url += '&key=' + localStorage.getItem('sl_gb_key');
    }

    const data = await this._fetchJSON(url, {}, 8000);
    if (!data || !data.items || !Array.isArray(data.items)) return [];

    const items = [];
    for (const item of data.items) {
      const vi = item.volumeInfo || {};
      const rawTitle = vi.title || '';
      const subtitle = vi.subtitle || '';
      const desc = vi.description || '';
      const itemAuthor = (vi.authors && vi.authors[0]) || author || 'Unknown';

      if (this._isBundleOrGuide(rawTitle, subtitle, desc)) continue;
      if (!this._isAuthorMatch(itemAuthor, author)) continue;

      const seriesNumber = this._parseVolumeNumber(rawTitle, subtitle, desc, seriesName);
      const cleanTitle = this._cleanTitle(rawTitle, seriesName) || rawTitle;
      const coverUrl = vi.imageLinks ? (vi.imageLinks.thumbnail || vi.imageLinks.smallThumbnail || '').replace('http:', 'https:') : '';
      const pages = vi.pageCount || 0;
      const year = vi.publishedDate ? (parseInt(String(vi.publishedDate).substring(0, 4), 10) || '') : '';
      const isbn = (vi.industryIdentifiers || []).find(id => id.type === 'ISBN_13')?.identifier
        || (vi.industryIdentifiers || []).find(id => id.type === 'ISBN_10')?.identifier
        || null;

      items.push({
        title: cleanTitle,
        author: itemAuthor,
        seriesName: seriesName,
        seriesNumber: seriesNumber,
        year: year,
        isbn: isbn,
        coverUrl: coverUrl,
        pages: pages,
        words: pages > 0 ? (typeof pagesToWords === 'function' ? pagesToWords(pages) : pages * 300) : 80000,
        genre: typeof guessGenre === 'function' ? guessGenre(vi.categories || []) : 'General Fiction',
        fiction: true
      });
    }

    return items;
  },

  async _queryProxy(seriesName, author) {
    try {
      const q = `${seriesName} ${author || ''}`.trim();
      const token = typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : (typeof window !== 'undefined' && window.SUPABASE_ANON_KEY ? window.SUPABASE_ANON_KEY : '');
      const res = await fetch('https://guqkidwlkslhkoictfay.supabase.co/functions/v1/search-books', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ query: q })
      });
      if (!res.ok) return [];
      const data = await res.json();
      if (!Array.isArray(data)) return [];

      const items = [];
      for (const b of data) {
        const rawTitle = b.title || '';
        if (this._isBundleOrGuide(rawTitle)) continue;
        if (!this._isAuthorMatch(b.author, author)) continue;

        const seriesNumber = this._parseVolumeNumber(rawTitle, '', '', seriesName);
        const cleanTitle = this._cleanTitle(rawTitle, seriesName) || rawTitle;
        const pages = b.pages || 0;
        const year = b.year ? (parseInt(String(b.year).substring(0, 4), 10) || '') : '';

        items.push({
          title: cleanTitle,
          author: b.author || author || 'Unknown',
          seriesName: seriesName,
          seriesNumber: seriesNumber,
          year: year,
          isbn: b.isbn || null,
          coverUrl: b.coverUrl || '',
          pages: pages,
          words: pages > 0 ? (typeof pagesToWords === 'function' ? pagesToWords(pages) : pages * 300) : 80000,
          genre: b.genre || 'General Fiction',
          fiction: true
        });
      }
      return items;
    } catch (e) {
      console.warn('[SeriesMetadataFetcher] Proxy query failed:', e);
      return [];
    }
  },

  async _queryOpenLibrary(seriesName, author) {
    const q = `${seriesName} ${author || ''}`.trim();
    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=40`;
    const data = await this._fetchJSON(url, {}, 8000);
    if (!data || !data.docs || !Array.isArray(data.docs)) return [];

    const items = [];
    for (const doc of data.docs) {
      const rawTitle = doc.title || '';
      const subtitle = doc.subtitle || '';
      const itemAuthor = (doc.author_name && doc.author_name[0]) || author || 'Unknown';

      if (this._isBundleOrGuide(rawTitle, subtitle)) continue;
      if (!this._isAuthorMatch(itemAuthor, author)) continue;

      const seriesNumber = this._parseVolumeNumber(rawTitle, subtitle, '', seriesName);
      const cleanTitle = this._cleanTitle(rawTitle, seriesName) || rawTitle;
      const pages = doc.number_of_pages_median || 0;
      const year = doc.first_publish_year || (doc.publish_date && doc.publish_date[0] ? parseInt(doc.publish_date[0], 10) : '') || '';
      const coverUrl = doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : '';
      const isbn = (doc.isbn && doc.isbn[0]) || null;

      items.push({
        title: cleanTitle,
        author: itemAuthor,
        seriesName: seriesName,
        seriesNumber: seriesNumber,
        year: year,
        isbn: isbn,
        coverUrl: coverUrl,
        pages: pages,
        words: pages > 0 ? (typeof pagesToWords === 'function' ? pagesToWords(pages) : pages * 300) : 80000,
        genre: 'General Fiction',
        fiction: true
      });
    }

    return items;
  },

  _deduplicateVolumes(volumes) {
    if (!volumes || !volumes.length) return [];
    const grouped = new Map();

    for (const vol of volumes) {
      const key = (typeof vol.seriesNumber === 'number' && !isNaN(vol.seriesNumber) && vol.seriesNumber > 0)
        ? `num_${vol.seriesNumber}`
        : `title_${vol.title.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

      if (!grouped.has(key)) {
        grouped.set(key, vol);
      } else {
        const existing = grouped.get(key);
        let scoreNew = 0;
        let scoreExisting = 0;

        if (vol.coverUrl) scoreNew += 3;
        if (existing.coverUrl) scoreExisting += 3;

        if (vol.pages > 0) scoreNew += 2;
        if (existing.pages > 0) scoreExisting += 2;

        if (vol.isbn) scoreNew += 1;
        if (existing.isbn) scoreExisting += 1;

        if (vol.year && existing.year) {
          if (vol.year < existing.year) scoreNew += 2;
          else if (existing.year < vol.year) scoreExisting += 2;
        }

        if (scoreNew > scoreExisting) {
          grouped.set(key, vol);
        }
      }
    }

    const result = Array.from(grouped.values());

    result.sort((a, b) => {
      const aNum = (typeof a.seriesNumber === 'number' && !isNaN(a.seriesNumber)) ? a.seriesNumber : 9999;
      const bNum = (typeof b.seriesNumber === 'number' && !isNaN(b.seriesNumber)) ? b.seriesNumber : 9999;
      if (aNum !== bNum) return aNum - bNum;
      const aYear = parseInt(a.year, 10) || 9999;
      const bYear = parseInt(b.year, 10) || 9999;
      return aYear - bYear;
    });

    return result;
  },

  async fetchSeriesVolumes(seriesName, author) {
    if (!seriesName || typeof seriesName !== 'string' || !seriesName.trim()) {
      return [];
    }
    const cleanSeriesName = seriesName.trim();

    // 1. Check local cache
    const cached = this.getCached(cleanSeriesName);
    if (cached && cached.length > 0) {
      return cached;
    }

    let items = [];

    // 2. Direct Google Books query
    try {
      items = await this._queryGoogleBooks(cleanSeriesName, author);
    } catch (e) {
      console.warn('[SeriesMetadataFetcher] Google Books query failed:', e);
      items = [];
    }

    // 3. Fallback: Supabase Edge Function Proxy
    if (!items || items.length === 0) {
      try {
        items = await this._queryProxy(cleanSeriesName, author);
      } catch (e) {
        console.warn('[SeriesMetadataFetcher] Proxy query failed:', e);
        items = [];
      }
    }

    // 4. Fallback: OpenLibrary search
    if (!items || items.length === 0) {
      try {
        items = await this._queryOpenLibrary(cleanSeriesName, author);
      } catch (e) {
        console.warn('[SeriesMetadataFetcher] OpenLibrary query failed:', e);
        items = [];
      }
    }

    // 5. Deduplicate and sort
    const deduplicated = this._deduplicateVolumes(items);

    // 6. Cache result (even if empty to prevent hammering on unknown series)
    this.setCached(cleanSeriesName, author, deduplicated);

    return deduplicated;
  },

  async detectSeriesForBook(title, author = '') {
    if (!title || typeof title !== 'string') return null;
    const cleanT = title.trim();
    const cleanA = (author || '').trim();

    // 1. Check title regex first
    const regexMatch = (typeof parseSeriesFromTitle === 'function') ? parseSeriesFromTitle(cleanT) : null;
    if (regexMatch && regexMatch.seriesName) {
      return { seriesName: regexMatch.seriesName, seriesNumber: regexMatch.seriesNumber };
    }

    const cacheKey = 'sl_book_series_' + (cleanT + '_' + cleanA).toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 70);
    if (typeof localStorage !== 'undefined') {
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.expires && Date.now() < parsed.expires) {
            return parsed.result;
          }
        }
      } catch (e) {}
    }

    let detected = null;

    // 2. Query OpenLibrary search.json for native series_name & series_position
    try {
      const q = `title=${encodeURIComponent(cleanT)}` + (cleanA ? `&author=${encodeURIComponent(cleanA)}` : '');
      const url = `https://openlibrary.org/search.json?${q}&limit=3&fields=title,author_name,series_name,series_position,series_key`;
      const data = await this._fetchJSON(url, {}, 5000);
      if (data && data.docs && data.docs.length > 0) {
        for (const doc of data.docs) {
          if (doc.series_name && doc.series_name.length > 0) {
            const rawName = Array.isArray(doc.series_name) ? doc.series_name[0] : doc.series_name;
            const rawPos = Array.isArray(doc.series_position) ? doc.series_position[0] : (doc.series_position || null);
            if (rawName && typeof rawName === 'string' && rawName.trim().length > 1) {
              const num = rawPos ? parseFloat(rawPos) : this._parseVolumeNumber(cleanT, '', '', rawName);
              detected = {
                seriesName: rawName.trim(),
                seriesNumber: (num && !isNaN(num)) ? num : null
              };
              break;
            }
          }
        }
      }
    } catch (olErr) {
      console.warn('[SeriesMetadataFetcher] OpenLibrary series detect error:', olErr);
    }

    // 3. Fallback: Google Books API
    if (!detected) {
      try {
        let gbQuery = `intitle:${encodeURIComponent(cleanT)}`;
        if (cleanA) gbQuery += `+inauthor:${encodeURIComponent(cleanA)}`;
        let gbUrl = `https://www.googleapis.com/books/v1/volumes?q=${gbQuery}&maxResults=3&printType=books`;
        if (typeof localStorage !== 'undefined' && localStorage.getItem('sl_gb_key')) {
          gbUrl += '&key=' + localStorage.getItem('sl_gb_key');
        }
        const gbData = await this._fetchJSON(gbUrl, {}, 5000);
        if (gbData && gbData.items && gbData.items.length > 0) {
          for (const item of gbData.items) {
            const vi = item.volumeInfo || {};
            const parseFn = (typeof parseSeriesFromTitle === 'function') ? parseSeriesFromTitle : null;
            if (parseFn) {
              const fromTitle = parseFn(vi.title || '');
              if (fromTitle && fromTitle.seriesName) {
                detected = { seriesName: fromTitle.seriesName, seriesNumber: fromTitle.seriesNumber };
                break;
              }
              if (vi.subtitle) {
                const fromSub = parseFn(vi.subtitle);
                if (fromSub && fromSub.seriesName) {
                  detected = { seriesName: fromSub.seriesName, seriesNumber: fromSub.seriesNumber };
                  break;
                }
              }
            }
          }
        }
      } catch (gbErr) {
        console.warn('[SeriesMetadataFetcher] Google Books series detect error:', gbErr);
      }
    }

    if (detected && detected.seriesName) {
      const allBooks = (typeof window !== 'undefined' && window.App && window.App.books) || [];
      const harmonized = findMatchingLibrarySeries(detected.seriesName, cleanA, allBooks);
      if (harmonized) {
        detected.seriesName = harmonized;
      }
    }

    // Cache the result (save for 30 days if found, or 1 hour if negative)
    if (typeof localStorage !== 'undefined') {
      try {
        const payload = {
          result: detected,
          expires: Date.now() + (detected ? this._CACHE_TTL : 3600000)
        };
        localStorage.setItem(cacheKey, JSON.stringify(payload));
      } catch (e) {}
    }

    return detected;
  },

  async autoEnrichShelfSeries(books, updateFn) {
    if (!Array.isArray(books) || !books.length) return 0;
    const needsEnrichment = books.filter(b => b && b.title && (
      (!b.seriesName || !b.seriesName.trim()) ||
      (b.seriesName && (b.seriesNumber == null || isNaN(b.seriesNumber)))
    ));
    if (!needsEnrichment.length) return 0;

    let enrichedCount = 0;
    // Process first 6 eligible books in background
    for (let i = 0; i < Math.min(needsEnrichment.length, 6); i++) {
      const b = needsEnrichment[i];
      try {
        const detected = await this.detectSeriesForBook(b.title, b.author);
        if (detected) {
          const updates = {};
          const canonicalSeries = findMatchingLibrarySeries(detected.seriesName, b.author, books) || detected.seriesName;
          // Assign seriesName if missing
          if ((!b.seriesName || !b.seriesName.trim()) && canonicalSeries) {
            b.seriesName = canonicalSeries;
            updates.series_name = canonicalSeries;
          } else if (b.seriesName && isTypoOrVariant(b.seriesName, canonicalSeries)) {
            // Auto-harmonize typos or variations to canonical consensus name!
            b.seriesName = canonicalSeries;
            updates.series_name = canonicalSeries;
          }
          // Enrich missing series number
          if ((b.seriesNumber == null || isNaN(b.seriesNumber)) && detected.seriesNumber != null) {
            b.seriesNumber = detected.seriesNumber;
            updates.series_number = detected.seriesNumber;
          }
          if (Object.keys(updates).length > 0 && typeof updateFn === 'function') {
            await updateFn(b.id || b._dbId, updates);
            enrichedCount++;
          }
        }
      } catch (e) {}
    }
    return enrichedCount;
  }
};

if (typeof window !== 'undefined') {
  window.SeriesMetadataFetcher = SeriesMetadataFetcher;
  if (window.App) window.App.SeriesMetadataFetcher = SeriesMetadataFetcher;
}

// ==========================================
// 2. DuplicateDetector
// ==========================================
export const DuplicateDetector = {
  _normalize(str) {
    return (str || '').toLowerCase().trim()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ');
  },

  _fuzzyMatch(a, b) {
    const na = this._normalize(a);
    const nb = this._normalize(b);
    if (!na || !nb) return false;
    if (na === nb) return true;
    if (na.includes(nb) || nb.includes(na)) return true;

    if (Math.abs(na.length - nb.length) <= 3 && na.length > 5) {
      let diffs = 0;
      const shorter = na.length <= nb.length ? na : nb;
      const longer = na.length > nb.length ? na : nb;
      for (let i = 0; i < shorter.length && diffs <= 2; i++) {
        if (shorter[i] !== longer[i]) diffs++;
      }
      diffs += longer.length - shorter.length;
      return diffs <= 2;
    }
    return false;
  },

  async findDuplicate(title, author, isbn, userId) {
    try {
      let allBooks = await DB.getAllUserBooks(userId);
      if (!allBooks || !allBooks.length) return null;

      if (isbn) {
        const isbnMatch = allBooks.find(b => b.isbn && b.isbn === isbn);
        if (isbnMatch) return isbnMatch;
      }

      for (const b of allBooks) {
        if (this._fuzzyMatch(b.title, title) && this._fuzzyMatch(b.author, author)) {
          return b;
        }
      }
      return null;
    } catch (err) {
      console.warn('[DuplicateDetector] Error checking duplicates:', err);
      return null;
    }
  },

  showModal(existingBook, newBookData, onAddReread, onCancel) {
    const sentEmojis = { love: '❤️', like: '👍', mixed: '😐', dislike: '👎' };
    const sentLabels = { love: 'Loved', like: 'Liked', mixed: 'Mixed', dislike: 'Disliked' };
    const month = existingBook.month_finished || 'Unknown';
    const year = existingBook._shelfYear || '';
    const sent = existingBook.sentiment || 'mixed';

    const body = document.getElementById('dupeModalBody');
    if (body) {
      body.innerHTML = `You already read <strong style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">${esc(existingBook.title)}</strong> by ${esc(existingBook.author)} in <strong>${esc(month)} ${esc(year)}</strong> (${sentEmojis[sent] || ''} ${sentLabels[sent] || sent}).`;
    }

    const actions = document.getElementById('dupeModalActions');
    if (actions) {
      actions.innerHTML = '';

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn-secondary';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.onclick = () => { this.hideModal(); if (onCancel) onCancel(); };

      const rereadBtn = document.createElement('button');
      rereadBtn.className = 'btn-primary';
      rereadBtn.textContent = '🔁 Add as Re-read';
      rereadBtn.onclick = () => { this.hideModal(); if (onAddReread) onAddReread(existingBook); };

      const viewBtn = document.createElement('button');
      viewBtn.className = 'btn-secondary';
      viewBtn.textContent = '👁 View Original';
      viewBtn.onclick = () => {
        this.hideModal();
        const appBooks = (typeof window !== 'undefined' && window.App && window.App.books) ? window.App.books : [];
        const localBook = appBooks.find(b => String(b.id) === String(existingBook.id));
        if (localBook) {
          openPanel(localBook);
        } else {
          openPanel(dbToBook(existingBook));
        }
      };

      actions.appendChild(cancelBtn);
      actions.appendChild(rereadBtn);
      actions.appendChild(viewBtn);
    }

    const dupeModal = document.getElementById('dupeModal');
    if (dupeModal) dupeModal.classList.add('open');
  },

  hideModal() {
    const dupeModal = document.getElementById('dupeModal');
    if (dupeModal) dupeModal.classList.remove('open');
  }
};

// ==========================================
// 3. ScannerLoader
// ==========================================
export const ScannerLoader = {
  _loaded: false,
  _loading: false,

  async load() {
    if (this._loaded) return true;
    if (this._loading) {
      return new Promise(resolve => {
        const check = setInterval(() => {
          if (!this._loading) { clearInterval(check); resolve(this._loaded); }
        }, 50);
      });
    }

    this._loading = true;

    const loadSingleScript = (src) => new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) { resolve(); return; }
      const s = document.createElement('script');
      s.src = src;
      s.crossOrigin = 'anonymous';
      s.onload = () => resolve();
      s.onerror = (e) => reject(e);
      document.head.appendChild(s);
    });

    const loadWithFallbacks = async (sources, globalCheck) => {
      if (typeof window !== 'undefined' && globalCheck && globalCheck()) return true;
      for (const src of sources) {
        try {
          await loadSingleScript(src);
          if (!globalCheck || globalCheck()) return true;
        } catch (e) {
          console.warn('[ScannerLoader] Fallback needed for:', src);
        }
      }
      return false;
    };

    const basePath = (typeof window !== 'undefined' && window.location.pathname.includes('/NoteToShelf'))
      ? '/NoteToShelf/libs/'
      : 'libs/';

    // 1. ZXing (Primary barcode reader)
    const zxingOk = await loadWithFallbacks([
      basePath + 'zxing.min.js',
      'libs/zxing.min.js',
      './libs/zxing.min.js',
      '/libs/zxing.min.js',
      'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js'
    ], () => typeof window !== 'undefined' && !!window.ZXing);

    // 2. Quagga (Secondary barcode fallback)
    const quaggaOk = await loadWithFallbacks([
      basePath + 'quagga.min.js',
      'libs/quagga.min.js',
      './libs/quagga.min.js',
      '/libs/quagga.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/quagga/0.12.1/quagga.min.js'
    ], () => typeof window !== 'undefined' && !!window.Quagga);

    // 3. Tesseract (OCR)
    const tesseractOk = await loadWithFallbacks([
      basePath + 'tesseract.min.js',
      'libs/tesseract.min.js',
      './libs/tesseract.min.js',
      '/libs/tesseract.min.js',
      'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js'
    ], () => typeof window !== 'undefined' && !!window.Tesseract);

    const hasBarcodeEngine = zxingOk || quaggaOk || (typeof BarcodeDetector !== 'undefined');
    if (typeof window !== 'undefined') {
      window._quaggaLoadFailed = !hasBarcodeEngine;
      window._tesseractLoadFailed = !tesseractOk;
    }

    this._loaded = hasBarcodeEngine || tesseractOk;
    this._loading = false;
    return this._loaded;
  }
};

// ==========================================
// 4. CameraScanner
// ==========================================
export const CameraScanner = {
  _stream: null,
  _quaggaRunning: false,
  _zxingReader: null,
  _ocrTimeout: null,
  _scanResult: null,
  _lowConfResult: null,
  _autoAcceptTimer: null,
  _failCount: 0,
  _maxFails: 3,
  _videoTrack: null,
  _nativeDetector: null,
  _lastScannedISBN: null,
  _ocrActive: false,

  _haptic(pattern) {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(pattern);
      }
    } catch (e) { /* no-op */ }
  },

  _showSpinner() { const s = document.getElementById('scanSpinner'); if (s) s.classList.add('active'); },
  _hideSpinner() { const s = document.getElementById('scanSpinner'); if (s) s.classList.remove('active'); },
  _hideManualNudge() { const n = document.getElementById('scanManualNudge'); if (n) n.style.display = 'none'; },
  _showManualNudge() { const n = document.getElementById('scanManualNudge'); if (n) n.style.display = 'block'; },

  async start() {
    const videoEl = document.getElementById('scanVideo');
    const areaEl = document.getElementById('cameraScanArea');
    const statusEl = document.getElementById('scanStatus');
    const ocrBtn = document.getElementById('scanOcrBtn');
    const retryBtn = document.getElementById('scanRetryBtn');
    const resultEl = document.getElementById('scanResult');

    if (areaEl) areaEl.style.display = 'block';
    if (resultEl) resultEl.style.display = 'none';
    if (ocrBtn) ocrBtn.style.display = 'none';
    if (retryBtn) retryBtn.style.display = 'none';
    this._clearErrorFlash();
    this._hideManualNudge();
    this._failCount = 0;
    if (statusEl) statusEl.textContent = 'Starting camera & scanner...';
    this._showSpinner();
    this._cancelAutoAccept();
    this._scanResult = null;
    this._lowConfResult = null;

    // 1. Ensure barcode & OCR libraries are loaded
    try {
      await ScannerLoader.load();
    } catch (loadErr) {
      console.warn('[CameraScanner] Library preloading warning:', loadErr);
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported in this browser or over insecure HTTP.');
      }

      // Try environment rear camera first, fall back to any available camera
      try {
        this._stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 }
          }
        });
      } catch (eEnv) {
        console.warn('[CameraScanner] FacingMode ideal environment failed, trying standard video...', eEnv);
        this._stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      if (videoEl) {
        videoEl.muted = true;
        videoEl.playsInline = true;
        videoEl.srcObject = this._stream;
        await videoEl.play();
      }
      this._videoTrack = (this._stream && this._stream.getVideoTracks && this._stream.getVideoTracks()[0]) || null;
      this._applyCameraTuning();
      this._hideSpinner();

      if (statusEl) statusEl.textContent = '📸 Point camera at the book\'s barcode (ISBN)...';
      this._setScanning(true);
      if (videoEl) this._startScanner(videoEl);

      // Non-blocking timer: after 12s, offer OCR and Retry without killing scanner
      this._ocrTimeout = setTimeout(() => {
        if (!this._scanResult && this._quaggaRunning) {
          const ocrBtn = document.getElementById('scanOcrBtn');
          if (ocrBtn) ocrBtn.style.display = 'inline-block';
          const retryBtn = document.getElementById('scanRetryBtn');
          if (retryBtn) retryBtn.style.display = 'inline-block';
          if (statusEl) statusEl.textContent = 'Still looking for barcode... Hold steady or tap Read Cover Text below.';
        }
      }, 12000);
    } catch (err) {
      this._hideSpinner();
      console.warn('[CameraScanner] Camera access error:', err);
      let errorMsg, errorDetail;
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMsg = 'Camera access denied';
        errorDetail = 'Please enable camera permissions in your browser settings, or add books manually using the search above.';
      } else if (err.name === 'NotFoundError' || err.name === 'NotReadableError') {
        errorMsg = 'No camera available';
        errorDetail = 'No camera was found on this device. You can still add books using the search above.';
      } else if (err.name === 'NotSupportedError' || err.name === 'TypeError') {
        errorMsg = 'Camera not supported';
        errorDetail = 'Your browser may not support camera access. Try using Safari on iOS or Chrome on Android, or add books manually.';
      } else {
        errorMsg = 'Camera error';
        errorDetail = (err.message || 'An unknown error occurred.') + ' You can still add books using the search above.';
      }

      if (statusEl) statusEl.innerHTML = '';
      if (areaEl) {
        areaEl.innerHTML = `
          <div style="text-align:center;padding:24px 16px;">
            <div style="font-size:32px;margin-bottom:10px;">❌</div>
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;font-weight:700;color:var(--wood-dark);margin-bottom:8px;">⚠️ ${errorMsg}</div>
            <div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--wood-light);line-height:1.6;max-width:340px;margin:0 auto 16px;">${errorDetail}</div>
            <button onclick="CameraScanner.stop();App.setAddMode('search');" style="background:var(--wood-dark);color:#f0e8dc;border:none;padding:10px 20px;border-radius:4px;font-family:'DM Mono',monospace;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;cursor:pointer;">← Back to Search</button>
          </div>`;
      }
    }
  },

  _applyCameraTuning() {
    try {
      const track = this._videoTrack;
      if (!track || !track.getCapabilities) return;
      const caps = track.getCapabilities();
      const adv = [];
      if (caps.focusMode && caps.focusMode.includes && caps.focusMode.includes('continuous')) {
        adv.push({ focusMode: 'continuous' });
      }
      if (caps.zoom && typeof caps.zoom.min === 'number' && typeof caps.zoom.max === 'number') {
        const target = Math.min(caps.zoom.max, Math.max(caps.zoom.min, caps.zoom.min + (caps.zoom.max - caps.zoom.min) * 0.15));
        if (target > caps.zoom.min) adv.push({ zoom: target });
      }
      if (adv.length) track.applyConstraints({ advanced: adv }).catch(() => {});
    } catch (e) { /* tuning is optional */ }
  },

  _startScanner(videoEl) {
    this._quaggaRunning = true;
    this._startFrameLoop(videoEl);
  },

  _stopScannerEngines() {
    this._quaggaRunning = false;
    if (this._scanFrameTimer) {
      clearTimeout(this._scanFrameTimer);
      this._scanFrameTimer = null;
    }
    if (this._zxingReader) {
      try { this._zxingReader.reset(); } catch (e) {}
      this._zxingReader = null;
    }
  },

  _startFrameLoop(videoEl) {
    const canvas = document.getElementById('scanCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // Offscreen helper canvases for center crop ROI and rotation
    const cropCanvas = document.createElement('canvas');
    const cropCtx = cropCanvas.getContext('2d', { willReadFrequently: true });
    const rotCanvas = document.createElement('canvas');
    const rotCtx = rotCanvas.getContext('2d', { willReadFrequently: true });

    if (typeof BarcodeDetector !== 'undefined' && !this._nativeDetector) {
      try {
        this._nativeDetector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] });
      } catch (e) { console.warn(e); }
    }

    let zxingReader = null;
    if (typeof ZXing !== 'undefined') {
      try {
        const hints = new Map();
        if (ZXing.DecodeHintType) {
          hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
          if (ZXing.BarcodeFormat) {
            hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
              ZXing.BarcodeFormat.EAN_13,
              ZXing.BarcodeFormat.EAN_8,
              ZXing.BarcodeFormat.UPC_A,
              ZXing.BarcodeFormat.UPC_E,
              ZXing.BarcodeFormat.CODE_128,
              ZXing.BarcodeFormat.CODE_39
            ]);
          }
        }
        zxingReader = new ZXing.MultiFormatReader();
        zxingReader.setHints(hints);
      } catch (ze) { console.warn('[CameraScanner] ZXing init warning:', ze); }
    }

    const decodeWithZXing = (sourceCanvas) => {
      if (!zxingReader || !sourceCanvas || !sourceCanvas.width || !sourceCanvas.height) return null;
      try {
        const lum = new ZXing.HTMLCanvasElementLuminanceSource(sourceCanvas);
        const bin = new ZXing.HybridBinarizer(lum);
        const bmp = new ZXing.BinaryBitmap(bin);
        const res = zxingReader.decode(bmp);
        if (res && res.getText && res.getText()) return res.getText();
      } catch (e) {}

      // Fallback: GlobalHistogramBinarizer for reflective/glossy book surfaces
      try {
        if (ZXing.GlobalHistogramBinarizer) {
          const lum = new ZXing.HTMLCanvasElementLuminanceSource(sourceCanvas);
          const bin = new ZXing.GlobalHistogramBinarizer(lum);
          const bmp = new ZXing.BinaryBitmap(bin);
          const res = zxingReader.decode(bmp);
          if (res && res.getText && res.getText()) return res.getText();
        }
      } catch (e) {}
      return null;
    };

    let frameCount = 0;
    const scanFrame = async () => {
      if (!this._quaggaRunning || !this._stream) return;
      if (!videoEl || videoEl.readyState < 2 || !videoEl.videoWidth || !videoEl.videoHeight) {
        this._scanFrameTimer = setTimeout(scanFrame, 120);
        return;
      }

      const vw = videoEl.videoWidth;
      const vh = videoEl.videoHeight;
      frameCount++;

      // 1. Native Hardware BarcodeDetector (Pass video element directly for max GPU speed)
      if (this._nativeDetector) {
        try {
          const barcodes = await this._nativeDetector.detect(videoEl);
          if (barcodes && barcodes.length > 0) {
            const raw = barcodes[0].rawValue;
            const valid = this._validateISBN(raw);
            if (valid) {
              this._onBarcodeDetected(valid);
              return;
            }
          }
        } catch (e) {}
      }

      // 2. High-Res Center Crop ROI (Matches the viewfinder box at 1:1 sensor sharpness)
      // Viewfinder in CSS is 74% width, 46% height
      const cropW = Math.round(vw * 0.76);
      const cropH = Math.round(vh * 0.55);
      const cropX = Math.round((vw - cropW) / 2);
      const cropY = Math.round((vh - cropH) / 2);

      if (cropCanvas.width !== cropW || cropCanvas.height !== cropH) {
        cropCanvas.width = cropW;
        cropCanvas.height = cropH;
      }
      cropCtx.drawImage(videoEl, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

      // Pass 2A: Horizontal Center Crop
      let detectedCode = decodeWithZXing(cropCanvas);
      let valid = this._validateISBN(detectedCode);
      if (valid) {
        this._onBarcodeDetected(valid);
        return;
      }

      // Pass 2B: Vertical / Rotated 90° Center Crop (Books held vertically)
      if (rotCanvas.width !== cropH || rotCanvas.height !== cropW) {
        rotCanvas.width = cropH;
        rotCanvas.height = cropW;
      }
      rotCtx.save();
      rotCtx.translate(rotCanvas.width / 2, rotCanvas.height / 2);
      rotCtx.rotate(Math.PI / 2);
      rotCtx.drawImage(cropCanvas, -cropW / 2, -cropH / 2);
      rotCtx.restore();

      detectedCode = decodeWithZXing(rotCanvas);
      valid = this._validateISBN(detectedCode);
      if (valid) {
        this._onBarcodeDetected(valid);
        return;
      }

      // 3. Full Frame Fallback (For books held further away or off-center)
      const targetW = Math.min(vw, 800);
      const targetH = Math.round((vh / vw) * targetW);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
      ctx.drawImage(videoEl, 0, 0, targetW, targetH);

      detectedCode = decodeWithZXing(canvas);
      valid = this._validateISBN(detectedCode);
      if (valid) {
        this._onBarcodeDetected(valid);
        return;
      }

      // 4. Quagga fallback if ZXing is not available
      if (!zxingReader && typeof Quagga !== 'undefined' && frameCount % 2 === 0) {
        try {
          Quagga.decodeSingle({
            src: canvas.toDataURL('image/jpeg', 0.85),
            numOfWorkers: 0,
            inputStream: { size: targetW },
            decoder: {
              readers: ['ean_reader', 'ean_8_reader', 'upc_reader'],
              multiple: false
            },
            locate: true,
            locator: { halfSample: true, patchSize: 'medium' }
          }, (result) => {
            if (!this._quaggaRunning) return;
            if (result && result.codeResult && result.codeResult.code) {
              const code = result.codeResult.code;
              const conf = this._codeConfidence(result.codeResult);
              const qValid = this._validateISBN(code);
              if (qValid && conf >= 0.70) {
                this._onBarcodeDetected(qValid);
              }
            }
          });
        } catch (e) {}
      }

      // Real-time helpful scanning hints
      if (frameCount % 6 === 0) {
        const dots = '.'.repeat((Math.floor(frameCount / 6) % 3) + 1);
        const statusEl = document.getElementById('scanStatus');
        if (statusEl && this._quaggaRunning && statusEl.textContent && statusEl.textContent.startsWith('📸 Point camera')) {
          statusEl.textContent = '📸 Point camera at the book\'s barcode (ISBN)' + dots;
        }
      }

      if (this._quaggaRunning) {
        this._scanFrameTimer = setTimeout(scanFrame, 75);
      }
    };

    scanFrame();
  },

  _validateISBN(code) {
    if (!code) return null;
    const clean = String(code).trim().replace(/[^0-9Xx]/g, '');
    const validLen = /^\d{8}$|^\d{10,13}$/.test(clean);
    const checksumOk = (clean.length !== 13) || this._isValidEAN13(clean);
    return (validLen && checksumOk) ? clean : null;
  },

  _onBarcodeDetected(code) {
    const statusEl = document.getElementById('scanStatus');
    if (statusEl) statusEl.textContent = '📖 ISBN found: ' + code;
    this._stopScannerEngines();
    this._setScanning(false);
    this._lookupISBN(code);
  },

  _codeConfidence(codeResult) {
    try {
      const codes = codeResult && codeResult.decodedCodes;
      if (!codes || !codes.length) return 1;
      let sum = 0, n = 0;
      codes.forEach(c => { if (typeof c.error === 'number') { sum += c.error; n++; } });
      if (!n) return 1;
      return Math.max(0, Math.min(1, 1 - (sum / n)));
    } catch (e) { return 1; }
  },

  _isValidEAN13(code) {
    if (!/^\d{13}$/.test(code)) return false;
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(code[i], 10) * (i % 2 === 0 ? 1 : 3);
    }
    const check = (10 - (sum % 10)) % 10;
    return check === parseInt(code[12], 10);
  },

  async _lookupISBN(isbn) {
    const statusEl = document.getElementById('scanStatus');
    if (statusEl) statusEl.textContent = '🔎 Looking up ISBN ' + isbn + '...';
    this._showSpinner();
    this._lastScannedISBN = isbn;

    // Tier 1: OpenLibrary search.json
    try {
      const res = await fetch(`https://openlibrary.org/search.json?isbn=${encodeURIComponent(isbn)}&limit=1`);
      if (res.ok) {
        const data = await res.json();
        if (data.docs && data.docs.length > 0) {
          const doc = data.docs[0];
          this._scanResult = {
            title: doc.title || '',
            author: (doc.author_name && doc.author_name[0]) || 'Unknown',
            coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`,
            pages: doc.number_of_pages_median || 0,
            year: doc.first_publish_year ? String(doc.first_publish_year) : '',
            isbn: isbn,
            scanMethod: 'barcode'
          };
          this._hideSpinner();
          this._showScanResult();
          return;
        }
      }
    } catch (e1) {
      console.warn('[CameraScanner] Tier 1 OpenLibrary search failed:', e1);
    }

    // Tier 2: OpenLibrary isbn.json
    try {
      const res = await fetch(`https://openlibrary.org/isbn/${encodeURIComponent(isbn)}.json`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.title) {
          let author = 'Unknown';
          if (data.by_statement) {
            author = data.by_statement.split(';')[0].replace(/^by\s+/i, '').trim();
          }
          const year = data.publish_date ? (data.publish_date.match(/\d{4}/) ? data.publish_date.match(/\d{4}/)[0] : data.publish_date) : '';
          this._scanResult = {
            title: data.title || '',
            author: author,
            coverUrl: (data.covers && data.covers.length > 0) ? `https://covers.openlibrary.org/b/id/${data.covers[0]}-M.jpg` : `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`,
            pages: data.number_of_pages || 0,
            year: year,
            isbn: isbn,
            scanMethod: 'barcode'
          };
          this._hideSpinner();
          this._showScanResult();
          return;
        }
      }
    } catch (e2) {
      console.warn('[CameraScanner] Tier 2 OpenLibrary isbn.json failed:', e2);
    }

    // Tier 3: Google Books API (fail-safe against HTTP 429)
    try {
      const gUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}&maxResults=1` +
        (typeof localStorage !== 'undefined' && localStorage.getItem('sl_gb_key') ? '&key=' + localStorage.getItem('sl_gb_key') : '');
      const res = await fetch(gUrl);
      if (res.ok) {
        const data = await res.json();
        if (data.totalItems > 0 && data.items && data.items[0].volumeInfo) {
          const vol = data.items[0].volumeInfo;
          this._scanResult = {
            title: vol.title || '',
            author: (vol.authors && vol.authors[0]) || 'Unknown',
            coverUrl: vol.imageLinks ? (vol.imageLinks.thumbnail || '').replace('http:', 'https:') : '',
            pages: vol.pageCount || 0,
            year: vol.publishedDate ? (vol.publishedDate.match(/\d{4}/) ? vol.publishedDate.match(/\d{4}/)[0] : vol.publishedDate) : '',
            isbn: isbn,
            scanMethod: 'barcode'
          };
          this._hideSpinner();
          this._showScanResult();
          return;
        }
      }
    } catch (e3) {
      console.warn('[CameraScanner] Tier 3 Google Books query failed:', e3);
    }

    // Tier 4: Barcode read successfully, but not in catalogs
    this._hideSpinner();
    this._scanResult = {
      title: '',
      author: 'Unknown',
      coverUrl: `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`,
      pages: 0,
      year: '',
      isbn: isbn,
      scanMethod: 'barcode'
    };
    this._showScanFailure(`Barcode scanned (ISBN ${isbn})! Not indexed in catalogs yet. Read the cover text, or add manually with ISBN pre-filled.`, true);
  },

  _showScanResult() {
    if (!this._scanResult) return;
    this._setScanning(false);
    this._clearErrorFlash();
    clearTimeout(this._ocrTimeout);

    ['scanRetryBtn', 'scanUseAnywayBtn', 'scanOcrBtn'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });

    const titleEl = document.getElementById('scanResultTitle');
    if (titleEl) titleEl.textContent = this._scanResult.title;

    const authorEl = document.getElementById('scanResultAuthor');
    if (authorEl) {
      authorEl.textContent = this._scanResult.author + (this._scanResult.year ? ' · ' + this._scanResult.year : '');
    }

    this._haptic(60);

    const resultEl = document.getElementById('scanResult');
    if (resultEl) {
      resultEl.style.display = 'block';
      resultEl.classList.add('scan-success-flash');
      resultEl.style.border = '2px solid #4caf50';
      resultEl.style.boxShadow = '0 0 16px rgba(76,175,80,0.3)';
      resultEl.style.transition = 'border-color 0.3s, box-shadow 0.3s';
      setTimeout(() => {
        if (resultEl) {
          resultEl.style.borderColor = 'rgba(61,43,31,0.12)';
          resultEl.style.boxShadow = 'none';
        }
      }, 2000);
      if (typeof resultEl.scrollIntoView === 'function') {
        resultEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    const statusEl = document.getElementById('scanStatus');
    if (statusEl) statusEl.textContent = '✅ Book found! Auto-accepting in 2s...';

    this._stopStream();
    if (this._autoAcceptTimer) clearTimeout(this._autoAcceptTimer);

    this._autoAcceptTimer = setTimeout(() => {
      this._autoAcceptTimer = null;
      if (this._scanResult) {
        if (typeof window !== 'undefined' && window.App && typeof window.App.useScanResult === 'function') {
          window.App.useScanResult();
        }
      }
    }, 2000);
  },

  _cancelAutoAccept() {
    if (this._autoAcceptTimer) {
      clearTimeout(this._autoAcceptTimer);
      this._autoAcceptTimer = null;
    }
  },

  async tryOCR() {
    this._ocrActive = true;
    const videoEl = document.getElementById('scanVideo');
    const canvas = document.getElementById('scanCanvas');
    const statusEl = document.getElementById('scanStatus');
    const ocrBtn = document.getElementById('scanOcrBtn');

    if (ocrBtn) ocrBtn.style.display = 'none';
    this._clearErrorFlash();
    this._hideManualNudge();
    this._stopScannerEngines();
    this._setScanning(false);

    // Ensure camera stream is active
    const isStreamActive = this._stream && this._stream.active && this._stream.getVideoTracks().some(t => t.readyState === 'live');
    if (!isStreamActive || !videoEl || !videoEl.videoWidth) {
      try {
        await this.start();
      } catch (camErr) {
        this._showScanFailure('Camera view not available for OCR.', false);
        return;
      }
    }

    if (typeof Tesseract === 'undefined') {
      if (statusEl) statusEl.textContent = '📖 Loading OCR library...';
      this._showSpinner();
      try {
        await ScannerLoader.load();
      } catch (e) {
        console.warn('[CameraScanner] Tesseract load failed on demand:', e);
      }
      this._hideSpinner();
    }

    if (!this._ocrActive) return;

    if (typeof Tesseract === 'undefined') {
      this._showScanFailure('OCR library not loaded - try searching manually.', false);
      return;
    }

    if (!videoEl || !canvas) {
      this._showScanFailure('Camera view not available for OCR.', false);
      return;
    }

    // Brief steady guide
    if (statusEl) statusEl.textContent = '📖 Aim camera at front cover & hold steady...';
    await new Promise(r => setTimeout(r, 900));
    if (!this._ocrActive) return;
    if (statusEl) statusEl.textContent = '📸 Capturing cover...';
    this._showSpinner();

    try {
      const vw = videoEl.videoWidth || 640;
      const vh = videoEl.videoHeight || 480;
      const cropW = Math.round(vw * 0.94);
      const cropH = Math.round(vh * 0.94);
      const cropX = Math.round((vw - cropW) / 2);
      const cropY = Math.round((vh - cropH) / 2);

      // Target optimal ~850px width: avoids mobile WASM memory bloat and speeds up OCR by ~4x
      const targetW = Math.min(cropW, 850);
      const scale = targetW / cropW;
      canvas.width = Math.round(cropW * scale);
      canvas.height = Math.round(cropH * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        this._hideSpinner();
        this._showScanFailure('Canvas 2D context not available.', false);
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(videoEl, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);

      try {
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = img.data;
        // Gentle contrast normalization (1.08) without blowing out highlights or pastel art
        const contrast = 1.08, brightness = 4;
        const intercept = 128 * (1 - contrast);
        for (let i = 0; i < d.length; i += 4) {
          let g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          g = contrast * g + intercept + brightness;
          g = g < 0 ? 0 : (g > 255 ? 255 : g);
          d[i] = d[i + 1] = d[i + 2] = g;
        }
        ctx.putImageData(img, 0, 0);
      } catch (pre) { console.warn('[CameraScanner] preprocess skipped:', pre); }

      let text = '', confidence = 0;
      const ocrTimeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('OCR took too long. Check your connection or search manually.')), 25000)
      );

      const doRecognize = async () => {
        const loggerFn = m => {
          const s = document.getElementById('scanStatus');
          if (!s) return;
          if (m.status === 'recognizing text') {
            s.textContent = '📖 Reading cover text (' + Math.round((m.progress || 0) * 100) + '%)...';
          } else if (m.status && m.status.includes('loading')) {
            s.textContent = '📖 Initializing OCR engine...';
          }
        };

        if (typeof Tesseract.recognize === 'function') {
          return await Tesseract.recognize(canvas, 'eng', { logger: loggerFn });
        } else if (Tesseract.createWorker) {
          const worker = await Tesseract.createWorker('eng', 1, { logger: loggerFn });
          try {
            if (worker.setParameters) {
              await worker.setParameters({
                tessedit_pageseg_mode: '3', // Fully automatic page segmentation (better for posters & book covers)
                preserve_interword_spaces: '1'
              });
            }
          } catch (sp) { console.warn(sp); }
          const res = await worker.recognize(canvas);
          try { await worker.terminate(); } catch (e) {}
          return res;
        } else {
          throw new Error('OCR library format not recognized.');
        }
      };

      const ocrResult = await Promise.race([doRecognize(), ocrTimeoutPromise]);
      text = ocrResult && ocrResult.data ? ocrResult.data.text : '';
      confidence = (ocrResult && ocrResult.data && ocrResult.data.confidence) || 0;

      this._hideSpinner();
      const noiseWords = /^(the\s+new\s+york\s+times|bestseller|a\s+novel|national\s+bestseller|international\s+bestseller|author\s+of|edition|paperback|volume|special\s+edition|illustrated|winner\s+of|instant\s+#1|#1\s+bestseller|reese's\s+book\s+club|oprah's\s+book\s+club|read\s+with\s+jenna|good\s+morning\s+america|gma\s+book\s+club|pulitzer\s+prize|booker\s+prize|major\s+motion\s+picture|netflix|now\s+a\s+series|with\s+a\s+new\s+foreword|introduction\s+by|translated\s+by|from\s+the\s+author\s+of|praise\s+for|a\s+memoir|stories|a\s+thriller|a\s+romance|hardcover|harpercollins|penguin|random\s+house|simon\s+&\s+schuster|macmillan|tor\s+books)/i;
      const lines = text.split('\n')
        .map(l => l.trim().replace(/^[^a-zA-Z0-9'":,-]+|[^a-zA-Z0-9'":,-]+$/g, ''))
        .filter(l => l.length >= 3 && /[a-zA-Z]{2,}/.test(l) && !noiseWords.test(l));

      if (lines.length >= 1) {
        const title = lines[0] || '';
        const author = lines.length > 1 ? lines[1] : '';

        if (confidence && confidence < 35 && lines.length === 1 && title.length < 5) {
          this._lowConfResult = { title: title, author: author || 'Unknown', coverUrl: '', pages: 0, year: '', isbn: this._lastScannedISBN || null, scanMethod: 'ocr' };
          const ua = document.getElementById('scanUseAnywayBtn');
          if (ua) {
            ua.style.display = 'inline-block';
            ua.textContent = '✔️ Use “' + (title.length > 22 ? title.slice(0, 22) + '...' : title) + '”';
          }
          const rb = document.getElementById('scanRetryBtn');
          if (rb) rb.style.display = 'inline-block';
          if (statusEl) statusEl.textContent = 'Low confidence read (' + Math.round(confidence) + '%). Use it anyway, or try again?';
          this._flashError();
          return;
        }

        if (statusEl) statusEl.textContent = 'Identifying book from cover...';
        await this._searchByOCRText(title, author, lines);
      } else {
        this._showScanFailure('Could not read clear text from the cover. Hold front cover flat under good lighting, or type title manually.', true);
      }
    } catch (err) {
      console.error('[CameraScanner] OCR error:', err);
      this._showScanFailure('OCR failed: ' + (err.message || 'Unknown error'), true);
    }
  },

  _flashError() {
    const area = document.getElementById('cameraScanArea');
    if (!area) return;
    this._haptic([40, 60, 40]);
    area.classList.remove('scan-error-flash');
    void area.offsetWidth;
    area.classList.add('scan-error-flash');
  },

  _clearErrorFlash() {
    const area = document.getElementById('cameraScanArea');
    if (area) area.classList.remove('scan-error-flash');
  },

  _showScanFailure(msg, offerOcr) {
    this._hideSpinner();
    const statusEl = document.getElementById('scanStatus');
    if (statusEl) statusEl.textContent = '⚠️ ' + msg;
    this._flashError();
    this._failCount++;

    const retryBtn = document.getElementById('scanRetryBtn');
    if (retryBtn) retryBtn.style.display = 'inline-block';

    const ocrBtn = document.getElementById('scanOcrBtn');
    if (ocrBtn) ocrBtn.style.display = offerOcr ? 'inline-block' : 'none';

    if (this._failCount >= this._maxFails) {
      this._showManualNudge();
      if (typeof DB !== 'undefined' && DB.trackEvent) {
        DB.trackEvent('feature_use', { feature: 'scanner_manual_nudge', attempts: this._failCount });
      }
    }
  },

  _setScanning(on) {
    const ch = document.querySelector('#cameraScanArea .scan-crosshair');
    if (ch) ch.classList.toggle('scanning', !!on);
  },

  async retry() {
    this._clearErrorFlash();
    this._hideManualNudge();
    this._scanResult = null;
    this._lowConfResult = null;

    const retryBtn = document.getElementById('scanRetryBtn');
    if (retryBtn) retryBtn.style.display = 'none';

    const ua = document.getElementById('scanUseAnywayBtn');
    if (ua) ua.style.display = 'none';

    const ocrBtn = document.getElementById('scanOcrBtn');
    if (ocrBtn) ocrBtn.style.display = 'none';

    const resultEl = document.getElementById('scanResult');
    if (resultEl) resultEl.style.display = 'none';

    clearTimeout(this._ocrTimeout);
    this._cancelAutoAccept();
    this._stopScannerEngines();

    const videoEl = document.getElementById('scanVideo');
    const statusEl = document.getElementById('scanStatus');

    const isStreamActive = this._stream && this._stream.active && this._stream.getVideoTracks().some(t => t.readyState === 'live');
    if (isStreamActive && videoEl && videoEl.videoWidth) {
      if (statusEl) statusEl.textContent = '📸 Point camera at the book\'s barcode (ISBN)...';
      this._setScanning(true);
      this._startScanner(videoEl);

      this._ocrTimeout = setTimeout(() => {
        if (!this._scanResult && this._quaggaRunning) {
          const ocrBtn = document.getElementById('scanOcrBtn');
          if (ocrBtn) ocrBtn.style.display = 'inline-block';
          const retryBtn = document.getElementById('scanRetryBtn');
          if (retryBtn) retryBtn.style.display = 'inline-block';
          if (statusEl) statusEl.textContent = 'Still looking for barcode... Hold steady or tap Read Cover Text below.';
        }
      }, 12000);
    } else {
      await this.start();
    }
  },

  useLowConfResult() {
    if (!this._lowConfResult) return;
    this._scanResult = this._lowConfResult;
    this._lowConfResult = null;

    const ua = document.getElementById('scanUseAnywayBtn');
    if (ua) ua.style.display = 'none';
    this._clearErrorFlash();
    this._showScanResult();
  },

  async _searchByOCRText(title, author, rawLines = []) {
    const statusEl = document.getElementById('scanStatus');
    if (statusEl) statusEl.textContent = '🔍 Identifying book from cover...';

    // Build smart search candidates
    const candidates = [];
    if (title && author && author !== 'Unknown') {
      candidates.push({ q: `intitle:${title}+inauthor:${author}` });
      candidates.push({ q: `intitle:${author}+inauthor:${title}` }); // Inverted author/title for author-on-top covers
      candidates.push({ q: `"${title}" ${author}` });
    }
    if (title) {
      candidates.push({ q: `intitle:${title}` });
      candidates.push({ q: `"${title}"` });
    }
    if (rawLines && rawLines.length >= 2) {
      const combined = `${rawLines[0]} ${rawLines[1]}`.trim();
      candidates.push({ q: combined });
    }

    let foundBook = null;

    // Helper: Search Google Books API (handles typos and cover phrasing with high accuracy)
    const searchGB = async (queryStr) => {
      try {
        const keyParam = (typeof localStorage !== 'undefined' && localStorage.getItem('sl_gb_key')) ? '&key=' + localStorage.getItem('sl_gb_key') : '';
        const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(queryStr)}&maxResults=3&printType=books${keyParam}`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        if (data && data.items && data.items.length > 0) {
          const vol = data.items[0].volumeInfo;
          if (vol && vol.title) {
            const isbns = vol.industryIdentifiers || [];
            const isbn13 = isbns.find(i => i.type === 'ISBN_13')?.identifier;
            const isbn10 = isbns.find(i => i.type === 'ISBN_10')?.identifier;
            const bestIsbn = isbn13 || isbn10 || this._lastScannedISBN || null;
            const cover = vol.imageLinks?.thumbnail?.replace('http:', 'https:') ||
                          vol.imageLinks?.smallThumbnail?.replace('http:', 'https:') ||
                          (bestIsbn ? `https://covers.openlibrary.org/b/isbn/${bestIsbn}-M.jpg` : '');
            return {
              title: vol.title,
              author: (vol.authors && vol.authors[0]) || author || 'Unknown',
              coverUrl: cover,
              pages: vol.pageCount || 0,
              year: vol.publishedDate ? vol.publishedDate.slice(0, 4) : '',
              isbn: bestIsbn,
              scanMethod: 'ocr'
            };
          }
        }
      } catch (err) {
        console.warn('[CameraScanner] GB OCR search error:', err);
      }
      return null;
    };

    // Helper: Search OpenLibrary API
    const searchOL = async (queryStr, isTitleOnly = false) => {
      try {
        const param = isTitleOnly ? `title=${encodeURIComponent(queryStr)}` : `q=${encodeURIComponent(queryStr)}`;
        const res = await fetch(`https://openlibrary.org/search.json?${param}&limit=1&fields=title,author_name,cover_i,number_of_pages_median,first_publish_year,isbn`);
        if (!res.ok) return null;
        const data = await res.json();
        if (data && data.docs && data.docs.length > 0) {
          const doc = data.docs[0];
          const bestIsbn = (doc.isbn && doc.isbn[0]) || this._lastScannedISBN || null;
          const cover = doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` :
                        (bestIsbn ? `https://covers.openlibrary.org/b/isbn/${bestIsbn}-M.jpg` : '');
          return {
            title: doc.title || title,
            author: (doc.author_name && doc.author_name[0]) || author || 'Unknown',
            coverUrl: cover,
            pages: doc.number_of_pages_median || 0,
            year: doc.first_publish_year ? String(doc.first_publish_year) : '',
            isbn: bestIsbn,
            scanMethod: 'ocr'
          };
        }
      } catch (err) {
        console.warn('[CameraScanner] OL OCR search error:', err);
      }
      return null;
    };

    // 1. Try Google Books across candidates
    for (const cand of candidates) {
      foundBook = await searchGB(cand.q);
      if (foundBook) break;
    }

    // 2. Fallback to OpenLibrary if Google Books did not find it
    if (!foundBook) {
      if (title && author && author !== 'Unknown') {
        foundBook = await searchOL(`${title} ${author}`);
      }
      if (!foundBook && title) {
        foundBook = await searchOL(title, true);
      }
    }

    if (foundBook) {
      this._scanResult = foundBook;
      this._showScanResult();
    } else {
      // Fallback: Preserve recognized text for manual confirmation
      this._scanResult = {
        title: title || 'Unknown Title',
        author: author || 'Unknown',
        coverUrl: this._lastScannedISBN ? `https://covers.openlibrary.org/b/isbn/${this._lastScannedISBN}-M.jpg` : '',
        pages: 0,
        year: '',
        isbn: this._lastScannedISBN || null,
        scanMethod: 'ocr'
      };
      this._showScanResult();
    }
  },

  async decodeImage(imageSource) {
    await ScannerLoader.load();
    const testCanvas = document.createElement('canvas');
    testCanvas.width = imageSource.naturalWidth || imageSource.videoWidth || imageSource.width || 800;
    testCanvas.height = imageSource.naturalHeight || imageSource.videoHeight || imageSource.height || 600;
    const tctx = testCanvas.getContext('2d');
    if (!tctx) return null;
    tctx.drawImage(imageSource, 0, 0, testCanvas.width, testCanvas.height);

    // 1. Native detector
    if (typeof BarcodeDetector !== 'undefined') {
      try {
        const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] });
        const res = await detector.detect(testCanvas);
        if (res && res.length > 0) {
          const v = this._validateISBN(res[0].rawValue);
          if (v) return v;
        }
      } catch (e) {}
    }

    // 2. ZXing
    if (typeof ZXing !== 'undefined') {
      try {
        const hints = new Map();
        hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
        if (ZXing.BarcodeFormat) {
          hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
            ZXing.BarcodeFormat.EAN_13,
            ZXing.BarcodeFormat.EAN_8,
            ZXing.BarcodeFormat.UPC_A,
            ZXing.BarcodeFormat.UPC_E,
            ZXing.BarcodeFormat.CODE_128,
            ZXing.BarcodeFormat.CODE_39
          ]);
        }
        const reader = new ZXing.MultiFormatReader();
        reader.setHints(hints);

        // Pass A: Unrotated
        try {
          const lum = new ZXing.HTMLCanvasElementLuminanceSource(testCanvas);
          const bin = new ZXing.HybridBinarizer(lum);
          const bmp = new ZXing.BinaryBitmap(bin);
          const r = reader.decode(bmp);
          if (r && r.getText()) {
            const v = this._validateISBN(r.getText());
            if (v) return v;
          }
        } catch (e) {}

        // Pass B: Rotated 90 deg
        try {
          const rotCanvas = document.createElement('canvas');
          rotCanvas.width = testCanvas.height;
          rotCanvas.height = testCanvas.width;
          const rctx = rotCanvas.getContext('2d');
          rctx.translate(rotCanvas.width / 2, rotCanvas.height / 2);
          rctx.rotate(Math.PI / 2);
          rctx.drawImage(testCanvas, -testCanvas.width / 2, -testCanvas.height / 2);

          const lum = new ZXing.HTMLCanvasElementLuminanceSource(rotCanvas);
          const bin = new ZXing.HybridBinarizer(lum);
          const bmp = new ZXing.BinaryBitmap(bin);
          const r = reader.decode(bmp);
          if (r && r.getText()) {
            const v = this._validateISBN(r.getText());
            if (v) return v;
          }
        } catch (e) {}
      } catch (ze) {}
    }
    return null;
  },

  async handleFileInput(inputEl) {
    if (!inputEl || !inputEl.files || !inputEl.files[0]) return;
    const file = inputEl.files[0];
    const statusEl = document.getElementById('scanStatus');
    if (statusEl) statusEl.textContent = '📸 Processing uploaded photo...';
    this._showSpinner();

    try {
      const img = new Image();
      img.onload = async () => {
        const isbn = await this.decodeImage(img);
        if (isbn) {
          this._onBarcodeDetected(isbn);
        } else {
          this._hideSpinner();
          this._showScanFailure('Could not find a barcode in that photo. Ensure good lighting or read the cover text instead.', true);
        }
      };
      img.onerror = () => {
        this._hideSpinner();
        this._showScanFailure('Could not load image file.', false);
      };
      img.src = URL.createObjectURL(file);
    } catch (e) {
      this._hideSpinner();
      this._showScanFailure('Error processing photo: ' + (e.message || ''), false);
    }
    inputEl.value = '';
  },

  stop() {
    this._ocrActive = false;
    this._stopScannerEngines();
    clearTimeout(this._ocrTimeout);
    this._cancelAutoAccept();
    this._stopStream();
    this._setScanning(false);
    this._clearErrorFlash();
    this._hideSpinner();
    this._hideManualNudge();
    this._failCount = 0;
    this._lowConfResult = null;

    ['scanRetryBtn', 'scanUseAnywayBtn', 'scanOcrBtn'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });

    const area = document.getElementById('cameraScanArea');
    if (area) area.style.display = 'none';

    const sr = document.getElementById('scanResult');
    if (sr) {
      sr.style.display = 'none';
      sr.classList.remove('scan-success-flash');
    }
  },

  _stopStream() {
    if (this._stream) {
      this._stream.getTracks().forEach(t => t.stop());
      this._stream = null;
    }
    this._videoTrack = null;
  },

  getResult() {
    return this._scanResult;
  }
};

// ==========================================
// 5. WikidataAPI & Demographics Engine
// ==========================================
export const WikidataAPI = {
  _cache: {},
  _lsKey: 'shelf_life_wikidata_cache_v2',

  init() {
    try {
      const stored = localStorage.getItem(this._lsKey);
      if (stored) this._cache = JSON.parse(stored);
    } catch (e) { this._cache = {}; }
  },

  _saveCache() {
    try { localStorage.setItem(this._lsKey, JSON.stringify(this._cache)); } catch (e) { console.warn(e); }
  },

  countryFlag(cc) {
    if (!cc || cc.length !== 2) return '🌐';
    const base = 0x1F1E6;
    return String.fromCodePoint(base + cc.charCodeAt(0) - 65, base + cc.charCodeAt(1) - 65);
  },

  _codeToRegion: {
    'US': 'USA',
    'CA': 'Canada',
    'GB': 'UK',
    'FR': 'Europe', 'DE': 'Europe', 'ES': 'Europe', 'IT': 'Europe', 'NL': 'Europe',
    'BE': 'Europe', 'AT': 'Europe', 'CH': 'Europe', 'SE': 'Europe', 'NO': 'Europe',
    'DK': 'Europe', 'FI': 'Europe', 'PT': 'Europe', 'IE': 'Europe', 'PL': 'Europe',
    'CZ': 'Europe', 'HU': 'Europe', 'RO': 'Europe', 'BG': 'Europe', 'GR': 'Europe',
    'HR': 'Europe', 'SK': 'Europe', 'SI': 'Europe', 'EE': 'Europe', 'LV': 'Europe',
    'LT': 'Europe', 'IS': 'Europe', 'LU': 'Europe', 'MT': 'Europe', 'CY': 'Europe',
    'RS': 'Europe', 'BA': 'Europe', 'ME': 'Europe', 'MK': 'Europe', 'AL': 'Europe',
    'UA': 'Europe', 'BY': 'Europe', 'MD': 'Europe', 'RU': 'Europe', 'GE': 'Europe',
    'AM': 'Europe', 'AZ': 'Europe', 'TR': 'Europe', 'XK': 'Europe', 'AD': 'Europe',
    'MC': 'Europe', 'SM': 'Europe', 'VA': 'Europe', 'LI': 'Europe', 'FO': 'Europe',
    'GI': 'Europe', 'IM': 'Europe', 'JE': 'Europe', 'GG': 'Europe'
  },

  countryToRegion(input) {
    if (!input) return 'Other';
    const s = input.trim();
    if (s.length === 2) {
      return this._codeToRegion[s.toUpperCase()] || 'Other';
    }
    const code = this.countryToCode(s);
    if (code) return this._codeToRegion[code] || 'Other';
    const cl = s.toLowerCase();
    if (cl.includes('united states') || cl === 'usa' || cl === 'u.s.a.' || cl === 'america') return 'USA';
    if (cl.includes('canada')) return 'Canada';
    if (['united kingdom', 'england', 'scotland', 'wales', 'northern ireland', 'great britain', 'britain'].some(k => cl.includes(k))) return 'UK';

    const EU_KW = ['france', 'germany', 'german', 'spain', 'spanish', 'italy', 'italian', 'netherlands', 'dutch', 'belgium', 'austria', 'switzerland', 'sweden', 'norway', 'denmark', 'finland', 'portugal', 'ireland', 'irish', 'poland', 'czech', 'hungary', 'romania', 'bulgaria', 'greece', 'croatia', 'slovakia', 'slovenia', 'estonia', 'latvia', 'lithuania', 'iceland', 'luxembourg', 'malta', 'cyprus', 'serbia', 'bosnia', 'montenegro', 'macedonia', 'albania', 'ukraine', 'belarus', 'moldova', 'russia', 'georgia', 'armenia', 'azerbaijan', 'turkey', 'andorra', 'monaco', 'san marino', 'liechtenstein'];
    if (EU_KW.some(k => cl.includes(k))) return 'Europe';
    return 'Other';
  },

  countryToCode(countryLabel) {
    const MAP = {
      'united states of america': 'US', 'united states': 'US', 'usa': 'US', 'u.s.a.': 'US', 'america': 'US',
      'canada': 'CA', 'mexico': 'MX',
      'united kingdom': 'GB', 'england': 'GB', 'scotland': 'GB', 'wales': 'GB', 'northern ireland': 'GB',
      'great britain': 'GB', 'kingdom of great britain': 'GB',
      'france': 'FR', 'french republic': 'FR', 'germany': 'DE', 'federal republic of germany': 'DE',
      'spain': 'ES', 'kingdom of spain': 'ES', 'italy': 'IT', 'italian republic': 'IT',
      'netherlands': 'NL', 'kingdom of the netherlands': 'NL', 'the netherlands': 'NL',
      'belgium': 'BE', 'austria': 'AT', 'switzerland': 'CH', 'sweden': 'SE', 'norway': 'NO',
      'denmark': 'DK', 'finland': 'FI', 'portugal': 'PT',
      'ireland': 'IE', 'republic of ireland': 'IE',
      'poland': 'PL', 'czech republic': 'CZ', 'czechia': 'CZ',
      'hungary': 'HU', 'romania': 'RO', 'bulgaria': 'BG', 'greece': 'GR', 'hellenic republic': 'GR',
      'croatia': 'HR', 'slovakia': 'SK', 'slovenia': 'SI', 'estonia': 'EE', 'latvia': 'LV', 'lithuania': 'LT',
      'iceland': 'IS', 'luxembourg': 'LU', 'malta': 'MT', 'cyprus': 'CY',
      'serbia': 'RS', 'bosnia and herzegovina': 'BA', 'bosnia': 'BA',
      'montenegro': 'ME', 'north macedonia': 'MK', 'republic of north macedonia': 'MK', 'macedonia': 'MK',
      'albania': 'AL', 'ukraine': 'UA', 'belarus': 'BY', 'moldova': 'MD', 'republic of moldova': 'MD',
      'russia': 'RU', 'russian federation': 'RU', 'soviet union': 'RU',
      'georgia': 'GE', 'armenia': 'AM', 'azerbaijan': 'AZ', 'turkey': 'TR', 'republic of turkey': 'TR',
      'kosovo': 'XK', 'andorra': 'AD', 'monaco': 'MC', 'san marino': 'SM', 'vatican city': 'VA',
      'liechtenstein': 'LI', 'faroe islands': 'FO', 'gibraltar': 'GI',
      'japan': 'JP', 'china': 'CN', "people's republic of china": 'CN', 'south korea': 'KR',
      'republic of korea': 'KR', 'north korea': 'KP', 'india': 'IN', 'republic of india': 'IN',
      'philippines': 'PH', 'vietnam': 'VN', 'thailand': 'TH', 'singapore': 'SG', 'taiwan': 'TW',
      'republic of china': 'TW', 'indonesia': 'ID', 'malaysia': 'MY', 'myanmar': 'MM', 'cambodia': 'KH',
      'laos': 'LA', 'mongolia': 'MN', 'nepal': 'NP', 'sri lanka': 'LK', 'bangladesh': 'BD', 'pakistan': 'PK',
      'afghanistan': 'AF', 'uzbekistan': 'UZ', 'kazakhstan': 'KZ', 'kyrgyzstan': 'KG', 'tajikistan': 'TJ',
      'turkmenistan': 'TM', 'hong kong': 'HK', 'macau': 'MO',
      'israel': 'IL', 'iran': 'IR', 'islamic republic of iran': 'IR', 'iraq': 'IQ', 'saudi arabia': 'SA',
      'united arab emirates': 'AE', 'qatar': 'QA', 'kuwait': 'KW', 'bahrain': 'BH', 'oman': 'OM',
      'yemen': 'YE', 'jordan': 'JO', 'lebanon': 'LB', 'syria': 'SY', 'palestine': 'PS',
      'south africa': 'ZA', 'nigeria': 'NG', 'kenya': 'KE', 'egypt': 'EG', 'arab republic of egypt': 'EG',
      'ethiopia': 'ET', 'ghana': 'GH', 'tanzania': 'TZ', 'uganda': 'UG', 'rwanda': 'RW', 'senegal': 'SN',
      'morocco': 'MA', 'tunisia': 'TN', 'algeria': 'DZ', 'libya': 'LY', 'sudan': 'SD', 'zimbabwe': 'ZW',
      'mozambique': 'MZ', 'cameroon': 'CM', 'ivory coast': 'CI', "côte d'ivoire": 'CI',
      'democratic republic of the congo': 'CD', 'republic of the congo': 'CG', 'congo': 'CG',
      'mali': 'ML', 'burkina faso': 'BF', 'niger': 'NE', 'madagascar': 'MG', 'angola': 'AO',
      'botswana': 'BW', 'namibia': 'NA', 'zambia': 'ZM', 'malawi': 'MW', 'mauritius': 'MU',
      'somalia': 'SO', 'eritrea': 'ER',
      'australia': 'AU', 'new zealand': 'NZ', 'fiji': 'FJ', 'papua new guinea': 'PG',
      'brazil': 'BR', 'argentina': 'AR', 'colombia': 'CO', 'chile': 'CL', 'peru': 'PE',
      'venezuela': 'VE', 'ecuador': 'EC', 'bolivia': 'BO', 'paraguay': 'PY', 'uruguay': 'UY',
      'guyana': 'GY', 'suriname': 'SR',
      'cuba': 'CU', 'jamaica': 'JM', 'haiti': 'HT', 'dominican republic': 'DO',
      'puerto rico': 'PR', 'trinidad and tobago': 'TT', 'barbados': 'BB', 'bahamas': 'BS',
      'guatemala': 'GT', 'honduras': 'HN', 'el salvador': 'SV', 'nicaragua': 'NI',
      'costa rica': 'CR', 'panama': 'PA', 'belize': 'BZ'
    };
    const cl = (countryLabel || '').toLowerCase().trim();
    return MAP[cl] || null;
  },

  _genderMap: {
    'Q6581097': 'Male', 'Q6581072': 'Female', 'Q1097630': 'Non-binary',
    'Q1052281': 'Non-binary', 'Q48270': 'Non-binary'
  },

  _writerOccupations: new Set([
    'Q36180', 'Q482980', 'Q6625963', 'Q49757', 'Q4853732', 'Q11774202',
    'Q333634', 'Q1930187', 'Q214917', 'Q28389', 'Q1607826', 'Q4263842',
    'Q15949613', 'Q37226', 'Q121594', 'Q1281618', 'Q18844224', 'Q12144794',
    'Q4610556', 'Q571'
  ]),

  _scoreCandidate(searchResult, claims) {
    let score = 0;
    const desc = (searchResult.description || '').toLowerCase();
    const strongKW = ['writer', 'author', 'novelist', 'poet', 'playwright', 'essayist', 'screenwriter', 'journalist', 'biographer'];
    const weakKW = ['professor', 'academic', 'scholar', 'editor', 'translator', 'critic', 'intellectual'];

    if (strongKW.some(k => desc.includes(k))) score += 3;
    else if (weakKW.some(k => desc.includes(k))) score += 1;

    if (claims.P106) {
      for (const occ of claims.P106) {
        const occId = occ.mainsnak?.datavalue?.value?.id;
        if (occId && this._writerOccupations.has(occId)) { score += 5; break; }
      }
    }

    if (claims.P21) score += 1;
    if (claims.P27) score += 1;
    if (claims.P569) score += 2;

    if (claims.P31) {
      const instanceIds = claims.P31.map(c => c.mainsnak?.datavalue?.value?.id).filter(Boolean);
      const humanIds = new Set(['Q5', 'Q15632617']);
      if (instanceIds.some(id => humanIds.has(id))) score += 2;
      else if (instanceIds.length && !instanceIds.some(id => humanIds.has(id))) score -= 5;
    }

    return score;
  },

  async detectAuthorDemographics(authorName) {
    if (!authorName || authorName.length < 2) return { gender: 'Unknown', country: null, region: 'Other', source: 'unknown' };
    const cacheKey = authorName.toLowerCase().trim();
    if (this._cache[cacheKey]) return this._cache[cacheKey];

    try {
      let searchData = null;
      const variants = [
        authorName,
        authorName.replace(/^Dr\.?\s+/i, '').replace(/\b[A-Z]\.\s*/g, '').trim(),
        authorName.split(' ').filter(p => !p.includes('.')).join(' ').trim()
      ];

      for (const variant of variants) {
        if (!variant || variant.length < 2) continue;
        const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(variant)}&language=en&format=json&origin=*&limit=5&type=item`;
        const searchResp = await fetch(searchUrl);
        if (!searchResp.ok) continue;
        const data = await searchResp.json();
        if (data.search && data.search.length) {
          searchData = data;
          break;
        }
      }

      if (!searchData || !searchData.search || !searchData.search.length) {
        const guessed = guessGenderFromName(authorName);
        const result = { gender: guessed || 'Unknown', country: 'Unknown', region: 'Elsewhere', countryCode: null, flag: '🌍', source: guessed ? 'name-db' : 'default' };
        this._cache[cacheKey] = result;
        this._saveCache();
        return result;
      }

      const candidateIds = searchData.search.map(s => s.id).join('|');
      const batchUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${candidateIds}&props=claims&format=json&origin=*`;
      const batchResp = await fetch(batchUrl);
      if (!batchResp.ok) throw new Error('Batch entity fetch failed');
      const batchData = await batchResp.json();

      let bestId = searchData.search[0].id;
      let bestScore = -999;
      let bestClaims = {};

      for (const s of searchData.search) {
        const claims = batchData.entities?.[s.id]?.claims || {};
        const score = this._scoreCandidate(s, claims);
        if (score > bestScore) {
          bestScore = score;
          bestId = s.id;
          bestClaims = claims;
        }
      }

      const claims = bestClaims;
      let gender = 'Unknown';
      if (claims.P21 && claims.P21[0]) {
        const genderId = claims.P21[0].mainsnak?.datavalue?.value?.id;
        gender = this._genderMap[genderId] || 'Unknown';
      }

      if (gender === 'Unknown') {
        const guessed = guessGenderFromName(authorName);
        if (guessed) gender = guessed;
      }

      let country = null;
      let region = null;
      let countryCode = null;
      let countryId = null;

      if (claims.P27 && claims.P27.length) {
        countryId = claims.P27[claims.P27.length - 1].mainsnak?.datavalue?.value?.id;
      } else if (claims.P19 && claims.P19.length) {
        countryId = claims.P19[0].mainsnak?.datavalue?.value?.id;
      } else if (claims.P20 && claims.P20.length) {
        countryId = claims.P20[0].mainsnak?.datavalue?.value?.id;
      }

      if (countryId) {
        const countryUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${countryId}&props=labels&languages=en&format=json&origin=*`;
        const countryResp = await fetch(countryUrl);
        if (countryResp.ok) {
          const countryData = await countryResp.json();
          country = countryData.entities?.[countryId]?.labels?.en?.value || null;
          if (country) {
            region = this.countryToRegion(country);
            countryCode = this.countryToCode(country);
          }
        }
      }

      const result = { gender, country: country || 'Unknown', region: region || 'Elsewhere', countryCode: countryCode || null, flag: countryCode ? this.countryFlag(countryCode) : '🌍', source: countryCode ? 'wikidata' : 'default' };
      this._cache[cacheKey] = result;
      this._saveCache();
      return result;
    } catch (err) {
      console.warn('[WikidataAPI] Detection error for', authorName, ':', err);
      return { gender: 'Unknown', country: 'Unknown', region: 'Elsewhere', countryCode: null, flag: '🌍', source: 'default' };
    }
  },

  async analyzeBooks(books, updateFn, progressFn) {
    if (!books || !books.length) return books;
    const needAnalysis = books.filter(b => {
      const g = String(b.authorGender || '').toLowerCase();
      const c = String(b.authorCountry || '').toLowerCase();
      return !g || g === 'unknown' || !c || c === 'unknown' || c === 'other' || c === 'elsewhere';
    });
    if (!needAnalysis.length) return books;

    const uniqueAuthors = [...new Set(needAnalysis.map(b => b.author).filter(Boolean))];
    let done = 0;

    for (const author of uniqueAuthors) {
      const result = await this.detectAuthorDemographics(author);
      const matchingBooks = needAnalysis.filter(b => b.author === author);
      const updates = {};

      if (result.gender && result.gender !== 'Unknown') {
        updates.author_gender_v2 = result.gender;
        updates.author_gender = result.gender.toLowerCase();
      }

      if (result.country) {
        updates.author_country = result.country;
        updates.author_region_v2 = result.region;
        updates.author_region = result.countryCode ? `${result.countryCode}|${result.region}|${result.flag}` : null;
      }

      if (result.source !== 'unknown') {
        updates.demographics_source = result.source;
      }

      for (const b of matchingBooks) {
        b.authorGender = result.gender || b.authorGender;
        b.authorCountry = result.country || b.authorCountry;
        b.authorRegion = updates.author_region || b.authorRegion;
        b.authorRegionV2 = result.region || b.authorRegionV2;
        b.demographicsSource = result.source;

        if (updateFn && Object.keys(updates).length && b.id) {
          await updateFn(b.id, updates);
        }
      }

      done++;
      if (progressFn) progressFn(done, uniqueAuthors.length);
      if (done < uniqueAuthors.length) await new Promise(r => setTimeout(r, 300));
    }
    return books;
  },

  parseFromDB(dbVal) {
    if (!dbVal) return null;
    const parts = dbVal.split('|');
    if (parts.length >= 3) return { countryCode: parts[0], region: parts[1], flag: parts[2] };
    if (parts[0].length === 2) {
      const cc = parts[0].toUpperCase();
      const region = this.countryToRegion(cc);
      return { countryCode: cc, region, flag: this.countryFlag(cc) };
    }
    const cc = this.countryToCode(parts[0]);
    if (cc) {
      const region = this.countryToRegion(cc);
      return { countryCode: cc, region, flag: this.countryFlag(cc) };
    }
    return null;
  },

  formatForDB(countryCode) {
    if (!countryCode) return null;
    const cc = countryCode.toUpperCase();
    const region = this.countryToRegion(cc);
    const flag = this.countryFlag(cc);
    return `${cc}|${region}|${flag}`;
  },

  parseFirstName(authorStr) {
    if (!authorStr) return null;
    const cleaned = authorStr.trim();
    if (cleaned.includes(',')) {
      const parts = cleaned.split(',').map(s => s.trim());
      if (parts[1]) return parts[1].split(/\s+/)[0];
    }
    const parts = cleaned.split(/\s+/);
    if (parts.length >= 1) return parts[0];
    return null;
  },

  _regionToBucket(region) {
    if (!region) return null;
    const r = String(region).trim();
    if (!r) return null;
    const u = r.toUpperCase();
    if (u === 'USA' || u === 'US' || u === 'U.S.A.' || u === 'AMERICA' || u === 'UNITED STATES') return 'USA';
    if (u === 'CANADA' || u === 'CA') return 'Canada';
    if (u === 'UK' || u === 'EUROPE' || u === 'EU' || u === 'GB') return 'Europe';
    if (u === 'OTHER' || u === 'ELSEWHERE') return 'Elsewhere';
    return null;
  },

  _regionFlag(region) {
    return { USA: '🇺🇸', Canada: '🇨🇦', Europe: '🇪🇺', Elsewhere: '🌍' }[region] || '🌍';
  },

  _resolveOrigin(book) {
    if (book && typeof book === 'object') {
      if (!this._originCache) this._originCache = new WeakMap();
      const cached = this._originCache.get(book);
      if (cached) return cached;
    }

    let countryCode = null, region = null, explicitFlag = null;

    if (book && book.authorCountry) {
      countryCode = this.countryToCode(book.authorCountry) || countryCode;
      region = region || this._regionToBucket(this.countryToRegion(book.authorCountry));
    }

    const consume = (val) => {
      if (!val) return;
      if (String(val).includes('|')) {
        const p = this.parseFromDB(val);
        if (p) {
          countryCode = countryCode || p.countryCode || null;
          region = region || this._regionToBucket(p.region) || this._regionToBucket(this.countryToRegion(p.countryCode));
          explicitFlag = explicitFlag || p.flag || null;
        }
      } else {
        region = region || this._regionToBucket(val) || this._regionToBucket(this.countryToRegion(val));
        countryCode = countryCode || this.countryToCode(val) || null;
      }
    };

    consume(book && book.authorRegionV2);
    consume(book && book.authorRegion);

    if (!region && countryCode) region = this._regionToBucket(this.countryToRegion(countryCode));
    if (!region) region = 'Elsewhere';

    let flag;
    if (countryCode) {
      const ccBucket = this._regionToBucket(this.countryToRegion(countryCode));
      const isMainBucket = (region === 'USA' || region === 'Canada' || region === 'Europe');
      flag = (ccBucket === region || !isMainBucket) ? this.countryFlag(countryCode) : this._regionFlag(region);
    } else if (explicitFlag && region !== 'USA') {
      flag = explicitFlag;
    } else {
      flag = this._regionFlag(region);
    }

    const result = { region, flag, countryCode };
    if (book && typeof book === 'object' && this._originCache) {
      this._originCache.set(book, result);
    }
    return result;
  },

  getBookRegion(book) {
    return this._resolveOrigin(book).region;
  },

  getBookFlag(book) {
    return this._resolveOrigin(book).flag;
  }
};

WikidataAPI.init();

// ==========================================
// 6. GenderAPI & guessGenderFromName
// ==========================================
export const GenderAPI = {
  parseFirstName: (s) => WikidataAPI.parseFirstName(s)
};

export function guessGenderFromName(authorName) {
  const first = WikidataAPI.parseFirstName(authorName);
  if (!first) return null;
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');
  let key = norm(first);
  if (key.length < 2) return null;
  if (NAME_GENDER_DB[key]) return NAME_GENDER_DB[key];

  const hyphenLead = norm((first.split(/[--]/)[0] || ''));
  if (hyphenLead.length >= 2 && NAME_GENDER_DB[hyphenLead]) return NAME_GENDER_DB[hyphenLead];

  for (const suf of ['ie', 'y']) {
    if (key.endsWith(suf)) {
      const stem = key.slice(0, -suf.length);
      if (NAME_GENDER_DB[stem]) return NAME_GENDER_DB[stem];
    }
  }
  return null;
}

// ==========================================
// 7. NationalizeAPI
// ==========================================
export const NationalizeAPI = {
  parseFromDB: (v) => WikidataAPI.parseFromDB(v),
  formatForDB: (v) => WikidataAPI.formatForDB(v),
  countryFlag: (cc) => WikidataAPI.countryFlag(cc),
  countryToRegion: (cc) => WikidataAPI.countryToRegion(cc),
  _countryNames: {},
  detectCountry: async (firstName) => {
    const result = await WikidataAPI.detectAuthorDemographics(firstName);
    return { countryCode: result.countryCode, confidence: result.source === 'wikidata' ? 0.85 : 0 };
  },
  async analyzeBooks(books, updateFn) {
    return WikidataAPI.analyzeBooks(books, updateFn);
  }
};

export async function getNationalitiesForAuthor(authorName) {
  if (!authorName) return [];
  try {
    const demo = await WikidataAPI.detectAuthorDemographics(authorName);
    if (demo && demo.countryCode) {
      return [{ countryCode: demo.countryCode, countryName: demo.countryName, flag: demo.flag, region: demo.region }];
    }
  } catch(e) {
    console.warn('getNationalitiesForAuthor error:', e);
  }
  return [];
}

// ==========================================
// 8. WordCountAPI
// ==========================================
export const WordCountAPI = {
  _cache: null,

  _loadCache() {
    if (this._cache) return;
    try {
      this._cache = JSON.parse(localStorage.getItem('sl_wc_cache') || '{}');
    } catch { this._cache = {}; }
  },

  _saveCache() {
    try { localStorage.setItem('sl_wc_cache', JSON.stringify(this._cache)); } catch {}
  },

  _cacheKey(title, author) {
    return (title + '||' + author).toLowerCase().trim();
  },

  async lookup(title, author, genre) {
    this._loadCache();
    const override = lookupWordCountOverride(title);
    if (override) {
      return {
        pages: override.pageCount || 0,
        wordCount: override.words,
        words: override.words,
        pubYear: null,
        source: 'provided'
      };
    }

    const key = this._cacheKey(title, author);
    if (this._cache[key]) {
      const cached = this._cache[key];
      if (cached && !cached.words && cached.wordCount) cached.words = cached.wordCount;
      return cached;
    }

    let result = await this._tryOpenLibrary(title, author, genre);
    if (!result) {
      result = await this._tryGoogleBooks(title, author, genre);
    }

    if (result) {
      this._cache[key] = result;
      this._saveCache();
    } else {
      this._cache[key] = { pages: 0, wordCount: 0, words: 0, source: 'unknown' };
      this._saveCache();
    }
    return this._cache[key];
  },

  _wppForGenre(genre) {
    if (!genre) return 275;
    const g = String(genre).toLowerCase();
    if (g.includes('fantasy') || g.includes('sci-fi') || g.includes('science fiction') || g.includes('epic')) return 300;
    if (g.includes('non-fiction') || g.includes('biography') || g.includes('history') || g.includes('business')) return 260;
    if (g.includes('poetry') || g.includes('children')) return 200;
    return 275;
  },

  async _tryOpenLibrary(title, author, genre) {
    try {
      const q = `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}&limit=5&fields=title,author_name,number_of_pages_median,first_publish_year,edition_count`;
      const resp = await fetch(q);
      if (!resp.ok) return null;
      const data = await resp.json();
      if (!data.docs || !data.docs.length) return null;
      const withPages = data.docs.filter(d => d.number_of_pages_median && d.number_of_pages_median > 10);
      const best = withPages.length ? withPages[0] : null;
      if (!best) return null;
      const pages = best.number_of_pages_median;
      const multiplier = this._wppForGenre(genre);
      const wordCount = Math.round(pages * multiplier);
      const pubYear = best.first_publish_year || null;
      return { pages, wordCount, words: wordCount, pubYear, source: 'openlibrary' };
    } catch (err) {
      console.warn('[WordCount] Open Library error:', err.message);
      return null;
    }
  },

  async _tryGoogleBooks(title, author, genre) {
    try {
      const q = `https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(title)}+inauthor:${encodeURIComponent(author)}&maxResults=3` + (typeof localStorage !== 'undefined' && localStorage.getItem('sl_gb_key') ? '&key=' + localStorage.getItem('sl_gb_key') : '');
      const resp = await fetch(q);
      if (!resp.ok) return null;
      const data = await resp.json();
      if (!data.items || !data.items.length) return null;
      for (const item of data.items) {
        const vi = item.volumeInfo;
        if (vi && vi.pageCount && vi.pageCount > 10) {
          const pages = vi.pageCount;
          const multiplier = this._wppForGenre(genre || (vi.categories && vi.categories[0]));
          const wordCount = Math.round(pages * multiplier);
          const pubYear = vi.publishedDate ? parseInt(vi.publishedDate.substring(0,4)) : null;
          return { pages, wordCount, words: wordCount, pubYear, source: 'googlebooks' };
        }
      }
      return null;
    } catch (err) {
      console.warn('[WordCount] Google Books error:', err.message);
      return null;
    }
  },

  getSource(book) {
    if (!book) return 'unknown';
    if (book.words === 26000 || book.words === 25800) return 'unknown';
    if (book.wordCountSource) return book.wordCountSource;
    if (book.words && book.words !== 80000 && book.words !== 10000) return 'provided';
    return 'unknown';
  },

  validate(wordCount, pageCount) {
    const warnings = [];
    if (wordCount > 250000) warnings.push('Very high word count (>250k) - may be an epic or error');
    if (wordCount > 0 && wordCount < 5000) warnings.push('Very low word count (<5k) - may be a short story or error');
    if (pageCount && pageCount > 0 && wordCount > 0) {
      const expected = pageCount * 300;
      const tolerance = expected * 0.20;
      if (Math.abs(wordCount - expected) > tolerance) {
        warnings.push(`Word count (${wordCount.toLocaleString()}) differs >20% from the expected estimate (${expected.toLocaleString()}) - please double-check`);
      }
    }
    return warnings;
  },

  async resolveBooks(books, updateFn) {
    const toResolve = books.filter(b => {
      const wc = b.words || 0;
      return wc === 0 || wc === 10000 || wc === 80000;
    });

    if (!toResolve.length) {
      return { resolved: 0, failed: 0 };
    }

    let resolved = 0, failed = 0;
    const CONCURRENCY = 3;

    const processBook = async (book) => {
      if (book.pageCount && book.pageCount > 10) {
        const wc = Math.round(book.pageCount * 300);
        book.words = wc;
        book.wordCountSource = 'calculated';
        book.wordCountEstimated = true;
        if (updateFn) await updateFn(book.id || book._dbId, { word_count: wc, word_count_source: 'calculated', word_count_estimated: true });
        resolved++;
        return;
      }

      const result = await this.lookup(book.title, book.author);
      if (result && result.wordCount > 0) {
        book.words = result.wordCount;
        book.pageCount = result.pages || book.pageCount;
        book.wordCountSource = result.source;
        book.wordCountEstimated = true;
        if (updateFn) {
          await updateFn(book.id || book._dbId, {
            word_count: result.wordCount,
            page_count: result.pages || book.pageCount,
            word_count_source: result.source,
            word_count_estimated: true
          });
        }
        resolved++;
      } else {
        book.wordCountSource = 'unknown';
        if (updateFn) await updateFn(book.id || book._dbId, { word_count_source: 'unknown' });
        failed++;
      }
    };

    for (let i = 0; i < toResolve.length; i += CONCURRENCY) {
      const batch = toResolve.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(processBook));
    }
    return { resolved, failed };
  },

  clearCache() {
    this._cache = {};
    localStorage.removeItem('sl_wc_cache');
  }
};

if (typeof window !== 'undefined') {
  window.WordCountAPI = WordCountAPI;
}

// ==========================================
// 9. Search & Manual Entry UI Controllers
// ==========================================

export async function _queryProxySearch(q) {
  try {
    const res = await fetch('https://guqkidwlkslhkoictfay.supabase.co/functions/v1/search-books', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : '') },
      body: JSON.stringify({ query: (q || '').trim() })
    });

    const data = await res.json();
    if (!res.ok) {
      console.warn('Edge function returned error:', data.error || res.statusText);
      const el = document.getElementById('searchResults') || document.getElementById('adminCandidateSearchResults') || document.getElementById('clubPickSearchResults');
      if (el) {
        el.innerHTML = '<div style="padding:12px;color:var(--burgundy);font-size:11px;">Search failed: ' + (data.error || 'Server Error') + '</div>';
      }
      return [];
    }

    if (Array.isArray(data) && data.length === 0) {
      const isUrl = /^https?:\/\//i.test((q || '').trim());
      if (isUrl) {
        const el = document.getElementById('searchResults');
        if (el) el.innerHTML = '<div style="padding:12px;color:var(--burgundy);font-size:11px;">Could not extract book data from this URL. Please try a different URL or search by title.</div>';
        return null;
      }
    }
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn('Proxy search failed', err);
    return [];
  }
}

export function debounceSearch(q) {
  clearTimeout(this.searchTimeout);
  if (!q || typeof q !== 'string' || q.length < 3) {
    const res = document.getElementById('searchResults');
    if (res) res.style.display = 'none';
    return;
  }
  this.searchTimeout = setTimeout(() => this.searchBooks(q), 800);
}

export function cleanEditionTitle(rawTitle, author = '') {
  if (!rawTitle) return '';
  let t = rawTitle.trim();

  // Strip author prefix if present (e.g. "F. Scott Fitzgerald: The Great Gatsby")
  if (author) {
    const escaped = author.split(/\s+/).map(p => p.replace(/[^a-zA-Z]/g, '')).filter(Boolean).join('[^a-zA-Z0-9]*');
    if (escaped) {
      const authorPrefixRegex = new RegExp('^' + escaped + '(?:\'s)?[\\s:\\-]+', 'i');
      t = t.replace(authorPrefixRegex, '');
    }
  }

  // Strip publisher/imprint prefixes (e.g. "Modern Classics Great Gatsby" -> "Great Gatsby")
  t = t.replace(/^(?:Modern\s+Classics|Penguin\s+Classics|Oxford\s+World'?s\s+Classics|Signet\s+Classics|Vintage\s+Classics)\s+/i, '');

  // Strip bracketed or parenthesized edition annotations
  t = t.replace(/\s*[\(\[](?:[^\)\]]*(?:edition|deluxe|illustrated|anniversary|movie|tie-in|reprint|special|collector|paperback|hardcover|mass\s*market|series|volume|vol\.?|book\s*\d+)[^\)\]]*)[\)\]]/gi, '');

  // Strip colon subtitles that describe the edition rather than the story title
  t = t.replace(/:\s*(?:a\s+[^:]*classic\s+novel|minalima\s+edition|illustrated\s+edition|deluxe\s+edition|anniversary\s+edition|special\s+edition|collector'?s\s+edition|the\s+graphic\s+novel|movie\s+tie-in|expanded\s+edition|revised\s+edition).*$/i, '');

  // Strip trailing "Edition" or "A Novel"
  t = t.replace(/\s*[-–—:]\s*(?:a\s+novel|a\s+memoir|stories)$/i, '');

  return t.trim() || rawTitle.trim();
}

export function normalizeTitleKey(t) {
  return t.toLowerCase().replace(/^(?:the|a|an)\s+/i, '').replace(/[^a-z0-9]/g, '');
}

export function normalizeAuthorKey(a) {
  const clean = (a || '').replace(/['’]s\b/gi, '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const tokens = clean.split(' ').filter(w => w.length > 0);
  if (tokens.length === 0) return 'unknown';
  const lastName = tokens[tokens.length - 1];
  const firstInitial = tokens[0][0];
  return `${firstInitial}_${lastName}`;
}

export function groupSearchResultsIntoWorks(items) {
  if (!items || !items.length) return [];
  const groups = new Map();

  for (const item of items) {
    const vi = item.volumeInfo || {};
    const rawTitle = vi.title || '';
    const author = (vi.authors && vi.authors[0]) || 'Unknown';
    const parsed = parseSeriesFromTitle(rawTitle);
    const cleanTitle = cleanEditionTitle(parsed.title || rawTitle, author);

    const titleKey = normalizeTitleKey(cleanTitle);
    const authorKey = normalizeAuthorKey(author);
    const groupKey = `${titleKey}___${authorKey}`;

    const yearNum = vi.publishedDate ? (parseInt(String(vi.publishedDate).substring(0, 4), 10) || null) : null;
    const coverUrl = vi.imageLinks?.thumbnail ? vi.imageLinks.thumbnail.replace('http:', 'https:') : '';
    const pages = vi.pageCount || 0;
    const sName = item.seriesName || (vi.series_name ? (Array.isArray(vi.series_name) ? vi.series_name[0] : vi.series_name) : parsed.seriesName) || null;
    const sNum = item.seriesNumber != null ? item.seriesNumber : (vi.series_position ? (Array.isArray(vi.series_position) ? parseFloat(vi.series_position[0]) : parseFloat(vi.series_position)) : parsed.seriesNumber) || null;
    const genre = guessGenre(vi.categories || []);

    const editionData = {
      year: yearNum,
      pages: pages,
      coverUrl: coverUrl,
      isbn: item.isbn || null,
      rawTitle: rawTitle
    };

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        title: cleanTitle,
        rawTitle: rawTitle,
        author: author,
        coverUrl: coverUrl,
        pages: pages,
        genre: genre,
        fiction: genre !== 'Non-Fiction',
        categories: vi.categories || [],
        seriesName: sName,
        seriesNumber: sNum,
        isbn: item.isbn || null,
        editions: [editionData]
      });
    } else {
      const g = groups.get(groupKey);
      if (!g.coverUrl && coverUrl) g.coverUrl = coverUrl;
      if (!g.pages && pages) g.pages = pages;
      if (!g.seriesName && sName) {
        g.seriesName = sName;
        g.seriesNumber = sNum;
      }
      if (cleanTitle.length < g.title.length && cleanTitle.length >= 3) {
        g.title = cleanTitle;
      }
      g.editions.push(editionData);
    }
  }

  const results = [];
  for (const g of groups.values()) {
    const seenYears = new Map();
    for (const ed of g.editions) {
      if (ed.year) {
        if (!seenYears.has(ed.year) || (!seenYears.get(ed.year).coverUrl && ed.coverUrl)) {
          seenYears.set(ed.year, ed);
        }
      }
    }

    const uniqueEditions = Array.from(seenYears.values()).sort((a, b) => (a.year || 0) - (b.year || 0));
    g.editions = uniqueEditions;
    g.originalYear = uniqueEditions.length > 0 ? uniqueEditions[0].year : null;
    g.year = g.originalYear || '';

    // Prefer title that retains leading article "The" if available among members
    const titleWithArticle = g.editions.map(e => e.rawTitle).find(t => /^The\s+/i.test(t));
    if (titleWithArticle && !/^The\s+/i.test(g.title)) {
      const cleanedWithArticle = cleanEditionTitle(titleWithArticle, g.author);
      if (/^The\s+/i.test(cleanedWithArticle)) g.title = cleanedWithArticle;
    }

    results.push(g);
  }

  return results;
}

export async function fetchBookReleaseYears(title, author) {
  if (!title || typeof title !== 'string') return null;
  try {
    const q = 'title=' + encodeURIComponent(title.trim()) + (author ? '&author=' + encodeURIComponent(author.trim()) : '');
    const url = `https://openlibrary.org/search.json?${q}&limit=5&fields=title,first_publish_year,publish_year,number_of_pages_median,cover_i,isbn`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.docs && data.docs.length > 0) {
      const doc = data.docs[0];
      const years = Array.isArray(doc.publish_year) ? doc.publish_year : [];
      const validYears = [...new Set(years.filter(y => typeof y === 'number' && y >= 1000 && y <= 2100))].sort((a, b) => a - b);
      return {
        firstPublishYear: doc.first_publish_year || (validYears.length > 0 ? validYears[0] : null),
        publishYears: validYears,
        medianPages: doc.number_of_pages_median || null,
        coverId: doc.cover_i || null
      };
    }
  } catch (err) {
    console.warn('[ReleaseYears] Failed to fetch editions:', err);
  }
  return null;
}

export async function searchBooks(q) {
  this._lastSearchQuery = q;
  const el = document.getElementById('searchResults');
  const prompt = document.getElementById('manualEntryPrompt');
  if (prompt) prompt.style.display = 'none';
  if (!el) return;

  el.innerHTML = '<div style="padding:12px;color:var(--wood-light);font-size:11px;">Searching...</div>';
  el.style.display = 'block';

  try {
    let proxyItems = await _queryProxySearch(q);
    let items = (proxyItems || []).map(b => ({
      volumeInfo: {
        title: b.title,
        authors: [b.author],
        pageCount: b.pages || 0,
        publishedDate: b.year || '',
        categories: b.genre ? [b.genre] : [],
        imageLinks: b.coverUrl ? { thumbnail: b.coverUrl } : null
      },
      isbn: b.isbn || null
    }));

    if (proxyItems !== null && (!items || items.length === 0)) {
      el.innerHTML = '<div style="padding:12px;color:var(--wood-light);font-size:11px;">No results found for &ldquo;' + esc(q) + '&rdquo;. (API Rate Limit may be active)</div>';
      if (prompt) prompt.style.display = 'flex';
      return;
    }

    const works = groupSearchResultsIntoWorks(items);
    el.innerHTML = '';
    works.forEach(work => {
      const coverUrl = work.coverUrl || '';
      const author = work.author || 'Unknown';
      const pages = work.pages || 0;
      const subjects = (work.categories || []).slice(0, 3).join(', ');
      const genre = work.genre || 'General Fiction';
      const sName = work.seriesName || null;
      const sNum = work.seriesNumber != null ? work.seriesNumber : null;
      const editionCount = (work.editions && work.editions.length) || 1;
      const yearBadge = work.originalYear ? ' · Original ' + work.originalYear : (work.year ? ' · ' + work.year : '');
      const editionBadge = editionCount > 1
        ? `<span style="display:inline-block;margin-left:6px;font-size:10px;padding:1px 6px;border-radius:10px;background:rgba(180,83,9,0.12);color:var(--burgundy);font-weight:600;">${editionCount} releases</span>`
        : '';

      const div = document.createElement('div');
      div.className = 'search-result';
      div.innerHTML = `${coverUrl ? '<img loading="lazy" decoding="async" src="' + coverUrl + '" alt="">' : ''}<div style="flex:1;min-width:0;"><div style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;color:var(--wood-dark);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(work.title || '')}</div><div style="font-size:11px;color:var(--wood-light);margin-top:1px;">${esc(author)}${yearBadge}${editionBadge}</div>${subjects ? '<div style="font-size:10px;color:var(--wood-light);opacity:0.7;margin-top:2px;">' + esc(subjects) + '</div>' : ''}${sName ? '<div style="font-size:10px;color:var(--burgundy);margin-top:2px;font-weight:600;">Series: ' + esc(sName) + (sNum ? ' #' + sNum : '') + '</div>' : ''}</div>`;

      div.addEventListener('click', () => {
        if (typeof this.selectSearchResult === 'function') {
          this.selectSearchResult({
            title: work.title || '',
            author: author,
            coverUrl: coverUrl,
            pages: pages,
            year: work.originalYear || work.year || '',
            originalYear: work.originalYear || work.year || '',
            editions: work.editions || [],
            genre: genre,
            fiction: genre !== 'Non-Fiction',
            seriesName: sName,
            seriesNumber: sNum,
            isbn: work.isbn || null
          });
        }
      });
      el.appendChild(div);
    });

    const manualLink = document.createElement('div');
    manualLink.style.cssText = 'padding:8px 14px;text-align:center;';
    manualLink.innerHTML = '<span class="manual-add-link" onclick="App.showManualEntry()">Not the right book? Add it manually</span>';
    el.appendChild(manualLink);
  } catch (e) {
    el.innerHTML = '<div style="padding:12px;color:var(--dislike);font-size:11px;">Search failed. Try again.</div>';
    if (prompt) prompt.style.display = 'flex';
  }
}


export function parseSeriesFromTitle(rawTitle) {
  if (!rawTitle) return { title: rawTitle, seriesName: null, seriesNumber: null };
  let title = rawTitle;
  let seriesName = null;
  let seriesNumber = null;

  // Pattern 1: Title (Series Name, #1) or Title (Series Name #1) or Title [Series Name, #1]
  const match1 = rawTitle.match(/^(.*?)\s*[\(\[](.*?)(?:,\s*|\s+)(?:#|Book\s*|Vol\.?\s*|Volume\s*)(\d+(\.\d+)?)\s*[\)\]]$/i);
  if (match1) {
    title = match1[1].trim();
    seriesName = match1[2].trim();
    seriesNumber = parseFloat(match1[3]);
    return { title, seriesName, seriesNumber };
  }

  // Pattern 2: Title: Book 1 of Series Name or Title: Book One of The Series
  const match2 = rawTitle.match(/^(.*?):\s*(?:Book|Volume|Vol\.?)\s*(\d+(\.\d+)?|[a-z]+)\s*of\s*(.*)$/i);
  if (match2) {
    title = match2[1].trim();
    const rawNum = match2[2].toLowerCase();
    const wordNum = SeriesMetadataFetcher._WORD_MAP && SeriesMetadataFetcher._WORD_MAP[rawNum];
    const romanNum = SeriesMetadataFetcher._ROMAN_MAP && SeriesMetadataFetcher._ROMAN_MAP[rawNum];
    seriesNumber = !isNaN(parseFloat(rawNum)) ? parseFloat(rawNum) : (wordNum || romanNum || null);
    seriesName = match2[4].trim();
    return { title, seriesName, seriesNumber };
  }

  // Pattern 3: Title (Series Name Series, #1)
  const match3 = rawTitle.match(/^(.*?)\s*[\(\[](.*?)\s+(?:Series|Trilogy|Saga|Chronicles),\s*(?:#|Book\s*|Vol\.?\s*|Volume\s*)(\d+(\.\d+)?)\s*[\)\]]$/i);
  if (match3) {
    title = match3[1].trim();
    seriesName = match3[2].trim();
    seriesNumber = parseFloat(match3[3]);
    return { title, seriesName, seriesNumber };
  }

  // Pattern 4: Title - Book 1 of Series Name
  const match4 = rawTitle.match(/^(.*?)\s*[-–—]\s*(?:Book|Volume|Vol\.?)\s*(\d+(\.\d+)?|[a-z]+)\s*of\s*(.*)$/i);
  if (match4) {
    title = match4[1].trim();
    const rawNum = match4[2].toLowerCase();
    const wordNum = SeriesMetadataFetcher._WORD_MAP && SeriesMetadataFetcher._WORD_MAP[rawNum];
    const romanNum = SeriesMetadataFetcher._ROMAN_MAP && SeriesMetadataFetcher._ROMAN_MAP[rawNum];
    seriesNumber = !isNaN(parseFloat(rawNum)) ? parseFloat(rawNum) : (wordNum || romanNum || null);
    seriesName = match4[4].trim();
    return { title, seriesName, seriesNumber };
  }

  return { title, seriesName, seriesNumber };
}

export function guessGenre(subjects) {
  if (!subjects || !subjects.length) return 'General Fiction';
  const s = subjects.join(' ').toLowerCase();
  if (s.includes('science fiction') || s.includes('sci-fi') || s.includes('fantasy')) return 'Sci-Fi';
  if (s.includes('mystery') || s.includes('detective') || s.includes('crime') || s.includes('thriller')) return 'Crime/Detective';
  if (s.includes('non-fiction') || s.includes('nonfiction') || s.includes('biography') || s.includes('memoir') || s.includes('history') || s.includes('self-help') || s.includes('business') || s.includes('economics') || s.includes('psychology')) return 'Non-Fiction';
  if (s.includes('science') && !s.includes('fiction')) return 'Non-Fiction';
  return 'General Fiction';
}

export function selectSearchResult(result) {
  this.selectedSearchResult = result;
  const _sr = document.getElementById('searchResults');
  if (_sr) _sr.style.display = 'none';
  const prompt = document.getElementById('manualEntryPrompt');
  if (prompt) prompt.style.display = 'none';

  const hasExplicitWords = typeof result.words === 'number' && result.words > 0;
  const words = hasExplicitWords ? result.words : (result.pages ? pagesToWords(result.pages) : 80000);

  const authorName = (result.author || '').trim();
  const fastGender = (DEMO_AUTHOR_GENDERS && DEMO_AUTHOR_GENDERS[authorName]?.gender) || (typeof guessGenderFromName === 'function' ? guessGenderFromName(authorName) : null);

  const allBooks = (this && this.books) || (typeof window !== 'undefined' && window.App && window.App.books) || [];
  let sName = result.seriesName || null;
  let sNum = result.seriesNumber != null ? result.seriesNumber : null;

  // 1. If result title has series pattern, parse it
  if (!sName) {
    const parsed = parseSeriesFromTitle(result.title || '');
    if (parsed.seriesName) {
      sName = parsed.seriesName;
      if (sNum == null && parsed.seriesNumber != null) sNum = parsed.seriesNumber;
    }
  }

  // 2. Harmonize against library consensus or expand acronyms
  if (sName) {
    const matched = findMatchingLibrarySeries(sName, authorName, allBooks);
    if (matched) sName = matched;
  }

  // 3. Fallback volume parsing if number still missing
  if (sName && sNum == null && SeriesMetadataFetcher && typeof SeriesMetadataFetcher._parseVolumeNumber === 'function') {
    const num = SeriesMetadataFetcher._parseVolumeNumber(result.title || '', '', '', sName);
    if (num != null && !isNaN(num)) sNum = num;
  }

  const tempBook = {
    title: result.title || '',
    author: authorName,
    coverUrl: result.coverUrl || '',
    pages: result.pages || 0,
    words: words,
    year: result.year || result.originalYear || '',
    originalYear: result.originalYear || result.year || '',
    editions: result.editions || [],
    genre: result.genre || 'General Fiction',
    fiction: result.fiction !== false,
    format: result.format || 'physical',
    isbn: result.isbn || null,
    seriesName: sName,
    seriesNumber: sNum,
    status: this.addStatus || 'to-read',
    currentlyReading: this.addStatus === 'reading',
    wordCountEstimated: !hasExplicitWords,
    wordCountSource: hasExplicitWords ? 'user_override' : 'calculated',
    authorGender: (fastGender && fastGender !== 'Unknown') ? fastGender : null,
    author_gender: (fastGender && fastGender !== 'Unknown') ? fastGender.toLowerCase() : null
  };

  this.closeModal('addBookModal');
  if (typeof this.openEditModal === 'function') {
    this.openEditModal(tempBook, 'add');
  }
}

export async function useScanResult() {
  const result = CameraScanner.getResult();
  if (!result) { this.showToast('No scan result available.'); return; }
  CameraScanner.stop();
  if (typeof DB !== 'undefined' && DB.trackEvent) {
    DB.trackEvent('book_scanned', { method: result.scanMethod || 'barcode', has_isbn: !!result.isbn });
  }

  const genre = guessGenre([]);
  const prefill = () => {
    this.setAddMode('search');
    this.selectSearchResult({
      title: result.title,
      author: result.author,
      coverUrl: result.coverUrl || '',
      pages: result.pages || 0,
      year: result.year || '',
      genre: genre,
      fiction: genre !== 'Non-Fiction',
      isbn: result.isbn || null,
      _addSource: 'scan'
    });

    if (result.title) {
      const si = document.getElementById('bookSearchInput');
      if (si) si.value = result.title;
    }
  };

  try {
    const dupe = await DuplicateDetector.findDuplicate(result.title, result.author, result.isbn || null, this.userId);
    if (dupe) {
      if (typeof DB !== 'undefined' && DB.trackEvent) DB.trackEvent('scan_duplicate_reread', { title: result.title });
      DuplicateDetector.showModal(dupe, { title: result.title, author: result.author, isbn: result.isbn || null },
        (existingBook) => {
          this._pendingRereadOriginal = existingBook;
          prefill();
        },
        () => { this._pendingRereadOriginal = null; }
      );
      return;
    }
  } catch (err) {
    console.warn('[useScanResult] Duplicate check failed (non-blocking):', err);
  }

  prefill();
}

export function showManualEntry() {
  const ss = document.getElementById('searchSubArea');
  const ms = document.getElementById('manualSubArea');
  if (ss) ss.style.display = 'none';
  if (ms) ms.style.display = 'block';

  const ff = document.getElementById('bookFormFields');
  if (ff) ff.style.display = 'none';

  this._manualLookup = null;
  const isbnEl = document.getElementById('manualISBN');
  if (isbnEl) isbnEl.value = '';
  const isbnBtn = document.getElementById('manualISBNBtn');
  if (isbnBtn) { isbnBtn.disabled = true; isbnBtn.textContent = '🔍 Look up'; }
  this._setManualISBNStatus('');

  const titleEl = document.getElementById('manualTitle');
  if (titleEl) {
    if (!titleEl.value && this._lastSearchQuery) titleEl.value = this._lastSearchQuery;
    titleEl.focus();
  }

  this.updateManualContinueState();
  if (typeof DB !== 'undefined' && DB.trackEvent) DB.trackEvent('manual_entry_opened', {});
}

export function hideManualEntry() {
  const ss = document.getElementById('searchSubArea');
  const ms = document.getElementById('manualSubArea');
  if (ms) ms.style.display = 'none';
  if (ss) ss.style.display = 'block';
  const si = document.getElementById('bookSearchInput');
  if (si) si.focus();
}

export function updateManualContinueState() {
  const titleEl = document.getElementById('manualTitle');
  const btn = document.getElementById('manualContinueBtn');
  if (btn) btn.disabled = !(titleEl && titleEl.value.trim());
}

export function _onManualISBNInput(val) {
  const el = document.getElementById('manualISBN');
  const btn = document.getElementById('manualISBNBtn');
  if (!el || !btn) return;
  const digits = (val || el.value || '').replace(/[^0-9Xx]/g, '');
  btn.disabled = !(digits.length === 10 || digits.length === 13);
}

export function _setManualISBNStatus(msg, kind) {
  const el = document.getElementById('manualISBNStatus');
  if (!el) return;
  if (!msg) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  el.textContent = msg;
  el.style.color = kind === 'error' ? 'var(--dislike)' : (kind === 'ok' ? 'var(--like)' : 'var(--wood-light)');
}

export async function lookupManualISBN() {
  const el = document.getElementById('manualISBN');
  if (!el) return;
  const isbn = (el.value || '').replace(/[^0-9Xx]/g, '');
  if (!(isbn.length === 10 || isbn.length === 13)) {
    this._setManualISBNStatus('Enter a 10- or 13-digit ISBN.', 'error');
    return;
  }

  const btn = document.getElementById('manualISBNBtn');
  if (btn) { btn.disabled = true; btn.textContent = '...'; }
  this._setManualISBNStatus('Looking up ISBN ' + isbn + '…');
  let found = null;

  try {
    const res = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
    const data = await res.json();
    const key = 'ISBN:' + isbn;
    if (data && data[key]) {
      const book = data[key];
      found = {
        title: book.title || '',
        author: (book.authors && book.authors[0]) ? book.authors[0].name : '',
        coverUrl: (book.cover && (book.cover.medium || book.cover.large)) || '',
        pages: book.number_of_pages || 0,
        year: book.publish_date ? (parseInt(book.publish_date) || '') : ''
      };
    }

    if (!found) {
      const gres = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&maxResults=1` + (typeof localStorage !== 'undefined' && localStorage.getItem('sl_gb_key') ? '&key=' + localStorage.getItem('sl_gb_key') : ''));
      const gdata = await gres.json();
      if (gdata.totalItems > 0 && gdata.items[0].volumeInfo) {
        const vol = gdata.items[0].volumeInfo;
        found = {
          title: vol.title || '',
          author: (vol.authors || [])[0] || '',
          coverUrl: vol.imageLinks ? (vol.imageLinks.thumbnail || '').replace('http:', 'https:') : '',
          pages: vol.pageCount || 0,
          year: vol.publishedDate ? (parseInt(vol.publishedDate) || '') : ''
        };
      }
    }
  } catch (err) {
    console.warn('[lookupManualISBN] error:', err);
    if (btn) { btn.textContent = '🔍 Look up'; btn.disabled = false; }
    this._setManualISBNStatus('Lookup failed. Check your connection or fill the fields in manually.', 'error');
    if (typeof DB !== 'undefined' && DB.trackEvent) DB.trackEvent('manual_isbn_lookup', { isbn: isbn, result: 'error' });
    return;
  }

  if (btn) { btn.textContent = '🔍 Look up'; btn.disabled = false; }
  if (!found || !found.title) {
    this._setManualISBNStatus('No match found for that ISBN. You can still fill the fields in manually.', 'error');
    if (typeof DB !== 'undefined' && DB.trackEvent) DB.trackEvent('manual_isbn_lookup', { isbn: isbn, result: 'not_found' });
    return;
  }

  const titleEl = document.getElementById('manualTitle');
  const authorEl = document.getElementById('manualAuthor');
  const wordsEl = document.getElementById('manualWords');
  if (titleEl && found.title) titleEl.value = found.title;
  if (authorEl && found.author) authorEl.value = found.author;
  if (wordsEl && found.pages) wordsEl.value = pagesToWords(found.pages);

  this._manualLookup = { isbn: isbn, coverUrl: found.coverUrl || '', year: found.year || '', pages: found.pages || 0 };
  this.updateManualContinueState();
  this._setManualISBNStatus('✅ Found: ' + found.title + (found.author ? ' · ' + found.author : ''), 'ok');
  if (typeof DB !== 'undefined' && DB.trackEvent) DB.trackEvent('manual_isbn_lookup', { isbn: isbn, result: 'found' });
}

export function submitManualEntry() {
  const title = (document.getElementById('manualTitle')?.value || '').trim();
  if (!title) { this.showToast('Please enter a title.'); return; }
  const author = (document.getElementById('manualAuthor')?.value || '').trim() || 'Unknown';
  const genre = document.getElementById('manualGenre')?.value || 'General Fiction';
  const wordsRaw = parseInt(document.getElementById('manualWords')?.value, 10);
  const words = (wordsRaw && wordsRaw > 0) ? wordsRaw : 0;
  const format = document.getElementById('manualFormat')?.value || 'physical';
  const lk = this._manualLookup || {};

  this.selectSearchResult({
    title: title,
    author: author,
    coverUrl: lk.coverUrl || '',
    pages: lk.pages || 0,
    words: words,
    year: lk.year || '',
    genre: genre,
    fiction: true,
    format: format,
    isbn: lk.isbn || null,
    _manual: true,
    _addSource: lk.isbn ? 'manual_isbn' : 'manual'
  });

  if (!words) {
    this._addWcEstimated = true;
    this._setAddWcEstimatedUI(true);
  }
  if (typeof DB !== 'undefined' && DB.trackEvent) {
    DB.trackEvent('manual_entry_submitted', { has_word_count: !!words, format: format, has_isbn: !!lk.isbn });
  }
}

export function _setManualFiction(isFiction) {
  const btn = document.getElementById('manualFictionBtn');
  if (btn) {
    btn.classList.toggle('active', !!isFiction);
  }
}

export function _setAddWcEstimatedUI(estimated) {
  const flag = document.getElementById('addWcEstFlag');
  const hint = document.getElementById('wordCountHint');
  if (flag) flag.style.display = estimated ? '' : 'none';
  if (hint) hint.style.display = estimated ? 'block' : 'none';
}

export function onAddWordCountManual() {
  this._addWcEstimated = false;
  this._setAddWcEstimatedUI(false);
}

export function calcAddWordsFromPages() {
  const pages = parseInt(document.getElementById('addPagesEstimate')?.value) || 0;
  const result = document.getElementById('addPagesResult');
  const applyBtn = document.getElementById('addPagesApply');
  const words = pagesToWords(pages);
  if (result) result.textContent = words ? words.toLocaleString() : ' - ';
  if (applyBtn) applyBtn.disabled = !words;
}

export function applyAddPagesEstimate() {
  const pages = parseInt(document.getElementById('addPagesEstimate')?.value) || 0;
  const words = pagesToWords(pages);
  if (!words) return;
  const input = document.getElementById('wordCountInput');
  if (input) input.value = words;
  this._addWcEstimated = true;
  this._setAddWcEstimatedUI(true);
}

export function setAddMode(mode) {
  if (mode === 'scan') {
    if (!ScannerLoader._loaded) {
      const scanBtn = document.getElementById('addModeScan');
      if (scanBtn) scanBtn.textContent = '⏳ Loading...';
      ScannerLoader.load().then(ok => {
        if (scanBtn) scanBtn.textContent = '📷 Scan Barcode';
        if (!ok || (typeof window !== 'undefined' && window._quaggaLoadFailed && window._tesseractLoadFailed)) {
          showToast('📷 Scanning libraries could not be loaded. Please use search instead.');
        }
      });
    }
  }

  if (mode === 'scan' && typeof DB !== 'undefined' && DB.trackEvent) DB.trackEvent('feature_use', { feature: 'scanner_opened' });

  const manualBtn = document.getElementById('addModeManual');
  const searchBtn = document.getElementById('addModeSearch');
  const scanBtn = document.getElementById('addModeScan');

  if (searchBtn) searchBtn.classList.toggle('active', mode === 'search');
  if (scanBtn) scanBtn.classList.toggle('active', mode === 'scan');
  if (manualBtn) manualBtn.classList.toggle('active', mode === 'manual');

  const searchArea = document.getElementById('addModeSearchArea');
  const scanArea = document.getElementById('addModeScanArea');
  if (searchArea) searchArea.style.display = (mode === 'search' || mode === 'manual') ? 'block' : 'none';
  if (scanArea) scanArea.style.display = mode === 'scan' ? 'block' : 'none';

  if (mode === 'scan') {
    CameraScanner.start();
  } else {
    CameraScanner.stop();
  }

  if (mode === 'manual') {
    this.showManualEntry();
  } else if (mode === 'search') {
    const ss = document.getElementById('searchSubArea');
    if (ss) ss.style.display = 'block';
    const ms = document.getElementById('manualSubArea');
    if (ms) ms.style.display = 'none';
  }
}

export function selectAddStatus(status) {
  this.addStatus = status;
  document.querySelectorAll('#addStatusSelector .status-opt').forEach(o => {
    o.classList.toggle('selected', o.dataset.status === status);
  });

  const crCheck = document.getElementById('currentlyReadingCheck');
  if (crCheck) crCheck.checked = (status === 'reading');
  const isToRead = (status === 'to-read');
  const finishedFields = document.getElementById('addFinishedFields');
  const toReadGroup = document.getElementById('addToReadNotesGroup');
  const reviewGroup = document.getElementById('addReviewGroup');

  if (finishedFields) finishedFields.style.display = isToRead ? 'none' : '';
  if (reviewGroup) reviewGroup.style.display = isToRead ? 'none' : '';
  if (toReadGroup) toReadGroup.style.display = isToRead ? '' : 'none';

  const periodLabel = document.getElementById('periodLabel');
  if (periodLabel && !isToRead) {
    if (status === 'reading') periodLabel.textContent = this.quarterMode ? 'Quarter started' : 'Month started';
    else periodLabel.textContent = this.quarterMode ? 'Quarter finished' : 'Month finished';
  }
}

export function stopScanner() {
  CameraScanner.stop();
  this.setAddMode('search');
}

export function scanTryOCR() {
  CameraScanner.tryOCR();
}

export function scanRetry() {
  CameraScanner.retry();
}

export function scanUseAnyway() {
  CameraScanner.useLowConfResult();
}

export function triggerScanUpload() {
  const fileInput = document.getElementById('scanFileInput');
  if (fileInput) fileInput.click();
}

export function handleScanFileInput(input) {
  CameraScanner.handleFileInput(input);
}

export function scanSwitchToManual() {
  if (typeof DB !== 'undefined' && DB.trackEvent) DB.trackEvent('feature_use', { feature: 'scanner_to_manual' });
  const lastIsbn = CameraScanner._lastScannedISBN || (CameraScanner.getResult() && CameraScanner.getResult().isbn);
  CameraScanner.stop();
  this.setAddMode('search');
  if (typeof this.showManualEntry === 'function') {
    this.showManualEntry();
    if (lastIsbn) {
      setTimeout(() => {
        const el = document.getElementById('manualISBN');
        if (el) {
          el.value = lastIsbn;
          if (typeof this._onManualISBNInput === 'function') this._onManualISBNInput(lastIsbn);
        }
      }, 50);
    }
  }
}

// Global Search
export async function openGlobalSearch() {
  this.openModal('globalSearchModal');
  const input = document.getElementById('globalSearchInput');
  if (input) { input.value = ''; setTimeout(() => input.focus(), 50); }

  const resultsEl = document.getElementById('globalSearchResults');
  if (resultsEl) resultsEl.innerHTML = '<div class="global-search-hint">Loading your library...</div>';

  try {
    if (this.aggregateBooks && this.aggregateBooks.length > 0) {
      this.globalSearchBooks = this.aggregateBooks;
    } else if (!this.globalSearchBooks || this.globalSearchBooks.length === 0) {
      const rows = await DB.getAllUserBooks(this.userId);
      this.globalSearchBooks = (rows || []).map(r => {
        const bk = dbToBook(r);
        bk._year = r._shelfYear || bk.year;
        return bk;
      });
    }
  } catch (e) {
    console.warn('Global search load failed:', e && e.message);
    this.globalSearchBooks = [];
  }

  if (resultsEl) {
    resultsEl.innerHTML = `<div class="global-search-hint">Search across ${this.globalSearchBooks.length} book${this.globalSearchBooks.length !== 1 ? 's' : ''} in your library.</div>`;
  }
}

export function debounceGlobalSearch(query) {
  clearTimeout(this._globalSearchTimeout);
  this._globalSearchTimeout = setTimeout(() => this.performGlobalSearch(query), 500);
}

export function performGlobalSearch(query) {
  const resultsEl = document.getElementById('globalSearchResults');
  if (!resultsEl) return;

  const q = (query || '').trim().toLowerCase();
  if (!q) {
    const n = this.globalSearchBooks ? this.globalSearchBooks.length : 0;
    resultsEl.innerHTML = `<div class="global-search-hint">Search across ${n} book${n !== 1 ? 's' : ''} in your library.</div>`;
    return;
  }

  const books = this.globalSearchBooks || [];
  const matches = books.filter(b =>
    (b.title || '').toLowerCase().includes(q) ||
    (b.author || '').toLowerCase().includes(q) ||
    (b.genre || '').toLowerCase().includes(q) ||
    (b.narrator && b.narrator.toLowerCase().includes(q)) ||
    (b.seriesName && b.seriesName.toLowerCase().includes(q))
  );

  matches.sort((a, b) => (b._year || 0) - (a._year || 0) || (a.title || '').localeCompare(b.title || ''));

  if (!matches.length) {
    resultsEl.innerHTML = `<div class="global-search-empty">
      <div style="font-size:32px;margin-bottom:8px;">🔍</div>
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;color:var(--wood-dark);">No books match “${esc(query)}”</div>
      <div style="font-size:12px;color:var(--wood-light);margin-top:4px;">Try a different title, author, or genre.</div>
    </div>`;
    return;
  }

  resultsEl.innerHTML = matches.slice(0, 60).map(b => {
    const col = (typeof COLORS !== 'undefined' && COLORS[b.sentiment]) ? COLORS[b.sentiment] : 'var(--wood-light)';
    const cover = b.coverUrl
      ? `<img loading="lazy" decoding="async" src="${b.coverUrl}" style="width:34px;height:50px;object-fit:cover;border-radius:2px;flex-shrink:0;" onerror="if(this&&this.style)this.style.display='none'">`
      : `<div style="width:34px;height:50px;border-radius:2px;background:${col};flex-shrink:0;"></div>`;

    return `<div class="global-search-row" data-id="${b.id}" data-year="${b._year || ''}" onclick="App.openBookFromSearch(this)">
      ${cover}
      <div style="min-width:0;flex:1;">
        <div class="gsr-title">${esc(b.title || 'Untitled')}</div>
        <div class="gsr-meta">${esc(b.author || 'Unknown')}${b.genre ? ' · ' + esc(b.genre) : ''}</div>
        ${b.seriesName ? '<div style="font-size:10px;color:var(--wood-mid);margin-top:2px;">📚 ' + esc(b.seriesName) + (b.seriesNumber ? ' #' + b.seriesNumber : '') + '</div>' : ''}
        ${(b.narrator && b.narrator.toLowerCase().includes(q)) ? '<div style="font-size:9px;color:rgba(99,71,186,0.8);margin-top:1px;">🎧 ' + esc(b.narrator) + '</div>' : ''}
      </div>
      <div class="gsr-year">${b._year || ''}</div>
    </div>`;
  }).join('');
}

export async function openBookFromSearch(bookId, year) {
  const modalEl = document.getElementById('globalSearchModal');
  if (!modalEl) return;
  if (bookId && typeof bookId === 'object' && bookId.dataset) {
    if (bookId.dataset.year) year = bookId.dataset.year;
    if (bookId.dataset.id) bookId = bookId.dataset.id;
  }
  this.closeModal('globalSearchModal');

  if (year && year !== this.currentYear) {
    const yearInput = document.getElementById('yearInput');
    if (yearInput) yearInput.value = year;
    await this.setYear(year);
  }

  const book = (this.books || []).find(b => String(b.id) === String(bookId));
  if (book) {
    openPanel(book);
  } else {
    const cached = (this.globalSearchBooks || []).find(b => String(b.id) === String(bookId));
    if (cached) openPanel(cached);
  }
}

// Currently Reading Search
export function debounceCRSearch(q) {
  clearTimeout(this._crSearchTimeout);
  if (!q || q.length < 3) {
    const crSR = document.getElementById('crSearchResults');
    if (crSR) crSR.style.display = 'none';
    return;
  }
  this._crSearchTimeout = setTimeout(() => this._searchCRBooks(q), 400);
}

export async function _searchCRBooks(q) {
  const el = document.getElementById('crSearchResults');
  if (!el) return;
  el.innerHTML = '<div style="padding:12px;color:var(--wood-light);font-size:11px;">Searching...</div>';
  el.style.display = 'block';

  try {
    let items = [];
    try {
      const url = 'https://openlibrary.org/search.json?q=' + encodeURIComponent(q) + '&limit=6';
      const res = await fetch(url);
      const data = await res.json();
      if (data.docs && data.docs.length) {
        items = data.docs.map(doc => ({
          volumeInfo: {
            title: doc.title,
            authors: doc.author_name || [],
            pageCount: doc.number_of_pages_median || 0,
            publishedDate: doc.first_publish_year ? String(doc.first_publish_year) : '',
            categories: doc.subject || [],
            imageLinks: doc.cover_i ? { thumbnail: 'https://covers.openlibrary.org/b/id/' + doc.cover_i + '-S.jpg' } : null
          }
        }));
      }
    } catch (e) {
      console.warn('OpenLibrary API failed', e);
    }

    if (items.length === 0) {
      try {
        const url = 'https://www.googleapis.com/books/v1/volumes?q=' + encodeURIComponent(q) + '&maxResults=6&orderBy=relevance' + (typeof localStorage !== 'undefined' && localStorage.getItem('sl_gb_key') ? '&key=' + localStorage.getItem('sl_gb_key') : '');
        const res = await fetch(url);
        const data = await res.json();
        if (data.items && data.items.length) items = data.items;
      } catch (e) {
        console.warn('Google Books API failed', e);
      }
    }

    if (!items.length) {
      el.innerHTML = '<div style="padding:12px;color:var(--wood-light);font-size:11px;">No results found. (API Rate Limit may be active)</div>';
      return;
    }

    el.innerHTML = items.map((item, i) => {
      const vi = item.volumeInfo || {};
      const coverUrl = vi.imageLinks?.thumbnail ? vi.imageLinks.thumbnail.replace('http:', 'https:') : '';
      const author = (vi.authors || [])[0] || 'Unknown';
      const genre = (vi.categories || []).slice(0, 2).join(', ') || 'General Fiction';
      const fiction = !(vi.categories && vi.categories.some(s => /non-?fiction|biography|memoir|history|science|business|self-help/i.test(s)));
      const year = vi.publishedDate ? vi.publishedDate.substring(0, 4) : '';
      const pages = vi.pageCount || 0;
      return `<div class="search-result" style="display:flex;gap:10px;align-items:center;padding:10px;cursor:pointer;border-bottom:1px solid rgba(61,43,31,0.06);" data-idx="${i}" data-title="${esc(vi.title || '')}" data-author="${esc(author)}" data-cover="${coverUrl}" data-pages="${pages}" data-year="${year}" data-genre="${esc(genre)}" data-fiction="${fiction}" onclick="App._selectCRResult(this)">${coverUrl ? `<img loading="lazy" decoding="async" src="${coverUrl}" style="width:32px;height:46px;object-fit:cover;border-radius:2px;">` : ''}<div><div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;">${esc(vi.title || '')}</div><div style="font-size:10px;color:var(--wood-light);">${esc(author)}${year ? ' · ' + year : ''}</div></div></div>`;
    }).join('');
  } catch (err) {
    el.innerHTML = '<div style="padding:12px;color:var(--dislike);font-size:11px;">Search failed.</div>';
  }
}

export function _selectCRResult(el) {
  if (!el || !el.dataset) return;
  const crTitle = document.getElementById('crModalTitle');
  const crAuthor = document.getElementById('crModalAuthor');
  const crCover = document.getElementById('crModalCover');
  const crGenre = document.getElementById('crModalGenre');
  const crPages = document.getElementById('crModalPages');

  if (crTitle) crTitle.value = el.dataset.title || '';
  if (crAuthor) crAuthor.value = el.dataset.author || '';
  if (crCover) crCover.value = el.dataset.cover || '';
  if (crGenre) crGenre.value = el.dataset.genre || 'General Fiction';
  if (crPages) crPages.value = el.dataset.pages || '';

  const crSR = document.getElementById('crSearchResults');
  if (crSR) crSR.style.display = 'none';
}

// Club Pick Search
export function debounceClubPickSearch(query) {
  const resultsEl = document.getElementById('clubPickSearchResults');
  if (!resultsEl) return;
  if (!query || typeof query !== 'string' || query.trim().length < 2) {
    resultsEl.style.display = 'none';
    return;
  }
  clearTimeout(this._clubPickSearchTimeout);
  resultsEl.innerHTML = `<div style="padding:10px; font-size:11px; color:var(--wood-light); text-align:center;">Searching candidate books...</div>`;
  resultsEl.style.display = 'block';

  this._clubPickSearchTimeout = setTimeout(() => {
    this.searchBooksForClub(query.trim());
  }, 350);
}

export async function searchBooksForClub(query) {
  const resultsEl = document.getElementById('clubPickSearchResults');
  if (!resultsEl) return;

  try {
    let items = await _queryProxySearch(query);
    if (items !== null && (!items || items.length === 0)) {
      const qLower = query.toLowerCase();
      const pool = (typeof this.getClubVibeSuggestions === 'function' && this.getClubVibeSuggestions().suggestions) || [];
      items = pool.filter(b => (b.title || '').toLowerCase().includes(qLower) || (b.author || '').toLowerCase().includes(qLower));
    }

    if (items !== null && (!items || items.length === 0)) {
      resultsEl.innerHTML = `<div style="padding:10px; font-size:11px; color:var(--wood-mid); text-align:center;">No books found matching &ldquo;${esc(query)}&rdquo;</div>`;
      return;
    }

    resultsEl.innerHTML = items.map(b => {
      const titleEsc = esc(b.title || '');
      const authorEsc = esc(b.author || '');
      const coverEsc = esc(b.coverUrl || b.cover || '');
      return `
        <div onclick="App.selectClubPickBook({title: '${titleEsc}', author: '${authorEsc}', coverUrl: '${coverEsc}'})" style="display:flex; gap:10px; align-items:center; padding:8px 10px; cursor:pointer; border-bottom:1px solid rgba(61,43,31,0.06);" onmouseover="this.style.background='rgba(139,38,53,0.04)'" onmouseout="this.style.background='transparent'">
          <img src="${coverEsc || (typeof coverPlaceholder === 'function' ? coverPlaceholder(b.title || 'Book', b.author || '', 'mixed') : '')}" style="width:28px; height:42px; object-fit:cover; border-radius:3px; flex-shrink:0;" onerror="if(this&&this.style)this.style.display='none';">
          <div style="flex:1; min-width:0;">
            <div style="font-size:12px; font-weight:700; color:var(--wood-dark); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${titleEsc}</div>
            <div style="font-size:10px; color:var(--wood-mid); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${authorEsc}${b.year ? ' • ' + b.year : ''}</div>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.warn('Search for club pick failed', err);
    if (resultsEl) resultsEl.innerHTML = '<div style="padding:10px; font-size:11px; color:var(--burgundy); text-align:center;">Search failed.</div>';
  }
}

// Reader & Network Search
export async function searchReaders(query) {
  const input = document.getElementById('commSearchInput');
  const q = (query || (input ? input.value : '') || '').toLowerCase().trim();
  const container = document.getElementById('discoverReaders');
  if (!container) return;

  if (!q) {
    if (typeof this.renderDiscoverSection === 'function') {
      this.renderDiscoverSection();
    }
    return;
  }

  container.innerHTML = '<div style="padding:12px;font-size:11px;color:var(--wood-light);">Searching readers...</div>';

  try {
    const profiles = await DB.getPublicProfiles(this.userId);
    const matches = (profiles || []).filter(p => {
      const name = (p.display_name || '').toLowerCase();
      const username = (p.username || '').toLowerCase();
      return name.includes(q) || username.includes(q);
    });

    if (!matches.length) {
      container.innerHTML = `<div style="padding:12px;font-size:11px;color:var(--wood-mid);">No readers found matching "${esc(q)}"</div>`;
      return;
    }

    container.innerHTML = matches.map(p => {
      const avatar = p.avatar_emoji || '📚';
      const name = esc(p.display_name || 'Reader');
      const isFollowing = Array.isArray(this.following) && this.following.includes(p.user_id);
      return `<div class="discover-card" style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:rgba(61,43,31,0.04);border-radius:8px;border:1px solid rgba(61,43,31,0.08);">
        <div style="font-size:20px;">${avatar}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:700;font-size:12px;color:var(--wood-dark);">${name}</div>
          <div style="font-size:10px;color:var(--wood-mid);">@${esc(p.username || 'reader')}</div>
        </div>
        <button class="btn-primary" style="padding:4px 10px;font-size:10px;" onclick="App.toggleFollow('${p.user_id}', this)">${isFollowing ? 'Following' : '+ Follow'}</button>
      </div>`;
    }).join('');
  } catch (err) {
    container.innerHTML = '<div style="padding:12px;font-size:11px;color:var(--dislike);">Search error</div>';
  }
}

export function handleNetworkSearch(query) {
  const q = (query || '').toLowerCase().trim();
  const dropdown = document.getElementById('searchDropdown');
  if (dropdown) {
    dropdown.style.display = q ? 'block' : 'none';
  }
  const items = document.querySelectorAll('#searchDropdown .search-result-item, #networkContainer .reader-card, #discoverReaders .discover-card');
  items.forEach(el => {
    const text = (el.textContent || '').toLowerCase();
    el.style.display = (!q || text.includes(q)) ? '' : 'none';
  });
}

// CSV & Bulk Import
export function parseBulkText() {
  const text = (document.getElementById('bulkTextInput')?.value || '').trim();
  if (!text) { this.showToast('Please enter at least one book title.'); return; }
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const imported = [];
  for (const title of lines) {
    imported.push({
      include: true,
      title: title,
      author: 'Unknown Author',
      rating: 3,
      sentiment: 'mixed',
      month: ALL_MONTHS[new Date().getMonth()],
      readYear: this.currentYear || new Date().getFullYear(),
      bookYear: this.currentYear || new Date().getFullYear(),
      year: this.currentYear || new Date().getFullYear(),
      pages: 0,
      words: 100000,
      wordCountEstimated: true,
      wordCountSource: 'calculated',
      days: 5,
      format: 'physical',
      cr: false,
      status: 'finished',
      currentlyReading: false,
      readDatesStr: '',
      durationHours: 0
    });
  }
  this.importBooks = imported;
  if (typeof this.showImportReview === 'function') this.showImportReview();
}

export function handleCSVUpload(event) {
  // Demo & guest mode CSV upload allowed
  const files = (event && event.target && event.target.files) || (event && event.files) || (document.getElementById('csvFileInput') && document.getElementById('csvFileInput').files) || [];
  const file = files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const csvText = e.target.result;
      const rows = this.parseCSVString(csvText);
      if (rows.length < 2) { this.showToast('CSV file appears empty.'); return; }

      const headers = rows[0].map(h => h.trim().toLowerCase());
      
      const findCol = (aliases) => {
        for (let a of aliases) {
          const idx = headers.indexOf(a.toLowerCase());
          if (idx !== -1) return idx;
        }
        return -1;
      };

      const titleIdx = findCol(['Title', 'Book Title']);
      const authorIdx = findCol(['Author', 'Authors', 'Primary Author', 'Creator']);
      const pagesIdx = findCol(['Number of Pages', 'Pages', 'Page Count', 'Paces']);
      const dateReadIdx = findCol(['Last Date Read', 'Date Read', 'Dates Read', 'Last Read']);
      const dateAddedIdx = findCol(['Date Added', 'Added Date', 'Created At']);
      const shelfIdx = findCol(['Exclusive Shelf', 'Read Status', 'Status', 'Bookshelves', 'Shelf', 'Reading Status']);
      const ratingIdx = findCol(['My Rating', 'Rating', 'Star Rating']);
      const reviewIdx = findCol(['My Review', 'Review', 'Reviews']);
      const yearPubIdx = findCol(['Original Publication Year', 'Year Published', 'Year', 'Publication Year']);
      const coverUrlIdx = findCol(['Cover URL', 'Cover']);
      const wordCountIdx = findCol(['Word Count', 'Word Count Estimate']);
      const genreIdx = findCol(['Genre', 'Genres']);
      const sentimentIdx = findCol(['Sentiment', 'Moods', 'Mood']);
      const daysIdx = findCol(['Days to Read', 'Days']);
      const formatIdx = findCol(['Format', 'Binding']);
      const durationIdx = findCol(['Duration Hours']);

      if (titleIdx < 0) { this.showToast('CSV missing "Title" column.'); return; }

      const imported = [];
      for (let i = 1; i < rows.length; i++) {
        const cols = rows[i];
        if (cols.length === 1 && !cols[0].trim()) continue;

        let shelfRaw = shelfIdx >= 0 ? (cols[shelfIdx] || '').toLowerCase().trim() : 'read';
        let status = 'read';
        if (shelfRaw.includes('currently-reading') || shelfRaw === 'reading' || shelfRaw.includes('currently reading')) {
          status = 'reading';
        } else if (
          shelfRaw.includes('to-read') ||
          shelfRaw.includes('to read') ||
          shelfRaw === 'tbr' ||
          shelfRaw.includes('want to read') ||
          shelfRaw.includes('wishlist') ||
          shelfRaw === 'queued'
        ) {
          status = 'to-read';
        } else if (shelfRaw.includes('did-not-finish') || shelfRaw === 'dnf') {
          status = 'dnf';
        } else {
          status = 'finished';
        }

        let dateStr = dateReadIdx >= 0 ? (cols[dateReadIdx] || '') : '';
        if (!dateStr && status !== 'to-read' && dateAddedIdx >= 0) dateStr = cols[dateAddedIdx] || '';

        let month = status === 'to-read' ? '' : (window.ALL_MONTHS ? window.ALL_MONTHS[new Date().getMonth()] : 'January');
        let bookYear = this.currentYear || new Date().getFullYear();
        if (dateStr && status !== 'to-read') {
          const d = new Date(dateStr);
          if (!isNaN(d.getTime())) {
            month = window.ALL_MONTHS ? window.ALL_MONTHS[d.getMonth()] : 'January';
            bookYear = d.getFullYear();
          }
        }

        const pagesRaw = parseInt(pagesIdx >= 0 ? cols[pagesIdx] : '') || 0;
        let sentiment = 'mixed';
        if (sentimentIdx >= 0 && cols[sentimentIdx]) {
          const s = cols[sentimentIdx].toLowerCase().trim();
          if (['love', 'like', 'mixed', 'dislike'].includes(s)) sentiment = s;
        } else {
          const rating = parseInt(ratingIdx >= 0 ? cols[ratingIdx] : '') || 3;
          sentiment = rating >= 5 ? 'love' : rating >= 4 ? 'like' : rating >= 3 ? 'mixed' : 'dislike';
        }

        const wordCountExplicit = wordCountIdx >= 0 ? (parseInt(cols[wordCountIdx]) || 0) : 0;
        const wcEstimated = !wordCountExplicit;
        const words = wordCountExplicit || (pagesRaw ? Math.round(pagesRaw * 275) : 80000);
        const pages = pagesRaw || Math.round(words / 275);
        const pubYear = parseInt(yearPubIdx >= 0 ? cols[yearPubIdx] : '') || bookYear;
        const review = reviewIdx >= 0 ? (cols[reviewIdx] || '') : '';
        const genre = genreIdx >= 0 ? (cols[genreIdx] || 'General Fiction') : 'General Fiction';
        const days = status === 'to-read' ? 0 : (daysIdx >= 0 ? (parseInt(cols[daysIdx]) || 5) : 5);
        let coverUrl = coverUrlIdx >= 0 ? (cols[coverUrlIdx] || '') : '';
        const isFiction = !genre.toLowerCase().includes('non-fiction');

        let bookFormat = 'physical';
        if (formatIdx >= 0 && cols[formatIdx]) {
          const f = cols[formatIdx].toLowerCase().trim();
          if (f.includes('audio')) bookFormat = 'audiobook';
          else if (f.includes('kindle') || f.includes('ebook') || f.includes('nook')) bookFormat = 'ebook';
        }

        const title = cols[titleIdx] || 'Unknown';
        const author = (authorIdx >= 0 ? cols[authorIdx] : '') || 'Unknown';
        const wcSource = wordCountExplicit ? 'provided' : 'calculated';
        
        imported.push({
          title: title,
          author: author,
          words: words,
          wordCountSource: wcSource,
          wordCountEstimated: wcEstimated,
          year: pubYear,
          days: days,
          sentiment: sentiment,
          month: month,
          genre: genre,
          fiction: isFiction,
          coverUrl: coverUrl,
          review: review,
          include: true,
          readYear: bookYear,
          pages: pages,
          format: bookFormat,
          status: status,
          currentlyReading: status === 'reading'
        });
      }

      if (!imported.length) {
        this.showToast('No valid books found in this CSV.');
        return;
      }

      this.importBooks = imported;
      
      this.importBooks.forEach(async (b, idx) => {
         if (!b.coverUrl) {
            try {
                const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(b.title)}+inauthor:${encodeURIComponent(b.author)}`);
                const data = await res.json();
                if (data.items && data.items.length > 0) {
                    const thumb = data.items[0].volumeInfo?.imageLinks?.thumbnail;
                    if (thumb) {
                        const httpsThumb = thumb.replace('http:', 'https:');
                        b.coverUrl = httpsThumb;
                        const rowImg = document.getElementById('importCoverPreview_' + idx);
                        if (rowImg) rowImg.src = httpsThumb;
                    }
                }
            } catch(e) {}
         }
      });

      if (typeof this.showImportReview === 'function') this.showImportReview();
    } catch (err) {
      console.error('CSV parse error:', err);
      this.showToast('Error parsing CSV. Please check the file format.');
    }
  };
  reader.readAsText(file);
}

export function parseCSVString(csvText) {
  const rows = [];
  let currentCols = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < csvText.length; i++) {
    const c = csvText[i];
    const next = csvText[i+1];
    
    if (c === '\\' && next === '"') {
      current += '"';
      i++;
    } else if (c === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      currentCols.push(current);
      current = '';
    } else if ((c === '\r' && next === '\n') && !inQuotes) {
      currentCols.push(current);
      rows.push(currentCols);
      currentCols = [];
      current = '';
      i++;
    } else if ((c === '\n' || c === '\r') && !inQuotes) {
      currentCols.push(current);
      rows.push(currentCols);
      currentCols = [];
      current = '';
    } else {
      current += c;
    }
  }
  
  if (current || currentCols.length > 0) {
    currentCols.push(current);
    rows.push(currentCols);
  }
  
  return rows;
}

export function parseCSVLine(line) {
  return this.parseCSVString(line)[0] || [];
}

export function setImportBookStatus(index, newStatus) {
  if (!this.importBooks || !this.importBooks[index]) return;
  const b = this.importBooks[index];
  b.status = newStatus;
  b.currentlyReading = (newStatus === 'reading');
  if (newStatus === 'to-read') {
    b.month = '';
    b.days = 0;
    b.sentiment = '';
  } else {
    if (!b.month) b.month = (window.ALL_MONTHS ? window.ALL_MONTHS[new Date().getMonth()] : 'January');
    if (!b.days || b.days <= 0) b.days = 5;
    if (!b.sentiment) b.sentiment = 'mixed';
  }
  if (typeof this.showImportReview === 'function') {
    this.showImportReview();
  } else if (typeof this.updateImportCount === 'function') {
    this.updateImportCount();
  }
}

export function showImportReview() {
  const step1 = document.getElementById('importStep1');
  const step2 = document.getElementById('importStep2');
  if (step1) step1.style.display = 'none';
  if (step2) step2.style.display = 'block';

  const container = document.getElementById('importReviewContainer');
  if (!container) return;

  if (typeof this.updateImportCount === 'function') this.updateImportCount();

  let html = `<table class="import-review-table"><thead><tr>
    <th style="width:30px;"></th>
    <th>Title</th>
    <th>Author</th>
    <th style="width:96px;">Word Count</th>
    <th style="width:110px;">Status</th>
    <th>Month</th>
    <th>Sentiment</th>
    <th>Format</th>
    <th style="width:65px;">Year</th>
    <th style="width:50px;">Days</th>
    <th style="width:30px;"></th>
  </tr></thead><tbody>`;

  (this.importBooks || []).forEach((b, i) => {
    const isToRead = b.status === 'to-read';
    const yearWarn = (!isToRead && b.readYear && b.readYear < new Date().getFullYear()) ? ' title="This date is in a previous year"' : '';
    const statusVal = b.status || (b.currentlyReading ? 'reading' : 'finished');

    html += `<tr${!b.include ? ' style="opacity:0.3;"' : ''}>
      <td><input type="checkbox" ${b.include ? 'checked' : ''} onchange="if(App.importBooks&&App.importBooks[${i}])App.importBooks[${i}].include=this.checked;App.updateImportCount()"></td>
      <td><input class="import-edit-input" value="${esc(b.title || '')}" onchange="if(App.importBooks&&App.importBooks[${i}])App.importBooks[${i}].title=this.value" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-weight:700;font-style:italic;min-width:120px;"></td>
      <td><input class="import-edit-input" value="${esc(b.author || '')}" onchange="if(App.importBooks&&App.importBooks[${i}])App.importBooks[${i}].author=this.value" style="min-width:100px;"></td>
      <td><input class="import-edit-input" type="text" inputmode="numeric" value="${(b.words || 0).toLocaleString()}" onchange="if(App.importBooks&&App.importBooks[${i}]){App.importBooks[${i}].words=parseInt(this.value.replace(/[^0-9]/g,''))||0;App.importBooks[${i}].wordCountEstimated=false;App.importBooks[${i}].wordCountSource='user_override';this.value=(App.importBooks[${i}].words).toLocaleString();}" style="width:96px;" title="${b.wordCountEstimated ? 'Estimated word count - edit to set exact' : 'Word count'}"></td>
      <td>
        <select class="import-edit-select" onchange="App.setImportBookStatus(${i}, this.value)" style="font-size:11px;padding:2px 4px;font-weight:600;">
          <option value="finished"${statusVal === 'finished' ? ' selected' : ''}>✓ Finished</option>
          <option value="reading"${statusVal === 'reading' ? ' selected' : ''}>📖 Reading</option>
          <option value="to-read"${statusVal === 'to-read' ? ' selected' : ''}>🔖 To-Read</option>
          <option value="dnf"${statusVal === 'dnf' ? ' selected' : ''}>🚫 DNF</option>
        </select>
      </td>
      <td>
        ${isToRead
          ? `<select disabled style="font-size:11px;padding:2px 4px;opacity:0.4;background:transparent;"><option value="">—</option></select>`
          : `<select onchange="if(App.importBooks&&App.importBooks[${i}])App.importBooks[${i}].month=this.value" style="font-size:11px;padding:2px 4px;">
              <option value=""${!b.month ? ' selected' : ''}>---</option>${ALL_MONTHS.map(m => `<option value="${m}"${b.month === m ? ' selected' : ''}>${m.slice(0, 3)}</option>`).join('')}
            </select>`
        }
      </td>
      <td>
        ${isToRead
          ? `<select disabled style="font-size:11px;padding:2px 4px;opacity:0.4;background:transparent;"><option value="">—</option></select>`
          : `<select onchange="if(App.importBooks&&App.importBooks[${i}])App.importBooks[${i}].sentiment=this.value" style="font-size:11px;padding:2px 4px;">
              ${['love', 'like', 'mixed', 'dislike'].map(s => `<option value="${s}"${b.sentiment === s ? ' selected' : ''}>${LABELS[s] || s}</option>`).join('')}
            </select>`
        }
      </td>
      <td><select onchange="if(App.importBooks&&App.importBooks[${i}])App.importBooks[${i}].format=this.value" style="font-size:11px;padding:2px 4px;">
        ${['physical', 'ebook', 'audiobook'].map(f => `<option value="${f}"${(b.format || 'physical') === f ? ' selected' : ''}>${f === 'physical' ? '📖' : f === 'ebook' ? '📱' : '🎧'} ${f.charAt(0).toUpperCase() + f.slice(1)}</option>`).join('')}
      </select></td>
      <td><input class="import-edit-input${yearWarn ? ' invalid' : ''}" type="number" value="${b.readYear || this.currentYear || 2026}" min="1900" max="2100" onchange="if(App.importBooks&&App.importBooks[${i}])App.importBooks[${i}].readYear=parseInt(this.value)||(App.currentYear||2026);if(this&&this.classList){if(!${isToRead}&&this.value<new Date().getFullYear())this.classList.add('invalid');else this.classList.remove('invalid');}"${yearWarn} style="width:65px;"></td>
      <td>
        ${isToRead
          ? `<input class="import-edit-input" type="text" value="—" disabled style="width:50px;opacity:0.4;text-align:center;background:transparent;">`
          : `<input class="import-edit-input" type="number" value="${b.days || 5}" min="1" onchange="if(App.importBooks&&App.importBooks[${i}])App.importBooks[${i}].days=parseInt(this.value)||5;" style="width:50px;">`
        }
      </td>
      <td><button class="import-remove-btn" onclick="if(App.importBooks&&App.importBooks[${i}])App.importBooks[${i}].include=false;App.showImportReview()">✕</button></td>
    </tr>`;
  });

  html += '</tbody></table>';
  container.innerHTML = html;
}

export function updateImportCount() {
  const included = (this.importBooks || []).filter(b => b.include);
  const countBadge = document.getElementById('importCountBadge');
  if (!countBadge) return;

  const toReadCount = included.filter(b => b.status === 'to-read').length;
  const readingCount = included.filter(b => b.status === 'reading').length;
  const finishedCount = included.filter(b => b.status !== 'to-read' && b.status !== 'reading' && b.status !== 'dnf').length;
  const dnfCount = included.filter(b => b.status === 'dnf').length;

  let breakdown = [];
  if (finishedCount > 0) breakdown.push(`${finishedCount} finished`);
  if (readingCount > 0) breakdown.push(`${readingCount} reading`);
  if (toReadCount > 0) breakdown.push(`${toReadCount} to-read`);
  if (dnfCount > 0) breakdown.push(`${dnfCount} dnf`);

  let text = `${included.length} book${included.length !== 1 ? 's' : ''} selected`;
  if (breakdown.length > 1) {
    text += ` (${breakdown.join(' · ')})`;
  } else if (toReadCount > 0 && included.length === toReadCount) {
    text += ` (${toReadCount} to-read)`;
  }
  countBadge.textContent = text;
}

export async function commitImport(isRetry = false) {
  const toImport = (this.importBooks || []).filter(b => b.include);

  if (!toImport.length) {
    this.showToast('No books selected for import.');
    return;
  }

  const invalidDates = toImport.filter(b => b.status !== 'to-read' && (b.readYear < 1900 || b.readYear > 2100));
  if (invalidDates.length) {
    this.showToast(`${invalidDates.length} book(s) have invalid years. Please fix before importing.`);
    return;
  }

  // GUEST / DEMO MODE IMPORT
  if (this.isDemoMode || !this.userId) {
    const btn = document.getElementById('importConfirmBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Importing...'; }

    const guestBooks = toImport.map((b, idx) => {
      const status = b.status || (b.currentlyReading ? 'reading' : 'finished');
      const yr = (status === 'to-read') ? (this.currentYear || new Date().getFullYear()) : (b.readYear || this.currentYear || new Date().getFullYear());
      return {
        id: 'guest-' + idx + '-' + Date.now(),
        title: b.title,
        author: b.author,
        coverUrl: b.coverUrl || '',
        cover: b.coverUrl || '',
        fallbackCover: '',
        genre: b.genre || 'General Fiction',
        pageCount: b.pages || 0,
        words: b.words || 80000,
        wordCountSource: b.wordCountSource || 'calculated',
        wordCountEstimated: b.wordCountEstimated,
        sentiment: b.sentiment || 'mixed',
        month: status === 'to-read' ? null : (b.month || 'January'),
        month_finished: status === 'to-read' ? null : (b.month || 'January'),
        year: parseInt(yr),
        readYear: parseInt(yr),
        days: status === 'to-read' ? null : (b.days || 5),
        days_to_read: status === 'to-read' ? null : (b.days || 5),
        review: b.review || '',
        status: status,
        currentlyReading: status === 'reading',
        currently_reading: status === 'reading',
        fiction: b.fiction,
        sortOrder: idx,
        format: b.format || 'physical',
        durationHours: b.durationHours || null
      };
    });

    this.allGuestBooks = guestBooks;
    this.toReadBooks = guestBooks.filter(b => b.status === 'to-read');
    this.crBooks = guestBooks.filter(b => b.status === 'reading');

    try {
      localStorage.setItem('notetoshelf_guest_books', JSON.stringify(guestBooks));
      localStorage.setItem('notetoshelf_is_guest', 'true');
    } catch (e) {}

    this.ownerDisplayName = 'My Study';
    this.displayName = 'My Study';
    this.isReadOnly = false;
    this.isGuestImport = true;

    const finishedBooks = guestBooks.filter(b => b.status !== 'to-read' && b.status !== 'dnf');
    const distinctYears = [...new Set(finishedBooks.map(b => b.readYear || b.year))].filter(y => y >= 1900 && y <= 2100).sort((a, b) => b - a);
    this.userYears = distinctYears.length ? distinctYears.map(y => ({ year: y })) : [{ year: this.currentYear || new Date().getFullYear() }];
    this.currentYear = distinctYears[0] || this.currentYear || new Date().getFullYear();

    const yrInp = document.getElementById('yearInput');
    if (yrInp) yrInp.value = this.currentYear;

    this.books = finishedBooks.filter(b => (b.readYear === this.currentYear || b.year === this.currentYear));

    this.closeModal('importModal');
    const toReadN = this.toReadBooks.length;
    const msg = toReadN > 0
      ? `✨ Successfully brought ${guestBooks.length} books into your study (${toReadN} added to your To-Read queue)!`
      : `✨ Successfully brought ${guestBooks.length} books into your study!`;
    this.showToast(msg);

    this.updateMastheadTitle();
    if (typeof this.render === 'function') this.render();
    if (typeof this.renderYearsList === 'function') this.renderYearsList();
    if (typeof this.showGuestImportBanner === 'function') this.showGuestImportBanner(guestBooks.length);
    if (btn) { btn.disabled = false; btn.textContent = 'Confirm Import'; }
    return;
  }

  const btn = document.getElementById('importConfirmBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Importing...'; }
  this._hideImportError();

  if (!isRetry || !this._importProgress) {
    this._importProgress = { totalAdded: 0, processedIndices: new Set(), shelfCache: {} };
  }

  const progress = this._importProgress;

  try {
    for (let i = 0; i < toImport.length; i++) {
      if (progress.processedIndices.has(i)) continue;
      const b = toImport[i];
      const bStatus = b.status || (b.currentlyReading ? 'reading' : 'finished');
      const isToRead = bStatus === 'to-read';
      const isReading = bStatus === 'reading' || (!b.status && b.currentlyReading);
      const yr = isToRead ? (this.currentYear || new Date().getFullYear()) : (b.readYear || this.currentYear || new Date().getFullYear());

      if (btn) btn.textContent = `Importing ${i + 1}/${toImport.length}...`;

      try {
        let shelf = progress.shelfCache[yr];
        if (!shelf) {
          shelf = await DB.getOrCreateShelf(this.userId, parseInt(yr));
          if (!shelf) {
            console.error('commitImport: Could not get/create shelf for year', yr);
            progress.processedIndices.add(i);
            continue;
          }
          progress.shelfCache[yr] = shelf;
        }

        let sortIdx;
        try {
          const existingBooks = await DB.getShelfBooks(shelf.id);
          sortIdx = existingBooks.length + progress.totalAdded;
        } catch (fetchErr) {
          sortIdx = progress.totalAdded;
        }

        const row = {
          shelf_id: shelf.id,
          user_id: this.userId,
          title: b.title,
          author: b.author,
          cover_url: b.coverUrl || '',
          genre: b.genre,
          page_count: b.pages || 0,
          pub_year: b.year || parseInt(yr),
          word_count: b.words,
          word_count_estimated: (typeof b.wordCountEstimated === 'boolean') ? b.wordCountEstimated : (b.wordCountSource !== 'provided' && b.wordCountSource !== 'user_override'),
          word_count_source: b.wordCountSource || 'calculated',
          sentiment: isToRead ? null : (b.sentiment || null),
          month_finished: isToRead ? null : b.month,
          days_to_read: isToRead ? null : b.days,
          review: b.review || '',
          status: bStatus,
          currently_reading: isReading,
          date_started: isReading ? new Date().toISOString().split('T')[0] : null,
          fiction: b.fiction,
          sort_order: sortIdx,
          format: b.format || 'physical',
          duration_hours: b.durationHours || null
        };

        const result = await DB.addBooks([row]);
        if (result && result.length) {
          progress.totalAdded += result.length;
          const inserted = typeof dbToBook === 'function' ? dbToBook(result[0]) : result[0];
          if (inserted && inserted.status === 'to-read') {
            if (!this.toReadBooks) this.toReadBooks = [];
            this.toReadBooks.push(inserted);
          }
        }
        progress.processedIndices.add(i);
      } catch (bookErr) {
        console.error(`commitImport: Error importing book ${i + 1} ("${b.title}"):`, bookErr);
        const friendlyMsg = `Failed to import "${b.title}" (book ${i + 1}/${toImport.length}): ${bookErr.message || 'Unknown error'}. ${progress.totalAdded} book(s) saved so far.`;
        this._showImportError(friendlyMsg);
        if (btn) { btn.disabled = false; btn.textContent = 'Confirm Import'; }
        return;
      }

      if (i < toImport.length - 1) {
        await new Promise(r => setTimeout(r, 300));
      }
    }

    this._importProgress = null;
    this.closeModal('importModal');
    const toReadAdded = toImport.filter(b => b.status === 'to-read').length;
    const toastMsg = toReadAdded > 0
      ? `🎉 Successfully imported ${toImport.length} books (${toReadAdded} added to your To-Read queue)!`
      : `🎉 Successfully imported ${toImport.length} books!`;
    this.showToast(toastMsg);
    await this.setYear(this.currentYear);
  } catch (err) {
    console.error('commitImport failed:', err);
    this._showImportError('An unexpected error occurred during import. Click Retry to continue.');
    if (btn) { btn.disabled = false; btn.textContent = 'Retry Import'; }
  }
}

export function _showImportError(msg) {
  let banner = document.getElementById('importErrorBanner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'importErrorBanner';
    banner.style.cssText = 'background:#fdf0f0;border:1px solid var(--dislike);border-radius:6px;padding:14px 18px;margin-top:12px;display:flex;align-items:center;justify-content:space-between;gap:12px;font-family:"DM Mono",monospace;font-size:12px;color:var(--dislike);line-height:1.5;z-index:100;';
    const confirmBar = document.querySelector('#importStep2 .import-confirm-bar');
    if (confirmBar) {
      confirmBar.parentNode.insertBefore(banner, confirmBar);
    } else {
      const step2 = document.querySelector('#importStep2');
      if (step2) step2.appendChild(banner);
    }
  }
  banner.innerHTML = '';
  const msgSpan = document.createElement('span');
  msgSpan.style.cssText = 'flex:1;';
  msgSpan.textContent = msg;
  const retryBtn = document.createElement('button');
  retryBtn.className = 'btn-primary';
  retryBtn.style.cssText = 'flex-shrink:0;padding:8px 18px;font-size:12px;cursor:pointer;';
  retryBtn.textContent = 'Retry';
  retryBtn.onclick = () => { if (typeof this.commitImport === 'function') this.commitImport(true); };
  banner.appendChild(msgSpan);
  banner.appendChild(retryBtn);
  banner.style.display = 'flex';
}

export function _hideImportError() {
  const banner = document.getElementById('importErrorBanner');
  if (banner) banner.style.display = 'none';
}

export const Search = {
  GoogleBooksRating,
  SeriesMetadataFetcher,
  DuplicateDetector,
  ScannerLoader,
  CameraScanner,
  WikidataAPI,
  GenderAPI,
  guessGenderFromName,
  getNationalitiesForAuthor,
  NationalizeAPI,
  WordCountAPI,
  _queryProxySearch,
  debounceSearch,
  searchBooks,
  guessGenre,
  parseSeriesFromTitle,
  selectSearchResult,
  useScanResult,
  showManualEntry,
  hideManualEntry,
  updateManualContinueState,
  _onManualISBNInput,
  _setManualISBNStatus,
  lookupManualISBN,
  submitManualEntry,
  _setManualFiction,
  _setAddWcEstimatedUI,
  onAddWordCountManual,
  calcAddWordsFromPages,
  applyAddPagesEstimate,
  setAddMode,
  selectAddStatus,
  stopScanner,
  scanTryOCR,
  scanRetry,
  scanUseAnyway,
  triggerScanUpload,
  handleScanFileInput,
  scanSwitchToManual,
  openGlobalSearch,
  debounceGlobalSearch,
  performGlobalSearch,
  openBookFromSearch,
  debounceCRSearch,
  _searchCRBooks,
  _selectCRResult,
  debounceClubPickSearch,
  searchBooksForClub,
  searchReaders,
  handleNetworkSearch,
  parseBulkText,
  handleCSVUpload,
  parseCSVString,
  parseCSVLine,
  showImportReview,
  updateImportCount,
  setImportBookStatus,
  commitImport,
  _showImportError,
  _hideImportError,
  cleanNorm,
  levenshteinDistance,
  isTypoOrVariant,
  findMatchingLibrarySeries,
  SERIES_ACRONYMS,
  fetchBookReleaseYears,
  groupSearchResultsIntoWorks,
  cleanEditionTitle
};

if (typeof window !== 'undefined') {
  window.cleanNorm = cleanNorm;
  window.levenshteinDistance = levenshteinDistance;
  window.isTypoOrVariant = isTypoOrVariant;
  window.findMatchingLibrarySeries = findMatchingLibrarySeries;
  window.SERIES_ACRONYMS = SERIES_ACRONYMS;
  window.fetchBookReleaseYears = fetchBookReleaseYears;
  window.groupSearchResultsIntoWorks = groupSearchResultsIntoWorks;
  window.cleanEditionTitle = cleanEditionTitle;
  if (window.App) {
    window.App.cleanNorm = cleanNorm;
    window.App.levenshteinDistance = levenshteinDistance;
    window.App.isTypoOrVariant = isTypoOrVariant;
    window.App.findMatchingLibrarySeries = findMatchingLibrarySeries;
    window.App.SERIES_ACRONYMS = SERIES_ACRONYMS;
    window.App.fetchBookReleaseYears = fetchBookReleaseYears;
    window.App.groupSearchResultsIntoWorks = groupSearchResultsIntoWorks;
    window.App.cleanEditionTitle = cleanEditionTitle;
  }
}

export default Search;

