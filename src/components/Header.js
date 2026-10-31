/**
 * src/components/Header.js
 * Header, Eyebrow, Hamburger Menu (#accountBtn), and Slide-out Drawer (#slideMenu) Module
 */

import { SYMBOLS } from '../constants/symbols.js';
import { isAppAdmin } from '../utils/constants.js';

export function toggleSlideMenu(appInstance) {
  const app = appInstance || (typeof window !== 'undefined' ? window.App : null);
  if (!app) return;

  try {
    app._slideMenuOpen = !app._slideMenuOpen;
    const slideMenu = document.getElementById('slideMenu');
    const menuBackdrop = document.getElementById('menuBackdrop');
    const accountBtn = document.getElementById('accountBtn');

    if (slideMenu) slideMenu.classList.toggle('open', app._slideMenuOpen);
    if (menuBackdrop) menuBackdrop.classList.toggle('open', app._slideMenuOpen);
    if (accountBtn) accountBtn.classList.toggle('open', app._slideMenuOpen);

    if (app._slideMenuOpen) {
      updateSlideMenuInfo(app);
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

export function closeSlideMenu(appInstance) {
  const app = appInstance || (typeof window !== 'undefined' ? window.App : null);
  if (app) app._slideMenuOpen = false;

  const slideMenu = document.getElementById('slideMenu');
  const menuBackdrop = document.getElementById('menuBackdrop');
  const accountBtn = document.getElementById('accountBtn');

  if (slideMenu) slideMenu.classList.remove('open');
  if (menuBackdrop) menuBackdrop.classList.remove('open');
  if (accountBtn) accountBtn.classList.remove('open');
}

export function updateSlideMenuInfo(appInstance) {
  const app = appInstance || (typeof window !== 'undefined' ? window.App : null);
  if (!app) return;

  try {
    const name = app.displayName || app.ownerDisplayName || 'Reader';
    const nameEl = document.getElementById('menuUserName');
    if (nameEl) nameEl.textContent = name;

    const bookCount = (app.books || []).filter(b => !b.currentlyReading && b.status !== 'to-read').length;
    const statsEl = document.getElementById('menuUserStats');
    if (statsEl) {
      statsEl.textContent = `${bookCount} book${bookCount !== 1 ? 's' : ''} in ${app.currentYear || new Date().getFullYear()}`;
    }

    if (typeof app._applyMenuAvatar === 'function') {
      app._applyMenuAvatar();
    }

    const isAdmin = isAppAdmin(app);
    const mai = document.getElementById('menuAnalyticsItem');
    if (mai) mai.style.display = isAdmin ? '' : 'none';
    const mli = document.getElementById('menuLaserItem');
    if (mli) mli.style.display = isAdmin ? '' : 'none';
    const dmi = document.getElementById('analyticsMenuItem');
    if (dmi) dmi.style.display = isAdmin ? '' : 'none';
    const dli = document.getElementById('desktopLaserItem');
    if (dli) dli.style.display = isAdmin ? '' : 'none';
    const lwb = document.getElementById('laserWaitlistBtn');
    if (lwb) lwb.style.display = isAdmin ? 'inline-flex' : 'none';
  } catch (e) {
    console.error('Update Slide Menu Info Error:', e);
  }
}

export async function changeYear(appInstance, delta) {
  const app = appInstance || (typeof window !== 'undefined' ? window.App : null);
  if (!app) return;

  const currentRealYear = new Date().getFullYear();
  const parsedCurrent = parseInt(app.currentYear, 10) || currentRealYear;
  const targetYear = parsedCurrent + delta;
  if (isNaN(targetYear) || targetYear > currentRealYear || targetYear < 1900) return;

  return await setYear(app, targetYear);
}

export function updateMastheadTitle(appInstance) {
    const app = appInstance || (typeof window !== 'undefined' ? window.App : null);
    if (!app) return;
  
    const isAdmin = isAppAdmin(app);
    const lwb = document.getElementById('laserWaitlistBtn');
    if (lwb) lwb.style.display = isAdmin ? 'inline-flex' : 'none';

    const year = app.currentYear || new Date().getFullYear();
    const range = app.multiYearRange || 'single';

  const titleMap = {
    'single': `Reading <em>Record (${year})</em>`,
    '3': 'Reading <em>Record (Last 3 Years)</em>',
    '5': 'Reading <em>Record (Last 5 Years)</em>',
    '10': 'Reading <em>Record (Last 10 Years)</em>',
    '15': 'Reading <em>Record (Last 15 Years)</em>',
    'lifetime': 'Reading <em>Record (Lifetime)</em>'
  };
  const wmMap = {
    'single': String(year),
    '3': '3Y',
    '5': '5Y',
    '10': '10Y',
    '15': '15Y',
    'lifetime': 'ALL'
  };

  const mt = document.getElementById('mastheadTitle');
  if (mt) mt.innerHTML = titleMap[range] || `Reading <em>Record (${year})</em>`;

  const yrWm = document.getElementById('yearWatermark');
  if (yrWm) yrWm.textContent = wmMap[range] || String(year);
}

export async function setYear(appInstance, yr) {
  const app = appInstance || (typeof window !== 'undefined' ? window.App : null);
  if (!app) return;

  const yearNum = parseInt(yr, 10);
  const currentRealYear = new Date().getFullYear();
  if (isNaN(yearNum) || yearNum < 1900 || yearNum > currentRealYear) return;

  app.currentYear = yearNum;
  const yearInput = document.getElementById('yearInput');
  if (yearInput) yearInput.value = yearNum;

  updateMastheadTitle(app);

  if (typeof app.loadYear === 'function') {
    await app.loadYear(yearNum);
  }
  if (typeof app.render === 'function') {
    app.render();
  }
}

export function toggleMultiYearMenu(appInstance) {
  const app = appInstance || (typeof window !== 'undefined' ? window.App : null);
  if (!app) return;

  app._multiYearMenuOpen = !app._multiYearMenuOpen;
  const menu = document.getElementById('multiYearMenu');
  if (menu) menu.classList.toggle('open', app._multiYearMenuOpen);
}

export async function setMultiYearRange(appInstance, range) {
  const app = appInstance || (typeof window !== 'undefined' ? window.App : null);
  if (!app) return;

  app.multiYearRange = range;
  app._multiYearMenuOpen = false;
  const menu = document.getElementById('multiYearMenu');
  if (menu) menu.classList.remove('open');

  try {
    localStorage.setItem('shelf_life_multi_year_range', range);
  } catch (e) {}

  document.querySelectorAll('.multi-year-menu-item').forEach(el => {
    el.classList.toggle('selected', el.dataset.range === range);
  });

  const btn = document.getElementById('multiYearBtn');
  if (btn) btn.classList.toggle('active', range !== 'single');

  updateMastheadTitle(app);

  if (range === 'single') {
    app.aggregateBooks = [];
    app.aggregateYearData = {};
    if (typeof app._showAnnualView === 'function') app._showAnnualView();
    if (typeof app.render === 'function') {
      app.render();
    }
  } else {
    if (typeof app._loadAggregateData === 'function') {
      await app._loadAggregateData(range);
    }
    if (typeof app._showAggregateView === 'function') app._showAggregateView();
    if (typeof app.renderAggregateView === 'function') {
      app.renderAggregateView();
    } else if (typeof app.render === 'function') {
      app.render();
    }
  }
}

export function initHeader(appInstance) {
  const app = appInstance || (typeof window !== 'undefined' ? window.App : null);
  if (!app) return;

  // Bind methods to App instance for seamless onclick execution
  app.toggleSlideMenu = () => toggleSlideMenu(app);
  app.closeSlideMenu = () => closeSlideMenu(app);
  app._updateSlideMenuInfo = () => updateSlideMenuInfo(app);
  app.changeYear = (delta) => changeYear(app, delta);
  app.setYear = (yr) => setYear(app, yr);
  app.toggleMultiYearMenu = () => toggleMultiYearMenu(app);
  app.setMultiYearRange = (range) => setMultiYearRange(app, range);
  app.updateMastheadTitle = () => updateMastheadTitle(app);
}
