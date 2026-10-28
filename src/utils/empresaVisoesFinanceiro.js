import { formatCurrency, formatDate } from './formatters';
import { getGastoEmpresaValor } from './gastoEmpresaCalculations';
import { roundMoney } from './ivaCalculations';
import {
  DESPESA_NATUREZA,
  DESPESA_PERIODICIDADE,
  formatPeriodicidadeVisivel,
  formatTituloHomeFixo,
  getCoberturaMeses,
  getEquivalenteMensal,
  getGastosDaProgramada,
  getPeriodicidadeMeses,
  getPeriodoCoberto,
  getYearMonth,
  isCategoriaCombustivel,
  isCategoriaManutencao,
  isCategoriaViaVerde,
  isDespesaMensalRecorrente,
  isGastoVariavelLancamento,
  isRecorrenciaConfirmada,
  isSalarioPagoPorDiaria,
} from './empresaFinanceiroCalculations';

const GRUPOS_CUSTO = [
  { id: 'funcionarios', label: 'Funcionários', naturezas: [DESPESA_NATUREZA.SALARIO] },
  { id: 'encargos', label: 'Encargos', naturezas: [DESPESA_NATUREZA.SEGURANCA_SOCIAL] },
  { id: 'estrutura', label: 'Estrutura', naturezas: [DESPESA_NATUREZA.CONTABILIDADE, DESPESA_NATUREZA.ALUGUER] },
  { id: 'veiculos', label: 'Veículos', naturezas: [DESPESA_NATUREZA.PRESTACAO] },
  { id: 'seguros', label: 'Seguros — equivalente mensal', naturezas: [DESPESA_NATUREZA.SEGURO] },
  { id: 'impostos', label: 'Impostos / Obrigações', naturezas: [DESPESA_NATUREZA.IMPOSTO] },
];

const GRUPOS_CAIXA = [
  { id: 'funcionarios', label: 'Funcionários', naturezas: [DESPESA_NATUREZA.SALARIO] },
  { id: 'encargos', label: 'Encargos', naturezas: [DESPESA_NATUREZA.SEGURANCA_SOCIAL] },
  { id: 'estrutura', label: 'Estrutura', naturezas: [DESPESA_NATUREZA.CONTABILIDADE, DESPESA_NATUREZA.ALUGUER] },
  { id: 'veiculos', label: 'Veículos', naturezas: [DESPESA_NATUREZA.PRESTACAO] },
  { id: 'seguros', label: 'Seguros', naturezas: [DESPESA_NATUREZA.SEGURO] },
  { id: 'impostos', label: 'Impostos / Obrigações', naturezas: [DESPESA_NATUREZA.IMPOSTO] },
];

function programadasActivas(programadas = []) {
  return (programadas || []).filter((item) => item.ativo !== false && !isSalarioPagoPorDiaria(item));
}

function ultimoPagamento(gastos, programadaId) {
  return (
    getGastosDaProgramada(gastos, programadaId)
      .filter((item) => item.estado === 'pago')
      .sort((a, b) =>
        String(b.dataPagamento || b.data || '').localeCompare(String(a.dataPagamento || a.data || ''))
      )[0] || null
  );
}

function origemDiluiacao(programada) {
  const meses = getPeriodicidadeMeses(programada.periodicidade);
  const valor = Number(programada.valor) || 0;
  if (programada.periodicidade === DESPESA_PERIODICIDADE.ANUAL) {
    return `${formatCurrency(valor)}/ano → ${formatCurrency(getEquivalenteMensal(valor, 12))}/mês`;
  }
  if (programada.periodicidade === DESPESA_PERIODICIDADE.SEMESTRAL) {
    return `${formatCurrency(valor)}/semestre → ${formatCurrency(getEquivalenteMensal(valor, 6))}/mês`;
  }
  if (programada.periodicidade === DESPESA_PERIODICIDADE.TRIMESTRAL) {
    return `${formatCurrency(valor)} / a cada 3 meses → ${formatCurrency(getEquivalenteMensal(valor, 3))}/mês`;
  }
  if (meses && meses > 1) {
    return `${formatCurrency(valor)} / ${meses} meses → ${formatCurrency(getEquivalenteMensal(valor, meses))}/mês`;
  }
  return formatCurrency(valor);
}

function linhaCustoDireto(programada, veiculos) {
  return {
    id: programada.id,
    programada,
    titulo: formatTituloHomeFixo(programada, veiculos),
    valorMensal: roundMoney(Number(programada.valor) || 0),
    origem: `${formatCurrency(programada.valor)}/mês`,
    analitico: false,
  };
}

function linhaCustoDiluid(programada, veiculos) {
  const meses = getPeriodicidadeMeses(programada.periodicidade);
  const valor = Number(programada.valor) || 0;
  const mensal = getEquivalenteMensal(valor, meses);
  if (mensal == null) return null;
  return {
    id: programada.id,
    programada,
    titulo: formatTituloHomeFixo(programada, veiculos),
    valorMensal: mensal,
    valorOriginal: valor,
    periodicidadeLabel: formatPeriodicidadeVisivel(programada),
    origem: origemDiluiacao(programada),
    analitico: true,
  };
}

function linhaReferenciaAnalitica(programada, gastos, veiculos) {
  const pago = ultimoPagamento(gastos, programada.id);
  const valor = pago ? getGastoEmpresaValor(pago) : Number(programada.valor) || 0;
  const meses = getCoberturaMeses(programada, pago);
  const mensal = getEquivalenteMensal(valor, meses);
  if (mensal == null) return null;
  return {
    id: programada.id,
    programada,
    titulo: formatTituloHomeFixo(programada, veiculos),
    valorPago: valor,
    coberturaMeses: meses,
    valorMensal: mensal,
    dataPagamento: pago?.dataPagamento || pago?.data || programada.dataInicio || '',
    origem: `${formatCurrency(valor)} no período de ${meses} ${meses === 1 ? 'mês' : 'meses'} → ${formatCurrency(mensal)}/mês`,
    analitico: true,
    referencia: true,
  };
}

export function buildCustoMensalEmpresa({
  programadas = [],
  veiculos = [],
  gastos = [],
  today = new Date().toISOString().slice(0, 10),
} = {}) {
  const activas = programadasActivas(programadas);
  const diretos = [];
  const diluidos = [];
  const referencias = [];

  activas.forEach((item) => {
    if (isDespesaMensalRecorrente(item)) {
      diretos.push(linhaCustoDireto(item, veiculos));
      return;
    }
    if (isRecorrenciaConfirmada(item) && getPeriodicidadeMeses(item.periodicidade) > 1) {
      const linha = linhaCustoDiluid(item, veiculos);
      if (linha) diluidos.push(linha);
      return;
    }
    if (item.natureza === DESPESA_NATUREZA.SEGURO || getCoberturaMeses(item)) {
      const linha = linhaReferenciaAnalitica(item, gastos, veiculos);
      if (linha) referencias.push(linha);
    }
  });

  const grupos = GRUPOS_CUSTO.map((grupo) => {
    const linhasDiretas = diretos.filter((linha) => grupo.naturezas.includes(linha.programada.natureza));
    const linhasDiluidas = diluidos.filter((linha) => grupo.naturezas.includes(linha.programada.natureza));
    return {
      ...grupo,
      diretos: linhasDiretas,
      diluidos: linhasDiluidas,
      total: roundMoney(
        [...linhasDiretas, ...linhasDiluidas].reduce((sum, linha) => sum + (linha.valorMensal || 0), 0)
      ),
    };
  }).filter((grupo) => grupo.diretos.length > 0 || grupo.diluidos.length > 0);

  const variaveis = (gastos || []).filter(isGastoVariavelLancamento);
  const mesesComVariavel = new Set(
    variaveis
      .map((item) => getYearMonth(item.dataPagamento || item.data || ''))
      .filter(Boolean)
  );
  const totalVariavel = roundMoney(variaveis.reduce((sum, item) => sum + getGastoEmpresaValor(item), 0));
  const mediaVariavel =
    mesesComVariavel.size > 0 ? roundMoney(totalVariavel / mesesComVariavel.size) : 0;

  const custoFixoMensalDireto = roundMoney(diretos.reduce((sum, linha) => sum + linha.valorMensal, 0));
  const custosPeriodicosDiluidos = roundMoney(diluidos.reduce((sum, linha) => sum + linha.valorMensal, 0));

  return {
    grupos,
    diretos,
    diluidos,
    referencias,
    custoFixoMensalDireto,
    custosPeriodicosDiluidos,
    custoMedioMensalEstimado: roundMoney(custoFixoMensalDireto + custosPeriodicosDiluidos),
    mediaVariavel,
    mesesVariavel: mesesComVariavel.size,
    today,
  };
}

function grupoCaixaDeNatureza(natureza) {
  return GRUPOS_CAIXA.find((grupo) => grupo.naturezas.includes(natureza)) || {
    id: 'outros',
    label: 'Outros',
  };
}

function dataCaixa(gasto) {
  return gasto?.dataPagamento || gasto?.data || gasto?.dataVencimento || '';
}

export function buildCaixaEmpresa({ gastos = [], programadas = [], veiculos = [], range } = {}) {
  const inRange = (gasto) => {
    if (!range?.inicio && !range?.fim) return true;
    const data = String(dataCaixa(gasto)).slice(0, 10);
    if (!data) return false;
    if (range.inicio && data < range.inicio) return false;
    if (range.fim && data > range.fim) return false;
    return true;
  };

  const pagos = (gastos || []).filter((item) => item.estado === 'pago' && inRange(item));
  const aSair = (gastos || []).filter(
    (item) => (item.estado === 'pendente' || item.estado === 'previsto') && inRange(item)
  );

  const byGrupo = new Map();
  const push = (grupoId, label, linha) => {
    if (!byGrupo.has(grupoId)) byGrupo.set(grupoId, { id: grupoId, label, linhas: [] });
    byGrupo.get(grupoId).linhas.push(linha);
  };

  pagos.forEach((gasto) => {
    const programada = (programadas || []).find((item) => item.id === gasto.despesaProgramadaId);
    const variavel = isGastoVariavelLancamento(gasto) || !programada;
    const grupo = variavel
      ? { id: 'variaveis', label: 'Variáveis neste período' }
      : grupoCaixaDeNatureza(programada.natureza || gasto.natureza);
    push(grupo.id, grupo.label, {
      id: gasto.id,
      gasto,
      programada,
      titulo: programada ? formatTituloHomeFixo(programada, veiculos) : gasto.descricao || gasto.categoria || 'Gasto',
      valor: getGastoEmpresaValor(gasto),
      data: dataCaixa(gasto),
      estado: 'pago',
      veiculo: gasto.veiculo || '',
    });
  });

  aSair.forEach((gasto) => {
    const programada = (programadas || []).find((item) => item.id === gasto.despesaProgramadaId);
    const grupo = programada
      ? grupoCaixaDeNatureza(programada.natureza || gasto.natureza)
      : { id: 'a-sair', label: 'Ainda a sair' };
    push(grupo.id, grupo.label, {
      id: gasto.id,
      gasto,
      programada,
      titulo: programada ? formatTituloHomeFixo(programada, veiculos) : gasto.descricao || gasto.categoria || 'Gasto',
      valor: getGastoEmpresaValor(gasto),
      data: dataCaixa(gasto),
      estado: gasto.estado,
      veiculo: gasto.veiculo || '',
    });
  });

  const ordem = [...GRUPOS_CAIXA.map((item) => item.id), 'variaveis', 'outros', 'a-sair'];
  const grupos = ordem
    .map((id) => byGrupo.get(id))
    .filter(Boolean)
    .map((grupo) => ({
      ...grupo,
      linhas: grupo.linhas.sort((a, b) => String(a.data).localeCompare(String(b.data))),
      total: roundMoney(grupo.linhas.reduce((sum, linha) => sum + (Number(linha.valor) || 0), 0)),
    }));

  const totalPago = roundMoney(pagos.reduce((sum, item) => sum + getGastoEmpresaValor(item), 0));
  const totalASair = roundMoney(
    aSair.filter((item) => item.estado !== 'previsto').reduce((sum, item) => sum + getGastoEmpresaValor(item), 0)
  );

  return {
    grupos,
    totalPago,
    totalASair,
    totalCaixa: roundMoney(totalPago + totalASair),
  };
}

export function formatCoberturaLabel(programada, { gastos = [], today } = {}) {
  const meses = getCoberturaMeses(programada);
  if (!meses) return '';
  const cobertura = getPeriodoCoberto(programada, { gastos, today });
  const base = `Cobertura informada: ${meses} ${meses === 1 ? 'mês' : 'meses'}`;
  if (!cobertura?.fim) return base;
  return cobertura.ativa ? `${base} (até ${formatDate(cobertura.fim)})` : `${base} (terminou)`;
}

export function isGastoVariavelCategoria(gasto) {
  return (
    isCategoriaCombustivel(gasto?.categoria) ||
    isCategoriaViaVerde(gasto?.categoria) ||
    isCategoriaManutencao(gasto?.categoria)
  );
}
