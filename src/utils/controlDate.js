import { filterDiariasDaObra } from './diariaObraAlocacao';

/**
 * Data a partir da qual o controlo detalhado é considerado fiável.
 * Registos anteriores permanecem visíveis no histórico, mas são marcados como parciais
 * nos gráficos e indicadores de lucro.
 */
export function getDataInicioControle(configuracoes) {
  const raw = configuracoes?.dataInicioControle;
  if (!raw || typeof raw !== 'string') return null;
  const date = raw.trim().slice(0, 10);
  return date || null;
}

/** Combina filtro do utilizador com a data mínima de controlo. */
export function mergeDateRangeWithControl(dateRange = {}, dataInicioControle) {
  if (!dataInicioControle) return dateRange;

  const userStart = dateRange.startDate;
  const startDate =
    userStart && userStart > dataInicioControle ? userStart : dataInicioControle;

  return { ...dateRange, startDate };
}

function getItemDate(item) {
  const raw = item?.data;
  return raw ? String(raw).slice(0, 10) : null;
}

/** Registo de custo (gasto ou diária) anterior ao controlo detalhado ou sem data. */
export function isRegistoCustoParcial(item, dataInicioControle) {
  const date = getItemDate(item);
  if (!date) return true;
  if (dataInicioControle && date < dataInicioControle) return true;
  return false;
}

/**
 * Obra com dados financeiros parciais/históricos para gráficos de lucro.
 * Não altera nem esconde dados — apenas sinaliza incompletude.
 */
export function isObraComDadosParciais(obra, gastos, diarias, dataInicioControle) {
  if (!obra?.id) return false;
  const obraGastos = (gastos || []).filter((g) => g && g.obraId === obra.id);
  const obraDiarias = filterDiariasDaObra(diarias, obra.id);
  const registos = [...obraGastos, ...obraDiarias];

  if (registos.length === 0) return false;

  if (!dataInicioControle) {
    return registos.some((item) => !getItemDate(item));
  }

  return registos.some((item) => isRegistoCustoParcial(item, dataInicioControle));
}

export function formatDataInicioControleLabel(dataInicioControle) {
  if (!dataInicioControle) return null;
  const [y, m, d] = dataInicioControle.split('-');
  if (!y || !m || !d) return dataInicioControle;
  return `${d}/${m}/${y}`;
}
