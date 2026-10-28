export const OBRA_STATUS = [
  'Aguardando confirmação',
  'Aguardando início',
  'Em andamento',
  'Pausada',
  'Aguardando pagamento',
  'Encerrada',
  'Cancelada',
];

export const OBRA_STATUS_DEFAULT = 'Aguardando confirmação';

const LEGACY_STATUS_MAP = {
  Parada: 'Pausada',
  Concluída: 'Encerrada',
  Concluida: 'Encerrada',
};

function foldStatusKey(status) {
  return String(status ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

const STATUS_FOLD_MAP = (() => {
  const map = new Map();
  OBRA_STATUS.forEach((status) => map.set(foldStatusKey(status), status));
  Object.entries(LEGACY_STATUS_MAP).forEach(([legacy, canonical]) => {
    map.set(foldStatusKey(legacy), canonical);
  });
  return map;
})();

export const OBRA_STATUS_VARIANTS = {
  'Aguardando confirmação': 'warning',
  'Aguardando início': 'default',
  'Em andamento': 'primary',
  Pausada: 'orange',
  'Aguardando pagamento': 'purple',
  Encerrada: 'success',
  Cancelada: 'danger',
};

export function normalizeObraStatus(status) {
  if (status == null || status === '') return OBRA_STATUS_DEFAULT;
  return STATUS_FOLD_MAP.get(foldStatusKey(status)) || OBRA_STATUS_DEFAULT;
}

export function isValidObraStatus(status) {
  return OBRA_STATUS.includes(normalizeObraStatus(status));
}

export function getObraStatusVariant(status) {
  return OBRA_STATUS_VARIANTS[normalizeObraStatus(status)] || 'default';
}

export function isObraOperational(status) {
  const normalized = normalizeObraStatus(status);
  return normalized !== 'Encerrada' && normalized !== 'Cancelada';
}

export function isObraInProgress(status) {
  return normalizeObraStatus(status) === 'Em andamento';
}

export function isObraConcluida(status) {
  return normalizeObraStatus(status) === 'Encerrada';
}

function grupoOrdenacaoObra(obra) {
  if (isObraInProgress(obra?.estado)) return 0;
  if (isObraConcluida(obra?.estado)) return 1;
  return 2;
}

/** Timestamp interno só para ordenar concluídas. Não preenche obras antigas. */
export function getConcluidaEmTimestamp(obra) {
  const raw = obra?.concluidaEm;
  if (raw == null || raw === '') return null;
  const value = Date.parse(raw);
  return Number.isFinite(value) ? value : null;
}

function compareConcluidas(a, b) {
  const timeA = getConcluidaEmTimestamp(a.obra);
  const timeB = getConcluidaEmTimestamp(b.obra);

  if (timeA != null && timeB != null && timeA !== timeB) {
    return timeB - timeA;
  }
  if (timeA != null && timeB == null) return -1;
  if (timeA == null && timeB != null) return 1;
  return a.index - b.index;
}

/**
 * Ordem padrão do layout:
 * 1. Em andamento (mantém a ordem relativa já existente)
 * 2. Concluídas: mais recentemente concluída primeiro; sem concluidaEm, mantém a ordem relativa
 * 3. Outros status no fim, sem intercalar os dois grupos acima
 */
export function sortObrasForDisplay(obras = []) {
  return (Array.isArray(obras) ? obras : [])
    .filter(Boolean)
    .map((obra, index) => ({ obra, index }))
    .sort((a, b) => {
      const grupo = grupoOrdenacaoObra(a.obra) - grupoOrdenacaoObra(b.obra);
      if (grupo !== 0) return grupo;
      if (isObraConcluida(a.obra?.estado)) return compareConcluidas(a, b);
      return a.index - b.index;
    })
    .map((item) => item.obra);
}

/** Grava concluidaEm só quando o status passa a Concluída e o campo ainda não existe. */
export function applyConcluidaEmOnStatusChange(obraAnterior, obraNova) {
  if (!obraNova) return obraNova;

  const statusAnterior = normalizeObraStatus(obraAnterior?.estado);
  const statusNovo = normalizeObraStatus(obraNova.estado);

  if (statusNovo !== 'Encerrada' || statusAnterior === 'Encerrada') {
    return obraNova;
  }

  if (obraNova.concluidaEm) {
    return obraNova;
  }

  return {
    ...obraNova,
    concluidaEm: new Date().toISOString(),
  };
}

/** Rótulo amigável — Encerrada aparece como Concluída na interface. */
export function getObraStatusDisplayLabel(status) {
  const normalized = normalizeObraStatus(status);
  if (normalized === 'Encerrada') return 'Concluída';
  return normalized;
}

export function canMarkObraAsConcluida(status) {
  const normalized = normalizeObraStatus(status);
  return normalized !== 'Encerrada' && normalized !== 'Cancelada';
}

export function markObraAsConcluida(obra, dataConclusao) {
  const statusAnterior = normalizeObraStatus(obra.estado);
  if (statusAnterior === 'Encerrada') {
    return obra;
  }

  const data = dataConclusao || new Date().toISOString().slice(0, 10);

  return {
    ...obra,
    estado: 'Encerrada',
    dataConclusao: obra.dataConclusao || data,
    concluidaEm: obra.concluidaEm || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    historicoStatus: [
      ...(obra.historicoStatus || []),
      createStatusHistoryEntry(statusAnterior, 'Encerrada'),
    ],
  };
}

export function countObrasConcluidasNoPeriodo(obras, inicio = '', fim = '') {
  return obras.filter((obra) => {
    if (!isObraConcluida(obra.estado)) return false;
    if (!obra.dataConclusao) return !inicio && !fim;
    if (inicio && obra.dataConclusao < inicio) return false;
    if (fim && obra.dataConclusao > fim) return false;
    return true;
  }).length;
}

export function countObrasByStatus(obras, status) {
  return (Array.isArray(obras) ? obras : [])
    .filter((obra) => obra && normalizeObraStatus(obra.estado) === status).length;
}

export function createStatusHistoryEntry(statusAnterior, statusNovo, motivoPausa = null) {
  const entry = {
    data: new Date().toISOString(),
    statusAnterior: normalizeObraStatus(statusAnterior),
    statusNovo: normalizeObraStatus(statusNovo),
  };

  if (motivoPausa) {
    entry.motivoPausa = motivoPausa;
  }

  return entry;
}

export function applyObraStatusChange(obra, newStatus, motivoPausa = undefined) {
  const statusAnterior = normalizeObraStatus(obra.estado);
  const statusNovo = normalizeObraStatus(newStatus);
  const nextMotivoPausa =
    statusNovo === 'Pausada' ? (motivoPausa ?? obra.motivoPausa ?? '').trim() : '';

  const statusChanged = statusAnterior !== statusNovo;
  const motivoChanged =
    statusNovo === 'Pausada' && nextMotivoPausa !== (obra.motivoPausa || '').trim();

  if (!statusChanged && !motivoChanged) {
    return obra;
  }

  const nextObra = {
    ...obra,
    estado: statusNovo,
    motivoPausa: nextMotivoPausa,
    updatedAt: new Date().toISOString(),
    historicoStatus: statusChanged
      ? [...(obra.historicoStatus || []), createStatusHistoryEntry(statusAnterior, statusNovo, nextMotivoPausa || null)]
      : obra.historicoStatus || [],
  };

  return applyConcluidaEmOnStatusChange(obra, nextObra);
}
