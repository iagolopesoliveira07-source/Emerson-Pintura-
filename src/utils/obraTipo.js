export const TIPO_OBRA = {
  NORMAL: 'normal',
  PARCERIA: 'parceria',
  CREDITO: 'credito',
  ESPECIAL_TAVIRA: 'especial_tavira',
};

export const TIPO_OBRA_LABEL = {
  [TIPO_OBRA.NORMAL]: 'Normal',
  [TIPO_OBRA.PARCERIA]: 'Parceria',
  [TIPO_OBRA.CREDITO]: 'Crédito',
  [TIPO_OBRA.ESPECIAL_TAVIRA]: 'Especial / Tavira',
};

export const TIPO_OBRA_OPTIONS = [
  { id: TIPO_OBRA.NORMAL, label: TIPO_OBRA_LABEL[TIPO_OBRA.NORMAL] },
  { id: TIPO_OBRA.PARCERIA, label: TIPO_OBRA_LABEL[TIPO_OBRA.PARCERIA] },
  { id: TIPO_OBRA.CREDITO, label: TIPO_OBRA_LABEL[TIPO_OBRA.CREDITO] },
  { id: TIPO_OBRA.ESPECIAL_TAVIRA, label: TIPO_OBRA_LABEL[TIPO_OBRA.ESPECIAL_TAVIRA] },
];

export function normalizeTipoObra(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === TIPO_OBRA.PARCERIA || raw === 'partnership') return TIPO_OBRA.PARCERIA;
  if (raw === TIPO_OBRA.CREDITO || raw === 'credit' || raw === 'credito_job') return TIPO_OBRA.CREDITO;
  if (
    raw === TIPO_OBRA.ESPECIAL_TAVIRA ||
    raw === 'especial' ||
    raw === 'tavira' ||
    raw === 'lodging_offset'
  ) {
    return TIPO_OBRA.ESPECIAL_TAVIRA;
  }
  if (raw === TIPO_OBRA.NORMAL || raw === 'conventional') return TIPO_OBRA.NORMAL;
  return null;
}

export function getTipoObraLabel(tipo) {
  return TIPO_OBRA_LABEL[tipo] || TIPO_OBRA_LABEL[TIPO_OBRA.NORMAL];
}
