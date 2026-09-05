import { useState, useRef, useEffect } from 'react';
import { FiClock, FiCheck } from 'react-icons/fi';
import { chatAPI } from '../../utils/api';
import { useChat } from '../../context/ChatContext';
import toast from 'react-hot-toast';

const VANISH_OPTIONS = [
  { value: 'off', label: 'Off', description: 'Messages stay forever', icon: '∞' },
  { value: '5min', label: '5 minutes', description: 'Disappear after 5 min', icon: '5m' },
  { value: '1hr', label: '1 hour', description: 'Disappear after 1 hour', icon: '1h' },
  { value: '24hr', label: '24 hours', description: 'Disappear after 1 day', icon: '24h' },
  { value: '7days', label: '7 days', description: 'Disappear after 1 week', icon: '7d' },
];

const VanishModeToggle = ({ chatId, currentMode = 'off', onClose }) => {
  const [selected, setSelected] = useState(currentMode);
  const [isUpdating, setIsUpdating] = useState(false);
  const [animatingOption, setAnimatingOption] = useState(null);
  const { setActiveChat } = useChat();
  const panelRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose?.();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleSelect = async (mode) => {
    if (mode === selected || isUpdating) return;

    setAnimatingOption(mode);
    setIsUpdating(true);

    try {
      const { data } = await chatAPI.updateVanishMode(chatId, { mode });
      setSelected(mode);

      // Update active chat context
      setActiveChat((prev) => prev ? { ...prev, vanishMode: mode } : prev);

      const option = VANISH_OPTIONS.find((o) => o.value === mode);
      toast.success(
        mode === 'off'
          ? 'Disappearing messages turned off'
          : `Messages will disappear after ${option.label}`,
        { icon: '⏱️', duration: 3000 }
      );
    } catch (error) {
      toast.error('Failed to update vanish mode');
    } finally {
      setIsUpdating(false);
      setTimeout(() => setAnimatingOption(null), 300);
    }
  };

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-dark-700 rounded-2xl shadow-2xl border border-gray-200 dark:border-dark-600 z-50 animate-fade-in-scale overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-dark-600">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
            <FiClock className="w-4 h-4 text-primary-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Disappearing Messages
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Set a timer for messages
            </p>
          </div>
        </div>
      </div>

      {/* Options */}
      <div className="py-2">
        {VANISH_OPTIONS.map((option, index) => {
          const isSelected = selected === option.value;
          const isAnimating = animatingOption === option.value;

          return (
            <button
              key={option.value}
              onClick={() => handleSelect(option.value)}
              disabled={isUpdating}
              className={`w-full px-4 py-3 flex items-center gap-3 transition-all duration-200 relative overflow-hidden ${
                isSelected
                  ? 'bg-primary-50 dark:bg-primary-900/20'
                  : 'hover:bg-primary-500/10 dark:hover:bg-white/5'
              } ${isUpdating && !isAnimating ? 'opacity-50' : ''}`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Animated selection indicator */}
              {isSelected && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary-500 rounded-r-full animate-scale-in" />
              )}

              {/* Timer icon */}
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  isSelected
                    ? 'bg-primary-500 text-white scale-105 shadow-lg shadow-primary-500/20'
                    : 'bg-gray-100 dark:bg-dark-600 text-gray-600 dark:text-gray-300'
                } ${isAnimating ? 'animate-pop-in' : ''}`}
              >
                {option.icon}
              </div>

              {/* Label & description */}
              <div className="flex-1 text-left">
                <p
                  className={`text-sm font-medium transition-colors ${
                    isSelected
                      ? 'text-primary-700 dark:text-primary-300'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {option.label}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {option.description}
                </p>
              </div>

              {/* Checkmark */}
              {isSelected && (
                <div className="w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center animate-pop-in">
                  <FiCheck className="w-3 h-3 text-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer note */}
      <div className="px-4 py-2.5 border-t border-gray-100 dark:border-dark-600 bg-gray-50 dark:bg-dark-800/50">
        <p className="text-[11px] text-gray-400 dark:text-gray-500 text-center">
          This applies to new messages sent in this chat
        </p>
      </div>
    </div>
  );
};

export default VanishModeToggle;
