import { calcDiariaTotal } from './calculations';
import { asRecordList } from './safeCollections';
import {
  diariaPertenceAObra,
  filterDiariasDaObra,
  getDiariaCustoNaObra,
  getDiariaQuantidadeNaObra,
} from './diariaObraAlocacao';

export function filterDiarias(diarias = [], { obraId, inicio, fim } = {}) {
  return asRecordList(diarias).filter((d) => {
    if (obraId && !diariaPertenceAObra(d, obraId)) return false;
    if (inicio && d.data && d.data < inicio) return false;
    if (fim && d.data && d.data > fim) return false;
    return true;
  });
}

export function calcTotalDiarias(diarias = [], { obraId } = {}) {
  return asRecordList(diarias).reduce((sum, d) => {
    if (obraId) return sum + getDiariaCustoNaObra(d, obraId);
    return sum + calcDiariaTotal(d);
  }, 0);
}

/** Soma das quantidades registadas — baseado apenas em diárias cadastradas. */
export function calcDiasTrabalhadosObra(obraId, diarias = []) {
  return filterDiariasDaObra(diarias, obraId).reduce(
    (sum, d) => sum + getDiariaQuantidadeNaObra(d, obraId),
    0
  );
}

/** Dias por funcionário numa obra, ordenados do maior para o menor. */
export function calcDiasPorFuncionarioObra(obraId, diarias = [], funcionarios = []) {
  const map = {};

  filterDiariasDaObra(diarias, obraId).forEach((d) => {
    const id = d.funcionarioId;
    if (!id) return;
    map[id] = (map[id] || 0) + getDiariaQuantidadeNaObra(d, obraId);
  });

  return Object.entries(map)
    .map(([funcionarioId, dias]) => ({
      funcionarioId,
      nome: asRecordList(funcionarios).find((f) => f.id === funcionarioId)?.nome || '—',
      dias,
    }))
    .filter((entry) => entry.dias > 0)
    .sort((a, b) => b.dias - a.dias);
}
