import { validateRequired, validateNumber, validateTelefone, validateForm } from './validators';
import { generateId } from '../services/storageService';
import { FREQUENCIA_PAGAMENTO } from './pagamentoPeriodCalculations';
import { TIPO_FUNCIONARIO } from './funcionarioTipo';
import {
  TIPO_COBRANCA,
  TIPO_DESCONTO,
  getRegisteredParcelasCount,
  getTipoDesconto,
  getQuandoDescontar,
  defaultQuandoDescontarForTipo,
  isCommitmentParcelado,
  isDescontoManual,
  applyManualDescontoNow,
  normalizeQuandoDescontar,
  registerParcelaOnCommitment,
  persistTipoDescontoValue,
  resolveTipoCobranca,
  updateParcelaSettingsOnCommitment,
  validateCommitmentEdit,
} from './commitmentCalculations';

export const ALUGUEL_ESTADOS = ['Ativo', 'Inativo', 'Concluído'];

export const EMPTY_FUNCIONARIO_FORM = {
  nome: '',
  telefone: '',
  valorDiaria: '',
  estado: 'Ativo',
  tipo: TIPO_FUNCIONARIO.NORMAL,
  frequenciaPagamento: FREQUENCIA_PAGAMENTO.SEMANAL,
};

export function funcionarioToForm(funcionario) {
  if (!funcionario) return { ...EMPTY_FUNCIONARIO_FORM };

  return {
    nome: funcionario.nome || '',
    telefone: funcionario.telefone || '',
    valorDiaria: funcionario.valorDiaria != null ? String(funcionario.valorDiaria) : '',
    estado: funcionario.estado || 'Ativo',
    tipo: funcionario.tipo === TIPO_FUNCIONARIO.PARCEIRO ? TIPO_FUNCIONARIO.PARCEIRO : TIPO_FUNCIONARIO.NORMAL,
    frequenciaPagamento: funcionario.frequenciaPagamento || FREQUENCIA_PAGAMENTO.SEMANAL,
  };
}

export function formToFuncionarioPayload(form, existingFuncionario = null) {
  const tipo = form.tipo === TIPO_FUNCIONARIO.PARCEIRO ? TIPO_FUNCIONARIO.PARCEIRO : TIPO_FUNCIONARIO.NORMAL;
  const isParceiro = tipo === TIPO_FUNCIONARIO.PARCEIRO;
  return {
    nome: form.nome.trim(),
    telefone: form.telefone.trim(),
    valorDiaria: isParceiro ? 0 : parseFloat(form.valorDiaria),
    estado: form.estado,
    tipo,
    frequenciaPagamento: isParceiro ? null : form.frequenciaPagamento || FREQUENCIA_PAGAMENTO.SEMANAL,
    alugueis: existingFuncionario?.alugueis || [],
    descontosMensais: existingFuncionario?.descontosMensais || [],
  };
}

export function validateFuncionarioForm(form) {
  const isParceiro = form.tipo === TIPO_FUNCIONARIO.PARCEIRO;
  return validateForm({
    nome: validateRequired(form.nome, 'Nome'),
    valorDiaria: isParceiro ? null : validateNumber(form.valorDiaria, 'Valor da diária', 0.01),
    telefone: validateTelefone(form.telefone),
  });
}

export function isFuncionarioFormDirty(form, initialForm) {
  return JSON.stringify(form) !== JSON.stringify(initialForm);
}

export function buildFuncionarioUpdate(funcionario, form) {
  return {
    ...funcionario,
    ...formToFuncionarioPayload(form, funcionario),
    updatedAt: new Date().toISOString(),
  };
}

function normalizeCommitmentPayload(data, existingItem = null) {
  const tipoDesconto = persistTipoDescontoValue(data.tipoDesconto, existingItem);
  const quandoDescontar = normalizeQuandoDescontar(
    data.quandoDescontar,
    existingItem
      ? getQuandoDescontar(existingItem)
      : defaultQuandoDescontarForTipo(tipoDesconto)
  );
  const tipoCobranca = resolveTipoCobranca({
    tipoDesconto,
    quandoDescontar,
    tipoCobranca: data.tipoCobranca,
    totalParcelas: data.totalParcelas ?? existingItem?.totalParcelas,
  });

  const descricao = (data.descricao || data.motivo || '').trim();
  const dataInicio = data.dataInicio || data.data || existingItem?.dataInicio || existingItem?.data || null;
  const base = {
    descricao,
    tipoCobranca,
    tipoDesconto,
    valorMensal: parseFloat(data.valorMensal || data.valorParcela || data.valor || 0),
    estado: data.estado || (tipoCobranca === TIPO_COBRANCA.UNICO ? 'Pendente' : 'Ativo'),
    historicoDescontos: existingItem?.historicoDescontos || [],
    quandoDescontar,
  };

  if (tipoCobranca === TIPO_COBRANCA.PARCELADO) {
    const totalParcelas = parseInt(data.totalParcelas, 10);
    const descontadas = parseInt(data.parcelaAtual, 10);
    const registradas = existingItem ? getRegisteredParcelasCount(existingItem) : 0;
    const parcelasDescontadas = Number.isNaN(descontadas)
      ? registradas
      : Math.max(0, descontadas);
    const valorParcela = parseFloat(data.valorMensal || data.valorParcela || 0);
    const valorTotal = parseFloat(data.valorTotal);
    const resolvedTotal =
      Number.isFinite(valorTotal) && valorTotal > 0
        ? valorTotal
        : Number.isFinite(valorParcela) && totalParcelas > 0
          ? Math.round(valorParcela * totalParcelas * 100) / 100
          : existingItem?.valorTotal || null;
    const proximaParcela =
      parcelasDescontadas >= totalParcelas
        ? totalParcelas
        : Math.max(parcelasDescontadas, registradas) + 1;
    const tipoParcelado =
      getTipoDesconto({ tipoDesconto }) === TIPO_DESCONTO.ALUGUEL
        ? persistTipoDescontoValue(TIPO_DESCONTO.ALUGUEL, existingItem)
        : persistTipoDescontoValue(TIPO_DESCONTO.EMPRESTIMO, existingItem);

    return {
      ...base,
      tipoDesconto: tipoParcelado,
      valorMensal: valorParcela,
      valorTotal: resolvedTotal,
      dataInicio,
      dataFim: null,
      observacao: data.observacao || existingItem?.observacao || '',
      totalParcelas,
      parcelaAtual: proximaParcela,
      historicoParcelas: existingItem?.historicoParcelas || [],
      estado:
        registradas >= totalParcelas || parcelasDescontadas >= totalParcelas
          ? 'Concluído'
          : data.estado === 'Concluído' && registradas < totalParcelas
            ? 'Ativo'
            : data.estado || 'Ativo',
    };
  }

  if (tipoCobranca === TIPO_COBRANCA.UNICO) {
    const jaDescontado =
      (existingItem?.historicoDescontos || []).some((entry) => entry.status === 'descontado') ||
      data.estado === 'Descontado' ||
      data.estado === 'Concluído';

    return {
      ...base,
      data: dataInicio,
      dataInicio,
      dataFim: existingItem?.dataFim || null,
      observacao: data.observacao || existingItem?.observacao || '',
      totalParcelas: existingItem?.totalParcelas ?? null,
      parcelaAtual: existingItem?.parcelaAtual ?? null,
      historicoParcelas: existingItem?.historicoParcelas || [],
      estado: jaDescontado ? 'Descontado' : 'Pendente',
    };
  }

  if (getTipoDesconto({ tipoDesconto }) === TIPO_DESCONTO.ALUGUEL) {
    const estadoAluguel = data.estado === 'Inativo' || data.estado === 'Encerrado' ? 'Inativo' : 'Ativo';
    return {
      ...base,
      dataInicio,
      dataFim: data.dataFim || existingItem?.dataFim || null,
      observacao: data.observacao || existingItem?.observacao || '',
      totalParcelas: existingItem?.totalParcelas ?? null,
      parcelaAtual: existingItem?.parcelaAtual ?? null,
      historicoParcelas: existingItem?.historicoParcelas || [],
      estado: estadoAluguel,
    };
  }

  const estadoMensal =
    data.estado === 'Inativo' || data.estado === 'Encerrado'
      ? 'Encerrado'
      : data.estado || 'Ativo';

  return {
    ...base,
    dataInicio,
    dataFim: data.dataFim || existingItem?.dataFim || null,
    observacao: data.observacao || existingItem?.observacao || '',
    totalParcelas: existingItem?.totalParcelas ?? null,
    parcelaAtual: existingItem?.parcelaAtual ?? null,
    historicoParcelas: existingItem?.historicoParcelas || [],
    estado: estadoMensal,
  };
}

function updateCommitmentList(list, id, data) {
  return (list || []).map((item) => {
    if (item.id !== id) return item;

    const validation = validateCommitmentEdit(item, data);
    if (!validation.isValid) {
      throw new Error(validation.message);
    }

    return {
      ...item,
      ...normalizeCommitmentPayload(data, item),
      updatedAt: new Date().toISOString(),
    };
  });
}

function mapCommitmentById(list, id, mapper) {
  return (list || []).map((item) => {
    if (item.id !== id) return item;
    const result = mapper(item);
    if (result.error) throw new Error(result.error);
    return result.item;
  });
}

export function addAluguelToFuncionario(funcionario, data) {
  const aluguel = {
    id: generateId(),
    ...normalizeCommitmentPayload(data),
    createdAt: new Date().toISOString(),
  };

  return {
    ...funcionario,
    alugueis: [...(funcionario.alugueis || []), aluguel],
    updatedAt: new Date().toISOString(),
  };
}

export function updateAluguelOnFuncionario(funcionario, aluguelId, data) {
  return {
    ...funcionario,
    alugueis: updateCommitmentList(funcionario.alugueis, aluguelId, data),
    updatedAt: new Date().toISOString(),
  };
}

export function registerAluguelParcela(funcionario, aluguelId, details = {}) {
  return {
    ...funcionario,
    alugueis: mapCommitmentById(funcionario.alugueis, aluguelId, (item) =>
      isDescontoManual(item)
        ? applyManualDescontoNow(item, details)
        : registerParcelaOnCommitment(item, details)
    ),
    updatedAt: new Date().toISOString(),
  };
}

export function updateAluguelParcelaAtual(funcionario, aluguelId, parcelaAtual) {
  return updateAluguelParcelaSettings(funcionario, aluguelId, { parcelaAtual });
}

export function updateAluguelParcelaSettings(funcionario, aluguelId, settings) {
  return {
    ...funcionario,
    alugueis: mapCommitmentById(funcionario.alugueis, aluguelId, (item) =>
      updateParcelaSettingsOnCommitment(item, {
        parcelaAtual: settings.parcelaAtual ?? item.parcelaAtual,
        totalParcelas: settings.totalParcelas ?? item.totalParcelas,
      })
    ),
    updatedAt: new Date().toISOString(),
  };
}

export function deleteAluguelFromFuncionario(funcionario, aluguelId) {
  return {
    ...funcionario,
    alugueis: (funcionario.alugueis || []).filter((item) => item.id !== aluguelId),
    updatedAt: new Date().toISOString(),
  };
}

export function addDescontoToFuncionario(funcionario, data) {
  const desconto = {
    id: generateId(),
    ...normalizeCommitmentPayload(data),
    createdAt: new Date().toISOString(),
  };

  return {
    ...funcionario,
    descontosMensais: [...(funcionario.descontosMensais || []), desconto],
    updatedAt: new Date().toISOString(),
  };
}

export function updateDescontoOnFuncionario(funcionario, descontoId, data) {
  return {
    ...funcionario,
    descontosMensais: updateCommitmentList(funcionario.descontosMensais, descontoId, data),
    updatedAt: new Date().toISOString(),
  };
}

export function registerDescontoParcela(funcionario, descontoId, details = {}) {
  return {
    ...funcionario,
    descontosMensais: mapCommitmentById(funcionario.descontosMensais, descontoId, (item) =>
      isDescontoManual(item)
        ? applyManualDescontoNow(item, details)
        : registerParcelaOnCommitment(item, details)
    ),
    updatedAt: new Date().toISOString(),
  };
}

export function registerManualDescontoOnFuncionario(funcionario, descontoId, details = {}) {
  const inDescontos = (funcionario.descontosMensais || []).some((item) => item.id === descontoId);
  if (inDescontos) {
    return registerDescontoParcela(funcionario, descontoId, details);
  }

  const inAlugueis = (funcionario.alugueis || []).some((item) => item.id === descontoId);
  if (inAlugueis) {
    return registerAluguelParcela(funcionario, descontoId, details);
  }

  throw new Error('Desconto não encontrado.');
}

export function updateDescontoParcelaAtual(funcionario, descontoId, parcelaAtual) {
  return updateDescontoParcelaSettings(funcionario, descontoId, { parcelaAtual });
}

export function updateDescontoParcelaSettings(funcionario, descontoId, settings) {
  return {
    ...funcionario,
    descontosMensais: mapCommitmentById(funcionario.descontosMensais, descontoId, (item) =>
      updateParcelaSettingsOnCommitment(item, {
        parcelaAtual: settings.parcelaAtual ?? item.parcelaAtual,
        totalParcelas: settings.totalParcelas ?? item.totalParcelas,
      })
    ),
    updatedAt: new Date().toISOString(),
  };
}

export function deleteDescontoFromFuncionario(funcionario, descontoId) {
  return {
    ...funcionario,
    descontosMensais: (funcionario.descontosMensais || []).filter((item) => item.id !== descontoId),
    updatedAt: new Date().toISOString(),
  };
}

export function persistFuncionarioForm(form, { mode, funcionario, actions }) {
  const { addFuncionario, updateFuncionario } = actions;

  if (mode === 'create') {
    return addFuncionario(formToFuncionarioPayload(form));
  }

  const updated = buildFuncionarioUpdate(funcionario, form);
  updateFuncionario(updated);
  return updated;
}

export function getFuncionarioDeleteSummary(
  funcionarioId,
  { diarias, valoresAcerto = [], pagamentos, funcionarios, fechamentosPagamento = [] }
) {
  const funcionario = funcionarios.find((f) => f.id === funcionarioId);
  const counts = {
    diarias: diarias.filter((d) => d.funcionarioId === funcionarioId).length,
    valoresAcerto: valoresAcerto.filter((v) => v.funcionarioId === funcionarioId).length,
    fechamentos: fechamentosPagamento.filter((f) => f.funcionarioId === funcionarioId).length,
    pagamentos: pagamentos.filter(
      (p) =>
        funcionario &&
        p.tipo === 'Pagamento a funcionário' &&
        p.pessoaRelacionada === funcionario.nome
    ).length,
    alugueis: (funcionario?.alugueis || []).length,
    descontosMensais: (funcionario?.descontosMensais || []).length,
  };

  const total =
    counts.diarias +
    counts.valoresAcerto +
    counts.fechamentos +
    counts.pagamentos +
    counts.alugueis +
    counts.descontosMensais;

  return { counts, total, hasFinancialRecords: total > 0 };
}

export { isCommitmentParcelado };
