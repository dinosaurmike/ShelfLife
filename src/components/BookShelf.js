/**
 * src/components/BookShelf.js
 * Scrolling Bookshelf, Spine Sizing (Logarithmic Height & Word Count Width), Badges & Drag-and-Drop
 */

import { SYMBOLS, getSentimentEmoji, getFormatIcon, getLanguageFlag, renderRatingStars } from '../constants/symbols.js';

export const SHELF_CONSTANTS = {
  SHELF_H: 540,
  USABLE_H: 480,
  MIN_BOOK_H: 186,
  DAY2_H: 207,
  MIN_W: 20,
  MAX_W: 68,
  MIN_W_WORDS: 20000,
  TOP_PAD: 90
};

export function dayToHeight(dayVal, dayScaleMax = 30) {
  const { MIN_BOOK_H, DAY2_H, USABLE_H } = SHELF_CONSTANTS;
  if (dayVal <= 1) return MIN_BOOK_H;
  if (dayVal <= 2) {
    return MIN_BOOK_H + (dayVal - 1) * (DAY2_H - MIN_BOOK_H);
  }

  const LOG2 = Math.log(2);
  const LOG_MAX = Math.log(Math.max(dayScaleMax, 3));
  const logVal = Math.log(dayVal);
  const t = (logVal - LOG2) / Math.max(0.001, LOG_MAX - LOG2);
  return DAY2_H + Math.min(1, t) * (USABLE_H - DAY2_H);
}

export function scaleH(days, dayScaleMax = 30) {
  return Math.max(SHELF_CONSTANTS.MIN_BOOK_H, Math.round(dayToHeight(days, dayScaleMax)));
}

export function scaleW(words, maxWords = 240000) {
  const { MIN_W, MAX_W, MIN_W_WORDS } = SHELF_CONSTANTS;
  const w = Number(words) || 80000;
  if (w <= MIN_W_WORDS) return MIN_W;
  const anchorMax = Math.max(140000, Math.min(180000, maxWords));
  const t = Math.max(0, Math.min(1, (w - MIN_W_WORDS) / (anchorMax - MIN_W_WORDS)));
  const curved = Math.pow(t, 0.92);
  let px = MIN_W + curved * 40;
  if (w > anchorMax) {
    const overT = Math.min(1, (w - anchorMax) / 120000);
    px += overT * 8;
  }
  return Math.max(MIN_W, Math.min(MAX_W, Math.round(px)));
}

export function sColor(sentiment) {
  switch (sentiment) {
    case 'love':
      return 'linear-gradient(180deg, #1c3f78 0%, #2563eb 100%)';
    case 'like':
      return 'linear-gradient(180deg, #1e5c3a 0%, #10b981 100%)';
    case 'mixed':
      return 'linear-gradient(180deg, #f59e0b 0%, #d97706 100%)';
    case 'dislike':
      return 'linear-gradient(180deg, #ef4444 0%, #8c1a28 100%)';
    default:
      return 'linear-gradient(180deg, #64748b 0%, #475569 100%)';
  }
}

export function renderSpineBadge(book) {
  let badges = '';
  if (book.isBookOfTheYear) {
    badges += `<span class="spine-crown" title="Book of the Year">${SYMBOLS.ACHIEVEMENTS.CROWN}</span>`;
  }
  if (book.format === 'audiobook' || book.format === 'audio') {
    badges += `<span class="audiobook-badge" title="Audiobook">${SYMBOLS.BOOKS.AUDIOBOOK}</span>`;
  } else if (book.format === 'ebook' || book.format === 'digital') {
    badges += `<span class="ebook-badge" title="Ebook">${SYMBOLS.BOOKS.EBOOK}</span>`;
  }
  if (book.language && book.language !== 'English') {
    const flag = getLanguageFlag(book.language);
    if (flag) {
      badges += `<span class="spine-lang-badge" title="${book.language}">${flag}</span>`;
    }
  }
  if (book.isPrivate) {
    badges += `<span class="spine-private-lock" title="Private">${SYMBOLS.NAVIGATION.LOCK}</span>`;
  }
  return badges;
}

export function renderShelf(appInstance, BOOKS, allBooks, crBooks) {
  const app = appInstance || (typeof window !== 'undefined' ? window.App : null);
  if (!app) return;

  const booksRow = document.getElementById('booksRow');
  const shelfBack = document.getElementById('shelfBack');
  const shelfPlank = document.getElementById('shelfPlank');
  const yAxis = document.getElementById('yAxis');
  const shelfUnit = document.getElementById('shelfUnit');

  if (!booksRow) return;

  if (booksRow) booksRow.innerHTML = '';
  if (shelfBack) shelfBack.innerHTML = '';
  if (shelfPlank) shelfPlank.innerHTML = '';
  if (yAxis) yAxis.innerHTML = '';

  const { SHELF_H, TOP_PAD } = SHELF_CONSTANTS;
  if (shelfUnit) {
    shelfUnit.style.minHeight = (SHELF_H + TOP_PAD + 48) + 'px';
  }
  if (yAxis) {
    yAxis.style.height = (SHELF_H + TOP_PAD + 48) + 'px';
  }
  booksRow.style.height = (SHELF_H + TOP_PAD) + 'px';
  booksRow.style.alignItems = 'flex-end';
  booksRow.style.position = 'relative';

  let booksList = BOOKS || [];
  const actualMaxDays = Math.max(...booksList.map(b => Number(b.days) || 0), 10);
  const dayScaleMax = Math.ceil(Math.max(1, actualMaxDays) / 5) * 5;
  const maxWords = Math.max(...(allBooks || booksList).map(b => Number(b.words) || 0), 20000);

  // Y-axis tick lines
  const tickStep = actualMaxDays <= 6 ? 1 : actualMaxDays <= 15 ? 3 : actualMaxDays <= 30 ? 5 : 7;
  const tickVals = [];
  for (let d = tickStep; d <= actualMaxDays; d += tickStep) tickVals.push(d);
  if (!tickVals.includes(Math.round(actualMaxDays))) tickVals.push(Math.round(actualMaxDays));

  const uniqueTicks = [...new Set(tickVals)].sort((a, b) => a - b);
  uniqueTicks.forEach(val => {
    if (yAxis) {
      const tick = document.createElement('div');
      tick.className = 'y-tick';
      const topPos = TOP_PAD + SHELF_H - Math.round(dayToHeight(val, dayScaleMax));
      tick.style.cssText = `top:${topPos}px;transform:translateY(-50%);right:8px;`;
      tick.textContent = val + 'd';
      yAxis.appendChild(tick);
    }
    if (shelfBack && val > 0) {
      const line = document.createElement('div');
      line.className = 'grid-line';
      line.style.top = (TOP_PAD + SHELF_H - Math.round(dayToHeight(val, dayScaleMax))) + 'px';
      shelfBack.appendChild(line);
    }
  });

  if (yAxis) {
    const yLbl = document.createElement('div');
    yLbl.className = 'y-axis-label';
    yLbl.style.cssText = 'position:absolute;left:-9px;top:50%;transform:rotate(-90deg) translateX(-50%);transform-origin:0 0;font-size:12.5px;letter-spacing:0.38em;text-transform:uppercase;color:var(--wood-light);white-space:nowrap;';
    yLbl.textContent = 'DAYS TO READ';
    yAxis.appendChild(yLbl);
  }

  const ALL_MONTHS_LIST = typeof ALL_MONTHS !== 'undefined' ? ALL_MONTHS : ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const MONTH_TO_QUARTER_MAP = typeof MONTH_TO_QUARTER !== 'undefined' ? MONTH_TO_QUARTER : {
    January:'Q1', February:'Q1', March:'Q1',
    April:'Q2', May:'Q2', June:'Q2',
    July:'Q3', August:'Q3', September:'Q3',
    October:'Q4', November:'Q4', December:'Q4'
  };

  let groupLabels, getGroup;

  if (app.multiYearRange && app.multiYearRange !== 'single') {
    const byYear = {};
    booksList.forEach(b => {
      const y = String(b.readYear || b.year);
      if (!byYear[y]) byYear[y] = [];
      if (!b.dnf && !b.currentlyReading && b.status !== 'reading') {
        byYear[y].push(b);
      }
    });

    const aggregatedBooks = [];
    groupLabels = Object.keys(byYear).sort((a, b) => Number(a) - Number(b));
    getGroup = (b) => String(b.year);

    groupLabels.forEach(y => {
      const books = byYear[y];
      if (books.length === 0) return;

      const avgDays = books.reduce((s, b) => s + (Number(b.days) || 0), 0) / books.length;
      const avgWords = books.reduce((s, b) => s + (Number(b.words) || 0), 0) / books.length;

      const sentCounts = {love:0, like:0, mixed:0, dislike:0};
      books.forEach(b => {
        if (sentCounts[b.sentiment] !== undefined) sentCounts[b.sentiment]++;
      });
      const domSent = Object.keys(sentCounts).reduce((a, b) => sentCounts[a] > sentCounts[b] ? a : b);

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

    booksList = aggregatedBooks;
  } else if (app.quarterMode) {
    const now = new Date();
    const curQ = Math.ceil((now.getMonth() + 1) / 3);
    const isCurrentYear = (app.currentYear === now.getFullYear());
    groupLabels = isCurrentYear ? ['Q1', 'Q2', 'Q3', 'Q4'].slice(0, curQ) : ['Q1', 'Q2', 'Q3', 'Q4'];
    getGroup = (b) => MONTH_TO_QUARTER_MAP[b.month] || 'Q1';
  } else {
    const usedMonths = [...new Set(booksList.map(b => b.month).filter(Boolean))];
    groupLabels = ALL_MONTHS_LIST.filter(m => usedMonths.includes(m));
    if (!groupLabels.length) groupLabels = [ALL_MONTHS_LIST[new Date().getMonth()]];
    getGroup = (b) => b.month;
  }

  const byGroup = {};
  groupLabels.forEach(g => { byGroup[g] = []; });
  booksList.forEach(b => {
    const g = getGroup(b);
    if (!byGroup[g]) byGroup[g] = [];
    byGroup[g].push(b);
  });

  const escapeFn = (typeof app._escapeHtml === 'function') ? app._escapeHtml.bind(app) : (s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]));

  groupLabels.forEach(g => {
    const gBooks = byGroup[g] || [];
    if (!gBooks.length) return;

    const groupWrap = document.createElement('div');
    groupWrap.className = 'shelf-month-group';
    groupWrap.style.cssText = 'display:flex;align-items:flex-end;gap:3px;position:relative;margin-right:16px;';

    gBooks.forEach((book, bIdx) => {
      const bHeight = scaleH(book.days || 1, dayScaleMax);
      const bWidth = scaleW(book.words || 20000, maxWords);
      const spine = document.createElement('div');
      spine.className = 'spine';
      spine.dataset.id = book.id;
      spine.style.cssText = `height:${bHeight}px;width:${bWidth}px;background:${sColor(book.sentiment)};position:relative;cursor:pointer;border-radius:2px 2px 0 0;flex-shrink:0;`;

      const titleEl = document.createElement('div');
      titleEl.className = 'spine-title';
      titleEl.textContent = book.title || 'Untitled';
      
      if (book.isAggregateYear) {
         titleEl.style.cssText = 'writing-mode:vertical-rl;transform:rotate(180deg);font-size:15px;color:#fff;overflow:hidden;white-space:nowrap;padding:8px 2px;height:100%;display:flex;align-items:center;justify-content:center;letter-spacing:2px;font-weight:700;font-family:"DM Mono",monospace;text-shadow:0 1px 2px rgba(0,0,0,0.2);';
         spine.appendChild(titleEl);
         
         spine.onclick = (e) => { e.stopPropagation(); };
         spine.onmouseover = (e) => {
            if (typeof window.showChartTT === 'function') {
               window.showChartTT(`<div class="ctt-title">${book.title} Aggregate</div><div class="ctt-body">${book.bookCount} books read<br>Avg: ${Math.round(book.days)} days/book<br>Avg: ${Math.round(book.words/1000)}k words/book</div>`, e);
            }
         };
         spine.onmousemove = (e) => { if (typeof window.moveChartTT === 'function') window.moveChartTT(e); };
         spine.onmouseout = () => { if (typeof window.hideChartTT === 'function') window.hideChartTT(); };
      } else {
         titleEl.style.cssText = 'writing-mode:vertical-rl;transform:rotate(180deg);font-size:11px;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:8px 2px;max-height:85%;';
         spine.appendChild(titleEl);
         
         if (book._countReaders > 0) {
           const readersBadge = document.createElement('span');
           readersBadge.className = 'readers-badge';
           readersBadge.title = `${book._countReaders} members read this`;
           readersBadge.style.cssText = 'position:absolute;bottom:35px;left:50%;transform:translateX(-50%);font-size:10px;background:rgba(255,255,255,0.2);color:#fff;border-radius:10px;padding:2px 6px;font-family:\'DM Mono\',monospace;z-index:5;white-space:nowrap;';
           readersBadge.innerHTML = `👥 ${book._countReaders}`;
           spine.appendChild(readersBadge);
         }

         const badgeHtml = renderSpineBadge(book);
         if (badgeHtml) {
           const badgeWrap = document.createElement('div');
           badgeWrap.className = 'spine-badges';
           badgeWrap.innerHTML = badgeHtml;
           spine.appendChild(badgeWrap);
         }

         const editBtn = document.createElement('button');
         editBtn.className = 'book-edit-btn';
         editBtn.innerHTML = SYMBOLS.BOOKS.PENCIL;
         editBtn.title = 'Edit Book';
         editBtn.onclick = (e) => {
           e.stopPropagation();
           if (typeof app.openEditModal === 'function') app.openEditModal(book);
         };
         spine.appendChild(editBtn);

         const dragHandle = (!book.isAggregateYear && !book.currentlyReading && book.status !== 'reading') ? document.createElement('div') : null;
          if (dragHandle) {
            dragHandle.className = 'drag-handle spine-drag-handle';
            dragHandle.setAttribute('draggable', 'true');
            dragHandle.dataset.bookId = book.id;
            dragHandle.title = 'Drag to reorder';
            dragHandle.setAttribute('aria-label', 'Drag to reorder');
            dragHandle.innerHTML = '<span class="drag-handle-icon">⠿</span>';
            spine.appendChild(dragHandle);
          }

          spine.onclick = (e) => {
            const curApp = (typeof window !== 'undefined' ? window.App : null) || app;
            if (curApp && (curApp.isEditMode || curApp._editMode || curApp._reorderMode)) {
              if (e) {
                e.preventDefault();
                e.stopPropagation();
              }
              return;
            }
            if (typeof app.openPanel === 'function') {
              app.openPanel(book);
            } else if (typeof window !== 'undefined' && typeof window.openPanel === 'function') {
              window.openPanel(book);
            } else if (typeof app.openBookModal === 'function') {
              app.openBookModal(book.id);
            } else if (typeof app.openEditModal === 'function') {
              app.openEditModal(book);
            }
          };
          if (typeof app.setupDrag === 'function') {
            app.setupDrag(spine, book.id);
          }
      }

      groupWrap.appendChild(spine);
    });

    booksRow.appendChild(groupWrap);
  });

  const parent = booksRow.parentElement;
  if (parent) {
    let xLbl = document.getElementById('booksXAxisLabel');
    if (!xLbl) {
      xLbl = document.createElement('div');
      xLbl.id = 'booksXAxisLabel';
      xLbl.style.cssText = 'position:absolute;bottom:-18px;left:50%;transform:translateX(-50%);font-size:11.5px;letter-spacing:0.2em;text-transform:uppercase;color:var(--wood-light);white-space:nowrap;pointer-events:none;';
      parent.appendChild(xLbl);
    }
    xLbl.textContent = 'TIMELINE (MONTH) / WORD COUNT (WIDTH)';
  }
}

export function initBookShelf(appInstance) {
  const app = appInstance || (typeof window !== 'undefined' ? window.App : null);
  if (!app) return;

  app.scaleH = (days, maxDays) => scaleH(days, maxDays);
  app.scaleW = (words, maxWords) => scaleW(words, maxWords);
  app.dayToHeight = (dayVal, maxDays) => dayToHeight(dayVal, maxDays);
  app.sColor = (sentiment) => sColor(sentiment);
}
