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
  const [isDeviceRegisteredOnServer, setIsDeviceRegisteredOnServer] = useState(false);
  const [deviceCount, setDeviceCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Check support & current subscription on device and server
  const checkStatus = useCallback(async () => {
    if (typeof window === 'undefined') return;

    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setIsSupported(supported);

    if (!supported) return;

    const currentPerm = Notification.permission;
    setPermission(currentPerm);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);

      // Verify with backend
      if (subscription?.endpoint) {
        const status = await apiGet(`/api/push/status?endpoint=${encodeURIComponent(subscription.endpoint)}`);
        setIsDeviceRegisteredOnServer(!!status.isCurrentDeviceRegistered);
        setDeviceCount(status.totalDevices || 0);
      } else {
        const status = await apiGet('/api/push/status');
        setIsDeviceRegisteredOnServer(false);
        setDeviceCount(status.totalDevices || 0);
      }
    } catch (err) {
      console.warn('Error checking push status:', err);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Subscribe user to push notifications (with optional force refresh)
  const subscribeUser = async (forceRefresh = false) => {
    if (!isSupported) {
      setError('Push notifications are not supported on this browser.');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Request permission
      let perm = Notification.permission;
      if (perm !== 'granted') {
        perm = await Notification.requestPermission();
        setPermission(perm);
      }

      if (perm !== 'granted') {
        throw new Error('Notification permission was denied. Please allow notifications in Android settings / browser permissions.');
      }

      // 2. Ensure Service Worker is active
      const registration = await navigator.serviceWorker.ready;

      // 3. Fetch active VAPID public key from backend
      const { publicKey } = await apiGet('/api/push/vapid-public-key');
      if (!publicKey) {
        throw new Error('VAPID public key not found on server.');
      }

      const convertedVapidKey = urlBase64ToUint8Array(publicKey);

      // 4. Get existing subscription
      let subscription = await registration.pushManager.getSubscription();

      // If forceRefresh is requested or subscription exists, cleanly re-subscribe
      if (subscription && forceRefresh) {
        try {
          await subscription.unsubscribe();
        } catch (unsubErr) {
          console.warn('Error during forced unsubscribe:', unsubErr);
        }
        subscription = null;
      }

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey
        });
      }

      // 5. Send subscription to server
      await apiPost('/api/push/subscribe', subscription);

      setIsSubscribed(true);
      setIsDeviceRegisteredOnServer(true);
      await checkStatus();
      return true;
    } catch (err) {
      console.error('Failed to subscribe to push notifications:', err);
      setError(err.message || 'Failed to enable push notifications');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Re-sync this device (guarantees fresh subscription with active VAPID key)
  const resyncDevice = async () => {
    return await subscribeUser(true);
  };

  // Auto-sync subscription in background if permission is already granted
  const syncSubscription = async () => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('Notification' in window) || !('PushManager' in window)) return;
    if (Notification.permission !== 'granted') return;

    try {
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      const { publicKey } = await apiGet('/api/push/vapid-public-key');
      if (!publicKey) return;

      if (!subscription) {
        const convertedVapidKey = urlBase64ToUint8Array(publicKey);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey
        });
      }

      await apiPost('/api/push/subscribe', subscription);
      setIsSubscribed(true);
      setIsDeviceRegisteredOnServer(true);
    } catch (err) {
      console.warn('Silent background push sync error:', err);
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
      setIsDeviceRegisteredOnServer(false);
      await checkStatus();
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
      const res = await apiPost('/api/push/test', {});
      return { success: true, message: res.message || 'Test notification sent!' };
    } catch (err) {
      console.error('Failed to send test push:', err);
      const errMsg = err.message || 'Failed to send test push';
      setError(errMsg);
      return { success: false, message: errMsg };
    }
  };

  return {
    isSupported,
    permission,
    isSubscribed,
    isDeviceRegisteredOnServer,
    deviceCount,
    loading,
    error,
    subscribeUser,
    resyncDevice,
    syncSubscription,
    unsubscribeUser,
    sendTestNotification,
    checkStatus
  };
}
