import STORAGE_KEYS, {
  DATA_STORAGE_KEYS,
  BACKUP_ARCHIVE_KEY,
  getStorageItem,
  setStorageItem,
  removeStorageItem,
  compactBackupArchive,
} from './storageService';

export const BACKUP_APP_ID = 'emerson-pinturas';
export const BACKUP_VERSION = 1;
export { BACKUP_ARCHIVE_KEY } from './storageService';
export const BACKUP_META_KEY = 'ep_backup_meta';
export const PENDING_RESTORE_KEY = 'ep_pending_restore';

const BACKUP_DATA_KEYS = [
  ...DATA_STORAGE_KEYS,
  STORAGE_KEYS.hotelDommeControles,
  STORAGE_KEYS.configuracoes,
  STORAGE_KEYS.valoresAcertoMigrated,
  STORAGE_KEYS.initialized,
  STORAGE_KEYS.auth,
];

function readKey(key) {
  const raw = localStorage.getItem(key);
  if (raw == null) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function collectData() {
  const data = {};
  BACKUP_DATA_KEYS.forEach((key) => {
    const value = readKey(key);
    if (value !== undefined) data[key] = value;
  });
  return data;
}

function countCollection(value) {
  return Array.isArray(value) ? value.length : value == null ? 0 : 1;
}

export function summarizeBackupData(data = {}) {
  return {
    obras: countCollection(data[STORAGE_KEYS.obras]),
    funcionarios: countCollection(data[STORAGE_KEYS.funcionarios]),
    diarias: countCollection(data[STORAGE_KEYS.diarias]),
    pagamentos: countCollection(data[STORAGE_KEYS.pagamentos]),
    gastos: countCollection(data[STORAGE_KEYS.gastos]),
    gastosEmpresa: countCollection(data[STORAGE_KEYS.gastosEmpresa]),
    gastosEmpresaCategorias: Array.isArray(data[STORAGE_KEYS.gastosEmpresaCategorias]?.grupos)
      ? data[STORAGE_KEYS.gastosEmpresaCategorias].grupos.reduce(
          (sum, grupo) => sum + (grupo.categorias || []).length,
          0
        )
      : 0,
    empresaVeiculos: countCollection(data[STORAGE_KEYS.empresaVeiculos]),
    empresaDespesasProgramadas: countCollection(data[STORAGE_KEYS.empresaDespesasProgramadas]),
    empresaValoresRecuperar: countCollection(data[STORAGE_KEYS.empresaValoresRecuperar]),
    adiantamentos: countCollection(data[STORAGE_KEYS.adiantamentos]),
    emprestimos: countCollection(data[STORAGE_KEYS.emprestimos]),
  };
}

export function buildBackupPayload(type = 'manual') {
  const createdAt = new Date().toISOString();
  const data = collectData();
  const serialized = JSON.stringify(data);
  const parsed = JSON.parse(serialized);

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Não foi possível montar o backup.');
  }

  return {
    app: BACKUP_APP_ID,
    version: BACKUP_VERSION,
    type,
    createdAt,
    summary: summarizeBackupData(parsed),
    data: parsed,
  };
}

export function validateBackupPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, error: 'Ficheiro de backup inválido.' };
  }
  if (payload.app !== BACKUP_APP_ID) {
    return { ok: false, error: 'Este ficheiro não pertence ao Emerson Pinturas.' };
  }
  if (!payload.data || typeof payload.data !== 'object') {
    return { ok: false, error: 'O backup não contém dados recuperáveis.' };
  }
  if (!Array.isArray(payload.data[STORAGE_KEYS.funcionarios]) && payload.data[STORAGE_KEYS.funcionarios] != null) {
    return { ok: false, error: 'O backup de funcionários está incompleto.' };
  }
  return { ok: true, error: null };
}

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function formatBackupFilename(createdAt) {
  const safe = createdAt.replace(/[:.]/g, '-');
  return `emerson-pinturas-backup-${safe}.json`;
}

function listArchive() {
  const archive = getStorageItem(BACKUP_ARCHIVE_KEY, []);
  return Array.isArray(archive) ? archive : [];
}

function toArchiveMeta(payload, id) {
  return {
    id,
    type: payload.type,
    createdAt: payload.createdAt,
    summary: payload.summary,
    app: payload.app,
    version: payload.version,
  };
}

function saveArchive(archive) {
  compactBackupArchive();
  const ok = setStorageItem(BACKUP_ARCHIVE_KEY, archive);
  if (!ok) throw new Error('Não foi possível guardar a cópia no navegador. O ficheiro descarregado continua válido.');
}

export function listBackups() {
  return listArchive()
    .slice()
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export function createManualBackup() {
  const payload = buildBackupPayload('manual');
  downloadJson(formatBackupFilename(payload.createdAt), payload);

  try {
    const archive = listArchive();
    archive.push(toArchiveMeta(payload, `${Date.now()}-manual`));
    saveArchive(archive);
  } catch (error) {
    return {
      payload,
      archived: false,
      warning: error.message,
    };
  }

  return { payload, archived: true, warning: null };
}

export function runAutomaticBackupIfDue(now = new Date()) {
  const meta = getStorageItem(BACKUP_META_KEY, {}) || {};
  const lastAutoAt = meta.lastAutoAt ? new Date(meta.lastAutoAt) : null;
  const elapsed = lastAutoAt ? now.getTime() - lastAutoAt.getTime() : Infinity;
  const oneDay = 24 * 60 * 60 * 1000;

  if (elapsed < oneDay) {
    return { created: false, reason: 'ainda-valido' };
  }

  try {
    const payload = buildBackupPayload('auto');
    const archive = listArchive();
    archive.push(toArchiveMeta(payload, `${Date.now()}-auto`));
    saveArchive(archive);
    setStorageItem(BACKUP_META_KEY, { ...meta, lastAutoAt: payload.createdAt });
    return { created: true, payload };
  } catch {
    return { created: false, reason: 'sem-espaco' };
  }
}

export function getBackupById(id) {
  return listArchive().find((item) => item.id === id) || null;
}

export function parseBackupFileText(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'O ficheiro não é um JSON válido.', payload: null };
  }

  const validation = validateBackupPayload(parsed);
  if (!validation.ok) {
    return { ...validation, payload: null };
  }

  return { ok: true, error: null, payload: parsed };
}

export function queueRestore(payload) {
  const validation = validateBackupPayload(payload);
  if (!validation.ok) return validation;

  const ok = setStorageItem(PENDING_RESTORE_KEY, payload);
  if (!ok) {
    return { ok: false, error: 'Não foi possível preparar a restauração. O backup pode ser demasiado grande.' };
  }

  return { ok: true, error: null };
}

export function applyPendingRestoreIfAny() {
  compactBackupArchive();
  const pending = getStorageItem(PENDING_RESTORE_KEY, null);
  if (!pending) return false;

  const validation = validateBackupPayload(pending);
  if (!validation.ok) {
    removeStorageItem(PENDING_RESTORE_KEY);
    return false;
  }

  BACKUP_DATA_KEYS.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(pending.data, key)) {
      setStorageItem(key, pending.data[key]);
    }
  });

  removeStorageItem(PENDING_RESTORE_KEY);
  return true;
}

export function formatBackupDate(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('pt-PT', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(iso));
}
