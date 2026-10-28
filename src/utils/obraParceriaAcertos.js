import { generateId } from '../services/storageService';
import { roundMoney } from './ivaCalculations';
import { asIdList, asRecordList } from './safeCollections';
import { getGastoValorAssinado } from './gastoDocumentoTipo';
import { getGastoEmpresaValor } from './gastoEmpresaCalculations';
import { GASTO_CATEGORIAS_DIARIA_LEGACY } from './gastoDiariaIntegration';
import { getGastoHistoricoDescricao } from './gastoDisplay';
import { filterDiariasDaObra, getDiariaQuantidadeNaObra } from './diariaObraAlocacao';
import { findFuncionarioById, normalizePessoaNome, primeiroNomePessoa } from './funcionarioTipo';
import { getObraRecebimentos, getObraRepasses } from './obraCustos';
import { buildObraPaymentRecord } from './obraPagamentoCalculations';
import {
  applyShareRate,
  getDiariaCustoInternoParceria,
  getGastoPagadorLabel,
  getRepasseDestinatarioLabel,
  isObraParceriaComDiariasJaIncluidas,
  isPartnershipObra,
  resolveGastoPagadorId,
  resolveRepasseDestinatario,
  summarizeGastosPorPagador,
  GASTO_PAGADOR,
  PARTICIPANT_ROLE,
  getPartnershipParticipants,
} from './obraPartnership';

export const PARCERIA_LUCRO_SPLIT = [
  { key: 'emerson', nome: 'Emerson', percentagem: 40 },
  { key: 'fabio', nome: 'Fábio', percentagem: 30 },
  { key: 'juliano', nome: 'Juliano', percentagem: 30 },
];

function keyParceiroParticipante(parte) {
  if (!parte) return null;
  if (parte.role === PARTICIPANT_ROLE.EMPRESA) return 'emerson';
  const nome = primeiroNomePessoa(parte.nome);
  if (nome === 'emerson' || nome === 'fabio' || nome === 'juliano') return nome;
  if (parte.id === 'parceiro-fabio') return 'fabio';
  if (parte.id === 'parceiro-juliano') return 'juliano';
  return null;
}

export function getSplitParceriaObra(obra) {
  const split = [];
  const visto = new Set();
  asRecordList(getPartnershipParticipants(obra)).forEach((parte) => {
    const key = keyParceiroParticipante(parte);
    const percentagem = Number(parte.percentagem);
    if (!key || visto.has(key) || !Number.isFinite(percentagem) || percentagem < 0) return;
    visto.add(key);
    const padrao = PARCERIA_LUCRO_SPLIT.find((item) => item.key === key);
    split.push({
      key,
      nome: String(parte.nome || '').trim() || padrao?.nome || key,
      percentagem,
    });
  });
  const total = split.reduce((sum, item) => sum + (Number(item.percentagem) || 0), 0);
  if (split.length >= 2 && Math.abs(total - 100) <= 0.05) return split;
  return PARCERIA_LUCRO_SPLIT.map((item) => ({ ...item }));
}

/**
 * Fechamento único do Acerto.
 * A reserva utilizada paga parte dos custos selecionados. O valor dos custos não muda.
 * O que o utilizador indica em reservaFinal é a nova reserva deixada deste pagamento:
 * soma-se ao que sobrou da reserva anterior, não a substitui.
 * saldo = pagamento − custos não pagos pela reserva − nova reserva deixada.
 * Esse saldo só vira lucro distribuído se distribuirLucro for verdadeiro e o saldo for positivo.
 * Custos acertados não são convertidos em percentagens negativas dos sócios.
 */
export function calcularFechamentoAcertoParceria({
  pagamento = 0,
  reservaAnterior = 0,
  reservaUtilizada = 0,
  custos = 0,
  reservaFinal = 0,
  distribuirLucro = false,
} = {}) {
  const pagamentoN = roundMoney(Math.max(0, Number(pagamento) || 0));
  const anterior = roundMoney(Math.max(0, Number(reservaAnterior) || 0));
  const utilizadaPedida = roundMoney(Math.max(0, Number(reservaUtilizada) || 0));
  const custosN = roundMoney(Math.max(0, Number(custos) || 0));
  const novaDeixada = roundMoney(Math.max(0, Number(reservaFinal) || 0));
  const reservaExcede = utilizadaPedida > anterior + 0.004;
  const utilizada = reservaExcede ? anterior : utilizadaPedida;
  const custosPagosPelaReserva = roundMoney(Math.min(utilizada, custosN));
  const custosCobertosPeloDinheiroNovo = roundMoney(Math.max(0, custosN - custosPagosPelaReserva));
  const reservaRestante = roundMoney(Math.max(0, anterior - utilizada));
  const reservaFinalAcumulada = roundMoney(reservaRestante + novaDeixada);
  const totalConsiderado = roundMoney(pagamentoN + utilizada);
  const resultadoAntesReservaFinal = roundMoney(pagamentoN - custosCobertosPeloDinheiroNovo);
  const saldoRemanescente = roundMoney(resultadoAntesReservaFinal - novaDeixada);
  const querDistribuir = distribuirLucro === true;
  const lucroDistribuido = querDistribuir && saldoRemanescente > 0.004 ? saldoRemanescente : 0;
  return {
    pagamento: pagamentoN,
    reservaAnterior: anterior,
    reservaUtilizadaPedida: utilizadaPedida,
    reservaUtilizada: utilizada,
    custos: custosN,
    novaReservaDeixada: novaDeixada,
    reservaRestante,
    custosPagosPelaReserva,
    custosCobertosPeloDinheiroNovo,
    reservaFinal: reservaFinalAcumulada,
    totalConsiderado,
    resultadoAntesReservaFinal,
    saldoRemanescente,
    distribuirLucro: querDistribuir,
    semDistribuicao: !querDistribuir,
    lucroDistribuido,
    valorDivisao: lucroDistribuido,
    semLucroDisponivel: querDistribuir && saldoRemanescente <= 0.004,
    reservaExcede,
    divisaoNegativa: false,
    nenhumCusto: custosN <= 0.004,
    nenhumaReserva: utilizadaPedida <= 0.004,
    reservaNaoTrazida: reservaRestante,
  };
}

export function dividirValorParceria(valor, split = []) {
  const partes = asRecordList(split);
  const base = roundMoney(valor);
  let restante = base;
  return partes.map((parte, index) => {
    const ultimo = index === partes.length - 1;
    const aplicado = ultimo
      ? restante
      : roundMoney(applyShareRate(base, (Number(parte.percentagem) || 0) / 100) || 0);
    restante = roundMoney(restante - aplicado);
    return {
      key: parte.key,
      nome: parte.nome,
      percentagem: parte.percentagem,
      valor: aplicado,
    };
  });
}

export function parseMontanteAcerto(value) {
  if (value == null || String(value).trim() === '') return { ok: true, valor: 0, vazio: true };
  const normalizado = String(value).trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalizado)) return { ok: false, valor: 0, vazio: false };
  const n = Number(normalizado);
  if (!Number.isFinite(n) || n < 0) return { ok: false, valor: 0, vazio: false };
  return { ok: true, valor: roundMoney(n), vazio: false };
}

export function agruparCustosPendentesAcerto(pendentes) {
  const diarias = asRecordList(pendentes?.diarias);
  const gastos = asRecordList(pendentes?.gastos);
  return [
    { key: 'emerson', nome: 'Emerson' },
    { key: 'fabio', nome: 'Fábio' },
    { key: 'juliano', nome: 'Juliano' },
    { key: 'caixa', nome: 'Caixa da parceria' },
  ]
    .map((pessoa) => ({
      ...pessoa,
      gastos: gastos.filter((item) => item.pagador === pessoa.key),
      diarias: diarias.filter((item) => item.papel === pessoa.key),
      funcionarios: pessoa.key === 'emerson' ? diarias.filter((item) => item.papel === 'funcionario') : [],
    }))
    .filter((pessoa) => pessoa.key !== 'caixa' || pessoa.gastos.length > 0);
}

function valorLinhaDiaria(item) {
  if (!item) return 0;
  if (item.incluidoNosGastos) return 0;
  if (item.papel === 'funcionario') return roundMoney(item.valorCusto || 0);
  return roundMoney(item.valorReembolso ?? item.valorCusto ?? 0);
}

function linhasCustosDescontados(diariasSel, gastosSel) {
  const linhas = [];
  asRecordList(gastosSel).forEach((item) => {
    linhas.push({
      id: item.id,
      tipo: 'gasto',
      tipoLabel: 'gasto',
      pessoa: item.pagador,
      pessoaNome: item.pagadorLabel || item.pagador,
      descricao: item.descricao || 'Gasto',
      data: item.data || null,
      valor: roundMoney(item.valor),
    });
  });
  asRecordList(diariasSel).forEach((item) => {
    const funcionario = item.papel === 'funcionario';
    linhas.push({
      id: item.id,
      tipo: funcionario ? 'mao-de-obra' : 'diaria',
      tipoLabel: funcionario ? 'funcionário' : 'diária',
      pessoa: funcionario ? 'emerson' : item.papel,
      pessoaNome: funcionario ? item.nome : item.papel,
      descricao: funcionario ? item.nome || 'Funcionário' : 'Diária própria',
      data: item.data || null,
      valor: valorLinhaDiaria(item),
    });
  });
  return linhas;
}

export const BRAGA4_RESERVA_CAIXA_ACERTO1 = 3500;

export const ACERTO1_BRAGA4_HISTORICO = {
  recebido: 20000,
  emerson: 6985.25,
  fabio: 0,
  juliano: 7621.25,
  custos: 14606.5,
  reservaCaixa: 3500,
  lucroAntesCaixa: 5393.5,
  lucroDistribuir: 1893.5,
  lucroEmerson: 757.4,
  lucroFabio: 568.05,
  lucroJuliano: 568.05,
};

function blocoConsolidadoFixo(valor) {
  const v = roundMoney(valor);
  return {
    key: null,
    diariasProprias: [],
    funcionarios: [],
    gastos: [],
    diariasPropriasQty: 0,
    diariasPropriasValor: 0,
    diariasPropriasReembolso: 0,
    diariasReferencia: 0,
    diariasIncluidasNosGastos: true,
    funcionariosQty: 0,
    funcionariosValor: 0,
    funcionariosIncluidasNosGastos: true,
    gastosValor: v,
    reembolso: v,
    totalCusto: v,
    total: v,
  };
}

function snapshotAcerto1Braga4Travado() {
  const H = ACERTO1_BRAGA4_HISTORICO;
  const emerson = { ...blocoConsolidadoFixo(H.emerson), key: 'emerson' };
  const fabio = { ...blocoConsolidadoFixo(H.fabio), key: 'fabio' };
  const juliano = { ...blocoConsolidadoFixo(H.juliano), key: 'juliano' };
  const caixa = { ...blocoConsolidadoFixo(0), key: 'caixa', reembolso: 0 };
  const pessoas = [
    {
      key: 'emerson',
      nome: 'Emerson',
      percentagem: 40,
      reembolso: H.emerson,
      lucro: H.lucroEmerson,
      jaRecebido: 0,
      jaTransferido: 0,
      faltaTransferir: 0,
      statusTransferencia: 'emerson',
      aReceber: H.lucroEmerson,
      totalCusto: H.emerson,
    },
    {
      key: 'fabio',
      nome: 'Fábio',
      percentagem: 30,
      reembolso: H.fabio,
      lucro: H.lucroFabio,
      jaRecebido: 0,
      jaTransferido: 0,
      faltaTransferir: 0,
      statusTransferencia: 'pago',
      aReceber: H.lucroFabio,
      totalCusto: H.fabio,
    },
    {
      key: 'juliano',
      nome: 'Juliano',
      percentagem: 30,
      reembolso: H.juliano,
      lucro: H.lucroJuliano,
      jaRecebido: H.juliano,
      jaTransferido: H.juliano,
      faltaTransferir: 0,
      statusTransferencia: 'pago',
      aReceber: H.lucroJuliano,
      totalCusto: H.juliano,
    },
  ];
  return {
    recebido: H.recebido,
    custos: H.custos,
    custosConsiderados: H.custos,
    lucro: H.lucroAntesCaixa,
    lucroAntesCaixa: H.lucroAntesCaixa,
    resultadoAntesCaixa: H.lucroAntesCaixa,
    reservaCaixa: H.reservaCaixa,
    mantidoNoCaixa: H.reservaCaixa,
    lucroDistribuir: H.lucroDistribuir,
    destinoRecebido: {
      custos: H.custos,
      caixa: H.reservaCaixa,
      lucro: H.lucroDistribuir,
      total: H.recebido,
    },
    pessoas,
    emerson,
    fabio,
    juliano,
    caixa,
    divisaoInformada: true,
    percentagemEmpresa: 40,
    percentagemFabio: 30,
    percentagemJuliano: 30,
    parceiroNome: 'Fábio e Juliano',
    saldoCaixaAnterior: 0,
    saidasNesteAcerto: 0,
    saldoCaixaAtual: H.reservaCaixa,
    valoresConsolidados: true,
    diariasJaIncluidas: true,
    historicalConsolidatedValues: true,
    historicalSnapshotLocked: true,
    reserveAmount: H.reservaCaixa,
  };
}

export const ACERTO2_SINTRA_HISTORICO = {
  recebido: 6400,
  reembolsoEmerson: 5028.19,
  custos: 5028.19,
  restante: 1371.81,
  lucroEmerson: 548.72,
  lucroFabio: 411.54,
  lucroJuliano: 411.55,
};

export const DATA_FECHO_HISTORICO_SINTRA = '2026-09-27';

export const NOTA_ACERTO2_SINTRA =
  'Valor histórico consolidado. Os custos e diárias correspondentes permanecem registrados normalmente na obra e nos relatórios e não foram somados novamente neste Acerto.';

export function isObraJorgeSintraCasaDeBanho(obra) {
  const texto = [obra?.nome, obra?.codigo, obra?.referencia, obra?.local, obra?.cliente]
    .map((value) => normalizePessoaNome(value))
    .join(' ');
  const compacto = texto.replace(/[^a-z0-9]/g, '');
  return compacto.includes('sintra') && (compacto.includes('casadebanho') || compacto.includes('casabanho'));
}

/** Só o Acerto 2 histórico desta obra. Acertos novos (parceria-v3) continuam a somar lançamentos escolhidos. */
export function isAcerto2HistoricoSintra(obra, acerto = null) {
  if (!isObraJorgeSintraCasaDeBanho(obra) || !acerto) return false;
  if (acerto.modelo === 'parceria-v3') return false;
  const numero2 = Number(acerto.numero) === 2 || /\bacerto\s*2\b/i.test(String(acerto.titulo || ''));
  return numero2;
}

function snapshotAcerto2SintraTravado() {
  const H = ACERTO2_SINTRA_HISTORICO;
  const emerson = { ...blocoConsolidadoFixo(H.reembolsoEmerson), key: 'emerson' };
  const fabio = { ...blocoConsolidadoFixo(0), key: 'fabio' };
  const juliano = { ...blocoConsolidadoFixo(0), key: 'juliano' };
  const caixa = { ...blocoConsolidadoFixo(0), key: 'caixa', reembolso: 0 };
  const pessoas = [
    {
      key: 'emerson',
      nome: 'Emerson',
      percentagem: 40,
      reembolso: H.reembolsoEmerson,
      lucro: H.lucroEmerson,
      jaRecebido: 0,
      jaTransferido: 0,
      faltaTransferir: 0,
      statusTransferencia: 'emerson',
      aReceber: H.lucroEmerson,
      totalCusto: H.reembolsoEmerson,
    },
    {
      key: 'fabio',
      nome: 'Fábio',
      percentagem: 30,
      reembolso: 0,
      lucro: H.lucroFabio,
      jaRecebido: 0,
      jaTransferido: 0,
      faltaTransferir: H.lucroFabio,
      statusTransferencia: 'pendente',
      aReceber: H.lucroFabio,
      totalCusto: 0,
    },
    {
      key: 'juliano',
      nome: 'Juliano',
      percentagem: 30,
      reembolso: 0,
      lucro: H.lucroJuliano,
      jaRecebido: 0,
      jaTransferido: 0,
      faltaTransferir: H.lucroJuliano,
      statusTransferencia: 'pendente',
      aReceber: H.lucroJuliano,
      totalCusto: 0,
    },
  ];
  return {
    pagamentoRecebido: H.recebido,
    recebido: H.recebido,
    custos: H.custos,
    custosConsiderados: H.custos,
    lucro: H.restante,
    lucroAntesCaixa: H.restante,
    resultadoAntesCaixa: H.restante,
    reservaCaixa: 0,
    reservaFinal: 0,
    reservaUtilizada: 0,
    reservaAnterior: 0,
    totalConsiderado: H.recebido,
    saldoRemanescente: H.restante,
    distribuirLucro: true,
    mantidoNoCaixa: 0,
    lucroDistribuir: H.restante,
    reembolsoConsolidadoEmerson: H.reembolsoEmerson,
    notaHistorica: NOTA_ACERTO2_SINTRA,
    destinoRecebido: {
      custos: H.custos,
      caixa: 0,
      lucro: H.restante,
      total: H.recebido,
    },
    pessoas,
    emerson,
    fabio,
    juliano,
    caixa,
    custosDescontados: [],
    divisaoInformada: true,
    percentagemEmpresa: 40,
    percentagemFabio: 30,
    percentagemJuliano: 30,
    parceiroNome: 'Fábio e Juliano',
    saldoCaixaAnterior: 0,
    saidasNesteAcerto: 0,
    saldoCaixaAtual: 0,
    reserveAmount: 0,
    tipoHistorico: 'reembolso-divisao',
  };
}

function pessoaAcertoHistorico(key, nome, percentagem, lucro, reembolso = 0) {
  const parte = roundMoney(lucro);
  const reemb = roundMoney(reembolso);
  return {
    key,
    nome,
    percentagem,
    reembolso: reemb,
    lucro: parte,
    totalDestinado: roundMoney(reemb + parte),
    jaRecebido: 0,
    jaTransferido: 0,
    faltaTransferir: key === 'emerson' ? 0 : parte,
    statusTransferencia: key === 'emerson' ? 'emerson' : 'pendente',
    aReceber: parte,
    totalCusto: reemb,
  };
}

function acerto1HistoricoSintra() {
  const pessoas = [
    pessoaAcertoHistorico('emerson', 'Emerson', 40, 1920, 0),
    pessoaAcertoHistorico('fabio', 'Fábio', 30, 1440, 0),
    pessoaAcertoHistorico('juliano', 'Juliano', 30, 1440, 0),
  ];
  return {
    id: 'acerto-historico-sintra-1',
    numero: 1,
    titulo: 'Acerto 1',
    status: 'fechado',
    modelo: 'parceria-historico',
    data: null,
    tipoHistorico: 'divisao-direta',
    tipoLabel: 'Divisão direta sem desconto de custos',
    distribuirLucro: true,
    diariaIds: [],
    gastoIds: [],
    gastoEmpresaIds: [],
    recebimentoIds: [],
    repasseIds: [],
    custosDescontados: [],
    transferencias: [],
    snapshot: {
      pagamentoRecebido: 4800,
      recebido: 4800,
      custos: 0,
      reservaUtilizada: 0,
      reservaFinal: 0,
      reservaCaixa: 0,
      totalConsiderado: 4800,
      saldoRemanescente: 4800,
      distribuirLucro: true,
      lucroDistribuir: 4800,
      lucroAntesCaixa: 4800,
      tipoHistorico: 'divisao-direta',
      pessoas,
      percentagemEmpresa: 40,
      percentagemFabio: 30,
      percentagemJuliano: 30,
      divisaoInformada: true,
      custosDescontados: [],
    },
  };
}

function acerto2HistoricoSintra() {
  const H = ACERTO2_SINTRA_HISTORICO;
  const pessoas = [
    pessoaAcertoHistorico('emerson', 'Emerson', 40, H.lucroEmerson, H.reembolsoEmerson),
    pessoaAcertoHistorico('fabio', 'Fábio', 30, H.lucroFabio, 0),
    pessoaAcertoHistorico('juliano', 'Juliano', 30, H.lucroJuliano, 0),
  ];
  const snapshot = {
    ...snapshotAcerto2SintraTravado(),
    pessoas,
    tipoHistorico: 'reembolso-divisao',
  };
  return {
    id: 'acerto-historico-sintra-2',
    numero: 2,
    titulo: 'Acerto 2',
    status: 'fechado',
    modelo: 'parceria-historico',
    data: '2026-09-27',
    tipoHistorico: 'reembolso-divisao',
    tipoLabel: 'Reembolso + divisão do restante',
    distribuirLucro: true,
    diariaIds: [],
    gastoIds: [],
    gastoEmpresaIds: [],
    recebimentoIds: [],
    repasseIds: [],
    custosDescontados: [],
    transferencias: [],
    snapshot,
  };
}

function assinaturaAcertoHistorico(acerto) {
  const snap = acerto?.snapshot || {};
  const pessoas = asRecordList(snap.pessoas).map((pessoa) =>
    [pessoa.key, pessoa.lucro, pessoa.reembolso, pessoa.totalDestinado].join(':')
  );
  return [
    acerto?.numero,
    acerto?.status,
    acerto?.data || '',
    acerto?.tipoHistorico || '',
    snap.recebido,
    snap.custos,
    snap.lucroDistribuir,
    snap.reembolsoConsolidadoEmerson || 0,
    pessoas.join('|'),
  ].join(';');
}

function encaixarAcertoHistorico(lista, acerto) {
  const idx = lista.findIndex(
    (item) => item && (item.id === acerto.id || Number(item.numero) === Number(acerto.numero))
  );
  if (idx === -1) return [...lista, acerto];
  const atual = lista[idx];
  const merged = {
    ...acerto,
    id: atual.id || acerto.id,
    createdAt: atual.createdAt || new Date().toISOString(),
  };
  if (assinaturaAcertoHistorico(atual) === assinaturaAcertoHistorico(merged)) return lista;
  const next = lista.slice();
  next[idx] = merged;
  return next;
}

/** Grava os dois Acertos históricos da Sintra. Não altera diárias, gastos nem outras obras. */
export function registrarAcertosHistoricosSintra(obra) {
  if (!isObraJorgeSintraCasaDeBanho(obra)) return obra;
  const atual = getAcertosParceria(obra);
  let next = encaixarAcertoHistorico(atual, acerto1HistoricoSintra());
  next = encaixarAcertoHistorico(next, acerto2HistoricoSintra());
  next = [...next].sort((a, b) => (Number(a?.numero) || 0) - (Number(b?.numero) || 0));
  const acertosIguais =
    next.length === atual.length &&
    next.every((item, index) => assinaturaAcertoHistorico(item) === assinaturaAcertoHistorico(atual[index]));
  const valorEmFalta = !(Number(obra.valorContratado) > 0);
  if (acertosIguais && !valorEmFalta) return obra;
  return {
    ...obra,
    ...(valorEmFalta ? { valorContratado: 19750 } : {}),
    acertosParceria: next,
    updatedAt: new Date().toISOString(),
  };
}

function fechoHistoricoSintraAtivo(obra) {
  if (!isObraJorgeSintraCasaDeBanho(obra)) return false;
  return getAcertosParceria(obra).some(
    (acerto) =>
      acerto &&
      acerto.status === 'fechado' &&
      (acerto.tipoHistorico === 'reembolso-divisao' || isAcerto2HistoricoSintra(obra, acerto))
  );
}

/** Pendência do próximo Acerto. Não altera o lançamento original. */
function lancamentoJaFechadoHistorico(obra, item) {
  if (!fechoHistoricoSintraAtivo(obra)) return false;
  const data = String(item?.data || '').slice(0, 10);
  if (!data) return false;
  return data <= DATA_FECHO_HISTORICO_SINTRA;
}

export function recebimentosEmFaltaSintra(obra, pagamentos = []) {
  if (!isObraJorgeSintraCasaDeBanho(obra)) return [];
  const lista = asRecordList(pagamentos).filter(
    (item) => item && String(item.obraId) === String(obra.id) && item.tipo === 'Recebimento de cliente'
  );
  const temValor = (valor) =>
    lista.some((item) => Math.abs((Number(item.valorRecebido ?? item.valor) || 0) - valor) < 0.02);
  const faltam = [];
  if (!temValor(4800)) {
    faltam.push({
      valor: 4800,
      data: null,
      descricao: 'Recebimento da obra — Acerto 1',
    });
  }
  if (!temValor(6400)) {
    faltam.push({
      valor: 6400,
      data: '2026-09-27',
      descricao: 'Recebimento da obra — 27/09/2026',
    });
  }
  return faltam;
}

export function isAcerto1HistoricoBraga4(obra, acerto = null) {
  if (!obra || !isPartnershipObra(obra)) return false;
  if (!isObraParceriaComDiariasJaIncluidas(obra)) return false;
  if (!acerto) return getAcertosParceria(obra).length === 0;
  return isAcertoParceriaNumeroUm(obra, acerto);
}

function fechamentoFromSnapshot(snap = {}) {
  const pagamento = roundMoney(snap.pagamentoRecebido ?? snap.recebido ?? 0);
  const reservaUtilizada = roundMoney(snap.reservaUtilizada ?? 0);
  const reservaAnterior = roundMoney(snap.reservaAnterior ?? 0);
  const reservaFinal = roundMoney(snap.reservaFinal ?? snap.reservaCaixa ?? 0);
  const custos = roundMoney(snap.custos ?? 0);
  const totalConsiderado =
    snap.totalConsiderado != null ? roundMoney(snap.totalConsiderado) : roundMoney(pagamento + reservaUtilizada);
  const semDistribuicao = snap.distribuirLucro === false;
  const saldoRemanescente =
    snap.saldoRemanescente != null
      ? roundMoney(snap.saldoRemanescente)
      : roundMoney(totalConsiderado - custos - reservaFinal);
  const valorDivisao = semDistribuicao ? 0 : roundMoney(snap.lucroDistribuir ?? 0);
  return {
    pagamento,
    reservaAnterior,
    reservaUtilizada,
    reservaFinal,
    custos,
    totalConsiderado,
    resultadoAntesReservaFinal: roundMoney(totalConsiderado - custos),
    saldoRemanescente,
    distribuirLucro: snap.distribuirLucro === true,
    semDistribuicao,
    distribuicaoConhecida: snap.distribuirLucro === true || snap.distribuirLucro === false,
    lucroDistribuido: valorDivisao,
    valorDivisao,
    semLucroDisponivel: snap.distribuirLucro === true && valorDivisao <= 0.004,
    reservaExcede: false,
    divisaoNegativa: false,
    nenhumCusto: custos <= 0.004,
    nenhumaReserva: reservaUtilizada <= 0.004,
    reservaNaoTrazida: roundMoney(Math.max(0, reservaAnterior - reservaUtilizada)),
    ...(snap.novaReservaDeixada != null
      ? { novaReservaDeixada: roundMoney(snap.novaReservaDeixada) }
      : {}),
    ...(snap.custosPagosPelaReserva != null
      ? { custosPagosPelaReserva: roundMoney(snap.custosPagosPelaReserva) }
      : {}),
    ...(snap.custosCobertosPeloDinheiroNovo != null
      ? { custosCobertosPeloDinheiroNovo: roundMoney(snap.custosCobertosPeloDinheiroNovo) }
      : {}),
    ...(snap.reservaRestante != null ? { reservaRestante: roundMoney(snap.reservaRestante) } : {}),
  };
}

export function calculoFromAcertoFechado(obra, acerto) {
  if (!acerto) return null;
  const canonicoSintra = isAcerto2HistoricoSintra(obra, acerto) ? snapshotAcerto2SintraTravado() : null;
  const locked = Boolean(
    acerto.historicalSnapshotLocked || acerto.historicalConsolidatedValues || acerto.valoresConsolidados
  );
  const stored = acerto.snapshot && typeof acerto.snapshot === 'object' ? acerto.snapshot : null;
  const snap = canonicoSintra || (stored ? { ...stored } : locked ? snapshotAcerto1Braga4Travado() : {});
  const fechamentoGuardado = fechamentoFromSnapshot(snap);
  const pessoas = asRecordList(snap.pessoas).map((pessoa) => {
    const bloco =
      pessoa.key === 'juliano' ? snap.juliano : pessoa.key === 'fabio' ? snap.fabio : snap.emerson;
    return { ...pessoa, bloco };
  });
  return {
    numero: acerto.numero || 1,
    titulo: acerto.titulo || tituloAcertoParceria(acerto.numero || 1),
    reembolsoConsolidadoHistorico: Boolean(canonicoSintra),
    reembolsoConsolidadoEmerson: snap.reembolsoConsolidadoEmerson || 0,
    notaHistorica: snap.notaHistorica || '',
    braga4: locked,
    historicalConsolidatedValues: locked,
    historicalSnapshotLocked: locked || Boolean(snap.historicalSnapshotLocked),
    valoresConsolidados: locked,
    diariasJaIncluidas: locked,
    fechamento: fechamentoGuardado,
    reserveAmount: snap.reservaCaixa,
    percentagemEmpresa: snap.percentagemEmpresa ?? 40,
    percentagemParceiro: snap.percentagemParceiro ?? 60,
    percentagemFabio: snap.percentagemFabio ?? 30,
    percentagemJuliano: snap.percentagemJuliano ?? 30,
    parceiroNome: snap.parceiroNome || 'Fábio e Juliano',
    custosDescontados: asRecordList(snap.custosDescontados || acerto.custosDescontados),
    diarias: [],
    gastos: [],
    recebimentos: [],
    repasses: [],
    transferencias: asRecordList(acerto.transferencias),
    emerson: snap.emerson,
    fabio: snap.fabio,
    juliano: snap.juliano,
    caixa: snap.caixa,
    recebido: snap.recebido,
    custos: snap.custos,
    custosConsiderados: snap.custos,
    lucro: snap.lucroAntesCaixa,
    lucroAntesCaixa: snap.lucroAntesCaixa,
    resultadoAntesCaixa: snap.lucroAntesCaixa,
    reservaCaixa: snap.reservaCaixa,
    mantidoNoCaixa: snap.reservaCaixa,
    lucroDistribuir: snap.lucroDistribuir,
    destinoRecebido: snap.destinoRecebido,
    pessoas,
    saldoCaixaAnterior: snap.saldoCaixaAnterior,
    saidasNesteAcerto: snap.saidasNesteAcerto,
    saldoCaixaAtual: snap.saldoCaixaAtual,
    gastoIds: asIdList(acerto.gastoIds),
    gastoEmpresaIds: asIdList(acerto.gastoEmpresaIds),
    diariaIds: asIdList(acerto.diariaIds),
    recebimentoIds: asIdList(acerto.recebimentoIds),
    repasseIds: asIdList(acerto.repasseIds),
  };
}

function isAcertoParceriaNumeroUm(obra, acerto = null) {
  if (!acerto) return false;
  if (Number(acerto.numero) === 1) return true;
  if (/acerto\s*1\b/i.test(String(acerto.titulo || ''))) return true;
  const primeiro = getAcertosParceria(obra)[0];
  return Boolean((acerto.id && primeiro?.id === acerto.id) || (acerto.acertoId && primeiro?.id === acerto.acertoId));
}

export function isAcertoParceriaValoresConsolidados(obra, acerto = null) {
  return isAcerto1HistoricoBraga4(obra, acerto);
}

export function totaisGastosLayoutPrincipal(obra, gastos = []) {
  const lista = asRecordList(gastos).filter((item) => mesmoObraId(item, obra?.id));
  const pagadores = summarizeGastosPorPagador(lista, obra);
  return {
    emerson: pagadores.totalEmerson,
    fabio: pagadores.totalFabio,
    juliano: pagadores.totalJuliano,
    caixa: pagadores.totalCaixa,
    total: pagadores.total,
    ids: lista.filter((item) => item?.id != null && item.id !== '').map((item) => String(item.id)),
  };
}

export function regrasAcertoParceriaHistorico(obra, acerto = null, reservaInformada = null) {
  const consolidado = isAcertoParceriaValoresConsolidados(obra, acerto);
  const informada = roundMoney(Number(reservaInformada ?? acerto?.reservaCaixa ?? acerto?.snapshot?.reservaCaixa) || 0);
  const reservaCaixa = consolidado
    ? (informada > 0.004 ? informada : BRAGA4_RESERVA_CAIXA_ACERTO1)
    : Math.max(0, informada);
  return {
    consolidado,
    reservaCaixa,
    julianoJaPago: consolidado,
    diariasJaIncluidas: consolidado,
  };
}

function mesmoObraId(item, obraId) {
  return item && String(item.obraId) === String(obraId);
}

function movimentoChave(item, prefix) {
  if (item?.id != null && item.id !== '') return String(item.id);
  return [prefix, item?.data || '', item?.valor ?? item?.valorRecebido ?? '', item?.createdAt || ''].join(':');
}

function isGastoCompras(gasto) {
  return Boolean(gasto) && !GASTO_CATEGORIAS_DIARIA_LEGACY.includes(gasto.categoria);
}

function valorRecebidoCliente(pagamento) {
  if (!pagamento || pagamento.tipo !== 'Recebimento de cliente') return 0;
  const status = pagamento.status || 'pago';
  if (status === 'pendente' || status === 'cancelado') return Number(pagamento.valorRecebido) || 0;
  return Number(pagamento.valorRecebido ?? pagamento.valor) || 0;
}

function isRecebimentoAcerto(pagamento) {
  if (!pagamento || pagamento.tipo !== 'Recebimento de cliente') return false;
  if (String(pagamento.status || '').toLowerCase() === 'cancelado') return false;
  return Math.abs(valorRecebidoCliente(pagamento)) > 0.004;
}

function papelPessoa(funcionario) {
  const nome = primeiroNomePessoa(funcionario?.nome);
  if (nome === 'emerson') return 'emerson';
  if (nome === 'fabio') return 'fabio';
  if (nome === 'juliano') return 'juliano';
  return 'funcionario';
}

function pagadorKey(gasto, obra) {
  const id = resolveGastoPagadorId(gasto, obra);
  if (id === GASTO_PAGADOR.FABIO) return 'fabio';
  if (id === GASTO_PAGADOR.JULIANO) return 'juliano';
  if (id === GASTO_PAGADOR.CAIXA) return 'caixa';
  return 'emerson';
}

export function getAcertosParceria(obra) {
  return asRecordList(obra?.acertosParceria)
    .filter((item) => item && item.id)
    .sort((a, b) => (Number(a.numero) || 0) - (Number(b.numero) || 0));
}

function totaisGastosDoAcerto(gastosSel) {
  const linhas = asRecordList(gastosSel);
  const soma = (pagador) => somarLinhas(linhas.filter((item) => item.pagador === pagador), (item) => item.valor);
  return {
    emerson: soma('emerson'),
    fabio: soma('fabio'),
    juliano: soma('juliano'),
    caixa: soma('caixa'),
  };
}

export function getProximoNumeroAcertoParceria(obra) {
  const numeros = getAcertosParceria(obra).map((item) => Number(item.numero) || 0);
  return (numeros.length ? Math.max(...numeros) : 0) + 1;
}

export function tituloAcertoParceria(numero) {
  return `Acerto ${Number(numero) || 1}`;
}

export function getMovimentosCaixaParceria(obra) {
  return asRecordList(obra?.caixaParceria?.movimentos).filter((item) => item && item.id);
}

export function getSaldoCaixaParceria(obra, untilIso = null) {
  return roundMoney(
    getMovimentosCaixaParceria(obra).reduce((sum, item) => {
      if (untilIso && String(item.createdAt || item.data || '') > String(untilIso)) return sum;
      const valor = Math.abs(Number(item.valor) || 0);
      if (item.tipo === 'saida') return sum - valor;
      return sum + valor;
    }, 0)
  );
}

export function getUltimoAcertoFechado(obra) {
  const fechados = getAcertosParceria(obra).filter((item) => item && item.status === 'fechado');
  return fechados[fechados.length - 1] || null;
}

/** Reserva deixada pelo último Acerto que ainda existe. Não soma Acertos entre si. */
export function getReservaDisponivelParceria(obra, exceptAcertoId = null) {
  const fechados = getAcertosParceria(obra).filter(
    (item) => item && item.status === 'fechado' && String(item.id) !== String(exceptAcertoId || '')
  );
  const ultimo = fechados[fechados.length - 1];
  if (!ultimo) return 0;
  const snap = ultimo.snapshot || {};
  return roundMoney(Number(snap.reservaFinal ?? snap.reservaCaixa ?? ultimo.reservaCaixa ?? ultimo.reserveAmount) || 0);
}

export function resumoAcertoParaHistorico(acerto, obra = null) {
  if (isAcerto2HistoricoSintra(obra, acerto)) {
    const H = ACERTO2_SINTRA_HISTORICO;
    return {
      recebido: H.recebido,
      reservaUtilizada: 0,
      custos: H.custos,
      reservaDeixada: 0,
      dividido: H.restante,
      distribuirLucro: true,
    };
  }
  const snap = acerto?.snapshot || {};
  return {
    recebido: roundMoney(snap.pagamentoRecebido ?? snap.recebido ?? 0),
    reservaUtilizada: roundMoney(snap.reservaUtilizada ?? 0),
    custos: roundMoney(snap.custos ?? 0),
    reservaDeixada: roundMoney(snap.reservaFinal ?? snap.reservaCaixa ?? acerto?.reservaCaixa ?? 0),
    dividido: snap.distribuirLucro === false ? 0 : roundMoney(snap.lucroDistribuir ?? 0),
    distribuirLucro: snap.distribuirLucro === true ? true : snap.distribuirLucro === false ? false : null,
  };
}

export function getRascunhoAcertoParceria(obra) {
  const rascunho = obra?.rascunhoAcertoParceria;
  if (!rascunho || typeof rascunho !== 'object') return null;
  if (!rascunho.savedAt && !rascunho.updatedAt) return null;
  return rascunho;
}

export function salvarRascunhoAcertoParceria(obra, rascunho = {}) {
  if (!obra) return obra;
  return {
    ...obra,
    rascunhoAcertoParceria: {
      pagamento: String(rascunho.pagamento ?? ''),
      usarReserva: Boolean(rascunho.usarReserva),
      reservaUtilizada: String(rascunho.reservaUtilizada ?? ''),
      reservaFinal: String(rascunho.reservaFinal ?? ''),
      gastoIds: asIdList(rascunho.gastoIds),
      diariaIds: asIdList(rascunho.diariaIds),
      distribuirLucro: rascunho.distribuirLucro === true,
      modo: rascunho.modo === 'dividir' || rascunho.modo === 'custos-lucro' ? rascunho.modo : 'custos',
      savedAt: new Date().toISOString(),
    },
    updatedAt: new Date().toISOString(),
  };
}

export function excluirRascunhoAcertoParceria(obra) {
  if (!obra || !obra.rascunhoAcertoParceria) return obra;
  return {
    ...obra,
    rascunhoAcertoParceria: null,
    updatedAt: new Date().toISOString(),
  };
}

function somaCampo(lista, pick) {
  return roundMoney(asRecordList(lista).reduce((sum, item) => sum + (Number(pick(item)) || 0), 0));
}

/** Acerto confirmado já é o pagamento aos sócios. Não há saldo a transferir depois. */
export function resumoRepassesParceria(_obra) {
  return {
    pendenteTotal: 0,
    historico: [],
  };
}

export function linhasCaixaComSaldo(obra) {
  let saldo = 0;
  return getMovimentosCaixaParceria(obra)
    .slice()
    .sort((a, b) =>
      String(a.data || a.createdAt || '').localeCompare(String(b.data || b.createdAt || ''))
    )
    .map((item) => {
      const valor = Math.abs(Number(item.valor) || 0);
      if (item.tipo === 'saida') saldo = roundMoney(saldo - valor);
      else saldo = roundMoney(saldo + valor);
      return { ...item, valor, saldoApos: saldo };
    });
}

export function resumoPeriodoAposUltimoAcerto(
  obra,
  { gastos = [], gastosEmpresa = [], diarias = [], pagamentos = [], funcionarios = [] } = {}
) {
  const ultimo = getUltimoAcertoFechado(obra);
  const pendentes = listarPendentesAcertoParceria(
    obra,
    { gastos, gastosEmpresa, diarias, pagamentos, funcionarios },
    { valoresConsolidados: false }
  );
  const gastosDe = (key) => asRecordList(pendentes.gastos).filter((item) => item.pagador === key);
  const diariasDe = (key) => asRecordList(pendentes.diarias).filter((item) => item.papel === key);
  const pessoa = (key, nome) => {
    const gs = gastosDe(key);
    const ds = diariasDe(key);
    const gastosValor = somaCampo(gs, (item) => item.valor);
    const diariasValor = somaCampo(ds, (item) => item.valorCusto || item.referencia);
    return {
      key,
      nome,
      gastos: gs,
      diarias: ds,
      gastosValor,
      diariasValor,
      total: roundMoney(gastosValor + diariasValor),
    };
  };
  const emersonGastos = pessoa('emerson', 'Emerson');
  const fabio = pessoa('fabio', 'Fábio');
  const juliano = pessoa('juliano', 'Juliano');
  const maoDeObra = diariasDe('funcionario');
  const maoDeObraValor = somaCampo(maoDeObra, (item) => item.valorCusto || item.referencia);
  const emerson = {
    ...emersonGastos,
    maoDeObra,
    maoDeObraValor,
    total: roundMoney(emersonGastos.gastosValor + emersonGastos.diariasValor + maoDeObraValor),
  };
  const caixaGastos = gastosDe('caixa');
  const caixaGastosValor = somaCampo(caixaGastos, (item) => item.valor);
  const usado = getMovimentosJaAcertadosParceria(obra);
  const movimentos = linhasCaixaComSaldo(obra);
  const entradas = somaCampo(
    movimentos.filter((item) => item.tipo !== 'saida'),
    (item) => item.valor
  );
  const saidas = somaCampo(
    movimentos.filter((item) => item.tipo === 'saida'),
    (item) => item.valor
  );
  const saidasPeriodo = somaCampo(
    movimentos.filter((item) => {
      if (item.tipo !== 'saida') return false;
      if (item.acertoId) return false;
      if (item.gastoId && usado.gastoIds.has(String(item.gastoId))) return false;
      return true;
    }),
    (item) => item.valor
  );
  const totalNovosCustos = roundMoney(emerson.total + fabio.total + juliano.total + caixaGastosValor);
  const reservaInicial = roundMoney(
    Number(
      ultimo?.snapshot?.reservaCaixa ??
        ultimo?.reservaCaixa ??
        ultimo?.reserveAmount ??
        0
    ) || 0
  );
  const acimaDaReserva = roundMoney(Math.max(0, totalNovosCustos - reservaInicial));
  const reservaRestante = roundMoney(Math.max(0, reservaInicial - totalNovosCustos));
  const percentagemUtilizada =
    reservaInicial > 0.004 ? Math.min(100, (totalNovosCustos / reservaInicial) * 100) : totalNovosCustos > 0.004 ? 100 : 0;
  let reservaNivel = 'ok';
  let reservaAlerta = 'Reserva disponível';
  if (reservaInicial <= 0.004 && totalNovosCustos > 0.004) {
    reservaNivel = 'esgotada';
    reservaAlerta = 'RESERVA ESGOTADA — SOLICITAR NOVO PAGAMENTO';
  } else if (reservaInicial > 0.004 && totalNovosCustos + 0.004 >= reservaInicial) {
    reservaNivel = 'esgotada';
    reservaAlerta = 'RESERVA ESGOTADA — SOLICITAR NOVO PAGAMENTO AOS CONTRATANTES.';
  } else if (percentagemUtilizada >= 80) {
    reservaNivel = 'proxima';
    reservaAlerta = 'Reserva próxima do limite — considerar solicitar novo pagamento';
  }
  return {
    ultimo,
    pendentes,
    emerson,
    fabio,
    juliano,
    maoDeObra,
    maoDeObraValor,
    caixaGastos,
    caixaGastosValor,
    totalNovosCustos,
    reserva: {
      inicial: reservaInicial,
      consumido: totalNovosCustos,
      restante: reservaRestante,
      acima: acimaDaReserva,
      percentagem: percentagemUtilizada,
      nivel: reservaNivel,
      alerta: reservaAlerta,
    },
    caixa: {
      saldo: getSaldoCaixaParceria(obra),
      entradas,
      saidas,
      saidasPeriodo,
      movimentos,
    },
    repasses: resumoRepassesParceria(obra),
  };
}

function acertoSnapshotSemFecharGastosPorId(obra, acerto) {
  if (!acerto) return false;
  return Boolean(
    acerto.historicalSnapshotLocked ||
      acerto.historicalConsolidatedValues ||
      acerto.valoresConsolidados ||
      isAcerto1HistoricoBraga4(obra, acerto)
  );
}

function snapshotValorGastosPessoa(snapshot, key) {
  const bloco = snapshot?.[key];
  if (!bloco) return 0;
  return gastosCheiosDoBloco(bloco);
}

function ordenarGastosPeriodo(lista) {
  return [...asRecordList(lista)].sort((a, b) => {
    const data = String(a.data || '').localeCompare(String(b.data || ''));
    if (data) return data;
    const criado = String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
    if (criado) return criado;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });
}

/**
 * O Acerto 1 histórico guarda um total consolidado e, por engano, os IDs do layout
 * inteiro — incluindo compras posteriores. Os gastos novos não podem ficar
 * presos a esse dump. Os totais do snapshot não são recalculados.
 */
function gastosAposSnapshotConsolidado(gastos, snapshot) {
  const linhas = asRecordList(gastos);
  if (!snapshot) return linhas;
  const restantes = [];
  ['emerson', 'fabio', 'juliano', 'caixa'].forEach((key) => {
    const snap = roundMoney(snapshotValorGastosPessoa(snapshot, key));
    const lista = ordenarGastosPeriodo(linhas.filter((item) => item.pagador === key));
    const soma = roundMoney(lista.reduce((sum, item) => sum + (Number(item.valor) || 0), 0));
    if (snap <= 0.004) {
      restantes.push(...lista);
      return;
    }
    if (soma > snap + 0.05) {
      let absorvido = 0;
      lista.forEach((item) => {
        if (absorvido + 0.004 >= snap) restantes.push(item);
        else absorvido = roundMoney(absorvido + (Number(item.valor) || 0));
      });
      return;
    }
    if (soma + 0.05 < snap) {
      restantes.push(...lista);
    }
  });
  return ordenarGastosPeriodo(restantes);
}

function getAcertoSnapshotConsolidado(obra) {
  return (
    getAcertosParceria(obra).find((item) => acertoSnapshotSemFecharGastosPorId(obra, item)) || null
  );
}

export function getMovimentosJaAcertadosParceria(obra, exceptAcertoId = null) {
  const gastoIds = new Set();
  const diariaIds = new Set();
  const recebimentoIds = new Set();
  const repasseIds = new Set();
  getAcertosParceria(obra).forEach((acerto) => {
    if (exceptAcertoId && acerto.id === exceptAcertoId) return;
    if (isAcerto2HistoricoSintra(obra, acerto)) return;
    const fechaGastosPorId = !acertoSnapshotSemFecharGastosPorId(obra, acerto);
    if (fechaGastosPorId) {
      asIdList(acerto.gastoIds).concat(asIdList(acerto.gastoEmpresaIds)).forEach((id) => gastoIds.add(String(id)));
    }
    asIdList(acerto.diariaIds).forEach((id) => diariaIds.add(String(id)));
    asIdList(acerto.recebimentoIds).forEach((id) => recebimentoIds.add(String(id)));
    asIdList(acerto.repasseIds).forEach((id) => repasseIds.add(String(id)));
  });
  return { gastoIds, diariaIds, recebimentoIds, repasseIds };
}

export function listarPendentesAcertoParceria(
  obra,
  { gastos = [], gastosEmpresa = [], diarias = [], pagamentos = [], funcionarios = [] } = {},
  { incluirIds = null, valoresConsolidados = false } = {}
) {
  if (!obra?.id) {
    return { diarias: [], gastos: [], recebimentos: [], repasses: [] };
  }
  const usado = getMovimentosJaAcertadosParceria(obra);
  const allow = incluirIds;
  const pode = (set, chave) => (allow ? allow.has(chave) : !set.has(chave));
  const diariasJaNoCusto = Boolean(valoresConsolidados);

  const diariasLista = filterDiariasDaObra(diarias, obra.id)
    .filter(
      (item) =>
        item &&
        pode(usado.diariaIds, movimentoChave(item, 'diaria')) &&
        !lancamentoJaFechadoHistorico(obra, item)
    )
    .map((item) => {
      const func = findFuncionarioById(funcionarios, item.funcionarioId);
      const papel = papelPessoa(func);
      const quantidade = getDiariaQuantidadeNaObra(item, obra.id);
      const referencia = getDiariaCustoInternoParceria(item, obra.id, funcionarios);
      const socio = papel !== 'funcionario';
      const incluidoNosGastos = diariasJaNoCusto && socio;
      return {
        id: movimentoChave(item, 'diaria'),
        data: item.data || null,
        nome: func?.nome || '—',
        papel,
        quantidade,
        referencia,
        noCusto: !incluidoNosGastos,
        incluidoNosGastos,
        valorCusto: incluidoNosGastos ? 0 : referencia,
        valorReembolso: incluidoNosGastos ? 0 : socio ? referencia : 0,
      };
    })
    .sort((a, b) => String(a.data || '').localeCompare(String(b.data || '')));

  const gastosObra = asRecordList(gastos)
    .filter(
      (item) =>
        mesmoObraId(item, obra.id) &&
        isGastoCompras(item) &&
        pode(usado.gastoIds, movimentoChave(item, 'gasto')) &&
        !lancamentoJaFechadoHistorico(obra, item)
    )
    .map((item) => ({
      id: movimentoChave(item, 'gasto'),
      data: item.data || null,
      descricao: getGastoHistoricoDescricao(item),
      pagador: pagadorKey(item, obra),
      pagadorLabel: getGastoPagadorLabel(resolveGastoPagadorId(item, obra)),
      valor: getGastoValorAssinado(item),
      origem: 'obra',
      createdAt: item.createdAt || null,
    }));

  const gastosEmp = asRecordList(gastosEmpresa)
    .filter(
      (item) =>
        mesmoObraId(item, obra.id) &&
        item.estado !== 'previsto' &&
        pode(usado.gastoIds, movimentoChave(item, 'gasto-empresa')) &&
        !lancamentoJaFechadoHistorico(obra, item)
    )
    .map((item) => ({
      id: movimentoChave(item, 'gasto-empresa'),
      data: item.data || null,
      descricao: getGastoHistoricoDescricao(item) || item.descricao || 'Gasto da empresa',
      pagador: 'emerson',
      pagadorLabel: 'Emerson',
      valor: getGastoEmpresaValor(item),
      origem: 'empresa',
      createdAt: item.createdAt || null,
    }));

  const acertoConsolidado = getAcertoSnapshotConsolidado(obra);
  const snapshotConsolidado =
    acertoConsolidado?.snapshot ||
    (isAcerto1HistoricoBraga4(obra, acertoConsolidado) ? snapshotAcerto1Braga4Travado() : null);
  const gastosLista = allow
    ? ordenarGastosPeriodo([...gastosObra, ...gastosEmp])
    : gastosAposSnapshotConsolidado([...gastosObra, ...gastosEmp], snapshotConsolidado);

  const recebimentos = asRecordList(pagamentos)
    .concat(getObraRecebimentos(obra.id, pagamentos))
    .filter((item, index, lista) => {
      if (!item || !mesmoObraId(item, obra.id) || !isRecebimentoAcerto(item)) return false;
      const chave = movimentoChave(item, 'recebimento');
      if (!pode(usado.recebimentoIds, chave)) return false;
      return lista.findIndex((other) => movimentoChave(other, 'recebimento') === chave) === index;
    })
    .map((item) => ({
      id: movimentoChave(item, 'recebimento'),
      data: item.data || null,
      descricao: item.descricao || item.observacao || 'Recebimento de cliente',
      valor: valorRecebidoCliente(item),
    }));

  const repasses = getObraRepasses(obra, pagamentos)
    .filter((item) => item && pode(usado.repasseIds, movimentoChave(item, 'repasse')))
    .map((item) => {
      const destinatario = resolveRepasseDestinatario(item, obra);
      return {
        id: movimentoChave(item, 'repasse'),
        data: item.data || null,
        destinatario,
        destinatarioNome: getRepasseDestinatarioLabel(destinatario),
        observacao: item.observacao || 'Repasse de lucro',
        valor: roundMoney(item.valor),
      };
    });

  return { diarias: diariasLista, gastos: gastosLista, recebimentos, repasses };
}

function somarLinhas(linhas, pick) {
  return roundMoney(linhas.reduce((sum, item) => sum + (Number(pick(item)) || 0), 0));
}

function blocoPessoa(key, diariasSel, gastosSel, consolidado = false) {
  const proprias = diariasSel.filter((item) => item.papel === key);
  const funcionarios = key === 'emerson' ? diariasSel.filter((item) => item.papel === 'funcionario') : [];
  const gastos = gastosSel.filter((item) => item.pagador === key);
  const diariasReferencia = somarLinhas(proprias, (item) => item.referencia || 0);
  const diariasPropriasCusto = consolidado
    ? 0
    : somarLinhas(proprias, (item) => (item.incluidoNosGastos ? 0 : item.valorCusto));
  const diariasPropriasReembolso = consolidado
    ? 0
    : somarLinhas(proprias, (item) =>
        item.incluidoNosGastos ? 0 : item.valorReembolso ?? item.referencia ?? 0
      );
  const funcionariosCusto = consolidado ? 0 : somarLinhas(funcionarios, (item) => item.valorCusto);
  const funcionariosReferencia = somarLinhas(funcionarios, (item) => item.referencia || item.valorCusto || 0);
  const gastosValor = somarLinhas(gastos, (item) => item.valor);
  const reembolso = key === 'caixa' ? 0 : roundMoney(consolidado ? gastosValor : gastosValor + diariasPropriasReembolso);
  const totalCusto = consolidado
    ? gastosValor
    : roundMoney(diariasPropriasCusto + funcionariosCusto + gastosValor);
  return {
    key,
    diariasProprias: proprias,
    funcionarios,
    gastos,
    diariasPropriasQty: somarLinhas(proprias, (item) => item.quantidade),
    diariasPropriasValor: diariasPropriasCusto,
    diariasPropriasReembolso,
    diariasReferencia,
    diariasIncluidasNosGastos: consolidado,
    funcionariosQty: somarLinhas(funcionarios, (item) => item.quantidade),
    funcionariosValor: consolidado ? funcionariosReferencia : funcionariosCusto,
    funcionariosIncluidasNosGastos: consolidado,
    gastosValor,
    reembolso,
    totalCusto,
    total: totalCusto,
  };
}

export function calcularAcertoParceriaSelecao(obra, pendentes, selecionados = {}, extras = {}) {
  const diariaIds = new Set(asIdList(selecionados.diariaIds));
  const gastoIds = new Set(asIdList(selecionados.gastoIds));
  const recebimentoIds = new Set(asIdList(selecionados.recebimentoIds));
  const numeroAcerto = extras.numero || getProximoNumeroAcertoParceria(obra);
  const braga4 = isObraParceriaComDiariasJaIncluidas(obra);
  const consolidado = Boolean(
    extras.acerto?.historicalSnapshotLocked ||
      extras.acerto?.valoresConsolidados ||
      extras.acerto?.historicalConsolidatedValues
  );
  const transferencias = asRecordList(extras.transferencias);

  const diariasSel = asRecordList(pendentes?.diarias).filter((item) => diariaIds.has(item.id));
  const gastosSel = asRecordList(pendentes?.gastos).filter((item) => gastoIds.has(item.id));
  const recebSel = asRecordList(pendentes?.recebimentos).filter((item) => recebimentoIds.has(item.id));
  const repasses = asRecordList(pendentes?.repasses);

  const emerson = blocoPessoa('emerson', diariasSel, gastosSel, consolidado);
  const fabio = blocoPessoa('fabio', diariasSel, gastosSel, consolidado);
  const juliano = blocoPessoa('juliano', diariasSel, gastosSel, consolidado);
  const caixa = blocoPessoa('caixa', diariasSel, gastosSel, consolidado);
  const gastosObraSel = gastosSel.filter((item) => item.origem !== 'empresa');
  const totaisSelecao = totaisGastosDoAcerto(gastosObraSel);
  const totaisLayout = extras.totaisLayout
    ? {
        emerson: roundMoney(extras.totaisLayout.emerson || 0),
        fabio: roundMoney(extras.totaisLayout.fabio || 0),
        juliano: roundMoney(extras.totaisLayout.juliano || 0),
        caixa: roundMoney(extras.totaisLayout.caixa || 0),
      }
    : totaisSelecao;
  if (consolidado) {
    emerson.gastosValor = totaisLayout.emerson;
    emerson.reembolso = totaisLayout.emerson;
    emerson.totalCusto = totaisLayout.emerson;
    emerson.total = totaisLayout.emerson;
    emerson.diariasPropriasValor = 0;
    emerson.diariasPropriasReembolso = 0;
    fabio.gastosValor = totaisLayout.fabio;
    fabio.reembolso = totaisLayout.fabio;
    fabio.totalCusto = totaisLayout.fabio;
    fabio.total = totaisLayout.fabio;
    fabio.diariasPropriasValor = 0;
    fabio.diariasPropriasReembolso = 0;
    juliano.gastosValor = totaisLayout.juliano;
    juliano.reembolso = totaisLayout.juliano;
    juliano.totalCusto = totaisLayout.juliano;
    juliano.total = totaisLayout.juliano;
    juliano.diariasPropriasValor = 0;
    juliano.diariasPropriasReembolso = 0;
    caixa.gastosValor = totaisLayout.caixa;
    caixa.reembolso = 0;
    caixa.totalCusto = totaisLayout.caixa;
    caixa.total = totaisLayout.caixa;
  }

  const recebidoSomado = somarLinhas(recebSel, (item) => item.valor);
  const recebido =
    extras.recebidoInformado != null && extras.recebidoInformado !== ''
      ? roundMoney(Number(extras.recebidoInformado) || 0)
      : recebidoSomado;
  const custos = consolidado
    ? roundMoney(totaisLayout.emerson + totaisLayout.fabio + totaisLayout.juliano)
    : roundMoney(emerson.totalCusto + fabio.totalCusto + juliano.totalCusto + caixa.gastosValor);
  const reservaAnterior = consolidado
    ? 0
    : roundMoney(
        extras.reservaAnterior != null
          ? Number(extras.reservaAnterior) || 0
          : getReservaDisponivelParceria(obra, extras.acertoId || null)
      );
  const reservaUtilizadaPedida =
    consolidado || extras.usarReservaAnterior === false
      ? 0
      : roundMoney(Math.max(0, Number(extras.reservaUtilizada) || 0));
  const reservaFinalPedida = consolidado
    ? roundMoney(Number(extras.reservaCaixa ?? extras.acerto?.reservaCaixa ?? extras.acerto?.snapshot?.reservaCaixa) || 0)
    : roundMoney(Math.max(0, Number(extras.reservaFinal != null ? extras.reservaFinal : extras.reservaCaixa) || 0));
  const distribuirLucro = extras.distribuirLucro === true;
  const fechamento = calcularFechamentoAcertoParceria({
    pagamento: recebido,
    reservaAnterior,
    reservaUtilizada: reservaUtilizadaPedida,
    custos,
    reservaFinal: reservaFinalPedida,
    distribuirLucro: consolidado ? true : distribuirLucro,
  });
  const novaReservaDeixada = consolidado ? reservaFinalPedida : roundMoney(fechamento.novaReservaDeixada || 0);
  const reservaCaixa = consolidado ? reservaFinalPedida : fechamento.reservaFinal;
  const lucroAntesCaixa = consolidado ? roundMoney(recebido - custos) : fechamento.resultadoAntesReservaFinal;
  const lucroDistribuir = consolidado ? roundMoney(lucroAntesCaixa - reservaCaixa) : fechamento.lucroDistribuido;
  const destinoRecebido = {
    custos,
    caixa: consolidado ? reservaCaixa : novaReservaDeixada,
    lucro: lucroDistribuir,
    total: consolidado
      ? roundMoney(custos + reservaCaixa + lucroDistribuir)
      : roundMoney((fechamento.custosCobertosPeloDinheiroNovo || 0) + novaReservaDeixada + lucroDistribuir),
  };

  const pagoPorParceiro = { emerson: 0, fabio: 0, juliano: 0 };
  const parceirosPagos = new Set(asIdList(extras.parceirosPagos));
  transferencias.forEach((item) => {
    const key = item.parceiro || item.destinatario;
    if (pagoPorParceiro[key] != null) {
      pagoPorParceiro[key] = roundMoney(pagoPorParceiro[key] + Math.abs(Number(item.valor) || 0));
    }
  });
  repasses.forEach((item) => {
    if (pagoPorParceiro[item.destinatario] != null) {
      pagoPorParceiro[item.destinatario] = roundMoney(
        pagoPorParceiro[item.destinatario] + (Number(item.valor) || 0)
      );
    }
  });

  const split = getSplitParceriaObra(obra);
  const custosDescontados = consolidado ? [] : linhasCustosDescontados(diariasSel, gastosSel);
  const emersonPct = split.find((item) => item.key === 'emerson')?.percentagem ?? 40;
  const fabioPct = split.find((item) => item.key === 'fabio')?.percentagem ?? 30;
  const julianoPct = split.find((item) => item.key === 'juliano')?.percentagem ?? 30;
  const aplicarPercentagens = consolidado || (distribuirLucro && lucroDistribuir > 0.004);
  const divisao = aplicarPercentagens && !consolidado ? dividirValorParceria(lucroDistribuir, split) : [];
  const pessoas = split.map((parte) => {
    const bloco = parte.key === 'emerson' ? emerson : parte.key === 'fabio' ? fabio : juliano;
    const lucroPessoa = !aplicarPercentagens
      ? 0
      : consolidado
        ? applyShareRate(lucroDistribuir, (Number(parte.percentagem) || 0) / 100)
        : divisao.find((item) => item.key === parte.key)?.valor ?? 0;
    const reembolso = bloco?.reembolso || 0;
    const julianoHistoricoPago = consolidado && parte.key === 'juliano';
    const jaTransferido = julianoHistoricoPago || parceirosPagos.has(parte.key)
      ? reembolso
      : pagoPorParceiro[parte.key] || 0;
    const faltaTransferir =
      parte.key === 'emerson' || julianoHistoricoPago
        ? 0
        : roundMoney(Math.max(0, reembolso - jaTransferido));
    const statusTransferencia =
      parte.key === 'emerson'
        ? 'emerson'
        : faltaTransferir <= 0.004
          ? 'pago'
          : jaTransferido > 0.004
            ? 'parcial'
            : 'pendente';
    return {
      ...parte,
      bloco,
      reembolso,
      lucro: lucroPessoa,
      jaRecebido: jaTransferido,
      jaTransferido,
      faltaTransferir,
      statusTransferencia,
      aReceber: roundMoney(reembolso + (lucroPessoa || 0) - jaTransferido),
    };
  });

  const saldoCaixaAnterior = extras.saldoCaixaAnterior != null
    ? roundMoney(extras.saldoCaixaAnterior)
    : getSaldoCaixaParceria(obra);
  const saidasNesteAcerto = consolidado ? 0 : caixa.gastosValor;
  const saldoCaixaAtual = roundMoney(
    saldoCaixaAnterior + (consolidado ? reservaCaixa : novaReservaDeixada) - saidasNesteAcerto
  );

  return {
    numero: extras.numero || numeroAcerto,
    titulo: extras.titulo || tituloAcertoParceria(extras.numero || getProximoNumeroAcertoParceria(obra)),
    braga4,
    historicalConsolidatedValues: consolidado,
    valoresConsolidados: consolidado,
    diariasJaIncluidas: consolidado,
    reserveAmount: reservaCaixa,
    fechamento,
    percentagemEmpresa: emersonPct,
    percentagemParceiro: roundMoney((Number(fabioPct) || 0) + (Number(julianoPct) || 0)),
    percentagemFabio: fabioPct,
    percentagemJuliano: julianoPct,
    parceiroNome: 'Fábio e Juliano',
    custosDescontados,
    diarias: diariasSel,
    gastos: gastosSel,
    recebimentos: recebSel,
    repasses,
    transferencias,
    emerson,
    fabio,
    juliano,
    caixa,
    recebido,
    custos,
    custosConsiderados: custos,
    lucro: lucroAntesCaixa,
    lucroAntesCaixa,
    resultadoAntesCaixa: lucroAntesCaixa,
    reservaCaixa,
    mantidoNoCaixa: reservaCaixa,
    lucroDistribuir,
    destinoRecebido,
    pessoas,
    saldoCaixaAnterior,
    saidasNesteAcerto,
    saldoCaixaAtual,
    gastoIds: gastosSel.map((item) => item.id),
    gastoEmpresaIds: gastosSel.filter((item) => item.origem === 'empresa').map((item) => item.id),
    diariaIds: diariasSel.map((item) => item.id),
    recebimentoIds: recebSel.map((item) => item.id),
    repasseIds: repasses.map((item) => item.id),
  };
}

export function idsPendentesIniciais() {
  return {
    diariaIds: [],
    gastoIds: [],
    recebimentoIds: [],
  };
}

function resumoBloco(bloco) {
  if (!bloco) return null;
  return {
    diariasPropriasQty: bloco.diariasPropriasQty,
    diariasPropriasValor: bloco.diariasPropriasValor,
    diariasPropriasReembolso: bloco.diariasPropriasReembolso,
    diariasReferencia: bloco.diariasReferencia,
    diariasIncluidasNosGastos: bloco.diariasIncluidasNosGastos,
    funcionariosQty: bloco.funcionariosQty,
    funcionariosValor: bloco.funcionariosValor,
    funcionariosIncluidasNosGastos: bloco.funcionariosIncluidasNosGastos,
    gastosValor: bloco.gastosValor,
    reembolso: bloco.reembolso,
    total: bloco.total,
    totalCusto: bloco.totalCusto,
  };
}

function gastosCheiosDoBloco(bloco = {}) {
  if (bloco.gastosValor != null) return roundMoney(bloco.gastosValor);
  const reembolso = roundMoney(bloco.reembolso || bloco.total || bloco.totalCusto || 0);
  const diarias = roundMoney(bloco.diariasPropriasReembolso ?? bloco.diariasPropriasValor ?? 0);
  return roundMoney(Math.max(0, reembolso - diarias));
}

function blocoHistoricoConsolidado(bloco) {
  if (!bloco) return null;
  const gastosValor = gastosCheiosDoBloco(bloco);
  const diariasReferencia = roundMoney(
    bloco.diariasReferencia ?? bloco.diariasPropriasReembolso ?? bloco.diariasPropriasValor ?? 0
  );
  return {
    ...bloco,
    gastosValor,
    diariasPropriasValor: 0,
    diariasPropriasReembolso: 0,
    diariasReferencia,
    diariasIncluidasNosGastos: true,
    funcionariosValor: roundMoney(bloco.funcionariosValor || 0),
    funcionariosIncluidasNosGastos: true,
    reembolso: gastosValor,
    total: gastosValor,
    totalCusto: gastosValor,
  };
}

function snapshotFromCalculo(calculo) {
  const fechamento = calculo.fechamento || {};
  const reservaFinal = roundMoney(fechamento.reservaFinal ?? calculo.reservaCaixa ?? 0);
  const reservaUtilizada = roundMoney(fechamento.reservaUtilizada ?? 0);
  const pagamento = roundMoney(fechamento.pagamento ?? calculo.recebido);
  return {
    recebido: pagamento,
    pagamentoRecebido: pagamento,
    reservaAnterior: roundMoney(fechamento.reservaAnterior ?? 0),
    reservaUtilizada,
    reservaRestante: roundMoney(fechamento.reservaRestante ?? 0),
    novaReservaDeixada: roundMoney(fechamento.novaReservaDeixada ?? 0),
    custosPagosPelaReserva: roundMoney(fechamento.custosPagosPelaReserva ?? 0),
    custosCobertosPeloDinheiroNovo: roundMoney(fechamento.custosCobertosPeloDinheiroNovo ?? 0),
    reservaFinal,
    totalConsiderado: roundMoney(fechamento.totalConsiderado ?? pagamento + reservaUtilizada),
    custos: roundMoney(calculo.custos),
    lucro: roundMoney(calculo.lucroAntesCaixa ?? calculo.lucro),
    lucroAntesCaixa: roundMoney(calculo.lucroAntesCaixa ?? calculo.lucro),
    reservaCaixa: reservaFinal,
    mantidoNoCaixa: reservaFinal,
    lucroDistribuir: roundMoney(calculo.lucroDistribuir),
    distribuirLucro: calculo.fechamento?.distribuirLucro === true,
    saldoRemanescente: roundMoney(calculo.fechamento?.saldoRemanescente ?? 0),
    destinoRecebido: calculo.destinoRecebido || {
      custos: roundMoney(calculo.custos),
      caixa: roundMoney(calculo.reservaCaixa || 0),
      lucro: roundMoney(calculo.lucroDistribuir),
      total: roundMoney(calculo.recebido),
    },
    pessoas: asRecordList(calculo.pessoas).map((pessoa) => ({
      key: pessoa.key,
      nome: pessoa.nome,
      percentagem: pessoa.percentagem,
      reembolso: pessoa.reembolso,
      lucro: pessoa.lucro,
      totalDestinado: roundMoney((Number(pessoa.reembolso) || 0) + (Number(pessoa.lucro) || 0)),
      jaRecebido: roundMoney((Number(pessoa.reembolso) || 0) + (Number(pessoa.lucro) || 0)),
      jaTransferido: roundMoney((Number(pessoa.reembolso) || 0) + (Number(pessoa.lucro) || 0)),
      faltaTransferir: 0,
      statusTransferencia: pessoa.key === 'emerson' ? 'emerson' : 'pago',
      aReceber: 0,
      totalCusto: pessoa.bloco?.totalCusto || pessoa.bloco?.total || 0,
    })),
    custosDescontados: asRecordList(calculo.custosDescontados),
    emerson: resumoBloco(calculo.emerson),
    fabio: resumoBloco(calculo.fabio),
    juliano: resumoBloco(calculo.juliano),
    caixa: resumoBloco(calculo.caixa),
    divisaoInformada: calculo.fechamento?.distribuirLucro === true,
    percentagemEmpresa: calculo.percentagemEmpresa ?? 40,
    percentagemFabio: calculo.percentagemFabio ?? 30,
    percentagemJuliano: calculo.percentagemJuliano ?? 30,
    parceiroNome: 'Fábio e Juliano',
    saldoCaixaAnterior: calculo.saldoCaixaAnterior,
    saidasNesteAcerto: calculo.saidasNesteAcerto,
    saldoCaixaAtual: calculo.saldoCaixaAtual,
    valoresConsolidados: Boolean(calculo.valoresConsolidados),
    diariasJaIncluidas: Boolean(calculo.valoresConsolidados),
    historicalConsolidatedValues: Boolean(calculo.valoresConsolidados),
    reserveAmount: reservaFinal,
  };
}

function idEntradaCaixaAcerto(acertoId) {
  return `caixa-entrada-${acertoId}`;
}

function jaTemEntradaCaixaAcerto(movimentos, acertoId) {
  const id = idEntradaCaixaAcerto(acertoId);
  return asRecordList(movimentos).some(
    (item) => item && item.tipo === 'entrada' && (item.id === id || String(item.acertoId) === String(acertoId))
  );
}

function movimentoRetencaoCaixa(acerto, valor) {
  return {
    id: idEntradaCaixaAcerto(acerto.id),
    tipo: 'entrada',
    origem: 'retencao-recebido',
    data: acerto.data || null,
    descricao: `${acerto.titulo || tituloAcertoParceria(acerto.numero)} — mantido no caixa (parte do recebido da obra)`,
    valor: roundMoney(valor),
    acertoId: acerto.id,
    createdAt: acerto.createdAt || new Date().toISOString(),
  };
}

export function recebimentoLigadoAoAcerto(acerto, pagamentos = []) {
  if (!acerto?.id) return null;
  return (
    asRecordList(pagamentos).find((item) => {
      if (!item) return false;
      if (acerto.recebimentoPagamentoId && item.id === acerto.recebimentoPagamentoId) return true;
      return item.acertoParceriaId === acerto.id;
    }) || null
  );
}

/** Recebimento real do cliente informado neste Acerto. Não mexe em pagamentos já gravados. */
export function montarRecebimentoDoAcerto(obra, acerto, pagamentos = []) {
  const valor = roundMoney(acerto?.snapshot?.pagamentoRecebido ?? acerto?.snapshot?.recebido ?? 0);
  if (!obra?.id || !acerto?.id || !(valor > 0.004)) return null;
  if (recebimentoLigadoAoAcerto(acerto, pagamentos)) return null;
  const base = buildObraPaymentRecord(
    obra,
    valor,
    {
      data: acerto.data || null,
      descricao: `Recebimento — ${acerto.titulo || tituloAcertoParceria(acerto.numero)}`,
      metodoPagamento: 'Transferência',
      observacao: '',
    },
    pagamentos
  );
  return {
    ...base,
    id: `rec-acerto-${acerto.id}`,
    acertoParceriaId: acerto.id,
  };
}

export function ligarRecebimentoAoAcerto(obra, acertoId, pagamentoId) {
  if (!obra || !acertoId || !pagamentoId) return obra;
  return {
    ...obra,
    acertosParceria: getAcertosParceria(obra).map((item) =>
      item.id === acertoId && item.recebimentoPagamentoId !== pagamentoId
        ? { ...item, recebimentoPagamentoId: pagamentoId }
        : item
    ),
  };
}

export function confirmarAcertoParceria(obra, calculo, { data, observacao = '' } = {}) {
  if (!obra || !calculo) return obra;
  if (calculo.fechamento?.reservaExcede) return obra;
  const fechamento = calculo.fechamento || {};
  const pagamento = roundMoney(fechamento.pagamento ?? calculo.recebido ?? 0);
  const reservaUtilizada = roundMoney(fechamento.reservaUtilizada ?? 0);
  const reservaFinal = roundMoney(fechamento.reservaFinal ?? calculo.reservaCaixa ?? 0);
  const custos = roundMoney(fechamento.custos ?? calculo.custos ?? 0);
  const temValor = pagamento > 0.004 || reservaUtilizada > 0.004 || custos > 0.004 || reservaFinal > 0.004;
  if (!temValor) return obra;
  const numero = getProximoNumeroAcertoParceria(obra);
  const acertoId = generateId();
  const acerto = {
    id: acertoId,
    numero,
    titulo: tituloAcertoParceria(numero),
    status: 'fechado',
    modelo: 'parceria-v3',
    data: data ? String(data).slice(0, 10) : null,
    observacao: String(observacao || '').trim(),
    createdAt: new Date().toISOString(),
    braga4: Boolean(calculo.braga4),
    historicalConsolidatedValues: false,
    valoresConsolidados: false,
    diariasJaIncluidas: false,
    distribuirLucro: fechamento.distribuirLucro === true,
    reservaCaixa: reservaFinal,
    reserveAmount: reservaFinal,
    reservaAnterior: roundMoney(fechamento.reservaAnterior ?? 0),
    reservaUtilizada,
    reservaRestante: roundMoney(fechamento.reservaRestante ?? 0),
    novaReservaDeixada: roundMoney(fechamento.novaReservaDeixada ?? 0),
    custosPagosPelaReserva: roundMoney(fechamento.custosPagosPelaReserva ?? 0),
    custosCobertosPeloDinheiroNovo: roundMoney(fechamento.custosCobertosPeloDinheiroNovo ?? 0),
    reservaFinal,
    gastoIds: asIdList(calculo.gastoIds),
    gastoEmpresaIds: asIdList(calculo.gastoEmpresaIds),
    diariaIds: asIdList(calculo.diariaIds),
    recebimentoIds: asIdList(calculo.recebimentoIds),
    repasseIds: asIdList(calculo.repasseIds),
    transferencias: [],
    parceirosPagos: calculo.valoresConsolidados ? ['juliano'] : asIdList(calculo.parceirosPagos),
    custosDescontados: asRecordList(calculo.custosDescontados),
    snapshot: snapshotFromCalculo(calculo),
  };

  if (acerto.historicalConsolidatedValues) {
    const julianoValor = roundMoney(calculo.juliano?.reembolso || 0);
    if (julianoValor > 0.004 && !acerto.transferencias.some((item) => item.parceiro === 'juliano')) {
      acerto.transferencias = [
        ...acerto.transferencias,
        {
          id: `acerto1-juliano-${acertoId}`,
          parceiro: 'juliano',
          valor: julianoValor,
          data: acerto.data,
          descricao: 'Transferido / Pago (já realizado por Emerson)',
          status: 'pago',
          acertoId,
          createdAt: acerto.createdAt,
        },
      ];
    }
  }

  return {
    ...obra,
    acertosParceria: [...getAcertosParceria(obra), acerto],
    rascunhoAcertoParceria: null,
    updatedAt: new Date().toISOString(),
  };
}

export function getAcertoParceriaById(obra, acertoId) {
  return getAcertosParceria(obra).find((item) => item.id === acertoId) || null;
}

function movimentoExclusivoDoAcerto(item, acertoId) {
  if (!item || acertoId == null || acertoId === '') return false;
  const id = String(acertoId);
  if (item.gastoId) return false;
  if (String(item.id) === idEntradaCaixaAcerto(id)) return true;
  if (item.origem === 'retencao-recebido' && String(item.acertoId) === id) return true;
  if (String(item.acertoId || '') === id) return true;
  return false;
}

export function apagarAcertoParceria(obra, acertoId) {
  if (!obra || acertoId == null || acertoId === '') return obra;
  const alvo = getAcertoParceriaById(obra, acertoId);
  if (!alvo) return obra;
  const remaining = getAcertosParceria(obra).filter((item) => String(item.id) !== String(acertoId));
  const movimentos = getMovimentosCaixaParceria(obra).filter(
    (item) => !movimentoExclusivoDoAcerto(item, acertoId)
  );
  const eraAcerto1Travado =
    Boolean(alvo.historicalSnapshotLocked) || isAcerto1HistoricoBraga4(obra, alvo);
  return {
    ...obra,
    acertosParceria: remaining,
    caixaParceria: { movimentos },
    ...(eraAcerto1Travado ? { acerto1HistoricoBraga4NaoRecriar: true } : {}),
    updatedAt: new Date().toISOString(),
  };
}

export function registrarSaidaCaixaParceria(obra, { data, descricao, valor, acertoId = null } = {}) {
  const montante = Math.abs(roundMoney(valor));
  if (!obra || !(montante > 0.004)) return obra;
  const movimento = {
    id: generateId(),
    tipo: 'saida',
    data: data ? String(data).slice(0, 10) : null,
    descricao: String(descricao || 'Saída do caixa').trim(),
    valor: montante,
    acertoId: acertoId || null,
    createdAt: new Date().toISOString(),
  };
  return {
    ...obra,
    caixaParceria: { movimentos: [...getMovimentosCaixaParceria(obra), movimento] },
    updatedAt: new Date().toISOString(),
  };
}

export function syncCaixaParceriaComGasto(obra, gasto, previous = null) {
  if (!obra || !isPartnershipObra(obra) || !gasto?.id) return obra;
  const isCaixa = resolveGastoPagadorId(gasto, obra) === GASTO_PAGADOR.CAIXA;
  const wasCaixa = previous ? resolveGastoPagadorId(previous, obra) === GASTO_PAGADOR.CAIXA : false;
  const movimentos = getMovimentosCaixaParceria(obra);
  const linkedId = `caixa-gasto-${gasto.id}`;
  const without = movimentos.filter((item) => item.id !== linkedId && item.gastoId !== gasto.id);

  if (!isCaixa) {
    if (!wasCaixa) return obra;
    return { ...obra, caixaParceria: { movimentos: without }, updatedAt: new Date().toISOString() };
  }

  const movimento = {
    id: linkedId,
    tipo: 'saida',
    data: gasto.data || null,
    descricao: getGastoHistoricoDescricao(gasto) || gasto.descricao || 'Gasto pago pelo caixa',
    valor: Math.abs(getGastoValorAssinado(gasto)),
    gastoId: gasto.id,
    createdAt: previous ? movimentos.find((item) => item.id === linkedId)?.createdAt || new Date().toISOString() : new Date().toISOString(),
  };
  return {
    ...obra,
    caixaParceria: { movimentos: [...without, movimento] },
    updatedAt: new Date().toISOString(),
  };
}

export function registrarTransferenciaParceria(obra, acertoId, { parceiro, valor, data, descricao = '' } = {}) {
  const acerto = getAcertoParceriaById(obra, acertoId);
  if (!acerto || (parceiro !== 'fabio' && parceiro !== 'juliano')) return obra;
  const montante = Math.abs(roundMoney(valor));
  if (!(montante > 0.004)) return obra;
  const transferencia = {
    id: generateId(),
    parceiro,
    valor: montante,
    data: data ? String(data).slice(0, 10) : null,
    descricao: String(descricao || 'Transferido / Pago').trim(),
    status: 'pago',
    acertoId,
    createdAt: new Date().toISOString(),
  };
  return {
    ...obra,
    acertosParceria: getAcertosParceria(obra).map((item) =>
      item.id === acertoId
        ? { ...item, transferencias: [...asRecordList(item.transferencias), transferencia] }
        : item
    ),
    updatedAt: new Date().toISOString(),
  };
}

function idsLancamentosObraParaAcerto1(obra, extras = {}) {
  const layout = totaisGastosLayoutPrincipal(obra, extras.gastos || []);
  const diarias = filterDiariasDaObra(extras.diarias || [], obra.id);
  const recebimentos = asRecordList(extras.pagamentos)
    .filter((item) => mesmoObraId(item, obra.id) && item.tipo === 'Recebimento de cliente')
    .map((item) => movimentoChave(item, 'recebimento'));
  return {
    gastoIds: layout.ids,
    diariaIds: diarias.map((item) => movimentoChave(item, 'diaria')),
    recebimentoIds: recebimentos.filter(Boolean),
  };
}

function garantirTransferenciaJulianoAcerto1(acerto, valor) {
  const montante = roundMoney(valor);
  const transferencias = asRecordList(acerto.transferencias);
  const existentes = transferencias.filter((item) => item.parceiro === 'juliano');
  if (existentes.length === 0) {
    return [
      ...transferencias,
      {
        id: `acerto1-juliano-${acerto.id}`,
        parceiro: 'juliano',
        valor: montante,
        data: acerto.data || null,
        descricao: 'Transferido / Pago (já realizado por Emerson)',
        status: 'pago',
        acertoId: acerto.id,
        createdAt: acerto.createdAt || new Date().toISOString(),
      },
    ];
  }
  let atualizou = false;
  const next = transferencias.map((item) => {
    if (item.parceiro !== 'juliano') return item;
    if (!atualizou) {
      atualizou = true;
      if (roundMoney(item.valor) === montante && item.status === 'pago') return item;
      return { ...item, valor: montante, status: 'pago' };
    }
    return item;
  });
  return next;
}

function garantirEntradaCaixaAcerto(movimentos, acerto, valor) {
  const montante = roundMoney(valor);
  const id = idEntradaCaixaAcerto(acerto.id);
  const lista = asRecordList(movimentos);
  const existente = lista.find(
    (item) => item && item.tipo === 'entrada' && (item.id === id || String(item.acertoId) === String(acerto.id))
  );
  if (existente) {
    if (roundMoney(existente.valor) === montante && existente.id === id) return { movimentos: lista, changed: false };
    return {
      movimentos: lista.map((item) =>
        item === existente
          ? { ...movimentoRetencaoCaixa(acerto, montante), createdAt: existente.createdAt || acerto.createdAt }
          : item
      ),
      changed: true,
    };
  }
  return { movimentos: [...lista, movimentoRetencaoCaixa(acerto, montante)], changed: true };
}

export function persistirAcerto1HistoricoBraga4(obra, extras = {}) {
  if (!isPartnershipObra(obra)) return { obra, changed: false };
  if (!isObraParceriaComDiariasJaIncluidas(obra)) return { obra, changed: false };
  const H = ACERTO1_BRAGA4_HISTORICO;
  const acertos = getAcertosParceria(obra);
  const existente =
    acertos.find((item) => isAcertoParceriaNumeroUm(obra, item)) ||
    acertos.find((item) => item?.historicalSnapshotLocked) ||
    null;
  if (!existente) {
    if (obra?.acerto1HistoricoBraga4NaoRecriar) return { obra, changed: false };
    if (acertos.length > 0) return { obra, changed: false };
  }
  if (existente?.historicalSnapshotLocked) {
    const caixa = garantirEntradaCaixaAcerto(
      getMovimentosCaixaParceria(obra),
      existente,
      roundMoney(existente.reservaCaixa || H.reservaCaixa)
    );
    if (!caixa.changed) return { obra, changed: false };
    return {
      obra: {
        ...obra,
        caixaParceria: { movimentos: caixa.movimentos },
        updatedAt: new Date().toISOString(),
      },
      changed: true,
    };
  }
  const snapshot = snapshotAcerto1Braga4Travado();
  const gerados = idsLancamentosObraParaAcerto1(obra, extras);
  const ids = existente
    ? {
        gastoIds: asIdList(existente.gastoIds).length ? asIdList(existente.gastoIds) : gerados.gastoIds,
        gastoEmpresaIds: asIdList(existente.gastoEmpresaIds),
        diariaIds: asIdList(existente.diariaIds).length ? asIdList(existente.diariaIds) : gerados.diariaIds,
        recebimentoIds: asIdList(existente.recebimentoIds).length
          ? asIdList(existente.recebimentoIds)
          : gerados.recebimentoIds,
        repasseIds: asIdList(existente.repasseIds),
      }
    : gerados;

  const base = existente || {
    id: generateId(),
    numero: 1,
    titulo: tituloAcertoParceria(1),
    createdAt: new Date().toISOString(),
  };

  const acerto = {
    ...base,
    numero: 1,
    titulo: base.titulo || tituloAcertoParceria(1),
    status: 'fechado',
    modelo: 'parceria-v2',
    data: base.data || null,
    observacao: base.observacao || '',
    historicalSnapshotLocked: true,
    historicalConsolidatedValues: true,
    valoresConsolidados: true,
    diariasJaIncluidas: true,
    reservaCaixa: H.reservaCaixa,
    reserveAmount: H.reservaCaixa,
    gastoIds: ids.gastoIds,
    gastoEmpresaIds: ids.gastoEmpresaIds || [],
    diariaIds: ids.diariaIds,
    recebimentoIds: ids.recebimentoIds,
    repasseIds: ids.repasseIds || [],
    parceirosPagos: ['juliano'],
    snapshot,
  };
  acerto.transferencias = garantirTransferenciaJulianoAcerto1(acerto, H.juliano);

  const caixa = garantirEntradaCaixaAcerto(getMovimentosCaixaParceria(obra), acerto, H.reservaCaixa);
  const nextAcertos = existente
    ? acertos.map((item) => (item.id === existente.id ? acerto : item))
    : [acerto, ...acertos];

  const mesmaSnapshot =
    existente &&
    existente.historicalSnapshotLocked &&
    roundMoney(existente.snapshot?.recebido) === H.recebido &&
    roundMoney(existente.snapshot?.custos) === H.custos &&
    roundMoney(existente.snapshot?.reservaCaixa) === H.reservaCaixa &&
    roundMoney(existente.snapshot?.lucroDistribuir) === H.lucroDistribuir &&
    roundMoney(existente.snapshot?.emerson?.gastosValor ?? existente.snapshot?.emerson?.reembolso) === H.emerson &&
    roundMoney(existente.snapshot?.juliano?.gastosValor ?? existente.snapshot?.juliano?.reembolso) === H.juliano &&
    roundMoney(existente.reservaCaixa) === H.reservaCaixa &&
    existente.status === 'fechado';

  if (mesmaSnapshot && !caixa.changed) return { obra, changed: false };

  return {
    obra: {
      ...obra,
      acertosParceria: nextAcertos,
      caixaParceria: { movimentos: caixa.movimentos },
      updatedAt: new Date().toISOString(),
    },
    changed: true,
  };
}

export function adaptarAcertosParceriaObra(obra, extras = {}) {
  if (!obra || !isPartnershipObra(obra)) return { obra, changed: false };
  const persistido = persistirAcerto1HistoricoBraga4(obra, extras);
  obra = persistido.obra;
  const acertos = getAcertosParceria(obra);
  let movimentos = getMovimentosCaixaParceria(obra);
  let changed = persistido.changed;

  const nextAcertos = acertos.map((acerto) => {
    if (acerto.historicalSnapshotLocked || isAcerto1HistoricoBraga4(obra, acerto)) {
      return acerto;
    }
    let next = acerto;
    let acertoDirty = false;
    const regras = regrasAcertoParceriaHistorico(obra, acerto);
    const valoresConsolidados = regras.consolidado;
    let reserva = regras.reservaCaixa;
    if (roundMoney(Number(acerto.reservaCaixa ?? acerto.snapshot?.reservaCaixa) || 0) !== reserva) {
      acertoDirty = true;
    }
    const snapshot = { ...(acerto.snapshot || {}) };
    const emersonBloco = valoresConsolidados ? blocoHistoricoConsolidado(snapshot.emerson) : snapshot.emerson;
    const fabioBloco = valoresConsolidados ? blocoHistoricoConsolidado(snapshot.fabio) : snapshot.fabio;
    const julianoBloco = valoresConsolidados ? blocoHistoricoConsolidado(snapshot.juliano) : snapshot.juliano;
    const caixaBloco = valoresConsolidados ? blocoHistoricoConsolidado(snapshot.caixa) : snapshot.caixa;
    const recebido = roundMoney(snapshot.recebido || 0);
    const custosConsolidados = roundMoney(
      gastosCheiosDoBloco(emersonBloco) + gastosCheiosDoBloco(fabioBloco) + gastosCheiosDoBloco(julianoBloco)
    );
    const temBlocosGastos = Boolean(snapshot.emerson || snapshot.fabio || snapshot.juliano || snapshot.caixa);
    const custos = valoresConsolidados && temBlocosGastos && custosConsolidados > 0.004
      ? custosConsolidados
      : roundMoney(snapshot.custos || 0);
    const lucroAntes = roundMoney(recebido - custos);
    const lucroDistribuir = roundMoney(lucroAntes - reserva);
    const pessoasBase = asRecordList(snapshot.pessoas);
    const pessoas = PARCERIA_LUCRO_SPLIT.map((parte) => {
      const antiga = pessoasBase.find((item) => item.key === parte.key) || {};
      const bloco =
        parte.key === 'juliano' ? julianoBloco : parte.key === 'fabio' ? fabioBloco : emersonBloco;
      const reembolso = valoresConsolidados
        ? (gastosCheiosDoBloco(bloco) > 0.004
            ? gastosCheiosDoBloco(bloco)
            : gastosCheiosDoBloco({
                gastosValor: antiga.gastosValor,
                reembolso: antiga.reembolso,
                diariasPropriasReembolso: antiga.diariasPropriasReembolso,
              }))
        : roundMoney(
            antiga.reembolso ??
              bloco?.reembolso ??
              bloco?.gastosValor ??
              0
          );
      return {
        ...antiga,
        key: parte.key,
        nome: parte.nome,
        percentagem: parte.percentagem,
        reembolso,
        lucro: applyShareRate(lucroDistribuir, parte.percentagem / 100),
        totalCusto: valoresConsolidados ? gastosCheiosDoBloco(bloco) : antiga.totalCusto,
        faltaTransferir: parte.key === 'emerson' ? 0 : undefined,
      };
    });

    let transferencias = asRecordList(acerto.transferencias);
    let parceirosPagos = asIdList(acerto.parceirosPagos);
    if (valoresConsolidados && !parceirosPagos.includes('juliano')) {
      parceirosPagos = [...parceirosPagos, 'juliano'];
      acertoDirty = true;
    }
    if (valoresConsolidados) {
      const juliano = pessoas.find((item) => item.key === 'juliano');
      const julianoPago = roundMoney(juliano?.reembolso || 0);
      const jaTemJuliano = transferencias.some((item) => item.parceiro === 'juliano');
      if (julianoPago > 0.004 && !jaTemJuliano) {
        transferencias = [
          ...transferencias,
          {
            id: `adapt-braga4-juliano-${acerto.id}`,
            parceiro: 'juliano',
            valor: julianoPago,
            data: acerto.data || null,
            descricao: 'Transferido / Pago (já realizado por Emerson)',
            status: 'pago',
            acertoId: acerto.id,
            createdAt: acerto.createdAt || new Date().toISOString(),
          },
        ];
        acertoDirty = true;
      } else if (julianoPago > 0.004) {
        transferencias = transferencias.map((item) => {
          if (item.parceiro !== 'juliano') return item;
          if (Math.abs(roundMoney(item.valor) - julianoPago) <= 0.004 && item.status === 'pago') return item;
          acertoDirty = true;
          return {
            ...item,
            valor: julianoPago,
            status: 'pago',
            descricao: item.descricao || 'Transferido / Pago (já realizado por Emerson)',
          };
        });
      }
    }

    if (reserva > 0.004 && !jaTemEntradaCaixaAcerto(movimentos, acerto.id)) {
      movimentos = [...movimentos, movimentoRetencaoCaixa(acerto, reserva)];
      acertoDirty = true;
    }

    if (
      acertoDirty ||
      acerto.modelo !== 'parceria-v2' ||
      roundMoney(acerto.reservaCaixa || 0) !== reserva ||
      Boolean(acerto.valoresConsolidados) !== Boolean(valoresConsolidados) ||
      Boolean(acerto.diariasJaIncluidas) !== Boolean(valoresConsolidados) ||
      (valoresConsolidados && roundMoney(snapshot.custos || 0) !== custos)
    ) {
      changed = true;
      const pessoasFinal = pessoas.map((pessoa) => {
        const jaTransferido =
          pessoa.key === 'emerson'
            ? 0
            : valoresConsolidados && pessoa.key === 'juliano'
              ? pessoa.reembolso
              : pessoa.key === 'juliano' && parceirosPagos.includes('juliano')
                ? pessoa.reembolso
                : roundMoney(
                    transferencias
                      .filter((item) => item.parceiro === pessoa.key)
                      .reduce((acc, item) => acc + Math.abs(Number(item.valor) || 0), 0)
                  );
        const faltaTransferir =
          pessoa.key === 'emerson' || (valoresConsolidados && pessoa.key === 'juliano')
            ? 0
            : roundMoney(Math.max(0, pessoa.reembolso - jaTransferido));
        return {
          ...pessoa,
          jaTransferido: pessoa.key === 'emerson' ? 0 : jaTransferido,
          faltaTransferir,
          statusTransferencia:
            pessoa.key === 'emerson'
              ? 'emerson'
              : faltaTransferir <= 0.004
                ? 'pago'
                : jaTransferido > 0.004
                  ? 'parcial'
                  : 'pendente',
        };
      });
      next = {
        ...acerto,
        modelo: 'parceria-v2',
        valoresConsolidados,
        diariasJaIncluidas: valoresConsolidados,
        historicalConsolidatedValues: valoresConsolidados,
        reservaCaixa: reserva,
        reserveAmount: reserva,
        transferencias,
        parceirosPagos,
        snapshot: {
          ...snapshot,
          custos,
          lucro: lucroAntes,
          lucroAntesCaixa: lucroAntes,
          reservaCaixa: reserva,
          mantidoNoCaixa: reserva,
          lucroDistribuir,
          destinoRecebido: {
            custos,
            caixa: reserva,
            lucro: lucroDistribuir,
            total: roundMoney(custos + reserva + lucroDistribuir),
          },
          pessoas: pessoasFinal,
          emerson: emersonBloco,
          fabio: fabioBloco,
          juliano: julianoBloco,
          caixa: caixaBloco,
          valoresConsolidados,
          diariasJaIncluidas: valoresConsolidados,
          historicalConsolidatedValues: valoresConsolidados,
          reserveAmount: reserva,
          percentagemEmpresa: 40,
          percentagemFabio: 30,
          percentagemJuliano: 30,
          parceiroNome: 'Fábio e Juliano',
          divisaoInformada: true,
        },
      };
    }
    return next;
  });

  if (!changed) return { obra, changed: false };
  return {
    obra: {
      ...obra,
      acertosParceria: nextAcertos,
      caixaParceria: { movimentos },
      updatedAt: new Date().toISOString(),
    },
    changed: true,
  };
}

export function adaptarObrasParceriaAcertos(obras = [], extras = {}) {
  const source = Array.isArray(obras) ? obras : [];
  let changed = false;
  const next = source.map((obra) => {
    const result = adaptarAcertosParceriaObra(obra, extras);
    if (result.changed) changed = true;
    return result.obra;
  });
  return { obras: next, changed };
}
