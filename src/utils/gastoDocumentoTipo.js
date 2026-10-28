export const TIPO_DOCUMENTO = {
  FATURA: 'fatura',
  NOTA_CREDITO: 'nota_credito',
};

export const TIPO_DOCUMENTO_LABELS = {
  [TIPO_DOCUMENTO.FATURA]: 'Fatura',
  [TIPO_DOCUMENTO.NOTA_CREDITO]: 'Nota de Crédito',
};

function roundMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function texto(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Detecta nota de crédito sem alterar o registo gravado. */
export function isNotaCredito(gasto) {
  if (!gasto) return false;
  if (gasto.notaCredito === true || gasto.isNotaCredito === true) return true;
  const tipo = texto(
    gasto.tipoDocumento || gasto.documentoTipo || gasto.tipoFatura || gasto.tipoLancamentoDocumento
  );
  if (tipo === TIPO_DOCUMENTO.NOTA_CREDITO) return true;
  if (/(nota\s*de\s*credito|nota_credito|\bnc\b)/.test(tipo)) return true;
  const natureza = texto(gasto.natureza);
  return natureza === 'nota_credito' || natureza === 'credito';
}

export function getTipoDocumento(gasto) {
  return isNotaCredito(gasto) ? TIPO_DOCUMENTO.NOTA_CREDITO : TIPO_DOCUMENTO.FATURA;
}

export function getTipoDocumentoLabel(gasto) {
  return TIPO_DOCUMENTO_LABELS[getTipoDocumento(gasto)];
}

export function getGastoDocumentoSinal(gasto) {
  const valor = Number(gasto?.valorComIva ?? gasto?.valor) || 0;
  if (valor < 0) return -1;
  return isNotaCredito(gasto) ? -1 : 1;
}

/** Aplica sinal de nota de crédito só na leitura; valores já negativos ficam como estão. */
export function applySinal(valor, gasto) {
  const n = Number(valor) || 0;
  if (n < 0) return n;
  if (isNotaCredito(gasto)) return roundMoney(-Math.abs(n));
  return roundMoney(n);
}

export function getGastoValorAssinado(gasto) {
  if (!gasto) return 0;
  const bruto =
    gasto.valorComIva != null && Number.isFinite(Number(gasto.valorComIva))
      ? Number(gasto.valorComIva)
      : Number(gasto.valor) || 0;
  return applySinal(bruto, gasto);
}

export function gastoPagoPeloCliente(gasto) {
  return gasto?.pagoPeloCliente === true;
}

/** Valor que conta como custo da empresa. O registo e o IVA mantêm o valor original. */
export function getGastoCustoEmpresa(gasto) {
  if (gastoPagoPeloCliente(gasto)) return 0;
  return getGastoValorAssinado(gasto);
}

export function alternarGastoPagoPeloCliente(gasto) {
  if (!gasto) return gasto;
  return {
    ...gasto,
    pagoPeloCliente: gasto.pagoPeloCliente === true ? false : true,
    updatedAt: new Date().toISOString(),
  };
}

export function getDocumentoNumero(gasto) {
  return String(gasto?.numeroFatura || gasto?.numeroNotaCredito || gasto?.numeroDocumento || '').trim();
}

export function persistValorDocumento(form, valor) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return valor;
  return isNotaCredito(form) ? Math.abs(n) : n;
}

export function persistTipoDocumentoFields(form = {}) {
  const isNc = form.tipoDocumento === TIPO_DOCUMENTO.NOTA_CREDITO;
  return {
    tipoDocumento: isNc ? TIPO_DOCUMENTO.NOTA_CREDITO : TIPO_DOCUMENTO.FATURA,
    numeroFatura: String(form.numeroFatura || '').trim(),
    faturaOriginalId: isNc && form.faturaOriginalId ? form.faturaOriginalId : null,
  };
}

function fornecedorNome(gasto) {
  return String(gasto?.fornecedorNome || gasto?.fornecedor || '').trim();
}

/** Faturas (não NC) que podem ser ligadas a uma nota de crédito. */
export function listFaturasRelacionaveis(gastos = [], { fornecedorId, fornecedorNome: nomeFornecedor, excludeId } = {}) {
  const nome = String(nomeFornecedor || '').trim().toLowerCase();
  const filtrados = (gastos || []).filter((gasto) => {
    if (!gasto || gasto.id === excludeId) return false;
    if (isNotaCredito(gasto)) return false;
    const valor = Math.abs(Number(gasto.valorComIva ?? gasto.valor) || 0);
    if (!valor) return false;
    if (fornecedorId && gasto.fornecedorId) return gasto.fornecedorId === fornecedorId;
    if (nome) return fornecedorNome(gasto).toLowerCase() === nome;
    return true;
  });

  return filtrados
    .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')))
    .slice(0, 40);
}

export function aplicarFaturaOriginalAoForm(form, fatura) {
  if (!form || !fatura) return form;
  const next = { ...form, faturaOriginalId: fatura.id };
  if (!next.fornecedorId && !String(next.fornecedorNome || next.fornecedor || '').trim()) {
    next.fornecedorId = fatura.fornecedorId || '';
    next.fornecedorNome = fatura.fornecedorNome || fatura.fornecedor || '';
    next.fornecedor = next.fornecedorNome;
  }
  if (!next.obraId && fatura.obraId) next.obraId = fatura.obraId;
  if (!next.categoria && fatura.categoria) next.categoria = fatura.categoria;
  if (fatura.ivaInformado === true && next.temIva !== 'nao') {
    next.temIva = 'sim';
    if (!next.valorBaseTipo) next.valorBaseTipo = fatura.valorBaseTipo || 'com_iva';
    if (fatura.taxaIva != null && Number.isFinite(Number(fatura.taxaIva))) {
      const taxa = Number(fatura.taxaIva);
      next.taxaIvaPreset = taxa === 23 || taxa === 13 || taxa === 6 ? String(taxa) : 'outra';
      if (next.taxaIvaPreset === 'outra') next.taxaIvaOutra = String(taxa);
    }
    if (fatura.percentagemDedutivel != null && next.ivaManual !== 'sim') {
      next.percentagemDedutivel = String(fatura.percentagemDedutivel);
    } else if (
      fatura.percentualIvaRecuperavel != null &&
      next.ivaManual !== 'sim' &&
      (next.percentagemDedutivel === '' || next.percentagemDedutivel == null)
    ) {
      next.percentagemDedutivel = String(fatura.percentualIvaRecuperavel);
    }
    if (fatura.faturaMultiplasTaxas) {
      next.faturaMultiplasTaxas = 'sim';
      if (Array.isArray(fatura.ivaLinhas) && fatura.ivaLinhas.length) {
        next.ivaLinhas = fatura.ivaLinhas.map((linha) => ({
          id: linha.id,
          valorBase: linha.valorBase != null ? String(linha.valorBase) : '',
          taxaIva: linha.taxaIva != null ? String(linha.taxaIva) : '',
        }));
      }
    }
  }
  return next;
}

export function labelFaturaRelacionada(gasto, formatCurrency, formatDate) {
  if (!gasto) return '';
  const data = gasto.data && formatDate ? formatDate(gasto.data) : gasto.data || '';
  const numero = getDocumentoNumero(gasto);
  const valor = formatCurrency
    ? formatCurrency(Math.abs(Number(gasto.valorComIva ?? gasto.valor) || 0))
    : String(gasto.valor ?? '');
  const partes = [data, numero ? `nº ${numero}` : null, valor].filter(Boolean);
  return partes.join(' · ') || 'Fatura';
}
