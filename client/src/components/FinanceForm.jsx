import { useState, useEffect } from 'react';
import CategoryPickerModal, { getCategoryIcon, getCategoryColor } from './CategoryPickerModal';
import ReceiptScannerModal from './ReceiptScannerModal';

export default function FinanceForm({ onEntryCreated, onCancel }) {
  const [type, setType] = useState('expense'); // 'expense' | 'income' | 'debt'
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [splitType, setSplitType] = useState('personal'); // 'personal' | 'shared'
  const [wallet, setWallet] = useState('Cash');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);

  // Set default category when switching type
  useEffect(() => {
    if (type === 'income') {
      setCategory('Salary');
    } else if (type === 'debt') {
      setCategory('Loan Payment');
    } else {
      setCategory('Food');
    }
  }, [type]);

  // Quick date navigation (Previous Day / Next Day)
  const adjustDate = (days) => {
    const current = new Date(date);
    current.setDate(current.getDate() + days);
    setDate(current.toISOString().split('T')[0]);
  };

  // Format date display for header (e.g. Tuesday, 25/08/2026)
  const formatDisplayDate = (dStr) => {
    try {
      const d = new Date(dStr);
      const options = { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' };
      return d.toLocaleDateString('en-GB', options);
    } catch {
      return dStr;
    }
  };

  const handleApplyScan = (scannedData) => {
    if (scannedData.amount) setAmount(scannedData.amount.toString());
    if (scannedData.date) setDate(scannedData.date);
    if (scannedData.category) setCategory(scannedData.category);
    if (scannedData.note) setNote(scannedData.note);
    if (scannedData.splitType) setSplitType(scannedData.splitType);
    setType('expense');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || loading) return;

    const amountInt = parseInt(amount, 10);
    if (isNaN(amountInt) || amountInt < 1) {
      setError('Amount must be a positive number');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { apiPost } = await import('../hooks/useApi');
      
      // Determine backend type ('income' or 'expense')
      const backendType = type === 'income' ? 'income' : 'expense';

      const data = await apiPost('/api/finance', {
        amount: amountInt,
        type: backendType,
        category,
        note: note.trim(),
        date,
        split_type: splitType
      });

      // Reset
      setAmount('');
      setNote('');
      if (onEntryCreated) onEntryCreated(data.entry);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#141414] rounded-[2.5rem] p-5 sm:p-6 border border-white/10 shadow-2xl relative animate-fade-in text-white">
      
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          {onCancel && (
            <button 
              type="button" 
              onClick={onCancel}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white"
            >
              ✕
            </button>
          )}
          <h3 className="text-lg font-bold text-white">Add Transaction</h3>
        </div>

        {/* Green Smart Receipt Scanner Button */}
        <button
          type="button"
          onClick={() => setShowScannerModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-green-500 hover:bg-green-600 text-black text-xs font-bold transition-all shadow-md shadow-green-500/20 hover:scale-105 active:scale-95"
          title="Scan receipt with camera or image"
        >
          <span className="text-sm">🧾</span>
          <span>Scan Receipt</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 pt-4">
        
        {/* Money Lover Style Segmented Switcher: Expense | Income | Debt/Loan */}
        <div className="flex rounded-2xl p-1 bg-black/60 border border-white/10">
          {[
            { id: 'expense', label: 'Expense', color: 'bg-red-500 text-white' },
            { id: 'income', label: 'Income', color: 'bg-green-500 text-black' },
            { id: 'debt', label: 'Debt/Loan', color: 'bg-amber-500 text-black' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setType(tab.id)}
              className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all ${
                type === tab.id
                  ? `${tab.color} shadow-lg`
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Source / Wallet Row */}
        <div className="flex items-center gap-3 bg-white/5 rounded-2xl p-3 border border-white/5">
          <div className="w-10 h-10 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center text-lg">
            👛
          </div>
          <div className="flex-1">
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Wallet / Account</span>
            <select
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              className="bg-transparent text-sm font-semibold text-white focus:outline-none w-full cursor-pointer"
            >
              <option value="Cash" className="bg-[#1a1a1a] text-white">💵 Cash</option>
              <option value="Bank BCA" className="bg-[#1a1a1a] text-white">💳 Bank BCA</option>
              <option value="Bank Mandiri" className="bg-[#1a1a1a] text-white">💳 Bank Mandiri</option>
              <option value="GoPay / OVO / Dana" className="bg-[#1a1a1a] text-white">📱 E-Wallet (GoPay/OVO/Dana)</option>
              <option value="Credit Card" className="bg-[#1a1a1a] text-white">💳 Credit Card</option>
            </select>
          </div>
        </div>

        {/* Large Prominent Amount Input with IDR Badge */}
        <div className="bg-white/5 rounded-2xl p-4 border border-white/5 flex items-center gap-3">
          <span className="text-xs font-extrabold px-2.5 py-1 rounded-lg bg-white/10 text-gray-300 tracking-wider">
            IDR
          </span>
          <div className="flex-1 relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className={`w-full bg-transparent text-3xl sm:text-4xl font-extrabold focus:outline-none ${
                type === 'income' ? 'text-green-400' : 'text-white'
              }`}
              min="1"
              required
            />
          </div>
        </div>

        {/* Select Category Row (Click opens Modal) */}
        <div 
          onClick={() => setShowCategoryPicker(true)}
          className="flex items-center justify-between bg-white/5 hover:bg-white/10 rounded-2xl p-3.5 border border-white/5 cursor-pointer transition-all active:scale-[0.99]"
        >
          <div className="flex items-center gap-3.5">
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center text-xl bg-black/40 border border-white/10"
              style={{ borderColor: `${getCategoryColor(category)}60` }}
            >
              {getCategoryIcon(category)}
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Category</span>
              <span className="text-sm font-semibold text-white">{category}</span>
            </div>
          </div>
          <span className="text-gray-400 text-xs font-semibold px-2 py-1 bg-white/5 rounded-lg">Change ›</span>
        </div>

        {/* Write Note Row */}
        <div className="flex items-center gap-3 bg-white/5 rounded-2xl p-3.5 border border-white/5">
          <div className="w-10 h-10 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center text-lg text-gray-300">
            ✍️
          </div>
          <div className="flex-1">
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Note / Description</span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Write a note (optional)..."
              className="w-full bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none"
              maxLength={250}
            />
          </div>
        </div>

        {/* Date Selector with < Previous Day / Next Day > Arrows */}
        <div className="flex items-center justify-between bg-white/5 rounded-2xl p-3 border border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center text-lg">
              📅
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Date</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-transparent text-xs sm:text-sm font-semibold text-white focus:outline-none cursor-pointer"
              />
            </div>
          </div>

          <div className="flex items-center gap-1 bg-black/40 rounded-xl p-1 border border-white/5">
            <button
              type="button"
              onClick={() => adjustDate(-1)}
              className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-gray-300 text-sm font-bold"
              title="Previous Day"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => setDate(new Date().toISOString().split('T')[0])}
              className="px-2 py-1 text-[10px] font-bold text-green-400 hover:bg-white/10 rounded-md"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => adjustDate(1)}
              className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-gray-300 text-sm font-bold"
              title="Next Day"
            >
              ›
            </button>
          </div>
        </div>

        {/* "With" / Split Type Row */}
        <div className="flex items-center justify-between bg-white/5 rounded-2xl p-3.5 border border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center text-lg">
              👥
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Account Type</span>
              <span className="text-xs font-semibold text-white">
                {splitType === 'shared' ? '🤝 Shared with Partner (Split Expense)' : '👤 Personal Expense'}
              </span>
            </div>
          </div>

          <div className="flex rounded-xl p-1 bg-black/60 border border-white/10">
            <button
              type="button"
              onClick={() => setSplitType('personal')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                splitType === 'personal'
                  ? 'bg-blue-500 text-white shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Personal
            </button>
            <button
              type="button"
              onClick={() => setSplitType('shared')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                splitType === 'shared'
                  ? 'bg-purple-500 text-white shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Shared
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/30 text-xs text-red-300">
            {error}
          </div>
        )}

        {/* Save Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={!amount || loading}
            className="w-full py-3.5 rounded-2xl bg-green-500 hover:bg-green-600 disabled:opacity-50 text-black font-extrabold text-base transition-all shadow-lg shadow-green-500/20 active:scale-[0.99] flex items-center justify-center gap-2"
          >
            {loading ? (
              <span>Saving...</span>
            ) : (
              <>
                <span>Save Transaction</span>
                <span>✓</span>
              </>
            )}
          </button>
        </div>

      </form>

      {/* Category Picker Modal */}
      {showCategoryPicker && (
        <CategoryPickerModal
          currentTab={type}
          selectedCategory={category}
          onSelect={(cat, detectedType) => {
            setCategory(cat);
            if (detectedType && detectedType !== type && type !== 'debt') {
              setType(detectedType);
            }
          }}
          onClose={() => setShowCategoryPicker(false)}
        />
      )}

      {/* Smart Receipt Scanner Modal */}
      <ReceiptScannerModal
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        onApply={handleApplyScan}
      />

    </div>
  );
}
