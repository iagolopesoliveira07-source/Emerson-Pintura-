import STORAGE_KEYS, { generateId, getStorageItem, setStorageItem } from '../services/storageService';
import { TIPO_OBRA } from './obraTipo';
import {
  createFabioPartnershipConfig,
  getPartnership,
  isPartnershipObra,
  isCatarinaObra,
} from './obraPartnership';
import { isPrepaidCreditObra } from './obraPrepaidCredit';
import { FINANCIAL_MODEL_CREDIT_JOB, isCreditJobObra } from './obraCreditJob';

export {
  GASTO_PAGADOR,
  GASTO_PAGADOR_OPCOES,
  PARTICIPANT_ROLE,
  isPartnershipObra,
  getPartnership,
  getPartnershipPartnerName,
  getPrimaryPartner,
  isGastoPagoPorParceiro,
  isGastoPagoPorSocio,
  resolveGastoPagadorId,
  getGastoPagadorLabel,
  summarizeGastosPorPagador,
  calcPartnershipSummary,
  summarizePartnershipMaoDeObra,
  summarizeSocioMaoDeObraColuna,
  calcTotalPessoaColunaParceria,
  isObraParceriaComDiariasJaIncluidas,
  formatPartnershipQuantidade,
  formatPartnershipQuantidadeCurta,
  calcObraEmpresaFinanceiro,
  getEmpresaParticipacao,
  applyEmpresaShare,
  applyParceiroShare,
  applyEmpresaShareToPagamento,
  calcGastosEmersonObra,
  buildParceriasEmpresaResumo,
  buildParceiroReembolso,
  addParceiroReembolso,
  buildRepasseParceria,
  addRepasseParceria,
  updateRepasseParceria,
  removeRepasseParceria,
  materializeRepassesParceria,
  resolveRepasseDestinatario,
  getRepasseDestinatarioLabel,
  REPASSE_DESTINATARIO,
  REPASSE_DESTINATARIO_OPCOES,
  formatPartnershipDivision,
  partnershipToForm,
  buildPartnershipFields,
  validatePartnershipPercentages,
  arePartnershipPercentagesInformed,
  findFabioFuncionario,
  findParceiroFuncionarioByNome,
  isCatarinaObra,
  createPartnershipConfig,
  createFabioPartnershipConfig,
  createParticipant,
} from './obraPartnership';

export {
  isPrepaidCreditObra,
  getPrepaidCredit,
  prepaidCreditToForm,
  buildPrepaidCreditFields,
  calcPrepaidCreditSummary,
} from './obraPrepaidCredit';

export {
  isCreditJobObra,
  calcCreditJobSummary,
  createParcelaCredito,
  createCreditJobConfig,
  FINANCIAL_MODEL_CREDIT_JOB,
} from './obraCreditJob';

export { TIPO_OBRA, TIPO_OBRA_LABEL, TIPO_OBRA_OPTIONS, getTipoObraLabel } from './obraTipo';

export const FINANCIAL_MODEL = {
  CONVENTIONAL: 'conventional',
  PARTNERSHIP: 'partnership',
  LODGING_OFFSET: 'lodging_offset',
  PREPAID_CREDIT: 'prepaid_credit',
  CREDIT_JOB: FINANCIAL_MODEL_CREDIT_JOB,
};

export const OBRA_PROJECT_TYPE = {
  SPECIAL: 'special',
};

export const OBRA_SPECIAL_KEY = {
  APTO_TAVIRA: 'apto_tavira',
};

const APTO_TAVIRA_NOME = 'Apto Tavira';
const TAVIRA_PROJETO = 'Remodelação completa do apartamento';
const TAVIRA_COMPENSACAO = '1 ano de aluguel';
const TAVIRA_ACORDO =
  'Remodelação completa do apartamento em troca de 1 ano de aluguel.';
const ALOJAMENTO_FINALIDADE = TAVIRA_ACORDO;

function normalizeNome(nome) {
  return String(nome || '')
    .trim()
    .toLowerCase();
}

function nomesIguais(nome, esperado) {
  return normalizeNome(nome) === normalizeNome(esperado);
}

export function getFinancialModel(obra) {
  if (!obra) return FINANCIAL_MODEL.CONVENTIONAL;
  if (isAptoTaviraObra(obra)) return FINANCIAL_MODEL.LODGING_OFFSET;
  if (isPrepaidCreditObra(obra) || obra.financialModel === FINANCIAL_MODEL.PREPAID_CREDIT) {
    return FINANCIAL_MODEL.PREPAID_CREDIT;
  }
  const tipo = getTipoObra(obra);
  if (tipo === TIPO_OBRA.ESPECIAL_TAVIRA) return FINANCIAL_MODEL.LODGING_OFFSET;
  if (tipo === TIPO_OBRA.PARCERIA) return FINANCIAL_MODEL.PARTNERSHIP;
  if (tipo === TIPO_OBRA.CREDITO) return FINANCIAL_MODEL.CREDIT_JOB;
  return FINANCIAL_MODEL.CONVENTIONAL;
}

export function isLodgingOffsetObra(obra) {
  return getFinancialModel(obra) === FINANCIAL_MODEL.LODGING_OFFSET;
}

/** Alias: obras cuja contrapartida não deve entrar no lucro convencional. */
export function isSpecialObra(obra) {
  return isLodgingOffsetObra(obra) || isPrepaidCreditObra(obra);
}

export function isAptoTaviraObra(obra) {
  if (!obra) return false;
  if (obra.tipoObra === TIPO_OBRA.ESPECIAL_TAVIRA) return true;
  if (obra.specialKey === OBRA_SPECIAL_KEY.APTO_TAVIRA) return true;
  if (obra.financialModel === FINANCIAL_MODEL.LODGING_OFFSET) return true;
  const nome = normalizeNome(obra.nome);
  const cliente = normalizeNome(obra.cliente);
  if (nomesIguais(obra.nome, APTO_TAVIRA_NOME)) return true;
  return nome.includes('tavira') || cliente.includes('tavira');
}

export function getTipoObra(obra) {
  if (!obra) return TIPO_OBRA.NORMAL;
  if (isAptoTaviraObra(obra)) return TIPO_OBRA.ESPECIAL_TAVIRA;
  if (obra.tipoObra === TIPO_OBRA.PARCERIA || isPartnershipObra(obra) || isCatarinaObra(obra)) {
    return TIPO_OBRA.PARCERIA;
  }
  if (isPrepaidCreditObra(obra) || obra.financialModel === FINANCIAL_MODEL.PREPAID_CREDIT) {
    return TIPO_OBRA.CREDITO;
  }
  if (obra.tipoObra === TIPO_OBRA.CREDITO) return TIPO_OBRA.CREDITO;
  if (isCreditJobObra(obra)) return TIPO_OBRA.CREDITO;
  if (obra.tipoObra === TIPO_OBRA.NORMAL) return TIPO_OBRA.NORMAL;
  return TIPO_OBRA.NORMAL;
}

export function createAptoTaviraAcordo(existing = null) {
  return {
    tipo: existing?.tipo || 'remodelacao_aluguel',
    projeto: existing?.projeto || TAVIRA_PROJETO,
    formaCompensacao: existing?.formaCompensacao || TAVIRA_COMPENSACAO,
    descricao: existing?.descricao || TAVIRA_ACORDO,
  };
}

export function createAptoTaviraAlojamento(existing = null) {
  return {
    utilizadoComoAlojamento: true,
    localizacao: existing?.localizacao || 'Tavira, Algarve',
    contratoDuracao: existing?.contratoDuracao || '1 ano',
    finalidade: existing?.finalidade || ALOJAMENTO_FINALIDADE,
    dataInicioContrato: existing?.dataInicioContrato ?? null,
    dataFimContrato: existing?.dataFimContrato ?? null,
  };
}

export function createAptoTaviraObra() {
  return {
    nome: APTO_TAVIRA_NOME,
    cliente: APTO_TAVIRA_NOME,
    telefone: '',
    morada: 'Tavira, Algarve',
    valorContratado: null,
    dataInicio: null,
    dataPrevistaTermino: null,
    estado: 'Em andamento',
    motivoPausa: '',
    observacoes: TAVIRA_ACORDO,
    funcionarios: [],
    historicoAlteracoes: [],
    historicoStatus: [],
    tipoObra: TIPO_OBRA.ESPECIAL_TAVIRA,
    projectType: OBRA_PROJECT_TYPE.SPECIAL,
    specialKey: OBRA_SPECIAL_KEY.APTO_TAVIRA,
    financialModel: FINANCIAL_MODEL.LODGING_OFFSET,
    acordoEspecial: createAptoTaviraAcordo(),
    alojamento: createAptoTaviraAlojamento(),
  };
}

function obraAptoTaviraJaExiste(obras = []) {
  return (obras || []).some(isAptoTaviraObra);
}

function finalidadeAlojamentoDesatualizada(finalidade) {
  if (!finalidade) return true;
  return (
    finalidade === 'Alojamento dos funcionários durante a execução da obra' ||
    finalidade === 'Remodelação do apartamento e alojamento dos funcionários durante a execução da obra'
  );
}

function observacaoTaviraDesatualizada(observacoes) {
  const text = String(observacoes || '');
  return (
    !text.trim() ||
    text.includes('alojamento dos funcionários') ||
    text.includes('Apartamento utilizado como alojamento')
  );
}

function upgradeAptoTaviraMetadata(obra) {
  const alojamento = createAptoTaviraAlojamento(obra.alojamento);
  if (finalidadeAlojamentoDesatualizada(obra.alojamento?.finalidade)) {
    alojamento.finalidade = TAVIRA_ACORDO;
  }
  const acordoEspecial = createAptoTaviraAcordo(obra.acordoEspecial);

  const needsModel = obra.financialModel !== FINANCIAL_MODEL.LODGING_OFFSET;
  const needsKey = obra.specialKey !== OBRA_SPECIAL_KEY.APTO_TAVIRA;
  const needsType = obra.projectType !== OBRA_PROJECT_TYPE.SPECIAL;
  const needsTipoObra = obra.tipoObra !== TIPO_OBRA.ESPECIAL_TAVIRA;
  const needsAlojamento = JSON.stringify(obra.alojamento || null) !== JSON.stringify(alojamento);
  const needsAcordo = JSON.stringify(obra.acordoEspecial || null) !== JSON.stringify(acordoEspecial);
  const needsObs = observacaoTaviraDesatualizada(obra.observacoes);

  if (!needsModel && !needsKey && !needsType && !needsTipoObra && !needsAlojamento && !needsAcordo && !needsObs) {
    return obra;
  }

  return {
    ...obra,
    tipoObra: TIPO_OBRA.ESPECIAL_TAVIRA,
    financialModel: FINANCIAL_MODEL.LODGING_OFFSET,
    specialKey: OBRA_SPECIAL_KEY.APTO_TAVIRA,
    projectType: OBRA_PROJECT_TYPE.SPECIAL,
    acordoEspecial,
    alojamento,
    observacoes: needsObs ? TAVIRA_ACORDO : obra.observacoes,
  };
}

function upgradePartnershipMetadata(obra, funcionarios = []) {
  if (isAptoTaviraObra(obra)) return obra;
  const shouldBePartnership = isPartnershipObra(obra) || isCatarinaObra(obra);
  if (!shouldBePartnership) {
    if (obra.tipoObra === TIPO_OBRA.PARCERIA) return obra;
    return obra;
  }

  const partnership = createFabioPartnershipConfig(funcionarios, obra.partnership);
  const next = {
    ...obra,
    tipoObra: TIPO_OBRA.PARCERIA,
    financialModel:
      obra.financialModel === FINANCIAL_MODEL.LODGING_OFFSET
        ? obra.financialModel
        : FINANCIAL_MODEL.PARTNERSHIP,
    partnership,
    reembolsosParceiro: Array.isArray(obra.reembolsosParceiro) ? obra.reembolsosParceiro : [],
    repassesParceria: Array.isArray(obra.repassesParceria) ? obra.repassesParceria : [],
  };

  if (JSON.stringify(next.partnership) === JSON.stringify(obra.partnership) && obra.tipoObra === TIPO_OBRA.PARCERIA) {
    return obra;
  }
  return next;
}

export function upgradeObraFinancialMetadata(obra, { funcionarios = [] } = {}) {
  if (!obra) return obra;
  let next = obra;
  if (isAptoTaviraObra(next)) next = upgradeAptoTaviraMetadata(next);
  next = upgradePartnershipMetadata(next, funcionarios);
  if (isCreditJobObra(next) && next.tipoObra !== TIPO_OBRA.CREDITO) {
    next = {
      ...next,
      tipoObra: TIPO_OBRA.CREDITO,
      financialModel: FINANCIAL_MODEL.CREDIT_JOB,
    };
  }
  if (!next.tipoObra) {
    next = { ...next, tipoObra: getTipoObra(next) };
  }
  return next;
}

export function ensureAptoTaviraObra(obras = []) {
  const seeded = Boolean(getStorageItem(STORAGE_KEYS.aptoTaviraSeeded, false));

  if (obraAptoTaviraJaExiste(obras)) {
    if (!seeded) setStorageItem(STORAGE_KEYS.aptoTaviraSeeded, true);
    return { obras, created: false };
  }

  if (seeded) {
    return { obras, created: false };
  }

  const now = new Date().toISOString();
  const nova = {
    ...createAptoTaviraObra(),
    id: generateId(),
    createdAt: now,
  };

  const next = [...obras, nova];
  setStorageItem(STORAGE_KEYS.obras, next);
  setStorageItem(STORAGE_KEYS.aptoTaviraSeeded, true);

  return { obras: next, created: true };
}

export function applyObraFinancialModels(obras = [], { funcionarios = [] } = {}) {
  const source = Array.isArray(obras) ? obras : [];
  const ensured = ensureAptoTaviraObra(source);
  let upgraded = false;

  const next = (Array.isArray(ensured.obras) ? ensured.obras : []).map((obra) => {
    if (!obra || typeof obra !== 'object') return obra;
    try {
      const updated = upgradeObraFinancialMetadata(obra, { funcionarios });
      if (updated !== obra) upgraded = true;
      return updated;
    } catch (err) {
      console.error('[obras] Falha ao normalizar obra', obra?.id, err);
      return obra;
    }
  });

  if (ensured.created || upgraded) {
    setStorageItem(STORAGE_KEYS.obras, next);
  }

  return next;
}

export function preserveSpecialObraFields(obra, next) {
  if (!obra || !next) return next;

  const preserved = { ...next };

  if (obra.projectType != null && preserved.projectType === undefined) {
    preserved.projectType = obra.projectType;
  }
  if (obra.specialKey != null && preserved.specialKey === undefined) {
    preserved.specialKey = obra.specialKey;
  }
  if (obra.financialModel != null && preserved.financialModel === undefined) {
    preserved.financialModel = obra.financialModel;
  }
  if (obra.alojamento != null && preserved.alojamento === undefined) {
    preserved.alojamento = obra.alojamento;
  }
  if (obra.partnership != null && preserved.partnership === undefined) {
    preserved.partnership = obra.partnership;
  }
  if (obra.reembolsosParceiro != null && preserved.reembolsosParceiro === undefined) {
    preserved.reembolsosParceiro = obra.reembolsosParceiro;
  }
  if (obra.tipoObra != null && preserved.tipoObra === undefined) {
    preserved.tipoObra = obra.tipoObra;
  }
  if (obra.acordoEspecial != null && preserved.acordoEspecial === undefined) {
    preserved.acordoEspecial = obra.acordoEspecial;
  }
  if (obra.repassesParceria != null && preserved.repassesParceria === undefined) {
    preserved.repassesParceria = obra.repassesParceria;
  }
  if (obra.acertosParceria != null && preserved.acertosParceria === undefined) {
    preserved.acertosParceria = obra.acertosParceria;
  }
  if (obra.caixaParceria != null && preserved.caixaParceria === undefined) {
    preserved.caixaParceria = obra.caixaParceria;
  }
  if (obra.rascunhoAcertoParceria !== undefined && preserved.rascunhoAcertoParceria === undefined) {
    preserved.rascunhoAcertoParceria = obra.rascunhoAcertoParceria;
  }
  if (obra.creditJob != null && preserved.creditJob === undefined) {
    preserved.creditJob = obra.creditJob;
  }
  if (obra.prepaidCredit != null && preserved.prepaidCredit === undefined) {
    preserved.prepaidCredit = obra.prepaidCredit;
  }
  if (obra.seedKey != null && preserved.seedKey === undefined) {
    preserved.seedKey = obra.seedKey;
  }
  if (obra.intervencoes != null && preserved.intervencoes === undefined) {
    preserved.intervencoes = obra.intervencoes;
  }
  if (obra.extras != null && preserved.extras === undefined) {
    preserved.extras = obra.extras;
  }

  return preserved;
}

export function resolveFinancialModelForSave(obra, { partnership, prepaidCredit, tipoObra } = {}) {
  const tipo = tipoObra || obra?.tipoObra || getTipoObra(obra);
  if (tipo === TIPO_OBRA.ESPECIAL_TAVIRA || isAptoTaviraObra(obra)) {
    return FINANCIAL_MODEL.LODGING_OFFSET;
  }
  if (prepaidCredit?.enabled || isPrepaidCreditObra(obra)) {
    return FINANCIAL_MODEL.PREPAID_CREDIT;
  }
  if (tipo === TIPO_OBRA.CREDITO) return FINANCIAL_MODEL.CREDIT_JOB;
  if (tipo === TIPO_OBRA.PARCERIA || partnership?.enabled) return FINANCIAL_MODEL.PARTNERSHIP;
  if (
    obra?.financialModel === FINANCIAL_MODEL.LODGING_OFFSET ||
    obra?.specialKey === OBRA_SPECIAL_KEY.APTO_TAVIRA
  ) {
    return FINANCIAL_MODEL.LODGING_OFFSET;
  }
  if (prepaidCredit && prepaidCredit.enabled === false) {
    if (partnership?.enabled) return FINANCIAL_MODEL.PARTNERSHIP;
    return FINANCIAL_MODEL.CONVENTIONAL;
  }
  if (partnership && partnership.enabled === false) return FINANCIAL_MODEL.CONVENTIONAL;
  return obra?.financialModel;
}

export function patchObraAlojamento(obra, patch = {}) {
  if (!obra) return obra;
  return {
    ...obra,
    alojamento: {
      ...createAptoTaviraAlojamento(obra.alojamento),
      ...patch,
    },
    updatedAt: new Date().toISOString(),
  };
}
