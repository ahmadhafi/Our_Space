/**
 * API fetch wrapper with auto-refresh on 401
 * All requests include credentials (httpOnly cookies)
 */

let isRefreshing = false;
let refreshPromise = null;

async function refreshToken() {
  if (isRefreshing) return refreshPromise;

  isRefreshing = true;
  refreshPromise = fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include'
  }).then(res => {
    isRefreshing = false;
    if (!res.ok) throw new Error('Refresh failed');
    return res.json();
  }).catch(err => {
    isRefreshing = false;
    throw err;
  });

  return refreshPromise;
}

export async function apiFetch(url, options = {}) {
  const config = {
    ...options,
    credentials: 'include',
    headers: {
      ...options.headers
    }
  };

  // Don't set Content-Type for FormData (browser sets boundary automatically)
  if (!(options.body instanceof FormData)) {
    config.headers['Content-Type'] = config.headers['Content-Type'] || 'application/json';
  }

  let response = await fetch(url, config);

  // Auto-refresh on 401
  if (response.status === 401 && !url.includes('/auth/refresh') && !url.includes('/auth/login')) {
    try {
      await refreshToken();
      // Retry the original request
      response = await fetch(url, config);
    } catch (err) {
      // Refresh failed — redirect to login if not already there
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      throw new Error('Session expired');
    }
  }

  return response;
}

export async function apiGet(url) {
  const res = await apiFetch(url);
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function apiPost(url, body) {
  const isFormData = body instanceof FormData;
  const res = await apiFetch(url, {
    method: 'POST',
    body: isFormData ? body : JSON.stringify(body)
  });

  const data = await res.json().catch(() => ({ error: 'Request failed' }));
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

export async function apiPut(url, body) {
  const isFormData = body instanceof FormData;
  const res = await apiFetch(url, {
    method: 'PUT',
    body: isFormData ? body : JSON.stringify(body)
  });

  const data = await res.json().catch(() => ({ error: 'Request failed' }));
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

export async function apiDelete(url) {
  const res = await apiFetch(url, { method: 'DELETE' });
  const data = await res.json().catch(() => ({ error: 'Request failed' }));
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}
