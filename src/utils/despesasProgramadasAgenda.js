import { getGastoEmpresaValor } from './gastoEmpresaCalculations';
import { getTodayISO } from './formatters';
import { roundMoney } from './ivaCalculations';
import {
  addMonthsToYearMonth,
  countPagamentosProgramada,
  DESPESA_NATUREZA,
  DESPESA_PERIODICIDADE,
  formatTituloHomeFixo,
  formatTituloProximoPagamento,
  formatValorRecorrenteLabel,
  getGastosDaProgramada,
  getPeriodoCoberto,
  getPeriodicidadeMeses,
  getSeguroFim,
  getYearMonth,
  isCoberturaLonga,
  isRecorrenciaConfirmada,
  isSalarioPagoPorDiaria,
} from './empresaFinanceiroCalculations';

export const ESTADO_AGENDA = {
  PAGO: { id: 'pago', label: 'Descontado neste mês' },
  COBERTO: { id: 'coberto', label: 'Pago / Coberto' },
  RENOVACAO: { id: 'renovacao', label: 'Vence em breve' },
  PENDENTE: { id: 'pendente', label: 'Pendente neste mês' },
  ATRASADO: { id: 'atrasado', label: 'Atrasado' },
};

const MESES_PT = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

function utcDate(iso) {
  const [year, month, day] = String(iso || '').slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return null;
  return Date.UTC(year, month - 1, day);
}

export function diffDiasISO(deISO, paraISO) {
  const de = utcDate(deISO);
  const para = utcDate(paraISO);
  if (de == null || para == null) return null;
  return Math.round((para - de) / 86400000);
}

export function formatMesAgenda(yearMonth) {
  if (!yearMonth) return '';
  const [year, month] = String(yearMonth).split('-').map(Number);
  const nome = MESES_PT[month - 1];
  if (!nome || !year) return String(yearMonth);
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} ${year}`;
}

export function formatIndicadorVencimento(dataISO, today = getTodayISO()) {
  if (!dataISO) return '';
  const dias = diffDiasISO(today, dataISO);
  if (dias == null) return '';
  if (dias === 0) return 'Vence hoje';
  if (dias === 1) return 'Vence amanhã';
  if (dias > 1) return `Vence em ${dias} dias`;
  if (dias === -1) return 'Venceu ontem';
  return `${Math.abs(dias)} dias em atraso`;
}

function isMensalRecorrente(programada) {
  return (
    programada?.periodicidade === DESPESA_PERIODICIDADE.MENSAL ||
    programada?.periodicidade === DESPESA_PERIODICIDADE.PARCELAS
  );
}

export function isProgramadaNaAgenda(programada) {
  if (!programada || programada.ativo === false) return false;
  if (isSalarioPagoPorDiaria(programada)) return false;
  if (programada.natureza === DESPESA_NATUREZA.VARIAVEL) return false;
  if (programada.natureza === DESPESA_NATUREZA.RECUPERAR) return false;
  return true;
}

function diaConhecido(diaVencimento) {
  const dayNum = Number(diaVencimento);
  return Number.isFinite(dayNum) && dayNum >= 1 ? dayNum : null;
}

function dataVencimentoNoMes(yearMonth, diaVencimento) {
  const dia = diaConhecido(diaVencimento);
  if (!yearMonth || !dia) return '';
  const [year, month] = String(yearMonth).split('-').map(Number);
  if (!year || !month) return '';
  const last = new Date(year, month, 0).getDate();
  return `${yearMonth}-${String(Math.min(dia, last)).padStart(2, '0')}`;
}

function getPagamentoNoMes(gastos, programadaId, yearMonth) {
  return (
    getGastosDaProgramada(gastos, programadaId).find((gasto) => {
      if (gasto.estado !== 'pago') return false;
      const mes = gasto.mesReferencia || String(gasto.dataPagamento || gasto.data || '').slice(0, 7);
      return mes === yearMonth;
    }) || null
  );
}

function dataRenovacaoConhecida(programada, gastos, today) {
  const pagas = getGastosDaProgramada(gastos, programada.id).filter((gasto) => gasto.estado === 'pago');
  if (pagas.length > 0) {
    const cobertura = getPeriodoCoberto(programada, { gastos, today });
    if (cobertura?.fim) return String(cobertura.fim).slice(0, 10);
  }
  return getSeguroFim(programada) || '';
}

function mesDeRenovacao(programada, gastos, today) {
  const data = dataRenovacaoConhecida(programada, gastos, today);
  if (data && data.length >= 7) return getYearMonth(data);
  if (programada.ultimaOcorrenciaMes) {
    const meses = Number(programada.duracaoMeses) || getPeriodicidadeMeses(programada.periodicidade) || 0;
    if (meses) return addMonthsToYearMonth(programada.ultimaOcorrenciaMes, meses);
  }
  if (programada.previsaoMes) return programada.previsaoMes;
  return '';
}

function tituloAgenda(programada, veiculos) {
  if (programada.natureza === DESPESA_NATUREZA.SEGURO) {
    if (/acidente/i.test(`${programada.titulo || ''} ${programada.categoria || ''}`)) {
      return 'Seguro de acidentes';
    }
    const base = formatTituloHomeFixo(programada, veiculos);
    return /seguro/i.test(base) ? base : `Seguro ${base}`;
  }
  return formatTituloProximoPagamento(programada, veiculos) || formatTituloHomeFixo(programada, veiculos);
}

function estadoAgenda({ pago, dataVencimento, today }) {
  if (pago) return ESTADO_AGENDA.PAGO;
  if (dataVencimento && dataVencimento < today) return ESTADO_AGENDA.ATRASADO;
  return ESTADO_AGENDA.PENDENTE;
}

function buildItem(programada, veiculos, {
  yearMonth,
  pago,
  pagamento,
  dataVencimento,
  today,
  incluirEmAPagar = true,
  estado: estadoOverride = null,
  proximaRenovacao = false,
}) {
  const estado = estadoOverride || estadoAgenda({ pago, dataVencimento, today });
  const valorPago = pagamento ? getGastoEmpresaValor(pagamento) : null;
  return {
    id: `${programada.id}:${yearMonth}`,
    programada,
    mesOcorrencia: yearMonth,
    titulo: tituloAgenda(programada, veiculos),
    valor: pago && valorPago != null ? valorPago : Number(programada.valor) || 0,
    valorRecorrente: Number(programada.valor) || 0,
    valorLabel: formatValorRecorrenteLabel(programada),
    dataVencimento: dataVencimento || '',
    dataPagamento: pagamento?.dataPagamento || pagamento?.data || '',
    indicador: formatIndicadorVencimento(dataVencimento, today),
    estado,
    pago,
    incluirEmAPagar: incluirEmAPagar && !pago,
    semData: !pago && !dataVencimento,
    proximaRenovacao,
  };
}

function ocorrenciaMensal(programada, yearMonth, { gastos, veiculos, today }) {
  if (
    programada.periodicidade === DESPESA_PERIODICIDADE.PARCELAS &&
    Number.isFinite(Number(programada.parcelasRestantes)) &&
    Number(programada.parcelasRestantes) <= 0 &&
    countPagamentosProgramada(gastos, programada.id, yearMonth) === 0
  ) {
    return null;
  }
  const pagamento = getPagamentoNoMes(gastos, programada.id, yearMonth);
  const pago = Boolean(pagamento);
  return buildItem(programada, veiculos, {
    yearMonth,
    pago,
    pagamento,
    dataVencimento: dataVencimentoNoMes(yearMonth, programada.diaVencimento),
    today,
  });
}

function ocorrenciaUnica(programada, yearMonth, { gastos, veiculos, today }) {
  const pagamento = getPagamentoNoMes(gastos, programada.id, yearMonth);
  const pagoNesteMes = Boolean(pagamento);
  const jaPagoNoutroMes = !pagoNesteMes && countPagamentosProgramada(gastos, programada.id) > 0;
  if (jaPagoNoutroMes) return null;
  if (programada.previsaoMes && programada.previsaoMes !== yearMonth && !pagoNesteMes) return null;
  if (!programada.previsaoMes && !pagoNesteMes) {
    if (yearMonth !== getYearMonth(today)) return null;
    return {
      ...buildItem(programada, veiculos, {
        yearMonth,
        pago: false,
        pagamento: null,
        dataVencimento: '',
        today,
        incluirEmAPagar: false,
      }),
      reminder: true,
    };
  }
  return buildItem(programada, veiculos, {
    yearMonth,
    pago: pagoNesteMes,
    pagamento,
    dataVencimento: '',
    today,
  });
}

function ocorrenciaCobertura(programada, yearMonth, { gastos, veiculos, today }) {
  const pagamento = getPagamentoNoMes(gastos, programada.id, yearMonth);
  if (pagamento) {
    return buildItem(programada, veiculos, {
      yearMonth,
      pago: true,
      pagamento,
      dataVencimento: '',
      today,
    });
  }

  if (!isRecorrenciaConfirmada(programada)) return null;

  const cobertura = getPeriodoCoberto(programada, { gastos, today });
  const renovacaoMes = mesDeRenovacao(programada, gastos, today);
  const dataRenovacao = dataRenovacaoConhecida(programada, gastos, today);
  const dataNoMes =
    dataRenovacao && getYearMonth(dataRenovacao) === yearMonth ? dataRenovacao : '';

  if (!renovacaoMes) return null;
  if (yearMonth !== renovacaoMes) return null;

  return buildItem(programada, veiculos, {
    yearMonth,
    pago: false,
    pagamento: null,
    dataVencimento: dataNoMes,
    today,
    incluirEmAPagar: true,
    estado: estadoAgenda({ pago: false, dataVencimento: dataNoMes, today }),
  });
}

export function ocorrenciaAgendaNoMes(programada, yearMonth, ctx) {
  if (!isProgramadaNaAgenda(programada) || !yearMonth) return null;
  if (isMensalRecorrente(programada)) return ocorrenciaMensal(programada, yearMonth, ctx);
  if (programada.periodicidade === DESPESA_PERIODICIDADE.UNICA) {
    return ocorrenciaUnica(programada, yearMonth, ctx);
  }
  if (isCoberturaLonga(programada)) return ocorrenciaCobertura(programada, yearMonth, ctx);
  return ocorrenciaMensal(programada, yearMonth, ctx);
}

function sortPorPrioridade(a, b) {
  const rank = (item) => {
    if (item.estado?.id === 'atrasado') return 0;
    if (item.indicador === 'Vence hoje') return 1;
    if (item.indicador === 'Vence amanhã') return 2;
    if (item.dataVencimento) return 3;
    if (!item.pago) return 4;
    return 5;
  };
  const ra = rank(a);
  const rb = rank(b);
  if (ra !== rb) return ra - rb;
  const da = a.dataVencimento || '9999-12-31';
  const db = b.dataVencimento || '9999-12-31';
  if (da !== db) return da.localeCompare(db);
  return String(a.titulo).localeCompare(String(b.titulo), 'pt');
}

function pagamentosProgramados(gastos = [], programadas = []) {
  const ids = new Set((programadas || []).filter(isProgramadaNaAgenda).map((item) => item.id));
  return (gastos || []).filter(
    (gasto) => gasto.estado === 'pago' && gasto.despesaProgramadaId && ids.has(gasto.despesaProgramadaId)
  );
}

export function buildAgendaProgramadas(
  programadas = [],
  { gastos = [], veiculos = [], yearMonth = getYearMonth(), today = getTodayISO() } = {}
) {
  const visiveis = (programadas || []).filter(isProgramadaNaAgenda);
  const ctx = { gastos, veiculos, today };
  const desteMes = visiveis.map((item) => ocorrenciaAgendaNoMes(item, yearMonth, ctx)).filter(Boolean);

  const atrasadas = desteMes.filter((item) => item.estado?.id === 'atrasado').sort(sortPorPrioridade);
  const comDataPendentes = desteMes
    .filter((item) => !item.pago && item.dataVencimento && item.estado?.id !== 'atrasado')
    .sort(sortPorPrioridade);
  const semData = desteMes.filter((item) => item.semData).sort(sortPorPrioridade);
  const desteMesLista = desteMes
    .filter((item) => item.dataVencimento || item.pago)
    .sort((a, b) => {
      const da = a.dataVencimento || a.dataPagamento || '9999-12-31';
      const db = b.dataVencimento || b.dataPagamento || '9999-12-31';
      if (da !== db) return da.localeCompare(db);
      return String(a.titulo).localeCompare(String(b.titulo), 'pt');
    });
  const pagasDoMes = desteMes.filter((item) => item.pago).sort((a, b) =>
    String(b.dataPagamento || '').localeCompare(String(a.dataPagamento || ''))
  );

  const mesAtual = getYearMonth(today);
  let proximas = comDataPendentes;
  if (yearMonth === mesAtual) {
    const extra = [];
    [addMonthsToYearMonth(yearMonth, 1)].forEach((mes) => {
      visiveis.forEach((programada) => {
        const item = ocorrenciaAgendaNoMes(programada, mes, ctx);
        if (!item || item.pago || !item.dataVencimento) return;
        if (item.estado?.id === 'atrasado') return;
        extra.push(item);
      });
    });
    proximas = [...comDataPendentes, ...extra].sort(sortPorPrioridade);
  }

  const aPagar = roundMoney(
    desteMes.filter((item) => item.incluirEmAPagar).reduce((sum, item) => sum + (Number(item.valorRecorrente) || 0), 0)
  );
  const emAtraso = roundMoney(
    atrasadas.reduce((sum, item) => sum + (Number(item.valorRecorrente) || 0), 0)
  );

  const pagamentosMes = pagamentosProgramados(gastos, visiveis).filter((gasto) => {
    const mes = getYearMonth(gasto.dataPagamento || gasto.data || '');
    return mes === yearMonth;
  });
  const jaPago = roundMoney(pagamentosMes.reduce((sum, gasto) => sum + getGastoEmpresaValor(gasto), 0));

  const pagasRecentemente = pagamentosProgramados(gastos, visiveis)
    .slice()
    .sort((a, b) =>
      String(b.dataPagamento || b.data || '').localeCompare(String(a.dataPagamento || a.data || ''))
    )
    .slice(0, 8)
    .map((gasto) => {
      const programada = visiveis.find((item) => item.id === gasto.despesaProgramadaId);
      return {
        id: gasto.id,
        programada,
        titulo: programada ? tituloAgenda(programada, veiculos) : gasto.descricao,
        valor: getGastoEmpresaValor(gasto),
        dataPagamento: gasto.dataPagamento || gasto.data || '',
        estado: ESTADO_AGENDA.PAGO,
      };
    })
    .filter((item) => item.programada);

  return {
    yearMonth,
    atrasadas,
    proximas,
    desteMes: desteMesLista,
    semData,
    pagasDoMes,
    pagasRecentemente,
    resumo: {
      aPagar,
      jaPago,
      emAtraso,
    },
  };
}
