import { useState, useRef } from 'react';
import { scanReceiptImage } from '../utils/receiptOcr';
import { apiPost } from '../hooks/useApi';

export default function ReceiptScannerModal({ isOpen, onClose, onEntrySaved, defaultSplitType = 'personal' }) {
  const [imageSrc, setImageSrc] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [progressInfo, setProgressInfo] = useState({ status: '', progress: 0 });
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  if (!isOpen) return null;

  const handleImageSelected = async (file) => {
    if (!file) return;
    setError('');
    setSuccessMsg('');
    setScanResult(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target.result;
      setImageSrc(dataUrl);

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
          splitType: defaultSplitType || 'personal'
        });
      } catch (err) {
        console.error('Scan error:', err);
        setError(err.message || 'Failed to read receipt. Please try another photo.');
      } finally {
        setIsScanning(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Automatically save transaction into the database
  const handleAutoSave = async () => {
    if (!scanResult || !scanResult.amount || isSaving) return;

    const amountInt = parseInt(scanResult.amount, 10);
    if (isNaN(amountInt) || amountInt <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const response = await apiPost('/api/finance', {
        amount: amountInt,
        type: 'expense',
        category: (scanResult.category || 'Food').trim(),
        note: (scanResult.note || 'Receipt Scan').trim(),
        date: scanResult.date || new Date().toISOString().split('T')[0],
        split_type: scanResult.splitType || defaultSplitType || 'personal'
      });

      setSuccessMsg('Transaction saved automatically!');
      setTimeout(() => {
        if (onEntrySaved) onEntrySaved(response.entry);
        onClose();
      }, 500);
    } catch (err) {
      console.error('Save transaction error:', err);
      setError(err.message || 'Failed to save transaction');
    } finally {
      setIsSaving(false);
    }
  };

  const resetScanner = () => {
    setImageSrc(null);
    setScanResult(null);
    setError('');
    setSuccessMsg('');
    setIsScanning(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in text-white">
      <div className="w-full max-w-md bg-[#121212] rounded-3xl border border-white/10 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-base text-white">Receipt Scanner</h3>
            <p className="text-xs text-gray-400">Scan receipt to auto-record expense</p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          
          {/* Upload / Capture Trigger */}
          {!imageSrc && (
            <div className="space-y-4 py-2">
              <div className="border border-dashed border-white/15 rounded-2xl p-6 text-center bg-white/[0.02] flex flex-col items-center justify-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-300">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-medium text-white text-sm">Upload or capture receipt</h4>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Amount, date, and category will be read automatically.
                  </p>
                </div>

                <div className="flex gap-2.5 w-full mt-2">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-white text-black font-semibold text-xs transition-all hover:bg-gray-200"
                  >
                    Camera
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs transition-all"
                  >
                    Gallery
                  </button>
                </div>
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
              <div className="relative rounded-2xl overflow-hidden max-h-48 bg-black border border-white/10 flex items-center justify-center">
                <img src={imageSrc} alt="Receipt preview" className="w-full h-full object-contain max-h-48 opacity-80" />
                
                {isScanning && (
                  <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center p-4">
                    <div className="w-8 h-8 rounded-full border-2 border-white border-t-transparent animate-spin mb-2" />
                    <p className="text-xs font-medium text-white">{progressInfo.status || 'Scanning receipt...'}</p>
                    <div className="w-36 bg-white/20 h-1.5 rounded-full mt-2.5 overflow-hidden">
                      <div 
                        className="bg-white h-full transition-all duration-300 rounded-full"
                        style={{ width: `${progressInfo.progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
                  {error}
                </div>
              )}

              {successMsg && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 font-medium text-center">
                  {successMsg}
                </div>
              )}

              {/* Extracted Details & Auto-Save Confirmation */}
              {scanResult && !isScanning && !successMsg && (
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <span className="text-xs font-semibold text-gray-300">Extracted Information</span>
                    <button
                      type="button"
                      onClick={resetScanner}
                      className="text-xs text-gray-400 hover:text-white"
                    >
                      Scan another
                    </button>
                  </div>

                  {/* Amount Field */}
                  <div>
                    <label className="text-[11px] font-medium text-gray-400 block mb-1">Total Amount (IDR)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">Rp</span>
                      <input
                        type="number"
                        value={scanResult.amount}
                        onChange={(e) => setScanResult({ ...scanResult, amount: e.target.value })}
                        placeholder="0"
                        className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-white font-semibold text-base focus:outline-none focus:border-white/30"
                      />
                    </div>
                  </div>

                  {/* Date & Category Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-medium text-gray-400 block mb-1">Date</label>
                      <input
                        type="date"
                        value={scanResult.date}
                        onChange={(e) => setScanResult({ ...scanResult, date: e.target.value })}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white/30"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-gray-400 block mb-1">Category</label>
                      <select
                        value={scanResult.category || 'Food'}
                        onChange={(e) => setScanResult({ ...scanResult, category: e.target.value })}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white/30"
                      >
                        <option value="Food">🍱 Food</option>
                        <option value="Transport">🚗 Transport</option>
                        <option value="Bills">🧾 Bills / Laundry</option>
                        <option value="Healthcare">💊 Healthcare</option>
                        <option value="Entertainment">🎮 Entertainment</option>
                        <option value="Rent">🏠 Rent</option>
                        <option value="Education">📚 Education</option>
                        <option value="Other">🛍️ Other</option>
                      </select>
                    </div>
                  </div>

                  {/* Note / Merchant */}
                  <div>
                    <label className="text-[11px] font-medium text-gray-400 block mb-1">Note / Store Name</label>
                    <input
                      type="text"
                      value={scanResult.note}
                      onChange={(e) => setScanResult({ ...scanResult, note: e.target.value })}
                      placeholder="e.g. Superindo, Cafe, etc."
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white/30"
                    />
                  </div>

                  {/* Account / Split Selection */}
                  <div className="flex items-center justify-between pt-1 border-t border-white/5 text-xs">
                    <span className="text-gray-400 text-[11px]">Save as:</span>
                    <div className="flex rounded-lg p-0.5 bg-black/40 border border-white/10">
                      <button
                        type="button"
                        onClick={() => setScanResult({ ...scanResult, splitType: 'personal' })}
                        className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                          scanResult.splitType === 'personal' ? 'bg-white text-black font-semibold' : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        Personal
                      </button>
                      <button
                        type="button"
                        onClick={() => setScanResult({ ...scanResult, splitType: 'shared' })}
                        className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                          scanResult.splitType === 'shared' ? 'bg-white text-black font-semibold' : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        Shared
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-white/10 bg-black/30 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-medium transition-colors"
          >
            Cancel
          </button>
          
          {scanResult && !isScanning && !successMsg && (
            <button
              type="button"
              onClick={handleAutoSave}
              disabled={isSaving || !scanResult.amount}
              className="px-5 py-2 rounded-xl bg-white text-black font-semibold text-xs flex items-center gap-1.5 transition-all hover:bg-gray-200 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Auto-Save Transaction'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
