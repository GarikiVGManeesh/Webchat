import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { chatAPI, userAPI } from '../../utils/api';
import { getInitials, stringToColor } from '../../utils/helpers';
import toast from 'react-hot-toast';
import {
  FiX,
  FiEdit2,
  FiUserPlus,
  FiUserMinus,
  FiLogOut,
  FiShield,
  FiSearch,
  FiCheck,
  FiCamera,
  FiUsers,
  FiChevronLeft,
} from 'react-icons/fi';

const GroupInfoPanel = ({ chat, onClose, onChatUpdated }) => {
  const { user } = useAuth();
  const { onlineUsers, setActiveChat, loadChats } = useChat();

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(chat.groupName || '');
  const [editDescription, setEditDescription] = useState(chat.groupDescription || '');
  const [editAvatar, setEditAvatar] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [saving, setSaving] = useState(false);

  const [showAddMember, setShowAddMember] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const [addSearchResults, setAddSearchResults] = useState([]);
  const [addingMember, setAddingMember] = useState(null);

  const [removingMember, setRemovingMember] = useState(null);
  const [leavingGroup, setLeavingGroup] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const isAdmin = chat.groupAdmin?.some(
    (admin) => (typeof admin === 'string' ? admin : admin._id) === user?._id
  );

  const participants = chat.participants || [];
  const memberCount = participants.length;

  // Search for users to add
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (addSearch.trim()) {
        try {
          const { data } = await userAPI.getUsers({ search: addSearch });
          // Filter out users already in the group
          const existingIds = participants.map((p) => p._id);
          const filtered = (data.users || []).filter(
            (u) => !existingIds.includes(u._id)
          );
          setAddSearchResults(filtered);
        } catch {
          setAddSearchResults([]);
        }
      } else {
        setAddSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [addSearch, participants]);

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be less than 5MB');
        return;
      }
      setEditAvatar(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) {
      toast.error('Group name is required');
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('name', editName.trim());
      formData.append('description', editDescription.trim());
      if (editAvatar) {
        formData.append('avatar', editAvatar);
      }

      const { data } = await chatAPI.updateGroup(chat._id, formData);
      toast.success('Group updated');
      setIsEditing(false);
      setEditAvatar(null);
      setAvatarPreview(null);
      if (onChatUpdated) onChatUpdated(data.chat);
    } catch (error) {
      toast.error(error.message || 'Failed to update group');
    } finally {
      setSaving(false);
    }
  };

  const handleAddMember = async (userId) => {
    setAddingMember(userId);
    try {
      const { data } = await chatAPI.addGroupMember(chat._id, { userId });
      toast.success('Member added');
      if (onChatUpdated) onChatUpdated(data.chat);
      setAddSearch('');
      setAddSearchResults([]);
    } catch (error) {
      toast.error(error.message || 'Failed to add member');
    } finally {
      setAddingMember(null);
    }
  };

  const handleRemoveMember = async (userId) => {
    setRemovingMember(userId);
    try {
      const { data } = await chatAPI.removeGroupMember(chat._id, { userId });
      toast.success('Member removed');
      if (onChatUpdated) onChatUpdated(data.chat);
    } catch (error) {
      toast.error(error.message || 'Failed to remove member');
    } finally {
      setRemovingMember(null);
    }
  };

  const handleLeaveGroup = async () => {
    setLeavingGroup(true);
    try {
      await chatAPI.leaveGroup(chat._id);
      toast.success('You left the group');
      setActiveChat(null);
      loadChats();
      onClose();
    } catch (error) {
      toast.error(error.message || 'Failed to leave group');
    } finally {
      setLeavingGroup(false);
      setConfirmLeave(false);
    }
  };

  const isUserAdmin = (userId) => {
    return chat.groupAdmin?.some(
      (admin) => (typeof admin === 'string' ? admin : admin._id) === userId
    );
  };

  const isUserOnline = (userId) => {
    return onlineUsers.includes(userId);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-stretch justify-end" onClick={onClose}>
      <div
        className="w-full max-w-md glass shadow-2xl animate-slide-in-right flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-dark-700 flex-shrink-0">
          <button
            onClick={onClose}
            className="p-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-teal-500/10 dark:hover:bg-white/5 rounded-lg transition-all"
          >
            <FiChevronLeft className="w-5 h-5" />
          </button>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex-1">
            Group Info
          </h3>
          {isAdmin && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="p-2 text-gray-500 hover:text-primary-500 hover:bg-teal-500/10 dark:hover:bg-white/5 rounded-lg transition-all"
              title="Edit group"
            >
              <FiEdit2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Group Avatar & Name */}
          <div className="flex flex-col items-center p-6 border-b border-gray-100 dark:border-dark-700">
            {isEditing ? (
              <>
                {/* Editable avatar */}
                <div className="relative mb-4">
                  {avatarPreview || chat.groupAvatar ? (
                    <img
                      src={avatarPreview || chat.groupAvatar}
                      alt="Group"
                      className="w-24 h-24 rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-24 h-24 rounded-full flex items-center justify-center text-white text-2xl font-bold"
                      style={{ backgroundColor: stringToColor(chat.groupName) }}
                    >
                      {getInitials(chat.groupName)}
                    </div>
                  )}
                  <label className="absolute bottom-0 right-0 p-2 bg-primary-500 rounded-full text-white cursor-pointer hover:bg-primary-600 transition-colors shadow-lg">
                    <FiCamera className="w-4 h-4" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Editable name */}
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={100}
                  placeholder="Group name"
                  className="w-full text-center text-lg font-semibold bg-teal-500/10 dark:bg-white/5 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white mb-3"
                />

                {/* Editable description */}
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  maxLength={500}
                  placeholder="Group description (optional)"
                  rows={3}
                  className="w-full text-center text-sm bg-teal-500/10 dark:bg-white/5 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-600 dark:text-gray-300 resize-none"
                />

                {/* Save / Cancel */}
                <div className="flex gap-2 mt-4 w-full">
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditName(chat.groupName || '');
                      setEditDescription(chat.groupDescription || '');
                      setEditAvatar(null);
                      setAvatarPreview(null);
                    }}
                    className="flex-1 py-2 bg-teal-500/10 dark:bg-white/5 text-gray-700 dark:text-gray-300 rounded-xl font-medium transition-all hover:bg-teal-500/20 dark:hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={saving || !editName.trim()}
                    className="flex-1 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-xl font-medium transition-all disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Display avatar */}
                {chat.groupAvatar ? (
                  <img
                    src={chat.groupAvatar}
                    alt={chat.groupName}
                    className="w-24 h-24 rounded-full object-cover mb-3"
                  />
                ) : (
                  <div
                    className="w-24 h-24 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-3"
                    style={{ backgroundColor: stringToColor(chat.groupName) }}
                  >
                    {getInitials(chat.groupName)}
                  </div>
                )}

                {/* Display name */}
                <h2 className="text-xl font-bold text-gray-900 dark:text-white text-center">
                  {chat.groupName}
                </h2>

                {/* Description */}
                {chat.groupDescription && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-1 max-w-xs">
                    {chat.groupDescription}
                  </p>
                )}

                {/* Member count */}
                <div className="flex items-center gap-1.5 mt-2 text-sm text-gray-500 dark:text-gray-400">
                  <FiUsers className="w-4 h-4" />
                  <span>{memberCount} members</span>
                </div>
              </>
            )}
          </div>

          {/* Members Section */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Members ({memberCount})
              </h4>
              {isAdmin && (
                <button
                  onClick={() => setShowAddMember(!showAddMember)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-all"
                >
                  <FiUserPlus className="w-3.5 h-3.5" />
                  Add Member
                </button>
              )}
            </div>

            {/* Add Member Search */}
            {showAddMember && (
              <div className="mb-4 animate-fade-in">
                <div className="relative mb-2">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    value={addSearch}
                    onChange={(e) => setAddSearch(e.target.value)}
                    placeholder="Search users to add..."
                    className="w-full pl-10 pr-4 py-2 bg-teal-500/10 dark:bg-white/5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white"
                    autoFocus
                  />
                </div>

                {/* Search results */}
                {addSearchResults.length > 0 && (
                  <div className="max-h-48 overflow-y-auto space-y-1 bg-gray-50 dark:bg-dark-700/50 rounded-xl p-2">
                    {addSearchResults.map((u) => (
                      <div
                        key={u._id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-teal-500/10 dark:hover:bg-white/5 transition-all"
                      >
                        {u.avatar ? (
                          <img
                            src={u.avatar}
                            alt={u.name}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                            style={{ backgroundColor: stringToColor(u.name) }}
                          >
                            {getInitials(u.name)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {u.name}
                          </p>
                        </div>
                        <button
                          onClick={() => handleAddMember(u._id)}
                          disabled={addingMember === u._id}
                          className="px-3 py-1 text-xs font-medium bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-all disabled:opacity-50"
                        >
                          {addingMember === u._id ? '...' : 'Add'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {addSearch.trim() && addSearchResults.length === 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-2">
                    No users found
                  </p>
                )}
              </div>
            )}

            {/* Member list */}
            <div className="space-y-1">
              {participants.map((member) => {
                const isMemberAdmin = isUserAdmin(member._id);
                const isSelf = member._id === user?._id;
                const online = isUserOnline(member._id);

                return (
                  <div
                    key={member._id}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-teal-500/10 dark:hover:bg-white/5 transition-all group"
                  >
                    {/* Avatar with online indicator */}
                    <div className="relative flex-shrink-0">
                      {member.avatar ? (
                        <img
                          src={member.avatar}
                          alt={member.name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
                          style={{ backgroundColor: stringToColor(member.name) }}
                        >
                          {getInitials(member.name)}
                        </div>
                      )}
                      {online && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-dark-800 rounded-full" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {member.name}
                          {isSelf && (
                            <span className="text-xs text-gray-400 ml-1">(You)</span>
                          )}
                        </p>
                        {isMemberAdmin && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded text-[10px] font-semibold uppercase">
                            <FiShield className="w-2.5 h-2.5" />
                            Admin
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {online ? (
                          <span className="text-green-500 font-medium">Online</span>
                        ) : (
                          'Offline'
                        )}
                      </p>
                    </div>

                    {/* Remove button (admin only, not self) */}
                    {isAdmin && !isSelf && (
                      <button
                        onClick={() => handleRemoveMember(member._id)}
                        disabled={removingMember === member._id}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        title="Remove member"
                      >
                        {removingMember === member._id ? (
                          <span className="w-4 h-4 block border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <FiUserMinus className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer — Leave Group */}
        <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-dark-700">
          {confirmLeave ? (
            <div className="animate-fade-in">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 text-center">
                Are you sure you want to leave this group?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmLeave(false)}
                  className="flex-1 py-2.5 bg-teal-500/10 dark:bg-white/5 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-teal-500/20 dark:hover:bg-white/10 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLeaveGroup}
                  disabled={leavingGroup}
                  className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-all disabled:opacity-50"
                >
                  {leavingGroup ? 'Leaving...' : 'Leave'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmLeave(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-xl font-medium transition-all"
            >
              <FiLogOut className="w-4 h-4" />
              Leave Group
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default GroupInfoPanel;
