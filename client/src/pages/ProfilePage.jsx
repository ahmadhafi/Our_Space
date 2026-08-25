import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiGet, apiPut } from '../hooks/useApi';
import { useAuth } from '../hooks/useAuth';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { compressImage } from '../hooks/useImageCompress';
import { getMediaUrl } from '../utils/media';
import ThemePicker from '../components/ThemePicker';
import PostCard from '../components/PostCard';
import IosInstallPrompt from '../components/IosInstallPrompt';

export default function ProfilePage() {
  const { username: routeUsername } = useParams();
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Edit form state
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editLink, setEditLink] = useState('');
  const [editSplitRatio, setEditSplitRatio] = useState(50);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const fileInputRef = useRef(null);

  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Push Notifications & iOS Modal
  const { isSupported, isSubscribed, subscribeUser, unsubscribeUser, sendTestNotification, loading: pushLoading, error: pushError } = usePushNotifications();
  const [pushStatusMsg, setPushStatusMsg] = useState('');
  const [showIosModal, setShowIosModal] = useState(false);

  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const targetUsername = routeUsername || user?.username;

  useEffect(() => {
    if (!targetUsername) return;
    setLoading(true);
    setEditing(false);
    apiGet(`/api/profile/${targetUsername}`)
      .then(data => {
        setProfile(data.profile);
        setEditDisplayName(data.profile.display_name || '');
        setEditUsername(data.profile.username);
        setEditBio(data.profile.bio || '');
        setEditLink(data.profile.link || '');
        setEditSplitRatio(data.profile.split_ratio_percent ?? 50);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));

    // Fetch posts
    setPostsLoading(true);
    setPage(1);
    apiGet(`/api/posts?username=${targetUsername}&page=1`)
      .then(data => {
        setPosts(data.posts);
        setHasMore(data.pagination.hasMore);
      })
      .catch(err => console.error(err))
      .finally(() => setPostsLoading(false));
  }, [targetUsername]);

  const handleAvatarSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const compressed = await compressImage(file);
    
    if (editing) {
      setAvatarFile(compressed);
      setAvatarPreview(URL.createObjectURL(compressed));
    } else {
      try {
        setSaving(true);
        const formData = new FormData();
        formData.append('avatar', compressed);
        
        const data = await apiPut('/api/profile', formData);
        setProfile(data.profile);
        setSuccess('Profile picture updated!');
        updateUser({
          ...user,
          avatar: data.profile.avatar
        });
        setTimeout(() => setSuccess(''), 3000);
      } catch (err) {
        setError(err.message);
      } finally {
        setSaving(false);
      }
    }
  };

  const handleLoadMore = async () => {
    const nextPage = page + 1;
    try {
      const data = await apiGet(`/api/posts?username=${targetUsername}&page=${nextPage}`);
      setPosts(prev => [...prev, ...data.posts]);
      setHasMore(data.pagination.hasMore);
      setPage(nextPage);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      if (editDisplayName !== profile.display_name) {
        formData.append('display_name', editDisplayName);
      }
      if (editUsername !== profile.username) {
        formData.append('username', editUsername);
      }
      if (editBio !== (profile.bio || '')) {
        formData.append('bio', editBio);
      }
      if (editLink !== (profile.link || '')) {
        formData.append('link', editLink);
      }
      if (Number(editSplitRatio) !== (profile.split_ratio_percent ?? 50)) {
        formData.append('split_ratio_percent', editSplitRatio);
      }
      if (avatarFile) {
        formData.append('avatar', avatarFile);
      }

      const data = await apiPut('/api/profile', formData);
      setProfile(data.profile);
      setEditing(false);
      setSuccess('Profile updated!');
      setAvatarFile(null);
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      setAvatarPreview(null);

      // Update auth context and navigate if username changed
      updateUser({
        display_name: data.profile.display_name,
        username: data.profile.username,
        avatar: data.profile.avatar
      });

      if (data.profile.username !== targetUsername) {
        navigate(`/profile/${data.profile.username}`, { replace: true });
      }

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setEditDisplayName(profile.display_name || '');
    setEditUsername(profile.username);
    setEditBio(profile.bio || '');
    setEditLink(profile.link || '');
    setEditSplitRatio(profile.split_ratio_percent ?? 50);
    setAvatarFile(null);
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(null);
    setError('');
  };

  const handlePasswordSave = async () => {
    if (!currentPassword || !newPassword) {
      setPasswordError('Please fill in both fields');
      return;
    }
    setPasswordSaving(true);
    setPasswordError('');
    try {
      await apiPut('/api/auth/password', { currentPassword, newPassword });
      setSuccess('Password updated successfully!');
      setChangingPassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setPasswordSaving(false);
    }
  };

  const canChangeUsername = () => {
    if (!profile?.last_username_change) return true;
    const last = new Date(profile.last_username_change);
    const now = new Date();
    return (now - last) / (1000 * 60 * 60 * 24) >= 30;
  };

  const daysUntilUsernameChange = () => {
    if (!profile?.last_username_change) return 0;
    const last = new Date(profile.last_username_change);
    const now = new Date();
    const days = 30 - Math.floor((now - last) / (1000 * 60 * 60 * 24));
    return Math.max(0, days);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="spinner !w-8 !h-8" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="bg-[#1A1A1A] rounded-[2rem] p-8 text-center mt-4">
        <p className="text-gray-500">User not found</p>
      </div>
    );
  }

  const isOwner = profile.is_owner;

  return (
    <div className="animate-fade-in space-y-4 px-4 mt-4">
      <h1 className="text-2xl font-bold flex items-center gap-2 text-white px-2">
        Profile <span className="text-lg">👤</span>
      </h1>

      {/* Success message */}
      {success && (
        <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm animate-fade-in">
          ✅ {success}
        </div>
      )}

      {/* Profile card */}
      <div className="bg-[#1A1A1A] rounded-[2rem] p-6 border border-white/5">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          {/* Avatar */}
          <div className="relative group inline-block">
            {(avatarPreview || profile.avatar) ? (
              <img
                src={avatarPreview || getMediaUrl(profile.avatar)}
                alt=""
                className="w-24 h-24 rounded-full object-cover shadow-md border-4 border-[#FFFC00] cursor-pointer"
                onClick={() => window.open(avatarPreview || getMediaUrl(profile.avatar), '_blank')}
                title="View profile picture"
              />
            ) : (
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center text-black text-3xl font-bold shadow-md bg-[#FFFC00]"
              >
                {profile.username?.charAt(0).toUpperCase()}
              </div>
            )}
            {isOwner && (
              <>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarSelect} className="hidden" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[#FFFC00] border-2 border-black flex items-center justify-center text-black shadow-lg hover:scale-110 transition-transform"
                  title="Change Profile Picture"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                  </svg>
                </button>
              </>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 text-center sm:text-left">
            {editing ? (
              <div className="space-y-3 w-full">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Display Name</label>
                  <input
                    type="text"
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                    className="input-field"
                    maxLength={50}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">
                    Username
                    {!canChangeUsername() && (
                      <span className="text-red-400 ml-1">({daysUntilUsernameChange()} days until you can change)</span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    className="input-field"
                    maxLength={30}
                    disabled={!canChangeUsername()}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Bio ({editBio.length}/160)</label>
                  <textarea
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    className="input-field resize-none"
                    rows={3}
                    maxLength={160}
                    placeholder="Tell your partner something sweet..."
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Link</label>
                  <input
                    type="url"
                    value={editLink}
                    onChange={(e) => setEditLink(e.target.value)}
                    className="input-field"
                    maxLength={255}
                    placeholder="https://yourwebsite.com"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">
                    Your Expense Split Percentage ({editSplitRatio}%)
                  </label>
                  <p className="text-[10px] text-gray-500 mb-2">How much of shared expenses are you responsible for?</p>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={editSplitRatio}
                    onChange={(e) => setEditSplitRatio(e.target.value)}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#FFFC00]"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400 mt-1 font-bold">
                    <span>You pay {editSplitRatio}%</span>
                    <span>Partner pays {100 - editSplitRatio}%</span>
                  </div>
                </div>

                {error && <p className="text-sm text-red-500">{error}</p>}

                <div className="flex gap-2 justify-center sm:justify-start">
                  <button onClick={handleSave} disabled={saving} className="btn-primary text-sm disabled:opacity-50">
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button onClick={handleCancelEdit} className="btn-secondary text-sm">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-white">{profile.display_name || profile.username}</h2>
                <p className="text-sm text-[#FFFC00] font-medium mb-3">@{profile.username}</p>
                {profile.bio && <p className="text-[15px] mb-2 text-gray-200">{profile.bio}</p>}
                {profile.link && (
                  <a href={profile.link} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-400 hover:underline mb-4 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    {profile.link.replace(/^https?:\/\//, '')}
                  </a>
                )}
                <p className="text-xs text-gray-500 mt-2">
                  Joined {new Date(profile.join_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
                {isOwner && (
                  <div className="flex gap-2 mt-4 flex-col sm:flex-row">
                    <button onClick={() => setEditing(true)} className="btn-secondary text-sm w-full sm:w-auto">
                      Edit Profile
                    </button>
                    <button onClick={() => setChangingPassword(!changingPassword)} className="btn-secondary text-sm w-full sm:w-auto border-red-500/20 text-red-400 hover:bg-red-500/10">
                      {changingPassword ? 'Cancel Password Change' : 'Change Password'}
                    </button>
                  </div>
                )}
                {isOwner && changingPassword && (
                  <div className="mt-4 space-y-3 bg-[#2A2A2A] p-4 rounded-xl border border-white/5 animate-fade-in">
                    <h3 className="font-bold text-white text-sm">Change Password</h3>
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Current Password</label>
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">New Password</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="input-field"
                        placeholder="At least 6 characters"
                      />
                    </div>
                    {passwordError && <p className="text-sm text-red-500">{passwordError}</p>}
                    <button onClick={handlePasswordSave} disabled={passwordSaving} className="btn-primary text-sm w-full disabled:opacity-50">
                      {passwordSaving ? 'Saving...' : 'Update Password'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Theme picker (owner only) */}
      {isOwner && editing && (
        <div className="bg-[#1A1A1A] rounded-[2rem] p-6 border border-white/5 animate-fade-in">
          <ThemePicker />
        </div>
      )}

      {/* View partner profile link */}
      {isOwner && (
        <PartnerLink currentUsername={user?.username} />
      )}

      {/* Push Notifications & App Installation Controls */}
      {isOwner && (
        <div className="bg-[#181818] rounded-3xl p-5 border border-white/10 space-y-3.5 text-white shadow-lg">
          <div className="flex items-center justify-between pb-2 border-b border-white/5">
            <div className="flex items-center gap-2.5">
              <span className="text-lg">🔔</span>
              <div>
                <h3 className="font-semibold text-sm text-white">Push Notifications</h3>
                <p className="text-[11px] text-gray-400">Receive alerts for messages, posts, & finances</p>
              </div>
            </div>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
              isSubscribed ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-white/10 text-gray-400'
            }`}>
              {isSubscribed ? 'Active' : 'Disabled'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {!isSubscribed ? (
              <button
                type="button"
                onClick={async () => {
                  setPushStatusMsg('');
                  const ok = await subscribeUser();
                  if (ok) setPushStatusMsg('Push notifications enabled successfully!');
                }}
                disabled={pushLoading || !isSupported}
                className="px-4 py-2 rounded-xl bg-white text-black font-semibold text-xs hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                {pushLoading ? 'Enabling...' : 'Enable Push Notifications'}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={async () => {
                    setPushStatusMsg('Sending test notification...');
                    const ok = await sendTestNotification();
                    if (ok) setPushStatusMsg('Test notification sent! Check your notification bar.');
                  }}
                  className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium text-xs transition-colors"
                >
                  Send Test Push
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await unsubscribeUser();
                    setPushStatusMsg('Unsubscribed from notifications.');
                  }}
                  className="px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium transition-colors"
                >
                  Turn Off
                </button>
              </>
            )}

            {/* iOS Install Prompt Button */}
            <button
              type="button"
              onClick={() => setShowIosModal(true)}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-xs font-medium transition-colors ml-auto flex items-center gap-1.5 border border-white/5"
            >
              <span>📱 Install on iPhone / iPad</span>
            </button>
          </div>

          {pushStatusMsg && (
            <p className="text-xs text-emerald-400 bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/20">
              {pushStatusMsg}
            </p>
          )}

          {pushError && (
            <p className="text-xs text-red-400 bg-red-500/10 p-2 rounded-xl border border-red-500/20">
              {pushError}
            </p>
          )}
        </div>
      )}

      {/* Forced iOS Install Guidance Modal */}
      <IosInstallPrompt forceOpen={showIosModal} onCloseModal={() => setShowIosModal(false)} />

      {/* User's Posts */}
      <div className="mt-8 space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2 text-white px-2">
          Posts by {profile.display_name || profile.username}
        </h2>
        {postsLoading ? (
          <div className="flex justify-center py-10">
            <div className="spinner !w-6 !h-6 !border-t-[#FFFC00]" />
          </div>
        ) : posts.length === 0 ? (
          <div className="bg-[#1A1A1A] rounded-[2rem] p-8 text-center text-gray-500 border border-white/5">
            No posts yet.
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                onDelete={(id) => setPosts(posts.filter(p => p.id !== id))}
              />
            ))}
            {hasMore && (
              <button
                onClick={handleLoadMore}
                className="w-full py-4 rounded-full bg-[#2A2A2A] hover:bg-[#3A3A3A] transition-colors text-sm font-bold text-white mb-4"
              >
                Load More
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PartnerLink({ currentUsername }) {
  const [partner, setPartner] = useState(null);

  useEffect(() => {
    apiGet('/api/profile')
      .then(data => {
        const p = data.users.find(u => u.username !== currentUsername);
        if (p) setPartner(p);
      })
      .catch(() => {});
  }, [currentUsername]);

  if (!partner) return null;

  return (
    <div className="bg-[#1A1A1A] rounded-[2rem] p-4 border border-white/5">
      <a
        href={`/profile/${partner.username}`}
        className="flex items-center gap-3 hover:opacity-80 transition-opacity"
      >
        {partner.avatar ? (
          <img src={getMediaUrl(partner.avatar)} alt="" className="w-12 h-12 rounded-full object-cover border-2 border-[#FFFC00]" />
        ) : (
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-black font-bold bg-[#FFFC00]">
            {partner.username?.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <p className="font-bold text-white">{partner.display_name || partner.username}</p>
          <p className="text-xs text-[#FFFC00]">View partner's profile →</p>
        </div>
      </a>
    </div>
  );
}
