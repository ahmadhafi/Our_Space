/**
 * Finance Routes — Shared income/expense tracking
 * MODULE 2: Financial Tracker
 */

const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const { getDb } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');

const VALID_CATEGORIES = [
  'Food', 'Transport', 'Bills', 'Entertainment', 'Investment', 'Savings', 'Other',
  'Salary', 'Bonus', 'Gift', 'Investment Return', 'Other Income'
];
const VALID_SPLIT_TYPES = ['personal', 'shared'];

router.use(authenticateToken);

// GET /api/finance?month=2026-08
router.get('/',
  [query('month').optional().matches(/^\d{4}-\d{2}$/).withMessage('Month must be YYYY-MM format')],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    try {
      const db = getDb();
      const now = new Date();
      const month = req.query.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      // Parse year and month for date range
      const [year, mon] = month.split('-').map(Number);
      const startDate = `${month}-01`;
      const endDate = `${year}-${String(mon + 1).padStart(2, '0')}-01`;
      // Handle December -> January
      const actualEnd = mon === 12 ? `${year + 1}-01-01` : endDate;

      // Get all entries for the month
      const entries = db.prepare(`
        SELECT 
          f.id, f.amount, f.type, f.category, f.note, f.date, f.split_type, f.created_at,
          u.id as user_id, u.username, u.display_name, u.avatar
        FROM finance_entries f
        JOIN users u ON f.user_id = u.id
        WHERE f.date >= ? AND f.date < ?
        ORDER BY f.date DESC, f.created_at DESC
      `).all(startDate, actualEnd);

      // Get budget for the month (group by category)
      const budgetRows = db.prepare('SELECT category, amount FROM finance_budgets WHERE month = ?').all(month);
      const budgets = {};
      let totalBudget = 0;
      for (const row of budgetRows) {
        budgets[row.category] = row.amount;
        if (row.category === 'Overall') {
          totalBudget = row.amount;
        }
      }

      // Calculate summary
      let totalIncome = 0;
      let totalExpense = 0;
      const categoryBreakdown = {};
      const weeklyData = {};
      
      // Settlement tracking
      const sharedPaid = {};

      for (const entry of entries) {
        if (entry.type === 'income') {
          totalIncome += entry.amount;
        } else {
          totalExpense += entry.amount;
          categoryBreakdown[entry.category] = (categoryBreakdown[entry.category] || 0) + entry.amount;
          
          if (entry.split_type === 'shared') {
            sharedPaid[entry.user_id] = (sharedPaid[entry.user_id] || 0) + entry.amount;
            // Also store username for display
            sharedPaid[`${entry.user_id}_name`] = entry.display_name || entry.username;
          }
        }

        // Weekly aggregation
        const entryDate = new Date(entry.date);
        const dayOfMonth = entryDate.getDate();
        const weekNum = Math.ceil(dayOfMonth / 7);
        const weekKey = `Week ${weekNum}`;

        if (!weeklyData[weekKey]) {
          weeklyData[weekKey] = { week: weekKey, income: 0, expense: 0 };
        }
        if (entry.type === 'income') {
          weeklyData[weekKey].income += entry.amount;
        } else {
          weeklyData[weekKey].expense += entry.amount;
        }
      }

      // Ensure all weeks exist (up to 5 weeks per month)
      const daysInMonth = new Date(year, mon, 0).getDate();
      const totalWeeks = Math.ceil(daysInMonth / 7);
      const weeklyArray = [];
      for (let i = 1; i <= totalWeeks; i++) {
        const key = `Week ${i}`;
        weeklyArray.push(weeklyData[key] || { week: key, income: 0, expense: 0 });
      }

      // Category breakdown for donut chart
      const categoryArray = Object.entries(categoryBreakdown).map(([name, value]) => ({
        name,
        value
      }));

      // Calculate Settlement (Proportional)
      let settlement = null;
      const userIds = Object.keys(sharedPaid).filter(k => !k.includes('_name'));
      if (userIds.length > 0) {
        const allUsers = db.prepare('SELECT id, display_name, username, split_ratio_percent FROM users').all();
        const userA = allUsers[0];
        const userB = allUsers[1];
        
        if (userA && userB) {
          const paidA = sharedPaid[userA.id] || 0;
          const paidB = sharedPaid[userB.id] || 0;
          const totalShared = paidA + paidB;
          
          // Target contribution based on split_ratio_percent
          const targetA = totalShared * (userA.split_ratio_percent / 100);
          const targetB = totalShared * (userB.split_ratio_percent / 100);
          
          const balA = paidA - targetA;
          const balB = paidB - targetB;
          
          if (balA > 0.01) { // use small epsilon for floating point math
            settlement = { owes: userB.display_name || userB.username, owedTo: userA.display_name || userA.username, amount: balA };
          } else if (balB > 0.01) {
            settlement = { owes: userA.display_name || userA.username, owedTo: userB.display_name || userB.username, amount: balB };
          } else {
            settlement = { settled: true, amount: 0 };
          }
        }
      }

      // Calculate 50/30/20 Breakdown
      // Needs: Food, Transport, Bills
      // Wants: Entertainment, Other
      // Savings: Investment, Savings
      let spentNeeds = 0;
      let spentWants = 0;
      let spentSavings = 0;
      Object.entries(categoryBreakdown).forEach(([cat, amt]) => {
        if (['Food', 'Transport', 'Bills'].includes(cat)) spentNeeds += amt;
        else if (['Entertainment', 'Other'].includes(cat)) spentWants += amt;
        else if (['Investment', 'Savings'].includes(cat)) spentSavings += amt;
      });

      const rule503020 = {
        needs: { spent: spentNeeds, target: totalIncome * 0.5 },
        wants: { spent: spentWants, target: totalIncome * 0.3 },
        savings: { spent: spentSavings, target: totalIncome * 0.2 }
      };

      res.json({
        month,
        budget: totalBudget, // For backwards compatibility
        budgets,
        settlement,
        entries,
        summary: {
          totalIncome,
          totalExpense,
          netBalance: totalIncome - totalExpense
        },
        rule503020,
        charts: {
          categoryBreakdown: categoryArray,
          weeklyComparison: weeklyArray
        }
      });
    } catch (err) {
      console.error('Get finance error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// POST /api/finance
router.post('/',
  [
    body('amount').isInt({ min: 1 }).withMessage('Amount must be a positive integer'),
    body('type').isIn(['income', 'expense']).withMessage('Type must be income or expense'),
    body('category').isIn(VALID_CATEGORIES).withMessage(`Category must be one of: ${VALID_CATEGORIES.join(', ')}`),
    body('note').optional().trim().isLength({ max: 500 }).withMessage('Note must be under 500 characters'),
    body('date').isISO8601().withMessage('Date must be a valid date'),
    body('split_type').optional().isIn(VALID_SPLIT_TYPES).withMessage('split_type must be personal or shared')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    try {
      const db = getDb();
      const { amount, type, category, note, date, split_type = 'personal' } = req.body;
      const now = new Date().toISOString();
      let entryId;

      const createTransaction = db.transaction(() => {
        const result = db.prepare(
          'INSERT INTO finance_entries (user_id, amount, type, category, note, date, split_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(req.user.id, amount, type, category, note || '', date, split_type, now);
        entryId = result.lastInsertRowid;

        const formattedAmount = `Rp ${amount.toLocaleString('id-ID')}`;
        const splitText = split_type === 'shared' ? ' [Shared]' : '';
        db.prepare(
          'INSERT INTO activity_logs (user_id, action_type, description, metadata, created_at) VALUES (?, ?, ?, ?, ?)'
        ).run(
          req.user.id,
          'FINANCE_ENTRY_ADDED',
          `${req.user.username} added ${type}: ${formattedAmount} (${category})${splitText}`,
          JSON.stringify({ entry_id: Number(entryId), amount, type, category, split_type }),
          now
        );
      });

      createTransaction();

      const entry = db.prepare(`
        SELECT 
          f.id, f.amount, f.type, f.category, f.note, f.date, f.created_at,
          u.id as user_id, u.username, u.display_name, u.avatar
        FROM finance_entries f
        JOIN users u ON f.user_id = u.id
        WHERE f.id = ?
      `).get(entryId);

      res.status(201).json({ entry });
    } catch (err) {
      console.error('Create finance entry error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// DELETE /api/finance/:id
router.delete('/:id',
  [param('id').isInt().toInt()],
  (req, res) => {
    try {
      const db = getDb();
      const entryId = req.params.id;

      const entry = db.prepare('SELECT id, user_id, amount, type, category FROM finance_entries WHERE id = ?').get(entryId);
      if (!entry) {
        return res.status(404).json({ error: 'Entry not found' });
      }
      if (entry.user_id !== req.user.id && !req.user.is_admin) {
        return res.status(403).json({ error: 'You can only delete your own entries unless you are an admin' });
      }

      const deleteTransaction = db.transaction(() => {
        db.prepare('DELETE FROM finance_entries WHERE id = ?').run(entryId);

        const formattedAmount = `Rp ${entry.amount.toLocaleString('id-ID')}`;
        db.prepare(
          'INSERT INTO activity_logs (user_id, action_type, description, metadata, created_at) VALUES (?, ?, ?, ?, ?)'
        ).run(
          req.user.id,
          'FINANCE_ENTRY_DELETED',
          `${req.user.username} deleted ${entry.type}: ${formattedAmount} (${entry.category})`,
          JSON.stringify({ entry_id: entryId, amount: entry.amount, type: entry.type, category: entry.category }),
          new Date().toISOString()
        );
      });

      deleteTransaction();

      res.json({ message: 'Entry deleted' });
    } catch (err) {
      console.error('Delete finance entry error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// POST /api/finance/budget
router.post('/budget',
  [
    body('month').matches(/^\d{4}-\d{2}$/).withMessage('Month must be YYYY-MM format'),
    body('amount').isInt({ min: 0 }).withMessage('Amount must be a positive integer'),
    body('category').optional().isIn([...VALID_CATEGORIES, 'Overall']).withMessage('Invalid category')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    try {
      const db = getDb();
      const { month, amount, category = 'Overall' } = req.body;

      db.prepare(`
        INSERT INTO finance_budgets (month, category, amount) 
        VALUES (?, ?, ?) 
        ON CONFLICT(month, category) DO UPDATE SET amount = excluded.amount
      `).run(month, category, amount);

      res.json({ message: 'Budget updated successfully', month, category, amount });
    } catch (err) {
      console.error('Update budget error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// GET /api/finance/goals
router.get('/goals', (req, res) => {
  try {
    const db = getDb();
    const goals = db.prepare('SELECT * FROM finance_goals ORDER BY created_at DESC').all();
    
    const goalIds = goals.map(g => g.id);
    if (goalIds.length > 0) {
      const placeholders = goalIds.map(() => '?').join(',');
      
      // Get all raw contributions
      const allContributions = db.prepare(`
        SELECT c.id, c.goal_id, c.amount, c.instrument, c.created_at, u.display_name, u.username
        FROM finance_goal_contributions c
        JOIN users u ON c.user_id = u.id
        WHERE c.goal_id IN (${placeholders})
        ORDER BY c.created_at DESC
      `).all(...goalIds);

      // Get summed contributions for instruments breakdown
      const summed = db.prepare(`
        SELECT goal_id, instrument, SUM(amount) as total
        FROM finance_goal_contributions
        WHERE goal_id IN (${placeholders})
        GROUP BY goal_id, instrument
      `).all(...goalIds);

      // Map contributions back to goals
      const contribMap = {};
      const historyMap = {};
      
      allContributions.forEach(c => {
        if (!historyMap[c.goal_id]) historyMap[c.goal_id] = [];
        historyMap[c.goal_id].push(c);
      });

      summed.forEach(c => {
        if (!contribMap[c.goal_id]) contribMap[c.goal_id] = {};
        contribMap[c.goal_id][c.instrument] = c.total;
      });

      goals.forEach(g => {
        g.instruments = contribMap[g.id] || {};
        g.history = historyMap[g.id] || [];
      });
    }

    res.json({ goals });
  } catch (err) {
    console.error('Get goals error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/finance/goals
router.post('/goals',
  [
    body('title').trim().isLength({ min: 1, max: 100 }).withMessage('Title is required'),
    body('target_amount').isInt({ min: 1 }).withMessage('Target amount must be a positive integer'),
    body('deadline').optional().isISO8601().withMessage('Deadline must be a valid date')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    try {
      const db = getDb();
      const { title, target_amount, deadline } = req.body;
      
      const result = db.prepare(
        'INSERT INTO finance_goals (title, target_amount, deadline) VALUES (?, ?, ?)'
      ).run(title, target_amount, deadline || null);
      
      res.status(201).json({ id: result.lastInsertRowid, title, target_amount, current_amount: 0, deadline });
    } catch (err) {
      console.error('Create goal error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// PUT /api/finance/goals/:id/contribute
router.put('/goals/:id/contribute',
  [
    param('id').isInt().toInt(),
    body('amount').isInt({ min: 1 }).withMessage('Amount must be positive'),
    body('instrument').optional().isString().trim()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    try {
      const db = getDb();
      const goalId = req.params.id;
      const { amount, instrument = 'Cash' } = req.body;
      
      const goal = db.prepare('SELECT current_amount FROM finance_goals WHERE id = ?').get(goalId);
      if (!goal) {
        return res.status(404).json({ error: 'Goal not found' });
      }
      
      const transaction = db.transaction(() => {
        db.prepare('UPDATE finance_goals SET current_amount = current_amount + ? WHERE id = ?').run(amount, goalId);
        db.prepare('INSERT INTO finance_goal_contributions (goal_id, user_id, amount, instrument, created_at) VALUES (?, ?, ?, ?, ?)').run(
          goalId, req.user.id, amount, instrument, new Date().toISOString()
        );
      });
      transaction();
      
      res.json({ message: 'Contribution added', id: goalId, new_amount: goal.current_amount + amount, instrument });
    } catch (err) {
      console.error('Contribute goal error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// PUT /api/finance/goals/contributions/:id
router.put('/goals/contributions/:id',
  [
    param('id').isInt().toInt(),
    body('amount').isInt({ min: 1 }).withMessage('Amount must be positive'),
    body('instrument').isString().trim()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    try {
      const db = getDb();
      const contribId = req.params.id;
      const { amount, instrument } = req.body;
      
      const contrib = db.prepare('SELECT goal_id, amount FROM finance_goal_contributions WHERE id = ?').get(contribId);
      if (!contrib) {
        return res.status(404).json({ error: 'Contribution not found' });
      }
      
      const diff = amount - contrib.amount;
      
      const transaction = db.transaction(() => {
        db.prepare('UPDATE finance_goal_contributions SET amount = ?, instrument = ? WHERE id = ?').run(amount, instrument, contribId);
        db.prepare('UPDATE finance_goals SET current_amount = current_amount + ? WHERE id = ?').run(diff, contrib.goal_id);
      });
      transaction();
      
      res.json({ message: 'Contribution updated' });
    } catch (err) {
      console.error('Edit contribution error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// DELETE /api/finance/goals/contributions/:id
router.delete('/goals/contributions/:id',
  [param('id').isInt().toInt()],
  (req, res) => {
    try {
      const db = getDb();
      const contribId = req.params.id;
      
      const contrib = db.prepare('SELECT goal_id, amount FROM finance_goal_contributions WHERE id = ?').get(contribId);
      if (!contrib) {
        return res.status(404).json({ error: 'Contribution not found' });
      }
      
      const transaction = db.transaction(() => {
        db.prepare('DELETE FROM finance_goal_contributions WHERE id = ?').run(contribId);
        db.prepare('UPDATE finance_goals SET current_amount = current_amount - ? WHERE id = ?').run(contrib.amount, contrib.goal_id);
      });
      transaction();
      
      res.json({ message: 'Contribution deleted' });
    } catch (err) {
      console.error('Delete contribution error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// DELETE /api/finance/goals/:id
router.delete('/goals/:id',
  [param('id').isInt().toInt()],
  (req, res) => {
    try {
      const db = getDb();
      const goalId = req.params.id;
      
      const goal = db.prepare('SELECT id FROM finance_goals WHERE id = ?').get(goalId);
      if (!goal) {
        return res.status(404).json({ error: 'Goal not found' });
      }
      
      // finance_goal_contributions has ON DELETE CASCADE for goal_id
      db.prepare('DELETE FROM finance_goals WHERE id = ?').run(goalId);
      
      res.json({ message: 'Goal deleted' });
    } catch (err) {
      console.error('Delete goal error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

module.exports = router;
