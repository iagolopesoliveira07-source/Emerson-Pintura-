import { generateId } from '../services/storageService';
import { isDomesLakeHotelObra } from './obraDomesLakeHotel';
import { asRecordList } from './safeCollections';
import { filterDiariasDaObra, getDiariaCustoNaObra, pruneDiariaObraDeleted } from './diariaObraAlocacao';

export const HOTEL_DOMME_CREDITO_INICIAL = 50000;
export const HOTEL_DOMME_CONSUMO_ANTERIOR = 36364;
export const HOTEL_DOMME_ALERTA_LIMITE = 5000;

export const HOTEL_DOMME_TIPOS = {
  CREDITO_INICIAL: 'credito_inicial',
  CONSUMO_ANTERIOR: 'consumo_anterior',
  TRABALHO: 'trabalho',
  EMERGENCIA: 'emergencia',
  DIARIAS: 'diarias',
  OUTROS_GASTOS: 'outros_gastos',
  AJUSTE: 'ajuste',
};

export const HOTEL_DOMME_TIPO_LABELS = {
  [HOTEL_DOMME_TIPOS.CREDITO_INICIAL]: 'Crédito inicial',
  [HOTEL_DOMME_TIPOS.CONSUMO_ANTERIOR]: 'Consumo anterior',
  [HOTEL_DOMME_TIPOS.TRABALHO]: 'Trabalho',
  [HOTEL_DOMME_TIPOS.EMERGENCIA]: 'Emergência',
  [HOTEL_DOMME_TIPOS.DIARIAS]: 'Diárias',
  [HOTEL_DOMME_TIPOS.OUTROS_GASTOS]: 'Outros gastos',
  [HOTEL_DOMME_TIPOS.AJUSTE]: 'Ajuste manual',
};

export const HOTEL_DOMME_STATUS = {
  REALIZADO: 'realizado',
  PENDENTE: 'pendente',
};

export function isHotelDommeObra(obra) {
  if (!obra) return false;
  if (isDomesLakeHotelObra(obra)) return false;
  const text = `${obra.nome || ''} ${obra.cliente || ''}`.toLowerCase();
  if (text.includes('lake')) return false;
  if (text.includes('domes')) return false;
  return text.includes('domme') && text.includes('hotel');
}

export function getHotelDommeControleByObraId(controles, obraId) {
  return (controles || []).find((c) => c.obraId === obraId) || null;
}

export function createDefaultHotelDommeControle(obraId) {
  return {
    obraId,
    creditoInicial: HOTEL_DOMME_CREDITO_INICIAL,
    consumoAnteriorNaoDetalhado: HOTEL_DOMME_CONSUMO_ANTERIOR,
    movimentos: [],
    createdAt: new Date().toISOString(),
  };
}

export function createDefaultHotelDommeObra() {
  return {
    nome: 'Hotel Domme',
    cliente: 'Hotel Domme',
    telefone: '',
    morada: 'Algarve',
    valorContratado: HOTEL_DOMME_CREDITO_INICIAL,
    dataInicio: null,
    dataPrevistaTermino: null,
    estado: 'Em andamento',
    motivoPausa: '',
    observacoes: 'Obra com controle de crédito pré-pago.',
    funcionarios: [],
    historicoAlteracoes: [],
    historicoStatus: [],
  };
}

function getManualConsumo(movimentos = []) {
  return movimentos.reduce((sum, movimento) => {
    if (movimento.status === HOTEL_DOMME_STATUS.PENDENTE) return sum;
    if (movimento.tipo === HOTEL_DOMME_TIPOS.AJUSTE) {
      return sum + (movimento.valor || 0);
    }
    if (
      movimento.tipo === HOTEL_DOMME_TIPOS.TRABALHO ||
      movimento.tipo === HOTEL_DOMME_TIPOS.EMERGENCIA
    ) {
      return sum + Math.abs(movimento.valor || 0);
    }
    return sum;
  }, 0);
}

function getTrabalhosRealizadosTotal(movimentos = []) {
  return movimentos.reduce((sum, movimento) => {
    if (movimento.status === HOTEL_DOMME_STATUS.PENDENTE) return sum;
    if (
      movimento.tipo === HOTEL_DOMME_TIPOS.TRABALHO ||
      movimento.tipo === HOTEL_DOMME_TIPOS.EMERGENCIA
    ) {
      return sum + Math.abs(movimento.valor || 0);
    }
    return sum;
  }, 0);
}

function getAjustesTotal(movimentos = []) {
  return movimentos.reduce((sum, movimento) => {
    if (movimento.status === HOTEL_DOMME_STATUS.PENDENTE) return sum;
    if (movimento.tipo === HOTEL_DOMME_TIPOS.AJUSTE) {
      return sum + (movimento.valor || 0);
    }
    return sum;
  }, 0);
}

export function getHotelDommeDiariasTotal(obraId, diarias = [], funcionarios = []) {
  return filterDiariasDaObra(diarias, obraId).reduce(
    (sum, d) => sum + getDiariaCustoNaObra(d, obraId, funcionarios),
    0
  );
}

export function getHotelDommeGastosTotal(obraId, gastos = []) {
  return asRecordList(gastos)
    .filter((g) => g.obraId === obraId)
    .reduce((sum, g) => sum + (g.valor || 0), 0);
}

export function getHotelDommeResumo(controle, diarias = [], gastos = []) {
  if (!controle) return null;

  const creditoInicial = controle.creditoInicial ?? HOTEL_DOMME_CREDITO_INICIAL;
  const consumoAnterior = controle.consumoAnteriorNaoDetalhado ?? HOTEL_DOMME_CONSUMO_ANTERIOR;
  const movimentos = asRecordList(controle.movimentos);

  const trabalhosRealizados = getTrabalhosRealizadosTotal(movimentos);
  const totalDiarias = getHotelDommeDiariasTotal(controle.obraId, diarias);
  const totalGastos = getHotelDommeGastosTotal(controle.obraId, gastos);
  const ajustes = getAjustesTotal(movimentos);
  const manualConsumo = getManualConsumo(movimentos);

  const totalConsumido =
    consumoAnterior + totalDiarias + totalGastos + manualConsumo;
  const saldoAtual = creditoInicial - totalConsumido;
  const creditoDisponivelInicial = creditoInicial - consumoAnterior;

  return {
    creditoInicial,
    consumoAnterior,
    creditoDisponivelInicial,
    trabalhosRealizados,
    totalDiarias,
    totalGastos,
    ajustes,
    totalConsumido,
    saldoAtual,
    alerta: getHotelDommeAlerta(saldoAtual),
  };
}

export function getHotelDommeAlerta(saldoAtual) {
  if (saldoAtual <= 0) {
    return {
      nivel: 'esgotado',
      mensagem: 'Crédito do Hotel Domme esgotado.',
    };
  }
  if (saldoAtual < HOTEL_DOMME_ALERTA_LIMITE) {
    return {
      nivel: 'baixo',
      mensagem: 'Atenção: crédito do Hotel Domme abaixo de 5.000 €.',
    };
  }
  return null;
}

function getSortTimestamp(entry) {
  if (entry.sortOrder != null) return entry.sortOrder;
  if (entry.data) return new Date(`${entry.data}T12:00:00`).getTime();
  if (entry.createdAt) return new Date(entry.createdAt).getTime();
  return 0;
}

function buildDiariaHistoricoEntries(obraId, diarias = [], funcionarios = []) {
  return filterDiariasDaObra(diarias, obraId)
    .map((diaria) => {
      const func = asRecordList(funcionarios).find((f) => f.id === diaria.funcionarioId);
      const valor = getDiariaCustoNaObra(diaria, obraId, funcionarios);
      return {
        id: `diaria-${diaria.id}`,
        source: 'diaria',
        sourceId: diaria.id,
        data: diaria.data || diaria.createdAt?.slice(0, 10) || null,
        tipo: HOTEL_DOMME_TIPOS.DIARIAS,
        descricao: func?.nome
          ? `Diária — ${func.nome}`
          : 'Diária — funcionário',
        funcionariosEnvolvidos: func?.nome ? [func.nome] : [],
        valor: -Math.abs(valor),
        observacoes: diaria.observacao || '',
        status: HOTEL_DOMME_STATUS.REALIZADO,
        editavel: false,
        createdAt: diaria.createdAt,
        sortOrder: getSortTimestamp({
          data: diaria.data || diaria.createdAt?.slice(0, 10),
          createdAt: diaria.createdAt,
        }),
      };
    });
}

function buildGastoHistoricoEntries(obraId, gastos = []) {
  return asRecordList(gastos)
    .filter((g) => g.obraId === obraId)
    .map((gasto) => ({
      id: `gasto-${gasto.id}`,
      source: 'gasto',
      sourceId: gasto.id,
      data: gasto.data || gasto.createdAt?.slice(0, 10) || null,
      tipo: HOTEL_DOMME_TIPOS.OUTROS_GASTOS,
      descricao: gasto.descricao || gasto.categoria || 'Gasto',
      funcionariosEnvolvidos: gasto.fornecedor ? [gasto.fornecedor] : [],
      valor: -Math.abs(gasto.valor || 0),
      observacoes: gasto.observacao || '',
      status: HOTEL_DOMME_STATUS.REALIZADO,
      editavel: false,
      createdAt: gasto.createdAt,
      sortOrder: getSortTimestamp({
        data: gasto.data || gasto.createdAt?.slice(0, 10),
        createdAt: gasto.createdAt,
      }),
    }));
}

function buildManualHistoricoEntries(movimentos = []) {
  return asRecordList(movimentos).map((movimento) => {
    const isAjuste = movimento.tipo === HOTEL_DOMME_TIPOS.AJUSTE;
    const valorAbsoluto = Math.abs(movimento.valor || 0);
    const valor =
      movimento.status === HOTEL_DOMME_STATUS.PENDENTE
        ? -valorAbsoluto
        : isAjuste
          ? movimento.valor || 0
          : -(movimento.valor || 0);

    return {
      id: movimento.id,
      source: 'manual',
      sourceId: movimento.id,
      data: movimento.data || null,
      tipo: movimento.tipo,
      descricao: movimento.descricao || HOTEL_DOMME_TIPO_LABELS[movimento.tipo] || 'Movimentação',
      funcionariosEnvolvidos: movimento.funcionariosEnvolvidos || [],
      valor,
      observacoes: movimento.observacoes || '',
      status: movimento.status || HOTEL_DOMME_STATUS.REALIZADO,
      editavel: true,
      createdAt: movimento.createdAt,
      sortOrder: getSortTimestamp(movimento),
      afetaSaldo: movimento.status !== HOTEL_DOMME_STATUS.PENDENTE,
    };
  });
}

export function buildHotelDommeHistorico(controle, diarias = [], gastos = [], funcionarios = []) {
  if (!controle) return [];

  const creditoInicial = controle.creditoInicial ?? HOTEL_DOMME_CREDITO_INICIAL;
  const consumoAnterior = controle.consumoAnteriorNaoDetalhado ?? HOTEL_DOMME_CONSUMO_ANTERIOR;

  const openingEntries = [
    {
      id: 'opening-credito',
      source: 'sistema',
      data: null,
      tipo: HOTEL_DOMME_TIPOS.CREDITO_INICIAL,
      descricao: 'Crédito inicial',
      funcionariosEnvolvidos: [],
      valor: creditoInicial,
      observacoes: '',
      status: HOTEL_DOMME_STATUS.REALIZADO,
      editavel: false,
      sortOrder: -2,
      afetaSaldo: true,
    },
    {
      id: 'opening-consumo-anterior',
      source: 'sistema',
      data: null,
      tipo: HOTEL_DOMME_TIPOS.CONSUMO_ANTERIOR,
      descricao: 'Consumo anterior não detalhado',
      funcionariosEnvolvidos: [],
      valor: -consumoAnterior,
      observacoes: 'Consumo real anterior sem detalhamento disponível.',
      status: HOTEL_DOMME_STATUS.REALIZADO,
      editavel: false,
      sortOrder: -1,
      afetaSaldo: true,
    },
  ];

  const dynamicEntries = [
    ...buildManualHistoricoEntries(controle.movimentos),
    ...buildDiariaHistoricoEntries(controle.obraId, diarias, funcionarios),
    ...buildGastoHistoricoEntries(controle.obraId, gastos),
  ].sort((a, b) => {
    const diff = getSortTimestamp(a) - getSortTimestamp(b);
    if (diff !== 0) return diff;
    return String(a.id).localeCompare(String(b.id));
  });

  const allEntries = [...openingEntries, ...dynamicEntries];
  let saldo = 0;

  return allEntries.map((entry) => {
    if (entry.afetaSaldo !== false) {
      saldo += entry.valor || 0;
    }

    return {
      ...entry,
      saldoApos: entry.afetaSaldo === false ? null : saldo,
    };
  });
}

export function validateHotelDommeMovimentoForm(form, existingItem = null) {
  const errors = {};
  const tipo = form.tipo;
  const valor = parseFloat(form.valor);
  const data = form.data?.trim();
  const descricao = form.descricao?.trim();
  const status = form.status || HOTEL_DOMME_STATUS.REALIZADO;

  if (!data) errors.data = 'Informe a data';
  if (!descricao) errors.descricao = 'Informe a descrição';
  if (Number.isNaN(valor) || valor === 0) errors.valor = 'Informe um valor válido';
  if (valor < 0 && tipo !== HOTEL_DOMME_TIPOS.AJUSTE) {
    errors.valor = 'O valor deve ser positivo';
  }
  if (!tipo) errors.tipo = 'Selecione o tipo';

  if (
    existingItem &&
    (existingItem.source === 'diaria' || existingItem.source === 'gasto' || existingItem.source === 'sistema')
  ) {
    return { isValid: false, errors: { geral: 'Este registo não pode ser editado aqui.' } };
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    payload: {
      data,
      tipo,
      descricao,
      valor: tipo === HOTEL_DOMME_TIPOS.AJUSTE ? valor : Math.abs(valor),
      funcionariosEnvolvidos: parseFuncionariosInput(form.funcionariosEnvolvidos),
      observacoes: form.observacoes?.trim() || '',
      status,
    },
  };
}

function parseFuncionariosInput(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value || typeof value !== 'string') return [];
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

export function buildHotelDommeMovimento(form) {
  const validation = validateHotelDommeMovimentoForm(form);
  if (!validation.isValid) return validation;

  return {
    item: {
      id: generateId(),
      ...validation.payload,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
}

export function updateHotelDommeMovimento(existing, form) {
  const validation = validateHotelDommeMovimentoForm(form, existing);
  if (!validation.isValid) return validation;

  return {
    item: {
      ...existing,
      ...validation.payload,
      updatedAt: new Date().toISOString(),
    },
  };
}

export function toggleHotelDommeMovimentoStatus(movimento) {
  const current = movimento.status || HOTEL_DOMME_STATUS.REALIZADO;
  const next =
    current === HOTEL_DOMME_STATUS.PENDENTE
      ? HOTEL_DOMME_STATUS.REALIZADO
      : HOTEL_DOMME_STATUS.PENDENTE;

  return {
    ...movimento,
    status: next,
    updatedAt: new Date().toISOString(),
  };
}

export function collectHotelDommeRemovalPlan(data = {}) {
  const obras = data.obras || [];
  const targets = obras.filter(isHotelDommeObra);
  const ids = new Set(targets.map((obra) => obra.id));
  const relatedToTargets = (items = []) => items.filter((item) => ids.has(item.obraId));

  const diarias = relatedToTargets(data.diarias);
  const gastos = relatedToTargets(data.gastos);
  const pagamentos = relatedToTargets(data.pagamentos);
  const valoresAcertoUnlink = relatedToTargets(data.valoresAcerto);
  const controles = (data.hotelDommeControles || []).filter(
    (controle) => ids.has(controle.obraId) || !obras.some((obra) => obra.id === controle.obraId)
  );

  return {
    obraIds: [...ids],
    obras: targets,
    diarias,
    gastos,
    pagamentos,
    valoresAcertoUnlink,
    controles,
    hasChanges:
      targets.length > 0 ||
      diarias.length > 0 ||
      gastos.length > 0 ||
      pagamentos.length > 0 ||
      valoresAcertoUnlink.length > 0 ||
      controles.length > 0,
  };
}

export function applyHotelDommeRemoval(data = {}, plan = collectHotelDommeRemovalPlan(data)) {
  const ids = new Set(plan.obraIds || []);
  const controleKeys = new Set((plan.controles || []).map((controle) => controle.obraId));

  return {
    ...data,
    obras: (data.obras || []).filter((obra) => !ids.has(obra.id)),
    diarias: (data.diarias || []).reduce((list, diaria) => {
      let next = diaria;
      ids.forEach((id) => {
        if (next) next = pruneDiariaObraDeleted(next, id);
      });
      if (next) list.push(next);
      return list;
    }, []),
    gastos: (data.gastos || []).filter((gasto) => !ids.has(gasto.obraId)),
    pagamentos: (data.pagamentos || []).filter((pagamento) => !ids.has(pagamento.obraId)),
    hotelDommeControles: (data.hotelDommeControles || []).filter(
      (controle) => !ids.has(controle.obraId) && !controleKeys.has(controle.obraId)
    ),
    valoresAcerto: (data.valoresAcerto || []).map((item) =>
      ids.has(item.obraId) ? { ...item, obraId: null } : item
    ),
  };
}

export function migrateHotelDommeData(obras = [], controles = []) {
  const obraIds = new Set(obras.map((obra) => obra.id));
  const nextControles = (controles || []).filter((item) => obraIds.has(item.obraId));
  const changed = nextControles.length !== (controles || []).length;

  return {
    obras,
    controles: nextControles,
    changed,
    obraId: obras.find(isHotelDommeObra)?.id || null,
  };
}
