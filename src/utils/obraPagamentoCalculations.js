import { generateId } from '../services/storageService';
import {
  calcObraRecebimentoResumo,
  getValorRecebidoPagamento,
  RECEBIMENTO_STATUS,
} from './debtCalculations';
import { applyObraExtrasToResumo } from './obraExtras';
import { asRecordList } from './safeCollections';

function obraMantemSaldoAntigoDeExtra(obra) {
  return obra?.tipoObra === 'parceria' || obra?.partnership?.enabled === true;
}

export function isObraPagamentoRecebido(pagamento) {
  if (!pagamento || pagamento.tipo !== 'Recebimento de cliente') return false;
  return getValorRecebidoPagamento(pagamento) > 0.001;
}

export function getObraPagamentosRecebidos(obraId, pagamentos = []) {
  return asRecordList(pagamentos)
    .filter((p) => p.obraId === obraId && isObraPagamentoRecebido(p))
    .sort((a, b) => {
      const da = a.data || a.createdAt || '';
      const db = b.data || b.createdAt || '';
      if (da !== db) return da.localeCompare(db);
      return (a.createdAt || '').localeCompare(b.createdAt || '');
    });
}

export function getParcelaDisplayLabel(pagamento, index, totalRecebidos, obraFullyPaid) {
  if (pagamento.parcelaNumero && pagamento.parcelaTotal) {
    return `Parcela ${pagamento.parcelaNumero}/${pagamento.parcelaTotal}`;
  }

  if (pagamento.parcelaNumero) {
    return obraFullyPaid
      ? `Parcela ${pagamento.parcelaNumero}/${totalRecebidos}`
      : `Parcela ${pagamento.parcelaNumero}/?`;
  }

  const numero = index + 1;
  return obraFullyPaid ? `Parcela ${numero}/${totalRecebidos}` : `Parcela ${numero}/?`;
}

export function enrichObraPagamentosForDisplay(obra, pagamentos = []) {
  const recebidos = getObraPagamentosRecebidos(obra.id, pagamentos);
  const base = calcObraRecebimentoResumo(obra, pagamentos);
  const resumo = obraMantemSaldoAntigoDeExtra(obra) ? base : applyObraExtrasToResumo(obra, base);

  return recebidos.map((pagamento, index) => ({
    pagamento,
    valor: getValorRecebidoPagamento(pagamento),
    parcelaLabel: getParcelaDisplayLabel(pagamento, index, recebidos.length, resumo.isPago),
    parcelaNumero: pagamento.parcelaNumero || index + 1,
  }));
}

export function validateObraPaymentAmount(obra, pagamentos, amount) {
  if (!amount || amount <= 0) {
    return { isValid: false, message: 'Informe um valor válido.' };
  }

  const base = calcObraRecebimentoResumo(obra, pagamentos);
  const saldoRestante = obraMantemSaldoAntigoDeExtra(obra)
    ? base.valorRestante
    : applyObraExtrasToResumo(obra, base).valorRestante;
  const exceedsRemaining = amount - saldoRestante > 0.001;

  if (exceedsRemaining) {
    return {
      isValid: false,
      exceedsRemaining: true,
      message: `O valor excede o saldo a receber (${saldoRestante.toFixed(2)} €).`,
      saldoRestante,
    };
  }

  return { isValid: true };
}

export function buildObraPaymentRecord(obra, amount, details, pagamentos = []) {
  const recebidos = getObraPagamentosRecebidos(obra.id, pagamentos);
  const parcelaNumero = recebidos.length + 1;
  const resumo = calcObraRecebimentoResumo(obra, pagamentos);
  const saldo = obraMantemSaldoAntigoDeExtra(obra) ? null : applyObraExtrasToResumo(obra, resumo);
  const newTotalRecebido = (saldo ? saldo.valorRecebido : resumo.valorRecebido) + amount;
  const contratado = saldo ? saldo.valorAtualizado || 0 : obra.valorContratado || 0;
  const obraFullyPaid = contratado > 0 && newTotalRecebido >= contratado - 0.001;
  const parcelaTotal = obraFullyPaid ? parcelaNumero : null;
  const parcelaLabel = obraFullyPaid
    ? `Parcela ${parcelaNumero}/${parcelaNumero}`
    : `Parcela ${parcelaNumero}/?`;

  return {
    id: generateId(),
    tipo: 'Recebimento de cliente',
    descricao: details.descricao || `${parcelaLabel} — ${obra.nome}`,
    valor: amount,
    valorRecebido: amount,
    status: RECEBIMENTO_STATUS.PAGO,
    data: details.data,
    dataVencimento: null,
    obraId: obra.id,
    pessoaRelacionada: obra.cliente,
    metodoPagamento: details.metodoPagamento || 'Transferência',
    observacao: details.observacao || '',
    parcelaNumero,
    parcelaTotal,
    planoId: null,
    historicoPagamentos: [],
    createdAt: new Date().toISOString(),
  };
}
