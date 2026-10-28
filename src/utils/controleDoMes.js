import { formatCurrency, formatDate, getTodayISO } from './formatters';
import { roundMoney } from './ivaCalculations';
import { getGastoEmpresaValor, getGastoEmpresaEstadoLabel } from './gastoEmpresaCalculations';
import {
  addMonthsToYearMonth,
  getYearMonth,
  isGastoVariavelLancamento,
} from './empresaFinanceiroCalculations';
import {
  buildAgendaProgramadas,
  ESTADO_AGENDA,
  formatMesAgenda,
  isProgramadaNaAgenda,
} from './despesasProgramadasAgenda';
import {
  getDiariasPendentes,
} from './fechamentoPagamentoCalculations';
import { calcDiariaValorPagavel, isParceiroFuncionario } from './funcionarioTipo';
import {
  getFechamentoPeriodoLabel,
} from './pagamentoPeriodCalculations';
import { asRecordList } from './safeCollections';

function mesDoGasto(gasto) {
  return (
    gasto?.mesReferencia ||
    String(gasto?.dataPagamento || gasto?.data || '').slice(0, 7) ||
    ''
  );
}

function gastoNoMes(gasto, yearMonth) {
  if (!gasto || !yearMonth) return false;
  if (gasto.estado === 'previsto') return false;
  return mesDoGasto(gasto) === yearMonth || String(gasto.data || '').slice(0, 7) === yearMonth;
}

function fechamentoNoMes(fechamento, yearMonth) {
  if (!fechamento || !yearMonth) return false;
  if (fechamento.referenciaMes && String(fechamento.referenciaMes).slice(0, 7) === yearMonth) {
    return true;
  }
  const data = String(fechamento.data || '').slice(0, 10);
  return data.startsWith(yearMonth);
}

/**
 * Vista operacional do mês: o que já saiu da conta vs o que ainda falta confirmar.
 * Não cria lançamentos — só lê programadas, gastos e fechamentos existentes.
 *
 * BUG CORRIGIDO (Error Boundary em Gastos da Empresa):
 * TypeError: f.pendentes is not iterable
 * Causa: código antigo fazia [...agenda.atrasadas, ...agenda.pendentes, ...agenda.pagas]
 * mas buildAgendaProgramadas() NÃO devolve "pendentes" nem "pagas" (são undefined).
 * Spread de undefined → crash no useMemo de GastosEmpresa.jsx → Error Boundary.
 * Corrigido aqui: usar desteMes / semData / atrasadas / pagasDoMes (API real da agenda).
 */
export function buildControleDoMes({
  yearMonth,
  programadas = [],
  gastos = [],
  veiculos = [],
  funcionarios = [],
  diarias = [],
  fechamentosPagamento = [],
  today = getTodayISO(),
} = {}) {
  const mes = yearMonth || getYearMonth(today);
  const agenda = buildAgendaProgramadas(programadas, {
    gastos,
    veiculos,
    yearMonth: mes,
    today,
  }) || {};

  // API real de buildAgendaProgramadas: desteMes, semData, atrasadas, pagasDoMes, proximas.
  // NÃO usar agenda.pendentes / agenda.pagas (não existem → TypeError ao fazer spread).
  const itensAgendaMes = [];
  const vistosAgenda = new Set();
  for (const lista of [agenda.desteMes, agenda.semData, agenda.atrasadas, agenda.pagasDoMes]) {
    if (!Array.isArray(lista)) continue;
    for (const item of lista) {
      if (!item?.id || vistosAgenda.has(item.id)) continue;
      vistosAgenda.add(item.id);
      itensAgendaMes.push(item);
    }
  }

  const recorrentes = itensAgendaMes
    .filter((item) => item && isProgramadaNaAgenda(item.programada))
    .map((item) => {
      const descontado = Boolean(item.pago);
      const dataDesconto = item.dataPagamento || '';
      const estadoId = item.estado?.id || '';
      return {
        id: item.id,
        programadaId: item.programada?.id,
        programada: item.programada,
        mesOcorrencia: item.mesOcorrencia || mes,
        nome: item.titulo || item.programada?.titulo || 'Despesa',
        valorHabitual: Number(item.valorRecorrente) || Number(item.programada?.valor) || 0,
        valorPago: descontado ? Number(item.valor) || 0 : null,
        status: descontado ? 'descontado' : estadoId === 'atrasado' ? 'atrasado' : 'pendente',
        statusLabel: descontado
          ? 'Descontado neste mês'
          : estadoId === 'atrasado'
            ? 'Atrasado'
            : 'Pendente neste mês',
        dataDesconto,
        dataDescontoLabel: descontado
          ? dataDesconto
            ? `Descontado este mês em ${formatDate(dataDesconto)}`
            : 'Descontado neste mês'
          : '',
        dataVencimento: item.dataVencimento || '',
        indicador: item.indicador || '',
      };
    })
    .sort((a, b) => {
      const rank = { atrasado: 0, pendente: 1, descontado: 2 };
      return (rank[a.status] ?? 9) - (rank[b.status] ?? 9) || String(a.nome).localeCompare(String(b.nome), 'pt');
    });

  const funcionariosNormais = asRecordList(funcionarios).filter(
    (func) => func && func.estado !== 'Inativo' && !isParceiroFuncionario(func)
  );

  const fechamentosMes = asRecordList(fechamentosPagamento)
    .filter((item) => fechamentoNoMes(item, mes))
    .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));

  const pagamentosFuncionarios = [];
  const vistos = new Set();

  fechamentosMes.forEach((fechamento) => {
    const key = fechamento.id || `${fechamento.funcionarioId}:${fechamento.data}`;
    vistos.add(fechamento.funcionarioId);
    pagamentosFuncionarios.push({
      id: key,
      funcionarioId: fechamento.funcionarioId,
      nome: fechamento.funcionarioNome || 'Funcionário',
      valor: Number(fechamento.totalPago) || 0,
      periodo: getFechamentoPeriodoLabel(fechamento),
      status: 'pago',
      statusLabel: 'Pago',
      dataPagamento: fechamento.data || '',
      diariasPendentes: 0,
      valorPendentes: 0,
      fechamento,
    });
  });

  funcionariosNormais.forEach((func) => {
    const pendentesTodas = getDiariasPendentes(func.id, diarias, fechamentosPagamento, funcionarios);
    const mesActual = getYearMonth(today);
    const pendentes =
      mes === mesActual
        ? pendentesTodas
        : pendentesTodas.filter((diaria) => String(diaria.data || '').startsWith(mes));
    const valorPendentes = roundMoney(
      pendentes.reduce((sum, diaria) => sum + calcDiariaValorPagavel(diaria, funcionarios), 0)
    );
    const jaListadoPago = vistos.has(func.id);

    if (pendentes.length === 0 || valorPendentes <= 0.004) return;
    if (jaListadoPago && valorPendentes <= 0.004) return;

    pagamentosFuncionarios.push({
      id: `pendente:${func.id}`,
      funcionarioId: func.id,
      nome: func.nome,
      valor: valorPendentes,
      periodo:
        mes === mesActual
          ? `${pendentes.length} diária${pendentes.length === 1 ? '' : 's'} por pagar`
          : `Diárias de ${formatMesAgenda(mes)}`,
      status: 'pendente',
      statusLabel: 'Pendente',
      dataPagamento: '',
      diariasPendentes: pendentes.reduce((sum, d) => sum + (Number(d.quantidade) || 0), 0),
      valorPendentes,
      fechamento: null,
    });
  });

  pagamentosFuncionarios.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'pendente' ? -1 : 1;
    return a.nome.localeCompare(b.nome, 'pt');
  });

  const outros = asRecordList(gastos)
    .filter((gasto) => isGastoVariavelLancamento(gasto) && gastoNoMes(gasto, mes))
    .map((gasto) => ({
      id: gasto.id,
      descricao: gasto.descricao || gasto.categoria || 'Gasto',
      data: gasto.dataPagamento || gasto.data || '',
      valor: getGastoEmpresaValor(gasto),
      categoria: gasto.categoria || '—',
      estado: gasto.estado || 'pendente',
      estadoLabel: getGastoEmpresaEstadoLabel(gasto),
      gasto,
    }))
    .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));

  const recorrentesPendentes = recorrentes.filter((item) => item.status !== 'descontado');
  const recorrentesDescontados = recorrentes.filter((item) => item.status === 'descontado');
  const funcionariosPendentes = pagamentosFuncionarios.filter((item) => item.status === 'pendente');
  const funcionariosPagos = pagamentosFuncionarios.filter((item) => item.status === 'pago');

  const totalRecorrentePendente = roundMoney(
    recorrentesPendentes.reduce((sum, item) => sum + (Number(item.valorHabitual) || 0), 0)
  );
  const totalRecorrenteDescontado = roundMoney(
    recorrentesDescontados.reduce((sum, item) => sum + (Number(item.valorPago) || 0), 0)
  );
  const totalFuncionariosPago = roundMoney(
    funcionariosPagos.reduce((sum, item) => sum + (Number(item.valor) || 0), 0)
  );
  const totalFuncionariosPendente = roundMoney(
    funcionariosPendentes.reduce((sum, item) => sum + (Number(item.valorPendentes || item.valor) || 0), 0)
  );
  const totalOutrosPagos = roundMoney(
    outros.filter((item) => item.estado === 'pago').reduce((sum, item) => sum + (Number(item.valor) || 0), 0)
  );

  return {
    yearMonth: mes,
    mesLabel: formatMesAgenda(mes),
    recorrentes,
    pagamentosFuncionarios,
    outros,
    resumo: {
      recorrentesPendentes: recorrentesPendentes.length,
      recorrentesDescontados: recorrentesDescontados.length,
      totalRecorrentePendente,
      totalRecorrenteDescontado,
      funcionariosPendentes: funcionariosPendentes.length,
      funcionariosPagos: funcionariosPagos.length,
      totalFuncionariosPendente,
      totalFuncionariosPago,
      outrosCount: outros.length,
      totalOutrosPagos,
      aindaFaltaConfirmar: recorrentesPendentes.length + funcionariosPendentes.length,
    },
  };
}

export function formatControleValor(value) {
  return formatCurrency(value || 0);
}

export { ESTADO_AGENDA, addMonthsToYearMonth };
