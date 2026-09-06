import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { chatAPI } from '../../utils/api';
import { getOtherParticipant } from '../../utils/helpers';
import {
  FiX,
  FiBell,
  FiAtSign,
  FiBellOff,
  FiCheck,
  FiClock,
} from 'react-icons/fi';

// Mute duration choices. 'never' = muted until the user turns it back on.
const MUTE_DURATIONS = [
  { key: '1h', label: '1 hour', ms: 60 * 60 * 1000 },
  { key: '8h', label: '8 hours', ms: 8 * 60 * 60 * 1000 },
  { key: '1w', label: '1 week', ms: 7 * 24 * 60 * 60 * 1000 },
  { key: 'never', label: 'Until I turn it back on', ms: null },
];

const MODES = [
  {
    key: 'all',
    label: 'All Messages',
    desc: 'Get notified for every new message',
    icon: FiBell,
  },
  {
    key: 'mentions',
    label: 'Mentions Only',
    desc: 'Notify only when someone @mentions you',
    icon: FiAtSign,
  },
  {
    key: 'muted',
    label: 'Muted',
    desc: 'No notifications — messages still arrive normally',
    icon: FiBellOff,
  },
];

const NotificationSettingsModal = ({ chat, onClose }) => {
  const { user } = useAuth();
  const { setActiveChat, loadChats } = useChat();
  const [mode, setMode] = useState('all');
  const [muteDuration, setMuteDuration] = useState('never');
  const [saved, setSaved] = useState(null); // effective settings from server
  const [busy, setBusy] = useState(false);

  const isGroup = !!chat?.isGroup;
  const chatName = isGroup
    ? chat?.groupName || 'Group'
    : getOtherParticipant(chat, chat?.viewingUser?._id)?.name || 'this chat';

  // Load the current settings when the modal opens.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { data } = await chatAPI.getNotificationSettings(chat._id);
        if (cancelled) return;
        const n = data.notification || { mode: 'all', isMuted: false, muteUntil: null };
        setSaved(n);
        setMode(n.mode || 'all');
        if (n.mode === 'muted' && n.muteUntil) {
          // Pick the closest matching duration for display purposes.
          const remaining = new Date(n.muteUntil).getTime() - Date.now();
          const match =
            MUTE_DURATIONS.find(
              (d) => d.ms && Math.abs(d.ms - remaining) < 60 * 1000
            ) || null;
          setMuteDuration(match ? match.key : 'never');
        }
      } catch (err) {
        if (!cancelled) toast.error(err.message || 'Failed to load notification settings.');
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [chat._id]);

  const apply = async (newMode, newDuration = muteDuration) => {
    setBusy(true);
    try {
      const payload = { mode: newMode };
      if (newMode === 'muted') {
        const duration = MUTE_DURATIONS.find((d) => d.key === newDuration);
        payload.muteUntil = duration && duration.ms
          ? new Date(Date.now() + duration.ms).toISOString()
          : null; // null = until turned back on
      }
      const { data } = await chatAPI.updateNotificationSettings(chat._id, payload);
      setSaved(data.notification);
      setMode(data.notification.mode);
      if (newMode !== 'muted') setMuteDuration('never');

      // Reflect immediately in the open chat header / sidebar.
      setActiveChat((prev) =>
        prev && prev._id === chat._id
          ? {
              ...prev,
              notificationSettings: [
                ...(prev.notificationSettings || []).filter(
                  (s) => s.user !== user._id && s.user?._id !== user._id
                ),
                {
                  user: user._id,
                  mode: data.notification.mode,
                  muteUntil: data.notification.muteUntil,
                },
              ],
              // Keep the legacy flag in sync for the sidebar bell-off icon.
              mutedBy: data.notification.isMuted
                ? [...new Set([...(prev.mutedBy || []), user._id])]
                : (prev.mutedBy || []).filter((id) => id !== user._id),
            }
          : prev
      );
      loadChats();

      const label = MODES.find((m) => m.key === data.notification.mode)?.label;
      if (data.notification.mode === 'muted') {
        const d = MUTE_DURATIONS.find((x) => x.key === newDuration);
        toast.success(d && d.ms ? `Muted for ${d.label.toLowerCase()}` : 'Muted until you turn it back on');
      } else {
        toast.success(`Notifications: ${label}`);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to update notification settings.');
    } finally {
      setBusy(false);
    }
  };

  // Human-readable state line for the current setting.
  const stateLine = () => {
    if (!saved) return 'Loading…';
    if (saved.mode === 'muted') {
      if (saved.muteUntil) {
        const until = new Date(saved.muteUntil);
        const diff = until - Date.now();
        if (diff <= 0) return 'Mute expired — all messages will notify again.';
        const hrs = diff / (60 * 60 * 1000);
        return hrs >= 24
          ? `Muted until ${until.toLocaleDateString()} ${until.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
          : `Muted for another ${Math.max(1, Math.round(hrs))}h`;
      }
      return 'Muted until you turn notifications back on';
    }
    if (saved.mode === 'mentions') return 'You will only be notified when mentioned';
    return 'You are notified about all new messages';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-modal-overlay"
        onClick={onClose}
      />
      <div className="relative glass rounded-[2rem] p-6 w-full max-w-sm animate-modal-in shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary-600 to-primary-700 text-white flex items-center justify-center shadow-lg shadow-primary-500/25 ring-1 ring-secondary-300/40">
              <FiBell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white leading-tight">
                Notification Settings
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[180px]">
                {chatName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-primary-500/10 transition-all"
            aria-label="Close"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Current state */}
        <div className="mb-4 px-3 py-2 rounded-xl bg-primary-500/5 dark:bg-white/5 text-xs text-gray-600 dark:text-gray-300 flex items-center gap-2">
          <FiClock className="w-3.5 h-3.5 flex-shrink-0 text-primary-500" />
          <span className="truncate">{stateLine()}</span>
        </div>

        {/* Modes */}
        <div className="space-y-2">
          {MODES.map((m) => {
            const Icon = m.icon;
            const active = mode === m.key;
            return (
              <button
                key={m.key}
                onClick={() => {
                  setMode(m.key);
                  apply(m.key);
                }}
                disabled={busy}
                className={`w-full text-left px-4 py-3 rounded-2xl border transition-all duration-200 flex items-center gap-3 disabled:opacity-60 ${
                  active
                    ? 'border-primary-400 dark:border-primary-500 bg-primary-500/10 dark:bg-primary-500/15 shadow-sm'
                    : 'border-gray-200 dark:border-dark-600 hover:border-primary-300 dark:hover:border-primary-500/40 hover:bg-primary-500/5'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    active
                      ? 'bg-gradient-to-br from-primary-600 to-primary-700 text-white shadow-md shadow-primary-500/25'
                      : 'bg-gray-100 dark:bg-dark-700 text-gray-500 dark:text-gray-400'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {m.label}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">
                    {m.desc}
                  </p>
                </div>
                {active && (
                  <FiCheck className="w-4 h-4 text-primary-500 flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* Mute durations — only relevant when Muted is selected */}
        {mode === 'muted' && (
          <div className="mt-4 animate-fade-in">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 px-1">
              Mute for
            </p>
            <div className="grid grid-cols-2 gap-2">
              {MUTE_DURATIONS.map((d) => (
                <button
                  key={d.key}
                  onClick={() => {
                    setMuteDuration(d.key);
                    apply('muted', d.key);
                  }}
                  disabled={busy}
                  className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all duration-200 disabled:opacity-60 ${
                    muteDuration === d.key
                      ? 'border-primary-400 dark:border-primary-500 bg-primary-500/10 dark:bg-primary-500/15 text-primary-600 dark:text-primary-300'
                      : 'border-gray-200 dark:border-dark-600 text-gray-600 dark:text-gray-300 hover:border-primary-300 hover:bg-primary-500/5'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Privacy note */}
        <p className="mt-5 text-[11px] text-gray-400 dark:text-gray-500 text-center">
          These settings apply only to this conversation and are private to you.
        </p>
      </div>
    </div>
  );
};

export default NotificationSettingsModal;
