import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ThemeProvider } from './hooks/useTheme';
import Layout from './components/Layout';
import './index.css';

// Lazy load pages for fast initial page load and code splitting
const LoginPage = lazy(() => import('./pages/LoginPage'));
const FeedPage = lazy(() => import('./pages/FeedPage'));
const FinancePage = lazy(() => import('./pages/FinancePage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const ActivityPage = lazy(() => import('./pages/ActivityPage'));
const ChatList = lazy(() => import('./pages/ChatList'));
const ChatRoom = lazy(() => import('./pages/ChatRoom'));

function PageLoader() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center p-8">
      <div className="text-center space-y-3">
        <div className="spinner !w-8 !h-8 mx-auto" />
        <p className="text-xs text-gray-400 font-medium">Loading...</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
        <div className="text-center">
          <div className="spinner !w-10 !h-10 mx-auto mb-4" />
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner !w-10 !h-10" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<FeedPage />} />
          <Route path="finance" element={<FinancePage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="profile/:username" element={<ProfilePage />} />
          <Route path="activity" element={<ActivityPage />} />
          <Route path="chat" element={<ChatList />} />
          <Route path="chat/:id" element={<ChatRoom />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.log('SW registration failed:', err);
    });
  });
}
