import { useTheme } from '../../context/ThemeContext';
import { FiSun, FiMoon } from 'react-icons/fi';

const ThemeToggle = ({ className = '' }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={`group relative p-2.5 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-700 transition-all duration-300 hover:scale-110 active:scale-95 ${className}`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      aria-label="Toggle theme"
    >
      <div className="relative w-5 h-5">
        {/* Sun icon */}
        <FiSun
          className={`w-5 h-5 absolute inset-0 transition-all duration-300 ${
            theme === 'dark'
              ? 'rotate-0 scale-100 opacity-100 text-yellow-400'
              : 'rotate-90 scale-0 opacity-0'
          }`}
        />
        {/* Moon icon */}
        <FiMoon
          className={`w-5 h-5 absolute inset-0 transition-all duration-300 ${
            theme === 'light'
              ? 'rotate-0 scale-100 opacity-100 text-primary-500'
              : '-rotate-90 scale-0 opacity-0'
          }`}
        />
      </div>
    </button>
  );
};

export default ThemeToggle;
