/**
 * ShelfLife - Core Constants and Configuration
 * 
 * Centralized constant definitions extracted from main.js.
 * Provides color palettes, taxonomy, key mappings, auth keys, and geometry constants.
 */

// ==========================================
// 1. Supabase & API Configuration
// ==========================================
export const SUPABASE_URL = 'https://guqkidwlkslhkoictfay.supabase.co';

export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1cWtpZHdsa3NsaGtvaWN0ZmF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0Mzk3MDQsImV4cCI6MjA5NDAxNTcwNH0.YM5JO2om8VGnplODzr-D2zGjcaVbkCw2T3DDjNAPtAk';

export const ADMIN_USER_ID = 'eae3ea25-9539-42ac-9e19-82039130c25f';
export const ADMIN_EMAILS = ['mike.warren.maker@gmail.com'];

export function isAppAdmin(appInstance) {
  const app = appInstance || (typeof window !== 'undefined' ? window.App : null);
  if (!app) return false;
  if (app.isReadOnly || app.isDemoMode) return false;

  const uid = app.userId || (typeof window !== 'undefined' && window.Auth?.user?.id);
  const email = (app.userEmail || (typeof window !== 'undefined' && window.Auth?.user?.email) || '').toLowerCase().trim();

  return uid === ADMIN_USER_ID || email === 'mike.warren.maker@gmail.com' || ADMIN_EMAILS.includes(email);
}

export const ANALYTICS_SECRET_KEY = '123';

// Public VAPID key - used for web-push push notifications
export const VAPID_PUBLIC_KEY = 'BJA-lFXj1-CGn2EzdU6yrax3_uvHhqglQE-1cCkKNxjznU8WZY-UZoDkNkyNexZ9K5QrT1edlCOAEtoUkx5D-gg';


// ==========================================
// 2. Sentiments, Colors & Visual Assets
// ==========================================
export const COLORS = {
  love: '#1c3f78',
  like: '#1e5c3a',
  mixed: '#c89018',
  dislike: '#8c1a28',
  placeholder: '#c4b9aa'
};

export const LABELS = {
  love: 'Loved',
  like: 'Liked',
  mixed: 'Mixed',
  dislike: 'Disliked'
};

export const SENT_EMOJI = {
  dislike: '😞',
  mixed: '😐',
  like: '👍',
  love: '❤️'
};

export const SENT_ORDER = ['dislike', 'mixed', 'like', 'love'];

// Royal "Book of the Year" crown - gold gradient, jewels. Shared gradient id 'cg'
export const CROWN_SVG = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0b8"/><stop offset="0.45" stop-color="#f5c542"/><stop offset="1" stop-color="#d08f12"/></linearGradient></defs><path d="M4.4 18.6 L2.7 8.2 L8 13 L12 4.8 L16 13 L21.3 8.2 L19.6 18.6 Z" fill="url(#cg)" stroke="#a06c08" stroke-width="0.7" stroke-linejoin="round"/><rect x="4.4" y="18.4" width="15.2" height="2.8" rx="0.8" fill="url(#cg)" stroke="#a06c08" stroke-width="0.7"/><circle cx="2.9" cy="8" r="1.5" fill="#fff6d6" stroke="#a06c08" stroke-width="0.5"/><circle cx="12" cy="4.6" r="1.7" fill="#ff6470" stroke="#a06c08" stroke-width="0.5"/><circle cx="21.1" cy="8" r="1.5" fill="#fff6d6" stroke="#a06c08" stroke-width="0.5"/></svg>`;

export const GENRE_COLORS = {
  'Crime/Detective': '#0F6E56',
  'Sci-Fi': '#534AB7',
  'General Fiction': '#993C1D',
  'Non-Fiction': '#854F0B',
  'Romance': '#D1495B',
  'War/Military': '#3D5A80'
};

export const SVARS = {
  love: ['#1c3f78', '#163370', '#203d80', '#122b68', '#1c3f78', '#1a3a75', '#214285'],
  like: ['#1e5c3a', '#195033', '#224e3c', '#163e2c', '#1e5c3a', '#1c5437', '#215840'],
  mixed: ['#c89018', '#b88214', '#d49c1e', '#a87410', '#c89018', '#cc9418', '#be8a14'],
  dislike: ['#8c1a28', '#7e1622', '#98202e', '#701420', '#8c1a28', '#941e2c', '#801824']
};

export const sColor = (s, i) => (SVARS[s] ? SVARS[s][(Number(i) || 0) % 7] : '#c4b9aa');


// ==========================================
// 3. Calendar, Months & Quarters
// ==========================================
export const ALL_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const QUARTER_MAP = {
  Q1: ['January', 'February', 'March'],
  Q2: ['April', 'May', 'June'],
  Q3: ['July', 'August', 'September'],
  Q4: ['October', 'November', 'December']
};

export const MONTH_TO_QUARTER = {};
ALL_MONTHS.forEach((m, i) => {
  MONTH_TO_QUARTER[m] = 'Q' + (Math.floor(i / 3) + 1);
});

export const QUARTER_PALETTE = {
  Q1: { h: 258, s: 40 },
  Q2: { h: 150, s: 38 },
  Q3: { h: 18,  s: 62 },
  Q4: { h: 42,  s: 60 }
};


// ==========================================
// 4. Mood Taxonomy & Mappings
// ==========================================
export const MOOD_CATEGORIES = {
  'Vibe': ['Dark', 'Gritty', 'Cozy', 'Tense', 'Hopeful', 'Heartwarming', 'Funny', 'Atmospheric', 'Melancholy'],
  'Pacing & Style': ['Fast-paced', 'Slow burn', 'Plot-driven', 'Character-driven', 'Lyrical', 'Unreliable narrator', 'Short chapters'],
  'Tropes': ['Space opera', 'Crime', 'Heist', 'Noir', 'Thriller', 'Horror', 'Dystopian', 'Western', 'Coming-of-age', 'Satire'],
  'Topic': ['Friendship', 'Family', 'Identity', 'Grief', 'Power', 'Survival', 'Nature', 'Love']
};

export const MOOD_CATEGORY_DESC = {
  'Vibe': 'How it felt',
  'Pacing & Style': 'How it reads',
  'Tropes': 'Genre flavor',
  'Topic': "What it's about"
};

export const MOOD_PRESETS = Object.values(MOOD_CATEGORIES).flat();

export const MOOD_TO_CATEGORY = {};
Object.entries(MOOD_CATEGORIES).forEach(([cat, list]) => {
  list.forEach(m => {
    MOOD_TO_CATEGORY[m] = cat;
  });
});

export const MOOD_SUGGEST_MAP = {
  'General Fiction': ['Character-driven', 'Atmospheric', 'Family'],
  'Literary Fiction': ['Lyrical', 'Identity', 'Melancholy', 'Character-driven'],
  'Crime/Detective': ['Crime', 'Noir', 'Gritty', 'Tense'],
  'Mystery': ['Tense', 'Crime', 'Atmospheric'],
  'Thriller': ['Thriller', 'Tense', 'Fast-paced'],
  'Horror': ['Horror', 'Dark', 'Atmospheric'],
  'Science Fiction': ['Space opera', 'Fast-paced', 'Power'],
  'Fantasy': ['Atmospheric', 'Dark', 'Power'],
  'Romance': ['Love', 'Heartwarming', 'Slow burn'],
  'Historical Fiction': ['Atmospheric', 'Family', 'Survival'],
  'Adventure': ['Fast-paced', 'Survival', 'Heist'],
  'Humor': ['Funny', 'Satire'],
  'Non-Fiction': ['Identity', 'Nature', 'Power'],
  'Biography': ['Identity', 'Grief', 'Family'],
  'Self-Help': ['Hopeful', 'Identity'],
  'Memoir': ['Identity', 'Grief', 'Family'],
  'Young Adult': ['Coming-of-age', 'Identity', 'Hopeful'],
  'Poetry': ['Lyrical', 'Melancholy', 'Nature'],
  'True Crime': ['Crime', 'Noir', 'Tense'],
  'Dystopian': ['Dystopian', 'Dark', 'Survival'],
  'Children': ['Cozy', 'Funny', 'Friendship']
};

export const MOOD_SENT_BOOST = {
  'love': ['Heartwarming', 'Hopeful', 'Atmospheric'],
  'like': ['Cozy', 'Hopeful', 'Fast-paced'],
  'mixed': ['Character-driven', 'Tense', 'Slow burn'],
  'dislike': ['Dark', 'Melancholy', 'Gritty']
};


// ==========================================
// 5. Languages & Flags
// ==========================================
export const LANGUAGES = [
  'English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese',
  'Dutch', 'Russian', 'Japanese', 'Chinese', 'Korean', 'Arabic',
  'Hindi', 'Bengali', 'Turkish', 'Polish', 'Swedish', 'Norwegian',
  'Danish', 'Finnish', 'Greek', 'Hebrew', 'Czech', 'Hungarian',
  'Romanian', 'Ukrainian', 'Vietnamese', 'Thai', 'Indonesian', 'Other'
];

export const LANGUAGE_FLAGS = {
  English: '🇺🇸',
  Spanish: '🇪🇸',
  French: '🇫🇷',
  German: '🇩🇪',
  Italian: '🇮🇹',
  Portuguese: '🇵🇹',
  Dutch: '🇳🇱',
  Russian: '🇷🇺',
  Japanese: '🇯🇵',
  Chinese: '🇨🇳',
  Korean: '🇰🇷',
  Arabic: '🇸🇦'
};


// ==========================================
// 6. Word Count Calculation Constants
// ==========================================
export const WORDS_PER_PAGE = 300;

export const DEFAULT_IMPORT_WORDS = 100000;

export const ESTIMATED_WC_TOOLTIP = 'Estimated word count';


// ==========================================
// 7. Bookmark Ribbon Geometry
// ==========================================
export const BM_H = 26;

export const BM_TOP = Math.round((48 - BM_H) / 2);

export const BM_NOTCH = 9;

export const LABEL_GAP = 12;

export const BM_OUTLINE = 'drop-shadow(0.9px 0 0 #fffdf8) drop-shadow(-0.9px 0 0 #fffdf8) drop-shadow(0 0.9px 0 #fffdf8) drop-shadow(0 -0.9px 0 #fffdf8) drop-shadow(0.7px 0.7px 0 #fffdf8) drop-shadow(-0.7px 0.7px 0 #fffdf8) drop-shadow(0.7px -0.7px 0 #fffdf8) drop-shadow(-0.7px -0.7px 0 #fffdf8) drop-shadow(0 2px 3px rgba(0,0,0,0.28))';


// ==========================================
// 8. Achievements Definition & Metadata
// ==========================================
export const ACHIEVEMENTS = {
    // PROGRESSION - Volumes
    vol_1: { name: 'Novice Reader', cat: 'progression', icon: '\u{1F4D6}', flavor: 'Log your first finished book.', clue: 'Every great library begins with a single spine.', hidden: false, secret: false },
    vol_10: { name: 'Bookworm', cat: 'progression', icon: '\u{1F41B}', flavor: 'Log 10 finished books.', clue: 'The habit has taken hold. There\'s no going back.', hidden: false, secret: false },
    vol_25: { name: 'Bibliophile', cat: 'progression', icon: '\u{1F4DA}', flavor: 'Log 25 finished books.', clue: 'Your shelf tells a story of its own now.', hidden: false, secret: false },
    vol_100: { name: 'The Archive', cat: 'progression', icon: '\u{1F3DB}\u{FE0F}', flavor: 'Log 100 finished books.', clue: 'A century of stories. Most people only dream of this.', hidden: false, secret: false },

    // PROGRESSION - Word Count
    words_100k: { name: 'Prologue', cat: 'progression', icon: '\u{2712}\u{FE0F}', flavor: 'You\'ve read a whole novel\'s worth of words. The journey begins.', hidden: false, secret: false },
    words_500k: { name: 'Novelist', cat: 'progression', icon: '\u{1F58B}\u{FE0F}', flavor: 'Half a million words. Enough to have written a trilogy yourself.', hidden: false, secret: false },
    words_1m: { name: 'Millionaire', cat: 'progression', icon: '\u{1F4B8}', flavor: 'One million words. A rare club. Welcome.', hidden: false, secret: false },
    words_5m: { name: 'Epic of Gilgamesh', cat: 'progression', icon: '\u{1F3DC}\u{FE0F}', flavor: 'The oldest story ever written is 3,000 words. You\'ve read this 1,666 times over.', hidden: false, secret: false },
    words_7m: { name: 'Scheherazade', cat: 'progression', icon: '\u{1F483}', flavor: 'She told a story every night to stay alive. You read for the same reason.', hidden: false, secret: false },
    words_9m: { name: 'The Library of Babel', cat: 'progression', icon: '\u{1F3E2}', flavor: 'Borges imagined a library containing every possible book. You\'re building your own.', hidden: false, secret: false },
    words_10m: { name: 'The Word Hoard', cat: 'progression', icon: '\u{1F4DD}', flavor: 'The Old English term for a treasury of language. You have earned it.', hidden: false, secret: false },
    words_15m: { name: 'The Archivist', cat: 'progression', icon: '\u{1F5C4}\u{FE0F}', flavor: '15 million words. A true curator of history.', hidden: false, secret: false },
    words_25m: { name: 'The Scholar', cat: 'progression', icon: '\u{1F393}', flavor: '25 million words. Your mind is a library.', hidden: false, secret: false },

    // HIDDEN (Not secret, but requirements obscured until earned)
    hid_changedMind: { name: 'Change of Heart', cat: 'hidden', icon: '\u{1F494}', flavor: 'You changed a 5-star to a 2-star (or worse).', clue: 'You loved it, until you thought about it.', hidden: true, secret: false },
    hid_noRegrets: { name: 'No Regrets', cat: 'hidden', icon: '\u{1F6B6}', flavor: 'You abandoned a book and never looked back.', clue: 'Sometimes the bravest thing is to walk away.', hidden: true, secret: false },
    hid_secondChance: { name: 'Second Chance', cat: 'hidden', icon: '\u{1F504}', flavor: 'You picked up an abandoned book again.', clue: 'Time changes all things, even readers.', hidden: true, secret: false },
    hid_timeCapsule: { name: 'Time Capsule', cat: 'hidden', icon: '\u{23F3}', flavor: 'You read a book from a decade you haven\'t visited before.', clue: 'You opened a door to a time you did not know.', hidden: true, secret: false },
    hid_echoes: { name: 'Echoes', cat: 'hidden', icon: '\u{1F5E3}\u{FE0F}', flavor: 'You read three books from the same author in a row.', clue: 'A familiar voice spoke to you three times.', hidden: true, secret: false },
    hid_infiniteLoop: { name: 'Infinite Loop', cat: 'hidden', icon: '\u{267E}\u{FE0F}', flavor: 'You reread a book you already finished.', clue: 'You returned to a place you already knew.', hidden: true, secret: false },
    hid_balanced: { name: 'Perfectly Balanced', cat: 'hidden', icon: '\u{2696}\u{FE0F}', flavor: 'An equal number of fiction and non-fiction.', clue: 'Truth and imagination, in equal measure.', hidden: true, secret: false },
    hid_dedicatedFan: { name: 'Dedicated Fan', cat: 'hidden', icon: '\u{1F3AF}', flavor: '5 books in a row from the same genre.', clue: 'You stayed in one world for a long time.', hidden: true, secret: false },
    hid_busyBee: { name: 'Busiest Bee', cat: 'hidden', icon: '\u{1F41D}', flavor: '5 books in a single month.', clue: 'One month contained more books than most years.', hidden: true, secret: false },
    hid_indecisive: { name: 'Indecisive', cat: 'hidden', icon: '\u{1F937}', flavor: 'Your first feeling about a book was not your last.', clue: 'Your first feeling wasn\'t your final one.', hidden: true, secret: false },
    hid_collectorTastes: { name: 'Collector of Tastes', cat: 'hidden', icon: '\u{1F3A8}', flavor: 'Love, like, mixed, and dislike - all at once.', clue: 'Four feelings about four different books, at once.', hidden: true, secret: false },
    hid_chameleonic: { name: 'Chameleonic', cat: 'hidden', icon: '\u{1F98E}', flavor: 'Three themes in one session.', clue: 'You wore three different skins in one session.', hidden: true, secret: false },
    hid_analyst: { name: 'The Analyst', cat: 'hidden', icon: '\u{1F50D}', flavor: 'A shelf with something to say.', clue: 'You waited until your shelf had something to say.', hidden: true, secret: false },
    hid_curiousOne: { name: 'The Curious One', cat: 'hidden', icon: '\u{1F575}\u{FE0F}', flavor: 'You found the Badge Collection.', clue: 'You looked behind the curtain.', hidden: true, secret: false },
    hid_messagePillar: { name: 'Message in a Bottle', cat: 'hidden', icon: '\u{1F4DC}', flavor: 'You sent a note timed for a milestone.', clue: 'You left something to find on the other side.', hidden: true, secret: false },

    // TRULY HIDDEN
    sec_nightOwl: { name: 'Night Owl', cat: 'hidden', icon: '\u{1F989}', flavor: 'The library is quiet at this hour. You were here anyway.', clue: '', hidden: true, secret: true },
    sec_earlyBird: { name: 'Early Bird', cat: 'hidden', icon: '\u{1F426}', flavor: 'The sun is barely up, but the pages are turning.', clue: '', hidden: true, secret: true },
    sec_trendsetter: { name: 'Trendsetter', cat: 'hidden', icon: '\u{1F525}', flavor: 'You loved it before anyone else knew it existed.', clue: '', hidden: true, secret: true },
    sec_lateParty: { name: 'Late to the Party', cat: 'hidden', icon: '\u{1F422}', flavor: 'Read a massive bestseller 10 years after everyone else.', clue: '', hidden: true, secret: true },

    // FUN / CASUAL
    fun_globe: { name: 'Globe Trotter', cat: 'fun', icon: '\u{1F30D}', flavor: 'Read authors from 5 different continents in a single year.', clue: '', hidden: false, secret: false },
    fun_time: { name: 'Time Traveler', cat: 'fun', icon: '\u{23F3}', flavor: 'A book from before 1900, followed by a book from this year.', clue: '', hidden: false, secret: false },
    fun_loyal: { name: 'The Loyal Subject', cat: 'fun', icon: '\u{1F451}', flavor: 'You reread the exact same book 5 times.', clue: '', hidden: false, secret: false },
    fun_audio: { name: 'Audio Speedster', cat: 'fun', icon: '\u{1F3A7}', flavor: 'Finished a 20-hour audiobook in two days (we know you used 2x speed).', clue: '', hidden: true, secret: true },
    fun_spooky: { name: 'Spooky Season', cat: 'fun', icon: '\u{1F47B}', flavor: 'Read a Horror book on October 31st.', clue: '', hidden: true, secret: true },
    fun_holiday: { name: 'Holiday Spirit', cat: 'fun', icon: '\u{1F384}', flavor: 'Read a Winter/Holiday book in December.', clue: '', hidden: true, secret: true },
    fun_weekendwarrior: { name: 'Weekend Warrior', cat: 'fun', icon: '\u{26F1}\u{FE0F}', flavor: 'Only logged reading sessions on Saturdays and Sundays for a whole month.', clue: '', hidden: false, secret: false },
    fun_nightmare: { name: 'Completionist Nightmare', cat: 'fun', icon: '\u{1F631}', flavor: 'Have 10 books currently \'In Progress\' at the exact same time.', clue: '', hidden: false, secret: false },

    // SOCIAL / COMMUNITY
    soc_initiate: { name: 'The Initiate', cat: 'social', icon: '\u{1F91D}', flavor: 'Join a book club.', clue: 'You stepped into the circle.', hidden: false, secret: false },
    soc_orator: { name: 'The Orator', cat: 'social', icon: '\u{1F5E3}\u{FE0F}', flavor: 'Send a message in a club chat.', clue: 'Your voice echoed in the hall.', hidden: false, secret: false },
    soc_elector: { name: 'The Elector', cat: 'social', icon: '\u{1F5F3}\u{FE0F}', flavor: 'Vote on the next club pick.', clue: 'You cast your stone for the journey ahead.', hidden: false, secret: false },
    soc_airplane: { name: 'Paper Airplane', cat: 'social', icon: '\u{2708}\u{FE0F}', flavor: 'Send a note to a friend.', clue: 'You sent a thought across the void.', hidden: false, secret: false },
    soc_received: { name: 'Message Received', cat: 'social', icon: '\u{1F4EC}', flavor: 'Receive a note from a friend.', clue: 'Someone reached out to find you.', hidden: false, secret: false },
    soc_geneticist: { name: 'Geneticist', cat: 'social', icon: '\u{1F9EC}', flavor: 'Shape your target DNA profile.', clue: 'You decided who you want to become.', hidden: false, secret: false },
    soc_recruiter: { name: 'The Recruiter', cat: 'social', icon: '\u{1F4EF}', flavor: 'Invite someone to your book club.', clue: 'You called others to the round table.', hidden: false, secret: false },
    soc_founder: { name: 'The Founder', cat: 'social', icon: '\u{1F3DB}\u{FE0F}', flavor: 'Create a book club.', clue: 'You laid the first stone of a new society.', hidden: false, secret: false },
    soc_evangelist: { name: 'The Evangelist', cat: 'social', icon: '\u{1F54A}\u{FE0F}', flavor: 'Invite a friend to join Note to Shelf.', clue: 'You opened the doors for a newcomer.', hidden: false, secret: false },
    soc_tastemaker: { name: 'The Tastemaker', cat: 'social', icon: '\u{1F377}', flavor: 'Someone read a book you recommended to them via a note.', clue: 'They listened to your wisdom.', hidden: false, secret: false },
    soc_doppelganger: { name: 'Doppelgänger', cat: 'social', icon: '\u{1F46F}', flavor: 'Follow a reader with a 90%+ DNA match from the Discover tab.', clue: 'You looked in the mirror and saw a stranger.', hidden: false, secret: false },
    soc_socialite: { name: 'The Socialite', cat: 'social', icon: '\u{1F942}', flavor: 'Become an active member of 3 or more book clubs.', clue: 'You danced in many circles at once.', hidden: false, secret: false },
    soc_first_finish: { name: 'First to the Finish', cat: 'social', icon: '\u{1F3C1}', flavor: 'Finish a club\'s current pick before anyone else in the club.', clue: 'You closed the final page before anyone else.', hidden: false, secret: false },
    soc_pen_pal: { name: 'The Pen Pal', cat: 'social', icon: '\u{270D}\u{FE0F}', flavor: 'Exchange at least 5 notes back-and-forth with the same friend.', clue: 'A conversation written in the margins.', hidden: false, secret: false },

    // READING TREE SUBTERRANEAN RELICS
    tree_relic_seed: { name: 'The Fossilized Folio Seed', cat: 'relics', icon: '🌱', flavor: '1 Book Milestone. Unearthed from prehistoric amber near the taproot of the Reading Tree.', clue: 'Read your first book of the year.', hidden: false, secret: false },
    tree_relic_nautilus: { name: 'The Nautilus of Alexandria', cat: 'relics', icon: '🐚', flavor: '3 Books Milestone. A clockwork cephalopod calculating reading cycles in golden ratio spirals.', clue: 'Read 3 books in a single year.', hidden: false, secret: false },
    tree_relic_astrolabe: { name: 'The Nocturnal Astrolabe', cat: 'relics', icon: '🌌', flavor: '6 Books Milestone. A bronze and lapis lazuli celestial navigation dial.', clue: 'Read 6 books in a single year.', hidden: false, secret: false },
    tree_relic_lantern: { name: 'The Scriptorium Lantern', cat: 'relics', icon: '🏮', flavor: '12 Books Milestone (1 Book a Month!). Gothic quartz lantern blazing with trapped embers.', clue: 'Read 12 books in a single year (1 book a month).', hidden: false, secret: false },
    tree_relic_heart: { name: 'The Clockwork Heart of Alexandria', cat: 'relics', icon: '🫀', flavor: '24 Books Milestone (2 Books a Month). Crystalline carnelian heart pulsing in an armillary cage.', clue: 'Read 24 books in a single year (2 books a month).', hidden: false, secret: false },
    tree_relic_obelisk: { name: 'The Sunken Obelisk of Babel', cat: 'relics', icon: '🏛️', flavor: '36 Books Milestone (3 Books a Month). Tapered obsidian stele deeply buried in primeval basalt.', clue: 'Read 36 books in a single year (3 books a month).', hidden: false, secret: false },
    tree_relic_orrery: { name: 'The Celestial Orrery of the Abyss', cat: 'relics', icon: '🪐', flavor: '52 Books Milestone (1 Book a Week!). Platinum planetary apparatus charting literary spheres.', clue: 'Achieve 52 books in a single year (1 book a week).', hidden: false, secret: false }
};

export const KNOWN_ACHIEVEMENT_COUNT = Object.values(ACHIEVEMENTS).filter(function(a) { return !a.secret; }).length;


// ==========================================
// 9. Demographic & Author Metadata
// ==========================================
export const NAME_GENDER_DB = (() => {
  const male = ['james','john','robert','michael','william','david','richard','joseph','thomas','charles','christopher','daniel','matthew','anthony','mark','donald','steven','paul','andrew','joshua','kenneth','kevin','brian','george','timothy','ronald','edward','jason','jeffrey','ryan','jacob','gary','nicholas','eric','jonathan','stephen','larry','justin','scott','brandon','benjamin','samuel','gregory','frank','alexander','raymond','patrick','jack','dennis','jerry','tyler','aaron','jose','henry','adam','douglas','nathan','peter','zachary','kyle','walter','harold','jeremy','ethan','carl','keith','roger','gerald','arthur','terry','sean','christian','austin','noah','jesse','joe','bryan','billy','jordan','albert','dylan','bruce','willie','gabriel','alan','juan','logan','wayne','ralph','roy','eugene','randy','vincent','russell','louis','philip','bobby','johnny','bradley','martin','simon','oliver','harry','liam','mason','elijah','lucas','jackson','aiden','owen','samesh','dev','raj','rahul','amit','sanjay','vijay','arjun','rohan','karan','aditya','vikram','anil','sunil','ahmed','mohammed','ali','omar','hassan','ibrahim','khaled','youssef','mustafa','tariq','hiroshi','takeshi','kenji','akira','yuki','haruki','satoshi','daiki','ren','wei','jun','ming','hao','feng','lei','chen','yang','seojun','minjun','jihoon','dong','sang','ivan','dmitri','vladimir','sergei','alexei','nikolai','mikhail','andrei','pavel','boris','viktor','lars','erik','sven','bjorn','magnus','olaf','nils','gustav','klaus','hans','jurgen','dieter','wolfgang','helmut','franz','heinrich','giovanni','giuseppe','marco','luca','matteo','francesco','andrea','antonio','salvatore','pietro','paolo','jean','pierre','michel','philippe','alain','bernard','laurent','olivier','thierry','nicolas','sebastien','carlos','luis','miguel','jorge','francisco','alejandro','manuel','pedro','diego','pablo','javier','fernando','sergio','eduardo','ricardo','rafael','kwame','kofi','chidi','emeka','tunde','sipho','thabo','seamus','liam','cian','eoin','declan','niall','padraig'];
  const female = ['mary','patricia','jennifer','linda','elizabeth','barbara','susan','jessica','sarah','karen','nancy','lisa','margaret','betty','sandra','ashley','dorothy','kimberly','emily','donna','michelle','carol','amanda','melissa','deborah','stephanie','rebecca','laura','sharon','cynthia','kathleen','helen','amy','shirley','angela','anna','brenda','pamela','nicole','ruth','katherine','samantha','christine','emma','catherine','debra','virginia','rachel','carolyn','janet','maria','heather','diane','julie','joyce','victoria','kelly','christina','joan','evelyn','olivia','judith','megan','cheryl','andrea','hannah','martha','jacqueline','frances','gloria','ann','teresa','kathryn','sophia','grace','charlotte','amelia','isabella','ava','mia','abigail','ella','chloe','lily','zoe','natalie','alice','sophie','lucy','freya','priya','anjali','divya','pooja','neha','kavya','meera','aishwarya','deepika','sunita','lakshmi','fatima','aisha','zainab','maryam','layla','noor','yasmin','amina','khadija','huda','yuki','sakura','hana','aiko','keiko','yoko','mei','xiu','ling','yan','fang','jing','hui','min','seoyeon','jiwoo','hyejin','soo','eun','olga','natasha','svetlana','tatiana','irina','elena','anastasia','katarina','ingrid','astrid','greta','helga','ursula','sofia','giulia','francesca','chiara','valentina','alessia','martina','marie','sophie','camille','julie','celine','isabelle','nathalie','sandrine','carmen','isabel','rosa','lucia','elena','cristina','ana','beatriz','pilar','amara','ama','adaeze','folake','nomvula','thandiwe','aoife','siobhan','niamh','sinead','orla','roisin','clodagh'];
  const ambiguous = new Set(['andrea','jean','yuki','ren','jun','min','sang','dong','wei','hui','yan','lei','hao','feng','jing','ming','chen','yang','soo','eun','mei','ling','jordan','jesse','noor']);
  const db = {};
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z]/g,'');
  male.forEach(n => { const k = norm(n); if (!ambiguous.has(k)) db[k] = 'Male'; });
  female.forEach(n => { const k = norm(n); if (!ambiguous.has(k) && !db[k]) db[k] = 'Female'; });
  return db;
})();

export const DEMO_AUTHOR_GENDERS = {
  'Haruki Murakami': { gender: 'Male', confidence: 0.99 },
  'Machado de Assis': { gender: 'Male', confidence: 0.99 },
  'Chinua Achebe': { gender: 'Male', confidence: 0.99 },
  'Arundhati Roy': { gender: 'Female', confidence: 0.99 },
  'Keith & Kent Zimmerman': { gender: 'Male', confidence: 0.85 },
  'Chuck Palahniuk': { gender: 'Male', confidence: 0.97 },
  'Michael Connelly': { gender: 'Male', confidence: 0.99 },
  'John Scalzi': { gender: 'Male', confidence: 0.98 },
  'Ed Willes': { gender: 'Male', confidence: 0.88 },
  'Jonathan Kellerman': { gender: 'Male', confidence: 0.97 },
  'Jonas Jonasson': { gender: 'Male', confidence: 0.95 },
  'James McBride': { gender: 'Male', confidence: 0.99 },
  'Henning Mankell': { gender: 'Male', confidence: 0.93 },
  'Steven Rowley': { gender: 'Male', confidence: 0.96 },
  'John Sandford': { gender: 'Male', confidence: 0.99 },
  'Meg Shaffer': { gender: 'Female', confidence: 0.96 },
  'Cory Doctorow': { gender: 'Male', confidence: 0.88 },
  'Timothy Egan': { gender: 'Male', confidence: 0.94 },
  'Marisha Pessl': { gender: 'Female', confidence: 0.91 },
  'Skyler Ramirez': { gender: 'Male', confidence: 0.72 },
  'Matt Dinniman': { gender: 'Male', confidence: 0.93 },
  'Shelby Van Pelt': { gender: 'Female', confidence: 0.87 },
  'James S.A. Corey': { gender: 'Male', confidence: 0.99 },
  'Elena Ferrante': { gender: 'Female', confidence: 0.95 },
  'Richard Osman': { gender: 'Male', confidence: 0.98 },
  'Blake Crouch': { gender: 'Male', confidence: 0.95 },
  'Elaine N. Aron': { gender: 'Female', confidence: 0.98 },
  'Linda Grant': { gender: 'Female', confidence: 0.96 },
  'Paula Hawkins': { gender: 'Female', confidence: 0.99 },
  'Richard K. Morgan': { gender: 'Male', confidence: 0.99 },
  'Lewis Dartnell': { gender: 'Male', confidence: 0.86 },
  'Andy Weir': { gender: 'Male', confidence: 0.95 },
  'Han Kang': { gender: 'Female', confidence: 0.99 },
  'Gerald M. Kilby': { gender: 'Male', confidence: 0.92 },
  'Freida McFadden': { gender: 'Female', confidence: 0.97 },
  'Ian Rankin': { gender: 'Male', confidence: 0.97 },
  'Robert Crais': { gender: 'Male', confidence: 0.99 },
  'Erik Larson': { gender: 'Male', confidence: 0.95 },
  'Douglas Adams': { gender: 'Male', confidence: 0.99 },
  'Michelle Obama': { gender: 'Female', confidence: 0.99 },
  'Tara Westover': { gender: 'Female', confidence: 0.97 },
  'Patrick Rothfuss': { gender: 'Male', confidence: 0.95 }
};

export const DEMO_AUTHOR_REGIONS_V2 = {
  'Haruki Murakami': { region: 'Asia', country: 'Japan' },
  'Machado de Assis': { region: 'Latin America', country: 'Brazil' },
  'Chinua Achebe': { region: 'Africa', country: 'Nigeria' },
  'Arundhati Roy': { region: 'Asia', country: 'India' },
  'Keith & Kent Zimmerman': { region: 'USA', country: 'United States' },
  'Chuck Palahniuk': { region: 'USA', country: 'United States' },
  'Michael Connelly': { region: 'USA', country: 'United States' },
  'John Scalzi': { region: 'USA', country: 'United States' },
  'Ed Willes': { region: 'Canada', country: 'Canada' },
  'Jonathan Kellerman': { region: 'USA', country: 'United States' },
  'Jonas Jonasson': { region: 'Europe', country: 'Sweden' },
  'James McBride': { region: 'USA', country: 'United States' },
  'Henning Mankell': { region: 'Europe', country: 'Sweden' },
  'Steven Rowley': { region: 'USA', country: 'United States' },
  'John Sandford': { region: 'USA', country: 'United States' },
  'Meg Shaffer': { region: 'USA', country: 'United States' },
  'Cory Doctorow': { region: 'Canada', country: 'Canada' },
  'Timothy Egan': { region: 'USA', country: 'United States' },
  'Marisha Pessl': { region: 'USA', country: 'United States' },
  'Skyler Ramirez': { region: 'USA', country: 'United States' },
  'Liu Cixin': { region: 'Asia', country: 'China' },
  'Shelby Van Pelt': { region: 'USA', country: 'United States' },
  'James S.A. Corey': { region: 'USA', country: 'United States' },
  'Elena Ferrante': { region: 'Europe', country: 'Italy' },
  'Richard Osman': { region: 'UK', country: 'United Kingdom' },
  'Blake Crouch': { region: 'USA', country: 'United States' },
  'Elaine N. Aron': { region: 'USA', country: 'United States' },
  'Oyinkan Braithwaite': { region: 'Africa', country: 'Nigeria' },
  'Paula Hawkins': { region: 'UK', country: 'United Kingdom' },
  'Richard K. Morgan': { region: 'UK', country: 'United Kingdom' },
  'Lewis Dartnell': { region: 'UK', country: 'United Kingdom' },
  'Andy Weir': { region: 'USA', country: 'United States' },
  'Han Kang': { region: 'Asia', country: 'South Korea' },
  'Gerald M. Kilby': { region: 'Europe', country: 'Ireland' },
  'Freida McFadden': { region: 'USA', country: 'United States' },
  'Ian Rankin': { region: 'UK', country: 'United Kingdom' },
  'Robert Crais': { region: 'USA', country: 'United States' },
  'Erik Larson': { region: 'USA', country: 'United States' },
  'Douglas Adams': { region: 'UK', country: 'United Kingdom' },
  'Michelle Obama': { region: 'USA', country: 'United States' },
  'Tara Westover': { region: 'USA', country: 'United States' },
  'Patrick Rothfuss': { region: 'USA', country: 'United States' }
};

export const AUTHOR_META = {};
