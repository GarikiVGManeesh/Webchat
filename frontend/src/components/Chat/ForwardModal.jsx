import { useState } from 'react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { getOtherParticipant, getInitials, stringToColor } from '../../utils/helpers';
import toast from 'react-hot-toast';
import { FiX, FiSearch, FiShare2 } from 'react-icons/fi';

const ForwardModal = ({ message, onClose }) => {
  const { chats } = useChat();
  const { user } = useAuth();
  const { emitForwardMessage } = useSocket();
  const [search, setSearch] = useState('');
  const [forwarding, setForwarding] = useState(false);

  const filteredChats = chats.filter((chat) => {
    if (!search.trim()) return true;
    if (chat.isGroup) {
      return chat.groupName?.toLowerCase().includes(search.toLowerCase());
    }
    const other = getOtherParticipant(chat, user?._id);
    return other?.name?.toLowerCase().includes(search.toLowerCase());
  });

  const handleForward = async (targetChatId) => {
    setForwarding(true);
    emitForwardMessage(message._id, targetChatId, (response) => {
      if (response?.success) {
        toast.success('Message forwarded');
        onClose();
      } else {
        toast.error(response?.error || 'Failed to forward');
      }
      setForwarding(false);
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="glass rounded-2xl w-full max-w-md max-h-[70vh] flex flex-col shadow-2xl animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-dark-700">
          <div className="flex items-center gap-2">
            <FiShare2 className="w-5 h-5 text-primary-500" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Forward Message</h3>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-gray-100 dark:border-dark-700">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats..."
              className="w-full pl-10 pr-4 py-2 bg-primary-500/10 dark:bg-white/5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Chat list */}
        <div className="flex-1 overflow-y-auto p-2">
          {filteredChats.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8 text-sm">No chats found</p>
          ) : (
            filteredChats.map((chat) => {
              const otherUser = chat.isGroup ? null : getOtherParticipant(chat, user?._id);
              const displayName = chat.isGroup ? chat.groupName : otherUser?.name || 'Unknown';
              const avatar = chat.isGroup ? chat.groupAvatar : otherUser?.avatar;

              return (
                <button
                  key={chat._id}
                  onClick={() => handleForward(chat._id)}
                  disabled={forwarding}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-primary-500/10 dark:hover:bg-white/5 transition-all disabled:opacity-50"
                >
                  {avatar ? (
                    <img src={avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
                      style={{ backgroundColor: stringToColor(displayName) }}
                    >
                      {getInitials(displayName)}
                    </div>
                  )}
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{displayName}</p>
                    {chat.isGroup && (
                      <p className="text-xs text-gray-500">{chat.participants?.length} members</p>
                    )}
                  </div>
                  <FiShare2 className="w-4 h-4 text-gray-400" />
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default ForwardModal;
