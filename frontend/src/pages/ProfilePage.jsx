import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getInitials, stringToColor } from '../utils/helpers';
import ThemeToggle from '../components/common/ThemeToggle';
import toast from 'react-hot-toast';
import {
  FiArrowLeft,
  FiCamera,
  FiUser,
  FiMail,
  FiPhone,
  FiEdit2,
  FiSave,
  FiX,
  FiMessageSquare,
} from 'react-icons/fi';

const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, updateProfile, updateAvatar } = useAuth();
  const fileInputRef = useRef(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingName, setEditingName] = useState(user?.name || '');
  const [editingBio, setEditingBio] = useState(user?.bio || '');
  const [editingUsername, setEditingUsername] = useState(user?.username || '');
  const [editingMobile, setEditingMobile] = useState(user?.mobile || '');
  const [uploading, setUploading] = useState(false);

  const handleSaveProfile = async () => {
    if (!editingName.trim()) {
      toast.error('Name cannot be empty');
      return;
    }

    try {
      await updateProfile({
        name: editingName.trim(),
        username: editingUsername.trim(),
        bio: editingBio.trim(),
        mobile: editingMobile.trim(),
      });
      toast.success('Profile updated!');
      setIsEditing(false);
    } catch (error) {
      toast.error(error.message || 'Failed to update profile');
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      await updateAvatar(formData);
      toast.success('Avatar updated!');
    } catch (error) {
      toast.error(error.message || 'Failed to update avatar');
    } finally {
      setUploading(false);
    }
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

      <div className="max-w-2xl mx-auto p-4">
        {/* Profile Card */}
        <div className="card p-8 text-center">
          {/* Avatar */}
          <div className="relative inline-block mb-6">
            {uploading ? (
              <div className="w-28 h-28 rounded-full bg-gray-200 dark:bg-dark-700 flex items-center justify-center">
                <svg className="animate-spin h-8 w-8 text-primary-500" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            ) : user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="w-28 h-28 rounded-full object-cover border-4 border-white dark:border-dark-700 shadow-lg"
              />
            ) : (
              <div
                className="w-28 h-28 rounded-full flex items-center justify-center text-white text-3xl font-bold border-4 border-white dark:border-dark-700 shadow-lg"
                style={{ backgroundColor: stringToColor(user?.name) }}
              >
                {getInitials(user?.name)}
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 p-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-full shadow-lg transition-all"
            >
              <FiCamera className="w-4 h-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </div>

          {/* Name & Bio */}
          {isEditing ? (
            <div className="space-y-4 max-w-md mx-auto text-left">
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">Display Name</label>
                <div className="relative">
                  <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="input-field pl-10 font-semibold"
                    placeholder="Your name"
                    autoFocus
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">Username</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">@</span>
                  <input
                    type="text"
                    value={editingUsername}
                    onChange={(e) => setEditingUsername(e.target.value)}
                    className="input-field pl-8"
                    placeholder="username"
                    maxLength={20}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">Bio</label>
                <textarea
                  value={editingBio}
                  onChange={(e) => setEditingBio(e.target.value)}
                  className="input-field resize-none"
                  rows={2}
                  placeholder="Write something about yourself..."
                  maxLength={200}
                />
                <p className="text-xs text-gray-400 text-right mt-1">{editingBio.length}/200</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">Mobile Number</label>
                <div className="relative">
                  <FiPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="tel"
                    value={editingMobile}
                    onChange={(e) => setEditingMobile(e.target.value)}
                    className="input-field pl-10"
                    placeholder="+91 98765 43210"
                    maxLength={15}
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-center pt-2">
                <button onClick={handleSaveProfile} className="btn-primary flex items-center gap-2">
                  <FiSave className="w-4 h-4" /> Save
                </button>
                <button onClick={() => { setIsEditing(false); setEditingName(user?.name || ''); setEditingBio(user?.bio || ''); setEditingUsername(user?.username || ''); setEditingMobile(user?.mobile || ''); }} className="btn-secondary flex items-center gap-2">
                  <FiX className="w-4 h-4" /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {user?.name}
              </h1>
              <p className="text-sm text-primary-500 dark:text-primary-400 font-medium mb-2">
                @{user?.username || 'set-your-username'}
              </p>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                {user?.bio || 'No bio set'}
              </p>
              <button
                onClick={() => setIsEditing(true)}
                className="btn-outline inline-flex items-center gap-2 text-sm"
              >
                <FiEdit2 className="w-4 h-4" /> Edit Profile
              </button>
            </div>
          )}
        </div>

        {/* Info Cards */}
        <div className="card divide-y divide-gray-100 dark:divide-dark-700 mt-4">
          <div className="flex items-center gap-4 p-4">
            <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
              <FiMail className="w-5 h-5 text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-400 uppercase tracking-wider">Email</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user?.email}</p>
            </div>
            {user?.isEmailVerified ? (
              <span className="text-xs text-green-500 font-medium bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded-full">Verified</span>
            ) : (
              <span className="text-xs text-yellow-500 font-medium bg-yellow-50 dark:bg-yellow-900/30 px-2 py-1 rounded-full">Pending</span>
            )}
          </div>

          <div className="flex items-center gap-4 p-4">
            <div className="p-2.5 bg-green-100 dark:bg-green-900/30 rounded-xl">
              <FiPhone className="w-5 h-5 text-green-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-400 uppercase tracking-wider">Mobile</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {user?.mobile || 'Not set'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-4">
            <div className="p-2.5 bg-primary-100 dark:bg-primary-900/30 rounded-xl">
              <FiUser className="w-5 h-5 text-primary-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-400 uppercase tracking-wider">Member Since</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Unknown'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
