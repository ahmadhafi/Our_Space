import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../hooks/useApi';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import FinanceForm from '../components/FinanceForm';
import CategoryPickerModal, { getCategoryIcon, getCategoryColor } from '../components/CategoryPickerModal';
import ReceiptScannerModal from '../components/ReceiptScannerModal';
import { useAuth } from '../hooks/useAuth';

const formatRp = (amount) => {
  return `Rp ${Number(amount || 0).toLocaleString('id-ID')}`;
};

export default function FinancePage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [view, setView] = useState('personal'); // 'personal' | 'shared'
  const [activeTab, setActiveTab] = useState('transactions'); // 'transactions' | 'planning' | 'reports'
  
  // Privacy Eye state
  const [hideBalance, setHideBalance] = useState(false);
  
  // Modals & Forms
  const [showForm, setShowForm] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [editEntryInput, setEditEntryInput] = useState({ amount: '', type: 'expense', category: 'Food', note: '', date: '' });
  
  // Budgets & Goals State
  const [editingBudgetId, setEditingBudgetId] = useState(null);
  const [editBudgetInput, setEditBudgetInput] = useState({ category: '', amount: '' });
  const [editingGoalId, setEditingGoalId] = useState(null);
  const [editGoalInput, setEditGoalInput] = useState({ title: '', target_amount: '', deadline: '' });
  const [budgetInput, setBudgetInput] = useState('');
  const [budgetCategory, setBudgetCategory] = useState('Overall');
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [goals, setGoals] = useState([]);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalInput, setGoalInput] = useState({ title: '', target_amount: '' });
  const [contributeGoalId, setContributeGoalId] = useState(null);
  const [contributeInput, setContributeInput] = useState({ amount: '', instrument: 'Cash' });
  const [showHistoryGoalId, setShowHistoryGoalId] = useState(null);
  const [editingContribId, setEditingContribId] = useState(null);
  const [editContribInput, setEditContribInput] = useState({ amount: '', instrument: '' });

  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const [trendData, setTrendData] = useState(null);
  const [isZbbMode, setIsZbbMode] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);

  const INSTRUMENTS = ['Stocks', 'Deposit', 'Mutual Funds', 'Bank Account', 'Cash', 'Crypto', 'Other'];

  const fetchData = useCallback(async () => {
    try {
      const [financeRes, goalsRes, trendsRes] = await Promise.all([
        apiGet(`/api/finance?month=${month}&view=${view}`),
        apiGet(`/api/finance/goals?view=${view}`),
        apiGet(`/api/finance/trends?view=${view}`)
      ]);
      setData(financeRes);
      setGoals(goalsRes.goals || []);
      setTrendData(trendsRes);
    } catch (err) {
      console.error('Failed to fetch finance data:', err);
    }
  }, [month, view]);

  useEffect(() => {
    setLoading(true);
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  const handleEntryCreated = () => {
    fetchData();
    setShowForm(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this entry?')) return;
    try {
      await apiDelete(`/api/finance/${id}`);
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const startEditEntry = (entry) => {
    setEditingEntryId(entry.id);
    setEditEntryInput({
      amount: entry.amount.toString(),
      type: entry.type,
      category: entry.category,
      note: entry.note || '',
      date: entry.date.split('T')[0]
    });
  };

  const handleEditEntry = async (e) => {
    e.preventDefault();
    const amount = parseInt(editEntryInput.amount, 10);
    if (isNaN(amount) || amount <= 0) return;
    try {
      await apiPut(`/api/finance/${editingEntryId}`, {
        amount,
        type: editEntryInput.type,
        category: editEntryInput.category,
        note: editEntryInput.note,
        date: editEntryInput.date
      });
      setEditingEntryId(null);
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleEditBudget = async (e, id) => {
    e.preventDefault();
    if (!editBudgetInput.amount) return;
    try {
      await apiPut(`/api/finance/budget/${id}`, { amount: parseInt(editBudgetInput.amount, 10), category: editBudgetInput.category, type: view });
      setEditingBudgetId(null);
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteBudget = async (id) => {
    if (!confirm('Delete this budget?')) return;
    try {
      await apiDelete(`/api/finance/budget/${id}`);
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleEditGoal = async (e, id) => {
    e.preventDefault();
    try {
      await apiPut(`/api/finance/goals/${id}`, { 
        title: editGoalInput.title, 
        target_amount: parseInt(editGoalInput.target_amount, 10),
        deadline: editGoalInput.deadline || null
      });
      setEditingGoalId(null);
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSetBudget = async (e) => {
    e.preventDefault();
    if (!budgetInput) return;
    try {
      await apiPost('/api/finance/budget', { month, amount: parseInt(budgetInput, 10), category: budgetCategory, type: view });
      setShowBudgetForm(false);
      setBudgetInput('');
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreateGoal = async (e) => {
    e.preventDefault();
    if (!goalInput.title || !goalInput.target_amount) return;
    try {
      await apiPost('/api/finance/goals', { ...goalInput, target_amount: parseInt(goalInput.target_amount, 10), type: view });
      setShowGoalForm(false);
      setGoalInput({ title: '', target_amount: '' });
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleContributeSubmit = async (e) => {
    e.preventDefault();
    if (!contributeInput.amount || !contributeGoalId) return;
    const amount = parseInt(contributeInput.amount, 10);
    if (isNaN(amount) || amount <= 0) return;
    try {
      await apiPut(`/api/finance/goals/${contributeGoalId}/contribute`, { amount, instrument: contributeInput.instrument });
      setContributeGoalId(null);
      setContributeInput({ amount: '', instrument: 'Cash' });
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleEditContribSubmit = async (e, contribId) => {
    e.preventDefault();
    const amount = parseInt(editContribInput.amount, 10);
    if (isNaN(amount) || amount <= 0) return;
    try {
      await apiPut(`/api/finance/goals/contributions/${contribId}`, { amount, instrument: editContribInput.instrument });
      setEditingContribId(null);
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteContrib = async (contribId) => {
    if (!confirm('Delete this contribution?')) return;
    try {
      await apiDelete(`/api/finance/goals/contributions/${contribId}`);
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteGoal = async (goalId) => {
    if (!confirm('Are you sure you want to delete this saving goal and all its contributions?')) return;
    try {
      await apiDelete(`/api/finance/goals/${goalId}`);
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const changeMonth = (delta) => {
    const [y, m] = month.split('-').map(Number);
    const date = new Date(y, m - 1 + delta, 1);
    setMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  };

  const getMonthLabel = () => {
    const [y, m] = month.split('-').map(Number);
    return new Date(y, m - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const displayAmount = (amt) => {
    if (hideBalance) return 'Rp ••••••';
    return formatRp(amt);
  };

  const sortedEntries = () => {
    if (!data?.entries) return [];
    let entries = [...data.entries];
    if (selectedCategory) {
      entries = entries.filter(e => e.category.toLowerCase() === selectedCategory.toLowerCase());
    }
    return entries.sort((a, b) => {
      let aVal, bVal;
      if (sortField === 'date') {
        aVal = a.date;
        bVal = b.date;
      } else {
        aVal = a.amount;
        bVal = b.amount;
      }
      if (sortDir === 'asc') return aVal > bVal ? 1 : -1;
      return aVal < bVal ? 1 : -1;
    });
  };

  // Top spending calculation
  const getTopSpendings = () => {
    if (!data?.entries) return [];
    const expenses = data.entries.filter(e => e.type === 'expense');
    const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
    if (totalExpense === 0) return [];

    const categoryMap = {};
    expenses.forEach(e => {
      categoryMap[e.category] = (categoryMap[e.category] || 0) + e.amount;
    });

    return Object.entries(categoryMap)
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: Math.round((amount / totalExpense) * 100)
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  };

  // Month-over-Month spending comparison calculation
  const getMonthComparison = () => {
    const currentSpent = data?.summary?.totalExpense || 0;
    
    // Look for previous month in trends
    let previousSpent = 0;
    if (trendData?.trends && trendData.trends.length >= 2) {
      const currentMonthIndex = trendData.trends.findIndex(t => t.month === month);
      if (currentMonthIndex > 0) {
        previousSpent = trendData.trends[currentMonthIndex - 1].expense || 0;
      } else if (currentMonthIndex === -1 && trendData.trends.length > 0) {
        previousSpent = trendData.trends[trendData.trends.length - 2]?.expense || 0;
      }
    }

    let diffPercent = 0;
    if (previousSpent > 0) {
      diffPercent = Math.round(((currentSpent - previousSpent) / previousSpent) * 100);
    }

    return {
      currentSpent,
      previousSpent,
      diffPercent,
      isDecrease: diffPercent <= 0
    };
  };

  const monthComp = getMonthComparison();
  const topSpendings = getTopSpendings();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="spinner !w-10 !h-10 mb-3" />
        <p className="text-sm text-gray-400">Loading your finances...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in px-3 sm:px-4 pb-20 max-w-4xl mx-auto text-white">
      
      {/* Top Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold flex items-center gap-2">
            Finance <span>💰</span>
          </h1>
          <p className="text-xs text-gray-400">Track shared & personal expenses with ease</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Scan Receipt Header Button */}
          <button
            type="button"
            onClick={() => setShowScannerModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-green-500 hover:bg-green-600 text-black text-xs font-bold transition-all shadow-md shadow-green-500/20 active:scale-95"
            title="Scan receipt"
          >
            <span>🧾</span>
            <span className="hidden sm:inline">Scan Receipt</span>
          </button>

          {/* Add Entry Toggle Button */}
          <button
            onClick={() => setShowForm(!showForm)}
            className="btn-primary text-xs sm:text-sm py-2 px-4 rounded-2xl flex items-center gap-1"
          >
            {showForm ? '✕ Close' : '+ Add Transaction'}
          </button>
        </div>
      </div>

      {/* Money Lover Style Total Balance Card with Eye Toggle */}
      <div className="bg-[#141414] rounded-[2.5rem] p-5 sm:p-6 border border-white/10 shadow-2xl mb-5 relative overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider font-bold text-gray-400">Total Balance</span>
            <button
              type="button"
              onClick={() => setHideBalance(!hideBalance)}
              className="text-gray-400 hover:text-white p-1 rounded-full transition-colors text-sm"
              title={hideBalance ? 'Show balance' : 'Hide balance'}
            >
              {hideBalance ? '🙈' : '👁️'}
            </button>
          </div>

          <span className="text-[11px] px-3 py-1 rounded-full bg-white/10 text-gray-300 font-semibold">
            {view === 'personal' ? '👤 Personal View' : '🤝 Shared Couple View'}
          </span>
        </div>

        <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-4">
          {displayAmount(data?.summary?.netBalance || 0)}
        </div>

        {/* Income / Expense Quick Sub-Pills */}
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400 text-sm font-bold">
              ↓
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-gray-400">Total Income</p>
              <p className="text-sm sm:text-base font-bold text-green-400">{displayAmount(data?.summary?.totalIncome || 0)}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 text-sm font-bold">
              ↑
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-gray-400">Total Expense</p>
              <p className="text-sm sm:text-base font-bold text-red-400">{displayAmount(data?.summary?.totalExpense || 0)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Tabs: Transactions | Planning | Reports */}
      <div className="flex bg-[#141414] p-1.5 rounded-full border border-white/10 mb-5 text-xs sm:text-sm font-bold">
        {[
          { id: 'transactions', label: 'Transactions', icon: '📝' },
          { id: 'planning', label: 'Planning & Goals', icon: '🎯' },
          { id: 'reports', label: 'Analytics & Reports', icon: '📊' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2.5 rounded-full transition-all flex items-center justify-center gap-1.5 ${
              activeTab === tab.id
                ? 'bg-white text-black shadow-md font-extrabold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Add Transaction Inline Form Drawer */}
      {showForm && (
        <div className="mb-6">
          <FinanceForm 
            onEntryCreated={handleEntryCreated} 
            onCancel={() => setShowForm(false)} 
          />
        </div>
      )}

      {/* View Filter Pill Switcher (Personal vs Shared) */}
      <div className="flex flex-col sm:flex-row gap-2 mb-5">
        <div className="flex bg-[#141414] p-1.5 rounded-full border border-white/10 flex-1">
          <button
            onClick={() => setView('personal')}
            className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-full transition-all ${
              view === 'personal' ? 'bg-green-500 text-black shadow-sm' : 'text-gray-400 hover:text-white'
            }`}
          >
            👤 Personal Transactions
          </button>
          <button
            onClick={() => setView('shared')}
            className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-full transition-all ${
              view === 'shared' ? 'bg-green-500 text-black shadow-sm' : 'text-gray-400 hover:text-white'
            }`}
          >
            🤝 Shared with Partner
          </button>
        </div>

        {/* Month Selector Bar */}
        <div className="bg-[#141414] rounded-full px-4 py-1.5 flex items-center justify-between border border-white/10 sm:w-64">
          <button onClick={() => changeMonth(-1)} className="p-1 rounded-full hover:bg-white/10 transition-colors text-white font-bold">
            ‹
          </button>
          <span className="text-xs sm:text-sm font-bold text-green-400">{getMonthLabel()}</span>
          <button onClick={() => changeMonth(1)} className="p-1 rounded-full hover:bg-white/10 transition-colors text-white font-bold">
            ›
          </button>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 1: TRANSACTIONS (Money Lover Dashboard Experience) */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'transactions' && (
        <div className="space-y-5">
          
          {/* Money Lover "Report this month" Comparison Card */}
          <div className="bg-[#141414] rounded-[2.5rem] p-5 border border-white/10 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[11px] uppercase tracking-wider font-bold text-gray-400">Report This Month</p>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-xl sm:text-2xl font-extrabold text-white">
                    {displayAmount(monthComp.currentSpent)}
                  </span>
                  {monthComp.previousSpent > 0 && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      monthComp.isDecrease ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {monthComp.isDecrease ? '↓' : '↑'} {Math.abs(monthComp.diffPercent)}% vs last month
                    </span>
                  )}
                </div>
              </div>

              <button 
                onClick={() => setActiveTab('reports')}
                className="text-xs text-green-400 font-bold hover:underline"
              >
                See reports ›
              </button>
            </div>

            {/* Simple Visual Comparison Bars */}
            <div className="pt-2">
              <div className="h-28 sm:h-32 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: 'Last month', amount: monthComp.previousSpent },
                      { name: 'This month', amount: monthComp.currentSpent }
                    ]}
                    margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                  >
                    <XAxis dataKey="name" stroke="#888" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip 
                      formatter={(val) => [formatRp(val), 'Spent']}
                      contentStyle={{ backgroundColor: '#1e1e1e', border: '1px solid #333', borderRadius: '12px' }}
                    />
                    <Bar dataKey="amount" fill="#ef4444" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Money Lover "Top spending" Breakdown Card */}
          {topSpendings.length > 0 && (
            <div className="bg-[#141414] rounded-[2.5rem] p-5 border border-white/10 shadow-xl space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Top Spending</h3>
                <span className="text-[11px] text-gray-400">{topSpendings.length} categories</span>
              </div>

              <div className="space-y-3">
                {topSpendings.map(item => (
                  <div key={item.category} className="space-y-1">
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <div className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center text-sm">
                          {getCategoryIcon(item.category)}
                        </span>
                        <span className="font-semibold text-white">{item.category}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-gray-400 font-mono text-xs">{item.percentage}%</span>
                        <span className="font-bold text-white">{displayAmount(item.amount)}</span>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-500"
                        style={{ 
                          width: `${item.percentage}%`,
                          backgroundColor: getCategoryColor(item.category)
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Transactions List (Money Lover Layout) */}
          <div className="bg-[#141414] rounded-[2.5rem] p-5 border border-white/10 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-white uppercase tracking-wider">
                  {selectedCategory ? `${selectedCategory} Transactions` : 'Recent Transactions'}
                </h3>
                {selectedCategory && (
                  <button 
                    onClick={() => setSelectedCategory(null)} 
                    className="text-[10px] bg-white/10 hover:bg-white/20 text-white px-2 py-0.5 rounded-md"
                  >
                    Clear Filter ✕
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleSort('date')}
                  className="text-xs text-gray-400 hover:text-white px-2 py-1 bg-white/5 rounded-lg"
                >
                  Date {sortField === 'date' && (sortDir === 'asc' ? '↑' : '↓')}
                </button>
                <button
                  onClick={() => toggleSort('amount')}
                  className="text-xs text-gray-400 hover:text-white px-2 py-1 bg-white/5 rounded-lg"
                >
                  Amount {sortField === 'amount' && (sortDir === 'asc' ? '↑' : '↓')}
                </button>
              </div>
            </div>

            {/* List of Entries */}
            {sortedEntries().length === 0 ? (
              <div className="p-8 text-center text-gray-500 space-y-2">
                <div className="text-4xl">🧾</div>
                <p className="text-sm">No transactions found for this month.</p>
                <button
                  onClick={() => setShowForm(true)}
                  className="mt-2 text-xs font-bold text-green-400 hover:underline"
                >
                  + Add your first transaction
                </button>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {sortedEntries().map(entry => (
                  <div 
                    key={entry.id}
                    className="py-3 sm:py-3.5 flex items-center justify-between hover:bg-white/5 px-2 rounded-2xl transition-all group"
                  >
                    {/* Left: Icon, Category & Note */}
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl bg-black/40 border border-white/10 flex-shrink-0"
                        style={{ borderColor: `${getCategoryColor(entry.category)}50` }}
                      >
                        {getCategoryIcon(entry.category)}
                      </div>

                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-white">{entry.category}</span>
                          {entry.split_type === 'shared' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-purple-500/20 text-purple-300 font-bold">
                              Shared
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <span>{entry.note || (entry.type === 'income' ? 'Income' : 'Expense')}</span>
                          <span>•</span>
                          <span>{entry.date.split('T')[0]}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Amount & Actions */}
                    <div className="text-right flex items-center gap-3">
                      <div className="flex flex-col items-end">
                        <span className={`font-extrabold text-sm sm:text-base ${
                          entry.type === 'income' ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {entry.type === 'income' ? '+' : '-'} {displayAmount(entry.amount)}
                        </span>
                        <span className="text-[10px] text-gray-500">
                          {entry.display_name || entry.username}
                        </span>
                      </div>

                      {/* Hover Action Buttons */}
                      <div className="flex items-center gap-1 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => startEditEntry(entry)}
                          className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white text-xs"
                          title="Edit Entry"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(entry.id)}
                          className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-400 text-xs"
                          title="Delete Entry"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Settlement Summary if shared */}
          {view === 'shared' && data?.settlement && !data.settlement.settled && (
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-[2rem] p-4 text-center">
              <p className="text-xs text-purple-300 font-bold">
                🤝 Settlement Status: <span className="text-white">{data.settlement.owes}</span> owes <span className="text-white">{data.settlement.owedTo}</span> {displayAmount(data.settlement.amount)}
              </p>
            </div>
          )}

        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 2: PLANNING (Budgets, Goals & 50/30/20) */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'planning' && (
        <div className="space-y-6">
          
          {/* 50/30/20 Rule Card */}
          {data?.rule503020 && (
            <div className="bg-[#141414] rounded-[2.5rem] p-5 border border-white/10 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="font-bold text-sm text-white uppercase tracking-wider">50 / 30 / 20 Budget Tracker</h3>
                <span className="text-xs text-green-400 font-semibold">Healthy Targets</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Needs 50% */}
                <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-blue-400">Needs (50%)</span>
                    <span className="text-gray-400">Target: {displayAmount(data.rule503020.needs.target)}</span>
                  </div>
                  <p className="text-lg font-extrabold text-white">{displayAmount(data.rule503020.needs.spent)}</p>
                  <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-blue-400 h-full rounded-full"
                      style={{ width: `${Math.min(100, Math.round((data.rule503020.needs.spent / (data.rule503020.needs.target || 1)) * 100))}%` }}
                    />
                  </div>
                </div>

                {/* Wants 30% */}
                <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-purple-400">Wants (30%)</span>
                    <span className="text-gray-400">Target: {displayAmount(data.rule503020.wants.target)}</span>
                  </div>
                  <p className="text-lg font-extrabold text-white">{displayAmount(data.rule503020.wants.spent)}</p>
                  <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-purple-400 h-full rounded-full"
                      style={{ width: `${Math.min(100, Math.round((data.rule503020.wants.spent / (data.rule503020.wants.target || 1)) * 100))}%` }}
                    />
                  </div>
                </div>

                {/* Savings 20% */}
                <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-green-400">Savings (20%)</span>
                    <span className="text-gray-400">Target: {displayAmount(data.rule503020.savings.target)}</span>
                  </div>
                  <p className="text-lg font-extrabold text-white">{displayAmount(data.rule503020.savings.spent)}</p>
                  <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-green-400 h-full rounded-full"
                      style={{ width: `${Math.min(100, Math.round((data.rule503020.savings.spent / (data.rule503020.savings.target || 1)) * 100))}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Monthly Budgets List & Add Budget */}
          <div className="bg-[#141414] rounded-[2.5rem] p-5 border border-white/10 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="font-bold text-sm text-white uppercase tracking-wider">Category Budgets</h3>
                <p className="text-[11px] text-gray-400">Set spending limits for {getMonthLabel()}</p>
              </div>
              <button
                onClick={() => setShowBudgetForm(!showBudgetForm)}
                className="text-xs font-bold px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                {showBudgetForm ? 'Cancel' : '+ Set Budget'}
              </button>
            </div>

            {/* Set Budget Form */}
            {showBudgetForm && (
              <form onSubmit={handleSetBudget} className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Category</label>
                    <input
                      type="text"
                      value={budgetCategory}
                      onChange={(e) => setBudgetCategory(e.target.value)}
                      placeholder="e.g. Food or Overall"
                      className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Budget Limit (IDR)</label>
                    <input
                      type="number"
                      value={budgetInput}
                      onChange={(e) => setBudgetInput(e.target.value)}
                      placeholder="0"
                      className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                      min="1"
                      required
                    />
                  </div>
                </div>
                <button type="submit" className="w-full py-2 bg-green-500 text-black font-bold rounded-xl text-xs">
                  Save Budget
                </button>
              </form>
            )}

            {/* Active Budgets List */}
            {data?.budgetList?.length === 0 ? (
              <p className="text-center py-6 text-xs text-gray-500">No active budgets set for this month.</p>
            ) : (
              <div className="space-y-3">
                {data?.budgetList?.map(b => {
                  const spent = b.category === 'Overall' 
                    ? data?.summary?.totalExpense || 0
                    : data?.entries?.filter(e => e.type === 'expense' && e.category === b.category).reduce((s, e) => s + e.amount, 0) || 0;
                  const pct = Math.round((spent / (b.amount || 1)) * 100);

                  return (
                    <div key={b.id} className="p-3.5 bg-white/5 rounded-2xl border border-white/5 space-y-2">
                      <div className="flex items-center justify-between text-xs sm:text-sm">
                        <span className="font-bold text-white flex items-center gap-2">
                          <span>{getCategoryIcon(b.category)}</span>
                          <span>{b.category} Budget</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">{displayAmount(spent)} / {displayAmount(b.amount)}</span>
                          <button onClick={() => handleDeleteBudget(b.id)} className="text-red-400 text-xs hover:underline">
                            Delete
                          </button>
                        </div>
                      </div>
                      <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${pct > 100 ? 'bg-red-500' : 'bg-green-500'}`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Savings Goals */}
          <div className="bg-[#141414] rounded-[2.5rem] p-5 border border-white/10 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="font-bold text-sm text-white uppercase tracking-wider">Savings Goals</h3>
                <p className="text-[11px] text-gray-400">Save for dream trips, gifts, and future plans</p>
              </div>
              <button
                onClick={() => setShowGoalForm(!showGoalForm)}
                className="text-xs font-bold px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                {showGoalForm ? 'Cancel' : '+ New Goal'}
              </button>
            </div>

            {/* Create Goal Form */}
            {showGoalForm && (
              <form onSubmit={handleCreateGoal} className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Goal Title</label>
                    <input
                      type="text"
                      value={goalInput.title}
                      onChange={(e) => setGoalInput({ ...goalInput, title: e.target.value })}
                      placeholder="e.g. Bali Trip or House DP"
                      className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Target Amount (IDR)</label>
                    <input
                      type="number"
                      value={goalInput.target_amount}
                      onChange={(e) => setGoalInput({ ...goalInput, target_amount: e.target.value })}
                      placeholder="0"
                      className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                      min="1"
                      required
                    />
                  </div>
                </div>
                <button type="submit" className="w-full py-2 bg-green-500 text-black font-bold rounded-xl text-xs">
                  Create Goal
                </button>
              </form>
            )}

            {/* Goals Cards */}
            {goals.length === 0 ? (
              <p className="text-center py-6 text-xs text-gray-500">No active savings goals found.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {goals.map(goal => {
                  const pct = Math.round(((goal.current_amount || 0) / (goal.target_amount || 1)) * 100);
                  return (
                    <div key={goal.id} className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-3 relative group">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-sm text-white">{goal.title}</h4>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {displayAmount(goal.current_amount)} / {displayAmount(goal.target_amount)}
                          </p>
                        </div>
                        <span className="text-xs font-bold text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">
                          {pct}%
                        </span>
                      </div>

                      <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-green-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>

                      {/* Contribute & Actions */}
                      <div className="flex items-center justify-between pt-1">
                        <button
                          onClick={() => setContributeGoalId(contributeGoalId === goal.id ? null : goal.id)}
                          className="text-xs font-bold text-green-400 hover:underline"
                        >
                          + Add Contribution
                        </button>
                        <button
                          onClick={() => handleDeleteGoal(goal.id)}
                          className="text-xs text-red-400 hover:underline"
                        >
                          Delete
                        </button>
                      </div>

                      {/* Inline Contribute Form */}
                      {contributeGoalId === goal.id && (
                        <form onSubmit={handleContributeSubmit} className="pt-2 border-t border-white/5 space-y-2">
                          <input
                            type="number"
                            value={contributeInput.amount}
                            onChange={(e) => setContributeInput({ ...contributeInput, amount: e.target.value })}
                            placeholder="Amount to save (IDR)"
                            className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                            min="1"
                            required
                          />
                          <button type="submit" className="w-full py-1.5 bg-green-500 text-black text-xs font-bold rounded-xl">
                            Deposit
                          </button>
                        </form>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 3: REPORTS (Charts & Deep Analytics) */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          
          {/* Category Breakdown Donut */}
          <div className="bg-[#141414] rounded-[2.5rem] p-5 border border-white/10 shadow-xl space-y-4">
            <h3 className="font-bold text-sm text-white uppercase tracking-wider">Expense by Category</h3>
            
            {data?.charts?.categoryBreakdown?.length === 0 ? (
              <p className="text-center py-10 text-xs text-gray-500">No expense breakdown data for this month.</p>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.charts.categoryBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {data.charts.categoryBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getCategoryColor(entry.name)} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(val) => [formatRp(val), 'Amount']}
                      contentStyle={{ backgroundColor: '#1e1e1e', border: '1px solid #333', borderRadius: '12px' }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Month-over-Month Multi-Month Trend */}
          {trendData?.trends && (
            <div className="bg-[#141414] rounded-[2.5rem] p-5 border border-white/10 shadow-xl space-y-4">
              <h3 className="font-bold text-sm text-white uppercase tracking-wider">Monthly Income vs Expense Trend</h3>
              
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendData.trends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                    <XAxis dataKey="month" stroke="#777" fontSize={11} />
                    <YAxis stroke="#777" fontSize={11} tickFormatter={(v) => `${v/1000000}M`} />
                    <Tooltip 
                      formatter={(val) => [formatRp(val)]}
                      contentStyle={{ backgroundColor: '#1e1e1e', border: '1px solid #333', borderRadius: '12px' }}
                    />
                    <Legend />
                    <Bar dataKey="income" fill="#22c55e" name="Income" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="expense" fill="#ef4444" name="Expense" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Edit Entry Modal */}
      {editingEntryId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-[#141414] p-6 rounded-[2.5rem] border border-white/10 shadow-2xl space-y-4">
            <h3 className="font-bold text-base text-white">Edit Transaction</h3>
            <form onSubmit={handleEditEntry} className="space-y-3">
              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Amount (IDR)</label>
                <input
                  type="number"
                  value={editEntryInput.amount}
                  onChange={(e) => setEditEntryInput({ ...editEntryInput, amount: e.target.value })}
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-white font-bold"
                  min="1"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Category</label>
                <input
                  type="text"
                  value={editEntryInput.category}
                  onChange={(e) => setEditEntryInput({ ...editEntryInput, category: e.target.value })}
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-white text-xs"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Note</label>
                <input
                  type="text"
                  value={editEntryInput.note}
                  onChange={(e) => setEditEntryInput({ ...editEntryInput, note: e.target.value })}
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-white text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Date</label>
                <input
                  type="date"
                  value={editEntryInput.date}
                  onChange={(e) => setEditEntryInput({ ...editEntryInput, date: e.target.value })}
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-white text-xs"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingEntryId(null)}
                  className="flex-1 py-2 bg-white/10 text-white rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-green-500 text-black rounded-xl text-xs font-bold"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Smart Receipt Scanner Modal */}
      <ReceiptScannerModal
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        onApply={(scanned) => {
          setShowForm(true);
        }}
      />

    </div>
  );
}
