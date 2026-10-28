import {
  TIPO_COBRANCA,
  TIPO_DESCONTO,
  DESCONTO_MES_STATUS,
  getDescontoMesStatus,
  getSaldoRestanteEmprestimo,
  getTipoDesconto,
  getValorADescontarEsteMes,
  getValorDescontadoNoMes,
  getValorParcela,
  isCommitmentParcelado,
  mesAnoFromValue,
} from './commitmentCalculations';
import {
  getAcertoData,
  getAcertoGastos,
  getValorADevolver,
  getValorEntregue,
  isAcertoAcertado,
} from './acertoCalculations';

function normalizeName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function amountsClose(a, b) {
  return Math.abs((a || 0) - (b || 0)) < 0.009;
}

export function acertoJaRepresentadoEmDescontos(acerto, descontos = []) {
  if (!acerto) return false;

  return (descontos || []).some((item) => {
    if (item.id === acerto.id || item.sourceAcertoId === acerto.id) return true;

    if (acerto.legacySource === 'emprestimo' && isCommitmentParcelado(item)) {
      const total = item.valorTotal || getValorParcela(item) * (item.totalParcelas || 0);
      if (amountsClose(total, getValorEntregue(acerto))) return true;
    }

    if (getTipoDesconto(item) !== TIPO_DESCONTO.ADIANTAMENTO) return false;
    if (normalizeName(item.descricao) !== normalizeName(acerto.motivo)) return false;

    const valorDesconto = getValorParcela(item);
    return (
      amountsClose(valorDesconto, getValorEntregue(acerto)) ||
      amountsClose(valorDesconto, getValorADevolver(acerto))
    );
  });
}

export function mapAcertoToDescontoView(acerto) {
  const acertado = isAcertoAcertado(acerto);
  const aDevolver = getValorADevolver(acerto);
  const pendingDiscount = !acertado && aDevolver > 0;
  const valor = pendingDiscount
    ? aDevolver
    : acerto.acerto?.valorDevolvido || getValorEntregue(acerto);
  const data = getAcertoData(acerto) || acerto.acerto?.dataAcerto || null;
  const gastos = getAcertoGastos(acerto);
  const historicoDescontos = [];

  if (acertado && acerto.acerto) {
    historicoDescontos.push({
      id: `${acerto.id}-acerto`,
      mesAno: mesAnoFromValue(acerto.acerto.dataAcerto),
      data: acerto.acerto.dataAcerto,
      valor: acerto.acerto.valorDevolvido || 0,
      status: 'descontado',
      createdAt: acerto.acerto.createdAt,
    });
  }

  gastos.forEach((gasto) => {
    historicoDescontos.push({
      id: gasto.id,
      data: (gasto.createdAt || '').slice(0, 10),
      valor: gasto.valor,
      status: 'gasto',
      createdAt: gasto.createdAt,
      observacao: gasto.descricao,
    });
  });

  return {
    id: `acerto:${acerto.id}`,
    source: 'acerto',
    sourceAcertoId: acerto.id,
    tipoDesconto: TIPO_DESCONTO.ADIANTAMENTO,
    tipoCobranca: TIPO_COBRANCA.UNICO,
    quandoDescontar: 'unico',
    descricao: acerto.motivo || 'Adiantamento',
    valorMensal: valor,
    data,
    dataInicio: data,
    estado: pendingDiscount ? 'Pendente' : 'Descontado',
    historicoDescontos,
    historicoParcelas: [],
    acertoOriginal: acerto,
    createdAt: acerto.createdAt,
  };
}

export function listDescontosAdiantamentos(funcionario, valoresAcerto = [], referenceDate = new Date()) {
  const descontos = funcionario?.descontosMensais || [];
  const alugueis = funcionario?.alugueis || [];
  const coveredIds = new Set([
    ...descontos.map((item) => item.id),
    ...descontos.map((item) => item.sourceAluguelId).filter(Boolean),
  ]);

  const views = descontos.map((item) => ({ ...item, source: 'desconto' }));

  alugueis.forEach((item) => {
    if (!item || coveredIds.has(item.id)) return;
    views.push({
      ...item,
      source: 'aluguel',
      tipoDesconto: item.tipoDesconto || TIPO_DESCONTO.ALUGUEL,
    });
  });

  (valoresAcerto || [])
    .filter((item) => item && item.funcionarioId === funcionario?.id)
    .filter((item) => !acertoJaRepresentadoEmDescontos(item, [...descontos, ...alugueis]))
    .forEach((acerto) => {
      views.push(mapAcertoToDescontoView(acerto));
    });

  const mesAno = mesAnoFromValue(referenceDate);
  const pendentes = [];
  const descontadosEsteMes = [];
  const aguardando = [];
  const concluidos = [];

  views.forEach((item) => {
    const status = getDescontoMesStatus(item, referenceDate);
    if (status === DESCONTO_MES_STATUS.PENDENTE) pendentes.push(item);
    else if (status === DESCONTO_MES_STATUS.DESCONTADO) descontadosEsteMes.push(item);
    else if (status === DESCONTO_MES_STATUS.AGUARDANDO) aguardando.push(item);
    else concluidos.push(item);
  });

  const pendenteValor = pendentes.reduce(
    (sum, item) => sum + getValorADescontarEsteMes(item, referenceDate),
    0
  );
  const descontadoValor = [...descontadosEsteMes, ...concluidos].reduce((sum, item) => {
    const noMes = getValorDescontadoNoMes(item, mesAno);
    if (noMes > 0) return sum + noMes;
    return getDescontoMesStatus(item, referenceDate) === DESCONTO_MES_STATUS.DESCONTADO
      ? sum + getValorParcela(item)
      : sum;
  }, 0);
  const saldoEmprestimos = views
    .filter((item) => getTipoDesconto(item) === TIPO_DESCONTO.EMPRESTIMO)
    .reduce((sum, item) => sum + getSaldoRestanteEmprestimo(item), 0);

  return {
    items: [...pendentes, ...aguardando, ...descontadosEsteMes, ...concluidos],
    pendentes,
    descontadosEsteMes,
    aguardando,
    concluidos,
    mesAno,
    resumo: {
      pendenteValor,
      descontadoValor,
      saldoEmprestimos,
    },
  };
}
