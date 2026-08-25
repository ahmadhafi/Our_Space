/**
 * Finance Routes — Shared income/expense tracking
 * MODULE 2: Financial Tracker
 */

const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const { getDb } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');
const { sendPushToPartner } = require('../services/pushService');

const VALID_CATEGORIES = [
  'Food', 'Transport', 'Bills', 'Rent', 'Loan Payment', 'Credit Card', 'Insurance', 'Healthcare',
  'Entertainment', 'Subscription', 'Education', 'Investment', 'Savings', 'Other',
  'Salary', 'Bonus', 'Gift', 'Freelance', 'Investment Return', 'Other Income'
];
const VALID_SPLIT_TYPES = ['personal', 'shared'];

router.use(authenticateToken);

// GET /api/finance?month=2026-08&view=shared
router.get('/',
  [
    query('month').optional().matches(/^\d{4}-\d{2}$/).withMessage('Month must be YYYY-MM format'),
    query('view').optional().isIn(['personal', 'shared', 'all']).withMessage('View must be personal, shared, or all')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    try {
      const db = getDb();
      const now = new Date();
      const month = req.query.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      const view = req.query.view || 'shared';

      // Parse year and month for date range
      const [year, mon] = month.split('-').map(Number);
      const startDate = `${month}-01`;
      const nextMon = mon === 12 ? 1 : mon + 1;
      const nextYear = mon === 12 ? year + 1 : year;
      const endDate = `${nextYear}-${String(nextMon).padStart(2, '0')}-01`;

      // Get all entries for the month depending on the view
      let entriesQuery = '';
      let entriesParams = [month, startDate, endDate];
      
      if (view === 'personal') {
        entriesQuery = `
          SELECT 
            f.id, f.amount, f.type, f.category, f.note, f.date, f.split_type, f.created_at,
            u.id as user_id, u.username, u.display_name, u.avatar
          FROM finance_entries f
          JOIN users u ON f.user_id = u.id
          WHERE (f.date LIKE $1 || '%' OR (f.date >= $2 AND f.date < $3)) 
            AND (f.split_type = 'personal' OR f.split_type IS NULL) 
            AND f.user_id = $4
          ORDER BY f.date DESC, f.created_at DESC
        `;
        entriesParams.push(req.user.id);
      } else if (view === 'all') {
        entriesQuery = `
          SELECT 
            f.id, f.amount, f.type, f.category, f.note, f.date, f.split_type, f.created_at,
            u.id as user_id, u.username, u.display_name, u.avatar
          FROM finance_entries f
          JOIN users u ON f.user_id = u.id
          WHERE (f.date LIKE $1 || '%' OR (f.date >= $2 AND f.date < $3))
          ORDER BY f.date DESC, f.created_at DESC
        `;
      } else {
        entriesQuery = `
          SELECT 
            f.id, f.amount, f.type, f.category, f.note, f.date, f.split_type, f.created_at,
            u.id as user_id, u.username, u.display_name, u.avatar
          FROM finance_entries f
          JOIN users u ON f.user_id = u.id
          WHERE (f.date LIKE $1 || '%' OR (f.date >= $2 AND f.date < $3)) AND f.split_type = 'shared'
          ORDER BY f.date DESC, f.created_at DESC
        `;
      }

      const { rows: entries } = await db.query(entriesQuery, entriesParams);

      // Get budget for the month (group by category)
      let budgetRows = [];
      if (view === 'personal') {
        const result = await db.query('SELECT id, category, amount, type, user_id FROM finance_budgets WHERE month = $1 AND (type = $2 AND user_id = $3)', [month, view, req.user.id]);
        budgetRows = result.rows;
      } else if (view === 'all') {
        const result = await db.query('SELECT id, category, amount, type, user_id FROM finance_budgets WHERE month = $1', [month]);
        budgetRows = result.rows;
      } else {
        const result = await db.query('SELECT id, category, amount, type, user_id FROM finance_budgets WHERE month = $1 AND type = $2', [month, view]);
        budgetRows = result.rows;
      }
      
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
        const { rows: allUsers } = await db.query('SELECT id, display_name, username, split_ratio_percent FROM users');
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
      let spentNeeds = 0;
      let spentWants = 0;
      let spentSavings = 0;
      Object.entries(categoryBreakdown).forEach(([cat, amt]) => {
        const lower = cat.toLowerCase();
        if (
          lower.includes('food') || lower.includes('transport') || lower.includes('bill') || 
          lower.includes('rent') || lower.includes('loan') || lower.includes('credit') || 
          lower.includes('insurance') || lower.includes('health') || lower.includes('electric') || 
          lower.includes('water') || lower.includes('internet') || lower.includes('phone') || 
          lower.includes('gas') || lower.includes('fuel') || lower.includes('bensin') || 
          lower.includes('grocery') || lower.includes('groceries') || lower.includes('pharmacy')
        ) {
          spentNeeds += amt;
        } else if (
          lower.includes('invest') || lower.includes('saving') || lower.includes('stock') || 
          lower.includes('crypto') || lower.includes('gold') || lower.includes('deposit')
        ) {
          spentSavings += amt;
        } else {
          spentWants += amt;
        }
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
        budgetList: budgetRows,
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
    body('category').trim().notEmpty().isLength({ max: 100 }).withMessage('Category is required'),
    body('note').optional().trim().isLength({ max: 500 }).withMessage('Note must be under 500 characters'),
    body('date').notEmpty().withMessage('Date is required'),
    body('split_type').optional().isIn(VALID_SPLIT_TYPES).withMessage('split_type must be personal or shared')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    try {
      const db = getDb();
      const { amount, type, category, note, date, split_type = 'personal' } = req.body;
      const now = new Date().toISOString();

      let normalizedDate = date;
      try {
        const d = new Date(date);
        if (!isNaN(d.getTime())) {
          normalizedDate = d.toISOString().split('T')[0];
        }
      } catch {}

      const { rows } = await db.query(
        'INSERT INTO finance_entries (user_id, amount, type, category, note, date, split_type, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
        [req.user.id, amount, type, category, note || '', normalizedDate, split_type, now]
      );
      const entryId = rows[0].id;

      const formattedAmount = `Rp ${amount.toLocaleString('id-ID')}`;
      const splitText = split_type === 'shared' ? ' [Shared]' : '';
      await db.query(
        'INSERT INTO activity_logs (user_id, action_type, description, metadata, created_at) VALUES ($1, $2, $3, $4, $5)',
        [
          req.user.id,
          'FINANCE_ENTRY_ADDED',
          `${req.user.username} added ${type}: ${formattedAmount} (${category})${splitText}`,
          JSON.stringify({ entry_id: Number(entryId), amount, type, category, split_type }),
          now
        ]
      );

      const { rows: entryRows } = await db.query(`
        SELECT 
          f.id, f.amount, f.type, f.category, f.note, f.date, f.created_at,
          u.id as user_id, u.username, u.display_name, u.avatar
        FROM finance_entries f
        JOIN users u ON f.user_id = u.id
        WHERE f.id = $1
      `, [entryId]);

      if (split_type === 'shared') {
        sendPushToPartner(req.user.id, {
          title: 'Our Space 💰',
          body: `${req.user.display_name || req.user.username} recorded ${type}: ${formattedAmount} (${category})`,
          url: '/finance'
        }).catch(err => console.error('Finance push error:', err));
      }

      res.status(201).json({ entry: entryRows[0] });
    } catch (err) {
      console.error('Create finance entry error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// DELETE /api/finance/:id
router.delete('/:id',
  [param('id').isInt().toInt()],
  async (req, res) => {
    try {
      const db = getDb();
      const entryId = req.params.id;

      const { rows } = await db.query('SELECT id, user_id, amount, type, category FROM finance_entries WHERE id = $1', [entryId]);
      const entry = rows[0];

      if (!entry) {
        return res.status(404).json({ error: 'Entry not found' });
      }
      if (entry.user_id !== req.user.id && !req.user.is_admin) {
        return res.status(403).json({ error: 'You can only delete your own entries unless you are an admin' });
      }

      await db.query('DELETE FROM finance_entries WHERE id = $1', [entryId]);

      const formattedAmount = `Rp ${entry.amount.toLocaleString('id-ID')}`;
      await db.query(
        'INSERT INTO activity_logs (user_id, action_type, description, metadata, created_at) VALUES ($1, $2, $3, $4, $5)',
        [
          req.user.id,
          'FINANCE_ENTRY_DELETED',
          `${req.user.username} deleted ${entry.type}: ${formattedAmount} (${entry.category})`,
          JSON.stringify({ entry_id: entryId, amount: entry.amount, type: entry.type, category: entry.category }),
          new Date().toISOString()
        ]
      );

      res.json({ message: 'Entry deleted' });
    } catch (err) {
      console.error('Delete finance entry error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// PUT /api/finance/:id
router.put('/:id',
  [
    param('id').isInt().toInt(),
    body('amount').isInt({ min: 1 }).withMessage('Amount must be a positive integer'),
    body('type').isIn(['income', 'expense']).withMessage('Type must be income or expense'),
    body('category').trim().notEmpty().isLength({ max: 100 }).withMessage('Category is required'),
    body('note').optional().trim().isLength({ max: 500 }).withMessage('Note must be under 500 characters'),
    body('date').isISO8601().withMessage('Date must be a valid date')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    try {
      const db = getDb();
      const entryId = req.params.id;

      const { rows } = await db.query('SELECT id, user_id, amount, type, category FROM finance_entries WHERE id = $1', [entryId]);
      const entry = rows[0];

      if (!entry) {
        return res.status(404).json({ error: 'Entry not found' });
      }
      if (entry.user_id !== req.user.id && !req.user.is_admin) {
        return res.status(403).json({ error: 'You can only edit your own entries unless you are an admin' });
      }

      const { amount, type, category, note, date } = req.body;

      await db.query(
        'UPDATE finance_entries SET amount = $1, type = $2, category = $3, note = $4, date = $5 WHERE id = $6',
        [amount, type, category, note || '', date, entryId]
      );

      const formattedAmount = `Rp ${amount.toLocaleString('id-ID')}`;
      await db.query(
        'INSERT INTO activity_logs (user_id, action_type, description, metadata, created_at) VALUES ($1, $2, $3, $4, $5)',
        [
          req.user.id,
          'FINANCE_ENTRY_EDITED',
          `${req.user.username} edited ${type}: ${formattedAmount} (${category})`,
          JSON.stringify({ entry_id: entryId, amount, type, category }),
          new Date().toISOString()
        ]
      );

      const { rows: updatedRows } = await db.query(`
        SELECT 
          f.id, f.amount, f.type, f.category, f.note, f.date, f.created_at,
          u.id as user_id, u.username, u.display_name, u.avatar
        FROM finance_entries f
        JOIN users u ON f.user_id = u.id
        WHERE f.id = $1
      `, [entryId]);

      res.json({ entry: updatedRows[0] });
    } catch (err) {
      console.error('Edit finance entry error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// POST /api/finance/budget
router.post('/budget',
  [
    body('month').matches(/^\d{4}-\d{2}$/).withMessage('Month must be YYYY-MM format'),
    body('amount').isInt({ min: 0 }).withMessage('Amount must be a positive integer'),
    body('category').optional().trim().isLength({ max: 100 }),
    body('type').optional().isIn(VALID_SPLIT_TYPES).withMessage('Type must be personal or shared')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    try {
      const db = getDb();
      const { month, amount, category = 'Overall', type = 'shared' } = req.body;
      const user_id = type === 'personal' ? req.user.id : null;

      await db.query(`
        INSERT INTO finance_budgets (month, category, amount, type, user_id) 
        VALUES ($1, $2, $3, $4, $5) 
        ON CONFLICT(month, category, type, user_id) DO UPDATE SET amount = EXCLUDED.amount
      `, [month, category, amount, type, user_id]);

      res.json({ message: 'Budget updated successfully', month, category, amount });
    } catch (err) {
      console.error('Update budget error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// DELETE /api/finance/budget/:id
router.delete('/budget/:id',
  [param('id').isInt().toInt()],
  async (req, res) => {
    try {
      const db = getDb();
      const budgetId = req.params.id;
      const { rows } = await db.query('DELETE FROM finance_budgets WHERE id = $1 RETURNING id', [budgetId]);
      if (!rows.length) return res.status(404).json({ error: 'Budget not found' });
      res.json({ message: 'Budget deleted' });
    } catch (err) {
      console.error('Delete budget error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);


// GET /api/finance/goals
router.get('/goals', 
  [query('view').optional().isIn(['personal', 'shared', 'all']).withMessage('View must be personal, shared, or all')],
  async (req, res) => {
  try {
    const db = getDb();
    const view = req.query.view || 'shared';
    
    let goals = [];
    if (view === 'personal') {
      const result = await db.query('SELECT * FROM finance_goals WHERE type = $1 AND user_id = $2 ORDER BY created_at DESC', [view, req.user.id]);
      goals = result.rows;
    } else if (view === 'all') {
      const result = await db.query('SELECT * FROM finance_goals WHERE type = $1 OR user_id = $2 ORDER BY created_at DESC', ['shared', req.user.id]);
      goals = result.rows;
    } else {
      const result = await db.query('SELECT * FROM finance_goals WHERE type = $1 ORDER BY created_at DESC', [view]);
      goals = result.rows;
    }
    
    const goalIds = goals.map(g => g.id);
    if (goalIds.length > 0) {
      const placeholders = goalIds.map((_, i) => `$${i + 1}`).join(',');
      
      // Get all raw contributions
      const { rows: allContributions } = await db.query(`
        SELECT c.id, c.goal_id, c.amount, c.instrument, c.created_at, u.display_name, u.username
        FROM finance_goal_contributions c
        JOIN users u ON c.user_id = u.id
        WHERE c.goal_id IN (${placeholders})
        ORDER BY c.created_at DESC
      `, goalIds);

      // Get summed contributions for instruments breakdown
      const { rows: summed } = await db.query(`
        SELECT goal_id, instrument, SUM(amount) as total
        FROM finance_goal_contributions
        WHERE goal_id IN (${placeholders})
        GROUP BY goal_id, instrument
      `, goalIds);

      // Map contributions back to goals
      const contribMap = {};
      const historyMap = {};
      
      allContributions.forEach(c => {
        if (!historyMap[c.goal_id]) historyMap[c.goal_id] = [];
        historyMap[c.goal_id].push(c);
      });

      summed.forEach(c => {
        if (!contribMap[c.goal_id]) contribMap[c.goal_id] = {};
        contribMap[c.goal_id][c.instrument] = parseInt(c.total);
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
    body('deadline').optional().isISO8601().withMessage('Deadline must be a valid date'),
    body('type').optional().isIn(VALID_SPLIT_TYPES).withMessage('Type must be personal or shared')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    try {
      const db = getDb();
      const { title, target_amount, deadline, type = 'shared' } = req.body;
      const user_id = type === 'personal' ? req.user.id : null;
      
      const { rows } = await db.query(
        'INSERT INTO finance_goals (title, target_amount, deadline, type, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [title, target_amount, deadline || null, type, user_id]
      );
      
      res.status(201).json({ id: rows[0].id, title, target_amount, current_amount: 0, deadline, type, user_id });
    } catch (err) {
      console.error('Create goal error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// PUT /api/finance/goals/:id
router.put('/goals/:id',
  [
    param('id').isInt().toInt(),
    body('title').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Title is required'),
    body('target_amount').optional().isInt({ min: 1 }).withMessage('Target amount must be a positive integer'),
    body('deadline').optional().isISO8601().withMessage('Deadline must be a valid date'),
    body('type').optional().isIn(['personal', 'shared']).withMessage('Type must be personal or shared')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    try {
      const db = getDb();
      const goalId = req.params.id;
      const { title, target_amount, deadline, type } = req.body;
      
      const { rows } = await db.query('SELECT * FROM finance_goals WHERE id = $1', [goalId]);
      if (!rows.length) return res.status(404).json({ error: 'Goal not found' });
      
      let query = 'UPDATE finance_goals SET updated_at = NOW()';
      const params = [];
      let paramIndex = 1;

      if (title !== undefined) {
        query += `, title = $${paramIndex}`;
        params.push(title);
        paramIndex++;
      }
      if (target_amount !== undefined) {
        query += `, target_amount = $${paramIndex}`;
        params.push(target_amount);
        paramIndex++;
      }
      if (deadline !== undefined) {
        query += `, deadline = $${paramIndex}`;
        params.push(deadline);
        paramIndex++;
      }
      if (type !== undefined) {
        query += `, type = $${paramIndex}`;
        params.push(type);
        paramIndex++;
      }
      
      query += ` WHERE id = $${paramIndex} RETURNING *`;
      params.push(goalId);

      const { rows: updated } = await db.query(query, params);
      res.json(updated[0]);
    } catch (err) {
      console.error('Edit goal error:', err);
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
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    try {
      const db = getDb();
      const goalId = req.params.id;
      const { amount, instrument = 'Cash' } = req.body;
      
      const { rows } = await db.query('SELECT current_amount FROM finance_goals WHERE id = $1', [goalId]);
      const goal = rows[0];
      
      if (!goal) {
        return res.status(404).json({ error: 'Goal not found' });
      }
      
      await db.query('UPDATE finance_goals SET current_amount = current_amount + $1 WHERE id = $2', [amount, goalId]);
      await db.query(
        'INSERT INTO finance_goal_contributions (goal_id, user_id, amount, instrument, created_at) VALUES ($1, $2, $3, $4, $5)',
        [goalId, req.user.id, amount, instrument, new Date().toISOString()]
      );
      
      res.json({ message: 'Contribution added', id: goalId, new_amount: parseInt(goal.current_amount) + amount, instrument });
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
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    try {
      const db = getDb();
      const contribId = req.params.id;
      const { amount, instrument } = req.body;
      
      const { rows } = await db.query('SELECT goal_id, amount FROM finance_goal_contributions WHERE id = $1', [contribId]);
      const contrib = rows[0];

      if (!contrib) {
        return res.status(404).json({ error: 'Contribution not found' });
      }
      
      const diff = amount - contrib.amount;
      
      await db.query('UPDATE finance_goal_contributions SET amount = $1, instrument = $2 WHERE id = $3', [amount, instrument, contribId]);
      await db.query('UPDATE finance_goals SET current_amount = current_amount + $1 WHERE id = $2', [diff, contrib.goal_id]);
      
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
  async (req, res) => {
    try {
      const db = getDb();
      const contribId = req.params.id;
      
      const { rows } = await db.query('SELECT goal_id, amount FROM finance_goal_contributions WHERE id = $1', [contribId]);
      const contrib = rows[0];
      
      if (!contrib) {
        return res.status(404).json({ error: 'Contribution not found' });
      }
      
      await db.query('DELETE FROM finance_goal_contributions WHERE id = $1', [contribId]);
      await db.query('UPDATE finance_goals SET current_amount = current_amount - $1 WHERE id = $2', [contrib.amount, contrib.goal_id]);
      
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
  async (req, res) => {
    try {
      const db = getDb();
      const goalId = req.params.id;
      
      const { rows } = await db.query('SELECT id FROM finance_goals WHERE id = $1', [goalId]);
      const goal = rows[0];
      
      if (!goal) {
        return res.status(404).json({ error: 'Goal not found' });
      }
      
      // finance_goal_contributions has ON DELETE CASCADE for goal_id
      await db.query('DELETE FROM finance_goals WHERE id = $1', [goalId]);
      
      res.json({ message: 'Goal deleted' });
    } catch (err) {
      console.error('Delete goal error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ==========================================
// TRENDS (Month-over-Month)
// ==========================================

// GET /api/finance/trends?view=shared
router.get('/trends',
  [query('view').optional().isIn(['personal', 'shared', 'all'])],
  async (req, res) => {
    try {
      const db = getDb();
      const view = req.query.view || 'shared';
      
      // Get the last 6 months
      const now = new Date();
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }

      const startDate = `${months[0]}-01`;
      
      let queryStr = 'SELECT type, date, amount FROM finance_entries WHERE date >= $1';
      let queryParams = [startDate];
      
      if (view === 'personal') {
        queryStr += ' AND (split_type = \'personal\' OR user_id = $2)';
        queryParams.push(req.user.id);
      } else if (view === 'shared') {
        queryStr += ' AND split_type = \'shared\'';
      } else if (view === 'all') {
        queryStr += ' AND (split_type = \'shared\' OR user_id = $2 OR split_type IS NULL)';
        queryParams.push(req.user.id);
      }

      const { rows } = await db.query(queryStr, queryParams);

      const trendData = months.map(m => ({ month: m, income: 0, expense: 0 }));

      rows.forEach(row => {
        const rowMonth = (row.date || '').substring(0, 7); // YYYY-MM
        const monthIndex = months.indexOf(rowMonth);
        if (monthIndex !== -1) {
          if (row.type === 'income') {
            trendData[monthIndex].income += row.amount;
          } else {
            trendData[monthIndex].expense += row.amount;
          }
        }
      });

      res.json({ trends: trendData });
    } catch (err) {
      console.error('Fetch trends error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

module.exports = router;
