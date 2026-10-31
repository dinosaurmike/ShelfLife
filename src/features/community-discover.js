import { DB, dbToBook } from '../core/db.js';

export async function renderDiscoverReaders() {
    const host = document.getElementById('discoverReaders');
    if (host) {
      host.style.display = 'none';
      host.innerHTML = '';
    }

    if (this.profilePublic === false) {
      if (typeof App.initDiscoverVisuals === 'function') App.initDiscoverVisuals([]);
      return;
    }

    let BOOKS = (this.books || []).filter(b => b && !b.currentlyReading && !b.currently_reading && b.status !== 'to-read' && b.status !== 'reading');
    if (BOOKS.length < 3) {
      BOOKS = (this.books || []).length > 0 ? this.books : (window._BOOKS || []);
    }

    try {
      const mySig = App._readerSignature(BOOKS);
      const profiles = await DB.getPublicProfiles(this.userId);

      if (!profiles || !profiles.length) {
        if (typeof App.initDiscoverVisuals === 'function') App.initDiscoverVisuals([]);
        return;
      }

      const matches = [];
      const ignored = JSON.parse(localStorage.getItem('sl_ignored_readers') || '[]');
      const candidates = profiles.filter(p => !ignored.includes(p.user_id)).sort(() => 0.5 - Math.random()).slice(0, 40);

      for (const p of candidates) {
        let theirBooks = [];
        try { theirBooks = await DB.getPublicUserBooks(p.user_id); } catch (e) { theirBooks = []; }
        if (!theirBooks || theirBooks.length < 1) continue;

        const sig = App._readerSignature(theirBooks);
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

      if (typeof App.initDiscoverVisuals === 'function') {
        App.initDiscoverVisuals(matches.slice(0, 75));
      }
    } catch (e) {
      console.warn('[renderDiscoverReaders] error:', e);
      if (typeof App.initDiscoverVisuals === 'function') App.initDiscoverVisuals([]);
    }
  }

export function initDiscoverVisuals(topReaders) { try {

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
        let radius = 110 + (70 - m.score) * 5.6;
        // Clamp radius to keep them on screen (min 30px, max 350px)
        radius = Math.max(45, Math.min(525, radius));
        
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
        const mapBookObj = b => ({ title: b.title, isbn: b.isbn, cover: b.cover_url || b.coverUrl || b.cover || (b.isbn ? `https://books.google.com/books/content?vid=ISBN${b.isbn}&printsec=frontcover&img=1&zoom=1` : (b.fallbackCover || `https://covers.openlibrary.org/b/title/${encodeURIComponent((b.title||'').toLowerCase())}-M.jpg?default=false`)) });
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
            coverToUse = b.cover_url || b.coverUrl || b.cover || (b.isbn ? `https://books.google.com/books/content?vid=ISBN${b.isbn}&printsec=frontcover&img=1&zoom=1` : (b.fallbackCover || `https://covers.openlibrary.org/b/title/${encodeURIComponent((b.title||'').toLowerCase())}-M.jpg?default=false`));
            matchData.coverTitle = b.title;
            matchData.coverContext = 'Most Recent Read';
        } else if (m.shared && m.shared.exactMatches && m.shared.exactMatches.length > 0) {
            const b = m.shared.exactMatches[0];
            coverToUse = b.cover_url || b.coverUrl || b.cover || (b.isbn ? `https://books.google.com/books/content?vid=ISBN${b.isbn}&printsec=frontcover&img=1&zoom=1` : (b.fallbackCover || `https://covers.openlibrary.org/b/title/${encodeURIComponent((b.title||'').toLowerCase())}-M.jpg?default=false`));
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

    constWrapper.addEventListener('click', (e) => {
        if (!e.target.closest('.const-node') && !e.target.closest('#detailPanel')) {
            App.resetGalaxyZoom(e);
        }
    });
    
    this._animateGalaxy();
    } catch (err) { alert('Galaxy Error: ' + err.message + '\n' + err.stack); console.error(err); }
 }

export function _readerSignature(books) {
    const genres = new Set(), authors = new Set(), moods = new Set();
    (books || []).forEach(b => {
      if (b.genre) genres.add(String(b.genre).toLowerCase().trim());
      if (b.author) authors.add(String(b.author).toLowerCase().trim());
      const ms = Array.isArray(b.moods) ? b.moods : (Array.isArray(b.mood) ? b.mood : []);
      ms.forEach(m => { if (m) moods.add(String(m).toLowerCase().trim()); });
    });
    return { genres, authors, moods };
  }

export function resetGalaxyZoom(e) {
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
 }

let _dnaResizeObserver = null;
let _dnaResizeDebounce = null;

export function _ensureDNAResponsiveStyles() {
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
}

export function _attachDNAResizeListener() {
    if (typeof window === 'undefined') return;

    if (!window._sl_dna_resize_attached) {
        window._sl_dna_resize_attached = true;
        window.addEventListener('resize', () => {
            clearTimeout(_dnaResizeDebounce);
            _dnaResizeDebounce = setTimeout(() => {
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
        if (!_dnaResizeObserver) {
            _dnaResizeObserver = new ResizeObserver((entries) => {
                for (const entry of entries) {
                    if (entry.contentRect.width > 0) {
                        clearTimeout(_dnaResizeDebounce);
                        _dnaResizeDebounce = setTimeout(() => {
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
            _dnaResizeObserver.observe(wrapper);
        }
    }
}

export async function _loadDNANetwork() {
    const listEl = document.getElementById('friendOverlayList');
    if (!listEl) return;
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
                'Literary': { id: 'literary', label: 'Literary', score: 0, genres: ['Literary Fiction', 'Classics', 'Contemporary Fiction', 'Literary', 'Contemporary'] },
                'Historical': { id: 'historical', label: 'Historical', score: 0, genres: ['Historical Fiction', 'History', 'Period', 'Historical'] },
                'Non-Fiction': { id: 'nonFiction', label: 'Non-Fiction', score: 0, genres: ['Non-Fiction', 'Biography', 'Memoir', 'Science', 'Essays'] },
                'Self-Help': { id: 'selfHelp', label: 'Self-Help', score: 0, genres: ['Self-Help', 'Personal Development', 'Productivity', 'Philosophy', 'Health', 'Psychology'] },
                'Young Adult': { id: 'ya', label: 'Young Adult', score: 0, genres: ['Young Adult', 'YA', 'Teen', 'New Adult'] },
                'Lighthearted': { id: 'lighthearted', label: 'Lighthearted', score: 0, genres: ['Comedy', 'Humor', 'Cozy Mystery', 'Middle Grade', 'Graphic Novel', 'Cozy'] }
            };

            books.forEach(b => {
                const g = (b.genre || '').trim().toLowerCase();
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

        listEl.innerHTML = '';
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
}

export function _drawDNARadar(containerId = 'goalRadarSvg', books) {
    const goalSvg = document.getElementById(containerId);
    if (!goalSvg) return;

    _ensureDNAResponsiveStyles();
    _attachDNAResizeListener();

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
        'Literary': { id: 'literary', label: 'Literary', score: 0, genres: ['Literary Fiction', 'Classics', 'Contemporary Fiction', 'Literary', 'Contemporary'] },
        'Historical': { id: 'historical', label: 'Historical', score: 0, genres: ['Historical Fiction', 'History', 'Period', 'Historical'] },
        'Non-Fiction': { id: 'nonFiction', label: 'Non-Fiction', score: 0, genres: ['Non-Fiction', 'Biography', 'Memoir', 'Science', 'Essays'] },
        'Self-Help': { id: 'selfHelp', label: 'Self-Help', score: 0, genres: ['Self-Help', 'Personal Development', 'Productivity', 'Philosophy', 'Health', 'Psychology'] },
        'Young Adult': { id: 'ya', label: 'Young Adult', score: 0, genres: ['Young Adult', 'YA', 'Teen', 'New Adult'] },
        'Lighthearted': { id: 'lighthearted', label: 'Lighthearted', score: 0, genres: ['Comedy', 'Humor', 'Cozy Mystery', 'Middle Grade', 'Graphic Novel', 'Cozy'] }
    };

    consumedBooks.forEach(b => {
        const g = (b.genre || '').trim().toLowerCase();
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
}

export function _generateRadarSvg(baseBooks, overlayBooks, size = 100, showOutline = true) {
      const traits = {
                'Romance': { genres: ['Romance', 'Contemporary Romance', 'Love'] },
                'Spicy': { genres: ['Smut', 'Erotica', 'Spicy', 'Dark Romance'] },
                'Dark Vibe': { genres: ['Horror', 'Dark Fantasy', 'Gothic', 'Dark', 'Grimdark'] },
                'True Crime': { genres: ['True Crime', 'Crime', 'Crime Non-Fiction'] },
                'Fast Pace': { genres: ['Thriller', 'Action', 'Adventure', 'Mystery', 'Suspense'] },
                'Epic World': { genres: ['Fantasy', 'Science Fiction', 'High Fantasy', 'Sci-Fi', 'Dystopian', 'Space Opera'] },
                'Literary': { genres: ['Literary Fiction', 'Classics', 'Contemporary Fiction', 'Literary', 'Contemporary'] },
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
              const g = (b.genre || '').trim().toLowerCase();
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
}


