/**
 * Smart Receipt & Handwriting OCR Engine
 * Includes safe adaptive canvas pre-processing and Indonesian/English receipt heuristics.
 */

/**
 * Safely pre-processes an image on a canvas to enhance handwriting & contrast.
 * Guaranteed to resolve within timeout and never throw or block.
 */
async function preprocessReceiptImage(imageSource) {
  return new Promise((resolve) => {
    // Timeout guard so processing never hangs
    const timeout = setTimeout(() => {
      resolve(imageSource);
    }, 2000);

    try {
      const img = new Image();
      // Only set crossOrigin if http(s) URL to avoid data URI issues
      if (typeof imageSource === 'string' && imageSource.startsWith('http')) {
        img.crossOrigin = 'Anonymous';
      }

      img.onload = () => {
        clearTimeout(timeout);
        try {
          const maxDim = Math.max(img.width, img.height);
          const scale = maxDim > 0 && maxDim < 1200 ? Math.min(2, 1400 / maxDim) : 1;
          
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) {
            return resolve(imageSource);
          }

          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);

          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;

          // Contrast & brightness enhancement for ink
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            let lum = 0.299 * r + 0.587 * g + 0.114 * b;

            // Darken ink, brighten background
            if (lum < 130) {
              lum = lum * 0.75;
            } else {
              lum = Math.min(255, lum * 1.15 + 15);
            }

            data[i] = lum;
            data[i + 1] = lum;
            data[i + 2] = lum;
          }

          ctx.putImageData(imageData, 0, 0);
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
 * Scan receipt with Tesseract OCR
 */
export async function scanReceiptImage(imageSource, onProgress = () => {}) {
  try {
    onProgress({ status: 'Optimizing image contrast...', progress: 15 });
    
    // Safely enhance image
    const processedImage = await preprocessReceiptImage(imageSource);

    onProgress({ status: 'Loading recognition model...', progress: 30 });
    const { createWorker } = await import('tesseract.js');
    
    let worker;
    try {
      worker = await createWorker('ind+eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            onProgress({ 
              status: 'Reading receipt details & amounts...', 
              progress: 35 + Math.round((m.progress || 0) * 55) 
            });
          }
        }
      });
    } catch {
      worker = await createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            onProgress({ 
              status: 'Reading receipt details & amounts...', 
              progress: 35 + Math.round((m.progress || 0) * 55) 
            });
          }
        }
      });
    }

    onProgress({ status: 'Extracting fields...', progress: 60 });
    const ret = await worker.recognize(processedImage);
    
    onProgress({ status: 'Finalizing parsing...', progress: 95 });
    await worker.terminate();

    const rawText = ret?.data?.text || '';
    const parsedData = parseReceiptText(rawText);

    onProgress({ status: 'Done!', progress: 100 });
    return {
      rawText,
      ...parsedData
    };
  } catch (error) {
    console.error('Receipt OCR failed:', error);
    throw new Error(error.message || 'Failed to scan receipt image. You can still input manually.');
  }
}

/**
 * Parses raw OCR text to extract Amount, Date, Merchant/Note, and Standard Category
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

  // 1. Merchant / Store Name Detection
  const fullTextLower = rawText.toLowerCase();

  if (fullTextLower.includes('laundry') || fullTextLower.includes('cuci') || fullTextLower.includes('setrika')) {
    detectedMerchant = 'Laundry';
    detectedCategory = 'Bills';
  } else if (fullTextLower.includes('bengkel') || fullTextLower.includes('tambal') || fullTextLower.includes('spbu') || fullTextLower.includes('pertamina')) {
    detectedMerchant = fullTextLower.includes('spbu') ? 'SPBU Pertamina' : 'Bengkel';
    detectedCategory = 'Transport';
  } else if (fullTextLower.includes('indomaret') || fullTextLower.includes('alfamart') || fullTextLower.includes('superindo')) {
    detectedMerchant = fullTextLower.includes('indomaret') ? 'Indomaret' : (fullTextLower.includes('alfamart') ? 'Alfamart' : 'Superindo');
    detectedCategory = 'Food';
  } else if (fullTextLower.includes('apotek') || fullTextLower.includes('k-24') || fullTextLower.includes('kimia farma')) {
    detectedMerchant = 'Pharmacy';
    detectedCategory = 'Healthcare';
  }

  if (!detectedMerchant) {
    for (const line of lines.slice(0, 5)) {
      const cleanLine = line.replace(/[^a-zA-Z0-9 &.,'/-]/g, '').trim();
      if (cleanLine.length >= 3 && !cleanLine.match(/^\d+$/) && !cleanLine.toLowerCase().startsWith('nama') && !cleanLine.toLowerCase().startsWith('no')) {
        detectedMerchant = cleanLine;
        break;
      }
    }
  }

  // 2. Amount / Total Detection
  const totalKeywords = [
    'total harga', 'total biaya', 'total tagihan', 'total bayar', 'jumlah bayar', 
    'total belanja', 'grand total', 'amount due', 'total due', 'total', 'subtotal', 
    'jumlah', 'tagihan', 'netto', 'bayar', 'tunai', 'harga'
  ];

  const amountsFound = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();
    const hasTotalKeyword = totalKeywords.some(kw => lower.includes(kw));

    // Price matches
    const priceMatches = line.match(/(?:rp|idr)?\s*([0-9]{1,3}(?:[.,][0-9]{3})+(?:[.,][0-9]{2})?|[0-9]{4,9})/gi);
    if (priceMatches) {
      for (const p of priceMatches) {
        const num = cleanPriceStringToNumber(p);
        if (num >= 500 && num <= 1000000000) {
          amountsFound.push({ value: num, isTotalLine: hasTotalKeyword, weight: hasTotalKeyword ? 10 : 2 });
        }
      }
    }

    // Handwriting glitched numbers (e.g. '4g.ooo', 'yg.000', '49.000', '49ooo')
    const handwritingMatches = line.match(/(?:total|harga|jumlah|rp)?\s*[:=]?\s*([yY4uUqQ\d][gGqQ9\d][.,\s]?[oO0D\d]{3,})/i);
    if (handwritingMatches) {
      const parsedHandwritten = parseHandwrittenNumber(handwritingMatches[1]);
      if (parsedHandwritten >= 500 && parsedHandwritten <= 1000000000) {
        amountsFound.push({
          value: parsedHandwritten,
          isTotalLine: true,
          weight: 15
        });
      }
    }
  }

  if (amountsFound.length > 0) {
    amountsFound.sort((a, b) => {
      if (b.weight !== a.weight) return b.weight - a.weight;
      return b.value - a.value;
    });
    detectedAmount = amountsFound[0].value;
  }

  // 3. Date Detection
  for (const line of lines) {
    const dateMatch = line.match(/(\b\d{1,2})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{2,4}\b)/) ||
                      line.match(/(\b\d{4})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{1,2}\b)/);
    if (dateMatch) {
      try {
        let year, month, day;
        if (dateMatch[1].length === 4) {
          year = parseInt(dateMatch[1], 10);
          month = parseInt(dateMatch[2], 10);
          day = parseInt(dateMatch[3], 10);
        } else {
          day = parseInt(dateMatch[1], 10);
          month = parseInt(dateMatch[2], 10);
          year = parseInt(dateMatch[3], 10);
          if (year < 100) year += 2000;
        }

        if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2000 && year <= 2035) {
          detectedDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          break;
        }
      } catch {
        // continue
      }
    }
  }

  // 4. Standard Valid Category Mapping
  const CATEGORY_MAP = {
    'Food': ['kopi', 'coffee', 'cafe', 'resto', 'restaurant', 'makan', 'food', 'bakso', 'ayam', 'nasi', 'burger', 'pizza', 'starbucks', 'kfc', 'mcdonald', 'mcd', 'hokben', 'mie', 'beverage', 'minuman', 'snack', 'roti', 'bread', 'dapur', 'kuliner', 'tea', 'boba', 'chatime', 'superindo', 'alfamart', 'indomaret', 'pasar'],
    'Transport': ['pertamina', 'spbu', 'bensin', 'shell', 'parkir', 'parking', 'grab', 'gojek', 'toll', 'tol', 'taxi', 'bluebird', 'kereta', 'kai', 'flight', 'tiket', 'traveloka', 'service mobil', 'service motor', 'tambal ban', 'pertamax', 'pertalite', 'oli', 'bengkel'],
    'Bills': ['laundry', 'cuci', 'setrika', 'dry clean', 'wash', 'lipat', 'kiloan', 'pln', 'listrik', 'pdam', 'air', 'telkom', 'indihome', 'wifi', 'bpjs', 'pajak', 'tagihan', 'internet', 'pulsa', 'token', 'pbb', 'biznet'],
    'Healthcare': ['apotek', 'pharmacy', 'kimia farma', 'k24', 'obat', 'dokter', 'hospital', 'rumah sakit', 'rs', 'klinik', 'dental', 'gigi', 'medis', 'vitamin'],
    'Entertainment': ['cinema', 'xxi', 'cgv', 'cinepolis', 'bioskop', 'game', 'steam', 'playstation', 'karaoke', 'ticket', 'netflix', 'spotify', 'disney', 'billiard'],
    'Other': ['shopee', 'tokopedia', 'lazada', 'toko', 'belanja', 'uniqlo', 'zara', 'h&m', 'miniso', 'hardware']
  };

  for (const [cat, keywords] of Object.entries(CATEGORY_MAP)) {
    if (keywords.some(kw => fullTextLower.includes(kw))) {
      detectedCategory = cat;
      break;
    }
  }

  let finalNote = detectedMerchant ? `${detectedMerchant}` : 'Receipt Scan';
  if (finalNote.length > 50) finalNote = finalNote.substring(0, 50);

  return {
    amount: detectedAmount,
    date: detectedDate || new Date().toISOString().split('T')[0],
    note: finalNote,
    category: detectedCategory,
    splitType: 'personal'
  };
}

function parseHandwrittenNumber(str) {
  if (!str) return 0;
  let s = str.trim();
  s = s.replace(/^[yYuUчhH]/, '4');
  s = s.replace(/[gGqQ]/g, '9');
  s = s.replace(/[oODQU]/g, '0');
  s = s.replace(/[lIi|!/]/g, '1');
  s = s.replace(/[sS]/g, '5');
  s = s.replace(/[zZ]/g, '2');
  s = s.replace(/[bB]/g, '8');
  return cleanPriceStringToNumber(s);
}

function cleanPriceStringToNumber(priceStr) {
  if (!priceStr) return 0;
  let str = priceStr.toLowerCase().replace(/rp|idr|\s/g, '');
  str = str.replace(/[.,]00$/, '');
  str = str.replace(/[^0-9]/g, '');
  const num = parseInt(str, 10);
  return isNaN(num) ? 0 : num;
}
