/**
 * ShelfLife - Math and Calculation Helpers
 * Pure utility functions for word counts, formatting, percentiles, pacing, and easing.
 */

import {
  SVARS,
  WORDS_PER_PAGE,
  DEFAULT_IMPORT_WORDS,
  ESTIMATED_WC_TOOLTIP,
  MONTH_TO_QUARTER,
  QUARTER_PALETTE
} from './constants.js';

/**
 * Format a word count into a human-readable string.
 * - n < 1,000        -> exact locale grouped (e.g. "850")
 * - 1,000 <= n < 1M  -> rounded K (e.g. "95K")
 * - n >= 1,000,000   -> M with 1 decimal (e.g. "1.1M")
 *
 * @param {number|string} n - Word count
 * @returns {string} Formatted word count string
 */
export function fmtWords(n) {
  const num = Number(n) || 0;
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return Math.round(num / 1000) + 'K';
  return num.toLocaleString();
}

/**
 * Format a word count splitting the numeric value and unit suffix.
 * Useful for UI elements that render the unit in a smaller styled span.
 * - n < 1,000        -> { value: "850", unit: "" }
 * - 1,000 <= n < 1M  -> { value: "95", unit: "K" }
 * - n >= 1,000,000   -> { value: "1.23", unit: "M" }
 *
 * @param {number|string} n - Word count
 * @returns {{ value: string, unit: string }} Split value and unit
 */
export function fmtWordsParts(n) {
  const num = Number(n) || 0;
  if (num >= 1000000) return { value: (num / 1000000).toFixed(2), unit: 'M' };
  if (num >= 1000) return { value: String(Math.round(num / 1000)), unit: 'K' };
  return { value: num.toLocaleString(), unit: '' };
}

/**
 * Convert a page count to an estimated word count.
 * Uses WORDS_PER_PAGE (300 words/page).
 *
 * @param {number|string} pages - Page count
 * @param {boolean} [isFiction=true] - Fiction flag (optional)
 * @returns {number} Estimated word count
 */
export function pagesToWords(pages, isFiction) {
  const p = parseInt(pages, 10) || 0;
  return p > 0 ? p * WORDS_PER_PAGE : 0;
}

/**
 * Check if a book's word count was estimated rather than explicitly supplied.
 *
 * @param {Object} book - Book object
 * @returns {boolean} True if word count is derived/estimated
 */
export function isWordCountEstimated(book) {
  if (!book) return false;
  if (typeof book.wordCountEstimated === 'boolean') return book.wordCountEstimated;
  const est = ['calculated', 'openlibrary', 'googlebooks', 'unknown'];
  return est.includes(book.wordCountSource || '');
}

/**
 * Return an asterisk HTML span with a tooltip for estimated word counts, or empty string.
 *
 * @param {Object} book - Book object
 * @returns {string} HTML string or empty string
 */
export function wcEstAsterisk(book) {
  return isWordCountEstimated(book)
    ? `<span class="wc-est" title="${ESTIMATED_WC_TOOLTIP}">*</span>`
    : '';
}

/**
 * Calculate the p-th percentile from an array of pre-sorted numbers using linear interpolation.
 *
 * @param {number[]} sortedVals - Sorted array of numbers (ascending)
 * @param {number} p - Percentile between 0 and 100
 * @returns {number} Interpolated percentile value
 */
export function percentile(sortedVals, p) {
  if (!sortedVals || !sortedVals.length) return 0;
  if (sortedVals.length === 1) return sortedVals[0];
  const clampedP = Math.max(0, Math.min(100, Number(p) || 0));
  const idx = (clampedP / 100) * (sortedVals.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedVals[lo];
  const t = idx - lo;
  return sortedVals[lo] + (sortedVals[hi] - sortedVals[lo]) * t;
}

/**
 * Compute the low and high percentile range for a dataset of values (e.g. reading pace/days).
 * Ensures a valid positive span (min >= 0, max >= min + 1).
 *
 * @param {number[]} values - Array of numeric values
 * @param {number} [lowPct=5] - Lower percentile cutoff
 * @param {number} [highPct=95] - Upper percentile cutoff
 * @returns {{ min: number, max: number, pLow: number, pHigh: number }} Range bounds
 */
export function percentileRange(values, lowPct = 5, highPct = 95) {
  const nums = (values || []).map(v => Number(v)).filter(v => Number.isFinite(v) && v >= 0).sort((a, b) => a - b);
  if (!nums.length) {
    return { min: 0, max: 12, pLow: 0, pHigh: 12 };
  }
  const pLow = percentile(nums, lowPct);
  const pHigh = percentile(nums, highPct);
  const min = Math.max(0, Math.min(pLow, pHigh));
  const max = Math.max(min + 1, Math.max(pLow, pHigh));
  return { min, max, pLow, pHigh };
}

/**
 * Format a number using compact 'k' (lowercase) and 'M' notation.
 * Used for bookmark ribbons and compact statistics annotations.
 *
 * @param {number|string} num - Number to format
 * @returns {string} Formatted compact string (e.g. "95k", "1.25M")
 */
export function fmtK(num) {
  const n = Number(num) || 0;
  return n >= 1000000 ? (n / 1000000).toFixed(2) + 'M' : Math.round(n / 1000) + 'k';
}

/**
 * Retrieve sentiment color variant based on sentiment key and cyclic index.
 *
 * @param {string} sentiment - Sentiment key ('love', 'like', 'mixed', 'dislike')
 * @param {number} [idx=0] - Color variant index (0-6)
 * @returns {string} Hex color code
 */
export function sColor(sentiment, idx = 0) {
  const i = typeof idx === 'number' && !isNaN(idx) ? Math.abs(Math.floor(idx)) : 0;
  return SVARS[sentiment] ? SVARS[sentiment][i % 7] : '#c4b9aa';
}

/**
 * Calculate bookmark ribbon gradient tone colors (light, dark, text)
 * based on word count relative to min/max and seasonal quarter.
 *
 * @param {number} words - Book word count
 * @param {number} minW - Minimum word count in range
 * @param {number} maxW - Maximum word count in range
 * @param {string} month - Month name (e.g. "January") or quarter string (e.g. "Q1")
 * @returns {{ light: string, dark: string, text: string }} HSL and RGBA color strings
 */
export function bmTone(words, minW, maxW, month) {
  const w = Number(words) || 0;
  const min = Number(minW) || 0;
  const max = Number(maxW) || 0;
  const t = (max === min) ? 0.5 : (w - min) / (max - min);
  const q = MONTH_TO_QUARTER[month] || (QUARTER_PALETTE[month] ? month : 'Q1');
  const pal = QUARTER_PALETTE[q] || QUARTER_PALETTE.Q1;
  const lLight = Math.round(92 - t * 6);
  const lDark = Math.round(85 - t * 9);
  return {
    light: `hsl(${pal.h},${pal.s}%,${lLight}%)`,
    dark: `hsl(${pal.h},${pal.s}%,${lDark}%)`,
    text: 'rgba(61,43,31,0.92)'
  };
}

/**
 * Standard cubic easing-out function for smooth UI counters and animations.
 *
 * @param {number} t - Progress between 0 and 1
 * @returns {number} Eased value between 0 and 1
 */
export function easeOutCubic(t) {
  const p = Number(t) || 0;
  return 1 - Math.pow(1 - p, 3);
}
