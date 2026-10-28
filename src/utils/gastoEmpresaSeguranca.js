import { DOCUMENTO_STATUS_LABELS } from '../constants/empresaIva';
import { formatCurrency, formatDate } from './formatters';
import { getGastoEmpresaValor } from './gastoEmpresaCalculations';

const CAMPOS_HISTORICO = [
  { key: 'valor', label: 'Valor' },
  { key: 'fornecedorNome', label: 'Fornecedor' },
  { key: 'data', label: 'Data' },
  { key: 'categoria', label: 'Categoria' },
  { key: 'taxaIva', label: 'Taxa de IVA' },
  { key: 'ivaDedutivelValor', label: 'IVA dedutível' },
  { key: 'percentagemDedutivel', label: 'Dedutibilidade IVA' },
  { key: 'obraId', label: 'Obra' },
  { key: 'veiculoId', label: 'Veículo' },
  { key: 'documentoStatus', label: 'Documento' },
  { key: 'observacao', label: 'Observações' },
];

const MAX_HISTORICO = 25;

export const UNDO_GASTO_EMPRESA_MS = 8000;

export function snapshotGastoEmpresaImportante(gasto) {
  return {
    valor: getGastoEmpresaValor(gasto),
    fornecedorNome: gasto?.fornecedorNome || '',
    data: gasto?.data || '',
    categoria: gasto?.categoria || '',
    taxaIva: gasto?.taxaIva ?? null,
    ivaDedutivelValor:
      gasto?.ivaDedutivelValor != null ? Number(gasto.ivaDedutivelValor) : null,
    percentagemDedutivel:
      gasto?.percentagemDedutivel != null ? Number(gasto.percentagemDedutivel) : null,
    obraId: gasto?.obraId || null,
    veiculoId: gasto?.veiculoId || '',
    documentoStatus: gasto?.documentoStatus || '',
    observacao: gasto?.observacao || '',
  };
}

function valoresIguais(campo, a, b) {
  if (campo === 'valor' || campo === 'ivaDedutivelValor' || campo === 'percentagemDedutivel' || campo === 'taxaIva') {
    const na = a == null || a === '' ? null : Number(a);
    const nb = b == null || b === '' ? null : Number(b);
    if (na == null && nb == null) return true;
    if (na == null || nb == null) return false;
    return Math.round(na * 100) === Math.round(nb * 100);
  }
  return String(a ?? '').trim() === String(b ?? '').trim();
}

export function diffGastoEmpresaImportante(anterior, seguinte) {
  const de = snapshotGastoEmpresaImportante(anterior);
  const para = snapshotGastoEmpresaImportante(seguinte);
  return CAMPOS_HISTORICO.flatMap(({ key, label }) => {
    if (valoresIguais(key, de[key], para[key])) return [];
    return [{ campo: key, label, de: de[key] ?? null, para: para[key] ?? null }];
  });
}

export function appendGastoEmpresaHistorico(existing, next) {
  if (!existing || !next || existing.id !== next.id) return next;
  const alteracoes = diffGastoEmpresaImportante(existing, next);
  const historicoAnterior = Array.isArray(existing.historicoAlteracoes)
    ? existing.historicoAlteracoes
    : [];
  if (!alteracoes.length) {
    return {
      ...next,
      historicoAlteracoes: historicoAnterior,
    };
  }
  return {
    ...next,
    historicoAlteracoes: [
      ...historicoAnterior,
      { em: new Date().toISOString(), alteracoes },
    ].slice(-MAX_HISTORICO),
  };
}

export function formatGastoEmpresaHistoricoValor(campo, valor, { obras = [], veiculos = [] } = {}) {
  if (valor == null || valor === '') return '—';
  if (campo === 'valor' || campo === 'ivaDedutivelValor') return formatCurrency(valor);
  if (campo === 'data') return formatDate(valor);
  if (campo === 'taxaIva' || campo === 'percentagemDedutivel') {
    return `${Number(valor).toLocaleString('pt-PT', { maximumFractionDigits: 2 })}%`;
  }
  if (campo === 'obraId') return obras.find((obra) => obra.id === valor)?.nome || String(valor);
  if (campo === 'veiculoId') {
    return veiculos.find((veiculo) => veiculo.id === valor)?.nome || String(valor);
  }
  if (campo === 'documentoStatus') return DOCUMENTO_STATUS_LABELS[valor] || String(valor);
  return String(valor);
}

export function getGastoEmpresaFornecedorLabel(gasto) {
  const nome = String(gasto?.fornecedorNome || '').trim();
  return nome || '—';
}
