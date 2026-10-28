import { DESPESA_NATUREZA } from '../constants/empresaFinanceiro';
import { calcTotalAReceber, getMonthlyData, mapDiariasForChart } from './calculations';
import {
  getNaturezaGasto,
  isCategoriaCombustivel,
  isCategoriaManutencao,
  isCategoriaViaVerde,
  summarizeVeiculoCustos,
} from './empresaFinanceiroCalculations';
import { isDiariaPendente } from './fechamentoPagamentoCalculations';
import { calcDiariaValorPagavel, isDiariaDeParceiro, isParceiroFuncionario } from './funcionarioTipo';
import { GASTO_CATEGORIAS_DIARIA_LEGACY } from './gastoDiariaIntegration';
import {
  getGastoValorAssinado,
  isNotaCredito,
  summarizeGastosIvaAssinado,
} from './gastoDocumentoSinal';
import { gastosEmpresaParaIva, summarizeGastosEmpresa } from './gastoEmpresaCalculations';
import { roundMoney } from './ivaCalculations';
import { filterByPeriod } from './periodFilter';
import { buildResultadoInternoEmpresa } from './resultadoInternoEmpresa';
import { asRecordList } from './safeCollections';

export function rangeToDateRange(range) {
  return {
    startDate: range?.inicio || undefined,
    endDate: range?.fim || undefined,
  };
}

function gastosObrasReais(gastos = []) {
  return gastos.filter((gasto) => !GASTO_CATEGORIAS_DIARIA_LEGACY.includes(gasto.categoria));
}

function fornecedorNome(gasto) {
  return (
    String(gasto?.fornecedorNome || gasto?.fornecedor || gasto?.nomeFornecedor || '').trim() ||
    'Sem fornecedor'
  );
}

function veiculoNome(gasto, veiculos = []) {
  if (gasto?.veiculoId) {
    const veiculo = veiculos.find((item) => item.id === gasto.veiculoId);
    if (veiculo?.nome) return veiculo.nome;
  }
  return String(gasto?.veiculo || '').trim() || 'Sem viatura';
}

function addToMap(map, key, valor) {
  map[key] = roundMoney((map[key] || 0) + valor);
}

function mapToRows(map) {
  return Object.entries(map)
    .map(([nome, valor]) => ({ id: nome, nome, valor }))
    .sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor));
}

function extrasFechamento(fechamento) {
  const gratificacao = Number(fechamento?.totalGratificacao) || 0;
  if (gratificacao) return gratificacao;
  return Number(fechamento?.totalAcrescimoManual) || 0;
}

export function buildDiagnosticoEmpresa({
  obras = [],
  gastos = [],
  gastosEmpresa = [],
  diarias = [],
  pagamentos = [],
  funcionarios = [],
  fechamentosPagamento = [],
  empresaVeiculos = [],
  range,
} = {}) {
  const dateRange = rangeToDateRange(range);
  const gastosPeriodo = gastosObrasReais(filterByPeriod(gastos, range));
  const empresaPeriodo = filterByPeriod(gastosEmpresa, range);
  const empresaEfetivos = gastosEmpresaParaIva(empresaPeriodo);
  const diariasPeriodo = filterByPeriod(diarias, range);
  const fechamentosPeriodo = filterByPeriod(fechamentosPagamento, range);
  const todosGastos = [...gastosPeriodo, ...empresaEfetivos];

  const interno = buildResultadoInternoEmpresa({
    obras,
    gastos,
    gastosEmpresa,
    diarias,
    pagamentos,
    funcionarios,
    range,
  });
  const receitas = interno.entradasReais;
  const ivaObras = summarizeGastosIvaAssinado(gastosPeriodo);
  const ivaEmpresa = summarizeGastosIvaAssinado(empresaEfetivos);
  const iva = summarizeGastosIvaAssinado(todosGastos);
  const totalDiarias = diariasPeriodo.reduce(
    (sum, diaria) => sum + calcDiariaValorPagavel(diaria, funcionarios),
    0
  );
  const gastosTotais = interno.gastosInternos;
  const resultado = interno.resultadoInterno;

  const resumoEmpresa = summarizeGastosEmpresa(empresaPeriodo);
  const diariasPendentesValor = diariasPeriodo
    .filter((diaria) => isDiariaPendente(diaria, fechamentosPagamento) && !isDiariaDeParceiro(diaria, funcionarios))
    .reduce((sum, diaria) => sum + calcDiariaValorPagavel(diaria, funcionarios), 0);
  const pagamentosFuncionarios = fechamentosPeriodo.reduce(
    (sum, item) => sum + (Number(item.totalPago) || 0),
    0
  );
  const extras = fechamentosPeriodo.reduce((sum, item) => sum + extrasFechamento(item), 0);
  const aReceberClientes = calcTotalAReceber(obras, pagamentos);

  const porObra = interno.obras.map((row) => ({
    id: row.id,
    nome: row.nome,
    receitas: row.entrada,
    custos: row.gastos,
    resultado: row.resultado,
    parceria: row.parceria,
    parteEmerson: row.parteEmerson,
    pendente: row.pendente,
  }));

  const gastosSemObra = gastosPeriodo.filter((gasto) => !gasto.obraId);
  const porCategoria = {};
  const porFornecedor = {};
  const porViatura = {};
  const gastosDaEmpresaIds = new Set(interno.gastosLinhas.map((linha) => linha.id));
  todosGastos.forEach((gasto) => {
    if (!gastosDaEmpresaIds.has(gasto.id)) return;
    addToMap(porCategoria, gasto.categoria || 'Sem categoria', getGastoValorAssinado(gasto));
    addToMap(porFornecedor, fornecedorNome(gasto), getGastoValorAssinado(gasto));
  });
  empresaEfetivos.forEach((gasto) => {
    addToMap(porViatura, veiculoNome(gasto, empresaVeiculos), getGastoValorAssinado(gasto));
  });

  const faturas = todosGastos.filter((gasto) => !isNotaCredito(gasto));
  const notas = todosGastos.filter(isNotaCredito);

  const viaturas = { combustivel: 0, viaVerde: 0, manutencao: 0, seguros: 0, outros: 0 };
  empresaEfetivos.forEach((gasto) => {
    const valor = getGastoValorAssinado(gasto);
    const natureza = getNaturezaGasto(gasto);
    if (isCategoriaViaVerde(gasto.categoria)) {
      viaturas.viaVerde = roundMoney(viaturas.viaVerde + valor);
    } else if (isCategoriaCombustivel(gasto.categoria)) {
      viaturas.combustivel = roundMoney(viaturas.combustivel + valor);
    } else if (isCategoriaManutencao(gasto.categoria)) {
      viaturas.manutencao = roundMoney(viaturas.manutencao + valor);
    } else if (natureza === DESPESA_NATUREZA.SEGURO) {
      viaturas.seguros = roundMoney(viaturas.seguros + valor);
    } else if (gasto.veiculoId || String(gasto.veiculo || '').trim()) {
      viaturas.outros = roundMoney(viaturas.outros + valor);
    }
  });

  const porVeiculo = (empresaVeiculos || [])
    .map((veiculo) => {
      const resumo = summarizeVeiculoCustos(veiculo, empresaPeriodo, [], '');
      return {
        id: veiculo.id,
        nome: veiculo.nome || veiculo.modelo || 'Viatura',
        combustivel: resumo.combustivel || 0,
        viaVerde: resumo.viaVerde || 0,
        manutencao: resumo.manutencao || 0,
        seguros: resumo.seguros || 0,
        outros: roundMoney((resumo.outros || 0) + (resumo.prestacoes || 0)),
        total: resumo.total || 0,
      };
    })
    .filter((row) => row.total);

  return {
    resumo: {
      receitas: roundMoney(receitas),
      entradasReais: interno.entradasReais,
      parteEmerson: interno.parteEmerson,
      reembolsosEmerson: interno.reembolsosEmerson,
      parceriaPendente: interno.parceriaPendente,
      gastosTotais,
      gastosObras: ivaObras.total,
      gastosEmpresa: ivaEmpresa.total,
      diarias: roundMoney(totalDiarias),
      resultado,
      iva: iva.iva,
      ivaDedutivel: iva.ivaDedutivel,
      ivaNaoDedutivel: iva.ivaNaoDedutivel,
      valoresPagos: roundMoney(resumoEmpresa.pago + pagamentosFuncionarios),
      valoresPendentes: roundMoney(resumoEmpresa.pendente + diariasPendentesValor + aReceberClientes),
      pagoEmpresa: resumoEmpresa.pago,
      pendenteEmpresa: resumoEmpresa.pendente,
      aReceberClientes,
    },
    obras: {
      rows: [...porObra].sort((a, b) => b.custos - a.custos),
      maiorGasto: [...porObra].sort((a, b) => b.custos - a.custos).slice(0, 5),
      melhorResultado: [...porObra].sort((a, b) => b.resultado - a.resultado).slice(0, 5),
      semObra: {
        quantidade: gastosSemObra.length,
        total: summarizeGastosIvaAssinado(gastosSemObra).total,
      },
      receitas: roundMoney(porObra.reduce((sum, row) => sum + row.receitas, 0)),
      custos: roundMoney(porObra.reduce((sum, row) => sum + row.custos, 0)),
      resultado: roundMoney(porObra.reduce((sum, row) => sum + row.resultado, 0)),
    },
    funcionarios: {
      totalGasto: roundMoney(totalDiarias + extras),
      diarias: roundMoney(totalDiarias),
      pagamentos: roundMoney(pagamentosFuncionarios),
      pendentes: roundMoney(diariasPendentesValor),
      extras: roundMoney(extras),
      quantidadeDiarias: diariasPeriodo.filter((item) => !isDiariaDeParceiro(item, funcionarios)).length,
      funcionariosActivos: asRecordList(funcionarios).filter(
        (item) => item.estado === 'Ativo' && !isParceiroFuncionario(item)
      ).length,
    },
    gastos: {
      obras: ivaObras.total,
      empresa: ivaEmpresa.total,
      porCategoria: mapToRows(porCategoria),
      porFornecedor: mapToRows(porFornecedor),
      porViatura: mapToRows(porViatura),
      faturas: {
        quantidade: faturas.length,
        total: summarizeGastosIvaAssinado(faturas).total,
      },
      notasCredito: {
        quantidade: notas.length,
        total: summarizeGastosIvaAssinado(notas).total,
      },
    },
    iva,
    viaturas,
    porVeiculo,
    interno,
    charts: {
      receitasMensais: getMonthlyData(interno.entradas, 6),
      gastosMensais: getMonthlyData(interno.gastosLinhas, 6),
        diariasMensais: getMonthlyData(mapDiariasForChart(diarias, dateRange, funcionarios), 6),
      porCategoria: mapToRows(porCategoria)
        .slice(0, 8)
        .filter((row) => row.valor)
        .map((row) => ({ name: row.nome, value: Math.abs(row.valor) })),
    },
  };
}
