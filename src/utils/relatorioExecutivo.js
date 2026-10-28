import { DESPESA_NATUREZA } from '../constants/empresaFinanceiro';
import {
  getNaturezaGasto,
  isCategoriaCarregamento,
  isCategoriaCombustivel,
  isCategoriaManutencao,
  isCategoriaViaVerde,
  summarizeVeiculoCustos,
} from './empresaFinanceiroCalculations';
import { GASTO_CATEGORIAS_DIARIA_LEGACY } from './gastoDiariaIntegration';
import {
  applySinal,
  getGastoValorAssinado,
  isNotaCredito,
  summarizeGastosIvaAssinado,
} from './gastoDocumentoSinal';
import { gastosEmpresaParaIva } from './gastoEmpresaCalculations';
import { getIvaBreakdown } from './empresaIvaRules';
import { hasIvaInfo, roundMoney } from './ivaCalculations';
import { isGastoForaDoIvaEmerson } from './gastoEmersonIva';
import { filterByPeriod } from './periodFilter';
import { buildResultadoInternoEmpresa } from './resultadoInternoEmpresa';
import { formatDateTime } from './formatters';
import { calcObraRecebimentoResumo, getValorRecebidoPagamento, RECEBIMENTO_STATUS, getPagamentoStatus } from './debtCalculations';
import { applyObraExtrasToPosicao, somarExtrasObraNoPeriodo } from './obraExtras';
import { isMaterialGasto } from './obraCustos';
import {
  applyEmpresaShare,
  buildParceriasEmpresaResumo,
  calcObraEmpresaFinanceiro,
  isGastoPagoPorParceiro,
  isPartnershipObra,
} from './obraPartnership';
import { asRecordList } from './safeCollections';
import { isDiariaPendente } from './fechamentoPagamentoCalculations';
import { calcDiariaValorPagavel, isDiariaDeParceiro, isParceiroFuncionario } from './funcionarioTipo';
import { getDiariaAlocacoes, getDiariaCustoAlocado } from './diariaObraAlocacao';
import {
  countObrasConcluidasNoPeriodo,
  isObraConcluida,
  isObraOperational,
} from './obraStatus';
import { getDataInicioControle, isObraComDadosParciais } from './controlDate';
import { calcPrepaidCreditSummary, isPrepaidCreditObra } from './obraPrepaidCredit';
import { calcCreditJobSummary, isCreditJobObra } from './obraCreditJob';

const CATEGORIAS_EMPRESA = [
  { id: 'fixos', label: 'Gastos fixos' },
  { id: 'combustivel', label: 'Combustível' },
  { id: 'viaVerde', label: 'Via Verde' },
  { id: 'seguros', label: 'Seguros' },
  { id: 'aluguel', label: 'Garagem / aluguel' },
  { id: 'viaturas', label: 'Viaturas' },
  { id: 'manutencao', label: 'Manutenção' },
  { id: 'agua', label: 'Água' },
  { id: 'outros', label: 'Outros' },
];

function texto(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function isCategoriaAgua(categoria) {
  const nome = texto(categoria);
  return nome.includes('agua') || nome.includes('saneamento');
}

function fornecedorNome(gasto) {
  return (
    String(gasto?.fornecedorNome || gasto?.fornecedor || gasto?.nomeFornecedor || '').trim() ||
    'Sem fornecedor'
  );
}

function classificarGastoEmpresa(gasto) {
  if (isCategoriaViaVerde(gasto?.categoria)) return 'viaVerde';
  if (isCategoriaCarregamento(gasto?.categoria)) return 'viaturas';
  if (isCategoriaCombustivel(gasto?.categoria)) return 'combustivel';
  if (isCategoriaManutencao(gasto?.categoria)) return 'manutencao';
  if (isCategoriaAgua(gasto?.categoria)) return 'agua';
  const natureza = getNaturezaGasto(gasto);
  if (natureza === DESPESA_NATUREZA.SEGURO) return 'seguros';
  if (natureza === DESPESA_NATUREZA.ALUGUER) return 'aluguel';
  if (natureza === DESPESA_NATUREZA.PRESTACAO) return 'viaturas';
  if (
    natureza === DESPESA_NATUREZA.SALARIO ||
    natureza === DESPESA_NATUREZA.SEGURANCA_SOCIAL ||
    natureza === DESPESA_NATUREZA.CONTABILIDADE ||
    natureza === DESPESA_NATUREZA.IMPOSTO
  ) {
    return 'fixos';
  }
  if (gasto?.veiculoId || String(gasto?.veiculo || '').trim()) return 'viaturas';
  return 'outros';
}

function somar(lista, getValor) {
  return roundMoney((lista || []).reduce((sum, item) => sum + (getValor(item) || 0), 0));
}

export function extrasDoFechamento(fechamento) {
  const gratificacoes = Number(fechamento?.totalGratificacao) || 0;
  const ajustes = Number(fechamento?.totalDescontoManual) || 0;
  let extras = Number(fechamento?.totalAcrescimoBase) || 0;
  if (fechamento?.totalAcrescimoManual != null) {
    extras = roundMoney(Math.max(0, (Number(fechamento.totalAcrescimoManual) || 0) - gratificacoes));
  }
  return { extras, gratificacoes, ajustes };
}

function isConcluidaNoPeriodo(obra, range) {
  if (!isObraConcluida(obra.estado) || !obra.dataConclusao) return false;
  if (!range?.inicio && !range?.fim) return false;
  if (range.inicio && obra.dataConclusao < range.inicio) return false;
  if (range.fim && obra.dataConclusao > range.fim) return false;
  return true;
}

function fornecedoresRelevantes(rows = []) {
  if (!rows.length) return [];
  const ordenados = [...rows].sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
  const impacto = Math.abs(ordenados[0]?.total || 0);
  const minimo = Math.max(40, impacto * 0.04);
  let escolhidos = ordenados.filter(
    (row) => Math.abs(row.total) >= minimo || Math.abs(row.ivaDedutivel) >= 15
  );
  if (escolhidos.length < 5) escolhidos = ordenados.slice(0, 8);
  if (escolhidos.length > 10) escolhidos = escolhidos.slice(0, 10);
  const ids = new Set(escolhidos.map((row) => row.id));
  const resto = ordenados.filter((row) => !ids.has(row.id));
  if (resto.length) {
    escolhidos.push({
      id: '__outros__',
      nome: `Outros (${resto.length})`,
      total: somar(resto, (row) => row.total),
      ivaDedutivel: somar(resto, (row) => row.ivaDedutivel),
    });
  }
  return escolhidos;
}

function periodoTexto(period) {
  return period?.label || 'Período seleccionado';
}

/**
 * Posição de recebimento para o relatório.
 * Obras em crédito (pré-pago ou a prazo) não tratam crédito já recebido como "a receber".
 * Não altera calcObraRecebimentoResumo nem ecrãs de Devedores.
 */
export function posicaoFinanceiraObra(obra, pagamentos, { gastos = [], diarias = [], gastosEmpresa = [] } = {}) {
  try {
    return buildPosicaoFinanceiraObra(obra, pagamentos, { gastos, diarias, gastosEmpresa });
  } catch (err) {
    console.error('[relatório] Falha ao calcular a posição da obra', obra?.id, err);
    return {
      valorContratado: Number(obra?.valorContratado) || 0,
      valorRecebido: 0,
      valorRestante: isPrepaidCreditObra(obra) ? 0 : Number(obra?.valorContratado) || 0,
      informado: obra?.valorContratado != null && obra?.valorContratado !== '',
      credito: isPrepaidCreditObra(obra) || isCreditJobObra(obra),
      valorContratadoTotal: Number(obra?.valorContratado) || 0,
      valorRecebidoTotal: 0,
      valorRestanteTotal: isPrepaidCreditObra(obra) ? 0 : Number(obra?.valorContratado) || 0,
      valorContratadoEmpresa: 0,
      valorRecebidoEmpresa: 0,
      valorRestanteEmpresa: 0,
      parceria: false,
    };
  }
}

function buildPosicaoFinanceiraObra(obra, pagamentos, { gastos = [], diarias = [], gastosEmpresa = [] } = {}) {
  const posicao = calcObraRecebimentoResumo(obra, pagamentos);
  let resultado;
  if (isPrepaidCreditObra(obra)) {
    const credit = calcPrepaidCreditSummary(obra, { diarias, gastos, gastosEmpresa });
    const creditoRecebido = credit?.creditoInicial || 0;
    const recebido = roundMoney(Math.max(creditoRecebido, posicao.valorRecebido || 0));
    resultado = {
      valorContratado: creditoRecebido || posicao.valorContratado || 0,
      valorRecebido: recebido,
      valorRestante: 0,
      informado: creditoRecebido > 0 || (obra.valorContratado != null && obra.valorContratado !== ''),
      credito: true,
    };
  } else if (isCreditJobObra(obra)) {
    const job = calcCreditJobSummary(obra, { gastos, diarias, pagamentos, gastosEmpresa });
    const recebido = job?.totalRecebido ?? posicao.valorRecebido;
    const informado = Boolean(job?.temValorAcordado) || (obra.valorContratado != null && obra.valorContratado !== '');
    let valorRestante = posicao.valorRestante;
    if (job?.temValorAcordado) {
      valorRestante = job.aindaAReceber;
    } else if (!informado) {
      valorRestante = null;
    }
    resultado = {
      valorContratado: job?.valorAcordado ?? posicao.valorContratado,
      valorRecebido: recebido,
      valorRestante,
      informado,
      credito: true,
    };
  } else {
    resultado = {
      valorContratado: posicao.valorContratado,
      valorRecebido: posicao.valorRecebido,
      valorRestante: posicao.valorRestante,
      informado: obra.valorContratado != null && obra.valorContratado !== '',
      credito: false,
    };
  }
  resultado = applyObraExtrasToPosicao(resultado, obra);
  if (isPrepaidCreditObra(obra)) {
    resultado = { ...resultado, valorRestante: 0 };
  }

  const valorContratadoTotal = resultado.valorContratado;
  const valorAtualizadoTotal = resultado.valorObraAtualizado ?? valorContratadoTotal;
  const valorRecebidoTotal = resultado.valorRecebido;
  const valorRestanteTotal = resultado.valorRestante;
  resultado.valorContratadoTotal = valorContratadoTotal;
  resultado.valorRecebidoTotal = valorRecebidoTotal;
  resultado.valorRestanteTotal = valorRestanteTotal;
  resultado.valorContratadoEmpresa = applyEmpresaShare(obra, valorAtualizadoTotal);
  resultado.valorRecebidoEmpresa = applyEmpresaShare(obra, valorRecebidoTotal);
  resultado.valorRestanteEmpresa =
    valorRestanteTotal == null ? null : applyEmpresaShare(obra, valorRestanteTotal);
  resultado.parceria = isPartnershipObra(obra);
  return resultado;
}

function isRecebimentoCliente(pagamento) {
  return pagamento?.tipo === 'Recebimento de cliente' && getPagamentoStatus(pagamento) !== RECEBIMENTO_STATUS.CANCELADO;
}

function gastosObrasReais(gastos = []) {
  return asRecordList(gastos).filter((gasto) => !GASTO_CATEGORIAS_DIARIA_LEGACY.includes(gasto.categoria));
}

function nomeFuncionario(id, funcionarios) {
  if (!id) return 'Sem funcionário';
  return funcionarios.find((item) => item.id === id)?.nome || 'Funcionário';
}

function nomeObra(id, obras) {
  if (!id) return 'Sem obra específica';
  return obras.find((item) => item.id === id)?.nome || 'Obra';
}

/**
 * Modelo de gestão para o PDF. Usa funções já existentes; não grava nem altera dados.
 */
export function buildRelatorioExecutivo({
  period,
  obras = [],
  gastos = [],
  gastosEmpresa = [],
  diarias = [],
  pagamentos = [],
  funcionarios = [],
  fechamentosPagamento = [],
  empresaVeiculos = [],
  configuracoes = {},
} = {}) {
  const range = period?.range;
  const dataInicioControle = getDataInicioControle(configuracoes);
  const geradoEm = formatDateTime(new Date().toISOString());

  const diariasPeriodo = filterByPeriod(diarias, range);
  const gastosPeriodo = gastosObrasReais(filterByPeriod(gastos, range));
  const empresaEfetivos = gastosEmpresaParaIva(filterByPeriod(gastosEmpresa, range));
  const fechamentosPeriodo = filterByPeriod(fechamentosPagamento, range);
  const recebimentosPeriodo = filterByPeriod(pagamentos.filter(isRecebimentoCliente), range);

  const extrasObrasPeriodo = { faturado: 0, recebido: 0 };
  obras.forEach((obra) => {
    const extrasObra = somarExtrasObraNoPeriodo(obra, range);
    extrasObrasPeriodo.faturado += applyEmpresaShare(obra, extrasObra.faturado);
    extrasObrasPeriodo.recebido += applyEmpresaShare(obra, extrasObra.recebido);
  });
  extrasObrasPeriodo.faturado = roundMoney(extrasObrasPeriodo.faturado);
  extrasObrasPeriodo.recebido = roundMoney(extrasObrasPeriodo.recebido);

  const faturado = roundMoney(
    somar(recebimentosPeriodo, (item) => {
      const obra = obras.find((row) => row && row.id === item.obraId) || null;
      return applyEmpresaShare(obra, Number(item.valor) || 0);
    }) + extrasObrasPeriodo.faturado
  );
  const recebido = roundMoney(
    somar(recebimentosPeriodo, (item) => {
      const obra = obras.find((row) => row && row.id === item.obraId) || null;
      return applyEmpresaShare(obra, getValorRecebidoPagamento(item));
    }) + extrasObrasPeriodo.recebido
  );
  const ctxCustos = { gastos, diarias, gastosEmpresa };
  const posicoesObras = obras.map((obra) => posicaoFinanceiraObra(obra, pagamentos, ctxCustos));
  const aReceberAtual = somar(posicoesObras, (item) => item.valorRestanteEmpresa ?? 0);

  const gastosObrasAssoc = gastosPeriodo.filter((gasto) => gasto.obraId && !isGastoPagoPorParceiro(gasto));
  const gastosObrasSemObra = gastosPeriodo.filter((gasto) => !gasto.obraId);
  const materiais = somar(gastosObrasAssoc.filter(isMaterialGasto), getGastoValorAssinado);
  const outrosObras = somar(
    gastosObrasAssoc.filter((gasto) => !isMaterialGasto(gasto)),
    getGastoValorAssinado
  );
  const maoDeObra = somar(diariasPeriodo, (item) => calcDiariaValorPagavel(item, funcionarios));
  const semObraTotal = somar(gastosObrasSemObra, getGastoValorAssinado);
  const gastosObrasTotal = roundMoney(materiais + outrosObras + semObraTotal);
  const gastosEmpresaTodos = somar(empresaEfetivos, getGastoValorAssinado);
  const gastosTotais = roundMoney(gastosObrasTotal + maoDeObra + gastosEmpresaTodos);

  const resultadoEconomico = roundMoney(faturado - gastosTotais);
  const resultadoCaixa = roundMoney(recebido - gastosTotais);
  const interno = buildResultadoInternoEmpresa({
    obras,
    gastos,
    gastosEmpresa,
    diarias,
    pagamentos,
    funcionarios,
    range,
  });

  const qtdDiarias = diariasPeriodo.reduce((sum, item) => sum + (Number(item.quantidade) || 0), 0);
  const funcionariosQueTrabalharam = new Set(
    diariasPeriodo.map((item) => item.funcionarioId).filter(Boolean)
  ).size;
  const mediaDiarias =
    funcionariosQueTrabalharam > 0 ? qtdDiarias / funcionariosQueTrabalharam : null;

  const extrasTotais = { extras: 0, gratificacoes: 0, ajustes: 0 };
  fechamentosPeriodo.forEach((item) => {
    const extra = extrasDoFechamento(item);
    extrasTotais.extras = roundMoney(extrasTotais.extras + extra.extras);
    extrasTotais.gratificacoes = roundMoney(extrasTotais.gratificacoes + extra.gratificacoes);
    extrasTotais.ajustes = roundMoney(extrasTotais.ajustes + extra.ajustes);
  });
  const extrasAjustesTotal = roundMoney(
    extrasTotais.extras + extrasTotais.gratificacoes - extrasTotais.ajustes
  );
  const totalPagoFuncionarios = somar(fechamentosPeriodo, (item) => Number(item.totalPago) || 0);
  const totalPendenteFuncionarios = somar(
    diariasPeriodo.filter(
      (item) => isDiariaPendente(item, fechamentosPagamento) && !isDiariaDeParceiro(item, funcionarios)
    ),
    (item) => calcDiariaValorPagavel(item, funcionarios)
  );

  const obrasAtivas = obras.filter((obra) => isObraOperational(obra.estado)).length;
  const obrasConcluidasPeriodo = countObrasConcluidasNoPeriodo(
    obras,
    range?.inicio,
    range?.fim
  );

  const obrasDetalhe = obras
    .map((obra) => {
      const posicao = posicaoFinanceiraObra(obra, pagamentos, ctxCustos);
      const diariasObra = diariasPeriodo.filter((item) => item.obraId === obra.id);
      const gastosObra = gastosPeriodo.filter((item) => item.obraId === obra.id);
      const extrasPeriodoObra = somarExtrasObraNoPeriodo(obra, range);
      const recebidoPeriodo = applyEmpresaShare(
        obra,
        roundMoney(
          somar(
            recebimentosPeriodo.filter((item) => item.obraId === obra.id),
            getValorRecebidoPagamento
          ) + extrasPeriodoObra.recebido
        )
      );
      const faturadoPeriodo = applyEmpresaShare(
        obra,
        roundMoney(
          somar(
            recebimentosPeriodo.filter((item) => item.obraId === obra.id),
            (item) => Number(item.valor) || 0
          ) + extrasPeriodoObra.faturado
        )
      );
      const gastosObraConsiderados = isPartnershipObra(obra)
        ? gastosObra
        : gastosObra.filter((item) => !isGastoPagoPorParceiro(item));
      const mat = somar(gastosObraConsiderados.filter(isMaterialGasto), getGastoValorAssinado);
      const outros = somar(gastosObraConsiderados.filter((item) => !isMaterialGasto(item)), getGastoValorAssinado);
      const labor = somar(diariasObra, (item) => calcDiariaValorPagavel(item, funcionarios));
      const totalGasto = roundMoney(mat + labor + outros);
      const qtd = diariasObra.reduce((sum, item) => sum + (Number(item.quantidade) || 0), 0);
      const porPessoa = new Map();
      diariasObra.forEach((diaria) => {
        if (isDiariaDeParceiro(diaria, funcionarios)) return;
        const id = diaria.funcionarioId || 'sem-funcionario';
        const current = porPessoa.get(id) || {
          id,
          nome: nomeFuncionario(diaria.funcionarioId, funcionarios),
          quantidade: 0,
          custo: 0,
        };
        current.quantidade += Number(diaria.quantidade) || 0;
        current.custo = roundMoney(current.custo + calcDiariaValorPagavel(diaria, funcionarios));
        porPessoa.set(id, current);
      });
      const pessoas = [...porPessoa.values()].sort((a, b) => b.custo - a.custo);
      const concluida = isObraConcluida(obra.estado);
      const concluidaNoPeriodo = isConcluidaNoPeriodo(obra, range);
      const temMovimento = Boolean(
        totalGasto ||
          recebidoPeriodo ||
          faturadoPeriodo ||
          qtd ||
          concluidaNoPeriodo ||
          extrasPeriodoObra.faturado ||
          extrasPeriodoObra.recebido ||
          (posicao.credito && isObraOperational(obra.estado))
      );
      const dadosParciais = isObraComDadosParciais(obra, gastos, diarias, dataInicioControle);
      const empresaFin = calcObraEmpresaFinanceiro(obra, {
        gastos,
        diarias,
        pagamentos,
        gastosEmpresa,
        funcionarios,
        fechamentosPagamento,
      });
      const custoTotalObra = empresaFin.gastosEmerson;
      const valorObraResultado = empresaFin.valorTotalObra ?? 0;
      const resultadoParcial = roundMoney(faturadoPeriodo - totalGasto);
      const resultadoFinalObra = empresaFin.resultadoEmerson ?? roundMoney(valorObraResultado - custoTotalObra);
      let resultadoTipo = 'parcial';
      let resultadoLabel = empresaFin.isPartnership ? 'Lucro provisório da Emerson' : 'Resultado parcial';
      let resultadoValor = empresaFin.isPartnership
        ? empresaFin.divisaoInformada
          ? empresaFin.resultadoCaixaEmerson ?? resultadoFinalObra
          : empresaFin.lucroCaixa ?? resultadoParcial
        : resultadoParcial;
      if (concluida && !dadosParciais && (empresaFin.isPartnership ? empresaFin.divisaoInformada : valorObraResultado > 0)) {
        resultadoTipo = resultadoFinalObra >= 0 ? 'lucro' : 'prejuizo';
        resultadoLabel = empresaFin.isPartnership
          ? resultadoFinalObra >= 0
            ? 'Lucro Emerson'
            : 'Prejuízo Emerson'
          : resultadoFinalObra >= 0
            ? 'Lucro final'
            : 'Prejuízo final';
        resultadoValor = resultadoFinalObra;
      }

      return {
        id: obra.id,
        nome: obra.nome,
        status: concluida ? 'Concluída' : 'Em andamento',
        credito: posicao.credito,
        parceria: empresaFin.isPartnership,
        concluida,
        dadosParciais,
        valorObraInformado: posicao.informado,
        valorObra: posicao.valorContratadoTotal ?? posicao.valorContratado ?? 0,
        valorObraAtualizado: posicao.valorObraAtualizado ?? posicao.valorContratadoTotal ?? posicao.valorContratado ?? 0,
        extras: posicao.extras || null,
        recebido: posicao.valorRecebidoTotal ?? posicao.valorRecebido,
        aReceber: posicao.valorRestanteTotal ?? posicao.valorRestante,
        recebidoPeriodo,
        faturadoPeriodo,
        materiais: mat,
        funcionarios: labor,
        outros,
        totalGasto,
        custoTotalObra,
        diarias: qtd,
        funcionariosEnvolvidos: pessoas.length,
        pessoas,
        resultadoTipo,
        resultadoLabel,
        resultadoValor,
        margem:
          valorObraResultado > 0
            ? Math.round((resultadoValor / valorObraResultado) * 1000) / 10
            : null,
        temMovimento,
      };
    })
    .filter((obra) => obra.temMovimento)
    .sort((a, b) => b.totalGasto - a.totalGasto);

  const porFuncionario = new Map();
  diariasPeriodo.forEach((diaria) => {
    if (isDiariaDeParceiro(diaria, funcionarios)) return;
    const id = diaria.funcionarioId || 'sem-funcionario';
    const current = porFuncionario.get(id) || {
      id,
      nome: nomeFuncionario(diaria.funcionarioId, funcionarios),
      quantidade: 0,
      custo: 0,
      extras: 0,
      pendente: 0,
      obras: new Set(),
    };
    current.quantidade += Number(diaria.quantidade) || 0;
    current.custo = roundMoney(current.custo + calcDiariaValorPagavel(diaria, funcionarios));
    if (isDiariaPendente(diaria, fechamentosPagamento)) {
      current.pendente = roundMoney(current.pendente + calcDiariaValorPagavel(diaria, funcionarios));
    }
    if (diaria.obraId) current.obras.add(diaria.obraId);
    getDiariaAlocacoes(diaria).forEach((alocacao) => {
      if (alocacao.obraId) current.obras.add(alocacao.obraId);
    });
    porFuncionario.set(id, current);
  });
  fechamentosPeriodo.forEach((fechamento) => {
    const id = fechamento.funcionarioId;
    if (!id) return;
    if (isParceiroFuncionario(funcionarios.find((item) => item && item.id === id))) return;
    const extra = extrasDoFechamento(fechamento);
    const current = porFuncionario.get(id) || {
      id,
      nome: fechamento.funcionarioNome || nomeFuncionario(id, funcionarios),
      quantidade: 0,
      custo: 0,
      extras: 0,
      pendente: 0,
      obras: new Set(),
    };
    current.extras = roundMoney(current.extras + extra.extras + extra.gratificacoes - extra.ajustes);
    porFuncionario.set(id, current);
  });
  const funcionariosTabela = [...porFuncionario.values()]
    .map((item) => ({
      ...item,
      obras: item.obras.size,
      pendente: item.pendente || 0,
      total: roundMoney(item.custo + item.extras),
    }))
    .sort((a, b) => b.total - a.total);

  const diariasPorObraMap = new Map();
  diariasPeriodo.forEach((diaria) => {
    getDiariaAlocacoes(diaria).forEach((alocacao) => {
      const id = alocacao.obraId || '__sem_obra__';
      const current = diariasPorObraMap.get(id) || {
        id,
        nome: nomeObra(alocacao.obraId, obras),
        quantidade: 0,
        custo: 0,
      };
      current.quantidade += alocacao.quantidade;
      current.custo = roundMoney(
        current.custo + getDiariaCustoAlocado(diaria, alocacao.quantidade, funcionarios)
      );
      diariasPorObraMap.set(id, current);
    });
  });
  const diariasPorObra = [...diariasPorObraMap.values()].sort((a, b) => b.custo - a.custo);

  const buckets = Object.fromEntries(CATEGORIAS_EMPRESA.map((item) => [item.id, 0]));
  empresaEfetivos.forEach((gasto) => {
    const id = classificarGastoEmpresa(gasto);
    buckets[id] = roundMoney((buckets[id] || 0) + getGastoValorAssinado(gasto));
  });
  const categoriasEmpresa = CATEGORIAS_EMPRESA.map((item) => ({
    ...item,
    total: buckets[item.id] || 0,
  })).filter((item) => item.total);

  const todosGastosIva = [...gastosPeriodo, ...empresaEfetivos];
  const docsComIva = todosGastosIva.filter(hasIvaInfo);
  const docsSemIva = todosGastosIva.length - docsComIva.length;
  const ivaAssinado = summarizeGastosIvaAssinado(docsComIva);
  const notas = todosGastosIva.filter(isNotaCredito);
  const ivaNotas = summarizeGastosIvaAssinado(notas.filter(hasIvaInfo));
  const ivaDisponivel = docsComIva.length > 0;
  const ivaIncompleto = docsSemIva > 0;

  const porFornecedorMap = {};
  todosGastosIva.forEach((gasto) => {
    if (isGastoForaDoIvaEmerson(gasto)) return;
    const nome = fornecedorNome(gasto);
    if (!porFornecedorMap[nome]) {
      porFornecedorMap[nome] = { id: nome, nome, total: 0, ivaDedutivel: 0, temIva: false };
    }
    porFornecedorMap[nome].total = roundMoney(
      porFornecedorMap[nome].total + getGastoValorAssinado(gasto)
    );
    const breakdown = getIvaBreakdown(gasto);
    if (breakdown.dedutivel != null) {
      porFornecedorMap[nome].temIva = true;
      porFornecedorMap[nome].ivaDedutivel = roundMoney(
        porFornecedorMap[nome].ivaDedutivel + applySinal(breakdown.dedutivel, gasto)
      );
    }
  });
  const fornecedores = fornecedoresRelevantes(Object.values(porFornecedorMap));

  const porVeiculo = (empresaVeiculos || [])
    .map((veiculo) => {
      const resumo = summarizeVeiculoCustos(veiculo, filterByPeriod(gastosEmpresa, range), [], '');
      return {
        id: veiculo.id,
        nome: veiculo.nome || veiculo.modelo || 'Viatura',
        combustivel: resumo.combustivel || 0,
        viaVerde: resumo.viaVerde || 0,
        manutencao: resumo.manutencao || 0,
        seguros: resumo.seguros || 0,
        outros: roundMoney((resumo.outros || 0) + (resumo.prestacoes || 0)),
        manutencaoOutros: roundMoney(
          (resumo.manutencao || 0) + (resumo.seguros || 0) + (resumo.outros || 0) + (resumo.prestacoes || 0)
        ),
        total: resumo.total || 0,
      };
    })
    .filter((row) => row.total);

  const avisos = [];
  if (obras.some((obra) => isObraOperational(obra.estado))) {
    avisos.push('Obras ainda em andamento');
  }
  if (aReceberAtual > 0.004) {
    avisos.push('Valores ainda a receber');
  }
  if (gastosObrasSemObra.length) {
    avisos.push('Gastos antigos sem obra específica');
  }
  if (ivaIncompleto && todosGastosIva.length) {
    avisos.push('IVA antigo sem informação completa');
  }
  if (dataInicioControle && range?.inicio && range.inicio < dataInicioControle) {
    avisos.push('Controlo detalhado iniciado depois do início deste período');
  }
  const qualidade = avisos.length ? 'Parcial' : 'Completa';
  const parcerias = buildParceriasEmpresaResumo(obras, {
    gastos,
    diarias,
    pagamentos,
    gastosEmpresa,
    funcionarios,
    fechamentosPagamento,
  });

  return {
    empresa: configuracoes?.nomeEmpresa || 'Emerson Pinturas',
    titulo: 'Relatório da Empresa',
    periodoLabel: periodoTexto(period),
    geradoEm,
    qualidade,
    avisos,
    parcerias,
    interno,
    resumo: {
      faturado,
      recebido,
      aReceber: aReceberAtual,
      gastosTotais,
      gastosObras: gastosObrasTotal,
      gastosEmpresa: gastosEmpresaTodos,
      gastosFuncionarios: maoDeObra,
      resultado: resultadoEconomico,
      resultadoCaixa,
      ivaDedutivel: ivaDisponivel ? ivaAssinado.ivaDedutivel : null,
      obrasAtivas,
      obrasConcluidasPeriodo,
    },
    obras: obrasDetalhe,
    gastosObras: {
      materiais,
      maoDeObra,
      outros: outrosObras,
      associados: roundMoney(materiais + outrosObras),
      semObra: {
        quantidade: gastosObrasSemObra.length,
        total: semObraTotal,
      },
      total: gastosObrasTotal,
    },
    gastosResumo: [
      { id: 'materiais', label: 'Materiais de obra', total: materiais },
      { id: 'outrosObras', label: 'Outros custos de obras', total: outrosObras },
      { id: 'semObra', label: 'Gastos de obra sem obra específica', total: semObraTotal },
      { id: 'fixos', label: 'Gastos fixos', total: buckets.fixos || 0 },
      { id: 'combustivel', label: 'Combustível', total: buckets.combustivel || 0 },
      { id: 'viaVerde', label: 'Via Verde', total: buckets.viaVerde || 0 },
      { id: 'seguros', label: 'Seguros', total: buckets.seguros || 0 },
      {
        id: 'viaturas',
        label: 'Viaturas / manutenção',
        total: roundMoney((buckets.viaturas || 0) + (buckets.manutencao || 0) + (buckets.aluguel || 0)),
      },
      {
        id: 'outrosEmpresa',
        label: 'Outros gastos da empresa',
        total: roundMoney((buckets.outros || 0) + (buckets.agua || 0)),
      },
    ].filter((item) => Math.abs(item.total) > 0.004),
    funcionarios: {
      ativos: funcionarios.filter((item) => item.estado === 'Ativo').length,
      diarias: qtdDiarias,
      custoDiarias: maoDeObra,
      extras: extrasTotais.extras,
      gratificacoes: extrasTotais.gratificacoes,
      ajustes: extrasTotais.ajustes,
      extrasAjustes: extrasAjustesTotal,
      pago: totalPagoFuncionarios,
      pendente: totalPendenteFuncionarios,
      tabela: funcionariosTabela,
    },
    diarias: {
      total: qtdDiarias,
      gasto: maoDeObra,
      media: mediaDiarias,
      porObra: diariasPorObra,
    },
    empresaGastos: {
      linhas: categoriasEmpresa,
      total: gastosEmpresaTodos,
    },
    iva: {
      disponivel: ivaDisponivel,
      incompleto: ivaIncompleto,
      docsComIva: docsComIva.length,
      docsSemIva,
      total: ivaDisponivel ? ivaAssinado.iva : null,
      dedutivel: ivaDisponivel ? ivaAssinado.ivaDedutivel : null,
      naoDedutivel: ivaDisponivel ? ivaAssinado.ivaNaoDedutivel : null,
      notasCredito: {
        quantidade: notas.length,
        total: somar(notas, getGastoValorAssinado),
        iva: notas.some(hasIvaInfo) ? ivaNotas.iva : null,
        ivaDedutivel: notas.some(hasIvaInfo) ? ivaNotas.ivaDedutivel : null,
      },
    },
    viaturas: porVeiculo,
    fornecedores,
    resultadoFinal: {
      faturado,
      recebido,
      gastosObras: gastosObrasTotal,
      funcionarios: maoDeObra,
      gastosEmpresa: gastosEmpresaTodos,
      resultadoEconomico,
      resultadoCaixa,
    },
  };
}
