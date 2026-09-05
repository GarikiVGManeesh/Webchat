import { useState, useRef, useCallback, useEffect } from 'react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import EmojiPicker from '../common/EmojiPicker';
import VoiceRecorder from './VoiceRecorder';
import toast from 'react-hot-toast';
import {
  FiSend,
  FiPaperclip,
  FiX,
  FiImage,
  FiVideo,
  FiFile,
  FiMapPin,
} from 'react-icons/fi';

const MessageInput = ({ replyTo, onClearReply }) => {
  const { activeChat, sendMessage, sendFileMessage, emitTyping, emitStopTyping } = useChat();
  const { emitSendMessage } = useSocket();
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const typingTimeout = useRef(null);
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);

  const handleTyping = useCallback(() => {
    if (!activeChat) return;
    emitTyping({
      chatId: activeChat._id,
      receiverId: activeChat.participants?.find((p) => p._id !== user?._id)?._id,
    });
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      emitStopTyping({
        chatId: activeChat._id,
        receiverId: activeChat.participants?.find((p) => p._id !== user?._id)?._id,
      });
    }, 2000);
  }, [activeChat, user?._id, emitTyping, emitStopTyping]);

  useEffect(() => {
    return () => {
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedMessage = message.trim();
    if (!trimmedMessage && !replyTo) return;
    if (!activeChat) return;

    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    emitStopTyping({
      chatId: activeChat._id,
      receiverId: activeChat.participants?.find((p) => p._id !== user?._id)?._id,
    });

    try {
      await sendMessage(trimmedMessage, replyTo?._id || null);
      setMessage('');
      if (onClearReply) onClearReply();
    } catch (error) {
      toast.error('Failed to send message');
    }
  };

  const handleEmojiSelect = (emoji) => {
    setMessage((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeChat) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('chatId', activeChat._id);

    try {
      await sendFileMessage(formData);
      toast.success('File sent');
    } catch (error) {
      toast.error(error.message || 'Failed to send file');
    }

    setShowAttachMenu(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // === VOICE MESSAGE (Feature 4) ===
  const handleSendVoice = async (audioBlob, duration) => {
    if (!activeChat) return;
    const formData = new FormData();
    const fileName = `voice_${Date.now()}.webm`;
    formData.append('file', audioBlob, fileName);
    formData.append('chatId', activeChat._id);

    try {
      await sendFileMessage(formData);
      toast.success('Voice message sent');
    } catch (error) {
      toast.error('Failed to send voice message');
    }
  };

  // === LOCATION SHARING (Feature 9) ===
  const handleShareLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    toast.loading('Getting location...', { id: 'location' });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        toast.dismiss('location');

        emitSendMessage(
          {
            chatId: activeChat._id,
            content: `📍 Shared location`,
            messageType: 'location',
            location: { latitude, longitude },
          },
          (response) => {
            if (response?.error) {
              toast.error(response.error);
            } else {
              toast.success('Location shared');
            }
          }
        );
        setShowAttachMenu(false);
      },
      (error) => {
        toast.dismiss('location');
        toast.error('Failed to get location. Please allow location access.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  if (!activeChat) return null;

  return (
    <div className="flex-shrink-0 border-t border-teal-500/10 bg-white/60 dark:bg-dark-900/60 backdrop-blur-xl">
      {/* Reply Preview */}
      {replyTo && (
        <div className="px-4 py-2 bg-gray-50 dark:bg-dark-700/50 border-b border-gray-200 dark:border-dark-600 flex items-center gap-3">
          <div className="w-0.5 h-8 bg-primary-500 rounded-full" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-primary-500">
              Replying to {replyTo.sender?.name || 'message'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {replyTo.content || (replyTo.messageType === 'image' ? '📷 Photo' : '📎 File')}
            </p>
          </div>
          <button onClick={onClearReply} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <FiX className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="flex items-end gap-2 p-3">
        {/* Attach Button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowAttachMenu(!showAttachMenu)}
            className="p-2.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-teal-500/10 dark:hover:bg-white/5 rounded-lg transition-all"
          >
            <FiPaperclip className="w-5 h-5" />
          </button>

          {/* Attach Menu */}
          {showAttachMenu && (
            <div className="absolute bottom-14 left-0 bg-white dark:bg-dark-700 rounded-xl shadow-xl border border-gray-200 dark:border-dark-600 p-2.5 z-50 animate-fade-in-scale min-w-[240px]">
              <div className="grid grid-cols-4 gap-1">
                <button
                  type="button"
                  onClick={() => {
                    fileInputRef.current.accept = 'image/*';
                    fileInputRef.current.click();
                    setShowAttachMenu(false);
                  }}
                  className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-teal-500/10 dark:hover:bg-white/5 transition-all"
                >
                  <div className="p-2 bg-accent-100 dark:bg-accent-900/30 rounded-full">
                    <FiImage className="w-4 h-4 text-accent-500" />
                  </div>
                  <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Photo</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    fileInputRef.current.accept = 'video/*';
                    fileInputRef.current.click();
                    setShowAttachMenu(false);
                  }}
                  className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-teal-500/10 dark:hover:bg-white/5 transition-all"
                >
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                    <FiVideo className="w-4 h-4 text-blue-500" />
                  </div>
                  <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Video</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    fileInputRef.current.accept = '*/*';
                    fileInputRef.current.click();
                    setShowAttachMenu(false);
                  }}
                  className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-teal-500/10 dark:hover:bg-white/5 transition-all"
                >
                  <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-full">
                    <FiFile className="w-4 h-4 text-orange-500" />
                  </div>
                  <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">File</span>
                </button>
                {/* Location button */}
                <button
                  type="button"
                  onClick={handleShareLocation}
                  className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-teal-500/10 dark:hover:bg-white/5 transition-all"
                >
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-full">
                    <FiMapPin className="w-4 h-4 text-green-500" />
                  </div>
                  <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Location</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileUpload}
        />

        {/* Emoji Picker */}
        <EmojiPicker onSelect={handleEmojiSelect} />

        {/* Text Input or Voice Recorder */}
        {isRecordingVoice ? (
          <div className="flex-1">
            <VoiceRecorder onSendVoice={handleSendVoice} />
          </div>
        ) : (
          <>
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  handleTyping();
                }}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                rows={1}
                className="input-field py-2.5 pr-10 resize-none min-h-[42px] max-h-[120px]"
                style={{ overflow: 'hidden' }}
                onInput={(e) => {
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                }}
              />
            </div>

            {/* Send or Voice button */}
            {message.trim() ? (
            <button
                type="submit"
                className="p-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-xl transition-all active:scale-90 hover:scale-105 hover:shadow-lg hover:shadow-primary-500/30 duration-200"
              >
                <FiSend className="w-5 h-5 transition-transform group-hover:translate-x-0.5" />
              </button>
            ) : (
              <VoiceRecorder onSendVoice={handleSendVoice} />
            )}
          </>
        )}
      </form>
    </div>
  );
};

export default MessageInput;
