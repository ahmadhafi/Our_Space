import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password || loading) return;

    setLoading(true);
    setError('');

    try {
      await login(username.trim(), password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{
      background: 'linear-gradient(135deg, #fce7f3 0%, #f5f0ff 50%, #f0fdf8 100%)'
    }}>
      {/* Decorative blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full opacity-30 animate-pulse-soft" style={{
          background: 'radial-gradient(circle, #f9a8d4 0%, transparent 70%)'
        }} />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full opacity-30 animate-pulse-soft" style={{
          background: 'radial-gradient(circle, #c084fc 0%, transparent 70%)',
          animationDelay: '1s'
        }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-10" style={{
          background: 'radial-gradient(circle, #818cf8 0%, transparent 70%)'
        }} />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8 animate-slide-up">
          <img 
            src="/app-icon.jpg" 
            alt="Ours Logo" 
            className="w-20 h-20 rounded-2xl mx-auto mb-4 object-cover shadow-lg"
          />
          <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
            Ours
          </h1>
          <p className="text-gray-500 mt-1 text-sm">A private space for two ✨</p>
        </div>

        {/* Login card */}
        <div className="glass-card p-8 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <h2 className="text-xl font-semibold text-center mb-6">Welcome Back</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-username" className="text-sm font-medium text-gray-600 mb-1.5 block">Username</label>
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="input-field"
                autoComplete="username"
                autoFocus
                required
              />
            </div>

            <div>
              <label htmlFor="login-password" className="text-sm font-medium text-gray-600 mb-1.5 block">Password</label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="input-field"
                autoComplete="current-password"
                required
              />
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm animate-fade-in">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!username.trim() || !password || loading}
              className="btn-primary w-full py-3 text-base disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #f9a8d4, #c084fc)' }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="spinner !w-5 !h-5 !border-white/30 !border-t-white" />
                  Logging in...
                </span>
              ) : 'Log In'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6 animate-fade-in" style={{ animationDelay: '0.3s' }}>
          This is a private space. Only invited accounts can log in.
        </p>
      </div>
    </div>
  );
}
