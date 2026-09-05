import { useState, useRef, useEffect } from 'react';
import { FiChevronDown, FiSearch } from 'react-icons/fi';

const COUNTRIES = [
  { code: '+91', country: 'India', flag: '🇮🇳', iso: 'IN' },
  { code: '+1', country: 'United States', flag: '🇺🇸', iso: 'US' },
  { code: '+44', country: 'United Kingdom', flag: '🇬🇧', iso: 'GB' },
  { code: '+61', country: 'Australia', flag: '🇦🇺', iso: 'AU' },
  { code: '+86', country: 'China', flag: '🇨🇳', iso: 'CN' },
  { code: '+81', country: 'Japan', flag: '🇯🇵', iso: 'JP' },
  { code: '+49', country: 'Germany', flag: '🇩🇪', iso: 'DE' },
  { code: '+33', country: 'France', flag: '🇫🇷', iso: 'FR' },
  { code: '+39', country: 'Italy', flag: '🇮🇹', iso: 'IT' },
  { code: '+55', country: 'Brazil', flag: '🇧🇷', iso: 'BR' },
  { code: '+7', country: 'Russia', flag: '🇷🇺', iso: 'RU' },
  { code: '+82', country: 'South Korea', flag: '🇰🇷', iso: 'KR' },
  { code: '+34', country: 'Spain', flag: '🇪🇸', iso: 'ES' },
  { code: '+52', country: 'Mexico', flag: '🇲🇽', iso: 'MX' },
  { code: '+62', country: 'Indonesia', flag: '🇮🇩', iso: 'ID' },
  { code: '+90', country: 'Turkey', flag: '🇹🇷', iso: 'TR' },
  { code: '+966', country: 'Saudi Arabia', flag: '🇸🇦', iso: 'SA' },
  { code: '+971', country: 'UAE', flag: '🇦🇪', iso: 'AE' },
  { code: '+27', country: 'South Africa', flag: '🇿🇦', iso: 'ZA' },
  { code: '+234', country: 'Nigeria', flag: '🇳🇬', iso: 'NG' },
  { code: '+254', country: 'Kenya', flag: '🇰🇪', iso: 'KE' },
  { code: '+63', country: 'Philippines', flag: '🇵🇭', iso: 'PH' },
  { code: '+84', country: 'Vietnam', flag: '🇻🇳', iso: 'VN' },
  { code: '+66', country: 'Thailand', flag: '🇹🇭', iso: 'TH' },
  { code: '+60', country: 'Malaysia', flag: '🇲🇾', iso: 'MY' },
  { code: '+65', country: 'Singapore', flag: '🇸🇬', iso: 'SG' },
  { code: '+92', country: 'Pakistan', flag: '🇵🇰', iso: 'PK' },
  { code: '+880', country: 'Bangladesh', flag: '🇧🇩', iso: 'BD' },
  { code: '+94', country: 'Sri Lanka', flag: '🇱🇰', iso: 'LK' },
  { code: '+977', country: 'Nepal', flag: '🇳🇵', iso: 'NP' },
  { code: '+20', country: 'Egypt', flag: '🇪🇬', iso: 'EG' },
  { code: '+31', country: 'Netherlands', flag: '🇳🇱', iso: 'NL' },
  { code: '+46', country: 'Sweden', flag: '🇸🇪', iso: 'SE' },
  { code: '+47', country: 'Norway', flag: '🇳🇴', iso: 'NO' },
  { code: '+48', country: 'Poland', flag: '🇵🇱', iso: 'PL' },
  { code: '+351', country: 'Portugal', flag: '🇵🇹', iso: 'PT' },
  { code: '+353', country: 'Ireland', flag: '🇮🇪', iso: 'IE' },
  { code: '+41', country: 'Switzerland', flag: '🇨🇭', iso: 'CH' },
  { code: '+43', country: 'Austria', flag: '🇦🇹', iso: 'AT' },
  { code: '+32', country: 'Belgium', flag: '🇧🇪', iso: 'BE' },
  { code: '+45', country: 'Denmark', flag: '🇩🇰', iso: 'DK' },
  { code: '+358', country: 'Finland', flag: '🇫🇮', iso: 'FI' },
  { code: '+64', country: 'New Zealand', flag: '🇳🇿', iso: 'NZ' },
  { code: '+1', country: 'Canada', flag: '🇨🇦', iso: 'CA' },
  { code: '+54', country: 'Argentina', flag: '🇦🇷', iso: 'AR' },
  { code: '+57', country: 'Colombia', flag: '🇨🇴', iso: 'CO' },
  { code: '+56', country: 'Chile', flag: '🇨🇱', iso: 'CL' },
  { code: '+380', country: 'Ukraine', flag: '🇺🇦', iso: 'UA' },
  { code: '+972', country: 'Israel', flag: '🇮🇱', iso: 'IL' },
];

const CountryCodeSelect = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  const selected = COUNTRIES.find((c) => c.code === value) || COUNTRIES[0];

  const filtered = COUNTRIES.filter(
    (c) =>
      c.country.toLowerCase().includes(search.toLowerCase()) ||
      c.code.includes(search) ||
      c.iso.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-3 border border-primary-500/20 bg-white/60 dark:bg-white/5 rounded-l-lg hover:bg-primary-500/10 dark:hover:bg-white/10 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 h-full backdrop-blur-xl"
      >
        <span className="text-lg leading-none">{selected.flag}</span>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{selected.code}</span>
        <FiChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-72 glass rounded-2xl shadow-2xl z-50 animate-fade-in-scale overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-gray-100 dark:border-dark-700">
            <div className="relative">
              <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search country..."
                className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 dark:bg-dark-700 border-0 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500 text-gray-900 dark:text-gray-100 placeholder-gray-400"
              />
            </div>
          </div>

          {/* Country list */}
          <div className="max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-4">No countries found</p>
            ) : (
              filtered.map((country) => (
                <button
                  key={`${country.iso}-${country.code}`}
                  type="button"
                  onClick={() => {
                    onChange(country.code);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors ${
                    country.code === value ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                  }`}
                >
                  <span className="text-xl leading-none">{country.flag}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {country.country}
                    </p>
                  </div>
                  <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                    {country.code}
                  </span>
                  {country.code === value && (
                    <span className="text-primary-500 text-sm">✓</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export { COUNTRIES };
export default CountryCodeSelect;
