const crypto = require('crypto');
const User = require('../models/User');
const PinResetToken = require('../models/PinResetToken');
const sendEmail = require('../utils/sendEmail');
const { appName } = require('../config/app');

const TOKEN_TTL_MINUTES = 15;
const RESEND_COOLDOWN_MS = 2 * 60 * 1000; // one reset link per user per 2 minutes

/**
 * Mask an email address for display, e.g. maneesh@gmail.com -> m******h@gmail.com
 */
const maskEmail = (email) => {
  if (!email || !email.includes('@')) return '';
  const [userPart, domain] = email.split('@');
  if (userPart.length <= 2) {
    return `${userPart[0]}${'*'.repeat(Math.max(1, userPart.length - 1))}@${domain}`;
  }
  return `${userPart[0]}${'*'.repeat(userPart.length - 2)}${userPart[userPart.length - 1]}@${domain}`;
};

/**
 * @desc    Request a Privacy PIN reset link.
 *          The link is emailed to the user's REGISTERED SIGNUP email (from the
 *          authenticated account) — the frontend never supplies an address.
 * @route   POST /api/auth/pin-reset/request
 * @access  Private
 */
exports.requestPinReset = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Rate limit: at most one reset link per user per cooldown window.
    const recent = await PinResetToken.findOne({
      user: user._id,
      createdAt: { $gt: new Date(Date.now() - RESEND_COOLDOWN_MS) },
    });
    if (recent) {
      return res.status(429).json({
        success: false,
        message:
          'A reset link was already sent recently. Please check your inbox and try again in a couple of minutes.',
      });
    }

    // Drop any stale tokens for this user, then mint a fresh one.
    await PinResetToken.deleteMany({ user: user._id });

    // Secure random single-use token; only its hash is stored.
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    await PinResetToken.create({
      user: user._id,
      tokenHash,
      expiresAt: new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000),
    });

    const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-privacy-pin?token=${rawToken}`;

    try {
      await sendEmail({
        email: user.email, // the account's registered signup email
        subject: `${appName} \u2013 Reset Your Privacy PIN`,
        message: [
          `Hello,`,
          ``,
          `We received a request to reset your ${appName} Privacy PIN.`,
          `Click the link below to create a new Privacy PIN:`,
          `${resetUrl}`,
          ``,
          `This link will expire in ${TOKEN_TTL_MINUTES} minutes.`,
          `If you did not request this reset, you can safely ignore this email.`,
          `For your security, never share this link with anyone.`,
          ``,
          `\u2014 ${appName} Security Team`,
        ].join('\n'),
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f6f1fb; border-radius: 12px;">
            <div style="text-align: center; padding: 20px 0;">
              <h1 style="color: #7C3AED; margin: 0;">${appName}</h1>
            </div>
            <div style="background-color: #ffffff; padding: 30px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.08);">
              <h2 style="color: #333; margin-top: 0;">Reset Your Privacy PIN</h2>
              <p style="color: #666; line-height: 1.6;">Hello,</p>
              <p style="color: #666; line-height: 1.6;">We received a request to reset your ${appName} Privacy PIN. Click the button below to create a new Privacy PIN:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" style="background-color: #7C3AED; color: white; padding: 14px 28px; text-decoration: none; border-radius: 9999px; font-size: 16px; display: inline-block;">Reset Privacy PIN</a>
              </div>
              <p style="color: #666; line-height: 1.6;">Or copy and paste this link in your browser:</p>
              <p style="color: #7C3AED; word-break: break-all; font-size: 13px;">${resetUrl}</p>
              <p style="color: #666; line-height: 1.6;">This link will expire in ${TOKEN_TTL_MINUTES} minutes.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="color: #999; font-size: 12px; line-height: 1.6;">
                If you did not request this reset, you can safely ignore this email.<br>
                For your security, never share this link with anyone.
              </p>
            </div>
            <p style="text-align: center; color: #999; font-size: 12px; margin-top: 16px;">&mdash; ${appName} Security Team</p>
          </div>
        `,
      });
    } catch (emailError) {
      // Development-only fallback: without SMTP credentials the email cannot be
      // sent, so log the link to the server console to keep the flow testable.
      // The token is kept so the link actually works. NEVER exposed outside
      // development.
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Privacy PIN Reset Link] ${user.email}: ${resetUrl}`);
        return res.status(200).json({
          success: true,
          message:
            'Development mode: the reset email could not be sent, so the reset link was printed to the server console.',
          maskedEmail: maskEmail(user.email),
          resetLink: resetUrl,
        });
      }

      // Production: an undeliverable link must never be usable later — remove
      // the token and report the real failure (no fake success).
      await PinResetToken.deleteMany({ user: user._id });
      return res.status(500).json({
        success: false,
        message: 'Could not send the reset email. Please try again later.',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Reset link sent to your registered email.',
      maskedEmail: maskEmail(user.email),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Validate a Privacy PIN reset token (used by the reset page on load)
 * @route   GET /api/auth/pin-reset/validate?token=...
 * @access  Public
 */
exports.validatePinResetToken = async (req, res, next) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ success: false, valid: false, message: 'Missing reset token.' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const record = await PinResetToken.findOne({ tokenHash }).populate('user', 'email');

    const valid = !!record && !record.used && record.expiresAt > new Date();
    if (!valid) {
      return res.status(200).json({ success: true, valid: false });
    }

    res.status(200).json({
      success: true,
      valid: true,
      maskedEmail: maskEmail(record.user.email),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Consume a Privacy PIN reset token after the user has set a new PIN.
 *          The new PIN itself is stored on the user's device (salted SHA-256) —
 *          it never reaches the server. The token simply authorizes the reset.
 * @route   POST /api/auth/pin-reset/complete
 * @access  Public (possession of the unguessable token is the credential)
 */
exports.completePinReset = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Missing reset token.' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const record = await PinResetToken.findOne({ tokenHash });

    if (!record || record.used || record.expiresAt <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'This reset link is invalid or has expired.',
      });
    }

    // Single-use: consume the token immediately so it can never be reused.
    record.used = true;
    await record.save();

    res.status(200).json({
      success: true,
      message: 'Privacy PIN reset complete.',
    });
  } catch (error) {
    next(error);
  }
};