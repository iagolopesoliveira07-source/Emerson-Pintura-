/** Gastos pagos por Fábio/Juliano não entram no IVA nem nos livros da Emerson. */
export function isGastoForaDoIvaEmerson(gasto) {
  const raw = String(gasto?.pagoPor || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return raw === 'fabio' || raw === 'juliano' || raw === 'parceiro' || raw === 'caixa' || raw.includes('caixa');
}

export function filterGastosIvaEmerson(gastos = []) {
  return (gastos || []).filter((gasto) => gasto && !isGastoForaDoIvaEmerson(gasto));
}
