/**
 * src/components/MonthlyPace.js
 * Monthly Reading Pace SVG Chart and Analytics Module
 */

import { SYMBOLS } from '../constants/symbols.js';
import { showChartTT, moveChartTT, hideChartTT } from '../utils/dom.js';
import { COLORS } from '../utils/constants.js';
import { fmtWords } from './Masthead.js';

export function renderPaceLine(appInstance, BOOKS) {
  const app = appInstance || (typeof window !== 'undefined' ? window.App : null);
  if (!app) return;

  const svg = document.getElementById('paceLineSvg');
  if (!svg) return;

  if (app.multiYearRange && app.multiYearRange !== 'single') {
    svg.dataset.revealed = '0';
  }

  const booksList = BOOKS || [];
  if (!booksList.length) {
    svg.innerHTML = `<text x="10" y="50" fill="red"></text>`;
    return;
  }

  const ns = 'http://www.w3.org/2000/svg';
  let isAgg = app.multiYearRange && app.multiYearRange !== 'single';
  let monthData = [];

  if (isAgg) {
    const yearKeys = Object.keys(app.aggregateYearData || {}).map(Number).sort();
    if (yearKeys.length <= 1) {
      isAgg = false;
    } else {
      const startYear = yearKeys[0];
      const endYear = yearKeys[yearKeys.length - 1];
      const allYears = [];
      for (let y = startYear; y <= endYear; y++) allYears.push(y);

      monthData = allYears.map(year => {
        const bks = booksList.filter(b => (b.readYear || b.year) == year && !b.dnf && !b.currentlyReading && b.status !== 'reading');
        return {
          month: String(year),
          abbr: String(year),
          count: bks.length,
          words: bks.reduce((sum, b) => sum + (b.words || 0), 0),
          books: bks,
          projected: false,
          unread: bks.length === 0
        };
      });
    }
  }

  if (!isAgg) {
    const CALENDAR_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const actualMonths = CALENDAR_MONTHS.map(month => {
      const bks = booksList.filter(b => b.month === month);
      return {
        month,
        abbr: month.slice(0, 3).toUpperCase(),
        count: bks.length,
        words: bks.reduce((sum, b) => sum + (b.words || 0), 0),
        books: bks,
        projected: false
      };
    }).filter(d => d.count > 0);

    if (!actualMonths.length) {
      svg.innerHTML = '';
      return;
    }

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
  const EARTHY = '#8b6343';
  const ACTUAL_FILL = '#D4B896';

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

  const minCount = Math.min(...monthData.map(d => d.count).filter(c => c > 0), 1);

  function dotR(count) {
    if (count <= 0) return DOT_MIN_D / 2;
    const range = Math.max(1, maxCount - minCount);
    const t = Math.min(1, (count - minCount) / range);
    return (DOT_MIN_D + t * (DOT_MAX_D - DOT_MIN_D)) / 2;
  }

  // Baseline
  const base = document.createElementNS(ns, 'line');
  base.setAttribute('x1', PAD.l);
  base.setAttribute('x2', PAD.l + chartW);
  base.setAttribute('y1', PAD.t + chartH);
  base.setAttribute('y2', PAD.t + chartH);
  base.setAttribute('stroke', 'rgba(61,43,31,0.18)');
  base.setAttribute('stroke-width', '1');
  svg.appendChild(base);

  // Month vertical dividers
  monthData.forEach((d, i) => {
    if (i === 0) return;
    const prevX = xPos(i - 1);
    const x = xPos(i);
    const dividerX = prevX + ((x - prevX) / 2);
    const v = document.createElementNS(ns, 'line');
    v.setAttribute('x1', dividerX);
    v.setAttribute('x2', dividerX);
    v.setAttribute('y1', PAD.t - 2);
    v.setAttribute('y2', PAD.t + chartH + 4);
    v.setAttribute('stroke', 'rgba(61,43,31,0.08)');
    v.setAttribute('stroke-width', '1');
    svg.appendChild(v);
  });

  // Horizontal grid lines
  const GRID_LINES = 5;
  for (let i = 1; i < GRID_LINES; i++) {
    const y = PAD.t + (i / GRID_LINES) * chartH;
    const gl = document.createElementNS(ns, 'line');
    gl.setAttribute('x1', PAD.l);
    gl.setAttribute('x2', PAD.l + chartW);
    gl.setAttribute('y1', y);
    gl.setAttribute('y2', y);
    gl.setAttribute('stroke', 'rgba(61,43,31,0.055)');
    gl.setAttribute('stroke-width', '1');
    svg.appendChild(gl);
  }

  const pts = monthData.map((d, i) => ({
    x: xPos(i),
    y: d.unread ? (PAD.t + chartH) : yPos(d.count),
    unread: !!d.unread
  }));

  let areaD = '';
  let lineD = '';
  if (pts.length === 1) {
    areaD = `M ${PAD.l} ${PAD.t + chartH} L ${PAD.l} ${pts[0].y} L ${PAD.l + chartW} ${pts[0].y} L ${PAD.l + chartW} ${PAD.t + chartH} Z`;
    lineD = `M ${PAD.l} ${pts[0].y} L ${PAD.l + chartW} ${pts[0].y}`;
  } else {
    areaD = `M ${pts[0].x} ${PAD.t + chartH} ` + pts.map(p => `L ${p.x} ${p.y}`).join(' ') + ` L ${pts[pts.length - 1].x} ${PAD.t + chartH} Z`;
    lineD = pts.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
  }

  const area = document.createElementNS(ns, 'path');
  area.setAttribute('d', areaD);
  area.setAttribute('fill', EARTHY);
  area.setAttribute('fill-opacity', '0.11');
  svg.appendChild(area);

  const line = document.createElementNS(ns, 'path');
  line.setAttribute('d', lineD);
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke', EARTHY);
  line.setAttribute('stroke-width', '2');
  line.setAttribute('stroke-linejoin', 'round');
  line.setAttribute('stroke-linecap', 'round');
  line.setAttribute('opacity', '0.8');
  svg.appendChild(line);

  // Animation styling
  const _animPace = true;
  let _lineLen = 0;
  if (_animPace) {
    try { _lineLen = line.getTotalLength(); } catch (e) { _lineLen = 0; }
    area.setAttribute('fill-opacity', '0');
    area.style.transition = 'fill-opacity 0.9s ease 0.55s';
    if (_lineLen) {
      line.style.strokeDasharray = _lineLen;
      line.style.strokeDashoffset = -_lineLen;
      line.style.transition = 'stroke-dashoffset 1.25s cubic-bezier(0.22,0.61,0.36,1)';
    }
  }

  const validData = monthData.filter(d => !d.unread);
  const topActualMonth = validData.length ? validData.reduce((a, b) => b.count > a.count ? b : a).month : null;
  const _paceDots = [];
  const _paceLabels = [];

  monthData.forEach((d, i) => {
    const x = pts[i].x;
    const y = pts[i].y;
    const r = dotR(d.count);
    const isUnread = d.unread;
    const isTopMonth = !isUnread && d.month === topActualMonth;

    const dot = document.createElementNS(ns, 'circle');
    dot.setAttribute('cx', x);
    dot.setAttribute('cy', isUnread ? (PAD.t + chartH) : y);
    const _targetR = isUnread ? 3 : r;
    dot.setAttribute('r', _animPace ? 0 : _targetR);
    dot.setAttribute('fill', isUnread ? 'rgba(127,127,127,0.45)' : ACTUAL_FILL);
    dot.setAttribute('stroke', isUnread ? 'rgba(127,127,127,0.3)' : 'rgba(139,99,67,0.35)');
    dot.setAttribute('stroke-width', isUnread ? '1' : '1.5');
    dot.dataset.targetR = _targetR;
    dot.dataset.finalCy = isUnread ? (PAD.t + chartH) : y;

    if (!isUnread && d.count > 0) {
      dot.style.cursor = 'pointer';
      dot.addEventListener('mouseenter', (e) => {
        const booksList = d.books || [];
        const escapeFn = (s) => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
        const bookLines = booksList.map(b => {
          const dotCol = COLORS[b.sentiment] || '#8b6343';
          const title = escapeFn(b.title || 'Untitled');
          const author = b.author ? ` <span style="opacity:0.75;font-size:0.9em;">by ${escapeFn(b.author)}</span>` : '';
          return `<span style="color:${dotCol};">●</span> <strong>${title}</strong>${author}`;
        }).join('<br>');

        const bodyContent = `${d.count} book${d.count !== 1 ? 's' : ''} · ${fmtWords(d.words)} words` +
          (bookLines ? `<div style="margin-top:8px;padding-top:6px;border-top:1px solid rgba(61,43,31,0.12);line-height:1.5;max-height:200px;overflow-y:auto;">${bookLines}</div>` : '');

        showChartTT(`<div class="ctt-title">${d.month}</div><div class="ctt-body">${bodyContent}</div>`, e);
      });
      dot.addEventListener('mousemove', moveChartTT);
      dot.addEventListener('mouseleave', hideChartTT);
    }

    svg.appendChild(dot);
    _paceDots.push({ el: dot, targetR: _targetR });

    if (!isUnread) {
      const label = document.createElementNS(ns, 'text');
      label.setAttribute('x', x);
      label.setAttribute('y', y + 4);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('font-size', isTopMonth ? '12px' : '10px');
      label.setAttribute('font-weight', '700');
      label.setAttribute('fill', isTopMonth ? '#fff' : 'var(--text-primary)');
      label.setAttribute('pointer-events', 'none');
      label.style.pointerEvents = 'none';
      label.textContent = d.count;
      if (_animPace) {
        label.setAttribute('opacity', '0');
        label.style.transition = 'opacity 0.3s ease';
        _paceLabels.push({ el: label, target: '1' });
      }
      svg.appendChild(label);
    }

    // Month name label below baseline
    const mText = document.createElementNS(ns, 'text');
    mText.setAttribute('x', x);
    mText.setAttribute('y', PAD.t + chartH + 16);
    mText.setAttribute('text-anchor', 'middle');
    mText.setAttribute('font-size', '9px');
    mText.setAttribute('font-family', "'DM Mono', monospace");
    mText.setAttribute('fill', 'var(--text-muted)');
    mText.textContent = d.abbr;
    svg.appendChild(mText);
  });

  if (_animPace) {
    const triggerReveal = () => {
      if (_lineLen) {
        requestAnimationFrame(() => { line.style.strokeDashoffset = '0'; });
      }
      requestAnimationFrame(() => {
        area.setAttribute('fill-opacity', '0.11');
        area.style.fillOpacity = '0.11';
      });
      _paceDots.forEach((pd, i) => {
        const delay = 250 + i * 70;
        setTimeout(() => {
          const dur = 480, t0 = performance.now();
          const step = (now) => {
            let t = Math.min(1, (now - t0) / dur);
            const e = 1 + (--t) * t * (2.2 * (t + 1) + t);
            pd.el.setAttribute('r', Math.max(0, pd.targetR * e));
            if ((now - t0) < dur) requestAnimationFrame(step);
            else pd.el.setAttribute('r', pd.targetR);
          };
          requestAnimationFrame(step);
        }, delay);
      });
      _paceLabels.forEach((pl, i) => {
        setTimeout(() => {
          pl.el.setAttribute('opacity', pl.target);
        }, 250 + i * 70 + 260);
      });
    };

    if (typeof window !== 'undefined' && window.revealOnScroll) {
      window.revealOnScroll(svg, (el, isIntersecting) => {
        if (!isIntersecting) {
          line.style.strokeDashoffset = -_lineLen;
          area.style.fillOpacity = '0';
          _paceDots.forEach(d => d.el.setAttribute('r', '0'));
          _paceLabels.forEach(l => l.el.setAttribute('opacity', '0'));
          return;
        }
        triggerReveal();
      });
    } else {
      triggerReveal();
    }
  }
}

export function initMonthlyPace(appInstance) {
  const app = appInstance || (typeof window !== 'undefined' ? window.App : null);
  if (!app) return;

  app.renderPaceLine = (books) => renderPaceLine(app, books);
}
