/**
 * Central branding config.
 * Change the app name/logo here — not across the codebase.
 * Optionally override the name at build time with VITE_APP_NAME.
 */
const envName = import.meta.env.VITE_APP_NAME;

export const APP_NAME = envName || 'Mahaa Verse';

// Wordmark parts: "Mahaa" plain + "Verse" gradient (kept in sync with APP_NAME)
const nameParts = APP_NAME.split(' ');
export const APP_NAME_MAIN = nameParts[0];
export const APP_NAME_ACCENT = nameParts.slice(1).join(' ');

export const APP_LOGO = '/mahaa-logo.svg';
export const APP_TAGLINE = 'Real-time Messenger';
export const APP_VERSION = '2.0.0';
