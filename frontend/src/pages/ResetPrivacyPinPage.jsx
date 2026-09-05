import { APP_NAME, APP_LOGO } from '../config';
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { authAPI } from '../utils/api';
import { setPin, recordPinAttempt } from '../utils/privacyLock';
import toast from 'react-hot-toast';
import {
  FiLock,
  FiCheckCircle,
  FiAlertCircle,
  FiArrowLeft,
} from 'react-icons/fi';

/**
 * Landing page for the "Forgot Privacy PIN?" email link:
 * /reset-privacy-pin?token=SECURE_TOKEN
 *
 * The token is validated against the backend (single-use, 15-minute expiry,
 * tied to the requesting user). The new PIN itself is stored on-device with a
 * salted SHA-256 hash — it never reaches the server.
 */
const ResetPrivacyPinPage = () => {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();

  const [status, setStatus] = useState('loading'); // loading | invalid | ready | success
  const [masked, setMasked] = useState('');
  const [pin, setPinValue] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  // Validate the token once on load.
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!token) {
        setStatus('invalid');
        return;
      }
      try {
        const res = await authAPI.validatePinResetToken(token);
        if (mounted && res?.data?.valid) {
          setMasked(res.data.maskedEmail || '');
          setStatus('ready');
        } else if (mounted) {
          setStatus('invalid');
        }
      } catch (err) {
        if (mounted) {
          // Network hiccup vs genuinely bad token: let them retry once, then
          // treat any failure as invalid rather than looping.
          setStatus('invalid');
          if (err.message) toast.error(err.message);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!/^\d{4,8}$/.test(pin)) {
      toast.error('PIN must be 4–8 digits.');
      return;
    }
    if (pin !== confirm) {
      toast.error('PINs do not match.');
      return;
    }
    setBusy(true);
    try {
      // Consume the token server-side first; only then store the new PIN on
      // this device. Old PIN stops working immediately (its hash is replaced).
      await authAPI.completePinReset(token);
      await setPin(pin);
      recordPinAttempt(true); // clear any temporary lockout
      setStatus('success');
    } catch (err) {
      if (err.status === 400) {
        setStatus('invalid');
      } else {
        toast.error(err.message || 'This reset link is invalid or has expired.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 glass rounded-3xl mb-4 shadow-lg shadow-primary-500/20">
            <img src={APP_LOGO} alt={APP_NAME} className="w-11 h-11" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Reset Your Privacy PIN
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            Create a new PIN for your {APP_NAME} private conversations.
          </p>
        </div>

        {status === 'loading' && (
          <div className="card p-8 text-center">
            <div className="w-12 h-12 mx-auto rounded-full border-4 border-primary-500/20 border-t-primary-500 animate-spin mb-4" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Verifying your reset link…</p>
          </div>
        )}

        {status === 'invalid' && (
          <div className="card p-8 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-red-500/15 text-red-500 flex items-center justify-center mb-5">
              <FiAlertCircle className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              This reset link is invalid or has expired.
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Reset links are single-use and expire after 15 minutes. Request a
              fresh link from a locked conversation to continue.
            </p>
            <button
              onClick={() => navigate('/chats')}
              className="btn-primary w-full text-sm"
            >
              Request New Reset Link
            </button>
            <div className="text-center mt-4">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-primary-500"
              >
                <FiArrowLeft /> Back to Login
              </Link>
            </div>
          </div>
        )}

        {status === 'ready' && (
          <form onSubmit={handleSubmit} className="card p-6 space-y-5">
            {masked && (
              <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                Resetting the PIN for <span className="font-semibold text-primary-600 dark:text-primary-300">{masked}</span>
              </p>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                New Privacy PIN
              </label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="new-password"
                  maxLength={8}
                  value={pin}
                  onChange={(e) => {
                    setPinValue(e.target.value.replace(/\D/g, ''));
                  }}
                  placeholder="4–8 digits"
                  className="input-field pl-10 text-center tracking-[0.4em]"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Confirm New Privacy PIN
              </label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="new-password"
                  maxLength={8}
                  value={confirm}
                  onChange={(e) => {
                    setConfirm(e.target.value.replace(/\D/g, ''));
                  }}
                  placeholder="Repeat your PIN"
                  className="input-field pl-10 text-center tracking-[0.4em]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {busy ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Resetting...
                </>
              ) : (
                'Reset Privacy PIN'
              )}
            </button>

            <div className="text-center">
              <Link
                to="/chats"
                className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-primary-500"
              >
                <FiArrowLeft /> Back to Mahaa Verse
              </Link>
            </div>
          </form>
        )}

        {status === 'success' && (
          <div className="card p-8 text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-green-500/15 text-green-500 flex items-center justify-center mb-5">
              <FiCheckCircle className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              Privacy PIN Reset Successfully
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Your new Privacy PIN is now active. Use it to unlock your locked
              conversations.
            </p>
            <button
              onClick={() => navigate('/chats')}
              className="btn-primary w-full text-sm"
            >
              Continue to {APP_NAME}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResetPrivacyPinPage;