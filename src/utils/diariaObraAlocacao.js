import { roundMoney } from './ivaCalculations';

export const DIARIA_FRACAO = {
  MEIO: 0.5,
  INTEIRO: 1,
};

export const DIARIA_FRACAO_OPTIONS = [
  { value: DIARIA_FRACAO.MEIO, label: 'Meio dia' },
  { value: DIARIA_FRACAO.INTEIRO, label: 'Dia inteiro' },
];

function toQuantidade(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n;
}

function shapeAlocacao(item) {
  if (!item || typeof item !== 'object') return null;
  const obraId = item.obraId || null;
  const quantidade = toQuantidade(item.quantidade);
  if (!obraId && quantidade <= 0) return null;
  return {
    obraId,
    quantidade,
    intervencaoId: item.intervencaoId || null,
  };
}

export function isDiariaMultiObra(diaria) {
  if (!Array.isArray(diaria?.obrasDoDia)) return false;
  const obras = diaria.obrasDoDia.map(shapeAlocacao).filter((item) => item?.obraId);
  return obras.length >= 2;
}

export function getDiariaAlocacoes(diaria) {
  if (isDiariaMultiObra(diaria)) {
    return diaria.obrasDoDia.map(shapeAlocacao).filter((item) => item?.obraId);
  }
  return [
    {
      obraId: diaria?.obraId || null,
      quantidade: toQuantidade(diaria?.quantidade),
      intervencaoId: diaria?.intervencaoId || null,
    },
  ];
}

export function diariaPertenceAObra(diaria, obraId) {
  if (!diaria || !obraId) return false;
  return getDiariaAlocacoes(diaria).some((item) => item.obraId === obraId);
}

export function filterDiariasDaObra(diarias = [], obraId) {
  return (diarias || []).filter((diaria) => diaria && diariaPertenceAObra(diaria, obraId));
}

export function getDiariaQuantidadeNaObra(diaria, obraId) {
  if (!obraId) return 0;
  const alocacao = getDiariaAlocacoes(diaria).find((item) => item.obraId === obraId);
  return alocacao ? alocacao.quantidade : 0;
}

export function getDiariaIntervencaoNaObra(diaria, obraId) {
  if (!obraId) return null;
  const alocacao = getDiariaAlocacoes(diaria).find((item) => item.obraId === obraId);
  return alocacao?.intervencaoId || null;
}

export function diariaTemIntervencao(diaria, intervencaoId) {
  if (!intervencaoId) return false;
  return getDiariaAlocacoes(diaria).some((item) => item.intervencaoId === intervencaoId);
}

export function getDiariaQuantidadeNaIntervencao(diaria, intervencaoId) {
  if (!intervencaoId) return 0;
  return getDiariaAlocacoes(diaria)
    .filter((item) => item.intervencaoId === intervencaoId)
    .reduce((sum, item) => sum + item.quantidade, 0);
}

function diariaPagavel(diaria, funcionarios = []) {
  if (!diaria) return 0;
  const func = (funcionarios || []).find((item) => item && item.id === diaria.funcionarioId);
  if (func?.tipo === 'parceiro') return 0;
  return (Number(diaria.quantidade) || 0) * (Number(diaria.valorDiaria) || 0);
}

export function getDiariaCustoAlocado(diaria, quantidadeAlocada, funcionarios = []) {
  const pagavel = diariaPagavel(diaria, funcionarios);
  const totalFracao = getDiariaAlocacoes(diaria).reduce((sum, item) => sum + item.quantidade, 0);
  if (pagavel <= 0 || totalFracao <= 0 || quantidadeAlocada <= 0) return 0;
  return roundMoney(pagavel * (quantidadeAlocada / totalFracao));
}

export function getDiariaCustoNaObra(diaria, obraId, funcionarios = []) {
  return getDiariaCustoAlocado(diaria, getDiariaQuantidadeNaObra(diaria, obraId), funcionarios);
}

export function getDiariaCustoNaIntervencao(diaria, intervencaoId, funcionarios = []) {
  return getDiariaCustoAlocado(diaria, getDiariaQuantidadeNaIntervencao(diaria, intervencaoId), funcionarios);
}

export function formatDiariaQuantidade(quantidade) {
  const n = Number(quantidade) || 0;
  if (Math.abs(n - 0.5) < 0.001) return '½';
  if (Number.isInteger(n)) return String(n);
  return String(n).replace('.', ',');
}

export function formatDiariaQuantidadeLabel(quantidade) {
  const n = Number(quantidade) || 0;
  if (Math.abs(n - 0.5) < 0.001) return '½ diária';
  if (Math.abs(n - 1) < 0.001) return '1 diária';
  return `${formatDiariaQuantidade(n)} diárias`;
}

export function formatDiariaObrasLabel(diaria, resolveObraNome) {
  const alocacoes = getDiariaAlocacoes(diaria).filter((item) => item.obraId);
  if (!alocacoes.length) {
    return typeof resolveObraNome === 'function' ? resolveObraNome(null) || 'Serviço geral' : 'Serviço geral';
  }
  const nome = (obraId) => {
    const resolved = typeof resolveObraNome === 'function' ? resolveObraNome(obraId) : null;
    return resolved && resolved !== '—' ? resolved : 'Obra';
  };
  if (!isDiariaMultiObra(diaria) && alocacoes.length === 1) {
    return nome(alocacoes[0].obraId);
  }
  return alocacoes
    .map((item) => `${nome(item.obraId)} — ${formatDiariaQuantidadeLabel(item.quantidade)}`)
    .join('; ');
}

export function pruneDiariaObraDeleted(diaria, obraId) {
  if (!diaria || !diariaPertenceAObra(diaria, obraId)) return diaria;
  if (!isDiariaMultiObra(diaria)) return null;

  const rest = getDiariaAlocacoes(diaria).filter((item) => item.obraId !== obraId);
  if (!rest.length) return null;

  const principal = rest[0];
  return {
    ...diaria,
    obraId: principal.obraId,
    intervencaoId: principal.intervencaoId,
    obrasDoDia: rest.length >= 2 ? rest : [],
    updatedAt: new Date().toISOString(),
  };
}
