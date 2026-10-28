/** Categorias dos gastos da empresa, organizadas por grupo. Independentes das categorias de obra. */
export const GASTO_EMPRESA_GRUPOS = [
  {
    grupo: 'Veículos e deslocações',
    categorias: [
      'Via Verde / Portagens',
      'Combustível',
      'Carregamento / Eletricidade',
      'Manutenção e reparação de carrinhas',
      'Pneus',
      'Seguro das carrinhas',
      'Inspeção / IUC',
      'Parcelas / financiamento das carrinhas',
      'Aluguer de garagem',
    ],
  },
  {
    grupo: 'Instalações',
    categorias: [
      'Aluguer do galpão / armazém',
      'Eletricidade',
      'Água',
      'Internet / telefone',
    ],
  },
  {
    grupo: 'Funcionários',
    categorias: [
      'Salários',
      'Seguros dos funcionários',
      'Formação / documentação de funcionários',
      'Outros custos com funcionários',
    ],
  },
  {
    grupo: 'Impostos e obrigações',
    categorias: [
      'Segurança Social',
      'IRS / retenções',
      'IRC',
      'IMPIC',
      'Outros impostos / taxas',
    ],
  },
  {
    grupo: 'Empresa / administração',
    categorias: [
      'Contabilidade',
      'Despesas bancárias',
      'Software / aplicações',
      'Material de escritório',
      'Correios / serviços administrativos',
    ],
  },
  {
    grupo: 'Equipamentos',
    categorias: [
      'Compra de ferramentas',
      'Compra de equipamentos',
      'Manutenção / reparação de equipamentos',
    ],
  },
  {
    grupo: 'Seguros',
    categorias: [
      'Seguros gerais da empresa',
      'Outros seguros',
    ],
  },
  {
    grupo: 'Outros',
    categorias: ['Outras despesas da empresa'],
  },
];

export const GASTO_EMPRESA_CATEGORIAS_ADITIVAS = [
  { grupo: 'Funcionários', nome: 'Salários' },
  { grupo: 'Impostos e obrigações', nome: 'IMPIC' },
  { grupo: 'Veículos e deslocações', nome: 'Manutenção' },
  { grupo: 'Veículos e deslocações', nome: 'Transporte' },
  { grupo: 'Equipamentos', nome: 'Ferramentas' },
  { grupo: 'Empresa / administração', nome: 'Material' },
  { grupo: 'Outros', nome: 'Reparação' },
  { grupo: 'Veículos e deslocações', nome: 'Estacionamento' },
  { grupo: 'Veículos e deslocações', nome: 'Carregamento / Eletricidade' },
  { grupo: 'Empresa / administração', nome: 'Material de Obra' },
];

export const GASTO_EMPRESA_CATEGORIAS = GASTO_EMPRESA_GRUPOS.flatMap((grupo) => grupo.categorias);

function categoriasAnteriores(gastos = [], categoriaAtual = '') {
  const atuais = new Set(GASTO_EMPRESA_CATEGORIAS);
  const extras = [];
  (gastos || []).forEach((gasto) => {
    const cat = gasto?.categoria;
    if (cat && !atuais.has(cat) && !extras.includes(cat)) extras.push(cat);
  });
  if (categoriaAtual && !atuais.has(categoriaAtual) && !extras.includes(categoriaAtual)) {
    extras.push(categoriaAtual);
  }
  return extras;
}

/**
 * Grupos para o select. Categorias de gastos antigos que já não estão na lista
 * aparecem no fim, sem alterar os registos.
 */
export function getCategoriaGruposEmpresa(gastos = [], categoriaAtual = '') {
  const extras = categoriasAnteriores(gastos, categoriaAtual);
  if (extras.length === 0) return GASTO_EMPRESA_GRUPOS;
  return [
    ...GASTO_EMPRESA_GRUPOS,
    { grupo: 'Categorias anteriores', categorias: extras },
  ];
}

/** Lista plana: categorias novas + categorias já usadas em registos antigos. */
export function getCategoriasEmpresaComExistentes(gastos = []) {
  return [
    ...GASTO_EMPRESA_CATEGORIAS,
    ...categoriasAnteriores(gastos),
  ];
}
