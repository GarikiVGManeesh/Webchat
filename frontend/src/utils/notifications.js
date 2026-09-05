/**
 * Notification Utilities for Echo Chat
 * - Web Audio API notification sound (no external file needed)
 * - Desktop Notification wrapper
 * - Window visibility helpers
 * - Preference management via localStorage
 */

// ==================== PREFERENCES ====================

const PREF_KEY = 'echo_notification_prefs';

const DEFAULT_PREFS = {
  desktopNotifications: true,
  notificationSounds: true,
};

/**
 * Get notification preferences from localStorage
 */
export const getNotificationPrefs = () => {
  try {
    const stored = localStorage.getItem(PREF_KEY);
    if (stored) {
      return { ...DEFAULT_PREFS, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.warn('Failed to parse notification prefs:', e);
  }
  return { ...DEFAULT_PREFS };
};

/**
 * Save notification preferences to localStorage
 */
export const setNotificationPrefs = (prefs) => {
  try {
    const current = getNotificationPrefs();
    const updated = { ...current, ...prefs };
    localStorage.setItem(PREF_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.warn('Failed to save notification prefs:', e);
    return getNotificationPrefs();
  }
};

// ==================== WINDOW FOCUS ====================

/**
 * Check if the browser window/tab is currently focused and visible
 */
export const isWindowFocused = () => {
  return !document.hidden && document.hasFocus();
};

// ==================== NOTIFICATION SOUND ====================

let audioContext = null;

/**
 * Get or create a shared AudioContext (lazy init to avoid autoplay restrictions)
 */
const getAudioContext = () => {
  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Resume if suspended (browser autoplay policy)
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
};

/**
 * Play a pleasant notification tone using Web Audio API.
 * Creates a short two-tone chime (like iMessage or Telegram).
 * No external audio file required.
 */
export const playNotificationSound = () => {
  const prefs = getNotificationPrefs();
  if (!prefs.notificationSounds) return;

  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // First tone (higher pitch)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now); // A5
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.15);

    // Second tone (slightly lower, delayed)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1174.66, now + 0.12); // D6
    gain2.gain.setValueAtTime(0, now);
    gain2.gain.setValueAtTime(0.25, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.3);

    // Cleanup
    osc1.onended = () => { osc1.disconnect(); gain1.disconnect(); };
    osc2.onended = () => { osc2.disconnect(); gain2.disconnect(); };
  } catch (e) {
    console.warn('Failed to play notification sound:', e);
  }
};

// ==================== DESKTOP NOTIFICATION ====================

/**
 * Show a desktop notification with optional click handler.
 * Respects user preferences and permission state.
 *
 * @param {Object} options
 * @param {string} options.title - Notification title (e.g., sender name)
 * @param {string} options.body - Notification body (message preview)
 * @param {string} [options.icon] - URL to sender avatar or app icon
 * @param {string} [options.tag] - Unique tag to replace existing notifications
 * @param {Function} [options.onClick] - Callback when notification is clicked
 */
export const showDesktopNotification = ({ title, body, icon, tag, onClick }) => {
  const prefs = getNotificationPrefs();
  if (!prefs.desktopNotifications) return null;

  if (!('Notification' in window)) return null;
  if (Notification.permission !== 'granted') return null;

  try {
    const notification = new Notification(title, {
      body: body?.length > 50 ? body.slice(0, 50) + '…' : body,
      icon: icon || '/chat-icon.png',
      tag: tag || `echo-${Date.now()}`,
      badge: '/chat-icon.png',
      silent: true, // We handle sound separately
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
      if (onClick) onClick();
    };

    // Auto-close after 5 seconds
    setTimeout(() => notification.close(), 5000);

    return notification;
  } catch (e) {
    console.warn('Failed to show desktop notification:', e);
    return null;
  }
};

/**
 * Request notification permission if not already granted.
 * Returns the permission state.
 */
export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';

  const result = await Notification.requestPermission();
  return result;
};
