import { generateId } from '../services/storageService';
import { calcDiariaTotal } from './calculations';
import { isParceiroFuncionario, isDiariaDeParceiro } from './funcionarioTipo';
import { buildObservacoesDiariasList } from './diariaObservacaoCalculations';
import {
  canRegisterParcela,
  getParcelaAtual,
  getParcelasRestantesCount,
  getSaldoRestanteEmprestimo,
  getTipoDesconto,
  getTotalParcelas,
  getValorParcela,
  hasCobrancaAutomaticaPendente,
  isCommitmentFinanciallyActive,
  isCommitmentParcelado,
  isDescontoCobrancaUnica,
  isDescontoManual,
  registerParcelaOnCommitment,
  registerRecorrenteDescontoOnCommitment,
  TIPO_DESCONTO,
} from './commitmentCalculations';
import {
  getValorUtilizado,
  getValorAdicionalAPagar,
  getValorADevolver,
  isAcertoAcertado,
} from './acertoCalculations';
import { acertoJaRepresentadoEmDescontos } from './descontoAdiantamentoView';

export const TIPO_PAGAMENTO = {
  SEMANAL: 'Semanal',
  QUINZENAL: 'Quinzenal',
  MENSAL: 'Mensal',
  OUTRO: 'Outro',
};

export const FECHAMENTO_STATUS = {
  PAGO: 'Pago',
};

export const DIARIA_STATUS = {
  PENDENTE: 'Pendente',
  PAGA: 'Paga',
};

export function sameFuncionarioId(a, b) {
  return String(a ?? '') === String(b ?? '');
}

function amountsMatch(a, b) {
  return Math.abs((a || 0) - (b || 0)) < 0.009;
}

export function markDiariaComoPaga(diaria, fechamentoId, dataPagamento = null) {
  const data = dataPagamento || new Date().toISOString().slice(0, 10);
  return {
    ...diaria,
    fechamentoPagamentoId: fechamentoId,
    statusPagamento: DIARIA_STATUS.PAGA,
    dataPagamento: data,
    updatedAt: new Date().toISOString(),
  };
}

/** Marca diária como paga manualmente, sem criar fechamento/pagamento duplicado. */
export function markDiariaComoPagaManual(diaria, dataPagamento = null) {
  const data = dataPagamento || new Date().toISOString().slice(0, 10);
  return {
    ...diaria,
    statusPagamento: DIARIA_STATUS.PAGA,
    dataPagamento: data,
    pagamentoManual: true,
    updatedAt: new Date().toISOString(),
  };
}

export function getDiariaDataPagamento(diaria, fechamentosPagamento = []) {
  if (!diaria) return null;
  if (diaria.dataPagamento) return diaria.dataPagamento;

  if (diaria.fechamentoPagamentoId) {
    const fechamento = fechamentosPagamento.find((f) => f.id === diaria.fechamentoPagamentoId);
    if (fechamento?.data) return fechamento.data;
  }

  return null;
}

function findDiariasMatchingTotal(candidates, total, fechamentoDate) {
  if (!candidates.length || !total) return [];

  const byDate = [...candidates].sort((a, b) => (a.data || '').localeCompare(b.data || ''));

  const totalAll = byDate.reduce((sum, d) => sum + calcDiariaTotal(d), 0);
  if (amountsMatch(totalAll, total)) return byDate;

  if (fechamentoDate) {
    const byDateCutoff = byDate.filter((d) => (d.data || '') <= fechamentoDate);
    const sumCutoff = byDateCutoff.reduce((sum, d) => sum + calcDiariaTotal(d), 0);
    if (amountsMatch(sumCutoff, total)) return byDateCutoff;
  }

  let acc = 0;
  const picked = [];
  for (const d of byDate) {
    picked.push(d);
    acc += calcDiariaTotal(d);
    if (amountsMatch(acc, total)) return picked;
    if (acc > total + 0.009) {
      picked.pop();
      acc -= calcDiariaTotal(d);
    }
  }

  return [];
}

function buildDiariaFechamentoIndex(fechamentosPagamento = []) {
  const index = new Map();

  fechamentosPagamento.forEach((fechamento) => {
    (fechamento.diariaIds || []).forEach((diariaId) => {
      if (!index.has(diariaId)) {
        index.set(diariaId, fechamento.id);
      }
    });
  });

  return index;
}

export function isDiariaPendente(diaria, fechamentosPagamento = []) {
  if (!diaria) return false;
  if (diaria.fechamentoPagamentoId) return false;
  if (diaria.statusPagamento === DIARIA_STATUS.PAGA) return false;

  const index = buildDiariaFechamentoIndex(fechamentosPagamento);
  return !index.has(diaria.id);
}

/** Repara diárias já incluídas em fechamentos mas sem fechamentoPagamentoId (dados legados). */
export function syncDiariasWithFechamentos(diarias = [], fechamentosPagamento = []) {
  const index = buildDiariaFechamentoIndex(fechamentosPagamento);
  if (index.size === 0) return diarias;

  let changed = false;
  const synced = diarias.map((diaria) => {
    if (diaria.fechamentoPagamentoId) return diaria;

    const fechamentoId = index.get(diaria.id);
    if (!fechamentoId) return diaria;

    changed = true;
    const fechamento = fechamentosPagamento.find((f) => f.id === fechamentoId);
    return markDiariaComoPaga(diaria, fechamentoId, fechamento?.data || null);
  });

  return changed ? synced : diarias;
}

/**
 * Repara ligações entre fechamentos e diárias (dados legados).
 * - Sincroniza fechamentoPagamentoId a partir de diariaIds existentes.
 * - Inferência segura quando fechamento tem totalDiarias mas diariaIds vazio.
 */
export function repairPaymentDiariaLinks(diarias = [], fechamentosPagamento = []) {
  let nextDiarias = syncDiariasWithFechamentos(diarias, fechamentosPagamento);
  let nextFechamentos = fechamentosPagamento.map((f) => ({
    ...f,
    diariaIds: [...(f.diariaIds || [])],
  }));

  let diariasChanged = nextDiarias !== diarias;
  let fechamentosChanged = false;

  const assignedIds = new Set();
  nextDiarias.forEach((d) => {
    if (d.fechamentoPagamentoId) assignedIds.add(d.id);
  });
  nextFechamentos.forEach((f) => {
    (f.diariaIds || []).forEach((id) => assignedIds.add(id));
  });

  const sorted = [...nextFechamentos].sort((a, b) => {
    const da = a.createdAt || a.data || '';
    const db = b.createdAt || b.data || '';
    return da.localeCompare(db);
  });

  for (const fechamento of sorted) {
    if ((fechamento.diariaIds || []).length > 0) continue;
    if (!fechamento.totalDiarias || fechamento.totalDiarias <= 0) continue;

    const candidates = nextDiarias.filter(
      (d) =>
        sameFuncionarioId(d.funcionarioId, fechamento.funcionarioId) &&
        isDiariaPendente(d, nextFechamentos) &&
        !assignedIds.has(d.id)
    );

    const matched = findDiariasMatchingTotal(
      candidates,
      fechamento.totalDiarias,
      fechamento.data
    );
    if (matched.length === 0) continue;

    fechamento.diariaIds = matched.map((d) => d.id);
    fechamentosChanged = true;

    nextDiarias = nextDiarias.map((d) => {
      if (!matched.some((m) => m.id === d.id)) return d;
      assignedIds.add(d.id);
      diariasChanged = true;
      return markDiariaComoPaga(d, fechamento.id, fechamento.data || null);
    });
  }

  return {
    diarias: diariasChanged ? nextDiarias : diarias,
    fechamentos: fechamentosChanged ? nextFechamentos : fechamentosPagamento,
  };
}

export function getDiariasPendentes(
  funcionarioId,
  diarias = [],
  fechamentosPagamento = [],
  funcionarios = []
) {
  if (isParceiroFuncionario(funcionarios.find((item) => item && item.id === funcionarioId))) {
    return [];
  }
  return diarias.filter(
    (d) =>
      sameFuncionarioId(d.funcionarioId, funcionarioId) &&
      isDiariaPendente(d, fechamentosPagamento) &&
      !isDiariaDeParceiro(d, funcionarios)
  );
}

function toISOLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDiariaWeekPeriod(dateStr) {
  if (!dateStr) {
    return { key: 'sem-data', inicio: '', fim: '', label: 'Sem data' };
  }
  const [year, month, day] = String(dateStr).slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) {
    return { key: 'sem-data', inicio: '', fim: '', label: 'Sem data' };
  }
  const date = new Date(year, month - 1, day);
  const weekday = date.getDay();
  const monday = new Date(date);
  monday.setDate(date.getDate() + (weekday === 0 ? -6 : 1 - weekday));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const inicio = toISOLocalDate(monday);
  const fim = toISOLocalDate(sunday);
  return { key: inicio, inicio, fim, label: `Semana ${inicio} — ${fim}` };
}

export function groupDiariasPendentesPorSemana(diarias = []) {
  const groups = new Map();
  [...(diarias || [])]
    .filter(Boolean)
    .sort((a, b) => String(a.data || '').localeCompare(String(b.data || '')))
    .forEach((diaria) => {
      const week = getDiariaWeekPeriod(diaria.data);
      if (!groups.has(week.key)) {
        groups.set(week.key, { ...week, diarias: [] });
      }
      groups.get(week.key).diarias.push(diaria);
    });
  return [...groups.values()];
}

export function getDiariasSelecionadasDoPreview(preview) {
  if (!preview) return [];
  if (Array.isArray(preview.diariasSelecionadas)) return preview.diariasSelecionadas;
  return preview.diariasPendentes || [];
}

export function getDiariasDoFechamento(fechamento, diarias = []) {
  if (!fechamento) return [];
  if (Array.isArray(fechamento.diariasIncluidas) && fechamento.diariasIncluidas.length > 0) {
    return fechamento.diariasIncluidas;
  }
  const byId = new Map((diarias || []).map((item) => [item.id, item]));
  return (fechamento.diariaIds || []).map((id) => {
    const diaria = byId.get(id);
    if (!diaria) {
      const obs = (fechamento.observacoesDiariasReferencia || []).find((item) => item.diariaId === id);
      return {
        id,
        data: obs?.data || '',
        valor: null,
        observacao: obs?.observacao || '',
      };
    }
    return {
      id: diaria.id,
      data: diaria.data || '',
      valor: calcDiariaTotal(diaria),
      observacao: String(diaria.observacao || '').trim(),
    };
  });
}

export function getPagamentoDescontoLabel(item) {
  if (item.categoria === 'aluguel' || item.tipoDesconto === TIPO_DESCONTO.ALUGUEL) {
    return item.modalidade === 'parcelado'
      ? `Aluguel (${item.numero}/${item.total}): ${item.descricao}`
      : `Aluguel: ${item.descricao}`;
  }
  if (
    item.modalidade === 'unico' ||
    item.tipoDesconto === TIPO_DESCONTO.ADIANTAMENTO ||
    item.tipoDesconto === TIPO_DESCONTO.UNICO
  ) {
    return `Adiantamento: ${item.descricao}`;
  }
  if (item.modalidade === 'parcelado' || item.tipoDesconto === TIPO_DESCONTO.EMPRESTIMO) {
    return `Empréstimo: ${item.descricao}`;
  }
  return `Desconto: ${item.descricao}`;
}

export function getRecorrentesPendentesPagamento(funcionario, referenceDate = new Date()) {
  if (!funcionario) return [];

  const items = [];

  const pushItem = (item, categoria, modalidade) => {
    items.push({
      commitmentId: item.id,
      categoria,
      modalidade,
      tipoDesconto: getTipoDesconto(item),
      descricao: item.descricao || (categoria === 'aluguel' ? 'Aluguel' : 'Desconto'),
      valor: getValorParcela(item),
      status: 'pendente',
    });
  };

  (funcionario.alugueis || []).forEach((item) => {
    if (isCommitmentParcelado(item)) return;
    if (hasCobrancaAutomaticaPendente(item, referenceDate)) {
      pushItem(item, 'aluguel', 'recorrente');
    }
  });

  (funcionario.descontosMensais || []).forEach((item) => {
    if (isCommitmentParcelado(item)) return;
    if (hasCobrancaAutomaticaPendente(item, referenceDate)) {
      const modalidade = isDescontoCobrancaUnica(item) ? 'unico' : 'recorrente';
      pushItem(item, 'desconto', modalidade);
    }
  });

  return items;
}

function valorEscolhidoDesconto(item, valores = {}) {
  const raw = valores?.[item.commitmentId];
  const parsed = raw == null || raw === '' ? item.sugerido ?? item.valor : parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return item.sugerido ?? item.valor ?? 0;
  return Math.round(parsed * 100) / 100;
}

/** Descontos ainda ativos, inclusive os manuais. A parcela cadastrada é só a sugestão. */
export function getDescontosDisponiveisFechamento(funcionario) {
  if (!funcionario) return [];
  const items = [];

  const push = (item, categoria) => {
    if (!item || item.estado === 'Inativo' || item.estado === 'Encerrado') return;
    if (isCommitmentParcelado(item)) {
      if (getParcelasRestantesCount(item) <= 0) return;
      const saldo = getSaldoRestanteEmprestimo(item);
      if (saldo <= 0.004) return;
      const sugerido = Math.min(getValorParcela(item) || saldo, saldo);
      items.push({
        commitmentId: item.id,
        categoria,
        tipo: categoria,
        modalidade: 'parcelado',
        tipoDesconto: getTipoDesconto(item),
        descricao: item.descricao || (categoria === 'aluguel' ? 'Aluguel' : 'Desconto'),
        saldo,
        sugerido,
        valor: sugerido,
        numero: getParcelaAtual(item),
        total: getTotalParcelas(item),
      });
      return;
    }
    if (isDescontoCobrancaUnica(item)) {
      if (!isCommitmentFinanciallyActive(item)) return;
      const sugerido = getValorParcela(item);
      if (!(sugerido > 0)) return;
      items.push({
        commitmentId: item.id,
        categoria,
        tipo: categoria,
        modalidade: 'unico',
        tipoDesconto: getTipoDesconto(item),
        descricao: item.descricao || 'Desconto',
        saldo: sugerido,
        sugerido,
        valor: sugerido,
      });
      return;
    }
    if (!isCommitmentFinanciallyActive(item)) return;
    const sugerido = getValorParcela(item);
    if (!(sugerido > 0)) return;
    items.push({
      commitmentId: item.id,
      categoria,
      tipo: categoria,
      modalidade: 'recorrente',
      tipoDesconto: getTipoDesconto(item),
      descricao: item.descricao || (categoria === 'aluguel' ? 'Aluguel' : 'Desconto'),
      saldo: sugerido,
      sugerido,
      valor: sugerido,
    });
  };

  (funcionario.alugueis || []).forEach((item) => push(item, 'aluguel'));
  (funcionario.descontosMensais || []).forEach((item) => push(item, 'desconto'));
  return items;
}

/** Lista unificada de descontos/aluguéis pendentes (controlo manual). */
export function getDescontosPendentesPagamento(funcionario, referenceDate = new Date()) {
  const recorrentes = getRecorrentesPendentesPagamento(funcionario, referenceDate);
  const parcelas = getParcelasPendentesPagamento(funcionario, referenceDate).map((p) => ({
    ...p,
    categoria: p.tipo,
    modalidade: 'parcelado',
    status: 'pendente',
  }));
  return [...recorrentes, ...parcelas];
}

export function getTotalDescontosPendentes(funcionario, referenceDate = new Date()) {
  return getDescontosPendentesPagamento(funcionario, referenceDate).reduce(
    (sum, item) => sum + (item.valor || 0),
    0
  );
}
export function getParcelasPendentesPagamento(funcionario, referenceDate = new Date()) {
  if (!funcionario) return [];

  const items = [];

  const pushItem = (item, tipo) => {
    if (isDescontoManual(item)) return;
    if (!isCommitmentParcelado(item) || !canRegisterParcela(item, referenceDate)) return;
    items.push({
      commitmentId: item.id,
      tipo,
      tipoDesconto: getTipoDesconto(item),
      descricao: item.descricao || (tipo === 'aluguel' ? 'Aluguel parcelado' : 'Empréstimo'),
      valor: getValorParcela(item),
      numero: getParcelaAtual(item),
      total: getTotalParcelas(item),
    });
  };

  (funcionario.alugueis || []).forEach((item) => pushItem(item, 'aluguel'));
  (funcionario.descontosMensais || []).forEach((item) => pushItem(item, 'desconto'));

  return items;
}

export function getAcertosPendentesPagamento(funcionarioId, valoresAcerto = [], funcionario = null) {
  const descontos = funcionario?.descontosMensais || [];
  return valoresAcerto.filter(
    (v) =>
      v.funcionarioId === funcionarioId &&
      !isAcertoAcertado(v) &&
      !acertoJaRepresentadoEmDescontos(v, descontos)
  );
}

export function getDefaultPaymentSelections(funcionario, diarias, valoresAcerto, funcionarioId) {
  return {
    acertoIds: [],
    recorrenteCommitmentIds: [],
    parcelaCommitmentIds: [],
  };
}

export function normalizeGratificacao(gratificacao) {
  return normalizeAjusteManualPagamento(gratificacao);
}

export function normalizeAjusteManualPagamento(ajuste) {
  if (!ajuste?.ativa) {
    return { valor: 0, observacao: '' };
  }

  const valor = parseFloat(ajuste.valor);
  if (Number.isNaN(valor) || valor <= 0) {
    return { valor: 0, observacao: '' };
  }

  return {
    valor,
    observacao: (ajuste.observacao || '').trim(),
  };
}

function sumAjustesExtras(extras = [], tipo) {
  return (extras || []).reduce((sum, item) => {
    if (item.tipo !== tipo) return sum;
    const valor = parseFloat(item.valor);
    if (Number.isNaN(valor) || valor <= 0) return sum;
    return sum + valor;
  }, 0);
}

function normalizeAjustesExtras(extras = []) {
  return (extras || [])
    .map((item) => {
      const valor = parseFloat(item.valor);
      if (Number.isNaN(valor) || valor <= 0) return null;
      const descricao = String(item.descricao || '').trim();
      const tipo = item.tipo === 'desconto' ? 'desconto' : 'acrescimo';
      return { tipo, descricao, valor, data: String(item.data || '').trim() };
    })
    .filter(Boolean);
}

export function buildPaymentPreview({
  funcionario,
  funcionarioId,
  diarias = [],
  valoresAcerto = [],
  fechamentosPagamento = [],
  selections = {},
  referenceDate = new Date(),
  gratificacao = null,
  ajustesManuais = null,
}) {
  if (isParceiroFuncionario(funcionario)) {
    return {
      diariasPendentes: [],
      diariasSelecionadas: [],
      quantidadeDiarias: 0,
      totalDiarias: 0,
      recorrentesPendentes: [],
      recorrentesSelecionados: [],
      recorrentesAplicados: [],
      totalAluguelRecorrente: 0,
      totalDescontoRecorrente: 0,
      totalRecorrentes: 0,
      parcelasPendentes: [],
      parcelasSelecionadas: [],
      totalParcelado: 0,
      descontosPendentes: [],
      descontosDisponiveis: [],
      acertosPendentes: [],
      acertosSelecionados: [],
      acertosDetalhe: [],
      totalAcertoUtilizado: 0,
      totalAcertoAdicional: 0,
      totalAcertoDevolver: 0,
      valorBruto: 0,
      totalDescontos: 0,
      observacoesDiarias: [],
      totalAcrescimoBase: 0,
      totalAcrescimoManual: 0,
      acrescimoObservacao: '',
      totalDescontoManualBase: 0,
      totalDescontoManual: 0,
      descontoManualObservacao: '',
      totalGratificacao: 0,
      gratificacaoObservacao: '',
      ajustesExtras: [],
      totalPago: 0,
    };
  }
  const diariasPendentes = getDiariasPendentes(
    funcionarioId,
    diarias,
    fechamentosPagamento,
    funcionario ? [funcionario] : []
  );
  const selectedIds = selections.diariaIds;
  const diariasSelecionadas = Array.isArray(selectedIds)
    ? diariasPendentes.filter((d) => selectedIds.includes(d.id))
    : diariasPendentes;
  const totalDiarias = diariasSelecionadas.reduce((sum, d) => sum + calcDiariaTotal(d), 0);

  const descontosDisponiveis = getDescontosDisponiveisFechamento(funcionario);
  const recorrenteIds =
    selections.recorrenteCommitmentIds ?? selections.recorrenteIds ?? [];
  const parcelaIds = selections.parcelaCommitmentIds ?? [];
  const escolhidosIds = new Set([...recorrenteIds, ...parcelaIds]);
  const escolhidos = descontosDisponiveis
    .filter((item) => escolhidosIds.has(item.commitmentId))
    .map((item) => ({
      ...item,
      valor: valorEscolhidoDesconto(item, selections.descontoValores),
    }));
  const recorrentesPendentes = descontosDisponiveis.filter((item) => item.modalidade !== 'parcelado');
  const recorrentesSelecionados = escolhidos.filter((item) => item.modalidade !== 'parcelado');
  const totalAluguelRecorrente = recorrentesSelecionados
    .filter((r) => r.categoria === 'aluguel')
    .reduce((sum, r) => sum + r.valor, 0);
  const totalDescontoRecorrente = recorrentesSelecionados
    .filter((r) => r.categoria === 'desconto')
    .reduce((sum, r) => sum + r.valor, 0);
  const totalRecorrentes = totalAluguelRecorrente + totalDescontoRecorrente;

  const parcelasPendentes = descontosDisponiveis.filter((item) => item.modalidade === 'parcelado');
  const parcelasSelecionadas = escolhidos.filter((item) => item.modalidade === 'parcelado');
  const totalParcelado = parcelasSelecionadas.reduce((sum, p) => sum + p.valor, 0);
  const acertosPendentes = getAcertosPendentesPagamento(funcionarioId, valoresAcerto, funcionario);
  const acertoIds = selections.acertoIds || [];
  const acertosSelecionados = acertosPendentes.filter((a) => acertoIds.includes(a.id));

  let totalAcertoUtilizado = 0;
  let totalAcertoAdicional = 0;
  let totalAcertoDevolver = 0;

  const acertosDetalhe = acertosSelecionados.map((item) => {
    const utilizado = getValorUtilizado(item);
    const adicional = getValorAdicionalAPagar(item);
    const devolver = getValorADevolver(item);
    totalAcertoUtilizado += utilizado;
    totalAcertoAdicional += adicional;
    totalAcertoDevolver += devolver;
    return {
      valorAcertoId: item.id,
      motivo: item.motivo,
      observacao: item.observacao || '',
      data: item.data || '',
      utilizado,
      adicional,
      devolver,
    };
  });

  const totalDescontos =
    totalRecorrentes + totalParcelado + totalAcertoUtilizado;
  const valorBruto = totalDiarias;
  const observacoesDiarias = buildObservacoesDiariasList(diariasSelecionadas);

  const acrescimoNormalizado = normalizeAjusteManualPagamento(
    ajustesManuais?.acrescimo || (gratificacao?.ativa ? gratificacao : null)
  );
  const gratificacaoNormalizada = normalizeAjusteManualPagamento(ajustesManuais?.gratificacao);
  const descontoManualNormalizado = normalizeAjusteManualPagamento(
    ajustesManuais?.desconto
  );
  const ajustesExtras = normalizeAjustesExtras(ajustesManuais?.extras);
  const extraAcrescimo = sumAjustesExtras(ajustesExtras, 'acrescimo');
  const extraDesconto = sumAjustesExtras(ajustesExtras, 'desconto');

  const totalAcrescimoBase = acrescimoNormalizado.valor;
  const totalGratificacao = gratificacaoNormalizada.valor;
  const totalDescontoManualBase = descontoManualNormalizado.valor;
  const totalAcrescimoManual = totalAcrescimoBase + totalGratificacao + extraAcrescimo;
  const totalDescontoManual = totalDescontoManualBase + extraDesconto;
  const totalPago = Math.max(
    0,
    valorBruto -
      totalDescontos +
      totalAcertoAdicional +
      totalAcrescimoManual -
      totalDescontoManual
  );

  return {
    diariasPendentes,
    diariasSelecionadas,
    quantidadeDiarias: diariasSelecionadas.length,
    totalDiarias,
    recorrentesPendentes,
    recorrentesSelecionados,
    recorrentesAplicados: recorrentesSelecionados,
    totalAluguelRecorrente,
    totalDescontoRecorrente,
    totalRecorrentes,
    parcelasPendentes,
    parcelasSelecionadas,
    totalParcelado,
    descontosPendentes: descontosDisponiveis,
    descontosDisponiveis,
    acertosPendentes,
    acertosSelecionados,
    acertosDetalhe,
    totalAcertoUtilizado,
    totalAcertoAdicional,
    totalAcertoDevolver,
    valorBruto,
    totalDescontos,
    observacoesDiarias,
    totalAcrescimoBase,
    totalAcrescimoManual,
    acrescimoObservacao: acrescimoNormalizado.observacao,
    totalDescontoManualBase,
    totalDescontoManual,
    descontoManualObservacao: descontoManualNormalizado.observacao,
    totalGratificacao,
    gratificacaoObservacao: gratificacaoNormalizada.observacao,
    ajustesExtras,
    totalPago,
  };
}

export function hasPendingPaymentItems(preview) {
  if (!preview) return false;

  return (
    preview.diariasPendentes.length > 0 ||
    preview.recorrentesPendentes?.length > 0 ||
    (preview.parcelasPendentes || []).length > 0 ||
    preview.acertosPendentes.length > 0
  );
}

export function canConfirmFechamento(preview, selections = {}, gratificacao = null, ajustesManuais = null) {
  if (!preview) return false;

  const hasDiarias = getDiariasSelecionadasDoPreview(preview).length > 0;
  const hasSelectedRecorrentes = (selections.recorrenteCommitmentIds || []).length > 0;
  const hasSelectedParcelas = (selections.parcelaCommitmentIds || []).length > 0;
  const hasSelectedAcertos = (selections.acertoIds || []).length > 0;
  const hasAcrescimo =
    normalizeAjusteManualPagamento(
      ajustesManuais?.acrescimo || (gratificacao?.ativa ? gratificacao : null)
    ).valor > 0;
  const hasGratificacao = normalizeAjusteManualPagamento(ajustesManuais?.gratificacao).valor > 0;
  const hasDescontoManual = normalizeAjusteManualPagamento(ajustesManuais?.desconto).valor > 0;
  const hasExtras = normalizeAjustesExtras(ajustesManuais?.extras).length > 0;

  return (
    hasDiarias ||
    hasSelectedRecorrentes ||
    hasSelectedParcelas ||
    hasSelectedAcertos ||
    hasAcrescimo ||
    hasGratificacao ||
    hasDescontoManual ||
    hasExtras
  );
}
export function buildReferenciaPagamento(tipoPagamento, data, customReferencia = '', semanaMes = null) {
  if (customReferencia?.trim()) return customReferencia.trim();

  const date = data ? new Date(data) : new Date();
  const dataStr = date.toISOString().slice(0, 10);

  if (tipoPagamento === TIPO_PAGAMENTO.MENSAL) {
    const mes = date.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
    return `Pagamento mensal — ${mes.charAt(0).toUpperCase()}${mes.slice(1)}`;
  }

  if (tipoPagamento === TIPO_PAGAMENTO.QUINZENAL) {
    return `Pagamento quinzenal — ${dataStr}`;
  }

  if (tipoPagamento === TIPO_PAGAMENTO.SEMANAL) {
    const semana = semanaMes ? ` — Semana ${semanaMes}` : '';
    return `Pagamento semanal${semana} — ${dataStr}`;
  }

  return `Pagamento — ${dataStr}`;
}
export function buildReferenciaMes(data) {
  const date = data ? new Date(data) : new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function buildFechamentoRecord({
  funcionarioId,
  funcionarioNome,
  preview,
  tipoPagamento,
  referencia,
  referenciaMes,
  semanaMes,
  observacao,
  pagamentoId,
  data,
  periodoInicio = null,
  periodoFim = null,
}) {
  const dataFechamento = data || new Date().toISOString().slice(0, 10);
  return {
    id: generateId(),
    funcionarioId,
    funcionarioNome,
    data: dataFechamento,
    tipoPagamento,
    referencia,
    referenciaMes: referenciaMes || null,
    semanaMes: semanaMes ?? null,
    periodoInicio: periodoInicio || null,
    periodoFim: periodoFim || null,
    totalDiarias: preview.totalDiarias,
    valorBruto: preview.valorBruto,
    totalAluguelRecorrente: preview.totalAluguelRecorrente,
    totalDescontoRecorrente: preview.totalDescontoRecorrente,
    totalDescontosRecorrentes: preview.totalRecorrentes,
    totalDescontosParcelados: preview.totalParcelado,
    totalAcertosUtilizado: preview.totalAcertoUtilizado,
    totalAcertosAdicional: preview.totalAcertoAdicional,
    totalAcertosDevolvido: preview.totalAcertoDevolver,
    totalDescontos: preview.totalDescontos,
    totalGratificacao: preview.totalGratificacao || 0,
    gratificacaoObservacao: preview.gratificacaoObservacao || '',
    totalAcrescimoBase: preview.totalAcrescimoBase || 0,
    totalAcrescimoManual: preview.totalAcrescimoManual || preview.totalGratificacao || 0,
    acrescimoObservacao: preview.acrescimoObservacao || preview.gratificacaoObservacao || '',
    totalDescontoManualBase: preview.totalDescontoManualBase || 0,
    totalDescontoManual: preview.totalDescontoManual || 0,
    descontoManualObservacao: preview.descontoManualObservacao || '',
    ajustesExtras: preview.ajustesExtras || [],
    observacoesDiariasReferencia: preview.observacoesDiarias || [],
    totalPago: preview.totalPago,
    observacao: observacao?.trim() || '',
    status: FECHAMENTO_STATUS.PAGO,
    diariaIds: getDiariasSelecionadasDoPreview(preview).map((d) => d.id),
    quantidadeDiarias: getDiariasSelecionadasDoPreview(preview).length,
    diariasIncluidas: getDiariasSelecionadasDoPreview(preview).map((d) => ({
      id: d.id,
      data: d.data || '',
      valor: calcDiariaTotal(d),
      obraId: d.obraId || null,
      observacao: String(d.observacao || '').trim(),
    })),
    recorrentesAplicados: preview.recorrentesSelecionados.map((r) => ({
      commitmentId: r.commitmentId,
      tipo: r.categoria,
      categoria: r.categoria,
      modalidade: r.modalidade,
      descricao: r.descricao,
      valor: r.valor,
      semana: semanaMes ?? null,
      status: 'descontado',
    })),
    parcelasRegistradas: preview.parcelasSelecionadas.map((p) => ({
      commitmentId: p.commitmentId,
      tipo: p.tipo,
      descricao: p.descricao,
      numero: p.numero,
      total: p.total,
      valor: p.valor,
      semana: semanaMes ?? null,
      status: 'descontado',
    })),    acertosAcertados: preview.acertosDetalhe.map((a) => ({
      valorAcertoId: a.valorAcertoId,
      motivo: a.motivo,
      observacao: a.observacao || '',
      data: a.data || '',
      valorUtilizado: a.utilizado,
      valorDevolvido: a.devolver,
      valorAdicional: a.adicional,
    })),
    pagamentoId,
    createdAt: new Date().toISOString(),
  };
}

export function applyParcelasToFuncionario(funcionario, parcelasSelecionadas, details = {}) {
  let updated = { ...funcionario };
  const lancamentos = [];

  for (const parcela of parcelasSelecionadas) {
    const listKey = parcela.tipo === 'aluguel' || parcela.categoria === 'aluguel' ? 'alugueis' : 'descontosMensais';
    const list = updated[listKey] || [];
    const item = list.find((c) => c.id === parcela.commitmentId);
    if (!item) return { error: 'Desconto não encontrado.' };

    const result = registerParcelaOnCommitment(item, {
      valor: parcela.valor,
      data: details.data,
      semana: details.semana,
      fechamentoId: details.fechamentoId,
      solicitadoManualmente: true,
      noPagamento: true,
    });
    if (result.error) return { error: result.error };

    const entry = getUltimoLancamento(result.item, 'parcela');
    lancamentos.push({
      commitmentId: item.id,
      lancamentoId: entry?.id || null,
      valor: entry?.valor ?? parcela.valor,
      numero: entry?.numero ?? parcela.numero,
      modalidade: 'parcelado',
    });
    updated = {
      ...updated,
      [listKey]: list.map((c) => (c.id === item.id ? result.item : c)),
    };
  }

  return { funcionario: updated, lancamentos };
}

function getUltimoLancamento(item, kind) {
  const lista = kind === 'parcela' ? item?.historicoParcelas || [] : item?.historicoDescontos || [];
  return lista[lista.length - 1] || null;
}

export function applyRecorrentesToFuncionario(funcionario, recorrentesSelecionados, details = {}) {
  let updated = { ...funcionario };
  const lancamentos = [];

  for (const rec of recorrentesSelecionados) {
    const listKey = rec.categoria === 'aluguel' ? 'alugueis' : 'descontosMensais';
    const list = updated[listKey] || [];
    const item = list.find((c) => c.id === rec.commitmentId);
    if (!item) return { error: 'Desconto não encontrado.' };

    const result = registerRecorrenteDescontoOnCommitment(item, {
      valor: rec.valor,
      data: details.data,
      mesAno: details.mesAno,
      semana: details.semana,
      fechamentoId: details.fechamentoId,
      solicitadoManualmente: true,
      noPagamento: true,
    });
    if (result.error) return { error: result.error };

    const entry = getUltimoLancamento(result.item, 'desconto');
    lancamentos.push({
      commitmentId: item.id,
      lancamentoId: entry?.id || null,
      valor: entry?.valor ?? rec.valor,
      modalidade: rec.modalidade || 'recorrente',
    });
    updated = {
      ...updated,
      [listKey]: list.map((c) => (c.id === item.id ? result.item : c)),
    };
  }

  return { funcionario: updated, lancamentos };
}
export function retirarDescontoDoFechamento(fechamento, { lancamentoId, commitmentId, valor, numero, descricao } = {}) {
  if (!fechamento) return null;
  const valorNum = Number(valor) || 0;
  const match = (linha) => {
    if (lancamentoId && linha.lancamentoId === lancamentoId) return true;
    if (linha.lancamentoId) return false;
    if (String(linha.commitmentId) !== String(commitmentId)) return false;
    if (numero != null && linha.numero != null && Number(linha.numero) !== Number(numero)) return false;
    return Math.abs((Number(linha.valor) || 0) - valorNum) < 0.02;
  };

  const parcelas = [...(fechamento.parcelasRegistradas || [])];
  const recorrentes = [...(fechamento.recorrentesAplicados || [])];
  const pIndex = parcelas.findIndex(match);
  const rIndex = pIndex >= 0 ? -1 : recorrentes.findIndex(match);
  if (pIndex < 0 && rIndex < 0) return fechamento;
  if (pIndex >= 0) parcelas.splice(pIndex, 1);
  if (rIndex >= 0) recorrentes.splice(rIndex, 1);

  const totalParcelado = parcelas.reduce((sum, linha) => sum + (Number(linha.valor) || 0), 0);
  const totalAluguel = recorrentes
    .filter((linha) => linha.categoria === 'aluguel' || linha.tipo === 'aluguel')
    .reduce((sum, linha) => sum + (Number(linha.valor) || 0), 0);
  const totalDescRec = recorrentes
    .filter((linha) => linha.categoria !== 'aluguel' && linha.tipo !== 'aluguel')
    .reduce((sum, linha) => sum + (Number(linha.valor) || 0), 0);
  const totalRec = totalAluguel + totalDescRec;
  const totalAcertos = Number(fechamento.totalAcertosUtilizado) || 0;
  const totalDescontos = Math.round((totalParcelado + totalRec + totalAcertos) * 100) / 100;
  const bruto = Number(fechamento.valorBruto ?? fechamento.totalDiarias) || 0;
  const acrescimo = Number(fechamento.totalAcrescimoManual) || 0;
  const descontoManual = Number(fechamento.totalDescontoManual) || 0;
  const adicional = Number(fechamento.totalAcertosAdicional) || 0;
  const totalPago = Math.max(
    0,
    Math.round((bruto - totalDescontos + adicional + acrescimo - descontoManual) * 100) / 100
  );

  const next = {
    ...fechamento,
    parcelasRegistradas: parcelas,
    recorrentesAplicados: recorrentes,
    totalDescontosParcelados: Math.round(totalParcelado * 100) / 100,
    totalAluguelRecorrente: Math.round(totalAluguel * 100) / 100,
    totalDescontoRecorrente: Math.round(totalDescRec * 100) / 100,
    totalDescontosRecorrentes: Math.round(totalRec * 100) / 100,
    totalDescontos,
    totalPago,
    updatedAt: new Date().toISOString(),
  };

  if (next.comprovativoSnapshot && typeof next.comprovativoSnapshot === 'object') {
    const snap = { ...next.comprovativoSnapshot, totalPago };
    if (Array.isArray(snap.descontos)) {
      const nome = String(descricao || '').trim();
      const idx = snap.descontos.findIndex(
        (linha) =>
          Math.abs((Number(linha.valor) || 0) - valorNum) < 0.02 &&
          (!nome || String(linha.descricao || linha.label || '').includes(nome))
      );
      if (idx >= 0) snap.descontos = snap.descontos.filter((_, index) => index !== idx);
    }
    next.comprovativoSnapshot = snap;
  }

  return next;
}

export function calcTotalFechamentosFuncionario(funcionarioId, fechamentosPagamento = []) {
  return fechamentosPagamento
    .filter((f) => sameFuncionarioId(f.funcionarioId, funcionarioId))
    .reduce((sum, f) => sum + (f.totalPago || 0), 0);
}

export function getFechamentosFuncionario(funcionarioId, fechamentosPagamento = []) {
  return fechamentosPagamento
    .filter((f) => sameFuncionarioId(f.funcionarioId, funcionarioId))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function buildPagamentoDescricao(fechamento) {
  return fechamento.referencia || `Pagamento — ${fechamento.data}`;
}
