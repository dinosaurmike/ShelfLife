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

export const CommunityClubs = {
  formatChatDate,
  getChatDayKey,
  renderDateDivider,
  _formatChatDate: formatChatDate,
  _getChatDayKey: getChatDayKey,
  _renderDateDivider: renderDateDivider,
  _appendClubMessage,
  openClub,
  sendClubMessage,
  showCreateClubForm() {
    const f = document.getElementById('createClubForm');
    if (f) {
      f.style.display = (f.style.display === 'none' || f.style.display === '') ? 'block' : 'none';
      return;
    }
    if (typeof App.closeModal === "function") App.closeModal("communityModal");
    App._modalZIndex = (App._modalZIndex || 2000000000) + 1;
    const modalHTML = `
      <style>#createClubModal.modal-overlay.open { z-index: 999999 !important; }</style><div class="modal-overlay open" id="createClubModal" onclick="if(event.target===this) this.remove()" style="z-index:${App._modalZIndex}">
        <div class="modal-card" style="max-width: 400px; padding: 24px;">
          <h2 style="font-family:'Newsreader', serif; font-size: 24px; color: var(--wood-dark); margin-bottom: 16px;">Create a Reading Club</h2>
          <input type="text" id="newClubName" placeholder="Club Name" style="width: 100%; padding: 12px; margin-bottom: 12px; border: 1px solid rgba(61,43,31,0.2); border-radius: 8px; font-family: inherit; font-size: 14px; box-sizing: border-box;" autocomplete="off">
          <textarea id="newClubDesc" placeholder="Description (optional)" style="width: 100%; padding: 12px; margin-bottom: 20px; border: 1px solid rgba(61,43,31,0.2); border-radius: 8px; font-family: inherit; font-size: 14px; min-height: 80px; resize: vertical; box-sizing: border-box;"></textarea>
          <div style="display: flex; gap: 12px; justify-content: flex-end;">
            <button onclick="document.getElementById('createClubModal').remove()" class="btn-secondary" style="padding: 10px 20px;">Cancel</button>
            <button onclick="App.submitCreateClub()" class="btn-primary" style="padding: 10px 20px;">Create</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    setTimeout(() => {
      const el = document.getElementById('newClubName');
      if (el) el.focus();
    }, 100);
  },

  async createClub() {
    return this.submitCreateClub();
  },

  async submitCreateClub() {
    const nameEl = document.getElementById('clubNameInput') || document.getElementById('newClubName');
    const descEl = document.getElementById('clubDescInput') || document.getElementById('newClubDesc');
    if (!nameEl) return;
    const name = nameEl.value.trim();
    const desc = descEl ? descEl.value.trim() : '';
    
    if (!name) {
      if (typeof App.showToast === 'function') App.showToast('Please enter a club name.');
      return;
    }
    
    const loadingModal = document.getElementById('createClubModal');
    if (loadingModal) {
      loadingModal.innerHTML = '<div class="modal-card" style="padding:40px; text-align:center;">Creating club...</div>';
    }
    
    const club = await DB.createClub(name, desc, App.userId || 'demo_user');
    const modal = document.getElementById('createClubModal');
    if (modal) modal.remove();
    
    const f = document.getElementById('createClubForm');
    if (f) f.style.display = 'none';
    if (nameEl) nameEl.value = '';
    if (descEl) descEl.value = '';

    if (club && club.id) {
      if (typeof App.showToast === 'function') App.showToast('Club created!');
      if (typeof this.openClub === 'function') {
        await this.openClub(club.id);
      } else if (typeof App.openClub === 'function') {
        await App.openClub(club.id);
      } else if (typeof this.renderClubs === 'function') {
        this.renderClubs();
      }
      return club;
    } else {
      if (typeof App.showToast === 'function') App.showToast('Failed to create club.');
    }
  },

  async renderClubs() {
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
      
      if (!isPublic && App.clubs && App.clubs.length > 0) {
        clubs = App.clubs;
        // Background refresh
        DB.getMyClubs(App.userId).then(freshClubs => {
            if (JSON.stringify(freshClubs) !== JSON.stringify(App.clubs)) {
                App.clubs = freshClubs;
                if (App._commTab === 'clubs' && App._clubsTab !== 'public') App.renderClubs();
            }
        });
      } else {
        clubs = isPublic ? await DB.getPublicClubs() : await DB.getMyClubs(App.userId);
        if (!isPublic) App.clubs = clubs;
      }
    
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
        <button class="club-create-btn" onclick="event.stopPropagation(); App.showCreateClubForm()" title="Create a new Reading Club" style="flex:1; margin-bottom:0; height:40px; display:flex; align-items:center; justify-content:center; white-space:nowrap; padding:0 12px; font-size:13px; font-weight:600;">+ Create</button>
        <div class="club-join-row" style="flex:2; display:flex; gap:6px; margin-bottom:0; height:40px;">
          <input class="club-join-input" id="clubJoinCodeInput" placeholder="Invite code..." maxlength="10" title="Enter a 10-character invite code" style="flex:1; margin-bottom:0; height:40px; box-sizing:border-box;">
          <button class="club-msg-send" onclick="event.stopPropagation(); App.joinClubByCode()" title="Join Club by Code" style="height:40px; margin-bottom:0;">Join</button>
        </div>
      </div>
      <div id="clubJoinMsg" style="font-size:11px;color:var(--dislike);min-height:14px;margin-bottom:6px;margin-top:-10px;text-align:right;"></div>
    `;

    const tabsHtml = `
      <div style="display:flex; gap:8px; margin-bottom:16px;">
        <button onclick="event.stopPropagation(); App._clubsTab='private';App.renderClubs()" style="flex:1; padding:8px; border-radius:8px; border:1px solid ${!isPublic ? 'var(--wood-dark)' : 'rgba(61,43,31,0.2)'}; background:${!isPublic ? 'var(--wood-dark)' : 'transparent'}; color:${!isPublic ? '#fff' : 'var(--wood-dark)'}; font-size:12px; font-weight:600; cursor:pointer;">My Clubs</button>
        <button onclick="event.stopPropagation(); App._clubsTab='public';App.renderClubs()" style="flex:1; padding:8px; border-radius:8px; border:1px solid ${isPublic ? 'var(--wood-dark)' : 'rgba(61,43,31,0.2)'}; background:${isPublic ? 'var(--wood-dark)' : 'transparent'}; color:${isPublic ? '#fff' : 'var(--wood-dark)'}; font-size:12px; font-weight:600; cursor:pointer;">Public Clubs</button>
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

_renderClubDetail(el, club, msgs, members = [], shelfBooks = []) {
    if (typeof window !== "undefined" && window.App) window.App._currentClubData = club;
    const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const isAdmin = club.myRole === 'admin';
    const isMember = club.myRole === 'member' || isAdmin;
    const thumbMatch = (club.description || '').match(/\[thumb:(.*?)\]/);
    const clubThumb = club.thumbnail_url || club.thumbnail || (thumbMatch ? thumbMatch[1] : null);
    const cleanDesc = (club.description || '').replace(/\[thumb:.*?\]/g, '').replace(/https?:\/\/\S+/g, '').replace(/\b\S+\.(png|jpg|jpeg|gif|webp)\S*\b/gi, '').trim();

  const pickSection = `
    <div style="display: flex; flex-direction: column; height: 100%; width: 100%;">
      ${club.current_book_title
        ? `<div data-title="${esc(club.current_book_title)}" data-author="${esc(club.current_book_author||'')}" data-cover="${esc(club.current_book_cover||'')}" data-synopsis="${esc(club.current_book_synopsis||club.current_book_description||'')}" onclick="App.openBookModal(this)" style="cursor: pointer; display: flex; flex-direction: column; padding: 12px; background: #fff; border-radius: 12px; box-shadow: 0 0 0 2px var(--burgundy), 0 4px 16px rgba(139,38,53,0.15); flex: 1; box-sizing: border-box; transition: transform 0.2s, box-shadow 0.2s; height: 100%;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 0 0 2px var(--burgundy), 0 6px 20px rgba(139,38,53,0.2)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 0 0 2px var(--burgundy), 0 4px 16px rgba(139,38,53,0.15)';">
             <div style="display: flex; flex-direction: row; gap: 16px; align-items: center; justify-content: center; flex: 1;">
                 ${club.current_book_cover ? `<img loading="lazy" decoding="async" src="${esc(club.current_book_cover)}" style="width:80px; height: 120px; object-fit:cover; border-radius:8px; box-shadow:0 4px 12px rgba(61,43,31,0.2); flex-shrink: 0;" onerror="this.style.display='none';">` : ''}
                 <div style="display: flex; flex-direction: column; justify-content: center; min-width: 0; text-align: left;">
                   <div style="font-family: 'DM Mono', monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--burgundy); font-weight: 700; text-align: left; margin-bottom: 4px;">Current Pick</div>
                   <div style="font-weight: 700; font-size: 16px; color: var(--wood-dark); line-height: 1.2; margin-bottom: 4px;">${esc(club.current_book_title)}</div>
                   <div style="font-family: 'DM Mono', monospace; font-size: 12px; color: var(--wood-mid);">${esc(club.current_book_author||'Unknown')}</div>
                 </div>
             </div>
           </div>`
        : `<div style="font-size: 14px; color: var(--wood-mid); text-align: center; font-style: italic; background: rgba(61,43,31,0.02); border-radius: 12px; padding: 12px; flex: 1; display: flex; align-items: center; justify-content: center; border: 1px dashed rgba(61,43,31,0.1); height: 100%; box-sizing: border-box;">Voting in progress...</div>`}
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
      return `<div style="display: flex; gap: 12px; align-items: center; cursor:pointer; background: rgba(139,38,53,0.02); padding: 8px; border-radius: 8px; width: 100%; box-sizing: border-box;" title="${esc(dispTitle)}${dispAuthor ? ' by ' + esc(dispAuthor) : ''}" data-title="${esc(dispTitle)}" data-author="${esc(dispAuthor)}" data-cover="${esc(cover)}" data-synopsis="${esc(b.synopsis || b.review || b.description || '')}" onclick="App.openBookModal(this)">
        ${cover ? `<img loading="lazy" decoding="async" src="${esc(cover)}" style="width: 40px; height: 60px; object-fit: cover; border-radius: 6px; box-shadow: 0 4px 12px rgba(61,43,31,0.15); margin-bottom:6px;" onerror="this.style.display='none';">` : `<div style="width: 60px; height: 90px; background: rgba(0,0,0,0.1); border-radius: 6px; margin-bottom:6px;"></div>`}
        <div style="display: flex; flex-direction: column; text-align: left; min-width: 0;">
          <div style="font-size:12px; font-weight:700; color:var(--wood-dark); display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; line-height:1.2; width:100%;">${esc(dispTitle)}</div>
          ${dispAuthor ? `<div style="font-size:11px; color:var(--wood-mid); font-family:'DM Mono',monospace; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-top:2px;">${esc(dispAuthor)}</div>` : ''}
          ${b.date ? `<div style="font-size:10px; color:var(--wood-mid); margin-top:4px;">${esc(b.date)}</div>` : ''}
        </div>
      </div>`;
  }).join('');
  
  const pastReadsSection = pastReads.length ? `
    <div style="display:flex; flex-direction:column; gap:12px; max-height: 400px; overflow-y: auto; padding-right: 4px;">
      ${pastReadsItems}
    </div>
  ` : '<div style="text-align:center; color:var(--wood-mid); font-size:12px; padding:20px;">No past reads yet.</div>';

  let shelfHtml = '';
  if (shelfBooks.length > 0) {
    const bookItems = shelfBooks.map(b => {
      const prof = b._member_prof || {};
      const avatar = (typeof App !== "undefined" && App._getUserAvatar ? App._getUserAvatar(prof) : (prof.avatar_emoji || '❌'));
      const cover = b.cover_url || b.coverUrl || b.cover || b.fallbackCover || '';
      
      let hasUserReadIt = false;
      if (typeof window !== 'undefined' && window.App && window.App.books) {
        hasUserReadIt = window.App.books.some(ub => ub.title && b.title && ub.title.toLowerCase().trim().includes(b.title.toLowerCase().trim()) || b.title.toLowerCase().trim().includes(ub.title.toLowerCase().trim()) && ub.status !== 'to-read');
      }
      const ghostStyle = hasUserReadIt ? '' : 'opacity: 0.45; filter: saturate(0.5);';
      
      return `<div style="display: flex; flex-direction: column; align-items: center; width: 70px; flex-shrink: 0; position: relative;" title="${esc(b.title)} by ${esc(b.author)}">
        <img loading="lazy" decoding="async" src="${esc(cover)}" style="width: 70px; height: 105px; object-fit: cover; border-radius: 6px; box-shadow: 0 6px 16px rgba(61,43,31,0.15); ${ghostStyle}" onerror="if(this&&this.style)this.style.display='none';">
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
  .club-right-panel { min-width: 160px; flex: 1; flex-shrink: 0; display: flex; flex-direction: column; justify-content: center; gap: 12px; box-sizing: border-box; }
  .club-dropdown-menu { position: absolute; top: -10px; left: auto; right: 100%; margin-right: 16px; width: 320px; background: #fff; z-index: 100; box-shadow: 0 10px 40px rgba(0,0,0,0.2); border-radius: 12px; border: 1px solid rgba(139,38,53,0.1); padding: 16px; box-sizing: border-box; max-height: 350px; overflow-y: auto; }
  .club-dropdown-btn { padding: 12px; font-family: 'DM Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--wood-dark); font-weight: 700; cursor: pointer; user-select: none; list-style: none; outline: none; background: rgba(139,38,53,0.02); transition: background 0.2s; box-sizing: border-box; border-radius: 12px; height: 100%; display: flex; align-items: center; justify-content: space-between; }
  @media (max-width: 600px) {
      .club-right-panel { flex-direction: row; min-width: 100%; gap: 8px; }
      .club-right-panel > * { flex: 1; min-width: 0; }
      
      /* Turn details dropdowns into Bottom Sheet modals on mobile */
      details .club-dropdown-menu { 
          position: fixed !important; 
          top: auto !important; 
          bottom: 0 !important; 
          left: 0 !important; 
          right: 0 !important; 
          width: 100vw !important; 
          max-width: 100vw !important; 
          margin: 0 !important; 
          border-radius: 20px 20px 0 0 !important; 
          z-index: 999999 !important; 
          box-shadow: 0 -10px 40px rgba(0,0,0,0.3) !important; 
          padding: 24px !important;
          padding-bottom: max(30px, env(safe-area-inset-bottom)) !important;
          animation: slideUpClubMenu 0.3s cubic-bezier(0.2, 1, 0.3, 1) forwards;
          max-height: 85vh !important;
      }
      
      /* Backdrop Overlay */
      details[open] > summary::before {
          content: '';
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.5);
          z-index: 999998;
          backdrop-filter: blur(3px);
          cursor: default;
      }
      
      /* Add a pill handle at the top of the sheet */
      details .club-dropdown-menu::before {
          content: '';
          display: block;
          width: 40px;
          height: 4px;
          background: rgba(139,38,53,0.2);
          border-radius: 4px;
          margin: -10px auto 16px auto;
      }
      
      @keyframes slideUpClubMenu {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
      }

      .club-dropdown-btn { justify-content: center; padding: 12px 4px; }
      .club-dropdown-btn span:first-child { display: none; }
    }
  </style>
  <div class="club-premium-container">
    <div class="club-detail-header" style="padding: 16px 20px; display: flex; align-items: center; justify-content: space-between; gap: 16px; border-bottom: 1px solid rgba(139,38,53,0.08); background: #fff; z-index: 10; flex-shrink: 0; flex-wrap: wrap;">
      <div style="display: flex; align-items: center; gap: 14px; flex: 1; min-width: 200px;">
        <button class="club-back-btn" onclick="event.stopPropagation(); App.renderClubs()" title="Back to Clubs">←</button>
        ${clubThumb ? `<img src="${esc(clubThumb)}" style="width:48px; height:48px; object-fit:cover; border-radius:8px; box-shadow:0 2px 8px rgba(61,43,31,0.15); flex-shrink:0;" onerror="this.style.display='none';">` : ''}
        <div style="flex: 1; min-width: 0;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 700; color: var(--burgundy); white-space: normal; line-height: 1.2; letter-spacing: -0.02em; word-break: break-word;">${esc(club.name)}</div>
            ${isAdmin ? `<button onclick="event.stopPropagation(); App.editClubName(this)" data-club-id="${club.id}" data-club-name="${esc(club.name||'')}" style="background: rgba(139,38,53,0.05); border: none; color: var(--burgundy); cursor: pointer; font-size: 10px; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: all 0.2s; flex-shrink: 0;" onmouseover="this.style.background='rgba(139,38,53,0.1)'" onmouseout="this.style.background='rgba(139,38,53,0.05)'" title="Edit Club Name">✏️</button>` : ''}
          </div>
          ${cleanDesc ? `<div style="font-size: 12px; color: var(--wood-mid); margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500;">${esc(cleanDesc)}</div>` : ''}
        </div>
      </div>
      <div class="club-header-actions" style="display: flex; align-items: flex-start; gap: 16px; flex-shrink: 0; flex-wrap: wrap; justify-content: flex-end; margin-top: 4px;">
        ${!isMember ? `<button class="club-action-btn club-join-btn" onclick="event.stopPropagation(); App.joinClub('${club.id}')" style="background: var(--burgundy); color: #fff; border: none; padding: 6px 14px; border-radius: 16px; font-weight: 700; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 4px; box-shadow: 0 2px 8px rgba(139,38,53,0.3); transition: all 0.2s; height: fit-content;" title="Join Club" aria-label="Join Club">Join Club</button>` : ''}
        <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
            <button onclick="event.stopPropagation(); App.openInviteModal('${club.id}')" style="width: 32px; height: 32px; border-radius: 50%; border: 1px solid rgba(61,43,31,0.2); background: #fff; color: var(--wood-dark); font-weight: 700; font-size: 14px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center;" onmouseover="this.style.background='rgba(61,43,31,0.05)'" onmouseout="this.style.background='#fff'" title="Invite Friends" aria-label="Invite Friends">➕</button>
            <div style="font-size: 9px; font-weight: 700; color: var(--wood-mid); text-transform: uppercase; letter-spacing: 0.05em; margin-top: 4px; text-align: center;">Invite</div>
        </div>
        <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
            <button onclick="event.stopPropagation(); App.openClubShelf('${club.id}')" style="width: 32px; height: 32px; background: rgba(139,38,53,0.08); border: none; border-radius: 50%; color: var(--burgundy); cursor: pointer; font-weight: 600; font-size: 12px; transition: all 0.2s; display: flex; align-items: center; justify-content: center;" onmouseover="this.style.background='rgba(139,38,53,0.15)'" onmouseout="this.style.background='rgba(139,38,53,0.08)'" title="View Club Shelf">📚</button>
            <div style="font-size: 9px; font-weight: 700; color: var(--wood-mid); text-transform: uppercase; letter-spacing: 0.05em; margin-top: 4px; text-align: center;">Shelf</div>
        </div>
        <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
            <button onclick="event.stopPropagation(); App.openManageMembers('${club.id}')" style="width: 32px; height: 32px; background: rgba(139,38,53,0.08); border: none; border-radius: 50%; color: var(--burgundy); cursor: pointer; font-weight: 600; font-size: 12px; transition: all 0.2s; display: flex; align-items: center; justify-content: center;" onmouseover="this.style.background='rgba(139,38,53,0.15)'" onmouseout="this.style.background='rgba(139,38,53,0.08)'" title="View Members">👥</button>
            <div style="font-size: 9px; font-weight: 700; color: var(--wood-mid); text-transform: uppercase; letter-spacing: 0.05em; margin-top: 4px; text-align: center;">Members</div>
        </div>
        ${isAdmin ? `<div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
            <button onclick="event.stopPropagation(); App.openAdminPanel('${club.id}')" style="width: 32px; height: 32px; background: linear-gradient(135deg, #c5a059, #e6c887); border: none; border-radius: 50%; color: #fff; cursor: pointer; font-weight: 700; font-size: 12px; transition: all 0.2s; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(197,160,89,0.3); text-shadow: 0 1px 2px rgba(0,0,0,0.1);" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(197,160,89,0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(197,160,89,0.3)'" title="Admin Settings">⚙️</button>
            <div style="font-size: 9px; font-weight: 700; color: var(--wood-mid); text-transform: uppercase; letter-spacing: 0.05em; margin-top: 4px; text-align: center;">Admin</div>
        </div>` : ''}
      </div>
    </div>
    
    <div id="clubInnerScroll" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; background: var(--paper);">
    <div class="club-3col-layout" style="display: flex; flex-wrap: wrap; gap: 16px; padding: 16px 20px; border-bottom: 1px solid rgba(139,38,53,0.08); background: #fcfbfa; z-index: 10; flex-shrink: 0; align-items: stretch;">
      
      <div style="flex: 1; min-width: 0; background: transparent; display: flex; flex-direction: column; box-sizing: border-box;">
        <div style="flex: 1; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">
          ${pickSection}
        </div>
      </div>

      <div class="club-right-panel">
          ${!club.isPublic ? `
          <details style="position: relative; background: #fff; border-radius: 12px; border: 1px solid rgba(139,38,53,0.05); box-shadow: 0 4px 12px rgba(61,43,31,0.04); display: flex; flex-direction: column; overflow: visible; box-sizing: border-box;">
            <summary class="club-dropdown-btn">
              <span style="font-size: 10px; color: var(--wood-mid);">◀</span>
              <span>Vote</span>
            </summary>
            <div id="clubVoteZone-${club.id}" class="club-dropdown-menu"></div>
          </details>
          <div style="position: relative; display: flex; align-items: center; box-sizing: border-box; min-width: 0;">
            <input id="suggestInput-${club.id}" autocomplete="off" placeholder="Suggest" style="width: 100%; height: 100%; background: #fff; border: 1px solid rgba(139,38,53,0.15); border-radius: 12px; padding: 12px; color: var(--wood-dark); font-family: 'DM Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; text-align: center; outline: none; box-sizing: border-box; box-shadow: 0 4px 12px rgba(61,43,31,0.04); cursor: text; transition: all 0.2s; min-width: 0;" onfocus="this.placeholder=''; this.style.border='1px solid var(--burgundy)'; App.handleClubSuggestSearch(this.value, '${club.id}')" onblur="this.placeholder='Suggest'; this.style.border='1px solid rgba(139,38,53,0.15)';" onkeyup="if(event.key === 'Enter') App.suggestClubBook('${club.id}'); else App.handleClubSuggestSearch(this.value, '${club.id}')">
            <div id="suggestDropdown-${club.id}" class="club-dropdown-menu" style="display: none;"></div>
          </div>
          ` : ''}

          <details style="position: relative; background: #fff; border-radius: 12px; border: 1px solid rgba(139,38,53,0.05); box-shadow: 0 4px 12px rgba(61,43,31,0.04); display: flex; flex-direction: column; overflow: visible; box-sizing: border-box;">
            <summary class="club-dropdown-btn">
              <span style="font-size: 10px; color: var(--wood-mid);">◀</span>
              <span>Past</span>
            </summary>
            <div class="club-dropdown-menu">
              ${pastReadsSection}
            </div>
          </details>
      </div>

      

    </div>
    
      ${!isMember ? `
        <div class="public-club-join-banner" style="margin: 16px 20px 0 20px; padding: 14px 20px; background: rgba(139,38,53,0.06); border: 1px solid rgba(139,38,53,0.15); border-radius: 12px; display: flex; align-items: center; justify-content: space-between; gap: 16px;">
          <div>
            <div style="font-weight: 700; font-size: 14px; color: var(--wood-dark);">Join ${esc(club.name)}</div>
            <div style="font-size: 12px; color: var(--wood-mid);">Read along with members, nominate books, and join discussions.</div>
          </div>
          <button class="club-join-btn" onclick="event.stopPropagation(); App.joinClub('${club.id}')" style="padding: 8px 18px; background: var(--burgundy); color: #fff; border: none; border-radius: 20px; font-weight: 700; font-size: 13px; cursor: pointer; white-space: nowrap; box-shadow: 0 4px 12px rgba(139,38,53,0.25);">Join Club</button>
        </div>
      ` : ''}
      ${club.isPublic ? `
        <div style="text-align: center; padding: 40px 24px;">
          <div style="font-family: 'Playfair Display', serif; font-size: 28px; color: var(--wood-dark); font-weight: 700; margin-bottom: 12px;">Start a Local Pod</div>
          <div style="font-size: 14px; color: var(--wood-mid); margin-bottom: 32px; max-width: 300px; margin-left: auto; margin-right: auto; line-height: 1.6;">Read along with this public club by starting a private group chat with your friends.</div>
          <button data-club-id="${club.id}" data-title="${esc(club.current_book_title||'')}" data-author="${esc(club.current_book_author||'')}" data-cover="${esc(club.current_book_cover||'')}" onclick="event.stopPropagation(); App.startLocalPod(this)" title="Start a Private Pod for this Public Club" style="padding: 16px 32px; border-radius: 30px; background: var(--burgundy); color: #fff; font-size: 15px; font-weight: 600; border: none; cursor: pointer; box-shadow: 0 8px 24px rgba(139,38,53,0.3); transition: transform 0.2s;">+ Start a Private Pod</button>
        </div>
      ` : `
        <div style="padding-top: 20px;"></div>
        
        ${membersSection}
        ${shelfHtml}
        <div class="club-msg-area" id="clubMsgs" data-last-day="${lastDayKey || ''}">
          ${msgItems || '<div style="text-align: center; font-size: 13px; color: var(--wood-light); font-weight: 500; margin-top: 40px; padding: 40px; border: 1px dashed rgba(139,38,53,0.2); border-radius: 12px; margin-bottom: 40px;">No messages yet. Be the first to start the conversation!</div>'}
        </div>
      `}
    </div>

    ${!club.isPublic ? `
    <div class="club-compose-bar">
      <input class="club-input-field" id="clubMsgInput" placeholder="Share your thoughts..." maxlength="500" onkeydown="if(event.key==='Enter'){App.sendClubMessage('${club.id}');event.preventDefault();}">
      <button class="club-send-btn" onclick="event.stopPropagation(); App.sendClubMessage('${club.id}')" title="Send Message">↑</button>
    </div>
    ` : `
    <div class="club-compose-bar" style="justify-content: center; background: rgba(250,248,245,0.95);">
      <button class="club-join-btn" onclick="event.stopPropagation(); App.joinClub('${club.id}')" style="width: 100%; max-width: 400px; padding: 12px 24px; background: var(--burgundy); color: #fff; border: none; border-radius: 24px; font-weight: 700; font-size: 14px; cursor: pointer; box-shadow: 0 4px 14px rgba(139,38,53,0.25); transition: all 0.2s;">
        ✨ Join Club to Participate in Discussion
      </button>
    </div>
    `}
  </div>`;

  if (!club.isPublic) {
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
    const cover = b.cover_url || b.coverUrl || b.cover || b.fallbackCover || (b.cover_id ? `https://covers.openlibrary.org/b/id/${b.cover_id}-S.jpg` : '');

    return `
      <div class="club-vote-item" onclick="App.castClubVote('${club.id}', '${esc(bookId)}')" title="${esc(b.title)}${b.author ? ' by ' + esc(b.author) : ''}" style="display: flex; gap: 6px; align-items: center; cursor: pointer; transition: transform 0.2s; min-width: 0; flex: 1;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
        <div style="position: relative; flex-shrink: 0;">
          <img loading="lazy" decoding="async" src="${esc(cover)}" style="width: 40px; height: 60px; object-fit: cover; border-radius: 4px; box-shadow: 0 2px 8px rgba(61,43,31,0.15); border: ${isSelected ? '2px solid #10b981' : '1px solid transparent'}; box-sizing: border-box; display: block;" onerror="if(this&&this.style)this.style.display='none';">
          ${isSelected ? `
            <div style="position: absolute; inset: 0; background: rgba(16, 185, 129, 0.25); border-radius: 4px; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(1px);">
              <div style="background: #10b981; color: #fff; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; box-shadow: 0 2px 8px rgba(0,0,0,0.4);">✔️</div>
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

  const startDateStr = App._clubStartDates[club.id] ? `<span style="font-size:9px; color:var(--wood-light); margin-left:8px; font-weight:normal; text-transform:none;">Starts: ${App._clubStartDates[club.id]}</span>` : '';

  el.innerHTML = `
    <div style="display: flex; flex-direction: column; height: 100%;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; margin-left: 4px;">
        <div style="font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 0.1em; color: var(--wood-mid); font-weight: 700;">Vote: Next Pick ${startDateStr}</div>
      </div>
      <div style="display: flex; flex-direction: column; padding: 12px; background: #fff; border-radius: 12px; box-shadow: 0 4px 12px rgba(61,43,31,0.06); border: 1px solid rgba(139,38,53,0.1); flex: 1; box-sizing: border-box; justify-content: center;">
        <div style="display: flex; gap: 12px; align-items: center;">
          <div style="display: flex; gap: 8px; flex: 1; min-width: 0; align-items: center;">
            ${candidateHtml}
          </div>
          <div style="display: flex; flex-direction: column; gap: 4px; width: 100px; flex-shrink: 0; position: relative;">
            <input id="suggestInput-${club.id}" autocomplete="off" placeholder="Suggest a book..." style="width: 100%; background: rgba(139,38,53,0.02); border: 1px solid rgba(139,38,53,0.15); border-radius: 6px; padding: 4px 6px; color: var(--wood-dark); font-size: 10px; outline: none; box-sizing: border-box;" onfocus="App.handleClubSuggestSearch(this.value, '${club.id}')" onkeyup="App.handleClubSuggestSearch(this.value, '${club.id}')">
            <div id="suggestDropdown-${club.id}" style="position: absolute; top: 100%; right: 0; left: auto; width: 220px; background: #fff; box-shadow: 0 4px 16px rgba(0,0,0,0.1); border-radius: 6px; display: none; max-height: 150px; overflow-y: auto; z-index: 1000; border: 1px solid rgba(139,38,53,0.1); margin-top: 4px;"></div>
            <button onclick="App.suggestClubBook('${club.id}')" title="Suggest this book for the next pick" style="width: 100%; background: var(--burgundy); color: #fff; border: none; border-radius: 6px; padding: 4px; font-size: 10px; font-weight: 600; cursor: pointer; box-sizing: border-box;">Send</button>
          </div>
        </div>
      </div>
    </div>
  `;
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

castClubVote(clubId, bookId) {
    if (!App._clubVotes) App._clubVotes = {};
    App._clubVotes[clubId] = bookId;
    const _voteEl = document.getElementById('clubVoteZone-' + clubId);
    if (_voteEl) {
      this._renderVotingSection(_voteEl, { id: clubId, isPublic: false });
    }
    if (typeof App.showToast === 'function') App.showToast('🗳️ Vote recorded!');
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
    if (typeof App.suggestClubBook === 'function') {
      App.suggestClubBook(clubId);
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
    if (!App._clubVotingCandidates) App._clubVotingCandidates = {};
    if (!App._clubVotingCandidates[clubId]) App._clubVotingCandidates[clubId] = [];

    const exists = App._clubVotingCandidates[clubId].some(c => (c.title || '').toLowerCase() === val.toLowerCase());
    if (!exists) {
      if (App._clubVotingCandidates[clubId].length >= 3) {
        App._clubVotingCandidates[clubId].pop();
      }
      App._clubVotingCandidates[clubId].unshift({
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
    input.value = '';
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
    if (brandEl) brandEl.textContent = 'Note to Shelf';
    document.title = 'Note to Shelf';
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

async openAdminPanel(clubId, defaultTab = "general") {
    const existing = document.getElementById("adminPanelModal");
    if (existing) existing.remove();
  const clubs = await DB.getMyClubs(App.userId);
  const club = (clubs||[]).find(c => c.id === clubId);
  if (!club) return;
  const members = await DB.getClubMembers(clubId);
  
  
  const esc = s => (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  if (typeof App.closeModal === "function") App.closeModal("communityModal");
    App._modalZIndex = (App._modalZIndex || 2000000000) + 1;
  const modalHTML = `
    <div class="modal-overlay open" id="adminPanelModal" onclick="if(event.target===this) this.remove()" style="z-index:${App._modalZIndex} !important; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.8);">
      <div class="modal-card" style="max-width:500px; width:90%; background:#fff; color:var(--wood-dark); padding:24px; border-radius:12px; position:relative; min-height:85vh; max-height:95vh; display:flex; flex-direction:column;">
        <button class="modal-close" onclick="document.getElementById('adminPanelModal')?.remove()" style="position:absolute; top:12px; right:12px; background:none; border:none; color:var(--wood-mid); font-size:24px; cursor:pointer;">&times;</button>
        <div style="font-size:18px; font-weight:700; margin-bottom:16px;">⚙️⚙️ Admin Settings</div>
        
        <!-- Tabs -->
        <div style="display:flex; justify-content:space-between; border-bottom:1px solid rgba(61,43,31,0.1); margin-bottom:16px; font-weight:600; font-size:14px; color:var(--wood-mid); text-align:center;">
          <div id="adminTabGeneral" onclick="App.switchAdminTab('general')" style="flex: 1; padding-bottom:8px; cursor:pointer; color:var(--burgundy); border-bottom:2px solid var(--burgundy);">General</div>
            <div id="adminTabPick" onclick="App.switchAdminTab('pick')" style="flex: 1; padding-bottom:8px; cursor:pointer;">Next Pick Settings</div>
          <div id="adminTabPast" onclick="App.switchAdminTab('past')" style="flex: 1; padding-bottom:8px; cursor:pointer;">Past Reads</div>
          <div id="adminTabMembers" onclick="App.switchAdminTab('members')" style="flex: 1; padding-bottom:8px; cursor:pointer;">Manage Members</div>
          <div id="adminTabModeration" onclick="App.switchAdminTab('moderation')" style="flex: 1; padding-bottom:8px; cursor:pointer;">Moderation</div>
        </div>
        
        
          <!-- General Settings Tab -->
          <div id="adminPanelGeneral" style="display:flex; flex-direction:column; gap:16px; flex:1; overflow-y:auto; padding-right:8px;">
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
              <textarea id="adminDescInput" rows="4" style="width:100%; padding:8px; border:1px solid rgba(61,43,31,0.2); border-radius:6px; font-family:inherit; resize:vertical; margin-bottom:8px; box-sizing:border-box;">${esc((club.description || '').replace(/\[thumb:.*?\]/g,'').trim())}</textarea>
              <button onclick="App.saveClubDescription('${clubId}', document.getElementById('adminDescInput').value)" style="padding:8px 16px; background:var(--burgundy); color:#fff; border:none; border-radius:6px; font-weight:600; cursor:pointer;">Save Description</button>
            </div>
          
          <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid rgba(255,0,0,0.2);">
            <div style="font-size:12px; font-weight:700; color: #ff4444; margin-bottom:8px;">Danger Zone</div>
            <button onclick="App.deleteClub('${clubId}')" class="btn-primary" style="background: #ff4444; width: 100%; border: none; padding: 10px; border-radius: 6px; font-weight: bold; cursor: pointer;">Delete Club</button>
          </div>
          </div>
          
        <div id="adminPanelPick" style="display:none; flex:1; overflow-y:auto; padding-right:8px;">
          <div style="font-size:12px; font-weight:700; margin-bottom:4px;">Set Start Date for Next Pick</div>
          <input type="date" id="adminPickStartDate" value="${App._clubStartDates ? App._clubStartDates[clubId] || '' : ''}" onchange="if(App._clubStartDates) App._clubStartDates['${clubId}'] = this.value; App.openClub('${clubId}')" style="width:100%; padding:8px; border:1px solid rgba(61,43,31,0.2); border-radius:6px; margin-bottom:16px; box-sizing:border-box;">
          
          <div style="font-size:12px; font-weight:700; margin-bottom:4px;">Directly Set Current Pick</div>
          <button onclick="document.getElementById('adminPanelModal')?.remove(); App.openClubPickModal()" style="padding:8px 16px; background:var(--burgundy); color:#fff; border:none; border-radius:6px; font-weight:600; cursor:pointer; margin-bottom:16px;">Open Pick Modal</button>
        </div>

        
        <!-- Past Reads Tab -->
        <div id="adminPanelPast" style="display:none; flex-direction:column; gap:8px; flex:1; overflow-y:auto; padding-right:8px;">
          <div style="font-size:12px; font-weight:700; margin-bottom:4px;">Add a Past Read</div>
          <div style="position:relative; width:100%;">
            <input id="adminPastInput" placeholder="Search book title..." oninput="App.debounceAdminPastSearch(this.value, '${clubId}')" style="width:100%; padding:8px; border:1px solid rgba(61,43,31,0.2); border-radius:6px; box-sizing:border-box;">
            <div id="adminPastSearchResults" style="position:absolute; top:100%; left:0; width:100%; background:#fff; box-shadow:0 4px 12px rgba(0,0,0,0.15); border-radius:8px; z-index:10; display:none; max-height:200px; overflow-y:auto;"></div>
          </div>
          
          <div style="font-size:12px; font-weight:700; margin-top:16px; margin-bottom:4px;">Current Past Reads</div>
          <div id="adminPastList" style="display:flex; flex-direction:column; gap:8px;">
            <!-- Populated dynamically via JS -->
          </div>

        </div>

        <!-- Members Tab -->
        <div id="adminPanelMembers" style="display:none; flex-direction:column; flex:1; overflow-y:auto; padding-right:8px;">
          <div style="margin-bottom: 16px; position: relative;">
            <input type="text" id="adminAddMemberEmail" placeholder="Add member by email address..." onkeyup="App.handleAdminEmailSearch(this.value, '${clubId}')" autocomplete="off" style="width:100%; padding: 12px; border-radius: 8px; border: 1px solid rgba(61,43,31,0.2); box-sizing: border-box; font-size: 14px; font-family: inherit; outline: none; transition: border-color 0.2s;" onfocus="this.style.borderColor='var(--burgundy)';" onblur="this.style.borderColor='rgba(61,43,31,0.2)';">
            <div id="adminEmailDropdown" style="position: absolute; top: 100%; left: 0; width: 100%; background: #fff; box-shadow: 0 4px 16px rgba(0,0,0,0.15); border-radius: 8px; z-index: 1000; display: none; max-height: 200px; overflow-y: auto; margin-top: 4px; border: 1px solid rgba(61,43,31,0.05);"></div>
          </div>
          <div style="display:flex; flex-direction:column; gap:8px;">
          ${members.map(m => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:rgba(61,43,31,0.03); border-radius:8px; border:1px solid rgba(61,43,31,0.05);">
              <div style="font-size:14px; font-weight:600;">${(m.user_profiles && m.user_profiles.display_name) || 'Reader'} ${m.role==='admin'?'<span style="color:var(--burgundy);font-size:10px;margin-left:4px;">(Admin)</span>':''}</div>
              ${m.role !== 'admin' ? `
                <button onclick="event.stopPropagation(); App.removeMember('${clubId}', '${m.user_id}', this)" style="background:transparent; color:var(--wood-mid); border:none; padding:4px; cursor:pointer; font-size:16px; transition:color 0.2s;" onmouseover="this.style.color='#ff4444'" onmouseout="this.style.color='var(--wood-mid)'" title="Remove Member">✖</button>
              ` : ''}
            </div>
          `).join('')}
          </div>
        </div>

        <!-- Moderation Tab -->
        <div id="adminPanelModeration" style="display:none; flex-direction:column; gap:16px; padding-top:8px; flex:1; overflow-y:auto; padding-right:8px;">
           <div style="font-size:13px; color:var(--wood-mid); line-height:1.5;">As a club admin, you can delete individual messages from the chat view by clicking the red '🗑️' next to a message.</div>
           <div style="font-size:12px; font-weight:700; margin-bottom:4px; margin-top:8px; color:#ff4444;">Danger Zone</div>
           <div style="display:flex; justify-content:space-between; align-items:center; padding:16px; background:rgba(255,68,68,0.05); border-radius:8px; border:1px solid rgba(255,68,68,0.2);">
              <div style="font-size:13px; font-weight:600; color:var(--wood-dark);">Wipe Entire Chat History</div>
              <button onclick="if(confirm('Are you absolutely sure? This cannot be undone.')){ App.showToast('Chat history wiped.'); App.openClub('${clubId}'); document.getElementById('adminPanelModal')?.remove(); }" style="padding:6px 12px; background:#ff4444; color:#fff; border:none; border-radius:6px; font-weight:600; cursor:pointer;">Wipe</button>
           </div>
        </div>

      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  if (typeof App !== 'undefined' && typeof App.switchAdminTab === 'function') App.switchAdminTab(defaultTab);
  
  if (typeof App !== 'undefined' && typeof App.renderAdminPastReads === 'function') App.renderAdminPastReads(clubId);
}
};


App.openManageMembers = async (clubId) => {
  let club = (window.App.clubs || (typeof window !== 'undefined' && window._mockClubs) || []).find(c => String(c.id) === String(clubId));
  if (!club) {
    if (typeof DB !== 'undefined' && DB.getMyClubs) {
      const clubs = await DB.getMyClubs(window.App ? window.App.userId : null);
      if (clubs) {
         if (typeof window !== 'undefined' && window.App) window.App.clubs = clubs;
         club = clubs.find(c => String(c.id) === String(clubId));
      }
    }
  }
  if (!club) return App.showToast('Club not found');
  
  let members = [];
  try {
    if (typeof DB !== 'undefined' && DB.getClubMembers) {
      members = await DB.getClubMembers(clubId);
    } else if (window._mockClubMembers && window._mockClubMembers[clubId]) {
      members = window._mockClubMembers[clubId];
    }
  } catch (e) { console.error('Failed to get members', e); }
  
  const m = document.createElement('div');
  m.id = 'clubMembersModal';
  m.className = 'modal-overlay open';
  m.onclick = (e) => { if(e.target === m) { m.remove(); if (window.App && window.App.closeModal) window.App.closeModal(m.id); } };
  
  const sl_cm = document.getElementById('communityModal');
  if (sl_cm && sl_cm.classList.contains('open')) sl_cm.appendChild(m); else document.body.appendChild(m);
  m.innerHTML = `
    <div class="modal-card" style="max-width:400px; padding:24px; position:relative;">
      <button onclick="event.stopPropagation(); this.closest('.modal-overlay').remove(); if(window.App && window.App.closeModal) window.App.closeModal('clubMembersModal');" style="position:absolute; top:16px; right:16px; background:none; border:none; font-size:20px; cursor:pointer; color:var(--wood-mid);">✕</button>
      <div style="font-family:'Playfair Display',serif; font-size:24px; font-weight:700; color:var(--wood-dark); margin-bottom:8px;">Club Members</div>
      <div style="font-size:13px; color:var(--wood-mid); margin-bottom:20px;">${club.name}</div>
      <div style="display:flex; flex-direction:column; gap:12px; max-height:400px; overflow-y:auto; padding-right:8px;">
        ${members.map(mem => `
          <div style="display:flex; align-items:center; gap:12px; padding:12px; background:rgba(61,43,31,0.03); border-radius:8px;">
            <div style="width:40px; height:40px; border-radius:50%; background:var(--wood-light); display:flex; align-items:center; justify-content:center; font-size:20px; color:#fff;">
              ${mem.user_profiles?.avatar_emoji || '👤'}
            </div>
            <div style="display:flex; flex-direction:column; flex:1; min-width:0;">
              <span style="font-weight:700; color:var(--wood-dark); font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${mem.user_profiles?.display_name || 'Anonymous'}</span>
              <span style="font-size:11px; color:var(--wood-mid); text-transform:uppercase; letter-spacing:0.05em; font-family:'DM Mono',monospace;">${mem.role}</span>
            </div>
          </div>
        `).join('')}
        ${members.length === 0 ? '<div style="text-align:center; color:var(--wood-mid); font-size:13px;">No members found.</div>' : ''}
      </div>
    </div>
  `;
  
  m.classList.add('open');
  m.style.display = 'flex';
  m.style.setProperty('z-index', '2147483647', 'important');
  if (window.App) window.App._modalZIndex = 2147483647;
};
























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
