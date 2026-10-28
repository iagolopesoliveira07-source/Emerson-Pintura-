import STORAGE_KEYS, { generateId, getStorageItem, setStorageItem } from '../services/storageService';
import { TIPO_OBRA } from './obraTipo';
import { roundMoney } from './ivaCalculations';
import {
  CONTROLE_CUSTOS,
  FINANCIAL_MODEL_PREPAID_CREDIT,
  INTERVENCAO_STATUS,
  createPrepaidCreditConfig,
  isPrepaidCreditObra,
} from './obraPrepaidCredit';

export const DOMES_LAKE_HOTEL_NOME = 'Domes Lake Hotel';
export const DOMES_LAKE_HOTEL_SPECIAL_KEY = 'domes_lake_hotel';
export const DOMES_LAKE_HOTEL_SEED_KEY = 'domes-lake-hotel';
export const DOMES_LAKE_CREDITO_INICIAL = 50000;
export const DOMES_LAKE_TOTAL_HISTORICO_ESPERADO = 38281.71;
export const DOMES_LAKE_SALDO_CALCULADO_ESPERADO = 11718.29;

const SAFE_NAME_ALIASES = new Set([
  'domes lake hotel',
  'domes lake',
  'domes hotel',
  'dommes lake hotel',
  'dommes hotel',
]);

/**
 * Abatimentos históricos da planilha. Sem custos.
 * `data` = último dia do período, para ordenar o crédito.
 * Soma = 38.281,71 €. Saldo = 50.000 − 38.281,71 = 11.718,29 €.
 * Os dois últimos períodos (1.378 + 540 = 1.918) explicam o saldo antigo 13.636,29 €.
 */
export const DOMES_LAKE_SERVICOS_HISTORICOS = [
  { seedKey: 'domes-hist-2025-12', periodoLabel: 'Dezembro 2025', periodoInicio: '2025-12-01', periodoFim: '2025-12-31', data: '2025-12-31', valor: 1620 },
  { seedKey: 'domes-hist-2026-02-04', periodoLabel: '04 a 06 Fevereiro 2026', periodoInicio: '2026-02-04', periodoFim: '2026-02-06', data: '2026-02-06', valor: 2846 },
  { seedKey: 'domes-hist-2026-02-16', periodoLabel: '16 a 20 Fevereiro 2026', periodoInicio: '2026-02-16', periodoFim: '2026-02-20', data: '2026-02-20', valor: 3069.24 },
  { seedKey: 'domes-hist-2026-02-02', periodoLabel: '02 a 07 Fevereiro 2026', periodoInicio: '2026-02-02', periodoFim: '2026-02-07', data: '2026-02-07', valor: 2465.54 },
  { seedKey: 'domes-hist-2026-02-09', periodoLabel: '09 a 14 Fevereiro 2026', periodoInicio: '2026-02-09', periodoFim: '2026-02-14', data: '2026-02-14', valor: 3255 },
  { seedKey: 'domes-hist-2026-03-16', periodoLabel: '16 a 20 Março 2026', periodoInicio: '2026-03-16', periodoFim: '2026-03-20', data: '2026-03-20', valor: 4211.3 },
  { seedKey: 'domes-hist-2026-03-23', periodoLabel: '23 a 27 Março 2026', periodoInicio: '2026-03-23', periodoFim: '2026-03-27', data: '2026-03-27', valor: 1390 },
  { seedKey: 'domes-hist-2026-03-30', periodoLabel: '30 Março a 03 Abril 2026', periodoInicio: '2026-03-30', periodoFim: '2026-04-03', data: '2026-04-03', valor: 1037.03 },
  { seedKey: 'domes-hist-2026-04-06', periodoLabel: '06 a 10 Abril 2026', periodoInicio: '2026-04-06', periodoFim: '2026-04-10', data: '2026-04-10', valor: 1575 },
  { seedKey: 'domes-hist-2026-04-20', periodoLabel: '20 a 26 Abril 2026', periodoInicio: '2026-04-20', periodoFim: '2026-04-26', data: '2026-04-26', valor: 1932 },
  { seedKey: 'domes-hist-2026-04-27', periodoLabel: '27 a 30 Abril 2026', periodoInicio: '2026-04-27', periodoFim: '2026-04-30', data: '2026-04-30', valor: 2760 },
  { seedKey: 'domes-hist-2026-05-04', periodoLabel: '04 a 09 Maio 2026', periodoInicio: '2026-05-04', periodoFim: '2026-05-09', data: '2026-05-09', valor: 2760 },
  { seedKey: 'domes-hist-2026-05-25', periodoLabel: '25 a 30 Maio 2026', periodoInicio: '2026-05-25', periodoFim: '2026-05-30', data: '2026-05-30', valor: 1063.6 },
  { seedKey: 'domes-hist-2026-06-08', periodoLabel: '08 a 13 Junho 2026', periodoInicio: '2026-06-08', periodoFim: '2026-06-13', data: '2026-06-13', valor: 1553 },
  { seedKey: 'domes-hist-2026-06-15', periodoLabel: '15 a 19 Junho 2026', periodoInicio: '2026-06-15', periodoFim: '2026-06-19', data: '2026-06-19', valor: 1347 },
  { seedKey: 'domes-hist-2026-06-23', periodoLabel: '23 a 27 Junho 2026', periodoInicio: '2026-06-23', periodoFim: '2026-06-27', data: '2026-06-27', valor: 423 },
  { seedKey: 'domes-hist-2026-07-06', periodoLabel: '06 a 10 Julho 2026', periodoInicio: '2026-07-06', periodoFim: '2026-07-10', data: '2026-07-10', valor: 3056 },
  { seedKey: 'domes-hist-2026-07-20', periodoLabel: '20 Julho a 11 Agosto 2026', periodoInicio: '2026-07-20', periodoFim: '2026-08-11', data: '2026-08-11', valor: 1378 },
  { seedKey: 'domes-hist-2026-08-17', periodoLabel: '17 a 21 Agosto 2026', periodoInicio: '2026-08-17', periodoFim: '2026-08-21', data: '2026-08-21', valor: 540 },
];

function normalizeNome(nome) {
  return String(nome || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

export function getDomesLakeHistoricoTotal() {
  return roundMoney(DOMES_LAKE_SERVICOS_HISTORICOS.reduce((sum, item) => sum + item.valor, 0));
}

export function isDomesLakeHotelObra(obra) {
  if (!obra) return false;
  if (obra.specialKey === DOMES_LAKE_HOTEL_SPECIAL_KEY) return true;
  if (obra.seedKey === DOMES_LAKE_HOTEL_SEED_KEY) return true;

  const nome = normalizeNome(obra.nome);
  const cliente = normalizeNome(obra.cliente);
  if (SAFE_NAME_ALIASES.has(nome) || SAFE_NAME_ALIASES.has(cliente)) return true;

  const hasDomes = nome.includes('domes') || nome.includes('dommes') || cliente.includes('domes') || cliente.includes('dommes');
  const hasLake = nome.includes('lake') || cliente.includes('lake');
  const hasHotel = nome.includes('hotel') || cliente.includes('hotel');
  return hasDomes && hasLake && hasHotel;
}

function findDomesLakeHotelObra(obras = []) {
  const matches = (obras || []).filter(isDomesLakeHotelObra);
  if (matches.length === 0) return null;
  return (
    matches.find((obra) => obra.specialKey === DOMES_LAKE_HOTEL_SPECIAL_KEY) ||
    matches.find((obra) => obra.seedKey === DOMES_LAKE_HOTEL_SEED_KEY) ||
    matches.find((obra) => normalizeNome(obra.nome) === 'domes lake hotel') ||
    matches[0]
  );
}

function buildHistoricoIntervencao(spec, createdAt) {
  return {
    id: spec.seedKey,
    seedKey: spec.seedKey,
    data: spec.data,
    periodoInicio: spec.periodoInicio,
    periodoFim: spec.periodoFim,
    periodoLabel: spec.periodoLabel,
    descricao: spec.periodoLabel,
    observacoes: 'Abatimento histórico importado da planilha. Custos detalhados não registrados.',
    valorFinal: roundMoney(spec.valor),
    controleCustos: CONTROLE_CUSTOS.HISTORICO,
    status: INTERVENCAO_STATUS.CONCLUIDO,
    createdAt,
    updatedAt: createdAt,
  };
}

function mergeHistoricoIntervencoes(existing = [], createdAt) {
  const list = Array.isArray(existing)
    ? existing.filter((item) => item && typeof item === 'object')
    : [];
  const bySeed = new Set(list.map((item) => item.seedKey).filter(Boolean));
  const byId = new Set(list.map((item) => item.id).filter(Boolean));
  let changed = false;

  DOMES_LAKE_SERVICOS_HISTORICOS.forEach((spec) => {
    if (bySeed.has(spec.seedKey) || byId.has(spec.seedKey)) return;
    const duplicateValorData = list.some(
      (item) =>
        roundMoney(item.valorFinal) === roundMoney(spec.valor) &&
        (item.periodoLabel === spec.periodoLabel || item.data === spec.data)
    );
    if (duplicateValorData) return;
    list.push(buildHistoricoIntervencao(spec, createdAt));
    changed = true;
  });

  return { intervencoes: list, changed };
}

function buildDomesLakeHotelObra(existing = null) {
  const now = new Date().toISOString();
  const createdAt = existing?.createdAt || now;
  const merged = mergeHistoricoIntervencoes(existing?.intervencoes, createdAt);

  return {
    ...(existing || {}),
    id: existing?.id || generateId(),
    nome: DOMES_LAKE_HOTEL_NOME,
    cliente: existing?.cliente || DOMES_LAKE_HOTEL_NOME,
    telefone: existing?.telefone || '',
    morada: existing?.morada || '',
    valorContratado: DOMES_LAKE_CREDITO_INICIAL,
    dataInicio: existing?.dataInicio || '2025-12-01',
    dataPrevistaTermino: existing?.dataPrevistaTermino || null,
    estado: existing?.estado || 'Em andamento',
    motivoPausa: existing?.motivoPausa || '',
    observacoes:
      existing?.observacoes ||
      'Crédito pré-pago de 50.000 € já recebido. Os serviços abatem este crédito. Não é valor a receber.',
    funcionarios: Array.isArray(existing?.funcionarios) ? existing.funcionarios : [],
    historicoAlteracoes: existing?.historicoAlteracoes || [],
    historicoStatus: existing?.historicoStatus || [],
    tipoObra: TIPO_OBRA.CREDITO,
    specialKey: DOMES_LAKE_HOTEL_SPECIAL_KEY,
    seedKey: DOMES_LAKE_HOTEL_SEED_KEY,
    financialModel: FINANCIAL_MODEL_PREPAID_CREDIT,
    prepaidCredit: createPrepaidCreditConfig({
      enabled: true,
      creditoInicial: DOMES_LAKE_CREDITO_INICIAL,
      valoresSemIva: true,
      dataInicio: existing?.prepaidCredit?.dataInicio || existing?.dataInicio || '2025-12-01',
      saldoInformadoPlanilha: existing?.prepaidCredit?.saldoInformadoPlanilha ?? null,
      divergenciaStatus: null,
    }),
    intervencoes: merged.intervencoes,
    createdAt,
    updatedAt: now,
  };
}

function needsDomesLakeUpgrade(obra) {
  if (!obra) return true;
  if (obra.specialKey !== DOMES_LAKE_HOTEL_SPECIAL_KEY) return true;
  if (obra.seedKey !== DOMES_LAKE_HOTEL_SEED_KEY) return true;
  if (obra.nome !== DOMES_LAKE_HOTEL_NOME) return true;
  if (obra.tipoObra !== TIPO_OBRA.CREDITO) return true;
  if (!isPrepaidCreditObra(obra)) return true;
  if (roundMoney(obra.prepaidCredit?.creditoInicial) !== DOMES_LAKE_CREDITO_INICIAL) return true;
  const seeds = new Set(
    (Array.isArray(obra.intervencoes) ? obra.intervencoes : [])
      .filter((item) => item && typeof item === 'object')
      .map((item) => item.seedKey)
      .filter(Boolean)
  );
  return DOMES_LAKE_SERVICOS_HISTORICOS.some((spec) => !seeds.has(spec.seedKey));
}

export function ensureDomesLakeHotelObra(obras = []) {
  const source = Array.isArray(obras) ? obras : [];
  try {
  const totalHistorico = getDomesLakeHistoricoTotal();
  if (Math.abs(totalHistorico - DOMES_LAKE_TOTAL_HISTORICO_ESPERADO) > 0.009) {
    console.error('[Domes Lake Hotel] Soma histórica inesperada:', totalHistorico);
  }

  const existing = findDomesLakeHotelObra(source);

  if (existing) {
    if (!needsDomesLakeUpgrade(existing)) {
      if (!getStorageItem(STORAGE_KEYS.domesLakeHotelSeeded, false)) {
        setStorageItem(STORAGE_KEYS.domesLakeHotelSeeded, true);
      }
      return { obras: source, created: false, updated: false, obra: existing };
    }

    const upgraded = buildDomesLakeHotelObra(existing);
    const next = source.map((obra) => (obra?.id === existing.id ? upgraded : obra));
    setStorageItem(STORAGE_KEYS.obras, next);
    setStorageItem(STORAGE_KEYS.domesLakeHotelSeeded, true);
    return { obras: next, created: false, updated: true, obra: upgraded };
  }

  const nova = buildDomesLakeHotelObra(null);
  const next = [...source, nova];
  setStorageItem(STORAGE_KEYS.obras, next);
  setStorageItem(STORAGE_KEYS.domesLakeHotelSeeded, true);
  return { obras: next, created: true, updated: false, obra: nova };
  } catch (err) {
    console.error('[Domes Lake Hotel] Falha ao sincronizar obra', err);
    return { obras: source, created: false, updated: false, obra: null };
  }
}
