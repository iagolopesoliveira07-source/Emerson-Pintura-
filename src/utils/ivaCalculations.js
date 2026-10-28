import { validateRequired, validateNumber, validateForm } from './validators';
import { getTodayISO } from './formatters';
import { applySinal, getGastoValorAssinado } from './gastoDocumentoTipo';
import { isGastoForaDoIvaEmerson } from './gastoEmersonIva';

export const IVA_TAXA_PRESETS = [
  { id: '23', label: '23%', value: 23 },
  { id: '13', label: '13%', value: 13 },
  { id: '6', label: '6%', value: 6 },
  { id: 'outra', label: 'Outra', value: null },
];

/** Arredondamento financeiro a 2 casas decimais. */
export function roundMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function hasIvaInfo(gasto) {
  return Boolean(gasto && gasto.ivaInformado === true);
}

export function emptyIvaFormFields() {
  return {
    valorBaseTipo: '',
    taxaIvaPreset: '',
    taxaIvaOutra: '',
    ivaDedutivel: '',
  };
}

export function emptyIvaPersistFields() {
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

export function isGastoFormComIva(form) {
  return form?.temIva === 'sim';
}

export function getTaxaPresetId(taxaPercent) {
  const n = Number(taxaPercent);
  if (n === 23) return '23';
  if (n === 13) return '13';
  if (n === 6) return '6';
  return 'outra';
}

export function formatTaxaIva(taxaPercent) {
  const n = Number(taxaPercent);
  if (!Number.isFinite(n)) return '—';
  if (Number.isInteger(n)) return `${n}%`;
  return `${n}%`;
}

export function resolveTaxaPercent(form) {
  if (!form) return NaN;
  if (form.taxaIvaPreset === 'outra') return parseFloat(form.taxaIvaOutra);
  if (form.taxaIvaPreset === '23' || form.taxaIvaPreset === '13' || form.taxaIvaPreset === '6') {
    return Number(form.taxaIvaPreset);
  }
  return NaN;
}

/**
 * Calcula o desdobramento de IVA.
 * tipo: 'sem_iva' | 'com_iva'
 * taxaPercent: 23, 13, 6 ou taxa personalizada
 */
export function calculateIva({ valorInformado, tipo, taxaPercent }) {
  const valor = roundMoney(valorInformado);
  const taxa = Number(taxaPercent);

  if (!Number.isFinite(valor) || valor <= 0) return null;
  if (!Number.isFinite(taxa) || taxa < 0 || taxa > 100) return null;
  if (tipo !== 'sem_iva' && tipo !== 'com_iva') return null;

  const rate = taxa / 100;

  if (tipo === 'sem_iva') {
    const valorSemIva = valor;
    const valorIva = roundMoney(valorSemIva * rate);
    const valorComIva = roundMoney(valorSemIva + valorIva);
    return { valorSemIva, valorIva, valorComIva, taxaPercent: taxa };
  }

  const valorComIva = valor;
  const valorSemIva = roundMoney(valorComIva / (1 + rate));
  const valorIva = roundMoney(valorComIva - valorSemIva);
  return { valorSemIva, valorIva, valorComIva, taxaPercent: taxa };
}

export function calculateIvaLinhas(linhas = []) {
  const items = [];
  const list = Array.isArray(linhas) ? linhas : [];
  for (const linha of list) {
    if (!linha || typeof linha !== 'object') continue;
    const calc = calculateIva({
      valorInformado: parseFloat(linha.valorBase),
      tipo: 'sem_iva',
      taxaPercent: parseFloat(linha.taxaIva),
    });
    if (!calc) continue;
    items.push({
      id: linha.id,
      valorBase: calc.valorSemIva,
      taxaIva: calc.taxaPercent,
      valorIva: calc.valorIva,
      valorTotal: calc.valorComIva,
    });
  }
  const valorSemIva = roundMoney(items.reduce((sum, item) => sum + (item.valorBase || 0), 0));
  const valorIva = roundMoney(items.reduce((sum, item) => sum + (item.valorIva || 0), 0));
  const valorComIva = roundMoney(valorSemIva + valorIva);
  return { linhas: items, valorSemIva, valorIva, valorComIva, taxaIva: items.length === 1 ? items[0].taxaIva : null };
}

export function isIvaFormStarted(form) {
  if (!form) return false;
  return Boolean(
    form.valorBaseTipo ||
      form.taxaIvaPreset ||
      form.taxaIvaOutra ||
      form.ivaDedutivel
  );
}

export function parseIvaFieldsFromForm(form) {
  if (form?.temIva === 'nao' || form?.temIva === '') return null;

  const calc = calculateIva({
    valorInformado: parseFloat(form?.valor),
    tipo: form?.valorBaseTipo,
    taxaPercent: resolveTaxaPercent(form),
  });

  if (!calc) return null;
  if (form?.ivaDedutivel !== 'sim' && form?.ivaDedutivel !== 'nao') return null;

  return {
    ivaInformado: true,
    valorBaseTipo: form.valorBaseTipo,
    taxaIva: calc.taxaPercent,
    valorSemIva: calc.valorSemIva,
    valorIva: calc.valorIva,
    valorComIva: calc.valorComIva,
    ivaDedutivel: form.ivaDedutivel === 'sim',
  };
}

export function previewIvaFromForm(form) {
  if (form?.temIva === 'nao' || form?.temIva === '') return null;
  return calculateIva({
    valorInformado: parseFloat(form?.valor),
    tipo: form?.valorBaseTipo,
    taxaPercent: resolveTaxaPercent(form),
  });
}

export function validateIvaFormFields(form) {
  const errors = {
    valorBaseTipo: validateRequired(form.valorBaseTipo, 'Tipo de valor'),
    taxaIvaPreset: validateRequired(form.taxaIvaPreset, 'Taxa de IVA'),
    ivaDedutivel:
      form.ivaDedutivel === 'sim' || form.ivaDedutivel === 'nao'
        ? null
        : 'Indique se o IVA é dedutível.',
  };

  if (form.taxaIvaPreset === 'outra') {
    errors.taxaIvaOutra = validateNumber(form.taxaIvaOutra, 'Taxa de IVA', 0);
    const taxa = parseFloat(form.taxaIvaOutra);
    if (!errors.taxaIvaOutra && taxa > 100) {
      errors.taxaIvaOutra = 'Taxa de IVA deve ser no máximo 100.';
    }
  }

  const calc = previewIvaFromForm(form);
  if (!calc && !errors.valorBaseTipo && !errors.taxaIvaPreset && !errors.taxaIvaOutra) {
    errors.valor = 'Não foi possível calcular o IVA. Verifique o valor e a taxa.';
  }

  return errors;
}

export function summarizeIva({ gastos = [], gastosEmpresa = [], ivaEntregar = [] }) {
  let totalGastos = 0;
  let totalSemIva = 0;
  let totalIva = 0;
  let ivaDedutivel = 0;
  let ivaNaoDedutivel = 0;
  let gastosSemIvaInfo = 0;
  let gastosComIvaInfo = 0;

  const todos = [...gastos, ...gastosEmpresa];

  for (const gasto of todos) {
    if (isGastoForaDoIvaEmerson(gasto)) continue;
    totalGastos += getGastoValorAssinado(gasto);

    if (hasIvaInfo(gasto)) {
      gastosComIvaInfo += 1;
      totalSemIva += applySinal(Number(gasto.valorSemIva) || 0, gasto);
      totalIva += applySinal(Number(gasto.valorIva) || 0, gasto);
      if (gasto.ivaDedutivelValor != null && Number.isFinite(Number(gasto.ivaDedutivelValor))) {
        ivaDedutivel += applySinal(Number(gasto.ivaDedutivelValor) || 0, gasto);
        ivaNaoDedutivel += applySinal(
          gasto.ivaNaoDedutivelValor != null
            ? Number(gasto.ivaNaoDedutivelValor) || 0
            : Math.max(0, (Number(gasto.valorIva) || 0) - (Number(gasto.ivaDedutivelValor) || 0)),
          gasto
        );
      } else if (gasto.ivaDedutivel === true) {
        ivaDedutivel += applySinal(Number(gasto.valorIva) || 0, gasto);
      } else if (gasto.ivaDedutivel === false) {
        ivaNaoDedutivel += applySinal(Number(gasto.valorIva) || 0, gasto);
      }
    } else {
      gastosSemIvaInfo += 1;
    }
  }

  const ivaAEntregar = ivaEntregar.reduce((sum, item) => sum + (Number(item.valor) || 0), 0);
  const saldo = roundMoney(ivaDedutivel - ivaAEntregar);

  return {
    totalGastos: roundMoney(totalGastos),
    totalSemIva: roundMoney(totalSemIva),
    totalIva: roundMoney(totalIva),
    ivaDedutivel: roundMoney(ivaDedutivel),
    ivaNaoDedutivel: roundMoney(ivaNaoDedutivel),
    ivaAEntregar: roundMoney(ivaAEntregar),
    saldo,
    gastosSemIvaInfo,
    gastosComIvaInfo,
  };
}

export function monthToDateRange(yearMonth) {
  if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) return null;
  const [year, month] = yearMonth.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return {
    inicio: `${yearMonth}-01`,
    fim: `${yearMonth}-${String(lastDay).padStart(2, '0')}`,
  };
}

export const EMPTY_IVA_ENTREGAR_FORM = {
  data: '',
  descricao: '',
  valor: '',
  observacao: '',
};

export function getEmptyIvaEntregarForm() {
  return { ...EMPTY_IVA_ENTREGAR_FORM, data: getTodayISO() };
}

export function ivaEntregarToForm(record) {
  if (!record) return getEmptyIvaEntregarForm();
  return {
    data: record.data || getTodayISO(),
    descricao: record.descricao || '',
    valor: record.valor != null ? String(record.valor) : '',
    observacao: record.observacao || '',
  };
}

export function formToIvaEntregarPayload(form) {
  return {
    data: form.data,
    descricao: (form.descricao || '').trim(),
    valor: roundMoney(parseFloat(form.valor)),
    observacao: (form.observacao || '').trim(),
  };
}

export function validateIvaEntregarForm(form) {
  return validateForm({
    data: validateRequired(form.data, 'Data'),
    descricao: validateRequired(form.descricao, 'Descrição/período'),
    valor: validateNumber(form.valor, 'Valor de IVA', 0.01),
  });
}

export function buildIvaEntregarUpdate(record, form) {
  return {
    ...record,
    ...formToIvaEntregarPayload(form),
    updatedAt: new Date().toISOString(),
  };
}

export function isIvaEntregarFormDirty(form, initialForm) {
  return JSON.stringify(form) !== JSON.stringify(initialForm);
}
