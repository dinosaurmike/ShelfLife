
/**
 * src/features/bookmarks.js
 * Monthly & Quarterly Bookmark Ribbon Overlays on Bookshelf
 */

import { MONTH_TO_QUARTER, QUARTER_MAP, COLORS, LABELS, QUARTER_PALETTE } from '../utils/constants.js';
import { showChartTT, moveChartTT, hideChartTT } from '../utils/dom.js';

function fmtK(n) {
  return n >= 1000000 ? (n / 1000000).toFixed(2) + 'M' : Math.round(n / 1000) + 'k';
}

function bmTone(words, minW, maxW, month) {
  const t = (maxW === minW) ? 0.5 : (words - minW) / (maxW - minW);
  const q = MONTH_TO_QUARTER[month] || 'Q1';
  const pal = QUARTER_PALETTE[q] || QUARTER_PALETTE.Q1;
  const lLight = Math.round(92 - t * 6);
  const lDark = Math.round(85 - t * 9);
  return {
    light: 'hsl(' + pal.h + ',' + pal.s + '%,' + lLight + '%)',
    dark: 'hsl(' + pal.h + ',' + pal.s + '%,' + lDark + '%)',
    text: 'rgba(61,43,31,0.92)'
  };
}

export function renderBookmarkStrips(monthData, allBooks, quarterMode) {
  const DESKTOP_MONTH_GAP = 14;
  const bookmarkChart = document.getElementById('bookmarkChart');
  const shelfPlank = document.getElementById('shelfPlank');

  if (shelfPlank) {
    shelfPlank.querySelectorAll('.bookmark-strip').forEach(s => s.remove());
  }
  if (bookmarkChart) {
    bookmarkChart.innerHTML = '';
  }

  if (monthData && monthData.length && allBooks && allBooks.length) {
    const maxWords = Math.max(...monthData.map(d => d.words), 1);
    const minWords = Math.min(...monthData.map(d => d.words));
    const totalAllWords = monthData.reduce((s, d) => s + d.words, 0);

    const BM_H = 26;
    const BM_TOP = Math.round((48 - BM_H) / 2);
    const BM_NOTCH = 9;
    const LABEL_GAP = 12;

    monthData.forEach((d, i) => {
      if (!d.words) return;

      const refMonth = quarterMode ? (QUARTER_MAP[d.group] || ['January'])[0] : d.group;
      const wc = bmTone(d.words, minWords, maxWords, refMonth);
      const pct = Math.round(d.words / totalAllWords * 100);
      const prop = maxWords > 0 ? d.words / maxWords : 1;
      const labelW = (d.lblEl && d.lblEl.offsetWidth) ? d.lblEl.offsetWidth : (quarterMode ? 24 : 46);
      let stripLeft = d.x + labelW + LABEL_GAP;
      let avail = Math.max(0, (d.x + d.w) - stripLeft);

      // In Quarter Mode, if books are too few to create space, we FORCE the ribbon to render 
      // starting slightly earlier and with a minimum width, so the user always sees it.
      let stripW;
      if (quarterMode) {
        if (avail < 48) {
          stripW = 48;
        } else {
          stripW = Math.max(48, Math.round(avail * prop));
        }
      } else {
        if (avail < 28) return;
        const minLegible = Math.min(avail, 70);
        stripW = Math.max(minLegible, Math.round(avail * prop));
        if (stripW > avail) stripW = avail;
      }

      const realBooks = d.bookList || [];
      const sentBreak = { love: 0, like: 0, mixed: 0, dislike: 0 };
      realBooks.forEach(b => { if (sentBreak.hasOwnProperty(b.sentiment)) sentBreak[b.sentiment]++; });
      const sortedPace = [...realBooks].filter(b => b.days > 0).sort((a, b) => (b.words / b.days) - (a.words / a.days));
      const fastest = sortedPace[0];
      const slowest = sortedPace.length > 1 ? sortedPace[sortedPace.length - 1] : null;
      const avgWpd = realBooks.length && realBooks.reduce((s, b) => s + (Number(b.days) || 0), 0) > 0 ? Math.round(realBooks.reduce((s, b) => s + (Number(b.words) || 0), 0) / realBooks.reduce((s, b) => s + (Number(b.days) || 0), 0)) : 0;

      const monthAudiobooks = realBooks.filter(b => b.format === 'audiobook');
      const audioDurHtml = monthAudiobooks.length ? (() => {
        const totalH = monthAudiobooks.reduce((s, b) => s + (b.durationHours || 0), 0);
        return '<br><span style="opacity:0.7">🎧 ' + monthAudiobooks.length + ' audiobook' + (monthAudiobooks.length !== 1 ? 's' : '') + ' &middot; ' + Math.floor(totalH) + 'h ' + Math.round((totalH % 1) * 60) + 'm</span>';
      })() : '';

      const strip = document.createElement('div');
      strip.className = 'bookmark-strip';
      strip.style.cssText = 'position:absolute;left:' + stripLeft + 'px;top:' + BM_TOP + 'px;width:' + stripW + 'px;height:' + BM_H + 'px;z-index:5;cursor:pointer;transition:transform 0.18s ease,filter 0.18s ease;transform-origin:left center;';

      const body = document.createElement('div');
      const BM_OUTLINE = 'drop-shadow(0.9px 0 0 #fffdf8) drop-shadow(-0.9px 0 0 #fffdf8) drop-shadow(0 0.9px 0 #fffdf8) drop-shadow(0 -0.9px 0 #fffdf8) drop-shadow(0.7px 0.7px 0 #fffdf8) drop-shadow(-0.7px 0.7px 0 #fffdf8) drop-shadow(0.7px -0.7px 0 #fffdf8) drop-shadow(-0.7px -0.7px 0 #fffdf8) drop-shadow(0 2px 3px rgba(0,0,0,0.28))';
      body.style.cssText = 'width:100%;height:100%;background:linear-gradient(180deg,' + wc.light + ' 0%,' + wc.dark + ' 100%);border-radius:3px 0 0 3px;display:flex;align-items:center;padding:0 ' + (BM_NOTCH + 6) + 'px 0 8px;box-sizing:border-box;clip-path:polygon(0 0, 100% 0, calc(100% - ' + BM_NOTCH + 'px) 50%, 100% 100%, 0 100%);box-shadow:inset 0 1px 2px rgba(255,255,255,0.6),inset 0 -1px 2px rgba(0,0,0,0.06);filter:' + BM_OUTLINE + ';overflow:hidden;';

      const wordsLabel = fmtK(d.words);
      const full = stripW >= 130;
      const med = stripW >= 78;
      let labelHtml;
      if (full) labelHtml = '<span style="font-weight:400;opacity:0.92;">' + d.books + ' book' + (d.books !== 1 ? 's' : '') + '</span><span style="opacity:0.45;margin:0 7px;">|</span><span style="font-weight:400;">' + wordsLabel + ' words</span>';
      else if (med) labelHtml = '<span style="font-weight:400;opacity:0.92;">' + d.books + '</span><span style="opacity:0.45;margin:0 6px;">|</span><span style="font-weight:400;">' + wordsLabel + '</span>';
      else labelHtml = '<span style="font-weight:400;">' + wordsLabel + '</span>';

      body.innerHTML = '<span style="font-family:\'DM Mono\',monospace;font-size:9.5px;text-transform:uppercase;color:' + wc.text + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;position:sticky;left:14px;display:inline-block;">' + labelHtml + '</span>';
      strip.appendChild(body);

      strip.addEventListener('mouseenter', e => {
        strip.style.transform = 'translateY(-3px)';
        strip.style.filter = 'brightness(1.06)';
        showChartTT('<div class="ctt-title">' + d.group + '</div><div class="ctt-body">' + pct + '% of total &middot; ' + d.books + ' book' + (d.books !== 1 ? 's' : '') + '<br>' + avgWpd.toLocaleString() + ' avg w/day<br>' + Object.entries(sentBreak).filter(([, v]) => v > 0).map(([s, v]) => '<span style="color:' + COLORS[s] + '">' + LABELS[s] + ' ' + v + '</span>').join(' &middot; ') + (fastest ? '<br><span style="opacity:0.6">Fastest &middot; ' + fastest.title + '</span>' : '') + (slowest && slowest !== fastest ? '<br><span style="opacity:0.6">Slowest &middot; ' + slowest.title + '</span>' : '') + audioDurHtml + '</div>', e);
      });
      strip.addEventListener('mousemove', e => moveChartTT(e));
      strip.addEventListener('mouseleave', () => {
        strip.style.transform = '';
        strip.style.filter = '';
        hideChartTT();
      });

      if (shelfPlank) shelfPlank.appendChild(strip);
    });
  }

  // Render Quarterly Bookmarks in bookmarkChart
  const bChart = document.getElementById('bookmarkChart');
  if (bChart && !quarterMode && monthData && monthData.length) {
    bChart.innerHTML = '';
    bChart.style.cssText = 'width:100%;height:40px;position:relative;margin-top:2px;display:flex;pointer-events:none;';

    // We need to calculate the width of each quarter based on monthData.
    const qData = {};
    monthData.forEach(d => {
      if (d.group === 'CR' || d.group === 'Q_UNKN') return;
      const q = MONTH_TO_QUARTER[d.group] || (d.group.startsWith('Q') ? d.group : 'Q1');
      if (!qData[q]) qData[q] = { x: d.x, w: 0, words: 0, books: 0, group: q, seriesCounts: {} };
      qData[q].w += d.w + (d.group !== monthData[monthData.length - 1].group ? DESKTOP_MONTH_GAP : 0);
      qData[q].words += d.words;
      qData[q].books += d.books;
      const bList = d.bookList || d.booksList;
      if (bList) {
        bList.forEach(b => {
          if (b.seriesName && b.seriesName.trim()) {
            const s = b.seriesName.trim();
            qData[q].seriesCounts[s] = (qData[q].seriesCounts[s] || 0) + 1;
          }
        });
      }
    });

    const qArr = Object.values(qData).filter(q => q.words > 0);
    if (qArr.length) {
      const minQWords = Math.min(...qArr.map(q => q.words));
      const maxQWords = Math.max(...qArr.map(q => q.words), 1);

      qArr.forEach(q => {
        const refMonth = (QUARTER_MAP[q.group] || ['January'])[0];
        const wc = bmTone(q.words, minQWords, maxQWords, refMonth);

        let seriesHtml = '';
        const sEntries = Object.entries(q.seriesCounts).sort((a, b) => b[1] - a[1]);
        if (sEntries.length > 0 && sEntries[0][1] >= 2) {
          seriesHtml = `<div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.1);"><span style="color:var(--wood-light);font-size:9px;text-transform:uppercase;letter-spacing:0.1em;">Obsession</span><br>📚 ${sEntries[0][0]} (${sEntries[0][1]} books)</div>`;
        }

        const strip = document.createElement('div');
        strip.className = 'bookmark-strip';
        strip.style.cssText = 'position:absolute;left:' + q.x + 'px;top:0px;width:' + Math.max(48, q.w - 30) + 'px;height:32px;z-index:5;cursor:pointer;pointer-events:auto;transition:transform 0.18s ease,filter 0.18s ease;transform-origin:left center;';

        strip.addEventListener('mouseenter', e => {
          strip.style.transform = 'translateY(-2px)';
          strip.style.filter = 'brightness(1.06)';
          showChartTT(`<div class="ctt-title">${q.group} Stats</div><div class="ctt-body">${q.books} book${q.books !== 1 ? 's' : ''} &middot; ${q.words >= 1000000 ? (q.words / 1000000).toFixed(1) + 'M' : Math.round(q.words / 1000) + 'k'} words${seriesHtml}</div>`, e);
        });
        strip.addEventListener('mousemove', e => moveChartTT(e));
        strip.addEventListener('mouseleave', () => {
          strip.style.transform = '';
          strip.style.filter = '';
          hideChartTT();
        });

        const body = document.createElement('div');
        const BM_OUTLINE = 'drop-shadow(0.9px 0 0 #fffdf8) drop-shadow(-0.9px 0 0 #fffdf8) drop-shadow(0 0.9px 0 #fffdf8) drop-shadow(0 -0.9px 0 #fffdf8) drop-shadow(0.7px 0.7px 0 #fffdf8) drop-shadow(-0.7px 0.7px 0 #fffdf8) drop-shadow(0.7px -0.7px 0 #fffdf8) drop-shadow(-0.7px -0.7px 0 #fffdf8) drop-shadow(0 2px 3px rgba(0,0,0,0.28))';
        body.style.cssText = 'width:100%;height:100%;background:linear-gradient(180deg,' + wc.light + ' 0%,' + wc.dark + ' 100%);border-radius:3px 0 0 3px;display:flex;align-items:center;justify-content:flex-start;padding:0 14px 0 10px;box-sizing:border-box;clip-path:polygon(0 0, 100% 0, calc(100% - 6px) 50%, 100% 100%, 0 100%);box-shadow:inset 0 1px 2px rgba(255,255,255,0.6),inset 0 -1px 2px rgba(0,0,0,0.06);filter:' + BM_OUTLINE + ';overflow:hidden;';

        const wL = Math.round(q.words / 1000) + 'k';
        const fullLabel = '<span style="font-weight:700;">' + q.group + '</span><span style="opacity:0.45;margin:0 6px;">|</span><span style="font-weight:400;opacity:0.92;">' + q.books + ' book' + (q.books !== 1 ? 's' : '') + '</span><span style="opacity:0.45;margin:0 6px;">|</span><span style="font-weight:400;">' + wL + ' words</span>';
        body.innerHTML = '<span style="font-family:\'DM Mono\',monospace;font-size:10px;text-transform:uppercase;color:' + wc.text + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + fullLabel + '</span>';

        strip.appendChild(body);
        bChart.appendChild(strip);
      });
    }
  }
}




