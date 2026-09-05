import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { isValidEmail } from '../../utils/helpers';
import { FiMail, FiLock, FiEye, FiEyeOff, FiPhone } from 'react-icons/fi';
import CountryCodeSelect from '../common/CountryCodeSelect';

const Login = () => {
  const navigate = useNavigate();
  const { login, sendOTP, verifyOTP } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginMode, setLoginMode] = useState('email'); // 'email' or 'mobile'
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    mobile: '',
    otp: '',
  });
  const [showOTPInput, setShowOTPInput] = useState(false);
  const [errors, setErrors] = useState({});
  const [countryCode, setCountryCode] = useState('+91');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: '' });
  };

  const validateEmailForm = () => {
    const newErrors = {};
    if (!formData.email) newErrors.email = 'Email is required';
    else if (!isValidEmail(formData.email)) newErrors.email = 'Invalid email address';
    if (!formData.password) newErrors.password = 'Password is required';
    else if (formData.password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    if (!validateEmailForm()) return;

    setLoading(true);
    try {
      await login({ email: formData.email, password: formData.password });
      toast.success('Welcome back!');
      navigate('/chats', { replace: true });
    } catch (error) {
      toast.error(error.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in-up">
        {/* Logo */}
        <div className="text-center mb-8 animate-fade-in-down">
          <div className="inline-flex items-center justify-center w-16 h-16 glass rounded-3xl mb-4 shadow-lg shadow-primary-500/20 animate-float hover-glow">
            <img src="/echo-logo.svg" alt="Echo" className="w-11 h-11" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Welcome Back</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Sign in to continue chatting</p>
        </div>

        {/* Login Mode Tabs */}
        <div className="flex mb-6 glass rounded-2xl p-1">
          <button
            onClick={() => { setLoginMode('email'); setShowOTPInput(false); }}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
              loginMode === 'email'
                ? 'bg-white/80 dark:bg-white/10 text-primary-600 dark:text-primary-300 shadow-md'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300'
            }`}
          >
            <FiMail className="inline mr-2" /> Email
          </button>
          <button
            onClick={() => setLoginMode('mobile')}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
              loginMode === 'mobile'
                ? 'bg-white/80 dark:bg-white/10 text-primary-600 dark:text-primary-300 shadow-md'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300'
            }`}
          >
            <FiPhone className="inline mr-2" /> Mobile
          </button>
        </div>

        {/* Email Login Form */}
        {loginMode === 'email' && (
          <form onSubmit={handleEmailLogin} className="card p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  name="email"
                  id="login-email"
                  autoComplete="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  className={`input-field pl-10 ${errors.email ? 'border-red-500 focus:ring-red-500' : ''}`}
                />
              </div>
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  id="login-password"
                  autoComplete="current-password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  className={`input-field pl-10 pr-10 ${errors.password ? 'border-red-500 focus:ring-red-500' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
            </div>

            <div className="flex items-center justify-end">
              <Link
                to="/forgot-password"
                className="text-sm text-primary-500 hover:text-primary-600 font-medium"
              >
                Forgot Password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>

            <div className="text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Don&apos;t have an account?{' '}
                <Link to="/signup" className="text-primary-500 hover:text-primary-600 font-medium">
                  Sign Up
                </Link>
              </p>
            </div>
          </form>
        )}

        {/* Mobile Login */}
        {loginMode === 'mobile' && (
          <div className="card p-6 space-y-5">
            {!showOTPInput ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Mobile Number
                  </label>
                  <div className="flex">
                    <CountryCodeSelect value={countryCode} onChange={setCountryCode} />
                    <input
                      type="tel"
                      name="mobile"
                      id="login-mobile"
                      autoComplete="tel"
                      value={formData.mobile}
                      onChange={handleChange}
                      placeholder="9876543210"
                      className="input-field rounded-l-none border-l-0 flex-1"
                    />
                  </div>
                </div>
                <button
                  onClick={async () => {
                    if (!formData.mobile) {
                      toast.error('Please enter your mobile number');
                      return;
                    }
                    setLoading(true);
                    try {
                      const fullMobile = `${countryCode}${formData.mobile.replace(/^0+/, '')}`;
                      await sendOTP(fullMobile);
                      setShowOTPInput(true);
                      toast.success('OTP sent successfully!');
                    } catch (error) {
                      toast.error(error.message || 'Failed to send OTP');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading || !formData.mobile}
                  className="btn-primary w-full"
                >
                  {loading ? 'Sending OTP...' : 'Send OTP'}
                </button>
              </>
            ) : (
              <>
                <div className="text-center mb-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Enter the OTP sent to {countryCode} {formData.mobile}
                  </p>
                </div>
                <div>
                  <input
                    type="text"
                    name="otp"
                    id="login-otp"
                    autoComplete="one-time-code"
                    value={formData.otp}
                    onChange={handleChange}
                    placeholder="Enter 6-digit OTP"
                    maxLength={6}
                    className="input-field text-center text-2xl tracking-widest"
                  />
                </div>
                <button
                  onClick={async () => {
                    if (!formData.otp || formData.otp.length < 6) {
                      toast.error('Please enter valid OTP');
                      return;
                    }
                    setLoading(true);
                    try {
                      const fullMobile = `${countryCode}${formData.mobile.replace(/^0+/, '')}`;
                      await verifyOTP({ mobile: fullMobile, otp: formData.otp });
                      toast.success('Login successful!');
                      navigate('/chats', { replace: true });
                    } catch (error) {
                      toast.error(error.message || 'Invalid OTP');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                  className="btn-primary w-full"
                >
                  {loading ? 'Verifying...' : 'Verify & Login'}
                </button>
                <button
                  onClick={() => { setShowOTPInput(false); setFormData({ ...formData, otp: '' }); }}
                  className="btn-secondary w-full"
                >
                  Change Number
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
