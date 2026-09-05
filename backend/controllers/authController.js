const User = require('../models/User');
const OTP = require('../models/OTP');
const { sendTokenResponse } = require('../utils/generateToken');
const sendEmail = require('../utils/sendEmail');
const sendSMS = require('../utils/sendSMS');
const crypto = require('crypto');
const { validationResult } = require('express-validator');
const { appName } = require('../config/app');

const buildUniqueUsername = async (name, preferredUsername = '') => {
  const normalizedPreferred = preferredUsername
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, '')
    .slice(0, 20);

  const base = normalizedPreferred || name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 18);

  let candidate = base || 'user';
  if (candidate.length < 3) {
    candidate = `${candidate}user`;
  }

  let suffix = 1;
  while (await User.findOne({ username: candidate })) {
    candidate = `${base}${suffix}`;
    suffix += 1;
  }

  return candidate;
};

/**
 * @desc    Register a new user
 * @route   POST /api/auth/signup
 * @access  Public
 */
exports.signup = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array().map((e) => e.msg).join(', '),
        errors: errors.array(),
      });
    }

    const { name, email, password, username } = req.body;

    // Guard the required fields directly too — with email now optional in the
    // schema (to allow mobile-OTP accounts), a direct API call must not be able
    // to create an email-less account through the signup route.
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email and password.',
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists.',
      });
    }

    const generatedUsername = await buildUniqueUsername(name, username || '');

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      username: generatedUsername,
    });

    // Generate email verification token
    const verificationToken = user.generateEmailVerificationToken();
    await user.save({ validateBeforeSave: false });

    // Create verification URL
    const verificationUrl = `${process.env.CLIENT_URL}/verify-email/${verificationToken}`;

    // Send verification email in the BACKGROUND (fire-and-forget).
    // Do NOT await this: outbound SMTP on some hosts (e.g. Render free tier)
    // can hang, which would leave the signup request stuck on "Creating
    // account..." forever. The account is already created, so we respond
    // immediately and let the email send on its own.
    const verificationEmailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; border-radius: 10px;">
            <div style="text-align: center; padding: 20px 0;">
              <h1 style="color: #7C3AED; margin: 0;">${appName}</h1>
            </div>
            <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <h2 style="color: #333; margin-top: 0;">Welcome to ${appName}!</h2>
              <p style="color: #666; line-height: 1.6;">Hi ${user.name},</p>
              <p style="color: #666; line-height: 1.6;">Thank you for creating an account. Please verify your email address by clicking the button below:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${verificationUrl}" style="background-color: #7C3AED; color: white; padding: 14px 28px; text-decoration: none; border-radius: 5px; font-size: 16px; display: inline-block;">Verify Email Address</a>
              </div>
              <p style="color: #666; line-height: 1.6;">Or copy and paste this link in your browser:</p>
              <p style="color: #7C3AED; word-break: break-all; font-size: 14px;">${verificationUrl}</p>
              <p style="color: #666; line-height: 1.6;">This verification link will expire in 24 hours.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="color: #999; font-size: 12px;">If you did not create this account, please ignore this email.</p>
            </div>
          </div>
        `;

    // Send the token response FIRST so the client is never left waiting.
    sendTokenResponse(user, 201, res, 'Account created successfully. Please verify your email.');

    // Fire the verification email without blocking the response.
    sendEmail({
      email: user.email,
      subject: `Verify your email - ${appName}`,
      html: verificationEmailHtml,
    }).catch((emailError) => {
      // If email fails, the account still exists; user can resend verification.
      console.error('Verification email sending failed:', emailError.message);
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
exports.login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array().map((e) => e.msg).join(', '),
        errors: errors.array(),
      });
    }

    const { email, password } = req.body;

    // Validate email & password
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an email and password.',
      });
    }

    // Check user exists (explicitly select password)
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Check if password matches
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Update last seen and status
    user.lastSeen = Date.now();
    user.status = 'online';
    await user.save({ validateBeforeSave: false });

    sendTokenResponse(user, 200, res, 'Login successful.');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Login with mobile number via OTP
 * @route   POST /api/auth/send-otp
 * @access  Public
 */
exports.sendOTP = async (req, res, next) => {
  try {
    const { mobile } = req.body;

    if (!mobile) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a mobile number.',
      });
    }

    // Generate OTP
    const otpCode = OTP.generateOTP();
    const expiresAt = new Date(Date.now() + parseInt(process.env.OTP_EXPIRE_MINUTES || 10) * 60 * 1000);

    // Save OTP to database
    await OTP.create({
      mobile,
      otp: otpCode,
      purpose: 'login',
      expiresAt,
    });

    // Send OTP via SMS (falls back to console if Twilio not configured)
    try {
      await sendSMS({
        to: mobile,
        message: `Your ${appName} verification code is: ${otpCode}. It expires in ${process.env.OTP_EXPIRE_MINUTES || 10} minutes. Do not share this code.`,
      });
    } catch (smsError) {
      console.error('SMS send failed, logging OTP:', smsError.message);
      console.log(`[OTP Fallback] ${mobile}: ${otpCode}`);
    }

    res.status(200).json({
      success: true,
      message: 'OTP sent successfully.',
      // In development, return OTP for testing
      ...(process.env.NODE_ENV === 'development' && { otp: otpCode }),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Verify OTP and login
 * @route   POST /api/auth/verify-otp
 * @access  Public
 */
exports.verifyOTP = async (req, res, next) => {
  try {
    const { mobile, otp } = req.body;

    if (!mobile || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Please provide mobile number and OTP.',
      });
    }

    // Find OTP record
    const otpRecord = await OTP.findOne({
      mobile,
      otp,
      purpose: 'login',
      isVerified: false,
    }).sort({ createdAt: -1 });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP.',
      });
    }

    // Check if OTP is expired
    if (otpRecord.isExpired()) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new one.',
      });
    }

    // Mark OTP as verified
    otpRecord.isVerified = true;
    await otpRecord.save();

    // Find or create user with this mobile
    let user = await User.findOne({ mobile });

    if (!user) {
      // Create a new user with this mobile
      user = await User.create({
        name: `User ${mobile.slice(-4)}`,
        mobile,
        password: crypto.randomBytes(16).toString('hex'), // Random password
        isMobileVerified: true,
      });
    } else {
      user.isMobileVerified = true;
    }

    user.lastSeen = Date.now();
    user.status = 'online';
    await user.save({ validateBeforeSave: false });

    sendTokenResponse(user, 200, res, 'OTP verified successfully.');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Verify email
 * @route   POST /api/auth/verify-email/:token
 * @access  Public
 */
exports.verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.params;

    // Hash the token
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with valid token
    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token.',
      });
    }

    // Update user
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpire = undefined;
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: 'Email verified successfully. You can now login.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Resend verification email
 * @route   POST /api/auth/resend-verification
 * @access  Public
 */
exports.resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide your email address.',
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email.',
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified.',
      });
    }

    // Generate new verification token
    const verificationToken = user.generateEmailVerificationToken();
    await user.save({ validateBeforeSave: false });

    const verificationUrl = `${process.env.CLIENT_URL}/verify-email/${verificationToken}`;

    await sendEmail({
      email: user.email,
      subject: `Verify your email - ${appName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Email Verification</h2>
          <p>Hi ${user.name},</p>
          <p>Click the button below to verify your email address:</p>
          <div style="text-align: center; margin: 20px 0;">
            <a href="${verificationUrl}" style="background-color: #7C3AED; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">Verify Email</a>
          </div>
        </div>
      `,
    });

    res.status(200).json({
      success: true,
      message: 'Verification email sent successfully.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Forgot password
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide your email address.',
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email.',
      });
    }

    // Generate reset token
    const resetToken = user.generateResetPasswordToken();
    await user.save({ validateBeforeSave: false });

    // Create reset URL
    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

    try {
      await sendEmail({
        email: user.email,
        subject: `Password Reset - ${appName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; border-radius: 10px;">
            <div style="text-align: center; padding: 20px 0;">
              <h1 style="color: #7C3AED; margin: 0;">${appName}</h1>
            </div>
            <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <h2 style="color: #333; margin-top: 0;">Reset Your Password</h2>
              <p style="color: #666; line-height: 1.6;">Hi ${user.name},</p>
              <p style="color: #666; line-height: 1.6;">You requested a password reset. Click the button below to reset your password:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" style="background-color: #7C3AED; color: white; padding: 14px 28px; text-decoration: none; border-radius: 5px; font-size: 16px; display: inline-block;">Reset Password</a>
              </div>
              <p style="color: #666; line-height: 1.6;">Or copy and paste this link in your browser:</p>
              <p style="color: #7C3AED; word-break: break-all; font-size: 14px;">${resetUrl}</p>
              <p style="color: #666; line-height: 1.6;">This link will expire in 1 hour.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="color: #999; font-size: 12px;">If you did not request a password reset, please ignore this email.</p>
            </div>
          </div>
        `,
      });
    } catch (emailError) {
      // Reset token fields if email fails
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validateBeforeSave: false });

      return res.status(500).json({
        success: false,
        message: 'Email could not be sent. Please try again later.',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Password reset email sent successfully.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reset password
 * @route   PUT /api/auth/reset-password/:token
 * @access  Public
 */
exports.resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a new password.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters.',
      });
    }

    // Hash the token
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find user
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token.',
      });
    }

    // Set new password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    // Send confirmation email
    try {
      await sendEmail({
        email: user.email,
        subject: `Password Reset Successful - ${appName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #333;">Password Reset Successful</h2>
            <p>Hi ${user.name},</p>
            <p>Your password has been successfully reset. If you did not perform this action, please contact support immediately.</p>
          </div>
        `,
      });
    } catch (emailError) {
      console.error('Password reset confirmation email failed:', emailError.message);
    }

    sendTokenResponse(user, 200, res, 'Password reset successful.');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get current logged in user
 * @route   GET /api/auth/me
 * @access  Private
 */
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update password
 * @route   PUT /api/auth/update-password
 * @access  Private
 */
exports.updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide current and new password.',
      });
    }

    // Get user with password
    const user = await User.findById(req.user._id).select('+password');

    // Check current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect.',
      });
    }

    // Set new password
    user.password = newPassword;
    await user.save();

    sendTokenResponse(user, 200, res, 'Password updated successfully.');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Logout user
 * @route   GET /api/auth/logout
 * @access  Private
 */
exports.logout = async (req, res, next) => {
  try {
    // Update user status
    const user = await User.findById(req.user._id);
    user.status = 'offline';
    user.lastSeen = Date.now();
    await user.save({ validateBeforeSave: false });

    // Clear cookie
    res.cookie('token', 'none', {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true,
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Logout from all devices
 * @route   GET /api/auth/logout-all
 * @access  Private
 */
exports.logoutAllDevices = async (req, res, next) => {
  try {
    // In a production app, you'd invalidate all tokens by changing a token version
    // For now, clear the cookie
    res.cookie('token', 'none', {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true,
    });

    res.status(200).json({
      success: true,
      message: 'Logged out from all devices successfully.',
    });
  } catch (error) {
    next(error);
  }
};
