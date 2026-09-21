/**
 * App Icon Badging Utility
 * Supports iOS 16.4+ (Safari PWA added to Home Screen) and Android (Chrome PWA)
 * Uses the standard Web Badging API: navigator.setAppBadge() and navigator.clearAppBadge()
 */

export function updateAppBadge(count) {
  if (typeof window === 'undefined') return;
  if (!('setAppBadge' in navigator)) return;

  try {
    const num = parseInt(count, 10);
    if (Number.isFinite(num) && num > 0) {
      navigator.setAppBadge(num).catch((err) => {
        // Some browsers reject if permission not granted
        console.debug('setAppBadge note:', err);
      });
    } else {
      clearAppBadge();
    }
  } catch (err) {
    console.debug('App badging error:', err);
  }
}

export function clearAppBadge() {
  if (typeof window === 'undefined') return;
  if (!('clearAppBadge' in navigator)) return;

  try {
    navigator.clearAppBadge().catch((err) => {
      console.debug('clearAppBadge note:', err);
    });
  } catch (err) {
    console.debug('Clear app badge error:', err);
  }
}
