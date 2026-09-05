import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { storyAPI } from '../utils/api';
import { getInitials, stringToColor } from '../utils/helpers';
import { APP_NAME } from '../config';
import ThemeToggle from '../components/common/ThemeToggle';
import CreateStoryModal from '../components/Stories/CreateStoryModal';
import StoryViewer from '../components/Stories/StoryViewer';
import MutedStoriesModal from '../components/Stories/MutedStoriesModal';
import { FiArrowLeft, FiCamera, FiPlus, FiEye, FiTrash2, FiMessageSquare, FiBellOff } from 'react-icons/fi';

const isStoryExpired = (story) => !story?.expiresAt || new Date(story.expiresAt).getTime() <= Date.now();

const timeAgo = (date) => {
  if (!date) return '';
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
};

// ==================== FRIEND RING TILE ====================
const FriendTile = ({ group, onClick }) => {
  const user = group.user;
  const latest = group.stories[0];
  const unviewed = group.hasUnviewed;
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 w-[76px] shrink-0 group"
    >
      <div
        className={`p-[3px] rounded-full transition-all duration-300 group-hover:scale-105 ${
          unviewed
            ? 'bg-gradient-to-tr from-primary-600 via-primary-400 to-secondary-400 shadow-lg shadow-primary-500/30'
            : 'bg-gray-300 dark:bg-dark-600'
        }`}
      >
        <div className="rounded-full p-[2px] bg-white dark:bg-dark-900">
          {user.avatar ? (
            <img src={user.avatar} alt={user.name} className="w-[58px] h-[58px] rounded-full object-cover" />
          ) : (
            <div
              className="w-[58px] h-[58px] rounded-full flex items-center justify-center text-white text-lg font-bold"
              style={{ backgroundColor: stringToColor(user.name) }}
            >
              {getInitials(user.name)}
            </div>
          )}
        </div>
      </div>
      <div className="text-center min-w-0">
        <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate w-[72px]">
          {user.name?.split(' ')[0] || 'Friend'}
        </p>
        {latest && (
          <p className={`text-[10px] ${unviewed ? 'text-primary-500 dark:text-primary-300 font-medium' : 'text-gray-400 dark:text-gray-500'}`}>
            {timeAgo(latest.createdAt)}
          </p>
        )}
      </div>
    </button>
  );
};

// ==================== YOUR STORY CARD ====================
const YourStoryCard = ({ myStories, onAdd, onView, onDelete }) => {
  const { user } = useAuth();
  const hasStory = !!myStories && myStories.stories.length > 0;
  const totalViews = hasStory
    ? myStories.stories.reduce((sum, s) => sum + (s.viewers?.length || 0), 0)
    : 0;
  const storyCount = hasStory ? myStories.stories.length : 0;

  if (!hasStory) {
    return (
      <button
        onClick={onAdd}
        className="w-full glass rounded-3xl p-5 flex items-center gap-4 text-left hover:scale-[1.01] active:scale-[0.99] transition-all group"
      >
        <div className="relative shrink-0">
          <div className="w-[76px] h-[76px] rounded-full border-2 border-dashed border-primary-400/70 dark:border-primary-400/50 flex items-center justify-center bg-primary-500/5 dark:bg-primary-500/10 group-hover:bg-primary-500/10 transition-colors">
            {user?.avatar ? (
              <img src={user.avatar} alt="" className="w-[68px] h-[68px] rounded-full object-cover" />
            ) : (
              <div
                className="w-[68px] h-[68px] rounded-full flex items-center justify-center text-white text-xl font-bold"
                style={{ backgroundColor: stringToColor(user?.name) }}
              >
                {getInitials(user?.name)}
              </div>
            )}
          </div>
          <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 text-white flex items-center justify-center ring-4 ring-white dark:ring-dark-900 shadow-lg shadow-primary-500/40">
            <FiPlus className="w-4 h-4" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 dark:text-white">Add to Story</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Share a photo, video or text — it disappears after 24 hours
          </p>
        </div>
        <span className="text-sm font-semibold text-primary-500 shrink-0 hidden sm:block">
          ➕ Add to Story
        </span>
      </button>
    );
  }

  return (
    <div className="w-full glass rounded-3xl p-5 flex items-center gap-4">
      <button onClick={onView} className="relative shrink-0 group">
        <div className="p-[3px] rounded-full bg-gradient-to-tr from-secondary-500 via-primary-500 to-accent-500 shadow-lg shadow-secondary-500/20 group-hover:scale-105 transition-transform">
          <div className="rounded-full p-[2px] bg-white dark:bg-dark-900">
            {user?.avatar ? (
              <img src={user.avatar} alt="" className="w-[68px] h-[68px] rounded-full object-cover" />
            ) : (
              <div
                className="w-[68px] h-[68px] rounded-full flex items-center justify-center text-white text-xl font-bold"
                style={{ backgroundColor: stringToColor(user?.name) }}
              >
                {getInitials(user?.name)}
              </div>
            )}
          </div>
        </div>
        <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 text-white flex items-center justify-center ring-4 ring-white dark:ring-dark-900 shadow-lg shadow-primary-500/40">
          <FiPlus className="w-3.5 h-3.5" />
        </div>
      </button>

      <div className="flex-1 min-w-0">
        <p className="font-bold text-gray-900 dark:text-white">Your Story</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1">
          {storyCount} {storyCount === 1 ? 'story' : 'stories'}
          <span className="mx-1 text-gray-300 dark:text-dark-600">•</span>
          <FiEye className="w-3 h-3" /> {totalViews} {totalViews === 1 ? 'view' : 'views'}
        </p>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={onView}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-white px-3.5 py-1.5 rounded-full bg-gradient-to-br from-primary-600 to-primary-500 hover:scale-105 active:scale-95 transition-all shadow-md shadow-primary-500/25"
          >
            <FiEye className="w-3.5 h-3.5" /> View Story
          </button>
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-secondary-700 dark:text-secondary-300 px-3.5 py-1.5 rounded-full border border-secondary-400/40 hover:bg-secondary-500/10 transition-colors"
          >
            <FiPlus className="w-3.5 h-3.5" /> Add Story
          </button>
          <button
            onClick={onDelete}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-500 px-3.5 py-1.5 rounded-full border border-red-400/30 hover:bg-red-500/10 transition-colors"
          >
            <FiTrash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      </div>
    </div>
  );
};

// ==================== SKELETON ====================
const StoriesSkeleton = () => (
  <div className="space-y-6 animate-pulse">
    <div className="glass rounded-3xl p-5 flex items-center gap-4">
      <div className="w-[76px] h-[76px] rounded-full bg-gray-200 dark:bg-dark-700" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-32 rounded bg-gray-200 dark:bg-dark-700" />
        <div className="h-3 w-48 rounded bg-gray-100 dark:bg-dark-800" />
      </div>
    </div>
    <div className="flex gap-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex flex-col items-center gap-2 w-[76px]">
          <div className="w-[68px] h-[68px] rounded-full bg-gray-200 dark:bg-dark-700" />
          <div className="h-3 w-14 rounded bg-gray-200 dark:bg-dark-700" />
        </div>
      ))}
    </div>
  </div>
);

// ==================== PAGE ====================
const StoriesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useSocket();

  const [loading, setLoading] = useState(true);
  const [myStories, setMyStories] = useState(null);
  const [friendGroups, setFriendGroups] = useState([]);
  const [mutedCount, setMutedCount] = useState(0);

  const [composeOpen, setComposeOpen] = useState(false);
  const [viewerStart, setViewerStart] = useState(null); // index inside orderedGroups
  const [showMutedModal, setShowMutedModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [storiesRes, mutedRes] = await Promise.all([
        storyAPI.getStories(),
        storyAPI.getMutedStories(),
      ]);
      // Frontend safety net: never show stories that expired between fetch and render
      const prune = (group) => {
        if (!group) return null;
        const stories = (group.stories || []).filter((s) => !isStoryExpired(s));
        if (stories.length === 0) return null;
        return { ...group, stories };
      };
      setMyStories(prune(storiesRes.data.myStories));
      setFriendGroups((storiesRes.data.stories || []).map(prune).filter(Boolean));
      setMutedCount((mutedRes.data.users || []).length);
    } catch (err) {
      console.error('Failed to load stories:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Live updates from friends (story created/deleted)
  useEffect(() => {
    if (!socket) return;
    const handler = () => loadData();
    socket.on('story:updated', handler);
    return () => socket.off('story:updated', handler);
  }, [socket, loadData]);

  // Refresh when the tab regains focus (stories expire while away)
  useEffect(() => {
    const onFocus = () => loadData();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadData]);

  // Groups in tray order (own first, then friends)
  const orderedGroups = useMemo(() => {
    const all = [];
    if (myStories && myStories.stories.length) all.push(myStories);
    friendGroups.forEach((g) => all.push(g));
    return all;
  }, [myStories, friendGroups]);

  const openViewerFor = (ownerId) => {
    const idx = orderedGroups.findIndex((g) => g.user._id === ownerId);
    if (idx === -1) return;
    setViewerStart(idx);
  };

  const handlePosted = () => {
    setComposeOpen(false);
    loadData();
  };

  // Local removal (used right after deleting from the viewer/card)
  const removeStoryLocally = useCallback((storyId) => {
    setMyStories((prev) => {
      if (!prev) return prev;
      const stories = prev.stories.filter((s) => s._id !== storyId);
      return stories.length ? { ...prev, stories } : null;
    });
    setFriendGroups((prev) =>
      prev
        .map((g) => {
          const stories = g.stories.filter((s) => s._id !== storyId);
          return stories.length ? { ...g, stories } : null;
        })
        .filter(Boolean)
    );
  }, []);

  const handleViewerStoryDeleted = (storyId) => {
    removeStoryLocally(storyId);
    loadData();
  };

  // Delete (latest) story straight from the "Your Story" card
  const handleCardDelete = async () => {
    const story = myStories?.stories?.[0];
    if (!story || deleting) return;
    setDeleting(true);
    try {
      await storyAPI.deleteStory(story._id);
      toast.success('Story deleted successfully.');
      setShowDeleteModal(false);
      removeStoryLocally(story._id);
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to delete story.');
    } finally {
      setDeleting(false);
    }
  };

  const handleMutedChanged = () => {
    setShowMutedModal(false);
    loadData();
  };

  const isEmpty =
    !loading &&
    !(myStories && myStories.stories.length) &&
    friendGroups.length === 0;

  return (
    <div className="min-h-screen page-enter flex flex-col">
      {/* Header */}
      <div className="bg-white/70 dark:bg-dark-900/60 backdrop-blur-xl border-b border-primary-500/10 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/chats')}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <FiArrowLeft className="w-5 h-5" />
            <span className="font-medium">Chats</span>
          </button>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <div className="w-8 h-8 bg-gradient-to-br from-primary-600 to-primary-700 rounded-lg flex items-center justify-center shadow-md shadow-primary-500/25">
              <FiCamera className="w-4 h-4 text-white" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full max-w-2xl mx-auto p-4 md:p-6">
        {/* Page title */}
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white gradient-text">
            Stories
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Share a moment with your friends.
          </p>
        </div>

        {loading ? (
          <StoriesSkeleton />
        ) : isEmpty ? (
          /* ===== Empty state ===== */
          <div className="glass rounded-[2rem] p-10 text-center animate-fade-in-up">
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-primary-500/15 to-secondary-500/15 flex items-center justify-center mb-5">
              <span className="text-4xl">✨</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              No stories yet
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto mb-6">
              Share a moment and let your friends see what you&apos;re up to.
            </p>
            <button
              onClick={() => setComposeOpen(true)}
              className="btn-primary inline-flex items-center gap-2 text-sm"
            >
              <FiCamera className="w-4 h-4" /> Add Your Story
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Your Story */}
            <section>
              <YourStoryCard
                myStories={myStories}
                onAdd={() => setComposeOpen(true)}
                onView={() => openViewerFor(user?._id)}
                onDelete={() => setShowDeleteModal(true)}
              />
            </section>

            {/* Stories from friends */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Stories from Friends
                </h2>
              </div>
              {friendGroups.length === 0 ? (
                <div className="glass rounded-3xl px-6 py-8 text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    When your friends share a moment, it will show up here.
                  </p>
                </div>
              ) : (
                <div className="flex gap-4 overflow-x-auto scrollbar-hide py-2 -mx-1 px-1 stagger-children">
                  {friendGroups.map((group) => (
                    <FriendTile
                      key={group.user._id}
                      group={group}
                      onClick={() => openViewerFor(group.user._id)}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Muted management */}
            {mutedCount > 0 && (
              <div className="flex justify-center">
                <button
                  onClick={() => setShowMutedModal(true)}
                  className="inline-flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                >
                  <FiBellOff className="w-3.5 h-3.5" />
                  Manage muted stories ({mutedCount})
                </button>
              </div>
            )}

            <p className="text-center text-[11px] text-gray-400 dark:text-gray-600 pb-2">
              Stories disappear automatically after 24 hours · {APP_NAME}
            </p>
          </div>
        )}
      </div>

      {/* Compose (camera / gallery / text) */}
      {composeOpen && (
        <CreateStoryModal onClose={() => setComposeOpen(false)} onPosted={handlePosted} />
      )}

      {/* Story viewer */}
      {viewerStart !== null && orderedGroups.length > 0 && (
        <StoryViewer
          groups={orderedGroups}
          startIndex={viewerStart}
          currentUserId={user?._id}
          onClose={() => setViewerStart(null)}
          onStoryDeleted={handleViewerStoryDeleted}
          onNeedRefresh={loadData}
        />
      )}

      {/* Muted stories */}
      {showMutedModal && (
        <MutedStoriesModal onClose={() => setShowMutedModal(false)} onUnmuted={handleMutedChanged} />
      )}

      {/* Delete own story (from card) */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-modal-overlay" onClick={() => !deleting && setShowDeleteModal(false)} />
          <div className="relative w-full max-w-xs glass rounded-[1.75rem] p-6 text-center animate-modal-in shadow-2xl">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-red-500/15 text-red-500 flex items-center justify-center mb-4">
              <FiTrash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete Story?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Your latest story will be permanently removed.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-full text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCardDelete}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-full text-sm font-medium text-white bg-gradient-to-br from-red-500 to-rose-600 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoriesPage;
