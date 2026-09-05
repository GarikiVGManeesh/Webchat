import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // Handle token expiration.
      // NOTE: we intentionally do NOT hard-redirect with window.location here.
      // A full-page reload wipes React state and, right after signup/login,
      // caused the user to be bounced back to the auth screen ("buffer then
      // start over"). Auth state is owned by AuthContext + <ProtectedRoute>,
      // which redirects via React Router once isAuthenticated flips false.
      if (error.response.status === 401) {
        const reqUrl = (error.config && error.config.url) || '';
        // Only clear the stored session for the session check itself, so an
        // incidental 401 on some resource can't log a valid user out.
        if (reqUrl.includes('/auth/me')) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      }

      // Return structured error
      return Promise.reject({
        status: error.response.status,
        message: error.response.data?.message || 'Something went wrong',
        errors: error.response.data?.errors || [],
      });
    } else if (error.request) {
      return Promise.reject({
        status: 0,
        message: 'Network error. Please check your connection.',
        errors: [],
      });
    }

    return Promise.reject({
      status: 0,
      message: error.message || 'An unexpected error occurred',
      errors: [],
    });
  }
);

// ======== AUTH API ========
export const authAPI = {
  signup: (data) => api.post('/auth/signup', data),
  login: (data) => api.post('/auth/login', data),
  sendOTP: (data) => api.post('/auth/send-otp', data),
  verifyOTP: (data) => api.post('/auth/verify-otp', data),
  requestPinReset: () => api.post('/auth/pin-reset/request'),
  validatePinResetToken: (token) => api.get('/auth/pin-reset/validate', { params: { token } }),
  completePinReset: (token) => api.post('/auth/pin-reset/complete', { token }),
  verifyEmail: (token) => api.post(`/auth/verify-email/${token}`),
  resendVerification: (data) => api.post('/auth/resend-verification', data),
  forgotPassword: (data) => api.post('/auth/forgot-password', data),
  resetPassword: (token, data) => api.put(`/auth/reset-password/${token}`, data),
  getMe: () => api.get('/auth/me'),
  updatePassword: (data) => api.put('/auth/update-password', data),
  logout: () => api.get('/auth/logout'),
  logoutAll: () => api.get('/auth/logout-all'),
};

// ======== USER API ========
export const userAPI = {
  getUsers: (params) => api.get('/users', { params }),
  getUserById: (id) => api.get(`/users/${id}`),
  updateProfile: (data) => api.put('/users/profile', data),
  updateAvatar: (formData) =>
    api.put('/users/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  removeAvatar: () => api.delete('/users/avatar'),
  blockUser: (id) => api.put(`/users/block/${id}`),
  unblockUser: (id) => api.put(`/users/unblock/${id}`),
  getBlockedUsers: () => api.get('/users/blocked'),
  updateStatus: (data) => api.put('/users/status', data),
  getFriendRequests: () => api.get('/users/requests'),
  getFriends: () => api.get('/users/friends'),
  sendFriendRequest: (id) => api.post(`/users/friend-request/${id}`),
  acceptFriendRequest: (id) => api.put(`/users/friend-request/${id}/accept`),
  rejectFriendRequest: (id) => api.put(`/users/friend-request/${id}/reject`),
  updatePublicKey: (data) => api.put('/users/public-key', data),
};

// ======== CHAT API ========
export const chatAPI = {
  getChats: () => api.get('/chats'),
  getChatById: (id) => api.get(`/chats/${id}`),
  createChat: (data) => api.post('/chats', data),
  pinChat: (id) => api.put(`/chats/pin/${id}`),
  archiveChat: (id) => api.put(`/chats/archive/${id}`),
  lockChat: (id) => api.put(`/chats/lock/${id}`),
  muteChat: (id) => api.put(`/chats/mute/${id}`),
  clearChat: (id) => api.delete(`/chats/${id}/clear`),
  deleteChat: (id) => api.delete(`/chats/${id}`),
  createGroup: (data) => api.post('/chats/group', data),
  addGroupMember: (id, data) => api.put(`/chats/group/${id}/add`, data),
  removeGroupMember: (id, data) => api.put(`/chats/group/${id}/remove`, data),
  updateGroup: (id, formData) => api.put(`/chats/group/${id}/update`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  leaveGroup: (id) => api.put(`/chats/group/${id}/leave`),
  updateVanishMode: (id, data) => api.put(`/chats/${id}/vanish`, data),
};

// ======== MESSAGE API ========
export const messageAPI = {
  getMessages: (chatId, params) => api.get(`/messages/${chatId}`, { params }),
  sendMessage: (data) => api.post('/messages', data),
  sendFileMessage: (formData) =>
    api.post('/messages/file', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  editMessage: (id, data) => api.put(`/messages/${id}`, data),
  deleteMessage: (id) => api.delete(`/messages/${id}`),
  markAsRead: (chatId) => api.put(`/messages/read/${chatId}`),
  searchMessages: (params) => api.get('/messages/search', { params }),
};

// ======== STORY API ========
export const storyAPI = {
  getStories: () => api.get('/stories'),
  createStory: (formData) =>
    api.post('/stories', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  createTextStory: (data) => api.post('/stories', data),
  viewStory: (id) => api.put(`/stories/${id}/view`),
  deleteStory: (id) => api.delete(`/stories/${id}`),
};

export default api;
