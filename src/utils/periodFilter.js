export const PERIOD_PRESETS = [
  { id: 'todos', label: 'Todos' },
  { id: 'hoje', label: 'Hoje' },
  { id: 'esta_semana', label: 'Esta semana' },
  { id: 'semana_anterior', label: 'Semana anterior' },
  { id: 'este_mes', label: 'Este mês' },
  { id: 'mes_anterior', label: 'Mês anterior' },
  { id: 'personalizado', label: 'Personalizado' },
];

export const YEAR_PERIOD_PRESETS = [
  { id: 'este_ano', label: 'Este ano' },
  { id: 'ano_anterior', label: 'Ano anterior' },
];

export const GASTOS_EMPRESA_PERIOD_PRESETS = [
  { id: 'todos', label: 'Todos' },
  { id: 'esta_semana', label: 'Semanal' },
  { id: 'este_mes', label: 'Mensal' },
  { id: 'este_ano', label: 'Anual' },
];

export const GASTOS_RAPIDOS_PERIOD_PRESETS = [
  { id: 'mes_anterior', label: 'Mês anterior' },
  { id: 'este_mes', label: 'Este mês' },
  { id: 'este_ano', label: 'Este ano' },
  { id: 'todos', label: 'Todos' },
  { id: 'personalizado', label: 'Escolher período' },
];

export const GASTOS_EMPRESA_TOTAL_LABELS = {
  todos: 'Total de todos os gastos',
  esta_semana: 'Total gasto na semana',
  este_mes: 'Total gasto no mês',
  mes_anterior: 'Total gasto no mês anterior',
  este_ano: 'Total gasto no ano',
  personalizado: 'Total do período',
};

function toISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeekMonday(date) {
  const start = startOfDay(date);
  const weekday = start.getDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  start.setDate(start.getDate() + diff);
  return start;
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function getPeriodRange(preset, customInicio = '', customFim = '', now = new Date()) {
  if (!preset || preset === 'todos') {
    return { inicio: null, fim: null };
  }

  const today = startOfDay(now);

  if (preset === 'hoje') {
    const iso = toISODate(today);
    return { inicio: iso, fim: iso };
  }

  if (preset === 'esta_semana') {
    const start = startOfWeekMonday(today);
    return { inicio: toISODate(start), fim: toISODate(addDays(start, 6)) };
  }

  if (preset === 'semana_anterior') {
    const start = addDays(startOfWeekMonday(today), -7);
    return { inicio: toISODate(start), fim: toISODate(addDays(start, 6)) };
  }

  if (preset === 'este_mes') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { inicio: toISODate(start), fim: toISODate(end) };
  }

  if (preset === 'mes_anterior') {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);
    return { inicio: toISODate(start), fim: toISODate(end) };
  }

  if (preset === 'este_ano') {
    const start = new Date(today.getFullYear(), 0, 1);
    const end = new Date(today.getFullYear(), 11, 31);
    return { inicio: toISODate(start), fim: toISODate(end) };
  }

  if (preset === 'ano_anterior') {
    const year = today.getFullYear() - 1;
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);
    return { inicio: toISODate(start), fim: toISODate(end) };
  }

  if (preset === 'personalizado') {
    return {
      inicio: customInicio || null,
      fim: customFim || null,
    };
  }

  return { inicio: null, fim: null };
}

export function getRecordDate(record) {
  if (!record) return null;
  return record.data || record.dataVencimento || null;
}

export function isDateInPeriod(dateValue, range) {
  if (!range?.inicio && !range?.fim) return true;
  if (!dateValue) return false;

  const date = String(dateValue).slice(0, 10);
  if (range.inicio && date < range.inicio) return false;
  if (range.fim && date > range.fim) return false;
  return true;
}

export function filterByPeriod(items = [], range, getDate = getRecordDate) {
  if (!range?.inicio && !range?.fim) return items;
  return items.filter((item) => isDateInPeriod(getDate(item), range));
}

export function formatPeriodLabel(preset, range, presets = []) {
  const presetMeta =
    presets.find((item) => item.id === preset) ||
    PERIOD_PRESETS.find((item) => item.id === preset) ||
    YEAR_PERIOD_PRESETS.find((item) => item.id === preset) ||
    GASTOS_EMPRESA_PERIOD_PRESETS.find((item) => item.id === preset) ||
    GASTOS_RAPIDOS_PERIOD_PRESETS.find((item) => item.id === preset);
  const presetLabel = presetMeta?.label || 'Período';

  if (!range?.inicio && !range?.fim) {
    return `${presetLabel} — todos os registos`;
  }

  const format = (value) => {
    if (!value) return '…';
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  };

  if (range.inicio && range.fim && range.inicio === range.fim) {
    return `${presetLabel}: ${format(range.inicio)}`;
  }

  return `${presetLabel}: ${format(range.inicio)} — ${format(range.fim)}`;
}

export function summarizeDiariasPeriodo(diarias = []) {
  return diarias.reduce(
    (acc, diaria) => {
      acc.quantidade += 1;
      acc.dias += Number(diaria.quantidade) || 0;
      acc.total += (Number(diaria.quantidade) || 0) * (Number(diaria.valorDiaria) || 0);
      if (diaria.observacao?.trim()) acc.observacoes += 1;
      return acc;
    },
    { quantidade: 0, dias: 0, total: 0, observacoes: 0 }
  );
}
