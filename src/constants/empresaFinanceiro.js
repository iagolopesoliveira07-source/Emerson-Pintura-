export const DESPESA_NATUREZA = {
  SALARIO: 'salario',
  SEGURANCA_SOCIAL: 'seguranca_social',
  CONTABILIDADE: 'contabilidade',
  ALUGUER: 'aluguer',
  SEGURO: 'seguro',
  PRESTACAO: 'prestacao',
  IMPOSTO: 'imposto',
  VARIAVEL: 'variavel',
  RECUPERAR: 'recuperar',
  OUTRO: 'outro',
};

export const DESPESA_NATUREZA_LABELS = {
  [DESPESA_NATUREZA.SALARIO]: 'Salário',
  [DESPESA_NATUREZA.SEGURANCA_SOCIAL]: 'Segurança Social',
  [DESPESA_NATUREZA.CONTABILIDADE]: 'Contabilidade',
  [DESPESA_NATUREZA.ALUGUER]: 'Aluguer / garagem',
  [DESPESA_NATUREZA.SEGURO]: 'Seguro',
  [DESPESA_NATUREZA.PRESTACAO]: 'Prestação / parcelas',
  [DESPESA_NATUREZA.IMPOSTO]: 'Imposto / obrigação',
  [DESPESA_NATUREZA.VARIAVEL]: 'Despesa variável',
  [DESPESA_NATUREZA.RECUPERAR]: 'Valor a recuperar',
  [DESPESA_NATUREZA.OUTRO]: 'Outra',
};

export const DESPESA_PERIODICIDADE = {
  SEMANAL: 'semanal',
  MENSAL: 'mensal',
  TRIMESTRAL: 'trimestral',
  SEMESTRAL: 'semestral',
  ANUAL: 'anual',
  PARCELAS: 'parcelas',
  UNICA: 'unica',
};

export const DESPESA_PERIODICIDADE_LABELS = {
  [DESPESA_PERIODICIDADE.SEMANAL]: 'Semanal',
  [DESPESA_PERIODICIDADE.MENSAL]: 'Mensal',
  [DESPESA_PERIODICIDADE.TRIMESTRAL]: 'Trimestral',
  [DESPESA_PERIODICIDADE.SEMESTRAL]: 'Semestral',
  [DESPESA_PERIODICIDADE.ANUAL]: 'Anual',
  [DESPESA_PERIODICIDADE.PARCELAS]: 'Prestação (parcelas)',
  [DESPESA_PERIODICIDADE.UNICA]: 'Única',
};

export const CATEGORIA_VIA_VERDE = 'Via Verde / Portagens';
export const CATEGORIA_COMBUSTIVEL = 'Combustível';
export const CATEGORIA_MANUTENCAO = 'Manutenção e reparação de carrinhas';

export const VIA_VERDE_STATUS = {
  POR_CONFERIR: 'por_conferir',
  CONFERIDO: 'conferido',
  GERAL: 'geral',
};

export const VIA_VERDE_STATUS_LABELS = {
  [VIA_VERDE_STATUS.POR_CONFERIR]: 'Por conferir',
  [VIA_VERDE_STATUS.CONFERIDO]: 'Conferido',
  [VIA_VERDE_STATUS.GERAL]: 'Via Verde — Geral',
};

export const VALOR_RECUPERAR_STATUS = {
  PENDENTE: 'pendente',
  RECEBIDO: 'recebido',
};

export const RESUMO_DESPESA_GRUPOS = [
  { id: 'salarios', label: 'Salários', naturezas: [DESPESA_NATUREZA.SALARIO] },
  { id: 'ss', label: 'Segurança Social', naturezas: [DESPESA_NATUREZA.SEGURANCA_SOCIAL] },
  { id: 'contabilidade', label: 'Contabilidade', naturezas: [DESPESA_NATUREZA.CONTABILIDADE] },
  { id: 'garagem', label: 'Garagem', naturezas: [DESPESA_NATUREZA.ALUGUER] },
  { id: 'veiculos', label: 'Veículos', naturezas: [DESPESA_NATUREZA.PRESTACAO] },
  { id: 'combustivel', label: 'Combustível' },
  { id: 'viaVerde', label: 'Via Verde' },
  { id: 'manutencao', label: 'Manutenção' },
  { id: 'seguros', label: 'Seguros', naturezas: [DESPESA_NATUREZA.SEGURO] },
  { id: 'impostos', label: 'Impostos', naturezas: [DESPESA_NATUREZA.IMPOSTO] },
  { id: 'outras', label: 'Outros', naturezas: [DESPESA_NATUREZA.OUTRO] },
];

export const PROGRAMADA_GRUPOS_VISIVEIS = [
  { id: 'salarios', label: 'Salários', naturezas: [DESPESA_NATUREZA.SALARIO] },
  { id: 'ss', label: 'Segurança Social', naturezas: [DESPESA_NATUREZA.SEGURANCA_SOCIAL] },
  { id: 'contabilidade', label: 'Contabilidade', naturezas: [DESPESA_NATUREZA.CONTABILIDADE] },
  { id: 'garagem', label: 'Garagem', naturezas: [DESPESA_NATUREZA.ALUGUER] },
  { id: 'prestacoes', label: 'Prestações', naturezas: [DESPESA_NATUREZA.PRESTACAO] },
  { id: 'seguros', label: 'Seguros', naturezas: [DESPESA_NATUREZA.SEGURO] },
  { id: 'impostos', label: 'Impostos', naturezas: [DESPESA_NATUREZA.IMPOSTO] },
  { id: 'outras', label: 'Outras despesas recorrentes', naturezas: [DESPESA_NATUREZA.OUTRO, DESPESA_NATUREZA.VARIAVEL] },
];
