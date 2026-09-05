import { useState, useEffect } from 'react';
import { FiWifiOff, FiWifi } from 'react-icons/fi';

const NetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      setTimeout(() => setShowReconnected(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !showReconnected) return null;

  return (
    <div className={`fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center py-1.5 px-4 text-white text-xs font-medium transition-all duration-300 ${
      isOnline
        ? 'bg-green-500 animate-slide-down'
        : 'bg-red-500 animate-slide-down'
    }`}>
      {isOnline ? (
        <span className="flex items-center gap-1.5">
          <FiWifi className="w-3.5 h-3.5" />
          Back online
        </span>
      ) : (
        <span className="flex items-center gap-1.5">
          <FiWifiOff className="w-3.5 h-3.5 animate-pulse" />
          No internet connection — messages will be sent when you reconnect
        </span>
      )}
    </div>
  );
};

export default NetworkStatus;
