import { renderBookmarkStrips } from './bookmarks.js';
import Stats from './stats.js';
/**
 * ShelfLife Bookshelf & Spine Visualizer Feature (src/features/bookshelf.js)
 * Encapsulates shelf rendering, dynamic spine generation, drag-and-drop reordering,
 * quarter and aggregate views, series shelves, TBR queue manager, currently reading modal,
 * book hub, context menus, and mood classification.
 */

import {
  ALL_MONTHS,
  DEMO_AUTHOR_GENDERS,
  MONTH_TO_QUARTER,
  QUARTER_MAP,
  COLORS,
  LABELS,
  SENT_ORDER,
  LANGUAGE_FLAGS,
  CROWN_SVG
} from '../utils/constants.js';

import {
  pagesToWords,
  percentileRange,
  sColor,
  bmTone,
  isWordCountEstimated
} from '../utils/math.js';

import {
  esc,
  showToast,
  openModal,
  closeModal,
  openPanel,
  closePanel,
  showTT,
  moveTT,
  hideTT,
  showChartTT,
  moveChartTT,
  hideChartTT,
  languageBadge
, initShelfScrolling, updateShelfScrollIndicators } from '../utils/dom.js';

import { DB, dbToBook, coverPlaceholder } from '../core/db.js';
import { DuplicateDetector, GoogleBooksRating, CameraScanner, WikidataAPI, NationalizeAPI, WordCountAPI, SeriesMetadataFetcher, guessGenderFromName, SERIES_ACRONYMS, cleanNorm, levenshteinDistance, isTypoOrVariant, findMatchingLibrarySeries } from './search.js';

// ==========================================
// 1. Mood Picker Helpers
// ==========================================

export function getSelectedMoods(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return [];
  const chips = container.querySelectorAll('.mood-chip.selected');
  return Array.from(chips).map(c => (c.dataset.mood || c.textContent).trim());
}

export function toggleMoodChip(el) {
  if (!el) return;
  el.classList.toggle('selected');
}

export function renderMoodPicker(containerId, selectedMoods = []) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const MOOD_LIST = [
    '✨ Inspiring', '😭 Emotional', '🤔 Reflective', '⚡ Fast-Paced',
    '🌙 Dark/Atmospheric', '🧠 Thought-Provoking', '😂 Funny',
    '❤️ Romantic', '🌿 Cozy/Wholesome', '🧗 Action-Packed'
  ];
  container.innerHTML = MOOD_LIST.map(m => {
    const isSel = selectedMoods.includes(m);
    return `<button type="button" class="mood-chip${isSel ? ' selected' : ''}" data-mood="${esc(m)}" onclick="App.toggleMoodChip(this)">${esc(m)}</button>`;
  }).join('');
}

// ==========================================
// 2. Shelf & Spine Rendering
// ==========================================

export function fmtK(n) {
  return n >= 1000000 ? (n / 1000000).toFixed(2) + 'M' : Math.round(n / 1000) + 'k';
}

export function fmtWpd(w, d) {
  return d ? Math.round(w / d).toLocaleString() : ' - ';
}

export function renderEmptyState(show) {
  const c = document.getElementById('emptyStateContainer');
  if (!c) return;
  if (!show) { c.style.display = 'none'; c.innerHTML = ''; return; }

  const year = this.currentYear;
  const otherYears = (this.userYears || [])
    .map(y => (typeof y === 'object' ? y.year : y))
    .filter(y => y && y !== year)
    .sort((a, b) => b - a);
  const isBrandNew = otherYears.length === 0;

  let title, text, actions;
  if (isBrandNew) {
    title = 'Your shelf is empty';
    text = 'Welcome to Note to Shelf — your personal reading record. Add the first book you read this year, or explore a sample shelf to see how it works.';
    actions = `<button class="btn-primary" onclick="App.openAddBookModalFromMenu()">📚 Add Your First Book</button>`;
  } else {
    const prev = otherYears[0];
    title = `No books in ${year} yet`;
    text = `You haven't logged any books for ${year}. Add one to get started, or revisit a previous year.`;
    actions = `
      <button class="btn-primary" onclick="App.openAddBookModalFromMenu()">📚 Add a Book</button>
      <button class="btn-secondary" onclick="App.setYear(parseInt('${prev}')||0)">⬅️ View ${prev}</button>
    `;
  }

  c.style.display = '';
  c.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">📚</div>
      <div class="empty-state-title">${title}</div>
      <div class="empty-state-text">${text}</div>
      <div class="empty-state-actions">${actions}</div>
    </div>`;
}

export function renderToReadShelf(toReadBooks) {
  const sec = document.getElementById('toReadSection');
  if (!sec) return;
  const list = (toReadBooks && toReadBooks.length)
    ? toReadBooks
    : (this.toReadBooks && this.toReadBooks.length)
      ? this.toReadBooks
      : (this.books || []).filter(b => b && b.status === 'to-read');

  if (!list || !list.length) {
    sec.style.display = 'block';
    sec.innerHTML = `<h3>⏳ To-Read</h3><div style="font-size:12px;color:var(--wood-light);padding:16px;background:rgba(61,43,31,0.02);border:1px dashed rgba(61,43,31,0.1);border-radius:6px;text-align:center;margin-top:10px;">Your to-read list is empty.</div>`;
    return;
  }
  sec.style.display = '';
  const canEdit = !this.isReadOnly && true;
  const cards = list.map(b => {
    const cover = b.coverUrl
      ? `<img loading="lazy" decoding="async" class="trc-cover" src="${b.coverUrl}" onerror="if(this&&this.style)this.style.display='none';">`
      : `<div class="trc-cover">📖</div>`;
    const lang = (b.language && b.language !== 'English') ? languageBadge(b.language) : '';
    const notes = b.toReadNotes ? `<div class="trc-notes" title="${esc(b.toReadNotes)}">${esc(b.toReadNotes)}</div>` : '';
    const actions = canEdit ? `<div class="trc-actions">
      <button class="trc-btn primary" style="background:rgba(59,130,246,0.15);color:#3b82f6;border-color:transparent;" onclick="App._markAsCurrentlyReading('${b.id}')" title="Mark as currently reading">📖 Reading</button>
      <button class="trc-btn" onclick="App.openEditModal(window.App._findBookById('${b.id}'))" title="Edit">✏️ Edit</button>
    </div>` : '';
    return `<div class="to-read-card">
      ${cover}
      <div class="trc-body">
        <div class="trc-title">${esc(b.title || 'Untitled')}</div>
        <div class="trc-author">${esc(b.author || 'Unknown')}${lang ? ' ' + lang : ''}</div>
        ${notes}
        ${actions}
      </div>
    </div>`;
  }).join('');

  sec.innerHTML = `<div class="to-read-head" style="display:flex;align-items:center;"><span style="font-size:20px;margin-right:6px;">🔖</span><span class="trh-title" style="flex:1;">To-Read List <span class="trh-count" style="margin-left:6px;font-weight:normal;opacity:0.8;">${list.length} book${list.length !== 1 ? 's' : ''}</span></span><button class="btn" style="padding:4px 10px;font-size:11px;" onclick="App.openTbrManager()">Manage Queue</button></div><div class="to-read-grid">${cards}</div>`;
}

export function renderCurrentlyReading(crBooks) {
  const crSection = document.getElementById('currentlyReadingSection');
  if (!crSection) return;
  if (!crBooks || !crBooks.length) {
    crSection.style.display = 'none';
    return;
  }
  crSection.style.display = 'flex';
  const crBooksContainer = document.getElementById('crBooks');
  if (!crBooksContainer) return;
  
  const canEdit = !this.isReadOnly && true;
  const cards = crBooks.map(b => {
    const cover = b.coverUrl
      ? `<img loading="lazy" decoding="async" class="trc-cover" src="${b.coverUrl}" onerror="if(this&&this.style)this.style.display='none';">`
      : `<div class="trc-cover">📖</div>`;
    const actions = canEdit ? `<div class="trc-actions">
      <button class="trc-btn primary" style="background:rgba(16,185,129,0.15);color:#10b981;border-color:transparent;" onclick="App.openFinishBookModal('${b.id}')" title="Mark as finished">✓ Finished</button>
      <button class="trc-btn" onclick="App.openEditModal(window.App._findBookById('${b.id}'))" title="Edit">✏️ Edit</button>
    </div>` : '';
    return `<div class="to-read-card" style="flex:1; min-width:260px; max-width:400px; border:2px solid rgba(200,144,24,0.3); background:rgba(200,144,24,0.03);">
      ${cover}
      <div class="trc-body">
        <div class="trc-title">${window.esc ? window.esc(b.title || 'Untitled') : (b.title || 'Untitled')}</div>
        <div class="trc-author">${window.esc ? window.esc(b.author || 'Unknown') : (b.author || 'Unknown')}</div>
        <div style="font-size:11px;color:rgba(200,144,24,0.9);font-weight:600;margin-top:6px;font-family:'DM Mono',monospace;letter-spacing:0.04em;">Started ${b.dateStarted ? b.dateStarted.substring(0,10) : 'Unknown'}</div>
        ${actions}
      </div>
    </div>`;
  }).join('');
  
  crBooksContainer.innerHTML = cards;
}

export async function markToReadFinished(bookId) {
  const idx = (this.books || []).findIndex(b => String(b.id) === String(bookId));
  if (idx === -1) return;
  const book = this.books[idx];
  book.status = 'finished';
  book.currentlyReading = false;
  const targetMonth = ALL_MONTHS[new Date().getMonth()];
  book.month = targetMonth;
  book.month_finished = targetMonth;
  book.dateFinished = new Date().toISOString().split('T')[0];
  book.date_finished = book.dateFinished;

  try {
    await DB.updateBook(book.id, {
      status: 'finished',
      currently_reading: false,
      month_finished: targetMonth,
      date_finished: book.dateFinished
    });
  } catch (e) { console.warn('markToReadFinished update failed:', e && e.message); }

  await this._placeBookAtEndOfMonth(bookId, targetMonth);
  this.render();
  this.showToast(`📖 Moved “${book.title}” to your shelf - add your rating!`);
  this.openEditModal(book);
}

export function _checkLaserUnlock(bookCount) {
  // Laser mode / easter egg unlocks
}

export function getBookReadYear(b) {
  if (!b || typeof b !== 'object') return null;

  // 1. Explicit readYear (camelCase or snake_case) or _shelfYear
  const explicitYear = (b.readYear !== undefined && b.readYear !== null && b.readYear !== '') ? b.readYear :
                       (b.read_year !== undefined && b.read_year !== null && b.read_year !== '') ? b.read_year :
                       (b._shelfYear !== undefined && b._shelfYear !== null && b._shelfYear !== '') ? b._shelfYear :
                       (b.originalReadYear !== undefined && b.originalReadYear !== null && b.originalReadYear !== '') ? b.originalReadYear :
                       (b.original_read_year !== undefined && b.original_read_year !== null && b.original_read_year !== '') ? b.original_read_year : null;
  if (explicitYear !== null) {
    const y = parseInt(explicitYear, 10);
    if (!isNaN(y) && y >= 1900 && y <= 2100) return y;
  }

  const parseDateToYear = (d) => {
    if (d === undefined || d === null || d === '') return null;
    if (typeof d === 'number') {
      if (d >= 1900 && d <= 2100) return d;
      if (d > 10000000000) {
        const y = new Date(d).getFullYear();
        if (y >= 1900 && y <= 2100) return y;
      }
      if (d >= 1000000000 && d < 10000000000) {
        const y = new Date(d * 1000).getFullYear();
        if (y >= 1900 && y <= 2100) return y;
      }
    }
    const match = String(d).match(/\b(19\d\d|20\d\d)\b/);
    if (match) return parseInt(match[1], 10);
    return null;
  };

  // 2. Finished date (dateFinished or date_finished)
  const yFinished = parseDateToYear(b.dateFinished || b.date_finished);
  if (yFinished !== null) return yFinished;

  // 3. Started date (dateStarted or date_started)
  const yStarted = parseDateToYear(b.dateStarted || b.date_started);
  if (yStarted !== null) return yStarted;

  // 4. Generic date field (e.g. "March 2024" or "2024-03")
  const yGeneric = parseDateToYear(b.date);
  if (yGeneric !== null) return yGeneric;

  // 5. Fallback to b.year (pub_year fallback if within reasonable reading year range)
  if (b.year !== undefined && b.year !== null && b.year !== '') {
    const y = parseInt(b.year, 10);
    if (!isNaN(y) && y >= 1900 && y <= 2100) return y;
  }
  if (b.pub_year !== undefined && b.pub_year !== null && b.pub_year !== '') {
    const y = parseInt(b.pub_year, 10);
    if (!isNaN(y) && y >= 1900 && y <= 2100) return y;
  }

  return null;
}

export function getBookMonth(b) {
  const curMonth = ALL_MONTHS[new Date().getMonth()];
  if (!b || typeof b !== 'object') return curMonth;
  const m = b.month || b.month_finished;
  if (m && typeof m === 'string' && ALL_MONTHS.includes(m)) return m;

  const parseDateToMonth = (d) => {
    if (d === undefined || d === null || d === '') return null;
    if (typeof d === 'number') {
      if (d > 10000000000) {
        const idx = new Date(d).getMonth();
        if (idx >= 0 && idx < 12) return ALL_MONTHS[idx];
      }
      if (d >= 1000000000 && d < 10000000000) {
        const idx = new Date(d * 1000).getMonth();
        if (idx >= 0 && idx < 12) return ALL_MONTHS[idx];
      }
    }
    const str = String(d);
    for (const mo of ALL_MONTHS) {
      if (new RegExp('\\b' + mo + '\\b', 'i').test(str)) return mo;
    }
    const isoMatch = str.match(/\b\d{4}-(\d{2})\b/);
    if (isoMatch) {
      const idx = parseInt(isoMatch[1], 10) - 1;
      if (idx >= 0 && idx < 12) return ALL_MONTHS[idx];
    }
    return null;
  };

  return parseDateToMonth(b.dateFinished || b.date_finished) ||
         parseDateToMonth(b.dateStarted || b.date_started) ||
         parseDateToMonth(b.date) ||
         curMonth;
}

export function render() {
  const loading = document.getElementById('loadingSkeleton');
  if (loading) loading.style.display = 'none';

  const CR_GROUP_NAME = '📖 Now Reading';
  const attachTT = (el, book, bookIdx) => {
    if (!el || !book) return;
    el.addEventListener('mouseenter', (e) => {
      const curApp = (typeof window !== 'undefined' && window.App) || this;
      if (curApp && (curApp.isEditMode || curApp._editMode || curApp._reorderMode)) return;
      if (typeof showTT === 'function') showTT(book, e);
    });
    el.addEventListener('mousemove', (e) => {
      const curApp = (typeof window !== 'undefined' && window.App) || this;
      if (curApp && (curApp.isEditMode || curApp._editMode || curApp._reorderMode)) return;
      if (typeof moveTT === 'function') moveTT(e);
    });
    el.addEventListener('mouseleave', () => { if (typeof hideTT === 'function') hideTT(); });
    el.addEventListener('click', (e) => {
      const curApp = (typeof window !== 'undefined' && window.App) || this;
      if (curApp && (curApp.isEditMode || curApp._editMode || curApp._reorderMode)) {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }
      openPanel(book);
    });
  };

  const isPastYear = String(this.currentYear) !== String(new Date().getFullYear());
  const shouldAggregate = Boolean(this.multiYearRange && this.multiYearRange !== 'single');
  const rawSrc = (this.multiYearRange && this.multiYearRange !== 'single') ? this.aggregateBooks : this.books;
  const _src = Array.isArray(rawSrc) ? rawSrc : [];
  const toReadBooks = (this.toReadBooks && this.toReadBooks.length) ? this.toReadBooks : _src.filter(b => b && b.status === 'to-read');
  let BOOKS = _src.filter(b => b && !(b.currentlyReading || b.status === 'reading') && b.status !== 'to-read');
  const crBooks = _src.filter(b => b && (b.currentlyReading || b.status === 'reading') && b.status !== 'to-read');
  let allBooks = _src.filter(b => b && b.status !== 'to-read');

  if (this.isReadOnly) {
    const targetYear = Number(this.currentYear);

    BOOKS = BOOKS.filter(b => {
      if (this.currentShelf && b.shelfId && b.shelfId === this.currentShelf.id) return true;
      const by = (b.readYear != null) ? Number(b.readYear) : ((b._shelfYear != null) ? Number(b._shelfYear) : getBookReadYear(b));
      return by === targetYear || !by;
    });
    allBooks = allBooks.filter(b => {
      if (this.currentShelf && b.shelfId && b.shelfId === this.currentShelf.id) return true;
      const by = (b.readYear != null) ? Number(b.readYear) : ((b._shelfYear != null) ? Number(b._shelfYear) : getBookReadYear(b));
      return by === targetYear || !by;
    });
  }

  BOOKS.forEach(b => {
    if (!b.month || !ALL_MONTHS.includes(b.month)) {
      b.month = getBookMonth(b);
    }
  });
  allBooks.forEach(b => {
    if (!b.month || !ALL_MONTHS.includes(b.month)) {
      b.month = getBookMonth(b);
    }
  });

  this._checkLaserUnlock(allBooks.length);

  // Old queue sections removed from below pace chart
  if (typeof this.renderCurrentlyReading === 'function') this.renderCurrentlyReading(crBooks);
  this.renderToReadShelf(toReadBooks);

  const annualEmpty = (allBooks.length === 0 && this.multiYearRange === 'single' && !this.isReadOnly);
  const annualContentEl = document.getElementById('annualContent');
  const paceMod = document.getElementById('paceLineModule');

  const statsTarget = (this && typeof this.renderCharts === 'function') ? this : ((typeof window !== 'undefined' && window.Stats) ? window.Stats : Stats);

  if (annualEmpty) {
    this.renderEmptyState(true);
    if (annualContentEl) annualContentEl.style.display = 'none';
    if (paceMod) paceMod.style.display = 'none';
    if (typeof statsTarget.renderCharts === 'function') statsTarget.renderCharts.call(this, [], { min: 0, max: 1 });
    if (typeof statsTarget.renderMastheadStats === 'function') statsTarget.renderMastheadStats.call(this, BOOKS);
    if (typeof statsTarget.renderSentimentStats === 'function') statsTarget.renderSentimentStats.call(this, BOOKS);
    return;
  }

  this.renderEmptyState(false);
  if (annualContentEl) annualContentEl.style.display = '';
  if (paceMod) paceMod.style.display = '';

  const dayStats = percentileRange(BOOKS.map(b => b.days), 5, 95);
  const dayScaleMin = Math.max(0, dayStats.min);
  const actualMaxDays = Math.max(...BOOKS.map(b => b.days), dayStats.max || 1);
  const dayScaleMax = Math.ceil(Math.max(dayScaleMin + 1, actualMaxDays) / 5) * 5;

  const TOP_PAD = 90;
  const SHELF_H = 540, USABLE_H = SHELF_H - 60;
  const MIN_BOOK_H = 186; // 15% taller minimum height (was 162)
  const MIN_W_WORDS = 20000, MAX_W_WORDS = Math.max(...BOOKS.map(b => b.words || 0), 20000);
  const MIN_W = 20, MAX_W = 68;
  const DAY2_H = 207; // Scaled proportionally 15% (was 180)
  const LOG2 = Math.log(2);
  const LOG_MAX = Math.log(Math.max(dayScaleMax, 3));

  function dayToHeight(dayVal) {
    if (dayVal <= 1) return MIN_BOOK_H;
    if (dayVal <= 2) return MIN_BOOK_H + (dayVal - 1) * (DAY2_H - MIN_BOOK_H);
    const logVal = Math.log(dayVal);
    const t = (logVal - LOG2) / Math.max(0.001, LOG_MAX - LOG2);
    return DAY2_H + Math.min(1, t) * (USABLE_H - DAY2_H);
  }

  function scaleH(days) { return Math.max(MIN_BOOK_H, Math.round(dayToHeight(days))); }
  function scaleW(words) {
    const w = Number(words) || 80000;
    if (w <= MIN_W_WORDS) return MIN_W;
    const anchorMax = Math.max(140000, Math.min(180000, MAX_W_WORDS));
    const t = Math.max(0, Math.min(1, (w - MIN_W_WORDS) / (anchorMax - MIN_W_WORDS)));
    const curved = Math.pow(t, 0.92);
    let px = MIN_W + curved * 40;
    if (w > anchorMax) {
      const overT = Math.min(1, (w - anchorMax) / 120000);
      px += overT * 8;
    }
    return Math.max(MIN_W, Math.min(MAX_W, Math.round(px)));
  }

  this._rawBooks = [...BOOKS];
  if (typeof window !== 'undefined' && window.App) window.App._rawBooks = [...BOOKS];
  let groupLabels, getGroup;
  if (shouldAggregate) {
    const byYear = {};
    BOOKS.forEach(b => {
      const y = String(b.readYear || b.year);
      if (!byYear[y]) byYear[y] = [];
      byYear[y].push(b);
    });

    const aggregatedBooks = [];
    groupLabels = Object.keys(byYear).sort((a, b) => Number(a) - Number(b));
    getGroup = (b) => String(b.year);

    groupLabels.forEach(y => {
      const books = byYear[y];
      if (books.length === 0) return;

      const avgDays = books.reduce((s, b) => s + (Number(b.days) || 0), 0) / books.length;
      const avgWords = books.reduce((s, b) => s + (Number(b.words) || 0), 0); // User requested total words for width

      const sentCounts = {love:0, like:0, mixed:0, dislike:0};
      books.forEach(b => {
        if (sentCounts[b.sentiment] !== undefined) sentCounts[b.sentiment]++;
      });
      let domSent = 'mixed';
      if (Object.keys(sentCounts).some(k => sentCounts[k] > 0)) {
         domSent = Object.keys(sentCounts).reduce((a, b) => sentCounts[a] > sentCounts[b] ? a : b);
      }

      aggregatedBooks.push({
        id: 'year-' + y,
        title: y,
        author: `${books.length} books`,
        days: avgDays,
        words: avgWords,
        sentiment: domSent,
        year: y,
        isAggregateYear: true,
        bookCount: books.length
      });
    });

    BOOKS = aggregatedBooks;
  } else if (this.quarterMode) {
    groupLabels = ['Q1', 'Q2', 'Q3', 'Q4'];
    getGroup = (b) => MONTH_TO_QUARTER[b.month] || 'Q1';
  } else {
    const usedMonths = [...new Set(BOOKS.map(b => b.month).filter(Boolean))];
    groupLabels = ALL_MONTHS.filter(m => usedMonths.includes(m));
    if (!groupLabels.length) groupLabels = [ALL_MONTHS[new Date().getMonth()]];
    getGroup = (b) => b.month;
  }

  const byGroup = {};
  groupLabels.forEach(g => { byGroup[g] = []; });
  BOOKS.forEach(b => {
    const g = getGroup(b);
    if (!byGroup[g]) byGroup[g] = [];
    byGroup[g].push(b);
  });

  if (crBooks.length && !this.isReadOnly) {
    groupLabels.push(CR_GROUP_NAME);
    byGroup[CR_GROUP_NAME] = crBooks.map(b => ({...b, _isCR: true}));
  }

  const booksRow = document.getElementById('booksRow');
  const shelfBack = document.getElementById('shelfBack');
  const shelfPlank = document.getElementById('shelfPlank');
  const yAxis = document.getElementById('yAxis');
  const shelfUnit = document.getElementById('shelfUnit');

  if (booksRow) booksRow.innerHTML = '';
  if (shelfBack) shelfBack.innerHTML = '';
  if (shelfPlank) shelfPlank.innerHTML = '';
  if (yAxis) yAxis.innerHTML = '';

  if (shelfUnit) {
    shelfUnit.querySelectorAll('.shelf-annotation-flag, #shelfArcOverlay, .shelf-arc-overlay, svg.shelf-arc-overlay, svg[style*="z-index:150"], .ann-path-halo, .ann-path, .ann-dot').forEach(e => e.remove());
    shelfUnit.style.minHeight = (SHELF_H + TOP_PAD + 48) + 'px';
    const isEdit = Boolean(this.isEditMode || this._editMode || this._reorderMode);
    shelfUnit.classList.toggle('edit-mode', isEdit);
    shelfUnit.classList.toggle('reorder-mode', isEdit);
  }
  const shelfWrapper = document.getElementById('desktopShelfWrapper');
  if (shelfWrapper) {
    shelfWrapper.classList.toggle('edit-mode', Boolean(this.isEditMode || this._editMode || this._reorderMode));
  }

  if (booksRow) {
    booksRow.style.height = (SHELF_H + TOP_PAD) + 'px';
    booksRow.style.alignItems = 'flex-end';
    booksRow.style.position = 'relative';
  }

  const tickVals = [1];
  const tickStep = actualMaxDays <= 6 ? 1 : actualMaxDays <= 15 ? 3 : actualMaxDays <= 30 ? 5 : 7;
  for (let d = tickStep; d <= actualMaxDays; d += tickStep) tickVals.push(d);
  if (tickVals.length === 0 || tickVals[tickVals.length - 1] !== Math.round(actualMaxDays)) tickVals.push(Math.round(actualMaxDays));
  const uniqueTicks = [...new Set(tickVals)].sort((a,b) => a-b);
  
  uniqueTicks.forEach(val => {
    const tick = document.createElement('div');
    tick.className = 'y-tick' + (val === 1 ? ' y-tick-1d' : '');
    const topPos = TOP_PAD + SHELF_H - scaleH(val);
    tick.style.cssText = `top:${topPos}px;transform:translateY(-50%);right:8px;`;
    tick.textContent = val + (val === 0 ? '' : 'd');
    if (yAxis) yAxis.appendChild(tick);

    if (val > 0) {
      const line = document.createElement('div');
      line.className = 'grid-line' + (val === 1 ? ' grid-line-1d' : '');
      line.style.top = (TOP_PAD + SHELF_H - scaleH(val)) + 'px';
      if (shelfBack) shelfBack.appendChild(line);
    }
  });

  let cumX = 14;
  const DESKTOP_MONTH_GAP = 14;
  const NOW_READING_DIVIDER_W = 24;
  const monthData = [];
  let quarterStats = { books: 0, words: 0 };
  const mWidths = {};
  let bookIdx = 0;
  const allShelfBooks = [];

   const CR_FIXED_DAYS = 5;

  let currentQuarterQ = null;

let currentQuarterWrapper = null;

let isFirstGroupInQuarter = false;


let byQuarter = {};

BOOKS.forEach(b => {

    let q = MONTH_TO_QUARTER[b.month];

    if (q) {

        if (!byQuarter[q]) byQuarter[q] = {count: 0, words: 0};

        byQuarter[q].count++;

        byQuarter[q].words += (b.words || 0);

    }

});


let hasPreviousGroup = false;

groupLabels.forEach((g,gi) => {

    const gBooks = byGroup[g] || [];

    if(!gBooks.length && !this.quarterMode) return;

    const isCRGroup = (g === CR_GROUP_NAME);

    const gQ = isCRGroup ? 'CR' : (MONTH_TO_QUARTER[g] || (g.startsWith('Q') ? g : 'Q_UNKN'));

    

    if (gQ !== currentQuarterQ) {

                // Vertical quarter ribbons removed to match horizontal monthly labels.

        currentQuarterQ = gQ;

        currentQuarterWrapper = document.createElement('div');

        currentQuarterWrapper.style.cssText = 'display:flex; align-items:flex-end; height:100%; position:relative; flex-shrink:0;';

        booksRow.appendChild(currentQuarterWrapper);

        quarterStats = { books: 0, words: 0 };

        isFirstGroupInQuarter = true;

    } else {

        isFirstGroupInQuarter = false;

    }


    if (hasPreviousGroup) {

        if (isCRGroup) {

            const divider = document.createElement('div');

            divider.className = 'now-reading-divider';

            divider.style.height = (SHELF_H + TOP_PAD) + 'px';

            currentQuarterWrapper.appendChild(divider);

        } else {

            const gap = document.createElement('div');

            gap.className = 'desktop-month-gap';

            gap.style.cssText = `width:${DESKTOP_MONTH_GAP}px;flex-shrink:0;`;

            currentQuarterWrapper.appendChild(gap);

        }

    }
    hasPreviousGroup = true;

mWidths[g] = 0;

 gBooks.forEach((book, li) => {

 const h = isCRGroup ? scaleH(CR_FIXED_DAYS) : scaleH(book.days);

 const w = scaleW(book.words);

 const c = sColor(book.sentiment || 'mixed', bookIdx);

 const fs = Math.max(14, Math.round(h * 0.048));

 const el = document.createElement('div');

 el.className = 'book' + (book._isCR ? ' currently-reading' : '');

 el.dataset.bookIdx = bookIdx;

 el.dataset.linkIdx = bookIdx;

 el.dataset.group = g;
 el.setAttribute('title', book.title);

 el.style.transformOrigin = 'bottom center';
 el.style.animation = `shelfBookIn 0.62s cubic-bezier(0.22,0.61,0.36,1) ${Math.min(bookIdx*42, 1600)}ms both`;
 el.style.animationPlayState = 'running';
 el.addEventListener('animationend', function() {
   this.style.animation = '';
   this.style.transformOrigin = '';
   this.style.opacity = '1';
 }, {once:true});

 const editBtn = (!this.isReadOnly && true) ? `<button class="book-edit-btn" onclick="event.stopPropagation();App.openEditModal(window.App._findBookById('${book.id}'))" title="Edit book">✏️</button>` : '';

 const isAudiobook = book.format === 'audiobook';

 const isEbook = book.format === 'ebook';

 const spineOpacity = isAudiobook ? 'opacity:0.85;' : isEbook ? 'opacity:0.88;' : '';

 const formatBadge = isAudiobook ? '<span class="audiobook-badge" role="img" aria-label="Audiobook format" title="Audiobook">🎧</span>' : isEbook ? '<span class="ebook-badge" role="img" aria-label="E-book format" title="E-book">📱</span>' : '';

 const wcSource = WordCountAPI.getSource(book);

 const isWcUnknown = (wcSource === 'unknown') && true;

 const wcUnknownBadge = '';

 if (isWcUnknown) el.classList.add('wc-unresolved');

 const dnfBadge = book.dnf ? '<span class="dnf-badge" title="Did Not Finish" style="position:absolute;top:2px;left:2px;z-index:10;font-size:8px;padding:1px 4px;border-radius:3px;background:rgba(140,26,40,0.85);color:var(--text-primary);font-family:\'DM Mono\',monospace;letter-spacing:0.06em;text-transform:uppercase;line-height:1.3;">DNF</span>' : '';

 const rereadBadge = book.isReread ? '<span class="reread-badge" title="Re-read" role="img" aria-label="Re-read">🔁</span>' : '';

 const isBookOfYear = book.bookOfYear && Number(book.bookOfYear) === Number(this.currentYear);

  const crownBadge = isBookOfYear ? `<span class="spine-crown" role="img" aria-label="Book of the Year ${this.currentYear}" title="👑 Book of the Year ${this.currentYear}">👑</span>` : '';

 const _lang = book.language || 'English';

 const langBadge = (_lang && _lang !== 'English') ? `<span class="spine-lang-badge" title="Read in ${_lang}">${(LANGUAGE_FLAGS && LANGUAGE_FLAGS[_lang]) || '🌐'}</span>` : '';

 const privateBadge = book.isPrivate ? '<span class="spine-private-lock" title="Private  -  hidden from followers" role="img" aria-label="Private">🔒</span>' : '';

 el.setAttribute('role', 'button');

 el.setAttribute('aria-label', `${book.title} by ${book.author}${isCRGroup ? ', currently reading' : ', ' + (LABELS[book.sentiment] || book.sentiment)}${isAudiobook ? ', audiobook' : isEbook ? ', e-book' : ''}${book.dnf ? ', did not finish' : ''}${book.isReread ? ', re-read' : ''}`);

 el.setAttribute('tabindex', '0');

  const sentColors = { love: '#1c3f78', like: '#1e5c3a', mixed: '#c89018', dislike: '#8c1a28' };
  const sentBandColor = sentColors[book.sentiment] || c;
  const sentLabel = (typeof LABELS !== 'undefined' && LABELS[book.sentiment]) || book.sentiment || 'Sentiment';
  const useSpineArt = (typeof localStorage !== 'undefined') ? (localStorage.getItem('shelf_spine_art') === 'true') : false;
  const coverImg = book.coverUrl || book.cover || '';
  const hasCoverArt = useSpineArt && Boolean(coverImg);
  const safeCoverUrl = hasCoverArt ? String(coverImg).replace(/"/g, '&quot;') : '';
  const spineClass = hasCoverArt ? 'spine has-cover-art' : 'spine';
  const spineBg = hasCoverArt
    ? `background-image:url(&quot;${safeCoverUrl}&quot;);background-size:cover;background-position:center;background-color:${c};`
    : `background:linear-gradient(168deg,${c}e0 0%,${c} 45%,${c}a8 100%);`;

  const readersBadge = book._countReaders > 0 ? `<span class="readers-badge" title="${book._countReaders} members read this" style="position:absolute;bottom:35px;left:50%;transform:translateX(-50%);font-size:10px;background:rgba(255,255,255,0.2);color:#fff;border-radius:10px;padding:2px 6px;font-family:'DM Mono',monospace;z-index:5;">👥 ${book._countReaders}</span>` : '';
 
 const dragHandle = (!this.isReadOnly && !book.isAggregateYear && !isCRGroup) ? `<div class="drag-handle spine-drag-handle" draggable="true" data-book-id="${book.id}" title="Drag to reorder" aria-label="Drag to reorder"><span class="drag-handle-icon">⠿</span></div>` : '';
 const innerHTMLStr = `${editBtn}${crownBadge}${dnfBadge}${rereadBadge}${dragHandle}<div class="${spineClass}" style="height:${h}px;width:${w}px;${spineOpacity}${spineBg}">${privateBadge}${formatBadge}${wcUnknownBadge}<div class="spine-top-band" style="background:${sentBandColor};" title="Sentiment: ${sentLabel}"></div>${langBadge}${readersBadge}<div class="spine-inner"><span class="spine-title" style="font-size:${fs}px;">${book.title}</span></div></div>`;
 el.style.width = w + 'px';
 el.style.height = h + 'px';
 const vid = book.id + '_' + bookIdx;
 el.dataset.vid = vid;
 el.innerHTML = innerHTMLStr;
 attachTT(el, book, bookIdx);
 this.setupDrag(el, book.id);
 (currentQuarterWrapper || booksRow).appendChild(el);


 mWidths[g] = (mWidths[g]||0) + w;

 allShelfBooks.push({...book, _shelfIdx: bookIdx});

 bookIdx++;

 });

 }); // end of first groupLabels.forEach

  cumX = 14;
  groupLabels.forEach((g, idx) => {
    const gBooks = byGroup[g] || [];
    const mw = mWidths[g] || 0;
    const isCRGroup = (g === CR_GROUP_NAME);
    if (!mw && !this.quarterMode && !isCRGroup) return;

    if (idx > 0 && mWidths[groupLabels[idx-1]]) {
      if (isCRGroup) { 
        cumX -= DESKTOP_MONTH_GAP; 
        cumX += NOW_READING_DIVIDER_W;
        const crDiv = document.createElement('div');
        crDiv.className = 'month-divider';
        crDiv.style.left = (cumX - NOW_READING_DIVIDER_W/2) + 'px';
        shelfBack.appendChild(crDiv);
        const crPd = document.createElement('div');
        crPd.style.cssText = `position:absolute;left:${cumX-NOW_READING_DIVIDER_W/2}px;top:0;bottom:0;width:1px;background:rgba(255,255,255,0.15);z-index:3;`;
        shelfPlank.appendChild(crPd);
      } else {
        const div = document.createElement('div');
        div.className = 'month-divider';
        div.style.left = (cumX - DESKTOP_MONTH_GAP/2) + 'px';
        shelfBack.appendChild(div);
        const pd = document.createElement('div');
        pd.style.cssText = `position:absolute;left:${cumX-DESKTOP_MONTH_GAP/2}px;top:0;bottom:0;width:1px;background:rgba(255,255,255,0.15);z-index:3;`;
        shelfPlank.appendChild(pd);
      }
    }

    const isAggView = shouldAggregate;
    const lbl = document.createElement('div');
    lbl.className = 'plank-label';
    lbl.style.left = cumX + 'px';
    if (isCRGroup) {
      lbl.innerHTML = `<span class="plank-label-name">Now Reading</span><span class="plank-label-sub">${gBooks.length}</span>`;
      shelfPlank.appendChild(lbl);
    } else {
      const shortName = this.quarterMode ? g : (g.length > 3 ? g.substring(0,3) : g);
      lbl.innerHTML = `<span class="plank-label-name">${shortName}</span>`;
      if (!isAggView) {
        shelfPlank.appendChild(lbl);
      }
    }

    if (!isCRGroup) {
      const gWords = gBooks.reduce((s,b) => s+(Number(b.words)||0), 0);
      monthData.push({group:g, words:gWords, books:gBooks.length, bookList:gBooks, x:cumX, w:mw, lblEl:lbl});
    }

    cumX += mw + (idx < groupLabels.length-1 ? (isCRGroup ? 0 : DESKTOP_MONTH_GAP) : 0);
  });

  const endSpacer = document.createElement('div');

 endSpacer.style.cssText = 'width:120px;flex-shrink:0;';

 booksRow.appendChild(endSpacer);

 const _playShelf = (el, isIntersecting) => {
    const books = booksRow.querySelectorAll('.book');
    if (isIntersecting) {
        books.forEach(b => { b.style.animationPlayState = 'running'; });
    }
};

 if (window.revealOnScroll) { window.revealOnScroll(booksRow, _playShelf, 0.05); }


  const _isAggView = shouldAggregate;
  if (typeof renderBookmarkStrips === 'function' && !_isAggView) {
    renderBookmarkStrips(monthData, BOOKS, this.quarterMode);
  }
  if (typeof this.renderAnnotations === 'function') {
    this.renderAnnotations(BOOKS, allShelfBooks, shelfUnit, shelfBack, SHELF_H, TOP_PAD);
  }

  if (typeof statsTarget.renderMastheadStats === 'function') statsTarget.renderMastheadStats.call(this, BOOKS);
  if (typeof statsTarget.renderHomeQuickStats === 'function') statsTarget.renderHomeQuickStats.call(this, BOOKS);
  if (typeof statsTarget.renderPaceLine === 'function') statsTarget.renderPaceLine.call(this, BOOKS);
  if (typeof statsTarget.renderSentimentStats === 'function') statsTarget.renderSentimentStats.call(this, BOOKS);
  if (typeof statsTarget.renderCharts === 'function') statsTarget.renderCharts.call(this, BOOKS, { min: dayScaleMin, max: dayScaleMax });
  if (typeof statsTarget.renderClosingStrip === 'function') statsTarget.renderClosingStrip.call(this, BOOKS);
  if (typeof updateShelfScrollIndicators === 'function') updateShelfScrollIndicators();
  else if (typeof window !== 'undefined' && window.App && typeof window.App.updateShelfScrollIndicators === 'function') window.App.updateShelfScrollIndicators();
}

export function renderAnnotations(BOOKS, shelfBooks, shelfUnit, shelfBack, SHELF_H, TOP_PAD) {
  if (shelfUnit) {
    shelfUnit.querySelectorAll('#shelfArcOverlay, .shelf-arc-overlay, svg.shelf-arc-overlay, svg[style*="z-index:150"]').forEach(el => el.remove());
  }

 if(!BOOKS.length || BOOKS.length < 3) return;

 const annotations = [];

 const monthCounts = {};

 BOOKS.forEach(b => { monthCounts[b.month] = (monthCounts[b.month]||0)+1; });

 const monthEntries = Object.entries(monthCounts).sort((a,b)=>b[1]-a[1]);

 if(monthEntries.length) {

 const [bMonth, bCount] = monthEntries[0];

 const anchor = BOOKS.find(b=>b.month===bMonth);

 if(anchor) annotations.push({title:'📚 Busiest Month', sub:bCount+' books in '+bMonth, bookTitle:anchor.title, month:bMonth, priority:1});

 }

 const byWords = [...BOOKS].sort((a,b)=>b.words-a.words);

 if(byWords[0]) {

 const wk = ( byWords[0].words >= 1000000 ? (byWords[0].words/1000000).toFixed(1)+'M' : Math.round(byWords[0].words/1000)+'k' ) + ' words';

 annotations.push({title:'📖 Longest Book', sub:wk, bookTitle:byWords[0].title, month:byWords[0].month, priority:2});

 }

 const byWordsAsc = [...BOOKS].sort((a,b)=>a.words-b.words);

 if(byWordsAsc.length > 1 && byWordsAsc[0].words < byWordsAsc[byWordsAsc.length-1].words) {

 const sb = byWordsAsc[0];

 const wk = ( sb.words >= 1000000 ? (sb.words/1000000).toFixed(1)+'M' : Math.round(sb.words/1000)+'k' ) + ' words';

 annotations.push({title:'📝 Shortest Book', sub:wk, bookTitle:sb.title, month:sb.month, priority:3});

 }

 const fullBooks = BOOKS.filter(b => b.days > 0 && b.words >= 50000);

 if(fullBooks.length) {

 const fastest = fullBooks.reduce((a,b)=>b.days < a.days ? b : a);

 annotations.push({title:'⚡ Fastest Read', sub:fastest.days+' day'+(fastest.days!==1?'s':''), bookTitle:fastest.title, month:fastest.month, priority:6});

 }

 const withDays = BOOKS.filter(b=>b.days>0);

 if(withDays.length>1) {

 const slowest = withDays.reduce((a,b)=>b.days>a.days?b:a);

 annotations.push({title:'🐢 Slowest Read', sub:slowest.days+' days', bookTitle:slowest.title, month:slowest.month, priority:5});

 }

 const speedReads = BOOKS.filter(b => b.days > 0 && b.days <= 2 && b.words >= 80000);

 if(speedReads.length) {

 const sr = speedReads.reduce((a,b) => b.words > a.words ? b : a);

 const srK = Math.round(sr.words/1000) + 'k';

 annotations.push({title:'🚀 Speed Reader', sub:srK+' words in '+sr.days+'d', bookTitle:sr.title, month:sr.month, priority:4});

 }

 const miniBooks = BOOKS.filter(b => b.words < 40000);

 if(miniBooks.length) {

 const mini = miniBooks[0];

 const miniPages = mini.pageCount || Math.round(mini.words/300);

 annotations.push({title:'✨ Mini Marvel', sub:this.fmtK(mini.words)+' words', bookTitle:mini.title, month:mini.month, priority:7});

 }

 const monthGroups = {};

 BOOKS.forEach(b => { if(!monthGroups[b.month]) monthGroups[b.month]=[]; monthGroups[b.month].push(b); });

 Object.entries(monthGroups).forEach(([m, books]) => {

 if(books.length >= 2) {

 for(let i=0;i<books.length-1;i++){

 if(books[i].days === books[i+1].days && books[i].days > 0) {

 annotations.push({title:' ✨ Double Feature', sub:'2 books, same pace in '+m, bookTitle:books[i].title, bookTitle2:books[i+1].title, month:m, priority:8});

 break;

 }

 }

 }

 });

 for(let i=0; i<BOOKS.length-2; i++) {

 if(BOOKS[i].genre && BOOKS[i].genre === BOOKS[i+1].genre && BOOKS[i].genre === BOOKS[i+2].genre) {

 let streakLen = 3;

 while(i+streakLen < BOOKS.length && BOOKS[i+streakLen].genre === BOOKS[i].genre) streakLen++;

 annotations.push({title:'🔥 Genre Streak', sub:streakLen+' '+BOOKS[i].genre+' in a row', bookTitle:BOOKS[i+1].title, month:BOOKS[i+1].month, priority:9});

 break;

 }

 }

 const authorCounts = {};

 BOOKS.forEach(b => { authorCounts[b.author] = (authorCounts[b.author]||0)+1; });

 const repeatAuthors = Object.entries(authorCounts).filter(([a,c]) => c >= 2).sort((a,b)=>b[1]-a[1]);

 if(repeatAuthors.length) {

 const [repAuthor, repCount] = repeatAuthors[0];

 const repBook = BOOKS.find(b=>b.author===repAuthor);

 if(repBook) annotations.push({title:'🔄 Author Repeat', sub:repAuthor.split(' ').pop()+' ×'+repCount, bookTitle:repBook.title, month:repBook.month, priority:10});

 }

 const ebooks = BOOKS.filter(b=>b.format==='ebook');

 if(ebooks.length) {

 const longest = ebooks.reduce((a,b)=> (b.words||0) > (a.words||0) ? b : a);

 const lWords = longest.words || 0;

 annotations.push({title:'📱 Screen Time', sub:lWords.toLocaleString()+' words', bookTitle:longest.title, month:longest.month, priority:11});

 }

 const audiobooks = BOOKS.filter(b=>b.format==='audiobook' && b.durationHours>0);

 if(audiobooks.length) {

 const longest = audiobooks.reduce((a,b)=> b.durationHours>a.durationHours?b:a);

 const hrs = Math.floor(longest.durationHours);

 const mins = Math.round((longest.durationHours - hrs)*60);

 annotations.push({title:'🎧 Audio Marathon', sub:hrs+'h '+mins+'m', bookTitle:longest.title, month:longest.month, priority:12});

 }

 const firstReread = BOOKS.find(b => b.isReread);

 if (firstReread) {

 annotations.push({title:'🔁 Re-read', sub:'revisiting a favourite', bookTitle:firstReread.title, month:firstReread.month, priority:13});

 }

 
 // New Annotations Brainstormed
   
   const withYear = BOOKS.filter(b => b.publicationYear && !isNaN(b.publicationYear));
   if (withYear.length > 0) {
      const oldest = withYear.reduce((a,b) => Number(b.publicationYear) < Number(a.publicationYear) ? b : a);
      annotations.push({title:'📜 The Antiquarian', sub:'Published '+oldest.publicationYear, bookTitle:oldest.title, month:oldest.month, priority:14});
      
      const currYear = new Date().getFullYear();
      const newest = withYear.find(b => Number(b.publicationYear) === currYear);
      if (newest) {
         annotations.push({title:'🔥 Hot Off the Press', sub:'Published '+currYear, bookTitle:newest.title, month:newest.month, priority:15});
      }
   }
  
   const weekend = BOOKS.find(b => b.days === 2 || b.days === 3);
   if (weekend) {
      annotations.push({title:'⚔️ Weekend Warrior', sub:'Devoured in '+weekend.days+' days', bookTitle:weekend.title, month:weekend.month, priority:16});
   }
  
   const everest = BOOKS.find(b => b.words >= 200000 && b.days >= 30);
   if (everest) {
      annotations.push({title:'🏔️ The Everest', sub:'A long journey', bookTitle:everest.title, month:everest.month, priority:17});
   }
  
   const coaster = BOOKS.find(b => b.words >= 150000 && b.days <= 5 && b.days > 0);
   if (coaster) {
      annotations.push({title:'🌪️ Page Turner', sub:'Massive book, read fast', bookTitle:coaster.title, month:coaster.month, priority:18});
   }
  
   const slog = BOOKS.find(b => b.words > 0 && b.words <= 70000 && b.days >= 21);
   if (slog) {
      annotations.push({title:'🐌 The Slog', sub:'Took its time', bookTitle:slog.title, month:slog.month, priority:19});
   }
  
   const gem = BOOKS.find(b => b.rating >= 4.5 && b.days <= 7);
   if (gem) {
      annotations.push({title:'💎 First Gem', sub:'Started strong', bookTitle:gem.title, month:gem.month, priority:20});
   }
  
   const wildcard = BOOKS.find(b => b.genre && BOOKS.filter(x=>x.genre===b.genre).length === 1);
   if (wildcard) {
      annotations.push({title:'🃏 The Wildcard', sub:'Only '+wildcard.genre, bookTitle:wildcard.title, month:wildcard.month, priority:21});
   }
  
   const saddleBook = BOOKS.find((b, i) => i > 0 && BOOKS[i-1].dnf && !b.dnf);
   if (saddleBook) {
      annotations.push({title:'🐎 Back in the Saddle', sub:'Broke the DNF streak', bookTitle:saddleBook.title, month:saddleBook.month, priority:22});
   }
  
   const bingeBook = BOOKS.find(b => b.seriesName && BOOKS.filter(x=>x.seriesName===b.seriesName).length >= 3);
   if (bingeBook) {
      annotations.push({title:'📚 Series Binge', sub:'3+ '+bingeBook.seriesName, bookTitle:bingeBook.title, month:bingeBook.month, priority:23});
   }

   annotations.sort(() => Math.random() - 0.5);

 const seenBooks = new Set();

 const deduped = [];

 for(const ann of annotations) {

 if(!seenBooks.has(ann.bookTitle)) {

 seenBooks.add(ann.bookTitle);

 deduped.push(ann);

 }

 }

 const maxAnnotations = Math.max(4, Math.min(15, Math.floor(Math.sqrt(shelfBooks.length) * 1.5)));

 const finalAnns = deduped.slice(0, maxAnnotations).sort((a,b) => { const iA = shelfBooks.findIndex(bk => bk.title === a.bookTitle); const iB = shelfBooks.findIndex(bk => bk.title === b.bookTitle); return iA - iB; });

 window._BOOK_ANNOTATIONS = {};

 console.log("FINAL ANNS LENGTH:", finalAnns.length);
   finalAnns.forEach(ann => {

 if(!window._BOOK_ANNOTATIONS[ann.bookTitle]) window._BOOK_ANNOTATIONS[ann.bookTitle] = [];

 window._BOOK_ANNOTATIONS[ann.bookTitle].push({title:ann.title, sub:ann.sub});

 });

 const bookEls = shelfUnit.querySelectorAll('.book[data-book-idx]');

 const shelfRect = shelfUnit.getBoundingClientRect();

 const bookPositions = {};

 const bookPositionsByIdx = [];

     // OPTIMIZATION: Batched reads and writes to completely eliminate O(N^2) layout thrashing.
  const tempStates = [];
  // 1. Batch Writes: Disable animations
  shelfBooks.forEach((b, idx) => {
    const el = bookEls[idx];
    if(!el) {
      tempStates[idx] = null;
      return;
    }
    tempStates[idx] = {
      pa: el.style.animation,
      pt: el.style.transform,
      ps: el.style.animationPlayState
    };
    el.style.animation = 'none';
    el.style.transform = 'none';
  });

  // 2. Batch Reads: Force exactly ONE layout reflow and measure all spines instantly
  shelfBooks.forEach((b, idx) => {
    const el = bookEls[idx];
    if(!el) return;
    tempStates[idx].rect = el.getBoundingClientRect();
  });

  // 3. Batch Writes: Restore animations and calculate logical positions
  shelfBooks.forEach((b, idx) => {
    const el = bookEls[idx];
    if(!el) return;
    const state = tempStates[idx];
    el.style.animation = state.pa;
    el.style.animationPlayState = state.ps;
    el.style.transform = state.pt;
    const r = state.rect;
    const pos = {
      cx: r.left - shelfRect.left + r.width / 2,
      topY: r.top - shelfRect.top,
      left: r.left - shelfRect.left,
      right: r.left - shelfRect.left + r.width
    };
    bookPositions[b.title] = pos;
    bookPositionsByIdx[idx] = pos;
  });

 const usedPositions = [];

 const SW = shelfUnit.scrollWidth || shelfUnit.offsetWidth;

 const FLAG_W = 145;

 const FLAG_H_APPROX = 90;

 const FLAG_SPACING = 10;

 const FLAG_MIN_X = 12;

 const FLAG_MAX_X = SW - FLAG_W - 16;

 const FLAG_TOP_ROW1 = 12;

 const svgNS = 'http://www.w3.org/2000/svg';

 const arcOverlay = document.createElementNS(svgNS, 'svg');

 arcOverlay.id = 'shelfArcOverlay';

 arcOverlay.classList.add('shelf-arc-overlay');

 arcOverlay.setAttribute('width', SW + 'px');

 arcOverlay.setAttribute('height', (SHELF_H + TOP_PAD) + 'px');

 arcOverlay.setAttribute('viewBox', `0 0 ${SW} ${SHELF_H + TOP_PAD}`);

 arcOverlay.style.cssText = `position:absolute;left:0;top:0;width:${SW}px;height:${SHELF_H + TOP_PAD}px;pointer-events:none;z-index:150;overflow:visible;`;

 const flagData = [];

 function checkOverlap(left, top, w, h) {

 for(const u of usedPositions) {

 if(left < u.left + u.width + 10 && left + w + 10 > u.left &&

 top < u.top + u.height + 4 && top + h + 4 > u.top) return true;

 }

 return false;

 }


   finalAnns.forEach(ann => {
      const bookIdx = shelfBooks.findIndex(b => b.title === ann.bookTitle);
      if(bookIdx < 0) return;
      const bookEl = bookEls[bookIdx];
      if(!bookEl) return;
      const bookRect = bookEl.getBoundingClientRect();
      ann._idealLeft = bookRect.left - shelfRect.left - 10;
      if (ann.title.indexOf('Busiest Month') !== -1) {
         const mBooks = BOOKS.filter(b => b.month === ann.month);
         const positions = mBooks.map(b => bookPositions[b.title]).filter(v => v !== undefined);
         if (positions.length) {
            const monthCenter = (Math.min(...positions.map(p=>p.cx)) + Math.max(...positions.map(p=>p.cx))) / 2;
            ann._idealLeft = monthCenter - FLAG_W / 2;
         }
      }
      ann._bookIdx = bookIdx;
   });

   // Strict left-to-right sorting to guarantee lines never cross
   // ---------------------------------------------------------
     // ADVANCED COLLISION & LEADER-LINE PHYSICS ENGINE
     // ---------------------------------------------------------
     function ccw(A, B, C) { return (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x); }
     function segIntersect(A, B, C, D) { return ccw(A, C, D) !== ccw(B, C, D) && ccw(A, B, C) !== ccw(A, B, D); }
     function segmentIntersectsRect(A, B, rx, ry, rw, rh) {
        const TL = {x:rx, y:ry}, TR = {x:rx+rw, y:ry}, BR = {x:rx+rw, y:ry+rh}, BL = {x:rx, y:ry+rh};
        return segIntersect(A,B, TL,TR) || segIntersect(A,B, TR,BR) || segIntersect(A,B, BR,BL) || segIntersect(A,B, BL,TL);
     }
     function getBezierPoints(sx, sy, ex, ey) {
        const _dx = ex - sx; const bow = Math.max(15, Math.abs(_dx * 0.2)) * Math.sign(_dx || 1);
        const _cy1 = sy + (ey - sy) * 0.3; const _cy2 = sy + (ey - sy) * 0.7;
        const pts = [];
        for(let t=0; t<=1.0; t+=0.1) {
            const u = 1-t; const tt = t*t, uu = u*u; const uuu = uu*u, ttt = tt*t;
            const x = uuu*sx + 3*uu*t*(sx+bow) + 3*u*tt*(ex-bow) + ttt*ex;
            const y = uuu*sy + 3*uu*t*_cy1 + 3*u*tt*_cy2 + ttt*ey;
            pts.push({x,y});
        }
        return pts;
     }

     finalAnns.sort((a,b) => (a._idealLeft || 0) - (b._idealLeft || 0));
     
     const placedLabels = []; // {left, top, pts}
     
     finalAnns.forEach(ann => {
        if (ann._bookIdx === undefined) return;
        const bookIdx = ann._bookIdx;
        const bookIdx2 = ann.bookTitle2 ? shelfBooks.findIndex(b => b.title === ann.bookTitle2) : -1;
        
        let idealLeft = Math.max(FLAG_MIN_X, Math.min(ann._idealLeft, FLAG_MAX_X));
        const bp = bookPositionsByIdx[bookIdx];
        if(!bp) return;

        let bestLeft = idealLeft;
        let bestTop = FLAG_TOP_ROW1;
        let placed = false;
        
        // Scan up to 8 rows, and for each row scan all possible X coordinates
        for (let row = 0; row < 8; row++) {
           let top = FLAG_TOP_ROW1 + row * (FLAG_H_APPROX + 8);
           let rowBestX = -1;
           let minPenalty = Infinity;
           
           for (let x = FLAG_MIN_X; x <= FLAG_MAX_X; x += 10) {
               // 1. Check label overlap with other labels
               let overlapsLabel = placedLabels.some(p => 
                   x < p.left + FLAG_W + 10 && x + FLAG_W + 10 > p.left &&
                   top < p.top + FLAG_H_APPROX + 4 && top + FLAG_H_APPROX + 4 > p.top
               );
               if (overlapsLabel) continue;

               // Compute my proposed leader line
               const flagBottomY = top + FLAG_H_APPROX;
               const sx = Math.abs((x) - bp.cx) < Math.abs((x + FLAG_W) - bp.cx) ? x + 8 : x + FLAG_W - 8;
               const sy = flagBottomY;
               const ex = bp.cx;
               const ey = bp.topY + 2;
               const myLine = getBezierPoints(sx, sy, ex, ey);

               let valid = true;
               for (let p of placedLabels) {
                   // 2. My line intersects their label?
                   let myLineHitsTheirLabel = false;
                   for (let i=0; i<myLine.length-1; i++) {
                       if (segmentIntersectsRect(myLine[i], myLine[i+1], p.left-4, p.top-4, FLAG_W+8, FLAG_H_APPROX+8)) {
                           myLineHitsTheirLabel = true; break;
                       }
                   }
                   // 3. Their line intersects my label?
                   let theirLineHitsMyLabel = false;
                   for (let i=0; i<p.line.length-1; i++) {
                       if (segmentIntersectsRect(p.line[i], p.line[i+1], x-4, top-4, FLAG_W+8, FLAG_H_APPROX+8)) {
                           theirLineHitsMyLabel = true; break;
                       }
                   }
                   // 4. Lines cross?
                   let linesCross = false;
                   for(let i=0; i<myLine.length-1; i++) {
                       for(let j=0; j<p.line.length-1; j++) {
                           if (segIntersect(myLine[i], myLine[i+1], p.line[j], p.line[j+1])) {
                               linesCross = true; break;
                           }
                       }
                       if(linesCross) break;
                   }
                   
                   if (myLineHitsTheirLabel || theirLineHitsMyLabel || linesCross) {
                       valid = false;
                       break;
                   }
               }
               
               if (valid) {
                   let penalty = Math.abs(x - idealLeft);
                   if (penalty < minPenalty) {
                       minPenalty = penalty;
                       rowBestX = x;
                       if (penalty === 0) break; // perfect match
                   }
               }
           }
           
           if (rowBestX !== -1) {
               bestLeft = rowBestX;
               bestTop = top;
               placed = true;
               break;
           }
        }
        
        // If it totally failed (very rare), just stack it vertically at idealLeft
        if (!placed) {
            bestLeft = idealLeft;
            bestTop = FLAG_TOP_ROW1;
            while (placedLabels.some(p => bestLeft < p.left + FLAG_W + 10 && bestLeft + FLAG_W + 10 > p.left && bestTop < p.top + FLAG_H_APPROX + 4 && bestTop + FLAG_H_APPROX + 4 > p.top)) {
                bestTop += FLAG_H_APPROX + 8;
            }
        }
        
        const flagLeft = bestLeft;
        const flagTop = bestTop;
        const flagBottomY = flagTop + FLAG_H_APPROX;
        const sx = Math.abs((flagLeft) - bp.cx) < Math.abs((flagLeft + FLAG_W) - bp.cx) ? flagLeft + 8 : flagLeft + FLAG_W - 8;
        const sy = flagBottomY;
        const ex = bp.cx;
        const ey = bp.topY + 2;
        const finalLine = getBezierPoints(sx, sy, ex, ey);
        
        placedLabels.push({left: flagLeft, top: flagTop, line: finalLine});
        usedPositions.push({left: flagLeft, top: flagTop, width: FLAG_W, height: FLAG_H_APPROX});
  
      const flag = document.createElement('div');
      flag.className = 'shelf-annotation-flag';
      flag.dataset.linkIdx = bookIdx;
      flag.style.cssText = `position:absolute;top:${flagTop}px;left:${flagLeft}px;z-index:200;`;
      flag.innerHTML = `<span class="shelf-annotation-title">${ann.title}</span><span class="shelf-annotation-sub">${ann.sub}</span>`;
   
      flag.addEventListener('mouseenter', () => {
    [bookIdx, bookIdx2].filter(idx => idx >= 0).forEach(idx => {
        const linkedEl = shelfUnit.querySelector(`[data-book-idx="${idx}"]`);
        if(linkedEl) linkedEl.classList.add('is-highlighted');
        arcOverlay.querySelectorAll(`[data-link-idx="${idx}"]`).forEach(el => {
            if(el.tagName === 'path') { el.setAttribute('stroke', 'rgba(166,108,46,0.95)'); el.setAttribute('stroke-width', '3'); }
            if(el.tagName === 'circle') el.setAttribute('fill', 'rgba(166,108,46,1)');
        });
    });
 });
 flag.addEventListener('mouseleave', () => {
    [bookIdx, bookIdx2].filter(idx => idx >= 0).forEach(idx => {
        const linkedEl = shelfUnit.querySelector(`[data-book-idx="${idx}"]`);
        if(linkedEl) linkedEl.classList.remove('is-highlighted');
        arcOverlay.querySelectorAll(`[data-link-idx="${idx}"]`).forEach(el => {
            if(el.tagName === 'path') { el.setAttribute('stroke', 'rgba(166,108,46,0.55)'); el.setAttribute('stroke-width', '2.2'); }
            if(el.tagName === 'circle') el.setAttribute('fill', 'rgba(166,108,46,0.85)');
        });
    });
 });


 flag.addEventListener('click', () => {

 const book = shelfBooks[bookIdx];

 if(book) openPanel(book);

 });

 shelfBack.appendChild(flag);

 const isBusiest = ann.title.indexOf('Busiest Month') !== -1;
   if (!isBusiest) {

 flagData.push({
 bookIdx,
 bookIdx2,
 bookTitle: ann.bookTitle,
 flagLeft,
 flagCX: flagLeft + FLAG_W / 2,
 flagBottomY: flagTop + FLAG_H_APPROX
 });

 }

 });

 const leaderObstacles = [];

 usedPositions.forEach(u => {

 leaderObstacles.push({ left: u.left - 6, right: u.left + u.width + 6, top: u.top - 4, bottom: u.top + u.height + 4 });

 });

 shelfBooks.forEach(b => {

 const pos = bookPositions[b.title];

 if (pos) leaderObstacles.push({ left: pos.left - 3, right: pos.right + 3, top: Math.max(0, pos.topY - 8), bottom: pos.topY + 120 });

 });

 function bezierPt(t, s, c1, c2, e) {

 const mt = 1-t;

 return mt*mt*mt*s + 3*mt*mt*t*c1 + 3*mt*t*t*c2 + t*t*t*e;

 }

 function pathHitsRect(sx, sy, ex, ey, cx1, cy1, cx2, cy2, rect) {

 for (let t = 0; t <= 1; t += 0.02) {

 const px = bezierPt(t, sx, cx1, cx2, ex);

 const py = bezierPt(t, sy, cy1, cy2, ey);

 if (px > rect.left && px < rect.right && py > rect.top && py < rect.bottom) return true;

 }

 return false;

 }

 function scoreRoute(sx, sy, ex, ey, cx1, cy1, cx2, cy2, obstacles) {

 let hits = 0;

 for (const r of obstacles) {

 if (pathHitsRect(sx, sy, ex, ey, cx1, cy1, cx2, cy2, r)) hits++;

 }

 const dist = Math.abs(cx1 - sx) + Math.abs(cx2 - ex);

 return hits * 10000 + dist;

 }

 // Distinct leader color (warm amber)  -  clearly different from the faint horizontal gridlines.

 const LEADER_STROKE = 'rgba(166,108,46,0.55)';

 const LEADER_DOT = 'rgba(166,108,46,0.85)';

 flagData.forEach(fd => {

 // Key by index (not title) so leaders always land on the exact linked book  -  robust to duplicate titles (re-reads).

 const bp = bookPositionsByIdx[fd.bookIdx] || bookPositions[fd.bookTitle];

 if (!bp) return;

 // Start the leader from the flag edge nearest the book for a clean, correctly-aimed line.

 const sx = Math.abs((fd.flagLeft) - bp.cx) < Math.abs((fd.flagLeft + FLAG_W) - bp.cx) ? fd.flagLeft + 8 : fd.flagLeft + FLAG_W - 8;

 const sy = fd.flagBottomY;

 const ex = bp.cx;

 const ey = bp.topY + 2;

 if (Math.abs(ey - sy) < 8) return;

 const _dx = ex - sx;

 const bow = Math.max(15, Math.abs(_dx * 0.2)) * Math.sign(_dx || 1);

 const _cy1 = sy + (ey - sy) * 0.3;

 const _cy2 = sy + (ey - sy) * 0.7;

 const d = `M ${sx} ${sy} C ${sx + bow} ${_cy1}, ${ex - bow} ${_cy2}, ${ex} ${ey}`;

 // Thin white halo drawn first, slightly wider, so the colored leader reads

 // cleanly against the busy book spines behind it.

 const halo = document.createElementNS(svgNS, 'path');

 halo.className.baseVal = 'ann-path-halo';

 halo.dataset.linkIdx = fd.bookIdx;

 halo.setAttribute('d', d);

 halo.setAttribute('fill', 'none');

 halo.setAttribute('stroke', 'rgba(255,252,247,0.92)');

 halo.setAttribute('stroke-width', '3.6');

 halo.setAttribute('stroke-linecap', 'round');

 arcOverlay.appendChild(halo);

 const path = document.createElementNS(svgNS, 'path');

 path.className.baseVal = 'ann-path';

 path.dataset.linkIdx = fd.bookIdx;

 path.setAttribute('d', d);

 path.setAttribute('fill', 'none');

 path.setAttribute('stroke', LEADER_STROKE);

 path.setAttribute('stroke-width', '2.2');

 path.setAttribute('stroke-linecap', 'round');

 arcOverlay.appendChild(path);

 const dot = document.createElementNS(svgNS, 'circle');

 dot.className.baseVal = 'ann-dot';

 dot.dataset.linkIdx = fd.bookIdx;

 dot.setAttribute('cx', ex + '');

 dot.setAttribute('cy', ey + '');

 dot.setAttribute('r', '4');

 dot.setAttribute('fill', LEADER_DOT);

 dot.setAttribute('stroke', 'rgba(255,250,242,0.9)');

 dot.setAttribute('stroke-width', '1.2');

 arcOverlay.appendChild(dot);

 });

 shelfUnit.appendChild(arcOverlay);

 
}

export function toggleQuarterMode() {
  this.quarterMode = !this.quarterMode;
  const btn = document.getElementById('quarterModeBtn');
  if (btn) btn.classList.toggle('active', this.quarterMode);
  this.render();
}

export function toggleEditMode() {
  const app = (this && this.books) ? this : ((typeof window !== 'undefined' && window.App) ? window.App : (this || {}));
  const nextState = !(app.isEditMode || app._editMode || app._reorderMode);
  app.isEditMode = nextState;
  app._editMode = nextState;
  app._reorderMode = nextState;
  if (this && this !== app) {
    this.isEditMode = nextState;
    this._editMode = nextState;
    this._reorderMode = nextState;
  }
  if (typeof window !== 'undefined' && window.App) {
    window.App.isEditMode = nextState;
    window.App._editMode = nextState;
    window.App._reorderMode = nextState;
  }

  const editBtns = document.querySelectorAll('#editModeToggleBtn, .shelf-edit-toggle-btn, .edit-mode-toggle-btn');
  editBtns.forEach(btn => {
    btn.classList.toggle('active', nextState);
    btn.classList.toggle('edit-mode-active', nextState);
    const labelEl = btn.querySelector('.edit-btn-label');
    if (labelEl) {
      labelEl.textContent = nextState ? 'Done Editing' : 'Enable Edit Mode';
    } else if (btn.tagName === 'BUTTON') {
      if (btn.id === 'editModeToggleBtn' && !btn.querySelector('svg') && !btn.querySelector('.edit-btn-icon')) {
        btn.textContent = nextState ? 'Done Editing' : 'Enable Edit Mode';
      }
    }
  });

  const reorderBtn = document.getElementById('reorderToggleBtn');
  if (reorderBtn) {
    reorderBtn.textContent = nextState ? 'Done Editing' : 'Enable Edit Mode';
    reorderBtn.classList.toggle('active', nextState);
  }

  const shelfUnit = document.getElementById('shelfUnit');
  if (shelfUnit) {
    shelfUnit.classList.toggle('edit-mode', nextState);
    shelfUnit.classList.toggle('reorder-mode', nextState);
  }
  const shelfWrapper = document.getElementById('desktopShelfWrapper');
  if (shelfWrapper) {
    shelfWrapper.classList.toggle('edit-mode', nextState);
  }

  if (app && typeof app.render === 'function') {
    app.render();
  } else if (typeof this !== 'undefined' && typeof this.render === 'function') {
    this.render();
  }
}

export function toggleReorderMode() {
  return this && typeof this.toggleEditMode === 'function' ? this.toggleEditMode() : toggleEditMode.call(this);
}

export function _addReorderArrows() {
  // Arrow buttons for accessible reordering
}

export function _inlineWordCountEdit() {
  // Inline word count edit prompt
}

export function _swapBook(idxA, idxB) {
  const tmp = this.books[idxA];
  this.books[idxA] = this.books[idxB];
  this.books[idxB] = tmp;
  this._persistReorder();
  this.render();
}

export async function _persistReorder() {
  const app = this && this.books ? this : (typeof window !== 'undefined' ? window.App : null);
  if (app && app.isReadOnly) return;
  const books = (app && app.books) || [];
  for (let i = 0; i < books.length; i++) {
    books[i].sortOrder = i;
  }
  const updatePromises = books
    .filter(b => b && b.id)
    .map((b, i) => DB.updateBook(b.id, { sort_order: i }));
  try {
    await Promise.all(updatePromises);
  } catch (e) {
    console.warn('[_persistReorder] DB update failed:', e);
  }
}

export async function _placeBookAtEndOfMonth(bookId, targetMonth) {
  if (!bookId || !this.books) return;
  let book = this.books.find(b => String(b.id) === String(bookId));
  if (!book && Array.isArray(this.toReadBooks)) {
    book = this.toReadBooks.find(b => String(b.id) === String(bookId));
    if (book) {
      this.toReadBooks = this.toReadBooks.filter(b => String(b.id) !== String(bookId));
    }
  }
  if (!book) return;

  const isQM = this.quarterMode || (typeof window !== 'undefined' && window.App && window.App.quarterMode);
  const monthList = isQM ? ['Q1', 'Q2', 'Q3', 'Q4'] : ALL_MONTHS;
  const defaultMonth = isQM ? ('Q' + (Math.floor(new Date().getMonth()/3)+1)) : ALL_MONTHS[new Date().getMonth()];
  const finalMonth = targetMonth || book.month || defaultMonth;
  book.month = finalMonth;
  book.month_finished = finalMonth;
  book.status = 'finished';
  book.currentlyReading = false;
  if (!book.dateFinished && !book.date_finished) {
    book.dateFinished = new Date().toISOString().split('T')[0];
    book.date_finished = book.dateFinished;
  }

  const curIdx = this.books.findIndex(b => String(b.id) === String(bookId));
  if (curIdx !== -1) {
    this.books.splice(curIdx, 1);
  }

  const getBMonth = (b) => {
    const raw = b.month || b.month_finished;
    if (raw && typeof raw === 'string' && raw.trim()) return raw.trim();
    if (typeof getBookMonth === 'function') return getBookMonth(b);
    return '';
  };
  const targetMonthNormalized = String(finalMonth).trim().toLowerCase();

  // Find the last finished book for finalMonth
  let insertIdx = -1;
  for (let i = this.books.length - 1; i >= 0; i--) {
    const b = this.books[i];
    const bMonth = getBMonth(b);
    if (bMonth.toLowerCase() === targetMonthNormalized && b.status !== 'to-read' && !b.currentlyReading && b.status !== 'reading') {
      insertIdx = i + 1;
      break;
    }
  }

  if (insertIdx === -1) {
    const targetMonthIdx = monthList.findIndex(m => m.toLowerCase() === targetMonthNormalized);
    if (targetMonthIdx > 0) {
      for (let m = targetMonthIdx - 1; m >= 0; m--) {
        const prevMonth = monthList[m].toLowerCase();
        for (let i = this.books.length - 1; i >= 0; i--) {
          const b = this.books[i];
          const bMonth = getBMonth(b);
          if (bMonth.toLowerCase() === prevMonth && b.status !== 'to-read' && !b.currentlyReading && b.status !== 'reading') {
            insertIdx = i + 1;
            break;
          }
        }
        if (insertIdx !== -1) break;
      }
    }
  }

  if (insertIdx === -1) {
    const targetMonthIdx = monthList.findIndex(m => m.toLowerCase() === targetMonthNormalized);
    if (targetMonthIdx !== -1) {
      for (let m = targetMonthIdx + 1; m < monthList.length; m++) {
        const nextMonth = monthList[m].toLowerCase();
        const firstIdx = this.books.findIndex(b => getBMonth(b).toLowerCase() === nextMonth && b.status !== 'to-read' && !b.currentlyReading && b.status !== 'reading');
        if (firstIdx !== -1) {
          insertIdx = firstIdx;
          break;
        }
      }
    }
  }

  if (insertIdx === -1) {
    const nonShelfIdx = this.books.findIndex(b => b.status === 'to-read' || b.currentlyReading || b.status === 'reading');
    insertIdx = (nonShelfIdx !== -1) ? nonShelfIdx : this.books.length;
  }

  this.books.splice(insertIdx, 0, book);
  await this._persistReorder();
}

export function setupDrag(el, bookId) {
  const app = (this && this.books) ? this : ((typeof window !== 'undefined' && window.App) ? window.App : null);
  if (app && app.isReadOnly) return;
  el.dataset.bookId = bookId;
  el.setAttribute('draggable', 'false');

  const handle = el.querySelector('.drag-handle, .spine-drag-handle');
  if (handle) {
    handle.setAttribute('draggable', 'true');
    handle.dataset.bookId = bookId;

    handle.addEventListener('dragstart', (e) => {
      const curApp = (typeof window !== 'undefined' && window.App) || (this && this.books ? this : null);
      if (curApp && !curApp.isEditMode && !curApp._editMode && !curApp._reorderMode) {
        e.preventDefault();
        return;
      }
      if (curApp) curApp.draggedBookId = bookId;
      if (e.dataTransfer) {
        e.dataTransfer.setData('text/plain', String(bookId));
        e.dataTransfer.effectAllowed = 'move';
      }
      el.classList.add('dragging');
      if (e.stopPropagation) e.stopPropagation();
    });

    handle.addEventListener('dragend', () => {
      el.classList.remove('dragging', 'drag-over', 'drag-over-left', 'drag-over-right');
      const allBooks = document.querySelectorAll('.book, .spine');
      allBooks.forEach(b => b.classList.remove('drag-over', 'drag-over-left', 'drag-over-right', 'dragging'));
      const curApp = (typeof window !== 'undefined' && window.App) || (this && this.books ? this : null);
      if (curApp) curApp.draggedBookId = null;
    });

    let isTouchDragging = false;
    let currentDropTarget = null;

    handle.addEventListener('touchstart', (e) => {
      const curApp = (typeof window !== 'undefined' && window.App) || (this && this.books ? this : null);
      if (!curApp || (!curApp.isEditMode && !curApp._editMode && !curApp._reorderMode)) return;
      if (e.touches && e.touches.length > 0) {
        curApp.draggedBookId = bookId;
        isTouchDragging = true;
        el.classList.add('dragging');
      }
    }, { passive: true });

    handle.addEventListener('touchmove', (e) => {
      if (!isTouchDragging) return;
      if (e.touches && e.touches.length > 0) {
        const touch = e.touches[0];
        const elemUnder = document.elementFromPoint(touch.clientX, touch.clientY);
        const targetBookEl = elemUnder?.closest('.book, .spine');

        document.querySelectorAll('.book, .spine').forEach(b => {
          if (b !== targetBookEl) b.classList.remove('drag-over', 'drag-over-left', 'drag-over-right');
        });

        if (targetBookEl && targetBookEl !== el) {
          const rect = targetBookEl.getBoundingClientRect();
          const isRight = (rect.width > 0) ? (touch.clientX > rect.left + rect.width / 2) : false;
          targetBookEl.classList.add('drag-over');
          if (isRight) {
            targetBookEl.classList.remove('drag-over-left');
            targetBookEl.classList.add('drag-over-right');
          } else {
            targetBookEl.classList.remove('drag-over-right');
            targetBookEl.classList.add('drag-over-left');
          }
          currentDropTarget = { element: targetBookEl, isAfter: isRight };
        } else {
          currentDropTarget = null;
        }

        if (e.cancelable) e.preventDefault();
      }
    }, { passive: false });

    const finishTouchDrag = async () => {
      if (!isTouchDragging) return;
      isTouchDragging = false;
      el.classList.remove('dragging');
      document.querySelectorAll('.book, .spine').forEach(b => {
        b.classList.remove('drag-over', 'drag-over-left', 'drag-over-right', 'dragging');
      });

      const curApp = (typeof window !== 'undefined' && window.App) || (this && this.books ? this : null);
      if (!curApp || !curApp.books) return;

      if (currentDropTarget && currentDropTarget.element) {
        const targetBookId = currentDropTarget.element.dataset.bookId || currentDropTarget.element.dataset.id;
        if (targetBookId && String(targetBookId) !== String(bookId)) {
          const fromIdx = curApp.books.findIndex(b => String(b.id) === String(bookId));
          let targetIdx = curApp.books.findIndex(b => String(b.id) === String(targetBookId));
          if (fromIdx !== -1 && targetIdx !== -1) {
            const [movedBook] = curApp.books.splice(fromIdx, 1);
            let newTargetIdx = curApp.books.findIndex(b => String(b.id) === String(targetBookId));
            if (currentDropTarget.isAfter) {
              newTargetIdx += 1;
            }
            curApp.books.splice(newTargetIdx, 0, movedBook);

            const targetBook = curApp.books.find(b => String(b.id) === String(targetBookId));
            if (targetBook && targetBook.month && (ALL_MONTHS.includes(targetBook.month) || ['Q1','Q2','Q3','Q4'].includes(targetBook.month)) && !movedBook.currentlyReading && movedBook.status !== 'reading') {
              movedBook.month = targetBook.month;
              movedBook.month_finished = targetBook.month;
            }

            if (typeof curApp._persistReorder === 'function') await curApp._persistReorder();
            if (typeof curApp.render === 'function') curApp.render();
          }
        }
      }
      currentDropTarget = null;
      if (curApp) curApp.draggedBookId = null;
    };

    handle.addEventListener('touchend', finishTouchDrag, { passive: true });
    handle.addEventListener('touchcancel', finishTouchDrag, { passive: true });
  }

  el.addEventListener('dragstart', (e) => {
    const curApp = (typeof window !== 'undefined' && window.App) || (this && this.books ? this : null);
    if (!curApp || (!curApp.isEditMode && !curApp._editMode && !curApp._reorderMode) || !e.target.closest('.drag-handle, .spine-drag-handle')) {
      e.preventDefault();
      return false;
    }
    if (curApp) curApp.draggedBookId = bookId;
    if (e.dataTransfer) {
      e.dataTransfer.setData('text/plain', String(bookId));
      e.dataTransfer.effectAllowed = 'move';
    }
    el.classList.add('dragging');
  });

  el.addEventListener('dragover', (e) => {
    const curApp = (typeof window !== 'undefined' && window.App) || (this && this.books ? this : null);
    if (!curApp || (!curApp.isEditMode && !curApp._editMode && !curApp._reorderMode)) return;
    if (!curApp.draggedBookId) return;

    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
    const rect = el.getBoundingClientRect();
    const isRight = (rect.width > 0) ? (e.clientX > rect.left + rect.width / 2) : false;
    if (isRight) {
      el.classList.remove('drag-over-left');
      el.classList.add('drag-over-right');
    } else {
      el.classList.remove('drag-over-right');
      el.classList.add('drag-over-left');
    }
    el.classList.add('drag-over');
  });

  el.addEventListener('dragleave', () => {
    el.classList.remove('drag-over', 'drag-over-left', 'drag-over-right');
  });

  el.addEventListener('dragend', () => {
    el.classList.remove('dragging', 'drag-over', 'drag-over-left', 'drag-over-right');
    const allBooks = document.querySelectorAll('.book, .spine');
    allBooks.forEach(b => b.classList.remove('drag-over', 'drag-over-left', 'drag-over-right', 'dragging'));
    const curApp = (typeof window !== 'undefined' && window.App) || (this && this.books ? this : null);
    if (curApp) curApp.draggedBookId = null;
  });

  el.addEventListener('drop', async (e) => {
    const curApp = (typeof window !== 'undefined' && window.App) || (this && this.books ? this : null);
    if (!curApp || (!curApp.isEditMode && !curApp._editMode && !curApp._reorderMode)) return;

    e.preventDefault();
    e.stopPropagation();
    el.classList.remove('drag-over', 'drag-over-left', 'drag-over-right');
    const allBooks = document.querySelectorAll('.book, .spine');
    allBooks.forEach(b => b.classList.remove('drag-over', 'drag-over-left', 'drag-over-right', 'dragging'));

    if (!curApp || !curApp.books) return;

    const srcId = (e.dataTransfer && e.dataTransfer.getData('text/plain')) || curApp.draggedBookId;
    if (!srcId || String(srcId) === String(bookId)) {
      curApp.draggedBookId = null;
      return;
    }

    const fromIdx = (curApp.books || []).findIndex(b => String(b.id) === String(srcId));
    const targetIdx = (curApp.books || []).findIndex(b => String(b.id) === String(bookId));
    if (fromIdx === -1 || targetIdx === -1) {
      curApp.draggedBookId = null;
      return;
    }

    const rect = el.getBoundingClientRect();
    const isAfter = (rect.width > 0) ? (e.clientX > rect.left + rect.width / 2) : false;

    const [movedBook] = curApp.books.splice(fromIdx, 1);
    let newTargetIdx = curApp.books.findIndex(b => String(b.id) === String(bookId));
    if (isAfter) {
      newTargetIdx += 1;
    }
    curApp.books.splice(newTargetIdx, 0, movedBook);

    const targetBook = curApp.books.find(b => String(b.id) === String(bookId));
    if (targetBook && targetBook.month && (ALL_MONTHS.includes(targetBook.month) || ['Q1','Q2','Q3','Q4'].includes(targetBook.month)) && !movedBook.currentlyReading && movedBook.status !== 'reading') {
      movedBook.month = targetBook.month;
      movedBook.month_finished = targetBook.month;
    }

    curApp.draggedBookId = null;
    if (typeof curApp._persistReorder === 'function') await curApp._persistReorder();
    if (typeof curApp.render === 'function') curApp.render();
  });
}

export function setupDropZone() {
  // Drop zones on planks and shelf regions
}

export function toggleSpineArt(enable) {
  if (typeof enable === 'undefined') {
    const current = (typeof localStorage !== 'undefined') ? (localStorage.getItem('shelf_spine_art') === 'true') : false;
    enable = !current;
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('shelf_spine_art', enable ? 'true' : 'false');
  }
  const checkbox = document.getElementById('spineArtToggle');
  if (checkbox) checkbox.checked = enable;
  const profileCheckbox = document.getElementById('profileSpineArtToggle');
  if (profileCheckbox) profileCheckbox.checked = enable;
  if (window.App && typeof window.App.render === 'function') {
    window.App.render();
  } else if (window.App && typeof window.App.renderShelf === 'function') {
    window.App.renderShelf();
  }
}
if (typeof window !== 'undefined') {
  window.toggleSpineArt = toggleSpineArt;
  if (window.App) window.App.toggleSpineArt = toggleSpineArt;
}

export function toggleGearMenu() {
  const gm = document.getElementById('gearOverlayMenu');
  if (gm) {
    gm.classList.toggle('open');
    const spineArtToggle = document.getElementById('spineArtToggle');
    if (spineArtToggle) {
      spineArtToggle.checked = (typeof localStorage !== 'undefined') ? (localStorage.getItem('shelf_spine_art') === 'true') : false;
    }
  }
}

export function toggleFilterPanel() {
  const fp = document.getElementById('filterOverlayPanel');
  if (fp) fp.classList.toggle('open');
}

export function buildFormatFilterBar(BOOKS) {
  // Format filter buttons (physical, ebook, audiobook)
}

export function _applyFormatFilter(format) {
  // Filter books by format
}

export function _applyAllFilters() {
  // Apply composite filters
}

export function _populateMoodFilter() {
  // Populate mood filter tags
}

export function toggleMoodFilter(mood) {
  // Toggle specific mood filter
}

export function applyInlineFilters() {
  // Real-time filter application
}

export function buildFilterBar(BOOKS) {
  // Primary shelf filter bar
}

export function setupSortBar(BOOKS) {
  // Shelf sort controls (date, rating, words, duration)
}

// ==========================================
// 3. Series, TBR & Currently Reading
// ==========================================
export function _renderAggDotMatrix() {}
export function _renderAggSentimentTrend() {}
export function _renderAggClosingStrip() {}
export function openAggModal() {}
export function closeAggModal() {}

// ==========================================
// 4. Series, TBR & Currently Reading
// ==========================================






export function openTbrManager() {
  this.openModal('tbrManagerModal');
  this.renderTbrManager();
}

export function renderTbrManager() {
  const container = document.getElementById('tbrManagerList');
  if (!container) return;
  const toRead = (this.toReadBooks && this.toReadBooks.length) ? this.toReadBooks : (this.books || []).filter(b => b.status === 'to-read');
  container.innerHTML = toRead.map((b, i) => `
    <div class="tbr-row" draggable="true" data-idx="${i}" style="display:flex;align-items:center;gap:12px;padding:8px;background:rgba(61,43,31,0.04);margin-bottom:6px;border-radius:4px;">
      <span style="cursor:grab;">☰</span>
      <span style="flex:1;font-weight:700;">${esc(b.title)}</span>
      <span>${esc(b.author)}</span>
    </div>
  `).join('');
}

export function tbrDragStart(e) {}
export function tbrDragOver(e) {}
export function tbrDragEnd(e) {}
export function tbrDrop(e) {}

export function openCurrentlyReadingModal() {
  this.openModal('crAddModal');
}

export async function saveCurrentlyReading() {
  if (!this._crSelectedResult) { alert('Please search and select a book first.'); return; }
  if (!this.currentShelf) { alert('No shelf loaded.'); return; }
  const r = this._crSelectedResult;
  const dateStarted = document.getElementById('crDateStarted')?.value || null;
  const words = parseInt(document.getElementById('crWordCount')?.value) || 80000;
  const genre = document.getElementById('crGenre')?.value || 'General Fiction';
  const format = document.getElementById('crFormat')?.value || 'physical';

  const bookData = {
    shelf_id: this.currentShelf.id,
    user_id: this.userId,
    title: r.title,
    author: r.author,
    cover_url: r.coverUrl || '',
    genre: genre,
    page_count: r.pages || 0,
    pub_year: r.year || this.currentYear,
    word_count: words,
    sentiment: 'mixed',
    month_finished: null,
    days_to_read: 5,
    currently_reading: true,
    date_started: dateStarted,
    fiction: r.fiction !== false,
    sort_order: this.books.length,
    format: format
  };

  const saved = await DB.addBook(bookData);
  if (saved) {
    this.books.push(dbToBook(saved));
  }
  this.closeModal('crAddModal');
  this.render();
  this.showToast('📖 Added to currently reading!');
}

export function syncEditCR(checked) {
  const dateGroup = document.getElementById('editCRDateGroup');
  if (dateGroup) dateGroup.style.display = checked ? '' : 'none';
  if (checked) {
    const dateInput = document.getElementById('editDateStarted');
    if (dateInput && !dateInput.value) {
      dateInput.value = new Date().toISOString().split('T')[0];
    }
  }
}

export async function _markAsCurrentlyReading(bookId) {
  const idx = (this.books || []).findIndex(b => String(b.id) === String(bookId));
  if (idx === -1) return;
  const today = new Date().toISOString().split('T')[0];
  await DB.updateBook(bookId, { currently_reading: true, date_started: today, status: 'reading' });
  this.books[idx].currentlyReading = true;
  this.books[idx].dateStarted = today;
  this.books[idx].status = 'reading';
  this.render();
  this.showToast('📖 Marked as now reading!');
}

export function openFinishBookModal(bookId) {
  this._finishingBookId = bookId;
  const book = this._findBookById(bookId);
  if (!book) return;
  this.openEditModal(book);
  this.switchHubTab('finish');
}

export async function confirmFinishBook() {
  const bookId = this._finishingBookId || (this.editingBook ? this.editingBook.id : null);
  if (!bookId) return;
  const idx = (this.books || []).findIndex(b => String(b.id) === String(bookId));
  if (idx === -1) return;

  const currentMonth = ALL_MONTHS[new Date().getMonth()];
  const finishMonthEl = document.getElementById('finishMonth');
  const month = (finishMonthEl && finishMonthEl.value) ? finishMonthEl.value : currentMonth;
  const days = parseInt(document.getElementById('finishDays')?.value) || 5;
  const sentEl = document.querySelector('#finishSentimentSelector .sentiment-opt.selected');
  const sentiment = sentEl ? sentEl.dataset.s : 'mixed';
  const review = document.getElementById('finishReview')?.value || '';
  const today = new Date().toISOString().split('T')[0];

  const updates = {
    status: 'finished',
    currently_reading: false,
    days_to_read: days,
    month_finished: month,
    month: month,
    date_finished: today,
    sentiment: sentiment,
    review: review || this.books[idx].review
  };

  await DB.updateBook(bookId, updates);
  Object.assign(this.books[idx], updates, { currentlyReading: false, dateFinished: today });
  await this._placeBookAtEndOfMonth(bookId, month);
  this.closeModal('editBookModal');
  this.render();
  this.showToast('✅ Book marked as finished!');
}

// ==========================================
// 5. Book Hub, Context Menus & Details
// ==========================================

export function switchHubTab(tabId) {
  const tabs = ['details', 'progress', 'finish'];
  tabs.forEach(t => {
    const tabEl = document.getElementById('hubTab' + t.charAt(0).toUpperCase() + t.slice(1));
    const paneEl = document.getElementById('hubPane' + t.charAt(0).toUpperCase() + t.slice(1));
    if (tabEl) tabEl.classList.toggle('active', t === tabId);
    if (paneEl) paneEl.style.display = t === tabId ? 'block' : 'none';
  });

  if (tabId === 'finish') {
    const mSelect = document.getElementById('finishMonth');
    if (mSelect) {
      const curMonth = ALL_MONTHS[new Date().getMonth()];
      const app = (typeof window !== 'undefined' && window.App) || this;
      const b = (app && app.editingBook) || {};
      const selectedMonth = b.month || curMonth;
      mSelect.innerHTML = ALL_MONTHS.map(m => `<option value="${m}"${m === selectedMonth ? ' selected' : ''}>${m}</option>`).join('');
    }
    const fSent = document.getElementById('finishSentimentSelector');
    if (fSent) {
      const app = (typeof window !== 'undefined' && window.App) || this;
      const b = (app && app.editingBook) || {};
      const curSent = b.sentiment || 'mixed';
      fSent.className = 'sentiment-selector';
      fSent.innerHTML = SENT_ORDER.map(s => `<div class="sentiment-opt${curSent === s ? ' selected' : ''}" data-s="${s}" onclick="document.querySelectorAll('#finishSentimentSelector .sentiment-opt').forEach(o=>o.classList.remove('selected'));if(this&&this.classList)this.classList.add('selected');"><span>${LABELS[s]}</span></div>`).join('');
    }
  }
}

export function openBookHub(bookId, tabId = 'details') {
  const book = this._findBookById(bookId);
  if (!book) return;
  this.openEditModal(book);
  this.switchHubTab(tabId);
}

export async function openEditModal(book, mode = 'edit') {

  if (typeof book === 'string' || typeof book === 'number') {
    book = this._findBookById(book);
  }

  if(this.isReadOnly || !book) return;

  try {
    if (this.userId) {
      window._dbClubsForModal = await DB.getMyClubs(this.userId);
    }
  } catch(e) {
    console.warn('Could not fetch clubs for modal', e);
  }

  this.editingBook = book;
  this.editMode = mode;
  if (typeof window !== 'undefined' && window.App) {
    window.App._originalReviewText = null;
    window.App._selectedAiTone = 'thoughtful';
  }

  if (mode === 'add') {
    book.month = this.quarterMode ? `Q${Math.floor(new Date().getMonth()/3)+1}` : ALL_MONTHS[new Date().getMonth()];
  }

  const titleEl = document.getElementById('bookHubTitle');
  if (titleEl) titleEl.textContent = mode === 'add' ? 'Add Book' : 'Book Hub';

  this._editWcEstimated = isWordCountEstimated(book);

  const container = document.getElementById('editFormFields');

  const pageCount = book.pageCount || book.pages || (book.words ? Math.round(book.words / 300) : 250);

  

  const currentGender = book.authorGender ? book.authorGender.toLowerCase() : 'unknown';
  // Auto-detect missing metadata for newly opened modal
  setTimeout(() => {
    const wc = document.getElementById('editWords');
    const isDummy = (wc && wc.value === '80000' && (!book.wordCountSource || book.wordCountSource === 'unknown' || book.wordCountSource === 'calculated'));
    if (!wc || !wc.value || wc.value === '0' || wc.value === 'NaN' || wc.value === 'undefined' || isDummy) {
      App.detectEditWordCount();
    }
    const ar = document.getElementById('editAuthorRegion');
    const eg = document.getElementById('editAuthorGender');
    if (!ar || !ar.value || ar.value.length < 3 || ar.value === 'undefined' || !eg || !eg.value || eg.value === 'unknown') {
      App.detectEditRegion();
    }
    const sn = document.getElementById('editSeriesName');
    const snum = document.getElementById('editSeriesNumber');
    if (book.title || document.getElementById('editTitle')?.value) {
      App.detectEditSeries();
    }
    if (book.dateStarted && book.dateFinished && typeof App.onTimelineDateChange === 'function') {
      App.onTimelineDateChange();
    }
    if (book.title && (!book.editions || book.editions.length <= 1)) {
      if (typeof App.fetchAndPopulateReleaseYears === 'function') {
        App.fetchAndPopulateReleaseYears(false);
      }
    }
  }, 100);

  const isCozy = (typeof window !== 'undefined' && window.App && window.App.cozyMode) || (typeof document !== 'undefined' && document.body && document.body.classList.contains('cozy-mode'));
  const detailsOpenAttr = isCozy ? '' : 'open';

  const uniqueSeries = [...new Set((this.books || []).map(b => (b.seriesName || '').trim()).filter(Boolean))].sort();
  const datalistHTML = `<datalist id="existingSeriesDatalist">${uniqueSeries.map(s => `<option value="${s.replace(/"/g, '&quot;')}">`).join('')}</datalist>`;

  const pubYearOptionsHTML = (() => {
    const currentY = parseInt(book.year, 10) || null;
    const eds = Array.isArray(book.editions) ? book.editions : [];
    const years = eds.map(e => typeof e === 'object' ? e.year : parseInt(e, 10)).filter(y => y && !isNaN(y));
    if (currentY && !years.includes(currentY)) {
      years.push(currentY);
    }
    const uniqueYears = [...new Set(years)].sort((a, b) => a - b);
    const origYear = book.originalYear || (uniqueYears.length > 0 ? uniqueYears[0] : null);

    let opts = '';
    if (uniqueYears.length === 0) {
      if (currentY) {
        opts += `<option value="${currentY}" selected>${currentY}</option>`;
      } else {
        opts += `<option value="" selected disabled>Select Year</option>`;
      }
    } else {
      opts = uniqueYears.map(y => {
        const isSel = (currentY && y === currentY) || (!currentY && y === origYear);
        let label = `${y}`;
        if (y === origYear) {
          label += ' (Original)';
        } else {
          label += ' Edition';
        }
        return `<option value="${y}"${isSel ? ' selected' : ''}>${label}</option>`;
      }).join('');
    }

    opts += `<option value="custom">✏️ Custom Year...</option>`;
    if (uniqueYears.length <= 1) {
      opts += `<option value="fetch">🔍 Fetch All Releases...</option>`;
    }
    return opts;
  })();

  container.innerHTML = `
  ${datalistHTML}

  <!-- Top Row (Responsive Mobile-Friendly Layout) -->

  <div class="edit-modal-top-row">

    <!-- Primary Info: Cover + Title/Author/Genre -->
    <div class="edit-top-primary" style="display:flex; gap:10px; flex:1; min-width:0; align-items:stretch;">
      <!-- Left: Cover -->
      <div class="cover-hover-container" style="width:85px; height:127px; position:relative; border-radius:4px; overflow:hidden; border:1px solid rgba(0,0,0,0.5); flex-shrink:0;">
        <div id="editCoverPreview" style="width:100%; height:100%; background:rgba(61,43,31,0.08); display:flex; align-items:center; justify-content:center;">
           ${book.coverUrl ? '<img loading="lazy" decoding="async" src="' + book.coverUrl + '" style="width:100%;height:100%;object-fit:cover;" onerror="if(this&&this.parentElement)this.parentElement.textContent=String.fromCodePoint(0x1F4D8);">' : '📖'}
        </div>
        <div class="cover-hover-overlay">
           <button type="button" class="btn-primary" onclick="App.fetchAlternativeCover()" style="font-size:9px; padding:4px; border-radius:4px; border:none; width:100%;">🔍 Find</button>
           <button type="button" class="btn-secondary" onclick="const el=document.getElementById('editCoverUrlInput');if(el)el.style.display='block'" style="font-size:9px; padding:4px; border-radius:4px; border:none; width:100%;">🔗 Paste</button>
        </div>
      </div>

      <!-- Center: Core Info -->
      <div style="flex:1; min-width:0; display:flex; flex-direction:column; gap:8px;">
        <div>
          <input class="form-input" id="editTitle" onblur="App.detectEditWordCount(); App.detectEditSeries();" value="${(book.title||'').replace(/"/g,'&quot;')}" placeholder="Book Title" style="font-weight:bold; font-size:14px; padding:7px; width:100%; box-sizing:border-box;">
        </div>
        <div style="display:flex; align-items:center; gap:4px;">
          <span id="editAuthorFlagPreview" style="font-size:14px;line-height:1;"></span>
          <input class="form-input" id="editAuthor" onblur="App.detectEditRegion(); App.detectEditWordCount(); App.detectEditSeries();" value="${(book.author||'').replace(/"/g,'&quot;')}" placeholder="Author Name" style="flex:1; min-width:0; font-size:13px; padding:7px;">
        </div>
        <div>
          <select class="form-select" id="editGenre" style="font-size:12px; padding:7px; width:100%; box-sizing:border-box;">
            <option value="General Fiction" ${book.genre === 'General Fiction' ? 'selected' : ''}>General Fiction</option>
            <option value="Crime & Mystery" ${book.genre === 'Crime & Mystery' ? 'selected' : ''}>Crime & Mystery</option>
            <option value="Science Fiction" ${book.genre === 'Science Fiction' ? 'selected' : ''}>Science Fiction</option>
            <option value="Fantasy" ${book.genre === 'Fantasy' ? 'selected' : ''}>Fantasy</option>
            <option value="Romance" ${book.genre === 'Romance' ? 'selected' : ''}>Romance</option>
            <option value="Romance - Spicy" ${book.genre === 'Romance - Spicy' ? 'selected' : ''}>Romance - Spicy</option>
            <option value="Horror" ${book.genre === 'Horror' ? 'selected' : ''}>Horror</option>
            <option value="Biography & Memoir" ${book.genre === 'Biography & Memoir' ? 'selected' : ''}>Biography & Memoir</option>
            <option value="History" ${book.genre === 'History' ? 'selected' : ''}>History</option>
            <option value="War/Military" ${book.genre === 'War/Military' ? 'selected' : ''}>War/Military</option>
            <option value="Self-Help" ${book.genre === 'Self-Help' ? 'selected' : ''}>Self-Help</option>
            <option value="Business" ${book.genre === 'Business' ? 'selected' : ''}>Business</option>
            <option value="Philosophy" ${book.genre === 'Philosophy' ? 'selected' : ''}>Philosophy</option>
            <option value="Poetry" ${book.genre === 'Poetry' ? 'selected' : ''}>Poetry</option>
            <option value="Graphic Novel" ${book.genre === 'Graphic Novel' ? 'selected' : ''}>Graphic Novel</option>
            <option value="Children" ${book.genre === 'Children' ? 'selected' : ''}>Children</option>
            <option value="Non-Fiction" ${book.genre === 'Non-Fiction' ? 'selected' : ''}>Non-Fiction</option>
          </select>
        </div>
        <input class="form-input" id="editCoverUrlInput" type="url" placeholder="Paste cover URL" value="${book.coverUrl||''}" style="display:none;font-size:10px;margin-top:2px;" onchange="App.previewEditCover(this.value)">
      </div>
    </div>

    ${isCozy ? '' : `
    <!-- Secondary Collector Row: Fiction & Gender + Series (Wraps on mobile cleanly) -->
    <div class="edit-top-collector-row" style="display:flex; gap:10px; align-items:stretch; flex-shrink:0;">
      <!-- Column 3: Fiction & Gender -->
      <div style="display:flex; flex-direction:column; justify-content:center; gap:8px; flex-shrink:0;">
          <div style="display:flex; flex-direction:column;">
            <div class="format-pill-row" style="gap:4px; display:flex;">
              <button type="button" class="format-pill${book.fiction!==false?' active':''}" id="editFictionBtn" style="font-size:11px; padding:4px 8px;" onclick="const fb=document.getElementById('editFictionBtn'), nfb=document.getElementById('editNonfictionBtn'), ef=document.getElementById('editFiction'); if(fb)fb.classList.add('active'); if(nfb)nfb.classList.remove('active'); if(ef)ef.value='fiction';">Fiction</button>
              <button type="button" class="format-pill${book.fiction===false?' active':''}" id="editNonfictionBtn" style="font-size:11px; padding:4px 8px;" onclick="const fb=document.getElementById('editFictionBtn'), nfb=document.getElementById('editNonfictionBtn'), ef=document.getElementById('editFiction'); if(nfb)nfb.classList.add('active'); if(fb)fb.classList.remove('active'); if(ef)ef.value='nonfiction';">Non-fiction</button>
            </div>
            <input type="hidden" id="editFiction" value="${book.fiction!==false?'fiction':'nonfiction'}">
          </div>
          <hr style="margin:0; border:none; border-top:1px solid rgba(61,43,31,0.15);">
          <div style="display:flex; flex-direction:column;">
            <div class="format-pill-row" style="gap:4px; display:flex;">
              <button type="button" class="format-pill gender-btn gender-btn-male${currentGender==='male'?' active':''}" style="font-size:11px; padding:4px 6px;" onclick="document.querySelectorAll('.gender-btn').forEach(b=>b.classList.remove('active')); if(this&&this.classList)this.classList.add('active'); const eg=document.getElementById('editAuthorGender'); if(eg)eg.value='male';">♂️ Male</button>
              <button type="button" class="format-pill gender-btn gender-btn-female${currentGender==='female'?' active':''}" style="font-size:11px; padding:4px 6px;" onclick="document.querySelectorAll('.gender-btn').forEach(b=>b.classList.remove('active')); if(this&&this.classList)this.classList.add('active'); const eg=document.getElementById('editAuthorGender'); if(eg)eg.value='female';">♀️ Female</button>
              <button type="button" class="format-pill gender-btn gender-btn-unknown${currentGender!=='male'&&currentGender!=='female'?' active':''}" style="font-size:11px; padding:4px 6px;" onclick="document.querySelectorAll('.gender-btn').forEach(b=>b.classList.remove('active')); if(this&&this.classList)this.classList.add('active'); const eg=document.getElementById('editAuthorGender'); if(eg)eg.value='unknown';">❓ Other</button>
            </div>
            <input type="hidden" id="editAuthorGender" value="${currentGender}">
          </div>
      </div>

      <!-- Column 4: Series & Number -->
      <div style="min-width:90px; flex:1; display:flex; flex-direction:column; gap:6px; padding:6px 8px; background:rgba(61,43,31,0.04); border-radius:6px; border:1px solid rgba(61,43,31,0.06); justify-content:center;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.1em;text-transform:uppercase;color:rgba(92,61,42,0.7);">SERIES</span>
          <button type="button" onclick="App.detectEditSeries(true)" title="Auto-detect series" style="background:none;border:none;padding:0;cursor:pointer;font-size:10px;" id="detectSeriesBtn">✨</button>
        </div>
        <input class="form-input" id="editSeriesName" list="existingSeriesDatalist" onblur="App.detectEditSeries()" value="${(book.seriesName||'').replace(/"/g,'&quot;')}" placeholder="Series name" style="font-size:11px; padding:6px 6px; width:100%; box-sizing:border-box;">
        <input class="form-input" id="editSeriesNumber" type="number" value="${book.seriesNumber||''}" min="0" step="0.5" placeholder="Book #" style="font-size:11px; padding:6px 6px; width:100%; box-sizing:border-box;">
        <div id="seriesSuggestionBadge" style="display:none; font-size:10px; background:rgba(139,38,53,0.08); border:1px solid rgba(139,38,53,0.2); border-radius:4px; padding:3px 6px; color:var(--burgundy); cursor:pointer;" onclick="App.acceptSeriesSuggestion()"></div>
      </div>
    </div>
    `}

  </div>

  <!-- Primary Field: Status -->
  <div class="form-group"><label class="form-label">Status</label>
    <div class="status-selector" id="editStatusSelector">
      <div class="status-opt${(book.status||'finished')==='finished'?' selected':''}" data-status="finished" onclick="App.selectEditStatus('finished')"><span class="status-emoji">✅</span><span>Finished</span></div>
      <div class="status-opt${(book.status)==='reading'?' selected':''}" data-status="reading" onclick="App.selectEditStatus('reading')"><span class="status-emoji">📖</span><span>Reading</span></div>
      <div class="status-opt${(book.status)==='to-read'?' selected':''}" data-status="to-read" onclick="App.selectEditStatus('to-read')"><span class="status-emoji">📚</span><span>Want to Read</span></div>
    </div>
  </div>

  <!-- Primary Field: To-Read Notes (Only when To-Read) -->
  <div class="form-group" id="editToReadNotesGroup" style="${(book.status)==='to-read'?'':'display:none;'}">
    <label class="form-label">Why do you want to read this? <span style="color:var(--wood-light);font-weight:normal;">(optional)</span></label>
    <textarea class="form-textarea" id="editToReadNotes" maxlength="300" placeholder="Recommended by a friend, on my radar since..." oninput="var el=document.getElementById('editToReadNotesCount');if(el)el.textContent=((this&&this.value)||'').length+'/300'">${(book.toReadNotes||'').replace(/</g,'&lt;')}</textarea>
    <div id="editToReadNotesCount" style="text-align:right;font-family:'DM Mono',monospace;font-size:9px;color:var(--wood-light);margin-top:2px;letter-spacing:0.06em;">${(book.toReadNotes||'').length}/300</div>
  </div>

  <!-- Primary Field: Sentiment / Rating -->
  <div id="editFinishedFields">
    <div class="form-group"><label class="form-label">How was it?</label>
      <div class="sentiment-selector" id="editSentimentSelector">
      ${SENT_ORDER.map(s => `<div class="sentiment-opt${book.sentiment===s?' selected':''}" data-s="${s}" onclick="document.querySelectorAll('#editSentimentSelector .sentiment-opt').forEach(o=>o.classList.remove('selected'));if(this&&this.classList)this.classList.add('selected');"><span>${LABELS[s]}</span></div>`).join('')}
      </div>
    </div>
  </div>

  <!-- Primary Field: Review with AI Refine Popout Menu -->
  <div class="form-group" id="editReviewGroup">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; position:relative;">
      <label class="form-label" style="margin-bottom:0;">Your Thoughts</label>
      <div class="ai-refine-dropdown-container" style="position:relative;">
        <button type="button" id="aiRefineMenuBtn" class="ai-refine-trigger-btn" onclick="App.toggleAiToneMenu(event)" aria-haspopup="true" aria-expanded="false" title="Refine your thoughts with AI" style="background:linear-gradient(135deg, rgba(139,38,53,0.1), rgba(139,38,53,0.2)); border:1px solid rgba(139,38,53,0.3); border-radius:6px; padding:3px 9px; font-size:11px; font-weight:600; color:var(--burgundy, #8b2635); cursor:pointer; display:flex; align-items:center; gap:5px; transition:all 0.15s ease;">
          <span id="aiRefineBtnIcon">✨</span>
          <span id="aiRefineBtnLabel">AI Refine</span>
          <span style="font-size:9px; opacity:0.7;">▾</span>
        </button>
        <div id="aiToneDropdown" class="ai-tone-dropdown" style="display:none;">
          <div class="ai-tone-dropdown-title">Choose Tone</div>
          <button type="button" class="ai-tone-option" data-tone="thoughtful" onclick="App.selectToneAndRefine('thoughtful', 'editReview')">
            <span class="tone-emoji">🧠</span>
            <div class="tone-text">
              <span class="tone-name">Thoughtful</span>
              <span class="tone-hint">Articulate, balanced literary take</span>
            </div>
            <span class="tone-check" id="toneCheck-thoughtful">✓</span>
          </button>
          <button type="button" class="ai-tone-option" data-tone="punchy" onclick="App.selectToneAndRefine('punchy', 'editReview')">
            <span class="tone-emoji">⚡</span>
            <div class="tone-text">
              <span class="tone-name">Punchy</span>
              <span class="tone-hint">Short, high-energy 1-2 sentence verdict</span>
            </div>
            <span class="tone-check" id="toneCheck-punchy" style="display:none;">✓</span>
          </button>
          <button type="button" class="ai-tone-option" data-tone="vibe" onclick="App.selectToneAndRefine('vibe', 'editReview')">
            <span class="tone-emoji">🌊</span>
            <div class="tone-text">
              <span class="tone-name">The Vibe</span>
              <span class="tone-hint">Atmospheric, pacing & mood-first</span>
            </div>
            <span class="tone-check" id="toneCheck-vibe" style="display:none;">✓</span>
          </button>
          <button type="button" class="ai-tone-option tone-option-roast" data-tone="roast" onclick="App.selectToneAndRefine('roast', 'editReview')">
            <span class="tone-emoji">🔥</span>
            <div class="tone-text">
              <span class="tone-name">Roast</span>
              <span class="tone-hint">Ruthlessly witty critique of flaws</span>
            </div>
            <span class="tone-check" id="toneCheck-roast" style="display:none;">✓</span>
          </button>
        </div>
      </div>
    </div>
    <textarea class="form-textarea" id="editReview" rows="5" placeholder="Write rough bullet points, a favorite line, or thoughts about this book..." oninput="var el=document.getElementById('editReviewCharCount');if(el)el.textContent=((this&&this.value)||'').length+' chars'">${book.review||''}</textarea>
    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:3px; min-height:16px;">
      <div id="aiUndoBar" style="display:none; font-size:10px; color:var(--wood-dark); align-items:center; gap:6px;">
        <span id="aiUndoMsg" style="color:var(--burgundy, #8b2635); font-weight:600;">✨ Refined</span>
        <button type="button" onclick="App.revertAiReview('editReview')" style="background:none; border:none; padding:0; font-size:10px; text-decoration:underline; color:var(--wood-light); cursor:pointer;">Undo / Keep Original</button>
      </div>
      <div id="editReviewCharCount" style="margin-left:auto; font-family:'DM Mono',monospace; font-size:9px; color:var(--wood-light); letter-spacing:0.06em;">${(book.review||'').length} chars</div>
    </div>
  </div>

  <!-- Collapsible Secondary Fields for Cozy Mode -->
  <details class="cozy-advanced-details" ${detailsOpenAttr} style="margin: 14px 0 16px; border: 1px solid rgba(61,43,31,0.12); border-radius: 8px; background: rgba(61,43,31,0.02); overflow: hidden;">
    <summary class="form-label" style="outline: none; user-select: none; display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; margin: 0; cursor: pointer; font-size: 12px; font-weight: 600; color: var(--wood-dark); background: rgba(61,43,31,0.03);">
      <span>More Book Details (Dates, Series, Format, Quotes...)</span>
      <span style="font-size: 12px; font-weight: 400; color: var(--wood-light); transition: transform 0.2s ease;">▼</span>
    </summary>
    <div style="padding: 14px; display: flex; flex-direction: column; gap: 14px;">

      ${isCozy ? `
      <!-- Series, Fiction & Gender (in details for Cozy Mode) -->
      <div style="display:flex; gap:12px; flex-wrap:wrap; padding:10px; background:rgba(61,43,31,0.03); border:1px solid rgba(61,43,31,0.08); border-radius:8px;">
        <div style="flex:1; min-width:130px;">
          <label class="form-label" style="font-size:10px;margin-bottom:4px;">Type</label>
          <div class="format-pill-row" style="gap:4px; display:flex;">
            <button type="button" class="format-pill${book.fiction!==false?' active':''}" id="editFictionBtn" style="font-size:11px; padding:4px 8px; flex:1;" onclick="const fb=document.getElementById('editFictionBtn'), nfb=document.getElementById('editNonfictionBtn'), ef=document.getElementById('editFiction'); if(fb)fb.classList.add('active'); if(nfb)nfb.classList.remove('active'); if(ef)ef.value='fiction';">Fiction</button>
            <button type="button" class="format-pill${book.fiction===false?' active':''}" id="editNonfictionBtn" style="font-size:11px; padding:4px 8px; flex:1;" onclick="const fb=document.getElementById('editFictionBtn'), nfb=document.getElementById('editNonfictionBtn'), ef=document.getElementById('editFiction'); if(nfb)nfb.classList.add('active'); if(fb)fb.classList.remove('active'); if(ef)ef.value='nonfiction';">Non-fiction</button>
          </div>
          <input type="hidden" id="editFiction" value="${book.fiction!==false?'fiction':'nonfiction'}">
        </div>
        <div style="flex:1; min-width:130px;">
          <label class="form-label" style="font-size:10px;margin-bottom:4px;">Author Gender</label>
          <div class="format-pill-row" style="gap:4px; display:flex;">
            <button type="button" class="format-pill gender-btn gender-btn-male${currentGender==='male'?' active':''}" style="font-size:11px; padding:4px 6px; flex:1;" onclick="document.querySelectorAll('.gender-btn').forEach(b=>b.classList.remove('active')); if(this&&this.classList)this.classList.add('active'); const eg=document.getElementById('editAuthorGender'); if(eg)eg.value='male';">♂️ Male</button>
            <button type="button" class="format-pill gender-btn gender-btn-female${currentGender==='female'?' active':''}" style="font-size:11px; padding:4px 6px; flex:1;" onclick="document.querySelectorAll('.gender-btn').forEach(b=>b.classList.remove('active')); if(this&&this.classList)this.classList.add('active'); const eg=document.getElementById('editAuthorGender'); if(eg)eg.value='female';">♀️ Female</button>
            <button type="button" class="format-pill gender-btn gender-btn-unknown${currentGender!=='male'&&currentGender!=='female'?' active':''}" style="font-size:11px; padding:4px 6px; flex:1;" onclick="document.querySelectorAll('.gender-btn').forEach(b=>b.classList.remove('active')); if(this&&this.classList)this.classList.add('active'); const eg=document.getElementById('editAuthorGender'); if(eg)eg.value='unknown';">❓ Other</button>
          </div>
          <input type="hidden" id="editAuthorGender" value="${currentGender}">
        </div>
        <div style="width:100%; display:flex; flex-direction:column; gap:6px;">
          <div style="display:flex; gap:8px;">
            <div style="flex:2;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <label class="form-label" style="font-size:10px; margin:0;">Series Name</label>
                <button type="button" onclick="App.detectEditSeries(true)" title="Auto-detect series" style="background:none;border:none;padding:0;cursor:pointer;font-size:10px;" id="detectSeriesBtnCozy">✨</button>
              </div>
              <input class="form-input" id="editSeriesName" list="existingSeriesDatalist" onblur="App.detectEditSeries()" value="${(book.seriesName||'').replace(/"/g,'&quot;')}" placeholder="e.g. The Lord of the Rings" style="font-size:11px; padding:6px;">
            </div>
            <div style="flex:1;">
              <label class="form-label" style="font-size:10px;margin-bottom:4px;">Book #</label>
              <input class="form-input" id="editSeriesNumber" type="number" value="${book.seriesNumber||''}" min="0" step="0.5" placeholder="e.g. 1" style="font-size:11px; padding:6px;">
            </div>
          </div>
          <div id="seriesSuggestionBadgeCozy" style="display:none; font-size:10px; background:rgba(139,38,53,0.08); border:1px solid rgba(139,38,53,0.2); border-radius:4px; padding:3px 6px; color:var(--burgundy); cursor:pointer;" onclick="App.acceptSeriesSuggestion()"></div>
        </div>
      </div>
      ` : ''}

      <!-- Reading Timeline & Duration -->
      <div class="form-group reading-timeline-card" style="padding:14px;background:rgba(61,43,31,0.03);border:1px solid rgba(61,43,31,0.08);border-radius:10px;margin-bottom:0;" id="editReadingTimeline">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <label class="form-label" style="margin-bottom:0; font-size:12px; font-weight:700;">Reading Timeline & Duration</label>
          <span style="font-family:'DM Mono',monospace; font-size:9px; color:var(--wood-light); letter-spacing:0.04em;">2 Ways to Track</span>
        </div>

        <!-- 1. Calendar Span (Dates) -->
        <div class="reading-timeline-dates" style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px;">
          <div>
            <label style="font-size:10px; font-weight:600; color:var(--wood-medium); margin-bottom:4px; display:block;">📅 Date Started</label>
            <input class="form-input" id="editDateStarted" type="date" value="${book.dateStarted||''}" onchange="App.onTimelineDateChange()" style="font-size:12px; padding:6px 8px; width:100%; box-sizing:border-box;">
          </div>
          <div id="editDateFinishedGroup">
            <label style="font-size:10px; font-weight:600; color:var(--wood-medium); margin-bottom:4px; display:block;">🏁 Date Finished</label>
            <input class="form-input" id="editDateFinished" type="date" value="${book.dateFinished||''}" onchange="App.onTimelineDateChange()" style="font-size:12px; padding:6px 8px; width:100%; box-sizing:border-box;">
          </div>
        </div>

        <!-- Suggestion Banner (if start & finish dates set) -->
        <div id="calendarSpanSuggestion" style="display:none; align-items:center; justify-content:space-between; background:rgba(139,38,53,0.06); border:1px solid rgba(139,38,53,0.18); border-radius:6px; padding:6px 10px; margin-bottom:10px; font-size:11px;">
          <span id="calendarSpanText" style="color:var(--burgundy); font-weight:500;"></span>
          <button type="button" class="btn-secondary" onclick="App.applyCalendarSpanToDays()" style="font-size:10px; padding:2px 8px; border-radius:4px; border:1px solid var(--burgundy); color:var(--burgundy); background:#fff; cursor:pointer;">Use for Days</button>
        </div>

        <!-- 2. Actual Days of Reading (Drives shelf spine height) -->
        <div class="reading-days-card" id="editDaysGroup" style="background:#fff; border:1px solid rgba(61,43,31,0.12); border-radius:8px; padding:10px 12px; margin-bottom:10px; display:flex; align-items:center; justify-content:space-between; gap:12px; box-shadow:0 1px 3px rgba(0,0,0,0.03);">
          <div style="flex:1; min-width:0;">
            <div style="display:flex; align-items:center; gap:6px;">
              <span style="font-size:12px; font-weight:700; color:var(--wood-dark);">Days of Reading</span>
              <span style="font-size:9px; background:rgba(61,43,31,0.08); padding:1px 6px; border-radius:4px; color:var(--wood-light); font-family:'DM Mono',monospace;">Active Reading</span>
            </div>
            <div style="font-size:10px; color:var(--wood-light); margin-top:2px; line-height:1.2;">
              Days spent actually reading this book (shapes spine height on your shelf)
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
            <button type="button" onclick="const el=document.getElementById('editDays'); if(el&&Number(el.value)>1){ el.value=Number(el.value)-1; }" style="width:28px; height:28px; border-radius:6px; border:1px solid rgba(61,43,31,0.2); background:rgba(61,43,31,0.04); font-size:14px; font-weight:bold; cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--wood-dark);">-</button>
            <input class="form-input" id="editDays" type="number" value="${book.days || 1}" min="1" max="999" style="width:58px; font-size:15px; font-weight:700; text-align:center; padding:5px 0;">
            <button type="button" onclick="const el=document.getElementById('editDays'); if(el){ el.value=Number(el.value||0)+1; }" style="width:28px; height:28px; border-radius:6px; border:1px solid rgba(61,43,31,0.2); background:rgba(61,43,31,0.04); font-size:14px; font-weight:bold; cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--wood-dark);">+</button>
          </div>
        </div>

        <!-- Month & Year Placements -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;" id="editMonthYearGroup">
          <div>
            <label style="font-size:10px; color:var(--wood-medium); margin-bottom:4px; display:block;">${App.quarterMode ? 'Quarter Finished' : 'Month Finished'}</label>
            <select class="form-select" id="editMonth" style="font-size:12px; padding:6px 8px; min-height:34px; width:100%;">
              <option value=""${!book.month ? ' selected' : ''}>Sometime in ${App.currentYear}</option>
              ${(App.quarterMode ? ['Q1','Q2','Q3','Q4'] : ALL_MONTHS).map(m=>`<option value="${m}"${book.month===m?' selected':''}>${m}</option>`).join('')}
            </select>
          </div>
          ${(function(){
            let iy = App.currentYear;
            if (book.shelfId && App.userYears) {
              let sy = App.userYears.find(y => y.id === book.shelfId);
              if (sy && sy.year) iy = sy.year;
            }
            return '<div><label style="font-size:10px; color:var(--wood-medium); margin-bottom:4px; display:block;">Finish Year</label><input class="form-input" id="editFinishYear" type="number" value="' + iy + '" min="1900" max="2100" style="font-size:12px; padding:6px 8px; width:100%; box-sizing:border-box;" oninput=\'var y=document.getElementById("editBOTYYear");if(y)y.textContent=this.value;\'></div>';
          })()}
        </div>
      </div>

      <!-- Publication Year, Word Count, Country -->
      <div class="edit-meta-trio" style="display:flex;gap:12px;align-items:flex-end;">
        <div class="form-group" style="flex:1.2;min-width:0;margin-bottom:0;position:relative;">
          <div style="display:flex;justify-content:space-between;align-items:flex-end;">
            <label class="form-label" style="line-height:1.15;display:inline-block;padding-bottom:2px;">Publication<br>Year</label>
            <button type="button" id="editPubYearCustomToggle" onclick="App.togglePubYearCustom()" style="background:none;border:none;color:var(--burgundy);font-size:10px;cursor:pointer;padding:0 0 2px 0;text-decoration:underline;font-weight:600;white-space:nowrap;" title="Toggle custom release year">Custom</button>
          </div>
          <select class="form-input" id="editPubYearSelect" style="font-size:12px;padding:6px 6px;cursor:pointer;width:100%;box-sizing:border-box;text-overflow:ellipsis;" onchange="App.onPubYearSelectChange(this.value)">
            ${pubYearOptionsHTML}
          </select>
          <input class="form-input" id="editPubYearCustom" type="number" value="${book.year||''}" placeholder="e.g. 1954" min="1000" max="2100" style="display:none;font-size:12px;padding:6px 8px;width:100%;box-sizing:border-box;" oninput="App.onPubYearCustomInput(this.value)">
          <input type="number" id="editPubYear" value="${book.year||''}" style="display:none;">
        </div>
        <div class="form-group" style="flex:1.5;margin-bottom:0;">
            <label class="form-label">Word Count <br><span id="editWcSourceBadge" style="font-size:9px;padding:1px 6px;border-radius:8px;margin-top:4px;display:inline-block;font-family:'DM Mono',monospace;letter-spacing:0.06em;${(book.wordCountSource==='unknown'||!book.wordCountSource)?'background:rgba(218,165,32,0.18);color:#b8860b;':'background:rgba(61,43,31,0.08);color:var(--wood-light);'}">${book.wordCountSource==='user_override'?'✓ manual':book.wordCountSource==='openlibrary'?'📚 Open Library':book.wordCountSource==='googlebooks'?'📖 Google Books':book.wordCountSource==='calculated'?'⚠ estimated':book.wordCountSource==='provided'?'✓ provided':'⚠ estimated'}</span></label>
            <div style="display:flex;gap:8px;align-items:center;">
               <input class="form-input" id="editWords" type="number" value="${book.words}" min="1000" step="1000" style="flex:1;" oninput="App.onEditWordCountManual()">
            </div>
        </div>
        <div class="form-group" style="flex:1.5;margin-bottom:0;">
            <label class="form-label">Country</label>
            <div style="display:flex;align-items:center;gap:6px;">
               ${(()=>{
                  const p = book.authorRegion ? NationalizeAPI.parseFromDB(book.authorRegion) : null;
                  const isKnown = p && p.flag && p.flag !== '🏳️';
                  if (isKnown) {
                    return `
                      <div id="authorRegionDisplay" style="display:flex;align-items:center;gap:6px;flex:1;font-size:12px;padding:4px 0;">
                        <span style="font-size:16px;line-height:1;">${p.flag}</span>
                        <span style="flex:1;">${book.authorRegion.split('|')[1] || book.authorRegion || p.region}</span>
                        <button type="button" class="btn-secondary" style="font-size:9px;padding:4px;" onclick="document.getElementById('authorRegionDisplay').style.display='none'; document.getElementById('authorRegionInputGroup').style.display='flex';">Edit</button>
                      </div>
                      <div id="authorRegionInputGroup" style="display:none;align-items:center;gap:6px;flex:1;">
                        <input class="form-input" id="editAuthorRegion" oninput="App.onAuthorRegionInput()" value="${book.authorRegion}" placeholder="e.g. USA" style="flex:1;font-size:11px;" list="countryDatalist">
                        <span id="editRegionPreview" style="font-size:16px;line-height:1;cursor:pointer;" onclick="App.openCountryPicker()" title="Click to select country">${p.flag}</span>
                      </div>
                    `;
                  } else {
                    return `
                      <div id="authorRegionInputGroup" style="display:flex;align-items:center;gap:6px;flex:1;">
                        <input class="form-input" id="editAuthorRegion" oninput="App.onAuthorRegionInput()" value="${book.authorRegion || ''}" placeholder="e.g. USA" style="flex:1;font-size:11px;" list="countryDatalist">
                        <span id="editRegionPreview" style="font-size:16px;line-height:1;cursor:pointer;" onclick="App.openCountryPicker()" title="Click to select country">🏳️</span>
                      </div>
                    `;
                  }
               })()}
            </div>
            <datalist id="countryDatalist">
  <option value="US|United States|🇺🇸"><option value="GB|United Kingdom|🇬🇧"><option value="CA|Canada|🇨🇦"><option value="AU|Australia|🇦🇺"><option value="IN|India|🇮🇳"><option value="DE|Germany|🇩🇪"><option value="FR|France|🇫🇷"><option value="JP|Japan|🇯🇵"><option value="BR|Brazil|🇧🇷"><option value="MX|Mexico|🇲🇽"><option value="IT|Italy|🇮🇹"><option value="ES|Spain|🇪🇸"><option value="SE|Sweden|🇸🇪"><option value="NO|Norway|🇳🇴"><option value="IE|Ireland|🇮🇪"><option value="NG|Nigeria|🇳🇬"><option value="ZA|South Africa|🇿🇦"><option value="CN|China|🇨🇳"><option value="RU|Russia|🇷🇺"><option value="KR|South Korea|🇰🇷"><option value="AR|Argentina|🇦🇷"><option value="CL|Chile|🇨🇱"><option value="CO|Colombia|🇨🇴"><option value="NZ|New Zealand|🇳🇿"><option value="PL|Poland|🇵🇱"><option value="NL|Netherlands|🇳🇱"><option value="IL|Israel|🇮🇱"><option value="TR|Turkey|🇹🇷"><option value="PK|Pakistan|🇵🇰"><option value="PH|Philippines|🇵🇭">
  </datalist>
        </div>
      </div>

      <!-- Format, Language & Narrator -->
      <div class="form-group" style="display:flex;align-items:flex-start;gap:12px;padding:12px;background:rgba(61,43,31,0.03);border:1px solid rgba(61,43,31,0.08);border-radius:8px;margin-bottom:0;">
        <div style="flex:1;display:flex;flex-direction:column;gap:12px;">
          <div style="display:flex;gap:8px;">
            <div class="form-group" style="flex:1;margin:0;"><label class="form-label" style="font-size:10px;margin-bottom:4px;">Format</label>
              <select class="form-select" id="editFormat" onchange="App.syncEditDuration()" style="font-size:12px;padding:4px 8px;min-height:30px;">
              <option value="physical"${(book.format||'physical')==='physical'?' selected':''}>📕 Physical</option>
              <option value="ebook"${book.format==='ebook'?' selected':''}>📱 E-book</option>
              <option value="audiobook"${book.format==='audiobook'?' selected':''}>🎧 Audiobook</option>
              </select>
            </div>
            <div class="form-group" style="flex:1;margin:0;"><label class="form-label" style="font-size:10px;margin-bottom:4px;">Language</label>
              <select class="form-select" id="editLanguage" style="font-size:12px;padding:4px 8px;min-height:30px;">${languageOptionsHTML(book.language||'English')}</select>
            </div>
          </div>
          <div class="form-group" id="editDurationGroup" style="${book.format==='audiobook'?'':'display:none;'}margin:0;">
             <label class="form-label" style="font-size:10px;margin-bottom:4px;">Duration (auto)</label>
             <input class="form-input" id="editDuration" type="text" value="${book.format==='audiobook'&&book.durationHours?Math.floor(book.durationHours)+'h '+Math.round((book.durationHours%1)*60)+'m':'-'}" readonly style="font-size:12px;padding:4px 8px;min-height:30px;background:rgba(61,43,31,0.03);color:var(--wood-light);">
          </div>
          <div class="form-group" id="editNarratorGroup" style="${book.format==='audiobook'?'':'display:none;'}margin:0;">
             <label class="form-label" style="font-size:10px;margin-bottom:4px;">Narrator</label>
             <input class="form-input" id="editNarrator" type="text" value="${(book.narrator||'').replace(/"/g,'&quot;')}" placeholder="e.g. Jim Dale" style="font-size:12px;padding:4px 8px;min-height:30px;">
          </div>
        </div>
      </div>

      <!-- Vibe & Style Tags -->
      <div class="form-group" style="padding:12px;background:rgba(121, 91, 143, 0.08);border:1px solid rgba(121, 91, 143, 0.2);border-radius:8px;margin-bottom:0;">
        <details style="cursor:pointer;" ${detailsOpenAttr}><summary class="form-label" style="outline:none;user-select:none;display:flex;justify-content:space-between;margin-bottom:0;color:#5a3e6b;">Vibe, Topic & Style Tags <span style="font-weight:400;color:rgba(90, 62, 107, 0.6);font-size:12px;line-height:1;margin-top:2px;">▼</span></summary><div class="mood-chips" id="editMoodChips" style="flex-direction:row;flex-wrap:wrap;max-height:none;overflow-y:visible;margin-top:10px;"></div></details>
      </div>

      <!-- Book Club -->
      <div class="form-group" style="margin-bottom:0;"><label style="display:flex;gap:10px;align-items:flex-start;cursor:pointer;"><input type="checkbox" id="editReadingClub" ${book.readingClub?'checked':''} onchange="var el=document.getElementById('editClubNameRow');if(el)el.style.display=(this&&this.checked)?'block':'none';"><span class="form-label" style="margin:0;">Read with a book club</span></label>
        <div id="editClubNameRow" style="${book.readingClub?'':'display:none;'}margin-top:8px;">
          ${(()=>{
             const legacyClubs = Array.from(new Set(App.books.filter(b => b.readingClub).map(b => b.readingClub)));
             const phase2Clubs = (window._dbClubsForModal || []).map(c => c.name);
             const clubs = Array.from(new Set([...legacyClubs, ...phase2Clubs])).sort();
             let isCustom = book.readingClub && !clubs.includes(book.readingClub);
             let opts = '<option value="">-- Select a Club --</option>';
             clubs.forEach(c => { opts += '<option value="'+c.replace(/"/g,'&quot;')+'"'+(c===book.readingClub?' selected':'')+'>'+c+'</option>'; });
             opts += '<option value="__NEW__"'+(isCustom?' selected':'')+'>+ New Club</option>';
             return `
             <select class="form-select" id="editClubSelect" style="margin-bottom:8px;font-size:12px;padding:6px;min-height:32px;" onchange="var el=document.getElementById('editClubNameNew');if(el){el.style.display=(this&&this.value==='__NEW__')?'block':'none';if(this&&this.value==='__NEW__')el.focus();}">
               ${opts}
             </select>
             <input class="form-input" id="editClubNameNew" type="text" value="${isCustom ? (book.readingClub||'').replace(/"/g,'&quot;') : ''}" placeholder="New club name..." maxlength="100" style="${isCustom?'':'display:none;'}">
             `;
          })()}
        </div>
      </div>

      <!-- Quotes -->
      <div class="form-group" style="margin-bottom:0;"><label class="form-label">Favorite quotes <span style="color:var(--wood-light);font-weight:normal;">(optional)</span></label><textarea class="form-textarea" id="editQuotes" maxlength="2000" placeholder="A passage worth keeping..." style="min-height:64px;">${(book.favoriteQuotes||'').replace(/</g,'&lt;')}</textarea></div>

      <!-- Re-read & DNF -->
      <div style="display:flex;gap:12px;align-items:center;">
        <div class="form-group" style="flex:1;margin-bottom:0;">
          <label class="quarter-toggle" style="margin-left:0;"><input type="checkbox" id="editIsReread" ${book.isReread?'checked':''} onchange="var el=document.getElementById('editOrigReadYearGroup');if(el)el.style.display=(this&&this.checked)?'':'none';"><div class="toggle-track"></div>🔄 Re-read</label>
          <div id="editOrigReadYearGroup" style="${book.isReread?'':'display:none;'}margin-top:6px;">
            <label class="form-label">Originally Read (year)</label>
            <input class="form-input" id="editOriginalReadYear" type="number" value="${book.originalReadYear||''}" min="1900" max="2100" placeholder="e.g. 2019" style="width:120px;">
          </div>
        </div>
        <div class="form-group" style="flex:1;margin-bottom:0;">
          <label class="quarter-toggle" style="margin-left:0;"><input type="checkbox" id="editDnf" ${book.dnf?'checked':''} onchange="var el=document.getElementById('editDnfReasonGroup');if(el)el.style.display=(this&&this.checked)?'':'none';"><div class="toggle-track"></div>🚫 Did Not Finish</label>
          <div id="editDnfReasonGroup" style="${book.dnf?'':'display:none;'}margin-top:6px;">
            <label class="form-label">Reason (optional)</label>
            <input class="form-input" id="editDnfReason" value="${(book.dnfReason||'').replace(/"/g,'&quot;')}" placeholder="Lost interest, too slow..." style="font-size:11px;">
          </div>
        </div>
      </div>

      <!-- Private Toggle -->
      <label class="privacy-toggle" for="editPrivate" style="margin-bottom:0;"><input type="checkbox" id="editPrivate" ${book.isPrivate?'checked':''}><span class="privacy-toggle-text"><strong>🔒 Keep this book private</strong><span>Hidden from followers and public profile.</span></span></label>

    </div>
  </details>

  <div id="editValidationMsg" style="font-size:11px;color:var(--dislike);min-height:16px;margin-bottom:4px;"></div>

  <div class="edit-modal-footer">
    ${mode === 'add' ? '' : `<button class="btn-danger-ghost btn-footer-delete" onclick="App.closeModal('editBookModal');App.confirmDeleteBook('${book.id}')" title="Delete Book" aria-label="Delete Book"><span class="btn-icon">🗑️</span><span class="btn-label-text"> Delete Book</span></button>`}
    <div class="edit-modal-footer-right" ${mode === 'add' ? 'style="width:100%;justify-content:flex-end;"' : ''}>
      ${mode === 'add' ? `<button class="btn-secondary btn-footer-cancel" onclick="App.closeModal('editBookModal'); App.openModal('addBookModal');" title="Back" aria-label="Back"><span class="btn-icon">❌</span><span class="btn-label-text"> Back</span></button>` : `<button class="btn-secondary btn-footer-cancel" onclick="App.closeModal('editBookModal');" title="Cancel" aria-label="Cancel"><span class="btn-icon">❌</span><span class="btn-label-text"> Cancel</span></button>`}
      <button class="btn-primary btn-footer-save" id="saveEditBtn" onclick="App.saveEdit()" title="${mode === 'add' ? 'Add to Library' : 'Save Changes'}" aria-label="${mode === 'add' ? 'Add to Library' : 'Save Changes'}"><span class="btn-icon">💾</span><span class="btn-label-text"> ${mode === 'add' ? 'Add to Library' : 'Save Changes'}</span></button>
    </div>
  </div>

  `;

  closePanel();

  this.openModal('editBookModal');

  this.switchHubTab('details');

  setTimeout(()=>{ const _mc=document.getElementById('editBookModal')?.querySelector('.modal-card'); if(_mc) _mc.scrollTop=0; },0);

  renderMoodPicker('editMoodChips', book.moods || [], book.genre, book.sentiment);

  const _tabF = document.getElementById('hubTabFinish');
  if (_tabF) _tabF.style.display = book.status === 'finished' ? 'none' : '';
  const _tabP = document.getElementById('hubTabProgress');
  if (_tabP) _tabP.style.display = (book.status === 'reading' || book.currentlyReading) ? '' : 'none';

  setTimeout(() => (typeof this.selectEditStatus === 'function' ? this.selectEditStatus(book.status || (book.currentlyReading ? 'reading' : 'finished')) : App.selectEditStatus(book.status || (book.currentlyReading ? 'reading' : 'finished'))), 0);

}

export function selectEditStatus(status) {
  const curApp = this && typeof this.syncEditCR === 'function' ? this : (typeof window !== 'undefined' ? window.App : null);
  document.querySelectorAll('#editStatusSelector .status-opt').forEach(o => {
    o.classList.toggle('selected', o.dataset.status === status);
  });

  const isToRead = (status === 'to-read');
  const isReading = (status === 'reading');
  const isFinished = (status === 'finished');

  const finishedFields = document.getElementById('editFinishedFields');
  const toReadGroup = document.getElementById('editToReadNotesGroup');
  const reviewGroup = document.getElementById('editReviewGroup');

  if (finishedFields) finishedFields.style.display = isToRead ? 'none' : '';
  if (reviewGroup) reviewGroup.style.display = isToRead ? 'none' : '';
  if (toReadGroup) toReadGroup.style.display = isToRead ? '' : 'none';

  const dfGroup = document.getElementById('editDateFinishedGroup');
  const daysGroup = document.getElementById('editDaysGroup');
  const myGroup = document.getElementById('editMonthYearGroup');
  const spanBanner = document.getElementById('calendarSpanSuggestion');
  if (dfGroup) dfGroup.style.display = isReading ? 'none' : '';
  if (daysGroup) daysGroup.style.display = isReading ? 'none' : '';
  if (myGroup) myGroup.style.display = isReading ? 'none' : '';
  if (spanBanner && isReading) spanBanner.style.display = 'none';

  const cr = document.getElementById('editCurrentlyReading');
  if (cr) {
    cr.checked = isReading;
  }
  if (curApp && typeof curApp.syncEditCR === 'function') {
    curApp.syncEditCR(isReading);
  }

  const tabP = document.getElementById('hubTabProgress');
  if (tabP) tabP.style.display = isReading ? '' : 'none';
  const tabF = document.getElementById('hubTabFinish');
  if (tabF) tabF.style.display = isFinished ? 'none' : '';
}

export async function fetchAlternativeCover() {
  const title = (document.getElementById('editTitle')?.value || (this.editingBook && this.editingBook.title) || '').trim();
  const author = (document.getElementById('editAuthor')?.value || (this.editingBook && this.editingBook.author) || '').trim();
  if (!title) {
    if (typeof showToast === 'function') showToast('Please enter a title first.');
    return;
  }
  
  if (typeof showToast === 'function') showToast('Searching for covers...');
  try {
    const q = encodeURIComponent(`${title} ${author}`.trim());
    const res = await fetch(`https://openlibrary.org/search.json?q=${q}&limit=8`);
    if (!res.ok) throw new Error('Cover search request failed');
    const data = await res.json();
    const docs = data.docs || [];
    const covers = [];
    docs.forEach(d => {
      if (d.cover_i) {
        covers.push(`https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg`);
      }
    });

    if (!covers.length) {
      if (typeof showToast === 'function') showToast('No alternative covers found.');
      return;
    }

    let picker = document.getElementById('altCoverPickerModal');
    if (!picker) {
      picker = document.createElement('div');
      picker.id = 'altCoverPickerModal';
      picker.className = 'modal-overlay';
      picker.style.zIndex = '100002';
      document.body.appendChild(picker);
    }
    picker.innerHTML = `
      <div class="modal-card" style="max-width: 480px; width: 90%; max-height: 80vh; overflow-y: auto; padding: 20px; background: #fff; border-radius: 12px; position: relative;">
        <button class="modal-close" onclick="document.getElementById('altCoverPickerModal')?.classList.remove('open')" style="position: absolute; top: 12px; right: 12px; font-size: 20px; background: none; border: none; cursor: pointer;">&times;</button>
        <h3 style="margin-top: 0; margin-bottom: 12px; font-size: 16px; color: var(--wood-dark);">Select Alternative Cover</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap: 10px;">
          ${covers.map(url => `
            <div style="cursor: pointer; border-radius: 4px; overflow: hidden; border: 2px solid transparent; transition: border-color 0.2s;" onmouseover="this.style.borderColor='var(--burgundy)'" onmouseout="this.style.borderColor='transparent'" onclick="App.previewEditCover('${url}'); document.getElementById('altCoverPickerModal')?.classList.remove('open');">
              <img src="${url}" style="width: 100%; height: 135px; object-fit: cover;" onerror="this.parentElement.style.display='none'">
            </div>
          `).join('')}
        </div>
      </div>
    `;
    picker.onclick = (e) => { if (e.target === picker) picker.classList.remove('open'); };
    picker.classList.add('open');
  } catch (err) {
    console.error('fetchAlternativeCover error:', err);
    if (typeof showToast === 'function') showToast('Could not fetch alternative covers');
  }
}

export function previewEditCover(url) {
  if (!url) return;
  const previewEl = document.getElementById('editCoverPreview');
  if (previewEl) {
    previewEl.innerHTML = `<img loading="lazy" decoding="async" src="${url}" style="width:100%;height:100%;object-fit:cover;" onerror="if(this&&this.parentElement)this.parentElement.textContent=String.fromCodePoint(0x1F4D8);">`;
  }
  const inputEl = document.getElementById('editCoverUrlInput');
  if (inputEl) inputEl.value = url;
  if (this.editingBook) {
    this.editingBook.coverUrl = url;
  }
}

export async function detectEditWordCount() {
  const title = (document.getElementById('editTitle')?.value || (this.editingBook && this.editingBook.title) || '').trim();
  const author = (document.getElementById('editAuthor')?.value || (this.editingBook && this.editingBook.author) || '').trim();
  if (!title) return;
  try {
    const api = (typeof WordCountAPI !== 'undefined' ? WordCountAPI : (window.App && window.App.WordCountAPI));
    if (api && typeof api.lookup === 'function') {
      const res = await api.lookup(title, author);
      const words = (res && (res.words || res.wordCount)) ? (res.words || res.wordCount) : null;
      if (words) {
        const wcInput = document.getElementById('editWords');
        if (wcInput) wcInput.value = words;
        const badge = document.getElementById('editWcSourceBadge');
        if (badge) {
          badge.textContent = res.source === 'openlibrary' ? '📚 Open Library' : res.source === 'googlebooks' ? '📖 Google Books' : res.source === 'calculated' ? '⚠ estimated' : '✓ provided';
          badge.style.background = 'rgba(61,43,31,0.08)';
          badge.style.color = 'var(--wood-light)';
        }
        this._editWcEstimated = (res.source === 'calculated' || res.source === 'estimated');
        return;
      }
    }
  } catch (err) {
    console.warn('detectEditWordCount lookup error:', err);
  }
}

export async function detectEditRegion() {
  const author = (document.getElementById('editAuthor')?.value || (this.editingBook && this.editingBook.author) || '').trim();
  if (!author) return;

  // 1. Instant local first-name and demo database detection
  const egInput = document.getElementById('editAuthorGender');
  const isGenderUnknown = !egInput || !egInput.value || egInput.value === 'unknown';
  if (isGenderUnknown) {
    const fastGender = (typeof DEMO_AUTHOR_GENDERS !== 'undefined' && DEMO_AUTHOR_GENDERS[author]?.gender) ||
                       (typeof guessGenderFromName === 'function' ? guessGenderFromName(author) : (typeof window !== 'undefined' && window.guessGenderFromName ? window.guessGenderFromName(author) : null));
    if (fastGender && fastGender !== 'Unknown') {
      const gLower = fastGender.toLowerCase();
      if (egInput) egInput.value = gLower;
      document.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('active'));
      const targetBtn = document.querySelector(`.gender-btn-${gLower}`);
      if (targetBtn) targetBtn.classList.add('active');
      if (this.editingBook) {
        this.editingBook.authorGender = fastGender;
        this.editingBook.author_gender = gLower;
      }
    }
  }

  // 2. Async Wikidata demographics detection (gender, region, country flag)
  try {
    const api = (typeof WikidataAPI !== 'undefined' && WikidataAPI) || (typeof window !== 'undefined' && window.WikidataAPI);
    if (api && typeof api.detectAuthorDemographics === 'function') {
      const demo = await api.detectAuthorDemographics(author);
      if (demo) {
        if (demo.region) {
          const arInput = document.getElementById('editAuthorRegion');
          if (arInput && (!arInput.value || arInput.value === 'undefined')) {
            arInput.value = demo.dbString || demo.region;
          }
          const preview = document.getElementById('editRegionPreview');
          if (preview && demo.flag) preview.textContent = demo.flag;
          const flagPrev = document.getElementById('editAuthorFlagPreview');
          if (flagPrev && demo.flag) flagPrev.textContent = demo.flag;
        }

        // Auto-select gender if still unknown
        if (demo.gender && demo.gender !== 'Unknown') {
          const egNow = document.getElementById('editAuthorGender');
          if (egNow && (!egNow.value || egNow.value === 'unknown')) {
            const gLower = demo.gender.toLowerCase();
            egNow.value = gLower;
            document.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('active'));
            const targetBtn = document.querySelector(`.gender-btn-${gLower}`);
            if (targetBtn) targetBtn.classList.add('active');
            if (this.editingBook) {
              this.editingBook.authorGender = demo.gender;
              this.editingBook.author_gender = gLower;
              if (demo.confidence) this.editingBook.authorGenderConfidence = demo.confidence;
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('detectEditRegion error:', err);
  }
}

export function onEditWordCountManual() {
  this._editWcEstimated = false;
  const badge = document.getElementById('editWcSourceBadge');
  if (badge) {
    badge.textContent = '✓ manual';
    badge.style.background = 'rgba(61,43,31,0.08)';
    badge.style.color = 'var(--wood-light)';
  }
}

export function onAuthorRegionInput() {
  const val = document.getElementById('editAuthorRegion')?.value || '';
  const parsed = (typeof NationalizeAPI !== 'undefined' && typeof NationalizeAPI.parseFromDB === 'function')
    ? NationalizeAPI.parseFromDB(val)
    : null;
  const flag = (parsed && parsed.flag) ? parsed.flag : (val.includes('|') ? (val.split('|')[2] || '🏳️') : '🏳️');
  const preview = document.getElementById('editRegionPreview');
  if (preview) preview.textContent = flag;
  const flagPrev = document.getElementById('editAuthorFlagPreview');
  if (flagPrev) flagPrev.textContent = flag;
}

export function openCountryPicker() {
  const input = document.getElementById('editAuthorRegion');
  if (input) {
    input.focus();
    if (typeof input.showPicker === 'function') {
      try { input.showPicker(); } catch(e) {}
    }
  }
}

export function syncEditDuration() {
  const fmt = document.getElementById('editFormat')?.value || 'physical';
  const durGroup = document.getElementById('editDurationGroup');
  const narrGroup = document.getElementById('editNarratorGroup');
  const isAudio = (fmt === 'audiobook');
  if (durGroup) durGroup.style.display = isAudio ? '' : 'none';
  if (narrGroup) narrGroup.style.display = isAudio ? '' : 'none';
  if (isAudio) {
    const words = parseInt(document.getElementById('editWords')?.value) || (this.editingBook ? this.editingBook.words : 80000) || 80000;
    const durHours = words / 9000;
    const h = Math.floor(durHours);
    const m = Math.round((durHours % 1) * 60);
    const durInput = document.getElementById('editDuration');
    if (durInput) durInput.value = `${h}h ${m}m`;
  }
}

export function autoCalcDays() {
  return onTimelineDateChange();
}

export function onTimelineDateChange() {
  const sVal = document.getElementById('editDateStarted')?.value;
  const fVal = document.getElementById('editDateFinished')?.value;
  const banner = document.getElementById('calendarSpanSuggestion');
  const spanText = document.getElementById('calendarSpanText');
  const daysInput = document.getElementById('editDays');

  if (sVal && fVal) {
    const d1 = new Date(sVal);
    const d2 = new Date(fVal);
    if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
      const diffMs = d2.getTime() - d1.getTime();
      const spanDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);
      if (banner && spanText) {
        spanText.textContent = `📅 ${spanDays} day${spanDays > 1 ? 's' : ''} calendar span`;
        banner.style.display = 'flex';
      }
      if (daysInput && (!daysInput.value || daysInput.value === '1' || daysInput.value === '0')) {
        daysInput.value = spanDays;
      }
    } else if (banner) {
      banner.style.display = 'none';
    }
  } else if (banner) {
    banner.style.display = 'none';
  }

  if (fVal) {
    const d2 = new Date(fVal);
    if (!isNaN(d2.getTime())) {
      const mName = ALL_MONTHS[d2.getMonth()];
      const mSelect = document.getElementById('editMonth');
      if (mSelect && mName) mSelect.value = mName;
    }
  }
}

export function applyCalendarSpanToDays() {
  const sVal = document.getElementById('editDateStarted')?.value;
  const fVal = document.getElementById('editDateFinished')?.value;
  if (!sVal || !fVal) return;
  const d1 = new Date(sVal);
  const d2 = new Date(fVal);
  if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
    const diffMs = d2.getTime() - d1.getTime();
    const spanDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);
    const daysInput = document.getElementById('editDays');
    if (daysInput) daysInput.value = spanDays;
    const banner = document.getElementById('calendarSpanSuggestion');
    if (banner) banner.style.display = 'none';
  }
}

export async function detectEditSeries(force = false) {
  const nameInput = document.getElementById('editSeriesName');
  const numInput = document.getElementById('editSeriesNumber');
  if (!nameInput) return;

  const allBooks = (this && this.books) || (typeof window !== 'undefined' && window.App && window.App.books) || [];
  let currentName = (nameInput.value || '').trim();
  let currentNum = (numInput && numInput.value !== '') ? parseFloat(numInput.value) : null;

  const title = (document.getElementById('editTitle')?.value || (this.editingBook && this.editingBook.title) || '').trim();
  const author = (document.getElementById('editAuthor')?.value || (this.editingBook && this.editingBook.author) || '').trim();

  // 1. Check acronym expansion first
  if (currentName) {
    const lower = currentName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const expanded = SERIES_ACRONYMS[lower];
    if (expanded && expanded.toLowerCase() !== currentName.toLowerCase()) {
      nameInput.value = expanded;
      currentName = expanded;
    }
  }

  // 2. Library consensus & typo matching on existing input
  if (currentName) {
    const libraryMatch = findMatchingLibrarySeries(currentName, author, allBooks);
    if (libraryMatch && libraryMatch !== currentName) {
      nameInput.value = libraryMatch;
      currentName = libraryMatch;
    }
  }

  const hasName = Boolean(nameInput.value && nameInput.value.trim().length > 0);
  const hasNum = currentNum !== null && !isNaN(currentNum);

  // If user already has both series name and series number, nothing to auto-detect unless forced
  if (!force && hasName && hasNum) return;

  if (!title) return;

  const btn = document.getElementById('detectSeriesBtn') || document.getElementById('detectSeriesBtnCozy');
  if (btn) {
    btn.style.opacity = '0.5';
    btn.textContent = '⏳';
  }

  try {
    const fetcher = (typeof SeriesMetadataFetcher !== 'undefined') ? SeriesMetadataFetcher : (window.App && window.App.SeriesMetadataFetcher);
    if (fetcher && typeof fetcher.detectSeriesForBook === 'function') {
      const res = await fetcher.detectSeriesForBook(title, author);
      if (res && res.seriesName) {
        // Harmonize detected series with existing library series first
        const canonicalSeries = findMatchingLibrarySeries(res.seriesName, author, allBooks) || res.seriesName;

        // 1. If name was empty, or forced, fill it in
        if (!nameInput.value || force) {
          nameInput.value = canonicalSeries;
        } else if (isTypoOrVariant(nameInput.value, canonicalSeries)) {
          // 2. Existing entry has a typo or variation: auto-correct with zero clicks!
          nameInput.value = canonicalSeries;
        } else if (nameInput.value.trim().toLowerCase() !== canonicalSeries.toLowerCase()) {
          // 3. Different user custom entry: offer suggestion chip
          if (typeof window !== 'undefined' && window.App) window.App._pendingSeriesSuggestion = { ...res, seriesName: canonicalSeries };
          const badges = document.querySelectorAll('#seriesSuggestionBadge, #seriesSuggestionBadgeCozy');
          badges.forEach(b => {
            b.textContent = `✨ Verified: "${canonicalSeries}${res.seriesNumber ? ' #' + res.seriesNumber : ''}" (Tap to use)`;
            b.style.display = 'block';
          });
        }

        // 4. If book # was missing, fill it in!
        if (numInput && (numInput.value === '' || force) && res.seriesNumber !== null && res.seriesNumber !== undefined) {
          numInput.value = res.seriesNumber;
        }
      }
    }

    // 5. If series number still missing, backfill from volume parsing
    if (nameInput.value && numInput && numInput.value === '') {
      const fetcher = (typeof SeriesMetadataFetcher !== 'undefined') ? SeriesMetadataFetcher : (window.App && window.App.SeriesMetadataFetcher);
      if (fetcher && typeof fetcher._parseVolumeNumber === 'function') {
        const parsedNum = fetcher._parseVolumeNumber(title, '', '', nameInput.value);
        if (parsedNum != null && !isNaN(parsedNum)) {
          numInput.value = parsedNum;
        }
      }
    }
  } catch (err) {
    console.warn('[detectEditSeries] Error:', err);
  } finally {
    if (btn) {
      btn.style.opacity = '1';
      btn.textContent = '✨';
    }
  }
}

export function acceptSeriesSuggestion() {
  const res = (typeof window !== 'undefined' && window.App && window.App._pendingSeriesSuggestion);
  if (!res) return;
  const nameInput = document.getElementById('editSeriesName');
  const numInput = document.getElementById('editSeriesNumber');
  if (nameInput && res.seriesName) nameInput.value = res.seriesName;
  if (numInput && res.seriesNumber !== null && res.seriesNumber !== undefined) numInput.value = res.seriesNumber;
  const badges = document.querySelectorAll('#seriesSuggestionBadge, #seriesSuggestionBadgeCozy');
  badges.forEach(b => { b.style.display = 'none'; });
}

export function _autoEnrichSeries() {
  const fetcher = (typeof SeriesMetadataFetcher !== 'undefined') ? SeriesMetadataFetcher : (window.App && window.App.SeriesMetadataFetcher);
  if (!fetcher || typeof fetcher.autoEnrichShelfSeries !== 'function' || !this.books || this.books.length === 0) return;
  fetcher.autoEnrichShelfSeries(this.books, async (bookId, seriesData) => {
    const book = this.books.find(b => String(b.id) === String(bookId));
    if (book) {
      book.seriesName = seriesData.seriesName;
      book.seriesNumber = seriesData.seriesNumber;
      try {
        await DB.updateBook(bookId, {
          series_name: seriesData.seriesName,
          series_number: seriesData.seriesNumber
        });
      } catch (e) {
        console.warn('[_autoEnrichSeries] DB update error:', e);
      }
    }
  });
}

export async function deleteBook(id) {
  if (!id) return;
  try {
    await DB.deleteBook(id);
    if (this.books) {
      this.books = this.books.filter(b => b.id !== id);
    }
    if (this.toReadBooks) {
      this.toReadBooks = this.toReadBooks.filter(b => b.id !== id);
    }
    if (this.currentlyReadingBook && this.currentlyReadingBook.id === id) {
      this.currentlyReadingBook = null;
    }
    if (this.allGuestBooks) {
      this.allGuestBooks = this.allGuestBooks.filter(b => b.id !== id);
      try {
        localStorage.setItem('notetoshelf_guest_books', JSON.stringify(this.allGuestBooks));
      } catch (e) {}
    }
    closeModal('bookModal');
    closeModal('editBookModal');
    if (typeof this.render === 'function') {
      this.render();
    }
    if (typeof showToast === 'function') showToast('Book deleted');
  } catch (err) {
    console.error('deleteBook error:', err);
    if (typeof showToast === 'function') showToast('Failed to delete book');
  }
}

export async function confirmDeleteBook(id) {
  if (!id) return;
  const book = (typeof this._findBookById === 'function') ? this._findBookById(id) : (this.books || []).find(b => b.id === id);
  const title = book ? book.title : 'this book';
  if (!window.confirm(`Are you sure you want to delete "${title}"?`)) return;
  await this.deleteBook(id);
}

export async function saveEdit() {

 const b = this.editingBook;

 if(!b) return;

 const idx = this.books.findIndex(x => x.id === b.id);

 const msgEl = document.getElementById('editValidationMsg');

 const finishYear = parseInt(document.getElementById('editFinishYear')?.value) || App.currentYear;

 const rawMonth = document.getElementById('editMonth')?.value || '';
 const dateFinishedInput = document.getElementById('editDateFinished')?.value || null;
 let resolvedMonth = rawMonth;
 if (!resolvedMonth && dateFinishedInput) {
   const d = new Date(dateFinishedInput);
   if (!isNaN(d.getTime())) resolvedMonth = ALL_MONTHS[d.getMonth()];
 }
 if (!resolvedMonth && b.month && ALL_MONTHS.includes(b.month)) {
   resolvedMonth = b.month;
 }
 if (!resolvedMonth) {
   resolvedMonth = ALL_MONTHS[new Date().getMonth()];
 }
 const month = resolvedMonth;

 if (finishYear < 1900 || finishYear > 2100) {

 if (msgEl) msgEl.textContent = 'Finish year must be between 1900 and 2100.';

 return;

 }

 if (finishYear !== App.currentYear) {

 if (msgEl) msgEl.textContent = `Note: This book will move to the ${finishYear} shelf.`;

 }

 const sentEl = document.querySelector('#editSentimentSelector .sentiment-opt.selected');

 const pageCount = parseInt(document.getElementById('editPages')?.value) || Math.round(b.words / 300);

 const editFormat = document.getElementById('editFormat')?.value || 'physical';

  const editPubYear = parseInt(document.getElementById('editPubYear')?.value);

 const editWords = parseInt(document.getElementById('editWords').value) || b.words;

 const editDurH = editFormat === 'audiobook' ? parseFloat((editWords / 9000).toFixed(2)) : null;

 const editGender = document.getElementById('editAuthorGender')?.value || null;

 const editRegion = document.getElementById('editAuthorRegion')?.value || null;

 const wcManuallyChanged = (editWords !== b.words);

 const editWcEstimated = wcManuallyChanged ? false : (typeof this._editWcEstimated === 'boolean' ? this._editWcEstimated : isWordCountEstimated(b));

 const wcSource = wcManuallyChanged ? 'user_override' : (b.wordCountSource || 'provided');

 let editSeriesName = document.getElementById('editSeriesName')?.value?.trim() || null;
 let editSeriesNum = parseFloat(document.getElementById('editSeriesNumber')?.value) || null;

 if (editSeriesName) {
   // 1. Acronym expansion
   const lowerKey = editSeriesName.toLowerCase().replace(/[^a-z0-9]/g, '');
   if (SERIES_ACRONYMS[lowerKey]) {
     editSeriesName = SERIES_ACRONYMS[lowerKey];
   }
   // 2. Harmonize against library series consensus & typo resolution
   const allBooks = (this && this.books) || (typeof window !== 'undefined' && window.App && window.App.books) || [];
   const authorVal = (document.getElementById('editAuthor')?.value || b.author || '').trim();
   const harmonized = findMatchingLibrarySeries(editSeriesName, authorVal, allBooks);
   if (harmonized) {
     editSeriesName = harmonized;
   }
 }

 // 3. Auto-backfill series number if series name is present but number is missing
 if (editSeriesName && (editSeriesNum === null || isNaN(editSeriesNum))) {
   const fetcher = (typeof SeriesMetadataFetcher !== 'undefined') ? SeriesMetadataFetcher : (window.App && window.App.SeriesMetadataFetcher);
   if (fetcher && typeof fetcher._parseVolumeNumber === 'function') {
     const titleVal = (document.getElementById('editTitle')?.value || b.title || '').trim();
     const parsedNum = fetcher._parseVolumeNumber(titleVal, '', '', editSeriesName);
     if (parsedNum != null && !isNaN(parsedNum)) {
       editSeriesNum = parsedNum;
     }
   }
 }

 const editIsReread = document.getElementById('editIsReread')?.checked || false;

 const editOrigYear = editIsReread ? (parseInt(document.getElementById('editOriginalReadYear')?.value) || null) : null;

 const editDnf = document.getElementById('editDnf')?.checked || false;

 const editDnfReason = editDnf ? (document.getElementById('editDnfReason')?.value?.trim() || null) : null;

 const editStatusEl = document.querySelector('#editStatusSelector .status-opt.selected');

 const editStatus = editStatusEl ? editStatusEl.dataset.status : (b.status || 'finished');

 const editIsToRead = (editStatus === 'to-read');

 const editLanguage = document.getElementById('editLanguage')?.value || b.language || 'English';

 const editToReadNotes = editIsToRead ? (document.getElementById('editToReadNotes')?.value?.trim() || null) : null;

 // v2.6.3  -  per-book privacy + favorite quotes

 const editIsPrivate = !!document.getElementById('editPrivate')?.checked;

 const editQuotes = (document.getElementById('editQuotes')?.value || '').trim() || null;

 const updates = {

pub_year: isNaN(editPubYear) ? null : editPubYear,

fiction: (document.getElementById('editFiction') ? document.getElementById('editFiction').value === 'fiction' : b.fiction),

title: document.getElementById('editTitle').value.trim() || b.title,

genre: document.getElementById('editGenre') ? document.getElementById('editGenre').value : b.genre,

 author: document.getElementById('editAuthor').value.trim() || b.author,

 status: editStatus,

 language: editLanguage,

 to_read_notes: editToReadNotes,

  sentiment: editIsToRead ? null : (sentEl ? sentEl.dataset.s : (b.sentiment || 'mixed')),

 month_finished: month,

 days_to_read: parseInt(document.getElementById('editDays').value) || b.days,

 page_count: pageCount,

 word_count: editWords,

 word_count_source: wcSource,

 word_count_estimated: editWcEstimated,

 review: document.getElementById('editReview').value,

 currently_reading: editStatus === 'reading' ? true : false,

 date_started: document.getElementById('editDateStarted')?.value || null,

 date_finished: document.getElementById('editDateFinished')?.value || null,

 format: editFormat,

 duration_hours: editDurH,

 author_gender: editGender || null,

 author_region: editRegion || null,

 series_name: editSeriesName,

 series_number: editSeriesNum,

 is_reread: editIsReread,

 original_read_year: editOrigYear,

 dnf: editDnf,

 dnf_reason: editDnfReason,

 moods: getSelectedMoods('editMoodChips'),

 is_private: editIsPrivate,

 favorite_quotes: editQuotes,

 narrator: (document.getElementById('editNarrator')?.value || '').trim() || null,

reading_club: document.getElementById('editReadingClub')?.checked ? (document.getElementById('editClubSelect')?.value === '__NEW__' ? (document.getElementById('editClubNameNew')?.value || '').trim() : (document.getElementById('editClubSelect')?.value || '').trim()) : null,

 };

 const editCoverUrl = document.getElementById('editCoverUrlInput');

 if (editCoverUrl && editCoverUrl.value.trim()) updates.cover_url = editCoverUrl.value.trim();

 

  // Book of the Year crown handling

  const botyCb = document.getElementById('editBookOfYear');

  const wantsCrown = !!(botyCb && botyCb.checked);

  if (wantsCrown) updates.book_of_year = finishYear;

  else if (b.bookOfYear) updates.book_of_year = null;


  if (wantsCrown) {

    const existing = this.books.find(x => x.id !== b.id && x.bookOfYear && Number(x.bookOfYear) === finishYear);

    if (existing) {

      if (!window.confirm("Another book ('" + (existing.title||'Unknown') + "') is already marked as Book of the Year for " + finishYear + ". Are you sure you want to replace it?")) return;

    }

  }


  const btn = document.getElementById('saveEditBtn');

  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

  try {

    if (finishYear !== App.currentYear) {

      const newShelf = await DB.getOrCreateShelf(this.userId, finishYear);

      if (newShelf) {

        updates.shelf_id = newShelf.id;

        if (this.userYears && !this.userYears.find(y => (typeof y === 'object' ? y.year : y) === finishYear)) {
          this.userYears.push({ id: newShelf.id, year: finishYear, public: true });
          this.userYears.sort((a,b) => (b.year||b) - (a.year||a));
        }

      }

    }

    if (this.editMode === 'add') {
      updates.user_id = this.userId;
      if (!updates.shelf_id) {
         if (this.currentShelf && this.currentShelf.year === finishYear) {
            updates.shelf_id = this.currentShelf.id;
         } else {
            const shelf = await DB.getOrCreateShelf(this.userId, finishYear);
            if (shelf) {
              updates.shelf_id = shelf.id;
              if (this.userYears && !this.userYears.find(y => (typeof y === 'object' ? y.year : y) === finishYear)) {
                this.userYears.push({ id: shelf.id, year: finishYear, public: true });
                this.userYears.sort((a,b) => (b.year||b) - (a.year||a));
              }
            }
         }
      }
      if (b.coverUrl) updates.cover_url = b.coverUrl;
      if (b.isbn) updates.isbn = b.isbn;
      if (b.pages) updates.page_count = b.pages;

      // Ensure finished titles have high initial sort_order to save at the end of the shelf/month
      if (updates.status !== 'to-read' && !updates.currently_reading) {
        const maxSortOrder = (this.books && this.books.length > 0)
          ? Math.max(0, ...this.books.map(x => Number(x.sortOrder || x.sort_order || 0)))
          : 0;
        updates.sort_order = maxSortOrder + 10;
      }

      const savedBook = await DB.addBook(updates);
      if (savedBook) {
        const parsed = dbToBook(savedBook);
        if (finishYear === App.currentYear) {
          this.books.push(parsed);
          if (parsed.status === 'finished' || (!parsed.status && !parsed.currentlyReading)) {
            await this._placeBookAtEndOfMonth(parsed.id, updates.month_finished);
          }
        }
        if (parsed.status === 'to-read') {
          if (!this.toReadBooks) this.toReadBooks = [];
          if (!this.toReadBooks.find(x => x.id === parsed.id)) {
            this.toReadBooks.push(parsed);
          }
        }
        DB.trackEvent('book_added', { source: 'unified_form', format: updates.format || 'physical' });
        this.closeModal('editBookModal');
        this.render();
        this.showToast(finishYear === App.currentYear ? 'Book added!' : `Book added to ${finishYear} shelf!`);
        const btn = document.getElementById('saveEditBtn');
        if (btn) { btn.disabled = false; btn.textContent = 'Add to Library'; }
      } else {
        throw new Error('Failed to add book.');
      }
      return;
    } else {
      await DB.updateBook(b.id, updates);
      const wasFinished = b.status === 'finished' && !b.currentlyReading;
      const isNowFinished = updates.status === 'finished' && !updates.currently_reading;
      const monthChanged = updates.month_finished && updates.month_finished !== (b.month || b.month_finished);

      const bookToUpdate = this.books.find(x => x.id === b.id) || b;
      if (finishYear !== App.currentYear) {
        const curIdx = this.books.findIndex(x => x.id === b.id);
        if (curIdx !== -1) {
          this.books.splice(curIdx, 1);
        }
      } else {
        Object.assign(bookToUpdate, {
          bookOfYear: updates.hasOwnProperty('book_of_year') ? updates.book_of_year : bookToUpdate.bookOfYear,
          title: updates.title,
          genre: updates.genre,
          author: updates.author,
          sentiment: updates.sentiment,
          month: updates.month_finished,
          month_finished: updates.month_finished,
          days: updates.days_to_read,
          words: updates.word_count,
          wordCountSource: updates.word_count_source,
          year: updates.hasOwnProperty('pub_year') ? (updates.pub_year || 0) : bookToUpdate.year,
          fiction: updates.hasOwnProperty('fiction') ? updates.fiction : bookToUpdate.fiction,
          status: updates.status,
          currentlyReading: updates.currently_reading,
          dateStarted: updates.date_started,
          dateFinished: updates.date_finished,
          wordCountEstimated: updates.word_count_estimated,
          pageCount: updates.page_count,
          review: updates.review,
          format: updates.format,
          durationHours: updates.duration_hours,
          authorGender: updates.author_gender,
          authorRegion: updates.author_region,
          seriesName: updates.series_name,
          seriesNumber: updates.series_number,
          isReread: updates.is_reread,
          originalReadYear: updates.original_read_year,
          dnf: updates.dnf,
          dnfReason: updates.dnf_reason,
          moods: updates.moods || [],
          language: updates.language,
          toReadNotes: updates.to_read_notes,
          isPrivate: updates.is_private,
          favoriteQuotes: updates.favorite_quotes || '',
          readingClub: updates.reading_club || null,
          narrator: updates.narrator || null,
          fallbackCover: coverPlaceholder(updates.title, updates.author, updates.sentiment),
          coverUrl: updates.cover_url || bookToUpdate.coverUrl,
          cover: updates.cover_url || bookToUpdate.coverUrl || coverPlaceholder(updates.title, updates.author, updates.sentiment)
        });
        if (b !== bookToUpdate) {
          Object.assign(b, bookToUpdate);
        }

        if (isNowFinished && (!wasFinished || monthChanged) && finishYear === App.currentYear) {
          await this._placeBookAtEndOfMonth(b.id, updates.month_finished);
        }
      }
    }

  DB.trackEvent('edit_book', { title: updates.title, author: updates.author });

 const newlyCrowned = wantsCrown && !(b.bookOfYear && Number(b.bookOfYear) === finishYear);

 this.closeModal('editBookModal');

 this.render();

 if (newlyCrowned) { DB.trackEvent('book_of_year_set', { method: 'edit', year: finishYear, title: updates.title }); this.showToast(`👑 ${updates.title} crowned as your Book of the Year!`); }

 else this.showToast('Book updated.');

 } catch (err) {

 console.error('saveEdit error:', err);

 if (msgEl) msgEl.textContent = 'Error saving changes. Please try again.';

 if (btn) { btn.disabled = false; btn.textContent = 'Save Changes'; }

 }

 }

export function showBookContextMenu(e, bookId) {
  e.preventDefault();
  const book = (this.books || []).find(b => String(b.id) === String(bookId));
  if (!book || this.isReadOnly) return;
  this._contextBook = book;

  const menu = document.getElementById('bookContextMenu');
  if (!menu) return;
  menu.innerHTML = `
    <button onclick="App.openEditModal(window.App._findBookById('${book.id}'));App.hideContextMenu();">✏️ Edit</button>
    <button onclick="App.confirmDeleteBook('${book.id}');App.hideContextMenu();" style="color:var(--dislike);">🗑️ Delete</button>
  `;
  menu.style.display = 'block';
  menu.style.left = e.clientX + 'px';
  menu.style.top = e.clientY + 'px';
}

export function hideContextMenu() {
  const cm = document.getElementById('bookContextMenu');
  if (cm) cm.style.display = 'none';
  this._contextBook = null;
}

export async function quickUpdateBookStatus(bookId, newStatus) {
    if (!bookId) return;
    const book = (window.App.books || []).find(b => String(b.id) === String(bookId));
    if (!book) return;

    if (window.App.isReadOnly) {
        if (typeof window.App.showToast === 'function') window.App.showToast('Sign in to update books.');
        return;
    }

    const payload = {};
    const currentMonth = ALL_MONTHS[new Date().getMonth()];
    if (newStatus === 'finished') {
        payload.status = 'finished';
        payload.currently_reading = false;
        payload.date_finished = new Date().toISOString().split('T')[0];
        payload.month_finished = currentMonth;
        payload.month = currentMonth;
    } else if (newStatus === 'reading') {
        payload.status = 'reading';
        payload.currently_reading = true;
    } else if (newStatus === 'to-read') {
        payload.status = 'to-read';
        payload.currently_reading = false;
    }

    const success = await window.DB.updateBook(bookId, payload);
    window.App.closeBookModal();
    book.status = payload.status;
    book.currentlyReading = payload.currently_reading;
    if (newStatus === 'finished') {
        book.dateFinished = payload.date_finished;
        book.date_finished = payload.date_finished;
        book.month = payload.month;
        book.month_finished = payload.month_finished;
        if (typeof window.App._placeBookAtEndOfMonth === 'function') {
            await window.App._placeBookAtEndOfMonth(bookId, payload.month_finished);
        }
    }
    window.App.render();
}

export function openBookModal(titleOrEvent, author, cover, reason, synopsis) {
    let title = titleOrEvent;
    let bookId = null;
    let status = null;
    
    if (title && typeof title === 'object') {
        const el = title;
        if (el.nodeType === 1 || el.dataset) {
            title = (el.dataset && el.dataset.title) || (typeof el.getAttribute === 'function' && el.getAttribute('data-title')) || '';
            author = (el.dataset && el.dataset.author) || (typeof el.getAttribute === 'function' && el.getAttribute('data-author')) || '';
            cover = (el.dataset && el.dataset.cover) || (typeof el.getAttribute === 'function' && el.getAttribute('data-cover')) || '';
            reason = (el.dataset && el.dataset.reason) || (typeof el.getAttribute === 'function' && el.getAttribute('data-reason')) || '';
            synopsis = (el.dataset && el.dataset.synopsis) || (typeof el.getAttribute === 'function' && el.getAttribute('data-synopsis')) || '';
            bookId = (el.dataset && el.dataset.id) || (typeof el.getAttribute === 'function' && el.getAttribute('data-id')) || null;
            status = (el.dataset && el.dataset.status) || (typeof el.getAttribute === 'function' && el.getAttribute('data-status')) || null;
        } else {
            bookId = el.id || null;
            title = el.title || '';
            author = el.author || '';
            cover = el.cover || el.coverUrl || el.fallbackCover || '';
            reason = el.reason || '';
            synopsis = el.review || el.synopsis || '';
            status = el.status || (el.currentlyReading ? 'reading' : 'finished');
        }
    } else if (typeof title === 'string' && (!author || typeof author !== 'string')) {
        if (typeof window !== 'undefined' && window.App) {
            const found = (typeof window.App._findBookById === 'function' ? window.App._findBookById(title) : null) || (window.App.books && window.App.books.find(b => String(b.id) === String(title)));
            if (found) {
                bookId = found.id;
                title = found.title || '';
                author = found.author || '';
                cover = found.cover || found.coverUrl || found.fallbackCover || '';
                reason = found.reason || '';
                synopsis = found.review || found.synopsis || '';
                status = found.status || (found.currentlyReading ? 'reading' : 'finished');
            }
        }
    }
    if (typeof title !== 'string') title = String(title || '');

    if (bookId && typeof window !== 'undefined' && window.App) {
        const book = (typeof window.App._findBookById === 'function' ? window.App._findBookById(bookId) : null) || (window.App.books && window.App.books.find(b => String(b.id) === String(bookId)));
        if (book) {
            if (!title) title = book.title || '';
            if (!author) author = book.author || '';
            if (!cover) cover = book.cover || book.coverUrl || book.fallbackCover || '';
            if (!synopsis) synopsis = book.review || book.synopsis || '';
            if (!status) status = book.status || (book.currentlyReading ? 'reading' : 'finished');
        }
    }

    if (synopsis && synopsis.length < 100 && synopsis.toLowerCase().includes('pages') && synopsis.toLowerCase().includes('cm')) synopsis = '';
    const modal = document.getElementById('bookModal');
    if (!modal) return;
    
    if (typeof window !== 'undefined' && window.App && typeof window.App.openModal === 'function') {
        window.App.openModal('bookModal');
    } else {
        modal.style.display = 'flex';
        modal.style.opacity = '1';
        modal.style.visibility = 'visible';
        modal.classList.add('open');
    }
    
    // FIX Z-INDEX to ensure it pops over the Community Modal by using the dynamic Z-index tracker
    if (typeof window !== 'undefined' && window.App) {
        window.App._modalZIndex = (window.App._modalZIndex || 2000000000) + 1;
        modal.style.setProperty('z-index', String(window.App._modalZIndex), 'important');
    } else {
        modal.style.setProperty('z-index', '2000009999', 'important');
    }
    if (modal._closeTimer) {
        clearTimeout(modal._closeTimer);
        modal._closeTimer = null;
    }
    if (modal._openTimer) {
        clearTimeout(modal._openTimer);
        modal._openTimer = null;
    }
    modal._currentBook = { title, author, cover, reason, synopsis, bookId, status };
    const t = document.getElementById('modalBookTitle');
    const a = document.getElementById('modalBookAuthor');
    const c = document.getElementById('modalBookCover');
    const r = document.getElementById('modalBookReason');
    const s = document.getElementById('modalBookSynopsis');
    const actions = document.getElementById('modalBookActions');

    if (t) t.innerText = title || 'Book Title';
    if (a) a.innerText = author || 'Author Name';
    if (c) c.src = cover || '';
    if (r) {
        r.innerText = reason || '';
        r.style.display = reason ? 'inline-block' : 'none';
    }
    if (s) {
        s.innerText = synopsis || '';
        s.style.display = synopsis ? 'block' : 'none';
    }

    if (actions) {
        if (bookId && status) {
            const moveToToReadBtn = status === 'reading' 
                ? `<button style="flex:1; padding:10px; border-radius:6px; cursor:pointer; background:var(--paper); border:1px solid rgba(61,43,31,0.1); font-weight:600;" onclick="App.quickUpdateBookStatus('${bookId}', 'to-read')">Move to To-Read</button>` 
                : `<button style="flex:1; padding:10px; border-radius:6px; cursor:pointer; background:var(--paper); border:1px solid rgba(61,43,31,0.1); font-weight:600;" onclick="App.quickUpdateBookStatus('${bookId}', 'reading')">Move to Reading</button>`;

            actions.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:8px;">
                    <div style="display:flex; gap:8px;">
                        <button class="btn-burgundy" style="flex:1; padding:10px; border-radius:6px; cursor:pointer; font-weight:700;" onclick="App.quickUpdateBookStatus('${bookId}', 'finished')">Mark as Finished</button>
                        ${moveToToReadBtn}
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button style="flex:1; padding:10px; border-radius:6px; cursor:pointer; background:transparent; border:1px solid rgba(61,43,31,0.1); color:var(--text-secondary);" onclick="App.closeBookModal(); App.openEditModal(window.App._findBookById('${bookId}'))">Edit</button>
                        <button style="flex:1; padding:10px; border-radius:6px; cursor:pointer; background:transparent; border:1px solid rgba(139,38,53,0.3); color:var(--burgundy);" onclick="App.closeBookModal(); App.confirmDeleteBook('${bookId}')">Remove</button>
                    </div>
                </div>
            `;
        } else {
            actions.innerHTML = `<button class="btn-burgundy" style="width: 100%; padding: 12px; border-radius: 6px; cursor: pointer;" onclick="closeBookModal(); const m=document.getElementById('bookModal'); if (m && m._currentBook) { addToToRead(m._currentBook.title, m._currentBook.author, m._currentBook.cover, m._currentBook.reason); } else { const t=document.getElementById('modalBookTitle')?.innerText; const a=document.getElementById('modalBookAuthor')?.innerText; const c=document.getElementById('modalBookCover')?.src; addToToRead(t || 'Book Title', a || '', c || ''); }">Add to To-Read</button>`;
        }
    }
}

export function closeBookModal() {
  if (typeof window !== 'undefined' && window.App && typeof window.App.closeModal === 'function') {
    window.App.closeModal('bookModal');
  } else if (typeof document !== 'undefined') {
    const modal = document.getElementById('bookModal');
    if (modal) {
      modal.classList.remove('open');
      modal.style.display = 'none';
    }
  }
}

export async function addToToRead(titleOrObj, author, coverUrl, notes) {
  let title = titleOrObj;
  if (typeof titleOrObj === 'object' && titleOrObj !== null) {
    if (titleOrObj.dataset) {
      title = titleOrObj.dataset.title || '';
      author = titleOrObj.dataset.author || author || '';
      coverUrl = titleOrObj.dataset.cover || coverUrl || '';
      notes = titleOrObj.dataset.notes || notes || '';
    } else {
      title = titleOrObj.title || '';
      author = titleOrObj.author || author || '';
      coverUrl = titleOrObj.coverUrl || titleOrObj.cover || coverUrl || '';
      notes = titleOrObj.toReadNotes || titleOrObj.notes || notes || '';
    }
  }

  if (DuplicateDetector) {
      const dupe = await DuplicateDetector.findDuplicate(title, author, null, window.App ? window.App.userId : null);
      if (dupe) {
          DuplicateDetector.showModal(dupe, { title, author }, (existingBook) => { proceedToAdd(true); }); return; } } return proceedToAdd(false); function proceedToAdd(forceReread = false) { window.App.books = window.App.books || []; const exists = window.App.books.some(b => b.title && String(b.title).toLowerCase() === title.toLowerCase()); if (!exists || forceReread) { const newBook = {
        id: 'tr-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        title: title || 'Untitled',
        author: author || 'Unknown',
        coverUrl: coverUrl || '',
        cover: coverUrl || '',
        fallbackCover: '',
        status: 'to-read',
        toReadNotes: notes || '',
        year: (typeof window !== 'undefined' && window.App && window.App.currentYear) ? window.App.currentYear : new Date().getFullYear(),
        words: 80000,
        days: 0,
        sentiment: '',
        month: '',
        isReread: forceReread }; if (typeof window !== "undefined" && window.App && Array.isArray(window.App.books)) { window.App.books.push(newBook); if (typeof window.App.saveBooks === "function") window.App.saveBooks(); if (typeof window.App.render === "function") window.App.render(); } if (typeof window !== "undefined" && window.App && typeof window.App.showToast === "function") { window.App.showToast(forceReread ? `Added "${title}" as Re-read to To-Read list!` : `Added "${title}" to your To-Read list!`); } return newBook; } else { if (typeof window !== "undefined" && window.App && typeof window.App.showToast === "function") window.App.showToast("Book is already on your list!"); return null; } }
}

/**
 * Local heuristic text polisher for book review thoughts.
 * Operates 100% offline with zero dependencies or API keys.
 * Trims colloquial fillers, standardizes contractions, fixes capitalization,
 * cleans punctuation, and enforces the 300-char constraint.
 */
export function _heuristicPolishReview(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let s = raw.trim();

  // 1. Collapse redundant spaces and multiple empty lines
  s = s.replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n\n');

  // 2. Common conversational filler prefixes often typed when jotting quick notes
  const fillerPrefixes = [
    /^(?:basically|honestly|so yeah,?|so,?|in my opinion,?|i felt like|i thought that|all in all,?|to be honest,?|tbh,?|ngl,?|fwiw,?)\s+/i,
    /^(?:i guess|i would say|my take is that|just finished and)\s+/i
  ];
  let changed = true;
  while (changed) {
    changed = false;
    for (const rx of fillerPrefixes) {
      if (rx.test(s)) {
        s = s.replace(rx, '');
        changed = true;
      }
    }
  }

  // 3. Fix lowercase "i", common contractions, and informal abbreviations
  const contractions = [
    [/\bi\b/g, 'I'],
    [/\bi['’]?m\b/gi, "I'm"],
    [/\bi['’]?ve\b/gi, "I've"],
    [/\bi['’]?d\b/gi, "I'd"],
    [/\bi['’]?ll\b/gi, "I'll"],
    [/\bdont\b/gi, "don't"],
    [/\bcant\b/gi, "can't"],
    [/\bwont\b/gi, "won't"],
    [/\bdidnt\b/gi, "didn't"],
    [/\bcouldnt\b/gi, "couldn't"],
    [/\bwouldnt\b/gi, "wouldn't"],
    [/\bshouldnt\b/gi, "shouldn't"],
    [/\bisnt\b/gi, "isn't"],
    [/\barent\b/gi, "aren't"],
    [/\bwasnt\b/gi, "wasn't"],
    [/\bwerent\b/gi, "weren't"],
    [/\bhasnt\b/gi, "hasn't"],
    [/\bhavent\b/gi, "haven't"],
    [/\bhadnt\b/gi, "hadn't"],
    [/\bthats\b/gi, "that's"],
    [/\bwhats\b/gi, "what's"],
    [/\btheres\b/gi, "there's"],
    [/\bits\s+(a|an|the|one|my|your|not|so|very|pretty|really|quite|just)\b/gi, "it's $1"]
  ];
  for (const [rx, rep] of contractions) {
    s = s.replace(rx, rep);
  }

  // 4. Clean duplicate/malformed punctuation and spacing before punctuation
  s = s.replace(/\s+([,.;:!?])/g, '$1');
  s = s.replace(/,{2,}/g, ',');
  s = s.replace(/\.{4,}/g, '...');
  s = s.replace(/!{2,}/g, '!');
  s = s.replace(/\?{2,}/g, '?');

  // 5. Capitalize first letter of each sentence
  s = s.replace(/(^|[.!?]\s+)([a-z])/g, (_, p1, p2) => p1 + p2.toUpperCase());

  // Ensure first character overall is capitalized
  if (s.length > 0) {
    s = s.charAt(0).toUpperCase() + s.slice(1);
  }

  // 6. Ensure ending punctuation if omitted
  if (s.length > 0 && !/[.!?…'"]$/.test(s)) {
    s += '.';
  }

  return s;
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const REVIEW_STOP_WORDS = new Set([
  'it', 'you', 'me', 'us', 'her', 'him', 'them', 'the', 'a', 'an', 'in', 'on', 'if', 'so', 'we',
  'i', 'he', 'she', 'they', 'who', 'what', 'when', 'where', 'why', 'how', 'do', 'go', 'up', 'out',
  'no', 'yes', 'or', 'and', 'but', 'is', 'am', 'are', 'was', 'were', 'be', 'been', 'all', 'one'
]);

export function sanitizeReviewOutput(text, title = '', author = '') {
  if (!text || typeof text !== 'string') return '';
  let s = text.trim();

  // Strip wrapping quotes
  s = s.replace(/^["'“”‘’]|["'“”‘’]$/g, '').trim();

  // Replace any em dashes or en dashes with commas per project rules
  s = s.replace(/[\u2014\u2013]/g, ', ');

  // Strip markdown bold/italic wrapper
  if ((s.startsWith('**') && s.endsWith('**')) || (s.startsWith('*') && s.endsWith('*'))) {
    s = s.replace(/^\*+|\*+$/g, '').trim();
  }

  // Remove common AI intro prefixes
  s = s.replace(/^(?:Here(?:\s+is|\s*'s)?(?:\s+the|\s+a)?\s+refined\s+review(?:\s*:\s*|\s*\n+)|Refined\s+Review\s*:\s*)/i, '').trim();

  const cleanTitle = (title || '').trim();
  const cleanAuthor = (author || '').trim();
  const capitalizeFirst = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : str;

  // 1. Strip leading "In <Title> (by <Author>)?,? ..."
  if (cleanTitle && cleanTitle.length >= 2) {
    const escT = escapeRegExp(cleanTitle);
    const inTitlePattern = new RegExp(`^In\\s+["'“]?${escT}["'”]?\\s*(?:,?\\s*(?:by\\s+[^,]+,?\\s*)?)?`, 'i');
    if (inTitlePattern.test(s)) {
      s = s.replace(inTitlePattern, '').trim();
      s = capitalizeFirst(s);
    }

    // Strip leading "<Title> by <Author> is/presents/delivers..."
    const titleByAuthorPattern = new RegExp(`^["'“]?${escT}["'”]?\\s*(?:,?\\s*(?:by\\s+[^,]+,?\\s*)?)?\\s*(?:is|presents|delivers|offers|follows|proves to be)\\s+`, 'i');
    if (titleByAuthorPattern.test(s)) {
      s = s.replace(titleByAuthorPattern, '').trim();
      s = capitalizeFirst(s);
    }

    // Strip quoted title anywhere: "Title" or 'Title'
    const quotedTitlePattern = new RegExp(`["'“]${escT}["'”]`, 'gi');
    s = s.replace(quotedTitlePattern, 'this story');

    // If title is not a stopword and is 4+ chars, replace unquoted occurrences
    const isStopWord = REVIEW_STOP_WORDS.has(cleanTitle.toLowerCase());
    if (!isStopWord && cleanTitle.length >= 4) {
      const exactTitlePattern = new RegExp(`\\b${escT}\\b`, 'gi');
      s = s.replace(exactTitlePattern, 'this book');
    }
  }

  // 2. Author sanitization
  if (cleanAuthor && cleanAuthor.length >= 3) {
    const escA = escapeRegExp(cleanAuthor);

    // Strip leading "<Author>'s? (latest)? (novel|book|work)? (is|delivers|crafts|presents)..."
    const leadingAuthorPattern = new RegExp(`^${escA}(?:'s)?\\s*(?:latest\\s+)?(?:novel|book|work|story)?\\s*(?:is|presents|delivers|offers|crafts|weaves|creates)\\s+`, 'i');
    if (leadingAuthorPattern.test(s)) {
      s = s.replace(leadingAuthorPattern, '').trim();
      s = capitalizeFirst(s);
    }

    // Replace "<Author>'s" with "the author's"
    const authorPossessive = new RegExp(`\\b${escA}'s\\b`, 'gi');
    s = s.replace(authorPossessive, "the author's");

    // Replace full author name with "the author"
    const authorExact = new RegExp(`\\b${escA}\\b`, 'gi');
    s = s.replace(authorExact, "the author");

    // Also handle last name if author has first + last name and last name is distinctive
    const parts = cleanAuthor.split(/\s+/).filter(Boolean);
    if (parts.length > 1) {
      const lastName = parts[parts.length - 1];
      if (lastName.length >= 4 && !REVIEW_STOP_WORDS.has(lastName.toLowerCase())) {
        const escLast = escapeRegExp(lastName);
        const inLastPattern = new RegExp(`^In\\s+${escLast}'s\\s+hands,?\\s*`, 'i');
        if (inLastPattern.test(s)) {
          s = s.replace(inLastPattern, '').trim();
          s = capitalizeFirst(s);
        }
        const lastPossessive = new RegExp(`\\b${escLast}'s\\b`, 'gi');
        s = s.replace(lastPossessive, "the author's");
        const byLastName = new RegExp(`\\bby\\s+${escLast}\\b`, 'gi');
        s = s.replace(byLastName, "by the author");
      }
    }
  }

  s = s.replace(/\bthe author's the author\b/gi, "the author's work");
  s = s.replace(/[\u2014\u2013]/g, ', ');
  s = s.replace(/\s+/g, ' ').trim();
  s = capitalizeFirst(s);

  return s;
}

export function toggleAiToneMenu(event) {
  if (event) {
    if (typeof event.stopPropagation === 'function') event.stopPropagation();
    if (typeof event.preventDefault === 'function') event.preventDefault();
  }
  const dropdown = document.getElementById('aiToneDropdown');
  const btn = document.getElementById('aiRefineMenuBtn');
  if (!dropdown) return;
  const isCurrentlyOpen = dropdown.style.display === 'flex' || dropdown.style.display === 'block';
  if (isCurrentlyOpen) {
    dropdown.style.display = 'none';
    if (btn) btn.setAttribute('aria-expanded', 'false');
  } else {
    const activeTone = (typeof window !== 'undefined' && window.App?._selectedAiTone) || 'thoughtful';
    ['thoughtful', 'punchy', 'vibe', 'roast'].forEach(t => {
      const check = document.getElementById(`toneCheck-${t}`);
      const opt = dropdown.querySelector(`.ai-tone-option[data-tone="${t}"]`);
      if (check) check.style.display = (t === activeTone ? 'inline' : 'none');
      if (opt) opt.classList.toggle('selected', t === activeTone);
    });
    dropdown.style.display = 'flex';
    if (btn) btn.setAttribute('aria-expanded', 'true');
  }
}

export function selectToneAndRefine(tone, inputId) {
  const dropdown = document.getElementById('aiToneDropdown');
  const btn = document.getElementById('aiRefineMenuBtn');
  if (dropdown) dropdown.style.display = 'none';
  if (btn) btn.setAttribute('aria-expanded', 'false');

  if (typeof window !== 'undefined') {
    window.App = window.App || {};
    window.App._selectedAiTone = tone;
  }

  const labelEl = document.getElementById('aiRefineBtnLabel');
  const iconEl = document.getElementById('aiRefineBtnIcon');
  if (labelEl) {
    if (tone === 'roast') {
      labelEl.textContent = 'Roast';
      if (iconEl) iconEl.textContent = '🔥';
    } else if (tone === 'punchy') {
      labelEl.textContent = 'Punchy';
      if (iconEl) iconEl.textContent = '⚡';
    } else if (tone === 'vibe') {
      labelEl.textContent = 'The Vibe';
      if (iconEl) iconEl.textContent = '🌊';
    } else {
      labelEl.textContent = 'Thoughtful';
      if (iconEl) iconEl.textContent = '🧠';
    }
  }

  const targetId = inputId || (document.getElementById('editReview') && document.getElementById('editBookModal')?.classList.contains('open') ? 'editReview' : 'finishReview');
  const input = document.getElementById(targetId);
  if (!input || !input.value.trim()) {
    if (typeof window !== 'undefined' && window.App && typeof window.App.showToast === 'function') {
      const displayTone = tone === 'roast' ? 'Roast 🔥' : (tone.charAt(0).toUpperCase() + tone.slice(1));
      window.App.showToast(`Selected ${displayTone} tone. Write your thoughts and tap to refine!`);
    }
    return;
  }

  if (!window.App?._originalReviewText) {
    window.App._originalReviewText = input.value.trim();
  }
  aiSummarizeReview(targetId);
}

export function selectAiTone(tone, inputId) {
  selectToneAndRefine(tone, inputId);
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('aiToneDropdown');
    const trigger = document.getElementById('aiRefineMenuBtn');
    if (dropdown && (dropdown.style.display === 'flex' || dropdown.style.display === 'block')) {
      if (!dropdown.contains(e.target) && !trigger?.contains(e.target)) {
        dropdown.style.display = 'none';
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
      }
    }
  });
}

export function revertAiReview(inputId) {
  const targetId = inputId || 'editReview';
  const input = document.getElementById(targetId);
  const original = (typeof window !== 'undefined' && window.App?._originalReviewText) || '';
  if (input && original) {
    input.value = original;
    const counter = document.getElementById('editReviewCharCount');
    if (counter) counter.textContent = input.value.length + ' chars';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  const undoBar = document.getElementById('aiUndoBar');
  if (undoBar) undoBar.style.display = 'none';
  if (typeof window !== 'undefined' && window.App) {
    window.App._originalReviewText = null;
  }
  if (typeof window !== 'undefined' && window.App && typeof window.App.showToast === 'function') {
    window.App.showToast('Restored original thoughts');
  }
}

/**
 * Attempts to refine review text using browser-native on-device AI (Chrome Gemini Nano Prompt API).
 * Returns refined text string if available and successful, or null to trigger heuristic fallback.
 */
export async function _tryOnDeviceAI(text, context = {}) {
  try {
    const lm = (typeof window !== 'undefined' && window.ai?.languageModel) || (typeof ai !== 'undefined' && ai?.languageModel);
    if (!lm) return null;

    let isAvailable = false;
    if (typeof lm.capabilities === 'function') {
      const caps = await lm.capabilities();
      isAvailable = (caps && (caps.available === 'readily' || caps.available === 'after-download'));
    } else if (typeof lm.availability === 'function') {
      const avail = await lm.availability();
      isAvailable = (avail === 'readily' || avail === 'available');
    } else {
      isAvailable = true;
    }

    if (!isAvailable) return null;

    const tone = context.tone || 'thoughtful';
    let toneInstruction = "Cohesive, articulate literary analysis.";
    if (tone === 'punchy') toneInstruction = "Short, high-energy, punchy 1-2 sentence verdict.";
    if (tone === 'vibe') toneInstruction = "Atmospheric, focused on mood and pacing.";
    if (tone === 'roast') toneInstruction = "Ruthless, witty, savage takedown roasting the book's flaws and weaknesses.";

    const roastGuidance = tone === 'roast' 
      ? 'Assume the reader thoroughly disliked the book or found it deeply flawed, and roast it with biting sarcasm, sharp metaphors, and ruthless critique.' 
      : 'Maintain personal sentiment.';

    const session = await lm.create({
      systemPrompt: `You are a concise literary editor and critic. Refine the reader's rough book review thoughts into an engaging review. ${toneInstruction} ${roastGuidance} Return only the refined review text without quotes, markdown, or em dashes. CRITICAL: Do NOT include or mention the book title or the author's name anywhere in the review.`
    });

    const result = await session.prompt(text);
    if (session && typeof session.destroy === 'function') session.destroy();

    if (result && typeof result === 'string' && result.trim()) {
      return sanitizeReviewOutput(result.trim(), context.title || '', context.author || '');
    }
  } catch (err) {
    console.warn('[On-Device AI] Prompt API unavailable or error:', err);
  }
  return null;
}

export async function aiSummarizeReview(inputId) {
  const targetId = inputId || (document.getElementById('editReview') && document.getElementById('editBookModal')?.classList.contains('open') ? 'editReview' : 'finishReview');
  const input = document.getElementById(targetId);
  if (!input || !input.value.trim()) {
    if (typeof window !== 'undefined' && window.App && typeof window.App.showToast === 'function') {
      window.App.showToast('Please write some thoughts first!');
    }
    return;
  }

  const currentText = input.value.trim();
  if (typeof window !== 'undefined') {
    window.App = window.App || {};
    if (!window.App._originalReviewText) {
      window.App._originalReviewText = currentText;
    }
  }
  const original = (typeof window !== 'undefined' && window.App?._originalReviewText) || currentText;

  const undoBar = document.getElementById('aiUndoBar');
  const undoMsg = document.getElementById('aiUndoMsg');

  // Extract Book Context
  const title = document.getElementById('editTitle')?.value || window.App?.editingBook?.title || '';
  const author = document.getElementById('editAuthor')?.value || window.App?.editingBook?.author || '';
  const sentEl = document.querySelector('#editSentimentSelector .sentiment-opt.selected') || document.querySelector('#finishSentimentSelector .sentiment-opt.selected');
  const sentiment = sentEl ? sentEl.dataset.s : (window.App?.editingBook?.sentiment || 'mixed');
  const tone = (typeof window !== 'undefined' && window.App?._selectedAiTone) || 'thoughtful';
  let toneLabel = 'Thoughtful';
  if (tone === 'punchy') toneLabel = 'Punchy';
  else if (tone === 'vibe') toneLabel = 'The Vibe';
  else if (tone === 'roast') toneLabel = 'Roast';

  const setBtnLoading = (loading, text) => {
    const buttons = [document.getElementById('aiRefineBtn'), document.getElementById('aiRefineMenuBtn'), document.getElementById('btnAiSummarize')].filter(Boolean);
    buttons.forEach(btn => {
      btn.disabled = loading;
      btn.style.opacity = loading ? '0.7' : '1';
      const labelEl = btn.querySelector('#aiRefineBtnLabel');
      const iconEl = btn.querySelector('#aiRefineBtnIcon');
      const loadingText = text || (tone === 'roast' ? 'Roasting...' : 'Refining...');
      if (labelEl) {
        labelEl.textContent = loading ? loadingText : (tone === 'roast' ? 'Roast' : toneLabel);
        if (iconEl) iconEl.textContent = loading ? '✨' : (tone === 'roast' ? '🔥' : (tone === 'punchy' ? '⚡' : (tone === 'vibe' ? '🌊' : '🧠')));
      } else {
        const defaultText = btn.id === 'btnAiSummarize' ? '✨ AI Assist' : '✨ AI Refine';
        btn.innerHTML = loading ? `✨ ${loadingText}` : defaultText;
      }
    });
  };

  const showUndo = (label) => {
    if (undoBar) {
      undoBar.style.display = 'flex';
      const icon = tone === 'roast' ? '🔥' : '✨';
      if (undoMsg) undoMsg.textContent = label ? `${icon} ${label}` : `${icon} Refined`;
    }
  };

  const updateCharCounter = () => {
    const counter = document.getElementById('editReviewCharCount');
    if (counter && input) counter.textContent = input.value.length + ' chars';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };

  setBtnLoading(true, tone === 'roast' ? 'Roasting...' : 'Refining...');

  // 1. Tier 1: Cloud AI via Netlify Serverless Function (Dynamic Gemini Models)
  let cloudErrorMsg = null;
  try {
    const resp = await fetch('/.netlify/functions/refineReview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ review: original, title, author, sentiment, tone })
    });

    if (resp.ok) {
      const data = await resp.json();
      if (data && data.refined && data.refined.trim()) {
        input.value = sanitizeReviewOutput(data.refined.trim(), title, author);
        updateCharCounter();
        showUndo(`Refined (${toneLabel})`);
        setBtnLoading(false);
        if (typeof window !== 'undefined' && window.App?.showToast) {
          const toastMsg = tone === 'roast' ? '🔥 Review refined (Roast)!' : `✨ Review refined (${toneLabel})!`;
          window.App.showToast(toastMsg);
        }
        return;
      }
    } else {
      const errData = await resp.json().catch(() => ({}));
      cloudErrorMsg = errData?.error || `Server responded with ${resp.status}`;
      console.warn('[AI Refine] Cloud function error:', resp.status, errData);
    }
  } catch (err) {
    cloudErrorMsg = err.message;
    console.warn('[AI Refine] Cloud function unavailable, falling back:', err);
  }

  // 2. Tier 2: Custom Gemini API Key from localStorage (sl_gemini_key)
  const apiKey = (typeof localStorage !== 'undefined') ? (localStorage.getItem('sl_gemini_key') || '').trim() : '';
  if (apiKey) {
    setBtnLoading(true, tone === 'roast' ? 'Roasting with Gemini...' : 'Calling Gemini...');
    try {
      let personaGuidance = "";
      if (tone === 'roast') {
        personaGuidance = `STYLE: RUTHLESS ROAST & SAVAGE CRITIQUE. Ruthlessly, hilariously, and sharply criticize the book assuming the reader disliked it or found it glaringly flawed. Tear apart the pacing, plot holes, cringe dialogue, flat characters, or wasted potential with biting wit, dripping sarcasm, and sharp metaphors. Keep it entertaining, punchy, and merciless.`;
      } else if (tone === 'punchy') {
        personaGuidance = `STYLE: PUNCHY & SHARP. Cut rambling filler. Turn rough impressions into high-impact, kinetic sentences with memorable pull-quotes and decisive verdicts.`;
      } else if (tone === 'vibe') {
        personaGuidance = `STYLE: THE VIBE & AESTHETIC. Focus on mood, pacing, emotional texture, and the psychological hangover after closing the book with evocative sensory language.`;
      } else {
        personaGuidance = `STYLE: THOUGHTFUL & INCISIVE. Elevate notes into articulate, insightful literary commentary with real cadence and weight, balancing narrative craft with emotional resonance.`;
      }

      const bookContext = [
        title ? `Referenced Work: "${title}"` : '',
        author ? `Referenced Author: ${author}` : '',
        sentiment ? `Rating/Sentiment: ${sentiment.toUpperCase()}` : ''
      ].filter(Boolean).join(' | ');

      const prompt = `You are a world-class literary editor and culture critic. A reader has provided their unedited, raw thoughts on a book. Transform their raw impressions into an elevated, beautifully written, standout review.

LITERARY CONTEXT (FOR BACKGROUND ONLY - STRICTLY FORBIDDEN FROM APPEARING IN OUTPUT):
${bookContext || 'Book review'}

READER'S RAW NOTES:
"""${original}"""

TRANSFORMATION RULES:
1. ${personaGuidance}
2. ${tone === 'roast' ? "Amplify any critique, flaw, or disappointment into a ruthless roast. Even if raw notes are brief or mixed, roast the book relentlessly." : "Strictly maintain the reader's genuine opinions, ratings, and emotions."}
3. CRITICAL REQUIREMENT: Do NOT include or mention the book's title or the author's name ANYWHERE in the review. The review will be displayed directly underneath the book's title and author on the reader's shelf, so mentioning them is strictly redundant and forbidden. Write directly about the story, prose, characters, pacing, and reading experience without citing the title or author.
4. FORBIDDEN OPENINGS: Never start sentences with "In [Title]...", "In this book...", "[Author] delivers...", "This novel...", or similar introductory framing. Jump immediately into the review.
5. Do NOT use em dashes. Use commas, semicolons, colons, or standard punctuation instead.
6. Elevate the vocabulary, rhythm, and clarity so it sounds brilliant and deeply engaging.
7. If they jotted bullet fragments, synthesize them into cohesive, compelling prose.
8. Return ONLY the refined review text. Do NOT wrap in quotation marks. Do NOT include markdown headers, labels, or greetings.`;

      const candidateModels = ['gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-1.5-flash'];
      let generated = '';

      for (const model of candidateModels) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
          const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.8, maxOutputTokens: 1000 }
            })
          });

          if (resp.ok) {
            const data = await resp.json();
            generated = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (generated) break;
          }
        } catch (mErr) {
          console.warn(`[AI Refine] Custom key attempt with ${model} failed:`, mErr);
        }
      }

      if (generated) {
        input.value = sanitizeReviewOutput(generated, title, author);
        updateCharCounter();
        showUndo(`Refined (${toneLabel})`);
        setBtnLoading(false);
        if (typeof window !== 'undefined' && window.App?.showToast) {
          const toastMsg = tone === 'roast' ? '🔥 Review refined (Roast)!' : '✨ Review refined with Gemini AI!';
          window.App.showToast(toastMsg);
        }
        return;
      }
    } catch (err) {
      console.warn('[AI Refine] Custom Gemini API call failed:', err);
    }
  }

  // 3. Tier 3: Browser-Native On-Device AI (window.ai / Gemini Nano)
  if (typeof window !== 'undefined' && (window.ai?.languageModel || (typeof ai !== 'undefined' && ai?.languageModel))) {
    setBtnLoading(true, tone === 'roast' ? 'Roasting On-Device...' : 'On-Device AI...');
    const aiResult = await _tryOnDeviceAI(original, { title, author, sentiment, tone });
    if (aiResult) {
      input.value = sanitizeReviewOutput(aiResult, title, author);
      updateCharCounter();
      showUndo(`Refined (${toneLabel})`);
      setBtnLoading(false);
      if (typeof window !== 'undefined' && window.App?.showToast) {
        const toastMsg = tone === 'roast' ? '🔥 Review refined (Roast)!' : '✨ Review refined with on-device AI!';
        window.App.showToast(toastMsg);
      }
      return;
    }
  }

  // 4. Tier 4: Enhanced Local Heuristic Polish Engine (100% offline fallback)
  const polished = _heuristicPolishReview(original);
  setBtnLoading(false);
  if (cloudErrorMsg && (!apiKey)) {
    // Alert user that Cloud AI had an issue instead of pretending
    if (typeof window !== 'undefined' && window.App?.showToast) {
      window.App.showToast(`⚠️ Cloud AI issue (${cloudErrorMsg}). Applied offline cleanup.`);
    }
  } else if (polished && polished !== original) {
    input.value = sanitizeReviewOutput(polished, title, author);
    updateCharCounter();
    showUndo('Polished (Local)');
    if (typeof window !== 'undefined' && window.App?.showToast) {
      const toastMsg = tone === 'roast' ? '🔥 Review polished (Local)!' : '✨ Review polished (Local)!';
      window.App.showToast(toastMsg);
    }
  } else {
    input.value = sanitizeReviewOutput(original, title, author);
    if (typeof window !== 'undefined' && window.App?.showToast) {
      window.App.showToast('✨ Thoughts already look clean!');
    }
  }
}

// ==========================================
// Layer 2: Series Reconciliation & Ghost Engine
// ==========================================

/**
 * Normalizes an ISBN string by stripping hyphens and whitespace.
 * @param {string|number} isbn 
 * @returns {string}
 */
export function normalizeISBN(isbn) {
  if (!isbn) return '';
  return String(isbn).replace(/[^0-9X]/gi, '').toUpperCase();
}

/**
 * Normalizes a title for loose matching by stripping parentheticals, edition notes, subtitles, punctuation.
 * @param {string} title 
 * @returns {string}
 */
export function normalizeSeriesTitle(title) {
  if (!title) return '';
  return title
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/:\s*.+$/, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Reconciles fetched series volumes with user's read books.
 * Produces a unified list containing both read books (isGhost: false) and unread volumes (isGhost: true).
 * 
 * @param {Array<Object>} fetchedVolumes - Volumes retrieved from SeriesMetadataFetcher
 * @param {Array<Object>} userBooks - Array of user book objects (App.books)
 * @param {string} seriesName - Name of the series
 * @returns {Array<Object>} Unified sorted list of read and ghost books
 */
export function classifySeriesBooks(fetchedVolumes = [], userBooks = [], seriesName = '') {
  if (!seriesName) return [];
  
  const normSeriesName = String(seriesName).toLowerCase().trim();

  // 1. Filter user books belonging to this series (excluding TBR)
  const userSeriesBooks = (userBooks || []).filter(b => {
    if (!b || !b.seriesName) return false;
    const bSeries = String(b.seriesName).toLowerCase().trim();
    return bSeries === normSeriesName && !b.currentlyReading && b.status !== 'to-read';
  });

  const matchedUserBookIds = new Set();
  const resultBooks = [];

  // Helper for title matching
  const matchesTitle = (userTitle, volTitle) => {
    if (!userTitle || !volTitle) return false;
    const nt1 = normalizeSeriesTitle(userTitle);
    const nt2 = normalizeSeriesTitle(volTitle);
    if (!nt1 || !nt2) return false;
    if (nt1 === nt2) return true;

    // Small edit-distance fuzzy match only when lengths are nearly identical
    if (Math.abs(nt1.length - nt2.length) <= 2 && nt1.length >= 4 && nt2.length >= 4) {
      let diffs = 0;
      const shorter = nt1.length <= nt2.length ? nt1 : nt2;
      const longer = nt1.length > nt2.length ? nt1 : nt2;
      for (let i = 0; i < shorter.length && diffs <= 2; i++) {
        if (shorter[i] !== longer[i]) diffs++;
      }
      diffs += longer.length - shorter.length;
      if (diffs <= 2) return true;
    }

    return false;
  };

  // Helper for ISBN matching (supporting ISBN-10 vs ISBN-13)
  const matchesISBN = (userIsbn, volIsbn) => {
    const u = normalizeISBN(userIsbn);
    const v = normalizeISBN(volIsbn);
    if (!u || !v) return false;
    if (u === v) return true;
    if (u.length === 10 && v.length === 13 && v.startsWith('978') && v.substring(3, 12) === u.substring(0, 9)) return true;
    if (v.length === 10 && u.length === 13 && u.startsWith('978') && u.substring(3, 12) === v.substring(0, 9)) return true;
    return false;
  };

  // Helper for Series Number matching
  const matchesSeriesNumber = (userNum, volNum) => {
    if (userNum === null || userNum === undefined || volNum === null || volNum === undefined) return false;
    const n1 = parseFloat(userNum);
    const n2 = parseFloat(volNum);
    if (isNaN(n1) || isNaN(n2)) return false;
    return n1 === n2;
  };

  // 2. Iterate through fetched volumes and match against user books
  (fetchedVolumes || []).forEach((vol, idx) => {
    if (!vol || !vol.title) return;

    let matchedUserBook = null;

    // Tier 1: Match by ISBN
    if (vol.isbn) {
      matchedUserBook = userSeriesBooks.find(ub => 
        !matchedUserBookIds.has(ub.id) && matchesISBN(ub.isbn, vol.isbn)
      );
    }

    // Tier 2: Match by Series Number
    if (!matchedUserBook && vol.seriesNumber != null) {
      matchedUserBook = userSeriesBooks.find(ub => 
        !matchedUserBookIds.has(ub.id) && matchesSeriesNumber(ub.seriesNumber, vol.seriesNumber)
      );
    }

    // Tier 3: Match by Fuzzy / Normalized Title
    if (!matchedUserBook) {
      matchedUserBook = userSeriesBooks.find(ub => 
        !matchedUserBookIds.has(ub.id) && matchesTitle(ub.title, vol.title)
      );
    }

    if (matchedUserBook) {
      matchedUserBookIds.add(matchedUserBook.id);
      const parsedNum = (matchedUserBook.seriesNumber != null && !isNaN(parseFloat(matchedUserBook.seriesNumber)))
        ? parseFloat(matchedUserBook.seriesNumber)
        : (vol.seriesNumber != null ? parseFloat(vol.seriesNumber) : null);
      resultBooks.push({
        ...matchedUserBook,
        isGhost: false,
        seriesNumber: parsedNum,
        seriesName: matchedUserBook.seriesName || seriesName
      });
    } else {
      // Construct Ghost Book
      const safeId = 'ghost-' + (vol.isbn ? normalizeISBN(vol.isbn) : (vol.title ? vol.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') : String(idx)));
      const volNum = vol.seriesNumber != null ? parseFloat(vol.seriesNumber) : null;
      const pages = vol.pages || vol.pageCount || 0;
      const words = vol.words || vol.wordCount || (pages > 0 ? (typeof pagesToWords === 'function' ? pagesToWords(pages) : pages * 300) : 80000);
      const pubYear = vol.year ? (parseInt(vol.year, 10) || vol.year) : '';

      resultBooks.push({
        id: safeId,
        title: vol.title,
        author: vol.author || (userSeriesBooks[0]?.author) || 'Unknown',
        seriesName: seriesName,
        seriesNumber: volNum,
        year: pubYear,
        pub_year: pubYear,
        isbn: vol.isbn || null,
        coverUrl: vol.coverUrl || '',
        cover: vol.coverUrl || '',
        pages: pages,
        pageCount: pages,
        words: words,
        wordCount: words,
        days: 5,
        sentiment: 'ghost',
        isGhost: true,
        status: 'unread',
        currentlyReading: false,
        format: 'physical',
        fiction: true
      });
    }
  });

  // 3. Append unmatched user read books
  userSeriesBooks.forEach(ub => {
    if (!matchedUserBookIds.has(ub.id)) {
      resultBooks.push({
        ...ub,
        isGhost: false,
        seriesNumber: (ub.seriesNumber != null && !isNaN(parseFloat(ub.seriesNumber))) ? parseFloat(ub.seriesNumber) : null,
        seriesName: ub.seriesName || seriesName
      });
    }
  });

  // 4. Sort unified list ascending by seriesNumber and published year
  resultBooks.sort((a, b) => {
    const numA = (a.seriesNumber != null && !isNaN(a.seriesNumber)) ? Number(a.seriesNumber) : 9999;
    const numB = (b.seriesNumber != null && !isNaN(b.seriesNumber)) ? Number(b.seriesNumber) : 9999;
    if (numA !== numB) return numA - numB;

    const yearA = parseInt(a.year || a.pub_year || 9999, 10) || 9999;
    const yearB = parseInt(b.year || b.pub_year || 9999, 10) || 9999;
    if (yearA !== yearB) return yearA - yearB;

    return (a.title || '').localeCompare(b.title || '');
  });

  return resultBooks;
}

if (typeof window !== 'undefined') {
  window.classifySeriesBooks = classifySeriesBooks;
  window.normalizeISBN = normalizeISBN;
  window.normalizeSeriesTitle = normalizeSeriesTitle;
}

export function toggleSeriesView() {
  const view = document.getElementById('seriesShelfView');
  const btn = document.getElementById('seriesViewBtn');
  const desktopShelf = document.getElementById('desktopShelfWrapper') || document.getElementById('shelfModule');
  const mobileShelf = document.getElementById('view-mobile');
  const filterPanel = document.getElementById('filterOverlayPanel');
  if (!view) return;
  const isOpen = view.classList.contains('open');
  if (isOpen) {
    view.classList.remove('open');
    if (btn) btn.classList.remove('active');
    if (desktopShelf) desktopShelf.style.display = '';
    if (mobileShelf) mobileShelf.style.display = '';
  } else {
    if (typeof this.renderSeriesShelf === 'function') this.renderSeriesShelf();
    else if (typeof window !== 'undefined' && window.App && typeof window.App.renderSeriesShelf === 'function') window.App.renderSeriesShelf();
    view.classList.add('open');
    if (btn) btn.classList.add('active');
    if (desktopShelf) desktopShelf.style.display = 'none';
    if (mobileShelf) mobileShelf.style.display = 'none';
    if (filterPanel) filterPanel.classList.remove('open');
  }
}

export async function renderSeriesShelf() {
  const container = document.getElementById('seriesShelfView');
  if (!container) return;

  const allBooks = (this && this.books) || (typeof window !== 'undefined' && window.App && window.App.books) || [];
  const seriesBooks = allBooks.filter(b => b && b.seriesName && !b.currentlyReading && b.status !== 'to-read');

  const backHeader = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;padding:10px 14px;background:rgba(237,224,208,0.8);border-radius:6px;border:1px solid rgba(139,94,60,0.2);">
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;font-style:italic;color:var(--wood-dark);">📚 Series View</div>
    <button onclick="App.toggleSeriesView()" class="btn-secondary" style="padding:5px 12px;font-family:'DM Mono',monospace;font-size:11px;font-weight:600;cursor:pointer;background:var(--wood-dark);color:#f0e8dc;border:none;border-radius:4px;">← Back to Bookshelf</button>
  </div>`;

  if (!seriesBooks.length) {
    container.innerHTML = backHeader + '<div style="padding:32px;text-align:center;color:var(--wood-light);font-family:\'DM Mono\',monospace;font-size:12px;letter-spacing:0.1em;">NO SERIES TRACKED YET<br><span style="font-size:10px;margin-top:6px;display:block;">Edit any book to add it to a series</span></div>';
    return;
  }

  const rawNames = [...new Set(seriesBooks.map(b => (b.seriesName || '').trim()).filter(Boolean))];
  const canonicalMap = {};
  rawNames.forEach(name => {
    let matched = null;
    for (const c of Object.keys(canonicalMap)) {
      if (isTypoOrVariant(name, c)) {
        matched = c;
        break;
      }
    }
    canonicalMap[name] = matched || name;
  });
  const seriesNames = [...new Set(Object.values(canonicalMap))];

  // Sizing helpers
  const MIN_BOOK_H = 186, DAY2_H = 207, USABLE_H = 480;
  const LOG2 = Math.log(2), LOG_MAX = Math.log(30);
  const scaleH = (days) => {
    const d = Number(days) || 5;
    if (d <= 1) return MIN_BOOK_H;
    if (d <= 2) return MIN_BOOK_H + (d - 1) * (DAY2_H - MIN_BOOK_H);
    const t = (Math.log(d) - LOG2) / Math.max(0.001, LOG_MAX - LOG2);
    return Math.max(MIN_BOOK_H, Math.round(DAY2_H + Math.min(1, t) * (USABLE_H - DAY2_H)));
  };

  const scaleW = (words) => {
    const MIN_W = 20, MAX_W = 68, MIN_W_WORDS = 20000;
    const w = Number(words) || 75000;
    if (w <= MIN_W_WORDS) return MIN_W;
    const anchorMax = 170000;
    const t = Math.max(0, Math.min(1, (w - MIN_W_WORDS) / (anchorMax - MIN_W_WORDS)));
    const curved = Math.pow(t, 0.92);
    let px = MIN_W + curved * 40;
    if (w > anchorMax) {
      const overT = Math.min(1, (w - anchorMax) / 120000);
      px += overT * 8;
    }
    return Math.max(MIN_W, Math.min(MAX_W, Math.round(px)));
  };

  const renderGroupHTML = (name, books, isFetching = false) => {
    const readCount = books.filter(b => !b.isGhost).length;
    const totalCount = books.length;
    const maxNum = Math.max(...books.map(b => (b.seriesNumber != null && !isNaN(b.seriesNumber)) ? Number(b.seriesNumber) : 0), totalCount);
    const denominator = maxNum > 0 ? maxNum : (totalCount || 1);
    const pct = Math.round((readCount / denominator) * 100);

    const spinesHTML = books.map((b, idx) => {
      const h = scaleH(b.days || 5);
      const w = scaleW(b.words || b.wordCount || 75000);
      const fs = Math.max(12, Math.min(16, Math.round(h * 0.048)));
      const titleEsc = esc(b.title || 'Untitled');
      const sNum = b.seriesNumber != null ? `#${b.seriesNumber}` : '';

      if (b.isGhost) {
        return `<div class="series-spine-slot ghost" data-ghost="true" data-series-num="${b.seriesNumber != null ? b.seriesNumber : ''}" style="width:${w}px;height:${h}px;position:relative;flex-shrink:0;">
          <div class="spine ghost" data-ghost="true" style="height:${h}px;width:${w}px;">
            <span class="ghost-badge">${sNum || '?'}</span>
            <div class="spine-top-band"></div>
            <div class="spine-inner">
              <span class="spine-title ghost-title" style="font-size:${fs}px;">${titleEsc}</span>
            </div>
            <span class="ghost-tag">UNREAD</span>
          </div>
        </div>`;
      } else {
        const c = sColor(b.sentiment || 'mixed', idx);
        const sentColors = { love: '#1c3f78', like: '#1e5c3a', mixed: '#c89018', dislike: '#8c1a28' };
        const sentBandColor = sentColors[b.sentiment] || c;
        const sentLabel = (typeof LABELS !== 'undefined' && LABELS[b.sentiment]) || b.sentiment || 'Sentiment';
        const coverImg = b.cover || b.coverUrl || '';
        const useSpineArt = (typeof localStorage !== 'undefined') ? (localStorage.getItem('shelf_spine_art') === 'true') : false;
        const hasCoverArt = useSpineArt && Boolean(coverImg);
        const safeCoverUrl = hasCoverArt ? String(coverImg).replace(/"/g, '&quot;') : '';
        const spineClass = hasCoverArt ? 'spine has-cover-art' : 'spine';
        const spineBg = hasCoverArt
          ? `background-image:url(&quot;${safeCoverUrl}&quot;);background-size:cover;background-position:center;background-color:${c};`
          : `background:linear-gradient(168deg,${c}e0 0%,${c} 45%,${c}a8 100%);`;

        return `<div class="series-spine-slot" data-ghost="false" data-series-num="${b.seriesNumber != null ? b.seriesNumber : ''}" onclick="App.openPanel(window.App._findBookById('${b.id}'))" style="width:${w}px;height:${h}px;position:relative;flex-shrink:0;cursor:pointer;">
          <div class="${spineClass}" style="height:${h}px;width:${w}px;${spineBg}">
            <span class="series-spine-badge">${sNum}</span>
            <div class="spine-top-band" style="background:${sentBandColor};" title="Sentiment: ${sentLabel}"></div>
            <div class="spine-inner">
              <span class="spine-title" style="font-size:${fs}px;">${titleEsc}</span>
            </div>
          </div>
        </div>`;
      }
    }).join('');

    const rowsHTML = books.map(b => {
      const isGhost = Boolean(b.isGhost);
      const titleEsc = esc(b.title || 'Untitled');
      const authorEsc = esc(b.author || 'Unknown');
      const sNum = b.seriesNumber != null ? `#${b.seriesNumber}` : ' - ';
      const cover = b.cover || b.coverUrl || '';

      if (isGhost) {
        return `<div class="series-book-item ghost" data-ghost="true">
          <span class="series-book-num">${sNum}</span>
          <div class="series-book-cover-fallback">👻</div>
          <div class="series-book-info">
            <div class="series-book-title">${titleEsc}</div>
            <div class="series-book-author">${authorEsc}</div>
          </div>
          <span class="series-book-sent" style="background:rgba(61,43,31,0.2); border:1px dashed rgba(61,43,31,0.4);"></span>
          <span class="series-book-status">Unread</span>
        </div>`;
      } else {
        const sentColor = (typeof COLORS !== 'undefined' && COLORS[b.sentiment]) || '#c4b9aa';
        const statusText = b.status === 'to-read' ? 'to read' : (b.sentiment || 'logged');
        const coverEl = cover
          ? `<img loading="lazy" decoding="async" class="series-book-cover" src="${esc(cover)}" onerror="if(this&&this.style){this.style.display='none';if(this.nextSibling&&this.nextSibling.style)this.nextSibling.style.display='flex';}" alt=""><span class="series-book-cover-fallback" style="display:none">📚</span>`
          : `<span class="series-book-cover-fallback">📚</span>`;

        return `<div class="series-book-item" data-ghost="false" onclick="App.openPanel(window.App._findBookById('${b.id}'))">
          <span class="series-book-num">${sNum}</span>
          ${coverEl}
          <div class="series-book-info">
            <div class="series-book-title">${titleEsc}</div>
            <div class="series-book-author">${authorEsc}</div>
          </div>
          <span class="series-book-sent" style="background:${sentColor}"></span>
          <span class="series-book-status">${statusText}</span>
        </div>`;
      }
    }).join('');

    const safeId = encodeURIComponent(name).replace(/%/g, '_');
    return `<div class="series-group" id="series-group-${safeId}">
      <div class="series-group-header">
        <div class="series-group-title">📚 ${esc(name)}</div>
        <div class="series-group-pct">${readCount}/${denominator} (${pct}%)</div>
      </div>
      <div class="series-shelf-container">
        <div class="series-books-shelf">${spinesHTML}</div>
        <div class="series-shelf-plank"></div>
      </div>
      <div class="series-book-list">${rowsHTML}</div>
    </div>`;
  };

  // Initial Sync Render
  const initialHTML = seriesNames.map(name => {
    const userGroupBooks = seriesBooks.filter(b => canonicalMap[(b.seriesName || '').trim()] === name);
    return renderGroupHTML(name, userGroupBooks, true);
  }).join('');
  container.innerHTML = backHeader + initialHTML;

  // Background Fetch & Async Reconcile
  const fetcher = (typeof SeriesMetadataFetcher !== 'undefined' ? SeriesMetadataFetcher : (typeof window !== 'undefined' ? (window.SeriesMetadataFetcher || (window.App && window.App.SeriesMetadataFetcher)) : null));

  for (const name of seriesNames) {
    const userGroupBooks = seriesBooks.filter(b => canonicalMap[(b.seriesName || '').trim()] === name);
    const author = userGroupBooks[0]?.author || '';

    try {
      let volumes = [];
      if (fetcher && typeof fetcher.fetchSeriesVolumes === 'function') {
        volumes = await fetcher.fetchSeriesVolumes(name, author);
      }
      const reconciled = classifySeriesBooks(volumes, allBooks, name);
      const safeId = encodeURIComponent(name).replace(/%/g, '_');
      const groupEl = document.getElementById(`series-group-${safeId}`);
      if (groupEl) {
        groupEl.outerHTML = renderGroupHTML(name, reconciled, false);
      }
    } catch (err) {
      console.warn(`[SeriesShelf] Failed to load series metadata for "${name}":`, err);
      const reconciled = classifySeriesBooks([], allBooks, name);
      const safeId = encodeURIComponent(name).replace(/%/g, '_');
      const groupEl = document.getElementById(`series-group-${safeId}`);
      if (groupEl) {
        groupEl.outerHTML = renderGroupHTML(name, reconciled, false);
      }
    }
  }
}

export function togglePubYearCustom(forceCustom) {
  const sel = document.getElementById('editPubYearSelect');
  const inp = document.getElementById('editPubYearCustom');
  const btn = document.getElementById('editPubYearCustomToggle');
  const hidden = document.getElementById('editPubYear');
  if (!sel || !inp) return;

  const showCustom = (typeof forceCustom === 'boolean') ? forceCustom : (inp.style.display === 'none');
  if (showCustom) {
    sel.style.display = 'none';
    inp.style.display = 'block';
    if (btn) btn.textContent = '‹ Releases';
    if (hidden && hidden.value) inp.value = hidden.value;
    inp.focus();
  } else {
    inp.style.display = 'none';
    sel.style.display = 'block';
    if (btn) btn.textContent = 'Custom';
    if (hidden && hidden.value) {
      const matchOpt = Array.from(sel.options).find(o => o.value === String(hidden.value));
      if (matchOpt) sel.value = String(hidden.value);
    }
  }
}

export function onPubYearSelectChange(val) {
  const hidden = document.getElementById('editPubYear');
  const inp = document.getElementById('editPubYearCustom');
  if (val === 'custom') {
    togglePubYearCustom(true);
  } else if (val === 'fetch') {
    fetchAndPopulateReleaseYears(true);
  } else {
    const y = parseInt(val, 10);
    if (!isNaN(y)) {
      if (hidden) hidden.value = y;
      if (inp) inp.value = y;
      applyEditionDetailsForYear(y);
    }
  }
}

export function onPubYearCustomInput(val) {
  const y = parseInt(val, 10);
  const hidden = document.getElementById('editPubYear');
  if (hidden) hidden.value = isNaN(y) ? '' : y;
  if (!isNaN(y)) {
    applyEditionDetailsForYear(y);
  }
}

export function applyEditionDetailsForYear(year) {
  const book = (window.App && window.App.editingBook) || null;
  if (!book || !book.editions || !Array.isArray(book.editions)) return;
  const match = book.editions.find(e => e.year === year);
  if (!match) return;

  // 1. If edition has page count and user hasn't explicitly overridden words
  if (match.pages && match.pages > 0) {
    const wcEl = document.getElementById('editWords');
    if (wcEl && (!book.wordCountSource || book.wordCountSource === 'unknown' || book.wordCountSource === 'calculated')) {
      const calcWords = (typeof pagesToWords === 'function') ? pagesToWords(match.pages) : match.pages * 300;
      wcEl.value = calcWords;
      book.words = calcWords;
      book.pageCount = match.pages;
      book.pages = match.pages;
      const badge = document.getElementById('editWcSourceBadge');
      if (badge) {
        badge.textContent = `📖 ${year} release (${match.pages}p)`;
        badge.style.background = 'rgba(61,43,31,0.08)';
        badge.style.color = 'var(--wood-light)';
      }
    }
  }

  // 2. If edition has coverUrl and user hasn't pasted custom cover
  if (match.coverUrl && !book.customCoverUploaded) {
    if (typeof previewEditCover === 'function') {
      previewEditCover(match.coverUrl);
    }
  }
}

export async function fetchAndPopulateReleaseYears(forceShowAlert = false) {
  const book = (window.App && window.App.editingBook) || null;
  const sel = document.getElementById('editPubYearSelect');
  if (!book || !book.title || !sel) return;

  const currentY = parseInt(document.getElementById('editPubYear')?.value || book.year, 10) || null;

  try {
    const fetcher = (typeof fetchBookReleaseYears === 'function')
      ? fetchBookReleaseYears
      : (window.App && window.App.fetchBookReleaseYears);
    if (!fetcher) return;

    const data = await fetcher(book.title, book.author);
    if (!data || !data.publishYears || data.publishYears.length === 0) {
      if (forceShowAlert && typeof showToast === 'function') {
        showToast('No additional releases found.');
      }
      return;
    }

    book.editions = Array.isArray(book.editions) ? book.editions : [];
    const existingYears = new Set(book.editions.map(e => e.year));

    data.publishYears.forEach(y => {
      if (!existingYears.has(y)) {
        book.editions.push({
          year: y,
          pages: (y === data.firstPublishYear && data.medianPages) ? data.medianPages : 0,
          coverUrl: '',
          isbn: null
        });
        existingYears.add(y);
      }
    });

    const allYears = Array.from(existingYears).filter(y => y && !isNaN(y)).sort((a, b) => a - b);
    const origYear = data.firstPublishYear || book.originalYear || allYears[0];
    book.originalYear = origYear;

    const liveSel = document.getElementById('editPubYearSelect');
    if (liveSel) {
      let opts = allYears.map(y => {
        const isSel = (currentY && y === currentY) || (!currentY && y === origYear);
        let label = `${y}`;
        if (y === origYear) label += ' (Original)';
        else label += ' Edition';
        return `<option value="${y}"${isSel ? ' selected' : ''}>${label}</option>`;
      }).join('');

      opts += `<option value="custom">✏️ Custom Year...</option>`;
      liveSel.innerHTML = opts;
      if (currentY && allYears.includes(currentY)) {
        liveSel.value = String(currentY);
      }
    }

    if (forceShowAlert && typeof showToast === 'function') {
      showToast(`Loaded ${allYears.length} releases.`);
    }
  } catch (err) {
    console.warn('[ReleaseYears] fetchAndPopulateReleaseYears error:', err);
  }
}

export function logSession() {
  console.log('App.logSession triggered');
}

if (typeof window !== 'undefined') {
  window.addToToRead = addToToRead;
  window.toggleAiToneMenu = toggleAiToneMenu;
  window.selectToneAndRefine = selectToneAndRefine;
  window.selectAiTone = selectAiTone;
  window.revertAiReview = revertAiReview;
  window.aiSummarizeReview = aiSummarizeReview;
  window.sanitizeReviewOutput = sanitizeReviewOutput;
  window.onTimelineDateChange = onTimelineDateChange;
  window.applyCalendarSpanToDays = applyCalendarSpanToDays;
  window.detectEditSeries = detectEditSeries;
  window.acceptSeriesSuggestion = acceptSeriesSuggestion;
  window._autoEnrichSeries = _autoEnrichSeries;
  window.cleanNorm = cleanNorm;
  window.findMatchingLibrarySeries = findMatchingLibrarySeries;
  window.isTypoOrVariant = isTypoOrVariant;
  window.levenshteinDistance = levenshteinDistance;
  window.togglePubYearCustom = togglePubYearCustom;
  window.onPubYearSelectChange = onPubYearSelectChange;
  window.onPubYearCustomInput = onPubYearCustomInput;
  window.applyEditionDetailsForYear = applyEditionDetailsForYear;
  window.fetchAndPopulateReleaseYears = fetchAndPopulateReleaseYears;
  window.App = window.App || {};
  window.App.addToToRead = addToToRead;
  window.App.toggleAiToneMenu = toggleAiToneMenu;
  window.App.selectToneAndRefine = selectToneAndRefine;
  window.App.selectAiTone = selectAiTone;
  window.App.revertAiReview = revertAiReview;
  window.App.aiSummarizeReview = aiSummarizeReview;
  window.App.sanitizeReviewOutput = sanitizeReviewOutput;
  window.App.onTimelineDateChange = onTimelineDateChange;
  window.App.applyCalendarSpanToDays = applyCalendarSpanToDays;
  window.App.detectEditSeries = detectEditSeries;
  window.App.acceptSeriesSuggestion = acceptSeriesSuggestion;
  window.App._autoEnrichSeries = _autoEnrichSeries;
  window.App.cleanNorm = cleanNorm;
  window.App.findMatchingLibrarySeries = findMatchingLibrarySeries;
  window.App.isTypoOrVariant = isTypoOrVariant;
  window.App.levenshteinDistance = levenshteinDistance;
  window.App.togglePubYearCustom = togglePubYearCustom;
  window.App.onPubYearSelectChange = onPubYearSelectChange;
  window.App.onPubYearCustomInput = onPubYearCustomInput;
  window.App.applyEditionDetailsForYear = applyEditionDetailsForYear;
  window.App.fetchAndPopulateReleaseYears = fetchAndPopulateReleaseYears;
}
