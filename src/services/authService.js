import { getStorageItem, setStorageItem } from './storageService';

export const AUTH_STORAGE_KEY = 'emerson_pinturas_auth';
const SESSION_STORAGE_KEY = 'emerson_pinturas_session';

const PBKDF2_ITERATIONS = 100000;

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function generateSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

async function derivePasswordHash(password, salt) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  return toHex(derived);
}

function getAuthConfig() {
  return getStorageItem(AUTH_STORAGE_KEY, null);
}

function saveAuthConfig(config) {
  setStorageItem(AUTH_STORAGE_KEY, config);
}

export function isPasswordConfigured() {
  const config = getAuthConfig();
  return Boolean(config?.configured && config?.passwordHash && config?.salt);
}

export function isSessionActive() {
  try {
    return sessionStorage.getItem(SESSION_STORAGE_KEY) === 'active';
  } catch {
    return false;
  }
}

export function createSession() {
  sessionStorage.setItem(SESSION_STORAGE_KEY, 'active');
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
}

export async function setupPassword(password) {
  const salt = generateSalt();
  const passwordHash = await derivePasswordHash(password, salt);

  saveAuthConfig({
    configured: true,
    salt,
    passwordHash,
    configuredAt: new Date().toISOString(),
  });

  createSession();
}

export async function verifyPassword(password) {
  const config = getAuthConfig();

  if (!config?.passwordHash || !config?.salt) {
    return false;
  }

  const passwordHash = await derivePasswordHash(password, config.salt);
  return passwordHash === config.passwordHash;
}

export async function loginWithPassword(password) {
  const valid = await verifyPassword(password);

  if (!valid) {
    return { error: 'Senha incorreta.' };
  }

  createSession();
  return { error: null };
}

export async function changePassword(currentPassword, newPassword) {
  const valid = await verifyPassword(currentPassword);

  if (!valid) {
    return { error: 'Senha actual incorrecta.' };
  }

  const salt = generateSalt();
  const passwordHash = await derivePasswordHash(newPassword, salt);

  saveAuthConfig({
    configured: true,
    salt,
    passwordHash,
    configuredAt: new Date().toISOString(),
  });

  return { error: null };
}
