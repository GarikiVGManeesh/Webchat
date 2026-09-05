import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { authAPI } from '../utils/api';
import { FiCheck, FiX, FiMail, FiLoader } from 'react-icons/fi';

const EmailVerification = () => {
  const { token } = useParams();
  const [status, setStatus] = useState('loading'); // 'loading', 'success', 'error'
  const [message, setMessage] = useState('');

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        const { data } = await authAPI.verifyEmail(token);
        setStatus('success');
        setMessage(data.message || 'Email verified successfully!');
      } catch (error) {
        setStatus('error');
        setMessage(error.message || 'Verification failed. The link may be expired or invalid.');
      }
    };

    if (token) {
      verifyEmail();
    }
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="card p-8 text-center">
          {status === 'loading' && (
            <>
              <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiLoader className="w-8 h-8 text-primary-500 animate-spin" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Verifying...</h2>
              <p className="text-gray-500 dark:text-gray-400">Please wait while we verify your email.</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiCheck className="w-8 h-8 text-green-500" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Email Verified!</h2>
              <p className="text-gray-500 dark:text-gray-400 mb-2">{message}</p>
              <p className="text-gray-400 dark:text-gray-500 text-sm mb-6">
                You can now login and start chatting.
              </p>
              <Link to="/login" className="btn-primary inline-flex items-center gap-2">
                <FiMail className="w-4 h-4" /> Go to Login
              </Link>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiX className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Verification Failed</h2>
              <p className="text-gray-500 dark:text-gray-400 mb-6">{message}</p>
              <div className="flex flex-col gap-3">
                <Link to="/login" className="btn-primary">
                  Go to Login
                </Link>
                <button
                  onClick={async () => {
                    try {
                      // Try to resend - user would need to provide email, 
                      // so redirect to login where they can request resend
                      window.location.href = '/login';
                    } catch (error) {
                      console.error(error);
                    }
                  }}
                  className="btn-secondary"
                >
                  Request New Verification Link
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailVerification;
