const webpush = require('web-push');
const { getDb } = require('../db/connection');

// Matched default VAPID Key pair (can be overridden via environment variables)
const DEFAULT_VAPID_PUBLIC_KEY = 'BFMWVaZT-_NryxHQgVCXZqJzcRxmrdgdyKqP1rXZmCoa0W4zVQSCb9IJZrRIKPqqYbfjgJLOjOkBwZOe5ng4CmE';
const DEFAULT_VAPID_PRIVATE_KEY = 'V7q1iERNYgXTuhfYSTud-8gB53qmURaBEYiN7nMEVb8';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || DEFAULT_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || DEFAULT_VAPID_PRIVATE_KEY;
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:admin@ourspace.app';

try {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} catch (err) {
  console.error('Failed to configure web-push VAPID details:', err);
}

/**
 * Get active VAPID public key
 */
function getVapidPublicKey() {
  return VAPID_PUBLIC_KEY;
}

/**
 * Send push notification to a specific user
 */
async function sendPushToUser(userId, { title, body, icon = '/app-icon.jpg', url = '/', badge = '/app-icon.jpg' }) {
  if (!userId) return;

  try {
    const db = getDb();
    const { rows: subscriptions } = await db.query(
      'SELECT id, subscription FROM push_subscriptions WHERE user_id = $1',
      [userId]
    );

    if (!subscriptions || subscriptions.length === 0) {
      return;
    }

    const payload = JSON.stringify({
      title: title || 'Our Space',
      body: body || 'You have a new update',
      icon,
      badge,
      url
    });

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          const pushSubscription = typeof sub.subscription === 'string' 
            ? JSON.parse(sub.subscription) 
            : sub.subscription;
          await webpush.sendNotification(pushSubscription, payload);
        } catch (pushErr) {
          // If subscription is expired/unsubscribed (410 or 404), clean it up from DB
          if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
            await db.query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]);
          }
          throw pushErr;
        }
      })
    );

    return results;
  } catch (err) {
    console.error(`Error sending push notification to user ${userId}:`, err);
  }
}

/**
 * Send push notification to partner (the other user in the couple app)
 */
async function sendPushToPartner(senderId, notificationData) {
  try {
    const db = getDb();
    const { rows: users } = await db.query(
      'SELECT id FROM users WHERE id != $1 LIMIT 1',
      [senderId]
    );

    if (users.length > 0) {
      const partnerId = users[0].id;
      return await sendPushToUser(partnerId, notificationData);
    }
  } catch (err) {
    console.error('Error sending push to partner:', err);
  }
}

module.exports = {
  getVapidPublicKey,
  sendPushToUser,
  sendPushToPartner
};
