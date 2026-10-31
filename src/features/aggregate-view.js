import { fmtWords, sColor } from "../utils/math.js";
import { ALL_MONTHS, COLORS, GENRE_COLORS, LABELS } from "../utils/constants.js";
import { showChartTT, hideChartTT, moveChartTT , initShelfScrolling, updateShelfScrollIndicators } from "../utils/dom.js";
import { WikidataAPI } from "./search.js";

export const aggregateViewMethods = {
renderAggregateView() {
  if (this.multiYearRange === 'lifetime') {
    const wm = document.getElementById('yearWatermark');
    if (wm) wm.textContent = 'ALL';
    const mt = document.getElementById('mastheadTitle');
    if (mt) mt.innerHTML = 'Reading <em>Record (Lifetime)</em>';
  } else {
    const wm = document.getElementById('yearWatermark');
    if (wm) wm.textContent = `${this.multiYearRange}Y`;
    const mt = document.getElementById('mastheadTitle');
    if (mt) mt.innerHTML = `Reading <em>Record (Last ${this.multiYearRange} Years)</em>`;
  }

 this._renderAggStats();

 this._renderYearBookShelf();

 this._renderAggCharts();
 
 this.renderHomeQuickStats(this.aggregateBooks);
 this.renderMastheadStats(this.aggregateBooks);
 this.renderPaceLine(this.aggregateBooks);
 const paceTitle = document.querySelector('#paceLineModule .pace-module-title');
 if (paceTitle) paceTitle.textContent = 'Yearly Pace';

 },

 _renderAggStats() {
 
 let _val = 'All Years'; if (this.multiYearRange === 'lifetime') _val = 'LIFETIME'; else if (this.multiYearRange && this.multiYearRange !== 'single') _val = 'Last ' + this.multiYearRange + ' Years'; document.getElementById('yearInput').value = _val;
 const crSec = document.getElementById('currentlyReadingSection');
 if (crSec) crSec.style.display = 'none';
 const trSec = document.getElementById('toReadSection');
 if (trSec) trSec.style.display = 'none';
 const mRecap = document.getElementById('monthlyRecapSection');
 if (mRecap) mRecap.style.display = 'none';
 const yRecap = document.getElementById('yearlyRecapSection');
 if (yRecap) yRecap.style.display = 'none';

 const container = document.getElementById('aggStatsCards');

 if (!container) return;

 container.innerHTML = '';

 const books = this.aggregateBooks.filter(b => !b.currentlyReading && !b.dnf);

 if (!books.length) {

 container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--wood-light);font-style:italic;">No books in this date range.</div>';

 return;

 }

 const totalWords = books.reduce((s, b) => s + b.words, 0);

 const totalPages = books.reduce((s, b) => s + (b.pageCount || Math.round(b.words / 300)), 0);

 const uniqueAuthors = new Set(books.map(b => b.author)).size;

 const audiobooks = books.filter(b => b.format === 'audiobook');

 const totalHours = audiobooks.reduce((s, b) => s + (b.durationHours || 0), 0);

 const avgDays = books.length ? (books.reduce((s, b) => s + b.days, 0) / books.length).toFixed(1) : ' - ';

 const yearsActive = Object.keys(this.aggregateYearData).length;

 const avgPerYear = yearsActive ? Math.round(books.length / yearsActive) : books.length;

 const pctPositive = Math.round(books.filter(b => b.sentiment === 'love' || b.sentiment === 'like').length / books.length * 100);

 const rereads = books.filter(b => b.isReread).length;

 const dnfBooks = this.aggregateBooks.filter(b => b.dnf);

 const rangeLbl = (this.multiYearRange === 'lifetime') ? 'Lifetime books' : (this.multiYearRange && this.multiYearRange !== 'single') ? `${this.multiYearRange}-Year books` : 'books read';

 const stats = [

 { num: books.length, lbl: rangeLbl, sub: yearsActive + ' year' + (yearsActive !== 1 ? 's' : '') },

 { num: fmtWords(totalWords), lbl: 'words read', sub: 'across all titles' },

 { num: avgPerYear, lbl: 'yearly pace', sub: avgDays + ' days/book' },

 { num: uniqueAuthors, lbl: 'authors', sub: pctPositive + '% positive' },

 ];

 if (totalHours > 0) stats.push({ num: Math.round(totalHours) + 'h', lbl: 'listened', sub: audiobooks.length + ' audiobooks' });

 if (rereads > 0) stats.push({ num: rereads, lbl: 're-reads', sub: 'books revisited' });

 if (dnfBooks.length > 0) stats.push({ num: dnfBooks.length, lbl: 'DNF', sub: 'did not finish' });

 const grid = document.createElement('div');

 grid.className = 'agg-stats-grid';

 stats.forEach(s => {

 grid.innerHTML += `<div class="agg-stat-card"><span class="agg-stat-num">${s.num}</span><span class="agg-stat-lbl">${s.lbl}</span><span class="agg-stat-sub">${s.sub}</span></div>`;

 });

 container.appendChild(grid);

 const thisYearBooks = (this.aggregateYearData[this.currentYear] || { books: [] }).books.filter(b => !b.dnf);

 if (thisYearBooks.length && books.length > thisYearBooks.length) {

 const avgLifetime = avgPerYear;

 const diff = thisYearBooks.length - avgLifetime;

 const pct = Math.round(Math.abs(diff) / Math.max(1, avgLifetime) * 100);

 const trend = diff > 0 ? '��' : diff < 0 ? '��' : '-';

 const insight = document.createElement('div');

 insight.style.cssText = "text-align:center;padding:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-style:italic;color:var(--wood-mid);margin-bottom:16px;pointer-events:none;";

 insight.textContent = `${trend} This year: ${thisYearBooks.length} books  -  ${diff >= 0 ? '+' : ''}${diff} (${pct}%) vs lifetime average of ${avgLifetime}/year`;

 container.appendChild(insight);

 }

 },

 _renderYearBookShelf() {

 const booksRow = document.getElementById('aggBooksRow');

 const shelfBack = document.getElementById('aggShelfBack');

 const shelfPlank = document.getElementById('aggShelfPlank');

 const yAxis = document.getElementById('aggYAxis');

 const shelfUnit = document.getElementById('aggShelfUnit');

 if (!booksRow || !shelfBack || !shelfPlank || !yAxis || !shelfUnit) return;

 booksRow.innerHTML = '';

 shelfBack.innerHTML = '';

 shelfPlank.innerHTML = '';

 yAxis.innerHTML = '';

 shelfUnit.querySelectorAll('.agg-annotation-flag, svg[style*="z-index:150"]').forEach(e => e.remove());

 const yearKeys = [];

 for (let y = this._firstDataYear; y <= this._lastDataYear; y++) yearKeys.push(y);

 if (!yearKeys.length) return;

 const SHELF_H = 420, TOP_PAD = 60;

 yAxis.style.height = (SHELF_H + TOP_PAD + 48) + 'px';

 shelfUnit.style.minHeight = (SHELF_H + TOP_PAD + 48 + 300) + 'px';

 booksRow.style.height = (SHELF_H + TOP_PAD) + 'px';
 

 booksRow.style.alignItems = 'flex-end';
 booksRow.style.position = 'relative';

 const yearBooks = yearKeys.map(year => {

 const data = this.aggregateYearData[year];

 const books = data ? data.books.filter(b => !b.currentlyReading && !b.dnf) : [];

 if (!books.length) return { year, empty: true };

 const avgWords = books.reduce((s, b) => s + (Number(b.words) || 0), 0) / books.length;

 const avgDays = books.reduce((s, b) => s + (Number(b.days) || 0), 0) / books.length;

 const avgSentiment = (() => {

 const counts = { love: 0, like: 0, mixed: 0, dislike: 0 };

 books.forEach(b => counts[b.sentiment] = (counts[b.sentiment] || 0) + 1);

 return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];

 })();

 return { year, books, avgWords, avgDays, avgSentiment, bookCount: books.length, totalPages: books.reduce((s, b) => s + (b.pageCount || Math.round(b.words / 300)), 0), totalHours: books.filter(b => b.format === 'audiobook').reduce((s, b) => s + (b.durationHours || 0), 0) };

 });

 const nonEmpty = yearBooks.filter(y => !y.empty);

 if (!nonEmpty.length) return;

 const maxTotalWords = Math.max(...nonEmpty.map(y => y.books.reduce((s, b) => s + (Number(b.words)||0), 0)));
 const minTotalWords = Math.min(...nonEmpty.map(y => y.books.reduce((s, b) => s + (Number(b.words)||0), 0)));
 const maxAvgDays = Math.max(...nonEmpty.map(y => y.avgDays));
 const minAvgDays = Math.min(...nonEmpty.map(y => y.avgDays));
 const MIN_W = 70, MAX_W = 144;
 const MIN_H = 180, MAX_H = SHELF_H - 10;
 function yearToWidth(totalWords) {
   const t = maxTotalWords === minTotalWords ? 0.5 : (totalWords - minTotalWords) / (maxTotalWords - minTotalWords);
   return Math.round(MIN_W + t * (MAX_W - MIN_W));
 }

 function yearToHeight(avgDays) {

 const t = maxAvgDays === minAvgDays ? 0.5 : (avgDays - minAvgDays) / (maxAvgDays - minAvgDays);

 return Math.round(MIN_H + t * (MAX_H - MIN_H));

 }

 const tickVals = [minAvgDays];

 const range = maxAvgDays - minAvgDays;

 if (range > 0) {

 const step = Math.max(1, Math.round(range / 4));

 for (let v = minAvgDays + step; v < maxAvgDays; v += step) tickVals.push(Math.round(v));

 tickVals.push(maxAvgDays);

 }

 [...new Set(tickVals)].sort((a, b) => a - b).forEach(val => {

 const tick = document.createElement('div');

 tick.className = 'y-tick';

 const t = maxAvgDays === minAvgDays ? 0.5 : (val - minAvgDays) / (maxAvgDays - minAvgDays);

 const h = Math.round(MIN_H + t * (MAX_H - MIN_H));

 tick.style.cssText = `top:${TOP_PAD + SHELF_H - h}px;transform:translateY(-50%);right:8px;`;

 tick.textContent = Math.round(val) + ' days';

 yAxis.appendChild(tick);

 });

 const GAP = 10;

 let cumX = 14;

 yearBooks.forEach((yb, idx) => {

 if (idx > 0) {

 const gap = document.createElement('div');

 gap.style.cssText = `width:${GAP}px;flex-shrink:0;`;

 booksRow.appendChild(gap);

 cumX += GAP;

 }

 if (yb.empty) {

 const gapEl = document.createElement('div');

 gapEl.className = 'year-gap';

 gapEl.style.cssText = `width:20px;height:${SHELF_H + TOP_PAD}px;`;

 gapEl.innerHTML = `<span class="year-gap-label">${yb.year}</span>`;

 booksRow.appendChild(gapEl);

 const lbl = document.createElement('div');

 lbl.className = 'plank-label';

 lbl.style.cssText = `left:${cumX}px;width:20px;opacity:0.3;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;`;

 lbl.innerHTML = `<span class="plank-label-name" style="font-size:12px;">${yb.year}</span>`;

 shelfPlank.appendChild(lbl);

 cumX += 40;

 return;

 }

 const w = yearToWidth(yb.books.reduce((s, b) => s + (Number(b.words)||0), 0));

 const h = yearToHeight(yb.avgDays);

 const c = sColor(yb.avgSentiment, idx);

 const el = document.createElement('div');

 el.className = 'year-book book';

 el.dataset.year = yb.year;
 
 el.style.width = w + 'px';
 el.style.height = h + 'px';

 el.style.animation = `riseIn 0.35s ease ${idx * 60}ms both`;

 el.addEventListener('animationend', function () { this.style.animation = ''; }, { once: true });

 el.innerHTML = `<div class="spine" style="height:${h}px;width:${w}px;background:linear-gradient(168deg,${c}e0 0%,${c} 45%,${c}a8 100%);">

 <div class="spine-top-band" style="background:rgba(255,255,255,0.2);"></div>
 <div class="spine-inner"><span class="spine-title" style="font-size:${Math.max(16, Math.round(h * 0.05))}px;">${yb.year}</span></div>
 <div class="spine-top-band" style="background:rgba(255,255,255,0.2); position:absolute; bottom:8px; top:auto;"></div>

 </div>`;

 el.addEventListener('mouseenter', (e) => {
 try {
   const ALL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
   const genres = {};
   let validBooks = 0;
   let sumDays = 0;
   let sumSent = 0;
   let sumWords = 0;
   const monthCounts = {};
   
   yb.books.forEach(b => {
     if (b.genre) genres[b.genre] = (genres[b.genre] || 0) + 1;
     if (b.days) { sumDays += Number(b.days); validBooks++; }
     if (b.sentiment) sumSent += ({ love: 5, like: 4, mixed: 3, dislike: 2 }[b.sentiment] || 3);
     else sumSent += 3;
     if (b.month) monthCounts[b.month] = (monthCounts[b.month] || 0) + 1;
     if (b.words) sumWords += Number(b.words);
   });
   
   let topGenreStr = '';
   const genreEntries = Object.entries(genres).sort((a, b) => b[1] - a[1]);
   if (genreEntries.length > 0) {
     const topGenre = genreEntries[0];
     topGenreStr = `<b>Top genre:</b> ${topGenre[0]} (${Math.round(topGenre[1] / Math.max(1, yb.books.length) * 100)}%)<br>`;
   }
   
   const avgPace = validBooks > 0 ? (sumDays / validBooks).toFixed(1) : 0;
   const avgSent = yb.books.length > 0 ? (sumSent / yb.books.length) : 3;
   const stars = ''.repeat(Math.round(avgSent));
   
   const maxMC = Math.max(...Object.values(monthCounts), 1);
   const miniBarHtml = ALL_MONTHS.map(m => {
     const cnt = monthCounts[m] || 0;
     const barh = Math.round((cnt / maxMC) * 28);
     return `<div style="width:5px;height:${barh}px;background:${c};border-radius:1px;opacity:${cnt ? 0.8 : 0.15};"></div>`;
   }).join('');
   
   const wordStr = sumWords > 1000000 ? (sumWords/1000000).toFixed(1)+'M' : (sumWords > 1000 ? Math.round(sumWords/1000)+'k' : sumWords);
   const hrsStr = yb.totalHours > 0 ? ` &bull; ${Math.round(yb.totalHours)} hrs` : '';

   showChartTT(`<div class="ctt-title" style="font-size:16px;">${yb.year}: ${yb.books.length} books</div>
   <div class="ctt-body">
   ${yb.books.length} books &bull; ${wordStr} words${hrsStr}<br>
   <div style="display:flex;align-items:flex-end;gap:2px;margin:6px 0;height:30px;">${miniBarHtml}</div>
   ${topGenreStr}
   <b>Avg pace:</b> ${avgPace} days/book<br>
   <b>Sentiment:</b> ${stars}
   </div>`, e);
 } catch(err) {
   document.body.insertAdjacentHTML('afterbegin', '<div style="background:red;color:white;position:fixed;top:0;left:0;z-index:99999;padding:10px;">TT Error: ' + err.toString() + '</div>');
   console.error("Tooltip error:", err);
 }
});

 el.addEventListener('mousemove', (e) => moveChartTT(e));

 el.addEventListener('mouseleave', () => hideChartTT());

 el.addEventListener('click', () => this.openAggModal(yb.year));
 booksRow.appendChild(el);

 const maxCnt = Math.max(...yearBooks.filter(y => !y.empty).map(y => y.bookCount), 1);
 const bh = Math.round((yb.bookCount / maxCnt) * 60) + 12;

 const bookmark = document.createElement('div');
 bookmark.className = 'bookmark-strip';
 const totalWords = yb.books.reduce((s, b) => s + (Number(b.words)||0), 0);
 const wordRatio = maxTotalWords === minTotalWords ? 0.5 : (totalWords - minTotalWords) / (maxTotalWords - minTotalWords);
 const l1 = 70 - (wordRatio * 30);
 const l2 = 55 - (wordRatio * 30);
 
 // Bookmark width is constant (e.g. 50px) to fit inside the minimum book width (70px)
 const bkW = 50;
 
 bookmark.style.cssText = `position: absolute; top: 22px; clip-path: polygon(0 0, 100% 0, 100% 100%, 50% calc(100% - 20px), 0 100%); left: ${cumX + w/2 - (bkW/2)}px; width: ${bkW}px; height: ${Math.max(105, bh * 3)}px; background: linear-gradient(135deg, hsl(45, 100%, ${l1}%), hsl(45, 76%, ${l2}%)); z-index: 999; box-shadow: 0 8px 16px rgba(0,0,0,0.4), inset 0 0 0 2px rgba(255,255,255,0.3); transition: transform 0.2s; cursor: pointer;`;
 
const bmWords = yb.books.reduce((s,b)=>s+(Number(b.words)||0), 0);
const bmWordStr = bmWords > 1000000 ? (bmWords/1000000).toFixed(1)+'M' : (bmWords > 1000 ? Math.round(bmWords/1000)+'k' : bmWords);
bookmark.innerHTML = `<div style="position: absolute; top: 10px; left: 0; right: 0; text-align: center; color: #fff; font-size: 14px; font-weight: bold; text-shadow: 0 1px 2px rgba(0,0,0,0.6); display: flex; flex-direction: column; gap: 4px; line-height: 1;"><span>${yb.bookCount}<br><span style="font-size:10px;opacity:0.85;">BOOKS</span></span><div style="width:16px;height:1px;background:rgba(255,255,255,0.4);margin:0 auto;"></div><span>${bmWordStr}<br><span style="font-size:10px;opacity:0.85;">WORDS</span></span></div>`;

 bookmark.addEventListener('mouseenter', (e) => {
   const tw = yb.books.reduce((s,b)=>s+(Number(b.words)||0), 0);
   const wordStr = tw > 1000000 ? (tw/1000000).toFixed(1)+'M' : (tw > 1000 ? Math.round(tw/1000)+'k' : tw);
   const titleHtml = `<div class="ctt-title" style="font-size:16px;">${yb.year}: ${yb.bookCount} books</div>`;
   const bPace = (yb.books.reduce((s, b) => s + (Number(b.days)||0), 0) / Math.max(1, yb.books.length)).toFixed(1);
   showChartTT(titleHtml + `<div class="ctt-body">${wordStr} words<br>Avg pace: ${bPace} days/book</div>`, e);
});
 bookmark.addEventListener('mousemove', moveChartTT);
 bookmark.addEventListener('mouseleave', hideChartTT);
 shelfPlank.appendChild(bookmark);

 const lbl = document.createElement('div');
 lbl.className = 'plank-label';
 lbl.style.left = cumX + 'px';
 lbl.style.width = w + 'px';
 lbl.style.display = 'flex';
 lbl.style.flexDirection = 'column';
 lbl.style.alignItems = 'center';
 lbl.style.justifyContent = 'flex-start';
 lbl.style.opacity = '1';

 lbl.innerHTML = `
   <span class="plank-label-name" style="margin-bottom: 6px;">${yb.year}</span>
 `;

 shelfPlank.appendChild(lbl);

 cumX += w;

 });

 const spacer = document.createElement('div');

 spacer.style.cssText = 'width:80px;flex-shrink:0;';

 booksRow.appendChild(spacer);

 this._renderAggAnnotations(yearBooks.filter(y => !y.empty), shelfUnit, shelfBack, SHELF_H, TOP_PAD);
  if (typeof updateShelfScrollIndicators === 'function') updateShelfScrollIndicators();
  else if (typeof window !== 'undefined' && window.App && typeof window.App.updateShelfScrollIndicators === 'function') window.App.updateShelfScrollIndicators();
},

 _renderAggAnnotations(yearBooks, shelfUnit, shelfBack, SHELF_H, TOP_PAD) {

 if (yearBooks.length < 2) return;

 const annotations = [];

 const allBooks = this.aggregateBooks.filter(b => !b.currentlyReading && !b.dnf);

 const mostProlific = yearBooks.reduce((a, b) => b.bookCount > a.bookCount ? b : a);

 annotations.push({ title: '📚 Most Prolific', sub: mostProlific.bookCount + ' books in ' + mostProlific.year, year: mostProlific.year });

 const fastest = yearBooks.reduce((a, b) => b.avgDays < a.avgDays ? b : a);

 annotations.push({ title: '⚡ Fastest Year', sub: fastest.avgDays.toFixed(1) + 'd avg in ' + fastest.year, year: fastest.year });

 let cumBooks = 0;

 for (const yb of yearBooks) {

 cumBooks += yb.bookCount;

 if (cumBooks >= 100) {

 annotations.push({ title: '🏆 100th Book', sub: 'reached in ' + yb.year, year: yb.year });

 break;

 }

 }

 const authorCounts = {};

 allBooks.forEach(b => { authorCounts[b.author] = (authorCounts[b.author] || 0) + 1; });

 const topAuthor = Object.entries(authorCounts).sort((a, b) => b[1] - a[1])[0];

 if (topAuthor && topAuthor[1] >= 3) {

 const lastYearForAuthor = Math.max(...allBooks.filter(b => b.author === topAuthor[0]).map(b => {

 for (const [yr, data] of Object.entries(this.aggregateYearData)) {

 if (data.books.some(db => String(db.id) === String(b.id))) return parseInt(yr);

 }

 return this.currentYear;

 }));

 annotations.push({ title: '🌟 Superfan', sub: topAuthor[0].split(' ').pop() + ' ×' + topAuthor[1], year: lastYearForAuthor });

 }

 if (yearBooks.length >= 3) {

 const firstAvg = yearBooks[0].avgDays;

 const lastAvg = yearBooks[yearBooks.length - 1].avgDays;

 if (lastAvg < firstAvg * 0.8) {

 const pct = Math.round((1 - lastAvg / firstAvg) * 100);

 annotations.push({ title: '🚀 Speed Demon', sub: pct + '% faster over ' + yearBooks.length + ' yrs', year: yearBooks[yearBooks.length - 1].year });

 }

 }

 const dnfCount = this.aggregateBooks.filter(b => b.dnf).length;

 if (dnfCount === 0 && allBooks.length >= 20) {

 annotations.push({ title: '💎 DNF Avoider', sub: '0% DNF across ' + allBooks.length + ' books', year: yearBooks[yearBooks.length - 1].year });

 }

 const yearEls = shelfUnit.querySelectorAll('.year-book');

 const maxFlags = Math.min(annotations.length, 5);

 annotations.slice(0, maxFlags).forEach((ann, i) => {

 const yearEl = [...yearEls].find(el => parseInt(el.dataset.year) === ann.year);

 if (!yearEl) return;

 const flag = document.createElement('div');

 flag.className = 'agg-annotation-flag';

 flag.style.cssText = `top:${-70 - i * 52}px;left:${yearEl.offsetLeft - 10}px;`;

 flag.innerHTML = `<span class="shelf-annotation-title">${ann.title}</span><span class="shelf-annotation-sub">${ann.sub}</span>`;

 shelfUnit.appendChild(flag);

 });

 },

 _renderAggCharts() {

 const container = document.getElementById('aggCharts');

 if (!container) return;

 container.innerHTML = '';

 const books = this.aggregateBooks.filter(b => !b.currentlyReading && !b.dnf);

 if (!books.length) return;

 const yearsData = Object.entries(this.aggregateYearData).map(([yr, d]) => ({

 year: parseInt(yr),

 books: d.books.filter(b => !b.currentlyReading && !b.dnf)

 })).filter(y => y.books.length).sort((a, b) => a.year - b.year);

 let html = '<div class="section-divider" style="margin:24px 0 18px;"><div class="section-divider-line"></div><div class="section-divider-ornament">· · · Aggregate Insights · · ·</div><div class="section-divider-line"></div></div>';

 html += '<div class="stats-section" style="margin-top:20px;">';

 html += '<div class="zone"><div class="zone-header" style="padding-top:10px;"><div><div class="zone-question">Reading Velocity Over Time</div><div class="zone-tag">Books per Month</div></div></div>';

 html += '<div class="zone-grid-full"><div class="chart-tile"><div id="aggReadingVelocity" style="padding:16px 16px 8px;"></div></div></div>';

 html += '<div class="zone-divider"></div><div class="zone"><div class="zone-header"><div><div class="zone-question">The Breakdown</div><div class="zone-tag">All-Time Genre &amp; Authorship</div></div></div>';

 html += '<div class="zone-grid-full"><div class="chart-tile" style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;"><span class="chart-tile-title" style="align-self:flex-start;">Genre Breakdown (All Years)</span><div class="pie-wrap pie-wrap-big"><div id="aggPieCanvas" style="width:100%; max-width:480px; aspect-ratio: 1; flex-shrink:0;"></div><div class="pie-legend" id="aggPieLegend"></div></div></div></div>';

 html += '<div class="zone-grid-full" style="margin-top:1px;"><div class="chart-tile"><span class="chart-tile-title">Who wrote what I read (All Years)</span><div id="aggDotMatrix"></div></div></div>';

 html += '<div class="zone-divider"></div><div class="zone"><div class="zone-header"><div><div class="zone-question">Sentiment Over Time</div><div class="zone-tag">Year-by-Year Evolution</div></div></div>';

 html += '<div class="zone-grid-full"><div class="chart-tile"><div id="aggSentimentTrend" style="padding:16px;"></div></div></div></div>';

 html += '</div>';

 html += '<div class="section-divider" style="margin-top:24px;margin-bottom:24px;"><div class="section-divider-line"></div><div class="section-divider-ornament">❧</div><div class="section-divider-line"></div></div>';

 html += '<div class="headline-strip" id="aggClosingStrip" style="margin-top:0;border-radius:3px;"></div>';

 html += '<div style="text-align:center;margin-top:32px;padding-bottom:48px;"><div style="font-family:\'Playfair Display\',serif;font-size:14.5px;color:rgba(139,99,67,0.5);letter-spacing:0.08em;">Be true to your<em>shelf</em> ☕📚</div><div style="margin-top:16px;font-family:\'DM Mono\',monospace;font-size:9px;letter-spacing:0.12em;color:rgba(61,43,31,0.22);">© 2026</div></div>';

 container.innerHTML = html;

 this._renderReadingVelocity(yearsData);

 this._renderAggPie(books);

 this._renderAggDotMatrix(books);

 this._renderAggSentimentTrend(yearsData);

 this._renderAggClosingStrip(books, yearsData);

 },

 _renderReadingVelocity(yearsData) {
 const container = document.getElementById('aggReadingVelocity');
 if (!container || !yearsData.length) return;
 const ALL_MO = ['January','February','March','April','May','June','July','August','September','October','November','December'];
 const MO_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
 const dataPoints = [];
 yearsData.forEach(yd => {
 ALL_MO.forEach((m, mi) => {
 const count = yd.books.filter(b => b.month === m).length;
 dataPoints.push({ year: yd.year, month: m, monthIdx: mi, count, label: MO_SHORT[mi] + ' \'' + String(yd.year).slice(-2) });
 });
 });
 if (!dataPoints.length) return;
 const W = 900, H = 220, PAD = { t: 20, r: 24, b: 44, l: 50 };
 const pw = W - PAD.l - PAD.r, ph = H - PAD.t - PAD.b;
 const maxCount = Math.max(...dataPoints.map(d => d.count), 1);
 const pts = dataPoints.map((d, i) => ({
 x: PAD.l + (i / Math.max(1, dataPoints.length - 1)) * pw,
 y: PAD.t + ph - (d.count / maxCount * ph),
 ...d
 }));
 function smoothPath(points) {
 if (points.length < 2) return '';
 let d = 'M ' + points[0].x + ' ' + points[0].y;
 for (let i = 0; i < points.length - 1; i++) {
 const p0 = points[Math.max(0, i - 1)];
 const p1 = points[i];
 const p2 = points[i + 1];
 const p3 = points[Math.min(points.length - 1, i + 2)];
 const t = 0.3;
 const cp1x = p1.x + (p2.x - p0.x) * t;
 const cp1y = p1.y + (p2.y - p0.y) * t;
 const cp2x = p2.x - (p3.x - p1.x) * t;
 const cp2y = p2.y - (p3.y - p1.y) * t;
 d += ' C ' + cp1x + ' ' + cp1y + ', ' + cp2x + ' ' + cp2y + ', ' + p2.x + ' ' + p2.y;
 }
 return d;
 }
 const linePath = smoothPath(pts);
 const uid = 'vel' + Date.now();
 let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;max-width:' + W + 'px;" preserveAspectRatio="xMidYMid meet">';
 svg += '<defs>';
 svg += '<linearGradient id="' + uid + 'fill" x1="0" y1="0" x2="0" y2="1">';
 svg += '<stop offset="0%" stop-color="#1e5c3a" stop-opacity="0.3"/>';
 svg += '<stop offset="60%" stop-color="#1c3f78" stop-opacity="0.1"/>';
 svg += '<stop offset="100%" stop-color="#1c3f78" stop-opacity="0.02"/>';
 svg += '</linearGradient>';
 svg += '<linearGradient id="' + uid + 'line" x1="0" y1="0" x2="1" y2="0">';
 svg += '<stop offset="0%" stop-color="#1e5c3a"/>';
 svg += '<stop offset="50%" stop-color="#1c3f78"/>';
 svg += '<stop offset="100%" stop-color="#1c3f78"/>';
 svg += '</linearGradient>';
 svg += '</defs>';
 const seenYears = new Set();
 for (let i = 0; i < 5; i++) {
 const val = Math.round(maxCount * i / 4);
 const y = PAD.t + ph - (val / maxCount * ph);
 svg += '<line x1="' + PAD.l + '" y1="' + y + '" x2="' + (W - PAD.r) + '" y2="' + y + '" stroke="rgba(61,43,31,0.06)" stroke-width="1"/>';
 svg += '<text x="' + (PAD.l - 10) + '" y="' + (y + 4) + '" text-anchor="end" fill="rgba(61,43,31,0.35)" font-size="10" font-family="DM Mono,monospace">' + val + '</text>';
 }
 if (pts.length >= 2) {
 const fillPath = linePath + ' L ' + pts[pts.length-1].x + ' ' + (PAD.t + ph) + ' L ' + pts[0].x + ' ' + (PAD.t + ph) + ' Z';
 svg += '<path d="' + fillPath + '" fill="url(#' + uid + 'fill)"/>';
 }
 svg += '<path d="' + linePath + '" fill="none" stroke="url(#' + uid + 'line)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>';
 const threshold = maxCount * 0.55;
 pts.forEach(p => {
 if (p.count >= threshold && p.count > 0) {
 svg += '<circle cx="' + p.x + '" cy="' + p.y + '" r="3.5" fill="#1c3f78" stroke="#faf5ee" stroke-width="2"/>';
 svg += '<text x="' + p.x + '" y="' + (p.y - 8) + '" text-anchor="middle" fill="rgba(61,43,31,0.65)" font-size="9" font-weight="700" font-family="Playfair Display,serif">' + p.count + '</text>';
 }
 });
 const step = Math.max(1, Math.ceil(pts.length / 18));
 pts.forEach((p, i) => {
 if (i % step === 0 || i === pts.length - 1) {
 svg += '<text x="' + p.x + '" y="' + (H - 8) + '" text-anchor="middle" fill="rgba(61,43,31,0.4)" font-size="8" font-family="DM Mono,monospace">' + p.label + '</text>';
 }
 });
 pts.forEach(p => {
 svg += `<circle cx="${p.x}" cy="${p.y}" r="12" fill="transparent" class="vel-pt" data-label="${p.label}" data-count="${p.count}"></circle>`;
 svg += `<circle cx="${p.x}" cy="${p.y}" r="3" fill="#1c3f78" pointer-events="none"></circle>`;
 });
 svg += '</svg>';
 const totalBooks = dataPoints.reduce((s, d) => s + d.count, 0);
 const avgPerMonth = (totalBooks / Math.max(1, dataPoints.length)).toFixed(1);
 const peakMonth = dataPoints.reduce((a, b) => b.count > a.count ? b : a);
 const insight = 'Average: ' + avgPerMonth + ' books/month &bull; Peak: ' + peakMonth.count + ' books in ' + peakMonth.month + ' ' + peakMonth.year;
 container.innerHTML = svg + '<div style="text-align:center;padding:8px 0 2px;font-family:\'DM Mono\',monospace;font-size:10px;letter-spacing:0.08em;color:rgba(92,61,42,0.5);">' + insight + '</div>';
 {
   const c = document.getElementById('aggReadingVelocity');
   if (c && !c.dataset.ttBound) {
     c.dataset.ttBound = 'true';
     c.addEventListener('mousemove', e => {
       const el = e.target.closest ? e.target.closest('.vel-pt') : null;
       if (el) {
         
         const lbl = el.getAttribute('data-label'); const ct = el.getAttribute('data-count');
         showChartTT(`<div class="ctt-title">${lbl}</div><div class="ctt-body">${ct} book${ct!=1?'s':''} read</div>`, e);

       } else {
         hideChartTT();
       }
     });
     c.addEventListener('mouseleave', () => hideChartTT());
   }
 }
 },

 _renderAggPie(books) {
 const container = document.getElementById('aggPieCanvas');
 const legend = document.getElementById('aggPieLegend');
 if (!container || !legend) return;
 const genreCounts = {};
 const genreBooks = {};
 books.forEach(b => {
   genreCounts[b.genre] = (genreCounts[b.genre] || 0) + 1;
   if (!genreBooks[b.genre]) genreBooks[b.genre] = [];
   genreBooks[b.genre].push(b);
 });
 const sorted = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]);
 if (!sorted.length) return;
 const total = books.length;
 const PALETTE = ['#1c3f78', '#1e5c3a', '#c89018', '#8c1a28', '#534AB7', '#0F6E56', '#993C1D', '#854F0B', '#6b3fa0', '#2e6b5a', '#4a6b1a'];
 const cx = 240, cy = 240, r = 200, innerR = r * 0.45;
 const slices = [];
 let startAngle = -Math.PI / 2;
 let svg = '<svg viewBox="0 0 480 480" width="100%" height="100%">';
 sorted.forEach(([genre, count], i) => {
   const sliceAngle = (count / total) * 2 * Math.PI;
   const col = GENRE_COLORS[genre] || PALETTE[i % PALETTE.length];
   const x1 = cx + r * Math.cos(startAngle);
   const y1 = cy + r * Math.sin(startAngle);
   const x2 = cx + r * Math.cos(startAngle + sliceAngle);
   const y2 = cy + r * Math.sin(startAngle + sliceAngle);
   const largeArc = sliceAngle > Math.PI ? 1 : 0;
   
   if (sliceAngle >= 2 * Math.PI - 0.001) {
     svg += `<circle class="pie-slice" data-genre="${genre}" data-count="${count}" cx="${cx}" cy="${cy}" r="${r}" fill="${col}"></circle>`;
   } else {
     svg += `<path class="pie-slice" data-genre="${genre}" data-count="${count}" d="M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z" fill="${col}"></path>`;
   }
   startAngle += sliceAngle;
 });
 svg += `<circle cx="${cx}" cy="${cy}" r="${innerR}" fill="#faf5ee" />`;
 svg += `<text x="${cx}" y="${cy}" font-family="Playfair Display" font-weight="900" font-size="32px" fill="rgba(61,43,31,0.9)" text-anchor="middle" dominant-baseline="central">Genres</text>`;
 svg += '</svg>';
 container.innerHTML = svg;
 {
   const c = document.getElementById('aggPieCanvas');
   if (c && !c.dataset.ttBound) {
     c.dataset.ttBound = 'true';
     c.addEventListener('mousemove', e => {

       
        let el = null;
        let curr = e.target;
        while(curr && curr !== c) {
            if (curr.classList && curr.classList.contains('pie-slice')) {
                el = curr;
                break;
            }
            if (curr.getAttribute && curr.getAttribute('class') === 'pie-slice') {
                el = curr;
                break;
            }
            curr = curr.parentNode;
        }

       if (el) {
         
         const g = el.dataset.genre; const ct = el.dataset.count;
         const col = GENRE_COLORS[g] || '#888';
         showChartTT(`<div class="ctt-title" style="color:${col}">${g}</div><div class="ctt-body">${ct} book${ct!=1?'s':''}</div>`, e);

       } else {
         hideChartTT();
       }
     });
     c.addEventListener('mouseleave', () => hideChartTT());
   }
 }
 const legendHtml = sorted.map(([genre, count], i) => {
   const col = GENRE_COLORS[genre] || PALETTE[i % PALETTE.length];
   const pct = Math.round(count / total * 100);
   return `<div class="pie-legend-item"><div class="pie-legend-swatch" style="background:${col};"></div><div class="pie-legend-label">${genre}</div><div class="pie-legend-val">${pct}%</div></div>`;
 }).join('');
 legend.innerHTML = legendHtml;
 },

 _renderAggDotMatrix(books) {

 const container = document.getElementById('aggDotMatrix');

 if (!container) return;

 container.innerHTML = '';

 const male = books.filter(b => b.authorGender && (b.authorGender.toLowerCase() === 'male'));

 const female = books.filter(b => b.authorGender && (b.authorGender.toLowerCase() === 'female'));

 const known = male.length + female.length;

 if (!known) {

 container.innerHTML = '<div style="padding:12px;text-align:center;font-size:11px;color:var(--wood-light);font-style:italic;">No demographics data available. Use Analyze Authors on individual years.</div>';

 return;

 }

 const mPct = Math.round(male.length / known * 100);

 const fPct = 100 - mPct;

 

  



  


  container.innerHTML = `

<div style="font-family:\'DM Mono\',monospace;font-size:8px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(92,61,42,0.38);margin-bottom:6px;">Gender (All Years)</div>

 <div id="aggGenderBar" style="display:flex;height:46px;border-radius:3px;overflow:hidden;">

 <div class="agg-gender-seg" data-gender="male" style="flex:${mPct};background:#2563a8;display:flex;align-items:center;padding:0 16px;cursor:pointer;transition:opacity 0.15s;" title="Male: ${male.length} books (${mPct}%)"><span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:20px;font-weight:900;color:rgba(255,255,255,0.93);">${mPct}%</span></div>

 <div class="agg-gender-seg" data-gender="female" style="flex:${fPct};background:#c2396b;display:flex;align-items:center;padding:0 16px;cursor:pointer;transition:opacity 0.15s;"><span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:20px;font-weight:900;color:rgba(255,255,255,0.93);">${fPct}%</span></div>

 </div>`;

 setTimeout(() => {

 const genderBar = document.getElementById('aggGenderBar');

 if (!genderBar) return;

 genderBar.querySelectorAll('.agg-gender-seg').forEach(seg => {

 const gender = seg.dataset.gender;

 const gBooks = gender === 'male' ? male : female;

 const pct = gender === 'male' ? mPct : fPct;

 const icon = gender === 'male' ? '♂' : '♀';

 seg.addEventListener('mouseenter', e => {

 seg.style.opacity = '0.85';

 const bookList = gBooks.slice(0, 10).map(b => `<div style="font-size:11px;margin-top:3px;"><span style="color:${COLORS[b.sentiment]};">●</span> ${b.title} <span style="color:var(--wood-light);font-size:10px;"> -  ${b.author}</span></div>`).join('');

 const more = gBooks.length > 10 ? `<div style="font-size:10px;color:var(--wood-light);margin-top:4px;">+ ${gBooks.length - 10} more</div>` : '';

 showChartTT(`<div class="ctt-title">${icon} ${gender.charAt(0).toUpperCase() + gender.slice(1)} Authors · ${pct}%</div><div class="ctt-body">${gBooks.length} book${gBooks.length!==1?'s':''}${bookList}${more}</div>`, e);

 });

 seg.addEventListener('mousemove', e => moveChartTT(e));

 seg.addEventListener('mouseleave', () => { seg.style.opacity = '1'; hideChartTT(); });

 });

 }, 50);

 const withRegion = books.filter(b => true); /* all books have a region (defaults to USA) */

 if (withRegion.length) {

 const regionBooks = {};

 withRegion.forEach(b => {

 const region = WikidataAPI.getBookRegion(b);

 if (!regionBooks[region]) regionBooks[region] = [];

 regionBooks[region].push(b);

 });

 const regionKeys = Object.keys(regionBooks).sort((a, b) => regionBooks[b].length - regionBooks[a].length);

 const R_FLAG = { USA: '🇺🇸', Canada: '🇨🇦', Europe: '🇪🇺', Elsewhere: '🌍' };

 const R_COL = { USA: '#1a3a5c', Canada: '#1a4a2e', Europe: '#6b3fa0', Elsewhere: '#4a4a4a' };

 const tilesHtml = regionKeys.map(rKey => {

 const bks = regionBooks[rKey];

 const pct = Math.round(bks.length / withRegion.length * 100);

 const flag = R_FLAG[rKey] || '🌍';

 const col = R_COL[rKey] || '#4a4a4a';

 return `<div class="agg-origin-tile" data-region="${rKey}" style="background:rgba(255,255,255,0.5);padding:18px 16px;border-top:3px solid ${col};text-align:center;cursor:pointer;transition:background 0.15s;">

 <div style="font-size:36px;margin-bottom:6px;">${flag}</div>

 <div style="font-family:\'DM Mono\',monospace;font-size:8px;letter-spacing:0.2em;text-transform:uppercase;color:var(--wood-light);">${rKey}</div>

 <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:32px;font-weight:900;color:var(--wood-dark);line-height:0.95;">${bks.length}</div>

 <div style="font-size:8px;color:rgba(92,61,42,0.4);">${pct}% of reads</div>

 </div>`;

 }).join('');

 container.innerHTML += `<div style="font-family:\'DM Mono\',monospace;font-size:8px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(92,61,42,0.38);margin:16px 0 8px;">Origin (All Years)</div>

 <div id="aggOriginTilesGrid" style="display:grid;grid-template-columns:repeat(${Math.min(regionKeys.length, 4)},1fr);gap:1px;background:rgba(61,43,31,0.08);border-radius:4px;overflow:hidden;">${tilesHtml}</div>`;

 setTimeout(() => {

 const grid = document.getElementById('aggOriginTilesGrid');

 if (!grid) return;

 grid.querySelectorAll('.agg-origin-tile').forEach(tile => {

 const rKey = tile.dataset.region;

 const bks = regionBooks[rKey] || [];

 const pct = Math.round(bks.length / withRegion.length * 100);

 const flag = R_FLAG[rKey] || '🌍';

 tile.addEventListener('mouseenter', e => {

 tile.style.background = 'rgba(255,255,255,0.8)';

 const bookList = bks.map(b => `<div style="display:flex;align-items:center;gap:6px;margin-top:4px;"><span style="font-size:16px;">${WikidataAPI.getBookFlag(b)}</span><span style="flex:1;font-size:11px;">${b.title}</span><span style="color:${COLORS[b.sentiment]};font-size:10px;">${LABELS[b.sentiment]}</span></div>`).join('');

 showChartTT(`<div class="ctt-title" style="font-size:15px;"><span style="font-size:24px;vertical-align:middle;margin-right:6px;">${flag}</span>${rKey}</div><div class="ctt-body">${bks.length} book${bks.length!==1?'s':''} · ${pct}%<div style="height:1px;background:rgba(61,43,31,0.15);margin:8px 0;"></div>${bookList}</div>`, e);

 });

 tile.addEventListener('mousemove', e => moveChartTT(e));

 tile.addEventListener('mouseleave', () => { tile.style.background = 'rgba(255,255,255,0.5)'; hideChartTT(); });

 });

 }, 50);

 }

 },

 _renderAggSentimentTrend(yearsData) {

 const container = document.getElementById('aggSentimentTrend');

 if (!container || !yearsData.length) return;

 const SENT_SCORE = { love: 5, like: 4, mixed: 3, dislike: 2 };

 const SENT_LABEL = { 2: 'Dislike', 3: 'Mixed', 4: 'Like', 5: 'Love' };

 const ALL_MO = ['January','February','March','April','May','June','July','August','September','October','November','December'];

 const MO_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

 let points = [];

 if (yearsData.length === 1) {

 const yd = yearsData[0];

 ALL_MO.forEach((m, mi) => {

 const monthBooks = yd.books.filter(b => b.month === m);

 if (monthBooks.length) {

 const avg = monthBooks.reduce((s, b) => s + (SENT_SCORE[b.sentiment] || 3), 0) / monthBooks.length;

 points.push({ label: MO_SHORT[mi], avg, count: monthBooks.length });

 }

 });

 } else {

 points = yearsData.map(yd => {

 const avg = yd.books.reduce((s, b) => s + (SENT_SCORE[b.sentiment] || 3), 0) / yd.books.length;

 return { label: String(yd.year), avg, count: yd.books.length };

 });

 }

 if (points.length < 2) {

 const allBooks = yearsData.flatMap(y => y.books);

 const sentCounts = { love: 0, like: 0, mixed: 0, dislike: 0 };

 allBooks.forEach(b => sentCounts[b.sentiment]++);

 container.innerHTML = `<div style="text-align:center;padding:16px;">

 <div style="font-family:\'DM Mono\',monospace;font-size:8px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(92,61,42,0.38);margin-bottom:12px;">Sentiment Breakdown</div>

 <div style="display:flex;justify-content:center;gap:20px;flex-wrap:wrap;">

 ${Object.entries(sentCounts).filter(([,c])=>c>0).map(([s, c]) => `<div style="text-align:center;"><div style="font-size:28px;font-weight:900;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${COLORS[s]};">${c}</div><div style="font-size:9px;color:var(--wood-light);text-transform:uppercase;letter-spacing:0.1em;">${LABELS[s]}</div></div>`).join('')}

 </div>

 </div>`;

 return;

 }

 const W = 800, H = 160, PAD = { t: 16, r: 20, b: 34, l: 58 };

 const pw = W - PAD.l - PAD.r, ph = H - PAD.t - PAD.b;

 const minY = 2, maxY = 5;

 const uid = 'sent' + Date.now();

 let svg = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:${W}px;" preserveAspectRatio="xMidYMid meet">`;

 svg += `<defs><linearGradient id="${uid}fill" x1="0" y1="0" x2="0" y2="1">

 <stop offset="0%" stop-color="${COLORS.like}" stop-opacity="0.25"/>

 <stop offset="100%" stop-color="${COLORS.like}" stop-opacity="0.03"/>

 </linearGradient></defs>`;

 [2, 3, 4, 5].forEach(val => {

 const y = PAD.t + ph - ((val - minY) / (maxY - minY) * ph);

 svg += `<line x1="${PAD.l}" y1="${y}" x2="${W - PAD.r}" y2="${y}" stroke="rgba(61,43,31,0.06)" stroke-width="1"/>`;

 svg += `<text x="${PAD.l - 8}" y="${y + 4}" text-anchor="end" fill="rgba(61,43,31,0.3)" font-size="9" font-family="DM Mono,monospace">${SENT_LABEL[val]}</text>`;

 });

 const linePoints = points.map((p, i) => {

 const x = PAD.l + (i / Math.max(1, points.length - 1)) * pw;

 const y = PAD.t + ph - ((p.avg - minY) / (maxY - minY) * ph);

 return { x, y, ...p };

 });

 function smoothSent(pts) {

 if (pts.length < 2) return '';

 let d = 'M ' + pts[0].x + ' ' + pts[0].y;

 for (let i = 0; i < pts.length - 1; i++) {

 const p0 = pts[Math.max(0, i - 1)];

 const p1 = pts[i];

 const p2 = pts[i + 1];

 const p3 = pts[Math.min(pts.length - 1, i + 2)];

 const t = 0.25;

 d += ' C ' + (p1.x + (p2.x - p0.x) * t) + ' ' + (p1.y + (p2.y - p0.y) * t) + ', ' + (p2.x - (p3.x - p1.x) * t) + ' ' + (p2.y - (p3.y - p1.y) * t) + ', ' + p2.x + ' ' + p2.y;

 }

 return d;

 }

 const pathD = smoothSent(linePoints);

 if (linePoints.length >= 2) {

 svg += `<path d="${pathD} L ${linePoints[linePoints.length-1].x} ${PAD.t + ph} L ${linePoints[0].x} ${PAD.t + ph} Z" fill="url(#${uid}fill)"/>`;

 }

 svg += `<path d="${pathD}" fill="none" stroke="${COLORS.like}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;

 linePoints.forEach(p => {

 const sentLevel = p.avg >= 4.5 ? 'love' : p.avg >= 3.5 ? 'like' : p.avg >= 2.5 ? 'mixed' : 'dislike';

 svg += `<circle cx="${p.x}" cy="${p.y}" r="4.5" fill="${COLORS[sentLevel]}" stroke="#faf5ee" stroke-width="2"/>`;

 svg += `<text x="${p.x}" y="${H - 6}" text-anchor="middle" fill="rgba(61,43,31,0.5)" font-size="9" font-family="DM Mono,monospace">${p.label}</text>`;

 svg += `<circle cx="${p.x}" cy="${p.y}" r="14" fill="transparent" class="sent-pt" data-label="${p.label}" data-avg="${p.avg.toFixed(1)}"></circle>`;
 });

 svg += '</svg>';

 const firstAvg = points[0].avg;

 const lastAvg = points[points.length - 1].avg;

 const diff = lastAvg - firstAvg;

 const pctChange = Math.round(Math.abs(diff) / firstAvg * 100);

 const timeDesc = yearsData.length === 1 ? 'this year' : points.length + ' years';

 const insight = diff > 0.1 ? `Your ratings improved ${pctChange}% over ${timeDesc} 📈` : diff < -0.1 ? `Your ratings dipped ${pctChange}%  -  exploring outside comfort zone? #8c1a28` : `Remarkably consistent taste across ${timeDesc} -`;

 container.innerHTML = svg + `<div style="text-align:center;padding:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;font-style:italic;color:var(--wood-mid);opacity:0.8;">${insight}</div>`;
 {
   const c = document.getElementById('aggSentimentTrend');
   if (c && !c.dataset.ttBound) {
     c.dataset.ttBound = 'true';
     c.addEventListener('mousemove', e => {
       const el = e.target.closest ? e.target.closest('.sent-pt') : null;
       if (el) {
         
         const lbl = el.dataset.label; const avg = el.dataset.avg;
         const stars = '★'.repeat(Math.round(parseFloat(avg))) + '☆'.repeat(5 - Math.round(parseFloat(avg)));
         showChartTT(`<div class="ctt-title">${lbl}</div><div class="ctt-body">Average: ${avg} <span style="color:#c89018">${stars}</span></div>`, e);

       } else {
         hideChartTT();
       }
     });
     c.addEventListener('mouseleave', () => hideChartTT());
   }
 }

 },

 _renderAggClosingStrip(books, yearsData) {

 const el = document.getElementById('aggClosingStrip');

 if (!el) return;

 el.innerHTML = '';

 if (!books.length) return;

 const totalWords = books.reduce((s, b) => s + b.words, 0);

 const uniqueAuthors = new Set(books.map(b => b.author)).size;

 const genres = [...new Set(books.map(b => b.genre).filter(Boolean))];

 const stats = [

 { num: books.length, lbl: 'books read', sub: yearsData.length + ' years' },

 { num: fmtWords(totalWords), lbl: 'words', sub: 'across all titles' },

 { num: uniqueAuthors, lbl: 'authors', sub: 'unique voices' },

 { num: genres.length, lbl: 'genres', sub: 'explored' },

 ];

 const grid = document.createElement('div');

 grid.className = 'headline-strip-grid';

 stats.forEach(s => { grid.innerHTML += `<div class="headline-block"><span class="headline-num">${s.num}</span><span class="headline-lbl">${s.lbl}</span><span class="headline-lbl-italic">${s.sub}</span></div>`; });

 el.appendChild(grid);

 const sentence = document.createElement('div');

 sentence.className = 'headline-sentence';

 sentence.innerHTML = `<em>${books.length} books, ${uniqueAuthors} authors, ${genres.length} genres  -  a library of a lifetime.</em>`;

 el.appendChild(sentence);

 },

 openAggModal(year) {

 const overlay = document.getElementById('aggModal');

 const content = document.getElementById('aggModalContent');

 if (!overlay || !content) return;

 const yearData = this.aggregateYearData[year];

 if (!yearData || !yearData.books.length) return;

 const books = yearData.books.filter(b => !b.currentlyReading && b.status !== 'to-read');

 content.innerHTML = `

 <h1 style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:clamp(48px,8vw,80px);font-weight:900;line-height:0.9;letter-spacing:-3px;margin-bottom:24px;">${year} <em style="color:var(--wood-light);">Reading Year</em></h1>

 <div style="font-family:\'DM Mono\',monospace;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:var(--wood-light);margin-bottom:32px;">${books.length} books · ${fmtWords(books.reduce((s,b) => s+b.words,0))} words</div>

 <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-bottom:32px;">

 ${books.map(b => {

 const wordK = Math.round(b.words / 1000) + 'k';

 const sentCol = COLORS[b.sentiment] || COLORS.mixed;

 return `<div style="background:rgba(255,255,255,0.5);border-radius:4px;padding:12px;border-left:3px solid ${sentCol};cursor:pointer;" onclick="openPanel(App.aggregateBooks.find(x=>x.id==='${b.id}'))">

 <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;font-style:italic;line-height:1.2;margin-bottom:4px;">${b.title}</div>

 <div style="font-size:10px;color:var(--wood-light);">${b.author}</div>

 <div style="font-size:9px;color:var(--wood-light);margin-top:4px;">${wordK} words · ${b.days}d · ${LABELS[b.sentiment] || b.sentiment}</div>

 </div>`;

 }).join('')} </div>

 <div style="font-family:\'DM Mono\',monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:var(--wood-light);text-align:center;margin-top:20px;">Click a book for details · Press ✕ to return</div>

 `;

 overlay.classList.add('open');

 document.body.style.overflow = 'hidden'; document.documentElement.style.overflow = 'hidden';

 overlay.onclick = (e) => {

 if (e.target === overlay) this.closeAggModal();

 };

 },

 closeAggModal() {

 const overlay = document.getElementById('aggModal');

 if (overlay) {

 overlay.style.opacity = '0';

 overlay.style.transition = 'opacity 0.25s ease';

 setTimeout(() => {

 overlay.classList.remove('open');

 overlay.style.opacity = '';

 overlay.style.transition = '';

 document.body.style.overflow = ''; document.documentElement.style.overflow = '';

 }, 250);

 }

 }
};
