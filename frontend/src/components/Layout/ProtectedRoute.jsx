import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { APP_NAME, APP_LOGO } from '../../config';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center animate-fade-in">
          {/* Animated Logo */}
          <div className="relative inline-block mb-6">
            <div className="w-20 h-20 mx-auto glass rounded-[1.75rem] flex items-center justify-center shadow-xl shadow-primary-500/20 animate-float">
              <img src={APP_LOGO} alt={APP_NAME} className="w-12 h-12" />
            </div>
            {/* Spinning ring */}
            <div className="absolute inset-0 w-20 h-20 rounded-3xl border-2 border-t-primary-500 border-r-primary-300 border-b-transparent border-l-transparent animate-spin" style={{ animationDuration: '1.5s' }} />
          </div>

          <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-1">
            {APP_NAME}
          </h2>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Loading your conversations...
          </p>

          {/* Animated dots */}
          <div className="flex items-center justify-center gap-1.5 mt-4">
            <span className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return children;
};

export default ProtectedRoute;
