import { useState } from 'react';

export const CATEGORIES_CONFIG = {
  expense: [
    {
      group: 'Bills & Utilities',
      icon: '💡',
      color: '#ef4444',
      items: [
        { name: 'Bills', icon: '🧾' },
        { name: 'Electricity Bill', icon: '⚡' },
        { name: 'Water Bill', icon: '💧' },
        { name: 'Internet Bill', icon: '📶' },
        { name: 'Phone Bill', icon: '📱' },
        { name: 'Rent', icon: '🏠' },
        { name: 'Gas Bill', icon: '🔥' },
        { name: 'Television Bill', icon: '📺' }
      ]
    },
    {
      group: 'Food & Beverage',
      icon: '🍸',
      color: '#f97316',
      items: [
        { name: 'Food', icon: '🍱' },
        { name: 'Cafe & Coffee', icon: '☕' },
        { name: 'Restaurant', icon: '🍽️' },
        { name: 'Groceries', icon: '🛒' },
        { name: 'Snacks & Dessert', icon: '🍰' }
      ]
    },
    {
      group: 'Transportation',
      icon: '🚗',
      color: '#3b82f6',
      items: [
        { name: 'Transport', icon: '🚌' },
        { name: 'Fuel & Bensin', icon: '⛽' },
        { name: 'Vehicle Maintenance', icon: '🔧' },
        { name: 'Parking & Toll', icon: '🅿️' },
        { name: 'Taxi & Ride', icon: '🚕' }
      ]
    },
    {
      group: 'Shopping',
      icon: '🛍️',
      color: '#ec4899',
      items: [
        { name: 'Shopping', icon: '🛍️' },
        { name: 'Personal Items', icon: '🧴' },
        { name: 'Makeup & Skincare', icon: '💄' },
        { name: 'Houseware', icon: '🛋️' },
        { name: 'Electronics', icon: '💻' }
      ]
    },
    {
      group: 'Entertainment',
      icon: '🎮',
      color: '#a855f7',
      items: [
        { name: 'Entertainment', icon: '🎉' },
        { name: 'Fun Money', icon: '🎡' },
        { name: 'Streaming Service', icon: '🎬' },
        { name: 'Games', icon: '🕹️' }
      ]
    },
    {
      group: 'Health & Fitness',
      icon: '🏥',
      color: '#fb7185',
      items: [
        { name: 'Healthcare', icon: '💊' },
        { name: 'Fitness & Gym', icon: '🏋️' },
        { name: 'Medical Check-up', icon: '🩺' },
        { name: 'Pharmacy', icon: '🩹' }
      ]
    },
    {
      group: 'Family & Home',
      icon: '🏡',
      color: '#10b981',
      items: [
        { name: 'Home Maintenance', icon: '🔨' },
        { name: 'Pets', icon: '🐾' },
        { name: 'Home Services', icon: '🧹' }
      ]
    },
    {
      group: 'Education',
      icon: '🎓',
      color: '#fbbf24',
      items: [
        { name: 'Education', icon: '📚' },
        { name: 'Courses & Lessons', icon: '💻' },
        { name: 'Books', icon: '📖' }
      ]
    },
    {
      group: 'Investment & Insurance',
      icon: '📈',
      color: '#14b8a6',
      items: [
        { name: 'Investment', icon: '📊' },
        { name: 'Insurance', icon: '🛡️' },
        { name: 'Savings', icon: '💰' }
      ]
    },
    {
      group: 'Other',
      icon: '📦',
      color: '#6b7280',
      items: [
        { name: 'Other', icon: '📦' },
        { name: 'Gifts & Donations', icon: '🎁' },
        { name: 'Outgoing Transfer', icon: '📤' }
      ]
    }
  ],
  income: [
    {
      group: 'Income Streams',
      icon: '💵',
      color: '#22c55e',
      items: [
        { name: 'Salary', icon: '💵' },
        { name: 'Bonus', icon: '🎯' },
        { name: 'Freelance', icon: '💻' },
        { name: 'Incoming Transfer', icon: '📥' },
        { name: 'Investment Return', icon: '📈' },
        { name: 'Collect Interest', icon: '🪙' },
        { name: 'Gift', icon: '🎁' },
        { name: 'Other Income', icon: '💰' }
      ]
    }
  ],
  debt: [
    {
      group: 'Debt & Loan Management',
      icon: '🤝',
      color: '#f59e0b',
      items: [
        { name: 'Loan Payment', icon: '💸' },
        { name: 'Credit Card', icon: '💳' },
        { name: 'Debt', icon: '📉' },
        { name: 'Debt Collection', icon: '🤝' },
        { name: 'Loan', icon: '🏦' },
        { name: 'Repayment', icon: '🔄' }
      ]
    }
  ]
};

export const ALL_CATEGORY_LIST = [
  ...CATEGORIES_CONFIG.expense.flatMap(g => g.items.map(i => i.name)),
  ...CATEGORIES_CONFIG.income.flatMap(g => g.items.map(i => i.name)),
  ...CATEGORIES_CONFIG.debt.flatMap(g => g.items.map(i => i.name))
];

export function getCategoryIcon(categoryName) {
  for (const tab of ['expense', 'income', 'debt']) {
    for (const group of CATEGORIES_CONFIG[tab]) {
      const found = group.items.find(i => i.name.toLowerCase() === (categoryName || '').toLowerCase());
      if (found) return found.icon;
    }
  }
  return '💳';
}

export function getCategoryColor(categoryName) {
  for (const tab of ['expense', 'income', 'debt']) {
    for (const group of CATEGORIES_CONFIG[tab]) {
      const found = group.items.find(i => i.name.toLowerCase() === (categoryName || '').toLowerCase());
      if (found) return group.color;
    }
  }
  return '#6b7280';
}

export default function CategoryPickerModal({ currentTab = 'expense', selectedCategory, onSelect, onClose }) {
  const [activeTab, setActiveTab] = useState(currentTab === 'debt' ? 'debt' : (currentTab === 'income' ? 'income' : 'expense'));
  const [search, setSearch] = useState('');

  const currentGroups = CATEGORIES_CONFIG[activeTab] || CATEGORIES_CONFIG.expense;

  const filteredGroups = currentGroups.map(group => {
    const items = group.items.filter(item => 
      item.name.toLowerCase().includes(search.toLowerCase()) || 
      group.group.toLowerCase().includes(search.toLowerCase())
    );
    return { ...group, items };
  }).filter(group => group.items.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-[#141414] text-white rounded-t-[2.5rem] sm:rounded-[2.5rem] max-h-[85vh] flex flex-col border border-white/10 shadow-2xl overflow-hidden animate-slide-up">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-300 transition-colors"
            >
              ←
            </button>
            <h3 className="text-lg font-bold text-white">Select Category</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white p-2 text-xl"
          >
            ✕
          </button>
        </div>

        {/* Tabs: Expense | Income | Debt/Loan */}
        <div className="flex border-b border-white/10 bg-black/40">
          {[
            { id: 'expense', label: 'EXPENSE', icon: '💸' },
            { id: 'income', label: 'INCOME', icon: '💰' },
            { id: 'debt', label: 'DEBT / LOAN', icon: '🤝' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSearch(''); }}
              className={`flex-1 py-3 text-xs sm:text-sm font-bold tracking-wider transition-all border-b-2 ${
                activeTab === tab.id
                  ? 'border-green-500 text-green-400 bg-white/5'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="p-3 sm:p-4 bg-black/20 border-b border-white/5">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search category name..."
              className="w-full bg-[#1e1e1e] border border-white/10 rounded-full pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-500/50"
            />
            {search && (
              <button 
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Categories List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {filteredGroups.length === 0 ? (
            <div className="text-center py-10 text-gray-500 text-sm">
              No categories found matching "{search}"
            </div>
          ) : (
            filteredGroups.map(group => (
              <div key={group.group} className="space-y-1.5">
                <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-2 flex items-center gap-1.5">
                  <span>{group.icon}</span>
                  <span>{group.group}</span>
                </div>
                <div className="bg-white/5 rounded-2xl p-1 border border-white/5 divide-y divide-white/5">
                  {group.items.map(item => {
                    const isSelected = (selectedCategory || '').toLowerCase() === item.name.toLowerCase();
                    return (
                      <button
                        key={item.name}
                        onClick={() => {
                          onSelect(item.name, activeTab === 'income' ? 'income' : 'expense', activeTab);
                          onClose();
                        }}
                        className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                          isSelected 
                            ? 'bg-green-500/20 text-green-400 font-semibold' 
                            : 'hover:bg-white/10 text-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-9 h-9 rounded-full flex items-center justify-center text-lg bg-black/40 border border-white/10"
                            style={{ borderColor: `${group.color}40` }}
                          >
                            {item.icon}
                          </div>
                          <span className="text-sm">{item.name}</span>
                        </div>
                        {isSelected && <span className="text-green-400 font-bold">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 bg-black/40 border-t border-white/5 text-center text-xs text-gray-400 flex items-center justify-center gap-1.5">
          <span>✨ Need custom categories? Add entries with custom notes.</span>
        </div>

      </div>
    </div>
  );
}
