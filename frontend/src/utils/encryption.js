/**
 * E2E Encryption utility using Web Crypto API
 * Uses RSA-OAEP for key exchange and AES-GCM for message encryption
 * All free, built into the browser — no paid services needed
 */

const ALGO_RSA = {
  name: 'RSA-OAEP',
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: 'SHA-256',
};

const ALGO_AES = {
  name: 'AES-GCM',
  length: 256,
};

// Convert ArrayBuffer to base64 string
const bufferToBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
};

// Convert base64 string to ArrayBuffer
const base64ToBuffer = (base64) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

/**
 * Generate an RSA key pair for the user
 * Store private key in IndexedDB, send public key to server
 */
export const generateKeyPair = async () => {
  const keyPair = await crypto.subtle.generateKey(
    ALGO_RSA,
    true, // extractable
    ['encrypt', 'decrypt']
  );

  // Export public key as base64 for sending to server
  const publicKeyBuffer = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  const publicKeyBase64 = bufferToBase64(publicKeyBuffer);

  // Export private key for local storage
  const privateKeyBuffer = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
  const privateKeyBase64 = bufferToBase64(privateKeyBuffer);

  // Store private key locally
  localStorage.setItem('e2e_private_key', privateKeyBase64);
  localStorage.setItem('e2e_public_key', publicKeyBase64);

  return { publicKey: publicKeyBase64, privateKey: privateKeyBase64 };
};

/**
 * Import a public key from base64 string
 */
export const importPublicKey = async (publicKeyBase64) => {
  const keyBuffer = base64ToBuffer(publicKeyBase64);
  return await crypto.subtle.importKey(
    'spki',
    keyBuffer,
    ALGO_RSA,
    false,
    ['encrypt']
  );
};

/**
 * Import the user's private key from localStorage
 */
export const importPrivateKey = async () => {
  const privateKeyBase64 = localStorage.getItem('e2e_private_key');
  if (!privateKeyBase64) return null;

  const keyBuffer = base64ToBuffer(privateKeyBase64);
  return await crypto.subtle.importKey(
    'pkcs8',
    keyBuffer,
    ALGO_RSA,
    false,
    ['decrypt']
  );
};

/**
 * Encrypt a message for a recipient
 * 1. Generate random AES key
 * 2. Encrypt message with AES-GCM
 * 3. Encrypt AES key with recipient's RSA public key
 */
export const encryptMessage = async (plaintext, recipientPublicKeyBase64) => {
  try {
    // Generate random AES key
    const aesKey = await crypto.subtle.generateKey(ALGO_AES, true, ['encrypt']);

    // Generate IV
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt message with AES
    const encoder = new TextEncoder();
    const encodedMessage = encoder.encode(plaintext);
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      encodedMessage
    );

    // Export AES key
    const rawAesKey = await crypto.subtle.exportKey('raw', aesKey);

    // Encrypt AES key with recipient's RSA public key
    const recipientKey = await importPublicKey(recipientPublicKeyBase64);
    const encryptedKey = await crypto.subtle.encrypt(
      { name: 'RSA-OAEP' },
      recipientKey,
      rawAesKey
    );

    return {
      ciphertext: bufferToBase64(ciphertext),
      iv: bufferToBase64(iv),
      encryptedKey: bufferToBase64(encryptedKey),
    };
  } catch (error) {
    console.error('Encryption failed:', error);
    return null;
  }
};

/**
 * Decrypt a message using the user's private key
 */
export const decryptMessage = async (encryptedData) => {
  try {
    const { ciphertext, iv, encryptedKey } = encryptedData;

    // Get private key
    const privateKey = await importPrivateKey();
    if (!privateKey) throw new Error('No private key found');

    // Decrypt AES key with RSA
    const rawAesKey = await crypto.subtle.decrypt(
      { name: 'RSA-OAEP' },
      privateKey,
      base64ToBuffer(encryptedKey)
    );

    // Import AES key
    const aesKey = await crypto.subtle.importKey(
      'raw',
      rawAesKey,
      ALGO_AES,
      false,
      ['decrypt']
    );

    // Decrypt message with AES-GCM
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBuffer(iv) },
      aesKey,
      base64ToBuffer(ciphertext)
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error);
    return '[Encrypted message - unable to decrypt]';
  }
};

/**
 * Check if encryption keys exist locally
 */
export const hasEncryptionKeys = () => {
  return !!localStorage.getItem('e2e_private_key') && !!localStorage.getItem('e2e_public_key');
};

/**
 * Get the stored public key
 */
export const getStoredPublicKey = () => {
  return localStorage.getItem('e2e_public_key') || '';
};
