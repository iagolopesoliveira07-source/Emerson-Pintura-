import { generateId } from '../services/storageService';
import { roundMoney } from './ivaCalculations';
import { isDateInPeriod } from './periodFilter';
import { validateForm, validateNumber, validateRequired, validateDate } from './validators';

export const EXTRA_STATUS = {
  A_COBRAR: 'a_cobrar',
  RECEBIDO: 'recebido',
  PENDENTE: 'pendente',
  COBRADO: 'cobrado',
};

export const EXTRA_STATUS_LABELS = {
  [EXTRA_STATUS.A_COBRAR]: 'A cobrar',
  [EXTRA_STATUS.RECEBIDO]: 'Recebido',
  [EXTRA_STATUS.PENDENTE]: 'A cobrar',
  [EXTRA_STATUS.COBRADO]: 'A cobrar',
};

export const EXTRA_STATUS_OPTIONS = [EXTRA_STATUS.A_COBRAR, EXTRA_STATUS.RECEBIDO];

export function normalizeExtraStatus(status) {
  const value = String(status || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (value === EXTRA_STATUS.RECEBIDO || value === 'pago' || value === 'recebida') {
    return EXTRA_STATUS.RECEBIDO;
  }
  return EXTRA_STATUS.A_COBRAR;
}

export function isExtraRecebido(extraOrStatus) {
  const status = extraOrStatus && typeof extraOrStatus === 'object' ? extraOrStatus.status : extraOrStatus;
  return normalizeExtraStatus(status) === EXTRA_STATUS.RECEBIDO;
}

export function getExtraStatusLabel(status) {
  return EXTRA_STATUS_LABELS[normalizeExtraStatus(status)];
}

export function getExtraStatusVariant(status) {
  return isExtraRecebido(status) ? 'success' : 'warning';
}

export function getExtraDate(extra) {
  if (!extra) return '';
  const raw = extra.data || extra.createdAt || extra.cobradoAt || extra.recebidoAt || '';
  const date = String(raw).slice(0, 10);
  return date || '';
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function timestampsForStatus(previous, status) {
  const now = new Date().toISOString();
  const cobradoAt = previous?.cobradoAt || null;
  const recebidoAt = previous?.recebidoAt || null;

  if (status === EXTRA_STATUS.RECEBIDO) {
    return {
      cobradoAt: cobradoAt || previous?.createdAt || now,
      recebidoAt: recebidoAt || now,
    };
  }

  return {
    cobradoAt: cobradoAt || previous?.createdAt || now,
    recebidoAt,
  };
}

function shapeExtra(item) {
  if (!item || typeof item !== 'object') return null;
  const status = normalizeExtraStatus(item.status);
  return {
    ...item,
    descricao: String(item.descricao || '').trim(),
    valor: roundMoney(Number(item.valor) || 0),
    data: getExtraDate(item),
    status,
    observacao: String(item.observacao || '').trim(),
  };
}

export function getObraExtras(obra) {
  if (!Array.isArray(obra?.extras)) return [];
  return obra.extras.map(shapeExtra).filter(Boolean);
}

export function createObraExtra(input = {}, previous = null) {
  const now = new Date().toISOString();
  const status = normalizeExtraStatus(input.status ?? previous?.status);
  const stamps = timestampsForStatus(previous || input, status);
  const data = getExtraDate({ ...previous, ...input, data: input.data || previous?.data || todayISO() });

  return {
    ...(previous || {}),
    id: input.id || previous?.id || generateId(),
    descricao: String(input.descricao ?? previous?.descricao ?? '').trim(),
    valor: roundMoney(Number(input.valor ?? previous?.valor) || 0),
    data,
    status,
    observacao: String(input.observacao ?? previous?.observacao ?? '').trim(),
    createdAt: previous?.createdAt || input.createdAt || now,
    updatedAt: now,
    cobradoAt: stamps.cobradoAt,
    recebidoAt: stamps.recebidoAt,
  };
}

export function validateObraExtraForm(form) {
  return validateForm({
    descricao: validateRequired(form?.descricao, 'Nome/descrição do serviço'),
    valor: validateNumber(form?.valor, 'Valor cobrado', 0.01),
    data: validateRequired(form?.data, 'Data') || validateDate(form?.data, 'Data'),
  });
}

export function upsertObraExtra(obra, extraInput) {
  if (!obra) return obra;
  const stored = Array.isArray(obra.extras) ? obra.extras.filter((item) => item && typeof item === 'object') : [];
  const existing = extraInput?.id ? stored.find((item) => item.id === extraInput.id) : null;
  const extra = createObraExtra(extraInput, existing);
  const extras = existing
    ? stored.map((item) => (item.id === extra.id ? extra : item))
    : [...stored, extra];

  return {
    ...obra,
    extras,
    updatedAt: new Date().toISOString(),
  };
}

export function removeObraExtra(obra, extraId) {
  if (!obra) return obra;
  const stored = Array.isArray(obra.extras) ? obra.extras.filter((item) => item && typeof item === 'object') : [];
  return {
    ...obra,
    extras: stored.filter((item) => item.id !== extraId),
    updatedAt: new Date().toISOString(),
  };
}

export function setObraExtraStatus(obra, extraId, status) {
  const extra = (Array.isArray(obra?.extras) ? obra.extras : []).find((item) => item?.id === extraId);
  if (!extra) return obra;
  return upsertObraExtra(obra, { ...extra, status: normalizeExtraStatus(status) });
}

export function summarizeObraExtras(obra) {
  const extras = getObraExtras(obra);
  let aCobrar = 0;
  let recebido = 0;

  extras.forEach((extra) => {
    const valor = roundMoney(Number(extra.valor) || 0);
    if (isExtraRecebido(extra)) recebido += valor;
    else aCobrar += valor;
  });

  aCobrar = roundMoney(aCobrar);
  recebido = roundMoney(recebido);
  const total = roundMoney(aCobrar + recebido);

  return {
    extras,
    quantidade: extras.length,
    aCobrar,
    recebido,
    total,
    cobrado: aCobrar,
    pendente: 0,
    confirmados: total,
  };
}

function obraUsaSaldoSeparadoDeExtra(obra) {
  return obra?.tipoObra === 'parceria' || obra?.partnership?.enabled === true;
}

function obraSemDevedorConvencional(obra) {
  if (!obra) return false;
  if (obra.financialModel === 'prepaid_credit' || obra.prepaidCredit?.enabled === true) return true;
  if (obra.financialModel === 'lodging_offset' || obra.specialKey === 'apto_tavira') return true;
  if (obra.tipoObra === 'especial_tavira') return true;
  const nome = String(obra.nome || '').toLowerCase();
  const cliente = String(obra.cliente || '').toLowerCase();
  return nome.includes('tavira') || cliente.includes('tavira');
}

/**
 * Uma obra, um saldo.
 * Valor total = valor inicial + extras.
 * Recebido = pagamentos registados.
 * Falta receber = valor total − recebido, sem ficar negativo.
 * Obras em parceria mantêm o cálculo anterior.
 */
export function saldoObraComExtras(obra, valorRecebidoPagamentos = 0, valorInicial = null) {
  const extras = summarizeObraExtras(obra);
  const valorOriginal = roundMoney(
    valorInicial != null ? Number(valorInicial) || 0 : Number(obra?.valorContratado) || 0
  );
  const valorAtualizado = roundMoney(valorOriginal + extras.total);
  const recebidoPagamentos = roundMoney(Number(valorRecebidoPagamentos) || 0);

  if (obraUsaSaldoSeparadoDeExtra(obra)) {
    return {
      extras,
      valorOriginal,
      valorAtualizado,
      valorRecebido: roundMoney(recebidoPagamentos + extras.recebido),
      valorRestante: roundMoney(Math.max(0, valorOriginal - recebidoPagamentos) + extras.aCobrar),
    };
  }

  return {
    extras,
    valorOriginal,
    valorAtualizado,
    valorRecebido: recebidoPagamentos,
    valorRestante: roundMoney(Math.max(0, valorAtualizado - recebidoPagamentos)),
  };
}

export function applyObraExtrasToResumo(obra, resumo = {}) {
  const saldo = saldoObraComExtras(obra, resumo.valorRecebido || 0, resumo.valorContratado || 0);
  const { extras, valorOriginal, valorAtualizado, valorRecebido, valorRestante } = saldo;
  const temValor = valorAtualizado > 0.005 || valorOriginal > 0.005;
  const semDevedor = obraSemDevedorConvencional(obra);

  return {
    ...resumo,
    valorRecebido,
    valorRestante,
    isPago: temValor && valorRestante <= 0.005,
    isParcial: valorRecebido > 0.005 && valorRestante > 0.005,
    isPendente: !semDevedor && valorRestante > 0.005,
    extras,
    valorOriginal,
    valorAtualizado,
  };
}

export function applyObraExtrasToPosicao(posicao = {}, obra) {
  const extras = summarizeObraExtras(obra);
  const valorOriginal = roundMoney(posicao.valorContratado || 0);
  const valorAtualizado = roundMoney(valorOriginal + extras.total);

  if (obraUsaSaldoSeparadoDeExtra(obra)) {
    const valorRecebido = roundMoney((posicao.valorRecebido || 0) + extras.recebido);
    const restanteBase = posicao.valorRestante;
    const valorRestante =
      restanteBase == null && extras.aCobrar <= 0.004
        ? restanteBase
        : roundMoney((restanteBase || 0) + extras.aCobrar);

    return {
      ...posicao,
      valorContratado: valorOriginal,
      valorObraAtualizado: valorAtualizado,
      valorRecebido,
      valorRestante,
      informado: Boolean(posicao.informado) || extras.total > 0.004,
      extras,
    };
  }

  const valorRecebido = roundMoney(posicao.valorRecebido || 0);
  const valorRestante =
    posicao.valorRestante == null && extras.total <= 0.004
      ? posicao.valorRestante
      : roundMoney(Math.max(0, valorAtualizado - valorRecebido));

  return {
    ...posicao,
    valorContratado: valorOriginal,
    valorObraAtualizado: valorAtualizado,
    valorRecebido,
    valorRestante,
    informado: Boolean(posicao.informado) || extras.total > 0.004,
    extras,
  };
}

export function extraFaturadoNoPeriodo(extra, range) {
  if (!extra) return 0;
  const data = getExtraDate(extra) || extra.cobradoAt || extra.recebidoAt || extra.createdAt;
  if (!isDateInPeriod(data, range)) return 0;
  return roundMoney(Number(extra.valor) || 0);
}

export function extraRecebidoNoPeriodo(extra, range) {
  if (!isExtraRecebido(extra)) return 0;
  const data = extra.recebidoAt || extra.updatedAt || getExtraDate(extra) || extra.createdAt;
  if (!isDateInPeriod(data, range)) return 0;
  return roundMoney(Number(extra.valor) || 0);
}

export function somarExtrasObrasNoPeriodo(obras = [], range) {
  let faturado = 0;
  let recebido = 0;

  obras.forEach((obra) => {
    getObraExtras(obra).forEach((extra) => {
      faturado += extraFaturadoNoPeriodo(extra, range);
      recebido += extraRecebidoNoPeriodo(extra, range);
    });
  });

  return {
    faturado: roundMoney(faturado),
    recebido: roundMoney(recebido),
  };
}

export function somarExtrasObraNoPeriodo(obra, range) {
  return somarExtrasObrasNoPeriodo(obra ? [obra] : [], range);
}

export function mapObraExtrasRecebidosForChart(obras = [], dateRange = {}) {
  const range = {
    inicio: dateRange.startDate || dateRange.inicio || null,
    fim: dateRange.endDate || dateRange.fim || null,
  };

  return obras.flatMap((obra) =>
    getObraExtras(obra)
      .filter((extra) => extraRecebidoNoPeriodo(extra, range) > 0)
      .map((extra) => ({
        data: String(extra.recebidoAt || extra.updatedAt || getExtraDate(extra) || extra.createdAt || '').slice(0, 10),
        valor: roundMoney(Number(extra.valor) || 0),
        obraId: obra.id,
      }))
      .filter((item) => item.data)
  );
}

export function buildObraExtrasDisplay(obra, posicao = null) {
  const extras = posicao?.extras || summarizeObraExtras(obra);
  const saldo = saldoObraComExtras(obra, 0, posicao?.valorContratado ?? obra?.valorContratado ?? 0);
  const valorOriginal = posicao?.valorContratado ?? saldo.valorOriginal;

  return {
    valorOriginal,
    totalExtras: extras.total,
    extrasPendentes: extras.aCobrar,
    extrasACobrar: extras.aCobrar,
    extrasConfirmados: extras.total,
    extrasRecebidos: extras.recebido,
    valorAtualizado: posicao?.valorObraAtualizado ?? saldo.valorAtualizado,
    recebido: posicao?.valorRecebido ?? saldo.valorRecebido,
    aReceber: posicao?.valorRestante ?? saldo.valorRestante,
    extras,
  };
}
