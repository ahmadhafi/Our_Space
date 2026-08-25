import { useState, useRef } from 'react';
import { scanReceiptImage } from '../utils/receiptOcr';
import { getCategoryIcon } from './CategoryPickerModal';

export default function ReceiptScannerModal({ isOpen, onClose, onApply }) {
  const [imageSrc, setImageSrc] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [progressInfo, setProgressInfo] = useState({ status: '', progress: 0 });
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState('');
  const [showRawText, setShowRawText] = useState(false);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  if (!isOpen) return null;

  const handleImageSelected = async (file) => {
    if (!file) return;
    setError('');
    setScanResult(null);

    // Read image for preview
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target.result;
      setImageSrc(dataUrl);

      // Start OCR
      setIsScanning(true);
      try {
        const result = await scanReceiptImage(dataUrl, (progress) => {
          setProgressInfo(progress);
        });

        setScanResult({
          amount: result.amount || '',
          date: result.date || new Date().toISOString().split('T')[0],
          category: result.category || 'Food',
          note: result.note || '',
          splitType: 'personal',
          rawText: result.rawText
        });
      } catch (err) {
        console.error('Scan error:', err);
        setError(err.message || 'Failed to scan receipt. Please try another photo.');
      } finally {
        setIsScanning(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleApply = () => {
    if (!scanResult) return;
    onApply({
      amount: scanResult.amount ? parseInt(scanResult.amount, 10) : '',
      date: scanResult.date,
      category: scanResult.category,
      note: scanResult.note,
      splitType: scanResult.splitType || 'personal'
    });
    onClose();
  };

  const resetScanner = () => {
    setImageSrc(null);
    setScanResult(null);
    setError('');
    setIsScanning(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-lg bg-[#141414] text-white rounded-[2.5rem] border border-white/10 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-slide-up">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-black/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-green-500/20 border border-green-500/30 flex items-center justify-center text-green-400 text-lg">
              🧾
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Smart Receipt Scanner</h3>
              <p className="text-[11px] text-gray-400">Scan & auto-fill transaction details</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          
          {/* Upload / Capture Trigger (when no image selected) */}
          {!imageSrc && (
            <div className="space-y-4 py-4">
              <div className="border-2 border-dashed border-white/15 rounded-3xl p-6 text-center bg-white/5 flex flex-col items-center justify-center gap-3">
                <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center text-3xl">
                  📸
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">Upload or Snap a Receipt</h4>
                  <p className="text-xs text-gray-400 mt-1 max-w-xs">
                    Our on-device AI will recognize the Total Amount, Date, Merchant, and Category automatically!
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5 w-full mt-2">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex-1 py-3 px-4 rounded-2xl bg-green-500 hover:bg-green-600 text-black font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-500/20"
                  >
                    <span>📷</span>
                    Take Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 py-3 px-4 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all"
                  >
                    <span>🖼️</span>
                    Choose Gallery
                  </button>
                </div>
              </div>

              {/* Tips */}
              <div className="bg-white/5 rounded-2xl p-3 border border-white/5 text-[11px] text-gray-400 space-y-1">
                <div className="font-semibold text-green-400 flex items-center gap-1">
                  💡 Helpful Scanning Tips:
                </div>
                <p>• Make sure the Total / Grand Total and Date are well-lit and clear.</p>
                <p>• Supports Indonesian & International receipts (Indomaret, Alfamart, Cafes, SPBU, etc.).</p>
              </div>

              {/* Hidden Inputs */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleImageSelected(e.target.files?.[0])}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleImageSelected(e.target.files?.[0])}
              />
            </div>
          )}

          {/* Active Image Preview & Scanning State */}
          {imageSrc && (
            <div className="space-y-4">
              <div className="relative rounded-2xl overflow-hidden max-h-56 bg-black border border-white/10 flex items-center justify-center">
                <img src={imageSrc} alt="Receipt preview" className="w-full h-full object-contain max-h-56 opacity-85" />
                
                {isScanning && (
                  <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center p-4">
                    <div className="w-12 h-12 rounded-full border-4 border-green-500 border-t-transparent animate-spin mb-3" />
                    <p className="text-sm font-bold text-white">{progressInfo.status || 'Scanning receipt...'}</p>
                    <div className="w-48 bg-white/20 h-2 rounded-full mt-3 overflow-hidden">
                      <div 
                        className="bg-green-500 h-full transition-all duration-300 rounded-full"
                        style={{ width: `${progressInfo.progress}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-green-400 mt-1 font-mono">{progressInfo.progress}%</p>
                  </div>
                )}
              </div>

              {error && (
                <div className="p-3 bg-red-500/20 border border-red-500/40 rounded-2xl text-xs text-red-300">
                  {error}
                </div>
              )}

              {/* Scanned Results Preview / Editable Fields */}
              {scanResult && !isScanning && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <span className="text-xs font-bold text-green-400 flex items-center gap-1">
                      ✅ Extracted Details
                    </span>
                    <button
                      type="button"
                      onClick={resetScanner}
                      className="text-xs text-gray-400 hover:text-white underline"
                    >
                      Scan Another
                    </button>
                  </div>

                  {/* Amount Field */}
                  <div>
                    <label className="text-[11px] font-semibold text-gray-400 block mb-1">Total Amount (IDR)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-green-400 font-bold">Rp</span>
                      <input
                        type="number"
                        value={scanResult.amount}
                        onChange={(e) => setScanResult({ ...scanResult, amount: e.target.value })}
                        placeholder="0"
                        className="w-full bg-black/60 border border-white/15 rounded-xl pl-10 pr-3 py-2 text-white font-bold text-lg focus:outline-none focus:border-green-500"
                      />
                    </div>
                  </div>

                  {/* Date & Category Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-gray-400 block mb-1">Transaction Date</label>
                      <input
                        type="date"
                        value={scanResult.date}
                        onChange={(e) => setScanResult({ ...scanResult, date: e.target.value })}
                        className="w-full bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-green-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-gray-400 block mb-1">Category</label>
                      <div className="flex items-center gap-1.5 bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-xs text-white">
                        <span>{getCategoryIcon(scanResult.category)}</span>
                        <input
                          type="text"
                          value={scanResult.category}
                          onChange={(e) => setScanResult({ ...scanResult, category: e.target.value })}
                          className="bg-transparent w-full text-xs text-white focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Note / Merchant */}
                  <div>
                    <label className="text-[11px] font-semibold text-gray-400 block mb-1">Note / Store Name</label>
                    <input
                      type="text"
                      value={scanResult.note}
                      onChange={(e) => setScanResult({ ...scanResult, note: e.target.value })}
                      placeholder="e.g. Indomaret Sudirman"
                      className="w-full bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-green-500"
                    />
                  </div>

                  {/* Raw OCR Text Debug Accordion */}
                  {scanResult.rawText && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => setShowRawText(!showRawText)}
                        className="text-[10px] text-gray-500 hover:text-gray-300 underline"
                      >
                        {showRawText ? 'Hide detected OCR text' : 'View detected raw receipt text'}
                      </button>
                      {showRawText && (
                        <pre className="mt-2 p-2 bg-black/80 rounded-xl text-[10px] text-gray-400 font-mono overflow-x-auto max-h-32 border border-white/5 whitespace-pre-wrap">
                          {scanResult.rawText}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-white/10 bg-black/40 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-gray-300 text-sm font-semibold transition-colors"
          >
            Cancel
          </button>
          
          {scanResult && !isScanning && (
            <button
              type="button"
              onClick={handleApply}
              className="px-6 py-2.5 rounded-2xl bg-green-500 hover:bg-green-600 text-black font-bold text-sm flex items-center gap-2 shadow-lg shadow-green-500/20 transition-all"
            >
              <span>✨</span>
              Apply to Transaction
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
