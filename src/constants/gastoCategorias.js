/** Tipos padronizados para novos gastos (select). */
export const GASTO_CATEGORIAS = [
  'Material',
  'Material de Obra',
  'Alimentação',
  'Combustível',
  'Hospedagem',
  'Ferramentas',
  'Transporte',
  'Outros',
];

/** Categorias legadas ainda presentes em registos antigos. */
export const GASTO_CATEGORIAS_LEGADAS = [
  'Aluguel',
  'Salários / Diárias',
  'Impostos / Taxas',
  'Equipamentos',
  'Manutenção',
];

/** Categorias destacadas no resumo da página de Gastos. */
export const GASTO_RESUMO_CATEGORIAS = [
  'Material',
  'Alimentação',
  'Combustível',
  'Hospedagem',
  'Ferramentas',
  'Outros',
];

/** Variante visual do Badge por categoria. */
export const GASTO_CATEGORIA_VARIANTS = {
  Material: 'primary',
  'Material de Obra': 'primary',
  Alimentação: 'orange',
  Combustível: 'warning',
  Ferramentas: 'info',
  Transporte: 'purple',
  Hospedagem: 'info',
  Diárias: 'success',
  Aluguel: 'default',
  'Salários / Diárias': 'success',
  'Impostos / Taxas': 'danger',
  Equipamentos: 'primary',
  Manutenção: 'default',
  Outros: 'default',
};

/**
 * Inclui categorias dos gastos existentes sem alterar os registos.
 * Preserva categorias antigas (ex.: "Transporte") mesmo que não estejam na lista padrão.
 */
export function getCategoriasComDadosExistentes(gastos = [], { includeDiarias = false } = {}) {
  const extras = [...new Set((gastos || []).map((g) => g.categoria).filter(Boolean))];
  const merged = [...GASTO_CATEGORIAS, ...GASTO_CATEGORIAS_LEGADAS];
  if (includeDiarias && !merged.includes('Diárias')) {
    merged.push('Diárias');
  }
  extras.forEach((cat) => {
    if (!merged.includes(cat)) merged.push(cat);
  });
  return [...new Set(merged)];
}

export function getCategoriaBadgeVariant(categoria) {
  return GASTO_CATEGORIA_VARIANTS[categoria] || 'default';
}
