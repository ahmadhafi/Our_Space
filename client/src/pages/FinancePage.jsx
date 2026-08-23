import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../hooks/useApi';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import FinanceForm from '../components/FinanceForm';
import { useAuth } from '../hooks/useAuth';

const CATEGORY_COLORS = {
  Food: '#f97316',
  Transport: '#3b82f6',
  Bills: '#ef4444',
  Entertainment: '#a855f7',
  Investment: '#14b8a6',
  Savings: '#22c55e',
  Other: '#6b7280'
};

const formatRp = (amount) => {
  return `Rp ${Number(amount).toLocaleString('id-ID')}`;
};

export default function FinancePage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [view, setView] = useState('personal');
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [sortField, setSortField] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
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

  const INSTRUMENTS = ['Stocks', 'Deposit', 'Mutual Funds', 'Bank Account', 'Cash', 'Crypto', 'Other'];

  const fetchData = useCallback(async () => {
    try {
      const [financeRes, goalsRes] = await Promise.all([
        apiGet(`/api/finance?month=${month}&view=${view}`),
        apiGet(`/api/finance/goals?view=${view}`)
      ]);
      setData(financeRes);
      setGoals(goalsRes.goals);
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

  const handleSetBudget = async (e) => {
    e.preventDefault();
    if (!budgetInput) return;
    try {
      await apiPost('/api/finance/budget', { month, amount: parseInt(budgetInput, 10), category: budgetCategory, type: view });
      setShowBudgetForm(false);
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

  const sortedEntries = () => {
    if (!data?.entries) return [];
    return [...data.entries].sort((a, b) => {
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

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#1A1A1A] rounded-[1rem] p-3 text-sm shadow-lg border border-white/10 text-white">
          <p className="font-bold">{payload[0].name || payload[0].payload?.name}</p>
          <p style={{ color: payload[0].color || 'var(--color-accent)' }}>
            {formatRp(payload[0].value)}
          </p>
          {payload[1] && (
            <p style={{ color: payload[1].color }}>
              {formatRp(payload[1].value)}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="spinner !w-8 !h-8" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
          Finance <span className="text-lg">💰</span>
        </h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary text-sm"
        >
          {showForm ? 'Close' : '+ Add Entry'}
        </button>
      </div>

      {/* Add entry form */}
      {showForm && (
        <div className="mb-4">
          <FinanceForm onEntryCreated={handleEntryCreated} />
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-[#1A1A1A] p-1 rounded-full mb-4 border border-white/5">
        <button
          onClick={() => setView('personal')}
          className={`flex-1 py-2 text-sm font-bold rounded-full transition-all ${
            view === 'personal' ? 'bg-[#FFFC00] text-black shadow-sm' : 'text-gray-400 hover:text-white'
          }`}
        >
          👤 My Personal
        </button>
        <button
          onClick={() => setView('shared')}
          className={`flex-1 py-2 text-sm font-bold rounded-full transition-all ${
            view === 'shared' ? 'bg-[#FFFC00] text-black shadow-sm' : 'text-gray-400 hover:text-white'
          }`}
        >
          🤝 Shared
        </button>
      </div>

      {/* Month selector */}
      <div className="bg-[#1A1A1A] rounded-full p-4 mb-4 flex items-center justify-between border border-white/5">
        <button onClick={() => changeMonth(-1)} className="p-2 rounded-full hover:bg-white/5 transition-colors text-white">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h2 className="text-lg font-bold text-[#FFFC00]">{getMonthLabel()}</h2>
        <button onClick={() => changeMonth(1)} className="p-2 rounded-full hover:bg-white/5 transition-colors text-white">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      {/* Budget & Settlement Row */}
      <div className="grid md:grid-cols-2 gap-4 mb-4">
        {/* Category & Overall Budgets */}
        <div className="bg-[#1A1A1A] rounded-[2rem] p-5 border border-white/5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-white text-sm">Monthly Budgets</h3>
            <button onClick={() => setShowBudgetForm(!showBudgetForm)} className="text-xs text-[#FFFC00] hover:text-yellow-400 font-bold">
              {showBudgetForm ? 'Close' : '+ Add/Edit Budget'}
            </button>
          </div>
          
          {showBudgetForm && (
            <form onSubmit={handleSetBudget} className="flex gap-2 mb-4 bg-black/50 p-3 rounded-xl border border-white/5">
              <select 
                value={budgetCategory} 
                onChange={e => setBudgetCategory(e.target.value)}
                className="input-field py-2 text-xs w-28"
              >
                <option value="Overall">Overall</option>
                {Object.keys(CATEGORY_COLORS).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input 
                type="number" 
                value={budgetInput} 
                onChange={e => setBudgetInput(e.target.value)}
                placeholder="Amount"
                className="input-field py-2 text-xs flex-1"
              />
              <button type="submit" className="bg-[#FFFC00] text-black px-3 py-2 rounded-xl text-xs font-bold">Save</button>
            </form>
          )}

          {/* Overall Remaining Budget Card */}
          {data?.budgets?.Overall && (() => {
            const overallBudget = data.budgets.Overall;
            const overallSpent = data.summary.totalExpense;
            const remaining = overallBudget - overallSpent;
            const isOver = remaining < 0;
            const percent = Math.min((overallSpent / overallBudget) * 100, 100);

            return (
              <div className={`rounded-2xl p-4 mb-4 border ${isOver ? 'bg-red-500/10 border-red-500/30' : 'bg-green-500/10 border-green-500/30'}`}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    {isOver ? '⚠️ Over Budget' : '💰 Remaining Budget'}
                  </span>
                  <span className="text-[10px] text-gray-500 font-bold">
                    {formatRp(overallSpent)} spent of {formatRp(overallBudget)}
                  </span>
                </div>
                <p className={`text-2xl font-black ${isOver ? 'text-red-400' : 'text-green-400'}`}>
                  {isOver ? '-' : ''}{formatRp(Math.abs(remaining))}
                </p>
                <div className="h-2 bg-black rounded-full overflow-hidden mt-3">
                  <div 
                    className={`h-full transition-all ${isOver ? 'bg-red-500' : 'bg-green-500'}`} 
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <p className="text-[10px] text-gray-500 mt-2">
                  {isOver 
                    ? `You've exceeded your overall budget by ${formatRp(Math.abs(remaining))}`
                    : `You can still spend ${formatRp(remaining)} this month`
                  }
                </p>
              </div>
            );
          })()}

          <div className="space-y-4">
            {data?.budgets && Object.entries(data.budgets).map(([cat, amount]) => {
              // Calculate spent for this category
              let spent = 0;
              if (cat === 'Overall') {
                spent = data.summary.totalExpense;
              } else {
                spent = data.entries.filter(e => e.type === 'expense' && e.category === cat).reduce((sum, e) => sum + e.amount, 0);
              }
              const percent = Math.min((spent / amount) * 100, 100);
              const isOver = spent > amount;
              const remaining = amount - spent;

              return (
                <div key={cat}>
                  <div className="flex justify-between text-[10px] mb-1 font-bold">
                    <span className="text-white flex items-center gap-1">
                      {cat !== 'Overall' && <span className="w-2 h-2 rounded-full" style={{ background: CATEGORY_COLORS[cat] }} />}
                      {cat} Budget
                    </span>
                    <span className="text-gray-400">{formatRp(spent)} / {formatRp(amount)}</span>
                  </div>
                  <div className="h-2 bg-black rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all ${isOver ? 'bg-red-500' : 'bg-[#FFFC00]'}`} 
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  {isOver 
                    ? <p className="text-red-400 text-[10px] mt-1">Over budget by {formatRp(Math.abs(remaining))}!</p>
                    : <p className="text-green-400/70 text-[10px] mt-1">Remaining: {formatRp(remaining)}</p>
                  }
                </div>
              );
            })}
            {(!data?.budgets || Object.keys(data.budgets).length === 0) && (
              <p className="text-xs text-gray-500 text-center py-2">No budgets set for this month.</p>
            )}
          </div>
        </div>

        {/* Settlement Summary (Only visible in Shared View) */}
        {view === 'shared' && (
          <div className="bg-[#1A1A1A] rounded-[2rem] p-5 border border-white/5">
            <h3 className="font-bold text-white text-sm mb-2 flex items-center gap-2">
              🤝 Shared Expenses Split
            </h3>
            {data?.settlement ? (
              data.settlement.settled ? (
                <p className="text-green-400 text-sm font-bold">All settled up! No one owes anything.</p>
              ) : (
                <div>
                  <p className="text-white text-sm">
                    <span className="font-bold text-[#FFFC00]">{data.settlement.owes}</span> owes <span className="font-bold text-[#FFFC00]">{data.settlement.owedTo}</span>
                  </p>
                  <p className="text-2xl font-black text-red-400 mt-1">{formatRp(data.settlement.amount)}</p>
                </div>
              )
            ) : (
              <p className="text-xs text-gray-500">Add shared expenses to see split balances.</p>
            )}
          </div>
        )}
      </div>

      {/* 50/30/20 Rule Summary */}
      {data?.rule503020 && (
        <div className="mb-6 grid grid-cols-3 gap-3">
          <div className="bg-[#1A1A1A] rounded-[2rem] p-4 border border-white/5 text-center flex flex-col justify-center">
            <p className="text-[10px] text-gray-500 font-bold tracking-wider uppercase mb-2">Needs (50%)</p>
            <div className="h-2 bg-black rounded-full mb-3 overflow-hidden">
              <div className="h-full bg-blue-500 transition-all" style={{ width: `${Math.min((data.rule503020.needs.spent / (data.rule503020.needs.target || 1)) * 100, 100)}%` }} />
            </div>
            <p className="text-sm font-bold text-white mb-1">{formatRp(data.rule503020.needs.spent)}</p>
            <p className="text-[10px] text-gray-500">Target: {formatRp(data.rule503020.needs.target)}</p>
          </div>
          <div className="bg-[#1A1A1A] rounded-[2rem] p-4 border border-white/5 text-center flex flex-col justify-center">
            <p className="text-[10px] text-gray-500 font-bold tracking-wider uppercase mb-2">Wants (30%)</p>
            <div className="h-2 bg-black rounded-full mb-3 overflow-hidden">
              <div className="h-full bg-purple-500 transition-all" style={{ width: `${Math.min((data.rule503020.wants.spent / (data.rule503020.wants.target || 1)) * 100, 100)}%` }} />
            </div>
            <p className="text-sm font-bold text-white mb-1">{formatRp(data.rule503020.wants.spent)}</p>
            <p className="text-[10px] text-gray-500">Target: {formatRp(data.rule503020.wants.target)}</p>
          </div>
          <div className="bg-[#1A1A1A] rounded-[2rem] p-4 border border-white/5 text-center flex flex-col justify-center">
            <p className="text-[10px] text-gray-500 font-bold tracking-wider uppercase mb-2">Savings (20%)</p>
            <div className="h-2 bg-black rounded-full mb-3 overflow-hidden">
              <div className="h-full bg-green-500 transition-all" style={{ width: `${Math.min((data.rule503020.savings.spent / (data.rule503020.savings.target || 1)) * 100, 100)}%` }} />
            </div>
            <p className="text-sm font-bold text-white mb-1">{formatRp(data.rule503020.savings.spent)}</p>
            <p className="text-[10px] text-gray-500">Target: {formatRp(data.rule503020.savings.target)}</p>
          </div>
        </div>
      )}

      {/* Savings Goals */}
      <div className="bg-[#1A1A1A] rounded-[2rem] p-5 border border-white/5 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-white text-sm">Savings Goals</h3>
          <button onClick={() => setShowGoalForm(!showGoalForm)} className="text-xs text-[#FFFC00] hover:text-yellow-400 font-bold">
            {showGoalForm ? 'Close' : '+ New Goal'}
          </button>
        </div>

        {showGoalForm && (
          <form onSubmit={handleCreateGoal} className="flex flex-col gap-2 mb-4 bg-black/50 p-3 rounded-xl border border-white/5">
            <input 
              type="text" 
              value={goalInput.title} 
              onChange={e => setGoalInput({ ...goalInput, title: e.target.value })}
              placeholder="Goal Title (e.g. Vacation)"
              className="input-field py-2 text-xs"
            />
            <div className="flex gap-2">
              <input 
                type="number" 
                value={goalInput.target_amount} 
                onChange={e => setGoalInput({ ...goalInput, target_amount: e.target.value })}
                placeholder="Target Amount"
                className="input-field py-2 text-xs flex-1"
              />
              <button type="submit" className="bg-[#FFFC00] text-black px-4 py-2 rounded-xl text-xs font-bold">Add</button>
            </div>
          </form>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          {goals.map(goal => {
            const percent = Math.min((goal.current_amount / goal.target_amount) * 100, 100);
            return (
              <div key={goal.id} className="bg-black/40 rounded-2xl p-4 border border-white/5">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-bold text-white text-sm">{goal.title}</h4>
                    <p className="text-[10px] text-gray-500">
                      {formatRp(goal.current_amount)} / {formatRp(goal.target_amount)}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setShowHistoryGoalId(showHistoryGoalId === goal.id ? null : goal.id)} className="text-[10px] font-bold bg-white/10 text-white px-2 py-1 rounded-lg">
                      Manage
                    </button>
                    <button onClick={() => setContributeGoalId(goal.id)} className="text-[10px] font-bold bg-[#FFFC00] text-black px-2 py-1 rounded-lg">
                      Contribute
                    </button>
                    {(user?.is_admin) && (
                      <button onClick={() => handleDeleteGoal(goal.id)} className="text-[10px] font-bold bg-red-500/20 text-red-400 px-2 py-1 rounded-lg hover:bg-red-500/30">
                        Delete
                      </button>
                    )}
                  </div>
                </div>
                <div className="h-2 bg-black rounded-full overflow-hidden mt-2 mb-2">
                  <div className="h-full bg-green-500 transition-all" style={{ width: `${percent}%` }} />
                </div>
                
                {/* Instrument Breakdown */}
                {goal.instruments && Object.keys(goal.instruments).length > 0 && (
                  <div className="mt-2 pt-2 border-t border-white/5 flex flex-wrap gap-2">
                    {Object.entries(goal.instruments).map(([inst, amt]) => (
                      <span key={inst} className="text-[9px] bg-white/5 text-gray-400 px-2 py-1 rounded-md">
                        <span className="font-bold text-gray-300">{inst}:</span> {formatRp(amt)}
                      </span>
                    ))}
                  </div>
                )}
                
                {/* Contribution Form (Inline) */}
                {contributeGoalId === goal.id && (
                  <form onSubmit={handleContributeSubmit} className="mt-3 bg-black/60 p-2 rounded-xl border border-white/10 flex flex-col gap-2">
                    <div className="flex gap-2">
                      <select 
                        value={contributeInput.instrument}
                        onChange={e => setContributeInput({ ...contributeInput, instrument: e.target.value })}
                        className="input-field py-1 text-xs px-2 flex-1"
                      >
                        {INSTRUMENTS.map(i => <option key={i} value={i}>{i}</option>)}
                      </select>
                      <button type="button" onClick={() => setContributeGoalId(null)} className="text-[10px] text-gray-400 font-bold px-2">Cancel</button>
                    </div>
                    <div className="flex gap-2">
                      <input 
                        type="number" 
                        value={contributeInput.amount}
                        onChange={e => setContributeInput({ ...contributeInput, amount: e.target.value })}
                        placeholder="Amount (Rp)"
                        className="input-field py-1 text-xs px-2 flex-1"
                        min="1"
                      />
                      <button type="submit" className="bg-[#FFFC00] text-black px-3 py-1 rounded-lg text-xs font-bold">Save</button>
                    </div>
                  </form>
                )}

                {/* Manage History */}
                {showHistoryGoalId === goal.id && goal.history && goal.history.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
                    <h5 className="text-[10px] font-bold text-gray-500 uppercase">Contribution History</h5>
                    {goal.history.map(contrib => (
                      <div key={contrib.id} className="bg-black/30 p-2 rounded-lg flex justify-between items-center group">
                        {editingContribId === contrib.id ? (
                          <form onSubmit={(e) => handleEditContribSubmit(e, contrib.id)} className="flex w-full gap-2 items-center">
                            <select 
                              value={editContribInput.instrument}
                              onChange={e => setEditContribInput({ ...editContribInput, instrument: e.target.value })}
                              className="input-field py-1 text-xs px-2 w-24"
                            >
                              {INSTRUMENTS.map(i => <option key={i} value={i}>{i}</option>)}
                            </select>
                            <input 
                              type="number" 
                              value={editContribInput.amount}
                              onChange={e => setEditContribInput({ ...editContribInput, amount: e.target.value })}
                              className="input-field py-1 text-xs px-2 flex-1"
                              min="1"
                            />
                            <button type="submit" className="text-[10px] font-bold text-[#FFFC00]">Save</button>
                            <button type="button" onClick={() => setEditingContribId(null)} className="text-[10px] font-bold text-gray-400">Cancel</button>
                          </form>
                        ) : (
                          <>
                            <div>
                              <p className="text-xs text-white font-bold">{formatRp(contrib.amount)} <span className="text-gray-400 font-normal">in {contrib.instrument}</span></p>
                              <p className="text-[9px] text-gray-500">{new Date(contrib.created_at).toLocaleDateString()} • By {contrib.display_name || contrib.username}</p>
                            </div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => {
                                  setEditingContribId(contrib.id);
                                  setEditContribInput({ amount: contrib.amount.toString(), instrument: contrib.instrument });
                                }} 
                                className="text-[10px] text-blue-400 hover:text-blue-300"
                              >
                                Edit
                              </button>
                              <button onClick={() => handleDeleteContrib(contrib.id)} className="text-[10px] text-red-400 hover:text-red-300">
                                Delete
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {goals.length === 0 && (
            <p className="text-xs text-gray-500 text-center py-2 col-span-2">No savings goals set.</p>
          )}
        </div>
      </div>

      {/* Charts */}
      {data?.entries?.length > 0 && (
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          {/* Donut chart — expense by category */}
          {data.charts.categoryBreakdown.length > 0 && (
            <div className="bg-[#1A1A1A] rounded-[2rem] p-5 border border-white/5">
              <h3 className="font-bold text-sm mb-3 text-white">Expense by Category</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={data.charts.categoryBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {data.charts.categoryBreakdown.map((entry) => (
                      <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name] || '#6b7280'} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    formatter={(value) => <span className="text-xs">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Bar chart — weekly income vs expense */}
          <div className="bg-[#1A1A1A] rounded-[2rem] p-5 border border-white/5">
            <h3 className="font-bold text-sm mb-3 text-white">Income vs Expense</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.charts.weeklyComparison} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend formatter={(value) => <span className="text-xs capitalize">{value}</span>} />
                <Bar dataKey="income" fill="#22c55e" radius={[4, 4, 0, 0]} name="Income" />
                <Bar dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} name="Expense" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Detail table */}
      <div className="bg-[#1A1A1A] rounded-[2rem] overflow-hidden border border-white/5 mb-6">
        <div className="p-5 border-b border-white/5">
          <h3 className="font-bold text-sm text-white">All Entries</h3>
        </div>

        {data?.entries?.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <div className="text-3xl mb-2">📊</div>
            <p className="text-sm">No entries for this month</p>
          </div>
        ) : (
          <div>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    <th
                      className="text-left p-4 font-bold text-gray-400 cursor-pointer hover:text-white select-none"
                      onClick={() => toggleSort('date')}
                    >
                      Date {sortField === 'date' && (sortDir === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="text-left p-4 font-bold text-gray-400">Type</th>
                    <th className="text-left p-4 font-bold text-gray-400">Category</th>
                    <th
                      className="text-right p-4 font-bold text-gray-400 cursor-pointer hover:text-white select-none"
                      onClick={() => toggleSort('amount')}
                    >
                      Amount {sortField === 'amount' && (sortDir === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="text-left p-4 font-bold text-gray-400">Note</th>
                    <th className="text-left p-4 font-bold text-gray-400">By</th>
                    <th className="p-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedEntries().map(entry => (
                    <tr key={entry.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                      <td className="p-4 text-gray-300">
                        {new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          entry.type === 'income' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {entry.type === 'income' ? '💰' : '💸'} {entry.type.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="flex items-center gap-1.5 text-gray-300">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: CATEGORY_COLORS[entry.category] }} />
                          {entry.category}
                        </span>
                      </td>
                      <td className={`p-4 text-right font-bold ${entry.type === 'income' ? 'text-green-400' : 'text-red-500'}`}>
                        {entry.type === 'income' ? '+' : '-'}{formatRp(entry.amount)}
                      </td>
                      <td className="p-4 text-gray-400 max-w-[120px] truncate">{entry.note || '—'}</td>
                      <td className="p-4">
                        <span className="text-xs text-gray-500 font-bold">{entry.display_name || entry.username}</span>
                      </td>
                      <td className="p-4">
                        {(entry.user_id === user?.id || user?.is_admin) && (
                          <button
                            onClick={() => handleDelete(entry.id)}
                            className="p-1 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-500 transition-colors"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile List View */}
            <div className="block md:hidden">
              {sortedEntries().map(entry => (
                <div key={entry.id} className="p-4 border-b border-white/5 hover:bg-white/[0.02] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: `${CATEGORY_COLORS[entry.category] || '#6b7280'}33` }}>
                      <span className="text-lg">{entry.type === 'income' ? '💰' : '💸'}</span>
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm truncate max-w-[150px]">{entry.category}</p>
                      <p className="text-xs text-gray-500">{new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} • {entry.note || 'No note'}</p>
                      {view === 'shared' && <p className="text-[10px] text-gray-400 mt-0.5">By {entry.display_name || entry.username}</p>}
                    </div>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-1">
                    <p className={`font-bold text-sm ${entry.type === 'income' ? 'text-green-400' : 'text-red-500'}`}>
                      {entry.type === 'income' ? '+' : '-'}{formatRp(entry.amount)}
                    </p>
                    {(entry.user_id === user?.id || user?.is_admin) && (
                      <button onClick={() => handleDelete(entry.id)} className="text-[10px] text-red-500/80 hover:text-red-400 bg-red-500/10 px-2 py-0.5 rounded-lg">
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
