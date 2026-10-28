import { validateRequired, validateNumber, validateForm } from './validators';
import { getTodayISO } from './formatters';
import { hasIvaInfo, getTaxaPresetId, emptyIvaFormFields, emptyIvaPersistFields, calculateIvaLinhas } from './ivaCalculations';
import { generateOcorrenciasPrevistas } from './gastoEmpresaCalculations';
import { generateId } from '../services/storageService';
import {
  VIA_VERDE_STATUS,
  buildViaVerdeFromForm,
  isCategoriaViaVerde,
  isCategoriaCombustivel,
  isCategoriaManutencao,
} from './empresaFinanceiroCalculations';
import { buildIvaSnapshotFromForm } from './empresaIvaRules';
import { fiscalPadraoFromForm } from './empresaFornecedores';
import { DOCUMENTO_STATUS } from '../constants/empresaIva';
import { resolveDocumentoStatusOnSave } from './empresaDocumentos';
import { persistTipoDocumentoFields, persistValorDocumento, TIPO_DOCUMENTO, isNotaCredito } from './gastoDocumentoTipo';

export const EMPTY_GASTO_EMPRESA_FORM = {
  descricao: '',
  categoria: '',
  valor: '',
  data: getTodayISO(),
  dataVencimento: '',
  dataPagamento: '',
  formaPagamento: 'Transferência',
  estado: 'pendente',
  tipo: 'unico',
  periodicidade: 'mensal',
  valorHabitual: '',
  gerarPrevistos: 'nao',
  observacao: '',
  veiculo: '',
  veiculoId: '',
  obraId: '',
  local: '',
  intervencaoId: '',
  natureza: '',
  pagoPor: '',
  viaVerdeModo: '',
  despesaProgramadaId: '',
  temIva: '',
  valorBaseTipo: '',
  taxaIvaPreset: '',
  taxaIvaOutra: '',
  faturaEmNomeEmpresa: '',
  ivaManual: 'nao',
  percentagemDedutivel: '',
  regraIvaObservacao: '',
  fornecedorId: '',
  fornecedorNome: '',
  salvarFornecedor: 'nao',
  numeroFatura: '',
  documentoStatus: DOCUMENTO_STATUS.SEM_DOCUMENTO,
  anexos: [],
  combustivelTipo: '',
  tipoDespesa: '',
  faturaMultiplasTaxas: 'nao',
  ivaLinhas: [],
  tipoDocumento: TIPO_DOCUMENTO.FATURA,
  faturaOriginalId: '',
};

export function getEmptyGastoEmpresaForm(overrides = {}) {
  const today = getTodayISO();
  return {
    ...EMPTY_GASTO_EMPRESA_FORM,
    data: today,
    estado: 'pago',
    dataPagamento: today,
    tipo: 'unico',
    anexos: [],
    ...overrides,
  };
}

export function gastoEmpresaToForm(gasto) {
  if (!gasto) return getEmptyGastoEmpresaForm();

  const ivaFields = emptyIvaFormFields();
  ivaFields.temIva = hasIvaInfo(gasto) ? 'sim' : gasto.ivaInformado === false ? 'nao' : '';
  if (hasIvaInfo(gasto)) {
    const preset = getTaxaPresetId(gasto.taxaIva);
    ivaFields.valorBaseTipo = gasto.valorBaseTipo || 'com_iva';
    ivaFields.taxaIvaPreset = preset;
    ivaFields.taxaIvaOutra = preset === 'outra' && gasto.taxaIva != null ? String(gasto.taxaIva) : '';
  }

  const valorExibido = hasIvaInfo(gasto)
    ? gasto.valorBaseTipo === 'sem_iva'
      ? gasto.valorSemIva
      : gasto.valorComIva
    : gasto.valor;
  const valorAbs =
    valorExibido != null && Number.isFinite(Number(valorExibido))
      ? Math.abs(Number(valorExibido))
      : valorExibido;

  return {
    descricao: gasto.descricao || '',
    categoria: gasto.categoria || '',
    valor: valorAbs != null ? String(valorAbs) : '',
    data: gasto.data || getTodayISO(),
    dataVencimento: gasto.dataVencimento || '',
    dataPagamento: gasto.dataPagamento || '',
    formaPagamento: gasto.formaPagamento || 'Transferência',
    estado: gasto.estado || 'pendente',
    tipo: gasto.tipo || 'unico',
    periodicidade: gasto.periodicidade || 'mensal',
    valorHabitual: gasto.valorHabitual != null ? String(gasto.valorHabitual) : '',
    gerarPrevistos: 'nao',
    observacao: gasto.observacao || '',
    veiculo: gasto.veiculo || '',
    veiculoId: gasto.veiculoId || '',
    obraId: gasto.obraId || '',
    local: gasto.local || '',
    intervencaoId: gasto.intervencaoId || '',
    natureza: gasto.natureza || '',
    pagoPor: gasto.pagoPor || '',
    despesaProgramadaId: gasto.despesaProgramadaId || '',
    viaVerdeModo:
      gasto.viaVerde?.distribuicaoStatus === VIA_VERDE_STATUS.GERAL
        ? VIA_VERDE_STATUS.GERAL
        : gasto.viaVerde
          ? VIA_VERDE_STATUS.POR_CONFERIR
          : '',
    faturaEmNomeEmpresa:
      gasto.faturaEmNomeEmpresa === true ? 'sim' : gasto.faturaEmNomeEmpresa === false ? 'nao' : '',
    ivaManual: gasto.ivaManual ? 'sim' : 'nao',
    percentagemDedutivel:
      gasto.percentagemDedutivel != null ? String(gasto.percentagemDedutivel) : '',
    regraIvaObservacao: gasto.regraIvaObservacao || '',
    fornecedorId: gasto.fornecedorId || '',
    fornecedorNome: gasto.fornecedorNome || '',
    salvarFornecedor: 'nao',
    numeroFatura: gasto.numeroFatura || '',
    documentoStatus: gasto.documentoStatus || DOCUMENTO_STATUS.SEM_DOCUMENTO,
    anexos: Array.isArray(gasto.anexos) ? gasto.anexos : [],
    combustivelTipo: gasto.combustivelTipo || '',
    tipoDespesa: gasto.tipoDespesa || '',
    faturaMultiplasTaxas: gasto.faturaMultiplasTaxas ? 'sim' : 'nao',
    ivaLinhas: Array.isArray(gasto.ivaLinhas)
      ? gasto.ivaLinhas
          .filter((linha) => linha && typeof linha === 'object')
          .map((linha) => ({
            id: linha.id,
            valorBase: linha.valorBase != null ? String(linha.valorBase) : '',
            taxaIva: linha.taxaIva != null ? String(linha.taxaIva) : '',
          }))
      : [],
    tipoDocumento: isNotaCredito(gasto) ? TIPO_DOCUMENTO.NOTA_CREDITO : TIPO_DOCUMENTO.FATURA,
    faturaOriginalId: gasto.faturaOriginalId || '',
    ...ivaFields,
  };
}

export function formToGastoEmpresaPayload(form, { serieId = null, existing = null, veiculo = null, regras = [], fornecedor = null } = {}) {
  let iva;
  try {
    iva = buildIvaSnapshotFromForm(form, { veiculo, regras, fornecedor });
  } catch {
    iva = emptyIvaPersistFields();
  }
  const valorInformadoRaw = parseFloat(form.valor);
  const valorInformado =
    form.tipoDocumento === TIPO_DOCUMENTO.NOTA_CREDITO
      ? Math.abs(valorInformadoRaw)
      : valorInformadoRaw;
  const valorHabitual = form.valorHabitual !== '' && form.valorHabitual != null
    ? parseFloat(form.valorHabitual)
    : valorInformado;

  const estado = form.estado || 'pendente';
  const dataPagamento = estado === 'pago'
    ? form.dataPagamento || getTodayISO()
    : (form.dataPagamento || '');

  const anexos = Array.isArray(form.anexos) ? form.anexos : [];

  const base = {
    descricao: (form.descricao || '').trim() || String(form.categoria || '').trim(),
    categoria: form.categoria,
    valor: persistValorDocumento(
      form,
      iva.ivaInformado && iva.valorComIva != null ? iva.valorComIva : valorInformado
    ),
    data: form.data,
    dataVencimento: form.dataVencimento || '',
    dataPagamento,
    formaPagamento: form.formaPagamento || '',
    estado,
    tipo: form.tipo || 'unico',
    periodicidade: form.tipo === 'recorrente' ? form.periodicidade : '',
    valorHabitual: form.tipo === 'recorrente' && Number.isFinite(valorHabitual) ? valorHabitual : null,
    observacao: (form.observacao || '').trim(),
    veiculo: (form.veiculo || '').trim(),
    veiculoId: form.veiculoId || null,
    obraId: form.obraId || null,
    local: (form.local || '').trim(),
    intervencaoId: form.intervencaoId || null,
    natureza: form.natureza || '',
    despesaProgramadaId: form.despesaProgramadaId || null,
    pagoPor: (form.pagoPor || '').trim(),
    serieId,
    fornecedorId: form.fornecedorId || null,
    fornecedorNome: (form.fornecedorNome || '').trim(),
    salvarFornecedor: form.salvarFornecedor === 'sim',
    salvarFornecedorFiscal: fiscalPadraoFromForm(form, iva),
    numeroFatura: (form.numeroFatura || '').trim(),
    combustivelTipo: form.combustivelTipo || '',
    tipoDespesa: (form.tipoDespesa || '').trim(),
    anexos,
    documentoStatus: resolveDocumentoStatusOnSave(form, existing),
    faturaMultiplasTaxas: form.faturaMultiplasTaxas === 'sim' && (iva.ivaLinhas || []).length > 0,
    ivaLinhas: Array.isArray(iva.ivaLinhas) ? iva.ivaLinhas : [],
    ...persistTipoDocumentoFields(form),
  };

  const viaVerde = buildViaVerdeFromForm(form, existing);
  if (viaVerde) base.viaVerde = viaVerde;
  else if (existing?.viaVerde && isCategoriaViaVerde(form.categoria)) base.viaVerde = existing.viaVerde;

  if (form.temIva !== 'sim') {
    return { ...base, ...emptyIvaPersistFields(), ...iva, ...persistTipoDocumentoFields(form) };
  }

  return { ...base, ...iva, ...persistTipoDocumentoFields(form) };
}

export function buildCreateGastoEmpresaRecords(form, options = {}) {
  const serieId = form.tipo === 'recorrente' ? generateId() : null;
  const first = formToGastoEmpresaPayload(form, { ...options, serieId });
  const previstos =
    form.tipo === 'recorrente' && form.gerarPrevistos === 'sim'
      ? generateOcorrenciasPrevistas(first).map((item) => ({ ...item, serieId }))
      : [];
  return [first, ...previstos];
}

export function buildGastoEmpresaUpdate(gasto, form, options = {}) {
  const payload = formToGastoEmpresaPayload(form, {
    ...options,
    serieId: gasto.serieId || null,
    existing: gasto,
  });
  const next = {
    ...gasto,
    ...payload,
    serieId: gasto.serieId || payload.serieId || null,
    despesaProgramadaId: gasto.despesaProgramadaId || payload.despesaProgramadaId || null,
    updatedAt: new Date().toISOString(),
  };
  if (!isCategoriaViaVerde(next.categoria)) {
    delete next.viaVerde;
  }
  if (form.temIva !== 'sim') {
    Object.assign(next, emptyIvaPersistFields());
    next.percentagemDedutivel = null;
    next.ivaDedutivelValor = null;
    next.ivaNaoDedutivelValor = null;
    next.regraIvaOrigem = null;
    next.regraIvaId = null;
    next.ivaManual = false;
  }
  return next;
}

export function validateGastoEmpresaForm(form) {
  const descricao = (form.descricao || '').trim() || (form.categoria || '').trim();
  const multiplas = form.faturaMultiplasTaxas === 'sim';
  const errors = {
    descricao: validateRequired(descricao, 'Tipo de gasto'),
    categoria: validateRequired(form.categoria, 'Tipo de gasto'),
    valor: multiplas ? null : validateNumber(form.valor, 'Valor', 0.01),
    data: validateRequired(form.data, 'Data do gasto'),
    estado: validateRequired(form.estado, 'Estado do pagamento'),
    tipo: validateRequired(form.tipo, 'Tipo de gasto'),
    temIva: form.temIva === 'sim' || form.temIva === 'nao' ? null : 'Indique se o gasto tem IVA.',
  };

  if (form.tipo === 'recorrente') {
    errors.periodicidade = validateRequired(form.periodicidade, 'Periodicidade');
    errors.dataVencimento = validateRequired(form.dataVencimento, 'Data de vencimento');
  }

  if (form.valorHabitual !== '' && form.valorHabitual != null) {
    errors.valorHabitual = validateNumber(form.valorHabitual, 'Valor habitual', 0.01);
  }

  if (form.estado === 'pago') {
    errors.dataPagamento = validateRequired(form.dataPagamento || getTodayISO(), 'Data do pagamento');
  }

  if (form.temIva === 'sim') {
    if (multiplas) {
      const linhas = calculateIvaLinhas(form.ivaLinhas || []);
      if (!linhas.linhas.length) {
        errors.taxaIvaPreset = validateRequired(form.taxaIvaPreset, 'Taxa de IVA');
        if (form.taxaIvaPreset === 'outra') {
          errors.taxaIvaOutra = validateNumber(form.taxaIvaOutra, 'Taxa de IVA', 0);
        }
        if (!form.valor && !errors.valor) {
          errors.valor = validateNumber(form.valor, 'Valor', 0.01);
        }
      }
    } else {
      errors.taxaIvaPreset = validateRequired(form.taxaIvaPreset, 'Taxa de IVA');
      if (form.taxaIvaPreset === 'outra') {
        errors.taxaIvaOutra = validateNumber(form.taxaIvaOutra, 'Taxa de IVA', 0);
      }
    }
    if (form.percentagemDedutivel !== '' && form.percentagemDedutivel != null) {
      errors.percentagemDedutivel = validateNumber(form.percentagemDedutivel, 'Percentagem dedutível', 0);
      const pct = parseFloat(form.percentagemDedutivel);
      if (!errors.percentagemDedutivel && pct > 100) {
        errors.percentagemDedutivel = 'Percentagem dedutível deve ser no máximo 100.';
      }
    }
  }

  const precisaVeiculo =
    isCategoriaCombustivel(form.categoria) ||
    isCategoriaManutencao(form.categoria) ||
    String(form.categoria || '').toLowerCase().includes('carregamento');
  if (precisaVeiculo && !form.veiculoId) {
    errors.veiculoId = 'Indique o veículo.';
  }

  return validateForm(errors);
}

export function isGastoEmpresaFormDirty(form, initialForm) {
  return JSON.stringify(form) !== JSON.stringify(initialForm);
}
