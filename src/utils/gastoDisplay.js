/** Rótulo principal do gasto (tipo/categoria). */
export function getGastoTipoLabel(gasto) {
  return gasto?.categoria?.trim() || 'Outros';
}

/** Quantidade formatada ou null se não aplicável. */
export function formatGastoQuantidade(gasto) {
  const q = gasto?.quantidade;
  if (q == null || q === '') return null;
  const n = Number(q);
  if (Number.isNaN(n) || n <= 0) return null;
  return Number.isInteger(n) ? String(n) : String(n);
}

export function getGastoDescricaoDisplay(gasto) {
  const desc = gasto?.descricao?.trim();
  return desc || null;
}

/**
 * Observações da listagem. A descrição livre tem coluna própria.
 */
export function getGastoObservacaoDisplay(gasto) {
  if (gasto?.observacao?.trim()) return gasto.observacao.trim();
  return null;
}

/** Descrição para histórico/integrações — preserva registos antigos com descricao. */
export function getGastoHistoricoDescricao(gasto) {
  if (gasto?.descricao?.trim()) return gasto.descricao.trim();
  const tipo = getGastoTipoLabel(gasto);
  const q = formatGastoQuantidade(gasto);
  if (q) return `${tipo} (×${q})`;
  return tipo;
}

export function getObraNome(obraId, obras = []) {
  if (!obraId) return null;
  return obras.find((o) => o.id === obraId)?.nome || null;
}
