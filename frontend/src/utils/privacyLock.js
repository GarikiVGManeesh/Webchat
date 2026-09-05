/**
 * Privacy Lock utilities for Mahaa Verse
 *
 * - Per-device privacy PIN (salted SHA-256 hash, stored in localStorage)
 * - Optional platform biometric unlock via WebAuthn with PIN fallback
 * - "Private Notifications" preference (hide message content)
 *
 * NOTE: This protects conversations on THIS device only. It is a local privacy
 * lock — it does not replace account authentication or claim end-to-end
 * encryption of stored messages.
 */

const PIN_KEY = 'mv_privacy_pin';
const BIOMETRIC_CREDENTIAL_KEY = 'mv_biometric_credential';
const BIOMETRIC_ENABLED_KEY = 'mv_biometric_enabled';
const PRIVATE_NOTIF_KEY = 'mv_private_notifications';

const isValidPin = (pin) => /^\d{4,8}$/.test(pin || '');

// ==================== PIN ====================

const toHex = (buffer) =>
  Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

const randomHex = (bytes) => {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return toHex(arr.buffer);
};

const hashPin = async (pin, salt) => {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toHex(digest);
};

export const hasPin = () => !!localStorage.getItem(PIN_KEY);

export const setPin = async (pin) => {
  if (!isValidPin(pin)) {
    throw new Error('PIN must be 4–8 digits.');
  }
  const salt = randomHex(16);
  const hash = await hashPin(pin, salt);
  localStorage.setItem(PIN_KEY, `${salt}:${hash}`);
  return true;
};

export const verifyPin = async (pin) => {
  const stored = localStorage.getItem(PIN_KEY);
  if (!stored) return false;
  const [salt, expected] = stored.split(':');
  if (!salt || !expected) return false;
  const hash = await hashPin(pin, salt);
  return hash === expected;
};

export const changePin = async (currentPin, newPin) => {
  const ok = await verifyPin(currentPin);
  if (!ok) throw new Error('Current PIN is incorrect.');
  await setPin(newPin);
  return true;
};

// ==================== PIN ATTEMPT LIMITING (brute-force protection) ====================

const PIN_FAILURES_KEY = 'mv_pin_failures';
const PIN_LOCKED_UNTIL_KEY = 'mv_pin_locked_until';
const MAX_PIN_ATTEMPTS = 5;
const PIN_LOCKOUT_MS = 60 * 1000;

/**
 * Seconds remaining in the temporary lockout, or 0 if not locked out.
 */
export const getPinLockoutRemaining = () => {
  const until = parseInt(localStorage.getItem(PIN_LOCKED_UNTIL_KEY) || '0', 10);
  const remaining = until - Date.now();
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
};

/**
 * Record the result of a PIN attempt. After MAX_PIN_ATTEMPTS consecutive
 * failures the PIN is temporarily blocked (persisted across reloads).
 */
export const recordPinAttempt = (ok) => {
  if (ok) {
    localStorage.removeItem(PIN_FAILURES_KEY);
    localStorage.removeItem(PIN_LOCKED_UNTIL_KEY);
    return;
  }
  const failures = parseInt(localStorage.getItem(PIN_FAILURES_KEY) || '0', 10) + 1;
  if (failures >= MAX_PIN_ATTEMPTS) {
    localStorage.setItem(PIN_LOCKED_UNTIL_KEY, String(Date.now() + PIN_LOCKOUT_MS));
    localStorage.removeItem(PIN_FAILURES_KEY);
  } else {
    localStorage.setItem(PIN_FAILURES_KEY, String(failures));
  }
};

// ==================== PRIVATE NOTIFICATIONS PREFERENCE ====================

export const getPrivateNotifications = () =>
  localStorage.getItem(PRIVATE_NOTIF_KEY) === 'true';

export const setPrivateNotifications = (enabled) => {
  localStorage.setItem(PRIVATE_NOTIF_KEY, enabled ? 'true' : 'false');
  return enabled;
};

// ==================== BIOMETRIC (WebAuthn, PIN fallback) ====================

const toBase64Url = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (str) => {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

export const isBiometricAvailable = async () => {
  try {
    if (!window.PublicKeyCredential) return false;
    const supported =
      await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return !!supported;
  } catch (e) {
    return false;
  }
};

export const isBiometricEnrolled = () =>
  localStorage.getItem(BIOMETRIC_ENABLED_KEY) === 'true' &&
  !!localStorage.getItem(BIOMETRIC_CREDENTIAL_KEY);

export const enrollBiometric = async () => {
  if (!isValidPin()) throw new Error('Set a privacy PIN before enabling biometric unlock.');
  try {
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: fromBase64Url(randomHex(32)),
        rp: { name: 'Mahaa Verse' },
        user: {
          id: fromBase64Url(randomHex(16)),
          name: 'privacy-lock',
          displayName: 'Privacy Lock',
        },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
        },
        timeout: 60000,
      },
    });
    localStorage.setItem(BIOMETRIC_CREDENTIAL_KEY, credential.id);
    localStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
    return true;
  } catch (e) {
    console.error('Biometric enrollment failed:', e);
    return false;
  }
};

export const authenticateBiometric = async () => {
  const credentialId = localStorage.getItem(BIOMETRIC_CREDENTIAL_KEY);
  if (!credentialId) return false;
  try {
    await navigator.credentials.get({
      publicKey: {
        challenge: fromBase64Url(randomHex(32)),
        allowCredentials: [{ type: 'public-key', id: fromBase64Url(credentialId) }],
        userVerification: 'required',
        timeout: 60000,
      },
    });
    return true;
  } catch (e) {
    console.error('Biometric authentication failed:', e);
    return false;
  }
};

export const removeBiometric = () => {
  localStorage.removeItem(BIOMETRIC_CREDENTIAL_KEY);
  localStorage.removeItem(BIOMETRIC_ENABLED_KEY);
};