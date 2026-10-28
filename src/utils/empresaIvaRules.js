import STORAGE_KEYS, { generateId, getStorageItem, setStorageItem } from '../services/storageService';
import {
  CATEGORIA_CARREGAMENTO_ELETRICO,
  CATEGORIA_CARREGAMENTO_ELETRICO_ANTERIOR,
  IVA_REGRA_ORIGEM,
  VEICULO_COMBUSTIVEL,
  VEICULO_COMBUSTIVEL_LABELS,
  VEICULO_SEED_KEYS,
} from '../constants/empresaIva';
import { isDocumentoGasoleoSimples } from '../constants/empresaFornecedoresRegras';
import { roundMoney, calculateIva, calculateIvaLinhas, hasIvaInfo } from './ivaCalculations';
import { applySinal } from './gastoDocumentoTipo';
import { CATEGORIA_COMBUSTIVEL, CATEGORIA_MANUTENCAO, CATEGORIA_VIA_VERDE } from '../constants/empresaFinanceiro';
import { isCategoriaCarregamento } from './empresaFinanceiroCalculations';

export const VEICULO_PERFIS_CONHECIDOS = {
  [VEICULO_SEED_KEYS.VAN_GRANDE]: {
    modelo: 'Toyota Proace',
    combustivel: VEICULO_COMBUSTIVEL.GASOLEO,
    ivaDedutivelPercent: null,
    regraFiscal: 'conforme_despesa',
    observacaoFiscal: '',
  },
  [VEICULO_SEED_KEYS.VAN_PEQUENA]: {
    modelo: 'Toyota Proace',
    combustivel: VEICULO_COMBUSTIVEL.GASOLEO,
    ivaDedutivelPercent: null,
    regraFiscal: 'conforme_despesa',
    observacaoFiscal: '',
  },
  [VEICULO_SEED_KEYS.CHAPOLIM]: {
    modelo: 'Mercedes GLB',
    combustivel: VEICULO_COMBUSTIVEL.ELETRICO,
    ivaDedutivelPercent: null,
    regraFiscal: 'conforme_despesa',
    observacaoFiscal: '',
  },
  [VEICULO_SEED_KEYS.ZAFIRA]: {
    modelo: '',
    combustivel: VEICULO_COMBUSTIVEL.GASOLINA,
    ivaDedutivelPercent: 0,
    regraFiscal: 'nao_recuperavel',
    observacaoFiscal: 'Não existe recuperação/dedução de IVA pela empresa para este veículo.',
  },
  [VEICULO_SEED_KEYS.VANZONA]: {
    modelo: '',
    combustivel: VEICULO_COMBUSTIVEL.GASOLINA,
    ivaDedutivelPercent: 0,
    regraFiscal: 'nao_recuperavel',
    observacaoFiscal: 'Não existe recuperação/dedução de IVA pela empresa para este veículo.',
  },
};

function nomesCategoriaIguais(a, b) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

export { isCategoriaCarregamento };

export function isVeiculoChapolim(veiculo) {
  if (!veiculo) return false;
  if (veiculo.seedKey === VEICULO_SEED_KEYS.CHAPOLIM) return true;
  return String(veiculo.nome || '')
    .trim()
    .toLowerCase() === 'chapolim';
}

export function aplicarPreenchimentoIvaCarregamento(form, veiculo) {
  if (!form || form.ivaManual === 'sim') return form;
  if (!isVeiculoChapolim(veiculo) || !isCategoriaCarregamento(form.categoria)) return form;
  const next = { ...form };
  next.temIva = 'sim';
  if (!next.valorBaseTipo) next.valorBaseTipo = 'com_iva';
  if (next.faturaMultiplasTaxas !== 'sim') {
    next.taxaIvaPreset = '23';
    next.taxaIvaOutra = '';
  }
  next.percentagemDedutivel = '100';
  return next;
}

export function getVeiculoCombustivelLabel(combustivel) {
  return VEICULO_COMBUSTIVEL_LABELS[combustivel] || '';
}

export function isVeiculoNaoRecuperavel(veiculo) {
  if (!veiculo) return false;
  if (veiculo.regraFiscal === 'nao_recuperavel') return true;
  if (veiculo.ivaDedutivelPercent === 0) return true;
  return (
    veiculo.seedKey === VEICULO_SEED_KEYS.ZAFIRA || veiculo.seedKey === VEICULO_SEED_KEYS.VANZONA
  );
}

export function isCategoriaVeiculoRelacionada(categoria) {
  const nome = String(categoria || '').toLowerCase();
  return (
    nomesCategoriaIguais(categoria, CATEGORIA_COMBUSTIVEL) ||
    nomesCategoriaIguais(categoria, CATEGORIA_MANUTENCAO) ||
    nomesCategoriaIguais(categoria, CATEGORIA_VIA_VERDE) ||
    nomesCategoriaIguais(categoria, 'Manutenção') ||
    nomesCategoriaIguais(categoria, CATEGORIA_CARREGAMENTO_ELETRICO) ||
    nomesCategoriaIguais(categoria, CATEGORIA_CARREGAMENTO_ELETRICO_ANTERIOR) ||
    nome.includes('combust') ||
    nome.includes('carregamento') ||
    nome.includes('manuten') ||
    nome.includes('via verde') ||
    nome.includes('portagen') ||
    nome.includes('pneu') ||
    nome.includes('estacionamento')
  );
}

export function isCategoriaMaterial(categoria) {
  const nome = String(categoria || '').toLowerCase();
  return nome === 'material' || nome.startsWith('material ');
}

export function createIvaRegra(input = {}) {
  return {
    id: input.id || generateId(),
    seedKey: input.seedKey || null,
    ativo: input.ativo !== false,
    categoria: input.categoria || '',
    subcategoria: input.subcategoria || '',
    veiculoSeedKeys: Array.isArray(input.veiculoSeedKeys) ? input.veiculoSeedKeys : [],
    exigeFaturaEmpresa: Boolean(input.exigeFaturaEmpresa),
    percentagemDedutivel:
      input.percentagemDedutivel == null || input.percentagemDedutivel === ''
        ? null
        : Number(input.percentagemDedutivel),
    observacao: String(input.observacao || '').trim(),
    prioridade: Number.isFinite(Number(input.prioridade)) ? Number(input.prioridade) : 50,
    createdAt: input.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function buildDefaultIvaRegras() {
  return [
    createIvaRegra({
      seedKey: 'regra-zafira',
      veiculoSeedKeys: [VEICULO_SEED_KEYS.ZAFIRA],
      percentagemDedutivel: 0,
      observacao: 'IVA não recuperado pela empresa para a Zafira.',
      prioridade: 10,
    }),
    createIvaRegra({
      seedKey: 'regra-vanzona',
      veiculoSeedKeys: [VEICULO_SEED_KEYS.VANZONA],
      percentagemDedutivel: 0,
      observacao: 'IVA não recuperado pela empresa para a Vanzona.',
      prioridade: 10,
    }),
    createIvaRegra({
      seedKey: 'regra-chapolim-carregamento',
      categoria: CATEGORIA_CARREGAMENTO_ELETRICO,
      veiculoSeedKeys: [VEICULO_SEED_KEYS.CHAPOLIM],
      percentagemDedutivel: 100,
      observacao: 'Carregamento / eletricidade do Chapolim: IVA 23% com 100% dedutível. Pode alterar só nesta fatura.',
      prioridade: 8,
    }),
    createIvaRegra({
      seedKey: 'regra-material-atividade',
      categoria: 'Material',
      exigeFaturaEmpresa: true,
      percentagemDedutivel: 100,
      observacao: 'Material diretamente relacionado com a atividade. Alterável nas configurações.',
      prioridade: 20,
    }),
  ];
}

export function loadEmpresaIvaRegras(stored) {
  const list = (Array.isArray(stored) ? stored : []).filter((item) => item && typeof item === 'object');
  const known = new Set(list.map((item) => item.seedKey).filter(Boolean));
  let changed = false;
  buildDefaultIvaRegras().forEach((regra) => {
    if (!regra.seedKey || known.has(regra.seedKey)) return;
    list.push(regra);
    known.add(regra.seedKey);
    changed = true;
  });
  if (changed) setStorageItem(STORAGE_KEYS.empresaIvaRegras, list);
  return list;
}

function regraCobreVeiculo(regra, veiculo) {
  const keys = regra.veiculoSeedKeys || [];
  if (keys.length === 0) return true;
  if (!veiculo) return false;
  return keys.includes(veiculo.seedKey);
}

function regraCobreCategoria(regra, categoria) {
  if (!regra.categoria) return true;
  if (nomesCategoriaIguais(regra.categoria, categoria)) return true;
  if (isCategoriaMaterial(regra.categoria) && isCategoriaMaterial(categoria)) return true;
  if (isCategoriaCarregamento(regra.categoria) && isCategoriaCarregamento(categoria)) return true;
  return false;
}

export function getVatRule({
  regras = [],
  categoria,
  veiculo = null,
  faturaEmNomeEmpresa = null,
  temIva = false,
  fornecedor = null,
  tipoDespesa = '',
} = {}) {
  if (!temIva) {
    return {
      percentagemDedutivel: null,
      origem: IVA_REGRA_ORIGEM.POR_DETERMINAR,
      regra: null,
      observacao: '',
    };
  }

  if (veiculo && isVeiculoNaoRecuperavel(veiculo) && isCategoriaVeiculoRelacionada(categoria)) {
    return {
      percentagemDedutivel: 0,
      origem: IVA_REGRA_ORIGEM.VEICULO,
      regra: null,
      observacao: veiculo.observacaoFiscal || 'IVA não recuperado pela empresa para este veículo.',
    };
  }

  if (isCategoriaCarregamento(categoria) && isVeiculoChapolim(veiculo)) {
    return {
      percentagemDedutivel: 100,
      origem: IVA_REGRA_ORIGEM.VEICULO,
      regra: null,
      observacao: 'Carregamento / eletricidade do Chapolim: IVA 23% com 100% dedutível. Pode alterar só nesta fatura.',
    };
  }

  const pctFornecedor =
    fornecedor?.percentagemIvaRecuperavel != null && Number.isFinite(Number(fornecedor.percentagemIvaRecuperavel))
      ? Number(fornecedor.percentagemIvaRecuperavel)
      : null;
  if (pctFornecedor != null && fornecedor?.ivaVariavel !== true) {
    return {
      percentagemDedutivel: pctFornecedor,
      origem: IVA_REGRA_ORIGEM.FORNECEDOR,
      regra: null,
      observacao: `A taxa da fatura não muda. Recupera-se ${pctFornecedor}% do IVA pago, não uma taxa reduzida.`,
    };
  }

  if (
    isDocumentoGasoleoSimples(tipoDespesa) ||
    isDocumentoGasoleoSimples(fornecedor?.nome) ||
    isDocumentoGasoleoSimples(fornecedor?.subcategoriaPadrao)
  ) {
    return {
      percentagemDedutivel: 50,
      origem: IVA_REGRA_ORIGEM.FORNECEDOR,
      regra: null,
      observacao: 'A taxa da fatura é 23%. Recupera-se 50% desse IVA, não uma taxa de 11,5%.',
    };
  }

  const ativas = (regras || []).filter((item) => item && typeof item === 'object' && item.ativo !== false);
  const matches = ativas
    .filter((regra) => regraCobreCategoria(regra, categoria) && regraCobreVeiculo(regra, veiculo))
    .filter((regra) => {
      if (!regra.exigeFaturaEmpresa) return true;
      return faturaEmNomeEmpresa === true || faturaEmNomeEmpresa === 'sim';
    })
    .sort((a, b) => (a.prioridade ?? 50) - (b.prioridade ?? 50));

  if (matches.length > 0) {
    const regra = matches[0];
    const origem =
      (regra.veiculoSeedKeys || []).length > 0 ? IVA_REGRA_ORIGEM.VEICULO : IVA_REGRA_ORIGEM.CONFIGURACAO;
    return {
      percentagemDedutivel:
        regra.percentagemDedutivel == null ? null : Number(regra.percentagemDedutivel),
      origem,
      regra,
      observacao: regra.observacao || '',
    };
  }

  return {
    percentagemDedutivel: null,
    origem: IVA_REGRA_ORIGEM.POR_DETERMINAR,
    regra: null,
    observacao: '',
  };
}

export function calculateVatDeductibility({
  valorIva,
  percentagemDedutivel,
} = {}) {
  if (valorIva == null || !Number.isFinite(Number(valorIva))) {
    return { ivaDedutivelValor: null, ivaNaoDedutivelValor: null };
  }
  if (percentagemDedutivel == null || !Number.isFinite(Number(percentagemDedutivel))) {
    return { ivaDedutivelValor: null, ivaNaoDedutivelValor: null };
  }
  const iva = roundMoney(valorIva);
  const pct = Math.min(100, Math.max(0, Number(percentagemDedutivel)));
  const ivaDedutivelValor = roundMoney(iva * (pct / 100));
  const ivaNaoDedutivelValor = roundMoney(iva - ivaDedutivelValor);
  return { ivaDedutivelValor, ivaNaoDedutivelValor };
}

export function buildIvaSnapshotFromForm(form, { veiculo = null, regras = [], fornecedor = null } = {}) {
  if (form?.temIva !== 'sim') {
    return {
      ivaInformado: false,
      valorBaseTipo: null,
      taxaIva: null,
      valorSemIva: null,
      valorIva: null,
      valorComIva: null,
      ivaDedutivel: null,
      percentagemDedutivel: null,
      ivaDedutivelValor: null,
      ivaNaoDedutivelValor: null,
      faturaEmNomeEmpresa: form?.faturaEmNomeEmpresa === 'sim' ? true : form?.faturaEmNomeEmpresa === 'nao' ? false : null,
      regraIvaOrigem: null,
      regraIvaId: null,
      regraIvaObservacao: '',
      ivaManual: false,
      ivaLinhas: [],
      valorBase: null,
      percentualIvaRecuperavel: null,
      valorIvaRecuperavel: null,
      valorIvaNaoRecuperavel: null,
      valorTotal: null,
    };
  }

  const multiplas = form.faturaMultiplasTaxas === 'sim';
  const linhasCalc = multiplas ? calculateIvaLinhas(form.ivaLinhas || []) : null;
  const usarMultiplas = Boolean(linhasCalc && linhasCalc.linhas.length > 0);
  const calc = usarMultiplas
    ? {
        valorSemIva: linhasCalc.valorSemIva,
        valorIva: linhasCalc.valorIva,
        valorComIva: linhasCalc.valorComIva,
        taxaPercent: linhasCalc.taxaIva,
      }
    : calculateIva({
        valorInformado: parseFloat(form.valor),
        tipo: form.valorBaseTipo || 'com_iva',
        taxaPercent:
          form.taxaIvaPreset === 'outra'
            ? parseFloat(form.taxaIvaOutra)
            : form.taxaIvaPreset
              ? Number(form.taxaIvaPreset)
              : NaN,
      });

  const manual = form.ivaManual === 'sim' || form.ivaManual === true;
  const regra = getVatRule({
    regras,
    categoria: form.categoria,
    veiculo,
    faturaEmNomeEmpresa: form.faturaEmNomeEmpresa,
    temIva: true,
    fornecedor,
    tipoDespesa: form.tipoDespesa || form.descricao || '',
  });

  let percentagem = regra.percentagemDedutivel;
  let origem = regra.origem;
  let observacao = regra.observacao;
  let regraId = regra.regra?.id || null;

  if (manual) {
    const typed = parseFloat(form.percentagemDedutivel);
    percentagem = Number.isFinite(typed) ? typed : null;
    origem = IVA_REGRA_ORIGEM.MANUAL;
    observacao = String(form.regraIvaObservacao || '').trim();
    regraId = null;
  } else {
    const typed = parseFloat(form.percentagemDedutivel);
    if (Number.isFinite(typed) && origem !== IVA_REGRA_ORIGEM.VEICULO) {
      percentagem = typed;
      if (origem === IVA_REGRA_ORIGEM.POR_DETERMINAR) origem = IVA_REGRA_ORIGEM.FORNECEDOR;
    }
  }

  const split = calculateVatDeductibility({
    valorIva: calc?.valorIva,
    percentagemDedutivel: percentagem,
  });

  if (!calc) {
    return {
      ivaInformado: false,
      valorBaseTipo: form.valorBaseTipo || 'com_iva',
      taxaIva: null,
      valorSemIva: null,
      valorIva: null,
      valorComIva: null,
      ivaDedutivel: null,
      percentagemDedutivel: percentagem,
      ivaDedutivelValor: null,
      ivaNaoDedutivelValor: null,
      faturaEmNomeEmpresa: form.faturaEmNomeEmpresa === 'sim' ? true : form.faturaEmNomeEmpresa === 'nao' ? false : null,
      regraIvaOrigem: origem,
      regraIvaId: regraId,
      regraIvaObservacao: observacao,
      ivaManual: manual,
      ivaLinhas: [],
      valorBase: null,
      percentualIvaRecuperavel: percentagem,
      valorIvaRecuperavel: null,
      valorIvaNaoRecuperavel: null,
      valorTotal: null,
    };
  }

  return {
    ivaInformado: true,
    valorBaseTipo: usarMultiplas ? 'sem_iva' : (form.valorBaseTipo || 'com_iva'),
    taxaIva: calc.taxaPercent,
    valorSemIva: calc.valorSemIva,
    valorIva: calc.valorIva,
    valorComIva: calc.valorComIva,
    ivaDedutivel: percentagem == null ? null : percentagem > 0,
    percentagemDedutivel: percentagem,
    ivaDedutivelValor: split.ivaDedutivelValor,
    ivaNaoDedutivelValor: split.ivaNaoDedutivelValor,
    faturaEmNomeEmpresa: form.faturaEmNomeEmpresa === 'sim' ? true : form.faturaEmNomeEmpresa === 'nao' ? false : null,
    regraIvaOrigem: origem,
    regraIvaId: regraId,
    regraIvaObservacao: observacao,
    ivaManual: manual,
    ivaLinhas: linhasCalc?.linhas || [],
    valorBase: calc.valorSemIva,
    percentualIvaRecuperavel: percentagem,
    valorIvaRecuperavel: split.ivaDedutivelValor,
    valorIvaNaoRecuperavel: split.ivaNaoDedutivelValor,
    valorTotal: calc.valorComIva,
  };
}

export function getIvaBreakdown(gasto) {
  if (!hasIvaInfo(gasto)) {
    return {
      suportado: null,
      dedutivel: null,
      naoDedutivel: null,
      percentagem: null,
    };
  }

  const suportado = Number(gasto.valorIva) || 0;
  const recuperavel = gasto.ivaDedutivelValor ?? gasto.valorIvaRecuperavel;
  const naoRecuperavel = gasto.ivaNaoDedutivelValor ?? gasto.valorIvaNaoRecuperavel;
  const percentagem = gasto.percentagemDedutivel ?? gasto.percentualIvaRecuperavel;
  if (recuperavel != null && Number.isFinite(Number(recuperavel))) {
    return {
      suportado,
      dedutivel: Number(recuperavel),
      naoDedutivel:
        naoRecuperavel != null
          ? Number(naoRecuperavel)
          : roundMoney(suportado - Number(recuperavel)),
      percentagem,
    };
  }

  if (gasto.percentagemDedutivel != null && Number.isFinite(Number(gasto.percentagemDedutivel))) {
    const split = calculateVatDeductibility({
      valorIva: suportado,
      percentagemDedutivel: gasto.percentagemDedutivel,
    });
    return {
      suportado,
      dedutivel: split.ivaDedutivelValor,
      naoDedutivel: split.ivaNaoDedutivelValor,
      percentagem: gasto.percentagemDedutivel,
    };
  }

  if (gasto.ivaDedutivel === true) {
    return { suportado, dedutivel: suportado, naoDedutivel: 0, percentagem: 100 };
  }
  if (gasto.ivaDedutivel === false) {
    return { suportado, dedutivel: 0, naoDedutivel: suportado, percentagem: 0 };
  }

  return { suportado, dedutivel: null, naoDedutivel: null, percentagem: null };
}

export function formatGastoEmpresaIvaHint(gasto, formatCurrency) {
  if (!gasto || typeof formatCurrency !== 'function') return '';
  try {
    const breakdown = getIvaBreakdown(gasto);
    if (breakdown.suportado == null) return '';
    const parts = [];
    if (gasto.valorSemIva != null && Number(gasto.valorSemIva) !== 0) {
      parts.push(`sem IVA ${formatCurrency(applySinal(gasto.valorSemIva, gasto))}`);
    }
    if (Number(breakdown.suportado) !== 0) {
      parts.push(`IVA ${formatCurrency(applySinal(breakdown.suportado, gasto))}`);
    }
    if (breakdown.dedutivel != null && Number(breakdown.dedutivel) !== 0) {
      parts.push(`dedutível ${formatCurrency(applySinal(breakdown.dedutivel, gasto))}`);
    }
    if (breakdown.naoDedutivel != null && Number(breakdown.naoDedutivel) !== 0) {
      parts.push(`não dedutível ${formatCurrency(applySinal(breakdown.naoDedutivel, gasto))}`);
    }
    return parts.join(' · ');
  } catch {
    return '';
  }
}

function resolvePerfilConhecido(veiculo) {
  if (veiculo?.seedKey && VEICULO_PERFIS_CONHECIDOS[veiculo.seedKey]) {
    return { spec: VEICULO_PERFIS_CONHECIDOS[veiculo.seedKey], seedKey: veiculo.seedKey };
  }
  const nome = String(veiculo?.nome || '').trim().toLowerCase();
  const byName = {
    'van grande': VEICULO_SEED_KEYS.VAN_GRANDE,
    'van pequena': VEICULO_SEED_KEYS.VAN_PEQUENA,
    chapolim: VEICULO_SEED_KEYS.CHAPOLIM,
    zafira: VEICULO_SEED_KEYS.ZAFIRA,
    vanzona: VEICULO_SEED_KEYS.VANZONA,
  };
  const seedKey = byName[nome];
  if (seedKey) return { spec: VEICULO_PERFIS_CONHECIDOS[seedKey], seedKey };
  return { spec: null, seedKey: null };
}

export function patchVeiculoPerfilConhecido(veiculo) {
  const { spec, seedKey } = resolvePerfilConhecido(veiculo);
  if (!spec) return { veiculo, changed: false };

  const next = { ...veiculo };
  let changed = false;

  if (!next.seedKey && seedKey) {
    next.seedKey = seedKey;
    changed = true;
  }

  if (!String(next.modelo || '').trim() && spec.modelo) {
    next.modelo = spec.modelo;
    changed = true;
  }
  if (!next.combustivel && spec.combustivel) {
    next.combustivel = spec.combustivel;
    changed = true;
  }
  if (next.ivaDedutivelPercent == null && spec.ivaDedutivelPercent != null) {
    next.ivaDedutivelPercent = spec.ivaDedutivelPercent;
    changed = true;
  }
  if (!next.regraFiscal && spec.regraFiscal) {
    next.regraFiscal = spec.regraFiscal;
    changed = true;
  }
  if (!String(next.observacaoFiscal || '').trim() && spec.observacaoFiscal) {
    next.observacaoFiscal = spec.observacaoFiscal;
    changed = true;
  }

  if (changed) next.updatedAt = new Date().toISOString();
  return { veiculo: next, changed };
}

export function patchVeiculosPerfisFiscais(veiculos = []) {
  let changed = false;
  const next = (veiculos || []).map((item) => {
    const result = patchVeiculoPerfilConhecido(item);
    if (result.changed) changed = true;
    return result.veiculo;
  });
  return { veiculos: next, changed };
}
