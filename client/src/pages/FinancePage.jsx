import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../hooks/useApi';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import FinanceForm from '../components/FinanceForm';
import { getCategoryColor } from '../components/CategoryPickerModal';
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
  
  const [hideBalance, setHideBalance] = useState(false);
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

  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const [trendData, setTrendData] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);

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

  const handleDeleteBudget = async (id) => {
    if (!confirm('Delete this budget?')) return;
    try {
      await apiDelete(`/api/finance/budget/${id}`);
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

  const handleDeleteGoal = async (goalId) => {
    if (!confirm('Delete this saving goal?')) return;
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

  const getMonthComparison = () => {
    const currentSpent = data?.summary?.totalExpense || 0;
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
        <div className="spinner !w-8 !h-8 mb-2.5" />
        <p className="text-xs text-gray-500">Loading financial data...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in px-3 sm:px-4 pb-20 max-w-3xl mx-auto text-white space-y-4">
      
      {/* Top Bar */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Finance</h1>
          <p className="text-xs text-gray-500">Expense tracking & financial overview</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowScannerModal(true)}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-medium transition-colors"
          >
            Scan Receipt
          </button>

          <button
            onClick={() => setShowForm(!showForm)}
            className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-gray-200 text-black text-xs font-semibold transition-colors"
          >
            {showForm ? 'Close' : '+ New Entry'}
          </button>
        </div>
      </div>

      {/* Modern Balance Card */}
      <div className="bg-[#121212] rounded-2xl p-5 border border-white/10 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wider font-medium text-gray-400">Net Balance</span>
            <button
              type="button"
              onClick={() => setHideBalance(!hideBalance)}
              className="text-gray-500 hover:text-gray-300 text-xs transition-colors"
            >
              {hideBalance ? 'Show' : 'Hide'}
            </button>
          </div>

          <div className="flex rounded-lg p-0.5 bg-black/40 border border-white/10 text-xs">
            <button
              onClick={() => setView('personal')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                view === 'personal' ? 'bg-white text-black font-semibold' : 'text-gray-400 hover:text-white'
              }`}
            >
              Personal
            </button>
            <button
              onClick={() => setView('shared')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                view === 'shared' ? 'bg-white text-black font-semibold' : 'text-gray-400 hover:text-white'
              }`}
            >
              Shared
            </button>
          </div>
        </div>

        <div className="text-3xl font-bold text-white tracking-tight">
          {displayAmount(data?.summary?.netBalance || 0)}
        </div>

        {/* Sub Income / Expense Row */}
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/5 text-xs">
          <div>
            <span className="text-gray-500 block mb-0.5 font-medium">Income</span>
            <span className="font-semibold text-emerald-400 text-sm">
              {displayAmount(data?.summary?.totalIncome || 0)}
            </span>
          </div>
          <div>
            <span className="text-gray-500 block mb-0.5 font-medium">Expense</span>
            <span className="font-semibold text-rose-400 text-sm">
              {displayAmount(data?.summary?.totalExpense || 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Segmented Navigation Tabs */}
      <div className="flex bg-[#121212] p-1 rounded-xl border border-white/10 text-xs font-medium">
        {[
          { id: 'transactions', label: 'Transactions' },
          { id: 'planning', label: 'Planning' },
          { id: 'reports', label: 'Reports' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 rounded-lg transition-all ${
              activeTab === tab.id
                ? 'bg-white text-black font-semibold shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Inline Form */}
      {showForm && (
        <FinanceForm 
          onEntryCreated={handleEntryCreated} 
          onCancel={() => setShowForm(false)} 
        />
      )}

      {/* Month Selector Bar */}
      <div className="flex items-center justify-between bg-[#121212] rounded-xl px-4 py-2 border border-white/10 text-xs">
        <button onClick={() => changeMonth(-1)} className="text-gray-400 hover:text-white font-bold p-1">
          ‹ Previous
        </button>
        <span className="font-semibold text-gray-200">{getMonthLabel()}</span>
        <button onClick={() => changeMonth(1)} className="text-gray-400 hover:text-white font-bold p-1">
          Next ›
        </button>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 1: TRANSACTIONS */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'transactions' && (
        <div className="space-y-4">
          
          {/* Monthly Spending Comparison */}
          <div className="bg-[#121212] rounded-2xl p-4 border border-white/10 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-[11px] uppercase tracking-wider font-medium text-gray-400">Monthly Spending</span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-lg font-bold text-white">
                    {displayAmount(monthComp.currentSpent)}
                  </span>
                  {monthComp.previousSpent > 0 && (
                    <span className={`text-[11px] font-medium ${
                      monthComp.isDecrease ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {monthComp.isDecrease ? '↓' : '↑'} {Math.abs(monthComp.diffPercent)}% vs last month
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="h-24 w-full pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { name: 'Last month', amount: monthComp.previousSpent },
                    { name: 'This month', amount: monthComp.currentSpent }
                  ]}
                  margin={{ top: 5, right: 5, left: 5, bottom: 0 }}
                >
                  <XAxis dataKey="name" stroke="#666" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip 
                    formatter={(val) => [formatRp(val), 'Spent']}
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', fontSize: '11px' }}
                  />
                  <Bar dataKey="amount" fill="#e11d48" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Spending Categories */}
          {topSpendings.length > 0 && (
            <div className="bg-[#121212] rounded-2xl p-4 border border-white/10 shadow-sm space-y-2.5">
              <div className="flex items-center justify-between pb-1.5 border-b border-white/5">
                <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Top Spending</span>
                <span className="text-[11px] text-gray-500">{topSpendings.length} categories</span>
              </div>

              <div className="space-y-2">
                {topSpendings.map(item => (
                  <div key={item.category} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span 
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: getCategoryColor(item.category) }}
                        />
                        <span className="text-gray-200 font-medium">{item.category}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-gray-500 font-mono text-[11px]">{item.percentage}%</span>
                        <span className="font-semibold text-white">{displayAmount(item.amount)}</span>
                      </div>
                    </div>
                    <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-300"
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

          {/* Transactions List */}
          <div className="bg-[#121212] rounded-2xl p-4 border border-white/10 shadow-sm space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  {selectedCategory ? `${selectedCategory}` : 'All Transactions'}
                </span>
                {selectedCategory && (
                  <button 
                    onClick={() => setSelectedCategory(null)} 
                    className="text-[10px] text-gray-400 hover:text-white underline"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 text-[11px] text-gray-400">
                <button
                  onClick={() => toggleSort('date')}
                  className="hover:text-white"
                >
                  Date {sortField === 'date' && (sortDir === 'asc' ? '↑' : '↓')}
                </button>
                <span>•</span>
                <button
                  onClick={() => toggleSort('amount')}
                  className="hover:text-white"
                >
                  Amount {sortField === 'amount' && (sortDir === 'asc' ? '↑' : '↓')}
                </button>
              </div>
            </div>

            {sortedEntries().length === 0 ? (
              <div className="py-8 text-center text-gray-500 text-xs">
                No transactions recorded for this month.
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {sortedEntries().map(entry => (
                  <div 
                    key={entry.id}
                    className="py-2.5 flex items-center justify-between hover:bg-white/[0.02] px-1.5 rounded-lg transition-colors group"
                  >
                    {/* Left: Category dot, Title & Date */}
                    <div className="flex items-center gap-2.5">
                      <span 
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: getCategoryColor(entry.category) }}
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-xs text-white">{entry.category}</span>
                          {entry.split_type === 'shared' && (
                            <span className="text-[9px] px-1.5 py-0.2 bg-white/10 text-gray-300 rounded font-medium">
                              Shared
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-500">
                          {entry.note || (entry.type === 'income' ? 'Income' : 'Expense')} • {entry.date.split('T')[0]}
                        </p>
                      </div>
                    </div>

                    {/* Right: Amount & Options */}
                    <div className="flex items-center gap-2.5 text-right">
                      <div>
                        <span className={`font-semibold text-xs ${
                          entry.type === 'income' ? 'text-emerald-400' : 'text-white'
                        }`}>
                          {entry.type === 'income' ? '+' : '-'} {displayAmount(entry.amount)}
                        </span>
                        <p className="text-[10px] text-gray-500">{entry.display_name || entry.username}</p>
                      </div>

                      <div className="flex items-center gap-1 opacity-70 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => startEditEntry(entry)}
                          className="p-1 text-gray-400 hover:text-white text-xs"
                          title="Edit"
                        >
                          ✎
                        </button>
                        <button
                          onClick={() => handleDelete(entry.id)}
                          className="p-1 text-red-400 hover:text-red-300 text-xs"
                          title="Delete"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 2: PLANNING */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'planning' && (
        <div className="space-y-4">
          
          {/* 50/30/20 Rule Card */}
          {data?.rule503020 && (
            <div className="bg-[#121212] rounded-2xl p-4 border border-white/10 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">50 / 30 / 20 Budget Target</span>
                <span className="text-[11px] text-emerald-400 font-medium">Income Guide</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                {/* Needs */}
                <div className="bg-white/[0.02] rounded-xl p-3 border border-white/5 space-y-1">
                  <div className="flex justify-between text-gray-400 text-[11px]">
                    <span>Needs (50%)</span>
                    <span>{displayAmount(data.rule503020.needs.target)}</span>
                  </div>
                  <p className="text-sm font-semibold text-white">{displayAmount(data.rule503020.needs.spent)}</p>
                  <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                    <div 
                      className="bg-blue-400 h-full rounded-full"
                      style={{ width: `${Math.min(100, Math.round((data.rule503020.needs.spent / (data.rule503020.needs.target || 1)) * 100))}%` }}
                    />
                  </div>
                </div>

                {/* Wants */}
                <div className="bg-white/[0.02] rounded-xl p-3 border border-white/5 space-y-1">
                  <div className="flex justify-between text-gray-400 text-[11px]">
                    <span>Wants (30%)</span>
                    <span>{displayAmount(data.rule503020.wants.target)}</span>
                  </div>
                  <p className="text-sm font-semibold text-white">{displayAmount(data.rule503020.wants.spent)}</p>
                  <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                    <div 
                      className="bg-purple-400 h-full rounded-full"
                      style={{ width: `${Math.min(100, Math.round((data.rule503020.wants.spent / (data.rule503020.wants.target || 1)) * 100))}%` }}
                    />
                  </div>
                </div>

                {/* Savings */}
                <div className="bg-white/[0.02] rounded-xl p-3 border border-white/5 space-y-1">
                  <div className="flex justify-between text-gray-400 text-[11px]">
                    <span>Savings (20%)</span>
                    <span>{displayAmount(data.rule503020.savings.target)}</span>
                  </div>
                  <p className="text-sm font-semibold text-white">{displayAmount(data.rule503020.savings.spent)}</p>
                  <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                    <div 
                      className="bg-emerald-400 h-full rounded-full"
                      style={{ width: `${Math.min(100, Math.round((data.rule503020.savings.spent / (data.rule503020.savings.target || 1)) * 100))}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Category Budgets */}
          <div className="bg-[#121212] rounded-2xl p-4 border border-white/10 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Budgets</span>
              <button
                onClick={() => setShowBudgetForm(!showBudgetForm)}
                className="text-xs text-white font-medium hover:underline"
              >
                {showBudgetForm ? 'Cancel' : '+ Add Budget'}
              </button>
            </div>

            {showBudgetForm && (
              <form onSubmit={handleSetBudget} className="p-3 bg-white/[0.02] rounded-xl border border-white/5 space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    value={budgetCategory}
                    onChange={(e) => setBudgetCategory(e.target.value)}
                    placeholder="Category (e.g. Food or Overall)"
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white"
                    required
                  />
                  <input
                    type="number"
                    value={budgetInput}
                    onChange={(e) => setBudgetInput(e.target.value)}
                    placeholder="Budget limit (IDR)"
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white"
                    min="1"
                    required
                  />
                </div>
                <button type="submit" className="w-full py-1.5 bg-white text-black font-semibold rounded-lg text-xs">
                  Save Budget
                </button>
              </form>
            )}

            {data?.budgetList?.length === 0 ? (
              <p className="text-center py-4 text-xs text-gray-500">No category budgets set.</p>
            ) : (
              <div className="space-y-2">
                {data?.budgetList?.map(b => {
                  const spent = b.category === 'Overall' 
                    ? data?.summary?.totalExpense || 0
                    : data?.entries?.filter(e => e.type === 'expense' && e.category === b.category).reduce((s, e) => s + e.amount, 0) || 0;
                  const pct = Math.round((spent / (b.amount || 1)) * 100);

                  return (
                    <div key={b.id} className="p-3 bg-white/[0.02] rounded-xl border border-white/5 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-white">{b.category}</span>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-gray-400">{displayAmount(spent)} / {displayAmount(b.amount)}</span>
                          <button onClick={() => handleDeleteBudget(b.id)} className="text-red-400 hover:text-red-300">
                            ✕
                          </button>
                        </div>
                      </div>
                      <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${pct > 100 ? 'bg-rose-500' : 'bg-white'}`}
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
          <div className="bg-[#121212] rounded-2xl p-4 border border-white/10 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Savings Goals</span>
              <button
                onClick={() => setShowGoalForm(!showGoalForm)}
                className="text-xs text-white font-medium hover:underline"
              >
                {showGoalForm ? 'Cancel' : '+ New Goal'}
              </button>
            </div>

            {showGoalForm && (
              <form onSubmit={handleCreateGoal} className="p-3 bg-white/[0.02] rounded-xl border border-white/5 space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    value={goalInput.title}
                    onChange={(e) => setGoalInput({ ...goalInput, title: e.target.value })}
                    placeholder="Goal title (e.g. Travel, Emergency)"
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white"
                    required
                  />
                  <input
                    type="number"
                    value={goalInput.target_amount}
                    onChange={(e) => setGoalInput({ ...goalInput, target_amount: e.target.value })}
                    placeholder="Target amount (IDR)"
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white"
                    min="1"
                    required
                  />
                </div>
                <button type="submit" className="w-full py-1.5 bg-white text-black font-semibold rounded-lg text-xs">
                  Create Goal
                </button>
              </form>
            )}

            {goals.length === 0 ? (
              <p className="text-center py-4 text-xs text-gray-500">No savings goals created.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {goals.map(goal => {
                  const pct = Math.round(((goal.current_amount || 0) / (goal.target_amount || 1)) * 100);
                  return (
                    <div key={goal.id} className="p-3 bg-white/[0.02] rounded-xl border border-white/5 space-y-2">
                      <div className="flex justify-between items-start text-xs">
                        <div>
                          <h4 className="font-semibold text-white">{goal.title}</h4>
                          <p className="text-gray-400 text-[11px]">
                            {displayAmount(goal.current_amount)} / {displayAmount(goal.target_amount)}
                          </p>
                        </div>
                        <span className="text-[11px] font-semibold text-gray-300">
                          {pct}%
                        </span>
                      </div>

                      <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                        <div 
                          className="bg-white h-full rounded-full"
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-xs pt-0.5">
                        <button
                          onClick={() => setContributeGoalId(contributeGoalId === goal.id ? null : goal.id)}
                          className="text-gray-300 hover:text-white underline text-[11px]"
                        >
                          + Deposit
                        </button>
                        <button
                          onClick={() => handleDeleteGoal(goal.id)}
                          className="text-red-400 hover:text-red-300 text-[11px]"
                        >
                          Delete
                        </button>
                      </div>

                      {contributeGoalId === goal.id && (
                        <form onSubmit={handleContributeSubmit} className="pt-2 border-t border-white/5 space-y-2">
                          <input
                            type="number"
                            value={contributeInput.amount}
                            onChange={(e) => setContributeInput({ ...contributeInput, amount: e.target.value })}
                            placeholder="Deposit amount (IDR)"
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
                            min="1"
                            required
                          />
                          <button type="submit" className="w-full py-1 bg-white text-black font-semibold text-xs rounded-lg">
                            Save
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
      {/* TAB 3: REPORTS */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          
          {/* Category Breakdown */}
          <div className="bg-[#121212] rounded-2xl p-4 border border-white/10 shadow-sm space-y-3">
            <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Category Breakdown</span>
            
            {data?.charts?.categoryBreakdown?.length === 0 ? (
              <p className="text-center py-6 text-xs text-gray-500">No expense breakdown data available.</p>
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.charts.categoryBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {data.charts.categoryBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getCategoryColor(entry.name)} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(val) => [formatRp(val), 'Amount']}
                      contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', fontSize: '11px' }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Monthly Trend */}
          {trendData?.trends && (
            <div className="bg-[#121212] rounded-2xl p-4 border border-white/10 shadow-sm space-y-3">
              <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Income vs Expense Trend</span>
              
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendData.trends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                    <XAxis dataKey="month" stroke="#666" fontSize={10} />
                    <YAxis stroke="#666" fontSize={10} tickFormatter={(v) => `${v/1000000}M`} />
                    <Tooltip 
                      formatter={(val) => [formatRp(val)]}
                      contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', fontSize: '11px' }}
                    />
                    <Legend />
                    <Bar dataKey="income" fill="#10b981" name="Income" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expense" fill="#f43f5e" name="Expense" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Edit Entry Modal */}
      {editingEntryId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in text-white">
          <div className="w-full max-w-sm bg-[#121212] p-5 rounded-2xl border border-white/10 shadow-2xl space-y-3">
            <h3 className="font-semibold text-sm text-white">Edit Transaction</h3>
            <form onSubmit={handleEditEntry} className="space-y-2.5">
              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Amount (IDR)</label>
                <input
                  type="number"
                  value={editEntryInput.amount}
                  onChange={(e) => setEditEntryInput({ ...editEntryInput, amount: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white font-semibold text-sm"
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
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Note</label>
                <input
                  type="text"
                  value={editEntryInput.note}
                  onChange={(e) => setEditEntryInput({ ...editEntryInput, note: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Date</label>
                <input
                  type="date"
                  value={editEntryInput.date}
                  onChange={(e) => setEditEntryInput({ ...editEntryInput, date: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingEntryId(null)}
                  className="flex-1 py-1.5 bg-white/10 text-white rounded-lg text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-1.5 bg-white text-black rounded-lg text-xs font-semibold"
                >
                  Save
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
        onEntrySaved={() => {
          fetchData();
        }}
      />

    </div>
  );
}
