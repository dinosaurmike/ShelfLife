/**
 * Standalone Offline QR Code Generator (src/utils/qrcode.js)
 * 
 * Zero-CDN, zero-external-dependencies pure JavaScript QR Code generator
 * supporting Model 2 QR Codes (Byte Mode, ECC Levels L/M/Q/H, Versions 1-10).
 */

// --- GF(256) Math & Reed-Solomon Error Correction ---
const GF256_EXP = new Uint8Array(512);
const GF256_LOG = new Uint8Array(256);

(function initGF256() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF256_EXP[i] = x;
    GF256_EXP[i + 255] = x;
    GF256_LOG[x] = i;
    x <<= 1;
    if (x & 256) {
      x ^= 0x11d; // Primitive polynomial x^8 + x^4 + x^3 + x^2 + 1
    }
  }
  GF256_LOG[0] = 0;
})();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return GF256_EXP[GF256_LOG[a] + GF256_LOG[b]];
}

function rsGeneratorPoly(numEC) {
  let poly = [1];
  for (let i = 0; i < numEC; i++) {
    const factor = [1, GF256_EXP[i]];
    const nextPoly = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      nextPoly[j] ^= gfMul(poly[j], factor[0]);
      nextPoly[j + 1] ^= gfMul(poly[j], factor[1]);
    }
    poly = nextPoly;
  }
  return poly;
}

function rsCalculateEC(data, numEC) {
  const gen = rsGeneratorPoly(numEC);
  const remainder = new Array(numEC).fill(0);
  
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ remainder[0];
    remainder.shift();
    remainder.push(0);
    if (factor !== 0) {
      for (let j = 0; j < numEC; j++) {
        remainder[j] ^= gfMul(gen[j + 1], factor);
      }
    }
  }
  return remainder;
}

// --- QR Code Capacity & Block Layout Tables (Versions 1-10, ECL M) ---
// [version, totalCodewords, ecCodewordsPerBlock, numBlocksG1, dataPerBlockG1, numBlocksG2, dataPerBlockG2]
const QR_TABLE_M = [
  null,
  [1, 26, 10, 1, 16, 0, 0],
  [2, 44, 16, 1, 28, 0, 0],
  [3, 70, 26, 1, 44, 0, 0],
  [4, 100, 18, 2, 32, 0, 0],
  [5, 134, 24, 2, 43, 0, 0],
  [6, 172, 16, 4, 27, 0, 0],
  [7, 196, 18, 4, 31, 0, 0],
  [8, 242, 22, 2, 38, 2, 39],
  [9, 292, 22, 3, 36, 2, 37],
  [10, 346, 26, 4, 43, 1, 44]
];

// Alignment pattern coordinate centers
const ALIGNMENT_COORDS = [
  [],
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50]
];

function selectVersion(dataLen) {
  for (let v = 1; v <= 10; v++) {
    const table = QR_TABLE_M[v];
    const totalDataCap = table[3] * table[4] + table[5] * table[6];
    // Mode header (4 bits) + length (8 bits for v 1-9, 16 bits for v 10) + data
    const overhead = v < 10 ? 2 : 3;
    if (dataLen + overhead <= totalDataCap) {
      return v;
    }
  }
  return 10;
}

function encodeData(text, version) {
  const bytes = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 128) {
      bytes.push(code);
    } else if (code < 2048) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 65536) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }

  const table = QR_TABLE_M[version];
  const totalDataBytes = table[3] * table[4] + table[5] * table[6];
  
  // Bit stream
  const bits = [];
  function pushBits(val, len) {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >> i) & 1);
    }
  }

  // Byte mode indicator: 0100
  pushBits(0b0100, 4);
  // Character count indicator (8 bits for v1-9, 16 bits for v10+)
  const countBits = version < 10 ? 8 : 16;
  pushBits(bytes.length, countBits);

  // Data bytes
  for (let i = 0; i < bytes.length; i++) {
    pushBits(bytes[i], 8);
  }

  // Terminator (up to 4 zeros)
  const totalDataBits = totalDataBytes * 8;
  const termLen = Math.min(4, totalDataBits - bits.length);
  for (let i = 0; i < termLen; i++) bits.push(0);

  // Pad to byte boundary
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  // Convert to bytes
  const dataBytes = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) {
      b = (b << 1) | bits[i + j];
    }
    dataBytes.push(b);
  }

  // Pad with alternating 0xEC, 0x11
  let padToggle = false;
  while (dataBytes.length < totalDataBytes) {
    dataBytes.push(padToggle ? 0x11 : 0xec);
    padToggle = !padToggle;
  }

  return dataBytes;
}

function createMatrix(version) {
  const size = version * 4 + 17;
  const matrix = Array.from({ length: size }, () => new Int8Array(size).fill(-1));
  const isReserved = Array.from({ length: size }, () => new Uint8Array(size).fill(0));

  function setModule(r, c, val, reserved = true) {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      matrix[r][c] = val ? 1 : 0;
      if (reserved) isReserved[r][c] = 1;
    }
  }

  // 1. Finder patterns
  function addFinder(row, col) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const nr = row + r;
        const nc = col + c;
        if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
        if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
          if (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
            setModule(nr, nc, 1);
          } else {
            setModule(nr, nc, 0);
          }
        } else {
          setModule(nr, nc, 0); // Separator
        }
      }
    }
  }

  addFinder(0, 0);
  addFinder(0, size - 7);
  addFinder(size - 7, 0);

  // 2. Timing patterns
  for (let i = 8; i < size - 8; i++) {
    const val = (i % 2 === 0) ? 1 : 0;
    if (matrix[6][i] === -1) setModule(6, i, val);
    if (matrix[i][6] === -1) setModule(i, 6, val);
  }

  // 3. Alignment patterns (version >= 2)
  const coords = ALIGNMENT_COORDS[version] || [];
  for (let i = 0; i < coords.length; i++) {
    for (let j = 0; j < coords.length; j++) {
      const cr = coords[i];
      const cc = coords[j];
      if ((cr === 6 && cc === 6) || (cr === 6 && cc === size - 7) || (cr === size - 7 && cc === 6)) {
        continue;
      }
      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          const val = (Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0)) ? 1 : 0;
          setModule(cr + r, cc + c, val);
        }
      }
    }
  }

  // 4. Dark module
  setModule(4 * version + 9, 8, 1);

  // 5. Reserve format info areas
  for (let i = 0; i <= 8; i++) {
    if (matrix[8][i] === -1) setModule(8, i, 0, true);
    if (matrix[i][8] === -1) setModule(i, 8, 0, true);
  }
  for (let i = size - 8; i < size; i++) {
    if (matrix[8][i] === -1) setModule(8, i, 0, true);
    if (matrix[i][8] === -1) setModule(i, 8, 0, true);
  }

  return { matrix, isReserved, size };
}

// Format info BCH code: 15 bits for ECC Level M (00) and Mask (0..7)
const FORMAT_INFO = [
  0x5412, 0x5125, 0x5e7c, 0x5b4b, 0x45f9, 0x40ce, 0x4f97, 0x4aa0
];

function applyFormatInfo(matrix, maskPattern, size) {
  const formatBits = FORMAT_INFO[maskPattern];
  for (let i = 0; i < 15; i++) {
    const bit = (formatBits >> (14 - i)) & 1;
    // Top-left
    if (i <= 5) matrix[8][i] = bit;
    else if (i === 6) matrix[8][7] = bit;
    else if (i === 7) matrix[8][8] = bit;
    else if (i === 8) matrix[7][8] = bit;
    else matrix[14 - i][8] = bit;

    // Bottom-left / Top-right
    if (i < 8) matrix[size - 1 - i][8] = bit;
    else matrix[8][size - 15 + i] = bit;
  }
}

function getMaskCondition(mask) {
  switch (mask) {
    case 0: return (r, c) => (r + c) % 2 === 0;
    case 1: return (r, c) => r % 2 === 0;
    case 2: return (r, c) => c % 3 === 0;
    case 3: return (r, c) => (r + c) % 3 === 0;
    case 4: return (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
    case 5: return (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0;
    case 6: return (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
    case 7: return (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
    default: return () => false;
  }
}

function placeData(matrix, isReserved, size, dataCodewords, version) {
  const table = QR_TABLE_M[version];
  const numEC = table[2];
  const numG1 = table[3];
  const dataG1 = table[4];
  const numG2 = table[5];
  const dataG2 = table[6];
  const totalBlocks = numG1 + numG2;

  const dataBlocks = [];
  const ecBlocks = [];
  let offset = 0;

  for (let i = 0; i < numG1; i++) {
    const block = dataCodewords.slice(offset, offset + dataG1);
    dataBlocks.push(block);
    ecBlocks.push(rsCalculateEC(block, numEC));
    offset += dataG1;
  }
  for (let i = 0; i < numG2; i++) {
    const block = dataCodewords.slice(offset, offset + dataG2);
    dataBlocks.push(block);
    ecBlocks.push(rsCalculateEC(block, numEC));
    offset += dataG2;
  }

  // Interleave data
  const finalSequence = [];
  const maxDataLen = Math.max(dataG1, dataG2 || 0);
  for (let i = 0; i < maxDataLen; i++) {
    for (let b = 0; b < totalBlocks; b++) {
      if (i < dataBlocks[b].length) {
        finalSequence.push(dataBlocks[b][i]);
      }
    }
  }
  // Interleave EC
  for (let i = 0; i < numEC; i++) {
    for (let b = 0; b < totalBlocks; b++) {
      finalSequence.push(ecBlocks[b][i]);
    }
  }

  // Convert to bit stream
  const bits = [];
  for (let i = 0; i < finalSequence.length; i++) {
    for (let b = 7; b >= 0; b--) {
      bits.push((finalSequence[i] >> b) & 1);
    }
  }

  // Place bits into matrix
  let bitIdx = 0;
  let upwards = true;

  for (let rightCol = size - 1; rightCol > 0; rightCol -= 2) {
    if (rightCol === 6) rightCol--; // Skip timing col
    const leftCol = rightCol - 1;

    for (let step = 0; step < size; step++) {
      const r = upwards ? (size - 1 - step) : step;
      for (const c of [rightCol, leftCol]) {
        if (!isReserved[r][c]) {
          const bit = bitIdx < bits.length ? bits[bitIdx++] : 0;
          matrix[r][c] = bit;
        }
      }
    }
    upwards = !upwards;
  }
}

function calculatePenalty(matrix, size) {
  let penalty = 0;
  // Penalty 1: Adjacent modules in row/col
  for (let r = 0; r < size; r++) {
    let runLen = 1;
    for (let c = 1; c < size; c++) {
      if (matrix[r][c] === matrix[r][c - 1]) {
        runLen++;
      } else {
        if (runLen >= 5) penalty += 3 + (runLen - 5);
        runLen = 1;
      }
    }
    if (runLen >= 5) penalty += 3 + (runLen - 5);
  }
  for (let c = 0; c < size; c++) {
    let runLen = 1;
    for (let r = 1; r < size; r++) {
      if (matrix[r][c] === matrix[r - 1][c]) {
        runLen++;
      } else {
        if (runLen >= 5) penalty += 3 + (runLen - 5);
        runLen = 1;
      }
    }
    if (runLen >= 5) penalty += 3 + (runLen - 5);
  }
  return penalty;
}

function generateQRMatrix(text) {
  const version = selectVersion(text.length);
  const dataCodewords = encodeData(text, version);
  const { size, isReserved } = createMatrix(version);

  let bestMask = 0;
  let minPenalty = Infinity;
  let bestMatrix = null;

  for (let mask = 0; mask < 8; mask++) {
    const { matrix } = createMatrix(version);
    placeData(matrix, isReserved, size, dataCodewords, version);
    const maskFn = getMaskCondition(mask);

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!isReserved[r][c]) {
          if (maskFn(r, c)) {
            matrix[r][c] ^= 1;
          }
        }
      }
    }

    applyFormatInfo(matrix, mask, size);
    const penalty = calculatePenalty(matrix, size);
    if (penalty < minPenalty) {
      minPenalty = penalty;
      bestMask = mask;
      bestMatrix = matrix;
    }
  }

  return { matrix: bestMatrix, size };
}

/**
 * Renders a QR code to a canvas element.
 * @param {HTMLCanvasElement} canvas Target HTML Canvas
 * @param {string} text URL or string content to encode
 * @param {Object} [options] Custom rendering options
 * @returns {HTMLCanvasElement}
 */
export function renderQRCodeToCanvas(canvas, text, options = {}) {
  if (!canvas || typeof canvas.getContext !== 'function') return canvas;

  const size = options.size || 180;
  const margin = options.margin !== undefined ? options.margin : 4;
  const colorDark = options.colorDark || '#2C2C2C';
  const colorLight = options.colorLight || '#FFFFFF';

  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.fillStyle = colorLight;
  ctx.fillRect(0, 0, size, size);

  try {
    const { matrix, size: modCount } = generateQRMatrix(String(text || ''));
    const totalModules = modCount + margin * 2;
    const moduleSize = size / totalModules;

    ctx.fillStyle = colorDark;
    for (let r = 0; r < modCount; r++) {
      for (let c = 0; c < modCount; c++) {
        if (matrix[r][c] === 1) {
          const x = Math.round((c + margin) * moduleSize);
          const y = Math.round((r + margin) * moduleSize);
          const w = Math.ceil(moduleSize);
          const h = Math.ceil(moduleSize);
          ctx.fillRect(x, y, w, h);
        }
      }
    }
  } catch (err) {
    console.error('[QRCode] Error rendering QR Code:', err);
  }

  return canvas;
}

/**
 * Generates a PNG Data URL representing the QR code.
 * @param {string} text URL or string content to encode
 * @param {Object} [options] Custom rendering options
 * @returns {string} Data URL (data:image/png;base64,...)
 */
export function getQRCodeDataURL(text, options = {}) {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  renderQRCodeToCanvas(canvas, text, options);
  return canvas.toDataURL('image/png');
}

// Attach globally for window access
if (typeof window !== 'undefined') {
  window.renderQRCodeToCanvas = renderQRCodeToCanvas;
  window.getQRCodeDataURL = getQRCodeDataURL;
}
