/**
 * src/constants/symbols.js
 * Centralized Unicode Symbols & Emoji Constants Module for ShelfLife
 *
 * Uses explicit ES6 Unicode escape sequences to prevent mojibake,
 * byte corruption, and editor encoding artifacts across all environments.
 */

export const SYMBOLS = {
  // Navigation & Core UI Controls
  NAVIGATION: {
    HAMBURGER: '\u{2630}',             // ☰
    TRIPLE_BAR: '\u{2261}',            // ≡
    CLOSE_X: '\u{2715}',               // ✕
    CLOSE_TIMES: '\u{00D7}',           // ×
    SEARCH: '\u{1F50D}',               // 🔍
    SEARCH_RIGHT: '\u{1F50E}',         // 🔎
    HOME: '\u{1F3E0}',                 // 🏠
    PROFILE: '\u{1F464}',              // 👤
    COMMUNITY: '\u{1F465}',            // 👥
    SPEECH: '\u{1F4AC}',               // 💬
    BELL: '\u{1F514}',                 // 🔔
    LOGOUT: '\u{1F6AA}',               // 🚪
    PLUS: '\u{2795}',                  // ➕
    MINUS: '\u{2796}',                 // ➖
    ARROW_RIGHT: '\u{2192}',           // →
    ARROW_LEFT: '\u{2190}',            // ←
    ARROW_UP: '\u{2191}',              // ↑
    ARROW_DOWN: '\u{2193}',            // ↓
    CHEVRON_RIGHT: '\u{203A}',         // ›
    CARET_DOWN: '\u{25BC}',            // ▼
    CARET_UP: '\u{25B2}',              // ▲
    CHECK: '\u{2713}',                 // ✓
    CHECK_HEAVY: '\u{2714}',           // ✔
    CHECK_BOX: '\u{2705}',             // ✅
    CROSS: '\u{274C}',                 // ❌
    TRASH: '\u{1F5D1}\u{FE0F}',        // 🗑️
    TRASH_PLAIN: '\u{1F5D1}',          // 🗑
    REFRESH: '\u{1F504}',              // 🔄
    LOCK: '\u{1F512}',                 // 🔒
    UNLOCK: '\u{1F513}',               // 🔓
    LINK: '\u{1F517}',                 // 🔗
    CLIPBOARD: '\u{1F4CB}',            // 📋
    EXPORT: '\u{1F4E4}',               // 📤
    IMPORT: '\u{1F4E5}',               // 📥
    CAMERA: '\u{1F4F7}',               // 📷
    FOLDER: '\u{1F4C1}',               // 📁
    FOLDER_OPEN: '\u{1F4C2}',          // 📂
    MOBILE: '\u{1F4F1}',               // 📱
    LAPTOP: '\u{1F4BB}',               // 💻
    GLOBE: '\u{1F310}',                // 🌐
    SPARKLES: '\u{2728}',              // ✨
    LIGHTNING: '\u{26A1}',             // ⚡
    SETTINGS: '\u{2699}\u{FE0F}',      // ⚙️
    TAG: '\u{1F3F7}\u{FE0F}',          // 🏷️
    COMPASS: '\u{1F9ED}'               // 🧭
  },

  // Books, Reading Statuses & Formats
  BOOKS: {
    OPEN_BOOK: '\u{1F4D6}',            // 📖
    BOOKS_STACK: '\u{1F4DA}',          // 📚
    BOOKMARK: '\u{1F516}',             // 🔖
    PENCIL: '\u{270F}\u{FE0F}',        // ✏️
    MEMO: '\u{1F4DD}',                 // 📝
    WRITING: '\u{270D}\u{FE0F}',       // ✍️
    HOURGLASS_DONE: '\u{23F3}',        // ⏳
    HOURGLASS_FLOWING: '\u{231B}',     // ⌛
    PUSHPIN: '\u{1F4CC}',              // 📌
    BOOK_RED: '\u{1F4D5}',             // 📕
    BOOK_GREEN: '\u{1F4D7}',           // 📗
    BOOK_BLUE: '\u{1F4D8}',            // 📘
    BOOK_ORANGE: '\u{1F4D9}',          // 📙
    NOTEBOOK: '\u{1F4D3}',             // 📓
    PAGE: '\u{1F4C4}',                 // 📄
    SCROLL: '\u{1F4DC}',               // 📜
    AUDIOBOOK: '\u{1F3A7}',            // 🎧
    PODCAST: '\u{1F399}\u{FE0F}',      // 🎙️
    EBOOK: '\u{1F4F1}',                // 📱
    PHYSICAL: '\u{1F4D6}',             // 📖
    ART: '\u{1F3A8}'                   // 🎨
  },

  // Rating & Sentiment Reactions
  RATING: {
    STAR: '\u{2B50}',                  // ⭐
    STAR_GLOWING: '\u{1F31F}',         // 🌟
    HEART_RED: '\u{2764}\u{FE0F}',     // ❤️
    HEART_BROKEN: '\u{1F494}',         // 💔
    HEART_SPARKLING: '\u{1F496}',      // 💖
    HEART_WHITE: '\u{1F90D}',          // 🤍
    FACE_LOVE: '\u{1F60D}',            // 😍
    FACE_SMILE: '\u{1F60A}',           // 😊
    FACE_NEUTRAL: '\u{1F610}',         // 😐
    FACE_FROWN: '\u{1F641}',           // 🙁
    FACE_ENRAGED: '\u{1F621}',         // 😡
    FACE_SHRUG: '\u{1F937}',           // 🤷
    THUMBS_UP: '\u{1F44D}',            // 👍
    THUMBS_DOWN: '\u{1F44E}',          // 👎
    FIRE: '\u{1F525}'                  // 🔥
  },

  // Achievements, Trophies & Milestones
  ACHIEVEMENTS: {
    TROPHY: '\u{1F3C6}',               // 🏆
    MEDAL_FIRST: '\u{1F947}',          // 🥇
    MEDAL_SECOND: '\u{1F948}',         // 🥈
    MEDAL_THIRD: '\u{1F949}',          // 🥉
    MEDAL_MILITARY: '\u{1F396}\u{FE0F}', // 🎖️
    MEDAL_SPORTS: '\u{1F3C5}',         // 🏅
    CROWN: '\u{1F451}',                // 👑
    TARGET: '\u{1F3AF}',               // 🎯
    ROCKET: '\u{1F680}',               // 🚀
    CRYSTAL_BALL: '\u{1F52E}',         // 🔮
    GEM: '\u{1F48E}',                  // 💎
    PARTY_POPPER: '\u{1F389}',         // 🎉
    CONFETTI: '\u{1F38A}',             // 🎊
    GIFT: '\u{1F381}',                 // 🎁
    BALLOON: '\u{1F388}',              // 🎈
    HUNDRED: '\u{1F4AF}'               // 💯
  },

  // Stats, Charts & Analytics
  STATS: {
    BAR_CHART: '\u{1F4CA}',            // 📊
    CHART_INCREASING: '\u{1F4C8}',     // 📈
    CHART_DECREASING: '\u{1F4C9}',     // 📉
    STOPWATCH: '\u{23F1}\u{FE0F}',     // ⏱️
    CALENDAR: '\u{1F4C5}',             // 📅
    CALENDAR_SPIRAL: '\u{1F5D3}\u{FE0F}', // 🗓️
    CALENDAR_SPIRAL_PLAIN: '\u{1F5D3}', // 🗓
    RULER_TRIANGLE: '\u{1F4D0}',       // 📐
    RULER_STRAIGHT: '\u{1F4CF}',       // 📏
    LIGHT_BULB: '\u{1F4A1}',           // 💡
    CLOCK_THREE: '\u{1F552}'           // 🕒
  },

  // Reading DNA, Moods, Themes & Nature
  DNA_MOOD: {
    DNA: '\u{1F9EC}',                  // 🧬
    MILKY_WAY: '\u{1F30C}',            // 🌌
    PLANET_RINGED: '\u{1FA90}',        // 🪐
    SHOOTING_STAR: '\u{1F320}',        // 🌠
    COMET: '\u{2604}\u{FE0F}',         // ☄️
    MOON_CRESCENT: '\u{1F319}',        // 🌙
    SUN: '\u{2600}\u{FE0F}',           // ☀️
    COFFEE: '\u{2615}',                // ☕
    WINE: '\u{1F377}',                 // 🍷
    HERB: '\u{1F33F}',                 // 🌿
    TREE: '\u{1F332}',                 // 🌲
    WAVE: '\u{1F30A}',                 // 🌊
    WOOD_LOG: '\u{1FAB5}',             // 🪵
    NERD_FACE: '\u{1F913}',            // 🤓
    ROBOT: '\u{1F916}',                // 🤖
    ALIEN: '\u{1F47D}',                // 👽
    THEATER_MASKS: '\u{1F3AD}',        // 🎭
    CHAMELEON: '\u{1F98E}',            // 🦎
    ENVELOPE: '\u{2709}\u{FE0F}',      // ✉️
    OWL: '\u{1F989}',                  // 🦉
    BAT: '\u{1F987}',                  // 🦇
    HOT_PEPPER: '\u{1F336}\u{FE0F}',   // 🌶️
    MIRROR: '\u{1FA9E}',               // 🪞
    MANTELPIECE_CLOCK: '\u{1F570}\u{FE0F}', // 🕰️
    COUCH: '\u{1F6CB}\u{FE0F}',        // 🛋️
    WEIGHT_LIFTER: '\u{1F3CB}\u{FE0F}', // 🏋️
    LOCOMOTIVE: '\u{1F682}',           // 🚂
    SUNRISE: '\u{1F305}',              // 🌅
    ROLLER_COASTER: '\u{1F3A2}',       // 🎢
    FRAMED_PICTURE: '\u{1F5BC}\u{FE0F}', // 🖼️
    MOUNTAIN: '\u{26F0}\u{FE0F}',      // ⛰️
    CANDLE: '\u{1F56F}\u{FE0F}',       // 🕯️
    BALANCE_SCALE: '\u{2696}\u{FE0F}', // ⚖️
    FEVER_FACE: '\u{1F912}',           // 🤒
    CRYING_FACE: '\u{1F62D}',          // 😭
    FORK_KNIFE_PLATE: '\u{1F37D}\u{FE0F}', // 🍽️
    CLIMBER: '\u{1F9D7}',              // 🧗
    GLOBE_AMERICAS: '\u{1F30E}',       // 🌎
    JACK_O_LANTERN: '\u{1F383}',       // 🎃
    CHRISTMAS_TREE: '\u{1F384}',       // 🎄
    SHIELD: '\u{1F6E1}\u{FE0F}',       // 🛡️
    FEARFUL_FACE: '\u{1F628}'          // 😨
  },

  // Typography, Punctuation & Micro-Symbols
  TYPOGRAPHY: {
    FILIGREE: '\u{2766}',              // ❦ (WHITE FLORETTE)
    FLOURISH: '\u{2767}',              // ❧ (ROTATED FLORAL HEART BULLET)
    MIDDLE_DOT: '\u{00B7}',            // ·
    BULLET: '\u{2022}',                // •
    APOSTROPHE: '\u{2019}',            // ’
    SINGLE_QUOTE_LEFT: '\u{2018}',     // ‘
    DOUBLE_QUOTE_LEFT: '\u{201C}',     // “
    DOUBLE_QUOTE_RIGHT: '\u{201D}',    // ”
    EM_DASH: '\u{2014}',               // —
    EN_DASH: '\u{2013}',               // –
    ELLIPSIS: '\u{2026}',              // …
    MULTIPLICATION_SIGN: '\u{00D7}',   // ×
    NO_BREAK_SPACE: '\u{00A0}',        // &nbsp;
    ZERO_WIDTH_SPACE: '\u{200B}'       // zero-width space
  },

  // Country Flags (Regional Indicator Symbol Pairs)
  FLAGS: {
    US: '\u{1F1FA}\u{1F1F8}',          // 🇺🇸
    GB: '\u{1F1EC}\u{1F1E7}',          // 🇬🇧
    CA: '\u{1F1E8}\u{1F1E6}',          // 🇨🇦
    EU: '\u{1F1EA}\u{1F1FA}',          // 🇪🇺
    ES: '\u{1F1EA}\u{1F1F8}',          // 🇪🇸
    FR: '\u{1F1EB}\u{1F1F7}',          // 🇫🇷
    DE: '\u{1F1E9}\u{1F1EA}',          // 🇩🇪
    IT: '\u{1F1EE}\u{1F1F9}',          // 🇮🇹
    PT: '\u{1F1F5}\u{1F1F9}',          // 🇵🇹
    NL: '\u{1F1F3}\u{1F1F1}',          // 🇳🇱
    RU: '\u{1F1F7}\u{1F1FA}',          // 🇷🇺
    JP: '\u{1F1EF}\u{1F1F5}',          // 🇯🇵
    CN: '\u{1F1E8}\u{1F1F3}',          // 🇨🇳
    KR: '\u{1F1F0}\u{1F1F7}',          // 🇰🇷
    SA: '\u{1F1F8}\u{1F1E6}',          // 🇸🇦
    SE: '\u{1F1F8}\u{1F1EA}',          // 🇸🇪
    AU: '\u{1F1E6}\u{1F1FA}',          // 🇦🇺
    IN: '\u{1F1EE}\u{1F1F3}',          // 🇮🇳
    BR: '\u{1F1E7}\u{1F1F7}',          // 🇧🇷
    MX: '\u{1F1F2}\u{1F1FD}',          // 🇲🇽
    NO: '\u{1F1F3}\u{1F1F4}',          // 🇳🇴
    IE: '\u{1F1EE}\u{1F1EA}',          // 🇮🇪
    NG: '\u{1F1F3}\u{1F1EC}',          // 🇳🇬
    ZA: '\u{1F1FF}\u{1F1E6}',          // 🇿🇦
    AR: '\u{1F1E6}\u{1F1F7}',          // 🇦🇷
    CL: '\u{1F1E8}\u{1F1F1}',          // 🇨🇱
    CO: '\u{1F1E8}\u{1F1F4}',          // 🇨🇴
    NZ: '\u{1F1F3}\u{1F1FF}',          // 🇳🇿
    PL: '\u{1F1F5}\u{1F1F1}',          // 🇵🇱
    IL: '\u{1F1EE}\u{1F1F1}',          // 🇮🇱
    TR: '\u{1F1F9}\u{1F1F7}',          // 🇹🇷
    PK: '\u{1F1F5}\u{1F1F0}',          // 🇵🇰
    PH: '\u{1F1F5}\u{1F1ED}'           // 🇵🇭
  },

  // Flat Aliases for direct property access and template backward-compatibility
  sparkles: '\u{2728}',
  arrow: '\u{2192}',
  gear: '\u{2699}\u{FE0F}',
  check: '\u{2705}',
  filigree: '\u{2766}',
  search: '\u{1F50D}',
  warning: '\u{26A0}\u{FE0F}',
  backArrow: '\u{2190}',
  dash: '-'
};

/**
 * Standard Language -> Flag Mapping
 */
export const LANGUAGE_FLAGS = {
  English: SYMBOLS.FLAGS.US,
  Spanish: SYMBOLS.FLAGS.ES,
  French: SYMBOLS.FLAGS.FR,
  German: SYMBOLS.FLAGS.DE,
  Italian: SYMBOLS.FLAGS.IT,
  Portuguese: SYMBOLS.FLAGS.PT,
  Dutch: SYMBOLS.FLAGS.NL,
  Russian: SYMBOLS.FLAGS.RU,
  Japanese: SYMBOLS.FLAGS.JP,
  Chinese: SYMBOLS.FLAGS.CN,
  Korean: SYMBOLS.FLAGS.KR,
  Arabic: SYMBOLS.FLAGS.SA
};

/**
 * Standard Region -> Flag Mapping
 */
export const REGION_FLAGS = {
  USA: SYMBOLS.FLAGS.US,
  Canada: SYMBOLS.FLAGS.CA,
  Europe: SYMBOLS.FLAGS.EU,
  Elsewhere: '\u{1F30E}'
};

/**
 * Standard Sentiment -> Emoji Mapping
 */
export const SENTIMENT_EMOJIS = {
  love: SYMBOLS.RATING.HEART_RED,
  like: SYMBOLS.RATING.THUMBS_UP,
  mixed: SYMBOLS.RATING.FACE_SHRUG,
  dislike: SYMBOLS.RATING.THUMBS_DOWN
};

/**
 * Standard Format -> Icon Mapping
 */
export const FORMAT_ICONS = {
  audiobook: SYMBOLS.BOOKS.AUDIOBOOK,
  audio: SYMBOLS.BOOKS.AUDIOBOOK,
  ebook: SYMBOLS.BOOKS.EBOOK,
  digital: SYMBOLS.BOOKS.EBOOK,
  physical: SYMBOLS.BOOKS.PHYSICAL,
  print: SYMBOLS.BOOKS.PHYSICAL,
  hardcover: SYMBOLS.BOOKS.PHYSICAL,
  paperback: SYMBOLS.BOOKS.PHYSICAL
};

/**
 * Helper: Retrieve safe sentiment emoji
 */
export function getSentimentEmoji(sentiment) {
  if (!sentiment) return '';
  const key = String(sentiment).toLowerCase().trim();
  return SENTIMENT_EMOJIS[key] || '';
}

/**
 * Helper: Retrieve language flag
 */
export function getLanguageFlag(language) {
  if (!language || language === 'English') return '';
  return LANGUAGE_FLAGS[language] || '';
}

/**
 * Helper: Retrieve region flag
 */
export function getRegionFlag(region) {
  if (!region) return '\u{1F30E}';
  return REGION_FLAGS[region] || '\u{1F30E}';
}

/**
 * Helper: Retrieve book format icon
 */
export function getFormatIcon(format) {
  if (!format) return SYMBOLS.BOOKS.PHYSICAL;
  const key = String(format).toLowerCase().trim();
  return FORMAT_ICONS[key] || SYMBOLS.BOOKS.PHYSICAL;
}

/**
 * Helper: Render star rating string
 */
export function renderRatingStars(rating, maxStars = 5) {
  const count = Math.min(Math.max(Math.round(Number(rating) || 0), 0), maxStars);
  return SYMBOLS.RATING.STAR.repeat(count);
}

/**
 * Helper: Clean and sanitize any string from corrupt byte sequences
 */
export function sanitizeSymbolString(str) {
  if (!str) return '';
  return str
    .replace(/Ã¢Å“Â/g, SYMBOLS.BOOKS.PENCIL)
    .replace(/Ã¯Â¸Â/g, '')
    .replace(/Ã°Å¸â€ â€“/g, SYMBOLS.BOOKS.OPEN_BOOK)
    .replace(/Ã¢â‚¬Â/g, SYMBOLS.TYPOGRAPHY.APOSTROPHE)
    .replace(/\uFFFD/g, '');
}

/**
 * Helper: Generate language options HTML for select elements
 */
export function languageOptionsHTML(selected) {
  const sel = selected || 'English';
  return Object.keys(LANGUAGE_FLAGS).map(lang => {
    const flag = LANGUAGE_FLAGS[lang];
    const isSelected = lang === sel ? ' selected' : '';
    return `<option value="${lang}"${isSelected}>${flag} ${lang}</option>`;
  }).join('');
}

// Global attachments for browser environment compatibility
if (typeof window !== 'undefined') {
  window.APP_SYMBOLS = {
    ...SYMBOLS,
    filigree: '\u2766', // Backward compatibility for masthead
    search: '\uD83D\uDD0D',
    sparkles: '\u2728',
    gear: '\u2699\uFE0F',
    arrow: '\u2192',
    check: '\u2705',
    dash: '-',
    warning: '\u26A0\uFE0F',
    backArrow: '\u2190'
  };
  window.languageOptionsHTML = languageOptionsHTML;
}
