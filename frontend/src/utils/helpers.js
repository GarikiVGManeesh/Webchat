import { format, isToday, isYesterday, differenceInMinutes } from 'date-fns';

/**
 * Format message timestamp
 */
export const formatMessageTime = (date) => {
  if (!date) return '';
  const d = new Date(date);
  
  if (isToday(d)) {
    return format(d, 'h:mm a');
  } else if (isYesterday(d)) {
    return 'Yesterday ' + format(d, 'h:mm a');
  } else {
    return format(d, 'MMM d, h:mm a');
  }
};

/**
 * Format chat list timestamp
 */
export const formatChatTime = (date) => {
  if (!date) return '';
  const d = new Date(date);
  
  if (isToday(d)) {
    return format(d, 'h:mm a');
  } else if (isYesterday(d)) {
    return 'Yesterday';
  } else if (d.getFullYear() === new Date().getFullYear()) {
    return format(d, 'MMM d');
  } else {
    return format(d, 'MM/dd/yy');
  }
};

/**
 * Format last seen
 */
export const formatLastSeen = (date) => {
  if (!date) return 'Unknown';
  const d = new Date(date);
  const now = new Date();
  const diffMin = differenceInMinutes(now, d);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`;
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMM d');
};

/**
 * Get the other participant in a chat
 */
export const getOtherParticipant = (chat, currentUserId) => {
  if (!chat) return null;
  // For group chats, return a virtual "group" object
  if (chat.isGroup) {
    return { _id: chat._id, name: chat.groupName || 'Group', avatar: chat.groupAvatar || '' };
  }
  if (!chat.participants) return null;
  return chat.participants.find((p) => p._id !== currentUserId) || chat.participants[0];
};

/**
 * Truncate text
 */
export const truncateText = (text, maxLength = 50) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

/**
 * Get file icon color based on type
 */
export const getFileIconColor = (mimeType) => {
  if (mimeType?.startsWith('image/')) return 'text-primary-500';
  if (mimeType?.startsWith('video/')) return 'text-blue-500';
  if (mimeType?.startsWith('audio/')) return 'text-green-500';
  if (mimeType?.includes('pdf')) return 'text-red-500';
  if (mimeType?.includes('word') || mimeType?.includes('document')) return 'text-blue-600';
  if (mimeType?.includes('excel') || mimeType?.includes('sheet')) return 'text-green-600';
  if (mimeType?.includes('zip')) return 'text-yellow-600';
  return 'text-gray-500';
};

/**
 * Get file name from URL
 */
export const getFileNameFromUrl = (url) => {
  if (!url) return '';
  const parts = url.split('/');
  const lastPart = parts[parts.length - 1];
  return decodeURIComponent(lastPart.split('?')[0]);
};

/**
 * Format file size
 */
export const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

/**
 * Validate email
 */
export const isValidEmail = (email) => {
  return /^\S+@\S+\.\S+$/.test(email);
};

/**
 * Validate mobile number
 */
export const isValidMobile = (mobile) => {
  return /^\d{10,15}$/.test(mobile.replace(/[\s+\-()]/g, ''));
};

/**
 * Generate a color from a string (for avatar backgrounds)
 */
export const stringToColor = (str) => {
  if (!str) return '#14B8A6';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    '#14B8A6', '#10B981', '#F59E0B', '#06B6D4', '#22C55E',
    '#EF4444', '#0D9488', '#84CC16', '#F97316', '#059669',
    '#2DD4BF', '#34D399', '#0EA5E9', '#4ADE80', '#FBBF24',
  ];
  return colors[Math.abs(hash) % colors.length];
};

/**
 * Get initials from name
 */
export const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

/**
 * Class name merger (simplified clsx)
 */
export const cn = (...classes) => {
  return classes.filter(Boolean).join(' ');
};
