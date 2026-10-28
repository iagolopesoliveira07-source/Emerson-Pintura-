import { getEmptyGastoEmpresaForm, formToGastoEmpresaPayload } from './gastoEmpresaForm';
import {
  isCategoriaCarregamento,
  isCategoriaCombustivel,
  isCategoriaManutencao,
  isCategoriaViaVerde,
} from './empresaFinanceiroCalculations';

export const DESTINO_GASTO = {
  EMPRESA: 'empresa',
  OBRA_SEM_ESPECIFICA: 'obra_sem_especifica',
};

function normalizeCategoria(categoria) {
  return String(categoria || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function isCategoriaObraDireta(categoria) {
  const nome = normalizeCategoria(categoria);
  if (!nome) return false;
  return (
    nome.includes('material') ||
    nome.includes('tinta') ||
    nome.includes('madeira') ||
    nome.includes('pvc') ||
    nome.includes('ferrag') ||
    nome.includes('ferrament') ||
    nome.includes('equipamento')
  );
}

export function isCategoriaEmpresaGeral(categoria) {
  if (isCategoriaObraDireta(categoria)) return false;

  const nome = normalizeCategoria(categoria);
  if (!nome) return false;

  if (isCategoriaCombustivel(categoria) || nome.includes('gasolina') || nome.includes('gasoleo') || nome.includes('gasoil')) {
    return true;
  }
  if (isCategoriaCarregamento(categoria) || nome.includes('eletrico') || nome.includes('electric')) {
    return true;
  }
  if (isCategoriaViaVerde(categoria)) return true;
  if (nome.includes('seguro')) return true;
  if (
    isCategoriaManutencao(categoria) &&
    (nome.includes('viatura') || nome.includes('carrinha') || nome.includes('carro') || nome.includes('veiculo') || nome === 'manutencao')
  ) {
    return true;
  }
  if (
    (nome.includes('prestacao') || nome.includes('financiamento') || nome.includes('parcela')) &&
    (nome.includes('viatura') || nome.includes('carrinha') || nome.includes('carro') || nome.includes('veiculo'))
  ) {
    return true;
  }
  if (nome.includes('aluguel') || nome.includes('aluguer') || nome.includes('garagem')) return true;
  if (nome === 'agua' || nome.includes('agua')) return true;
  if (nome.includes('despesas gerais') || nome.includes('despesas da empresa') || nome.includes('outras despesas')) {
    return true;
  }
  return false;
}

export function suggestDestinoGastoSemObra(categoria) {
  return isCategoriaEmpresaGeral(categoria)
    ? DESTINO_GASTO.EMPRESA
    : DESTINO_GASTO.OBRA_SEM_ESPECIFICA;
}

export function resolveDestinoGastoSemObra(form) {
  if (form?.obraId) return null;
  if (form?.destinoSemObra === DESTINO_GASTO.EMPRESA) return DESTINO_GASTO.EMPRESA;
  if (form?.destinoSemObra === DESTINO_GASTO.OBRA_SEM_ESPECIFICA) {
    return DESTINO_GASTO.OBRA_SEM_ESPECIFICA;
  }
  return suggestDestinoGastoSemObra(form?.categoria);
}

export function destinoGastoSemObraLabel(destino) {
  if (destino === DESTINO_GASTO.EMPRESA) return 'Gastos da Empresa';
  return 'Gastos das Obras — Sem obra específica';
}

export function mapObraCategoriaToEmpresa(categoria) {
  const nome = normalizeCategoria(categoria);
  if (isCategoriaViaVerde(categoria)) return 'Via Verde / Portagens';
  if (isCategoriaCarregamento(categoria) || nome.includes('eletrico') || nome.includes('electric')) {
    return 'Carregamento / Eletricidade';
  }
  if (isCategoriaCombustivel(categoria) || nome.includes('gasolina') || nome.includes('gasoleo')) {
    return 'Combustível';
  }
  if (nome.includes('seguro') && (nome.includes('carrinha') || nome.includes('viatura') || nome.includes('carro'))) {
    return 'Seguro das carrinhas';
  }
  if (nome.includes('seguro')) return 'Seguros gerais da empresa';
  if (isCategoriaManutencao(categoria)) return 'Manutenção e reparação de carrinhas';
  if (nome.includes('prestacao') || nome.includes('financiamento') || nome.includes('parcela')) {
    return 'Parcelas / financiamento das carrinhas';
  }
  if (nome.includes('garagem')) return 'Aluguer de garagem';
  if (nome.includes('aluguel') || nome.includes('aluguer')) return 'Aluguer do galpão / armazém';
  if (nome.includes('agua')) return 'Água';
  return 'Outras despesas da empresa';
}

export function destinoPrecisaViatura(categoria) {
  return (
    isCategoriaCombustivel(categoria) ||
    isCategoriaCarregamento(categoria) ||
    isCategoriaManutencao(categoria) ||
    isCategoriaViaVerde(categoria)
  );
}

export function obraGastoFormToEmpresaPayload(form, options = {}) {
  const empresaForm = getEmptyGastoEmpresaForm({
    descricao: (form.descricao || '').trim() || String(form.categoria || '').trim(),
    categoria: mapObraCategoriaToEmpresa(form.categoria),
    valor: form.valor,
    data: form.data,
    dataPagamento: form.data,
    estado: 'pago',
    tipo: 'unico',
    observacao: form.observacao || '',
    veiculoId: form.veiculoId || '',
    veiculo: form.veiculo || '',
    obraId: '',
    fornecedorId: form.fornecedorId || '',
    fornecedorNome: form.fornecedorNome || form.fornecedor || '',
    salvarFornecedor: form.salvarFornecedor || 'nao',
    temIva: form.temIva || '',
    valorBaseTipo: form.valorBaseTipo || '',
    taxaIvaPreset: form.taxaIvaPreset || '',
    taxaIvaOutra: form.taxaIvaOutra || '',
    ivaManual: form.ivaManual || 'nao',
    percentagemDedutivel: form.percentagemDedutivel || '',
    faturaMultiplasTaxas: form.faturaMultiplasTaxas || 'nao',
    ivaLinhas: form.ivaLinhas || [],
    tipoDocumento: form.tipoDocumento,
    numeroFatura: form.numeroFatura || '',
    faturaOriginalId: form.faturaOriginalId || '',
  });

  return formToGastoEmpresaPayload(empresaForm, options);
}
