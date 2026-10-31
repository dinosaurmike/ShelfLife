/**
 * ShelfLife Statistics, Charts, Wrapped & Recap Feature (src/features/stats.js)
 * Encapsulates PaceLine SVG chart, masthead statistics, reading goals, sentiment analysis,
 * scatter plots, duration histograms, heatmap calendar, publication vintage/decades charts,
 * genre pie charts, fiction ratio bars, author demographics analysis, dot matrix mosaic,
 * closing statistics strip, Year in Review / Wrapped interactive slideshow, and monthly recap cards.
 */

import {
  ALL_MONTHS,
  COLORS,
  LABELS,
  GENRE_COLORS,
  LANGUAGE_FLAGS,
  WORDS_PER_PAGE,
  CROWN_SVG,
  AUTHOR_META,
  SVARS
} from '../utils/constants.js';

import {
  fmtWords,
  fmtWordsParts,
  pagesToWords
} from '../utils/math.js';

import {
  esc,
  openPanel,
  showToast,
  showChartTT,
  moveChartTT,
  hideChartTT,
  languageBadge
} from '../utils/dom.js';

import { DB, dbToBook, coverPlaceholder } from '../core/db.js';
import { WikidataAPI, WordCountAPI } from './search.js';

// ==========================================
// 1. Masthead & Pacing Renderers
// ==========================================

export function renderMastheadStats(BOOKS) {
  const el = document.getElementById('mastheadRight');
  if (!el) return;
  el.innerHTML = '';

  const RAW_BOOKS = (typeof window !== 'undefined' && window.App && window.App._rawBooks) ? window.App._rawBooks : (this._rawBooks || BOOKS);
  const isAgg = BOOKS.length > 0 && BOOKS[0].isAggregateYear;
  const trueTotalBooks = isAgg ? BOOKS.reduce((s, b) => s + (b.bookCount || 1), 0) : RAW_BOOKS.length;
  console.log('[DEBUG renderMastheadStats]', { trueTotalBooks, BOOKS_len: BOOKS.length, RAW_BOOKS_len: RAW_BOOKS.length, isAgg, RAW_BOOKS, BOOKS });
  


  if (!RAW_BOOKS.length) {
    const msg = this.isReadOnly ? 'This shelf has no books yet.' :
      'No books yet this year. Tap the <strong>+</strong> button to add your first book!';
    el.innerHTML = `<div style="padding:20px;color:var(--wood-light);font-style:italic;text-align:center;">${msg}</div>`;
    this.renderReadingGoal([]);
    return;
  }

  const totalWords = RAW_BOOKS.reduce((s, b) => s + (Number(b.words) || 0), 0);
  const avgDays = (RAW_BOOKS.reduce((s, b) => s + (Number(b.days) || 0), 0) / RAW_BOOKS.length).toFixed(1);
  const mWords = fmtWords(totalWords);
  const uniqueAuthors = new Set(RAW_BOOKS.map(b => b.author)).size;
  const authorCounts = {};
  RAW_BOOKS.forEach(b => { authorCounts[b.author] = (authorCounts[b.author] || 0) + 1; });
  const topAuthor = Object.entries(authorCounts).sort((a, b) => b[1] - a[1])[0];
  const pctPos = Math.round(RAW_BOOKS.filter(b => b.sentiment === 'love' || b.sentiment === 'like').length / RAW_BOOKS.length * 100);
  const pctLoved = Math.round(RAW_BOOKS.filter(b => b.sentiment === 'love').length / RAW_BOOKS.length * 100);
  const overallWpd = Math.round(totalWords / Math.max(1, RAW_BOOKS.reduce((s, b) => s + (Number(b.days) || 0), 0)));

  function tickUp(element, endVal, suffix, duration) {
    duration = duration || 1200;
    const numStr = String(endVal);
    const numMatch = numStr.match(/^([\d.]+)/);
    if (!numMatch) { element.textContent = endVal; return; }
    const target = parseFloat(numMatch[1]);
    const isFloat = numMatch[1].includes('.');
    const decimals = isFloat ? (numMatch[1].split('.')[1] || '').length : 0;
    suffix = suffix || numStr.replace(/^[\d.]+/, '') || '';
    const startTime = performance.now();
    function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

    function update(now) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = easeOutCubic(progress);
      const current = isFloat ? (target * eased).toFixed(decimals) : Math.round(target * eased);
      if (suffix) {
        element.innerHTML = current + `<span style="font-size:0.58em;font-weight:400;">${suffix}</span>`;
      } else {
        element.textContent = current;
      }
      if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
  }

  const animTargets = [];
  function statCol(hero, heroSize, heroLbl, sub, subLbl) {
    const col = document.createElement('div');
    col.className = 'masthead-stat-col';
    col.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start;flex:1;padding-right:18px;';
    const hNum = document.createElement('div');
    hNum.className = 'masthead-hero-num';
    hNum.style.cssText = `font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:${heroSize}px;font-weight:900;color:var(--text-primary);line-height:0.88;letter-spacing:-2px;white-space:nowrap;`;

    const heroStr = String(hero);
    const sm = heroStr.match(/^([\d.,]+)(M|K|k|%)$/i);
    if (sm) {
      hNum.innerHTML = '0' + `<span style="font-size:0.58em;font-weight:400;">${sm[2]}</span>`;
      animTargets.push({ el: hNum, val: sm[1], suffix: sm[2] });
    } else {
      hNum.textContent = '0';
      animTargets.push({ el: hNum, val: heroStr, suffix: '' });
    }
    col.appendChild(hNum);

    const hLbl = document.createElement('div');
    hLbl.style.cssText = "font-family:'DM Mono',monospace;font-size:10px;letter-spacing:0.26em;text-transform:uppercase;color:var(--text-muted);margin-top:8px;white-space:nowrap;";
    hLbl.textContent = heroLbl;
    col.appendChild(hLbl);

    if (sub) {
      const rule = document.createElement('div');
      rule.style.cssText = 'width:20px;height:1px;background:rgba(61,43,31,0.14);margin:10px 0 8px;';
      col.appendChild(rule);
      const sNum = document.createElement('div');
      sNum.style.cssText = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:17px;font-weight:700;color:var(--text-secondary);line-height:1;white-space:nowrap;";
      sNum.textContent = sub;
      col.appendChild(sNum);
      const sLbl2 = document.createElement('div');
      sLbl2.style.cssText = "font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.18em;text-transform:uppercase;color:var(--text-muted);opacity:0.7;margin-top:4px;white-space:nowrap;";
      sLbl2.textContent = subLbl;
      col.appendChild(sLbl2);
    }
    return col;
  }

  function vRule() {
    const d = document.createElement('div');
    d.className = 'masthead-vrule';
    d.style.cssText = 'width:1px;background:rgba(61,43,31,0.1);align-self:stretch;flex-shrink:0;margin-right:28px;';
    return d;
  }


  const crLineEl = document.getElementById('mastheadCRLine');
  if (crLineEl) { crLineEl.style.display = 'none'; crLineEl.textContent = ''; }

  const booksCol = statCol(trueTotalBooks, 48, 'books read', avgDays + ' days', 'avg. per book');
  el.appendChild(booksCol);
  el.appendChild(vRule());
  el.appendChild(statCol(mWords, 34, 'words read', overallWpd.toLocaleString(), 'avg. words / day'));
  el.appendChild(vRule());
  el.appendChild(statCol(uniqueAuthors, 34, 'unique authors', topAuthor ? topAuthor[0].split(' ').pop() + ' ×' + topAuthor[1] : ' - ', 'most read'));
  el.appendChild(vRule());

  function makeQueueCard(typeLabel, count, book, statusAction) {
    const title = book ? book.title : 'No books yet';
    const author = book ? book.author : 'Tap + to add';
    const coverUrl = (book && book.coverUrl) ? book.coverUrl : (typeof coverPlaceholder === 'function' ? coverPlaceholder(title, author, book ? book.sentiment : 'mixed') : '');
    
    const dataAttrs = book ? `data-id="${book.id}" data-status="${book.status}" data-title="${title.replace(/"/g, '&quot;')}" data-author="${author.replace(/"/g, '&quot;')}" data-cover="${coverUrl.replace(/"/g, '&quot;')}"` : '';
    const onClickAttr = book ? `onclick="App.openBookModal(this)"` : '';

    return `
      <div style="display:flex; flex-direction:column; background:rgba(255,255,255,0.6); border:1px solid rgba(61,43,31,0.08); border-radius:6px; padding:4px 6px; width:140px; box-shadow:0 1px 2px rgba(0,0,0,0.04); position:relative; flex-shrink:0;">
        <div style="font-family:'DM Mono',monospace; font-size:9px; letter-spacing:0.1em; color:var(--text-muted); text-transform:uppercase; margin-bottom:4px; display:flex; justify-content:space-between; align-items:center;">
          <span>${typeLabel} ${count > 1 ? `(${count})` : ''}</span>
          <button onclick="event.stopPropagation(); App.openModal('addBookModal'); App.selectAddStatus('${statusAction}');" style="border:none; background:transparent; color:var(--text-secondary); cursor:pointer; padding:0; line-height:1; font-size:14px; font-weight:300;" title="Add Book">+</button>
        </div>
        <div style="display:flex; gap:6px; align-items:center; cursor:pointer;" ${dataAttrs} ${onClickAttr}>
          <div style="width:24px; height:34px; border-radius:2px; background:#e0d8d0; flex-shrink:0; overflow:hidden; box-shadow:0 1px 2px rgba(0,0,0,0.1);">
            <img src="${coverUrl}" style="width:100%; height:100%; object-fit:cover; opacity:${book ? '1' : '0.4'};">
          </div>
          <div style="display:flex; flex-direction:column; overflow:hidden;">
            <div style="font-size:11px; font-weight:700; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${title.replace(/"/g, '&quot;')}">${title}</div>
            <div style="font-size:10px; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${author.replace(/"/g, '&quot;')}">${author}</div>
          </div>
        </div>
      </div>
    `;
  }

  const globalBooks = (window.App && window.App.books) ? window.App.books : [];
  const crBooks = globalBooks.filter(b => b.currentlyReading);
  const trBooks = globalBooks.filter(b => b.status === 'to-read');
  
  const crCardHtml = makeQueueCard('READING', crBooks.length, crBooks.length ? crBooks[crBooks.length - 1] : null, 'reading');
  const trCardHtml = makeQueueCard('TO-READ', trBooks.length, trBooks.length ? trBooks[trBooks.length - 1] : null, 'to-read');

  const queueCol = document.createElement('div');
  queueCol.className = 'masthead-stat-col';
  queueCol.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start;flex:1;padding-right:18px;justify-content:center;gap:8px;';
  queueCol.innerHTML = crCardHtml + trCardHtml;
  el.appendChild(queueCol);

  const fmtGroups = { audiobook: [], ebook: [], physical: [] };
  BOOKS.filter(b => !b.currentlyReading && b.status !== 'to-read').forEach(b => { const f = b.format || 'physical'; if (fmtGroups[f]) fmtGroups[f].push(b); });
  const fmtWithData = Object.entries(fmtGroups).filter(([, bks]) => bks.length >= 2);
  let fmtHtml = '';
  if (fmtWithData.length) {
    fmtHtml = fmtWithData.map(([fmt, bks]) => {
      const avg = (bks.reduce((s, b) => s + (Number(b.days) || 0), 0) / bks.length).toFixed(1);
      const icon = fmt === 'audiobook' ? '🎧' : fmt === 'ebook' ? '📱' : '📖';
      const label = fmt === 'audiobook' ? 'Audio' : fmt === 'ebook' ? 'E-book' : 'Physical';
      return `<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-muted);padding:2px 0;width:100%;min-width:90px;"><span>${icon} ${label}</span><span style="font-weight:700;color:var(--text-secondary);">${avg}d</span></div>`;
    }).join('');
  } else {
    fmtHtml = `<div style="font-size:9px;font-style:italic;color:var(--text-muted);opacity:0.7;">Not enough data</div>`;
  }
  
  el.appendChild(vRule());
  
  const rightCol = document.createElement('div');
  rightCol.className = 'masthead-stat-col';
  rightCol.style.cssText = 'display:flex;flex-direction:column;gap:10px;margin-left:auto;align-items:flex-end;';

  const fmtWrapper = document.createElement('div');
  fmtWrapper.style.cssText = 'display:flex;flex-direction:column;align-items:flex-end;font-family:\'DM Mono\',monospace;width:100%;';
  fmtWrapper.innerHTML = `<div style="font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:var(--text-muted);margin-bottom:4px;text-align:right;width:100%;">AVG DAYS / FORMAT</div><div style="width:100%;max-width:140px;">${fmtHtml}</div>`;

  const isLife = (this.multiYearRange === 'lifetime');
  const wrapTitle = isLife ? 'LIFETIME' : (this.multiYearRange && this.multiYearRange !== 'single' ? this.multiYearRange + '-YEAR' : 'YEAR');
  const wrapArg = isLife ? "'lifetime'" : (this.multiYearRange && this.multiYearRange !== 'single' ? "'" + this.multiYearRange + "'" : "");

  const btnWrapper = document.createElement('div');
  btnWrapper.style.cssText = 'display:flex;gap:6px;width:100%;justify-content:flex-end;';
  btnWrapper.innerHTML = `
    <button style="border:none;background:var(--gold,#D4AF37);color:#2C2C2C;cursor:pointer;padding:6px 10px;border-radius:6px;font-size:10px;font-weight:800;display:flex;align-items:center;gap:4px;box-shadow:0 1px 3px rgba(0,0,0,0.1);" onclick="App.openMonthlyRecap()"><span>🗓️</span> Recap</button>
    <button style="border:none;background:var(--gold,#D4AF37);color:#2C2C2C;cursor:pointer;padding:6px 10px;border-radius:6px;font-size:10px;font-weight:800;display:flex;align-items:center;gap:4px;box-shadow:0 1px 3px rgba(0,0,0,0.1);" onclick="App.openWrapped(${wrapArg})"><span>✨</span> ${wrapTitle}</button>
  `;

  rightCol.appendChild(fmtWrapper);
  rightCol.appendChild(btnWrapper);
  el.appendChild(rightCol);

  animTargets.forEach((item, idx) => {
    setTimeout(() => tickUp(item.el, item.val + item.suffix, item.suffix, 1500), idx * 150);
  });

  this.renderReadingGoal(BOOKS);
}

export function renderReadingGoal(BOOKS) {
  const goalEl = document.getElementById('mastheadGoal');
  if (!goalEl) return;

  const year = this.currentYear;
  const isAgg = this.multiYearRange !== 'single';
  let target = isAgg ? (this.aggregateGoal || 0) : ((this.readingGoals && this.readingGoals[year]) ? this.readingGoals[year] : 0);
  const read = isAgg ? (this.aggregateBooks || []).filter(b => !b.currentlyReading && !b.dnf).length : BOOKS.length;

  if ((this.isReadOnly && true) || !target) {
    goalEl.style.display = 'none';
    if (typeof this._updateStatusBar === 'function') this._updateStatusBar();
    goalEl.innerHTML = '';
    return;
  }

  const pct = Math.min(100, Math.round((read / target) * 100));
  const done = read >= target;
  const now = new Date();
  const isCurrentYear = !isAgg && (year === now.getFullYear());
  let badge = '';

  if (done) {
    badge = `<span class="goal-pace-badge goal-pace-done">🎉 Goal reached</span>`;
  } else if (isCurrentYear) {
    const dayOfYear = Math.floor((now - new Date(year, 0, 0)) / 86400000);
    const daysInYear = ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) ? 366 : 365;
    const expected = target * (dayOfYear / daysInYear);

    if (read >= expected + 1) {
      const aheadByDays = Math.floor((read - expected) / (target / daysInYear));
      badge = `<span class="goal-pace-badge goal-pace-ahead">▲ +${aheadByDays}d ahead</span>`;
    } else if (read >= expected - 1) {
      badge = `<span class="goal-pace-badge goal-pace-ontrack">🎯 On track</span>`;
    } else {
      const behindByDays = Math.ceil((expected - read) / (target / daysInYear));
      badge = `<span class="goal-pace-badge goal-pace-behind">▼ -${behindByDays}d behind</span>`;
    }
  } else {
    badge = `<span class="goal-pace-badge goal-pace-ontrack">${pct}% complete</span>`;
  }

  goalEl.style.display = '';
  const dayOfYearG = isCurrentYear ? Math.floor((now - new Date(year, 0, 0)) / 86400000) : 365;
  const daysInYearG = ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) ? 366 : 365;
  const expectedPct = isCurrentYear ? Math.round((dayOfYearG / daysInYearG) * 100) : 100;

  let pctLabel = `${pct}%`;
  if (!done && isCurrentYear) {
    const expectedBooks = target * (dayOfYearG / daysInYearG);
    if (read >= expectedBooks + 1) pctLabel += ` (+${Math.floor(read - expectedBooks)})`;
    else if (read < expectedBooks - 1) pctLabel += ` (-${Math.ceil(expectedBooks - read)})`;
  }

  goalEl.innerHTML = `
    <div class="goal-bar-wide">
      <div class="goal-bar-header">
        <span class="goal-bar-title">📚 ${typeof isAgg !== "undefined" && isAgg ? (this.multiYearRange === "lifetime" ? "Lifetime Goal" : `${this.multiYearRange}-Year Goal`) : `${year} Goal`}</span>
        <span class="goal-bar-count"><strong>${read}</strong> of <strong>${target}</strong> books</span>
        ${badge}
      </div>
      <div class="goal-bar-track">
        <div class="goal-bar-expected" style="left:${expectedPct}%;" title="Where you should be (${expectedPct}% through the year)">
          <div class="goal-bar-expected-line"></div>
          <div class="goal-bar-expected-label">${isCurrentYear ? 'Today' : ''}</div>
        </div>
        <div class="goal-bar-fill" style="width:${pct}%"></div>
        <div class="goal-bar-pct" style="left:${pct}%">${pctLabel}</div>
      </div>
    </div>`;

  // Goal bar is now statically pre-filled in HTML to prevent CSS animation bugs on some browsers.
  if (typeof this._updateStatusBar === 'function') this._updateStatusBar();
}

export function renderPaceLine(BOOKS) {
  const RAW_BOOKS = (typeof window !== 'undefined' && window.App && window.App._rawBooks) ? window.App._rawBooks : (this._rawBooks || BOOKS);
  const svg = document.getElementById('paceLineSvg');
  if (!svg) return;
  const isPastYear = String(this.currentYear) !== String(new Date().getFullYear());
  const shouldAggregate = Boolean(this.multiYearRange && this.multiYearRange !== 'single');
  if (shouldAggregate) svg.dataset.revealed = '0';
  if (!BOOKS.length) { svg.innerHTML = `<text x="10" y="50" fill="red"></text>`; return; }

  const ns = 'http://www.w3.org/2000/svg';
  let isAgg = shouldAggregate;
  let monthData = [];
  
  const titleEl = document.querySelector('.pace-module-title');
  if (titleEl) {
    titleEl.textContent = isAgg ? 'Yearly Pace' : 'Monthly Pace';
  }

  if (isAgg) {
    const yearKeys = Object.keys(this.aggregateYearData || {}).map(Number).sort();
    if (yearKeys.length <= 1) {
      isAgg = false;
    } else {
      const startYear = yearKeys[0];
      const endYear = yearKeys[yearKeys.length - 1];
      const allYears = [];
      for (let y = startYear; y <= endYear; y++) allYears.push(y);

      monthData = allYears.map(year => {
        const books = BOOKS.filter(b => (b.readYear || b.year) == year && !b.dnf && !b.currentlyReading && b.status !== 'reading');
        return {
          month: String(year),
          abbr: String(year),
          count: books.reduce((s, b) => s + (b.bookCount || 1), 0),
          words: books.reduce((sum, b) => sum + (Number(b.words) || 0), 0),
          books: books,
          projected: false,
          unread: books.length === 0
        };
      });
    }
  }

  if (!isAgg) {
    const CALENDAR_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const actualMonths = CALENDAR_MONTHS.map(month => {
      const books = RAW_BOOKS.filter(b => b.month === month);
      return {
        month,
        abbr: month.slice(0, 3).toUpperCase(),
        count: books.length,
        words: books.reduce((sum, b) => sum + (Number(b.words) || 0), 0),
        books,
        projected: false
      };
    }).filter(d => d.count > 0);

    if (!actualMonths.length) { svg.innerHTML = ''; return; }

    monthData = CALENDAR_MONTHS.map(month => {
      const actual = actualMonths.find(d => d.month === month);
      if (actual) return actual;
      return {
        month,
        abbr: month.slice(0, 3).toUpperCase(),
        count: 0,
        words: 0,
        books: [],
        projected: false,
        unread: true
      };
    });
  }

  const POWER = 3;
  const maxCount = Math.max(...monthData.map(d => d.count), 1);
  const SVG_W = 860, SVG_H = 140;
  const PAD = { t: 30, r: 34, b: 24, l: 24 };
  const chartW = SVG_W - PAD.l - PAD.r;
  const chartH = SVG_H - PAD.t - PAD.b;
  const N = monthData.length;
  const DOT_MIN_D = 14;
  const DOT_MAX_D = 52;
  const ACTUAL_FILL = '#D4B896';
  const minCount = Math.min(...monthData.map(d => d.count).filter(c => c > 0), 1);

  svg.innerHTML = '';

  function xPos(i) {
    if (N === 1) return PAD.l + chartW / 2;
    return PAD.l + (i / (N - 1)) * chartW;
  }

  function yPos(count) {
    if (count <= 0) return PAD.t + chartH;
    const MIN_Y_FRACTION = 0.12;
    const raw = Math.pow(count / maxCount, POWER);
    const scaled = MIN_Y_FRACTION + raw * (1 - MIN_Y_FRACTION);
    return PAD.t + chartH - scaled * chartH;
  }

  function dotR(count) {
    if (count <= 0) return DOT_MIN_D / 2;
    const range = Math.max(1, maxCount - minCount);
    const t = Math.min(1, (count - minCount) / range);
    return (DOT_MIN_D + t * (DOT_MAX_D - DOT_MIN_D)) / 2;
  }

  // Background grid
  for (let i = 0; i <= 4; i++) {
    const gl = document.createElementNS(ns, 'line');
    gl.setAttribute('x1', PAD.l);
    gl.setAttribute('x2', PAD.l + chartW);
    const gy = PAD.t + (chartH / 4) * i;
    gl.setAttribute('y1', gy);
    gl.setAttribute('y2', gy);
    gl.setAttribute('stroke', 'rgba(61,43,31,0.06)');
    gl.setAttribute('stroke-width', '1');
    svg.appendChild(gl);
  }

  monthData.forEach((d, i) => {
    const x = xPos(i);
    const vl = document.createElementNS(ns, 'line');
    vl.setAttribute('x1', x);
    vl.setAttribute('x2', x);
    vl.setAttribute('y1', PAD.t);
    vl.setAttribute('y2', PAD.t + chartH);
    vl.setAttribute('stroke', 'rgba(61,43,31,0.06)');
    vl.setAttribute('stroke-width', '1');
    svg.appendChild(vl);
  });

  const base = document.createElementNS(ns, 'line');
  base.setAttribute('x1', PAD.l);
  base.setAttribute('x2', PAD.l + chartW);
  base.setAttribute('y1', PAD.t + chartH);
  base.setAttribute('y2', PAD.t + chartH);
  base.setAttribute('stroke', 'rgba(61,43,31,0.18)');
  base.setAttribute('stroke-width', '1');
  svg.appendChild(base);

  monthData.forEach((d, i) => {
    if (i === 0) return;
    const prevX = xPos(i - 1);
    const x = xPos(i);
    const prevY = yPos(monthData[i - 1].count);
    const y = yPos(d.count);

    const cp1x = prevX + (x - prevX) / 2;
    const cp2x = prevX + (x - prevX) / 2;

    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', `M ${prevX} ${prevY} C ${cp1x} ${prevY}, ${cp2x} ${y}, ${x} ${y}`);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'rgba(139,99,67,0.3)');
    path.setAttribute('stroke-width', '2');
    svg.appendChild(path);
  });

  monthData.forEach((d, i) => {
    const x = xPos(i);
    const y = yPos(d.count);
    const r = dotR(d.count);

    if (d.count > 0) {
      const circle = document.createElementNS(ns, 'circle');
      circle.setAttribute('cx', x);
      circle.setAttribute('cy', y);
      circle.setAttribute('r', r);
      circle.setAttribute('fill', ACTUAL_FILL);
      circle.setAttribute('stroke', 'rgba(61,43,31,0.3)');
      circle.setAttribute('stroke-width', '1.5');
      circle.style.cursor = 'pointer';

      circle.addEventListener('mouseenter', (e) => {
        const booksList = d.books || [];
        const escapeFn = (s) => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        const bookLines = booksList.map(b => {
          const dotCol = (typeof COLORS !== 'undefined' && COLORS[b.sentiment]) || '#8b6343';
          const title = escapeFn(b.title || 'Untitled');
          const author = b.author ? ` <span style="opacity:0.75;font-size:0.9em;">by ${escapeFn(b.author)}</span>` : '';
          return `<span style="color:${dotCol};">●</span> <strong>${title}</strong>${author}`;
        }).join('<br>');

        const bodyContent = `${d.count} book${d.count !== 1 ? 's' : ''} · ${fmtWords(d.words)} words` +
          (bookLines ? `<div style="margin-top:8px;padding-top:6px;border-top:1px solid rgba(61,43,31,0.12);line-height:1.5;max-height:200px;overflow-y:auto;">${bookLines}</div>` : '');

        showChartTT(`<div class="ctt-title">${d.month}</div><div class="ctt-body">${bodyContent}</div>`, e);
      });
      circle.addEventListener('mousemove', moveChartTT);
      circle.addEventListener('mouseleave', hideChartTT);

      svg.appendChild(circle);

      const text = document.createElementNS(ns, 'text');
      text.setAttribute('x', x);
      text.setAttribute('y', y + 4);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('font-size', '10');
      text.setAttribute('font-weight', '700');
      text.setAttribute('fill', 'var(--wood-dark)');
      text.style.pointerEvents = 'none';
      text.textContent = d.count;
      svg.appendChild(text);
    }

    const label = document.createElementNS(ns, 'text');
    label.setAttribute('x', x);
    label.setAttribute('y', PAD.t + chartH + 16);
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('font-size', '9');
    label.setAttribute('font-family', "'DM Mono', monospace");
    label.setAttribute('fill', d.count > 0 ? 'var(--wood-dark)' : 'var(--wood-light)');
    label.textContent = d.abbr;
    svg.appendChild(label);
  });
}

// ==========================================
// 2. Sentiment, Charts & Quick Stats
// ==========================================

export function renderSentimentStats(BOOKS) {
  const splitEl = document.getElementById('sentimentSplitBar');
  if (!splitEl) return;
  splitEl.innerHTML = '';
  if (!BOOKS.length) return;

  const sentOrder = ['love', 'like', 'mixed', 'dislike'];
  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;height:36px;border-radius:3px;overflow:hidden;width:100%;';

  sentOrder.forEach(s => {
    const sentBooks = BOOKS.filter(b => b.sentiment === s);
    const count = sentBooks.length;
    const pct = Math.round(count / BOOKS.length * 100);
    if (!pct) return;

    const totalWords = sentBooks.reduce((sum, b) => sum + (Number(b.words) || 0), 0);
    const wordsFormatted = fmtWords(totalWords);

    const seg = document.createElement('div');
    seg.className = 'sentiment-segment';
    seg.setAttribute('tabindex', '0');
    seg.setAttribute('role', 'button');
    seg.setAttribute('aria-label', `${LABELS[s]}: ${count} book${count !== 1 ? 's' : ''}, ${wordsFormatted} words (${pct}%)`);
    seg.style.cssText = `flex:${pct};background:${COLORS[s]};display:flex;align-items:center;padding:0 12px;gap:8px;cursor:default;transition:opacity 0.15s;min-width:0;overflow:hidden;`;
    seg.innerHTML = `<span class="sent-pct" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:900;color:rgba(255,255,255,0.93);white-space:nowrap;">${pct}%</span> <span class="sent-words" style="font-family:'DM Mono',monospace;font-size:12px;font-weight:700;color:rgba(255,255,255,0.85);white-space:nowrap;">${wordsFormatted}</span>${pct >= 16 ? `<span class="sent-label" style="font-family:'DM Mono',monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.55);white-space:nowrap;">${LABELS[s]}</span>` : ''}`;

    const _showSeg = (e) => {
      seg.style.opacity = '0.82';
      showChartTT(`<div class="ctt-title">${LABELS[s]} · ${pct}% · ${wordsFormatted} words</div><div class="ctt-body">${sentBooks.length} book${sentBooks.length !== 1 ? 's' : ''}<br>${sentBooks.map(b => b.title).join('<br>')}</div>`, e);
    };

    seg.addEventListener('mouseenter', _showSeg);
    seg.addEventListener('mousemove', (e) => moveChartTT(e));
    seg.addEventListener('mouseleave', () => { seg.style.opacity = '1'; hideChartTT(); });
    bar.appendChild(seg);
  });

  splitEl.appendChild(bar);
}

export function renderCharts(BOOKS, dayDomain) {
  const elementsToClear = [
    'scatterChart', 'daysHistogram', 'heatmapChart', 'vintageChart',
    'decadeChart', 'pieLegend', 'ficBar'
  ];
  elementsToClear.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = '';
      if (id === 'vintageChart' || id === 'decadeChart') el.style.padding = '0';
    }
  });

  const recapContainer = document.getElementById('recapButtonsContainer');
  if (recapContainer) {
    recapContainer.style.display = 'none';
  }

  if (typeof this.renderSimilarReaders === 'function') this.renderSimilarReaders(BOOKS);
  if (!BOOKS.length) return;

  const totalWords = BOOKS.reduce((s, b) => s + (Number(b.words) || 0), 0);
  const overallWpd = Math.round(totalWords / Math.max(1, BOOKS.reduce((s, b) => s + (Number(b.days) || 0), 0)));
  const avgEl = document.getElementById('scatterAvgNum');
  if (avgEl) avgEl.textContent = overallWpd.toLocaleString();

  this.renderScatter(BOOKS, dayDomain);
  this.renderHistogram(BOOKS, dayDomain);
  this.renderHeatmap(BOOKS);
  this.renderVintage(BOOKS);
  this.renderDecade(BOOKS);
  this.renderMoodBoard(BOOKS);
  this.renderPie(BOOKS);
  this.renderFicBar(BOOKS);
  this.renderDotMatrix(BOOKS);
  this.renderLanguageBreakdown(BOOKS);

  if (typeof this.renderForYouRecommendations === 'function') this.renderForYouRecommendations(BOOKS);
}

export function renderHomeQuickStats(BOOKS) {
  const host = document.getElementById('homeQuickStats');
  if (!host) return;
  host.style.display = 'none';
  host.innerHTML = '';
  return;
}

// ==========================================
// 3. Specialized Analytics & SVG Visualizers
// ==========================================



export function renderClosingStrip(BOOKS) {
  const el = document.getElementById('closingStrip');
  if (!el) return;
  el.innerHTML = '';
  if (!BOOKS.length) return;

  const totalWords = BOOKS.reduce((s, b) => s + (Number(b.words) || 0), 0);
  const totalWordsMill = (totalWords / 1000000).toFixed(2);
  const uniqueAuthors = new Set(BOOKS.map(b => b.author)).size;
  const pctPos = Math.round(BOOKS.filter(b => b.sentiment === 'love' || b.sentiment === 'like').length / BOOKS.length * 100);
  const avgDays = (BOOKS.reduce((s, b) => s + (Number(b.days) || 0), 0) / BOOKS.length).toFixed(1);

  const stats = [
    { num: BOOKS.length, lbl: 'books read', sub: 'year ' + this.currentYear },
    { num: totalWordsMill + 'M', lbl: 'words read', sub: 'across all titles' },
    { num: pctPos + '%', lbl: 'enjoyed books', sub: 'liked + loved' },
    { num: avgDays, lbl: 'avg. days', sub: 'per book' },
    { num: uniqueAuthors, lbl: 'authors', sub: 'unique voices' }
  ];

  const grid = document.createElement('div');
  grid.className = 'headline-strip-grid';
  stats.forEach(s => {
    const block = document.createElement('div');
    block.className = 'headline-block';
    block.innerHTML = `<span class="headline-num">${s.num}</span><span class="headline-lbl">${s.lbl}</span><span class="headline-lbl-italic">${s.sub}</span>`;
    grid.appendChild(block);
  });
  el.appendChild(grid);
}

// ==========================================
// 4. Year in Review / Wrapped Slideshow
// ==========================================

export async function openWrapped(year) {
  if (typeof this.closeFabMenu === 'function') this.closeFabMenu();
  const yr = year || this.currentYear;
  this._wrappedYear = yr;

  let books;
  if (yr === 'lifetime' || ['2','3','4','5','10','15'].includes(String(yr))) {
    books = (this.aggregateBooks || []).filter(b => !b.currentlyReading && b.status !== 'to-read');
  } else {
    if (this.isDemoMode || this.isReadOnly) {
      books = (this.books || []).filter(b => !b.currentlyReading && b.status !== 'to-read');
    } else {
      const shelf = await DB.getOrCreateShelf(this.userId, yr);
      if (!shelf) return;
      const dbBooks = await DB.getShelfBooks(shelf.id);
      books = dbBooks.map(dbToBook).filter(b => !b.currentlyReading && b.status !== 'to-read');
    }
  }

  if (!books.length) {
    const msg = this.isReadOnly
      ? `No finished books found on this shelf for ${yr}.`
      : `No finished books for ${yr} yet - add a few to unlock your Wrapped!`;
    this.showToast(msg);
    return;
  }

  this._wrappedBooks = books;
  const data = this._analyzeWrapped(books, yr);
  this._wrappedData = data;
  this._buildWrappedSlides(data);

  const overlay = document.getElementById('wrappedOverlay');
  if (overlay) {
    overlay.classList.add('open');
    overlay.style.display = 'block';
  }

  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';
  if (!this.isReadOnly) {
    window.location.hash = `wrapped/${yr}`;
  }

  this._wrappedKeyHandler = (e) => {
    if (e.key === 'ArrowRight' || e.key === ' ') this.wrappedNext();
    else if (e.key === 'ArrowLeft') this.wrappedPrev();
    else if (e.key === 'Escape') this.closeWrapped();
  };
  document.addEventListener('keydown', this._wrappedKeyHandler);
}

export function closeWrapped() {
  const overlay = document.getElementById('wrappedOverlay');
  if (overlay) {
    overlay.classList.remove('open');
    overlay.style.display = 'none';
  }
  document.body.style.overflow = '';
  document.documentElement.style.overflow = '';
  if (window.location.hash.startsWith('#wrapped/')) window.location.hash = '';
  if (this._wrappedKeyHandler) document.removeEventListener('keydown', this._wrappedKeyHandler);
}

export function _refreshWrappedBOTY(pickedId, opts = {}) {
  const yr = this._wrappedYear || this.currentYear;
  const pool = this._wrappedBooks || [];
  pool.forEach(b => {
    if (String(b.id) === String(pickedId)) b.bookOfYear = yr;
    else if (Number(b.bookOfYear) === Number(yr)) b.bookOfYear = null;
  });
  this._wrappedData = this._analyzeWrapped(pool, yr);
  this._buildWrappedSlides(this._wrappedData);
  this._goToWrappedSlide(0, 'prev');
}

export function _wrappedChangeBOTYClick() {
  const yr = this._wrappedYear || this.currentYear;
  const pool = this._wrappedBooks || [];
  const loved = pool.filter(b => b.sentiment === 'love');
  if (typeof this.showBOTYPicker === 'function') {
    this.showBOTYPicker(loved.length ? loved : pool.slice(), {
      mode: 'wrapped',
      year: yr,
      required: false,
      onPick: (id) => this._refreshWrappedBOTY(id)
    });
  }
}

export function wrappedNext() {
  if (this._wrappedSlide < this._wrappedTotal - 1) this._goToWrappedSlide(this._wrappedSlide + 1, 'next');
}

export function wrappedPrev() {
  if (this._wrappedSlide > 0) this._goToWrappedSlide(this._wrappedSlide - 1, 'prev');
}

export function _goToWrappedSlide(idx, dir) {
  if (idx && typeof idx === 'object' && idx.dataset) {
    idx = parseInt(idx.dataset.idx) || 0;
  }
  const slides = document.querySelectorAll('#wrappedSlides .wrapped-slide');
  const dots = document.querySelectorAll('#wrappedDots .wrapped-dot');
  if (!slides.length) return;

  idx = Math.max(0, Math.min(idx, slides.length - 1));
  slides.forEach((s, i) => {
    s.classList.toggle('active', i === idx);
  });
  dots.forEach((d, i) => d.classList.toggle('active', i === idx));
  this._wrappedSlide = idx;
  this._animateWrappedSlide(idx);
}

export function _archetypeIcon(id) {
  const wrap = (inner) => '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">'+inner+'</svg>';
  const icons = {
    worldBuilder: '<circle cx="50" cy="50" r="22"/><ellipse cx="50" cy="50" rx="36" ry="12" transform="rotate(-25 50 50)"/>',
    classicist: '<path d="M28 22h44M32 28h36M38 28v44M50 28v44M62 28v44M32 72h36M28 78h44"/>',
    trendspotter: '<circle cx="50" cy="50" r="32"/><path d="M50 26v24l16 10"/><circle cx="50" cy="50" r="3"/><path d="M74 26l6-6M26 26l-6-6"/>',
    authorLoyalist: '<path d="M30 20h40a6 6 0 0 1 6 6v50a6 6 0 0 1-6 6H30a6 6 0 0 1-6-6V26a6 6 0 0 1 6-6z"/><path d="M38 34h24M38 46h24M38 58h14"/>',
    optimist: '<circle cx="50" cy="50" r="18"/><path d="M50 14v8M50 78v8M14 50h8M78 50h8M25 25l6 6M69 69l6 6M25 75l6-6M69 31l6-6"/>',
    voracious: '<path d="M24 76h52v8H24zM20 60h60v8H20zM26 44h48v8H26zM22 28h56v8H22zM28 14h44v7H28z"/>',
    comfortReader: '<path d="M26 40h40v26a14 14 0 0 1-14 14H40a14 14 0 0 1-14-14V40z"/><path d="M66 46h8a8 8 0 0 1 8 8v2a8 8 0 0 1-8 8h-8M36 22q4 6 0 10M46 20q4 6 0 12M56 22q4 6 0 10"/>',
    completionist: '<circle cx="50" cy="50" r="34"/><path d="M35 51l11 11 20-24"/>',
    speedDemon: '<path d="M55 8 28 56h19l-6 36 33-52H56z"/>',
    deepDiver: '<path d="M50 12v40"/><path d="M34 40l16 16 16-16"/><path d="M18 74q8 9 16 0t16 0 16 0"/><path d="M18 86q8 9 16 0t16 0 16 0"/>',
    genreDrifter: '<circle cx="50" cy="50" r="34"/><path d="M63 37 45 45 37 63 55 55z"/><circle cx="50" cy="50" r="3"/>',
    crimeFiend: '<circle cx="44" cy="44" r="22"/><path d="M60 60 82 82"/><path d="M38 44h12"/>',
    nonFictionNerd: '<circle cx="31" cy="57" r="14"/><circle cx="69" cy="57" r="14"/><path d="M45 55h10"/><path d="M17 51l7-13h11"/><path d="M83 51l-7-13H65"/>',
    listener: '<path d="M22 58v-8a28 28 0 0 1 56 0v8"/><rect x="14" y="54" width="16" height="26" rx="7"/><rect x="70" y="54" width="16" height="26" rx="7"/>',
    digitalNative: '<rect x="28" y="12" width="44" height="76" rx="7"/><path d="M40 30h20M40 42h20M40 54h12"/><circle cx="50" cy="76" r="3"/>',
    romantic: '<path d="M50 80C26 62 22 42 22 36a13 13 0 0 1 28-4 13 13 0 0 1 28 4c0 6-4 26-28 44z"/><path d="M40 30v22l6-5 6 5V30"/>',
    toughCritic: '<path d="M50 14l11 23 25 3-18 18 4 25-22-12-22 12 4-25-18-18 25-3z"/><path d="M40 50h20"/>',
    globalReader: '<circle cx="50" cy="50" r="34"/><ellipse cx="50" cy="50" rx="14" ry="34"/><path d="M17 50h66M23 32h54M23 68h54"/>',
    traditionalist: '<path d="M50 28c-9-6-23-8-32-6v46c9-2 23 0 32 6 9-6 23-8 32-6V22c-9-2-23 0-32 6z"/><path d="M50 28v52"/>',
    streakKeeper: '<path d="M52 12c11 15 19 21 19 36a21 21 0 0 1-42 0c0-9 5-14 9-20 2 7 7 9 7 9s-5-13 7-25z"/>',
    wildCard: '<path d="M50 14C37 31 24 39 24 53a14 14 0 0 0 23 11l-5 22h16l-5-22a14 14 0 0 0 23-11c0-14-13-22-26-39z"/>'
  };
  return wrap(icons[id] || icons.wildCard);
}

export function _computePersonality(books) {
  const total = books.length || 1;
  const dnf = books.filter(b => b.dnf).length;
  const avgDays = books.reduce((s,b)=>s+(b.days||5),0)/total;
  const avgWords = books.reduce((s,b)=>s+(b.words||0),0)/total;

  const genreCounts = {};
  books.forEach(b => { const g = b.genre || 'Unknown'; genreCounts[g] = (genreCounts[g]||0)+1; });
  const genreEntries = Object.entries(genreCounts).sort((a,b)=>b[1]-a[1]);
  const uniqueGenres = genreEntries.length;
  const topGenrePct = genreEntries.length ? genreEntries[0][1]/total : 0;

  const authorCounts = {};
  books.forEach(b => { if (b.author) authorCounts[b.author] = (authorCounts[b.author]||0)+1; });
  const authorEntries = Object.entries(authorCounts).sort((a,b)=>b[1]-a[1]);
  const topAuthorCount = authorEntries.length ? authorEntries[0][1] : 0;

  const gmatch = (re) => books.filter(b => re.test(b.genre||'')).length/total;
  const sciFiFantasyPct = gmatch(/sci-fi|science fiction|fantasy|space|cyberpunk|dystopian|speculative|magic/i);
  const crimePct = gmatch(/crime|mystery|thriller|detective|noir|suspense/i);
  const romancePct = gmatch(/romance|romantic/i);
  const nonFicPct = books.filter(b => b.fiction === false).length/total;

  const fmt = (re) => books.filter(b => re.test(b.format||'')).length/total;
  const audioPct = fmt(/audio/i), ebookPct = fmt(/ebook|kindle|digital|e-book/i), physicalPct = fmt(/physical|print|hardcover|paperback/i);

  const sent = { love:0, like:0, mixed:0, dislike:0 };
  books.forEach(b => { if (sent.hasOwnProperty(b.sentiment)) sent[b.sentiment]++; });
  const lovePct = sent.love / total;
  const toughPct = (sent.dislike + sent.mixed)/total;

  const currentYear = new Date().getFullYear();
  const classicCount = books.filter(b => b.year && b.year < 1990).length;
  const classicPct = classicCount / total;
  const contemporaryPct = books.filter(b => b.year && b.year >= currentYear - 3).length / total;

  const eras = new Set();
  books.forEach(b => { const y = b.year||0; if (y>0 && y<1980) eras.add('c'); else if (y>=1980 && y<2015) eras.add('v'); else if (y>=2015) eras.add('m'); });
  const eraCount = eras.size;

  const mIdx = { January:0,February:1,March:2,April:3,May:4,June:5,July:6,August:7,September:8,October:9,November:10,December:11 };
  const present = new Array(12).fill(false);
  books.forEach(b => { if (b.month && mIdx[b.month] !== undefined) present[mIdx[b.month]] = true; });
  let streak = 0, cur = 0;
  for (let i=0;i<12;i++){ if (present[i]) { cur++; streak = Math.max(streak,cur); } else cur = 0; }

  const rereads = books.filter(b => b.isReread).length;
  const rereadPct = rereads / total;

  const A = [];
  const push = (id,name,tagline,score) => A.push({ id, name, tagline, score });

  // High-specificity behavioral & taste archetypes
  if (sciFiFantasyPct >= 0.35) push('worldBuilder','The World Builder','You dwell in distant galaxies, magic realms, and speculative futures.', 1.72 + sciFiFantasyPct * 0.5);
  if (crimePct >= 0.35) push('crimeFiend','Crime Fiend','Chasing suspects, plot twists, and murder mysteries.', 1.70 + crimePct * 0.5);
  if (nonFicPct >= 0.45) push('nonFictionNerd','Non-Fiction Nerd','Reading to dissect and understand the real world.', 1.70 + nonFicPct * 0.5);
  if (romancePct >= 0.35) push('romantic','The Romantic','Drawn to love, electric chemistry, and unforgettable connections.', 1.68 + romancePct * 0.5);
  if (classicPct >= 0.35) push('classicist','The Classicist','Gravitating to literature that has weathered generations.', 1.68 + classicPct * 0.5);
  if (contemporaryPct >= 0.50) push('trendspotter','The Trendspotter','Always reading on the cutting edge of new releases.', 1.62 + contemporaryPct * 0.5);

  if (avgDays > 0 && avgDays < 5) push('speedDemon','Speed Demon','You devour books — just '+avgDays.toFixed(1)+' days each on average.', 1.72 + (5 - avgDays)*0.15);
  if (avgWords > 110000) push('deepDiver','Deep Diver','You gravitate to doorstoppers — '+Math.round(avgWords/1000)+'K words per book.', 1.70 + Math.min(0.5, (avgWords - 110000)/100000));
  if (total >= 20) push('voracious','The Voracious Reader','An insatiable literary appetite — '+total+' books and counting.', 1.65 + Math.min(0.5, (total - 20) * 0.02));

  if (topAuthorCount >= 3 || (topAuthorCount >= 2 && topAuthorCount / total >= 0.35)) push('authorLoyalist','The Author Loyalist','When you love an author, you dive into their entire universe.', 1.66 + (topAuthorCount / total) * 0.5);
  if (uniqueGenres >= 4 && topGenrePct <= 0.35) push('genreDrifter','Genre Drifter','You roam freely across '+uniqueGenres+' genres, never settling down.', 1.65 + uniqueGenres*0.05);
  if (lovePct >= 0.55 && total >= 4) push('optimist','The Generous Reader','You read with an open heart and find pure magic in almost every story.', 1.62 + lovePct * 0.4);
  if (toughPct >= 0.35 && total >= 4) push('toughCritic','Tough Critic','You hold every book to a discerning, unapologetic standard.', 1.62 + toughPct * 0.5);
  if (rereadPct >= 0.25 || rereads >= 2) push('comfortReader','The Comfort Reader','Returning to cherished favorites like visiting lifelong friends.', 1.60 + rereadPct * 0.6);
  if (total >= 6 && dnf/total < 0.05) push('completionist','Completionist','You finish what you start — unwavering follow-through.', 1.50 + (1 - dnf/total)*0.25);
  if (eraCount >= 3 || uniqueGenres >= 6) push('globalReader','Global Reader','You range far and wide across genres, eras, and perspectives.', 1.55 + eraCount*0.10 + uniqueGenres*0.02);
  if (streak >= 5) push('streakKeeper','Streak Keeper','You kept the pages turning '+streak+' months straight.', 1.45 + streak*0.05);

  // Formats (Balanced so they reflect format preference without steamrolling reading habits)
  if (physicalPct > 0.75) push('traditionalist','Traditionalist','Paper and ink, always — '+Math.round(physicalPct*100)+'% physical books.', 1.15 + physicalPct * 0.25);
  if (audioPct > 0.55) push('listener','The Listener','You read with your ears — '+Math.round(audioPct*100)+'% audiobooks.', 1.15 + audioPct * 0.30);
  if (ebookPct > 0.55) push('digitalNative','Digital Native','Your whole library lives on a screen — '+Math.round(ebookPct*100)+'% ebooks.', 1.15 + ebookPct * 0.25);

  A.sort((a,b)=>b.score - a.score);
  let result = A.length ? A : [{ id:'wildCard', name:'Wild Card', tagline:'Your reading defies every pattern — utterly unpredictable.', score:1 }];

  const primary = result[0];
  const secondary = (result[1] && result[1].score >= 1.25) ? result[1] : null;

  return { primary, secondary, all: result };
}

export function _literaryEquivalents(d) {
  const fw = n => fmtWords(n);
  const out = [];
  const w = d.totalWords || 0;
  const longest = d.longestBookWords || 0;

  if (w >= 1084000) out.push({ metric: (w/1084170).toFixed(1)+'×', text: 'the entire Harry Potter series', sub: fw(w)+' words read' });
  if (longest >= 540000) out.push({ metric: '1+', text: 'book longer than War & Peace', sub: d.longestBookTitle || '' });
  
  if (d.totalBooks > 50) out.push({ metric: '4×', text: 'the average American reader', sub: d.totalBooks+' books vs ~12 a year' });
  else if (d.totalBooks >= 24) out.push({ metric: '2×', text: 'the average American reader', sub: d.totalBooks+' books vs ~12 a year' });

  if (d.avgDays > 0 && d.avgDays < 3) out.push({ metric: '8 days', text: 'to read Lord of the Rings at your pace', sub: '~'+d.avgDays+' days per book' });
  if (w >= 2000000) out.push({ metric: Math.round(w/95000)+'', text: 'average novels, back to back', sub: fw(w)+' words total' });

  if (out.length < 2) {
    const hours = Math.round(w/250/60);
    out.push({ metric: hours+' hrs', text: 'of pure reading time', sub: 'at 250 words a minute' });
    out.push({ metric: (w/95000).toFixed(1)+'×', text: 'an average novel', sub: fw(w)+' words read' });
  }

  return out.slice(0,3);
}

export function _analyzeWrapped(books, year) {
  const totalBooks = books.length;
  const totalWords = books.reduce((s, b) => s + (b.words || 0), 0);
  const totalPages = books.reduce((s, b) => s + (b.pageCount || 0), 0);

  const seasons = { spring: 0, summer: 0, fall: 0, winter: 0 };
  const monthToSeason = { January:'winter', February:'winter', March:'spring', April:'spring', May:'spring', June:'summer', July:'summer', August:'summer', September:'fall', October:'fall', November:'fall', December:'winter' };
  books.forEach(b => { if (b.month && monthToSeason[b.month]) seasons[monthToSeason[b.month]]++; });
  const topSeason = Object.entries(seasons).sort((a,b) => b[1] - a[1])[0];
  const seasonSpread = Object.values(seasons).filter(v => v > 0).length;

  let readingPersonality, readingPersonalityEmoji;
  if (seasonSpread >= 4 && Math.max(...Object.values(seasons)) / totalBooks < 0.4) {
    readingPersonality = 'Year-Round Consistent'; readingPersonalityEmoji = '🌍';
  } else {
    const sMap = { spring: ['Spring Reader','🌸'], summer: ['Summer Binger','☀️'], fall: ['Fall Cozy Reader','🍂'], winter: ['Winter Bookworm','❄️'] };
    [readingPersonality, readingPersonalityEmoji] = sMap[topSeason[0]];
  }
  const seasonPct = totalBooks ? Math.round((topSeason[1] / totalBooks) * 100) : 0;

  const genreCounts = {};
  books.forEach(b => { const g = b.genre || 'Unknown'; genreCounts[g] = (genreCounts[g] || 0) + 1; });
  const genreEntries = Object.entries(genreCounts).sort((a,b) => b[1] - a[1]);
  const uniqueGenres = genreEntries.length;
  const topGenrePct = totalBooks ? (genreEntries[0] ? genreEntries[0][1] : 0) / totalBooks : 0;

  let genrePattern, genrePatternEmoji;
  if (topGenrePct > 0.5) { genrePattern = 'Genre Loyal'; genrePatternEmoji = '👑'; }
  else if (uniqueGenres >= 5 && topGenrePct <= 0.3) { genrePattern = 'Genre Hopper'; genrePatternEmoji = '🐇'; }
  else if (uniqueGenres >= 5) { genrePattern = 'Genre Curious'; genrePatternEmoji = '🔍'; }
  else { genrePattern = 'Genre Focused'; genrePatternEmoji = '🎯'; }

  const avgDays = totalBooks ? books.reduce((s, b) => s + (b.days || 5), 0) / totalBooks : 5;
  let pacingInsight, pacingEmoji;
  if (avgDays < 5) { pacingInsight = 'Binge Reader'; pacingEmoji = '⚡'; }
  else if (avgDays <= 10) { pacingInsight = 'Steady Pacer'; pacingEmoji = '🚶'; }
  else { pacingInsight = 'Slow Savorer'; pacingEmoji = '🐌'; }

  const authorCounts = {};
  books.forEach(b => { const a = (b.author || 'Unknown').trim(); authorCounts[a] = (authorCounts[a] || 0) + 1; });
  const authorEntries = Object.entries(authorCounts).sort((a,b) => b[1] - a[1]);
  const topAuthors = authorEntries.slice(0, 5);
  const repeatAuthors = authorEntries.filter(([,c]) => c >= 2);
  const seriesAuthors = authorEntries.filter(([,c]) => c >= 3);

  let discoveryInsight, discoveryEmoji;
  if (seriesAuthors.length > 0) { discoveryInsight = 'Series Chaser'; discoveryEmoji = '📖'; }
  else if (repeatAuthors.length >= 2) { discoveryInsight = 'Loyalty Driven'; discoveryEmoji = '🤝'; }
  else { discoveryInsight = 'Author Explorer'; discoveryEmoji = '🧭'; }

  const sentCounts = { love: 0, like: 0, mixed: 0, dislike: 0 };
  books.forEach(b => { if (b.sentiment && sentCounts.hasOwnProperty(b.sentiment)) sentCounts[b.sentiment]++; });
  const lovedPct = totalBooks ? sentCounts.love / totalBooks : 0;
  const dislikePct = totalBooks ? (sentCounts.dislike + sentCounts.mixed) / totalBooks : 0;

  let sentimentInsight, sentimentEmoji;
  if (lovedPct >= 0.7) { sentimentInsight = 'Selective Reader'; sentimentEmoji = '❤️'; }
  else if (dislikePct >= 0.3) { sentimentInsight = 'Critical Reader'; sentimentEmoji = '🧐'; }
  else { sentimentInsight = 'Mood Reader'; sentimentEmoji = '🎭'; }

  const eraCounts = { vintage: 0, modern: 0, recent: 0 };
  books.forEach(b => {
    const py = b.year || 0;
    if (py > 0 && py < 2000) eraCounts.vintage++;
    else if (py >= 2020) eraCounts.modern++;
    else if (py >= 2000) eraCounts.recent++;
  });
  const booksWithYear = eraCounts.vintage + eraCounts.modern + eraCounts.recent;

  let eraInsight, eraEmoji;
  if (booksWithYear === 0) { eraInsight = 'Timeless Taste'; eraEmoji = '⏳'; }
  else if (eraCounts.vintage / booksWithYear > 0.5) { eraInsight = 'Vintage Lover'; eraEmoji = '📜'; }
  else if (eraCounts.modern / booksWithYear > 0.5) { eraInsight = 'Modern Reader'; eraEmoji = '✨'; }
  else { eraInsight = 'Timeless Taste'; eraEmoji = '⏳'; }

  const loved = books.filter(b => b.sentiment === 'love');
  const favPool = loved.length ? loved.slice() : books.slice();
  favPool.sort((a,b) => ((b.review?1:0)-(a.review?1:0)) || ((b.words||0)-(a.words||0)));
  const crowned = books.find(b => b.bookOfYear && Number(b.bookOfYear) === Number(year));
  const fav = crowned || favPool[0] || books[books.length - 1];

  const monthCounts = {};
  ALL_MONTHS.forEach(m => monthCounts[m] = 0);
  books.forEach(b => { if (b.month) monthCounts[b.month] = (monthCounts[b.month] || 0) + 1; });
  const peakMonth = Object.entries(monthCounts).sort((a,b) => b[1] - a[1])[0] || ['January', 0];

  const longestBook = books.slice().sort((a,b)=>(b.words||0)-(a.words||0))[0] || null;

  const langCounts = {};
  books.forEach(b => { const l = b.language || 'English'; langCounts[l] = (langCounts[l] || 0) + 1; });
  const langEntries = Object.entries(langCounts).sort((a,b) => b[1] - a[1]);

  const seriesCounts = {};
  books.forEach(b => {
    if (b.seriesName && b.seriesName.trim()) {
      const s = b.seriesName.trim();
      seriesCounts[s] = (seriesCounts[s] || 0) + 1;
    }
  });
  const seriesEntries = Object.entries(seriesCounts).sort((a,b) => b[1] - a[1]);
  const topSeries = seriesEntries.length > 0 && seriesEntries[0][1] >= 2 ? seriesEntries[0] : null;

  let displayYear = year;
  if (year === 'lifetime') displayYear = 'Lifetime';
  else if (['2','3','4','5','10','15'].includes(String(year))) displayYear = 'Last ' + year + ' Years';

  const result = {
    year: displayYear, totalBooks, totalWords, totalPages,
    topLanguages: langEntries.slice(0, 4), uniqueLanguages: langEntries.length,
    topSeries,
    readingPersonality, readingPersonalityEmoji, topSeason: topSeason[0], seasonPct,
    genrePattern, genrePatternEmoji, topGenres: genreEntries.slice(0, 3), uniqueGenres,
    pacingInsight, pacingEmoji, avgDays: Math.round(avgDays * 10) / 10,
    topAuthors, discoveryInsight, discoveryEmoji,
    sentimentInsight, sentimentEmoji, sentCounts,
    eraInsight, eraEmoji,
    fav, favIsCrowned: !!crowned, favIsLoved: loved.length > 0, peakMonth: peakMonth[0], peakMonthCount: peakMonth[1],
    monthCounts,
    longestBookWords: longestBook ? (longestBook.words||0) : 0,
    longestBookTitle: longestBook ? longestBook.title : ''
  };

  result.personality = (this && this._computePersonality) ? this._computePersonality(books) : _computePersonality(books);
  result.litEquivs = (this && this._literaryEquivalents) ? this._literaryEquivalents(result) : _literaryEquivalents(result);

  return result;
}

export function _buildWrappedSlides(d) {
  const fmtNum = n => fmtWords(n);

  const escStr = s => (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  const wm = (full) => full
    ? `<div class="wrapped-wm wrapped-wm-full"><a href="https://dinomike.ca/shelflife" target="_blank" rel="noopener">Track your reading at <strong>dinomike.ca/shelflife</strong></a></div>`
    : `<div class="wrapped-wm"><a href="https://dinomike.ca/shelflife" target="_blank" rel="noopener">dinomike.ca/shelflife</a></div>`;

  const sentBar = (counts, total) => {
    if (!total) return '';
    const cols = { love:'#6ea8ff', like:'#5fd39a', mixed:'#f0c046', dislike:'#ff7a86' };
    const labels = { love:'❤️ Loved', like:'👍 Liked', mixed:'🤷 Mixed', dislike:'👎 Disliked' };
    return `<div class="wrapped-sentbar">${Object.entries(counts).filter(([,v])=>v).map(([k,v])=>`<div style="width:${(v/total*100).toFixed(1)}%;background:${cols[k]};" title="${labels[k]}: ${v}"></div>`).join('')}</div><div class="wrapped-sentlegend">${Object.entries(counts).filter(([,v])=>v).map(([k,v])=>`<span>${labels[k]} ${v}</span>`).join('')}</div>`;
  };

  const monthBar = (counts) => {
    const max = Math.max(...Object.values(counts), 1);
    return `<div class="wrapped-monthbar" style="position:relative;">
      <div style="position:absolute; top: -16px; right: 0; font-family: 'DM Mono', monospace; color: rgba(240,232,220,0.4); font-size: 10px; pointer-events: none;">Max: ${max}</div>
      ${ALL_MONTHS.map(m => `<div class="wrapped-monthbar-col"><div class="wrapped-monthbar-fill" style="height:${(counts[m]||0)/max*100}%;"></div><div class="wrapped-monthbar-lbl">${m.substring(0,1)}</div></div>`).join('')}
    </div>`;
  };

  const slides = [];
  const bgs = ['wrapped-bg-2','wrapped-bg-3','wrapped-bg-5','wrapped-bg-2','wrapped-bg-4','wrapped-bg-personality','wrapped-bg-cta'];

  const lovePct = d.totalBooks ? Math.round(d.sentCounts.love / d.totalBooks * 100) : 0;
  const posPct = d.totalBooks ? Math.round((d.sentCounts.love + d.sentCounts.like) / d.totalBooks * 100) : 0;

  /* ---- Slide 1: Stats + Sentiment ---- */
  const slide1Label = (this.isReadOnly && this.ownerDisplayName) ? `${escStr(this.ownerDisplayName)}'s ${d.year} in books` : `Your ${d.year} in books`;
  slides.push(`<div class="wrapped-content">
    <div class="wrapped-label">${slide1Label}</div>
    <div class="wrapped-stat-duo">
      <div class="wrapped-stat-cell"><div class="wrapped-big-number" data-countup="${d.totalBooks}">0</div><div class="wrapped-label">books finished</div></div>
      <div class="wrapped-stat-divider"></div>
      <div class="wrapped-stat-cell"><div class="wrapped-big-number wrapped-words-num" data-countup-fmt="${d.totalWords}">${fmtNum(0)}</div><div class="wrapped-label">words read</div></div>
    </div>
    <div class="wrapped-subtitle">${posPct}% of your reads landed as a hit — and you truly <strong>loved</strong> ${lovePct}%.</div>
    ${sentBar(d.sentCounts, d.totalBooks)}
    ${wm()}
  </div>`);

  /* ---- Slide 2: Reading Patterns (season + genre) ---- */
  const seasonEmoji = { spring:'🌸', summer:'☀️', fall:'🍂', winter:'❄️' };
  slides.push(`<div class="wrapped-content">
    <div class="wrapped-emoji">${d.readingPersonality === 'Year-Round Consistent' ? '🔁' : (seasonEmoji[d.topSeason]||'📅')}</div>
    <div class="wrapped-title">Your Reading Patterns</div>
    <div class="wrapped-subtitle">${d.readingPersonality === 'Year-Round Consistent' ? 'You read steadily all year — no season slowed you down.' : `${d.seasonPct}% of your reading happened in <strong>${d.topSeason}</strong> — that's your power season.`}</div>
    <div class="wrapped-insight-card">
      <div class="wrapped-insight-title">Top Genres</div>
      ${d.topGenres.map(([g,c]) => { const pct = Math.round(c/d.totalBooks*100); return `<div class="wrapped-genre-row"><span class="wrapped-genre-name">${escStr(g)}</span><div class="wrapped-genre-track"><div class="wrapped-genre-fill" style="width:${pct}%;"></div></div><span class="wrapped-genre-count">${c}</span></div>`; }).join('')}
    </div>
    <div class="wrapped-subtitle" style="margin-bottom:0;">${d.genrePattern === 'Genre Loyal' ? `A devoted <strong>${escStr(d.topGenres[0]?.[0] || 'reader')}</strong> reader.` : `You explored <strong>${d.uniqueGenres}</strong> genres this year.`}</div>
    ${wm()}
  </div>`);

  /* ---- Slide 3: Pace + Impact ---- */
  slides.push(`<div class="wrapped-content">
    <div class="wrapped-emoji">${d.pacingEmoji}</div>
    <div class="wrapped-title">${d.pacingInsight}</div>
    <div class="wrapped-subtitle">${d.pacingInsight === 'Binge Reader' ? `You averaged just <strong>${d.avgDays} days</strong> per book. Unstoppable.` : d.pacingInsight === 'Steady Pacer' ? `<strong>${d.avgDays} days</strong> per book — a steady, sustainable rhythm.` : `You savored each book over <strong>${d.avgDays} days</strong>. Every page counted.`}</div>
    <div class="wrapped-insight-card">
      <div class="wrapped-insight-title">Your Peak Month</div>
      <div class="wrapped-insight-value">${d.peakMonth}</div>
      <div class="wrapped-insight-detail">${d.peakMonthCount} book${d.peakMonthCount!==1?'s':''} in a single month</div>
    </div>
    ${monthBar(d.monthCounts)}
    ${wm()}
  </div>`);

  /* ---- Slide (conditional): Languages  -  only for multilingual readers ---- */
  if (d.uniqueLanguages > 1 && d.topLanguages && d.topLanguages.length) {
    slides.push(`<div class="wrapped-content">
      <div class="wrapped-emoji">🌍</div>
      <div class="wrapped-title">A Multilingual Year</div>
      <div class="wrapped-subtitle">You read across <strong>${d.uniqueLanguages}</strong> languages this year.</div>
      <div class="wrapped-insight-card">
        ${d.topLanguages.map(([l,c]) => { const pct = Math.round(c/d.totalBooks*100); const flag = (LANGUAGE_FLAGS && LANGUAGE_FLAGS[l]) || '🌐'; return `<div class="wrapped-genre-row"><span class="wrapped-genre-name">${flag} ${escStr(l)}</span><div class="wrapped-genre-track"><div class="wrapped-genre-fill" style="width:${pct}%;"></div></div><span class="wrapped-genre-count">${c}</span></div>`; }).join('')}
      </div>
      ${wm()}
    </div>`);
  }

  /* ---- Slide (conditional): Series Obsession ---- */
  if (d.topSeries) {
    slides.push(`<div class="wrapped-content">
      <div class="wrapped-emoji">📚</div>
      <div class="wrapped-title">Biggest Obsession</div>
      <div class="wrapped-subtitle">You spent a lot of time in a familiar world this year.</div>
      <div class="wrapped-insight-card">
        <div class="wrapped-insight-title">Most Read Series</div>
        <div class="wrapped-insight-value" style="font-size:20px; line-height:1.2;">${escStr(d.topSeries[0])}</div>
        <div class="wrapped-insight-detail">${d.topSeries[1]} book${d.topSeries[1]!==1?'s':''} finished</div>
      </div>
      ${wm()}
    </div>`);
  }

  /* ---- Slide 4: Literary Equivalents ---- */
  const eq = d.litEquivs || [];
  slides.push(`<div class="wrapped-content">
    <div class="wrapped-bookstack">
      ${Array.from({length:6}).map((_,i)=>`<span class="wrapped-bookstack-book" style="width:${52+ (i%3)*16}px;background:${['#6ea8ff','#5fd39a','#f0c046','#ff7a86','#c89018','#1e5c3a'][i%6]};animation-delay:${i*0.12}s;"></span>`).join('')}
    </div>
    <div class="wrapped-title">Put another way…</div>
    <div class="wrapped-subtitle">Your year stacks up against the greats.</div>
    <div class="wrapped-lit-list">
      ${eq.map(e => `<div class="wrapped-lit-row"><div class="wrapped-lit-metric">${e.metric}</div><div class="wrapped-lit-text"><div class="wrapped-lit-main">${e.text}</div><div class="wrapped-lit-sub">${escStr(e.sub)}</div></div></div>`).join('')}
    </div>
    ${wm()}
  </div>`);

  /* ---- Slide 5: Book of the Year (Cinema Poster Presentation) ---- */
  const fav = d.fav || {};
  const favCover = fav.coverUrl || fav.cover || fav.fallbackCover || '';
  const confetti = Array.from({length:14}).map((_,i)=>`<span class="wrapped-confetti-bit" style="left:${(i*7+4)%100}%;animation-delay:${(i%7)*0.35}s;background:${['#f0c046','#6ea8ff','#5fd39a','#ff7a86','#f0e8dc'][i%5]};"></span>`).join('');
  const botyChangeBtn = (this && this.isReadOnly) ? '' : `<button class="wrapped-boty-change-chip" onclick="App._wrappedChangeBOTYClick()">${d.favIsCrowned ? 'Change Pick ↺' : '👑 Crown Pick'}</button>`;
  
  slides.push(`<div class="wrapped-content wrapped-boty">
    <div class="wrapped-confetti">${confetti}</div>
    <div class="wrapped-label">Your Book of the Year</div>
    <div class="wrapped-cinema-poster-wrap">
      <div class="wrapped-gold-frame wrapped-poster-frame">
        <span class="wrapped-boty-crown">${CROWN_SVG}</span>
        ${favCover ? `<img loading="lazy" decoding="async" src="${favCover}" alt="${escStr(fav.title)}" class="wrapped-cover-huge" onerror="if(this&&this.style){this.style.display='none';if(this.parentNode&&this.parentNode.classList)this.parentNode.classList.add('no-cover');}">` : ''}
        <div class="wrapped-cover-fallback"><span>${escStr((fav.title||'?').charAt(0))}</span></div>
      </div>
    </div>
    <div class="wrapped-boty-title">${escStr(fav.title||'—')}</div>
    <div class="wrapped-subtitle">by ${escStr(fav.author||'Unknown')}</div>
    ${botyChangeBtn}
    ${fav.review ? `<div class="wrapped-insight-card"><div class="wrapped-insight-title">In your words</div><div class="wrapped-review-quote">“${escStr(fav.review.substring(0,180))}${fav.review.length>180?'…':''}”</div></div>` : ''}
    ${wm()}
  </div>`);

  /* ---- Slide 6: Personality Reveal (climax) ---- */
  const pers = d.personality || { primary:{ id:'wildCard', name:'Wild Card', tagline:'' }, secondary:null };
  const p1 = pers.primary, p2 = pers.secondary;
  const particles = Array.from({length:18}).map((_,i)=>`<span class="wrapped-particle" style="left:${(i*5.3+2)%100}%;top:${(i*61+7)%100}%;animation-delay:${(i%9)*0.4}s;animation-duration:${3+(i%5)}s;"></span>`).join('');
  
  slides.push(`<div class="wrapped-content wrapped-reveal">
    <div class="wrapped-particles">${particles}</div>
    <div class="wrapped-reveal-pre">Your reading personality</div>
    <div class="wrapped-archetype-icon">${this && this._archetypeIcon ? this._archetypeIcon(p1.id) : _archetypeIcon(p1.id)}</div>
    <div class="wrapped-personality-title-wrap">
      <div class="wrapped-archetype-glow"></div>
      <div class="wrapped-personality-name">${p1.name}</div>
    </div>
    ${p2 ? `<div class="wrapped-personality-with">with <strong>${p2.name}</strong> energy</div>` : ''}
    <div class="wrapped-subtitle wrapped-personality-tag">${p1.tagline}</div>
    ${wm()}
  </div>`);

  /* ---- Slide 7: Share CTA ---- */
  const slide7Title = (this.isReadOnly && this.ownerDisplayName) ? `That's ${escStr(this.ownerDisplayName)}'s ${d.year}!` : `That's your ${d.year}!`;
  slides.push(`<div class="wrapped-content wrapped-cta">
    <div class="wrapped-emoji">🎉</div>
    <div class="wrapped-title">${slide7Title}</div>
    <div class="wrapped-subtitle">${d.totalBooks} books · ${p1.name}${p2?' + '+p2.name:''} · ${fmtNum(d.totalWords)} words</div>
    <div class="cinematic-ambient-bg"></div>
    <div class="cinematic-cta-container">
      <button class="cinematic-btn primary cinematic-hero-btn" onclick="App.quickShareWrapped()">
        <span class="btn-icon">✨</span> Share Your Year in Review →
      </button>
      <div class="cinematic-actions-row">
        <button class="cinematic-chip-action" onclick="App.openWrappedShare()">
          <span>⚙️ Customize Image</span>
        </button>
        <button class="cinematic-chip-action" onclick="App.shareWrappedText()">
          <span>📋 Copy Text</span>
        </button>
      </div>
      <a href="https://dinomike.ca/shelflife" target="_blank" rel="noopener" class="cinematic-sub-link">
        ShelfLife · A personal sanctuary for readers
      </a>
    </div>
  </div>`);

  const container = document.getElementById('wrappedSlides');
  if (container) {
    container.innerHTML = slides.map((html, i) => `<div class="wrapped-slide${i === 0 ? ' active' : ''}"><div class="wrapped-bg ${bgs[i % bgs.length]}"></div>${html}</div>`).join('');
  }

  this._wrappedTotal = slides.length;
  this._wrappedSlide = 0;

  const dotsEl = document.getElementById('wrappedDots');
  if (dotsEl) {
    dotsEl.innerHTML = slides.map((_, i) => `<div class="wrapped-dot${i === 0 ? ' active' : ''}" data-idx="${i}" onclick="App._goToWrappedSlide(this)"></div>`).join('');
  }

  if (this && this._animateWrappedSlide) {
    this._animateWrappedSlide(0);
  } else {
    _animateWrappedSlide(0);
  }
}

export function _animateWrappedSlide(idx) {
  const slides = document.querySelectorAll('#wrappedSlides .wrapped-slide');
  const slide = slides[idx];
  if (!slide) return;

  const easeOut = p => 1 - Math.pow(1 - p, 3);
  const fmtNum = n => fmtWords(n);

  slide.querySelectorAll('[data-countup]').forEach(el => {
    const end = parseInt(el.getAttribute('data-countup'), 10) || 0;
    const dur = 1400, t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      el.textContent = Math.round(end * easeOut(p)).toLocaleString();
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });

  slide.querySelectorAll('[data-countup-fmt]').forEach(el => {
    const end = parseInt(el.getAttribute('data-countup-fmt'), 10) || 0;
    const dur = 1600, t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      el.textContent = fmtNum(end * easeOut(p));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });

  const revealBars = (sel, prop) => {
    slide.querySelectorAll(sel).forEach((el, i) => {
      const target = el.style[prop];
      if (!target) return;
      el.style[prop] = '0';
      setTimeout(() => { el.style[prop] = target; }, 120 + i * 60);
    });
  };

  revealBars('.wrapped-sentbar > div', 'width');
  revealBars('.wrapped-genre-fill', 'width');
  revealBars('.wrapped-monthbar-fill', 'height');

  if (slide.querySelector('.wrapped-boty') && !slide.dataset.confettiFired) {
    slide.dataset.confettiFired = '1';
    if (this && this._fireWrappedConfetti) this._fireWrappedConfetti(slide);
    else _fireWrappedConfetti(slide);
  }

  const revealEls = slide.querySelectorAll('.wrapped-archetype-glow, .wrapped-archetype-icon, .wrapped-personality-name, .wrapped-personality-with, .wrapped-personality-tag');
  if (revealEls.length) {
    revealEls.forEach(el => { el.style.animation = 'none'; el.style.opacity = '0'; });
    void slide.offsetWidth; 
    if (this && this._archetypeRevealTimer) clearTimeout(this._archetypeRevealTimer);
    const timeoutFn = () => {
      revealEls.forEach(el => { el.style.opacity = ''; el.style.animation = ''; });
    };
    if (this) this._archetypeRevealTimer = setTimeout(timeoutFn, 1000);
    else setTimeout(timeoutFn, 1000);
  }
}

export function _fireWrappedConfetti(slide) {
  const host = slide.querySelector('.wrapped-gold-frame') || slide.querySelector('.wrapped-content') || slide;
  const layer = document.createElement('div');
  layer.style.cssText = 'position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:6;';
  const colors = ['#f0c046','#e8b830','#f7d774','#fff4d6','#6ea8ff','#5fd39a','#ff7a86'];
  const N = 64;

  for (let i = 0; i < N; i++) {
    const bit = document.createElement('span');
    const size = 6 + Math.random() * 7;
    const left = 50 + (Math.random() * 60 - 30);
    const dx = (Math.random() * 2 - 1) * 220;
    const dy = -(120 + Math.random() * 260);
    const rot = (Math.random() * 720 - 360) + 'deg';
    const delay = Math.random() * 0.25;

    bit.style.cssText = `position:absolute;top:42%;left:${left}%;width:${size}px;height:${size*0.6}px;background:${colors[i%colors.length]};border-radius:1px;opacity:0;transform:translate(0,0) rotate(0);will-change:transform,opacity;`;
    bit.style.setProperty('--dx', dx + 'px');
    bit.style.setProperty('--dy', dy + 'px');
    bit.style.setProperty('--rot', rot);
    bit.style.animation = `wrappedConfettiBurst 1.9s cubic-bezier(0.15,0.6,0.4,1) ${delay}s forwards`;
    layer.appendChild(bit);
  }

  host.appendChild(layer);
  setTimeout(() => layer.remove(), 2600);
}

export function downloadWrappedImage() {
  const d = this._wrappedData;
  if (!d) return;
  const canvas = document.createElement('canvas');
  canvas.width = 800; canvas.height = 800;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#3d2b1f';
  ctx.fillRect(0, 0, 800, 800);
  ctx.fillStyle = '#f0e8dc';
  ctx.font = '700 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${d.year} Reading Wrapped`, 400, 300);
  ctx.fillText(`${d.totalBooks} Books · ${fmtWords(d.totalWords)} Words`, 400, 400);

  canvas.toBlob(blob => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `note-to-shelf-${d.year}-wrapped.png`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (a.parentNode) a.parentNode.removeChild(a);
      URL.revokeObjectURL(url);
    }, 2000);
  }, 'image/png');
}

export function shareWrappedText() {
  const d = this._wrappedData;
  if (!d) return;
  const text = `📚 My ${d.year} Reading Year: ${d.totalBooks} books, ${fmtWords(d.totalWords)} words. Built with ShelfLife.`;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => this.showToast('Summary copied to clipboard!'));
  }
}

export function quickShareWrapped() {
  const d = this._wrappedData;
  if (!d) { this.openShareMenu('wrapped', { fullWatermark: true }); return; }
  const chips = [d.totalBooks + ' books · ' + fmtWords(d.totalWords) + ' words'];
  if (d.fav && d.fav.title) chips.unshift('Book of the Year: ' + d.fav.title);
  this.openShareMenu('wrapped', { chips: chips, fullWatermark: true });
}

export function openWrappedShare() {
  this.openModal('wrappedShareModal');
}

export function toggleWrappedChip(i) {
  // Toggle highlighted chip in share modal
}

export function _updateWrappedChipCount() {
  // Update counter in share modal
}

export function closeWrappedShareModal() {
  this.closeModal('wrappedShareModal');
}

export function confirmWrappedShare() {
  this.closeWrappedShareModal();
  this.openShareMenu('wrapped', { fullWatermark: true });
}

// ==========================================
// 5. Monthly Recap & Streaks
// ==========================================

export function _showRecapModal(dataUrl, title, monthName, monthYear) {
  let m = document.getElementById('recapModal');
  if (!m) {
    m = document.createElement('div');
    m.id = 'recapModal';
    m.className = 'modal-overlay';
    m.onclick = (e) => { if (e.target === m) this.closeModal('recapModal'); };
    m.innerHTML = `<div class="modal-card" style="max-width: 480px; padding: 24px; text-align: center; position: relative; background: var(--paper, #fdfbf7) !important; color: var(--wood-dark, #2a1a10) !important;">
      <h2 id="recapModalTitle" style="margin-top: 0; color: var(--wood-dark, #2a1a10) !important;"></h2>
      <img id="recapModalImg" src="" alt="Monthly Recap" style="width: 100%; border-radius: 8px; margin-bottom: 24px; box-shadow: 0 8px 24px rgba(0,0,0,0.2);" />
      <button onclick="App.downloadRecapImage()" style="width:100%; padding: 14px; background: var(--highlight); color: var(--wood-dark); border:none; border-radius: 8px; font-weight: bold; font-size: 16px; cursor: pointer;">
        Download Image
      </button>
      <button class="modal-close" onclick="App.closeModal('recapModal')" style="position: absolute; right: 16px; top: 16px; background: none; border: none; font-size: 24px; cursor: pointer; color: var(--wood-dark); z-index: 10;">&times;</button>
    </div>`;
    document.body.appendChild(m);
  }
  const titleEl = document.getElementById('recapModalTitle');
  const imgEl = document.getElementById('recapModalImg');
  const matrixEl = document.getElementById('recapMonthMatrix');
  if (titleEl) titleEl.textContent = title;
  if (imgEl) imgEl.src = dataUrl;
  if (matrixEl) {
    const yr = monthYear || this.currentYear || new Date().getFullYear();
    matrixEl.innerHTML = ALL_MONTHS.map(m => {
      const isAct = (m === monthName);
      const bg = isAct ? 'var(--highlight, #d4af37)' : 'rgba(61,43,31,0.06)';
      const col = isAct ? 'var(--wood-dark, #2C2C2C)' : 'var(--wood-mid, #5c3d2a)';
      const fw = isAct ? '700' : '500';
      return `<button type="button" onclick="App.openMonthlyRecap('${m}', ${yr})" style="padding:6px 4px;font-size:11px;font-family:'DM Mono',monospace;border:none;border-radius:6px;background:${bg};color:${col};font-weight:${fw};cursor:pointer;transition:all 0.15s ease;">${m.slice(0,3)}</button>`;
    }).join('');
  }
  this.openModal('recapModal');
}

export function downloadRecapImage() {
  const img = document.getElementById('recapModalImg');
  if (!img || !img.src) return;
  const a = document.createElement('a');
  a.href = img.src;
  a.download = 'Note_to_Shelf_Monthly_Recap.png';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => document.body.removeChild(a), 100);
}

export const openYearInReview = openWrapped;

export async function openMonthlyRecap(requestedMonth, requestedYear) {
  try {
    const now = new Date();
    let monthName;
    if (typeof requestedMonth === 'number') {
      monthName = ALL_MONTHS[requestedMonth] || ALL_MONTHS[now.getMonth()];
    } else if (typeof requestedMonth === 'string' && requestedMonth) {
      monthName = requestedMonth;
    } else {
      const currentCalYear = now.getFullYear();
      const targetYear = requestedYear || this.currentYear || currentCalYear;
      if (Number(targetYear) === currentCalYear) {
        monthName = ALL_MONTHS[now.getMonth()];
      } else {
        const booksThisYear = (this.books || []).filter(b => !b.currentlyReading && b.status !== 'to-read');
        const monthsWith = [...new Set(booksThisYear.map(b => b.month).filter(Boolean))];
        monthName = monthsWith.length
          ? ALL_MONTHS.slice().reverse().find(m => monthsWith.includes(m))
          : ALL_MONTHS[now.getMonth()];
      }
    }
    let monthYear = requestedYear || this.currentYear || now.getFullYear();

    const books = (this.books || []).filter(b => !b.currentlyReading && b.status !== 'to-read');
    const monthBooks = books.filter(b => b.month === monthName);

    const W = 1080, H = 600;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    
    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#2a1a10');
    grad.addColorStop(1, '#1a0e08');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Decorative arc
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(W - 120, 120, 260, 0, Math.PI * 2);
    ctx.stroke();

    // Month & Year header
    const recapHeader = (this.isReadOnly && this.ownerDisplayName) ? `${this.ownerDisplayName.toUpperCase()}'S ` : '';
    ctx.font = '700 24px "DM Mono", monospace';
    ctx.fillStyle = 'rgba(240,210,140,0.85)';
    ctx.fillText(`${recapHeader}${monthName.toUpperCase()} ${monthYear}`, 72, 86);

    // Big book count
    ctx.font = '800 120px "Playfair Display", Georgia, serif';
    ctx.fillStyle = '#f5e6c8';
    ctx.fillText(String(monthBooks.length), 72, 210);

    ctx.font = '400 28px "Playfair Display", Georgia, serif';
    ctx.fillStyle = 'rgba(240,210,140,0.8)';
    ctx.fillText(monthBooks.length === 1 ? 'book read' : 'books read', 72, 255);

    // Total words stats
    const totalWords = monthBooks.reduce((s, b) => s + (b.words || 0), 0);
    const wordsFmt = totalWords >= 1000000 ? (totalWords / 1000000).toFixed(2) + 'M' : Math.round(totalWords / 1000) + 'k';

    ctx.font = '600 18px "DM Mono", monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(`✍️ ${wordsFmt} words read`, 72, 310);

    // Top genre & mood if books exist
    if (monthBooks.length > 0) {
      const genres = {};
      monthBooks.forEach(b => { if (b.genre) genres[b.genre] = (genres[b.genre] || 0) + 1; });
      const topGenre = Object.entries(genres).sort((a,b)=>b[1]-a[1])[0];

      if (topGenre) {
        ctx.font = '500 16px "DM Mono", monospace';
        ctx.fillStyle = 'rgba(240,210,140,0.7)';
        ctx.fillText(`Top Genre: ${topGenre[0]} (${topGenre[1]})`, 72, 355);
      }

      // Featured book
      const loved = monthBooks.find(b => b.sentiment === 'love') || monthBooks[0];
      if (loved) {
        ctx.font = 'italic 700 22px "Playfair Display", Georgia, serif';
        ctx.fillStyle = '#f5e6c8';
        const titleStr = loved.title ? `"${loved.title.slice(0, 45)}${loved.title.length > 45 ? '...' : ''}"` : '';
        ctx.fillText(`Featured: ${titleStr}`, 72, 420);
        ctx.font = '400 16px "DM Mono", monospace';
        ctx.fillStyle = 'rgba(240,210,140,0.7)';
        ctx.fillText(`by ${loved.author || 'Unknown'}`, 72, 450);
      }
    } else {
      ctx.font = 'italic 400 20px "Playfair Display", Georgia, serif';
      ctx.fillStyle = 'rgba(240,210,140,0.65)';
      const zeroNote = (this.isReadOnly && this.ownerDisplayName)
        ? `No books logged for ${monthName} on this shelf.`
        : `No books logged for ${monthName} yet.`;
      ctx.fillText(zeroNote, 72, 380);
    }

    // Branding watermark
    ctx.font = '700 16px "DM Mono", monospace';
    ctx.fillStyle = 'rgba(240,210,140,0.5)';
    ctx.fillText('dinomike.ca/shelflife', 72, 540);

    const dataUrl = canvas.toDataURL('image/png');
    const modalTitle = (this.isReadOnly && this.ownerDisplayName) ? `${this.ownerDisplayName}'s ${monthName} ${monthYear} Recap` : `${monthName} ${monthYear}`;
    this._showRecapModal(dataUrl, modalTitle, monthName, monthYear);
  } catch (err) {
    console.warn('openMonthlyRecap error:', err);
    this.showToast('Recap Error: ' + err.message);
  }
}

export async function _generateClubRecap(clubName) {
  this.showToast(`Generating recap for ${clubName}...`);
}

export async function _computeAllTimeStreak() {
  try {
    const allBooks = await DB.getAllUserBooks(this.userId);
    if (!allBooks || !allBooks.length) return;

    const monthSet = new Set();
    allBooks.forEach(b => {
      if (b.month_finished && b.year) {
        const mi = ALL_MONTHS.indexOf(b.month_finished);
        if (mi >= 0) monthSet.add(b.year * 12 + mi);
      }
    });

    const sorted = Array.from(monthSet).sort((a, b) => b - a);
    let streak = 0;
    if (sorted.length) {
      const now = new Date();
      let cur = now.getFullYear() * 12 + now.getMonth();
      for (const m of sorted) {
        if (m === cur || m === cur - 1) { streak++; cur = m; }
        else break;
      }
    }

    this._allTimeStreak = streak;
    const el = document.getElementById('phAllTimeStreak');
    if (el) el.textContent = streak;
  } catch (e) { console.warn('_computeAllTimeStreak:', e); }
}

export function _showStreakNudge(streak, days) {
  if (localStorage.getItem('sl_streak_nudge_dismissed') === 'true') return;
  const existing = document.getElementById('streakNudgeBanner');
  if (existing) return;

  const banner = document.createElement('div');
  banner.id = 'streakNudgeBanner';
  banner.style.cssText = 'position:fixed;bottom:calc(env(safe-area-inset-bottom,0px) + 88px);left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#1c3f78,#1e5c3a);color:#f0e8dc;padding:12px 20px;border-radius:10px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:13px;z-index:20000 !important;box-shadow:0 8px 24px rgba(0,0,0,0.5);display:flex;align-items:center;gap:12px;max-width:340px;';
  banner.innerHTML = `<span style="font-size:20px">🔥</span><div><div style="font-weight:700;margin-bottom:2px">Your ${streak}-month streak is waiting</div><div style="font-size:11px;opacity:0.8">You haven't finished a book in ${days} days - what are you reading?</div></div><button onclick="localStorage.setItem('sl_streak_nudge_dismissed','true');document.getElementById('streakNudgeBanner')?.remove()" style="background:rgba(240,232,220,0.2);border:none;color:#f0e8dc;padding:6px 10px;border-radius:6px;cursor:pointer;font-size:11px;white-space:nowrap">Got it</button>`;
  document.body.appendChild(banner);
}

// ==========================================
// 6. Social Sharing & Image Export
// ==========================================

export function shareShelf() {
  if (!this.books || !this.books.length) { this.showToast('No books to share!'); return; }
  this.openShareMenu('shelf');
}

export function shareDisplayName() {
  return (this.ownerDisplayName || this.displayName || '').trim();
}

export function openShareMenu(context, highlights) {
  if (typeof this.closeFabMenu === 'function') this.closeFabMenu();
  this._shareContext = context || 'shelf';
  this._shareHighlights = highlights || null;

  const books = this._shareBooks ? this._shareBooks() : (this.books || []);
  if (!books.length && context !== 'wrapped' && !highlights) {
    if (typeof this.showToast === 'function') this.showToast('No books to share yet!');
    return;
  }

  let drawer = document.getElementById('shareDrawer');
  let overlay = document.getElementById('shareDrawerOverlay');

  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'shareDrawerOverlay';
    overlay.className = 'share-drawer-overlay modal-overlay';
    document.body.appendChild(overlay);
  }
  overlay.classList.add('open');
  overlay.style.display = 'block';
  overlay.onclick = () => this.closeShareMenu();

  if (!drawer) {
    drawer = document.createElement('div');
    drawer.id = 'shareDrawer';
    drawer.className = 'share-drawer premium-drawer';
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-modal', 'true');
    drawer.setAttribute('aria-labelledby', 'shareDrawerTitle');
    document.body.appendChild(drawer);
  }

  const isWrapped = this._shareContext === 'wrapped';
  const titleEl = document.getElementById('shareDrawerTitle');
  if (titleEl) {
    titleEl.textContent = isWrapped ? 'Share your ' + (this._wrappedYear || '') + ' Wrapped' : 'Share your Shelf';
  }
  const subEl = document.getElementById('shareDrawerSub');
  if (subEl) {
    const yr = (this._shareContext === 'wrapped' && this._wrappedYear) ? this._wrappedYear : (this.currentYear || new Date().getFullYear());
    const totalWords = books.reduce((s, b) => s + (b.words || 0), 0);
    const wordsStr = totalWords >= 1000000 ? (totalWords / 1000000).toFixed(1) + 'M' : Math.round(totalWords / 1000) + 'k';
    subEl.textContent = `${books.length} books · ${wordsStr} words · ${yr} Reading Year`;
  }

  drawer.classList.add('open');
  drawer.style.display = 'block';
  drawer.setAttribute('aria-hidden', 'false');

  if (this._shareEscHandler) document.removeEventListener('keydown', this._shareEscHandler);
  document.addEventListener('keydown', this._shareEscHandler = (e) => { if (e.key === 'Escape') this.closeShareMenu(); });

  if (typeof DB !== 'undefined' && DB && typeof DB.trackEvent === 'function') {
    DB.trackEvent('share_menu_opened', { context: this._shareContext });
  }
}

export function closeShareMenu() {
  const drawer = document.getElementById('shareDrawer');
  const overlay = document.getElementById('shareDrawerOverlay');
  if (drawer) {
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    drawer.style.display = 'none';
  }
  if (overlay) {
    overlay.classList.remove('open');
    overlay.style.display = 'none';
  }
  if (this._shareEscHandler) {
    document.removeEventListener('keydown', this._shareEscHandler);
    this._shareEscHandler = null;
  }
}

export function closeShareDrawer() {
  this.closeShareMenu();
}

export function sortBooksChronological(list) {
  if (!Array.isArray(list)) return [];
  const copy = list.slice();
  const MONTH_MAP = {
    january: 0, jan: 0,
    february: 1, feb: 1,
    march: 2, mar: 2,
    april: 3, apr: 3,
    may: 4,
    june: 5, jun: 5,
    july: 6, jul: 6,
    august: 7, aug: 7,
    september: 8, sep: 8, sept: 8,
    october: 9, oct: 9,
    november: 10, nov: 10,
    december: 11, dec: 11,
    q1: 0, q2: 3, q3: 6, q4: 9
  };

  const getBookReadYearNum = (b) => {
    if (!b) return 0;
    const explicit = b.readYear ?? b.read_year ?? b._shelfYear ?? b.originalReadYear ?? b.original_read_year;
    if (explicit !== undefined && explicit !== null && explicit !== '') {
      const y = parseInt(explicit, 10);
      if (!isNaN(y) && y >= 1900 && y <= 2100) return y;
    }
    const d = b.dateFinished || b.date_finished || b.dateStarted || b.date_started || b.date;
    if (d) {
      const match = String(d).match(/\b(19\d\d|20\d\d)\b/);
      if (match) return parseInt(match[1], 10);
    }
    return 0;
  };

  const getBookMonthIdx = (b) => {
    if (!b) return 99;
    const m = String(b.month || b.month_finished || '').trim().toLowerCase();
    if (MONTH_MAP.hasOwnProperty(m)) return MONTH_MAP[m];
    const d = String(b.dateFinished || b.date_finished || b.dateStarted || b.date_started || b.date || '');
    if (d) {
      for (const [name, idx] of Object.entries(MONTH_MAP)) {
        if (name.length > 2 && new RegExp('\\b' + name + '\\b', 'i').test(d)) return idx;
      }
      const isoMatch = d.match(/\b\d{4}-(\d{2})\b/);
      if (isoMatch) {
        const idx = parseInt(isoMatch[1], 10) - 1;
        if (idx >= 0 && idx < 12) return idx;
      }
    }
    return 99;
  };

  return copy.sort((a, b) => {
    // 1. Reading Year comparison (explicit readYear or dateFinished year; NEVER publication year b.year)
    const yA = getBookReadYearNum(a);
    const yB = getBookReadYearNum(b);
    if (yA && yB && yA !== yB) return yA - yB;

    // 2. Month comparison (January -> December)
    const mIdxA = getBookMonthIdx(a);
    const mIdxB = getBookMonthIdx(b);
    if (mIdxA !== mIdxB) return mIdxA - mIdxB;

    // 3. Specific finish or start date if available (e.g. YYYY-MM-DD)
    const dFA = a.dateFinished || a.date_finished || a.dateStarted || a.date_started || '';
    const dFB = b.dateFinished || b.date_finished || b.dateStarted || b.date_started || '';
    if (dFA && dFB && dFA !== dFB) return String(dFA).localeCompare(String(dFB));

    // 4. Shelf manual drag/drop order within the month
    const sA = (a.sortOrder !== undefined ? a.sortOrder : (a.sort_order !== undefined ? a.sort_order : 0));
    const sB = (b.sortOrder !== undefined ? b.sortOrder : (b.sort_order !== undefined ? b.sort_order : 0));
    if (sA !== sB) return sA - sB;

    // 5. Title alphabetical fallback
    return String(a.title || '').localeCompare(String(b.title || ''));
  });
}

export function _shareBooks() {
  const books = (this.books || []).filter(b => b && !b.currentlyReading && !b.currently_reading && b.status !== 'to-read' && b.status !== 'reading');
  return sortBooksChronological(books);
}

export function _sharePayload() {
  const books = this._shareBooks ? this._shareBooks() : sortBooksChronological(this.books || []);
  const year = (this._shareContext === 'wrapped' && this._wrappedYear) ? this._wrappedYear : (this.currentYear || new Date().getFullYear());
  const totalBooks = books.length;
  const totalWords = books.reduce((s, b) => s + (b.words || 0), 0);
  const sentCounts = { love: 0, like: 0, mixed: 0, dislike: 0 };
  books.forEach(b => { if (sentCounts.hasOwnProperty(b.sentiment)) sentCounts[b.sentiment]++; });
  const name = this.shareDisplayName ? this.shareDisplayName() : '';
  const title = (name ? name + "’s " + year + ' Reading' : 'My ' + year + ' Reading');
  const crowned = books.find(b => b.bookOfYear && Number(b.bookOfYear) === Number(year));
  return { books, year, totalBooks, totalWords, sentCounts, title, highlights: this._shareHighlights, crownedId: crowned?.id || null };
}

export function _shareLink() {
  if (this.currentShelf && this.currentShelf.id) {
    const base = window.location.origin + window.location.pathname;
    const cleanBase = base.endsWith('/') ? base : base + '/';
    return `${cleanBase}?shelf=${this.currentShelf.id}#shelf/${this.currentShelf.id}`;
  }
  return window.location.href;
}

export function copyShareLink() {
  const url = this._shareLink();
  if (typeof DB !== 'undefined' && DB && typeof DB.trackEvent === 'function') {
    DB.trackEvent('share_link_copied', {});
  }
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => this.showToast('Share link copied!')).catch(() => prompt('Copy this link:', url));
  }
}

export function _roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function _drawCanvasCrown(ctx, cx, baseY, S) {
  const s = S / 24;
  const ox = cx - 12 * s, oy = baseY - 21.2 * s;
  const P = (px, py) => [ox + px * s, oy + py * s];
  ctx.save();
  const g = ctx.createLinearGradient(0, oy, 0, oy + 21.2 * s);
  g.addColorStop(0, '#fff0b8');
  g.addColorStop(0.45, '#f5c542');
  g.addColorStop(1, '#d08f12');
  ctx.shadowColor = 'rgba(180,130,10,0.7)';
  ctx.shadowBlur = Math.max(4, 6 * s);
  ctx.fillStyle = g;
  ctx.strokeStyle = '#a06c08';
  ctx.lineWidth = Math.max(0.9, 0.8 * s);
  ctx.lineJoin = 'round';
  ctx.beginPath();
  let pt = P(4.4, 18.6);
  ctx.moveTo(pt[0], pt[1]);
  [[2.7, 8.2], [8, 13], [12, 4.8], [16, 13], [21.3, 8.2], [19.6, 18.6]].forEach(c => {
    const q = P(c[0], c[1]);
    ctx.lineTo(q[0], q[1]);
  });
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.stroke();

  const b0 = P(4.4, 18.4);
  ctx.beginPath();
  this._roundRectPath(ctx, b0[0], b0[1], 15.2 * s, 2.8 * s, Math.max(0.6, 0.8 * s));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.stroke();

  const jew = (jx, jy, jr, fill) => {
    const c = P(jx, jy);
    ctx.beginPath();
    ctx.arc(c[0], c[1], jr * s, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = '#a06c08';
    ctx.lineWidth = Math.max(0.5, 0.5 * s);
    ctx.stroke();
  };
  jew(2.9, 8, 1.5, '#fff6d6');
  jew(12, 4.6, 1.7, '#ff6470');
  jew(21.1, 8, 1.5, '#fff6d6');
  ctx.restore();
}

export function _shade(hex, factor) {
  if (!hex) return 'rgb(140,122,100)';
  if (typeof hex === 'string' && hex.startsWith('rgb')) return hex;
  hex = String(hex).replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  let r = parseInt(hex.substr(0, 2), 16) || 0,
      g = parseInt(hex.substr(2, 2), 16) || 0,
      b = parseInt(hex.substr(4, 2), 16) || 0;
  r = Math.min(255, Math.max(0, Math.round(r * factor)));
  g = Math.min(255, Math.max(0, Math.round(g * factor)));
  b = Math.min(255, Math.max(0, Math.round(b * factor)));
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

export function _drawShareShelf(ctx, books, x, y, w, h, crownedId) {
  books = sortBooksChronological(books || []);
  const n = books.length;
  // Dynamic rows based on available shelf height and book count
  let rows;
  if (h >= 1000) {
    rows = n <= 14 ? 1 : n <= 28 ? 2 : n <= 48 ? 3 : n <= 75 ? 4 : 5;
  } else if (h >= 650) {
    rows = n <= 14 ? 1 : n <= 28 ? 2 : n <= 48 ? 3 : 4;
  } else {
    rows = n <= 14 ? 1 : n <= 28 ? 2 : 3;
  }
  const perRow = Math.max(1, Math.ceil(n / Math.max(1, rows)));
  const PLANK = 26;
  const rowH = h / Math.max(1, rows);
  const bookAreaH = rowH - PLANK;
  const maxDays = Math.max(...books.map(b => b.days || 5), 1);
  const maxWords = Math.max(...books.map(b => b.words || 1), 1);
  const minWords = Math.min(...books.map(b => b.words || 1), 1);
  const SVARSlocal = (typeof SVARS !== 'undefined') ? SVARS : null;
  const col = (s, i) => (SVARSlocal && SVARSlocal[s]) ? SVARSlocal[s][i % 7] : '#8c7a64';

  const hi = new Set();
  const loved = books.map((b, idx) => ({ b, idx })).filter(o => o.b.sentiment === 'love');
  loved.sort((a, b) => ((b.b.review ? 1 : 0) - (a.b.review ? 1 : 0)) || ((b.b.words || 0) - (a.b.words || 0)));
  loved.slice(0, 4).forEach(o => hi.add(o.idx));

  const crownedIdx = crownedId ? books.findIndex(b => b.id === crownedId) : -1;

  let fastIdx = -1, marathonIdx = -1, epicIdx = -1;
  if (n >= 5) {
    let minD = Infinity, maxD = -1, maxW = -1;
    books.forEach((b, idx) => {
      const dd = b.days || 0, ww = b.words || 0;
      if (dd > 0 && dd < minD) { minD = dd; fastIdx = idx; }
      if (dd > maxD) { maxD = dd; marathonIdx = idx; }
      if (ww > maxW) { maxW = ww; epicIdx = idx; }
    });
    if (!(minD <= 3)) fastIdx = -1;
    if (!(maxD >= 30)) marathonIdx = -1;
    if (!(epicIdx >= 0 && (books[epicIdx].words || 0) >= 150000)) epicIdx = -1;
  }
  const _badgeDrawn = { fast: false, marathon: false, epic: false };

  const drawSpineIcon = (emoji, cx, cy, size) => {
    const r = size * 0.62;
    ctx.save();
    ctx.globalAlpha = 1.0;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.shadowColor = 'rgba(0,0,0,0.28)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 1;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.font = size + "px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, cx, cy + size * 0.04);
    ctx.restore();
  };

  for (let r = 0; r < rows; r++) {
    const rowBooks = books.slice(r * perRow, (r + 1) * perRow);
    const ry = y + r * rowH;
    const plankY = ry + rowH - PLANK;

    /* shelf back panel */
    const backGrad = ctx.createLinearGradient(0, ry, 0, plankY);
    backGrad.addColorStop(0, '#e9ddcb');
    backGrad.addColorStop(1, '#d8c9b0');
    ctx.fillStyle = backGrad;
    ctx.fillRect(x, ry, w, rowH - PLANK);

    if (!rowBooks.length) {
      /* empty shelf plank */
      const pg = ctx.createLinearGradient(0, plankY, 0, plankY + PLANK);
      pg.addColorStop(0, '#c49a6c');
      pg.addColorStop(0.5, '#8b6343');
      pg.addColorStop(1, '#3d2b1f');
      ctx.fillStyle = pg;
      ctx.fillRect(x - 6, plankY, w + 12, PLANK);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(x - 6, plankY, w + 12, 2);
      continue;
    }

    /* compute spine widths ~ words, guaranteed to fit within w without bleeding or overstretching */
    const M = rowBooks.length;
    const raw = rowBooks.map(b => {
      const t = Math.max(0, Math.min(1, ((b.words || 1) - minWords) / Math.max(1, maxWords - minWords)));
      return 24 + t * 44; // [24..68]
    });
    const naturalSum = raw.reduce((a, c) => a + c, 0);
    const naturalGap = M > 25 ? 2 : (M > 16 ? 3 : 5);
    const naturalTotal = naturalSum + naturalGap * (M - 1);

    let swList = [];
    let effGap = naturalGap;

    if (naturalTotal <= w) {
      // Books fit naturally. Scale gently for small book counts, capped at max 95px so spines look authentic
      const scale = Math.min(1.4, w / Math.max(1, naturalTotal));
      swList = raw.map(v => Math.min(95, Math.round(v * scale)));
      effGap = naturalGap;
      const actualSum = swList.reduce((a, c) => a + c, 0) + effGap * (M - 1);
      if (actualSum > w) {
        const factor = (w - effGap * (M - 1)) / swList.reduce((a, c) => a + c, 0);
        swList = swList.map(v => Math.max(10, Math.floor(v * factor)));
      }
    } else {
      // High volume: compression pass with strict boundary guarantees
      const minSw = Math.max(8, Math.min(13, Math.floor((w - (M - 1) * 2) / M)));
      effGap = Math.max(2, Math.min(naturalGap, Math.floor((w - M * minSw) / Math.max(1, M - 1))));
      const avail = w - effGap * (M - 1);
      const rawScale = avail / naturalSum;
      swList = raw.map(v => Math.max(minSw, v * rawScale));
      const curSum = swList.reduce((a, c) => a + c, 0);
      const norm = avail / curSum;
      swList = swList.map(v => Math.floor(v * norm));
      const remainder = avail - swList.reduce((a, c) => a + c, 0);
      if (remainder > 0 && swList.length) {
        swList[swList.length - 1] += remainder;
      }
    }

    let bx = x;

    rowBooks.forEach((b, i) => {
      const gi = r * perRow + i;
      const sw = swList[i] || 14;
      const t = Math.sqrt((b.days || 5)) / Math.sqrt(maxDays);
      const sh = Math.round(bookAreaH * (0.5 + 0.5 * Math.min(1, t)));
      const sy = plankY - sh;
      const c = col(b.sentiment || 'mixed', gi);
      const g = ctx.createLinearGradient(bx, 0, bx + sw, 0);
      g.addColorStop(0, this._shade(c, 1.16));
      g.addColorStop(0.5, c);
      g.addColorStop(1, this._shade(c, 0.82));
      ctx.fillStyle = g;
      this._roundRectPath(ctx, bx, sy, sw, sh, 2);
      ctx.fill();

      /* top band */
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      ctx.fillRect(bx, sy, sw, Math.min(8, sh * 0.06));

      /* vertical title on spines (adaptive font size so every book has title) */
      if (sw >= 10 && sh >= 30) {
        ctx.save();
        ctx.translate(bx + sw / 2, sy + sh - Math.max(6, Math.min(14, Math.round(sh * 0.08))));
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = 'rgba(248,235,215,0.95)';
        ctx.shadowColor = 'rgba(0,0,0,0.45)';
        ctx.shadowBlur = 2;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 1;

        const canSplitLines = sw >= 36;
        const fs = canSplitLines
          ? Math.max(9, Math.min(16, Math.floor(sw * 0.28)))
          : Math.max(7, Math.min(15, Math.floor(sw * 0.44)));

        ctx.font = "700 " + fs + "px -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const maxTextW = Math.max(10, sh - 18);
        const full = (b.title || '').trim().toUpperCase() || 'UNTITLED';
        const fit = (str) => {
          let t = str;
          while (ctx.measureText(t).width > maxTextW && t.length > 1) t = t.slice(0, -1);
          if (t !== str) t = t.slice(0, -1) + '…';
          return t;
        };
        let lines;
        if (!canSplitLines || ctx.measureText(full).width <= maxTextW) {
          lines = [fit(full)];
        } else {
          const words = full.split(' ');
          if (words.length > 1) {
            let l1 = '', wi = 0;
            for (; wi < words.length; wi++) {
              const test = l1 ? l1 + ' ' + words[wi] : words[wi];
              if (ctx.measureText(test).width > maxTextW && l1) break;
              l1 = test;
            }
            const l2 = words.slice(wi).join(' ');
            lines = [fit(l1), fit(l2 || '')].filter(s => s);
          } else {
            lines = [fit(full)];
          }
        }
        const lineGap = fs + 3;
        const startOff = -((lines.length - 1) * lineGap) / 2;
        lines.forEach((ln, li) => {
          ctx.fillText(ln, 0, startOff + li * lineGap);
        });
        ctx.textBaseline = 'alphabetic';
        ctx.restore();
      }

      /* achievement icons sit ABOVE the spine, strictly clamped within shelf bounds */
      const _iconSize = Math.min(28, Math.max(15, Math.min(sw * 1.05, rowH * 0.22)));
      const _iconR = _iconSize * 0.62;
      const _cx = Math.max(x + _iconR + 2, Math.min(x + w - _iconR - 2, bx + sw / 2));
      const _icons = [];

      let _badge = '';
      if (gi === fastIdx) { _badge = '🐇'; _badgeDrawn.fast = true; }
      else if (gi === marathonIdx) { _badge = '🐢'; _badgeDrawn.marathon = true; }
      else if (gi === epicIdx) { _badge = '📚'; _badgeDrawn.epic = true; }
      if (_badge) _icons.push(_badge);
      if (gi === crownedIdx) _icons.push('👑');

      const _stackGap = 4;
      const _minCy = ry + _iconR + 2;
      for (let k = 0; k < _icons.length; k++) {
        let cy = sy - _iconR - k * (_iconR * 2 + _stackGap);
        if (cy < _minCy) cy = _minCy + k * (_iconR * 2 + _stackGap);
        drawSpineIcon(_icons[k], _cx, cy, _iconSize);
      }

      bx += sw + effGap;
    });

    /* plank */
    const pg = ctx.createLinearGradient(0, plankY, 0, plankY + PLANK);
    pg.addColorStop(0, '#c49a6c');
    pg.addColorStop(0.5, '#8b6343');
    pg.addColorStop(1, '#3d2b1f');
    ctx.fillStyle = pg;
    ctx.fillRect(x - 6, plankY, w + 12, PLANK);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(x - 6, plankY, w + 12, 2);
  }

  this._shareIcons = [];
  if (crownedIdx >= 0) this._shareIcons.push(['👑', 'Book of the Year']);
  if (_badgeDrawn.fast) this._shareIcons.push(['🐇', 'Fastest read · ≤3 days']);
  if (_badgeDrawn.marathon) this._shareIcons.push(['🐢', 'Marathon · ≥30 days']);
  if (_badgeDrawn.epic) this._shareIcons.push(['📚', 'Epic · ≥150k words']);
}

export async function _renderShareCanvas(format) {
  const p = (typeof this._sharePayload === 'function') ? this._sharePayload() : { books: [], totalBooks: 0, totalWords: 0, sentCounts: {}, title: 'My Reading', year: this.currentYear || new Date().getFullYear() };
  const W = 1080;
  const H = format === 'square' ? 1160 : (format === 'landscape' ? 608 : 2040);
  // High-res 2K rendering (1440px wide) across all devices, ultra-crisp on iPhone Super Retina XDR & Android Dynamic AMOLED
  const SCALE = 1440 / 1080;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(W * SCALE);
  canvas.height = Math.round(H * SCALE);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  try {
    if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) await document.fonts.ready;
  } catch (e) {
    console.warn(e);
  }

  /* warm paper background */
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#f4ecdf');
  bg.addColorStop(0.55, '#efe5d4');
  bg.addColorStop(1, '#e7dac4');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  /* faint paper grain */
  ctx.fillStyle = 'rgba(61,43,31,0.018)';
  for (let i = 0; i < H; i += 3) {
    ctx.fillRect(0, i, W, 1);
  }

  const topH = Math.round(H * 0.155);
  const shelfTop = topH + 24;
  const bottomH = Math.round(H * 0.235);
  const shelfH = H - shelfTop - bottomH - 16;

  /* ---------- TOP : brand URL + name + year ---------- */
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(139,99,67,0.9)';
  ctx.font = "600 25px 'DM Mono', monospace";
  ctx.save();
  const _wmTop = 'dinomike.ca/shelflife';
  const _twL = ctx.measureText(_wmTop).width;
  ctx.fillText(_wmTop, W / 2, Math.round(topH * 0.30));

  /* thin underline flourish */
  ctx.strokeStyle = 'rgba(139,99,67,0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(W / 2 - _twL / 2, Math.round(topH * 0.30) + 10);
  ctx.lineTo(W / 2 + _twL / 2, Math.round(topH * 0.30) + 10);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = '#3d2b1f';
  let _nameFs = format === 'square' ? 60 : 74;
  ctx.font = "900 " + _nameFs + "px -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const parts = (p.title || '').split(' Reading');
  let namePart = parts[0] || 'My Reading';
  while (ctx.measureText(namePart).width > W - 120 && _nameFs > 24) {
    _nameFs -= 2;
    ctx.font = "900 " + _nameFs + "px -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  }
  if (ctx.measureText(namePart).width > W - 120) {
    while (ctx.measureText(namePart + '…').width > W - 120 && namePart.length > 3) {
      namePart = namePart.slice(0, -1);
    }
    namePart += '…';
  }
  ctx.fillText(namePart, W / 2, Math.round(topH * 0.62));

  ctx.fillStyle = 'rgba(61,43,31,0.55)';
  ctx.font = "italic 700 " + (format === 'square' ? 34 : 40) + "px -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  ctx.fillText('Reading', W / 2, Math.round(topH * 0.86));

  /* ---------- CENTER : bookshelf ---------- */
  this._drawShareShelf(ctx, p.books || [], 70, shelfTop, W - 140, shelfH, p.crownedId);

  /* ---------- BOTTOM : stats + sentiment legend + achievement key ---------- */
  const sq = format === 'square';
  const by = H - bottomH;
  ctx.beginPath();
  ctx.moveTo(120, by + 6);
  ctx.lineTo(W - 120, by + 6);
  ctx.strokeStyle = 'rgba(61,43,31,0.16)';
  ctx.lineWidth = 2;
  ctx.stroke();

  const wordsStr = fmtWords(p.totalWords);
  let statFs = sq ? 50 : 64;
  const statBaseline = by + (sq ? 64 : 92);
  ctx.fillStyle = '#3d2b1f';
  ctx.font = "900 " + statFs + "px -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const booksTxt = (p.totalBooks || 0) + ' books';
  const wordsTxt = wordsStr + ' words';
  ctx.textAlign = 'left';
  let bw = ctx.measureText(booksTxt).width;
  let wordsW = ctx.measureText(wordsTxt).width;
  let dotW = ctx.measureText('  ·  ').width;
  let totalW = bw + dotW + wordsW;
  while (totalW > W - 120 && statFs > 24) {
    statFs -= 2;
    ctx.font = "900 " + statFs + "px -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
    bw = ctx.measureText(booksTxt).width;
    wordsW = ctx.measureText(wordsTxt).width;
    dotW = ctx.measureText('  ·  ').width;
    totalW = bw + dotW + wordsW;
  }
  let sx = (W - totalW) / 2;
  ctx.fillStyle = '#3d2b1f';
  ctx.fillText(booksTxt, sx, statBaseline);
  sx += bw;
  ctx.fillStyle = 'rgba(61,43,31,0.4)';
  ctx.fillText('  ·  ', sx, statBaseline - 4);
  sx += dotW;
  ctx.fillStyle = '#3d2b1f';
  ctx.fillText(wordsTxt, sx, statBaseline);
  ctx.textAlign = 'center';

  const hasChips = p.highlights && p.highlights.chips && p.highlights.chips.length;
  const wmAlpha = p.highlights && p.highlights.fullWatermark ? 0.95 : 0.45;
  const legIcons = this._shareIcons || [];

  /* ---- bottom-anchored elements ---- */
  const wmY = H - (sq ? 38 : 48);
  const iconLegCy = legIcons.length ? wmY - (sq ? 44 : 54) : wmY;

  /* sentiment colour legend */
  const sentDefs = [['love', 'Loved', '#1c3f78'], ['like', 'Liked', '#1e5c3a'], ['mixed', 'Mixed', '#c89018'], ['dislike', 'Disliked', '#8c1a28']];
  const sentActive = sentDefs.filter(s => (p.sentCounts && p.sentCounts[s[0]]) > 0);
  const sentLegCy = (legIcons.length ? iconLegCy : wmY) - (sq ? 42 : 52);

  if (sentActive.length) {
    const swW = sq ? 30 : 38, swH = sq ? 16 : 20, swGap = sq ? 9 : 11;
    let itemGap = sq ? 26 : 34;
    let sFont = sq ? 22 : 27;
    const labelOf = s => s[1] + '  ' + (p.sentCounts[s[0]] || 0);
    const measureRow = (fpx, ig) => {
      ctx.font = "600 " + fpx + "px 'DM Mono', monospace";
      return sentActive.reduce((a, s) => a + swW + swGap + ctx.measureText(labelOf(s)).width, 0) + ig * (sentActive.length - 1);
    };
    let rowW = measureRow(sFont, itemGap);
    while (rowW > W - 80 && sFont > 14) {
      sFont -= 1;
      if (itemGap > 14) itemGap -= 2;
      rowW = measureRow(sFont, itemGap);
    }
    ctx.font = "600 " + sFont + "px 'DM Mono', monospace";
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    let lx = (W - rowW) / 2;
    sentActive.forEach(s => {
      ctx.fillStyle = s[2];
      this._roundRectPath(ctx, lx, sentLegCy - swH / 2, swW, swH, 4);
      ctx.fill();
      ctx.fillStyle = 'rgba(61,43,31,0.7)';
      ctx.fillText(labelOf(s), lx + swW + swGap, sentLegCy + 1);
      lx += swW + swGap + ctx.measureText(labelOf(s)).width + itemGap;
    });
    ctx.textBaseline = 'alphabetic';
  }

  /* middle band : wrapped chips OR a proportional mood bar */
  ctx.textAlign = 'center';
  const midTop = statBaseline + (sq ? 16 : 24);
  const midBottom = sentLegCy - (sq ? 26 : 34);

  if (hasChips) {
    ctx.font = "500 " + (sq ? 23 : 27) + "px 'DM Mono', monospace";
    const chipGap = sq ? 44 : 58;
    const maxChips = Math.max(1, Math.floor((midBottom - midTop) / chipGap));
    const chips = p.highlights.chips.slice(0, Math.min(4, maxChips));
    let chy = midTop + chipGap * 0.6;
    chips.forEach(txt => {
      let t = txt;
      while (ctx.measureText(t).width > W - 170 && t.length > 4) t = t.slice(0, -2);
      if (t !== txt) t = t.slice(0, -1) + '…';
      const tw = ctx.measureText(t).width + 56;
      const chx = (W - tw) / 2;
      ctx.fillStyle = 'rgba(61,43,31,0.07)';
      this._roundRectPath(ctx, chx, chy - 32, tw, 46, 23);
      ctx.fill();
      ctx.fillStyle = 'rgba(61,43,31,0.82)';
      ctx.textAlign = 'center';
      ctx.fillText(t, W / 2, chy);
      chy += chipGap;
    });
  } else {
    /* proportional mood bar */
    const totalForBar = p.totalBooks || 1;
    const barW = W - 280, barX = 140, barH = sq ? 18 : 22;
    const barY = Math.round((midTop + midBottom) / 2 - barH / 2);
    let curX = barX;
    ctx.save();
    this._roundRectPath(ctx, barX, barY, barW, barH, barH / 2);
    ctx.clip();
    ctx.fillStyle = 'rgba(61,43,31,0.06)';
    ctx.fillRect(barX, barY, barW, barH);
    sentActive.forEach(s => {
      const seg = barW * ((p.sentCounts[s[0]] || 0) / totalForBar);
      ctx.fillStyle = s[2];
      ctx.fillRect(curX, barY, Math.max(seg, 2), barH);
      curX += seg;
    });
    ctx.restore();
    this._roundRectPath(ctx, barX, barY, barW, barH, barH / 2);
    ctx.strokeStyle = 'rgba(61,43,31,0.12)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  /* single-row achievement icon key */
  if (legIcons.length) {
    const shortLbl = { '👑': 'Book of Year', '🐇': 'Fastest', '🐢': 'Marathon', '📚': 'Epic' };
    let colGap = sq ? 30 : 38;
    let fontPx = sq ? 20 : 23;
    const emFont = (px) => px + "px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',serif";
    const txFont = (px) => "500 " + px + "px 'DM Mono', monospace";
    const itemW = (it, px) => {
      ctx.font = emFont(px);
      const ew = ctx.measureText(it[0]).width;
      ctx.font = txFont(px);
      return ew + 7 + ctx.measureText(shortLbl[it[0]] || it[1]).width;
    };
    let widths = legIcons.map(it => itemW(it, fontPx));
    let rowW = widths.reduce((a, c) => a + c, 0) + colGap * (legIcons.length - 1);
    while (rowW > W - 70 && fontPx > 14) {
      fontPx -= 1;
      if (colGap > 14) colGap -= 2;
      widths = legIcons.map(it => itemW(it, fontPx));
      rowW = widths.reduce((a, c) => a + c, 0) + colGap * (legIcons.length - 1);
    }
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    let lx = (W - rowW) / 2;
    legIcons.forEach((it, ci) => {
      ctx.font = emFont(fontPx);
      ctx.fillStyle = 'rgba(61,43,31,0.85)';
      ctx.fillText(it[0], lx, iconLegCy);
      const ew = ctx.measureText(it[0]).width;
      ctx.font = txFont(fontPx);
      ctx.fillStyle = 'rgba(61,43,31,0.62)';
      ctx.fillText(shortLbl[it[0]] || it[1], lx + ew + 7, iconLegCy);
      lx += widths[ci] + colGap;
    });
    ctx.textBaseline = 'alphabetic';
  }

  /* watermark */
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(139,99,67,' + wmAlpha + ')';
  ctx.font = "600 " + (sq ? 24 : 26) + "px 'DM Mono', monospace";
  ctx.fillText((p.highlights && p.highlights.fullWatermark ? 'Track your reading  ·  ' : '') + 'dinomike.ca/shelflife', W / 2, wmY);

  return canvas;
}

export async function shareDownloadImage(format) {
  const p = (typeof this._sharePayload === 'function') ? this._sharePayload() : { year: this.currentYear || new Date().getFullYear(), totalBooks: 0, totalWords: 0 };
  const yr = p.year || new Date().getFullYear();
  const title = p.title || `My ${yr} Reading`;

  if (typeof this.showToast === 'function') {
    this.showToast('Generating high-res image…');
  } else if (typeof showToast === 'function') {
    showToast('Generating high-res image…');
  }
  const fmts = format === 'both' ? ['story', 'square'] : [format || 'story'];
  let sharedViaNativeSheet = false;

  for (const f of fmts) {
    const canvas = await this._renderShareCanvas(f);
    const filename = `note-to-shelf-${yr}-${f}.png`;

    await new Promise(res => {
      canvas.toBlob(async blob => {
        if (!blob) {
          console.error('Failed to create blob for format', f);
          res();
          return;
        }

        // 1. Check for Mobile Web Share API (iOS Safari & Android Chrome)
        const isMobile = (typeof window !== 'undefined') && (
          /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
          (window.innerWidth <= 768 && ('ontouchstart' in window || navigator.maxTouchPoints > 0))
        );

        if (isMobile && typeof navigator.share === 'function' && typeof File !== 'undefined') {
          try {
            const file = new File([blob], filename, { type: 'image/png' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
              await navigator.share({
                files: [file],
                title: title,
                text: `${title} · ${p.totalBooks || 0} books tracked on ShelfLife 📚`
              });
              sharedViaNativeSheet = true;
              if (typeof DB !== 'undefined' && DB && typeof DB.trackEvent === 'function') {
                DB.trackEvent('share_native_sheet', { format: f, context: this._shareContext });
              }
              res();
              return;
            }
          } catch (err) {
            // If user simply closed/cancelled the native share sheet, do not trigger forced secondary download
            if (err && (err.name === 'AbortError' || err.code === 20)) {
              sharedViaNativeSheet = true;
              res();
              return;
            }
            console.warn('Native mobile share error, falling back to download:', err);
          }
        }

        // 2. Direct browser download fallback (Desktop & non-sharing mobile browsers)
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          if (a.parentNode) a.parentNode.removeChild(a);
          URL.revokeObjectURL(url);
        }, 2500);
        res();
      }, 'image/png');
    });
  }

  if (typeof DB !== 'undefined' && DB && typeof DB.trackEvent === 'function') {
    DB.trackEvent('share_image_downloaded', { format: format, context: this._shareContext });
  }

  const doneMsg = sharedViaNativeSheet
    ? 'Share sheet opened!'
    : (format === 'both' ? 'Saved both images!' : 'Image saved!');

  if (typeof this.showToast === 'function') {
    this.showToast(doneMsg);
  } else if (typeof showToast === 'function') {
    showToast(doneMsg);
  }
}

export async function shareInstagramStories() {
  await this.shareDownloadImage('story');
  const msg = 'Image saved — open Instagram and add it to your Story!';
  if (typeof this.showToast === 'function') {
    this.showToast(msg, 'sticky');
  } else if (typeof showToast === 'function') {
    showToast(msg, 'sticky');
  }
  if (typeof DB !== 'undefined' && DB && typeof DB.trackEvent === 'function') {
    DB.trackEvent('share_platform', { platform: 'instagram', context: this._shareContext });
  }
}

export function shareToPlatform(platform) {
  const url = encodeURIComponent(this._shareLink());
  const p = (typeof this._sharePayload === 'function') ? this._sharePayload() : { year: this.currentYear || new Date().getFullYear(), totalBooks: 0, totalWords: 0 };
  const text = encodeURIComponent('My ' + p.year + ' reading year: ' + p.totalBooks + ' books, ' + fmtWords(p.totalWords) + ' words. Tracked with ShelfLife 📚');
  let target = '';
  if (platform === 'facebook') target = 'https://www.facebook.com/sharer/sharer.php?u=' + url;
  else if (platform === 'twitter') target = 'https://twitter.com/intent/tweet?text=' + text + '&url=' + url;
  else if (platform === 'linkedin') target = 'https://www.linkedin.com/sharing/share-offsite/?url=' + url;
  if (target) window.open(target, '_blank', 'noopener,width=640,height=640');
  if (typeof DB !== 'undefined' && DB && typeof DB.trackEvent === 'function') {
    DB.trackEvent('share_platform', { platform: platform, context: this._shareContext });
  }
}


export function renderLanguageBreakdown(BOOKS) {


 const tile = document.getElementById('langBreakdownTile');

 const el = document.getElementById('langBreakdown');

 if (!tile || !el) return;

 const counts = {};

 BOOKS.forEach(b => { const l = b.language || 'English'; counts[l] = (counts[l] || 0) + 1; });

 const langs = Object.keys(counts);

 // Only meaningful when the reader has more than one language.

 if (langs.length <= 1) { tile.style.display = 'none'; el.innerHTML = ''; return; }

 tile.style.display = '';

 const entries = langs.map(l => ({ lang: l, count: counts[l] })).sort((a,b) => b.count - a.count);

 const total = BOOKS.length;

 const max = entries[0].count;

 el.innerHTML = '<div style="display:flex;flex-direction:column;gap:10px;padding:6px 2px;">' + entries.map(e => {

 const pct = Math.round(e.count / total * 100);

 const w = Math.max(4, Math.round(e.count / max * 100));

 const flag = (LANGUAGE_FLAGS && LANGUAGE_FLAGS[e.lang]) || '🌐';

 return `<div style="display:flex;align-items:center;gap:10px;">

 <div style="width:120px;flex-shrink:0;font-size:12px;color:var(--wood-dark);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${flag} ${esc(e.lang)}</div>

 <div style="flex:1;background:rgba(61,43,31,0.07);border-radius:4px;height:18px;overflow:hidden;"><div style="width:${w}%;height:100%;background:linear-gradient(90deg,var(--wood-mid),var(--wood-dark));border-radius:4px;"></div></div>

 <div style="width:74px;flex-shrink:0;text-align:right;font-family:\'DM Mono\',monospace;font-size:10px;color:var(--wood-light);">${e.count} · ${pct}%</div>

 </div>`;

 }).join('') + '</div>';

 
}

export function renderScatter(BOOKS, dayDomain) {


  const W = 600, H = 300, PAD = { t: 28, r: 82, b: 48, l: 72 }, cW = W - PAD.l - PAD.r, cH = H - PAD.t - PAD.b;

  const dayVals = BOOKS.map(b => Number(b.days) || 0), wordVals = BOOKS.map(b => Number(b.words) || 0);
  const wMin = wordVals.length ? Math.min(...wordVals) : 0, wMax = wordVals.length ? Math.max(...wordVals) : 50000;
  const WORD_PAD = Math.max(6000, Math.round((wMax - wMin) * 0.08));
  const dMin = dayVals.length ? Math.min(...dayVals) : 0, dMax = dayVals.length ? Math.max(...dayVals) : 10;
  const DAY_PAD = 0.6;
  const DAY_MIN = Math.max(0, dMin - DAY_PAD), DAY_MAX = dMax + DAY_PAD;
  const WORD_MIN = Math.max(0, wMin - WORD_PAD), WORD_MAX = wMax + WORD_PAD;

  function px(d) {
    const range = Math.max(0.1, DAY_MAX - DAY_MIN);
    return PAD.l + ((Number(d) || 0) - DAY_MIN) / range * cW;
  }

  function py(w) {
    const range = Math.max(1, WORD_MAX - WORD_MIN);
    return PAD.t + cH - ((Number(w) || 0) - WORD_MIN) / range * cH;
  }

 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');

 svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.style.cssText='width:100%;height:auto;display:block;';svg.style.fontFamily="'DM Mono',monospace";

 const uniqueDays = [...new Set(dayVals)].sort((a,b)=>a-b);

 let dayTicks;

 if(uniqueDays.length <= 12) {

 dayTicks = uniqueDays;

 } else {

 dayTicks = [];

 const dayRange = DAY_MAX - DAY_MIN;

 const dayStep = dayRange <= 8 ? 1 : dayRange <= 18 ? 2 : dayRange <= 40 ? 5 : 10;

 for(let d = Math.ceil(dMin / dayStep) * dayStep; d <= dMax; d += dayStep) { dayTicks.push(d); }

 }

 dayTicks.forEach(d => {

 const x = px(d);

 const gl = document.createElementNS(ns,'line'); gl.setAttribute('x1',x); gl.setAttribute('x2',x); gl.setAttribute('y1',PAD.t); gl.setAttribute('y2',PAD.t+cH); gl.setAttribute('stroke','rgba(61,43,31,0.055)'); gl.setAttribute('stroke-width','1'); svg.appendChild(gl);

 const lbl = document.createElementNS(ns,'text'); lbl.setAttribute('x',x); lbl.setAttribute('y',PAD.t+cH+14); lbl.setAttribute('text-anchor','middle'); lbl.setAttribute('font-size','10'); lbl.setAttribute('fill','rgba(92,61,42,0.45)'); lbl.setAttribute('font-family',"'DM Mono',monospace"); lbl.textContent=d+'d'; svg.appendChild(lbl);

 });

 const yStep = (WORD_MAX - WORD_MIN) > 140000 ? 25000 : 10000;

 const yTicks = [];

 for(let w = Math.ceil(WORD_MIN/yStep)*yStep; w <= WORD_MAX; w += yStep) { yTicks.push(w); }

 yTicks.forEach(w => {

 const y = py(w);

 const gl = document.createElementNS(ns,'line'); gl.setAttribute('x1',PAD.l); gl.setAttribute('x2',PAD.l+cW); gl.setAttribute('y1',y); gl.setAttribute('y2',y); gl.setAttribute('stroke','rgba(61,43,31,0.055)'); gl.setAttribute('stroke-width','1'); svg.appendChild(gl);

 const lbl = document.createElementNS(ns,'text'); lbl.setAttribute('x',PAD.l-6); lbl.setAttribute('y',y+3); lbl.setAttribute('text-anchor','end'); lbl.setAttribute('font-size','10'); lbl.setAttribute('fill','rgba(92,61,42,0.45)'); lbl.setAttribute('font-family',"'DM Mono',monospace"); lbl.textContent=Math.round(w/1000)+'k'; svg.appendChild(lbl);

 });

 function paceLine(pace) {

 const dAtWmin=WORD_MIN/pace, dAtWmax=WORD_MAX/pace;

 const d1=Math.max(DAY_MIN, dAtWmin), d2=Math.min(DAY_MAX, dAtWmax);

 if(d2<=d1) return null;

 const w1=Math.min(WORD_MAX, Math.max(WORD_MIN, pace*d1)), w2=Math.min(WORD_MAX, Math.max(WORD_MIN, pace*d2));

 return {x1:px(d1),y1:py(w1),x2:px(d2),y2:py(w2)};

 }

 [{pace:10000,label:'10k/day'},{pace:20000,label:'20k/day'},{pace:30000,label:'30k/day'}].forEach(p=>{

 const pl=paceLine(p.pace); if(!pl) return;

 const line=document.createElementNS(ns,'line'); line.setAttribute('x1',pl.x1);line.setAttribute('y1',pl.y1); line.setAttribute('x2',pl.x2);line.setAttribute('y2',pl.y2); line.setAttribute('stroke','rgba(92,61,42,0.22)');line.setAttribute('stroke-width','1.5'); line.setAttribute('stroke-dasharray','5 4'); svg.appendChild(line);

 const lbl=document.createElementNS(ns,'text'); lbl.setAttribute('x',pl.x2+4);lbl.setAttribute('y',pl.y2+3); lbl.setAttribute('font-size','10');lbl.setAttribute('fill','rgba(92,61,42,0.45)'); lbl.setAttribute('font-family',"'DM Mono',monospace"); lbl.textContent=p.label; svg.appendChild(lbl);

 });

 const xLbl=document.createElementNS(ns,'text');xLbl.setAttribute('x',PAD.l+cW/2);xLbl.setAttribute('y',H-4);xLbl.setAttribute('text-anchor','middle');xLbl.setAttribute('font-size','11');xLbl.setAttribute('fill','rgba(92,61,42,0.4)');xLbl.setAttribute('letter-spacing','2');xLbl.setAttribute('font-family',"'DM Mono',monospace");xLbl.textContent='DAYS TO READ';svg.appendChild(xLbl);

 const yLbl=document.createElementNS(ns,'text');yLbl.setAttribute('x',18);yLbl.setAttribute('y',PAD.t+cH/2);yLbl.setAttribute('text-anchor','middle');yLbl.setAttribute('font-size','10');yLbl.setAttribute('fill','rgba(92,61,42,0.4)');yLbl.setAttribute('letter-spacing','1.6');yLbl.setAttribute('font-family',"'DM Mono',monospace");yLbl.setAttribute('transform',`rotate(-90 18 ${PAD.t+cH/2})`);yLbl.textContent='WORDS';svg.appendChild(yLbl);

  const dayGroups = {}; BOOKS.forEach(b => { const k = b.days; dayGroups[k] = (dayGroups[k] || []); dayGroups[k].push(b); });
  const jitterMap = {}; Object.entries(dayGroups).forEach(([d, books]) => { books.forEach((b, i) => { jitterMap[b.title] = (i - (books.length - 1) / 2) * 5; }); });

  const _scatterDots = [];

  BOOKS.forEach(book => {
    const jitter = jitterMap[book.title] || 0;
    const x = Math.max(PAD.l + 6, Math.min(PAD.l + cW - 6, px(book.days) + jitter));
    const y = Math.max(PAD.t + 6, Math.min(PAD.t + cH - 6, py(book.words)));
    const c = COLORS[book.sentiment] || COLORS.mixed;
    const pace = Math.round((Number(book.words) || 0) / Math.max(1, Number(book.days) || 0));

    const dot = document.createElementNS(ns, 'circle');
    dot.setAttribute('cx', x);
    dot.setAttribute('cy', y);
    dot.setAttribute('r', '6');
    dot.setAttribute('fill', c);
    dot.setAttribute('stroke', '#f0e8dc');
    dot.setAttribute('stroke-width', '1.5');
    dot.style.cursor = 'pointer';
    dot.style.opacity = '0';
    dot.style.transition = 'opacity 0.3s ease';
    _scatterDots.push(dot);

    dot.addEventListener('mouseenter', e => {
      showChartTT(`<div class="ctt-title">${book.title || 'Untitled'}</div><div class="ctt-body">${book.days || 0} day${(book.days || 0) !== 1 ? 's' : ''} · ${ (book.words || 0) >= 1000000 ? ((book.words || 0) / 1000000).toFixed(1) + 'M' : Math.round((book.words || 0) / 1000) + 'k' } words<br>${pace.toLocaleString()} w/day<br><span style="color:${c}">${LABELS[book.sentiment] || ''}</span></div>`, e);
    });
    dot.addEventListener('mousemove', e => moveChartTT(e));
    dot.addEventListener('mouseleave', hideChartTT);
    dot.addEventListener('click', () => openPanel(book));

    svg.appendChild(dot);
  });

 document.getElementById('scatterChart').appendChild(svg);

 if(window.revealOnScroll){

 window.revealOnScroll(document.getElementById('scatterChart'), (el, isIntersecting)=>{
       if(!isIntersecting) { _scatterDots.forEach(d=>d.style.opacity='0'); return; }
       _scatterDots.forEach((d,i)=>{setTimeout(()=>{d.style.opacity='1';},i*22);});
   });

 } else { _scatterDots.forEach(d=>d.style.opacity='1'); }

 
}

export function renderHistogram(BOOKS, dayDomain) {
  const SENTS = ['love', 'like', 'mixed', 'dislike'];
  const dayVals = BOOKS.map(b => Number(b.days) || 0);
  const minVal = dayVals.length ? Math.min(...dayVals) : 0;
  const maxVal = dayVals.length ? Math.max(...dayVals) : 10;
  const span = Math.max(1, maxVal - minVal);
  const step = span / 4;

  const buckets = [0, 1, 2, 3].map(i => {
    const min = minVal + step * i;
    const max = (i === 3) ? maxVal : (minVal + step * (i + 1));
    const label = `${Math.round(min)}-${Math.round(max)}d`;
    return { label, min, max, books: [], count: 0, byS: {} };
  });

  buckets.forEach((bucket, i) => {
    bucket.books = BOOKS.filter(book => {
      const d = Number(book.days) || 0;
      return i === buckets.length - 1
        ? (d >= bucket.min && d <= bucket.max)
        : (d >= bucket.min && d < bucket.max);
    });
    bucket.count = bucket.books.length;
    SENTS.forEach(s => {
      bucket.byS[s] = bucket.books.filter(book => (book.sentiment || 'mixed') === s);
    });
  });

 const maxCount=Math.max(...buckets.map(b=>b.count),1);

 const container=document.getElementById('daysHistogram');

 const wrap=document.createElement('div');wrap.style.cssText='display:flex;flex-direction:column;gap:12px;padding:4px 0;';

 const _histBars=[];

 buckets.forEach(b=>{

 const row=document.createElement('div');row.style.cssText='display:flex;align-items:center;gap:14px;';

 const lbl=document.createElement('span');lbl.style.cssText='width:62px;flex-shrink:0;font-size:11px;text-align:right;color:rgba(92,61,42,0.6);';lbl.textContent=b.label;row.appendChild(lbl);

 const barWrap=document.createElement('div');barWrap.style.cssText='flex:1;position:relative;height:36px;background:rgba(237,224,208,0.92);border-radius:2px;';

 if(b.count>0){

 const barPct=b.count/maxCount*100;

 const barInner=document.createElement('div');barInner.style.cssText=`position:absolute;top:0;left:0;bottom:0;width:${barPct}%;display:flex;border-radius:2px;overflow:hidden;cursor:pointer;background:rgba(237,224,208,0.92);transform:scaleX(0);transform-origin:left center;transition:transform 0.95s cubic-bezier(0.22,1,0.36,1);`;_histBars.push(barInner);
barInner.addEventListener('mouseenter', (e) => { showChartTT(`<strong>${b.label}</strong><br/>${b.count} books`, e); });
barInner.addEventListener('mousemove', moveChartTT);
barInner.addEventListener('mouseleave', hideChartTT);

  const segments=document.createElement('div');segments.style.cssText='position:absolute;inset:0 clamp(60px,16%,88px) 0 0;display:flex;min-width:0;';

  SENTS.forEach(s=>{const n=b.byS[s].length;if(!n)return;const seg=document.createElement('div');seg.style.cssText=`flex:${n};background:${COLORS[s]};display:flex;align-items:center;justify-content:center;overflow:hidden;min-width:14px;`;seg.innerHTML=`<span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;font-weight:700;color:rgba(255,255,255,0.95);text-shadow:0 1px 2px rgba(0,0,0,0.35);pointer-events:none;">${n}</span>`;segments.appendChild(seg);});

 barInner.appendChild(segments);

 const countLbl=document.createElement('span');countLbl.style.cssText='position:absolute;right:8px;top:50%;transform:translateY(-50%);font-size:9px;letter-spacing:0.12em;color:rgba(92,61,42,0.62);white-space:nowrap;text-transform:uppercase;z-index:2;';countLbl.textContent=b.count+' '+(b.count===1?'BOOK':'BOOKS');barWrap.appendChild(countLbl);

 barInner.addEventListener('mouseenter',e=>{

 const lines=SENTS.map(s=>{const n=b.byS[s].length;if(!n)return '';const titles=b.byS[s].map(bk=>bk.title).join(', ');return '<span style="color:'+COLORS[s]+'">'+LABELS[s]+'</span> · '+n+' · '+titles;}).filter(Boolean).join('<br>');

 showChartTT('<div class="ctt-title">'+b.label+' · '+b.count+' book'+(b.count!==1?'s':'')+'</div><div class="ctt-body">'+lines+'</div>',e);

 });

 barInner.addEventListener('mousemove',e=>moveChartTT(e));barInner.addEventListener('mouseleave',hideChartTT);

 barWrap.appendChild(barInner);

 }

 row.appendChild(barWrap);wrap.appendChild(row);

 });

 const leg=document.createElement('div');leg.style.cssText='display:flex;gap:16px;flex-wrap:wrap;margin-top:12px;padding-top:12px;border-top:1px solid rgba(61,43,31,0.08);justify-content:center;';

 SENTS.forEach(s=>{const item=document.createElement('div');item.style.cssText='display:flex;align-items:center;gap:6px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:var(--wood-light);';item.innerHTML='<div style="width:10px;height:10px;border-radius:2px;background:'+COLORS[s]+';flex-shrink:0;"></div>'+LABELS[s];leg.appendChild(item);});

 wrap.appendChild(leg);

 container.appendChild(wrap);

 if(window.revealOnScroll){

 window.revealOnScroll(container, (el, isIntersecting)=>{
       if(!isIntersecting) { _histBars.forEach(bar=>bar.style.transform='scaleX(0)'); return; }
       _histBars.forEach((bar,i)=>{setTimeout(()=>{bar.style.transform='scaleX(1)';},i*120);});
   });

 } else { _histBars.forEach(bar=>bar.style.transform='scaleX(1)'); }

 
}

export function renderMoodBoard(BOOKS) {


    const mb = document.getElementById('moodBoard');

    if (!mb) return;

    

    // Add premium loading skeleton animation

    mb.innerHTML = `

        <div style="display:flex; flex-wrap:wrap; width:100%; gap:12px;">

            <div style="flex:1 1 100%; height:110px; background:rgba(61,43,31,0.06); border-radius:12px; animation: pulse 1.5s infinite ease-in-out;"></div>

            <div style="flex:1 1 calc(33% - 8px); height:80px; background:rgba(61,43,31,0.06); border-radius:12px; animation: pulse 1.5s infinite ease-in-out 0.2s;"></div>

            <div style="flex:1 1 calc(33% - 8px); height:80px; background:rgba(61,43,31,0.06); border-radius:12px; animation: pulse 1.5s infinite ease-in-out 0.4s;"></div>

        </div>

    `;

    

    const observer = new IntersectionObserver((entries) => {

        if (entries[0].isIntersecting) {

            observer.disconnect();

            setTimeout(() => {

                mb.innerHTML = '';

                const sentiments = {love:0, like:0, mixed:0, dislike:0};

        BOOKS.forEach(b => { if(sentiments[b.sentiment] !== undefined) sentiments[b.sentiment]++; });

        const total = BOOKS.length || 1;

        

        const maxS = Object.keys(sentiments).reduce((a, b) => sentiments[a] > sentiments[b] ? a : b);

        

        // Build a pretty, glassmorphic mood board card for dominant sentiments

        Object.entries(sentiments).sort((a,b) => b[1]-a[1]).forEach(([s, count], i) => {

            if (count === 0) return;

            const pct = Math.round((count/total)*100);

            const card = document.createElement('div');

            const isDom = (s === maxS);

            card.title = `${s.charAt(0).toUpperCase() + s.slice(1)}: ${count} books (${pct}% of total).`;

            card.style.cssText = `

                flex: ${isDom ? '1 1 100%' : '1 1 calc(33% - 8px)'};

                min-width: 120px;

                background: linear-gradient(135deg, ${COLORS[s]}10 0%, ${COLORS[s]}20 100%);

                border: 1px solid ${COLORS[s]}40;

                border-radius: 12px;

                padding: ${isDom ? '24px' : '16px'};

                display: flex;

                flex-direction: column;

                align-items: center;

                justify-content: center;

                /* backdrop-filter removed */

                box-shadow: 0 4px 12px rgba(0,0,0,0.05);

                opacity: 0;

                transform: translateY(15px);

                transition: opacity 0.5s ease-out, transform 0.5s ease-out;

                cursor: default;

            `;

            card.innerHTML = `

                <div style="font-size:${isDom ? '28px' : '18px'}; font-weight:800; color:${COLORS[s]};">${LABELS[s]}</div>

                <div style="font-size:12px; color:rgba(61,43,31,0.6); margin-top:4px; font-family:\'DM Mono\',monospace;">${pct}%  -  ${count} book${count!==1?'s':''}</div>

            `;

            mb.appendChild(card);

            

            // Trigger micro-animation

            setTimeout(() => {

                card.style.opacity = '1';

                card.style.transform = 'translateY(0)';

            }, 50 + (i * 120));

        });

    }, 600);

        }

    });

    observer.observe(mb);


}

export function renderHeatmap(BOOKS) {


 const GENRES=[...new Set(BOOKS.map(b=>b.genre).filter(Boolean))].sort();

 const SENTIMENTS=['love','like','mixed','dislike'];

 const grid={};GENRES.forEach(g=>{grid[g]={};SENTIMENTS.forEach(s=>{grid[g][s]=[];});});

 BOOKS.forEach(b=>{if(grid[b.genre] && grid[b.genre][b.sentiment]) grid[b.genre][b.sentiment].push(b);});

 const container=document.getElementById('heatmapChart');

 const isM = window.innerWidth <= 768; const CELL_W=isM?55:130,CELL_H=74,ROW_LABEL_W=isM?95:148,COL_LABEL_H=40,PAD2=isM?4:16;

 const totalW=ROW_LABEL_W+SENTIMENTS.length*CELL_W+PAD2,totalH=COL_LABEL_H+GENRES.length*CELL_H+PAD2;

 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');

 svg.setAttribute('viewBox',`0 0 ${totalW} ${totalH}`);
 svg.setAttribute('width', '100%');
 svg.style.height = 'auto';
 svg.style.display='block';
 svg.style.maxHeight = '70vh'; /* Prevent vertical insanity */


 const SENT_LABELS={love:'Loved',like:'Liked',mixed:'Mixed',dislike:'Disliked'};

const SENT_COLORS={love:'#1c3f78',like:'#1e5c3a',mixed:'#c89018',dislike:'#8c1a28'};

 SENTIMENTS.forEach((s,si)=>{

 const cx2=ROW_LABEL_W+si*CELL_W+CELL_W/2;

 const dot=document.createElementNS(ns,'circle');dot.setAttribute('cx',cx2-28);dot.setAttribute('cy',COL_LABEL_H/2+2);dot.setAttribute('r','4');dot.setAttribute('fill',SENT_COLORS[s]);svg.appendChild(dot);

 const lbl=document.createElementNS(ns,'text');lbl.setAttribute('x',cx2-20);lbl.setAttribute('y',COL_LABEL_H/2+6);lbl.setAttribute('font-size','11');lbl.setAttribute('font-family',"'DM Mono',monospace");lbl.setAttribute('fill','rgba(61,43,31,0.65)');lbl.textContent=SENT_LABELS[s].toUpperCase();svg.appendChild(lbl);

 });

 const _heatCells=[];

GENRES.forEach((g,gi)=>{

 const rowY=COL_LABEL_H+gi*CELL_H,rowMid=rowY+CELL_H/2;

 if(gi%2===0){const bg=document.createElementNS(ns,'rect');bg.setAttribute('x',0);bg.setAttribute('y',rowY);bg.setAttribute('width',totalW);bg.setAttribute('height',CELL_H);bg.setAttribute('fill','rgba(0,0,0,0.025)');svg.appendChild(bg);}

 const rl=document.createElementNS(ns,'text');rl.setAttribute('x',ROW_LABEL_W-12);rl.setAttribute('y',rowMid+4);rl.setAttribute('text-anchor','end');rl.setAttribute('font-size','12');rl.setAttribute('font-family',"-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif");rl.setAttribute('font-style','italic');rl.setAttribute('fill','rgba(61,43,31,0.75)');rl.textContent=g;svg.appendChild(rl);

 SENTIMENTS.forEach((s,si)=>{

 const books=grid[g][s],cx2=ROW_LABEL_W+si*CELL_W,count=books.length;

 const alpha=count===0?0:count===1?0.18:count===2?0.38:0.62;

const cell=document.createElementNS(ns,'g');cell.setAttribute('class','genre-cell');cell.style.opacity='0';cell.style.transition='opacity 0.4s ease';
cell.style.cursor = count > 0 ? 'pointer' : 'default';
cell.addEventListener('mouseenter', (e) => {
    if (count === 0) {
        showChartTT(`<div class="ctt-title">${g}  -  ${SENT_LABELS[s]}</div><div class="ctt-body">0 books</div>`, e);
    } else {
        const bookList = books.map(b => `${b.title} <span style="color:${SENT_COLORS[b.sentiment]}">(${SENT_LABELS[b.sentiment]})</span>`).join('<br>');
        showChartTT(`<div class="ctt-title">${g}  -  ${SENT_LABELS[s]}</div><div class="ctt-body">${bookList}</div>`, e);
    }
});
cell.addEventListener('mousemove', moveChartTT);
cell.addEventListener('mouseleave', hideChartTT);

 const cb=document.createElementNS(ns,'rect');cb.setAttribute('x',cx2+3);cb.setAttribute('y',rowY+3);cb.setAttribute('width',CELL_W-6);cb.setAttribute('height',CELL_H-6);cb.setAttribute('rx','3');cb.setAttribute('fill',count?SENT_COLORS[s]:'transparent');cb.setAttribute('opacity',alpha);cell.appendChild(cb);

 if(count===0){

 const dash=document.createElementNS(ns,'text');dash.setAttribute('x',cx2+CELL_W/2);dash.setAttribute('y',rowMid+4);dash.setAttribute('text-anchor','middle');dash.setAttribute('font-size','11');dash.setAttribute('fill','rgba(61,43,31,0.12)');dash.setAttribute('font-family',"'DM Mono',monospace");dash.textContent=' - ';cell.appendChild(dash);

 } else {

 const num=document.createElementNS(ns,'text');num.setAttribute('x',cx2+CELL_W/2);num.setAttribute('y',rowMid-4);num.setAttribute('text-anchor','middle');num.setAttribute('font-size','22');num.setAttribute('font-family',"-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif");num.setAttribute('font-weight','700');num.setAttribute('fill',count>=2?SENT_COLORS[s]:'rgba(61,43,31,0.55)');num.setAttribute('opacity',count>=2?'1':'0.9');num.textContent=count;cell.appendChild(num);

 const titlesStr=books.map(b=>b.title.length>14?b.title.slice(0,12)+'...':b.title).join(', ');

 const sub=document.createElementNS(ns,'text');sub.setAttribute('x',cx2+CELL_W/2);sub.setAttribute('y',rowMid+16);sub.setAttribute('text-anchor','middle');sub.setAttribute('font-size','8');sub.setAttribute('font-family',"'DM Mono',monospace");sub.setAttribute('fill','rgba(61,43,31,0.45)');sub.textContent=titlesStr.length>22?titlesStr.slice(0,20)+'...':titlesStr;cell.appendChild(sub);

 const hitArea=document.createElementNS(ns,'rect');hitArea.setAttribute('x',cx2+3);hitArea.setAttribute('y',rowY+3);hitArea.setAttribute('width',CELL_W-6);hitArea.setAttribute('height',CELL_H-6);hitArea.setAttribute('fill','transparent');hitArea.style.cursor='pointer';

 }

 svg.appendChild(cell);_heatCells.push(cell);

 });

 });

 let maxPos=-1,maxPosG=null,maxPosS=null,maxDis=-1,maxDisG=null,maxDisS=null;

 GENRES.forEach(g=>{SENTIMENTS.forEach(s=>{const c=grid[g][s].length;if((s==='love'||s==='like')&&c>maxPos){maxPos=c;maxPosG=g;maxPosS=s;}if(s==='dislike'&&c>maxDis){maxDis=c;maxDisG=g;maxDisS=s;}});});

 function drawRibbon(g,s,col){

 const gi=GENRES.indexOf(g),si=SENTIMENTS.indexOf(s);

 const cx2=ROW_LABEL_W+si*CELL_W,rowY=COL_LABEL_H+gi*CELL_H,rSize=20;

 const tri=document.createElementNS(ns,'polygon');tri.setAttribute('points',`${cx2+CELL_W-rSize},${rowY} ${cx2+CELL_W},${rowY} ${cx2+CELL_W},${rowY+rSize}`);tri.setAttribute('fill',col);tri.setAttribute('opacity','0.92');tri.style.pointerEvents='none';svg.appendChild(tri);

 const edge=document.createElementNS(ns,'line');edge.setAttribute('x1',cx2+CELL_W-rSize);edge.setAttribute('y1',rowY);edge.setAttribute('x2',cx2+CELL_W);edge.setAttribute('y2',rowY+rSize);edge.setAttribute('stroke','rgba(240,232,220,0.8)');edge.setAttribute('stroke-width','1.5');edge.style.pointerEvents='none';svg.appendChild(edge);

 }

 if(maxPosG) drawRibbon(maxPosG,maxPosS,'#c89018');

 if(maxDisG&&maxDis>0) drawRibbon(maxDisG,maxDisS,'#8c1a28');

 container.appendChild(svg);

 const _revealHeat=()=>{const order=_heatCells.slice();for(let i=order.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));const t=order[i];order[i]=order[j];order[j]=t;}order.forEach((cell,i)=>{setTimeout(()=>{cell.style.opacity='1';},i*50);});};

 if(window.revealOnScroll){window.revealOnScroll(container, (el, isIntersecting)=>{
       if(!isIntersecting) { _heatCells.forEach(c=>c.style.opacity='0'); return; }
       _revealHeat();
   });}else{_heatCells.forEach(c=>c.style.opacity='1');}

 
}

export function renderVintage(BOOKS) {


 const container=document.getElementById('vintageChart');

  const ns = 'http://www.w3.org/2000/svg';
  const currentYear = new Date().getFullYear();
  const validYears = BOOKS.map(b => Number(b.year) || (b.date_finished ? new Date(b.date_finished).getFullYear() : (b.dateStarted ? new Date(b.dateStarted).getFullYear() : currentYear))).filter(y => !isNaN(y) && y > 0);
  const minYear = validYears.length ? Math.min(...validYears) : currentYear;
  const maxYear = validYears.length ? Math.max(...validYears) : currentYear;

  const ERAS = [
    { label: 'Classic', yearMax: 2005, fill: 'rgba(61,43,31,0.030)' },
    { label: 'Established', yearMin: 2006, yearMax: 2015, fill: 'rgba(61,43,31,0.018)' },
    { label: 'Recent', yearMin: 2016, yearMax: 2022, fill: 'rgba(61,43,31,0.030)' },
    { label: 'New', yearMin: 2023, fill: 'rgba(61,43,31,0.018)' }
  ];

  const ERA_COLS = { Classic: '#8c1a28', Established: '#c89018', Recent: '#1c3f78', New: '#1e5c3a' };
  const TW = 800, TH = 195, PAD = { t: 12, r: 24, b: 52, l: 20 }, tcW = TW - PAD.l - PAD.r, baseY = TH - PAD.b;
  const bandTop = PAD.t, bandH = baseY - PAD.t;
  const ERA_WEIGHTS = { Classic: 0.31, Established: 0.29, Recent: 0.25, New: 0.15 };
  const eraRanges = [];
  let cursorX = PAD.l;

  ERAS.forEach((era, idx) => {
    const yMin = era.yearMin !== undefined ? era.yearMin : minYear;
    const yMax = era.yearMax !== undefined ? era.yearMax : maxYear;
    const w = idx === ERAS.length - 1 ? (PAD.l + tcW - cursorX) : tcW * (ERA_WEIGHTS[era.label] || (1 / ERAS.length));
    const x1 = cursorX;
    const x2 = x1 + w;
    eraRanges.push({ era, idx, yMin, yMax, x1, x2 });
    cursorX = x2;
  });

  function tx(year) {
    const yr = Number(year) || currentYear;
    const bucket = eraRanges.find(r => yr >= r.yMin && yr <= r.yMax) || eraRanges[eraRanges.length - 1];
    if (!bucket) return PAD.l;
    const span = Math.max(1, bucket.yMax - bucket.yMin);
    const t = Math.max(0, Math.min(1, (yr - bucket.yMin) / span));
    return bucket.x1 + t * (bucket.x2 - bucket.x1);
  }

 const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox',`0 0 ${TW} ${TH}`);svg.setAttribute('preserveAspectRatio','xMidYMid meet');svg.style.cssText='width:100%;height:auto;display:block;overflow:visible;';

 eraRanges.forEach(({ era, x1, x2 })=>{

 const w=Math.max(0,x2-x1);

 const band=document.createElementNS(ns,'rect');

 band.setAttribute('x',x1); band.setAttribute('y',bandTop);

 band.setAttribute('width',w); band.setAttribute('height',bandH);

 band.setAttribute('fill',era.fill);

 svg.appendChild(band);

 const midX=(x1+Math.min(x2,PAD.l+tcW))/2;

 const wm=document.createElementNS(ns,'text');

 wm.setAttribute('x',midX);

 wm.setAttribute('y',bandTop+bandH*0.62);

 wm.setAttribute('text-anchor','middle');

 wm.setAttribute('font-size', String(Math.max(20, Math.min(32, w * 0.14))));

 wm.setAttribute('font-family',"-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif");

 wm.setAttribute('font-style','italic');

 wm.setAttribute('font-weight','700');

 wm.setAttribute('fill','rgba(61,43,31,0.055)');

 wm.setAttribute('letter-spacing','-1');

 wm.style.pointerEvents='none';

 wm.textContent=era.label;

 svg.appendChild(wm);

 });

 eraRanges.forEach(({ x1 }, idx)=>{

 if(idx===0) return;

 const div=document.createElementNS(ns,'line');

 div.setAttribute('x1',x1); div.setAttribute('x2',x1);

 div.setAttribute('y1',bandTop); div.setAttribute('y2',baseY);

 div.setAttribute('stroke','rgba(61,43,31,0.1)'); div.setAttribute('stroke-width','1');

 svg.appendChild(div);

 });

 const base2=document.createElementNS(ns,'line');base2.setAttribute('x1',PAD.l);base2.setAttribute('x2',PAD.l+tcW);base2.setAttribute('y1',baseY);base2.setAttribute('y2',baseY);base2.setAttribute('stroke','rgba(61,43,31,0.15)');base2.setAttribute('stroke-width','1');svg.appendChild(base2);

 
 const ySpan = maxYear - minYear;
 const step = ySpan > 80 ? 20 : (ySpan > 40 ? 10 : 5);
 for(let yr = Math.ceil(minYear/step)*step; yr <= maxYear; yr += step) {


 const x = tx(yr);

 const tick = document.createElementNS(ns,'line'); tick.setAttribute('x1',x); tick.setAttribute('x2',x); tick.setAttribute('y1',baseY); tick.setAttribute('y2',baseY+5); tick.setAttribute('stroke','rgba(61,43,31,0.2)'); tick.setAttribute('stroke-width','1'); svg.appendChild(tick);

 const lbl = document.createElementNS(ns,'text'); lbl.setAttribute('x',x); lbl.setAttribute('y',baseY+14); lbl.setAttribute('text-anchor','middle'); lbl.setAttribute('font-size','7.5'); lbl.setAttribute('font-family',"'DM Mono',monospace"); lbl.setAttribute('fill','rgba(92,61,42,0.38)'); lbl.textContent=yr; svg.appendChild(lbl);

 }

 const DOT_R=6,DOT_GAP=3,stackY={};

 const seenTitlesVintage = new Set();

  const _vintageDots = [];

  BOOKS.filter(book => {
    const bYr = Number(book.year) || (book.date_finished ? new Date(book.date_finished).getFullYear() : (book.dateStarted ? new Date(book.dateStarted).getFullYear() : currentYear));
    const key = (book.title || '') + '|' + bYr;
    if (seenTitlesVintage.has(key)) return false;
    seenTitlesVintage.add(key);
    return true;
  }).forEach(book => {
    const bYr = Number(book.year) || (book.date_finished ? new Date(book.date_finished).getFullYear() : (book.dateStarted ? new Date(book.dateStarted).getFullYear() : currentYear));
    const x = tx(bYr), sc = stackY[bYr] || 0;
    const y = baseY - DOT_R - (sc * (DOT_R * 2 + DOT_GAP));
    stackY[bYr] = (sc + 1);
    const col = COLORS[book.sentiment] || COLORS.mixed;
    const dot = document.createElementNS(ns, 'circle');
    dot.setAttribute('cx', String(isNaN(x) ? PAD.l : x));
    dot.setAttribute('cy', String(isNaN(y) ? baseY - DOT_R : y));
    dot.setAttribute('r', String(DOT_R));
    dot.setAttribute('fill', col);
    dot.setAttribute('stroke', 'rgba(240,232,220,0.85)');
    dot.setAttribute('stroke-width', '1.5');
    dot.style.cursor = 'pointer';
    dot.style.opacity = '0';
    dot.style.transition = 'opacity 0.3s ease, r 0.1s';
    _vintageDots.push(dot);

    dot.addEventListener('mouseenter', e => {
      dot.setAttribute('r', (DOT_R + 2) + '');
      const age = currentYear - bYr;
      const era = ERAS.find(er => (er.yearMin === undefined || bYr >= er.yearMin) && (er.yearMax === undefined || bYr <= er.yearMax));
      const eraCol = era ? ERA_COLS[era.label] : 'rgba(92,61,42,0.5)';
      showChartTT(`<div class="ctt-title">${book.title || 'Untitled'}</div><div class="ctt-body">Published ${bYr} · ${age} year${age !== 1 ? 's' : ''} ago<br><span style="color:${eraCol}">${era ? era.label : ''}</span> &nbsp;·&nbsp; <span style="color:${col}">${LABELS[book.sentiment] || ''}</span></div>`, e);
    });

    dot.addEventListener('mousemove', e => moveChartTT(e));
    dot.addEventListener('mouseleave', () => { dot.setAttribute('r', DOT_R + ''); hideChartTT(); });
    dot.addEventListener('click', () => openPanel(book));
    svg.appendChild(dot);
  });

  const legY = TH - 13;
  const legItems = [{ col: COLORS.love, lbl: 'Loved' }, { col: COLORS.like, lbl: 'Liked' }, { col: COLORS.mixed, lbl: 'Mixed' }, { col: COLORS.dislike, lbl: 'Disliked' }];
  const legTotalW = legItems.length * 56;
  let legX = (TW - legTotalW) / 2;

  legItems.forEach(li => {
    const c = document.createElementNS(ns, 'circle');
    c.setAttribute('cx', String(legX + 5));
    c.setAttribute('cy', String(legY));
    c.setAttribute('r', '4');
    c.setAttribute('fill', li.col);
    svg.appendChild(c);

    const t = document.createElementNS(ns, 'text');
    t.setAttribute('x', String(legX + 13));
    t.setAttribute('y', String(legY + 3.5));
    t.setAttribute('font-size', '10');
    t.setAttribute('font-family', "'DM Mono',monospace");
    t.setAttribute('fill', 'rgba(92,61,42,0.45)');
    t.setAttribute('letter-spacing', '0.02em');
    t.textContent = li.lbl;
    svg.appendChild(t);
    legX += 56;
  });

  container.appendChild(svg);

  if (window.revealOnScroll) {
    window.revealOnScroll(container, (el, isIntersecting) => {
      if (!isIntersecting) { _vintageDots.forEach(d => d.style.opacity = '0'); return; }
      _vintageDots.forEach((d, i) => { setTimeout(() => { d.style.opacity = '1'; }, i * 30); });
    });
  } else {
    _vintageDots.forEach(d => d.style.opacity = '1');
  }
}

export function renderDecade(BOOKS) {
  const container = document.getElementById('decadeChart');
  if (!container) return;
  container.style.padding = '0';
  const currentYear = new Date().getFullYear();
  const decades = {};
  BOOKS.forEach(b => {
    const bYr = Number(b.year) || (b.date_finished ? new Date(b.date_finished).getFullYear() : (b.dateStarted ? new Date(b.dateStarted).getFullYear() : currentYear));
    const dec = Math.floor(bYr / 10) * 10;
    if (!decades[dec]) decades[dec] = [];
    decades[dec].push({ ...b, year: bYr });
  });

 const _decadeSpines=[];

 const sortedDecades=Object.keys(decades).map(Number).sort();

 const SPINE_H=10, SPINE_GAP=3, STACK_BASE_PAD=4;

 const stackHeights=sortedDecades.map(dec=>{

 const count=decades[dec].length;

 return count>0?(count*SPINE_H)+((count-1)*SPINE_GAP)+STACK_BASE_PAD:STACK_BASE_PAD;

 });

 const maxStackHeight=Math.max(...stackHeights, 120);

 const grid=document.createElement('div');

 const gridMinW = sortedDecades.length * 110;

 grid.style.cssText=`display:flex;align-items:flex-end;gap:10px;min-height:${maxStackHeight+42}px;padding:0 8px 2px;min-width:${gridMinW}px;`;

 sortedDecades.forEach(dec=>{

 const books=[...decades[dec]].sort((a,b)=>a.year-b.year);

 const colEl=document.createElement('div');

 colEl.style.cssText='flex:1 0 90px;display:flex;flex-direction:column;align-items:center;min-width:90px;';

 const stackRow=document.createElement('div');

 stackRow.style.cssText=`display:flex;align-items:flex-end;justify-content:center;gap:10px;width:100%;min-height:${maxStackHeight}px;`;

 const stackCol=document.createElement('div');

 stackCol.style.cssText='display:flex;flex-direction:column;align-items:center;gap:8px;';

 const stack=document.createElement('div');

 stack.style.cssText=`position:relative;width:100%;max-width:82px;height:${maxStackHeight}px;cursor:pointer;`;

 books.forEach((bk, i)=>{

 const spine=document.createElement('div');

 const shift=(i%2===0?-1:1)*(1+(i%3));

 const bottom=i*(SPINE_H+SPINE_GAP);

 const sentimentColor=COLORS[bk.sentiment]||'#8b6343';

 const _baseTf=`translateX(calc(-50% + ${shift}px))`;

 spine.style.cssText=`position:absolute;left:50%;transform:${_baseTf} scaleY(0);transform-origin:center bottom;transition:transform 0.5s cubic-bezier(0.22,1,0.36,1);bottom:${bottom}px;height:${SPINE_H}px;width:${70+(bk.words%28)}%;border-radius:2px 1px 1px 2px;background:${sentimentColor};border:1px solid rgba(61,43,31,0.28);box-shadow:0 1px 0 rgba(255,255,255,0.2), inset 1px 0 0 rgba(255,255,255,0.16), inset -1px 0 0 rgba(0,0,0,0.12);overflow:hidden;`;

 _decadeSpines.push({el:spine, tf:_baseTf});

 spine.innerHTML='<span style="position:absolute;left:2px;top:1px;bottom:1px;width:1px;background:rgba(255,255,255,0.35);"></span>';

 spine.addEventListener('mouseenter',function(e){

 showChartTT(`<div class="ctt-title">${bk.title}</div><div class="ctt-body">${bk.year} · ${ bk.words >= 1000000 ? (bk.words/1000000).toFixed(1)+'M' : Math.round(bk.words/1000)+'k' } words<br><span style="color:${COLORS[bk.sentiment]}">${LABELS[bk.sentiment]}</span></div>`,e);

 });

 spine.addEventListener('mousemove',moveChartTT);

 spine.addEventListener('mouseleave',hideChartTT);

 stack.appendChild(spine);

 });

 const decadeLbl=document.createElement('div');

 decadeLbl.style.cssText="font-family:\'DM Mono\',monospace;font-size:9px;letter-spacing:0.08em;color:rgba(92,61,42,0.55);width:82px;text-align:center;";

 decadeLbl.textContent=dec+'s';

 const countLbl=document.createElement('div');

  const topSpineBottom = (books.length - 1) * (SPINE_H + SPINE_GAP);

  countLbl.style.cssText=`position:absolute; bottom:${topSpineBottom + SPINE_H + 6}px; width:100%; text-align:center; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:22px;font-weight:900;color:rgba(61,43,31,0.8);line-height:1;white-space:nowrap;pointer-events:none;`;

  countLbl.textContent=String(books.length);

  stack.appendChild(countLbl);

  const sentBreakdown=['love','like','mixed','dislike'].map(s=>{

  const c=books.filter(bk=>bk.sentiment===s).length;

  return c?'<span style="color:'+COLORS[s]+'"> '+LABELS[s]+' '+c+'</span>':'';

  }).filter(Boolean).join('<br>');

  stack.addEventListener('mouseenter',function(e){

  const titles=books.map(bk=>bk.title).join(', ');

  showChartTT('<div class="ctt-title">'+dec+'s</div><div class="ctt-body">'+books.length+' book'+(books.length!==1?'s':'')+'<br>'+sentBreakdown+'<br><br>'+titles+'</div>',e);

  });

  stack.addEventListener('mousemove',function(e){moveChartTT(e);});

  stack.addEventListener('mouseleave',hideChartTT);

  stackCol.appendChild(stack);

  stackCol.appendChild(decadeLbl);

  stackRow.appendChild(stackCol);

 colEl.appendChild(stackRow);

 grid.appendChild(colEl);

 });

 container.appendChild(grid);

  const getYr = (b) => Number(b.year) || (b.date_finished ? new Date(b.date_finished).getFullYear() : (b.dateStarted ? new Date(b.dateStarted).getFullYear() : currentYear));
  const oldestBook = BOOKS.reduce((a, b) => getYr(a) <= getYr(b) ? a : b);
  const newestBook = BOOKS.reduce((a, b) => getYr(a) >= getYr(b) ? a : b);
  const oldestYr = getYr(oldestBook);
  const newestYr = getYr(newestBook);

  const summary = document.createElement('div');
  summary.style.cssText = "margin-top:16px;padding-top:12px;border-top:1px solid rgba(61,43,31,0.08);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;font-style:italic;color:rgba(92,61,42,0.55);line-height:1.6;text-align:center;";
  summary.innerHTML = 'Oldest: <strong style="color:var(--wood-dark);">' + (oldestBook.title || 'Untitled') + '</strong> (' + oldestYr + ') · Newest: <strong style="color:var(--wood-dark);">' + (newestBook.title || 'Untitled') + '</strong> (' + newestYr + ') · ';
  container.appendChild(summary);

 if(window.revealOnScroll){

 window.revealOnScroll(grid,()=>{_decadeSpines.forEach((sp,i)=>{setTimeout(()=>{sp.el.style.transform=sp.tf+' scaleY(1)';},i*45);});});

 } else { _decadeSpines.forEach(sp=>sp.el.style.transform=sp.tf+' scaleY(1)'); }

 
}

export function renderPie(BOOKS) {


 const genreMap={};BOOKS.forEach(b=>{genreMap[b.genre]=(genreMap[b.genre]||0)+1;});

 const genres=Object.entries(genreMap).sort((a,b)=>b[1]-a[1]);

 const pieC=document.getElementById('pieCanvas'); if(!pieC) return; const pctx=pieC.getContext('2d'); if(!pctx) return; const cx=240,cy=240,r=200;

 let ang=-Math.PI/2;const slices=[];

 genres.forEach(([genre,count])=>{const sweep=(count/BOOKS.length)*Math.PI*2;slices.push({genre,count,start:ang,end:ang+sweep,mid:ang+sweep/2});ang+=sweep;});

 const LIFT=10;let _hoveredSlice=null;let _introT=1;

 const pieTT=document.getElementById('pie-tt');

 function _drawPie(){

 pctx.clearRect(0,0,pieC.width,pieC.height);

 const maxAng=-Math.PI/2+_introT*Math.PI*2;

 slices.forEach((s,i)=>{

 if(s.start>=maxAng) return;

 const drawEnd=Math.min(s.end,maxAng);

 const lifted=(_hoveredSlice===i)&&_introT>=1;

 const ox=lifted?Math.cos(s.mid)*LIFT:0;

 const oy=lifted?Math.sin(s.mid)*LIFT:0;

 pctx.beginPath();pctx.moveTo(cx+ox,cy+oy);pctx.arc(cx+ox,cy+oy,r,s.start,drawEnd);pctx.closePath();

 pctx.fillStyle=GENRE_COLORS[s.genre]||'#888';pctx.fill();

 pctx.strokeStyle='#f0e8dc';pctx.lineWidth=lifted?3:2.5;pctx.stroke();

 });

 pctx.fillStyle='#f0e8dc';pctx.beginPath();pctx.arc(cx,cy,90,0,Math.PI*2);pctx.fill();

 pctx.fillStyle='#3d2b1f';pctx.font='bold 26px Playfair Display,serif';pctx.textAlign='center';pctx.textBaseline='middle';

 if(_hoveredSlice!==null){

 const hs=slices[_hoveredSlice];pctx.fillText(hs.count,cx,cy-7);

 pctx.font='400 9px DM Mono,monospace';pctx.fillStyle='#8b6343';

 const gLabel=hs.genre.length>14?hs.genre.substring(0,13)+'...':hs.genre;

 pctx.fillText(gLabel.toUpperCase(),cx,cy+9);

 } else {

 pctx.fillText(BOOKS.length,cx,cy-7);pctx.font='400 10px DM Mono,monospace';pctx.fillStyle='#8b6343';pctx.fillText('BOOKS',cx,cy+14);

 }

 }

 // Clockwise reveal animation, gated on scroll-into-view (v2.5.0)

 _introT=0;_drawPie();

 if(window.revealOnScroll){

 window.revealOnScroll(pieC,()=>{

 const dur=2000,t0=performance.now();

 function step(now){

 const p=Math.min(1,(now-t0)/dur);

 _introT=window.easeOutCubic?window.easeOutCubic(p):p;

 _drawPie();

 if(p<1) requestAnimationFrame(step); else { _introT=1; _drawPie(); }

 }

 requestAnimationFrame(step);

 });

 } else { _introT=1;_drawPie(); }

 function showPieTT(genre,e){

 const books=BOOKS.filter(b=>b.genre===genre),c=GENRE_COLORS[genre]||'#888';

 let html=`<span class="pie-tt-genre" style="color:${c}">${genre}</span>`;

 books.forEach((b,i)=>{html+=`<div class="pie-tt-row"><span class="pie-tt-idx">${String(i+1).padStart(2,'0')}</span><span style="flex:1">${b.title}</span><span class="pie-tt-sent" style="color:${COLORS[b.sentiment]}">${LABELS[b.sentiment]}</span></div>`;});

 pieTT.innerHTML=html;pieTT.classList.add('show');movePieTT(e);

 }

 function movePieTT(e){const w=pieTT.offsetWidth||220,h=pieTT.offsetHeight||200;let x=e.clientX+16,y=e.clientY+14;if(x+w>window.innerWidth-10)x=e.clientX-w-16;if(y+h>window.innerHeight-8)y=e.clientY-h-14;pieTT.style.left=x+'px';pieTT.style.top=y+'px';}

 function hidePieTT(){pieTT.classList.remove('show');}

 pieC.addEventListener('mousemove',e=>{

 const rect=pieC.getBoundingClientRect(),sx=pieC.width/rect.width,mx=(e.clientX-rect.left)*sx-cx,my=(e.clientY-rect.top)*(pieC.height/rect.height)-cy,d=Math.sqrt(mx*mx+my*my);

 if(d<90||d>r){if(_hoveredSlice!==null){_hoveredSlice=null;_drawPie();}hidePieTT();return;}

 let a=Math.atan2(my,mx);if(a<-Math.PI/2)a+=Math.PI*2;

 const hitIdx=slices.findIndex(s=>a>=s.start&&a<s.end);

 if(hitIdx>=0&&hitIdx!==_hoveredSlice){_hoveredSlice=hitIdx;_drawPie();showPieTT(slices[hitIdx].genre,e);}

 else if(hitIdx>=0){movePieTT(e);}

 else{if(_hoveredSlice!==null){_hoveredSlice=null;_drawPie();}hidePieTT();}

 });

 pieC.addEventListener('mouseleave',()=>{if(_hoveredSlice!==null){_hoveredSlice=null;_drawPie();}hidePieTT();});

 const pieLegend=document.getElementById('pieLegend');

  genres.forEach(([genre,count])=>{

  const el=document.createElement('div');el.className='pie-leg-item';el.dataset.genre=genre;

  el.setAttribute('tabindex','0');el.setAttribute('role','button');el.setAttribute('aria-label',genre+': '+count+' book'+(count!==1?'s':''));

  el.innerHTML=`<div class="pie-leg-dot" style="background:${GENRE_COLORS[genre]||'#888'}"></div><span>${genre}</span><span class="pie-leg-count">${count}</span>`;

  el.addEventListener('mouseenter',e=>showPieTT(genre,e));el.addEventListener('mousemove',e=>movePieTT(e));el.addEventListener('mouseleave',hidePieTT);

  el.addEventListener('focus',e=>showPieTT(genre,e));el.addEventListener('blur',hidePieTT);

  el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();showPieTT(genre,e);}});

  pieLegend.appendChild(el);

  });

 
}

export function renderFicBar(BOOKS) {


 const ficBooks=BOOKS.filter(b=>b.fiction),nficBooks=BOOKS.filter(b=>!b.fiction);

 const ficW=ficBooks.reduce((s,b)=>s+(Number(b.words)||0),0),nficW=nficBooks.reduce((s,b)=>s+(Number(b.words)||0),0);

 if(!ficW&&!nficW) return;

 const fPct=Math.round(ficW/(ficW+nficW)*100),nfPct=100-fPct;

 const bar=document.getElementById('ficBar');

 bar.style.cssText='display:flex;height:46px;border-radius:3px;overflow:hidden;width:100%;margin-top:4px;';

 function fmtWordMix(n){ return n >= 1000000 ? (n/1000000).toFixed(2)+'M' : Math.round(n/1000)+'k'; }

 function makeSeg(pct,col,books,label,words){

 const seg=document.createElement('div');seg.style.cssText=`flex:0 1 0;background:${col};display:flex;align-items:center;padding:0 14px;gap:10px;cursor:default;transition:flex-grow 1.5s cubic-bezier(0.22,1,0.36,1),opacity 0.15s;min-width:0;overflow:hidden;`;seg.dataset.tflex=pct;

 const num=document.createElement('span');num.style.cssText="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:20px;font-weight:900;color:rgba(255,255,255,0.93);white-space:nowrap;flex-shrink:0;letter-spacing:-0.5px;pointer-events:none;";num.textContent=pct+'%';seg.appendChild(num);

 const divider=document.createElement('span');divider.style.cssText='width:1px;height:20px;background:rgba(255,255,255,0.2);flex-shrink:0;pointer-events:none;';seg.appendChild(divider);

 const info=document.createElement('span');info.style.cssText='display:flex;flex-direction:column;gap:1px;min-width:0;pointer-events:none;';

 info.innerHTML=`<span style="font-family:\'DM Mono\',monospace;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,255,255,0.85);white-space:nowrap;">${label}</span><span style="font-family:\'DM Mono\',monospace;font-size:10px;color:rgba(255,255,255,0.45);white-space:nowrap;">${books.length} books · ${fmtWordMix(words)} words</span>`;

 seg.appendChild(info);

 seg.addEventListener('mouseenter',e=>{

 seg.style.opacity='0.85';

 const titles=books.map(b=>'<span style="color:'+COLORS[b.sentiment]+'">■</span> '+b.title).join('<br>');

 showChartTT('<div class="ctt-title">'+label+'</div><div class="ctt-body">'+books.length+' books · '+fmtWordMix(words)+' words<br><br>'+titles+'</div>',e);

 });

 seg.addEventListener('mousemove',e=>moveChartTT(e));

 seg.addEventListener('mouseleave',()=>{seg.style.opacity='1';hideChartTT();});

 return seg;

 }

 if(fPct>0) bar.appendChild(makeSeg(fPct,'#2a5f6f',ficBooks,'Fiction',ficW));

 if(nfPct>0) bar.appendChild(makeSeg(nfPct,'#7a3b2e',nficBooks,'Non-Fiction',nficW));

 const _revealFic=()=>{Array.from(bar.children).forEach((seg,i)=>{setTimeout(()=>{seg.style.flexGrow=seg.dataset.tflex||1;},380+i*260);});};

 if(window.revealOnScroll){window.revealOnScroll(bar,_revealFic);}else{_revealFic();}

 
}

export function renderDotMatrix(BOOKS) {
  const container = document.getElementById('dotMatrix');
  if (!container) return;
  container.innerHTML = '';
  if (!BOOKS || !BOOKS.length) return;

  const maleBooks = BOOKS.filter(b => b.authorGender && b.authorGender.toLowerCase() === 'male');
  const femaleBooks = BOOKS.filter(b => b.authorGender && b.authorGender.toLowerCase() === 'female');
  const otherBooks = BOOKS.filter(b => b.authorGender && !['male', 'female'].includes(b.authorGender.toLowerCase()));
  
  const maleW = maleBooks.reduce((s,b) => s + (Number(b.words) || 0), 0);
  const femaleW = femaleBooks.reduce((s,b) => s + (Number(b.words) || 0), 0);
  const otherW = otherBooks.reduce((s,b) => s + (Number(b.words) || 0), 0);
  const totalW = maleW + femaleW + otherW;
  
  if (!totalW) return;
  
  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;height:46px;border-radius:3px;overflow:hidden;width:100%;margin-top:4px;';
  
  function fmtWordMix(n) { return n >= 1000000 ? (n/1000000).toFixed(2)+'M' : Math.round(n/1000)+'k'; }
  
  function makeSeg(pct, col, books, label, words) {
    const seg = document.createElement('div');
    seg.style.cssText = `flex:0 1 0;background:${col};display:flex;align-items:center;padding:0 14px;gap:10px;cursor:default;transition:flex-grow 1.5s cubic-bezier(0.22,1,0.36,1),opacity 0.15s;min-width:0;overflow:hidden;`;
    seg.dataset.tflex = pct;
    
    const num = document.createElement('span');
    num.style.cssText = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:20px;font-weight:900;color:rgba(255,255,255,0.93);white-space:nowrap;flex-shrink:0;letter-spacing:-0.5px;pointer-events:none;";
    num.textContent = pct + '%';
    seg.appendChild(num);
    
    const divider = document.createElement('span');
    divider.style.cssText = 'width:1px;height:20px;background:rgba(255,255,255,0.2);flex-shrink:0;pointer-events:none;';
    seg.appendChild(divider);
    
    const info = document.createElement('span');
    info.style.cssText = 'display:flex;flex-direction:column;gap:1px;min-width:0;pointer-events:none;';
    info.innerHTML = `<span style="font-family:'DM Mono',monospace;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,255,255,0.85);white-space:nowrap;">${label}</span><span style="font-family:'DM Mono',monospace;font-size:10px;color:rgba(255,255,255,0.45);white-space:nowrap;">${books.length} books &middot; ${fmtWordMix(words)} words</span>`;
    seg.appendChild(info);
    
    seg.addEventListener('mouseenter', e => {
      seg.style.opacity = '0.85';
      const titles = books.map(b => '<span style="color:' + (COLORS[b.sentiment] || '#888') + '">&#9679;</span> ' + b.title).join('<br>');
      showChartTT('<div class="ctt-title">' + label + '</div><div class="ctt-body">' + books.length + ' books &middot; ' + fmtWordMix(words) + ' words<br><br>' + titles + '</div>', e);
    });
    
    seg.addEventListener('mousemove', e => moveChartTT(e));
    seg.addEventListener('mouseleave', () => { seg.style.opacity = '1'; hideChartTT(); });
    
    return seg;
  }
  
  const mPct = Math.round((maleW / totalW) * 100);
  const fPct = Math.round((femaleW / totalW) * 100);
  const oPct = 100 - mPct - fPct; // The rest

  if (maleW > 0) bar.appendChild(makeSeg(mPct, '#2563a8', maleBooks, 'Male', maleW));
  if (femaleW > 0) bar.appendChild(makeSeg(fPct, '#c2396b', femaleBooks, 'Female', femaleW));
  if (otherW > 0 && oPct > 0) bar.appendChild(makeSeg(oPct, '#8b6343', otherBooks, 'Other', otherW));
  
  container.appendChild(bar);
  
  // Animate
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      Array.from(bar.children).forEach(c => { c.style.flex = c.dataset.tflex + ' 1 0'; });
    });
  });
}


export function _populateAuthorMeta() {


 Object.keys(AUTHOR_META).forEach(k => delete AUTHOR_META[k]);

 this.books.forEach(b => {

 if (!AUTHOR_META[b.author]) AUTHOR_META[b.author] = {};

 const gLower = (b.authorGender||'').toLowerCase();

 if (gLower === 'male') AUTHOR_META[b.author].gender = 'M';

 else if (gLower === 'female') AUTHOR_META[b.author].gender = 'F';

 const region = WikidataAPI.getBookRegion(b);

 const flag = WikidataAPI.getBookFlag(b);

 AUTHOR_META[b.author].region = region;

 AUTHOR_META[b.author].flag = flag;

 if (b.authorCountry) {

 const cc = WikidataAPI.countryToCode(b.authorCountry);

 if (cc) AUTHOR_META[b.author].countryCode = cc;

 }

 });

 
}


export async function _resolveWordCounts() {}
export async function migrateWordCounts() {}
export async function analyzeAuthors() {}
export const Stats = {
  renderMastheadStats,
  renderReadingGoal,
  renderPaceLine,
  renderSentimentStats,
  renderCharts,
  renderHomeQuickStats,
  renderLanguageBreakdown,
  renderScatter,
  renderHistogram,
  renderMoodBoard,
  renderHeatmap,
  renderVintage,
  renderDecade,
  renderPie,
  renderFicBar,
  _resolveWordCounts,
  migrateWordCounts,
  _populateAuthorMeta,
  analyzeAuthors,
  renderDotMatrix,
  renderClosingStrip,
  openWrapped,
  openYearInReview: openWrapped,
  closeWrapped,
  _refreshWrappedBOTY,
  _wrappedChangeBOTYClick,
  wrappedNext,
  wrappedPrev,
  _goToWrappedSlide,
  _archetypeIcon,
  _computePersonality,
  _literaryEquivalents,
  _analyzeWrapped,
  _buildWrappedSlides,
  _animateWrappedSlide,
  _fireWrappedConfetti,
  downloadWrappedImage,
  shareWrappedText,
  quickShareWrapped,
  openWrappedShare,
  toggleWrappedChip,
  _updateWrappedChipCount,
  closeWrappedShareModal,
  confirmWrappedShare,
  _generateClubRecap,
  _showRecapModal,
  downloadRecapImage,
  openMonthlyRecap,
  _computeAllTimeStreak,
  _showStreakNudge,
  _escapeHtml: esc,
  shareShelf,
  shareDisplayName,
  openShareMenu,
  closeShareMenu,
  closeShareDrawer,
  sortBooksChronological,
  _shareBooks,
  _sharePayload,
  _shareLink,
  copyShareLink,
  _roundRectPath,
  _drawCanvasCrown,
  _shade,
  _drawShareShelf,
  _renderShareCanvas,
  shareDownloadImage,
  shareInstagramStories,
  shareToPlatform
};

export default Stats;
