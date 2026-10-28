import { CATEGORIA_VIA_VERDE, DESPESA_NATUREZA, DESPESA_PERIODICIDADE } from '../constants/empresaFinanceiro';
import { CATEGORIA_CARREGAMENTO_ELETRICO } from '../constants/empresaIva';
import {
  getProximaDataComDia,
  isSalarioPagoPorDiaria,
} from './empresaFinanceiroCalculations';

export const TIPOS_GASTO_RAPIDOS = [
  { id: 'combustivel', label: 'Combustível', categoria: 'Combustível' },
  { id: 'carregamento', label: CATEGORIA_CARREGAMENTO_ELETRICO, categoria: CATEGORIA_CARREGAMENTO_ELETRICO },
  { id: 'via_verde', label: 'Via Verde / Portagens', categoria: CATEGORIA_VIA_VERDE },
  { id: 'manutencao', label: 'Manutenção', categoria: 'Manutenção' },
  { id: 'material', label: 'Material', categoria: 'Material' },
  { id: 'ferramentas', label: 'Ferramentas', categoria: 'Ferramentas' },
  { id: 'transporte', label: 'Transporte', categoria: 'Transporte' },
  { id: 'estacionamento', label: 'Estacionamento', categoria: 'Estacionamento' },
  { id: 'seguro', label: 'Seguro', categoria: 'Seguros gerais da empresa' },
  { id: 'prestacao', label: 'Prestação', categoria: 'Parcelas / financiamento das carrinhas' },
  { id: 'ss', label: 'Segurança Social', categoria: 'Segurança Social' },
  { id: 'contabilidade', label: 'Contabilidade', categoria: 'Contabilidade' },
  { id: 'impostos', label: 'Impostos', categoria: 'Outros impostos / taxas' },
  { id: 'garagem', label: 'Garagem', categoria: 'Aluguer de garagem' },
  { id: 'outros', label: 'Outros', categoria: 'Outras despesas da empresa' },
];

const LAYOUTS = {
  combustivel: {
    campos: ['veiculo', 'valor', 'data', 'fornecedor', 'temIva', 'observacao', 'obra', 'anexo'],
    veiculoHint: 'Indique o veículo. O combustível conhecido é preenchido automaticamente.',
    veiculoObrigatorio: true,
    dataLabel: 'Data',
  },
  carregamento: {
    campos: ['veiculo', 'valor', 'data', 'fornecedor', 'temIva', 'observacao', 'obra', 'anexo'],
    veiculoHint: 'Indique o veículo elétrico.',
    veiculoObrigatorio: true,
    dataLabel: 'Data',
  },
  via_verde: {
    campos: ['valor', 'data', 'veiculo', 'viaVerdeEstado', 'fornecedor', 'temIva', 'anexo'],
    veiculoHint: 'Se ainda não souber o veículo, deixe Geral / Por conferir.',
    veiculoGeral: true,
    dataLabel: 'Data do débito',
  },
  manutencao: {
    campos: ['veiculo', 'valor', 'data', 'fornecedor', 'temIva', 'observacao', 'obra', 'anexo'],
    veiculoHint: 'Qual veículo foi intervencionado?',
    veiculoObrigatorio: true,
    dataLabel: 'Data',
  },
  material: {
    campos: ['fornecedor', 'valor', 'data', 'temIva', 'faturaEmpresa', 'obra', 'servico', 'observacao', 'anexo'],
    obraHint: 'Opcional. O mesmo gasto aparece na obra, sem duplicar.',
    dataLabel: 'Data',
  },
  ferramentas: {
    campos: ['obra', 'valor', 'data', 'veiculo', 'observacao'],
    veiculoHint: 'Opcional',
    obraHint: 'Opcional',
    dataLabel: 'Data',
  },
  transporte: {
    campos: ['valor', 'data', 'veiculo', 'obra', 'observacao'],
    veiculoHint: 'Opcional',
    dataLabel: 'Data',
  },
  estacionamento: {
    campos: ['veiculo', 'valor', 'data', 'observacao'],
    veiculoHint: 'Opcional',
    dataLabel: 'Data',
  },
  seguro: {
    campos: ['veiculo', 'valor', 'data', 'observacao'],
    veiculoHint: 'Opcional. Se escolher um veículo com seguro cadastrado, o valor é preenchido.',
    dataLabel: 'Data',
  },
  prestacao: {
    campos: ['veiculo', 'valor', 'data', 'observacao'],
    veiculoHint: 'Escolha o veículo para preencher a prestação conhecida.',
    dataLabel: 'Data',
  },
  salario: {
    campos: ['valor', 'data', 'observacao'],
    dataLabel: 'Data',
  },
  ss: {
    campos: ['valor', 'data', 'observacao'],
    dataLabel: 'Data',
  },
  contabilidade: {
    campos: ['valor', 'data', 'observacao'],
    dataLabel: 'Data',
  },
  garagem: {
    campos: ['local', 'valor', 'data', 'observacao'],
    dataLabel: 'Data',
  },
  eletricidade: {
    campos: ['local', 'fornecedor', 'valor', 'data', 'temIva', 'observacao', 'anexo'],
    dataLabel: 'Data',
  },
  instalacao: {
    campos: ['local', 'fornecedor', 'valor', 'data', 'temIva', 'observacao', 'anexo'],
    dataLabel: 'Data',
  },
  impostos: {
    campos: ['valor', 'data', 'observacao'],
    dataLabel: 'Data',
  },
  agua: {
    campos: ['local', 'fornecedor', 'valor', 'data', 'temIva', 'observacao', 'anexo'],
    dataLabel: 'Data da fatura',
  },
  outros: {
    campos: ['descricao', 'categoriaExtra', 'valor', 'data', 'veiculo', 'obra', 'pagoPor', 'observacao'],
    veiculoHint: 'Opcional',
    obraHint: 'Opcional',
    dataLabel: 'Data',
    exigeDescricao: true,
  },
};

export function inferTipoRapido(categoria) {
  const exact = TIPOS_GASTO_RAPIDOS.find((item) => item.categoria === categoria);
  if (exact) return exact.id;

  const nome = String(categoria || '').toLowerCase();
  if (nome.includes('via verde') || nome.includes('portagen')) return 'via_verde';
  if (nome.includes('carregamento')) return 'carregamento';
  if (nome.includes('combust')) return 'combustivel';
  if (nome.includes('manuten')) return 'manutencao';
  if (nome.includes('material')) return 'material';
  if (nome.includes('ferramenta')) return 'ferramentas';
  if (nome.includes('transporte')) return 'transporte';
  if (nome.includes('estacionamento')) return 'estacionamento';
  if (nome.includes('alimenta')) return 'outros';
  if (nome.includes('seguro')) return 'seguro';
  if (nome.includes('parcela') || nome.includes('financiamento') || nome.includes('prestação') || nome.includes('prestacao')) {
    return 'prestacao';
  }
  if (nome.includes('salário') || nome.includes('salario')) return 'salario';
  if (nome.includes('segurança social') || nome.includes('seguranca social')) return 'ss';
  if (nome.includes('contabilidade')) return 'contabilidade';
  if (nome.includes('eletric')) return 'eletricidade';
  if (nome.includes('água') || nome.includes('agua') || nome.includes('saneamento')) return 'agua';
  if (nome.includes('internet') || nome.includes('telefone')) return 'instalacao';
  if (nome.includes('galpao') || nome.includes('galpão') || nome.includes('armazem') || nome.includes('armazém')) {
    return 'instalacao';
  }
  if (nome.includes('garagem')) return 'garagem';
  if (nome.includes('irc') || nome.includes('irs') || nome.includes('impic') || nome.includes('imposto')) return 'impostos';
  return 'outros';
}

const APELIDOS_CATEGORIA = {
  Eletricidade: ['luz', 'energia', 'electricidade'],
  'Carregamento / Eletricidade': ['carregamento', 'carro eletrico'],
  'Aluguer de garagem': ['garagem', 'renda da garagem'],
  'Aluguer do galpão / armazém': ['galpao', 'armazem', 'galpão', 'armazém'],
  'Via Verde / Portagens': ['via verde', 'portagem', 'portagens'],
  Combustível: ['combustivel', 'gasoleo', 'gasolina', 'gasóleo'],
  'Seguro das carrinhas': ['seguro'],
  'Seguros gerais da empresa': ['seguro'],
  'Outros seguros': ['seguro'],
  'Parcelas / financiamento das carrinhas': ['prestacao', 'parcela', 'financiamento'],
  'Segurança Social': ['seguranca social', 'seg social'],
  'IRS / retenções': ['irs', 'retencao', 'retenção'],
  IRC: ['irc'],
  IMPIC: ['impic'],
  'Outros impostos / taxas': ['imposto', 'taxa'],
  'Outras despesas da empresa': ['outros', 'outro'],
};

export function normalizarBuscaCategoria(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function categoriaCombinaBusca(nome, query) {
  const q = normalizarBuscaCategoria(query);
  if (!q) return true;
  if (normalizarBuscaCategoria(nome).includes(q)) return true;
  const apelidos = APELIDOS_CATEGORIA[nome] || [];
  return apelidos.some((item) => normalizarBuscaCategoria(item).includes(q));
}

export function getLayoutTipoRapido(tipoId) {
  return LAYOUTS[tipoId] || LAYOUTS.outros;
}

export function getTipoRapidoById(tipoId) {
  return TIPOS_GASTO_RAPIDOS.find((item) => item.id === tipoId) || null;
}

export function layoutTemCampo(layout, campo) {
  return Boolean(layout?.campos?.includes(campo));
}

function programadasVisiveis(programadas = []) {
  return (programadas || []).filter((item) => item.ativo !== false && !isSalarioPagoPorDiaria(item));
}

function sugestaoDeProgramada(programada) {
  if (!programada) return null;
  const periodicidade =
    programada.periodicidade === DESPESA_PERIODICIDADE.PARCELAS
      ? 'mensal'
      : programada.periodicidade === DESPESA_PERIODICIDADE.UNICA
        ? ''
        : programada.periodicidade;
  const data = programada.diaVencimento ? getProximaDataComDia(programada.diaVencimento) : '';
  const partes = [`${programada.titulo}`];
  if (programada.valor != null) partes.push(`${programada.valor} €`);
  if (programada.diaVencimento) partes.push(`dia ${programada.diaVencimento}`);
  return {
    valor: programada.valor != null ? String(programada.valor) : '',
    categoria: programada.categoria || '',
    descricao: programada.titulo || '',
    natureza: programada.natureza || '',
    despesaProgramadaId: programada.id,
    veiculoId: programada.veiculoId || '',
    periodicidade: periodicidade || '',
    data: data || '',
    hint: `Preenchido a partir de ${partes.filter(Boolean).join(' · ')}`,
  };
}

export function sugerirFormularioTipoRapido(tipoId, { programadas = [], veiculoId = '' } = {}) {
  const visiveis = programadasVisiveis(programadas);

  if (tipoId === 'garagem') {
    return sugestaoDeProgramada(visiveis.find((item) => item.natureza === DESPESA_NATUREZA.ALUGUER));
  }
  if (tipoId === 'ss') {
    return sugestaoDeProgramada(visiveis.find((item) => item.natureza === DESPESA_NATUREZA.SEGURANCA_SOCIAL));
  }
  if (tipoId === 'contabilidade') {
    return sugestaoDeProgramada(visiveis.find((item) => item.natureza === DESPESA_NATUREZA.CONTABILIDADE));
  }
  if (tipoId === 'salario') {
    const salarios = visiveis.filter((item) => item.natureza === DESPESA_NATUREZA.SALARIO);
    return salarios.length === 1 ? sugestaoDeProgramada(salarios[0]) : null;
  }
  if (tipoId === 'prestacao') {
    if (!veiculoId) return null;
    return sugestaoDeProgramada(
      visiveis.find((item) => item.natureza === DESPESA_NATUREZA.PRESTACAO && item.veiculoId === veiculoId)
    );
  }
  if (tipoId === 'seguro') {
    if (!veiculoId) return null;
    return sugestaoDeProgramada(
      visiveis.find((item) => item.natureza === DESPESA_NATUREZA.SEGURO && item.veiculoId === veiculoId)
    );
  }
  return null;
}
