import { SYMBOLS } from '../constants/symbols.js';
import { supabase } from '../core/db.js';
import { SUBTERRANEAN_RELICS } from '../constants/relics.js';

export async function _injectProfileAchievements(userId, containerId = 'pvTrophyStrip') {
  const container = document.getElementById(containerId);
  if (!container) return;
  try {
    let books = [];
    let profile = null;
    let following = [];
    const isMe = (userId === this.userId || !userId);
    if (isMe) {
      books = (this.books || []).filter(b => !b.currentlyReading && b.status !== 'to-read');
      profile = this.ownProfile;
      following = this.following || [];
    } else {
      const [p, b] = await Promise.all([
        DB.getUserProfile(userId).catch(() => null),
        DB.getPublicUserBooks(userId).catch(() => [])
      ]);
      profile = p;
      books = (b || []).filter(bk => !bk.currently_reading && bk.status !== 'to-read');
    }
    const catalog = this._getBadgesCatalog();
    let dbAchievements = [];
    try { dbAchievements = await DB.getMyAchievements(userId || this.userId) || []; } catch(e){}
    
    const formatDate = d => d.toLocaleDateString(undefined, {month:'short', day:'numeric', year:'numeric'});
    catalog.forEach(b => {
      let isUnl = false;
      const dbA = dbAchievements.find(a => a.type === b.id);
      if (dbA) isUnl = true;
      // Test fallback
      if (!isUnl && books.length > 0) {
          if (b.id === 'vol_1' && books.length >= 1) isUnl = true;
          if (b.id === 'vol_10' && books.length >= 10) isUnl = true;
      }
      b.isUnlocked = isUnl;
      if(b.isUnlocked) {
         b.earnedOn = dbA ? new Date(dbA.created_at) : new Date();
      } else {
         b.earnedOn = new Date(9999,0,1);
      }
    });
    catalog.sort((a,b) => {
      if(a.isUnlocked && !b.isUnlocked) return -1;
      if(!a.isUnlocked && b.isUnlocked) return 1;
      return a.earnedOn - b.earnedOn;
    });
    const unlocked = catalog.filter(b => b.isUnlocked);
    if(unlocked.length === 0) {
      container.innerHTML = '<div style="color:var(--wood-light);font-size:12px;font-style:italic;">No achievements yet.</div>';
      return;
    }
    const html = unlocked.map(b => {
      return `
        <div style="flex-shrink:0;width:56px;height:56px;border-radius:12px;background:linear-gradient(135deg, rgba(212,175,55,0.2), rgba(212,175,55,0.05));border:1px solid rgba(212,175,55,0.4);display:flex;align-items:center;justify-content:center;font-size:28px;box-shadow:0 4px 12px rgba(212,175,55,0.15), inset 0 1px 0 rgba(255,255,255,0.3);position:relative;" title="${this._escapeHtml(b.name)} - ${this._escapeHtml(b.desc)}">
          ${b.icon}
        </div>
      `;
    }).join('');
    container.innerHTML = `<div style="font-weight:700;font-size:12px;color:var(--wood-dark);margin-bottom:8px;">Reader Rank &amp; Badges</div><div style="display:flex;gap:12px;overflow-x:auto;padding-bottom:8px;">${html}</div>`;
  } catch(e) {
    console.error(e);
    container.innerHTML = '';
  }
}

export function showRelicDetailsModal(relicId) {
  const relic = SUBTERRANEAN_RELICS.find(r => r.id === relicId);
  if (!relic) return;

  const appInstance = (typeof window !== 'undefined' && window.App) ? window.App : this;
  let finishedCount = 0;
  if (appInstance && (appInstance.isDemoMode || !appInstance.userId)) {
    const bks = (appInstance.books || []).concat(appInstance.aggregateBooks || []);
    finishedCount = bks.filter(b => !b.currentlyReading && b.status !== 'to-read').length;
  } else if (appInstance && Array.isArray(appInstance.books)) {
    finishedCount = appInstance.books.filter(b => !b.currentlyReading && b.status !== 'to-read').length;
  }

  const isUnlocked = finishedCount >= relic.threshold;
  const remaining = Math.max(1, relic.threshold - finishedCount);

  let existingModal = document.getElementById('trRelicModal');
  if (!existingModal) {
    existingModal = document.createElement('div');
    existingModal.id = 'trRelicModal';
    existingModal.className = 'modal-overlay';
    existingModal.style.zIndex = '100005';
    existingModal.onclick = (e) => {
      if (e.target === existingModal) existingModal.classList.remove('open');
    };
    document.body.appendChild(existingModal);
  }

  existingModal.innerHTML = `
    <div class="modal-card" style="max-width: 420px; padding: 28px 24px; text-align: center; position: relative;" onclick="event.stopPropagation()">
      <button class="modal-close" onclick="document.getElementById('trRelicModal').classList.remove('open')" aria-label="Close">✖</button>
      <div style="width: 80px; height: 80px; margin: 0 auto 12px; display: flex; align-items: center; justify-content: center; ${isUnlocked ? 'filter: drop-shadow(0 4px 12px rgba(212, 175, 55, 0.6));' : 'filter: grayscale(0.8) opacity(0.5);'}">
        <svg viewBox="${relic.viewBox}" style="width: 100%; height: 100%; overflow: visible;" preserveAspectRatio="xMidYMid meet">
          ${relic.art}
        </svg>
      </div>
      <div style="font-size: 10px; font-family: 'DM Mono', monospace; text-transform: uppercase; letter-spacing: 0.12em; color: ${isUnlocked ? '#b45309' : 'var(--wood-light)'}; margin-bottom: 4px; font-weight: 600;">
        ${isUnlocked ? '✦ UNEARTHED ARTIFACT ✦' : '✦ BURIED IN SUBTERRANEAN STRATA ✦'}
      </div>
      <h3 style="font-family: 'Playfair Display', Georgia, serif; font-size: 19px; margin: 0 0 6px 0; color: var(--wood-dark);">
        ${relic.seal} ${relic.name}
      </h3>
      <div style="font-size: 11px; font-family: 'DM Mono', monospace; color: var(--wood-mid); margin-bottom: 14px;">
        ${relic.milestone}
      </div>
      <div style="height: 1px; width: 40px; background: rgba(212,175,55,0.4); margin: 0 auto 14px;"></div>
      <p style="font-size: 12.5px; line-height: 1.55; color: var(--wood-dark); margin: 0 0 20px 0; font-family: 'Lora', serif;">
        ${isUnlocked ? relic.lore : relic.clue}
      </p>
      ${!isUnlocked ? `
        <div style="background: rgba(61,43,31,0.05); border-radius: 8px; padding: 10px; margin-bottom: 16px; font-size: 11.5px; color: var(--wood-mid);">
          Read <strong>${remaining}</strong> more book${remaining === 1 ? '' : 's'} to unearth this ancient relic in your Reading Tree!
        </div>
      ` : ''}
      <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
        <button onclick="document.getElementById('trRelicModal').classList.remove('open'); if(window.App && typeof window.App.openReadingTree==='function'){ window.App.closeModal('trophyRoomModal'); window.App.openReadingTree(); }"
                style="padding: 9px 18px; background: linear-gradient(135deg, #8b2635 0%, #5c1822 100%); color: #ffffff; border: 1px solid rgba(212,175,55,0.4); border-radius: 8px; font-family: 'DM Mono', monospace; font-size: 11px; font-weight: 600; cursor: pointer;">
          🌳 Inspect in Reading Tree
        </button>
        <button onclick="document.getElementById('trRelicModal').classList.remove('open')"
                style="padding: 9px 14px; background: transparent; color: var(--wood-light); border: 1px solid rgba(61,43,31,0.15); border-radius: 8px; font-family: 'DM Mono', monospace; font-size: 11px; cursor: pointer;">
          Close
        </button>
      </div>
    </div>
  `;
  existingModal.classList.add('open');
}

export async function openTrophyRoom() {
    this.openModal('trophyRoomModal');
    const container = document.getElementById('trBody');
    if (!container) return;

    container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--wood-light);font-size:12px;font-family:\'DM Mono\',monospace;">Loading your achievements...</div>';

    let books = [];
    if (this.isDemoMode || !this.userId) {
      books = (this.books || []).concat(this.aggregateBooks || []);
      const seen = new Set();
      books = books.filter(b => {
        const k = (b.title || '') + '___' + (b.author || '');
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    } else {
      try {
        const rows = await DB.getAllUserBooks(this.userId);
        books = (rows || []).map(dbToBook);
      } catch (e) {
        books = this.books || [];
      }
    }

    const finished = books.filter(b => !b.currentlyReading && b.status !== 'to-read');
    const catalog = this._getBadgesCatalog();
    const rank = this._computeReaderRank(finished.length);
    const following = this.following || [];
    const profile = this.ownProfile || {};

    let dbAchievements = [];
    let rarityCounts = {};
    try { 
      dbAchievements = await DB.getMyAchievements(this.userId) || []; 
      if (typeof DB.getAchievementRarityCounts === 'function') {
        rarityCounts = await DB.getAchievementRarityCounts() || {};
      }
    } catch(e){}

    const totalUsers = Math.max(1, rarityCounts._totalUsers || 1);
    const totalWords = finished.reduce((s, b) => s + (b.words || 0), 0);
    const wordsStr = totalWords >= 1000000 ? (totalWords / 1000000).toFixed(1) + 'M' : totalWords >= 1000 ? Math.round(totalWords / 1000) + 'k' : String(totalWords);

    const formatDate = d => d.toLocaleDateString(undefined, {month:'short', day:'numeric', year:'numeric'});

    catalog.forEach(b => {
      let isUnl = false;
      const dbA = dbAchievements.find(a => a.type === b.id);
      if (dbA) isUnl = true;
      // Test fallback
      if (!isUnl && finished.length > 0) {
          if (b.id === 'vol_1' && finished.length >= 1) isUnl = true;
          if (b.id === 'vol_10' && finished.length >= 10) isUnl = true;
      }
      b.isUnlocked = isUnl;
      if(b.isUnlocked) {
         b.earnedOn = dbA ? new Date(dbA.created_at) : new Date();
      } else {
         b.earnedOn = new Date(9999,0,1);
      }
    });

    catalog.sort((a,b) => {
      if(a.isUnlocked && !b.isUnlocked) return -1;
      if(!a.isUnlocked && b.isUnlocked) return 1;
      if (a.isUnlocked && b.isUnlocked) return a.earnedOn - b.earnedOn;
      return 0; // Don't sort locked ones by date since they have none
    });

    let unlockedCount = catalog.filter(b => b.isUnlocked).length;
    const pct = catalog.length ? Math.round((unlockedCount/catalog.length)*100) : 0;

    const renderBadge = (badge) => {
      const isUnlocked = badge.isUnlocked;
      const isSecret = badge.isSecret;
      
      const badgeCount = rarityCounts[badge.id] || 0;
      let rarityPct = Math.round((badgeCount / totalUsers) * 100);
      if (rarityPct < 1 && badgeCount > 0) rarityPct = '<1';
      else if (rarityPct === 0 && badgeCount === 0) rarityPct = '0';
      
      let displayIcon = badge.icon;
      let displayName = this._escapeHtml(badge.name);
      let displayReq = badge.req;
      
      if (isSecret && !isUnlocked) {
          displayIcon = '❓';
          displayName = 'Secret Badge';
          displayReq = '???';
      }
      
      const bg = isUnlocked ? 'linear-gradient(145deg, rgba(212,175,55,0.15), rgba(212,175,55,0.05))' : 'linear-gradient(145deg, rgba(61,43,31,0.04), rgba(61,43,31,0.01))';
      const border = isUnlocked ? '2px dashed rgba(212,175,55,0.6)' : '2px dashed rgba(61,43,31,0.15)';
      const shadow = isUnlocked ? '0 3px 6px rgba(0,0,0,0.15), inset 0 0 0 2px rgba(212,175,55,0.2)' : '0 1px 3px rgba(0,0,0,0.1)';
      const iconBg = isUnlocked ? 'linear-gradient(135deg, rgba(212,175,55,0.3), rgba(212,175,55,0.1))' : 'rgba(61,43,31,0.06)';
      
      return `
        <div style="background:${bg};border:${border};border-radius:12px;padding:12px 10px;display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px;opacity:${isUnlocked ? '1' : '0.6'};position:relative;box-shadow:${shadow};transition:transform 0.2s, box-shadow 0.2s;" onmouseover="if(${isUnlocked}){ this.style.transform='translateY(-4px)'; this.style.boxShadow='0 12px 28px rgba(212,175,55,0.3), inset 0 1px 0 rgba(255,255,255,0.5)'; }" onmouseout="if(${isUnlocked}){ this.style.transform='none'; this.style.boxShadow='${shadow}'; }">
          ${(!isSecret || isUnlocked) ? `<div style="position:absolute;top:6px;right:6px;font-size:9px;color:var(--wood-mid);background:rgba(255,255,255,0.5);padding:2px 4px;border-radius:4px;border:1px solid rgba(61,43,31,0.05);font-family:'Inter',sans-serif;font-weight:600;">${rarityPct}% have this</div>` : ''}
          <div style="width:36px;height:36px;border-radius:50%;background:${iconBg};display:flex;align-items:center;justify-content:center;font-size:20px;box-shadow:inset 0 2px 4px rgba(255,255,255,0.2);margin-top:12px;">
            ${displayIcon}
          </div>
          <div style="flex:1;display:flex;flex-direction:column;justify-content:center;min-height:50px;width:100%;">
            <div style="font-weight:800;font-size:12px;color:var(--wood-dark);margin-bottom:8px;letter-spacing:0.02em;">${displayName}</div>
            ${(isSecret && !isUnlocked) ? 
              `<div style="font-size:10px;color:var(--wood-light);font-weight:700;background:rgba(61,43,31,0.05);padding:2px 6px;border-radius:4px;display:inline-block;border:1px dashed rgba(61,43,31,0.15);margin:0 auto;">???</div>` :
              `<div style="font-size:9px;color:var(--wood-dark);font-weight:700;background:rgba(255,255,255,0.5);padding:4px 6px;border-radius:4px;display:inline-block;box-shadow:0 1px 3px rgba(0,0,0,0.05); border:1px solid rgba(61,43,31,0.05);white-space:normal;line-height:1.3;max-width:100%;margin:0 auto;">${displayReq}</div>`
            }
          </div>
          ${isUnlocked ? `<div style="font-size:8px;color:var(--wood-mid);margin-top:auto;padding-top:6px;font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:0.06em;border-top:1px solid rgba(212,175,55,0.25);width:100%;font-weight:600;">UNLOCKED ${formatDate(badge.earnedOn)}</div>` : ''}
        </div>
      `;
    };

    const mainBadges = catalog.filter(b => b.isUnlocked || !b.isSecret);
    const secretLockedBadges = catalog.filter(b => !b.isUnlocked && b.isSecret);

    const mainHtml = mainBadges.map(renderBadge).join('');
    const secretHtml = secretLockedBadges.map(renderBadge).join('');

    // Dedicated Subterranean Relic Showcase Pedestals
    const unlockedRelics = SUBTERRANEAN_RELICS.filter(r => finished.length >= r.threshold);

    const renderRelicPedestal = (relic) => {
      const isUnlocked = finished.length >= relic.threshold;
      const progressRatio = Math.min(1, finished.length / relic.threshold);
      const progressPct = Math.round(progressRatio * 100);

      const pedestalPlinthBg = isUnlocked
        ? 'linear-gradient(180deg, #451a03 0%, #291205 70%, #170701 100%)'
        : 'linear-gradient(180deg, rgba(61,43,31,0.2) 0%, rgba(30,15,5,0.3) 100%)';

      const auraGlow = isUnlocked
        ? 'radial-gradient(circle at 50% 40%, rgba(245, 158, 11, 0.28) 0%, rgba(212, 175, 55, 0.08) 55%, transparent 75%)'
        : 'none';

      const border = isUnlocked
        ? '1px solid rgba(212, 175, 55, 0.55)'
        : '1px dashed rgba(61, 43, 31, 0.2)';

      const cardShadow = isUnlocked
        ? '0 6px 20px rgba(69, 26, 3, 0.18), inset 0 1px 0 rgba(254, 240, 138, 0.3)'
        : '0 2px 6px rgba(0,0,0,0.04)';

      return `
        <div class="trophy-relic-card ${isUnlocked ? 'is-unlocked' : 'is-locked'}"
             onclick="App.showRelicDetailsModal('${relic.id}')"
             style="background: #ffffff; border: ${border}; border-radius: 12px; padding: 14px 10px 10px; display: flex; flex-direction: column; align-items: center; text-align: center; position: relative; box-shadow: ${cardShadow}; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;"
             onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 12px 28px rgba(69, 26, 3, 0.22)';"
             onmouseout="this.style.transform='none'; this.style.boxShadow='${cardShadow}';">
          
          <div style="position: absolute; top: 6px; right: 6px; font-size: 8.5px; font-family: 'DM Mono', monospace; font-weight: 600; padding: 2px 5px; border-radius: 4px; ${isUnlocked ? 'background: rgba(245, 158, 11, 0.15); color: #b45309; border: 1px solid rgba(245, 158, 11, 0.3);' : 'background: rgba(61,43,31,0.06); color: var(--wood-light);'}">
            ${isUnlocked ? 'UNEARTHED' : `${finished.length}/${relic.threshold}`}
          </div>

          <!-- Relic Display Chamber with Pedestal Plinth -->
          <div style="width: 100%; height: 86px; position: relative; display: flex; align-items: center; justify-content: center; background: ${auraGlow}; margin-top: 4px;">
            <!-- 3D Vector SVG Art -->
            <div style="width: 68px; height: 68px; z-index: 2; display: flex; align-items: center; justify-content: center; ${isUnlocked ? 'filter: drop-shadow(0 4px 10px rgba(212, 175, 55, 0.5));' : 'filter: grayscale(0.7) opacity(0.4);'}">
              <svg viewBox="${relic.viewBox}" style="width: 100%; height: 100%; overflow: visible;" preserveAspectRatio="xMidYMid meet">
                ${relic.art}
              </svg>
            </div>
            <!-- Museum Pedestal Plinth -->
            <div style="position: absolute; bottom: 0; left: 15%; right: 15%; height: 10px; background: ${pedestalPlinthBg}; border-radius: 3px 3px 1px 1px; box-shadow: 0 4px 8px rgba(0,0,0,0.25); border-top: 1px solid rgba(212, 175, 55, 0.6); z-index: 1;">
              <div style="position: absolute; bottom: -3px; left: -4%; right: -4%; height: 4px; background: #170701; border-radius: 2px; opacity: 0.8;"></div>
            </div>
          </div>

          <!-- Relic Title and Milestone -->
          <div style="margin-top: 8px; font-weight: 700; font-size: 11.5px; color: var(--wood-dark); line-height: 1.25; min-height: 28px; display: flex; align-items: center; justify-content: center;">
            ${relic.seal} ${relic.name}
          </div>
          <div style="font-size: 9.5px; font-family: 'DM Mono', monospace; color: ${isUnlocked ? 'var(--accent-gold, #b45309)' : 'var(--wood-light)'}; margin-top: 2px;">
            ${relic.milestone}
          </div>

          ${!isUnlocked ? `
            <div style="width: 100%; margin-top: 8px; background: rgba(61,43,31,0.08); height: 4px; border-radius: 2px; overflow: hidden;">
              <div style="width: ${progressPct}%; height: 100%; background: linear-gradient(90deg, #d97706, #fbbf24); border-radius: 2px;"></div>
            </div>
          ` : `
            <div style="font-size: 8px; color: var(--wood-mid); margin-top: 6px; font-family: 'DM Mono', monospace; letter-spacing: 0.05em; text-transform: uppercase;">
              Tap to inspect
            </div>
          `}
        </div>
      `;
    };

    const relicsHtml = SUBTERRANEAN_RELICS.map(renderRelicPedestal).join('');

    container.innerHTML = `
      <div style="background:linear-gradient(135deg,rgba(139,38,53,0.08),rgba(212,175,55,0.12));border-radius:14px;padding:18px 20px;margin-bottom:24px;box-shadow:0 4px 12px rgba(139,38,53,0.05);">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="font-size:36px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.1));">${rank.icon}</div>
            <div>
              <div style="font-size:10px;font-family:'DM Mono',monospace;letter-spacing:0.14em;text-transform:uppercase;color:var(--wood-light);">Reader Status</div>
              <div style="font-size:18px;font-weight:700;color:var(--wood-dark);font-family:'Playfair Display',Georgia,serif;">${rank.title}</div>
              <div style="font-size:11px;color:var(--wood-light);">${finished.length} books · ${wordsStr} words read</div>
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:24px;font-weight:700;color:var(--burgundy,#8b2635);font-family:'Playfair Display',Georgia,serif;">${unlockedCount} <span style="font-size:14px;color:var(--wood-light);font-family:Inter,sans-serif;">/ ${catalog.length}</span></div>
            <div style="font-size:10px;font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:0.1em;color:var(--wood-light);">Badges Earned</div>
          </div>
        </div>
        <div style="margin-top:16px;background:rgba(61,43,31,0.1);height:6px;border-radius:3px;overflow:hidden;">
          <div id="badgeProgressBar" style="height:100%;width:${pct}%;background:linear-gradient(90deg, var(--highlight, #d4af37), var(--burgundy, #8b2635));transition:width 1.2s cubic-bezier(0.2, 0.8, 0.2, 1);border-radius:3px;"></div>
        </div>
      </div>

      <!-- Dedicated Subterranean Relic Showcase Pedestals -->
      <div style="margin: 28px 0 14px 0; display: flex; flex-direction: column; gap: 4px;">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 18px;">🏛️</span>
            <div>
              <div style="font-size: 10px; font-family: 'DM Mono', monospace; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent-gold, #b45309); font-weight: 600;">Subterranean Archeology</div>
              <div style="font-size: 16px; font-weight: 700; color: var(--wood-dark); font-family: 'Playfair Display', Georgia, serif;">Unearthed Relic Showcase</div>
            </div>
          </div>
          <button onclick="if(window.App && typeof window.App.openReadingTree==='function'){ window.App.closeModal('trophyRoomModal'); window.App.openReadingTree(); }"
                  style="background: rgba(139,38,53,0.08); border: 1px solid rgba(139,38,53,0.2); border-radius: 6px; padding: 6px 10px; font-family: 'DM Mono', monospace; font-size: 10px; font-weight: 600; color: var(--burgundy, #8b2635); cursor: pointer; display: inline-flex; align-items: center; gap: 5px; transition: background 0.2s;">
            <span>🌳 View in Tree ↗</span>
          </button>
        </div>
        <div style="font-size: 11px; color: var(--wood-light); margin-top: 2px;">
          Unearthed from the deep strata of your Reading Tree as your reading roots plunge deeper. ${unlockedRelics.length} of ${SUBTERRANEAN_RELICS.length} relics discovered.
        </div>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; margin-bottom: 30px;">
        ${relicsHtml}
      </div>

      <!-- Reading Medals & Milestones -->
      <div style="margin: 20px 0 12px 0; display: flex; align-items: center; text-align: center; color: var(--wood-light); font-size: 10px; font-family: 'DM Mono', monospace; letter-spacing: 0.15em; text-transform: uppercase;">
         <div style="flex: 1; height: 1px; background: linear-gradient(90deg, transparent, rgba(61,43,31,0.1));"></div>
         <div style="padding: 0 14px;">READING MEDALS &amp; MILESTONES</div>
         <div style="flex: 1; height: 1px; background: linear-gradient(270deg, transparent, rgba(61,43,31,0.1));"></div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(110px, 1fr));gap:12px;">
        ${mainHtml}
      </div>
      ${secretHtml ? `
      <div style="margin:32px 0 24px 0;display:flex;align-items:center;text-align:center;color:var(--wood-light);font-size:10px;font-family:'DM Mono',monospace;letter-spacing:0.15em;text-transform:uppercase;">
         <div style="flex:1;height:1px;background:linear-gradient(90deg, transparent, rgba(61,43,31,0.1));"></div>
         <div style="padding:0 16px;">SECRET BADGES</div>
         <div style="flex:1;height:1px;background:linear-gradient(270deg, transparent, rgba(61,43,31,0.1));"></div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(110px, 1fr));gap:12px;">
        ${secretHtml}
      </div>
      ` : ''}
    `;
    
    // Progress bar is now pre-filled in HTML to prevent rendering bugs
  }

// Global binding
if (typeof window !== 'undefined') {
  window.showRelicDetailsModal = showRelicDetailsModal;
  if (window.App) {
    window.App.showRelicDetailsModal = showRelicDetailsModal;
    window.App.openTrophyRoom = openTrophyRoom;
  }
}
