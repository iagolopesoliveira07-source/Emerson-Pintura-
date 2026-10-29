import STORAGE_KEYS, { removeStorageItem, setStorageItem } from './storageService';
import { supabase } from '../lib/supabase';

export const SESSION_TOKEN_KEY = 'emerson_pinturas_session_token';

export const SYNC_KEYS = [
  STORAGE_KEYS.obras,
  STORAGE_KEYS.funcionarios,
  STORAGE_KEYS.diarias,
  STORAGE_KEYS.adiantamentos,
  STORAGE_KEYS.emprestimos,
  STORAGE_KEYS.valoresAcerto,
  STORAGE_KEYS.valoresAcertoMigrated,
  STORAGE_KEYS.fechamentosPagamento,
  STORAGE_KEYS.gastos,
  STORAGE_KEYS.gastosEmpresa,
  STORAGE_KEYS.gastosEmpresaCategorias,
  STORAGE_KEYS.empresaVeiculos,
  STORAGE_KEYS.empresaDespesasProgramadas,
  STORAGE_KEYS.empresaValoresRecuperar,
  STORAGE_KEYS.empresaFinanceiroSeedKeys,
  STORAGE_KEYS.empresaFornecedores,
  STORAGE_KEYS.empresaIvaRegras,
  STORAGE_KEYS.ivaEntregar,
  STORAGE_KEYS.pagamentos,
  STORAGE_KEYS.hotelDommeControles,
  STORAGE_KEYS.configuracoes,
  STORAGE_KEYS.initialized,
  STORAGE_KEYS.aptoTaviraSeeded,
  STORAGE_KEYS.domesLakeHotelSeeded,
];

function readSessionToken() {
  try {
    return sessionStorage.getItem(SESSION_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function collectLocalEstado() {
  const payload = {};
  SYNC_KEYS.forEach((key) => {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return;
      payload[key] = JSON.parse(raw);
    } catch {
      /* chave ilegível fica de fora desta cópia */
    }
  });
  return payload;
}

export function applyEstadoLocal(payload) {
  if (!payload || typeof payload !== 'object') return false;
  SYNC_KEYS.forEach((key) => {
    if (payload[key] !== undefined) setStorageItem(key, payload[key]);
    else removeStorageItem(key);
  });
  setStorageItem(STORAGE_KEYS.initialized, true);
  return true;
}

export function estadoTemDados(payload) {
  if (!payload || typeof payload !== 'object') return false;
  return SYNC_KEYS.some((key) => {
    const value = payload[key];
    if (Array.isArray(value)) return value.length > 0;
    if (value && typeof value === 'object') return Object.keys(value).length > 0;
    return value != null && value !== false;
  });
}

export async function lerEstadoRemoto() {
  const token = readSessionToken();
  if (!token || !supabase) return null;
  const { data, error } = await supabase.rpc('ler_estado', { token });
  if (error) throw error;
  if (!data || typeof data !== 'object') return null;
  return data;
}

export async function guardarEstadoRemoto(payload) {
  const token = readSessionToken();
  if (!token || !supabase) return false;
  const { error } = await supabase.rpc('guardar_estado', { token, payload });
  if (error) throw error;
  return true;
}
