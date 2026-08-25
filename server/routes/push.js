const express = require('express');
const router = express.Router();
const { getDb } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');
const webpush = require('web-push');

// Configure web-push
// You should set these in your .env or replace them with actual values
const publicVapidKey = process.env.VAPID_PUBLIC_KEY;
const privateVapidKey = process.env.VAPID_PRIVATE_KEY;

if (publicVapidKey && privateVapidKey) {
  webpush.setVapidDetails('mailto:test@example.com', publicVapidKey, privateVapidKey);
}

router.use(authenticateToken);

// Subscribe to push notifications
router.post('/subscribe', async (req, res) => {
  const subscription = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Invalid subscription object' });
  }

  try {
    const db = getDb();
    // Check if subscription already exists for user
    const existing = await db.query(
      'SELECT id FROM push_subscriptions WHERE user_id = $1 AND subscription = $2',
      [req.user.id, JSON.stringify(subscription)]
    );

    if (existing.rows.length === 0) {
      await db.query(
        'INSERT INTO push_subscriptions (user_id, subscription) VALUES ($1, $2)',
        [req.user.id, JSON.stringify(subscription)]
      );
    }
    res.status(201).json({ message: 'Subscription saved.' });
  } catch (error) {
    console.error('Error saving push subscription:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
