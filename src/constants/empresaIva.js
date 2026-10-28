export const VEICULO_COMBUSTIVEL = {
  GASOLEO: 'gasoleo',
  GASOLINA: 'gasolina',
  ELETRICO: 'eletrico',
};

export const VEICULO_COMBUSTIVEL_LABELS = {
  [VEICULO_COMBUSTIVEL.GASOLEO]: 'Gasóleo',
  [VEICULO_COMBUSTIVEL.GASOLINA]: 'Gasolina',
  [VEICULO_COMBUSTIVEL.ELETRICO]: 'Elétrico',
};

export const VEICULO_SEED_KEYS = {
  VAN_GRANDE: 'veiculo-van-grande',
  VAN_PEQUENA: 'veiculo-van-pequena',
  CHAPOLIM: 'veiculo-chapolim',
  ZAFIRA: 'veiculo-zafira',
  VANZONA: 'veiculo-vanzona',
};

export const DOCUMENTO_STATUS = {
  SEM_DOCUMENTO: 'sem_documento',
  FATURA_ANEXADA: 'fatura_anexada',
  PRONTA_CONTABILIDADE: 'pronta_contabilidade',
  ENVIADA_CONTABILIDADE: 'enviada_contabilidade',
};

export const DOCUMENTO_STATUS_LABELS = {
  [DOCUMENTO_STATUS.SEM_DOCUMENTO]: 'Sem documento',
  [DOCUMENTO_STATUS.FATURA_ANEXADA]: 'Fatura anexada',
  [DOCUMENTO_STATUS.PRONTA_CONTABILIDADE]: 'Pronta para contabilidade',
  [DOCUMENTO_STATUS.ENVIADA_CONTABILIDADE]: 'Enviada para contabilidade',
};

export const IVA_REGRA_ORIGEM = {
  AUTOMATICA: 'automatica',
  VEICULO: 'veiculo',
  CONFIGURACAO: 'configuracao',
  FORNECEDOR: 'fornecedor',
  MANUAL: 'manual',
  POR_DETERMINAR: 'por_determinar',
};

export const IVA_REGRA_ORIGEM_LABELS = {
  [IVA_REGRA_ORIGEM.AUTOMATICA]: 'Regra automática',
  [IVA_REGRA_ORIGEM.VEICULO]: 'Perfil do veículo',
  [IVA_REGRA_ORIGEM.CONFIGURACAO]: 'Configuração fiscal',
  [IVA_REGRA_ORIGEM.FORNECEDOR]: 'Regra do fornecedor',
  [IVA_REGRA_ORIGEM.MANUAL]: 'Definida manualmente',
  [IVA_REGRA_ORIGEM.POR_DETERMINAR]: 'Por determinar',
};

export const CATEGORIA_CARREGAMENTO_ELETRICO = 'Carregamento / Eletricidade';
export const CATEGORIA_CARREGAMENTO_ELETRICO_ANTERIOR = 'Carregamento elétrico';
