/**
 * ShelfLife Core Application Controller & State Engine (src/core/app.js)
 * Handles application state, lifecycles, hash routing, tab switching, profile management, and modal coordination.
 */

import {
  ALL_MONTHS,
  COLORS,
  LABELS,
  SENT_ORDER,
  SENT_EMOJI,
  CROWN_SVG,
  GENRE_COLORS,
  WORDS_PER_PAGE,
  DEFAULT_IMPORT_WORDS,
  ACHIEVEMENTS,
  KNOWN_ACHIEVEMENT_COUNT,
  DEMO_AUTHOR_GENDERS,
  DEMO_AUTHOR_REGIONS_V2,
  ADMIN_USER_ID,
  VAPID_PUBLIC_KEY,
  MOOD_SUGGEST_MAP,
  MOOD_SENT_BOOST,
  isAppAdmin
} from '../utils/constants.js';

import {
  fmtWords,
  fmtWordsParts,
  pagesToWords,
  isWordCountEstimated,
  wcEstAsterisk,
  percentile,
  percentileRange,
  fmtK,
  sColor,
  bmTone,
  easeOutCubic
} from '../utils/math.js';

import {
  esc,
  openModal,
  closeModal,
  handleOverlayClick,
  showToast,
  openBookModal,
  closeBookModal,
  openInviteModal,
  closeInviteModal,
  toggleFabMenu,
  closeFabMenu,
  openAddBookModalFromMenu,
  toggleSlideMenu,
  closeSlideMenu,
  toggleGearMenu,
  toggleFilterPanel,
  closeShareMenu,
  rescueButtons,
  languageBadge,
  languageOptionsHTML,
  initTTElements,
  showTT,
  moveTT,
  hideTT,
  getChartTT,
  showChartTT,
  moveChartTT,
  hideChartTT,
  openPanel,
  closePanel,
  attachTT
} from '../utils/dom.js';

import {
  DB,
  SyncQueue,
  dbToBook,
  WORD_COUNT_OVERRIDES,
  lookupWordCountOverride,
  _supabase,
  coverPlaceholder,
  deriveDisplayNameFromEmail,
  normalizeDisplayName,
  normalizeGenre
} from './db.js';

import {
  Auth,
  handleOAuthRedirect,
  initAuthListener,
  restoreSession
} from './auth.js';

import Splash from '../features/splash.js';
import Search from '../features/search.js';
import Stats from '../features/stats.js';
import * as Bookshelf from '../features/bookshelf.js';
import { aggregateViewMethods } from '../features/aggregate-view.js';
import { openTrophyRoom, showRelicDetailsModal } from '../features/trophies.js';
import { SYMBOLS } from '../constants/symbols.js';

// ==========================================
// Demo Books Dataset Generator
// ==========================================
let _DEMO_BOOKS_CACHE = null;

export function getDemoBooks() {
  if (_DEMO_BOOKS_CACHE) return _DEMO_BOOKS_CACHE;

  _DEMO_BOOKS_CACHE = [
    { title: 'Things Fall Apart', author: 'Chinua Achebe', words: 55000, pageCount: 209, year: 1958, days: 3, sentiment: 'like', month: 'May', genre: 'General Fiction', fiction: true, coverUrl: 'https://m.media-amazon.com/images/I/81xU46r7y2L._AC_UF1000,1000_QL80_.jpg', review: 'A powerful, tragic story of a culture on the brink of change.', language: 'Igbo' },
    { title: '1Q84', author: 'Haruki Murakami', words: 290000, pageCount: 1184, year: 2009, days: 24, sentiment: 'love', month: 'April', genre: 'Sci-Fi', fiction: true, coverUrl: 'https://m.media-amazon.com/images/I/71u9sW-L4UL._AC_UF1000,1000_QL80_.jpg', review: 'A surreal and sweeping masterpiece.', format: 'audiobook', language: 'Japanese' },
    { title: 'Two Kinds of Truth', author: 'Michael Connelly', words: 110000, pageCount: 416, year: 2017, days: 5, sentiment: 'like', month: 'April', genre: 'Crime/Detective', fiction: true, coverUrl: 'https://m.media-amazon.com/images/S/compressed.photo.goodreads.com/books/1495889320i/34390820.jpg', review: 'Classic Harry Bosch. Reliable, sharp, and exactly what you pick up Connelly for.' },
    { title: 'Starter Villain', author: 'John Scalzi', words: 90000, pageCount: 264, year: 2023, days: 3, sentiment: 'love', month: 'February', genre: 'Sci-Fi', fiction: true, coverUrl: 'https://covers.openlibrary.org/b/isbn/9780765389220-L.jpg', review: 'Light, silly, action-packed fun with actual heart. Also, talking cats and dolphins.', isbn: '9780765389220' },
    { title: 'Never Boring', author: 'Ed Willes', words: 80000, pageCount: 288, year: 2023, days: 10, sentiment: 'like', month: 'April', genre: 'Non-Fiction', fiction: false, coverUrl: 'https://harbourpublishing.com/cdn/shop/files/Willes_Never_20Boring_RGB300_e56c0945-b288-4eed-bd44-7e93cad3f0f3.jpg?v=1725595818', review: 'A full history of the Vancouver Canucks. Great for fans.' },
    { title: 'Serpentine', author: 'Jonathan Kellerman', words: 105000, pageCount: 368, year: 2021, days: 6, sentiment: 'dislike', month: 'February', genre: 'Crime/Detective', fiction: true, coverUrl: 'https://m.media-amazon.com/images/I/81LrhweNiYL.SY466.jpg', review: 'Marketed as a thriller, but felt like a slow walk through unrelated errands.' },
    { title: 'The 100-Year-Old Man', author: 'Jonas Jonasson', words: 120000, pageCount: 396, year: 2012, days: 7, sentiment: 'like', month: 'May', genre: 'General Fiction', fiction: true, coverUrl: 'https://m.media-amazon.com/images/S/compressed.photo.goodreads.com/books/1530487363i/38750904.jpg', review: 'Silly, episodic, and surprisingly charming.' },
    { title: 'The Brass Verdict', author: 'Michael Connelly', words: 115000, pageCount: 432, year: 2008, days: 5, sentiment: 'like', month: 'June', genre: 'Crime/Detective', fiction: true, coverUrl: 'https://m.media-amazon.com/images/I/61pGO3Wi8TL._AC_UF1000,1000_QL80_.jpg', review: 'Solid, satisfying legal thriller.' },
    { title: 'Heaven & Earth Grocery Store', author: 'James McBride', words: 125000, pageCount: 400, year: 2023, days: 12, sentiment: 'dislike', month: 'February', genre: 'General Fiction', fiction: true, coverUrl: 'https://m.media-amazon.com/images/I/81FS3wyevDL._AC_UF1000,1000_QL80_.jpg', review: 'Slow slice-of-life story set in a racially tense 1920s-30s immigrant neighborhood.' },
    { title: 'Red, White & Royal Blue', author: 'Casey McQuiston', words: 110000, pageCount: 423, year: 2019, days: 4, sentiment: 'love', month: 'January', genre: 'Romance', fiction: true, coverUrl: 'https://m.media-amazon.com/images/I/71W30z5nBWL._AC_UF1000,1000_QL80_.jpg', review: 'Joyful and hilarious.' },
    { title: 'The Things They Carried', author: 'Tim O\'Brien', words: 65000, pageCount: 233, year: 1990, days: 5, sentiment: 'mixed', month: 'June', genre: 'War/Military', fiction: true, coverUrl: 'https://m.media-amazon.com/images/I/81B-8Q0k2sL._AC_UF1000,1000_QL80_.jpg', review: 'Heavy and profound.' },
    { title: 'Side-tracked', author: 'Henning Mankell', words: 130000, pageCount: 416, year: 1995, days: 9, sentiment: 'dislike', month: 'February', genre: 'Crime/Detective', fiction: true, coverUrl: 'https://m.media-amazon.com/images/I/61TSPLToQ2L._AC_UF1000,1000_QL80_.jpg', review: 'Set in Sweden, and paced like winter there: long, boring, and determined to outlast your will.' },
    { title: 'Lily and the Octopus', author: 'Steven Rowley', words: 85000, pageCount: 304, year: 2016, days: 4, sentiment: 'love', month: 'June', genre: 'General Fiction', fiction: true, coverUrl: 'https://m.media-amazon.com/images/S/compressed.photo.goodreads.com/books/1499086357i/27276262.jpg', review: 'This book wrecked me in the best way. For any pet lover, this one lands deep.' },
    { title: 'Masked Prey', author: 'John Sandford', words: 110000, pageCount: 400, year: 2020, days: 6, sentiment: 'mixed', month: 'April', genre: 'Crime/Detective', fiction: true, coverUrl: 'https://images.penguinrandomhouse.com/cover/9780593328576', review: 'Readable, but forgettable.' },
    { title: 'The Wishing Game', author: 'Meg Shaffer', words: 82500, pageCount: 304, year: 2023, days: 5, sentiment: 'love', month: 'February', genre: 'Romance', fiction: true, coverUrl: 'https://m.media-amazon.com/images/I/81ANaZRiSpL._AC_UF1000,1000_QL80_.jpg', review: 'A pleasant surprise. Warm and whimsical.' },
    { title: 'For The Win', author: 'Cory Doctorow', words: 150000, pageCount: 480, year: 2010, days: 8, sentiment: 'mixed', month: 'May', genre: 'Sci-Fi', fiction: true, coverUrl: 'https://mpd-biblio-covers.imgix.net/9780765333841.jpg', review: 'Interesting ideas, but I wanted more from the ending.' },
    { title: 'Desert Star', author: 'Michael Connelly', words: 105000, pageCount: 400, year: 2022, days: 5, sentiment: 'like', month: 'May', genre: 'Crime/Detective', fiction: true, coverUrl: 'https://m.media-amazon.com/images/S/compressed.photo.goodreads.com/books/1649275210i/60219987.jpg', review: 'Not groundbreaking, but a dependable entry if you\'re in for more Bosch.' },
    { title: 'The Worst Hard Time', author: 'Timothy Egan', words: 130000, pageCount: 368, year: 2006, days: 8, sentiment: 'like', month: 'June', genre: 'Non-Fiction', fiction: false, coverUrl: 'https://www.harpercollins.com/cdn/shop/files/9780618773473_1200x1200.jpg', review: 'A bleak, dusty, gripping, and relentless yet deeply human read.' },
    { title: 'Special Topics in Calamity Physics', author: 'Marisha Pessl', words: 180000, pageCount: 528, year: 2006, days: 11, sentiment: 'dislike', month: 'March', genre: 'General Fiction', fiction: true, coverUrl: 'https://m.media-amazon.com/images/I/71nwIoYn41L._AC_UF1000,1000_QL80_.jpg', review: 'An exhausting read. Dense and self-conscious prose.' },
    { title: 'The Late Show', author: 'Michael Connelly', words: 105000, pageCount: 448, year: 2017, days: 5, sentiment: 'like', month: 'May', genre: 'Crime/Detective', fiction: true, coverUrl: 'https://www.hachettebookgroup.com/wp-content/uploads/2026/02/9781455524235.jpg', review: 'Reliable, gritty, and well-crafted.' },
    { title: 'Worst Ship in the Fleet', author: 'Skyler Ramirez', words: 40000, pageCount: 160, year: 2024, days: 1, sentiment: 'like', month: 'June', genre: 'Sci-Fi', fiction: true, coverUrl: 'https://m.media-amazon.com/images/I/91diOlW7vBL._UF1000,1000_QL80_.jpg', review: 'Lean, fast, and genuinely fun.' },
    { title: 'The Three-Body Problem', author: 'Liu Cixin', words: 135000, pageCount: 400, year: 2008, days: 6, sentiment: 'love', month: 'May', genre: 'Sci-Fi', fiction: true, coverUrl: 'https://m.media-amazon.com/images/I/919XM42JGlL._AC_UF1000,1000_QL80_.jpg', review: 'Mind-bending and grand in scale.', format: 'audiobook' },
    { title: 'Remarkably Bright Creatures', author: 'Shelby Van Pelt', words: 86350, pageCount: 368, year: 2022, days: 5, sentiment: 'like', month: 'June', genre: 'General Fiction', fiction: true, coverUrl: 'https://m.media-amazon.com/images/S/compressed.photo.goodreads.com/books/1651600548i/58733693.jpg', review: 'A warm, quietly charming read.' },
    { title: "Caliban's War", author: 'James S.A. Corey', words: 194688, pageCount: 624, year: 2012, days: 5, sentiment: 'love', month: 'April', genre: 'Sci-Fi', fiction: true, coverUrl: 'https://m.media-amazon.com/images/I/91oFDrzhkqL._AC_UF1000,1000_QL80_.jpg', review: 'Big, ambitious, and completely gripping.' },
    { title: 'My Brilliant Friend', author: 'Elena Ferrante', words: 110000, pageCount: 336, year: 2011, days: 4, sentiment: 'love', month: 'April', genre: 'General Fiction', fiction: true, coverUrl: 'https://m.media-amazon.com/images/I/81h6t4kRz+L._AC_UF1000,1000_QL80_.jpg', review: 'A powerful exploration of friendship and rivalry.' },
    { title: 'The Thursday Murder Club', author: 'Richard Osman', words: 110000, pageCount: 400, year: 2020, days: 5, sentiment: 'mixed', month: 'April', genre: 'Crime/Detective', fiction: true, coverUrl: 'https://m.media-amazon.com/images/I/71VghJxHsnL._AC_UF1000,1000_QL80_.jpg', review: 'Cozy but slow. Too many threads, not enough urgency.' },
    { title: 'Dark Matter', author: 'Blake Crouch', words: 95000, pageCount: 342, year: 2016, days: 4, sentiment: 'love', month: 'July', genre: 'Sci-Fi', fiction: true, coverUrl: 'https://m.media-amazon.com/images/I/81NNbR1LqXL._AC_UF1000,1000_QL80_.jpg', review: 'Smart, accessible, and hard to put down. I loved it.', format: 'ebook', isbn: '9781101904220' },
    { title: "Abaddon's Gate", author: 'James S.A. Corey', words: 175000, pageCount: 560, year: 2013, days: 4, sentiment: 'love', month: 'June', genre: 'Sci-Fi', fiction: true, coverUrl: 'https://m.media-amazon.com/images/I/91U2Epcap9L._AC_UF1000,1000_QL80_.jpg', review: 'Tighter focus, constant tension, and a haunting tone.' },
    { title: 'The Undervalued Self', author: 'Elaine N. Aron', words: 90000, pageCount: 320, year: 2010, days: 6, sentiment: 'like', month: 'January', genre: 'Non-Fiction', fiction: false, coverUrl: 'https://m.media-amazon.com/images/I/61z6QBCR0EL._AC_UF1000,1000_QL80_.jpg', review: 'Gave language and structure to things I had felt but not fully examined.' },
    { title: 'My Sister, the Serial Killer', author: 'Oyinkan Braithwaite', words: 65000, pageCount: 240, year: 2018, days: 2, sentiment: 'like', month: 'March', genre: 'Crime/Detective', fiction: true, coverUrl: 'https://m.media-amazon.com/images/I/81j3kU-n2KL._AC_UF1000,1000_QL80_.jpg', review: 'Darkly comic and sharply written.' },
    { title: 'The Girl on the Train', author: 'Paula Hawkins', words: 105000, pageCount: 336, year: 2015, days: 5, sentiment: 'like', month: 'March', genre: 'Crime/Detective', fiction: true, coverUrl: 'https://m.media-amazon.com/images/I/81-Q2OAVeXL._AC_UF1000,1000_QL80_.jpg', review: 'Engaging setup, though uneven in places.' },
    { title: 'Altered Carbon', author: 'Richard K. Morgan', words: 140000, pageCount: 416, year: 2002, days: 5, sentiment: 'mixed', month: 'June', genre: 'Sci-Fi', fiction: true, coverUrl: 'https://m.media-amazon.com/images/I/81u6AaycLnL._AC_UF1000,1000_QL80_.jpg', review: 'The world is great, the story gets stuck in it.' },
    { title: 'The Waiting', author: 'Michael Connelly', words: 93500, pageCount: 416, year: 2024, days: 3, sentiment: 'love', month: 'February', genre: 'Crime/Detective', fiction: true, coverUrl: 'https://m.media-amazon.com/images/I/8105FTNgbRL._AC_UF1000,1000_QL80_.jpg', review: 'Ballard returns with Bosch. I loved it.' },
    { title: 'The Knowledge', author: 'Lewis Dartnell', words: 120000, pageCount: 352, year: 2014, days: 2, sentiment: 'like', month: 'June', genre: 'Non-Fiction', fiction: false, coverUrl: 'https://images.penguinrandomhouse.com/cover/9780143127048', review: 'Less a survival manual and more a map of how things work.' },
    { title: 'Project Hail Mary', author: 'Andy Weir', words: 148512, pageCount: 496, year: 2021, days: 4, sentiment: 'like', month: 'June', genre: 'Sci-Fi', fiction: true, coverUrl: 'https://upload.wikimedia.org/wikipedia/en/a/ad/Project_Hail_Mary%2C_First_Edition_Cover_%282021%29.jpg', review: 'A little corny at times, but a genuinely fun sci-fi adventure.', format: 'audiobook', isbn: '9780593135204' },
    { title: 'The Vegetarian', author: 'Han Kang', words: 55000, pageCount: 188, year: 2007, days: 3, sentiment: 'love', month: 'January', genre: 'General Fiction', fiction: true, coverUrl: 'https://upload.wikimedia.org/wikipedia/en/5/5a/The_vegetarian_-_han_kang.jpg', review: 'Visceral, haunting, and incredibly unique.', format: 'ebook' },
    { title: 'Entanglement: The Belt', author: 'Gerald M. Kilby', words: 95000, pageCount: 320, year: 2020, days: 3, sentiment: 'like', month: 'April', genre: 'Sci-Fi', fiction: true, coverUrl: 'https://m.media-amazon.com/images/I/614WYlZgD6L._AC_UF1000,1000_QL80_.jpg', review: 'Good ideas, but a crowded cast and average execution.' },
    { title: 'Crime Beat', author: 'Michael Connelly', words: 120000, pageCount: 384, year: 2006, days: 2, sentiment: 'like', month: 'June', genre: 'Non-Fiction', fiction: false, coverUrl: 'https://m.media-amazon.com/images/I/61w7TjwZ7cL._AC_UF1000,1000_QL80_.jpg', review: 'A collection of Connelly\'s crime reporting. More archival than narrative.' },
    { title: 'The Posthumous Memoirs of Brás Cubas', author: 'Machado de Assis', words: 85000, pageCount: 240, year: 1881, days: 6, sentiment: 'love', month: 'February', genre: 'General Fiction', fiction: true, coverUrl: 'https://m.media-amazon.com/images/I/71c3m9c4E9L._AC_UF1000,1000_QL80_.jpg', review: 'Incredibly ahead of its time. Humorous and cynical.', language: 'Portuguese' },
    { title: 'Knots and Crosses', author: 'Ian Rankin', words: 90000, pageCount: 256, year: 1987, days: 3, sentiment: 'dislike', month: 'May', genre: 'Crime/Detective', fiction: true, coverUrl: 'https://m.media-amazon.com/images/I/71GyKHUKvKL._AC_UF1000,1000_QL80_.jpg', review: 'Feels longer than it should. Rebus lands more unlikable than compelling.' },
    { title: "The Monkey's Raincoat", author: 'Robert Crais', words: 58270, pageCount: 224, year: 1987, days: 5, sentiment: 'mixed', month: 'February', genre: 'Crime/Detective', fiction: true, coverUrl: 'https://m.media-amazon.com/images/I/81-fJwud0UL._AC_UF1000,1000_QL80_.jpg', review: 'A gritty LA detective story. The first two acts drag, then the final act snaps into fast action.' },
    { title: 'In the Garden of Beasts', author: 'Erik Larson', words: 135000, pageCount: 480, year: 2011, days: 5, sentiment: 'love', month: 'February', genre: 'Non-Fiction', fiction: false, coverUrl: 'https://m.media-amazon.com/images/I/61f-iG8sjGL._AC_UF1000,1000_QL80_.jpg', review: 'A chilling account of an American diplomat in Berlin during Hitler\'s rise. Deeply unsettling.' },
    { title: 'Head On', author: 'John Scalzi', words: 80000, pageCount: 272, year: 2018, days: 3, sentiment: 'like', month: 'February', genre: 'Sci-Fi', fiction: true, coverUrl: 'https://m.media-amazon.com/images/I/81xeF94-6kL._AC_UF1000,1000_QL80_.jpg', review: 'A quick sci-fi detective novel with some genuinely clever ideas.' },
    { title: 'The Hitchhiker\'s Guide to the Galaxy', author: 'Douglas Adams', words: 46333, pageCount: 216, year: 1979, days: 2, sentiment: 'love', month: 'March', genre: 'Sci-Fi', fiction: true, coverUrl: 'https://m.media-amazon.com/images/I/81XSN3hA5gL._AC_UF1000,1000_QL80_.jpg', review: 'Absurd, brilliant, endlessly quotable. A masterpiece of comedy sci-fi.', format: 'ebook', authorGender: 'male', authorGenderConfidence: 0.99 },
    { title: 'Becoming', author: 'Michelle Obama', words: 165000, pageCount: 448, year: 2018, days: 10, sentiment: 'love', month: 'March', genre: 'Non-Fiction', fiction: false, coverUrl: 'https://m.media-amazon.com/images/I/81cJTmFpG-L._AC_UF1000,1000_QL80_.jpg', review: 'Deeply personal, honest, and inspiring. A remarkable memoir.', format: 'audiobook', authorGender: 'female', authorGenderConfidence: 0.98 },
    { title: 'The Martian', author: 'Andy Weir', words: 104588, pageCount: 384, year: 2011, days: 3, sentiment: 'love', month: 'January', genre: 'Sci-Fi', fiction: true, coverUrl: 'https://covers.openlibrary.org/b/isbn/9780553418026-L.jpg', review: 'Gripping survival story. The science is fun and the humor carries it.', format: 'ebook', authorGender: 'male', authorGenderConfidence: 0.95, isbn: '9780553418026' },
    { title: 'Educated', author: 'Tara Westover', words: 140000, pageCount: 334, year: 2018, days: 7, sentiment: 'like', month: 'February', genre: 'Non-Fiction', fiction: false, coverUrl: 'https://m.media-amazon.com/images/I/81NwOj14S6L._AC_UF1000,1000_QL80_.jpg', review: 'Harrowing but beautifully written. A story of resilience and self-invention.', format: 'ebook', authorGender: 'female', authorGenderConfidence: 0.97 },
    { title: 'Recursion', author: 'Blake Crouch', words: 84000, pageCount: 336, year: 2019, days: 3, sentiment: 'love', month: 'June', genre: 'Sci-Fi', fiction: true, coverUrl: 'https://i.ytimg.com/vi/PcCYIDvdRZQ/maxresdefault.jpg', review: 'Mind-bending and emotionally resonant. Even better than Dark Matter.', format: 'ebook', authorGender: 'male', authorGenderConfidence: 0.92 },
    { title: 'The Name of the Wind', author: 'Patrick Rothfuss', words: 259000, pageCount: 662, year: 2007, days: null, sentiment: null, month: null, genre: 'Fantasy', fiction: true, coverUrl: 'https://m.media-amazon.com/images/I/91b8oNwaV1L._AC_UF1000,1000_QL80_.jpg', review: '', currentlyReading: true, dateStarted: '2026-05-06', authorGender: 'male', authorGenderConfidence: 0.95 },
    { id: 't2', title: 'Mistborn', author: 'Brandon Sanderson', words: 212000, pageCount: 541, status: 'to-read', coverUrl: 'https://covers.openlibrary.org/b/isbn/9780765311788-L.jpg', queue_order: 2 }
  ];

  return _DEMO_BOOKS_CACHE;
}

function suggestMoods(genre, sentiment) {
  const s = new Set();
  (MOOD_SUGGEST_MAP[genre] || []).forEach(m => s.add(m));
  (MOOD_SENT_BOOST[sentiment] || []).forEach(m => s.add(m));
  return Array.from(s);
}

// ==========================================
// Central App State & Controller
// ==========================================

export const App = {
  // 1. Reactive State
  userId: null,
  userEmail: '',
  displayName: '',
  ownerDisplayName: '',
  ownProfile: null,
  _avatarEmoji: '📚',
  isReadOnly: false,
  isDemoMode: false,
  get isAdmin() {
    return isAppAdmin(this);
  },
  currentYear: (function() {
    try {
      return parseInt(localStorage.getItem('shelf_life_current_year')) || new Date().getFullYear();
    } catch (e) {
      return new Date().getFullYear();
    }
  })(),
  multiYearRange: 'single',
  quarterMode: false,
  currentShelf: null,
  userYears: [],
  books: [],
  aggregateBooks: [],
  aggregateYearData: {},
  editingBook: null,
  _discoverExpanded: false,
  selectedSearchResult: null,
  selectedSentiment: null,
  importBooks: [],
  searchTimeout: null,
  globalSearchBooks: null,
  readingGoals: {},
  following: [],
  clubs: [],
  activeTab: 'home',
  activeCommunityTab: 'feed',
  _notesTab: 'inbox',
  _hubTab: 'details',
  _multiYearMenuOpen: false,
  _accountMenuOpen: false,
  _slideMenuOpen: false,
  _currentTheme: 'classic',
  _THEME_NAMES: { 'classic': 'Classic', 'wood': 'Wood', 'dark-wood': 'Dark Wood', 'library': 'Library', 'udl': 'UDL', 'minimal': 'Minimal' },
  _AVATAR_EMOJIS: ['🤓','🧐','🤩','🥳','😎','🥸','✍️','🕵️','🧙','☕','🍷','🌿','⭐','✨','📚','📖','🚀','🛸','👽','🤖','👾','🗺️','🧭','🎨','🎭','🎧','🎸','🎮'],
  _dnaState: {
    targetShape: [0.65, 0.85, 0.40, 0.25, 0.15, 0.50],
    activeFriends: []
  },
  _clubVotes: {},
  _clubVotingCandidates: {},
  _clubStartDates: {},
  _AVATAR_GRADIENTS: [
    'linear-gradient(135deg,#667eea 0%,#764ba2 100%)',
    'linear-gradient(135deg,#f093fb 0%,#f5576c 100%)',
    'linear-gradient(135deg,#4facfe 0%,#00f2fe 100%)',
    'linear-gradient(135deg,#43e97b 0%,#38f9d7 100%)',
    'linear-gradient(135deg,#fa709a 0%,#fee140 100%)',
    'linear-gradient(135deg,#30cfd0 0%,#330867 100%)',
    'linear-gradient(135deg,#ff9a9e 0%,#fad0c4 100%)',
    'linear-gradient(135deg,#f6d365 0%,#fda085 100%)',
    'linear-gradient(135deg,#84fab0 0%,#8fd3f4 100%)',
    'linear-gradient(135deg,#d4a373 0%,#8b5a2b 100%)',
    'linear-gradient(135deg,#c79081 0%,#dfa579 100%)',
    'linear-gradient(135deg,#5b86e5 0%,#36d1dc 100%)',
    'linear-gradient(135deg,#cb2d3e 0%,#ef473a 100%)',
    'linear-gradient(135deg,#a18cd1 0%,#fbc2eb 100%)'
  ],

  // 2. Watchdogs & Helpers
  _findBookById(id) {
    let b = (this.books || []).find(x => String(x.id) === String(id));
    if (!b) b = (this.aggregateBooks || []).find(x => String(x.id) === String(id));
    if (!b) b = (this.toReadBooks || []).find(x => String(x.id) === String(id));
    if (!b) b = (this.crBooks || []).find(x => String(x.id) === String(id));
    if (!b) b = (this.discover || []).find(x => String(x.id) === String(id));
    if (!b && this.allGuestBooks) b = this.allGuestBooks.find(x => String(x.id) === String(id));
    if (!b && this.clubs) {
      for (let club of this.clubs) {
        if (club.books) {
          b = club.books.find(x => String(x.id) === String(id));
          if (b) return b;
        }
      }
    }
    if (!b && this._contextBook && String(this._contextBook.id) === String(id)) return this._contextBook;
    return b;
  },

  _hideSkeleton() {
    const skelEl = document.getElementById('loadingSkeleton');
    if (skelEl) skelEl.style.display = 'none';
  },

  _clearSkeletonWatchdog() {
    if (this._skeletonWatchdog) { clearTimeout(this._skeletonWatchdog); this._skeletonWatchdog = null; }
    if (this._slowConnectionNotice) { clearTimeout(this._slowConnectionNotice); this._slowConnectionNotice = null; }
  },

  _withTimeout(promise, ms, label) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('[timeout] ' + (label || 'operation') + ' exceeded ' + ms + 'ms')), ms);
      Promise.resolve(promise).then(
        (v) => { clearTimeout(t); resolve(v); },
        (e) => { clearTimeout(t); reject(e); }
      );
    });
  },

  _escapeHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  _esc(s) {
    return this._escapeHtml(s);
  },

  _getUserAvatar(prof) {
    if (!prof) return '👤';
    const avatarEmoji = prof.avatar_emoji;
    if (avatarEmoji && avatarEmoji !== '👤' && avatarEmoji !== '❌' && avatarEmoji !== 'Ã¢Â â€œ') return avatarEmoji;

    const userId = prof.user_id || prof.id || prof.userId;
    if (!userId) return '👤';

    let hash = 0;
    const str = String(userId);
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    const index = Math.abs(hash) % this._AVATAR_EMOJIS.length;
    return this._AVATAR_EMOJIS[index];
  },

  _avatarBg(emoji) {
    const i = this._AVATAR_EMOJIS.indexOf(emoji);
    const idx = (i < 0 ? 0 : i) % this._AVATAR_GRADIENTS.length;
    return this._AVATAR_GRADIENTS[idx];
  },

  _applyMenuAvatar() {
    const el = document.getElementById('menuAvatar');
    if (!el) return;
    el.textContent = this._avatarEmoji;

    const ma = document.getElementById('mastheadUserAvatar');
    if (ma) {
      ma.textContent = this._avatarEmoji;
      ma.style.background = this._avatarBg(this._avatarEmoji);
    }
    const pa = document.getElementById('profileModalAvatar');
    if (pa) { pa.textContent = this._avatarEmoji; }
    const mn = document.getElementById('mastheadUserName');
    if (mn) { mn.textContent = this.displayName || this.ownerDisplayName || 'Reader'; }

    el.style.background = this._avatarBg(this._avatarEmoji);
  },

  _loadAvatar() {
    const saved = localStorage.getItem('shelf_life_avatar');
    if (saved) this._avatarEmoji = saved;
  },

  _syncThemeUI(theme) {
    document.querySelectorAll('.theme-card, .tm-card').forEach(c => c.classList.toggle('active', c.dataset.theme === theme));
    const lbl = document.getElementById('menuThemeCurrent');
    if (lbl) lbl.textContent = this._THEME_NAMES[theme] || 'Classic';
  },

  setTheme(theme) {
    this._currentTheme = theme;
    document.documentElement.classList.add('theme-transitioning');
    document.documentElement.setAttribute('data-theme', theme);
    setTimeout(() => document.documentElement.classList.remove('theme-transitioning'), 400);

    try { localStorage.setItem('shelf_life_theme', theme); } catch (e) {}
    this._syncThemeUI(theme);

    if (this.userId && !this.isDemoMode && typeof _supabase !== 'undefined' && _supabase) {
      _supabase.from('user_profiles').update({ theme: theme }).eq('user_id', this.userId).then(() => {}).catch(() => {});
    }
  },

  openThemeModal() {
    this.closeSlideMenu();
    this._syncThemeUI(this._currentTheme || 'classic');
    this.openModal('themeModal');
  },

  _loadTheme() {
    let saved = 'classic';
    try { saved = localStorage.getItem('shelf_life_theme') || 'classic'; } catch (e) {}
    if (!this._THEME_NAMES[saved]) saved = 'classic';
    this._currentTheme = saved;
    document.documentElement.setAttribute('data-theme', saved);
    this._syncThemeUI(saved);
    this.initCozyMode();
  },

  initCozyMode() {
    let saved = null;
    try { saved = localStorage.getItem('notetoshelf_cozy_mode'); } catch (e) {}
    this.cozyMode = saved === 'true';
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.toggle('cozy-mode', this.cozyMode);
    }
    this.updateCozyModeUI();
  },

  updateCozyModeUI() {
    if (typeof document === 'undefined') return;
    const btn = document.getElementById('cozyModeBtn');
    if (btn) {
      btn.classList.toggle('active', !!this.cozyMode);
      const icon = btn.querySelector('.cozy-pill-icon');
      const label = btn.querySelector('.cozy-pill-label');
      if (this.cozyMode) {
        btn.title = 'Switch to Collector Mode';
        btn.setAttribute('aria-label', 'Switch to Collector Mode');
        if (icon) icon.textContent = '📊';
        if (label) label.textContent = 'Collector';
      } else {
        btn.title = 'Switch to Cozy Mode';
        btn.setAttribute('aria-label', 'Switch to Cozy Mode');
        if (icon) icon.textContent = '☕';
        if (label) label.textContent = 'Cozy';
      }
    }

    // Dynamic relabeling for Monthly Recap and Year in Review
    const mLabel = document.querySelector('#monthlyRecapBtn .recap-btn-label');
    if (mLabel) mLabel.textContent = this.cozyMode ? 'This Month' : 'Monthly Recap';

    const yLabel = document.querySelector('#yearInReviewBtn .review-btn-label');
    if (yLabel) yLabel.textContent = this.cozyMode ? 'My Year in Books' : 'Year in Review';

    // Dynamic relabeling for Hamburger Menu button
    const accountBtn = document.getElementById('accountBtn');
    if (accountBtn) {
      accountBtn.title = this.cozyMode ? 'Open Menu' : 'Menu';
      const label = document.getElementById('accountBtnLabel');
      if (label) {
        label.style.display = this.cozyMode ? 'inline' : 'none';
      }
    }
  },

  toggleCozyMode(forceVal) {
    this.cozyMode = (typeof forceVal === 'boolean') ? forceVal : !this.cozyMode;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('notetoshelf_cozy_mode', String(this.cozyMode));
      }
    } catch (e) {}
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.toggle('cozy-mode', this.cozyMode);
    }
    this.updateCozyModeUI();
    if (typeof this.showToast === 'function') {
      this.showToast(this.cozyMode ? '☕ Cozy Mode: Simple & Large Text' : '📊 Collector Mode: Full Details');
    }
    if (this.editingBook && document.getElementById('editBookModal')?.classList.contains('open')) {
      if (typeof this.openEditModal === 'function') {
        this.openEditModal(this.editingBook, this.editMode || 'edit');
      }
    }
  },

  openWelcomeExperience() {
    if (typeof this.openModal === 'function') {
      this.openModal('welcomeExperienceModal');
    }
  },

  setExperienceMode(mode) {
    this.toggleCozyMode(mode === 'cozy');
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('notetoshelf_cozy_prompted', 'true');
      }
    } catch (e) {}
    if (typeof this.closeModal === 'function') {
      this.closeModal('welcomeExperienceModal');
    }
  },

  updateBrandTitle() {
    const brandEl = document.getElementById('brandTitle');
    if (!brandEl) return;

    brandEl.textContent = 'Note to Shelf';
    if (this.isReadOnly && !this.isDemoMode) {
      const sharedName = this.ownerDisplayName || this.displayName || '';
      document.title = sharedName ? `Note to Shelf • ${sharedName}'s Shelf` : 'Note to Shelf';
    } else if (this.displayName) {
      document.title = `Note to Shelf • ${this.displayName}`;
    } else {
      document.title = 'Note to Shelf';
    }
  },

  // 3. Core Lifecycles
  async init(user) {
    this.isReadOnly = false;
    const skelEl = document.getElementById('loadingSkeleton');
    if (skelEl) skelEl.style.display = '';

    this._clearSkeletonWatchdog();
    this._skeletonWatchdog = setTimeout(() => {
      console.warn('[init] watchdog fired - loading is taking longer than expected.');
      this.showToast('Loading is taking longer than usual...');
      setTimeout(() => {
        const skel = document.getElementById('loadingSkeleton');
        if (skel && skel.style.display !== 'none') {
          console.warn('[init] watchdog emergency release: hiding skeleton');
          this._hideSkeleton();
          if (typeof this.render === 'function') {
            try { this.render(); } catch(err) { console.error('[init] watchdog fallback render error:', err); }
          }
        }
      }, 2500);
    }, 5500);

    this._slowConnectionNotice = setTimeout(() => {
      const skelEl = document.getElementById('loadingSkeleton');
      if (skelEl && skelEl.style.display !== 'none') {
        const msg = skelEl.querySelector('.skeleton-slow-msg');
        if (!msg) {
          const notice = document.createElement('div');
          notice.className = 'skeleton-slow-msg';
          notice.style.cssText = 'text-align:center;font-family:\'DM Mono\',monospace;font-size:11px;color:rgba(139,99,67,0.55);letter-spacing:0.08em;margin-top:8px;';
          notice.textContent = 'Taking longer than expected...';
          skelEl.appendChild(notice);
        }
      }
    }, 2800);

    this.userId = user.id;
    this.userEmail = user.email || '';

    try { await this.loadOwnProfile(); } catch (e) { console.warn('[init] loadOwnProfile:', e); }
    try { DB.getMyClubs(user.id).then(c => { this.clubs = c; }).catch(()=>{}); } catch(e){}

    if (this.ownProfile && !this.ownProfile.username) {
      const modal = document.getElementById('usernamePromptModal');
      if (modal) modal.style.display = 'flex';
    }

    const shortEmail = this.userEmail.length > 20 ? this.userEmail.substring(0, 18) + '...' : this.userEmail;
    const accountEmailEl = document.getElementById('accountEmail');
    if (accountEmailEl) accountEmailEl.textContent = shortEmail;
    const accountMenuEmailEl = document.getElementById('accountMenuEmail');
    if (accountMenuEmailEl) accountMenuEmailEl.textContent = this.userEmail;

    this._loadAvatar();
    this._loadTheme();

    const hash = window.location.hash || '';
    if (hash.startsWith('#tree/')) {
      const shelfId = hash.substring(6);
      await this.loadPublicShelf(shelfId);
      this.openReadingTree(this.currentYear);
      return;
    }
    if (hash.startsWith('#shelf/')) {
      const shelfId = hash.substring(7);
      await this.loadPublicShelf(shelfId);
      return;
    }
    const pendingClubId = typeof localStorage !== 'undefined' ? localStorage.getItem('sl_pending_club_invite') : null;
    if (pendingClubId) {
      try {
        localStorage.removeItem('sl_pending_club_invite');
      } catch (e) {}
      this._currentClub = pendingClubId;
      try {
        const joined = await DB.joinClub(pendingClubId, this.userId || user.id);
        const clubName = joined?.name || (pendingClubId === 'mock_c1' ? 'Sci-Fi Sundays' : (pendingClubId === 'mock_c2' ? 'The Classics' : 'Club'));
        if (typeof this.showToast === 'function') {
          this.showToast(`Joined ${clubName}!`);
        }
        if (typeof this.openModal === 'function') {
          this.openModal('communityModal');
        }
        if (typeof this.switchCommunityTab === 'function') {
          this.switchCommunityTab('clubs');
        }
        if (typeof this.switchTab === 'function') {
          this.switchTab('social');
        }
        if (typeof this.openClub === 'function') {
          await this.openClub(pendingClubId);
        }
      } catch (err) {
        console.warn('Failed to auto-join pending club:', err);
      }
    } else if (hash.match(/^#(?:club|invite)\/([^/?&#]+)/)) {
      const match = hash.match(/^#(?:club|invite)\/([^/?&#]+)/);
      const clubId = decodeURIComponent(match[1]);
      this._currentClub = clubId;
      try {
        await DB.joinClub(clubId, this.userId || user.id);
        if (typeof this.openModal === 'function') {
          this.openModal('communityModal');
        }
        if (typeof this.switchCommunityTab === 'function') {
          this.switchCommunityTab('clubs');
        }
        if (typeof this.switchTab === 'function') {
          this.switchTab('social');
        }
        if (typeof this.openClub === 'function') {
          await this.openClub(clubId);
        }
      } catch (err) {
        console.warn('Failed to open hash club in init:', err);
      }
    }

    try {
      if (typeof this.migrateGuestBooksIfAny === 'function') {
        await this.migrateGuestBooksIfAny(this.userId || user.id);
      }
    } catch (e) {
      console.warn('[init] migrateGuestBooksIfAny error:', e);
    }

    try {
      await this.loadYear(this.currentYear);
    } catch (e) {
      console.error('[init] loadYear failed:', e);
      this.showToast('Failed to load books. Please refresh to try again.', true);
      if (!Array.isArray(this.books)) this.books = [];
    }

    try {
      if (typeof this.populatePeriodSelect === 'function') this.populatePeriodSelect();
      if (typeof this.render === 'function') this.render();
      this._clearSkeletonWatchdog();
      try { this.recordMilestones(); } catch (e) {}
    } catch (e) {
      console.error('[init] render failed:', e);
      this.showToast('Error rendering library. Please refresh.', true);
      this._clearSkeletonWatchdog();
      this._hideSkeleton();
    }

    try {
      if (hash.startsWith('#wrapped/')) {
        const wYear = parseInt(hash.substring(9));
        if (!isNaN(wYear) && typeof this.openWrapped === 'function') {
          setTimeout(() => this.openWrapped(wYear), 600);
        }
      }

      DB.trackEvent('page_view', { mode: 'authenticated', year: this.currentYear, bookCount: this.books.length });

      const myw = document.getElementById('multiYearWrap');
      if (myw) myw.style.display = '';

      const gsb = document.getElementById('globalSearchBtn');
      if (gsb) gsb.style.display = '';

      const isOwnerAdmin = isAppAdmin(this);
      if (isOwnerAdmin) {
        ['menuAnalyticsItem', 'menuLaserItem', 'analyticsMenuItem', 'desktopLaserItem'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.style.display = '';
        });
        const lwb = document.getElementById('laserWaitlistBtn');
        if (lwb) lwb.style.display = 'inline-flex';
      } else {
        ['menuAnalyticsItem', 'menuLaserItem', 'analyticsMenuItem', 'desktopLaserItem'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.style.display = 'none';
        });
        const lwb = document.getElementById('laserWaitlistBtn');
        if (lwb) lwb.style.display = 'none';
      }
    } catch (e) {
      console.warn('[init] post-render setup:', e);
    }
  },

  async _viewPublicShelf(userId) {
    try {
      let data = await DB.getPublicShelfByUser(userId);
      if (!data || !data.id) {
        data = await DB.getPublicShelf(userId);
      }
      if (data && data.id) {
        if (typeof this.closeModal === 'function') {
          this.closeModal('profileViewModal');
          this.closeModal('communityModal');
          this.closeModal('socialModal');
        }
        window.location.hash = '#shelf/' + data.id;
        await this.loadPublicShelf(data.id);
      } else {
        this.showToast('This user has no public shelves.');
      }
    } catch(e) {
      this.showToast('This user has no public shelves.');
    }
  },

  async initReadOnly(shelfId) {
    await this.loadPublicShelf(shelfId);
  },

  async startDemo(showSplash = true) {
    this.isDemoMode = true;
    this._loadTheme();

    if (showSplash && typeof window !== 'undefined' && window.Auth && typeof window.Auth.showBootLoader === 'function') {
      window.Auth.showBootLoader('animated');
    }

    DB.trackEvent('page_view', { mode: 'demo' });
    DB.trackEvent('demo_mode_entered', {});

    this.isReadOnly = false;
    this.ownerDisplayName = 'Demo User';
    this.displayName = 'Demo User';
    this._avatarEmoji = '🤖';
    this.currentYear = 2026;
    this.readingGoals = { 2026: 30 };

    const darkMatterOrigIdx = getDemoBooks().findIndex(b => b.title === 'Dark Matter' && !b.isReread);

    this.books = getDemoBooks().map((b, i) => {
      b.genre = normalizeGenre(b.genre);
      const fmt = b.format || 'physical';
      const durH = fmt === 'audiobook' ? parseFloat((b.words / 9000).toFixed(2)) : null;
      const demoGender = b.authorGender || (DEMO_AUTHOR_GENDERS[b.author] ? DEMO_AUTHOR_GENDERS[b.author].gender : null);
      const demoConf = b.authorGenderConfidence || (DEMO_AUTHOR_GENDERS[b.author] ? DEMO_AUTHOR_GENDERS[b.author].confidence : null);
      const demoDemo = DEMO_AUTHOR_REGIONS_V2[b.author] || {};
      const autoMoods = suggestMoods(b.genre || 'General Fiction', b.sentiment || 'mixed');

      return {
        id: 'demo-' + i,
        title: b.title,
        author: b.author,
        words: b.words || (lookupWordCountOverride(b.title)?.words) || 80000,
        pageCount: b.pageCount || (lookupWordCountOverride(b.title)?.pageCount) || 0,
        year: b.year,
        days: b.days,
        sentiment: b.sentiment,
        month: b.month,
        genre: b.genre,
        fiction: b.fiction,
        coverUrl: b.coverUrl,
        cover: b.coverUrl || coverPlaceholder(b.title, b.author, b.sentiment),
        fallbackCover: coverPlaceholder(b.title, b.author, b.sentiment),
        review: b.review || '',
        currentlyReading: !!b.currentlyReading,
        dateStarted: b.dateStarted || null,
        sortOrder: i,
        format: fmt,
        durationHours: durH,
        wordCountSource: 'provided',
        wordCountEstimated: false,
        authorGender: demoGender,
        authorGenderConfidence: demoConf,
        authorRegion: demoDemo.region || null,
        authorRegionV2: demoDemo.region || null,
        authorCountry: demoDemo.country || null,
        isbn: b.isbn || null,
        moods: autoMoods,
        isReread: b.isReread || false,
        originalReadYear: b.originalReadYear || null,
        originalReadId: (b.isReread && darkMatterOrigIdx >= 0) ? ('demo-' + darkMatterOrigIdx) : null,
        rereadCount: 0,
        dnf: b.dnf || false,
        status: b.status || null,
        queue_order: b.queue_order || null,
      };
    });

    if (darkMatterOrigIdx >= 0) {
      const orig = this.books.find(b => String(b.id) === String("demo-" + darkMatterOrigIdx));
      if (orig) orig.rereadCount = 1;
    }

    const botyCandidate = this.books.find(b => b.title === '1Q84') || this.books[0];
    if (botyCandidate) botyCandidate.bookOfYear = this.currentYear;

    const yrInp = document.getElementById('yearInput');
    if (yrInp) yrInp.value = this.currentYear;
    this.updateMastheadTitle();

    const roBadge = document.getElementById('readOnlyBadge');
    if (roBadge) {
      roBadge.style.display = 'inline-block';
      roBadge.textContent = 'Demo';
    }

    const fabA = document.getElementById('fabAdd');
    if (fabA) fabA.style.display = '';
    const fabS = document.getElementById('fabShare');
    if (fabS) fabS.style.display = 'flex';
    const demoSign = document.getElementById('demoSignInBtn');
    if (demoSign) demoSign.style.display = 'inline-flex';

    const _dtb = document.getElementById('demoTopBar');
    if (_dtb) _dtb.classList.add('visible');

    this._applyMenuAvatar();
    const myw = document.getElementById('multiYearWrap');
    if (myw) myw.style.display = '';

    this._demoToastTimer = null;
    setTimeout(() => {
      const toast = document.getElementById('demoWelcomeToast');
      if (toast) toast.classList.add('visible');
      this._demoToastTimer = setTimeout(() => this.dismissDemoToast(), 5000);
    }, 400);

    if (showSplash) {
      setTimeout(() => {
        Auth.hideAuthScreen();
      }, 2400);
    } else {
      Auth.hideAuthScreen();
    }
    this.updateBrandTitle();
    this._applyMenuAvatar();

    if (typeof this.populatePeriodSelect === 'function') this.populatePeriodSelect();
    if (typeof this.render === 'function') this.render();
    if (typeof this.initCommunityBell === 'function') this.initCommunityBell();

    const pendingDemoClubId = typeof localStorage !== 'undefined' ? localStorage.getItem('sl_pending_club_invite') : null;
    if (pendingDemoClubId) {
      try {
        localStorage.removeItem('sl_pending_club_invite');
      } catch (e) {}
      this._currentClub = pendingDemoClubId;
      try {
        const joined = await DB.joinClub(pendingDemoClubId, this.userId || 'demo_user');
        const clubName = joined?.name || (pendingDemoClubId === 'mock_c1' ? 'Sci-Fi Sundays' : (pendingDemoClubId === 'mock_c2' ? 'The Classics' : 'Club'));
        if (typeof this.showToast === 'function') {
          this.showToast(`Joined ${clubName}!`);
        }
        if (typeof this.openModal === 'function') {
          this.openModal('communityModal');
        }
        if (typeof this.switchCommunityTab === 'function') {
          this.switchCommunityTab('clubs');
        }
        if (typeof this.switchTab === 'function') {
          this.switchTab('social');
        }
        if (typeof this.openClub === 'function') {
          await this.openClub(pendingDemoClubId);
        }
      } catch (err) {
        console.warn('Failed to auto-join demo pending club:', err);
      }
    } else {
      const hash = (typeof window !== 'undefined' && window.location.hash) || '';
      const match = hash.match(/^#(?:club|invite)\/([^/?&#]+)/);
      if (match && match[1]) {
        const hashClubId = decodeURIComponent(match[1]);
        this._currentClub = hashClubId;
        try {
          await DB.joinClub(hashClubId, this.userId || 'demo_user');
          if (typeof this.openModal === 'function') {
            this.openModal('communityModal');
          }
          if (typeof this.switchCommunityTab === 'function') {
            this.switchCommunityTab('clubs');
          }
          if (typeof this.switchTab === 'function') {
            this.switchTab('social');
          }
          if (typeof this.openClub === 'function') {
            await this.openClub(hashClubId);
          }
        } catch (err) {
          console.warn('Failed to join hash club in startDemo:', err);
        }
      } else {
        setTimeout(() => {
          try {
            if (!localStorage.getItem('notetoshelf_cozy_prompted') && this.isDemoMode) {
              this.openWelcomeExperience();
            }
          } catch (e) {}
        }, showSplash ? 2800 : 700);
      }
    }
  },

  exitDemo() {
    this.isDemoMode = false;
    this.isReadOnly = false;
    this.ownerDisplayName = '';
    this.books = [];

    const _dtb2 = document.getElementById('demoTopBar');
    if (_dtb2) _dtb2.classList.remove('visible');

    this.dismissDemoToast();

    const roB = document.getElementById('readOnlyBadge');
    if (roB) {
      roB.style.display = 'none';
      roB.textContent = 'Read Only';
    }
    const retHome = document.getElementById('returnHomeBtn');
    if (retHome) retHome.style.display = 'none';
    const demoSign = document.getElementById('demoSignInBtn');
    if (demoSign) demoSign.style.display = 'none';
    const accBtn = document.getElementById('accountBtn');
    if (accBtn) accBtn.style.display = '';
    const fabA = document.getElementById('fabAdd');
    if (fabA) fabA.style.display = 'flex';

    if (typeof window !== 'undefined' && window.CameraScanner && window.CameraScanner.stop) {
      window.CameraScanner.stop();
    }

    this.updateBrandTitle();
    this._applyMenuAvatar();
    Auth.showAuthScreen();
  },

  dismissDemoToast() {
    if (this._demoToastTimer) {
      clearTimeout(this._demoToastTimer);
      this._demoToastTimer = null;
    }
    const toast = document.getElementById('demoWelcomeToast');
    if (toast) toast.classList.remove('visible');
  },

  async loadPublicClub(clubId) {
    try {
      if (!_supabase) {
        this.showToast('Error: Supabase client is undefined');
        return;
      }

      const { data: club, error } = await _supabase.from('clubs').select('*').eq('id', clubId).single();
      if (error) {
        this.showToast('Error fetching club: ' + error.message);
        Auth.showAuthScreen();
        return;
      }
      if (!club) {
        this.showToast('Error: Club not found in database');
        Auth.showAuthScreen();
        return;
      }

      Auth.hideAuthScreen();
      club.myRole = 'guest';
      this.clubs = [club];

      const b = document.getElementById('readOnlyBadge');
      if (b) { b.style.display = 'inline-block'; b.innerText = 'Public Club View'; }

      const homeBtn = document.getElementById('returnHomeBtn');
      if (homeBtn) {
        homeBtn.style.display = 'inline-block';
        homeBtn.innerText = 'Sign in to Join';
        homeBtn.onclick = () => { window.location.hash = ''; window.location.reload(); };
      }
      const accBtn = document.getElementById('accountBtn');
      if (accBtn) accBtn.style.display = 'none';
      const demoBtn = document.getElementById('demoSignInBtn');
      if (demoBtn) demoBtn.style.display = 'none';

      this._loadTheme();
      if (typeof this.render === 'function') this.render();

      this.switchTab('social');
      this.switchCommunityTab('clubs');

      setTimeout(() => {
        try {
          if (typeof this.openClub === 'function') this.openClub(clubId);
        } catch (e) {
          this.showToast('Error opening club: ' + e.message);
        }
      }, 100);
    } catch (ex) {
      this.showToast('Fatal error in loadPublicClub: ' + ex.message);
    }
  },

  async loadPublicShelf(shelfId) {
    if (!shelfId) return;
    if (this._loadingPublicShelfId === shelfId) return;
    this._loadingPublicShelfId = shelfId;

    try {
      if (!this._userBooksBackup && !this.isReadOnly && this.books && this.books.length > 0) {
        this._userBooksBackup = this.books;
        this._userYearsBackup = this.userYears;
        this._userMultiYearBackup = this.multiYearRange;
        this._userShelfBackup = this.currentShelf;
      }

      const shelf = await DB.getPublicShelf(shelfId);
      if (!shelf) {
        this.showToast('This shelf is private or does not exist.');
        return;
      }

      this.currentYear = Number(shelf.year) || 2026;
      this.currentShelf = shelf;
      this.isReadOnly = true;
      this.multiYearRange = 'single';

      const ownerProfile = await DB.getUserProfile(shelf.user_id);
      this.ownerDisplayName = normalizeDisplayName(ownerProfile?.display_name || deriveDisplayNameFromEmail('reader@example.com'), 'reader@example.com');

      const dbBooks = await DB.getPublicShelfBooks(shelfId);
      this.books = (dbBooks || []).map(dbToBook);

      if (shelf.year) {
        this.books.forEach(b => {
          b.readYear = Number(shelf.year);
          b._shelfYear = Number(shelf.year);
          b.shelfId = shelfId;
        });
      }

      try {
        const ownerShelves = await DB.getUserShelves(shelf.user_id);
        if (ownerShelves && ownerShelves.length > 0) {
          this.userYears = ownerShelves.filter(s => s.public !== false).map(s => Number(s.year)).sort((a, b) => b - a);
          if (typeof this.renderYearsList === 'function') this.renderYearsList();
        }
      } catch (e) {
        console.warn('Could not load owner shelves:', e);
      }

      if (typeof this._populateAuthorMeta === 'function') this._populateAuthorMeta();
      if (typeof this._autoEnrichSeries === 'function') this._autoEnrichSeries();

      const yrInp = document.getElementById('yearInput');
      if (yrInp) yrInp.value = this.currentYear;
      const yrWm = document.getElementById('yearWatermark');
      if (yrWm) yrWm.textContent = this.currentYear;

      // Hide personal user bubble so it does not collide with the reader's shelf identity
      const userBubble = document.getElementById('mastheadUserBubble');
      if (userBubble) {
        this._userBubbleWasVisible = userBubble.style.display !== 'none';
        userBubble.style.display = 'none';
      }

      const roB = document.getElementById('readOnlyBadge');
      if (roB) {
        roB.style.display = 'inline-flex';
        const shelfName = this.ownerDisplayName ? `${this.ownerDisplayName}'s Shelf` : 'Public Shelf';
        roB.innerHTML = `<span style="font-size:12px;line-height:1;">📖</span> <span>${this._escapeHtml(shelfName)}</span>`;
      }

      const bh = document.getElementById('booksHeader');
      if (bh) bh.textContent = this.ownerDisplayName ? `${this.ownerDisplayName}'s Shelf` : 'Public Shelf';

      const retHome = document.getElementById('returnHomeBtn');
      if (retHome) {
        retHome.style.display = 'inline-block';
        retHome.textContent = '← Return to My Shelf';
        retHome.onclick = () => {
          if (typeof this.exitClubShelf === 'function') {
            this.exitClubShelf();
          } else {
            window.location.hash = '';
            window.location.reload();
          }
        };
      }

      const fabA = document.getElementById('fabAdd');
      if (fabA) {
        fabA.style.display = 'flex';
        fabA.classList.add('return-shelf-mode');
        fabA.setAttribute('title', 'Return to your shelf');
        fabA.setAttribute('aria-label', 'Return to your shelf');
        const plusBadge = document.getElementById('spinePlusBadge');
        if (plusBadge) plusBadge.textContent = '↩';
        const headline = document.getElementById('spineHeadlineText');
        if (headline) headline.textContent = 'MY SHELF';
        const edition = document.getElementById('spineEditionLabel');
        if (edition) edition.textContent = 'RETURN HOME';
      }
      const fabS = document.getElementById('fabShare');
      if (fabS) fabS.style.display = 'flex';
      const demoSign = document.getElementById('demoSignInBtn');
      if (demoSign) demoSign.style.display = 'none';
      const accBtn = document.getElementById('accountBtn');
      if (accBtn) accBtn.style.display = 'none';

      Auth.hideAuthScreen();
      this.updateBrandTitle();
      this._applyMenuAvatar();

      if (typeof this.render === 'function') this.render();
      DB.trackEvent('page_view', { mode: 'public_shelf', shelf_id: shelfId, bookCount: this.books.length });
    } finally {
      this._loadingPublicShelfId = null;
    }
  },

  exitClubShelf() {
    if (this._userBooksBackup) {
      this.books = this._userBooksBackup;
      this._userBooksBackup = null;
    } else if (!this.books || this.books.length === 0) {
      if (typeof getDemoBooks === 'function') this.books = getDemoBooks();
    }
    if (this._userYearsBackup) {
      this.userYears = this._userYearsBackup;
      this._userYearsBackup = null;
      if (typeof this.renderYearsList === 'function') this.renderYearsList();
    }
    if (this._userMultiYearBackup) {
      const prevRange = this._userMultiYearBackup;
      this._userMultiYearBackup = null;
      if (prevRange !== 'single' && typeof this.setMultiYearRange === 'function') {
        this.setMultiYearRange(prevRange);
      }
    }
    this.isReadOnly = false;
    if (this._userShelfBackup) {
      this.currentShelf = this._userShelfBackup;
      this._userShelfBackup = null;
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
      if (edition) edition.textContent = 'VOL. ' + (this.currentYear || 2026);
    }
    const accBtn = document.getElementById('accountBtn');
    if (accBtn) accBtn.style.display = 'flex';
    const userBubble = document.getElementById('mastheadUserBubble');
    if (userBubble && (this._userBubbleWasVisible || this.displayName || this.userId)) userBubble.style.display = 'inline-flex';
    const rb = document.getElementById('readOnlyBadge');
    if (rb) rb.style.display = 'none';
    const retBtn = document.getElementById('returnHomeBtn');
    if (retBtn) retBtn.style.display = 'none';
    const bh = document.getElementById('booksHeader');
    if (bh) bh.textContent = 'My Shelf';
    const brandEl = document.getElementById('brandTitle');
    if (brandEl) brandEl.textContent = 'Note to Shelf';
    document.title = 'Note to Shelf';
    if (typeof this.updateBrandTitle === 'function') this.updateBrandTitle();
    if (typeof this.updateMastheadTitle === 'function') this.updateMastheadTitle();
    if (typeof this.render === 'function') this.render();
    if (typeof this.showToast === 'function') this.showToast('Returned to personal shelf');
  },

  
  triggerLandingImport() {
    const picker = document.getElementById('landingCsvPicker');
    if (picker) {
      picker.value = '';
      picker.click();
    } else {
      this.startDemo();
      setTimeout(() => this.openModal('importModal'), 350);
    }
  },

  async handleLandingCSV(event) {
    const file = event && event.target && event.target.files && event.target.files[0];
    if (!file) return;

    if (window.Auth && typeof window.Auth.showBootLoader === 'function') {
      window.Auth.showBootLoader('animated');
    }

    this.isDemoMode = true;
    this.isGuestImport = true;
    this.isReadOnly = false;
    this.ownerDisplayName = 'My Study';
    this.displayName = 'My Study';

    const authScreen = document.getElementById('authScreen');
    if (authScreen) authScreen.style.display = 'none';
    const mainApp = document.getElementById('mainApp');
    if (mainApp) mainApp.style.display = 'block';

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const csvText = e.target.result;
        await this.processGuestCSVText(csvText);
      } catch (err) {
        console.error('Error processing guest CSV:', err);
        this.showToast('Could not parse CSV. Opening import modal...');
        this.openModal('importModal');
      }
    };
    reader.readAsText(file);
  },

  parseFlexibleDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const s = dateStr.trim();
    if (!s) return null;

    if (/^\d{4}$/.test(s)) {
      const yr = parseInt(s, 10);
      if (yr >= 1900 && yr <= 2100) return new Date(yr, 0, 1);
    }

    const ymd = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (ymd) {
      const yr = parseInt(ymd[1], 10);
      const mo = parseInt(ymd[2], 10) - 1;
      const dy = parseInt(ymd[3], 10);
      if (mo >= 0 && mo <= 11 && dy >= 1 && dy <= 31) {
        return new Date(yr, mo, dy);
      }
    }

    const slashMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (slashMatch) {
      const p1 = parseInt(slashMatch[1], 10);
      const p2 = parseInt(slashMatch[2], 10);
      const yr = parseInt(slashMatch[3], 10);
      if (p1 > 12 && p2 <= 12) {
        return new Date(yr, p2 - 1, p1);
      } else {
        return new Date(yr, p1 - 1, p2);
      }
    }

    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;
    return null;
  },

  async processGuestCSVText(csvText) {
    if (typeof this.parseCSVString !== 'function') {
      console.error('parseCSVString missing');
      return;
    }
    if (typeof csvText === 'string') {
      csvText = csvText.replace(/^\uFEFF/, '');
    }
    const rows = this.parseCSVString(csvText);
    if (rows.length < 2) {
      this.showToast('CSV file appears empty.');
      return;
    }

    const headers = rows[0].map(h => h.trim().toLowerCase());
    const findCol = (aliases) => {
      for (let a of aliases) {
        const idx = headers.indexOf(a.toLowerCase());
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const titleIdx = findCol(['title', 'book title']);
    const authorIdx = findCol(['author', 'authors', 'primary author', 'creator']);
    const pagesIdx = findCol(['number of pages', 'pages', 'page count', 'paces']);
    const dateReadIdx = findCol(['last date read', 'date read', 'dates read', 'last read']);
    const dateAddedIdx = findCol(['date added', 'added date', 'created at']);
    const shelfIdx = findCol(['exclusive shelf', 'read status', 'status', 'bookshelves', 'shelf']);
    const ratingIdx = findCol(['my rating', 'star rating', 'rating']);
    const reviewIdx = findCol(['my review', 'review', 'reviews']);
    const yearPubIdx = findCol(['original publication year', 'year published', 'year', 'publication year']);
    const coverUrlIdx = findCol(['cover url', 'cover']);
    const wordCountIdx = findCol(['word count', 'word count estimate']);
    const genreIdx = findCol(['genre', 'genres']);
    const sentimentIdx = findCol(['sentiment', 'moods', 'mood']);
    const daysIdx = findCol(['days to read', 'days']);
    const formatIdx = findCol(['format', 'binding']);

    if (titleIdx < 0) {
      this.showToast('CSV missing "Title" column.');
      return;
    }

    const guestBooks = [];
    for (let i = 1; i < rows.length; i++) {
      const cols = rows[i];
      if (cols.length === 1 && !cols[0].trim()) continue;

      let shelfRaw = shelfIdx >= 0 ? (cols[shelfIdx] || '').toLowerCase().trim() : 'read';
      let status = 'finished';
      if (shelfRaw.includes('currently-reading') || shelfRaw === 'reading' || shelfRaw.includes('currently reading')) {
        status = 'reading';
      } else if (
        shelfRaw.includes('to-read') ||
        shelfRaw.includes('to read') ||
        shelfRaw === 'tbr' ||
        shelfRaw.includes('want to read') ||
        shelfRaw.includes('wishlist') ||
        shelfRaw === 'queued'
      ) {
        status = 'to-read';
      } else if (shelfRaw.includes('did-not-finish') || shelfRaw === 'dnf') {
        status = 'dnf';
      } else {
        status = 'finished';
      }

      let dateStr = dateReadIdx >= 0 ? (cols[dateReadIdx] || '') : '';
      if (!dateStr && status !== 'to-read' && dateAddedIdx >= 0) dateStr = cols[dateAddedIdx] || '';

      let month = status === 'to-read' ? '' : (window.ALL_MONTHS ? window.ALL_MONTHS[new Date().getMonth()] : 'January');
      let bookYear = new Date().getFullYear();
      if (dateStr) {
        const d = this.parseFlexibleDate(dateStr);
        if (d) {
          month = status === 'to-read' ? '' : (window.ALL_MONTHS ? window.ALL_MONTHS[d.getMonth()] : 'January');
          bookYear = d.getFullYear();
        }
      }

      const pagesRaw = parseInt(pagesIdx >= 0 ? cols[pagesIdx] : '') || 0;
      let sentiment = '';
      if (status !== 'to-read') {
        if (sentimentIdx >= 0 && cols[sentimentIdx]) {
          const s = cols[sentimentIdx].toLowerCase().trim();
          if (['love', 'like', 'mixed', 'dislike'].includes(s)) sentiment = s;
          else sentiment = 'mixed';
        } else {
          const rating = parseFloat(ratingIdx >= 0 ? cols[ratingIdx] : '') || 0;
          sentiment = rating >= 4.5 ? 'love' : rating >= 3.5 ? 'like' : (rating >= 2.5 || rating === 0) ? 'mixed' : 'dislike';
        }
      }

      const wordCountExplicit = wordCountIdx >= 0 ? (parseInt(cols[wordCountIdx]) || 0) : 0;
      const wcEstimated = !wordCountExplicit;
      const words = wordCountExplicit || (pagesRaw ? Math.round(pagesRaw * 275) : 80000);
      const pages = pagesRaw || Math.round(words / 275);
      const pubYear = parseInt(yearPubIdx >= 0 ? cols[yearPubIdx] : '') || bookYear;
      const review = reviewIdx >= 0 ? (cols[reviewIdx] || '') : '';
      const genre = genreIdx >= 0 ? (cols[genreIdx] || 'General Fiction') : 'General Fiction';
      const days = status === 'to-read' ? 0 : (daysIdx >= 0 ? (parseInt(cols[daysIdx]) || 5) : 5);
      let coverUrl = coverUrlIdx >= 0 ? (cols[coverUrlIdx] || '') : '';
      const isFiction = !genre.toLowerCase().includes('non-fiction');

      let bookFormat = 'physical';
      if (formatIdx >= 0 && cols[formatIdx]) {
        const f = cols[formatIdx].toLowerCase().trim();
        if (f.includes('audio')) bookFormat = 'audiobook';
        else if (f.includes('digital') || f.includes('kindle') || f.includes('ebook') || f.includes('nook')) bookFormat = 'ebook';
      }

      let title = cols[titleIdx] || 'Untitled';
      let seriesTitle = '';
      if (typeof this.parseSeriesFromTitle === 'function') {
        const parsed = this.parseSeriesFromTitle(title);
        if (parsed && parsed.title) {
          title = parsed.title;
          seriesTitle = parsed.series || '';
        }
      }

      const author = (authorIdx >= 0 ? cols[authorIdx] : '') || 'Unknown Author';

      guestBooks.push({
        id: 'guest-' + i + '-' + Date.now(),
        title: title,
        author: author,
        series: seriesTitle,
        words: words,
        wordCountSource: wordCountExplicit ? 'provided' : 'calculated',
        wordCountEstimated: wcEstimated,
        year: pubYear,
        readYear: bookYear,
        days: days,
        sentiment: sentiment,
        month: month,
        genre: genre,
        fiction: isFiction,
        coverUrl: coverUrl,
        cover: coverUrl || '',
        fallbackCover: '',
        review: review,
        format: bookFormat,
        status: status,
        currentlyReading: status === 'reading',
        sortOrder: i
      });
    }

    if (!guestBooks.length) {
      this.showToast('No valid books found in this CSV.');
      return;
    }

    this.allGuestBooks = guestBooks;
    this.isGuestImport = true;
    this.isDemoMode = true;
    this.ownerDisplayName = 'Guest Reader';
    try {
      localStorage.setItem('notetoshelf_guest_books', JSON.stringify(guestBooks));
      localStorage.setItem('notetoshelf_is_guest', 'true');
    } catch (e) {}

    const finishedBooks = guestBooks.filter(b => b.status !== 'to-read' && b.status !== 'dnf');
    const distinctYears = [...new Set(finishedBooks.map(b => b.readYear || b.year))].filter(y => y >= 1900 && y <= 2100).sort((a, b) => b - a);
    this.userYears = distinctYears.map(y => ({ year: y }));
    this.currentYear = distinctYears[0] || new Date().getFullYear();

    const yrInp = document.getElementById('yearInput');
    if (yrInp) yrInp.value = this.currentYear;

    this.books = finishedBooks.filter(b => (b.readYear === this.currentYear || b.year === this.currentYear));
    this.toReadBooks = guestBooks.filter(b => b.status === 'to-read');
    this.crBooks = guestBooks.filter(b => b.status === 'reading');

    // Resolve cover art asynchronously for first batch
    this.books.slice(0, 25).forEach(async (b) => {
      if (!b.coverUrl) {
        try {
          const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(b.title)}+inauthor:${encodeURIComponent(b.author)}`);
          const data = await res.json();
          if (data.items && data.items.length > 0) {
            const thumb = data.items[0].volumeInfo?.imageLinks?.thumbnail;
            if (thumb) {
              b.coverUrl = thumb.replace('http:', 'https:');
              b.cover = b.coverUrl;
              if (typeof this.render === 'function') this.render();
            }
          }
        } catch (e) {}
      }
    });

    this.updateMastheadTitle();
    if (typeof this.render === 'function') this.render();
    if (typeof this.renderYearsList === 'function') this.renderYearsList();
    this.showGuestImportBanner(guestBooks.length);
    this.showToast(`🎉 Brought ${guestBooks.length} books from your archive onto your shelf!`);
  },

  showGuestImportBanner(count) {
    let banner = document.getElementById('guestImportBanner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'guestImportBanner';
      banner.className = 'guest-import-top-banner';
      const main = document.getElementById('mainApp');
      if (main) main.insertBefore(banner, main.firstChild);
    }
    banner.innerHTML = `
      <div class="guest-banner-inner">
        <div class="guest-banner-text">
          <span class="guest-banner-sparkle">✨</span>
          <span><strong>${count} books</strong> from your archive are now on your shelf! (Local-first & private)</span>
        </div>
        <div class="guest-banner-actions">
          <button class="guest-save-btn" onclick="Auth.showLoginModal('signup')">
            Save Your Study to Sync Across Devices →
          </button>
          <button class="guest-dismiss-btn" onclick="document.getElementById('guestImportBanner').style.display='none'" title="Dismiss">✕</button>
        </div>
      </div>
    `;
    banner.style.display = 'block';
  },

  async restoreGuestSession() {
    this.isDemoMode = true;
    this.isGuestImport = true;
    this.isReadOnly = false;
    this.ownerDisplayName = 'Guest Reader';

    try {
      const raw = localStorage.getItem('notetoshelf_guest_books');
      if (raw) {
        this.allGuestBooks = JSON.parse(raw);
      }
    } catch (e) {
      this.allGuestBooks = [];
    }

    if (!Array.isArray(this.allGuestBooks) || !this.allGuestBooks.length) {
      if (typeof Auth !== 'undefined' && typeof Auth.showAuthScreen === 'function') {
        Auth.showAuthScreen();
      }
      return;
    }

    const finishedBooks = this.allGuestBooks.filter(b => b.status !== 'to-read' && b.status !== 'dnf');
    const distinctYears = [...new Set(finishedBooks.map(b => b.readYear || b.year))].filter(y => y >= 1900 && y <= 2100).sort((a, b) => b - a);
    this.userYears = distinctYears.map(y => ({ year: y }));
    this.currentYear = distinctYears[0] || new Date().getFullYear();

    const yrInp = document.getElementById('yearInput');
    if (yrInp) yrInp.value = this.currentYear;

    this.books = finishedBooks.filter(b => (b.readYear === this.currentYear || b.year === this.currentYear));
    this.toReadBooks = this.allGuestBooks.filter(b => b.status === 'to-read');
    this.crBooks = this.allGuestBooks.filter(b => b.status === 'reading');

    this._loadTheme();
    this.updateMastheadTitle();
    if (typeof this.render === 'function') this.render();
    if (typeof this.renderYearsList === 'function') this.renderYearsList();
    this.showGuestImportBanner(this.allGuestBooks.length);
  },

  clearGuestStudy() {
    if (window.confirm('Exit guest study? Any unsaved books from this session will be cleared.')) {
      try {
        localStorage.removeItem('notetoshelf_guest_books');
        localStorage.removeItem('notetoshelf_is_guest');
      } catch (e) {}
      this.isGuestImport = false;
      this.allGuestBooks = null;
      window.location.reload();
    }
  },

  async migrateGuestBooksIfAny(userId) {
    if (!userId) return;
    try {
      const raw = localStorage.getItem('notetoshelf_guest_books');
      if (!raw) return;
      const guestBooks = JSON.parse(raw);
      if (!Array.isArray(guestBooks) || !guestBooks.length) return;

      this.showToast('✨ Saving your guest library to your account...');

      const byYear = {};
      for (const b of guestBooks) {
        const yr = b.readYear || b.year || this.currentYear || new Date().getFullYear();
        if (!byYear[yr]) byYear[yr] = [];
        byYear[yr].push(b);
      }

      let totalAdded = 0;
      for (const yrStr of Object.keys(byYear)) {
        const yr = parseInt(yrStr, 10);
        const shelf = await DB.getOrCreateShelf(userId, yr);
        if (!shelf) continue;

        const rows = byYear[yrStr].map((b, idx) => ({
          shelf_id: shelf.id,
          user_id: userId,
          title: b.title,
          author: b.author,
          cover_url: b.coverUrl || b.cover || '',
          genre: b.genre || 'General Fiction',
          page_count: b.pages || 0,
          pub_year: b.year || yr,
          word_count: b.words || 0,
          word_count_estimated: b.wordCountEstimated !== false,
          word_count_source: b.wordCountSource || 'calculated',
          sentiment: b.sentiment || 'mixed',
          month_finished: b.month || 'January',
          days_to_read: b.days || 5,
          review: b.review || '',
          currently_reading: b.status === 'reading',
          date_started: b.status === 'reading' ? new Date().toISOString().split('T')[0] : null,
          fiction: b.fiction !== false,
          sort_order: idx,
          format: b.format || 'physical'
        }));

        const result = await DB.addBooks(rows);
        totalAdded += (result ? result.length : rows.length);
      }

      localStorage.removeItem('notetoshelf_guest_books');
      localStorage.removeItem('notetoshelf_is_guest');
      this.isGuestImport = false;
      this.allGuestBooks = null;

      const banner = document.getElementById('guestImportBanner');
      if (banner) banner.style.display = 'none';

      this.showToast(`🎉 Successfully saved ${totalAdded} books to your account!`);
      await this.loadYear(this.currentYear);
      if (typeof this.render === 'function') this.render();
    } catch (err) {
      console.error('Error migrating guest books:', err);
    }
  },

  async loadYear(year) {
    this.currentYear = year;
    const yrInp = document.getElementById('yearInput');
    if (yrInp) yrInp.value = year;
    if (typeof this.updateMastheadTitle === 'function') this.updateMastheadTitle();

        if (this.isGuestImport && Array.isArray(this.allGuestBooks)) {
      this.books = this.allGuestBooks.filter(b => (b.readYear === year || b.year === year));
      return;
    }
    if (this.isReadOnly || this.isDemoMode || !this.userId) return;

    try {
      const shelf = await this._withTimeout(DB.getOrCreateShelf(this.userId, year), 8000, 'getOrCreateShelf');
      this.currentShelf = shelf;
      if (!shelf) {
        this.books = [];
        this._hideSkeleton();
        if (typeof this.render === 'function') this.render();
        return;
      }

      const dbBooks = await this._withTimeout(DB.getShelfBooks(shelf.id), 8000, 'getShelfBooks');
      const shelfYr = shelf && shelf.year ? Number(shelf.year) : Number(this.currentYear || 2026);
      this.books = (dbBooks || []).map(b => {
        const bk = dbToBook(b);
        bk._shelfYear = shelfYr;
        if (!bk.readYear) bk.readYear = shelfYr;
        return bk;
      });

      if (typeof this.migrateWordCounts === 'function') await this.migrateWordCounts();

      const curMonth = ALL_MONTHS[new Date().getMonth()];
      this.books.forEach(b => {
        if (b.month_finished === '📖 Now Reading' || b.month === '📖 Now Reading') {
          b.month_finished = curMonth;
          b.month = curMonth;
          if (b.id || b._dbId) DB.updateBook(b.id || b._dbId, { month_finished: curMonth });
        }
      });

      if (typeof this._resolveWordCounts === 'function') this._resolveWordCounts();
      if (typeof this._populateAuthorMeta === 'function') this._populateAuthorMeta();

      const pubToggle = document.getElementById('publicToggle');
      if (pubToggle) pubToggle.checked = (shelf.public !== false);

      try {
        this.userYears = await this._withTimeout(DB.getUserYears(this.userId), 8000, 'getUserYears');
      } catch (e) {
        console.warn('[loadYear] getUserYears failed:', e);
        this.userYears = this.userYears && this.userYears.length ? this.userYears : [{ year: this.currentYear }];
      }

      this.renderYearsList();
      this.isReadOnly = false;
      this.ownerDisplayName = this.displayName;

      this.updateBrandTitle();
      this._applyMenuAvatar();

      if (typeof this._autoAnalyzeDemographics === 'function') this._autoAnalyzeDemographics();

      setTimeout(() => {
        if (typeof this._checkManualBooksForUpdates === 'function') {
          this._checkManualBooksForUpdates().catch(e => console.warn('[metaCheck]', e));
        }
      }, 4000);

      setTimeout(() => {
        if (typeof this.checkPendingNotes === 'function') {
          this.checkPendingNotes().catch(e => console.warn('[notes]', e));
        }
      }, 2500);
    } catch (e) {
      console.error('[loadYear] failed:', e);
      this.showToast('Could not load library. Please refresh.');
    }
  },

  _metaCheckKey() { return 'sl_metaCheck_' + (this.userId || 'anon'); },

  _readMetaCheckState() {
    try { return JSON.parse(localStorage.getItem(this._metaCheckKey())) || { last: 0, done: [] }; }
    catch (e) { return { last: 0, done: [] }; }
  },

  _writeMetaCheckState(st) {
    try { localStorage.setItem(this._metaCheckKey(), JSON.stringify(st)); } catch (e) {}
  },

  async _checkManualBooksForUpdates() {
    if (this.isReadOnly || this.isDemoMode || !this.userId) return;
    const WEEK = 7 * 24 * 60 * 60 * 1000;
    const st = this._readMetaCheckState();
    if (Date.now() - (st.last || 0) < WEEK) return;

    const doneSet = new Set(st.done || []);
    const candidates = (this.books || []).filter(b => b.isbn && !b.coverUrl && !b.cover && !doneSet.has(b.id)).slice(0, 10);
    st.last = Date.now();

    if (!candidates.length) { this._writeMetaCheckState(st); return; }

    let updated = 0;
    for (const b of candidates) {
      try {
        if (typeof this._fetchCoverByISBN === 'function') {
          const cover = await this._fetchCoverByISBN(b.isbn);
          if (cover) {
            await DB.updateBook(b.id, { cover_url: cover });
            b.coverUrl = cover; b.cover = cover;
            updated++;
          }
        }
      } catch (e) { console.warn('[metaCheck] lookup failed for', b.isbn, e); }
      doneSet.add(b.id);
    }

    st.done = Array.from(doneSet).slice(-500);
    this._writeMetaCheckState(st);

    if (updated > 0) {
      DB.trackEvent('manual_metadata_updated', { count: updated });
      if (typeof this.render === 'function') this.render();
      this.showToast('📚 Updated cover art for ' + updated + ' book' + (updated !== 1 ? 's' : ''));
    }
  },

  renderYearsList() {
    const container = document.getElementById('accountYearsList');
    if (!container) return;
    container.innerHTML = '';

    (this.userYears || []).forEach(y => {
      const item = document.createElement('div');
      item.className = 'account-menu-item';
      item.style.fontWeight = y.year === this.currentYear ? '700' : '400';
      item.innerHTML = `📅 ${y.year}${y.year === this.currentYear ? ' ✓' : ''}`;
      item.addEventListener('click', async () => {
        this.closeSlideMenu();
        await this.setYear(y.year);
      });
      container.appendChild(item);
    });
  },

  async createNewYear() {
    const year = parseInt(prompt('Enter year (e.g. 2025):', new Date().getFullYear()));
    if (isNaN(year) || year < 1900 || year > 2100) return;
    this.closeSlideMenu();
    await this.setYear(year);
  },

  async togglePublic() {
    if (!this.currentShelf) return;
    const pubEl = document.getElementById('publicToggle');
    const isPublic = pubEl ? pubEl.checked : false;

    await DB.updateShelfPublic(this.currentShelf.id, isPublic);
    this.currentShelf.public = isPublic;

    if (isPublic) {
      const url = window.location.origin + window.location.pathname + '#shelf/' + this.currentShelf.id;
      this.showToast('Shelf is now public! Link copied.');
      if (navigator.clipboard) navigator.clipboard.writeText(url).catch(() => {});
    } else {
      this.showToast('Shelf is now private.');
    }
  },

  toggleAccountMenu() { this.toggleSlideMenu(); },
  closeAccountMenu() { this.closeSlideMenu(); },

  async changeYear(delta) {
    const target = parseInt(this.currentYear, 10) + delta;
    if (isNaN(target) || target > 2100 || target < 1900) return;
    return await this.setYear(target);
  },

  async setYear(yr) {
    yr = parseInt(yr, 10);
    if (isNaN(yr) || yr < 1900 || yr > 2100) return;
    await this.loadYear(yr);
    if (typeof this.render === 'function') this.render();
  },

  toggleMultiYearMenu() {
    this._multiYearMenuOpen = !this._multiYearMenuOpen;
    const menu = document.getElementById('multiYearMenu');
    if (menu) menu.classList.toggle('open', this._multiYearMenuOpen);
  },

  closeMultiYearMenu() {
    this._multiYearMenuOpen = false;
    const menu = document.getElementById('multiYearMenu');
    if (menu) menu.classList.remove('open');
  },

  updateMastheadTitle() {
    const year = this.currentYear || new Date().getFullYear();
    const range = this.multiYearRange || 'single';

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
  },

  async setMultiYearRange(range) {
    this.closeMultiYearMenu();
    this.multiYearRange = range;
    try {
      localStorage.setItem('shelf_life_multi_year_range', range);
    } catch (e) {}

    document.querySelectorAll('.multi-year-menu-item').forEach(el => {
      el.classList.toggle('selected', el.dataset.range === range);
    });

    const btn = document.getElementById('multiYearBtn');
    if (btn) btn.classList.toggle('active', range !== 'single');

    this.updateMastheadTitle();

    if (range === 'single') {
      this.aggregateBooks = [];
      this.aggregateYearData = {};
      this._showAnnualView();
      if (typeof this.render === 'function') this.render();
    } else {
      await this._loadAggregateData(range);
      this._showAggregateView();
      if (typeof this.renderAggregateView === 'function') {
        this.renderAggregateView();
      } else if (typeof this.render === 'function') {
        this.render();
      }
    }
  },

  _showAnnualView() {
    const annual = document.getElementById('annualView');
    const agg = document.getElementById('aggregateView');
    if (annual) {
      annual.style.display = '';
      annual.classList.remove('view-transition-out');
      annual.classList.add('view-transition-in');
    }
    if (agg) {
      agg.classList.add('view-transition-out');
      setTimeout(() => {
        agg.style.display = 'none';
        agg.classList.remove('view-transition-out');
      }, 350);
    }
  },

  _showAggregateView() {
    const annual = document.getElementById('annualView');
    const agg = document.getElementById('aggregateView');
    if (annual) {
      annual.classList.add('view-transition-out');
      setTimeout(() => {
        annual.style.display = 'none';
        annual.classList.remove('view-transition-out');
      }, 350);
    }
    if (agg) {
      agg.style.display = '';
      agg.classList.remove('view-transition-out');
      agg.classList.add('view-transition-in');
    }
  },

  async _loadAggregateData(range) {
    if (!this.userId && !this.isDemoMode) return;

    const currentYear = parseInt(this.currentYear, 10) || new Date().getFullYear();
    let startYear, endYear;
    if (range === 'lifetime') {
      if (this.isDemoMode) {
        startYear = currentYear - 2;
        endYear = currentYear;
      } else {
        const allYears = this.userYears.length ? this.userYears : await DB.getUserYears(this.userId);
        startYear = 1900;
        endYear = Math.max(...allYears.map(y => y.year), currentYear);
      }
    } else {
      const count = parseInt(range, 10) || 1;
      endYear = currentYear;
      startYear = endYear - count + 1;
    }

    const yearsList = [];
    if (this.isDemoMode) {
      for (let y = startYear; y <= endYear; y++) {
        yearsList.push({ year: y });
      }
    } else {
      const allYears = this.userYears.length ? this.userYears : await DB.getUserYears(this.userId);
      yearsList.push(...allYears.filter(y => y.year >= startYear && y.year <= endYear).sort((a, b) => a.year - b.year));
    }

    this.aggregateYearData = {};
    this.aggregateBooks = [];

    const gbInp = document.getElementById('gbApiKeyInput');
    if (gbInp) gbInp.value = localStorage.getItem('sl_gb_key') || '';

    for (const y of yearsList) {
      const yrNum = y.year;
      if (this.isDemoMode) {
        if (this.isGuestImport && Array.isArray(this.allGuestBooks)) {
          const books = this.allGuestBooks.filter(b => (b.readYear === yrNum || b.year === yrNum) && !b.currentlyReading && b.status !== 'to-read' && b.status !== 'dnf');
          this.aggregateYearData[yrNum] = { books, year: yrNum, shelf: { id: `guest-shelf-${yrNum}`, year: yrNum, goal: books.length || 10 } };
          this.aggregateBooks.push(...books);
        } else {
          const baseBooks = (this.books || []).filter(b => !b.currentlyReading && b.status !== 'to-read');
          const books = baseBooks.map((b, idx) => ({
            ...b,
            id: `demo-${yrNum}-${idx}`,
            readYear: yrNum,
            year: yrNum,
            sortOrder: idx
          }));
          this.aggregateYearData[yrNum] = { books, year: yrNum, shelf: { id: `mock-shelf-${yrNum}`, year: yrNum, goal: 30 } };
          this.aggregateBooks.push(...books);
        }
      } else {
        const shelf = await DB.getOrCreateShelf(this.userId, yrNum);
        if (!shelf) continue;
        const dbBooks = await DB.getShelfBooks(shelf.id);
        const books = (dbBooks || []).map(dbToBook).filter(b => !b.currentlyReading && b.status !== 'to-read');
        books.forEach(b => b.readYear = yrNum);
        this.aggregateYearData[yrNum] = { books, year: yrNum, shelf };
        this.aggregateBooks.push(...books);
      }
    }

    let totalGoal = 0;
    let goalsFound = 0;
    const aggYears = new Set([...Object.keys(this.aggregateYearData), ...(this.readingGoals ? Object.keys(this.readingGoals) : [])]);
    for (let yr of aggYears) {
      const shelfData = this.aggregateYearData[yr];
      const goal = (shelfData && shelfData.shelf && shelfData.shelf.goal) || (this.readingGoals && this.readingGoals[yr]);
      if (goal) {
        totalGoal += parseInt(goal, 10);
        goalsFound++;
      }
    }
    this.aggregateGoal = goalsFound > 0 ? totalGoal : 0;

    const yearsWithData = Object.keys(this.aggregateYearData).map(Number).sort();
    this._firstDataYear = yearsWithData.length ? yearsWithData[0] : currentYear;
    this._lastDataYear = yearsWithData.length ? yearsWithData[yearsWithData.length - 1] : currentYear;
  },

  confirmDeleteYear() {
    const gm = document.getElementById('gearOverlayMenu');
    if (gm && gm.classList.contains('open')) {
      gm.classList.remove('open');
    }
    const app = (typeof window !== 'undefined' && window.App) ? window.App : this;
    if (app.isReadOnly) { (app.showToast || this.showToast)('Delete is unavailable in this mode.'); return; }
    if (!app.currentShelf) { (app.showToast || this.showToast)('No shelf loaded.'); return; }

    const year = app.currentYear;
    const count = (app.books || []).length;
    const existing = document.getElementById('deleteYearConfirmModal');
    if (existing) {
      if (typeof existing._cleanup === 'function') existing._cleanup();
      else existing.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'deleteYearConfirmModal';
    modal.className = 'modal-overlay open';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'deleteYearModalTitle');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(30,15,5,0.7);z-index:100001;display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s;';
    modal.innerHTML = `
      <div class="modal-card" style="background:var(--modal-bg);color:var(--text-primary);border-radius:6px;padding:32px;max-width:480px;width:90%;box-shadow:0 24px 64px rgba(30,15,5,0.3);border:1px solid var(--card-border);">
        <h3 id="deleteYearModalTitle" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:22px;font-style:italic;margin-bottom:16px;color:var(--text-primary);">⚠️ Delete the ${year} shelf?</h3>
        <p style="margin-bottom:18px;color:var(--text-secondary);line-height:1.6;font-size:14px;">
          This permanently deletes your <strong>${year}</strong> shelf${count ? ` and all <strong>${count}</strong> book${count === 1 ? '' : 's'} on it` : ''}. This cannot be undone.
        </p>
        <p style="margin-bottom:12px;font-size:13px;color:var(--text-muted);font-family:\'DM Mono\',monospace;">
          Type <strong style="color:var(--dislike);">delete</strong> to confirm:
        </p>
        <input type="text" id="deleteYearConfirmInput" placeholder="Type delete" autocomplete="off" aria-label="Type delete to confirm deletion"
          style="width:100%;padding:12px;margin-bottom:20px;border:2px solid var(--input-border);border-radius:4px;font-family:\'DM Mono\',monospace;font-size:14px;background:var(--input-bg);color:var(--text-primary);transition:border-color 0.2s;">
        <div style="display:flex;gap:12px;justify-content:flex-end;">
          <button id="cancelDeleteYearBtn" class="btn-secondary">Cancel</button>
          <button onclick="App.executeDeleteYear()" class="btn-primary" style="background:var(--dislike);border-color:var(--dislike);" id="confirmDeleteYearBtn" disabled>Delete ${year}</button>
        </div>
      </div>`;

    document.body.appendChild(modal);
    const input = document.getElementById('deleteYearConfirmInput');
    const btn = document.getElementById('confirmDeleteYearBtn');
    const cancelBtn = document.getElementById('cancelDeleteYearBtn');

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        cleanupModal();
      }
    };

    const cleanupModal = () => {
      document.removeEventListener('keydown', handleKeyDown);
      modal.remove();
    };
    modal._cleanup = cleanupModal;

    document.addEventListener('keydown', handleKeyDown);

    if (cancelBtn) {
      cancelBtn.addEventListener('click', cleanupModal);
    }

    if (input) {
      input.focus();
      input.addEventListener('input', (e) => {
        const val = e.target.value.trim().toLowerCase();
        if (val === 'delete') {
          if (btn) btn.disabled = false;
          input.style.borderColor = 'var(--like)';
        } else {
          if (btn) btn.disabled = true;
          input.style.borderColor = 'var(--input-border)';
        }
      });
      input.addEventListener('keyup', (e) => {
        if (e.key === 'Enter' && e.target.value.trim().toLowerCase() === 'delete') {
          if (typeof app.executeDeleteYear === 'function') app.executeDeleteYear();
          else this.executeDeleteYear();
        }
      });
    }
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        cleanupModal();
      }
    });
  },

  async executeDeleteYear() {
    const app = (typeof window !== 'undefined' && window.App) ? window.App : this;
    if (app._isDeletingYear) return;

    const input = document.getElementById('deleteYearConfirmInput');
    const val = input ? input.value.trim().toLowerCase() : '';
    if (val !== 'delete') {
      if (input) {
        input.style.borderColor = 'var(--dislike)';
        input.style.animation = 'shake 0.3s';
        setTimeout(() => { input.style.animation = ''; }, 300);
      }
      return;
    }

    if (app.isReadOnly || !app.currentShelf) {
      const m = document.getElementById('deleteYearConfirmModal');
      if (m && typeof m._cleanup === 'function') m._cleanup();
      else m?.remove();
      return;
    }

    app._isDeletingYear = true;
    const modalBtn = document.getElementById('confirmDeleteYearBtn');
    if (modalBtn) { modalBtn.disabled = true; modalBtn.textContent = 'Deleting...'; }
    if (input) { input.disabled = true; }

    try {
      const shelfId = app.currentShelf.id;
      const delYear = app.currentYear;
      const delCount = (app.books || []).length;

      if (typeof DB !== 'undefined' && DB.trackEvent) {
        DB.trackEvent('delete_year', { year: delYear, books: delCount });
      }
      const ok = (typeof DB !== 'undefined' && DB.deleteShelfAndBooks) ? await DB.deleteShelfAndBooks(shelfId) : true;
      const m = document.getElementById('deleteYearConfirmModal');
      if (m && typeof m._cleanup === 'function') m._cleanup();
      else m?.remove();

      if (!ok) {
        if (typeof app.showToast === 'function') app.showToast('Could not delete the shelf. Please try again.');
        return;
      }

      app.userYears = (app.userYears || []).filter(y => String(y.year) !== String(delYear));
      app.currentShelf = null;
      app.books = [];

      const nextYear = app.userYears.length ? app.userYears[0].year : new Date().getFullYear();
      if (typeof app.showToast === 'function') app.showToast(`🗑️ Deleted the ${delYear} shelf.`);
      if (typeof app.setYear === 'function') await app.setYear(nextYear);
    } finally {
      app._isDeletingYear = false;
    }
  },

  // 4. Tab Router
  _setActiveTab(tab) {
    this._activeTab = tab;
    document.querySelectorAll('#bottomNav .bn-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  },

  switchTab(tab) {
    this._setActiveTab(tab);
    ['globalSearchModal', 'communityModal', 'profileHubModal'].forEach(id => this.closeModal(id));

    if (tab === 'home') {
      ['profileModal', 'themeModal', 'readingGoalsModal', 'quotesModal', 'noteModal'].forEach(id => this.closeModal(id));
      this.closeSlideMenu();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (tab === 'search') {
      if (typeof this.openGlobalSearch === 'function') this.openGlobalSearch();
    } else if (tab === 'social') {
      if (typeof this.openCommunity === 'function') this.openCommunity();
    } else if (tab === 'profile') {
      this.openProfileHub();
    } else if (tab === 'analytics') {
      if (typeof this.openAnalytics === 'function') this.openAnalytics();
    }
  },

  switchCommunityTab(tab) {
    this._commTab = tab;
    const tf = document.getElementById('commTabFeed');
    if (tf) tf.classList.toggle('active', tab === 'feed');
    const tn = document.getElementById('commTabNotes');
    if (tn) tn.classList.toggle('active', tab === 'notes');
    const dTab = document.getElementById('commTabDiscover');
    if (dTab) dTab.classList.toggle('active', tab === 'discover');

    const pf = document.getElementById('commFeedPane');
    if (pf) pf.style.display = tab === 'feed' ? 'flex' : 'none';
    const pn = document.getElementById('commNotesPane');
    if (pn) pn.style.display = tab === 'notes' ? 'flex' : 'none';
    const dPane = document.getElementById('commDiscoverPane');
    if (dPane) dPane.style.display = tab === 'discover' ? 'flex' : 'none';

    if (tab === 'feed' && typeof this.renderCommunityFeed === 'function') {
      this.renderCommunityFeed();
    }
    if (tab === 'notes') this.switchNotesTab(this._notesTab || 'inbox');
        if (tab === 'discover') {
      if (typeof this.renderDiscoverReaders === 'function') this.renderDiscoverReaders();
      
      const msg = document.getElementById('esGalaxyMsg');
      if (msg) msg.style.display = 'flex';
      
      const wrapper = document.getElementById('constWrapper');
      if (wrapper) {
          Array.from(wrapper.children).forEach(child => {
              if (child.id !== 'esGalaxyMsg' && child.id !== 'srNodeDetailPanel' && child.id !== 'detailPanel' && child.id !== 'resetViewBtn') {
                  child.style.display = 'none';
              }
          });
      }

      setTimeout(() => {
          if (typeof this.renderSimilarReaders === 'function') this.renderSimilarReaders(this.books);
      }, 1200);
    }

    const rTab = document.getElementById('commTabRadar');
    if (rTab) rTab.classList.toggle('active', tab === 'radar');
    const rPane = document.getElementById('commRadarPane');
    if (rPane) rPane.style.display = tab === 'radar' ? 'flex' : 'none';
    if (tab === 'radar' && typeof this._drawDNARadar === 'function') {
      setTimeout(() => this._drawDNARadar('goalRadarSvg', this.books || []), 50);
      if (typeof this._loadDNANetwork === 'function') this._loadDNANetwork();
    }

    const fyTab = document.getElementById('commTabForYou');
    if (fyTab) fyTab.classList.toggle('active', tab === 'forYou');
    const fyPane = document.getElementById('commForYouPane');
    if (fyPane) fyPane.style.display = tab === 'forYou' ? 'flex' : 'none';
    if (tab === 'forYou' && typeof this.renderForYouFeed === 'function') {
      this.renderForYouFeed();
    }

    const nTab = document.getElementById('commTabNetwork');
    if (nTab) nTab.classList.toggle('active', tab === 'network');
    const nPane = document.getElementById('commNetworkPane');
    if (nPane) nPane.style.display = tab === 'network' ? 'flex' : 'none';
    if (tab === 'network' && typeof this.renderNetwork === 'function') {
      this.renderNetwork();
    }

    const cTab = document.getElementById('commTabClubs');
    if (cTab) cTab.classList.toggle('active', tab === 'clubs');
    const cPane = document.getElementById('commClubsPane');
    if (cPane) cPane.style.display = tab === 'clubs' ? 'flex' : 'none';
    if (tab === 'clubs' && typeof this.renderClubs === 'function') {
      this.renderClubs();
    }
  },

  switchHubTab(tabId) {
    const tabs = ['details', 'progress', 'finish'];
    tabs.forEach(t => {
      const tabEl = document.getElementById('hubTab' + t.charAt(0).toUpperCase() + t.slice(1));
      const paneEl = document.getElementById('hubPane' + t.charAt(0).toUpperCase() + t.slice(1));
      if (tabEl) {
        if (t === tabId) tabEl.classList.add('active');
        else tabEl.classList.remove('active');
      }
      if (paneEl) {
        paneEl.style.display = t === tabId ? 'block' : 'none';
      }
    });
  },

  async switchNotesTab(tab) {
    this._notesTab = tab;
    const tIn = document.getElementById('notesTabInbox');
    if (tIn) tIn.classList.toggle('active', tab === 'inbox');
    const tSe = document.getElementById('notesTabSent');
    if (tSe) tSe.classList.toggle('active', tab === 'sent');

    const list = document.getElementById('notesList');
    if (!list) return;
    list.innerHTML = '<div class="notes-empty">Loading...</div>';

    try {
      if (tab === 'inbox') {
        const notes = await DB.getReceivedNotes(this.userId, false);
        if (typeof this._renderNotesList === 'function') this._renderNotesList(notes, 'inbox');
        const unread = (notes || []).filter(n => !n.read_at);
        for (const n of unread) { try { await DB.markNoteRead(n.id); } catch (e) {} }
        if (unread.length) this._refreshSocialBadge();
      } else {
        const notes = await DB.getSentNotes(this.userId);
        if (typeof this._renderNotesList === 'function') this._renderNotesList(notes, 'sent');
      }
    } catch (e) {
      list.innerHTML = '<div class="notes-empty">Could not load notes.</div>';
    }
  },

  async _refreshSocialBadge() {
    if (!this.userId || this.isDemoMode) return;
    try {
      const notes = await DB.getReceivedNotes(this.userId, true);
      const n = (notes || []).length;
      const badge = document.getElementById('bnSocialBadge');
      if (badge) { badge.textContent = n > 9 ? '9+' : String(n); badge.style.display = n > 0 ? 'flex' : 'none'; }
      const cb = document.getElementById('commNotesBadge');
      if (cb) { cb.textContent = n > 9 ? '9+' : String(n); cb.style.display = n > 0 ? 'inline-flex' : 'none'; }
      const mb = document.getElementById('menuNotesBadge');
      if (mb) { mb.textContent = n > 0 ? String(n) : ''; mb.style.display = n > 0 ? 'inline-block' : 'none'; }
    } catch (e) {}
  },

  _noteTriggerLabel(t) {
    return ({
      'to-read': 'when added to To-Read',
      'reading': 'when they start reading',
      'finished': 'when they finish',
      'recommend': 'right away as a recommendation'
    })[t] || 'when they finish';
  },

  async openSendNote(bookOrId, prefilledRecipientId = null) {
    if (!this.userId || this.isDemoMode) { this.showToast('Sign in to send notes to friends.'); return; }
    try { if (typeof closePanel === 'function') closePanel(); } catch (e) {}

    let book = null;
    if (typeof bookOrId === 'object' && bookOrId !== null) {
      book = bookOrId;
    } else {
      book = (this.books || []).find(b => String(b.id) === String(bookOrId) || b._dbId === bookOrId);
    }
    if (!book) return;
    this._noteBook = book;

    const msg = document.getElementById('noteValidationMsg'); if (msg) msg.textContent = '';
    const ta = document.getElementById('noteText'); if (ta) ta.value = '';
    const tc = document.getElementById('noteTextCount'); if (tc) tc.textContent = '0/500';
    const trg = document.getElementById('noteTrigger'); if (trg) trg.value = 'finished';

    const bp = document.getElementById('noteBookPreview');
    if (bp) {
      bp.innerHTML = `<div style="display:flex;gap:12px;align-items:center;padding:11px;background:rgba(139,38,53,0.04);border-radius:8px;"><img src="${book.cover || book.fallbackCover}" onerror="this.src='${book.fallbackCover}'" style="width:42px;height:62px;object-fit:cover;border-radius:3px;" alt=""><div><div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;font-weight:700;font-style:italic;line-height:1.2;">${this._esc(book.title)}</div><div style="font-size:11px;color:var(--text-muted,#999);">${this._esc(book.author)}</div></div></div>`;
    }

    const sel = document.getElementById('noteRecipient');
    const hint = document.getElementById('noteRecipientHint');
    if (sel) sel.innerHTML = '<option value="">Loading friends...</option>';

    this.openModal('noteModal');

    try {
      const following = await DB.getFollowing(this.userId);
      const followers = await DB.getFollowers(this.userId);
      const followerIds = followers.map(f => f.user_id);
      const profiles = await DB.getPublicProfiles(this.userId);
      const friends = (profiles || []).filter(p => following.includes(p.user_id) && followerIds.includes(p.user_id));

      if (sel) {
        if (!friends.length) {
          sel.innerHTML = '<option value="">No friends yet</option>';
          if (hint) hint.textContent = 'Only mutuals (readers you follow who follow you back) appear here. Follow more readers in the Community feed!';
        } else {
          sel.innerHTML = friends.map(f => `<option value="${f.user_id}" ${f.user_id === prefilledRecipientId ? 'selected' : ''}>${this._esc(f.display_name || 'A reader')}</option>`).join('');
          if (hint) hint.textContent = 'Only mutuals (readers who follow you back) can receive notes.';
        }
      }
    } catch (e) {
      if (sel) sel.innerHTML = '<option value="">Could not load friends</option>';
    }
  },

  async submitBookNote() {
    const book = this._noteBook;
    const msg = document.getElementById('noteValidationMsg');
    if (!book) return;

    const recipientId = document.getElementById('noteRecipient')?.value;
    const triggerStatus = document.getElementById('noteTrigger')?.value;
    const noteText = (document.getElementById('noteText')?.value || '').trim();

    if (!recipientId) { if (msg) msg.textContent = 'Pick a friend to send this note to.'; return; }
    if (!noteText) { if (msg) msg.textContent = 'Write a short note first.'; return; }

    const btn = document.getElementById('sendNoteBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }

    try {
      const saved = await DB.sendBookNote({
        senderId: this.userId,
        recipientId,
        bookId: (book._dbId || book.id),
        bookTitle: book.title,
        bookAuthor: book.author,
        bookCover: book.cover || book.coverUrl || '',
        noteText,
        triggerStatus
      });

      if (saved) {
        this.closeModal('noteModal');
        this.showToast('✉️ Note sent! They\'ll see it ' + this._noteTriggerLabel(triggerStatus) + '.');
        if (typeof this._earnAchievement === 'function') this._earnAchievement('soc_penPal');
        if (typeof this._earnAchievement === 'function') this._earnAchievement('soc_airplane');
        if (typeof this._sendPushNotif === 'function') {
          this._sendPushNotif(recipientId, 'notes', '📖 Note to Shelf', (this.displayName || 'A reader') + ' sent you a book note about ' + book.title);
        }
      } else {
        if (msg) msg.textContent = 'Could not send. Please try again.';
      }
    } catch (e) {
      if (msg) msg.textContent = 'Could not send. Please try again.';
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Send Note'; }
    }
  },

  // 5. Profile & Settings
  async loadOwnProfile() {
    if (!this.userId) return;
    const fallback = deriveDisplayNameFromEmail(this.userEmail || 'reader@example.com');
    let profile = null;
    try {
      profile = await this._withTimeout(DB.getUserProfile(this.userId), 5000, 'getUserProfile');
    } catch(e) {
      console.warn('[loadOwnProfile] getUserProfile timed out or failed:', e);
    }

    if (!profile || !profile.display_name) {
      try {
        profile = await this._withTimeout(DB.upsertUserProfile(this.userId, this.userEmail, fallback), 5000, 'upsertUserProfile');
      } catch(e) {
        console.warn('[loadOwnProfile] upsertUserProfile timed out or failed:', e);
      }
    }

    this.displayName = normalizeDisplayName(profile?.display_name || fallback, this.userEmail);
    this.ownerDisplayName = this.displayName;
    this.ownProfile = profile || null;
    this.profilePublic = true;

    this.updateBrandTitle();
    if (profile && profile.avatar_emoji) { this._avatarEmoji = profile.avatar_emoji; }
    this._applyMenuAvatar();

    try { this.readingGoals = await this._withTimeout(DB.getReadingGoals(this.userId), 4000, 'getReadingGoals') || {}; } catch (e) { this.readingGoals = {}; }
    try { this.following = await this._withTimeout(DB.getFollowing(this.userId), 4000, 'getFollowing') || []; } catch (e) { this.following = []; }
    try {
      if (typeof this.initCommunityBell === 'function') await this._withTimeout(this.initCommunityBell(), 4000, 'initCommunityBell');
    } catch (e) { console.warn('[init] community bell:', e); }
  },

  openProfileSettings() {
    if (this.isReadOnly) return;
    this.closeSlideMenu();

    const input = document.getElementById('displayNameInput');
    if (input) input.value = this.displayName || deriveDisplayNameFromEmail(this.userEmail) || 'Reader';

    const yr = this.currentYear;
    const goalYearEl = document.getElementById('readingGoalYear');
    if (goalYearEl) goalYearEl.textContent = yr;

    const goalInput = document.getElementById('readingGoalInput');
    if (goalInput) goalInput.value = (this.readingGoals && this.readingGoals[yr]) ? this.readingGoals[yr] : '';

    const pubToggle = document.getElementById('profilePublicToggle');
    if (pubToggle) pubToggle.checked = (this.profilePublic !== false);

    const spineToggle = document.getElementById('profileSpineArtToggle');
    if (spineToggle) {
      spineToggle.checked = (typeof localStorage !== 'undefined') ? (localStorage.getItem('shelf_spine_art') === 'true') : false;
    }

    const bioInput = document.getElementById('profileBioInput');
    if (bioInput) bioInput.value = (this.ownProfile && this.ownProfile.bio) ? this.ownProfile.bio : '';

    const avatarEl = document.getElementById('profileModalAvatar');
    if (avatarEl) {
      avatarEl.textContent = this._avatarEmoji || '📚';
      if (typeof this._avatarBg === 'function') avatarEl.style.background = this._avatarBg(this._avatarEmoji || '📚');
    }

    const modal = document.getElementById('profileModal');
    if (modal) modal.classList.add('open');
  },

  async saveProfileSettings() {
    if (this.isReadOnly) return;

    const input = document.getElementById('displayNameInput');
    const nextName = normalizeDisplayName(input?.value || '', this.userEmail) || 'Reader';

    if (this.userId && !this.isDemoMode) {
      try {
        const updated = await DB.updateDisplayName(this.userId, this.userEmail, nextName)
          || await DB.upsertUserProfile(this.userId, this.userEmail, nextName);
        this.displayName = normalizeDisplayName(updated?.display_name || nextName, this.userEmail);
      } catch (e) {
        this.displayName = nextName;
      }
    } else {
      this.displayName = nextName;
    }
    this.ownerDisplayName = this.displayName;

    this.updateBrandTitle();
    this._applyMenuAvatar();

    const goalInput = document.getElementById('readingGoalInput');
    if (goalInput) {
      const yr = this.currentYear;
      const target = parseInt(goalInput.value, 10);
      if (!this.readingGoals) this.readingGoals = {};
      if (!isNaN(target) && target > 0) this.readingGoals[yr] = target;
      else delete this.readingGoals[yr];
      if (this.userId && !this.isDemoMode) {
        try {
          await DB.setReadingGoal(this.userId, yr, (!isNaN(target) && target > 0) ? target : 0);
        } catch (e) {}
      }
    }

    const pubToggle = document.getElementById('profilePublicToggle');
    if (pubToggle) {
      const nextPublic = !!pubToggle.checked;
      if (nextPublic !== this.profilePublic) {
        if (this.userId && !this.isDemoMode) {
          try {
            const res = await DB.updateProfilePublic(this.userId, nextPublic);
            if (res) {
              this.profilePublic = (res.profile_public === false) ? false : true;
              this.ownProfile = res;
            } else {
              this.profilePublic = nextPublic;
            }
          } catch (e) {
            this.profilePublic = nextPublic;
          }
        } else {
          this.profilePublic = nextPublic;
          if (!this.ownProfile) this.ownProfile = {};
          this.ownProfile.profile_public = nextPublic;
        }
      }
    }

    const bioInput = document.getElementById('profileBioInput');
    if (bioInput) {
      const nextBio = (bioInput.value || '').trim().slice(0, 240);
      if (this.userId && !this.isDemoMode) {
        try {
          const ok = await DB.updateBio(this.userId, nextBio);
          if (ok && this.ownProfile) this.ownProfile.bio = nextBio;
          else if (this.ownProfile) this.ownProfile.bio = nextBio;
        } catch (e) {
          if (this.ownProfile) this.ownProfile.bio = nextBio;
        }
      } else {
        if (!this.ownProfile) this.ownProfile = {};
        this.ownProfile.bio = nextBio;
      }
    }

    this.updateBrandTitle();
    this._applyMenuAvatar();
    this.closeModal('profileModal');
    if (typeof this.render === 'function') this.render();
    this.showToast('Profile updated.');
  },

  openAvatarPicker() {
    this.closeSlideMenu();
    let picker = document.getElementById("avatarPicker");
    if (picker) picker.remove();

    picker = document.createElement("div");
    picker.id = "avatarPicker";
    picker.style.cssText = "position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; background: rgba(0,0,0,0.5) !important; z-index: 20000 !important; display: flex !important; align-items: center !important; justify-content: center !important;";
    picker.onclick = (e) => {
      if (e.target === picker) this.closeAvatarPicker();
    };

    const card = document.createElement("div");
    card.className = "avatar-picker-card";
    card.style.cssText = "background: #faf5ee !important; border-radius: 16px !important; padding: 24px !important; max-width: 440px !important; width: 90% !important; box-shadow: 0 20px 60px rgba(30,15,5,0.3) !important; text-align: center !important; position: relative !important; z-index: 20000 !important; display: block !important;";

    const title = document.createElement("div");
    title.style.cssText = "font-weight: bold !important; margin-bottom: 16px !important; color: var(--wood-dark) !important; font-size: 20px !important; display: block !important;";
    title.innerText = "Choose an Avatar";

    const grid = document.createElement("div");
    grid.id = "avatarGrid";
    grid.style.cssText = "display: grid !important; grid-template-columns: repeat(auto-fill, minmax(38px, 1fr)) !important; gap: 10px !important; margin-bottom: 24px !important; max-height: 85vh !important; overflow-y: auto !important; padding: 4px !important;";

    grid.innerHTML = this._AVATAR_EMOJIS.map(e =>
      `<div class="avatar-option${e === this._avatarEmoji ? ' selected' : ''}" data-emoji="${e}" style="background:${this._avatarBg(e)};"><span class="avatar-option-glyph" style="font-size: 20px !important;">${e}</span></div>`
    ).join("");

    const btnRow = document.createElement("div");
    btnRow.style.cssText = "display: flex !important; gap: 12px !important;";

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "btn-secondary";
    cancelBtn.style.cssText = "flex: 1 !important; padding: 12px !important; font-weight: bold !important; border-radius: 8px !important; border: none !important; cursor: pointer !important;";
    cancelBtn.innerText = "Cancel";
    cancelBtn.onclick = () => this.closeAvatarPicker();

    const saveBtn = document.createElement("button");
    saveBtn.className = "btn-primary";
    saveBtn.style.cssText = "flex: 1 !important; padding: 12px !important; font-weight: bold !important; border-radius: 8px !important; border: none !important; cursor: pointer !important;";
    saveBtn.innerText = "Save";
    saveBtn.onclick = () => this.saveAvatar();

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(saveBtn);
    card.appendChild(title);
    card.appendChild(grid);
    card.appendChild(btnRow);
    picker.appendChild(card);

    document.body.appendChild(picker);

    grid.addEventListener("click", (e) => {
      const option = e.target.closest(".avatar-option");
      if (option) {
        e.preventDefault();
        e.stopPropagation();
        this._selectAvatarEmoji(option);
      }
    });

    this._pendingAvatar = this._avatarEmoji;
  },

  closeAvatarPicker() {
    const picker = document.getElementById('avatarPicker');
    if (picker) picker.remove();
    this._pendingAvatar = null;
  },

  _selectAvatarEmoji(el) {
    document.querySelectorAll('.avatar-option').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected');
    this._pendingAvatar = el.dataset.emoji;
  },

  async saveAvatar() {
    if (!this._pendingAvatar) return;
    this._avatarEmoji = this._pendingAvatar;
    this._applyMenuAvatar();

    localStorage.setItem('shelf_life_avatar', this._avatarEmoji);

    if (this.userId && !this.isDemoMode && typeof _supabase !== 'undefined' && _supabase) {
      try {
        await _supabase.from('user_profiles').update({ avatar_emoji: this._avatarEmoji }).eq('user_id', this.userId);
      } catch (e) {}
    }

    this.closeAvatarPicker();
    this.showToast(`Avatar updated to ${this._avatarEmoji}`);
  },

  async submitMissingUsername() {
    const input = document.getElementById('missingUsernameInput');
    const errEl = document.getElementById('missingUsernameError');
    if (!input || !errEl || !this.userId) return;

    let username = input.value.trim().toLowerCase();
    if (!username) {
      errEl.innerText = 'Username cannot be empty.';
      return;
    }
    if (username.length < 3 || username.length > 20) {
      errEl.innerText = 'Username must be between 3 and 20 characters.';
      return;
    }
    if (!/^[a-z0-9_]+$/.test(username)) {
      errEl.innerText = 'Only letters, numbers, and underscores allowed.';
      return;
    }

    errEl.innerText = 'Saving...';

    try {
      const data = await DB.updateUsername(this.userId, username);
      if (!data || data.length === 0) {
        errEl.innerText = 'Username is already taken. Please try another.';
      } else {
        this.username = username;
        if (this.ownProfile) this.ownProfile.username = username;
        errEl.innerText = '';
        const modal = document.getElementById('usernamePromptModal');
        if (modal) modal.style.display = 'none';
        this.showToast('Username saved successfully!');
      }
    } catch (e) {
      console.error(e);
      errEl.innerText = 'An error occurred. Please try again.';
    }
  },

  _generateRadarSvg(baseBooks, overlayBooks, size = 100, showOutline = true) {
    const traits = {
      'Romance': { genres: ['Romance', 'Contemporary'] },
      'Fast Pace': { genres: ['Thriller', 'Action', 'Adventure', 'Mystery', 'Suspense'] },
      'Dark Vibe': { genres: ['Horror', 'Crime', 'Dark Fantasy', 'Gothic'] },
      'Epic Length': { genres: ['Fantasy', 'Science Fiction', 'Historical Fiction', 'Classics', 'Sci-Fi'] },
      'Non-Fiction': { genres: ['Non-Fiction', 'Biography', 'Memoir', 'History', 'Science'] }
    };

    const getPolyPoints = (values) => {
      const gCenterX = 50, gCenterY = 50, gMaxRad = 40;
      const gAngles = values.map((_, i) => (Math.PI * 2 * i) / values.length - Math.PI / 2);
      return values.map((val, i) => {
        const x = gCenterX + (gMaxRad * val) * Math.cos(gAngles[i]);
        const y = gCenterY + (gMaxRad * val) * Math.sin(gAngles[i]);
        return `${x},${y}`;
      }).join(" ");
    };

    const computeShape = (books) => {
      if (!books || !books.length) return [0.6, 0.4, 0.8, 0.5, 0.7];
      let shapeScores = [0, 0, 0, 0, 0];
      books.forEach(b => {
        const g = b.genre || '';
        let idx = 0;
        for (const data of Object.values(traits)) {
          if (data.genres.includes(g)) { shapeScores[idx]++; break; }
          idx++;
        }
      });
      let maxShape = Math.max(...shapeScores);
      return maxShape === 0 ? [0.6, 0.4, 0.8, 0.5, 0.7] : shapeScores.map(s => Math.max(0.1, s / maxShape));
    };

    const baseShape = computeShape(baseBooks);
    const basePoints = getPolyPoints(baseShape);
    const fullPoints = getPolyPoints([1, 1, 1, 1, 1]);

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
          html += `<text x="${x}" y="${y + 3}" font-family="'DM Mono', monospace" font-size="7" fill="var(--wood-light)" text-anchor="${anchor}">${lbl.toUpperCase()}</text>`;
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

  async openProfileView(userId) {
    if (!userId) return;
    this.openModal('profileViewModal');
    const body = document.getElementById('profileViewBody');
    if (body) body.innerHTML = '<div style="padding:30px 4px;text-align:center;color:var(--wood-light);font-size:12.5px;">Loading profile...</div>';

    try {
      const [profile, books] = await Promise.all([
        DB.getUserProfile(userId).catch(() => null),
        DB.getPublicUserBooks(userId).catch(() => [])
      ]);

      if (!profile) {
        if (body) body.innerHTML = '<div style="padding:30px 4px;text-align:center;color:var(--wood-light);font-size:12.5px;">This reader\'s profile is private.</div>';
        return;
      }

      let avatar = '📚';
      try {
        const all = await DB.getPublicProfiles(this.userId);
        const m = (all || []).find(p => p.user_id === userId);
        if (m) {
          avatar = (typeof this._getUserAvatar === 'function' ? this._getUserAvatar(m) : (m.avatar_url || m.avatar || m.avatar_emoji || '📚'));
        }
      } catch (e) { console.warn(e); }

      const finished = (books || []).filter(b => !b.currently_reading && b.status !== 'to-read');
      const name = normalizeDisplayName(profile.display_name || 'A reader', null);
      const genreCounts = {};
      finished.forEach(b => { const g = b.genre || 'General Fiction'; genreCounts[g] = (genreCounts[g] || 0) + 1; });
      const topGenres = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
      const maxG = topGenres.length ? topGenres[0][1] : 1;
      const totalWords = finished.reduce((s, b) => s + (b.words || 0), 0);
      const loved = finished.filter(b => b.sentiment === 'love').length;
      const bg = this._avatarBg(avatar);
      const isMe = userId === this.userId;
      const following = this.isFollowing(userId);
      const titleCase = s => String(s).replace(/\b\w/g, c => c.toUpperCase());
      const wordsM = totalWords >= 1000000 ? (totalWords / 1000000).toFixed(1) + 'M' : totalWords >= 1000 ? Math.round(totalWords / 1000) + 'k' : String(totalWords);

      const TOP_READER_MIN_BOOKS = 25;
      const isTopReader = finished.length >= TOP_READER_MIN_BOOKS;
      const topReaderBadge = isTopReader
        ? `<span class="pv-top-reader" title="Top Reader - ${TOP_READER_MIN_BOOKS}+ books finished">★ Top Reader</span>`
        : '';

      const genreBars = topGenres.length ? topGenres.map(([g, c]) => `<div class="pv-genre-bar"><div style="width:110px;flex-shrink:0;font-size:11.5px;color:var(--wood-dark);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${this._escapeHtml(titleCase(g))}</div><div class="pv-genre-track"><div class="pv-genre-fill" style="width:${Math.max(6, Math.round(c / maxG * 100))}%;"></div></div><div style="width:28px;text-align:right;font-family:\'DM Mono\',monospace;font-size:10px;color:var(--wood-light);">${c}</div></div>`).join('') : '<div style="font-size:12px;color:var(--wood-light);">No finished books shared yet.</div>';

      const followBtn = isMe ? '' : `<button class="feed-follow-btn${following ? ' following' : ''}" id="pvFollowBtn" data-uid="${userId}" onclick="App.toggleFollow('${userId}', this)" style="padding:7px 18px;font-size:11px;">${following ? '✓ Following' : '+ Follow'}</button>`;
      const bookshelfBtn = isMe ? '' : `<button class="btn-primary" style="padding:6px 10px; font-size:10.5px;" onclick="App.closeModal('profileViewModal'); App._viewPublicShelf('${userId}')">Bookshelf ↗</button>`;
      const treeBtn = isMe ? '' : `<button class="btn-secondary" style="padding:6px 10px; font-size:10.5px; background:rgba(40,22,12,0.06); border:1px solid rgba(40,22,12,0.18); color:var(--wood-bark-dark); font-weight:600;" onclick="App.openUserReadingTree('${userId}', '${this._escapeHtml(name)}')">🌳 Tree</button>`;
      const radarSvg = isMe ? '' : this._generateRadarSvg(books, this.books || [], 180, true);
      const radarHtml = isMe ? '' : `
        <div style="display:flex; flex-direction:column; align-items:center; background:rgba(61,43,31,0.02); border-radius:12px; padding:16px 20px; margin-bottom:14px;">
          <div style="font-size:10px;font-family:\'DM Mono\',monospace;letter-spacing:0.16em;text-transform:uppercase;color:var(--wood-light);margin-bottom:8px; align-self:flex-start; width:100%; border-bottom: 1px solid rgba(61,43,31,0.05); padding-bottom: 8px;">DNA Match Overlay</div>
          <div style="display:flex; justify-content:space-between; align-items:center; width: 100%; margin-top:10px; gap:10px;">
            <div style="flex:1; display:flex; justify-content:center;">${radarSvg}</div>
            <div style="display:flex; flex-direction:column; gap:12px; font-size:12px; font-weight:500; color:var(--wood-dark); padding: 12px; background: rgba(255,255,255,0.5); border-radius: 8px; box-shadow: 0 1px 4px rgba(0,0,0,0.05);">
              <div style="display:flex; align-items:center; gap:8px;">
                <div style="width:14px;height:14px;background:rgba(212,175,55,0.4);border:2px solid var(--gold, #d4af37);border-radius:3px;"></div>
                You
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                <div style="width:14px;height:14px;background:rgba(139,38,53,0.15);border:2px solid var(--burgundy, #8b2635);border-radius:3px;"></div>
                ${this._escapeHtml(name)}
              </div>
            </div>
          </div>
        </div>`;

      const avatarHtml = (avatar && (avatar.includes('http') || avatar.includes('data:image')))
        ? `<img src="${this._escapeHtml(avatar)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
        : this._escapeHtml(avatar || '📚');

      if (body) {
        body.innerHTML = `
          <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px;">
            <div style="width:56px;height:56px;flex-shrink:0;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;font-size:28px;box-shadow:0 3px 8px rgba(61,43,31,0.2);overflow:hidden;">${avatarHtml}</div>
            <div style="flex:1;min-width:0;">
              <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:20px;font-weight:700;color:var(--wood-dark);display:flex;align-items:center;gap:8px;flex-wrap:wrap;">${this._escapeHtml(name)}${topReaderBadge}</div>
              <div style="font-size:11px;color:var(--wood-light);font-family:\'DM Mono\',monospace;letter-spacing:0.04em;">${isTopReader ? 'Top Reader · ' : ''}Shelf Care reader</div>
            </div>
            <div style="display:flex; flex-direction:column; gap:6px; align-items:flex-end;">
              ${followBtn}
              <div style="display:flex; gap:6px;">
                ${bookshelfBtn}
                ${treeBtn}
              </div>
            </div>
          </div>
          <div style="display:flex;gap:18px;padding:12px 0;border-top:1px solid rgba(61,43,31,0.08);border-bottom:1px solid rgba(61,43,31,0.08);margin-bottom:14px;">
            <div><div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:22px;font-weight:700;color:var(--wood-dark);line-height:1;">${finished.length}</div><div style="font-size:9px;font-family:\'DM Mono\',monospace;letter-spacing:0.14em;text-transform:uppercase;color:var(--wood-light);margin-top:3px;">books</div></div>
            <div><div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:22px;font-weight:700;color:var(--wood-dark);line-height:1;">${wordsM}</div><div style="font-size:9px;font-family:\'DM Mono\',monospace;letter-spacing:0.14em;text-transform:uppercase;color:var(--wood-light);margin-top:3px;">words</div></div>
            <div><div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:22px;font-weight:700;color:var(--love);line-height:1;">${loved}</div><div style="font-size:9px;font-family:\'DM Mono\',monospace;letter-spacing:0.14em;text-transform:uppercase;color:var(--wood-light);margin-top:3px;">loved</div></div>
          </div>
          ${radarHtml}
          <div style="font-size:10px;font-family:\'DM Mono\',monospace;letter-spacing:0.16em;text-transform:uppercase;color:var(--wood-light);margin-bottom:8px;">Top Genres</div>
          ${genreBars}
          <div id="pvTrophyStrip"></div>
          <div style="text-align:center;margin-top:18px;padding-top:14px;border-top:1px solid rgba(61,43,31,0.08);"><button onclick="App.closeModal('profileViewModal');" style="background:none;border:none;cursor:pointer;font-size:12.5px;color:var(--wood-light);text-decoration:none;padding:8px 18px;border-radius:6px;background:rgba(61,43,31,0.08);font-family:inherit;">Close</button></div>`;
      }

      if (typeof this._injectProfileAchievements === 'function') this._injectProfileAchievements(userId, 'pvTrophyStrip');
    } catch (e) {
      console.warn('[profileView] failed:', e);
      if (body) body.innerHTML = '<div style="padding:30px 4px;text-align:center;color:var(--wood-light);font-size:12.5px;">Could not load this profile.</div>';
    }
  },

  async openProfileHub() {
    const body = document.getElementById('profileHubBody');
    if (!body) return;
    body.innerHTML = '<div style="padding:30px 4px;text-align:center;color:var(--wood-light);font-size:12.5px;">Loading your profile...</div>';
    this.openModal('profileHubModal');

    const yearBooks = (this.books || []).filter(b => !b.currentlyReading && b.status !== 'to-read');
    let allFinished = yearBooks;
    let followers = [];

    if (this.userId) {
      try {
        const [rows, fw] = await Promise.all([
          DB.getAllUserBooks(this.userId).catch(() => null),
          DB.getFollowers(this.userId).catch(() => [])
        ]);
        if (rows && rows.length) {
          allFinished = rows.map(r => {
            const bk = dbToBook(r);
            if (r._shelfYear) {
              bk._shelfYear = Number(r._shelfYear);
              if (!bk.readYear) bk.readYear = Number(r._shelfYear);
            }
            return bk;
          }).filter(b => !b.currentlyReading && b.status !== 'to-read');
        }
        followers = fw || [];
      } catch (e) { console.warn(e); }
    }

    this._profileHubData = { allFinished, followers };
    if (typeof this._loadNotifPrefs === 'function') await this._loadNotifPrefs();
    this._renderProfileHub();
  },

  openProfile() {
    return this.openProfileHub();
  },

  openReadingTree(year) {
    const yr = year || this.currentShelf?.year || this.currentYear || new Date().getFullYear();
    this.closeModal('profileHubModal');
    const frame = document.getElementById('fullReadingTreeFrame');
    if (frame) {
      frame.src = `reading_tree.html?year=${yr}`;
    }
    this.openModal('readingTreeModal');
    setTimeout(() => {
      this.notifyReadingTreeUpdated(yr);
    }, 120);
  },

  async openUserReadingTree(userId, userName) {
    if (!userId) return;
    try {
      this.closeModal('profileViewModal');
      const shelf = await DB.getPublicShelfByUser(userId);
      if (shelf && shelf.id) {
        await this.loadPublicShelf(shelf.id);
        this.openReadingTree(shelf.year);
      } else {
        this.showToast(`${userName || 'This reader'} has no public shelves yet.`);
      }
    } catch (e) {
      console.warn('[openUserReadingTree] failed:', e);
      this.showToast('Could not load this reader\'s tree.');
    }
  },

  shareReadingTree() {
    const shelfId = this.currentShelf?.id;
    const base = window.location.origin + window.location.pathname;
    const url = shelfId ? `${base}#tree/${shelfId}` : `${base}#tree/demo`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        this.showToast('🌳 Reading Tree share link copied to clipboard!');
      }).catch(() => {
        prompt('Copy your Reading Tree link:', url);
      });
    } else {
      prompt('Copy your Reading Tree link:', url);
    }
  },

  getReadingTreeData(targetYear) {
    const defaultYear = Number(this.currentShelf?.year || this.currentYear || new Date().getFullYear());
    const yr = targetYear ? (targetYear === 'all' ? 'all' : Number(targetYear) || defaultYear) : defaultYear;

    let candidateBooks = [];
    if (this.isDemoMode || !this.userId) {
      candidateBooks = (this.books || []).concat(this.aggregateBooks || []);
    } else {
      const shelfBooks = Array.isArray(this.books) ? this.books : [];
      const hubBooks = (this._profileHubData && Array.isArray(this._profileHubData.allFinished)) ? this._profileHubData.allFinished : [];
      const agg = Array.isArray(this.aggregateBooks) ? this.aggregateBooks : [];
      candidateBooks = shelfBooks.concat(hubBooks).concat(agg);
    }

    const currentActiveShelfYear = defaultYear;

    const resolveBookYear = (b) => {
      if (!b) return currentActiveShelfYear;
      // 1. Explicit readYear
      if (b.readYear != null && !isNaN(Number(b.readYear)) && Number(b.readYear) >= 1900 && Number(b.readYear) <= 2100) {
        return Number(b.readYear);
      }
      // 2. Explicit _shelfYear
      if (b._shelfYear != null && !isNaN(Number(b._shelfYear)) && Number(b._shelfYear) >= 1900 && Number(b._shelfYear) <= 2100) {
        return Number(b._shelfYear);
      }
      // 3. Date finished parsing (e.g. '2026-03-14' or 'March 14, 2026')
      const dateStr = b.dateFinished || b.date_finished || b.date_read || b.dateStarted;
      if (dateStr) {
        const m = String(dateStr).match(/\b(19\d\d|20\d\d)\b/);
        if (m) {
          const parsed = parseInt(m[1], 10);
          if (parsed >= 1900 && parsed <= 2100) return parsed;
        }
      }
      // 4. If shelfId matches current active shelf
      if (b.shelfId && this.currentShelf && b.shelfId === this.currentShelf.id) {
        return currentActiveShelfYear;
      }
      // 5. If shelfId matches any user shelf in userYears
      if (b.shelfId && Array.isArray(this.userYears)) {
        const matched = this.userYears.find(uy => uy.shelf_id === b.shelfId || uy.id === b.shelfId);
        if (matched && matched.year) return Number(matched.year);
      }
      // 6. If book is present on active shelf (this.books)
      if (this.books && (this.books.includes(b) || this.books.some(tb => (tb.id && tb.id === b.id) || (tb.title === b.title && tb.author === b.author)))) {
        return currentActiveShelfYear;
      }
      // 7. If book was imported/guest and has b.year as shelf year
      if (b.year && Number(b.year) >= 1900 && Number(b.year) <= 2100 && (this.isDemoMode || !b.pub_year)) {
        return Number(b.year);
      }
      return currentActiveShelfYear;
    };

    // Deduplicate by ID or title+author
    const seen = new Set();
    const unique = [];
    for (const b of candidateBooks) {
      if (!b) continue;
      const key = b.id || `${b.title}___${b.author}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(b);
      }
    }

    // Filter strictly to finished books (exclude to-read, currentlyReading, dnf)
    const finished = unique.filter(b => {
      if (b.currentlyReading) return false;
      if (b.status === 'to-read' || b.status === 'reading' || b.dnf) return false;
      return true;
    });

    // Compute all available years that actually have finished books
    const yearCounts = {};
    finished.forEach(b => {
      const by = resolveBookYear(b);
      if (by && by >= 1900 && by <= 2100) {
        yearCounts[by] = (yearCounts[by] || 0) + 1;
      }
    });
    if (Array.isArray(this.userYears)) {
      this.userYears.forEach(uy => {
        if (uy.year && Number(uy.year) >= 1900) {
          if (!yearCounts[Number(uy.year)]) yearCounts[Number(uy.year)] = 0;
        }
      });
    }
    const availableYears = Object.keys(yearCounts).map(Number).sort((a, b) => b - a);

    // Filter by year if specific year requested
    let filtered = finished;
    if (yr !== 'all') {
      const targetNum = Number(yr);
      filtered = finished.filter(b => resolveBookYear(b) === targetNum);
    }

    const ALL_MONTHS = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const normalized = filtered.map((b, idx) => {
      let month = 0;
      let day = 15;
      const dateStr = b.dateFinished || b.date_finished || b.date_read || b.dateStarted;
      if (dateStr) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          month = d.getMonth();
          day = d.getDate();
        }
      } else if (b.month) {
        const mIdx = ALL_MONTHS.indexOf(b.month);
        if (mIdx >= 0) month = mIdx;
        day = 3 + ((idx * 7) % 25);
      } else {
        day = 3 + ((idx * 7) % 25);
      }

      let sentiment = 'liked';
      const s = String(b.sentiment || '').toLowerCase();
      if (s === 'love' || s === 'loved' || Number(b.rating) >= 5) sentiment = 'loved';
      else if (s === 'dislike' || s === 'disliked' || (b.rating && Number(b.rating) <= 2)) sentiment = 'disliked';
      else if (s === 'mixed' || s === 'okay' || Number(b.rating) === 3) sentiment = 'mixed';
      else sentiment = 'liked';

      const isFiction = b.fiction !== false && b.category !== 'Non-Fiction';
      const category = isFiction ? 'Fiction' : 'Non-Fiction';
      const genre = b.genre || (isFiction ? 'General Fiction' : 'Non-Fiction');
      const subgenre = b.subgenre || (Array.isArray(b.moods) && b.moods.length ? b.moods.join(' ') : '') || genre;
      const words = Number(b.words) || (Number(b.pageCount || b.pages || 300) * 300);
      const isBoty = !!(b.bookOfYear && (yr === 'all' || Number(b.bookOfYear) === Number(yr) || b.bookOfYear === true)) || !!b.isBookOfTheYear;

      return {
        id: String(b.id || b._dbId || `tree_book_${idx}`),
        title: b.title || 'Untitled',
        author: b.author || 'Unknown',
        genre: genre,
        subgenre: subgenre,
        category: category,
        fiction: isFiction,
        words: Math.max(1000, words),
        days: Number(b.days) || 5,
        sentiment: sentiment,
        month: Math.max(0, Math.min(11, month)),
        day: Math.max(1, Math.min(31, day)),
        birthProgress: month + (day / 31),
        bookOfTheYear: isBoty,
        favorite: isBoty || sentiment === 'loved',
        cover: b.cover || b.coverUrl || '',
        pageCount: b.pageCount || 0,
        moods: b.moods || [],
        review: b.review || ''
      };
    });

    normalized.sort((a, b) => a.birthProgress - b.birthProgress);

    return {
      year: yr,
      books: normalized,
      totalCount: normalized.length,
      availableYears: availableYears,
      yearCounts: yearCounts,
      isDemo: !!(this.isDemoMode || !this.userId)
    };
  },

  notifyReadingTreeUpdated(targetYear) {
    const yr = targetYear || this.currentShelf?.year || this.currentYear || new Date().getFullYear();
    const data = this.getReadingTreeData(yr);
    const frame = document.getElementById('fullReadingTreeFrame');
    if (frame && frame.contentWindow) {
      if (typeof frame.contentWindow.setTreeData === 'function') {
        frame.contentWindow.setTreeData(data);
      } else {
        frame.contentWindow.postMessage({ type: 'TREE_DATA', data }, '*');
      }
    }
    const miniFrame = document.getElementById('profileMiniTreeFrame');
    if (miniFrame && miniFrame.contentWindow) {
      if (typeof miniFrame.contentWindow.setTreeData === 'function') {
        miniFrame.contentWindow.setTreeData(data);
      } else {
        miniFrame.contentWindow.postMessage({ type: 'TREE_DATA', data }, '*');
      }
    }
  },

  _renderProfileHub() {
    const body = document.getElementById('profileHubBody');
    if (!body) return;

    const { allFinished, followers } = this._profileHubData || { allFinished: [], followers: [] };
    const avatar = this._avatarEmoji || '📚';
    const bg = this._avatarBg(avatar);
    const name = this.displayName || this.ownerDisplayName || 'Reader';
    const bio = (this.ownProfile && this.ownProfile.bio) ? this.ownProfile.bio : '';
    const total = allFinished.length;

    const sMap = { love: 5, like: 4, mixed: 3, dislike: 2 };
    const rated = allFinished.map(b => sMap[b.sentiment]).filter(v => v != null);
    const avgRating = rated.length ? (rated.reduce((s, v) => s + v, 0) / rated.length).toFixed(1) : ' - ';

    const genreCounts = {};
    allFinished.forEach(b => { const g = b.genre || 'General Fiction'; genreCounts[g] = (genreCounts[g] || 0) + 1; });
    const topGenre = Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0];
    const favGenre = topGenre ? topGenre[0] : ' - ';

    const yearFinished = (this.books || []).filter(b => !b.currentlyReading && b.status !== 'to-read');
    const monthsWith = new Set(yearFinished.map(b => ALL_MONTHS.indexOf(b.month)).filter(i => i >= 0));
    let streak = 0;
    if (monthsWith.size) {
      const latest = Math.max(...monthsWith);
      for (let i = latest; i >= 0; i--) {
        if (monthsWith.has(i)) streak++;
        else break;
      }
    }

    const boy = (this.books || []).find(b => b.bookOfYear && Number(b.bookOfYear) === Number(this.currentYear));
    const followingCount = Array.isArray(this.following) ? this.following.length : 0;
    const followersCount = (followers || []).length;
    const titleCase = s => String(s).replace(/\b\w/g, c => c.toUpperCase());

    body.innerHTML = `
      <!-- Spacious Header: Avatar, Name, Bio, Followers & Edit -->
      <div class="ph-head" style="display:flex;align-items:center;gap:12px;margin-bottom:12px;padding-right:32px;">
        <div class="ph-avatar" style="background:${bg};width:44px;height:44px;font-size:24px;flex-shrink:0;">${this._escapeHtml(avatar)}</div>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:baseline;gap:8px;">
            <div class="ph-name" style="font-size:17px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${this._escapeHtml(name)}</div>
            <div style="font-size:11px;color:var(--text-muted);cursor:pointer;" onclick="App.openFollowList('following')">
              <strong>${followingCount}</strong> following · <strong>${followersCount}</strong> followers
            </div>
          </div>
          <div class="ph-bio${bio ? '' : ' empty'}" style="font-size:11.5px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${bio ? this._escapeHtml(bio) : 'Add a line about your reading taste...'}</div>
        </div>
        <button class="ph-edit-btn" style="margin:0;padding:5px 12px;font-size:11px;flex-shrink:0;" onclick="App.closeModal('profileHubModal');App.openProfileSettings();">✏️ Edit</button>
      </div>

      <!-- Fast Stats Grid with Breathing Room -->
      <div class="ph-stats" style="margin:10px 0 16px;display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">
        <div class="ph-stat" style="padding:8px 4px;"><span class="ph-stat-num" style="font-size:19px;">${total}</span><span class="ph-stat-lbl" style="font-size:8px;">Total Books</span></div>
        <div class="ph-stat" style="padding:8px 4px;"><span class="ph-stat-num" style="font-size:19px;">${avgRating}${avgRating !== '' ? '&#9733;' : ''}</span><span class="ph-stat-lbl" style="font-size:8px;">Avg Rating</span></div>
        <div class="ph-stat" style="padding:8px 4px;"><span class="ph-stat-num" style="font-size:13.5px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:92px;">${this._escapeHtml(titleCase(favGenre))}</span><span class="ph-stat-lbl" style="font-size:8px;">Fav Genre</span></div>
        <div class="ph-stat" style="padding:8px 4px;"><span class="ph-stat-num" style="font-size:19px;">${streak}<span style="font-size:10px;"> ${streak === 1 ? 'mo' : 'mos'}</span></span><span class="ph-stat-lbl" style="font-size:8px;">Streak</span></div>
      </div>

      <!-- Celebratory Book of the Year (BotY) with Dedicated Breathing Room -->
      <div class="ph-boy" style="display:flex;flex-direction:row;align-items:center;justify-content:space-between;padding:12px 18px;margin:14px 12px 18px 12px;gap:14px;border-radius:12px;background:linear-gradient(135deg,rgba(254,243,199,0.58) 0%,rgba(253,230,138,0.30) 50%,rgba(245,158,11,0.14) 100%);border:1px solid rgba(217,167,74,0.48);box-shadow:0 3px 12px rgba(217,167,74,0.14);position:relative;overflow:hidden;">
        <div style="position:absolute;top:-12px;right:-12px;width:50px;height:50px;background:radial-gradient(circle,rgba(251,191,36,0.22) 0%,transparent 70%);pointer-events:none;"></div>
        <div style="display:flex;align-items:center;gap:14px;min-width:0;flex:1;">
          <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#fef3c7,#fde68a);border:1px solid #f59e0b;display:flex;align-items:center;justify-content:center;font-size:19px;box-shadow:0 2px 6px rgba(217,119,6,0.24);flex-shrink:0;">
            👑
          </div>
          ${boy ? `
            <img loading="lazy" decoding="async" src="${boy.cover || boy.fallbackCover}" onerror="this.src='${boy.fallbackCover}'" style="width:34px;height:48px;object-fit:cover;border-radius:4px;box-shadow:0 3px 8px rgba(0,0,0,0.28),0 0 0 1px rgba(217,167,74,0.35);flex-shrink:0;" alt="">
            <div style="min-width:0;flex:1;">
              <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:#92400e;font-weight:700;line-height:1;">Book of the Year · ${this.currentYear}</div>
              <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-style:italic;font-weight:700;font-size:14px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text-primary,#2C2C2C);margin-top:3px;">${this._escapeHtml(boy.title)}</div>
              ${boy.author ? `<div style="font-size:11.5px;color:var(--wood-mid,#665243);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px;">by ${this._escapeHtml(boy.author)}</div>` : ''}
            </div>
          ` : `
            <div style="min-width:0;flex:1;">
              <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:#92400e;font-weight:700;line-height:1;">Book of the Year · ${this.currentYear}</div>
              <div style="font-size:12.5px;font-weight:500;color:var(--text-secondary,#555);margin-top:3px;">Crown your premier read of ${this.currentYear}</div>
            </div>
          `}
        </div>
        <button class="ph-link-btn" style="margin:0;padding:7px 15px;font-size:12px;font-weight:700;flex-shrink:0;background:rgba(255,255,255,0.92);border:1px solid rgba(217,167,74,0.68);color:#854d0e;border-radius:18px;box-shadow:0 1px 4px rgba(217,167,74,0.18);transition:all 0.2s;" onclick="App.closeModal('profileHubModal');if(typeof App.showBOTYPicker==='function')App.showBOTYPicker(null,{mode:'manage',year:App.currentYear});">
          ${boy ? 'Change 👑' : 'Crown Book 👑'}
        </button>
      </div>

      <!-- Option A: Grand Living Reading Tree Circular Medallion -->
      <div style="width:100%;margin:10px 0 14px;text-align:center;">
        <div style="display:flex;align-items:center;justify-content:space-between;max-width:335px;margin:0 auto 8px;padding:0 4px;">
          <div style="display:inline-flex;align-items:center;gap:5px;background:rgba(250,248,245,0.92);padding:3px 10px;border-radius:12px;border:1px solid rgba(212,175,55,0.35);box-shadow:0 1px 4px rgba(0,0,0,0.04);font-family:'DM Mono',monospace;font-size:9.5px;letter-spacing:0.08em;text-transform:uppercase;color:var(--wood-dark,#4a3525);font-weight:700;">
            <span>🌳 Reading Tree · ${this.currentYear}</span>
          </div>
          <button type="button" onclick="App.openReadingTree();" style="display:inline-flex;align-items:center;gap:4px;background:rgba(139,38,53,0.08);padding:3px 10px;border-radius:12px;border:1px solid rgba(139,38,53,0.2);box-shadow:0 1px 4px rgba(0,0,0,0.04);font-size:10px;color:var(--burgundy,#8B2635);font-weight:600;cursor:pointer;transition:all 0.18s;">
            <span>⛶ Expand</span>
          </button>
        </div>
        <div class="ph-tree-card" onclick="App.openReadingTree();" title="Click to explore your living Reading Tree">
          <iframe id="profileMiniTreeFrame" src="reading_tree.html?embedded=1&year=${this.currentYear}" style="width:100%;height:100%;border:none;display:block;pointer-events:none;background:transparent;"></iframe>
        </div>
      </div>

      <!-- 2 Rows of Buttons under the Tree with Breathing Room -->
      <div class="ph-action-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;width:100%;margin-top:2px;">
        <button class="ph-action-btn" style="padding:9px 6px;" onclick="App.closeModal('profileHubModal');if(typeof App.menuAction==='function')App.menuAction('goals');">
          <span>🎯</span><span>Reading Goals</span>
        </button>
        <button class="ph-action-btn" style="padding:9px 6px;" onclick="App.closeModal('profileHubModal');if(typeof App.menuAction==='function')App.menuAction('notes');">
          <span>📝</span><span>My Notes</span>
        </button>
        <button class="ph-action-btn" style="padding:9px 6px;" onclick="App.closeModal('profileHubModal');if(typeof App.menuAction==='function')App.menuAction('quotes');">
          <span>❝</span><span>My Quotes</span>
        </button>
        <button class="ph-action-btn" style="padding:9px 6px;" onclick="App.closeModal('profileHubModal');if(typeof App.menuAction==='function')App.menuAction('wrapped');">
          <span>✨</span><span>Year in Review</span>
        </button>
        <button class="ph-action-btn" style="padding:9px 6px;" onclick="App.closeModal('profileHubModal');if(typeof App.openMonthlyRecap==='function')App.openMonthlyRecap();">
          <span>🗓️</span><span>Monthly Recap</span>
        </button>
        <button class="ph-action-btn" style="padding:9px 6px;" onclick="App.closeModal('profileHubModal');if(typeof App.openTrophyRoom==='function')App.openTrophyRoom();">
          <span>🏅</span><span>Badges</span>
        </button>
      </div>
    `;
  },

  async toggleProfilePublicFromHub(nextPublic) {
    nextPublic = !!nextPublic;
    try {
      const res = await DB.updateProfilePublic(this.userId, nextPublic);
      if (res) {
        this.profilePublic = (res.profile_public === false) ? false : true;
        this.ownProfile = Object.assign({}, this.ownProfile, res);
      } else {
        this.profilePublic = nextPublic;
      }
      this.showToast(this.profilePublic ? '🌍 Your profile is now public.' : '🔒 Your profile is now private.');
      if (this.profilePublic && typeof this._earnAchievement === 'function') this._earnAchievement('app_public');
    } catch (e) {
      this.showToast('Could not update privacy - please try again.');
    }
  },

  async openFollowList(type) {
    const body = document.getElementById('profileHubBody');
    if (!body) return;
    const titleTxt = type === 'followers' ? 'Followers' : 'Following';
    body.innerHTML = `<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;"><button class="ph-edit-btn" onclick="App._renderProfileHub()">‹ Back</button><div class="modal-title" style="margin:0;">${titleTxt}</div></div><div id="phFollowList"><div class="notes-empty">Loading...</div></div>`;

    const host = document.getElementById('phFollowList');
    if (!host) return;

    try {
      let list = [];
      if (type === 'followers') {
        list = (this._profileHubData && this._profileHubData.followers) ? this._profileHubData.followers : await DB.getFollowers(this.userId);
        list = list || [];
      } else {
        const ids = Array.isArray(this.following) ? this.following : [];
        if (!ids.length) {
          host.innerHTML = '<div class="notes-empty">You\'re not following anyone yet. Find readers in Community → Discover.</div>';
          return;
        }
        const profiles = await DB.getPublicProfiles(this.userId);
        list = (profiles || []).filter(p => ids.includes(p.user_id));
      }

      if (!list.length) {
        host.innerHTML = type === 'followers'
          ? '<div class="notes-empty">No followers yet. Share your shelf and recommend books to grow your circle.</div>'
          : '<div class="notes-empty">You\'re not following anyone yet. Find readers in Community → Discover.</div>';
        return;
      }

      host.innerHTML = '<div style="display:flex;flex-direction:column;gap:8px;">' + list.map(p => {
        const nm = normalizeDisplayName(p.display_name || 'A reader', null);
        const av = (typeof this._getUserAvatar === 'function' ? this._getUserAvatar(p) : (p.avatar_emoji || '❌'));
        return `<div class="ph-row" style="cursor:pointer;" onclick="App.openProfileView('${p.user_id}')">
          <div style="display:flex;align-items:center;gap:11px;min-width:0;">
            <div class="discover-avatar" style="width:38px;height:38px;font-size:19px;background:${this._avatarBg(av)};">${this._escapeHtml(av)}</div>
            <div class="ph-row-label" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${this._escapeHtml(nm)}</div>
          </div>
          <span style="color:var(--wood-light);font-size:18px;">›</span>
        </div>`;
      }).join('') + '</div>';
    } catch (e) {
      host.innerHTML = '<div class="notes-empty">Could not load this list.</div>';
    }
  },

  isFollowing(userId) {
    return Array.isArray(this.following) && this.following.indexOf(userId) !== -1;
  },

  async toggleFollow(userId, btnEl) {
    if (!userId || userId === this.userId || !this.userId) return;
    if (!Array.isArray(this.following)) this.following = [];

    const idx = this.following.indexOf(userId);
    const willFollow = idx === -1;

    if (willFollow) this.following.push(userId);
    else this.following.splice(idx, 1);

    this._syncFollowButtons(userId, willFollow);

    const ok = await DB.setFollowing(this.userId, this.following);
    if (!ok) {
      if (willFollow) this.following = this.following.filter(x => x !== userId);
      else this.following.push(userId);
      this._syncFollowButtons(userId, this.isFollowing(userId));
      this.showToast('Could not update follow - please try again.');
    } else {
      this.showToast(willFollow ? '✓ Following' : 'Unfollowed');
      if (willFollow && typeof this._earnAchievement === 'function') {
        this._earnAchievement('app_follow');
        // If DNA match is high (assuming we can't easily check here, we'll just leave this or check if they were in the discover tab)
        if (typeof this._earnAchievement === 'function') this._earnAchievement('soc_doppelganger');
        if (typeof this._checkGhostReader === 'function') this._checkGhostReader();
      }
    }
  },

  _syncFollowButtons(userId, isF) {
    document.querySelectorAll(`.feed-follow-btn[data-uid="${userId}"]`).forEach(b => {
      b.classList.toggle('following', isF);
      b.textContent = isF ? '✓ Following' : '+ Follow';
    });
    document.querySelectorAll(`.discover-follow[data-uid="${userId}"]`).forEach(b => {
      b.classList.toggle('following', isF);
      b.textContent = isF ? 'Following' : '+ Follow';
    });
  },

  
  async _earnAchievement(type, data = {}) {
    if (!this.userId || this.isReadOnly) return;
    try {
      const added = await window.DB.recordAchievement(this.userId, type, data);
      if (added) {
        // Find the badge name for the toast
        let name = 'Achievement Unlocked!';
        if (typeof window.ACHIEVEMENTS !== 'undefined' && window.ACHIEVEMENTS[type]) {
            name = window.ACHIEVEMENTS[type].name + ' Unlocked!';
        } else {
            const catalog = this._getBadgesCatalog ? this._getBadgesCatalog() : [];
            const b = catalog.find(x => x.id === type);
            if (b) name = b.icon + ' ' + b.name + ' Unlocked!';
        }
        this.showToast(name);
      }
    } catch(e) {
      console.warn('earnAchievement error:', e);
    }
  },
async recordMilestones() {
    if (!this.userId || this.isReadOnly) return;
    const books = Array.isArray(this.books) ? this.books : [];
    const finished = books.filter(b => !b.currentlyReading && b.status !== 'to-read');
    const tasks = [];

    books.filter(b => b.bookOfYear).forEach(b => {
      tasks.push(DB.recordAchievement(this.userId, 'book_of_year', { key: 'boy_' + b.bookOfYear, title: b.title, year: Number(b.bookOfYear) }));
    });

    const thresholds = [10, 25, 50, 100, 150, 200, 250, 300, 400, 500];
    thresholds.forEach(n => {
      if (finished.length >= n) tasks.push(DB.recordAchievement(this.userId, 'milestone_books', { key: 'books_' + n, count: n }));
    });

    const relicMilestones = [
      { id: 'tree_relic_seed', count: 1 },
      { id: 'tree_relic_nautilus', count: 3 },
      { id: 'tree_relic_astrolabe', count: 6 },
      { id: 'tree_relic_lantern', count: 12 },
      { id: 'tree_relic_heart', count: 24 },
      { id: 'tree_relic_obelisk', count: 36 },
      { id: 'tree_relic_orrery', count: 52 },
    ];
    relicMilestones.forEach(rm => {
      if (finished.length >= rm.count) {
        tasks.push(DB.recordAchievement(this.userId, rm.id, { key: rm.id, count: rm.count }));
      }
    });
    if (tasks.length > 0) {
      try { await Promise.allSettled(tasks); } catch(e) {}
    }
  },

  async initPushSubscription() {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (!this.userId) return;

    try {
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();

      if (!sub && typeof VAPID_PUBLIC_KEY !== 'undefined' && VAPID_PUBLIC_KEY) {
        const keyBytes = Uint8Array.from(atob(VAPID_PUBLIC_KEY.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes });
      }

      if (sub) {
        const subJson = sub.toJSON();
        await DB.savePushSubscription(this.userId, subJson.endpoint, subJson.keys.p256dh, subJson.keys.auth);
      }
    } catch (e) {
      console.warn('Push subscription:', e.message);
    }
  },

  _showStreakNudge(streak, days) {
    if (localStorage.getItem('sl_streak_nudge_dismissed') === 'true') return;
    const existing = document.getElementById('streakNudgeBanner');
    if (existing) return;

    const banner = document.createElement('div');
    banner.id = 'streakNudgeBanner';
    banner.style.cssText = 'position:fixed;bottom:calc(env(safe-area-inset-bottom,0px) + 88px);left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#1c3f78,#1e5c3a);color:#f0e8dc;padding:12px 20px;border-radius:10px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:13px;z-index: 20000 !important;box-shadow:0 8px 24px rgba(0,0,0,0.5);display:flex;align-items:center;gap:12px;max-width:340px;animation:fadeIn 0.3s ease';
    banner.innerHTML = `<span style="font-size:20px">🔥</span><div><div style="font-weight:700;margin-bottom:2px">Your ${streak}-month streak is waiting</div><div style="font-size:11px;opacity:0.8">You haven't finished a book in ${days} days - what are you reading?</div></div><button onclick="localStorage.setItem('sl_streak_nudge_dismissed','true');(this&&typeof this.closest==='function'?this.closest('#streakNudgeBanner'):document.getElementById('streakNudgeBanner'))?.remove()" style="background:rgba(240,232,220,0.2);border:none;color:#f0e8dc;padding:6px 10px;border-radius:6px;cursor:pointer;font-size:11px;white-space:nowrap">Got it</button>`;
    document.body.appendChild(banner);
  },

  expandDiscover() {
    this._discoverExpanded = true;
    if (typeof this.render === 'function') this.render();
  },

  ignoreReader(userId) {
    const ignored = JSON.parse(localStorage.getItem('sl_ignored_readers') || '[]');
    if (!ignored.includes(userId)) {
      ignored.push(userId);
      localStorage.setItem('sl_ignored_readers', JSON.stringify(ignored));
    }
    if (typeof this.render === 'function') this.render();
  },

  openLaserModal() {
    const el = document.getElementById('laserWaitlistModal');
    if (el) {
      el.style.display = 'flex';
      el.classList.add('open');
    }
    const emailInput = document.getElementById('laserWaitlistEmail');
    if (emailInput && this.session && this.session.user) {
      emailInput.value = this.session.user.email || '';
    }
  },

  submitLaserWaitlist() {
    const email = (document.getElementById('laserWaitlistEmail')?.value || '').trim();
    if (!email) {
      this.showToast('Please enter an email address.');
      return;
    }
    this.showToast('You are on the list! We will notify you when it goes live.');
    this.closeModal('laserWaitlistModal');
  },

  markCommunityNotificationsSeen(newestSeenItem) {
    const dot = document.getElementById('communityBellDot');
    if (dot) dot.style.display = 'none';

    try {
      const now = Date.now();
      const currentSeen = parseInt(localStorage.getItem('sl_community_lastseen') || '0', 10) || 0;
      let targetTimestamp = Math.max(now, currentSeen);

      if (newestSeenItem) {
        const itemTime = new Date(newestSeenItem.created_at).getTime();
        if (!isNaN(itemTime) && itemTime > targetTimestamp) {
          targetTimestamp = itemTime;
        }
        if (newestSeenItem.id) {
          localStorage.setItem('sl_community_lastseen_id', String(newestSeenItem.id));
          this._lastSeenFeedId = String(newestSeenItem.id);
        }
      } else if (this._newestFeedId) {
        localStorage.setItem('sl_community_lastseen_id', String(this._newestFeedId));
        this._lastSeenFeedId = String(this._newestFeedId);
        if (this._newestFeedTime && this._newestFeedTime > targetTimestamp) {
          targetTimestamp = this._newestFeedTime;
        }
      }

      localStorage.setItem('sl_community_lastseen', String(targetTimestamp));
      this._lastSeenFeedTime = targetTimestamp;
    } catch (e) {}
  },

  openCommunity() {
    this.closeSlideMenu();
    this.markCommunityNotificationsSeen();
    this.openModal('communityModal');
    this.switchCommunityTab(this._commTab || 'feed');
  },

  _updateSlideMenuInfo() {
    const name = this.displayName || this.ownerDisplayName || 'Reader';
    const nameEl = document.getElementById('menuUserName');
    if (nameEl) nameEl.textContent = name;
    const bookCount = (this.books || []).filter(b => !b.currentlyReading && b.status !== 'to-read').length;
    const statsEl = document.getElementById('menuUserStats');
    if (statsEl) statsEl.textContent = `${bookCount} book${bookCount !== 1 ? 's' : ''} in ${this.currentYear}`;
    const av = document.getElementById('menuAvatar');
    if (av) {
      const emoji = this._avatarEmoji || '👤';
      av.textContent = emoji;
      if (typeof this._avatarBg === 'function') {
        av.style.background = this._avatarBg(emoji);
      }
    }
  },

  openExportModalFromMenu() {
    this.closeSlideMenu();
    const yl = document.getElementById('exportYearLabel');
    if (yl) yl.textContent = this.currentYear;
    this.openModal('exportModal');
  },

  _csvCell(val) {
    if (val == null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  },

  _downloadCSV(records, filename = 'notetoshelf_library.csv') {
    const headers = ['Title', 'Author', 'ISBN', 'Words', 'Estimated', 'Rating', 'Sentiment', 'Date Read', 'Year', 'Month', 'Format', 'Genre', 'Days', 'Fiction', 'Re-read', 'Review', 'Notes', 'Quote'];
    const rows = records.map(r => [
      this._csvCell(r.title),
      this._csvCell(r.author),
      this._csvCell(r.isbn),
      this._csvCell(r.words),
      this._csvCell(r.is_word_count_estimated),
      this._csvCell(r.rating),
      this._csvCell(r.sentiment),
      this._csvCell(r.date_read),
      this._csvCell(r.year),
      this._csvCell(r.month),
      this._csvCell(r.format),
      this._csvCell(r.genre),
      this._csvCell(r.days),
      this._csvCell(r.fiction ? 'Fiction' : 'Non-Fiction'),
      this._csvCell(r.is_reread),
      this._csvCell(r.review),
      this._csvCell(r.notes),
      this._csvCell(r.quote)
    ].join(','));
    const csvContent = [headers.join(','), ...rows].join('\r\n');
    this._triggerDownload(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }), filename);
  },

  _downloadJSON(records, filename = 'notetoshelf_library.json') {
    const jsonContent = JSON.stringify({
      version: '1.0',
      exportDate: new Date().toISOString(),
      user: this.displayName || 'Reader',
      totalBooks: records.length,
      books: records
    }, null, 2);
    this._triggerDownload(new Blob([jsonContent], { type: 'application/json;charset=utf-8;' }), filename);
  },

  _triggerDownload(blobOrContent, filename) {
    const blob = blobOrContent instanceof Blob ? blobOrContent : new Blob([blobOrContent], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  },

  _bookToExportRecord(b) {
    return {
      title: b.title || '',
      author: b.author || '',
      isbn: b.isbn || '',
      words: b.words || 0,
      is_word_count_estimated: b.isWordCountEstimated || b.is_word_count_estimated || false,
      sentiment: b.sentiment || '',
      rating: b.rating || (b.sentiment === 'love' ? 5 : b.sentiment === 'like' ? 4 : b.sentiment === 'mixed' ? 3 : b.sentiment === 'dislike' ? 2 : ''),
      date_read: b.dateFinished || b.date_finished || '',
      year: b.readYear || b.year || this.currentYear,
      month: b.month || b.month_finished || '',
      review: b.review || '',
      notes: b.notes || '',
      format: b.format || 'physical',
      genre: b.genre || '',
      days: b.days != null ? b.days : '',
      fiction: b.fiction !== false,
      is_reread: b.isReread || b.is_reread || false,
      quote: b.quote || '',
      cover_url: b.coverUrl || b.cover_url || ''
    };
  },

  async _gatherExportBooks(yearScope) {
    let books = [];
    if (yearScope === 'all') {
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
        const rows = await DB.getAllUserBooks(this.userId);
        books = (rows || []).map(dbToBook);
      }
    } else {
      books = (this.books || []).filter(b => !b.currentlyReading && b.status !== 'to-read');
    }
    return books;
  },

  async runExport(format = 'csv', yearScope) {
    try {
      if (!yearScope) {
        const checked = document.querySelector('input[name="exportScope"]:checked');
        yearScope = checked ? checked.value : 'year';
      }
      const books = await this._gatherExportBooks(yearScope);
      if (!books || !books.length) {
        this.showToast('No books found to export.');
        return;
      }
      const records = books.map(b => this._bookToExportRecord(b));
      const yrLabel = yearScope === 'all' ? 'all_years' : String(this.currentYear);
      const stamp = new Date().toISOString().slice(0, 10);
      const filename = `notetoshelf_${yrLabel}_${stamp}.${format}`;

      if (format === 'json') {
        this._downloadJSON(records, filename);
      } else {
        this._downloadCSV(records, filename);
      }
      this.closeModal('exportModal');
      this.showToast(`Exported ${records.length} book${records.length === 1 ? '' : 's'} as ${format.toUpperCase()}!`);
    } catch (err) {
      console.error('[runExport] error:', err);
      this.showToast('Export failed: ' + err.message);
    }
  },

  showBOTYPicker(books, opts = {}) {
    const curApp = this && this.books ? this : (typeof window !== 'undefined' ? window.App : null);
    const year = Number(opts.year) || (curApp && curApp.currentYear) || 2026;
    const mode = opts.mode || 'manage';
    const required = !!opts.required;
    const allBooks = (curApp && curApp.books) || [];
    const pool = (books && books.length) ? books.slice() : allBooks.filter(b => !b.currentlyReading && !b.dnf && (Number(b.readYear || b.year) === year || !b.readYear));
    if (!pool.length && !allBooks.length) {
      if (curApp && typeof curApp.showToast === 'function') curApp.showToast('No finished books to crown yet.');
      return;
    }
    const finalPool = pool.length ? pool : allBooks.filter(b => !b.currentlyReading && !b.dnf);

    const existing = document.getElementById('botyPickerModal');
    if (existing) existing.remove();

    const currentCrown = allBooks.find(b => b.bookOfYear && Number(b.bookOfYear) === year);
    const currentCrownId = currentCrown ? currentCrown.id : null;
    const titleText = mode === 'discovery' ? 'Three Books You Loved!' : (mode === 'wrapped' ? 'Crown Your Book of the Year' : 'Book of the Year');
    const subText = mode === 'discovery'
      ? `You've loved 3 books in ${year} so far. Which is your favorite, your Book of the Year?`
      : (required ? `Every great year deserves a champion. Pick your favorite read of ${year} to crown.` : `Choose your favorite read of ${year}. You can change this anytime.`);

    const cards = finalPool.map(b => {
      const isCur = String(b.id) === String(currentCrownId);
      const t = (b.title || '').replace(/</g, '&lt;');
      const a = (b.author || '').replace(/</g, '&lt;');
      return `<div class="boty-pick boty-item${isCur ? ' current selected' : ''}" data-id="${b.id}" data-search="${(t + ' ' + a).toLowerCase().replace(/"/g, '')}" onclick="App._botyPickSelect(this)">
        ${isCur ? '<span class="boty-pick-currentbadge">Current</span>' : ''}
        <span class="boty-pick-checkcrown">👑</span>
        ${this._botyCover ? this._botyCover(b) : ''}
        <div class="boty-pick-title">${t}</div>
        <div class="boty-pick-author">${a}</div>
      </div>`;
    }).join('');

    const overlay = document.createElement('div');
    overlay.className = 'boty-picker-overlay modal-overlay open';
    overlay.id = 'botyPickerModal';
    overlay.style.display = 'flex';
    overlay.style.zIndex = '99000';

    overlay.innerHTML = `
      <div class="boty-picker-card modal-card" id="botyPickerCard" role="dialog" aria-modal="true" aria-label="${titleText}">
        <button class="modal-close" onclick="App._botyPickerClose()" aria-label="Close">✕</button>
        <span class="boty-picker-crownmark">👑</span>
        <div class="boty-picker-title">${mode === 'discovery' ? '🎉 ' : ''}${titleText}</div>
        <div class="boty-picker-sub">${subText}</div>
        <input type="text" id="botySearchInput" class="boty-picker-search form-input" placeholder="Search your books…" oninput="App._botyPickerFilter(this.value)">
        <div class="boty-picker-grid" id="botyPickerGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px;margin:16px 0;max-height:50vh;overflow-y:auto;">${cards}</div>
        <div class="boty-picker-actions" style="display:flex;gap:10px;justify-content:flex-end;">
          ${currentCrownId ? `<button class="boty-action-btn btn-secondary" data-action="uncrown" onclick="App.uncrownBook(${year})">Uncrown</button>` : ''}
          <button class="boty-picker-confirm btn-primary" id="botyPickerConfirm" onclick="App._botyPickerConfirm(${year})" ${currentCrownId ? '' : 'disabled'}>👑 Crown This Book</button>
          ${required ? '' : `<button class="boty-picker-skip btn-secondary" onclick="App._botyPickerClose()">${mode === 'discovery' ? 'Not Yet' : 'Cancel'}</button>`}
        </div>
      </div>
    `;

    this._botySelectedId = currentCrownId;
    this._botyAllPool = finalPool;
    this._botyPickerOpts = { year, mode, required, onPick: opts.onPick || null };
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay && !required) this._botyPickerClose(); });
  },

  async crownBook(bookId, year, opts = {}) {
    const curApp = this && this.books ? this : (typeof window !== 'undefined' ? window.App : null);
    year = Number(year) || (curApp && curApp.currentYear) || 2026;
    const books = (curApp && curApp.books) || [];
    const target = books.find(b => String(b.id) === String(bookId));
    if (!target) return;
    for (const b of books) {
      if (b.id !== bookId && b.bookOfYear && Number(b.bookOfYear) === year) {
        b.bookOfYear = null;
        if (!curApp?.isDemoMode && curApp?.userId) {
          try { await DB.updateBook(b.id, { book_of_year: null }); } catch (e) { console.warn(e); }
        }
      }
    }
    target.bookOfYear = year;
    if (!curApp?.isDemoMode && curApp?.userId) {
      try { await DB.updateBook(bookId, { book_of_year: year }); } catch (e) { console.warn(e); }
    }
    if (curApp && typeof curApp.render === 'function') curApp.render();
    if (curApp && typeof curApp.notifyReadingTreeUpdated === 'function') curApp.notifyReadingTreeUpdated();
    if (!opts.silent && curApp && typeof curApp.showToast === 'function') curApp.showToast(`👑 ${target.title} crowned as your Book of the Year!`);
    return target;
  },

  async uncrownBook(year) {
    const curApp = this && this.books ? this : (typeof window !== 'undefined' ? window.App : null);
    year = Number(year) || (curApp && curApp.currentYear) || 2026;
    const books = (curApp && curApp.books) || [];
    for (const b of books) {
      if (b.bookOfYear && Number(b.bookOfYear) === year) {
        b.bookOfYear = null;
        if (!curApp?.isDemoMode && curApp?.userId) {
          try { await DB.updateBook(b.id, { book_of_year: null }); } catch (e) { console.warn(e); }
        }
      }
    }
    if (curApp && typeof curApp.render === 'function') curApp.render();
    if (curApp && typeof curApp.notifyReadingTreeUpdated === 'function') curApp.notifyReadingTreeUpdated();
    if (curApp && typeof curApp._botyPickerClose === 'function') curApp._botyPickerClose();
    if (curApp && typeof curApp.showToast === 'function') curApp.showToast(`Uncrowned Book of the Year for ${year}.`);
  },

  _botyCover(b) {
    const src = (b.cover || b.coverUrl || b.fallbackCover || '').replace(/"/g, '&quot;');
    const fb = (b.fallbackCover || '').replace(/"/g, '&quot;');
    return `<img class="boty-pick-cover" src="${src}" alt="" loading="lazy" style="width:100%;height:140px;object-fit:cover;border-radius:6px;" onerror="this.onerror=null;this.src='${fb}';">`;
  },

  _botyPickSelect(el) {
    const grid = document.getElementById('botyPickerGrid');
    if (grid) grid.querySelectorAll('.boty-pick').forEach(p => p.classList.remove('selected'));
    el.classList.add('selected');
    this._botySelectedId = el.dataset.id;
    const confirm = document.getElementById('botyPickerConfirm');
    if (confirm) confirm.disabled = false;
  },

  _botyPickerFilter(q) {
    q = (q || '').toLowerCase().trim();
    const grid = document.getElementById('botyPickerGrid');
    if (!grid) return;
    const pool = this._botyAllPool || [];
    const matched = pool.filter(b => {
      const text = ((b.title || '') + ' ' + (b.author || '')).toLowerCase();
      return !q || text.includes(q);
    });
    grid.innerHTML = matched.map(b => {
      const isCur = String(b.id) === String(this._botySelectedId);
      const t = (b.title || '').replace(/</g, '&lt;');
      const a = (b.author || '').replace(/</g, '&lt;');
      return `<div class="boty-pick boty-item${isCur ? ' current selected' : ''}" data-id="${b.id}" data-search="${(t + ' ' + a).toLowerCase().replace(/"/g, '')}" onclick="App._botyPickSelect(this)">
        ${isCur ? '<span class="boty-pick-currentbadge">Current</span>' : ''}
        <span class="boty-pick-checkcrown">👑</span>
        ${this._botyCover ? this._botyCover(b) : ''}
        <div class="boty-pick-title">${t}</div>
        <div class="boty-pick-author">${a}</div>
      </div>`;
    }).join('');
  },

  _botyPickerClose() {
    const overlay = document.getElementById('botyPickerModal');
    if (!overlay) return;
    overlay.classList.remove('open');
    overlay.style.display = 'none';
    setTimeout(() => overlay.remove(), 50);
  },

  async _botyPickerConfirm(year) {
    const id = this._botySelectedId;
    if (!id) return;
    const opts = this._botyPickerOpts || {};
    await this.crownBook(id, year, { method: opts.mode || 'manual' });
    this._botyPickerClose();
    if (typeof opts.onPick === 'function') {
      try { opts.onPick(id); } catch (e) { console.error(e); }
    }
  },

  async _loadNotifPrefs() {
    try {
      const stored = localStorage.getItem('sl_notif_prefs');
      if (stored) {
        this._notifPrefs = JSON.parse(stored);
      } else {
        this._notifPrefs = {
          reactions: true,
          comments: true,
          notes: true,
          recommendations: true,
          club: true
        };
      }
    } catch (e) {
      this._notifPrefs = {
        reactions: true,
        comments: true,
        notes: true,
        recommendations: true,
        club: true
      };
    }
  },

  async toggleNotifPref(type, checked) {
    if (!this._notifPrefs) this._notifPrefs = {};
    this._notifPrefs[type] = !!checked;
    try {
      localStorage.setItem('sl_notif_prefs', JSON.stringify(this._notifPrefs));
    } catch (e) {}

    if (this.userId && !this.isDemoMode) {
      try {
        await DB.updateNotificationPrefs(this.userId, this._notifPrefs);
      } catch (e) {
        console.warn('updateNotificationPrefs error:', e);
      }
    }
  },

  openReadingGoalsModal() {
    this.openModal('readingGoalsModal');
    const container = document.getElementById('goalsModalContent');
    if (!container) return;

    const yr = this.currentYear;
    const goal = (this.readingGoals && this.readingGoals[yr]) ? parseInt(this.readingGoals[yr], 10) : 0;
    const finished = (this.books || []).filter(b => !b.currentlyReading && b.status !== 'to-read');
    const count = finished.length;
    const pct = goal > 0 ? Math.min(100, Math.round((count / goal) * 100)) : 0;

    const now = new Date();
    const isCurrentYear = (Number(yr) === now.getFullYear());
    const isLeap = ((yr % 4 === 0 && yr % 100 !== 0) || yr % 400 === 0);
    const totalDays = isLeap ? 366 : 365;
    const start = new Date(yr, 0, 1);
    const dayOfYear = isCurrentYear ? Math.max(1, Math.min(totalDays, Math.floor((now - start) / (1000 * 60 * 60 * 24)) + 1)) : totalDays;
    const expected = goal > 0 ? (goal * (dayOfYear / totalDays)) : 0;
    const diff = count - expected;

    let paceBadge = '';
    let paceDesc = '';
    if (goal <= 0) {
      paceBadge = `<span style="background:rgba(61,43,31,0.08);color:var(--wood-dark);padding:4px 10px;border-radius:12px;font-size:11px;font-weight:600;">No Goal Set</span>`;
      paceDesc = `Set a reading goal for ${yr} to track your reading pace and stay motivated.`;
    } else if (diff >= 1) {
      const rounded = Math.round(diff);
      paceBadge = `<span style="background:rgba(46,125,50,0.15);color:#2e7d32;padding:4px 10px;border-radius:12px;font-size:11px;font-weight:600;">🔥 Ahead of Schedule</span>`;
      paceDesc = `You are <strong>${rounded} book${rounded === 1 ? '' : 's'} ahead</strong> of your target pace for ${yr}.`;
    } else if (diff <= -1) {
      const rounded = Math.abs(Math.round(diff));
      paceBadge = `<span style="background:rgba(198,40,40,0.15);color:#c62828;padding:4px 10px;border-radius:12px;font-size:11px;font-weight:600;">⏱️ Behind Schedule</span>`;
      paceDesc = `You are <strong>${rounded} book${rounded === 1 ? '' : 's'} behind</strong> your target pace for ${yr}.`;
    } else {
      paceBadge = `<span style="background:rgba(212,175,55,0.2);color:#8d7010;padding:4px 10px;border-radius:12px;font-size:11px;font-weight:600;">🎯 On Track</span>`;
      paceDesc = `You are <strong>right on track</strong> to reach your goal of ${goal} books in ${yr}!`;
    }

    container.innerHTML = `
      <div style="text-align:center;margin-bottom:20px;">
        <div style="font-size:32px;margin-bottom:8px;">🎯</div>
        <div class="modal-title" style="margin:0 0 4px 0;font-size:22px;">Reading Goal · ${yr}</div>
        <div style="font-size:12px;color:var(--wood-light);">${isCurrentYear ? 'Year-to-date pacing and progress' : `Final tally for ${yr}`}</div>
      </div>

      <div style="background:rgba(61,43,31,0.03);border-radius:14px;padding:20px;margin-bottom:20px;border:1px solid rgba(61,43,31,0.06);">
        <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:10px;">
          <div>
            <span style="font-size:28px;font-weight:700;color:var(--wood-dark);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${count}</span>
            <span style="font-size:14px;color:var(--wood-light);"> / ${goal > 0 ? goal : '-'} books</span>
          </div>
          <div style="font-size:16px;font-weight:700;color:var(--burgundy,#8b2635);font-family:'DM Mono',monospace;">${pct}%</div>
        </div>

        <div style="width:100%;height:10px;background:rgba(61,43,31,0.08);border-radius:5px;overflow:hidden;margin-bottom:14px;">
          <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,var(--gold,#d4af37),var(--burgundy,#8b2635));border-radius:5px;transition:width 0.4s ease;"></div>
        </div>

        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
          <div>${paceBadge}</div>
          <div style="font-size:11.5px;color:var(--wood-dark);line-height:1.4;flex:1;min-width:180px;">${paceDesc}</div>
        </div>
      </div>

      <div style="display:flex;gap:10px;justify-content:center;">
        <button class="btn-primary" style="padding:10px 20px;font-size:12px;cursor:pointer;" onclick="App.closeModal('readingGoalsModal');App.openProfileSettings();">
          ✏️ ${goal > 0 ? 'Adjust Reading Goal' : 'Set a Reading Goal'}
        </button>
        <button class="btn-secondary" style="padding:10px 16px;font-size:12px;cursor:pointer;" onclick="App.closeModal('readingGoalsModal');">
          Close
        </button>
      </div>
    `;
  },

  async openAllQuotes() {
    this.openModal('quotesModal');
    const container = document.getElementById('quotesList');
    if (!container) return;

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

    const quotesWithBooks = [];
    books.forEach(b => {
      const qText = (b.favoriteQuotes || b.quote || b.favorite_quotes || '').trim();
      if (qText) {
        const lines = qText.split('\n').map(l => l.trim()).filter(Boolean);
        lines.forEach(q => {
          quotesWithBooks.push({ quote: q, book: b });
        });
      }
    });

    if (!quotesWithBooks.length) {
      container.innerHTML = `
        <div style="padding:40px 20px;text-align:center;color:var(--wood-light);">
          <div style="font-size:32px;margin-bottom:12px;">❝</div>
          <div style="font-size:14px;font-weight:600;color:var(--wood-dark);margin-bottom:6px;">No saved quotes yet</div>
          <div style="font-size:12px;max-width:280px;margin:0 auto;line-height:1.4;">Add favorite passages when editing books on your shelf to collect your favorite literary lines here.</div>
        </div>`;
      return;
    }

    container.innerHTML = quotesWithBooks.map(item => `
      <div class="quote-card" style="background:rgba(61,43,31,0.03);border-left:3px solid var(--burgundy,#8b2635);padding:14px 16px;border-radius:0 8px 8px 0;margin-bottom:14px;">
        <div style="font-family:'Playfair Display',Georgia,serif;font-style:italic;font-size:14px;line-height:1.5;color:var(--wood-dark);margin-bottom:8px;">
          "${this._escapeHtml(item.quote)}"
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;font-size:11px;color:var(--wood-light);">
          <div>
            <strong style="color:var(--wood-dark);">${this._escapeHtml(item.book.title || '')}</strong>
            ${item.book.author ? ` · <span>${this._escapeHtml(item.book.author)}</span>` : ''}
          </div>
          ${item.book.readYear || item.book.year ? `<span style="font-family:'DM Mono',monospace;font-size:10px;">${item.book.readYear || item.book.year}</span>` : ''}
        </div>
      </div>
    `).join('');
  },

  openMyNotes() {
    this.closeSlideMenu();
    this.openCommunity();
    if (typeof this.switchCommunityTab === 'function') {
      this.switchCommunityTab('notes');
    }
  },

      _getBadgesCatalog() {
    return [
        // PROGRESSION - Volumes
        { id: 'vol_1', name: 'Novice Reader', icon: '\u{1F4D6}', desc: 'Every great library begins with a single spine.', req: 'Log your first finished book.', isSecret: false, isHidden: false },
        { id: 'vol_10', name: 'Bookworm', icon: '\u{1F41B}', desc: 'The habit has taken hold. There\'s no going back.', req: 'Log 10 finished books.', isSecret: false, isHidden: false },
        { id: 'vol_25', name: 'Bibliophile', icon: '\u{1F4DA}', desc: 'Your shelf tells a story of its own now.', req: 'Log 25 finished books.', isSecret: false, isHidden: false },
        { id: 'vol_100', name: 'The Archive', icon: '\u{1F3DB}\u{FE0F}', desc: 'A century of stories. Most people only dream of this.', req: 'Log 100 finished books.', isSecret: false, isHidden: false },
        
        // PROGRESSION - Word Count
        { id: 'words_100k', name: 'Prologue', icon: '\u{2712}\u{FE0F}', desc: 'You\'ve read a whole novel\'s worth of words. The journey begins.', req: 'Read 100,000 words.', isSecret: false, isHidden: false },
        { id: 'words_500k', name: 'Novelist', icon: '\u{1F58B}\u{FE0F}', desc: 'Half a million words. Enough to have written a trilogy yourself.', req: 'Read 500,000 words.', isSecret: false, isHidden: false },
        { id: 'words_1m', name: 'Millionaire', icon: '\u{1F4B8}', desc: 'One million words. A rare club. Welcome.', req: 'Read 1,000,000 words.', isSecret: false, isHidden: false },
        { id: 'words_5m', name: 'Epic of Gilgamesh', icon: '\u{1F3DC}\u{FE0F}', desc: 'The oldest story ever written is 3,000 words. You\'ve read this 1,666 times over.', req: 'Read 5,000,000 words.', isSecret: false, isHidden: false },
        { id: 'words_7m', name: 'Scheherazade', icon: '\u{1F483}', desc: 'She told a story every night to stay alive. You read for the same reason.', req: 'Read 7,000,000 words.', isSecret: false, isHidden: false },
        { id: 'words_9m', name: 'The Library of Babel', icon: '\u{1F3E2}', desc: 'Borges imagined a library containing every possible book. You\'re building your own.', req: 'Read 9,000,000 words.', isSecret: false, isHidden: false },
        { id: 'words_10m', name: 'The Word Hoard', icon: '\u{1F4DD}', desc: 'The Old English term for a treasury of language. You have earned it.', req: 'Read 10,000,000 words.', isSecret: false, isHidden: false },
        { id: 'words_15m', name: 'The Archivist', icon: '\u{1F5C4}\u{FE0F}', desc: '15 million words. A true curator of history.', req: 'Read 15,000,000 words.', isSecret: false, isHidden: false },
        { id: 'words_25m', name: 'The Scholar', icon: '\u{1F393}', desc: '25 million words. Your mind is a library.', req: 'Read 25,000,000 words.', isSecret: false, isHidden: false },

        // HIDDEN (Not secret, but requirements obscured until earned)
        { id: 'hid_changedMind', name: 'Change of Heart', icon: '\u{1F494}', desc: 'You loved it, until you thought about it.', req: 'Change a 5-star rating to a 2-star rating or lower.', isSecret: false, isHidden: true },
        { id: 'hid_noRegrets', name: 'No Regrets', icon: '\u{1F6B6}', desc: 'Sometimes the bravest thing is to walk away.', req: 'You abandoned a book and never looked back.', isSecret: false, isHidden: true },
        { id: 'hid_secondChance', name: 'Second Chance', icon: '\u{1F504}', desc: 'Time changes all things, even readers.', req: 'You picked up an abandoned book again.', isSecret: false, isHidden: true },
        { id: 'hid_timeCapsule', name: 'Time Capsule', icon: '\u{23F3}', desc: 'You read a book from a decade you haven\'t visited before.', req: 'You opened a door to a time you did not know.', isSecret: false, isHidden: true },
        { id: 'hid_echoes', name: 'Echoes', icon: '\u{1F5E3}\u{FE0F}', desc: 'A familiar voice spoke to you three times.', req: 'You read three books from the same author in a row.', isSecret: false, isHidden: true },
        { id: 'hid_infiniteLoop', name: 'Infinite Loop', icon: '\u{267E}\u{FE0F}', desc: 'You returned to a place you already knew.', req: 'You reread a book you already finished.', isSecret: false, isHidden: true },
        { id: 'hid_balanced', name: 'Perfectly Balanced', icon: '\u{2696}\u{FE0F}', desc: 'Truth and imagination, in equal measure.', req: 'An equal number of fiction and non-fiction.', isSecret: false, isHidden: true },
        { id: 'hid_dedicatedFan', name: 'Dedicated Fan', icon: '\u{1F3AF}', desc: 'You stayed in one world for a long time.', req: '5 books in a row from the same genre.', isSecret: false, isHidden: true },
        { id: 'hid_busyBee', name: 'Busiest Bee', icon: '\u{1F41D}', desc: 'One month contained more books than most years.', req: '5 books in a single month.', isSecret: false, isHidden: true },
        { id: 'hid_indecisive', name: 'Indecisive', icon: '\u{1F937}', desc: 'Your first feeling about a book was not your last.', req: 'Change your rating for a single book at least twice.', isSecret: false, isHidden: true },
        { id: 'hid_collectorTastes', name: 'Collector of Tastes', icon: '\u{1F3A8}', desc: 'Four feelings about four different books, at once.', req: 'Love, like, mixed, and dislike - all at once.', isSecret: false, isHidden: true },
        { id: 'hid_chameleonic', name: 'Chameleonic', icon: '\u{1F98E}', desc: 'You wore three different skins in one session.', req: 'Three themes in one session.', isSecret: false, isHidden: true },
        { id: 'hid_analyst', name: 'The Analyst', icon: '\u{1F50D}', desc: 'You waited until your shelf had something to say.', req: 'Write an in-depth review of over 500 words for a single book.', isSecret: false, isHidden: true },
        { id: 'hid_curiousOne', name: 'The Curious One', icon: '\u{1F575}\u{FE0F}', desc: 'You looked behind the curtain.', req: 'You found the Badge Collection.', isSecret: false, isHidden: true },
        { id: 'hid_messagePillar', name: 'Message in a Bottle', icon: '\u{1F4DC}', desc: 'You left something to find on the other side.', req: 'You sent a note timed for a milestone.', isSecret: false, isHidden: true },
        
        // TRULY HIDDEN
        { id: 'sec_nightOwl', name: 'Night Owl', icon: '\u{1F989}', desc: 'The library is quiet at this hour. You were here anyway.', req: 'Log a book after midnight.', isSecret: true, isHidden: true },
        { id: 'sec_earlyBird', name: 'Early Bird', icon: '\u{1F426}', desc: 'The sun is barely up, but the pages are turning.', req: 'Log a book between 4:00 AM and 6:00 AM.', isSecret: true, isHidden: true },
        { id: 'sec_trendsetter', name: 'Trendsetter', icon: '\u{1F525}', desc: 'You loved it before anyone else knew it existed.', req: 'Log a book before it has 100 ratings globally.', isSecret: true, isHidden: true },
        { id: 'sec_lateParty', name: 'Late to the Party', icon: '\u{1F422}', desc: 'Read a massive bestseller 10 years after everyone else.', req: 'Read a massive bestseller 10 years after everyone else.', isSecret: false, isHidden: false },
        
        // FUN / CASUAL
        { id: 'fun_globe', name: 'Globe Trotter', icon: '\u{1F30D}', desc: 'Read authors from 5 different continents in a single year.', req: 'Read authors from 5 different continents in a single year.', isSecret: false, isHidden: false },
        { id: 'fun_time', name: 'Time Traveler', icon: '\u{23F3}', desc: 'A book from before 1900, followed by a book from this year.', req: 'A book from before 1900, followed by a book from this year.', isSecret: false, isHidden: false },
        { id: 'fun_loyal', name: 'The Loyal Subject', icon: '\u{1F451}', desc: 'You reread the exact same book 5 times.', req: 'You reread the exact same book 5 times.', isSecret: false, isHidden: false },
        { id: 'fun_audio', name: 'Audio Speedster', icon: '\u{1F3A7}', desc: 'Finished a 20-hour audiobook in two days (we know you used 2x speed).', req: 'Finished a 20-hour audiobook in two days (we know you used 2x speed).', isSecret: true, isHidden: true },
        { id: 'fun_spooky', name: 'Spooky Season', icon: '\u{1F47B}', desc: 'Read a Horror book on October 31st.', req: 'Read a Horror book on October 31st.', isSecret: true, isHidden: true },
        { id: 'fun_holiday', name: 'Holiday Spirit', icon: '\u{1F384}', desc: 'Read a Winter/Holiday book in December.', req: 'Read a Winter/Holiday book in December.', isSecret: true, isHidden: true },
        { id: 'fun_weekendwarrior', name: 'Weekend Warrior', icon: '\u{26F1}\u{FE0F}', desc: 'Only logged reading sessions on Saturdays and Sundays for a whole month.', req: 'Only logged reading sessions on Saturdays and Sundays for a whole month.', isSecret: false, isHidden: false },
        { id: 'fun_nightmare', name: 'Completionist Nightmare', icon: '\u{1F631}', desc: 'Have 10 books currently \'In Progress\' at the exact same time.', req: 'Have 10 books currently \'In Progress\' at the exact same time.', isSecret: false, isHidden: false },

        // SOCIAL / COMMUNITY
        { id: 'soc_initiate', name: 'The Initiate', icon: '\u{1F91D}', desc: 'You stepped into the circle.', req: 'Join a book club.', isSecret: false, isHidden: false },
        { id: 'soc_orator', name: 'The Orator', icon: '\u{1F5E3}\u{FE0F}', desc: 'Your voice echoed in the hall.', req: 'Send a message in a club chat.', isSecret: false, isHidden: false },
        { id: 'soc_elector', name: 'The Elector', icon: '\u{1F5F3}\u{FE0F}', desc: 'You cast your stone for the journey ahead.', req: 'Vote on the next club pick.', isSecret: false, isHidden: false },
        { id: 'soc_airplane', name: 'Paper Airplane', icon: '\u{2708}\u{FE0F}', desc: 'You sent a thought across the void.', req: 'Send a note to a friend.', isSecret: false, isHidden: false },
        { id: 'soc_received', name: 'Message Received', icon: '\u{1F4EC}', desc: 'Someone reached out to find you.', req: 'Receive a note from a friend.', isSecret: false, isHidden: false },
        { id: 'soc_geneticist', name: 'Geneticist', icon: '\u{1F9EC}', desc: 'You decided who you want to become.', req: 'Shape your target DNA profile.', isSecret: false, isHidden: false },
        { id: 'soc_recruiter', name: 'The Recruiter', icon: '\u{1F4EF}', desc: 'You called others to the round table.', req: 'Invite someone to your book club.', isSecret: false, isHidden: false },
        { id: 'soc_founder', name: 'The Founder', icon: '\u{1F3DB}\u{FE0F}', desc: 'You laid the first stone of a new society.', req: 'Create a book club.', isSecret: false, isHidden: false },
        { id: 'soc_evangelist', name: 'The Evangelist', icon: '\u{1F54A}\u{FE0F}', desc: 'You opened the doors for a newcomer.', req: 'Invite a friend to join Note to Shelf.', isSecret: false, isHidden: false },
        { id: 'soc_tastemaker', name: 'The Tastemaker', icon: '\u{1F377}', desc: 'They listened to your wisdom.', req: 'Someone read a book you recommended to them via a note.', isSecret: false, isHidden: false },
        { id: 'soc_doppelganger', name: 'Doppelgänger', icon: '\u{1F46F}', desc: 'You looked in the mirror and saw a stranger.', req: 'Follow a reader with a 90%+ DNA match from the Discover tab.', isSecret: false, isHidden: false },
        { id: 'soc_socialite', name: 'The Socialite', icon: '\u{1F942}', desc: 'You danced in many circles at once.', req: 'Become an active member of 3 or more book clubs.', isSecret: false, isHidden: false },
        { id: 'soc_first_finish', name: 'First to the Finish', icon: '\u{1F3C1}', desc: 'You closed the final page before anyone else.', req: 'Finish a club\'s current pick before anyone else in the club.', isSecret: false, isHidden: false },
        { id: 'soc_pen_pal', name: 'The Pen Pal', icon: '\u{270D}\u{FE0F}', desc: 'A conversation written in the margins.', req: 'Exchange at least 5 notes back-and-forth with the same friend.', isSecret: false, isHidden: false },

        // READING TREE SUBTERRANEAN RELICS
        { id: 'tree_relic_seed', name: 'The Fossilized Folio Seed', icon: '🌱', desc: 'Unearthed from prehistoric amber at the roots of the Reading Tree.', req: 'Read 1 book milestone.', isSecret: false, isHidden: false },
        { id: 'tree_relic_nautilus', name: 'The Nautilus of Alexandria', icon: '🐚', desc: 'A clockwork cephalopod calculating reading cycles in golden ratio spirals.', req: 'Read 3 books milestone.', isSecret: false, isHidden: false },
        { id: 'tree_relic_astrolabe', name: 'The Nocturnal Astrolabe', icon: '🌌', desc: 'Bronze & lapis lazuli celestial navigation dial.', req: 'Read 6 books milestone.', isSecret: false, isHidden: false },
        { id: 'tree_relic_lantern', name: 'The Scriptorium Lantern', icon: '🏮', desc: '1 Book a month annual crown! Gothic quartz lantern blazing with trapped embers.', req: 'Read 12 books milestone (1 book a month).', isSecret: false, isHidden: false },
        { id: 'tree_relic_heart', name: 'The Clockwork Heart of Alexandria', icon: '🫀', desc: 'Crystalline carnelian heart pulsing in an armillary cage.', req: 'Read 24 books milestone (2 books a month).', isSecret: false, isHidden: false },
        { id: 'tree_relic_obelisk', name: 'The Sunken Obelisk of Babel', icon: '🏛️', desc: 'Tapered obsidian stele deeply buried in primeval basalt.', req: 'Read 36 books milestone (3 books a month).', isSecret: false, isHidden: false },
        { id: 'tree_relic_orrery', name: 'The Celestial Orrery of the Abyss', icon: '🪐', desc: 'Ultimate reading quest! Platinum planetary apparatus charting literary spheres.', req: 'Read 52 books milestone (1 book a week!).', isSecret: false, isHidden: false }
      ];
  },

  _computeReaderRank(finishedCount) {
    if (finishedCount >= 100) return { title: 'Legendary Bibliophile', level: 5, icon: '👑' };
    if (finishedCount >= 50) return { title: 'Literary Scholar', level: 4, icon: '🥇' };
    if (finishedCount >= 25) return { title: 'Master Reader', level: 3, icon: '🥈' };
    if (finishedCount >= 10) return { title: 'Dedicated Reader', level: 2, icon: '🥉' };
    return { title: 'Novice Explorer', level: 1, icon: '🌱' };
  },

    async _injectProfileAchievements(userId, containerId = 'pvTrophyStrip') {
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
          <div style="flex-shrink:0;width:56px;height:56px;border-radius:12px;background:linear-gradient(135deg, rgba(212,175,55,0.2), rgba(212,175,55,0.05));border:1px solid rgba(212,175,55,0.4);display:flex;align-items:center;justify-content:center;font-size:28px;box-shadow:0 4px 12px rgba(212,175,55,0.15), inset 0 1px 0 rgba(255,255,255,0.3);position:relative;cursor:pointer;" title="${this._escapeHtml(b.name)} - ${this._escapeHtml(b.desc)}" onclick="App.showToast(decodeURIComponent('${encodeURIComponent(b.name + ': ' + b.desc)}'))">
            ${b.icon}
          </div>
        `;
      }).join('');
      container.innerHTML = `<div style="font-weight:700;font-size:12px;color:var(--wood-dark);margin-bottom:8px;">Reader Rank &amp; Badges</div><div style="display:flex;gap:12px;overflow-x:auto;padding-bottom:8px;">${html}</div>`;
    } catch(e) {
      console.error(e);
      container.innerHTML = '';
    }
  },

  openTrophyRoom,
  showRelicDetailsModal,

  openSearchModal() {
    this.closeSlideMenu();
    this.openGlobalSearch();
  },

  async signOut() {
    this.closeSlideMenu();
    if (typeof Auth !== 'undefined' && typeof Auth.signOut === 'function') {
      await Auth.signOut();
    }
  },

  menuAction(action) {
    if (!action) return;
    switch (action) {
      case 'goals':
        this.openReadingGoalsModal();
        break;
      case 'notes':
        this.openMyNotes();
        break;
      case 'quotes':
        this.openAllQuotes();
        break;
      case 'wrapped':
        this.openYearInReview();
        break;
      case 'export':
        this.openExportModalFromMenu();
        break;
      case 'search':
        this.openSearchModal();
        break;
      case 'profile':
        this.openProfileSettings();
        break;
      case 'analytics':
        this.switchTab('analytics');
        break;
      case 'tree':
      case 'reading_tree':
      case 'readingTree':
        this.openReadingTree();
        break;
      case 'signout':
        this.signOut();
        break;
      default:
        console.warn('Unknown menuAction:', action);
    }
  },

  openYearInReview(year) {
    return this.openWrapped(year);
  },

  openAnalytics() {
    if (typeof this.closeSlideMenu === 'function') this.closeSlideMenu();
    window.open('analytics.html', '_blank');
  },

  openLaserOutput() {
    if (typeof this.closeSlideMenu === 'function') this.closeSlideMenu();
    window.open('laseroutput.html', '_blank');
  },

  openVibeCheck() {
    const candidates = (this.toReadBooks && this.toReadBooks.length)
      ? this.toReadBooks
      : (this.books || []).filter(b => b.status === 'to-read');
    if (!candidates || !candidates.length) {
      if (typeof this.showToast === 'function') {
        this.showToast('No books in your To-Read shelf! Add some to use Pick For Me.');
      }
      return;
    }

    const book = candidates[Math.floor(Math.random() * candidates.length)];
    let modal = document.getElementById('vibeCheckModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'vibeCheckModal';
      modal.className = 'modal-overlay';
      modal.onclick = (e) => { if (e.target === modal) this.closeModal('vibeCheckModal'); };
      document.body.appendChild(modal);
    }

    const coverHtml = book.coverUrl
      ? `<img src="${esc(book.coverUrl)}" style="width:110px;height:165px;object-fit:cover;border-radius:6px;box-shadow:0 8px 20px rgba(0,0,0,0.25);margin-bottom:12px;" onerror="this.style.display='none'">`
      : `<div style="width:110px;height:165px;background:rgba(61,43,31,0.08);display:flex;align-items:center;justify-content:center;font-size:36px;border-radius:6px;margin:0 auto 12px;">📖</div>`;

    modal.innerHTML = `
      <div class="modal-card" style="max-width:440px;width:90%;text-align:center;position:relative;background:var(--paper,#fdfbf7);color:var(--wood-dark,#2a1a10);padding:24px;border-radius:12px;">
        <button class="modal-close" onclick="App.closeModal('vibeCheckModal')" style="position:absolute;top:12px;right:12px;background:none;border:none;font-size:22px;cursor:pointer;color:var(--wood-dark);">&times;</button>
        <div style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--burgundy);margin-bottom:8px;">🎲 TBR Vibe Check</div>
        <h3 style="margin:0 0 12px;font-size:18px;line-height:1.3;">${esc(book.title || 'Untitled')}</h3>
        ${coverHtml}
        <div style="font-size:13px;color:var(--wood-mid);margin-bottom:6px;">By <strong>${esc(book.author || 'Unknown')}</strong></div>
        ${book.genre ? `<div style="font-size:11px;color:var(--wood-light);margin-bottom:12px;">${esc(book.genre)}</div>` : ''}
        ${book.toReadNotes ? `<div style="font-size:12px;font-style:italic;background:rgba(61,43,31,0.04);padding:8px 12px;border-radius:6px;margin-bottom:16px;color:var(--wood-dark);">"${esc(book.toReadNotes)}"</div>` : ''}
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:16px;">
          <button class="btn-primary" style="width:100%;padding:10px;" onclick="App.closeModal('vibeCheckModal');if(typeof App._markAsCurrentlyReading==='function'){App._markAsCurrentlyReading('${book.id}')}else if(typeof App.openEditModal==='function'){App.openEditModal(App._findBookById('${book.id}'))}">📖 Start Reading Now</button>
          <div style="display:flex;gap:8px;">
            <button class="btn-secondary" style="flex:1;padding:8px;" onclick="App.openVibeCheck()">🎲 Pick Another</button>
            <button class="btn-secondary" style="flex:1;padding:8px;" onclick="App.closeModal('vibeCheckModal')">Close</button>
          </div>
        </div>
      </div>
    `;

    this.openModal('vibeCheckModal');
  },

  _drawDNARadar(svgId = 'goalRadarSvg', books = []) {
    const el = document.getElementById(svgId);
    if (!el) return;
    el.innerHTML = this._generateRadarSvg(books.length ? books : (this.books || []), [], 100, true);
  },

  resetGalaxyZoom() {
    const el = document.getElementById('galaxyContainer');
    if (el) el.style.transform = '';
  },

  async _openReaderShelf(uid) {
    if (!uid) return;
    this._viewPublicShelf(uid);
  },

  closeReaderProfileModal() {
    this.closeModal('readerProfileModal');
  },

  async submitClubPick() {
    const titleInp = document.getElementById('clubPickManualTitle');
    const authorInp = document.getElementById('clubPickManualAuthor');
    const coverInp = document.getElementById('clubPickManualCover');
    const title = titleInp?.value.trim();
    const author = authorInp?.value.trim();
    const cover = coverInp?.value.trim();
    if (!title || !this._currentClub) return;
    await DB.setClubPick(this._currentClub, title, author, cover);
    this.showToast('Club pick updated!');
    this.closeModal('clubPickModal');
    if (typeof this.openClub === 'function') this.openClub(this._currentClub);
  },

  clearClubPickSelection() {
    const prev = document.getElementById('clubPickPreview');
    if (prev) prev.innerHTML = '';
    const titleInp = document.getElementById('clubPickManualTitle');
    if (titleInp) titleInp.value = '';
    const authorInp = document.getElementById('clubPickManualAuthor');
    if (authorInp) authorInp.value = '';
  },

  closeAggModal() {
    this.closeModal('aggModal');
  },

  openCurrentlyReadingModal() {
    if (typeof this.openModal === 'function') {
      this.openModal('addBookModal');
    } else if (typeof openModal === 'function') {
      openModal('addBookModal');
    }
    if (typeof this.selectAddStatus === 'function') {
      this.selectAddStatus('reading');
    }
  },

  // 6. Modal and UI Integration (DOM binding)
  openModal,
  closeModal,
  handleOverlayClick,
  showToast,
  openBookModal,
  closeBookModal,
  openInviteModal,
  closeInviteModal,
  toggleFabMenu,
  closeFabMenu,
  openAddBookModalFromMenu,
  toggleSlideMenu,
  closeSlideMenu,
  toggleGearMenu,
  toggleFilterPanel,
  closeShareMenu,
  rescueButtons,
  languageBadge,
  languageOptionsHTML
};

// Wire all modular feature capabilities into App
Object.assign(App, Splash, Search, Stats, Bookshelf, aggregateViewMethods);
App.SYMBOLS = SYMBOLS;

// Ensure hardened openCurrentlyReadingModal overrides any legacy Bookshelf binding
App.openCurrentlyReadingModal = function() {
  if (typeof this.openModal === 'function') {
    this.openModal('addBookModal');
  } else if (typeof openModal === 'function') {
    openModal('addBookModal');
  }
  if (typeof this.selectAddStatus === 'function') {
    this.selectAddStatus('reading');
  }
};

// Global Window Bridge
if (typeof window !== 'undefined') {
  window.APP_SYMBOLS = SYMBOLS;
  window.App = App;
  window.App.SYMBOLS = SYMBOLS;
  window.ALL_MONTHS = ALL_MONTHS;
  window.languageOptionsHTML = languageOptionsHTML;
  window.languageBadge = languageBadge;
  window.showToast = showToast;
  window.openModal = openModal;
  window.closeModal = closeModal;
  window.openTrophyRoom = openTrophyRoom;
  window.showRelicDetailsModal = showRelicDetailsModal;
  window.openBookModal = openBookModal;
  window.closeBookModal = closeBookModal;
  window.openInviteModal = openInviteModal;
  window.closeInviteModal = closeInviteModal;
  window.copyClubInviteLink = copyClubInviteLink;
  window.toggleFabMenu = toggleFabMenu;
  window.closeFabMenu = closeFabMenu;
  window.toggleSlideMenu = toggleSlideMenu;
  window.closeSlideMenu = closeSlideMenu;
  window.toggleGearMenu = toggleGearMenu;
  window.toggleFilterPanel = toggleFilterPanel;
  window.closeShareMenu = closeShareMenu;
  window.openPanel = openPanel;
  window.closePanel = closePanel;
  window.handleOverlayClick = handleOverlayClick;
  window.openCurrentlyReadingModal = () => (App && typeof App.openCurrentlyReadingModal === 'function' ? App.openCurrentlyReadingModal() : null);
  window.joinClub = (clubId) => (App && typeof App.joinClub === 'function' ? App.joinClub(clubId) : null);
  window.joinClubByCode = (code) => (App && typeof App.joinClubByCode === 'function' ? App.joinClubByCode(code) : null);
  window.joinPublicClub = (clubId) => (App && typeof App.joinPublicClub === 'function' ? App.joinPublicClub(clubId) : null);
  window.openClub = (clubId) => (App && typeof App.openClub === 'function' ? App.openClub(clubId) : null);
  window.openInviteModal = (clubId) => (App && typeof App.openInviteModal === 'function' ? App.openInviteModal(clubId) : null);
  window.renderClubs = () => (App && typeof App.renderClubs === 'function' ? App.renderClubs() : null);
  window.createClub = () => (App && typeof App.createClub === 'function' ? App.createClub() : null);
  window.submitCreateClub = () => (App && typeof App.submitCreateClub === 'function' ? App.submitCreateClub() : null);
  window.showCreateClubForm = () => (App && typeof App.showCreateClubForm === 'function' ? App.showCreateClubForm() : null);
  window.setMultiYearRange = (range) => (App && typeof App.setMultiYearRange === 'function' ? App.setMultiYearRange(range) : null);
  window.toggleMultiYearMenu = () => (App && typeof App.toggleMultiYearMenu === 'function' ? App.toggleMultiYearMenu() : null);
}

export default App;


if (typeof window !== 'undefined') {
  window.openReadingTree = () => { if (window.App && typeof window.App.openReadingTree === 'function') window.App.openReadingTree(); };

  // Live Reading Tree postMessage Bridge
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'REQUEST_TREE_DATA') {
      const yr = event.data.year || (window.App && window.App.currentYear);
      const data = window.App && typeof window.App.getReadingTreeData === 'function'
        ? window.App.getReadingTreeData(yr)
        : null;
      if (event.source && typeof event.source.postMessage === 'function') {
        event.source.postMessage({ type: 'TREE_DATA', data }, '*');
      }
    }
  });
}
