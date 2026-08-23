import { useState, useEffect } from 'react';

const EXPENSE_CATEGORY_GROUPS = {
  'Needs (50% Target)': ['Food', 'Transport', 'Bills', 'Rent', 'Insurance', 'Healthcare'],
  'Debt (50% Target)': ['Loan Payment', 'Credit Card'],
  'Wants (30% Target)': ['Entertainment', 'Subscription', 'Education', 'Other'],
  'Savings (20% Target)': ['Investment', 'Savings']
};

const INCOME_CATEGORIES = ['Salary', 'Bonus', 'Freelance', 'Gift', 'Investment Return', 'Other Income'];

export default function FinanceForm({ onEntryCreated }) {
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('expense');
  const [category, setCategory] = useState('Food');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [splitType, setSplitType] = useState('personal');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (type === 'income') {
      setCategory('Salary');
    } else {
      setCategory('Food');
    }
  }, [type]);

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
      const data = await apiPost('/api/finance', {
        amount: amountInt,
        type,
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

  const formatPreview = () => {
    const num = parseInt(amount, 10);
    if (isNaN(num)) return 'Rp 0';
    return `Rp ${num.toLocaleString('id-ID')}`;
  };

  return (
    <div className="bg-[#1A1A1A] rounded-[2rem] p-5 border border-white/5 animate-fade-in">
      <h3 className="font-bold mb-4 flex items-center gap-2 text-white">
        <svg className="w-5 h-5 text-[#FFFC00]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Add Entry
      </h3>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Type toggle */}
        <div className="flex rounded-xl overflow-hidden border border-white/10 bg-black">
          <button
            type="button"
            onClick={() => setType('income')}
            className={`flex-1 py-3 text-sm font-bold transition-all ${
              type === 'income'
                ? 'bg-green-500 text-black'
                : 'text-gray-400 hover:bg-white/5'
            }`}
          >
            💰 Income
          </button>
          <button
            type="button"
            onClick={() => setType('expense')}
            className={`flex-1 py-3 text-sm font-bold transition-all ${
              type === 'expense'
                ? 'bg-red-500 text-black'
                : 'text-gray-400 hover:bg-white/5'
            }`}
          >
            💸 Expense
          </button>
        </div>

        {/* Split Type */}
        <div className="flex rounded-xl overflow-hidden border border-white/10 bg-black">
          <button
            type="button"
            onClick={() => setSplitType('personal')}
            className={`flex-1 py-2 text-xs font-bold transition-all ${
              splitType === 'personal'
                ? 'bg-blue-500 text-white'
                : 'text-gray-400 hover:bg-white/5'
            }`}
          >
            👤 Personal
          </button>
          <button
            type="button"
            onClick={() => setSplitType('shared')}
            className={`flex-1 py-2 text-xs font-bold transition-all ${
              splitType === 'shared'
                ? 'bg-purple-500 text-white'
                : 'text-gray-400 hover:bg-white/5'
            }`}
          >
            🤝 Shared
          </button>
        </div>

        {/* Consultant Tip */}
        {type === 'expense' && splitType === 'shared' && (
          <p className="text-[10px] text-gray-400 italic bg-white/5 p-2 rounded-lg border border-white/10">
            <span className="text-[#FFFC00]">💡 Tip:</span> This will be split proportionally based on the "Expense Split Percentage" configured in your Profile Settings.
          </p>
        )}

        {/* Amount */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Amount (IDR)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">Rp</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="input-field pl-10"
              min="1"
              required
            />
          </div>
          {amount && (
            <p className="text-xs text-gray-400 mt-1">{formatPreview()}</p>
          )}
        </div>

        {/* Category */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">
            {type === 'income' ? 'Income Source' : 'Category'}
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="input-field"
          >
            {type === 'expense' ? (
              Object.entries(EXPENSE_CATEGORY_GROUPS).map(([groupName, categories]) => (
                <optgroup key={groupName} label={groupName} className="bg-[#1A1A1A] text-gray-400 font-bold">
                  {categories.map(cat => (
                    <option key={cat} value={cat} className="text-white font-normal">{cat}</option>
                  ))}
                </optgroup>
              ))
            ) : (
              INCOME_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))
            )}
          </select>
        </div>

        {/* Date */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input-field"
            required
          />
        </div>

        {/* Note */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Note (optional)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What was this for?"
            className="input-field"
            maxLength={500}
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={!amount || loading}
          className="btn-primary w-full disabled:opacity-50"
        >
          {loading ? 'Adding...' : `Add ${type === 'income' ? 'Income' : 'Expense'}`}
        </button>
      </form>
    </div>
  );
}
