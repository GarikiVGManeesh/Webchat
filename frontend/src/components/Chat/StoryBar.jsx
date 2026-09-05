import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { storyAPI } from '../../utils/api';
import { getInitials, stringToColor } from '../../utils/helpers';
import toast from 'react-hot-toast';
import { FiPlus, FiX, FiImage, FiType } from 'react-icons/fi';

const StoryBar = () => {
  const { user } = useAuth();
  const [stories, setStories] = useState([]);
  const [myStories, setMyStories] = useState(null);
  const [viewingStory, setViewingStory] = useState(null);
  const [viewIndex, setViewIndex] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [textContent, setTextContent] = useState('');
  const [bgColor, setBgColor] = useState('#14B8A6');
  const fileInputRef = useRef(null);
  const timerRef = useRef(null);

  const COLORS = ['#14B8A6', '#10B981', '#06B6D4', '#F59E0B', '#EF4444', '#22D3EE', '#0D9488', '#000000'];

  useEffect(() => {
    loadStories();
  }, []);

  const loadStories = async () => {
    try {
      const { data } = await storyAPI.getStories();
      setMyStories(data.myStories);
      setStories(data.stories || []);
    } catch (error) {
      console.error('Failed to load stories:', error);
    }
  };

  const handleCreateTextStory = async () => {
    if (!textContent.trim()) return;
    try {
      await storyAPI.createTextStory({
        content: textContent,
        storyType: 'text',
        backgroundColor: bgColor,
      });
      toast.success('Story posted!');
      setShowCreateModal(false);
      setTextContent('');
      loadStories();
    } catch (error) {
      toast.error('Failed to post story');
    }
  };

  const handleCreateMediaStory = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('media', file);
    formData.append('storyType', file.type.startsWith('video/') ? 'video' : 'image');

    try {
      await storyAPI.createStory(formData);
      toast.success('Story posted!');
      setShowCreateModal(false);
      loadStories();
    } catch (error) {
      toast.error('Failed to post story');
    }
  };

  const viewStory = async (storyGroup) => {
    setViewingStory(storyGroup);
    setViewIndex(0);
    // Mark as viewed
    if (storyGroup.stories[0]) {
      try { await storyAPI.viewStory(storyGroup.stories[0]._id); } catch {}
    }
    startAutoAdvance(storyGroup.stories);
  };

  const startAutoAdvance = (storyList) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setViewIndex((prev) => {
        if (prev + 1 < storyList.length) {
          startAutoAdvance(storyList);
          return prev + 1;
        }
        setViewingStory(null);
        return 0;
      });
    }, 5000);
  };

  const closeViewer = () => {
    setViewingStory(null);
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  return (
    <>
      {/* Story bar */}
      <div className="flex gap-3 px-4 py-3 overflow-x-auto scrollbar-hide border-b border-gray-100 dark:border-dark-700">
        {/* My story / Add */}
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex flex-col items-center gap-1 min-w-[60px]"
        >
          <div className="relative">
            {user?.avatar ? (
              <img src={user.avatar} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-gray-200 dark:border-dark-600" />
            ) : (
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold border-2 border-gray-200 dark:border-dark-600"
                style={{ backgroundColor: stringToColor(user?.name) }}
              >
                {getInitials(user?.name)}
              </div>
            )}
            <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center border-2 border-white dark:border-dark-800">
              <FiPlus className="w-3 h-3 text-white" />
            </div>
          </div>
          <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate w-14 text-center">
            {myStories ? 'My Story' : 'Add Story'}
          </span>
        </button>

        {/* Other users' stories */}
        {stories.map((storyGroup) => (
          <button
            key={storyGroup.user._id}
            onClick={() => viewStory(storyGroup)}
            className="flex flex-col items-center gap-1 min-w-[60px]"
          >
            <div className={`p-0.5 rounded-full ${storyGroup.hasUnviewed ? 'bg-gradient-to-r from-primary-500 to-secondary-500' : 'bg-gray-300 dark:bg-dark-600'}`}>
              {storyGroup.user.avatar ? (
                <img src={storyGroup.user.avatar} alt="" className="w-13 h-13 rounded-full object-cover border-2 border-white dark:border-dark-800" style={{ width: '52px', height: '52px' }} />
              ) : (
                <div
                  className="rounded-full flex items-center justify-center text-white font-bold border-2 border-white dark:border-dark-800"
                  style={{ width: '52px', height: '52px', backgroundColor: stringToColor(storyGroup.user.name) }}
                >
                  {getInitials(storyGroup.user.name)}
                </div>
              )}
            </div>
            <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate w-14 text-center">
              {storyGroup.user.name?.split(' ')[0]}
            </span>
          </button>
        ))}
      </div>

      {/* Create Story Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowCreateModal(false)}>
          <div className="glass rounded-2xl w-full max-w-sm shadow-2xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-dark-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Create Story</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Text story */}
              <div className="rounded-xl p-4" style={{ backgroundColor: bgColor }}>
                <textarea
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="Type your status..."
                  maxLength={200}
                  className="w-full h-24 bg-transparent text-white placeholder-white/60 text-center font-medium resize-none focus:outline-none"
                />
              </div>

              {/* Color picker */}
              <div className="flex gap-2 justify-center">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setBgColor(color)}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${bgColor === color ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleCreateTextStory}
                  disabled={!textContent.trim()}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-xl font-medium disabled:opacity-50 transition-all"
                >
                  <FiType className="w-4 h-4" /> Post Text
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-teal-500/10 dark:bg-white/5 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-teal-500/20 dark:hover:bg-white/10 transition-all"
                >
                  <FiImage className="w-4 h-4" /> Photo/Video
                </button>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={handleCreateMediaStory}
            />
          </div>
        </div>
      )}

      {/* Story Viewer */}
      {viewingStory && viewingStory.stories[viewIndex] && (
        <div className="fixed inset-0 bg-black z-50 flex items-center justify-center" onClick={closeViewer}>
          <div className="relative w-full max-w-sm h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Progress bar */}
            <div className="flex gap-1 p-2">
              {viewingStory.stories.map((_, i) => (
                <div key={i} className="flex-1 h-0.5 rounded-full bg-white/30 overflow-hidden">
                  <div className={`h-full bg-white transition-all duration-[5000ms] ${i <= viewIndex ? 'w-full' : 'w-0'}`} />
                </div>
              ))}
            </div>

            {/* User info */}
            <div className="flex items-center gap-2 px-4 py-2">
              {viewingStory.user.avatar ? (
                <img src={viewingStory.user.avatar} alt="" className="w-8 h-8 rounded-full" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white text-xs font-bold">
                  {getInitials(viewingStory.user.name)}
                </div>
              )}
              <span className="text-white text-sm font-medium">{viewingStory.user.name}</span>
              <button onClick={closeViewer} className="ml-auto text-white">
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {/* Story content */}
            <div className="flex-1 flex items-center justify-center rounded-xl overflow-hidden mx-4">
              {viewingStory.stories[viewIndex].storyType === 'text' ? (
                <div
                  className="w-full h-full flex items-center justify-center p-8 rounded-xl"
                  style={{ backgroundColor: viewingStory.stories[viewIndex].backgroundColor || '#14B8A6' }}
                >
                  <p className="text-white text-xl font-medium text-center">
                    {viewingStory.stories[viewIndex].content}
                  </p>
                </div>
              ) : viewingStory.stories[viewIndex].storyType === 'video' ? (
                <video
                  src={viewingStory.stories[viewIndex].media?.url}
                  className="w-full h-full object-contain"
                  autoPlay
                  muted
                />
              ) : (
                <img
                  src={viewingStory.stories[viewIndex].media?.url}
                  className="w-full h-full object-contain"
                  alt="Story"
                />
              )}
            </div>

            {/* Navigation */}
            <div className="absolute inset-y-0 left-0 w-1/3 cursor-pointer" onClick={() => setViewIndex((prev) => Math.max(0, prev - 1))} />
            <div className="absolute inset-y-0 right-0 w-1/3 cursor-pointer" onClick={() => {
              if (viewIndex + 1 < viewingStory.stories.length) {
                setViewIndex(viewIndex + 1);
              } else {
                closeViewer();
              }
            }} />
          </div>
        </div>
      )}
    </>
  );
};

export default StoryBar;
