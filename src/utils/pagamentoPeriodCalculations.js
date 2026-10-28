import { formatDate, getMonthYear } from './formatters';
import { getReferenciaMesAno } from './semanaMesCalculations';
import { sameFuncionarioId } from './fechamentoPagamentoCalculations';

export const FREQUENCIA_PAGAMENTO = {
  SEMANAL: 'Semanal',
  QUINZENAL: 'Quinzenal',
  MENSAL: 'Mensal',
};

/** Frequências informadas pelo administrador para funcionários já existentes. */
const FREQUENCIA_INICIAL_POR_NOME = {
  lucas: FREQUENCIA_PAGAMENTO.SEMANAL,
  rosselito: FREQUENCIA_PAGAMENTO.SEMANAL,
  grande: FREQUENCIA_PAGAMENTO.SEMANAL,
  piria: FREQUENCIA_PAGAMENTO.SEMANAL,
  jefferson: FREQUENCIA_PAGAMENTO.SEMANAL,
  wilson: FREQUENCIA_PAGAMENTO.QUINZENAL,
  tchelo: FREQUENCIA_PAGAMENTO.MENSAL,
  adilson: FREQUENCIA_PAGAMENTO.MENSAL,
};

function toISODate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseISODate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function getFrequenciaPagamento(funcionario) {
  return funcionario?.frequenciaPagamento || FREQUENCIA_PAGAMENTO.SEMANAL;
}

export function migrateFuncionarioFrequencias(funcionarios = []) {
  let changed = false;

  const migrated = funcionarios.map((funcionario) => {
    if (funcionario.frequenciaPagamento) return funcionario;

    const key = (funcionario.nome || '').trim().toLowerCase();
    const frequencia = FREQUENCIA_INICIAL_POR_NOME[key];
    if (!frequencia) return funcionario;

    changed = true;
    return { ...funcionario, frequenciaPagamento: frequencia };
  });

  return changed ? migrated : funcionarios;
}

export function getWeekPeriod(date = new Date()) {
  const d = date instanceof Date ? new Date(date) : parseISODate(date);
  const weekday = d.getDay();
  const diffToMonday = weekday === 0 ? -6 : 1 - weekday;

  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const inicio = toISODate(monday);
  const fim = toISODate(sunday);

  return {
    tipo: FREQUENCIA_PAGAMENTO.SEMANAL,
    inicio,
    fim,
    referenciaMes: getReferenciaMesAno(d),
    label: `Semana ${formatDate(inicio)} — ${formatDate(fim)}`,
    shortLabel: 'semana atual',
  };
}

export function getQuinzenaPeriod(date = new Date()) {
  const d = date instanceof Date ? new Date(date) : parseISODate(date);
  const year = d.getFullYear();
  const month = d.getMonth();
  const monthStr = String(month + 1).padStart(2, '0');
  const day = d.getDate();
  const lastDay = new Date(year, month + 1, 0).getDate();

  if (day <= 15) {
    const inicio = `${year}-${monthStr}-01`;
    const fim = `${year}-${monthStr}-15`;
    return {
      tipo: FREQUENCIA_PAGAMENTO.QUINZENAL,
      inicio,
      fim,
      referenciaMes: getReferenciaMesAno(d),
      label: `Quinzena ${formatDate(inicio)} — ${formatDate(fim)}`,
      shortLabel: 'quinzena atual',
    };
  }

  const inicio = `${year}-${monthStr}-16`;
  const fim = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

  return {
    tipo: FREQUENCIA_PAGAMENTO.QUINZENAL,
    inicio,
    fim,
    referenciaMes: getReferenciaMesAno(d),
    label: `Quinzena ${formatDate(inicio)} — ${formatDate(fim)}`,
    shortLabel: 'quinzena atual',
  };
}

export function getMonthPeriod(date = new Date()) {
  const d = date instanceof Date ? new Date(date) : parseISODate(date);
  const year = d.getFullYear();
  const month = d.getMonth();
  const monthStr = String(month + 1).padStart(2, '0');
  const lastDay = new Date(year, month + 1, 0).getDate();
  const inicio = `${year}-${monthStr}-01`;
  const fim = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

  return {
    tipo: FREQUENCIA_PAGAMENTO.MENSAL,
    inicio,
    fim,
    referenciaMes: getReferenciaMesAno(d),
    label: getMonthYear(inicio).charAt(0).toUpperCase() + getMonthYear(inicio).slice(1),
    shortLabel: 'mês atual',
  };
}

export function getCurrentPaymentPeriod(frequencia, date = new Date()) {
  switch (frequencia) {
    case FREQUENCIA_PAGAMENTO.QUINZENAL:
      return getQuinzenaPeriod(date);
    case FREQUENCIA_PAGAMENTO.MENSAL:
      return getMonthPeriod(date);
    case FREQUENCIA_PAGAMENTO.SEMANAL:
    default:
      return getWeekPeriod(date);
  }
}

function periodsMatch(a, b) {
  if (!a || !b) return false;
  return a.inicio === b.inicio && a.fim === b.fim;
}

function dateInPeriod(dateStr, period) {
  if (!dateStr || !period?.inicio || !period?.fim) return false;
  return dateStr >= period.inicio && dateStr <= period.fim;
}

export function fechamentoMatchesPeriod(fechamento, period) {
  if (!fechamento || !period) return false;

  if (fechamento.periodoInicio && fechamento.periodoFim) {
    if (
      fechamento.periodoInicio === period.inicio &&
      fechamento.periodoFim === period.fim
    ) {
      return true;
    }
  }

  if (period.tipo === FREQUENCIA_PAGAMENTO.MENSAL) {
    if (
      fechamento.referenciaMes &&
      fechamento.referenciaMes === period.referenciaMes &&
      (fechamento.tipoPagamento === FREQUENCIA_PAGAMENTO.MENSAL ||
        fechamento.tipoPagamento === 'Mensal')
    ) {
      return true;
    }
  }

  if (dateInPeriod(fechamento.data, period)) {
    const tipo = fechamento.tipoPagamento;
    if (
      !tipo ||
      tipo === period.tipo ||
      tipo === 'Outro' ||
      (period.tipo === FREQUENCIA_PAGAMENTO.SEMANAL && tipo === 'Semanal') ||
      (period.tipo === FREQUENCIA_PAGAMENTO.QUINZENAL && tipo === 'Quinzenal') ||
      (period.tipo === FREQUENCIA_PAGAMENTO.MENSAL && tipo === 'Mensal')
    ) {
      return true;
    }
  }

  return false;
}

export function isPeriodPaid(fechamentosPagamento, funcionarioId, period) {
  if (!period) return false;

  return (fechamentosPagamento || []).some(
    (fechamento) =>
      sameFuncionarioId(fechamento.funcionarioId, funcionarioId) &&
      fechamentoMatchesPeriod(fechamento, period)
  );
}

export function getFuncionarioPagamentoResumo(
  funcionario,
  fechamentosPagamento = [],
  referenceDate = new Date()
) {
  const frequencia = getFrequenciaPagamento(funcionario);
  const period = getCurrentPaymentPeriod(frequencia, referenceDate);
  const isPaid = isPeriodPaid(fechamentosPagamento, funcionario.id, period);

  const ultimoFechamento = (fechamentosPagamento || [])
    .filter((f) => sameFuncionarioId(f.funcionarioId, funcionario.id))
    .sort((a, b) => new Date(b.createdAt || b.data) - new Date(a.createdAt || a.data))[0];

  const ultimoPeriodo =
    ultimoFechamento?.periodoInicio && ultimoFechamento?.periodoFim
      ? `${formatDate(ultimoFechamento.periodoInicio)} — ${formatDate(ultimoFechamento.periodoFim)}`
      : ultimoFechamento?.referencia || null;

  return {
    frequencia,
    period,
    isPaid,
    statusText: isPaid ? 'Pago' : 'Pendente',
    statusLabel: isPaid
      ? `🟢 Pago — ${period.shortLabel}`
      : `🟠 Pendente — ${period.shortLabel}`,
    periodLabel: period.label,
    ultimoPeriodo,
  };
}

export function getFechamentoPeriodoLabel(fechamento) {
  if (!fechamento) return '—';

  if (fechamento.periodoInicio && fechamento.periodoFim) {
    if (fechamento.tipoPagamento === FREQUENCIA_PAGAMENTO.MENSAL) {
      return getMonthYear(fechamento.periodoInicio).charAt(0).toUpperCase() +
        getMonthYear(fechamento.periodoInicio).slice(1);
    }
    return `${formatDate(fechamento.periodoInicio)} — ${formatDate(fechamento.periodoFim)}`;
  }

  if (
    fechamento.tipoPagamento === FREQUENCIA_PAGAMENTO.MENSAL &&
    fechamento.referenciaMes
  ) {
    const [year, month] = fechamento.referenciaMes.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    const label = getMonthYear(toISODate(date));
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  return fechamento.referencia || formatDate(fechamento.data);
}

export function frequenciaToTipoPagamento(frequencia) {
  switch (frequencia) {
    case FREQUENCIA_PAGAMENTO.QUINZENAL:
      return 'Quinzenal';
    case FREQUENCIA_PAGAMENTO.MENSAL:
      return 'Mensal';
    default:
      return 'Semanal';
  }
}
