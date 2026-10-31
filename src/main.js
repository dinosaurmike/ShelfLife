/**
 * src/main.js
 * ShelfLife Application Entry Point & Module Orchestrator
 */

import './style.css';
import * as symbolsModule from './constants/symbols.js';
import * as headerModule from './components/Header.js';
import * as mastheadModule from './components/Masthead.js';
import * as monthlyPaceModule from './components/MonthlyPace.js';
import * as bookShelfModule from './components/BookShelf.js';
import * as domModule from './utils/dom.js';
import { WORD_COUNT_OVERRIDES, lookupWordCountOverride, dbToBook, SyncQueue } from './core/db.js';
import { WordCountAPI, DuplicateDetector, CameraScanner, ScannerLoader, GoogleBooksRating, WikidataAPI, GenderAPI, NationalizeAPI, guessGenderFromName, getNationalitiesForAuthor, SeriesMetadataFetcher } from './features/search.js';
import { CommunityFeatures } from './features/community.js';
import App from './core/app.js';
import Stats from './features/stats.js';
import Splash from './features/splash.js';
import Search from './features/search.js';
import * as Bookshelf from './features/bookshelf.js';
import * as CommunityAdmin from './features/community-admin.js';
import * as CommunityDiscover from './features/community-discover.js';
import { aggregateViewMethods } from './features/aggregate-view.js';
import * as mathModule from './utils/math.js';
import { isWordCountEstimated, pagesToWords } from './utils/math.js';
import * as constantsModule from './utils/constants.js';
import { ALL_MONTHS } from './utils/constants.js';

export {
  symbolsModule,
  headerModule,
  mastheadModule,
  monthlyPaceModule,
  bookShelfModule,
  domModule,
  constantsModule,
  mathModule,
  WORD_COUNT_OVERRIDES,
  lookupWordCountOverride,
  dbToBook,
  WordCountAPI,
  CommunityFeatures,
  App,
  Stats
};

export function initShelfLife() {
  if (typeof window === 'undefined') return;

  window.Stats = Stats;
  window.App = App;
  window.isWordCountEstimated = isWordCountEstimated;
  window.pagesToWords = pagesToWords;
  Object.assign(window.App, Splash, Search, Stats, Bookshelf, CommunityFeatures, CommunityDiscover, CommunityAdmin, aggregateViewMethods, mathModule);

  // Standalone globals requested for window
  window.CameraScanner = CameraScanner;
  window.ScannerLoader = ScannerLoader;
  window.GoogleBooksRating = GoogleBooksRating;
  window.WikidataAPI = WikidataAPI;
  window.SyncQueue = SyncQueue;
  window.Bookshelf = Bookshelf;
  window.Search = Search;
  window.Splash = Splash;
  window.GenderAPI = GenderAPI;
  window.NationalizeAPI = NationalizeAPI;
  window.guessGenderFromName = guessGenderFromName;
  window.getNationalitiesForAuthor = getNationalitiesForAuthor;
  window.SeriesMetadataFetcher = SeriesMetadataFetcher;
  window.classifySeriesBooks = Bookshelf.classifySeriesBooks;
  window.normalizeISBN = Bookshelf.normalizeISBN;
  window.normalizeSeriesTitle = Bookshelf.normalizeSeriesTitle;
  window.toggleSpineArt = Bookshelf.toggleSpineArt;
  if (window.App) {
    window.App.SeriesMetadataFetcher = SeriesMetadataFetcher;
    window.App.classifySeriesBooks = Bookshelf.classifySeriesBooks;
    window.App.normalizeISBN = Bookshelf.normalizeISBN;
    window.App.normalizeSeriesTitle = Bookshelf.normalizeSeriesTitle;
    window.App.toggleSpineArt = Bookshelf.toggleSpineArt;
    if (typeof window.App.markCommunityNotificationsSeen === 'function') {
      window.markCommunityNotificationsSeen = window.App.markCommunityNotificationsSeen.bind(window.App);
    }
  }

  const isSpineArtEnabled = (typeof localStorage !== 'undefined') ? (localStorage.getItem('shelf_spine_art') === 'true') : false;
  const spineArtEl = document.getElementById('spineArtToggle');
  if (spineArtEl) spineArtEl.checked = isSpineArtEnabled;
  const profileSpineArtEl = document.getElementById('profileSpineArtToggle');
  if (profileSpineArtEl) profileSpineArtEl.checked = isSpineArtEnabled;

  if (typeof window.App.initSplashScreen === 'function') {
    window.App.initSplashScreen();
  }

  // Attach word count helpers
  window.WORD_COUNT_OVERRIDES = WORD_COUNT_OVERRIDES;
  window.lookupWordCountOverride = lookupWordCountOverride;
  window.dbToBook = dbToBook;
  window.WordCountAPI = WordCountAPI;
  window.DuplicateDetector = DuplicateDetector;

  // Make core DB accessible for scripts/console
  import('./core/db.js').then(module => {
    window.DB = module.DB;
  });

  // Attach symbols and maps
  window.APP_SYMBOLS = {
    ...symbolsModule.SYMBOLS,
    filigree: '\u2766',
    search: '\uD83D\uDD0D',
    sparkles: '\u2728',
    gear: '\u2699\uFE0F',
    arrow: '\u2192',
    check: '\u2705',
    dash: '-',
    warning: '\u26A0\uFE0F',
    backArrow: '\u2190'
  };
  window.languageOptionsHTML = symbolsModule.languageOptionsHTML;
  window.ALL_MONTHS = ALL_MONTHS;
  window.App.ALL_MONTHS = ALL_MONTHS;
  window.App.languageOptionsHTML = symbolsModule.languageOptionsHTML;
  window.App.SYMBOLS = window.APP_SYMBOLS;
  window.App.getSentimentEmoji = symbolsModule.getSentimentEmoji;
  window.App.getLanguageFlag = symbolsModule.getLanguageFlag;
  window.App.getRegionFlag = symbolsModule.getRegionFlag;
  window.App.getFormatIcon = symbolsModule.getFormatIcon;
  window.App.renderRatingStars = symbolsModule.renderRatingStars;
  window.App.sanitizeSymbolString = symbolsModule.sanitizeSymbolString;

  // Merge constants and DOM utilities onto window and window.App
  Object.assign(window, constantsModule, domModule, mathModule);
  Object.assign(window.App, constantsModule, domModule, mathModule);

  // Initialize modular component integrations
  headerModule.initHeader(window.App);
  mastheadModule.initMasthead(window.App);
  monthlyPaceModule.initMonthlyPace(window.App);
  bookShelfModule.initBookShelf(window.App);

  // Global Bridge attachments for direct window handlers and legacy inline attributes
  window.showToast = domModule.showToast;
  window.openModal = domModule.openModal;
  window.closeModal = domModule.closeModal;
  window.openBookModal = domModule.openBookModal;
  window.closeBookModal = domModule.closeBookModal;
  window.openPanel = domModule.openPanel;
  window.closePanel = domModule.closePanel;
  window.initShelfScrolling = domModule.initShelfScrolling;
  window.updateShelfScrollIndicators = domModule.updateShelfScrollIndicators;
  window.toggleEditMode = () => (window.App && typeof window.App.toggleEditMode === 'function' ? window.App.toggleEditMode() : null);
  window.toggleReorderMode = () => (window.App && typeof window.App.toggleReorderMode === 'function' ? window.App.toggleReorderMode() : null);
  window.toggleSeriesView = () => (window.App && typeof window.App.toggleSeriesView === 'function' ? window.App.toggleSeriesView() : null);
  window.confirmDeleteYear = () => (window.App && typeof window.App.confirmDeleteYear === 'function' ? window.App.confirmDeleteYear() : null);
  window.executeDeleteYear = () => (window.App && typeof window.App.executeDeleteYear === 'function' ? window.App.executeDeleteYear() : null);
  if (window.App) {
    window.App.toggleEditMode = Bookshelf.toggleEditMode || window.App.toggleEditMode;
    window.App.toggleReorderMode = Bookshelf.toggleReorderMode || window.App.toggleReorderMode;
    window.App.toggleSeriesView = Bookshelf.toggleSeriesView || window.App.toggleSeriesView;
    window.App.renderSeriesShelf = Bookshelf.renderSeriesShelf || window.App.renderSeriesShelf;
    window.App.confirmDeleteYear = App.confirmDeleteYear || window.App.confirmDeleteYear;
    window.App.executeDeleteYear = App.executeDeleteYear || window.App.executeDeleteYear;
  }
  if (window.App) {
    window.App.initShelfScrolling = domModule.initShelfScrolling;
    window.App.updateShelfScrollIndicators = domModule.updateShelfScrollIndicators;
  }
  domModule.initShelfScrolling();
  window.selectEditStatus = (status) => (window.App && typeof window.App.selectEditStatus === 'function' ? window.App.selectEditStatus(status) : null);
  window.openInviteModal = domModule.openInviteModal;
  window.closeInviteModal = domModule.closeInviteModal;
  window.copyClubInviteLink = domModule.copyClubInviteLink;
  if (window.App) {
    window.App.openInviteModal = domModule.openInviteModal;
    window.App.closeInviteModal = domModule.closeInviteModal;
    window.App.copyClubInviteLink = domModule.copyClubInviteLink;
  }

  window.openAnalytics = () => (window.App && typeof window.App.openAnalytics === 'function' ? window.App.openAnalytics() : window.open('analytics.html', '_blank'));
  window.openLaserOutput = () => (window.App && typeof window.App.openLaserOutput === 'function' ? window.App.openLaserOutput() : window.open('laseroutput.html', '_blank'));
  if (window.App) {
    window.App.openAnalytics = App.openAnalytics ? App.openAnalytics.bind(window.App) : (() => window.open('analytics.html', '_blank'));
    window.App.openLaserOutput = App.openLaserOutput ? App.openLaserOutput.bind(window.App) : (() => window.open('laseroutput.html', '_blank'));
  }

  window.toggleFabMenu = domModule.toggleFabMenu;
  window.toggleSlideMenu = domModule.toggleSlideMenu;
  window.addToToRead = (t, a, c, n) => (window.App && typeof window.App.addToToRead === 'function' ? window.App.addToToRead(t, a, c, n) : null);
  window.joinClub = (clubId) => (window.App && typeof window.App.joinClub === 'function' ? window.App.joinClub(clubId) : null);
  window.openClub = (clubId) => (window.App && typeof window.App.openClub === 'function' ? window.App.openClub(clubId) : null);
  window.renderClubs = () => (window.App && typeof window.App.renderClubs === 'function' ? window.App.renderClubs() : null);
  window.createClub = () => (window.App && typeof window.App.createClub === 'function' ? window.App.createClub() : null);
  window.submitCreateClub = () => (window.App && typeof window.App.submitCreateClub === 'function' ? window.App.submitCreateClub() : null);
  window.showCreateClubForm = () => (window.App && typeof window.App.showCreateClubForm === 'function' ? window.App.showCreateClubForm() : null);
  window.setMultiYearRange = (range) => (window.App && typeof window.App.setMultiYearRange === 'function' ? window.App.setMultiYearRange(range) : null);
  window.toggleMultiYearMenu = () => (window.App && typeof window.App.toggleMultiYearMenu === 'function' ? window.App.toggleMultiYearMenu() : null);
  window.setImportBookStatus = (idx, s) => (window.App && typeof window.App.setImportBookStatus === 'function' ? window.App.setImportBookStatus(idx, s) : null);
  window.showImportReview = () => (window.App && typeof window.App.showImportReview === 'function' ? window.App.showImportReview() : null);
  window.updateImportCount = () => (window.App && typeof window.App.updateImportCount === 'function' ? window.App.updateImportCount() : null);
  window.commitImport = (isRetry) => (window.App && typeof window.App.commitImport === 'function' ? window.App.commitImport(isRetry) : null);
  window.replayAnimation = Splash.replayAnimation || (() => {});
  window.DuplicateDetector = DuplicateDetector || Search.DuplicateDetector;
  if (window.App) window.App.DuplicateDetector = DuplicateDetector || Search.DuplicateDetector;

  window.App_triggerSecretGlow = () => {
    if (window.App && typeof window.App._triggerSecretGlow === 'function') {
      window.App._triggerSecretGlow();
    }
  };
  window.pwaInstall = async () => {
    if (window.deferredPrompt) {
      window.deferredPrompt.prompt();
      try {
        await window.deferredPrompt.userChoice;
      } catch(e) {}
      window.deferredPrompt = null;
      const b = document.getElementById('pwaInstallBanner');
      if (b) b.classList.remove('show');
    }
  };
  window.pwaDismiss = () => {
    const b = document.getElementById('pwaInstallBanner');
    if (b) b.classList.remove('show');
  };

  if (!window._hashChangeListenerAttached) {
    window._hashChangeListenerAttached = true;
    window.addEventListener('hashchange', async () => {
      const hash = window.location.hash || '';
      if (hash.startsWith('#shelf/')) {
        const shelfId = hash.substring(7);
        if (window.App && typeof window.App.loadPublicShelf === 'function') {
          await window.App.loadPublicShelf(shelfId);
        }
      } else if (hash.match(/^#(?:club|invite)\/([^/?&#]+)/)) {
        const match = hash.match(/^#(?:club|invite)\/([^/?&#]+)/);
        const clubId = decodeURIComponent(match[1]);
        if (window.App && (window.App.isDemoMode || window.App.userId)) {
          if (typeof window.DB?.joinClub === 'function') {
            await window.DB.joinClub(clubId, window.App.userId || 'demo_user');
          }
          if (typeof window.App.openModal === 'function') {
            window.App.openModal('communityModal');
          }
          if (typeof window.App.switchCommunityTab === 'function') {
            window.App.switchCommunityTab('clubs');
          }
          if (typeof window.App.switchTab === 'function') {
            window.App.switchTab('social');
          }
          if (typeof window.App.openClub === 'function') {
            await window.App.openClub(clubId);
          } else {
            window.App._currentClub = clubId;
          }
        } else {
          try { localStorage.setItem('sl_pending_club_invite', clubId); } catch(e) {}
          if (window.Auth && typeof window.Auth.showAuthScreen === 'function') {
            window.Auth.showAuthScreen();
          }
        }
      } else if (hash.startsWith('#wrapped')) {
        const rawYr = hash.replace(/^#wrapped\/?/, '').trim();
        const yr = rawYr ? (Number(rawYr) || undefined) : undefined;
        if (window.App && typeof window.App.openWrapped === 'function') {
          window.App.openWrapped(yr);
        }
      } else if (hash.startsWith('#profile/')) {
        const userId = hash.substring(9);
        if (window.App && typeof window.App.openProfileView === 'function') {
          window.App.openProfileView(userId);
        }
      }
    });
  }

  if (typeof window.App.initSplashScreen === 'function') {
    window.App.initSplashScreen();
  }

  console.log('[ShelfLife] Modular UI and Symbol architecture initialized successfully.');
}


// ==========================================
// Boot Sequence (Extracted from index.html)
// ==========================================
import { _supabase, supabase } from './core/db.js';
import { Auth, handleOAuthRedirect } from './core/auth.js';

async function bootMain() {
  initShelfLife();
  domModule.initShelfScrolling(); // Ensure shelf scroll listeners active // Initialize UI modules first
  
  window.App = window.App || {};
  let App = window.App;

  // Clean up any lingering mock auth state from developer testing
  try {
      localStorage.removeItem('supabase.auth.token');
  } catch(e) {}

  const originalHash = window.location.hash;
  const searchParams = new URLSearchParams(window.location.search);

  const targetShelfId = searchParams.get('shelf') || (originalHash.startsWith('#shelf/') ? originalHash.substring(7) : null);

  if (targetShelfId) {
      Auth.hideAuthScreen();
      await App.initReadOnly(targetShelfId);
      
      try {
          if (_supabase) {
              const { data: { session } } = await _supabase.auth.getSession();
              if (session && session.user && App.currentShelf && App.currentShelf.user_id === session.user.id) {
                  App.isReadOnly = false;
                  await App.init(session.user);
              }
          }
      } catch(ex) { console.warn('[auth] owner-shelf upgrade:', ex); }
      return;
  }

  if (searchParams.get('demo') === 'true') {
      Auth.hideAuthScreen();
      if (typeof App.startDemo === 'function') await App.startDemo(false);
      window.__shelfLifeBooted = true;
      return;
  }

  const isGuestStorage = typeof localStorage !== 'undefined' && localStorage.getItem('notetoshelf_is_guest') === 'true';
  const hasGuestBooks = typeof localStorage !== 'undefined' && !!localStorage.getItem('notetoshelf_guest_books');

  if (isGuestStorage && hasGuestBooks && !searchParams.get('landing')) {
      Auth.hideAuthScreen();
      if (typeof App.restoreGuestSession === 'function') {
          await App.restoreGuestSession();
          window.__shelfLifeBooted = true;
          return;
      }
  }

  const clubMatch = originalHash.match(/^#(?:club|invite)\/([^/?&#]+)/);
  if (clubMatch && clubMatch[1]) {
      const clubId = decodeURIComponent(clubMatch[1]);
      try { localStorage.setItem('sl_pending_club_invite', clubId); } catch(e) {}
  }

  if (!_supabase) {
      Auth.showAuthScreen();
      return;
  }

  Auth.showBootLoader();

  const _emergencyEscape = setTimeout(function() {
      try {
          console.warn('[ShelfLife] Emergency escape fired - clearing stuck loading');
          if (typeof document !== 'undefined') {
              document.documentElement.classList.remove('has-returning-session');
              document.documentElement.classList.add('auth-ready');
          }
          const bl = document.getElementById('authBootLoader');
          if (bl) {
              bl.style.opacity = '0';
              setTimeout(function() { bl.style.display = 'none'; }, 350);
          }
          const sk = document.getElementById('loadingSkeleton');
          if (sk) sk.style.display = 'none';

          if (Auth.user && window.App) {
              const ma = document.getElementById('mainApp');
              if (ma) ma.style.display = 'block';
              if (typeof window.App.render === 'function') {
                  try { window.App.render(); } catch(rErr) { console.error('Escape render error:', rErr); }
              }
          } else {
              const as = document.getElementById('authScreen');
              if (as) { as.style.display = 'flex'; as.classList.remove('hidden'); }
              const ma = document.getElementById('mainApp');
              if (ma) ma.style.display = 'none';
          }
      } catch(ex) { console.error('[ShelfLife] Emergency escape error:', ex); }
  }, 8000);

  let _appBooted = false;
  const bootApp = async (user) => {
      if (_appBooted || !user) return;
      _appBooted = true;
      Auth.user = user;
      if (typeof document !== 'undefined') {
          document.documentElement.classList.remove('has-returning-session');
          document.documentElement.classList.add('auth-ready');
      }
      try { Auth.hideAuthScreen(); } catch(ex) { console.warn('[ShelfLife] hideAuthScreen:', ex); }
      
      try {
          await App.init(user);
          clearTimeout(_emergencyEscape);
          if (typeof App.initPushSubscription === 'function') {
              try { App.initPushSubscription(); } catch(ex) { console.warn('push init:', ex); }
          }
      } catch(e) {
          console.error('[Shelf Life] App.init error:', e);
          clearTimeout(_emergencyEscape);
          var sk2 = document.getElementById('loadingSkeleton'); if (sk2) sk2.style.display = 'none';
          if (typeof App.render === 'function') {
              try { App.render(); } catch(rErr) { console.error('[Shelf Life] fallback render error:', rErr); }
          }
      }
  };

  try {
      _supabase.auth.onAuthStateChange(function(event, session) {
          try {
              if (event === 'SIGNED_OUT') {
                  _appBooted = false; Auth.user = null;
                  if (typeof document !== 'undefined') {
                      document.documentElement.classList.remove('has-returning-session');
                      document.documentElement.classList.add('auth-ready');
                  }
                  try { Auth.showAuthScreen(); } catch(ex) { console.warn('[auth] showAuthScreen:', ex); }
                  return;
              }
              if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session && session.user) {
                  bootApp(session.user);
              }
          } catch(ex) { console.error('[auth] onAuthStateChange callback:', ex); }
      });
  } catch(ex) { console.error('[auth] onAuthStateChange setup:', ex); }

  try { await handleOAuthRedirect(); } catch(e) { console.warn('[auth] redirect handling failed:', e); }

  try {
      const { data: { session } } = await _supabase.auth.getSession();
      if (session && session.user) {
          await bootApp(session.user);
      } else {
          clearTimeout(_emergencyEscape);
          if (typeof document !== 'undefined') {
              document.documentElement.classList.remove('has-returning-session');
              document.documentElement.classList.add('auth-ready');
          }
          try { Auth.showAuthScreen(); } catch(ex) { console.warn('[auth] showAuthScreen no-session:', ex); }
          if (window._authRedirectError) {
              const errEl = document.getElementById('authError');
              if (errEl) errEl.textContent = window._authRedirectError;
          }
      }
  } catch(e) {
      console.error('[auth] getSession failed:', e);
      clearTimeout(_emergencyEscape);
      if (typeof document !== 'undefined') {
          document.documentElement.classList.remove('has-returning-session');
          document.documentElement.classList.add('auth-ready');
      }
      try { Auth.showAuthScreen(); } catch(ex) { console.warn('[auth] showAuthScreen catch:', ex); }
  }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootMain);
} else {
    bootMain();
}
