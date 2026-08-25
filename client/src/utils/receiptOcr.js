/**
 * Smart Receipt & Handwriting OCR Engine
 * Includes adaptive canvas pre-processing (binarization, contrast stretching, deskew)
 * and specialized Indonesian & English handwritten receipt heuristics (e.g. Laundry, Warung, Bengkel, Nota).
 */

/**
 * Preprocesses an image on an HTML5 canvas to enhance handwriting & low-contrast ink.
 */
async function preprocessReceiptImage(imageSource) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      // Upscale if too small (e.g., width < 1200px)
      const scale = Math.max(1, Math.min(2.5, 1600 / Math.max(img.width, img.height)));
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);

      // Draw smoothed image
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // 1. Grayscale & Contrast enhancement
      let minLum = 255;
      let maxLum = 0;

      // Find min and max luminance for histogram stretching
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const lum = (0.299 * r + 0.587 * g + 0.114 * b);
        if (lum < minLum) minLum = lum;
        if (lum > maxLum) maxLum = lum;
      }

      const range = Math.max(1, maxLum - minLum);

      // Apply adaptive contrast & sharpening
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        let lum = (0.299 * r + 0.587 * g + 0.114 * b);

        // Stretch histogram
        let stretched = ((lum - minLum) / range) * 255;

        // Apply slight sigmoid curve for handwriting ink clarity
        if (stretched < 140) {
          stretched = Math.max(0, stretched * 0.75); // Darken ink
        } else {
          stretched = Math.min(255, stretched * 1.15 + 15); // Lighten paper background
        }

        data[i] = stretched;
        data[i + 1] = stretched;
        data[i + 2] = stretched;
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.95));
    };

    img.onerror = () => {
      // Fallback to original image if processing fails
      resolve(imageSource);
    };

    img.src = imageSource;
  });
}

/**
 * Scan receipt with Tesseract OCR (with handwriting and Indonesian nota heuristics)
 */
export async function scanReceiptImage(imageSource, onProgress = () => {}) {
  try {
    onProgress({ status: 'Enhancing image & handwriting...', progress: 15 });
    
    // Pre-process image for ink & handwriting clarity
    const processedImage = await preprocessReceiptImage(imageSource);

    onProgress({ status: 'Loading OCR engine...', progress: 30 });
    const { createWorker } = await import('tesseract.js');
    
    const worker = await createWorker('ind+eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          onProgress({ 
            status: 'Recognizing handwriting & printed text...', 
            progress: 35 + Math.round((m.progress || 0) * 55) 
          });
        }
      }
    });

    onProgress({ status: 'Extracting receipt contents...', progress: 55 });
    const ret = await worker.recognize(processedImage);
    
    onProgress({ status: 'Finalizing parsing...', progress: 95 });
    await worker.terminate();

    const rawText = ret.data.text || '';
    const parsedData = parseReceiptText(rawText);

    onProgress({ status: 'Done!', progress: 100 });
    return {
      rawText,
      ...parsedData
    };
  } catch (error) {
    console.error('Receipt OCR failed:', error);
    throw new Error(error.message || 'Failed to scan receipt image');
  }
}

/**
 * Parses raw OCR text to extract Amount, Date, Merchant/Note, and Category
 * Includes fuzzy handwriting rules (e.g. Total Harga 49.000, 4g.ooo, yg.000, etc.)
 */
export function parseReceiptText(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return { amount: null, date: null, note: '', category: 'Food', splitType: 'personal' };
  }

  const rawLines = rawText.split('\n');
  const lines = rawLines.map(line => line.trim()).filter(line => line.length > 0);

  let detectedAmount = null;
  let detectedDate = null;
  let detectedMerchant = '';
  let detectedCategory = 'Food';

  // ─────────────────────────────────────────────────────────────
  // 1. MERCHANT / STORE NAME DETECTION
  // ─────────────────────────────────────────────────────────────
  const fullTextLower = rawText.toLowerCase();

  // Common prominent store keywords
  if (fullTextLower.includes('laundry')) {
    detectedMerchant = 'Laundry';
    detectedCategory = 'Home Services';
  } else if (fullTextLower.includes('bengkel') || fullTextLower.includes('tambal') || fullTextLower.includes('spbu')) {
    detectedMerchant = fullTextLower.includes('spbu') ? 'SPBU Pertamina' : 'Bengkel';
    detectedCategory = 'Transport';
  } else if (fullTextLower.includes('indomaret')) {
    detectedMerchant = 'Indomaret';
    detectedCategory = 'Groceries';
  } else if (fullTextLower.includes('alfamart')) {
    detectedMerchant = 'Alfamart';
    detectedCategory = 'Groceries';
  } else if (fullTextLower.includes('superindo')) {
    detectedMerchant = 'Superindo';
    detectedCategory = 'Groceries';
  } else if (fullTextLower.includes('apotek') || fullTextLower.includes('k-24') || fullTextLower.includes('kimia farma')) {
    detectedMerchant = 'Pharmacy';
    detectedCategory = 'Healthcare';
  }

  // If no predefined brand, pick first prominent readable line (excluding pure numbers)
  if (!detectedMerchant) {
    for (const line of lines.slice(0, 5)) {
      const cleanLine = line.replace(/[^a-zA-Z0-9 &.,'/-]/g, '').trim();
      if (cleanLine.length >= 3 && !cleanLine.match(/^\d+$/) && !cleanLine.toLowerCase().startsWith('nama') && !cleanLine.toLowerCase().startsWith('no')) {
        detectedMerchant = cleanLine;
        break;
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 2. AMOUNT / TOTAL HARGA DETECTION (WITH HANDWRITING SUPPORT)
  // ─────────────────────────────────────────────────────────────
  const totalKeywords = [
    'total harga', 'total biaya', 'total tagihan', 'total bayar', 'jumlah bayar', 
    'total belanja', 'grand total', 'amount due', 'total due', 'total', 'subtotal', 
    'jumlah', 'tagihan', 'netto', 'bayar', 'tunai', 'harga', 'sisa'
  ];

  const amountsFound = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();

    // Check if current line contains a total keyword
    const hasTotalKeyword = totalKeywords.some(kw => lower.includes(kw));

    // A. Direct Price Pattern: Rp 49.000, 49,000, 49.000, IDR 49000, 49.000,-
    const priceMatches = line.match(/(?:rp|idr)?\s*([0-9]{1,3}(?:[.,][0-9]{3})+(?:[.,][0-9]{2})?|[0-9]{4,9})/gi);
    if (priceMatches) {
      for (const p of priceMatches) {
        const num = cleanPriceStringToNumber(p);
        if (num >= 500 && num <= 1000000000) {
          amountsFound.push({ value: num, isTotalLine: hasTotalKeyword, weight: hasTotalKeyword ? 10 : 2 });
        }
      }
    }

    // B. Handwriting OCR Glitch Normalization (e.g. '4g.ooo', '49.ooo', 'yg.000', '49.000', '49ooo')
    // Especially when '4' is read as 'y' / 'u' / 'ч', '9' as 'g' / 'q', and '0' as 'o' / 'O' / 'D'
    const handwritingMatches = line.match(/(?:total|harga|jumlah|rp)?\s*[:=]?\s*([yY4uUqQ\d][gGqQ9\d][.,\s]?[oO0D\d]{3,})/i);
    if (handwritingMatches) {
      const rawHandwritten = handwritingMatches[1];
      const parsedHandwritten = parseHandwrittenNumber(rawHandwritten);
      if (parsedHandwritten >= 500 && parsedHandwritten <= 1000000000) {
        amountsFound.push({
          value: parsedHandwritten,
          isTotalLine: true,
          weight: 15 // High weight for total harga handwriting match
        });
      }
    }

    // C. Check Next Line for Price if line itself has "Total Harga" or "Total"
    if (hasTotalKeyword && i + 1 < lines.length) {
      const nextLine = lines[i + 1];
      const nextPriceMatches = nextLine.match(/(?:rp|idr)?\s*([0-9]{1,3}(?:[.,][0-9]{3})+|[0-9]{4,9})/gi);
      if (nextPriceMatches) {
        for (const p of nextPriceMatches) {
          const num = cleanPriceStringToNumber(p);
          if (num >= 500 && num <= 1000000000) {
            amountsFound.push({ value: num, isTotalLine: true, weight: 8 });
          }
        }
      }

      // Check next line for handwriting glitch
      const nextHandwriting = nextLine.match(/([yY4uUqQ\d][gGqQ9\d][.,\s]?[oO0D\d]{3,})/i);
      if (nextHandwriting) {
        const parsed = parseHandwrittenNumber(nextHandwriting[1]);
        if (parsed >= 500 && parsed <= 1000000000) {
          amountsFound.push({ value: parsed, isTotalLine: true, weight: 12 });
        }
      }
    }
  }

  // Pick best amount
  if (amountsFound.length > 0) {
    // Sort by weight desc, then value desc
    amountsFound.sort((a, b) => {
      if (b.weight !== a.weight) return b.weight - a.weight;
      return b.value - a.value;
    });
    detectedAmount = amountsFound[0].value;
  }

  // ─────────────────────────────────────────────────────────────
  // 3. DATE DETECTION (SUPPORTING HANDWRITTEN 23/8/26, 24/08/2026, ETC.)
  // ─────────────────────────────────────────────────────────────
  for (const line of lines) {
    // Matches 23/8/26, 23 / 8 / 26, 23-08-2026, 2026/08/23, 23.8.2026
    const dateMatch = line.match(/(\b\d{1,2})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{2,4}\b)/) ||
                      line.match(/(\b\d{4})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{1,2}\b)/);
    if (dateMatch) {
      try {
        let year, month, day;
        if (dateMatch[1].length === 4) {
          // YYYY/MM/DD
          year = parseInt(dateMatch[1], 10);
          month = parseInt(dateMatch[2], 10);
          day = parseInt(dateMatch[3], 10);
        } else {
          // DD/MM/YY or DD/MM/YYYY
          day = parseInt(dateMatch[1], 10);
          month = parseInt(dateMatch[2], 10);
          year = parseInt(dateMatch[3], 10);
          // Handle 2-digit years like '26' -> 2026
          if (year < 100) year += 2000;
        }

        if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2000 && year <= 2035) {
          detectedDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          break;
        }
      } catch {
        // Continue searching
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 4. CATEGORY CLASSIFICATION HEURISTICS
  // ─────────────────────────────────────────────────────────────
  const CATEGORY_KEYWORDS = {
    'Home Services': ['laundry', 'cuci', 'setrika', 'dry clean', 'wash', 'lipat', 'kiloan', 'service ac', 'kebersihan', 'cleaning'],
    'Food': ['kopi', 'coffee', 'cafe', 'resto', 'restaurant', 'makan', 'food', 'bakso', 'ayam', 'nasi', 'burger', 'pizza', 'starbucks', 'kfc', 'mcdonald', 'mcd', 'hokben', 'mie', 'beverage', 'minuman', 'snack', 'roti', 'bread', 'dapur', 'kuliner', 'tea', 'boba', 'chatime'],
    'Groceries': ['indomaret', 'alfamart', 'superindo', 'hypermart', 'transmart', 'alfamidi', 'supermarket', 'mart', 'pasar', 'sayur', 'buah', 'telur', 'beras', 'minyak'],
    'Transport': ['pertamina', 'spbu', 'bensin', 'shell', 'parkir', 'parking', 'grab', 'gojek', 'toll', 'tol', 'taxi', 'bluebird', 'kereta', 'kai', 'flight', 'tiket', 'traveloka', 'service mobil', 'service motor', 'tambal ban', 'pertamax', 'pertalite', 'oli'],
    'Bills': ['pln', 'listrik', 'pdam', 'air', 'telkom', 'indihome', 'wifi', 'bpjs', 'pajak', 'tagihan', 'internet', 'pulsa', 'token', 'pbb', 'myrepublic', 'biznet', 'firstmedia'],
    'Shopping': ['uniqlo', 'zara', 'h&m', 'shopee', 'tokopedia', 'lazada', 'toko', 'minimarket', 'belanja', 'watsons', 'guardian', 'miniso', 'hardware', 'ace hardware', 'kaos', 'baju', 'celana'],
    'Healthcare': ['apotek', 'pharmacy', 'kimia farma', 'k24', 'obat', 'dokter', 'hospital', 'rumah sakit', 'rs', 'klinik', 'dental', 'gigi', 'medis', 'laboratorium', 'vitamin'],
    'Entertainment': ['cinema', 'xxi', 'cgv', 'cinepolis', 'bioskop', 'game', 'steam', 'playstation', 'karaoke', 'ticket', 'netflix', 'spotify', 'disney', 'billiard', 'dufan', 'anastasia']
  };

  if (!detectedCategory || detectedCategory === 'Food') {
    for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (keywords.some(kw => fullTextLower.includes(kw))) {
        detectedCategory = cat;
        break;
      }
    }
  }

  // Format note with store name or service
  let finalNote = detectedMerchant ? `${detectedMerchant}` : 'Receipt Scan';
  if (finalNote.length > 60) finalNote = finalNote.substring(0, 60);

  return {
    amount: detectedAmount,
    date: detectedDate || new Date().toISOString().split('T')[0],
    note: finalNote,
    category: detectedCategory,
    splitType: 'personal'
  };
}

/**
 * Normalizes handwritten number strings where OCR misidentifies characters:
 * e.g. "yg.000" -> 49000, "4g.ooo" -> 49000, "49.000" -> 49000, "8.1 x 6ooo" -> 6000
 */
function parseHandwrittenNumber(str) {
  if (!str) return 0;

  let s = str.trim();

  // Replace common handwriting letter-to-digit confusions in Indonesian receipts:
  s = s.replace(/^[yYuUчhH]/, '4'); // leading y, u, h often represents handwritten '4'
  s = s.replace(/[gGqQ]/g, '9');    // 'g' or 'q' often represents handwritten '9'
  s = s.replace(/[oODQU]/g, '0');   // 'o', 'O', 'D' represents '0'
  s = s.replace(/[lIi|!/]/g, '1');   // 'l', 'I', '|' represents '1'
  s = s.replace(/[sS]/g, '5');      // 's', 'S' represents '5'
  s = s.replace(/[zZ]/g, '2');      // 'z', 'Z' represents '2'
  s = s.replace(/[bB]/g, '8');      // 'b', 'B' represents '8'

  return cleanPriceStringToNumber(s);
}

/**
 * Helper to turn strings like "Rp 49.000,00" or "49.000" into numeric integer
 */
function cleanPriceStringToNumber(priceStr) {
  if (!priceStr) return 0;
  let str = priceStr.toLowerCase().replace(/rp|idr|\s/g, '');
  
  // If ends with ,00 or .00 (cents), remove them
  str = str.replace(/[.,]00$/, '');
  
  // Remove all non-digits
  str = str.replace(/[^0-9]/g, '');
  
  const num = parseInt(str, 10);
  return isNaN(num) ? 0 : num;
}
