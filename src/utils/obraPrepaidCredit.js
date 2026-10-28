import { generateId } from '../services/storageService';
import { roundMoney } from './ivaCalculations';
import { getTodayISO } from './formatters';
import { validateForm, validateNumber, validateRequired } from './validators';
import { getGastoEmpresaValor, isGastoEmpresaPrevisto } from './gastoEmpresaCalculations';
import { getGastoValorAssinado } from './gastoDocumentoTipo';
import {
  isCombustivelGasto,
  isHospedagemGasto,
  isMaterialGasto,
} from './obraCustos';
import { calcDiariaValorPagavel } from './funcionarioTipo';
import {
  diariaPertenceAObra,
  diariaTemIntervencao,
  filterDiariasDaObra,
  getDiariaAlocacoes,
  getDiariaCustoNaIntervencao,
  getDiariaCustoNaObra,
  getDiariaIntervencaoNaObra,
  getDiariaQuantidadeNaIntervencao,
  getDiariaQuantidadeNaObra,
  isDiariaMultiObra,
} from './diariaObraAlocacao';

export const FINANCIAL_MODEL_PREPAID_CREDIT = 'prepaid_credit';

export const CONTROLE_CUSTOS = {
  HISTORICO: 'historico',
  EM_REGISTO: 'em_registo',
  COMPLETO: 'completo',
};

export const CONTROLE_CUSTOS_LABELS = {
  [CONTROLE_CUSTOS.HISTORICO]: 'Custos históricos não disponíveis',
  [CONTROLE_CUSTOS.EM_REGISTO]: 'Custos em registo',
  [CONTROLE_CUSTOS.COMPLETO]: 'Custos completos',
};

export const INTERVENCAO_STATUS = {
  EM_ANDAMENTO: 'em_andamento',
  FINALIZADO: 'finalizado',
  ORCAMENTO_DEFINIDO: 'orcamento_definido',
  ABATIDO: 'abatido_credito',
  ORCAMENTO_ENVIADO: 'orcamento_enviado',
  APROVADO: 'aprovado',
  PAGO: 'pago',
  CONCLUIDO: 'concluido',
};

export const INTERVENCAO_STATUS_LABELS = {
  [INTERVENCAO_STATUS.EM_ANDAMENTO]: 'Em andamento',
  [INTERVENCAO_STATUS.FINALIZADO]: 'Finalizado',
  [INTERVENCAO_STATUS.ORCAMENTO_DEFINIDO]: 'Orçamento definido',
  [INTERVENCAO_STATUS.ABATIDO]: 'Abatido no crédito',
  [INTERVENCAO_STATUS.ORCAMENTO_ENVIADO]: 'Orçamento definido',
  [INTERVENCAO_STATUS.APROVADO]: 'Orçamento definido',
  [INTERVENCAO_STATUS.PAGO]: 'Abatido no crédito',
  [INTERVENCAO_STATUS.CONCLUIDO]: 'Finalizado',
};

export const INTERVENCAO_STATUS_FORM = [
  INTERVENCAO_STATUS.EM_ANDAMENTO,
  INTERVENCAO_STATUS.FINALIZADO,
  INTERVENCAO_STATUS.ORCAMENTO_DEFINIDO,
  INTERVENCAO_STATUS.ABATIDO,
];

export function normalizeIntervencaoStatus(value) {
  if (Object.values(INTERVENCAO_STATUS).includes(value)) return value;
  return null;
}

export function canonicalIntervencaoStatus(intervencaoOrStatus) {
  const isObjeto = intervencaoOrStatus && typeof intervencaoOrStatus === 'object';
  const status = normalizeIntervencaoStatus(isObjeto ? intervencaoOrStatus.status : intervencaoOrStatus);
  const historico =
    isObjeto && normalizeControleCustos(intervencaoOrStatus.controleCustos) === CONTROLE_CUSTOS.HISTORICO;
  if (historico) return INTERVENCAO_STATUS.ABATIDO;
  if (status === INTERVENCAO_STATUS.ABATIDO || status === INTERVENCAO_STATUS.PAGO) {
    return INTERVENCAO_STATUS.ABATIDO;
  }
  if (status === INTERVENCAO_STATUS.FINALIZADO || status === INTERVENCAO_STATUS.CONCLUIDO) {
    return INTERVENCAO_STATUS.FINALIZADO;
  }
  if (
    status === INTERVENCAO_STATUS.ORCAMENTO_DEFINIDO ||
    status === INTERVENCAO_STATUS.ORCAMENTO_ENVIADO ||
    status === INTERVENCAO_STATUS.APROVADO
  ) {
    return INTERVENCAO_STATUS.ORCAMENTO_DEFINIDO;
  }
  return INTERVENCAO_STATUS.EM_ANDAMENTO;
}

export function getIntervencaoStatusLabel(statusOrIntervencao) {
  const canonical = canonicalIntervencaoStatus(statusOrIntervencao);
  return INTERVENCAO_STATUS_LABELS[canonical] || INTERVENCAO_STATUS_LABELS[INTERVENCAO_STATUS.EM_ANDAMENTO];
}

export function isStatusServicoFinal(statusOrIntervencao) {
  const value = canonicalIntervencaoStatus(statusOrIntervencao);
  return value === INTERVENCAO_STATUS.FINALIZADO || value === INTERVENCAO_STATUS.ABATIDO;
}

export function isServicoEmAndamento(intervencao) {
  const value = canonicalIntervencaoStatus(intervencao);
  return value === INTERVENCAO_STATUS.EM_ANDAMENTO || value === INTERVENCAO_STATUS.ORCAMENTO_DEFINIDO;
}

export function getIntervencaoValorDefinido(intervencao) {
  const valor = Number(intervencao?.valorFinal);
  return Number.isFinite(valor) && valor > 0 ? roundMoney(valor) : 0;
}

export function isIntervencaoAbatida(intervencao) {
  return canonicalIntervencaoStatus(intervencao) === INTERVENCAO_STATUS.ABATIDO && getIntervencaoValorDefinido(intervencao) > 0;
}

const MIN_SERVICOS_CENARIOS = 3;

function asRecordList(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === 'object');
}

function asIntervencaoList(obra) {
  return asRecordList(obra?.intervencoes);
}

export function createPrepaidCreditConfig({
  enabled = true,
  creditoInicial = 0,
  valoresSemIva = true,
  dataInicio = null,
  saldoInformadoPlanilha = null,
  divergenciaStatus = null,
} = {}) {
  return {
    enabled: enabled !== false,
    creditoInicial: roundMoney(creditoInicial),
    valoresSemIva: valoresSemIva !== false,
    dataInicio: dataInicio || null,
    saldoInformadoPlanilha:
      saldoInformadoPlanilha == null || saldoInformadoPlanilha === ''
        ? null
        : roundMoney(saldoInformadoPlanilha),
    divergenciaStatus: divergenciaStatus || null,
  };
}

export function getPrepaidCredit(obra) {
  if (!obra?.prepaidCredit || typeof obra.prepaidCredit !== 'object') return null;
  return createPrepaidCreditConfig(obra.prepaidCredit);
}

export function isPrepaidCreditObra(obra) {
  return getPrepaidCredit(obra)?.enabled === true;
}

export function prepaidCreditToForm(obra) {
  const credit = getPrepaidCredit(obra);
  if (!credit?.enabled) {
    return {
      creditoPrePago: 'nao',
      creditoInicial: '',
    };
  }
  return {
    creditoPrePago: 'sim',
    creditoInicial: credit.creditoInicial != null ? String(credit.creditoInicial) : '',
  };
}

export function buildPrepaidCreditFields(form, existingObra = null) {
  const existing = getPrepaidCredit(existingObra);

  if (form.creditoPrePago !== 'sim') {
    if (!existing) return {};
    return {
      prepaidCredit: {
        ...existing,
        enabled: false,
      },
    };
  }

  const creditoInicial = roundMoney(parseFloat(form.creditoInicial));
  if (!Number.isFinite(creditoInicial) || creditoInicial <= 0) {
    return { error: 'Indique o crédito inicial.' };
  }

  return {
    prepaidCredit: createPrepaidCreditConfig({
      enabled: true,
      creditoInicial,
      valoresSemIva: true,
      dataInicio: form.dataInicio?.trim() || existing?.dataInicio || existingObra?.dataInicio || getTodayISO(),
      saldoInformadoPlanilha: existing?.saldoInformadoPlanilha ?? null,
      divergenciaStatus: existing?.divergenciaStatus || null,
    }),
    intervencoes: asIntervencaoList(existingObra),
  };
}

const MESES_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

function parseISODateParts(iso) {
  const match = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return { y: Number(match[1]), mo: Number(match[2]), d: Number(match[3]) };
}

export function formatPeriodoRange(inicio, fim) {
  const start = parseISODateParts(inicio);
  const end = parseISODateParts(fim || inicio);
  if (!start && !end) return '';
  const a = start || end;
  const b = end || start;
  const pad = (n) => String(n).padStart(2, '0');
  if (a.y === b.y && a.mo === b.mo && a.d === b.d) {
    return `${pad(a.d)} ${MESES_PT[a.mo - 1]} ${a.y}`;
  }
  if (a.y === b.y && a.mo === b.mo) {
    return `${pad(a.d)}–${pad(b.d)} ${MESES_PT[a.mo - 1]} ${a.y}`;
  }
  if (a.y === b.y) {
    return `${pad(a.d)} ${MESES_PT[a.mo - 1]} a ${pad(b.d)} ${MESES_PT[b.mo - 1]} ${b.y}`;
  }
  return `${pad(a.d)} ${MESES_PT[a.mo - 1]} ${a.y} a ${pad(b.d)} ${MESES_PT[b.mo - 1]} ${b.y}`;
}

export function validateIntervencaoForm(form) {
  const errors = {
    descricao: validateRequired(form.descricao, 'Nome do serviço'),
  };

  if (form.valorFinal !== '' && form.valorFinal != null) {
    errors.valorFinal = validateNumber(form.valorFinal, 'Valor do serviço', 0.01);
  }

  const status = canonicalIntervencaoStatus({ status: form.status, controleCustos: form.controleCustos });
  if (status === INTERVENCAO_STATUS.ABATIDO) {
    const valor = parseFloat(form.valorFinal);
    if (!Number.isFinite(valor) || valor <= 0) {
      errors.valorFinal = 'Indique o valor para abater no crédito.';
    }
  }

  return validateForm(errors);
}

export function normalizeControleCustos(value) {
  if (value === CONTROLE_CUSTOS.HISTORICO) return CONTROLE_CUSTOS.HISTORICO;
  if (value === CONTROLE_CUSTOS.COMPLETO) return CONTROLE_CUSTOS.COMPLETO;
  if (value === CONTROLE_CUSTOS.EM_REGISTO) return CONTROLE_CUSTOS.EM_REGISTO;
  return null;
}

export function createIntervencao({
  id,
  data,
  descricao,
  observacoes = '',
  valorFinal = null,
  controleCustos = CONTROLE_CUSTOS.EM_REGISTO,
  status = INTERVENCAO_STATUS.EM_ANDAMENTO,
  periodoInicio = null,
  periodoFim = null,
  periodoLabel = '',
  seedKey = null,
  createdAt,
} = {}) {
  const valor = valorFinal == null || valorFinal === '' ? null : roundMoney(valorFinal);
  const resolvedStatus = normalizeIntervencaoStatus(status) || INTERVENCAO_STATUS.EM_ANDAMENTO;
  const inicio = periodoInicio || null;
  const fim = periodoFim || null;
  const label = String(periodoLabel || '').trim() || formatPeriodoRange(inicio, fim);
  return {
    id: id || generateId(),
    data: data || fim || inicio || getTodayISO(),
    descricao: String(descricao || '').trim(),
    observacoes: String(observacoes || '').trim(),
    valorFinal: Number.isFinite(valor) && valor > 0 ? valor : null,
    controleCustos: normalizeControleCustos(controleCustos) || CONTROLE_CUSTOS.EM_REGISTO,
    status: resolvedStatus,
    periodoInicio: inicio,
    periodoFim: fim,
    periodoLabel: label,
    seedKey: seedKey || null,
    createdAt: createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function upsertIntervencao(obra, intervencao) {
  if (!obra || !intervencao) return obra;
  const list = asIntervencaoList(obra);
  const index = list.findIndex((item) => item.id === intervencao.id);
  const stored = {
    id: intervencao.id,
    data: intervencao.data,
    descricao: intervencao.descricao,
    observacoes: intervencao.observacoes || '',
    valorFinal: intervencao.valorFinal,
    controleCustos:
      normalizeControleCustos(intervencao.controleCustos) || CONTROLE_CUSTOS.EM_REGISTO,
    status: normalizeIntervencaoStatus(intervencao.status) || INTERVENCAO_STATUS.EM_ANDAMENTO,
    periodoInicio: intervencao.periodoInicio || null,
    periodoFim: intervencao.periodoFim || null,
    periodoLabel: intervencao.periodoLabel || '',
    seedKey: intervencao.seedKey || null,
    createdAt: intervencao.createdAt,
    updatedAt: new Date().toISOString(),
  };

  if (index >= 0) {
    list[index] = {
      ...stored,
      createdAt: list[index].createdAt || stored.createdAt,
    };
  } else {
    list.push(stored);
  }

  return {
    ...obra,
    intervencoes: list,
    updatedAt: new Date().toISOString(),
  };
}

export function removeIntervencao(obra, intervencaoId) {
  if (!obra) return obra;
  return {
    ...obra,
    intervencoes: asIntervencaoList(obra).filter((item) => item.id !== intervencaoId),
    updatedAt: new Date().toISOString(),
  };
}

export function getIntervencaoValorAbatido(intervencao) {
  return isIntervencaoAbatida(intervencao) ? getIntervencaoValorDefinido(intervencao) : 0;
}

export function calcPeriodoAutomatico(records = {}) {
  const datas = [
    ...asRecordList(records.diarias).map((item) => item.data),
    ...asRecordList(records.gastos).map((item) => item.data),
    ...asRecordList(records.gastosEmpresa).map((item) => item.data),
  ]
    .map((value) => String(value || '').slice(0, 10))
    .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))
    .sort();

  if (!datas.length) {
    return { periodoInicio: null, periodoFim: null, periodoLabel: '', automatico: false };
  }

  const inicio = datas[0];
  const fim = datas[datas.length - 1];
  return {
    periodoInicio: inicio,
    periodoFim: fim,
    periodoLabel: formatPeriodoRange(inicio, fim),
    automatico: true,
  };
}

export function resolvePeriodoServico(intervencao, records = {}) {
  const auto = calcPeriodoAutomatico(records);
  if (auto.automatico) return auto;
  const inicio = intervencao?.periodoInicio || null;
  const fim = intervencao?.periodoFim || inicio;
  const label = String(intervencao?.periodoLabel || '').trim() || formatPeriodoRange(inicio, fim);
  return {
    periodoInicio: inicio,
    periodoFim: fim,
    periodoLabel: label,
    automatico: false,
  };
}

export function buildFuncionariosDoServico(diarias = [], funcionarios = [], intervencaoId = null) {
  const map = new Map();
  asRecordList(diarias).forEach((item) => {
    const key = item.funcionarioId || 'sem-funcionario';
    const current = map.get(key) || {
      funcionarioId: item.funcionarioId || null,
      quantidade: 0,
      custo: 0,
      datas: [],
    };
    current.quantidade += intervencaoId
      ? getDiariaQuantidadeNaIntervencao(item, intervencaoId)
      : Number(item.quantidade) || 0;
    current.custo = roundMoney(
      current.custo +
        (intervencaoId
          ? getDiariaCustoNaIntervencao(item, intervencaoId, funcionarios)
          : diariaValor(item, funcionarios))
    );
    if (item.data) current.datas.push(String(item.data).slice(0, 10));
    map.set(key, current);
  });
  return [...map.values()]
    .map((row) => ({
      ...row,
      datas: [...new Set(row.datas)].sort(),
    }))
    .sort((a, b) => b.custo - a.custo);
}

export function getWeekStartISO(iso) {
  const value = String(iso || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const dayNum = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${dayNum}`;
}

export function addDaysISO(iso, days) {
  const value = String(iso || '').slice(0, 10);
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const dayNum = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${dayNum}`;
}

function gastoObraValor(gasto) {
  return getGastoValorAssinado(gasto);
}

function diariaValor(diaria, funcionarios = []) {
  return calcDiariaValorPagavel(diaria, funcionarios);
}

function splitGastosPorTipo(lista = [], valorFn) {
  const items = asRecordList(lista);
  const materiais = items.filter(isMaterialGasto);
  const hospedagem = items.filter((item) => !isMaterialGasto(item) && isHospedagemGasto(item));
  const combustivel = items.filter(
    (item) => !isMaterialGasto(item) && !isHospedagemGasto(item) && isCombustivelGasto(item)
  );
  const outros = items.filter(
    (item) => !isMaterialGasto(item) && !isHospedagemGasto(item) && !isCombustivelGasto(item)
  );
  return {
    totalMateriais: roundMoney(materiais.reduce((sum, item) => sum + valorFn(item), 0)),
    totalHospedagem: roundMoney(hospedagem.reduce((sum, item) => sum + valorFn(item), 0)),
    totalCombustivel: roundMoney(combustivel.reduce((sum, item) => sum + valorFn(item), 0)),
    totalOutros: roundMoney(outros.reduce((sum, item) => sum + valorFn(item), 0)),
  };
}

export function getIntervencaoRecords(
  intervencaoId,
  { diarias = [], gastos = [], gastosEmpresa = [] } = {}
) {
  return {
    diarias: asRecordList(diarias).filter((item) => diariaTemIntervencao(item, intervencaoId)),
    gastos: asRecordList(gastos).filter((item) => item.intervencaoId === intervencaoId),
    gastosEmpresa: asRecordList(gastosEmpresa).filter(
      (item) => item.intervencaoId === intervencaoId && !isGastoEmpresaPrevisto(item)
    ),
  };
}

export function calcIntervencaoCusto(
  intervencaoId,
  { diarias = [], gastos = [], gastosEmpresa = [], funcionarios = [] } = {}
) {
  const records = getIntervencaoRecords(intervencaoId, { diarias, gastos, gastosEmpresa });
  const totalDiarias = roundMoney(
    records.diarias.reduce(
      (sum, item) => sum + getDiariaCustoNaIntervencao(item, intervencaoId, funcionarios),
      0
    )
  );
  const obra = splitGastosPorTipo(records.gastos, gastoObraValor);
  const empresa = splitGastosPorTipo(records.gastosEmpresa, getGastoEmpresaValor);
  const totalMateriais = roundMoney(obra.totalMateriais + empresa.totalMateriais);
  const totalHospedagem = roundMoney(obra.totalHospedagem + empresa.totalHospedagem);
  const totalCombustivel = roundMoney(obra.totalCombustivel + empresa.totalCombustivel);
  const totalOutros = roundMoney(obra.totalOutros + empresa.totalOutros);
  const custoTotal = roundMoney(
    totalDiarias + totalMateriais + totalHospedagem + totalCombustivel + totalOutros
  );
  const hasCostRecords =
    records.diarias.length > 0 || records.gastos.length > 0 || records.gastosEmpresa.length > 0;
  const quantidadeDiarias = records.diarias.reduce(
    (sum, item) => sum + getDiariaQuantidadeNaIntervencao(item, intervencaoId),
    0
  );
  const funcionariosEnvolvidos = new Set(
    records.diarias.map((item) => item.funcionarioId).filter(Boolean)
  ).size;

  return {
    totalDiarias,
    totalMateriais,
    totalHospedagem,
    totalCombustivel,
    totalOutros,
    custoTotal,
    hasCostRecords,
    quantidadeDiarias,
    funcionariosEnvolvidos,
    totalGastos: roundMoney(totalMateriais + totalHospedagem + totalCombustivel + totalOutros),
  };
}

export function resolveControleCustos(intervencao, custo = {}) {
  const stored = normalizeControleCustos(intervencao?.controleCustos);
  if (stored) return stored;
  const hasValor = getIntervencaoValorAbatido(intervencao) > 0;
  if (hasValor && !custo.hasCostRecords && !(custo.custoTotal > 0)) {
    return CONTROLE_CUSTOS.HISTORICO;
  }
  return CONTROLE_CUSTOS.EM_REGISTO;
}

function buildServicoExibicao({
  valorDefinido = 0,
  abatido = 0,
  creditoRestanteAntes = 0,
  custo = {},
  status,
  controleCustos,
} = {}) {
  const temValor = valorDefinido > 0;
  const historico = controleCustos === CONTROLE_CUSTOS.HISTORICO;
  const abatidoNoCredito = abatido > 0;

  let resultadoExibicaoTipo = 'parcial';
  let resultadoExibicaoLabel = 'Resultado do serviço';
  let resultadoExibicaoValor = null;

  if (historico) {
    resultadoExibicaoTipo = 'historico';
    resultadoExibicaoLabel = 'Custos antigos não registados';
  } else if (temValor) {
    resultadoExibicaoValor = roundMoney(valorDefinido - (custo.custoTotal || 0));
    if (isStatusServicoFinal(status) && controleCustos === CONTROLE_CUSTOS.COMPLETO) {
      resultadoExibicaoTipo = resultadoExibicaoValor >= 0 ? 'lucro' : 'prejuizo';
      resultadoExibicaoLabel = resultadoExibicaoValor >= 0 ? 'Resultado do serviço' : 'Resultado do serviço';
    } else {
      resultadoExibicaoTipo = 'parcial';
    }
  }

  return {
    valorOrcamentado: temValor ? valorDefinido : null,
    valorDefinido: temValor ? valorDefinido : null,
    abatidoNoCredito,
    creditoAntesAbatimento: abatidoNoCredito ? creditoRestanteAntes : null,
    creditoDepoisAbatimento: abatidoNoCredito
      ? roundMoney(creditoRestanteAntes - abatido)
      : null,
    resultadoExibicaoTipo,
    resultadoExibicaoLabel,
    resultadoExibicaoValor,
  };
}

function calcMargem(resultado, valor) {
  if (!(valor > 0) || resultado == null || !Number.isFinite(resultado)) return null;
  return roundMoney((resultado / valor) * 100);
}

function weightedMargin(servicos = []) {
  const valorTotal = roundMoney(servicos.reduce((sum, item) => sum + (item.valorAbatido || 0), 0));
  const resultadoTotal = roundMoney(servicos.reduce((sum, item) => sum + (item.resultado || 0), 0));
  if (!(valorTotal > 0)) return null;
  return calcMargem(resultadoTotal, valorTotal);
}

function applyMarginToValor(valor, margemPercent) {
  if (!(valor > 0) || margemPercent == null || !Number.isFinite(margemPercent)) {
    return { lucro: null, custo: null };
  }
  const lucro = roundMoney(valor * (margemPercent / 100));
  const custo = roundMoney(valor - lucro);
  return { lucro, custo };
}

function getEstimativaConfianca(quantidade) {
  if (!quantidade) {
    return {
      nivel: 'nenhuma',
      label: 'sem base',
      representativa: false,
      mensagem: 'Ainda sem serviços com custos completos para estimar.',
    };
  }
  if (quantidade === 1) {
    return {
      nivel: 'baixa',
      label: 'baixa',
      representativa: false,
      mensagem: 'Estimativa ainda pouco representativa',
    };
  }
  if (quantidade < 3) {
    return {
      nivel: 'baixa',
      label: 'baixa',
      representativa: false,
      mensagem: 'Estimativa ainda pouco representativa',
    };
  }
  if (quantidade < 5) {
    return {
      nivel: 'media',
      label: 'média',
      representativa: true,
      mensagem: null,
    };
  }
  return {
    nivel: 'alta',
    label: 'alta',
    representativa: true,
    mensagem: null,
  };
}

function buildCenarios(controlados, saldoRestante, margemAtual) {
  if (!controlados || controlados.length < MIN_SERVICOS_CENARIOS) return null;
  if (margemAtual == null || !(saldoRestante > 0)) return null;

  const below = controlados.filter((item) => (item.margem ?? 0) < margemAtual - 0.05);
  const above = controlados.filter((item) => (item.margem ?? 0) > margemAtual + 0.05);
  if (below.length === 0 && above.length === 0) return null;

  const margemConservadora =
    below.length > 0
      ? weightedMargin(below)
      : roundMoney(Math.min(...controlados.map((item) => item.margem)));
  const margemOtimista =
    above.length > 0
      ? weightedMargin(above)
      : roundMoney(Math.max(...controlados.map((item) => item.margem)));

  if (
    margemConservadora == null ||
    margemOtimista == null ||
    Math.abs(margemOtimista - margemConservadora) < 0.5
  ) {
    return null;
  }

  const toScenario = (margem) => {
    const applied = applyMarginToValor(saldoRestante, margem);
    return {
      margem,
      lucroRestante: applied.lucro,
      custoRestante: applied.custo,
    };
  };

  return {
    conservador: toScenario(margemConservadora),
    atual: toScenario(margemAtual),
    otimista: toScenario(margemOtimista),
  };
}

function calcCustosNaoAtribuidos(obraId, { diarias = [], gastos = [], gastosEmpresa = [], funcionarios = [] } = {}) {
  const diariasNao = asRecordList(diarias).filter(
    (item) => diariaPertenceAObra(item, obraId) && !getDiariaIntervencaoNaObra(item, obraId)
  );
  const gastosNao = asRecordList(gastos).filter((item) => item.obraId === obraId && !item.intervencaoId);
  const empresaNao = asRecordList(gastosEmpresa).filter(
    (item) => item.obraId === obraId && !item.intervencaoId && !isGastoEmpresaPrevisto(item)
  );
  const totalDiarias = roundMoney(
    diariasNao.reduce((sum, item) => sum + getDiariaCustoNaObra(item, obraId, funcionarios), 0)
  );
  const obra = splitGastosPorTipo(gastosNao, gastoObraValor);
  const empresa = splitGastosPorTipo(empresaNao, getGastoEmpresaValor);
  const totalGastos = roundMoney(
    obra.totalMateriais +
      obra.totalHospedagem +
      obra.totalCombustivel +
      obra.totalOutros +
      empresa.totalMateriais +
      empresa.totalHospedagem +
      empresa.totalCombustivel +
      empresa.totalOutros
  );
  return {
    totalDiarias,
    totalGastos,
    total: roundMoney(totalDiarias + totalGastos),
    quantidadeDiarias: diariasNao.reduce((sum, item) => sum + getDiariaQuantidadeNaObra(item, obraId), 0),
    funcionariosEnvolvidos: new Set(diariasNao.map((item) => item.funcionarioId).filter(Boolean)).size,
    diariasCount: diariasNao.length,
    gastosCount: gastosNao.length + empresaNao.length,
  };
}

function emptyPrepaidSummary(obra, credit) {
  const creditoInicial = roundMoney(credit?.creditoInicial || 0);
  return {
    creditoInicial,
    totalAbatido: 0,
    totalUtilizado: 0,
    saldoDisponivel: creditoInicial,
    excedenteTotal: 0,
    encerrado: false,
    ultrapassouCredito: false,
    numeroIntervencoes: 0,
    servicosEmAndamento: [],
    servicosConcluidos: [],
    servicosEmAndamentoCount: 0,
    servicosConcluidosCount: 0,
    quantidadeDiariasObra: 0,
    diariasCountObra: 0,
    gastosCountObra: 0,
    totalDiarias: 0,
    totalMateriais: 0,
    totalHospedagem: 0,
    totalCombustivel: 0,
    totalOutros: 0,
    custoTotalEmpresa: 0,
    historico: [],
    dataInicio: credit?.dataInicio || obra?.dataInicio || obra?.createdAt || null,
    servicosControlados: [],
    servicosHistoricos: [],
    servicosIncompletos: [],
    valorControlado: 0,
    custosControlados: 0,
    custosNovosRegistados: 0,
    lucroConfirmado: 0,
    valorHistoricoSemCustos: 0,
    valorIncompleto: 0,
    margemMediaPonderada: null,
    baseEstimativa: {
      quantidade: 0,
      valorAnalisado: 0,
      margemObservada: null,
      ...getEstimativaConfianca(0),
    },
    lucroEstimadoRestante: null,
    custoEstimadoRestante: null,
    estimativaHistorica: null,
    resultadoEstimadoSemHistorico: null,
    resultadoTotalProjetado: null,
    cenarios: null,
    custosNaoAtribuidos: {
      totalDiarias: 0,
      totalGastos: 0,
      total: 0,
      quantidadeDiarias: 0,
      funcionariosEnvolvidos: 0,
      diariasCount: 0,
      gastosCount: 0,
    },
    saldoInformadoPlanilha:
      credit?.saldoInformadoPlanilha == null ? null : roundMoney(credit.saldoInformadoPlanilha),
    diferencaConferir: null,
    divergenciaStatus: credit?.divergenciaStatus || null,
    percentExecutado: 0,
  };
}

function fallbackServicoResumo(intervencao, running) {
  const valorDefinido = getIntervencaoValorDefinido(intervencao);
  const abatido = getIntervencaoValorAbatido(intervencao);
  const restanteAntes = roundMoney(running);
  const statusCanonico = canonicalIntervencaoStatus(intervencao);
  const periodo = resolvePeriodoServico(intervencao, {});
  return {
    ...(intervencao && typeof intervencao === 'object' ? intervencao : {}),
    ...periodo,
    statusCanonico,
    valorDefinido,
    valorAbatido: abatido,
    creditoRestanteAntes: restanteAntes,
    creditoRestante: roundMoney(restanteAntes - abatido),
    excedente: 0,
    funcionariosDetalhe: [],
    diariasCount: 0,
    gastosCount: 0,
    totalDiarias: 0,
    totalMateriais: 0,
    totalHospedagem: 0,
    totalCombustivel: 0,
    totalOutros: 0,
    custoTotal: 0,
    hasCostRecords: false,
    quantidadeDiarias: 0,
    funcionariosEnvolvidos: 0,
    totalGastos: 0,
    valorOrcamentado: valorDefinido > 0 ? valorDefinido : null,
    abatidoNoCredito: abatido > 0,
    creditoAntesAbatimento: abatido > 0 ? restanteAntes : null,
    creditoDepoisAbatimento: abatido > 0 ? roundMoney(restanteAntes - abatido) : null,
    resultadoExibicaoTipo: 'parcial',
    resultadoExibicaoLabel: 'Resultado do serviço',
    resultadoExibicaoValor: null,
    controleCustos: normalizeControleCustos(intervencao?.controleCustos) || CONTROLE_CUSTOS.EM_REGISTO,
    resultadoCalculavel: false,
    resultado: null,
    margem: null,
  };
}

export function calcPrepaidCreditSummary(
  obra,
  { diarias = [], gastos = [], gastosEmpresa = [], funcionarios = [] } = {}
) {
  const credit = getPrepaidCredit(obra);
  if (!credit?.enabled) return null;

  try {
    return buildPrepaidCreditSummary(obra, credit, { diarias, gastos, gastosEmpresa, funcionarios });
  } catch (err) {
    console.error('[crédito] Falha ao calcular o resumo da obra', obra?.id, err);
    return emptyPrepaidSummary(obra, credit);
  }
}

function buildPrepaidCreditSummary(
  obra,
  credit,
  { diarias = [], gastos = [], gastosEmpresa = [], funcionarios = [] } = {}
) {
  const ctx = { diarias, gastos, gastosEmpresa, funcionarios };
  const creditoInicial = roundMoney(credit.creditoInicial);
  const intervencoes = asIntervencaoList(obra).sort((a, b) => {
    const da = a.periodoInicio || a.data || a.createdAt || '';
    const db = b.periodoInicio || b.data || b.createdAt || '';
    if (da !== db) return String(da).localeCompare(String(db));
    return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
  });

  let running = creditoInicial;
  const historico = intervencoes.map((intervencao) => {
    try {
    const valorDefinido = getIntervencaoValorDefinido(intervencao);
    const abatido = getIntervencaoValorAbatido(intervencao);
    const restanteAntes = roundMoney(running);
    const records = getIntervencaoRecords(intervencao.id, ctx);
    const custo = calcIntervencaoCusto(intervencao.id, ctx);
    const controleCustos = resolveControleCustos(intervencao, custo);
    const periodo = resolvePeriodoServico(intervencao, records);
    const statusCanonico = canonicalIntervencaoStatus({ ...intervencao, controleCustos });
    const calculavel = controleCustos === CONTROLE_CUSTOS.COMPLETO && valorDefinido > 0;
    const resultado = calculavel ? roundMoney(valorDefinido - custo.custoTotal) : null;
    const margem = calculavel ? calcMargem(resultado, valorDefinido) : null;
    const excedente =
      abatido > 0 && restanteAntes < abatido
        ? roundMoney(abatido - Math.max(0, restanteAntes))
        : 0;
    const exibicao = buildServicoExibicao({
      valorDefinido,
      abatido,
      creditoRestanteAntes: restanteAntes,
      custo,
      status: { ...intervencao, controleCustos },
      controleCustos,
    });
    running = roundMoney(restanteAntes - abatido);

    return {
      ...intervencao,
      ...periodo,
      statusCanonico,
      valorDefinido,
      valorAbatido: abatido,
      creditoRestanteAntes: restanteAntes,
      creditoRestante: running,
      excedente,
      funcionariosDetalhe: buildFuncionariosDoServico(records.diarias, funcionarios, intervencao.id),
      diariasCount: records.diarias.length,
      gastosCount: records.gastos.length + records.gastosEmpresa.length,
      ...custo,
      ...exibicao,
      controleCustos,
      resultadoCalculavel: calculavel,
      resultado,
      margem,
    };
    } catch (err) {
      console.error('[crédito] Falha ao processar serviço', intervencao?.id, err);
      const fallback = fallbackServicoResumo(intervencao, running);
      running = fallback.creditoRestante;
      return fallback;
    }
  });

  const totalAbatido = roundMoney(historico.reduce((sum, item) => sum + item.valorAbatido, 0));
  const saldoDisponivel = roundMoney(creditoInicial - totalAbatido);
  const excedenteTotal = roundMoney(Math.max(0, totalAbatido - creditoInicial));

  const servicosControlados = historico.filter((item) => item.resultadoCalculavel);
  const servicosHistoricos = historico.filter(
    (item) => item.controleCustos === CONTROLE_CUSTOS.HISTORICO && item.valorAbatido > 0
  );
  const servicosIncompletos = historico.filter(
    (item) =>
      item.controleCustos === CONTROLE_CUSTOS.EM_REGISTO && item.valorAbatido > 0
  );

  const valorControlado = roundMoney(
    servicosControlados.reduce((sum, item) => sum + item.valorAbatido, 0)
  );
  const custosControlados = roundMoney(
    servicosControlados.reduce((sum, item) => sum + item.custoTotal, 0)
  );
  const custosNovosRegistados = roundMoney(
    historico
      .filter((item) => item.controleCustos !== CONTROLE_CUSTOS.HISTORICO)
      .reduce((sum, item) => sum + (item.custoTotal || 0), 0)
  );
  const lucroConfirmado = roundMoney(
    servicosControlados.reduce((sum, item) => sum + (item.resultado || 0), 0)
  );
  const valorHistoricoSemCustos = roundMoney(
    servicosHistoricos.reduce((sum, item) => sum + item.valorAbatido, 0)
  );
  const valorIncompleto = roundMoney(
    servicosIncompletos.reduce((sum, item) => sum + item.valorAbatido, 0)
  );

  const margemMediaPonderada = weightedMargin(servicosControlados);
  const confianca = getEstimativaConfianca(servicosControlados.length);
  const podeEstimar = margemMediaPonderada != null && servicosControlados.length > 0;
  const restanteAplicado = podeEstimar
    ? applyMarginToValor(Math.max(0, saldoDisponivel), margemMediaPonderada)
    : { lucro: null, custo: null };
  const historicoAplicado = podeEstimar
    ? applyMarginToValor(valorHistoricoSemCustos, margemMediaPonderada)
    : { lucro: null, custo: null };

  const lucroEstimadoRestante = restanteAplicado.lucro;
  const custoEstimadoRestante = restanteAplicado.custo;
  const estimativaHistorica = historicoAplicado.lucro;
  const resultadoEstimadoSemHistorico =
    podeEstimar && lucroEstimadoRestante != null
      ? roundMoney(lucroConfirmado + lucroEstimadoRestante)
      : lucroConfirmado;
  const resultadoTotalProjetado =
    podeEstimar && lucroEstimadoRestante != null
      ? roundMoney(lucroConfirmado + lucroEstimadoRestante + (estimativaHistorica || 0))
      : null;

  const obraDiarias = filterDiariasDaObra(diarias, obra?.id);
  const obraGastos = asRecordList(gastos).filter((item) => item.obraId === obra?.id);
  const obraEmpresa = asRecordList(gastosEmpresa).filter(
    (item) => item.obraId === obra?.id && !isGastoEmpresaPrevisto(item)
  );
  const totalDiarias = roundMoney(
    obraDiarias.reduce((sum, item) => sum + getDiariaCustoNaObra(item, obra.id, funcionarios), 0)
  );
  const custosObra = splitGastosPorTipo(obraGastos, gastoObraValor);
  const custosEmpresa = splitGastosPorTipo(obraEmpresa, getGastoEmpresaValor);
  const totalMateriais = roundMoney(custosObra.totalMateriais + custosEmpresa.totalMateriais);
  const totalHospedagem = roundMoney(custosObra.totalHospedagem + custosEmpresa.totalHospedagem);
  const totalCombustivel = roundMoney(custosObra.totalCombustivel + custosEmpresa.totalCombustivel);
  const totalOutros = roundMoney(custosObra.totalOutros + custosEmpresa.totalOutros);
  const custoTotalEmpresa = roundMoney(
    totalDiarias + totalMateriais + totalHospedagem + totalCombustivel + totalOutros
  );

  const saldoInformadoPlanilha =
    credit.saldoInformadoPlanilha == null ? null : roundMoney(credit.saldoInformadoPlanilha);
  const percentExecutado =
    creditoInicial > 0 ? roundMoney((Math.max(0, totalAbatido) / creditoInicial) * 100) : 0;

  const servicosEmAndamento = historico.filter((item) => isServicoEmAndamento(item));
  const servicosConcluidos = historico.filter((item) => isStatusServicoFinal(item));
  const quantidadeDiariasObra = obraDiarias.reduce(
    (sum, item) => sum + getDiariaQuantidadeNaObra(item, obra.id),
    0
  );

  return {
    creditoInicial,
    totalAbatido,
    totalUtilizado: totalAbatido,
    saldoDisponivel,
    excedenteTotal,
    encerrado: creditoInicial > 0 && saldoDisponivel <= 0,
    ultrapassouCredito: excedenteTotal > 0,
    numeroIntervencoes: intervencoes.length,
    servicosEmAndamento,
    servicosConcluidos,
    servicosEmAndamentoCount: servicosEmAndamento.length,
    servicosConcluidosCount: servicosConcluidos.length,
    quantidadeDiariasObra,
    diariasCountObra: obraDiarias.length,
    gastosCountObra: obraGastos.length + obraEmpresa.length,
    totalDiarias,
    totalMateriais,
    totalHospedagem,
    totalCombustivel,
    totalOutros,
    custoTotalEmpresa,
    historico,
    dataInicio: credit.dataInicio || obra.dataInicio || obra.createdAt || null,
    servicosControlados,
    servicosHistoricos,
    servicosIncompletos,
    valorControlado,
    custosControlados,
    custosNovosRegistados,
    lucroConfirmado,
    valorHistoricoSemCustos,
    valorIncompleto,
    margemMediaPonderada,
    baseEstimativa: {
      quantidade: servicosControlados.length,
      valorAnalisado: valorControlado,
      margemObservada: margemMediaPonderada,
      ...confianca,
    },
    lucroEstimadoRestante,
    custoEstimadoRestante,
    estimativaHistorica,
    resultadoEstimadoSemHistorico,
    resultadoTotalProjetado,
    cenarios: buildCenarios(servicosControlados, Math.max(0, saldoDisponivel), margemMediaPonderada),
    custosNaoAtribuidos: calcCustosNaoAtribuidos(obra?.id, ctx),
    saldoInformadoPlanilha,
    diferencaConferir: null,
    divergenciaStatus: null,
    percentExecutado,
  };
}

export function patchIntervencaoControleCustos(obra, intervencaoId, controleCustos) {
  const current = asIntervencaoList(obra).find((item) => item.id === intervencaoId);
  if (!current) return obra;
  return upsertIntervencao(obra, {
    ...current,
    controleCustos: normalizeControleCustos(controleCustos) || CONTROLE_CUSTOS.EM_REGISTO,
  });
}

export function getIntervencaoNome(intervencao) {
  const nome = String(intervencao?.descricao || '').trim();
  if (nome) return nome;
  return getIntervencaoPeriodoLabel(intervencao);
}

export function getIntervencaoPeriodoLabel(intervencao) {
  const storedLabel = intervencao?.periodoLabel;
  if (storedLabel && typeof storedLabel !== 'object') return String(storedLabel);
  const ranged = formatPeriodoRange(intervencao?.periodoInicio, intervencao?.periodoFim);
  if (ranged) return ranged;
  return intervencao?.descricao || 'Serviço';
}

function formatSemanaTitulo(iso) {
  const parts = parseISODateParts(iso);
  if (!parts) return '';
  return `Semana ${String(parts.d).padStart(2, '0')}/${String(parts.mo).padStart(2, '0')}`;
}

/** Campos que o cliente pode ver. Não inclui custos, diárias, lucro nem margem. */
export function getIntervencaoClienteResumo(intervencao) {
  const titulo =
    String(intervencao?.descricao || '').trim() ||
    formatSemanaTitulo(intervencao?.periodoInicio || intervencao?.data) ||
    getIntervencaoNome(intervencao);
  const periodo = getIntervencaoPeriodoLabel(intervencao);
  const valor =
    Number(intervencao?.valorDefinido) > 0
      ? Number(intervencao.valorDefinido)
      : Number(intervencao?.valorOrcamentado) > 0
        ? Number(intervencao.valorOrcamentado)
        : Number(intervencao?.valorAbatido) > 0
          ? Number(intervencao.valorAbatido)
          : null;
  const abatido = isIntervencaoAbatida(intervencao);
  return {
    titulo,
    periodo: periodo || '—',
    valor,
    status: abatido ? INTERVENCAO_STATUS_LABELS[INTERVENCAO_STATUS.ABATIDO] : getIntervencaoStatusLabel(intervencao),
    abatidoNoCredito: abatido,
  };
}

function dataTransferenciaPt(iso) {
  const [ano, mes, dia] = String(iso || '').slice(0, 10).split('-');
  if (!ano || !mes || !dia) return String(iso || '');
  return `${dia}/${mes}/${ano}`;
}

function notaTransferenciaServico(dataIso) {
  return `Serviço inicialmente destinado a abatimento no crédito.\nTransferido para Obras Normais em ${dataTransferenciaPt(dataIso)}.`;
}

/** Monta uma obra normal com os dados do serviço. Não altera a obra de crédito. */
export function montarObraNormalDesdeServicoCredito(obraCredito, intervencao, dataIso = getTodayISO()) {
  if (!obraCredito || !intervencao) return null;
  const valor = getIntervencaoValorDefinido(intervencao);
  const nota = notaTransferenciaServico(dataIso);
  const observacaoServico = String(intervencao.observacoes || '').trim();
  const extras = asRecordList(obraCredito.extras).filter((item) => item.intervencaoId === intervencao.id);

  return {
    nome: getIntervencaoNome(intervencao),
    cliente: String(obraCredito.cliente || obraCredito.nome || '').trim(),
    telefone: String(obraCredito.telefone || '').trim(),
    morada: String(obraCredito.morada || '').trim(),
    valorContratado: valor > 0 ? valor : null,
    dataInicio: intervencao.periodoInicio || intervencao.data || obraCredito.dataInicio || null,
    dataPrevistaTermino: intervencao.periodoFim || null,
    estado: 'Em andamento',
    motivoPausa: '',
    observacoes: [observacaoServico, nota].filter(Boolean).join('\n\n'),
    tipoObra: 'normal',
    financialModel: 'conventional',
    extras: extras.map((item) => {
      const { intervencaoId: _ignorado, ...resto } = item;
      return resto;
    }),
    servicoOrigemCredito: {
      ...intervencao,
      obraCreditoId: obraCredito.id,
      obraCreditoNome: obraCredito.nome || '',
      transferidoEm: dataIso,
    },
  };
}

export function reatribuirDiariaAoSairDoCredito(diaria, intervencaoId, obraOrigemId, obraDestinoId) {
  if (!diaria || !diariaTemIntervencao(diaria, intervencaoId)) return diaria;
  const now = new Date().toISOString();
  if (isDiariaMultiObra(diaria)) {
    const obrasDoDia = getDiariaAlocacoes(diaria).map((alocacao) => {
      if (alocacao.intervencaoId !== intervencaoId) return alocacao;
      return { ...alocacao, obraId: obraDestinoId, intervencaoId: null };
    });
    const principal = obrasDoDia[0] || {};
    return {
      ...diaria,
      obrasDoDia,
      obraId: principal.obraId || diaria.obraId,
      intervencaoId: principal.intervencaoId || null,
      updatedAt: now,
    };
  }
  if (diaria.obraId && diaria.obraId !== obraOrigemId) return diaria;
  return { ...diaria, obraId: obraDestinoId, intervencaoId: null, updatedAt: now };
}

export function reatribuirLancamentoAoSairDoCredito(lancamento, intervencaoId, obraOrigemId, obraDestinoId) {
  if (!lancamento || lancamento.intervencaoId !== intervencaoId) return lancamento;
  if (lancamento.obraId && lancamento.obraId !== obraOrigemId) return lancamento;
  return {
    ...lancamento,
    obraId: obraDestinoId,
    intervencaoId: null,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Tira o serviço do crédito e devolve a obra de crédito sem ele,
 * mais a obra normal e os registos que passam a pertencer-lhe.
 * Não duplica o serviço nem mexe noutras obras.
 */
export function transferirServicoCreditoParaObraNormal(
  obraCredito,
  intervencaoId,
  { diarias = [], gastos = [], gastosEmpresa = [], pagamentos = [], obraDestinoId, dataIso = getTodayISO() } = {}
) {
  const intervencao = asIntervencaoList(obraCredito).find((item) => item.id === intervencaoId);
  if (!obraCredito || !intervencao || !obraDestinoId) return null;

  const novaObra = montarObraNormalDesdeServicoCredito(obraCredito, intervencao, dataIso);
  const extrasRestantes = asRecordList(obraCredito.extras).filter((item) => item.intervencaoId !== intervencaoId);
  const obraAtualizada = {
    ...removeIntervencao(obraCredito, intervencaoId),
    extras: extrasRestantes,
  };

  return {
    obraCredito: obraAtualizada,
    novaObra: { ...novaObra, id: obraDestinoId },
    diarias: asRecordList(diarias).map((item) =>
      reatribuirDiariaAoSairDoCredito(item, intervencaoId, obraCredito.id, obraDestinoId)
    ),
    gastos: asRecordList(gastos).map((item) =>
      reatribuirLancamentoAoSairDoCredito(item, intervencaoId, obraCredito.id, obraDestinoId)
    ),
    gastosEmpresa: asRecordList(gastosEmpresa).map((item) =>
      reatribuirLancamentoAoSairDoCredito(item, intervencaoId, obraCredito.id, obraDestinoId)
    ),
    pagamentos: asRecordList(pagamentos).map((item) =>
      reatribuirLancamentoAoSairDoCredito(item, intervencaoId, obraCredito.id, obraDestinoId)
    ),
  };
}

export function getServicosAbatimentoOptions(obra) {
  return asIntervencaoList(obra)
    .filter((item) => normalizeControleCustos(item.controleCustos) !== CONTROLE_CUSTOS.HISTORICO)
    .slice()
    .sort((a, b) => String(b.createdAt || b.data || '').localeCompare(String(a.createdAt || a.data || '')))
    .map((item) => ({
      id: item.id,
      label: getIntervencaoNome(item),
      valorFinal: item.valorFinal,
      status: item.status,
    }));
}

export function getSaldoAntesDaIntervencao(summary, intervencaoId) {
  if (!summary) return 0;
  const item = (summary.historico || []).find((entry) => entry.id === intervencaoId);
  if (!item) return roundMoney(summary.saldoDisponivel);
  return roundMoney(item.creditoRestanteAntes);
}
