import { generateId } from '../services/storageService';
import { normalizeObraStatus } from './obraStatus';
import { buildObraPaymentRecord } from './obraPagamentoCalculations';
import { TIPO_OBRA } from './obraTipo';
import { applyObraExtrasToResumo } from './obraExtras';

/** Local: evita ciclo com obraSpecial → obraPartnership → debtCalculations. */
function isObraSemDevedorConvencional(obra) {
  if (!obra) return false;
  if (obra.financialModel === 'prepaid_credit' || obra.prepaidCredit?.enabled === true) return true;
  if (obra.financialModel === 'lodging_offset' || obra.specialKey === 'apto_tavira') return true;
  if (obra.tipoObra === TIPO_OBRA.ESPECIAL_TAVIRA) return true;
  const nome = String(obra.nome || '').toLowerCase();
  const cliente = String(obra.cliente || '').toLowerCase();
  return nome.includes('tavira') || cliente.includes('tavira');
}

export const RECEBIMENTO_STATUS = {
  PAGO: 'pago',
  PENDENTE: 'pendente',
  PARCIAL: 'parcial',
  CANCELADO: 'cancelado',
};

export const PARCELA_STATUS = {
  PAGA: 'Paga',
  PARCIAL: 'Parcialmente paga',
  PENDENTE: 'Pendente',
  VENCIDA: 'Vencida',
  PROXIMA: 'Próxima do vencimento',
};

export const DEBT_STATUS = {
  EM_ABERTO: 'Em aberto',
  EM_ATRASO: 'Em atraso',
  VENCE_HOJE: 'Vence hoje',
  PROXIMO: 'Próximo do vencimento',
  PAGO: 'Pago',
  PARCIAL: 'Parcialmente paga',
  PENDENTE: 'Pendente',
};

export const DEVEDOR_STATUS = {
  A_RECEBER: 'A receber',
};

export function getPagamentoStatus(pagamento) {
  return pagamento?.status || RECEBIMENTO_STATUS.PAGO;
}

export function getValorRecebidoPagamento(pagamento) {
  if (!pagamento || pagamento.tipo !== 'Recebimento de cliente') return 0;

  const status = getPagamentoStatus(pagamento);
  if (status === RECEBIMENTO_STATUS.PENDENTE) return pagamento.valorRecebido || 0;
  if (status === RECEBIMENTO_STATUS.CANCELADO) return pagamento.valorRecebido || 0;

  return pagamento.valorRecebido ?? pagamento.valor ?? 0;
}

export function getValorRestantePagamento(pagamento) {
  if (!pagamento || pagamento.tipo !== 'Recebimento de cliente') return 0;
  const status = getPagamentoStatus(pagamento);
  if (status === RECEBIMENTO_STATUS.PAGO) return 0;

  return Math.max(0, (pagamento.valor || 0) - (pagamento.valorRecebido || 0));
}

export function isRecebimentoEmAberto(pagamento) {
  if (!pagamento || pagamento.tipo !== 'Recebimento de cliente') return false;
  const status = getPagamentoStatus(pagamento);
  if (status === RECEBIMENTO_STATUS.PAGO) return false;
  if (status === RECEBIMENTO_STATUS.CANCELADO) return false;
  return getValorRestantePagamento(pagamento) > 0;
}

export function isObraParcela(pagamento) {
  return (
    pagamento?.tipo === 'Recebimento de cliente' &&
    Boolean(pagamento.parcelaNumero || pagamento.planoId || pagamento.dataVencimento)
  );
}

export function getObraParcelas(obraId, pagamentos) {
  return (pagamentos || [])
    .filter((p) => p && p.obraId === obraId && isObraParcela(p))
    .sort((a, b) => (a.parcelaNumero || 0) - (b.parcelaNumero || 0));
}

export function obraHasInstallmentPlan(obraId, pagamentos) {
  return getObraParcelas(obraId, pagamentos).length > 0;
}

function toDateString(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function daysBetween(start, end) {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  return Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));
}

export function addMonthsToDate(dateStr, months) {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

export function computeDebtStatus(dataVencimento, referenceDate = new Date()) {
  if (!dataVencimento) return DEBT_STATUS.EM_ABERTO;

  const ref = toDateString(referenceDate);
  if (dataVencimento < ref) return DEBT_STATUS.EM_ATRASO;
  if (dataVencimento === ref) return DEBT_STATUS.VENCE_HOJE;

  const daysUntil = daysBetween(ref, dataVencimento);
  if (daysUntil <= 7) return DEBT_STATUS.PROXIMO;

  return DEBT_STATUS.EM_ABERTO;
}

export function computeParcelaStatus(pagamento, referenceDate = new Date()) {
  const restante = getValorRestantePagamento(pagamento);
  const recebido = getValorRecebidoPagamento(pagamento);

  if (restante <= 0.001) return PARCELA_STATUS.PAGA;
  if (recebido > 0) return PARCELA_STATUS.PARCIAL;

  const debtStatus = computeDebtStatus(pagamento.dataVencimento, referenceDate);
  if (debtStatus === DEBT_STATUS.EM_ATRASO) return PARCELA_STATUS.VENCIDA;
  if (debtStatus === DEBT_STATUS.PROXIMO || debtStatus === DEBT_STATUS.VENCE_HOJE) {
    return PARCELA_STATUS.PROXIMA;
  }

  return PARCELA_STATUS.PENDENTE;
}

export function parcelaStatusVariant(status) {
  if (status === PARCELA_STATUS.PAGA) return 'success';
  if (status === PARCELA_STATUS.PARCIAL) return 'primary';
  if (status === PARCELA_STATUS.VENCIDA) return 'danger';
  if (status === PARCELA_STATUS.PROXIMA) return 'warning';
  return 'default';
}

export function devedorStatusVariant() {
  return 'warning';
}

/** Resumo financeiro de recebimentos por obra (fonte única para Devedores e Obras). */
export function calcObraRecebimentoResumo(obra, pagamentos) {
  const valorContratado = obra?.valorContratado || 0;
  const valorRecebido = (pagamentos || [])
    .filter((p) => p && p.obraId === obra?.id && p.tipo === 'Recebimento de cliente')
    .reduce((sum, p) => sum + getValorRecebidoPagamento(p), 0);
  const valorRestante = Math.max(0, valorContratado - valorRecebido);
  const special = isObraSemDevedorConvencional(obra);

  return {
    valorContratado,
    valorRecebido,
    valorRestante,
    isPago: valorContratado > 0 && valorRestante <= 0.001,
    isParcial: valorRecebido > 0.001 && valorRestante > 0.001,
    isPendente: !special && valorContratado > 0 && valorRestante > 0.001,
  };
}

export function computeDiasAtraso(dataVencimento, referenceDate = new Date()) {
  if (!dataVencimento) return 0;
  const ref = toDateString(referenceDate);
  if (dataVencimento >= ref) return 0;
  return daysBetween(dataVencimento, ref);
}

export function getObraParcelasSummary(obra, pagamentos, referenceDate = new Date()) {
  const parcelas = getObraParcelas(obra.id, pagamentos);

  return parcelas.reduce(
    (summary, parcela) => {
      const status = computeParcelaStatus(parcela, referenceDate);
      const recebido = getValorRecebidoPagamento(parcela);
      const restante = getValorRestantePagamento(parcela);

      return {
        totalParcelas: summary.totalParcelas + 1,
        pagas: summary.pagas + (status === PARCELA_STATUS.PAGA ? 1 : 0),
        emAberto: summary.emAberto + (restante > 0 ? 1 : 0),
        emAtraso: summary.emAtraso + (status === PARCELA_STATUS.VENCIDA ? 1 : 0),
        valorRecebido: summary.valorRecebido + recebido,
        valorAReceber: summary.valorAReceber + restante,
        valorTotalParcelas: summary.valorTotalParcelas + (parcela.valor || 0),
      };
    },
    {
      totalParcelas: 0,
      pagas: 0,
      emAberto: 0,
      emAtraso: 0,
      valorRecebido: 0,
      valorAReceber: 0,
      valorTotalParcelas: 0,
    }
  );
}

export function validateParcelasSum(obra, parcelas) {
  const total = parcelas.reduce((sum, item) => sum + (item.valor || 0), 0);
  const contratado = obra.valorContratado || 0;
  const diff = Math.abs(total - contratado);

  return {
    isValid: diff <= 0.01,
    total,
    contratado,
    diff,
  };
}

export function canDeleteParcela(pagamento) {
  const recebido = getValorRecebidoPagamento(pagamento);
  const historico = pagamento?.historicoPagamentos || [];
  return recebido <= 0 && historico.length === 0;
}

function isObraDebtEligible(estado) {
  return normalizeObraStatus(estado) !== 'Cancelada';
}

function buildObraDebtItem(obra, resumo) {
  return {
    id: `obra-${obra.id}`,
    pagamentoId: null,
    isLegacy: true,
    isObraLevel: true,
    obraId: obra.id,
    cliente: obra.cliente,
    obraNome: obra.nome,
    valorTotal: resumo.valorAtualizado ?? resumo.valorContratado,
    valorParcela: resumo.valorContratado,
    valorPago: resumo.valorRecebido,
    valorRestante: resumo.valorRestante,
    parcelaNumero: 1,
    parcelaTotal: 1,
    parcelaLabel: '—',
    status: PARCELA_STATUS.PENDENTE,
    displayStatus: DEVEDOR_STATUS.A_RECEBER,
    isParcial: resumo.isParcial,
    metodoPagamento: null,
    observacao: '',
    descricao: `Saldo a receber — ${obra.nome}`,
    historicoPagamentos: [],
    pagamento: null,
  };
}

function buildDebtItem({
  id,
  pagamentoId = null,
  isLegacy = false,
  obra,
  pagamento = null,
  valorRestante,
  valorPagoOverride = null,
  referenceDate,
}) {
  const dataVencimento = pagamento?.dataVencimento || obra.dataPrevistaTermino || null;
  const parcelaNumero = pagamento?.parcelaNumero || 1;
  const parcelaTotal = pagamento?.parcelaTotal || 1;
  const valorPago =
    valorPagoOverride != null
      ? valorPagoOverride
      : pagamento
        ? getValorRecebidoPagamento(pagamento)
        : 0;
  const parcelaStatus = pagamento
    ? computeParcelaStatus(pagamento, referenceDate)
    : computeDebtStatus(dataVencimento, referenceDate) === DEBT_STATUS.EM_ATRASO
      ? PARCELA_STATUS.VENCIDA
      : PARCELA_STATUS.PENDENTE;

  return {
    id,
    pagamentoId,
    isLegacy,
    obraId: obra.id,
    cliente: obra.cliente,
    obraNome: obra.nome,
    valorTotal: obra.valorContratado || 0,
    valorParcela: pagamento?.valor ?? (isLegacy ? obra.valorContratado || valorRestante : valorRestante),
    valorPago,
    valorRestante,
    parcelaNumero,
    parcelaTotal,
    parcelaLabel: `${parcelaNumero}/${parcelaTotal}`,
    dataVencimento,
    diasAtraso: computeDiasAtraso(dataVencimento, referenceDate),
    status: parcelaStatus,
    metodoPagamento: pagamento?.metodoPagamento || null,
    observacao: pagamento?.observacao || '',
    descricao: pagamento?.descricao || `Saldo em aberto — ${obra.nome}`,
    historicoPagamentos: pagamento?.historicoPagamentos || [],
    pagamento,
  };
}

export function getOpenDebts(obras, pagamentos) {
  const debts = (obras || [])
    .filter((obra) => obra && isObraDebtEligible(obra.estado))
    .map((obra) => {
      const resumo = applyObraExtrasToResumo(obra, calcObraRecebimentoResumo(obra, pagamentos));
      if (!resumo.isPendente) return null;
      return buildObraDebtItem(obra, resumo);
    })
    .filter(Boolean);

  return sortDebts(debts);
}

export function sortDebts(debts) {
  return [...debts].sort((a, b) => {
    if (b.valorRestante !== a.valorRestante) return b.valorRestante - a.valorRestante;
    return a.cliente.localeCompare(b.cliente, 'pt-PT');
  });
}

export function filterDebts(debts, filters = {}) {
  const { status = 'todos', cliente = '', obraId = '', search = '' } = filters;

  const searchTerm = search.trim().toLowerCase();

  return debts.filter((debt) => {
    if (status === 'parcial' && !debt.isParcial) return false;
    if (status === 'pendente' && debt.isParcial) return false;

    if (cliente && debt.cliente !== cliente) return false;
    if (obraId && debt.obraId !== obraId) return false;

    if (searchTerm) {
      const haystack = `${debt.cliente} ${debt.obraNome}`.toLowerCase();
      if (!haystack.includes(searchTerm)) return false;
    }

    return true;
  });
}

export function getDebtSummary(debts) {
  const totalAReceber = debts.reduce((sum, debt) => sum + debt.valorRestante, 0);
  const clientes = new Set(debts.map((debt) => debt.cliente));

  return {
    totalAReceber,
    obrasPendentes: debts.length,
    parcelasEmAberto: debts.length,
    clientesDevedores: clientes.size,
  };
}

export function validateDebtPayment(debt, amount) {
  if (!debt) return { isValid: false, message: 'Registo inválido.' };
  if (!amount || amount <= 0) return { isValid: false, message: 'Informe um valor válido.' };
  if (amount - debt.valorRestante > 0.001) {
    return {
      isValid: false,
      message: `O valor não pode exceder ${debt.valorRestante.toFixed(2)} €.`,
    };
  }
  return { isValid: true };
}

export function buildLegacyPaymentRecord(obra, amount, details, pagamentos = []) {
  return buildObraPaymentRecord(obra, amount, details, pagamentos);
}

export function recalculateParcelaFromHistorico(pagamento) {
  const historico = pagamento.historicoPagamentos || [];
  const valorRecebido = historico.reduce((sum, entry) => sum + (entry.valor || 0), 0);
  const fullyPaid = valorRecebido >= (pagamento.valor || 0) - 0.001;
  const lastPayment = historico[historico.length - 1];

  return {
    ...pagamento,
    valorRecebido,
    status: fullyPaid
      ? RECEBIMENTO_STATUS.PAGO
      : valorRecebido > 0
        ? RECEBIMENTO_STATUS.PARCIAL
        : RECEBIMENTO_STATUS.PENDENTE,
    data: fullyPaid ? lastPayment?.data || pagamento.data : null,
    updatedAt: new Date().toISOString(),
  };
}

export function applyPaymentToInstallment(pagamento, amount, details) {
  const valorRestante = getValorRestantePagamento(pagamento);
  const paymentAmount = Math.min(amount, valorRestante);
  const historicoEntry = {
    id: generateId(),
    data: details.data,
    valor: paymentAmount,
    metodoPagamento: details.metodoPagamento || 'Transferência',
    observacao: details.observacao || '',
  };

  return recalculateParcelaFromHistorico({
    ...pagamento,
    metodoPagamento: details.metodoPagamento || pagamento.metodoPagamento,
    observacao: details.observacao || pagamento.observacao,
    historicoPagamentos: [...(pagamento.historicoPagamentos || []), historicoEntry],
  });
}

export function removeHistoricoPayment(pagamento, historicoId) {
  const historico = (pagamento.historicoPagamentos || []).filter((entry) => entry.id !== historicoId);
  return recalculateParcelaFromHistorico({
    ...pagamento,
    historicoPagamentos: historico,
  });
}

export function updateHistoricoPayment(pagamento, historicoId, updates) {
  const historico = (pagamento.historicoPagamentos || []).map((entry) =>
    entry.id === historicoId
      ? {
          ...entry,
          ...updates,
          valor: parseFloat(updates.valor),
        }
      : entry
  );

  return recalculateParcelaFromHistorico({
    ...pagamento,
    historicoPagamentos: historico,
  });
}

export function buildParcelaRecord(obra, data, { parcelaNumero, parcelaTotal, planoId }) {
  return {
    id: generateId(),
    tipo: 'Recebimento de cliente',
    descricao: data.descricao || `Parcela ${parcelaNumero}/${parcelaTotal} — ${obra.nome}`,
    valor: parseFloat(data.valor),
    valorRecebido: 0,
    status: RECEBIMENTO_STATUS.PENDENTE,
    data: null,
    dataVencimento: data.dataVencimento,
    obraId: obra.id,
    pessoaRelacionada: obra.cliente,
    metodoPagamento: null,
    observacao: data.observacao || '',
    parcelaNumero,
    parcelaTotal,
    planoId,
    historicoPagamentos: [],
    createdAt: new Date().toISOString(),
  };
}

export function buildInstallmentPlanRecords(obra, installments, planoId = generateId()) {
  return installments.map((item, index) =>
    buildParcelaRecord(
      obra,
      {
        valor: item.valor,
        dataVencimento: item.dataVencimento,
        observacao: item.observacao || '',
        descricao: item.descricao,
      },
      {
        parcelaNumero: index + 1,
        parcelaTotal: installments.length,
        planoId,
      }
    )
  );
}

export function updateParcelaRecord(pagamento, data) {
  return {
    ...pagamento,
    valor: parseFloat(data.valor),
    dataVencimento: data.dataVencimento,
    observacao: data.observacao || '',
    descricao: data.descricao || pagamento.descricao,
    updatedAt: new Date().toISOString(),
  };
}

export function syncParcelaTotals(pagamentos, planoId, parcelaTotal) {
  return pagamentos.map((p) =>
    p.planoId === planoId ? { ...p, parcelaTotal, updatedAt: new Date().toISOString() } : p
  );
}

export function splitInstallmentValues(total, parcelas) {
  const base = Math.floor((total / parcelas) * 100) / 100;
  const values = Array.from({ length: parcelas }, () => base);
  const assigned = base * parcelas;
  const remainder = Math.round((total - assigned) * 100) / 100;
  if (Math.abs(remainder) > 0) {
    values[values.length - 1] = Math.round((values[values.length - 1] + remainder) * 100) / 100;
  }
  return values;
}

export function isPagamentoRecebidoVisivel(pagamento) {
  if (pagamento.tipo !== 'Recebimento de cliente') return true;
  return getValorRecebidoPagamento(pagamento) > 0 || getPagamentoStatus(pagamento) === RECEBIMENTO_STATUS.PAGO;
}

export function parcelaToDebtItem(pagamento, obra, referenceDate = new Date()) {
  return buildDebtItem({
    id: pagamento.id,
    pagamentoId: pagamento.id,
    obra,
    pagamento,
    valorRestante: getValorRestantePagamento(pagamento),
    referenceDate,
  });
}
