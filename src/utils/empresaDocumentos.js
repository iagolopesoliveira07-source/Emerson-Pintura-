import { DOCUMENTO_STATUS, DOCUMENTO_STATUS_LABELS } from '../constants/empresaIva';
import { generateId } from '../services/storageService';
import { getYearMonth } from './empresaFinanceiroCalculations';
import { getGastoEmpresaValor, isGastoEmpresaPrevisto } from './gastoEmpresaCalculations';
import { roundMoney } from './ivaCalculations';
import { filterByPeriod } from './periodFilter';

function dateOfDocumento(gasto) {
  return gasto?.data || gasto?.dataPagamento || '';
}

export function getDocumentoStatus(gasto) {
  if (gasto?.documentoStatus) return gasto.documentoStatus;
  if (Array.isArray(gasto?.anexos) && gasto.anexos.length > 0) return DOCUMENTO_STATUS.FATURA_ANEXADA;
  return DOCUMENTO_STATUS.SEM_DOCUMENTO;
}

export function getDocumentoStatusLabel(status) {
  return DOCUMENTO_STATUS_LABELS[status] || DOCUMENTO_STATUS_LABELS[DOCUMENTO_STATUS.SEM_DOCUMENTO];
}

export function resolveDocumentoStatusOnSave(form, existing = null) {
  const anexos = Array.isArray(form.anexos) ? form.anexos : existing?.anexos || [];
  const hasFiles = anexos.length > 0;
  const current = form.documentoStatus || existing?.documentoStatus || DOCUMENTO_STATUS.SEM_DOCUMENTO;

  if (
    current === DOCUMENTO_STATUS.PRONTA_CONTABILIDADE ||
    current === DOCUMENTO_STATUS.ENVIADA_CONTABILIDADE
  ) {
    return current;
  }
  if (hasFiles) return DOCUMENTO_STATUS.FATURA_ANEXADA;
  return DOCUMENTO_STATUS.SEM_DOCUMENTO;
}

export async function fileToAnexo(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Não foi possível ler o ficheiro.'));
    reader.readAsDataURL(file);
  });
  return {
    id: generateId(),
    nome: file.name,
    tipo: file.type || 'application/octet-stream',
    tamanho: file.size || 0,
    dataUrl,
    createdAt: new Date().toISOString(),
    extracao: null,
  };
}

export function summarizeDocumentos(gastos = [], options = '') {
  const { yearMonth = '', range = null } =
    typeof options === 'string' ? { yearMonth: options } : options || {};
  const acc = {
    total: 0,
    totalValor: 0,
    semDocumento: 0,
    faturaAnexada: 0,
    prontos: 0,
    enviados: 0,
  };

  filterGastosDocumentos(gastos, { yearMonth, range }).forEach((gasto) => {
    acc.total += 1;
    acc.totalValor = roundMoney(acc.totalValor + getGastoEmpresaValor(gasto));
    const status = getDocumentoStatus(gasto);
    if (status === DOCUMENTO_STATUS.SEM_DOCUMENTO) acc.semDocumento += 1;
    else if (status === DOCUMENTO_STATUS.FATURA_ANEXADA) acc.faturaAnexada += 1;
    else if (status === DOCUMENTO_STATUS.PRONTA_CONTABILIDADE) acc.prontos += 1;
    else if (status === DOCUMENTO_STATUS.ENVIADA_CONTABILIDADE) acc.enviados += 1;
  });

  return acc;
}

export function filterGastosDocumentos(gastos = [], { status = '', yearMonth = '', range = null } = {}) {
  const byPeriod = range ? filterByPeriod(gastos, range, dateOfDocumento) : gastos;
  return (byPeriod || []).filter((gasto) => {
    if (isGastoEmpresaPrevisto(gasto)) return false;
    if (!range && yearMonth && getYearMonth(dateOfDocumento(gasto)) !== yearMonth) return false;
    if (status && getDocumentoStatus(gasto) !== status) return false;
    return true;
  });
}
