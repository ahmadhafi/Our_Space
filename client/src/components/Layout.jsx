import { NavLink, Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { useEffect } from 'react';

const navItems = [
  { path: '/', label: 'Feeds', icon: HomeIcon },
  { path: '/finance', label: 'Finance', icon: ChartIcon },
  { path: '/profile', label: 'Profile', icon: UserIcon },
  { path: '/activity', label: 'Activity', icon: ClockIcon },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { initTheme } = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) initTheme(user);
  }, [user, initTheme]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="h-[100dvh] bg-black flex justify-center w-full overflow-hidden">
      <div className="w-full max-w-6xl bg-black h-full relative flex flex-col md:flex-row shadow-2xl overflow-hidden">
        
        {/* Mobile Top App Bar */}
        <header className="md:hidden absolute top-0 w-full z-50 px-4 py-3 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
          <div className="pointer-events-auto">
            <Link to="/profile">
              {user?.avatar ? (
                <img src={`/uploads/${user.avatar}`} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-transparent hover:border-[#FFFC00] transition-colors" />
              ) : (
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-black font-bold bg-[#FFFC00]">
                  {user?.username?.charAt(0).toUpperCase()}
                </div>
              )}
            </Link>
          </div>
          
          <div className="flex-1 flex justify-center pointer-events-auto">
            <Link to="/" className="flex items-center gap-2">
              <img src="/app-icon.jpg" alt="Logo" className="w-8 h-8 rounded-lg shadow-sm" />
            </Link>
          </div>

          <div className="pointer-events-auto">
            <button onClick={handleLogout} className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center text-white backdrop-blur-md hover:bg-black/60 transition-colors">
              <LogoutIcon className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Desktop Sidebar */}
        <aside className="hidden md:flex flex-col w-64 border-r border-[#333] bg-[#111] p-6 shrink-0 relative z-10">
          <Link to="/" className="flex items-center gap-3 mb-10">
            <img src="/app-icon.jpg" alt="Logo" className="w-10 h-10 rounded-xl shadow-sm" />
            <span className="text-white font-bold text-xl tracking-wide">Ours</span>
          </Link>

          <nav className="flex-1 flex flex-col gap-2">
            {navItems.map(({ path, label, icon: Icon }) => (
              <NavLink
                key={path}
                to={path}
                end={path === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-300 ${
                    isActive 
                      ? 'bg-white/10 text-[#FFFC00] font-bold' 
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
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
                <img src={`/uploads/${user.avatar}`} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-transparent group-hover:border-[#FFFC00] transition-colors" />
              ) : (
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-black font-bold bg-[#FFFC00]">
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
        <main className="flex-1 overflow-y-auto pb-[5.5rem] md:pb-8 pt-16 md:pt-8 px-0 md:px-8 w-full scroll-smooth custom-scroll relative">
          <div className="max-w-2xl mx-auto h-full">
            <Outlet />
          </div>
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-8 py-4 bg-black/90 backdrop-blur-xl border-t border-white/10 flex justify-between items-center" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          {navItems.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 transition-all duration-300 ${
                  isActive ? 'text-[#FFFC00] scale-110 drop-shadow-[0_0_8px_rgba(255,252,0,0.5)]' : 'text-gray-500 hover:text-white'
                }`
              }
            >
              <Icon className="w-7 h-7" />
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}

/* Inline SVG Icons */
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
