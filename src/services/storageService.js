const STORAGE_KEYS = {
  obras: 'ep_obras',
  funcionarios: 'ep_funcionarios',
  diarias: 'ep_diarias',
  adiantamentos: 'ep_adiantamentos',
  emprestimos: 'ep_emprestimos',
  valoresAcerto: 'ep_valores_acerto',
  valoresAcertoMigrated: 'ep_valores_acerto_migrated',
  fechamentosPagamento: 'ep_fechamentos_pagamento',
  gastos: 'ep_gastos',
  gastosEmpresa: 'ep_gastos_empresa',
  gastosEmpresaCategorias: 'ep_gastos_empresa_categorias',
  ivaEntregar: 'ep_iva_entregar',
  pagamentos: 'ep_pagamentos',
  configuracoes: 'ep_configuracoes',
  hotelDommeControles: 'ep_hotel_domme_controles',
  initialized: 'ep_initialized',
  aptoTaviraSeeded: 'ep_apto_tavira_seeded',
  domesLakeHotelSeeded: 'ep_domes_lake_hotel_seeded',
  empresaVeiculos: 'ep_empresa_veiculos',
  empresaDespesasProgramadas: 'ep_empresa_despesas_programadas',
  empresaValoresRecuperar: 'ep_empresa_valores_recuperar',
  empresaFinanceiroSeedKeys: 'ep_empresa_financeiro_seed_keys',
  empresaFornecedores: 'ep_empresa_fornecedores',
  empresaIvaRegras: 'ep_empresa_iva_regras',
  auth: 'emerson_pinturas_auth',
};

export default STORAGE_KEYS;

export const DATA_STORAGE_KEYS = [
  STORAGE_KEYS.obras,
  STORAGE_KEYS.funcionarios,
  STORAGE_KEYS.diarias,
  STORAGE_KEYS.adiantamentos,
  STORAGE_KEYS.emprestimos,
  STORAGE_KEYS.valoresAcerto,
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
];

export const PRESERVED_STORAGE_KEYS = [
  STORAGE_KEYS.configuracoes,
  STORAGE_KEYS.initialized,
  STORAGE_KEYS.auth,
];

export const BACKUP_ARCHIVE_KEY = 'ep_backup_archive';

function isQuotaExceeded(error) {
  if (!error) return false;
  return (
    error.name === 'QuotaExceededError' ||
    error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    error.code === 22 ||
    error.code === 1014
  );
}

function hasStoredBusinessData() {
  return DATA_STORAGE_KEYS.some((key) => {
    const value = getStorageItem(key, null);
    if (Array.isArray(value)) return value.length > 0;
    if (value && typeof value === 'object') return Object.keys(value).length > 0;
    return false;
  });
}

export function storageHasExistingBusinessData() {
  return hasStoredBusinessData();
}

/** Compacta cópias de backup no localStorage. Não altera obras, gastos, diárias nem Acertos. */
export function compactBackupArchive() {
  try {
    const raw = localStorage.getItem(BACKUP_ARCHIVE_KEY);
    if (raw == null) return false;
    let archive;
    try {
      archive = JSON.parse(raw);
    } catch {
      localStorage.removeItem(BACKUP_ARCHIVE_KEY);
      return true;
    }
    if (!Array.isArray(archive) || archive.length === 0) {
      localStorage.removeItem(BACKUP_ARCHIVE_KEY);
      return true;
    }
    const compact = archive.map((item) => {
      if (!item || typeof item !== 'object') return item;
      const { data, ...rest } = item;
      return rest;
    });
    const next = JSON.stringify(compact);
    if (next.length >= raw.length) return false;
    localStorage.setItem(BACKUP_ARCHIVE_KEY, next);
    return true;
  } catch (error) {
    console.error('[persist] Falha ao compactar arquivo de backup do navegador', error);
    return false;
  }
}

export function getStorageItem(key, defaultValue = null) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

export function setStorageItem(key, value) {
  let serialized;
  try {
    if (key !== BACKUP_ARCHIVE_KEY) {
      compactBackupArchive();
    }
    serialized = JSON.stringify(value);
    localStorage.setItem(key, serialized);
    return true;
  } catch (error) {
    if (isQuotaExceeded(error) && key !== BACKUP_ARCHIVE_KEY && serialized) {
      const freed = compactBackupArchive();
      if (freed) {
        try {
          localStorage.setItem(key, serialized);
          return true;
        } catch (retryError) {
          console.error('[persist] Sem espaço no navegador após compactar backups:', key, retryError);
          return false;
        }
      }
    }
    console.error('[persist] Falha ao gravar', key, error);
    return false;
  }
}

export function removeStorageItem(key) {
  localStorage.removeItem(key);
}

export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function persistOfficialState(state) {
  if (!state || state.loading) return false;
  compactBackupArchive();
  const writes = [
    [STORAGE_KEYS.obras, state.obras],
    [STORAGE_KEYS.funcionarios, state.funcionarios],
    [STORAGE_KEYS.diarias, state.diarias],
    [STORAGE_KEYS.adiantamentos, state.adiantamentos],
    [STORAGE_KEYS.valoresAcerto, state.valoresAcerto],
    [STORAGE_KEYS.emprestimos, state.emprestimos],
    [STORAGE_KEYS.gastos, state.gastos],
    [STORAGE_KEYS.gastosEmpresa, state.gastosEmpresa || []],
    [STORAGE_KEYS.gastosEmpresaCategorias, state.gastosEmpresaCategorias],
    [STORAGE_KEYS.empresaVeiculos, state.empresaVeiculos],
    [STORAGE_KEYS.empresaDespesasProgramadas, state.empresaDespesasProgramadas],
    [STORAGE_KEYS.empresaValoresRecuperar, state.empresaValoresRecuperar],
    [STORAGE_KEYS.empresaFinanceiroSeedKeys, state.empresaFinanceiroSeedKeys],
    [STORAGE_KEYS.empresaFornecedores, state.empresaFornecedores],
    [STORAGE_KEYS.empresaIvaRegras, state.empresaIvaRegras],
    [STORAGE_KEYS.ivaEntregar, state.ivaEntregar || []],
    [STORAGE_KEYS.pagamentos, state.pagamentos],
    [STORAGE_KEYS.fechamentosPagamento, state.fechamentosPagamento],
    [STORAGE_KEYS.configuracoes, state.configuracoes],
    [STORAGE_KEYS.hotelDommeControles, state.hotelDommeControles],
  ];
  let ok = true;
  writes.forEach(([key, value]) => {
    if (value === undefined) return;
    if (!setStorageItem(key, value)) ok = false;
  });
  return ok;
}

export function resetApplicationData() {
  DATA_STORAGE_KEYS.forEach((key) => setStorageItem(key, []));
  setStorageItem(STORAGE_KEYS.initialized, true);
}
