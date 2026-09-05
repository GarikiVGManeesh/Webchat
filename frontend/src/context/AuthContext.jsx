import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { authAPI, userAPI } from '../utils/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Marks a session that was JUST created via signup/login in this tab.
  // While true, the background verify effect must NOT tear the session down
  // (protects against a cold-start /me hiccup bouncing a brand-new user).
  const freshSessionRef = useRef(false);

  // Load user from localStorage on mount (synchronous, no network)
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');

    if (storedUser && token) {
      try {
        setUser(JSON.parse(storedUser));
        setIsAuthenticated(true);
      } catch {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      }
    }
    setLoading(false);
  }, []);

  // Verify token on mount and refresh it periodically.
  // IMPORTANT: a failed /me call must NOT destroy a valid local session.
  // We only clear the session on a genuine 401 (token rejected by server),
  // and never while a freshly-created session is still settling.
  useEffect(() => {
    const verifyToken = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const { data } = await authAPI.getMe();
        setUser(data.user);
        setIsAuthenticated(true);
        localStorage.setItem('user', JSON.stringify(data.user));
      } catch (error) {
        // Do not evict a brand-new session on a transient failure.
        if (freshSessionRef.current) {
          return;
        }
        // Only a real 401 means the token is invalid/expired -> log out.
        // Network errors / cold-start 5xx keep the existing local session.
        if (error && error.status === 401) {
          setUser(null);
          setIsAuthenticated(false);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      } finally {
        setLoading(false);
      }
    };

    verifyToken();

    // Verify token every 15 minutes
    const interval = setInterval(verifyToken, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Sign up
  const signup = useCallback(async (userData) => {
    const { data } = await authAPI.signup(userData);
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    freshSessionRef.current = true;
    setUser(data.user);
    setIsAuthenticated(true);
    setLoading(false);
    // Allow the background verify to resume authority after the transition settles.
    setTimeout(() => {
      freshSessionRef.current = false;
    }, 5000);
    return data;
  }, []);

  // Login
  const login = useCallback(async (credentials) => {
    const { data } = await authAPI.login(credentials);
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    freshSessionRef.current = true;
    setUser(data.user);
    setIsAuthenticated(true);
    setLoading(false);
    setTimeout(() => {
      freshSessionRef.current = false;
    }, 5000);
    return data;
  }, []);

  // Login with OTP
  const sendOTP = useCallback(async (mobile) => {
    const { data } = await authAPI.sendOTP({ mobile });
    return data;
  }, []);

  const verifyOTP = useCallback(async (otpData) => {
    const { data } = await authAPI.verifyOTP(otpData);
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    freshSessionRef.current = true;
    setUser(data.user);
    setIsAuthenticated(true);
    setLoading(false);
    setTimeout(() => {
      freshSessionRef.current = false;
    }, 5000);
    return data;
  }, []);

  // Logout
  const logout = useCallback(async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      setIsAuthenticated(false);
    }
  }, []);

  // Logout from all devices
  const logoutAll = useCallback(async () => {
    try {
      await authAPI.logoutAll();
    } catch (error) {
      console.error('Logout all error:', error);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      setIsAuthenticated(false);
    }
  }, []);

  // Update user data
  const updateUser = useCallback((userData) => {
    setUser((prev) => ({ ...prev, ...userData }));
    localStorage.setItem('user', JSON.stringify({ ...user, ...userData }));
  }, [user]);

  // Update profile
  const updateProfile = useCallback(async (profileData) => {
    const { data } = await userAPI.updateProfile(profileData);
    setUser(data.user);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data;
  }, []);

  // Update avatar
  const updateAvatar = useCallback(async (formData) => {
    const { data } = await userAPI.updateAvatar(formData);
    setUser((prev) => ({ ...prev, ...data.user }));
    return data;
  }, []);

  const value = {
    user,
    loading,
    isAuthenticated,
    signup,
    login,
    sendOTP,
    verifyOTP,
    logout,
    logoutAll,
    updateUser,
    updateProfile,
    updateAvatar,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
