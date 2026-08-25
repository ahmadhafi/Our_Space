/**
 * Smart Receipt OCR Engine & Parser
 * Uses Tesseract.js on-demand with custom heuristics for Indonesian & English receipts.
 */

export async function scanReceiptImage(imageSource, onProgress = () => {}) {
  try {
    onProgress({ status: 'Loading OCR Engine...', progress: 10 });
    const { createWorker } = await import('tesseract.js');
    
    onProgress({ status: 'Initializing recognition model...', progress: 25 });
    const worker = await createWorker('eng+ind', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          onProgress({ 
            status: 'Reading receipt details...', 
            progress: 30 + Math.round((m.progress || 0) * 60) 
          });
        }
      }
    });

    onProgress({ status: 'Processing receipt image...', progress: 50 });
    const ret = await worker.recognize(imageSource);
    
    onProgress({ status: 'Finalizing parsed fields...', progress: 95 });
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
 * Parses raw OCR text to extract Amount, Date, Merchant/Note, and Suggested Category
 */
export function parseReceiptText(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return { amount: null, date: null, note: '', category: 'Food', splitType: 'personal' };
  }

  const lines = rawText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  let detectedAmount = null;
  let detectedDate = null;
  let detectedMerchant = '';
  let detectedCategory = 'Food';

  // 1. Merchant Detection: Check first 4 lines for prominent store names or titles
  const cleanFirstLines = lines.slice(0, 5).filter(l => !l.match(/^\d+$/) && l.length > 2);
  if (cleanFirstLines.length > 0) {
    detectedMerchant = cleanFirstLines[0].replace(/[^a-zA-Z0-9 &.'-]/g, '').trim();
  }

  // 2. Amount Detection
  // Keywords indicating totals in Indonesian & English
  const totalKeywords = [
    'grand total', 'total tagihan', 'total bayar', 'jumlah bayar', 'total belanja', 
    'total due', 'amount due', 'total', 'subtotal', 'jumlah', 'tagihan', 'netto', 'bayar', 'tunai'
  ];

  const amountsFound = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();

    // Check if line contains a total keyword
    const hasTotalKeyword = totalKeywords.some(kw => lower.includes(kw));

    // Match currency amounts: Rp 125.000, IDR 50.000, 125,000, 45.000, etc.
    const priceMatches = line.match(/(?:rp|idr)?\s*([0-9]{1,3}(?:[.,][0-9]{3})+(?:[.,][0-9]{2})?|[0-9]{4,9})/gi);
    
    if (priceMatches) {
      for (const rawPrice of priceMatches) {
        const cleaned = cleanPriceStringToNumber(rawPrice);
        if (cleaned > 0 && cleaned < 1000000000) { // Reasonable transaction range
          amountsFound.push({
            value: cleaned,
            isTotalLine: hasTotalKeyword,
            lineIndex: i
          });
        }
      }
    }
  }

  // Prioritize explicit Total/Grand Total line amounts
  const totalLineMatch = amountsFound.filter(a => a.isTotalLine);
  if (totalLineMatch.length > 0) {
    // Pick the largest amount found on total lines (usually Grand Total)
    detectedAmount = Math.max(...totalLineMatch.map(a => a.value));
  } else if (amountsFound.length > 0) {
    // Fallback: pick the largest amount in the receipt
    detectedAmount = Math.max(...amountsFound.map(a => a.value));
  }

  // 3. Date Detection (DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, DD Mon YYYY)
  for (const line of lines) {
    const dateMatch = line.match(/(\b\d{1,2})[/-](\d{1,2})[/-](\d{2,4}\b)/) ||
                      line.match(/(\b\d{4})[/-](\d{1,2})[/-](\d{1,2}\b)/);
    if (dateMatch) {
      try {
        let year, month, day;
        if (dateMatch[1].length === 4) {
          year = parseInt(dateMatch[1]);
          month = parseInt(dateMatch[2]);
          day = parseInt(dateMatch[3]);
        } else {
          day = parseInt(dateMatch[1]);
          month = parseInt(dateMatch[2]);
          year = parseInt(dateMatch[3]);
          if (year < 100) year += 2000;
        }

        if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2000 && year <= 2030) {
          detectedDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          break;
        }
      } catch {
        // Continue searching
      }
    }
  }

  // 4. Category Classification Heuristics
  const fullTextLower = rawText.toLowerCase();

  const CATEGORY_KEYWORDS = {
    'Food': ['kopi', 'coffee', 'cafe', 'resto', 'restaurant', 'makan', 'food', 'bakso', 'ayam', 'nasi', 'burger', 'pizza', 'starbucks', 'kfc', 'mcdonald', 'mcd', 'hokben', 'mie', 'beverage', 'minuman', 'snack', 'roti', 'bread', 'dapur', 'kuliner', 'tea', 'boba', 'chatime'],
    'Bills': ['pln', 'listrik', 'pdam', 'air', 'telkom', 'indihome', 'wifi', 'bpjs', 'pajak', 'tagihan', 'internet', 'pulsa', 'token', 'pbb', 'myrepublic', 'biznet', 'firstmedia'],
    'Transport': ['pertamina', 'spbu', 'bensin', 'shell', 'parkir', 'parking', 'grab', 'gojek', 'toll', 'tol', 'taxi', 'bluebird', 'kereta', 'kai', 'flight', 'tiket', 'traveloka', 'service mobil', 'service motor', 'tambal ban', 'pertamax', 'pertalite'],
    'Shopping': ['indomaret', 'alfamart', 'superindo', 'hypermart', 'transmart', 'alfamidi', 'uniqlo', 'zara', 'h&m', 'shopee', 'tokopedia', 'lazada', 'toko', 'minimarket', 'grocery', 'supermarket', 'mart', 'belanja', 'watsons', 'guardian', 'miniso', 'hardware', 'ace hardware'],
    'Healthcare': ['apotek', 'pharmacy', 'kimia farma', 'k24', 'obat', 'dokter', 'hospital', 'rumah sakit', 'rs', 'klinik', 'dental', 'gigi', 'medis', 'laboratorium', 'vitamin'],
    'Entertainment': ['cinema', 'xxi', 'cgv', 'cinepolis', 'bioskop', 'game', 'steam', 'playstation', 'karaoke', 'ticket', 'netflix', 'spotify', 'disney', 'billiard', 'dufan', 'anastasia'],
    'Loan Payment': ['cicilan', 'angsuran', 'kredit', 'loan', 'pinjaman', 'debt', 'bca finance', 'adira', 'fif', 'oto', 'paylater', 'kredivo', 'akulaku'],
    'Education': ['buku', 'gramedia', 'kursus', 'course', 'sekolah', 'kampus', 'universitas', 'biaya kuliah', 'spp', 'udemy'],
    'Investment': ['bibit', 'bareksa', 'ajaib', 'stockbit', 'crypto', 'indodax', 'toko crypto', 'reksadana', 'saham', 'emas', 'antam']
  };

  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => fullTextLower.includes(kw))) {
      detectedCategory = cat;
      break;
    }
  }

  // Format note with store name if found
  let finalNote = detectedMerchant ? `${detectedMerchant}` : '';
  if (finalNote.length > 50) finalNote = finalNote.substring(0, 50);

  return {
    amount: detectedAmount,
    date: detectedDate || new Date().toISOString().split('T')[0],
    note: finalNote,
    category: detectedCategory,
    splitType: 'personal'
  };
}

/**
 * Helper to turn strings like "Rp 125.000,00" or "45.000" into numeric integer
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
