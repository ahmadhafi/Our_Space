/**
 * Activity Routes — Read-only activity log
 * MODULE 4: Activity Log
 */

const express = require('express');
const router = express.Router();
const { query, param, validationResult } = require('express-validator');
const { getDb } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');

const VALID_ACTION_TYPES = [
  'POST_CREATED', 'POST_DELETED', 'COMMENT_ADDED',
  'FINANCE_ENTRY_ADDED', 'FINANCE_ENTRY_DELETED',
  'PROFILE_UPDATED', 'THEME_CHANGED',
  'USER_LOGIN', 'USER_LOGOUT'
];

router.use(authenticateToken);

// GET /api/activity?user_id=&action_type=&start_date=&end_date=&page=
router.get('/',
  [
    query('user_id').optional().isInt().toInt(),
    query('action_type').optional().isIn(VALID_ACTION_TYPES).withMessage('Invalid action type'),
    query('start_date').optional().isISO8601().withMessage('Start date must be a valid date'),
    query('end_date').optional().isISO8601().withMessage('End date must be a valid date'),
    query('page').optional().isInt({ min: 1 }).toInt()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    try {
      const db = getDb();
      const page = req.query.page || 1;
      const limit = 30;
      const offset = (page - 1) * limit;

      let whereClauses = [];
      let params = [];
      let paramIndex = 1;

      if (req.query.user_id) {
        whereClauses.push(`a.user_id = $${paramIndex++}`);
        params.push(req.query.user_id);
      }

      if (req.query.action_type) {
        whereClauses.push(`a.action_type = $${paramIndex++}`);
        params.push(req.query.action_type);
      }

      if (req.query.start_date) {
        whereClauses.push(`a.created_at >= $${paramIndex++}`);
        params.push(req.query.start_date);
      }

      if (req.query.end_date) {
        // Add one day to include the end date fully
        const endDate = new Date(req.query.end_date);
        endDate.setDate(endDate.getDate() + 1);
        whereClauses.push(`a.created_at < $${paramIndex++}`);
        params.push(endDate.toISOString());
      }

      const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      const logsQuery = `
        SELECT 
          a.id, a.action_type, a.description, a.metadata, a.created_at,
          u.id as user_id, u.username, u.display_name, u.avatar
        FROM activity_logs a
        JOIN users u ON a.user_id = u.id
        ${whereSQL}
        ORDER BY a.created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;
      
      const { rows: logs } = await db.query(logsQuery, [...params, limit, offset]);

      const countQuery = `
        SELECT COUNT(*) as count FROM activity_logs a ${whereSQL}
      `;
      const { rows: countRows } = await db.query(countQuery, params);
      const totalCount = parseInt(countRows[0].count);

      // Get both users for the filter dropdown
      const { rows: users } = await db.query('SELECT id, username, display_name FROM users');

      res.json({
        logs: logs.map(log => ({
          ...log,
          metadata: JSON.parse(log.metadata || '{}')
        })),
        users,
        action_types: VALID_ACTION_TYPES,
        pagination: {
          page,
          limit,
          total: totalCount,
          hasMore: offset + limit < totalCount
        }
      });
    } catch (err) {
      console.error('Get activity error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// DELETE /api/activity/:id
router.delete('/:id',
  [param('id').isInt().toInt()],
  async (req, res) => {
    try {
      if (!req.user.is_admin) {
        return res.status(403).json({ error: 'Only admins can delete activity logs' });
      }
      
      const db = getDb();
      const logId = req.params.id;
      
      await db.query('DELETE FROM activity_logs WHERE id = $1', [logId]);
      
      res.json({ message: 'Activity log deleted' });
    } catch (err) {
      console.error('Delete activity error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

module.exports = router;
