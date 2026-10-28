import STORAGE_KEYS, { getStorageItem, setStorageItem, DATA_STORAGE_KEYS } from '../storageService';
import { countObras, bulkInsertAll } from './dataRepository';

const MIGRATION_FLAG = 'ep_migrated_to_supabase';

export function getLocalBusinessData() {
  return {
    obras: getStorageItem(STORAGE_KEYS.obras, []),
    funcionarios: getStorageItem(STORAGE_KEYS.funcionarios, []),
    diarias: getStorageItem(STORAGE_KEYS.diarias, []),
    adiantamentos: getStorageItem(STORAGE_KEYS.adiantamentos, []),
    emprestimos: getStorageItem(STORAGE_KEYS.emprestimos, []),
    gastos: getStorageItem(STORAGE_KEYS.gastos, []),
    pagamentos: getStorageItem(STORAGE_KEYS.pagamentos, []),
  };
}

export function hasLocalBusinessData() {
  return DATA_STORAGE_KEYS.some((key) => {
    const items = getStorageItem(key, []);
    return Array.isArray(items) && items.length > 0;
  });
}

export function isMigrationCompleted() {
  return Boolean(getStorageItem(MIGRATION_FLAG, false));
}

export function markMigrationCompleted() {
  setStorageItem(MIGRATION_FLAG, true);
}

export function clearLocalBusinessData() {
  DATA_STORAGE_KEYS.forEach((key) => setStorageItem(key, []));
}

export async function shouldMigrateToSupabase(empresaId) {
  if (isMigrationCompleted()) return false;
  if (!hasLocalBusinessData()) return false;

  const remoteCount = await countObras(empresaId);
  return remoteCount === 0;
}

export async function migrateLocalStorageToSupabase(empresaId) {
  const localData = getLocalBusinessData();

  await bulkInsertAll(empresaId, localData);

  markMigrationCompleted();
  clearLocalBusinessData();

  return localData;
}
