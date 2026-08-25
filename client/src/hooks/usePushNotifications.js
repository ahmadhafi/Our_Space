import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost } from './useApi';

// Helper to convert base64 VAPID key to Uint8Array
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Check support & current subscription
  const checkStatus = useCallback(async () => {
    if (typeof window === 'undefined') return;

    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setIsSupported(supported);

    if (!supported) return;

    setPermission(Notification.permission);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (err) {
      console.warn('Error checking push subscription:', err);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Subscribe user to push notifications
  const subscribeUser = async () => {
    if (!isSupported) {
      setError('Push notifications are not supported on this browser.');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Request permission
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== 'granted') {
        throw new Error('Notification permission was denied. Please enable notifications in your browser settings.');
      }

      // 2. Ensure Service Worker is active
      const registration = await navigator.serviceWorker.ready;

      // 3. Fetch active VAPID public key from backend
      const { publicKey } = await apiGet('/api/push/vapid-public-key');
      if (!publicKey) {
        throw new Error('VAPID public key not found on server.');
      }

      const convertedVapidKey = urlBase64ToUint8Array(publicKey);

      // 4. Subscribe with PushManager
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey
        });
      }

      // 5. Send subscription to server
      await apiPost('/api/push/subscribe', subscription);

      setIsSubscribed(true);
      return true;
    } catch (err) {
      console.error('Failed to subscribe to push notifications:', err);
      setError(err.message || 'Failed to enable push notifications');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Unsubscribe user
  const unsubscribeUser = async () => {
    setLoading(true);
    setError(null);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await apiPost('/api/push/unsubscribe', { endpoint });
      }

      setIsSubscribed(false);
      return true;
    } catch (err) {
      console.error('Failed to unsubscribe:', err);
      setError(err.message || 'Failed to unsubscribe');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Trigger test notification
  const sendTestNotification = async () => {
    try {
      await apiPost('/api/push/test', {});
      return true;
    } catch (err) {
      console.error('Failed to send test push:', err);
      setError(err.message || 'Failed to send test push');
      return false;
    }
  };

  return {
    isSupported,
    permission,
    isSubscribed,
    loading,
    error,
    subscribeUser,
    unsubscribeUser,
    sendTestNotification,
    checkStatus
  };
}
