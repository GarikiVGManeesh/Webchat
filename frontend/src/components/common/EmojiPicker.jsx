import { useState, useRef, useEffect } from 'react';
import EmojiPickerReact from 'emoji-picker-react';
import { FiSmile } from 'react-icons/fi';

const EmojiPicker = ({ onSelect, className = '' }) => {
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setShowPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`} ref={pickerRef}>
      <button
        type="button"
        onClick={() => setShowPicker(!showPicker)}
        className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-all"
        title="Add emoji"
      >
        <FiSmile className="w-5 h-5" />
      </button>

      {showPicker && (
        <div className="absolute bottom-12 left-0 z-50 animate-fade-in">
          <div className="shadow-2xl rounded-2xl overflow-hidden border border-gray-200 dark:border-dark-600">
            <EmojiPickerReact
              onEmojiClick={(emojiObject) => {
                onSelect(emojiObject.emoji);
                setShowPicker(false);
              }}
              theme={document.documentElement.classList.contains('dark') ? 'dark' : 'light'}
              searchPlaceholder="Search emojis..."
              width={320}
              height={400}
              lazyLoadEmojis
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default EmojiPicker;
