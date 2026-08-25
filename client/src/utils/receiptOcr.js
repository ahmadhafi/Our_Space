/**
 * Smart Receipt & Handwriting OCR Engine
 * Optimized for mobile, fast startup, and Indonesian receipt formats.
 */

/**
 * Safely pre-processes an image on canvas to enhance contrast for both printed and handwritten text.
 */
async function preprocessReceiptImage(imageSource) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve(imageSource);
    }, 1500);

    try {
      const img = new Image();
      if (typeof imageSource === 'string' && imageSource.startsWith('http')) {
        img.crossOrigin = 'Anonymous';
      }

      img.onload = () => {
        clearTimeout(timeout);
        try {
          const maxDim = Math.max(img.width, img.height);
          const scale = maxDim > 0 && maxDim < 1000 ? Math.min(2, 1200 / maxDim) : 1;
          
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

          // Adaptive thresholding & contrast
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            let lum = 0.299 * r + 0.587 * g + 0.114 * b;

            // Darken ink, brighten paper
            if (lum < 135) {
              lum = lum * 0.7;
            } else {
              lum = Math.min(255, lum * 1.15 + 20);
            }

            data[i] = lum;
            data[i + 1] = lum;
            data[i + 2] = lum;
          }

          ctx.putImageData(imageData, 0, 0);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
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
 * Scan receipt with Tesseract OCR (Fast & Resilient)
 */
export async function scanReceiptImage(imageSource, onProgress = () => {}) {
  const ocrTask = async () => {
    onProgress({ status: 'Preparing image...', progress: 20 });
    const processedImage = await preprocessReceiptImage(imageSource);

    onProgress({ status: 'Reading receipt details...', progress: 40 });
    const { createWorker } = await import('tesseract.js');
    
    // Use 'eng' for ultra-fast startup (understands numbers, Rp, symbols, and latin text)
    const worker = await createWorker('eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          onProgress({ 
            status: 'Extracting amount and store name...', 
            progress: 40 + Math.round((m.progress || 0) * 50) 
          });
        }
      }
    });

    onProgress({ status: 'Parsing information...', progress: 90 });
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

  // 12-second total safety timeout so user is never stuck
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Scanner timed out. Please enter details.')), 12000);
  });

  return Promise.race([ocrTask(), timeoutPromise]);
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

  const fullTextLower = rawText.toLowerCase();

  // 1. Store / Category Detection
  if (fullTextLower.includes('laundry') || fullTextLower.includes('cuci') || fullTextLower.includes('setrika') || fullTextLower.includes('lipat') || fullTextLower.includes('kiloan')) {
    detectedMerchant = 'Laundry';
    detectedCategory = 'Bills';
  } else if (fullTextLower.includes('bengkel') || fullTextLower.includes('tambal') || fullTextLower.includes('spbu') || fullTextLower.includes('pertamina') || fullTextLower.includes('shell') || fullTextLower.includes('grab') || fullTextLower.includes('gojek')) {
    detectedMerchant = fullTextLower.includes('spbu') ? 'SPBU Pertamina' : (fullTextLower.includes('grab') ? 'Grab' : (fullTextLower.includes('gojek') ? 'Gojek' : 'Transport'));
    detectedCategory = 'Transport';
  } else if (fullTextLower.includes('indomaret') || fullTextLower.includes('alfamart') || fullTextLower.includes('superindo') || fullTextLower.includes('hypermart') || fullTextLower.includes('resto') || fullTextLower.includes('cafe') || fullTextLower.includes('kopi')) {
    detectedMerchant = fullTextLower.includes('indomaret') ? 'Indomaret' : (fullTextLower.includes('alfamart') ? 'Alfamart' : (fullTextLower.includes('superindo') ? 'Superindo' : 'Food & Groceries'));
    detectedCategory = 'Food';
  } else if (fullTextLower.includes('apotek') || fullTextLower.includes('k-24') || fullTextLower.includes('kimia farma') || fullTextLower.includes('klinik') || fullTextLower.includes('obat')) {
    detectedMerchant = 'Pharmacy';
    detectedCategory = 'Healthcare';
  } else if (fullTextLower.includes('pln') || fullTextLower.includes('listrik') || fullTextLower.includes('wifi') || fullTextLower.includes('indihome') || fullTextLower.includes('pdam') || fullTextLower.includes('air')) {
    detectedMerchant = 'Utility Bill';
    detectedCategory = 'Bills';
  }

  if (!detectedMerchant) {
    for (const line of lines.slice(0, 5)) {
      const cleanLine = line.replace(/[^a-zA-Z0-9 &.,'/-]/g, '').trim();
      if (cleanLine.length >= 3 && !cleanLine.match(/^\d+$/) && !cleanLine.toLowerCase().startsWith('nama') && !cleanLine.toLowerCase().startsWith('no') && !cleanLine.toLowerCase().startsWith('tanggal')) {
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

    // Standard Price match: 49.000, 49,000, 49000
    const priceMatches = line.match(/(?:rp|idr)?\s*([0-9]{1,3}(?:[.,][0-9]{3})+(?:[.,][0-9]{2})?|[0-9]{4,9})/gi);
    if (priceMatches) {
      for (const p of priceMatches) {
        const num = cleanPriceStringToNumber(p);
        if (num >= 500 && num <= 1000000000) {
          amountsFound.push({ value: num, isTotalLine: hasTotalKeyword, weight: hasTotalKeyword ? 15 : 3 });
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
          weight: 20
        });
      }
    }
  }

  if (amountsFound.length > 0) {
    const totalLines = amountsFound.filter(a => a.isTotalLine);
    if (totalLines.length > 0) {
      totalLines.sort((a, b) => b.weight - a.weight || b.value - a.value);
      detectedAmount = totalLines[0].value;
    } else {
      amountsFound.sort((a, b) => b.value - a.value);
      detectedAmount = amountsFound[0].value;
    }
  }

  // 3. Date Detection (e.g. 23/8/26, 23-08-2026, 2026-08-23)
  const datePatterns = [
    /(\d{1,2})[\s/.-]+(\d{1,2})[\s/.-]+(\d{2,4})/,
    /(\d{4})[\s/.-]+(\d{1,2})[\s/.-]+(\d{1,2})/
  ];

  for (const line of lines) {
    for (const pattern of datePatterns) {
      const match = line.match(pattern);
      if (match) {
        let y, m, d;
        if (match[1].length === 4) {
          y = parseInt(match[1], 10);
          m = parseInt(match[2], 10);
          d = parseInt(match[3], 10);
        } else {
          d = parseInt(match[1], 10);
          m = parseInt(match[2], 10);
          y = parseInt(match[3], 10);
          if (y < 100) y += 2000;
        }

        if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 2020 && y <= 2035) {
          detectedDate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          break;
        }
      }
    }
    if (detectedDate) break;
  }

  return {
    amount: detectedAmount ? String(detectedAmount) : '',
    date: detectedDate || new Date().toISOString().split('T')[0],
    note: detectedMerchant || 'Receipt Expense',
    category: detectedCategory || 'Food',
    splitType: 'personal'
  };
}

function cleanPriceStringToNumber(str) {
  if (!str) return 0;
  let s = str.replace(/[^\d.,]/g, '').trim();
  if (s.includes(',') && !s.includes('.')) {
    const parts = s.split(',');
    if (parts[parts.length - 1].length === 3) {
      s = s.replace(/,/g, '');
    } else {
      s = s.replace(/,/g, '.');
    }
  } else if (s.includes('.') && s.includes(',')) {
    if (s.lastIndexOf('.') > s.lastIndexOf(',')) {
      s = s.replace(/,/g, '');
    } else {
      s = s.replace(/\./g, '').replace(',', '.');
    }
  } else if (s.includes('.')) {
    const parts = s.split('.');
    if (parts[parts.length - 1].length === 3) {
      s = s.replace(/\./g, '');
    }
  }
  const val = parseFloat(s);
  return isNaN(val) ? 0 : Math.round(val);
}

function parseHandwrittenNumber(text) {
  if (!text) return 0;
  let normalized = text
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
