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
 * Normalize image/icon URLs for push notifications
 */
function formatPushMediaUrl(url) {
  if (!url) return '/app-icon.jpg';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return url;
  return `/uploads/${url}`;
}

/**
 * Send push notification to a specific user
 */
async function sendPushToUser(userId, { title, body, icon = '/app-icon.jpg', url = '/', badge = '/app-icon.jpg', tag }) {
  if (!userId) return { sentCount: 0, failCount: 0, totalSubscriptions: 0 };

  try {
    const db = getDb();
    const { rows: subscriptions } = await db.query(
      'SELECT id, subscription FROM push_subscriptions WHERE user_id = $1',
      [userId]
    );

    if (!subscriptions || subscriptions.length === 0) {
      return {
        sentCount: 0,
        failCount: 0,
        totalSubscriptions: 0,
        message: 'No push subscriptions registered for this user'
      };
    }

    const cleanIcon = formatPushMediaUrl(icon);
    const cleanBadge = formatPushMediaUrl(badge);

    const payload = JSON.stringify({
      title: title || 'Our Space ✨',
      body: body || 'You have a new update',
      icon: cleanIcon,
      badge: cleanBadge,
      url,
      tag: tag || `ourspace-${Date.now()}`
    });

    const pushOptions = {
      TTL: 86400, // 24 hours
      urgency: 'high',
      headers: {
        'Urgency': 'high'
      }
    };

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          const pushSubscription = typeof sub.subscription === 'string' 
            ? JSON.parse(sub.subscription) 
            : sub.subscription;
          await webpush.sendNotification(pushSubscription, payload, pushOptions);
        } catch (pushErr) {
          // If subscription is expired, unregistered, or invalid (410, 404, or 400/403 with invalid registration), clean it up from DB
          const statusCode = pushErr.statusCode;
          const errMsg = pushErr.body || pushErr.message || '';
          if (
            statusCode === 410 || 
            statusCode === 404 || 
            (statusCode === 400 && (errMsg.includes('NotRegistered') || errMsg.includes('InvalidRegistration'))) ||
            (statusCode === 403 && errMsg.includes('Vapid'))
          ) {
            console.warn(`Cleaning up stale/invalid push subscription id ${sub.id}: ${statusCode} - ${errMsg}`);
            await db.query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]);
          }
          throw pushErr;
        }
      })
    );

    const sentCount = results.filter(r => r.status === 'fulfilled').length;
    const failCount = results.filter(r => r.status === 'rejected').length;

    return {
      sentCount,
      failCount,
      totalSubscriptions: subscriptions.length,
      results
    };
  } catch (err) {
    console.error(`Error sending push notification to user ${userId}:`, err);
    return {
      sentCount: 0,
      failCount: 0,
      totalSubscriptions: 0,
      error: err.message
    };
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
