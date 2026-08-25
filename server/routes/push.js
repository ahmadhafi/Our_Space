const express = require('express');
const router = express.Router();
const { getDb } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');
const { getVapidPublicKey, sendPushToUser } = require('../services/pushService');

// Public endpoint to retrieve active VAPID public key
router.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: getVapidPublicKey() });
});

router.use(authenticateToken);

// Subscribe to push notifications
router.post('/subscribe', async (req, res) => {
  const subscription = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Invalid subscription object' });
  }

  try {
    const db = getDb();
    const subString = JSON.stringify(subscription);

    // Delete existing subscription for this endpoint if any
    await db.query(
      'DELETE FROM push_subscriptions WHERE user_id = $1 AND subscription LIKE $2',
      [req.user.id, `%${subscription.endpoint}%`]
    );

    // Insert new subscription
    await db.query(
      'INSERT INTO push_subscriptions (user_id, subscription) VALUES ($1, $2)',
      [req.user.id, subString]
    );

    res.status(201).json({ message: 'Push subscription registered successfully.' });
  } catch (error) {
    console.error('Error saving push subscription:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Test push notification endpoint for the authenticated user
router.post('/test', async (req, res) => {
  try {
    await sendPushToUser(req.user.id, {
      title: 'Our Space ✨',
      body: `Push notifications are active for ${req.user.display_name || req.user.username}!`,
      url: '/'
    });
    res.json({ message: 'Test notification sent!' });
  } catch (error) {
    console.error('Test push error:', error);
    res.status(500).json({ error: 'Failed to send test push' });
  }
});

// Unsubscribe
router.post('/unsubscribe', async (req, res) => {
  const { endpoint } = req.body;
  try {
    const db = getDb();
    if (endpoint) {
      await db.query(
        'DELETE FROM push_subscriptions WHERE user_id = $1 AND subscription LIKE $2',
        [req.user.id, `%${endpoint}%`]
      );
    } else {
      await db.query(
        'DELETE FROM push_subscriptions WHERE user_id = $1',
        [req.user.id]
      );
    }
    res.json({ message: 'Unsubscribed from push notifications.' });
  } catch (error) {
    console.error('Error unsubscribing:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
