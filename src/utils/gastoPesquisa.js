import { getGastoValorAssinado } from './gastoDocumentoTipo';
import { getGastoDescricaoDisplay, getGastoObservacaoDisplay, getGastoTipoLabel } from './gastoDisplay';

export const ORDEM_GASTOS = {
  RECENTE: 'recente',
  ANTIGA: 'antiga',
  MAIOR: 'maior',
  MENOR: 'menor',
};

export const FILTRO_GASTOS_VAZIO = {
  texto: '',
  fornecedor: '',
  dataDe: '',
  dataAte: '',
  valorMin: '',
  valorMax: '',
};

function semAcento(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function parseValorFiltro(raw) {
  const text = String(raw || '').trim().replace(/€/g, '').replace(/\s/g, '');
  if (!text) return null;
  const normalized = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function dataDoGasto(gasto) {
  const data = String(gasto?.data || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : '';
}

function fornecedorDoGasto(gasto) {
  return semAcento(gasto?.fornecedorNome || gasto?.fornecedor || gasto?.estabelecimento || '');
}

function textoDoGasto(gasto) {
  return semAcento(
    [
      gasto?.fornecedorNome,
      gasto?.fornecedor,
      gasto?.estabelecimento,
      getGastoDescricaoDisplay(gasto),
      gasto?.descricao,
      getGastoTipoLabel(gasto),
      gasto?.categoria,
      getGastoObservacaoDisplay(gasto),
      gasto?.observacao,
    ]
      .filter(Boolean)
      .join(' ')
  );
}

export function filtrosGastosAtivos(filtros = {}) {
  return ['texto', 'fornecedor', 'dataDe', 'dataAte', 'valorMin', 'valorMax'].some((key) =>
    String(filtros[key] || '').trim()
  );
}

export function filtrarListaGastos(lista = [], filtros = {}) {
  const texto = semAcento(filtros.texto);
  const fornecedor = semAcento(filtros.fornecedor);
  const dataDe = String(filtros.dataDe || '').slice(0, 10);
  const dataAte = String(filtros.dataAte || '').slice(0, 10);
  const valorMin = parseValorFiltro(filtros.valorMin);
  const valorMax = parseValorFiltro(filtros.valorMax);

  return (lista || []).filter((gasto) => {
    if (!gasto) return false;
    if (texto && !textoDoGasto(gasto).includes(texto)) return false;
    if (fornecedor && !fornecedorDoGasto(gasto).includes(fornecedor)) return false;

    const data = dataDoGasto(gasto);
    if ((dataDe || dataAte) && !data) return false;
    if (dataDe && data < dataDe) return false;
    if (dataAte && data > dataAte) return false;

    if (valorMin != null || valorMax != null) {
      const valor = getGastoValorAssinado(gasto);
      if (valorMin != null && valor < valorMin - 0.001) return false;
      if (valorMax != null && valor > valorMax + 0.001) return false;
    }
    return true;
  });
}

export function ordenarListaGastos(lista = [], ordem = ORDEM_GASTOS.RECENTE) {
  const copy = [...(lista || [])];
  const data = (gasto) => dataDoGasto(gasto);
  const valor = (gasto) => getGastoValorAssinado(gasto);

  if (ordem === ORDEM_GASTOS.ANTIGA) {
    return copy.sort((a, b) => data(a).localeCompare(data(b)) || String(a.id || '').localeCompare(String(b.id || '')));
  }
  if (ordem === ORDEM_GASTOS.MAIOR) {
    return copy.sort((a, b) => valor(b) - valor(a) || data(b).localeCompare(data(a)));
  }
  if (ordem === ORDEM_GASTOS.MENOR) {
    return copy.sort((a, b) => valor(a) - valor(b) || data(b).localeCompare(data(a)));
  }
  return copy.sort((a, b) => data(b).localeCompare(data(a)) || String(b.id || '').localeCompare(String(a.id || '')));
}

export function totalListaGastos(lista = []) {
  const total = (lista || []).reduce((sum, gasto) => sum + getGastoValorAssinado(gasto), 0);
  return Math.round((total + Number.EPSILON) * 100) / 100;
}
