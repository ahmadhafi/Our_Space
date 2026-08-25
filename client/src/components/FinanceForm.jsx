import { useState, useEffect } from 'react';
import CategoryPickerModal, { getCategoryColor, getCategoryIcon } from './CategoryPickerModal';
import ReceiptScannerModal from './ReceiptScannerModal';
import { apiPost } from '../hooks/useApi';

export default function FinanceForm({ onEntryCreated, onCancel, defaultSplitType = 'personal' }) {
  const [type, setType] = useState('expense'); // 'expense' | 'income' | 'debt'
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [splitType, setSplitType] = useState(defaultSplitType || 'personal'); // 'personal' | 'shared'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);

  useEffect(() => {
    if (type === 'income') {
      setCategory('Salary');
    } else if (type === 'debt') {
      setCategory('Loan Payment');
    } else {
      setCategory('Food');
    }
  }, [type]);

  const adjustDate = (days) => {
    const current = new Date(date);
    current.setDate(current.getDate() + days);
    setDate(current.toISOString().split('T')[0]);
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
      const backendType = type === 'income' ? 'income' : 'expense';

      const data = await apiPost('/api/finance', {
        amount: amountInt,
        type: backendType,
        category,
        note: (note || '').trim(),
        date,
        split_type: splitType
      });

      setAmount('');
      setNote('');
      if (onEntryCreated) onEntryCreated(data.entry);
    } catch (err) {
      console.error('Save finance error:', err);
      setError(err.message || 'Failed to save transaction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#121212] rounded-3xl p-5 sm:p-6 border border-white/10 shadow-xl relative animate-fade-in text-white">
      
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          {onCancel && (
            <button 
              type="button" 
              onClick={onCancel}
              className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white text-xs transition-colors"
            >
              ✕
            </button>
          )}
          <h3 className="text-base font-semibold text-white">New Transaction</h3>
        </div>

        {/* Scan Receipt Button */}
        <button
          type="button"
          onClick={() => setShowScannerModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-medium transition-colors"
        >
          <span>📷 Scan Receipt</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3.5 pt-3.5">
        
        {/* Type Toggle: Expense | Income | Debt */}
        <div className="flex rounded-xl p-1 bg-black/40 border border-white/10">
          {[
            { id: 'expense', label: 'Expense' },
            { id: 'income', label: 'Income' },
            { id: 'debt', label: 'Debt / Loan' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setType(tab.id)}
              className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
                type === tab.id
                  ? 'bg-white text-black font-semibold shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Large Amount Input */}
        <div className="bg-white/[0.03] rounded-2xl p-3.5 border border-white/5 flex items-center gap-3">
          <span className="text-xs font-semibold px-2 py-1 rounded bg-white/5 text-gray-400">
            IDR
          </span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="w-full bg-transparent text-2xl sm:text-3xl font-semibold text-white focus:outline-none placeholder-gray-600"
            min="1"
            required
          />
        </div>

        {/* Category Row (Click opens modal) */}
        <div 
          onClick={() => setShowCategoryPicker(true)}
          className="flex items-center justify-between bg-white/[0.03] hover:bg-white/[0.06] rounded-xl p-3 border border-white/5 cursor-pointer transition-colors"
        >
          <div>
            <span className="text-[10px] uppercase font-semibold text-gray-500 block">Category</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-base">{getCategoryIcon(category)}</span>
              <span className="text-xs font-medium text-white">{category}</span>
            </div>
          </div>
          <span className="text-gray-400 text-xs font-medium">Change ›</span>
        </div>

        {/* Note / Description */}
        <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
          <span className="text-[10px] uppercase font-semibold text-gray-500 block mb-0.5">Note</span>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional description"
            className="w-full bg-transparent text-xs text-white placeholder-gray-600 focus:outline-none"
            maxLength={250}
          />
        </div>

        {/* Date Selector with Step Arrows */}
        <div className="flex items-center justify-between bg-white/[0.03] rounded-xl p-3 border border-white/5">
          <div>
            <span className="text-[10px] uppercase font-semibold text-gray-500 block mb-0.5">Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-transparent text-xs font-medium text-white focus:outline-none cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-1 bg-black/30 rounded-lg p-1 border border-white/5">
            <button
              type="button"
              onClick={() => adjustDate(-1)}
              className="w-6 h-6 rounded hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white text-xs font-bold"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => setDate(new Date().toISOString().split('T')[0])}
              className="px-2 py-0.5 text-[10px] font-medium text-gray-300 hover:bg-white/10 rounded"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => adjustDate(1)}
              className="w-6 h-6 rounded hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white text-xs font-bold"
            >
              ›
            </button>
          </div>
        </div>

        {/* Account / Split Type */}
        <div className="flex items-center justify-between bg-white/[0.03] rounded-xl p-3 border border-white/5">
          <div>
            <span className="text-[10px] uppercase font-semibold text-gray-500 block">Split Option</span>
            <span className="text-xs text-gray-300">
              {splitType === 'shared' ? 'Shared with Partner' : 'Personal Entry'}
            </span>
          </div>

          <div className="flex rounded-lg p-0.5 bg-black/40 border border-white/10">
            <button
              type="button"
              onClick={() => setSplitType('personal')}
              className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                splitType === 'personal'
                  ? 'bg-white text-black font-semibold'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Personal
            </button>
            <button
              type="button"
              onClick={() => setSplitType('shared')}
              className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                splitType === 'shared'
                  ? 'bg-white text-black font-semibold'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Shared
            </button>
          </div>
        </div>

        {error && (
          <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
            {error}
          </div>
        )}

        {/* Save Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={!amount || loading}
            className="w-full py-3 rounded-xl bg-white hover:bg-gray-200 disabled:opacity-50 text-black font-semibold text-xs tracking-wide transition-all active:scale-[0.99]"
          >
            {loading ? 'Saving...' : 'Save Transaction'}
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
        defaultSplitType={splitType}
        onClose={() => setShowScannerModal(false)}
        onEntrySaved={(entry) => {
          if (onEntryCreated) onEntryCreated(entry);
        }}
      />

    </div>
  );
}
