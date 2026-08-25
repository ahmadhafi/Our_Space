import { useEffect } from 'react';
import { Outlet, NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { usePushNotifications } from '../hooks/usePushNotifications';
import IosInstallPrompt from './IosInstallPrompt';

const getMediaUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `/uploads/${path}`;
};

export default function Layout() {
  const { user, logout } = useAuth();
  const { initTheme } = useTheme();
  const { subscribeUser } = usePushNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (user) {
      initTheme(user);

      // Auto-sync push subscription if already granted
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        subscribeUser().catch(() => {});
      }
    }
  }, [user, initTheme, subscribeUser]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/', label: 'Feed', icon: HomeIcon },
    { path: '/chat', label: 'Chat', icon: ChatIcon },
    { path: '/finance', label: 'Finance', icon: ChartIcon },
    { path: '/activity', label: 'Activity', icon: ClockIcon },
    { path: '/profile', label: 'Profile', icon: UserIcon }
  ];

  return (
    <div className="min-h-screen bg-black flex justify-center w-full">
      <div className="w-full max-w-6xl bg-black min-h-screen relative flex flex-col md:flex-row shadow-2xl">
        
        {/* Mobile Top App Bar */}
        {!location.pathname.startsWith('/chat/') && (
        <header 
          className="md:hidden fixed top-0 w-full z-50 px-4 pb-4 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent pointer-events-none"
          style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
        >
          <div className="flex items-center gap-3 pointer-events-auto">
            <Link to="/profile" className="flex items-center gap-2">
              {user?.avatar ? (
                <img src={getMediaUrl(user.avatar)} alt="" className="w-9 h-9 rounded-full object-cover border border-white/20" />
              ) : (
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-black font-bold text-sm bg-white">
                  {user?.username?.charAt(0).toUpperCase()}
                </div>
              )}
            </Link>
            <div>
              <h1 className="text-white font-bold text-base leading-tight">Our Space</h1>
              <p className="text-gray-400 text-[10px]">Private & Shared Moments</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 pointer-events-auto">
            <Link to="/chat" className="p-2.5 bg-[#1e1e1e]/80 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-colors border border-white/10 shadow-lg">
              <ChatIcon className="w-5 h-5" />
            </Link>
          </div>
        </header>
        )}

        {/* Desktop Sidebar Navigation */}
        <aside className="hidden md:flex flex-col w-64 p-6 border-r border-[#222] bg-[#0a0a0a] min-h-screen sticky top-0">
          <div className="flex items-center gap-3 mb-8">
            <img src="/app-icon.jpg" alt="Our Space" className="w-9 h-9 rounded-xl border border-white/10 shadow-md" />
            <div>
              <h1 className="text-white font-bold text-lg leading-tight">Our Space</h1>
              <p className="text-gray-500 text-xs">Private Couples App</p>
            </div>
          </div>

          <nav className="space-y-2 flex-1">
            {navItems.map(({ path, label, icon: Icon }) => (
              <NavLink
                key={path}
                to={path}
                end={path === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-4 px-4 py-3 rounded-2xl font-semibold transition-all duration-300 ${
                    isActive
                      ? 'bg-white text-black shadow-lg shadow-white/5'
                      : 'text-gray-400 hover:text-white hover:bg-[#141414]'
                  }`
                }
              >
                <Icon className="w-6 h-6" />
                <span className="text-sm">{label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto pt-6 border-t border-[#333] flex items-center justify-between">
            <Link to="/profile" className="flex items-center gap-3 group">
              {user?.avatar ? (
                <img src={getMediaUrl(user.avatar)} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-transparent group-hover:border-white transition-colors" />
              ) : (
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-black font-bold bg-white">
                  {user?.username?.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm truncate">{user?.display_name || user?.username}</p>
                <p className="text-gray-500 text-xs truncate">@{user?.username}</p>
              </div>
            </Link>
            <button onClick={handleLogout} className="p-2 text-gray-500 hover:text-white hover:bg-white/10 rounded-full transition-colors" title="Logout">
              <LogoutIcon className="w-5 h-5" />
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 w-full relative pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-8 pt-[calc(4.5rem+env(safe-area-inset-top))] md:pt-8 px-0 md:px-8">
          <div className="max-w-2xl mx-auto h-full">
            <Outlet />
          </div>
        </main>

        {/* Mobile Bottom Navigation */}
        {!location.pathname.startsWith('/chat/') && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-8 py-4 bg-black/90 backdrop-blur-xl border-t border-white/10 flex justify-between items-center" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          {navItems.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 transition-all duration-300 ${
                  isActive ? 'text-white scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]' : 'text-gray-500 hover:text-white'
                }`
              }
            >
              <Icon className="w-7 h-7" />
            </NavLink>
          ))}
        </nav>
        )}

        {/* iOS PWA Installation Guidance */}
        <IosInstallPrompt />

      </div>
    </div>
  );
}

function ChatIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a.75.75 0 01-.817-.183.75.75 0 01-.183-.817A5.972 5.972 0 014.5 17.555C2.378 15.655 1.5 13.9 1.5 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
    </svg>
  );
}

function HomeIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  );
}

function ChartIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

function UserIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  );
}

function ClockIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function LogoutIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
    </svg>
  );
}
