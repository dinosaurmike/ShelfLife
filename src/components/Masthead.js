/**
 * src/components/Masthead.js
 * Masthead Hero Metrics, Reading Goal Bar, Currently Reading, and To-Read Shelf Module
 */

import { SYMBOLS } from '../constants/symbols.js';
import { isAppAdmin } from '../utils/constants.js';

export function fmtWords(n) {
  if (typeof n !== 'number' || isNaN(n)) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';
  if (n >= 1000) return Math.round(n / 1000) + 'k';
  return String(n);
}

export function renderMastheadStats(appInstance, BOOKS) {
  const app = appInstance || (typeof window !== 'undefined' ? window.App : null);
  if (!app) return;

  const el = document.getElementById('mastheadRight');
  if (!el) return;

  el.innerHTML = '';

  const booksList = BOOKS || [];

  if (!booksList.length) {
    const msg = app.isReadOnly
      ? 'This shelf has no books yet.'
      : 'No books yet this year. Tap the <strong>+</strong> button to add your first book!';

    el.innerHTML = `<div style="padding:20px;color:var(--wood-light);font-style:italic;text-align:center;">${msg}</div>`;
    renderReadingGoal(app, []);
    return;
  }

  const RAW_BOOKS = (app && app._rawBooks) ? app._rawBooks : booksList;
  const isAgg = booksList.length > 0 && booksList[0].isAggregateYear;
  const trueTotalBooks = isAgg ? booksList.reduce((s, b) => s + (b.bookCount || 1), 0) : RAW_BOOKS.length;
  
  const statsSource = isAgg ? RAW_BOOKS : booksList;

  const totalWords = statsSource.reduce((s, b) => s + (Number(b.words) || 0), 0);
  const avgDays = (statsSource.reduce((s, b) => s + (Number(b.days) || 0), 0) / Math.max(1, statsSource.length)).toFixed(1);
  const mWords = fmtWords(totalWords);
  const uniqueAuthors = new Set(statsSource.map(b => b.author).filter(Boolean)).size;

  const authorCounts = {};
  statsSource.forEach(b => {
    if (b.author) authorCounts[b.author] = (authorCounts[b.author] || 0) + 1;
  });

  const topAuthor = Object.entries(authorCounts).sort((a, b) => b[1] - a[1])[0];
  const pctPos = Math.round(statsSource.filter(b => b.sentiment === 'love' || b.sentiment === 'like').length / Math.max(1, statsSource.length) * 100);
  const pctLoved = Math.round(statsSource.filter(b => b.sentiment === 'love').length / Math.max(1, statsSource.length) * 100);
  const overallWpd = Math.round(totalWords / Math.max(1, statsSource.reduce((s, b) => s + (Number(b.days) || 0), 0)));

  function tickUp(element, endVal, suffix, duration) {
    duration = duration || 1200;
    const numStr = String(endVal);
    const numMatch = numStr.match(/^([\d.]+)/);
    if (!numMatch) { element.textContent = endVal; return; }

    const target = parseFloat(numMatch[1]);
    const isFloat = numMatch[1].includes('.');
    const decimals = isFloat ? (numMatch[1].split('.')[1] || '').length : 0;
    suffix = suffix || numStr.replace(/^[\d.]+/, '') || '';
    const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

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

      if (progress < 1 && typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(update);
      }
    }

    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(update);
    } else {
      update(startTime + duration);
    }
  }

  const animTargets = [];

  function statCol(hero, heroSize, heroLbl, sub, subLbl, extraClass = '') {
    const col = document.createElement('div');
    col.className = 'masthead-stat-col' + (extraClass ? ' ' + extraClass : '');
    col.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start;flex:0 0 15%;padding-right:18px;box-sizing:border-box;';

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

  function vRule(extraClass = '') {
    const d = document.createElement('div');
    d.className = 'masthead-vrule' + (extraClass ? ' ' + extraClass : '');
    d.style.cssText = 'width:1px;background:rgba(61,43,31,0.1);align-self:stretch;flex-shrink:0;margin-right:28px;';
    return d;
  }

  const crCount = (app.books || []).filter(b => b.currentlyReading || b.status === 'reading').length;
  const crLineEl = document.getElementById('mastheadCRLine');
  if (crLineEl) { crLineEl.style.display = 'none'; crLineEl.textContent = ''; }

  const booksCol = statCol(trueTotalBooks, 48, 'books read', avgDays + ' days', 'avg. per book');

  if (crCount) {
    const crLine = document.createElement('div');
    crLine.style.cssText = "font-family:'DM Mono',monospace;font-size:10px;letter-spacing:0.12em;color:var(--text-muted);margin-top:6px;white-space:nowrap;";
    crLine.textContent = `[${SYMBOLS.BOOKS.OPEN_BOOK} ${crCount} now reading]`;

    const lbl = booksCol.children[1];
    if (lbl && lbl.nextSibling) {
      booksCol.insertBefore(crLine, lbl.nextSibling);
    } else {
      booksCol.appendChild(crLine);
    }
  }

  el.appendChild(booksCol);
  el.appendChild(vRule('masthead-advanced-stat'));
  el.appendChild(statCol(mWords, 34, 'words read', overallWpd.toLocaleString(), 'avg. words / day', 'masthead-advanced-stat'));
  el.appendChild(vRule('masthead-advanced-stat'));
  el.appendChild(statCol(uniqueAuthors, 34, 'unique authors', topAuthor ? topAuthor[0].split(' ').pop() + ' ×' + topAuthor[1] : ' - ', 'most read', 'masthead-advanced-stat'));

  const crBooksList = (app.books || []).filter(b => b && (b.currentlyReading || b.status === 'reading') && b.status !== 'to-read');
  const tbrBooksList = (app.toReadBooks && app.toReadBooks.length)
    ? app.toReadBooks
    : (app.books || []).filter(b => b && b.status === 'to-read');

  const escapeFn = (typeof app._escapeHtml === 'function') ? app._escapeHtml.bind(app) : (s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]));

  el.appendChild(vRule());
  const col4 = document.createElement('div');
  col4.className = 'masthead-stat-col';
  col4.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start;flex:1;padding-right:18px;min-width:0;';
  col4.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center; width:100%; margin-bottom:8px;"><div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.05em;color:var(--wood-mid);font-weight:700;">${SYMBOLS.BOOKS.OPEN_BOOK} Currently Reading</div><button style="background:none; border:1px solid rgba(61,43,31,0.15); border-radius:4px; padding:2px 8px; font-size:12px; font-weight:700; color:var(--wood-dark); cursor:pointer;" onclick="App.openAddBookModalFromMenu()">+</button></div>` +
    (crBooksList.length ? crBooksList.map(b => {
      const cover = b.coverUrl || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='90'%3E%3Crect width='100%25' height='100%25' fill='%23e0d8c8'/%3E%3Ctext x='50%25' y='50%25' font-size='10' text-anchor='middle' dominant-baseline='middle' fill='%23888'%3ENo Cover%3C/text%3E%3C/svg%3E";
      return '<div style="display:flex; gap:12px; margin-bottom:8px; align-items:center; cursor:pointer; padding:6px; border-radius:6px; transition:background 0.2s; width:100%; box-sizing:border-box;" onclick="App.openEditModal(\'' + b.id + '\')" class="cr-card-hover">' +
        '<img src="' + cover + '" style="width:36px; height:54px; object-fit:cover; border-radius:4px; box-shadow:0 2px 4px rgba(0,0,0,0.1);">' +
        '<div style="min-width:0; overflow:hidden;"><div style="font-weight:600; font-size:13px; font-family:\'DM Serif Display\',serif; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="' + escapeFn(b.title) + '">' + SYMBOLS.BOOKS.OPEN_BOOK + ' ' + escapeFn(b.title) + '</div>' +
        '<div style="font-size:11px; color:var(--text-muted); font-family:\'DM Mono\',monospace; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' + escapeFn(b.author) + '</div></div></div>';
    }).join('') : '<div style="font-size:12px; color:var(--wood-light); padding:10px; border:1px dashed rgba(61,43,31,0.1); border-radius:6px; cursor:pointer; width:100%; text-align:center;" onclick="App.openAddBookModalFromMenu()">+ Add Book</div>');
  el.appendChild(col4);

  el.appendChild(vRule());
  const col5 = document.createElement('div');
  col5.className = 'masthead-stat-col';
  col5.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start;flex:1;padding-right:18px;min-width:0;';
  col5.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center; width:100%; margin-bottom:8px;"><div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.05em;color:var(--wood-mid);font-weight:700;">${SYMBOLS.BOOKS.BOOKS_STACK} To-Read <span style="opacity:0.6;font-weight:normal;font-size:0.65rem;">(` + tbrBooksList.length + ')</span></div><button style="background:none; border:1px solid rgba(61,43,31,0.15); border-radius:4px; padding:2px 6px; font-size:10px; color:var(--wood-dark); cursor:pointer;" onclick="App.openTbrManager()">Manage</button></div>' +
    (tbrBooksList.length ? tbrBooksList.slice(0, 2).map(b => {
      const cover = b.coverUrl || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='90'%3E%3Crect width='100%25' height='100%25' fill='%23e0d8c8'/%3E%3Ctext x='50%25' y='50%25' font-size='10' text-anchor='middle' dominant-baseline='middle' fill='%23888'%3ENo Cover%3C/text%3E%3C/svg%3E";
      return '<div style="display:flex; gap:12px; margin-bottom:8px; align-items:center; cursor:pointer; padding:6px; border-radius:6px; transition:background 0.2s; width:100%; box-sizing:border-box;" onclick="App.openEditModal(\'' + b.id + '\')" class="cr-card-hover">' +
        '<img src="' + cover + '" style="width:36px; height:54px; object-fit:cover; border-radius:4px; box-shadow:0 2px 4px rgba(0,0,0,0.1);">' +
        '<div style="min-width:0; overflow:hidden;"><div style="font-weight:600; font-size:13px; font-family:\'DM Serif Display\',serif; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="' + escapeFn(b.title) + '">' + SYMBOLS.BOOKS.BOOKS_STACK + ' ' + escapeFn(b.title) + '</div>' +
        '<div style="font-size:11px; color:var(--text-muted); font-family:\'DM Mono\',monospace; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' + escapeFn(b.author) + '</div></div></div>';
    }).join('') : '<div style="font-size:12px; color:var(--wood-light); padding:10px; border:1px dashed rgba(61,43,31,0.1); border-radius:6px; cursor:pointer; width:100%; text-align:center;" onclick="App.openTbrManager()">Manage Queue</div>') +
    (tbrBooksList.length > 2 ? '<div style="font-size:10px; color:var(--wood-light); cursor:pointer; margin-top:4px; text-align:center; width:100%;" onclick="App.openTbrManager()">+ ' + (tbrBooksList.length - 2) + ' more</div>' : '');
  el.appendChild(col5);

  el.appendChild(vRule());
  const col6 = document.createElement('div');
  const isCozy = (typeof window !== 'undefined' && window.App && window.App.cozyMode) || (typeof document !== 'undefined' && document.body && document.body.classList.contains('cozy-mode'));
  const monthlyLabel = isCozy ? 'This Month' : 'Monthly Recap';
  const yearLabel = isCozy ? 'My Year in Books' : 'Year in Review';

  col6.className = 'masthead-stat-col';
  col6.style.cssText = 'display:flex;flex-direction:column;align-items:stretch;justify-content:space-between;flex:0 0 130px;min-width:130px;gap:8px;';
  col6.innerHTML = '<button id="monthlyRecapBtn" onclick="App.openMonthlyRecap()" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;background:var(--highlight);color:var(--wood-dark);border:none;border-radius:6px;padding:12px 8px;font-size:12px;font-weight:bold;cursor:pointer;box-shadow:0 2px 4px rgba(0,0,0,0.1);"><span style="font-size:22px;line-height:1;">&#128197;</span><span class="recap-btn-label" style="line-height:1.1;">' + monthlyLabel + '</span></button>' +
                   '<button id="yearInReviewBtn" onclick="App.openWrapped()" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;background:var(--highlight);color:var(--wood-dark);border:none;border-radius:6px;padding:12px 8px;font-size:12px;font-weight:bold;cursor:pointer;box-shadow:0 2px 4px rgba(0,0,0,0.1);"><span style="font-size:22px;line-height:1;">&#127873;</span><span class="review-btn-label" style="line-height:1.1;">' + yearLabel + '</span></button>';
  el.appendChild(col6);

  animTargets.forEach((item, idx) => {
    setTimeout(() => tickUp(item.el, item.val + item.suffix, item.suffix, 1500), idx * 150);
  });

  renderReadingGoal(app, booksList);
}

export function renderReadingGoal(appInstance, BOOKS) {
  const app = appInstance || (typeof window !== 'undefined' ? window.App : null);
  if (!app) return;

  const goalEl = document.getElementById('mastheadGoal');
  if (!goalEl) return;

  const year = app.currentYear || new Date().getFullYear();
  const isAgg = app.multiYearRange && app.multiYearRange !== 'single';
  let target = isAgg
    ? (app.aggregateGoal || 0)
    : ((app.readingGoals && app.readingGoals[year]) ? app.readingGoals[year] : 0);

  const booksList = BOOKS || [];
  const read = isAgg
    ? (app.aggregateBooks || []).filter(b => !b.currentlyReading && !b.dnf).length
    : booksList.length;

  if (app.isReadOnly || !target) {
    goalEl.style.display = 'none';
    if (typeof app._updateStatusBar === 'function') app._updateStatusBar();
    goalEl.innerHTML = '';
    return;
  }

  const pct = Math.min(100, Math.round((read / target) * 100));
  const done = read >= target;
  const now = new Date();
  const isCurrentYear = !isAgg && (year === now.getFullYear());

  let badge = '';
  if (done) {
    badge = `<span class="goal-pace-badge goal-pace-done">${SYMBOLS.ACHIEVEMENTS.PARTY_POPPER} Goal reached</span>`;
  } else if (isCurrentYear) {
    const dayOfYear = Math.floor((now - new Date(year, 0, 0)) / 86400000);
    const daysInYear = ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) ? 366 : 365;
    const expected = target * (dayOfYear / daysInYear);

    if (read >= expected + 1) {
      const aheadByDays = Math.floor((read - expected) / (target / daysInYear));
      badge = `<span class="goal-pace-badge goal-pace-ahead">▲ +${aheadByDays}d ahead</span>`;
    } else if (read >= expected - 1) {
      badge = `<span class="goal-pace-badge goal-pace-ontrack">${SYMBOLS.ACHIEVEMENTS.TARGET} On track</span>`;
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
        <span class="goal-bar-title">${SYMBOLS.BOOKS.BOOKS_STACK || '📚'} ${typeof isAgg !== "undefined" && isAgg ? (app.multiYearRange === "lifetime" ? "Lifetime Goal" : `${app.multiYearRange}-Year Goal`) : `${year} Goal`}</span>
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
    </div>
  `;

  // Goal bar is now statically pre-filled in HTML to prevent CSS animation bugs on some browsers.

  if (typeof app._updateStatusBar === 'function') {
    app._updateStatusBar();
  }
}

export function renderCurrentlyReading(appInstance, crBooks) {
  const app = appInstance || (typeof window !== 'undefined' ? window.App : null);
  const sec = document.getElementById('currentlyReadingSection');
  const wrap = document.getElementById('crBooks');
  if (!sec || !wrap) return;

  if (!crBooks || !crBooks.length) {
    sec.style.display = 'none';
    return;
  }

  sec.style.display = 'block';
  const canEdit = !app?.isReadOnly;
  const escapeFn = (typeof app?._escapeHtml === 'function') ? app._escapeHtml.bind(app) : (s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]));

  wrap.innerHTML = crBooks.map(b => {
    const cover = b.coverUrl || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="90"><rect width="100%" height="100%" fill="%23e0d8c8"/><text x="50%" y="50%" font-size="10" text-anchor="middle" dominant-baseline="middle" fill="%23888">No Cover</text></svg>';
    return '<div style="display:flex; gap:12px; margin-top:12px; align-items:center; cursor:pointer; padding:6px; border-radius:6px; transition:background 0.2s;" ' + (canEdit ? 'onclick="App.openEditModal(\'' + b.id + '\')"' : '') + ' class="cr-card-hover">' +
      '<img src="' + cover + '" style="width:40px; height:60px; object-fit:cover; border-radius:4px; box-shadow:0 2px 4px rgba(0,0,0,0.1);">' +
      '<div><div style="font-weight:600; font-size:14px; font-family:\'DM Serif Display\',serif;">' + escapeFn(b.title) + '</div>' +
      '<div style="font-size:11px; color:var(--text-muted); font-family:\'DM Mono\',monospace;">' + escapeFn(b.author) + '</div></div></div>';
  }).join('');
}

export function renderToReadShelf(appInstance, toReadBooks) {
  const app = appInstance || (typeof window !== 'undefined' ? window.App : null);
  const sec = document.getElementById('toReadSection');
  if (!sec) return;

  const list = (toReadBooks && toReadBooks.length)
    ? toReadBooks
    : (app?.toReadBooks && app.toReadBooks.length)
      ? app.toReadBooks
      : (app?.books || []).filter(b => b && b.status === 'to-read');

  if (!list || !list.length) {
    sec.style.display = 'block';
    sec.innerHTML = `<h3>${SYMBOLS.BOOKS.HOURGLASS_DONE} To-Read</h3><div style="font-size:12px;color:var(--wood-light);padding:16px;background:rgba(61,43,31,0.02);border:1px dashed rgba(61,43,31,0.1);border-radius:6px;text-align:center;margin-top:10px;">Your to-read list is empty.</div>`;
    return;
  }

  sec.style.display = '';
  const canEdit = !app?.isReadOnly;
  const escapeFn = (typeof app?._escapeHtml === 'function') ? app._escapeHtml.bind(app) : (s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]));

  const cards = list.map(b => {
    const cover = b.coverUrl
      ? `<img loading="lazy" decoding="async" class="trc-cover" src="${b.coverUrl}" onerror="if(this&&this.style)this.style.display='none';">`
      : `<div class="trc-cover">${SYMBOLS.BOOKS.OPEN_BOOK}</div>`;
    const lang = (b.language && b.language !== 'English' && typeof languageBadge === 'function') ? languageBadge(b.language) : '';
    const notes = b.toReadNotes ? `<div class="trc-notes" title="${escapeFn(b.toReadNotes)}">${escapeFn(b.toReadNotes)}</div>` : '';
    const actions = canEdit ? `<div class="trc-actions">
      <button class="trc-btn primary" style="background:rgba(59,130,246,0.15);color:#3b82f6;border-color:transparent;" onclick="App._markAsCurrentlyReading('${b.id}')" title="Mark as currently reading">${SYMBOLS.BOOKS.OPEN_BOOK} Reading</button>
      <button class="trc-btn" onclick="App.openEditModal(window.App._findBookById('${b.id}'))" title="Edit">${SYMBOLS.BOOKS.PENCIL} Edit</button>
    </div>` : '';
    return `<div class="to-read-card">
      ${cover}
      <div class="trc-body">
        <div class="trc-title">${escapeFn(b.title || 'Untitled')}</div>
        <div class="trc-author">${escapeFn(b.author || 'Unknown')}${lang ? ' ' + lang : ''}</div>
        ${notes}
        ${actions}
      </div>
    </div>`;
  }).join('');

  sec.innerHTML = `<div class="to-read-head" style="display:flex;align-items:center;"><span style="font-size:20px;margin-right:6px;">${SYMBOLS.BOOKS.BOOKMARK}</span><span class="trh-title" style="flex:1;">To-Read List <span class="trh-count" style="margin-left:6px;font-weight:normal;opacity:0.8;">${list.length} book${list.length !== 1 ? 's' : ''}</span></span><button class="btn" style="padding:4px 10px;font-size:11px;" onclick="App.openTbrManager()">Manage Queue</button></div><div class="to-read-grid">${cards}</div>`;
}

export async function markToReadFinished(appInstance, bookId) {
  const app = appInstance || (typeof window !== 'undefined' ? window.App : null);
  if (!app) return;

  const idx = (app.books || []).findIndex(b => String(b.id) === String(bookId));
  if (idx === -1) return;

  const book = app.books[idx];
  book.status = 'finished';
  book.currentlyReading = false;

  const ALL_MONTHS_LIST = typeof ALL_MONTHS !== 'undefined' ? ALL_MONTHS : ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const targetMonth = ALL_MONTHS_LIST[new Date().getMonth()];
  book.month = targetMonth;
  book.month_finished = targetMonth;
  book.dateFinished = new Date().toISOString().split('T')[0];
  book.date_finished = book.dateFinished;

  try {
    if (typeof DB !== 'undefined' && DB.updateBook) {
      await DB.updateBook(book.id, {
        status: 'finished',
        currently_reading: false,
        month_finished: targetMonth,
        date_finished: book.dateFinished
      });
    }
  } catch (e) {
    console.warn('markToReadFinished update failed:', e && e.message);
  }

  if (typeof app._placeBookAtEndOfMonth === 'function') {
    await app._placeBookAtEndOfMonth(bookId, targetMonth);
  }

  if (typeof app.render === 'function') app.render();
  if (typeof app.showToast === 'function') {
    app.showToast(`${SYMBOLS.NAVIGATION.CHECK} Moved "${book.title}" to your shelf - add your rating!`);
  }
  if (typeof app.openEditModal === 'function') {
    app.openEditModal(book);
  }
}

export function updateMastheadTitle(appInstance) {
  const app = appInstance || (typeof window !== 'undefined' ? window.App : null);
  if (!app) return;

  const isAdmin = isAppAdmin(app);
  const lwb = document.getElementById('laserWaitlistBtn');
  if (lwb) lwb.style.display = isAdmin ? 'inline-flex' : 'none';

  const year = app.currentYear || new Date().getFullYear();
  const range = app.multiYearRange || 'single';

  const titleMap = {
    'single': `Reading <em>Record (${year})</em>`,
    '3': 'Reading <em>Record (Last 3 Years)</em>',
    '5': 'Reading <em>Record (Last 5 Years)</em>',
    '10': 'Reading <em>Record (Last 10 Years)</em>',
    '15': 'Reading <em>Record (Last 15 Years)</em>',
    'lifetime': 'Reading <em>Record (Lifetime)</em>'
  };
  const wmMap = {
    'single': String(year),
    '3': '3Y',
    '5': '5Y',
    '10': '10Y',
    '15': '15Y',
    'lifetime': 'ALL'
  };

  const mt = document.getElementById('mastheadTitle');
  if (mt) mt.innerHTML = titleMap[range] || `Reading <em>Record (${year})</em>`;

  const yrWm = document.getElementById('yearWatermark');
  if (yrWm) yrWm.textContent = wmMap[range] || String(year);
}

export function initMasthead(appInstance) {
  const app = appInstance || (typeof window !== 'undefined' ? window.App : null);
  if (!app) return;

  app.renderMastheadStats = (books) => renderMastheadStats(app, books);
  app.renderReadingGoal = (books) => renderReadingGoal(app, books);
  app.renderCurrentlyReading = (crBooks) => renderCurrentlyReading(app, crBooks);
  app.renderToReadShelf = (toReadBooks) => renderToReadShelf(app, toReadBooks);
  app.markToReadFinished = (bookId) => markToReadFinished(app, bookId);
  app.updateMastheadTitle = () => updateMastheadTitle(app);
}
