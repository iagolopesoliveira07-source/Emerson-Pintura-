/** Regras padrão por fornecedor. Não substituem gastos já gravados. */
export const FORNECEDORES_REGRAS_CONHECIDAS = [
  {
    seedKey: 'fornecedor-bp',
    nome: 'BP',
    aliases: ['bp', 'bp portugal', 'bp express'],
    categoriaPadrao: 'Combustível',
    subcategoriaPadrao: 'Gasóleo simples',
    combustivelTipo: 'gasoleo',
    taxaIva: 23,
    percentagemIvaRecuperavel: 50,
  },
  {
    seedKey: 'fornecedor-galp-evologic',
    nome: 'GALP – Gasóleo Evologic',
    aliases: ['galp evologic', 'galp gasoleo evologic', 'galp - gasoleo evologic', 'galp gasóleo evologic', 'evologic'],
    categoriaPadrao: 'Combustível',
    subcategoriaPadrao: 'GALP Gasóleo Evologic',
    combustivelTipo: 'gasoleo',
    taxaIva: 23,
    percentagemIvaRecuperavel: 50,
  },
  {
    seedKey: 'fornecedor-galp',
    nome: 'GALP',
    aliases: ['galp', 'galp energia', 'galp frota'],
    categoriaPadrao: 'Combustível',
    subcategoriaPadrao: 'Gasóleo simples',
    combustivelTipo: 'gasoleo',
    taxaIva: 23,
    percentagemIvaRecuperavel: 50,
  },
  {
    seedKey: 'fornecedor-moev',
    nome: 'MOEV',
    aliases: ['moev'],
    categoriaPadrao: 'Combustível',
    subcategoriaPadrao: 'Gasóleo simples',
    combustivelTipo: 'gasoleo',
    taxaIva: 23,
    percentagemIvaRecuperavel: 50,
  },
  {
    seedKey: 'fornecedor-leroy-merlin',
    nome: 'Leroy Merlin',
    aliases: ['leroy merlin', 'leroymerlin', 'leroy'],
    categoriaPadrao: 'Material de Obra',
    subcategoriaPadrao: '',
    taxaIva: 23,
    percentagemIvaRecuperavel: 100,
  },
  {
    seedKey: 'fornecedor-cin',
    nome: 'CIN',
    aliases: ['cin', 'tintas cin'],
    categoriaPadrao: 'Material de Obra',
    subcategoriaPadrao: 'Tintas e materiais de pintura',
    taxaIva: 23,
    percentagemIvaRecuperavel: 100,
  },
  {
    seedKey: 'fornecedor-casas-peixoto',
    nome: 'Casas Peixoto',
    aliases: ['casas peixoto', 'casa peixoto'],
    categoriaPadrao: 'Material de Obra',
    subcategoriaPadrao: '',
    taxaIva: 23,
    percentagemIvaRecuperavel: 100,
  },
  {
    seedKey: 'fornecedor-foc',
    nome: 'FOC',
    aliases: ['foc'],
    categoriaPadrao: 'Material de Obra',
    subcategoriaPadrao: '',
    taxaIva: 23,
    percentagemIvaRecuperavel: 100,
  },
  {
    seedKey: 'fornecedor-tecofix',
    nome: 'Tecofix',
    aliases: ['tecofix'],
    categoriaPadrao: 'Material de Obra',
    subcategoriaPadrao: 'Ferragens, ferramentas e consumíveis',
    taxaIva: 23,
    percentagemIvaRecuperavel: 100,
  },
  {
    seedKey: 'fornecedor-delarobia',
    nome: 'Delarobia',
    aliases: ['delarobia'],
    categoriaPadrao: 'Material de Obra',
    subcategoriaPadrao: '',
    taxaIva: 23,
    percentagemIvaRecuperavel: 100,
  },
  {
    seedKey: 'fornecedor-nicolau-rosa',
    nome: 'Nicolau Rosa',
    aliases: ['nicolau rosa'],
    categoriaPadrao: 'Material de Obra',
    subcategoriaPadrao: '',
    taxaIva: 23,
    percentagemIvaRecuperavel: 100,
  },
  {
    seedKey: 'fornecedor-matemativerso',
    nome: 'Matemativerso',
    aliases: ['matemativerso'],
    categoriaPadrao: 'Material de Obra',
    subcategoriaPadrao: '',
    taxaIva: 23,
    percentagemIvaRecuperavel: 100,
  },
  {
    seedKey: 'fornecedor-lusa-vouga',
    nome: 'Lusa Vouga',
    aliases: ['lusa vouga'],
    categoriaPadrao: 'Material de Obra',
    subcategoriaPadrao: 'Materiais e ferragens',
    taxaIva: 23,
    percentagemIvaRecuperavel: 100,
  },
  {
    seedKey: 'fornecedor-maxmat',
    nome: 'MaxMat',
    aliases: ['maxmat', 'max mat'],
    categoriaPadrao: 'Material de Obra',
    subcategoriaPadrao: '',
    taxaIva: 23,
    percentagemIvaRecuperavel: 100,
  },
  {
    seedKey: 'fornecedor-rainha-das-chaves',
    nome: 'Rainha das Chaves',
    aliases: ['rainha das chaves'],
    categoriaPadrao: 'Material de Obra',
    subcategoriaPadrao: 'Chaves e ferragens',
    taxaIva: 23,
    percentagemIvaRecuperavel: 100,
  },
  {
    seedKey: 'fornecedor-matilagos',
    nome: 'Matilagos INIP LDA',
    aliases: ['matilagos inip lda', 'matilagos', 'inip lda', 'inip'],
    categoriaPadrao: 'Material de Obra',
    subcategoriaPadrao: '',
    taxaIva: 23,
    percentagemIvaRecuperavel: 100,
  },
  {
    seedKey: 'fornecedor-vrr',
    nome: 'VRR',
    aliases: ['vrr'],
    categoriaPadrao: 'Material de Obra',
    subcategoriaPadrao: '',
    taxaIva: 23,
    percentagemIvaRecuperavel: 100,
  },
  {
    seedKey: 'fornecedor-aguas-cascais',
    nome: 'Águas de Cascais',
    aliases: ['aguas de cascais', 'águas de cascais', 'aguas cascais'],
    categoriaPadrao: 'Água',
    subcategoriaPadrao: 'Água e saneamento',
    taxaIva: null,
    percentagemIvaRecuperavel: null,
    ivaVariavel: true,
  },
];

const MATERIAL_KEYWORDS = [
  'orla',
  'orlas',
  'pvc',
  'madeira',
  'tinta',
  'tintas',
  'ferragem',
  'ferragens',
  'ferramenta',
  'ferramentas',
  'bricolagem',
  'construcao',
  'construção',
  'consumivel',
  'consumiveis',
  'material de obra',
  'materiais de obra',
  'materiais de construcao',
  'materiais de construção',
];

function normalizeTextoRegra(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function isNomeProvavelMaterialObra(nome) {
  const key = normalizeTextoRegra(nome);
  if (!key) return false;
  return MATERIAL_KEYWORDS.some((palavra) => key.includes(normalizeTextoRegra(palavra)));
}

export function isDocumentoGasoleoSimples(value) {
  const key = normalizeTextoRegra(value);
  if (!key) return false;
  if (key.includes('evologic')) return true;
  if (key.includes('gasoleo simples')) return true;
  if (key.includes('galp') && key.includes('gasoleo')) return true;
  return false;
}

export function regraMaterialObraPorNome(nome) {
  return {
    nome,
    categoriaPadrao: 'Material de Obra',
    subcategoriaPadrao: '',
    taxaIva: 23,
    percentagemIvaRecuperavel: 100,
    ivaVariavel: false,
    combustivelTipo: '',
  };
}
