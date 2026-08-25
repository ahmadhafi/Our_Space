// Service Worker for Our Space PWA
const CACHE_NAME = 'ourspace-cache-v3';

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

// Push Notifications
self.addEventListener('push', (event) => {
  if (event.data) {
    try {
      const data = event.data.json();
      const options = {
        body: data.body || 'New update in Our Space',
        icon: data.icon || '/app-icon.jpg',
        badge: '/app-icon.jpg',
        data: {
          url: data.url || '/'
        }
      };
      event.waitUntil(
        self.registration.showNotification(data.title || 'Our Space', options)
      );
    } catch (e) {
      console.warn('Push parse error:', e);
    }
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
