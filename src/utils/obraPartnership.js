import { generateId } from '../services/storageService';
import { roundMoney } from './ivaCalculations';
import { calcObraCustosAcumulados, getObraRecebimentos, getObraRepasses } from './obraCustos';
import { getGastoValorAssinado } from './gastoDocumentoTipo';
import { getGastoEmpresaValor } from './gastoEmpresaCalculations';
import { summarizeObraExtras } from './obraExtras';
import { isPrepaidCreditObra } from './obraPrepaidCredit';
import { asRecordList, sumMoney } from './safeCollections';
import {
  buildParceiroPresencaObra,
  findFuncionarioById,
  getParceiroFuncionarios,
  isParceiroFuncionario,
  normalizePessoaNome,
  primeiroNomePessoa,
} from './funcionarioTipo';
import { diariaPertenceAObra, filterDiariasDaObra, getDiariaCustoNaObra, getDiariaQuantidadeNaObra } from './diariaObraAlocacao';

/** Custo interno da parceria por diária. Não altera o valor pago ao funcionário. */
export const PARCERIA_CUSTO_DIARIA_SOCIO = 130;
export const PARCERIA_CUSTO_DIARIA_FUNCIONARIO = 100;

/**
 * Só a obra Braga 4 tem gastos cheios (já incluem diárias).
 * Nas restantes parcerias as diárias entram no total da pessoa e no custo.
 */
export function isObraParceriaComDiariasJaIncluidas(obra) {
  const texto = [obra?.nome, obra?.codigo, obra?.referencia, obra?.local, obra?.cliente]
    .map((value) => normalizePessoaNome(value))
    .join(' ');
  const compacto = texto.replace(/[^a-z0-9]/g, '');
  if (compacto.includes('braga4')) return true;
  if (compacto.includes('braga') && compacto.includes('4')) return true;
  return /\bbraga\b/.test(texto) && /(^|\D)4(\D|$)/.test(` ${texto} `);
}

export function getPartnershipLaborCostPolicy(obra) {
  if (isObraParceriaComDiariasJaIncluidas(obra)) {
    return { enabled: false, aPartirDe: null, somarDiariasNoTotalColuna: false };
  }
  return { enabled: true, aPartirDe: null, somarDiariasNoTotalColuna: true };
}

export function diariaEntraNoCustoParceria(diaria, obra = null) {
  if (!diaria) return false;
  return !isObraParceriaComDiariasJaIncluidas(obra);
}

function isSocioCustoParceria(funcionario) {
  if (!funcionario) return false;
  if (isParceiroFuncionario(funcionario)) return true;
  const nome = primeiroNomePessoa(funcionario.nome);
  return nome === 'emerson' || nome === 'fabio' || nome === 'juliano';
}

function valorUnitarioInternoParceria(diaria, funcionario) {
  if (!isSocioCustoParceria(funcionario)) {
    const salvo = Number(diaria?.valorControleParceria);
    if (Number.isFinite(salvo) && salvo > 0.004) return salvo;
    return PARCERIA_CUSTO_DIARIA_FUNCIONARIO;
  }
  const salvo = Number(diaria?.valorDiaria);
  if (Number.isFinite(salvo) && salvo > 0.004) return salvo;
  return PARCERIA_CUSTO_DIARIA_SOCIO;
}

/** Grava só o valor de controlo da parceria nesta diária. Não mexe no valor do fechamento. */
export function aplicarValorControleParceria(diaria, { valor, observacao } = {}) {
  if (!diaria) return diaria;
  return {
    ...diaria,
    valorControleParceria: roundMoney(Number(valor)),
    observacao: observacao == null ? String(diaria.observacao || '').trim() : String(observacao).trim(),
    updatedAt: new Date().toISOString(),
  };
}

export function getDiariaCustoInternoParceria(diaria, obraId, funcionarios = []) {
  const quantidade = getDiariaQuantidadeNaObra(diaria, obraId);
  if (quantidade <= 0) return 0;
  const func = findFuncionarioById(funcionarios, diaria?.funcionarioId);
  return roundMoney(quantidade * valorUnitarioInternoParceria(diaria, func));
}

export function formatPartnershipQuantidade(quantidade) {
  const n = Number(quantidade) || 0;
  let texto;
  if (Math.abs(n - 0.5) < 0.001) texto = '0,5';
  else if (Number.isInteger(n)) texto = String(n);
  else texto = String(n).replace('.', ',');
  const singular = Math.abs(n - 1) < 0.001;
  return `${texto} ${singular ? 'diária' : 'diárias'}`;
}

function ordemMaoDeObraParceria(item) {
  const nome = primeiroNomePessoa(item?.nome);
  if (nome === 'emerson') return 0;
  if (nome === 'fabio') return 1;
  if (nome === 'juliano') return 2;
  return 10;
}

export function summarizePartnershipMaoDeObra(obraId, diarias = [], funcionarios = [], obra = null) {
  const map = new Map();
  filterDiariasDaObra(diarias, obraId).forEach((diaria) => {
    const quantidade = getDiariaQuantidadeNaObra(diaria, obraId);
    if (quantidade <= 0) return;
    const id = diaria.funcionarioId || 'sem-funcionario';
    const func = findFuncionarioById(funcionarios, diaria.funcionarioId);
    const valorConsiderado = valorUnitarioInternoParceria(diaria, func);
    const referencia = roundMoney(quantidade * valorConsiderado);
    const noCusto = diariaEntraNoCustoParceria(diaria, obra || { id: obraId }) ? referencia : 0;
    const current = map.get(id) || {
      funcionarioId: id,
      nome: func?.nome || '—',
      quantidade: 0,
      valorConsiderado,
      total: 0,
      totalNoCusto: 0,
      socio: isSocioCustoParceria(func),
    };
    current.quantidade = roundMoney(current.quantidade + quantidade);
    current.total = roundMoney(current.total + referencia);
    current.totalNoCusto = roundMoney(current.totalNoCusto + noCusto);
    map.set(id, current);
  });

  return [...map.values()].sort((a, b) => {
    const ordem = ordemMaoDeObraParceria(a) - ordemMaoDeObraParceria(b);
    if (ordem !== 0) return ordem;
    return String(a.nome).localeCompare(String(b.nome), 'pt');
  });
}

export function calcPartnershipMaoDeObra(obraId, diarias = [], funcionarios = [], obra = null) {
  return roundMoney(
    summarizePartnershipMaoDeObra(obraId, diarias, funcionarios, obra).reduce(
      (sum, item) => sum + (Number(item.totalNoCusto) || 0),
      0
    )
  );
}

export function formatPartnershipQuantidadeCurta(quantidade) {
  const n = Number(quantidade) || 0;
  if (Math.abs(n - 0.5) < 0.001) return '0,5';
  if (Number.isInteger(n)) return String(n);
  return String(n).replace('.', ',');
}

function funcionarioESocioKey(funcionario, socioKey) {
  const nome = primeiroNomePessoa(funcionario?.nome);
  if (socioKey === 'emerson') return nome === 'emerson';
  if (socioKey === 'fabio') return nome === 'fabio';
  if (socioKey === 'juliano') return nome === 'juliano';
  return false;
}

/** Resumo da mão de obra do sócio na obra (€130/diária). */
export function summarizeSocioMaoDeObraColuna(obraId, diarias = [], funcionarios = [], socioKey, obra = null) {
  let quantidade = 0;
  let valor = 0;
  filterDiariasDaObra(diarias, obraId).forEach((diaria) => {
    const func = findFuncionarioById(funcionarios, diaria.funcionarioId);
    if (!funcionarioESocioKey(func, socioKey)) return;
    quantidade += getDiariaQuantidadeNaObra(diaria, obraId);
    valor += getDiariaCustoInternoParceria(diaria, obraId, funcionarios);
  });
  quantidade = roundMoney(quantidade);
  valor = roundMoney(valor);
  const jaIncluido = isObraParceriaComDiariasJaIncluidas(obra);
  return {
    quantidade,
    valorConsiderado: PARCERIA_CUSTO_DIARIA_SOCIO,
    valor,
    incluidoNosValoresAtuais: jaIncluido,
  };
}

export function calcTotalPessoaColunaParceria(gastosPagos, maoDeObra = {}, obra = null) {
  const gastos = Number(gastosPagos) || 0;
  if (isObraParceriaComDiariasJaIncluidas(obra)) {
    return roundMoney(gastos);
  }
  return roundMoney(gastos + (Number(maoDeObra.valor) || 0));
}

function valorRecebidoCliente(pagamento) {
  if (!pagamento || pagamento.tipo !== 'Recebimento de cliente') return 0;
  const status = pagamento.status || 'pago';
  if (status === 'pendente' || status === 'cancelado') return Number(pagamento.valorRecebido) || 0;
  return Number(pagamento.valorRecebido ?? pagamento.valor) || 0;
}

export const GASTO_PAGADOR = {
  EMPRESA: 'empresa',
  PARCEIRO: 'parceiro',
  FABIO: 'fabio',
  JULIANO: 'juliano',
  CAIXA: 'caixa',
};

export const GASTO_PAGADOR_OPCOES = [
  { id: GASTO_PAGADOR.EMPRESA, label: 'Emerson' },
  { id: GASTO_PAGADOR.FABIO, label: 'Fábio' },
  { id: GASTO_PAGADOR.JULIANO, label: 'Juliano' },
  { id: GASTO_PAGADOR.CAIXA, label: 'Caixa da Parceria' },
];

function normalizePagadorNome(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function getGastoPagadorLabel(pagadorId) {
  if (pagadorId === GASTO_PAGADOR.FABIO) return 'Fábio';
  if (pagadorId === GASTO_PAGADOR.JULIANO) return 'Juliano';
  if (pagadorId === GASTO_PAGADOR.CAIXA) return 'Caixa da Parceria';
  return 'Emerson';
}

export function socioPagadorFromNome(nome) {
  const n = normalizePagadorNome(nome);
  if (!n) return null;
  if (n.includes('julian')) return GASTO_PAGADOR.JULIANO;
  if (n.includes('fabio')) return GASTO_PAGADOR.FABIO;
  return null;
}

export function resolveGastoPagadorId(gasto, obra = null) {
  const raw = String(gasto?.pagoPor || '').trim().toLowerCase();
  if (raw === GASTO_PAGADOR.CAIXA || raw.includes('caixa')) return GASTO_PAGADOR.CAIXA;
  if (raw === GASTO_PAGADOR.FABIO || raw === 'fábio') return GASTO_PAGADOR.FABIO;
  if (raw === GASTO_PAGADOR.JULIANO) return GASTO_PAGADOR.JULIANO;
  if (raw === GASTO_PAGADOR.PARCEIRO) {
    const fromNome = socioPagadorFromNome(gasto?.pagoPorNome);
    if (fromNome) return fromNome;
    const partner = getPrimaryPartner(obra);
    return socioPagadorFromNome(partner?.nome) || GASTO_PAGADOR.FABIO;
  }
  return GASTO_PAGADOR.EMPRESA;
}

export function isGastoPagoPorSocio(gasto, obra = null) {
  const id = resolveGastoPagadorId(gasto, obra);
  return id === GASTO_PAGADOR.FABIO || id === GASTO_PAGADOR.JULIANO;
}

export function isGastoPagoPorParceiro(gasto, obra = null) {
  return isGastoPagoPorSocio(gasto, obra);
}

export function summarizeGastosPorPagador(gastos = [], obra = null) {
  const lista = asRecordList(gastos);
  const grupos = {
    [GASTO_PAGADOR.EMPRESA]: [],
    [GASTO_PAGADOR.FABIO]: [],
    [GASTO_PAGADOR.JULIANO]: [],
    [GASTO_PAGADOR.CAIXA]: [],
  };

  lista.forEach((gasto) => {
    const id = resolveGastoPagadorId(gasto, obra);
    const bucket = grupos[id] ? id : GASTO_PAGADOR.EMPRESA;
    grupos[bucket].push(gasto);
  });

  const totalDe = (items) =>
    roundMoney(items.reduce((sum, item) => sum + getGastoValorAssinado(item), 0));

  const emerson = totalDe(grupos[GASTO_PAGADOR.EMPRESA]);
  const fabio = totalDe(grupos[GASTO_PAGADOR.FABIO]);
  const juliano = totalDe(grupos[GASTO_PAGADOR.JULIANO]);
  const caixa = totalDe(grupos[GASTO_PAGADOR.CAIXA]);

  return {
    emerson: grupos[GASTO_PAGADOR.EMPRESA],
    fabio: grupos[GASTO_PAGADOR.FABIO],
    juliano: grupos[GASTO_PAGADOR.JULIANO],
    caixa: grupos[GASTO_PAGADOR.CAIXA],
    socios: [...grupos[GASTO_PAGADOR.FABIO], ...grupos[GASTO_PAGADOR.JULIANO]],
    totalEmerson: emerson,
    totalFabio: fabio,
    totalJuliano: juliano,
    totalCaixa: caixa,
    totalSocios: roundMoney(fabio + juliano),
    total: roundMoney(emerson + fabio + juliano + caixa),
  };
}

export const PARTICIPANT_ROLE = {
  EMPRESA: 'empresa',
  PARCEIRO: 'parceiro',
};

export const PARTNERSHIP_PERCENT_TOTAL = 100;
export const PARTNERSHIP_PERCENT_TOLERANCE = 0.01;

const DEFAULT_REGRAS = {
  calcularAposDespesas: true,
  diariasIncluidas: true,
  gastosIncluidos: true,
  diariasParceiroSaoDespesa: true,
  dividirPrejuizo: null,
};

function pickDefinedRegras(raw = {}) {
  const source = { ...(raw || {}), ...(raw?.regras || {}) };
  const regras = {};
  Object.keys(DEFAULT_REGRAS).forEach((key) => {
    if (source[key] !== undefined) regras[key] = source[key];
  });
  return regras;
}

function roundPercent(value) {
  if (value === '' || value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function createParticipant(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const { id, role, nome, percentagem, funcionarioId = null } = source;
  const resolvedRole = role === PARTICIPANT_ROLE.EMPRESA ? PARTICIPANT_ROLE.EMPRESA : PARTICIPANT_ROLE.PARCEIRO;
  return {
    id: id || (resolvedRole === PARTICIPANT_ROLE.EMPRESA ? PARTICIPANT_ROLE.EMPRESA : generateId()),
    role: resolvedRole,
    nome: String(nome || (resolvedRole === PARTICIPANT_ROLE.EMPRESA ? 'Emerson' : 'Parceiro')).trim(),
    percentagem: roundPercent(percentagem),
    funcionarioId: funcionarioId || null,
  };
}

export function hasPercentagensNumericas(participantes = []) {
  const list = asRecordList(participantes);
  return (
    list.length > 0 &&
    list.every((parte) => {
      if (parte.percentagem == null || parte.percentagem === '') return false;
      return Number.isFinite(Number(parte.percentagem));
    })
  );
}

export function arePartnershipPercentagesInformed(partnership) {
  if (!partnership?.enabled) return false;
  if (partnership.percentagensInformadas === false) return false;
  if (!hasPercentagensNumericas(partnership.participantes)) return false;
  return !validatePartnershipPercentages(partnership.participantes);
}

export function createPartnershipConfig({
  enabled = true,
  participantes = [],
  regras = {},
  percentagensInformadas = null,
  parceiroFuncionarioId = null,
} = {}) {
  const lista = asRecordList(participantes).map((parte) => createParticipant(parte));
  const informed = percentagensInformadas === true;
  return {
    enabled: enabled !== false,
    percentagensInformadas: informed,
    parceiroFuncionarioId: parceiroFuncionarioId || lista.find((item) => item.role === PARTICIPANT_ROLE.PARCEIRO)?.funcionarioId || null,
    participantes: lista,
    regras: {
      ...DEFAULT_REGRAS,
      ...regras,
    },
  };
}

function participantesFromLegacy(raw) {
  if (Array.isArray(raw?.participantes) && raw.participantes.length > 0) {
    return raw.participantes.filter((parte) => parte && typeof parte === 'object').map((parte) => createParticipant(parte));
  }

  if (Array.isArray(raw?.partes) && raw.partes.length > 0) {
    return raw.partes.filter((parte) => parte && typeof parte === 'object').map((parte) =>
      createParticipant({
        id: parte.id,
        role: parte.role || (parte.id === PARTICIPANT_ROLE.EMPRESA ? PARTICIPANT_ROLE.EMPRESA : PARTICIPANT_ROLE.PARCEIRO),
        nome: parte.nome,
        percentagem: parte.percentagem,
      })
    );
  }

  if (raw?.parceiroNome) {
    return [
      createParticipant({
        id: PARTICIPANT_ROLE.EMPRESA,
        role: PARTICIPANT_ROLE.EMPRESA,
        nome: 'Emerson',
        percentagem: raw.percentagemEmpresa,
      }),
      createParticipant({
        id: raw.parceiroRef || generateId(),
        role: PARTICIPANT_ROLE.PARCEIRO,
        nome: raw.parceiroNome,
        percentagem: raw.percentagemParceiro,
        funcionarioId: raw.parceiroFuncionarioId || null,
      }),
    ];
  }

  return [];
}

function inferPercentagensInformadas(raw, participantes) {
  if (raw?.percentagensInformadas === true) return true;
  if (raw?.percentagensInformadas === false) return false;
  if ((participantes || []).some((parte) => parte.id === 'parceiro-fabio')) return false;
  return hasPercentagensNumericas(participantes) && !validatePartnershipPercentages(participantes);
}

export function normalizePartnership(raw) {
  try {
    if (!raw || typeof raw !== 'object') return null;

    const participantes = participantesFromLegacy(raw);
    if (participantes.length === 0) return null;

    return createPartnershipConfig({
      enabled: raw.enabled !== false,
      participantes,
      regras: pickDefinedRegras(raw),
      percentagensInformadas: inferPercentagensInformadas(raw, participantes),
      parceiroFuncionarioId: raw.parceiroFuncionarioId || null,
    });
  } catch (err) {
    console.error('[parceria] Falha ao ler a configuração da parceria', err);
    return null;
  }
}

export function getPartnership(obra) {
  return normalizePartnership(obra?.partnership);
}

export function isPartnershipObra(obra) {
  try {
    if (obra?.tipoObra === 'parceria') return true;
    return getPartnership(obra)?.enabled === true;
  } catch (err) {
    console.error('[parceria] Falha ao identificar obra em parceria', err);
    return obra?.tipoObra === 'parceria';
  }
}

export function getPartnershipParticipants(obra) {
  return getPartnership(obra)?.participantes || [];
}

export function getEmpresaParticipant(obra) {
  return (
    getPartnershipParticipants(obra).find((parte) => parte.role === PARTICIPANT_ROLE.EMPRESA) || null
  );
}

export function getPartnerParticipants(obra) {
  return getPartnershipParticipants(obra).filter((parte) => parte.role === PARTICIPANT_ROLE.PARCEIRO);
}

export function getPrimaryPartner(obra) {
  return getPartnerParticipants(obra)[0] || null;
}

export function getPartnershipPartnerName(obra) {
  return getPrimaryPartner(obra)?.nome || 'Parceiro';
}

export function getPartnershipPercentageTotal(participantes = []) {
  return roundPercent(
    asRecordList(participantes).reduce((sum, parte) => sum + (Number(parte.percentagem) || 0), 0)
  );
}

export function validatePartnershipPercentages(participantes = []) {
  const total = getPartnershipPercentageTotal(participantes);
  if (!Number.isFinite(total)) return 'As percentagens da parceria são inválidas.';
  if (Math.abs(total - PARTNERSHIP_PERCENT_TOTAL) > PARTNERSHIP_PERCENT_TOLERANCE) {
    return `A soma das percentagens deve ser ${PARTNERSHIP_PERCENT_TOTAL}%. Actual: ${total}%.`;
  }
  return null;
}

export function formatPartnershipDivision(obraOrPartnership) {
  const partnership = obraOrPartnership?.participantes
    ? obraOrPartnership
    : getPartnership(obraOrPartnership);
  if (!partnership) return 'Não informada';
  if (!arePartnershipPercentagesInformed(partnership)) return 'Não informada';
  return (partnership.participantes || [])
    .filter((parte) => parte && typeof parte === 'object')
    .map((parte) => `${parte.percentagem ?? '—'}% ${parte.nome || 'Parceiro'}`)
    .join(' / ');
}

export function partnershipToForm(obra) {
  const partnership = getPartnership(obra);
  if (!partnership?.enabled) {
    return {
      parceriaObra: 'nao',
      parceiroNome: 'Fábio',
      percentagemEmpresa: '',
      percentagemParceiro: '',
    };
  }

  const empresa = getEmpresaParticipant(obra);
  const parceiro = getPrimaryPartner(obra);
  const informed = arePartnershipPercentagesInformed(partnership);

  return {
    parceriaObra: 'sim',
    parceiroNome: parceiro?.nome || 'Fábio',
    percentagemEmpresa: informed && empresa?.percentagem != null ? String(empresa.percentagem) : '',
    percentagemParceiro: informed && parceiro?.percentagem != null ? String(parceiro.percentagem) : '',
  };
}

export function buildPartnershipFields(form, existingObra = null, { funcionarios = [] } = {}) {
  const existing = getPartnership(existingObra);

  if (form.parceriaObra !== 'sim' && form.tipoObra !== 'parceria') {
    if (!existing) return {};
    return {
      partnership: {
        ...existing,
        enabled: false,
      },
    };
  }

  const empresaExistente = existing?.participantes?.find((parte) => parte.role === PARTICIPANT_ROLE.EMPRESA);
  const parceirosExistentes = (existing?.participantes || []).filter(
    (parte) => parte.role === PARTICIPANT_ROLE.PARCEIRO
  );
  const [parceiroPrincipal, ...outrosParceiros] = parceirosExistentes;
  const parceiroNome = (form.parceiroNome || parceiroPrincipal?.nome || 'Fábio').trim() || 'Fábio';
  const matchedParceiro = findParceiroFuncionarioByNome(funcionarios, parceiroNome);
  const funcionarioId =
    matchedParceiro?.id ||
    parceiroPrincipal?.funcionarioId ||
    existing?.parceiroFuncionarioId ||
    findFabioFuncionario(funcionarios)?.id ||
    null;

  const empresaPct = form.percentagemEmpresa;
  const parceiroPct = form.percentagemParceiro;
  const hasAnyPercent = String(empresaPct || '').trim() !== '' || String(parceiroPct || '').trim() !== '';

  const participantes = [
    createParticipant({
      id: empresaExistente?.id || PARTICIPANT_ROLE.EMPRESA,
      role: PARTICIPANT_ROLE.EMPRESA,
      nome: empresaExistente?.nome || 'Emerson',
      percentagem: hasAnyPercent ? empresaPct : null,
    }),
    createParticipant({
      id: parceiroPrincipal?.id,
      role: PARTICIPANT_ROLE.PARCEIRO,
      nome: parceiroNome,
      percentagem: hasAnyPercent ? parceiroPct : null,
      funcionarioId,
    }),
    ...outrosParceiros,
  ];

  if (hasAnyPercent) {
    const percentError = validatePartnershipPercentages(participantes);
    if (percentError) return { error: percentError };
  }

  return {
    partnership: createPartnershipConfig({
      enabled: true,
      participantes,
      regras: existing?.regras,
      percentagensInformadas: hasAnyPercent,
      parceiroFuncionarioId: funcionarioId,
    }),
  };
}

export function findFabioFuncionario(funcionarios = []) {
  return findParceiroFuncionarioByNome(funcionarios, 'Fábio');
}

export function findParceiroFuncionarioByNome(funcionarios = [], nome) {
  const key = primeiroNomePessoa(nome);
  const full = normalizePessoaNome(nome);
  if (!key && !full) return null;
  const parceiros = getParceiroFuncionarios(funcionarios);
  const pool = parceiros.length ? parceiros : asRecordList(funcionarios);
  const matches = pool.filter((item) => {
    const primeiro = primeiroNomePessoa(item?.nome);
    const completo = normalizePessoaNome(item?.nome);
    return (key && primeiro === key) || (full && completo === full);
  });
  if (matches.length === 1) return matches[0];
  return matches.find((item) => item.estado === 'Ativo') || matches[0] || null;
}

export function isCatarinaObra(obra) {
  const nome = String(obra?.nome || '')
    .trim()
    .toLowerCase();
  return nome === 'catarina' || nome.startsWith('catarina -') || nome.startsWith('catarina —');
}

export function createFabioPartnershipConfig(funcionarios = [], existing = null) {
  const fabio = findFabioFuncionario(funcionarios);
  const current = existing ? normalizePartnership(existing) : null;
  if (current?.enabled) {
    const partner = current.participantes.find((parte) => parte.role === PARTICIPANT_ROLE.PARCEIRO);
    return createPartnershipConfig({
      ...current,
      parceiroFuncionarioId: current.parceiroFuncionarioId || fabio?.id || partner?.funcionarioId || null,
      participantes: current.participantes.map((parte) =>
        parte.role === PARTICIPANT_ROLE.PARCEIRO
          ? { ...parte, nome: parte.nome || fabio?.nome || 'Fábio', funcionarioId: parte.funcionarioId || fabio?.id || null }
          : { ...parte, nome: parte.nome === 'Empresa' ? 'Emerson' : parte.nome }
      ),
    });
  }

  return createPartnershipConfig({
    enabled: true,
    percentagensInformadas: false,
    parceiroFuncionarioId: fabio?.id || null,
    participantes: [
      { id: PARTICIPANT_ROLE.EMPRESA, role: PARTICIPANT_ROLE.EMPRESA, nome: 'Emerson', percentagem: null },
      {
        id: 'parceiro-fabio',
        role: PARTICIPANT_ROLE.PARCEIRO,
        nome: fabio?.nome || 'Fábio',
        percentagem: null,
        funcionarioId: fabio?.id || null,
      },
    ],
    regras: current?.regras,
  });
}

export function buildParceiroReembolso({ valor, data, observacao = '', participanteId = null } = {}) {
  const amount = roundMoney(valor);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  return {
    id: generateId(),
    valor: amount,
    data: data || null,
    observacao: String(observacao || '').trim(),
    participanteId: participanteId || null,
    createdAt: new Date().toISOString(),
  };
}

export function addParceiroReembolso(obra, reembolso) {
  if (!obra || !reembolso) return obra;
  return {
    ...obra,
    reembolsosParceiro: [...asRecordList(obra.reembolsosParceiro), reembolso],
    updatedAt: new Date().toISOString(),
  };
}

export const REPASSE_DESTINATARIO = {
  EMERSON: 'emerson',
  FABIO: 'fabio',
  JULIANO: 'juliano',
};

export const REPASSE_DESTINATARIO_OPCOES = [
  { id: REPASSE_DESTINATARIO.EMERSON, label: 'Emerson' },
  { id: REPASSE_DESTINATARIO.FABIO, label: 'Fábio' },
  { id: REPASSE_DESTINATARIO.JULIANO, label: 'Juliano' },
];

export function getRepasseDestinatarioLabel(id) {
  const found = REPASSE_DESTINATARIO_OPCOES.find((item) => item.id === id);
  return found?.label || 'Fábio';
}

export function resolveRepasseDestinatario(repasse, obra = null) {
  const raw = String(repasse?.destinatario || '').trim().toLowerCase();
  if (raw === 'emerson' || raw === 'fabio' || raw === 'juliano') return raw;
  const fromPessoa = primeiroNomePessoa(repasse?.pessoaRelacionada || repasse?.destinatarioNome);
  if (fromPessoa === 'emerson' || fromPessoa === 'fabio' || fromPessoa === 'juliano') return fromPessoa;
  const partner = primeiroNomePessoa(getPrimaryPartner(obra)?.nome || getPartnershipPartnerName(obra));
  if (partner === 'juliano' || partner === 'emerson') return partner;
  return REPASSE_DESTINATARIO.FABIO;
}

export function buildRepasseParceria({
  valor,
  data,
  observacao = '',
  pagamentoId = null,
  destinatario = null,
  id = null,
} = {}) {
  const amount = roundMoney(valor);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const dest =
    destinatario === REPASSE_DESTINATARIO.EMERSON ||
    destinatario === REPASSE_DESTINATARIO.FABIO ||
    destinatario === REPASSE_DESTINATARIO.JULIANO
      ? destinatario
      : REPASSE_DESTINATARIO.FABIO;
  return {
    id: id || generateId(),
    valor: amount,
    data: data || null,
    observacao: String(observacao || '').trim(),
    destinatario: dest,
    pagamentoId: pagamentoId || null,
    categoria: 'Repasse de parceria',
    createdAt: new Date().toISOString(),
  };
}

export function addRepasseParceria(obra, repasse) {
  if (!obra || !repasse) return obra;
  return {
    ...obra,
    repassesParceria: [...asRecordList(obra.repassesParceria), repasse],
    updatedAt: new Date().toISOString(),
  };
}

export function updateRepasseParceria(obra, repasseId, patch = {}) {
  if (!obra || !repasseId) return obra;
  const lista = asRecordList(obra.repassesParceria);
  if (!lista.some((item) => item.id === repasseId)) return obra;
  return {
    ...obra,
    repassesParceria: lista.map((item) => {
      if (item.id !== repasseId) return item;
      const nextValor = patch.valor != null ? roundMoney(patch.valor) : item.valor;
      const dest = patch.destinatario
        ? resolveRepasseDestinatario({ destinatario: patch.destinatario }, obra)
        : resolveRepasseDestinatario(item, obra);
      return {
        ...item,
        valor: nextValor,
        data: patch.data !== undefined ? patch.data : item.data,
        observacao: patch.observacao !== undefined ? String(patch.observacao || '').trim() : item.observacao,
        destinatario: dest,
        updatedAt: new Date().toISOString(),
      };
    }),
    updatedAt: new Date().toISOString(),
  };
}

export function removeRepasseParceria(obra, repasseId) {
  if (!obra || !repasseId) return obra;
  return {
    ...obra,
    repassesParceria: asRecordList(obra.repassesParceria).filter((item) => item.id !== repasseId),
    updatedAt: new Date().toISOString(),
  };
}

export function materializeRepassesParceria(obra, pagamentos = []) {
  if (!obra) return obra;
  if (Array.isArray(obra.repassesParceria)) return obra;
  const fromPagamentos = asRecordList(pagamentos).filter(
    (item) => item.obraId === obra.id && item.tipo === 'Repasse de parceria'
  );
  return {
    ...obra,
    repassesParceria: fromPagamentos.map((item) => ({
      id: item.id,
      valor: roundMoney(item.valor),
      data: item.data || null,
      observacao: String(item.observacao || '').trim(),
      destinatario: resolveRepasseDestinatario(item, obra),
      pagamentoId: item.id,
      categoria: 'Repasse de parceria',
      createdAt: item.createdAt || new Date().toISOString(),
    })),
    updatedAt: new Date().toISOString(),
  };
}

export function getRepasseStatus(parteParceiro, totalRepassado) {
  const devido = Number(parteParceiro) || 0;
  const pago = Number(totalRepassado) || 0;
  if (!(devido > 0) || !Number.isFinite(devido)) return 'pendente';
  if (pago <= 0) return 'pendente';
  if (pago + 0.009 >= devido) return 'pago';
  return 'parcial';
}

function isDiariaMarcadaPaga(diaria, fechamentosPagamento = []) {
  if (!diaria) return false;
  if (diaria.fechamentoPagamentoId) return true;
  const status = String(diaria.statusPagamento || '');
  if (status === 'Paga' || status.toLowerCase() === 'paga') return true;
  const id = diaria.id;
  if (!id) return false;
  return asRecordList(fechamentosPagamento).some((fechamento) =>
    asRecordList(fechamento.diariaIds).some((diariaId) => diariaId === id)
  );
}

export function getDiariasParceiroObra(obra, diarias = [], funcionarios = []) {
  const partnership = getPartnership(obra);
  if (!partnership?.enabled || !obra?.id) return [];
  const partner = getPrimaryPartner(obra);
  const partnerFuncionarioId = partnership.parceiroFuncionarioId || partner?.funcionarioId || null;
  const partnerNome = String(partner?.nome || '')
    .trim()
    .toLowerCase();

  return asRecordList(diarias).filter((diaria) => {
    if (!diaria || !diariaPertenceAObra(diaria, obra.id)) return false;
    if (partnerFuncionarioId && diaria.funcionarioId === partnerFuncionarioId) return true;
    if (!partnerNome) return false;
    const nome = asRecordList(funcionarios).find((item) => item.id === diaria.funcionarioId)?.nome || '';
    return String(nome).trim().toLowerCase() === partnerNome;
  });
}

/**
 * Fonte única da participação da Emerson Pinturas.
 * Obra normal = 100%. Parceria sem % cadastrada: não inventa valores.
 */
export function getEmpresaParticipacao(obra) {
  if (!isPartnershipObra(obra)) {
    return {
      isPartnership: false,
      divisaoInformada: true,
      percentagemEmpresa: 100,
      percentagemParceiro: 0,
      rateEmpresa: 1,
      rateParceiro: 0,
      parceiroNome: null,
    };
  }

  const partnership = getPartnership(obra);
  const empresa = getEmpresaParticipant(obra);
  const partner = getPrimaryPartner(obra);
  const informed = arePartnershipPercentagesInformed(partnership);
  const pctEmpresa = informed ? Number(empresa?.percentagem) : null;
  const pctParceiro = informed ? Number(partner?.percentagem) : null;
  const empresaOk = informed && Number.isFinite(pctEmpresa);
  const parceiroOk = informed && Number.isFinite(pctParceiro);

  return {
    isPartnership: true,
    divisaoInformada: informed,
    percentagemEmpresa: empresaOk ? pctEmpresa : null,
    percentagemParceiro: parceiroOk ? pctParceiro : null,
    rateEmpresa: empresaOk ? pctEmpresa / 100 : null,
    rateParceiro: parceiroOk ? pctParceiro / 100 : null,
    parceiroNome: partner?.nome || 'Parceiro',
  };
}

export function applyShareRate(amount, rate) {
  if (rate == null || !Number.isFinite(Number(rate))) return null;
  return roundMoney((Number(amount) || 0) * Number(rate));
}

/**
 * Dinheiro do cliente na empresa. Emerson cobra e recebe 100%.
 * A percentagem da parceria aplica-se só ao lucro, em calcObraEmpresaFinanceiro.
 */
export function applyEmpresaShare(_obra, amount) {
  return roundMoney(Number(amount) || 0);
}

export function applyParceiroShare(obra, amount) {
  const part = getEmpresaParticipacao(obra);
  if (!part.isPartnership) return 0;
  if (!part.divisaoInformada || part.rateParceiro == null) return 0;
  return roundMoney((Number(amount) || 0) * part.rateParceiro);
}

export function applyEmpresaShareToPagamento(pagamento, obras = []) {
  const valor = valorRecebidoCliente(pagamento);
  if (!pagamento?.obraId) return roundMoney(valor);
  const obra = asRecordList(obras).find((item) => item.id === pagamento.obraId) || null;
  return applyEmpresaShare(obra, valor);
}

export function calcGastosEmersonObra(obra, { gastos = [], diarias = [], gastosEmpresa = [], funcionarios = [] } = {}) {
  if (!obra?.id) {
    return {
      gastosEmerson: 0,
      gastosParceiro: 0,
      diariasEmerson: 0,
      gastosObraEmerson: 0,
      gastosEmpresaObra: 0,
      gastosTotaisObra: 0,
      gastosFabio: 0,
      gastosJuliano: 0,
    };
  }

  const gastosObra = asRecordList(gastos).filter((gasto) => gasto.obraId === obra.id);
  const porPagador = summarizeGastosPorPagador(gastosObra, obra);
  const pagosParceiro = porPagador.socios;
  const pagosEmerson = porPagador.emerson;
  const empresaObra = asRecordList(gastosEmpresa).filter(
    (gasto) => gasto.obraId === obra.id && gasto.estado !== 'previsto'
  );
  const diariasObra = filterDiariasDaObra(diarias, obra.id);

  const gastosObraEmerson = roundMoney(
    pagosEmerson.reduce((sum, gasto) => sum + getGastoValorAssinado(gasto), 0)
  );
  const gastosParceiro = roundMoney(
    pagosParceiro.reduce((sum, gasto) => sum + getGastoValorAssinado(gasto), 0)
  );
  const gastosEmpresaObra = roundMoney(
    empresaObra.reduce((sum, gasto) => sum + getGastoEmpresaValor(gasto), 0)
  );
  const diariasEmerson = roundMoney(
    diariasObra.reduce((sum, diaria) => sum + getDiariaCustoNaObra(diaria, obra.id, funcionarios), 0)
  );
  const gastosEmerson = roundMoney(gastosObraEmerson + gastosEmpresaObra + diariasEmerson);
  const gastosTotaisObra = roundMoney(gastosEmerson + gastosParceiro);

  return {
    gastosEmerson,
    gastosParceiro,
    diariasEmerson,
    gastosObraEmerson,
    gastosEmpresaObra,
    gastosTotaisObra,
    gastosFabio: porPagador.totalFabio,
    gastosJuliano: porPagador.totalJuliano,
  };
}

/**
 * Posição financeira da empresa numa obra.
 * Parceria: lucro real = receita − gastos − mão de obra dos funcionários (diárias de parceiro
 * não têm custo). A % aplica-se só ao lucro. Repasses de lucro ≠ controlo de presença.
 */
export function calcObraEmpresaFinanceiro(
  obra,
  {
    gastos = [],
    diarias = [],
    pagamentos = [],
    gastosEmpresa = [],
    funcionarios = [],
    fechamentosPagamento = [],
  } = {}
) {
  try {
    return buildObraEmpresaFinanceiro(obra, {
      gastos,
      diarias,
      pagamentos,
      gastosEmpresa,
      funcionarios,
      fechamentosPagamento,
    });
  } catch (err) {
    console.error('[obra] Falha ao calcular a posição financeira', obra?.id, err);
    return emptyObraEmpresaFinanceiro(obra);
  }
}

function emptyPartnershipMoneyFields() {
  return {
    lucroReal: null,
    lucroCaixa: null,
    gastosMateriaisOutros: 0,
    maoDeObraTotal: 0,
    maoDeObraPorPessoa: [],
    custoTotalParceria: 0,
    diariasParceiro: 0,
    diariasParceiroQuantidade: 0,
    diariasParceiroPagas: 0,
    diariasParceiroPendentes: 0,
    presencaParceiros: [],
    totalDevidoParceiro: null,
    totalPagoParceiro: 0,
    totalPendenteParceiro: null,
  };
}

function emptyObraEmpresaFinanceiro(obra) {
  let participacao;
  try {
    participacao = getEmpresaParticipacao(obra);
  } catch {
    participacao = {
      isPartnership: false,
      divisaoInformada: true,
      percentagemEmpresa: 100,
      percentagemParceiro: 0,
      rateEmpresa: 1,
      rateParceiro: 0,
      parceiroNome: null,
    };
  }
  const extras = summarizeObraExtras(obra);
  const valorOriginal = roundMoney(Number(obra?.valorContratado) || 0);
  const valorTotalObra = roundMoney(valorOriginal + (extras.total || 0));
  const aReceberTotal = isPrepaidCreditObra(obra)
    ? 0
    : participacao.isPartnership
      ? roundMoney(valorOriginal + (extras.aCobrar || extras.cobrado || 0))
      : valorTotalObra;
  const recebidoTotal = participacao.isPartnership ? extras.recebido || 0 : 0;
  return {
    ...participacao,
    valorOriginal,
    valorTotalObra,
    extras,
    recebidoTotal,
    recebidoPagamentos: 0,
    aReceberTotal,
    parteEmerson: participacao.isPartnership ? applyShareRate(0, participacao.rateEmpresa) : valorTotalObra,
    parteParceiro: participacao.isPartnership ? applyShareRate(0, participacao.rateParceiro) : 0,
    recebidoEmerson: recebidoTotal,
    recebidoParceiro: 0,
    aReceberEmerson: aReceberTotal,
    aReceberParceiro: 0,
    devidoParceiro: 0,
    totalRepassado: 0,
    aRepassar: null,
    statusRepasse: 'pendente',
    resultadoEmerson: null,
    resultadoCaixaEmerson: null,
    gastosEmerson: 0,
    gastosParceiro: 0,
    diariasEmerson: 0,
    gastosObraEmerson: 0,
    gastosEmpresaObra: 0,
    gastosTotaisObra: 0,
    gastosFabio: 0,
    gastosJuliano: 0,
    funcionarios: [],
    ...emptyPartnershipMoneyFields(),
  };
}

function buildObraEmpresaFinanceiro(
  obra,
  {
    gastos = [],
    diarias = [],
    pagamentos = [],
    gastosEmpresa = [],
    funcionarios = [],
    fechamentosPagamento = [],
  } = {}
) {
  const participacao = getEmpresaParticipacao(obra);
  const extras = summarizeObraExtras(obra);
  const valorOriginal = roundMoney(Number(obra?.valorContratado) || 0);
  const valorTotalObra = roundMoney(valorOriginal + (extras.total || 0));
  const recebidoPagamentos = roundMoney(
    getObraRecebimentos(obra?.id, pagamentos).reduce(
      (sum, pagamento) => sum + valorRecebidoCliente(pagamento),
      0
    )
  );
  const recebidoTotal = participacao.isPartnership
    ? roundMoney(recebidoPagamentos + (extras.recebido || 0))
    : recebidoPagamentos;
  const aReceberTotal = isPrepaidCreditObra(obra)
    ? 0
    : participacao.isPartnership
      ? roundMoney(Math.max(0, valorOriginal - recebidoPagamentos) + (extras.aCobrar || extras.cobrado || 0))
      : roundMoney(Math.max(0, valorTotalObra - recebidoPagamentos));

  const custos = calcObraCustosAcumulados(obra?.id, { gastos, diarias, gastosEmpresa, funcionarios });
  const custosDetalhe = calcGastosEmersonObra(obra, { gastos, diarias, gastosEmpresa, funcionarios });
  const gastosMateriaisOutros = custos.totalGastos;
  const maoDeObraPorPessoa = participacao.isPartnership
    ? summarizePartnershipMaoDeObra(obra?.id, diarias, funcionarios, obra)
    : [];
  const maoDeObraTotal = participacao.isPartnership
    ? roundMoney(maoDeObraPorPessoa.reduce((sum, item) => sum + (Number(item.totalNoCusto) || 0), 0))
    : custos.totalDiarias;
  const custoTotalParceria = roundMoney(gastosMateriaisOutros + maoDeObraTotal);
  const lucroReal = roundMoney(valorTotalObra - gastosMateriaisOutros - maoDeObraTotal);
  const lucroCaixa = roundMoney(recebidoTotal - gastosMateriaisOutros - maoDeObraTotal);

  const presencaParceiros = participacao.isPartnership
    ? buildParceiroPresencaObra(obra, { diarias, funcionarios })
    : [];
  const diariasParceiroQuantidade = roundMoney(
    presencaParceiros.reduce((sum, item) => sum + (Number(item.quantidade) || 0), 0)
  );
  const diariasParceiro = 0;
  const diariasParceiroPagas = 0;
  const diariasParceiroPendentes = 0;

  const { rateEmpresa, rateParceiro, divisaoInformada, isPartnership } = participacao;
  const gastosEmerson = isPartnership
    ? roundMoney(custos.totalGastos)
    : custosDetalhe.gastosEmerson;

  const recebidoEmerson = recebidoTotal;
  const recebidoParceiro = 0;
  const aReceberEmerson = aReceberTotal;
  const aReceberParceiro = 0;

  const totalRepassado = roundMoney(sumMoney(getObraRepasses(obra, pagamentos)));

  let parteEmerson;
  let parteParceiro;
  let resultadoEmerson;
  let resultadoCaixaEmerson;
  let devidoParceiro;
  let aRepassar;
  let totalDevidoParceiro;
  let totalPagoParceiro;
  let totalPendenteParceiro;

  if (isPartnership) {
    parteEmerson = applyShareRate(lucroReal, rateEmpresa);
    parteParceiro = applyShareRate(lucroReal, rateParceiro);
    resultadoEmerson = parteEmerson;
    resultadoCaixaEmerson = applyShareRate(lucroCaixa, rateEmpresa);
    devidoParceiro = parteParceiro;
    aRepassar =
      divisaoInformada && parteParceiro != null
        ? roundMoney(Math.max(0, parteParceiro - totalRepassado))
        : null;
    totalDevidoParceiro =
      divisaoInformada && parteParceiro != null ? parteParceiro : null;
    totalPagoParceiro = totalRepassado;
    totalPendenteParceiro = aRepassar;
  } else {
    parteEmerson = valorTotalObra;
    parteParceiro = 0;
    resultadoEmerson = lucroReal;
    resultadoCaixaEmerson = lucroCaixa;
    devidoParceiro = 0;
    aRepassar = 0;
    totalDevidoParceiro = 0;
    totalPagoParceiro = 0;
    totalPendenteParceiro = 0;
  }

  return {
    ...participacao,
    valorOriginal,
    valorTotalObra,
    extras,
    recebidoTotal,
    recebidoPagamentos,
    aReceberTotal,
    parteEmerson,
    parteParceiro,
    recebidoEmerson,
    recebidoParceiro,
    aReceberEmerson,
    aReceberParceiro,
    devidoParceiro,
    totalRepassado,
    aRepassar,
    statusRepasse: divisaoInformada ? getRepasseStatus(devidoParceiro, totalRepassado) : 'pendente',
    resultadoEmerson,
    resultadoCaixaEmerson,
    ...custosDetalhe,
    gastosEmerson,
    gastosMateriaisOutros,
    maoDeObraTotal,
    maoDeObraPorPessoa,
    custoTotalParceria,
    lucroReal,
    lucroCaixa,
    diariasParceiro,
    diariasParceiroQuantidade,
    diariasParceiroPagas,
    diariasParceiroPendentes,
    presencaParceiros,
    totalDevidoParceiro,
    totalPagoParceiro,
    totalPendenteParceiro,
    funcionarios,
  };
}

export function buildParceriasEmpresaResumo(
  obras = [],
  {
    gastos = [],
    diarias = [],
    pagamentos = [],
    gastosEmpresa = [],
    funcionarios = [],
    fechamentosPagamento = [],
  } = {}
) {
  const parcerias = (obras || []).filter((obra) => isPartnershipObra(obra));
  if (!parcerias.length) return null;

  let receitaEmerson = 0;
  let recebidoEmerson = 0;
  let valoresParceiros = 0;
  let recebidoParceiros = 0;
  let totalRepassado = 0;
  let totalARepassar = 0;
  let diariasParceiroPendentes = 0;
  let totalPendenteParceiro = 0;
  let semPercentagem = 0;

  parcerias.forEach((obra) => {
    const fin = calcObraEmpresaFinanceiro(obra, {
      gastos,
      diarias,
      pagamentos,
      gastosEmpresa,
      funcionarios,
      fechamentosPagamento,
    });
    recebidoEmerson += fin.recebidoTotal || 0;
    diariasParceiroPendentes += fin.diariasParceiroPendentes || 0;
    if (!fin.divisaoInformada) {
      semPercentagem += 1;
      totalPendenteParceiro += fin.diariasParceiroPendentes || 0;
      return;
    }
    receitaEmerson += fin.resultadoEmerson || 0;
    valoresParceiros += fin.parteParceiro || 0;
    recebidoParceiros += fin.parteParceiro || 0;
    totalRepassado += fin.totalRepassado || 0;
    totalARepassar += fin.aRepassar || 0;
    totalPendenteParceiro += fin.totalPendenteParceiro || 0;
  });

  return {
    quantidade: parcerias.length,
    semPercentagem,
    receitaEmerson: roundMoney(receitaEmerson),
    recebidoEmerson: roundMoney(recebidoEmerson),
    valoresParceiros: roundMoney(valoresParceiros),
    recebidoParceiros: roundMoney(recebidoParceiros),
    totalRepassado: roundMoney(totalRepassado),
    totalARepassar: roundMoney(totalARepassar),
    diariasParceiroPendentes: roundMoney(diariasParceiroPendentes),
    totalPendenteParceiro: roundMoney(totalPendenteParceiro),
  };
}

export function calcPartnershipSummary(
  obra,
  {
    gastos = [],
    diarias = [],
    pagamentos = [],
    gastosEmpresa = [],
    funcionarios = [],
    fechamentosPagamento = [],
  } = {}
) {
  try {
    return buildPartnershipSummary(obra, {
      gastos,
      diarias,
      pagamentos,
      gastosEmpresa,
      funcionarios,
      fechamentosPagamento,
    });
  } catch (err) {
    console.error('[parceria] Falha ao calcular o resumo', obra?.id, err);
    return null;
  }
}

function buildPartnershipSummary(
  obra,
  {
    gastos = [],
    diarias = [],
    pagamentos = [],
    gastosEmpresa = [],
    funcionarios = [],
    fechamentosPagamento = [],
  } = {}
) {
  const partnership = getPartnership(obra);
  if (!partnership?.enabled) return null;

  const participantes = asRecordList(partnership.participantes);

  const fin = calcObraEmpresaFinanceiro(obra, {
    gastos,
    diarias,
    pagamentos,
    gastosEmpresa,
    funcionarios,
    fechamentosPagamento,
  });
  const custos = calcObraCustosAcumulados(obra?.id, { gastos, diarias, gastosEmpresa, funcionarios });
  const concluida = ['Encerrada', 'Concluída'].includes(obra.estado);

  const partes = participantes.map((parte) => ({
    ...parte,
    valor:
      fin.divisaoInformada
        ? parte.role === PARTICIPANT_ROLE.EMPRESA
          ? fin.parteEmerson
          : applyShareRate(fin.lucroReal, (Number(parte.percentagem) || 0) / 100)
        : null,
  }));

  const totalPagoPorParceiro = fin.gastosParceiro;
  const totalReembolsado = roundMoney(sumMoney(obra?.reembolsosParceiro));

  return {
    receitaContratada: fin.valorTotalObra,
    valorOriginal: fin.valorOriginal,
    receitaRecebida: fin.recebidoTotal,
    recebidoEmerson: fin.recebidoEmerson,
    recebidoParceiro: fin.recebidoParceiro,
    aReceberTotal: fin.aReceberTotal,
    aReceberEmerson: fin.aReceberEmerson,
    despesasGastos: custos.totalGastos,
    despesasDiarias: custos.totalDiarias,
    despesasMateriais: custos.totalMateriais,
    despesasOutros: custos.totalOutros,
    despesasTotais: custos.totalInvestido,
    gastosEmerson: fin.gastosEmerson,
    gastosParceiro: fin.gastosParceiro,
    gastosObraEmerson: fin.gastosObraEmerson,
    gastosFabio: fin.gastosFabio || 0,
    gastosJuliano: fin.gastosJuliano || 0,
    gastosMateriaisOutros: fin.gastosMateriaisOutros,
    maoDeObraTotal: fin.maoDeObraTotal,
    maoDeObraPorPessoa: fin.maoDeObraPorPessoa || [],
    custoTotalParceria: fin.custoTotalParceria ?? roundMoney((fin.gastosMateriaisOutros || 0) + (fin.maoDeObraTotal || 0)),
    diariasParceiro: fin.diariasParceiro,
    diariasParceiroQuantidade: fin.diariasParceiroQuantidade,
    diariasParceiroPagas: fin.diariasParceiroPagas,
    diariasParceiroPendentes: fin.diariasParceiroPendentes,
    presencaParceiros: fin.presencaParceiros || [],
    lucroReal: fin.lucroReal,
    lucroCaixa: fin.lucroCaixa,
    lucroLiquido: fin.resultadoEmerson,
    resultadoEmerson: fin.resultadoEmerson,
    resultadoCaixaEmerson: fin.resultadoCaixaEmerson,
    prejuizo: (fin.lucroReal || 0) < 0,
    divisaoInformada: fin.divisaoInformada,
    resultadoLabel: concluida ? 'Lucro Emerson' : 'Lucro provisório da Emerson',
    partes,
    parteEmpresa: fin.parteEmerson,
    parteParceiro: fin.parteParceiro,
    percentagemEmpresa: fin.percentagemEmpresa,
    percentagemParceiro: fin.percentagemParceiro,
    parceiroNome: fin.parceiroNome || 'Parceiro',
    totalRepassado: fin.totalRepassado,
    devidoParceiro: fin.devidoParceiro,
    aRepassar: fin.aRepassar,
    statusRepasse: fin.statusRepasse,
    totalDevidoParceiro: fin.totalDevidoParceiro,
    totalPagoParceiro: fin.totalPagoParceiro,
    totalPendenteParceiro: fin.totalPendenteParceiro,
    totalPagoPorParceiro,
    totalReembolsado,
    aReembolsar: roundMoney(Math.max(0, totalPagoPorParceiro - totalReembolsado)),
    recebidoPorParte: {
      empresa: fin.recebidoEmerson,
      parceiro: fin.recebidoParceiro,
    },
    repasses: asRecordList(getObraRepasses(obra, pagamentos)),
  };
}
