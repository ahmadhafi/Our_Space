import { useState, useEffect, useCallback } from 'react';
import { apiGet } from '../hooks/useApi';
import { useAuth } from '../hooks/useAuth';
import { getMediaUrl } from '../utils/media';

const ACTION_LABELS = {
  POST_CREATED: { emoji: '📝', label: 'Post Created' },
  POST_DELETED: { emoji: '🗑️', label: 'Post Deleted' },
  COMMENT_ADDED: { emoji: '💬', label: 'Comment Added' },
  FINANCE_ENTRY_ADDED: { emoji: '💰', label: 'Finance Entry Added' },
  FINANCE_ENTRY_DELETED: { emoji: '❌', label: 'Finance Entry Deleted' },
  PROFILE_UPDATED: { emoji: '👤', label: 'Profile Updated' },
  THEME_CHANGED: { emoji: '🎨', label: 'Theme Changed' },
  USER_LOGIN: { emoji: '🔓', label: 'Login' },
  USER_LOGOUT: { emoji: '🔒', label: 'Logout' }
};

export default function ActivityPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [actionTypes, setActionTypes] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, hasMore: false, total: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filters
  const [filterUser, setFilterUser] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  const buildQuery = useCallback((page) => {
    const params = new URLSearchParams();
    params.set('page', page);
    if (filterUser) params.set('user_id', filterUser);
    if (filterAction) params.set('action_type', filterAction);
    if (filterStartDate) params.set('start_date', filterStartDate);
    if (filterEndDate) params.set('end_date', filterEndDate);
    return `/api/activity?${params.toString()}`;
  }, [filterUser, filterAction, filterStartDate, filterEndDate]);

  const fetchLogs = useCallback(async (page = 1, append = false) => {
    try {
      const data = await apiGet(buildQuery(page));
      if (append) {
        setLogs(prev => [...prev, ...data.logs]);
      } else {
        setLogs(data.logs);
      }
      setUsers(data.users);
      setActionTypes(data.action_types);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Failed to fetch activity:', err);
    }
  }, [buildQuery]);

  useEffect(() => {
    setLoading(true);
    fetchLogs(1).finally(() => setLoading(false));
  }, [fetchLogs]);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    await fetchLogs(pagination.page + 1, true);
    setLoadingMore(false);
  };

  const formatRelativeTime = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = (now - date) / 1000;

    if (diff < 60) return 'now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
    return `${Math.floor(diff / 604800)}w`;
  };

  const handleDeleteLog = async (id) => {
    if (!confirm('Delete this activity log?')) return;
    try {
      const { apiDelete } = await import('../hooks/useApi');
      await apiDelete(`/api/activity/${id}`);
      setLogs(prev => prev.filter(l => l.id !== id));
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="animate-fade-in px-4">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2 text-white">
        Activity <span className="text-lg">📋</span>
      </h1>

      {/* Filters */}
      <div className="bg-[#1A1A1A] rounded-[2rem] p-5 mb-4 border border-white/5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">User</label>
            <select
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              className="input-field text-sm py-2"
            >
              <option value="">All Users</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.display_name || u.username}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Action</label>
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="input-field text-sm py-2"
            >
              <option value="">All Actions</option>
              {actionTypes.map(type => (
                <option key={type} value={type}>
                  {ACTION_LABELS[type]?.emoji} {ACTION_LABELS[type]?.label || type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">From</label>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="input-field text-sm py-2"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">To</label>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="input-field text-sm py-2"
            />
          </div>
        </div>

        {(filterUser || filterAction || filterStartDate || filterEndDate) && (
          <button
            onClick={() => {
              setFilterUser('');
              setFilterAction('');
              setFilterStartDate('');
              setFilterEndDate('');
            }}
            className="text-xs mt-2 hover:underline"
            style={{ color: 'var(--color-accent)' }}
          >
            Clear all filters
          </button>
        )}
      </div>

      {/* Results count */}
      <p className="text-xs text-gray-400 mb-3">{pagination.total} entries</p>

      {/* Timeline */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="spinner !w-8 !h-8 !border-t-[#FFFC00]" />
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-[#1A1A1A] rounded-[2rem] p-8 text-center border border-white/5">
          <div className="text-3xl mb-2">📋</div>
          <p className="text-sm text-gray-500">No activity found</p>
        </div>
      ) : (
        <div className="flex flex-col">
          {logs.map((log, index) => {
            const action = ACTION_LABELS[log.action_type] || { emoji: '📌', label: log.action_type };
            return (
              <div key={log.id} className="flex items-center gap-4 py-3 px-2 hover:bg-white/5 transition-colors animate-fade-in border-b border-white/10 last:border-0" style={{ animationDelay: `${index * 0.02}s` }}>
                
                {/* Avatar with Emoji Badge */}
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm flex-shrink-0 relative shadow-sm" style={{ background: 'var(--color-accent)', color: 'white' }}>
                  {log.avatar ? (
                    <img src={getMediaUrl(log.avatar)} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <span className="font-bold text-xs">{log.username?.charAt(0).toUpperCase()}</span>
                  )}
                  <div className="absolute -bottom-1 -right-1 bg-[#1A1A1A] rounded-full p-[2px] text-[10px] shadow-sm">
                    {action.emoji}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <p className="text-sm text-gray-300 leading-snug">
                    <span className="font-bold text-white mr-1.5">{log.display_name || log.username}</span>
                    {log.description}
                  </p>
                </div>

                {/* Time */}
                <div className="flex-shrink-0 text-xs text-gray-500 font-medium">
                  {formatRelativeTime(log.created_at)}
                </div>

                {/* Delete action for admin */}
                {user?.is_admin && (
                  <button
                    onClick={() => handleDeleteLog(log.id)}
                    className="flex-shrink-0 p-2 text-gray-500 hover:text-red-500 rounded-full hover:bg-red-500/10 transition-colors ml-2"
                    title="Delete Activity Log"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}

          {pagination.hasMore && (
            <div className="text-center py-4 mb-4">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="btn-secondary px-8 py-3 rounded-full font-bold bg-[#2A2A2A] text-white border-none disabled:opacity-50 hover:bg-[#3A3A3A]"
              >
                {loadingMore ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
