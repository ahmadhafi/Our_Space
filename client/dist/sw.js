// Service Worker for Our Space PWA
const CACHE_NAME = 'ourspace-cache-v5';

// Install: activate immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate: delete ALL old caches immediately to ensure users get the latest code
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch handler
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // 1. API calls: Always bypass cache, network only
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // 2. HTML navigation: Network-first, fallback to cache only if completely offline
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request) || caches.match('/'))
    );
    return;
  }

  // 3. Static assets with hashes (.js, .css, images): Network-first with cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// Push Notifications & App Icon Badging
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (err) {
      try {
        data = { body: event.data.text() };
      } catch (textErr) {
        data = { body: 'New notification from Our Space' };
      }
    }
  } else {
    data = { body: 'New notification from Our Space' };
  }

  const title = data.title || 'Our Space ✨';
  const options = {
    body: data.body || 'You have a new update',
    icon: data.icon || '/app-icon.jpg',
    badge: data.badge || '/app-icon.jpg',
    data: {
      url: data.url || '/'
    },
    tag: data.tag || `ourspace-${Date.now()}`,
    renotify: true,
    vibrate: [200, 100, 200],
    requireInteraction: false
  };

  // Set App Icon Badge count on iPhone and Android home screen icons
  const updateBadgePromise = (async () => {
    if ('setAppBadge' in navigator) {
      try {
        if (typeof data.badgeCount === 'number' && data.badgeCount > 0) {
          await navigator.setAppBadge(data.badgeCount);
        } else {
          const notifications = await self.registration.getNotifications();
          const count = Math.max(1, notifications.length + 1);
          await navigator.setAppBadge(count);
        }
      } catch (badgeErr) {
        console.warn('Could not set app badge from sw:', badgeErr);
      }
    }
  })();

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      updateBadgePromise
    ])
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Clear or decrement badge count upon clicking notification
  if ('clearAppBadge' in navigator) {
    navigator.clearAppBadge().catch(() => {});
  }

  const targetPath = event.notification.data?.url || '/';
  const urlToOpen = new URL(targetPath, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if ('focus' in client) {
          if (client.url === urlToOpen) {
            return client.focus();
          } else if ('navigate' in client) {
            client.focus();
            return client.navigate(urlToOpen);
          }
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
