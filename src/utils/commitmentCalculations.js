import { generateId } from '../services/storageService';
import { getReferenciaMesAno } from './semanaMesCalculations';

export const TIPO_COBRANCA = {
  RECORRENTE: 'recorrente',
  PARCELADO: 'parcelado',
  UNICO: 'unico',
};

export const TIPO_DESCONTO = {
  ADIANTAMENTO: 'adiantamento',
  EMPRESTIMO: 'emprestimo',
  ALUGUEL: 'aluguel',
  OUTRO: 'outro',
  UNICO: 'unico',
  MENSAL: 'mensal',
};

export const TIPO_DESCONTO_FORM_OPTIONS = [
  TIPO_DESCONTO.ADIANTAMENTO,
  TIPO_DESCONTO.EMPRESTIMO,
  TIPO_DESCONTO.ALUGUEL,
  TIPO_DESCONTO.OUTRO,
];

export const TIPO_DESCONTO_LABEL = {
  [TIPO_DESCONTO.ADIANTAMENTO]: 'Adiantamento',
  [TIPO_DESCONTO.EMPRESTIMO]: 'Empréstimo / Parcelado',
  [TIPO_DESCONTO.ALUGUEL]: 'Aluguel',
  [TIPO_DESCONTO.OUTRO]: 'Outro',
  [TIPO_DESCONTO.UNICO]: 'Adiantamento',
  [TIPO_DESCONTO.MENSAL]: 'Outro',
};

export const TIPO_DESCONTO_FORM_LABEL = {
  [TIPO_DESCONTO.ADIANTAMENTO]: 'Adiantamento',
  [TIPO_DESCONTO.EMPRESTIMO]: 'Empréstimo / Parcelado',
  [TIPO_DESCONTO.ALUGUEL]: 'Aluguel',
  [TIPO_DESCONTO.OUTRO]: 'Outro',
};

export const COMMITMENT_ESTADOS = ['Ativo', 'Inativo', 'Concluído'];
export const DESCONTO_UNICO_ESTADOS = ['Pendente', 'Descontado'];
export const DESCONTO_MENSAL_ESTADOS = ['Ativo', 'Encerrado'];
export const DESCONTO_ALUGUEL_ESTADOS = ['Ativo', 'Inativo'];

export const QUANDO_DESCONTAR = {
  UNICO: 'unico',
  MANUAL: 'manual',
  SEMANAL: 'semanal',
  MENSAL: 'mensal',
};

export const QUANDO_DESCONTAR_LABEL = {
  [QUANDO_DESCONTAR.UNICO]: 'Único',
  [QUANDO_DESCONTAR.MANUAL]: 'Manual / Quando eu quiser',
  [QUANDO_DESCONTAR.SEMANAL]: 'Semanal',
  [QUANDO_DESCONTAR.MENSAL]: 'Mensal',
};

export const QUANDO_DESCONTAR_OPTIONS = [
  QUANDO_DESCONTAR.UNICO,
  QUANDO_DESCONTAR.MANUAL,
  QUANDO_DESCONTAR.SEMANAL,
  QUANDO_DESCONTAR.MENSAL,
];

export function normalizeTipoDesconto(value, fallback = TIPO_DESCONTO.OUTRO) {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (!raw) return fallback;
  if (raw === TIPO_DESCONTO.ALUGUEL || raw === 'aluguer') return TIPO_DESCONTO.ALUGUEL;
  if (raw === TIPO_DESCONTO.EMPRESTIMO || raw === 'parcelado' || raw.includes('emprest')) {
    return TIPO_DESCONTO.EMPRESTIMO;
  }
  if (raw === TIPO_DESCONTO.ADIANTAMENTO || raw === TIPO_DESCONTO.UNICO || raw.includes('adiant')) {
    return TIPO_DESCONTO.ADIANTAMENTO;
  }
  if (raw === TIPO_DESCONTO.OUTRO || raw === TIPO_DESCONTO.MENSAL || raw === 'desconto') {
    return TIPO_DESCONTO.OUTRO;
  }
  return fallback;
}

export function defaultQuandoDescontarForTipo(tipoDesconto) {
  const tipo = normalizeTipoDesconto(tipoDesconto);
  if (tipo === TIPO_DESCONTO.ADIANTAMENTO) return QUANDO_DESCONTAR.UNICO;
  if (tipo === TIPO_DESCONTO.EMPRESTIMO) return QUANDO_DESCONTAR.MANUAL;
  return QUANDO_DESCONTAR.MENSAL;
}

/**
 * Sem campo gravado: tipo único → único; restantes → mensal.
 * Não reescreve dados até o utilizador guardar o formulário.
 */
export function normalizeQuandoDescontar(value, fallback = QUANDO_DESCONTAR.MENSAL) {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (!raw) return fallback;
  if (raw === QUANDO_DESCONTAR.UNICO || raw.startsWith('unic') || raw === 'uma vez') {
    return QUANDO_DESCONTAR.UNICO;
  }
  if (
    raw === QUANDO_DESCONTAR.MANUAL ||
    raw.includes('quando') ||
    raw.includes('eu quiser') ||
    raw === 'a pedido'
  ) {
    return QUANDO_DESCONTAR.MANUAL;
  }
  if (raw.startsWith('seman')) return QUANDO_DESCONTAR.SEMANAL;
  if (raw.startsWith('mens')) return QUANDO_DESCONTAR.MENSAL;
  return fallback;
}

function inferQuandoDescontarFallback(item) {
  if (
    item?.tipoDesconto === TIPO_DESCONTO.UNICO ||
    item?.tipoCobranca === TIPO_COBRANCA.UNICO
  ) {
    return QUANDO_DESCONTAR.UNICO;
  }
  return QUANDO_DESCONTAR.MENSAL;
}

export function getQuandoDescontar(item) {
  const stored = item?.quandoDescontar ?? item?.frequenciaDesconto;
  if (stored != null && String(stored).trim() !== '') {
    return normalizeQuandoDescontar(stored, inferQuandoDescontarFallback(item));
  }
  return inferQuandoDescontarFallback(item);
}

export function getQuandoDescontarLabel(itemOrValue) {
  const value =
    typeof itemOrValue === 'string' ? itemOrValue : getQuandoDescontar(itemOrValue);
  return QUANDO_DESCONTAR_LABEL[value] || QUANDO_DESCONTAR_LABEL[QUANDO_DESCONTAR.MENSAL];
}

export function isDescontoManual(item) {
  return Boolean(item) && getQuandoDescontar(item) === QUANDO_DESCONTAR.MANUAL;
}

export function isDescontoCobrancaUnica(item) {
  return Boolean(item) && getQuandoDescontar(item) === QUANDO_DESCONTAR.UNICO;
}

export function mesAnoFromValue(value) {
  if (!value) return getReferenciaMesAno(new Date());
  if (typeof value === 'string' && /^\d{4}-\d{2}/.test(value)) return value.slice(0, 7);
  return getReferenciaMesAno(value);
}

export function resolveTipoCobranca({
  tipoDesconto,
  quandoDescontar,
  tipoCobranca,
  totalParcelas,
} = {}) {
  const tipo = normalizeTipoDesconto(tipoDesconto, null);
  if (tipo === TIPO_DESCONTO.EMPRESTIMO || tipoCobranca === TIPO_COBRANCA.PARCELADO) {
    return TIPO_COBRANCA.PARCELADO;
  }
  if (Number(totalParcelas) > 0 && tipo === TIPO_DESCONTO.EMPRESTIMO) {
    return TIPO_COBRANCA.PARCELADO;
  }
  const quando = normalizeQuandoDescontar(quandoDescontar, null);
  if (quando === QUANDO_DESCONTAR.UNICO) return TIPO_COBRANCA.UNICO;
  if (quando === QUANDO_DESCONTAR.MANUAL || quando === QUANDO_DESCONTAR.SEMANAL || quando === QUANDO_DESCONTAR.MENSAL) {
    return TIPO_COBRANCA.RECORRENTE;
  }
  if (tipoCobranca) return tipoCobranca;
  if (tipo === TIPO_DESCONTO.ADIANTAMENTO || tipoDesconto === TIPO_DESCONTO.UNICO) {
    return TIPO_COBRANCA.UNICO;
  }
  return TIPO_COBRANCA.RECORRENTE;
}

export function getTipoCobranca(item) {
  if (!item) return TIPO_COBRANCA.RECORRENTE;
  return resolveTipoCobranca({
    tipoDesconto: item.tipoDesconto,
    quandoDescontar: item.quandoDescontar ?? item.frequenciaDesconto,
    tipoCobranca: item.tipoCobranca,
    totalParcelas: item.totalParcelas,
  });
}

export function getTipoDesconto(item) {
  if (!item) return TIPO_DESCONTO.OUTRO;
  if (item.source === 'aluguel') return TIPO_DESCONTO.ALUGUEL;
  const fromField = normalizeTipoDesconto(item.tipoDesconto, null);
  if (fromField) return fromField;
  if (item.tipoCobranca === TIPO_COBRANCA.PARCELADO || Number(item.totalParcelas) > 0) {
    return TIPO_DESCONTO.EMPRESTIMO;
  }
  if (item.tipoCobranca === TIPO_COBRANCA.UNICO) return TIPO_DESCONTO.ADIANTAMENTO;
  return TIPO_DESCONTO.OUTRO;
}

export function persistTipoDescontoValue(incomingTipo, existingItem = null) {
  const canonical = normalizeTipoDesconto(
    incomingTipo,
    existingItem ? getTipoDesconto(existingItem) : TIPO_DESCONTO.OUTRO
  );
  if (existingItem && getTipoDesconto(existingItem) === canonical && existingItem.tipoDesconto) {
    return existingItem.tipoDesconto;
  }
  return canonical;
}

export function getTipoDescontoLabel(item) {
  return TIPO_DESCONTO_LABEL[getTipoDesconto(item)] || TIPO_DESCONTO_LABEL[TIPO_DESCONTO.OUTRO];
}

export function tipoDescontoToTipoCobranca(tipoDesconto, quandoDescontar) {
  return resolveTipoCobranca({ tipoDesconto, quandoDescontar });
}

export function isCommitmentParcelado(item) {
  return getTipoCobranca(item) === TIPO_COBRANCA.PARCELADO;
}

export function isCommitmentUnico(item) {
  return isDescontoCobrancaUnica(item);
}

export function isCommitmentAluguel(item) {
  return getTipoDesconto(item) === TIPO_DESCONTO.ALUGUEL;
}

export function isCommitmentMensal(item) {
  return getQuandoDescontar(item) === QUANDO_DESCONTAR.MENSAL;
}

export function isCommitmentRecorrente(item) {
  return getTipoCobranca(item) === TIPO_COBRANCA.RECORRENTE;
}

export function getHistoricoParcelas(item) {
  return item?.historicoParcelas || [];
}

export function getHistoricoDescontos(item) {
  return item?.historicoDescontos || [];
}

export function wasRecorrenteDescontadoNoMes(item, mesAno) {
  const ref = mesAnoFromValue(mesAno);
  return getHistoricoDescontos(item).some((entry) => {
    const entryMes = mesAnoFromValue(entry.mesAno || entry.data);
    return entryMes === ref && entry.status === 'descontado';
  });
}

export function getParcelaMesAno(entry) {
  return mesAnoFromValue(entry?.mesAno || entry?.data);
}

function parseDateLike(value) {
  if (!value) return new Date();
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    const [year, month, day] = text.slice(0, 10).split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  if (/^\d{4}-\d{2}$/.test(text)) return new Date();
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function getDescontoWeekKey(value) {
  const d = parseDateLike(value);
  const weekday = d.getDay();
  const diffToMonday = weekday === 0 ? -6 : 1 - weekday;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  const month = String(monday.getMonth() + 1).padStart(2, '0');
  const day = String(monday.getDate()).padStart(2, '0');
  return `${monday.getFullYear()}-${month}-${day}`;
}

export function wasRecorrenteDescontadoNaSemana(item, referenceDate = new Date()) {
  const key = getDescontoWeekKey(referenceDate);
  return getHistoricoDescontos(item).some(
    (entry) =>
      entry.status === 'descontado' && getDescontoWeekKey(entry.data || entry.createdAt) === key
  );
}

export function wasParceladoDescontadoNaSemana(item, referenceDate = new Date()) {
  const key = getDescontoWeekKey(referenceDate);
  return getHistoricoParcelas(item).some(
    (entry) => getDescontoWeekKey(entry.data || entry.createdAt) === key
  );
}

export function wasParceladoDescontadoNoMes(item, mesAno) {
  const ref = mesAnoFromValue(mesAno);
  return getHistoricoParcelas(item).some((entry) => getParcelaMesAno(entry) === ref);
}

export function canDescontarUnico(item) {
  if (!item || isCommitmentParcelado(item)) return false;
  if (!isDescontoCobrancaUnica(item)) return false;
  const estado = item.estado;
  if (estado === 'Descontado' || estado === 'Concluído' || estado === 'Inativo' || estado === 'Encerrado') {
    return false;
  }
  return !getHistoricoDescontos(item).some((entry) => entry.status === 'descontado');
}

export function getRegisteredParcelasCount(item) {
  return getHistoricoParcelas(item).length;
}

export function getParcelasDescontadas(item) {
  if (!isCommitmentParcelado(item)) return 0;
  const registradas = getRegisteredParcelasCount(item);
  const fromAtual = Math.max(0, (item.parcelaAtual || 1) - 1);
  return Math.max(registradas, fromAtual);
}

export function getParcelaAtual(item) {
  if (!isCommitmentParcelado(item)) return null;
  const total = getTotalParcelas(item);
  if (item.estado === 'Concluído' || getRegisteredParcelasCount(item) >= total) {
    return total;
  }
  const descontadas = getParcelasDescontadas(item);
  return Math.min(Math.max(descontadas, getRegisteredParcelasCount(item)) + 1, total);
}

export function getTotalParcelas(item) {
  if (!isCommitmentParcelado(item)) return null;
  return item.totalParcelas || 1;
}

export function getParcelaProgressLabel(item) {
  if (!isCommitmentParcelado(item)) return '—';
  const total = getTotalParcelas(item);
  const descontadas = getParcelasDescontadas(item);
  return `${descontadas}/${total}`;
}

export function getParcelasRestantesCount(item) {
  if (!isCommitmentParcelado(item)) return 0;
  if (getCommitmentDisplayEstado(item) === 'Concluído') return 0;

  const total = getTotalParcelas(item);
  const descontadas = getParcelasDescontadas(item);
  return Math.max(0, total - descontadas);
}

export function getParcelasRestantesLabelFromValues(parcelasDescontadas, totalParcelas) {
  const descontadas = parseInt(parcelasDescontadas, 10);
  const total = parseInt(totalParcelas, 10);
  if (Number.isNaN(descontadas) || Number.isNaN(total) || total < 1) return '';
  if (descontadas < 0 || descontadas > total) return 'Parcela inválida';
  if (descontadas >= total) return 'Última parcela';

  const restantes = total - descontadas;
  if (restantes === 1) return 'Falta 1 parcela';
  return `Faltam ${restantes} parcelas`;
}

export function getParcelasRestantesLabel(item) {
  if (!isCommitmentParcelado(item)) return '—';
  if (getCommitmentDisplayEstado(item) === 'Concluído') return 'Nenhuma parcela restante';

  const total = getTotalParcelas(item);
  const descontadas = getParcelasDescontadas(item);
  return getParcelasRestantesLabelFromValues(descontadas, total);
}

export function getParcelasRestantesTableLabel(item) {
  if (!isCommitmentParcelado(item)) return '—';
  if (getCommitmentDisplayEstado(item) === 'Concluído') return 'Nenhuma';

  const total = getTotalParcelas(item);
  const descontadas = getParcelasDescontadas(item);
  if (descontadas >= total) return 'Última';

  const restantes = total - descontadas;
  return `${restantes} restantes`;
}

export function getFutureParcelasCount(item) {
  if (!isCommitmentParcelado(item)) return 0;
  if (getCommitmentDisplayEstado(item) === 'Concluído') return 0;

  return getParcelasRestantesCount(item);
}

export function getFutureParcelasValue(item) {
  if (!isCommitmentFinanciallyActive(item)) return 0;
  return getFutureParcelasCount(item) * getValorParcela(item);
}

export function getValorParcela(item) {
  return item.valorMensal || item.valorParcela || 0;
}

export function getValorTotalEmprestimo(item) {
  if (!isCommitmentParcelado(item)) return 0;
  const stored = parseFloat(item.valorTotal);
  if (Number.isFinite(stored) && stored > 0) return stored;
  return getValorParcela(item) * (getTotalParcelas(item) || 0);
}

export function getSaldoRestanteEmprestimo(item) {
  if (!isCommitmentParcelado(item)) return 0;
  const total = getValorTotalEmprestimo(item);
  const historico = getHistoricoParcelas(item);
  if (historico.length > 0) {
    const pago = historico.reduce((sum, entry) => sum + (Number(entry.valor) || 0), 0);
    return Math.max(0, Math.round((total - pago) * 100) / 100);
  }
  if (getCommitmentDisplayEstado(item) === 'Concluído') return 0;
  const restantes = getParcelasRestantesCount(item);
  return Math.round(restantes * getValorParcela(item) * 100) / 100;
}

export function getCommitmentDisplayEstado(item) {
  if (isCommitmentParcelado(item)) {
    const registradas = getRegisteredParcelasCount(item);
    const total = getTotalParcelas(item);
    const restantes = Math.max(0, total - getParcelasDescontadas(item));
    if (registradas >= total || restantes <= 0 || item.estado === 'Concluído') return 'Concluído';
    if (item.estado === 'Inativo') return 'Inativo';
    return 'Ativo';
  }

  if (isDescontoCobrancaUnica(item)) {
    const descontado = getHistoricoDescontos(item).some((entry) => entry.status === 'descontado');
    if (descontado || item.estado === 'Descontado' || item.estado === 'Concluído') {
      return isCommitmentUnico(item) ? 'Descontado' : 'Concluído';
    }
    if (item.estado === 'Inativo' || item.estado === 'Encerrado') {
      return item.estado === 'Encerrado' ? 'Encerrado' : 'Inativo';
    }
    return 'Pendente';
  }

  if (isCommitmentAluguel(item)) {
    if (item.estado === 'Inativo') return 'Inativo';
    if (item.estado === 'Concluído' || item.estado === 'Encerrado') return 'Inativo';
    return 'Ativo';
  }

  if (item.estado === 'Encerrado' || item.estado === 'Inativo') return 'Encerrado';
  if (item.estado === 'Concluído') return 'Concluído';
  return item.estado || 'Ativo';
}

export function isCommitmentFinanciallyActive(item) {
  const estado = getCommitmentDisplayEstado(item);
  if (estado === 'Pendente') return true;
  if (isCommitmentUnico(item) || isDescontoCobrancaUnica(item)) return estado === 'Pendente';
  return estado === 'Ativo';
}

export function getTotalRegisteredValue(item) {
  return getHistoricoParcelas(item).reduce((sum, entry) => sum + (entry.valor || 0), 0);
}

export function getRemainingParcelasValue(item) {
  return getFutureParcelasValue(item);
}

function hasParcelasPorDescontar(item) {
  if (!isCommitmentParcelado(item)) return false;
  if (item.estado === 'Inativo') return false;
  if (getCommitmentDisplayEstado(item) === 'Concluído') return false;
  return getParcelasRestantesCount(item) > 0;
}

export function canDescontarParcelaManual(item) {
  return isDescontoManual(item) && hasParcelasPorDescontar(item);
}

export function canDescontarAgora(item) {
  if (!isDescontoManual(item)) return false;
  if (isCommitmentParcelado(item)) return hasParcelasPorDescontar(item);
  if (isDescontoCobrancaUnica(item)) return canDescontarUnico(item);
  return isCommitmentFinanciallyActive(item);
}

export function canRegisterParcela(item, referenceDate = new Date()) {
  if (!hasParcelasPorDescontar(item)) return false;
  if (isDescontoManual(item)) return false;

  const parcelaAtual = getParcelaAtual(item);
  const total = getTotalParcelas(item);
  if (parcelaAtual > total) return false;
  if (getHistoricoParcelas(item).some((entry) => entry.numero === parcelaAtual)) return false;

  const quando = getQuandoDescontar(item);
  if (quando === QUANDO_DESCONTAR.UNICO) {
    return !getHistoricoParcelas(item).some((entry) => entry.origem === QUANDO_DESCONTAR.UNICO);
  }
  if (quando === QUANDO_DESCONTAR.SEMANAL) {
    return !wasParceladoDescontadoNaSemana(item, referenceDate);
  }

  const refMes = mesAnoFromValue(referenceDate || new Date());
  if (wasParceladoDescontadoNoMes(item, refMes)) return false;
  return true;
}

export function hasParcelaPendenteAutomatica(item, referenceDate = new Date()) {
  if (!item || isDescontoManual(item)) return false;
  return canRegisterParcela(item, referenceDate);
}

export function hasCobrancaAutomaticaPendente(item, referenceDate = new Date()) {
  if (!item || isDescontoManual(item)) return false;
  if (item.estado === 'Inativo' || item.estado === 'Encerrado') return false;

  if (isCommitmentParcelado(item)) {
    return hasParcelaPendenteAutomatica(item, referenceDate);
  }

  if (isDescontoCobrancaUnica(item)) {
    return canDescontarUnico(item);
  }

  if (!isCommitmentFinanciallyActive(item)) return false;

  const quando = getQuandoDescontar(item);
  if (quando === QUANDO_DESCONTAR.SEMANAL) {
    return !wasRecorrenteDescontadoNaSemana(item, referenceDate);
  }

  return !wasRecorrenteDescontadoNoMes(item, mesAnoFromValue(referenceDate));
}

export function canDescontarRecorrente(item, referenceDate = new Date()) {
  if (isCommitmentParcelado(item)) return false;
  return hasCobrancaAutomaticaPendente(item, referenceDate);
}

export function validateCommitmentEdit(existingItem, form) {
  if (!isCommitmentParcelado(existingItem) && form.tipoCobranca !== TIPO_COBRANCA.PARCELADO) {
    return { isValid: true };
  }

  const registradas = getRegisteredParcelasCount(existingItem);
  const newTotal = parseInt(form.totalParcelas, 10);
  const newDescontadas = parseInt(form.parcelaAtual, 10);

  if (Number.isNaN(newTotal) || newTotal < 1) {
    return { isValid: false, message: 'Informe um número válido de parcelas.' };
  }

  if (newTotal < registradas) {
    return {
      isValid: false,
      message: `Não é possível definir ${newTotal} parcelas porque ${registradas} parcelas já foram registradas.`,
    };
  }

  if (Number.isNaN(newDescontadas) || newDescontadas < 0 || newDescontadas > newTotal) {
    return {
      isValid: false,
      message: `Parcelas descontadas deve estar entre 0 e ${newTotal}.`,
    };
  }

  if (newDescontadas < registradas) {
    return {
      isValid: false,
      message: `Não é possível definir ${newDescontadas} parcelas descontadas porque ${registradas} já foram registradas.`,
    };
  }

  return { isValid: true };
}

export function registerParcelaOnCommitment(item, details = {}) {
  const quando = getQuandoDescontar(item);
  const manual = quando === QUANDO_DESCONTAR.MANUAL;
  const noPagamento = Boolean(details.noPagamento);
  if (manual && !details.solicitadoManualmente && !noPagamento) {
    return { error: 'Este desconto manual só entra quando for escolhido num pagamento.' };
  }

  const parcelaAtual = getParcelaAtual(item);
  const total = getTotalParcelas(item);
  const data = details.data || new Date().toISOString().slice(0, 10);
  const mesAno = mesAnoFromValue(details.mesAno || data);

  if (getParcelasRestantesCount(item) <= 0 || parcelaAtual > total) {
    return { error: 'Todas as parcelas já foram registradas.' };
  }

  const numerosUsados = new Set(getHistoricoParcelas(item).map((entry) => Number(entry.numero)));
  let numeroLivre = 1;
  while (numerosUsados.has(numeroLivre) && numeroLivre <= total) numeroLivre += 1;
  if (numeroLivre > total) {
    return { error: 'Todas as parcelas já foram registradas.' };
  }

  if (
    !noPagamento &&
    !manual &&
    quando === QUANDO_DESCONTAR.MENSAL &&
    wasParceladoDescontadoNoMes(item, mesAno)
  ) {
    return { error: 'Já existe uma parcela descontada neste mês.' };
  }
  if (
    !noPagamento &&
    !manual &&
    quando === QUANDO_DESCONTAR.SEMANAL &&
    wasParceladoDescontadoNaSemana(item, data)
  ) {
    return { error: 'Já existe uma parcela descontada nesta semana.' };
  }
  if (
    !noPagamento &&
    !manual &&
    quando === QUANDO_DESCONTAR.UNICO &&
    getHistoricoParcelas(item).some((entry) => entry.origem === QUANDO_DESCONTAR.UNICO)
  ) {
    return { error: 'Este desconto único já foi aplicado.' };
  }

  const saldo = getSaldoRestanteEmprestimo(item);
  const valorInformado = details.valor != null ? parseFloat(details.valor) : getValorParcela(item);
  if (!Number.isFinite(valorInformado) || valorInformado <= 0) {
    return { error: 'Informe um valor válido para descontar.' };
  }
  if (valorInformado - saldo > 0.009) {
    return { error: 'O valor é maior do que o saldo deste desconto.' };
  }
  const valor = valorInformado;
  const createdAt = new Date().toISOString();

  const entry = {
    id: generateId(),
    numero: numeroLivre,
    data,
    mesAno,
    valor: parseFloat(valor),
    semana: details.semana ?? null,
    fechamentoId: details.fechamentoId ?? null,
    origem: quando,
    status: 'descontado',
    createdAt,
  };

  const historicoParcelas = [...getHistoricoParcelas(item), entry].sort((a, b) => a.numero - b.numero);
  const nextParcelaAtual = Math.min(total, historicoParcelas.length + 1);
  const draft = {
    ...item,
    historicoParcelas,
    parcelaAtual: nextParcelaAtual,
    quandoDescontar: quando,
    estado: 'Ativo',
    updatedAt: createdAt,
  };
  const concluido = getParcelasDescontadas(draft) >= total;

  return {
    item: {
      ...draft,
      parcelaAtual: concluido ? total : nextParcelaAtual,
      estado: concluido ? 'Concluído' : item.estado === 'Inativo' ? 'Ativo' : item.estado || 'Ativo',
    },
  };
}

export function applyManualDescontoNow(item, details = {}) {
  if (!item) return { error: 'Desconto não encontrado.' };
  if (!isDescontoManual(item)) {
    return { error: 'Este desconto não está em modo manual.' };
  }

  if (isCommitmentParcelado(item)) {
    if (!canDescontarParcelaManual(item)) {
      return { error: 'Este desconto já está concluído.' };
    }
    return registerParcelaOnCommitment(item, {
      ...details,
      solicitadoManualmente: true,
    });
  }

  if (!canDescontarAgora(item)) {
    return { error: 'Este desconto já não pode ser aplicado.' };
  }

  return registerRecorrenteDescontoOnCommitment(item, {
    ...details,
    solicitadoManualmente: true,
  });
}

export function previewManualDesconto(item) {
  const valor = getValorParcela(item);
  const parcelado = isCommitmentParcelado(item);
  const saldoAtual = parcelado ? getSaldoRestanteEmprestimo(item) : valor;
  const pagas = parcelado ? getParcelasDescontadas(item) : 0;
  const total = parcelado ? getTotalParcelas(item) : 1;
  const restantes = parcelado ? getParcelasRestantesCount(item) : canDescontarUnico(item) || isCommitmentFinanciallyActive(item) ? 1 : 0;
  return {
    descricao: item?.descricao || 'Desconto',
    valor,
    parcelado,
    saldoAtual,
    saldoDepois: parcelado
      ? Math.max(0, Math.round((saldoAtual - valor) * 100) / 100)
      : 0,
    pagas,
    pagasDepois: parcelado ? Math.min(total, pagas + 1) : 1,
    restantes,
    restantesDepois: Math.max(0, restantes - 1),
    total,
  };
}

export function updateParcelaSettingsOnCommitment(item, { parcelaAtual, totalParcelas }) {
  const total = parseInt(totalParcelas, 10);
  const descontadas = parseInt(parcelaAtual, 10);
  const registradas = getRegisteredParcelasCount(item);

  if (Number.isNaN(total) || total < 1) {
    return { error: 'Informe um total de parcelas válido.' };
  }

  if (total < registradas) {
    return {
      error: `Não é possível definir ${total} parcelas porque ${registradas} parcelas já foram registradas.`,
    };
  }

  if (Number.isNaN(descontadas) || descontadas < 0 || descontadas > total) {
    return { error: `Parcelas descontadas deve estar entre 0 e ${total}.` };
  }

  if (descontadas < registradas) {
    return {
      error: `Não é possível definir ${descontadas} parcelas descontadas porque ${registradas} já foram registradas.`,
    };
  }

  let estado = item.estado;
  if (registradas >= total || descontadas >= total) {
    estado = 'Concluído';
  } else if (item.estado === 'Concluído' && registradas < total) {
    estado = 'Ativo';
  }

  const proximaParcela = descontadas >= total ? total : Math.max(descontadas, registradas) + 1;

  return {
    item: {
      ...item,
      parcelaAtual: proximaParcela,
      totalParcelas: total,
      estado,
      updatedAt: new Date().toISOString(),
    },
  };
}

export function updateParcelaAtualOnCommitment(item, novaParcela) {
  return updateParcelaSettingsOnCommitment(item, {
    parcelaAtual: novaParcela,
    totalParcelas: getTotalParcelas(item),
  });
}

export function desfazerLancamentoDesconto(item, lancamentoId) {
  if (!item || !lancamentoId) return { error: 'Lançamento não encontrado.' };
  const parcelas = getHistoricoParcelas(item);
  const descontos = getHistoricoDescontos(item);
  const parcela = parcelas.find((entry) => entry.id === lancamentoId);
  const desconto = !parcela ? descontos.find((entry) => entry.id === lancamentoId) : null;
  if (!parcela && !desconto) return { error: 'Lançamento não encontrado.' };

  const now = new Date().toISOString();
  if (parcela) {
    const historicoParcelas = parcelas.filter((entry) => entry.id !== lancamentoId);
    const total = getTotalParcelas(item);
    const descontadas = historicoParcelas.length;
    return {
      kind: 'parcela',
      removed: parcela,
      item: {
        ...item,
        historicoParcelas,
        parcelaAtual: descontadas >= total ? total : descontadas + 1,
        estado: descontadas >= total ? 'Concluído' : 'Ativo',
        updatedAt: now,
      },
    };
  }

  const historicoDescontos = descontos.filter((entry) => entry.id !== lancamentoId);
  let estado = item.estado;
  if (isDescontoCobrancaUnica(item)) {
    const aindaDescontado = historicoDescontos.some((entry) => entry.status === 'descontado');
    estado = aindaDescontado ? item.estado : 'Ativo';
  }
  return {
    kind: 'desconto',
    removed: desconto,
    item: {
      ...item,
      historicoDescontos,
      estado,
      updatedAt: now,
    },
  };
}

export function registerRecorrenteDescontoOnCommitment(item, details = {}) {
  const quando = getQuandoDescontar(item);
  const manual = quando === QUANDO_DESCONTAR.MANUAL;
  const noPagamento = Boolean(details.noPagamento);
  if (manual && !details.solicitadoManualmente && !noPagamento) {
    return { error: 'Este desconto manual só entra quando for escolhido num pagamento.' };
  }

  const data = details.data || new Date().toISOString().slice(0, 10);
  const mesAno = mesAnoFromValue(details.mesAno || data);
  if (!mesAno) return { error: 'Referência do mês é obrigatória.' };

  if (isDescontoCobrancaUnica(item)) {
    if (!canDescontarUnico(item)) {
      return { error: 'Este desconto único já foi aplicado.' };
    }
  } else if (!noPagamento && !manual && quando === QUANDO_DESCONTAR.SEMANAL && wasRecorrenteDescontadoNaSemana(item, data)) {
    return { error: 'Este desconto já foi aplicado nesta semana.' };
  } else if (!noPagamento && !manual && quando === QUANDO_DESCONTAR.MENSAL && wasRecorrenteDescontadoNoMes(item, mesAno)) {
    return { error: 'Este desconto já foi aplicado neste mês.' };
  }

  const valorInformado = details.valor != null ? parseFloat(details.valor) : getValorParcela(item);
  if (!Number.isFinite(valorInformado) || valorInformado <= 0) {
    return { error: 'Informe um valor válido para descontar.' };
  }
  if (isDescontoCobrancaUnica(item) && valorInformado - getValorParcela(item) > 0.009) {
    return { error: 'O valor é maior do que o saldo deste desconto.' };
  }
  const valor = valorInformado;
  const createdAt = new Date().toISOString();

  const entry = {
    id: generateId(),
    mesAno,
    semana: details.semana ?? null,
    data,
    valor: parseFloat(valor),
    fechamentoId: details.fechamentoId ?? null,
    origem: quando,
    status: 'descontado',
    createdAt,
  };

  const unico = isDescontoCobrancaUnica(item);

  return {
    item: {
      ...item,
      historicoDescontos: [...getHistoricoDescontos(item), entry],
      quandoDescontar: quando,
      estado: unico ? (isCommitmentUnico(item) ? 'Descontado' : 'Concluído') : item.estado,
      updatedAt: createdAt,
    },
  };
}

export const DESCONTO_MES_STATUS = {
  PENDENTE: 'pendente',
  DESCONTADO: 'descontado',
  CONCLUIDO: 'concluido',
  AGUARDANDO: 'aguardando',
};

export function getDescontoMesStatus(item, referenceDate = new Date()) {
  const estado = getCommitmentDisplayEstado(item);
  const quando = getQuandoDescontar(item);
  const ref = mesAnoFromValue(referenceDate);

  if (isDescontoManual(item)) {
    if (isCommitmentParcelado(item)) {
      return estado === 'Concluído' || getParcelasRestantesCount(item) <= 0
        ? DESCONTO_MES_STATUS.CONCLUIDO
        : DESCONTO_MES_STATUS.AGUARDANDO;
    }
    if (!isCommitmentFinanciallyActive(item)) return DESCONTO_MES_STATUS.CONCLUIDO;
    return DESCONTO_MES_STATUS.AGUARDANDO;
  }

  if (
    estado === 'Concluído' ||
    estado === 'Descontado' ||
    estado === 'Encerrado' ||
    estado === 'Inativo'
  ) {
    return DESCONTO_MES_STATUS.CONCLUIDO;
  }

  if (hasCobrancaAutomaticaPendente(item, referenceDate)) {
    return DESCONTO_MES_STATUS.PENDENTE;
  }

  if (isCommitmentParcelado(item)) {
    if (quando === QUANDO_DESCONTAR.SEMANAL && wasParceladoDescontadoNaSemana(item, referenceDate)) {
      return DESCONTO_MES_STATUS.DESCONTADO;
    }
    if (quando === QUANDO_DESCONTAR.MENSAL && wasParceladoDescontadoNoMes(item, ref)) {
      return DESCONTO_MES_STATUS.DESCONTADO;
    }
    if (quando === QUANDO_DESCONTAR.UNICO) return DESCONTO_MES_STATUS.AGUARDANDO;
    return DESCONTO_MES_STATUS.PENDENTE;
  }

  if (quando === QUANDO_DESCONTAR.SEMANAL && wasRecorrenteDescontadoNaSemana(item, referenceDate)) {
    return DESCONTO_MES_STATUS.DESCONTADO;
  }
  if (quando === QUANDO_DESCONTAR.MENSAL && wasRecorrenteDescontadoNoMes(item, ref)) {
    return DESCONTO_MES_STATUS.DESCONTADO;
  }

  return DESCONTO_MES_STATUS.CONCLUIDO;
}

export function getValorADescontarEsteMes(item, referenceDate = new Date()) {
  if (isDescontoManual(item)) return 0;
  if (getDescontoMesStatus(item, referenceDate) !== DESCONTO_MES_STATUS.PENDENTE) return 0;
  return getValorParcela(item);
}

export function getValorDescontadoNoMes(item, mesAno) {
  const ref = mesAnoFromValue(mesAno);
  const descontos = getHistoricoDescontos(item)
    .filter((entry) => mesAnoFromValue(entry.mesAno || entry.data) === ref && entry.status === 'descontado')
    .reduce((sum, entry) => sum + (entry.valor || 0), 0);
  const parcelas = getHistoricoParcelas(item)
    .filter((entry) => getParcelaMesAno(entry) === ref)
    .reduce((sum, entry) => sum + (entry.valor || 0), 0);
  return descontos + parcelas;
}

export function getDescontoHistoricoUnificado(item) {
  const descontos = getHistoricoDescontos(item).map((entry) => ({
    ...entry,
    kind: 'desconto',
    sortKey: entry.data || entry.createdAt || '',
  }));
  const parcelas = getHistoricoParcelas(item).map((entry) => ({
    ...entry,
    kind: 'parcela',
    sortKey: entry.data || entry.createdAt || '',
  }));
  return [...descontos, ...parcelas].sort((a, b) => String(b.sortKey).localeCompare(String(a.sortKey)));
}

export function groupDescontosAdiantamentos(funcionario, referenceDate = new Date()) {
  const mesAno = mesAnoFromValue(referenceDate);
  const pendentes = [];
  const descontadosEsteMes = [];
  const aguardando = [];
  const concluidos = [];

  (funcionario?.descontosMensais || []).forEach((item) => {
    const status = getDescontoMesStatus(item, referenceDate);
    if (status === DESCONTO_MES_STATUS.PENDENTE) pendentes.push(item);
    else if (status === DESCONTO_MES_STATUS.DESCONTADO) descontadosEsteMes.push(item);
    else if (status === DESCONTO_MES_STATUS.AGUARDANDO) aguardando.push(item);
    else concluidos.push(item);
  });

  return { pendentes, descontadosEsteMes, aguardando, concluidos, mesAno };
}

export function calcCommitmentFinancialSummary(funcionario, referenceDate = new Date()) {
  const alugueis = funcionario?.alugueis || [];
  const descontos = funcionario?.descontosMensais || [];

  let totalRecorrenteAtivo = 0;
  let totalAluguelRecorrenteAtivo = 0;
  let totalDescontoRecorrenteAtivo = 0;
  let totalParceladoRegistrado = 0;
  let totalAluguelParceladoRegistrado = 0;
  let totalDescontoParceladoRegistrado = 0;
  let parcelasEmAberto = 0;
  let parcelasRestantesTotal = 0;
  let proximoDesconto = 0;
  let totalDescontosPendentes = 0;

  const addRecorrentePendente = (item, alvo) => {
    if (!hasCobrancaAutomaticaPendente(item, referenceDate)) return;
    const valor = getValorParcela(item);
    totalDescontosPendentes += valor;
    proximoDesconto += valor;
    if (!isDescontoCobrancaUnica(item) && !isCommitmentUnico(item)) {
      totalRecorrenteAtivo += valor;
      if (alvo === 'aluguel') totalAluguelRecorrenteAtivo += valor;
      else totalDescontoRecorrenteAtivo += valor;
    }
  };

  alugueis.forEach((item) => {
    if (isCommitmentParcelado(item)) {
      const registrado = getTotalRegisteredValue(item);
      totalParceladoRegistrado += registrado;
      totalAluguelParceladoRegistrado += registrado;
      if (isCommitmentFinanciallyActive(item)) {
        parcelasEmAberto += getFutureParcelasValue(item);
        parcelasRestantesTotal += getFutureParcelasCount(item);
        if (hasParcelaPendenteAutomatica(item, referenceDate)) {
          proximoDesconto += getValorParcela(item);
          totalDescontosPendentes += getValorParcela(item);
        }
      }
      return;
    }
    addRecorrentePendente(item, 'aluguel');
  });

  descontos.forEach((item) => {
    if (isCommitmentParcelado(item)) {
      const registrado = getTotalRegisteredValue(item);
      totalParceladoRegistrado += registrado;
      totalDescontoParceladoRegistrado += registrado;
      if (isCommitmentFinanciallyActive(item)) {
        parcelasEmAberto += getFutureParcelasValue(item);
        parcelasRestantesTotal += getFutureParcelasCount(item);
        if (hasParcelaPendenteAutomatica(item, referenceDate)) {
          proximoDesconto += getValorParcela(item);
          totalDescontosPendentes += getValorParcela(item);
        }
      }
      return;
    }
    addRecorrentePendente(item, 'desconto');
  });

  return {
    totalRecorrenteAtivo,
    totalAluguelRecorrenteAtivo,
    totalDescontoRecorrenteAtivo,
    totalParceladoRegistrado,
    totalAluguelParceladoRegistrado,
    totalDescontoParceladoRegistrado,
    parcelasEmAberto,
    parcelasRestantesTotal,
    proximoDesconto,
    totalDescontosPendentes,
    totalDeducoesRegistradas: totalParceladoRegistrado,
  };
}
