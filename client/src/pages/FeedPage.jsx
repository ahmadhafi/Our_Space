import { useState, useEffect, useCallback } from 'react';
import { apiGet } from '../hooks/useApi';
import CreatePost from '../components/CreatePost';
import PostCard from '../components/PostCard';

export default function FeedPage() {
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchPosts = useCallback(async (pageNum, append = false) => {
    try {
      const data = await apiGet(`/api/posts?page=${pageNum}`);
      if (append) {
        setPosts(prev => [...prev, ...data.posts]);
      } else {
        setPosts(data.posts);
      }
      setHasMore(data.pagination.hasMore);
    } catch (err) {
      console.error('Failed to fetch posts:', err);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchPosts(1).finally(() => setLoading(false));
  }, [fetchPosts]);

  const handleLoadMore = async () => {
    const nextPage = page + 1;
    setLoadingMore(true);
    await fetchPosts(nextPage, true);
    setPage(nextPage);
    setLoadingMore(false);
  };

  const handlePostCreated = (newPost) => {
    setPosts(prev => [newPost, ...prev]);
  };

  const handlePostDeleted = (postId) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
  };

  return (
    <div className="animate-fade-in px-4">
      <div className="mb-6 mt-4">
        <CreatePost onPostCreated={handlePostCreated} />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="spinner !w-8 !h-8 !border-t-[#FFFC00]" />
        </div>
      ) : posts.length === 0 ? (
        <div className="bg-[#1A1A1A] rounded-[2rem] p-12 text-center border border-white/5">
          <div className="text-4xl mb-3">👻</div>
          <h3 className="font-semibold text-lg mb-1 text-white">No posts yet</h3>
          <p className="text-gray-500 text-sm">Be the first to snap!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              onDelete={handlePostDeleted}
            />
          ))}

          {hasMore && (
            <div className="text-center py-4 mb-4">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="btn-secondary px-8 py-3 rounded-full font-bold bg-[#2A2A2A] text-white disabled:opacity-50 hover:bg-[#3A3A3A] transition-colors border-none"
              >
                {loadingMore ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="spinner !w-4 !h-4 !border-t-[#FFFC00]" />
                    Loading...
                  </span>
                ) : 'Load More'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
