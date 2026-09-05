import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useSocket } from '../../context/SocketContext';
import { userAPI } from '../../utils/api';
import { getOtherParticipant, formatChatTime, getInitials, stringToColor, truncateText } from '../../utils/helpers';
import ThemeToggle from '../common/ThemeToggle';
import { ChatListSkeleton, UserSearchSkeleton } from '../common/LoadingSkeleton';
import toast from 'react-hot-toast';
import StoryBar from './StoryBar';
import CreateGroupModal from './CreateGroupModal';
import {
  FiArchive,
  FiSearch,
  FiLogOut,
  FiMessageSquare,
  FiUser,
  FiUserPlus,
  FiSettings,
  FiX,
  FiStar,
  FiCheck,
} from 'react-icons/fi';

const ChatSidebar = ({ isMobileOpen, onCloseMobile }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { chats, activeChat, selectChat, createChat, loadingChats, onlineUsers, loadChats } = useChat();
  const { sidebarOpen, setSidebarOpen } = useTheme();
  const { socket } = useSocket();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [friendRequests, setFriendRequests] = useState({ sentRequests: [], receivedRequests: [] });
  const [friends, setFriends] = useState([]);
  const [sidebarTab, setSidebarTab] = useState('chats');
  const [filter, setFilter] = useState('all'); // 'all', 'unread', 'pinned'
  const searchRef = useRef(null);
  const menuRef = useRef(null);

  // Search users
  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (searchQuery.trim()) {
        setIsSearching(true);
        try {
          const { data } = await userAPI.getUsers({ search: searchQuery });
          setSearchResults(data.users || []);
        } catch (error) {
          console.error('Search failed:', error);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  // Close menus on click outside
  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const refreshFriendRequests = async () => {
    try {
      const { data } = await userAPI.getFriendRequests();
      setFriendRequests(data);
    } catch (error) {
      console.error('Failed to load friend requests:', error);
    }
  };

  const refreshFriends = async () => {
    try {
      const { data } = await userAPI.getFriends();
      setFriends(data.friends || []);
    } catch (error) {
      console.error('Failed to load friends:', error);
    }
  };

  // Load chats on mount
  useEffect(() => {
    loadChats();
    refreshFriendRequests();
    refreshFriends();
  }, [loadChats]);

  useEffect(() => {
    if (!socket) return;
    const refresh = () => { refreshFriendRequests(); refreshFriends(); };
    socket.on('friend:updated', refresh);
    return () => socket.off('friend:updated', refresh);
  }, [socket]);

  const handleSelectUser = async (userId) => {
    try {
      const chat = await createChat(userId);
      selectChat(chat);
      setSearchQuery('');
      setSearchResults([]);
      setShowNewChat(false);
      if (onCloseMobile) onCloseMobile();
    } catch (error) {
      toast.error(error.message || 'Failed to start chat');
    }
  };

  const handleFriendRequest = async (userId) => {
    try {
      await userAPI.sendFriendRequest(userId);
      toast.success('Friend request sent');
      await refreshFriendRequests();
      await refreshFriends();
      setSearchQuery('');
      setSearchResults([]);
    } catch (error) {
      toast.error(error.message || 'Failed to send request');
    }
  };

  const handleRequestAction = async (requesterId, action) => {
    try {
      if (action === 'accept') {
        await userAPI.acceptFriendRequest(requesterId);
        toast.success('Friend request accepted');
      } else {
        await userAPI.rejectFriendRequest(requesterId);
        toast.success('Friend request rejected');
      }
      await refreshFriendRequests();
      await refreshFriends();
    } catch (error) {
      toast.error(error.message || 'Failed to update request');
    }
  };

  const handleSelectChat = (chat) => {
    selectChat(chat);
    if (onCloseMobile) onCloseMobile();
  };

  // A group was just created — jump straight into it (the backend also emits
  // chatUpdated, so loadChats here just guarantees the list is fresh).
  const handleGroupCreated = (chat) => {
    setShowCreateGroup(false);
    setSidebarTab('chats');
    loadChats();
    selectChat(chat);
    if (onCloseMobile) onCloseMobile();
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  // Chats archived by the CURRENT user live in their own section; everyone
  // keeps their own archived state (chat.archivedBy is per-user).
  const isArchivedForMe = (chat) => (chat.archivedBy || []).includes(user?._id);

  const sortChats = (a, b) => {
    // Pinned first, then by most recent activity
    const aPinned = a.pinnedBy?.includes(user?._id) ? -1 : 0;
    const bPinned = b.pinnedBy?.includes(user?._id) ? -1 : 0;
    if (aPinned !== bPinned) return aPinned - bPinned;
    return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
  };

  const activeChats = chats.filter((chat) => !isArchivedForMe(chat));
  const archivedChats = chats.filter(isArchivedForMe);

  // The All/Unread/Pinned filters apply to the non-archived chats only.
  const filteredChats = activeChats
    .filter((chat) => {
      if (filter === 'unread') return chat.unreadCount > 0;
      if (filter === 'pinned') return chat.pinnedBy?.includes(user?._id);
      return true;
    })
    .sort(sortChats);

  const sortedArchivedChats = [...archivedChats].sort(sortChats);

  // Shared row renderer for active and archived chats.
  const renderChatRow = (chat) => {
    const otherUser = getOtherParticipant(chat, user?._id);
    const isOnline = onlineUsers.includes(otherUser?._id);
    const isPinned = chat.pinnedBy?.includes(user?._id);
    const isActive = activeChat?._id === chat._id;
    const lastMsg = chat.lastMessage;
    // lastMessage.sender arrives as a plain id string from the REST
    // API but as a populated user object from socket events.
    const isMyLastMessage = !!lastMsg && (lastMsg.sender === user?._id || lastMsg.sender?._id === user?._id);
    // Don't leak content the current user deleted for themselves.
    const lastMsgHidden = !!lastMsg && (lastMsg.isDeleted || (lastMsg.deletedFor || []).includes(user?._id));

    return (
      <button
        key={chat._id}
        onClick={() => handleSelectChat(chat)}
        className={`chat-item w-full px-4 py-3 flex items-center gap-3 hover:bg-teal-500/10 dark:hover:bg-white/5 ${
          isActive
            ? 'bg-primary-500/10 dark:bg-primary-500/10 border-l-2 border-primary-400'
            : ''
        }`}
      >
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          {otherUser?.avatar ? (
            <img
              src={otherUser.avatar}
              alt={otherUser.name}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-bold"
              style={{ backgroundColor: stringToColor(otherUser?.name) }}
            >
              {getInitials(otherUser?.name)}
            </div>
          )}
          {isOnline && <span className="online-dot online-pulse absolute bottom-0 right-0" />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate flex items-center gap-1">
              {isPinned && <FiStar className="w-3 h-3 text-gray-400" />}
              {otherUser?.name || 'Unknown'}
            </h3>
            <div className="flex items-center gap-1 flex-shrink-0">
              {chat.unreadCount > 0 && (
                <span className="bg-primary-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center badge-pop">
                  {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                </span>
              )}
              <span className="text-xs text-gray-400">
                {formatChatTime(lastMsg?.createdAt || chat.updatedAt)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            {lastMsgHidden ? (
              <p className="text-xs text-gray-400 dark:text-gray-500 italic truncate">
                You deleted this message
              </p>
            ) : lastMsg ? (
              <>
                {isMyLastMessage && (() => {
                  if (lastMsg.read) {
                    return (
                      <span className="flex -space-x-1 flex-shrink-0">
                        <FiCheck className="w-3.5 h-3.5 text-blue-500" />
                        <FiCheck className="w-3.5 h-3.5 text-blue-500 -ml-1.5" />
                      </span>
                    );
                  } else if (lastMsg.delivered) {
                    return (
                      <span className="flex -space-x-1 flex-shrink-0">
                        <FiCheck className="w-3.5 h-3.5 text-gray-400" />
                        <FiCheck className="w-3.5 h-3.5 text-gray-400 -ml-1.5" />
                      </span>
                    );
                  } else {
                    return (
                      <FiCheck className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    );
                  }
                })()}
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {isMyLastMessage ? 'You: ' : ''}
                  {lastMsg.messageType === 'image' ? '📷 Photo'
                    : lastMsg.messageType === 'video' ? '🎥 Video'
                    : lastMsg.messageType === 'file' ? '📎 File'
                    : lastMsg.messageType === 'audio' ? '🎵 Audio'
                    : truncateText(lastMsg.content, 40)}
                </p>
              </>
            ) : (
              <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                No messages yet
              </p>
            )}
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className={`flex flex-col h-full bg-white/70 dark:bg-dark-900/60 backdrop-blur-xl border-r border-teal-500/10 ${
      isMobileOpen ? 'fixed inset-0 z-40 md:relative md:inset-auto' : ''
    } ${sidebarOpen ? 'w-full md:w-80' : 'w-0 overflow-hidden'}`}>
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-teal-500/10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 glass rounded-2xl flex items-center justify-center hover-glow transition-all duration-300 hover:scale-110 shadow-md shadow-primary-500/20">
              <img src="/echo-logo.svg" alt="Echo" className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white gradient-text">Echo</h1>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowCreateGroup(true)}
              className="p-2.5 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-700 hover:text-primary-500 dark:hover:text-primary-400 transition-all duration-300 hover:scale-110 active:scale-95"
              title="Create new group"
              aria-label="Create new group"
            >
              <FiUserPlus className="w-5 h-5" />
            </button>
            <ThemeToggle />
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="p-2 rounded-lg hover:bg-teal-500/10 dark:hover:bg-white/5 transition-all"
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: stringToColor(user?.name) }}
                >
                  {getInitials(user?.name)}
                </div>
              </button>

              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 w-56 glass rounded-2xl shadow-xl z-50 animate-fade-in-scale overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-dark-600">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{user?.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
                  </div>
                  <div className="py-1">
                    <button onClick={() => { navigate('/profile'); setShowUserMenu(false); }} className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-teal-500/10 dark:hover:bg-white/5 flex items-center gap-3">
                      <FiUser className="w-4 h-4" /> Profile
                    </button>
                    <button onClick={() => { navigate('/settings'); setShowUserMenu(false); }} className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-teal-500/10 dark:hover:bg-white/5 flex items-center gap-3">
                      <FiSettings className="w-4 h-4" /> Settings
                    </button>
                    <hr className="border-gray-100 dark:border-dark-600" />
                    <button onClick={handleLogout} className="w-full px-4 py-2.5 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3">
                      <FiLogOut className="w-4 h-4" /> Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chats or users..."
            className="input-field pl-10 pr-10 py-2.5 text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setSearchResults([]); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <FiX className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search Results */}
        {searchQuery && (
          <div className="mt-2 max-h-60 overflow-y-auto glass rounded-2xl shadow-lg">
            {isSearching ? (
              <UserSearchSkeleton />
            ) : searchResults.length > 0 ? (
              <div className="py-1">
                <p className="px-3 py-2 text-xs font-medium text-gray-400 uppercase tracking-wider">Users</p>
                {searchResults.map((u) => (
                  <div key={u._id} className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-teal-500/10 dark:hover:bg-white/5 transition-all">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                      style={{ backgroundColor: stringToColor(u.name) }}
                    >
                      {getInitials(u.name)}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{u.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">@{u.username || 'username'} • {u.email}</p>
                    </div>
                    <div className="flex gap-2 items-center">
                      {u.relationship === 'friends' ? (
                        <button onClick={() => handleSelectUser(u._id)} className="text-xs text-primary-500 font-medium">Message</button>
                      ) : u.relationship === 'sent' ? (
                        <span className="text-xs text-gray-400">Requested</span>
                      ) : u.relationship === 'received' ? (
                        <button onClick={() => handleRequestAction(u._id, 'accept')} className="text-xs text-green-500 font-medium">Accept</button>
                      ) : (
                        <button onClick={() => handleFriendRequest(u._id)} className="text-xs text-primary-500 font-medium">Add</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                No users found
              </div>
            )}
          </div>
        )}
      </div>


      {/* Sidebar tabs */}
      <div className="flex-shrink-0 px-4 pt-3 flex gap-2">
        <button onClick={() => setSidebarTab('chats')} className={`px-3 py-1.5 text-xs font-medium rounded-full ${sidebarTab === 'chats' ? 'bg-primary-500 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-teal-500/10 dark:hover:bg-white/5'}`}>Chats</button>
        <button onClick={() => setSidebarTab('friends')} className={`px-3 py-1.5 text-xs font-medium rounded-full ${sidebarTab === 'friends' ? 'bg-primary-500 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-teal-500/10 dark:hover:bg-white/5'}`}>Friends{friends.length ? ` (${friends.length})` : ''}</button>
        <button onClick={() => setSidebarTab('requests')} className={`px-3 py-1.5 text-xs font-medium rounded-full ${sidebarTab === 'requests' ? 'bg-primary-500 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-teal-500/10 dark:hover:bg-white/5'}`}>Requests{friendRequests.receivedRequests.length ? ` (${friendRequests.receivedRequests.length})` : ''}</button>
      </div>

      {/* Filter Tabs */}
      {sidebarTab === 'chats' && <div className="flex-shrink-0 px-4 py-2 flex gap-1">
        {['all', 'unread', 'pinned'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
              filter === f
                ? 'bg-primary-500 text-white'
                : 'text-gray-500 dark:text-gray-400 hover:bg-teal-500/10 dark:hover:bg-white/5'
            }`}
          >
            {f === 'all' ? 'All' : f === 'unread' ? 'Unread' : 'Pinned'}
          </button>
        ))}
      </div>}

      {/* Chat List */}
      {/* Story Bar */}
      <StoryBar />

      {/* Create Group Modal */}
      {showCreateGroup && (
        <CreateGroupModal
          onClose={() => setShowCreateGroup(false)}
          onGroupCreated={handleGroupCreated}
        />
      )}

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {sidebarTab === 'friends' ? (
          friends.length ? friends.map((friend) => (
            <button key={friend._id} onClick={() => handleSelectUser(friend._id)} className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-teal-500/10 dark:hover:bg-white/5 transition-all">
              {friend.avatar ? <img src={friend.avatar} alt={friend.name} className="w-11 h-11 rounded-full object-cover" /> : <div className="w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: stringToColor(friend.name) }}>{getInitials(friend.name)}</div>}
              <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{friend.name}</p><p className="text-xs text-gray-500 dark:text-gray-400 truncate">@{friend.username || 'username'}{onlineUsers.includes(friend._id) ? ' • Online' : ''}</p></div>
              <FiMessageSquare className="w-4 h-4 text-primary-500" />
            </button>
          )) : <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">No friends yet. Search by @username to add someone.</div>
        ) : sidebarTab === 'requests' ? (
          friendRequests.receivedRequests.length === 0 && friendRequests.sentRequests.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">No pending friend requests.</div>
          ) : (
            <div className="space-y-2 p-3">
              {friendRequests.receivedRequests.map((request) => (
                <div key={request._id} className="flex items-center gap-3 rounded-2xl bg-teal-500/5 dark:bg-white/5 border border-teal-500/10 p-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: stringToColor(request.name) }}>{getInitials(request.name)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{request.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">@{request.username || 'username'}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleRequestAction(request._id, 'accept')} className="px-2.5 py-1 text-xs font-medium text-white bg-green-500 rounded-lg hover:bg-green-600 transition-all">Accept</button>
                    <button onClick={() => handleRequestAction(request._id, 'reject')} className="px-2.5 py-1 text-xs font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-all">Reject</button>
                  </div>
                </div>
              ))}
              {friendRequests.sentRequests.map((request) => (
                <div key={request._id} className="flex items-center gap-3 rounded-2xl bg-teal-500/5 dark:bg-white/5 border border-teal-500/10 p-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: stringToColor(request.name) }}>{getInitials(request.name)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{request.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">@{request.username || 'username'}</p>
                  </div>
                  <span className="text-xs text-gray-400 bg-gray-100 dark:bg-dark-600 px-2 py-1 rounded-lg">Pending</span>
                </div>
              ))}
            </div>
          )
        ) : loadingChats ? (
          <ChatListSkeleton />
        ) : filteredChats.length === 0 && sortedArchivedChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-16 h-16 glass rounded-full flex items-center justify-center mb-4">
              <FiMessageSquare className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 font-medium">No chats yet</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              Search for users to start chatting, or tap the + button to create a group
            </p>
          </div>
        ) : (
          <>
            {/* Non-archived chats */}
            {filteredChats.length === 0 && filter !== 'all' ? (
              <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
                No {filter} chats here
              </div>
            ) : (
              filteredChats.length > 0 && (
                <div className="stagger-children">
                  {filteredChats.map(renderChatRow)}
                </div>
              )
            )}

            {/* Archived section — per-user archived chats stay reachable */}
            {sortedArchivedChats.length > 0 && (
              <div>
                <div className="px-4 pt-3 pb-1 flex items-center gap-1.5 text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  <FiArchive className="w-3.5 h-3.5" />
                  Archived ({sortedArchivedChats.length})
                </div>
                <div className="stagger-children">
                  {sortedArchivedChats.map(renderChatRow)}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ChatSidebar;
