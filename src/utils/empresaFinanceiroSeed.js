import STORAGE_KEYS, { generateId, getStorageItem, setStorageItem } from '../services/storageService';
import {
  applyPagamentoProgramada,
  buildGastoFromProgramada,
  countPagamentosProgramada,
  createDespesaProgramada,
  createValorRecuperar,
  createVeiculo,
  dataNoMesComDiaConhecido,
  isDespesaMensalRecorrente,
} from './empresaFinanceiroCalculations';
import { DESPESA_NATUREZA, DESPESA_PERIODICIDADE, VALOR_RECUPERAR_STATUS } from '../constants/empresaFinanceiro';
import { patchVeiculosPerfisFiscais, VEICULO_PERFIS_CONHECIDOS } from './empresaIvaRules';

const VEICULO_KEYS = {
  VAN_GRANDE: 'veiculo-van-grande',
  VAN_PEQUENA: 'veiculo-van-pequena',
  CHAPOLIM: 'veiculo-chapolim',
  ZAFIRA: 'veiculo-zafira',
  VANZONA: 'veiculo-vanzona',
};

function buildSeedVeiculos() {
  return [
    createVeiculo({
      seedKey: VEICULO_KEYS.VAN_GRANDE,
      nome: 'Van Grande',
      propriedadeEmpresa: true,
      ...VEICULO_PERFIS_CONHECIDOS[VEICULO_KEYS.VAN_GRANDE],
    }),
    createVeiculo({
      seedKey: VEICULO_KEYS.VAN_PEQUENA,
      nome: 'Van Pequena',
      propriedadeEmpresa: true,
      ...VEICULO_PERFIS_CONHECIDOS[VEICULO_KEYS.VAN_PEQUENA],
    }),
    createVeiculo({
      seedKey: VEICULO_KEYS.CHAPOLIM,
      nome: 'Chapolim',
      propriedadeEmpresa: true,
      notas: 'Comprado a pronto.',
      ...VEICULO_PERFIS_CONHECIDOS[VEICULO_KEYS.CHAPOLIM],
    }),
    createVeiculo({
      seedKey: VEICULO_KEYS.ZAFIRA,
      nome: 'Zafira',
      propriedadeEmpresa: false,
      notas: 'Veículo não pertencente formalmente à empresa. Utilizado pela empresa, que assume os gastos do uso empresarial.',
      ...VEICULO_PERFIS_CONHECIDOS[VEICULO_KEYS.ZAFIRA],
    }),
    createVeiculo({
      seedKey: VEICULO_KEYS.VANZONA,
      nome: 'Vanzona',
      propriedadeEmpresa: true,
      ...VEICULO_PERFIS_CONHECIDOS[VEICULO_KEYS.VANZONA],
    }),
  ];
}

function buildSeedDespesas(veiculoIds) {
  return [
    createDespesaProgramada({
      seedKey: 'prestacao-van-grande',
      titulo: 'Prestação — Van Grande',
      natureza: DESPESA_NATUREZA.PRESTACAO,
      categoria: 'Parcelas / financiamento das carrinhas',
      valor: 387.74,
      periodicidade: DESPESA_PERIODICIDADE.PARCELAS,
      parcelasRestantes: 26,
      ivaDeduzido: false,
      veiculoId: veiculoIds[VEICULO_KEYS.VAN_GRANDE],
      observacao: 'IVA não deduzido. Não foram criadas parcelas anteriores.',
    }),
    createDespesaProgramada({
      seedKey: 'seguro-van-grande',
      titulo: 'Seguro anual — Van Grande',
      natureza: DESPESA_NATUREZA.SEGURO,
      categoria: 'Seguro das carrinhas',
      valor: 640.38,
      periodicidade: DESPESA_PERIODICIDADE.ANUAL,
      dataInicio: '2025-12-01',
      duracaoMeses: 12,
      ivaDeduzido: false,
      veiculoId: veiculoIds[VEICULO_KEYS.VAN_GRANDE],
    }),
    createDespesaProgramada({
      seedKey: 'prestacao-van-pequena',
      titulo: 'Prestação — Van Pequena',
      natureza: DESPESA_NATUREZA.PRESTACAO,
      categoria: 'Parcelas / financiamento das carrinhas',
      valor: 533.16,
      periodicidade: DESPESA_PERIODICIDADE.PARCELAS,
      parcelasRestantes: 37,
      ivaDeduzido: false,
      veiculoId: veiculoIds[VEICULO_KEYS.VAN_PEQUENA],
      observacao: 'IVA não deduzido. Não foram criadas parcelas anteriores.',
    }),
    createDespesaProgramada({
      seedKey: 'seguro-van-pequena',
      titulo: 'Seguro anual — Van Pequena',
      natureza: DESPESA_NATUREZA.SEGURO,
      categoria: 'Seguro das carrinhas',
      valor: 640.38,
      periodicidade: DESPESA_PERIODICIDADE.ANUAL,
      dataInicio: '2025-12-02',
      duracaoMeses: 12,
      ivaDeduzido: false,
      veiculoId: veiculoIds[VEICULO_KEYS.VAN_PEQUENA],
    }),
    createDespesaProgramada({
      seedKey: 'seguro-chapolim',
      titulo: 'Seguro anual — Chapolim',
      natureza: DESPESA_NATUREZA.SEGURO,
      categoria: 'Seguro das carrinhas',
      valor: 801.29,
      periodicidade: DESPESA_PERIODICIDADE.ANUAL,
      dataInicio: '2026-06-01',
      duracaoMeses: 12,
      veiculoId: veiculoIds[VEICULO_KEYS.CHAPOLIM],
    }),
    createDespesaProgramada({
      seedKey: 'seguro-vanzona',
      titulo: 'Seguro — Vanzona',
      natureza: DESPESA_NATUREZA.SEGURO,
      categoria: 'Seguro das carrinhas',
      valor: 69.94,
      periodicidade: DESPESA_PERIODICIDADE.UNICA,
      recorrenciaConfirmada: false,
      dataInicio: '2026-06-02',
      duracaoMeses: 3,
      veiculoId: veiculoIds[VEICULO_KEYS.VANZONA],
      observacao: 'Validade informada: 3 meses. A cobertura não cria cobrança automática.',
    }),
    createDespesaProgramada({
      seedKey: 'salario-emerson',
      titulo: 'Salário — Emerson',
      natureza: DESPESA_NATUREZA.SALARIO,
      categoria: 'Salários',
      valor: 1341.37,
      periodicidade: DESPESA_PERIODICIDADE.MENSAL,
      diaVencimento: 3,
      funcionarioNome: 'Emerson',
    }),
    createDespesaProgramada({
      seedKey: 'seguranca-social-emerson-jeferson',
      titulo: 'Segurança Social — Emerson e Jeferson',
      natureza: DESPESA_NATUREZA.SEGURANCA_SOCIAL,
      categoria: 'Segurança Social',
      valor: 778.4,
      periodicidade: DESPESA_PERIODICIDADE.MENSAL,
      observacao: 'Valor conjunto informado. Pode ser separado posteriormente.',
    }),
    createDespesaProgramada({
      seedKey: 'contabilidade-mensal',
      titulo: 'Contabilidade',
      natureza: DESPESA_NATUREZA.CONTABILIDADE,
      categoria: 'Contabilidade',
      valor: 258.3,
      periodicidade: DESPESA_PERIODICIDADE.MENSAL,
    }),
    createDespesaProgramada({
      seedKey: 'garagem-ferramentas',
      titulo: 'Aluguer da garagem',
      natureza: DESPESA_NATUREZA.ALUGUER,
      categoria: 'Aluguer de garagem',
      valor: 600,
      periodicidade: DESPESA_PERIODICIDADE.MENSAL,
      diaVencimento: 1,
      observacao: 'Aluguel da garagem onde são guardadas as ferramentas da empresa.',
    }),
    createDespesaProgramada({
      seedKey: 'seguro-acidentes-emerson',
      titulo: 'Seguro de acidentes pessoais — Emerson',
      natureza: DESPESA_NATUREZA.SEGURO,
      categoria: 'Seguros dos funcionários',
      valor: 183.83,
      periodicidade: DESPESA_PERIODICIDADE.TRIMESTRAL,
      ultimaOcorrenciaMes: '2026-06',
      funcionarioNome: 'Emerson',
      observacao: 'Último desconto conhecido: junho de 2026. Sem pagamentos retroactivos.',
    }),
    createDespesaProgramada({
      seedKey: 'irc-adiantado-2026-09',
      titulo: 'IRC adiantado',
      natureza: DESPESA_NATUREZA.IMPOSTO,
      categoria: 'IRC',
      valor: 1341,
      periodicidade: DESPESA_PERIODICIDADE.UNICA,
      previsaoMes: '2026-09',
      observacao: 'Pagamento informado para setembro de 2026.',
    }),
    createDespesaProgramada({
      seedKey: 'irc-adiantado-2026-11',
      titulo: 'IRC adiantado',
      natureza: DESPESA_NATUREZA.IMPOSTO,
      categoria: 'IRC',
      valor: 1341,
      periodicidade: DESPESA_PERIODICIDADE.UNICA,
      previsaoMes: '2026-11',
      observacao: 'Pagamento informado para novembro de 2026.',
    }),
    createDespesaProgramada({
      seedKey: 'impic-anual',
      titulo: 'IMPIC',
      natureza: DESPESA_NATUREZA.IMPOSTO,
      categoria: 'IMPIC',
      valor: 112,
      periodicidade: DESPESA_PERIODICIDADE.ANUAL,
      observacao: 'Periodicidade anual. Data exacta de pagamento ainda não cadastrada.',
    }),
  ];
}

function buildSeedRecuperar(veiculoIds) {
  return [
    createValorRecuperar({
      seedKey: 'iva-recuperar-chapolim',
      descricao: 'IVA a recuperar — Chapolim',
      valor: 10415,
      previsaoMes: '2027-03',
      veiculoId: veiculoIds[VEICULO_KEYS.CHAPOLIM],
      status: VALOR_RECUPERAR_STATUS.PENDENTE,
      observacao: 'Previsão informada: março de 2027. Não é receita realizada até ser recebida.',
    }),
  ];
}

function hasSeedKey(items, seedKey) {
  return (items || []).some((item) => item.seedKey === seedKey || item.id === seedKey);
}

const VANZONA_SEED_KEY = 'seguro-vanzona';
const VANZONA_PAGAMENTO_KEY = 'pagamento-seguro-vanzona-2026-06-02';
const VANZONA_PAGAMENTO_DATA = '2026-06-02';
const VANZONA_VALOR = 69.94;

function findSeguroVanzona(programadas, veiculos) {
  const byKey = (programadas || []).find((item) => item.seedKey === VANZONA_SEED_KEY);
  if (byKey) return byKey;
  const vanzona = (veiculos || []).find(
    (item) => item.seedKey === VEICULO_KEYS.VANZONA || /^vanzona$/i.test(String(item.nome || '').trim())
  );
  if (vanzona) {
    const byVeiculo = (programadas || []).find(
      (item) =>
        item.veiculoId === vanzona.id &&
        item.natureza === DESPESA_NATUREZA.SEGURO &&
        item.ativo !== false
    );
    if (byVeiculo) return byVeiculo;
  }
  return (programadas || []).find(
    (item) => item.natureza === DESPESA_NATUREZA.SEGURO && /vanzona/i.test(item.titulo || '')
  );
}

function needsVanzonaPatch(despesa) {
  if (!despesa) return false;
  return (
    Number(despesa.valor) !== VANZONA_VALOR ||
    despesa.periodicidade !== DESPESA_PERIODICIDADE.UNICA ||
    despesa.recorrenciaConfirmada !== false ||
    despesa.dataInicio !== VANZONA_PAGAMENTO_DATA ||
    Number(despesa.duracaoMeses) !== 3
  );
}

function patchSeguroVanzona(despesa) {
  return {
    ...despesa,
    seedKey: despesa.seedKey || VANZONA_SEED_KEY,
    valor: VANZONA_VALOR,
    periodicidade: DESPESA_PERIODICIDADE.UNICA,
    recorrenciaConfirmada: false,
    dataInicio: VANZONA_PAGAMENTO_DATA,
    duracaoMeses: 3,
    ultimaOcorrenciaMes: despesa.ultimaOcorrenciaMes || '2026-06',
    observacao:
      despesa.observacao && !/renovação|cobertura não cria/i.test(despesa.observacao)
        ? despesa.observacao
        : 'Validade informada: 3 meses. A cobertura não cria cobrança automática.',
    updatedAt: new Date().toISOString(),
  };
}

function isPagamentoVanzonaJunho(gasto, programadaId) {
  if (gasto?.seedKey === VANZONA_PAGAMENTO_KEY) return true;
  if (gasto?.despesaProgramadaId !== programadaId || gasto.estado !== 'pago') return false;
  return String(gasto.dataPagamento || gasto.data || '').slice(0, 10) === VANZONA_PAGAMENTO_DATA;
}

function isOcorrenciaVanzonaAutomaticaFutura(gasto, programadaId) {
  if (!gasto) return false;
  if (gasto.seedKey === VANZONA_PAGAMENTO_KEY) return false;
  if (isPagamentoVanzonaJunho(gasto, programadaId)) return false;
  if (gasto.estado === 'pago') return false;

  const ligado =
    gasto.despesaProgramadaId === programadaId ||
    gasto.seedKey === `pagamento-mensal-2026-09-${VANZONA_SEED_KEY}` ||
    /vanzona/i.test(`${gasto.seedKey || ''} ${gasto.descricao || ''}`);
  if (!ligado) return false;

  if (gasto.estado === 'previsto') return true;

  const mes = String(gasto.mesReferencia || gasto.data || gasto.dataVencimento || '').slice(0, 7);
  return mes > '2026-06' && Math.abs(Number(gasto.valor) - VANZONA_VALOR) < 0.02;
}

const VANZONA_OBS_PAGAMENTO =
  'Pagamento do seguro da Vanzona. Validade informada: 3 meses a partir de 02/06/2026.';

export function applyEmpresaFinanceiroSeed({
  veiculos = [],
  despesasProgramadas = [],
  valoresRecuperar = [],
  appliedKeys = [],
  gastosEmpresa = [],
} = {}) {
  const applied = new Set(appliedKeys || []);
  let veiculosNext = [...(veiculos || [])];
  let programadasNext = [...(despesasProgramadas || [])];
  let recuperarNext = [...(valoresRecuperar || [])];
  let gastosNext = [...(gastosEmpresa || [])];
  let changed = false;

  const veiculoIds = {};
  veiculosNext.forEach((item) => {
    if (item.seedKey) veiculoIds[item.seedKey] = item.id;
  });

  const perfis = patchVeiculosPerfisFiscais(veiculosNext);
  veiculosNext = perfis.veiculos;
  if (perfis.changed) changed = true;

  buildSeedVeiculos().forEach((veiculo) => {
    if (applied.has(veiculo.seedKey) || hasSeedKey(veiculosNext, veiculo.seedKey)) {
      applied.add(veiculo.seedKey);
      const existing = veiculosNext.find((item) => item.seedKey === veiculo.seedKey);
      if (existing) veiculoIds[veiculo.seedKey] = existing.id;
      return;
    }
    const created = { ...veiculo, id: generateId() };
    veiculosNext.push(created);
    veiculoIds[veiculo.seedKey] = created.id;
    applied.add(veiculo.seedKey);
    changed = true;
  });

  buildSeedDespesas(veiculoIds).forEach((despesa) => {
    if (applied.has(despesa.seedKey) || hasSeedKey(programadasNext, despesa.seedKey)) {
      applied.add(despesa.seedKey);
      return;
    }
    programadasNext.push({ ...despesa, id: generateId() });
    applied.add(despesa.seedKey);
    changed = true;
  });

  buildSeedRecuperar(veiculoIds).forEach((item) => {
    if (applied.has(item.seedKey) || hasSeedKey(recuperarNext, item.seedKey)) {
      applied.add(item.seedKey);
      return;
    }
    recuperarNext.push({ ...item, id: generateId() });
    applied.add(item.seedKey);
    changed = true;
  });

  const SEGURO_IVA_KEYS = new Set(['seguro-van-grande', 'seguro-van-pequena']);
  programadasNext = programadasNext.map((despesa) => {
    if (!SEGURO_IVA_KEYS.has(despesa.seedKey) || despesa.ivaDeduzido !== undefined) return despesa;
    changed = true;
    return { ...despesa, ivaDeduzido: false };
  });

  programadasNext = programadasNext.map((despesa) => {
    const isSalarioJeferson =
      despesa.seedKey === 'salario-jeferson' ||
      (despesa.natureza === DESPESA_NATUREZA.SALARIO &&
        /jeferson/i.test(`${despesa.funcionarioNome || ''} ${despesa.titulo || ''}`));
    if (!isSalarioJeferson || despesa.ativo === false) return despesa;
    changed = true;
    return {
      ...despesa,
      ativo: false,
      observacao: despesa.observacao
        ? `${despesa.observacao} Jeferson é pago por diária; o salário mensal fixo foi ocultado.`
        : 'Jeferson é pago por diária. Este salário mensal fixo foi ocultado da área de Gastos da Empresa, sem apagar o registo.',
      updatedAt: new Date().toISOString(),
    };
  });

  applied.add('salario-jeferson');

  const vanzona = findSeguroVanzona(programadasNext, veiculosNext);
  if (vanzona && needsVanzonaPatch(vanzona)) {
    programadasNext = programadasNext.map((item) => (item.id === vanzona.id ? patchSeguroVanzona(item) : item));
    changed = true;
  }

  const MES_AGOSTO = '2026-08';
  const BATCH_AGOSTO = 'pagamentos-mensais-2026-08';
  const MENSAIS_CONHECIDOS = new Set([
    'salario-emerson',
    'seguranca-social-emerson-jeferson',
    'contabilidade-mensal',
    'garagem-ferramentas',
    'prestacao-van-grande',
    'prestacao-van-pequena',
  ]);
  const pagosIds = new Set();
  programadasNext.forEach((despesa) => {
    if (!isDespesaMensalRecorrente(despesa)) return;
    const conhecido = MENSAIS_CONHECIDOS.has(despesa.seedKey);
    if (applied.has(BATCH_AGOSTO) && !conhecido) return;

    const itemKey = `pagamento-mensal-${MES_AGOSTO}-${despesa.seedKey || despesa.id}`;
    if (applied.has(itemKey)) return;
    if (gastosNext.some((gasto) => gasto.seedKey === itemKey)) {
      applied.add(itemKey);
      return;
    }
    if (countPagamentosProgramada(gastosNext, despesa.id, MES_AGOSTO) > 0) {
      applied.add(itemKey);
      return;
    }

    const data = dataNoMesComDiaConhecido(MES_AGOSTO, despesa.diaVencimento);
    const veiculo = veiculosNext.find((item) => item.id === despesa.veiculoId);
    const observacao = despesa.diaVencimento
      ? `Pagamento de agosto de 2026 (dia ${despesa.diaVencimento}).`
      : 'Pagamento de agosto de 2026. Dia exacto não cadastrado.';
    const gasto = {
      ...buildGastoFromProgramada(despesa, {
        data,
        estado: 'pago',
        dataPagamento: data,
        veiculoNome: veiculo?.nome || '',
        observacao,
      }),
      id: generateId(),
      seedKey: itemKey,
      createdAt: new Date().toISOString(),
    };
    gastosNext.push(gasto);
    pagosIds.add(despesa.id);
    applied.add(itemKey);
    changed = true;
  });

  if (pagosIds.size > 0) {
    programadasNext = programadasNext.map((despesa) => {
      if (!pagosIds.has(despesa.id)) return despesa;
      const data = dataNoMesComDiaConhecido(MES_AGOSTO, despesa.diaVencimento);
      return applyPagamentoProgramada(despesa, { dataPagamento: data });
    });
  }

  if (!applied.has(BATCH_AGOSTO)) {
    applied.add(BATCH_AGOSTO);
    changed = true;
  }

  const vanzonaAtual = findSeguroVanzona(programadasNext, veiculosNext);
  if (vanzonaAtual) {
    const jaTemJunho = gastosNext.some((gasto) => isPagamentoVanzonaJunho(gasto, vanzonaAtual.id));
    if (!jaTemJunho) {
      const augustSeed = gastosNext.find(
        (gasto) => gasto.seedKey === `pagamento-mensal-2026-08-${VANZONA_SEED_KEY}`
      );
      const observacaoPagamento = VANZONA_OBS_PAGAMENTO;
      if (augustSeed) {
        gastosNext = gastosNext.map((gasto) =>
          gasto.id === augustSeed.id
            ? {
                ...gasto,
                seedKey: VANZONA_PAGAMENTO_KEY,
                data: VANZONA_PAGAMENTO_DATA,
                dataPagamento: VANZONA_PAGAMENTO_DATA,
                dataVencimento: VANZONA_PAGAMENTO_DATA,
                mesReferencia: '2026-06',
                valor: VANZONA_VALOR,
                periodoCobertoMeses: 3,
                observacao: observacaoPagamento,
              }
            : gasto
        );
        programadasNext = programadasNext.map((item) =>
          item.id === vanzonaAtual.id
            ? applyPagamentoProgramada(item, { dataPagamento: VANZONA_PAGAMENTO_DATA })
            : item
        );
        changed = true;
      } else {
        const veiculo = veiculosNext.find((item) => item.id === vanzonaAtual.veiculoId);
        gastosNext.push({
          ...buildGastoFromProgramada(vanzonaAtual, {
            data: VANZONA_PAGAMENTO_DATA,
            estado: 'pago',
            dataPagamento: VANZONA_PAGAMENTO_DATA,
            veiculoNome: veiculo?.nome || 'Vanzona',
            observacao: observacaoPagamento,
            mesReferencia: '2026-06',
          }),
          id: generateId(),
          seedKey: VANZONA_PAGAMENTO_KEY,
          createdAt: new Date().toISOString(),
        });
        programadasNext = programadasNext.map((item) =>
          item.id === vanzonaAtual.id
            ? applyPagamentoProgramada(item, { dataPagamento: VANZONA_PAGAMENTO_DATA })
            : item
        );
        changed = true;
      }
    }
    applied.add(VANZONA_PAGAMENTO_KEY);

    const futuros = gastosNext.filter((gasto) => isOcorrenciaVanzonaAutomaticaFutura(gasto, vanzonaAtual.id));
    if (futuros.length > 0) {
      const remover = new Set(futuros.map((item) => item.id));
      gastosNext = gastosNext.filter((gasto) => !remover.has(gasto.id));
      changed = true;
    }

    gastosNext = gastosNext.map((gasto) => {
      if (!isPagamentoVanzonaJunho(gasto, vanzonaAtual.id)) return gasto;
      const precisaObs =
        /02\/09\/2026/.test(gasto.observacao || '') || gasto.periodoCobertoMeses !== 3;
      if (!precisaObs && gasto.mesReferencia === '2026-06') return gasto;
      changed = true;
      return {
        ...gasto,
        mesReferencia: gasto.mesReferencia || '2026-06',
        periodoCobertoMeses: 3,
        observacao: /02\/09\/2026/.test(gasto.observacao || '') ? VANZONA_OBS_PAGAMENTO : gasto.observacao,
      };
    });
  }

  const nextKeys = [...applied];
  if (changed) {
    setStorageItem(STORAGE_KEYS.empresaVeiculos, veiculosNext);
    setStorageItem(STORAGE_KEYS.empresaDespesasProgramadas, programadasNext);
    setStorageItem(STORAGE_KEYS.empresaValoresRecuperar, recuperarNext);
    setStorageItem(STORAGE_KEYS.gastosEmpresa, gastosNext);
    setStorageItem(STORAGE_KEYS.empresaFinanceiroSeedKeys, nextKeys);
  } else if (nextKeys.length !== (appliedKeys || []).length) {
    setStorageItem(STORAGE_KEYS.empresaFinanceiroSeedKeys, nextKeys);
  }

  return {
    veiculos: veiculosNext,
    despesasProgramadas: programadasNext,
    valoresRecuperar: recuperarNext,
    gastosEmpresa: gastosNext,
    appliedKeys: nextKeys,
    created: changed,
  };
}

export function loadEmpresaFinanceiroState() {
  return applyEmpresaFinanceiroSeed({
    veiculos: getStorageItem(STORAGE_KEYS.empresaVeiculos, []),
    despesasProgramadas: getStorageItem(STORAGE_KEYS.empresaDespesasProgramadas, []),
    valoresRecuperar: getStorageItem(STORAGE_KEYS.empresaValoresRecuperar, []),
    appliedKeys: getStorageItem(STORAGE_KEYS.empresaFinanceiroSeedKeys, []),
    gastosEmpresa: getStorageItem(STORAGE_KEYS.gastosEmpresa, []),
  });
}
