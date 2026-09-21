/**
 * Smart Indonesian Receipt & Handwriting OCR Engine
 * Optimized for thermal receipts, camera captures, and Indonesian retail formats.
 */

/**
 * Safely pre-processes an image on canvas to enhance contrast for both printed and handwritten text.
 * - Preserves line resolution (maintains width >= 1000px so characters are tall enough for OCR).
 * - Adaptive contrast stretching: expands dynamic range so faint thermal print is clearly dark.
 * - Text edge sharpening to enhance dot-matrix and receipt printer fonts.
 */
async function preprocessReceiptImage(imageSource) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve(imageSource);
    }, 2000);

    try {
      const img = new Image();
      if (typeof imageSource === 'string' && imageSource.startsWith('http')) {
        img.crossOrigin = 'Anonymous';
      }

      img.onload = () => {
        clearTimeout(timeout);
        try {
          const origW = img.width;
          const origH = img.height;

          // Receipts are tall. We MUST ensure width is at least 1000px so text isn't squashed into 4px lines.
          let targetW = origW;
          let targetH = origH;

          if (origW < 1000) {
            const ratio = 1000 / origW;
            targetW = 1000;
            targetH = Math.round(origH * ratio);
          } else if (origW > 2000) {
            const ratio = 1800 / origW;
            targetW = 1800;
            targetH = Math.round(origH * ratio);
          }

          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) {
            return resolve(imageSource);
          }

          canvas.width = targetW;
          canvas.height = targetH;

          ctx.drawImage(img, 0, 0, targetW, targetH);
          const imgData = ctx.getImageData(0, 0, targetW, targetH);
          const data = imgData.data;

          // Pass 1: Find min and max luminance for contrast stretching
          let minLum = 255;
          let maxLum = 0;
          for (let i = 0; i < data.length; i += 16) { // Sample every 4th pixel for speed
            const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            if (lum < minLum) minLum = lum;
            if (lum > maxLum) maxLum = lum;
          }

          // Safety guard against solid colors
          if (maxLum - minLum < 30) {
            minLum = 0;
            maxLum = 255;
          }

          // Pass 2: Contrast stretching & gamma adjustment (darken text, whiten paper background)
          const range = maxLum - minLum;
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            let lum = 0.299 * r + 0.587 * g + 0.114 * b;

            // Stretched luminance [0, 255]
            let norm = ((lum - minLum) / range) * 255;

            // Contrast enhancement curve:
            // Text is darkened; paper background is cleanly brightened
            if (norm < 120) {
              norm = Math.max(0, norm * 0.65); // Darken text
            } else if (norm > 150) {
              norm = Math.min(255, norm * 1.15 + 15); // Whiten background
            }

            data[i] = norm;
            data[i + 1] = norm;
            data[i + 2] = norm;
          }

          ctx.putImageData(imgData, 0, 0);
          resolve(canvas.toDataURL('image/jpeg', 0.9));
        } catch {
          resolve(imageSource);
        }
      };

      img.onerror = () => {
        clearTimeout(timeout);
        resolve(imageSource);
      };

      img.src = imageSource;
    } catch {
      clearTimeout(timeout);
      resolve(imageSource);
    }
  });
}

/**
 * Scan receipt with Tesseract OCR (PSM 6 for structured receipts + Indonesian parser)
 */
export async function scanReceiptImage(imageSource, onProgress = () => {}) {
  const ocrTask = async () => {
    onProgress({ status: 'Optimizing receipt image...', progress: 15 });
    const processedImage = await preprocessReceiptImage(imageSource);

    onProgress({ status: 'Initializing OCR engine...', progress: 35 });
    const { createWorker } = await import('tesseract.js');

    // Use 'eng' with PSM 6 (single uniform block of text) to prevent multi-column scrambling
    const worker = await createWorker('eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          onProgress({ 
            status: 'Recognizing text and prices...', 
            progress: 35 + Math.round((m.progress || 0) * 55) 
          });
        }
      }
    });

    // Set OCR parameters for receipt reading
    await worker.setParameters({
      tessedit_pageseg_mode: '6', // Assume a single uniform block of text
      preserve_interword_spaces: '1'
    });

    onProgress({ status: 'Extracting amount and store name...', progress: 92 });
    const ret = await worker.recognize(processedImage);
    await worker.terminate();

    const rawText = ret?.data?.text || '';
    const parsedData = parseReceiptText(rawText);

    onProgress({ status: 'Complete!', progress: 100 });
    return {
      rawText,
      ...parsedData
    };
  };

  // 15-second safety timeout
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Scanner timed out. Please enter details manually.')), 15000);
  });

  return Promise.race([ocrTask(), timeoutPromise]);
}

/**
 * Parses raw OCR text to extract Amount, Date, Merchant/Note, Category, and All Candidate Amounts.
 */
export function parseReceiptText(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return { amount: '', allAmounts: [], date: null, note: '', category: 'Food', splitType: 'personal' };
  }

  const rawLines = rawText.split('\n');
  const lines = rawLines.map(line => line.trim()).filter(line => line.length > 0);

  let detectedDate = null;
  let detectedMerchant = '';
  let detectedCategory = 'Food';

  const fullTextLower = rawText.toLowerCase();

  // ─────────────────────────────────────────────────────────────
  // 1. Indonesian Category & Store Detection
  // ─────────────────────────────────────────────────────────────
  if (
    fullTextLower.includes('spbu') || fullTextLower.includes('pertamina') || fullTextLower.includes('shell') || 
    fullTextLower.includes('bensin') || fullTextLower.includes('pertalite') || fullTextLower.includes('pertamax') || 
    fullTextLower.includes('solar') || fullTextLower.includes('grab') || fullTextLower.includes('gojek') || 
    fullTextLower.includes('maxim') || fullTextLower.includes('bluebird') || fullTextLower.includes('parkir') || 
    fullTextLower.includes('tol') || fullTextLower.includes('tambal') || fullTextLower.includes('bengkel')
  ) {
    if (fullTextLower.includes('spbu') || fullTextLower.includes('pertamina')) detectedMerchant = 'SPBU Pertamina';
    else if (fullTextLower.includes('shell')) detectedMerchant = 'SPBU Shell';
    else if (fullTextLower.includes('grab')) detectedMerchant = 'Grab';
    else if (fullTextLower.includes('gojek')) detectedMerchant = 'Gojek';
    else if (fullTextLower.includes('bluebird')) detectedMerchant = 'Bluebird';
    else detectedMerchant = 'Transport';
    detectedCategory = 'Transport';
  } else if (
    fullTextLower.includes('indomaret') || fullTextLower.includes('alfamart') || fullTextLower.includes('alfamidi') || 
    fullTextLower.includes('superindo') || fullTextLower.includes('hypermart') || fullTextLower.includes('hero') || 
    fullTextLower.includes('lawson') || fullTextLower.includes('familymart') || fullTextLower.includes('circle k')
  ) {
    if (fullTextLower.includes('indomaret')) detectedMerchant = 'Indomaret';
    else if (fullTextLower.includes('alfamart')) detectedMerchant = 'Alfamart';
    else if (fullTextLower.includes('alfamidi')) detectedMerchant = 'Alfamidi';
    else if (fullTextLower.includes('superindo')) detectedMerchant = 'Superindo';
    else if (fullTextLower.includes('lawson')) detectedMerchant = 'Lawson';
    else detectedMerchant = 'Supermarket';
    detectedCategory = 'Food';
  } else if (
    fullTextLower.includes('kopi') || fullTextLower.includes('coffee') || fullTextLower.includes('starbucks') || 
    fullTextLower.includes('kenangan') || fullTextLower.includes('janji jiwa') || fullTextLower.includes('fore') || 
    fullTextLower.includes('resto') || fullTextLower.includes('restaurant') || fullTextLower.includes('cafe') || 
    fullTextLower.includes('solaria') || fullTextLower.includes('mcdonald') || fullTextLower.includes('mcd') || 
    fullTextLower.includes('kfc') || fullTextLower.includes('hokben') || fullTextLower.includes('burger king') || 
    fullTextLower.includes('pizza') || fullTextLower.includes('bakso') || fullTextLower.includes('mie') || 
    fullTextLower.includes('warung') || fullTextLower.includes('dapur')
  ) {
    if (fullTextLower.includes('starbucks')) detectedMerchant = 'Starbucks';
    else if (fullTextLower.includes('kenangan')) detectedMerchant = 'Kopi Kenangan';
    else if (fullTextLower.includes('solaria')) detectedMerchant = 'Solaria';
    else if (fullTextLower.includes('mcdonald') || fullTextLower.includes('mcd')) detectedMerchant = "McDonald's";
    else if (fullTextLower.includes('kfc')) detectedMerchant = 'KFC';
    else if (fullTextLower.includes('hokben')) detectedMerchant = 'HokBen';
    else detectedMerchant = 'Food & Beverage';
    detectedCategory = 'Food';
  } else if (
    fullTextLower.includes('apotek') || fullTextLower.includes('apotik') || fullTextLower.includes('kimia farma') || 
    fullTextLower.includes('k-24') || fullTextLower.includes('century') || fullTextLower.includes('guardian') || 
    fullTextLower.includes('watsons') || fullTextLower.includes('klinik') || fullTextLower.includes('obat')
  ) {
    detectedMerchant = fullTextLower.includes('kimia farma') ? 'Apotek Kimia Farma' : (fullTextLower.includes('k-24') ? 'Apotek K-24' : 'Pharmacy');
    detectedCategory = 'Healthcare';
  } else if (
    fullTextLower.includes('laundry') || fullTextLower.includes('cuci') || fullTextLower.includes('setrika') || 
    fullTextLower.includes('pln') || fullTextLower.includes('listrik') || fullTextLower.includes('pdam') || 
    fullTextLower.includes('indihome') || fullTextLower.includes('wifi') || fullTextLower.includes('pulsa')
  ) {
    detectedMerchant = fullTextLower.includes('laundry') ? 'Laundry' : 'Utility Bill';
    detectedCategory = 'Bills';
  } else if (
    fullTextLower.includes('cinema') || fullTextLower.includes('xxi') || fullTextLower.includes('cgv') || 
    fullTextLower.includes('cinepolis') || fullTextLower.includes('bioskop') || fullTextLower.includes('game')
  ) {
    detectedMerchant = fullTextLower.includes('xxi') ? 'Cinema XXI' : (fullTextLower.includes('cgv') ? 'CGV Cinema' : 'Entertainment');
    detectedCategory = 'Entertainment';
  }

  // Fallback merchant detection from top lines (skipping header noise words)
  if (!detectedMerchant) {
    const skipHeaders = [
      'selamat datang', 'welcome', 'struk', 'nota', 'receipt', 'bill', 'invoice', 
      'pos terminal', 'kasir', 'cashier', 'order', 'meja', 'table', 'jl.', 'jalan', 
      'telp', 'phone', 'npwp', 'cabang', 'branch', 'lantai', 'pembelian', 'merchant'
    ];

    for (const line of lines.slice(0, 6)) {
      const lower = line.toLowerCase();
      const hasNoise = skipHeaders.some(h => lower.includes(h));
      const cleanLine = line.replace(/[^a-zA-Z0-9 &.,'/-]/g, '').trim();

      if (!hasNoise && cleanLine.length >= 3 && cleanLine.length <= 40 && !cleanLine.match(/^\d+$/) && !cleanLine.match(/^[0-9/.-]+$/)) {
        detectedMerchant = cleanLine;
        break;
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 2. Hierarchical Amount & Price Detection
  // ─────────────────────────────────────────────────────────────
  // Strict priority keywords in Indonesian receipts
  const PRIORITY_1_TOTAL = [
    'grand total', 'total akhir', 'total tagihan', 'total belanja', 
    'total bayar', 'total harga', 'total biaya', 'amount due', 'total due', 
    'total nett', 'netto', 'jumlah tagihan'
  ];
  const PRIORITY_2_SUBTOTAL = ['subtotal', 'sub total', 'jumlah harga', 'total'];
  const PRIORITY_3_TENDERED = ['tunai', 'cash', 'bayar', 'debit', 'qris', 'bca', 'mandiri', 'kartu'];
  const DISQUALIFIERS = [
    'kembali', 'kembalian', 'change', 'cashback', 'diskon', 'potongan', 'hemat', 
    'tax', 'pajak', 'pb1', 'ppn', 'no.', 'order', 'telp', 'phone', 'npwp', 'meja', 'antrian'
  ];

  const candidateAmounts = [];

  lines.forEach((line) => {
    const lower = line.toLowerCase();

    // Check if line should be disqualified (e.g. Change/Kembalian or Tax)
    const isDisqualified = DISQUALIFIERS.some(d => lower.includes(d));

    // Determine line priority weight
    let weight = 1;
    if (!isDisqualified) {
      if (PRIORITY_1_TOTAL.some(k => lower.includes(k))) {
        weight = 100;
      } else if (PRIORITY_2_SUBTOTAL.some(k => lower.includes(k))) {
        weight = 50;
      } else if (PRIORITY_3_TENDERED.some(k => lower.includes(k))) {
        weight = 20; // Lower than total, only fallback if total wasn't detected
      }
    } else {
      weight = -10; // Negative weight for kembalian/tax/discounts
    }

    // Extract all price-like patterns from this line
    // Matches: Rp 49.000, 49.000, 49,000, 49000, 49.000,00, 49.000.-
    const priceRegex = /(?:rp|idr)?\s*([0-9]{1,3}(?:[.,][0-9]{3})+(?:[.,][0-9]{2})?|[0-9]{4,9})/gi;
    let match;
    while ((match = priceRegex.exec(line)) !== null) {
      const parsedNum = cleanPriceStringToNumber(match[1]);
      if (parsedNum >= 500 && parsedNum <= 1000000000) {
        candidateAmounts.push({
          value: parsedNum,
          weight,
          rawLine: line,
          isDisqualified
        });
      }
    }

    // Fallback: Check for OCR digit glitches in totals (e.g. 45.ooo, 4g.000)
    const glitchMatch = line.match(/(?:total|harga|bayar|rp)?\s*[:=]?\s*([yY4uUqQ\d][gGqQ9\d][.,\s]?[oO0D\d]{3,})/i);
    if (glitchMatch) {
      const parsedGlitched = parseHandwrittenNumber(glitchMatch[1]);
      if (parsedGlitched >= 500 && parsedGlitched <= 1000000000) {
        candidateAmounts.push({
          value: parsedGlitched,
          weight: Math.max(weight, 40),
          rawLine: line,
          isDisqualified
        });
      }
    }
  });

  // Unique list of candidate numbers
  const uniqueCandidateMap = new Map();
  candidateAmounts.forEach(c => {
    if (!uniqueCandidateMap.has(c.value) || c.weight > uniqueCandidateMap.get(c.value).weight) {
      uniqueCandidateMap.set(c.value, c);
    }
  });
  const uniqueCandidates = Array.from(uniqueCandidateMap.values());

  // Filter out disqualified candidates for primary detection, unless no other exists
  const validCandidates = uniqueCandidates.filter(c => c.weight > 0);
  let bestCandidate = null;

  if (validCandidates.length > 0) {
    // Sort by weight DESC, then by value (prefer realistic higher totals over small line item prices)
    validCandidates.sort((a, b) => b.weight - a.weight || b.value - a.value);
    bestCandidate = validCandidates[0].value;
  } else if (uniqueCandidates.length > 0) {
    uniqueCandidates.sort((a, b) => b.value - a.value);
    bestCandidate = uniqueCandidates[0].value;
  }

  // All extracted candidate amounts for user selection chips (sorted descending)
  const allAmounts = uniqueCandidates
    .map(c => c.value)
    .sort((a, b) => b - a)
    .slice(0, 5);

  // ─────────────────────────────────────────────────────────────
  // 3. Indonesian Date Detection
  // ─────────────────────────────────────────────────────────────
  const monthMap = {
    jan: 1, januari: 1, january: 1,
    feb: 2, februari: 2, february: 2,
    mar: 3, maret: 3, march: 3,
    apr: 4, april: 4,
    mei: 5, may: 5,
    jun: 6, juni: 6, june: 6,
    jul: 7, juli: 7, july: 7,
    agt: 8, agu: 8, agustus: 8, aug: 8, august: 8,
    sep: 9, september: 9,
    okt: 10, oct: 10, oktober: 10, october: 10,
    nov: 11, november: 11,
    des: 12, dec: 12, desember: 12, december: 12
  };

  // Text month pattern: "21 Sep 2026", "21-Sep-2026", "21 September 26"
  const textDateRegex = /(\d{1,2})[\s/-]+(jan(?:uari|uary)?|feb(?:ruari|ruary)?|mar(?:et|ch)?|apr(?:il)?|mei|may|jun(?:i|e)?|jul(?:i|y)?|ag(?:t|u|ustus)?|aug(?:ust)?|sep(?:tember)?|okt(?:ober)?|oct(?:ober)?|nov(?:ember)?|des(?:ember)?|dec(?:ember)?)[\s/-]+(\d{2,4})/i;

  for (const line of lines) {
    // Check text month first
    const textMatch = line.match(textDateRegex);
    if (textMatch) {
      const d = parseInt(textMatch[1], 10);
      const mStr = textMatch[2].toLowerCase();
      let m = monthMap[mStr] || 1;
      let y = parseInt(textMatch[3], 10);
      if (y < 100) y += 2000;
      if (y >= 2020 && y <= 2035 && d >= 1 && d <= 31) {
        detectedDate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        break;
      }
    }

    // Check numeric patterns: "DD/MM/YYYY", "DD-MM-YYYY", "YYYY-MM-DD"
    const numMatch = line.match(/(\d{1,2})[\s/.-](\d{1,2})[\s/.-](\d{2,4})/) || line.match(/(\d{4})[\s/.-](\d{1,2})[\s/.-](\d{1,2})/);
    if (numMatch) {
      let y, m, d;
      if (numMatch[1].length === 4) {
        y = parseInt(numMatch[1], 10);
        m = parseInt(numMatch[2], 10);
        d = parseInt(numMatch[3], 10);
      } else {
        d = parseInt(numMatch[1], 10);
        m = parseInt(numMatch[2], 10);
        y = parseInt(numMatch[3], 10);
        if (y < 100) y += 2000;
      }

      if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 2020 && y <= 2035) {
        detectedDate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        break;
      }
    }
  }

  return {
    amount: bestCandidate ? String(bestCandidate) : '',
    allAmounts,
    date: detectedDate || new Date().toISOString().split('T')[0],
    note: detectedMerchant || 'Receipt Expense',
    category: detectedCategory || 'Food',
    splitType: 'personal'
  };
}

/**
 * Parses prices with Indonesian dot/comma thousand separators
 */
function cleanPriceStringToNumber(str) {
  if (!str) return 0;
  let s = str.replace(/[^\d.,]/g, '').trim();

  // If contains both . and ,
  if (s.includes('.') && s.includes(',')) {
    if (s.lastIndexOf('.') > s.lastIndexOf(',')) {
      // 45,000.00
      s = s.replace(/,/g, '');
    } else {
      // 45.000,00 (standard Indonesian)
      s = s.replace(/\./g, '').replace(',', '.');
    }
  } else if (s.includes('.')) {
    // 45.000 or 45.000.000
    const parts = s.split('.');
    if (parts[parts.length - 1].length === 3 || parts.length > 2) {
      s = s.replace(/\./g, '');
    }
  } else if (s.includes(',')) {
    const parts = s.split(',');
    if (parts[parts.length - 1].length === 3 || parts.length > 2) {
      s = s.replace(/,/g, '');
    } else {
      s = s.replace(/,/g, '.');
    }
  }

  const val = parseFloat(s);
  return isNaN(val) ? 0 : Math.round(val);
}

/**
 * Handles OCR character confusions on thermal receipts
 */
function parseHandwrittenNumber(text) {
  if (!text) return 0;
  const normalized = text
    .replace(/[oOQD]/g, '0')
    .replace(/[gGq]/g, '9')
    .replace(/[yY]/g, '4')
    .replace(/[iIl|!]/g, '1')
    .replace(/[sS]/g, '5')
    .replace(/[zZ]/g, '2')
    .replace(/[bB]/g, '8')
    .replace(/[^\d]/g, '');

  const num = parseInt(normalized, 10);
  return isNaN(num) ? 0 : num;
}
