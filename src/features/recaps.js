import { CROWN_SVG, LANGUAGE_FLAGS, ALL_MONTHS } from '../utils/constants.js';
import { fmtWords } from '../utils/math.js';
import { SYMBOLS } from '../constants/symbols.js';
import { DB, dbToBook } from '../core/db.js';

// 5. Monthly Recap & Streaks
// ==========================================

export function _showRecapModal(dataUrl, title, monthName, monthYear) {
  let m = document.getElementById('recapModal');
  if (!m) {
    m = document.createElement('div');
    m.id = 'recapModal';
    m.className = 'modal-overlay';
    m.onclick = (e) => { if (e.target === m) this.closeModal('recapModal'); };
    m.innerHTML = `<div class="modal-card" style="max-width: 800px; width: 90vw; padding: 24px; text-align: center; position: relative; background: var(--paper, #fdfbf7) !important; color: var(--wood-dark, #2a1a10) !important;">
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


export async function openMonthlyRecap(requestedMonth, requestedYear) {
  try {
    const now = new Date();
    let monthName;
    if (typeof requestedMonth === 'number') {
      monthName = ALL_MONTHS[requestedMonth] || ALL_MONTHS[now.getMonth()];
    } else if (typeof requestedMonth === 'string' && requestedMonth) {
      monthName = requestedMonth;
    } else {
      const booksThisYear = (this.books || []).filter(b => !b.currentlyReading && b.status !== 'to-read');
      const monthsWith = [...new Set(booksThisYear.map(b => b.month).filter(Boolean))];
      monthName = monthsWith.length
        ? ALL_MONTHS.slice().reverse().find(m => monthsWith.includes(m))
        : ALL_MONTHS[now.getMonth()];
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
    ctx.font = '700 24px "DM Mono", monospace';
    ctx.fillStyle = 'rgba(240,210,140,0.85)';
    ctx.fillText(`${monthName.toUpperCase()} ${monthYear}`, 72, 86);

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
      const sentValue = s => ({'love':4, 'like':3, 'mixed':2, 'dislike':1}[s] || 0);
      const sorted = [...monthBooks].sort((a,b) => {
        const vA = sentValue(a.sentiment);
        const vB = sentValue(b.sentiment);
        if (vA !== vB) return vB - vA;
        return (b.words || 0) - (a.words || 0);
      });
      const loved = sorted[0];
      
      if (loved) {
        let drawText = true;
        const cx = 700;
        const cy = 80;
        const cw = 260;
        const ch = 390;

        if (loved.cover) {
          try {
            let src = loved.cover;
            if (src.startsWith('http')) {
              try {
                const r = await fetch(src, { mode: 'cors' });
                const b = await r.blob();
                src = URL.createObjectURL(b);
              } catch(e) {
                src = loved.fallbackCover || loved.cover;
              }
            }
            const img = new Image();
            if (src.startsWith('http')) {
               img.crossOrigin = 'anonymous';
            }
            await new Promise((res) => {
              img.onload = () => res();
              img.onerror = () => {
                 if(src !== loved.fallbackCover && loved.fallbackCover) {
                    img.onload = res;
                    img.onerror = res;
                    img.src = loved.fallbackCover;
                 } else res();
              };
              img.src = src;
            });
            if (img.complete && img.naturalWidth > 0) {
              // Draw cover image with drop shadow
              ctx.save();
              ctx.shadowColor = 'rgba(0,0,0,0.6)';
              ctx.shadowBlur = 24;
              ctx.shadowOffsetY = 12;
              ctx.drawImage(img, cx, cy, cw, ch);
              ctx.restore();
            }
          } catch(e) { console.warn('Cover load error', e); }
        }

        if (drawText) {
          ctx.font = '600 16px "DM Mono", monospace';
          ctx.fillStyle = 'rgba(240,210,140,0.9)';
          ctx.textAlign = 'center';
          ctx.fillText('TOP PICK', cx + cw/2, cy - 20);

          ctx.font = 'italic 700 24px "Playfair Display", Georgia, serif';
          ctx.fillStyle = '#f5e6c8';
          const titleStr = loved.title ? `"${loved.title.slice(0, 35)}${loved.title.length > 35 ? '...' : ''}"` : '';
          ctx.fillText(titleStr, cx + cw/2, cy + ch + 40);
          
          ctx.font = '400 18px "DM Mono", monospace';
          ctx.fillStyle = 'rgba(240,210,140,0.7)';
          ctx.fillText(`by ${loved.author || 'Unknown'}`, cx + cw/2, cy + ch + 70);
          
          ctx.textAlign = 'left'; // reset
        }
      }
    }

    // Branding watermark
    ctx.font = '700 16px "DM Mono", monospace';
    ctx.fillStyle = 'rgba(240,210,140,0.5)';
    ctx.fillText('dinomike.ca/shelflife', 72, 540);

    const dataUrl = canvas.toDataURL('image/png');
    this._showRecapModal(dataUrl, `${monthName} ${monthYear}`, monthName, monthYear);
  } catch (err) {
    console.warn('openMonthlyRecap error:', err);
    this.showToast('Recap Error: ' + err.message);
  }
}

export async function _generateClubRecap(clubName) {
  this.showToast(`Generating recap for ${clubName}...`);
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
    if (this.isDemoMode) {
      books = (this.books || []).filter(b => !b.currentlyReading && b.status !== 'to-read');
    } else {
      const shelf = await DB.getOrCreateShelf(this.userId, yr);
      if (!shelf) return;
      const dbBooks = await DB.getShelfBooks(shelf.id);
      books = dbBooks.map(dbToBook).filter(b => !b.currentlyReading && b.status !== 'to-read');
    }
  }

  if (!books.length) {
    this.showToast(`No finished books for ${yr} yet - add a few to unlock your Wrapped!`);
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
  window.location.hash = `wrapped/${yr}`;

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
  slides.push(`<div class="wrapped-content">
    <div class="wrapped-label">Your ${d.year} in books</div>
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
  slides.push(`<div class="wrapped-content wrapped-cta">
    <div class="wrapped-emoji">🎉</div>
    <div class="wrapped-title">That's your ${d.year}!</div>
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


export const openYearInReview = openWrapped;