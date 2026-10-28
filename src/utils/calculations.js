import {
  getOpenDebts,
  getValorRecebidoPagamento,
} from './debtCalculations';
import { isObraPagamentoRecebido } from './obraPagamentoCalculations';
import {
  calcCommitmentFinancialSummary,
  getValorParcela,
  isCommitmentFinanciallyActive,
  isCommitmentRecorrente,
} from './commitmentCalculations';
import {
  buildPaymentPreview,
  getDefaultPaymentSelections,
} from './fechamentoPagamentoCalculations';
import { getGastoHistoricoDescricao } from './gastoDisplay';
import { isObraComDadosParciais } from './controlDate';
import {
  isSpecialObra,
  isPartnershipObra,
  calcObraEmpresaFinanceiro,
  applyEmpresaShare,
  applyEmpresaShareToPagamento,
} from './obraSpecial';
import { getGastoEmpresaValor } from './gastoEmpresaCalculations';
import { getGastoCustoEmpresa, getGastoValorAssinado } from './gastoDocumentoTipo';
import { getObraExtras, getExtraStatusLabel, summarizeObraExtras } from './obraExtras';
import { roundMoney } from './ivaCalculations';
import { calcDiariaValorPagavel } from './funcionarioTipo';
import {
  filterDiariasDaObra,
  getDiariaCustoNaObra,
  formatDiariaObrasLabel,
} from './diariaObraAlocacao';

export function calcDiariaTotal(diaria) {
  if (!diaria) return 0;
  return (Number(diaria.quantidade) || 0) * (Number(diaria.valorDiaria) || 0);
}

export function calcTotalDiariasFuncionario(funcionarioId, diarias) {
  return (diarias || [])
    .filter((d) => d && d.funcionarioId === funcionarioId)
    .reduce((sum, d) => sum + calcDiariaTotal(d), 0);
}

export function calcTotalAdiantamentosFuncionario(funcionarioId, adiantamentos) {
  return (adiantamentos || [])
    .filter((a) => a && a.funcionarioId === funcionarioId)
    .reduce((sum, a) => sum + (a.valor || 0), 0);
}

export function calcTotalEmprestimosFuncionario(funcionarioId, emprestimos) {
  return (emprestimos || [])
    .filter((e) => e && e.funcionarioId === funcionarioId)
    .reduce((sum, e) => sum + calcEmprestimoRestante(e), 0);
}

export function calcEmprestimoRestante(emprestimo) {
  return Math.max(0, (emprestimo.valor || 0) - (emprestimo.valorPago || 0));
}

export function deriveEmprestimoEstado({ valor, valorPago, estado }) {
  if (valorPago >= valor && valor > 0) return 'Pago';
  if (valorPago > 0 && valorPago < valor) return 'Parcialmente pago';
  if (estado === 'Pago' || estado === 'Quitado') return 'Pago';
  return 'Em aberto';
}

export function isCommitmentActive(item, referenceDate = new Date()) {
  if (!item || item.estado !== 'Ativo') return false;

  const ref = referenceDate.toISOString().slice(0, 10);
  if (item.dataInicio && item.dataInicio > ref) return false;
  if (item.dataFim && item.dataFim < ref) return false;

  return true;
}

export function calcDescontosMensaisAtivos(funcionario, referenceDate = new Date()) {
  if (!funcionario) {
    return {
      items: [],
      total: 0,
      totalAluguel: 0,
      totalDescontos: 0,
      totalParceladoRegistrado: 0,
      totalAluguelParceladoRegistrado: 0,
      totalDescontoParceladoRegistrado: 0,
      parcelasEmAberto: 0,
      parcelasRestantesTotal: 0,
      proximoDesconto: 0,
      totalRecorrenteAtivo: 0,
      totalDescontosPendentes: 0,
    };
  }

  const alugueis = (funcionario.alugueis || [])
    .filter((item) => isCommitmentRecorrente(item) && isCommitmentFinanciallyActive(item))
    .map((item) => ({
      id: item.id,
      label: item.descricao || 'Aluguel',
      valor: getValorParcela(item),
      tipo: 'aluguel',
    }));

  const descontos = (funcionario.descontosMensais || [])
    .filter((item) => isCommitmentRecorrente(item) && isCommitmentFinanciallyActive(item))
    .map((item) => ({
      id: item.id,
      label: item.descricao || 'Desconto mensal',
      valor: getValorParcela(item),
      tipo: 'desconto',
    }));

  const summary = calcCommitmentFinancialSummary(funcionario);
  const items = [...alugueis, ...descontos];
  const totalAluguel = alugueis.reduce((sum, item) => sum + (item.valor || 0), 0);
  const totalDescontos = descontos.reduce((sum, item) => sum + (item.valor || 0), 0);

  return {
    items,
    total: totalAluguel + totalDescontos,
    totalAluguel,
    totalDescontos,
    totalParceladoRegistrado: summary.totalParceladoRegistrado,
    totalAluguelParceladoRegistrado: summary.totalAluguelParceladoRegistrado,
    totalDescontoParceladoRegistrado: summary.totalDescontoParceladoRegistrado,
    parcelasEmAberto: summary.parcelasEmAberto,
    parcelasRestantesTotal: summary.parcelasRestantesTotal,
    proximoDesconto: summary.proximoDesconto,
    totalRecorrenteAtivo: summary.totalRecorrenteAtivo,
    totalDescontosPendentes: summary.totalDescontosPendentes,
  };
}

export function calcTotalPagamentosFuncionario(funcionarioId, pagamentos, funcionarios) {
  const func = funcionarios.find((f) => f.id === funcionarioId);
  if (!func) return 0;
  return pagamentos
    .filter(
      (p) =>
        p.tipo === 'Pagamento a funcionário' &&
        p.pessoaRelacionada === func.nome &&
        !p.fechamentoPagamentoId
    )
    .reduce((sum, p) => sum + (p.valor || 0), 0);
}

export function calcSaldoFuncionario(
  funcionarioId,
  { diarias, pagamentos, funcionarios, valoresAcerto = [], fechamentosPagamento = [] }
) {
  const funcionario = funcionarios.find((f) => f.id === funcionarioId);
  if (!funcionario) return 0;

  const selections = getDefaultPaymentSelections(
    funcionario,
    diarias,
    valoresAcerto,
    funcionarioId
  );
  const preview = buildPaymentPreview({
    funcionario,
    funcionarioId,
    diarias,
    valoresAcerto,
    fechamentosPagamento,
    selections,
  });

  const manualPagamentos = (pagamentos || [])
    .filter(
      (p) =>
        p.tipo === 'Pagamento a funcionário' &&
        p.pessoaRelacionada === funcionario.nome &&
        !p.fechamentoPagamentoId
    )
    .reduce((sum, p) => sum + (p.valor || 0), 0);

  return Math.max(0, preview.totalPago - manualPagamentos);
}

export function calcGastosObra(obraId, gastos) {
  return (gastos || [])
    .filter((g) => g && g.obraId === obraId)
    .reduce((sum, g) => sum + getGastoCustoEmpresa(g), 0);
}

export function getGastosEmpresaDaObra(obraId, gastosEmpresa = []) {
  return (gastosEmpresa || []).filter((gasto) => gasto && gasto.obraId === obraId && gasto.estado !== 'previsto');
}

export function calcGastosEmpresaDaObra(obraId, gastosEmpresa = [], dateRange = {}) {
  const { startDate, endDate } = dateRange;
  const items = getGastosEmpresaDaObra(obraId, gastosEmpresa);
  const filtered = startDate || endDate ? filterItemsByDateRange(items, startDate, endDate) : items;
  return filtered.reduce((sum, gasto) => sum + getGastoEmpresaValor(gasto), 0);
}

export function calcRecebimentosObra(obraId, pagamentos) {
  return (pagamentos || [])
    .filter((p) => p && p.obraId === obraId && p.tipo === 'Recebimento de cliente')
    .reduce((sum, p) => sum + getValorRecebidoPagamento(p), 0);
}

export function calcDiariasObra(obraId, diarias, funcionarios = []) {
  return filterDiariasDaObra(diarias, obraId).reduce(
    (sum, d) => sum + getDiariaCustoNaObra(d, obraId, funcionarios),
    0
  );
}

export function filterItemsByDateRange(items, startDate, endDate) {
  return (items || []).filter((item) => {
    if (!item) return false;
    if (!item.data) return true;
    if (startDate && item.data < startDate) return false;
    if (endDate && item.data > endDate) return false;
    return true;
  });
}

/** Verifica se o registo tem data válida para gráficos temporais. */
export function hasValidChartDate(item, dateField = 'data') {
  const raw = item?.[dateField] ?? item?.data;
  if (!raw) return false;
  const date = String(raw).slice(0, 10);
  return !Number.isNaN(new Date(`${date}T00:00:00`).getTime());
}

/**
 * Filtra registos para gráficos.
 * Sem filtro de período: inclui registos sem data (exceto quando requiresDate).
 * Com filtro de período: exclui registos sem data.
 */
export function filterItemsForChartDateRange(items, dateRange = {}, dateField = 'data') {
  const { startDate, endDate } = dateRange;
  const requiresDate = Boolean(startDate || endDate);

  return (items || []).filter((item) => {
    if (!item) return false;
    const raw = item?.[dateField] ?? item?.data;
    const date = raw ? String(raw).slice(0, 10) : null;

    if (!date) return !requiresDate;
    if (startDate && date < startDate) return false;
    if (endDate && date > endDate) return false;
    return true;
  });
}

export function getPagamentoChartDate(pagamento) {
  if (!pagamento) return null;
  const raw =
    pagamento.data ||
    pagamento.historicoPagamentos?.[pagamento.historicoPagamentos.length - 1]?.data;
  return raw ? String(raw).slice(0, 10) : null;
}

export function isRecebimentoChartEligible(pagamento, dateRange = {}) {
  if (!pagamento || pagamento.tipo !== 'Recebimento de cliente') return false;
  if (!isObraPagamentoRecebido(pagamento)) return false;
  if (getValorRecebidoPagamento(pagamento) <= 0) return false;

  const date = getPagamentoChartDate(pagamento);
  if (!date) return false;

  const { startDate, endDate } = dateRange;
  if (startDate && date < startDate) return false;
  if (endDate && date > endDate) return false;
  return true;
}

export function isGastoChartEligible(gasto, dateRange = {}) {
  if (!gasto || !getGastoValorAssinado(gasto)) return false;
  if (!hasValidChartDate(gasto)) return false;
  return filterItemsForChartDateRange([gasto], dateRange).length > 0;
}

export function isDiariaChartEligible(diaria, dateRange = {}, funcionarios = []) {
  if (!diaria || calcDiariaValorPagavel(diaria, funcionarios) <= 0) return false;
  const { startDate, endDate } = dateRange;
  if (!startDate && !endDate) return true;
  return hasValidChartDate(diaria) && filterItemsForChartDateRange([diaria], dateRange).length > 0;
}

export function calcCustoObraForCharts(obraId, gastos, diarias, dateRange = {}, gastosEmpresa = [], funcionarios = []) {
  const obraGastos = (gastos || []).filter((g) => g && g.obraId === obraId && getGastoValorAssinado(g) !== 0);
  const obraDiarias = filterDiariasDaObra(diarias, obraId);
  const empresaGastos = getGastosEmpresaDaObra(obraId, gastosEmpresa);

  const filteredGastos = filterItemsForChartDateRange(obraGastos, dateRange);
  const filteredDiarias = filterItemsForChartDateRange(obraDiarias, dateRange);
  const filteredEmpresa = filterItemsForChartDateRange(empresaGastos, dateRange);

  const totalGastos =
    filteredGastos.reduce((sum, g) => sum + getGastoCustoEmpresa(g), 0) +
    filteredEmpresa.reduce((sum, g) => sum + getGastoEmpresaValor(g), 0);
  const totalDiarias = filteredDiarias.reduce(
    (sum, d) => sum + getDiariaCustoNaObra(d, obraId, funcionarios),
    0
  );

  return {
    totalGastos,
    totalDiarias,
    totalCusto: totalGastos + totalDiarias,
  };
}

/**
 * Obra só entra no cálculo de lucro dos gráficos se houver custos registados.
 * Não assume custo zero quando existem recebimentos sem gastos/diárias.
 */
export function isObraEligibleForProfitChart(obra, gastos, pagamentos, diarias, dateRange = {}, gastosEmpresa = [], funcionarios = []) {
  if (isSpecialObra(obra)) return false;

  const valorContratado = obra?.valorContratado || 0;
  if (valorContratado <= 0) return false;

  const { totalCusto } = calcCustoObraForCharts(obra.id, gastos, diarias, dateRange, gastosEmpresa, funcionarios);
  return totalCusto > 0;
}

export function calcCustoObra(obraId, gastos, diarias, dateRange = {}, gastosEmpresa = [], funcionarios = []) {
  const { startDate, endDate } = dateRange;
  const obraGastos = filterItemsByDateRange(
    (gastos || []).filter((g) => g && g.obraId === obraId),
    startDate,
    endDate,
  );
  const obraDiarias = filterItemsByDateRange(
    filterDiariasDaObra(diarias, obraId),
    startDate,
    endDate,
  );

  const totalGastos =
    obraGastos.reduce((sum, g) => sum + getGastoCustoEmpresa(g), 0) +
    calcGastosEmpresaDaObra(obraId, gastosEmpresa, dateRange);
  const totalDiarias = obraDiarias.reduce(
    (sum, d) => sum + getDiariaCustoNaObra(d, obraId, funcionarios),
    0
  );

  return {
    totalGastos,
    totalDiarias,
    totalCusto: totalGastos + totalDiarias,
  };
}

export function calcRecebimentosObraFiltered(obraId, pagamentos, dateRange = {}) {
  const { startDate, endDate } = dateRange;
  const items = filterItemsByDateRange(
    (pagamentos || []).filter((p) => p && p.obraId === obraId && p.tipo === 'Recebimento de cliente'),
    startDate,
    endDate,
  );
  return items.reduce((sum, p) => sum + getValorRecebidoPagamento(p), 0);
}

export function calcCustosBreakdownObra(obraId, gastos, diarias, dateRange = {}, gastosEmpresa = []) {
  const { totalDiarias } = calcCustoObra(obraId, gastos, diarias, dateRange, gastosEmpresa);
  const { startDate, endDate } = dateRange;
  const obraGastos = filterItemsByDateRange(
    (gastos || []).filter((g) => g && g.obraId === obraId),
    startDate,
    endDate,
  );
  const empresaGastos = filterItemsByDateRange(
    getGastosEmpresaDaObra(obraId, gastosEmpresa),
    startDate,
    endDate,
  );

  const categorias = [...obraGastos, ...empresaGastos].reduce((acc, g) => {
    const cat = g.categoria || 'Outros';
    acc[cat] = (acc[cat] || 0) + (g.obraId ? getGastoCustoEmpresa(g) : getGastoValorAssinado(g));
    return acc;
  }, {});

  const breakdown = [];

  if (totalDiarias > 0) {
    breakdown.push({ name: 'Diárias', value: totalDiarias });
  }

  Object.entries(categorias).forEach(([name, value]) => {
    if (value) breakdown.push({ name, value });
  });

  return breakdown;
}

export function calcObraProfitMetrics(
  obra,
  gastos,
  pagamentos,
  diarias,
  dateRange = {},
  options = {}
) {
  if (!obra) {
    return {
      obraId: null,
      obraNome: '',
      obraEstado: '',
      valorContratado: 0,
      totalGastos: 0,
      totalDiarias: 0,
      totalCusto: 0,
      totalRecebido: 0,
      aReceber: 0,
      lucroContratual: 0,
      lucroRealizado: 0,
      margem: 0,
      eligibleForProfitChart: false,
      dadosParciais: false,
      hasFinancialData: false,
      custosBreakdown: {},
    };
  }
  const { dataInicioControle = null, gastosEmpresa = [], funcionarios = [], fechamentosPagamento = [] } = options;
  const empresaFin = calcObraEmpresaFinanceiro(obra, {
    gastos,
    diarias,
    pagamentos,
    gastosEmpresa,
    funcionarios,
    fechamentosPagamento,
  });
  const valorContratado = empresaFin.valorTotalObra ?? 0;
  const { totalGastos, totalDiarias, totalCusto } = calcCustoObra(
    obra.id,
    gastos,
    diarias,
    dateRange,
    gastosEmpresa,
    funcionarios
  );
  const totalRecebido = empresaFin.recebidoTotal ?? calcRecebimentosObraFiltered(obra.id, pagamentos, dateRange);
  const totalCustoEmerson = empresaFin.gastosEmerson ?? totalCusto;
  let lucroContratual = empresaFin.resultadoEmerson ?? valorContratado - totalCustoEmerson;
  let lucroRealizado = empresaFin.resultadoCaixaEmerson ?? totalRecebido - totalCustoEmerson;
  let eligibleForProfitChart = isObraEligibleForProfitChart(
    obra,
    gastos,
    pagamentos,
    diarias,
    dateRange,
    gastosEmpresa,
    funcionarios
  );

  if (isPartnershipObra(obra) && !empresaFin.divisaoInformada) {
    eligibleForProfitChart = false;
  }

  const margem = valorContratado > 0 ? (lucroContratual / valorContratado) * 100 : 0;
  const dadosParciais = isObraComDadosParciais(obra, gastos, diarias, dataInicioControle);
  const custosBreakdown = calcCustosBreakdownObra(obra.id, gastos, diarias, dateRange, gastosEmpresa);

  return {
    obraId: obra.id,
    obraNome: obra.nome,
    obraEstado: obra.estado,
    valorContratado,
    valorTotalObra: empresaFin.valorTotalObra,
    extrasTotal: empresaFin.extras?.total || 0,
    valorOriginal: empresaFin.valorOriginal,
    isPartnership: empresaFin.isPartnership,
    percentagemEmpresa: empresaFin.percentagemEmpresa,
    percentagemParceiro: empresaFin.percentagemParceiro,
    lucroReal: empresaFin.lucroReal,
    parteParceiro: empresaFin.parteParceiro,
    totalGastos,
    totalDiarias,
    totalCusto: totalCustoEmerson,
    totalRecebido,
    aReceber: empresaFin.aReceberTotal ?? Math.max(0, valorContratado - totalRecebido),
    lucroContratual,
    lucroRealizado,
    margem,
    eligibleForProfitChart,
    dadosParciais,
    hasFinancialData: eligibleForProfitChart,
    custosBreakdown,
  };
}

export function calcProfitSummary(
  obras,
  gastos,
  pagamentos,
  diarias,
  dateRange = {},
  options = {}
) {
  try {
  const metrics = (obras || [])
    .filter((obra) => obra && !isSpecialObra(obra))
    .map((obra) => calcObraProfitMetrics(obra, gastos, pagamentos, diarias, dateRange, options));
  const chartMetrics = metrics.filter((m) => m.eligibleForProfitChart && !m.dadosParciais);
  const partialMetrics = metrics.filter((m) => m.eligibleForProfitChart && m.dadosParciais);

  const totalContratado = chartMetrics.reduce((sum, m) => sum + m.valorContratado, 0);
  const totalRecebido = chartMetrics.reduce((sum, m) => sum + m.totalRecebido, 0);
  const totalCustos = chartMetrics.reduce((sum, m) => sum + m.totalCusto, 0);
  const lucroTotal = chartMetrics.reduce((sum, m) => sum + m.lucroContratual, 0);
  const lucroRealizadoTotal = chartMetrics.reduce((sum, m) => sum + m.lucroRealizado, 0);
  const margemMedia = totalContratado > 0 ? (lucroTotal / totalContratado) * 100 : 0;

  return {
    metrics,
    chartMetrics,
    partialMetrics,
    totalContratado,
    totalRecebido,
    totalCustos,
    lucroTotal,
    lucroRealizadoTotal,
    margemMedia,
  };
  } catch (err) {
    console.error('[lucros] Falha ao calcular o resumo de lucro', err);
    return {
      metrics: [],
      chartMetrics: [],
      partialMetrics: [],
      totalContratado: 0,
      totalRecebido: 0,
      totalCustos: 0,
      lucroTotal: 0,
      lucroRealizadoTotal: 0,
      margemMedia: 0,
    };
  }
}

export function calcSaldoObra(obra, gastos, pagamentos, diarias) {
  const totalGastos = calcGastosObra(obra.id, gastos) + calcDiariasObra(obra.id, diarias);
  const totalRecebido = calcRecebimentosObra(obra.id, pagamentos);
  return (obra.valorContratado || 0) - totalGastos - ((obra.valorContratado || 0) - totalRecebido);
}

export function calcTotalGastosMes(gastos, month, year) {
  return (gastos || [])
    .filter((g) => {
      if (!g || !hasValidChartDate(g) || !(g.valor > 0)) return false;
      const d = new Date(g.data);
      return d.getMonth() === month && d.getFullYear() === year;
    })
    .reduce((sum, g) => sum + (g.valor || 0), 0);
}

export function calcTotalRecebimentosMes(pagamentos, month, year, obras = []) {
  return (pagamentos || [])
    .filter((p) => {
      if (!p || p.tipo !== 'Recebimento de cliente') return false;
      const paymentDate = p.data || p.historicoPagamentos?.[p.historicoPagamentos.length - 1]?.data;
      if (!paymentDate) return false;
      const d = new Date(paymentDate);
      return d.getMonth() === month && d.getFullYear() === year;
    })
    .reduce((sum, p) => {
      if (p.historicoPagamentos?.length) {
        const bruto = p.historicoPagamentos
          .filter((entry) => {
            const d = new Date(entry.data);
            return d.getMonth() === month && d.getFullYear() === year;
          })
          .reduce((entrySum, entry) => entrySum + (entry.valor || 0), 0);
        const obra = (obras || []).find((item) => item && item.id === p.obraId) || null;
        return sum + applyEmpresaShare(obra, bruto);
      }
      return sum + applyEmpresaShareToPagamento(p, obras);
    }, 0);
}

export function calcTotalPagamentosMes(pagamentos, month, year) {
  return (pagamentos || [])
    .filter((p) => {
      if (!p || p.tipo === 'Recebimento de cliente') return false;
      if (p.tipo === 'Repasse de parceria') return false;
      if (!hasValidChartDate(p) || !(p.valor > 0)) return false;
      const d = new Date(p.data);
      return d.getMonth() === month && d.getFullYear() === year;
    })
    .reduce((sum, p) => sum + (p.valor || 0), 0);
}

import { isObraOperational } from './obraStatus';

export function calcTotalAReceber(obras, pagamentos) {
  try {
    return getOpenDebts(obras, pagamentos).reduce((sum, debt) => {
      const obra = (obras || []).find((item) => item && item.id === debt?.obraId) || null;
      return sum + applyEmpresaShare(obra, debt?.valorRestante || 0);
    }, 0);
  } catch (err) {
    console.error('[obras] Falha ao calcular valores a receber', err);
    return 0;
  }
}

export function calcValoresAcertoPendentes(valoresAcerto) {
  return (valoresAcerto || [])
    .filter((v) => v && v.estado !== 'Acertado' && !v.acerto)
    .reduce((sum, v) => {
      const entregue = v.valorEntregue ?? v.valor ?? 0;
      const utilizado = (v.gastos || []).reduce((s, g) => s + (g.valor || 0), 0);
      return sum + Math.max(0, entregue - utilizado);
    }, 0);
}

export function calcAdiantamentosPendentes(_adiantamentos, _pagamentos, _funcionarios, valoresAcerto = []) {
  return calcValoresAcertoPendentes(valoresAcerto);
}

export function getMonthlyData(items, months = 6) {
  const result = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = d.getMonth();
    const year = d.getFullYear();
    const label = d.toLocaleDateString('pt-PT', { month: 'short', year: '2-digit' });
    const total = (items || [])
      .filter((item) => {
        if (!hasValidChartDate(item)) return false;
        const date = new Date(item.data);
        return date.getMonth() === month && date.getFullYear() === year;
      })
      .reduce((sum, item) => sum + (item.valor || 0), 0);
    result.push({ label, total, month, year });
  }
  return result;
}

/** Prepara recebimentos de cliente para gráficos mensais. */
export function mapRecebimentosForChart(pagamentos, dateRange = {}, obras = []) {
  return (pagamentos || [])
    .filter((p) => isRecebimentoChartEligible(p, dateRange))
    .map((p) => ({
      data: getPagamentoChartDate(p),
      valor: applyEmpresaShareToPagamento(p, obras),
    }));
}

/** Prepara gastos para gráficos mensais. */
export function mapGastosForChart(gastos, dateRange = {}) {
  return (gastos || [])
    .filter((g) => isGastoChartEligible(g, dateRange))
    .map((g) => ({ data: g.data, valor: getGastoCustoEmpresa(g) }));
}

/** Prepara diárias para gráficos/totais temporais. */
export function mapDiariasForChart(diarias, dateRange = {}, funcionarios = []) {
  return (diarias || [])
    .filter((d) => isDiariaChartEligible(d, dateRange, funcionarios))
    .map((d) => ({ data: d.data, valor: calcDiariaValorPagavel(d, funcionarios) }));
}

export function getHistorico(data) {
  try {
    return buildHistorico(data);
  } catch (err) {
    console.error('[histórico] Falha ao montar o histórico', err);
    return [];
  }
}

function buildHistorico(data = {}) {
  const {
    obras,
    funcionarios,
    diarias,
    valoresAcerto = [],
    adiantamentos = [],
    emprestimos = [],
    gastos,
    pagamentos,
    gastosEmpresa = [],
    fechamentosPagamento,
    fechamentos,
    obraId = null,
  } = data;
  const fechamentosList = Array.isArray(fechamentosPagamento)
    ? fechamentosPagamento
    : Array.isArray(fechamentos)
      ? fechamentos
      : [];
  const events = [];

  (obras || []).filter(Boolean).forEach((o) => events.push({ id: o.id, tipo: 'Obra', descricao: `Obra criada: ${o.nome}`, data: o.createdAt, valor: o.valorContratado }));
  (obras || []).filter(Boolean).forEach((o) => {
    getObraExtras(o).forEach((extra) => {
      if (!extra) return;
      const recebido = extra.status === 'recebido';
      events.push({
        id: extra.id,
        tipo: recebido ? 'Recebimento de cliente' : 'Obra',
        descricao: recebido
          ? `Extra recebido — ${extra.descricao}`
          : `Extra (${getExtraStatusLabel(extra.status)}) — ${extra.descricao}`,
        data: extra.data || extra.recebidoAt || extra.cobradoAt || extra.createdAt,
        valor: extra.valor,
      });
    });
  });
  (diarias || []).forEach((d) => {
    if (!d) return;
    const func = (funcionarios || []).find((f) => f.id === d.funcionarioId);
    const valor = obraId
      ? getDiariaCustoNaObra(d, obraId, funcionarios)
      : calcDiariaValorPagavel(d, funcionarios);
    const obrasLabel = formatDiariaObrasLabel(d, (id) =>
      (obras || []).find((obra) => obra && obra.id === id)?.nome
    );
    events.push({
      id: d.id,
      tipo: 'Diária',
      descricao: valor
        ? `Diária — ${func?.nome || 'Funcionário'} (${obrasLabel})`
        : `Diária de presença — ${func?.nome || 'Parceiro'} (${obrasLabel})`,
      data: d.data || d.createdAt,
      valor,
    });
  });
  (valoresAcerto || []).forEach((v) => {
    if (!v) return;
    const func = (funcionarios || []).find((f) => f.id === v.funcionarioId);
    events.push({
      id: v.id,
      tipo: 'Valor para acerto',
      descricao: `${v.motivo} — ${func?.nome || 'Funcionário'}`,
      data: v.createdAt,
      valor: v.valorEntregue ?? v.valor,
    });
    if (v.acerto) {
      events.push({
        id: `${v.id}-acerto`,
        tipo: 'Acerto',
        descricao: `Acerto — ${v.motivo}`,
        data: v.acerto.createdAt || v.acerto.dataAcerto,
        valor: v.acerto.valorUtilizado,
      });
    }
  });
  (adiantamentos || []).forEach((a) => {
    if (!a) return;
    const func = (funcionarios || []).find((f) => f.id === a.funcionarioId);
    events.push({ id: a.id, tipo: 'Adiantamento', descricao: `Adiantamento — ${func?.nome || 'Funcionário'}`, data: a.createdAt, valor: a.valor });
  });
  (emprestimos || []).forEach((e) => {
    if (!e) return;
    const func = (funcionarios || []).find((f) => f.id === e.funcionarioId);
    events.push({ id: e.id, tipo: 'Empréstimo', descricao: `Empréstimo — ${func?.nome || 'Funcionário'}`, data: e.createdAt, valor: e.valor });
  });
  (gastos || []).forEach((g) => {
    if (!g) return;
    events.push({
      id: g.id,
      tipo: 'Gasto',
      descricao: getGastoHistoricoDescricao(g),
      data: g.createdAt,
      valor: g.valor,
    });
  });
  (gastosEmpresa || []).forEach((g) => {
    if (!g) return;
    events.push({
      id: g.id,
      tipo: 'Gasto da empresa',
      descricao: g.descricao || g.categoria || 'Gasto da empresa',
      data: g.createdAt || g.data,
      valor: getGastoEmpresaValor(g),
    });
  });
  (pagamentos || []).forEach((p) => {
    if (!p) return;
    if (p.tipo === 'Recebimento de cliente' && !isObraPagamentoRecebido(p)) return;
    const valor = p.tipo === 'Recebimento de cliente' ? getValorRecebidoPagamento(p) : p.valor;
    events.push({
      id: p.id,
      tipo: p.tipo,
      descricao: p.descricao,
      data: p.data || p.createdAt,
      valor,
    });
  });

  fechamentosList.forEach((f) => {
    if (!f) return;
    events.push({
      id: f.id,
      tipo: 'Fechamento de pagamento',
      descricao: f.referencia || `Pagamento — ${f.tipoPagamento}`,
      data: f.createdAt,
      valor: f.totalPago,
    });
  });

  return events.sort((a, b) => new Date(b.data) - new Date(a.data));
}

/** Classifica evento do histórico: entrada (dinheiro entrou), saida (dinheiro saiu), info (neutro). */
export function getHistoricoDirecao(tipo) {
  if (tipo === 'Obra') return 'info';
  if (tipo === 'Recebimento de cliente') return 'entrada';
  if (tipo === 'Repasse de parceria') return 'saida';
  return 'saida';
}

/** Resumo financeiro da obra para o histórico (sem alterar dados). */
export function calcResumoFinanceiroObra(obra, totalRecebido, totalGasto) {
  const extras = summarizeObraExtras(obra);
  const valorContratado = obra?.valorContratado || 0;
  const recebidoPagamentos = totalRecebido || 0;
  const parceria = obra?.tipoObra === 'parceria' || obra?.partnership?.enabled === true;
  const valorAtualizado = roundMoney(valorContratado + extras.total);
  const recebido = parceria
    ? roundMoney(recebidoPagamentos + extras.recebido)
    : roundMoney(recebidoPagamentos);
  const gasto = totalGasto || 0;
  return {
    valorContratado,
    totalExtras: extras.total,
    valorAtualizado,
    totalRecebido: recebido,
    totalGasto: gasto,
    saldoFinanceiro: roundMoney(recebido - gasto),
    aindaAReceber: parceria
      ? roundMoney(Math.max(0, valorContratado - recebidoPagamentos) + extras.aCobrar)
      : roundMoney(Math.max(0, valorAtualizado - recebidoPagamentos)),
  };
}
