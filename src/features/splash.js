/**
 * ShelfLife Splash & Boot Loader Feature (src/features/splash.js)
 * Handles animated 3D falling book spines, particle poof physics, sparkle generator,
 * randomized palette/texture/rib generator, and replayAnimation controller.
 */

export const palettes = [
  { spine: '#6b2727', cover: '#8a3333', text: '#f0d0d0' },
  { spine: '#2a4a32', cover: '#3a5c43', text: '#d0f0d8' },
  { spine: '#2a3d5c', cover: '#384e73', text: '#d0e0f0' },
  { spine: '#2a3d45', cover: '#384e57', text: '#d0e8f0' },
  { spine: '#5c3a21', cover: '#734c2f', text: '#f0e0d0' },
  { spine: '#4a2a4a', cover: '#5c3a5c', text: '#f0d0f0' },
  { spine: '#4a4a2a', cover: '#5c5c3a', text: '#f0f0d0' },
  { spine: '#252525', cover: '#363636', text: '#e0e0e0' }
];

export const textures = [
  `repeating-linear-gradient(45deg, rgba(0,0,0,0.06) 0px, rgba(0,0,0,0.06) 2px, transparent 2px, transparent 4px), repeating-linear-gradient(-45deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 2px, transparent 2px, transparent 4px)`,
  `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.25'/%3E%3C/svg%3E")`,
  `repeating-linear-gradient(to right, rgba(0,0,0,0.04) 0px, rgba(0,0,0,0.04) 1px, transparent 1px, transparent 3px)`,
  `linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0.3) 100%)`
];

export const blankTitles = ["VOL. I", "NOTES", "INDEX", "TOME", "ARCHIVE", "RECORD", "JOURNAL"];

let availablePalettes = [];
let availableTitles = [...blankTitles];

export function getRandomPalette() {
  if (availablePalettes.length === 0) availablePalettes = [...palettes];
  const idx = Math.floor(Math.random() * availablePalettes.length);
  return availablePalettes.splice(idx, 1)[0];
}

export function generateRibs(spineWidth, isTitle) {
  const ribStyles = [];
  const colorDark = 'rgba(0,0,0,0.5)';
  const colorLight = 'rgba(255,255,255,0.15)';

  let type;
  if (isTitle) {
    type = Math.floor(Math.random() * 2);
  } else {
    type = Math.floor(Math.random() * 4);
  }

  if (type === 0) {
    ribStyles.push(`linear-gradient(to right, transparent 30px, ${colorLight} 30px, ${colorDark} 38px, transparent 38px)`);
    ribStyles.push(`linear-gradient(to right, transparent ${spineWidth - 38}px, ${colorLight} ${spineWidth - 38}px, ${colorDark} ${spineWidth - 30}px, transparent ${spineWidth - 30}px)`);
  } else if (type === 1) {
    ribStyles.push(`linear-gradient(to right, transparent 20px, ${colorLight} 20px, ${colorDark} 24px, transparent 24px)`);
    ribStyles.push(`linear-gradient(to right, transparent 50px, ${colorLight} 50px, ${colorDark} 54px, transparent 54px)`);
    ribStyles.push(`linear-gradient(to right, transparent ${spineWidth - 54}px, ${colorLight} ${spineWidth - 54}px, ${colorDark} ${spineWidth - 50}px, transparent ${spineWidth - 50}px)`);
    ribStyles.push(`linear-gradient(to right, transparent ${spineWidth - 24}px, ${colorLight} ${spineWidth - 24}px, ${colorDark} ${spineWidth - 20}px, transparent ${spineWidth - 20}px)`);
  } else if (type === 2) {
    const gap = spineWidth / 6;
    for (let i = 1; i <= 5; i++) {
      let pos = i * gap;
      ribStyles.push(`linear-gradient(to right, transparent ${pos}px, ${colorLight} ${pos}px, ${colorDark} ${pos + 4}px, transparent ${pos + 4}px)`);
    }
  } else {
    const gap = spineWidth / 4;
    for (let i = 1; i <= 3; i++) {
      let pos = i * gap;
      ribStyles.push(`linear-gradient(to right, transparent ${pos - 10}px, ${colorLight} ${pos - 10}px, ${colorDark} ${pos + 10}px, transparent ${pos + 10}px)`);
    }
  }

  ribStyles.push(`linear-gradient(to bottom, rgba(255,255,255,0.05), rgba(0,0,0,0.3))`);
  return ribStyles.join(', ');
}

export function randomizeBook(bookEl) {
  if (!bookEl) return;
  const isTitle = bookEl.querySelector('.title') !== null;

  const twist = Math.floor(Math.random() * 30) - 15;
  const spineWidth = 320 + twist;
  const pagesWidth = 40 - twist;

  const shiftX = Math.floor(Math.random() * 36) - 18;
  const leftOffset = (-twist / 2) + shiftX;
  const coverHeight = pagesWidth * 0.364;

  const palette = getRandomPalette();
  const texture = textures[Math.floor(Math.random() * textures.length)];
  let spineInner = bookEl.querySelector('.splash-spine');
  let hasSubtleTitle = false;
  if (!isTitle && spineInner) {
    if (availableTitles.length === 0) availableTitles = [...blankTitles];
    const tIdx = Math.floor(Math.random() * availableTitles.length);
    const txt = availableTitles.splice(tIdx, 1)[0];
    spineInner.innerHTML = `<span class="title-subtle" style="color: ${palette.text || '#e0e0e0'}">${txt}</span>`;
    hasSubtleTitle = true;
  }
  const ribs = generateRibs(spineWidth, isTitle || hasSubtleTitle);

  bookEl.style.left = leftOffset + 'px';

  const splashSpine = bookEl.querySelector('.splash-spine');
  if (splashSpine) {
    splashSpine.style.width = spineWidth + 'px';
    splashSpine.style.backgroundColor = palette.spine;
    splashSpine.style.backgroundImage = `${ribs}, ${texture}`;
  }

  const pages = bookEl.querySelector('.pages');
  if (pages) {
    pages.style.width = pagesWidth + 'px';
    pages.style.left = (spineWidth - 1) + 'px';
    pages.style.borderTop = `3px solid ${palette.cover}`;
    pages.style.borderBottom = `4px solid ${palette.spine}`;
  }

  const splashCover = bookEl.querySelector('.splash-cover');
  if (splashCover) {
    splashCover.style.width = spineWidth + 'px';
    splashCover.style.height = coverHeight + 'px';
    splashCover.style.backgroundColor = palette.cover;
    splashCover.style.backgroundImage = texture;
  }

  const bookmark = bookEl.querySelector('.bookmark-wrapper');
  if (bookmark) {
    bookmark.style.left = (pagesWidth / 2 - 7) + 'px';
  }
}

export function randomizeAllBooks() {
  availablePalettes = [...palettes];
  if (typeof document !== 'undefined') {
    document.querySelectorAll('.book-fake3d').forEach(book => {
      randomizeBook(book);
    });
  }
}

export function createPoof(bottomY) {
  if (typeof document === 'undefined') return;
  const container = document.querySelector('.books-container');
  if (!container) return;

  for (let i = 0; i < 12; i++) {
    const p = document.createElement('div');
    p.className = 'poof-particle';
    const startX = Math.random() * 300 + 10;
    p.style.left = startX + 'px';
    p.style.bottom = (bottomY - 8) + 'px';
    container.appendChild(p);

    const dir = startX > 160 ? 1 : -1;
    const tx = dir * (Math.random() * 60 + 20);
    const ty = (Math.random() - 0.5) * 20;
    const scale = Math.random() * 1.5 + 0.5;

    if (typeof p.animate === 'function') {
      p.animate([
        { transform: `translate(0, 0) scale(0.2)`, opacity: 1 },
        { transform: `translate(${tx}px, ${ty}px) scale(${scale})`, opacity: 0 }
      ], { duration: 250 + Math.random() * 200, easing: 'ease-out', fill: 'forwards' });
    }
  }
}

export function showStaticSplash() {
  if (typeof window !== 'undefined') {
    if (!window.splashTimeouts) window.splashTimeouts = [];
  }
  if (typeof document === 'undefined') return;
  const container = document.getElementById('authBootLoader') || document.getElementById('splashScreen');
  const splashScreen = document.getElementById('splashScreen');
  if (!container && !splashScreen) return;

  if (window.splashTimeouts) {
    window.splashTimeouts.forEach(t => clearTimeout(t));
    window.splashTimeouts = [];
  }
  if (typeof window !== 'undefined' && window.Auth && window.Auth._bootTimeout) {
    clearTimeout(window.Auth._bootTimeout);
  }

  const targets = Array.from(new Set([container, splashScreen].filter(Boolean)));
  targets.forEach(el => {
    el.style.setProperty('display', 'flex', 'important');
    el.style.opacity = '1';
    if (el.dataset) delete el.dataset.hidden;
    el.classList.remove('animate-draw', 'animate-text', 'animate-fill', 'splash-out', 'animate-exit');
    el.classList.add('splash-static');
  });
}

export function showAnimatedSplash(onComplete) {
  if (typeof window !== 'undefined') {
    window.replayAnimation = showAnimatedSplash;
    window.playAnimation = showAnimatedSplash;
    if (!window.splashTimeouts) window.splashTimeouts = [];
    window.splashStartTime = window.splashStartTime || Date.now();
  }

  if (typeof document === 'undefined') return;
  const container = document.getElementById('authBootLoader') || document.getElementById('splashScreen');
  const splashScreen = document.getElementById('splashScreen');
  if (!container && !splashScreen) return;

  // Clear old timeouts
  if (window.splashTimeouts) {
    window.splashTimeouts.forEach(t => clearTimeout(t));
    window.splashTimeouts = [];
  }
  if (typeof window !== 'undefined' && window.Auth && window.Auth._bootTimeout) {
    clearTimeout(window.Auth._bootTimeout);
  }

  const targets = Array.from(new Set([container, splashScreen].filter(Boolean)));

  // Reset classes
  targets.forEach(el => {
    el.style.setProperty('display', 'flex', 'important');
    el.style.opacity = '1';
    if (el.dataset) delete el.dataset.hidden;
    el.classList.remove('splash-static', 'animate-text', 'animate-fill', 'splash-out', 'animate-exit');
  });
  
  // Force reflow
  if (container) void container.offsetWidth;
  
  // Step 1: Draw outline
  targets.forEach(el => el.classList.add('animate-draw'));
  
  // Step 2: Text reveal
  window.splashTimeouts.push(setTimeout(() => {
    targets.forEach(el => el.classList.add('animate-text'));
  }, 600));
  
  // Step 3: Color bloom
  window.splashTimeouts.push(setTimeout(() => {
    targets.forEach(el => el.classList.add('animate-fill'));
  }, 600));

  // Step 4: Graceful dismissal
  window.splashTimeouts.push(setTimeout(() => {
    dismissSplash(false);
    if (typeof onComplete === 'function') onComplete();
  }, 2800));
}

export function replayAnimation() {
  if (typeof window !== 'undefined') window.splashStartTime = Date.now();
  showAnimatedSplash();
}

export const playAnimation = showAnimatedSplash;

export function dismissSplash(fast = false) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.remove('has-returning-session');
  document.documentElement.classList.add('auth-ready');
  const bbl = document.getElementById('authBootLoader');
  const splash = document.getElementById('splashScreen');
  const targets = Array.from(new Set([bbl, splash].filter(Boolean)));

  const startTime = (typeof window !== 'undefined' && window.splashStartTime) ? window.splashStartTime : Date.now();
  const elapsed = Date.now() - startTime;
  const minDuration = fast ? 0 : 2800;
  const remaining = Math.max(0, minDuration - elapsed);

  setTimeout(() => {
    targets.forEach(el => {
      el.style.opacity = '0';
      el.classList.add('splash-out');
      setTimeout(() => {
        el.style.setProperty('display', 'none', 'important');
        el.classList.remove('splash-out', 'splash-static');
      }, 800);
    });
  }, remaining);
}

export function initSplashScreen() {
  showAnimatedSplash();
}

export const Splash = {
  palettes,
  textures,
  blankTitles,
  getRandomPalette,
  generateRibs,
  randomizeBook,
  randomizeAllBooks,
  createPoof,
  showStaticSplash,
  showAnimatedSplash,
  replayAnimation,
  playAnimation,
  initSplashScreen,
  dismissSplash
};

export default Splash;
