const nodemailer = require('nodemailer');

/**
 * Send an email using Nodemailer
 * @param {Object} options - Email options
 * @param {string} options.email - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.message - Plain text message
 * @param {string} options.html - HTML content (optional)
 */
const sendEmail = async (options) => {
  try {
    // Create transporter using Gmail service
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      // Timeouts so a blocked/slow SMTP connection can never hang forever
      // (important on hosts that throttle outbound SMTP, e.g. Render free tier).
      connectionTimeout: 10000, // 10s to establish the connection
      greetingTimeout: 10000,   // 10s to receive the SMTP greeting
      socketTimeout: 15000,     // 15s of socket inactivity
    });

    // Email options
    const mailOptions = {
      from: `"${process.env.FROM_NAME || 'Echo'}" <${process.env.FROM_EMAIL}>`,
      to: options.email,
      subject: options.subject,
      text: options.message,
      html: options.html || '',
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error('Email sending failed:', error.message);
    throw new Error('Email could not be sent. Please try again later.');
  }
};

module.exports = sendEmail;
