import { useState, useEffect, useRef, useCallback } from 'react';
import { FiSearch, FiX, FiChevronUp, FiChevronDown } from 'react-icons/fi';
import { messageAPI } from '../../utils/api';

// onResultSelect/onResultsChange are optional; ChatWindow only wires up
// onResultSelect. Defaulting them to no-ops prevents a crash when the search
// results change or the panel is closed.
const MessageSearch = ({
  chatId,
  onClose,
  onResultSelect = () => {},
  onResultsChange = () => {},
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  const resultsContainerRef = useRef(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounced search
  const performSearch = useCallback(async (searchQuery) => {
    if (!searchQuery.trim() || !chatId) {
      setResults([]);
      setTotalCount(0);
      setActiveIndex(-1);
      setShowResults(false);
      onResultsChange([]);
      return;
    }

    setLoading(true);
    try {
      const response = await messageAPI.searchMessages({
        chatId,
        q: searchQuery.trim(),
      });
      const searchResults = response.data?.messages || response.data || [];
      setResults(searchResults);
      setTotalCount(searchResults.length);
      setActiveIndex(searchResults.length > 0 ? 0 : -1);
      setShowResults(searchResults.length > 0);
      onResultsChange(searchResults);

      // Auto-select first result
      if (searchResults.length > 0) {
        onResultSelect(searchResults[0]._id, 0);
      }
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
      setTotalCount(0);
      setActiveIndex(-1);
      setShowResults(false);
      onResultsChange([]);
    } finally {
      setLoading(false);
    }
  }, [chatId, onResultSelect, onResultsChange]);

  // Handle input change with debounce
  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      performSearch(value);
    }, 300);
  };

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Navigate to previous result
  const goToPrevious = () => {
    if (results.length === 0) return;
    const newIndex = activeIndex <= 0 ? results.length - 1 : activeIndex - 1;
    setActiveIndex(newIndex);
    onResultSelect(results[newIndex]._id, newIndex);
    scrollResultIntoView(newIndex);
  };

  // Navigate to next result
  const goToNext = () => {
    if (results.length === 0) return;
    const newIndex = activeIndex >= results.length - 1 ? 0 : activeIndex + 1;
    setActiveIndex(newIndex);
    onResultSelect(results[newIndex]._id, newIndex);
    scrollResultIntoView(newIndex);
  };

  // Scroll active result into view in the results list
  const scrollResultIntoView = (index) => {
    if (!resultsContainerRef.current) return;
    const items = resultsContainerRef.current.querySelectorAll('[data-result-item]');
    if (items[index]) {
      items[index].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  };

  // Handle clicking a result item
  const handleResultClick = (result, index) => {
    setActiveIndex(index);
    onResultSelect(result._id, index);
    setShowResults(false);
  };

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter') {
      if (e.shiftKey) {
        goToPrevious();
      } else {
        goToNext();
      }
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (showResults) {
        const newIndex = activeIndex <= 0 ? results.length - 1 : activeIndex - 1;
        setActiveIndex(newIndex);
        scrollResultIntoView(newIndex);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (showResults) {
        const newIndex = activeIndex >= results.length - 1 ? 0 : activeIndex + 1;
        setActiveIndex(newIndex);
        scrollResultIntoView(newIndex);
      }
    }
  };

  // Close search and clear results
  const handleClose = () => {
    setQuery('');
    setResults([]);
    setTotalCount(0);
    setActiveIndex(-1);
    setShowResults(false);
    onResultsChange([]);
    onClose();
  };

  // Format timestamp for result preview
  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  // Get sender name from message
  const getSenderName = (message) => {
    if (typeof message.sender === 'object' && message.sender?.name) {
      return message.sender.name;
    }
    return 'Unknown';
  };

  // Truncate message content for preview
  const getPreview = (message) => {
    const content = message.content || '';
    if (message.messageType === 'image') return '📷 Photo';
    if (message.messageType === 'file') return '📎 File';
    if (message.messageType === 'audio') return '🎵 Audio';
    if (message.messageType === 'video') return '🎬 Video';
    if (message.messageType === 'location') return '📍 Location';
    return content.length > 80 ? content.substring(0, 80) + '...' : content;
  };

  // Highlight matching text in preview
  const highlightMatch = (text, searchQuery) => {
    if (!searchQuery.trim() || !text) return text;
    const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-200 dark:bg-yellow-500/30 text-inherit rounded-sm px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className="animate-slide-down">
      {/* Search bar */}
      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100 dark:border-dark-700">
        <FiSearch className="text-gray-400 dark:text-gray-500 flex-shrink-0 w-4 h-4" />
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => results.length > 0 && setShowResults(true)}
            placeholder="Search in this chat..."
            className="input-field py-1.5 text-sm w-full pr-20"
            autoFocus
          />
          {/* Result count badge */}
          {query.trim() && !loading && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 dark:text-gray-500 font-medium whitespace-nowrap">
              {totalCount > 0 ? `${activeIndex + 1} of ${totalCount}` : 'No results'}
            </span>
          )}
          {loading && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2">
              <svg className="animate-spin h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </span>
          )}
        </div>

        {/* Navigation arrows */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={goToPrevious}
            disabled={totalCount === 0}
            className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-teal-500/10 dark:hover:bg-white/5 rounded-md transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            title="Previous result (Shift+Enter)"
          >
            <FiChevronUp className="w-4 h-4" />
          </button>
          <button
            onClick={goToNext}
            disabled={totalCount === 0}
            className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-teal-500/10 dark:hover:bg-white/5 rounded-md transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            title="Next result (Enter)"
          >
            <FiChevronDown className="w-4 h-4" />
          </button>
        </div>

        {/* Close button */}
        <button
          onClick={handleClose}
          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-teal-500/10 dark:hover:bg-white/5 rounded-md transition-all"
          title="Close search (Esc)"
        >
          <FiX className="w-4 h-4" />
        </button>
      </div>

      {/* Results dropdown */}
      {showResults && results.length > 0 && (
        <div
          ref={resultsContainerRef}
          className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-700 shadow-lg animate-fade-in scrollbar-hide"
        >
          {results.map((result, index) => (
            <button
              key={result._id}
              data-result-item
              onClick={() => handleResultClick(result, index)}
              className={`w-full px-3 py-2.5 text-left flex items-start gap-3 transition-colors border-b border-gray-50 dark:border-dark-600 last:border-b-0 ${
                index === activeIndex
                  ? 'bg-primary-50 dark:bg-primary-900/20 border-l-2 border-l-primary-500'
                  : 'hover:bg-teal-500/10 dark:hover:bg-white/5 border-l-2 border-l-transparent'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className={`text-xs font-semibold truncate ${
                    index === activeIndex
                      ? 'text-primary-700 dark:text-primary-300'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}>
                    {getSenderName(result)}
                  </span>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 flex-shrink-0">
                    {formatTime(result.createdAt)}
                  </span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 truncate leading-relaxed">
                  {highlightMatch(getPreview(result), query)}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default MessageSearch;
