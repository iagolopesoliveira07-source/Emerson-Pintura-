function toSafeDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const raw = String(value).trim();
  if (!raw) return null;

  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const pt = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (pt) {
    const date = new Date(Number(pt[3]), Number(pt[2]) - 1, Number(pt[1]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatCurrency(value) {
  const n = Number(value);
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number.isFinite(n) ? n : 0);
}

export function formatPercent(value, { digits = 0 } = {}) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return `${Number(value).toLocaleString('pt-PT', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;
}

export function formatDate(dateStr) {
  const date = toSafeDate(dateStr);
  if (!date) return '—';
  try {
    return new Intl.DateTimeFormat('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  } catch {
    return '—';
  }
}

export function formatDateTime(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/** Exibe "Não informado" quando a data estiver vazia (obras/diárias antigas). */
export function formatDateOrNotInformed(dateStr) {
  if (!dateStr) return 'Não informado';
  return formatDate(dateStr);
}

export function formatDateLong(dateStr) {
  const date = toSafeDate(dateStr);
  if (!date) return 'Não informado';
  try {
    return new Intl.DateTimeFormat('pt-PT', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  } catch {
    return 'Não informado';
  }
}

export function getTodayISO() {
  return new Date().toISOString().split('T')[0];
}

export function getMonthYear(dateStr) {
  const d = dateStr ? toSafeDate(dateStr) : new Date();
  if (!d) return '—';
  try {
    return d.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
  } catch {
    return '—';
  }
}

export function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 19) return 'Boa tarde';
  return 'Boa noite';
}

export function calcProgress(inicio, fim) {
  if (!inicio || !fim) return 0;
  const start = toSafeDate(inicio)?.getTime();
  const end = toSafeDate(fim)?.getTime();
  if (!start || !end || end <= start) return 0;
  const now = Date.now();
  if (now <= start) return 0;
  if (now >= end) return 100;
  return Math.round(((now - start) / (end - start)) * 100);
}
