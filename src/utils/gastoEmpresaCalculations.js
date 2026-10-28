import { getTodayISO } from './formatters';
import { hasIvaInfo, roundMoney } from './ivaCalculations';
import { applySinal } from './gastoDocumentoTipo';

export const GASTO_EMPRESA_ESTADOS = [
  { id: 'pago', label: 'Pago' },
  { id: 'pendente', label: 'Pendente' },
  { id: 'previsto', label: 'Previsto' },
];

export const GASTO_EMPRESA_PERIODICIDADES = [
  { id: 'semanal', label: 'Semanal' },
  { id: 'mensal', label: 'Mensal' },
  { id: 'trimestral', label: 'Trimestral' },
  { id: 'semestral', label: 'Semestral' },
  { id: 'anual', label: 'Anual' },
];

const MESES_POR_PERIODICIDADE = {
  mensal: 1,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

export function isGastoEmpresaApagado(gasto) {
  return Boolean(gasto?.deletedAt || gasto?.deleted_at);
}

export function getGastosEmpresaAtivos(gastos = []) {
  return (gastos || []).filter((gasto) => !isGastoEmpresaApagado(gasto));
}

export function getGastosEmpresaLixeira(gastos = []) {
  return (gastos || [])
    .filter(isGastoEmpresaApagado)
    .slice()
    .sort((a, b) =>
      String(b.deletedAt || b.deleted_at || '').localeCompare(String(a.deletedAt || a.deleted_at || ''))
    );
}

export function isGastoEmpresaPrevisto(gasto) {
  return gasto?.estado === 'previsto';
}

export function isGastoEmpresaEfetivo(gasto) {
  return Boolean(gasto) && gasto.estado !== 'previsto';
}

export function isGastoEmpresaVencido(gasto, today = getTodayISO()) {
  if (!gasto || gasto.estado === 'pago') return false;
  const vencimento = gasto.dataVencimento || '';
  if (!vencimento) return false;
  return String(vencimento).slice(0, 10) < String(today).slice(0, 10);
}

export function getGastoEmpresaDisplayEstado(gasto, today = getTodayISO()) {
  if (!gasto) return 'pendente';
  if (gasto.estado === 'pago') return 'pago';
  if (isGastoEmpresaVencido(gasto, today)) return 'vencido';
  return gasto.estado || 'pendente';
}

export function getGastoEmpresaEstadoLabel(estado) {
  if (estado === 'pago') return 'Pago';
  if (estado === 'pendente') return 'Pendente';
  if (estado === 'previsto') return 'Previsto';
  if (estado === 'vencido') return 'Vencido';
  return estado || '—';
}

export function getGastoEmpresaEstadoVariant(estado) {
  if (estado === 'pago') return 'success';
  if (estado === 'pendente') return 'warning';
  if (estado === 'previsto') return 'info';
  if (estado === 'vencido') return 'danger';
  return 'default';
}

export function getGastoEmpresaValor(gasto) {
  if (!gasto) return 0;
  const bruto =
    hasIvaInfo(gasto) && gasto.valorComIva != null
      ? Number(gasto.valorComIva) || 0
      : Number(gasto.valor) || 0;
  return applySinal(bruto, gasto);
}

export function addDaysToDate(isoDate, days) {
  if (!isoDate) return '';
  const [year, month, day] = String(isoDate).slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return '';
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + Number(days || 0));
  const nextYear = date.getFullYear();
  const nextMonth = date.getMonth() + 1;
  const nextDay = date.getDate();
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`;
}

export function addPeriodoToDate(isoDate, periodicidade) {
  if (!isoDate) return '';
  if (periodicidade === 'semanal') return addDaysToDate(isoDate, 7);
  const [year, month, day] = String(isoDate).slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return '';
  const addMonths = MESES_POR_PERIODICIDADE[periodicidade] || 1;
  const totalMonths = year * 12 + (month - 1) + addMonths;
  const nextYear = Math.floor(totalMonths / 12);
  const nextMonthIndex = totalMonths % 12;
  const lastDay = new Date(nextYear, nextMonthIndex + 1, 0).getDate();
  const nextDay = Math.min(day, lastDay);
  return `${nextYear}-${String(nextMonthIndex + 1).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`;
}

export function generateOcorrenciasPrevistas(base, { horizonteMeses = 12 } = {}) {
  if (!base || base.tipo !== 'recorrente' || !base.periodicidade) return [];
  const start = base.dataVencimento || base.data;
  if (!start) return [];

  const horizonte = addPeriodoToDate(start, horizonteMeses === 12 ? 'anual' : 'mensal');
  const items = [];
  let current = addPeriodoToDate(start, base.periodicidade);
  let guard = 0;
  const maxOcorrencias = base.periodicidade === 'semanal' ? 54 : 24;

  while (current && current <= horizonte && guard < maxOcorrencias) {
    items.push({
      descricao: base.descricao,
      categoria: base.categoria,
      valor: base.valor,
      data: current,
      dataVencimento: current,
      dataPagamento: '',
      formaPagamento: base.formaPagamento || '',
      estado: 'previsto',
      tipo: 'recorrente',
      periodicidade: base.periodicidade,
      valorHabitual: base.valorHabitual ?? base.valor,
      observacao: base.observacao || '',
      veiculo: base.veiculo || '',
      veiculoId: base.veiculoId || null,
      obraId: base.obraId || null,
      natureza: base.natureza || '',
      despesaProgramadaId: base.despesaProgramadaId || null,
      pagoPor: base.pagoPor || '',
      serieId: base.serieId || null,
      ivaInformado: base.ivaInformado === true,
      valorBaseTipo: base.valorBaseTipo,
      taxaIva: base.taxaIva,
      valorSemIva: base.valorSemIva,
      valorIva: base.valorIva,
      valorComIva: base.valorComIva,
      ivaDedutivel: base.ivaDedutivel,
    });
    current = addPeriodoToDate(current, base.periodicidade);
    guard += 1;
  }

  return items;
}

export function buildMarcarPago(gasto, dataPagamento = getTodayISO()) {
  return {
    ...gasto,
    estado: 'pago',
    dataPagamento: dataPagamento || getTodayISO(),
    updatedAt: new Date().toISOString(),
  };
}

export function filterGastosEmpresa(gastos = [], filters = {}, today = getTodayISO()) {
  const {
    categoria = '',
    estado = '',
    formaPagamento = '',
    tipo = '',
    tipoLancamento = '',
    ivaDedutivel = '',
    veiculoId = '',
    obraId = '',
  } = filters;

  return (gastos || []).filter((gasto) => {
    if (isGastoEmpresaApagado(gasto)) return false;
    if (categoria && gasto.categoria !== categoria) return false;
    if (formaPagamento && gasto.formaPagamento !== formaPagamento) return false;
    if (tipo && gasto.tipo !== tipo) return false;
    if (veiculoId) {
      const directo = gasto.veiculoId === veiculoId || gasto.veiculo === veiculoId;
      const distribuido = (gasto.viaVerde?.distribuicao || []).some((linha) => linha.veiculoId === veiculoId);
      if (!directo && !distribuido) return false;
    }

    if (obraId && gasto.obraId !== obraId) return false;

    if (tipoLancamento === 'recorrente') {
      if (gasto.tipo !== 'recorrente' && !gasto.despesaProgramadaId) return false;
    }
    if (tipoLancamento === 'variavel') {
      if (gasto.tipo === 'recorrente' || gasto.despesaProgramadaId) return false;
    }

    if (estado) {
      const display = getGastoEmpresaDisplayEstado(gasto, today);
      if (display !== estado) return false;
    }

    if (ivaDedutivel === 'sim' && gasto.ivaDedutivel !== true) return false;
    if (ivaDedutivel === 'nao') {
      if (!hasIvaInfo(gasto) || gasto.ivaDedutivel === true) return false;
    }

    return true;
  });
}

export function summarizeGastosEmpresa(gastos = [], today = getTodayISO()) {
  const acc = {
    total: 0,
    pago: 0,
    pendente: 0,
    previsto: 0,
    vencido: 0,
    iva: 0,
    ivaDedutivel: 0,
    ivaNaoDedutivel: 0,
    totalSemIva: 0,
    totalComIva: 0,
    porCategoria: {},
  };

  for (const gasto of gastos) {
    if (isGastoEmpresaApagado(gasto)) continue;
    const valor = getGastoEmpresaValor(gasto);
    const display = getGastoEmpresaDisplayEstado(gasto, today);

    if (display === 'previsto') {
      acc.previsto = roundMoney(acc.previsto + valor);
      continue;
    }

    acc.total = roundMoney(acc.total + valor);

    if (display === 'pago') acc.pago = roundMoney(acc.pago + valor);
    if (display === 'pendente') acc.pendente = roundMoney(acc.pendente + valor);
    if (display === 'vencido') {
      acc.vencido = roundMoney(acc.vencido + valor);
      acc.pendente = roundMoney(acc.pendente + valor);
    }

    const cat = gasto.categoria || 'Outras despesas';
    acc.porCategoria[cat] = roundMoney((acc.porCategoria[cat] || 0) + valor);

    if (hasIvaInfo(gasto)) {
      acc.iva = roundMoney(acc.iva + applySinal(Number(gasto.valorIva) || 0, gasto));
      acc.totalSemIva = roundMoney(acc.totalSemIva + applySinal(Number(gasto.valorSemIva) || 0, gasto));
      acc.totalComIva = roundMoney(acc.totalComIva + applySinal(Number(gasto.valorComIva) || 0, gasto));
      if (gasto.ivaDedutivelValor != null && Number.isFinite(Number(gasto.ivaDedutivelValor))) {
        acc.ivaDedutivel = roundMoney(acc.ivaDedutivel + applySinal(Number(gasto.ivaDedutivelValor), gasto));
        acc.ivaNaoDedutivel = roundMoney(
          acc.ivaNaoDedutivel +
            applySinal(
              gasto.ivaNaoDedutivelValor != null
                ? Number(gasto.ivaNaoDedutivelValor)
                : Math.max(0, (Number(gasto.valorIva) || 0) - Number(gasto.ivaDedutivelValor)),
              gasto
            )
        );
      } else if (gasto.ivaDedutivel === true) {
        acc.ivaDedutivel = roundMoney(acc.ivaDedutivel + applySinal(Number(gasto.valorIva) || 0, gasto));
      } else if (gasto.ivaDedutivel === false) {
        acc.ivaNaoDedutivel = roundMoney(acc.ivaNaoDedutivel + applySinal(Number(gasto.valorIva) || 0, gasto));
      }
    }
  }

  return acc;
}

export function getCompromissosEmpresa(gastos = [], today = getTodayISO()) {
  return (gastos || [])
    .filter((gasto) => !isGastoEmpresaApagado(gasto) && gasto.estado !== 'pago')
    .sort((a, b) => {
      const da = a.dataVencimento || a.data || '9999-99-99';
      const db = b.dataVencimento || b.data || '9999-99-99';
      if (da === db) return (a.descricao || '').localeCompare(b.descricao || '');
      return da.localeCompare(db);
    })
    .map((gasto) => ({
      ...gasto,
      displayEstado: getGastoEmpresaDisplayEstado(gasto, today),
      vencido: isGastoEmpresaVencido(gasto, today),
    }));
}

export function gastosEmpresaParaIva(gastos = []) {
  return (gastos || []).filter((gasto) => !isGastoEmpresaApagado(gasto) && isGastoEmpresaEfetivo(gasto));
}
