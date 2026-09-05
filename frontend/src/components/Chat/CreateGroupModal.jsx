import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { chatAPI, userAPI } from '../../utils/api';
import { getInitials, stringToColor } from '../../utils/helpers';
import toast from 'react-hot-toast';
import { FiX, FiSearch, FiUsers, FiCheck, FiChevronRight, FiChevronLeft } from 'react-icons/fi';

const CreateGroupModal = ({ onClose, onGroupCreated }) => {
  const { user } = useAuth();
  const [step, setStep] = useState(1); // 1: select members, 2: group details
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  // Load friends list on mount
  useEffect(() => {
    const loadFriends = async () => {
      try {
        setLoadingFriends(true);
        const { data } = await userAPI.getFriends();
        setFriends(data.friends || data || []);
      } catch {
        // Fallback — friends endpoint might return differently
        setFriends([]);
      } finally {
        setLoadingFriends(false);
      }
    };
    loadFriends();
  }, []);

  // Search users (debounced)
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (search.trim()) {
        try {
          const { data } = await userAPI.getUsers({ search });
          // Filter out self
          const filtered = (data.users || []).filter((u) => u._id !== user?._id);
          setSearchResults(filtered);
        } catch {
          setSearchResults([]);
        }
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, user?._id]);

  const toggleUser = (u) => {
    setSelectedUsers((prev) => {
      if (prev.find((p) => p._id === u._id)) {
        return prev.filter((p) => p._id !== u._id);
      }
      return [...prev, u];
    });
  };

  const handleCreate = async () => {
    if (!groupName.trim()) {
      toast.error('Group name is required');
      return;
    }
    if (selectedUsers.length < 2) {
      toast.error('Add at least 2 members');
      return;
    }

    setCreating(true);
    try {
      const { data } = await chatAPI.createGroup({
        name: groupName,
        participants: selectedUsers.map((u) => u._id),
        description,
      });
      toast.success('Group created!');
      if (onGroupCreated) onGroupCreated(data.chat);
      onClose();
    } catch (error) {
      toast.error(error.message || 'Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  // Determine which user list to display
  const displayUsers = search.trim() ? searchResults : friends;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="glass rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-dark-700">
          <div className="flex items-center gap-2">
            <FiUsers className="w-5 h-5 text-primary-500" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {step === 1 ? 'Select Members' : 'Group Details'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-teal-500/10 dark:hover:bg-white/5 rounded-lg transition-all">
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 px-4 pt-3">
          <div className={`flex-1 h-1 rounded-full transition-all ${step >= 1 ? 'bg-primary-500' : 'bg-gray-200 dark:bg-dark-600'}`} />
          <div className={`flex-1 h-1 rounded-full transition-all ${step >= 2 ? 'bg-primary-500' : 'bg-gray-200 dark:bg-dark-600'}`} />
        </div>

        {step === 1 ? (
          <>
            {/* Selected chips */}
            {selectedUsers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 p-3 border-b border-gray-100 dark:border-dark-700">
                {selectedUsers.map((u) => (
                  <span
                    key={u._id}
                    className="flex items-center gap-1 px-2.5 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-xs font-medium"
                  >
                    {u.avatar ? (
                      <img src={u.avatar} alt="" className="w-4 h-4 rounded-full object-cover" />
                    ) : (
                      <span
                        className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold"
                        style={{ backgroundColor: stringToColor(u.name) }}
                      >
                        {u.name?.charAt(0)}
                      </span>
                    )}
                    {u.name?.split(' ')[0]}
                    <button onClick={() => toggleUser(u)} className="text-primary-500 hover:text-primary-700 ml-0.5">
                      <FiX className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Search */}
            <div className="p-3">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search users or pick from friends..."
                  className="w-full pl-10 pr-4 py-2.5 bg-teal-500/10 dark:bg-white/5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white placeholder-gray-400"
                />
              </div>
            </div>

            {/* Label */}
            {!search.trim() && friends.length > 0 && (
              <div className="px-4 pb-1">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Your Friends
                </p>
              </div>
            )}

            {/* User list */}
            <div className="flex-1 overflow-y-auto px-2 pb-2">
              {loadingFriends && !search.trim() ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : displayUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <FiUsers className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-2" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {search.trim() ? 'No users found' : 'No friends yet. Search for users above.'}
                  </p>
                </div>
              ) : (
                displayUsers.map((u) => {
                  if (u._id === user?._id) return null;
                  const isSelected = selectedUsers.find((s) => s._id === u._id);
                  return (
                    <button
                      key={u._id}
                      onClick={() => toggleUser(u)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                        isSelected ? 'bg-primary-500/10 dark:bg-primary-500/10 ring-1 ring-primary-300 dark:ring-primary-700' : 'hover:bg-teal-500/10 dark:hover:bg-white/5'
                      }`}
                    >
                      {u.avatar ? (
                        <img src={u.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: stringToColor(u.name) }}>
                          {getInitials(u.name)}
                        </div>
                      )}
                      <div className="flex-1 text-left min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{u.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{u.email || u.status || ''}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                        isSelected ? 'bg-primary-500 border-primary-500' : 'border-gray-300 dark:border-dark-500'
                      }`}>
                        {isSelected && <FiCheck className="w-3 h-3 text-white" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Next button */}
            <div className="p-4 border-t border-gray-200 dark:border-dark-700">
              <button
                onClick={() => setStep(2)}
                disabled={selectedUsers.length < 2}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Next — {selectedUsers.length} selected
                <FiChevronRight className="w-4 h-4" />
              </button>
              {selectedUsers.length > 0 && selectedUsers.length < 2 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 text-center mt-2">
                  Select at least 2 members to create a group
                </p>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Group details */}
            <div className="flex-1 p-4 space-y-4 overflow-y-auto">
              {/* Group name */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                  Group Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. Project Team, Weekend Plans"
                  maxLength={100}
                  className="w-full px-4 py-2.5 bg-teal-500/10 dark:bg-white/5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white placeholder-gray-400"
                  autoFocus
                />
                <p className="text-xs text-gray-400 mt-1 text-right">{groupName.length}/100</p>
              </div>

              {/* Description */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                  Description <span className="text-gray-400">(optional)</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this group about?"
                  maxLength={500}
                  rows={3}
                  className="w-full px-4 py-2.5 bg-teal-500/10 dark:bg-white/5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white resize-none placeholder-gray-400"
                />
                <p className="text-xs text-gray-400 mt-1 text-right">{description.length}/500</p>
              </div>

              {/* Members preview */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  Members ({selectedUsers.length + 1})
                </label>
                <div className="flex flex-wrap gap-2">
                  {/* Current user (admin) */}
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    {user?.avatar ? (
                      <img src={user.avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
                    ) : (
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                        style={{ backgroundColor: stringToColor(user?.name) }}
                      >
                        {user?.name?.charAt(0)}
                      </span>
                    )}
                    <span className="text-xs font-medium text-amber-800 dark:text-amber-300">You (Admin)</span>
                  </div>

                  {selectedUsers.map((u) => (
                    <div
                      key={u._id}
                      className="flex items-center gap-2 px-3 py-1.5 bg-teal-500/10 dark:bg-white/5 rounded-lg"
                    >
                      {u.avatar ? (
                        <img src={u.avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
                      ) : (
                        <span
                          className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                          style={{ backgroundColor: stringToColor(u.name) }}
                        >
                          {u.name?.charAt(0)}
                        </span>
                      )}
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{u.name?.split(' ')[0]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Create button */}
            <div className="p-4 border-t border-gray-200 dark:border-dark-700 flex gap-2">
              <button
                onClick={() => setStep(1)}
                className="flex items-center justify-center gap-1 flex-1 py-2.5 bg-teal-500/10 dark:bg-white/5 text-gray-700 dark:text-gray-300 rounded-xl font-medium transition-all hover:bg-teal-500/20 dark:hover:bg-white/10"
              >
                <FiChevronLeft className="w-4 h-4" />
                Back
              </button>
              <button
                onClick={handleCreate}
                disabled={!groupName.trim() || creating}
                className="flex-1 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-xl font-medium disabled:opacity-50 transition-all"
              >
                {creating ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Creating...
                  </span>
                ) : (
                  'Create Group'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CreateGroupModal;
