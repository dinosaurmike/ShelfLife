/**
 * ShelfLife DOM & UI Utilities
 * Modal lifecycle management, toasts, slide-out panels, tooltips, and DOM helpers.
 */

import {
  LANGUAGES,
  LANGUAGE_FLAGS,
  COLORS,
  LABELS
} from './constants.js';

import { isWordCountEstimated } from './math.js';
import { renderQRCodeToCanvas, getQRCodeDataURL } from './qrcode.js';

/**
 * Escapes special HTML characters in a string to prevent XSS.
 * @param {string|null|undefined} str
 * @returns {string} Escaped HTML string
 */
export function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Returns flag emoji for a given language, or empty string if English/empty.
 * @param {string} lang
 * @returns {string} Flag emoji or empty string
 */
export function languageBadge(lang) {
  if (!lang || lang === 'English') return '';
  return LANGUAGE_FLAGS[lang] || '🌐';
}

/**
 * Generates HTML option tags for all supported languages.
 * @param {string} selected Currently selected language name
 * @returns {string} HTML string of option elements
 */
export function languageOptionsHTML(selected) {
  const sel = selected || 'English';
  return LANGUAGES.map(l => `<option value="${l}"${l === sel ? ' selected' : ''}>${LANGUAGE_FLAGS[l] || ''} ${l}</option>`).join('');
}

/**
 * Opens a modal overlay by ID and manages z-index layering.
 * @param {string} id Modal element ID
 */
export function openModal(id) {
  if (typeof document === 'undefined') return;
  const app = (typeof window !== 'undefined' && window.App) || {};
  if (app.isReadOnly && id !== 'bookModal' && id !== 'readingGoalsModal' && id !== 'communityModal' && id !== 'profileViewModal' && id !== 'profileHubModal' && id !== 'profileModal' && id !== 'recapModal' && id !== 'statsModal' && id !== 'trophyRoomModal') return;

  // Intercept legacy or undefined crAddModal
  if (id === 'crAddModal') {
    openModal('addBookModal');
    if (typeof window !== 'undefined' && window.App && typeof window.App.selectAddStatus === 'function') {
      window.App.selectAddStatus('reading');
    }
    return;
  }

  const el = document.getElementById(id);
  if (el) {
    if (el.parentElement !== document.body) {
      document.body.appendChild(el);
    }
    el.classList.add('open');
    el.style.display = 'flex';
    el.style.opacity = '1';
    el.style.visibility = 'visible';
    el.style.pointerEvents = 'auto';

    if (typeof window !== 'undefined') {
      window.App = window.App || {};
      window.App._modalZIndex = Math.max(99000, (window.App._modalZIndex || 2000000000) + 1);
      el.style.setProperty('z-index', String(window.App._modalZIndex), 'important');
    }
  } else {
    console.warn('Modal not found: ' + id);
  }

  if (id === 'addBookModal') {
    if (typeof window !== 'undefined' && window.App) {
      window.App.selectedSearchResult = null;
      window.App.selectedSentiment = null;
      window.App._pendingRereadOriginal = null;
      window.App._lastSearchQuery = '';
    }

    const bsi = document.getElementById('bookSearchInput');
    if (bsi) bsi.value = '';

    const _sr = document.getElementById('searchResults'); if (_sr) _sr.style.display = 'none';
    const _bff = document.getElementById('bookFormFields'); if (_bff) _bff.style.display = 'none';
    const _ss = document.getElementById('searchSubArea'); if (_ss) _ss.style.display = 'block';
    const _ms = document.getElementById('manualSubArea'); if (_ms) _ms.style.display = 'none';
    const _mp = document.getElementById('manualEntryPrompt'); if (_mp) _mp.style.display = 'none';

    ['manualTitle', 'manualAuthor', 'manualWords'].forEach(fid => {
      const field = document.getElementById(fid);
      if (field) field.value = '';
    });

    const _mf = document.getElementById('manualFormat'); if (_mf) _mf.value = 'physical';
    const _mc = document.getElementById('manualContinueBtn'); if (_mc) _mc.disabled = true;
    const _ri = document.getElementById('reviewInput'); if (_ri) _ri.value = '';
    const _di = document.getElementById('daysInput'); if (_di) _di.value = '5';
    const _wci = document.getElementById('wordCountInput'); if (_wci) _wci.value = '';
    const _wch = document.getElementById('wordCountHint'); if (_wch) _wch.style.display = 'none';
    const _crc = document.getElementById('currentlyReadingCheck'); if (_crc) _crc.checked = false;

    const _ssels = document.querySelectorAll('#sentimentSelector .sentiment-opt');
    if (_ssels) _ssels.forEach(o => o.classList.remove('selected'));

    const _sbp = document.getElementById('selectedBookPreview'); if (_sbp) _sbp.innerHTML = '';
    const rc = document.getElementById('reviewCharCount'); if (rc) rc.textContent = '0/300';
    const _tr = document.getElementById('addToReadNotes'); if (_tr) _tr.value = '';
    const _trc = document.getElementById('addToReadNotesCount'); if (_trc) _trc.textContent = '0/300';
    const _lang = document.getElementById('addLanguage'); if (_lang) _lang.innerHTML = languageOptionsHTML('English');
    const _aq = document.getElementById('addQuotes'); if (_aq) _aq.value = '';
    const _ap = document.getElementById('addPrivate'); if (_ap) _ap.checked = false;

    if (typeof window !== 'undefined' && window.App && typeof window.App.selectAddStatus === 'function') {
      window.App.selectAddStatus('finished');
    }

    const _pl = document.getElementById('periodLabel');
    if (_pl && typeof window !== 'undefined' && window.App) {
      _pl.textContent = window.App.quarterMode ? 'Quarter finished' : 'Month finished';
    }

    if (typeof window !== 'undefined' && window.App && typeof window.App.populatePeriodSelect === 'function') {
      window.App.populatePeriodSelect();
    }

    if (typeof window !== 'undefined' && window.App && typeof window.App.setAddMode === 'function') {
      window.App.setAddMode('search');
    }
  }
}

/**
 * Closes a modal overlay by ID and performs component cleanup.
 * @param {string} id Modal element ID
 */
export function closeModal(id) {
  if (typeof document === 'undefined') return;
  if (id === 'crAddModal') {
    closeModal('addBookModal');
    return;
  }
  const el = document.getElementById(id);
  if (!el) return;

  el.classList.remove('open');
  el.style.display = 'none';
  el.style.opacity = '0';
  el.style.visibility = 'hidden';
  el.style.pointerEvents = 'none';

  if (id === 'addBookModal') {
    if (typeof window !== 'undefined' && window.CameraScanner && typeof window.CameraScanner.stop === 'function') {
      window.CameraScanner.stop();
    }
  }

  if (id === 'editBookModal') {
    if (typeof window !== 'undefined' && window.App) {
      window.App._finishingBookId = null;
      window.App.editingBook = null;
    }
  }

  if (id === 'importModal') {
    const s1 = document.getElementById('importStep1');
    if (s1) s1.style.display = 'block';
    const s2 = document.getElementById('importStep2');
    if (s2) s2.style.display = 'none';
    const csv = document.getElementById('csvFileInput');
    if (csv) csv.value = '';
    const btn = document.getElementById('importConfirmBtn');
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Confirm Import';
    }
  }
}

export function handleOverlayClick(event, id) {
  if (event && event.target && (event.target.id === id || event.target === document.getElementById(id))) {
    closeModal(id);
  }
}

export function showToast(msg, type, duration) {
  if (typeof document === 'undefined') return;
  let t = document.getElementById('shelfToast');

  if (!t) {
    t = document.createElement('div');
    t.id = 'shelfToast';
    t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--wood-dark, #23160c);color:#f0e8dc;padding:12px 24px;border-radius:6px;font-family:"DM Mono",monospace;font-size:12px;letter-spacing:0.1em;z-index:2147483647 !important;opacity:0;transition:opacity 0.3s;max-width:420px;text-align:center;pointer-events:none;';
    document.body.appendChild(t);
  }

  const toastEl = document.getElementById('toast');
  if (toastEl) {
    toastEl.textContent = msg || '';
    toastEl.style.opacity = '1';
  }

  if (msg && typeof msg === 'string' && msg.includes('<')) {
    t.innerHTML = msg;
    t.style.pointerEvents = 'auto';
  } else {
    t.textContent = msg || '';
    t.style.pointerEvents = 'none';
  }

  t.style.opacity = '1';

  const dur = typeof duration === 'number' ? duration : (type === 'sticky' ? 5000 : 2500);
  clearTimeout(t._timer);
  t._timer = setTimeout(() => {
    t.style.opacity = '0';
    t.style.pointerEvents = 'none';
    if (toastEl) toastEl.style.opacity = '0';
  }, dur);
}

/**
 * Opens the book recommendation preview modal.
 * @param {string|HTMLElement} titleOrEvent Book title or DOM element with dataset
 * @param {string} [author]
 * @param {string} [cover]
 * @param {string} [reason]
 * @param {string} [synopsis]
 */
export function openBookModal(titleOrEvent, author, cover, reason, synopsis) {
  if (typeof document === 'undefined') return;
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
    if (synopsis) {
      s.innerText = synopsis;
      s.style.display = 'block';
    } else if (title) {
      s.innerHTML = '<span style="color:var(--wood-mid);font-style:italic;">Loading synopsis...</span>';
      s.style.display = 'block';
      
      const q = encodeURIComponent(title + (author ? ' ' + author : ''));
      const gbKey = (typeof localStorage !== 'undefined' && localStorage.getItem('sl_gb_key')) ? '&key=' + localStorage.getItem('sl_gb_key') : '';
      const gbUrl = 'https://www.googleapis.com/books/v1/volumes?q=' + q + '&maxResults=1' + gbKey;
      
      fetch(gbUrl)
        .then(res => res.json())
        .then(data => {
            const m = document.getElementById('bookModal');
            if (!m || m.style.display === 'none' || !m._currentBook || m._currentBook.title !== title) return;
            
            if (data.items && data.items.length > 0 && data.items[0].volumeInfo && data.items[0].volumeInfo.description) {
                s.innerText = data.items[0].volumeInfo.description;
            } else {
                // Fallback to OpenLibrary
                const olSearch = 'https://openlibrary.org/search.json?q=' + q + '&limit=1&fields=key';
                fetch(olSearch).then(r => r.json()).then(olData => {
                    const m2 = document.getElementById('bookModal');
                    if (!m2 || m2.style.display === 'none' || !m2._currentBook || m2._currentBook.title !== title) return;
                    
                    if (olData.docs && olData.docs.length > 0 && olData.docs[0].key) {
                        fetch('https://openlibrary.org' + olData.docs[0].key + '.json')
                            .then(r2 => r2.json())
                            .then(work => {
                                const m3 = document.getElementById('bookModal');
                                if (!m3 || m3.style.display === 'none' || !m3._currentBook || m3._currentBook.title !== title) return;
                                
                                let desc = work.description;
                                if (typeof desc === 'object' && desc.value) desc = desc.value;
                                if (desc) {
                                    s.innerText = desc;
                                } else {
                                    s.innerHTML = '<span style="color:var(--wood-mid);font-style:italic;">No synopsis available.</span>';
                                }
                            }).catch(() => s.innerHTML = '<span style="color:var(--wood-mid);font-style:italic;">No synopsis available.</span>');
                    } else {
                        s.innerHTML = '<span style="color:var(--wood-mid);font-style:italic;">No synopsis available.</span>';
                    }
                }).catch(() => s.innerHTML = '<span style="color:var(--wood-mid);font-style:italic;">No synopsis available.</span>');
            }
        })
        .catch(() => {
            // If GB fails entirely (e.g. 429), try OpenLibrary fallback immediately
            const olSearch = 'https://openlibrary.org/search.json?q=' + q + '&limit=1&fields=key';
            fetch(olSearch).then(r => r.json()).then(olData => {
                const m2 = document.getElementById('bookModal');
                if (!m2 || m2.style.display === 'none' || !m2._currentBook || m2._currentBook.title !== title) return;
                
                if (olData.docs && olData.docs.length > 0 && olData.docs[0].key) {
                    fetch('https://openlibrary.org' + olData.docs[0].key + '.json')
                        .then(r2 => r2.json())
                        .then(work => {
                            const m3 = document.getElementById('bookModal');
                            if (!m3 || m3.style.display === 'none' || !m3._currentBook || m3._currentBook.title !== title) return;
                            
                            let desc = work.description;
                            if (typeof desc === 'object' && desc.value) desc = desc.value;
                            if (desc) {
                                s.innerText = desc;
                            } else {
                                s.innerHTML = '<span style="color:var(--wood-mid);font-style:italic;">No synopsis available.</span>';
                            }
                        }).catch(() => s.innerHTML = '<span style="color:var(--wood-mid);font-style:italic;">No synopsis available.</span>');
                } else {
                    s.innerHTML = '<span style="color:var(--wood-mid);font-style:italic;">No synopsis available.</span>';
                }
            }).catch(() => {
                const m2 = document.getElementById('bookModal');
                if (m2 && m2.style.display !== 'none' && m2._currentBook && m2._currentBook.title === title) {
                    s.innerHTML = '<span style="color:var(--wood-mid);font-style:italic;">No synopsis available.</span>';
                }
            });
        });
    } else {
      s.innerText = '';
      s.style.display = 'none';
    }
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

  modal.classList.add('open');
  modal.style.display = 'flex';
  modal.style.opacity = '1';
  modal.style.visibility = 'visible';
  modal.style.pointerEvents = 'auto';
  if (typeof window !== 'undefined' && window.App && typeof window.App.openModal === 'function') {
    window.App.openModal('bookModal');
  }
  
  if (typeof window !== 'undefined') {
    window.App = window.App || {};
    window.App._modalZIndex = Math.max(99000, (window.App._modalZIndex || 2000000000) + 1);
    modal.style.setProperty('z-index', String(window.App._modalZIndex), 'important');
  } else {
    modal.style.setProperty('z-index', '2000009999', 'important');
  }
}

/**
 * Closes the book recommendation preview modal.
 */
export function closeBookModal() {
  if (typeof document === 'undefined') return;
  const modal = document.getElementById('bookModal');
  if (!modal) return;
  if (typeof window !== 'undefined' && window.App && typeof window.App.closeModal === 'function') {
    window.App.closeModal('bookModal');
  }
  modal.style.opacity = '0';
  modal.style.visibility = 'hidden';
  modal.style.pointerEvents = 'none';
  modal.classList.remove('open');
  modal.style.display = 'none';
}

/**
 * Copies a club invite deep link to clipboard and notifies user.
 * @param {string} [url]
 */
export function copyClubInviteLink(url) {
  const link = url || (typeof window !== 'undefined' ? window.location.href : '');
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    navigator.clipboard.writeText(link).catch(() => {});
  }
  if (typeof showToast === 'function') {
    showToast('Invite link copied!');
  } else if (typeof window !== 'undefined' && window.App && typeof window.App.showToast === 'function') {
    window.App.showToast('Invite link copied!');
  }
}

/**
 * Opens an invite modal (with offline QR Code and canonical deep link) for a book club or general invite.
 * @param {string|number} [clubId] Optional book club ID
 */
export function openInviteModal(clubId) {
  if (typeof document === 'undefined') return;

  const app = (typeof window !== 'undefined' && window.App) || {};
  let targetId = clubId;
  if (!targetId && app._currentClub) {
    targetId = app._currentClub;
  }
  if (!targetId && app._currentClubData && app._currentClubData.id) {
    targetId = app._currentClubData.id;
  }

  let club = null;
  const mockClubs = (typeof window !== 'undefined' && window._mockClubs) || [];
  const appClubs = app.clubs || [];
  if (targetId) {
    club = appClubs.find(c => String(c.id) === String(targetId)) ||
           mockClubs.find(c => String(c.id) === String(targetId)) ||
           (app._currentClubData && String(app._currentClubData.id) === String(targetId) ? app._currentClubData : null);
  }

  const effectiveId = targetId || (club && club.id) || 'mock_c1';
  const clubName = club?.name || (effectiveId === 'mock_c1' ? 'Sci-Fi Sundays' : (effectiveId === 'mock_c2' ? 'The Classics' : 'Book Club'));
  const inviteCode = club?.invite_code || ('PUBLIC_' + effectiveId);

  const origin = (typeof window !== 'undefined' && window.location.origin) || '';
  const pathname = (typeof window !== 'undefined' && window.location.pathname) || '/';
  const deepLinkUrl = `${origin}${pathname}#club/${encodeURIComponent(effectiveId)}`;

  let m = document.getElementById('clubInviteModal');
  if (!m) {
    m = document.createElement('div');
    m.id = 'clubInviteModal';
    m.className = 'modal-overlay invite-modal-overlay';
    m.onclick = (e) => { if (e.target === m) closeInviteModal(); };
    document.body.appendChild(m);
  }

  m.innerHTML = `
    <div class="modal-card" style="position:relative; max-width: 440px; width: 90%; text-align: center; padding: 36px 28px; box-sizing: border-box; background: var(--paper, #fdfbf7); border-radius: 16px; box-shadow: 0 20px 50px rgba(0,0,0,0.3);">
      <button class="modal-close" onclick="if(window.App && App.closeInviteModal){ App.closeInviteModal(); } else { closeInviteModal(); }" aria-label="Close" style="top: 14px; right: 14px; position: absolute; background: transparent; border: none; font-size: 22px; cursor: pointer; color: var(--wood-mid, #8B6343); padding: 6px; line-height: 1;">✕</button>
      <div style="font-family: 'Playfair Display', serif; font-size: 24px; font-weight: 700; color: var(--wood-dark, #2a1a10); margin-bottom: 8px;">Invite to ${esc(clubName)}</div>
      <div style="font-size: 13px; color: var(--wood-mid, #8B6343); margin-bottom: 20px; line-height: 1.4;">Scan this QR code or share the deep link below to invite friends to join.</div>
      
      <div style="display: flex; justify-content: center; align-items: center; margin-bottom: 20px;">
        <div style="padding: 12px; background: #ffffff; border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.08); border: 1px solid rgba(0,0,0,0.06); display: inline-flex;">
          <canvas id="clubInviteQrCanvas" width="180" height="180" style="display: block; border-radius: 6px; width: 180px; height: 180px;"></canvas>
        </div>
      </div>

      <div style="margin-bottom: 16px; display: flex; gap: 8px; align-items: center;">
        <input type="text" readonly id="clubInviteLinkInput" value="${esc(deepLinkUrl)}" style="flex: 1; min-width: 0; padding: 10px 12px; font-size: 12px; border: 1px solid rgba(61,43,31,0.2); border-radius: 8px; background: rgba(255,255,255,0.9); color: var(--wood-dark, #2a1a10); font-family: 'DM Mono', monospace; box-sizing: border-box;" onclick="this.select()" />
        <button class="btn-burgundy" onclick="if(window.App && App.copyClubInviteLink){ App.copyClubInviteLink('${esc(deepLinkUrl)}'); } else { copyClubInviteLink('${esc(deepLinkUrl)}'); }" style="padding: 10px 14px; font-size: 12px; font-weight: 700; border-radius: 8px; border: none; cursor: pointer; white-space: nowrap; flex-shrink: 0;">Copy Link</button>
      </div>

      <div style="background: rgba(139,38,53,0.05); border: 1px dashed rgba(139,38,53,0.3); border-radius: 10px; padding: 12px; margin-top: 8px;">
        <div style="font-size: 11px; color: var(--wood-mid, #8B6343); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; font-weight: 600;">Club Invite Code</div>
        <div style="font-family: 'DM Mono', monospace; font-size: 20px; font-weight: 700; color: var(--burgundy, #8B2635); letter-spacing: 0.1em;">${esc(inviteCode)}</div>
      </div>
    </div>
  `;

  m.classList.add('open');
  m.style.display = 'flex';
  m.style.opacity = '1';
  m.style.visibility = 'visible';
  m.style.pointerEvents = 'auto';
  if (typeof window !== 'undefined') {
    window.App = window.App || {};
    window.App._modalZIndex = Math.max(100000, (window.App._modalZIndex || 2000000000) + 1);
    m.style.setProperty('z-index', String(window.App._modalZIndex), 'important');
  }

  // Render QR Code onto the canvas
  const canvas = document.getElementById('clubInviteQrCanvas');
  if (canvas) {
    renderQRCodeToCanvas(canvas, deepLinkUrl, {
      size: 180,
      margin: 4,
      colorDark: '#2C2C2C',
      colorLight: '#FFFFFF'
    });
  }
}

/**
 * Closes the invite modal(s).
 */
export function closeInviteModal() {
  if (typeof document === 'undefined') return;
  const cModal = document.getElementById('clubInviteModal');
  if (cModal) {
    cModal.classList.remove('open');
    cModal.style.display = 'none';
    cModal.style.opacity = '0';
    cModal.style.visibility = 'hidden';
    cModal.style.pointerEvents = 'none';
  }
  const modal = document.getElementById('inviteModal');
  if (modal) {
    if (modal._openTimer) {
      clearTimeout(modal._openTimer);
      modal._openTimer = null;
    }
    if (modal._closeTimer) {
      clearTimeout(modal._closeTimer);
      modal._closeTimer = null;
    }
    modal.classList.remove('open');
    modal.style.display = 'none';
    modal.style.opacity = '0';
    modal.style.visibility = 'hidden';
    modal.style.pointerEvents = 'none';
  }
}

/**
 * Toggles the Floating Action Button (FAB) menu.
 */
export function toggleFabMenu() {
  if (typeof document === 'undefined') return;
  if (typeof window !== 'undefined' && window.App && window.App.isReadOnly) {
    if (typeof window.App.exitClubShelf === 'function') {
      window.App.exitClubShelf();
      return;
    }
  }
  try {
    if (typeof window !== 'undefined' && window.App && window.App._fabDebounce) return;
    if (typeof window !== 'undefined' && window.App) {
      window.App._fabDebounce = true;
      setTimeout(() => { if (window.App) window.App._fabDebounce = false; }, 400);
    }

    const menu = document.getElementById('fabMenuContainer');
    if (!menu) return;

    const open = menu.classList.toggle('open');
    menu.style.cssText = open
      ? 'display: flex !important; position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important; z-index: 999999 !important;'
      : 'display: none !important; position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important; z-index: 999999 !important;';
    menu.setAttribute('aria-hidden', open ? 'false' : 'true');

    const fabBtn = document.getElementById('fabAdd');
    if (fabBtn) fabBtn.classList.toggle('open', open);
  } catch (e) {
    console.error(e);
  }
}

/**
 * Closes the Floating Action Button (FAB) menu.
 */
export function closeFabMenu() {
  if (typeof document === 'undefined') return;
  const menu = document.getElementById('fabMenuContainer');
  if (!menu) return;
  menu.classList.remove('open');
  menu.style.cssText = 'display: none !important;';
  menu.setAttribute('aria-hidden', 'true');

  const fabBtn = document.getElementById('fabAdd');
  if (fabBtn) fabBtn.classList.remove('open');
}

/**
 * Opens Add Book Modal from the FAB or navigation menu.
 * @param {string} [mode] Optional mode ('search', 'scan', 'manual')
 */
export function openAddBookModalFromMenu(mode) {
  closeFabMenu();
  openModal('addBookModal');
  if (mode && typeof window !== 'undefined' && window.App && typeof window.App.setAddMode === 'function') {
    setTimeout(() => {
      try {
        window.App.setAddMode(mode);
      } catch (e) {
        console.warn(e);
      }
    }, 70);
  }
}

/**
 * Toggles the sidebar slide navigation drawer.
 */
export function toggleSlideMenu() {
  if (typeof document === 'undefined') return;
  try {
    const app = (typeof window !== 'undefined' && window.App) || {};
    app._slideMenuOpen = !app._slideMenuOpen;
    if (typeof window !== 'undefined' && window.App) window.App._slideMenuOpen = app._slideMenuOpen;

    const slideMenu = document.getElementById('slideMenu');
    const menuBackdrop = document.getElementById('menuBackdrop');
    const accountBtn = document.getElementById('accountBtn');

    if (slideMenu) {
      slideMenu.classList.toggle('open', app._slideMenuOpen);
      if (app._slideMenuOpen) {
        slideMenu.style.setProperty('z-index', '99000', 'important');
        slideMenu.style.setProperty('display', 'flex', 'important');
        slideMenu.style.setProperty('visibility', 'visible', 'important');
        slideMenu.style.setProperty('pointer-events', 'auto', 'important');
      } else {
        slideMenu.style.setProperty('display', 'none', 'important');
        slideMenu.style.setProperty('visibility', 'hidden', 'important');
        slideMenu.style.setProperty('pointer-events', 'none', 'important');
      }
    }
    if (menuBackdrop) {
      menuBackdrop.classList.toggle('open', app._slideMenuOpen);
      if (app._slideMenuOpen) {
        menuBackdrop.style.setProperty('z-index', '98000', 'important');
        menuBackdrop.style.setProperty('display', 'block', 'important');
        menuBackdrop.style.setProperty('visibility', 'visible', 'important');
        menuBackdrop.style.setProperty('pointer-events', 'auto', 'important');
      } else {
        menuBackdrop.style.setProperty('display', 'none', 'important');
        menuBackdrop.style.setProperty('visibility', 'hidden', 'important');
        menuBackdrop.style.setProperty('pointer-events', 'none', 'important');
      }
    }
    if (accountBtn) {
      accountBtn.classList.toggle('open', app._slideMenuOpen);
      if (app._slideMenuOpen) {
        accountBtn.style.setProperty('z-index', '99001', 'important');
      }
    }

    if (app._slideMenuOpen) {
      if (typeof window !== 'undefined' && window.App && typeof window.App._updateSlideMenuInfo === 'function') {
        window.App._updateSlideMenuInfo();
      }
      document.querySelectorAll('#slideMenu .menu-item').forEach((el, i) => {
        el.classList.remove('stagger');
        void el.offsetWidth;
        el.classList.add('stagger');
        el.style.animationDelay = (i * 0.04) + 's';
      });
    }
  } catch (e) {
    console.error('Slide Menu Error:', e);
  }
}

/**
 * Closes the sidebar slide navigation drawer.
 */
export function closeSlideMenu() {
  if (typeof document === 'undefined') return;
  if (typeof window !== 'undefined' && window.App) window.App._slideMenuOpen = false;

  const slideMenu = document.getElementById('slideMenu');
  const menuBackdrop = document.getElementById('menuBackdrop');
  const accountBtn = document.getElementById('accountBtn');

  if (slideMenu) {
    slideMenu.classList.remove('open');
    slideMenu.style.setProperty('display', 'none', 'important');
    slideMenu.style.setProperty('visibility', 'hidden', 'important');
    slideMenu.style.setProperty('pointer-events', 'none', 'important');
  }
  if (menuBackdrop) {
    menuBackdrop.classList.remove('open');
    menuBackdrop.style.setProperty('display', 'none', 'important');
    menuBackdrop.style.setProperty('visibility', 'hidden', 'important');
    menuBackdrop.style.setProperty('pointer-events', 'none', 'important');
  }
  if (accountBtn) {
    accountBtn.classList.remove('open');
  }
}

/**
 * Toggles the gear overlay menu.
 */
export function toggleGearMenu() {
  if (typeof document === 'undefined') return;
  const menu = document.getElementById('gearOverlayMenu');
  if (menu) menu.classList.toggle('open');
}

/**
 * Toggles the shelf filter panel drawer.
 */
export function toggleFilterPanel() {
  if (typeof document === 'undefined') return;
  if (typeof window !== 'undefined' && window.App && typeof window.App._populateMoodFilter === 'function') {
    window.App._populateMoodFilter();
  }

  const panel = document.getElementById('filterOverlayPanel');
  const btn = document.getElementById('filterToggleBtn');
  const fmtBar = document.getElementById('formatFilterBar');

  if (!panel) return;

  const isOpen = panel.classList.contains('open');
  panel.classList.toggle('open', !isOpen);

  if (fmtBar) fmtBar.style.display = isOpen ? 'none' : 'flex';
  if (btn) btn.classList.toggle('active', !isOpen);

  if (!isOpen && typeof window !== 'undefined' && window.App && typeof window.App.buildFilterBar === 'function') {
    window.App.buildFilterBar();
  }
}

/**
 * Closes the social share drawer and overlay.
 */
export function closeShareMenu() {
  if (typeof document === 'undefined') return;
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
  if (typeof window !== 'undefined' && window.App && window.App._shareEscHandler) {
    document.removeEventListener('keydown', window.App._shareEscHandler);
    window.App._shareEscHandler = null;
  }
}

/**
 * Reparents FAB elements to document.body to prevent layout distortion from nested containers.
 */
export function rescueButtons() {
  if (typeof document === 'undefined') return;
  const fabAdd = document.getElementById('fabAdd');
  const fabShare = document.getElementById('fabShare');
  const shareDrawerOverlay = document.getElementById('shareDrawerOverlay');
  const shareDrawer = document.getElementById('shareDrawer');
  const fabMenuContainer = document.getElementById('fabMenuContainer');

  if (fabAdd && fabAdd.parentElement !== document.body) document.body.appendChild(fabAdd);
  if (fabMenuContainer && fabMenuContainer.parentElement !== document.body) document.body.appendChild(fabMenuContainer);
  if (fabShare && fabShare.parentElement !== document.body) document.body.appendChild(fabShare);
  if (shareDrawerOverlay && shareDrawerOverlay.parentElement !== document.body) document.body.appendChild(shareDrawerOverlay);
  if (shareDrawer && shareDrawer.parentElement !== document.body) document.body.appendChild(shareDrawer);
}

// Tooltip State & Cache
let portal, ttBar, ttTitle, ttByline, ttBadges, ttData, ttReview;
export function initTTElements() {
  if (typeof document === 'undefined') return;
  if (!portal) {
    portal = document.getElementById('tt-portal');
    ttBar = document.getElementById('ttBar');
    ttTitle = document.getElementById('ttTitle');
    ttByline = document.getElementById('ttByline');
    ttBadges = document.getElementById('ttBadges');
    ttData = document.getElementById('ttData');
    ttReview = document.getElementById('ttReview');
  }
}

let _ttWordCache = { ver: -1, maxW: 20000, minW: 1000 };
function _refreshWordCache() {
  const books = (typeof window !== 'undefined' && window.App && window.App.books) || [];
  const ver = books.length + (books[0]?.id || '');
  if (_ttWordCache.ver === ver) return;

  let maxW = 20000, minW = 1000;
  for (let i = 0; i < books.length; i++) {
    if (!books[i]) continue;
    const w = books[i].words;
    if (w > maxW) maxW = w;
    if (w < minW) minW = w;
  }
  _ttWordCache = { ver, maxW, minW };
}

/**
 * Displays a book tooltip on spine hover.
 * @param {Object} book Book data object
 * @param {MouseEvent} e Mouse event
 */
export function showTT(book, e) {
  if (typeof document === 'undefined' || !book) return;
  initTTElements();
  if (!portal) return;

  const isCR = book.currentlyReading || book._isCR;
  _refreshWordCache();

  const c = COLORS[book.sentiment || 'mixed'] || '#8b6343';
  const maxW = _ttWordCache.maxW;
  const minW = _ttWordCache.minW;
  const wcPct = Math.round((book.words - minW) / (maxW - minW || 1) * 100);

  if (ttBar) {
    ttBar.style.background = isCR ? 'linear-gradient(90deg,#c89018,#c89018cc)' : `linear-gradient(90deg,${c},${c}cc)`;
  }

  const _ttFlag = (typeof window !== 'undefined' && window.WikidataAPI && window.WikidataAPI.getBookFlag ? window.WikidataAPI.getBookFlag(book) : '') || '';
  const currentYear = (typeof window !== 'undefined' && window.App && window.App.currentYear) || new Date().getFullYear();
  const dateInfo = isCR
    ? (book.dateStarted ? 'Started ' + new Date(book.dateStarted).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Currently reading')
    : (book.month ? book.month.slice(0, 3) : '') + ' ' + currentYear;

  if (ttTitle) {
    ttTitle.innerHTML = `<div class="tt-cover-row"><img class="tt-cover" referrerpolicy="no-referrer" loading="lazy" src="${book.cover || book.coverUrl || book.fallbackCover || ''}" onerror="this.src='${book.fallbackCover || ''}'" alt=""><div class="tt-cover-meta"><div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:18px;font-weight:700;font-style:italic;line-height:1.15;margin-bottom:6px;color:var(--wood-dark);">${isCR ? '📖 ' : ''}${esc(book.title)}</div><div style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:var(--wood-light);">${_ttFlag ? _ttFlag + ' ' : ''}${esc(book.author)} · ${dateInfo}${book.year ? ' · pub. ' + book.year : ''}</div></div></div>`;
  }

  if (ttByline) ttByline.textContent = '';

  const fmtBadge = book.format === 'audiobook' ? '<span class="tt-badge-genre">🎧 Audiobook</span>' : book.format === 'ebook' ? '<span class="tt-badge-genre">📱 E-book</span>' : '';
  const crBadge = isCR
    ? '<span class="tt-badge-sentiment" style="background:rgba(200,144,24,0.15);color:#c89018;">📖 Currently Reading</span>'
    : `<span class="tt-badge-sentiment" style="background:${c}22;color:${c}">${LABELS[book.sentiment] || book.sentiment || ''}</span>`;

  if (ttBadges) {
    ttBadges.innerHTML = `${crBadge}<span class="tt-badge-genre">${esc(book.genre || '')}</span>${fmtBadge}`;
  }

  if (ttData) {
    if (isCR) {
      const daysElapsed = book.dateStarted ? Math.max(1, Math.floor((Date.now() - new Date(book.dateStarted).getTime()) / 86400000)) : null;
      const allBooks = (typeof window !== 'undefined' && window.App && window.App.books) || [];
      const avgPace = allBooks.filter(b => !b.currentlyReading && b.days > 0);
      const avgDays = avgPace.length ? Math.round(avgPace.reduce((s, b) => s + (Number(b.days) || 0), 0) / avgPace.length) : null;
      const estComplete = (book.dateStarted && avgDays) ? new Date(new Date(book.dateStarted).getTime() + avgDays * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null;

      ttData.innerHTML = `<div class="tt-data-cell"><span class="tt-data-num">${Math.round((book.words || 0) / 1000)}k</span><span class="tt-data-lbl">Words</span></div><div class="tt-data-cell"><span class="tt-data-num">${daysElapsed || ' - '}</span><span class="tt-data-lbl">Days so far</span></div>${estComplete ? `<div class="tt-data-cell"><span class="tt-data-num" style="font-size:14px;">${estComplete}</span><span class="tt-data-lbl">Est. finish</span></div>` : ''}`;
    } else {
      const durCell = book.format === 'audiobook' && book.durationHours ? `<div class="tt-data-cell"><span class="tt-data-num">${Math.floor(book.durationHours)}h ${Math.round((book.durationHours % 1) * 60)}m</span><span class="tt-data-lbl">Duration</span></div>` : '';
      ttData.innerHTML = `<div class="tt-data-cell"><span class="tt-data-num">${Math.round((book.words || 0) / 1000)}k</span><span class="tt-data-lbl">Words</span></div><div class="tt-data-cell"><span class="tt-data-num">${book.days || 0}</span><span class="tt-data-lbl">Days</span></div><div class="tt-data-cell"><span class="tt-data-num">${book.days ? Math.round((book.words || 0) / book.days).toLocaleString() : ' - '}</span><span class="tt-data-lbl">w / day</span></div>${durCell}`;
    }
  }

  const wcSrc = typeof window !== 'undefined' && window.WordCountAPI && window.WordCountAPI.getSource ? window.WordCountAPI.getSource(book) : '';
  const wcSrcLabel = wcSrc === 'user_override' ? '✓ manual' : wcSrc === 'openlibrary' ? '📚 API' : wcSrc === 'googlebooks' ? '📖 API' : wcSrc === 'calculated' ? '⚠ est.' : wcSrc === 'provided' ? '✓' : '⚠ est.';
  const wcSrcColor = wcSrc === 'unknown' ? 'color:#b8860b;' : '';

  if (ttReview) {
    ttReview.innerHTML = `<div class="tt-wc-bar-wrap"><div class="tt-wc-bar-label"><span>Word Count <span style="font-size:8px;opacity:0.7;${wcSrcColor}">${wcSrcLabel}</span></span><div style="display:flex;flex-direction:column;align-items:flex-end;line-height:1.2;"><strong>${(book.words || 0).toLocaleString()}</strong>${isWordCountEstimated(book) ? '<span style="font-size:8px;opacity:0.5;margin-top:1px;font-family:\'DM Mono\',monospace;letter-spacing:0.04em;">⚡ ESTIMATE</span>' : ''}</div></div><div class="tt-wc-track"><div class="tt-wc-fill" style="width:${Math.max(4, wcPct)}%;background:${isCR ? '#c89018' : c}"></div></div></div>${book.review ? `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12.5px;font-style:italic;line-height:1.7;color:rgba(92,61,42,0.8);border-top:1px solid rgba(61,43,31,0.08);padding-top:13px;">${esc(book.review)}</div>` : ''}<div style="font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:rgba(139,99,67,0.45);margin-top:12px;text-align:center;cursor:pointer;padding:4px 0;">${isCR ? 'Right-click for options' : 'Click spine to expand ↗'}</div>`;
  }

  portal.classList.add('visible');
  if (portal.firstElementChild) void portal.firstElementChild.offsetHeight;
  if (e) moveTT(e);
}

/**
 * Moves tooltip with the mouse pointer, handling viewport boundaries.
 * @param {MouseEvent} e
 */
export function moveTT(e) {
  if (typeof document === 'undefined' || !e) return;
  initTTElements();
  if (!portal) return;
  const card = portal.firstElementChild;
  if (!card) return;

  const w = card.offsetWidth || 300;
  const h = card.offsetHeight || 280;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const pad = 12;
  const gap = 18;

  let x = e.clientX + gap;
  if (x + w > vw - pad) x = e.clientX - w - gap;
  if (x < pad) x = pad;
  if (x + w > vw - pad) x = vw - w - pad;

  let y = e.clientY - Math.min(h / 2, vh * 0.3);
  if (y < pad) y = pad;
  if (y + h > vh - pad) y = Math.max(pad, vh - h - pad);
  if (h > vh - pad * 2) y = pad;

  portal.style.left = x + 'px';
  portal.style.top = y + 'px';
}

/**
 * Hides the spine hover tooltip.
 */
export function hideTT() {
  if (typeof document === 'undefined') return;
  initTTElements();
  if (portal) portal.classList.remove('visible');
}

// Chart Tooltip Helpers
let _chartTTInstance = null;
export function getChartTT() {
  if (typeof document === 'undefined') return null;
  if (!_chartTTInstance) _chartTTInstance = document.getElementById('chart-tt');
  return _chartTTInstance;
}

export function showChartTT(html, e) {
  if (typeof document === 'undefined') return;
  const chartTT = getChartTT();
  if (!chartTT) return;
  clearTimeout(chartTT._hideTimer);
  if (!chartTT.parentNode || chartTT.parentNode !== document.body) {
    document.body.appendChild(chartTT);
  }
  chartTT.innerHTML = html;
  chartTT.style.display = 'block';
  void chartTT.offsetHeight;
  chartTT.style.opacity = '1';
  if (e) moveChartTT(e);
}

export function moveChartTT(e) {
  if (typeof document === 'undefined') return;
  const chartTT = getChartTT();
  if (!chartTT || !e) return;
  const w = chartTT.offsetWidth || 200;
  const h = chartTT.offsetHeight || 80;
  const pad = 12;
  const gap = 16;

  let x = e.pageX + gap;
  let y = e.pageY - Math.min(h / 2, 100);

  const docW = (document.documentElement && document.documentElement.scrollWidth) || window.innerWidth;
  const docH = (document.documentElement && document.documentElement.scrollHeight) || window.innerHeight;

  if (x + w > docW - pad) x = e.pageX - w - gap;
  if (x < pad) x = pad;
  if (y + h > docH - pad) y = docH - h - pad;
  if (y < pad) y = pad;

  chartTT.style.left = x + 'px';
  chartTT.style.top = y + 'px';
}

export function hideChartTT() {
  if (typeof document === 'undefined') return;
  const chartTT = getChartTT();
  if (!chartTT) return;
  chartTT.style.opacity = '0';
  clearTimeout(chartTT._hideTimer);
  chartTT._hideTimer = setTimeout(() => {
    chartTT.style.display = 'none';
  }, 150);
  chartTT._activeEl = null;
}

// Slide-In Book Panel Helpers
let bookPanel, bpBar, bpCover, bpTitle, bpAuthor, bpBadges, bpStats, bpReview, bpClose;
function initBPElements() {
  if (typeof document === 'undefined') return;
  if (!bookPanel) {
    bookPanel = document.getElementById('book-panel');
    bpBar = document.getElementById('bpBar');
    bpCover = document.getElementById('bpCover');
    bpTitle = document.getElementById('bpTitle');
    bpAuthor = document.getElementById('bpAuthor');
    bpBadges = document.getElementById('bpBadges');
    bpStats = document.getElementById('bpStats');
    bpReview = document.getElementById('bpReview');
    bpClose = document.getElementById('bpClose');
    if (bpClose) bpClose.addEventListener('click', closePanel);
    if (bookPanel) bookPanel.addEventListener('click', e => { if (e.target === bookPanel) closePanel(); });
  }
}

/**
 * Opens slide-in book details panel.
 * @param {Object|string} book Book data object or book ID string
 */
export function openPanel(book) {
  if (typeof document === 'undefined') return;
  initBPElements();
  if (typeof book === 'string' && typeof window !== 'undefined' && window.App && typeof window.App._findBookById === 'function') {
    const found = window.App._findBookById(book);
    if (found) book = found;
  } else if (book && book.id && typeof window !== 'undefined' && window.App && typeof window.App._findBookById === 'function') {
    book = window.App._findBookById(book.id) || book;
  }
  if (book === 'book-panel' || (typeof book === 'string' && document.getElementById(book))) {
    const p = document.getElementById(book);
    if (p) {
      p.classList.add('open');
      p.style.display = 'flex';
      if (document.body) document.body.style.overflow = 'hidden';
      if (document.documentElement) document.documentElement.style.overflow = 'hidden';
      return;
    }
  }
  if (document.body) document.body.style.overflow = 'hidden';
  if (document.documentElement) document.documentElement.style.overflow = 'hidden';

  if (!book) return;
  hideTT();

  if (typeof window !== 'undefined' && window.App && typeof window.App.openBookPanel === 'function') {
    window.App.openBookPanel(book);
    return;
  }

  // Standalone panel rendering fallback if App is not yet initialized
  if (bookPanel) {
    const isCR = book.currentlyReading || book.status === 'reading';
    const c = COLORS[book.sentiment] || (isCR ? '#c89018' : (COLORS['mixed'] || '#8b6343'));
    if (bpBar) bpBar.style.background = `linear-gradient(90deg,${c},${c}cc)`;
    if (bpCover) {
      bpCover.referrerPolicy = 'no-referrer';
      bpCover.classList.add('cover-skeleton');
      bpCover.style.visibility = 'visible';
      bpCover.alt = book.title || '';
      bpCover.onload = function() { this.classList.remove('cover-skeleton'); };
      bpCover.onerror = function() {
        this.classList.remove('cover-skeleton');
        if (this.src !== book.fallbackCover) this.src = book.fallbackCover || '';
      };
      bpCover.src = book.cover || book.coverUrl || book.fallbackCover || '';
    }

    const _fmtIcon = isCR ? '\u{1F4D6} ' : book.format === 'audiobook' ? '\u{1F3A7} ' : book.format === 'ebook' ? '\u{1F4F1} ' : '';
    if (bpTitle) bpTitle.textContent = _fmtIcon + (book.title || 'Untitled');

    let flag = (typeof window !== 'undefined' && window.WikidataAPI && window.WikidataAPI.getBookFlag) ? window.WikidataAPI.getBookFlag(book) : '';
    const genderIcon = (book.authorGender || '').toLowerCase() === 'male' ? ' \u2642' : (book.authorGender || '').toLowerCase() === 'female' ? ' \u2640' : '';
    const curYear = (typeof window !== 'undefined' && window.App?.currentYear) || new Date().getFullYear();
    const dateLabel = isCR ? (book.dateStarted ? 'Started ' + new Date(book.dateStarted).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Currently Reading') : ((book.month || '') + ' ' + curYear);

    if (bpAuthor) {
      bpAuthor.innerHTML = (flag ? '<span style="font-size:28px;vertical-align:middle;margin-right:6px;">' + flag + '</span>' : '') + esc(book.author || '') + genderIcon + ' &middot; ' + dateLabel;
      if (book.seriesName) {
        bpAuthor.innerHTML += `<div style="font-size:12px;font-style:italic;color:var(--wood-mid);margin-top:2px;">\u{1F4DA} ${esc(book.seriesName)}${book.seriesNumber ? ' #' + book.seriesNumber : ''}</div>`;
      }
    }

    if (bpBadges) bpBadges.innerHTML = '';

    const _genreEl = document.getElementById('bpCoverGenre');
    if (_genreEl) {
      if (book.genre) {
        _genreEl.textContent = book.genre;
        _genreEl.style.display = 'block';
      } else {
        _genreEl.style.display = 'none';
      }
    }

    const _mtEl = document.getElementById('bpMoodTags');
    if (_mtEl) {
      const bpFmtBadge = book.format === 'audiobook' ? '<span class="bp-badge" style="background:rgba(99,71,186,0.1);color:rgba(99,71,186,0.8);border:1px solid rgba(99,71,186,0.2);">\u{1F3A7} Audiobook</span>' : book.format === 'ebook' ? '<span class="bp-badge" style="background:rgba(59,130,246,0.1);color:rgba(59,130,246,0.8);border:1px solid rgba(59,130,246,0.2);">\u{1F4F1} E-book</span>' : '';
      const moodBadges = (book.moods && book.moods.length) ? ' ' + book.moods.slice(0, 3).map(m => `<span class="mood-badge">${esc(m)}</span>`).join(' ') : '';
      let combinedHTML = '';
      if (bpFmtBadge) combinedHTML += bpFmtBadge + ' ';
      if (moodBadges) combinedHTML += moodBadges;
      if (combinedHTML.trim().length > 0) {
        _mtEl.innerHTML = combinedHTML;
        _mtEl.style.display = 'flex';
        _mtEl.style.flexWrap = 'wrap';
        _mtEl.style.gap = '8px';
      } else {
        _mtEl.style.display = 'none';
        _mtEl.innerHTML = '';
      }
    }

    const bpDurStat = book.format === 'audiobook' && book.durationHours ? `<div class="bp-stat"><span class="bp-stat-num">${Math.floor(book.durationHours)}h ${Math.round((book.durationHours % 1) * 60)}m</span><span class="bp-stat-lbl">Duration</span></div>` : '';
    const _panelDays = isCR ? (book.dateStarted ? Math.max(1, Math.floor((Date.now() - new Date(book.dateStarted).getTime()) / 86400000)) : null) : (book.days || book.days_to_read || null);
    const _panelDaysLabel = isCR ? 'Days so far' : 'Days';
    const numWords = book.words || book.word_count || 0;

    if (bpStats) {
      bpStats.innerHTML = `<div class="bp-stat"><span class="bp-stat-num">${Math.round(numWords / 1000)}k</span><span class="bp-stat-lbl">Words</span></div><div class="bp-stat"><span class="bp-stat-num">${_panelDays || ' - '}</span><span class="bp-stat-lbl">${_panelDaysLabel}</span></div><div class="bp-stat"><span class="bp-stat-num">${_panelDays ? Math.round(numWords / _panelDays).toLocaleString() : ' - '}</span><span class="bp-stat-lbl">w / day</span></div>${bpDurStat}`;
    }

    if (bpReview) {
      bpReview.textContent = book.review || 'No review.';
    }

    const _quotesSection = document.getElementById('bpQuotesSection');
    const _quotesEl = document.getElementById('bpQuotes');
    if (_quotesSection && _quotesEl) {
      const _qlines = (book.favoriteQuotes || '').split('\n').map(s => s.trim()).filter(Boolean);
      if (_qlines.length) {
        _quotesEl.innerHTML = _qlines.map(q => `<blockquote class="bp-quote">${esc(q)}</blockquote>`).join('');
        _quotesSection.style.display = 'block';
      } else {
        _quotesSection.style.display = 'none';
        _quotesEl.innerHTML = '';
      }
    }

    const narSecEl = document.getElementById('bpNarratorSection');
    if (narSecEl) {
      if (book.format === 'audiobook' && book.narrator) {
        narSecEl.innerHTML = `<span class="bp-section-label">\u{1F5E3}\u{FE0F} Narrator</span><div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;font-weight:700;color:var(--wood-dark);margin:6px 0 10px;">${esc(book.narrator)}</div>`;
        narSecEl.style.display = 'block';
      } else {
        narSecEl.style.display = 'none';
        narSecEl.innerHTML = '';
      }
    }

    const _bpActions = document.getElementById('bpActions');
    if (_bpActions) {
      if (book.id && typeof window !== 'undefined' && window.App && typeof window.App.openEditModal === 'function') {
        _bpActions.innerHTML = `<button class="btn-secondary" style="padding:6px 14px;font-size:12px;" onclick="closePanel();App.openEditModal(window.App._findBookById('${book.id}'))">\u{270E}\u{FE0F} Edit Book</button>`;
      } else {
        _bpActions.innerHTML = '';
      }
    }

    if (typeof window !== 'undefined' && window.App && typeof window.App._renderLibraryLink === 'function') {
      const _libEl = document.getElementById('bpLibrary');
      if (_libEl) window.App._renderLibraryLink(book, _libEl);
    }
    if (typeof window !== 'undefined' && window.App && typeof window.App._renderJournalSection === 'function') {
      const _panelRoot = document.getElementById('book-panel');
      if (_panelRoot) window.App._renderJournalSection(book, _panelRoot);
    }
    if (typeof window !== 'undefined' && window.App && typeof window.App._loadFollowersSameBook === 'function') {
      const _followerChip = document.getElementById('bpFollowerChip');
      if (_followerChip) window.App._loadFollowersSameBook(book, _followerChip);
    }

    bookPanel.classList.add('open');
    bookPanel.style.display = 'flex';
    bookPanel.style.opacity = '1';
    bookPanel.style.visibility = 'visible';
    bookPanel.style.pointerEvents = 'auto';
    if (typeof window !== 'undefined') {
      window.App = window.App || {};
      window.App._modalZIndex = Math.max(99000, (window.App._modalZIndex || 2000000000) + 1);
      bookPanel.style.setProperty('z-index', String(window.App._modalZIndex), 'important');
    }
  }
}

/**
 * Closes slide-in book details panel.
 */
export function closePanel(panelId) {
  if (typeof document === 'undefined') return;
  const panel = (typeof panelId === 'string' && document.getElementById(panelId)) || document.getElementById('book-panel');
  if (panel) {
    panel.classList.remove('open');
    panel.style.display = 'none';
    panel.style.opacity = '0';
    panel.style.visibility = 'hidden';
    panel.style.pointerEvents = 'none';
  }
  if (document.body) document.body.style.overflow = '';
  if (document.documentElement) document.documentElement.style.overflow = '';
}

export function attachTT(el, book, bookIdx) {
  if (!el || !book) return;
  el.addEventListener('mouseenter', (e) => showTT(book, e));
  el.addEventListener('mousemove', (e) => moveTT(e));
  el.addEventListener('mouseleave', () => hideTT());
}


// Fallback intersection observer
if (typeof window !== 'undefined') {
  window.revealOnScroll = function(el, cb, threshold){
    if(!el || typeof cb !== 'function') return;
    if(typeof IntersectionObserver === 'undefined'){ try{cb(el, true);}catch(e) { console.warn(e); } return; }
    const ob = new IntersectionObserver((entries)=>{
      entries.forEach(entry=>{
        try{cb(el, entry.isIntersecting);}catch(e) { console.warn(e); }
      });
    }, { threshold: threshold || 0.12 });
    ob.observe(el);
  };
}



export function updateShelfScrollIndicators() {
  if (typeof document === 'undefined') return;
  const mainScroll = document.getElementById('mainScrollArea');
  const indicator = document.getElementById('shelfScrollIndicator');

  if (mainScroll) {
    const hasOverflow = mainScroll.scrollWidth - mainScroll.clientWidth > 4;
    const atEnd = mainScroll.scrollLeft + mainScroll.clientWidth >= mainScroll.scrollWidth - 20;
    if (indicator) {
      if (!hasOverflow) {
        indicator.style.display = 'none';
      } else {
        indicator.style.display = 'flex';
        indicator.style.opacity = atEnd ? '0.2' : '1';
      }
    }
    const wrapper = mainScroll.closest('.shelf-scroll-wrapper');
    if (wrapper) wrapper.classList.toggle('scrolled-end', atEnd);
  }

  const aggScroll = document.getElementById('aggScrollArea');
  if (aggScroll) {
    const atEnd = aggScroll.scrollLeft + aggScroll.clientWidth >= aggScroll.scrollWidth - 20;
    const wrapper = aggScroll.closest('.shelf-scroll-wrapper');
    if (wrapper) wrapper.classList.toggle('scrolled-end', atEnd);
  }
}

export function initShelfScrolling() {
  if (typeof document === 'undefined') return;

  function bindScrollContainer(scrollArea) {
    if (!scrollArea || scrollArea._shelfScrollBound) return;
    scrollArea._shelfScrollBound = true;

    // Horizontal wheel translation
    scrollArea.addEventListener('wheel', (e) => {
      const hasOverflow = scrollArea.scrollWidth - scrollArea.clientWidth > 4;
      if (!hasOverflow) return;
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (delta === 0) return;

      const atStart = scrollArea.scrollLeft <= 0;
      const atEnd = scrollArea.scrollLeft + scrollArea.clientWidth >= scrollArea.scrollWidth - 1;

      if ((delta < 0 && atStart) || (delta > 0 && atEnd)) return;

      e.preventDefault();
      const targetLeft = Math.max(0, Math.min(scrollArea.scrollWidth - scrollArea.clientWidth, scrollArea.scrollLeft + delta));
      if (typeof scrollArea.scrollTo === 'function') {
        scrollArea.scrollTo({ left: targetLeft, behavior: 'instant' });
      } else {
        scrollArea.scrollLeft = targetLeft;
      }
      updateShelfScrollIndicators();
    }, { passive: false });

    // Pointer / mouse drag-to-scroll with click threshold protection
    let isDown = false;
    let startX = 0;
    let startScrollLeft = 0;
    let isDragging = false;
    const DRAG_THRESHOLD = 5;

    scrollArea.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (e.target && (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) {
        return;
      }
      isDown = true;
      isDragging = false;
      startX = e.pageX;
      startScrollLeft = scrollArea.scrollLeft;
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      const dx = e.pageX - startX;
      if (!isDragging && Math.abs(dx) > DRAG_THRESHOLD) {
        isDragging = true;
        scrollArea.classList.add('is-dragging');
      }
      if (isDragging) {
        e.preventDefault();
        const targetLeft = Math.max(0, Math.min(scrollArea.scrollWidth - scrollArea.clientWidth, startScrollLeft - dx));
        if (typeof scrollArea.scrollTo === 'function') {
          scrollArea.scrollTo({ left: targetLeft, behavior: 'instant' });
        } else {
          scrollArea.scrollLeft = targetLeft;
        }
        updateShelfScrollIndicators();
      }
    });

    const onMouseUp = () => {
      if (!isDown) return;
      isDown = false;
      scrollArea.classList.remove('is-dragging');
      if (isDragging) {
        const captureClick = (clickEvent) => {
          clickEvent.stopPropagation();
          clickEvent.preventDefault();
          window.removeEventListener('click', captureClick, true);
        };
        window.addEventListener('click', captureClick, true);
        setTimeout(() => {
          window.removeEventListener('click', captureClick, true);
          isDragging = false;
        }, 50);
      }
    };

    window.addEventListener('mouseup', onMouseUp);
    scrollArea.addEventListener('scroll', updateShelfScrollIndicators);
  }

  const mainScrollArea = document.getElementById('mainScrollArea');
  if (mainScrollArea) bindScrollContainer(mainScrollArea);

  const aggScrollArea = document.getElementById('aggScrollArea');
  if (aggScrollArea) bindScrollContainer(aggScrollArea);

  document.querySelectorAll('.shelf-scroll-area').forEach(bindScrollContainer);

  const indicator = document.getElementById('shelfScrollIndicator');
  if (indicator && !indicator._shelfIndicatorBound) {
    indicator._shelfIndicatorBound = true;

    indicator.addEventListener('click', () => {
      const scrollArea = document.getElementById('mainScrollArea');
      if (scrollArea) {
        scrollArea.scrollBy({ left: 400, behavior: 'smooth' });
      }
    });

    indicator.addEventListener('wheel', (e) => {
      const scrollArea = document.getElementById('mainScrollArea');
      if (scrollArea) {
        e.preventDefault();
        scrollArea.scrollBy({ left: e.deltaY * 2, behavior: 'auto' });
      }
    }, { passive: false });

    indicator.addEventListener('mouseenter', () => {
      indicator.style.opacity = '1';
    });

    indicator.addEventListener('mouseleave', () => {
      updateShelfScrollIndicators();
    });
  }

  if (!window._shelfResizeBound) {
    window._shelfResizeBound = true;
    window.addEventListener('resize', updateShelfScrollIndicators);
  }

  updateShelfScrollIndicators();
  setTimeout(updateShelfScrollIndicators, 300);
  setTimeout(updateShelfScrollIndicators, 1000);
}

if (typeof window !== 'undefined') {
  window.App = window.App || {};
  window.App.openModal = openModal;
  window.App.closeModal = closeModal;
  window.App.openBookModal = openBookModal;
  window.App.closeBookModal = closeBookModal;
  window.App.openInviteModal = openInviteModal;
  window.App.closeInviteModal = closeInviteModal;
  window.App.copyClubInviteLink = copyClubInviteLink;
  window.App.toggleSlideMenu = toggleSlideMenu;
  window.App.closeSlideMenu = closeSlideMenu;
  window.App.toggleFabMenu = toggleFabMenu;
  window.App.closeFabMenu = closeFabMenu;
  window.App.toggleGearMenu = toggleGearMenu;
  window.App.toggleFilterPanel = toggleFilterPanel;
  window.App.closeShareMenu = closeShareMenu;
  window.App.openPanel = openPanel;
  window.App.closePanel = closePanel;
  window.App.showToast = showToast;
  window.App.handleOverlayClick = handleOverlayClick;

  window.openModal = openModal;
  window.closeModal = closeModal;
  window.openBookModal = openBookModal;
  window.closeBookModal = closeBookModal;
  window.openInviteModal = openInviteModal;
  window.closeInviteModal = closeInviteModal;
  window.copyClubInviteLink = copyClubInviteLink;
  window.toggleSlideMenu = toggleSlideMenu;
  window.closeSlideMenu = closeSlideMenu;
  window.toggleFabMenu = toggleFabMenu;
  window.closeFabMenu = closeFabMenu;
  window.toggleGearMenu = toggleGearMenu;
  window.toggleFilterPanel = toggleFilterPanel;
  window.closeShareMenu = closeShareMenu;
  window.openPanel = openPanel;
  window.closePanel = closePanel;
  window.showToast = showToast;
  window.handleOverlayClick = handleOverlayClick;
  window.languageOptionsHTML = languageOptionsHTML;
  window.languageBadge = languageBadge;
  window.esc = esc;
}


