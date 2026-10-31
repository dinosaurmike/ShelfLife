// Extracted Community logic from full_script.js
import { DB, dbToBook, coverPlaceholder, _supabase } from '../core/db.js';
import { App } from '../core/app.js';
import { COLORS, LABELS, ALL_MONTHS } from '../utils/constants.js';
import { getBookReadYear } from './bookshelf.js';

export function formatChatDate(dateInput) {
  const d = (dateInput instanceof Date) ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfTarget = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const msPerDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((startOfToday - startOfTarget) / msPerDay);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  } else {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}

export function getChatDayKey(dateInput) {
  const d = (dateInput instanceof Date) ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function renderDateDivider(label, dayKey) {
  return `<div class="club-date-divider" data-day="${dayKey}" style="display: flex; align-items: center; margin: 20px 0; opacity: 0.85; width: 100%;"><div class="club-date-divider-line" style="flex: 1; height: 1px; background: rgba(139,38,53,0.12);"></div><div class="club-date-divider-text" style="font-family: 'DM Mono', monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--wood-light); font-weight: 700; margin: 0 16px; white-space: nowrap;">${label}</div><div class="club-date-divider-line" style="flex: 1; height: 1px; background: rgba(139,38,53,0.12);"></div></div>`;
}

export function _appendClubMessage(msg, clubId) {
  const msgsEl = document.getElementById('clubMsgs');
  if (!msgsEl) return;

  if (msgsEl.innerHTML.includes('No messages yet') || (msgsEl.innerText && msgsEl.innerText.includes('No messages yet'))) {
    msgsEl.innerHTML = '';
  }

  const d = new Date(msg.created_at || Date.now());
  const dayKey = getChatDayKey(d);

  const dividers = msgsEl.querySelectorAll('.club-date-divider');
  const lastDivider = dividers.length > 0 ? dividers[dividers.length - 1] : null;
  const lastDay = lastDivider ? lastDivider.getAttribute('data-day') : (msgsEl.dataset.lastDay || null);

  if (dayKey && dayKey !== lastDay) {
    const label = formatChatDate(d);
    const dividerHtml = renderDateDivider(label, dayKey);
    msgsEl.insertAdjacentHTML('beforeend', dividerHtml);
    msgsEl.dataset.lastDay = dayKey;
  }

  const prof = msg.user_profiles || (typeof App !== 'undefined' && App._currentClubMembers && App._currentClubMembers[msg.user_id]) || {};
  const isMine = (typeof App !== 'undefined' && App.userId && String(msg.user_id) === String(App.userId));
  const avatar = (typeof App !== 'undefined' && App._getUserAvatar ? App._getUserAvatar(prof) : (prof.avatar_emoji || '📚'));
  const bg = (typeof App !== 'undefined' && App._avatarBg ? App._avatarBg(avatar) : '#f4f4f4');
  const timeStr = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const isAdmin = (typeof App !== 'undefined' && (App.isAdmin || (App._userRoles && App._userRoles[clubId] === 'admin') || (App._currentClubData && App._currentClubData.myRole === 'admin')));

  const msgDiv = document.createElement('div');
  msgDiv.className = `club-msg-item ${isMine ? 'mine' : ''}`;
  msgDiv.style.animation = 'feedSlideIn 0.25s ease';
  msgDiv.innerHTML = `
    ${!isMine ? `<div style="width: 32px; height: 32px; border-radius: 50%; background: ${bg}; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; box-shadow: 0 2px 6px rgba(0,0,0,0.05); margin-right: 8px;">${avatar}</div>` : ''}
    <div style="display: flex; flex-direction: column; max-width: ${isMine ? '100%' : 'calc(100% - 40px)'};">
      <div class="club-msg-author">${esc(prof.display_name || 'Reader')}</div>
      <div class="club-msg-bubble" style="position: relative;">
        ${isAdmin ? `<button onclick="event.stopPropagation(); App.deleteClubMessage('${clubId}', '${msg.id}')" style="position: absolute; right: -24px; top: 50%; transform: translateY(-50%); background: transparent; border: none; font-size: 14px; cursor: pointer; opacity: 0.5; padding: 4px;" title="Delete Message" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.5'">❌</button>` : ''}
        ${esc(msg.content)}
        <div class="club-msg-time">${timeStr}</div>
      </div>
    </div>
  `;

  const scrollContainer = document.getElementById('clubInnerScroll') || msgsEl;
  const isNearBottom = (scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight) <= 150;

  msgsEl.appendChild(msgDiv);
  msgsEl.dataset.lastDay = dayKey;

  if (isMine || isNearBottom) {
    scrollContainer.scrollTop = scrollContainer.scrollHeight;
    if (msgsEl !== scrollContainer) msgsEl.scrollTop = msgsEl.scrollHeight;
  }
}


export async function openClub(clubId) {
  const el = document.getElementById('clubsList');
  if (!el) return;

  if (typeof App !== 'undefined') {
    App._currentClub = clubId;
  }
  if (typeof window !== 'undefined' && window.App) {
    window.App._currentClub = clubId;
  }

  const isDemo = (typeof App !== 'undefined' && App.isDemoMode) || (typeof window !== 'undefined' && window.App && window.App.isDemoMode);

  if (isDemo) {
    const isC1 = clubId === 'mock_c1';
    let mockClub = (typeof window !== 'undefined' && window._mockClubs) ? window._mockClubs.find(c => c.id === clubId) : null;
    if (!mockClub) {
      mockClub = {
        id: clubId,
        name: isC1 ? 'Sci-Fi Sundays' : 'The Classics',
        description: isC1 ? 'Exploring the outer limits of imagination.' : 'Re-reading the books we were supposed to read in high school.',
        current_book_title: isC1 ? 'Project Hail Mary' : '1984',
        current_book_author: isC1 ? 'Andy Weir' : 'George Orwell',
        myRole: isC1 ? 'admin' : 'member',
        isPublic: false
      };
    }
    const now = Date.now();
    const mockMsgs = (typeof window !== 'undefined' && window._mockClubDiscussions && window._mockClubDiscussions[clubId]) ? [...window._mockClubDiscussions[clubId]] : [
      { id: 'm0', content: isC1 ? 'Welcome to Sci-Fi Sundays! Starting Project Hail Mary this week.' : 'Welcome to The Classics discussion!', user_profiles: { display_name: 'Alex Reader', avatar_emoji: '👽' }, created_at: new Date(now - 86400000 * 2).toISOString() },
      { id: 'm1', content: isC1 ? 'Did anyone get past chapter 4 yet? The science is dense but fascinating!' : 'I forgot how relevant this book still feels.', user_profiles: { display_name: 'Alex Reader', avatar_emoji: '👽' }, created_at: new Date(now - 86400000).toISOString() },
      { id: 'm2', content: isC1 ? 'Yes! It picks up. Rocky is incredible.' : 'Doubleplusgood!', user_profiles: { display_name: 'Jordan Pages', avatar_emoji: '🤖' }, created_at: new Date(now).toISOString() }
    ];
    const mockMembers = (typeof window !== 'undefined' && window._mockClubMembers && window._mockClubMembers[clubId]) ? [...window._mockClubMembers[clubId]] : [
      { user_id: 'u1', role: 'member', user_profiles: { display_name: 'Alex Reader', avatar_emoji: '👽' } },
      { user_id: 'u2', role: 'member', user_profiles: { display_name: 'Jordan Pages', avatar_emoji: '🤖' } },
      { user_id: 'u3', role: 'admin', user_profiles: { display_name: 'You', avatar_emoji: '🤠' } }
    ];

    if (typeof CommunityClubs !== 'undefined' && typeof CommunityClubs._renderClubDetail === 'function') {
      CommunityClubs._renderClubDetail(el, mockClub, mockMsgs, mockMembers, []);
    } else if (typeof CommunityFeatures !== 'undefined' && typeof CommunityFeatures._renderClubDetail === 'function') {
      CommunityFeatures._renderClubDetail(el, mockClub, mockMsgs, mockMembers, []);
    } else if (typeof App !== 'undefined' && typeof App._renderClubDetail === 'function') {
      App._renderClubDetail(el, mockClub, mockMsgs, mockMembers, []);
    }
    return;
  }

  if (typeof CommunityClubs !== 'undefined' && typeof CommunityClubs._subscribeClubRealtime === 'function') {
    CommunityClubs._subscribeClubRealtime(clubId);
  } else if (typeof CommunityFeatures !== 'undefined' && typeof CommunityFeatures._subscribeClubRealtime === 'function') {
    CommunityFeatures._subscribeClubRealtime(clubId);
  } else if (typeof App !== 'undefined' && typeof App._subscribeClubRealtime === 'function') {
    App._subscribeClubRealtime(clubId);
  }

  el.innerHTML = '<div style="font-size:11px;color:var(--wood-light);padding:8px 0;font-family:\'DM Mono\',monospace;letter-spacing:0.06em;">Loading...</div>';
  try {
    const currentUserId = (typeof App !== 'undefined' && App.userId) || (typeof window !== 'undefined' && window.App && window.App.userId);
    const clubs = (typeof DB !== 'undefined' && DB.getMyClubs) ? await DB.getMyClubs(currentUserId) : [];
    let club = (clubs || []).find(c => c.id === clubId);
    if (!club && typeof DB !== 'undefined' && DB.getPublicClubs) {
      const publicClubs = await DB.getPublicClubs();
      club = (publicClubs || []).find(c => c.id === clubId);
      if (club) club.isPublic = true;
    }
    if (!club && typeof App !== 'undefined' && App.isReadOnly && App.clubs) {
      club = App.clubs.find(c => c.id === clubId);
    }
    if (!club && typeof DB !== 'undefined' && DB._allClubs) {
      club = DB._allClubs.find(c => c.id === clubId);
    }
    if (!club) {
      if (typeof CommunityClubs !== 'undefined' && typeof CommunityClubs.renderClubs === 'function') CommunityClubs.renderClubs();
      else if (typeof CommunityFeatures !== 'undefined' && typeof CommunityFeatures.renderClubs === 'function') CommunityFeatures.renderClubs();
      else if (typeof App !== 'undefined' && typeof App.renderClubs === 'function') App.renderClubs();
      return;
    }

    let msgs = [], members = [], shelfBooks = [];
    if (!club.isPublic) {
      if (typeof DB !== 'undefined' && DB.getClubDiscussion) {
        msgs = await DB.getClubDiscussion(clubId);
      }
      if (typeof DB !== 'undefined' && DB.getClubMembers) {
        members = await DB.getClubMembers(clubId);
      }
      for (const m of members) {
        if (m.user_id && typeof DB !== 'undefined' && DB.getPublicUserBooks) {
          let theirBooks = [];
          try { theirBooks = await DB.getPublicUserBooks(m.user_id); } catch(e) { console.warn(e); }
          const clubBooks = (theirBooks || []).filter(b => b.readingClub === club.name);
          for (const b of clubBooks) {
            shelfBooks.push({ ...b, _member_id: m.user_id, _member_prof: m.user_profiles });
          }
        }
      }
    }

    if (typeof CommunityClubs !== 'undefined' && typeof CommunityClubs._renderClubDetail === 'function') {
      CommunityClubs._renderClubDetail(el, club, msgs, members, shelfBooks);
    } else if (typeof CommunityFeatures !== 'undefined' && typeof CommunityFeatures._renderClubDetail === 'function') {
      CommunityFeatures._renderClubDetail(el, club, msgs, members, shelfBooks);
    } else if (typeof App !== 'undefined' && typeof App._renderClubDetail === 'function') {
      App._renderClubDetail(el, club, msgs, members, shelfBooks);
    }
  } catch(e) {
    console.error('App.openClub error:', e);
    if (typeof CommunityClubs !== 'undefined' && typeof CommunityClubs.renderClubs === 'function') CommunityClubs.renderClubs();
    else if (typeof CommunityFeatures !== 'undefined' && typeof CommunityFeatures.renderClubs === 'function') CommunityFeatures.renderClubs();
    else if (typeof App !== 'undefined' && typeof App.renderClubs === 'function') App.renderClubs();
  }
}

export async function sendClubMessage(clubId) {
  const input = document.getElementById('clubMsgInput');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  try {
    const currentUserId = (typeof App !== 'undefined' && App.userId) || (typeof window !== 'undefined' && window.App && window.App.userId);
    const currentUserName = (typeof App !== 'undefined' && App.userName) || (typeof window !== 'undefined' && window.App && window.App.userName);
    if (typeof DB !== 'undefined' && DB.sendClubMessage) {
      await DB.sendClubMessage(clubId, text, currentUserId, currentUserName);
    }
    await openClub(clubId);
    const scrollContainer = document.getElementById('clubInnerScroll') || document.getElementById('clubMsgs');
    if (scrollContainer) scrollContainer.scrollTop = scrollContainer.scrollHeight;
  } catch(err) {
    console.error('sendClubMessage error:', err);
    if (typeof App !== 'undefined' && typeof App.showToast === 'function') App.showToast('Failed to send message');
  }
}

export const CommunityFeatures = {
  formatChatDate,
  getChatDayKey,
  renderDateDivider,
  _formatChatDate: formatChatDate,
  _getChatDayKey: getChatDayKey,
  _renderDateDivider: renderDateDivider,
  _appendClubMessage,
  openClub,
  sendClubMessage,
  _renderNotesList(notes, mode) {

 const list = document.getElementById('notesList');

 if (!notes || !notes.length) {
list.innerHTML = '<div class="notes-empty" style="line-height:1.5;">No messages yet.<br><br>To send a note to a friend, tap a book on your shelf or in the Community feed and select <b>✉️ Send Note</b>.</div>';
return;
}

 list.innerHTML = notes.map(n => {

 const who = mode === 'sent' ? ('To ' + this._esc(n._name)) : ('From ' + this._esc(n._name));

 const when = n.created_at ? new Date(n.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '';

 const unreadCls = (mode === 'inbox' && !n.read_at) ? ' unread' : '';

 const cover = n.book_cover || coverPlaceholder(n.book_title||'?', n.book_author||'', 'mixed');

 const isRec = n.trigger_status === 'recommend';

 const triggerHtml = isRec

 ? `<span class="nc-trigger" style="background:rgba(212,175,55,0.16);color:#9a6e0f;">📖 ${mode==='sent'?'Recommended':'Recommended to you'}</span>`

 : `<span class="nc-trigger">📍 ${this._noteTriggerLabel(n.trigger_status)}</span>`;

 return `<div class="note-card${unreadCls}"><img src="${cover}" alt="" onerror="this.style.visibility='hidden'"><div class="nc-body"><div class="nc-meta">${n._avatar||'📚'} <strong>${who}</strong> · ${when}</div><div class="nc-book">${this._esc(n.book_title||'A book')}</div><div class="nc-text">${this._esc(n.note_text)}</div>${triggerHtml}</div></div>`;

 }).join('');

 },

  async renderDiscoverReaders() {
    const host = document.getElementById('discoverReaders');
    if (host) {
      host.style.display = 'none';
      host.innerHTML = '';
    }

    if (this.profilePublic === false) {
      if (typeof this.initDiscoverVisuals === 'function') this.initDiscoverVisuals([]);
      return;
    }

    let BOOKS = (this.books || []).filter(b => b && !b.currentlyReading && !b.currently_reading && b.status !== 'to-read' && b.status !== 'reading');
    if (BOOKS.length < 3) {
      BOOKS = (this.books || []).length > 0 ? this.books : (window._BOOKS || []);
    }

    try {
      const mySig = this._readerSignature(BOOKS);
      const profiles = await DB.getPublicProfiles(this.userId);

      if (!profiles || !profiles.length) {
        if (typeof this.initDiscoverVisuals === 'function') this.initDiscoverVisuals([]);
        return;
      }

      const matches = [];
      const ignored = JSON.parse(localStorage.getItem('sl_ignored_readers') || '[]');
      const candidates = profiles.filter(p => !ignored.includes(p.user_id)).sort(() => 0.5 - Math.random()).slice(0, 40);

      for (const p of candidates) {
        let theirBooks = [];
        try { theirBooks = await DB.getPublicUserBooks(p.user_id); } catch (e) { theirBooks = []; }
        if (!theirBooks || theirBooks.length < 1) continue;

        const sig = this._readerSignature(theirBooks);
        const sim = this._similarity(mySig, sig);

        const myLibrary = (typeof BOOKS !== 'undefined') ? BOOKS : Object.values(window._BOOKS || {});
        const exactMatches = theirBooks.filter(tb => myLibrary.some(mb => mb.title && tb.title && mb.title.toLowerCase() === tb.title.toLowerCase()));
        sim.exactMatches = exactMatches;

        if (BOOKS.length > 0 && sim.score <= 0 && !sim.genres.length && !sim.authors.length && !sim.moods.length) continue;

        const avatar = (typeof App !== 'undefined' && App._getUserAvatar ? App._getUserAvatar(p) : (p.avatar_emoji || '👤'));
        matches.push({
          userId: p.user_id,
          name: normalizeDisplayName(p.display_name || 'A reader', null),
          avatar: avatar,
          count: theirBooks.length,
          score: sim.score,
          shared: sim,
          topBook: theirBooks[0]
        });
      }

      matches.sort((a, b) => b.score - a.score);

      if (host) {
        host.style.display = 'none';
        host.innerHTML = '';
      }

      if (typeof this.initDiscoverVisuals === 'function') {
        this.initDiscoverVisuals(matches.slice(0, 75));
      }
    } catch (e) {
      console.warn('[renderDiscoverReaders] error:', e);
      if (typeof this.initDiscoverVisuals === 'function') this.initDiscoverVisuals([]);
    }
  },

  getForYouRecommendations(userBooks) {
    const books = userBooks || (window.App && window.App.books) || [];
    
    // Normalize read titles into a Set for fast filtering
    const readTitles = new Set();
    books.forEach(b => {
      if (b && b.title) {
        readTitles.add(String(b.title).toLowerCase().trim());
      }
    });
    if (window.App && Array.isArray(window.App.books)) {
      window.App.books.forEach(b => {
        if (b && b.title) {
          readTitles.add(String(b.title).toLowerCase().trim());
        }
      });
    }

    // Helper: Map genre to standard category
    const getGenreCat = (g) => {
      if (!g) return 'General Fiction';
      const s = String(g).toLowerCase().trim();
      if (s.includes('sci-fi') || s.includes('science fiction') || s.includes('cyberpunk') || s.includes('space opera')) return 'Sci-Fi';
      if (s.includes('fantasy')) return 'Fantasy';
      if (s.includes('romance') || s.includes('contemporary')) return 'Romance';
      if (s.includes('thriller') || s.includes('mystery') || s.includes('suspense') || s.includes('action')) return 'Thriller';
      if (s.includes('horror') || s.includes('gothic') || s.includes('dark')) return 'Horror';
      if (s.includes('non-fiction') || s.includes('biography') || s.includes('memoir') || s.includes('history') || s.includes('science')) return 'Non-Fiction';
      return 'General Fiction';
    };

    // Calculate historical reading vibe (S_vibe) based on genre frequency in consumed books
    const consumed = books.filter(b => b && (b.status === 'finished' || (!b.currentlyReading && b.status !== 'to-read')));
    const vibeSource = consumed.length > 0 ? consumed : books;
    
    const genreCounts = {};
    let totalConsumed = 0;
    vibeSource.forEach(b => {
      const cat = getGenreCat(b.genre);
      genreCounts[cat] = (genreCounts[cat] || 0) + 1;
      totalConsumed++;
    });

    // Desired DNA trajectory score (S_trajectory)
    const dnaState = (window.App && window.App._dnaState) ? window.App._dnaState : {};
    const targetShape = dnaState.targetShape || dnaState.currentVector || [0.6, 0.4, 0.8, 0.5, 0.7];
    
    const catToAxis = {
      'Romance': 0,
      'Thriller': 1,
      'Horror': 2,
      'Sci-Fi': 3,
      'Fantasy': 3,
      'General Fiction': 3,
      'Non-Fiction': 4
    };

    // Rich candidate pool spanning all major categories
    const candidatePool = [
      // Sci-Fi
      { title: 'Neuromancer', author: 'William Gibson', genre: 'Sci-Fi', isbn: '9780441569595', pageCount: 271, synopsis: 'Henry Dorsett Case was the sharpest data thief in the matrix, until he crossed the wrong people and they crippled his nervous system. Now he is recruited by a mysterious employer for one last run against a powerful artificial intelligence.' },
      { title: 'Hyperion', author: 'Dan Simmons', genre: 'Sci-Fi', isbn: '9780553283686', pageCount: 482, synopsis: 'On the world called Hyperion, beyond the law of the Hegemony of Man, there waits the creature called the Shrike. There are those who worship it. There are those who fear it. And there are those who have vowed to destroy it.' },
      { title: 'Foundation', author: 'Isaac Asimov', genre: 'Sci-Fi', isbn: '9780553293357', pageCount: 255, synopsis: 'For twelve thousand years the Galactic Empire has ruled supreme. Now it is dying. But only Hari Seldon, creator of the revolutionary science of psychohistory, can see into the dark ages ahead.' },
      { title: 'Snow Crash', author: 'Neal Stephenson', genre: 'Sci-Fi', isbn: '9780553380958', pageCount: 480, synopsis: 'In reality, Hiro Protagonist delivers pizza for Uncle Enzo\'s CosoNostra Pizza Inc., but in the Metaverse he\'s a warrior prince. Plunging headlong into the enigma of a new computer virus.' },
      { title: 'The Left Hand of Darkness', author: 'Ursula K. Le Guin', genre: 'Sci-Fi', isbn: '9780441478125', pageCount: 304, synopsis: 'A groundbreaking work of science fiction, telling the story of a lone human emissary to Winter, an alien world whose inhabitants can choose their gender.' },
      { title: 'Children of Time', author: 'Adrian Tchaikovsky', genre: 'Sci-Fi', isbn: '9780316452502', pageCount: 600, synopsis: 'A race for survival among the stars... Humanity\'s last survivors escaped earth\'s ruins to find a new home. But when they find it, can their desperation overcome its dangers?' },
      { title: 'A Memory Called Empire', author: 'Arkady Martine', genre: 'Sci-Fi', isbn: '9781250186430', pageCount: 462, synopsis: 'Ambassador Mahit Dzmare arrives in the center of the multi system Teixcalaanli Empire only to discover that her predecessor has died under mysterious circumstances.' },
      { title: 'Do Androids Dream of Electric Sheep?', author: 'Philip K. Dick', genre: 'Sci-Fi', isbn: '9780345404473', pageCount: 210, synopsis: 'By 2021, the World War has killed millions, sending mankind off planet. Those who remained coveted any living creature, and for people who couldn\'t afford one, companies built androids.' },
      { title: 'Machines Like Me', author: 'Ian McEwan', genre: 'Sci-Fi', isbn: '9780385545112', pageCount: 304, synopsis: 'An alternate 1980s London where Alan Turing is alive and synthetic humans exist. Charlie buys Adam, one of the first batch of synthetic humans.' },
      { title: 'I, Robot', author: 'Isaac Asimov', genre: 'Sci-Fi', isbn: '9780553382563', pageCount: 224, synopsis: 'The Three Laws of Robotics govern the relationship between humans and intelligent machines in this seminal collection of interconnected stories.' },
      { title: 'A Psalm for the Wild-Built', author: 'Becky Chambers', genre: 'Sci-Fi', isbn: '9781250236210', pageCount: 160, synopsis: 'Centuries after robots left human society, a tea monk meets one. The robot has a simple question: "What do humans need?"' },
      { title: 'All Systems Red', author: 'Martha Wells', genre: 'Sci-Fi', isbn: '9780765397539', pageCount: 144, synopsis: 'Murderbot just wants to watch soap operas. But a corporate sponsored exploratory mission goes horribly wrong, and the security android must save its human clients.' },
      { title: 'This Is How You Lose the Time War', author: 'Amal El Mohtar', genre: 'Sci-Fi', isbn: '9781534431003', pageCount: 208, synopsis: 'Two rival agents in a time war fall in love through letters left across space and time.' },
      { title: 'Fahrenheit 451', author: 'Ray Bradbury', genre: 'Sci-Fi', isbn: '9781451673319', pageCount: 256, synopsis: 'Guy Montag is a fireman whose job is to destroy books in a dystopian future where reading is banned.' },
      { title: 'Binti', author: 'Nnedi Okorafor', genre: 'Sci-Fi', isbn: '9780765385253', pageCount: 96, synopsis: 'Binti is the first of the Himba people to be offered a place at Oomza University among the stars.' },
      { title: 'Dune', author: 'Frank Herbert', genre: 'Sci-Fi', isbn: '9780441172719', pageCount: 688, synopsis: 'Set on the desert planet Arrakis, Dune is the story of Paul Atreides, heir to a noble family tasked with ruling an inhospitable world where the only value is spice.' },
      { title: 'The Three-Body Problem', author: 'Cixin Liu', genre: 'Sci-Fi', isbn: '9780765382030', pageCount: 400, synopsis: 'Set against the backdrop of China\'s Cultural Revolution, a secret military project sends signals into space to establish contact with aliens.' },
      { title: 'The Dispossessed', author: 'Ursula K. Le Guin', genre: 'Sci-Fi', isbn: '9780061054884', pageCount: 387, synopsis: 'A brilliant physicist journeys from an anarchic moon to a wealthy capitalist planet to break down walls between isolated worlds.' },
      { title: 'Klara and the Sun', author: 'Kazuo Ishiguro', genre: 'Sci-Fi', isbn: '9780593318171', pageCount: 303, synopsis: 'This novel tells the story of Klara, an Artificial Friend with outstanding observational qualities, who watches carefully the behavior of those who pass by.' },
      { title: 'Sea of Tranquility', author: 'Emily St. John Mandel', genre: 'Sci-Fi', isbn: '9780593321447', pageCount: 272, synopsis: 'A novel of art, time, love, and plague that takes the reader from Vancouver Island in 1912 to a dark colony on the moon five hundred years later.' },
      { title: 'Project Hail Mary', author: 'Andy Weir', genre: 'Sci-Fi', isbn: '9780593135204', pageCount: 496, synopsis: 'Ryland Grace is the sole survivor on a desperate, last-chance mission to save humanity from an extinction-level threat.' },
      { title: 'Red Rising', author: 'Pierce Brown', genre: 'Sci-Fi', isbn: '9780345539786', pageCount: 382, synopsis: 'Darrow is a Red, a member of the lowest caste in the color-coded society of the future, working beneath the surface of Mars.' },

      // Fantasy
      { title: 'Babel', author: 'R.F. Kuang', genre: 'Fantasy', isbn: '9780063020426', pageCount: 544, synopsis: 'An act of translation is always an act of betrayal. Robin Swift is brought to Oxford to study Latin, Ancient Greek, and silver-working magic.' },
      { title: 'The Midnight Library', author: 'Matt Haig', genre: 'Fantasy', isbn: '9780525559474', pageCount: 304, synopsis: 'Between life and death there is a library where every book provides a chance to try another life you could have lived.' },
      { title: 'Piranesi', author: 'Susanna Clarke', genre: 'Fantasy', isbn: '9781635575637', pageCount: 245, synopsis: 'Piranesi\'s house is no ordinary building: its rooms are infinite, its corridors endless, its walls lined with thousands of statues.' },
      { title: 'The Ocean at the End of the Lane', author: 'Neil Gaiman', genre: 'Fantasy', isbn: '9780062255655', pageCount: 181, synopsis: 'A middle-aged man returns to his childhood home and remembers strange, magical events from his past with the Hempstock family.' },
      { title: 'The Emperor\'s Soul', author: 'Brandon Sanderson', genre: 'Fantasy', isbn: '9781616960926', pageCount: 175, synopsis: 'A master forger is condemned to death unless she can forge a replica of the Emperor\'s soul within 100 days.' },
      { title: 'Silver in the Wood', author: 'Emily Tesh', genre: 'Fantasy', isbn: '9781250229793', pageCount: 112, synopsis: 'A Green Man living in a magical wood. Tobias has lived alone in the forest for centuries until a new lord arrives.' },
      { title: 'The Fifth Season', author: 'N.K. Jemisin', genre: 'Fantasy', isbn: '9780316229296', pageCount: 512, synopsis: 'Essun comes home to find that her husband has brutally murdered their son and kidnapped their daughter amidst apocalyptic climate events.' },
      { title: 'American Gods', author: 'Neil Gaiman', genre: 'Fantasy', isbn: '9780380789030', pageCount: 635, synopsis: 'Shadow Moon takes a job as a bodyguard for Mr. Wednesday, who is revealed to be Odin gathering old gods for a war against modern tech gods.' },
      { title: 'The Name of the Wind', author: 'Patrick Rothfuss', genre: 'Fantasy', isbn: '9780756404741', pageCount: 662, synopsis: 'The tale of Kvothe, a magically gifted young man who grows up to be the most notorious wizard his world has ever seen.' },
      { title: 'The Way of Kings', author: 'Brandon Sanderson', genre: 'Fantasy', isbn: '9780765326355', pageCount: 1007, synopsis: 'Roshar is a world of stones and storms. Uncanny tempests of incredible power sweep across the rocky terrain.' },

      // Romance / Contemporary
      { title: 'Book Lovers', author: 'Emily Henry', genre: 'Romance', isbn: '9780593334836', pageCount: 384, synopsis: 'A literary agent and a cutthroat editor bump into each other in a small North Carolina town over summer vacation.' },
      { title: 'Beach Read', author: 'Emily Henry', genre: 'Romance', isbn: '9781984806734', pageCount: 361, synopsis: 'A romance writer and a literary fiction author swap genres for the summer to break their writer\'s block.' },
      { title: 'The Seven Husbands of Evelyn Hugo', author: 'Taylor Jenkins Reid', genre: 'Romance', isbn: '9781501161933', pageCount: 400, synopsis: 'Aging Hollywood movie icon Evelyn Hugo is finally ready to tell the truth about her glamorous and scandalous life.' },
      { title: 'Red, White & Royal Blue', author: 'Casey McQuiston', genre: 'Romance', isbn: '9781250316776', pageCount: 423, synopsis: 'What happens when America\'s First Son falls in love with the Prince of Wales?' },
      { title: 'Normal People', author: 'Sally Rooney', genre: 'Contemporary', isbn: '9781984822178', pageCount: 273, synopsis: 'At school Connell and Marianne pretend not to know each other. But when they both study at Trinity College in Dublin, a connection forms.' },

      // Thriller / Mystery
      { title: 'Dark Matter', author: 'Blake Crouch', genre: 'Thriller', isbn: '9781101904220', pageCount: 342, synopsis: 'Jason Dessen is kidnapped into an alternate reality where his life has taken a radically different turn.' },
      { title: 'The Silent Patient', author: 'Alex Michaelides', genre: 'Thriller', isbn: '9781250301697', pageCount: 336, synopsis: 'Alicia Berenson\'s life is seemingly perfect. Then one evening she shoots her husband five times in the face and never speaks another word.' },
      { title: 'Gone Girl', author: 'Gillian Flynn', genre: 'Thriller', isbn: '9780307588371', pageCount: 432, synopsis: 'On a warm summer morning in North Carthage, Missouri, it is Nick and Amy Dunne\'s fifth wedding anniversary. Then Amy disappears.' },
      { title: 'The Stepford Wives', author: 'Ira Levin', genre: 'Thriller', isbn: '9780060080846', pageCount: 144, synopsis: 'A satirical thriller about submissive robot replacements in an idyllic Connecticut suburb.' },

      // Horror / Dark
      { title: 'The Shining', author: 'Stephen King', genre: 'Horror', isbn: '9780307743657', pageCount: 447, synopsis: 'Jack Torrance\'s new job at the Overlook Hotel is the perfect chance for a fresh start. But as the winter weather sets in, the hotel feels isolated and sinister.' },
      { title: 'Mexican Gothic', author: 'Silvia Moreno-Garcia', genre: 'Horror', isbn: '9780525620785', pageCount: 304, synopsis: 'An isolated mansion in 1950s Mexico hides dark secrets when Noemí receives a frantic letter from her newlywed cousin.' },

      // Non-Fiction
      { title: 'Sapiens: A Brief History of Humankind', author: 'Yuval Noah Harari', genre: 'Non-Fiction', isbn: '9780062316097', pageCount: 443, synopsis: 'Explore how Homo sapiens conquered Earth through cognitive revolutions, agriculture, and science.' },
      { title: 'Educated', author: 'Tara Westover', genre: 'Non-Fiction', isbn: '9780399590504', pageCount: 334, synopsis: 'Born to survivalists in the mountains of Idaho, Tara Westover was seventeen the first time she set foot in a classroom.' },
      { title: 'Atomic Habits', author: 'James Clear', genre: 'Non-Fiction', isbn: '9780735211292', pageCount: 320, synopsis: 'An easy & proven way to build good habits & break bad ones using tiny behavioral changes.' },

      // General Fiction
      { title: 'Demon Copperhead', author: 'Barbara Kingsolver', genre: 'General Fiction', isbn: '9780063251922', pageCount: 560, synopsis: 'A brilliant retelling of David Copperfield, set in the mountains of southern Appalachia.' }
    ];

    // Strictly filter out candidates present in user reading history (matching title lowercased)
    const unreadPool = candidatePool.filter(c => {
      const titleLower = String(c.title || '').toLowerCase().trim();
      return !readTitles.has(titleLower);
    });

    // Score candidates
    const scored = unreadPool.map(c => {
      const cat = getGenreCat(c.genre);
      const vibeScore = totalConsumed > 0 ? ((genreCounts[cat] || 0) / totalConsumed) : 0.5;
      
      const axisIdx = catToAxis[cat] !== undefined ? catToAxis[cat] : 3;
      const trajectoryScore = (targetShape[axisIdx] !== undefined) ? Number(targetShape[axisIdx]) : 0.5;
      
      const finalScore = 0.5 * vibeScore + 0.5 * trajectoryScore;
      const matchPct = Math.min(99, Math.max(70, Math.round(finalScore * 100)));
      
      let reason = `${matchPct}% Taste Match`;
      if (vibeScore > 0.5) {
        reason = `${matchPct}% Match - Matches your ${cat} vibe`;
      } else if (trajectoryScore > 0.6) {
        reason = `${matchPct}% DNA Trajectory Synergy`;
      }

      return {
        ...c,
        finalScore,
        matchPct,
        reason
      };
    });

    // Sort descending by finalScore
    scored.sort((a, b) => b.finalScore - a.finalScore);
    return scored;
  },

  renderForYouFeed() {
    const grid = document.getElementById('discoveryGrid');
    if (!grid) return;

    const esc = (str) => App._escapeHtml(str);

    // Dynamic recommendations derived from user history and DNA trajectory
    const recommendations = this.getForYouRecommendations(App.books);
    if (!recommendations || recommendations.length === 0) return;

    const heroBook = recommendations[0];

    // Dynamic arrays derived from recommendations pool
    const trendingBooks = recommendations.slice(1, 8);
    const dnaBooks = recommendations.slice(0, 7).map(b => ({ ...b, reason: b.reason || 'DNA Match' }));
    
    // Find last finished read book title for "Because you read..." title
    const finishedBooks = (App.books || []).filter(b => b && (b.status === 'finished' || (!b.currentlyReading && b.status !== 'to-read')));
    const lastReadTitle = finishedBooks.length > 0 ? finishedBooks[finishedBooks.length - 1].title : null;
    const becauseHeaderTitle = lastReadTitle ? `Because you read ${lastReadTitle}` : 'Because of your Reading Vibe';
    
    const becauseBooks = recommendations.slice(2, 9).map(b => ({
      ...b,
      reason: lastReadTitle ? `Because you read ${lastReadTitle}` : 'Matches your vibe'
    }));
    
    const shortReads = recommendations.filter(b => b.pageCount && b.pageCount <= 320).slice(0, 7);
    const shortBooksToUse = shortReads.length >= 3 ? shortReads : recommendations.slice(3, 10);
    
    const awardWinners = recommendations.slice(4, 11).map(b => ({ ...b, reason: b.reason || 'Top Pick' }));

    const getCover = (b) => b.coverUrl || b.cover || (b.isbn ? `https://books.google.com/books/content?vid=ISBN${b.isbn}&printsec=frontcover&img=1&zoom=1` : (typeof coverPlaceholder === 'function' ? coverPlaceholder(b.title, b.author, 'mixed') : ''));

    // New Netflix-style renderer without the ugly borders, just sleek cover art.
    const renderCard = (b) => `
      <a class="fy-card" href="#" data-title="${esc(b.title)}" data-author="${esc(b.author)}" data-cover="${esc(getCover(b))}" data-reason="${esc(b.reason)}" data-synopsis="${esc(b.synopsis || '')}" onclick="event.preventDefault(); window.openBookModal(this);">
        <div style="position:relative; width:140px; height:210px; border-radius:8px; overflow:hidden; background:linear-gradient(135deg, #3d2b1f, #1a110b); box-shadow:0 4px 12px rgba(0,0,0,0.1);">
           <div style="position:absolute; inset:0; padding:16px; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; box-sizing:border-box;">
              <div style="color:#fff; font-family:'Playfair Display',serif; font-weight:700; font-size:14px; line-height:1.2; display:-webkit-box; -webkit-line-clamp:4; -webkit-box-orient:vertical; overflow:hidden;">${esc(b.title)}</div>
              <div style="color:rgba(255,255,255,0.7); font-family:'Inter UI',sans-serif; font-size:10px; margin-top:8px;">${esc(b.author)}</div>
           </div>
           <img class="fy-cover" src="${getCover(b)}" alt="${esc(b.title)}" loading="lazy" onerror="this.style.opacity='0'" onload="if(this.naturalWidth <= 1) this.style.opacity='0';" style="position:absolute; inset:0; width:100%; height:100%; object-fit:cover; z-index:2; transition:opacity 0.3s;">
        </div>
        <div class="fy-card-meta">
          <div class="fy-card-title">${esc(b.title)}</div>
          <div class="fy-card-author">${esc(b.author)}</div>
        </div>
      </a>`;

    const buildRow = (title, arr) => `
      <div class="fy-row-container">
        <h3 class="fy-row-title">${title}</h3>
        <div class="fy-scroll-area">
          ${arr.map(renderCard).join('')}
        </div>
      </div>`;

    grid.innerHTML = `
      <style>
        .fy-container {
          position: relative;
          width: 100%;
          margin: 0;
          min-height: 100%;
          background: transparent;
          color: var(--wood-dark, #2C2C2C);
          padding-bottom: 24px;
          overflow-x: hidden;
          border-radius: 16px;
        }
        /* The dramatic top gradient fading into black */
        .fy-hero-bg {
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 240px;
          background: linear-gradient(180deg, rgba(228, 219, 204, 1) 0%, rgba(228, 219, 204, 0.4) 40%, transparent 100%);
          z-index: 0;
          pointer-events: none;
        }
        .fy-content {
          position: relative;
          z-index: 1;
        }
        .fy-hero {
          display: flex;
          align-items: flex-end;
          padding: 24px 20px 16px 20px;
          min-height: auto;
          gap: 20px;
        }
        .fy-hero img {
          width: 120px;
          height: 180px;
          object-fit: cover;
          border-radius: 8px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.4);
          border: 1px solid rgba(255,255,255,0.1);
        }
        .fy-hero-info {
          flex: 1;
          min-width: 0;
          padding: 0;
          box-sizing: border-box;
        }
        @media (max-width: 768px) {
          .fy-hero {
            flex-direction: row;
            align-items: center;
            text-align: left;
            padding: 16px 12px;
            gap: 14px;
          }
          .fy-hero-info {
            width: 100%;
            padding: 0;
            box-sizing: border-box;
          }
          .fy-hero-title {
            font-size: 1.25rem;
          }
          .fy-hero img {
            width: 90px;
            height: 135px;
          }
          .fy-hero-synopsis {
            display: none;
          }
        }
        .fy-hero-tag {
          font-family: 'Inter UI', sans-serif;
          font-weight: 800;
          font-size: 0.7rem;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: var(--burgundy, #8B2635);
          margin-bottom: 4px;
        }
        .fy-hero-title {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 1.5rem;
          margin: 0 0 4px 0;
          word-wrap: break-word;
          overflow-wrap: break-word;
          line-height: 1.15;
          color: var(--wood-dark, #2C2C2C);
          text-shadow: none;
        }
        .fy-hero-author {
          font-size: 0.95rem;
          color: var(--wood-dark, #2C2C2C);
          opacity: 0.8;
          margin-bottom: 8px;
        }
        .fy-hero-synopsis {
          font-size: 0.85rem;
          line-height: 1.4;
          margin-bottom: 14px;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .fy-hero-btn {
          background: #fff;
          color: #000;
          border: none;
          padding: 8px 18px;
          border-radius: 4px;
          font-weight: bold;
          font-size: 0.85rem;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: transform 0.2s, background 0.2s;
        }
        .fy-hero-btn:hover {
          background: rgba(255,255,255,0.8);
          transform: scale(1.05);
        }
        .fy-row-container {
          padding: 16px 0;
          position: relative;
          background: linear-gradient(180deg, rgba(228, 219, 204, 0.6) 0%, transparent 100%);
        }
        .fy-row-container::after {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(200, 190, 175, 0.6), transparent);
        }
        .fy-row-title {
          font-family: 'Inter UI', sans-serif;
          font-size: 1.1rem;
          font-weight: 700;
          margin: 0 0 15px 0;
          color: var(--wood-dark, #2C2C2C);
          letter-spacing: 0.5px;
        }
        .fy-scroll-area {
          display: flex;
          gap: 12px;
          overflow-x: auto;
          overflow-y: hidden;
          padding: 25px 20px 25px 20px;
          margin-top: -25px;
          margin-bottom: -15px; /* just enough to hide stray scrollbars, won't block clicks much */
          scrollbar-width: none; /* Firefox */
        }
        .fy-scroll-area::after {
          content: ''; /* extra space at the end to prevent right-edge clipping */
          padding-right: 20px;
        }
        .fy-scroll-area::-webkit-scrollbar {
          display: none; /* Safari and Chrome */
        }
        .fy-card {
          width: 140px;
          flex: 0 0 auto;
          display: flex;
          flex-direction: column;
          text-decoration: none;
          transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }
        .fy-card-meta {
          margin-top: 8px;
          opacity: 0.9;
          height: 60px; /* reserve enough space for wrapped text */
        }
        .fy-card-title {
          font-family: 'Inter UI', sans-serif;
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--wood-dark, #2C2C2C);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .fy-card-author {
          font-family: 'Inter UI', sans-serif;
          font-size: 0.7rem;
          color: var(--wood-mid, #6D5E53);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-top: 2px;
        }
        .fy-cover {
          width: 140px;
          height: 210px;
          object-fit: cover;
          border-radius: 4px;
          box-shadow: 0 4px 8px rgba(0,0,0,0.4);
        }
        /* The Netflix hover scale */
        .fy-scroll-area:hover .fy-card {
          transform: translateX(-10%); /* Shift siblings left */
        }
        .fy-card:hover {
          transform: scale(1.15) !important;
          z-index: 10;
        }
        .fy-card:hover .fy-card-title, .fy-card:hover .fy-card-author {
          white-space: normal;
          overflow: visible;
          text-overflow: clip;
        }
        .fy-card:hover .fy-card-meta {
          /* Just let it grow naturally */
          z-index: 20;
        }
        .fy-card:hover ~ .fy-card {
          transform: translateX(10%); /* Shift siblings right */
        }
      

.cinematic-sub-link .arrow { font-size: 14px; transition: transform 0.3s ease; }
.cinematic-sub-link:hover .arrow { transform: translateX(4px); }

    /* Hide old leftover Community section from main page */
    #forYouTile, #similarReadersTile { display: none !important; }


#heatmapChart svg { min-width: 0 !important; }

    /* Force community modal to center properly using flex, defeating the legacy position:fixed rules */
    #communityModal { padding: 12px; box-sizing: border-box;  align-items: center !important; justify-content: center !important; }
    #communityModal .modal-card { 
        position: relative !important; 
        top: auto !important; 
        left: auto !important; 
        bottom: auto !important; 
        right: auto !important; 
        margin: auto !important; 
        max-height: 90vh !important; 
        height: 90vh !important; 
        width: 100% !important; 
        max-width: 600px !important; 
        align-self: center !important; 
    }
    


    /* Make the old discovery list horizontally scrollable so it doesn't push the Galaxy off-screen */
    #discoverReaders { flex-wrap: nowrap !important; overflow-x: auto !important; -webkit-overflow-scrolling: touch !important; padding-bottom: 8px !important; scrollbar-width: none; }
    #discoverReaders::-webkit-scrollbar { display: none; }
    #discoverReaders > div { flex: 0 0 85% !important; max-width: 320px !important; }



.club-vote-container { height: auto; min-height: 120px; }
@media (max-width: 768px) {
    .club-vote-container { height: auto !important; min-height: 120px; padding: 0px 12px 5px 12px !important; }
}

  /* Responsive Search Toggles */
  @media (max-width: 899px) {
    #globalSearchBtn { display: none !important; }
  }
  @media (min-width: 900px) {
    .bn-tab[data-tab="search"] { display: none !important; }
  }


  </style>
      
      <div class="fy-container">
        <div class="fy-hero-bg"></div>
        <div class="fy-content">
          <div class="fy-hero">
            <img src="${getCover(heroBook)}" alt="${esc(heroBook.title)}">
            <div class="fy-hero-info">
              <div class="fy-hero-tag">TOP MATCH FOR YOU</div>
              <h1 class="fy-hero-title">${esc(heroBook.title)}</h1>
              <div class="fy-hero-author">${esc(heroBook.author)}</div>
              <div class="fy-hero-synopsis">${esc(heroBook.synopsis || '')}</div>
              <button class="fy-hero-btn" onclick="window.openBookModal('${esc(heroBook.title)}', '${esc(heroBook.author)}', '${esc(getCover(heroBook))}', '${esc(heroBook.reason)}', '${esc(heroBook.synopsis || '')}')">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                Add to TBR
              </button>
            </div>
          </div>

          ${buildRow(becauseHeaderTitle, becauseBooks)}
          ${buildRow('Trending in Your Network', trendingBooks)}
          ${buildRow('Short & Sweet (Under 80k words)', shortBooksToUse)}
          ${buildRow('Award-Winning & Top Picks', awardWinners)}
          ${buildRow('Based on your Reading DNA', dnaBooks)}
        </div>
      </div>
    `;
  },

  async renderNetwork() {
    App._networkTab = App._networkTab || 'following';
    const container = document.getElementById('networkContainer');
    if (!container) return;
    
    const fallbackCoverSvg = 'data:image/svg+xml;utf8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2230%22 height=%2245%22 viewBox=%220 0 30 45%22 fill=%22%238b2635%22%3E%3Crect width=%2230%22 height=%2245%22 rx=%222%22 fill=%22%238b2635%22/%3E%3Cpath d=%22M6 0 h18 v22 l-9 -5 l-9 5 z%22 fill=%22%23d4af37%22 opacity=%220.7%22/%3E%3Crect x=%223%22 y=%2238%22 width=%2224%22 height=%222%22 rx=%221%22 fill=%22%23f7f4ee%22 opacity=%220.5%22/%3E%3C/svg%3E';

    if (this.isDemoMode) {
        const mockNet = [
            { name: 'Alex Reader', handle: '@alexreads', avatar: '👽', following: true, booksCount: 42, matchPct: 88, currentBook: 'Tomorrow, and Tomorrow, and Tomorrow', bookCover: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=120' },
            { name: 'Jordan Pages', handle: '@jordanp', avatar: '🤖', following: false, booksCount: 19, matchPct: 74, currentBook: 'Klara and the Sun', bookCover: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=120' },
            { name: 'Taylor Books', handle: '@tbooks', avatar: '🧛', following: true, booksCount: 31, matchPct: 91, currentBook: 'The Secret History', bookCover: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&q=80&w=120' },
            { name: 'Sam Fiction', handle: '@samreads', avatar: '☕', following: false, booksCount: 55, matchPct: 62, currentBook: 'Project Hail Mary', bookCover: fallbackCoverSvg }
        ];
        const netCards = mockNet.map(n => `
        <div style="display: flex; flex-direction: column; gap: 10px; padding: 15px; border-bottom: 1px solid rgba(61,43,31,0.08); background: var(--card-bg, #fff); border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.03); cursor: pointer; transition: all 0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
            <div style="display: flex; align-items: center; justify-content: space-between;">
                <div style="display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1;">
                    <div style="width: 44px; height: 44px; border-radius: 50%; background: var(--paper, #f7f4ee); display: flex; align-items: center; justify-content: center; font-size: 1.3rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow: hidden;">${n.avatar}</div>
                    <div style="min-width: 0; flex: 1;">
                          <div style="font-weight: 600; color: var(--wood-dark); font-size: 1.05rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${n.name}</div>
                        <div style="font-size: 0.8rem; color: var(--wood-mid); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${n.booksCount} books logged</div>
                    </div>
                </div>
                <button style="padding: 6px 12px; border-radius: 12px; border: 1px solid var(--burgundy); background: ${n.following ? 'var(--burgundy)' : 'transparent'}; color: ${n.following ? '#fff' : 'var(--burgundy)'}; font-size: 11px; font-weight: 600; cursor: pointer;">${n.following ? 'Following' : 'Follow'}</button>
            </div>
            <!-- Middle Row: Currently Reading -->
            <div style="display: flex; align-items: center; gap: 10px; background: rgba(61,43,31,0.03); padding: 8px 12px; border-radius: 8px; margin-top: 2px;">
                <img src="${n.bookCover || fallbackCoverSvg}" alt="${n.currentBook}" style="width: 24px; height: 36px; object-fit: cover; border-radius: 2px; box-shadow: 0 1px 3px rgba(0,0,0,0.2);" onerror="this.onerror=null; this.src='${fallbackCoverSvg}';">
                <div style="flex: 1; min-width: 0;">
                    <div style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--wood-mid); font-weight: 600;">Currently Reading</div>
                    <div style="font-size: 0.9rem; color: var(--wood-dark); font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${n.currentBook}</div>
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; margin-top: 4px;">
                <div style="font-size: 0.8rem; font-weight: 600; color: var(--gold, #d4af37); width: 35px;">${n.matchPct}%</div>
                <div style="flex: 1; height: 6px; background: rgba(61,43,31,0.08); border-radius: 3px; position: relative; overflow: hidden;">
                    <div style="width: ${n.matchPct}%; height: 100%; background: linear-gradient(to right, #8b2635, #eab308, #10b981); border-radius: 3px; transition: width 0.4s ease;"></div>
                </div>
            </div>
        </div>`);
        container.innerHTML = `<div class="friends-list-items" style="padding: 12px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; box-sizing: border-box; width: 100%; min-width: 0;">${netCards.join('')}</div>`;
        return;
    }

    if (!this.userId) {
        container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--wood-mid);">Sign in to view your network.</div>';
        return;
    }

    container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px; gap: 15px;">
            <div style="width: 32px; height: 32px; border: 3px solid rgba(61,43,31,0.1); border-top-color: var(--wood-dark); border-radius: 50%; animation: spin 1s linear infinite;"></div>
            <div style="font-size: 0.85rem; color: var(--wood-mid); font-family: 'Inter', sans-serif; animation: skel-pulse 1.5s ease-in-out infinite;">Loading network... ⏳</div>
        </div>
    `;
    
    try {
        const followingIds = await DB.getFollowing(this.userId) || [];
        const followersRaw = await DB.getFollowers(this.userId) || [];
        const followersIds = followersRaw.map(f => typeof f === 'object' ? f.user_id : f);
        
        const allIds = Array.from(new Set([...followingIds, ...followersIds]));
        const profiles = {};
        const userBooks = {};
        for (const id of allIds) {
            try {
                let p = await DB.getUserProfile(id).catch(() => null);
                if (!p) {
                    const pub = await DB.getPublicProfiles('');
                    p = pub.find(x => String(x.user_id) === String(id));
                }
                if (p) profiles[id] = p;
                else profiles[id] = { user_id: id, display_name: 'Unknown User', avatar_emoji: '👤' };
                
                userBooks[id] = await DB.getPublicUserBooks(id).catch(() => []);
            } catch (e) {
                profiles[id] = { user_id: id, display_name: 'Unknown User', avatar_emoji: '👤' };
                userBooks[id] = [];
            }
        }
        
        let html = `
            <div class="friends-header-tabs">
                <div class="fh-tab ${App._networkTab === 'following' ? 'active' : ''}" onclick="App._networkTab='following'; App.renderNetwork();">Following (${followingIds.length})</div>
                <div class="fh-tab ${App._networkTab === 'followers' ? 'active' : ''}" onclick="App._networkTab='followers'; App.renderNetwork();">Followers (${followersIds.length})</div>
            </div>
            <div class="friends-list-items" style="padding: 12px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; box-sizing: border-box; width: 100%; min-width: 0;">
        `;
        
        const activeIds = App._networkTab === 'following' ? followingIds : followersIds;
        const emptyMsg = App._networkTab === 'following' ? "You aren't following anyone yet. Check out the Discover tab!" : "You don't have any followers yet.";
        
        const mySig = typeof App._readerSignature === 'function' ? App._readerSignature(App.books || []) : null;
        
        if (activeIds.length === 0) {
            html += `<div style="grid-column: 1 / -1; font-size:0.85rem; color:var(--wood-mid); font-style:italic; text-align: center; padding: 20px;">${emptyMsg}</div>`;
        } else {
            activeIds.forEach(id => {
                const p = profiles[id];
                if (!p) return;
                const theirBooks = userBooks[id] || [];
                
                // Match Score
                let matchScore = 0;
                let matchReason = 'Match score';
                if (mySig && typeof App._readerSignature === 'function' && typeof App._similarity === 'function') {
                    const theirSig = App._readerSignature(theirBooks);
                    const sim = App._similarity(mySig, theirSig);
                    matchScore = sim ? Math.max(0, Math.round(sim.score || 0)) : 0;
                    if (sim) {
                        if (sim.genres && sim.genres.length > 0) matchReason = 'Matches your taste in ' + sim.genres[0];
                        else if (sim.authors && sim.authors.length > 0) matchReason = 'Also reads ' + sim.authors[0];
                        else if (sim.moods && sim.moods.length > 0) matchReason = 'Matches your ' + sim.moods[0] + ' vibe';
                        else if (matchScore > 10) matchReason = 'Strong overall match';
                        else matchReason = 'Discover new reading paths';
                    }
                }
                const matchPct = Math.min(100, Math.max(0, matchScore));
                
                // Mini Radar
                const miniRadarSvg = typeof App._generateRadarSvg === 'function' ? App._generateRadarSvg(theirBooks, null, 50, true) : '';
                
                // Current / Last Read Book
                let currentBook = theirBooks.find(b => b.currently_reading || b.currentlyReading || b.status === 'reading');
                if (!currentBook && theirBooks.length > 0) {
                    currentBook = [...theirBooks].sort((a,b) => (b.year || 0) - (a.year || 0) || (b.month_finished || '').localeCompare(a.month_finished || ''))[0];
                }
                const bookTitle = currentBook ? App._escapeHtml(currentBook.title || 'Unknown Title') : 'No books logged yet';
                let bookCoverUrl = null;
                if (currentBook) {
                    bookCoverUrl = currentBook.cover_url || currentBook.coverUrl || currentBook.cover || currentBook.cover_image || currentBook.image || currentBook.thumbnail || currentBook.bookCover || null;
                    if (!bookCoverUrl && (currentBook.cover_id || currentBook.cover_i)) {
                        bookCoverUrl = `https://covers.openlibrary.org/b/id/${currentBook.cover_id || currentBook.cover_i}-M.jpg`;
                    }
                    const rawIsbn = currentBook.isbn || currentBook.isbn13 || currentBook.isbn10 || currentBook.isbn_13 || currentBook.isbn_10;
                    if (!bookCoverUrl && rawIsbn) {
                        bookCoverUrl = `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(rawIsbn)}-M.jpg?default=false`;
                    }
                }
                const bookCover = (bookCoverUrl && String(bookCoverUrl).trim() !== '') ? bookCoverUrl : fallbackCoverSvg;
                const escBookCover = (typeof App._escapeHtml === 'function') ? App._escapeHtml(bookCover) : bookCover;
                const bookCount = theirBooks.length;

                const name = App._escapeHtml(p.display_name || 'Reader');
                const avatar = (typeof App !== "undefined" && App._getUserAvatar ? App._getUserAvatar(p) : (p.avatar_emoji || '👤'));
                const bg = App._avatarBg ? App._avatarBg(avatar) : 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)';
                const avatarHtml = (avatar && (avatar.includes('http') || avatar.includes('data:image')))
                    ? `<img src="${App._escapeHtml(avatar)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
                    : App._escapeHtml(avatar || '👤');
                
                // Match Gauge Color
                let gaugeColor = 'var(--wood-light)';
                if (matchPct > 80) gaugeColor = 'var(--gold, #D4AF37)';
                else if (matchPct > 50) gaugeColor = 'var(--accent-glow, #e6c875)';
                else if (matchPct > 0) gaugeColor = 'var(--burgundy, #8b2635)';

                html += `
                    <div style="display: flex; flex-direction: column; gap: 10px; padding: 15px; border-bottom: 1px solid rgba(61,43,31,0.08); background: var(--card-bg, #fff); border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.03); cursor: pointer; transition: all 0.2s;" onclick="App.openProfileView('${id}')" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.05)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.03)'">
                        
                        <!-- Top Row: Avatar & Name -->
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <div style="display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1;">
                                <div style="width: 44px; height: 44px; border-radius: 50%; background: ${bg}; display: flex; align-items: center; justify-content: center; font-size: 1.3rem; color:white; box-shadow:0 2px 4px rgba(0,0,0,0.1); overflow:hidden;">${avatarHtml}</div>
                                <div style="min-width: 0; flex: 1;">
                                      <div style="font-weight: 600; color: var(--wood-dark); font-size: 1.05rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${name}</div>
                                    <div style="font-size: 0.8rem; color: var(--wood-mid); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${bookCount} book${bookCount === 1 ? '' : 's'} logged</div>
                                </div>
                            </div>
                            <!-- Mini DNA Radar -->
                            <div style="width: 50px; height: 50px; background: rgba(0,0,0,0.02); border-radius: 50%; display: flex; align-items: center; justify-content: center; position: relative;">
                                ${miniRadarSvg}
                            </div>
                        </div>
                        
                        <!-- Middle Row: Currently Reading -->
                        <div style="display: flex; align-items: center; gap: 10px; background: rgba(61,43,31,0.03); padding: 8px 12px; border-radius: 8px; margin-top: 2px;">
                            <img src="${escBookCover}" alt="${bookTitle}" style="width: 24px; height: 36px; object-fit: cover; border-radius: 2px; box-shadow: 0 1px 3px rgba(0,0,0,0.2);" onerror="this.onerror=null; this.src='${fallbackCoverSvg}';">
                            <div style="flex: 1; min-width: 0;">
                                <div style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--wood-mid); font-weight: 600;">${currentBook && (currentBook.currently_reading || currentBook.currentlyReading || currentBook.status === 'reading') ? 'Currently Reading' : 'Last Read'}</div>
                                <div style="font-size: 0.9rem; color: var(--wood-dark); font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${bookTitle}</div>
                            </div>
                        </div>
                        
                        <!-- Bottom Row: Match Gauge -->
                        <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 4px;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <div style="font-size: 0.8rem; font-weight: 600; color: ${gaugeColor}; width: 35px;">${matchPct}%</div>
                                <div style="flex: 1; height: 6px; background: rgba(61,43,31,0.08); border-radius: 3px; position: relative; overflow: hidden;">
                                    <div style="width: ${matchPct}%; height: 100%; background: linear-gradient(to right, #8b2635, #eab308, #10b981); border-radius: 3px; transition: width 0.4s ease;"></div>
                                </div>
                            </div>
                            <div style="font-size: 0.75rem; color: var(--wood-mid); padding-left: 45px; font-style: italic;">${matchReason}</div>
                        </div>

                    </div>
                `;
            });
        }
        
        html += `</div>`;
        container.innerHTML = html;
        
    } catch (e) {
        console.error("Error rendering network:", e);
        container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--burgundy);">Error loading network.</div>';
    }
  },

  async renderClubs() {
  this._unsubscribeClubRealtime();
  App._currentClub = null;
  if (typeof this._unsubscribeClubRealtime === 'function') this._unsubscribeClubRealtime();
  const el = document.getElementById('clubsList');
  if (!el) return;

  if (!App.userId && !App.isDemoMode) {
    el.innerHTML = '<div style="padding:24px;text-align:center;color:var(--wood-light);font-size:12px;">Sign in to join or create a reading club.</div>';
    return;
  } 

  el.innerHTML = '<div style="font-size:11px;color:var(--wood-light);padding:8px 0;font-family:\'DM Mono\',monospace;letter-spacing:0.06em;">Loading clubs...</div>';

  try {
    const isPublic = App._clubsTab === 'public';
    let clubs;
    
    if (App.isDemoMode) {
      if (typeof window !== 'undefined' && window._mockClubs) {
        clubs = isPublic ? window._mockClubs.filter(c => c.isPublic) : window._mockClubs.filter(c => !c.isPublic || c.myRole === 'member' || c.myRole === 'admin');
      } else {
        clubs = isPublic ? [
          { id: 'mock_c1', name: 'Sci-Fi Sundays', description: 'Exploring the outer limits of imagination.', current_book_title: 'Dune', current_book_author: 'Frank Herbert', current_book_cover: 'https://books.google.com/books/content?vid=ISBN9780441172719&printsec=frontcover&img=1&zoom=1', memberCount: 42, isPublic: true },
          { id: 'mock_c2', name: 'The Classics', description: 'Re-reading the books we were supposed to read in high school.', current_book_title: '1984', current_book_author: 'George Orwell', current_book_cover: 'https://books.google.com/books/content?vid=ISBN9780451524935&printsec=frontcover&img=1&zoom=1', memberCount: 128, isPublic: true }
        ] : [
          { id: 'mock_c1', name: 'Sci-Fi Sundays', description: 'Exploring the outer limits of imagination.', current_book_title: 'Project Hail Mary', current_book_author: 'Andy Weir', current_book_cover: 'https://books.google.com/books/content?vid=ISBN9780593135204&printsec=frontcover&img=1&zoom=1', myRole: 'admin', isPublic: false, invite_code: 'SCIFI2026' }
        ];
      }
    } else {
      clubs = isPublic ? await DB.getPublicClubs() : await DB.getMyClubs(App.userId);
      if (typeof window !== 'undefined' && window.App && !isPublic) window.App.clubs = clubs;
    }

    const esc = s => (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const fallbackCoverBase64 = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InJnYmEoNjEsNDMsMzEsMC4wMykiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1zaXplPSIyNHB4IiBkeT0iLjM1ZW0iIHRleHQtYW5jaG9yPSJtaWRkbGUiIG9wYWNpdHk9IjAuNCI+8J+Slsjwvc3ZnPg==';

    const clubCards = (clubs||[]).map(c => {
      const listThumbMatch = (c.description || '').match(/\[thumb:(.*?)\]/);
      const listClubThumb = c.thumbnail_url || c.thumbnail || (listThumbMatch ? listThumbMatch[1] : null);
      const cleanCardDesc = (c.description || '').replace(/\[thumb:.*?\]/g, '').replace(/https?:\/\/\S+/g, '').replace(/\b\S+\.(png|jpg|jpeg|gif|webp)\S*\b/gi, '').trim();

      return `<div class="club-card" style="display: flex; flex-direction: column; padding: 0; margin-bottom: 16px; background: var(--paper); border: 1px solid rgba(139,38,53,0.15); border-radius: 12px; box-shadow: 0 6px 20px rgba(61,43,31,0.06); overflow: hidden; transition: all 0.3s cubic-bezier(0.25, 1, 0.5, 1); cursor: pointer;" onclick="App.openClub('${c.id}')" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 12px 28px rgba(61,43,31,0.1)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 6px 20px rgba(61,43,31,0.06)';">
          <div style="padding: 16px; display: flex; gap: 16px; align-items: stretch;">
              ${c.current_book_title ? `
              <div style="flex-shrink: 0; width: 60px; display: flex; flex-direction: column; align-items: center;">
                  <img loading="lazy" decoding="async" src="${esc(c.current_book_cover || fallbackCoverBase64)}" style="width: 100%; aspect-ratio: 2/3; object-fit: cover; border-radius: 6px; box-shadow: 0 4px 12px rgba(61,43,31,0.15); margin-bottom: 6px;" onerror="this.onerror=null;this.src='${fallbackCoverBase64}';">
              </div>
              ` : (listClubThumb ? `
              <div style="flex-shrink: 0; width: 60px; display: flex; align-items: center; justify-content: center;">
                  <img loading="lazy" decoding="async" src="${esc(listClubThumb)}" style="width: 100%; aspect-ratio: 1/1; object-fit: cover; border-radius: 6px; box-shadow: 0 4px 12px rgba(61,43,31,0.15);" onerror="this.onerror=null;this.parentElement.innerHTML='<div style=\\\'font-size: 1.5rem; opacity: 0.3;\\\'>📖</div>';">
              </div>
              ` : `
              <div style="flex-shrink: 0; width: 60px; display: flex; align-items: center; justify-content: center; background: rgba(61,43,31,0.03); border-radius: 6px; border: 1px dashed rgba(61,43,31,0.1);">
                  <div style="font-size: 1.5rem; opacity: 0.3;">📖</div>
              </div>
              `)}
              
              <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; min-width: 0;">
                  <div style="margin-bottom: 4px;">
                      <h3 style="margin: 0; font-family: 'Playfair Display', serif; font-size: 1.25rem; font-weight: 700; color: var(--burgundy); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${esc(c.name)}</h3>
                  </div>
                  
                  ${c.current_book_title ? `
                      <div style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--wood-mid); font-weight: 700;">Currently Reading</div>
                      <div style="font-size: 0.95rem; font-weight: 700; color: var(--wood-dark); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${esc(c.current_book_title)}</div>
                      ${c.current_book_author ? `<div style="font-size: 0.8rem; color: var(--wood-mid); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">by ${esc(c.current_book_author)}</div>` : ''}
                  ` : (cleanCardDesc ? `
                      <div style="font-size: 0.85rem; color: var(--wood-mid); font-style: italic; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${esc(cleanCardDesc)}</div>
                  ` : `
                      <div style="font-size: 0.85rem; color: var(--wood-mid); font-style: italic; margin-top: 4px;">No book selected yet. Click to nominate!</div>
                  `)}
                  
                  ${!isPublic ? `
                  <div style="margin-top: 10px; font-size: 0.75rem; color: var(--wood-light); font-family: 'DM Mono', monospace;">
                      Invite Code: <span style="color: var(--wood-dark); font-weight: bold; background: rgba(61,43,31,0.05); padding: 2px 6px; border-radius: 4px; cursor: pointer;" onclick="event.stopPropagation();App._copyInviteCode('${esc(((c.invite_code || '').startsWith('PUBLIC_') ? (c.invite_code || '').replace('PUBLIC_', '') : (c.invite_code || '')).substring(0,4))}')">${esc(((c.invite_code || '').startsWith('PUBLIC_') ? (c.invite_code || '').replace('PUBLIC_', '') : (c.invite_code || '')).substring(0,4))}</span>
                  </div>
                  ` : ''}
              </div>
              
              <div style="display: flex; flex-direction: column; align-items: flex-end; justify-content: flex-start; gap: 6px; flex-shrink: 0;">
                  ${isPublic ? `<button class="club-join-btn" onclick="event.stopPropagation(); App.joinClub('${c.id}')" style="background: var(--burgundy); color: #fff; border: none; padding: 4px 12px; border-radius: 14px; font-weight: 700; font-size: 0.75rem; cursor: pointer; box-shadow: 0 2px 6px rgba(139,38,53,0.25);">Join</button>` : ''}
                  <span style="font-size: 0.7rem; font-family: 'DM Mono', monospace; padding: 2px 8px; background: rgba(139,38,53,0.1); color: var(--burgundy); border-radius: 12px; font-weight: 700;">${isPublic ? '🌐 PUBLIC' : (c.myRole === 'admin' ? '⚙️ ADMIN' : '👤 MEMBER')}</span>
              </div>
          </div>
      </div>`;
    }).join('');

    const actionControls = `
      <div style="display:flex; gap:8px; margin-bottom:16px; align-items: stretch;">
        <button class="club-create-btn" onclick="App.showCreateClubForm()" title="Create a new Reading Club" style="flex:1; margin-bottom:0; height:40px; display:flex; align-items:center; justify-content:center; white-space:nowrap; padding:0 12px; font-size:13px; font-weight:600;">+ Create</button>
        <div class="club-join-row" style="flex:2; display:flex; gap:6px; margin-bottom:0; height:40px;">
          <input class="club-join-input" id="clubJoinCodeInput" placeholder="Invite code..." maxlength="10" title="Enter a 10-character invite code" style="flex:1; margin-bottom:0; height:40px; box-sizing:border-box;">
          <button class="club-msg-send" onclick="App.joinClubByCode()" title="Join Club by Code" style="height:40px; margin-bottom:0;">Join</button>
        </div>
      </div>
      <div id="clubJoinMsg" style="font-size:11px;color:var(--dislike);min-height:14px;margin-bottom:6px;margin-top:-10px;text-align:right;"></div>
    `;

    const tabsHtml = `
      <div style="display:flex; gap:8px; margin-bottom:16px;">
        <button onclick="App._clubsTab='private';App.renderClubs()" style="flex:1; padding:8px; border-radius:8px; border:1px solid ${!isPublic ? 'var(--wood-dark)' : 'rgba(61,43,31,0.2)'}; background:${!isPublic ? 'var(--wood-dark)' : 'transparent'}; color:${!isPublic ? '#fff' : 'var(--wood-dark)'}; font-size:12px; font-weight:600; cursor:pointer;">My Clubs</button>
        <button onclick="App._clubsTab='public';App.renderClubs()" style="flex:1; padding:8px; border-radius:8px; border:1px solid ${isPublic ? 'var(--wood-dark)' : 'rgba(61,43,31,0.2)'}; background:${isPublic ? 'var(--wood-dark)' : 'transparent'}; color:${isPublic ? '#fff' : 'var(--wood-dark)'}; font-size:12px; font-weight:600; cursor:pointer;">Public Clubs</button>
      </div>
    `;

    const symSparkles = (typeof window !== 'undefined' && window.APP_SYMBOLS && window.APP_SYMBOLS.sparkles) || '✨';
    const symArrow = (typeof window !== 'undefined' && window.APP_SYMBOLS && window.APP_SYMBOLS.arrow) || '→';
    const recapBannerHtml = '';
    el.innerHTML = tabsHtml + recapBannerHtml + actionControls + clubCards;
  } catch(e) { 
    alert('renderClubs Error: ' + (e.message || e));
    el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--wood-light);font-size:12px;">Could not load clubs.</div>'; 
  }
},

  _ensureDNAResponsiveStyles() {
    if (typeof document === 'undefined') return;
    if (!document.getElementById('dna-responsive-styles')) {
        const style = document.createElement('style');
        style.id = 'dna-responsive-styles';
        style.textContent = `
            #commRadarPane {
                overflow-x: hidden !important;
                overflow-y: auto !important;
            }
            .dna-wrapper {
                box-sizing: border-box !important;
                max-width: 100% !important;
            }
            .dna-drag-hitbox {
                cursor: pointer;
                touch-action: none;
                pointer-events: all;
            }
            .dna-drag-circle {
                cursor: pointer;
                pointer-events: all;
            }
            #commRadarPane .dna-legend-row,
            #commRadarPane [style*="justify-content: space-between"] {
                display: flex !important;
                flex-wrap: wrap !important;
                gap: 12px !important;
                align-items: center !important;
                width: 100% !important;
            }
            #commRadarPane .dna-legend {
                display: flex !important;
                flex-wrap: wrap !important;
                gap: 12px !important;
            }
            @media (max-width: 768px) {
                .dna-wrapper {
                    padding: 12px 8px !important;
                    flex-direction: column !important;
                    align-items: center !important;
                }
                #dnaOverlayContainer {
                    position: fixed !important;
                    bottom: 0 !important;
                    left: 0 !important;
                    right: 0 !important;
                    top: auto !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    max-height: 72vh !important;
                    border-radius: 24px 24px 0 0 !important;
                    box-sizing: border-box !important;
                    z-index: 99100 !important;
                    margin: 0 !important;
                    box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.25) !important;
                }
                #dnaOverlayContainer .avatar-carousel,
                #dnaOverlayContainer #friendOverlayList {
                    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)) !important;
                    gap: 10px !important;
                    min-height: 160px !important;
                }
                #commRadarPane [style*="justify-content: space-between"] {
                    flex-direction: column !important;
                    align-items: stretch !important;
                    gap: 12px !important;
                }
                #commRadarPane #dnaOverlayBtn {
                    width: 100% !important;
                    justify-content: center !important;
                }
            }
        `;
        document.head.appendChild(style);
    }
  },

  _attachDNAResizeListener() {
    if (typeof window === 'undefined') return;

    if (!window._sl_dna_resize_attached) {
        window._sl_dna_resize_attached = true;
        window.addEventListener('resize', () => {
            clearTimeout(this._dnaResizeDebounce);
            this._dnaResizeDebounce = setTimeout(() => {
                const pane = document.getElementById('commRadarPane');
                const svg = document.getElementById('goalRadarSvg');
                if (pane && svg && pane.style.display !== 'none' && pane.offsetParent !== null) {
                    if (window.App && typeof window.App._drawDNARadar === 'function') {
                        window.App._drawDNARadar('goalRadarSvg', window.App.books || []);
                    }
                }
            }, 120);
        });
    }

    const pane = document.getElementById('commRadarPane');
    const wrapper = pane ? (pane.querySelector('.dna-wrapper') || pane) : null;
    if (wrapper && typeof ResizeObserver !== 'undefined') {
        if (!this._dnaResizeObserver) {
            this._dnaResizeObserver = new ResizeObserver((entries) => {
                for (const entry of entries) {
                    if (entry.contentRect.width > 0) {
                        clearTimeout(this._dnaResizeDebounce);
                        this._dnaResizeDebounce = setTimeout(() => {
                            const p = document.getElementById('commRadarPane');
                            if (p && p.style.display !== 'none' && p.offsetParent !== null) {
                                if (window.App && typeof window.App._drawDNARadar === 'function') {
                                    window.App._drawDNARadar('goalRadarSvg', window.App.books || []);
                                }
                            }
                        }, 120);
                    }
                }
            });
            this._dnaResizeObserver.observe(wrapper);
        }
    }
  },

  _generateRadarSvg(baseBooks, overlayBooks, size = 100, showOutline = true) {
      const traits = {
          'Romance': { genres: ['Romance', 'Contemporary Romance', 'Love'] },
          'Spicy': { genres: ['Smut', 'Erotica', 'Spicy', 'Dark Romance'] },
          'Dark Vibe': { genres: ['Horror', 'Dark Fantasy', 'Gothic', 'Dark', 'Grimdark'] },
          'True Crime': { genres: ['True Crime', 'Crime', 'Crime Non-Fiction'] },
          'Fast Pace': { genres: ['Thriller', 'Action', 'Adventure', 'Mystery', 'Suspense'] },
          'Epic World': { genres: ['Fantasy', 'Science Fiction', 'High Fantasy', 'Sci-Fi', 'Dystopian', 'Space Opera'] },
          'Literary': { genres: ['Literary Fiction', 'Classics', 'Contemporary Fiction', 'Literary', 'Contemporary', 'General Fiction', 'Fiction', 'Novel', 'Literature'] },
          'Historical': { genres: ['Historical Fiction', 'History', 'Period', 'Historical'] },
          'Non-Fiction': { genres: ['Non-Fiction', 'Biography', 'Memoir', 'Science', 'Essays'] },
          'Self-Help': { genres: ['Self-Help', 'Personal Development', 'Productivity', 'Philosophy', 'Health', 'Psychology'] },
          'Young Adult': { genres: ['Young Adult', 'YA', 'Teen', 'New Adult'] },
          'Lighthearted': { genres: ['Comedy', 'Humor', 'Cozy Mystery', 'Middle Grade', 'Graphic Novel', 'Cozy'] }
      };
      
      const getPolyPoints = (values) => {
          const gCenterX = 50, gCenterY = 50, gMaxRad = 40;
          const gAngles = values.map((_, i) => (Math.PI * 2 * i) / values.length - Math.PI / 2);
          return values.map((val, i) => {
              const x = gCenterX + (gMaxRad * val) * Math.cos(gAngles[i]);
              const y = gCenterY + (gMaxRad * val) * Math.sin(gAngles[i]);
              return `${x.toFixed(1)},${y.toFixed(1)}`;
          }).join(" ");
      };
      
      const computeShape = (books) => {
          if (!books || !books.length) return Array(Object.keys(traits).length).fill(0.6);
          let shapeScores = Array(Object.keys(traits).length).fill(0);
          books.forEach(b => {
              const g = (window.normalizeGenre ? window.normalizeGenre(b.genre) : (b.genre || 'General Fiction')).trim().toLowerCase();
              let sentimentMult = 1.0;
              if (b.sentiment === 'loved') sentimentMult = 1.5;
              else if (b.sentiment === 'liked') sentimentMult = 1.0;
              else if (b.sentiment === 'mixed') sentimentMult = 0.5;
              else if (b.sentiment === 'disliked') sentimentMult = 0.2;

              let idx = 0;
              for (const data of Object.values(traits)) {
                  const matches = data.genres.map(x => x.toLowerCase());
                  if (matches.includes(g) || matches.some(x => g.includes(x))) { 
                      shapeScores[idx] += 1.0 * sentimentMult;
                  }
                  idx++;
              }
          });
          let maxShape = Math.max(...shapeScores);
          return maxShape === 0 ? Array(Object.keys(traits).length).fill(0.6) : shapeScores.map(s => Math.max(0.1, s/maxShape));
      };

      const baseValues = computeShape(baseBooks);
      const basePoints = getPolyPoints(baseValues);
      const fullPoints = getPolyPoints(Array(Object.keys(traits).length).fill(1));

      const viewBox = size >= 100 ? "-25 -25 150 150" : "0 0 100 100";
      let html = `<svg viewBox="${viewBox}" style="width: ${size}px; height: ${size}px; overflow: visible; opacity: 0.8;">`;
      if (showOutline) {
          html += `<circle cx="50" cy="50" r="40" fill="none" stroke="rgba(61,43,31,0.1)" stroke-dasharray="2,2"/>`;
          html += `<circle cx="50" cy="50" r="20" fill="none" stroke="rgba(61,43,31,0.05)"/>`;
          html += `<polygon points="${fullPoints}" fill="none" stroke="rgba(61,43,31,0.15)" stroke-width="1"/>`;
          
          if (size >= 100) {
              const traitNames = Object.keys(traits);
              const gCenterX = 50, gCenterY = 50, labelRad = 52;
              const gAngles = traitNames.map((_, i) => (Math.PI * 2 * i) / traitNames.length - Math.PI / 2);
              traitNames.forEach((lbl, i) => {
                  const x = gCenterX + labelRad * Math.cos(gAngles[i]);
                  const y = gCenterY + labelRad * Math.sin(gAngles[i]);
                  let anchor = 'middle';
                  if (Math.abs(Math.cos(gAngles[i])) > 0.1) anchor = Math.cos(gAngles[i]) > 0 ? 'start' : 'end';
                  html += `<text x="${x.toFixed(1)}" y="${(y+3).toFixed(1)}" font-family="'DM Mono', monospace" font-size="7" fill="var(--wood-light)" text-anchor="${anchor}">${lbl.toUpperCase()}</text>`;
              });
          }
      }
      html += `<polygon points="${basePoints}" fill="rgba(139,38,53,0.15)" stroke="var(--burgundy, #8b2635)" stroke-width="1.5" stroke-linejoin="round" />`;
      
      if (overlayBooks) {
          const overlayShape = computeShape(overlayBooks);
          const overlayPoints = getPolyPoints(overlayShape);
          html += `<polygon points="${overlayPoints}" fill="rgba(212,175,55,0.4)" stroke="var(--gold, #d4af37)" stroke-width="1.5" stroke-linejoin="round" />`;
      }
      
      html += `</svg>`;
      return html;
  },

  async _loadDNANetwork() {
    const listEl = document.getElementById('friendOverlayList');
    if (!listEl) return;
    
    // Only load once
    if (listEl.getAttribute('data-loaded') === 'true') return;
    listEl.innerHTML = `
        <div style="grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px; gap: 15px;">
            <div style="width: 32px; height: 32px; border: 3px solid rgba(61,43,31,0.1); border-top-color: var(--wood-dark); border-radius: 50%; animation: spin 1s linear infinite;"></div>
            <div style="font-size: 0.85rem; color: var(--wood-mid); font-family: 'Inter', sans-serif; animation: skel-pulse 1.5s ease-in-out infinite;">Loading network DNA... 🧬</div>
        </div>
    `;
    try {
        const profiles = await DB.getPublicProfiles(App.userId);
        if (!profiles || profiles.length === 0) {
            listEl.innerHTML = '<div style="grid-column: 1 / -1; font-size: 0.8rem; color: var(--wood-mid); text-align: center; padding: 20px;">No public readers found yet.</div>';
            listEl.setAttribute('data-loaded', 'true');
            return;
        }

        const overlayFriends = [];
        const colors = [
            { color: 'rgba(219, 112, 147, 0.4)', border: '#db7093' },
            { color: 'rgba(60, 179, 113, 0.4)', border: '#3cb371' },
            { color: 'rgba(147, 112, 219, 0.4)', border: '#9370db' },
            { color: 'rgba(255, 165, 0, 0.4)', border: '#ffa500' },
            { color: 'rgba(100, 149, 237, 0.4)', border: '#6495ed' },
            { color: 'rgba(205, 92, 92, 0.4)', border: '#cd5c5c' }
        ];

        let count = 0;
        for (const p of profiles) {
            if (count >= 12) break;
            
            const ignored = JSON.parse(localStorage.getItem('sl_ignored_readers') || '[]');
            if (ignored.includes(p.user_id)) continue;

            let books = [];
            try { books = await DB.getPublicUserBooks(p.user_id); } catch(e) {}
            if (!books || books.length < 1) continue;

            const traits = {
                'Romance': { id: 'romance', label: 'Romance', score: 0, genres: ['Romance', 'Contemporary Romance', 'Love'] },
                'Spicy': { id: 'spicy', label: 'Spicy', score: 0, genres: ['Smut', 'Erotica', 'Spicy', 'Dark Romance'] },
                'Dark Vibe': { id: 'darkVibe', label: 'Dark Vibe', score: 0, genres: ['Horror', 'Dark Fantasy', 'Gothic', 'Dark', 'Grimdark'] },
                'True Crime': { id: 'trueCrime', label: 'True Crime', score: 0, genres: ['True Crime', 'Crime', 'Crime Non-Fiction'] },
                'Fast Pace': { id: 'fastPace', label: 'Fast Pace', score: 0, genres: ['Thriller', 'Action', 'Adventure', 'Mystery', 'Suspense'] },
                'Epic World': { id: 'epicWorld', label: 'Epic World', score: 0, genres: ['Fantasy', 'Science Fiction', 'High Fantasy', 'Sci-Fi', 'Dystopian', 'Space Opera'] },
                'Literary': { id: 'literary', label: 'Literary', score: 0, genres: ['Literary Fiction', 'Classics', 'Contemporary Fiction', 'Literary', 'Contemporary', 'General Fiction', 'Fiction', 'Novel', 'Literature'] },
                'Historical': { id: 'historical', label: 'Historical', score: 0, genres: ['Historical Fiction', 'History', 'Period', 'Historical'] },
                'Non-Fiction': { id: 'nonFiction', label: 'Non-Fiction', score: 0, genres: ['Non-Fiction', 'Biography', 'Memoir', 'Science', 'Essays'] },
                'Self-Help': { id: 'selfHelp', label: 'Self-Help', score: 0, genres: ['Self-Help', 'Personal Development', 'Productivity', 'Philosophy', 'Health', 'Psychology'] },
                'Young Adult': { id: 'ya', label: 'Young Adult', score: 0, genres: ['Young Adult', 'YA', 'Teen', 'New Adult'] },
                'Lighthearted': { id: 'lighthearted', label: 'Lighthearted', score: 0, genres: ['Comedy', 'Humor', 'Cozy Mystery', 'Middle Grade', 'Graphic Novel', 'Cozy'] }
            };

            books.forEach(b => {
                const g = (window.normalizeGenre ? window.normalizeGenre(b.genre) : (b.genre || 'General Fiction')).trim().toLowerCase();
                let sentimentMult = 1.0;
                if (b.sentiment === 'loved') sentimentMult = 1.5;
                else if (b.sentiment === 'liked') sentimentMult = 1.0;
                else if (b.sentiment === 'mixed') sentimentMult = 0.5;
                else if (b.sentiment === 'disliked') sentimentMult = 0.2;

                const bMoods = Array.isArray(b.moods)
                    ? b.moods.map(m => String(m).toLowerCase())
                    : (typeof b.moods === 'string' ? [b.moods.toLowerCase()] : (Array.isArray(b.mood) ? b.mood.map(m => String(m).toLowerCase()) : []));

                for (const tData of Object.values(traits)) {
                    const matches = tData.genres.map(x => x.toLowerCase());
                    if (matches.includes(g) || matches.some(x => g.includes(x))) {
                        tData.score += 1.0 * sentimentMult;
                    }
                    if (bMoods.some(m => matches.some(x => m.includes(x) || x.includes(m)))) {
                        tData.score += 0.25 * sentimentMult;
                    }
                }
            });

            const dnaAttributes = Object.values(traits);
            let maxScore = 0;
            dnaAttributes.forEach(a => { if (a.score > maxScore) maxScore = a.score; });

            const values = maxScore === 0 
                ? Array(12).fill(0.3)
                : dnaAttributes.map(a => Math.max(0.1, a.score / maxScore));

            const c = colors[count % colors.length];

            overlayFriends.push({
                userId: p.user_id,
                name: p.display_name || 'Reader',
                avatar: (typeof App !== "undefined" && App._getUserAvatar ? App._getUserAvatar(p) : (p.avatar_emoji || '👤')),
                values: values,
                color: c.color,
                border: c.border
            });
            count++;
        }

        listEl.innerHTML = '';
        if (overlayFriends.length === 0) {
            listEl.innerHTML = '<div style="grid-column: 1 / -1; font-size: 0.8rem; color: var(--wood-mid); text-align: center; padding: 20px;">No public readers with enough data found yet.</div>';
            listEl.setAttribute('data-loaded', 'true');
            return;
        }

        if (!document.getElementById('friendOverlayStyles')) {
            const style = document.createElement('style');
            style.id = 'friendOverlayStyles';
            style.innerHTML = `
                .friend-overlay-btn {
                    display: flex; flex-direction: column; align-items: center; justify-content: center;
                    background: none; border: 1px solid transparent; border-radius: 12px;
                    padding: 10px 4px; cursor: pointer; transition: all 0.2s; width: 100%;
                    box-sizing: border-box; font-family: inherit; position: relative;
                }
                .friend-overlay-btn:hover { background: rgba(0,0,0,0.03); }
                .friend-overlay-btn.active { background: rgba(0,0,0,0.06); border-color: rgba(0,0,0,0.1); box-shadow: inset 0 2px 4px rgba(0,0,0,0.05); }
                .friend-overlay-btn.active::after { content: "❌"; position: absolute; top: 4px; right: 8px; color: var(--burgundy); font-size: 14px; font-weight: bold; }
            `;
            document.head.appendChild(style);
        }

        overlayFriends.forEach((friend) => {
            const btn = document.createElement('button');
            btn.className = 'friend-overlay-btn';
            btn.setAttribute('data-name', friend.name);
            
            const av = friend.avatar || '👤';
            const avHtml = (av && (av.includes('http') || av.includes('data:image')))
                ? `<img src="${App._escapeHtml(av)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
                : App._escapeHtml(av);

            btn.innerHTML = `<div style="width:48px; height:48px; border-radius:50%; background:${friend.border}; color:white; display:flex; align-items:center; justify-content:center; font-size:24px; margin-bottom:8px; box-shadow:0 4px 10px rgba(0,0,0,0.15); overflow:hidden;">${avHtml}</div><span style="font-size:0.75rem; color:var(--wood-dark); font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:60px;">${App._escapeHtml(friend.name)}</span>`;
            
            btn.onclick = () => {
                if (!App._dnaState) {
                    App._dnaState = { targetShape: Array(12).fill(0.5), activeFriends: [] };
                }
                
                if (btn.classList.contains('active')) {
                    btn.classList.remove('active');
                    App._dnaState.activeFriends = App._dnaState.activeFriends.filter(f => f.userId !== friend.userId);
                } else {
                    if (App._dnaState.activeFriends.length >= 3) {
                        if (typeof showToast === 'function') showToast('Maximum 3 overlays allowed.');
                        return;
                    }
                    btn.classList.add('active');
                    App._dnaState.activeFriends.push(friend);
                }
                
                if (typeof App._drawDNARadar === 'function') {
                    App._drawDNARadar('goalRadarSvg', App.books || []);
                }
            };
            listEl.appendChild(btn);
        });

        listEl.setAttribute('data-loaded', 'true');
    } catch (e) {
        console.error('Error loading DNA network:', e);
        listEl.innerHTML = '<div style="grid-column: 1 / -1; font-size: 0.8rem; color: var(--burgundy); text-align: center; padding: 20px;">Error loading network.</div>';
    }
  },

  _drawDNARadar(containerId = 'goalRadarSvg', books) {
    const goalSvg = document.getElementById(containerId);
    if (!goalSvg) return;

    this._ensureDNAResponsiveStyles();
    this._attachDNAResizeListener();
    
    goalSvg.innerHTML = '';
    if (!window.App._dnaState) {
        let storedShape = null;
        try {
            const saved = localStorage.getItem('sl_dna_desired_shape');
            if (saved) storedShape = JSON.parse(saved);
        } catch(e) {}
        window.App._dnaState = {
            targetShape: (storedShape && storedShape.length === 12) ? storedShape : Array(12).fill(0.5),
            activeFriends: []
        };
    }
    const state = window.App._dnaState;
    if (!state.targetShape || state.targetShape.length !== 12) {
        let storedShape = null;
        try {
            const saved = localStorage.getItem('sl_dna_desired_shape');
            if (saved) storedShape = JSON.parse(saved);
        } catch(e) {}
        state.targetShape = storedShape && storedShape.length === 12 ? storedShape : Array(12).fill(0.5);
    }
    if (!state.activeFriends) state.activeFriends = [];

    // Dynamically calculate radius to guarantee all 12 labels stay within bounds on 375px mobile
    const svgRect = goalSvg.getBoundingClientRect();
    const isSmall = (typeof window !== 'undefined' && window.innerWidth <= 480) || (svgRect && svgRect.width > 0 && svgRect.width < 380);
    const gCenterX = 250, gCenterY = 250;
    const gMaxRad = 170;

    const consumedBooks = (books || App.books || []).filter(b => !b.currentlyReading && b.status !== 'to-read' && b.status !== 'reading');

    const traits = {
        'Romance': { id: 'romance', label: 'Romance', score: 0, genres: ['Romance', 'Contemporary Romance', 'Love'] },
        'Spicy': { id: 'spicy', label: 'Spicy', score: 0, genres: ['Smut', 'Erotica', 'Spicy', 'Dark Romance'] },
        'Dark Vibe': { id: 'darkVibe', label: 'Dark Vibe', score: 0, genres: ['Horror', 'Dark Fantasy', 'Gothic', 'Dark', 'Grimdark'] },
        'True Crime': { id: 'trueCrime', label: 'True Crime', score: 0, genres: ['True Crime', 'Crime', 'Crime Non-Fiction'] },
        'Fast Pace': { id: 'fastPace', label: 'Fast Pace', score: 0, genres: ['Thriller', 'Action', 'Adventure', 'Mystery', 'Suspense'] },
        'Epic World': { id: 'epicWorld', label: 'Epic World', score: 0, genres: ['Fantasy', 'Science Fiction', 'High Fantasy', 'Sci-Fi', 'Dystopian', 'Space Opera'] },
        'Literary': { id: 'literary', label: 'Literary', score: 0, genres: ['Literary Fiction', 'Classics', 'Contemporary Fiction', 'Literary', 'Contemporary', 'General Fiction', 'Fiction', 'Novel', 'Literature'] },
        'Historical': { id: 'historical', label: 'Historical', score: 0, genres: ['Historical Fiction', 'History', 'Period', 'Historical'] },
        'Non-Fiction': { id: 'nonFiction', label: 'Non-Fiction', score: 0, genres: ['Non-Fiction', 'Biography', 'Memoir', 'Science', 'Essays'] },
        'Self-Help': { id: 'selfHelp', label: 'Self-Help', score: 0, genres: ['Self-Help', 'Personal Development', 'Productivity', 'Philosophy', 'Health', 'Psychology'] },
        'Young Adult': { id: 'ya', label: 'Young Adult', score: 0, genres: ['Young Adult', 'YA', 'Teen', 'New Adult'] },
        'Lighthearted': { id: 'lighthearted', label: 'Lighthearted', score: 0, genres: ['Comedy', 'Humor', 'Cozy Mystery', 'Middle Grade', 'Graphic Novel', 'Cozy'] }
    };

    consumedBooks.forEach(b => {
        const g = (window.normalizeGenre ? window.normalizeGenre(b.genre) : (b.genre || 'General Fiction')).trim().toLowerCase();
        let sentimentMult = 1.0;
        if (b.sentiment === 'loved') sentimentMult = 1.5;
        else if (b.sentiment === 'liked') sentimentMult = 1.0;
        else if (b.sentiment === 'mixed') sentimentMult = 0.5;
        else if (b.sentiment === 'disliked') sentimentMult = 0.2;

        const bMoods = Array.isArray(b.moods)
            ? b.moods.map(m => String(m).toLowerCase())
            : (typeof b.moods === 'string' ? [b.moods.toLowerCase()] : (Array.isArray(b.mood) ? b.mood.map(m => String(m).toLowerCase()) : []));

        for (const tData of Object.values(traits)) {
            const matches = tData.genres.map(x => x.toLowerCase());
            if (matches.includes(g) || matches.some(x => g.includes(x))) {
                tData.score += 1.0 * sentimentMult;
            }
            if (bMoods.some(m => matches.some(x => m.includes(x) || x.includes(m)))) {
                tData.score += 0.25 * sentimentMult;
            }
        }
    });

    const dnaAttributes = Object.values(traits);
    let maxScore = 0;
    dnaAttributes.forEach(a => { if (a.score > maxScore) maxScore = a.score; });

    const currentVector = maxScore === 0
        ? Array(12).fill(0.5)
        : dnaAttributes.map(a => Math.min(1.0, Math.max(0, a.score / maxScore)));

    state.currentVector = currentVector;

    const currentValues = maxScore === 0 
        ? Array(12).fill(0.5) 
        : currentVector.map(v => Math.max(0.1, v));

    const gAngles = dnaAttributes.map((_, i) => (Math.PI * 2 * i) / dnaAttributes.length - Math.PI / 2);

    function getPolyPoints(values) {
        return values.map((val, i) => {
            const v = typeof val === 'number' ? Math.max(0.1, Math.min(1.0, val)) : 0.5;
            const x = gCenterX + (gMaxRad * v) * Math.cos(gAngles[i]);
            const y = gCenterY + (gMaxRad * v) * Math.sin(gAngles[i]);
            return `${x.toFixed(1)},${y.toFixed(1)}`;
        }).join(" ");
    }

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
        <linearGradient id="dnaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="rgba(139, 38, 53, 0.9)" />
            <stop offset="100%" stop-color="rgba(200, 75, 92, 0.9)" />
        </linearGradient>
        <filter id="dnaGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
    `;
    goalSvg.appendChild(defs);

    // Concentric grid webs
    for (let r = 1; r <= 4; r++) {
        let pts = "";
        gAngles.forEach(a => {
            const x = gCenterX + (gMaxRad * (r / 4)) * Math.cos(a);
            const y = gCenterY + (gMaxRad * (r / 4)) * Math.sin(a);
            pts += `${x.toFixed(1)},${y.toFixed(1)} `;
        });
        const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        poly.setAttribute('points', pts.trim());
        poly.setAttribute('fill', 'none');
        poly.setAttribute('stroke', r === 4 ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.08)');
        poly.setAttribute('stroke-width', r === 4 ? '2' : '1');
        goalSvg.appendChild(poly);
    }

    // Radial axes and safe-clamped responsive labels
    dnaAttributes.forEach((attr, i) => {
        const cos = Math.cos(gAngles[i]);
        const sin = Math.sin(gAngles[i]);
        const axX = gCenterX + gMaxRad * cos;
        const axY = gCenterY + gMaxRad * sin;
        
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', String(gCenterX));
        line.setAttribute('y1', String(gCenterY));
        line.setAttribute('x2', axX.toFixed(1));
        line.setAttribute('y2', axY.toFixed(1));
        line.setAttribute('stroke', 'rgba(0,0,0,0.1)');
        line.setAttribute('stroke-width', '1.5');
        goalSvg.appendChild(line);

        const labelDist = gMaxRad + (Math.abs(cos) > 0.4 ? 14 : 18);
        let tx = gCenterX + labelDist * cos;
        let ty = gCenterY + labelDist * sin;

        let anchor = 'middle';
        if (cos > 0.22) {
            anchor = 'start';
        } else if (cos < -0.22) {
            anchor = 'end';
        }

        if (sin > 0.6) {
            ty += 10;
        } else if (sin < -0.6) {
            ty -= 4;
        } else {
            ty += 4;
        }

        // Safe bounds containment within [16, 484] and [22, 478]
        if (anchor === 'start') {
            tx = Math.min(430, Math.max(16, tx));
        } else if (anchor === 'end') {
            tx = Math.max(70, Math.min(484, tx));
        } else {
            tx = Math.max(40, Math.min(460, tx));
        }
        ty = Math.max(22, Math.min(478, ty));
        
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', tx.toFixed(1));
        text.setAttribute('y', ty.toFixed(1));
        text.setAttribute('text-anchor', anchor);
        text.setAttribute('fill', 'var(--wood-dark, #2b1e16)');
        text.setAttribute('font-size', isSmall ? '11px' : '11.5px');
        text.setAttribute('font-weight', '700');
        text.setAttribute('font-family', "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif");
        text.setAttribute('letter-spacing', '0.01em');
        text.setAttribute('style', 'user-select: none; pointer-events: none;');
        text.textContent = attr.label;
        goalSvg.appendChild(text);
    });

    const badgesContainer = document.getElementById('dnaFriendBadgesContainer');
    if (badgesContainer) badgesContainer.innerHTML = '';

    // Active Friend Overlays
    state.activeFriends.forEach(friend => {
        const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        poly.setAttribute('points', getPolyPoints(friend.values));
        poly.setAttribute('fill', friend.color);
        poly.setAttribute('fill-opacity', '0.2');
        poly.setAttribute('stroke', friend.color);
        poly.setAttribute('stroke-width', '2');
        
        const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        title.textContent = friend.name;
        poly.appendChild(title);
        
        goalSvg.appendChild(poly);

        if (badgesContainer) {
            const badge = document.createElement('div');
            badge.style.cssText = 'display: flex; align-items: center; gap: 10px; padding: 8px 15px; background: rgba(255,255,255,0.9); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.5); border-radius: 30px; box-shadow: 0 8px 24px rgba(0,0,0,0.08);';
            badge.innerHTML = `
                <div style="width: 14px; height: 14px; border-radius: 50%; background: ${friend.color}; opacity: 0.8; border: 2px solid ${friend.border || friend.color};"></div>
                <div style="font-weight: bold; color: var(--wood-dark); font-size: 0.95rem;">${App._escapeHtml(friend.name)}</div>
            `;
            badgesContainer.appendChild(badge);
        }
    });

    // Actual Reading Profile
    const currentPoly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    currentPoly.setAttribute('points', getPolyPoints(currentValues));
    currentPoly.setAttribute('fill', 'url(#dnaGrad)');
    currentPoly.setAttribute('fill-opacity', '0.5');
    currentPoly.setAttribute('stroke', 'none');
    
    const titleCurr = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    titleCurr.textContent = 'Actual Reading Profile';
    currentPoly.appendChild(titleCurr);
    
    goalSvg.appendChild(currentPoly);

    // Desired Reading Profile Polygon (Dashed outline)
    const goalPoly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    goalPoly.setAttribute('points', getPolyPoints(state.targetShape));
    goalPoly.setAttribute('fill', 'rgba(139, 38, 53, 0.05)');
    goalPoly.setAttribute('stroke', 'rgba(139, 38, 53, 0.85)');
    goalPoly.setAttribute('stroke-width', '2');
    goalPoly.setAttribute('stroke-dasharray', '5,5');
    goalPoly.style.cursor = 'crosshair';
    
    const titleGoal = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    titleGoal.textContent = 'Desired Reading Profile (Click or drag to shape)';
    goalPoly.appendChild(titleGoal);
    
    goalSvg.appendChild(goalPoly);

    // Draggable Handles with Accessible Touch Hitboxes (>= 40px hitbox)
    dnaAttributes.forEach((attr, i) => {
        const px = gCenterX + (gMaxRad * state.targetShape[i]) * Math.cos(gAngles[i]);
        const py = gCenterY + (gMaxRad * state.targetShape[i]) * Math.sin(gAngles[i]);
        
        const handleGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        handleGroup.setAttribute('class', 'dna-drag-handle');
        handleGroup.setAttribute('data-axis-index', String(i));
        
        // Touch Hitbox (48x48 rect -> >= 40px touch area)
        const hitRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        hitRect.setAttribute('x', (px - 24).toFixed(1));
        hitRect.setAttribute('y', (py - 24).toFixed(1));
        hitRect.setAttribute('width', '48');
        hitRect.setAttribute('height', '48');
        hitRect.setAttribute('fill', 'transparent');
        hitRect.setAttribute('stroke', 'none');
        hitRect.setAttribute('class', 'dna-drag-hitbox');
        hitRect.style.cursor = 'pointer';
        hitRect.style.pointerEvents = 'all';

        // Visual Drag Circle (exactly 12 circle elements in SVG)
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', px.toFixed(1));
        circle.setAttribute('cy', py.toFixed(1));
        circle.setAttribute('r', '7.5');
        circle.setAttribute('fill', '#ffffff');
        circle.setAttribute('stroke', 'rgba(139, 38, 53, 0.85)');
        circle.setAttribute('stroke-width', '2.5');
        circle.setAttribute('class', 'dna-drag-circle');
        circle.style.cursor = 'pointer';
        circle.style.pointerEvents = 'all';
        
        const handleDrag = (e) => {
            e.preventDefault();
            e.stopPropagation();

            const getCoords = (ev) => {
                if (ev.touches && ev.touches.length > 0) {
                    return { x: ev.touches[0].clientX, y: ev.touches[0].clientY };
                }
                if (ev.changedTouches && ev.changedTouches.length > 0) {
                    return { x: ev.changedTouches[0].clientX, y: ev.changedTouches[0].clientY };
                }
                return { x: ev.clientX !== undefined ? ev.clientX : 0, y: ev.clientY !== undefined ? ev.clientY : 0 };
            };

            const onMove = (mv) => {
                const coords = getCoords(mv);
                const rect = goalSvg.getBoundingClientRect();
                if (!rect.width || !rect.height) return;
                const scaleX = 500 / rect.width;
                const scaleY = 500 / rect.height;
                
                const svgX = (coords.x - rect.left) * scaleX;
                const svgY = (coords.y - rect.top) * scaleY;
                
                const vx = svgX - gCenterX;
                const vy = svgY - gCenterY;
                
                const proj = vx * Math.cos(gAngles[i]) + vy * Math.sin(gAngles[i]);
                let newVal = proj / gMaxRad;
                if (newVal < 0.1) newVal = 0.1;
                if (newVal > 1.0) newVal = 1.0;
                
                state.targetShape[i] = newVal;
                if (typeof window !== 'undefined' && window.App && typeof window.App._drawDNARadar === 'function') {
                    window.App._drawDNARadar(containerId, window.App.books || []);
                }
            };

            const onUp = () => {
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);
                window.removeEventListener('touchmove', onMove);
                window.removeEventListener('touchend', onUp);
                try { localStorage.setItem('sl_dna_desired_shape', JSON.stringify(window.App._dnaState.targetShape)); } catch(err) {}
            };

            window.addEventListener('mousemove', onMove, { passive: false });
            window.addEventListener('mouseup', onUp);
            window.addEventListener('pointermove', onMove, { passive: false });
            window.addEventListener('pointerup', onUp);
            window.addEventListener('touchmove', onMove, { passive: false });
            window.addEventListener('touchend', onUp);
        };
        
        hitRect.addEventListener('mousedown', handleDrag);
        hitRect.addEventListener('pointerdown', handleDrag);
        hitRect.addEventListener('touchstart', handleDrag, { passive: false });

        circle.addEventListener('mousedown', handleDrag);
        circle.addEventListener('pointerdown', handleDrag);
        circle.addEventListener('touchstart', handleDrag, { passive: false });
        
        handleGroup.appendChild(hitRect);
        handleGroup.appendChild(circle);
        goalSvg.appendChild(handleGroup);
    });

    // Background Tap/Click handler to shape radar on click
    if (!goalSvg._hasClickListener) {
        goalSvg._hasClickListener = true;
        goalSvg.addEventListener('click', (e) => {
            if (e.target && (e.target.classList.contains('dna-drag-circle') || e.target.classList.contains('dna-drag-hitbox'))) {
                return;
            }
            const esMsg = document.getElementById('esRadarMsg');
            if (esMsg && esMsg.style.display !== 'none') {
                esMsg.style.display = 'none';
            }

            const rect = goalSvg.getBoundingClientRect();
            if (!rect.width || !rect.height) return;
            const scaleX = 500 / rect.width;
            const scaleY = 500 / rect.height;
            
            const clickX = (e.clientX - rect.left) * scaleX;
            const clickY = (e.clientY - rect.top) * scaleY;
            
            const dx = clickX - gCenterX;
            const dy = clickY - gCenterY;
            
            let clickAngle = Math.atan2(dy, dx);
            if (clickAngle < 0) clickAngle += Math.PI * 2;
            
            let closestIdx = 0;
            let minDiff = Infinity;
            
            gAngles.forEach((a, i) => {
                let normalizedA = a < 0 ? a + Math.PI * 2 : a;
                let diff = Math.abs(clickAngle - normalizedA);
                if (diff > Math.PI) diff = Math.PI * 2 - diff;
                
                if (diff < minDiff) {
                    minDiff = diff;
                    closestIdx = i;
                }
            });
            
            const dist = Math.sqrt(dx * dx + dy * dy);
            let val = dist / gMaxRad;
            if (val > 1.0) val = 1.0;
            if (val < 0.1) val = 0.1;
            
            window.App._dnaState.targetShape[closestIdx] = val;
            try { localStorage.setItem('sl_dna_desired_shape', JSON.stringify(window.App._dnaState.targetShape)); } catch(err) {}
            if (typeof window.App._drawDNARadar === 'function') {
                window.App._drawDNARadar(containerId, window.App.books || []);
            }
        });
    }

    // Wrap radar control row and legend cleanly
    const rowEl = goalSvg.closest('.dna-wrapper')?.querySelector('[style*="justify-content: space-between"]') || document.querySelector('#commRadarPane [style*="justify-content: space-between"]');
    if (rowEl) {
        rowEl.style.flexWrap = 'wrap';
        rowEl.style.gap = '12px';
    }
  },

   _subscribeClubRealtime(clubId) {
    this._unsubscribeClubRealtime();
    const sb = _supabase || (typeof window !== 'undefined' && window.supabaseClient) || (DB && DB._supabase);
    if (!sb || !clubId) return;
    App._clubRealtimeChannel = sb
      .channel('club-discussion-' + clubId)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'club_discussion',
        filter: 'club_id=eq.' + clubId
      }, payload => {
        const msg = payload.new;
        if (msg.user_id === App.userId) return; // skip own messages (already shown)
        if (typeof App._appendClubMessage === 'function') {
          App._appendClubMessage(msg, clubId);
        } else if (typeof this._appendClubMessage === 'function') {
          this._appendClubMessage(msg, clubId);
        } else {
          _appendClubMessage(msg, clubId);
        }
      })
      .subscribe();
  },

  _unsubscribeClubRealtime() {
    const sb = _supabase || (typeof window !== 'undefined' && window.supabaseClient) || (DB && DB._supabase);
    if (App._clubRealtimeChannel && sb) {
      try { sb.removeChannel(App._clubRealtimeChannel); } catch(e) { console.warn(e); }
      App._clubRealtimeChannel = null;
    }
  },

  async  openAdminPanel(clubId) {
  const clubs = await DB.getMyClubs(App.userId);
  const club = (clubs||[]).find(c => c.id === clubId);
  if (!club) return;
  const members = await DB.getClubMembers(clubId);
  
  App._modalZIndex = (App._modalZIndex || 2000000000) + 1;
  const modalHTML = `
    <div class="modal-overlay open" id="adminPanelModal" onclick="if(event.target===this) this.remove()" style="z-index:${App._modalZIndex} !important; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.8);">
      <div class="modal-card" style="max-width:500px; width:90%; background:#fff; color:var(--wood-dark); padding:24px; border-radius:12px; position:relative; min-height:60vh; display:flex; flex-direction:column;">
        <button class="modal-close" onclick="document.getElementById('adminPanelModal')?.remove()" style="position:absolute; top:12px; right:12px; background:none; border:none; color:var(--wood-mid); font-size:24px; cursor:pointer;">&times;</button>
        <div style="font-size:18px; font-weight:700; margin-bottom:16px;">⚙️⚙️ Admin Settings</div>
        
        <!-- Tabs -->
        <div style="display:flex; gap:16px; border-bottom:1px solid rgba(61,43,31,0.1); margin-bottom:16px; font-weight:600; font-size:14px; color:var(--wood-mid);">
          <div id="adminTabGeneral" onclick="App.switchAdminTab('general')" style="padding-bottom:8px; cursor:pointer; color:var(--burgundy); border-bottom:2px solid var(--burgundy);">General</div>
            <div id="adminTabPick" onclick="App.switchAdminTab('pick')" style="padding-bottom:8px; cursor:pointer;">Next Pick Settings</div>
          <div id="adminTabPast" onclick="App.switchAdminTab('past')" style="padding-bottom:8px; cursor:pointer;">Past Reads</div>
          <div id="adminTabMembers" onclick="App.switchAdminTab('members')" style="padding-bottom:8px; cursor:pointer;">Manage Members</div>
          <div id="adminTabModeration" onclick="App.switchAdminTab('moderation')" style="padding-bottom:8px; cursor:pointer;">Moderation</div>
        </div>
        
        
          <!-- General Settings Tab -->
          <div id="adminGeneralSection" style="display:flex; flex-direction:column; gap:16px; flex:1; overflow-y:auto; padding-right:8px;">
            <div>
              <div style="font-size:12px; font-weight:700; margin-bottom:4px;">Club Visibility</div>
              <div style="font-size:11px; color:var(--wood-mid); margin-bottom:8px;">Public clubs appear in the "Public Clubs" tab for everyone and can be joined without a code.</div>
              <div style="display:flex; align-items:center; gap:8px;">
                <label style="display:flex; align-items:center; cursor:pointer;">
                  <input type="checkbox" id="adminPublicToggle" ${(club.invite_code || '').startsWith('PUBLIC_') ? 'checked' : ''} onchange="App.toggleClubVisibility('${clubId}', this.checked)" style="width:16px; height:16px; cursor:pointer;">
                  <span style="font-size:13px; font-weight:600; margin-left:8px; color:var(--wood-dark);">Public (Discoverable)</span>
                </label>
              </div>
            </div>
            
            <div>
              <div style="font-size:12px; font-weight:700; margin-bottom:4px;">Club Thumbnail URL</div>
              <div style="font-size:11px; color:var(--wood-mid); margin-bottom:8px;">Paste a direct link to an image (e.g. from Imgur) to display as the club's cover.</div>
              <input type="text" id="adminThumbInput" value="${(club.description || '').match(/\[thumb:(.*?)\]/) ? (club.description || '').match(/\[thumb:(.*?)\]/)[1] : ''}" placeholder="https://..." style="width:100%; padding:8px; border:1px solid rgba(61,43,31,0.2); border-radius:6px; margin-bottom:8px; box-sizing:border-box;">
              <button onclick="App.saveClubThumbnail('${clubId}', document.getElementById('adminThumbInput').value)" style="padding:8px 16px; background:var(--burgundy); color:#fff; border:none; border-radius:6px; font-weight:600; cursor:pointer;">Save Thumbnail</button>
            </div>
            
            <div>
              <div style="font-size:12px; font-weight:700; margin-bottom:4px;">Description</div>
              <textarea id="adminDescInput" rows="3" style="width:100%; padding:8px; border:1px solid rgba(61,43,31,0.2); border-radius:6px; margin-bottom:8px; box-sizing:border-box;">${(club.description || '').replace(/\[thumb:.*?\]/g, '').trim()}</textarea>
              <button onclick="App.saveClubDescription('${clubId}', document.getElementById('adminDescInput').value)" style="padding:8px 16px; background:var(--wood-dark); color:#fff; border:none; border-radius:6px; font-weight:600; cursor:pointer;">Save Description</button>
            </div>
          </div>

          <!-- Pick Settings Tab -->
        <div id="adminPickSection" style="display:none; flex:1; overflow-y:auto; padding-right:8px;">
          <div style="font-size:12px; font-weight:700; margin-bottom:4px;">Set Start Date for Next Pick</div>
          <input type="date" id="adminPickStartDate" value="${App._clubStartDates[clubId] || ''}" onchange="App._clubStartDates['${clubId}'] = this.value; App.openClub('${clubId}')" style="width:100%; padding:8px; border:1px solid rgba(61,43,31,0.2); border-radius:6px; margin-bottom:16px; box-sizing:border-box;">
          
          <div style="font-size:12px; font-weight:700; margin-bottom:4px;">Directly Set Current Pick</div>
          <button onclick="document.getElementById('adminPanelModal')?.remove(); App.openClubPickModal()" style="padding:8px 16px; background:var(--burgundy); color:#fff; border:none; border-radius:6px; font-weight:600; cursor:pointer; margin-bottom:16px;">Open Pick Modal</button>
          
          <div style="font-size:12px; font-weight:700; margin-bottom:4px;">Populate Voting Candidates</div>
          <div style="font-size:10px; color:var(--wood-mid); margin-bottom:8px;">(Search titles below to replace the random 3 books in the Next Pick pool)</div>
          <div style="position:relative; width:100%;">
             <input id="adminCandidateInput" placeholder="Type a book title to search..." oninput="App.debounceAdminSearch(this.value, '${clubId}')" autocomplete="off" style="width:100%; padding:8px; border:1px solid rgba(61,43,31,0.2); border-radius:6px; box-sizing:border-box;">
          </div>
          <div id="adminCandidateSearchResults" class="global-search-results" style="max-height:200px;overflow-y:auto;margin-top:4px;display:none;background:#fff;border:1px solid rgba(61,43,31,0.1);border-radius:6px;z-index:100;"></div>
          <div id="adminCandidateList" style="margin-top:8px; display:flex; flex-direction:column; gap:8px;">
             ${(App._clubVotingCandidates[clubId] || []).map((b, idx) => {
                const titleHash = (b.title || '').split('').reduce((a,c)=>a+c.charCodeAt(0),0);
                const mockVotes = Math.max(0, (titleHash % 15) - idx * 2);
                const totalMockVotes = 25;
                const votePct = Math.round((mockVotes / totalMockVotes) * 100);
                return `<div style="display:flex; flex-direction:column; padding:8px; background:rgba(61,43,31,0.03); border: 1px solid rgba(61,43,31,0.1); border-radius:6px; font-size:12px; gap:8px;">
                   <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                     <div style="display:flex; align-items:center; gap:8px; min-width:0;">
                       ${b.coverUrl || b.cover_url ? '<img src="' + (b.coverUrl || b.cover_url) + '" style="width:24px; height:36px; object-fit:cover; border-radius:3px; flex-shrink:0;">' : '<div style="width:24px; height:36px; background:rgba(0,0,0,0.1); border-radius:3px; flex-shrink:0;"></div>'}
                       <div style="display:flex; flex-direction:column; min-width:0;">
                         <span style="font-weight:700; color:var(--wood-dark); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${b.title}</span>
                         <span style="font-size:10px; color:var(--wood-mid); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${b.author || 'Unknown Author'}</span>
                       </div>
                     </div>
                     <div style="display:flex; gap:6px; align-items:center; flex-shrink:0;">
                        <button onclick="App.adminPromoteCandidate('${clubId}', ${idx})" style="background:var(--wood-dark); color:#fff; border:none; padding:4px 8px; border-radius:4px; font-weight:600; font-size:11px; cursor:pointer;" title="Promote to Next Read">Promote</button>
                        <button onclick="App.adminRemoveCandidate('${clubId}', ${idx})" style="color:var(--burgundy); background:rgba(139,38,53,0.1); border:none; border-radius:4px; padding:4px 8px; cursor:pointer; font-weight:bold; font-size:12px;" title="Remove">&times;</button>
                     </div>
                   </div>
                   <div style="display:flex; align-items:center; gap:8px; width:100%;">
                      <div style="flex:1; height:6px; background:rgba(61,43,31,0.1); border-radius:3px; overflow:hidden;">
                         <div style="height:100%; width:${votePct}%; background:var(--gold); border-radius:3px;"></div>
                      </div>
                      <div style="font-size:10px; font-weight:700; color:var(--wood-dark);">${mockVotes} votes</div>
                   </div>
                </div>`;
             }).join('')}
          </div>
          
          <div style="margin-top: 24px; border-top: 1px dashed rgba(61,43,31,0.2); padding-top: 16px;">
             <div style="font-size:12px; font-weight:700; margin-bottom:4px;">Member Suggestions</div>
             <div style="font-size:11px; color:var(--wood-mid); margin-bottom:8px;">Books suggested by club members in the discussion view.</div>
             <div id="adminSuggestionsList" style="display:flex; flex-direction:column; gap:4px;">
               ${(!App._clubSuggestions || !App._clubSuggestions[clubId] || App._clubSuggestions[clubId].length === 0) ? `
                  <div style="font-size:11px; color:var(--wood-light); padding:12px; text-align:center; background:rgba(61,43,31,0.02); border-radius:6px;">No suggestions right now.</div>
               ` : App._clubSuggestions[clubId].map((s, idx) => `
                  <div style="display:flex; justify-content:space-between; padding:6px 8px; background:rgba(61,43,31,0.05); border-radius:4px; font-size:12px; align-items:center; gap:8px;">
                     <div style="display:flex; flex-direction:column; min-width:0; flex:1;">
                       <span style="font-weight:700; color:var(--wood-dark); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${s.title}</span>
                     </div>
                     <div style="display:flex; gap:4px; flex-shrink:0;">
                        <button onclick="App.adminApproveSuggestion('${clubId}', ${idx})" style="background:var(--gold); color:#fff; border:none; padding:4px 8px; border-radius:4px; font-weight:600; font-size:10px; cursor:pointer;" title="Add to Voting Candidates">Approve</button>
                        <button onclick="App.adminRejectSuggestion('${clubId}', ${idx})" style="color:var(--burgundy); background:rgba(139,38,53,0.1); border:none; border-radius:4px; padding:4px 8px; cursor:pointer; font-weight:bold; font-size:10px;" title="Reject">Reject</button>
                     </div>
                  </div>
               `).join('')}
             </div>
          </div>
        
        <!-- Past Reads Tab -->
        <div id="adminPastSection" style="display:none; flex-direction:column; gap:8px; flex:1; overflow-y:auto; padding-right:8px;">
          <div style="font-size:12px; font-weight:700; margin-bottom:4px;">Add a Past Read</div>
          <div style="position:relative; width:100%;">
            <input id="adminPastInput" placeholder="Search book title..." oninput="App.debounceAdminPastSearch(this.value, '${clubId}')" autocomplete="off" style="width:100%; padding:8px; border:1px solid rgba(61,43,31,0.2); border-radius:6px; box-sizing:border-box;">
          </div>
          <div id="adminPastSearchResults" class="global-search-results" style="max-height:200px;overflow-y:auto;margin-top:4px;display:none;background:#fff;border:1px solid rgba(61,43,31,0.1);border-radius:6px;z-index:100;"></div>
          <div style="font-size:12px; font-weight:700; margin-top:16px; margin-bottom:4px;">Current Past Reads</div>
          <div id="adminPastList" style="display:flex; flex-direction:column; gap:4px;">
            ${(club.past_reads || []).map((b, idx) => `
              <div style="display:flex; flex-direction:column; padding:6px 8px; background:rgba(61,43,31,0.05); border-radius:4px; font-size:12px; gap:6px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-weight:600; color:var(--wood-dark); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-right:8px;">${b.title}</span>
                  <div style="display:flex; gap:4px; flex-shrink:0;">
                    ${idx > 0 ? `<button onclick="App.moveClubPastRead('${clubId}', ${idx}, -1)" style="background:transparent; border:1px solid rgba(61,43,31,0.2); padding:2px 6px; border-radius:4px; cursor:pointer;" title="Move Up">&#8593;</button>` : ''}
                    ${idx < (club.past_reads||[]).length - 1 ? `<button onclick="App.moveClubPastRead('${clubId}', ${idx}, 1)" style="background:transparent; border:1px solid rgba(61,43,31,0.2); padding:2px 6px; border-radius:4px; cursor:pointer;" title="Move Down">&#8595;</button>` : ''}
                    <button onclick="App.removeClubPastRead('${clubId}', ${idx})" style="background:transparent; color:var(--dislike); border:1px solid var(--dislike); padding:2px 6px; border-radius:4px; cursor:pointer;">Remove</button>
                  </div>
                </div>
                <input type="text" placeholder="Date or Month (optional)" value="${b.date || ''}" onchange="App.updateClubPastReadDate('${clubId}', ${idx}, this.value)" style="padding:4px 6px; font-size:11px; border:1px solid rgba(61,43,31,0.2); border-radius:4px; width:100%; box-sizing:border-box;">
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Members Tab -->
        <div id="adminMembersSection" style="display:none; flex-direction:column; gap:8px; flex:1; overflow-y:auto; padding-right:8px;">
          ${members.map(m => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:rgba(61,43,31,0.03); border-radius:8px; border:1px solid rgba(61,43,31,0.05);">
              <div style="font-size:14px; font-weight:600;">${(m.user_profiles && m.user_profiles.display_name) || 'Reader'} ${m.role==='admin'?'<span style="color:var(--burgundy);font-size:10px;margin-left:4px;">(Admin)</span>':''}</div>
              ${m.role !== 'admin' ? `
                <div style="display:flex; gap:6px;">
                  <button onclick="App.makeAdmin('${clubId}', '${m.user_id}', this)" style="background:transparent; color:var(--burgundy); border:1px solid var(--burgundy); padding:4px 8px; border-radius:6px; cursor:pointer; font-size:11px; font-weight:600;">Make Admin</button>
                  <button onclick="App.removeMember('${clubId}', '${m.user_id}', this)" style="background:transparent; color:var(--wood-dark); border:1px solid rgba(61,43,31,0.2); padding:4px 8px; border-radius:6px; cursor:pointer; font-size:11px; font-weight:600;">Remove</button>
                  <button onclick="App.banMember('${clubId}', '${m.user_id}', this)" style="background:var(--burgundy); color:#fff; border:none; padding:4px 8px; border-radius:6px; cursor:pointer; font-size:11px; font-weight:600;">Ban</button>
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
        <!-- Moderation Tab -->
        <div id="adminModerationSection" style="display:none; flex-direction:column; gap:16px; padding-top:8px; flex:1; overflow-y:auto; padding-right:8px;">
           <div style="font-size:13px; color:var(--wood-mid); line-height:1.5;">As a club admin, you can delete individual messages from the chat view by clicking the red '🗑️' next to a message.</div>
           <div style="font-size:12px; font-weight:700; margin-bottom:4px; margin-top:8px; color:#ff4444;">Danger Zone</div>
           <div style="display:flex; justify-content:space-between; align-items:center; padding:16px; background:rgba(255,68,68,0.05); border-radius:8px; border:1px solid rgba(255,68,68,0.2);">
              <div style="font-size:13px; font-weight:600; color:var(--wood-dark);">Wipe Entire Chat History</div>
              <button onclick="App.wipeClubChat('${clubId}')" style="background:#ff4444; color:#fff; border:none; padding:8px 16px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:700; flex-shrink:0;">Wipe Chat</button>
           </div>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);
},


  async renderCommunityFeed() {
    const el = document.getElementById('communityFeed');
    if (!el) return;
    
    el.innerHTML = '<div class="feed-item">  <div class="skeleton-pulse" style="width:36px;height:36px;border-radius:50%;flex-shrink:0;"></div>  <div class="feed-body">    <div class="skeleton-pulse" style="height:14px;width:80%;border-radius:4px;margin-bottom:6px;"></div>    <div class="skeleton-pulse" style="height:10px;width:40%;border-radius:4px;margin-bottom:12px;"></div>    <div style="display:flex;gap:8px;">      <div class="skeleton-pulse" style="width:36px;height:22px;border-radius:11px;"></div>      <div class="skeleton-pulse" style="width:36px;height:22px;border-radius:11px;"></div>    </div>  </div>  <div style="display:flex;flex-direction:column;gap:6px;margin-left:8px;">    <div class="skeleton-pulse" style="width:60px;height:22px;border-radius:12px;"></div>    <div class="skeleton-pulse" style="width:60px;height:22px;border-radius:12px;"></div>  </div></div>';

    try {
      if (typeof App.recordMilestones === 'function') await App.recordMilestones();
    } catch (e) {
      console.warn('[community] recordMilestones:', e);
    }

    try {
      if (!App.userId) {
        el.innerHTML = '<div style="padding:24px 4px;text-align:center;color:var(--wood-light);font-size:12.5px;line-height:1.6;">Sign in to view your community feed and connect with other readers.</div>';
        return;
      }
      
      let feed = [];
      if (window.DB && typeof window.DB.getSocialFeed === 'function') {
        feed = await window.DB.getSocialFeed({ limit: 50, fromUserIds: [...(App.following || [])] });
      }
      feed = (feed || []).filter(item => item.user_id !== App.userId);

      if (feed && feed.length && App._cacheFeedReactions) {
        try {
          const aids = feed.map(a => a.id).filter(Boolean);
          if (window.DB && typeof window.DB.getReactionCounts === 'function') {
            const reactions = await window.DB.getReactionCounts(aids);
            App._cacheFeedReactions(reactions, App.userId);
          }
        } catch(e) { console.warn('reaction fetch:', e); }
      }

      if (!feed || !feed.length) {
        el.innerHTML = '<div style="padding:24px 4px;text-align:center;color:var(--wood-light);font-size:12.5px;line-height:1.6;">No community milestones yet. As readers crown Books of the Year and hit reading milestones, their highlights will appear here.</div>';
      } else {
        const _seen = new Set(); 
        const _df = (feed||[]).filter(a => {
          const k = (a.user_id || '') + '|' + (a.type || '');
          if (_seen.has(k)) return false;
          _seen.add(k);
          return true;
        });
        el.innerHTML = _df.map(a => this._feedItemHTML(a)).join('');
      }

      const others = (feed || []).filter(a => a.user_id !== App.userId);
      if (typeof App.markCommunityNotificationsSeen === 'function') {
        App.markCommunityNotificationsSeen(others.length ? others[0] : null);
      } else {
        const dot = document.getElementById('communityBellDot');
        if (dot) dot.style.display = 'none';
        const now = Date.now();
        const prev = parseInt(localStorage.getItem('sl_community_lastseen') || '0', 10) || 0;
        const feedTime = others.length ? new Date(others[0].created_at).getTime() : 0;
        const maxSeen = Math.max(now, prev, isNaN(feedTime) ? 0 : feedTime, App._newestFeedTime || 0);
        localStorage.setItem('sl_community_lastseen', String(maxSeen));
        const seenId = (others.length && others[0].id) || App._newestFeedId;
        if (seenId) localStorage.setItem('sl_community_lastseen_id', String(seenId));
      }

    } catch (e) {
      console.warn('[community] feed failed:', e);
      el.innerHTML = '<div style="padding:24px 4px;text-align:center;color:var(--wood-light);font-size:12.5px;">Could not load the community feed right now.</div>';
    }
  },

  _feedItemHTML(a) {
    const bg = typeof App._avatarBg === 'function' ? App._avatarBg(a._avatar || '📚') : '#333';
    const isMe = a.user_id === App.userId;
    const following = typeof App.isFollowing === 'function' ? App.isFollowing(a.user_id) : false;
    
    const followBtn = isMe ? '' : `<button class="feed-follow-btn${following ? ' following' : ''}" data-uid="${a.user_id}" onclick="App.toggleFollow('${a.user_id}', this)">${following ? '✓ Following' : '+ Follow'}</button>`;
    
    let noteBtn = '';
    if (!isMe && a.data && a.data.title) {
      let bookId = a.id;
      if (a.type === 'started_book' || a.type === 'finished_book') bookId = a.id.split('_')[1];
      else if (a.data.key) bookId = a.data.key.split('_')[1] || a.id;
      
      const safeTitle = this._escapeHtml(a.data.title || '').replace(/'/g, "\\'");
      const safeAuthor = this._escapeHtml(a.data.author || '').replace(/'/g, "\\'");
      const safeCover = (a.data.cover || '').replace(/'/g, "\\'");
      
      noteBtn = `<button class="feed-follow-btn" style="margin-left:6px;" onclick="App.openSendNote({id:'${bookId}', title:'${safeTitle}', author:'${safeAuthor}', cover:'${safeCover}'}, '${a.user_id}')">✉️ Note</button>`;
    }
    
    return `<div class="feed-item">
      <div class="feed-avatar" style="background:${bg};" onclick="App.openProfileView('${a.user_id}')">${this._escapeHtml(a._avatar || '📚')}</div>
      <div class="feed-body">
        <div class="feed-text">${this._achievementText(a)}</div>
        <div class="feed-time">${typeof this._relTime === 'function' ? this._relTime(a.created_at) : (typeof App._relTime === 'function' ? App._relTime(a.created_at) : '')}</div>
        ${App._feedItemReactionBar ? App._feedItemReactionBar(a.id) : ''}
      </div>
      <div style="display:flex; flex-direction:column; gap:6px;">
        ${followBtn}
        ${noteBtn}
      </div>
    </div>`;
  },

  _achievementText(a) {

 const name = `<span class="feed-name" onclick="App.openProfileView('${a.user_id}')">${this._escapeHtml(a._name || 'A reader')}</span>`;

 const d = a.data || {};

 const t = d.title ? `<em>${this._escapeHtml(d.title)}</em>` : '';

 switch (a.type) {

 case 'book_of_year': return `${name} crowned ${t || 'a book'} as Book of the Year ${d.year ? '('+this._escapeHtml(String(d.year))+') ' : ''}👑`;

 case 'started_book': return `${name} started reading ${t} 📖`;

 case 'finished_book': return `${name} finished ${t} ${d.sentiment === 'love' ? 'and loved it ❤️' : d.sentiment === 'like' ? 'and liked it 👍' : 'and thought it was okay 🤷‍♂️'}`;

 case 'milestone_books': return `${name} reached <strong>${this._escapeHtml(String(d.count || ''))} books</strong> read 📚`;

 case 'speed_record': return `${name} sped through ${t || 'a book'} in <strong>${this._escapeHtml(String(d.days || ''))} day${d.days === 1 ? '' : 's'}</strong> ⚡`;

 case 'goal_reached': return `${name} hit their ${this._escapeHtml(String(d.year || ''))} reading goal of <strong>${this._escapeHtml(String(d.goal || ''))} books</strong> 🎯`;

 case 'badge': return `${name} earned the <strong>${this._escapeHtml(String(d.badge || 'reader'))}</strong> badge 🎖️`;

      default: { var _adef = (typeof ACHIEVEMENTS !== 'undefined') && ACHIEVEMENTS[a.type]; if (_adef) return name + ' earned the <strong>' + _adef.name + '</strong> achievement'; return name + ' reached a new milestone'; }

 }

 },

  _relTime(ts) {

 if (!ts) return '';

 const then = new Date(ts).getTime();

 if (isNaN(then)) return '';

 const s = Math.max(0, Math.floor((Date.now() - then) / 1000));

 if (s < 60) return 'just now';

 const m = Math.floor(s / 60); if (m < 60) return m + 'm ago';

 const h = Math.floor(m / 60); if (h < 24) return h + 'h ago';

 const d = Math.floor(h / 24); if (d < 7) return d + 'd ago';

 const w = Math.floor(d / 7); if (w < 5) return w + 'w ago';

 const mo = Math.floor(d / 30); if (mo < 12) return mo + 'mo ago';

 return Math.floor(d / 365) + 'y ago';

 },

  async renderSimilarReaders(BOOKS) {

 const tile = document.getElementById('similarReadersTile');

 const el = document.getElementById('similarReaders');

 if (!tile || !el) return;

 // Only for logged-in, non-readonly, public users with enough data.

    if (this.isReadOnly || !this.userId || !BOOKS) {
     this.initDiscoverVisuals([]);
     tile.style.display = 'none'; el.innerHTML = ''; return;
 }

 // Avoid recomputing repeatedly within a short window.

 try {

 const profiles = await DB.getPublicProfiles(this.userId);

 

 const mySig = this._readerSignature(BOOKS);

 const matches = [];

 // Limit fan-out to a reasonable number of readers.

 const ignored = JSON.parse(localStorage.getItem('sl_ignored_readers') || '[]');
 const candidates = profiles.filter(p => !ignored.includes(p.user_id)).sort(() => 0.5 - Math.random()).slice(0, 40);




 for (const p of candidates) {

 let theirBooks = [];

 try { theirBooks = await DB.getPublicUserBooks(p.user_id); } catch (e) { theirBooks = []; }


 if (!theirBooks || theirBooks.length < 3) continue;

 const sig = this._readerSignature(theirBooks);

 const sim = this._similarity(mySig, sig);

 const myLibrary = (typeof BOOKS !== 'undefined') ? BOOKS : Object.values(window._BOOKS || {});
 const exactMatches = theirBooks.filter(tb => myLibrary.some(mb => mb.title && tb.title && mb.title.toLowerCase() === tb.title.toLowerCase()));
 sim.exactMatches = exactMatches;

 if (sim.score <= 0 && !sim.genres.length && !sim.authors.length && !sim.moods.length) continue;

 const _rm = { name: normalizeDisplayName(p.display_name || 'A reader', null), avatar: (typeof App !== "undefined" && App._getUserAvatar ? App._getUserAvatar(p) : (p.avatar_emoji || '👤')), userId: p.user_id, score: sim.score, count: theirBooks.length, shared: sim, topBook: theirBooks[0] };

 matches.push(_rm);

 if (!this._readerProfiles) this._readerProfiles = {};

 this._readerProfiles[p.user_id] = _rm;

 }

 matches.sort((a, b) => b.score - a.score);

 let top = matches.slice(0, 5);

 if (!top.length) {
     this.initDiscoverVisuals([]);
     tile.style.display = '';
     el.innerHTML = '<div style="padding:14px 4px;font-size:12.5px;color:var(--wood-light);line-height:1.6;">No similar readers found yet. As more readers make their shelves public, you\'ll discover kindred bookworms here based on shared genres, authors &amp; moods.</div>';
     return;
 }

 tile.style.display = '';

 const titleCase = s => s.replace(/\b\w/g, c => c.toUpperCase());

 let htmlContent = '<div style="display:flex;flex-direction:column;gap:12px;padding:6px 2px;">' + top.map(m => {

 const chips = [];

 m.shared.genres.slice(0, 3).forEach(g => chips.push(`<span style="display:inline-block;padding:2px 8px;border-radius:10px;background:rgba(139,99,67,0.12);color:var(--wood-dark);font-size:10px;margin:2px 3px 0 0;">${this._escapeHtml(titleCase(g))}</span>`));

 m.shared.authors.slice(0, 2).forEach(a => chips.push(`<span style="display:inline-block;padding:2px 8px;border-radius:10px;background:rgba(61,43,31,0.10);color:var(--wood-dark);font-size:10px;margin:2px 3px 0 0;">✍ ${this._escapeHtml(titleCase(a))}</span>`));

 m.shared.moods.slice(0, 3).forEach(mo => chips.push(`<span style="display:inline-block;padding:2px 8px;border-radius:10px;background:rgba(120,90,150,0.12);color:#6b4d8a;font-size:10px;margin:2px 3px 0 0;">${this._escapeHtml(titleCase(mo))}</span>`));

 const sharedText = chips.length ? `<div style="margin-top:6px;">${chips.join('')}</div>` : '<div style="margin-top:6px;font-size:10.5px;color:var(--wood-light);">Shared reading vibe</div>';

 const avatarBg = this._avatarBg(m.avatar || '📚');

 return `<div role="button" tabindex="0" style="display:flex;align-items:flex-start;gap:12px;padding:10px 12px;background:rgba(61,43,31,0.03);border-radius:8px;border:1px solid rgba(61,43,31,0.06);cursor:pointer;" onclick="App.openReaderProfileById('${m.userId}')">

 <div style="width:38px;height:38px;flex-shrink:0;border-radius:50%;background:${avatarBg};display:flex;align-items:center;justify-content:center;font-size:19px;box-shadow:0 2px 6px rgba(61,43,31,0.18);">${this._escapeHtml(m.avatar || '📚')}</div>

 <div style="flex:1;min-width:0;">

 <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">

 <div style="font-size:13px;font-weight:600;color:var(--wood-dark);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${this._escapeHtml(m.name)}</div>

 <div style="flex-shrink:0;display:flex;align-items:center;gap:4px;">
 <div style="font-family:\'DM Mono\',monospace;font-size:12px;color:var(--wood-mid);font-weight:600;">${m.score}% match</div>
 <button class="discover-ignore-btn" onclick="event.stopPropagation(); App.ignoreReader('${m.userId}')" title="Hide this reader">&times;</button>
 </div>

 </div>

 <div style="font-size:10px;color:var(--wood-light);margin-top:1px;">${m.count} books on their shelf</div>

 ${sharedText}

 </div>

 </div>`;

 }).join('') + '</div>';
 
 el.innerHTML = htmlContent;
 this.initDiscoverVisuals(matches.slice(0, 75));

 } catch (e) {
     this.initDiscoverVisuals([]);
     console.warn('[similarReaders] failed:', e);
     tile.style.display = 'none'; el.innerHTML = '';
 }

 },

  _discoverVisualsState: {
    constNodes: [],
    constLines: [],
    constMatches: [],
    activeZoomNode: null,
    isGalaxyHovered: false,
    particleInterval: null,
    vennCircles: [],
    activeVennIntersection: null,
    animationFrameId: null
 },

  resetGalaxyZoom(e) {
    if (e) e.stopPropagation();
    const state = this._discoverVisualsState;
    state.activeZoomNode = null;
    clearInterval(state.particleInterval);    const constWorld = document.getElementById('constWorld');
    constWorld.classList.remove('const-world-zoomed');    if (window.galaxyPanZoom) {
        if (window._galaxyZoomAnim) cancelAnimationFrame(window._galaxyZoomAnim);
        if (window._galaxyZoomAnim) clearTimeout(window._galaxyZoomAnim); // catch both
        
        constWorld.style.transition = '';
        const targetScale = window.innerWidth <= 768 ? 0.35 : 0.75;
        const targetX = 0;
        const targetY = 0;
        
        const startT = window.galaxyPanZoom.getTransform();
        const startX = startT.x;
        const startY = startT.y;
        const startScale = startT.scale;
        
        const startTime = performance.now();
        function animateZoomOut(time) {
            let elapsed = time - startTime;
            let t = Math.max(0, Math.min(1, elapsed / 600));
            const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
            
            const curX = startX + (targetX - startX) * ease;
            const curY = startY + (targetY - startY) * ease;
            const curScale = startScale + (targetScale - startScale) * ease;
            
            window.galaxyPanZoom.zoomAbs(0, 0, curScale);
            window.galaxyPanZoom.moveTo(curX, curY);
            
            if (t < 1) {
                window._galaxyZoomAnim = requestAnimationFrame(animateZoomOut);
            }
        }
        window._galaxyZoomAnim = requestAnimationFrame(animateZoomOut);
    } else {
        const targetScale = window.innerWidth <= 768 ? 0.35 : 0.75;
        constWorld.style.transform = 'translate(0px, 0px) scale(' + targetScale + ')';
    }
    document.querySelectorAll('.const-node-match').forEach(n => n.classList.remove('active-zoom'));
    document.querySelectorAll('.const-link').forEach(l => l.classList.remove('active-link'));
    document.getElementById('detailPanel').classList.remove('visible');
    
    state.constMatches.forEach((m, i) => {
        state.constLines[i].setAttribute('stroke', m.color);
        const minScore = Math.min(...state.constMatches.map(r => r.score));
        const maxScore = Math.max(...state.constMatches.map(r => r.score));
        let normalized = maxScore === minScore ? 0.5 : (m.score - minScore) / (maxScore - minScore);
        state.constLines[i].setAttribute('stroke-opacity', Math.max(0.15, normalized));
        state.constLines[i].setAttribute('stroke-width', '1');
        if (state.constNodes[i]) state.constNodes[i].style.boxShadow = 'none';
    });
 },

  _spawnGalaxyParticle(m, lineEl) {
    const state = this._discoverVisualsState;
    const constWrapper = document.getElementById('constWrapper');
    const svgLines = document.getElementById('constLines');
    
    const centerX = constWrapper.clientWidth / 2;
    const centerY = constWrapper.clientHeight / 2;
    
    const rad = m.angle;
    const targetX = centerX + m.radius * Math.cos(rad);
    const targetY = centerY + m.radius * Math.sin(rad);

    const p = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    const size = Math.random() * 3.5 + 1.5;
    p.setAttribute('r', size);
    p.setAttribute('fill', '#d4af37');
    p.style.filter = `drop-shadow(0 0 4px #d4af37)`;
    svgLines.appendChild(p);
    
    const duration = Math.random() * 1500 + 1000;
    const startTime = performance.now();
    
    function animateParticle(time) {
        const elapsed = time - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const currRad = m.angle;
        const currTargetX = centerX + m.radius * Math.cos(currRad);
        const currTargetY = centerY + m.radius * Math.sin(currRad);
        
        const currX = centerX + (currTargetX - centerX) * progress;
        const currY = centerY + (currTargetY - centerY) * progress;
        
        p.setAttribute('cx', currX);
        p.setAttribute('cy', currY);
        p.setAttribute('opacity', 1 - progress);
        
        if (progress < 1) {
            requestAnimationFrame(animateParticle);
        } else {
            p.remove();
        }
    }
    requestAnimationFrame(animateParticle);
 },

  _animateGalaxy() {
    const state = this._discoverVisualsState;
    const constWrapper = document.getElementById('constWrapper');
    if (!constWrapper) return; // Unmounted

    const centerX = constWrapper.clientWidth / 2;
    const centerY = constWrapper.clientHeight / 2;
    
    const centerNode = document.getElementById('centerNode');
    if (centerNode) {
        centerNode.style.left = centerX + 'px';
        centerNode.style.top = centerY + 'px';
    }

    state.constMatches.forEach((m, i) => {
        if (!m.isHovered || state.activeZoomNode) {
            if (state.activeZoomNode !== m) {
                m.angle += m.speed; 
            }
        }
        
        const rad = m.angle;
        const x = centerX + m.radius * Math.cos(rad);
        const y = centerY + m.radius * Math.sin(rad);

        if (state.constNodes[i]) {
            state.constNodes[i].style.left = x + 'px';
            state.constNodes[i].style.top = y + 'px';
        }

        if (state.constLines[i]) {
            state.constLines[i].setAttribute('x1', centerX);
            state.constLines[i].setAttribute('y1', centerY);
            state.constLines[i].setAttribute('x2', x);
            state.constLines[i].setAttribute('y2', y);
        }
        
        if (state.activeZoomNode === m) {
            const constWorld = document.getElementById('constWorld');
            const detailPanel = document.getElementById('detailPanel');            // Keep panel positioning dynamic
            const offsetX = centerX - x; 
            const offsetY = centerY - y;
            // REMOVED rogue transform that was overriding the cinematic zoom animation
            
            // Dynamically position the detail panel opposite to where the node was
            if (offsetX < 0) { // Node was on the right
                detailPanel.style.right = 'auto';
                detailPanel.style.left = '20px';
            } else { // Node was on the left
                detailPanel.style.left = 'auto';
                detailPanel.style.right = '20px';
            }
            if (offsetY < 0) { // Node was on the bottom
                detailPanel.style.bottom = 'auto';
                detailPanel.style.top = '20px';
            } else { // Node was on the top
                detailPanel.style.top = 'auto';
                detailPanel.style.bottom = '20px';
            }
        }
    });

    state.animationFrameId = requestAnimationFrame(() => this._animateGalaxy());
 },

  initDiscoverVisuals(topReaders) { try {

    const state = this._discoverVisualsState;
    if (state.animationFrameId) cancelAnimationFrame(state.animationFrameId);

    const esGalaxyMsg = document.getElementById('esGalaxyMsg');
    if (esGalaxyMsg) {
        esGalaxyMsg.style.display = 'flex';
    }
    const constWorld = document.getElementById('constWorld');
    if (esGalaxyMsg) { esGalaxyMsg.style.display = 'none'; } if (constWorld) { constWorld.style.display = 'block'; constWorld.style.opacity = '1'; if (typeof panzoom === 'function') { if (window.galaxyPanZoom) { window.galaxyPanZoom.dispose(); } window.galaxyPanZoom = panzoom(constWorld, { maxZoom: 2, minZoom: 0.15, initialZoom: window.innerWidth <= 768 ? 0.35 : 0.75, autocenter: true, bounds: true, boundsPadding: 0.1 }); } else { constWorld.style.transform = 'translate(0px, 0px) scale(' + (window.innerWidth <= 768 ? 0.35 : 0.75) + ')'; } }
    
    const svgLines = document.getElementById('constLines');
    const constWrapper = document.getElementById('constWrapper');
    
    // Cleanup old galaxy nodes
    document.querySelectorAll('.const-node-match').forEach(e => e.remove());
    document.querySelectorAll('.const-link').forEach(e => e.remove());
    
    state.constNodes = [];
    state.constLines = [];
    state.constMatches = [];
    
    const titleCase = s => s.replace(/\w/g, c => c.toUpperCase());
    
    // Init Galaxy
    
    const colors = ['#8b2635', '#3d2b1f', '#2c3e50', '#4a235a', '#2e5a2c', '#8b6343', '#1a252f', '#4b5320', '#5a232c', '#1f3d3d'];
    
    // Set Center Node (You)
    const meNode = document.getElementById('centerNode');
    if (meNode) {
        meNode.style.width = '70px';
        meNode.style.height = '70px';
        meNode.style.borderRadius = '50%';
        meNode.style.boxShadow = '0 4px 10px rgba(0,0,0,0.3)';
        meNode.style.backgroundColor = 'transparent';
        meNode.style.backgroundImage = 'none';
        meNode.innerHTML = '';
        const myName = (typeof App !== 'undefined' && App.displayName) ? App.displayName : (localStorage.getItem('sl_display_name') || 'You');
        const myAv = (typeof App !== 'undefined' && App._avatarEmoji) ? App._avatarEmoji : (localStorage.getItem('sl_avatar_emoji') || '📚');
        const myBg = (typeof App !== 'undefined' && App._avatarBg) ? App._avatarBg(myAv) : 'var(--paper)';
        
        const avDiv = document.createElement('div');
        avDiv.style.width = '100%';
        avDiv.style.height = '100%';
        avDiv.style.borderRadius = '50%';
        avDiv.style.background = myBg;
        avDiv.style.display = 'flex';
        avDiv.style.alignItems = 'center';
        avDiv.style.justifyContent = 'center';
        avDiv.style.fontSize = '30px';
        avDiv.style.boxShadow = 'inset 0 0 0 2px var(--card-border)';
        
        if (myAv.includes('http')) {
            avDiv.style.backgroundImage = `url('${myAv}')`;
            avDiv.style.backgroundSize = 'cover';
            avDiv.style.backgroundPosition = 'center';
        } else {
            avDiv.innerText = myAv;
        }
        meNode.appendChild(avDiv);

        const nameDiv = document.createElement('div');
        nameDiv.innerText = myName;
        nameDiv.style.position = 'absolute';
        nameDiv.style.top = '100%';
        nameDiv.style.marginTop = '2px';
        nameDiv.style.fontSize = '12px';
        nameDiv.style.fontWeight = 'bold';
        nameDiv.style.color = 'var(--wood-dark)';
        nameDiv.style.whiteSpace = 'nowrap';
        nameDiv.style.background = 'rgba(255,255,255,0.6)';
        nameDiv.style.padding = '1px 5px';
        nameDiv.style.borderRadius = '4px';
        meNode.appendChild(nameDiv);
    }

    topReaders.slice(0, 75).forEach((m, i) => {
        // Strict normalization against fixed rings: 70%=75px, 50%=150px, 30%=225px, 10%=300px
        let radius = 75 + (70 - m.score) * 3.75;
        // Clamp radius to keep them on screen (min 30px, max 350px)
        radius = Math.max(30, Math.min(350, radius));
        
        // We still need a normalized value for opacity/size (1 = closest/best score, 0 = farthest)
        let normalized = Math.max(0, Math.min(1, (m.score - 10) / 80)); // 10=0, 90=1
        
        const isGhost = m.score < 30;

        // Orbit rings are now pre-rendered in the SVG background

        const size = 50;
        const nodeColor = colors[i % colors.length];
        
        const angle = (i * (360 / Math.min(topReaders.length, 75))) * (Math.PI / 180);
        const speedMagnitude = 0.00015 + (Math.random() * 0.0003);
        const speed = Math.random() > 0.5 ? speedMagnitude : -speedMagnitude;
        
        let reason = `You both enjoy ${titleCase((m.shared.genres[0] || m.shared.moods[0]) || 'similar books')}.`;
        if (m.shared.authors.length) reason += ` You share authors like ${titleCase(m.shared.authors[0])}.`;
        
        
        let theirBooks = [];
        const mapBookObj = b => ({ title: b.title, isbn: b.isbn, cover: b.cover_url || b.coverUrl || b.cover || (b.isbn ? `https://books.google.com/books/content?vid=ISBN${b.isbn}&printsec=frontcover&img=1&zoom=1` : (b.fallbackCover || (typeof coverPlaceholder === 'function' ? coverPlaceholder(b.title, b.author, 'mixed') : ''))) });
        if (m.shared && m.shared.exactMatches) theirBooks = m.shared.exactMatches.map(mapBookObj);
        let bookSource = window._BOOKS || (typeof App !== 'undefined' && App.isDemoMode ? App.books : null);
        if (theirBooks.length === 0 && bookSource) {
            const count = Math.max(1, Math.floor((m.score / 100) * 8));
            const shuffled = [...bookSource].sort(() => 0.5 - Math.random());
            theirBooks = shuffled.slice(0, count).map(mapBookObj);
        }
        const matchData = { id: m.userId, name: m.name, score: m.score, radius, angle, speed, reason, color: nodeColor, books: theirBooks };
    
        state.constMatches.push(matchData);
        
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('stroke', nodeColor);
        line.setAttribute('stroke-opacity', isGhost ? '0.1' : Math.max(0.15, normalized));
        line.setAttribute('stroke-width', '1');
        line.setAttribute('class', 'const-link');
        svgLines.appendChild(line);
        state.constLines.push(line);

        const node = document.createElement('div');
        node.className = 'const-node const-node-match';
        node.style.width = size + 'px';
        node.style.height = size + 'px';
        if (isGhost) {
            node.style.opacity = '0.9';
            
        }
        
        // Galaxy Book Cover Mode
        let coverToUse = '';
        const bestBook = m.topBook || (theirBooks && theirBooks.length > 0 ? theirBooks[0] : null);
        if (bestBook) {
            const b = bestBook;
            coverToUse = b.cover_url || b.coverUrl || b.cover || (b.isbn ? `https://books.google.com/books/content?vid=ISBN${b.isbn}&printsec=frontcover&img=1&zoom=1` : (b.fallbackCover || (typeof coverPlaceholder === 'function' ? coverPlaceholder(b.title, b.author, 'mixed') : '')));
            matchData.coverTitle = b.title;
            matchData.coverContext = 'Most Recent Read';
        } else if (m.shared && m.shared.exactMatches && m.shared.exactMatches.length > 0) {
            const b = m.shared.exactMatches[0];
            coverToUse = b.cover_url || b.coverUrl || b.cover || (b.isbn ? `https://books.google.com/books/content?vid=ISBN${b.isbn}&printsec=frontcover&img=1&zoom=1` : (b.fallbackCover || (typeof coverPlaceholder === 'function' ? coverPlaceholder(b.title, b.author, 'mixed') : '')));
            matchData.coverTitle = b.title;
            matchData.coverContext = 'Shared Match';
        }
        
        if (coverToUse) {
            // Pre-load the image to prevent 1x1 transparent blanks or 404s
            node.style.backgroundImage = 'none';
            node.innerText = m.avatar;
            node.style.fontSize = (size * 0.4) + 'px';
            
            const img = new Image();
            img.src = coverToUse;
            img.onload = () => {
                if (img.naturalWidth > 1) {
                    node.style.backgroundImage = `url("${coverToUse.replace(/"/g, '%22')}")`;
                    node.style.backgroundSize = 'cover';
                    node.style.backgroundPosition = 'center';
                    node.innerText = '';
                }
            };
        } else if (m.avatar.includes('http')) {
            node.style.backgroundImage = `url('${m.avatar}')`;
            node.style.backgroundSize = 'cover';
            node.style.backgroundPosition = 'center';
            node.innerText = '';
        } else {
            node.style.backgroundImage = 'none';
            node.innerText = m.avatar;
            node.style.fontSize = (size * 0.4) + 'px';
        }
        
        // Make the node circular
        node.style.width = size + 'px';
        node.style.height = size + 'px';
        node.style.borderRadius = '50%';
        node.style.boxShadow = `0 4px 12px rgba(0,0,0,0.2), 0 0 15px ${nodeColor}40`;
        
        node.style.backgroundColor = 'var(--paper)';
        node.style.display = 'flex';
        node.style.justifyContent = 'center';
        node.style.alignItems = 'center';
        node.style.position = 'absolute';

        const badge = document.createElement('div');
        badge.innerText = m.name.charAt(0).toUpperCase();
        badge.style.position = 'absolute';
        badge.style.top = '-8px';
        badge.style.right = '-8px';
        badge.style.backgroundColor = nodeColor;
        badge.style.color = '#fff';
        badge.style.width = Math.max(14, size * 0.3) + 'px';
        badge.style.height = Math.max(14, size * 0.3) + 'px';
        badge.style.borderRadius = '50%';
        badge.style.display = 'flex';
        badge.style.justifyContent = 'center';
        badge.style.alignItems = 'center';
        badge.style.fontSize = Math.max(9, size * 0.18) + 'px';
        badge.style.boxShadow = '0 2px 4px rgba(0,0,0,0.4)';
        badge.style.fontWeight = 'bold';
        badge.style.border = '2px solid var(--paper)';
        badge.style.boxShadow = '0 2px 6px rgba(0,0,0,0.4)';
        node.appendChild(badge);
    
        const tooltip = document.createElement('div');
        tooltip.className = 'node-tooltip';
        tooltip.innerHTML = `<span style="color:#ffffff !important; font-weight:bold; font-size:12px; margin-right:4px;">${m.name}</span><span style="color:#f1c40f !important; font-size:11px;">${m.score}% Match</span>`;
        tooltip.style.position = 'absolute';
        tooltip.style.bottom = 'calc(100% + 15px)';
        tooltip.style.top = 'auto';
        tooltip.style.left = '50%';
        tooltip.style.transform = 'translateX(-50%)';
        tooltip.style.background = 'rgba(0,0,0,0.85)';
        tooltip.style.padding = '6px 10px';
        tooltip.style.borderRadius = '6px';
        tooltip.style.whiteSpace = 'nowrap';
        tooltip.style.opacity = '0';
        tooltip.style.transition = 'opacity 0.2s';
        tooltip.style.pointerEvents = 'none';
        tooltip.style.zIndex = '1000';
        tooltip.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
        node.appendChild(tooltip);

        node.style.borderColor = nodeColor;
        
        node.addEventListener('mouseenter', () => {
            matchData.isHovered = true;
            tooltip.style.opacity = '1';
            matchData._hoverInterval = setInterval(() => { if (typeof App._spawnGalaxyParticle === 'function') App._spawnGalaxyParticle(matchData, line); }, 150);
            if (state.activeZoomNode && state.activeZoomNode !== matchData) return;
            line.setAttribute('stroke-width', '2.5');
            line.setAttribute('stroke-opacity', '1');
        });
        
        node.addEventListener('mouseleave', () => {
            matchData.isHovered = false;
            tooltip.style.opacity = '0';
            if (matchData._hoverInterval) clearInterval(matchData._hoverInterval);
            if (state.activeZoomNode && state.activeZoomNode !== matchData) return;
            if (state.activeZoomNode !== matchData) {
                line.setAttribute('stroke-width', '1');
                line.setAttribute('stroke-opacity', matchData.score < 30 ? '0' : Math.max(0.15, normalized));
            }
        });
        
        node.addEventListener('click', (e) => {
            if (state.activeZoomNode === matchData) return;
            e.stopPropagation();
            state.activeZoomNode = matchData;
            constWorld.classList.add('const-world-zoomed');
            
            if (window.galaxyPanZoom) {
                if (window._galaxyZoomAnim) clearTimeout(window._galaxyZoomAnim);
                
                // Keep the galaxy movable (do not pause)
                // window.galaxyPanZoom.pause();
                
                const cw = document.getElementById('constWrapper');
                const centerX = constWorld.clientWidth / 2;
                const centerY = constWorld.clientHeight / 2;
                const nx = centerX + Math.cos(matchData.angle) * matchData.radius;
                const ny = centerY + Math.sin(matchData.angle) * matchData.radius;
                const targetScale = window.innerWidth <= 768 ? 1.0 : 1.3;
                const exactNx = parseFloat(node.style.left) || nx;
                const exactNy = parseFloat(node.style.top) || ny;
                
                const isMobile = window.innerWidth <= 768;
                const horizontalShift = isMobile ? 0 : 160;
                const verticalShift = isMobile ? 120 : 0;
                
                let screenTargetX = cw.clientWidth / 2;
                let screenTargetY = cw.clientHeight / 2;
                
                if (exactNx > (cw.clientWidth / 2)) {
                    screenTargetX += horizontalShift;
                } else {
                    screenTargetX -= horizontalShift;
                }
                
                if (exactNy > (cw.clientHeight / 2)) {
                    screenTargetY += verticalShift;
                } else {
                    screenTargetY -= verticalShift;
                }
                
                const targetX = screenTargetX - (exactNx * targetScale);
                const targetY = screenTargetY - (exactNy * targetScale);
                
                // Completely clear any CSS transitions so JS can animate freely
                constWorld.style.transition = '';
                
                const startT = window.galaxyPanZoom.getTransform();
                const startX = startT.x;
                const startY = startT.y;
                const startScale = startT.scale;
                
                const startTime = performance.now();
                function animateZoomIn(time) {
                    let elapsed = time - startTime;
                    let t = elapsed / 600;
                    if (t > 1) t = 1;
                    const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
                    
                    const curX = startX + (targetX - startX) * ease;
                    const curY = startY + (targetY - startY) * ease;
                    const curScale = startScale + (targetScale - startScale) * ease;
                    
                    window.galaxyPanZoom.zoomAbs(0, 0, curScale);
                    window.galaxyPanZoom.moveTo(curX, curY);
                    
                    if (t < 1) {
                        window._galaxyZoomAnim = requestAnimationFrame(animateZoomIn);
                    }
                }
                window._galaxyZoomAnim = requestAnimationFrame(animateZoomIn);
            }

            state.isGalaxyHovered = false;
            
            document.querySelectorAll('.const-node-match').forEach(n => {
                n.classList.remove('active-zoom');
                n.style.boxShadow = 'none';
            });
            document.querySelectorAll('.const-link').forEach(l => l.classList.remove('active-link'));
            
            node.classList.add('active-zoom');
            node.style.boxShadow = `0 0 30px ${nodeColor}`;
            line.classList.add('active-link');
            line.setAttribute('stroke-width', '3');
            line.setAttribute('stroke-opacity', '1');
            
            document.getElementById('dpName').innerText = matchData.name;
            document.getElementById('dpScore').innerText = `${matchData.score}% Match`;
            document.getElementById('dpReason').innerText = matchData.reason;
            let booksHtml = '';
            if (matchData.coverTitle) {
                booksHtml += `<div style="font-size:11px; color:var(--wood-dark); margin-bottom:10px; padding:6px; background:rgba(255,255,255,0.4); border-radius:4px; border: 1px solid rgba(139,99,67,0.2);"><b>Cover Book (${matchData.coverContext}):</b><br/>${this._escapeHtml(matchData.coverTitle)}</div>`;
            }
            booksHtml += '<div style="margin-top:6px;"><b>Shared Books:</b><br/>' + (matchData.books.length ? '<div style="display:flex; flex-wrap:wrap; gap:10px; margin-top:8px;">' + matchData.books.map(b => `<div title="${this._escapeHtml(b.title)}" style="width:40px; height:60px; border-radius:3px; background-image:url('${b.cover}'); background-size:cover; background-position:center; box-shadow:0 2px 5px rgba(0,0,0,0.2);"></div>`).join('') + '</div>' : 'None') + '</div>';
            document.getElementById('dpBooks').innerHTML = booksHtml;
            document.getElementById('dpProfile').onclick = (ev) => { ev.stopPropagation(); App.openProfileView(matchData.id); };
            document.getElementById('detailPanel').classList.add('visible');
            
            clearInterval(state.particleInterval);
            state.particleInterval = setInterval(() => this._spawnGalaxyParticle(matchData, line), 100);
        });

        constWorld.appendChild(node);
        state.constNodes.push(node);
    });

    constWorld.addEventListener('click', (e) => {
        if (!e.target.closest('.const-node') && !e.target.closest('#detailPanel')) {
            this.resetGalaxyZoom(e);
        }
    });
    
    this._animateGalaxy();
    } catch (err) { alert('Galaxy Error: ' + err.message + '\n' + err.stack); console.error(err); }
 },

   _renderClubDetail(el, club, msgs, members = [], shelfBooks = []) {
    const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const isAdmin = club.myRole === 'admin';
    const isMember = club.myRole === 'member' || isAdmin;
    const thumbMatch = (club.description || '').match(/\[thumb:(.*?)\]/);
    const clubThumb = club.thumbnail_url || club.thumbnail || (thumbMatch ? thumbMatch[1] : null);
    const cleanDesc = (club.description || '').replace(/\[thumb:.*?\]/g, '').replace(/https?:\/\/\S+/g, '').replace(/\b\S+\.(png|jpg|jpeg|gif|webp)\S*\b/gi, '').trim();

  const pickSection = `
        <div style="display: flex; flex-direction: column; flex: 1; justify-content: stretch;">
          ${club.current_book_title
            ? `<div onclick="App.openBookModal({title: '${esc(club.current_book_title)}', author: '${esc(club.current_book_author||'')}', cover: '${esc(club.current_book_cover||'')}'})" style="cursor: pointer; display: flex; flex-direction: row; gap: 20px; align-items: flex-start; justify-content: flex-start; text-align: left; padding: 8px 16px; background: #fff; border-radius: 12px; flex: 1; box-shadow: 0 0 0 2px var(--burgundy), 0 4px 16px rgba(139,38,53,0.15); flex: 1; box-sizing: border-box; transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 0 0 2px var(--burgundy), 0 6px 20px rgba(139,38,53,0.2)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 0 0 2px var(--burgundy), 0 4px 16px rgba(139,38,53,0.15)';">
                 ${club.current_book_cover ? `<img loading="lazy" decoding="async" src="${esc(club.current_book_cover)}" style="width:auto; max-width:90px; height:auto; max-height:110px; object-fit:contain; border-radius:6px; box-shadow:0 6px 16px rgba(61,43,31,0.2); flex-shrink: 0;" onerror="this.style.display='none';">` : ''}
                 <div style="display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: 5px; min-width: 0;">
                   <div style="font-family: 'DM Mono', monospace; font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--wood-mid); font-weight: 700; margin: 0;">Current Pick</div>
                   <div style="font-family: 'Playfair Display', serif; font-size: 16px; font-weight: 700; color: var(--wood-dark); line-height: 1.2; margin: 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${esc(club.current_book_title)}</div>
                   ${club.current_book_author ? `<div style="font-size: 12px; color: var(--wood-mid); font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${esc(club.current_book_author)}</div>` : ''}
                   <div style="font-family: 'DM Mono', monospace; font-size: 9px; color: var(--wood-mid); margin: 0; text-transform: uppercase; letter-spacing: 0.05em; display: flex; flex-direction: column; gap: 5px; margin: 0;">
                     <div><strong style="color: var(--wood-dark);">Starts:</strong> ${club.start_date || 'TBD'}</div>
                     <div><strong style="color: var(--wood-dark);">Finishes:</strong> ${club.end_date || 'TBD'}</div>
                   </div>
                 </div>
               </div>`
            : `<div style="display: flex; flex-direction: column; align-items: center; padding: 20px; background: rgba(139,38,53,0.03); border-radius: 12px; border: 1px dashed rgba(139,38,53,0.2); text-align: center; flex: 1; justify-content: center; box-sizing: border-box;">
                 <div style="font-family: 'DM Mono', monospace; font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--wood-mid); font-weight: 700; margin-bottom: 12px;">Current Pick</div>
                 <div style="font-size: 12px; font-weight: 600; color: var(--wood-dark); margin-bottom: 4px;">No book selected</div>
                 <div style="font-size: 10px; color: var(--wood-mid); margin-top: 4px;">Configure in Admin Settings</div>
               </div>`
          }
        </div>
      `;

  const memberItems = members.map((m, i) => {
    const prof = m.user_profiles || {};
    const avatar = (typeof App !== "undefined" && App._getUserAvatar ? App._getUserAvatar(prof) : (prof.avatar_emoji || '❌'));
    const bg = App._avatarBg ? App._avatarBg(avatar) : '#f4f4f4';
    return `<div title="${esc(prof.display_name||'Reader')}${m.role==='admin'?' (Admin)':''}" style="width: 32px; height: 32px; border-radius: 50%; background: ${bg}; display: flex; align-items: center; justify-content: center; font-size: 14px; border: 2px solid var(--paper); box-shadow: 0 2px 6px rgba(0,0,0,0.05); margin-left: ${i===0?'0':'-10px'}; z-index: ${100-i};">${avatar}</div>`;
  }).join('');
  
  const membersSection = members.length ? `
    <div style="display: flex; align-items: center; justify-content: space-between; padding: 0 20px; margin-bottom: 24px;">
      <div style="display: flex; align-items: center;">
        <div style="font-family: 'DM Mono', monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--wood-mid); margin-right: 16px; font-weight: 700;">Members</div>
        <div style="display: flex; align-items: center;">${memberItems}</div>
      </div>
      <div style="font-size: 11px; color: var(--wood-light); font-weight: 600;">${members.length} Total</div>
    </div>
  ` : '';

  
  const pastReads = club.past_reads || [];
    const pastReadsItems = pastReads.map(b => {
        let dispTitle = b.title || '';
        let dispAuthor = b.author || '';
        if (!dispAuthor && dispTitle.includes(' by ')) {
            const parts = dispTitle.split(' by ');
            dispAuthor = parts.pop().trim();
            dispTitle = parts.join(' by ').trim();
        }
        const cover = b.coverUrl || b.cover_url || b.cover || '';
        return `<div style="display: flex; flex-direction: column; align-items: center; width: 80px; flex-shrink: 0; cursor:pointer; transition: transform 0.2s;" onmouseover="this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.transform=\'translateY(0)\'" title="${esc(dispTitle)}${dispAuthor ? ' by ' + esc(dispAuthor) : ''}" data-title="${esc(dispTitle)}" data-author="${esc(dispAuthor)}" data-cover="${esc(cover)}" data-synopsis="${esc(b.synopsis || b.review || b.description || '')}" onclick="App.openBookModal(this)">
          ${cover ? `<img loading="lazy" decoding="async" src="${esc(cover)}" style="width: 80px; height: 120px; object-fit: cover; border-radius: 8px; box-shadow: 0 6px 16px rgba(61,43,31,0.2); margin-bottom:8px;" onerror="this.style.display='none';">` : `<div style="width: 80px; height: 120px; background: rgba(139,38,53,0.05); border: 1px dashed rgba(139,38,53,0.2); border-radius: 8px; margin-bottom:8px; display:flex; align-items:center; justify-content:center;"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.3;"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path></svg></div>`}
          <div style="font-size:9px; font-weight:700; color:var(--wood-dark); text-align:center; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; line-height:1.2; width:100%;">${esc(dispTitle)}</div>
          ${dispAuthor ? `<div style="font-size:8px; color:var(--wood-mid); text-align:center; font-family:'DM Mono',monospace; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-top:2px;">${esc(dispAuthor)}</div>` : ''}
          ${b.date ? `<div style="font-size:8px; color:var(--wood-mid); text-align:center; margin-top:2px;">${esc(b.date)}</div>` : ''}
        </div>`;
    }).join('');
  
  const pastReadsSection = pastReads.length ? `
    <div style="position: relative; width: 100%; box-sizing: border-box; height: 100%;">
          <button class="club-dropdown-btn" onclick="const el = document.getElementById('pastMenu-' + '${club.id}'); el.style.display = el.style.display === 'none' ? 'block' : 'none';" style="padding: 12px 20px; display: block; width: 100%; box-sizing: border-box; font-family: 'DM Mono', monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--wood-mid); font-weight: 700; cursor: pointer; text-align: left; background: rgba(139,38,53,0.03); border-radius: 8px; outline: none; border: 1px solid rgba(139,38,53,0.08); height: 100%;"><span class="hide-mobile">📖 View Past Reads</span><span class="show-mobile">Past</span></button>
          <div id="pastMenu-${club.id}" class="mobile-menu-drop" style="display: none; position: absolute; right: 0; top: calc(100% + 8px); background: rgba(255, 255, 255, 0.98); backdrop-filter: blur(10px); border-radius: 16px; padding: 24px; box-shadow: 0 12px 48px rgba(61,43,31,0.2), 0 0 0 1px rgba(139,38,53,0.05); width: 420px; max-width: calc(100vw - 40px); z-index: 10000;">
               <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 20px; border-bottom: 1px solid rgba(139,38,53,0.08); padding-bottom: 12px;">
                 <div style="font-family: 'Playfair Display', serif; font-size: 18px; color: var(--wood-dark); font-weight: 700;">Past Reads</div>
                 <div style="font-family: 'DM Mono', monospace; font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--burgundy); font-weight: 700; background: rgba(139,38,53,0.05); padding: 4px 8px; border-radius: 12px;">${pastReads.length} Books</div>
               </div><div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap:20px 16px; padding: 4px; max-height: 50vh; overflow-y: auto;">
               ${pastReadsItems}
             </div>
          </div>
        </div>
  ` : '';

  let shelfHtml = '';
  if (shelfBooks.length > 0) {
    const bookItems = shelfBooks.map(b => {
      const prof = b._member_prof || {};
      const avatar = (typeof App !== "undefined" && App._getUserAvatar ? App._getUserAvatar(prof) : (prof.avatar_emoji || '❌'));
      const cover = b.cover_url || b.coverUrl || b.cover || b.fallbackCover || '';
      return `<div style="display: flex; flex-direction: column; align-items: center; width: 70px; flex-shrink: 0; position: relative;" title="${esc(b.title)} by ${esc(b.author)}">
        <img loading="lazy" decoding="async" src="${esc(cover)}" style="width: 70px; height: 105px; object-fit: cover; border-radius: 6px; box-shadow: 0 6px 16px rgba(61,43,31,0.15);" onerror="if(this&&this.style)this.style.display='none';">
        <div style="position: absolute; bottom: -8px; right: -8px; width: 24px; height: 24px; border-radius: 50%; background: #fff; display: flex; align-items: center; justify-content: center; font-size: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border: 1px solid rgba(0,0,0,0.05);">${avatar}</div>
      </div>`;
    }).join('');
    shelfHtml = `<div style="padding: 0 20px 24px 20px; border-bottom: 1px solid rgba(139,38,53,0.08); margin-bottom: 20px;">
      <div style="font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--wood-mid); margin-bottom: 16px; font-weight: 700;">Club Shelf</div>
      <div style="display: flex; gap: 20px;  padding-bottom: 16px; margin-bottom: -16px;">${bookItems}</div>
    </div>`;
  }

  // Ensure chronological ascending order
  const sortedMsgs = [...(msgs || [])].sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));

  let lastDayKey = null;
  const msgItems = sortedMsgs.map(m => {
    const prof = m.user_profiles || {};
    const avatar = (typeof App !== "undefined" && App._getUserAvatar ? App._getUserAvatar(prof) : (prof.avatar_emoji || '📚'));
    const bg = (typeof App !== "undefined" && App._avatarBg ? App._avatarBg(avatar) : '#f4f4f4');
    const isMine = (typeof App !== "undefined" && App.userId && String(m.user_id) === String(App.userId));
    
    let dateDivider = '';
    let timeStr = '';
    let dayKey = '';
    if (m.created_at) {
      const d = new Date(m.created_at);
      timeStr = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
      dayKey = getChatDayKey(d);
      if (dayKey && dayKey !== lastDayKey) {
        const label = formatChatDate(d);
        dateDivider = renderDateDivider(label, dayKey);
        lastDayKey = dayKey;
      }
    }
    
    return `${dateDivider}<div class="club-msg-item ${isMine ? 'mine' : ''}">
      ${!isMine ? `<div style="width: 32px; height: 32px; border-radius: 50%; background: ${bg}; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; box-shadow: 0 2px 6px rgba(0,0,0,0.05); margin-right: 8px;">${avatar}</div>` : ''}
      <div style="display: flex; flex-direction: column; max-width: ${isMine ? '100%' : 'calc(100% - 40px)'};">
        <div class="club-msg-author">${esc(prof.display_name||'Reader')}</div>
        <div class="club-msg-bubble" style="position: relative;">
          ${isAdmin ? `<button onclick="event.stopPropagation(); App.deleteClubMessage('${club.id}', '${m.id}')" style="position: absolute; right: -24px; top: 50%; transform: translateY(-50%); background: transparent; border: none; font-size: 14px; cursor: pointer; opacity: 0.5; padding: 4px;" title="Delete Message" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.5'">❌</button>` : ''}
          ${esc(m.content)}
          <div class="club-msg-time">${timeStr}</div>
        </div>
      </div>
    </div>`;
  }).join('');

  el.innerHTML = `
  <style>
  .club-premium-container { display: flex; flex-direction: column; height: 100%; background: var(--paper); color: var(--wood-dark); font-family: 'Inter', sans-serif; overflow: hidden; border-radius: 12px; }
  .club-msg-area { padding: 0 20px 20px 20px; display: flex; flex-direction: column; gap: 16px; }
  .club-date-divider { display: flex; align-items: center; margin: 20px 0; opacity: 0.85; width: 100%; }
  .club-date-divider-line { flex: 1; height: 1px; background: rgba(139, 38, 53, 0.12); }
  .club-date-divider-text { font-family: 'DM Mono', monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--wood-light); font-weight: 700; margin: 0 16px; white-space: nowrap; }
  .club-msg-item { display: flex; align-items: flex-end; max-width: 85%; }
  .club-msg-item.mine { align-self: flex-end; flex-direction: row-reverse; }
  .club-msg-bubble { padding: 12px 16px; border-radius: 20px; background: rgba(139, 38, 53, 0.04); border: 1px solid rgba(139, 38, 53, 0.08); color: var(--wood-dark); font-size: 14px; line-height: 1.5; position: relative; word-break: break-word; border-bottom-left-radius: 4px; display: flex; flex-direction: column; box-shadow: 0 2px 8px rgba(61,43,31,0.03); }
  .club-msg-item.mine .club-msg-bubble { background: var(--burgundy); color: #fff; border: none; border-bottom-right-radius: 4px; border-bottom-left-radius: 20px; box-shadow: 0 4px 12px rgba(139,38,53,0.2); }
  .club-msg-author { font-size: 11px; font-weight: 600; color: var(--wood-mid); margin-bottom: 6px; padding: 0 4px; }
  .club-msg-item.mine .club-msg-author { display: none; }
  .club-msg-time { font-family: 'DM Mono', monospace; font-size: 9px; opacity: 0.6; align-self: flex-end; margin-top: 6px; font-weight: 600; letter-spacing: 0.05em; }
  
  .club-compose-bar { padding: 16px 20px; background: rgba(250,248,245,0.9); backdrop-filter: blur(12px); border-top: 1px solid rgba(139,38,53,0.1); display: flex; gap: 12px; align-items: center; }
  .club-input-field { flex: 1; background: #fff; border: 1px solid rgba(139,38,53,0.2); border-radius: 24px; padding: 12px 20px; color: var(--wood-dark); font-size: 14px; outline: none; transition: all 0.2s; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02); }
  .club-input-field:focus { border-color: var(--burgundy); box-shadow: inset 0 2px 4px rgba(0,0,0,0.02), 0 0 0 3px rgba(139,38,53,0.1); }
  .club-input-field::placeholder { color: var(--wood-light); font-weight: 500; }
  .club-send-btn { width: 44px; height: 44px; border-radius: 50%; background: var(--burgundy); border: none; color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; flex-shrink: 0; box-shadow: 0 4px 12px rgba(139,38,53,0.3); font-size: 18px; }
  .club-send-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(139,38,53,0.4); }
  
  .club-back-btn { background: #fff; border: 1px solid rgba(139,38,53,0.15); width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--wood-dark); font-weight: bold; transition: all 0.2s; box-shadow: 0 2px 6px rgba(61,43,31,0.05); flex-shrink: 0; }
  .club-back-btn:hover { background: rgba(139,38,53,0.05); transform: translateX(-2px); }
    @media (max-width: 600px) {
      .club-vote-container { flex-direction: column !important; }
      .club-right-panel { flex-direction: row !important; gap: 8px !important; }
      .club-right-panel > * { flex: 1 !important; min-width: 0 !important; }
      .club-dropdown-btn { justify-content: center !important; padding: 12px 4px !important; }
      .hide-mobile { display: none !important; }
      .show-mobile { display: inline !important; }
      .mobile-menu-drop { right: 0 !important; left: 0 !important; top: 100% !important; margin-top: 8px; width: auto !important; max-width: none !important; }
    }
    .show-mobile { display: none; }
  </style>
  <div class="club-premium-container">
    <div class="club-detail-header" style="padding: 5px 20px 0px 20px; display: flex; align-items: center; justify-content: space-between; gap: 16px; border-bottom: 1px solid rgba(139,38,53,0.08); background: #fff; z-index: 10; flex-shrink: 0; flex-wrap: wrap;">
      <div style="display: flex; align-items: center; gap: 14px; flex: 1; min-width: 200px;">
        <button class="club-back-btn" onclick="App.renderClubs()" title="Back to Clubs">←</button>
        ${clubThumb ? `<img src="${esc(clubThumb)}" style="width:48px; height:48px; object-fit:cover; border-radius:8px; box-shadow:0 2px 8px rgba(61,43,31,0.15); flex-shrink:0;" onerror="this.style.display='none';">` : ''}
        <div style="flex: 1; min-width: 0;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 700; color: var(--burgundy); white-space: normal; line-height: 1.2; letter-spacing: -0.02em; word-break: break-word;">${esc(club.name)}</div>
            ${isAdmin ? `<button onclick="App.editClubName(this)" data-club-id="${club.id}" data-club-name="${esc(club.name||'')}" style="background: rgba(139,38,53,0.05); border: none; color: var(--burgundy); cursor: pointer; font-size: 10px; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: all 0.2s; flex-shrink: 0;" onmouseover="this.style.background='rgba(139,38,53,0.1)'" onmouseout="this.style.background='rgba(139,38,53,0.05)'" title="Edit Club Name">✏️</button>` : ''}
          </div>
          ${cleanDesc ? `<div style="font-size: 12px; color: var(--wood-mid); margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500;">${esc(cleanDesc)}</div>` : ''}
        </div>
      </div>
      <div class="club-header-actions" style="display: flex; align-items: center; gap: 8px; flex-shrink: 0; flex-wrap: wrap;">
        ${!isMember ? `<button class="club-action-btn club-join-btn" onclick="App.joinClub('${club.id}')" style="background: var(--burgundy); color: #fff; border: none; padding: 6px 14px; border-radius: 16px; font-weight: 700; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 4px; box-shadow: 0 2px 8px rgba(139,38,53,0.3); transition: all 0.2s;" title="Join Club" aria-label="Join Club">Join Club</button>` : ''}
        ${(isMember && !isAdmin) ? `<button class="club-action-btn" onclick="App.leaveClub('${club.id}')" style="background: transparent; color: var(--wood-mid); border: 1px solid var(--wood-mid); padding: 6px 14px; border-radius: 16px; font-weight: 700; font-size: 12px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(61,43,31,0.05)'" onmouseout="this.style.background='transparent'" title="Leave Club">Leave</button>` : ''}
        <button onclick="App.openInviteModal('${club.id}')" style="width: 32px; height: 32px; border-radius: 50%; border: 1px solid rgba(61,43,31,0.2); background: #fff; color: var(--wood-dark); font-weight: 700; font-size: 14px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center;" onmouseover="this.style.background='rgba(61,43,31,0.05)'" onmouseout="this.style.background='#fff'" title="Invite Friends" aria-label="Invite Friends">➕</button>
        <button onclick="App.openClubShelf('${club.id}')" style="background: rgba(139,38,53,0.08); border: none; padding: 8px 12px; border-radius: 20px; color: var(--burgundy); cursor: pointer; font-weight: 600; font-size: 12px; transition: all 0.2s; display: flex; align-items: center; justify-content: center; margin-right: 4px;" onmouseover="this.style.background='rgba(139,38,53,0.15)'" onmouseout="this.style.background='rgba(139,38,53,0.08)'" title="View Club Shelf">📚</button>
        <button onclick="App.openManageMembers('${club.id}')" style="background: rgba(139,38,53,0.08); border: none; padding: 8px 12px; border-radius: 20px; color: var(--burgundy); cursor: pointer; font-weight: 600; font-size: 12px; transition: all 0.2s; display: flex; align-items: center; justify-content: center;" onmouseover="this.style.background='rgba(139,38,53,0.15)'" onmouseout="this.style.background='rgba(139,38,53,0.08)'" title="View Members">👥</button>
        ${isAdmin ? `<button onclick="App.openAdminPanel('${club.id}')" style="background: linear-gradient(135deg, #c5a059, #e6c887); border: none; padding: 8px 12px; border-radius: 20px; color: #fff; cursor: pointer; font-weight: 700; font-size: 12px; transition: all 0.2s; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(197,160,89,0.3); text-shadow: 0 1px 2px rgba(0,0,0,0.1);" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(197,160,89,0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(197,160,89,0.3)'" title="Admin Settings">⚙️</button>` : ''}
      </div>
    </div>
    
    
      <div style="display: flex; border-bottom: 1px solid rgba(139,38,53,0.08); background: #fff; z-index: 10; padding: 0 20px; flex-shrink: 0;">
        <button id="clubTabChatBtn" onclick="document.getElementById('clubChatView').style.display='flex'; document.getElementById('clubBooksView').style.display='none'; this.style.borderBottom='2px solid var(--burgundy)'; this.style.color='var(--burgundy)'; document.getElementById('clubTabBooksBtn').style.borderBottom='2px solid transparent'; document.getElementById('clubTabBooksBtn').style.color='var(--wood-mid)';" style="padding: 12px 16px; font-weight: 700; font-size: 13px; color: var(--burgundy); border: none; background: transparent; cursor: pointer; border-bottom: 2px solid var(--burgundy); outline: none;">Discussion</button>
        <button id="clubTabBooksBtn" onclick="document.getElementById('clubBooksView').style.display='flex'; document.getElementById('clubChatView').style.display='none'; this.style.borderBottom='2px solid var(--burgundy)'; this.style.color='var(--burgundy)'; document.getElementById('clubTabChatBtn').style.borderBottom='2px solid transparent'; document.getElementById('clubTabChatBtn').style.color='var(--wood-mid)';" style="padding: 12px 16px; font-weight: 700; font-size: 13px; color: var(--wood-mid); border: none; background: transparent; cursor: pointer; border-bottom: 2px solid transparent; outline: none;">Books</button>
      </div>
      <div id="clubInnerScroll" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; background: var(--paper); position: relative;">

      <div id="clubBooksView" style="display: none; flex-direction: column; flex: 1;">
        <div class="club-vote-container" style="display: flex; gap: 12px; padding: 16px 20px 5px 20px; border-bottom: 1px solid rgba(139,38,53,0.08); background: #fdfcfc; z-index: 5; flex-shrink: 0; align-items: stretch; box-sizing: border-box;">
        <div style="flex: 1; min-width: 0; display: flex; flex-direction: column;">${pickSection}</div>
          <div class="club-right-panel" style="flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: space-between; gap: 5px; height: 100%;">
          ${true ? `
             <div id="clubVoteZone-${club.id}" style="position: relative; height: 100%;"></div>
             <div style="position: relative; height: 100%;">
               <div class="club-dropdown-btn" style="display: flex; align-items: center; background: #fff; border: 1px solid rgba(139,38,53,0.15); border-radius: 8px; padding: 8px 12px; box-shadow: 0 2px 8px rgba(61,43,31,0.05); position: relative; width: 100%; box-sizing: border-box; height: 100%;">
                 <input id="suggestInput-${club.id}" class="hide-mobile" autocomplete="off" placeholder="Suggest a book..." style="flex: 1; border: none; outline: none; font-size: 13px; color: var(--wood-dark); background: transparent; width: 100%;" onfocus="clearTimeout(window._suggestTimer); window._suggestTimer = setTimeout(() => App.handleClubSuggestSearch(this.value, '${club.id}'), 300)" onkeyup="if(event.key==='Enter'){App.suggestClubBook('${club.id}');return;} clearTimeout(window._suggestTimer); window._suggestTimer = setTimeout(() => App.handleClubSuggestSearch(this.value, '${club.id}'), 300)"><span class="show-mobile" style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--wood-mid); font-weight: 700;">Suggest</span><input id="suggestInput-mobile-${club.id}" class="show-mobile" style="position: absolute; inset: 0; opacity: 0; width: 100%; height: 100%;" onfocus="document.getElementById('suggestInput-${club.id}').focus()" onkeyup="document.getElementById('suggestInput-${club.id}').value = this.value; document.getElementById('suggestInput-${club.id}').dispatchEvent(new Event('keyup'))">
                 
                 <div id="suggestDropdown-${club.id}" class="mobile-menu-drop" style="position: absolute; top: 100%; right: 0; left: 0; background: #fff; box-shadow: 0 4px 16px rgba(0,0,0,0.1); border-radius: 6px; display: none; max-height: 200px; overflow-y: auto; z-index: 1000; border: 1px solid rgba(139,38,53,0.1); margin-top: 4px;"></div>
               </div>
             </div>
          ` : ''}
          ${pastReadsSection}
        </div>
      </div>
${!isMember ? `
        <div class="public-club-join-banner" style="margin: 16px 20px 0 20px; padding: 14px 20px; background: rgba(139,38,53,0.06); border: 1px solid rgba(139,38,53,0.15); border-radius: 12px; display: flex; align-items: center; justify-content: space-between; gap: 16px;">
          <div>
            <div style="font-weight: 700; font-size: 14px; color: var(--wood-dark);">Join ${esc(club.name)}</div>
            <div style="font-size: 12px; color: var(--wood-mid);">Read along with members, nominate books, and join discussions.</div>
          </div>
          <button class="club-join-btn" onclick="App.joinClub('${club.id}')" style="padding: 8px 18px; background: var(--burgundy); color: #fff; border: none; border-radius: 20px; font-weight: 700; font-size: 13px; cursor: pointer; white-space: nowrap; box-shadow: 0 4px 12px rgba(139,38,53,0.25);">Join Club</button>
        </div>
      ` : ''}
        <div style="padding-top: 20px;"></div>
        </div>
        <div id="clubChatView" style="display: flex; flex-direction: column; flex: 1;">

        
        ${shelfHtml}
        <div class="club-msg-area" id="clubMsgs" data-last-day="${lastDayKey || ''}">
          ${msgItems || '<div style="text-align: center; font-size: 13px; color: var(--wood-light); font-weight: 500; margin-top: 40px; padding: 40px; border: 1px dashed rgba(139,38,53,0.2); border-radius: 12px; margin-bottom: 40px;">No messages yet. Be the first to start the conversation!</div>'}
        </div>
        </div>

    ${isMember ? `
    <div class="club-compose-bar">
      <input class="club-input-field" id="clubMsgInput" placeholder="Share your thoughts..." maxlength="500" onkeydown="if(event.key==='Enter'){App.sendClubMessage('${club.id}');event.preventDefault();}">
      <button class="club-send-btn" onclick="App.sendClubMessage('${club.id}')" title="Send Message">↑</button>
    </div>
    ` : `
    <div class="club-compose-bar" style="justify-content: center; background: rgba(250,248,245,0.95);">
      <button class="club-join-btn" onclick="App.joinClub('${club.id}')" style="width: 100%; max-width: 400px; padding: 12px 24px; background: var(--burgundy); color: #fff; border: none; border-radius: 24px; font-weight: 700; font-size: 14px; cursor: pointer; box-shadow: 0 4px 14px rgba(139,38,53,0.25); transition: all 0.2s;">
        ✨ Join Club to Participate in Discussion
      </button>
    </div>
    `}
  </div>`;

  if (true) {
    const _voteEl = document.getElementById('clubVoteZone-' + club.id);
    if (_voteEl) {
      if (typeof this._renderVotingSection === 'function') {
        this._renderVotingSection(_voteEl, club);
      } else if (typeof App._renderVotingSection === 'function') {
        App._renderVotingSection(_voteEl, club);
      }
    }
  }

  const innerScroll = document.getElementById('clubInnerScroll');
  if (innerScroll) innerScroll.scrollTop = innerScroll.scrollHeight;
  const msgsEl = document.getElementById('clubMsgs');
  if (msgsEl) msgsEl.scrollTop = msgsEl.scrollHeight;

  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(() => {
      const scrollEl = document.getElementById('clubInnerScroll');
      if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
      const mEl = document.getElementById('clubMsgs');
      if (mEl) mEl.scrollTop = mEl.scrollHeight;
    });
  }

},
  _renderVotingSection(el, club) {
    if (!el) return;
    const esc = s => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    if (!App._clubVotes) App._clubVotes = {};
    if (!App._clubVotingCandidates) App._clubVotingCandidates = {};
    if (!App._clubStartDates) App._clubStartDates = {};

    let candidates = App._clubVotingCandidates[club.id];
    if (!candidates || candidates.length === 0) {
      const pool = (App.books || []).filter(b => b.cover_id || b.cover || b.cover_url || b.coverUrl);
      if (pool.length >= 3) {
        const shuffled = [...pool].sort(() => 0.5 - Math.random());
        candidates = shuffled.slice(0, 3);
      } else if (pool.length > 0) {
        candidates = [...pool];
      } else {
        candidates = [
          { id: 'c_dune', title: 'Dune', author: 'Frank Herbert', cover_url: 'https://covers.openlibrary.org/b/id/8739161-M.jpg' },
          { id: 'c_hyperion', title: 'Hyperion', author: 'Dan Simmons', cover_url: 'https://covers.openlibrary.org/b/id/8305886-M.jpg' },
          { id: 'c_foundation', title: 'Foundation', author: 'Isaac Asimov', cover_url: 'https://covers.openlibrary.org/b/id/8741369-M.jpg' }
        ];
      }
      App._clubVotingCandidates[club.id] = candidates;
    }

    const selectedBookId = App._clubVotes[club.id];

    const candidateHtml = candidates.map(b => {
      const bookId = String(b.id || b._dbId || b.title);
      const isSelected = String(selectedBookId) === bookId;
      const cover = b.cover_url || b.coverUrl || b.cover || b.fallbackCover || (b.cover_id ? `https://covers.openlibrary.org/b/id/${b.cover_id}-S.jpg` : coverPlaceholder(b.title, b.author, 'mixed'));

      return `
        <div class="club-vote-item" onclick="event.stopPropagation(); App.castClubVote('${club.id}', '${esc(bookId)}')" title="${esc(b.title)}${b.author ? ' by ' + esc(b.author) : ''}" style="display: flex; gap: 6px; align-items: center; cursor: pointer; transition: transform 0.2s; min-width: 0; flex: 1;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
          <div style="position: relative; flex-shrink: 0;">
            <img loading="lazy" decoding="async" src="${esc(cover)}" style="width: 40px; height: 60px; object-fit: cover; border-radius: 4px; box-shadow: 0 2px 8px rgba(61,43,31,0.15); border: ${isSelected ? '2px solid #10b981' : '1px solid transparent'}; box-sizing: border-box; display: block;" onerror="if(this&&this.style)this.style.display='none';">
            ${isSelected ? `
              <div style="position: absolute; inset: 0; background: rgba(16, 185, 129, 0.25); border-radius: 4px; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(1px);">
                <div style="background: #10b981; color: #fff; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: bold; box-shadow: 0 2px 8px rgba(0,0,0,0.4);">&check;</div>
              </div>
            ` : ''}
          </div>
          <div class="club-vote-info" style="display: flex; flex-direction: column; min-width: 0; padding-right: 4px; text-align: left;">
            <div style="font-family: 'Playfair Display', serif; font-size: 11px; font-weight: 700; color: var(--wood-dark); line-height: 1.2; margin-bottom: 2px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; white-space: normal;">${esc(b.title)}</div>
            ${b.author ? `<div style="font-size: 9px; color: var(--wood-mid); font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${esc(b.author)}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');

    
      const existingMenu = document.getElementById('voteMenu-' + club.id);
      const wasOpen = (existingMenu && existingMenu.style.display !== 'none');
      const forceOpen = (App._forceMenuOpen === club.id);
      if (forceOpen) App._forceMenuOpen = null;
      const displayState = (wasOpen || forceOpen) ? 'block' : 'none';
      const startDateStr = App._clubStartDates[club.id] ? `<span style="font-size:9px; color:var(--wood-light); margin-left:8px; font-weight:normal; text-transform:none;">Starts: ${App._clubStartDates[club.id]}</span>` : '';

    el.innerHTML = `
      <div style="position: relative; width: 100%; height: 100%;">
          <button class="club-dropdown-btn" onclick="const el = document.getElementById('voteMenu-' + '${club.id}'); el.style.display = el.style.display === 'none' ? 'block' : 'none';" style="padding: 12px 20px; display: block; width: 100%; box-sizing: border-box; font-family: 'DM Mono', monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--wood-mid); font-weight: 700; cursor: pointer; text-align: left; background: rgba(139,38,53,0.03); border-radius: 8px; outline: none; border: 1px solid rgba(139,38,53,0.08); height: 100%;"><span class="hide-mobile">Vote: Next Pick ${startDateStr}</span><span class="show-mobile">Vote</span></button>
          <div id="voteMenu-${club.id}" class="mobile-menu-drop" style="display: ${displayState}; position: absolute; right: calc(100% + 12px); top: 0; background: #fff; border-radius: 12px; padding: 12px; box-shadow: 0 8px 32px rgba(61,43,31,0.15); border: 1px solid rgba(139,38,53,0.1); width: max-content; z-index: 10000;">
             <div style="display: flex; flex-direction: column; gap: 8px; min-width: 0; align-items: stretch;">
               ${candidateHtml}
             </div>
          </div>
        </div>
    `;
  },

  
  async markClubBookFinished(clubId) {
    if (!clubId) return;
    if (confirm("Move the current pick to Past Reads?")) {
      if (App.isDemoMode || !_supabase || String(clubId).startsWith('mock_')) {
        if (typeof App.showToast === 'function') App.showToast('Book moved to past reads (Demo)');
        App._currentClub = null;
        if (typeof App.openClub === 'function') App.openClub(clubId);
        return;
      }
      try {
        const clubs = await DB.getMyClubs(App.userId);
        const club = (clubs || []).find(c => c.id === clubId);
        if (!club || !club.current_book_title) return;
        
        const pastReads = Array.isArray(club.past_reads) ? [...club.past_reads] : [];
        pastReads.unshift({
          title: club.current_book_title,
          author: club.current_book_author,
          cover: club.current_book_cover,
          date: new Date().toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
        });
        
        const { error } = await _supabase.from('clubs').update({
          past_reads: pastReads,
          current_book_title: null,
          current_book_author: null,
          current_book_cover: null
        }).eq('id', clubId);
        
        if (error) throw error;
        
        if (typeof App.showToast === 'function') App.showToast('Moved to past reads!');
        App._currentClub = null;
        if (typeof App.openClub === 'function') App.openClub(clubId);
      } catch (e) {
        console.error("markClubBookFinished error:", e);
        if (typeof App.showToast === 'function') App.showToast('Could not move book.');
      }
    }
  },
  castClubVote(clubId, bookId) {
    if (!App._clubVotes) App._clubVotes = {};
    App._clubVotes[clubId] = bookId; App._forceMenuOpen = clubId;
    const _voteEl = document.getElementById('clubVoteZone-' + clubId);
    if (_voteEl) {
      App._renderVotingSection(_voteEl, { id: clubId, isPublic: false });
    }
    if (typeof App.showToast === 'function') App.showToast('🗳️ Vote recorded!');
  },

  handleClubSuggestSearch(query, clubId) {
    const dropdown = document.getElementById('suggestDropdown-' + clubId);
    if (!dropdown) return;
    const q = (query || '').toLowerCase().trim();
    if (!q) {
      dropdown.style.display = 'none';
      dropdown.innerHTML = '';
      return;
    }
    const curApp = (this && this.books) ? this : ((typeof window !== 'undefined' && window.App) ? window.App : App);
    let allBooks = (curApp && curApp.books && curApp.books.length) ? curApp.books : ((typeof window !== 'undefined' && window._BOOKS) ? window._BOOKS : []);
    if (!allBooks || !allBooks.length) {
      allBooks = [
        { title: 'Dark Matter', author: 'Blake Crouch', cover_url: '' },
        { title: 'Dune', author: 'Frank Herbert', cover_url: '' },
        { title: 'Hyperion', author: 'Dan Simmons', cover_url: '' },
        { title: 'Project Hail Mary', author: 'Andy Weir', cover_url: '' }
      ];
    }
    const seen = new Set();
    const matches = [];
    for (const b of allBooks) {
      if (!b || !b.title) continue;
      const key = b.title.toLowerCase();
      if (seen.has(key)) continue;
      if (b.title.toLowerCase().includes(q) || (b.author && b.author.toLowerCase().includes(q))) {
        seen.add(key);
        matches.push(b);
        if (matches.length >= 5) break;
      }
    }
    if (matches.length === 0 && q.length >= 2) {
      matches.push({ title: query, author: 'Custom Suggestion', cover_url: '' });
    }
    if (matches.length === 0) {
      dropdown.innerHTML = '<div style="padding: 8px; font-size: 10px; color: var(--wood-light); text-align: center;">No matching books. Type title and click Send.</div>';
      dropdown.style.display = 'block';
      return;
    }
    dropdown.innerHTML = matches.map(b => {
      const titleEsc = (b.title || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const authorEsc = (b.author || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const coverEsc = (b.cover_url || b.coverUrl || b.cover || '').replace(/'/g, "\\'");
      return `
        <div style="padding: 6px 8px; font-size: 10px; color: var(--wood-dark); cursor: pointer; border-bottom: 1px solid rgba(0,0,0,0.05); display: flex; align-items: center; gap: 6px;" 
             onclick="App._selectClubSuggestBook('${clubId}', '${titleEsc}', '${authorEsc}', '${coverEsc}')">
          <div style="font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;">${b.title}</div>
          <div style="font-size: 8.5px; color: var(--wood-mid); white-space: nowrap;">${b.author || ''}</div>
        </div>
      `;
    }).join('');
    dropdown.style.display = 'block';
  },

  _selectClubSuggestBook(clubId, title, author, cover) {
    const input = document.getElementById('suggestInput-' + clubId);
    if (input) {
      input.value = title;
      input._suggestData = { title, author, cover_url: cover };
    }
    const dropdown = document.getElementById('suggestDropdown-' + clubId);
    if (dropdown) {
      dropdown.style.display = 'none';
    }
  },

  suggestClubBook(clubId) {
    const input = document.getElementById('suggestInput-' + clubId);
    if (!input || !input.value.trim()) {
      if (typeof App.showToast === 'function') App.showToast('Please enter a book title to suggest.');
      return;
    }
    const val = input.value.trim();
    const data = input._suggestData || { title: val, author: '', cover_url: '' };
    
    if (!App._clubSuggestions) App._clubSuggestions = {};
    if (!App._clubSuggestions[clubId]) App._clubSuggestions[clubId] = [];

    const exists = (App._clubVotingCandidates && App._clubVotingCandidates[clubId] && App._clubVotingCandidates[clubId].some(c => (c.title || '').toLowerCase() === val.toLowerCase()));
    const suggExists = App._clubSuggestions[clubId].some(c => (c.title || '').toLowerCase() === val.toLowerCase());

    if (!exists && !suggExists) {
      App._clubSuggestions[clubId].unshift({
        id: 'sug_' + Date.now(),
        title: data.title || val,
        author: data.author || '',
        cover_url: data.cover_url || ''
      });
    }

    input.value = '';
    input._suggestData = null;
    const dropdown = document.getElementById('suggestDropdown-' + clubId);
    if (dropdown) dropdown.style.display = 'none';

    const _voteEl = document.getElementById('clubVoteZone-' + clubId);
    if (_voteEl) {
      App._renderVotingSection(_voteEl, { id: clubId, isPublic: false });
    }
    if (typeof App.showToast === 'function') App.showToast('💡 Suggestion added to voting options!');
  },

  async initCommunityBell() {
    const btn = document.getElementById('communityBellBtn');
    if (btn) btn.style.display = 'inline-flex';
    const dot = document.getElementById('communityBellDot');

    // Keep hidden while the Community modal is currently open
    const modal = document.getElementById('communityModal');
    if (modal && modal.classList.contains('open')) {
      if (dot) dot.style.display = 'none';
      return;
    }

    if (!this.userId || this.isDemoMode || this.isReadOnly) {
      if (dot) dot.style.display = 'none';
      return;
    }

    try {
      const feed = await DB.getSocialFeed({ limit: 12 });
      const others = (feed || []).filter(a => a.user_id !== this.userId);
      if (!others.length) {
        if (dot) dot.style.display = 'none';
        return;
      }

      const newestItem = others[0];
      const newestTime = new Date(newestItem.created_at).getTime();
      this._newestFeedId = newestItem.id;
      this._newestFeedTime = isNaN(newestTime) ? 0 : newestTime;

      const lastSeenTime = parseInt(localStorage.getItem('sl_community_lastseen') || '0', 10) || 0;
      const lastSeenId = localStorage.getItem('sl_community_lastseen_id') || this._lastSeenFeedId || '';

      const isSameAsLastSeen = Boolean(lastSeenId && newestItem.id && lastSeenId === String(newestItem.id));
      const isNewer = !isNaN(newestTime) && (newestTime > lastSeenTime);

      const shouldShowDot = !isSameAsLastSeen && isNewer;
      if (dot) dot.style.display = shouldShowDot ? 'block' : 'none';
    } catch (e) {
      console.warn('[communityBell] failed:', e);
    }
  },
  _readerSignature(books) {
    const genres = new Set(), authors = new Set(), moods = new Set();
    (books || []).forEach(b => {
      if (b.genre) genres.add(String(b.genre).toLowerCase().trim());
      if (b.author) authors.add(String(b.author).toLowerCase().trim());
      const ms = Array.isArray(b.moods) ? b.moods : (Array.isArray(b.mood) ? b.mood : []);
      ms.forEach(m => { if (m) moods.add(String(m).toLowerCase().trim()); });
    });
    return { genres, authors, moods };
  },
  _similarity(a, b) {
    const overlap = (s1, s2) => { const out = []; s1.forEach(x => { if (s2.has(x)) out.push(x); }); return out; };
    const union = (s1, s2) => new Set([...s1, ...s2]).size || 1;
    const gShared = overlap(a.genres, b.genres);
    const auShared = overlap(a.authors, b.authors);
    const mShared = overlap(a.moods, b.moods);
    const gJ = gShared.length / union(a.genres, b.genres);
    const auJ = auShared.length / union(a.authors, b.authors);
    const mJ = mShared.length / union(a.moods, b.moods);
    const score = Math.round((gJ * 0.4 + auJ * 0.35 + mJ * 0.25) * 100);
    return { score, genres: gShared, authors: auShared, moods: mShared };
  },
  async openClubShelf(clubId) {
    if (typeof App.closeModal === 'function') App.closeModal('communityModal');
    
    if (!App._userBooksBackup) {
      App._userBooksBackup = App.books || [];
    }
    if (!App._userYearsBackup) {
      App._userYearsBackup = App.userYears || [];
    }
    if (!App._userMultiYearBackup) {
      App._userMultiYearBackup = App.multiYearRange || 'single';
    }
    App.multiYearRange = 'single';
    if (typeof App._showAnnualView === 'function') {
      App._showAnnualView();
    }

    let clubName = 'Reading Club';
    let currentBook = null;
    let currentAuthor = null;
    let currentCover = null;
    
    let clubData = null;
    try {
      const isDemo = App.isDemoMode || (typeof clubId === 'string' && clubId.startsWith('mock_'));
      if (isDemo && typeof clubId === 'string' && clubId.startsWith('mock_')) {
        clubName = clubId === 'mock_c1' ? 'Sci-Fi Sundays' : 'The Classics';
        currentBook = clubId === 'mock_c1' ? 'Dune' : '1984';
        currentAuthor = clubId === 'mock_c1' ? 'Frank Herbert' : 'George Orwell';
        clubData = {
          id: clubId,
          name: clubName,
          current_book_title: currentBook,
          current_book_author: currentAuthor,
          past_reads: clubId === 'mock_c1' ? [
            { title: "Dune", author: "Frank Herbert", date: "2026-01", words: 180000, genre: "Sci-Fi", coverUrl: "https://covers.openlibrary.org/b/id/8259431-M.jpg", readYear: 2026 },
            { title: "Neuromancer", author: "William Gibson", date: "2026-02", words: 90000, genre: "Cyberpunk", coverUrl: "https://covers.openlibrary.org/b/id/123456-M.jpg", readYear: 2026 },
            { title: "Project Hail Mary", author: "Andy Weir", date: "2025-08", words: 140000, genre: "Sci-Fi", coverUrl: "https://covers.openlibrary.org/b/id/111111-M.jpg", readYear: 2025 }
          ] : [
            { title: "1984", author: "George Orwell", date: "2026-01", words: 88000, genre: "Classics", readYear: 2026 },
            { title: "Brave New World", author: "Aldous Huxley", date: "2024-05", words: 70000, genre: "Classics", readYear: 2024 }
          ]
        };
      } else if (window.DB && typeof window._supabase !== 'undefined') {
        const { data } = await window._supabase.from('clubs').select('*').eq('id', clubId).single();
        if (data) {
          clubData = data;
          clubName = data.name;
          currentBook = data.current_book_title;
          currentAuthor = data.current_book_author;
          currentCover = data.current_book_cover;
        }
      }
    } catch(e) {
      console.warn("Could not fetch club details for shelf:", e);
    }

    let clubBooks = [];
    if (window.DB && typeof window.DB.getClubBooks === 'function') {
      try {
        clubBooks = await window.DB.getClubBooks(clubId);
      } catch(e) {
        console.warn("getClubBooks error:", e);
      }
    }

    // Merge past_reads if present on club record
    if (clubData && Array.isArray(clubData.past_reads)) {
      clubData.past_reads.forEach((pr, idx) => {
        if (!clubBooks.some(b => b.title && b.title.toLowerCase().trim() === (pr.title || '').toLowerCase().trim())) {
          let prYear = (typeof getBookReadYear === 'function' ? getBookReadYear(pr) : null) || pr.readYear || pr.year;
          if (!prYear && pr.date) {
            const m = String(pr.date).match(/\b(19\d\d|20\d\d)\b/);
            if (m) prYear = parseInt(m[1], 10);
          }
            let dispTitle = pr.title || 'Untitled';
            let dispAuthor = pr.author || '';
            if (!dispAuthor && dispTitle.includes(' by ')) {
                const parts = dispTitle.split(' by ');
                dispAuthor = parts.pop().trim();
                dispTitle = parts.join(' by ').trim();
            }
            if (!dispAuthor) dispAuthor = 'Unknown';
            clubBooks.push({
              id: 'club_pr_' + idx + '_' + (pr.id || idx),
              title: dispTitle,
              author: dispAuthor,
            author: pr.author || 'Unknown',
            coverUrl: pr.coverUrl || pr.cover_url || pr.cover || '',
            cover: pr.coverUrl || pr.cover_url || pr.cover || '',
            pages: pr.pages || 320,
            words: pr.words || 80000,
            year: pr.pub_year || prYear || new Date().getFullYear(),
            readYear: prYear || new Date().getFullYear(),
            month: pr.month || 'January',
            days: pr.days || 6,
            sentiment: pr.sentiment || 'love',
            status: 'read'
          });
        }
      });
    }
    
    // Check if there are any finished/read books on this shelf
    const hasFinishedBooks = clubBooks.some(b => b.status === 'read' || b.status === 'finished');
    
    // Fallback mock data for any club (real or demo) so the shelf isn't empty
    if (!hasFinishedBooks) {
      const mockTitles = ['Project Hail Mary', 'The Martian', 'Foundation', 'Neuromancer', 'Snow Crash', 'Hyperion'];
      const mockAuthors = ['Andy Weir', 'Andy Weir', 'Isaac Asimov', 'William Gibson', 'Neal Stephenson', 'Dan Simmons'];
      const mockMonths = ['January', 'February', 'March', 'April', 'May', 'June'];
      for (let i = 0; i < mockTitles.length; i++) {
        clubBooks.push({
          id: 'mock_club_' + i,
          title: mockTitles[i],
          author: mockAuthors[i],
          pages: 350,
          words: 90000,
          year: new Date().getFullYear(),
          readYear: new Date().getFullYear(),
          month: mockMonths[i % mockMonths.length],
          status: 'read',
          days: 8 + Math.floor(Math.random() * 8),
          sentiment: Math.random() > 0.5 ? 'love' : 'like',
          _clubReviews: [
            { reviewerName: 'Alice', text: "I absolutely couldn't put this down! A must read.", sentiment: 'love' },
            { reviewerName: 'Bob', text: 'Thought the pacing was a bit slow in the middle.', sentiment: 'mixed' },
            { reviewerName: 'Charlie', text: 'Solid.', sentiment: 'like' }
          ]
        });
      }
    }
    
    // Ensure the current pick is at the top/active if it exists
    if (currentBook) {
      // Check if it's already in the clubBooks array (maybe a member logged it as 'reading')
      const existingIdx = clubBooks.findIndex(b => b.title.toLowerCase().trim() === currentBook.toLowerCase().trim());
      if (existingIdx !== -1) {
        // Force it to be currentlyReading
        clubBooks[existingIdx].status = 'reading';
        clubBooks[existingIdx].currentlyReading = true;
      } else {
        clubBooks.push({
          id: 'club_cr_' + clubId,
          title: currentBook,
          author: currentAuthor || 'Unknown',
          coverUrl: currentCover,
          pages: 350,
          words: 90000,
          year: new Date().getFullYear(),
          readYear: new Date().getFullYear(),
          status: 'reading',
          currentlyReading: true
        });
      }
    }

    App.books = clubBooks;
    App.isReadOnly = true;

    const clubYears = [...new Set(clubBooks.map(b => (typeof getBookReadYear === 'function' ? getBookReadYear(b) : null) || b.readYear || b.year).filter(y => y && y >= 1900 && y <= 2100))].sort((a, b) => b - a);
    if (clubYears.length > 0) {
      App.userYears = clubYears.map(y => ({ year: y }));
      if (!clubYears.includes(Number(App.currentYear))) {
        App.currentYear = clubYears[0];
        const yrInp = document.getElementById('yearInput');
        if (yrInp) yrInp.value = App.currentYear;
        const yrWm = document.getElementById('yearWatermark');
        if (yrWm) yrWm.textContent = App.currentYear;
      }
      if (typeof App.renderYearsList === 'function') App.renderYearsList();
    }

    if (typeof App.switchTab === 'function') App.switchTab('home');
    const header = document.getElementById('booksHeader');
    if (header) header.textContent = clubName + ' Shelf';
    
    // Update Masthead Eyebrow
    const brandEl = document.getElementById('brandTitle');
    if (brandEl) {
      brandEl.textContent = `${clubName} \u25CF Club Shelf`;
      document.title = `${clubName} \u25CF Club Shelf`;
    }
    
    const readOnlyBadge = document.getElementById('readOnlyBadge');
    if (readOnlyBadge) readOnlyBadge.style.display = 'inline-block';
    
    const returnBtn = document.getElementById('returnHomeBtn');
    if (returnBtn) {
      returnBtn.style.display = 'inline-block';
      returnBtn.innerHTML = '&#8592; Exit Club Shelf';
      returnBtn.style.background = '#e74c3c'; // Make it pop visually
      returnBtn.onclick = () => {
        if (typeof App.exitClubShelf === 'function') App.exitClubShelf();
      };
    }

    if (typeof App.render === 'function') App.render();
    
    App.showToast(clubName + ' shelf loaded.');
  },
  exitClubShelf() {
    if (App._userBooksBackup) {
      App.books = App._userBooksBackup;
      App._userBooksBackup = null;
    } else if (!App.books || App.books.length === 0) {
      if (typeof getDemoBooks === 'function') App.books = getDemoBooks();
    }
    if (App._userYearsBackup) {
      App.userYears = App._userYearsBackup;
      App._userYearsBackup = null;
      if (typeof App.renderYearsList === 'function') App.renderYearsList();
    }
    if (App._userMultiYearBackup) {
      const prevRange = App._userMultiYearBackup;
      App._userMultiYearBackup = null;
      if (prevRange !== 'single' && typeof App.setMultiYearRange === 'function') {
        App.setMultiYearRange(prevRange);
      }
    }
    App.isReadOnly = false;
    if (App._userShelfBackup) {
      App.currentShelf = App._userShelfBackup;
      App._userShelfBackup = null;
    }
    if (window.location.hash && window.location.hash.startsWith('#shelf/')) {
      try {
        history.replaceState(null, '', window.location.pathname + window.location.search);
      } catch (e) {}
      window.location.hash = '';
    }
    const fabA = document.getElementById('fabAdd');
    if (fabA) {
      fabA.style.display = 'flex';
      fabA.classList.remove('return-shelf-mode');
      fabA.setAttribute('title', 'Add a book');
      fabA.setAttribute('aria-label', 'Add a book');
      const plusBadge = document.getElementById('spinePlusBadge');
      if (plusBadge) plusBadge.textContent = '＋';
      const headline = document.getElementById('spineHeadlineText');
      if (headline) headline.textContent = 'ADD BOOK';
      const edition = document.getElementById('spineEditionLabel');
      if (edition) edition.textContent = 'VOL. ' + (App.currentYear || 2026);
    }
    const accBtn = document.getElementById('accountBtn');
    if (accBtn) accBtn.style.display = 'flex';
    const userBubble = document.getElementById('mastheadUserBubble');
    if (userBubble && (App._userBubbleWasVisible || App.displayName || App.userId)) userBubble.style.display = 'inline-flex';
    const rb = document.getElementById('readOnlyBadge');
    if (rb) rb.style.display = 'none';
    const returnBtn = document.getElementById('returnHomeBtn');
    if (returnBtn) returnBtn.style.display = 'none';
    const bh = document.getElementById('booksHeader');
    if (bh) bh.textContent = 'My Shelf';
    const brandEl = document.getElementById('brandTitle');
    if (brandEl) brandEl.textContent = 'ShelfLife';
    document.title = 'ShelfLife';
    if (typeof App.updateBrandTitle === 'function') App.updateBrandTitle();
    if (typeof App.updateMastheadTitle === 'function') App.updateMastheadTitle();
    if (typeof App.render === 'function') App.render();
    if (typeof App.showToast === 'function') App.showToast('Returned to personal shelf');
  },
  async deleteClubMessage(clubId, msgId) {
    if (!confirm("Delete this message?")) return;
    const ok = await DB.deleteClubMessage(msgId);
    if (ok) {
      App.openClub(clubId);
    } else {
      App.showToast("Failed to delete message.");
    }
  },

  async editClubName(clubId, currentName) {
    if (clubId && typeof clubId === 'object' && clubId.dataset) {
      const el = clubId;
      clubId = el.dataset.clubId || '';
      currentName = el.dataset.clubName || '';
    }
    const newName = prompt("Enter new club name:", currentName);
    if (!newName || newName.trim() === '' || newName === currentName) return;
    const ok = await DB.updateClubName(clubId, newName.trim());
    if (ok) {
      if (typeof App.showToast === 'function') App.showToast("Club name updated!");
      App._currentClub = null; 
      App.openClub(clubId);
    } else {
      if (typeof App.showToast === 'function') App.showToast("Could not update club name");
    }
  },

  async leaveClub(clubId) {
    if (!clubId) return;
    if (confirm("Are you sure you want to leave this club?")) {
      if (App.isDemoMode || !_supabase || String(clubId).startsWith('mock_')) {
        if (typeof window !== 'undefined' && window._mockClubs) {
          const c = window._mockClubs.find(x => x.id === clubId);
          if (c) { c.myRole = 'none'; c.isPublic = true; }
        }
        if (App._joinedClubs) App._joinedClubs.delete(clubId);
        if (typeof App.showToast === 'function') App.showToast('Left club.');
        App.renderClubs();
        return;
      }
      try {
        const success = await DB.removeClubMember(clubId, App.userId);
        if (success) {
          if (App._joinedClubs) App._joinedClubs.delete(clubId);
          if (typeof App.showToast === 'function') App.showToast('Left club.');
          App.renderClubs();
        } else {
          if (typeof App.showToast === 'function') App.showToast('Could not leave club');
        }
      } catch(e) {
        if (typeof App.showToast === 'function') App.showToast('Could not leave club');
      }
    }
  },

  async joinClub(clubId) {
    if (!clubId) return;
    App._joinedClubs = App._joinedClubs || new Set();
    App._joinedClubs.add(clubId);

    const currentUserId = App.userId || 'u3';
    const currentUserName = App.userProfile?.display_name || App.userName || 'You';
    const currentUserAvatar = App.userProfile?.avatar_emoji || App.userAvatar || '🤠';

    if (App.isDemoMode || !_supabase || String(clubId).startsWith('mock_')) {
      if (typeof App.showToast === 'function') App.showToast('Joined club!');
      if (typeof window !== 'undefined' && window._mockClubs) {
        const c = window._mockClubs.find(x => x.id === clubId);
        if (c) { c.myRole = 'member'; c.isPublic = false; }
      }
      if (typeof window !== 'undefined') {
        window._mockClubMembers = window._mockClubMembers || {};
        window._mockClubMembers[clubId] = window._mockClubMembers[clubId] || [
          { user_id: 'u1', role: 'member', user_profiles: { display_name: 'Alex Reader', avatar_emoji: '👽' } },
          { user_id: 'u2', role: 'member', user_profiles: { display_name: 'Jordan Pages', avatar_emoji: '🤖' } }
        ];
        if (!window._mockClubMembers[clubId].some(m => String(m.user_id) === String(currentUserId))) {
          window._mockClubMembers[clubId].push({
            user_id: currentUserId,
            role: 'member',
            user_profiles: { display_name: currentUserName, avatar_emoji: currentUserAvatar }
          });
        }
      }
      App._currentClub = null;
      if (typeof App.openClub === 'function') App.openClub(clubId);
      return;
    }

    if (!App.userId) {
      try {
        localStorage.setItem('sl_pending_club_invite', clubId);
      } catch (e) {}
      if (typeof window !== 'undefined' && window.Auth && typeof window.Auth.showAuthScreen === 'function') {
        window.Auth.showAuthScreen();
      }
      if (typeof App.showToast === 'function') App.showToast('Please sign in to join this club');
      return;
    }

    try {
      const club = await DB.joinClub(clubId, App.userId);
      if (club) {
        if (typeof App.showToast === 'function') App.showToast(`Joined ${club.name || 'club'}!`);
        App._currentClub = null;
        if (typeof App.openClub === 'function') await App.openClub(club.id || clubId);
      } else {
        if (typeof App.showToast === 'function') App.showToast('Could not join club');
      }
    } catch(e) {
      console.error('App.joinClub error:', e);
      if (typeof App.showToast === 'function') App.showToast('Could not join club');
    }
  },

  async joinClubByCode(code) {
    const input = document.getElementById('clubJoinCodeInput');
    const c = code || (input ? input.value.trim() : '');
    const msgEl = document.getElementById('clubJoinMsg');
    if (!c) {
      if (msgEl) msgEl.textContent = 'Please enter an invite code.';
      return;
    }
    try {
      const club = await DB.joinClubByCode(c, App.userId);
      if (club) {
        if (input) input.value = '';
        if (msgEl) msgEl.textContent = '';
        if (typeof App.showToast === 'function') App.showToast(`Joined ${club.name || 'club'}!`);
        App._currentClub = null;
        if (typeof App.openClub === 'function') App.openClub(club.id);
      } else {
        if (msgEl) msgEl.textContent = 'Invalid code - double-check with your club admin.';
      }
    } catch (e) {
      if (msgEl) msgEl.textContent = 'Could not join club.';
    }
  },

  async joinPublicClub(codeOrId) {
    if (!codeOrId) return;
    return this.joinClub(codeOrId);
  },

  _copyInviteCode(code) {
    if (!code) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(() => {
        if (typeof App.showToast === 'function') App.showToast('Invite code copied!');
      }).catch(() => {
        if (typeof App.showToast === 'function') App.showToast('Code: ' + code);
      });
    } else {
      if (typeof App.showToast === 'function') App.showToast('Code: ' + code);
    }
  },

  async saveClubThumbnail(clubId, thumbUrl) {
    if (!clubId) return;
    const cleanUrl = (thumbUrl || '').trim();
    if (App.isDemoMode || !_supabase || String(clubId).startsWith('mock_')) {
      if (typeof window !== 'undefined' && window._mockClubs) {
        const c = window._mockClubs.find(x => x.id === clubId);
        if (c) {
          const clean = (c.description || '').replace(/\[thumb:.*?\]/g, '').replace(/https?:\/\/\S+/g, '').trim();
          c.description = cleanUrl ? `[thumb:${cleanUrl}] ${clean}` : clean;
        }
      }
      if (typeof App.showToast === 'function') App.showToast('Club thumbnail updated!');
      App._currentClub = null;
      if (typeof App.openClub === 'function') App.openClub(clubId);
      return;
    }
    try {
      let currentDesc = '';
      if (_supabase) {
        const { data: dbClub } = await _supabase.from('clubs').select('description').eq('id', clubId).maybeSingle();
        if (dbClub && dbClub.description) currentDesc = dbClub.description;
      }
      if (!currentDesc) {
        const clubs = await DB.getMyClubs(App.userId);
        const club = (clubs || []).find(c => c.id === clubId);
        if (club && club.description) currentDesc = club.description;
      }
      const clean = currentDesc.replace(/\[thumb:.*?\]/g, '').replace(/https?:\/\/\S+/g, '').trim();
      const updatedDesc = cleanUrl ? `[thumb:${cleanUrl}] ${clean}` : clean;
      await DB.updateClubDescription(clubId, updatedDesc);
      if (typeof App.showToast === 'function') App.showToast('Club thumbnail updated!');
      App._currentClub = null;
      if (typeof App.openClub === 'function') App.openClub(clubId);
    } catch (e) {
      console.error('saveClubThumbnail error:', e);
      if (typeof App.showToast === 'function') App.showToast('Could not save thumbnail');
    }
  },

  async saveClubDescription(clubId, newDesc) {
    if (!clubId) return;
    const desc = (newDesc || '').trim();
    if (App.isDemoMode || !_supabase || String(clubId).startsWith('mock_')) {
      if (typeof window !== 'undefined' && window._mockClubs) {
        const c = window._mockClubs.find(x => x.id === clubId);
        if (c) {
          const thumbMatch = (c.description || '').match(/\[thumb:(.*?)\]/);
          c.description = thumbMatch ? `[thumb:${thumbMatch[1]}] ${desc}` : desc;
        }
      }
      if (typeof App.showToast === 'function') App.showToast('Club description updated!');
      App._currentClub = null;
      if (typeof App.openClub === 'function') App.openClub(clubId);
      return;
    }
    try {
      let currentDesc = '';
      if (_supabase) {
        const { data: dbClub } = await _supabase.from('clubs').select('description').eq('id', clubId).maybeSingle();
        if (dbClub && dbClub.description) currentDesc = dbClub.description;
      }
      if (!currentDesc) {
        const clubs = await DB.getMyClubs(App.userId);
        const club = (clubs || []).find(c => c.id === clubId);
        if (club && club.description) currentDesc = club.description;
      }
      const thumbMatch = currentDesc.match(/\[thumb:(.*?)\]/);
      const updatedDesc = thumbMatch ? `[thumb:${thumbMatch[1]}] ${desc}` : desc;
      await DB.updateClubDescription(clubId, updatedDesc);
      if (typeof App.showToast === 'function') App.showToast('Club description updated!');
      App._currentClub = null;
      if (typeof App.openClub === 'function') App.openClub(clubId);
    } catch (e) {
      console.error('saveClubDescription error:', e);
      if (typeof App.showToast === 'function') App.showToast('Could not save description');
    }
  },

  async toggleClubVisibility(clubId, isPublic) {
    if (!clubId) return;
    if (App.isDemoMode || !_supabase || String(clubId).startsWith('mock_')) {
      if (typeof window !== 'undefined' && window._mockClubs) {
        const c = window._mockClubs.find(x => x.id === clubId);
        if (c) {
          c.isPublic = !!isPublic;
          c.invite_code = isPublic ? ('PUBLIC_' + Math.random().toString(36).substring(2,6).toUpperCase()) : (c.invite_code || Math.random().toString(36).substring(2,6).toUpperCase());
        }
      }
      if (typeof App.showToast === 'function') App.showToast('Club visibility updated!');
      return;
    }
    try {
      const newCode = isPublic ? ('PUBLIC_' + Math.random().toString(36).substring(2,6).toUpperCase()) : Math.random().toString(36).substring(2,6).toUpperCase();
      await DB.updateClubVisibility(clubId, isPublic, newCode);
      if (typeof App.showToast === 'function') App.showToast('Club visibility updated!');
    } catch (e) {
      console.error('toggleClubVisibility error:', e);
    }
  },

  showCreateClubForm() {
    const f = document.getElementById('createClubForm');
    if (f) {
      f.style.display = (f.style.display === 'none' || f.style.display === '') ? 'block' : 'none';
    }
  },

  async createClub() {
    const nameInput = document.getElementById('clubNameInput');
    const descInput = document.getElementById('clubDescInput');
    const name = (nameInput?.value || '').trim();
    if (!name) {
      if (typeof App.showToast === 'function') App.showToast('Enter a club name');
      return;
    }
    const desc = (descInput?.value || '').trim();
    try {
      const club = await DB.createClub(name, desc, App.userId || 'demo_user');
      if (club && club.id) {
        if (typeof App.showToast === 'function') App.showToast('🏛 Club created!');
        App._clubsTab = 'private';
        if (nameInput) nameInput.value = '';
        if (descInput) descInput.value = '';
        const f = document.getElementById('createClubForm');
        if (f) f.style.display = 'none';
        // Automatically navigate to the newly created club view
        if (typeof App.openClub === 'function') {
          await App.openClub(club.id);
        }
      } else {
        if (typeof App.showToast === 'function') App.showToast('Could not create club');
      }
    } catch (e) {
      console.error('createClub error:', e);
      if (typeof App.showToast === 'function') App.showToast('Could not create club');
    }
  },

  async submitCreateClub() {
    return this.createClub();
  }
};

// Global Browser Bindings
if (typeof window !== 'undefined') {
  window.CommunityFeatures = CommunityFeatures;
  window.App = window.App || {};
  Object.assign(window.App, CommunityFeatures);
  window.joinClub = (id) => (window.App && typeof window.App.joinClub === 'function' ? window.App.joinClub(id) : null);
  window.joinClubByCode = (code) => (window.App && typeof window.App.joinClubByCode === 'function' ? window.App.joinClubByCode(code) : null);
  window.joinPublicClub = (id) => (window.App && typeof window.App.joinPublicClub === 'function' ? window.App.joinPublicClub(id) : null);
  window.openClub = (id) => (window.App && typeof window.App.openClub === 'function' ? window.App.openClub(id) : null);
  window.createClub = () => (window.App && typeof window.App.createClub === 'function' ? window.App.createClub() : null);
  window.submitCreateClub = () => (window.App && typeof window.App.submitCreateClub === 'function' ? window.App.submitCreateClub() : null);
  window.showCreateClubForm = () => (window.App && typeof window.App.showCreateClubForm === 'function' ? window.App.showCreateClubForm() : null);
}





// Global click listener to close popover menus
if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => { if (!document.documentElement.contains(e.target)) return; document.querySelectorAll('[id^="voteMenu-"], [id^="pastMenu-"]').forEach(menu => {
      if (menu.style.display !== 'none') {
        const button = menu.previousElementSibling;
        if (!menu.contains(e.target) && (!button || !button.contains(e.target))) {
          menu.style.display = 'none';
        }
      }
    });
  });
}




if (typeof App !== 'undefined') {
  App.formatChatDate = formatChatDate;
  App.getChatDayKey = getChatDayKey;
  App.renderDateDivider = renderDateDivider;
  App._appendClubMessage = _appendClubMessage;
  App.openClub = openClub;
  App.sendClubMessage = sendClubMessage;
}
if (typeof window !== 'undefined' && window.App) {
  window.App.formatChatDate = formatChatDate;
  window.App.getChatDayKey = getChatDayKey;
  window.App.renderDateDivider = renderDateDivider;
  window.App._appendClubMessage = _appendClubMessage;
  window.App.openClub = openClub;
  window.App.sendClubMessage = sendClubMessage;
}
if (typeof window !== 'undefined') {
  window.openClub = (id) => (window.App && typeof window.App.openClub === 'function' ? window.App.openClub(id) : openClub(id));
  window.formatChatDate = formatChatDate;
  window.getChatDayKey = getChatDayKey;
  window.renderDateDivider = renderDateDivider;
}
