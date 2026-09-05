import { APP_NAME, APP_VERSION } from '../config';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { authAPI } from '../utils/api';
import ThemeToggle from '../components/common/ThemeToggle';
import toast from 'react-hot-toast';
import {
  FiArrowLeft,
  FiSun,
  FiMoon,
  FiLock,
  FiLogOut,
  FiShield,
  FiEye,
  FiEyeOff,
  FiMessageSquare,
  FiTrash2,
  FiBell,
  FiVolume2,
} from 'react-icons/fi';
import { getNotificationPrefs, setNotificationPrefs, requestNotificationPermission } from '../utils/notifications';

const SettingsPage = () => {
  const navigate = useNavigate();
  const { user, logout, logoutAll } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [changingPassword, setChangingPassword] = useState(false);

  // === NOTIFICATION PREFERENCES ===
  const [notifPrefs, setNotifPrefs] = useState(getNotificationPrefs());
  const [notifPermission, setNotifPermission] = useState(
    'Notification' in window ? Notification.permission : 'unsupported'
  );

  const handleToggleDesktopNotifications = async (enabled) => {
    if (enabled && notifPermission !== 'granted') {
      const result = await requestNotificationPermission();
      setNotifPermission(result);
      if (result !== 'granted') return;
    }
    const updated = setNotificationPrefs({ desktopNotifications: enabled });
    setNotifPrefs(updated);
  };

  const handleToggleNotificationSounds = (enabled) => {
    const updated = setNotificationPrefs({ notificationSounds: enabled });
    setNotifPrefs(updated);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      toast.error('Please fill in all fields');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setChangingPassword(true);
    try {
      await authAPI.updatePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      toast.success('Password changed successfully!');
      setShowPasswordForm(false);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      toast.error(error.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleLogoutAll = async () => {
    if (window.confirm('Are you sure you want to logout from all devices? You will be logged out of this device too.')) {
      await logoutAll();
      navigate('/');
      toast.success('Logged out from all devices');
    }
  };

  const handleDeleteAccount = () => {
    toast.error('Account deletion is not available in demo mode');
  };

  return (
    <div className="min-h-screen page-enter">
      {/* Header */}
      <div className="bg-white/70 dark:bg-dark-900/60 backdrop-blur-xl border-b border-primary-500/10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/chats')}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          >
            <FiArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back</span>
          </button>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
              <FiMessageSquare className="w-4 h-4 text-white" />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Theme Settings */}
        <div className="card p-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Appearance</h2>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {theme === 'dark' ? (
                <FiMoon className="w-5 h-5 text-primary-500" />
              ) : (
                <FiSun className="w-5 h-5 text-yellow-500" />
              )}
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Switch between light and dark themes
                </p>
              </div>
            </div>
            <button
              onClick={toggleTheme}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                theme === 'dark' ? 'bg-primary-500' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                  theme === 'dark' ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="card p-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Notifications</h2>

          {/* Permission denied warning */}
          {notifPermission === 'denied' && (
            <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
              <p className="text-xs text-yellow-700 dark:text-yellow-400">
                ⚠️ Notifications are blocked by your browser. Please allow notifications in your browser settings to enable this feature.
              </p>
            </div>
          )}

          {/* Desktop Notifications Toggle */}
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-xl">
                <FiBell className="w-5 h-5 text-primary-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Desktop notifications
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Show notifications when a new message arrives
                </p>
              </div>
            </div>
            <button
              onClick={() => handleToggleDesktopNotifications(!notifPrefs.desktopNotifications)}
              disabled={notifPermission === 'denied'}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                notifPrefs.desktopNotifications && notifPermission !== 'denied'
                  ? 'bg-primary-500'
                  : 'bg-gray-300 dark:bg-dark-600'
              } ${notifPermission === 'denied' ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                  notifPrefs.desktopNotifications && notifPermission !== 'denied'
                    ? 'translate-x-6'
                    : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <hr className="border-gray-100 dark:border-dark-700" />

          {/* Notification Sounds Toggle */}
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-xl">
                <FiVolume2 className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Notification sounds
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Play a sound when a message arrives
                </p>
              </div>
            </div>
            <button
              onClick={() => handleToggleNotificationSounds(!notifPrefs.notificationSounds)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                notifPrefs.notificationSounds ? 'bg-primary-500' : 'bg-gray-300 dark:bg-dark-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                  notifPrefs.notificationSounds ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Security */}
        <div className="card p-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Security</h2>
          
          {/* Change Password Toggle */}
          <button
            onClick={() => setShowPasswordForm(!showPasswordForm)}
            className="w-full flex items-center justify-between py-2 group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                <FiLock className="w-5 h-5 text-blue-500" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-gray-900 dark:text-white">Change Password</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Update your account password</p>
              </div>
            </div>
            <FiArrowLeft className={`w-4 h-4 text-gray-400 transition-transform ${showPasswordForm ? 'rotate-90' : '-rotate-90'}`} />
          </button>

          {showPasswordForm && (
            <form onSubmit={handleChangePassword} className="mt-4 space-y-3 pt-4 border-t border-gray-100 dark:border-dark-700">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Current Password</label>
                <div className="relative">
                  <input
                    type={showPasswords.current ? 'text' : 'password'}
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                    className="input-field text-sm pr-10"
                    placeholder="Enter current password"
                  />
                  <button type="button" onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPasswords.current ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">New Password</label>
                <div className="relative">
                  <input
                    type={showPasswords.new ? 'text' : 'password'}
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    className="input-field text-sm pr-10"
                    placeholder="Enter new password"
                  />
                  <button type="button" onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPasswords.new ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Confirm New Password</label>
                <div className="relative">
                  <input
                    type={showPasswords.confirm ? 'text' : 'password'}
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    className="input-field text-sm pr-10"
                    placeholder="Confirm new password"
                  />
                  <button type="button" onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPasswords.confirm ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={changingPassword} className="btn-primary w-full text-sm">
                {changingPassword ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          )}

          <hr className="my-3 border-gray-100 dark:border-dark-700" />

          {/* Logout from all devices */}
          <button onClick={handleLogoutAll} className="w-full flex items-center gap-3 py-3 group">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
              <FiShield className="w-5 h-5 text-orange-500" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-gray-900 dark:text-white">Logout from all devices</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Sign out everywhere</p>
            </div>
          </button>
        </div>

        {/* Account Actions */}
        <div className="card p-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Account</h2>
          
          <button onClick={logout} className="w-full flex items-center gap-3 py-3 group">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-xl group-hover:bg-red-200 dark:group-hover:bg-red-900/50 transition-colors">
              <FiLogOut className="w-5 h-5 text-red-500" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-gray-900 dark:text-white">Logout</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Sign out of this device</p>
            </div>
          </button>

          <hr className="my-2 border-gray-100 dark:border-dark-700" />

          <button onClick={handleDeleteAccount} className="w-full flex items-center gap-3 py-3 group">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-xl group-hover:bg-red-200 dark:group-hover:bg-red-900/50 transition-colors">
              <FiTrash2 className="w-5 h-5 text-red-500" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-red-600 dark:text-red-400">Delete Account</p>
              <p className="text-xs text-red-500/70">Permanently delete your account</p>
            </div>
          </button>
        </div>

        {/* App Info */}
        <div className="text-center py-4">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {APP_NAME} v{APP_VERSION}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Built with React, Node.js, MongoDB & Socket.IO
          </p>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
