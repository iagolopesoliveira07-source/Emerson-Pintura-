import { supabase, useSharedSystem } from '../lib/supabase';
import { getStorageItem, setStorageItem } from './storageService';
import { SESSION_TOKEN_KEY } from './estadoService';

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

function useRemoteAuth() {
  return Boolean(useSharedSystem && supabase);
}

export async function isPasswordConfigured() {
  if (useRemoteAuth()) {
    const { data, error } = await supabase.rpc('senha_esta_configurada');
    if (error) throw error;
    return data === true;
  }

  const config = getAuthConfig();
  return Boolean(config?.configured && config?.passwordHash && config?.salt);
}

export function isSessionActive() {
  try {
    const active = sessionStorage.getItem(SESSION_STORAGE_KEY) === 'active';
    if (!active) return false;
    if (useRemoteAuth()) return Boolean(sessionStorage.getItem(SESSION_TOKEN_KEY));
    return true;
  } catch {
    return false;
  }
}

export function createSession() {
  sessionStorage.setItem(SESSION_STORAGE_KEY, 'active');
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
  try {
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

async function openRemoteSession(password) {
  const { data, error } = await supabase.rpc('abrir_sessao', { senha: password });
  if (error || !data) {
    throw new Error('Não foi possível abrir a sessão.');
  }
  sessionStorage.setItem(SESSION_TOKEN_KEY, data);
}

export async function setupPassword(password) {
  if (useRemoteAuth()) {
    const { data, error } = await supabase.rpc('definir_senha', { senha: password });
    if (error) throw error;
    if (data !== true) {
      const already = new Error('A senha já foi definida. Entre com essa senha.');
      already.code = 'already_configured';
      throw already;
    }
    await openRemoteSession(password);
    createSession();
    return;
  }

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
  if (useRemoteAuth()) {
    const { data, error } = await supabase.rpc('entrar_com_senha', { senha: password });
    if (error) return { error: 'Não foi possível iniciar sessão.' };
    if (data !== true) return { error: 'Senha incorreta.' };
    try {
      await openRemoteSession(password);
    } catch {
      return { error: 'Não foi possível iniciar sessão.' };
    }
    createSession();
    return { error: null };
  }

  const valid = await verifyPassword(password);

  if (!valid) {
    return { error: 'Senha incorreta.' };
  }

  createSession();
  return { error: null };
}

export async function changePassword(currentPassword, newPassword) {
  if (useRemoteAuth()) {
    const { data, error } = await supabase.rpc('alterar_senha', {
      senha_atual: currentPassword,
      senha_nova: newPassword,
    });
    if (error) return { error: 'Não foi possível alterar a senha.' };
    if (data !== true) return { error: 'Senha actual incorrecta.' };
    return { error: null };
  }

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
