import { validateRequired, validateNumber, validateForm } from './validators';
import { getTodayISO } from './formatters';
import {
  hasIvaInfo,
  getTaxaPresetId,
  emptyIvaFormFields,
  emptyIvaPersistFields,
  isGastoFormComIva,
  calculateIvaLinhas,
} from './ivaCalculations';
import { buildIvaSnapshotFromForm } from './empresaIvaRules';
import { fiscalPadraoFromForm } from './empresaFornecedores';
import { persistTipoDocumentoFields, persistValorDocumento, TIPO_DOCUMENTO, isNotaCredito } from './gastoDocumentoTipo';
import { GASTO_PAGADOR, getGastoPagadorLabel, resolveGastoPagadorId } from './obraPartnership';

export const EMPTY_GASTO_FORM = {
  categoria: 'Material',
  quantidade: '',
  valor: '',
  data: getTodayISO(),
  obraId: '',
  intervencaoId: '',
  observacao: '',
  descricao: '',
  fornecedor: '',
  fornecedorId: '',
  fornecedorNome: '',
  salvarFornecedor: 'nao',
  temIva: '',
  valorBaseTipo: '',
  taxaIvaPreset: '',
  taxaIvaOutra: '',
  ivaDedutivel: '',
  ivaManual: 'nao',
  percentagemDedutivel: '',
  faturaMultiplasTaxas: 'nao',
  ivaLinhas: [],
  pagoPor: 'empresa',
  destinoSemObra: '',
  veiculoId: '',
  veiculo: '',
  tipoDocumento: TIPO_DOCUMENTO.FATURA,
  numeroFatura: '',
  faturaOriginalId: '',
};

export function gastoToForm(gasto, obra = null) {
  if (!gasto) return { ...EMPTY_GASTO_FORM, data: getTodayISO() };

  const ivaFields = emptyIvaFormFields();
  ivaFields.temIva = hasIvaInfo(gasto) ? 'sim' : gasto.ivaInformado === false ? 'nao' : '';

  if (hasIvaInfo(gasto)) {
    const preset = getTaxaPresetId(gasto.taxaIva);
    ivaFields.valorBaseTipo = gasto.valorBaseTipo || 'com_iva';
    ivaFields.taxaIvaPreset = preset;
    ivaFields.taxaIvaOutra = preset === 'outra' && gasto.taxaIva != null ? String(gasto.taxaIva) : '';
    ivaFields.ivaDedutivel = gasto.ivaDedutivel === true ? 'sim' : gasto.ivaDedutivel === false ? 'nao' : '';
  }

  const nome = gasto.fornecedorNome || gasto.fornecedor || '';
  let percentagemDedutivel = '';
  let ivaManual = gasto.ivaManual ? 'sim' : 'nao';
  if (gasto.percentagemDedutivel != null && gasto.percentagemDedutivel !== '') {
    percentagemDedutivel = String(gasto.percentagemDedutivel);
  } else if (gasto.ivaDedutivel === true) {
    percentagemDedutivel = '100';
    ivaManual = 'sim';
  } else if (gasto.ivaDedutivel === false) {
    percentagemDedutivel = '0';
    ivaManual = 'sim';
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
    categoria: gasto.categoria || 'Material',
    quantidade: gasto.quantidade != null && gasto.quantidade !== '' ? String(gasto.quantidade) : '',
    valor: valorAbs != null ? String(valorAbs) : '',
    data: gasto.data || getTodayISO(),
    obraId: gasto.obraId || '',
    intervencaoId: gasto.intervencaoId || '',
    observacao: gasto.observacao || '',
    descricao: gasto.descricao || '',
    fornecedor: nome,
    fornecedorId: gasto.fornecedorId || '',
    fornecedorNome: nome,
    salvarFornecedor: 'nao',
    pagoPor: resolveGastoPagadorId(gasto, obra),
    destinoSemObra: '',
    veiculoId: gasto.veiculoId || '',
    veiculo: gasto.veiculo || '',
    tipoDocumento: isNotaCredito(gasto) ? TIPO_DOCUMENTO.NOTA_CREDITO : TIPO_DOCUMENTO.FATURA,
    numeroFatura: gasto.numeroFatura || gasto.numeroNotaCredito || '',
    faturaOriginalId: gasto.faturaOriginalId || '',
    ivaManual,
    percentagemDedutivel,
    faturaMultiplasTaxas: gasto.faturaMultiplasTaxas ? 'sim' : 'nao',
    ivaLinhas: Array.isArray(gasto.ivaLinhas)
      ? gasto.ivaLinhas.map((linha) => ({
          id: linha.id,
          valorBase: linha.valorBase != null ? String(linha.valorBase) : '',
          taxaIva: linha.taxaIva != null ? String(linha.taxaIva) : '',
        }))
      : [],
    ...ivaFields,
  };
}

function parseOptionalQuantidade(value) {
  if (value === '' || value == null) return null;
  const n = parseFloat(value);
  return Number.isNaN(n) ? null : n;
}

function formToGastoBase(form) {
  const observacao = (form.observacao || '').trim();
  const descricao = (form.descricao || '').trim();
  const nome = (form.fornecedorNome || form.fornecedor || '').trim();
  const quantidade = parseOptionalQuantidade(form.quantidade);

  return {
    descricao,
    categoria: form.categoria,
    ...(quantidade != null ? { quantidade } : {}),
    valor: persistValorDocumento(form, parseFloat(form.valor)),
    data: form.data,
    obraId: form.obraId || null,
    intervencaoId: form.intervencaoId || null,
    fornecedor: nome,
    fornecedorId: form.fornecedorId || null,
    fornecedorNome: nome,
    observacao,
    ...persistTipoDocumentoFields(form),
  };
}

export function applyGastoPagoPor(record, form, isPartnership, partnerId = null) {
  if (!record) return record;

  if (!isPartnership) {
    if (!record.pagoPor && !record.pagoPorParticipanteId && !record.pagoPorNome) return record;
    const { pagoPor, pagoPorParticipanteId, pagoPorNome, ...rest } = record;
    return rest;
  }

  const pagadorId =
    form?.pagoPor === GASTO_PAGADOR.FABIO ||
    form?.pagoPor === GASTO_PAGADOR.JULIANO ||
    form?.pagoPor === GASTO_PAGADOR.CAIXA
      ? form.pagoPor
      : GASTO_PAGADOR.EMPRESA;

  const next = {
    ...record,
    pagoPor: pagadorId,
    pagoPorNome: getGastoPagadorLabel(pagadorId),
  };

  if (pagadorId !== GASTO_PAGADOR.EMPRESA && pagadorId !== GASTO_PAGADOR.CAIXA && partnerId) {
    next.pagoPorParticipanteId = partnerId;
  } else if (next.pagoPorParticipanteId && (pagadorId === GASTO_PAGADOR.EMPRESA || pagadorId === GASTO_PAGADOR.CAIXA)) {
    const { pagoPorParticipanteId, ...rest } = next;
    return rest;
  }

  return next;
}

function buildGastoIva(form, options = {}) {
  return buildIvaSnapshotFromForm(form, {
    regras: options.regras || [],
    fornecedor: options.fornecedor || null,
  });
}

export function formToGastoPayload(form, options = {}) {
  const base = applyGastoPagoPor(
    formToGastoBase(form),
    form,
    options.isPartnership,
    options.partnerId
  );
  const salvarFornecedor = form.salvarFornecedor === 'sim';
  if (!isGastoFormComIva(form)) {
    return {
      ...base,
      ...emptyIvaPersistFields(),
      valor: persistValorDocumento(form, parseFloat(form.valor)),
      salvarFornecedor,
      salvarFornecedorFiscal: fiscalPadraoFromForm(form, null),
    };
  }

  const iva = buildGastoIva(form, options);
  if (!iva?.ivaInformado) {
    return {
      ...base,
      ...emptyIvaPersistFields(),
      valor: persistValorDocumento(form, parseFloat(form.valor)),
      salvarFornecedor,
      salvarFornecedorFiscal: fiscalPadraoFromForm(form, iva),
    };
  }

  return {
    ...base,
    ...iva,
    salvarFornecedor,
    salvarFornecedorFiscal: fiscalPadraoFromForm(form, iva),
    valor: persistValorDocumento(form, iva.valorComIva),
  };
}

export function validateGastoForm(form) {
  const multiplas = form.faturaMultiplasTaxas === 'sim';
  const errors = {
    valor: multiplas ? null : validateNumber(form.valor, 'Valor', 0.01),
    data: validateRequired(form.data, 'Data'),
    categoria: validateRequired(form.categoria, 'Tipo de gasto'),
  };

  errors.temIva =
    form.temIva === 'sim' || form.temIva === 'nao' ? null : 'Indique se o gasto tem IVA.';

  if (isGastoFormComIva(form)) {
    if (multiplas) {
      const linhas = calculateIvaLinhas(form.ivaLinhas || []);
      if (!linhas.linhas.length) {
        errors.valor = 'Indique pelo menos uma linha com base sem IVA e taxa.';
      }
    } else {
      errors.valorBaseTipo = validateRequired(form.valorBaseTipo, 'Tipo de valor');
      errors.taxaIvaPreset = validateRequired(form.taxaIvaPreset, 'Taxa de IVA');
      if (form.taxaIvaPreset === 'outra') {
        errors.taxaIvaOutra = validateNumber(form.taxaIvaOutra, 'Taxa de IVA', 0);
      }
    }
  }

  return validateForm(errors);
}

export function isGastoFormDirty(form, initialForm) {
  return JSON.stringify(form) !== JSON.stringify(initialForm);
}

export function buildGastoUpdate(gasto, form, options = {}) {
  const payload = formToGastoPayload(form, options);
  const base = applyGastoPagoPor(
    {
      ...gasto,
      ...payload,
      updatedAt: new Date().toISOString(),
    },
    form,
    options.isPartnership,
    options.partnerId
  );

  if (!isGastoFormComIva(form) && hasIvaInfo(gasto)) {
    return {
      ...base,
      ...emptyIvaPersistFields(),
      valor: persistValorDocumento(form, parseFloat(form.valor)),
    };
  }

  return base;
}

export function getEmptyGastoForm(overrides = {}) {
  return { ...EMPTY_GASTO_FORM, data: getTodayISO(), ...overrides };
}
