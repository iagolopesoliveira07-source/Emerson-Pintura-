import { generateId } from '../services/storageService';
import { formatCurrency, getTodayISO } from './formatters';
import { roundMoney } from './ivaCalculations';
import { addDaysToDate, addPeriodoToDate, getGastoEmpresaValor, isGastoEmpresaApagado } from './gastoEmpresaCalculations';
import {
  CATEGORIA_COMBUSTIVEL,
  CATEGORIA_MANUTENCAO,
  CATEGORIA_VIA_VERDE,
  DESPESA_NATUREZA,
  DESPESA_NATUREZA_LABELS,
  DESPESA_PERIODICIDADE,
  DESPESA_PERIODICIDADE_LABELS,
  PROGRAMADA_GRUPOS_VISIVEIS,
  RESUMO_DESPESA_GRUPOS,
  VALOR_RECUPERAR_STATUS,
  VIA_VERDE_STATUS,
  VIA_VERDE_STATUS_LABELS,
} from '../constants/empresaFinanceiro';

export {
  CATEGORIA_COMBUSTIVEL,
  CATEGORIA_MANUTENCAO,
  CATEGORIA_VIA_VERDE,
  DESPESA_NATUREZA,
  DESPESA_NATUREZA_LABELS,
  DESPESA_PERIODICIDADE,
  DESPESA_PERIODICIDADE_LABELS,
  PROGRAMADA_GRUPOS_VISIVEIS,
  RESUMO_DESPESA_GRUPOS,
  VALOR_RECUPERAR_STATUS,
  VIA_VERDE_STATUS,
  VIA_VERDE_STATUS_LABELS,
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

export function getYearMonth(iso = getTodayISO()) {
  return String(iso || getTodayISO()).slice(0, 7);
}

export function formatYearMonth(yearMonth) {
  if (!yearMonth) return '—';
  const [year, month] = String(yearMonth).split('-').map(Number);
  if (!year || !month) return yearMonth;
  return `${MESES_PT[month - 1]} de ${year}`;
}

export function addMonthsToYearMonth(yearMonth, months) {
  const [year, month] = String(yearMonth).split('-').map(Number);
  if (!year || !month) return '';
  const total = year * 12 + (month - 1) + months;
  const nextYear = Math.floor(total / 12);
  const nextMonth = (total % 12) + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
}

export function addMonthsToDate(isoDate, months) {
  if (!isoDate) return '';
  if (String(isoDate).length === 7) {
    const ym = addMonthsToYearMonth(isoDate, months);
    return ym ? `${ym}-01` : '';
  }
  const periodicidade =
    months === 1 ? 'mensal' : months === 3 ? 'trimestral' : months === 6 ? 'semestral' : months === 12 ? 'anual' : null;
  if (periodicidade) return addPeriodoToDate(isoDate, periodicidade);

  const [year, month, day] = String(isoDate).slice(0, 10).split('-').map(Number);
  const total = year * 12 + (month - 1) + months;
  const nextYear = Math.floor(total / 12);
  const nextMonthIndex = total % 12;
  const lastDay = new Date(nextYear, nextMonthIndex + 1, 0).getDate();
  const nextDay = Math.min(day, lastDay);
  return `${nextYear}-${String(nextMonthIndex + 1).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`;
}

export function createVeiculo({
  id,
  seedKey = null,
  nome,
  propriedadeEmpresa = true,
  notas = '',
  ativo = true,
  modelo = '',
  combustivel = null,
  ivaDedutivelPercent = null,
  regraFiscal = null,
  observacaoFiscal = '',
  createdAt = null,
} = {}) {
  return {
    id: id || generateId(),
    seedKey,
    nome: String(nome || '').trim(),
    propriedadeEmpresa: propriedadeEmpresa !== false,
    notas: String(notas || '').trim(),
    ativo: ativo !== false,
    modelo: String(modelo || '').trim(),
    combustivel: combustivel || null,
    ivaDedutivelPercent:
      ivaDedutivelPercent == null || ivaDedutivelPercent === '' ? null : Number(ivaDedutivelPercent),
    regraFiscal: regraFiscal || null,
    observacaoFiscal: String(observacaoFiscal || '').trim(),
    createdAt: createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function isRecorrenciaConfirmada(programada) {
  if (!programada) return false;
  if (programada.recorrenciaConfirmada === false) return false;
  if (programada.recorrenciaConfirmada === true) return true;
  return programada.periodicidade !== DESPESA_PERIODICIDADE.UNICA;
}

export function createDespesaProgramada(input = {}) {
  const periodicidade = input.periodicidade || DESPESA_PERIODICIDADE.MENSAL;
  const recorrenciaConfirmada =
    input.recorrenciaConfirmada === false
      ? false
      : input.recorrenciaConfirmada === true
        ? true
        : periodicidade !== DESPESA_PERIODICIDADE.UNICA;

  return {
    id: input.id || generateId(),
    seedKey: input.seedKey || null,
    titulo: String(input.titulo || '').trim(),
    natureza: input.natureza || DESPESA_NATUREZA.OUTRO,
    categoria: input.categoria || '',
    valor: roundMoney(input.valor),
    periodicidade,
    recorrenciaConfirmada,
    diaVencimento: input.diaVencimento != null && input.diaVencimento !== '' ? Number(input.diaVencimento) : null,
    dataInicio: input.dataInicio || null,
    dataFim: input.dataFim || null,
    duracaoMeses: input.duracaoMeses != null && input.duracaoMeses !== '' ? Number(input.duracaoMeses) : null,
    previsaoMes: input.previsaoMes || null,
    ultimaOcorrenciaMes: input.ultimaOcorrenciaMes || null,
    parcelasRestantes:
      input.parcelasRestantes != null && input.parcelasRestantes !== '' ? Number(input.parcelasRestantes) : null,
    ivaDeduzido: input.ivaDeduzido === true,
    veiculoId: input.veiculoId || null,
    funcionarioNome: input.funcionarioNome || '',
    observacao: String(input.observacao || '').trim(),
    ativo: input.ativo !== false,
    createdAt: input.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function createValorRecuperar(input = {}) {
  return {
    id: input.id || generateId(),
    seedKey: input.seedKey || null,
    descricao: String(input.descricao || '').trim(),
    valor: roundMoney(input.valor),
    previsaoMes: input.previsaoMes || null,
    veiculoId: input.veiculoId || null,
    status: input.status || VALOR_RECUPERAR_STATUS.PENDENTE,
    dataRecebido: input.dataRecebido || null,
    observacao: String(input.observacao || '').trim(),
    createdAt: input.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function getVeiculoById(veiculos = [], id) {
  if (!id) return null;
  return (veiculos || []).find((item) => item.id === id) || null;
}

export function isCategoriaViaVerde(categoria) {
  const nome = String(categoria || '').toLowerCase();
  return nome.includes('via verde') || nome.includes('portagen');
}

export function isCategoriaCombustivel(categoria) {
  return String(categoria || '').toLowerCase().includes('combust');
}

export function isCategoriaCarregamento(categoria) {
  const nome = String(categoria || '').toLowerCase();
  return nome.includes('carregamento');
}

export function isCategoriaManutencao(categoria) {
  return String(categoria || '').toLowerCase().includes('manuten');
}

export function getViaVerdeStatus(gasto) {
  if (!isCategoriaViaVerde(gasto?.categoria)) return null;
  if (gasto?.viaVerde?.distribuicaoStatus) return gasto.viaVerde.distribuicaoStatus;
  if (gasto?.veiculoId || String(gasto?.veiculo || '').trim()) return null;
  return VIA_VERDE_STATUS.POR_CONFERIR;
}

export function getViaVerdeDistribuicao(gasto) {
  return Array.isArray(gasto?.viaVerde?.distribuicao) ? gasto.viaVerde.distribuicao : [];
}

export function getViaVerdeDistribuido(gasto) {
  return roundMoney(
    getViaVerdeDistribuicao(gasto).reduce((sum, linha) => sum + (Number(linha.valor) || 0), 0)
  );
}

export function getViaVerdeDiferenca(gasto) {
  return roundMoney(getGastoEmpresaValor(gasto) - getViaVerdeDistribuido(gasto));
}

export function isGastoDoVeiculo(gasto, veiculo) {
  if (!gasto || !veiculo) return false;
  if (gasto.veiculoId && gasto.veiculoId === veiculo.id) return true;
  const nome = String(veiculo.nome || '').trim().toLowerCase();
  if (nome && String(gasto.veiculo || '').trim().toLowerCase() === nome) return true;
  return getViaVerdeDistribuicao(gasto).some((linha) => linha.veiculoId === veiculo.id);
}

export function getValorGastoNoVeiculo(gasto, veiculo) {
  if (!isGastoDoVeiculo(gasto, veiculo)) return 0;
  const linha = getViaVerdeDistribuicao(gasto).find((item) => item.veiculoId === veiculo.id);
  if (linha) return roundMoney(Number(linha.valor) || 0);
  return getGastoEmpresaValor(gasto);
}

export function getGastosDoVeiculo(gastos = [], veiculo) {
  if (!veiculo) return [];
  return (gastos || []).filter((gasto) => !isGastoEmpresaApagado(gasto) && isGastoDoVeiculo(gasto, veiculo));
}

export function summarizeViaVerde(gasto) {
  const debito = getGastoEmpresaValor(gasto);
  const distribuido = getViaVerdeDistribuido(gasto);
  const diferenca = roundMoney(debito - distribuido);
  const status = getViaVerdeStatus(gasto);
  return { debito, distribuido, diferenca, status };
}

export function applyViaVerdeDistribuicao(gasto, linhas = [], { marcarGeral = false } = {}) {
  if (!gasto) return gasto;
  if (marcarGeral) {
    return {
      ...gasto,
      veiculoId: null,
      veiculo: '',
      viaVerde: {
        distribuicaoStatus: VIA_VERDE_STATUS.GERAL,
        distribuicao: [],
      },
      updatedAt: new Date().toISOString(),
    };
  }

  const distribuicao = (linhas || [])
    .map((linha) => ({
      veiculoId: linha.veiculoId || null,
      valor: roundMoney(linha.valor),
    }))
    .filter((linha) => linha.veiculoId && linha.valor > 0);

  const distribuido = roundMoney(distribuicao.reduce((sum, linha) => sum + linha.valor, 0));
  const debito = getGastoEmpresaValor(gasto);
  const conferido = distribuicao.length > 0 && Math.abs(roundMoney(debito - distribuido)) < 0.005;

  return {
    ...gasto,
    veiculoId: null,
    veiculo: '',
    viaVerde: {
      distribuicaoStatus: conferido ? VIA_VERDE_STATUS.CONFERIDO : VIA_VERDE_STATUS.POR_CONFERIR,
      distribuicao,
    },
    updatedAt: new Date().toISOString(),
  };
}

export function listViaVerdePorConferir(gastos = []) {
  return (gastos || []).filter((gasto) => getViaVerdeStatus(gasto) === VIA_VERDE_STATUS.POR_CONFERIR);
}

export function buildViaVerdeFromForm(form, existing = null) {
  if (!isCategoriaViaVerde(form?.categoria)) return undefined;
  if (form.veiculoId && !(existing?.viaVerde?.distribuicao || []).length) return undefined;
  if (form.viaVerdeModo === VIA_VERDE_STATUS.GERAL) {
    return { distribuicaoStatus: VIA_VERDE_STATUS.GERAL, distribuicao: [] };
  }
  if (form.viaVerdeModo === VIA_VERDE_STATUS.CONFERIDO) {
    return {
      distribuicaoStatus: VIA_VERDE_STATUS.CONFERIDO,
      distribuicao: existing?.viaVerde?.distribuicao || [],
    };
  }
  if (existing?.viaVerde) return existing.viaVerde;
  return { distribuicaoStatus: VIA_VERDE_STATUS.POR_CONFERIR, distribuicao: [] };
}

export function summarizeVeiculoCustos(veiculo, gastos = [], programadas = [], yearMonth = getYearMonth()) {
  const historico = getGastosDoVeiculo(gastos, veiculo);
  const efetivos = historico.filter((item) => item.estado !== 'previsto');
  const buckets = {
    prestacoes: 0,
    seguros: 0,
    combustivel: 0,
    manutencao: 0,
    viaVerde: 0,
    outros: 0,
  };
  const mes = { combustivel: 0, manutencao: 0, viaVerde: 0 };

  efetivos.forEach((gasto) => {
    const valor = getValorGastoNoVeiculo(gasto, veiculo);
    const natureza = getNaturezaGasto(gasto);
    if (isCategoriaViaVerde(gasto.categoria)) buckets.viaVerde = roundMoney(buckets.viaVerde + valor);
    else if (isCategoriaCombustivel(gasto.categoria)) buckets.combustivel = roundMoney(buckets.combustivel + valor);
    else if (isCategoriaManutencao(gasto.categoria)) buckets.manutencao = roundMoney(buckets.manutencao + valor);
    else if (natureza === DESPESA_NATUREZA.PRESTACAO) buckets.prestacoes = roundMoney(buckets.prestacoes + valor);
    else if (natureza === DESPESA_NATUREZA.SEGURO) buckets.seguros = roundMoney(buckets.seguros + valor);
    else buckets.outros = roundMoney(buckets.outros + valor);

    const data = gasto.dataPagamento || gasto.data || '';
    if (yearMonth && String(data).startsWith(yearMonth)) {
      if (isCategoriaViaVerde(gasto.categoria)) mes.viaVerde = roundMoney(mes.viaVerde + valor);
      else if (isCategoriaCombustivel(gasto.categoria)) mes.combustivel = roundMoney(mes.combustivel + valor);
      else if (isCategoriaManutencao(gasto.categoria)) mes.manutencao = roundMoney(mes.manutencao + valor);
    }
  });

  const total = roundMoney(
    buckets.prestacoes +
      buckets.seguros +
      buckets.combustivel +
      buckets.manutencao +
      buckets.viaVerde +
      buckets.outros
  );

  const prestacaoProgramada = (programadas || []).find(
    (item) =>
      item.veiculoId === veiculo.id &&
      item.periodicidade === DESPESA_PERIODICIDADE.PARCELAS &&
      item.ativo !== false
  );
  const seguroProgramado = (programadas || []).find(
    (item) => item.veiculoId === veiculo.id && item.natureza === DESPESA_NATUREZA.SEGURO && item.ativo !== false
  );

  return {
    ...buckets,
    combustivelMes: mes.combustivel,
    manutencaoMes: mes.manutencao,
    viaVerdeMes: mes.viaVerde,
    total,
    historico,
    prestacaoProgramada,
    seguroProgramado,
  };
}

export function summarizeVariaveisMes(gastos = [], yearMonth = getYearMonth()) {
  let combustivel = 0;
  let viaVerde = 0;
  let viaVerdePorConferir = 0;

  (gastos || []).forEach((gasto) => {
    if (gasto.estado === 'previsto') return;
    const valor = getGastoEmpresaValor(gasto);
    if (getViaVerdeStatus(gasto) === VIA_VERDE_STATUS.POR_CONFERIR) {
      viaVerdePorConferir = roundMoney(viaVerdePorConferir + valor);
    }
    const data = gasto.dataPagamento || gasto.data || '';
    if (!String(data).startsWith(yearMonth)) return;
    if (isCategoriaCombustivel(gasto.categoria)) combustivel = roundMoney(combustivel + valor);
    if (isCategoriaViaVerde(gasto.categoria)) viaVerde = roundMoney(viaVerde + valor);
  });

  return { combustivel, viaVerde, viaVerdePorConferir };
}

export function getGastosDaProgramada(gastos = [], programadaId) {
  if (!programadaId) return [];
  return (gastos || []).filter((gasto) => gasto.despesaProgramadaId === programadaId);
}

export function countPagamentosProgramada(gastos = [], programadaId, yearMonth = null) {
  return getGastosDaProgramada(gastos, programadaId).filter((gasto) => {
    if (gasto.estado !== 'pago') return false;
    if (!yearMonth) return true;
    const mes = gasto.mesReferencia || String(gasto.dataPagamento || gasto.data || '').slice(0, 7);
    return mes === yearMonth;
  }).length;
}

export function getPeriodicidadeMeses(periodicidade) {
  if (periodicidade === DESPESA_PERIODICIDADE.TRIMESTRAL) return 3;
  if (periodicidade === DESPESA_PERIODICIDADE.SEMESTRAL) return 6;
  if (periodicidade === DESPESA_PERIODICIDADE.ANUAL) return 12;
  if (periodicidade === DESPESA_PERIODICIDADE.MENSAL || periodicidade === DESPESA_PERIODICIDADE.PARCELAS) return 1;
  return null;
}

export function getSeguroFim(programada) {
  if (!programada?.dataInicio || !programada.duracaoMeses) return programada?.dataFim || '';
  return addMonthsToDate(programada.dataInicio, Number(programada.duracaoMeses));
}

function nextDateWithDay(dia, fromISO) {
  const day = Number(dia);
  if (!Number.isFinite(day) || day < 1) return '';
  const [year, month] = String(fromISO).slice(0, 10).split('-').map(Number);
  const last = new Date(year, month, 0).getDate();
  const candidate = `${year}-${String(month).padStart(2, '0')}-${String(Math.min(day, last)).padStart(2, '0')}`;
  if (candidate >= fromISO) return candidate;
  return addMonthsToDate(candidate, 1);
}

export function getProximaDataComDia(dia, fromISO = getTodayISO()) {
  return nextDateWithDay(dia, fromISO);
}

export function isSalarioPagoPorDiaria(programada) {
  if (!programada) return false;
  if (programada.seedKey === 'salario-jeferson') return true;
  if (programada.natureza !== DESPESA_NATUREZA.SALARIO) return false;
  return /jeferson/i.test(`${programada.funcionarioNome || ''} ${programada.titulo || ''}`);
}

export function isDespesaMensalRecorrente(programada) {
  if (!programada || programada.ativo === false) return false;
  if (isSalarioPagoPorDiaria(programada)) return false;
  if (isCoberturaLonga(programada)) return false;
  if (programada.periodicidade === DESPESA_PERIODICIDADE.UNICA) return false;
  if (programada.periodicidade === DESPESA_PERIODICIDADE.SEMANAL) return false;
  return (
    programada.periodicidade === DESPESA_PERIODICIDADE.MENSAL ||
    programada.periodicidade === DESPESA_PERIODICIDADE.PARCELAS
  );
}

export function dataNoMesComDiaConhecido(yearMonth, diaVencimento) {
  const [year, month] = String(yearMonth).split('-').map(Number);
  if (!year || !month) return '';
  const last = new Date(year, month, 0).getDate();
  const dayNum = Number(diaVencimento);
  if (Number.isFinite(dayNum) && dayNum >= 1) {
    return `${yearMonth}-${String(Math.min(dayNum, last)).padStart(2, '0')}`;
  }
  return `${yearMonth}-01`;
}

export function getCoberturaMeses(programada, gasto = null) {
  const doPagamento = Number(gasto?.periodoCobertoMeses);
  if (Number.isFinite(doPagamento) && doPagamento > 0) return doPagamento;
  const daDespesa = Number(programada?.duracaoMeses);
  if (Number.isFinite(daDespesa) && daDespesa > 0) return daDespesa;
  if (isRecorrenciaConfirmada(programada)) {
    return getPeriodicidadeMeses(programada.periodicidade);
  }
  return null;
}

export function getEquivalenteMensal(valor, meses) {
  const v = Number(valor);
  const m = Number(meses);
  if (!Number.isFinite(v) || !Number.isFinite(m) || m < 1) return null;
  return roundMoney(v / m);
}

export function isCoberturaLonga(programada) {
  if (!programada) return false;
  return (
    programada.periodicidade === DESPESA_PERIODICIDADE.ANUAL ||
    programada.periodicidade === DESPESA_PERIODICIDADE.TRIMESTRAL ||
    programada.periodicidade === DESPESA_PERIODICIDADE.SEMESTRAL
  );
}

export const ESTADO_FIXO = {
  PAGO: { id: 'pago', label: 'Descontado neste mês' },
  PENDENTE: { id: 'pendente', label: 'Pendente neste mês' },
  ATRASADO: { id: 'atrasado', label: 'Atrasado' },
  COBERTO: { id: 'coberto', label: 'Coberto' },
  SEM_PROXIMA: { id: 'sem_proxima', label: 'Sem próxima cobrança definida' },
};

export function getEstadoFixoBadgeVariant(estado) {
  if (estado?.id === 'pago' || estado?.id === 'coberto') return 'success';
  if (estado?.id === 'atrasado') return 'danger';
  if (estado?.id === 'sem_proxima') return 'info';
  return 'warning';
}

export function getPeriodoCoberto(programada, { gastos = [], today = getTodayISO() } = {}) {
  if (!programada) return null;
  const meses = Number(programada.duracaoMeses) || getPeriodicidadeMeses(programada.periodicidade);
  const pagas = getGastosDaProgramada(gastos, programada.id)
    .filter((item) => item.estado === 'pago')
    .sort((a, b) =>
      String(b.dataPagamento || b.data || '').localeCompare(String(a.dataPagamento || a.data || ''))
    );
  const lastPaid = pagas[0];

  if (lastPaid) {
    const inicio = lastPaid.dataPagamento || lastPaid.data || programada.dataInicio || null;
    const duracao = Number(lastPaid.periodoCobertoMeses) || meses;
    const fim = inicio && duracao ? addMonthsToDate(inicio, duracao) : getSeguroFim(programada) || '';
    const ativa = Boolean(inicio) && (!fim || today < fim);
    return {
      ativa,
      inicio: inicio || '',
      fim: fim || '',
      dataPagamento: lastPaid.dataPagamento || lastPaid.data || null,
      duracaoMeses: duracao || null,
    };
  }

  if (programada.dataInicio && meses) {
    const fim = getSeguroFim(programada) || addMonthsToDate(programada.dataInicio, meses);
    const ativa = today >= programada.dataInicio && (!fim || today < fim);
    return {
      ativa,
      inicio: programada.dataInicio,
      fim: fim || '',
      dataPagamento: null,
      duracaoMeses: meses,
    };
  }

  if (programada.ultimaOcorrenciaMes && meses) {
    const fimMes = addMonthsToYearMonth(programada.ultimaOcorrenciaMes, meses);
    const ativa = getYearMonth(today) < fimMes;
    return {
      ativa,
      inicio: `${programada.ultimaOcorrenciaMes}-01`,
      fim: fimMes ? `${fimMes}-01` : '',
      dataPagamento: null,
      duracaoMeses: meses,
    };
  }

  return null;
}

export function getEstadoFixo(programada, { gastos = [], today = getTodayISO(), yearMonth } = {}) {
  if (!programada) return ESTADO_FIXO.PENDENTE;

  const mes = yearMonth || getYearMonth(today);
  const pagas = getGastosDaProgramada(gastos, programada.id).filter((item) => item.estado === 'pago');
  const cobertura = getPeriodoCoberto(programada, { gastos, today });

  if (isDespesaMensalRecorrente(programada)) {
    if (countPagamentosProgramada(gastos, programada.id, mes) > 0) return ESTADO_FIXO.PAGO;
    const vencimento = programada.diaVencimento ? dataNoMesComDiaConhecido(mes, programada.diaVencimento) : '';
    if (vencimento && vencimento < today && mes <= getYearMonth(today)) return ESTADO_FIXO.ATRASADO;
    return ESTADO_FIXO.PENDENTE;
  }

  if (pagas.length > 0) return ESTADO_FIXO.PAGO;
  if (cobertura?.ativa && programada.ultimaOcorrenciaMes) return ESTADO_FIXO.PAGO;

  if (programada.periodicidade === DESPESA_PERIODICIDADE.UNICA) {
    const alvo = programada.dataInicio || (programada.previsaoMes ? `${programada.previsaoMes}-01` : '');
    if (alvo && alvo.slice(0, 10) < today) return ESTADO_FIXO.ATRASADO;
    if (programada.previsaoMes || programada.dataInicio) return ESTADO_FIXO.PENDENTE;
    return ESTADO_FIXO.SEM_PROXIMA;
  }

  if (!isRecorrenciaConfirmada(programada)) {
    return ESTADO_FIXO.SEM_PROXIMA;
  }

  const proxima = getProximaOcorrencia(programada, { gastos, today });
  if (!proxima || proxima.semData) return ESTADO_FIXO.SEM_PROXIMA;
  const dataProxima = proxima.data || (proxima.previsaoMes ? `${proxima.previsaoMes}-01` : '');
  if (dataProxima && dataProxima.slice(0, 10) < today) return ESTADO_FIXO.ATRASADO;
  return ESTADO_FIXO.PENDENTE;
}

export function temPagamentoRegistadoNoPeriodo(programada, { gastos = [], data = getTodayISO(), yearMonth } = {}) {
  if (!programada) return false;
  const ref = data || getTodayISO();
  const mes = yearMonth || getYearMonth(ref);

  if (programada.periodicidade === DESPESA_PERIODICIDADE.UNICA) {
    return getGastosDaProgramada(gastos, programada.id).some((item) => item.estado === 'pago');
  }

  if (isCoberturaLonga(programada)) {
    const pagas = getGastosDaProgramada(gastos, programada.id).filter((item) => item.estado === 'pago');
    const meses = Number(programada.duracaoMeses) || getPeriodicidadeMeses(programada.periodicidade) || 12;
    const cobertura = getPeriodoCoberto(programada, { gastos, today: ref });
    if (yearMonth && cobertura?.fim && yearMonth === getYearMonth(cobertura.fim)) {
      return pagas.some((gasto) => {
        const inicio = gasto.dataPagamento || gasto.data || '';
        return inicio >= cobertura.fim;
      });
    }
    return pagas.some((gasto) => {
      const inicio = gasto.dataPagamento || gasto.data;
      if (!inicio) return false;
      const duracao = Number(gasto.periodoCobertoMeses) || meses;
      const fim = addMonthsToDate(inicio, duracao);
      return ref >= inicio && (!fim || ref < fim);
    });
  }

  return countPagamentosProgramada(gastos, programada.id, mes) > 0;
}

export function buildHistoricoMesesProgramada(programada, { gastos = [], today = getTodayISO() } = {}) {
  const historico = getGastosDaProgramada(gastos, programada?.id).sort((a, b) =>
    String(b.dataPagamento || b.data || '').localeCompare(String(a.dataPagamento || a.data || ''))
  );

  if (isCoberturaLonga(programada) || programada?.periodicidade === DESPESA_PERIODICIDADE.UNICA) {
    return historico.map((item) => {
      const duracao = Number(item.periodoCobertoMeses) || programada.duracaoMeses || getPeriodicidadeMeses(programada.periodicidade);
      return {
        id: item.id,
        mes: getYearMonth(item.dataPagamento || item.data || ''),
        label: item.dataPagamento || item.data ? formatDatePt(item.dataPagamento || item.data) : 'Não informado',
        estado: item.estado === 'pago' ? 'Pago' : 'Pendente',
        valor: getGastoEmpresaValor(item),
        periodoCoberto: duracao ? `${duracao} ${duracao === 1 ? 'mês' : 'meses'}` : '',
        dataPagamento: item.dataPagamento || item.data || '',
        gasto: item,
      };
    });
  }

  const pagosPorMes = new Map();
  historico.forEach((item) => {
    const mes = item.mesReferencia || getYearMonth(item.dataPagamento || item.data || '');
    if (!mes) return;
    if (!pagosPorMes.has(mes) || item.estado === 'pago') pagosPorMes.set(mes, item);
  });

  const mesAtual = getYearMonth(today);
  const mesesOrdenados = [...pagosPorMes.keys()].sort();
  const inicio =
    mesesOrdenados[0] || addMonthsToYearMonth(mesAtual, -5) || mesAtual;
  const meses = [];
  let cursor = inicio;
  // Garante histórico contínuo até ao mês actual (sem apagar meses pagos).
  for (let i = 0; i < 36; i += 1) {
    meses.push(cursor);
    if (cursor >= mesAtual) break;
    cursor = addMonthsToYearMonth(cursor, 1);
  }
  if (!meses.includes(mesAtual)) meses.push(mesAtual);

  return [...new Set(meses)]
    .sort((a, b) => b.localeCompare(a))
    .map((mes) => {
      const gasto = pagosPorMes.get(mes);
      const pago = gasto?.estado === 'pago';
      return {
        id: gasto?.id || `mes:${mes}`,
        mes,
        label: formatHistoricoMesPago(mes),
        estado: pago ? 'Pago' : 'Pendente',
        statusLabel: pago
          ? gasto?.dataPagamento || gasto?.data
            ? `Pago · ${formatDatePt(gasto.dataPagamento || gasto.data)}`
            : 'Pago'
          : mes === mesAtual
            ? 'Pendente neste mês'
            : 'Pendente',
        valor: gasto ? getGastoEmpresaValor(gasto) : Number(programada?.valor) || null,
        periodoCoberto: '',
        dataPagamento: gasto?.dataPagamento || gasto?.data || '',
        gasto: gasto || null,
      };
    });
}

export function getProximaOcorrencia(programada, { gastos = [], today = getTodayISO() } = {}) {
  if (!programada || programada.ativo === false) return null;

  const ocorrenciasPagas = getGastosDaProgramada(gastos, programada.id).filter((item) => item.estado === 'pago');

  if (programada.periodicidade === DESPESA_PERIODICIDADE.UNICA) {
    if (ocorrenciasPagas.length > 0) return null;
    return {
      tipo: 'unica',
      data: programada.dataInicio || null,
      previsaoMes: programada.previsaoMes || (programada.dataInicio ? getYearMonth(programada.dataInicio) : null),
      sortKey: programada.dataInicio || (programada.previsaoMes ? `${programada.previsaoMes}-01` : '9999-12-31'),
    };
  }

  if (programada.periodicidade === DESPESA_PERIODICIDADE.SEMANAL) {
    const lastPaid = ocorrenciasPagas
      .slice()
      .sort((a, b) =>
        String(b.dataPagamento || b.data || '').localeCompare(String(a.dataPagamento || a.data || ''))
      )[0];
    const origem = lastPaid ? lastPaid.dataPagamento || lastPaid.data : today;
    const data = lastPaid ? addDaysToDate(origem, 7) : today;
    return {
      tipo: 'recorrente',
      data,
      previsaoMes: data ? getYearMonth(data) : null,
      sortKey: data || '9999-12-31',
    };
  }

  if (programada.periodicidade === DESPESA_PERIODICIDADE.PARCELAS) {
    const restantes = Number(programada.parcelasRestantes);
    if (Number.isFinite(restantes) && restantes <= 0) return null;
    const mesAtual = getYearMonth(today);
    const pagoEsteMes = countPagamentosProgramada(gastos, programada.id, mesAtual) > 0;
    const mesAlvo = pagoEsteMes ? addMonthsToYearMonth(mesAtual, 1) : mesAtual;
    const data = programada.diaVencimento
      ? nextDateWithDay(programada.diaVencimento, pagoEsteMes ? `${mesAlvo}-01` : today)
      : null;
    return {
      tipo: 'parcela',
      data,
      previsaoMes: data ? getYearMonth(data) : mesAlvo,
      sortKey: data || `${mesAlvo}-99`,
      parcelasRestantes: restantes,
    };
  }

  if (isCoberturaLonga(programada)) {
    if (!isRecorrenciaConfirmada(programada)) {
      if (ocorrenciasPagas.length > 0) return null;
      return {
        tipo: 'indefinida',
        data: null,
        previsaoMes: null,
        sortKey: '9999-12-31',
        semData: true,
      };
    }
    const cobertura = getPeriodoCoberto(programada, { gastos, today });
    if (cobertura?.ativa) {
      return {
        tipo: 'renovacao',
        data: cobertura.fim || null,
        previsaoMes: cobertura.fim ? getYearMonth(cobertura.fim) : null,
        sortKey: cobertura.fim || '9999-12-31',
        semData: !cobertura.fim,
        confirmarRenovacao: Boolean(cobertura.fim),
      };
    }
  }

  if (programada.natureza === DESPESA_NATUREZA.SEGURO && programada.dataInicio && isRecorrenciaConfirmada(programada)) {
    const fim = getSeguroFim(programada);
    if (fim && fim < today && ocorrenciasPagas.some((item) => (item.dataPagamento || item.data || '') >= fim)) {
      return null;
    }
    return {
      tipo: 'renovacao',
      data: fim || null,
      previsaoMes: fim ? getYearMonth(fim) : programada.previsaoMes,
      sortKey: fim || '9999-12-31',
      confirmarRenovacao: true,
    };
  }

  if (programada.ultimaOcorrenciaMes) {
    const meses = getPeriodicidadeMeses(programada.periodicidade) || 1;
    const proximoMes = addMonthsToYearMonth(programada.ultimaOcorrenciaMes, meses);
    const data = programada.diaVencimento
      ? nextDateWithDay(programada.diaVencimento, `${proximoMes}-01`)
      : null;
    return {
      tipo: 'recorrente',
      data,
      previsaoMes: proximoMes,
      sortKey: data || `${proximoMes}-01`,
    };
  }

  if (programada.diaVencimento) {
    const data = nextDateWithDay(programada.diaVencimento, today);
    const mes = getYearMonth(data);
    if (countPagamentosProgramada(gastos, programada.id, mes) > 0) {
      const seguinte = addMonthsToDate(data, getPeriodicidadeMeses(programada.periodicidade) || 1);
      return {
        tipo: 'recorrente',
        data: seguinte,
        previsaoMes: getYearMonth(seguinte),
        sortKey: seguinte,
      };
    }
    return {
      tipo: 'recorrente',
      data,
      previsaoMes: mes,
      sortKey: data,
    };
  }

  const mesAtual = getYearMonth(today);
  const meses = getPeriodicidadeMeses(programada.periodicidade) || 1;

  if (
    (programada.periodicidade === DESPESA_PERIODICIDADE.ANUAL ||
      programada.periodicidade === DESPESA_PERIODICIDADE.UNICA) &&
    !programada.diaVencimento &&
    !programada.dataInicio &&
    !programada.ultimaOcorrenciaMes &&
    !programada.previsaoMes
  ) {
    return {
      tipo: 'indefinida',
      data: null,
      previsaoMes: null,
      sortKey: '9999-12-31',
      semData: true,
    };
  }

  if (countPagamentosProgramada(gastos, programada.id, mesAtual) > 0) {
    const proximoMes = addMonthsToYearMonth(mesAtual, meses);
    return {
      tipo: 'recorrente',
      data: null,
      previsaoMes: proximoMes,
      sortKey: `${proximoMes}-99`,
    };
  }

  return {
    tipo: 'recorrente',
    data: null,
    previsaoMes: mesAtual,
    sortKey: `${mesAtual}-99`,
  };
}

export function formatProximaOcorrencia(proxima) {
  if (!proxima) return '—';
  if (proxima.data) return proxima.data;
  if (proxima.previsaoMes) return formatYearMonth(proxima.previsaoMes);
  return 'Data não definida';
}

export function getTotalRestanteParcelas(programada) {
  const restantes = Number(programada?.parcelasRestantes);
  if (!Number.isFinite(restantes) || restantes <= 0) return 0;
  return roundMoney(restantes * (Number(programada.valor) || 0));
}

export function applyPagamentoProgramada(programada, { dataPagamento = getTodayISO() } = {}) {
  if (!programada) return programada;
  const next = {
    ...programada,
    updatedAt: new Date().toISOString(),
  };

  if (programada.periodicidade === DESPESA_PERIODICIDADE.PARCELAS) {
    const restantes = Number(programada.parcelasRestantes);
    if (Number.isFinite(restantes) && restantes > 0) {
      next.parcelasRestantes = restantes - 1;
    }
  }

  if (programada.periodicidade === DESPESA_PERIODICIDADE.UNICA) {
    next.ultimaOcorrenciaMes = getYearMonth(dataPagamento || getTodayISO());
    return next;
  }

  next.ultimaOcorrenciaMes = getYearMonth(dataPagamento || getTodayISO());
  return next;
}

export function inferNaturezaFromCategoria(categoria) {
  const nome = String(categoria || '').toLowerCase();
  if (nome.includes('salário') || nome.includes('salario')) return DESPESA_NATUREZA.SALARIO;
  if (nome.includes('segurança social') || nome.includes('seguranca social')) return DESPESA_NATUREZA.SEGURANCA_SOCIAL;
  if (nome.includes('contabilidade')) return DESPESA_NATUREZA.CONTABILIDADE;
  if (nome.includes('garagem') || nome.includes('aluguer')) return DESPESA_NATUREZA.ALUGUER;
  if (nome.includes('seguro')) return DESPESA_NATUREZA.SEGURO;
  if (nome.includes('parcela') || nome.includes('financiamento')) return DESPESA_NATUREZA.PRESTACAO;
  if (nome.includes('irc') || nome.includes('impic') || nome.includes('irs') || nome.includes('imposto')) {
    return DESPESA_NATUREZA.IMPOSTO;
  }
  if (
    nome.includes('combust') ||
    nome.includes('carregamento') ||
    nome.includes('via verde') ||
    nome.includes('manutenção') ||
    nome.includes('manutencao') ||
    nome.includes('pneu')
  ) {
    return DESPESA_NATUREZA.VARIAVEL;
  }
  return DESPESA_NATUREZA.OUTRO;
}

export function getNaturezaGasto(gasto) {
  if (gasto?.natureza) return gasto.natureza;
  return inferNaturezaFromCategoria(gasto?.categoria);
}

function grupoIdForGasto(gasto) {
  if (isCategoriaCarregamento(gasto?.categoria)) return 'veiculos';
  if (isCategoriaCombustivel(gasto?.categoria)) return 'combustivel';
  if (isCategoriaViaVerde(gasto?.categoria)) return 'viaVerde';
  if (isCategoriaManutencao(gasto?.categoria)) return 'manutencao';
  const natureza = getNaturezaGasto(gasto);
  if (natureza === DESPESA_NATUREZA.SALARIO) return 'salarios';
  if (natureza === DESPESA_NATUREZA.SEGURANCA_SOCIAL) return 'ss';
  if (natureza === DESPESA_NATUREZA.CONTABILIDADE) return 'contabilidade';
  if (natureza === DESPESA_NATUREZA.ALUGUER) return 'garagem';
  if (natureza === DESPESA_NATUREZA.SEGURO) return 'seguros';
  if (natureza === DESPESA_NATUREZA.IMPOSTO) return 'impostos';
  if (
    natureza === DESPESA_NATUREZA.PRESTACAO ||
    natureza === DESPESA_NATUREZA.VARIAVEL ||
    gasto?.veiculoId ||
    gasto?.veiculo
  ) {
    return 'veiculos';
  }
  return 'outras';
}

export function summarizeDespesasMes(gastos = [], yearMonth = getYearMonth()) {
  const totals = Object.fromEntries(RESUMO_DESPESA_GRUPOS.map((grupo) => [grupo.id, 0]));
  let total = 0;

  (gastos || []).forEach((gasto) => {
    if (gasto.estado === 'previsto') return;
    const data = gasto.dataPagamento || gasto.data || '';
    if (!String(data).startsWith(yearMonth)) return;
    const valor = getGastoEmpresaValor(gasto);
    const grupoId = grupoIdForGasto(gasto);
    totals[grupoId] = roundMoney((totals[grupoId] || 0) + valor);
    total = roundMoney(total + valor);
  });

  return {
    yearMonth,
    total,
    grupos: RESUMO_DESPESA_GRUPOS.map((grupo) => ({
      ...grupo,
      total: totals[grupo.id] || 0,
    })),
  };
}

export function listProximasDespesas(programadas = [], { gastos = [], veiculos = [], today = getTodayISO(), limite = 12 } = {}) {
  return (programadas || [])
    .filter((item) => item.ativo !== false)
    .map((item) => {
      const proxima = getProximaOcorrencia(item, { gastos, today });
      if (!proxima || proxima.semData) return null;
      const veiculo = getVeiculoById(veiculos, item.veiculoId);
      return {
        ...item,
        proxima,
        veiculoNome: veiculo?.nome || '',
      };
    })
    .filter(Boolean)
    .sort((a, b) => String(a.proxima.sortKey).localeCompare(String(b.proxima.sortKey)))
    .slice(0, limite);
}

export function summarizeProgramada(programada, { gastos = [], today = getTodayISO() } = {}) {
  const historico = getGastosDaProgramada(gastos, programada.id).sort((a, b) =>
    String(b.dataPagamento || b.data || '').localeCompare(String(a.dataPagamento || a.data || ''))
  );
  const pagas = historico.filter((item) => item.estado === 'pago');
  const ano = getYearMonth(today).slice(0, 4);
  const totalAno = roundMoney(
    pagas
      .filter((item) => String(item.dataPagamento || item.data || '').startsWith(ano))
      .reduce((sum, item) => sum + getGastoEmpresaValor(item), 0)
  );
  const proxima = getProximaOcorrencia(programada, { gastos, today });
  const totalRestante =
    programada.periodicidade === DESPESA_PERIODICIDADE.PARCELAS ? getTotalRestanteParcelas(programada) : null;

  return {
    historico,
    pagasRegistadas: pagas.length,
    totalAno,
    proxima,
    totalRestante,
    pagoEsteMes: pagas.some((item) => String(item.dataPagamento || item.data || '').startsWith(getYearMonth(today))),
    encerrada:
      (programada.periodicidade === DESPESA_PERIODICIDADE.PARCELAS && Number(programada.parcelasRestantes) <= 0) ||
      (programada.periodicidade === DESPESA_PERIODICIDADE.UNICA && pagas.length > 0),
  };
}

export function formatPeriodicidadeVisivel(programada) {
  if (!programada) return '—';
  if (!isRecorrenciaConfirmada(programada)) {
    return programada.periodicidade === DESPESA_PERIODICIDADE.UNICA
      ? 'Pagamento único'
      : 'Sem recorrência confirmada';
  }
  if (programada.periodicidade === DESPESA_PERIODICIDADE.TRIMESTRAL) return 'A cada 3 meses';
  if (programada.periodicidade === DESPESA_PERIODICIDADE.PARCELAS) return 'Mensal';
  if (programada.periodicidade === DESPESA_PERIODICIDADE.UNICA) return 'Pagamento único';
  return DESPESA_PERIODICIDADE_LABELS[programada.periodicidade] || programada.periodicidade || '—';
}

export function formatProgramadaEstado(programada, info) {
  return getEstadoFixo(programada, { gastos: info?.historico || [] }).label;
}

export function groupDespesasProgramadas(programadas = [], { gastos = [], today = getTodayISO() } = {}) {
  const grupos = PROGRAMADA_GRUPOS_VISIVEIS.map((grupo) => ({ ...grupo, items: [] }));
  (programadas || [])
    .filter((item) => item.ativo !== false)
    .forEach((item) => {
      const grupo =
        grupos.find((entry) => (entry.naturezas || []).includes(item.natureza)) ||
        grupos.find((entry) => entry.id === 'outras');
      if (!grupo) return;
      grupo.items.push({
        ...item,
        info: summarizeProgramada(item, { gastos, today }),
      });
    });
  return grupos.filter((grupo) => grupo.items.length > 0);
}

export function marcarValorRecuperado(item, dataRecebido = getTodayISO()) {
  return {
    ...item,
    status: VALOR_RECUPERAR_STATUS.RECEBIDO,
    dataRecebido: dataRecebido || getTodayISO(),
    updatedAt: new Date().toISOString(),
  };
}

const HOME_FIXO_GRUPOS = [
  { id: 'funcionarios', label: 'Funcionários', naturezas: [DESPESA_NATUREZA.SALARIO] },
  { id: 'encargos', label: 'Encargos', naturezas: [DESPESA_NATUREZA.SEGURANCA_SOCIAL] },
  { id: 'estrutura', label: 'Estrutura da empresa', naturezas: [DESPESA_NATUREZA.CONTABILIDADE, DESPESA_NATUREZA.ALUGUER] },
  { id: 'veiculos', label: 'Veículos' },
  { id: 'seguros', label: 'Seguros', naturezas: [DESPESA_NATUREZA.SEGURO] },
  { id: 'impostos', label: 'Impostos / Obrigações', naturezas: [DESPESA_NATUREZA.IMPOSTO] },
];

const NATUREZAS_PROXIMOS = [
  DESPESA_NATUREZA.SALARIO,
  DESPESA_NATUREZA.SEGURANCA_SOCIAL,
  DESPESA_NATUREZA.CONTABILIDADE,
  DESPESA_NATUREZA.ALUGUER,
  DESPESA_NATUREZA.PRESTACAO,
  DESPESA_NATUREZA.SEGURO,
  DESPESA_NATUREZA.IMPOSTO,
];

function formatDatePt(iso) {
  if (!iso) return '';
  const [year, month, day] = String(iso).slice(0, 10).split('-');
  if (!year || !month || !day) return String(iso);
  return `${day}/${month}/${year}`;
}

function formatMesNome(yearMonth) {
  if (!yearMonth) return '';
  const month = Number(String(yearMonth).slice(5, 7));
  const nome = MESES_PT[month - 1];
  return nome ? nome.charAt(0).toUpperCase() + nome.slice(1) : String(yearMonth);
}

function formatHistoricoMesPago(yearMonth) {
  const nome = formatMesNome(yearMonth);
  const year = String(yearMonth || '').slice(0, 4);
  return nome && year ? `${nome}/${year}` : String(yearMonth || '');
}

export function formatValorRecorrenteLabel(programada) {
  if (!programada) return 'Não informado';
  const valor = Number(programada.valor);
  if (!Number.isFinite(valor)) return 'Não informado';
  const texto = formatCurrency(valor);
  if (!isRecorrenciaConfirmada(programada)) return texto;
  if (
    programada.periodicidade === DESPESA_PERIODICIDADE.MENSAL ||
    programada.periodicidade === DESPESA_PERIODICIDADE.PARCELAS
  ) {
    return `${texto}/mês`;
  }
  if (programada.periodicidade === DESPESA_PERIODICIDADE.ANUAL) return `${texto}/ano`;
  if (programada.periodicidade === DESPESA_PERIODICIDADE.TRIMESTRAL) return `${texto} / a cada 3 meses`;
  if (programada.periodicidade === DESPESA_PERIODICIDADE.SEMESTRAL) return `${texto}/semestre`;
  return texto;
}

export function formatTituloHomeFixo(programada, veiculos = []) {
  if (!programada) return 'Despesa';
  if (programada.natureza === DESPESA_NATUREZA.SALARIO && programada.funcionarioNome) {
    return programada.funcionarioNome;
  }
  if (programada.natureza === DESPESA_NATUREZA.SEGURANCA_SOCIAL) return 'Segurança Social';
  if (programada.natureza === DESPESA_NATUREZA.CONTABILIDADE) return 'Contabilidade';
  if (programada.natureza === DESPESA_NATUREZA.ALUGUER) return 'Garagem';
  if (programada.natureza === DESPESA_NATUREZA.IMPOSTO) {
    if (/impic/i.test(`${programada.titulo || ''} ${programada.categoria || ''}`)) return 'IMPIC';
    if (/irc/i.test(`${programada.titulo || ''} ${programada.categoria || ''}`)) return 'IRC adiantado';
  }
  const veiculo = getVeiculoById(veiculos, programada.veiculoId);
  if (veiculo && (programada.natureza === DESPESA_NATUREZA.SEGURO || programada.natureza === DESPESA_NATUREZA.PRESTACAO)) {
    return veiculo.nome;
  }
  if (programada.natureza === DESPESA_NATUREZA.SEGURO && programada.funcionarioNome) {
    return programada.funcionarioNome;
  }
  return programada.titulo || 'Despesa';
}

export function formatMetasHomeFixo(programada) {
  if (!programada) return [];
  const metas = [];
  if (programada.periodicidade === DESPESA_PERIODICIDADE.PARCELAS) {
    const restantes = programada.parcelasRestantes;
    metas.push(
      restantes == null || restantes === ''
        ? 'Parcelas restantes: não informado'
        : `${restantes} parcelas restantes`
    );
  }
  if (programada.periodicidade === DESPESA_PERIODICIDADE.TRIMESTRAL && isRecorrenciaConfirmada(programada)) {
    if (programada.duracaoMeses) metas.push(`${programada.duracaoMeses} meses`);
    else metas.push('a cada 3 meses');
  }
  const coberturaMeses = getCoberturaMeses(programada);
  if (coberturaMeses && !isRecorrenciaConfirmada(programada)) {
    metas.push(`Cobertura informada: ${coberturaMeses} ${coberturaMeses === 1 ? 'mês' : 'meses'}`);
  }
  if (programada.dataInicio) metas.push(`Início: ${formatDatePt(programada.dataInicio)}`);
  if (programada.ultimaOcorrenciaMes) {
    metas.push(`Último desconto: ${formatYearMonth(programada.ultimaOcorrenciaMes)}`);
  }
  if (programada.natureza === DESPESA_NATUREZA.SEGURANCA_SOCIAL) {
    const parte = String(programada.titulo || '').split('—')[1];
    if (parte) metas.push(parte.trim().replace(/\s+e\s+/i, ' + '));
  }
  if (programada.previsaoMes && programada.periodicidade === DESPESA_PERIODICIDADE.UNICA) {
    metas.push(formatMesNome(programada.previsaoMes));
  }
  return metas;
}

function linhaFromProgramada(programada, veiculos, gastos, today) {
  const estado = getEstadoFixo(programada, { gastos, today });
  return {
    id: programada.id,
    kind: 'programada',
    titulo: formatTituloHomeFixo(programada, veiculos),
    valorLabel: formatValorRecorrenteLabel(programada),
    periodicidadeLabel: formatPeriodicidadeVisivel(programada),
    diaPagamento: programada.diaVencimento || null,
    estado,
    metas: formatMetasHomeFixo(programada),
    programada,
    veiculo: getVeiculoById(veiculos, programada.veiculoId),
  };
}

function linhaFromVeiculo(veiculo, programadas, valoresRecuperar, gastos, today) {
  const prestacao = (programadas || []).find(
    (item) =>
      item.veiculoId === veiculo.id &&
      item.natureza === DESPESA_NATUREZA.PRESTACAO &&
      item.ativo !== false
  );
  const recuperar = (valoresRecuperar || []).filter((item) => item.veiculoId === veiculo.id);
  const compraAPronto = /pronto/i.test(veiculo.notas || '');
  const metas = [];
  let valorLabel = 'Não informado';
  let periodicidadeLabel = '';
  let estado = null;

  if (prestacao) {
    valorLabel = formatValorRecorrenteLabel(prestacao);
    periodicidadeLabel = formatPeriodicidadeVisivel(prestacao);
    estado = getEstadoFixo(prestacao, { gastos, today });
    const restantes = prestacao.parcelasRestantes;
    metas.push(
      restantes == null || restantes === ''
        ? 'Parcelas restantes: não informado'
        : `${restantes} parcelas restantes`
    );
  } else if (compraAPronto) {
    valorLabel = 'Compra a pronto';
    const iva = recuperar[0];
    if (iva && iva.valor != null) {
      metas.push(`IVA a recuperar: ${formatCurrency(iva.valor)}`);
      if (iva.previsaoMes) metas.push(`Previsão: ${formatYearMonth(iva.previsaoMes)}`);
    }
  } else if (veiculo.propriedadeEmpresa === false) {
    valorLabel = 'Uso da empresa';
    metas.push('Não está em nome da empresa');
  } else {
    valorLabel = 'Sem prestação';
  }

  return {
    id: `veiculo:${veiculo.id}`,
    kind: 'veiculo',
    titulo: veiculo.nome,
    valorLabel,
    periodicidadeLabel,
    diaPagamento: prestacao?.diaVencimento || null,
    estado,
    metas,
    programada: prestacao || null,
    veiculo,
  };
}

export function buildHomeFixos({
  programadas = [],
  veiculos = [],
  valoresRecuperar = [],
  gastos = [],
  today = getTodayISO(),
} = {}) {
  const activas = (programadas || []).filter(
    (item) => item.ativo !== false && !isSalarioPagoPorDiaria(item)
  );

  return HOME_FIXO_GRUPOS.map((grupo) => {
    if (grupo.id === 'veiculos') {
      return {
        ...grupo,
        linhas: (veiculos || [])
          .filter((item) => item.ativo !== false)
          .map((veiculo) => linhaFromVeiculo(veiculo, activas, valoresRecuperar, gastos, today)),
      };
    }
    const linhas = (grupo.naturezas || []).flatMap((natureza) =>
      activas
        .filter((item) => item.natureza === natureza)
        .map((item) => linhaFromProgramada(item, veiculos, gastos, today))
    );
    return { ...grupo, linhas };
  }).filter((grupo) => (grupo.linhas || []).length > 0);
}

export function formatTituloProximoPagamento(item, veiculos = []) {
  if (!item) return 'Despesa';
  if (item.natureza === DESPESA_NATUREZA.SALARIO) {
    return `Salário ${item.funcionarioNome || formatTituloHomeFixo(item, veiculos)}`;
  }
  if (item.natureza === DESPESA_NATUREZA.PRESTACAO) {
    const veiculo = getVeiculoById(veiculos, item.veiculoId);
    return `Prestação ${veiculo?.nome || item.titulo || ''}`.trim();
  }
  if (item.natureza === DESPESA_NATUREZA.IMPOSTO && /irc/i.test(`${item.titulo || ''} ${item.categoria || ''}`)) {
    return 'IRC';
  }
  return formatTituloHomeFixo(item, veiculos);
}

function mesDaProximaOcorrencia(item) {
  return item?.proxima?.previsaoMes || (item?.proxima?.data ? getYearMonth(item.proxima.data) : null);
}

export function formatQuandoProximoPagamento(item) {
  if (!item) return '';
  const mes = mesDaProximaOcorrencia(item) || item.previsaoMes;
  const mesLabel = mes ? formatMesNome(mes) : '';
  if (item.diaVencimento) {
    return mesLabel ? `${mesLabel} · dia ${item.diaVencimento}` : `dia ${item.diaVencimento}`;
  }
  if (mesLabel) return mesLabel;
  return '';
}

export function listProximosPagamentosHome(
  programadas = [],
  { gastos = [], veiculos = [], today = getTodayISO(), limite = 16 } = {}
) {
  const visiveis = (programadas || []).filter((item) => !isSalarioPagoPorDiaria(item));
  return listProximasDespesas(visiveis, { gastos, veiculos, today, limite: 40 })
    .filter((item) => NATUREZAS_PROXIMOS.includes(item.natureza))
    .filter((item) => {
      if (isCoberturaLonga(item) && !isRecorrenciaConfirmada(item)) return false;
      if (isCoberturaLonga(item)) {
        const proximaData = item.proxima?.data;
        if (!proximaData || proximaData > today) return false;
      }
      const mesProxima = mesDaProximaOcorrencia(item);
      if (mesProxima && !isCoberturaLonga(item) && countPagamentosProgramada(gastos, item.id, mesProxima) > 0) {
        return false;
      }
      return true;
    })
    .slice(0, limite)
    .map((item) => {
      const mesProxima = mesDaProximaOcorrencia(item);
      const pagoProxima =
        mesProxima && !isCoberturaLonga(item)
          ? countPagamentosProgramada(gastos, item.id, mesProxima) > 0
          : getEstadoFixo(item, { gastos, today }).id === 'pago';
      return {
        ...item,
        tituloHome: formatTituloProximoPagamento(item, veiculos),
        quandoLabel: formatQuandoProximoPagamento(item),
        estado: pagoProxima ? ESTADO_FIXO.PAGO : ESTADO_FIXO.PENDENTE,
      };
    });
}

export function isGastoVariavelLancamento(gasto) {
  if (!gasto || gasto.estado === 'previsto') return false;
  if (gasto.despesaProgramadaId) return false;
  return true;
}

export function buildGastoFromProgramada(
  programada,
  { data, estado = 'pago', dataPagamento, observacao = '', veiculoNome = '', valor, mesReferencia } = {}
) {
  const dataGasto = data || getTodayISO();
  const pago = estado === 'pago';
  const periodicidade =
    programada.periodicidade === DESPESA_PERIODICIDADE.UNICA
      ? ''
      : programada.periodicidade === DESPESA_PERIODICIDADE.PARCELAS
        ? 'mensal'
        : programada.periodicidade;
  const valorPago = valor != null && valor !== '' && Number.isFinite(Number(valor)) ? roundMoney(Number(valor)) : programada.valor;

  return {
    descricao: programada.titulo,
    categoria: programada.categoria,
    valor: valorPago,
    data: dataGasto,
    dataVencimento: dataGasto,
    dataPagamento: pago ? dataPagamento || dataGasto : '',
    formaPagamento: 'Transferência',
    estado,
    tipo: programada.periodicidade === DESPESA_PERIODICIDADE.UNICA ? 'unico' : 'recorrente',
    periodicidade,
    valorHabitual: programada.valor,
    observacao: observacao || programada.observacao || '',
    veiculo: veiculoNome || '',
    veiculoId: programada.veiculoId || null,
    natureza: programada.natureza,
    despesaProgramadaId: programada.id,
    mesReferencia: mesReferencia || getYearMonth(dataGasto),
    periodoCobertoMeses: getCoberturaMeses(programada) || null,
  };
}
