/**
 * SMS utility using Twilio
 * 
 * Setup:
 * 1. Create a free Twilio account at https://www.twilio.com/try-twilio
 * 2. Get your Account SID, Auth Token, and a Twilio phone number
 * 3. Add them to your backend/.env file
 */

const sendSMS = async ({ to, message }) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  // If Twilio is not configured, fall back to console logging
  if (!accountSid || !authToken || !fromNumber) {
    console.log(`[SMS Fallback] To: ${to} | Message: ${message}`);
    return { success: true, fallback: true };
  }

  try {
    // Using Twilio REST API directly (no extra dependency needed)
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    const params = new URLSearchParams();
    params.append('To', to);
    params.append('From', fromNumber);
    params.append('Body', message);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = await response.json();

    if (response.ok) {
      console.log(`SMS sent to ${to} | SID: ${data.sid}`);
      return { success: true, sid: data.sid };
    } else {
      console.error(`SMS failed: ${data.message || data.code}`);
      throw new Error(data.message || 'Failed to send SMS');
    }
  } catch (error) {
    console.error('SMS sending error:', error.message);
    throw error;
  }
};

module.exports = sendSMS;
