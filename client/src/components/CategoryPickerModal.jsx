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
      icon: '🍱',
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
      group: 'Shopping & Living',
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in text-white">
      <div className="w-full max-w-md bg-[#121212] rounded-t-3xl sm:rounded-3xl max-h-[85vh] flex flex-col border border-white/10 shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="font-semibold text-base text-white">Select Category</h3>
          <button 
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white text-sm"
          >
            ✕
          </button>
        </div>

        {/* Tabs: Expense | Income | Debt/Loan */}
        <div className="flex border-b border-white/10 bg-black/40">
          {[
            { id: 'expense', label: 'EXPENSE' },
            { id: 'income', label: 'INCOME' },
            { id: 'debt', label: 'DEBT / LOAN' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSearch(''); }}
              className={`flex-1 py-2.5 text-xs font-semibold tracking-wider transition-all border-b-2 ${
                activeTab === tab.id
                  ? 'border-white text-white bg-white/5'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="p-3 border-b border-white/5 bg-black/20">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search categories..."
            className="w-full bg-[#1c1c1c] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-white/30"
          />
        </div>

        {/* Categories List */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
          {filteredGroups.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-xs">
              No categories found matching "{search}"
            </div>
          ) : (
            filteredGroups.map(group => (
              <div key={group.group} className="space-y-1">
                <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-2 flex items-center gap-1.5">
                  <span>{group.icon}</span>
                  <span>{group.group}</span>
                </div>
                <div className="bg-white/[0.02] rounded-xl border border-white/5 divide-y divide-white/5 overflow-hidden">
                  {group.items.map(item => {
                    const isSelected = (selectedCategory || '').toLowerCase() === item.name.toLowerCase();
                    return (
                      <button
                        key={item.name}
                        onClick={() => {
                          onSelect(item.name, activeTab === 'income' ? 'income' : 'expense', activeTab);
                          onClose();
                        }}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 transition-all text-xs ${
                          isSelected 
                            ? 'bg-white/10 text-white font-semibold' 
                            : 'hover:bg-white/5 text-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-base">{item.icon}</span>
                          <span>{item.name}</span>
                        </div>
                        {isSelected && <span className="text-xs text-white font-bold">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}
