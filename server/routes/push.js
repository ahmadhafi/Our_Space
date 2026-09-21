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

// Check push subscription status for authenticated user
router.get('/status', async (req, res) => {
  try {
    const db = getDb();
    const { rows: subscriptions } = await db.query(
      'SELECT id, subscription, created_at FROM push_subscriptions WHERE user_id = $1',
      [req.user.id]
    );

    const targetEndpoint = req.query.endpoint;
    let isCurrentDeviceRegistered = false;

    const parsedSubscriptions = subscriptions.map(row => {
      try {
        const parsed = typeof row.subscription === 'string' ? JSON.parse(row.subscription) : row.subscription;
        if (targetEndpoint && parsed.endpoint === targetEndpoint) {
          isCurrentDeviceRegistered = true;
        }
        return {
          id: row.id,
          endpoint: parsed.endpoint ? parsed.endpoint.slice(0, 45) + '...' : 'unknown',
          created_at: row.created_at
        };
      } catch (e) {
        return { id: row.id, endpoint: 'corrupted', created_at: row.created_at };
      }
    });

    res.json({
      hasSubscription: subscriptions.length > 0,
      totalDevices: subscriptions.length,
      isCurrentDeviceRegistered: targetEndpoint ? isCurrentDeviceRegistered : (subscriptions.length > 0),
      devices: parsedSubscriptions
    });
  } catch (error) {
    console.error('Error checking push status:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Subscribe to push notifications
router.post('/subscribe', async (req, res) => {
  const subscription = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Invalid subscription object' });
  }

  try {
    const db = getDb();
    const subString = JSON.stringify(subscription);

    // Cleanly delete any existing record with the exact same endpoint for this user
    const { rows: existing } = await db.query(
      'SELECT id, subscription FROM push_subscriptions WHERE user_id = $1',
      [req.user.id]
    );
    for (const row of existing) {
      try {
        const parsed = typeof row.subscription === 'string' ? JSON.parse(row.subscription) : row.subscription;
        if (parsed?.endpoint === subscription.endpoint) {
          await db.query('DELETE FROM push_subscriptions WHERE id = $1', [row.id]);
        }
      } catch (e) {
        // Corrupted entry cleanup
        await db.query('DELETE FROM push_subscriptions WHERE id = $1', [row.id]);
      }
    }

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
    const result = await sendPushToUser(req.user.id, {
      title: 'Our Space ✨',
      body: `Push notifications are active for ${req.user.display_name || req.user.username}!`,
      url: '/'
    });

    if (!result || result.totalSubscriptions === 0) {
      return res.status(400).json({
        error: 'No push subscriptions found in database for this account. Tap "Re-sync this Device" to register your phone.',
        diagnostics: result
      });
    }

    res.json({
      message: `Test notification sent to ${result.sentCount} device(s)!`,
      diagnostics: result
    });
  } catch (error) {
    console.error('Test push error:', error);
    res.status(500).json({ error: 'Failed to send test push: ' + error.message });
  }
});

// Unsubscribe
router.post('/unsubscribe', async (req, res) => {
  const { endpoint } = req.body;
  try {
    const db = getDb();
    if (endpoint) {
      const { rows: existing } = await db.query(
        'SELECT id, subscription FROM push_subscriptions WHERE user_id = $1',
        [req.user.id]
      );
      for (const row of existing) {
        try {
          const parsed = typeof row.subscription === 'string' ? JSON.parse(row.subscription) : row.subscription;
          if (parsed?.endpoint === endpoint) {
            await db.query('DELETE FROM push_subscriptions WHERE id = $1', [row.id]);
          }
        } catch (e) {}
      }
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
