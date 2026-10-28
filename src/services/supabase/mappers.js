export function mapObraToDb(obra, empresaId) {
  return {
    id: obra.id,
    empresa_id: empresaId,
    nome: obra.nome,
    cliente: obra.cliente,
    telefone: obra.telefone || '',
    morada: obra.morada || '',
    valor_contratado: obra.valorContratado ?? 0,
    data_inicio: obra.dataInicio || null,
    data_prevista_termino: obra.dataPrevistaTermino || null,
    estado: obra.estado,
    observacoes: obra.observacoes || '',
    funcionarios: obra.funcionarios || [],
    historico_alteracoes: obra.historicoAlteracoes || [],
    created_at: obra.createdAt || new Date().toISOString(),
    updated_at: obra.updatedAt || null,
  };
}

export function mapObraFromDb(row) {
  if (!row) return null;
  return {
    id: row.id,
    nome: row.nome,
    cliente: row.cliente,
    telefone: row.telefone,
    morada: row.morada,
    valorContratado: Number(row.valor_contratado),
    dataInicio: row.data_inicio,
    dataPrevistaTermino: row.data_prevista_termino,
    estado: row.estado,
    observacoes: row.observacoes,
    funcionarios: row.funcionarios || [],
    historicoAlteracoes: row.historico_alteracoes || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapFuncionarioToDb(func, empresaId) {
  return {
    id: func.id,
    empresa_id: empresaId,
    nome: func.nome,
    telefone: func.telefone || '',
    valor_diaria: func.valorDiaria,
    data_entrada: func.dataEntrada,
    estado: func.estado,
    observacoes: func.observacoes || '',
    created_at: func.createdAt || new Date().toISOString(),
    updated_at: func.updatedAt || null,
  };
}

export function mapFuncionarioFromDb(row) {
  if (!row) return null;
  return {
    id: row.id,
    nome: row.nome,
    telefone: row.telefone,
    valorDiaria: Number(row.valor_diaria),
    dataEntrada: row.data_entrada,
    estado: row.estado,
    observacoes: row.observacoes,
    // Campos locais (tipo parceiro) — se a coluna existir no futuro, passa a sincronizar
    tipo: row.tipo || 'normal',
    frequenciaPagamento: row.frequencia_pagamento || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapDiariaToDb(d, empresaId) {
  return {
    id: d.id,
    empresa_id: empresaId,
    funcionario_id: d.funcionarioId,
    obra_id: d.obraId,
    data: d.data,
    quantidade: d.quantidade,
    valor_diaria: d.valorDiaria,
    observacao: d.observacao || '',
    created_at: d.createdAt || new Date().toISOString(),
    updated_at: d.updatedAt || null,
  };
}

export function mapDiariaFromDb(row) {
  if (!row) return null;
  return {
    id: row.id,
    funcionarioId: row.funcionario_id,
    obraId: row.obra_id,
    data: row.data,
    quantidade: Number(row.quantidade),
    valorDiaria: Number(row.valor_diaria),
    observacao: row.observacao,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapAdiantamentoToDb(a, empresaId) {
  return {
    id: a.id,
    empresa_id: empresaId,
    funcionario_id: a.funcionarioId,
    data: a.data,
    valor: a.valor,
    motivo: a.motivo,
    observacao: a.observacao || '',
    created_at: a.createdAt || new Date().toISOString(),
  };
}

export function mapAdiantamentoFromDb(row) {
  if (!row) return null;
  return {
    id: row.id,
    funcionarioId: row.funcionario_id,
    data: row.data,
    valor: Number(row.valor),
    motivo: row.motivo,
    observacao: row.observacao,
    createdAt: row.created_at,
  };
}

export function mapEmprestimoToDb(e, empresaId) {
  return {
    id: e.id,
    empresa_id: empresaId,
    funcionario_id: e.funcionarioId,
    valor: e.valor,
    valor_pago: e.valorPago ?? 0,
    data: e.data,
    motivo: e.motivo,
    forma_pagamento: e.formaPagamento || '',
    observacoes: e.observacoes || '',
    estado: e.estado,
    created_at: e.createdAt || new Date().toISOString(),
  };
}

export function mapEmprestimoFromDb(row) {
  if (!row) return null;
  return {
    id: row.id,
    funcionarioId: row.funcionario_id,
    valor: Number(row.valor),
    valorPago: Number(row.valor_pago),
    data: row.data,
    motivo: row.motivo,
    formaPagamento: row.forma_pagamento,
    observacoes: row.observacoes,
    estado: row.estado,
    createdAt: row.created_at,
  };
}

export function mapGastoToDb(g, empresaId) {
  return {
    id: g.id,
    empresa_id: empresaId,
    descricao: g.descricao,
    categoria: g.categoria,
    valor: g.valor,
    data: g.data,
    obra_id: g.obraId || null,
    fornecedor: g.fornecedor || '',
    observacao: g.observacao || '',
    created_at: g.createdAt || new Date().toISOString(),
  };
}

export function mapGastoFromDb(row) {
  if (!row) return null;
  return {
    id: row.id,
    descricao: row.descricao,
    categoria: row.categoria,
    valor: Number(row.valor),
    data: row.data,
    obraId: row.obra_id,
    fornecedor: row.fornecedor,
    observacao: row.observacao,
    createdAt: row.created_at,
  };
}

export function mapPagamentoToDb(p, empresaId) {
  return {
    id: p.id,
    empresa_id: empresaId,
    tipo: p.tipo,
    descricao: p.descricao,
    valor: p.valor,
    data: p.data,
    obra_id: p.obraId || null,
    pessoa_relacionada: p.pessoaRelacionada || '',
    metodo_pagamento: p.metodoPagamento || '',
    observacao: p.observacao || '',
    created_at: p.createdAt || new Date().toISOString(),
  };
}

export function mapPagamentoFromDb(row) {
  if (!row) return null;
  return {
    id: row.id,
    tipo: row.tipo,
    descricao: row.descricao,
    valor: Number(row.valor),
    data: row.data,
    obraId: row.obra_id,
    pessoaRelacionada: row.pessoa_relacionada,
    metodoPagamento: row.metodo_pagamento,
    observacao: row.observacao,
    createdAt: row.created_at,
  };
}

export function mapEmpresaToConfiguracoes(empresa, profile) {
  return {
    nomeEmpresa: empresa.nome,
    moeda: empresa.moeda || 'EUR',
    nif: empresa.nif || '',
    morada: empresa.morada || '',
    telefone: empresa.telefone || '',
    email: empresa.email || '',
    utilizador: {
      nome: profile?.nome || '',
      email: profile?.email || empresa.email || '',
      cargo: profile?.cargo || 'Administrador',
    },
    preferencias: empresa.preferencias || { notificacoes: true, temaEscuro: false },
  };
}

export function mapConfiguracoesToEmpresa(config) {
  return {
    nome: config.nomeEmpresa,
    nif: config.nif,
    morada: config.morada,
    telefone: config.telefone,
    email: config.email,
    moeda: config.moeda,
    preferencias: config.preferencias,
  };
}
